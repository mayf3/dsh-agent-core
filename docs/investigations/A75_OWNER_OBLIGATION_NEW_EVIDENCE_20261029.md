---
record_id: A75_OWNER_OBLIGATION_NEW_EVIDENCE_20261029
status: investigation
owning_repository: CROSS_REPOSITORY
observed_run: trial-20261027-a75
source_revisions:
  core: 45268be276276462bd71040f0cd51b28a7764fe0
  svc: f5e7f328ccba5f6e0d752abf74e68558ef38ca0f
---

# A75 Owner obligation — new evidence and limits

## Observation

The read-only native audit for `trial-20261027-a75` records a normally completed Owner turn after supplier creation, with no ordinary consumer create and no governance-child create-and-bind attempt. The supplier reached its terminal node with a distinct QA submission. The source remained `source_blocked`; its Assistance case remained `OWNER_PENDING`. The final business verdict is `PARTIAL_UNATTENDED_NONPROGRESS`, while the runtime naturally exited with actual code 0. The actual exit of the outer infrastructure supervisor remains `UNKNOWN_NO_EXTERNAL_WAITER`.

The read-only Svc snapshot records the delivered `owner-assistance:<case>` wake and the still-pending case. This confirms the distinction `wake delivered != owner turn quiescent != business obligation satisfied`. It does not establish why the model stopped, and it does not support a turn-call cap hypothesis.

Neither dependent readiness observation was exercised: there is no consumer create receipt or governance-child create-and-bind receipt. `WAITING`, a zero-attempt interval, the later paired poller `READY` row, and a first dependent attempt are all `NOT_EXERCISED / UNKNOWN`. An empty readiness list is not evidence of `WAITING`.

## Evidence pins

- Retained A75 isolated DB read-only preflight: `ART/a75-owner-wake-mechanism-diagnosis-20261029/owner-obligation-preimplementation-readonly-db.json`, SHA-256 `eb8823f10417889782069002f79ab4d76ae04482915486bf8153be03d2ae11c6`. In that sampled A75 DB, existing `pm` was an enabled AGENT with `GLOBAL_SCHEDULER_READ`, no Domain membership; the Domain was enabled and its single enabled Owner matched the public identity. This is retained-fixture evidence only, not production or credential-isolation evidence.

- Independent design counter-review: `ART/a75-owner-wake-mechanism-diagnosis-20261029/independent-owner-obligation-design-review.md`, SHA-256 `40c662f1a6d5fe3cea419a39684d2e5a2e8722acd124858379b1759e1cb60c1f`.
- Native audit evidence: `ART/g6-native-audit-a75-20261029/evidence.json`, SHA-256 `cc053d9934847dbbf35a6e44a78463af2f9548f69145f63bd1fdd49576d4de41`.
- Native audit report: `ART/g6-native-audit-a75-20261029/final-audit.md`, SHA-256 `afa991636499f80394745fb5877a810f5d87288ded0d8b14745d9321afb170f0`.
- Read-only Svc case/outbox snapshot: `ART/a75-owner-wake-mechanism-diagnosis-20261029/root-readonly-owner-wake-snapshot.json`, SHA-256 `c167561b72c69b656b673d0218fa88e0881376654f1dce84494d72af71003210`.
- Natural runtime lifecycle receipt: `ART/a75-prepare-preflight-20261029/a75-final-lifecycle.json`, SHA-256 `6ad150c3742a4f9f66891d3e6b700a5fb01ed7988b3bb8730dafff225fa50b75`.
- Bounded semantic-review closure input: `ART/a75-owner-wake-mechanism-diagnosis-20261029/owner-obligation-v1-review-gap-closure.md`, SHA-256 `79e47fa08a3be5068c21f0b08f7a0b090097d804fc8894f0f92d25174105a6ce`; exact same-caller source-CAS producer, managed-review projection and 004/005 transaction constraints. It is proposal input only.

## Interpretation and limits

This is new evidence of an unmet Owner obligation after a normally completed turn, not evidence of an API refusal or of an automatic retry defect. It supports proposing a system-owned bootstrap responsibility that creates one exact published governance intake Workflow, plus a distinct real review Workflow after the intake child reaches its proven terminal transition. Ordinary multi-step business work remains expressed in the existing published Workflow graph and existing QA/RETURN machinery.

The evidence does not authorize replay, reclassification, repair, or mutation of A75, its database, its source Instances, or its existing receipts. It does not prove `WAITING` or `READY` for either missing dependent. The outer supervisor exit remains unknown even though runtime, worker, and service child exits were observed as zero.

## Proposed investigation disposition

Use this evidence as `NEW_EVIDENCE` for a docs-first paired authority proposal. Keep the design recommendation non-authoritative until exact proposed Contracts receive independent review and Owner acceptance. The proposal must not add a parallel flat catalog/template/materializer/completeness language or a Core phase-specific prompt/continuation engine. The exact persisted fields, effect keys, service/API mapping, producer/discovery rules, storage/cardinality contract, and bounded review-gap closure are fixed by the four author design inputs plus the separately pinned review-gap closure proposal; paired delta review and Owner acceptance remain pending. A75's observed WAIT/READY and unattended business completion remain unexercised.
