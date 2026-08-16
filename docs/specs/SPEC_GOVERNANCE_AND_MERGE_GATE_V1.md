---
spec_id: SPEC_GOVERNANCE_AND_MERGE_GATE_V1
status: draft
---

# Spec Governance and Merge Gate V1

> Scope: repository development / merge governance only.
>
> This document is the bootstrap governance Spec. It does not require a prior governing Spec because enforcement does not begin until the explicit `ENFORCEMENT_START_POINT` defined below.

## 0. North Star

Agent implementation capability is no longer the scarce resource. The repository must prevent this failure mode:

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

The key rule is:

> **No accepted governing Spec already present on the Implementation PR base branch → no merge authority.**

The governance control plane is GitHub + repository documents + CI + branch protection/rulesets + review policy. It MUST NOT enter Agent Core Runtime.

## 1. Reference Model: What We Adopt from DeepSeek Harness

DeepSeek Harness uses repository-persistent **Agent Notes** to retain decisions and proposals that code and ordinary docs cannot carry well: why a decision was made, which alternatives lost, and what trade-offs were accepted. Its public repository also makes non-trivial changes subject to an Agent Note rule, separates note lifecycle from note class, requires alternatives to be recorded, mechanically verifies note structure, and leaves semantic trivial/non-trivial classification to review rather than pretending CI can infer it reliably.

This Spec adopts those principles:

1. **Non-trivial decisions must have a persistent repository authority artifact.**
2. **The artifact must preserve rationale, alternatives, acceptance criteria, and risks — not only implementation inventory.**
3. **Machine gates enforce mechanically checkable promises.**
4. **Reviewers retain semantic judgment over scope and exceptions.**
5. **Existing decision ownership should be reused instead of creating duplicate Specs.**
6. **Rejected or superseded decisions should remain understandable enough to prevent repeated bad ideas.**

This Spec intentionally differs from DeepSeek Harness in one important way:

> An Agent Note is primarily engineering memory; this repository's governing Spec is also **merge authority**.

Therefore DeepSeek Harness's same-PR rule for a non-trivial change is not sufficient here. A new governing Spec MUST normally be accepted and merged to the Implementation PR's base branch **before** the implementation PR can use it.

This extra separation exists to prevent post-hoc rationalization by coding Agents.

## 2. Frozen Boundaries

This Spec does not redesign Agent Core and authorizes no product/runtime change.

```text
RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
SCHEDULER_CHANGE = NONE
AUTH_BROKER_CHANGE = NONE
PRODUCTION_INTEGRATION_CHANGE = NONE
KERNEL_CHANGE = NONE
```

This governance applies only to repository development and merge decisions. It does not govern:

- Agent Runtime task execution;
- Forum Workflow;
- Scheduler execution;
- Kernel policy;
- Deployment Runtime;
- business approvals or product workflows.

No custom governance service, approval service, database, dashboard, workflow engine, merge server, or bot framework is introduced.

GitHub is the control plane.

## 3. Governing Principle

A Spec is authority for a coherent **change set / milestone**, not for a commit and not forever.

For every non-mechanical Implementation PR opened after enforcement begins, the PR MUST contain exactly one of:

```text
Spec-ID: <SPEC_ID>
```

or the narrow exception form:

```text
Spec: NONE
No-Spec-Reason: <allowed-enum>
```

For a referenced Spec, the canonical path is:

```text
docs/specs/<SPEC_ID>.md
```

The existence of a Spec is necessary but not sufficient. The implementation must also stay inside its frozen scope.

## 4. What Requires a Spec — G1

A change is non-trivial and requires a governing Spec when it intentionally changes any of the following:

- runtime behavior;
- architecture or component ownership/boundaries;
- public API or externally consumed contract;
- persistence schema, persistence semantics, recovery semantics, or migration behavior;
- deployment or production behavior;
- security, identity, authorization, trust, or credential semantics;
- product behavior;
- integration behavior between components/services/systems;
- repository process/tooling policy whose semantics maintainers may later revisit;
- testing strategy or acceptance semantics, rather than only test wording/mechanics.

This follows the DeepSeek Harness principle that non-trivial changes are decisions maintainers may reasonably revisit.

### Semantic classification belongs to review

CI MUST NOT attempt to fully infer from an arbitrary diff whether the change is trivial or non-trivial.

The author/Agent declares the path (`Spec-ID` or `Spec: NONE`), the machine verifies that declaration mechanically, and reviewers verify whether the declaration is semantically truthful.

When classification is disputed, the safe default is:

