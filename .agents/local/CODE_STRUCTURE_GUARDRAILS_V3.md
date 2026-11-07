---
spec_id: CODE_STRUCTURE_GUARDRAILS_V3
status: proposed
spec_kind: invariant
authority_level: repository_local_rule
rule_kind: repository-local binding rule
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core repository-local structural policy
  - the previously accepted exact installer transition and visible split debt
governed_by: []
external_authorities: []
supersedes:
  - CODE_STRUCTURE_GUARDRAILS_V2
  - CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1
superseded_by: null
owners: [mayf3]
date: 2026-11-07
---

# Code Structure Guardrails V3 — standalone whole-authority successor proposal

## 0. Proposal, source coordinates and reading rules

**PROPOSED.** This document has no present acceptance, implementation, runtime or
production effect. V2 and the accepted exact-transition supplement remain the
active authorities. This PR prepares one complete successor for independent
review; it does not perform the later acceptance or retirement transaction.

This is a repository-local binding-rule proposal, in the same authority family
as V2. Its native YAML uses `authority_level: repository_local_rule`; it does not
reclassify V2 as a governing Spec or claim the governing-Spec frontmatter schema.
The stable `spec_id` retains the V3 identity from the R2 task. Empty `governed_by`
expresses its proposed top-level local structural-policy role; only the Owner's
later acceptance may establish that role.

The source snapshot is main `230de798e340cc6c157e6b21822f0b1fda77e51e`:

| Source | Git blob | Disposition in this proposal |
|---|---|---|
| V2 local rule | `f3cea29603385bc5c8eda6d0b6f423f9ee58daef` | Full effective policy below, verbatim; historical lifecycle statements retain their original coordinates |
| TE_V1 supplement | `a87b968fc0d89c1c0c1955ee1bf649b5e66c3307` | All four exception Contracts and their full acceptance section below, verbatim |
| Verifier conformance Spec | `76a21d47a480c7551b93617e2fc2c7916f40e6f1` | Unchanged separate implementation authority |

The current chain's B changes only TE_V1's malformed supersedes format and adds
its historical correction note. Its pre-existing body, accepted semantics and
acceptance history remain unchanged. No standalone R1/R2 draft existed at the
inspected coordinates; this proposal reuses the R2 two-phase sequencing and the
actual accepted V2/TE source text, rather than claiming an earlier finished draft.

The carried policy below is the proposed standalone text, not a requirement to
look up V2 for missing rules. Its source numbering and words are preserved.
References to V2 identify the inherited policy and existing protocol/output
identities; they do not silently rename verifier wire labels or declare a V3
runner qualified. Source-local historical statements about V1-to-V2 activation,
V2 implementation or prior acceptance describe those original transactions;
they do not roll back current lifecycle state. Section 12 alone defines this
proposal's prospective V3 acceptance and whole-authority succession timing.
The explicit exact-transition rule in section 10 is the sole exception to the
otherwise unchanged carried policy, just as in the accepted source pair.

The normative source header values, apart from predecessor-specific identity and
historical lifecycle markers, are also carried verbatim:

```text
IMPLEMENTATION_CONTRACTS = CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1
ENFORCEMENT = machine verifier (scripts/verify-code-structure.mjs) + manual review
BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5 (unchanged from V1)
ACCEPTANCE_ACTORS = mayf3 or an explicitly authorized maintainer recorded in the acceptance PR
REGISTRY_APPROVAL_ACTORS = [mayf3] (a different actor requires an accepted rule change; prose alone cannot extend this list)
```

<!-- BEGIN CARRIED_V2_POLICY -->
## 1. Goal and scope

Bound the size and nesting of handwritten code so review stays possible. Apply the same V1 scope, exclusions, counting methods, warning thresholds, hard limits, and anti-evasion controls. V2 adds an honest distinction between the candidate's new/affected violations and unchanged historical debt. Historical debt remains visible and never becomes a valid exception or a repository-wide PASS.

The in-scope and excluded paths are unchanged from V1:

```text
IN_SCOPE = packages/<pkg>/src/**, packages/<pkg>/test/**, scripts/**, examples/**,
           other handwritten source/test/executable code admitted by V1 §2
EXCLUDED = docs/specs/**, docs/decisions/**, docs/investigations/**,
           docs/evidence/**, docs/reports/**, .agents/protocol/**,
           governance-lock-pinned files, generated allowlist, lockfiles,
           snapshots, binary assets, node_modules, git/worktree metadata
```

