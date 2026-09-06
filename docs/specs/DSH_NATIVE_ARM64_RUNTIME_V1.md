---
spec_id: DSH_NATIVE_ARM64_RUNTIME_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - DSH and Agent Core production architecture closure on this Apple Silicon host
  - architecture startup guard and parent-child runtime binding
  - architecture-consistent build, serialized cutover and exact rollback
governed_by:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
  - AGENT_CORE_BACKUP_RETENTION_V1
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# DSH native arm64 production runtime V1

Proposed authority only. Authoring base: `75d25914fe2a114847c7ba0e25b463c2dda29c3d`.
Route: NEW / EXEC_PLAN / CONTROLLED, docs-first. No implementation or operation before exact-head Owner acceptance and merge into main.

## 1. Goal

Remove DSH / Agent Core production runtime dependence on Rosetta on this Apple Silicon host. The active production Node, parent, Harness, required native dependencies and real Agent children form one reproducible native arm64 closure. Completion requires normal production Agent execution, not just an arm64 build. Goal identity remains `DSH_NATIVE_ARM64_RUNTIME_MIGRATION_V1` through investigation, authority, implementation, deployment and any rollback.

## 2. Scope and non-goals

Scope includes the actual business production runtime, any other DSH runtime proven to serve production, production Harness/vendor closure, runtime-required native executables/addons, architecture-specific materialization, startup validation, existing Router spawn binding, source tests, staged artifacts and controlled cutover/rollback.

The current business surface is the yanfenma-domain parent owning `127.0.0.1:8787` and `/Users/yanfenma/.agent-core`. Host PIDs are observations, not permanent target identity. The authsvc trusted runtime and scheduler side rig are separately inventoried consumers. Before cutover classify every DSH consumer as production-serving or isolated nonproduction using endpoint/root/ingress/process evidence. All production-serving DSH parents and children must become arm64 within this Goal; an active x64 production consumer prevents completion. Nonproduction consumers retain independent closures. No consumer may be silently disabled or reclassified merely to satisfy completion.

No other-service architecture migration, Node modernization, system Rosetta removal, package-manager redesign, new daemon/control plane, global store modification, launchd normalization, new process security domain, Skill semantics, Scheduler semantics, Workflow semantics, Forum moderation, model-route semantics or credential migration is authorized. Existing accepted parent authorities keep their full meaning. Cross-repository Harness changes, if mechanically required, obey that source repository's governance; this Spec grants no authority over its product contracts.

## 3. Authority and dependencies

Owner: mayf3. The attachment provides the execution mandate, not a replacement for Product Authority. Product Architecture thin-layer and DSH-native ownership remain constraints under repository-local precedence. All parent references bind their accepted contents at the authoring base above; fresh relevant changes require re-PREFLIGHT.

This is a new independent architecture decision. Lifecycle authority does not select CPU architecture; hardening Program grants no child implementation; retention authority governs backup handling only. Old route-chain V2 x64 observations and ARM HOLD text are superseded through the shared-Codex successor chain. Current shared-Codex V3 excludes ARM from its own scope and is not replaced or amended by this Spec. Its credential, route and source-stamp contracts remain binding.

Production apply depends on release of the P0 `WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1` slot, a valid bounded operation packet, fresh exact preimage, and all preproduction gates. Owner acceptance of this Spec is not evidence that implementation, merge, cutover or E2E happened.

## 4. Current State

STATE-ARM-001: At the 2026-09-07 07:40 +0800 census, business parent PID 70038 and real child PID 70388 use v25.6.1 x64 Node under Rosetta. Business app HEAD is `549dacea95f918416dc06a534a21d8e16be5ce83` with 13 dirty paths; effective Harness HEAD is `514ab7b0029141b88c807704764d0d3e1eea1da4` with dirtyCount 0. Basis: OBS-ARM-001 through OBS-ARM-005 in the investigation below. This does not establish a sealed current rollback generation or current WIP provenance.

## 5. Observations

