import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

function trackedFiles() {
  return execFileSync('git', ['ls-files', 'packages/*/src/**', 'scripts/**', 'deployment-artifacts/**'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean)
}

test('T34 executable path census has no retired watchdog, alert-state, or ambient-chat route', () => {
  const globalForbidden = [
    /packages\/scheduler\/src\/watchdog\.js/,
    /SCHEDULER_WATCHDOG_ALERT_TO/,
    /reminderIntervalMs/,
  ]
  const activeControlPlane = /^(scripts\/scheduler-(?:watchdog|cp-(?:admission|preflight|postrepair))\.mjs|deployment-artifacts\/scheduler-control-plane-reliability-v1\/)/
  const activeForbidden = [/alert-state\.json/, /__OWNER_CHAT_ID__/]
  const hits = []
  for (const path of trackedFiles()) {
    const text = readFileSync(resolve(repo, path), 'utf8')
    for (const pattern of globalForbidden) if (pattern.test(text)) hits.push(`${path}: ${pattern}`)
    if (activeControlPlane.test(path)) for (const pattern of activeForbidden) if (pattern.test(text)) hits.push(`${path}: ${pattern}`)
  }
  assert.deepEqual(hits, [])
})
