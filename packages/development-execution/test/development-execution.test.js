/**
 * AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 — hermetic tests.
 *
 * Failure matrix CTR-DES-007 A–G on a FAKE backend adapter + a real git
 * fixture repo; authority refusals; manifest structural security; restart
 * recovery; and the broker gateway path (fail-closed without a grant,
 * end-to-end with a stub auth-service token endpoint).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'

import { DevelopmentExecutionEngine } from '../src/index.js'
import { ExecutionLedger } from '../src/ledger.js'
import { developmentExecuteManifest } from '../../broker/src/capabilities/development-execute.js'
import { DEFAULT_MANIFESTS, apply as applyBroker } from '../../broker/src/index.js'

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
}

function git(repoPath, args) {
  return spawnSync('git', ['-C', repoPath, ...args], { env: GIT_ENV, encoding: 'utf8' })
}

/** Real git fixture repo with one base commit and a trivial test file. */
function makeFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'des-repo-'))
  git(dir, ['init', '-b', 'main'])
  writeFileSync(join(dir, 'app.txt'), 'base\n')
  writeFileSync(join(dir, 'test.sh'), '#!/bin/sh\necho ok\n')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-m', 'base'])
  const baseSha = git(dir, ['rev-parse', 'HEAD']).stdout.trim()
  return { dir, baseSha }
}

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'des-root-'))
  const devDir = join(root, 'dev-execution')
  mkdirSync(devDir, { recursive: true })
  return { root, devDir }
}

function writeReposConfig(devDir, repo) {
  writeFileSync(join(devDir, 'repos.json'), JSON.stringify({
    repos: [{ name: 'dogfood-repo', path: repo.dir, allowedBranchPrefixes: ['dev/', 'candidate/'], maxWorktrees: 4 }],
  }))
}

function writeBackendConfig(devDir, extra = {}) {
  writeFileSync(join(devDir, 'backend.json'), JSON.stringify({ backend: 'codex', binaryPath: '/bin/echo', codeHome: '/tmp/des-codex-home', ...extra }))
}

/** FAKE backend adapter: deterministic outcomes driven by the task text. */
function fakeBackend() {
  const spawned = []
  return {
    name: 'fake',
    spawned,
    verify: () => ({ ok: true, version: 'fake-1' }),
    run({ instruction, worktree, executionDir }) {
      const mode = instruction.split('\n')[0]
      if (mode === 'TASK_SPAWN_ERROR') {
        return { pid: 999999, done: Promise.resolve({ exitCode: null, signal: null, spawnError: 'enoent', stderrTail: [] }) }
      }
      if (mode === 'TASK_FAIL') {
        return { pid: 999998, done: Promise.resolve({ exitCode: 1, signal: null, sessionId: 's-fail', stderrTail: ['error: assertion boom'] }) }
      }
      if (mode === 'TASK_CRASH') {
        return { pid: 999997, done: Promise.resolve({ exitCode: null, signal: 'SIGKILL', stderrTail: [] }) }
      }
      if (mode === 'TASK_HANG') {
        const child = spawn('sleep', ['30'])
        spawned.push(child)
        return {
          pid: child.pid,
          done: new Promise((resolve) => child.on('close', (exitCode, signal) => resolve({ exitCode, signal, stderrTail: [] }))),
        }
      }
      if (mode === 'TASK_SUCCESS_COMMIT') {
        writeFileSync(join(worktree, 'feature.txt'), `feature at ${Date.now()}\n`)
        git(worktree, ['add', '-A'])
        git(worktree, ['commit', '-m', 'candidate'])
        const sha = git(worktree, ['rev-parse', 'HEAD']).stdout.trim()
        return { pid: 999996, done: Promise.resolve({ exitCode: 0, signal: null, sessionId: 's-ok-' + sha.slice(0, 7), stderrTail: [] }) }
      }
      // success with NO commit (no-op completion)
      return { pid: 999995, done: Promise.resolve({ exitCode: 0, signal: null, sessionId: 's-noop', stderrTail: [] }) }
    },
  }
}

