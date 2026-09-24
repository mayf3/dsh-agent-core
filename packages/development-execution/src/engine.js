/**
 * @agent-core/development-execution — execution engine
 * (AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 CTR-DES-002/003/007).
 *
 * System-owned execution state: every transition is appended to the ledger;
 * restarts replay the ledger (status/result never depend on process memory).
 * Failure matrix (CTR-DES-007): success ⇒ SUCCEEDED + candidate receipt;
 * evidenced failure ⇒ FAILED; timeout ⇒ FAILED/failureClass 'timeout';
 * unprovable crash ⇒ OUTCOME_UNKNOWN (never fabricated); cancel ⇒ exactly one
 * CANCELLED; duplicate start with the same (caller, dedupeKey) ⇒ the ORIGINAL
 * execution, never a second one.
 *
 * The backend is injected (adapter contract) so hermetic tests use a fake
 * executor while production wires the pinned codex adapter.
 */

import { randomUUID, createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ExecutionLedger, TERMINAL_STATES } from './ledger.js'
import { loadRepoAuthority, authorizeStart, createWorktree, changedFiles, candidateSha } from './authority.js'
import { loadBackendConfig, verifyBackend, runCodex } from './codex-backend.js'

const STATE = Object.freeze({
  QUEUED: 'QUEUED', STARTING: 'STARTING', RUNNING: 'RUNNING', WAITING: 'WAITING',
  SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELLED: 'CANCELLED', OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
})

export class DevelopmentExecutionError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

function err(code, message) { return new DevelopmentExecutionError(code, message) }

/**
 * @param {object} deps
 * @param {string} deps.devDir - the surface's own dir
 *   (`<productionRoot>/dev-execution`); ledger, Operator config
 *   (repos.json/backend.json), worktrees, and per-execution data live here.
 * @param {object} [deps.backend] - injected adapter (codex adapter in
 *   production; fakes in tests): { name, verify(), run({instruction, worktree,
 *   executionDir, resumeSessionId}) -> {pid, done} } where done resolves
 *   {exitCode, signal, sessionId?, spawnError?, stderrTail?, lastMessage?}.
 */
export class DevelopmentExecutionEngine {
  constructor({ devDir, clock = () => Date.now(), backend, timeoutMs = 3_600_000, log = () => {} } = {}) {
    if (typeof devDir !== 'string' || devDir === '') throw new TypeError('development-execution: devDir is required')
    this.devDir = devDir
    this.dir = devDir
    this.ledgerDir = join(devDir, 'ledger')
    this.worktreesRoot = join(devDir, 'worktrees')
    this.executionsDataRoot = join(devDir, 'executions')
    this.reposFile = join(devDir, 'repos.json')
    this.backendFile = join(devDir, 'backend.json')
    this.clock = clock
    this.log = log
    this.timeoutMs = timeoutMs
    this.backend = backend ?? createCodexBackendFromConfig(this.backendFile)
    this.ledger = new ExecutionLedger({ dir: this.ledgerDir, clock })
    this.executions = ExecutionLedger.replay(join(this.ledgerDir, 'executions.jsonl'))
    this.supervised = new Map() // executionId -> {childDone, timer}
    this.#recoverOrphans()
  }

