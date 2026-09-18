# Independent bounded design review: prospective inputs and executed proof

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
REVIEWED_DOCUMENT=first-live-observation-derived-fields.md
REVIEWED_SHA256=1126abc296fd5325e76c2a58d2015fdd0a75bfb59e8f5bd3f32f21b69bdedaf9
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO
FROZEN_NEW_DESIGN_BLOCKER_UNION=NONE_IDENTIFIED
SOURCE_REVIEW_PASS=NOT_EVALUATED
PRODUCTION_OPERATION_ALLOWED=NO
PRODUCTION_OR_PRIVILEGED_ACTIONS_PERFORMED=NO

Independent reviewer did not author this clarification and recomputed the frozen document hash. Scope is the concrete materialization ordering cycle: the exact offline package precedes execution, while an admission NativeEnrollment requires lifecycle_denial_digest and SocketAncestor requires denial_receipt. Existing bootstrap/socket.rs validates the receipt digest and exact physical exception; bootstrap/binding.rs also requires lifecycle proof. A future proof cannot truthfully be supplied as an already executed value. The accepted Spec CTR-DCP-004/007/009/017/018 and existing materialization design require actual evidence, fixed privileged effects and pending admission rather than a digest-shaped placeholder.

The proposed private templates resolve that cycle without changing admission semantics. They freeze all physical/identity/service/loader inputs and omit exactly the fields that must arise from execution. Strict unknown-field rejection must also reject an explicitly provided derived field, not merely ignore it. The later constructor must preserve the exact reviewed template values and insert only the actual durable operation-bound observation references from the private VerifiedLifecycle. It must not deserialize that proof from caller JSON, accept an imported PASS, reconstruct a completed proof after a partial/unknown run, or materialize a dummy enrollment for early calls. Config/grant/enrollment digest calculation follows those real constructed values, so the package remains an input authority binding rather than a prediction of signed outputs.

The finite maintenance type is legitimate REUSE: the Owner operation necessarily quiesces/restores the original group before the final lifecycle denial can be observed. Its internal fixed-input route reuses native parsing, original flags/argv/identities, phase-correct loader verification and process-absence/ExitWatch checks under the same mutex and exact operation grant. It is not available to ordinary payloads and cannot authorize a new transaction, admission, another target or a standing service. Final source review must verify those actual visibility and construction restrictions; this design verdict does not treat a Rust type name alone as proof.

The pre-execution socket check is limited to the already accepted canonical /private/var/run exception: root:daemon0775, exact device/inode, no ACL/flags, fresh excluded daemon-group memberships for every applicable non-root identity and the existing dedicated child metadata/identity. The current socket implementation separately checks those physical conditions and the receipt field. Reusing the physical part with a template does not create a receipt or relax generic ancestor validation. No chmod, group mutation, alternate path or additional trusted-ancestor exception follows. The actual admission SocketAncestor still undergoes the full existing validation after executed proof exists.

The frozen negative tests are sufficient design requirements: reject caller-derived fields, missing/failed/partial observations and unsafe or drifting physical prerequisites; prove exact template preservation; prevent maintenance from producing admission state. Final integration must also bind the same host, operation/package, guarded actual postimage and durable successful lifecycle observation before constructing proof-bearing values, and keep pending activation installed across every partial publication. The separately reviewed source components remain separately bound; no source implementation or production evidence is inferred from this design note.

No load-bearing accepted-contract gap or new platform capability is needed for this narrow ordering correction. No independent source, package or first-live readiness PASS is asserted here, and no production/root action was performed.
