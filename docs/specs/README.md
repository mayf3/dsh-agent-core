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
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1` | proposed（Draft PR；awaiting independent review） | bounded-credential-ops (gated: effective only once this Spec is accepted AND in main AND parent Amendment 1 / Builtin Route Kind PR #77 is accepted AND in main; proposed stage grants nothing) | the independently dispatched credential authority the parent deferred as Q-3 and the IMPL child excluded ("Credential / provisioning / OAuth：零授权……仍需独立轮次"): for agt_cto-agent's production Home only, authorizes GLM zai/glm-5.3 settings declaration + Owner-delivered ZAI_API_KEY (0600/uid502) + controlled initialize/no-tool canary, and Luna dsh-codex@0.2.3 exact install + bundles registration + Owner-personal interactive OAuth (fresh .openai-codex-auth.json, no copies of old OpenClaw/old-root/~/.codex) + canary; authorizes no overrides write, no route activation, no launchd/Scheduler/Binding/Definition change, no secret output, no deployment; records production-harness-no-.git identity and home-0700/spawn conflicts as activation blockers without fixing them |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1` | accepted（PR #74；active authority on merge into main） | contracts (effective once present in an implementation base that includes Scheduler V2) | minimal implementation-authorizing child authority under `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1`: grants bounded implementation of v2 loader + unified three-entrance route-attempt seam + per-hop gate + STOP_CHAIN + ONE_LOGICAL_TURN + journal + Scheduler chain inheritance + no hardcoded route order; freezes the parent's delegated Q-4 as route-identity-matched reuse / new generation; authorizes no production config write, credential, or deployment |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` | accepted / current | none | current agt_cto-agent model-route authority: ordered chain authority lives only in `agent-model-overrides.json` version 2; Scheduler jobs inherit only; canonical route aliases fail-loud; `providerEnv` is an optional four-key closed object with the old seam safety contracts fully absorbed; policy authority unchanged — implementation scope is granted only by the child authority above |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` | superseded | none | historical model-route authority replaced whole by `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` | superseded | none | historical v1 providerEnv seam authority replaced whole by `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` (safety contracts absorbed by CTR-010/CTR-014) |

The ordered-route-chain acceptance transaction (2026-08-25) is lifecycle-only
relative to reviewed head `ee13cb224660416c9044203610b93cb8f13873bb`
(链路 审计 = PASS，0 blockers；OWNER_DECISION MAX_CONFIGURED_ROUTES = 4；fresh
current main `b296558` merge-tree clean): the new Spec becomes the current
authority, both former main authorities are superseded with backlinks, and
`implementation_authority` / `production_apply_authority` stay `none` — the
transaction authorizes no implementation, configuration, or production change.

The child implementation-authorizing acceptance (2026-08-26, 链路 授权采纳执行) is
lifecycle-only relative to reviewed head `a3f787e673276942371bd0b5d8bb5b94d1302595`
(链路 授权审计 = PASS, 0 blockers; accepted_by = mayf3): `proposed -> accepted` with
provenance only, normative body byte-preserved; `implementation_authority:
contracts` / `production_apply_authority: none` unchanged. Per
SPEC_GOVERNANCE_V0 §2.1 the accepted content becomes active repository authority on
merge into main (PR #74 stays OPEN, unmerged); the implementation gate additionally
requires its presence in an implementation base that includes Scheduler V2.

PR #60 / `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` 从未进入 main，定性为
`ABANDONED_UNMERGED_CANDIDATE`，不是 active authority；PR #70 不 supersede 它。
PR #60 必须关闭且永不 merge。
