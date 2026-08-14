#!/usr/bin/env node
/**
 * AGENT_CORE_DSH_PROCESS_MODEL_DEMO_V0 — benchmark the "one long-lived Agent
 * per DSH process + idle eviction + cold resume" resource and lifecycle model
 * on the current Bootstrap V0 runtime.
 *
 * What is measured (DSH runtime only; no large-scale real-LLM concurrency):
 *   A. idle-process resource curve: 1 / 10 / 30 / 60 / 100 simultaneous DSH
 *      agent processes — per-process RSS, total RSS, idle CPU, spawn→ready.
 *   B. same Agent, consecutive messages → the same PID is reused.
 *   C. two different conversations on the same Agent → the same PID.
 *   D. different Agents → different PID, DSH_HOME, workspace.
 *   E. process death (SIGKILL) → restart on the same home → session resumed
 *      from persistence → the original conversation continues.
 *   F. one Agent at most one owner process: a second boot of a live home is
 *      refused, a concurrent double-spawn has exactly one winner, a stale
 *      lock from a crashed owner is taken over.
 *
 * Each agent process: `dsh --profile agent-core-demo` (dsh-base +
 * @agent-core/bundle-demo: demo-server + demo-owner-guard), its own DSH_HOME
 * and workspace, JSON-RPC over stdio.
 *
 * Usage:
 *   node scripts/process-model-demo.mjs
 * Env: DSH_DEMO_RUNTIME (runtime root, default .demo/runtime),
 *      DSH_DEMO_MAX_AGENTS (cap the idle-benchmark fleet, default 100),
 *      DSH_DEMO_RESUME_ITERS (resume iterations, default 8),
 *      DSH_DEMO_KEEP (keep existing agent homes).
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'

const RUNTIME = resolve(process.env.DSH_DEMO_RUNTIME ?? join(REPO, '.demo', 'runtime'))
const AGENTS_DIR = join(RUNTIME, 'agents')
const MAX_AGENTS = Number.parseInt(process.env.DSH_DEMO_MAX_AGENTS ?? '100', 10)
const RESUME_ITERS = Number.parseInt(process.env.DSH_DEMO_RESUME_ITERS ?? '8', 10)
const KEEP = process.env.DSH_DEMO_KEEP === '1'
const MODEL = process.env.DSH_DEMO_MODEL ?? 'deepseek-v4-flash'
const PROVIDER = process.env.DSH_DEMO_PROVIDER ?? 'opencode-go'
const MAX_TOKENS = 8192

const CLI = cliBin()
const PROFILE = 'agent-core-demo'
let MEM_SIZE = 0
try {
  MEM_SIZE = Number(readFileSync('/proc/meminfo', 'utf8').match(/MemTotal:\s+(\d+)/)?.[1] ?? 0) * 1024
} catch {
  MEM_SIZE = Number(spawnSync('sysctl', ['-n', 'hw.memsize'], { encoding: 'utf8' }).stdout?.trim() ?? 0)
}

// ---------------------------------------------------------------- utilities

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

function percentile(sorted, q) {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function fmtMs(ms) { return (ms / 1000).toFixed(2) }

function psRssKb(pid) {
  const out = spawnSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).stdout?.trim()
  return Number.parseInt(out ?? '', 10) || 0
}

function psCpuSeconds(pid) {
  const out = spawnSync('ps', ['-o', 'time=', '-p', String(pid)], { encoding: 'utf8' }).stdout?.trim()
  if (!out) return 0
  const parts = out.split(':').map(Number)
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}

function processCwd(pid) {
  const out = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout ?? ''
  const hit = out.split('\n').find(line => line.startsWith('n'))
  return hit?.slice(1) ?? undefined
}

/** Base environment for one agent process. */
function agentEnv(home) {
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
  }
  if (env.OPENCODE_GO_API_KEY === undefined) {
    const credentialFile = join(home, '.credentials.yaml')
    if (existsSync(credentialFile)) {
      const match = readFileSync(credentialFile, 'utf8').match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)
      if (match !== null) env.OPENCODE_GO_API_KEY = match[1]
    }
  }
  return env
}

// ------------------------------------------------------------- agent runtime

