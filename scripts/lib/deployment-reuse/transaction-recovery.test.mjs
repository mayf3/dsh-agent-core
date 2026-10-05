import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { context, prepare, treeDigest, verify, markPluginIntent, proveNoParticipantAbort } from './transaction-recovery.mjs'

import { fixture, childApply, abort, checkRestored } from './transaction-test-support.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const carrier = join(repo, 'docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh')
const tool = fileURLToPath(new URL('./transaction-recovery.mjs', import.meta.url))
const loader = join(repo, 'packages/production-runtime/src/model-overrides.js')
const writeJSON = (p, x) => fs.writeFileSync(p, JSON.stringify(x), { mode: 0o600 })
const readJSON = (p) => JSON.parse(fs.readFileSync(p))
function pinArtifactRecord(f) {
  const artifacts = { pluginTgz: join(f.base, 'accepted-artifacts/plugin.tgz'), pluginTgzSha256: 'a'.repeat(64),
    scopesTgz: join(f.base, 'accepted-artifacts/scopes.tgz'), scopesTgzSha256: 'b'.repeat(64) }
  writeJSON(f.c.txFile, { ...readJSON(f.c.txFile), ...artifacts })
  return artifacts
}
function assertArtifactRecord(f, expected) {
  const tx = readJSON(f.c.txFile)
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map(k => [k, tx[k]])), expected)
}
for (const point of ['afterConfigIntent', 'afterConfigSwap', 'beforeCodeSwap', 'afterCodeDisplaced', 'afterCodeSwap']) {
  test(`SIGKILL ${point}: separate r13 abort restores recorded code/config before any plugin intent`, () => {
    const f = fixture(), artifacts = pinArtifactRecord(f)
    try {
      const child = childApply(f, point)
      assert.equal(child.signal, 'SIGKILL', child.stderr)
      assert.equal(readJSON(f.c.txFile).activation.configIntent.configReplaced, true)
      const r = abort(f)
      assert.equal(r.status, 0, r.stdout + r.stderr)
      checkRestored(f)
      assert.equal(readJSON(f.c.txFile).state, 'ABORTED')
      assertArtifactRecord(f, artifacts)
      assert.equal(readJSON(f.c.fence).inFlight, false)
    } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
  })
}
test('code/config and real plugin journal recover together; restart failure stays nonterminal and fenced', () => {
  const f = fixture()
  try {
    const applied = childApply(f)
    assert.equal(applied.status, 0, applied.stderr)
    assert.equal(verify(f.c, 'post'), true)
    const home = join(f.c.root, 'homes/agt_fix0-agent/profiles/node_modules')
    fs.mkdirSync(home, { recursive: true })
    const saved = join(f.preimage, 'agt_fix0-agent__dsh-codex')
    fs.mkdirSync(join(home, 'dsh-codex'))
    fs.writeFileSync(join(home, 'dsh-codex/old-plugin.txt'), 'old-plugin')
    markPluginIntent(f.c)
    fs.renameSync(join(home, 'dsh-codex'), saved)
    fs.symlinkSync(join(f.current, 'dsh-codex'), join(home, 'dsh-codex'))
    fs.symlinkSync(f.gen, f.current)
    const journal = [
      { phase: 'done', agent: 'CURRENT', entry: 'current-link', kind: 'current-link', symlinkTarget: null },
      { phase: 'done', agent: 'agt_fix0-agent', entry: 'dsh-codex', kind: 'dir', savedAs: 'agt_fix0-agent__dsh-codex' },
    ].map((x) => JSON.stringify(x)).join('\n') + '\n'
    fs.writeFileSync(join(f.preimage, 'manifest.json'), journal)
    const tx = readJSON(f.c.txFile)
    tx.state = 'APPLIED_AWAITING_PONG'; tx.manifestSha256 = sha(journal)
    writeJSON(f.c.txFile, tx)
    const failed = abort(f, true)
    assert.notEqual(failed.status, 0, failed.stdout + failed.stderr)
    checkRestored(f)
    assert.equal(readJSON(f.c.txFile).state, 'ABORTED_PENDING_RUNTIME_RESTORE')
    assert.equal(readJSON(f.c.fence).inFlight, true)
    assert.equal(fs.readFileSync(join(home, 'dsh-codex/old-plugin.txt'), 'utf8'), 'old-plugin')
    const resumed = abort(f)
    assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr)
    assert.equal(readJSON(f.c.txFile).state, 'ABORTED')
    assert.equal(readJSON(f.c.fence).inFlight, false)
    checkRestored(f)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})
