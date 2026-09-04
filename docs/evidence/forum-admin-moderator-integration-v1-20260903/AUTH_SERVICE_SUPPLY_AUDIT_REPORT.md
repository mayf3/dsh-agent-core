# auth-service forum.moderate Grant Supply — Independent Audit Report

- AUDITOR: independent subagent (not the author)
- DATE: 2026-09-03
- SUBJECT: mayf3/auth-service branch `audit/forum-moderator-grant-supply-v1`
  @ 8029c5f17a0ee2c1ace3c34ea64eceda88a96345 (= github/main @ audit time + 1
  commit; drift to main at audit time = 3 docs-only commits, zero product
  files), worktree wt-auth-forum-supply-audit-v1

## Verdicts

| Verdict | Value |
|---|---|
| DRIFT_DOCS_ONLY | YES |
| REGISTRY_DELTA_CLEAN | YES (exactly 18 files, all intended) |
| FREEZE_GATES_PASS | YES (MINIMAL_AUTH_V1_BUNDLE_VALID=true, CONTRACT_FREEZE_BLOCKER_COUNT=0) |
| SUPPLY_SCRIPT_SAFE | YES |
| TESTS_PASS | YES — contract-v1 45/45, candidate 22/22, oauth 104/104, supply conformance 32/32 (docker harness, executed end-to-end with verified cleanup), tsc clean |
| BOUNDARY_RESPECTED | YES (no Principal/Client/Credential/Grant created by source; writes limited to audience scopes UPDATE + one grant 1→2 UPDATE + one audit INSERT, DB tripwire-enforced; --apply refuses pre-connection, PRODUCTION_APPLY_AUTHORITY=none) |
| READY_FOR_INTEGRATION_HANDOFF | YES |
| BLOCKERS | NONE |

Registry delta essence: svc-forum registered_scopes
["forum.read","forum.write"] -> ["forum.moderate","forum.read","forum.write"],
registry_version 1.4.0 -> 1.5.0, accepted_principal_types stays ['agent'],
human_access_enabled stays false; forum.admin/wildcards still rejected
(39 negative fixtures); positive fixture scope == requested_scope == grant
set exactly. Supply script: frozen single-principal tuple, exactly-1
resolution fail-closed, Serializable + advisory lock, idempotent
(EXACT_RERUN_NOOP), read-only plan mode, secret-column SELECT denied to the
runner role and asserted, secret canary check.

## Honest limitations

- Supply test is a harness-fed DB integration test (not standalone).
- The 210-line conformance script is an ephemeral-DB harness (pinned image,
  tmpfs, --rm, self-cleaning — verified zero residue), not purely read-only.
- No dedicated negative fixture for forum.moderate on a non-forum audience
  (covered by the namespace rule).
- Conformance harness uses placeholder audit metadata; production apply
  would need real metadata (and is refused in this build).
- Branch parent PR numbering (#29) is stale on the remote — cosmetic.
