#!/usr/bin/env node
/**
 * Agent Router Delivery V0 acceptance driver — REAL DSH processes, REAL
 * native sessions, REAL inbox-accept semantics.
 *
 * Proves the frozen admission interface end to end:
 *
 *   deliver({ requestId, agentId, sessionMode: 'main'|'fresh', message })
 *     -> { accepted: true, sessionId }
 *
 * where `accepted` means ONLY "the message entered the correct DSH
 * Session's inbox" — never "the model turn finished".
 *
 *   Phase 0  setup: registry + router + one registered Agent (real
 *            per-agent DSH composition; NO model turn is ever awaited)
 *   Phase 1  REQ1: main FIRST deliver -> accepted, sessionId fixed 'main',
 *            session CREATED in the agent's own home, trajectory grows
 *   Phase 2  REQ2: main AGAIN -> accepted, same 'main' session, same pid
 *   Phase 3  REQ3: fresh requestId X -> session S1; fresh Y -> S2; S1 != S2,
 *            both minted `fresh-` ids, both real native sessions
 *   Phase 4  REQ4: fresh X RETRY -> SAME S1, no second session for X
 *   Phase 5  REQ5: caller cannot address sessions — a stray `sessionId`
 *            field is rejected; a fresh session is unreachable through any
 *            other requestId
 *   Phase 6  REQ6: kill the agent process; the next deliver respawns it and
 *            RESUMES the persisted 'main' session (stderr evidence), the
 *            conversation continues
 *   Phase 7  REQ7: `accepted` does not wait for the model round — a long
 *            turn is accepted in well under a turn duration and the
 *            trajectory proves the turn completed AFTER acceptance
 *   Phase 8  control-plane restart over the SAME stores: fresh X still maps
 *            to S1, main is still 'main'
 *
 * The demo-server `session/prompt` seam is the inbox-accept point: it
 * responds with { messageId } only AFTER agent.followup() synchronously
 * enqueued the message into the DSH native queue (core/agent-loop/src/
 * agent.ts send(): inbox.splice + wakeDriver) — so the receipt IS the
 * acceptance proof. NO DSH Kernel/Core change is needed; nothing here
 * understands Workflow / Forum / Team / Mailbox / notification queues.
 *
 * Usage:
 *   node scripts/agent-router-delivery-v0-verify.mjs
 * Env:
 *   DSH_DELIVERY_V0_RUNTIME    runtime root (default .demo/agent-router-delivery-v0/runtime)
 *   DSH_DELIVERY_V0_KEEP=1     keep existing agent homes (default: wipe)
 *   DSH_AGENT_PROVIDER/MODEL   LLM route (default opencode-go / deepseek-v4-flash)
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentRegistry } from '../packages/agent-registry/src/registry.js'
import { apply as applyBootstrap } from '../packages/workspace-bootstrap/src/index.js'
import { apply as applyRouter } from '../packages/agent-router/src/index.js'

const RUNTIME = resolve(process.env.DSH_DELIVERY_V0_RUNTIME ?? join(REPO, '.demo', 'agent-router-delivery-v0', 'runtime'))
const AGENTS_DIR = join(RUNTIME, 'agents') // workspace root
const HOMES_DIR = join(RUNTIME, 'homes')   // agents home root (per-agent DSH_HOME)
const REGISTRY_STORE = join(RUNTIME, 'control', 'registry.json')
const BINDINGS_STORE = join(RUNTIME, 'control', 'bindings.json')
const KEEP = process.env.DSH_DELIVERY_V0_KEEP === '1'
const AGENT_PROFILE = 'agent-core-integration-agent'
const AGENT_NAME = 'Delivery Agent'
// The receipt wait covers COLD admission (spawn + initialize + create).
// The turn itself is never awaited, so this bound only caps the receipt.
process.env.DSH_AGENT_DELIVER_TIMEOUT = process.env.DSH_AGENT_DELIVER_TIMEOUT ?? '120000'

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

// ---------------------------------------------------------------- utils

/** Fake cordis ctx: get/provide/effect + disposer tracking. */
function fakeCtx() {
  const services = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name),
    provide: (name, value) => { services.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort */ }
      }
    },
  }
}