```text
SPEC_REQUIRED
```

## 5. Spec Must Precede Implementation — G2

Normal lifecycle:

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

Future `spec-gate` MUST inspect the base-branch revision supplied by GitHub, or fetch the base ref explicitly. Checking only the PR working tree is non-compliant.

### Governing Spec mutation rule

An Implementation PR MUST NOT modify its own primary governing Spec.

If the Spec needs change, use the amendment policy in §15 and merge the Spec change separately first.

This is intentionally stricter than DeepSeek Harness's practice of updating an implemented Agent Note alongside factual code movement. In this repository, a governing Spec is normative authority; an Implementation PR may not rewrite its own authority while exercising it.

## 6. Spec Metadata and Lifecycle — G3

V1 metadata is intentionally minimal:

```yaml
---
spec_id: SOME_SPEC_V1
status: draft
---
```

Required fields:

- `spec_id`: MUST exactly match the file basename and the PR `Spec-ID` reference.
- `status`: one of `draft | accepted | rejected | superseded`.

Optional only when semantically required:

```yaml
replaced_by: SOME_SPEC_V2
```

`replaced_by` is REQUIRED when `status: superseded` and an accepted replacement exists.

V1 intentionally does **not** require `owner`, `accepted_at`, class, implementation state, or version-database metadata:

- ownership/approval is represented by GitHub review and repository policy;
- acceptance time is recoverable from Git history;
- git history is the version record;
- implementation progress belongs to PRs/code/tests, not Spec authority state;
- a class taxonomy can be added later only if actual repository volume justifies it.

### Status semantics

- `draft`: under design/review; cannot authorize implementation.
- `accepted`: approved design authority; may authorize one or multiple PRs within frozen scope.
- `rejected`: considered and declined; cannot authorize implementation. Keep only when the rationale helps prevent a meaningful repeat mistake.
- `superseded`: historical authority replaced by another decision; cannot authorize new implementation.

Implementation may reference only:

```text
status: accepted
```

### Why there is no `implemented` status

DeepSeek Harness Agent Notes distinguish `proposed` and `implemented` because the note also describes shipped reality.

This repository deliberately separates two concepts:

```text
Spec status          = authority state
Implementation state = PR/code/test state
```

An accepted Spec remains accepted after the first implementation lands so it can continue to authorize staged delivery and in-scope bug fixes. It becomes superseded only when its governing decision is replaced.

## 7. Required Spec Content

Like DeepSeek Harness Agent Notes, Specs must preserve the parts code cannot reliably explain: problem, rationale, alternatives, and trade-offs.

Every active Spec MUST contain these canonical sections.

### Draft Spec

```markdown
## Problem
## Proposal
## Scope
## Non-Goals and Frozen Boundaries
## Alternatives considered
## Acceptance Criteria
## Risks
```

### Accepted Spec

Before merge as accepted, the authoritative content SHOULD read as a frozen decision:

```markdown
## Problem
## Decision
## Scope
## Non-Goals and Frozen Boundaries
## Alternatives considered
## Acceptance Criteria
## Risks and Trade-offs
```

A Spec may add bespoke technical sections for APIs, persistence, security, rollout, compatibility, or evidence where needed.

### `Alternatives considered` is mandatory

Every material Spec MUST state real alternatives considered and why they lost.

Do not invent fake alternatives to satisfy the format. The purpose is to prevent future Agents from repeatedly re-litigating a tempting design without the original context.

### Rejected Specs

A rejected Spec keeps enough of its proposal and alternatives to explain why it was declined and MUST contain a clear rejection reason in the body.

Rejected Specs are historical knowledge only, never merge authority.

## 8. Spec Lifecycle and Spec PR Contract

```text
SPEC_DRAFT
  → SPEC_REVIEW
  → SPEC_ACCEPTED
  → SPEC_MERGED_TO_BASE
```

Alternative terminal path:

```text
SPEC_DRAFT
  → SPEC_REVIEW
  → SPEC_REJECTED
```

Replacement path:

```text
OLD_SPEC_ACCEPTED
  → SUPERSEDING_SPEC_REVIEW
  → NEW_SPEC_ACCEPTED
  → OLD_SPEC_SUPERSEDED
  → SPEC_PR_MERGED_TO_BASE
```

### Spec PR content rule

A new governing Spec PR SHOULD be spec-only. It MUST NOT contain product/runtime implementation used to prove the Spec by fait accompli.

Spec PRs do not themselves require a prior `Spec-ID`; otherwise the system recursively requires a Spec for creating a Spec.

