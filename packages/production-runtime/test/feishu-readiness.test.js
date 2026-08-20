import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('Feishu gate wiring precedes awaited readiness and live declaration', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'compose.js'), 'utf8')
  const wire = source.indexOf('wireV2IngressGate(feishu, router')
  const ready = source.indexOf('await feishu.ready()')
  const live = source.indexOf("log.log('feishu channel live")
  assert.ok(wire >= 0)
  assert.ok(ready > wire, 'PREBOUND_ONLY gate is installed before readiness wait')
  assert.ok(live > ready, 'channel is declared live only after readiness resolves')
})
