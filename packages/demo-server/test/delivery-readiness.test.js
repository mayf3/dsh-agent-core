import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createSessionSeam } from '../src/session-seam.js'
import { prepareSessionDelivery } from '../src/delivery-readiness.js'
import { AgentProcess } from '../../agent-router/src/process.js'
import { monotonicNowMs } from '../../agent-router/src/process/state-machine.js'

test('R1 fresh spawn + 59243-event resume: no readiness ack or prompt before replay completes', async () => {
  let releaseResume
  const resuming = new Promise(resolve => { releaseResume = resolve })
  let resumeStarted
  const started = new Promise(resolve => { resumeStarted = resolve })
  const calls = { resume: 0, create: 0, followup: 0 }
  const events = Array.from({ length: 59243 }, (_, seq) => ({ seq }))
  const handle = { agent: {
    session: { id: 'main', seq: events.length, header: { cwd: '/tmp/resume-workspace' } },
    followup() { calls.followup += 1 },
  } }
  const services = {
    agentLoop: {}, sessionPersistence: { list: async () => [{ id: 'main' }] },
    agents: {
      async resume() { calls.resume += 1; resumeStarted(); await resuming; return handle },
      async create() { calls.create += 1; throw new Error('unexpected create') },
    },
  }
  const seam = createSessionSeam({
    ctx: { get: name => services[name] },
    settings: { cwd: '/tmp/resume-workspace', provider: 'offline', model: 'fixture' },
    conversationSource: null,
  })
  let acknowledged = 0
  const first = prepareSessionDelivery(seam, { version: 1, sessionId: 'main' })
    .then(value => { acknowledged += 1; return value })
  await started
  const concurrent = prepareSessionDelivery(seam, { version: 1, sessionId: 'main' })
    .then(value => { acknowledged += 1; return value })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(acknowledged, 0)
  assert.deepEqual(calls, { resume: 1, create: 0, followup: 0 })
  assert.equal(seam.handles.size, 0)
  releaseResume()
  assert.deepEqual(await first, { version: 1, ready: true, sessionId: 'main' })
  await concurrent
  assert.equal(acknowledged, 2)
  assert.equal(seam.handles.get('main').agent.session.seq, 59243)
  assert.deepEqual(calls, { resume: 1, create: 0, followup: 0 })
  await prepareSessionDelivery(seam, { version: 1, sessionId: 'main' })
  assert.equal(calls.resume, 1, 'hot handle is checked without another replay')
})

test('R1 readiness validates version/session and propagates workspace mismatch without admission', async () => {
  let calls = 0
  const seam = { async getOrCreateSession() { calls += 1; throw Object.assign(new Error('mismatch'), { code: 'SESSION_WORKSPACE_MISMATCH' }) } }
  for (const params of [undefined, {}, { version: 2, sessionId: 'main' }, { version: 1, sessionId: '' }]) {
    await assert.rejects(prepareSessionDelivery(seam, params), { code: 'AGENT_DELIVERY_PREPARE_PROTOCOL' })
  }
  assert.equal(calls, 0)
  await assert.rejects(prepareSessionDelivery(seam, { version: 1, sessionId: 'main' }), { code: 'SESSION_WORKSPACE_MISMATCH' })
  assert.equal(calls, 1)
})

test('readiness preserves private-session resolution and redacts its rejection details', async () => {
  let argumentsSeen
  const seam = { async getOrCreateSession(...args) {
    argumentsSeen = args
    throw Object.assign(new Error('private-session private-workspace'), { code: 'SESSION_WORKSPACE_MISMATCH' })
  } }
  await assert.rejects(prepareSessionDelivery(seam, {
    version: 1, sessionId: 'private-session', cwd: 'private-workspace', privateSession: true,
  }), error => {
    assert.equal(error.code, 'SESSION_WORKSPACE_MISMATCH')
    assert.equal(error.message, 'session preparation failed')
    return true
  })
  assert.deepEqual(argumentsSeen, ['private-session', 'private-workspace', true])
})