New handwritten executable code outside current roots MUST be placed under `scripts/` or a package, or requires a separately accepted rule version that changes scope.

## 2. Frozen limits retained from V1

V2 preserves every V1 numerical limit and measurement mode:

```text
HANDWRITTEN_FILE_WARNING_LINES = 400
HANDWRITTEN_FILE_MAX_LINES = 500
DIRECTORY_WARNING_CHILDREN = 16
DIRECTORY_MAX_CHILDREN = 20
MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT = 4
MAX_STATEMENTS_PER_LINE = 3
BARREL_MAX_LINES = 60
BARREL_MAX_REEXPORTS = 20
LINE_COUNT_MODE = PHYSICAL_LINES_INCLUDING_COMMENTS_AND_BLANKS
DIRECTORY_COUNT_MODE = IMMEDIATE_TRACKED_CHILDREN (files plus directories)
DEPTH_ROOT = NEAREST_PACKAGE_OR_MODULE_ROOT (nearest package.json ancestor; repository root fallback)
```

A line-count, directory-count, depth, or scope change requires a new whole rule version; registry or implementation changes cannot alter these values.

## 3. File and directory requirements retained from V1

- An in-scope handwritten file over 500 physical lines violates the limit. 401–500 lines is a warning. A trailing newline does not add a line.
- A barrel-style `index.*` file is a re-export hub with more than 20 re-export/import-from lines and re-export lines exceeding half of its non-blank lines. It violates the rule above 60 lines or above 20 re-exports. A large implementation `index.*` file that is mostly implementation uses the ordinary file limit.
- An in-scope directory with more than 20 immediate tracked children violates the limit; 17–20 is a warning.
- A source file more than four levels below its nearest module root violates the depth limit; depth exactly four is a warning. Directory width and depth are jointly enforced.
- `NEW_FILE_OVER_500 = HARD_FAIL`; `EXISTING_UNTOUCHED_OVER_500 = GRANDFATHERED`; `EXISTING_TOUCHED_OVER_500 = MUST_NOT_GROW`; `MAJOR_CHANGE_TO_EXISTING_OVER_500 = MUST_SPLIT`.
- The major-change threshold remains `ADDED_LINES > 100 OR CHANGED_LINES > 20_PERCENT_OF_BASE_FILE`, where changed lines are additions plus deletions in exact `--base..--head`.
- A file at or below 500 lines at comparison base that crosses above 500 at head is a hard violation. Registry rows cannot excuse new or newly oversized files.
- A legacy file edit MUST NOT increase its line count over the exact comparison base. A major edit to a grandfathered file must split. Registry metadata cannot waive either rule.

## 4. Fixed-baseline registry and authority

The only eligibility anchor remains the immutable `BASELINE_COMMIT` above. It is read from the accepted V2 rule and resolved to a full commit OID. The registry MUST name exactly that OID. `--base`, `--head`, a branch name, a PR base, and a current file size MUST NOT replace or advance it.

An active file exception is valid only when the path exists at the fixed baseline and has more than 500 physical lines there, and its well-formed integer `approved_max_lines` exactly equals the measured fixed-baseline line count. A well-formed numeric file cap that differs from that count is invalid exception authority, never an effective ceiling. If its exact row is unchanged and its finding is unaffected, report it as `BASELINE_DEBT`; if the affected path remains over 500 lines, hard-fail it regardless of the stored cap. For example, `packages/agent-credential-provisioning/test/provisioning.test.js` measures 797 lines at d506 while its preserved row cap is 824, so the row is debt and cannot authorize this file. A nonnumeric, boolean, null, or otherwise malformed cap is invalid configuration and exits 2. An active directory exception is valid only when the path exists at the fixed baseline and has more than 20 immediate tracked children there. Its `approved_max_children` remains the exact accepted V1 value and MUST be at least the measured baseline count; V1 permits Owner-reviewed directory caps above that count, so V2 MUST preserve the accepted value and MUST NOT infer it from the reason field. Required `reason`, `approved_by`, `expires_at`, and `split_followup` fields remain mandatory. Expiry MUST be a valid `YYYY-MM-DD` calendar date later than the verifier's UTC date; no unknown or malformed expiry is accepted. `approved_by` MUST be in `REGISTRY_APPROVAL_ACTORS`.

