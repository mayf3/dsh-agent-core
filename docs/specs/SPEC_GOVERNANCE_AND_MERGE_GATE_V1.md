---
spec_id: SPEC_GOVERNANCE_AND_MERGE_GATE_V1
status: draft
---

# Spec Governance and Merge Gate V1

> Scope: repository development / merge governance only.
> Bootstrap note: this document defines the governance system itself and therefore is not required to reference a pre-existing governing Spec. The rule becomes enforceable only from the explicit `ENFORCEMENT_START_POINT` defined during implementation/cutover.

## 0. North Star

Agent implementation capability is no longer the scarce resource. The repository must prevent the failure mode:

```text
unfrozen problem
  → implementation starts
  → scope expands during coding
  → architecture is added opportunistically
  → a Spec is written afterward to explain or legitimize the code
```

The default development authority becomes:

```text
Spec
  → Spec Review
  → Spec Accepted
  → Spec merged to implementation base branch
  → Implementation
  → mechanical Spec Gate
  → code review + independent Spec Compliance Review
  → tests
  → merge
```

The governance control plane is GitHub + repository documents + CI + branch protection/rulesets + review policy. It MUST NOT enter Agent Core Runtime.

## 1. Frozen Boundaries

This Spec does not redesign Agent Core and authorizes no product/runtime change.

```text
RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
SCHEDULER_CHANGE = NONE
AUTH_BROKER_CHANGE = NONE
PRODUCTION_INTEGRATION_CHANGE = NONE
KERNEL_CHANGE = NONE
```

This governance applies only to repository development and merge decisions. It does not govern Agent Runtime task execution, Forum Workflow, Scheduler execution, Kernel policy, or Deployment Runtime.

No custom governance service, approval service, database, dashboard, workflow engine, merge server, or bot framework is introduced.

## 2. Governing Principle

For every non-mechanical Implementation PR opened after enforcement begins:

> **No accepted Spec already present on the PR base branch → no merge authority.**

A Spec is authority for an explicit change set or milestone, not for a commit and not forever.

Code MUST conform to the governing Spec. The existence of a Spec is necessary but not sufficient: semantic scope compliance remains a reviewer responsibility.

## 3. What Requires a Spec — G1

An Implementation PR requires a Spec when it intentionally changes any of the following:

- runtime behavior;
- architecture or component ownership/boundaries;
- public API or externally consumed contract;
- persistence schema, persistence semantics, recovery semantics, or migration behavior;
- deployment or production behavior;
- security, identity, authorization, trust, or credential semantics;
- product behavior;
- integration behavior between components/services/systems.

The PR contract MUST contain exactly one of:

```text
Spec-ID: <SPEC_ID>
```

or the narrow exception form:

```text
Spec: NONE
No-Spec-Reason: <allowed-enum>
```

For a referenced Spec, the canonical repository path is:

```text
docs/specs/<SPEC_ID>.md
```

A PR MAY reference one primary governing Spec plus explicitly named supporting Specs when a change necessarily composes previously frozen contracts. `spec-gate` evaluates the primary governing Spec; reviewers must reject attempts to use a loose collection of unrelated Specs as a substitute for a coherent governing change set.

## 4. Spec Must Precede Implementation — G2

The normal lifecycle is:

```text
Spec PR
  → review
  → accepted
  → merge to main/base

Implementation PR
  → reference that already-merged accepted Spec
```

The governing Spec MUST exist in the Implementation PR's **base branch tree**, not merely in the PR head tree or current diff.

Therefore a new Implementation PR cannot bootstrap its own authority by adding `docs/specs/<SPEC_ID>.md` in the same PR.

Future `spec-gate` MUST inspect the merge-base/base-branch revision supplied by GitHub, or fetch the base ref explicitly, and verify the Spec there. Checking only the PR working tree is insufficient and non-compliant.

### Governing Spec mutation rule

An Implementation PR MUST NOT modify its own primary governing Spec. Any such change is an automatic gate/review failure even when the Spec already exists on base.

