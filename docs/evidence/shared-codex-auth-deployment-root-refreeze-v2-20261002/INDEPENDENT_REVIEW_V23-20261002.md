# INDEPENDENT_REVIEW_V23 — B7_SHARED_CODEX_DEPLOYMENT_ROOT_REFREEZE_V2.3 (DEFECT C repair)

> Changed-surface independent review of branch `svc/b7-v23-packet-repair-20261002`
> (base 431bcab8 = the v2.2 merge / origin/main tip), two rounds, adversarial
> reviewer with mechanical verification (read-only; no sudo; no production access).
> This file is the absorb commit: docs-only, ZERO semantic delta from the
> reviewed head **d5883480251837ee031efdeff7591527936818f6** (the review target;
> the absorb adds only this file + its §4/MANIFEST digest rows).

## ROUND 1 — head 978b8d3f7e4f85796ab5663e9de1cc02ce115861 — VERDICT: REVISE

- SCOPE_DISCIPLINE = PASS (delta exactly the 12 declared files; docs/specs delta 0
  at head AND pin; packages/** shipped runtime source delta 0; pin 4f14ff00 =
  exactly the 4 declared scripts/lib files, tree 6eae0c23 verified).
- SHIP_BLOCKERS = 1:
  - **B1 (executor cutover matcher DEAD)**: the STAGE 1M v2-class case pattern
    `*"must be {"version":3"*"older files are not converted"*` strips the literal
    quote characters (shell quoting collapse) and therefore NEVER matches the real
    #195 loader FATAL line — empirically reproduced by the reviewer with identical
    bytes: NO-MATCH → fail-closed die "UNRECOGNIZED config error" → the migration
    would never trigger on the actual production preimage. Direction fail-safe
    (zero mutation, no restart — the #195 class still cannot reach a restart) but
    the repair inoperative. `--selftest-repair` could not catch it because it greps
    the gate output and never exercised the cutover case statement.
- LOAD_BEARING_GAPS = 1:
  - **B2**: `--selftest-repair` G2.7 GREEN assertion operator precedence —
    `(rc=0 && grep && [ -f glob ]) || ls` reported GREEN whenever the backup file
    existed regardless of the gate rc/count. Proof strength overstated (redundant
    cover existed in the generator + unit suite, hence gap not blocker).
- NON_BLOCKING = 8 (§5 still naming the v22 deploy executor; anticipatory review-
  file pointer in the log; MANIFEST comment-row sha256sum warnings; migrator's
  stray-backup corner on the TOCTOU-only mismatch path; inert `.v3-candidate-*`
  orphan on SIGKILL; unreachable CREDENTIAL_FILE_CONFLICT defensive branch;
  "UNTOUCHED" wording in the impossible POSTSWAP_DRIFT corner; log line-count
  phrasing).
- TESTS/DIGESTS at round-1 head: all verified (42 tests 41/1/0; all selftests
  PASS; 8/8 digests recomputed matching; MANIFEST 16/16; installer ad491b79
  byte-identical).

## ROUND-1 DISPOSITION (fix commit d5883480 — same changed surface, no expansion)

- **B1 FIXED + regression-proofed**: the matcher extracted into `g27_error_class()`
  with SINGLE-quoted case literals (quote characters preserved); cutover calls it
  and dies unless V2_KNOWN_CLASS; `--selftest-repair` now unit-exercises the
  classifier directly with the EXACT recorded #195 FATAL line (literal quotes →
  V2_KNOWN_CLASS) and a negative control (non-version loader error → OTHER_CLASS,
  fail-closed die, no migration) — closing the exact coverage gap the reviewer
  identified, by construction.
- **B2 FIXED**: strict `rc -eq 0 && grep '"overrideCount": 92' && ls backup`
  (pretty-JSON space corrected); reviewer's executor-wide scan found no remaining
  `(A&&B&&C)||D` gating hole (surviving `&&…||…` sites are exhaustive PASS/FAIL
  echo reporters inherited from v2.2, not gating).
- **B3 (non-blocking #1) FIXED**: packet §5 names the v23 deploy executor.
- Digest rebind: executor d8565fdf… → 03dfacb7… (packet §4 + MANIFEST); packet
  88cd3329…; everything else unchanged and re-verified.
- Recorded, NOT absorbed: the migrator corner notes (stray backup on the
  TOCTOU-only mismatch path — reachable only via concurrent config mutation;
  inert `.v3-candidate-*` orphan on SIGKILL — never matches the RESTORE-R3 glob;
  the unreachable defensive CREDENTIAL_FILE_CONFLICT branch — defensive depth;
  POSTSWAP_DRIFT wording corner; MANIFEST comment-row warnings — house
  convention since v2.2). All are inert corners on fail-closed paths; carrying
  them keeps the migrator bytes identical to the round-reviewed bytes.

## ROUND 2 — head d5883480251837ee031efdeff7591527936818f6 — VERDICT: PASS

- SCOPE_DISCIPLINE = PASS (delta 978b8d3f..d5883480 = exactly 3 files: executor
  v23, OPERATION_PACKAGE_V2.md, MANIFEST.sha256; docs/specs 0; packages 0).
- SHIP_BLOCKERS = 0. LOAD_BEARING_GAPS = 0.
- Mechanical verification: the classifier (extracted from the committed file)
  classifies the real loader FATAL line with embedded quotes as V2_KNOWN_CLASS;
  empty string / non-version / single-substring controls → OTHER_CLASS; the
  cutover path calls it and dies on OTHER_CLASS (line 367). `--selftest-repair`
  prints both classifier proofs and ends SELFTEST_REPAIR_PASS. Suites 42 tests =
  41 pass / 1 skip / 0 fail; executor `--selftest` PASS; carrier r13 `--selftest`
  PASS (bytes unchanged, e9443f32 verifies); RED/GREEN generator PASS (RED_RC=2
  with the exact #195 line; GREEN_RC=0; overrides 92/92). Digests at head:
  executor 03dfacb7… == packet §4 == MANIFEST; packet 88cd3329… == MANIFEST;
  MANIFEST 16/16 rows OK; installer ad491b79… byte-identical.
- NON_BLOCKING carried/recorded as above (one cosmetic: trailing space in the
  cutover die string at line 367 — harmless; not absorbed to keep the reviewed
  byte identity).

## CLOSURE

REVIEW_VERDICT = PASS / SHIP_BLOCKERS = 0 / LOAD_BEARING_GAPS = NONE /
SCOPE_DISCIPLINE = PASS on the exact head
**d5883480251837ee031efdeff7591527936818f6**. Merge authorized from the
changed-surface perspective; production execution remains gated by the standing
delegation runbook (STAGE 0 → 1 → 1M `cutover` → 2 (Owner marker re-placement to
the r13 SHA first) → 3 → 4, §5/§6 incl. RESTORE-R3).
