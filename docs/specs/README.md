# Governing Specs

Governing Specs live at stable paths:

```text
docs/specs/<SPEC_ID>.md
```

Syntax and lifecycle are governed by:

```text
.agents/protocol/SPEC_FORMAT_V0.md
.agents/protocol/SPEC_GOVERNANCE_V0.md
```

Lifecycle:

```text
proposed | accepted | superseded
```

Implementation progress, verification coverage, runtime state, and conformance are separate dimensions and are not written into Spec lifecycle.

Before non-mechanical implementation:

```text
status in implementation base = accepted
implementation_authority = contracts
requested work within active Contract scope = yes
```

This index is a navigation aid, not a second authority. File frontmatter and explicit supersession links are authoritative. Existing historical Specs are not bulk-rewritten or bulk-indexed during the pilot adoption.

## Governance transition

| Spec ID | Status in this branch | Kind | Scope | Supersedes on acceptance |
|---|---|---|---|---|
| `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` | accepted / current governance | invariant / governance adoption | `mayf3/dsh-agent-core` | `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` |
| `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` | superseded | legacy governance | repository knowledge model | — |

Other existing Specs remain at their stable filenames and keep their current lifecycle until explicitly reviewed.

## Agent primary Workspace authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3` | accepted / current | contracts | exact 86-Agent historical OpenClaw Workspace in-place reuse authority; implementation only via bounded Contracts + PR #47 frozen plan + independent production approval |
| `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2` | superseded | none | historical curated-import authority replaced whole by V3 |
| `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` | superseded | historical legacy field | historical adopt-in-place / zero-copy authority replaced whole by V2 |

The V3 acceptance transaction is lifecycle-only relative to reviewed head
`401962beccdebb94e0f1ddc062b3d3f7efb49b0a` (reviewed base
`622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1`; 复用 审计 = PASS); it performs no
Workspace migration or production change, and `production_apply_authority` stays
`none`. PR #47's separate revision and Auth blocker work remains downstream.

## AgentProcess lifecycle authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` | accepted / current | contracts | current AgentProcess lifecycle authority |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` | superseded | none | historical replaced authority |

`accepted / current` plus `implementation_authority: contracts` means bounded Contracts may authorize a later implementation only after its exact-base preflight and compliance gates pass. It does **not** mean implementation is complete, production is deployed, or an implementation PR has automatic merge authority.

## agt_cto-agent model-route authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` | proposed | none | whole-authority replacement (authoring round 2026-08-25, branch `docs/agt-cto-ordered-route-chain-v1`) of the PR #60 accepted candidate: ordered configurable route chain — `agent-model-overrides.json` version 2 (`routeCatalog` + `overrides.<agentId>.model.primary` + `.fallbacks[]` ordered; `fallbacks=[]` = strict); ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN; per-hop gate = proven-no-admission closed four-class allowlist; STOP_CHAIN closed forbidden set (outcome_unknown family); ONE_LOGICAL_TURN; turn-start immutable snapshot + turn-local fallback; loud per-attempt journal; initial target config = `zai/glm-5.3` primary + `openai-codex/gpt-5.6-luna` (`dsh-codex@0.2.3`) sole fallback; MAX_CONFIGURED_ROUTES = explicit hard bound ≠ 2 (Owner decision Q-1, proposed 4); harness `0.1.0-rc.8 @ 514ab7b` pin carried forward |
| `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` | accepted (PR #60 branch only — never in main; MUST NOT merge) | none | superseded-pending replacement authority: accepted 2026-08-24 on the unmerged PR #60 branch (not active authority per SPEC_GOVERNANCE_V0 §8.2); its single-fallback normative meaning (MAX_FALLBACK_ROUTE_ATTEMPTS = 1) conflicts with Owner ruling 2026-08-25 and is superseded-before-main by `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` per that spec §3.3/§3.4; body byte-unchanged pending the atomic acceptance transaction |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` | superseded | none | historical single-route Luna authority (incl. Amendment 1/2), replaced whole by `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` on 2026-08-24 |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` | accepted / current | — | separate accepted seam authority (providerEnv four-key allowlist); baseline/dependency metadata repointed to `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` on 2026-08-24, normative body byte-unchanged; will repoint (metadata-only) to `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` at that spec's acceptance transaction |

The candidate acceptance transaction is lifecycle-only relative to reviewed head
`1af5f1be134a52ec2dd0fa953ca0f07f050bcdd3` (回退 审计 round 1 = PASS; 回退 聚焦复审 =
PASS; BLOCKER_COUNT = 0; sync-merge `fd58e4b` byte-neutral to the spec blob). It
performs no implementation, credential, production, or deployment change;
`implementation_authority` stays `none` until the PR reaches main and the
implementation round's own gates (Q-2 controlled zai verification; CTR-008 Luna
readiness) pass in separate rounds.

Owner ruling 2026-08-25 supersedes the single-fallback direction before PR #60
reaches main: PR #60 MUST NOT merge (its lineage advances only through the
`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` replacement PR, where the candidate is
already superseded at merge time — it never becomes main's current authority).
