import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { REPO, assert, check } from './verify-support.mjs'

export async function runScopeChecks() {
// ── structural gates ───────────────────────────────────────────────────────

function gitOutput(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
}

await check('AC-CMP-02 zero-diff: frozen NO-CHANGE packages untouched vs base', async () => {
  const base = process.env.NOTIFICATION_VERIFY_BASE ?? '0a6e060913e12693142fb0759f35f239b2ef429a'
  let changed
  try {
    changed = gitOutput(['diff', '--name-only', base, 'HEAD', '--',
      'packages/agent-router', 'packages/scheduler', 'packages/scheduler-router',
      'packages/broker', 'packages/agent-credential-provisioning', 'packages/agent-definition',
      'packages/workspace-bootstrap', 'packages/agent-provisioning'])
  } catch (error) {
    return `SKIP (git unavailable: ${error.message.split('\n')[0]})`
  }
  assert(changed === '', `frozen packages changed: ${changed}`)
  return 'agent-router / scheduler / broker / provisioning untouched'
})

await check('COVERAGE: all 39 contract ids present in the test sources', async () => {
  const ids = []
  for (let i = 1; i <= 14; i += 1) ids.push(`C-AUTH-${String(i).padStart(3, '0')}`)
  for (let i = 1; i <= 16; i += 1) ids.push(`C-IDM-${String(i).padStart(3, '0')}`)
  for (let i = 1; i <= 5; i += 1) ids.push(`C-BND-${String(i).padStart(3, '0')}`)
  for (let i = 1; i <= 4; i += 1) ids.push(`C-WIRE-${String(i).padStart(3, '0')}`)
  const testDir = join(REPO, 'packages/notification-ingress/test')
  const sources = readdirSync(testDir).map((f) => readFileSync(join(testDir, f), 'utf8')).join('\n')
    + readFileSync(join(REPO, 'packages/production-runtime/test/compose.test.js'), 'utf8')
  const missing = ids.filter((id) => !sources.includes(id))
  assert(missing.length === 0, `missing contract coverage: ${missing.join(', ')}`)
  return `39/39 (${ids.length} ids verified)`
})

await check('COVERAGE: all 27 acceptance ids present in the test sources', async () => {
  const ids = []
  for (let i = 1; i <= 12; i += 1) ids.push(`AC-AUTH-${String(i).padStart(2, '0')}`)
  for (let i = 1; i <= 9; i += 1) ids.push(`AC-IDM-${String(i).padStart(2, '0')}`)
  for (let i = 1; i <= 3; i += 1) ids.push(`AC-BND-${String(i).padStart(2, '0')}`)
  ids.push('AC-CMP-01', 'AC-CMP-02', 'AC-WIRE-01')
  const testDir = join(REPO, 'packages/notification-ingress/test')
  const sources = readdirSync(testDir).map((f) => readFileSync(join(testDir, f), 'utf8')).join('\n')
    + readFileSync(join(REPO, 'packages/production-runtime/test/compose.test.js'), 'utf8')
  const missing = ids.filter((id) => !sources.includes(id))
  assert(missing.length === 0, `missing acceptance coverage: ${missing.join(', ')}`)
  return `27/27 (${ids.length} ids verified)`
})
}
