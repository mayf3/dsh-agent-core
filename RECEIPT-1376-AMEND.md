# RECEIPT-1376-AMEND

RESULT = PROPOSED_DOCS_DELIVERED; no authority acceptance, implementation or business PASS.

Repository/worktree: `mayf3/dsh-agent-core` / `/private/tmp/h1376-budget`.
Branch: `docs/readback-aging-handoff-amend`; PR base: `main`.
PR: https://github.com/mayf3/dsh-agent-core/pull/643 — opened, unmerged.
Authorization: provided `BRIEF-1376-AMEND-AUTHOR.md`, standing preauthorization V1 §2 as cited by Owner;
only proposed docs, push and PR; no self-merge or production effect.

## Exact coordinates

```text
BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
HEAD_SHA_AT_RECEIPT_CAPTURE = d8fc43ad0fb6cb462bab847416f0371ca92a9b58
REVIEWED_SEMANTIC_HEAD = d8fc43ad0fb6cb462bab847416f0371ca92a9b58
PROPOSAL_SHA256 = 3ac3478f4e9f71c0fd27276ffd568b3d5f44c135c47d4113f1f64be989d243ad
```

Proposal: `docs/specs/AGENT_CORE_READBACK_AGING_HANDOFF_V1.md`.
This receipt is the only follow-on commit. Its exact final delivery SHA and independent delta readback
are bound externally in the PR body after push; the semantic HEAD above is not mislabeled as that
receipt commit. The proposal bytes must remain identical at delivery.

## Clause crosswalk: all six mandated constraints

All accepted coordinates below are at BASE_HEAD; full paths and preserved meaning are in proposal §3.2.

| Brief constraint | Exact accepted clauses | Proposal binding / result |
|---|---|---|
| 1. New reason, independent aging, no fake exhaustion | LIVENESS CTR-EKRWAE-002:189–199; WEC V3 CTR-WEC1-005:152–169 and CTR-WEC1-008:237–257; frozen DW-1 | CTR-RBAH-001/004: READBACK_WAIT_BUDGET_EXHAUSTED; finite firstWait/budget/deadline, no reset by reschedule/failure/unfinished read/restart; old reasons retain actual prerequisites |
| 2. System actor, no assignee impersonation | LIVENESS §8:144–171; WEC CTR-WEC1-008:259–271; WAE V3 CTR-WAE-008:363–372 | CTR-RBAH-002: process-derived poller/system requester, no new grant or assignee write role; activation assignee/requester/receiver separated |
| 3. Original identity + UNKNOWN + no replay/fence writes | LIVENESS CTR-EKRWAE-001:175–187, CTR-EKRWAE-003:201–216; WEC CTR-WEC1-008:204–233; D-009 §8.4/8.5 and alignment CTR-527D2-002/003 | CTR-RBAH-003/006: original tuple/generation/revision, protected state zero write, no business replay, no new resume permit |
| 4. Full reliable transfer and failure responsibility | LIVENESS CTR-EKRWAE-003:201–216 / CTR-EKRWAE-007:276–285; WEC CTR-WEC1-005:152–169 | CTR-RBAH-005: durable immutable intent/key/body, idempotent Svc command receipt/readback, authoritative receiver, exact delivery proof, named subsequent consumer, verified reply, durable retrigger; failed delivery/ACK never transfers responsibility |
| 5. Closed DTO, schema and old consumer behavior | WEC CTR-WEC1-008:237–271 | CTR-RBAH-004/005: closed new object and evidence fields with types/enums/nullability/ranges/relations; old service rejection never maps to old reason, unknown consumer fails closed and retains responsibility; no activation without actual compatibility proof |
| 6. Separate #1379; no second ledger/platform/business retry | LIVENESS §2, CTR-EKRWAE-003; WAE bounded delta:34–36 / CTR-WAE-008; WEC §1 | §2, CTR-RBAH-006, §§11–12: existing ledger/Scheduler/Assistance only, consume existing transport proof, no Wake implementation or blind business retry |

## DONE_WHEN: this authoring delivery

| Gate | Frozen authoring outcome | Evidence / actual |
|---|---|---|
| A-DW-1 | Proposed AMEND request under docs/specs, exact three-authority coordinates, zero implementation authority | Proposal frontmatter/§§3,9,13; six Contracts with seven Acceptance definitions |
| A-DW-2 | Six brief constraints bound without silently changing accepted meaning | Above crosswalk; §3.1 explicitly leaves WEC lifecycle and paired Svc acceptance open |
| A-DW-3 | Independent exact semantic-head review, no blocker against proposed-document delivery | `/root/authority_check`, reviewed semantic HEAD/hash above; FROZEN_BLOCKER_UNION=[] |
| A-DW-4 | Spec syntax/scope/integrity/structure checks, honest non-execution limits | Actual rc0 records below; product tests and runtime checks NOT_RUN |
| A-DW-5 | Requested branch pushed, open main PR, reviewable receipt, no merge | Push rc0; GitHub create response PR #643 open/merged=false; this receipt is delivered on the same branch |

