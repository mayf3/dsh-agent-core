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
 *                  + first handshake awaited), print status lines, and print
 *                  any inbound message it receives. Kill with Ctrl-C to stop.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createLarkChannel } from '@larksuite/channel'
import { FOUNDATION_LARK_CHANNEL_OPTIONS, replyTargetToSdkSend } from './src/core.js'
import { createBridgeHandler } from './src/bridge.js'
import { createRedactingLogger, sdkLoggerAdapter } from './src/log-redaction.js'

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

function defaultConsoleLog(level, ...a) {
  const fn = level === 'error' ? console.error : console.log
  fn(...a)
}

/**
 * The standalone driver shares the production mount's single redaction seam:
 * every standalone log line and every SDK logger argument (including debug,
 * which is forwarded, not dropped) is sanitized by src/log-redaction.js with
 * the loaded credential's exact literal. There is no second, weaker path.
 */
export function createStandaloneLogging({ creds, rawLog = defaultConsoleLog } = {}) {
  const secrets = [creds?.appSecret]
  return {
    log: createRedactingLogger(rawLog, { secrets }),
    sdkLogger: sdkLoggerAdapter(rawLog, { secrets }),
  }
}

export function logStandaloneOutboundResult(log, result) {
  log('info', '[standalone] outbound result', result)
}

async function main() {
  const args = process.argv.slice(2)
  function argValue(flag, fallback = '') {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback
  }
  const sendText = args.includes('--send') ? argValue('--send') : null
  const sendUser = argValue('--user', process.env.FEISHU_USER_ID || 'ou_d8bb7e8e4d9e2a7e8c78b9d6c68a')

  const creds = loadFeishuCredentials()
  const { log, sdkLogger } = createStandaloneLogging({ creds })

  log('info', '[standalone] credential file loaded', {
    appId: creds.appId,
    connectionMode: creds.connectionMode,
  })
  log('info', '[standalone] foundation: @larksuite/channel (batch delayMs=0, chatQueue disabled, stale-drop disabled, requireMention=false, residual mention eligibility in bridge)')
  log('info', '[standalone] WARNING: if another process (OpenClaw / production resident) holds this account, this connection may kick it off.')

  // ONE SDK connection under the SAME frozen Foundation options the production
  // shell mounts — the manual-verification path is not a second transport.
  const channel = createLarkChannel({
    appId: creds.appId,
    appSecret: creds.appSecret,
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    logger: sdkLogger,
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
    log('info', '[standalone] sending outbound test message')
    try {
      const result = await channel.send(plan.to, plan.input, plan.opts)
      logStandaloneOutboundResult(log, result)
      process.exit(0)
    } catch (error) {
      log('error', '[standalone] outbound failed', error)
      process.exit(2)
    }
  }

  // ---- Long connection mode ----
  const standaloneConfig = {
    // Manual observation has no production Binding store, but still traverses
    // the same residual mention eligibility and bridge Promise path.
    ingressGate: async () => ({ allowed: true, reason: 'standalone_observation' }),
    onEvent: async (ev) => {
      log('info', '[standalone] ingress observed', {
        channel: ev.channel,
        chatId: ev.chatId,
        conversationId: ev.conversationId,
        messageId: ev.messageId,
      })
    },
  }
  channel.on({
    message: createBridgeHandler({
      resolveBotIdentity: () => channel.getBotIdentity(),
      config: standaloneConfig,
      log,
    }),
    error: (err) => log('error', '[standalone] channel error', err),
    reconnecting: () => log('warn', '[standalone] reconnecting...'),
    reconnected: () => log('info', '[standalone] reconnected'),
  })

  try {
    // Readiness first: bot identity + first WS handshake, fail-loud.
    await channel.connect()
    channel.getBotIdentity()
    log('info', '[standalone] connected; bot identity resolved')
  } catch (error) {
    log('error', '[standalone] connect failed (identity/handshake)', error)
    process.exit(2)
  }

  process.on('SIGINT', () => {
    log('info', '[standalone] shutting down')
    channel.disconnect().catch(() => { /* best effort */ }).finally(() => process.exit(0))
  })

  log('info', '[standalone] waiting for inbound messages... (Ctrl-C to stop)')
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) await main()
