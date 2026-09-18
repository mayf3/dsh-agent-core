# Disabled genesis operation preflight and Owner mandate

```text
DEVELOPMENT_PREFLIGHT = OPERATION
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = eb7e72f2bc75c8842492b2b90cac31263dd583ea
EXECUTABLE_SOURCE = 65559ddb9d414d248f640f46216bd62e8068983d
BASE_HEAD = 2c59bf5169b38c90b2ea87f210bdfb453e4a7b68
CURRENT_BASE_HEAD = 5c7b62055e40e3ad0c7ec80a2896a51fd0e33814
ROUTE_STAGE = OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
CURRENT_GAP = actual disabled genesis and dedicated reviewer login
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0 CTR-DCP-004/017 section7
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID latest explicit mayf3 exact-package authorization
MUTATION_AUTHORIZATION = VALID only one disabled install and reviewer login
ISOLATED_WRITE_SURFACE = YES existing isolated worktree and exact new system destinations
CONTROLLED_RUNBOOK_REQUIRED = YES
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO for this exact disabled operation
EMERGENCY_STATE = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
BASE_IMPACT = NONE on exact package/source
IMPLEMENTATION_ALLOWED = NOT_APPLICABLE no package/source change
MERGE_READY = NOT_APPLICABLE
OPERATION_ALLOWED = YES conditional on fresh protected installer preflight
DONE_WHEN = receipted disabled installation and dedicated login; independent poststate readback
EXPANSION_TRIGGER = any mismatch, unknown result, out-of-scope effect or occupied preimage
NEXT_ACTION = CONTINUE within reviewed runbook; STOP on expansion trigger
PARENT_GOAL_COMPLETE = NO
```

## Exact immutable attempt

Attempt `genesis-65559dd-20260918-01`. Pins and external Owner mandate are in the
adjacent `owner-mandate.json`; external grant is `owner-authorization.json` and its
protected target is `/private/var/db/genesis-65559dd-20260918-01.authorization.json`.
The grant has a maximum 3600-second execution window. Never use a new attempt ID
or replay a partial installation. No native command has run at this preflight.

Runbook: `docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_GENESIS_RUNBOOK.md`
at delivery HEAD above. Exact package stays unchanged. Administrator authentication
and visible device login are performed by Owner locally; no credential is requested
in chat, copied from the caller, or read in evidence. Login terminal is not captured.

The operator driver runs as UID502; its only privileged write commands before
native execution are the runbook's fixed Apple install for the protected directory,
exact runner, and external grant. It verifies installed runner hash as UID502 before
any privileged runner execution. Root invokes only the reviewed installed runner
for install/login, with exact literal pins. Native operations retain their protected
journals. The driver stops on any error and records phase/exit status; it is not a
root helper or a standing authorization interface.

Fresh public preconditions independently passed. One root-only existing plist
prevented the ordinary caller from reading its bytes; that limitation is retained
in `fresh-preflight.json` and classified in `preflight-interpretation.json`.
Complete protected sudoers and existing-plist census is performed by the native
installer before its CreateIdentities step. No service launchctl invocation,
service enablement/start/restart, sudoers edit, runtime installation/activation,
production routing change or legacy retirement is allowed.

Rollback is exactly the reviewed conservative file-removal procedure. Unknown
intent is preserved and reconciled; no blind rollback/retry or key regeneration.
