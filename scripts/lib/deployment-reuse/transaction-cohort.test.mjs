import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { runtimePhase, entryDigests } from './cohort-runtime-fixture.mjs'
import { fixture, childApply, abort, checkRestored } from './transaction-test-support.mjs'
import { cohortFixture, objectHash, observation, hash } from './cohort-test-fixture.mjs'
import { prepare, verify, treeDigest, markPluginIntent } from './transaction-recovery.mjs'
const json = p => JSON.parse(fs.readFileSync(p))
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const carrier = join(repo, 'docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh')
function copyLoaderClosure(app) {
  const copied = new Set()
  function copy(src) {
    if (copied.has(src)) return
    assert.ok(src.startsWith(repo + '/packages/')); copied.add(src)
    const text = fs.readFileSync(src, 'utf8'), dest = join(app, relative(repo, src))
    fs.mkdirSync(dirname(dest), { recursive: true }); fs.writeFileSync(dest, text)
    for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) copy(resolve(dirname(src), match[1]))
  }
  copy(join(repo, 'packages/production-runtime/src/model-overrides.js'))
  copy(join(repo, 'packages/agent-definition/src/definition.js'))
  fs.writeFileSync(join(app, 'package.json'), '{"type":"module"}')
}
function boundFixture({ commit = false, brokenConsumer = false } = {}) {
  const f = fixture({ deferPrepare: true }), cohort = cohortFixture(f.c.root, 92, 98, f.c.trusted)
  f.before = fs.readFileSync(f.c.config); f.cohort = cohort
  // Candidate loader/provisioning are the same synthetic accepted closure;
  // tree generation markers still differ for the exchange/rollback tests.
  fs.cpSync(join(f.c.trusted, 'app'), join(f.c.input, 'app'), { recursive: true })
  fs.writeFileSync(join(f.c.input, 'app/generation.txt'), 'new-app')
  fs.cpSync(join(f.c.trusted, 'harness'), join(f.c.input, 'harness'), { recursive: true })
  fs.writeFileSync(join(f.c.input, 'harness/generation.txt'), 'new-harness')
  for (const part of ['app', 'harness', 'node-runtime']) f.packet.codeDigests[part] = treeDigest(join(f.c.input, part))
  if (commit) {
    const pluginRoot = join(f.gen, 'dsh-codex')
    fs.mkdirSync(pluginRoot, { recursive: true }); fs.cpSync(cohort.packageRoot, pluginRoot, { recursive: true })
    fs.cpSync(cohort.scopesRoot, join(pluginRoot, 'node_modules'), { recursive: true })
    for (const id of cohort.migrationIds) {
      const item = cohort.cohort.consumers[id]
      item.post = item.post.map(o => o.role === 'plugin' ? { ...observation('plugin', join(pluginRoot, 'lib/index.js')), path: o.path } : o)
    }
  }
  if (brokenConsumer) {
    const item = cohort.cohort.consumers[cohort.ids[0]]
    const plugin = join(f.gen, 'dsh-codex/lib/index.js')
    fs.writeFileSync(plugin, 'exports.missingRequiredExports = true')
    item.post = item.post.map(o => o.role === 'plugin' ? { ...observation('plugin', plugin), path: o.path } : o)
  }
  f.packet.cohort = cohort.cohort; f.packet.cohortSha256 = objectHash(cohort.cohort)
  prepare(f.c, f.packet)
  const tx = json(f.c.txFile); tx.state = 'MUTATING_FENCED'; fs.writeFileSync(f.c.txFile, JSON.stringify(tx))
  return f
}
test('bound cohort persists in the same TX and survives independent-process apply/recovery', () => {
  const f = boundFixture()
  try {
    assert.deepEqual(json(f.c.txFile).activation.cohort, f.packet.cohort)
    assert.equal(childApply(f, 'afterCodeSwap').signal, 'SIGKILL')
    const registry = fs.readFileSync(f.cohort.registry)
    const untouched = fs.readFileSync(join(f.c.root, 'homes', f.cohort.ids[97], 'profiles/agent-core-production/cordis.patch.yml'))
    // Drift blocks forward progress, but cannot prevent restoring recorded assets.
    fs.writeFileSync(f.cohort.runtimeContext, '{}')
    assert.throws(() => verify(f.c, 'post'))
    const result = abort(f)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    checkRestored(f)
    assert.deepEqual(fs.readFileSync(f.cohort.registry), registry)
    assert.deepEqual(fs.readFileSync(join(f.c.root, 'homes', f.cohort.ids[97], 'profiles/agent-core-production/cordis.patch.yml')), untouched)
    assert.equal(json(f.c.txFile).activation.cohortSha256, f.packet.cohortSha256)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})
test('altered stored cohort cannot authorize another apply', () => {
  const f = boundFixture()
  try {
    const tx = json(f.c.txFile); assert.ok(tx.activation.cohort, 'cohort must be retained'); tx.activation.cohort.registryIds[97] = 'agt_replacement-fixture'
    fs.writeFileSync(f.c.txFile, JSON.stringify(tx))
    assert.notEqual(childApply(f).status, 0)
    assert.deepEqual(fs.readFileSync(f.c.config), f.before)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})

function wireRecordedPlugins(f) {
  markPluginIntent(f.c)
  const rows = [{ phase: 'done', agent: 'CURRENT', entry: 'current-link', kind: 'current-link', symlinkTarget: null }]
  for (const id of f.cohort.migrationIds) {
    const path = join(f.c.root, 'homes', id, 'profiles/node_modules/dsh-codex'), savedAs = `${id}__dsh-codex`
    fs.renameSync(path, join(f.preimage, savedAs)); fs.symlinkSync(join(f.current, 'dsh-codex'), path)
    rows.push({ phase: 'done', agent: id, entry: 'dsh-codex', kind: 'dir', savedAs })
  }
  fs.symlinkSync(f.gen, f.current)
  const journal = rows.map(row => JSON.stringify(row)).join('\n') + '\n'
  fs.writeFileSync(join(f.preimage, 'manifest.json'), journal)
  const tx = json(f.c.txFile); tx.state = 'APPLIED_AWAITING_PONG'; tx.manifestSha256 = hash(journal)
  fs.writeFileSync(f.c.txFile, JSON.stringify(tx))
  runtimePhase(f, 'post')
}
test('bounded cross-process commit refuses missing actual canary evidence and separates F from R receipts', () => {
  const f = boundFixture({ commit: true })
  try {
    const applied = outerRun(f, 'apply'); assert.match(applied.stdout, /B7_AWAITING_OWNER/, applied.stderr)
    wireRecordedPlugins(f)
    const refused = outerRun(f, 'resume', 'COMMIT\n')
    assert.notEqual(refused.status, 0, refused.stdout + refused.stderr)
    assert.equal(json(f.c.txFile).state, 'APPLIED_AWAITING_PONG')
    assert.equal(json(f.c.fence).inFlight, true)
    const tx = json(f.c.txFile), coverage = tx.activation.compatibility
    assert.ok(coverage, refused.stdout + refused.stderr)
    assert.equal(coverage.compatibilityCount, 98)
    // Synthetic confirmation exercises binding only; no real PONG is claimed.
    const canaries = [f.cohort.ids[0], f.cohort.ids[97]].map(agentId => ({ agentId, routeSha256: coverage.routes[agentId],
      txId: f.c.txId, sourceSha: f.packet.sourceSha, runtimeInputsSha256: coverage.runtimeInputsSha256, runtimeIdentitySha256: objectHash(coverage.runtimeIdentity), outcome: 'PONG', evidenceSha256: hash('synthetic canary fixture') }))
    const path = join(f.c.recovery, 'commit-confirmation.json')
    fs.writeFileSync(path, JSON.stringify({ confirmed: 'yes', txId: f.c.txId, cohortSha256: f.packet.cohortSha256, canaries }), { mode: 0o600 })
    const result = outerRun(f, 'resume', 'COMMIT\n'); assert.equal(result.status, 0, result.stdout + result.stderr)
    const receipt = json(join(f.control, 'codex-plugin-commit-receipt.json'))
    assert.equal(receipt.wiredHomes, 92); assert.equal(receipt.compatibility.count, 98)
    assert.equal(receipt.compatibility.businessVerifiedForEveryIdentity, false)
    assert.equal(fs.existsSync(join(f.base, 'production-deploy.lock')), false)
    assert.equal(receipt.txId, f.c.txId); assert.equal(receipt.sourceSha, f.packet.sourceSha)
    assert.deepEqual(fs.readFileSync(f.cohort.registry), f.cohort.registryBefore)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})

const outer = join(repo, 'docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh')
function outerRun(f, mode, input = '') {
  if (mode === 'apply') runtimePhase(f, 'quiesced')
  return spawnSync('/bin/bash', [outer, `--b7-probe-${mode}`, '--transaction', f.c.txId], {
    encoding: 'utf8', input, timeout: 40000, env: { ...process.env,
      TXPROBE_ROOT: f.c.root, TXPROBE_CONTROL: f.control,
      TXPROBE_RECOVERY_ROOT: f.c.recovery, TXPROBE_TRUSTED_ROOT: f.c.trusted,
      TXPROBE_NODE: process.execPath, B7_PROBE_BASE: f.base } })
}
test('complete 92/98 binding crosses outer EOF and same-TX abort without replay', () => {
  const f = boundFixture()
  try {
    assert.ok(fs.statSync(f.c.txFile).size > 65536, 'exercise full-size private TX')
    const lost = outerRun(f, 'apply')
    assert.notEqual(lost.status, 0)
    assert.match(lost.stdout, /B7_AWAITING_OWNER/, lost.stderr)
    assert.match(lost.stderr, /B7_DISCONNECTED_OR_UNCONFIRMED/)
    const intent = json(f.c.txFile).activation.configIntent
    assert.equal(fs.existsSync(join(f.base, 'production-deploy.lock')), true)
    const recovered = outerRun(f, 'resume', 'ABORT\n')
    assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr)
    assert.doesNotMatch(recovered.stdout, /PROBE_APPLY/)
    assert.deepEqual(json(f.c.txFile).activation.configIntent, intent)
    checkRestored(f)
    assert.equal(json(f.c.txFile).state, 'ABORTED')
    assert.equal(fs.existsSync(join(f.base, 'production-deploy.lock')), false)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})

test('outer commit refuses a candidate plugin payload differing from accepted archives', () => {
  const f = boundFixture({ commit: true, brokenConsumer: true })
  try {
    const applied = outerRun(f, 'apply')
    assert.match(applied.stdout, /B7_AWAITING_OWNER/, applied.stderr)
    wireRecordedPlugins(f)
    const refused = outerRun(f, 'resume', 'COMMIT\n')
    assert.notEqual(refused.status, 0)
    assert.match(refused.stdout + refused.stderr, /full consumer compatibility|CONSUMER_ACCESS_FAIL/)
    assert.equal(json(f.c.txFile).state, 'APPLIED_AWAITING_PONG')
    assert.equal(json(f.c.fence).inFlight, true)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})
