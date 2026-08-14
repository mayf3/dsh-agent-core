/**
 * @agent-core/feishu-connector/src/index.js — Cordis plugin shell.
 *
 * Wires the pure core / transport / api layers into a Cordis plugin with the
 * repo's standard contract: named exports `name` / `inject` / `Config` / `apply`.
 *
 * V0 scope is PURE CHANNEL: it establishes the Feishu WebSocket long connection,
 * normalizes inbound events through src/core.js, dedups them, and exposes an
 * outbound `reply()` method. It deliberately does NOT talk to DSH agents /
 * sessions / router — events are surfaced through a simple `onEvent` callback
 * (config) and the returned `handle` object, so whoever mounts this plugin can
 * decide where to deliver them.
 *
 * It stays decoupled from DSH core services: `inject` is empty and no
 * unregistered service is read.
 */

import { EventDispatcher, Client as LarkClient, WSClient, AppType, Domain, LoggerLevel } from '@larksuiteoapi/node-sdk'
import { readFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import { normalizeIngressEvent, LruDedup, dedupEvent, replyTargetFor, classifyIngress } from './core.js'
import { createFeishuTransport } from './transport.js'
import { reply as sendReply } from './api.js'

/** Stable plugin name referenced by bundle patches / manifests. */
export const name = 'feishu'

/** No hard DSH service dependency: V0 is a pure channel layer. */
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
  dedupSize: 10000,
  onEvent: null,
  onStatus: null,
  log: null,
}

/**
 * Cordis config schema (schemastery). Only data fields are validated;
 * unknown keys (e.g. onEvent/onStatus/log) pass through untouched, so the
 * manual default merge in apply() keeps working. A plain-object Config would
 * crash the Cordis loader (`config.validate` is undefined), so a real schema
 * is required for mounting inside a DSH profile.
 */
export const Config = z.object({
  appId: z.string(),
  appSecret: z.string(),
  // Path to a credentials JSON/TOML file {appId, appSecret} — when set, it
  // overrides appId/appSecret inline values. Secrets are never logged.
  credentialsPath: z.string(),
  enabled: z.boolean().default(true),
  // Max distinct dedup keys retained in memory.
  dedupSize: z.number().default(10000),
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
 * Mount the plugin.
 * @param {object} ctx - Cordis context (not used for DSH-only services in V0).
 * @param {object} config - validated plugin config.
 * @returns {object} handle exposing reply() + status() / setCallback().
 */
export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config ?? {}) }
  const log = cfg.log ?? ((level, ...args) => {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(...args)
  })

  if (!cfg.enabled) {
    log('warn', '[feishu] disabled by config; plugin mounted but not connected')
    return { started: false, reply: async () => { throw new Error('feishu disabled') }, status: () => 'disabled' }
  }

  const creds = loadCredentials(cfg)
  if (!creds.appId || !creds.appSecret) {
    throw new Error('[feishu] appId/appSecret (or credentialsPath) required when enabled')
  }

  const client = new LarkClient({
    appId: creds.appId,
    appSecret: creds.appSecret,
    appType: AppType.SelfBuild,
    domain: Domain.Feishu,
  })
  const ws = new WSClient({
    appId: creds.appId,
    appSecret: creds.appSecret,
    domain: Domain.Feishu,
    loggerLevel: LoggerLevel.info,
  })
  const dispatcher = new EventDispatcher({})
  const dedup = new LruDedup({ maxSize: cfg.dedupSize })

  // Resolve the bot's own open_id once (needed for correct @bot detection in
  // groups/threads). Falls back to null — mentions then classify as 'user'.
  let botOpenId = null
  fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  })
    .then((r) => r.json())
    .then(async (tokenRes) => {
      if (tokenRes.code !== 0) throw new Error(`tenant token: ${tokenRes.msg}`)
      const info = await fetch('https://open.feishu.cn/open-apis/bot/v3/info', {
        headers: { Authorization: `Bearer ${tokenRes.tenant_access_token}` },
      }).then((r) => r.json())
      botOpenId = info?.bot?.open_id ?? null
      log('debug', `[feishu] bot identity resolved: ${botOpenId?.slice(0, 8)}...`)
    })
    .catch((error) => {
      log('warn', `[feishu] could not resolve bot identity: ${error?.message ?? error}`)
    })

  const transport = createFeishuTransport({
    ws,
    eventDispatcher: dispatcher,
    config: { appId: creds.appId },
    onStatus: (s) => {
      if (typeof cfg.onStatus === 'function') cfg.onStatus(s)
    },
    onEvent: async (raw) => {
      let ingress
      try {
        ingress = normalizeIngressEvent(raw, { botOpenId })
      } catch (error) {
        log('warn', `[feishu] drop non-message event: ${error?.message ?? error}`)
        return
      }
      // dedup first
      const verdict = dedupEvent(ingress, dedup)
      if (verdict === 'duplicate') {
        dedup.dropped += 1
        log('debug', `[feishu] duplicate dropped (${ingress.dedupKey})`)
        return
      }
      // classify
      const cls = classifyIngress(ingress)
      if (!cls.forward) {
        log('debug', `[feishu] not addressed, skipped (${cls.reason})`)
        return
      }
      if (typeof cfg.onEvent === 'function') {
        try {
          await cfg.onEvent(ingress, { classify: cls })
        } catch (error) {
          log('error', `[feishu] onEvent callback error: ${error?.message ?? error}`)
        }
      }
    },
    log,
  })

  // Register the message receive handler on the dispatcher. NOTE: the SDK's
  // EventDispatcher.register() takes an OBJECT map { eventType: handler },
  // not (key, handler) — the two-arg form silently registers garbage keys
  // (Object.keys on a string) and the real event never matches.
  dispatcher.register({
    'im.message.receive_v1': async (data) => {
      await transport.ingest(data)
    },
  })

  // Start the long connection. ctx.effect guarantees the connection is torn
  // down if the plugin is stopped / updated. NOTE: ctx.effect() returns a
  // disposer function, not a Promise — errors are handled inside the effect.
  ctx.effect(async () => {
    try {
      await transport.start()
    } catch (error) {
      log('error', `[feishu] connection start failed: ${error?.message ?? error}`)
      throw error
    }
    return () => transport.stop()
  })

  const handle = {
    pluginName: name,
    started: true,
    /** Outbound: reply into a conversation/thread using a ReplyTarget. */
    async reply(replyTarget, text, opts = {}) {
      return sendReply(client, replyTarget, text, { log, ...opts })
    },
    /** Build a ReplyTarget from a normalized IngressEvent. */
    replyTargetFor(ev) {
      return replyTargetFor(ev)
    },
    /** Current connection status. */
    status() {
      return transport.state.connectionStatus
    },
    /** Reconnect counter. */
    reconnectCount() {
      return transport.state.reconnectCount
    },
    /** Swap the ingress callback (e.g. after the router mounts). */
    setCallback(fn) {
      cfg.onEvent = typeof fn === 'function' ? fn : cfg.onEvent
    },
    // keep a reference so callers can inspect the transport
    _transport: transport,
  }

  // Publish the channel handle as a service so sibling plugins in the same
  // composition (e.g. the agent-router / control plane) can bind the ingress
  // callback and send replies through it. Cordis injectable as 'feishu'.
  // NOTE: provide stores the VALUE as-is — a factory function would be
  // returned as-is by ctx.get(); pass the handle object directly.
  ctx.provide('feishu', handle)

  return handle
}
