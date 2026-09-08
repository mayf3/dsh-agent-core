#!/usr/bin/env node
/**
 * scheduler-cp-postrepair — incident post-repair diagnostic + mechanical
 * restoration (root, ONE sudo). Phases:
 *   D1 store file ownership/mtime (root-run admission writes break authsvc)
 *   D2 store census: the two criticals' enabled/keyed + occurrence
 *      6c4cccaf… state (terminal failed vs unresolved-again)
 *   D3 W1 alert-state.json + evidence tail + pending-alert (delivery truth)
 *   D4 live watchdog bytes (new dedupe machinery present?)
 *   R1 restore store ownership -> authsvc:staff (if root-owned)
 *   R2 re-run canonical reconcile for 6c4cccaf IF unresolved-again
 *      (same C-029 primitive, chown restore after write)
 *   R3 refresh live watchdog bytes from the merged worktree
 *   Final re-diagnose + verdict. Every step PRINTS; failures never abort the
 *   remaining diagnostics.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, statSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const WORKTREE = '/Users/yanfenma/workspace/project/dsh-agent-core/.worktree/sched-cp-alert-dedupe'
const STORE = '/Users/authsvc/.agent-core/scheduler/jobs.json'
const LIVE = '/usr/local/libexec/agent-core/app'
const STATE_DIR = '/Users/authsvc/.agent-core/control/scheduler-watchdog'
const say = (m) => process.stdout.write(`[postrepair] ${m}\n`)
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
const out = []
const diag = (label, detail) => { out.push({ label, detail }); say(`${label}: ${detail}`) }

// D1 ownership
let st = statSync(STORE)
diag('D1-store-owner', `${st.uid}:${st.gid} mtime=${st.mtime.toISOString()} size=${st.size}`)
const storeRootOwned = st.uid === 0

// D2 census (raw read; root can read)
const doc = JSON.parse(readFileSync(STORE, 'utf8'))
const jobCount = (doc.jobs ?? []).length
const occCount = (doc.occurrences ?? []).length
const b115 = (doc.jobs ?? []).find((j) => typeof j.id === 'string' && j.id.startsWith('b115cb96'))
const daily = (doc.jobs ?? []).find((j) => typeof j.id === 'string' && j.id.startsWith('fa13b0ea'))
const stuck = (doc.occurrences ?? []).find((o) => typeof o.occurrenceId === 'string' && o.occurrenceId.includes('6c4cccaf'))
diag('D2-counts', `jobs=${jobCount} occurrences=${occCount}`)
diag('D2-daily-critical', daily ? `enabled=${daily.enabled === true} keyed=${daily.logicalKey ?? 'NO'}` : 'NOT FOUND')
diag('D2-hr-critical', b115 ? `enabled=${b115.enabled === true} keyed=${b115.logicalKey ?? 'NO'} lastStatus=${b115.state?.lastStatus ?? '-'}` : 'NOT FOUND')
diag('D2-stuck-occurrence', stuck ? `state=${stuck.state} endedAt=${stuck.endedAt ?? 'MISSING'} lateSettlement=${stuck.lateSettlement?.basis ?? 'none'}` : 'NOT FOUND')
const unresolvedAgain = stuck && stuck.startedAt !== null && stuck.endedAt === undefined && stuck.state === 'outcome_unknown'

// D3 W1 alert state + delivery truth
try {
  const alertState = readFileSync(join(STATE_DIR, 'alert-state.json'), 'utf8')
  diag('D3-alert-state', alertState.slice(0, 400))
} catch (e) { diag('D3-alert-state', `unreadable: ${String(e).slice(0, 80)}`) }
try {
  const ev = run('tail', ['-12', join(STATE_DIR, 'scheduler-watchdog-evidence.jsonl')], { encoding: 'utf8' })
  diag('D3-w1-evidence-tail', ev.split('\n').slice(-6).join(' ⏎ ').slice(0, 800))
} catch (e) { diag('D3-w1-evidence-tail', `unreadable: ${String(e).slice(0, 80)}`) }
try {
  const pending = readFileSync(join(STATE_DIR, 'pending-alert.txt'), 'utf8')
  diag('D3-pending-alert', pending.slice(0, 500))
} catch { diag('D3-pending-alert', 'none') }

// D4 live watchdog bytes
const liveW1 = readFileSync(join(LIVE, 'scripts/scheduler-watchdog.mjs'), 'utf8')
const liveWd = readFileSync(join(LIVE, 'packages/scheduler/src/watchdog.js'), 'utf8')
diag('D4-live-w1-bytes', liveW1.includes('ALERT_STATE_FILE') ? 'NEW (dedupe live)' : 'OLD (dedupe absent — W1 still storms)')
diag('D4-live-wd-bytes', liveWd.includes('updateAlertState') ? 'NEW' : 'OLD')

// ── mechanical restorations (all restore already-authorized state) ──────────
if (process.argv.includes('--repair')) {
  if (storeRootOwned) {
    run('chown', ['authsvc:staff', STORE])
    diag('R1-store-owner', `restored authsvc:staff (was root — engine could not write; THIS was the reconcile write's missing chown, tool defect fixed for future)`)
  }
  if (unresolvedAgain) {
    const { JobStore } = await import('../packages/scheduler/src/store.js')
    const { reconcileOccurrence } = await import('../packages/scheduler/src/control.js')
    const store = new JobStore(STORE, { runLogPath: join(STORE, '..', 'runs.jsonl') })
    const result = await reconcileOccurrence(store, {
      occurrenceId: stuck.occurrenceId, runId: stuck.runId, resolvedTo: 'failed',
      evidenceNote: 'operator re-reconcile: prior terminal write was overwritten by a concurrent whole-store write; terminal fact = failed (interrupted, unresumable)',
    })
    run('chown', ['authsvc:staff', STORE])
    diag('R2-re-reconcile', `occurrence -> ${result.record.state}; fenceRemaining=${result.fenceRemaining}; ownership restored`)
  }
  copyFileSync(join(WORKTREE, 'scripts/scheduler-watchdog.mjs'), join(LIVE, 'scripts/scheduler-watchdog.mjs'))
  copyFileSync(join(WORKTREE, 'packages/scheduler/src/watchdog.js'), join(LIVE, 'packages/scheduler/src/watchdog.js'))
  diag('R3-watchdog-bytes', 'refreshed from merged worktree (next W1 fire runs dedupe machinery; no restart needed)')
}

// final re-diagnose
const st2 = statSync(STORE)
const w1now = readFileSync(join(LIVE, 'scripts/scheduler-watchdog.mjs'), 'utf8')
diag('FINAL-store-owner', `${st2.uid}:${st2.gid}`)
diag('FINAL-live-w1-bytes', w1now.includes('ALERT_STATE_FILE') ? 'NEW' : 'OLD')
const stuck2 = (() => { try { return (JSON.parse(readFileSync(STORE, 'utf8')).occurrences ?? []).find((o) => String(o.occurrenceId).includes('6c4cccaf')) } catch { return null } })()
diag('FINAL-stuck-occurrence', stuck2 ? `state=${stuck2.state} endedAt=${stuck2.endedAt ?? 'MISSING'}` : 'not found')
say(process.argv.includes('--repair') ? 'DONE (repair mode)' : 'DIAGNOSE ONLY — rerun with --repair to apply mechanical restorations')