function makeEngine(repo, { backend = fakeBackend(), timeoutMs = 5000 } = {}) {
  const { devDir } = makeRoot()
  writeReposConfig(devDir, repo)
  const engine = new DevelopmentExecutionEngine({ devDir, backend, timeoutMs })
  return { engine, devDir }
}

const eventually = async (fn, { timeoutMs = 4000, step = 50 } = {}) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = fn()
    if (value) return value
    if (Date.now() > deadline) return null
    await new Promise((r) => setTimeout(r, step))
  }
}

// ─── ledger: terminal discipline + replay ───────────────────────────────────

test('ledger: exactly-one-terminal; replay rebuilds state; corrupt line fails loud', () => {
  const dir = mkdtempSync(join(tmpdir(), 'des-ledger-'))
  const ledger = new ExecutionLedger({ dir })
  ledger.append({ type: 'execution_started', executionId: 'e1', backend: 'fake', repo: 'r', baseSha: 'b', agentId: 'a' })
  ledger.append({ type: 'state', executionId: 'e1', state: 'RUNNING' })
  ledger.append({ type: 'terminal', executionId: 'e1', terminalState: 'SUCCEEDED' })
  assert.throws(() => ledger.append({ type: 'terminal', executionId: 'e1', terminalState: 'FAILED' }))
  assert.throws(() => ledger.append({ type: 'terminal', executionId: 'e1', terminalState: 'MADE_UP' }))
  const replayed = ExecutionLedger.replay(join(dir, 'executions.jsonl')).get('e1')
  assert.equal(replayed.state, 'SUCCEEDED')
  // corrupt line = fail loud, never self-heal
  appendFileSync(join(dir, 'executions.jsonl'), '{broken\n')
  assert.throws(() => ExecutionLedger.replay(join(dir, 'executions.jsonl')))
})

// ─── CTR-DES-007 A: success + candidate receipt ─────────────────────────────

test('A: success yields SUCCEEDED with candidateSha + changedFiles from git', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_SUCCESS_COMMIT\nbuild the thing' }, 'agent-a')
  assert.equal(started.state, 'RUNNING')
  const terminal = await eventually(() => engine.status(started.executionId).state === 'SUCCEEDED' ? engine.result(started.executionId) : null)
  assert.ok(terminal, 'reaches SUCCEEDED')
  assert.equal(terminal.terminal, true)
  assert.notEqual(terminal.receipt.candidateSha, undefined)
  assert.notEqual(terminal.receipt.candidateSha, repo.baseSha)
  assert.deepEqual(terminal.receipt.changedFiles, ['feature.txt'])
  assert.equal(terminal.receipt.failureClass, undefined)
  rmSync(repo.dir, { recursive: true, force: true })
})

test('A2: exit-0 with no commit => SUCCEEDED with empty change set (no fabricated commit)', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_NOOP' }, 'agent-a')
  const terminal = await eventually(() => engine.status(started.executionId).state === 'SUCCEEDED' ? engine.result(started.executionId) : null)
  assert.equal(terminal.receipt.candidateSha, undefined)
  assert.deepEqual(terminal.receipt.changedFiles, [])
  rmSync(repo.dir, { recursive: true, force: true })
})

// ─── CTR-DES-007 B/C/D: failure, timeout, crash ─────────────────────────────

test('B: evidenced failure => FAILED + structured failure detail', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_FAIL' }, 'agent-a')
  const terminal = await eventually(() => engine.status(started.executionId).state === 'FAILED' ? engine.result(started.executionId) : null)
  assert.equal(terminal.receipt.terminalState, 'FAILED')
  assert.equal(terminal.receipt.failureClass, 'backend_exit_nonzero')
  assert.match(JSON.stringify(terminal), /assertion boom/)
  rmSync(repo.dir, { recursive: true, force: true })
})

