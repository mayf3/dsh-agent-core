# SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 — Deployment Freeze Packet v1

Frozen: 2026-09-18 ~09:0x+08. Mode: PHASE_C_PRODUCTION_DEPLOYMENT_GATE (packet only — NO deploy, NO restart, NO reconcile, NO production mutation performed by this lane).

## 1. Fresh coordinates

```text
CURRENT_MAIN_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6   (merge commit of PR #305; fresh fetch)
CURRENT_PRODUCTION_DEPLOYED_SHA(PLIST CLAIM)=d602b592fad345fb1c9adebe2bc6611a6f5cfdc2
   source: /Library/LaunchDaemons/ai.agent-core.runtime.plist AGENT_CORE_DEPLOYED_SHA (read fresh)
DEPLOYED_APP_TREE_ACTUAL_BYTES=MIXED — see R-1 below (scheduler subtree matches 62905c1055b3d2c2459b346711f5c5aa4253001f, a 2026-09-13 commit; NOT d602b592's scheduler bytes; admission-isolation.js absent on disk as expected for a pre-self-healing tree)
PRODUCTION_RUNTIME_PROCESS=pid 53645 (authsvc), started 2026-09-18 06:44:17 +08, KeepAlive=true, Label ai.agent-core.runtime
```

### R-1 PREFLIGHT GAP (Owner must resolve before authorization)

App tree at /usr/local/libexec/agent-core/app was wholesale rewritten and the runtime restarted at **2026-09-18 06:44 +08** (all mtimes 06:44; process started 06:44:17; parent dir mtime 06:44). The acting identity is NOT verifiable by the operator: /usr/local/libexec/agent-core/.deploy-receipts/ is root-only (0700); sudo requires the Owner password wall. The plist still claims d602b592 while on-disk scheduler bytes match the older 62905c1 (2026-09-13). Required from Owner: identify the 06:44 action (who/what/which bytes/receipt) and confirm whether the current running app is an intended baseline.

## 2. Slot / lock / health (fresh reads)

```text
PRODUCTION_MUTATION_SLOT=AMBIGUOUS_UNRESOLVED_MORNING_ACTION — an unattributed production write+restart occurred 06:44 today. Under PRODUCTION_MUTATION_CONCURRENCY=1 the slot is NOT declared FREE until the Owner attributes the 06:44 action and confirms it is complete.
CURRENT_LANE_OWNER=this lane (SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 Phase C) requests the slot; no other lane is known-active from memory, but the 06:44 action is unattributed.
LOCK_STATE=scheduler store dir /Users/authsvc/.agent-core/scheduler/ is operator-unreadable (authsvc perms; EACCES observed) — mutation/engine lock files must be checked as root inside the authorized deploy runbook (jobs.json.lock, jobs.json.engine.lock). W1/W2 watchdog LaunchDaemons present.
RUNTIME_HEALTH=process alive (pid 53645, uptime ~2h at freeze); W2 heartbeat fresh (ts 1788803126312 ≈ 08:25+08) and w2.log tail 08:38 "suppressed_or_healthy"; store/runs.jsonl/operator-side health rows NOT directly readable (read boundary recorded — health rows inside runs.jsonl must be read as root in the runbook preflight). PRODUCT_API_ENABLED=0 unchanged (known finalize debt, orthogonal).
```

## 3. Deployment scope (whole-main — NOT "only PR #305")

```text
ARTIFACT_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6 (= current main; includes PR #305 merge, #306 docs acceptance, and every other commit since the plist-claimed d602b592: 26 commits)
PRODUCTION_CODE_DELTA=d602b592..41f354d touches ONLY packages/scheduler (14 files, +1587/−309): the self-healing implementation (C-SH-001..004), the WGR cross-revision fix bytes, the F1-F5 closures. Zero production-code changes in packages/production-runtime, packages/broker, packages/agent-router, scripts/.
DOCS_DELTA=14 docs commits (incl. #306 parent-runtime outcome-unknown recovery authority acceptance) ride along in the artifact but do not affect runtime behavior.
BASIS NOTE: because the on-disk scheduler subtree is OLDER than d602b592 (62905c1-era, R-1), the effective on-disk upgrade for packages/scheduler is 62905c1-era -> 41f354d; the deploy runbook must copy the WHOLE packages/scheduler + its transitive deps, never a file-diff against d602b592.
```

## 4. Artifact binding