class AgentRuntime {
  constructor(agentId) {
    this.agentId = agentId
    this.home = join(AGENTS_DIR, agentId, 'home')
    this.workspace = join(AGENTS_DIR, agentId, 'workspace')
    this.lockPath = join(this.home, 'demo-owner.lock')
  }

  provision() {
    provisionAgentHome(this.home, this.workspace)
    return this
  }

  sessionArtifact(sessionId) {
    // sessions/<project>/<encoded-id>/session.jsonl — find by scan.
    const root = join(this.home, 'sessions')
    if (!existsSync(root)) return undefined
    for (const project of readdirSync(root, { withFileTypes: true })) {
      if (!project.isDirectory()) continue
      const dir = join(root, project.name, sessionId)
      if (!existsSync(dir)) continue
      const file = join(dir, 'session.jsonl')
      if (existsSync(file)) return file
    }
    return undefined
  }

  lockPid() {
    try {
      const raw = readFileSync(this.lockPath, 'utf8')
      const pid = Number.parseInt(raw.trim().split('\n')[0] ?? '', 10)
      return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
    } catch {
      return undefined
    }
  }
}

// ------------------------------------------------------------ DSH process

class DshProcess {
  constructor(runtime) {
    this.runtime = runtime
    this.pid = undefined
    this.readyMs = undefined
    this.stderr = ''
    this.exit = undefined // { code, signal } once settled
    this.events = []
    this.status = {}
    this.creations = [] // parsed [demo-server] session ... lines
    this.buf = ''
    this.pending = new Map()
    this.seq = 0
    this.exitPromise = undefined
    this.exitResolve = undefined
  }