### Who may move `draft → accepted`

The author/Agent MUST NOT unilaterally self-accept a material Spec.

V1 uses GitHub review authority:

1. author opens a Spec PR with `status: draft`;
2. an authorized Spec Reviewer / Merge Owner reviews the problem, scope, alternatives, boundaries, acceptance criteria, and unresolved decisions;
3. after approval, the Spec PR changes `status` to `accepted`;
4. an authorized Merge Owner merges the accepted Spec to the target base branch.

The same identity SHOULD NOT be the only actor performing authoring, acceptance, and merge for material Specs.

An Agent review can provide evidence and criticism, but it does not by itself constitute repository acceptance authority unless repository governance later explicitly assigns that authority.

### Bootstrap exception

This governance Spec predates its own enforcement and therefore requires no recursive governing Spec. Enforcement starts only at §18.

## 9. Implementation PR Contract

Keep the contract short.

Normal Implementation PR:

```text
Spec-ID: <SPEC_ID>

Scope implemented:
<short description>

Out-of-scope changes:
NONE | <details>

Frozen boundaries:
Runtime: NONE | <change explicitly authorized by Spec>
Router: NONE | <change explicitly authorized by Spec>
Kernel: NONE | <change explicitly authorized by Spec>

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

The PR body is declaration/input, not proof.

## 10. `spec-gate` Design — G4

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
3. read that file from the PR base branch;
4. parse front matter;
5. require exact `spec_id` match;
6. require `status: accepted` on base;
7. reject if the Implementation PR modifies the governing Spec path;
8. otherwise pass the reference gate.

For `Spec: NONE`, use the separate exception path in §12.

After implementation, `spec-gate` becomes a Required Status Check for `main` through GitHub branch protection/ruleset.

V1 merge condition:

```text
SPEC_GATE = PASS
SPEC_COMPLIANCE = PASS
TESTS = PASS
```

No self-built merge server is needed.

### Mechanical gates over prose promises

Following the DeepSeek Harness quality-gate principle, every governance promise that can be checked deterministically SHOULD eventually be enforced by a command that exits non-zero and runs in CI.

Examples:

- canonical path exists;
- front matter parses;
- `spec_id` matches filename/reference;
- status is accepted;
- Spec exists on base;
- Implementation did not mutate governing Spec;
- `NO_SPEC` enum is valid.

Semantic questions remain review work.

## 11. Spec Compliance Review — G5

CI can prove that a syntactically valid accepted Spec exists on base. It cannot reliably prove that arbitrary code stays semantically inside the frozen scope.

Every Spec-governed Implementation PR therefore requires an Independent Review result:

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

Reviewer MUST compare implementation against at least:

- Problem/Decision;
- Scope;
- Non-Goals and Frozen Boundaries;
- Acceptance Criteria;
- explicit prohibitions/deferred work;
- architecture/security/persistence/integration constraints named by the Spec.

AI review may assist analysis, but an unreviewed LLM semantic verdict is not a complete substitute for independent review authority.

## 12. `NO_SPEC` Policy — G6

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

- `docs-only-no-semantic-change`: spelling, formatting, links, or explanatory wording that does not redefine behavior, architecture, contracts, governance authority, or acceptance semantics.
- `comment-only`: comments only, no executable/generated behavior or contract change.
- `test-only-no-behavior-change`: correction/refactor of tests or test text that does not establish new production/product semantics. A test that defines new expected behavior requires a Spec.
- `mechanical-maintenance`: semantics-preserving rename/move/format/lint maintenance with no new policy, architecture, runtime, or product decision.
- `generated-update`: generated/lockfile-only update caused by an already-authorized mechanical operation, with no independently introduced behavior or architecture decision.
- `revert`: pure reversal of a previously merged change to restore prior repository behavior. Any redesign bundled with the revert requires a Spec.

### No self-exemption

An author/Agent cannot make `NO_SPEC` true by writing the enum.

A `NO_SPEC` PR requires additional authorized reviewer/owner approval:

```text
NO_SPEC_APPROVED = YES
```

Implementation SHOULD use GitHub review/ruleset/CODEOWNERS or another minimal repository-native approval mechanism. It MUST NOT rely on arbitrary free text such as:

```text
No-Spec-Reason: trust-me
```

A `NO_SPEC` PR that changes any G1 semantic category is invalid regardless of the claimed enum.

### No automatic diff classifier

In line with DeepSeek Harness's public policy, V1 does not build an LLM/heuristic CI classifier that attempts to decide whether every diff is trivial.

The author declares; reviewer judges; CI validates the declared path.

## 13. Bug Fix Policy

A bug fix does **not** automatically require a new Spec.

Reuse an accepted governing Spec when all are true:

1. the bug is a failure to implement or operate behavior already authorized by that Spec;
2. the fix stays inside that Spec's frozen architecture and component boundaries;
3. the fix introduces no new public/product/security/persistence/integration capability beyond that authority.

Examples that normally reuse the governing Spec:

- wrong environment variable name;
- incorrect permission wiring already required by the Spec;
- false acceptance PASS / broken validation;
- persistence/restart bug in behavior already specified;
- incorrect adapter mapping inside an already authorized seam.

A new or amended Spec is required when the fix needs authority the current Spec never granted, for example:

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

Implementation must not continue under the old authority until the appropriate Spec change is accepted and merged to base.

## 14. Spec Granularity and Decision Ownership

A healthy Spec has:

- one clear problem/outcome;
- bounded behavioral/architectural authority;
- explicit non-goals/frozen boundaries;
- real alternatives considered;
- acceptance criteria by which the milestone can be considered complete.

One accepted Spec MAY authorize multiple Implementation PRs when they are staged delivery of the same frozen milestone.

A Spec MUST NOT become a permanent `MASTER_SPEC` whose wording is broad enough to authorize unrelated future changes.

### Reuse existing Spec

Reuse when the proposed PR is another implementation slice, in-scope bug fix, test/fix, acceptance correction, or completion step inside the unchanged accepted decision.

This follows the DeepSeek Harness ownership principle: update/reuse the artifact that already owns the decision instead of creating a duplicate.

### Amend existing Spec

Amend when the same milestone remains authoritative and only clarification/correction is needed without a new capability, boundary, architecture mechanism, or material scope expansion.

### Supersede existing Spec

Supersede when the governing direction materially changes such that two competing authorities would be ambiguous.

### Create new Spec

Create a new Spec when the work:

- is a distinct capability/milestone;
- crosses a frozen boundary;
- introduces a new architecture mechanism/service/runtime/security model;
- materially expands the original problem or acceptance scope.

A reviewer MUST reject a Spec whose scope is so broad that a meaningful `OUT_OF_SPEC_SCOPE` judgment is impossible.

## 15. Spec Amendment Policy

Implementation discovery may reveal that the Spec is wrong or incomplete. That is expected; silent authority expansion is not.

### Clarification amendment

If the change only:

- clarifies ambiguous wording;
- corrects a factual mistake;
- tightens acceptance criteria;
- records an implementation choice already implied by the accepted authority;
- does not add capability, boundary crossing, architecture mechanism, security semantics, or material scope;

then open a separate **Spec amendment PR**.

The Implementation PR MUST NOT carry this amendment.

The amendment must be reviewed and merged first. The Implementation PR then rebases/updates onto a base containing the amendment before compliance review/merge.

### Scope-expanding change

If the change adds a new capability, boundary, architecture mechanism, service/runtime/policy/security semantic, or materially expands acceptance scope:

- create a new Spec; or
- create a superseding Spec when it replaces the prior authority.

Do not disguise scope expansion as clarification.

### Superseding PR

A spec-only superseding PR MAY atomically:

1. add the new accepted Spec;
2. mark the old Spec `superseded`;
3. set `replaced_by` on the old Spec;
4. cross-reference rationale where useful.

After that PR merges, new implementation must use the new authority.

### Git history is the version system

No Spec version database is required. Git commits, PR reviews, and base-branch history are the amendment record.

## 16. Anti-Bypass Audit

### B1. Code first, Spec added in the same PR

Defense: governing Spec must exist on the base branch and be accepted there. Head-only Spec fails `SPEC_EXISTS_ON_BASE_BRANCH`.

### B2. Refer to a nonexistent Spec-ID

Defense: canonical path resolution + base-branch lookup.

### B3. Refer to draft, rejected, or superseded Spec

Defense: parse base-branch metadata; require exactly `status: accepted`.

### B4. Every PR claims `NO_SPEC`

Defense: closed enum + G1 semantic rule + independent `NO_SPEC_APPROVED`. Author declaration alone never passes the exception.

### B5. Cite one giant generic Spec for everything

Defense: granularity requirement + SPEC_COMPLIANCE review. A Spec must permit a meaningful out-of-scope judgment.

### B6. Implementation quietly edits its governing Spec

Defense: mechanical gate rejects any Implementation PR modifying its referenced governing Spec. Amendment/new Spec must merge separately first.

### B7. Old implementation still cites a Spec that has since been superseded

Defense: `spec-gate` reads the current PR base branch at gate time. Once supersession is merged to base, the old Spec no longer has `status: accepted`; the PR must move to current authority or close.

### B8. Create duplicate Specs for every small follow-up

Defense: decision ownership rule. If an accepted Spec already owns the decision and scope is unchanged, reuse it instead of manufacturing a new Spec.

### B9. Fill Specs with implementation inventory but no rationale

Defense: mandatory Problem, Alternatives considered, Acceptance Criteria, and Risks/Trade-offs sections. A mechanically present file without a reviewable decision is not acceptable authority.

### B10. Let an Agent approve its own governance artifact

Defense: material Spec acceptance and `NO_SPEC` exemptions require independent repository authority; Agent recommendation is not self-approval.

## 17. Merge Gate Model

Final state machine:

```text
IDEA
  ↓
