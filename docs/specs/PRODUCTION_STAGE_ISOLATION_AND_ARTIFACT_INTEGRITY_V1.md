---
spec_id: PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1
status: accepted
date: 2026-09-08
accepted_date: 2026-09-08
accepted_reviewed_head: 6d74a9b
independent_spec_review: PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1_SPEC_REVIEW_R1
independent_spec_review_result: PASS (ACCEPT at 6d74a9b; 15/15 mandatory questions PASS; SHIP_BLOCKERS=NONE; 3 non-blocking mechanical concerns absorbed as AMENDMENT_1; core question CANDIDATE_BYTES_AFTER_SEAL_CANNOT_SILENTLY_CHANGE judged closed; cross-references to census + SB4 spot-verified real)
required_fixes: NONE (AMENDMENT_1 pins rollback capture moment, runner meta-integrity, per-surface isolation gate semantics — semantic invariants unchanged)
amendments:
  - AMENDMENT_1 (2026-09-08, docs-only clarification, semantic invariants unchanged): (A1.1) rollback population moment pinned —
    EXPECTED_PREIMAGE_HASH is DECLARED at prepare time from the live target state (ABSENT sentinel if unreadable); rollback/
    bytes are CAPTUREED at apply time only after gate-3 verifies live == declaration, then rollback/ gets its own MANIFEST.sha256;
    exactly one capture moment (apply), removing the §5 "at seal time vs during preimage check" ambiguity. (A1.2) runner
    meta-integrity — seal.json records the runner's own sha256; apply refuses if the executing runner bytes differ from
    seal.json; the apply receipt records the runner hash. (A1.3) §10 per-surface *_ISOLATION = PASS semantics defined —
    the surface's candidate-preparation entry point routes through the generation contract, demonstrated by per-surface
    fixture E2E in the required failure-test suite + migration runbook published; CURRENT_LIVE_RUNTIME_PROVENANCE
    (FU-1/FU-2) is explicitly outside gate scope.
  - AMENDMENT_2 (2026-09-08, docs-only, OWNER RULING on readiness semantics — supersedes A1.3 as a gate-value basis):
    A1.3's demonstration semantics may NOT be used to record future adoption as current PASS. §10 per-surface gates are
    two-valued (IMPLEMENTED_NOT_ADOPTED | ADOPTED_PASS); ADOPTED_PASS requires real production-path mechanical evidence
    (7 items, §12). GOAL_LEVEL READY_FOR_PRODUCTION_APPLY = NO until all four surfaces are ADOPTED_PASS. See §12.
type: implementation-spec (staging isolation + artifact integrity seam; implementation in bounded follow-up PRs under this spec)
scope:
  - Candidate generation model (ONE GOAL / ONE CANDIDATE GENERATION, unique GENERATION_ID)
  - Candidate freeze/seal mechanics (manifest + per-target hashes + seal, fail-closed drift)
  - Production apply contract (fresh-check gates, forbidden operations, FAILED_NO_MUTATION)
  - Waiting-for-slot discipline (candidate bytes immutable across slot waits)
  - Rollback preimage isolation (frozen separately from candidate)
  - Minimal migration runbook for existing production Goals (auth / svc-workflow / dsh / scheduler CLI)
references:
  - docs/investigations/PRODUCTION_STAGE_ISOLATION_CENSUS_V1.md (evidence authority for this spec)
  - docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md (SB4 operator-CLI byte pinning — reused, NOT duplicated; CLI artifact gates defer to SB4 where they overlap)
  - docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md (artifact authority model, preflight form)
  - imported incidents (goal brief 2026-09-08): auth stage pollution during slot wait; P9 auth stage bundle with another Goal's 1.11.0 uncommitted changes
owner_rulings: goal brief 2026-09-08 (invariants, apply contract, 8 required failure tests absorbed in §2/§5/§6; anti-churn constraint absorbed in §7); readiness-semantics ruling 2026-09-08 (AMENDMENT_2: A1.3 may not mark future adoption as current PASS — per-surface gates two-valued, goal-level READY_FOR_PRODUCTION_APPLY = NO until all four surfaces ADOPTED_PASS)
implementation_authority: none until status: accepted
---

# PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1

## 1. Problem & incident model

