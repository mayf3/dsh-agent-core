# HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1 — INDEPENDENT REVIEW REQUEST

- request date: 2026-09-25
- requester: spec authoring agent (not the reviewer)
- review kind: independent semantic review of a SPEC CANDIDATE (docs-only; no
  implementation exists; nothing is authorized by this request)
- candidate base: origin/main `b4e8511c533f8fa5be2f48dd56acc16bc79dff39`
- candidate branch: `goal/hr-restart-lost-fence-trusted-recovery-v1`
  (isolated fresh worktree off origin/main)

## Frozen review target

```text
SPEC_PATH  = docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1.md
SPEC_SHA256 = SHA256_AT_FREEZE (filled below after the freeze commit; reviewer
              MUST recompute and compare before reviewing)
OWNER_PACKET = docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1_OWNER_DECISION_PACKET.md
```

SPEC_SHA256 = `023797c16c2a2b45a458c7b40f1349eaa3d3e08aac342a752c862676e7ed5a41`

## Reviewer independence requirements

- The reviewer did not author and must not modify the candidate files.
- The review is semantic, whole-document, against the frozen SHA; a clean
  programmatic check is no substitute.
- Reviewer output: one verdict block (template below) filed as
  `docs/reviews/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1_INDEPENDENT_REVIEW.md`.

## What the review must verify (load-bearing checklist)

1. **Truthfulness of the evidence class.** `restart_quiescence_proven` proves
   termination-only for the exact record; it is NOT `child_real_exit` and can
   never write it; `exitObservedAt` stays null; business outcome stays
   `outcome_unknown`; no replay (RQ-001/004/006; ACC-RQ-001; NEG-RQ-011).
2. **Single-authority preservation.** The new kind reuses the C-017 settle-once
   machine; no second settlement field/authority is introduced; the four
   vocabulary dispositions (spec §4) are each closed sets and additive-only.
3. **Fail-closed completeness.** Every bundle element validation (V1..V8) and
   every record precondition (P1..P10) failing ⇒ zero-write, record stays
   blocked, structured fail-loud diagnostics; UNKNOWN ≡ invalid (RQ-003,
   NEG-RQ-001..006, 012, 013).
4. **Exact single-record scope.** Handle-keyed only; no by-agent/by-epoch/bulk
   entry point can exist; three records ⇒ three operations (RQ-004/006,
   NEG-RQ-010; ACC-RQ-002).
5. **Preimage/cmp/rollback + real constructors.** Settlement goes through the
   existing `settleLate`/`recordRecoveryAction`/`markFenceCleared` via
   `mutateRecord`'s preimage restore; crash composition relies ONLY on the
   existing startup may-finish-cleanup branch (RQ-004; ACC-RQ-005/007).
6. **Startup/barrier discipline.** Bundles consumed only at startup, before
   the C-019 admission barrier opens; invalid bundles never open anything and
   never block the fleet beyond the affected record's status quo (RQ-005,
   NEG-RQ-014).
7. **Deployment prerequisites.** RQ-007 ordering (restart-safety PROVEN floor
   binary; validator-before-producer; pinned rollback floor; trusted CP
   discipline) is sufficient and minimal; pre-floor recovery restart is
   forbidden (ACC-RQ-008).
8. **Scope honesty.** Single-host assumption explicit (RQ-008, NEG-RQ-013);
   controlled-stop receipt required exactly when the plan includes a stop,
   never retroactively manufactured (RQ-002/G3); live-runtime recovery path
   C-023..C-025 untouched; PLH_V3 text unmodified (amendment carried by this
   Spec); no HR special-casing anywhere (RQ-010).
9. **Custody/threat model.** Only root can produce/deposit bundles; agents have
   no write path and no runtime API accepts bundles; custody/enum/digest
   validations reject forged or foreign-host input (NEG-RQ-003/015).
10. **Consumer convergence.** Scheduler bridge/self-ops +1-line extensions
   yield end-to-end convergence (readback stamp → C-039 termination-only
   settlement → fence release → no retry → reconcile_turn receipt zero-write)
   without any other scheduler semantic change (ACC-RQ-006; spec RQ-009).

## Verdict template for the reviewer to file

```text
VERDICT = PASS | REVISE | REJECT
BLOCKER_UNION = [ ... ]
LOAD_BEARING_GAPS = <n>
READY_FOR_OWNER_ACCEPTANCE = YES | NO
IMPLEMENTATION_ALLOWED_BY_REVIEW_ALONE = NO   (fixed: Owner gate still required)
PRODUCTION_APPLY_ALLOWED = NO                 (fixed: separately authorized)
SPEC_SHA256_RECOMPUTED = <value, must equal the frozen SHA>
```

## Explicitly out of scope for this review

- Any production action (restart, settlement, store edit) — none is authorized.
- The Owner's Q1/Q2/Q3 answers (the Owner gate follows this review).
- Whether the live HR/article-publisher/reader-simulator records SHOULD be
  settled (an operational decision separate from mechanism acceptance).