for (const persisted of [false, true]) {
  test(`prepared ${persisted ? 'resumed' : 'created'} session retains first-prompt provenance, then reports genuine hot reuse`, async () => {
    let followups = 0
    const workspace = '/tmp/prepared-provenance'
    const handle = { agent: {
      session: { id: 'main', seq: persisted ? 59243 : 0, header: { cwd: workspace } },
      followup() { followups += 1 },
    } }
    const services = {
      agentLoop: {}, sessionPersistence: { list: async () => persisted ? [{ id: 'main' }] : [] },
      agents: { create: async () => handle, resume: async () => handle },
    }
    const seam = createSessionSeam({
      ctx: { get: name => services[name] },
      settings: { cwd: workspace, provider: 'offline', model: 'fixture' },
      conversationSource: { reserve: ({ mainResolution }) => ({ mainResolution }) },
    })
    await prepareSessionDelivery(seam, { version: 1, sessionId: 'main' })
    await prepareSessionDelivery(seam, { version: 1, sessionId: 'main' })
    assert.equal(followups, 0, 'repeated readiness checks are not admitted prompts')
    const first = await seam.prompt('main', [], workspace, undefined, { requestId: 'first' })
    assert.equal(first.mainResolution.disposition, persisted ? 'resumed' : 'created')
    assert.equal(first.mainResolution.reason, persisted ? 'persisted_main_resumed' : 'main_artifact_absent')
    assert.equal(first.mainResolution.provenance, 'native_session_resolution')
    assert.equal(first.mainResolution.generation_change_reason, null)
    await prepareSessionDelivery(seam, { version: 1, sessionId: 'main' })
    const second = await seam.prompt('main', [], workspace, undefined, { requestId: 'second' })
    assert.equal(second.mainResolution.disposition, 'hot_reuse')
    assert.equal(second.mainResolution.reason, 'loaded_main_handle')
    assert.equal(followups, 2)
  })
}

test('R1 stdio integration: fresh child acknowledges initialize before suspended resume is deliverable', { timeout: 5000 }, async t => {
  const program = `
    import { apply } from ${JSON.stringify(new URL('../src/index.js', import.meta.url).href)};
    let releaseResume;
    const suspended = new Promise(resolve => { releaseResume = resolve });
    process.on('message', message => { if (message === 'resume-complete') releaseResume() });
    const services = {
      llm: { listProviders: () => [{ id: 'offline' }] }, agentLoop: {},
      sessionPersistence: { list: async () => [{ id: 'main' }], flush: async () => {} },
      agents: { async resume() {
        process.send('resume-started');
        await suspended;
        return { agent: { session: { id: 'main', seq: 59243, header: { cwd: '/tmp/stdio-resume' } },
          followup() { throw new Error('readiness must not prompt') } }, dispose: async () => {} };
      } },
    };
    apply({ get: key => services[key], on: () => () => {}, provide() {},
      root: { fiber: { dispose: async () => {} } } });
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], {
    env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
  })
  const proc = new AgentProcess({
    agentId: 'agt_offline', profile: 'offline', home: '/tmp/stdio-resume-home',
    workspace: '/tmp/stdio-resume', provider: 'offline', model: 'fixture',
    log: { log() {}, error() {} }, deadlines: { initializeTimeoutMs: 2000 },
  })
  proc.attachChild(child)
  await proc.ready()
  assert.equal(proc.state, 'READY')
  assert.deepEqual(proc.initializeEvidence.deliveryReadiness, { version: 1 })
  const resumeStarted = once(child, 'message')
  let deliverable = false
  const prepared = proc.prepareDelivery('main', {}, { deadlineMono: monotonicNowMs() + 2000 })
    .then(value => { deliverable = true; return value })
  assert.equal((await resumeStarted)[0], 'resume-started')
  assert.equal(deliverable, false, 'process READY does not bypass pending session resume')
  assert.equal(proc.counters.promptWriteAttempts, 0)
  child.send('resume-complete')
  assert.deepEqual(await prepared, { version: 1, ready: true, sessionId: 'main' })
  assert.equal(proc.counters.promptWriteAttempts, 0)
  assert.equal(proc.store.records.size, 0)
  await proc.shutdown(200)
})
