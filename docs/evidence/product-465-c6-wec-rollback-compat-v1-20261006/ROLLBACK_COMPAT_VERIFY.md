# PRODUCT_465_C6_WEC_ROLLBACK_COMPAT_V1 — bounded TEST_IDENTITY verification (2026-10-06)

```text
PURPOSE         = #465 ([PRODUCT C6] WEC rollback compatibility; Program #382, Index #377):
                  resolve the old-binary/schema readiness mismatch before relying on WEC
                  rollback — mechanically check rollback-target compatibility against
                  schema/runtime expectations and prove one bounded isolated
                  rollback/readback fixture that cannot silently let an old consumer
                  corrupt forward schema/outbox semantics.
CLAIM           = c6-wec-rollback-r249 (agent-control#454; round 249)
SESSION         = sess_2540e067-cc03-4186-85ec-e31fb7df55a9
EXECUTION_HEAD  = dsh-agent-core e9699aee (branch ac-task/454; same tree as github/main)
WORKTREE        = /Users/yanfenma/workspace/.zcode-worktrees/workspace+project+dsh-agent-core/ac-454
AUTHORITY       = Owner-accepted WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_ROLLBACK_AMENDMENT
                  (SHA-256 b76fa3aa…) + pinned 0027-empty-only-recovery.sql
                  (SHA-256 49cf0921…), accepted 2026-09-24, binding PR svc#67 (open) +
                  SVC_WORKFLOW_EXECUTION_CONTROL_V1 (accepted; impl svc#65 merged) +
                  C5 #406 census (frozen production boundary) + C8 #466 closure
                  (consumer-side rollback-safety precedent) + #465/#377/#382/#386
                  fresh-read 2026-10-06.
DEVELOPMENT_PREFLIGHT = emitted before any authoring (chat + this header). Problem /
                  Governing Spec / status=accepted / rejected alternative =
                  package's original "binary-only rollback; 0027 tables are inert"
                  bullet (falsified by the Owner-accepted amendment). Need new/amended
                  Spec = NO (VERIFY_ONLY, zero product source change).
PRODUCTION_MUTATION = NO. Read-only live census (curl GET /version|/healthz|/readyz,
                  ledger/ps/ls/env-key-count); executable work ONLY in /tmp against a
                  disposable initdb PostgreSQL 16.15 on a random 127.0.0.1 port
                  (final receipts: run of 2026-10-06 07:44 local, PG port ≈56205;
                  torn down and VERIFIED torn down at exit). No deploy/restart/sudo/
                  credential/raw-store-edit/UNKNOWN-replay/Remote Desktop; targeted
                  kills of fixture-owned child processes only (kill_verified + port
                  sweeps; post-run zero-leak state independently confirmed).
PROTECTED WRITERS = #468 / agent-control#453 found CLOSED at 2026-10-05T22:26:42Z
                  (PR dsh#485 MERGED, file packages/product-api/test/
                  admin-turn-abandonment-d3-convergence.test.js) — zero file overlap
                  with this lane's docs/evidence/product-465-* changes.
METHOD          = REUSE first: the Owner-accepted amendment, the pinned recovery SQL,
                  the exact on-disk release artifacts (preimage + candidate) and the
                  release-dir conventions are used UNCHANGED. One new evidence-only
                  fixture script (this dir, c6_wec_rollback_compat_fixture.sh) re-runs
                  the mechanical matrix fresh. Zero product source/migration/script
                  changes in dsh-agent-core, svc-workflow, svc-forum.
```

## 1. SOURCE (fresh-read 2026-10-06)

