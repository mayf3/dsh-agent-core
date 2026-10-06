/**
 * AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1 — hermetic tests.
 *
 * The Core development writer is RETIRED (CTR-DEC-001): start/continue/cancel
 * refuse with `writer_authority_retired`; Core never writes the ledger, never
 * declares terminal state, never kills processes, never reserves worktrees.
 * Read-only compatibility (CTR-DEC-002): ledger replay, status, and result
 * keep serving whatever history exists, byte-identical. The explicit
 * `writerAuthorityRetired: false` opt-out exists ONLY for the legacy hermetic
 * suite (test/development-execution.test.js), never in production wiring.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DevelopmentExecutionEngine } from '../src/index.js'
import { developmentExecuteManifest } from '../../broker/src/capabilities/development-execute.js'

function makeDevDir() {
  const root = mkdtempSync(join(tmpdir(), 'des-retired-'))
  const devDir = join(root, 'dev-execution')
  mkdirSync(devDir, { recursive: true })
  return devDir
}

/** A pre-cutover ledger: one execution left non-terminal (RUNNING). */
function seedNonTerminalLedger(devDir) {
  mkdirSync(join(devDir, 'ledger'), { recursive: true })
  const started = { atMs: 1000, type: 'execution_started', executionId: 'exec-legacy-1', backend: 'codex', repo: 'r', baseSha: '0'.repeat(40), branch: null, worktree: '/tmp/wt-legacy-1', agentId: 'agent-legacy', dedupeKeyHash: null }
  const running = { atMs: 2000, type: 'state', executionId: 'exec-legacy-1', state: 'RUNNING', pid: 999999999 }
  writeFileSync(join(devDir, 'ledger', 'executions.jsonl'), JSON.stringify(started) + '\n' + JSON.stringify(running) + '\n')
}

/** A pre-cutover ledger: one execution with a terminal SUCCEEDED receipt. */
function seedTerminalLedger(devDir) {
  mkdirSync(join(devDir, 'ledger'), { recursive: true })
  const started = { atMs: 1000, type: 'execution_started', executionId: 'exec-done-1', backend: 'codex', repo: 'r', baseSha: '0'.repeat(40), branch: null, worktree: '/tmp/wt-done-1', agentId: 'agent-legacy', dedupeKeyHash: null }
  const terminal = { atMs: 3000, type: 'terminal', executionId: 'exec-done-1', terminalState: 'SUCCEEDED', candidateSha: 'a'.repeat(40), changedFiles: ['app.txt'], errorClass: null, failureDetail: null, evidenceRefs: [], sessionId: 's-legacy' }
  writeFileSync(join(devDir, 'ledger', 'executions.jsonl'), JSON.stringify(started) + '\n' + JSON.stringify(terminal) + '\n')
}

const ledgerBytes = (devDir) => readFileSync(join(devDir, 'ledger', 'executions.jsonl'), 'utf8')

test('DEC-1 start refuses writer_authority_retired by default, with zero side effects', async () => {
  const devDir = makeDevDir()
  let backendRan = false
  const engine = new DevelopmentExecutionEngine({
    devDir,
    backend: { name: 'fake', verify: () => ({ ok: true, version: 'fake' }), run: () => { backendRan = true; throw new Error('backend must never run') } },
  })
  await assert.rejects(
    () => engine.start({ repo: 'r', baseSha: '0'.repeat(40), task: 'x' }, 'agent-1'),
    (error) => error.code === 'writer_authority_retired',
  )
  assert.equal(backendRan, false, 'backend verify/run must not be reached')
  assert.equal(existsSync(join(devDir, 'worktrees')), false, 'no worktree may be created')
  assert.equal(existsSync(join(devDir, 'ledger', 'executions.jsonl')), false, 'no ledger line may be written')
})

test('DEC-1 continue refuses writer_authority_retired even on a continuable-looking history', async () => {
  const devDir = makeDevDir()
  seedNonTerminalLedger(devDir)
  const before = ledgerBytes(devDir)
  const engine = new DevelopmentExecutionEngine({ devDir, backend: { name: 'fake', verify: () => ({ ok: true }), run: () => { throw new Error('never') } } })
  await assert.rejects(
    () => engine.continue({ executionId: 'exec-legacy-1', instruction: 'go on' }, 'agent-legacy'),
    (error) => error.code === 'writer_authority_retired',
  )
  assert.equal(ledgerBytes(devDir), before, 'continue refusal must not append any ledger line')
})

