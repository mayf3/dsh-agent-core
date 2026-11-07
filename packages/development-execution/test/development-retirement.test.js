/** #1365 D02: retired development files cannot gate unrelated Workflow startup. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DevelopmentExecutionEngine } from '../src/index.js'
import { createPluginContext } from '../../production-runtime/src/context.js'
import { mountWorkflowCapabilityRuntime } from '../../production-runtime/src/workflow/capability-runtime.js'

const log = { log() {}, warn() {}, error() {} }
const started = id => ({ type: 'execution_started', atMs: 1000, executionId: id,
  backend: 'codex', agentId: 'agt_legacy', repo: 'r', worktree: '/historical/worktree', baseSha: '0'.repeat(40) })
const history = [started('running'), { type: 'state', atMs: 2000, executionId: 'running', state: 'RUNNING', pid: 999999999 },
  started('done'), { type: 'terminal', atMs: 3000, executionId: 'done', terminalState: 'SUCCEEDED',
    candidateSha: 'a'.repeat(40), changedFiles: ['app.txt'], sessionId: 'legacy-session' }]

function snapshot(dir) {
  if (!existsSync(dir)) return null
  return Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true }).map(entry => {
    const file = join(entry.parentPath, entry.name)
    return [file.slice(dir.length + 1), entry.isDirectory() ? 'directory' : readFileSync(file).toString('base64')]
  }))
}

function fixture(t, { backend, ledger } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'retire-1365-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const devDir = join(root, 'dev-execution')
  if (backend !== undefined) {
    mkdirSync(devDir, { recursive: true })
    writeFileSync(join(devDir, 'backend.json'), backend)
  }
  if (ledger !== undefined) {
    mkdirSync(join(devDir, 'ledger'), { recursive: true })
    writeFileSync(join(devDir, 'ledger', 'executions.jsonl'), ledger)
  }
  return { root, devDir }
}

for (const [name, files] of [
  ['missing backend and history', {}],
  ['corrupt backend with intact history', { backend: '{broken backend', ledger: history.map(JSON.stringify).join('\n') + '\n' }],
  ['corrupt history', { ledger: '{broken history\n' }],
  ['corrupt backend and history', { backend: '{broken backend', ledger: '{broken history\n' }],
]) {
  test(`1365 Workflow starts and polls with ${name}; retired writes refuse, history stays read-only`, async t => {
    const { root, devDir } = fixture(t, files)
    const before = snapshot(devDir)
    const kill = t.mock.method(process, 'kill', () => { throw new Error('no development signal allowed') })
    const ctx = createPluginContext()
    let polls = 0
    ctx.provide('brokerGateway', { execute: async call => {
      assert.equal(call.capabilityId, 'workflow_dispatch_intents')
      assert.equal(call.operation, 'list_ready')
      polls += 1
      return { ok: true, result: { items: [] } }
    } })
    ctx.provide('agentPrincipalResolutionAccess', { handlers: { agent_resolve_principal: {
      resolve: async () => { throw new Error('empty due feed must not resolve an agent') },
    } } })
    const runtime = mountWorkflowCapabilityRuntime({ ctx,
      layout: { developmentExecutionDir: devDir, workflowExecutionDir: join(root, 'workflow-execution') },
      router: { deliver: async () => { throw new Error('empty due feed must not deliver') } },
      log, opts: { workflowExecution: { pollerAgentId: 'agt_poller' } },
    })
    t.after(() => runtime.stop())
    await runtime.engine.pollOnce()
    assert.equal(polls, 1, 'unrelated Workflow due-feed is usable')
    assert.equal(snapshot(devDir) === null, before === null)
    assert.deepEqual(snapshot(devDir), before, 'mount/poll must not create a development ledger directory')
    const { handlers, engine } = ctx.get('developmentExecutionAccess')
    const ops = handlers.development_execute
    const refused = error => error.code === 'writer_authority_retired'
    for (const operation of ['start', 'continue', 'cancel']) {
      await assert.rejects(() => ops[operation]({ executionId: 'running', task: 'never' }, { callerAgentId: 'agt_legacy' }), refused)
    }
    for (const operation of ['status', 'result']) {
      if (files.ledger?.startsWith('{broken')) {
        await assert.rejects(() => ops[operation]({ executionId: 'running' }), SyntaxError)
      } else if (files.ledger === undefined) {
        await assert.rejects(() => ops[operation]({ executionId: 'missing' }), error => error.code === 'execution_not_found')
      } else {
        const running = await ops[operation]({ executionId: 'running' })
        assert.equal(running.result.state, 'RUNNING', 'restart must preserve historical non-terminal state')
        const done = await ops[operation]({ executionId: 'done' })
        assert.equal(done.result.state, 'SUCCEEDED')
        assert.equal(done.result.candidateSha, 'a'.repeat(40))
        if (operation === 'result') {
          assert.equal(running.result.terminal, false)
          assert.equal(done.result.receipt.terminalState, 'SUCCEEDED')
          assert.deepEqual(done.result.receipt.changedFiles, ['app.txt'])
        }
      }
    }
    // A failed history query must not change the refusal or poison Workflow.
    await assert.rejects(() => ops.cancel({ executionId: 'running' }), refused)
    await runtime.engine.pollOnce()
    assert.equal(polls, 2)
    assert.equal(engine.writerAuthorityRetired, true)
    assert.equal(engine.backend, undefined, 'retired query must not initialize a backend')
    assert.equal(engine.ledger, undefined, 'retired query must not initialize a mutable ledger')
    assert.equal(kill.mock.callCount(), 0, 'no PID probe or signal')
    assert.deepEqual(snapshot(devDir), before, 'all development files remain byte-identical, no worktrees/execution dirs')
  })
}

test('1365 default Engine also defers damaged history and ignores damaged backend', async t => {
  const { devDir } = fixture(t, { backend: '{broken backend', ledger: '{broken history\n' })
  const before = snapshot(devDir)
  const engine = new DevelopmentExecutionEngine({ devDir })
  await assert.rejects(() => engine.start({}, 'agt_legacy'), error => error.code === 'writer_authority_retired')
  assert.throws(() => engine.status('running'), SyntaxError)
  assert.throws(() => engine.result('done'), SyntaxError)
  assert.deepEqual(snapshot(devDir), before)
})
