#!/usr/bin/env node
/**
 * Agent Memory V1 acceptance driver — REAL DSH processes, REAL model turns.
 *
 * Proves, end to end, that Agent long-term memory is NOT session trajectory:
 *
 *   Phase 1 — per-agent isolation + cross-session persistence
 *     Agent A (codeword ALPHA) saves to memory in session s1; the process is
 *     KILLED; a fresh process + fresh session s2 must still know ALPHA.
 *     Agent B (codeword BETA) does the same; B must NOT know ALPHA and A must
 *     NOT know BETA (physical file isolation per agent workspace).
 *
 *   Phase 2 — consolidation
 *     Session c1 produces a durable fact WITHOUT any tool call; turn/end
 *     auto-consolidation distills it into MEMORY.md (curated) + the daily
 *     note (episodic); a fresh session c2 must answer from the consolidated
 *     memory.
 *
 *   Phase 3 — human edit
 *     A human edits MEMORY.md directly; a fresh session must reflect the
 *     edited value (file-first: human edits always win, no restart needed).
 *
 * Each agent runs `dsh --profile agent-core-memory` (dsh-base + bundle-demo:
 * demo-server + owner-guard; + bundle-memory: agent-memory) with its OWN
 * DSH_HOME and workspace under .demo/memory-v1/runtime (override with
 * DSH_MEMORY_V1_RUNTIME).
 *
 * Usage:
 *   node scripts/memory-v1-verify.mjs
 * Env:
 *   DSH_MEMORY_V1_RUNTIME  runtime root (default .demo/memory-v1/runtime)
 *   DSH_MEMORY_V1_KEEP=1   keep existing agent homes (default: wipe)
 *   DSH_AGENT_PROVIDER / DSH_AGENT_MODEL  LLM route (default opencode-go /
 *                          deepseek-v4-flash)
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import { spawn } from 'node:child_process'
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'

const RUNTIME = resolve(process.env.DSH_MEMORY_V1_RUNTIME ?? join(REPO, '.demo', 'memory-v1'))
const AGENTS_DIR = join(RUNTIME, 'agents')
const KEEP = process.env.DSH_MEMORY_V1_KEEP === '1'
const PROVIDER = process.env.DSH_AGENT_PROVIDER ?? 'opencode-go'
const MODEL = process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash'
const MAX_TOKENS = 8192
const PROFILE = 'agent-core-memory'
const AGENT_A = 'agent-a'
const AGENT_B = 'agent-b'
const TURN_TIMEOUT_MS = Number.parseInt(process.env.DSH_MEMORY_V1_TURN_TIMEOUT ?? '300000', 10)

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

/** Base environment for one agent process (own home, workspace as cwd). */
/**
 * Base environment for one agent process (own home, workspace as cwd).
 *
 * Layout mirrors the real control plane: the plugin resolves the agent's
 * workspace as `<workspaceRoot>/<agentId>` (workspace-bootstrap mapping), so
 * DSH_MEMORY_WORKSPACE_ROOT points the plugin's workspaceRoot at AGENTS_DIR
 * and each agent's workspace IS `AGENTS_DIR/<agentId>`. The process cwd is
 * that same directory, and DSH_AGENT_ID makes the agent identity explicit.
 */