V2 keeps `.agents/structure-registry.json` in its existing V1 format and preserves its bytes during the V2 implementation. The verifier accepts the existing `schema_version: 1` and V1 registry `rules_version` as registry-format identity; its result independently reports `rules_version = CODE_STRUCTURE_GUARDRAILS_V2`. It MUST NOT rewrite registry rows as part of verifier execution, raise caps, change the baseline, or add a persistent debt collection. An active row is valid only under the same fixed-baseline criteria and accepted actor/expiry checks above. Malformed JSON, unknown schema/rules label, duplicate paths, invalid actors or metrics, mismatched baseline, expired active entries, and unavailable refs fail closed (exit 2).

The registry is not immutable forever. Expiry renewal, generated-allowlist housekeeping, and recording a completed split may use the existing separate Owner-reviewed registry-only route; any new exception or cap requires an independently accepted Owner-authorized path and exact fixed-baseline evidence. Such a registry-only change cannot be combined with source changes that rely on it, and it cannot delete, retag, or otherwise hide an unresolved finding. V2 does not add an inline bypass or implement that separate authorization process. In the V2 candidate gate, any registry-row or allowlist delta between `--base` and `--head` fails closed (exit 2); a separately Owner-accepted registry-only change may be consumed after it is present at the exact comparison base. Treat use of that separate route as a nonblocking `FOLLOW_UP` outside the candidate gate; an exit 2 from a registry-delta candidate is configuration failure and MUST NOT be described as PASS. Invalid historic rows remain visible through computed output rather than being rewritten into a new authority schema.

## 5. Candidate-delta gate and historical debt

The verifier evaluates the exact resolved `--base` and `--head` commit OIDs under this rule and derives debt from the two trees plus the fixed eligibility baseline. It produces separate results:

```text
CANDIDATE_DELTA = PASS | FAIL
BASELINE_DEBT = <stable list of inherited unresolved findings>
RESOLVED_BASELINE_DEBT = <stable list of findings resolved by this candidate>
```

A finding is `BASELINE_DEBT` only when the same rule/path/key and measured violation exist at both comparison base and head, the corresponding V1 registry row is identical, and the finding is not on an affected surface. Fixed-baseline ineligibility, a well-formed numeric file cap that differs from the fixed-baseline measurement, and a comparison-base metric over an unchanged recorded cap are computed from the existing registry row; none makes that row an authorized exception or effective ceiling. Malformed or nonnumeric cap values remain configuration failures (exit 2). Unchanged debt may be reported without blocking an unrelated candidate increment, but is never called an exception, conformance, or repository-wide PASS. A clean candidate may exit 0 while debt remains only when output says `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT` and enumerates the debt. It MUST NOT emit an undifferentiated `PASS`.

New findings, changed findings, or inherited debt on an affected surface are candidate violations. Malformed, unknown, missing, expired-active, or authority-invalid registry data is configuration failure (exit 2), not debt. Any registry row, baseline, schema/rules label, or allowlist change between base and head fails closed in the V2 candidate gate; omission or path/kind substitution cannot hide a finding. The separate Owner-reviewed registry-only route above remains available and must not be combined with dependent source changes. No persistent debt record is written. Debt identity is deterministically derived for output from the original registry collection, exact row content, path, rule key, and measured finding; the output binds it to the exact base/head OIDs.

When a base finding no longer exists at head, emit it in `RESOLVED_BASELINE_DEBT[]` with its stable base finding key, exact `head_oid`, observed head metric/path state, and any successor path. This is computed output only and MUST NOT be written back into the registry or used as a self-referential input. A renamed path is treated as delete plus add: the old finding resolves only if its old path is gone or no longer violates the applicable rule; the new path is checked independently. Any new >500 file or over-limit directory still hard-fails.

Expired active exceptions invalidate the registry (exit 2); malformed or unknown expiry is never debt or a warning. Unknown registry versions, unavailable commits, or insufficient evidence for deterministic classification fail closed. No debt classification may be inferred from registry prose.