/** Prepare one agent's workspace directory (home is the router's job). */
function provisionAgent(agentId) {
  const workspace = join(AGENTS_DIR, agentId)
  mkdirSync(workspace, { recursive: true })
  return { home: join(HOMES_DIR, agentId), workspace }
}

// ------------------------------------------------------------ assertions

const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
}

// --------------------------------------------------------------- helpers

function agentWorkspace(agentId) { return join(AGENTS_DIR, agentId) }
function agentHome(agentId) { return join(HOMES_DIR, agentId) }

/** Scan <home>/sessions/<project>/<id>/session.jsonl (persistence.list mirror). */
function sessionFiles(home) {
  const root = join(home, 'sessions')
  const out = []
  if (!existsSync(root)) return out
  for (const project of readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const projectDir = join(root, project.name)
    for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const file = join(projectDir, entry.name, 'session.jsonl')
      if (existsSync(file)) out.push({ project: project.name, id: entry.name, file })
    }
  }
  return out
}

/** The session trajectory text of one session id ('' when absent yet). */
function sessionTrajectory(agentId, sessionId) {
  const files = sessionFiles(agentHome(agentId)).filter(f => f.id === sessionId)
  return files.length > 0 ? readFileSync(files[0].file, 'utf8') : ''
}

/** Parsed events of one session: [{seq, time, type, data}] ('' -> []). */
function sessionEvents(agentId, sessionId) {
  const text = sessionTrajectory(agentId, sessionId)
  const events = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    try {
      const event = JSON.parse(line)
      if (typeof event?.seq === 'number' && typeof event?.time === 'number') {
        events.push({ seq: event.seq, time: event.time, type: event.type, data: event.data })
      }
    } catch { /* skip malformed */ }
  }
  return events
}

/** The last seq persisted so far (0 when the session has no events yet). */
function lastSeq(agentId, sessionId) {
  const events = sessionEvents(agentId, sessionId)
  return events.length > 0 ? events[events.length - 1].seq : 0
}

/** Poll until the session trajectory contains `needle`. Returns bytes read. */
async function waitForTrajectory(agentId, sessionId, needle, timeoutMs = 300000) {
  const started = Date.now()
  for (;;) {
    const text = sessionTrajectory(agentId, sessionId)
    if (text.includes(needle)) return text
    if (Date.now() - started > timeoutMs) return text
    await sleep(1000)
  }
}

/**
 * Poll until an assistant/message reply with seq > `afterSeq` is persisted.
 * Returns the event's `time` (ms) or null on timeout.
 */
async function waitForNextReply(agentId, sessionId, afterSeq, timeoutMs = 300000) {
  const started = Date.now()
  for (;;) {
    for (const event of sessionEvents(agentId, sessionId)) {
      if (event.seq > afterSeq && event.type === 'assistant/message') return event.time
    }
    if (Date.now() - started > timeoutMs) return null
    await sleep(1000)
  }
}

/** Poll an AgentProcess's stderr until it contains `needle`. */
async function waitForProcStderr(proc, needle, timeoutMs = 90000) {
  const started = Date.now()
  for (;;) {
    if (proc.stderr.includes(needle)) return true
    if (proc.exit !== undefined) return false
    if (Date.now() - started > timeoutMs) return false
    await sleep(500)
  }
}

// ------------------------------------------------------------------ main

