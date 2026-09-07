# DSH native arm64 runtime — ExecPlan and state

This plan manages the same Goal across phases. It is not Product Authority or a production receipt.

```text
TASK_ID = DSH_NATIVE_ARM64_RUNTIME_MIGRATION_V1
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 75d25914fe2a114847c7ba0e25b463c2dda29c3d
PRIMARY_AUTHORITY = DSH_NATIVE_ARM64_RUNTIME_V1 (proposed)
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
GOAL_STATUS = ACTIVE
IMPLEMENTATION_STARTED = NO
PRODUCTION_MUTATION = NONE
EXECUTION_MANDATE = Owner attachment 59d23af1-d8fa-45ec-80c9-8a9bae6c1504, dated 2026-09-07
GOAL_OR_TARGET = native arm64 DSH production closure with normal Agent E2E and valid rollback
DONE_WHEN = all ten Spec acceptance rows and attachment terminal requirements proved on production
EXPANSION_TRIGGER = new Node/launch semantics, required out-of-scope delta, relevant authority or preimage drift
NEXT_REAL_ACTION = independent exact-head semantic review, then one Owner acceptance gate
```

## Phase 1 — Fresh census and Authority

Census receipts and routing are in `docs/investigations/dsh-native-arm64-runtime-census-v1.md` and `docs/evidence/native-arm64-census-20260907/`. The initial phase produced fresh business PID/child Rosetta proof, actual native inventories, dirty app paths, clean Harness identity, launch/env selection and HTTP health. It does not prove the complete runtime dependency graph or rollback.

Current meaningful discoveries: business runtime is the yanfenma root, not merely `/usr/local/libexec/agent-core`; system authsvc and scheduler side rig coexist. Official same-version Node ARM distribution inspection is safe local feasibility work. Main governance is V1; deployed app contains older governance, which is not a reason to rewrite the live checkout.

Freeze proposal and independently review the route, contracts, inherited invariants and actual evidence. Author cannot accept its own proposal. Obtain exact-head Owner acceptance and lifecycle-only independent final-head check, then merge. This gate is for genuinely new permanent architecture/failure obligations, not permission to continue routine work.

## Phase 2 — Reuse accepted Authority, reconcile source and build

Precondition: accepted authority ancestor of implementation base. Re-PREFLIGHT as REUSE / EXEC_PLAN / CONTROLLED in the same Goal; do not create another Goal. Freeze updated main and relevant contract hashes. Resolve all business WIP paths to source/accepted operations without reset/clean/stash/rebase of any live checkout. Preserve legitimate behavior, including P0 and shared Skill environment changes; stage the minimal exact frozen candidate for pre-merge audit; only the final production artifact requires merged-source ancestry. Never deploy all latest main merely because a change merged.

Use exact Node v25.6.1 ARM artifact in a task-owned isolated build directory with its own pinned pnpm 11.7.0 distribution/store. Freeze package lock and effective Harness source 514ab7b0029141b88c807704764d0d3e1eea1da4, unless a reviewed required delta proves necessary. Read Harness architecture/package/local instructions before touching its source; obey its gates. Root development Harness HEAD/WIP is not the production source.

Implement the smallest production startup architecture guard and existing child-binding/build validation seams. Respect file/directory structure gates; no new top-level scripts growth or legacy-file exception workaround. Resolve every load-bearing symlink/dylib/tool executable, including external Node/Homebrew references, into the sealed manifest. Inspect actual architecture; do not classify unused binaries by name. Record source stamps honestly.

Re-PREFLIGHT if exact-version compatibility fails, source WIP cannot be preserved from accepted/merged bytes, target domain differs, or an inherited Contract must change. Do not disguise missing source provenance as dirtyCount=0.

## Phase 3 — Native validation and implementation audit

Use exact candidate Node for full affected production-runtime/Router/Harness source matrix, four cross-architecture negatives and actual builtin/internal loader imports. Safe isolated production composition must boot parent/health and two real child profiles through initialize/session/tool availability/shutdown with native process proof. No duplicate external ingress, no Scheduler delivery and no production mutation.