```text
requirement : #465 DONE_WHEN (see PURPOSE). ACCEPTANCE_MODE=TEST_IDENTITY,
              DISPOSITION=INTEGRATE→VERIFY_ONLY-this-lane, WAVE=W2, PROD_AUTH=NONE.
svc line    : github/main 7c533cfc (migrations 1..28 — 0028_owner_assistance_wake_outbox
              landed on main 2026-09-28, commit 20ebd70; src/http/mod.rs
              EXPECTED_MIGRATION_VERSION=28; /readyz exact-ledger gate in
              src/http/handlers/health.rs — applied successful versions must equal
              EXACTLY 1..=EXPECTED_MIGRATION_VERSION with zero failures, else 503
              migration_version_mismatch; unit test
              readiness_requires_the_complete_exact_ledger pinned in-tree).
svc Draft   : PR #71 (audit/workflow-outbox-release-20261003 @7f8d549, already
              carries 0028/EXPECTED=28) — the WAKE unknown-kind RETENTION fix +
              scripts/release.sh (build→provenance→deploy→ledger→restart→verify,
              fail-closed lock) + scripts/test_release.sh; e2e asserts /readyz 503
              migration_version_mismatch (tests/17…/scenario.rs).
preimage    : f6a74001 (2026-09-18, OWNER A_PRIME_EXACT_ARTIFACT_REFREEZE; sqlx 0.8.6;
              boot runs sqlx Migrator over its relative 26-file migrations/ dir, then
              serves; /readyz exact-ledger gate with EXPECTED_MIGRATION_VERSION=26).
amendment   : PR svc#67 "docs: bind accepted WEC 0027 rollback amendment" — OPEN,
              MERGEABLE/CLEAN, binds the Owner-accepted empty-only rollback semantics
              into docs/deployment/WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_PACKAGE.md.
dsh side    : WEC trace/kick source lives on audit branches (e.g.
              audit/wec-positive-quiescence-20261003 @3d3e2d83 carries
              packages/product-api/src/workflow-execution-routes.js +
              packages/production-runtime/src/workflow-execution-runtime.js) — NOT on
              dsh main; package rollback bullet: "ledger files replay byte-identically
              on either version (additive event fields only)".
forum side  : package rollback bullet: DROP INDEX
              uq_forum_threads_workflow_instance_context + roll back bytes; forum is
              projection-only. Exact boundary frozen by #406 (recreate svc-forum from
              image svc-forum:wec-4c0c321d / b2694719be77; rollback image 65cefb927020).
              Local svc-forum checkout (01085af) predates the WEC image bytes — census
              is by #406's frozen record, not re-derived locally.
```

## 2. INSTALLED / ENABLED (live, read-only, 2026-10-06)

```text
svc binary  : PID 25143 (started 2026-10-01T20:40:41 local) at 127.0.0.1:8989;
              /version gitSha 9f7c2483aa2147cb29cf7e192aca2d1fd50293f5, treeState
              clean, built 2026-09-24T10:52:00Z; /healthz 200; /readyz 200.
              Running binary sha256 0f63ec53… == ledger newest entry (sourceSha
              9f7c2483, migrationMaxVersion 0027, deployedAt 2026-09-24T14:21:50Z,
              previousArtifact 4dc49839…) == releases/9f7c2483…/svc-workflow.
svc schema  : reviewed 27-file bundle; release-dir bundle digest b2824bf4… ==
              provenance migrationBundleDigest; artifacts-package copy byte-identical
              (whole-file 0869d24c…; per-file manifest sha256 -c all OK).
preimage    : releases/f6a74001…/svc-workflow sha256 4dc49839… (embedded gitSha
              f6a74001…, frozen_by OWNER refreeze 2026-09-18) + its 26-file bundle
              digest 57635e82… == the 0026-generation migrationBundleDigest recorded
              in ledger entries 2026-09-14/16/18. Files 1..26 are BYTE-IDENTICAL
              between preimage and candidate bundles (shasum diff empty).
svc ENABLED : .env contains 0 WORKFLOW_EXECUTION_KICK*/WORKFLOW_FORUM* keys → WEC
              reconciler/kick OFF (matches #406 ENABLED=no).
dsh runtime : NOTHING listening on 8788 (lsof empty; launchd com.dsh.web not loaded)
              → WEC dsh trace/kick runtime DOWN (Phase-1 was rolled back after the
              workspace-link EACCES; PR #67 body).
forum       : per #406 — image-backed, INSTALLED but not cleanly rebuildable; WEC
              ENABLED=no. Not re-probed (no container contact in this lane).
=> SOURCE=merged (svc 0027 line) / INSTALLED=partial (svc binary+0027 installed;
   forum hot-patched; dsh runtime down) / ENABLED=no / BUSINESS_VERIFIED=no.
```

## 3. The exact old-binary/schema readiness mismatch (fresh mechanical proof)

