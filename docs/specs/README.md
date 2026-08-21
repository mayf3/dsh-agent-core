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

## AgentProcess lifecycle authority

| Spec ID | Status in this branch | Implementation authority | Disposition |
|---|---|---|---|
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` | accepted / current | `none` | Remains current until an atomic V2 acceptance transaction |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` | proposed replacement candidate | `contracts` (inactive while proposed) | Whole-authority `SUPERSEDE` candidate; does not authorize implementation now |

Other existing Specs remain at their stable filenames and keep their current lifecycle until explicitly reviewed.
