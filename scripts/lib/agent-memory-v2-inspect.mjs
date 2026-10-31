#!/usr/bin/env node
/** Explicit operator config only; no plugin mount, environment resolver, or writes. */
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { inspectMemory, resolveMemoryBinding } from '../../packages/agent-memory/src/inspect.js'

const help = 'Usage: node scripts/lib/agent-memory-v2-inspect.mjs --config <absolute-reviewed-config.json> [--detail summary|coverage]\nConfig: {"agentId":"...","primaryWorkspace":"/absolute/workspace","session":{"header":{"cwd":"/absolute/workspace"}}}\nRead-only: never mounts the plugin or creates files.\n'
async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(help); return }
  let configPath; let detail = 'summary'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && configPath === undefined) configPath = args[++i]
    else if (args[i] === '--detail') detail = args[++i]
    else throw new Error('INVALID_ARGUMENTS')
  }
  if (!isAbsolute(configPath ?? '') || !['summary', 'coverage'].includes(detail)) throw new Error('INVALID_ARGUMENTS')
  const handle = await open(configPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  let config
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.size > 64 * 1024) throw new Error('INVALID_CONFIG')
    const buffer = Buffer.alloc(before.size + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const after = await handle.stat()
    if (bytesRead !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || before.dev !== after.dev) throw new Error('STALE_CONFIG')
    config = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'))
  } finally { await handle.close() }
  if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some((key) => !['agentId', 'primaryWorkspace', 'session'].includes(key))) throw new Error('INVALID_CONFIG')
  const binding = await resolveMemoryBinding(config)
  const report = await inspectMemory({ binding, detail })
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}
main().catch(() => { process.stderr.write('agent-memory inspect: REFUSED (INVALID_CONFIG_OR_ARGUMENTS)\n'); process.exitCode = 1 })