Original #1376 implementation `RECEIPT-1376-BUDGET.md` DW-1..5 remain frozen and unmet as recorded.
They are not replaced by A-DW-1..5 and no implementation gate is claimed PASS.
Source baseline/frozen input documents are preserved byte-for-byte for remote reviewability.

## Independent review

Reviewer: collaboration agent `/root/authority_check`; author: `/root`.
Reviewer performed read-only authority/issue/source and exact-candidate checks, wrote no semantic delta,
did not run production operations or post external messages.

```text
REVIEW_KIND = SPEC
REVIEW_SCOPE = FULL (initial bounded proposed-document review)
AUTHOR_INDEPENDENCE = PASS
SPEC_REVIEW = ACCEPT (proposed-document delivery recommendation only)
AUTHORITY_REVIEW = PASS (nonactivating boundary)
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0 newly discovered for proposed-authoring delivery
FOLLOW_UPS = 0
READY_TO_MARK_ACCEPTED = NO
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (author may only open PR)
OPERATION_ALLOWED = NO
```

Review confirmed all six constraints; no repair was requested. Existing WEC accepted-enum lifecycle
and paired Svc acceptance are disclosed future acceptance dependencies, not falsely closed gates.
Final receipt-only delta receives independent review with the exact final SHA in PR metadata;
the semantic review above does not certify unreviewed new semantics.

## Executed checks and limits

Executed on 2026-11-07 against the semantic HEAD/base above:

```text
python3 .agents/tools/verify_governance.py --target .
vendored governance bytes match governance.lock.json
rc=0

New proposal frontmatter schema / proposed-only / 13 sections / 6 Contracts / 7 Acceptance definitions: PASS
rc=0

python3 .agents/tools/validate_spec_transition.py --base <temporary empty-new-record set> --candidate <temporary proposal-frontmatter set>
Spec transition is a valid whole-authority lifecycle state
New-record-only transition rc=0

node scripts/verify-code-structure.mjs --base 3c1bcf98bc40a2c34cca24f241c87d1b12cea216 --head d8fc43ad0fb6cb462bab847416f0371ca92a9b58
verify-code-structure: CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT
candidate violations: 0; baseline debt: 28; resolved debt: 0

git diff --check BASE_HEAD REVIEWED_SEMANTIC_HEAD
no output; rc=0 (independently rerun by reviewer)

git diff --exit-code BASE_HEAD REVIEWED_SEMANTIC_HEAD -- packages scripts .agents <three accepted authority paths>
no output; rc=0

git push -u origin docs/readback-aging-handoff-amend
new branch pushed; rc=0
```

The schema/coverage check used Python yaml/jsonschema with Draft202012Validator, checked proposed/none,
13 sections, six stable Contracts and seven Acceptance rows plus reverse coverage.
New-record lifecycle validation is scoped to the added proposal; it is not a full historical corpus
audit, semantic AMEND acceptance or proof that the closed enum is already legal. No governance lock,
adoption status, verifier or accepted authority was modified; proposed adoption permission was not used.

Product tests/observation-cas/Docker/cross-service E2E/production verification: **NOT_RUN**;
test rc=NOT_APPLICABLE, no test process started. Acceptance tables are future definitions.
No runtime/business outcome, autonomous workflow completion, implementation or installation PASS.

## Changed files and acceptance handoff

- New proposal and this new receipt.
- Included unchanged input snapshots: `BRIEF-1376-AMEND-AUTHOR.md`, `BRIEF-1376-WAIT-BUDGET.md`,
  `STOPPED-1376-BUDGET.md`, `RECEIPT-1376-BUDGET.md`.
- Zero product code/tests, `.agents/tools` or other `.agents` changes; no other checkout/node_modules/
  Router/Scheduler/production writes, rebase or merge.

Next chain: proposed document → independent review → Owner acceptance-route disposition and exact
Core/Svc authority acceptance → #1376 implementation RE_PREFLIGHT in the accepted base, reusing frozen
DW-1..5 and valid unaffected evidence. This proposal retains `implementation_authority: none` even
if accepted alone; a lawful implementation-authorizing authority must explicitly supply the change.
WEC closed-enum change normally needs docs-first whole-authority succession; no historical exception
is inferred. Missing or unaccepted Svc protocol evidence remains a stop for dependent implementation.

`STOPPED-1376-BUDGET.md` remains open and unchanged. No authoring check or independent review failed,
so no failure entry was appended. The requested delivery stops at this open, unmerged PR.
