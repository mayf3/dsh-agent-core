/**
 * scheduler-cp-admission Issue 3 provisioning closure — watchdog evidence
 * ownership repair + terminal evidence/heartbeat proofs.
 *
 * IMPURE by design (fs/permissions/processes): the orchestrator
 * (scripts/scheduler-cp-admission.mjs) owns the root/sudo context and injects
 * it here. Split out of the orchestrator per CODE_STRUCTURE_GUARDRAILS_V1 §6
 * (touched legacy file MUST_NOT_GROW; fixes arrive as new smaller files).
 *
 * RUNBOOK authorization (deployment-artifacts/scheduler-control-plane-
 * reliability-v1/RUNBOOK.md §7): '预创建 evidence-channel 目录（dedicated
 * group，收紧 0777 占位）'; §5.2 writer census: child relay (uid 502)
 * writes, W1 (authsvc) reads, root bypasses.
 */
import { readFileSync, writeFileSync, existsSync, statSync, accessSync, constants, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const W1_ERR_LOG = '/Users/authsvc/.agent-core/logs/scheduler-watchdog-w1.err.log'
const W2_ERR_LOG = '/usr/local/var/scheduler-watchdog/w2.err.log'

/**
 * Repair the W1 evidence log BEFORE W1/W2 start. An existing log is NEVER
 * truncated — ownership/mode repair only, bytes preserved (size receipted
 * pre/post); a missing log is pre-created empty.
 * Also retires the RUNBOOK's 0777 placeholder on the reconciliation-evidence
 * dir: 0750 yanfenma:oc-canary (oc-canary 599 is the existing group both the
 * relay owner and the W1 reader already share; root bypasses; no world bits).
 */
export function repairWatchdogEvidenceChannel({ ctx, mode, phase, execFileSync }) {
  const stateDir = ctx.watchdogStateDir
  const evidenceLog = join(stateDir, 'scheduler-watchdog-evidence.jsonl')
  const pre = existsSync(evidenceLog) ? statSync(evidenceLog) : null
  if (!pre) writeFileSync(evidenceLog, '')
  try { ctx.chown(evidenceLog, 'authsvc', 'staff') } catch (error) { if (mode === 'apply') throw error }
  try { execFileSync('chmod', ['0644', evidenceLog], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (error) { if (mode === 'apply') throw error }
  const post = statSync(evidenceLog)
  const bytesPreserved = !pre || post.size >= pre.size
  phase('watchdog-evidence-ownership', bytesPreserved,
    `evidence log uid ${pre?.uid ?? 'absent'}->${post.uid} gid ${pre?.gid ?? 'absent'}->${post.gid} mode ${(post.mode & 0o7777).toString(8)} size ${pre?.size ?? 0}->${post.size} (bytes preserved)`)
  if (!bytesPreserved) throw new Error('phase watchdog-evidence-ownership failed: evidence bytes lost')

  const evidenceDir = dirname(ctx.evidenceFile ?? '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl')
  mkdirSync(evidenceDir, { recursive: true })
  const dirPre = statSync(evidenceDir).mode & 0o7777
  try { ctx.chown(evidenceDir, 'yanfenma', 'oc-canary') } catch (error) { if (mode === 'apply') throw error }
  try { execFileSync('chmod', ['0750', evidenceDir], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (error) { if (mode === 'apply') throw error }
  const dirPost = statSync(evidenceDir).mode & 0o7777
  phase('reconciliation-dir-tightening', (dirPost & 0o002) === 0, `reconciliation dir mode ${dirPost.toString(8)} (was ${dirPre.toString(8)}); 0777 placeholder retired`)
  if ((dirPost & 0o002) !== 0) throw new Error('phase reconciliation-dir-tightening failed: still world-writable')
  return { evidenceLog, evidenceDir }
}

/**
 * Terminal Issue 3 proofs. Real mode: non-mutating authsvc write probe,
 * kickstarts both watchdogs, waits (bounded) for both heartbeats to be
 * rewritten by real cycles, requires the evidence log to have GROWN (the
 * runner appends a `w1_run` line every cycle and swallows append errors, so
 * heartbeat freshness alone proves nothing about durable evidence), and
 * scans the POST-kickstart stderr bytes (byte-offset slicing, not char) for
 * the pre-#222 runner crash. Fixture mode: filesystem gates still run for
 * real; only the launchd-driven cycle observation is deferred (the shim
 * cannot execute the runner) and asserted via plist bootstrap in the
 * selftest tail instead.
 */
export async function assertEvidenceAndHeartbeatProofs({ ctx, mode, gate, execFileSync, kickstart }) {
  const stateDir = ctx.watchdogStateDir
  const { evidenceLog, evidenceDir } = {
    evidenceLog: join(stateDir, 'scheduler-watchdog-evidence.jsonl'),
    evidenceDir: dirname(ctx.evidenceFile ?? '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl'),
  }
  gate('RECONCILIATION_EVIDENCE_DIR_WORLD_WRITABLE', (statSync(evidenceDir).mode & 0o002) === 0, `${evidenceDir} has no world-write bit (mode ${(statSync(evidenceDir).mode & 0o7777).toString(8)})`)

  let appendable = false
  let appendDetail = ''
  if (mode === 'apply') {
    try {
      execFileSync('sudo', ['-u', 'authsvc', '/usr/bin/test', '-w', evidenceLog], { stdio: ['ignore', 'pipe', 'pipe'] })
      appendable = true
      appendDetail = 'authsvc -w probe on evidence log (non-mutating)'
    } catch { appendDetail = 'authsvc cannot write the evidence log' }
  } else {
    try { accessSync(evidenceLog, constants.W_OK); appendable = true; appendDetail = 'fixture runner-user W_OK probe' } catch { appendDetail = 'fixture evidence log not writable' }
  }
  gate('W1_EVIDENCE_APPEND_WRITABLE', appendable, appendDetail)

  const mtimeOf = (p) => { try { return statSync(p).mtimeMs } catch { return 0 } }
  const sizeOf = (p) => { try { return statSync(p).size } catch { return 0 } }
  if (mode !== 'apply') {
    gate('W1_HEARTBEAT_FRESH', true, 'fixture: launchd deferred; plist bootstrap asserted in selftest tail')
    gate('W1_NEW_EVIDENCE_OBSERVED', true, 'fixture: launchd deferred; cycle observation via plist bootstrap')
    gate('W1_REFERENCEERROR_OUTCOME', true, 'fixture: no runner err bytes to inspect')
    gate('W2_HEARTBEAT_FRESH', true, 'fixture: launchd deferred; plist bootstrap asserted in selftest tail')
    return
  }

  const w1hb = join(stateDir, 'w1.heartbeat')
  const w2hb = join(stateDir, 'w2.heartbeat')
  const evSizeBefore = sizeOf(evidenceLog)
  const w1ErrBefore = sizeOf(W1_ERR_LOG)
  const w2ErrBefore = sizeOf(W2_ERR_LOG)
  const t0 = Date.now()
  kickstart('system/ai.agent-core.scheduler-watchdog-w1')
  kickstart('system/ai.agent-core.scheduler-watchdog-w2')
  let w1Fresh = false
  let w2Fresh = false
  for (let waited = 0; waited < 120_000 && !(w1Fresh && w2Fresh); waited += 5000) {
    await new Promise((r) => setTimeout(r, 5000))
    w1Fresh = mtimeOf(w1hb) > t0
    w2Fresh = mtimeOf(w2hb) > t0
  }
  gate('W1_HEARTBEAT_FRESH', w1Fresh, `w1.heartbeat rewritten post-kickstart (kicked ${new Date(t0).toISOString()})`)
  const evSizeAfter = sizeOf(evidenceLog)
  gate('W1_NEW_EVIDENCE_OBSERVED', w1Fresh && evSizeAfter > evSizeBefore, `evidence log grew ${evSizeBefore}->${evSizeAfter} (runner appends one w1_run line per cycle; append errors are swallowed upstream, so growth is the only durable proof)`)
  // Byte-offset slicing: statSync sizes are bytes; decode only after slicing.
  const freshErrBytes = (path, beforeSize) => {
    try { return readFileSync(path).subarray(beforeSize).toString('utf8') } catch { return '' }
  }
  const w1FreshErr = freshErrBytes(W1_ERR_LOG, w1ErrBefore)
  gate('W1_REFERENCEERROR_OUTCOME', !/outcome is not defined/.test(w1FreshErr), `no "outcome is not defined" in ${W1_ERR_LOG} bytes since kickstart (${w1FreshErr.length}B fresh)`)
  const w2FreshErr = freshErrBytes(W2_ERR_LOG, w2ErrBefore)
  gate('W2_REFERENCEERROR_OUTCOME', !/outcome is not defined/.test(w2FreshErr), `no "outcome is not defined" in ${W2_ERR_LOG} bytes since kickstart (${w2FreshErr.length}B fresh)`)
  gate('W2_HEARTBEAT_FRESH', w2Fresh, `w2.heartbeat rewritten post-kickstart (kicked ${new Date(t0).toISOString()})`)
}
