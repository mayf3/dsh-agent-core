# REVIEW-1377-B2-R5 — independent affected-Contract delta review

审查时间：2026-11-07 03:21:31 UTC。Reviewer `/root/r5_independent_review` 未作者源码、测试或候选文档；只读检查，没有运行额外测试或写文件。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_RESULT = PASS
SPEC_REVIEW = NOT_APPLICABLE
REVIEW_TARGET_HEAD = ba16e0529a7ac68683d076416106140fdd018009
REVIEW_TARGET_TREE = 13260734c4568b9ccee6e69f63eed060249e5d6a
PARENT_HEAD = 77b9644b2a6ff70cb6af2cf00bb134502a0eef8b
BASE_HEAD = CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
REVIEWER_ID = /root/r5_independent_review
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = DELTA
SCOPE_REASON = repair frozen B2-R3-REV-001 plus R5 concrete terminal-reconcile regression and directly invalidated evidence
IMPACT_EVIDENCE = git diff R3..candidate; R4 review object 2419593722d4846ab6eda915e440af0c477c7e1e..candidate; candidate.json nine file hashes; raw executed gate logs
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE (reviewer fresh ls-remote main unchanged)
FROZEN_BLOCKER_UNION = [B2-R3-REV-001]
FROZEN_BLOCKER_DISPOSITION = B2-R3-REV-001 CLOSED_FOR_THIS_SOURCE_CANDIDATE
R5_TERMINAL_REGRESSION = CLOSED_FOR_THIS_SOURCE_CANDIDATE
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0 (new findings; structure baseline debt remains 28)
IMPLEMENTATION_ALLOWED = YES (only authorized isolated delivery continuation)
MERGE_READY = NO (user forbids merge; final delivery HEAD recheck pending)
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (commit, independent final HEAD delta recheck, authorized push/PR; no merge)
```

## Authority and frozen scope

Reviewed repository shared/local grammar, Architecture ownership/thin-layer boundaries, current D-009 §8.4/8.5, D009_ALIGNMENT CTR-527D2-002/003, Recovery Liveness CTR-EKRWAE-001/003/004/005/007 and WAE V3 terminal/refusal/WAL/E3 constraints. The four governing Spec/Decision files checked equal accepted integration-base bytes. Recovery Liveness acceptance alignment is read together with accepted frontmatter; its authoring-era placeholders do not reactivate a proposal. This is REUSE / BRIEF / DURABLE implementation under user R5 and the inherited blocked-only Brief, not new Product Authority or production authorization. Ordinary planned positive recovery remains excluded; default OFF remains.

## Frozen blocker closure: B2-R3-REV-001

The candidate retains the original automatic responsibility. While ACTIVE and under the same FIFO/OwnerLock/fresh replay, operation.js persists recovery_checked/refusalSchedule with exact original identity, accepted rule, existing consumer, first-check anchor and positive finite cadence before recovery_refused. The same poller's refusal consumer reconstructs its duty from that durable ledger after restart, rechecks identity/revision under lock, resolves the original Principal and reads exact instance as the resolved target Agent. Failure retains the duty and a future cadence; per-pass budget, slot throttling and fair rotation are bounded. Terminal consumption calls none of the record ports, performs no recoverAttempt/re-admission/closure and creates no second ledger/timer/queue. A world observation remains UNKNOWN and pending rather than a handoff or business-success claim.

This closes the previously reachable orphan-duty path. It does not claim an Owner/Assistance transfer; any future transfer/closure still needs CTR-007 evidence. Manual/historical refusals without the accepted automatic schedule are not silently enrolled. Twelve refusal responsibility cases plus the new real-process refusal SIGKILL/two-restart case execute green. The raw process receipt shows refusal schedule durable before SIGKILL, two later cadence consumptions in each restart (first with HTTP503, then readable world), zero additional terminal ledger bytes, unchanged terminal projection/Router bytes, E3 no-op and zero delivery.

## R5 terminal-reconcile regression closure

The sole R5 source delta moves the existing expectedPhase CAS before terminalGuard inside recordReconciled's existing locked mutation; identity/generation stale rejection stays first. A delayed ACTIVE observation losing to a terminal writer now returns committed:false/cause:attempt_changed before any append/apply. Deliberate same-terminal-phase writes still encounter the unchanged terminalGuard; private recordForActive and replay guards remain fail-loud. No terminal event or obligation-release reconciled write is introduced.

The original after-WAL SIGKILL and accepted/ACK-lost restart cases both pass with errors=[], four polls, exactly one reconciled, terminal projection equal to the first completed terminal poll, and ledger bytes unchanged through later polls. WAL still forbids a delivery despite Router never_existed; ACK loss preserves original request/attempt/generation, UNKNOWN and active Router fence without a second delivery. The existing ledger identity case now covers the losing same-generation ACTIVE observation, then still asserts deliberate terminal write rejection and unchanged bytes. Existing ledger lifecycle terminal-refusal assertions pass unchanged.

## Executed evidence inspected

All files below are under docs/evidence/1377-b2-r5. gate-results.json supplies actual commands, UTC starts and rc0; raw logs bind candidate source SHA. Reviewer independently compared all nine candidate source/test hashes against both working bytes and the immutable git candidate object, and confirmed accepted authority bytes equal base. No source changes followed the executed candidate.

- blocked-targeted.txt: 46/46, fail0, skip0, rc0; inherited 33 plus all 13 R4 additions.
- observation-cas-full.txt: 93/93, fail0, skip0, rc0; file-expanded original47+33+13. Some unrelated legacy per-case diagnostic sourceSha fields remain UNKNOWN, while the suite command and B2 process receipts bind the exact candidate; no fabricated per-case coordinate is substituted.
- broker-owner-obligation-31.txt: 31/31, fail0, skip0, rc0, including mandated owner-obligation-attempt cases.
- affected-regressions-135.txt: 135/135, fail0, skip0, rc0.
- ledger-terminal-regression.txt: 12/12, fail0, skip0, rc0.
- syntax-1..9 and diff-check: rc0.
- structure.json.txt: rc0, CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT, candidate violations0, baseline debt28; no whole-repository debt-free claim.

Reviewer-measured SHA-256:
```text
261006c4922df6abc42eaaa25aba4c9c8d8335d7a7b8ff4d9aad4cece6b50b57  blocked-targeted.txt
90be37769086d045a70e9f823269368ef1b71333d0553272b2078b7fa1f2c030  observation-cas-full.txt
5c0c8db424f963f99e84c187df88c66feb0dde227b4a8a57d89a5068e2fd42f2  broker-owner-obligation-31.txt
631f9f6e4b46c0a3811e58ccf2ef4f994174d5cbc5d0cdfb58598703be00131a  affected-regressions-135.txt
d68cc827adca4b12fc9b0f5d31541b0b4fdc37aaeaaa03d5d65ccd52b9b112b6  ledger-terminal-regression.txt
1656a148febe4e20d5dd843067a7b83778bb21e6aafcbf5f9254fcce3c4cffe0  structure.json.txt
```

## Limits and next boundary

PASS is source conformance plus isolated real file-ledger/Router-store/child-process/loopback fault validation at the bound candidate. It is not installation, production activation, real Svc DB/compose acceptance, cross-service business completion or autonomous end-to-end operation. Those remain NOT_RUN/UNKNOWN. R3/R4 failure history remains historical. Delivery commit/final receipt changes still require the independent final-HEAD delta recheck; no merge is authorized.

Reviewer tooling provenance: two early read-only lookups hit not-yet-created evidence filenames, and one read-only receipt-summary Python snippet had a syntax error; these mechanical reads were corrected/continued under R5's allowance, without source/test mutation, test rerun or failed mandatory gate. They are not product PASS evidence.
