/**
 * Read-only compatibility for AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1
 * (CTR-DEC-001/002). Production can replay recorded development history and
 * refuse writer operations, without loading the retired executor or its config.
 * The historical writer exists only in development-execution/test/helpers.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TERMINAL_STATES = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'OUTCOME_UNKNOWN']

export class DevelopmentExecutionError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

/** Replay the existing ledger projection; missing history stays missing. */
function replay(file) {
  if (!existsSync(file)) return new Map()
  const executions = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line === '') continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      throw new Error('development-execution: corrupt (unparseable) executions.jsonl line — fail loud, never self-heal')
    }
    const id = event.executionId
    if (typeof id !== 'string' || id === '') continue
    const current = executions.get(id) ?? { executionId: id, events: [] }
    current.events.push(event)
    if (event.type === 'execution_started') {
      current.backend = event.backend
      current.repo = event.repo
      current.worktree = event.worktree
      current.baseSha = event.baseSha
      current.branch = event.branch ?? null
      current.agentId = event.agentId
      current.startedAt = event.atMs
      current.dedupeKeyHash = event.dedupeKeyHash ?? null
    }
    if (event.type === 'state') {
      current.state = event.state
      if (event.pid !== undefined) current.pid = event.pid
      if (event.sessionId !== undefined) current.sessionId = event.sessionId
    }
    if (event.type === 'continue_requested') {
      const queue = current.continueRequests ?? (current.continueRequests = [])
      queue.push({ instruction: event.instruction, disposition: 'pending', atMs: event.atMs })
    }
    if (event.type === 'continue_delivery') {
      const entry = (current.continueRequests ?? []).find((c) => c.disposition === 'pending' && c.instruction === event.instruction)
      if (entry !== undefined) entry.disposition = event.disposition
    }
    if (event.type === 'terminal') {
      current.state = event.terminalState
      current.terminalAt = event.atMs
      current.candidateSha = event.candidateSha ?? null
      current.changedFiles = event.changedFiles ?? null
      current.testEvidence = event.testEvidence ?? null
      current.reviewEvidence = event.reviewEvidence ?? null
      current.errorClass = event.errorClass ?? null
      current.failureDetail = event.failureDetail ?? null
      current.evidenceRefs = event.evidenceRefs ?? []
      if (event.sessionId !== undefined) current.sessionId = event.sessionId
    }
    current.updatedAt = event.atMs
    executions.set(id, current)
  }
  return executions
}

export class DevelopmentExecutionHistory {
  #executions

  constructor({ devDir } = {}) {
    if (typeof devDir !== 'string' || devDir === '') throw new TypeError('development-execution: devDir is required')
    this.#executions = replay(join(devDir, 'ledger', 'executions.jsonl'))
  }

  get writerAuthorityRetired() { return true }

  #refuseWriter(operation) {
    throw new DevelopmentExecutionError('writer_authority_retired', `development_execute.${operation} refused: the Core development writer authority is retired — agent-control is the sole development writer (AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1); status/result remain readable`)
  }

  async start() { this.#refuseWriter('start') }
  async continue() { this.#refuseWriter('continue') }
  cancel() { this.#refuseWriter('cancel') }

  #execution(executionId) {
    const execution = this.#executions.get(executionId)
    if (execution === undefined) throw new DevelopmentExecutionError('execution_not_found', `no execution ${executionId}`)
    return execution
  }

  status(executionId) {
    return this.#publicRecord(this.#execution(executionId))
  }

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
        tests: {
          ran: Boolean(execution.testEvidence?.ran),
          evidenceRefs: (execution.testEvidence?.evidenceRefs ?? []).map(String),
        },
        startedAt: execution.startedAt, terminalAt: execution.terminalAt,
        failureClass: execution.errorClass ?? undefined,
        failureDetail: execution.failureDetail ?? undefined,
        evidenceRefs: execution.evidenceRefs ?? [],
      },
    }
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
      ...(execution.continueRequests?.length
        ? { continueRequests: execution.continueRequests.map((c) => ({ instruction: c.instruction, disposition: c.disposition, atMs: c.atMs })) }
        : {}),
    }
  }
}