test('foreign code stays UNKNOWN; no new apply or runtime restart is inferred', () => {
  const f = fixture()
  try {
    assert.equal(childApply(f, 'afterCodeSwap').signal, 'SIGKILL')
    fs.writeFileSync(join(f.c.trusted, 'app/generation.txt'), 'foreign writer')
    const result = abort(f)
    assert.notEqual(result.status, 0)
    assert.equal(readJSON(f.c.txFile).state, 'ABORT_INCOMPLETE')
    assert.equal(readJSON(f.c.fence).inFlight, true)
    assert.equal(fs.readFileSync(join(f.c.trusted, 'app/generation.txt'), 'utf8'), 'foreign writer')
    assert.notEqual(childApply(f).status, 0)
    assert.equal(readJSON(join(f.c.root, 'business.json')).replayCount, 0)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})

test('SIGKILL after fence clear resumes exact already-restored pair without replay', () => {
  const f = fixture()
  try {
    assert.equal(childApply(f, 'afterCodeSwap').signal, 'SIGKILL')
    const crash = abort(f, false, true)
    assert.equal(crash.signal, 'SIGKILL', crash.stdout + crash.stderr)
    assert.equal(readJSON(f.c.fence).inFlight, false)
    assert.equal(readJSON(f.c.txFile).state, 'ROLLBACK_APPLIED')
    const resumed = abort(f)
    assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr)
    checkRestored(f)
    assert.equal(readJSON(f.c.txFile).state, 'ABORTED')
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})
test('lost plugin journal after durable intent remains UNKNOWN even when code/config restore', () => {
  const f = fixture()
  try {
    assert.equal(childApply(f).status, 0)
    markPluginIntent(f.c)
    fs.symlinkSync(f.gen, f.current)
    const tx = readJSON(f.c.txFile)
    tx.state = 'ROLLING_BACK'
    writeJSON(f.c.txFile, tx)
    const result = abort(f)
    assert.notEqual(result.status, 0, result.stdout + result.stderr)
    assert.equal(readJSON(f.c.txFile).state, 'ABORT_INCOMPLETE')
    assert.equal(readJSON(f.c.fence).inFlight, true)
    assert.equal(fs.readlinkSync(f.current), f.gen)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})
test('AS_USER uses public runtime interpreter while recovery retains private Node', () => {
  const source = fs.readFileSync(carrier, 'utf8')
  const start = source.indexOf('AS_USER() {')
  const end = source.indexOf('\n}\n', start) + 3
  assert.ok(start > 0 && end > start)
  const command = 'NODE=/private-recovery/bin/node; TRUSTED_ROOT=/public-runtime; id(){ echo 0; }; sudo(){ printf "%s\\n" "$@"; }; '
    + source.slice(start, end) + '\nAS_USER env HTTP_PROXY=fixture "$NODE" -e fixture'
  const result = spawnSync('/bin/bash', ['-c', command], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /public-runtime\/node-runtime\/bin\/node/)
  assert.doesNotMatch(result.stdout, /private-recovery/)
  assert.doesNotMatch(source, /sudo -u authsvc \"\$NODE\"/, 'all authsvc Node calls must use AS_USER')
})

function installFixturePlugins(f) {
  markPluginIntent(f.c)
  const canonical = join(f.c.root, 'shared-credentials/openai-codex/.openai-codex-auth.json')
  fs.mkdirSync(join(f.c.root, 'shared-credentials/openai-codex'), { recursive: true })
  fs.writeFileSync(canonical, 'synthetic fixture only', { mode: 0o600 })
  fs.mkdirSync(join(f.gen, 'dsh-codex/lib'), { recursive: true })
  fs.writeFileSync(join(f.gen, 'dsh-codex/lib/index.js'), 'fixture plugin')
  fs.symlinkSync(f.gen, f.current)
  const rows = [{ phase: 'done', agent: 'CURRENT', entry: 'current-link', kind: 'current-link', symlinkTarget: null }]
  for (const id of Object.keys(readJSON(f.c.config).overrides)) {
    const profiles = join(f.c.root, 'homes', id, 'profiles')
    fs.mkdirSync(join(profiles, 'node_modules'), { recursive: true })
    fs.mkdirSync(join(profiles, 'agent-core-production'))
    fs.symlinkSync(join(f.current, 'dsh-codex'), join(profiles, 'node_modules/dsh-codex'))
    fs.writeFileSync(join(profiles, 'agent-core-production/cordis.patch.yml'),
      `# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\ncredentialFile: "${canonical}"\n# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n`)
    rows.push({ phase: 'done', agent: id, entry: 'dsh-codex', kind: 'absent', savedAs: null })
  }
  const journal = rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
  fs.writeFileSync(join(f.preimage, 'manifest.json'), journal)
  const tx = readJSON(f.c.txFile)
  tx.state = 'APPLIED_AWAITING_PONG'
  tx.manifestSha256 = sha(journal)
  writeJSON(f.c.txFile, tx)
}

test('participant-aware second-shell commit verifies 92 consumers and binds the synthetic receipt', () => {
  const f = fixture(), artifacts = pinArtifactRecord(f)
  try {
    assert.equal(childApply(f).status, 0)
    installFixturePlugins(f)
    const result = spawnSync('/bin/bash', [carrier, '--tx-child-commit', '--transaction', f.c.txId], {
      // Same commit-capable budget as the cohort suite's outerRun: the commit's
      // consumer-access pass hits the recorded sameProcessBulkProbe slowness, and a
      // harness kill closes the pipes (broken-pipe exit artifact, not a verdict).
      encoding: 'utf8', input: 'COMMIT\n', timeout: 240000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, TXPROBE_ROOT: f.c.root, TXPROBE_CONTROL: f.control,
        TXPROBE_RECOVERY_ROOT: f.c.recovery, TXPROBE_TRUSTED_ROOT: f.c.trusted, TXPROBE_NODE: process.execPath },
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(readJSON(f.c.txFile).state, 'COMMITTED')
    assertArtifactRecord(f, artifacts)
    assert.equal(readJSON(join(f.control, 'codex-plugin-commit-receipt.json')).txId, f.c.txId)
    assert.equal(readJSON(f.c.fence).inFlight, false)
    assert.equal(verify(f.c, 'post'), true)
    assert.equal(readJSON(join(f.c.root, 'business.json')).replayCount, 0)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})

test('production entry refuses an unbound outer runner without inferring lock ownership', () => {
  const source = fs.readFileSync(carrier, 'utf8')
  const start = source.indexOf('require_deploy_mutex() {')
  const end = source.indexOf('\n}\n', start) + 3
  assert.ok(start > 0 && end > start)
  const result = spawnSync('/bin/bash', ['-c', 'TXPROBE_ACTIVE=0; '
    + source.slice(start, end) + '\nrequire_deploy_mutex'], { encoding: 'utf8' })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stdout, /DEPLOY_MUTEX_INTEGRATION_UNBOUND/)
})

for (const [field, value] of [
  ['source_head_sha', 'c'.repeat(40)], ['source_tree_sha', 'c'.repeat(40)],
  ['source_clean', 'no'], ['generation_label_sha', 'c'.repeat(40)],
  ['source_label_matches_pack_input', 'NO'], ['missing', null], ['symlink', null],
]) {
  test(`artifact source binding refuses ${field} before preparing any recovery assets`, () => {
    const f = fixture({ deferPrepare: true })
    try {
      const app = join(f.c.input, 'app'), receipt = join(app, 'pack-provenance.json')
      if (field === 'missing') fs.unlinkSync(receipt)
      else if (field === 'symlink') {
        fs.renameSync(receipt, join(f.base, 'foreign-provenance.json'))
        fs.symlinkSync(join(f.base, 'foreign-provenance.json'), receipt)
      } else {
        const record = readJSON(receipt)
        record[field] = value
        writeJSON(receipt, record)
      }
      // Bind the changed bytes too: a matching artifact digest alone must not
      // bless a contradictory source claim.
      f.packet.codeDigests.app = treeDigest(app)
      const beforeCode = treeDigest(join(f.c.trusted, 'app'))
      assert.throws(() => prepare(f.c, f.packet), /app provenance/)
      assert.equal(fs.existsSync(f.c.assets), false)
      assert.equal(readJSON(f.c.txFile).state, 'PREPARED')
      assert.equal(treeDigest(join(f.c.trusted, 'app')), beforeCode)
      assert.equal(fs.readFileSync(f.c.config).equals(f.before), true)
    } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
  })
}

const outer = join(repo, 'docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh')
function outerEnv(f) {
  return { ...process.env, TXPROBE_ROOT: f.c.root, TXPROBE_CONTROL: f.control,
    TXPROBE_RECOVERY_ROOT: f.c.recovery, TXPROBE_TRUSTED_ROOT: f.c.trusted,
    TXPROBE_NODE: process.execPath, B7_PROBE_BASE: f.base }
}
function launchOuter(f, mode = 'apply', tx = f.c.txId, extra = {}) {
  const child = spawn('/bin/bash', [outer, `--b7-probe-${mode}`, '--transaction', tx],
    { env: { ...outerEnv(f), ...extra }, stdio: ['pipe', 'pipe', 'pipe'] })
  const run = { child, output: '', done: false }
  child.stdout.on('data', (b) => { run.output += b })
  child.stderr.on('data', (b) => { run.output += b })
  child.stdin.on('error', () => {})
  run.exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })))
  run.closed = new Promise((resolve) => child.on('close', (code, signal) => {
    run.done = true; resolve({ code, signal })
  }))
  return run
}
async function outputUntil(run, text) {
  const deadline = Date.now() + 20000
  while (!run.output.includes(text)) {
    assert.equal(run.done, false, run.output)
    assert.ok(Date.now() < deadline, `waiting for ${text}: ${run.output}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
async function finish(run, input) {
  run.child.stdin.end(input)
  const result = await run.closed
  assert.equal(result.code, 0, run.output)
}
const outerLock = (f) => join(f.base, 'production-deploy.lock')
async function dispose(f, run) {
  if (run && !run.done) { run.child.kill('SIGKILL'); await run.closed }
  fs.rmSync(f.base, { recursive: true, force: true })
}

test('outer lifecycle holds the shared mutex across apply and abort; concurrent apply/resume refuse', async () => {
  const f = fixture(); let run
  try {
    run = launchOuter(f)
    await outputUntil(run, 'B7_AWAITING_OWNER')
    assert.equal(readJSON(f.c.config).version, 3)
    for (const mode of ['apply', 'resume']) {
      const rival = launchOuter(f, mode)
      const r = await rival.closed
      assert.notEqual(r.code, 0, rival.output)
      assert.match(rival.output, /B7_MUTEX_BUSY/)
    }
    await finish(run, 'ABORT\n')
    checkRestored(f)
    assert.equal(readJSON(f.c.txFile).state, 'ABORTED')
    assert.equal(fs.existsSync(outerLock(f)), false)
  } finally { await dispose(f, run) }
})

for (const loss of ['EOF', 'SIGTERM', 'PREPARED', 'PREPARED_RUNTIME']) {
  test(`outer ${loss} retains UNKNOWN lock/fence; explicit same-tx resume aborts without re-applying`, async () => {
    const prepared = loss.startsWith('PREPARED')
    const f = fixture({ deferPrepare: prepared }); let run
    try {
      if (prepared) fs.unlinkSync(f.c.fence)
      run = launchOuter(f, 'apply', f.c.txId, prepared ? { TXPROBE_OUTER_PREPARED_ONLY: '1' } : {})
      if (!prepared) await outputUntil(run, 'B7_AWAITING_OWNER')
      else await run.closed
      const applied = readJSON(f.c.txFile).activation?.configIntent
      if (loss === 'EOF') run.child.stdin.end()
      else if (loss === 'SIGTERM') run.child.kill('SIGTERM')
      assert.notEqual((await run.closed).code, 0)
      assert.equal(fs.existsSync(outerLock(f)), true)
      if (!prepared) assert.equal(readJSON(f.c.fence).inFlight, true)
      const wrong = launchOuter(f, 'resume', 'tx-other')
      assert.notEqual((await wrong.closed).code, 0)
      assert.match(wrong.output, /B7_BINDING_MISMATCH/)
      if (prepared) {
        const tx = readJSON(f.c.txFile); writeJSON(f.c.txFile, { ...tx, activation: null })
        assert.throws(() => proveNoParticipantAbort(f.c), /participant is not absent/)
        writeJSON(f.c.txFile, tx)
      }
      if (loss === 'PREPARED_RUNTIME') {
        run = launchOuter(f, 'resume', f.c.txId, { TXPROBE_RUNTIME_FAIL: '1' }); run.child.stdin.end('ABORT\n')
        assert.notEqual((await run.closed).code, 0)
        assert.equal(readJSON(f.c.txFile).state, 'ABORTED_PENDING_RUNTIME_RESTORE')
        assert.equal(fs.existsSync(outerLock(f)), true)
      }
      run = launchOuter(f, 'resume')
      await outputUntil(run, 'B7_AWAITING_OWNER')
      assert.deepEqual(readJSON(f.c.txFile).activation?.configIntent, applied)
      assert.doesNotMatch(run.output, /PROBE_APPLY/)
      await finish(run, 'ABORT\n')
      assert.equal(fs.readFileSync(f.c.config).equals(f.before), true)
      assert.equal(readJSON(f.c.txFile).state, 'ABORTED')
      assert.equal(fs.existsSync(outerLock(f)), false)
      if (!prepared) checkRestored(f)
    } finally { await dispose(f, run) }
  })
}

test('outer rejects legacy holder and changed source binding without deleting either lock', async () => {
  const f = fixture(); let run
  try {
    fs.mkdirSync(outerLock(f), { mode: 0o700 })
    const holder = join(outerLock(f), 'holder')
    fs.writeFileSync(holder, 'pid=123\nuid=0\n', { mode: 0o600 })
    run = launchOuter(f, 'resume')
    assert.notEqual((await run.closed).code, 0)
    assert.equal(fs.readFileSync(holder, 'utf8'), 'pid=123\nuid=0\n')
    fs.unlinkSync(holder); fs.rmdirSync(outerLock(f))
    run = launchOuter(f)
    await outputUntil(run, 'B7_AWAITING_OWNER')
    run.child.stdin.end(); await run.closed
    const record = readJSON(holder)
    record.binding.outerSha256 = '0'.repeat(64)
    writeJSON(holder, record)
    run = launchOuter(f, 'resume')
    assert.notEqual((await run.closed).code, 0)
    assert.match(run.output, /B7_BINDING_MISMATCH/)
    assert.deepEqual(readJSON(holder), record)
    assert.equal(readJSON(f.c.fence).inFlight, true)
  } finally { await dispose(f, run) }
})

test('outer lost child result after config swap remains recoverable using the same transaction', async () => {
  const f = fixture(); let run
  try {
    run = launchOuter(f, 'apply', f.c.txId, { TXPROBE_OUTER_KILL_AFTER_CONFIG: '1' })
    assert.notEqual((await run.closed).code, 0)
    assert.equal(readJSON(f.c.config).version, 3)
    assert.equal(readJSON(f.c.txFile).state, 'MUTATING_FENCED')
    assert.equal(fs.existsSync(outerLock(f)), true)
    run = launchOuter(f, 'resume')
    await outputUntil(run, 'B7_AWAITING_OWNER')
    await finish(run, 'ABORT\n')
    checkRestored(f)
  } finally { await dispose(f, run) }
})

test('outer COMMIT uses the real r13 verification/confirmation path and releases only after terminal readback', async () => {
  const f = fixture(); let run
  try {
    run = launchOuter(f)
    await outputUntil(run, 'B7_AWAITING_OWNER')
    installFixturePlugins(f) // synthetic 92-home completion, never a live PONG
    await finish(run, 'COMMIT\n')
    assert.equal(readJSON(f.c.txFile).state, 'COMMITTED')
    assert.equal(readJSON(f.c.fence).inFlight, false)
    assert.equal(readJSON(join(f.control, 'codex-plugin-commit-receipt.json')).txId, f.c.txId)
    assert.equal(verify(f.c, 'post'), true)
    assert.equal(fs.existsSync(outerLock(f)), false)
  } finally { await dispose(f, run) }
})

test('outer SIGKILL cannot release an inherited child lease; recovery waits for that exact child exit', async () => {
  const f = fixture(); let run, pid
  try {
    run = launchOuter(f, 'apply', f.c.txId, { TXPROBE_OUTER_PAUSE: '1' })
    await outputUntil(run, 'PROBE_PAUSED pid=')
    pid = Number(run.output.match(/PROBE_PAUSED pid=(\d+)/)[1])
    run.child.kill('SIGKILL'); await run.exited
    const rival = launchOuter(f, 'resume')
    assert.notEqual((await rival.closed).code, 0)
    assert.match(rival.output, /B7_MUTEX_BUSY/)
    process.kill(pid, 'SIGCONT')
    await run.closed; pid = undefined
    assert.equal(readJSON(f.c.config).version, 3)
    run = launchOuter(f, 'resume')
    await outputUntil(run, 'B7_AWAITING_OWNER')
    await finish(run, 'ABORT\n')
    checkRestored(f)
  } finally {
    if (pid) { try { process.kill(pid, 'SIGKILL') } catch {} }
    await dispose(f, run)
  }
})

test('outer failed runtime recovery and forged inherited ownership keep the transaction locked', async () => {
  const f = fixture(); let run
  try {
    run = launchOuter(f, 'apply', f.c.txId, { TXPROBE_RUNTIME_FAIL: '1' })
    await outputUntil(run, 'B7_AWAITING_OWNER')
    const forged = spawnSync('/bin/bash', [carrier, '--tx-child-abort', '--transaction', f.c.txId],
      { encoding: 'utf8', env: { ...outerEnv(f), B7_OUTER_ACTIVE: '1' } })
    assert.notEqual(forged.status, 0)
    assert.equal(readJSON(f.c.config).version, 3)
    run.child.stdin.end('ABORT\n')
    assert.notEqual((await run.closed).code, 0)
    assert.equal(readJSON(f.c.txFile).state, 'ABORTED_PENDING_RUNTIME_RESTORE')
    assert.equal(fs.existsSync(outerLock(f)), true)
    run = launchOuter(f, 'resume')
    await outputUntil(run, 'B7_AWAITING_OWNER')
    await finish(run, 'ABORT\n')
    checkRestored(f)
  } finally { await dispose(f, run) }
})

test('outer custody accepts only the fixed macOS var alias, not nested symlink aliases', () => {
  const f = fixture()
  try {
    const file = join(f.c.recovery, 'alias-check.json'); writeJSON(file, {})
    const alias = file.replace(/^\/private\/var\//, '/var/')
    assert.notEqual(alias, file, 'macOS fixture must exercise the real /var system alias')
    const source = fs.readFileSync(outer, 'utf8')
    const check = source.slice(source.indexOf('def checked('), source.indexOf('\ndef read_private('))
    const program = 'import os,stat,sys\nfrom pathlib import Path\ndef stop(s): raise RuntimeError(s)\n'
      + check + '\nchecked(Path(sys.argv[1]))\n'
    assert.equal(spawnSync('/usr/bin/python3', ['-c', program, alias]).status, 0)
    fs.symlinkSync(f.c.recovery, join(f.base, 'untrusted-alias'))
    assert.notEqual(spawnSync('/usr/bin/python3', ['-c', program, join(f.base, 'untrusted-alias/alias-check.json')]).status, 0)
  } finally { fs.rmSync(f.base, { recursive: true, force: true }) }
})
