/**
 * @agent-core/agent-router/src/process-registry-death-evidence.js — exact
 * process-death evidence for the lifecycle-slot reuse gates
 * (AGENT_PROCESS_LIFECYCLE_HARDENING_V4 C-006..C-009; the WORKFLOW_546_D1
 * stale-registration incident, split out of process-registry.js for the
 * CODE_STRUCTURE_GUARDRAILS_V1 500-line file limit).
 *
 * Death evidence is FAIL-CLOSED: only mechanically proven death invalidates a
 * registration — an observed real exit on the process, the terminal EXITED
 * state (reachable with `exit` unset on the logical no-child path), or an
 * explicit OS not-found verdict on the exact pid. Everything else — a probe
 * that could not be delivered, a probe that threw, a missing or duck-typed
 * child surface — is never evidence.
 */

import { ChildProcess } from 'node:child_process'

/**
 * Exact process-death evidence on a lifecycle slot's processRef.
 *
 * The OS probe uses signal 0 on the EXACT pid: `process.kill(pid, 0)` never
 * kills and throws with `code === 'ESRCH'` only when no OS process exists for
 * that pid. `ChildProcess.kill()` is deliberately NOT consulted — it reports
 * ANY undeliverable signal as `false`, and signal 0 fails with EPERM (the
 * process EXISTS but this uid may not signal it) exactly as it fails with
 * ESRCH, so a `false` there can never distinguish death from a live process.
 * The probe therefore only runs for a REAL `ChildProcess` identity: a fake or
 * duck-typed child has no OS surface and gets no OS evidence. PID reuse can
 * only ever make a dead child look alive here — never a live child look dead.
 */
export function hasExactDeathEvidence(proc) {
  if (proc === null || proc === undefined) return true // nothing to reuse
  if (proc.exit !== undefined || proc.state === 'EXITED') return true
  const child = proc.child ?? proc.ownership?.childObject
  if (child instanceof ChildProcess && Number.isInteger(proc.pid) && proc.pid > 0) {
    try {
      process.kill(proc.pid, 0)
      return false // the probe was delivered: the OS process exists
    } catch (error) {
      return error?.code === 'ESRCH' // explicit not-found, or fail closed
    }
  }
  return false
}