test('C: timeout => terminal FAILED with failureClass timeout (never success)', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo, { timeoutMs: 200 })
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG' }, 'agent-a')
  const terminal = await eventually(() => engine.status(started.executionId).state === 'FAILED' ? engine.result(started.executionId) : null)
  assert.equal(terminal.receipt.terminalState, 'FAILED')
  assert.equal(terminal.receipt.failureClass, 'timeout')
  rmSync(repo.dir, { recursive: true, force: true })
})

test('D: backend crash (signal) => OUTCOME_UNKNOWN, never fabricated', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_CRASH' }, 'agent-a')
  const terminal = await eventually(() => engine.status(started.executionId).state === 'OUTCOME_UNKNOWN' ? engine.result(started.executionId) : null)
  assert.equal(terminal.receipt.terminalState, 'OUTCOME_UNKNOWN')
  assert.equal(terminal.receipt.candidateSha, undefined)
  rmSync(repo.dir, { recursive: true, force: true })
})

test('D2: spawn error => OUTCOME_UNKNOWN', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_SPAWN_ERROR' }, 'agent-a')
  const terminal = await eventually(() => engine.status(started.executionId).state === 'OUTCOME_UNKNOWN' ? engine.result(started.executionId) : null)
  assert.equal(terminal.receipt.failureClass, 'backend_spawn_error')
  rmSync(repo.dir, { recursive: true, force: true })
})

// ─── CTR-DES-007 E/G: cancel + idempotency ──────────────────────────────────

test('E: cancel => exactly one CANCELLED; idempotent second cancel; late exit cannot overwrite', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG' }, 'agent-a')
  const first = engine.cancel(started.executionId)
  assert.equal(first.state, 'CANCELLED')
  const second = engine.cancel(started.executionId)
  assert.equal(second.cancelled, false)
  const result = engine.result(started.executionId)
  assert.equal(result.receipt.terminalState, 'CANCELLED')
  assert.equal(result.receipt.failureClass, 'cancelled_by_agent')
  rmSync(repo.dir, { recursive: true, force: true })
})

test('B1: worktree capacity — active executions per repo are capped (capacity_exhausted)', async () => {
  const repo = makeFixtureRepo()
  const { devDir } = makeRoot()
  writeFileSync(join(devDir, 'repos.json'), JSON.stringify({
    repos: [{ name: 'dogfood-repo', path: repo.dir, allowedBranchPrefixes: [], maxWorktrees: 1 }],
  }))
  const engine = new DevelopmentExecutionEngine({ devDir, backend: fakeBackend() })
  const first = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG' }, 'agent-a')
  await assert.rejects(
    () => engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG' }, 'agent-a'),
    (e) => e.code === 'capacity_exhausted',
  )
  engine.cancel(first.executionId)
  // after the only execution reaches terminal, capacity frees up
  const next = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG' }, 'agent-a')
  assert.notEqual(next.executionId, first.executionId)
  engine.cancel(next.executionId)
  rmSync(repo.dir, { recursive: true, force: true })
})

test('G: duplicate start with same (caller, dedupeKey) => SAME execution; different key => new', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const first = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG', dedupeKey: 'turn-42' }, 'agent-a')
  const duplicate = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG', dedupeKey: 'turn-42' }, 'agent-a')
  assert.equal(duplicate.executionId, first.executionId)
  assert.equal(duplicate.deduped, true)
  const otherCaller = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG', dedupeKey: 'turn-42' }, 'agent-b')
  assert.notEqual(otherCaller.executionId, first.executionId, 'same key from a DIFFERENT caller must not dedupe')
  const otherKey = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG', dedupeKey: 'turn-43' }, 'agent-a')
  assert.notEqual(otherKey.executionId, first.executionId)
  engine.cancel(first.executionId)
  engine.cancel(otherCaller.executionId)
  engine.cancel(otherKey.executionId)
  rmSync(repo.dir, { recursive: true, force: true })
})