  #recoverOrphans() {
    // CTR-DES-007 F/D: after an owning-process restart, a previously RUNNING
    // execution whose backend process is gone has UNPROVABLE outcome — mark
    // OUTCOME_UNKNOWN (never fabricated). A live pid is left untouched and
    // stays queryable.
    for (const [id, execution] of this.executions) {
      if (TERMINAL_STATES.includes(execution.state)) continue
      const pid = execution.pid
      const alive = typeof pid === 'number' ? pidAlive(pid) : false
      if (!alive) {
        this.#appendTerminal(id, 'OUTCOME_UNKNOWN', {
          errorClass: 'owner_restart_outcome_unproven',
          failureDetail: 'owning process restarted; backend outcome could not be proven',
        })
      }
    }
  }

  #execution(executionId) {
    const execution = this.executions.get(executionId)
    if (execution === undefined) throw err('execution_not_found', `no execution ${executionId}`)
    return execution
  }

  #appendState(executionId, state, detail) {
    this.ledger.append({ type: 'state', executionId, state, detail })
    const execution = this.executions.get(executionId)
    execution.state = state
    execution.updatedAt = this.clock()
  }

  #appendTerminal(executionId, terminalState, fields = {}) {
    this.ledger.append({ type: 'terminal', executionId, terminalState, ...fields })
    const execution = this.executions.get(executionId)
    execution.state = terminalState
    execution.terminalAt = this.clock()
    execution.candidateSha = fields.candidateSha ?? null
    execution.changedFiles = fields.changedFiles ?? null
    execution.errorClass = fields.errorClass ?? null
    execution.failureDetail = fields.failureDetail ?? null
    execution.evidenceRefs = fields.evidenceRefs ?? []
    execution.testEvidence = fields.testEvidence ?? null
  }

  /** CTR-DES-001 start. Idempotent on (callerAgentId, dedupeKey). */
  async start({ repo, baseSha, task, branch, constraints, dedupeKey }, callerAgentId) {
    if (typeof callerAgentId !== 'string' || callerAgentId === '') throw err('invalid_arguments', 'caller identity missing')
    if (typeof task !== 'string' || task.trim() === '') throw err('invalid_arguments', 'task is required')
    const verify = this.backend.verify()
    if (!verify.ok) throw err(verify.code, verify.detail)

    // Idempotency FIRST (G): the dedupe authority is the ledger, not memory.
    const dedupeKeyHash = typeof dedupeKey === 'string' && dedupeKey !== ''
      ? createHash('sha256').update(`${callerAgentId}\u0000${dedupeKey}`).digest('hex')
      : null
    if (dedupeKeyHash !== null) {
      for (const execution of this.executions.values()) {
        if (execution.dedupeKeyHash === dedupeKeyHash) {
          return { executionId: execution.executionId, state: execution.state, worktree: execution.worktree, backend: execution.backend, deduped: true }
        }
      }
    }

    const authority = loadRepoAuthority(this.reposFile)
    const repoEntry = authorizeStart(authority, { repo, baseSha, branch })

    const executionId = randomUUID()
    const worktree = createWorktree({ repoPath: repoEntry.path, baseSha, worktreesRoot: this.worktreesRoot, executionId })
    const executionDir = join(this.executionsDataRoot, executionId)
    mkdirSync(executionDir, { recursive: true })

    this.ledger.append({
      type: 'execution_started', executionId, backend: this.backend.name,
      repo, baseSha, branch: branch ?? null, agentId: callerAgentId, dedupeKeyHash,
    })
    this.executions.set(executionId, {
      executionId, events: [], backend: this.backend.name, repo, baseSha, branch: branch ?? null,
      agentId: callerAgentId, dedupeKeyHash, startedAt: this.clock(), state: STATE.QUEUED, updatedAt: this.clock(),
    })
    this.#appendState(executionId, STATE.STARTING)

    const run = this.backend.run({ instruction: typeof constraints === 'string' && constraints !== '' ? `${task}\n\nConstraints: ${constraints}` : task, worktree, executionDir })
    this.executions.get(executionId).pid = run.pid
    this.ledger.append({ type: 'state', executionId, state: STATE.RUNNING, pid: run.pid })
    const execution = this.executions.get(executionId)
    execution.state = STATE.RUNNING
    execution.pid = run.pid
    execution.worktree = worktree

    const timer = setTimeout(() => this.#onTimeout(executionId), this.timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()
    this.supervised.set(executionId, { timer })
    void run.done.then((outcome) => this.#onBackendExit(executionId, outcome))
    return { executionId, state: execution.state, worktree, backend: this.backend.name }
  }

  #onBackendExit(executionId, outcome) {
    const execution = this.executions.get(executionId)
    if (execution === undefined || TERMINAL_STATES.includes(execution.state)) return
    const supervised = this.supervised.get(executionId)
    if (supervised?.timer) clearTimeout(supervised.timer)
    this.supervised.delete(executionId)

    // CTR-DES-007 E: a cancel that already reached terminal wins; a late
    // backend exit after cancel must not overwrite the disposition.
    if (TERMINAL_STATES.includes(execution.state)) return

    if (outcome.spawnError !== undefined || (outcome.exitCode === null && outcome.signal === null)) {
      this.#appendTerminal(executionId, 'OUTCOME_UNKNOWN', {
        errorClass: 'backend_spawn_error',
        failureDetail: String(outcome.spawnError ?? 'backend process could not be started'),
      })
      return
    }
    if (outcome.signal !== null) {
      // Killed by something other than our own cancel/timeout paths (which
      // reach terminal synchronously). Unprovable outcome.
      this.#appendTerminal(executionId, 'OUTCOME_UNKNOWN', {
        errorClass: 'backend_killed',
        failureDetail: `backend terminated by signal ${outcome.signal}; outcome could not be proven`,
      })
      return
    }
    if (outcome.exitCode !== 0) {
      this.#appendTerminal(executionId, 'FAILED', {
        errorClass: 'backend_exit_nonzero',
        failureDetail: (outcome.stderrTail ?? []).slice(-8).join('\n').slice(0, 2000),
        sessionId: outcome.sessionId,
      })
      return
    }
    // Exit 0: success evidence. Candidate facts come from git, observed by
    // the adapter — never from the backend's own claims.
    const sha = candidateSha(execution.worktree, execution.baseSha)
    const files = changedFiles(execution.worktree, execution.baseSha)
    if (sha === null) {
      // Completed but no candidate commit: a no-op success is still terminal
      // success — with an empty change set, never a fabricated commit.
      this.#appendTerminal(executionId, 'SUCCEEDED', { candidateSha: null, changedFiles: [], sessionId: outcome.sessionId })
      return
    }
    this.#appendTerminal(executionId, 'SUCCEEDED', { candidateSha: sha, changedFiles: files, sessionId: outcome.sessionId, testEvidence: outcome.lastMessage ? { lastMessageFile: true } : null })
  }

  #onTimeout(executionId) {
    const execution = this.executions.get(executionId)
    if (execution === undefined || TERMINAL_STATES.includes(execution.state)) return
    // CTR-DES-007 C: timeout is a terminal FAILED with an explicit class —
    // the backend process is killed; its outcome is never reported as success.
    try { if (typeof execution.pid === 'number') process.kill(execution.pid, 'SIGKILL') } catch { /* already gone */ }
    this.#appendTerminal(executionId, 'FAILED', { errorClass: 'timeout', failureDetail: `execution exceeded ${this.timeoutMs}ms` })
  }

  /** CTR-DES-001 status — restart-safe, ledger-backed. */
  status(executionId) {
    return this.#publicRecord(this.#execution(executionId))
  }

  /** CTR-DES-001 result — terminal receipt; non-terminal returns state. */
  result(executionId) {
    const execution = this.#execution(executionId)
    const record = this.#publicRecord(execution)
    if (!TERMINAL_STATES.includes(execution.state)) return { ...record, terminal: false }
    return {
      ...record,
      terminal: true,
      receipt: {
        executionId, backend: execution.backend, terminalState: execution.state,
        repo: execution.repo, worktree: execution.worktree, baseSha: execution.baseSha,
        candidateSha: execution.candidateSha ?? undefined,
        changedFiles: execution.changedFiles ?? [],
        startedAt: execution.startedAt, terminalAt: execution.terminalAt,
        failureClass: execution.errorClass ?? undefined,
        failureDetail: execution.failureDetail ?? undefined,
        evidenceRefs: execution.evidenceRefs ?? [],
      },
    }
  }

  /** CTR-DES-001 continue — steer via the backend adapter (resume). */
  async continue({ executionId, instruction }, callerAgentId) {
    const execution = this.#execution(executionId)
    if (typeof instruction !== 'string' || instruction.trim() === '') throw err('invalid_arguments', 'instruction is required')
    if (TERMINAL_STATES.includes(execution.state)) throw err('execution_terminal', `execution ${executionId} is ${execution.state}`)
    if (execution.state === STATE.RUNNING) {
      // The backend is mid-run; continue is accepted and recorded as an
      // advisory note — codex exec has no mid-run stdin contract in this
      // revision. Honest WAITING/continue semantics arrive with the resume
      // path (post-exit steering), which is what the adapter supports.
      this.ledger.append({ type: 'state', executionId, state: STATE.RUNNING, detail: 'continue_requested_midrun' })
      return { executionId, state: execution.state, accepted: 'recorded_midrun' }
    }
    if (execution.state !== STATE.WAITING) throw err('not_continuable', `execution ${executionId} is ${execution.state}`)
    if (typeof execution.sessionId !== 'string') throw err('not_continuable', 'no backend session recorded')
    const run = this.backend.run({ instruction, worktree: execution.worktree, executionDir: join(this.executionsDataRoot, executionId), resumeSessionId: execution.sessionId })
    this.#appendState(executionId, STATE.RUNNING)
    void run.done.then((outcome) => this.#onBackendExit(executionId, outcome))
    return { executionId, state: STATE.RUNNING }
  }

  /** CTR-DES-001 cancel — exactly one terminal disposition, idempotent. */
  cancel(executionId) {
    const execution = this.#execution(executionId)
    if (TERMINAL_STATES.includes(execution.state)) {
      return { executionId, state: execution.state, cancelled: false, alreadyTerminal: true }
    }
    try { if (typeof execution.pid === 'number') process.kill(execution.pid, 'SIGKILL') } catch { /* already gone */ }
    this.#appendTerminal(executionId, 'CANCELLED', { errorClass: 'cancelled_by_agent' })
    return { executionId, state: STATE.CANCELLED, cancelled: true }
  }

  #publicRecord(execution) {
    return {
      executionId: execution.executionId,
      backend: execution.backend,
      state: execution.state,
      agentId: execution.agentId,
      repo: execution.repo,
      worktree: execution.worktree,
      baseSha: execution.baseSha,
      branch: execution.branch ?? undefined,
      startedAt: execution.startedAt,
      updatedAt: execution.updatedAt,
      terminalAt: execution.terminalAt,
      candidateSha: execution.candidateSha ?? undefined,
      changedFiles: execution.changedFiles ?? undefined,
      testEvidence: execution.testEvidence ?? undefined,
      reviewEvidence: execution.reviewEvidence ?? undefined,
      errorClass: execution.errorClass ?? undefined,
      pid: execution.pid,
      sessionId: execution.sessionId ?? undefined,
    }
  }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

/** Production backend: pinned codex adapter built from backend.json. */
function createCodexBackendFromConfig(backendFile) {
  const config = loadBackendConfig(backendFile)
  return {
    name: config.configured ? 'codex' : 'unconfigured',
    verify: () => verifyBackend(config),
    run: ({ instruction, worktree, executionDir, resumeSessionId }) => runCodex(config, { instruction, worktree, executionDir, resumeSessionId }),
  }
}