Freeze source/candidate artifact, then commission one fresh independent read-only implementation/artifact auditor. Freeze blocker union once; only one bounded repair and one fresh affected-boundary re-audit. Merge required source after closure; prove exact authority/implementation ancestors of main. Seal final artifact and compare with reviewed candidate; any changed boundary needs its bounded audit. Do not deploy unmerged source.

## Phase 4 — Production packet and rollback

Classify all active DSH consumers using current endpoint/root/ingress/source evidence. Business composition is mandatory; every other production-serving DSH consumer also must migrate under separately bound operations in this same Goal. Do not infer secondary equals nonproduction. Independent nonproduction consumers must not retain mutable dependencies on a replaced generation.

Prepare a secret-free sealed artifact and controlled operation packet recording actor/environment, exact stage/current/rollback paths, hashes, launch domain/label, wrapper and nonsecret env preimage, current parent/children, safe quiesce bounds, attempts, probes, aborts and receipts. Preserve credentials/config only through their authorized local boundaries; no credential content or hashes in evidence. For x64 preservation, record exact live WIP bytes and nonsecret metadata; no destructive pruning.

Before any requested native privilege, finish all nonprivileged work and selftest the minimal sealed helper against every preflight/mutation/reverse-rollback/unknown-result failure family. Test runtime composition as actual live baseline plus staged delta. Existing rollback naming and retention stay compatible; pins are metadata only.

## Phase 5 — Serialized apply and final proof

Wait behind P0 WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1. Slot ownership and absence of competing live mutation must be freshly established, not inferred from an old lock file or task title. P0 waiting preserves this Goal. On release, reconcile shared infrastructure/Skill Root changes, rebuild or re-audit only materially invalidated boundaries.

Acquire existing shared slot; verify sealed stage and rollback; freeze parent/launch preimage; quiesce only required ingress/work and affected shared consumers. Select complete native closure without mixed-generation traffic, controlled restart, health/readiness, actual parent/child architecture and loader/plugin/session/tool checks. No change to unrelated production files. Rollback failures restore exact frozen x64 bytes and current business state; unknown outcomes reconcile before replay. Release slot only with honest durable receipt and post-state classification.

Run one normal production Agent request through an existing accepted surface, proving tool loop and one expected reply with no duplicates. If genuine Owner input is irreducible, prepare all other proofs before asking. Keep x64 rollback inactive under retention. Only full matrix PASS ends this Goal; rollback, audit PASS or artifact readiness does not.

## Evidence mapping and current state

| Required boundary | Authoritative receipt needed | Current state |
|---|---|---|
| Host/business parent/real child baseline | runtime-census.json system sample headers | OBSERVED x64/Rosetta, not target |
| Native installed bytes | business-native-inventory.json + secondary native-inventory.json | byte inventory complete for stated scopes; runtime edge classification pending |
| Exact Node ARM feasibility | official checksum and executed isolated Node receipt | PASS for exact Node only; Harness compatibility not yet tested |
| Accepted new Authority | independent review + Owner exact-head acceptance + main ancestry | proposal only |
| Source reconciliation | per-WIP disposition and sealed merged closure | not done |
| Native source/test/loader/negative matrix | candidate exact-runtime receipts | not done |
| Two real child canaries | native composition/initialize/session/tools/shutdown receipts | not done |
| Implementation/artifact audit | independent frozen-head audit and bounded closure | not done |
| Rollback and transaction proof | exact preimage + simulator failures + retained generation | not frozen |
| Production slot and apply | P0 release/live handle reconciliation + serialized receipt | not acquired / no apply |
| Production parent/child and normal E2E | actual process probes + one request/reply/tool-loop + no duplicates | not done |

```text
DONE_WHEN_MET = NO
EXPANSION_TRIGGERED = NO
OWNER_ACTION_REQUIRED = NEW_EXACT_HEAD_AUTHORITY after semantic review
GOAL_STATUS = ACTIVE
```
