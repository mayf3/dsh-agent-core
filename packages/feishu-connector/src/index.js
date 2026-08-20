/**
 * @agent-core/feishu-connector/src/index.js — Cordis plugin shell on the
 * official @larksuite/channel foundation (Phase A Foundation cutover).
 *
 * Wires the pure core / bridge layers into a Cordis plugin with the repo's
 * standard contract: named exports `name` / `inject` / `Config` / `apply`.
 *
 * ONE production connection, owned by @larksuite/channel: WebSocket
 * lifecycle + first-handshake readiness + bot identity + event normalization
 * + dedup (SeenCache/renewable ProcessingLock) + PolicyGate
 * (requireMention=false, with residual V0 mention eligibility in bridge) +
 * outbound protocol primitives, all under the frozen Foundation options in
 * core.js (batch delayMs=0, chat queue disabled, stale-drop disabled).
 * The legacy V0 transport.js WSClient path is DELETED — no dual WebSocket,
 * no legacy/official feature flag.
 *
 * Scope stays PURE CHANNEL: the bridge maps SDK NormalizedMessages onto the
 * existing IngressEvent shape, enforces the injected PREBOUND_ONLY gate
 * (fail-closed) and surfaces events through the `onEvent` callback; the
 * outbound seam `reply(replyTarget, text)` keeps the V0 ReplyTarget contract.
 * No DSH agent/session/workspace concept lives here (`inject` is empty).
 */

