import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { test } from 'node:test'

const root = join(import.meta.dirname, '..', '..', '..')

test('RUNBOOK §3.1 backfill tool: offline --selftest passes on a stub store (Owner discipline)', () => {
  const out = execFileSync(process.execPath, [join(root, 'scripts', 'agentcore-cron-backfill.mjs'), '--selftest'], {
    encoding: 'utf8', cwd: root,
  })
  assert.match(out, /\[backfill selftest\] PASS/)
})

test('RUNBOOK §1 preflight tool: parser selftest passes (CI-safe, host-independent)', () => {
  const out = execFileSync(process.execPath, [join(root, 'scripts', 'scheduler-cp-preflight.mjs'), '--selftest'], {
    encoding: 'utf8', cwd: root,
  })
  assert.match(out, /\[preflight selftest\] PASS/)
})
