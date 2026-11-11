# Svc authority readback for RTH Core successor

Recorder contribution by `/root/svc_audit`; this is not an independent semantic
review or an acceptance act. Authorized write surface: this evidence file only,
under the root author's BRIEF-RTH-CORE-SUCCESSOR documentation task. No Svc
file, source, configuration, database, issue, or PR was changed by this recorder.

## Observation coordinates and method

- `OBS-RTHCS-SVC-001`: GitHub connector `fetch_commit(main)` followed by the
  UTC clock read at **2026-11-07 21:37:47 UTC** confirmed Svc main
  `b5096782f666ad22aa3508fdbf9562278a977c0f`. Earlier reads in this same task
  fetched the files below at that exact commit, not at an unpinned moving ref.
- Owning repository: `mayf3/svc-workflow`; Core recorder worktree:
  `/private/tmp/h1377-minimpl`, branch `docs/rth-core-successor`, parent
  `b6ddc2a67ba041b8b13ed33d331104cf809d4985`.
- Method: GitHub connector `fetch_file`, `fetch_pr`, `fetch_issue`,
  `fetch_issue_comments`, file/PR searches; read-only `gh api git/trees` for
  path discovery where the connector lacked directory listing. No runtime
  or production state was inspected. Line numbers below bind the pinned Svc
  commit. Git blob IDs are identities returned by GitHub, not SHA-256 hashes.
- Authority discovery read `.agents/local/README.md` and `docs/specs/README.md`;
  exact frontmatter and governing text were then inspected. The index is a
  discovery aid and is not substituted for the authority text.

## Exact Svc authority paths

| Authority | Pinned source | Observed lifecycle / Git blob |
|---|---|---|
| Execution Control V3 | [`docs/specs/SVC_WORKFLOW_EXECUTION_CONTROL_V3.md`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/docs/specs/SVC_WORKFLOW_EXECUTION_CONTROL_V3.md) | accepted; implementation contracts; production none; blob `7c6c5d1de1d1f6e1a580521f01fce90f1c2de2b2` |
| Owner Obligation Workflows V3 | [`docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V3.md`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V3.md) | accepted whole successor; implementation contracts after accepted lifecycle in base; production none; blob `2fac07fd09d9ebe6f5faf0c5ddc8e909adc509fb` |
| Product Boundary V13 | [`docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V13.md`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V13.md) | accepted Product Direction successor present in pinned main; blob `469eee77102d59b6465764315f0f198c0816d8bb` |
| Architecture V0.4.7 | [`docs/architecture/SVC_WORKFLOW_ARCHITECTURE_V0_4_7.md`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/docs/architecture/SVC_WORKFLOW_ARCHITECTURE_V0_4_7.md) | accepted Architecture successor present in pinned main; no blob value asserted here |
| Storage V0.3 | [`docs/contracts/POSTGRES_STORAGE_CONTRACT_V0_3.md`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/docs/contracts/POSTGRES_STORAGE_CONTRACT_V0_3.md) | accepted storage successor present in pinned main; blob `d708eef6dc8d03a944db9e6cb294370a39360093` |

## Contract readback and pairing checklist

`CLM-RTHCS-SVC-001 (SUPPORTED)`: existing accepted Svc Contracts provide useful
Assistance/receipt/Owner mechanisms but do not authorize the RTH historical
protocol. This follows from the closed ingress and resume predicates below;
it does not depend on a code-search absence claim.

| Pairing surface | Current accepted coordinate | Retained meaning / required pairing |
|---|---|---|
| System ingress and historical target | WEC V3 `CTR-SWEC-004`, lines 365–395 | Scope/direct token/server-side GLOBAL_SCHEDULER_READ; only `ATTEMPTS_EXHAUSTED` and `STALE_LOOP_EXHAUSTED`; CURRENT visit and noncancelled/nonarchived/nonterminal instance. RTH reason and historical/closed/discrepancy-only eligibility change accepted meaning and need a whole successor, not an additive reinterpretation. |
| Transaction, idempotency and exact receipt | WEC V3 `CTR-SWEC-004`, 376–395; Product V13 1422; Storage V0.3 36–46, 210, 258, 333–337 | Preserve same-key/request comparison, original receipt, lock/transaction/history rules. Existing `escalated:false` for an already-open case is not proof of the exact RTH intent. Paired authority must bind original tuple/reason/digests, system requester, Domain/Owner, receipt/key/request sequence and callable readback. |
| Real Owner recipient and delivery | WEC V3 `CTR-SWEC-009`, 514–601 | Existing BUSINESS wake uses dedicated authenticated outbox delivery, bounded attempts/backoff and durable retention. It creates no production credential/config authority. RTH needs explicit original historical Domain/current enabled Owner selection, attributable exact delivery, Owner-change handling and safe reacceptance; queue/ACK/2xx alone cannot discharge Core responsibility. |
| Inbox/detail consumer | Owner Workflows V3 §5, 348–354 | Current-Owner-authorized inbox/detail and obligation projection are preserved. RTH historical discovery and actual consumer registration remain required; naming this inbox is not evidence of a live historical consumer. |
| Reply and historical action | WEC V3 `CTR-SWEC-010`, 648–659; Owner Workflows V3 §§5/7/8 | Existing persisted request/resolution command/event provenance is reusable only within its eligibility. Paired RTH authority needs callable historical resolve/escalate and exact actor/request/case/sequence validation. Opening a historical case without making its legal response callable leaves a concrete gap. |
| Resume/admission separation | WEC V3 `CTR-SWEC-010`, 603–701, especially 610–646 and 670–696 | Existing DTO is ACTIVE/current, two old reasons, exact previous baseline and provenance. Retain it. RTH handoff receipt requires a distinct non-permit readback; no generation, resume, business settlement or baseline fabrication follows from new reason/case resolution. |
| Managed Owner consumer interaction | Owner Workflows V3 §2–3, 251–305; §8, 402; Product V13 44–48; Architecture V0.4.7 42–48 | Existing opt-in policy is pinned at request time; naked chat is suppressed for opted-in workflow routing (305); source cancel/archive/VOID/superseding request retires pending responsibilities and stops new effects (402). Svc pairing must explicitly resolve how historical RTH responsibility fits these rules. Do not infer a historical consumer from ordinary managed consumer names. |