If the Spec needs change, follow the amendment policy in §13 and merge the Spec change separately first.

## 5. Machine-Readable Spec Metadata — G3

V1 metadata is intentionally minimal:

```yaml
---
spec_id: SOME_SPEC_V1
status: draft
---
```

Required fields:

- `spec_id`: MUST exactly match the file basename and the PR `Spec-ID` reference.
- `status`: one of `draft | accepted | superseded`.

Optional only when semantically required:

```yaml
replaced_by: SOME_SPEC_V2
```

`replaced_by` is REQUIRED when `status: superseded` and SHOULD identify the accepted replacement when one exists.

V1 intentionally does **not** require `owner` or `accepted_at` metadata:

- ownership/approval is represented by GitHub review, CODEOWNERS/ruleset policy, and Git history;
- acceptance time is recoverable from Git history;
- duplicating those facts in YAML creates drift without improving the gate.

Implementation may reference only `status: accepted`.

### Status semantics

- `draft`: under design/review; cannot authorize implementation.
- `accepted`: approved design authority; may authorize one or multiple PRs within the frozen scope.
- `superseded`: historical record only; cannot authorize **new** implementation PRs after supersession is present on their base branch.

## 6. Spec Lifecycle and Spec PR Contract

```text
SPEC_DRAFT
  → SPEC_REVIEW
  → SPEC_ACCEPTED
  → SPEC_MERGED_TO_BASE
```

### Spec PR content rule

A Spec PR SHOULD be spec-only. For a new governing Spec, the normal diff is the Spec document and only directly necessary documentation references. It MUST NOT contain product/runtime implementation used to prove the Spec by fait accompli.

Spec PRs are governance artifacts and do not themselves require a prior `Spec-ID`; otherwise the system recursively requires a Spec for creating a Spec.

### Who may move `draft → accepted`

The author/Agent MUST NOT unilaterally self-accept a Spec.

V1 uses GitHub review authority rather than a new workflow system:

1. author opens a Spec PR with `status: draft`;
2. an authorized Spec Reviewer / Merge Owner reviews scope, boundaries, acceptance criteria, and unresolved decisions;
3. after approval, `status` is changed to `accepted` in that Spec PR;
4. the accepted Spec is merged to the target base branch by an authorized Merge Owner.

The same identity SHOULD NOT be the only actor performing authoring, acceptance, and merge for material Specs. The later implementation MAY use CODEOWNERS/ruleset approval requirements to enforce this separation where practical.

A human/authorized reviewer approval is authority; an Agent recommendation is evidence, not self-approval.

### Bootstrap exception for this governance Spec

This document predates its own enforcement. It follows the lifecycle by convention, but no recursive Spec reference is required. Its merge establishes the policy document; later enforcement begins only at the explicit start point in §16.

## 7. Implementation PR Contract

Keep the PR contract short.

Normal Implementation PR:

```text
Spec-ID: <SPEC_ID>

Scope implemented:
<short description>

Out-of-scope changes:
NONE | <details>

Frozen boundaries:
Runtime: NONE | <declared change authorized by Spec>
Router: NONE | <declared change authorized by Spec>
Kernel: NONE | <declared change authorized by Spec>

Tests:
<commands/evidence>
```

NO_SPEC PR:

```text
Spec: NONE
No-Spec-Reason: <allowed-enum>

Scope:
<short description>

Tests:
<if applicable>
```

The PR body is declaration/input. It is not proof. `spec-gate` validates references and exception format; reviewers validate semantics.

## 8. `spec-gate` Design — G4

This Spec defines but does not implement the future required CI check `spec-gate`.

For a normal Spec-governed PR, the machine check MUST produce at least:

