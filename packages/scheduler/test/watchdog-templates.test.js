import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const TEMPLATES = join(import.meta.dirname, '..', '..', '..', 'deployment-artifacts', 'scheduler-control-plane-reliability-v1')

function plistValue(plist, key) {
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))
  return match === null ? undefined : match[1]
}

test('audit Blocker-2 regression: W1 and W2 templates share ONE state dir (mutual heartbeat must see its peer)', () => {
  const w1 = readFileSync(join(TEMPLATES, 'ai.agent-core.scheduler-watchdog-w1.plist.tmpl'), 'utf8')
  const w2 = readFileSync(join(TEMPLATES, 'ai.agent-core.scheduler-watchdog-w2.plist.tmpl'), 'utf8')
  const w1Dir = plistValue(w1, 'SCHEDULER_WATCHDOG_STATE_DIR')
  const w2Dir = plistValue(w2, 'SCHEDULER_WATCHDOG_STATE_DIR')
  assert.ok(w1Dir !== undefined && w2Dir !== undefined, 'both templates configure the state dir explicitly')
  assert.equal(w1Dir, w2Dir, `split state dirs make the mutual check fire permanently (${w1Dir} vs ${w2Dir})`)
})

test('audit: W1/W2 are DISTINCT failure domains (uid + label) and neither is scheduled by the scheduler', () => {
  const w1 = readFileSync(join(TEMPLATES, 'ai.agent-core.scheduler-watchdog-w1.plist.tmpl'), 'utf8')
  const w2 = readFileSync(join(TEMPLATES, 'ai.agent-core.scheduler-watchdog-w2.plist.tmpl'), 'utf8')
  assert.equal(plistValue(w1, 'UserName'), 'authsvc')
  assert.equal(plistValue(w2, 'UserName'), 'root')
  assert.notEqual(plistValue(w1, 'Label'), plistValue(w2, 'Label'))
  for (const plist of [w1, w2]) {
    assert.match(plist, /<key>StartInterval<\/key>\s*<integer>\d+<\/integer>/, 'launchd-timer driven, never scheduled by the Scheduler itself')
  }
})
