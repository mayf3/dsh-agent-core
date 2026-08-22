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

## Agent primary Workspace import authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2` | accepted / current | none | exact 86-Agent Trusted Fleet curated-import authority; no implementation by itself |
| `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` | superseded | historical legacy field | historical adopt-in-place / zero-copy authority replaced whole by V2 |

The V2 acceptance transaction is lifecycle-only relative to reviewed head
`ae77eccf242d3b7401bb8110d4496897cc807ca7`; it performs no Workspace migration or
production change. PR #47's separate Auth blocker remains open.

## AgentProcess lifecycle authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` | accepted / current | contracts | current AgentProcess lifecycle authority |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` | superseded | none | historical replaced authority |

`accepted / current` plus `implementation_authority: contracts` means bounded Contracts may authorize a later implementation only after its exact-base preflight and compliance gates pass. It does **not** mean implementation is complete, production is deployed, or an implementation PR has automatic merge authority.