Observation definitions, methods, timestamps, exact source/binary coordinates and sanitized receipts are in [fresh census](../investigations/dsh-native-arm64-runtime-census-v1.md), at this candidate's revision. OBS-ARM-002/003 are macOS samples of real running processes, not filename inference. OBS-ARM-006 is actual Mach-O enumeration, not a runtime-required verdict. OBS-ARM-009 records HTTP health only.

## 6. Claims and assumptions

CLM-ARM-001 (SUPPORTED): DSH business production still depends on Rosetta. CLM-ARM-002 (SUPPORTED): changing only the historical trusted root is insufficient. CLM-ARM-003 (SUPPORTED): wrong-architecture rejection and native closure require a new independent authority. Support and limits are defined by EVD-ARM-001/002/003 in the investigation.

No claim is made that present WIP equals merged source, every installed binary is runtime-required, secondary consumers are nonproduction, or production is ready. Those are execution gates with fail-closed outcomes; their unknown values never grant permission to switch.

## 7. Evidence relations

EVD-ARM-001 relates real parent/child samples and the exact Node probe to CLM-ARM-001 at recorded PIDs/time. EVD-ARM-002 relates distinct endpoint/root/launch/source observations to CLM-ARM-002. EVD-ARM-003 relates the exact accepted authority census to CLM-ARM-003. These relations SUPPORT claims only at those coordinates; future Contract conformance is a separate exact-revision record. Reviewers can read the sanitized receipts in this candidate and reproduce allowed probes. Missing required access is a failed gate, never invented evidence.

## 8. Decisions

- DEC-ARM-001 — Owner selects native arm64 as DSH's normal production architecture on this Apple Silicon host; x64 is allowed only for explicit failure rollback to frozen bytes. System Rosetta remains installed.
- DEC-ARM-002 — Keep exact Node v25.6.1 for this migration. Change architecture, not Node major/minor/patch. If this exact version cannot support the complete arm64 runtime, stop dependent implementation and obtain new exact-head semantic authority; do not silently use local Node 26.
- DEC-ARM-003 — App, Node, Harness and runtime-required native bytes are one selected generation, prepared independently and activated without a traffic-serving mixed interval. Keep current launch supervision, trust identity, environment semantics and persistent state.
- DEC-ARM-004 — Validate native architecture before production components cause effects; reject wrong/unknown architecture and incompatible native closure. Do not fall back to Rosetta or a different binary.

## 9. Contracts

### CTR-ARM-001 — Target and consumer binding

The migration operator MUST freshly bind the business endpoint, persistent root, launch domain/label, actor uid/gid, parent executable and child lineage. It MUST census every DSH consumer of replaced paths. Every production-serving parent and real child MUST use native arm64 at terminal completion, with exactly one selected runtime generation per production composition. Merely migrating the legacy authsvc root, changing a filename, or leaving another x64 production consumer active MUST fail completion. A consumer-role ambiguity MUST prevent its affected cutover; do not mutate unrelated services.

### CTR-ARM-002 — Architecture and version admission

On the scoped Apple Silicon production deployment, the existing earliest runtime startup seam MUST require `process.platform === "darwin"`, `process.arch === "arm64"`, no Rosetta translation, and exact Node v25.6.1 before ingress, Scheduler admission or child spawn. The deployment-owned architecture expectation MUST be present in normal ARM launch composition; missing, malformed, wrong or unprovable evidence MUST fail loud. Generic nonproduction/platform paths retain their existing supported behavior. An operator rollback selects frozen old-generation bytes; a normal ARM candidate MUST NOT accept a runtime override that silently enables x64. Every child MUST inherit/select the sealed native Node, and real-process proof MUST establish the executed architecture.

### CTR-ARM-003 — Clean reproducible closure

