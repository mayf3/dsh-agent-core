#!/usr/bin/env node
/**
 * AGENT_CORE_AGENT_SESSION_V1_POC — prove the Agent Core product Session model
 * on DSH native sessions (Agent Session V1).
 *
 * Thesis under test:
 *
 *   Agent Core product Session == DSH native session. No mapping layer.
 *   One Agent = one DSH process = one DSH_HOME + one workspace; every product
 *   session id (including the literal "main") is a DSH SessionId, persisted as
 *   <home>/sessions/<project>/<id>/session.jsonl.
 *
 * Scenario (D-002 frozen model):
 *
 *   Agent A
 *   ├─ main      — the preset long-lived main session, exactly one per agent
 *   └─ normal-1  — an on-demand normal session
 *
 * Steps:
 *   1. boot 1 (new PID): write codeword A into `main`, codeword B into
 *      `normal-1` (real LLM turns). Assert both trajectories live under the
 *      SAME agent home, in DISTINCT artifact files, each containing only its
 *      own codeword (data-level isolation already at boot 1).
 *   2. kill -9 the DSH process (crash path, no graceful flush).
 *   3. boot 2 (new PID): resume `main` and `normal-1` from persistence.
 *      Assert each session recalls ONLY its own codeword, knows nothing of the
 *      other's, both log `resumed` (not `created`), the resumed trajectories
 *      keep appending, and exactly one `main` artifact exists in the home.
 *
 * The driver reuses the production client (`AgentProcess` from
 * packages/agent-router/src/process.js — the exact code path Integration V1's
 * Router uses to talk to per-agent DSH processes). The PoC adds zero
 * components and changes zero DSH code.
 *
 * Usage:
 *   node scripts/agent-session-v1-poc.mjs
 * Env: DSH_ASV1_RUNTIME (runtime root, default <repo>/.demo/agent-session-v1/runtime),
 *      DSH_ASV1_KEEP=1 (keep an existing runtime instead of wiping it).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { REPO, provisionAgentHome } from './demo-home.mjs'
import { AgentProcess } from '../packages/agent-router/src/process.js'

const RUNTIME = resolve(process.env.DSH_ASV1_RUNTIME ?? join(REPO, '.demo', 'agent-session-v1', 'runtime'))
const AGENT = 'agent-a'
const HOME = join(RUNTIME, 'agents', AGENT, 'home')
const WORKSPACE = join(RUNTIME, 'agents', AGENT, 'workspace')
const PROFILE = 'agent-core-demo'
const KEEP = process.env.DSH_ASV1_KEEP === '1'
const LOCK = join(HOME, 'demo-owner.lock')

const sleep = (ms) => new Promise((resolveTimeout) => setTimeout(resolveTimeout, ms))
const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase()

// Two distinct codewords: only `main` may know MAIN_WORD, only `normal-1` may
// know NORMAL_WORD. The collision-free suffix keeps stale runs from passing.
const MAIN_WORD = `ASV1-MAIN-${rand()}`
const NORMAL_WORD = `ASV1-N1-${rand()}`

const results = { checks: {} }

function check(name, ok, detail = '') {
  results.checks[name] = ok
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

function assert(cond, message) {
  if (!cond) throw new Error(`assertion failed: ${message}`)
}

/** Scan <home>/sessions/<project>/<id>/session.jsonl — mirrors persistence.list(). */
function sessionArtifacts(home) {
  const root = join(home, 'sessions')
  if (!existsSync(root)) return []
  const out = []
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

const textOf = (file) => readFileSync(file, 'utf8')
const has = (haystack, needle) => haystack.toUpperCase().includes(needle.toUpperCase())

function newProcess() {
  return new AgentProcess({
    agentId: AGENT,
    home: HOME,
    workspace: WORKSPACE,
    profile: PROFILE,
    log: console,
  })
}

/**
 * Graceful JSON-RPC shutdown for the PoC's own cleanup. This does NOT use
 * `AgentProcess.shutdown()`: that method's timeout race relies on
 * `setTimeout(...).then(...)`, which is invalid on modern Node (a Timeout is
 * not a Promise) — a pre-existing bug in packages/agent-router/src/process.js
 * that this round must not modify (strict boundary). It is recorded as an
 * Integration need in docs/history/reports/agent-session-v1.md instead.
 */
async function gracefulShutdown(proc, timeoutMs = 30000) {
  if (proc.exit !== undefined) return proc.exit
  await Promise.race([
    proc.request('shutdown', undefined).catch(() => {}),
    sleep(5000),
  ])
  const deadline = Date.now() + timeoutMs
  while (proc.exit === undefined && Date.now() < deadline) await sleep(100)
  return proc.exit
}

async function main() {
  const startedAt = Date.now()
  if (existsSync(RUNTIME) && !KEEP) rmSync(RUNTIME, { recursive: true, force: true })
  provisionAgentHome(HOME, WORKSPACE)

  let p1
  let p2
  try {
    // ------------------------------------------------------------- boot 1
    console.log(`\n=== boot 1: create sessions (codewords ${MAIN_WORD} / ${NORMAL_WORD}) ===`)
    p1 = newProcess()
    p1.spawn()
    await p1.ready()
    const pid1 = p1.pid
    console.log(`  agent ${AGENT} ready pid=${pid1}`)

    const m1 = await p1.turn(
      'main',
      `Memorize the secret code word ${MAIN_WORD}. Reply with EXACTLY "memorized".`,
    )
    assert(has(m1.reply, 'memorized'), `main memorize reply "${m1.reply}"`)
    console.log(`  main: "${m1.reply.slice(0, 60)}"`)

    const n1 = await p1.turn(
      'normal-1',
      `Memorize the secret code word ${NORMAL_WORD}. Reply with EXACTLY "memorized".`,
    )
    assert(has(n1.reply, 'memorized'), `normal-1 memorize reply "${n1.reply}"`)
    console.log(`  normal-1: "${n1.reply.slice(0, 60)}"`)

    // Both artifacts must exist under the SAME home, as distinct files.
    const boot1Artifacts = sessionArtifacts(HOME)
    const mainArt = boot1Artifacts.find(a => a.id === 'main')
    const normalArt = boot1Artifacts.find(a => a.id === 'normal-1')
    assert(mainArt !== undefined, 'main artifact exists in agent-a home')
    assert(normalArt !== undefined, 'normal-1 artifact exists in agent-a home')
    assert(mainArt.file !== normalArt.file, 'main and normal-1 are distinct artifact files')
    results.mainArtifact = mainArt.file
    results.normalArtifact = normalArt.file

    // Data-level isolation at boot 1: each log contains only its own codeword.
    const mainText = textOf(mainArt.file)
    const normalText = textOf(normalArt.file)
    assert(has(mainText, MAIN_WORD), 'main log contains its own codeword')
    assert(!has(mainText, NORMAL_WORD), 'main log must not contain normal-1 codeword')
    assert(has(normalText, NORMAL_WORD), 'normal-1 log contains its own codeword')
    assert(!has(normalText, MAIN_WORD), 'normal-1 log must not contain main codeword')
    check('BOOT1_TWO_SESSIONS_CREATED', true,
      `main + normal-1 created on pid ${pid1}, artifacts under ${join(HOME, 'sessions')}`)
    check('BOOT1_DATA_ISOLATION', true, 'each jsonl contains only its own codeword')

    // Write-behind settle so both logs are durable before the crash.
    await sleep(1000)

    // ------------------------------------------------------------ crash
    console.log(`\n=== crash: kill -9 ${pid1} ===`)
    await p1.kill9()
    console.log('  process dead (no graceful shutdown, no flush)')

    // ------------------------------------------------------------- boot 2
    console.log('\n=== boot 2: resume both sessions from persistence ===')
    p2 = newProcess()
    p2.spawn()
    await p2.ready()
    const pid2 = p2.pid
    assert(pid2 !== pid1, `boot 2 must run in a new PID, got ${pid2} == ${pid1}`)
    console.log(`  agent ${AGENT} ready pid=${pid2} (new PID)`)

    const recallMain = await p2.turn(
      'main',
      'What is the secret code word in this session? Reply with EXACTLY the code word and nothing else.',
    )
    const recallNormal = await p2.turn(
      'normal-1',
      'What is the secret code word in this session? Reply with EXACTLY the code word and nothing else.',
    )

    // main remembers ONLY main; normal-1 remembers ONLY normal-1.
    assert(has(recallMain.reply, MAIN_WORD), `main recall "${recallMain.reply.slice(0, 80)}" lacks ${MAIN_WORD}`)
    assert(!has(recallMain.reply, NORMAL_WORD), `main recall leaked ${NORMAL_WORD}: "${recallMain.reply.slice(0, 80)}"`)
    assert(has(recallNormal.reply, NORMAL_WORD), `normal-1 recall "${recallNormal.reply.slice(0, 80)}" lacks ${NORMAL_WORD}`)
    assert(!has(recallNormal.reply, MAIN_WORD), `normal-1 recall leaked ${MAIN_WORD}: "${recallNormal.reply.slice(0, 80)}"`)
    console.log(`  main recall:     "${recallMain.reply.slice(0, 80)}"`)
    console.log(`  normal-1 recall: "${recallNormal.reply.slice(0, 80)}"`)

    // Both must RESUME (not create) — the identity came back from the log.
    const resumedMain = p2.creations.find(c => c.sessionId === 'main')
    const resumedNormal = p2.creations.find(c => c.sessionId === 'normal-1')
    assert(resumedMain?.mode === 'resumed', `main must resume, got ${JSON.stringify(resumedMain)}`)
    assert(resumedNormal?.mode === 'resumed', `normal-1 must resume, got ${JSON.stringify(resumedNormal)}`)
    check('RESUME_MAIN_ISOLATED', true,
      `main resumed (${resumedMain.events} events, pid ${pid2}) recalls ONLY ${MAIN_WORD}`)
    check('RESUME_NORMAL1_ISOLATED', true,
      `normal-1 resumed (${resumedNormal.events} events, pid ${pid2}) recalls ONLY ${NORMAL_WORD}`)

    // Post-resume artifacts: still exactly one `main` + one `normal-1`, and the
    // resumed trajectories kept appending (the recall question is now in them).
    const boot2Artifacts = sessionArtifacts(HOME)
    const mainCount = boot2Artifacts.filter(a => a.id === 'main').length
    const normalCount = boot2Artifacts.filter(a => a.id === 'normal-1').length
    assert(mainCount === 1, `exactly one main artifact, got ${mainCount}`)
    assert(normalCount === 1, `exactly one normal-1 artifact, got ${normalCount}`)
    const mainText2 = textOf(boot2Artifacts.find(a => a.id === 'main').file)
    const normalText2 = textOf(boot2Artifacts.find(a => a.id === 'normal-1').file)
    assert(has(mainText2, 'What is the secret code word'), 'main log appended after resume')
    assert(!has(mainText2, NORMAL_WORD), 'main log still free of normal-1 codeword after resume')
    assert(has(normalText2, 'What is the secret code word'), 'normal-1 log appended after resume')
    assert(!has(normalText2, MAIN_WORD), 'normal-1 log still free of main codeword after resume')
    check('EXACTLY_ONE_MAIN', true, 'one main artifact after crash+restart (identity, not a copy)')
    check('APPEND_AFTER_RESUME', true, 'both resumed trajectories keep appending in the same files')

    // Graceful shutdown releases the owner lock.
    const settled = await gracefulShutdown(p2)
    assert(settled?.code === 0, `graceful shutdown exit 0, got ${JSON.stringify(settled)}`)
    const lockAfter = existsSync(LOCK) ? readFileSync(LOCK, 'utf8').trim().split('\n')[0] : undefined
    assert(lockAfter === undefined, `owner lock must be released, still holds ${lockAfter}`)
    check('GRACEFUL_SHUTDOWN', true, `pid ${pid2} exited 0, owner lock released`)

    // ------------------------------------------------------------ report
    const report = [
      '# AGENT_CORE_AGENT_SESSION_V1_POC — results',
      '',
      `Run: ${new Date().toISOString()}  duration ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
      `Codewords: main=${MAIN_WORD} normal-1=${NORMAL_WORD}`,
      `Agent home: ${HOME}`,
      '',
      '```',
      ...[
        `BOOT1_MAIN_CREATED=main (pid ${p1.pid})`,
        `BOOT1_NORMAL1_CREATED=normal-1 (pid ${p1.pid})`,
        `CRASH=kill -9 ${p1.pid}`,
        `BOOT2_PID=${p2.pid} (new PID: ${p2.pid !== p1.pid})`,
        `MAIN_RESUMED_EVENTS=${resumedMain.events}`,
        `NORMAL1_RESUMED_EVENTS=${resumedNormal.events}`,
        ...Object.entries(results.checks).map(([name, ok]) => `${name}=${ok ? 'PASS' : 'FAIL'}`),
      ].join('\n'),
      '```',
      '',
      '## Artifacts',
      '',
      `- main: \`${results.mainArtifact}\``,
      `- normal-1: \`${results.normalArtifact}\``,
      '',
      '## Checks',
      '',
      ...Object.entries(results.checks).map(([name, ok]) => `- ${ok ? 'PASS' : 'FAIL'} ${name}`),
      '',
    ].join('\n')
    mkdirSync(RUNTIME, { recursive: true })
    writeFileSync(join(RUNTIME, 'report.md'), report)
    console.log(`\nreport written: ${join(RUNTIME, 'report.md')}`)

    const allPass = Object.values(results.checks).every(v => v === true)
    process.exit(allPass ? 0 : 1)
  } catch (error) {
    console.error(`\nPOC FAILED: ${error instanceof Error ? error.message : String(error)}`)
    console.error(error)
    // Reap only the processes this driver owns.
    for (const proc of [p1, p2]) {
      if (proc !== undefined && proc.exit === undefined) {
        try { proc.kill9() } catch { /* best effort */ }
      }
    }
    process.exit(1)
  }
}

main()
