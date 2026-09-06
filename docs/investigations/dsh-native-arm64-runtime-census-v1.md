# DSH native arm64 runtime — fresh census and authority routing

Date: 2026-09-07 Asia/Shanghai. Repository: mayf3/dsh-agent-core.
Integration base: `75d25914fe2a114847c7ba0e25b463c2dda29c3d`.
Goal: `DSH_NATIVE_ARM64_RUNTIME_MIGRATION_V1`. This is evidence, not implementation authority.

## Mandate and isolation

The Owner attachment in the originating task (2026-09-07) authorizes this Goal end-to-end, with docs-first new semantic authority and production serialized behind `WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1`. Source: `/Users/yanfenma/.codex/attachments/59d23af1-d8fa-45ec-80c9-8a9bae6c1504/pasted-text-1.txt`.
All writes in this phase are local investigation/spec/plan/evidence in isolated `codex/native-arm64-runtime-v1`, based on the above main commit. Public Node distribution inspection uses a separate task artifact directory. No production writes, installs, restarts, requests to a model, external messages, credential reads, or new ingress.

## Observations

| ID | Subject / method / coordinates | Recorded result |
|---|---|---|
| OBS-ARM-001 | `uname -m`, `sw_vers`, this host, 2026-09-07; runtime-census.json | arm64; macOS 26.6.2, build 25G83 |
| OBS-ARM-002 | `ps`, `lsof -nP -iTCP:8787 -sTCP:LISTEN`, macOS sample of live PID 70038 at 07:40:37 +0800 | business parent owns 127.0.0.1:8787; `/usr/local/Cellar/node/25.6.1_1/bin/node`; `X86-64 (translated)` |
| OBS-ARM-003 | macOS sample of live PID 70388 at 07:40:39 +0800 | same Node binary; parent PID 70038; `X86-64 (translated)` |
| OBS-ARM-004 | exact Node binary `-p` probe, clean env; closure-census.json | v25.6.1, x64; native `requireBuiltin("internal/modules/esm/loader")` returns object |
| OBS-ARM-005 | git HEAD/status of business app and effective Harness; runtime-census.json | app HEAD `549dacea95f918416dc06a534a21d8e16be5ce83`, 13 dirty paths; Harness HEAD `514ab7b0029141b88c807704764d0d3e1eea1da4`, dirtyCount 0 |
| OBS-ARM-006 | app/Harness/native Node byte inspection + `lipo -archs`; business-native-inventory.json | 34 native files: 30 x86_64-only, 2 arm64-only, 2 universal. Inventory presence, NOT a claim every file is runtime-required |
| OBS-ARM-007 | authsvc launchd readback, PID 51361, child sample 80170; separate native-inventory.json | legacy trusted root still active; child X86-64 translated; trusted tree has 29 native files: 25 x86_64, 2 arm64, 2 universal |
| OBS-ARM-008 | `ps` filtered runtime entries and launch plist | scheduler side rig PID 60339 uses trusted Node and `/Users/yanfenma/.agent-core-scheduler-v2`; not the business endpoint |
| OBS-ARM-009 | proxy-free GET `http://127.0.0.1:8787/health` | HTTP 200; body 46 bytes, digest in runtime-census.json; healthz is 404. This does not prove Agent E2E |
| OBS-ARM-010 | current main accepted authorities and lifecycle search | no active arm64 production startup/closure contract found; old ARM document is investigation-only; old route-chain V2 x64 observations/HOLD are superseded through shared Codex V1/V2/V3 |

The app uses `/Users/yanfenma/workspace/project/production-dsh-agent-core`. The effective Harness is `/Users/yanfenma/workspace/github/deepseek-harness/.worktree/luna-production-rc8-20260822-090003` (`0.1.0-rc.8`, pnpm 11.7.0). Its lock digest is `9b39d08ea018790358e9fa639dceb0ada7f4edfc578dd3f8d4c7073450cd2add`. Installed store metadata names `/Users/yanfenma/Library/pnpm/store/v11`; this does not prove historical install-process architecture or a clean store.

