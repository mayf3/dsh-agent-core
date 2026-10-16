/**
 * Product #402 — MY_SESSIONS TEST_IDENTITY probe (round cap-20261016T102947Z-1200-c1).
 * Non-production isolated lane. Drives the REAL production composition seam
 * (createExecutionHistoryRuntime().mount(ctx) → executionHistoryAccess.handlers
 * ['agent_session_list'].list) plus the query core, over a planted fixture root
 * with test identities. Asserts: bounded self-only coordinate-only view,
 * identity boundaries, keyset pagination fail-closed, redaction sentinels,
 * zero write side-effects (full before/after inventory).
 * SOURCE under test: mayf3/dsh-agent-core main 0d3a2d6c (worktree src/).
 */
import { mkdirSync, writeFileSync, rmSync, readdirSync, lstatSync, statSync, readFileSync, symlinkSync, linkSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, 'src')
const { listAgentSessions } = await import(`${SRC}/packages/execution-history/src/index.js`)
const { createExecutionHistoryRuntime } = await import(`${SRC}/packages/production-runtime/src/execution-history/runtime.js`)

const LANE = '/tmp/p402-r1200c1-20261016/fixture'
const ROOT = join(LANE, 'root')
const HOMES = join(ROOT, 'homes')
const PROJ = '--p402-probe--'

