# Independent bounded design rereview: FM-01/02/03

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
FROZEN_BLOCKER_UNION=FM-01,FM-02,FM-03
FM_01=CLOSED_AT_DESIGN_LEVEL
FM_02=CLOSED_AT_DESIGN_LEVEL
FM_03=CLOSED_AT_DESIGN_LEVEL
NEW_DESIGN_SHIP_BLOCKERS=NONE
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO_FOR_THIS_FROZEN_SCOPE
IMPLEMENTATION_ALLOWED=YES_NONPRODUCTION_ONLY
SOURCE_REVIEW_PASS=NOT_EVALUATED
OPERATION_ALLOWED=NO
FIRST_REAL_AUTOMATIC_DEPLOYMENT_COMPLETE=NO

The reviewer did not author the parent materializer/lifecycle/canary execution designs and performed no root, service, endpoint, key, login or production operation. The reviewer authored the separate baseline/observer consumer and therefore does not independently approve that consumer here; its source is undergoing a different review. This rereview assesses the parent's finite producer, custody, queue initialization and operation choreography against the frozen FM union and directly affected accepted contracts. It is not a source or package security PASS.

## Exact reviewed coordinates

Accepted authority remains PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 semantic revision `39865536ce51005f95a98473e77c2329078512c0`, especially CTR-DCP-004/007/008/009/015/017/018/020 and migration §7. The original independent report `first-live-materialization-design-review.md` is retained unchanged. The current reviewed design files are:

| File | SHA256 |
|---|---|
| first-live-materialization-design.md | fd7ef71aa5231a37c19e6d4f68d0b66f3736bed5b00bc6fb599b2d780be57068 |
| first-live-lifecycle-operator-design.md | cc8267b3aaa012f93c70a0fc001693410c746dd598a1943708a054bb483bac79 |
| first-live-canary-operation-design.md | c658ab3e45ee38fa4f9656cd085478025393fd151977f8dcc9983f7b389d8ad0 |
| legacy-lw-executor-authority-impact.md, supporting impact record | eeb47da7c09cdde6798444b41b9ceb8dc4274b3bec6e814fd23fc0d31ed0b115 |

The lifecycle hash supersedes its earlier design hash only to explicitly require one operator process to borrow the same MutationGuard through crate-private issuer/adoption/observation/verification/activation calls. Standalone one-shot CLIs are not spawned while that guard is held, and no string/FD lock-inheritance escape is introduced. This closes a concrete self-blocking composition ambiguity without changing accepted mutex semantics. The final designs additionally place the finite fixed-root `--first-live` action in the exact reviewed `agent-deployd` binary: helper and controller bytes are identical. This preserves the current-executable/controller SHA binding instead of weakening it or spawning a second lock owner; selecting the first-live action does not start normal daemon/socket workers. The effectful operation still requires the one exact external Owner grant and does not accept caller payloads or paths.

## Frozen blocker dispositions

**FM-01 — closed at design level.** The companion lifecycle design now names a real finite native execution producer, rather than accepting a root-owned claim. It pins the target/app/harness/private Node closure, actual startup policy, original legacy entries, caller/service identities, four legacy lock families and parent-directory/ACL/link metadata. Each permitted transition has pre-effect durable intent, owned bounded effect, typed actual observations and fresh readback. The receipt is generated from those executed records and reconstructed mandatory postconditions, not copied from an Agent-authored PASS. Partial/unknown intent is not replayable; another attempt ID cannot replace it.

The observed unsafe `lw-pilot-executor` bridge is retired in full at its exact installed path; preserving its non-deploy root execution branches would leave a reachable writer outside the mutex. The design's source/installed wrappers, effective sudo/include graph, alternate lifecycle managers and actual denial probes remain mandatory. Full installed refusal-stub/ancestry readback plus unchanged sudoers and no alternate executable path can satisfy CTR-DCP-018; merely labelling the NOPASSWD rule retired cannot. Fixed actual service-domain probes distinguish permission denial from absent-label/invalid-command errors. Their possible unexpected effects and exact availability recovery are explicitly inside the future Owner operation, not asserted harmless.

