import test from 'node:test'
import assert from 'node:assert/strict'
import processAPI from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Product composition performs no command execution. Keep every process API
// denied before importing it, through all tests and teardown.
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  processAPI[name] = () => { throw Error('PROCESS_DISPATCH_DENIED') }
}
syncBuiltinESMExports()
const { composeFixedAdminSource, FIXED_ADMIN_SOURCE_PATHS, FIXED_ADMIN_SOURCE_CANDIDATE } =
  await import('../../src/native-arm64/hr-admin-source-overlay.mjs')

const restored = '/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/HR-S256-POSTRESTORE-SELECTIVE-APP-20260928-v1/tree'
const repo = new URL('../../../../', import.meta.url)
const newLeaves = new Set([
  'packages/demo-server/src/fixed-admin-tool-free.js',
  'packages/production-runtime/src/native-arm64/hr-admin-canary-contract.mjs',
])
function inputs() {
  const base = {}, candidate = {}
  for (const path of FIXED_ADMIN_SOURCE_PATHS) {
    if (!newLeaves.has(path)) base[path] = readFileSync(join(restored, path))
    candidate[path] = readFileSync(new URL(path, repo))
  }
  return { base, candidate }
}

test('exact restored source receives only closed admin edits while ordinary-Agent bytes survive', () => {
  assert.equal(FIXED_ADMIN_SOURCE_CANDIDATE, 'c9a82b44178a1f441420a70896e310952ae29bd2')
  const { base, candidate } = inputs()
  const result = composeFixedAdminSource(base, candidate)
  assert.deepEqual(Object.keys(result), FIXED_ADMIN_SOURCE_PATHS)
  for (const path of FIXED_ADMIN_SOURCE_PATHS) {
    assert.ok(result[path].length > 0, path)
    if (!['packages/agent-router/src/process-registry.js',
      'packages/agent-router/src/process/agent-process.js',
      'packages/demo-server/src/index.js'].includes(path)) {
      assert.deepEqual(result[path], candidate[path], path)
    }
  }
  assert.match(result['packages/agent-router/src/process-registry.js'].toString(),
    /return installStartupSlot\(lifecycleSlots, agentGenerations, agentId\)/)
  assert.match(result['packages/agent-router/src/process/agent-process.js'].toString(), /'opencode-go'/)
  assert.match(result['packages/demo-server/src/index.js'].toString(), /'deepseek-v4-flash'/)
  assert.match(result['packages/agent-router/src/process-registry.js'].toString(), /ensureFixedAdminProcess/)
})

test('unknown, missing, drifted or caller-added source rejects without a partial output', () => {
  for (const changed of [
    ({ base }) => { base['packages/agent-router/src/index.js'] = Buffer.concat([base['packages/agent-router/src/index.js'], Buffer.from('//same anchor drift')]) },
    ({ base }) => { base['packages/demo-server/src/index.js'] = Buffer.concat([base['packages/demo-server/src/index.js'], Buffer.from('//drift')]) },
    ({ base }) => { delete base['packages/agent-router/src/process-registry.js'] },
    ({ base }) => { base['/caller/extra'] = Buffer.from('x') },
    ({ candidate }) => { candidate['packages/agent-router/src/index.js'] = Buffer.from('caller postimage') },
    ({ candidate }) => { delete candidate['packages/demo-server/src/fixed-admin-tool-free.js'] },
  ]) {
    const pair = inputs()
    changed(pair)
    assert.throws(() => composeFixedAdminSource(pair.base, pair.candidate), /HR_ADMIN_SOURCE_BASE_UNKNOWN/)
  }
})
