# 547 v2 independent review — STOPPED publication only

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEWER_ID = /root/source_audit
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
REVIEW_TARGET_HEAD = 592ebcab7059b35d33327a636a0f93634b026f68
BASE_HEAD = 95a8e1cb512fc99dc018209d837250dd51b4d08f
CURRENT_BASE_HEAD = 95a8e1cb512fc99dc018209d837250dd51b4d08f
DELTA_PARENT = 7d5979a94096ea4ffd41bbc5f2e29e0773916fb9
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = DELTA
SCOPE_REASON = seven-file v2 diagnostic attempt and corrected STOPPED reporting
SPEC_REVIEW = NOT_APPLICABLE
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS (reporting and stop boundary only)
MANDATE_SCOPE_REVIEW = FAIL (executed capture); PASS (STOPPED publication)
EVIDENCE_REVIEWABILITY = PASS (this host's private copies and sanitized receipts)
BASE_IMPACT = NONE (local origin/main and merge-base equal BASE_HEAD)
PUBLICATION_BLOCKERS = 0
DIAGNOSTIC_BLOCKERS = 1
DIAGNOSTIC_CONTINUATION = NO
DIAGNOSTIC_COMPLETION = NO
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MERGE_READY = NO
RECOMMENDATION = publish/update the unmerged STOPPED PR only
NEXT_ACTION = STOP diagnostic work; preserve and publish stopping evidence
```

The user-authorized v2 narrows collection to source consumers and readable real
tmp/lock/history files, with failure requiring a stop. This review adds no
Product Contract or recovery permission. It covers the seven changed files from
`DELTA_PARENT` to `REVIEW_TARGET_HEAD`, not unrelated repository surfaces.

## Finding and corrected initial review

`FROZEN_BLOCKER_UNION = [SCOPE_ESCALATION-547-V2]`.
SOURCE: user v2 mandate and brief source-consumption boundary.
COUNTEREXAMPLE: `capture-v2.py:54` tests `'lock' in name.lower()`, admitting the
historical `turn-recovery-v3.pre-fleet-unblock-20261002-111745.json` because
`unblock` contains `lock`. Exactly one extra file was read six times and copied
three times: 2,536,800 bytes, SHA-256
`fd682125eb0a37f08223f98b78ad3b50c5db2ad7d4af3b02998b824ede81f6bb`.
IMPACT: collection exceeded the agreed scope; the affected readiness boundaries
`diagnostic_continuation` and `diagnostic_completion` are **NO**.
MINIMAL_CLOSURE: retain STOPPED, preserve the original script/receipt and private
copies, and publish the stop record. Any diagnostic resumption needs renewed
responsibility-chain instructions; any new capture must first use source-derived
exact names and locally reject this counterexample. Do not rerun this script.

My initial static review missed this reachable lexical false positive. The
postcapture local review corrects that assessment; it does not erase the failed
attempt or expand authorization. No publication blocker remains because the
candidate explicitly reports this violation and leaves dependent work stopped.

## Independently executed local verification

I rehashed all 12 preserved store copies and all 18 source snapshots, checked
their sizes against the receipt, compared every recorded pre/post/final stat,
and compared all three complete hash/stat vectors. All matched. The receipt,
capture script, and validation script hashes match `scope-validation-v2.json`.
The 97 recorded commands all have rc=0: 95 authsvc sudo commands limited to
ls/stat/cat, plus two ps commands with identical PID identity readbacks. The
only four cat targets are the three necessary files and the extra historical
file; no `.bak` appears in command argv. The three necessary files are present.

Thus collector-machine `PASS` and `THREE_PASS_STABLE` are truthful observations;
scope is **FAIL** and overall state **STOPPED**. No atomic snapshot or startup-time
identity is established. I performed no production reads, runtime imports,
deployed-validator execution, recovery, or retries during this review.

The source snapshot provenance values and restart readback match the report.
They remain disk declarations and process observations; loaded bytes,
epoch-fix2 actor/authorization, restart actor/authorization, and causal links
remain UNKNOWN. The report does not claim validation passed or restart cleared
the symptom. Offline same-predicate reproduction is **NOT_RUN**; actual failed
predicate/coordinates and root cause remain **UNKNOWN**.

Private v2 directories/files are 0700/0600; no private path is tracked, and the
active copy is Git ignored. `git diff --check` for the reviewed delta passed.
`DURABLE-STORE-DIAG-547.md` is absent and `DONE_WHEN=NOT_MET` is explicit.
The v1 stop history remains readable. Recommendation applies only to publishing
the v2 STOPPED update to PR #670, with no merge or diagnosis-completion claim.