Launch is `gui/502/ai.agent-core.runtime`, whose plist invokes `/Users/yanfenma/.agent-core/control/agent-core-runtime-glm53-wrapper.zsh`. The wrapper selects `/usr/local/bin/node`; the process environment selects the above Harness. No `DSH_AGENTS_HOME` was observed in this parent environment or selected plist values. Never treat that absence as authority to discard subsequently deployed state. The authsvc system-domain service has the same label but a different domain, root and identity.

Another listener PID 63320 binds `*:8787` while PID 70038 binds `127.0.0.1:8787`; this is a census coordinate, not authority to alter that process. Cutover must bind the exact loopback business owner and reconcile other consumers; no port-number-only process kill is allowed.

## Native closure classification and limits

The machine manifests inspect actual bytes. The business tree includes the x64 builtin loader binding, sharp/libvips, native resolver/parser/FFI libraries, node-pty, ripgrep, Codex/Claude executables and build/lint binaries. ARM node-pty prebuilds and universal fsevents already exist. Their mere presence is not ARM readiness.

The required loader binding is demonstrated runtime load-bearing by OBS-ARM-004. Other entries remain conservatively pending runtime-required classification; do not label them unused from package names. Candidate proof must trace actual addon loads and spawned executables and reject required x64 bytes. Multi-platform inert payload is allowed only with a runtime non-selection proof. The business scan excludes symlink traversal, git/worktree/cache/env files; app scope is packages/scripts/profile-production/node_modules. It is NOT a complete external-dependency closure proof; symlink and dynamic-loader dependencies must be closed before artifact sealing.

The trusted root inventory is a separate secondary surface. `/usr/local/libexec/dsh-agent-spawn-helper` is arm64, but the business parent/child are same uid 502 and do not use it. Do not transplant the legacy uid505 launch/trust model into the business runtime.

## Claims and Evidence relations

- CLM-ARM-001 (SUPPORTED): the business production parent and sampled real child require Rosetta at the census time. EVD-ARM-001: OBS-ARM-001/002/003/004 SUPPORT this claim at the sampled PIDs/binary; actual sample headers and binary result are sufficient for that pair, not future children.
- CLM-ARM-002 (SUPPORTED): switching only the old trusted root cannot demonstrate the business Goal. EVD-ARM-002: OBS-ARM-002/005/007/008 SUPPORT this claim at the recorded launch/root paths; endpoint ownership and accepted shared-Codex V3 domain agree. Active-secondary role must still be reconciled before production apply.
- CLM-ARM-003 (SUPPORTED): a new bounded arm64 startup/failure/closure Decision needs local authority. EVD-ARM-003: OBS-ARM-010 SUPPORTS this claim at base `75d2591`; accepted lifecycle is architecture-neutral, hardening Program has implementation_authority none, backup retention is limited to retention, and shared Codex V3 excludes ARM from its own scope. None already decides wrong-architecture production rejection. This is a NEW independent contract, not a supersession of shared Codex or lifecycle.

