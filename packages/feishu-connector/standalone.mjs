#!/usr/bin/env node
/**
 * @agent-core/feishu-connector/standalone.mjs
 *
 * Standalone driver for the Feishu Connector V0 — load the plugin layers
 * directly (no DSH, no Cordis) against a REAL account for manual verification.
 *
 * Credentials are read from the local OpenClaw config's channels.feishu
 * (path defaults to ~/.openduck/openclaw.json, overridable via OPENCLAW_CONFIG)
 * (appId / appSecret / connectionMode). The secret is only read for the SDK
 * and never printed.
 *
 * Usage:
 *   node standalone.mjs [--send <text>] [--user <open_id>]
 *
 *   --send <text>  also issue one outbound reply to FEISHU_USER_ID (default
 *                  or --user), then exit.
 *   Default without --send: establish the long connection, print status lines,
 *   and print any inbound event it receives. Kill with Ctrl-C to stop.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventDispatcher, Client as LarkClient, WSClient, AppType, Domain, LoggerLevel } from '@larksuiteoapi/node-sdk'

const selfDir = fileURLToPath(new URL('.', import.meta.url))

function loadFeishuCredentials() {
  const path = process.env.OPENCLAW_CONFIG || join(homedir(), '.openduck', 'openclaw.json')
  const raw = readFileSync(path, 'utf8')
  const config = JSON.parse(raw)
  const feishu = config?.channels?.feishu ?? {}
  return {
    appId: feishu.appId,
    appSecret: feishu.appSecret,
    connectionMode: feishu.connectionMode ?? 'websocket',
  }
}

function loadCore() {
  return import(join(selfDir, 'src', 'core.js'))
}

const args = process.argv.slice(2)
function argValue(flag, fallback = '') {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const sendText = args.includes('--send') ? argValue('--send') : null
const sendUser = argValue('--user', process.env.FEISHU_USER_ID || 'ou_d8bb7e8e4d9e2a7e8c78b9d6c68a')

const creds = loadFeishuCredentials()
// load the "onEvent" normalization from core, keeping the plugin shell out of it.
const { normalizeIngressEvent, LruDedup, dedupEvent, classifyIngress, replyTargetFor } = await loadCore()

const client = new LarkClient({
  appId: creds.appId,
  appSecret: creds.appSecret,
  appType: AppType.SelfBuild,
  domain: Domain.Feishu,
})

const log = (level, ...a) => {
  const fn = level === 'error' ? console.error : console.log
  fn(...a)
}

log('info', `[standalone] credential file: ok (appId=${creds.appId}) mode=${creds.connectionMode}`)
log('info', '[standalone] WARNING: if another process (OpenClaw) holds this account, the SDK connection may kick it off.')

const dedup = new LruDedup({ maxSize: 10000 })

if (sendText) {
  // ---- Outbound-only mode: send a test text message to a known user. ----
  const { reply } = await import(join(selfDir, 'src', 'api.js'))
  const target = { kind: 'create', receiveId: sendUser, receiveIdType: 'open_id', chatId: sendUser }
  log('info', `[standalone] sending to open_id=${sendUser.slice(0, 6)}... text="${sendText}"`)
  const result = await reply(client, target, sendText, { log })
  log('info', `[standalone] outbound result: ${JSON.stringify(result)}`)
  process.exit(0)
}

// ---- Long connection mode ----
const ws = new WSClient({
  appId: creds.appId,
  appSecret: creds.appSecret,
  domain: Domain.Feishu,
  loggerLevel: LoggerLevel.info,
})
const dispatcher = new EventDispatcher({})

// Resolve the bot's own open_id once (needed for correct @bot detection in
// groups/threads). Falls back to null — mentions then classify as 'user'.
async function resolveBotOpenId() {
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  }).then((r) => r.json())
  if (tokenRes.code !== 0) throw new Error(`tenant token: ${tokenRes.msg}`)
  const info = await fetch('https://open.feishu.cn/open-apis/bot/v3/info', {
    headers: { Authorization: `Bearer ${tokenRes.tenant_access_token}` },
  }).then((r) => r.json())
  return info?.bot?.open_id ?? null
}
let botOpenId = null
try {
  botOpenId = await resolveBotOpenId()
  log('info', `[standalone] bot identity: ${botOpenId?.slice(0, 8)}...`)
} catch (e) {
  log('warn', `[standalone] could not resolve bot identity: ${e?.message ?? e}`)
}

// NOTE: the SDK's EventDispatcher.register() takes an OBJECT map
// { eventType: handler }, not (key, handler) — the two-arg form silently
// registers garbage keys and the real event never matches.
dispatcher.register({
  'im.message.receive_v1': async (data) => {
    let ev
    try {
      ev = normalizeIngressEvent(data, { botOpenId })
    } catch (e) {
      log('warn', `[standalone] dropped non-message event: ${e.message}`)
      return
    }
    const verdict = dedupEvent(ev, dedup)
    if (verdict === 'duplicate') {
      log('debug', `[standalone] duplicate dropped: ${ev.dedupKey}`)
      return
    }
    const cls = classifyIngress(ev)
    log('info', `[standalone] ingress channel=${ev.channel} chat=${ev.chatId} sender=${ev.sender.openId?.slice(0, 6)} text="${(ev.text || '').slice(0, 60)}" forward=${cls.forward}`)
  },
})

let reconnecting = false
ws.start({ eventDispatcher: dispatcher }).then(() => {
  log('info', '[standalone] connected (long connection established, heartbeat handled by SDK)')
}).catch((e) => {
  log('error', `[standalone] connection failed/ended: ${e?.message ?? e}`)
  // SDK long connection holds an open socket; "ended" here usually means a
  // competing process took the account or network drop. If immediately, stop.
  if (!reconnecting) {
    log('error', '[standalone] did you start a second Feishu long connection on the same app? Stopping.')
    process.exit(2)
  }
})

process.on('SIGINT', () => {
  log('info', '[standalone] shutting down')
  try { ws.close?.() } catch { /* ignore */ }
  process.exit(0)
})

log('info', '[standalone] waiting for inbound events... (Ctrl-C to stop)')