Production apply is serialized (`PRODUCTION_MUTATION_CONCURRENCY = 1`), but **candidate preparation is not isolated**. Imported incidents (accepted as evidence, not re-investigated): an auth deployment candidate/stage was polluted during a production-slot wait by another Goal's uncommitted modifications; during P9 the auth stage bundle again contained another Goal's 1.11.0 uncommitted modifications. The census (`docs/investigations/PRODUCTION_STAGE_ISOLATION_CENSUS_V1.md`) mechanically reconfirmed the pattern across all four production surfaces — including a live auth stage with 12 dirty files while serving, a live user-domain runtime executing from a 13-dirty-file checkout, the production operator CLI being a symlink into a dev checkout, and zero standing apply-time hash gates.

Root seam: **staging/candidate preparation has no identity, no freeze, no detection**. Everything downstream (apply serialization) trusts that preparation already stopped changing.

## 2. Invariants (binding on every production candidate, all components)

| Invariant | Required value |
|---|---|
| SHARED_MUTABLE_PRODUCTION_STAGE | NO |
| CANDIDATE_SOURCE_IDENTITY | EXPLICIT (source repo + SHA + tree state recorded in manifest) |
| CANDIDATE_BYTES | FROZEN at seal |
| CANDIDATE_MANIFEST | COMPLETE (fields per §4) |
| CANDIDATE_HASH | VERIFIABLE (fresh re-hash at every gate) |
| WAITING_FOR_PRODUCTION_SLOT_CAN_CHANGE_CANDIDATE_BYTES | NO |
| OTHER_GOAL_CAN_SILENTLY_MUTATE_CANDIDATE | NO (silent = undetected; any change is mechanically detected at next gate) |
| PRE_APPLY_DRIFT | FAIL_CLOSED |
| ROLLBACK_PREIMAGE | FROZEN_SEPARATELY |

Restated as review questions (all must be answerable PROVEN_NO after the test plan):

- CAN_OTHER_GOAL_MUTATE_SEALED_CANDIDATE_WITHOUT_DETECTION = NO
- CAN_APPLY_PROCEED_WITH_CANDIDATE_OR_PREIMAGE_DRIFT = NO
- CAN_APPLY_REBUILD_INSTALL_OR_PATCH_SOURCE = NO
- CAN_WAITING_FOR_SLOT_CHANGE_CANDIDATE_BYTES = NO
- CAN_CANDIDATE_BE_REPAIRED_IN_PLACE = NO (new generation instead)
- CAN_ROLLBACK_PREIMAGE_LIVE_INSIDE_MUTABLE_STAGE = NO
- CAN_SEALED_CANDIDATE_RECORD_SECRET_BYTES = NO

## 3. Candidate generation model

**ONE GOAL / ONE CANDIDATE GENERATION.** A candidate is a generation directory, not a shared stage.

```
GENERATION_ID = <GOAL_NAME>--<REPO>--<SOURCE_SHA_SHORT>--<ARCH>--g<N>
```

- `<GOAL_NAME>`: the owning goal (exactly one owner per generation).
- `<REPO>`: source repository identity.
- `<SOURCE_SHA_SHORT>`: clean/frozen source commit the candidate was produced from.
- `<ARCH>`: build/runtime architecture (e.g. x86_64, arm64, universal — the Rosetta trap makes this load-bearing).
- `g<N>`: per-goal monotonic generation counter (any byte change ⇒ g+1; never in-place edit).

Generation root convention (outside every shared checkout and every live stage):

```
~/workspace/artifacts/production-candidates/<GENERATION_ID>/
  candidate/          # exact bytes to apply (files, dependency closure)
  manifest.toml       # §4 fields
  MANIFEST.sha256     # seal: sha256 of every file under candidate/ + manifest.toml
  receipts/           # build / test / audit receipts
  rollback/           # EXPECTED_PREIMAGE frozen set (its own MANIFEST.sha256)
```

Rules:

1. Source coordinates must be clean at capture: `git rev-parse HEAD` + `git status --porcelain` = empty recorded as SOURCE_TREE_STATE in the manifest. A dirty source cannot produce a candidate.
2. Dependency closure is materialized INTO the generation directory (no symlink into any dev store).
3. After seal, the generation directory is **READ-ONLY BY DISCIPLINE, IMMUTABLE BY MECHANISM WHERE PRACTICAL** (`chmod -R a-w` on candidate/ + seal). Mechanical read-only is best-effort on macOS (root overrides exist) — **detection, not prevention, is the authority**: every gate re-hashes fresh bytes.
4. Drift found at any gate ⇒ `CANDIDATE_DRIFT = FAIL_CLOSED`. The candidate is never repaired in place; a corrected candidate is a NEW generation. The drifted generation is preserved as-is for audit.
5. Old generations are never deleted or rewritten (audit-valid forever; retention may move them to cold storage by a separate decision, never mutate).