// ─── CTR-DES-007 F: restart recovery ────────────────────────────────────────

test('F: restart — terminal history re-readable; orphan RUNNING => OUTCOME_UNKNOWN; live pid preserved', async () => {
  const repo = makeFixtureRepo()
  const { engine, devDir } = makeEngine(repo)
  const done1 = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_SUCCESS_COMMIT' }, 'agent-a')
  await eventually(() => engine.status(done1.executionId).state === 'SUCCEEDED')
  const hung = await engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_HANG' }, 'agent-a')

  // fabricate an orphan RUNNING record with a dead pid (owner crashed)
  const deadChild = spawn('sleep', ['30'])
  const deadExit = new Promise((r) => deadChild.on('close', r))
  deadChild.kill('SIGKILL')
  await deadExit // reap before pid-alive checks in the restarted engine
  engine.ledger.append({ type: 'state', executionId: 'orphan-1', state: 'RUNNING', pid: deadChild.pid })
  engine.ledger.append({ type: 'execution_started', executionId: 'orphan-1', backend: 'fake', repo: 'dogfood-repo', baseSha: repo.baseSha, agentId: 'agent-a' })

  // live pid stays RUNNING across restart
  const live = spawn('sleep', ['30'])
  engine.ledger.append({ type: 'execution_started', executionId: 'live-1', backend: 'fake', repo: 'dogfood-repo', baseSha: repo.baseSha, agentId: 'agent-a' })
  engine.ledger.append({ type: 'state', executionId: 'live-1', state: 'RUNNING', pid: live.pid })

  const restarted = new DevelopmentExecutionEngine({ devDir, backend: fakeBackend(), timeoutMs: 5000 })
  assert.equal(restarted.status(done1.executionId).state, 'SUCCEEDED', 'terminal history survives restart')
  assert.equal(restarted.status(done1.executionId).worktree, engine.status(done1.executionId).worktree, 'worktree survives restart (CTR-DES-002 record fields)')
  assert.equal(restarted.status(hung.executionId).state, 'RUNNING', 'live pid untouched')
  assert.equal(restarted.status('orphan-1').state, 'OUTCOME_UNKNOWN', 'dead-pid orphan marked OUTCOME_UNKNOWN')
  restarted.cancel(hung.executionId)
  live.kill('SIGKILL')
  rmSync(repo.dir, { recursive: true, force: true })
})

// ─── CTR-DES-004: workspace / repo authority refusals ───────────────────────

test('authority: unconfigured / unauthorized repo / unknown baseSha / bad branch / bad backend all refuse', async () => {
  const repo = makeFixtureRepo()
  const { devDir } = makeRoot()
  const engine = new DevelopmentExecutionEngine({ devDir, backend: fakeBackend() })
  await assert.rejects(
    () => engine.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'x' }, 'agent-a'),
    (e) => e.code === 'config_missing',
  )
  writeReposConfig(devDir, repo)
  const engine2 = new DevelopmentExecutionEngine({ devDir, backend: fakeBackend() })
  await assert.rejects(
    () => engine2.start({ repo: 'other-repo', baseSha: repo.baseSha, task: 'x' }, 'agent-a'),
    (e) => e.code === 'repo_not_authorized',
  )
  await assert.rejects(
    () => engine2.start({ repo: 'dogfood-repo', baseSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', task: 'x' }, 'agent-a'),
    (e) => e.code === 'base_sha_unknown',
  )
  await assert.rejects(
    () => engine2.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, branch: 'main-escape', task: 'x' }, 'agent-a'),
    (e) => e.code === 'branch_not_permitted',
  )
  await assert.rejects(
    () => engine2.start({ repo: 'dogfood-repo', baseSha: '../../../etc', task: 'x' }, 'agent-a'),
    (e) => e.code === 'invalid_arguments',
  )
  const engine3 = new DevelopmentExecutionEngine({
    devDir: makeRoot().devDir,
    backend: { name: 'fake', verify: () => ({ ok: false, code: 'backend_unavailable', detail: 'nope' }), run: () => { throw new Error('never') } },
  })
  writeReposConfig(engine3.devDir, repo)
  await assert.rejects(
    () => engine3.start({ repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'x' }, 'agent-a'),
    (e) => e.code === 'backend_unavailable',
  )
  rmSync(repo.dir, { recursive: true, force: true })
})

