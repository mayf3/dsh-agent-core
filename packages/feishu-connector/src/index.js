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
import {
  createProcessingReactionLifecycle,
  bridgeConfigWithProcessingReaction,
} from './processing-reaction.js'
import { replyCardSendPlan } from './reply-card.js'
import { createRedactingLogger, sdkLoggerAdapter } from './log-redaction.js'

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
  // REQUIRE_MENTION_IN_GROUP / AUTO_MENTION_TRIGGER_SENDER switches: the
  // inbound group/topic mention requirement and the success-reply
  // triggering-sender mention are INDEPENDENT config fields. Both default
  // true — the byte-identical pre-switch behavior (AGENT_CORE_LARK_UX_PHASE1_V2
  // semantics). An explicit false disables exactly one activation.
  requireMentionInGroup: true,
  autoMentionTriggerSender: true,
  // PROCESSING_REACTION switch (OWNER_RULING = ENABLE_FEISHU_PROCESSING_
  // REACTION): default false — one `Typing` reaction on the ORIGINAL inbound
  // message while the admitted Agent turn runs, removed in the turn's
  // finally. Strict env parsing lives in production-runtime
  // (FEISHU_PROCESSING_REACTION_ENABLED; invalid values fail loud).
  processingReactionEnabled: false,
  // REPLY_RENDER_MODE switch (OWNER_RULING = ENABLE_STATIC_FEISHU_REPLY_CARD,
  // STATIC_FINAL_CARD_V1): default 'markdown' — byte-identical current
  // production rendering. 'card' re-renders ONLY the Router success reply
  // (the sole caller carrying ux intent) as a button-less CardKit 2.0 static
  // card. Strict env parsing lives in production-runtime
  // (FEISHU_REPLY_RENDER_MODE; invalid values fail loud).
  replyRenderMode: 'markdown',
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
  // Drop ordinary (no-mention) group/topic messages at the bridge admission
  // segment. Default true = the frozen V0/UX behavior.
  requireMentionInGroup: z.boolean().default(true),
  // Final switch over the Router success call's autoMentionTriggerSender
  // intent: false composes NO opts.mentions (markdown / anchoring / body
  // untouched). Default true = the frozen UX Phase1 behavior.
  autoMentionTriggerSender: z.boolean().default(true),
  // One-shot `Typing` processing reaction on the original inbound message
  // around the full admitted Agent turn (see src/processing-reaction.js).
  // Default false = off. The emoji type is NOT configurable (a typo'd
  // emoji_type would fail silently inside Feishu).
  processingReactionEnabled: z.boolean().default(false),
  // Final success-reply rendering mode (STATIC_FINAL_CARD_V1, see
  // src/reply-card.js). 'markdown' (default) = the frozen UX Phase1
  // behavior, byte-identical. 'card' = button-less CardKit 2.0 static card
  // for the Router success reply ONLY. apply() rejects any other value
  // fail-loud (FEISHU_REPLY_RENDER_MODE_INVALID).
  replyRenderMode: z.string().default('markdown'),
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
        log('error', '[feishu] onStatus handler threw', e)
      }
    }
  }

  // PROCESSING_REACTION lifecycle (default OFF): wraps the Router's onEvent
  // at the connector callback seam — strictly AFTER bridge admission — so
  // only admitted messages can gain the one-shot `Typing` reaction. The
  // facade keeps every bridge-read config key LIVE over cfg (bridge.js stays
  // byte-identical; the reaction lifecycle lives entirely in
  // src/processing-reaction.js).
  const processingReaction = createProcessingReactionLifecycle({ channel, log })

  // EVENT_SURFACE = MESSAGE_ONLY (spec §9): the sole Feishu event handler is
  // `message`. reconnecting/reconnected/error are channel lifecycle
  // callbacks, not event surfaces — cardAction / reaction / comment /
  // meeting handlers are NOT registered and no onRawEvent catch-all exists.
  const onSdkMessage = createBridgeHandler({
    resolveBotIdentity: () => channel.getBotIdentity(),
    config: bridgeConfigWithProcessingReaction(cfg, processingReaction),
    reply: createReceiptReply(channel, log),
    log,
  })
  channel.on({
    message: onSdkMessage,
    error: (err) => log('error', '[feishu] channel error', err),
    reconnecting: () => {
      state.reconnectCount += 1
      emitStatus('reconnecting')
      log('warn', '[feishu] connection lost; SDK reconnecting', { reconnectCount: state.reconnectCount })
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
      log('info', '[feishu] channel live: first handshake done, bot identity resolved')
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
    /**
     * Outbound: reply into a conversation/thread using a ReplyTarget.
     * `opts.ux` (UX Phase1 V2) carries Router INTENT flags only —
     * `{ rendering: 'markdown', autoMentionTriggerSender: true }` — which
     * replyTargetToSdkSend maps onto the SDK-native markdown send plan and
     * the SDK SendOptions.mentions primitive. Callers that omit it (receipts,
     * scheduler/proactive) get the byte-identical V0 plain-text plan. The
     * SDK owns chunking/fallback/retry; this seam adds none.
     */
    async reply(replyTarget, text, opts = {}) {
      // AUTO_MENTION_TRIGGER_SENDER config = the FINAL switch over the Router
      // success call's intent: an explicit `false` composes no opts.mentions —
      // and ONLY that. Markdown rendering, reply/thread anchoring and the
      // body stay byte-identical; every caller without the intent is
      // unaffected either way.
      const ux = cfg.autoMentionTriggerSender === false && opts?.ux?.autoMentionTriggerSender === true
        ? { ...opts.ux, autoMentionTriggerSender: false }
        : opts?.ux
      // REPLY_RENDER_MODE (STATIC_FINAL_CARD_V1): the connector is the final
      // display-policy authority. In card mode ONLY the Router success reply
      // (the sole caller carrying ux rendering intent) is re-rendered as a
      // static card; every other caller (receipts, scheduler/proactive,
      // system/operator) sends without ux and keeps its existing plan. The
      // card decision is deterministic and PRE-send: oversize or empty bodies
      // never attempt the card API and fall back to the existing markdown
      // plan (CARD_NOT_ATTEMPTED). The card plan carries no mentions key
      // (CARD_AUTO_MENTION = NONE) and the same anchoring as markdown.
      let plan
      if (cfg.replyRenderMode === 'card' && ux?.rendering === 'markdown') {
        const card = replyCardSendPlan(replyTarget, text)
        if (card.plan !== undefined) {
          plan = card.plan
          log('info', '[feishu] reply rendered as static card', { jsonBytes: card.jsonBytes })
        } else {
          log('warn', `[feishu] CARD_NOT_ATTEMPTED (${card.notAttempted}${card.jsonBytes !== undefined ? ` ${card.jsonBytes}B` : ''}) — deterministic markdown fallback`)
          plan = replyTargetToSdkSend(replyTarget, text, ux)
        }
      } else {
        plan = replyTargetToSdkSend(replyTarget, text, ux)
      }
      const result = await channel.send(plan.to, plan.input, plan.opts)
      if (!result?.messageId) {
        // EMPTY_MESSAGE_ID_REJECTION (spec §10): a send that "succeeded"
        // without a message id is a failure — reject, never fake success.
        throw new Error(`feishu-connector: send returned no message_id (${plan.method})`)
      }
      log('info', '[feishu] reply sent')
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
    /**
     * PROCESSING_REACTION graceful dispose: ONE best-effort delete pass over
     * the reactions still active in memory (no keepalive, no retry loop).
     * Called by the shell's disposer before channel.disconnect(). Abrupt
     * process death is a KNOWN_LIMITATION (ghost reaction possible).
     */
    async disposeProcessingReactions() {
      await processingReaction.dispose()
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
export function apply(ctx, config, { createChannel = createLarkChannel } = {}) {
  const cfg = { ...DEFAULTS, ...(config ?? {}) }

  // REPLY_RENDER_MODE strict validation (STATIC_FINAL_CARD_V1): anything but
  // 'markdown' | 'card' fails startup LOUD — a typo'd render mode must never
  // silently select a rendering strategy.
  if (cfg.replyRenderMode !== 'markdown' && cfg.replyRenderMode !== 'card') {
    throw Object.assign(
      new Error(`[feishu] replyRenderMode must be 'markdown' or 'card' (got ${JSON.stringify(cfg.replyRenderMode)})`),
      { code: 'FEISHU_REPLY_RENDER_MODE_INVALID' },
    )
  }
  // CARD_AUTO_MENTION = NONE: card-internal user mention is NOT implemented
  // in STATIC_FINAL_CARD_V1. Card mode together with an auto-mention policy
  // that could still ask for mentions must fail startup LOUD instead of
  // silently dropping the mention intent.
  if (cfg.replyRenderMode === 'card' && cfg.autoMentionTriggerSender !== false) {
    throw Object.assign(
      new Error('[feishu] replyRenderMode=card requires autoMentionTriggerSender=false (card auto-mention is not implemented; set FEISHU_AUTO_MENTION_TRIGGER_SENDER=false)'),
      { code: 'FEISHU_CARD_AUTO_MENTION_UNSUPPORTED' },
    )
  }

  const rawLog = cfg.log ?? ((level, ...args) => {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(...args)
  })
  let log = createRedactingLogger(rawLog)

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
  log = createRedactingLogger(rawLog, { secrets: [creds.appSecret] })

  const channel = createChannel({
    appId: creds.appId,
    appSecret: creds.appSecret,
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger: sdkLoggerAdapter(rawLog, { secrets: [creds.appSecret] }),
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
  // lifecycle itself is carried by ready(), not by this hook. The processing
  // reactions' best-effort cleanup is kicked off first (same microtask
  // race; both are logged, neither blocks the other).
  ctx.effect(() => () => {
    handle.disposeProcessingReactions().catch(() => { /* best effort; already logged */ })
    channel.disconnect().catch((error) => {
      log('warn', '[feishu] disconnect cleanup failed', error)
    })
  })

  // Publish the channel handle as a service so sibling plugins in the same
  // composition (e.g. the agent-router / control plane) can bind the ingress
  // callback and send replies through it. Cordis injectable as 'feishu'.
  ctx.provide('feishu', handle)

  return handle
}
