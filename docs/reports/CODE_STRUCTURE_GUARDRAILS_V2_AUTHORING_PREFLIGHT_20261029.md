# DEVELOPMENT_PREFLIGHT — Code Structure Guardrails V2 authority authoring

```text
TARGET_REPOSITORY = mayf3/dsh-agent-core
ISOLATED_WORKTREE = /Users/yanfenma/.codex/worktrees/native-tool-policy-spec/gcr-current-reference
ISOLATED_REF = codex/structure-guardrails-v2
PARENT_HEAD = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
REVIEW_TARGET_HEAD = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
BASE_HEAD = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
CURRENT_BASE_HEAD = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
GOAL_OR_TARGET = Supersede the local CODE_STRUCTURE_GUARDRAILS_V1 with an accepted V2 contract that separates candidate-delta readiness from explicit historical debt without authorizing new structural debt.
CURRENT_GAP = The fixed-baseline verifier repair exposes registry rows that are not eligible at V1's pinned d506 baseline. V1 does not define a safe, machine-readable BASELINE_DEBT disposition or affected-surface scope. V2 will preserve the V1 registry bytes and derive visible BASELINE_DEBT and resolved-debt output from exact base/head trees plus the fixed baseline, without a persistent debt ledger or schema migration. Independent tree counts show this includes three file entries and three directory entries. The present PR573 candidate also has independently identified new growth in transport.test.js (912 -> 946) and workflow-execution/src/engine.js (511 -> 525); both remain hard failures requiring source decomposition outside this docs-only task.
OBSERVATIONS = Accepted local authority .agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md pins d506f81105e8aa05177a01b817ebe11dcc076ba5 and requires whole-version supersession for frozen semantics. At d506, registry directories packages/agent-router/test, packages/production-runtime/test, and packages/feishu-connector/test have respectively 12, 8, and 17 immediate tracked children; at main they have 24, 35, and 21, so they are later-baseline debt. scripts/ has 38 at d506 (eligible) but 66 at main against its existing cap 40 (over-cap debt); content-only edits do not change this directory's immediate-child set. Local authority inventory: .agents/local/README.md §Code structure rules. Independent fixed-baseline review is in /Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/structure-guard-fixed-baseline-20261029/guard-maintenance-review.md. Design comparison and independent line-count evidence are in /Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/structure-v2-design-20261029/analysis.md. Parent task provides PR573 growth coordinates above; V2 must not waive them.
WORKING_GUESS = NONE
AUTHORITY_ACTION = SUPERSEDE
PRIMARY_AUTHORITY = .agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md (accepted repository-local binding rule; successor must preserve all existing thresholds and controls except the explicitly defined historical-debt and candidate-delta decision semantics)
RELATED_AUTHORITY = .agents/local/README.md; .agents/README.md; docs/specs/README.md; docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
SPEC_GAP_DEPENDENCY = LOAD_BEARING (new verifier contracts and a whole successor rule are required; implementation remains forbidden until both authorities are accepted and merged into the authority base)
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MUTATION_SCOPE = docs-only authority authoring: DEVELOPMENT_PREFLIGHT, whole CODE_STRUCTURE_GUARDRAILS_V2, short implementation-authorizing verifier Spec, V1 supersession backlink, local README pointer, and short implementation plan
FORBIDDEN_SCOPE = scripts, source/tests, .agents/structure-registry.json, PR metadata, runtime, services, production, acceptance, merge
EVIDENCE_NEEDED = Exact-head review of the V2 contract and Spec; verify frontmatter/lifecycle/backlinks, preserved V1 thresholds, byte-preserving fail-closed registry validation and computed-debt semantics, affected-surface and anti-evasion definitions, and an implementation plan with tests proving unchanged historical debt cannot admit new or affected violations.
DONE_WHEN = Docs-only authority proposal and implementation plan are committed on the isolated branch, all files remain PROPOSED, and no implementation, acceptance, merge, registry edit, or external mutation occurs.
EXPANSION_TRIGGER = If implementing the debt model would require changing thresholds, accepting a new baseline, trusting free text, or authorizing any currently failing PR573 source growth, stop and retain those as blockers for separate closure.
NEXT_ACTION = AUTHOR_DOCS_ONLY
```

## Boundary

This preflight authorizes proposal drafting only. The V2 rule and implementation Spec remain proposed until accepted by the repository Owner and merged into the relevant authority base. No verifier/code implementation or PR573 merge may rely on them before that boundary. The separately reported `transport.test.js` and `workflow-execution/src/engine.js` growth remains subject to V1 and must be split or otherwise resolved under its existing rule; V2 will not grandfather or authorize that growth.