## 4. Manifest minimum (`manifest.toml`)

```
GOAL_NAME            # owning goal
GENERATION_ID
SOURCE_REPO
SOURCE_SHA
SOURCE_TREE_STATE    # clean|dirty + porcelain hash; must be clean at seal
BUILD_TOOLCHAIN      # node/cargo version, pnpm copy-mode, PATH pin
RUNTIME_ARCH
TARGET_PATHS         # exact destination paths this generation may write

[targets.<path>]
SOURCE_HASH          # sha256 of the source-tree file it came from
CANDIDATE_HASH       # sha256 of the staged file
EXPECTED_PREIMAGE_HASH   # sha256 the live file must have BEFORE apply
EXPECTED_POSTIMAGE_HASH  # == CANDIDATE_HASH; recorded for post-apply read-back
WHY_REQUIRED         # one line

DEPENDENCY_CLOSURE_DIGEST   # sha256 over the materialized dependency tree
BUILD_RECEIPT
TEST_RECEIPT
AUDIT_RECEIPT
```

No secret bytes ever: `.env`, credentials, tokens are NEVER copied into a generation; manifests record hashes and paths only (seal verification excludes `.env`-class files by manifest-declared exclusion list, and the exclusion list itself is hashed).

## 5. Production apply contract

Apply may consume ONLY a sealed generation. Before any mutation, fresh-check (re-read bytes now, never trust a prior hash record):

1. `CANDIDATE_SEAL = MATCH` — MANIFEST.sha256 verifies over candidate/ + manifest.toml.
2. `CANDIDATE_BYTES = MATCH` — every file re-hashes to its CANDIDATE_HASH.
3. `PRODUCTION_PREIMAGE = MATCH` — every TARGET_PATH live file hashes to its EXPECTED_PREIMAGE_HASH.
4. `DEPENDENCY_CLOSURE = MATCH` — DEPENDENCY_CLOSURE_DIGEST re-verifies.

Any mismatch ⇒ **FAILED_NO_MUTATION** (zero writes, evidence line recorded, alert per existing channel). Partial apply is forbidden: the preimage set is hashed as a set so interrupted applies are detectable and re-runnable only as a fresh gate pass.

