#!/usr/bin/env node
/**
 * Verify the V0 vertical slice: run the profile once and assert the durable
 * evidence — the broker tool executed multiply(6, 7) and its result is 42 —
 * plus a clean completed turn.
 *
 * Exit 0 on success, 1 on a failed assertion, 2 on infrastructure failure.
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)))   // example scripts dir

const result = spawnSync(
  process.execPath,
  [resolve(SCRIPTS, 'run.mjs')],
  { stdio: 'pipe', cwd: resolve(SCRIPTS, '..'), encoding: 'utf8' },
)
const output = result.stdout ?? ''
const stderr = result.stderr ?? ''

const checks = [
  ['router driver ran', output.includes('[router] agent reply:')],
  ['turn completed (exit 0)', result.status === 0],
  ['broker tool called external_calculator', output.includes('[router] evidence: external_calculator ->')],
  ['acceptance case multiply(6, 7) = 42', /multiply\(6, 7\) = 42/.test(output)],
]

let failed = false
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failed = true
}
if (failed) {
  console.error('--- run output (stdout) ---\n' + output)
  console.error('--- run output (stderr) ---\n' + stderr)
  process.exit(1)
}
console.log('verify: V0 vertical slice passed')