## DEVELOPMENT_PREFLIGHT

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 75d25914fe2a114847c7ba0e25b463c2dda29c3d
CURRENT_BASE_HEAD = 75d25914fe2a114847c7ba0e25b463c2dda29c3d
REVIEW_TARGET_HEAD = base before docs candidate
GOAL_OR_TARGET = DSH production parent/Harness/real children native arm64, normal E2E, valid rollback
CURRENT_GAP = real business parent and child are translated x64; clean sealed ARM closure and startup guard absent
AUTHORITY_ACTION = NEW
PRIMARY_AUTHORITY = DSH_NATIVE_ARM64_RUNTIME_V1 (proposal to author)
RELATED_AUTHORITIES = AGENT_PROCESS_LIFECYCLE_HARDENING_V2; AGENT_WORKSPACE_SESSION_MODEL_V3; SCHEDULER_TIMEOUT_OUTCOME_V2; AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3; AGENT_CORE_BACKUP_RETENTION_V1
IMPLEMENTATION_AUTHORITY = contracts only after acceptance in base
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID for nonproduction authoring/census, production packet still required
MUTATION_AUTHORIZATION = VALID for isolated docs/evidence
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = YES before operation
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS for this authoring record; future runtime evidence not yet produced
LIVE_AUTHORITY_GAP = NONE asserted by this migration census; unrelated drift is not adjudicated
OWNER_DECISION_REQUIRED = YES for acceptance of new exact-head authority
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = independent semantic review, exact-head acceptance; later full ARM artifact/runtime matrix
DONE_WHEN = full attachment production end state, not authority readiness
EXPANSION_TRIGGER = relevant authority change, unavoidable version change, target identity drift, required out-of-scope behavior
NEXT_REAL_ACTION = author smallest NEW runtime contract and obtain independent review
NEXT_ACTION = RE_PREFLIGHT
```

## Unfinished proof / preservation

Current rollback generation is NOT_FROZEN. Existing backup names and historical receipts do not prove a correct rollback for this dirty business app. No backup was deleted or reused. Before apply preserve exact effective app/Node/Harness, wrapper, launch and environment; keep secrets local and never hash credentials. Stage source must reconcile all 13 WIP paths to preserved accepted functionality at an exact merged source, without resetting/cleaning/installing into the live checkout. Shared Skill Root/P0 changes after census require fresh reconciliation.

The full required native-closure runtime classification, parent/child in-process reports for ARM, direct authsvc parent architecture report, P0 production-slot release, frozen rollback, source matrix, two canaries, independent implementation audit, sealed artifact, production cutover and normal E2E are not complete. Authsvc parent direct proc inspection returned EPERM; do all nonprivileged work before considering any necessary bounded native authorization.

## Provenance

Raw, sanitized receipts are under `../evidence/native-arm64-census-20260907/`. The one-second sample headers retain PID, executable, code type and timestamp; full samples are not published. Recorded source identities are observations, not claims that all live bytes equal git HEAD. All census results expire for mutation purposes at the next production preimage check.

## Same-version Node feasibility and bounded checks

Official `https://nodejs.org/dist/v25.6.1/SHASUMS256.txt` was retrieved directly on 2026-09-07; the downloaded darwin-arm64 tarball matches SHA256 `a80cb252d170a4730f78f5950cf19a46106f156e5886e5c1cc8c5602aea60243`. Extracted Node actually reports v25.6.1 / darwin / arm64, with native binary SHA256 `e5d8a01ccadd10e9988dfb03d371066ef06f7373e51f939d758fbb7aab7b3b21`; its linked libraries are system frameworks/libraries and the tar has no dylib entries. `node-feasibility.json` records the command environment, paths and time. This proves exact-version native Node availability/runnability, not full Harness compatibility or production readiness.

Read-only WIP comparison expanded 13 porcelain entries into 14 leaf files: 7 match current base, 7 differ, of which 1 is absent in base. `production-wip-comparison.json` contains code-only hashes and filenames. This comparison does not accept a delta or license overwriting the live tree.

Governance integrity passed. Targeted new-Spec metadata and 10/10 reverse Contract acceptance references passed for initial candidate `8fec005`. Full structure verifier returned one pre-existing `UNREGISTERED_LEGACY_DIRECTORY` at `packages/production-runtime/test` (22 children); base-versus-same-base reproduced it exactly. `structure-baseline-summary.json` preserves that limitation. Do not report global structure PASS; future code touching this surface must resolve applicable structure requirements without exceptions or unrelated cleanup.

Independent initial semantic review of `8fec005` found no Blocker and one load-bearing sequencing gap: pre-merge audit candidates were not explicitly distinguished from merged production artifacts. The Author made the bounded proposed-Spec AMEND: exact frozen attributable unmerged candidates may be built solely for review, while final production artifacts/deployment require audited merged ancestry and post-merge identity comparison. No existing accepted authority or intended production requirement changed. A fresh affected-boundary review is required before Owner acceptance.