import { createLarkChannel } from '@larksuite/channel'
import { readFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import {
  FOUNDATION_LARK_CHANNEL_OPTIONS,
  replyTargetFor,
  replyTargetToSdkSend,
  conversationWorkspaceId,
} from './core.js'
import { normalizedToIngressEvent, createBridgeHandler, createReceiptReply } from './bridge.js'

// Re-export the pure adapter helpers for thin adapters and tests
// (conversationWorkspaceId stays exported as a TRANSITIONAL compatibility
// carrier — the V2 normal path never injects it into ingress events).
export { normalizedToIngressEvent, replyTargetFor, conversationWorkspaceId }

/** Stable plugin name referenced by bundle patches / manifests. */
export const name = 'feishu'

/** No hard DSH service dependency: the connector is a pure channel layer. */
export const inject = []

/**
 * Runtime defaults merged under the validated schema (see {@link Config}).
 * Function-typed members (onEvent / onStatus / log) intentionally live here,
 * not in the schema: they cannot be expressed in YAML config and are injected
 * programmatically by the mounting layer.
 */
const DEFAULTS = {
  appId: '',
  appSecret: '',
  credentialsPath: '',
  enabled: true,
  onEvent: null,
  // V2 PREBOUND_ONLY pre-forward gate predicate (programmatically injected by
  // the composition layer, e.g. production-runtime wiring it to
  // agentRouter.getBinding — the connector stays a pure channel and never
  // depends on the Router). Rejected events FAIL CLOSED: onEvent is never
  // called and the connector itself replies with the fixed
  // INGRESS_GATE_REJECTED_REPLY receipt. An ABSENT gate is fail-closed too:
  // messages are dropped until setIngressGate installs the predicate.
  ingressGate: null,
  onStatus: null,
  log: null,
}

/**
 * Cordis config schema (schemastery). Only data fields are validated;
 * unknown keys (onEvent/onStatus/log) pass through untouched, so the manual
 * default merge in apply() keeps working.
 */
export const Config = z.object({
  appId: z.string(),
  appSecret: z.string(),
  // Path to a credentials JSON/TOML file {appId, appSecret} — when set, it
  // overrides appId/appSecret inline values. Secrets are never logged.
  credentialsPath: z.string(),
  enabled: z.boolean().default(true),
})

function loadCredentials(config) {
  if (config.credentialsPath) {
    const raw = readFileSync(config.credentialsPath, 'utf8').trim()
    let creds
    try {
      creds = JSON.parse(raw)
    } catch {
      // TOML-ish "key = value" fallback (simple lines, no sections parse)
      creds = {}
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*["']?([A-Za-z0-9_]+)["']?\s*=\s*["']?([^#'"\r\n]+?)["']?\s*$/)
        if (m) creds[m[1]] = m[2].trim()
      }
    }
    return {
      appId: creds?.appId ?? creds?.app_id ?? config.appId,
      appSecret: creds?.appSecret ?? creds?.app_secret ?? config.appSecret,
    }
  }
  return { appId: config.appId, appSecret: config.appSecret }
}

/**
 * Bridge the SDK's structured logger onto the plugin's `(level, ...args)`
 * log surface (default: console). Keeps the SDK's protocol-layer noise on
 * the same observable surface as the connector's own lines.
 */
function sdkLoggerAdapter(log) {
  const forward = (level) => (...args) => {
    try {
      log(level, '[lark-channel]', ...args.map((a) => (typeof a === 'string' ? a : safeInspect(a))))
    } catch { /* never let logging break the channel */ }
  }
  return {
    debug: forward('debug'),
    info: forward('info'),
    warn: forward('warn'),
    error: forward('error'),
  }
}

function safeInspect(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Build the connector handle over a CONNECTABLE (not yet connected) SDK
 * channel: service surface, bridge wiring, status/reconnect bookkeeping and
 * the ready() promise. Extracted from apply() so it is unit-testable with a
 * stub channel (no network).
 *
 * @param {object} p
 * @param {object} p.channel - a @larksuite/channel instance (unconnected).
 * @param {object} p.cfg - the LIVE plugin config (DEFAULTS-merged).
 * @param {Function} p.log - `(level, ...args)` logger.
 * @param {() => Promise<void>} p.connect - starts the SDK connect()
 *   (identity + first handshake); the returned promise is ready().
 * @returns {object} the feishu handle (the `ctx.provide('feishu')` value).
 */
export function buildFeishuHandle({ channel, cfg, log, connect }) {
  const state = {
    connectionStatus: 'connecting',
    reconnectCount: 0,
    started: true,
  }

  function emitStatus(status) {
    state.connectionStatus = status
    if (typeof cfg.onStatus === 'function') {
      try {
        cfg.onStatus({ status, reconnectCount: state.reconnectCount })
      } catch (e) {
        log('error', `[feishu] onStatus handler threw: ${e?.message ?? e}`)
      }
    }
  }

  // EVENT_SURFACE = MESSAGE_ONLY (spec §9): the sole Feishu event handler is
  // `message`. reconnecting/reconnected/error are channel lifecycle
  // callbacks, not event surfaces — cardAction / reaction / comment /
  // meeting handlers are NOT registered and no onRawEvent catch-all exists.
  const onSdkMessage = createBridgeHandler({
    resolveBotIdentity: () => channel.getBotIdentity(),
    config: cfg,
    reply: createReceiptReply(channel, log),
    log,
  })
  channel.on({
    message: onSdkMessage,
    error: (err) => log('error', `[feishu] channel error: ${err?.code ?? ''} ${err?.message ?? err}`),
    reconnecting: () => {
      state.reconnectCount += 1
      emitStatus('reconnecting')
      log('warn', `[feishu] connection lost; SDK reconnecting (count=${state.reconnectCount})`)
    },
    reconnected: () => {
      emitStatus('connected')
      log('info', '[feishu] SDK reconnected')
    },
  })

  // Start the connect (bot identity resolution + first WS handshake). The
  // promise IS the readiness surface: compose() awaits ready() before
  // declaring the channel live; a rejection (identity/handshake failure) is
  // startup fail-loud.
  const readyPromise = connect()
  readyPromise.then(
    () => {
      emitStatus('connected')
      const identity = channel.botIdentity
      log('info', `[feishu] channel live: first handshake done, bot identity resolved (${identity?.openId?.slice(0, 8) ?? '?'}...)`)
    },
    () => { /* failure path is consumed by ready() awaiters; logged there */ },
  )

  const handle = {
    pluginName: name,
    started: true,
    /**
     * Readiness: resolves after the SDK first handshake completes AND the
     * bot identity is resolved; rejects (fail-loud) when either fails.
     * production-runtime awaits this before declaring the channel live.
     */
    ready() {
      return readyPromise
    },
    /** Outbound: reply into a conversation/thread using a ReplyTarget. */
    async reply(replyTarget, text, opts = {}) {
      const plan = replyTargetToSdkSend(replyTarget, text)
      const result = await channel.send(plan.to, plan.input, plan.opts)
      if (!result?.messageId) {
        // EMPTY_MESSAGE_ID_REJECTION (spec §10): a send that "succeeded"
        // without a message id is a failure — reject, never fake success.
        throw new Error(`feishu-connector: send returned no message_id (${plan.method})`)
      }
      log('info', `[feishu] reply sent via ${plan.method} (${result.messageId}${result.chunkIds ? `, ${result.chunkIds.length} chunks` : ''})`)
      return {
        messageId: result.messageId,
        chatId: replyTarget?.chatId ?? '',
        method: plan.method,
        ...(result.chunkIds ? { chunkIds: result.chunkIds } : {}),
      }
    },
    /** Build a ReplyTarget from a normalized IngressEvent. */
    replyTargetFor(ev) {
      return replyTargetFor(ev)
    },
    /** Current connection status. */
    status() {
      const sdk = channel.getConnectionStatus?.()
      const mapped = mapConnectionState(sdk?.state)
      return mapped ?? state.connectionStatus
    },
    /** Reconnect counter (accumulated from the SDK reconnecting events —
     *  the SDK surface exposes no equivalent counter). */
    reconnectCount() {
      return state.reconnectCount
    },
    /** Swap the ingress callback (e.g. after the router mounts). */
    setCallback(fn) {
      cfg.onEvent = typeof fn === 'function' ? fn : cfg.onEvent
    },
    /** Swap the V2 pre-forward ingress gate predicate (e.g. the composition
     *  layer wiring PREBOUND_ONLY via the Router's generic read APIs). */
    setIngressGate(fn) {
      cfg.ingressGate = typeof fn === 'function' ? fn : cfg.ingressGate
    },
    // keep a reference so callers can inspect the channel
    _channel: channel,
  }

  return handle
}

function mapConnectionState(sdkState) {
  if (typeof sdkState !== 'string') return undefined
  const s = sdkState.toLowerCase()
  if (s.includes('reconnect')) return 'reconnecting'
  if (s.includes('dis')) return 'disconnected'
  if (s.includes('connected')) return 'connected'
  if (s.includes('connect')) return 'connecting'
  return undefined
}

/**
 * Mount the plugin.
 * @param {object} ctx - Cordis context (createPluginContext shape).
 * @param {object} config - validated plugin config.
 * @returns {object} handle exposing reply() / ready() / status() /
 *   setCallback() / setIngressGate().
 */
export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config ?? {}) }
  const log = cfg.log ?? ((level, ...args) => {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(...args)
  })

  if (!cfg.enabled) {
    log('warn', '[feishu] disabled by config; plugin mounted but not connected')
    return {
      started: false,
      reply: async () => { throw new Error('feishu disabled') },
      status: () => 'disabled',
      ready: async () => 'disabled',
    }
  }

  const creds = loadCredentials(cfg)
  if (!creds.appId || !creds.appSecret) {
    throw new Error('[feishu] appId/appSecret (or credentialsPath) required when enabled')
  }

  const channel = createLarkChannel({
    appId: creds.appId,
    appSecret: creds.appSecret,
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger: sdkLoggerAdapter(log),
  })

  const handle = buildFeishuHandle({
    channel,
    cfg,
    log,
    connect: () => channel.connect(),
  })

  // SDK_SHUTDOWN_CLEANUP (spec §9): the ctx disposer tears the SDK
  // connection down. NOTE: context.effect consumes a SYNCHRONOUS disposer
  // (an async return value would never be registered — the V0 shell's
  // `ctx.effect(async ...)` disposer was silently dropped); the async
  // lifecycle itself is carried by ready(), not by this hook.
  ctx.effect(() => () => {
    channel.disconnect().catch((error) => {
      log('warn', `[feishu] disconnect cleanup failed: ${error?.message ?? error}`)
    })
  })

  // Publish the channel handle as a service so sibling plugins in the same
  // composition (e.g. the agent-router / control plane) can bind the ingress
  // callback and send replies through it. Cordis injectable as 'feishu'.
  ctx.provide('feishu', handle)

  return handle
}