```text
SPEC_REFERENCE_PRESENT = PASS / FAIL
SPEC_FILE_EXISTS = PASS / FAIL
SPEC_EXISTS_ON_BASE_BRANCH = PASS / FAIL
SPEC_STATUS_ACCEPTED = PASS / FAIL
SPEC_ID_MATCH = PASS / FAIL
GOVERNING_SPEC_UNMODIFIED_BY_IMPLEMENTATION = PASS / FAIL

SPEC_GATE = PASS / FAIL
```

Minimum logic:

1. parse the PR contract;
2. resolve `Spec-ID` to `docs/specs/<SPEC_ID>.md`;
3. read that file from the PR base branch, not only head;
4. parse front matter;
5. require exact `spec_id` match;
6. require `status: accepted` on base;
7. reject if the Implementation PR modifies the governing Spec path;
8. otherwise pass the reference gate.

For `Spec: NONE`, use the separate exception path in §10.

After implementation, `spec-gate` MUST become a Required Status Check for the protected/ruleset-governed `main` branch. Required checks MUST be tied to the intended GitHub Actions workflow/check source where GitHub configuration permits, so a similarly named external status cannot trivially impersonate the gate.

V1 merge condition:

```text
SPEC_GATE = PASS
SPEC_COMPLIANCE = PASS
TESTS = PASS
```

No self-built merge server is needed; GitHub remains the merge control plane.

## 9. Spec Compliance Review — G5

CI can prove that a syntactically valid accepted Spec exists on base. It cannot reliably prove that an arbitrary code diff stays semantically inside the frozen scope.

Therefore every Spec-governed Implementation PR requires an Independent Review result containing:

```text
SPEC_COMPLIANCE

Referenced Spec:
<SPEC_ID>

Implementation within frozen scope:
YES / NO

Out-of-spec behavior introduced:
NONE / <details>

Frozen boundaries respected:
YES / NO

SPEC_COMPLIANCE = PASS / FAIL
```

This is a Reviewer gate, not an LLM-only CI judgment.

Reviewers MUST compare the implementation against at least:

- governing scope / non-goals;
- frozen boundaries;
- behavior/contracts authorized by the Spec;
- acceptance criteria;
- any explicit prohibition or deferred work.

A reviewer MAY use an AI reviewer as analysis assistance, but the repository MUST NOT treat an unreviewed LLM semantic verdict as a complete substitute for independent review authority.

## 10. `NO_SPEC` Policy — G6

`NO_SPEC` exists only to avoid garbage Specs for genuinely mechanical changes.

Allowed enum V1:

```text
docs-only-no-semantic-change
comment-only
test-only-no-behavior-change
mechanical-maintenance
generated-update
revert
```

Definitions:

- `docs-only-no-semantic-change`: spelling, formatting, links, wording, or explanatory documentation changes that do not redefine behavior/architecture/contracts/governance authority.
- `comment-only`: code comments only, no executable or generated behavior change.
- `test-only-no-behavior-change`: correction/refactor of tests or test text that does not change production behavior or redefine expected product semantics. A test that establishes new behavior requires a Spec.
- `mechanical-maintenance`: semantics-preserving rename/move/format/lint/tooling maintenance whose behavior is intended to remain identical.
- `generated-update`: generated/lockfile-only update caused by an already-authorized mechanical dependency/tooling operation, with no independently introduced behavior or architecture decision.
- `revert`: pure reversal of a previously merged change to restore the prior repository behavior. Any redesign bundled with the revert requires a Spec.

### No self-exemption

An author/Agent cannot make `NO_SPEC` true by writing the enum.

A `NO_SPEC` PR requires an additional authorized `NO_SPEC_APPROVED` reviewer/owner decision. In implementation this SHOULD be enforced using GitHub review/ruleset/CODEOWNERS or a narrowly scoped check over an authorized approval signal; it MUST NOT rely on `No-Spec-Reason: trust-me` or arbitrary free text.

If reviewers disagree whether a change is mechanical, the safe default is `SPEC_REQUIRED`.

A `NO_SPEC` PR that changes any G1 semantic category is invalid regardless of the claimed reason.

