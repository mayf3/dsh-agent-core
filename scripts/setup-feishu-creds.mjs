#!/usr/bin/env node
/**
 * Derive a 0600 Feishu credentials file for the control plane from the local
 * OpenClaw config (channels.feishu: appId/appSecret/connectionMode). The
 * secret never appears in arguments, logs, or any committed file.
 *
 *   node scripts/setup-feishu-creds.mjs [targetPath]
 *   default target: $DSH_HOME/feishu-creds.json  (DSH_HOME defaults ~/.dsh)
 */

import { chmodSync, existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const target = process.argv[2]
  ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'feishu-creds.json')

const source = process.env.OPENCLAW_CONFIG ?? join(homedir(), '.openduck', 'openclaw.json')
if (!existsSync(source)) {
  console.error(`setup-feishu-creds: source config not found at ${source}`)
  process.exit(1)
}

const config = JSON.parse(await import('node:fs/promises').then(m => m.readFile(source, 'utf8')))
const feishu = config?.channels?.feishu
if (!feishu?.appId || !feishu?.appSecret) {
  console.error('setup-feishu-creds: channels.feishu.appId/appSecret missing in source config')
  process.exit(1)
}

writeFileSync(target, JSON.stringify({ appId: feishu.appId, appSecret: feishu.appSecret }, null, 2), { mode: 0o600 })
chmodSync(target, 0o600)
console.log(`feishu credentials written: ${target} (0600, appId=${feishu.appId})`)