## 6. Affected-surface definition

Compute the affected set mechanically from exact tree and diff data, with renames disabled:

- **File surface:** every added, modified, deleted, or rename-source/rename-target in-scope path; classification or generated-allowlist changes.
- **Directory surface:** exactly each in-scope directory whose set of immediate tracked children changes between base and head. An add/delete/rename changes the child sets of its containing directories and any containing directories whose immediate child directory itself is added/removed; a content-only edit does not affect its parent directory's width finding. A nested descendant edit that leaves an ancestor's immediate-child set unchanged does not affect that ancestor.
- **Depth surface:** every added/moved/deleted in-scope file whose depth changes, plus all in-scope descendants of a `package.json` change that changes nearest module-root selection.
- **Registry/config surface:** changes to the guardrail, registry, generated allowlist, governance lock, include/exclude classification, or verifier semantics require full base/head debt-set recomputation. Any registry-row or allowlist delta within the candidate fails closed; an accepted housekeeping change may be used only when already present at the exact comparison base. No config change can silently erase or reclassify computed debt.

Any finding on an affected file, directory, or depth surface MUST pass its V1 rule in the candidate or be resolved in the same candidate. This includes a file that previously relied on a V1-invalid registry row. Touching it while it remains over 500 lines hard-fails; it must be split or reduced to the limit. Unchanged debt on unrelated surfaces is reported but does not block that candidate increment.

## 7. Anti-evasion rules retained from V1

- Packing more than three statements on an added line remains a violation; pre-existing dense lines remain informational.
- Barrel inflation remains a violation.
- Duplicating the same logic into several small files to evade review limits remains forbidden. Exact-content duplicates remain a warning signal; normalized near-duplicate detection remains a future direction and is not upgraded by V2.
- Deep-directory evasion remains blocked by joint depth and child-count limits.
- A file declaring `@generated`, `auto-generated`, `code generated`, or `do not edit` in its first lines without exact generated-allowlist membership remains a violation; allowlist edits require an accepted registry actor and separate review.
- A fixture-named file containing test-runner constructs (`node:test`, `describe`, `it`, `test`, or `assert`) remains test code; fixture hiding is a violation.
- A path move, rename, extension change, generated claim, registry rewrite, or excluded-root move MUST NOT turn an affected violation into unreported debt.

## 8. Verifier and authority lifecycle

The machine-facing interface, output schema, exit statuses, computed debt identity, and acceptance mappings are specified by `CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1`. That Spec does not define or copy thresholds; this rule does.

A V1 runner cannot claim V2 conformance. Any consumer MUST treat output carrying `rules_version = CODE_STRUCTURE_GUARDRAILS_V1` as `V1_LEGACY_UNQUALIFIED`; it is not evidence of V2 candidate readiness. A V2 runner MUST reject an unaccepted V2 authority or a V1-only output as V2 evidence. V2 implementation starts only in a new task whose base contains accepted V2 and the accepted implementation Spec. The implementation PR must use V2 logic to validate exact candidate delta against the unchanged V1-format registry; the V2 verifier and registry-preserving code change land in the same implementation PR without a registry migration. No self-acceptance or implicit activation is permitted.

V1 remains active until the successor is accepted and merged. On that same authority transaction, V1 receives a `superseded_by` backlink to V2 and is retained unchanged otherwise. Registry housekeeping cannot supersede this rule or change a frozen limit. Acceptance actors are the Owner or an explicitly authorized maintainer recorded in the acceptance PR.

## 9. Acceptance and stops

Acceptance requires an independent exact-revision review of the complete V2, its implementation Spec, lifecycle backlinks, and computed-debt/anti-evasion semantics. The implementation Spec acceptance mapping requires proof that:

- all V1 thresholds and anti-evasion checks remain in force;
- only unchanged, unrelated debt is non-blocking and it is never represented as legal or globally passing;
- invalid or modified registry data and affected debt fail closed;
- registry bytes and all valid caps remain unchanged; fixed-baseline-ineligible rows, well-formed numeric file-cap mismatches, and over-cap rows are derived as visible debt without prose inference or re-baselining;
- file, directory, depth, delete, rename, expiry, unknown-schema, and registry-mutation cases are deterministic;
- current PR573 growth in `packages/broker/test/transport.test.js` (912 -> 946) and `packages/workflow-execution/src/engine.js` (511 -> 525) remains a hard failure until decomposed or reduced.