## 11. Bug Fix Policy

A bug fix does **not** automatically require a new Spec.

Reuse the existing accepted governing Spec when all are true:

1. the bug is a failure to implement or operate behavior already authorized by that Spec;
2. the fix stays inside that Spec's frozen architecture and component boundaries;
3. the fix introduces no new public/product/security/persistence/integration semantic capability beyond that authority.

Examples that can normally reuse the governing Spec:

- wrong environment variable name;
- incorrect permission wiring already required by the Spec;
- false acceptance PASS / broken validation;
- persistence/restart bug in persistence behavior already specified;
- incorrect adapter mapping or integration detail inside an already authorized seam.

A new or amended Spec is required when the proposed fix needs authority the current Spec never granted, for example:

- new Policy Engine;
- new Runtime;
- new Service;
- new Kernel capability;
- new security model or ownership boundary;
- materially different persistence/deployment mechanism;
- new product behavior used as a workaround.

That result is:

```text
OUT_OF_SPEC_SCOPE
```

and implementation pauses until the appropriate Spec change is accepted and merged to base.

## 12. Spec Granularity

A Spec governs a coherent **change set / milestone**, not a commit.

A healthy Spec has:

- one clear problem/outcome;
- bounded behavioral/architectural authority;
- explicit non-goals/frozen boundaries;
- acceptance criteria by which the milestone can be considered complete.

One accepted Spec MAY authorize multiple Implementation PRs when they are merely staged delivery of the same frozen milestone.

A Spec MUST NOT become a permanent `MASTER_SPEC` whose wording is broad enough to authorize unrelated future changes.

### Decision rules

**Reuse existing Spec** when the proposed PR is another implementation slice, test/fix, or completion step clearly within the unchanged accepted scope.

**Amend existing Spec** when the intended authority remains the same milestone and only clarification/correction is needed without adding a new capability, boundary, architecture mechanism, or materially expanding acceptance scope.

**Supersede existing Spec** when the governing direction for the same area materially changes such that maintaining two competing authorities would be ambiguous. The old Spec becomes `superseded`; the replacement becomes the authority.

**Create new Spec** when the work is a distinct capability/milestone, crosses a frozen boundary, adds a new architecture mechanism/service/runtime/security model, or materially expands the original problem/scope.

A reviewer MUST reject a Spec whose scope cannot support a meaningful `OUT_OF_SPEC_SCOPE` judgment.

## 13. Spec Amendment Policy

Implementation discovery may reveal that the Spec is wrong or incomplete. That is expected; silent authority expansion is not.

### Clarification amendment

If the change:

- clarifies ambiguous wording;
- corrects a factual mistake;
- tightens acceptance criteria;
- records an already-implied implementation choice;
- does **not** add capability, boundary crossing, architecture mechanism, or material scope;

then open a separate **Spec amendment PR** against the base branch.

The Implementation PR MUST NOT carry this amendment. The amendment must be reviewed, accepted, and merged first. The Implementation PR then updates/rebases onto the base containing the amendment before compliance review/merge.

### Scope-expanding change

If the change adds new capability, new boundary, new architecture mechanism, new service/runtime/policy/security semantics, or materially expands acceptance scope:

- create a new Spec, or
- create a superseding Spec when it replaces the prior authority.

Do not disguise it as “clarification.”

### History is the version system

No Spec version database is required. Git commits, PR reviews, and base-branch history are the authoritative amendment record.

## 14. Anti-Bypass Rules

### B1. Code first, Spec added in the same PR

Defense: governing Spec must exist on the base branch and be accepted there. Head-only Spec fails `SPEC_EXISTS_ON_BASE_BRANCH`.

### B2. Refer to a nonexistent Spec-ID

Defense: canonical path resolution + base-branch lookup. Fail `SPEC_FILE_EXISTS` / `SPEC_EXISTS_ON_BASE_BRANCH`.

### B3. Refer to draft or superseded Spec

