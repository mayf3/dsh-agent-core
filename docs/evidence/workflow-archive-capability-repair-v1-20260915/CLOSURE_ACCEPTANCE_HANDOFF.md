# ARCHIVE CLOSURE ACCEPTANCE REQUIREMENTS — handoff to runtime provider
from: WORKFLOW_ARCHIVE_CAPABILITY_REPAIR_V1_PR_MERGE_RUNTIME_CLOSURE (archive lane)
to:   SCHEDULER_WATCHDOG_* whole-main 41f354d production deployment (runtime provider)
date: 2026-09-18
status: WAITING_FOR_RUNTIME_PROVIDER — additive acceptance only; does NOT alter the
provider's own authority, gates, packet, slot ownership, or runbook.

## 0. Context (one paragraph)

Archive repair (PR #303, merge d602b592, in main lineage ≤ 41f354d, zero drift on the
three target files d602b592→41f354d) is SOURCE_FIXED but NOT yet in the production app
tree: the g5 failed-deploy preimage restore (09-17 21:43) reverted the broker files to
pre-fix bytes, and the 06:44 g6-narrow apply inherited that stale preimage. The Owner
has delegated archive runtime recovery to the whole-main 41f354d deployment, which
naturally contains the three target files. This document tells the provider what the
archive lane will independently verify after the deploy — nothing more.

## 1. Post-deploy target bytes (current canonical main 41f354d163f532348b2ad1ef33b5ee528655dfc6)

```text
packages/broker/src/registry.js                         sha256=9dab1da617e9856f99020f0d1c4fd533997f31713e1941bb1a33e3d543216534
packages/broker/src/schema.js                           sha256=ff0ee4cbae21121e0b5af55048227b3a5bf25a331d4af7749f16a2434fa939d8
packages/broker/src/capabilities/workflow-execute.js    sha256=57b8d0fb9e4aadb93567dc0f24d7304a8f087a25d0c718c531736cc9650b77cc
```

If main moves past 41f354d before the deploy, the acceptance target is re-derived from
the actually-deployed canonical SHA (archive files have been drift-free across recent
merges; re-verify at handoff time).

## 2. Fix markers the deployed bytes must contain (grep-level)

```text
RC1  packages/broker/src/schema.js                      "manifest.description = input.description"
RC2  packages/broker/src/registry.js                    "Required arguments per operation"
RC3  packages/broker/src/capabilities/workflow-execute.js  "structuralDiagnostics: true"  (plus renderErrorDetail: true, additionalProperties: false ×4 ops)
```

## 3. Independent post-deploy verification the ARCHIVE LANE will run (consumes facts, no mutation)

1. **BYTE READBACK**: sha256 the three files under /usr/local/libexec/agent-core/app/packages/broker/src → must equal §1 (and §2 markers present). Runtime process must postdate the file swap.
2. **CAPABILITY READBACK**: from a fresh agent turn (Feishu-triggered), read the model-visible tool schema actually served (journal request/header record): `workflow_execute` description must contain the per-operation required-arguments line and must NOT contain the literal "undefined"; operation enum = create_instance|transition|cancel_instance|archive_instance.
3. **NEGATIVE PROBE** (zero business side effect — rejected locally, never reaches svc): call `workflow_execute {operation:"archive_instance", workflowInstanceId:"00000000-0000-0000-0000-000000000000", principalId:"forged-probe", domainId:"forged-probe"}` (deliberately no `reason`): expected local `invalid_arguments` whose detail names ALL of `unknown property "principalId"`, `unknown property "domainId"`, `missing required property "reason"`; verify ZERO new rows in svc `workflow_command_receipts` for the probe window.
4. **UNINTENDED_BUSINESS_MUTATION**: svc receipts/audits delta over the deploy window must equal exactly the provider's declared deployment writes — any workflow instance/command mutation beyond that = FAIL.
5. **HEALTH**: runtime process alive post-restart, watchdog heartbeats fresh (W1/W2), agent turns completing (probe turn itself is the smoke).

## 4. Deployment receipt lesson (from the 09-17/09-18 incident chain)

The receipt should record BOTH the plist AGENT_CORE_DEPLOYED_SHA AND a content hash of
the installed tree (or at least the three §1 files). The current mismatch (plist says
d602b592, tree says otherwise) originated from a receipt that recorded the label only.

## 5. Closure contract

- If §1–§5 verify PASS → archive lane sets RUNTIME_REFRESHED=YES (provider=SCHEDULER_WHOLE_MAIN_DEPLOYMENT), PRODUCTION_FIXED=YES, GOAL_STATUS=CLOSED.
- If the whole-main deployment is cancelled / fails / stalls / abandons the broker tree → archive lane rebuilds a fresh standalone packet from the then-current canonical main (the archive-specific mutation lane is re-established only at that point, per Owner decision of 2026-09-18).
- The archive lane will NOT poll production; it consumes the completion signal from the Owner/provider and then runs §3.