For a pre-merge isolated audit candidate, the builder MUST freeze exact attributable candidate source identities, exact Node distribution and SHA256, Harness version/lock, package-manager version, store identity, app dependencies, native files and runtime executable closure. Such a candidate MAY contain the frozen unmerged implementation under review and MUST NOT be deployed. Build Node, build process and pnpm install process MUST be arm64. Use isolated clean stores/modules or mechanically prove an architecture-safe store; no mixed existing install/rebuild tree. No mutable external symlink or unsealed executable may remain load-bearing. A source stamp MUST report actual source commit and honestly measured dirtyCount; never fabricate zero or copy `.git` to production. For the final sealed production artifact and deployment, all required runtime source deltas MUST be audited and merged, with the ancestry and post-merge artifact comparison required by CTR-ARM-006. No unmerged patch or wholesale latest-main deployment is permitted.

### CTR-ARM-004 — Runtime-required native closure

The artifact validator MUST enumerate actual `.node`, Mach-O executables and dylibs across the full resolved runtime closure, including external symlink targets and dynamic libraries. Every required native file MUST be arm64 or universal containing arm64. X64-only required files, unknown/unclassified required files, unresolved dependency edges, missing arm64 bindings or a mixed required tree MUST reject the candidate. Nonruntime payload may remain only with a recorded role and mechanical non-selection proof, including node-pty x64 prebuilds. Package names alone are insufficient. Actually execute the internal ESM loader chain via node-addon-require-builtin, plugin resolution, representative tool registration and relevant native execution; directory existence is not PASS.

### CTR-ARM-005 — Regression and isolated production composition

The exact ARM Node MUST execute the full affected production-runtime, Router and Harness suites, including startup guard, model/runtime config, spawn/environment, initialize, resume where applicable, lifecycle/shutdown/restart, plugins, native loader, tool registration and actual boot-path Skill loading where used. Record proxy settings safely, TMPDIR, Node architecture/version and store identity. Before classifying an environment failure as product regression, perform the minimal architecture/environment A/B discriminator.

Before production, run the closest existing complete production composition with a healthy parent and at least two representative real child profiles (minimal and representative plugin/tool path), with arm64/no Rosetta, initialize, session/tool availability and clean shutdown proof on both. No external Feishu duplicate connection, Scheduler duplicate execution or production business mutation is permitted. Do not invent a second control plane if dual-start ingress is inseparable. Negative tests MUST demonstrate wrong Node rejection, missing ARM binding rejection, substituted x64-only addon rejection and mixed required-tree rejection, with no Rosetta fallback.

### CTR-ARM-006 — Review, merge and artifact

After source plus artifact candidate freeze, Primary MUST commission one fresh independent read-only implementation/artifact audit covering all these Contracts and inherited affected invariants. Freeze one blocker union; if blockers exist, perform one bounded repair and one fresh affected-boundary re-audit. Only audit closure permits required source merge. Prove accepted Authority and implementation heads are ancestors of main. Seal the final exact artifact with source/Node/Harness/lock/native manifests, hashes, honest stamp, executed test/audit receipts and production/rollback probes. If final artifact differs from reviewed bytes, prove deterministic identity or review the changed boundary before shipping. Evidence contains no credentials, tokens, credential hashes or private application secrets.

### CTR-ARM-007 — Production priority and coexistence

Production mutation MUST be serialized using the existing operator/slot coordination after P0 Workflow releases it, with fresh live verification that no unrelated apply is active. No new lock service is authorized. Waiting is a phase of this same Goal. Reconcile intervening deployed infrastructure and preserve legal Shared Skill Root state, including DSH_AGENTS_HOME when deployed. Shared Skill Root, Forum Moderator and GLM/Luna retain separate Authority and transaction receipts. A stale packet, changed relevant preimage or unknown competing attempt MUST stop apply until reconciled.

### CTR-ARM-008 — Cutover and rollback transaction

Before apply, freeze exact running/launch/environment/config preimage and hashes of nonsecret rollback bytes; preserve secrets only at their authorized local locations without disclosure or credential hashing. Stage independently, keep current x64 app/Node/Harness usable, and do not install/reset/clean/rebase the live WIP checkout or general global store. Reconcile each live WIP delta to legally preserved behavior in the exact merged candidate; otherwise cutover is not ready.