V2 changes no source, registry, PR, runtime, service, or production state by itself. Acceptance authorizes only the Contracts in the companion implementation Spec.

## Succession coordination note (2026-11-07, recorded)

Owner rulings of 2026-11-06 (① adopt the formal V3 precise-exception revision route; ② formally accept the V3 transitional exception design and semantics, bound to the reviewed semantic version) establish that, for the EXACT registered blob-pair transition in `CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1` (path `scripts/trusted-cp-deploy-install.sh`, base blob `ef5053201e6af88b1edbcdfc33e845f872183b2b`, head blob `356899a8ec0726f245790379429f97dfc6ea3bfb`, delta limited to the scheduler-watchdog.mjs whitelist line), the V3 disposition (transitional exception; the touched installer remains recorded BASELINE_DEBT with a separate follow-up split responsibility) supersedes the V2 hard-fail disposition (`INVALID_FILE_EXCEPTION_AUTHORITY`) for that exact case. All other V2 terms — the 500-line general cap, the fixed baseline, anti-evasion checks, fail-closed on invalid registry data, and every other file/directory rule — remain in force unchanged. This note records already-given rulings; it grants no new exceptions and does not re-baseline anything.
<!-- END CARRIED_V2_POLICY -->

## 10. Exact transitional exception and acceptance

The following complete exception Contracts and acceptance section are carried
verbatim from accepted TE_V1. They preserve its original scope and debt; they
do not confer acceptance on this proposed successor.

<!-- BEGIN CARRIED_TE_CONTRACTS -->
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

<!-- END CARRIED_TE_CONTRACTS -->

## 11. Whole-supplement absorption

**CTR-CSG3-ABS-001.** Upon the later accepted whole-authority transaction, V3
absorbs the entire effective TE_V1 exception decision: the exact record,
CTR-V3TE-001 through CTR-V3TE-004, their acceptance conditions, and the existing
`DEBT-V3TE-INSTALLER-1315` responsibility. These copied labels retain provenance
to TE_V1; no new grant, implementer, debt ledger, cap or split completion is
created. The prior Owner rulings and TE_V1 acceptance history remain historical
facts in the preserved predecessor, not acceptance of this V3 proposal.

Absorption does not restart the exception. The exact tuple, `100644` modes,
whitelist-token-only insertion, 1315/1315 physical lines, single finding
exception, visible historical debt, all negative cases and separately assigned
split obligation remain unchanged. Once the new blob is the comparison base,
this exception grants no future edit. Rechecking the exact registered coordinates
remains reproducible verification, not another grant. No other file, same-size
edit, rename, alternate path, registry/cap/baseline change or unknown evidence
inherits it. A missing/proposed authority grants nothing.

This is a whole-authority consolidation of V2 plus TE_V1, not a new partial
supersession edge. The malformed former TE metadata is retained as history in
B's raw base JSON and the original Git blob. Its correction to an empty list
does not revoke or expand the already accepted exact-transition semantics.

## 12. Succession relationship and two-phase transaction

**CTR-CSG3-SUC-001 — Phase 1, this proposal.** The only intended predecessors are
`CODE_STRUCTURE_GUARDRAILS_V2` and
`CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1`, each wholly superseded
only by a later accepted V3 transaction. While V3 remains proposed, both remain
accepted with their existing bytes and without a V3 `superseded_by` backlink.
This chain's separately authorized B format correction is already complete;
C makes no additional edit to either predecessor. The V1-to-V2 historical edge
is retained and must not be redirected or rewritten by this proposal.

**CTR-CSG3-SUC-002 — Later Phase 2.** After independent review, the Owner's formal
acceptance of the exact reviewed V3 triggers the separately authorized retirement
transaction. That docs-only transaction must atomically record V3 as accepted,
retire both predecessors with reciprocal `superseded_by: CODE_STRUCTURE_GUARDRAILS_V3`
links in their actual native formats, and update the local rule pointer and any
affected current index. Acceptance must bind issuer, time, reviewed semantic
head and final-head delta review. Main must not receive an active accepted V3
with either predecessor still independently active. Existing V1 and TE history,
original semantic review bindings, raw source and debt evidence remain readable.
No Phase 2 edit, Owner acceptance or merge is performed in this PR.