const WF_ID = '99999999-9999-4999-8999-999999999999'
const OCC_ID = 'occ:0402deadbeef1234'
const FAKE_WF = '88888888-8888-4888-8888-888888888888'
const FAKE_OCC = 'occ:0bad0bad0bad0bad1'
const VICTIM_WF = '77777777-7777-4777-8777-777777777777'

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  PASS ${name}`) } else { fail += 1; failures.push(name); console.log(`  FAIL ${name} ${detail}`) }
}

// ── fixture build ─────────────────────────────────────────────────────────────
rmSync(LANE, { recursive: true, force: true })
const journal = (dir, events) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'session.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n')
}
const T = 1760000000000

// Caller under test: three own sessions (main / scheduler / other).
journal(join(HOMES, 'agt_p402_probe', 'sessions', PROJ, 'main'), [
  { type: 'session', version: 0, id: 'main', createdAt: T, cwd: '/tmp/p402-fixture-cwd' },
  { type: 'user/message', seq: 1, time: new Date(T + 10).toISOString(), data: { content: 'P402_SECRET private user text', source: { kind: 'user' } } },
  { type: 'user/message', seq: 2, time: new Date(T + 20).toISOString(), data: { content: `note quoting {"workflowInstanceId":"${FAKE_WF}"} and ${FAKE_OCC} in TEXT`, source: { kind: 'workflow_execution', workflowInstanceId: WF_ID, nodeVisitId: 'v1' } } },
  { type: 'tool/call', seq: 3, time: new Date(T + 30).toISOString(), data: { turn: 1, callId: 'c1', name: 'workflow_execute', arguments: JSON.stringify({ operation: 'transition', workflowInstanceId: WF_ID }) } },
])
journal(join(HOMES, 'agt_p402_probe', 'sessions', PROJ, 'cron-run-occ~003A0402deadbeef1234'), [
  { type: 'session', version: 0, id: 'cron-run-occ:0402deadbeef1234', createdAt: T + 100, cwd: '/tmp/hr' },
  { type: 'user/message', seq: 1, time: new Date(T + 110).toISOString(), data: { content: 'scheduled run body', source: { kind: 'user' } } },
])
journal(join(HOMES, 'agt_p402_probe', 'sessions', PROJ, 'team-sync'), [
  { type: 'session', version: 0, id: 'team-sync', createdAt: T + 200, cwd: '/tmp/team' },
  { type: 'user/message', seq: 1, time: new Date(T + 210).toISOString(), data: { content: 'hello teammate', source: { kind: 'inter_agent', sourceAgentId: 'agt_peer', correlation: 'te-1' } } },
])

// Victim (foreign) agent with secrets + its own coordinate.
const victimFile = join(HOMES, 'agt_p402_victim', 'sessions', '--victim--', 'main', 'session.jsonl')
journal(join(HOMES, 'agt_p402_victim', 'sessions', '--victim--', 'main'), [
  { type: 'session', version: 0, id: 'main', createdAt: T, cwd: '/victim' },
  { type: 'user/message', seq: 1, time: new Date(T + 5).toISOString(), data: { content: `P402_VICTIM secret {"workflowInstanceId":"${VICTIM_WF}"}`, source: { kind: 'user' } } },
])

// Attacks in the CALLER subtree: symlink + hardlink to the victim journal.
const callerProj = join(HOMES, 'agt_p402_probe', 'sessions', PROJ)
mkdirSync(join(callerProj, 'sneaky-symlink'), { recursive: true })
symlinkSync(victimFile, join(callerProj, 'sneaky-symlink', 'session.jsonl'))
mkdirSync(join(callerProj, 'sneaky-hardlink'), { recursive: true })
let hardlinkPlanted = false
try { linkSync(victimFile, join(callerProj, 'sneaky-hardlink', 'session.jsonl')); hardlinkPlanted = true } catch { /* cross-device */ }

// Root-substitution agent: sessions dir itself is a symlink into the victim tree.
mkdirSync(join(HOMES, 'agt_p402_subst'), { recursive: true })
symlinkSync(join(HOMES, 'agt_p402_victim', 'sessions'), join(HOMES, 'agt_p402_subst', 'sessions'), 'dir')

// ── zero-write inventory helpers ──────────────────────────────────────────────
import { readlinkSync } from 'node:fs'
function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}
function inventory(dir) {
  const out = []
  const walk = (p) => {
    const st = lstatSync(p)
    if (st.isDirectory()) {
      out.push(`D ${p} m=${st.mtimeMs} mode=${st.mode}`)
      for (const e of readdirSync(p)) walk(join(p, e))
    } else if (st.isSymbolicLink()) {
      out.push(`L ${p} target=${readlinkSync(p)}`)
    } else {
      out.push(`F ${p} sz=${st.size} m=${st.mtimeMs} mode=${st.mode} nlink=${st.nlink} sha=${sha256(p)}`)
    }
  }
  walk(dir)
  out.sort()
  return out
}

// ── provider-seam mount (REAL composition) ────────────────────────────────────
const layout = {
  homesRoot: HOMES,
  controlDir: join(ROOT, 'control'),
  historyDir: join(ROOT, 'scheduler', 'history'),
  jobsStore: join(ROOT, 'scheduler', 'jobs.json'),
  workflowExecutionDir: join(ROOT, 'workflow-execution'),
  evidenceLog: join(ROOT, 'control', 'runtime-evidence.jsonl'),
  turnRecoveryStore: join(ROOT, 'control', 'turn-recovery-v3.json'),
}
const runtime = createExecutionHistoryRuntime({ layout, credentialsFile: '/dev/null', authServiceOrigin: '', log: {} })
const providers = new Map()
runtime.mount({ provide: (k, v) => providers.set(k, v) })
const list = providers.get('executionHistoryAccess').handlers.agent_session_list.list
check('provider seam mounted: executionHistoryAccess.agent_session_list.list is a function', typeof list === 'function')
check('manifest trio registered on the provider', (() => {
  const h = providers.get('executionHistoryAccess').handlers
  return !!h.agent_session_list?.list && !!h.execution_trace_query?.query && !!h.execution_history_audit_query?.query
})())

const BEFORE = inventory(LANE)
const victimMtimeBefore = statSync(victimFile).mtimeMs

// ── 1. THE read path: one MY_SESSIONS call as the test identity ───────────────
console.log('\n[1] bounded view — MY_SESSIONS list as agt_p402_probe (provider seam)')
const out = await list({}, { agentId: 'agt_p402_probe' })
check('ok:true returned', out?.ok === true, JSON.stringify(out).slice(0, 200))
check('result.agentId = trusted caller', out.result?.agentId === 'agt_p402_probe')
const rows = out.result?.sessions ?? []
check('exactly the 3 own sessions', rows.length === 3, `got ${rows.length}: ${rows.map((r) => r.sessionId).join(',')}`)
const byId = Object.fromEntries(rows.map((r) => [r.sessionId, r]))
check('kinds main/scheduler/other', byId['main']?.kind === 'main' && byId['cron-run-occ:0402deadbeef1234']?.kind === 'scheduler' && byId['team-sync']?.kind === 'other')
check('main row origins.user=true', byId['main']?.origins?.user === true)
check('main row origins.workflow_execution=true', byId['main']?.origins?.workflow_execution === true)
check('main row carries exactly the real workflow coordinate', JSON.stringify(byId['main']?.workflowInstanceIds) === JSON.stringify([WF_ID]), JSON.stringify(byId['main']?.workflowInstanceIds))
check('cron row carries the occurrence coordinate derived from session id', JSON.stringify(byId['cron-run-occ:0402deadbeef1234']?.schedulerOccurrenceIds) === JSON.stringify([OCC_ID]), JSON.stringify(byId['cron-run-occ:0402deadbeef1234']?.schedulerOccurrenceIds))
check('team-sync row origins.inter_agent=true', byId['team-sync']?.origins?.inter_agent === true)
const rowKeys = rows.length ? Object.keys(rows[0]).sort().join(',') : ''
const EXPECTED_ROW_KEYS = ['sessionId', 'kind', 'createdAtUtc', 'lastActiveAtUtc', 'origins', 'schedulerOccurrenceIds', 'schedulerOccurrenceIdsTruncated', 'workflowInstanceIds', 'workflowInstanceIdsTruncated', 'scanTruncated'].sort().join(',')
check('row shape is coordinate-only', rowKeys === EXPECTED_ROW_KEYS, rowKeys)
check('timestamps present', typeof byId['main']?.createdAtUtc === 'string' && typeof byId['main']?.lastActiveAtUtc === 'string')
check('escape-hatch dirs never become rows', !rows.some((r) => r.sessionId.startsWith('sneaky-')))
check('no fleet index created by the listing', !statSyncSafe(join(layout.controlDir, 'execution-history-index')))

// ── 2. identity boundaries ────────────────────────────────────────────────────
console.log('\n[2] identity boundaries (fail-closed, self-only)')
const noId = await list({}, {})
check('missing trusted identity → forbidden_not_owner', noId?.ok === false && noId.error?.code === 'forbidden_not_owner', JSON.stringify(noId))
const badId = await list({}, { agentId: 'not-an-agent' })
check('invalid identity shape → forbidden_not_owner', badId?.ok === false && badId.error?.code === 'forbidden_not_owner')
const subst = listAgentSessions({ homesRoot: HOMES, viewerAgentId: 'agt_p402_subst' })
check('sessions-root symlink substitution → honest EMPTY listing', subst.ok === true && subst.result.sessions.length === 0, JSON.stringify(subst.result?.sessions?.length))
check('substitution leaks no victim data', !JSON.stringify(subst).includes('P402_VICTIM') && !JSON.stringify(subst).includes(VICTIM_WF))
const missingHomes = listAgentSessions({ homesRoot: join(LANE, 'nope'), viewerAgentId: 'agt_p402_probe' })
check('missing homes root → history_unavailable', missingHomes.ok === false && missingHomes.code === 'history_unavailable')

// ── 3. pagination fail-closed + keyset determinism ────────────────────────────
console.log('\n[3] pagination (fail-closed validation, deterministic keyset)')
for (const bad of [{ limit: 0 }, { limit: 201 }, { limit: '10' }, { limit: null }, { cursor: 5 }, { cursor: '' }, { unknown: 1 }]) {
  const r = await list(bad, { agentId: 'agt_p402_probe' })
  check(`invalid args ${JSON.stringify(bad)} → invalid_arguments`, r?.ok === false && r.error?.code === 'invalid_arguments')
}
const p1 = await list({ limit: 1 }, { agentId: 'agt_p402_probe' })
check('limit=1 → one row + truncated=true + nextCursor', p1.ok === true && p1.result.sessions.length === 1 && p1.result.truncated === true && typeof p1.result.nextCursor === 'string')
const p2 = await list({ cursor: p1.result.nextCursor }, { agentId: 'agt_p402_probe' })
check('page 2 completes the set, no overlap', p2.ok === true && p2.result.sessions.length === 2 && p2.result.truncated === false && p2.result.nextCursor === null)
check('pages compose to the full owned set', [...p1.result.sessions.map((s) => s.sessionId), ...p2.result.sessions.map((s) => s.sessionId)].sort().join(',') === ['cron-run-occ:0402deadbeef1234', 'main', 'team-sync'].sort().join(','))
const nanCur = await list({ cursor: 'TmFOOm1haW4' }, { agentId: 'agt_p402_probe' })
check('non-finite cursor timestamp → invalid_arguments (never a repeating page)', nanCur.ok === false && nanCur.error?.code === 'invalid_arguments')

// ── 4. redaction sweep over every output above ───────────────────────────────
console.log('\n[4] redaction / coordinate-only boundary (whole-output sentinel scan)')
const everything = JSON.stringify({ out, noId, badId, subst, missingHomes, p1, p2, nanCur })
for (const sentinel of ['P402_SECRET', 'P402_VICTIM', VICTIM_WF, FAKE_WF, FAKE_OCC, 'victim', 'private user text', 'scheduled run body', 'hello teammate', 'session.jsonl', '/tmp/p402-fixture-cwd', 'workflow_execute', 'agt_p402_victim']) {
  check(`output free of ${JSON.stringify(sentinel.slice(0, 24))}`, !everything.includes(sentinel))
}

// ── 5. zero unintended writes ────────────────────────────────────────────────
console.log('\n[5] zero write side-effects (full fixture inventory before/after)')
const AFTER = inventory(LANE)
check(`inventory byte-identical (${BEFORE.length} entries)`, BEFORE.length === AFTER.length && BEFORE.every((v, i) => v === AFTER[i]),
  BEFORE.length === AFTER.length ? BEFORE.map((v, i) => v !== AFTER[i] ? `first diff @${i}: ${v} vs ${AFTER[i]}` : '').filter(Boolean)[0] ?? '' : `count ${BEFORE.length}→${AFTER.length}`)
check('victim journal mtime untouched', statSync(victimFile).mtimeMs === victimMtimeBefore)
check('hardlink attack was actually planted (test validity)', hardlinkPlanted)

console.log(`\n=== PROBE RESULT: ${pass} PASS / ${fail} FAIL ===`)
if (failures.length) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1) }

function statSyncSafe(p) { try { return statSync(p).isDirectory() } catch { return false } }
