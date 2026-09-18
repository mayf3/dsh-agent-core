# Independent review: exact first-live materialization design

REVIEW_RESULT=BLOCKED_DESIGN_CLOSURE_REQUIRED
AUTHORITY_ACTION=REUSE
SPEC_GAP_DEPENDENCY=NONE_IDENTIFIED
FROZEN_BLOCKER_UNION=FM-01,FM-02,FM-03
IMPLEMENTATION_ALLOWED=NO for this materializer until the bounded design closures pass
OPERATION_ALLOWED=NO
FIRST_REAL_AUTOMATIC_DEPLOYMENT_COMPLETE=NO

Reviewed design SHA256 `fc23c56f13815ec456ed570d4370e8b3a1fd93b2d6f82500989974225a4f0cfe`, `first-live-materialization-design.md`, originally based at `10da1fddaf446cfd2ff8da9e1c4ce9b1915d4874`. Current parent moved through `c4a52d3` and login source `89653e2c7bcb955f5520ec2247652232861dab9d` to docs-only `c87393b`; the reviewed design bytes remain unchanged. This review authored no semantic implementation and performed no root, endpoint, login, service, production or credential-content operation.

Governing authority is accepted PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 semantic revision `39865536ce51005f95a98473e77c2329078512c0`, especially CTR-004/007/008/009/015/016/017/018/020 and migration §7. The Owner's existing mandate permits determining the two bindings and nonproduction implementation; it does not authorize this first-live operation. The recommendation is a finite same-Goal operation, not a new signing API, general retry facility or Goal platform. No unrelated closed finding is reopened.

## Frozen design blockers

### FM-01 — prerequisite lifecycle receipt has no concrete trusted producer or executable transition contract

Class: REQUIRED_GATE_FAILURE.

SOURCE: CTR-DCP-008 fixes privileged programs/arguments, install metadata and root closure; CTR-DCP-009 requires one transaction mutex; CTR-DCP-015 requires actual protected observations; CTR-DCP-017 requires exact independently reviewed bootstrap; CTR-DCP-018 and §7 require all canonical writer retirement, four-lock-family census, real lifecycle-denial evidence and receipted safe recovery. Design lines 50 and 71 explicitly defer the essential producer to a “separately reviewed operator.”

COUNTEREXAMPLE: A root-protected file with the expected digest can be an installed Agent-prepared claim rather than evidence that all writers were retired. The current source checks a lifecycle digest, not the execution behind it. Neither a receipt namespace nor root ownership proves that the active old deployment path was quiesced, service-account code permissions removed, or caller UID 502 denied independent lifecycle control. Current reported facts make this reachable: app/harness directories remain UID 505:GID 601 mode 0755, and the root-owned Node image resolves an @rpath/Homebrew dependency closure. The prepared 22-image transformed closure is only a prospective artifact until exact trusted source/transformation/bytes and installed resolution are independently verified. The actual Runtime's fixed `--catchup 0` also belongs in the typed reviewed profile; silently removing it is not adoption.

IMPACT: Materialization could issue adoption/activation authority on a false retirement/closure claim, or remain impossible to execute despite a claimed complete package.

MINIMAL_CLOSURE: Freeze one exact lifecycle operator design inside this operation: fixed identities/programs/arguments/paths and expected preimages; all four lock families and active-owner census; finite canonical-entrance retirement; complete app/config/plist/executable/dylib inventory; exact closure provisioning/metadata actions and parent-directory protections; explicit same-UID/domain/signal/lifecycle-denial probes with safe non-destructive semantics; generation/target/host bindings; durable pre-effect intent and per-step actual observations; protected receipt publication only by that execution path; independent current readback; exact rollback and unknown stop rules preserving receipt history and not silently re-enabling old automation. Freeze how old locks hand over to the single permanent production mutex and how no legacy writer can race the transition. Reuse fixed native primitives; do not execute mutable scheduler/build JS, Python or shell as root, recursively repair ownership, or accept caller-created PASS. The same package must identify the concrete bounded real canary executor/actor and unknown/cleanup handling, because a read-only observer cannot cause the real canary by itself. This is controlled-operation engineering under existing authority, not a new Product Spec.

