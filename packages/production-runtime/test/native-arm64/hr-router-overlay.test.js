import test from 'node:test'
import assert from 'node:assert/strict'
import * as staging from '../../src/native-arm64/stage.js'

test('HR consumer join preserves unrelated fresh Router bytes', () => {
  const input = "// POST_COHERENT_SENTINEL\nimport { provisionAgentHome } from '../../agent-provisioning/src/index.js'\n" +
    "  if (typeof cfg.restartQuiescenceEvidenceDir === 'string' && cfg.restartQuiescenceEvidenceDir !== '') {\n// OTHER_NEW_CODE\n"
  const patched = staging.patchHrRouterJoin('packages/agent-router/src/index.js', Buffer.from(input)).toString()
  assert.ok(patched.startsWith('// POST_COHERENT_SENTINEL\n'))
  assert.ok(patched.endsWith('// OTHER_NEW_CODE\n'))
  assert.match(patched, /const fixedStartup = getFixedStartupContext\(\)/)
  assert.match(patched, /consumeStartupQuiescence\(fixedStartup\)/)
})

test('HR join refuses unknown or repeated base anchors', () => {
  assert.throws(() => staging.patchHrRouterJoin('packages/agent-router/src/index.js', Buffer.from('// changed')), /HR_ROUTER_BASE_UNKNOWN/)
  const anchor = 'files = readdirSync(evidenceDir).filter'
  assert.throws(() => staging.patchHrRouterJoin('packages/agent-router/src/reconciliation/startup-recovery.js', Buffer.from(anchor + anchor)), /HR_ROUTER_BASE_UNKNOWN/)
})