```text
ARTIFACT_EXPORT=git archive of 41f354d163f532348b2ad1ef33b5ee528655dfc6
ARTIFACT_TAR=/tmp/dsh-selfheal-artifact-41f354d.tar.gz
ARTIFACT_SHA256=7286078929b2d97d86cc36ac2681eaa3f7194a703fc72f0d803eba081d7c2db2
KEY FILE SHA256 (first 16 hex):
  e3e8dce0fd895933  packages/scheduler/src/scheduler.js
  939863a5d706c74c  packages/scheduler/src/eligibility.js
  5c770d5e99ebc20f  packages/scheduler/src/watchdog/admission-isolation.js
  0fcb6811f53278f2  packages/scheduler/src/self-ops/index.js
  4038e4f88086f49b  packages/scheduler/src/self-ops/diagnosis.js
  86f547f3ee51b291  packages/scheduler/src/occurrence.js
  a8eacf4f16edd207  packages/scheduler/src/store.js
CANDIDATE VERIFICATION AT FREEZE: scheduler suite 372/372, broker 477/477 (run on this tree), structure gate new-violations=0 vs main.
```

## 5. PRODUCTION_PREIMAGE (root-captured immediately BEFORE deploy, commands for the authorized runbook)

```text
P1  cp -a /usr/local/libexec/agent-core/app /usr/local/libexec/agent-core/.preimage-app-$(date -u +%Y%m%dT%H%M%SZ)   # full tree
P2  shasum -a 256 the preimage tree manifest (find . -type f | sort | xargs shasum -a 256) -> record in receipt
P3  cp /Library/LaunchDaemons/ai.agent-core.runtime.plist <preimage-dir>/ (exact bytes, version:1 envelope untouched)
P4  cp -a /Users/authsvc/.agent-core/scheduler/jobs.json runs.jsonl <preimage-dir>/ + sha256
P5  read HR job state: jq '.jobs[] | select(.id|startswith("b115cb96")) | {id, retry, scheduleRevision, enabled}' jobs.json
    EXPECTED (A mitigation must hold at preimage): retry.auto=false, scheduleRevision=3
P6  record .deploy-receipts/ listing (root) — closes R-1 if the 06:44 receipt is found there
P7  record launchctl print system/ai.agent-core.runtime (pid, last exit, state)
```

## 6. ROLLBACK_PREIMAGE (completeness)

```text
RB1 restore app tree from P1 preimage dir (rsync --delete from the export) — byte-exact.
RB2 restore plist from P3 copy (launchctl bootout/bootstrap or kickstart per established runbook; version:1 envelope invariant).
RB3 STORE COMPATIBILITY: rollback is store-safe — this PR changes NO store schema (v3 document unchanged; _validateDocument untouched semantics; retry_admission_failure / retry_superseded_by_revision / global_tick_blocked are append-only runs.jsonl evidence the OLD code already parses-and-ignores: readRunEvents parses lines generically and _validateDocument validates only the document, not evidence events). Downgrade restores the previous behavior on the SAME store without repair.
RB4 NO store rollback is contemplated (store is class-1 authority; new code is backward-compatible with it and old code is forward-compatible with the evidence appended by new code).
RB5 verify rollback: runtime up, tick error delta=0, W1/W2 fresh, plist SHA restored.
```

## 7. Review state at freeze

```text
MECHANICAL_REVIEW=PASS (this packet: scope enumeration scheduler-only verified by git diff --name-only; artifact hashes bound to 41f354d; suites+gate re-run on candidate; scratch-merge onto drifted main 72e1985 verified clean + green before #305 merge and re-derivable)
PRODUCTION_SAFETY_REVIEW=independent agent review executed on this packet + scope diff (result recorded below in §9)
FOLLOW_UP_DEBT (registered, NOT in this gate's scope unless a fresh review escalates to P1+):
  D1 Codex d7c457a P2 (scheduler.js:266): stale receipt lost if runs.jsonl append fails continuously until a newer terminal supersedes the stale verdict — spec §1 mark-on-ok is frozen; degradation is a named-classification gap, NOT a silent slot loss (occurrence/slot receipts remain).
  D2 Codex d7c457a P2/Medium (diagnosis.js:75): job_disposition full-retained-scan resource hardening (per-caller budget / filtered read) — full scan is the F3-mandated anti-false-negative direction; readRunEvents already read the whole file pre-change.
```

## 8. Deployment mechanism

PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 is accepted for implementation only — agent-deployd bootstrap has NOT occurred, so this deployment uses the established owner-supervised selective-overlay runbook pattern (as d602b592 did): root-executed, receipted, with the §5 preimage and §6 rollback executed verbatim. Deployment executes ONLY on explicit Owner authorization of this packet.

## 9. Independent production safety review

See SAFETY-REVIEW.md in this directory (appended by the reviewing agent at freeze time).