Acquire the production slot, verify hashes and rollback, quiesce only required ingress/work, prove affected old processes no longer execute the replaced generation, atomically select the complete new closure, restart under existing supervision and run readiness/architecture/Agent gates. A multistep filesystem transaction MUST prevent any mixed generation from serving traffic and reverse completed steps on failure. Persistent business state MUST NOT be restored from an old snapshot; architecture rollback restores code/launch/env, preserving legitimate current state and accepted unknown-outcome fences. No whole-machine reboot unless mechanically unavoidable, and no Rosetta uninstall.

Failures classify as FAILED_NO_MUTATION, FAILED_SAFE_ROLLBACK or OUTCOME_UNKNOWN with durable attempt receipts. Parent failure before traffic or child/plugin failure MUST restore the exact frozen x64 generation with health and child readback. Unknown outcome MUST reconcile PID/architecture/launch/receipt before any replay. No emergency pnpm install or mixed ARM bytes in rollback. Keep valid rollback according to accepted retention; failure never prunes, and pin remains metadata-only.

### CTR-ARM-009 — Production proof and completion

Following cutover, mechanically prove host/native Node, real production parent and real child arm64 and Rosetta=NO, required native compatibility 100%, required x64-only=0, no mixed runtime closure, loader/plugin/boot/initialize/session/tool loop and runtime health PASS. Run at least one normal production Agent flow through an existing accepted surface: request, boot/session, tool loop and one expected reply, with no duplicate external reply. Use an existing safe canary; if genuine Owner interaction is the only legal final E2E, prepare all other proofs before requesting it. No synthetic test or HTTP health alone substitutes for this E2E.

Complete only when all production-serving consumers meet CTR-ARM-001, unrelated production state has no migration-caused mutation, rollback is valid, and the recorded full acceptance matrix is PASS. An x64 rollback restores service but leaves this Goal incomplete. Retained inactive x64 rollback bytes do not count as a second active runtime generation.

### CTR-ARM-010 — Execution limits and Owner gates

The operator MUST preserve existing Principal, workspace, session, route, permission, Scheduler and ingress semantics. Changes beyond the architecture closure or new Node/launch semantics require re-PREFLIGHT and appropriate new authority. Only irreducible new semantic acceptance, native privilege, product decision, unsanitizable disclosure or real-user E2E are Owner gates. Before native privilege, complete nonprivileged work and selftest one minimal sealed helper bound to the exact operation and attempt; no generic sudo window. The attached mandate permits legal work to continue autonomously, but does not bypass docs-first acceptance or required production receipts.

## 10. Acceptance

Each row requires executed evidence at exact Spec/source/artifact/environment/time coordinates in the later Conformance Record. Definitions here are not execution claims.