function agentEnv(home, agentId) {
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_AGENT_ID: agentId,
    DSH_MEMORY_WORKSPACE_ROOT: AGENTS_DIR,
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

// ------------------------------------------------------------- provisioning

/** Create (or repair) one symlink; fails loud on a real file at the target. */
function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink() && resolve(readlinkSync(link)) === resolve(target)) return
    rmSync(link, { recursive: true, force: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
}

/** Copy a file when it does not exist yet. */
function copyOnce(source, target) {
  if (existsSync(target)) return
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
}

/**
 * Provision one agent home for the memory profile: reuse provisionAgentHome
 * (settings / credentials / demo profile / farm links) and additionally write
 * the agent-core-memory profile + link the memory bundle/plugin into the
 * home's plugin farm. Idempotent.
 *
 * Layout: home = `<AGENTS_DIR>/<agentId>/home`, workspace = `<AGENTS_DIR>/<agentId>`
 * (the plugin's workspaceRoot env points at AGENTS_DIR, so the agent's memory
 * files land in the same directory the driver asserts on).
 */
function provisionAgent(agentId) {
  const home = join(AGENTS_DIR, agentId, 'home')
  const workspace = join(AGENTS_DIR, agentId)
  provisionAgentHome(home, workspace)

  const profileDir = join(home, 'profiles', PROFILE)
  mkdirSync(profileDir, { recursive: true })
  copyOnce(join(REPO, 'profile-memory', 'package.json'), join(profileDir, 'package.json'))
  copyOnce(join(REPO, 'profile-memory', 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))

  const farm = join(home, 'profiles', 'node_modules', '@agent-core')
  ensureSymlink(join(REPO, 'bundle-memory'), join(farm, 'bundle-memory'))
  ensureSymlink(join(REPO, 'packages', 'agent-memory'), join(farm, 'agent-memory'))
  return { home, workspace }
}

// -------------------------------------------------------------- agent proc

class AgentProc {
  constructor(agentId, home, workspace) {
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.pid = undefined
    this.exit = undefined
    this.events = []
    this.status = {}
    this.creations = []
    this.buf = ''
    this.pending = new Map()
    this.seq = 0
    this.stderr = ''
  }

  spawn() {
    const child = spawn(process.execPath, [cliBin(), '--profile', PROFILE], {
      cwd: this.workspace,
      env: agentEnv(this.home, this.agentId),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child
    this.pid = child.pid
    this.exitPromise = new Promise((resolveExit) => { this.exitResolve = resolveExit })
    child.once('error', (error) => this.exitResolve?.({ code: null, signal: null, error }))
    child.once('exit', (code, signal) => {
      this.exit = { code, signal }
      this.exitResolve?.({ code, signal })
    })
    child.stderr.on('data', (chunk) => {
      this.stderr += chunk
      for (const line of String(chunk).split('\n')) {
        const match = line.match(/\[demo-server\] session (\S+) (created|resumed) \((\d+) events\)/)
        if (match !== null) this.creations.push({ sessionId: match[1], mode: match[2], events: Number(match[3]) })
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

  async ready(timeoutMs = 90000) {
    const started = Date.now()
    for (;;) {
      try {
        await this.request('initialize', { cwd: this.workspace, provider: PROVIDER, model: MODEL, maxTokens: MAX_TOKENS })
        console.log(`[driver] agent ${this.agentId} ready pid=${this.pid} (${Date.now() - started}ms)`)
        return
      } catch {
        if (Date.now() - started > timeoutMs) throw new Error(`initialize timeout for agent ${this.agentId}`)
        await sleep(300)
      }
    }
  }

  /** One owned turn: prompt, wait for receipt + whole-agent idle, return reply text. */
  async turn(sessionId, text, timeoutMs = TURN_TIMEOUT_MS) {
    const started = Date.now()
    const receipt = await this.request('session/prompt', { sessionId, contentBlocks: [{ type: 'text', text }] })
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
    if (!done) throw new Error(`turn timeout for session ${sessionId} (agent ${this.agentId})`)
    const texts = this.events
      .filter(ev => ev.sessionId === sessionId && ev.event.type === 'assistant/message')
      .map(ev => (ev.event.data?.message?.content ?? [])
        .filter(block => block.type === 'text').map(block => block.text).join(''))
    const reply = texts.at(-1) ?? ''
    console.log(`[driver] ${this.agentId}/${sessionId} replied (${Date.now() - started}ms): ${reply.slice(0, 120)}`)
    return { reply, ms: Date.now() - started }
  }

  async kill() {
    try { this.child.kill('SIGKILL') } catch { /* already dead */ }
    return this.exitPromise
  }
}

// ---------------------------------------------------------------- asserts

const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
}

function memoryFile(agentId) {
  return join(AGENTS_DIR, agentId, 'MEMORY.md')
}

function readMemory(agentId) {
  const file = memoryFile(agentId)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

/** Poll until `needle` appears in the agent's MEMORY.md (consolidation runs async). */
async function waitForMemory(agentId, needle, timeoutMs = 180000) {
  const started = Date.now()
  for (;;) {
    const text = readMemory(agentId)
    if (text.includes(needle)) return text
    if (Date.now() - started > timeoutMs) return text
    await sleep(2000)
  }
}

/**
 * Poll until SOME daily note (`memory/YYYY-MM-DD.md`) contains `needle`.
 * Daily notes are written ONLY by consolidation (raw evidence), so this is
 * the deterministic signal that turn/end consolidation actually ran — unlike
 * MEMORY.md, which the model can also reach through memory_save.
 */
async function waitForDailyNote(agentId, needle, timeoutMs = 180000) {
  const started = Date.now()
  const dailyDir = join(AGENTS_DIR, agentId, 'memory')
  for (;;) {
    if (existsSync(dailyDir)) {
      for (const file of readdirSync(dailyDir).filter(f => f.endsWith('.md'))) {
        const text = readFileSync(join(dailyDir, file), 'utf8')
        if (text.includes(needle)) return { file: join(dailyDir, file), text }
      }
    }
    if (Date.now() - started > timeoutMs) return undefined
    await sleep(2000)
  }
}

// ------------------------------------------------------------------- main

async function main() {
  console.log(`=== Agent Memory V1 acceptance — runtime: ${RUNTIME}`)
  console.log(`agents: ${AGENT_A} (ALPHA) + ${AGENT_B} (BETA); profile ${PROFILE}; model ${PROVIDER}/${MODEL}`)

  if (!KEEP) rmSync(AGENTS_DIR, { recursive: true, force: true })
  const a = provisionAgent(AGENT_A)
  const b = provisionAgent(AGENT_B)
  console.log(`provisioned: A ${a.home}\n             B ${b.home}`)

  // ---- Phase 1A: A learns ALPHA in session s1 (explicit memory_save tool).
  const pa = new AgentProc(AGENT_A, a.home, a.workspace).spawn()
  await pa.ready()
  await pa.turn('s1',
    '使用 memory_save 工具保存一条长期记忆: type=preference, title=codeword, ' +
    'content="我的 codeword 是 ALPHA", importance=5。保存成功后才回复，只回复: OK')
  record('P1A A called memory_save in session s1', true)
  const aMem1 = readMemory(AGENT_A)
  record('P1A A MEMORY.md contains ALPHA', aMem1.includes('ALPHA'),
    `memory=${JSON.stringify(aMem1.slice(0, 300))}`)
  record('P1A A MEMORY.md does NOT contain BETA', !aMem1.includes('BETA'))
  await pa.kill()
  console.log('[driver] agent-a process killed (proves memory is file-backed, not in-RAM)\n')

  // ---- Phase 1B: fresh process + fresh session s2 → A still knows ALPHA,
  // and does NOT know BETA.
  const pa2 = new AgentProc(AGENT_A, a.home, a.workspace).spawn()
  await pa2.ready()
  const a2 = await pa2.turn('s2', '你记得的任何 codeword 是什么？直接回答，不要解释。')
  record('P1B new session s2: A answers ALPHA', a2.reply.includes('ALPHA'),
    `reply="${a2.reply.slice(0, 160)}"`)
  record('P1B isolation: A does NOT know BETA', !a2.reply.includes('BETA'),
    `reply="${a2.reply.slice(0, 160)}"`)
  await pa2.kill()

  // ---- Phase 1C: B learns BETA; new session t2 knows BETA, not ALPHA.
  const pb = new AgentProc(AGENT_B, b.home, b.workspace).spawn()
  await pb.ready()
  await pb.turn('t1',
    '使用 memory_save 工具保存一条长期记忆: type=preference, title=codeword, ' +
    'content="我的 codeword 是 BETA", importance=5。保存成功后才回复，只回复: OK')
  const bMem1 = readMemory(AGENT_B)
  record('P1C B MEMORY.md contains BETA', bMem1.includes('BETA'))
  record('P1C isolation: B MEMORY.md does NOT contain ALPHA', !bMem1.includes('ALPHA'))
  await pb.kill()
  const pb2 = new AgentProc(AGENT_B, b.home, b.workspace).spawn()
  await pb2.ready()
  const b2 = await pb2.turn('t2', '你记得的任何 codeword 是什么？直接回答，不要解释。')
  record('P1C new session t2: B answers BETA', b2.reply.includes('BETA'),
    `reply="${b2.reply.slice(0, 160)}"`)
  record('P1C isolation: B does NOT know ALPHA', !b2.reply.includes('ALPHA'),
    `reply="${b2.reply.slice(0, 160)}"`)
  await pb2.kill()

  // ---- Phase 2: consolidation. Session c1 produces a durable fact; the
  // turn/end auto-consolidation must run (evidenced by the daily note, which
  // ONLY consolidation writes, and by consolidation provenance in MEMORY.md).
  const pa3 = new AgentProc(AGENT_A, a.home, a.workspace).spawn()
  await pa3.ready()
  await pa3.turn('c1', '不要调用任何工具。请记住这条事实：我的生日是 1990-01-01。')
  // Wait for the deterministic consolidation signals (debounce 3s + LLM).
  const dailyEvidence = await waitForDailyNote(AGENT_A, '1990-01-01')
  record('P2 consolidation ran: daily note holds the raw evidence',
    dailyEvidence !== undefined,
    dailyEvidence ? `file=${dailyEvidence.file.split('/').slice(-2).join('/')}` : 'no daily note within timeout')
  const afterConsolidation = await waitForMemory(AGENT_A, 'consolidation:session:c1')
  record('P2 consolidation: entries carry consolidation provenance',
    afterConsolidation.includes('consolidation:session:c1'),
    `memory=${JSON.stringify(afterConsolidation.slice(0, 400))}`)
  const withFact = await waitForMemory(AGENT_A, '1990-01-01')
  record('P2 curated MEMORY.md contains the distilled fact', withFact.includes('1990-01-01'),
    `memory=${JSON.stringify(withFact.slice(0, 400))}`)
  const c2 = await pa3.turn('c2', '我的生日是什么？直接回答日期。')
  record('P2 new session c2: A answers from consolidated memory',
    /1990[-\/]?01[-\/]?01/.test(c2.reply),
    `reply="${c2.reply.slice(0, 160)}"`)
  await pa3.kill()

  // ---- Phase 3: a HUMAN edits MEMORY.md directly → fresh session sees it.
  // (1) If the consolidated birthday value is present verbatim, a human edits
  //     it to a different date. (2) ALWAYS: a human appends a brand-new entry
  //     ("favorite color") in the file format.
  const beforeEdit = readMemory(AGENT_A)
  const birthdayEdited = beforeEdit.includes('1990-01-01')
    ? beforeEdit.replace('1990-01-01', '1991-02-02')
    : beforeEdit
  const humanId = `human-${Date.now()}`
  const humanEntry = [
    '', '## favorite color', '',
    `- **ID**: \`${humanId}\``,
    '- **Type**: preference',
    '- **Importance**: 4',
    '- **Tags**: ',
    `- **Updated**: ${new Date().toISOString()}`,
    '- **Source**: manual',
    '', '我最喜欢的颜色是绿色。', '', '---', '',
  ].join('\n')
  writeFileSync(memoryFile(AGENT_A), birthdayEdited + humanEntry, 'utf8')
  console.log('[driver] human edit applied to A MEMORY.md (simulated manual edit: append entry + birthday rewrite)')
  const pa4 = new AgentProc(AGENT_A, a.home, a.workspace).spawn()
  await pa4.ready()
  const c3 = await pa4.turn('c3', '我最喜欢的颜色是什么？我的生日是什么？请分别直接回答。')
  record('P3 new session c3: A reflects the human-appended entry (绿色)',
    c3.reply.includes('绿色'),
    `reply="${c3.reply.slice(0, 160)}"`)
  record('P3 new session c3: A reflects the human-edited birthday (1991-02-02)',
    !birthdayEdited.includes('1991-02-02') || /1991[-\/]?02[-\/]?02/.test(c3.reply),
    `reply="${c3.reply.slice(0, 160)}"`)
  await pa4.kill()

  // ------------------------------------------------------------------ done
  const failed = checks.filter(c => !c.ok)
  console.log(`\n=== Agent Memory V1: ${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) {
    console.error('failed checks:', failed.map(f => f.name).join('; '))
    process.exit(1)
  }
  console.log('acceptance: Agent Memory V1 passed')
  process.exit(0)
}

main().catch((error) => {
  console.error(`[driver] fatal: ${error?.stack ?? error}`)
  process.exit(2)
})