The accepted deployment package's ORIGINAL svc rollback bullet claimed a binary-only
rollback works ("0027 tables are inert; no old code touches them"). Owner-accepted
amendment (PR #67) already documents the bound: after 0027 commits, binary-only
rollback is NOT viable; empty-only schema recovery is permitted only pre-launch under
a NO_WEC_WRITE_FENCE, else forward recovery. This fixture re-proves the mismatch
FRESH against the exact pinned artifacts, and finds the refusal is even stronger than
the amendment narrative's "/readyz 503":

**C1 — preimage vs forward schema 1..27 (seeded WEC rows present):**
`releases/f6a74001…/svc-workflow` (its own 26-file bundle, sqlx 0.8.6) PANICS AT BOOT:
`failed to run database migrations: VersionMissing(27)` at
src/store/postgres/migrations.rs:23 — it never opens a listener (connection refused).
A boot-time abort strictly dominates a 503: zero business queries, zero reconciler
runs. With one workflow_outbox FORUM_EVENT row + one workflow_forum_bindings PENDING
row seeded, before/after fingerprints and md5 row digests are BYTE-IDENTICAL
(c1-mismatch.txt). Structural: the preimage binary contains 0 strings for either
forward table and its source tree references 0 files naming them (c1b-structural.txt)
— an old consumer CANNOT silently corrupt forward schema/outbox semantics: it cannot
start, and it cannot even name the tables.

**C2 — pinned empty-only recovery + readback:** on the exact empty 0027 state
(ledger 27|0, both tables present+empty) the pinned recovery SQL COMMITS; readback is
exactly ledger {1..26} all-success, both WEC tables absent; then the same preimage
binary boots, /version reports gitSha f6a74001…, and /readyz returns 200
{"status":"ready"} (c2-empty-recovery-readback.txt, c2-old-binary-readback.log) —
the amendment's postcondition gate sequence is exactly satisfiable with the on-disk
artifacts.

**Fail-closed negatives (each state-retaining, exact refusal codes):**
| case | refusal | retained |
|---|---|---|
| N1 outbox 1 row | RECOVERY_BLOCKED_WORKFLOW_OUTBOX_NOT_EMPTY | 27\|0\|tables\|1\|0 |
| N2 binding 1 row | RECOVERY_BLOCKED_WORKFLOW_FORUM_BINDINGS_NOT_EMPTY | 27\|0\|tables\|0\|1 |
| N3 wrong db name | RECOVERY_BLOCKED_DATABASE_IDENTITY_MISMATCH | untouched |
| N4 rogue outbox column | RECOVERY_BLOCKED_OUTBOX_COLUMNS_MISMATCH | 27\|0\|tables\|0\|0 |

**Corroboration (static, pinned):** the exact-ledger /readyz gate and its unit test
`readiness_requires_the_complete_exact_ledger` exist at f6a74001, at github/main
7c533cfc, and on the PR #71 line; the PR #71 e2e asserts 503 +
migration_version_mismatch for ledger drift (tests/17_workflow_runtime/http/e2e/
scenario.rs). A cold in-repo cargo run was NOT repeated in this lane: the artifact
level fixture above exercises the real binaries end-to-end, which is the stronger,
release-vehicle-faithful check.

## 4. GAP / reconciliation

```text
GAP-1 (bounded, pre-existing, docs/operation surface):
  The falsified binary-only rollback bullet is STILL what
  docs/deployment/WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_PACKAGE.md serves on
  github/main (7c533cfc) and on the Draft PR #71 branch. The Owner-accepted binding
  is PR svc#67 — OPEN, MERGEABLE/CLEAN, docs-only, byte-pinned.
  → NEXT BOUNDED ACTION: merge svc PR #67 (pre-accepted content), then carry the
    same bullet text into the #71 line before any next svc release.
GAP-2 (nuance, non-blocking, no reopening):
  PR #67's narrative says the old binary "returns /readyz 503 with a version
  mismatch after 0027". The EXACT pinned preimage instead aborts at boot
  (VersionMissing(27) panic; listener never opens). This STRENGTHENS the amendment
  (refusal earlier and harder); the amendment's three-state lifecycle, trigger and
  postconditions are unchanged and were re-proven in C2. Record-only; recommend the
  PR #67 text keep its existing wording (it was Owner-accepted byte-pinned) — the
  nuance lives in this evidence file.
GAP-3 (scoped follow-up, matches C8 closure note):
  The gate remains procedural, not tooling-enforced: scripts/release.sh's (PR #71
  line) rollback path does not yet enforce the empty-only preconditions/readback
  gates. Out of this lane (release-vehicle change on another lane's open PR).
FORWARD WORLD (already true on the main line, owned elsewhere): github/main has
  carried 0028 since 2026-09-28, so the pinned 0027-empty-only recovery is ALREADY
  structurally retired for main-line rollbacks — it pins ledger exactly 1..27 while
  main binaries expect 1..28 (N3/N4-style gates fail closed on any drift);
  a main-line rollback path must be defined by the #407/C8 lanes (consumer behavior
  is proven safe there; a 0028-generation schema recovery does not exist and is not
  authorized by this evidence).
DEPLOYED FACT vs MAIN LINE: production svc remains the 0027-generation binary
  9f7c2483 (deployed 2026-09-24, no deploy since) — the deployed rollback story is
  exactly what this fixture proves; the main-line 0028 world is a FUTURE release
  vehicle question for #407/PR #71, not a today-production fact.
```

## 5. Boundaries honored

```text
- No production deploy/restart/reconfiguration; the live service was only probed
  with read-only GETs on 127.0.0.1:8989.
- No sudo/credentials: .env read ONLY as a key-count grep (0 hits printed, no
  values surfaced); no DSNs copied.
- No raw durable-store edits: production DB never touched; all SQL ran against a
  disposable initdb cluster destroyed at exit (trap: stops PG, kills fixture-owned
  stubs/binaries, removes /tmp tree).
- Targeted process management only: the fixture's own children (disposable PG,
  JWKS stub python, preimage binary). No broad kills; no Remote Desktop.
- Teardown receipt (r2-hardened): spawns use direct `background + exec` so every
  recorded PID is the real process; the trap SIGTERMs, WAITS for exit, escalates
  to SIGKILL, then sweeps every port the run bound (listener kill) and stops the
  disposable PG. Post-run verification: zero fixture processes remain (only the
  production svc-workflow PID 25143 — untouched), no listener on any fixture port,
  no /tmp residue.
- No UNKNOWN replay; no poller enablement; WEC stays ENABLED=no everywhere.
- Protected writers re-checked: agent-control#453 CLOSED (PR dsh#485 merged);
  no file overlap with this evidence-only lane.
```

## 6. VERDICT

```text
VERIFY_ONLY            = YES (existing accepted machinery satisfies DONE_WHEN; fresh
                         mechanical evidence re-produced 2026-10-06; zero source fix
                         required → no RED-first change, no new PR on svc-workflow)
ROLLBACK_COMPAT_MATRIX = C0 PASS / C1 PASS / C1b PASS / C2 PASS / N1-N4 PASS
                         (ALL_CASES_PASS, VERDICT.txt; final hardened-script run
                         2026-10-06 with zero process leaks)
BUSINESS_VERIFIED      = no (unchanged; WEC enablement remains gated on #407/#406
                         owner decisions — this lane does NOT claim deployment or
                         enablement progress)
RECONCILE              = svc PR #67 merge recommendation + GAP-2/GAP-3 notes for the
                         release-vehicle lanes
PRODUCTION_MUTATION    = NO
```

## 7. Independent changed-surface review record

```text
R1 (2026-10-06, independent read-only reviewer):
  VERDICT=FAIL — 1 blocker, 4 minors, checks 1/2a/2b/2d/3/4/5 all PASS.
  BLOCKER-1: teardown claim falsified — earlier rehearsal runs leaked 4 JWKS stub
  pythons + 1 preimage listener (PID capture through the bg-compound subshell was
  wrong; trap had no verification/escalation). Evidence content itself fully
  confirmed (all hashes, refusal codes, source claims independently reproduced).
  MINOR-1: report §1 wrongly said main carries migrations 1..27 — corrected to
  1..28 (0028 on main since 2026-09-28).
  MINOR-2: DATABASE_URL guard wording overstated — connection isolation is real
  (every DSN constructed from 127.0.0.1:$PG_PORT); wording softened.
  MINOR-3: C1 fixed sleep → exit-poll; c2-recovery-sql.out receipt added.
  MINOR-4: N3 lacked a retained-fingerprint receipt — added.
REMEDIATION (same session): leaked PIDs killed (verified 0 remaining); script
  hardened (direct bg+exec spawns, kill_verified with SIGKILL escalation, per-port
  listener sweeps, PG pkill); §1/GAP wording fixed; fixture re-run → ALL_CASES_PASS
  with zero leaks.
R2 (same reviewer, re-review 2026-10-06): VERDICT=PASS / 0 blockers / 3 cosmetic
  minors (stale R1 port citation in header — fixed; R2 verdict placeholder — now
  filled with the actual R2 outcome; ineffective `return` in the EXIT trap —
  annotated in the script). R2 independently re-verified: zero leftover fixture
  processes/listeners/tmp residue, hardened spawn+teardown in full, regenerated
  receipts identical in substance (C1 panic, C2 commit+readback 200, N1–N4 codes),
  all six artifact pins re-hashed unchanged, and the §1 main-line 1..28 wording.
  "The lane is acceptable for its DONE_WHEN claim."
```

## 8. Reproduce

```bash
bash docs/evidence/product-465-c6-wec-rollback-compat-v1-20261006/\
c6_wec_rollback_compat_fixture.sh docs/evidence/product-465-c6-wec-rollback-compat-v1-20261006
# exit 0 + VERDICT.txt ALL_CASES_PASS; requires: bash3, python3, openssl, curl, jq,
# shasum, git, lsof, PostgreSQL 16 client/server (initdb/pg_ctl/psql) on PATH
# defaults. The script never reads any ambient DATABASE_URL — every connection it
# makes is constructed to its own 127.0.0.1:<random-port> disposable cluster, and
# the teardown is verified (SIGTERM→wait→SIGKILL + port sweeps) before exit.
```