The Svc RTH pairing's actual ID, acceptance head and activation main SHA remain
**UNKNOWN / REQUIRED**. Core cannot accept or supersede Svc authority. Whether
the Svc candidate also needs whole successors to Owner Workflows or its Product /
Architecture parents depends on its exact chosen changes to the last row. This
recorder does not invent a disposition or claim those parents already authorize
a historical action exception. Production authority remains none.

## Implementation observations, separate from authority

`OBS-RTHCS-SVC-002`: exact source reads at the same Svc SHA reveal reachable
implementation constraints. They corroborate the gap but do not create or
override Product Contracts:

- [`assistance_transaction/checks.rs`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/src/store/postgres/workflow_instance_repository/assistance_transaction/checks.rs#L83):
  `owner_case` at 83–101 rejects a case unless its visit equals the instance's
  current visit; `evaluate_owner_identity_state` at 120–147 also checks enabled
  actor, effective Domain Owner, current visit and governed effect predicates.
  Historical request acceptance alone would not make this reply/action legal.
- [`assistance_transaction/query.rs`](https://github.com/mayf3/svc-workflow/blob/b5096782f666ad22aa3508fdbf9562278a977c0f/src/store/postgres/workflow_instance_repository/assistance_transaction/query.rs#L255):
  OwnerInbox at 255–263 selects pending/human-required cases under current
  enabled Owner authorization; detail at 372–424 allows requester or current
  Owner visibility. Read visibility is not action eligibility or responsibility
  transfer evidence.

No service call, database transaction, test or cross-service acceptance was
executed. Source observations do not establish installed/runtime support.

## Search limitations and issue boundary

`OBS-RTHCS-SVC-003`: the pinned Svc Spec index contains current WEC V3 and Owner
Workflows V3. GitHub file and PR searches for `RECOVERY_REFUSAL_TERMINAL` returned
no results in this task; recursive tree discovery supplied no RTH-named Spec.
Search indexing and names are incomplete evidence of absence. The conclusion is
**no paired accepted RTH authority found in this bounded readback**, not a claim
that no related private branch, discussion or unindexed file exists. Any later
candidate must supply its exact accepted/main coordinates before activation.

`OBS-RTHCS-SVC-004`: [Core PR #644](https://github.com/mayf3/dsh-agent-core/pull/644)
readback is merged, head `8f68a94668764f957043640fa1eb23740a760a29`, merge
`4f7df01bcf087075c114901a96a7a54573110f61`. Its body and
[#1377 split comment 6701777981](https://github.com/mayf3/agent-control/issues/1377#issuecomment-6701777981)
record the delivered blocked-only automatic recovery slice: cadence persisted
before refusal, then original poller terminal read-only consumption, UNKNOWN /
identity / default-OFF preserved. The historical report leaves ordinary planned
implementation undelivered and production/business/unattended runtime unverified.
[#1377](https://github.com/mayf3/agent-control/issues/1377) remains OPEN in this
readback. These historical implementation facts do not negate later PPR accepted
authority and do not prove PPR planned source delivery. RTH must preserve the
delivered blocked gate and original responsibility; its receipt is no planned /
resume permit and does not close #1377's full runtime/business outcome.

`EVD-RTHCS-SVC-001`: OBS-001 and the pinned Contract reads support CLM-001 and
the pairing checklist at these coordinates. OBS-002 corroborates current source
limitations; OBS-003 qualifies discovery completeness; OBS-004 preserves prior
delivery boundaries. None proves execution, deployment, Owner acceptance of a
new protocol, or autonomous end-to-end success.
