# Independent proposed-authority review — RTH Core successors

**PASS for docs-only proposed publication; zero blocking findings.** This review
does not accept either Spec, retire a predecessor, authorize implementation,
authorize merge, or verify runtime/business/unattended success.

## Coordinates, independence and frozen scope

- Reviewer: `/root/authority_audit`; candidate author: `/root`. The reviewer
  supplied read-only source/route analysis and did not author or edit the five
  candidate documents. This review file is the reviewer's only delivery edit.
- Repository/worktree: `mayf3/dsh-agent-core`, `/private/tmp/h1377-minimpl`;
  isolated ref `docs/rth-core-successor`.
- `REVIEW_TARGET_HEAD = d195a08f530f985345750fe9984838a3218a92ea`.
- `BASE_HEAD = b6ddc2a67ba041b8b13ed33d331104cf809d4985`.
- `CURRENT_BASE_HEAD = b177d3fcce3febb09711135c145cc4b43e63aa8e` (the fetched
  local object used for impact comparison, not a claim of perpetual remote tip).
- `REVIEW_KIND = SPEC`, `REVIEW_SCOPE = FULL`,
  `FULL_REVIEW_BASIS = INITIAL_REVIEW`. Full means the actual five-file proposed
  delta and affected inherited Contracts; it does not mean a repository-wide
  product or production audit.
- Selected mode: `.agents/skills/spec-governance/modes/REVIEW.md`.
  Governing sources: accepted local grammar/constraints, SPEC_FORMAT_V0,
  Architecture, D-008/D-009, and accepted WEC4/PPR1/RTH1 at the base.

The complete known blocker union is frozen as `FROZEN_BLOCKER_UNION = []`.
No repair/review loop was used. Svc acceptance/compatibility/runtime gates below
are explicitly retained future implementation gates, not failed gates for this
authorized proposed-document publication.

## Reviewed identities and executed observations

All SHA256 values below were independently computed from
`git show REVIEW_TARGET_HEAD:<path>` file bytes:

| Candidate file | SHA256 |
|---|---|
| `BRIEF-RTH-CORE-SUCCESSOR.md` | `14be2c7caa97838c69264bc347495c0eda8fc369db8a5d3999eb5febd47b07c9` |
| `RECEIPT-RTH-CORE-SUCCESSOR.md` | `a7bafecffa95157b8ff1fed723a546e0358134fbd8f2dc164ea81c312ba98d1b` |
| `docs/reports/rth-core-successor/svc-authority-readback.md` | `f50d641930d6f434918cc1a2a63964ebc71176141bc3a019521f21b1018842c1` |
| `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md` | `68b4d5de54810b47a515f80208b423cbb92f07242ab6acf4439e66d26b04ee11` |
| `docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2.md` | `85675e5cc6089e689580eef7f51d6e03663d3eb864a634d974e44f79f4001193` |

- `OBS-RTHCS-REV-001`: Git-object reads, YAML parsing and marker extraction
  independently confirmed WEC5's carried WEC4 body and PPR2's carried PPR1 body
  equal the complete base source bodies. RTH Contracts and Acceptance sections
  likewise equal the corresponding base RTH1 sections. The exact marked RTH
  section hashes are respectively
  `f218ea4cae3d712077dc092c7be16d61c99eca7aa838cc2e35ff57d17171506f`
  and `d01565645c56de608f1ab47ccd9c9f2800e92fdfbf3504f12b4717b2e4c46d68`.
  Unique Contract-heading counts are 13 (WEC5) and 34 (PPR2).
- `OBS-RTHCS-REV-002`: `git diff --check BASE_HEAD REVIEW_TARGET_HEAD` returned
  rc0. The diff contains exactly the five added Markdown files above, with no
  accepted-authority, source, test, configuration, or production-state edit.
- `OBS-RTHCS-REV-003`: `python3 .agents/tools/verify_governance.py --target .
  --require-accepted` returned rc0: vendored bytes match the accepted lock.
- `OBS-RTHCS-REV-004`: the base-to-current-base path diff for `docs/specs/`,
  `.agents/`, `docs/decisions/`, and Product Architecture was empty. Relevant
  accepted authority has not moved in that fetched interval. The candidate
  remains at its requested parent and exact reviewed HEAD.

These deterministic observations support the identities, complete carry and
scope assertions. Semantic conclusions below are independent reviewer judgment;
none of the checks claims to prove an implementation or a running Svc.

## Semantic result and affected-Contract judgment

1. **Whole succession and acceptance boundary: PASS.** RTH1 §3.1 expressly
   requires successors to the then-current WEC4 and complete PPR authority.
   Accepted PPR1 §2/§8/CTR-PPR-004 and carried terminal-refusing rules exclude
   the new branch. Both proposed files use SUPERSEDE, list only their direct
   current predecessor, preserve the complete bodies, and explicitly resolve
   changed meaning in their effective-composition crosswalks. No NEW or AMEND
   bypass, historical WAE/Liveness fork, partial-supersession transaction, or
   stable accepted-ID rewrite was found. Proposed `none` is explicit; future
   Owner accepted/contracts, reciprocal retirement/current-carrier updates,
   independent final-HEAD review and main/base activation are separate gates.
   The original Brief's ambiguous ruling number is resolved against the
   persisted four-PR ruling in both candidate §3s and receipt §1.
