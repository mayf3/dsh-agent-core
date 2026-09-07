---
spec_id: PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1
status: proposed
date: 2026-09-08
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
owner_rulings: goal brief 2026-09-08 (invariants, apply contract, 8 required failure tests absorbed in §2/§5/§6; anti-churn constraint absorbed in §7)
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