| ID | Contracts | Method | Environment | Required evidence / expected result | Failure condition |
|---|---|---|---|---|---|
| ACC-ARM-001 | CTR-ARM-001 | bind endpoint/root/launch/PID lineage and enumerate consumers | preflight and final host | complete consumer map; each production parent/child native, one selected generation per composition | wrong endpoint, role ambiguity, active x64 production or unbound consumer |
| ACC-ARM-002 | CTR-ARM-002 | real startup positive and wrong/missing/malformed expectation negatives; actual parent/child architecture probes | exact ARM Node and preserved x64 negative | native/version gates pass before effects; negatives reject without ingress/jobs/child | filename-only inference, wrong version/arch accepted, fallback or late gate |
| ACC-ARM-003 | CTR-ARM-003 | clean build receipt, source/lock/store/provenance/symlink and executable dependency audit | isolated ARM build | exact v25.6.1; build/install arm64; honest stamp; frozen attributable pre-merge candidate; final production artifact has merged source ancestry and full sealed closure | dirtyCount fiction, shared mixed install, unfrozen audit source, unmerged production delta, mutable load-bearing bytes |
| ACC-ARM-004 | CTR-ARM-004 | byte census, actual loader/plugin imports, dlopen/exec traces, required-binding substitution/missing/mixed negatives | sealed candidate | required compatible=100%, x64-only=0; all unresolved/invalid paths reject | package-name-only check, unchecked external dylib, silently unused or ignored required binary |
| ACC-ARM-005 | CTR-ARM-005 | affected suite matrix and two real child profile canaries, production composition boot/health/session/tools/shutdown, environment A/B | isolated ARM composition, scratch state | all listed affected suites PASS, both children native, no external duplicate ingress/jobs or production mutation | fake-only child, fewer than two profiles, missing suite or side effect |
| ACC-ARM-006 | CTR-ARM-006 | independent frozen-candidate audit, blocker closure, merge ancestry and final artifact comparison | exact source/artifact | audit receipt, at most bounded repair/re-audit, accepted/source ancestors, seal identity | self-audit, open blocker, unmerged source, unreviewed final delta or secret evidence |
| ACC-ARM-007 | CTR-ARM-007 | fresh P0/slot/competing-attempt and preimage reconciliation | production just before apply | no concurrent mutation; separate receipts; all intervening env preserved | preempt P0, stale preimage, combining transactions, dropping DSH_AGENTS_HOME |
| ACC-ARM-008 | CTR-ARM-008 | failure injection at each mutating step plus reverse rollback and crash/unknown reconcile; final preimage/readbacks | isolated simulator before apply; production transaction afterward | no-mutation failures preserve bytes; postmutation failures exact rollback; no mixed traffic; receipt class honest; valid retained rollback | partial generation, lost WIP, business-state rewind, blind replay, emergency install or destructive pruning |
| ACC-ARM-009 | CTR-ARM-009 | real production architecture/loader/child probes and normal existing Agent canary | production after cutover | parent/child native; session/tool loop/one expected reply/health PASS; no duplicates/unrelated mutation; full matrix PASS | synthetic-only proof, health-only proof, x64 rollback marked complete or missing real-user E2E |
| ACC-ARM-010 | CTR-ARM-010 | diff/identity/env/state invariants plus mandate/helper selftest inspection | all phases, controlled helper where needed | bounded architecture scope, existing semantics preserved, required native authorization exact | scope expansion, credential disclosure, generic privilege window or authority bypass |

## 11. Alternatives and disposition

- Keep x64 production and install both platform bindings: rejected; preserves Rosetta dependency and mixed-closure risk.
- Use local Node 26 arm64: rejected for this migration; combines architecture and version change.
- Switch only Node or install arm64 packages into live x64 Harness: rejected; reproduces the historical loader failure class.
- Reset dirty production checkout to current main: rejected; loses unrelated legal state and deploys an unfrozen closure.
- Generic platform manager, hardware abstraction or new lock service: rejected; existing startup, build and operator coordination seams suffice.
- Reopen superseded GLM/Luna authority to migrate CPU architecture: rejected; current route contracts are preserved, and this independent Decision has separate ownership.

## 12. Migration, compatibility, and rollback

The companion ExecPlan orders this same Goal through authority acceptance, clean build and source adaptation, tests/canaries, independent implementation audit, merge, seal, serialized production cutover and final proof. It is an execution plan, not authority. Exact deployment paths, PIDs and artifact hashes belong to a freshly sealed controlled runbook rather than a permanent Spec.

Node v25.6.1, Harness plugin/session compatibility, source-stamp honesty, current trust-domain uid/gid, existing launch supervision, persistent business state, accepted retry/unknown semantics and rollback retention MUST remain compatible under CTR-ARM-002/003/008/010. A scoped x64 rollback is a temporary recovery state, not successful migration. No unrelated accepted Authority is modified or partially superseded.

## 13. Open questions

The only normative acceptance request is mayf3's acceptance of DEC-ARM-001..004 and CTR-ARM-001..010 at the reviewed final head. No subordinate Agent may self-accept. Normative TBD: none. Unresolved authority conflict: none identified at the authoring base. Partial supersession: none.

Operational unknowns (secondary-consumer roles, WIP reconciliation, exact frozen rollback, P0 release, final native privilege need and real-user canary) are mandatory fail-closed execution gates. They are not assumed PASS and do not authorize an apply during authority authoring.