2. **Terminal metadata versus execution: PASS.** PPR2's crosswalk and
   CTR-PPR2-007 add only RTH handoff metadata to the single append-only ledger.
   Recovery E3 remains terminal no-op; original refusal is not repeated;
   B1/B4's historical exception is not generalized. Original tuple, terminal
   verdict/events, WAL, fresh lock/replay/CAS, delayed-old-generation isolation,
   UNKNOWN, and business-versus-termination distinctions remain binding.
   No new generation, replay, business/termination settlement, fence clearing,
   Scheduler occurrence/nextRun write, or automatic #650 a/b closure follows.
3. **System and receipt protocol: PASS.** PPR2 carries all six accepted RTH
   protocol Contracts. WEC5's new branch uses genuine system authorization,
   closed DTOs and attributable historical relationships; discrepancy-only
   does not claim the source owner is the authoritative assignee. The same
   durable intent/key/body and same-command readback cover loss/restart;
   ACK/case ID/queue/function presence cannot discharge responsibility.
   Legal recipient, actual same-request admission, consumer, verified reply
   and durable retrigger remain cumulative requirements; failures retain the
   original automatic responsibility. WEC5 adds no broader unlocked-read rule.
4. **Svc pairing and managed consumers: PASS with gates retained.** The
   pinned Svc recorder evidence explicitly distinguishes current V3 Contracts,
   source observations, discovery limitations and unknown runtime support.
   The candidates do not declare Core authority over Svc or pretend current
   historical action/receipt support. Required Svc successor IDs/accepted heads
   remain UNKNOWN/REQUIRED; no RTH source implementation/producer enablement
   is allowed before the paired authorities enter their respective bases.
   Request-time pinned Owner policy, opt-in routing and source retirement are
   not bypassed by a direct wake. Their historical interaction and Owner-change
   reacceptance must be decided by Svc before this new branch is implemented.
   These disclosed dependencies do not require inventing Svc policy here.
5. **#644, ordinary planned and resume separation: PASS.** The original blocked
   gate/cadence/audit/failure consumer, ordinary initial generation=1 proof/WAL
   eligibility, default-OFF boundary, and independent #1379/#643 scopes are
   retained. The `plannedRecoveryProof.sourceAuthorityId` V1 constant remains
   the original plan-provenance wire value; PPR2 expressly forbids candidate
   revisions, V2 retagging, historical proof rewriting or an invented new writer
   qualification path. The current recovery gate can be PPR2 without relabeling
   the old proof. New schema/writer qualification remains outside this delta.
   WEC resume's old two reasons/active-current/settled/baseline/single-permit
   constraints remain intact; RTH receipt/resolve is expressly not a permit.
6. **Acceptance and evidence: PASS.** All 13/34 Contracts have direct and
   reverse Acceptance coverage, inherited product negative cases and persistent
   evidence gates remain present, and current lifecycle checks replace only
   source-time authoring/PR mechanics. The old bodies' branch-time lifecycle
   text is explicitly identified as historical. Receipt §5 distinguishes source
   eligibility from enabling/release/installation/business and unattended
   outcomes, preserving #1377's original STOPPED. No executed-product PASS is
   claimed by copied test definitions or historical source evidence.

`EVD-RTHCS-REV-001`: OBS-REV-001..004 and the named accepted-source/candidate
Contract reads support the above exact-head documentation review. Sufficiency:
proposed docs publication. Limitations: no new Product Authority acceptance,
Svc implementation/consumer qualification, installed binding, production call,
business result, or autonomous end-to-end conformance was inspected or proved.

## Review output

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
SPEC_REVIEW = ACCEPT (review recommendation for proposed publication only)
REVIEW_TARGET_HEAD = d195a08f530f985345750fe9984838a3218a92ea
BASE_HEAD = b6ddc2a67ba041b8b13ed33d331104cf809d4985
CURRENT_BASE_HEAD = b177d3fcce3febb09711135c145cc4b43e63aa8e
REVIEWER_ID = /root/authority_audit
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = CONTROLLED
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE (relevant authority paths unchanged)
REVIEW_SCOPE = FULL
SCOPE_REASON = initial review of the five-file proposed documentation delta
FULL_REVIEW_BASIS = INITIAL_REVIEW
IMPACT_EVIDENCE = exact Git-object hashes/carry checks and authority-path diff above
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0 (no additional gap blocking proposed publication; disclosed Svc gates remain)
FOLLOW_UPS = 0
TOOLING_DEBT = 0
PROPOSED_DOCS_PUBLICATION_READY = YES
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (acceptance and merge excluded from this task)
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (append review receipt, final-HEAD documentation delta check, push/open PR only)
```

A commit adding this review and a factual delivery receipt needs a bounded
independent final-HEAD delta recheck. Any normative candidate change invalidates
the affected conclusion; this PASS is not permission to repair or silently change
the reviewed semantic head.