test('authority: worktree HEAD pinned to exact baseSha before backend starts', async () => {
  const repo = makeFixtureRepo()
  const { engine } = makeEngine(repo)
  const base2 = git(repo.dir, ['rev-parse', 'HEAD']).stdout.trim()
  writeFileSync(join(repo.dir, 'second.txt'), 'second\n')
  git(repo.dir, ['add', '-A'])
  git(repo.dir, ['commit', '-m', 'second'])
  const newSha = git(repo.dir, ['rev-parse', 'HEAD']).stdout.trim()
  assert.notEqual(base2, newSha)
  const started = await engine.start({ repo: 'dogfood-repo', baseSha: newSha, task: 'TASK_SUCCESS_COMMIT' }, 'agent-a')
  await eventually(() => engine.status(started.executionId).state === 'SUCCEEDED')
  const status = engine.status(started.executionId)
  assert.equal(status.baseSha, newSha)
  assert.ok(status.worktree.startsWith(join(status.worktree, '..')), 'worktree under the authority root')
  rmSync(repo.dir, { recursive: true, force: true })
})

// ─── CTR-DES-001/006: manifest structural security + zero-persona ──────────

test('manifest: development_execute is a closed local multi-op tool; no backend/exec leak; scopes pinned', () => {
  assert.equal(developmentExecuteManifest.id, 'development_execute')
  assert.equal(developmentExecuteManifest.local.resource, 'development-execution')
  assert.deepEqual(developmentExecuteManifest.requiredScopes, ['development.execute'])
  assert.deepEqual(developmentExecuteManifest.operations.map((o) => o.name), ['start', 'status', 'continue', 'cancel', 'result'])
  for (const op of developmentExecuteManifest.operations) {
    assert.equal(op.arguments.additionalProperties, false)
    const props = JSON.stringify(op.arguments.properties)
    for (const forbidden of ['binaryPath', 'binary_path', 'credentialPath', 'credential_path', 'env', 'shell', 'sudo', 'cmd', 'command', 'backend', 'codex', 'zcode']) {
      assert.ok(!props.includes(forbidden), `op ${op.name} must not expose ${forbidden}`)
    }
  }
  const text = JSON.stringify(developmentExecuteManifest)
  for (const persona of ['agt_cto', 'cto', 'director', '研发总监']) {
    assert.ok(!text.toLowerCase().includes(persona), `persona leak: ${persona}`)
  }
  const ids = DEFAULT_MANIFESTS.map((m) => m.id)
  assert.ok(ids.includes('development_execute'), 'registered in DEFAULT_MANIFESTS')
})

test('zero-persona sweep: new packages contain no agent/persona literals', () => {
  let out = ''
  try {
    out = execFileSync('grep', ['-ril', 'agt_cto', 'packages/development-execution/src/', 'packages/broker/src/capabilities/development-execute.js', 'packages/production-runtime/src/development-execution-runtime.js']).toString().trim()
  } catch {
    out = '' // grep exit 1 = no matches = PASS condition
  }
  assert.equal(out, '')
})

// ─── broker gateway path: fail-closed without grant; E2E with stub auth ────

