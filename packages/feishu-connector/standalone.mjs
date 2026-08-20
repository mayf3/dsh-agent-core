#!/usr/bin/env node
/**
 * @agent-core/feishu-connector/standalone.mjs
 *
 * Standalone driver for the Feishu connector on the official
 * @larksuite/channel foundation — loads the SAME frozen Foundation
 * configuration the production shell uses (no downgraded manual-verification
 * path) against a REAL account.
 *
 * Credentials are read from the local OpenClaw config's channels.feishu
 * (path defaults to ~/.openduck/openclaw.json, overridable via OPENCLAW_CONFIG)
 * (appId / appSecret / connectionMode). The secret is only read for the SDK
 * and never printed.
 *
 * Usage:
 *   node standalone.mjs [--send <text>] [--user <open_id>]
 *
 *   --send <text>  also issue one outbound message to FEISHU_USER_ID (default
 *                  or --user), then exit.
 *   Default without --send: establish the single SDK connection (bot identity
 *   + first handshake awaited), print status lines, and print any inbound
 *   message it receives. Kill with Ctrl-C to stop.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createLarkChannel } from '@larksuite/channel'
import { FOUNDATION_LARK_CHANNEL_OPTIONS, replyTargetToSdkSend } from './src/core.js'
import { createBridgeHandler } from './src/bridge.js'

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

const args = process.argv.slice(2)
function argValue(flag, fallback = '') {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const sendText = args.includes('--send') ? argValue('--send') : null
const sendUser = argValue('--user', process.env.FEISHU_USER_ID || 'ou_d8bb7e8e4d9e2a7e8c78b9d6c68a')

const creds = loadFeishuCredentials()

const log = (level, ...a) => {
  const fn = level === 'error' ? console.error : console.log
  fn(...a)
}

log('info', `[standalone] credential file: ok (appId=${creds.appId}) mode=${creds.connectionMode}`)
log('info', '[standalone] foundation: @larksuite/channel (batch delayMs=0, chatQueue disabled, stale-drop disabled, requireMention=false, residual mention eligibility in bridge)')
log('info', '[standalone] WARNING: if another process (OpenClaw / production resident) holds this account, this connection may kick it off.')

// ONE SDK connection under the SAME frozen Foundation options the production
// shell mounts — the manual-verification path is not a second transport.
const channel = createLarkChannel({
  appId: creds.appId,
  appSecret: creds.appSecret,
  ...FOUNDATION_LARK_CHANNEL_OPTIONS,
  logger: {
    debug: (...a) => { /* keep the manual console readable */ },
    info: (...a) => log('info', '[lark-channel]', ...a),
    warn: (...a) => log('warn', '[lark-channel]', ...a),
    error: (...a) => log('error', '[lark-channel]', ...a),
  },
})

if (sendText) {
  // ---- Outbound-only mode: send a test text message to a known user. ----
  const target = {
    kind: 'create',
    conversationId: `group:${sendUser}`,
    chatId: sendUser,
    channel: 'group',
    receiveId: sendUser,
    receiveIdType: 'open_id',
    replyInThread: false,
  }
  const plan = replyTargetToSdkSend(target, sendText)
  log('info', `[standalone] sending to open_id=${sendUser.slice(0, 6)}... text="${sendText}"`)
  try {
    const result = await channel.send(plan.to, plan.input, plan.opts)
    log('info', `[standalone] outbound result: ${JSON.stringify(result)}`)
    process.exit(0)
  } catch (error) {
    log('error', `[standalone] outbound failed: ${error?.code ?? ''} ${error?.message ?? error}`)
    process.exit(2)
  }
}

// ---- Long connection mode ----
const standaloneConfig = {
  // Manual observation has no production Binding store, but still traverses
  // the same residual mention eligibility and bridge Promise path.
  ingressGate: async () => ({ allowed: true, reason: 'standalone_observation' }),
  onEvent: async (ev) => {
    log('info', `[standalone] ingress channel=${ev.channel} chat=${ev.chatId} conversation=${ev.conversationId} sender=${ev.sender.openId?.slice(0, 6)} text="${(ev.text || '').slice(0, 60)}"`)
  },
}
channel.on({
  message: createBridgeHandler({
    resolveBotIdentity: () => channel.getBotIdentity(),
    config: standaloneConfig,
    log,
  }),
  error: (err) => log('error', `[standalone] channel error: ${err?.code ?? ''} ${err?.message ?? err}`),
  reconnecting: () => log('warn', '[standalone] reconnecting...'),
  reconnected: () => log('info', '[standalone] reconnected'),
})

try {
  // Readiness first: bot identity + first WS handshake, fail-loud.
  await channel.connect()
  const identity = channel.getBotIdentity()
  log('info', `[standalone] connected; bot identity ${identity.openId.slice(0, 8)}... (${identity.name})`)
} catch (error) {
  log('error', `[standalone] connect failed (identity/handshake): ${error?.code ?? ''} ${error?.message ?? error}`)
  process.exit(2)
}

process.on('SIGINT', () => {
  log('info', '[standalone] shutting down')
  channel.disconnect().catch(() => { /* best effort */ }).finally(() => process.exit(0))
})

log('info', '[standalone] waiting for inbound messages... (Ctrl-C to stop)')
