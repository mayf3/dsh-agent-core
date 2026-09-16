# AGENT_DIRECTORY_TOOL_V1_INTEGRATION_REVIEW — review channels record

date: 2026-09-16 · branch goal/agent-directory-tool-v1 ·
mode: INDEPENDENT_REVIEW_AND_INTEGRATION (Owner goal AGENT_DIRECTORY_TOOL_V1_INTEGRATION_REVIEW)

All three channels were run by FRESH independent reviewer agents (not the
implementing agent), each verifying from primary sources (code, diff, git
history, governance docs). Full transcripts are in the session record; the
operative verdicts:

## CODE_REVIEW

- r1 @ 6e77078: VERDICT **REVISE** — 0 blockers, 1 MAJOR, 3 MINOR.
  All 12 verification points verified from code; single-source, read-only,
  no-scope baseline, unchanged siblings all held.
  - [MAJOR-1] T7 test evidence not genuine: the queried agt_-shaped string
    was itself an agent id in the fixture, so the name-path semantic was
    never exercised.
  - [MINOR-2] dead `reads` counter (claimed, not asserted).
  - [MINOR-3] manifest list op missing `invalid_arguments` in its declared
    errors (wire behavior already correct).
  - [MINOR-4] spec's "fifth LOCAL provider" wording drifted after main
    advanced (spec frozen — informational).
- fixes @ b921927 (blocker-only scope; 2 files: broker manifest + runtime
  test): MAJOR-1 fixture agent `agt_shapehold` with display name
  `agt_freename` (matches NO id) so T7 provably resolves via the name path,
  T12 updated; MINOR-2 asserts `reads === 1`; MINOR-3 declares
  `invalid_arguments`. SECURITY's optional NFKC fold hardening deliberately
  NOT applied (semantic change = amendment territory; recorded as
  follow-up debt).
- r2 @ b921927: VERDICT **PASS** — all repairs verified mechanically;
  32/32 goal tests, full broker suite 467/467, production-runtime 293 with
  only the 2 pre-existing main-owned native-arm64 failures (byte-identical
  to r1, untouched by this branch). One NIT (stale fixture header comment)
  fixed in the follow-up commit.
- Observed test counts (proxy-free, /usr/local/bin/node v25.6.1): goal files
  32/32; broker 467/467; production-runtime 286 pass / 2 pre-existing fail /
  5 skipped.

## SECURITY_REVIEW

- @ 6e77078: SECURITY_REVIEW = **PASS** — 0 blockers, 0 majors, 1 minor
  (optional hardening), 1 pre-existing adjacent observation.
  - Disclosure byte-equivalent to the accepted agent.definition.read
    baseline (pure field rename of the same record set; disabled agents
    were already listed there).
  - Uncredentialed callers fail closed credential_unavailable BEFORE the
    handler; child cannot bypass the parent relay; caller identity frozen
    from the process relationship and ignored by the handler anyway.
  - Id path raw-byte ===; no regex/eval; NFD/NFC variants stay distinct;
    ambiguity always surfaced; O(N) per call, no DoS vector.
  - Merge 041e9e7 verified purely additive on both wiring files (no gate
    weakened).
  - [MINOR, optional, NOT applied] Unicode case-fold homoglyph single-match
    (toLowerCase folds U+212A/U+212B/U+017F): NFKC-fold both sides would
    convert a confusable single-match into explicit ambiguous. The identical
    fold already exists in accepted resolveAgentRef; requires the
    agent.definition.write grant to exploit. FOLLOW-UP DEBT (spec amendment
    if ever applied).
  - [pre-existing observation, shared path] credential_unavailable detail
    carries the store path for every local capability since
    agent.definition.read; not model-rendered by default.

## GOVERNANCE — SPEC_ACCEPTANCE_AUTHORITY_VALID

- VERDICT: **SPEC_ACCEPTANCE_AUTHORITY_VALID = YES**;
  ORIGINAL_FLIP_STANDING_ALONE = VALID (at the permissive edge of
  precedent).
- The acceptance binds what the active grammar requires (FINAL_ACCEPTED_HEAD
  ef1128d, ACCEPTANCE_ACTOR mayf3 attributed-by-directive, reviewed head
  60df050, SEMANTIC_DELTA_AFTER_REVIEW verified NONE by direct diff); the
  2026-09-16 Owner directive ordered the full lifecycle including
  implementation with an exhaustive STOP list that did not include "await
  acceptance", so the flip necessarily follows from the order; two on-record
  precedents support goal-directive authority for spec acceptance (ASM V1
  original acceptance; ASM r5 AMENDMENT_2), while the dominant recent
  convention (IAD V1, EPAR V2 BATCH_EXACT_HEAD_ACCEPTANCE tokens) is
  stronger-but-not-mandated; the review chain was sound and honestly
  recorded (the r2 round caught and blocked its own record's pre-written
  verdict — affirmative integrity evidence).
- CURATION_NOTE: the CURRENT integration goal's order — PR + merge
  conditional on independent review PASS and on SPEC_ACCEPTANCE_AUTHORITY_
  VALID=YES — is itself an Owner exact-head acceptance act at the merge
  boundary that ratifies (and would cure) the earlier flip even under the
  strictest discrete-act reading.
- IF_NO_THEN_EXACT_CURE = NONE.

## Merge gate (per merge-gate discipline)

CODE_REVIEW = COMPLETED (PASS) · SECURITY_REVIEW = COMPLETED (PASS) ·
inline P1+ = 0 · GOVERNANCE = SPEC_ACCEPTANCE_AUTHORITY_VALID=YES ·
PR HEAD review = terminal before merge (this file + the PR description).
