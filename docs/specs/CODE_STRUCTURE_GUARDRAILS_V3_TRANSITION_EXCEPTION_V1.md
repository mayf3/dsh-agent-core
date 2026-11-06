---
spec_id: CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core/scripts/verify-code-structure.mjs
  - focused structure-verifier regression tests
  - one exact scripts/trusted-cp-deploy-install.sh transition
governed_by:
  - CODE_STRUCTURE_GUARDRAILS_V2
  - CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
date: 2026-11-06
---

# V3 transitional exception — one exact installer whitelist transition

## 1. Status and authorization boundary

This is a proposed, bounded transition supplement to the accepted repository-local
`CODE_STRUCTURE_GUARDRAILS_V2`, not a replacement of that rule. The Owner's third
ruling of 2026-11-06 authorizes preparation of this document, its verifier
mechanism, tests, receipt, commit, push, and an unmerged PR. It expressly reserves
formal acceptance to the Owner after independent review. Preparation does not
activate this exception or grant product-source or production-write authority.

The normal governance rule makes every `SUPERSEDE` route docs-first and requires
a whole-authority successor with reciprocal lifecycle links. This task does not
claim that the ordinary `AMEND/NEW` atomic route permits replacing accepted V2
meaning. The explicit Owner instruction is the task-specific authorization to
prepare the narrowly scoped exception and verifier together for review. It does
not authorize a general governance override, V2 edits, or self-acceptance.

V2 remains accepted and unchanged. This supplement becomes usable only after
independent exact-revision review, explicit Owner acceptance of the reviewed
revision, and merge into `main`. An accepted-looking unmerged branch is not
active authority. The verifier must consume the accepted document from the exact
comparison base, with identical document bytes at comparison head. This proposal
alone, or a candidate-side acceptance edit, cannot grant the exception.

## 2. Preserved authority

The complete V2 rule continues to govern, except for the single exact finding
disposition defined below. Its fixed eligibility baseline remains
`d506f81105e8aa05177a01b817ebe11dcc076ba5`. The ordinary handwritten-file limit
remains **500 physical lines**, including comments and blank lines; a trailing
newline adds no line. All warning thresholds, directory-width and depth limits,
major-change, no-growth, anti-evasion, generated-allowlist, registry-validation,
and candidate/debt rules remain in force.

The unchanged source authority at the preparation base
`75ece578301b014a23b987568d1eb8af96795300` is:

| Authority | Path | Git blob |
|---|---|---|
| V2 structural policy | `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md` | `7b828fd1d03ff70d61d0b72be7c61b64712b514d` |
| Verifier implementation contract | `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md` | `76a21d47a480c7551b93617e2fc2c7916f40e6f1` |

This supplement changes neither file nor `.agents/structure-registry.json`.
It adds no cap, generated allowlist, rolling baseline, or current-size
registration. It does not legalize historical debt or change V2's meaning for
any other transition. No change to PR #603, product source, deployment, runtime,
or production state is authorized.

## 3. Observed exact delta

`OBS-V3TE-001`: local Git-object inspection on 2026-11-06 found:

| Subject | Old blob | New blob |
|---|---|---|
| `scripts/trusted-cp-deploy-install.sh` | `ef5053201e6af88b1edbcdfc33e845f872183b2b` | `356899a8ec0726f245790379429f97dfc6ea3bfb` |
| Physical lines | 1315 | 1315 |
| Blob bytes | 76444 | 76467 |

`git diff --no-ext-diff --no-textconv --unified=3 <old-blob> <new-blob>`
shows one replaced `APP_SCRIPTS_WHITELIST` line, at line 627: insert the exact
token `scheduler-watchdog.mjs ` immediately after `agentcore-cron.mjs `.
All preceding and following bytes are identical. Both tree entries use mode
`100644`. The observed diff is **one added diff line and one deleted diff line,
with zero net physical-line growth**. The Owner's “+1 行白名单” denotes the
whitelist addition; it is not evidence of 1314→1315 or 1315→1316 line growth.

`EVD-V3TE-001`: these exact Git blobs, physical-line counts, byte counts, and
blob-to-blob diff support only the claim that this is the specified whitelist
transition. They do not prove production installation, watchdog behavior,
general structural conformance, or acceptance of this proposal.

`OBS-V3TE-002`: the unchanged V1-format registry already has an installer row
with `approved_max_lines: 841`, while the immutable d506 baseline installer has
493 physical lines. V2 therefore reports `INVALID_FILE_EXCEPTION_AUTHORITY`;
the historical row is not an effective 841-line ceiling. This supplement keeps
the original row, finding identity, and measured 1315-line debt visible. It does
not repair or approve that row.

## 4. Exact exception record and Contracts

The only record admitted by this supplement is:

```STRUCTURE_TRANSITION_EXCEPTION_V1
{
  "path": "scripts/trusted-cp-deploy-install.sh",
  "baseBlob": "ef5053201e6af88b1edbcdfc33e845f872183b2b",
  "headBlob": "356899a8ec0726f245790379429f97dfc6ea3bfb"
}
```

### CTR-V3TE-001 — One transition identity

The verifier must resolve exact comparison commit OIDs, read their tree entries,
and match the entire path/baseBlob/headBlob tuple above. It must also establish
unchanged `100644` file mode, the exact observed whitelist-token insertion, and
1315 physical lines at each endpoint. Only that combination may apply the
exception. Missing Git evidence fails closed; prose or supplied line counts
cannot substitute for actual object inspection.