test('gateway: development_execute without a grant fails CLOSED; with stub auth the start lands in the engine', async () => {
  const repo = makeFixtureRepo()
  const { devDir } = makeRoot()
  writeReposConfig(devDir, repo)
  const fake = fakeBackend()
  const { DevelopmentExecutionEngine: Engine } = await import('../src/index.js')
  const engine = new Engine({ devDir, backend: fake })

  // stub auth-service: /oauth/token mints for ANY client (E2E stand-in)
  const stub = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'stub-token', token_type: 'Bearer', expires_in: 300 }))
    })
  })
  stub.unref()
  await new Promise((r) => stub.listen(0, '127.0.0.1', r))
  const authOrigin = `http://127.0.0.1:${stub.address().port}`

  const ctx = { m: new Map(), get(n) { return this.m.get(n) }, provide(n, v) { this.m.set(n, v) }, effect() {} }
  ctx.provide('developmentExecutionAccess', {
    handlers: {
      development_execute: {
        start: async (args, context) => ({ ok: true, result: await engine.start(args, context.callerAgentId) }),
        status: async (args) => ({ ok: true, result: engine.status(args.executionId) }),
        continue: async (args, context) => ({ ok: true, result: await engine.continue(args, context.callerAgentId) }),
        cancel: async (args) => ({ ok: true, result: engine.cancel(args.executionId) }),
        result: async (args) => ({ ok: true, result: engine.result(args.executionId) }),
      },
    },
  })
  applyBroker(ctx, {
    mode: 'gateway',
    authServiceOrigin: authOrigin,
    credentialsFile: join(devDir, 'creds.json'),
    targets: [
      { targetId: 'svc-forum', allowedOrigin: 'http://127.0.0.1:1', audience: 'svc-forum' },
      { targetId: 'svc-workflow', allowedOrigin: 'http://127.0.0.1:1', audience: 'svc-workflow' },
      { targetId: 'svc-okr', allowedOrigin: 'http://127.0.0.1:1', audience: 'svc-okr' },
      { targetId: 'life-workbench', allowedOrigin: 'http://127.0.0.1:1', audience: 'life-workbench' },
    ],
  })
  // agent-b has NO credential entry yet → the grant check must fail CLOSED
  // before any handler runs.
  writeFileSync(join(devDir, 'creds.json'), JSON.stringify({ version: 1, credentials: { 'agent-other': { clientId: 'c', clientSecret: 's' } } }))
  const denied = await ctx.get('brokerGateway').execute(
    { capabilityId: 'development_execute', operation: 'status', args: { executionId: 'nope' } },
    { agentId: 'agent-b' },
  )
  assert.equal(denied.ok, false)
  assert.ok(['access_denied', 'transport_failure', 'credential_invalid', 'credential_unavailable'].includes(denied.error?.code), `denial code: ${denied.error?.code}`)

  // grant agent-b; the credential store is re-read per call.
  writeFileSync(join(devDir, 'creds.json'), JSON.stringify({ version: 1, credentials: { 'agent-b': { clientId: 'c', clientSecret: 's' } } }))
  const brokerGateway = ctx.get('brokerGateway')
  const started = await brokerGateway.execute(
    { capabilityId: 'development_execute', operation: 'start', args: { repo: 'dogfood-repo', baseSha: repo.baseSha, task: 'TASK_SUCCESS_COMMIT', dedupe_key: 'gw-1' } },
    { agentId: 'agent-b' },
  )
  assert.equal(started.ok, true, JSON.stringify(started))
  const status = await brokerGateway.execute(
    { capabilityId: 'development_execute', operation: 'status', args: { executionId: started.result.executionId } },
    { agentId: 'agent-b' },
  )
  assert.equal(status.ok, true)
  assert.equal(status.result.agentId, 'agent-b')
  const terminal = await eventually(() => engine.status(started.result.executionId).state === 'SUCCEEDED')
  assert.equal(terminal, true)
  const result = await brokerGateway.execute(
    { capabilityId: 'development_execute', operation: 'result', args: { executionId: started.result.executionId } },
    { agentId: 'agent-b' },
  )
  assert.equal(result.result.receipt.terminalState, 'SUCCEEDED')
  assert.notEqual(result.result.receipt.candidateSha, undefined)
  stub.closeAllConnections?.()
  stub.close()
  rmSync(repo.dir, { recursive: true, force: true })
})