No source implementation, verifier-consumer redirection or production activation
is authorized by this proposal. If later implementation is needed, start a new
REUSE task only after the relevant accepted authorities are present in its base;
retain the separate implementation Spec and its authority hierarchy. A copied
historical implementation statement is not present execution permission.

## 13. Acceptance, validation and stop boundary

Independent review must cover the complete carried policy, all four inherited
exception Contracts, both prospective predecessor relationships and the following
mapping. Exact candidate/base coordinates and executed results belong in the PR
and this chain's receipt. Owner acceptance remains separate from a test result.

| Obligation | Required evidence | Failure condition |
|---|---|---|
| V2 sections 1–9, source coordination note, normative header constants | Literal source-to-proposal comparison at pinned Git blobs; thresholds, scope, registry/fail-closed, debt and anti-evasion review | Any missing or altered effective rule, new cap, baseline or hidden debt |
| CTR-V3TE-001–004 and full original acceptance section | Literal comparison; exact tuple/modes/token/lines, visible debt, all negative cases and split responsibility | Broader grant, renewed exception, hidden debt or fictitious split closure |
| CTR-CSG3-ABS-001 | Full supplement absorption and unchanged historical acceptance/debt provenance | Partial successor, lost decision or new execution grant |
| CTR-CSG3-SUC-001 | Actual native V2 metadata plus raw TE/V3 YAML; V3 proposed and exact supersedes; predecessors unchanged and still accepted | Invented V2 governing-Spec frontmatter, early retirement or backlink |
| CTR-CSG3-SUC-002 | Proposal explicitly reserves atomic accepted-head/retirement/pointer transaction for later Owner action | Self-acceptance, present retirement, merge or product/production write |

C uses a task-specific native-local-rule validation gate, with source and
reproduction instructions preserved in the receipt. It reads V2's real fenced
metadata and raw TE/V3 YAML, checks full carry, lifecycle and pin parity, and has
negative controls for missing predecessor, changed carried rule and premature
retirement. It is not the rc.3 governing-Spec-only full-transition CLI. B alone
uses that CLI for the exact raw full-field TE correction. These distinct results
must not be relabeled as one another or as runtime/production conformance.

If a required gate fails, stop subsequent chain writes and record the actual
failure in `STOPPED-RC3-CHAIN.md`. Successful preparation ends at one unmerged PR;
it does not continue into acceptance, retirement, implementation or operation.

## 14. Validation observation — C gate R2

The native proposal gate `scripts/governance/validate_v3_succession.py` executed
at `2026-11-07T01:03:34.441598+00:00` against source tree
`2a19579ff57d8015cda9891898dbbf2945a09194`, now reachable through source commit
`4a3dce83d0af0bcd1c8467155ba86514734ec870`:

```sh
python3 scripts/governance/validate_v3_succession.py --base 230de798e340cc6c157e6b21822f0b1fda77e51e --head 2a19579ff57d8015cda9891898dbbf2945a09194
```

Actual exit code: **0**. Unmodified stdout is archived at
`docs/reports/rc3-chain-20261107/C-R2-native-result.json`, SHA-256
`2b752f69e31872e0c03920cab8f73f05e85d1db6792345aa19623ef4f3295416`.
All 24 negative controls, 8 exception-scope controls and 11 strict/legacy controls
report PASS; stderr is empty. The report binds each inspected file's Git blob
and SHA-256, native metadata provenance, and the in-memory Phase 2 simulation.

V2's base metadata comes from its real native fenced block at the fixed base;
it is not YAML and is not derived from the carried policy. The V3 carried-policy
observation is separately labeled `derived-from-carried-policy` and is never
used as V2 base metadata. R2 changes only fixture construction and reporting;
all inspection assertions and this proposal's normative text remain unchanged.

This section and the accompanying receipt/Brief updates are later factual
evidence additions, outside the validated source tree. They do not claim a
second gate execution, independent final-head review, Owner acceptance,
predecessor retirement, runtime conformance or merge readiness. Independent
review of the resulting PR head is reserved for the regulator.
