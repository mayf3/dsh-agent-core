/**
 * @agent-core/development-execution — execution state ledger.
 *
 * AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 (CTR-DES-002): the append-only
 * state authority for THIS surface's executions, stored as one JSON line per
 * event in `<dir>/executions.jsonl` — the same single-surface state-ledger
 * pattern as the workflow attempts ledger. It is deliberately NOT a second
 * execution-HISTORY ledger: it never duplicates session/run facts, and
 * workflow correlation stays read-time (traceability Spec R1–R9).
 *
 * Terminal discipline: SUCCEEDED / FAILED / CANCELLED / OUTCOME_UNKNOWN are
 * terminal; appending any transition after a terminal event throws. Replay
 * (restart) rebuilds state from the file alone — status/result never depend
 * on the owning process's memory.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, writeSync, closeSync, fsyncSync } from 'node:fs'
import { join } from 'node:path'

export const EXECUTIONS_FILE = 'executions.jsonl'

export const TERMINAL_STATES = Object.freeze(['SUCCEEDED', 'FAILED', 'CANCELLED', 'OUTCOME_UNKNOWN'])
export const STATES = Object.freeze(['QUEUED', 'STARTING', 'RUNNING', 'WAITING', ...TERMINAL_STATES])

/** Create (idempotently) the ledger dir. */
export function ensureLedgerDir(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Append ONE event line, fsync'd. Callers own the event shape; the ledger
 * enforces only terminal discipline and JSONL integrity.
 */
export class ExecutionLedger {
  constructor({ dir, clock = () => Date.now() } = {}) {
    if (dir === undefined || dir === '') throw new TypeError('development-execution: ledger dir is required')
    this.dir = dir
    this.file = join(dir, EXECUTIONS_FILE)
    this.clock = clock
    ensureLedgerDir(dir)
    this.terminal = new Set() // executionIds with a terminal event already appended
    this.#replayTerminal()
  }

  #replayTerminal() {
    if (!existsSync(this.file)) return
    const lines = readFileSync(this.file, 'utf8').split('\n')
    for (const line of lines) {
      if (line === '') continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        throw new Error('development-execution: corrupt (unparseable) executions.jsonl line — fail loud, never self-heal')
      }
      if (event?.type === 'terminal' && typeof event.executionId === 'string') this.terminal.add(event.executionId)
    }
  }

  append(event) {
    const record = { atMs: this.clock(), ...event }
    if (record.type === 'terminal') {
      if (!TERMINAL_STATES.includes(record.terminalState)) {
        throw new TypeError(`development-execution: unknown terminal state ${JSON.stringify(record.terminalState)}`)
      }
      if (this.terminal.has(record.executionId)) {
        throw new Error(`development-execution: execution ${record.executionId} already terminal — exactly-one-terminal violated`)
      }
    }
    const line = JSON.stringify(record)
    const fd = openSync(this.file, 'a')
    try {
      writeSync(fd, line + '\n')
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    if (record.type === 'terminal') this.terminal.add(record.executionId)
    return record
  }

  hasTerminal(executionId) {
    return this.terminal.has(executionId)
  }

  /**
   * Replay ALL events into per-execution projections. Restart-safe: status/
   * result are answered from this replay alone. The LAST event of each type
   * wins; a terminal event freezes the projection.
   */
  static replay(file) {
    if (!existsSync(file)) return new Map()
    const executions = new Map()
    const lines = readFileSync(file, 'utf8').split('\n')
    for (const line of lines) {
      if (line === '') continue
      const event = JSON.parse(line) // throws loud on corruption
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
}