Defense: parse base-branch metadata; require exactly `status: accepted`.

### B4. Every PR claims `NO_SPEC`

Defense: closed enum + semantic G1 rule + additional independent `NO_SPEC_APPROVED` authority. Author declaration alone never passes the exception.

### B5. Cite one giant generic Spec for everything

Defense: Spec granularity requirement + SPEC_COMPLIANCE review. A Spec must have bounded change-set/milestone authority and permit a meaningful out-of-scope judgment; generic perpetual authority is review-invalid.

### B6. Implementation quietly edits its governing Spec

Defense: mechanical check rejects any Implementation PR modifying its referenced governing Spec. Amendment/new Spec must merge separately first.

### B7. Old implementation still cites a Spec that has since been superseded

Defense: `spec-gate` reads the **current PR base branch** at gate time. Once supersession is merged to that base, new/updated checks of the old PR fail `SPEC_STATUS_ACCEPTED` and require migration to the replacement authority or an explicit grandfather decision made before enforcement/supersession cutover.

## 15. Merge Gate Model

```text
IDEA
  ↓
SPEC_DRAFT                         Reviewer/authoring phase
  ↓
SPEC_REVIEW                        Reviewer gate
  ↓
SPEC_ACCEPTED                      Spec Reviewer / Merge Owner gate
  ↓
SPEC_MERGED_TO_BASE                GitHub merge/base fact
  ↓
IMPLEMENTATION
  ↓
SPEC_GATE                          MACHINE gate
  ↓
CODE_REVIEW                        Reviewer gate
  ↓
SPEC_COMPLIANCE                    Independent Reviewer gate
  ↓
TESTS                              MACHINE gate
  ↓
MERGE                              GitHub ruleset + Merge Owner gate
```

### Gate ownership

Machine gates:

- Spec reference/path/base/status/id validation;
- governing-Spec-unmodified validation;
- tests and other existing CI checks.

Reviewer gates:

- Spec quality and acceptance;
- `NO_SPEC` semantic eligibility;
- code review;
- `SPEC_COMPLIANCE` / out-of-spec determination.

Merge Owner gate:

- merge an accepted Spec;
- merge implementation only when all required machine + review gates are satisfied;
- resolve exceptional grandfather/cutover decisions explicitly rather than through code/runtime machinery.

## 16. Enforcement Start Point and Grandfather Policy

This policy is not retroactive.

`ENFORCEMENT_START_POINT` is the commit SHA on `main` at which the implementation of `spec-gate` + required merge policy is enabled. It MUST be recorded in the implementation/cutover change and SHOULD be encoded as a constant/configuration consumed by the gate if historical PR classification requires it.

The governance Spec merge commit itself is **not automatically** the enforcement start point because this V1 Spec explicitly does not implement CI/rulesets.

### Grandfathered work

Branches/workstreams demonstrably started before `ENFORCEMENT_START_POINT` may finish without rewriting their history solely to manufacture retrospective Specs. Known candidates include:

- Production Integration;
- Repo Hygiene;
- Open Source Docs Convergence;
- Self-Evolution Experiment.

Grandfathering applies to the pre-existing scope only. It MUST NOT become authority for new scope added after enforcement begins.

The later implementation MUST choose a mechanically or review-verifiable way to identify grandfathered PRs (for example an explicit protected label/approval plus branch/PR creation evidence). Authors cannot self-declare grandfather status.

Any new non-mechanical Implementation PR created after `ENFORCEMENT_START_POINT` follows this governance even if it touches an older subsystem.

## 17. Compatibility With Existing Development

No historical commit is rewritten and no existing implementation is required to gain a synthetic retrospective Spec merely to preserve provenance.

If a grandfathered branch later needs a material new architecture/capability decision after enforcement, that new portion follows normal Spec-first governance.

Accepted legacy architecture/decision documents MAY be migrated into `docs/specs/` by a deliberate future governance change, but V1 does not automatically treat every old document as an accepted Spec.