SPEC_DRAFT
  ↓
SPEC_REVIEW
  ↓
SPEC_ACCEPTED
  ↓
SPEC_MERGED_TO_BASE
  ↓
IMPLEMENTATION
  ↓
SPEC_GATE
  ↓
CODE_REVIEW
  ↓
SPEC_COMPLIANCE
  ↓
TESTS
  ↓
MERGE
```

### Machine gates

- Spec reference syntax/path;
- base-branch existence;
- metadata/status/id match;
- governing Spec not modified by implementation;
- valid `NO_SPEC` enum;
- ordinary test/type/lint/build checks.

### Reviewer gates

- trivial vs non-trivial classification;
- Spec quality and boundedness;
- alternatives/risk adequacy;
- semantic scope compliance;
- `NO_SPEC` legitimacy;
- `OUT_OF_SPEC_SCOPE` judgment.

### Merge Owner gates

- material Spec acceptance/merge authority;
- required approval policy satisfied;
- required status checks green;
- final merge to protected `main`.

## 18. Historical Compatibility and Enforcement Start

This policy is not retroactive.

Existing Git history does not need backfilled Specs.

Known work already in progress before governance enforcement may be grandfathered for its **already-declared scope**, including:

- Production Integration;
- Repo Hygiene;
- Open Source Docs Convergence;
- Self-Evolution Experiment.

Grandfathering does not authorize scope expansion after enforcement. A grandfathered branch that adds a new semantic capability/boundary after the start point requires a Spec for that new authority.

### `ENFORCEMENT_START_POINT`

This Spec commit is **not** automatically the enforcement start point.

Enforcement begins only when Phase 2 lands on `main` with:

1. working `spec-gate` CI;
2. required status check / ruleset protecting `main`;
3. the selected Spec/NO_SPEC review authority configured;
4. an explicit activation commit SHA recorded as:

```text
ENFORCEMENT_START_POINT = <main commit SHA>
```

Implementation PRs created after that point MUST comply.

Branches created before that point may use grandfathering only for their pre-existing scope.

## 19. Implementation Plan

This Spec does not implement the gate.

### Phase 1 — repository contract

- Spec metadata convention;
- required Spec content skeleton;
- Implementation PR template;
- Spec PR template;
- `spec-gate` script;
- tests for `spec-gate`.

### Phase 2 — GitHub enforcement

- GitHub Action invoking `spec-gate`;
- `main` required status check / ruleset;
- minimal Spec acceptance authority;
- minimal NO_SPEC approval authority;
- record `ENFORCEMENT_START_POINT`.

### Phase 3 — dogfood

Use one real Spec → Implementation path and verify:

- normal accepted-Spec path;
- missing Spec rejection;
- same-PR Spec bypass rejection;
- draft/rejected/superseded rejection;
- governing-Spec mutation rejection;
- NO_SPEC legitimate path;
- NO_SPEC abuse rejection;
- amendment path;
- supersession path.

Do not build:

- custom governance service;
- database;
- dashboard;
- workflow engine;
- bot framework;
- runtime approval mechanism.

## 20. Acceptance Criteria

Future implementation of this governance MUST satisfy all of the following:

1. A normal non-trivial code PR with no Spec reference cannot merge.
2. An Implementation PR cannot introduce its own first governing Spec and pass the gate.
3. Referenced Spec must already exist on the PR base branch.
4. Draft, rejected, and superseded Specs cannot authorize new implementation.
5. An accepted Spec may authorize multiple same-scope Implementation PRs.
6. Reviewer can explicitly return `OUT_OF_SPEC_SCOPE` / `SPEC_COMPLIANCE = FAIL`.
7. `NO_SPEC` uses a frozen small whitelist plus independent approval.
8. Mechanical/docs typo work does not require garbage Specs.
9. In-scope bug fixes may reuse their governing Spec.
10. Spec amendment cannot silently expand scope inside an Implementation PR.
11. Rejected/superseded decisions preserve enough rationale to avoid repeated re-litigation.
12. Specs record real alternatives and trade-offs, not only implementation inventories.
13. Existing in-flight work is not retroactively broken.
14. Machine gates enforce deterministic promises; semantic classification remains reviewer-owned.
15. The entire mechanism depends only on repo/GitHub/CI/review policy.
16. Agent Core Runtime, Router, Scheduler, Auth/Broker, Production Integration, and Kernel remain unchanged by this Spec.

## 21. Risks and Trade-offs

### More ceremony before code

For substantial changes this is intentional. Agent coding speed makes premature implementation cheaper, so governance must make problem/scope freezing comparatively stronger.

Mitigation: reuse accepted Specs across staged PRs and in-scope bug fixes; keep `NO_SPEC` narrow for mechanical work.

### Spec drift from reality

A Spec can become stale if treated as documentation inventory.

Mitigation: Specs define authority and acceptance, not every current path or implementation detail. Operational/current-state docs may evolve separately; semantic authority changes require amendment/supersession.

### Over-broad Specs become permanent escape hatches

Mitigation: bounded milestone granularity + mandatory alternatives/non-goals + compliance review.

### `NO_SPEC` becomes the easy path

Mitigation: closed enum + independent approval + reviewer-owned semantic classification.

### Review becomes performative

Mitigation: Spec review asks concrete questions: What problem? What authority? What is explicitly not authorized? What alternatives lost? What observable state means done?

### Too much process copied from DeepSeek Harness

This Spec intentionally does not copy its full note taxonomy, bilingual pairing, archive machinery, or lifecycle tree. Those solve repository-scale knowledge-management needs that are not yet demonstrated here.

Adopt the principles; do not cargo-cult the machinery.

## 22. Alternatives considered

**Keep the current informal pattern: write a plan/brief and rely on reviewer discipline.** Rejected because coding Agents can implement quickly enough that post-hoc scope expansion becomes normal, and prose rules without merge authority are easy to bypass.

**Copy DeepSeek Harness Agent Notes exactly, including allowing the first governing note in the same implementation PR.** Rejected because Agent Notes are primarily decision memory, while this repository needs an authorization boundary. Same-PR creation does not prevent a coding Agent from writing the decision after the implementation exists.

**Require a brand-new Spec for every PR or bug.** Rejected because it creates duplicate, low-information Specs and destroys decision ownership. Existing accepted authority should be reused when scope is unchanged.

**Let CI/LLM classify every diff as trivial/non-trivial and in/out of scope.** Rejected because semantic classification is not reliably mechanical. CI should fail closed on deterministic contract violations; reviewers own semantic judgment.

**Create a custom governance/approval service.** Rejected because GitHub already provides PR review, Actions, status checks, branch protection/rulesets, CODEOWNERS, and repository history. A new service would duplicate the control plane and risk leaking governance into Agent Core.

**Use one permanent MASTER_SPEC for the whole architecture.** Rejected because it cannot provide meaningful per-change authority or `OUT_OF_SPEC_SCOPE` judgment.

**Add a full DeepSeek-style lifecycle/class/archive taxonomy now.** Rejected for V1 because it adds machinery before repository volume demonstrates the need. Minimal authority states plus Git history are sufficient.

## 23. Final Frozen Result

```text
GOVERNANCE_MODEL = SPEC_AS_MERGE_AUTHORITY

SPEC_AUTHORITY_RULE =
accepted Spec already exists on Implementation PR base branch

SPEC_STATUS =
draft | accepted | rejected | superseded

IMPLEMENTATION_MERGE_CONDITION =
SPEC_GATE = PASS
SPEC_COMPLIANCE = PASS
TESTS = PASS

SEMANTIC_CLASSIFICATION_OWNER = REVIEWER
MECHANICAL_CONTRACT_OWNER = CI
MERGE_CONTROL_PLANE = GITHUB

RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
SCHEDULER_CHANGE = NONE
AUTH_BROKER_CHANGE = NONE
PRODUCTION_INTEGRATION_CHANGE = NONE
KERNEL_CHANGE = NONE
```
