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
import { readFileSync, existsSync, statSync, accessSync, constants, mkdirSync,
         openSync, closeSync, fstatSync, fchownSync, fchmodSync, symlinkSync, rmSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const W1_ERR_LOG = '/Users/authsvc/.agent-core/logs/scheduler-watchdog-w1.err.log'
const W2_ERR_LOG = '/usr/local/var/scheduler-watchdog/w2.err.log'

/**
 * O_NOFOLLOW capability proof (every invocation, hermetic tmpdir): the
 * fd-based ownership repair below is only safe if O_NOFOLLOW actually
 * refuses a planted symlink on this platform. Cheap; no production contact.
 */
function assertNoFollowCapable() {
  const probeDir = mkdtempSync(join(tmpdir(), 'agentcore-nofollow-probe-'))
  try {
    const link = join(probeDir, 'planted-link')
    symlinkSync('/etc/hostname', link)
    let refused = false
    try { closeSync(openSync(link, constants.O_WRONLY | constants.O_NOFOLLOW)) } catch { refused = true }
    if (!refused) throw new Error('O_NOFOLLOW not enforced on this platform; refusing symlink-adjacent ownership repair')
  } finally { rmSync(probeDir, { recursive: true, force: true }) }
}

/**
 * Codex P1 (PR #264): the watchdog state dir is authsvc-owned BY DESIGN, so
 * an authsvc-context process can plant a symlink at any child path before a
 * root --apply. Pathname chown/chmod/truncate would follow it onto a foreign
 * inode (e.g. hand the root-executed W2 script to authsvc = root code exec).
 * Every ownership mutation therefore happens on a descriptor opened with
 * O_NOFOLLOW whose fstat inode type is verified first; existing bytes are
 * never truncated (O_CREAT without O_TRUNC; the evidence log must grow).
 */
function repairOwnershipNoFollow({ mode, execFileSync, path, kind, uidSpec, gidSpec, fileMode }) {
  let flags = constants.O_NOFOLLOW
  if (kind === 'directory') flags |= constants.O_RDONLY | constants.O_DIRECTORY
  else flags |= constants.O_WRONLY | constants.O_CREAT
  const fd = openSync(path, flags, fileMode)
  try {
    const st = fstatSync(fd)
    if (kind === 'directory' ? !st.isDirectory() : !st.isFile()) {
      throw new Error(`no-follow ownership guard: ${path} is not a regular ${kind}`)
    }
    // Identity resolution is a deployment-environment invariant: it must
    // succeed in EVERY mode (fatal otherwise — selftest included), so a bad
    // group/user spec can never ship unnoticed to the root --apply (ROUND 1
    // lesson: `id -g staff` treats the GROUP as a user and fails; groups are
    // resolved through the grp database instead).
    const uid = Number(execFileSync('id', ['-u', uidSpec], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim())
    const gid = Number(execFileSync('python3', ['-c', 'import grp,sys;print(grp.getgrnam(sys.argv[1]).gr_gid)', gidSpec], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim())
    try {
      fchownSync(fd, uid, gid)
      fchmodSync(fd, fileMode)
    } catch (error) {
      // unprivileged modes swallow only the expected EPERM on fchown/fchmod
      if (mode === 'apply' || error.code !== 'EPERM') throw error
    }
    return fstatSync(fd)
  } finally { closeSync(fd) }
}

/**
 * Repair the W1 evidence log BEFORE W1/W2 start. An existing log is NEVER
 * truncated — ownership/mode repair only, bytes preserved (size receipted
 * pre/post); a missing log is pre-created empty.
 * Also retires the RUNBOOK's 0777 placeholder on the reconciliation-evidence
 * dir: 0750 yanfenma:oc-canary (oc-canary 599 is the existing group both the
 * relay owner and the W1 reader already share; root bypasses; no world bits).
 */
export function repairWatchdogEvidenceChannel({ ctx, mode, phase, execFileSync }) {
  assertNoFollowCapable()
  const stateDir = ctx.watchdogStateDir
  const evidenceLog = join(stateDir, 'scheduler-watchdog-evidence.jsonl')
  const pre = existsSync(evidenceLog) ? statSync(evidenceLog) : null
  const post = repairOwnershipNoFollow({ mode, execFileSync, path: evidenceLog, kind: 'file', uidSpec: 'authsvc', gidSpec: 'staff', fileMode: 0o644 })
  const bytesPreserved = !pre || post.size >= pre.size
  phase('watchdog-evidence-ownership', bytesPreserved,
    `evidence log uid ${pre?.uid ?? 'absent'}->${post.uid} gid ${pre?.gid ?? 'absent'}->${post.gid} mode ${(post.mode & 0o7777).toString(8)} size ${pre?.size ?? 0}->${post.size} (bytes preserved; O_NOFOLLOW fd-based ownership)`)
  if (!bytesPreserved) throw new Error('phase watchdog-evidence-ownership failed: evidence bytes lost')

  const evidenceDir = dirname(ctx.evidenceFile ?? '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl')
  mkdirSync(evidenceDir, { recursive: true })
  const dirPre = statSync(evidenceDir).mode & 0o7777
  const dirPostSt = repairOwnershipNoFollow({ mode, execFileSync, path: evidenceDir, kind: 'directory', uidSpec: 'yanfenma', gidSpec: 'oc-canary', fileMode: 0o750 })
  const dirPost = dirPostSt.mode & 0o7777
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
    // env sanitized exactly like CTX.asAuthsvc (env -i + pinned HOME/PATH)
    try {
      execFileSync('sudo', ['-u', 'authsvc', 'env', '-i',
        'HOME=/Users/authsvc',
        'PATH=/usr/local/libexec/agent-core/node-runtime/bin:/usr/local/bin:/usr/bin:/bin',
        '/usr/bin/test', '-w', evidenceLog], { stdio: ['ignore', 'pipe', 'pipe'] })
      appendable = true
      appendDetail = 'authsvc -w probe on evidence log (non-mutating)'
    } catch (error) {
      let st
      try {
        const fs = statSync(evidenceLog)
        st = `file uid=${fs.uid} gid=${fs.gid} mode=${(fs.mode & 0o7777).toString(8)} nlink=${fs.nlink}`
      } catch (e) { st = 'file stat failed: ' + e.code }
      const errText = (error.stderr && error.stderr.length) ? String(error.stderr).trim() : String(error.message || error)
      appendDetail = `probe failed [${st}]: ${errText.slice(0, 200)}`
    }
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