### FM-02 — absent first queue has no authorized initializer before adoption

Class: REQUIRED_GATE_FAILURE.

SOURCE: CTR-DCP-009/010/017/020 and the design's executable first-live sequence. Installed genesis creates the permanent locks in `packages/deployment-control-plane/src/bootstrap/genesis_install_native.rs:222`–229 but does not create queue.db. The in-progress native one-shot route opens existing queue.db before Queue::open (`src/service/adoption.rs:121`–123). Existing secure queue initialization is in `src/service/server.rs:133`–162, while ordinary daemon startup is gated by configured activation at line 188.

COUNTEREXAMPLE: Start from the actual completed disabled genesis, materialize every listed public file successfully, then run --prepare-adoption. It rejects ABSENT opening queue.db. Starting the ordinary daemon merely to initialize storage conflicts with the explicit pending/disabled sequence. Recreating a missing queue after an interrupted or previously active installation would instead destroy/reinterpret authority.

IMPACT: The proposed operation cannot reach baseline/canary from its stated prestate; a late workaround could weaken missing-state fail-closed behavior.

MINIMAL_CLOSURE: Explicitly reuse the existing secure queue initializer only for this exact operation's independently verified never-initialized genesis prestate, under the retained permanent mutex and durable operation/pending fence. Bind absence of DB and all sidecars plus relevant history before the one-use intent; fsync the initialization and verify the expected empty/schema state. Any existing, partial, corrupt, unexpected or later-missing state is a stop/reconciliation, never replacement/reset or a generic missing-queue fallback. Keep ordinary daemon disabled; prove the exact initial success case and interrupted/existing/sidecar/symlink/replay negatives offline.

### FM-03 — the allowed signing/output assertion contradicts required registry enrollment

Class: REQUIRED_GATE_FAILURE.

SOURCE: CTR-DCP-004/007/015/017 require real role separation and accurate authority evidence. Design line 72 expects “only the allowed Authority-domain outputs,” while line 58 requires Registry::enroll. Existing `src/registry/mod.rs:48`–52 loads local-deployment-registry's Producer key; `src/registry/storage.rs:123`–135 signs ProducerSnapshot and DeploymentRegistryLedger on every new enrollment. `src/registry/mod.rs:99`–107 creates a Pending row with no READY/proposal/closure and business_goal_complete=false.

COUNTEREXAMPLE: A valid two-enrollment materialization necessarily emits Producer-domain signatures, so the stated positive test either cannot pass or can pass only by failing to observe actual outputs. A broad correction such as “Producer signing is allowed” would unnecessarily permit fabricated READY or closure.

IMPACT: The security test and package privilege description would be false or overbroad.

MINIMAL_CLOSURE: Enumerate allowed Authority domains and the exact existing registry-internal ProducerSnapshot/DeploymentRegistryLedger emissions associated with only these two immutable Pending additions. Preserve the previous rows/history; assert no new READY, proposal, PASS, business completion or closure and no arbitrary Producer signing surface. Keep Builder/Reviewer/Verifier/Recovery synthesis forbidden. This is a design/test wording and accounting repair, not a new issuer capability.

## Positive dispositions and implementation constraints