The record is one transition identity, not a reusable file-size permission.
Rechecking the same exact coordinates is reproducible verification, not a second
grant. Once the new blob is the comparison base, this record grants no future
edit. Restoring the old blob to manufacture a separate grant is not authorized.
No runtime consumption ledger or new durable registry is introduced.

### CTR-V3TE-002 — Single finding disposition, visible debt

On exact match only, the verifier may exempt the installer's
`EXCEPTION_REGISTRY / INVALID_FILE_EXCEPTION_AUTHORITY` candidate finding
associated with this transition. It must report that the precise transition exception was
applied, bind the record to the exact comparison OIDs and blobs, and retain the
visible historical technical-debt fact that the installer remains 1315 lines
against the ordinary 500-line limit.

This is not a general-compliance result or resolved debt. The existing
`baseline_debt[]` item may retain its original stable finding key only with an
explicit `transition_exception` marker linking the precise grant; it must not be
presented as ordinary unaffected V2 debt, silently dropped, or represented as a
repository-wide PASS. Other inherited debt remains visible under V2. Every other candidate finding, including directory, depth, statement
density, generated disguise, fixture hiding, major change, and excluded-root
move findings, retains its ordinary V2 disposition.

### CTR-V3TE-003 — Closed scope and invalidation

Any other installer edit invalidates this grant: either blob changing, an
additional line, a same-line-count content edit, token reordering, mode change,
rename, path alias, or another path carrying the same bytes must not inherit it.
An affected exception path that fails the exact match is reported as a candidate
violation, never a warning or a refreshed cap. A different over-limit file still
fails under V2, even when this exact installer transition is present.

Absence of this record or its governing document must preserve V2 behavior.
A proposed document grants nothing. Unknown, malformed, duplicate, or broadened
active records must fail closed; no command-line or environment bypass may
enable one. Candidate-side document or registry edits cannot self-activate the
exception. Existing V2 registry-mutation and invalid-configuration exit behavior
remain unchanged.

### CTR-V3TE-004 — Separate split obligation

The following debt entry remains open even when the exact transition passes:

| Field | Binding value |
|---|---|
| Debt ID | `DEBT-V3TE-INSTALLER-1315` |
| Path and measured state | `scripts/trusted-cp-deploy-install.sh`, 1315 physical lines at both pinned blobs |
| Ordinary standard | 500 physical lines; the installer is historical technical debt |
| Accountable Owner | `mayf3` |
| Implementer | To be assigned by the Owner in a separate split task; none is invented or delegated here |
| Follow-up responsibility | Owner records and assigns a bounded installer decomposition task, retaining this debt ID and exact starting revision |
| Closure evidence | Reviewed resulting source, exact base/head, structure-verifier result, isolated offline behavior-preservation tests, and Owner acceptance of the split |

The split acceptance requires every resulting handwritten executable file to be
at or below 500 physical lines, with the resulting files and directories meeting
V2 width, depth, density, anti-evasion, and applicable registry rules. Isolated
offline tests must preserve installer behavior and its whitelist handling without
executing production installation. Moving the same oversized file, hiding code,
duplicating logic, or raising a cap does not close the debt. Production acceptance
is neither claimed nor authorized by those tests.

The follow-up is separately accountable work. Its assignment, implementation,
and acceptance are not prerequisites for the specified one-line whitelist fix.
This task creates neither a fictitious implementer nor a fictitious completed
follow-up issue.

## 5. Acceptance evidence

Independent review must bind the exact proposed document, verifier, test revision,
comparison base, final reviewed head, and test results. Required cases are:

| Case | Required result |
|---|---|
| Active accepted record in base; exact path, blobs, mode and diff | The single installer finding is exempted, with applied-record coordinates and 1315-line debt visible |
| Either blob changes, including equal-length edits or extra growth | Candidate fails; no grant or cap refresh |
| Rename, alternate path, or file-mode change | Candidate fails; no inherited exception |
| Other changed oversized file alongside exact installer delta | Other file fails under ordinary V2 rules |
| Document or record absent; document proposed | Existing V2 result and behavior are retained |
| Candidate attempts to activate or broaden the record | Fails closed; no self-activation |
| Registry/baseline/caps/allowlist changes | Existing V2 rejection remains in force |
| Ordinary V2 regression matrix | Frozen thresholds, unrelated debt visibility, exit statuses, and anti-evasion behavior are preserved |

Offline fixtures may simulate an accepted authority base to verify the mechanism;
that simulation is not Owner acceptance or activation in `main`. PR #603 is not
modified or revalidated in this task; any such revalidation follows V3 acceptance
under a separate instruction.

## 6. Delivery and stops

Deliver this proposed rule, the bounded verifier change, focused tests, and
`RECEIPT-V3-EXCEPTION.md`, with actual commands, results, coordinates, and scope
readback. Commit and push the isolated candidate; open a PR whose title includes
`V3 transitional exception`. Do not merge, mark this proposal accepted, alter the
fixed V2 baseline/registry, or write production state.

If the precise exception cannot be expressed or a required gate fails, stop this
route and record the actual failure in `STOPPED-V3-EXCEPTION.md`. Do not repair it
by refreshing registry caps, rebaselining, or widening this exception. The fallback
is separately authorized compliant decomposition under the existing 500-line
limit. Owner formal acceptance remains pending.