The real canary companion fixes the no-effect canonical creator and exact CAS cleanup under the service identity. It retains the old historical plan/ACCEPTED records, creates only the grant-scoped immutable plan/readback chain, waits for the frozen future creation window without rewriting timestamps, performs one creation, requires genuine durable success/noop and Router admission, cleans only that proven job definition, and then captures after evidence. Existing intent consumes its budget; timeout, unknown, wrong generation or missed deadline never creates a second attempt. The fixed Node/script/import closure, environment, identity drop and inherited-descriptor boundary are source-review obligations. No mutable/candidate JS, Python or shell is run as root by this design.

The reviewed recovery contract preserves exact code/metadata/Node/legacy preimages as evidence but does not make restoration of retired routine writers automatic. The final package must enumerate which safe matching postimages may be restored at each failure edge, keep DCP disabled, and expressly disposition any possible legacy-authority restoration. No recovery may erase queue/history/unknown records, replace a permanent mutex, or restore caller-writable root execution. These constraints already follow from the design's stop/recovery sections and accepted §7; they remain mandatory implementation and exact-package checks, not a grant to perform them now.

**FM-02 — closed at design level.** The exact completed-genesis prestate is now distinguished from arbitrary absence. Under the same permanent mutex and durable pending operation, the initializer must prove the DB and WAL/SHM/journal plus first-target history absent, record its sole intent, call the existing secure Queue/mailbox primitives, fsync, and verify the expected empty schema. Existing/partial/corrupt/unknown state stops. Ordinary daemon startup is not used to obtain this initialization, and no missing-state reset/import fallback exists. The configuration fence must be durable before any enabled binding/proof becomes usable; every partial publication edge is included in the specified crash matrix.

**FM-03 — closed at design level.** The privilege/output accounting now includes only the exact Authority signature domains plus existing registry-internal ProducerSnapshot/DeploymentRegistryLedger emissions for two immutable Pending additions. Old rows/history remain intact. No Producer READY, Build, Review, Verifier PASS, recovery proof, closure or business completion is synthesized. Genuine independent review and native semantic observation retain their existing role custody. No generic enrollment, signing payload or role-selection interface is introduced.

## Required Owner operation decision: temporary baseline-supply vehicle hold

The external owning authority was read directly at `/Users/yanfenma/workspace/project/pca-auth-pilot-v1/docs/auth-pilot/candidates/LIFE_WORKBENCH_BASELINE_GRANT_SUPPLY_V1.md`, raw SHA256 `916c119a6585f67a520d58d0e556609de41ca6d95a25eea98fbab27d7401d296`. It records `OWNER-LIFE-WORKBENCH-BASELINE-20260908-01`, standing eligible-agent entitlement, rerunnable plan/apply/verify reconciliation and no per-Agent Owner approval. It does not require the unsafe installed NOPASSWD executable path itself.

Recommended concrete decision for the single exact future package: approve retirement of the complete pinned unsafe executor and an explicit temporary operational hold on that old supply/probe vehicle. Preserve every existing grant, identity, audience, selector and standing authorization. Existing grant use is outside this write set; future invocations through the retired vehicle will fail. Resumption must use the unchanged entitlement authority through a safe separately reviewed operational vehicle, not restore the caller-writable root bridge or add per-Agent approval.

This is a substantive availability tradeoff and must appear in the one Owner request together with dsh maintenance/restart impact and recovery constraints. It is not waived by this review, is not yet authorized, and must not be described as “all existing capabilities unaffected.” The reviewed code preparation may proceed without inventing an auth platform. If an applicable active owning contract requires uninterrupted supply, re-PREFLIGHT before activation; the current reviewed document does not establish such a continuous-service guarantee. No normative entitlement repeal or permanent deprecation is approved here.

## Next permitted engineering and remaining gates

The parent may implement and test the finite design under the existing nonproduction mandate, preserving all original completed Spec/implementation/history. Required evidence is the declared negative/crash matrix, actual descriptor-safe and identity-drop behavior, exact output-domain accounting, one-mutex composition, conditional standing activation and independent exact-source review. Fixture fake effects are never production observations.

Before actual execution, the package must still freeze all real protected preimages/loader and link inventories, effective privilege/lock/writer dispositions, probe argv/results, safe recovery edges, authentic login recovery, actual release review and exact canary timing; then obtain the one explicit Owner authorization including the temporary supply-vehicle hold. The prior disabled-install permission does not authorize those effects. First real automatic deployment and the parent Goal remain incomplete.