- The exact two deployment-only IDs are concrete in `prospective-first-live-enrollments.json` SHA256 `3211d45eb163c25ae026d1be71c81ca9ac96359261c679d03f7a8fe37843d193`: DCP_DSH_WATCHDOG_ACCEPTANCE_V1 and WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DELIVERY_V2. They retain the original business Goal IDs, origins and contracts. Original Broker enrollment digest f8dedad84e805a8886fb85859767159ff6ac720b07b31412cbfdff52e43e8197 remains immutable. The Watchdog signed-child digest must be calculated from the actual new signed enrollment; no placeholder enters the registry. These are unsigned prospective templates, not persisted authority, readiness or business closure.
- Watchdog accepted lifecycle 0557bd9 and source d602b592fad345fb1c9adebe2bc6611a6f5cfdc2, and Broker 59472b631129d1ea3ca1202cbcbbc0799b083114 selection are explicit. This review does not convert plist source strings, the ordinary incident-slot hash, or the prior payload-selection decision into full current generation/health proof. Related Domain Create's proposed header remains disclosed; the actual Owner acceptance provenance must be pinned in the protected package, not invented in source.
- Two finite actions and separate one-use intents are an appropriate minimum. Both must revalidate all authority/current-state gates under the retained mutex, even if speculative checks occurred before it. An incomplete intent remains unknown; changing operation ID, deleting intent, replacing locks or reconstructing successful history is forbidden.
- The pending adoption configuration field must be durable before any usable active binding/proof. Every ordinary startup path must reject absent reservation/incomplete standing state, including each partial-publication crash. Retain immutable registry history and preimages; rollback cannot erase signed history or restore old routine authority without the explicit disposition required by §7.
- The conditional Owner grant must expressly cover both fixed actions, their one-use budgets, exact baseline/canary/standing conditions and the later separately listed service enablement effect. The historical disabled-install permission cannot supply this authorization. Still-valid current external grant and original acceptance are distinct evidence.
- The emerging crate-private `service::adoption::activation_inputs` is the right reuse direction: it consumes a held guard, checks current installed baseline, independently observes a genuine canary and requires the signed local-verifier PASS to match Goal, acceptance revision, unit, attempt, target generation and service generation. Returned data are coordinates, not caller-supplied PASS. This is an in-progress interface inspection only, not source approval. Its final implementation and fixed conditional constructor need exact-source independent review; no raw SQL or public proof constructor should be added.
- Existing Observer/Issuer own real Verifier/Builder/Reviewer roles. No parent Agent's report is signed as independent PASS. Actual baseline is attempt 0/zero installs/zero restarts and retains truthful origin; current same-target prerequisite evidence and late read-only acceptance remain bounded by the separately reviewed adoption design.

## Complete currently known first-live boundary union

FM-01/FM-02/FM-03 are the frozen blockers of this materializer design. The following remaining operation gates are retained explicitly, not represented as additional speculative Product gaps:

1. Finish/review the exact one-operation login recovery source and its future operation package. Original login remains unknown; no retry of the old sealed command. The completed disabled installation is retained.
2. Close the three design findings, implement the finite lifecycle/materialization composition, and obtain exact-source tests and independent review. Main adoption/native observer source is still separately under implementation/review; its earlier design PASS is not source PASS.
3. Freeze the complete actual protected face, Node closure and service configuration; validate service identity, catchup option, metadata, legacy retirement, all lock families, denial and rollback evidence. An observation or prepared artifact cannot stand in for executed evidence.
4. Use real canonical build, isolated reviewer login and genuine source review. Bind both immutable deployment enrollments and protected policy, preserve old Broker history, and prove existing issuer preparation can produce the exact candidate without stale-source/draft substitution.
5. Pin the real approved Watchdog canary invocation and semantic observer, demonstrate current baseline/canary PASS and current dependency binding, then conditionally complete standing activation. Never infer this from tests or a materialization receipt.
6. Before the single exact Owner authorization, recheck actual Broker preimage and competing V7/other writer state plus current upstream compatibility. If the same complete target was already delivered, use truthful zero-additional-install acceptance or re-freeze the remaining obligation; do not manufacture a deployment.
7. Only that next explicit Owner package can authorize legacy effects, closure provisioning, controller update/enablement and the first real deployment. It must state exact digests/identities/effects, existing-task impact, canary scope, failure/unknown recovery and Owner action. No such execution permission is provided by this review.

No new unrelated target, generic enrollment/signing RPC, issuer platform or business-Goal management is needed. After the bounded design repair, re-review this frozen union and directly changed evidence only; the final controlled operation still requires its complete applicable matrix. Parent Goal and first automatic loop remain incomplete.
