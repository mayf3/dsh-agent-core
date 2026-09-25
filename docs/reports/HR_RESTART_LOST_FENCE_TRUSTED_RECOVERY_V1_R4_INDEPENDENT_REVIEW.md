# Independent final r4 review — B4-R1 closure only

```text
VERDICT = PASS_READY_FOR_OWNER_ACCEPTANCE
REVIEW_TARGET_HEAD = 5726f43f9c028a8967720ccaff49a054ee1423e6
BASE_HEAD = dca561f0903231a7264ba27b4a760773301d342a
SPEC_SHA256 = fb5a5f825900b4c77ff681283cb51b5f914f449adda6789949f39dffeb60ad78
OWNER_PACKET_SHA256 = 76457057ca78d5da0e41c1973c6d187b460ae373fbc26d1b6cf2ff4fd1f7ed68
REVIEWER_ID = /root/hr_spec_b1_b3_delta_review
AUTHOR_INDEPENDENCE = PASS
B4_R1_LAUNCH_AUTHORIZATION_REFERENCE = CLOSED
B4_HISTORICAL_APPLICABILITY = PRESERVED_CORRECTED
B1_B2_B3 = PRESERVED_CLOSED
BLOCKERS = 0
READY_FOR_OWNER_ACCEPTANCE = YES
OWNER_ACCEPTANCE = NOT_PERFORMED
OWNER_Q1_Q2 = UNSET
IMPLEMENTATION_ALLOWED_BY_THIS_REVIEW = NO
DEPLOYMENT_READINESS = NOT_ESTABLISHED
PRODUCTION_RECOVERY_READY = NO
NEXT_ACTION = PRESENT_EXACT_R4_FOR_OWNER_DECISION
```

Executed UTC `2026-09-25T09:18:17.180278+00:00` against clean worktree `/Users/yanfenma/.codex/worktrees/hr-restart-fence-b1-b3/dsh-agent-core`. This is the same independent reviewer that raised B4 and B4-R1; I did not author the candidate or amend it. The task was restricted to the r3→r4 closure and consequential exact binding. Only two documents differ; no product-source or production reads, source writes, implementation, diagnosis, deployment, privileged operation, or Owner acceptance occurred.

## Closure determination

**B4-R1 is closed.** RQ-002 now expressly includes `launchAuthorizationReceiptSha256` in the closed bundle. Its independently sealed immutable receipt names the operation, host, unique startup nonce, pinned consuming binary, exact census archive/output digests and complete holder-check fields. Its authorization occurs after both observations and before the sole launch; the receipt is sealed before the final bundle, avoiding self-digest circularity.

V9 requires resolving the root-custody receipt bytes, digest verification and exact binding of those fields. A missing, mismatched or unverifiable launch-authorization reference is explicitly ZERO-WRITE. RQ-005 now states the executable ordering: independently seal authorization referencing exact proof bytes → seal bundle with authorization digest → launch one pinned fresh-epoch binary. NEG-RQ-018 includes missing/wrong/digest-mismatched authorization or incorrect census/holder binding. This precisely closes the previously missing input needed by V9; no unspecified authorization receipt lookup is required by the Spec.

The r3 change from passive collector to active collector/launcher and live exclusive-window verification is now explicitly identified as proposed privileged obligations. The production lock alone grants neither capability; the candidate requires applicable separately accepted and explicitly bootstrapped control-plane authority before those effects. This review does not certify that such capabilities, profiles or production permissions presently exist. This clarification preserves the separate authority boundary and adds no general launcher API or unrelated platform work.

## Retained findings and limits

The r3 causal/prospective argument and RQ-001 are byte-identical in r4: s256's historical pre-floor restart no longer requires a false historical floor proof. Eligibility depends on a future valid present quiescence cut, full canonical identity, no old-turn resumption and independently proven forward deployment. That makes the proposed mechanism incident-applicable in principle, not operationally ready now. The actual cutover, floor/validator deployment proof and accepted/bootstrapped privileged authority remain unproven execution prerequisites.

B1's six-set table/RQ-009, B2's committed pending proof index and B3's authentic source hashes remain intact. RQ-004 exact identity/effect and rollback semantics, RQ-006 no replay/sweep, RQ-007 forward ordering and the MUST-NOT/Owner/production gates are unchanged. No new `child_real_exit`, business outcome, identity inference, signal authority or historical rewrite is introduced.

Original R1 provides unchanged mechanism coverage; the B1–B3 review provides its closed delta coverage; the additive B4 finding and r3 review document the discovered defect and failed reference closure. Those historic records remain unchanged. This r4 recommendation supersedes the readiness withdrawal only for the exact r4 tuple above; it does not erase or retroactively validate earlier recommendations.

## Exact Owner binding and nonblocking prose note

Owner packet §7's `SPEC_SHA256` exactly equals the r4 file digest, and the packet itself is pinned above. It identifies the earlier hashes separately; Q1/Q2 remain unanswered. The recommendation paragraph still says “checks the exact frozen r3 SHA” immediately after calling this an r4 candidate. This is a **nonblocking stale revision-label typo**: the operative exact current hash is unambiguous, §5 otherwise requires review of the exact candidate SHA, §7 records the r3 hash as prior, and this independent review explicitly binds r4. Transmit the exact packet with this review and the current SHA; do not use that one label as permission to accept the older failed r3. No extra review wave is required solely for this prose typo.

Owner may now receive and decide Q1/Q2 on this exact r4 candidate. Acceptance must still record the reviewed/final accepted head under repository governance, and any required lifecycle-only final-head verification remains distinct. Neither this review nor an eventual Spec acceptance grants production recovery permission. Implementation authority/mandate and the candidate's separately accepted/bootstrapped control-plane dependency must be satisfied before the applicable work; this review does not claim they have been satisfied.

## Executed evidence

`checks.py` and `CHECKS.json` in this directory preserve **28/28 PASS** focused checks: exact clean head, two-document scope, committed byte equality, supplied file hashes, `git diff --check`, receipt shape and exact content binding, causal seal/bundle/launch order, V9 rejection, NEG-RQ-018 coverage, explicit privileged authority boundary, preserved r3/B1–B3 sections, correct Owner SHA, unanswered decisions and unchanged prior FAIL artifact.

These are documentation consistency and semantic closure checks, not executed feature acceptance or production proof. No broader audit, optional hardening, global test suite or unrelated lane was opened. The requested B4-R1 review boundary is complete; stop at Owner presentation.