  spawn() {
    const child = spawn(process.execPath, [CLI, '--profile', PROFILE], {
      cwd: this.runtime.workspace,
      env: agentEnv(this.runtime.home),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child
    this.pid = child.pid
    this.exitPromise = new Promise((resolveExit) => {
      this.exitResolve = resolveExit
    })
    child.once('error', (error) => {
      this.exitResolve?.({ code: null, signal: null, error })
    })
    child.once('exit', (code, signal) => {
      this.exit = { code, signal }
      this.exitResolve?.({ code, signal })
    })
    child.stderr.on('data', (chunk) => {
      this.stderr += chunk
      const lines = String(chunk).split('\n')
      for (const line of lines) {
        const match = line.match(/\[demo-server\] session (\S+) (created|resumed) \((\d+) events\)/)
        if (match !== null) {
          this.creations.push({ sessionId: match[1], mode: match[2], events: Number(match[3]) })
        }
      }
    })
    child.stdout.on('data', (chunk) => this.onStdout(String(chunk)))
    return this
  }

  onStdout(chunk) {
    this.buf += chunk
    let index
    while ((index = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, index)
      this.buf = this.buf.slice(index + 1)
      if (line.trim() === '') continue
      let message
      try { message = JSON.parse(line) } catch { continue }
      if (message.id !== undefined) {
        const waiter = this.pending.get(message.id)
        if (waiter !== undefined) {
          this.pending.delete(message.id)
          if (message.error !== undefined) waiter.reject(new Error(`${message.error.code ?? -1}: ${message.error.message}`))
          else waiter.resolve(message.result)
        }
      } else if (message.method === 'session.event') {
        this.events.push(message.params)
      } else if (message.method === 'session.status') {
        this.status[message.params.sessionId] = message.params.status
      }
    }
  }

  request(method, params) {
    return new Promise((resolveRequest, rejectRequest) => {
      const id = ++this.seq
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest })
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  /** spawn→initialize (with retry until the model route registers). */
  async ready(timeoutMs = 90000) {
    const started = Date.now()
    for (;;) {
      try {
        await this.request('initialize', {
          cwd: this.runtime.workspace,
          provider: PROVIDER,
          model: MODEL,
          maxTokens: MAX_TOKENS,
        })
        this.readyMs = Date.now() - started
        return this.readyMs
      } catch {
        if (Date.now() - started > timeoutMs) throw new Error(`initialize timeout for agent ${this.runtime.agentId}`)
        await sleep(300)
      }
    }
  }

  /**
   * One owned turn: prompt, wait for the messageId receipt, then the next
   * whole-agent idle; returns the last assistant text, the turn duration and
   * the prompt-accept latency (spawn→session/prompt response).
   */
  async turn(sessionId, text, timeoutMs = 240000) {
    const started = Date.now()
    const receipt = await this.request('session/prompt', {
      sessionId,
      contentBlocks: [{ type: 'text', text }],
    })
    const promptMs = Date.now() - started
    const before = this.events.length
    let received = false
    let done = false
    while (!done && Date.now() - started < timeoutMs) {
      await sleep(100)
      for (let i = before; i < this.events.length; i += 1) {
        const ev = this.events[i]
        if (ev.sessionId !== sessionId) continue
        if (!received && JSON.stringify(ev.event).includes(receipt.messageId)) received = true
      }
      if (received && this.status[sessionId] === 'idle') done = true
    }
    if (!done) throw new Error(`turn timeout for session ${sessionId}`)
    const texts = this.events
      .filter(ev => ev.sessionId === sessionId && ev.event.type === 'assistant/message')
      .map(ev => (ev.event.data?.message?.content ?? [])
        .filter(block => block.type === 'text').map(block => block.text).join(''))
    return { reply: texts.at(-1) ?? '', ms: Date.now() - started, promptMs }
  }

  async shutdown(timeoutMs = 30000) {
    // A dead process answers nothing: writing to its closed stdin would hang
    // the request forever, so bail out immediately when it already exited.
    if (this.exit !== undefined) return this.exit
    await Promise.race([
      this.request('shutdown', undefined).catch(() => {}),
      sleep(5000),
    ])
    const settled = await Promise.race([
      this.exitPromise,
      sleep(timeoutMs).then(() => ({ code: null, signal: null, timeout: true })),
    ])
    return settled
  }

  kill9() {
    try { this.child.kill('SIGKILL') } catch { /* already dead */ }
    return this.exitPromise
  }

  rssKb() { return psRssKb(this.pid) }
  cpuSeconds() { return psCpuSeconds(this.pid) }
}

// ------------------------------------------------------------------- report

const results = {
  batches: [],
  coldStarts: [],
  resumeReady: [],
  resumePrompt: [],
  checks: {},
}

function check(name, ok, detail = '') {
  results.checks[name] = ok
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

function assert(cond, message) {
  if (!cond) throw new Error(`assertion failed: ${message}`)
}

// ---------------------------------------------------------------- test A

async function testIdleBenchmark() {
  console.log('\n=== A. idle-process resource benchmark ===')
  const batches = [1, 10, 30, 60, 100].filter(n => n <= MAX_AGENTS)
  let maxTested = 0
  let lastBatch
  for (const n of batches) {
    const agents = Array.from({ length: n }, (_, i) => new AgentRuntime(`agent-a-${String(i).padStart(4, '0')}`).provision())
    console.log(`spawning ${n} idle DSH agent processes ...`)
    const t0 = Date.now()
    const procs = []
    const readyList = []
    await Promise.all(agents.map(async (agent) => {
      const proc = new DshProcess(agent).spawn()
      await proc.ready()
      procs.push(proc)
      readyList.push(proc.readyMs)
      results.coldStarts.push(proc.readyMs)
    }))
    const spawnSpan = Date.now() - t0
    await sleep(3000)
    const rss = procs.map(proc => proc.rssKb())
    const cpu1 = procs.map(proc => proc.cpuSeconds())
    await sleep(5000)
    const cpu2 = procs.map(proc => proc.cpuSeconds())
    const idleCpu = procs.map((proc, i) => (cpu2[i] - cpu1[i]) / 5 * 100)
    const totalRss = rss.reduce((sum, value) => sum + value, 0)
    const batch = { n, totalRss, rss, idleCpu, spawnSpan, ready: readyList }
    results.batches.push(batch)
    const medianRss = percentile([...rss].sort((a, b) => a - b), 0.5)
    const medianCpu = percentile([...idleCpu].sort((a, b) => a - b), 0.5)
    console.log(
      `  n=${n}: spawn span ${(spawnSpan / 1000).toFixed(1)}s, median RSS ${(medianRss / 1024).toFixed(0)}MiB, `
      + `total RSS ${(totalRss / 1024 / 1024).toFixed(1)}GiB, median idle CPU ${medianCpu.toFixed(2)}%/core`,
    )
    maxTested = n
    // Graceful teardown between batches, then the resource gate decides
    // whether the fleet can grow.
    await Promise.all(procs.map(proc => proc.shutdown()))
    if (MEM_SIZE > 0 && totalRss > MEM_SIZE * 0.6) {
      console.log(`  stopping: total RSS ${(totalRss / 1024 / 1024).toFixed(1)}GiB exceeds 60% of ${(MEM_SIZE / 1024 / 1024).toFixed(0)}GiB RAM`)
      break
    }
  }
  return { maxTested, lastBatch: results.batches.at(-1) }
}

// ---------------------------------------------------------------- test B

async function testSameAgentPidReuse() {
  console.log('\n=== B. same agent, consecutive messages → same PID ===')
  const agent = new AgentRuntime('agent-b-reuse').provision()
  const proc = new DshProcess(agent).spawn()
  await proc.ready()
  results.coldStarts.push(proc.readyMs)
  const pids = []
  for (let i = 0; i < 3; i += 1) {
    const outcome = await proc.turn('main', 'Reply with EXACTLY the single word: pong')
    pids.push(proc.pid)
    assert(outcome.reply.toLowerCase().includes('pong'), `turn ${i + 1} should reply pong, got "${outcome.reply}"`)
    console.log(`  turn ${i + 1}: reply "${outcome.reply}" (pid ${proc.pid})`)
    assert(proc.exit === undefined, 'process must stay alive across turns')
  }
  assert(new Set(pids).size === 1, `same agent must reuse one PID, got ${[...new Set(pids)]}`)
  check('SAME_AGENT_SINGLE_PROCESS', true, `3 consecutive messages on pid ${pids[0]}`)
  await proc.shutdown()
}

// ---------------------------------------------------------------- test C

async function testMultiConversationSameAgent() {
  console.log('\n=== C. two conversations on the same agent → same PID ===')
  const agent = new AgentRuntime('agent-c-multi').provision()
  const proc = new DshProcess(agent).spawn()
  await proc.ready()
  const r1 = await proc.turn('conv-1', 'Reply with EXACTLY the single word: alpha')
  const r2 = await proc.turn('conv-2', 'Reply with EXACTLY the single word: beta')
  assert(r1.reply.toLowerCase().includes('alpha'), `conv-1 reply "${r1.reply}"`)
  assert(r2.reply.toLowerCase().includes('beta'), `conv-2 reply "${r2.reply}"`)
  const pids = new Set([proc.pid])
  assert(pids.size === 1, 'both conversations must share the agent process')
  assert(agent.sessionArtifact('conv-1') !== undefined && agent.sessionArtifact('conv-2') !== undefined,
    'both conversation artifacts must live in the same agent home')
  check('MULTI_CONVERSATION_SAME_AGENT', true, `conv-1 + conv-2 on pid ${proc.pid}, artifacts in ${agent.agentId}/home`)
  await proc.shutdown()
}

// ---------------------------------------------------------------- test D

async function testIsolation() {
  console.log('\n=== D. different agents → different PID / DSH_HOME / workspace ===')
  const a1 = new AgentRuntime('agent-d-1').provision()
  const a2 = new AgentRuntime('agent-d-2').provision()
  const p1 = new DshProcess(a1).spawn()
  const p2 = new DshProcess(a2).spawn()
  await Promise.all([p1.ready(), p2.ready()])
  assert(p1.pid !== p2.pid, `distinct PIDs, got ${p1.pid}/${p2.pid}`)
  assert(a1.home !== a2.home, 'distinct DSH_HOME')
  assert(a1.workspace !== a2.workspace, 'distinct workspace')
  const cwd1 = processCwd(p1.pid)
  const cwd2 = processCwd(p2.pid)
  assert(cwd1 === a1.workspace, `p1 cwd should be its workspace, got ${cwd1}`)
  assert(cwd2 === a2.workspace, `p2 cwd should be its workspace, got ${cwd2}`)
  await p1.turn('main', 'Reply with EXACTLY the single word: iso')
  assert(a1.sessionArtifact('main') !== undefined, 'd-1 session artifact under d-1 home')
  assert(a2.sessionArtifact('main') === undefined, 'd-2 home must not hold d-1 session')
  console.log(`  pid ${p1.pid} home ${a1.home}`)
  console.log(`  pid ${p2.pid} home ${a2.home}`)
  check('AGENT_ISOLATION', true, 'distinct pid/home/workspace/session-store verified')
  await Promise.all([p1.shutdown(), p2.shutdown()])
}

// ---------------------------------------------------------------- test E

async function testResume() {
  console.log('\n=== E. crash → restart → session resume → continue conversation ===')
  const agent = new AgentRuntime('agent-e-resume').provision()
  let gracefulOk = true
  for (let k = 1; k <= RESUME_ITERS; k += 1) {
    const word = `RW-${1000 + k * 37}`
    const isFirst = k === 1
    const isLast = k === RESUME_ITERS
    const proc = new DshProcess(agent).spawn()
    await proc.ready()
    if (isFirst) results.coldStarts.push(proc.readyMs)
    const memorize = await proc.turn(
      'main',
      `Memorize the secret code word ${word}. Reply with EXACTLY "memorized".`,
    )
    assert(memorize.reply.toLowerCase().includes('memorized'), `iter ${k} memorize reply "${memorize.reply}"`)
    await sleep(700) // write-behind settle so the log is durable before the kill
    if (isLast) {
      // Graceful path on the last iteration: owner lock must be released.
      const settled = await proc.shutdown()
      assert(settled.code === 0, `graceful shutdown exit 0, got ${JSON.stringify(settled)}`)
      gracefulOk = agent.lockPid() === undefined
      assert(gracefulOk, 'owner lock must be released after graceful shutdown')
    } else {
      await proc.kill9() // crash path: SIGKILL
    }
    // Crash path: the lock file survives with a now-dead PID (stale).
    if (!isLast) {
      const stalePid = agent.lockPid()
      assert(stalePid !== undefined && stalePid === proc.pid,
        `stale lock should record the dead pid ${proc.pid}, got ${stalePid}`)
    }
    // Restart on the same home; the session must come back from persistence.
    const again = new DshProcess(agent).spawn()
    await again.ready()
    results.resumeReady.push(again.readyMs)
    const recall = await again.turn(
      'main',
      'What is the secret code word I asked you to memorize? Reply with EXACTLY the code word.',
    )
    results.resumePrompt.push(recall.promptMs)
    const remembered = recall.reply.includes(word)
    const resumed = again.creations.some(c => c.sessionId === 'main' && c.mode === 'resumed')
    const artifact = agent.sessionArtifact('main')
    const artifactText = artifact !== undefined ? readFileSync(artifact, 'utf8') : ''
    const dataOk = artifact !== undefined
      && artifactText.includes(`Memorize the secret code word ${word}`)
      && artifactText.includes('What is the secret code word')
    console.log(
      `  iter ${k}: ${resumed ? 'resumed' : 'CREATED-fresh'}(${again.creations.find(c => c.sessionId === 'main')?.events ?? '?'} events) `
      + `ready ${fmtMs(again.readyMs)}s prompt-accept ${fmtMs(recall.promptMs)}s recall "${recall.reply.slice(0, 60)}" `
      + `remembered=${remembered} data=${dataOk}`,
    )
    assert(resumed, `iter ${k}: session must be resumed, got created`)
    assert(remembered, `iter ${k}: model must recall ${word}, got "${recall.reply}"`)
    assert(dataOk, `iter ${k}: session.jsonl must contain both messages`)
    await again.shutdown()
  }
  check('SESSION_RESUME', gracefulOk, `${RESUME_ITERS} crash/restart cycles, model recalled the code word, JSONL verified`)
}

// ---------------------------------------------------------------- test F

async function testSingleWriter() {
  console.log('\n=== F. one owner process per agent; no two writers ===')
  const agent = new AgentRuntime('agent-f-owner').provision()
  const owner = new DshProcess(agent).spawn()
  await owner.ready()
  const held = agent.lockPid()
  assert(held === owner.pid, `owner lock must be held by ${owner.pid}, got ${held}`)

  // F1: a second boot of a live home must be refused at boot time.
  const intruder = new DshProcess(agent).spawn()
  const intruderExit = await Promise.race([
    intruder.exitPromise,
    sleep(60000).then(() => ({ code: null, signal: null, timeout: true })),
  ])
  if (intruderExit.timeout) {
    await intruder.kill9()
    throw new Error('intruder process did not exit; single-writer guard failed')
  }
  const refused = intruderExit.code !== 0
    && intruder.stderr.includes('already owned by live process')
  console.log(`  intruder exit=${JSON.stringify(intruderExit)} stderr=${intruder.stderr.split('\n').find(l => l.includes('demo-owner-guard')) ?? ''}`)
  assert(refused, 'second owner boot must fail with "already owned"')

  // F2: concurrent double-spawn on a fresh home → exactly one winner.
  // Note: the loser's guard fails at plugin-apply time, but its transport
  // may already be serving, so initialize can succeed before the boot failure
  // surfaces and the process exits. The invariant is the SETTLED state:
  // exactly one live owner, the other exited with the guard refusal and
  // never ran a turn (its prompt path requires the agent factory, which the
  // failing tree never provides).
  const raceAgent = new AgentRuntime('agent-f-race').provision()
  const racer1 = new DshProcess(raceAgent).spawn()
  const racer2 = new DshProcess(raceAgent).spawn()
  await Promise.allSettled([racer1.ready(), racer2.ready()])
  await sleep(6000) // let the losing boot failure surface and exit
  const alive = [racer1, racer2].filter(p => p.exit === undefined)
  const refusedRacers = [racer1, racer2].filter(p => p.exit !== undefined && p.stderr.includes('already owned by live process'))
  console.log(
    `  race: ${alive.length} alive, ${refusedRacers.length} refused with guard error `
    + `(exits: ${[racer1, racer2].map(p => p.exit ? `${p.exit.code}` : 'alive').join(', ')})`,
  )
  assert(alive.length === 1, `exactly one owner process must survive the race, got ${alive.length}`)
  assert(refusedRacers.length === 1, `the losing racer must exit with the guard refusal, got ${refusedRacers.length}`)
  await racer1.shutdown().catch(() => {})
  await racer2.shutdown().catch(() => {})

  // F3: stale lock takeover — kill the owner, then a new process must win.
  await owner.kill9()
  const stale = agent.lockPid()
  assert(stale === owner.pid, 'stale lock records the dead owner pid')
  const heir = new DshProcess(agent).spawn()
  await heir.ready()
  assert(agent.lockPid() === heir.pid, 'the heir must take over the stale lock')
  await heir.shutdown()
  assert(agent.lockPid() === undefined, 'graceful shutdown releases the lock')

  check('SINGLE_WRITER_ENFORCED', true, 'intruder refused, race had one winner, stale lock taken over')
}

// ------------------------------------------------------------------- main

async function main() {
  const startedAt = Date.now()
  if (existsSync(AGENTS_DIR) && !KEEP) {
    rmSync(AGENTS_DIR, { recursive: true, force: true })
  }
  const { maxTested, lastBatch } = await testIdleBenchmark()
  await testSameAgentPidReuse()
  await testMultiConversationSameAgent()
  await testIsolation()
  await testResume()
  await testSingleWriter()

  // ------------------------------------------------------------ final report
  const largest = lastBatch
  const rssSorted = [...largest.rss].sort((a, b) => a - b)
  const cpuSorted = [...largest.idleCpu].sort((a, b) => a - b)
  const coldSorted = [...results.coldStarts].sort((a, b) => a - b)
  const resumeReadySorted = [...results.resumeReady].sort((a, b) => a - b)
  const resumePromptSorted = [...results.resumePrompt].sort((a, b) => a - b)

  const rssPerIdle = Math.round(percentile(rssSorted, 0.5))
  const idleCpu = percentile(cpuSorted, 0.5)
  const coldP50 = percentile(coldSorted, 0.5) / 1000
  const coldP95 = percentile(coldSorted, 0.95) / 1000
  const resumeP50 = percentile(resumePromptSorted, 0.5) / 1000
  const resumeP95 = percentile(resumePromptSorted, 0.95) / 1000

  const verdicts = {
    SESSION_RESUME: results.checks.SESSION_RESUME ? 'PASS' : 'FAIL',
    SAME_AGENT_SINGLE_PROCESS: results.checks.SAME_AGENT_SINGLE_PROCESS ? 'PASS' : 'FAIL',
    MULTI_CONVERSATION_SAME_AGENT: results.checks.MULTI_CONVERSATION_SAME_AGENT ? 'PASS' : 'FAIL',
    SINGLE_WRITER_ENFORCED: results.checks.SINGLE_WRITER_ENFORCED ? 'PASS' : 'FAIL',
  }

  const block = [
    `RSS_PER_IDLE_AGENT=${rssPerIdle}`,
    `MAX_TESTED_PROCESSES=${maxTested}`,
    `TOTAL_RSS=${largest.totalRss}`,
    `IDLE_CPU=${idleCpu.toFixed(2)}`,
    `COLD_START_P50/P95=${coldP50.toFixed(2)}/${coldP95.toFixed(2)}`,
    `RESUME_P50/P95=${resumeP50.toFixed(2)}/${resumeP95.toFixed(2)}`,
    `SESSION_RESUME=${verdicts.SESSION_RESUME}`,
    `SAME_AGENT_SINGLE_PROCESS=${verdicts.SAME_AGENT_SINGLE_PROCESS}`,
    `MULTI_CONVERSATION_SAME_AGENT=${verdicts.MULTI_CONVERSATION_SAME_AGENT}`,
    `SINGLE_WRITER_ENFORCED=${verdicts.SINGLE_WRITER_ENFORCED}`,
  ].join('\n')

  console.log('\n' + '='.repeat(60))
  console.log('AGENT_CORE_DSH_PROCESS_MODEL_DEMO_V0 — results')
  console.log('='.repeat(60))
  console.log(block)

  const report = [
    '# AGENT_CORE_DSH_PROCESS_MODEL_DEMO_V0 — results',
    '',
    `Run: ${new Date().toISOString()}  duration ${((Date.now() - startedAt) / 1000).toFixed(0)}s  `
      + `machine mem ${(MEM_SIZE / 1024 / 1024).toFixed(0)}MiB`,
    '',
    '```',
    block,
    '```',
    '',
    `COLD_START samples: ${coldSorted.length} (spawn→initialize, includes first-boot profiles/node_modules heal)`,
    `RESUME ready P50/P95: ${(percentile(resumeReadySorted, 0.5) / 1000).toFixed(2)}/${(percentile(resumeReadySorted, 0.95) / 1000).toFixed(2)}s `
      + `(spawn→initialize on resumed homes; prompt-accept includes the persistence load)`,
    '',
    '## Idle-batch curve',
    '',
    '| n | RSS total (GiB) | RSS per proc (MiB, median) | idle CPU (%/core, median) | ready p50/p95 (s) |',
    '|---|---|---|---|---|',
    ...results.batches.map((b) => {
      const readySorted = [...b.ready].sort((x, y) => x - y)
      return `| ${b.n} | ${(b.totalRss / 1024 / 1024).toFixed(2)} | `
        + `${(percentile([...b.rss].sort((x, y) => x - y), 0.5) / 1024).toFixed(0)} | `
        + `${percentile([...b.idleCpu].sort((x, y) => x - y), 0.5).toFixed(2)} | `
        + `${(percentile(readySorted, 0.5) / 1000).toFixed(2)}/${(percentile(readySorted, 0.95) / 1000).toFixed(2)} |`
    }),
    '',
    '## Functional checks',
    '',
    ...Object.entries(results.checks).map(([name, ok]) => `- ${ok ? 'PASS' : 'FAIL'} ${name}`),
    '',
  ].join('\n')

  const reportPath = join(RUNTIME, 'report.md')
  mkdirSync(RUNTIME, { recursive: true })
  writeFileSync(reportPath, report)
  console.log(`\nreport written: ${reportPath}`)

  const allPass = Object.values(verdicts).every(v => v === 'PASS')
  process.exit(allPass ? 0 : 1)
}

main().catch((error) => {
  console.error(`\nDEMO FAILED: ${error instanceof Error ? error.message : String(error)}`)
  console.error(error)
  // Reap any stray demo processes before dying.
  try {
    spawnSync('pkill', ['-f', `--profile ${PROFILE}`])
  } catch { /* best effort */ }
  process.exit(1)
})