Forbidden inside apply (mechanically, by the runner refusing, not by convention): rebuild; npm/pnpm install; `git checkout`/repair of any tree; patching source; opportunistic chmod/source fix; mutating the candidate generation (including permissions beyond the runner's own log/evidence files).

Rollback: EXPECTED_PREIMAGE bytes are frozen under `rollback/` with their own MANIFEST.sha256 at seal time — captured from the live tree during preimage check, before first write. A failed or rolled-back apply restores exactly the frozen preimage; the preimage is never stored as an in-place `.bak` inside a live stage.

The scheduler operator CLI artifact gates (CLI_BYTES_MATCH_EXPECTED / CLI_STORE_TARGET) are governed by SB4 of SCHEDULER_CONTROL_PLANE_RELIABILITY_V1; this spec's generation model is the packaging mechanism SB4 pins — no duplicate semantics.

## 6. Waiting for slot

`PRODUCTION_MUTATION_CONCURRENCY = 1` unchanged; the P0 goal (`WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1`) keeps the slot. Under this spec the wait becomes byte-safe by construction: a sealed generation cannot change while waiting, because every apply gate re-verifies and any drift fails closed. Need a change ⇒ build generation g+1; old generation stays audit-valid. No Goal may write into another Goal's generation directory — generation dirs carry the owning GOAL_NAME and cross-goal writes are drift by definition.

## 7. Reuse map (anti-churn)

Not a CI/CD platform. Missing seam only — everything else already exists:

| Existing primitive | Role under this spec |
|---|---|
| auth BUILD_MANIFEST.txt | becomes the manifest seed (add per-target hashes + seal; same fields) |
| svc-workflow content-addressed `releases/` + SHA256SUMS/provenance | generation store layout; fix = deploy stops bypassing it |
| trusted-cp-deploy-install.sh root closure + uid write spot-check | mechanism-level immutability for the dsh install face |
| svc-workflow timestamped backups | replaced by sealed `rollback/` (same idea, frozen + manifest-bound) |
| per-goal frozen packets + rollback rehearsals | receipts under `receipts/`; packet references GENERATION_ID |
| plist `.bak-*` convention | stays; plist preimage additionally hashed into `rollback/` |
| SB4 CLI pinning (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1) | operator-CLI artifact gates (unchanged authority) |

## 8. Required failure tests (acceptance — each must be a mechanical, re-runnable test)

1. **Seal byte-flip:** flip one byte in a sealed candidate → pre-apply gate FAIL (FAILED_NO_MUTATION, zero writes).
2. **Source drift after seal:** advance/mutate the source checkout after seal → frozen candidate bytes unchanged (byte-identical re-hash).
3. **Cross-Goal checkout pollution:** another Goal commits garbage into the shared development checkout → candidate unchanged.
4. **Dependency drift:** modify a file inside the materialized dependency closure → closure gate FAIL.
5. **Preimage drift:** live production target byte ≠ EXPECTED_PREIMAGE_HASH → FAILED_NO_MUTATION.
6. **Rollback usability:** force a failed apply → sealed rollback preimage restores exact bytes (hash-verified).
7. **New-generation enforcement:** modify candidate bytes → old generation remains audit-valid and hash-verifiable; corrected path = g+1, not in-place edit.
8. **Concurrent preparation:** two Goals build candidates simultaneously → generation dirs are disjoint, no shared writable candidate bytes (verify via per-generation dir ownership + cross-hash).

## 9. Classification

- **SHIP_BLOCKER**
  - SB-A: auth live-stage isolation — candidate generation + seal + apply fresh-gate replaces "build in the live stage worktree" (incidents #1/#2 surface).
  - SB-B: apply fresh-check gate (seal/bytes/preimage/closure, FAILED_NO_MUTATION) as a shared minimal runner consumed by all four surfaces.
  - SB-C: rollback preimage frozen separately from stage (no `.bak`-in-live-stage rollback).
- **MECHANICAL_FIX**
  - MF-1: GENERATION_ID + generation-root convention + manifest template (adapt BUILD_MANIFEST / release-artifacts, don't replace them).
  - MF-2: svc-workflow deploy re-attached to its own releases/ discipline (live binary must get a releases entry + provenance at cutover).
  - MF-3: operator CLI packaged as a sealed artifact per SB4 (symlink-to-dev-tree retired when SB4's slot arrives; this spec supplies the packaging).
- **FOLLOW_UP_DEBT**
  - FU-1: user-domain dsh runtime (pid executing from `production-dsh-agent-core` checkout) moved onto installed closure + generation model — requires runtime cutover, slot-gated.
  - FU-2: scheduler-v2 runtime checkout binding — same treatment as FU-1, lower urgency (stock-disabled store).
  - FU-3: stronger mechanism-level immutability (e.g. separate volume/owner for generation root) — detection is the authority; mechanism upgrade optional.

## 10. Completion conditions (READY_FOR_PRODUCTION_APPLY)

AUTH_STAGE_ISOLATION = PASS
SVC_WORKFLOW_STAGE_ISOLATION = PASS
DSH_STAGE_ISOLATION = PASS
SCHEDULER_OPERATOR_ARTIFACT_ISOLATION = PASS (per SB4 packaging via this spec)
CANDIDATE_DRIFT_FAIL_CLOSED = PASS
PRODUCTION_PREIMAGE_DRIFT_FAIL_CLOSED = PASS
CONCURRENT_GOAL_PREP_ISOLATED = PASS
ROLLBACK_ARTIFACT_ISOLATED = PASS
NO_SECRET_EXPOSURE = PASS

Plus: minimal migration runbook published for existing production Goals (each adopts the generation runner for its NEXT candidate; existing live artifacts are NOT retroactively re-generated — they get a first-generation seal at their next natural deployment).

## 11. Scope boundaries

No production migration/apply in this goal (slot-gated behind P0). No CI/CD platform, no repo restructuring, no change to `PRODUCTION_MUTATION_CONCURRENCY = 1`, no reopening of closed goals (SCHEDULER tool surface PR #167 stays closed; SB4 authority unchanged). Out of scope: retrofitting historical artifacts, changing store semantics, auth forum-supply pending items.

## 12. AMENDMENT_2 (2026-09-08, docs-only, OWNER RULING on readiness semantics)

Owner ruling: A1.3's demonstration semantics may NOT be used to record future adoption as current PASS. The §10 per-surface gates are hereby two-valued:

```
<SURFACE>_STAGE_ISOLATION = IMPLEMENTED_NOT_ADOPTED | ADOPTED_PASS
```

**ADOPTED_PASS requires real production-path mechanical evidence, per surface:**

1. live/apply entrypoint consumes a sealed generation
2. fresh candidate seal verified at apply
3. fresh production preimage verified at apply
4. no rebuild/install/patch at apply
5. drift causes FAILED_NO_MUTATION
6. resulting production bytes read back to expected hash
7. receipt written

Fixture E2E / runbook / code availability do NOT constitute adopted production proof.

**Current values (2026-09-08, updated post-cutover — AMENDMENT_2 §12 status flip for SCHEDULER only):**

```
AUTH_STAGE_ISOLATION                  = IMPLEMENTED_NOT_ADOPTED
SVC_WORKFLOW_STAGE_ISOLATION          = IMPLEMENTED_NOT_ADOPTED
DSH_STAGE_ISOLATION                   = IMPLEMENTED_NOT_ADOPTED
SCHEDULER_OPERATOR_ARTIFACT_ISOLATION = ADOPTED_PASS
  evidence (7-item, real production path, 2026-09-08):
    1. live/apply entrypoint consumes sealed generation — /usr/local/bin/agentcore-cron →
       ~/workspace/artifacts/production-candidates/…--e9e5009--g1/candidate/usr/local/bin/agentcore-cron (atomic rename swap)
    2. fresh candidate seal verified — runner verify OK pre-swap (seal set + manifest↔seal + seal.json cross-check + receipts)
    3. fresh production preimage verified — link-resolved bytes hash == EXPECTED_PREIMAGE_HASH 24ce44e7… at preflight AND
       at the apply moment (race re-check)
    4. no rebuild/install/patch — mutation was the link rename only; sealed generation untouched (verify OK post-swap)
    5. drift → FAILED_NO_MUTATION — demonstrated live: attempt 1 (37d6763--g1, closure NONE) failed functional smoke →
       rolled back, never repaired in place, superseded by new generation e9e5009--g1 with full ESM closure
    6. production read-back == expected hash — shasum of link-resolved operator == CANDIDATE_HASH 24ce44e7… post-swap
    7. receipt written — cutover-rollback.json + cutover-receipt.json on the generation; evidence copies committed
       (docs/evidence/production-candidate-g1-scheduler-cli-20260908/active-e9e5009-g1/)
  notes: functional smoke = --help usage + list --json end-to-end in sandboxed HOME through the production link;
  --help exits 2 by CLI design (byte-identical pre/post); canonical store seam present in sealed bytes
  ($HOME/.agent-core default, AGENTCORE_SCHEDULER_STORE/--store override); live authsvc-context store smoke not
  executable without sudo — recorded as note, byte-identity carries behavior equivalence
```

**Readiness tokens (2026-09-08 post-cutover):**

```
FRAMEWORK_IMPLEMENTATION_READY                 = YES
GENERATION_RUNNER_TESTED                       = PASS
FAILURE_INJECTION_SUITE                        = PASS
RUNBOOK_READY                                  = YES
ISOLATION_FRAMEWORK_READY_FOR_PRODUCTION_APPLY = YES
SCHEDULER_OPERATOR_READY_FOR_PRODUCTION_APPLY  = YES → EXECUTED (ADOPTED_PASS above)
SCHEDULER_OPERATOR_PRODUCTION_ISOLATION        = ISOLATED (production link no longer points at any dev worktree)
```

**GOAL_LEVEL:** `READY_FOR_PRODUCTION_APPLY = NO` — three surfaces remain IMPLEMENTED_NOT_ADOPTED. Goal terminal readiness/complete only when all four §10 gates are ADOPTED_PASS.

**Status & resume protocol (post-cutover aggregate):**

```
GOAL_STATUS             = BLOCKED_BY_DEPENDENCY
CURRENT_PHASE           = WAITING_FOR_REMAINING_REAL_ADOPTIONS
PRODUCTION_MUTATION_SLOT = RELEASED (scheduler cutover complete; concurrency=1 ownerless again)
NEXT_EXECUTABLE_ACTION  = NONE_UNTIL_NEXT_AUTHORIZED_ADOPTION_WINDOW (auth / svc-workflow / dsh — their next
                          authorized production deployment adopts the frozen-generation contract per runbook §§1-3)
BLOCKING_DEPENDENCIES   = (1) auth-service next authorized deployment window
                          (2) svc-workflow next authorized deployment window
                          (3) dsh-agent-core next authorized deployment window (incl. any targeted redeploy)
OWNER_ACTION_REQUIRED   = NONE
No polling. No audits / investigations / tests to keep the goal ACTIVE while blocked. RESUME SAME GOAL per-surface
at each window: fresh preflight → prepare/seal/smoke → receipted apply → post-proof → that surface = ADOPTED_PASS.
```