async function main() {
  console.log(`=== Agent Router Delivery V0 acceptance — runtime ${RUNTIME}`)
  console.log(`agent: ${AGENT_NAME}; profile ${AGENT_PROFILE}; harness ${cliBin()}`)

  process.env.DSH_MEMORY_WORKSPACE_ROOT = AGENTS_DIR

  // ------------------------------------------------------------- phase 0
  if (KEEP && existsSync(RUNTIME)) {
    console.log('\n[phase 0] keeping existing runtime (KEEP=1)')
  } else {
    rmSync(RUNTIME, { recursive: true, force: true })
    console.log('\n[phase 0] runtime wiped, provisioning…')
  }

  const ctx = fakeCtx()
  applyBootstrap(ctx, { workspaceRoot: AGENTS_DIR, agentsHome: HOMES_DIR })
  const registry = new AgentRegistry({ storeFile: REGISTRY_STORE })
  ctx.provide('agentRegistry', {
    listAgents: () => registry.listAgents(),
    getAgent: (id) => registry.getAgent(id),
    getDefaultAgent: () => registry.getDefaultAgent(),
    registerAgent: (input) => registry.registerAgent(input),
    updateAgent: (agentId, patch) => registry.updateAgent(agentId, patch),
    setDefaultAgent: (agentId) => registry.setDefaultAgent(agentId),
  })
  const agent = await registry.registerAgent({ name: AGENT_NAME, description: 'Agent Router Delivery V0 acceptance' })
  record('SETUP_AGENT_REGISTERED', agent.id.startsWith('agt_'), agent.id)
  provisionAgent(agent.id)
  // Per-agent workspace persona: prove the spawned process reads ITS OWN
  // instruction surface (echoes the acceptance contract back).
  writeFileSync(join(agentWorkspace(agent.id), 'AGENTS.md'), [
    '# AGENTS.md',
    '',
    `You are ${AGENT_NAME}. Your agentId is ${agent.id}.`,
    'When asked to CONFIRM, reply with exactly: DELIVERY-OK',
    '',
  ].join('\n'))

  const router = applyRouter(ctx, {
    bindingsStoreFile: BINDINGS_STORE,
    defaultSessionId: 'main',
    defaultAgentId: agent.id,
    agentProfile: AGENT_PROFILE,
  })
  const deliver = (req) => router.deliver(req)

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] REQ1: main FIRST deliver -> create + accepted')
  const cold = Date.now()
  const r1 = await deliver({ requestId: 'job-1', agentId: agent.id, sessionMode: 'main', message: 'DELIVERY-1: confirm' })
  const coldMs = Date.now() - cold
  record('REQ1_ACCEPTED', r1.accepted === true && r1.sessionId === 'main', JSON.stringify(r1))
  record('REQ1_COLD_ADMISSION_BOUNDED', coldMs < 120000, `${coldMs}ms (spawn+initialize+create+receipt)`)
  const snap1 = router.registrySnapshot()
  const proc1 = snap1.find(s => s.agentId === agent.id)
  record('REQ1_PROCESS_SPAWNED', proc1 !== undefined && proc1.alive, `pid=${proc1?.pid}`)
  record('REQ1_MAIN_SESSION_CREATED', (proc1?.sessions ?? []).some(s => s.sessionId === 'main' && s.mode === 'created'),
    JSON.stringify(proc1?.sessions ?? []))
  // The turn runs AFTER acceptance — prove the message truly entered the
  // native session by waiting for the trajectory to contain it.
  const traj1 = await waitForTrajectory(agent.id, 'main', 'DELIVERY-1')
  record('REQ1_MESSAGE_ENTERED_SESSION', traj1.includes('DELIVERY-1'), `main trajectory ${traj1.length} bytes`)

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] REQ2: main AGAIN -> same session, same process')
  const r2 = await deliver({ requestId: 'job-2', agentId: agent.id, sessionMode: 'main', message: 'DELIVERY-2: confirm' })
  record('REQ2_ACCEPTED_SAME_MAIN', r2.accepted === true && r2.sessionId === 'main', JSON.stringify(r2))
  const snap2 = router.registrySnapshot()
  const proc2 = snap2.find(s => s.agentId === agent.id)
  record('REQ2_PROCESS_REUSED', proc2?.pid === proc1?.pid, `pid=${proc2?.pid}`)
  record('REQ2_NO_SECOND_MAIN_CREATION', (proc2?.sessions ?? []).filter(s => s.sessionId === 'main').length === 1,
    JSON.stringify(proc2?.sessions ?? []))
  const traj2 = await waitForTrajectory(agent.id, 'main', 'DELIVERY-2')
  record('REQ2_CONVERSATION_CONTINUES', traj2.includes('DELIVERY-1') && traj2.includes('DELIVERY-2'),
    'both deliveries in the SAME main trajectory')

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] REQ3: fresh X -> S1; fresh Y -> S2; S1 != S2')
  const fx = await deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'DELIVERY-X: confirm' })
  const fy = await deliver({ requestId: 'req-Y', agentId: agent.id, sessionMode: 'fresh', message: 'DELIVERY-Y: confirm' })
  record('REQ3_BOTH_ACCEPTED', fx.accepted === true && fy.accepted === true, JSON.stringify([fx, fy]))
  record('REQ3_DIFFERENT_SESSIONS', fx.sessionId !== fy.sessionId, `S1=${fx.sessionId} S2=${fy.sessionId}`)
  record('REQ3_MINTED_FRESH_IDS', /^fresh-[0-9a-f]{32}$/.test(fx.sessionId) && /^fresh-[0-9a-f]{32}$/.test(fy.sessionId))
  record('REQ3_MAPPING_TABLE_2_ROWS', router.freshSessionsSnapshot().length === 2,
    JSON.stringify(router.freshSessionsSnapshot()))
  const snap3 = router.registrySnapshot()
  const proc3 = snap3.find(s => s.agentId === agent.id)
  const createdSessions = proc3?.sessions ?? []
  record('REQ3_TWO_NATIVE_SESSIONS', createdSessions.filter(s => s.mode === 'created').length >= 3,
    JSON.stringify(createdSessions))
  await waitForTrajectory(agent.id, fx.sessionId, 'DELIVERY-X')
  record('REQ3_FRESH_SESSION_REAL', sessionTrajectory(agent.id, fx.sessionId).includes('DELIVERY-X'),
    `fresh session ${fx.sessionId} has its own trajectory`)

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] REQ4: fresh X RETRY -> SAME S1, no second session')
  const fx2 = await deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'DELIVERY-X-2: confirm' })
  record('REQ4_RETRY_SAME_SESSION', fx2.sessionId === fx.sessionId, JSON.stringify(fx2))
  record('REQ4_NO_SECOND_MAPPING', router.freshSessionsSnapshot().filter(r => r.requestId === 'req-X').length === 1,
    JSON.stringify(router.freshSessionsSnapshot().filter(r => r.requestId === 'req-X')))
  const snap4 = router.registrySnapshot()
  const proc4 = snap4.find(s => s.agentId === agent.id)
  record('REQ4_NO_SECOND_NATIVE_SESSION_X', (proc4?.sessions ?? []).filter(s => s.sessionId === fx.sessionId).length === 1,
    JSON.stringify((proc4?.sessions ?? []).filter(s => s.sessionId === fx.sessionId)))
  const trajX = await waitForTrajectory(agent.id, fx.sessionId, 'DELIVERY-X-2')
  record('REQ4_RETRY_SAME_CONVERSATION', trajX.includes('DELIVERY-X') && trajX.includes('DELIVERY-X-2'),
    'retry continues the SAME fresh conversation')

  // ------------------------------------------------------------- phase 5
  console.log('\n[phase 5] REQ5: caller cannot address sessions')
  let rejected = false
  try {
    await deliver({ requestId: 'evil', agentId: agent.id, sessionMode: 'main', message: 'x', sessionId: 'some-history' })
  } catch (error) {
    rejected = error instanceof TypeError
  }
  record('REQ5_SESSIONID_FIELD_REJECTED', rejected, 'stray sessionId field is fail-loud')
  const fz = await deliver({ requestId: 'req-Z', agentId: agent.id, sessionMode: 'fresh', message: 'DELIVERY-Z: confirm' })
  record('REQ5_OTHER_REQUESTID_OTHER_SESSION', fz.sessionId !== fx.sessionId && fz.sessionId !== fy.sessionId,
    `S3=${fz.sessionId}`)
  record('REQ5_FROZEN_INTERFACE_ONLY', Object.keys(fx).sort().join(',') === 'accepted,sessionId'
    && fx.sessionId !== undefined && fx.accepted === true, `return shape ${JSON.stringify(fx)}`)

  // ------------------------------------------------------------- phase 6
  console.log('\n[phase 6] REQ6: kill the agent process; main still resumes')
  const pidBefore = proc4.pid
  spawnSync('kill', ['-9', String(pidBefore)])
  await sleep(1500)
  const r6 = await deliver({ requestId: 'job-6', agentId: agent.id, sessionMode: 'main', message: 'DELIVERY-6: confirm' })
  record('REQ6_ACCEPTED_AFTER_CRASH', r6.accepted === true && r6.sessionId === 'main', JSON.stringify(r6))
  const snap6 = router.registrySnapshot()
  const proc6 = snap6.find(s => s.agentId === agent.id)
  record('REQ6_RESPAWNED_NEW_PID', proc6 !== undefined && proc6.alive && proc6.pid !== pidBefore,
    `pid ${pidBefore} -> ${proc6?.pid}`)
  record('REQ6_MAIN_RESUMED', (proc6?.sessions ?? []).some(s => s.sessionId === 'main' && s.mode === 'resumed'),
    JSON.stringify(proc6?.sessions ?? []))
  const traj6 = await waitForTrajectory(agent.id, 'main', 'DELIVERY-6')
  record('REQ6_CONVERSATION_SURVIVED_RESTART', traj6.includes('DELIVERY-1') && traj6.includes('DELIVERY-6'),
    'main trajectory continues across the process restart')

  // ------------------------------------------------------------- phase 7
  console.log('\n[phase 7] REQ7: accepted does NOT wait for the model turn')
  // A deliberately long turn: if deliver waited for the model round it could
  // not return quickly. The structural proof: the reply EVENT for this
  // message is persisted only after the model turn, which starts only after
  // the inbox accepted the message — so its JSONL `time` must be strictly
  // after the deliver() call returned. Warm process: only the receipt is in
  // the latency.
  const LONG = '请用详细的中文逐一说明 1 到 30 之间每个质数为什么是质数,每个至少写两句话。'
  const seqBefore = lastSeq(agent.id, 'main')
  const t7start = Date.now()
  const r7 = await deliver({ requestId: 'job-7', agentId: agent.id, sessionMode: 'main', message: LONG })
  const acceptMs = Date.now() - t7start
  const acceptedAtMs = Date.now()
  record('REQ7_ACCEPTED_FAST', r7.accepted === true && acceptMs < 30000, `accepted in ${acceptMs}ms (turn keeps running)`)
  const replyTime = await waitForNextReply(agent.id, 'main', seqBefore)
  record('REQ7_REPLY_EVENT_PERSISTED', replyTime !== null, `assistant reply seq > ${seqBefore} persisted`)
  if (replyTime !== null) {
    record('REQ7_REPLY_STRICTLY_AFTER_ACCEPTANCE', replyTime > acceptedAtMs,
      `reply persisted at ${replyTime}ms, deliver() returned at ${acceptedAtMs}ms (Δ ${replyTime - acceptedAtMs}ms)`)
  }

  // ------------------------------------------------------------- phase 8
  console.log('\n[phase 8] control-plane restart: fresh X still S1, main still main')
  await ctx.disposeAll() // shutdown every owned agent process
  const ctx2 = fakeCtx()
  applyBootstrap(ctx2, { workspaceRoot: AGENTS_DIR, agentsHome: HOMES_DIR })
  const registry2 = new AgentRegistry({ storeFile: REGISTRY_STORE })
  ctx2.provide('agentRegistry', {
    listAgents: () => registry2.listAgents(),
    getAgent: (id) => registry2.getAgent(id),
    getDefaultAgent: () => registry2.getDefaultAgent(),
    registerAgent: (input) => registry2.registerAgent(input),
  })
  const router2 = applyRouter(ctx2, {
    bindingsStoreFile: BINDINGS_STORE,
    defaultSessionId: 'main',
    defaultAgentId: agent.id,
    agentProfile: AGENT_PROFILE,
  })
  record('REQ8_MAPPING_RESTORED', router2.freshSessionsSnapshot().length === 3,
    JSON.stringify(router2.freshSessionsSnapshot().map(r => r.requestId)))
  const r8x = await router2.deliver({ requestId: 'req-X', agentId: agent.id, sessionMode: 'fresh', message: 'DELIVERY-X-3: confirm' })
  record('REQ8_FRESH_X_SAME_SESSION', r8x.sessionId === fx.sessionId, JSON.stringify(r8x))
  const r8m = await router2.deliver({ requestId: 'job-8', agentId: agent.id, sessionMode: 'main', message: 'DELIVERY-8: confirm' })
  record('REQ8_MAIN_STILL_MAIN', r8m.accepted === true && r8m.sessionId === 'main', JSON.stringify(r8m))
  const trajX8 = await waitForTrajectory(agent.id, fx.sessionId, 'DELIVERY-X-3')
  record('REQ8_FRESH_CONVERSATION_SURVIVES_CP_RESTART', trajX8.includes('DELIVERY-X') && trajX8.includes('DELIVERY-X-3'),
    'S1 conversation continues after the control-plane restart too')
  await ctx2.disposeAll()

  // -------------------------------------------------------------- report
  const evidence = [
    '# Agent Router Delivery V0 — real acceptance',
    '',
    `Run: ${new Date().toISOString()}`,
    `Runtime: ${RUNTIME}`,
    `Agent: ${agent.id} ("${AGENT_NAME}")`,
    `Profile: ${AGENT_PROFILE}`,
    `Sessions: main + fresh(${router2.freshSessionsSnapshot().map(r => r.sessionId).join(', ')})`,
    '',
    '## Checks',
    '',
    ...checks.map(c => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Key artifacts',
    '',
    `- Agent workspace: ${agentWorkspace(agent.id)}`,
    `- Agent home: ${agentHome(agent.id)}`,
    `- Binding + fresh-mapping store: ${BINDINGS_STORE}`,
    `- Registry store: ${REGISTRY_STORE}`,
    `- Main trajectory bytes: ${sessionTrajectory(agent.id, 'main').length}`,
    `- Fresh X trajectory bytes: ${sessionTrajectory(agent.id, fx.sessionId).length}`,
    '',
    '## Admission seam (inbox accept)',
    '',
    '- demo-server `session/prompt` responds with { messageId } only AFTER',
    '  `agent.followup()` synchronously enqueued the message into the DSH',
    '  native inbox (core/agent-loop/src/agent.ts `send()`: `inbox.splice()` +',
    '  `wakeDriver()`); the receipt IS the acceptance proof.',
    '- `AgentProcess.deliver()` resolves on that receipt only — no idle wait,',
    '  no event polling, no single-flight queue.',
    '- Router `deliver()` = ensureRunning(agentId) -> session resolution',
    '  (main fixed / fresh mapped by requestId) -> proc.deliver ->',
    '  `{ accepted: true, sessionId }` immediately.',
    '- No DSH Kernel/Core change; no Workflow / Forum / Team / Mailbox /',
    '  notification / scheduler semantics anywhere.',
    '',
  ].join('\n')
  const reportPath = join(RUNTIME, '..', 'evidence.md')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, evidence)
  console.log(`\nevidence written: ${reportPath}`)

  const allPass = checks.every(c => c.ok)
  process.exit(allPass ? 0 : 1)
}

main().catch((error) => {
  console.error(`[delivery-v0] infra failure: ${error?.stack ?? error}`)
  process.exit(2)
})