## 18. Implementation Plan — Not Executed in This Spec

### Phase 1 — repository conventions

- freeze Spec front-matter parser/metadata convention;
- add minimal Implementation PR + Spec PR templates;
- implement local `spec-gate` script;
- add unit/integration fixtures covering valid and bypass cases.

### Phase 2 — GitHub enforcement

- add GitHub Action exposing required check `spec-gate`;
- configure `main` branch ruleset / required status checks;
- require tests + spec-gate;
- configure review ownership for Spec acceptance / NO_SPEC exception (CODEOWNERS or ruleset/review policy where useful);
- make SPEC_COMPLIANCE an explicit required review contract rather than an opaque LLM result.

### Phase 3 — dogfood and adversarial verification

Use one real Spec → Implementation PR and verify:

- normal Spec-first path passes;
- missing Spec reference fails;
- same-PR Spec bypass fails;
- base-branch draft/superseded Spec fails;
- governing-Spec edit in implementation fails;
- invalid NO_SPEC attempt fails;
- legitimate mechanical NO_SPEC path can pass with independent approval;
- in-scope bug fix can reuse its governing Spec;
- amendment must merge before implementation continues.

No custom governance service/database/dashboard/workflow engine/bot framework is authorized.

## 19. Acceptance Criteria

Future implementation of this governance MUST demonstrate all of the following:

1. A normal code PR without a Spec reference cannot merge.
2. An Implementation PR cannot bypass the gate by adding its own new Spec.
3. Referenced Spec must already exist in the PR base branch.
4. `draft` or `superseded` Specs cannot authorize new implementation.
5. One accepted Spec can authorize multiple Implementation PRs inside the same frozen milestone scope.
6. Reviewer can explicitly return `OUT_OF_SPEC_SCOPE` / `SPEC_COMPLIANCE = FAIL`.
7. `NO_SPEC` uses a small frozen whitelist and independent approval.
8. Mechanical/doc typo changes do not require garbage Specs.
9. Bug fixes may reuse the governing Spec when the fix stays within its authority.
10. A scope-expanding Spec amendment cannot ride inside the Implementation PR; Spec authority must merge first.
11. Enforcement does not retroactively break grandfathered pre-enforcement work.
12. The entire mechanism depends only on repo/GitHub/CI/review policy and changes no Agent Core runtime.
13. An Implementation PR modifying its own governing Spec fails.
14. A superseded Spec stops authorizing PRs when the supersession is present on their current base branch.

## 20. Non-Goals

This Spec does not:

- implement `spec-gate`;
- add GitHub Actions;
- change branch protection/rulesets;
- change product/runtime code;
- require a Spec per commit;
- require a new Spec per ordinary in-scope bug;
- build an issue/workflow/approval product;
- infer semantic compliance entirely with CI or an LLM;
- retroactively rewrite repository history.

## 21. Open Questions

No unresolved governance decision blocks this V1 design.

Implementation-time choices intentionally left open because they do not alter the governance model:

- exact PR template file names/layout;
- implementation language/location of the `spec-gate` parser;
- whether the independent `NO_SPEC_APPROVED` and `SPEC_COMPLIANCE` authority is enforced with CODEOWNERS, required approving reviews, protected labels, or a minimal combination supported by GitHub rulesets;
- exact `ENFORCEMENT_START_POINT` SHA, which cannot exist until the enforcement implementation is merged/enabled.

Any implementation choice that weakens base-branch existence, accepted-status, independent exception approval, or governing-Spec immutability is not an implementation detail; it requires a Spec amendment.

## 22. Final Governance Invariant

```text
For non-mechanical development after enforcement:

accepted Spec already on base
  AND implementation does not rewrite its authority
  AND spec-gate passes
  AND independent reviewer confirms scope compliance
  AND tests pass
= eligible to merge
```

The purpose is not to make Agents write more documents. The purpose is to make **authority precede implementation**, so faster implementation cannot silently manufacture its own scope.