test('DEC-1 cancel refuses writer_authority_retired and never declares terminal state', async () => {
  const devDir = makeDevDir()
  seedNonTerminalLedger(devDir)
  const before = ledgerBytes(devDir)
  const engine = new DevelopmentExecutionEngine({ devDir, backend: { name: 'fake', verify: () => ({ ok: true }), run: () => { throw new Error('never') } } })
  assert.throws(
    () => engine.cancel('exec-legacy-1'),
    (error) => error.code === 'writer_authority_retired',
  )
  assert.equal(ledgerBytes(devDir), before, 'cancel refusal must not append a CANCELLED terminal')
})

test('DEC-1 restart replay of a non-terminal legacy execution performs ZERO ledger writes', () => {
  const devDir = makeDevDir()
  seedNonTerminalLedger(devDir)
  const before = ledgerBytes(devDir)
  // Owning-process restart: the recorded pid is dead. Pre-cutover behavior
  // appended OUTCOME_UNKNOWN here; retired Core must not write anything.
  const engine = new DevelopmentExecutionEngine({ devDir, backend: { name: 'fake', verify: () => ({ ok: true }), run: () => { throw new Error('never') } } })
  assert.equal(ledgerBytes(devDir), before, 'orphan recovery must not append OUTCOME_UNKNOWN under retirement')
  const record = engine.status('exec-legacy-1')
  assert.equal(record.state, 'RUNNING', 'historical projection stays queryable as recorded')
})

test('DEC-2 historical terminal receipt stays byte-stable and readable after restart', () => {
  const devDir = makeDevDir()
  seedTerminalLedger(devDir)
  const before = ledgerBytes(devDir)
  const engine = new DevelopmentExecutionEngine({ devDir, backend: { name: 'fake', verify: () => ({ ok: true }), run: () => { throw new Error('never') } } })
  const receipt = engine.result('exec-done-1')
  assert.equal(receipt.terminal, true)
  assert.equal(receipt.receipt.terminalState, 'SUCCEEDED')
  assert.equal(receipt.receipt.candidateSha, 'a'.repeat(40))
  assert.deepEqual(receipt.receipt.changedFiles, ['app.txt'])
  assert.equal(ledgerBytes(devDir), before, 'read paths must never mutate the ledger')
})

test('DEC-2 broker manifest documents the retired writer and keeps reads', () => {
  const codes = developmentExecuteManifest.errors.map((e) => e.code)
  assert.ok(codes.includes('writer_authority_retired'), 'manifest must document writer_authority_retired')
  assert.ok(/agent-control/i.test(developmentExecuteManifest.description), 'manifest must name agent-control as the development writer authority')
  for (const op of developmentExecuteManifest.operations) {
    assert.ok(['start', 'status', 'continue', 'cancel', 'result'].includes(op.name), 'surface stays visible (explicit refusal beats silent removal)')
  }
})

test('explicit opt-out keeps the legacy hermetic machinery testable (never used by production wiring)', async () => {
  const devDir = makeDevDir()
  const repoDir = mkdtempSync(join(tmpdir(), 'des-retired-repo-'))
  writeFileSync(join(devDir, 'repos.json'), JSON.stringify({
    repos: [{ name: 'r', path: repoDir, allowedBranchPrefixes: [], maxWorktrees: 1 }],
  }))
  const baseSha = initGitRepo(repoDir)
  const engine = new DevelopmentExecutionEngine({
    devDir,
    writerAuthorityRetired: false,
    backend: { name: 'fake', verify: () => ({ ok: true, version: 'fake' }), run: () => ({ pid: 999999, done: Promise.resolve({ exitCode: 0, signal: null, sessionId: 's-1', stderrTail: [] }) }) },
  })
  const r = await engine.start({ repo: 'r', baseSha, task: 'legacy-suite' }, 'agent-1')
  assert.equal(r.state, 'RUNNING')
})

/** Minimal real git repo so the opt-out path passes worktree authority. */
function initGitRepo(dir) {
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }
  spawnSync('git', ['-C', dir, 'init', '-b', 'main'], { env })
  writeFileSync(join(dir, 'app.txt'), 'base\n')
  spawnSync('git', ['-C', dir, 'add', '-A'], { env })
  spawnSync('git', ['-C', dir, 'commit', '-m', 'base'], { env })
  return spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { env, encoding: 'utf8' }).stdout.trim()
}
