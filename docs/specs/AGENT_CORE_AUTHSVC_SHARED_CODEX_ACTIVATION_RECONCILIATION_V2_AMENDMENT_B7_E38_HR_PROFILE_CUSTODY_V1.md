---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E38_HR_PROFILE_CUSTODY_V1
status: accepted
parent_spec: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E38_FIXED_RECOVERY_AND_RETIREMENT_V1
parent_spec_sha256: 43f5751432b3db13187171f43defebefe27a62535ee14e12ded958e7403fceba
parent_accepted_proposal_sha256: b8db5eb5c9624a54a555958f8ad1bbd43e6c45f8af78ab6d6a301932826b85fe
accepted_proposal_sha256: 6f2850b6433d1baf98aef987404bd2220e0e10b3b9501164e6dae898e1b49916
accepted_proposal_bytes: 10699
accepted_at_utc: 2026-10-18T13:16:19Z
accepted_by: original_delegated_B7_technical_decision_actor
accepted_by_thread: 01a1378d-e052-7021-9992-f0760eb9f9e7
human_owner_signature: false
original_sole_production_writer: 01a1437b-f9f3-7a33-a253-8f7fce9459f3
acceptance_source: /Users/yanfenma/Documents/Codex/2026-10-16/b7-v50-continuation-audit/codex-e38-cohort-binding-repair/hr-profile-custody-delegate-route/DECISION.json
acceptance_decision_receipt_sha256: ddd878767e133147c17ca1c8a0d0fb2e1597c5c676fb0623922f1d9f40064f2b
acceptance_issue: https://github.com/mayf3/agent-control/issues/424#issuecomment-6250367577
proposal_only_review_sha256: 8d4913c9bc94c6689d33f1c07b2681ac0c5ca206cc0bcb420a7979ed369158e5
proposal_issue: https://github.com/mayf3/agent-control/issues/424#issuecomment-6250336603
fixed_operation_id: b7-packet-r37-de3ddf955a9c5d94-e38
fixed_transaction_id: tx-ded7ad334d9246eb9f07e3c36a524d96
implementation_authority: finite_accepted_delta_after_this_separate_governance_commit
production_apply_authority: original_sole_writer_after_affected_implementation_review_and_actual_original_predicates
proposal_preserved: exact_original_bytes_between_markers
explicit_parent_reference_erratum_included: true
---

This separate docs-only record preserves the exact unconditional delegated
technical acceptance. The historical PROPOSED status inside the preserved body
is not this Spec's status. The actor is the original B7 technical delegate,
not a human Owner signature, implementation reviewer or production writer.
Acceptance is not implementation PASS, production admission, recovery,
retirement or business delivery. No new confirmation or writer is added.

The acceptance explicitly corrects only the unambiguous parent-reference
transcription in proposal line3 and the proposal review's parent hash. The
49-character string `b8db5eb5c9624a54a555958f8af78ab6d6a301932826b85fe`
is invalid and must never be used as a pin. The authoritative 23226-byte parent
body SHA256 is `b8db5eb5c9624a54a555958f8ad1bbd43e6c45f8af78ab6d6a301932826b85fe`.
It is exactly embedded in the accepted parent wrapper SHA256
`43f5751432b3db13187171f43defebefe27a62535ee14e12ded958e7403fceba`.
This explicit erratum is part of the delegated acceptance; the original
proposal, proposal review and parent body remain unchanged. It introduces no
other semantic change or new review/Owner gate.

Backlinks: [fixed E38 parent](AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E38_FIXED_RECOVERY_AND_RETIREMENT_V1.md),
[parent reconciliation](AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2.md),
[original PDC](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md),
[Stage Isolation](PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1.md),
[exact proposal and proposal-only review](https://github.com/mayf3/agent-control/issues/424#issuecomment-6250336603),
and [exact delegated acceptance and erratum](https://github.com/mayf3/agent-control/issues/424#issuecomment-6250367577).
Implementation must not edit this governing body. The original operation,
no-replay discipline and remaining original predicates remain binding.

<!-- BEGIN EXACT ACCEPTED PROPOSAL -->
# Fixed E38 HR profile custody delta

Status: PROPOSED. This text requires the original qualified B7 technical delegate's exact acceptance and the existing docs-only accepted-governance record before implementation. It is not an implementation PASS or production admission. The parent accepted body remains unchanged: `PROPOSED-E38-FIXED-RECOVERY-AND-RETIREMENT.md`, 23226 bytes, SHA256 `b8db5eb5c9624a54a555958f8af78ab6d6a301932826b85fe`; accepted wrapper SHA256 `43f5751432b3db13187171f43defebefe27a62535ee14e12ded958e7403fceba`.

## 1. Fixed subject and new evidence

Only operation `b7-packet-r37-de3ddf955a9c5d94-e38`, TX `tx-ded7ad334d9246eb9f07e3c36a524d96`, original attempt1 and original holder/peer/policy/recovery protocol are in scope. The original mutation call returned a definite `BINDING_MISMATCH`, with no transport error; it was not resent. The five recovery-record paths were then absent and original native/holder/fence/execution byte hashes remained unchanged. This does not claim all-system zero writes or erase the control publication or earlier operation effects.

The once-only read-only diagnostic, source `33635162e875537f79839acb8cef5fb97c2b2991983886f0277a750eecf59ecf`, returned after 202.249 seconds. Output SHA256 `6cdfdfd15a6738193c79b33e7e5b57e5d28304f6a2ae307f2d047696b27c380e` proves its current `initial_readonly_flags`, `fixed` and `batch_check` passed and the first refusal was `observations:530`, HR/profile. Native, holder and original execution bookends matched in bytes and metadata. It omitted the original children, lease, quiescence and full Node consumer proof; it is not recovery PASS and not an observation of the earlier failure instant.

The only leaf admitted by this delta is:

`/Users/authsvc/.agent-core/homes/agt_hr-agent/profiles/agent-core-production/cordis.patch.yml`

The original native SHA256 `b0bd0798dd92fe9ea42bbb854253cb6f413a53d4a25e721a04a1dd509ab4ec3f` records HR/profile pre and post identically: regular file, UID502:GID20, mode0644, path equal to realpath, SHA256 `2a07dfdabf484007f3a0276505a6fff4126d68180d0dd39ef1a84dce1861670a`. The fixed fresh leaf readback SHA256 `238d9770b047cb9057f171a4c04f62d3d358849eec864924f54ef8883849c84e` observed UID505:GID20, mode0644, regular single link, 2337 bytes, device16777233, inode214887291, with exactly that original content SHA and equal stat bookends. Thus UID is the demonstrated original-observation mismatch; the helper and original checker correctly refused it.

The previous 42 non-six profiles passed in the diagnostic. A separate metadata-only projection of the remaining 49, SHA256 `707a7b1e63937a187470985f2fd28b7dc04241e2f511022d35f22c6047f0143a`, found no other profile metadata difference. These are separate timed observations, not an atomic fleet snapshot or proof of the remaining dependency contents. All unchanged original consumer predicates remain mandatory.

The independently reviewed gap is `CURRENT_UID_DRIFT_CONFIRMED_NO_EXISTING_REPAIR_AUTHORITY`, receipt SHA256 `7282c1d072f3042e4a5009e42a372ccaaaa0faebf75fe1ed2b5e3946fd8bbeb3`. The parent requires unchanged non-six preconditions and permits neither this exception nor automatic chown. Same-byte temporary-file/rename behavior exists in the frozen provisioning code, but source mechanism and timestamps do not identify the historical writer. That identity remains UNKNOWN; acceptance of this exact current scene does not fabricate it.

## 2. Selected finite treatment: preserve the observed leaf

Accept only this fixed original-operation recovery's observed UID505 profile, using the exact tuple above. No chown, chmod, rewrite, rename, deletion, provisioning, permission grant or new public action is authorized for the profile or other non-six objects. Do not edit the saved native/cohort/pre/post observations, original registration/execution, original holder/nonce, journal, false fence, stage/stamp or old receipts. Do not change HR source `event-correlation.js` SHA256 `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc`.

The new helper must recognize the original HR/profile observation exactly, including original UID502, not accept arbitrary old values. Every use of `RecoveryScene.observations` checks this same fixed leaf through the original no-follow/held-FD path discipline, original path/realpath, regular/single-link shape and stable read. Require UID505, GID20, mode0644, 2337 bytes, the fixed device/inode and original content SHA. Reject any other change. Record the original expected tuple and actual admitted tuple distinctly in the new sealed scene/AUTH lineage; do not replace original evidence.

All other consumers, including HR's other roles, the 49 later agents, canonical credential metadata, dependency closures, six targets, code/config/plugins and registry retain their original predicates. Do not read credential contents. No global rule accepting either UID502 or UID505 is permitted. This fixed exception is not an exemption from the rest of HR's consumer proof or authority to restore another leaf.

## 3. Full original consumer call and later proof connection

The exact Node checker `cohort-binding.mjs` SHA256 `2c1484006c5d1b80e9b85c527d8bc1641ac75557a8e1117fcf5fb988ca0d1cf4` remains unmodified. In the finite E38 pre-consumer adapter, first run its original `assertCohortBinding` against the original native cohort and original holder's cohort digest. Validate the unique fixed HR/profile pre row against the original observation and validate the current fixed leaf as above. Then make an in-memory deep copy and change only `consumers['agt_hr-agent'].pre[role='profile'].uid`, from502 to505. The post row remains502. Invert that single change and require whole-object equality with the original cohort; refuse any missing/duplicate row, additional difference or different identity/path. Neither cohort object is written to production.

Calculate the projected digest with the original exported `cohortDigest`, and pass the copy plus that digest to the original full `verifyCohort`. Preserve its actual arguments: phase/pre, consumerPhase/pre, runtimePhase/quiesced, original root/config/registry/candidateRoot and full consumer set; do not disable consumers or substitute a loader or synthetic runtime. The original digest must first verify the original object, and the projected digest must verify the projected object. Never label the projected digest as the original native/holder/policy digest. Preserve the original route, registry, migration, source, artifact, evidence and runtime bindings byte-value identically. Record both digests and the single-field projection separately in the bounded child/AUTH proof.

The parent sequence still requires actual service quiescence and this complete original pre-consumer call before SIX_INTENT and any inverse. Running and after-six continue the existing original `readBoundRuntime` with codePhase/pre plus `RecoveryScene.observations`; the same exact leaf exception must apply there and in initial/post proofs. No second exception is added to native terminal verification, participant tools or client protocol. Original native/cohort bytes and original cohort seal remain unchanged throughout.

The separate five-material retirement still starts only after real recovery terminal, normal original-holder release and warm same-DS overlay readback. Its final actual checkpoint/config remain to be bound from real legally completed evidence. Mechanically inspect the actual checkpoint's affected profile references: the existing template has no HR profile owner predicate, but a future actual binding containing an old502 expectation for this leaf must be exposed and joined to this exact admitted scene rather than silently overwritten. Do not rebuild or relax unrelated checkpoint predicates or historical sources. A later genuine candidate takes its own current snapshot; this delta is not a general profile-owner exception for subsequent operations, nor a requirement to reconstruct old mutable HR history after a proved completed recovery.

## 4. Implementation, admission and unchanged recovery limits

Reuse the original author and non-author review chain. Implement only the fixed helper's leaf predicate and original Node adapter projection, exact accepted-body/scene/AUTH bindings and necessary mechanical host/pair/authority/executor/pin/capsule joins. Preserve original source inverses and all untouched cases. The paired request remains the same existing action and operation; no selector, new service permission or new writer is introduced. Do not change the original Node checker, consumed package, old native fields or current filesystem leaf to make a check pass.

Necessary affected verification covers the single-field projection and whole inverse; original-seal mismatch; wrong projected digest; duplicate/missing/wrong profile; a second altered consumer field; each changed fixed-leaf type/custody/content field; another non-six drift; and the initial/pre/after-six/running connections. Use the original checker in the affected compositions and keep modeled versus actual identity/scene coverage explicit. Reuse unchanged PASS at its exact scope. Remaining read-only tail observations may be completed without replaying the already-passed fixed/batch/earlier-consumer checks; no partial tail PASS substitutes for the original guarded recovery preconditions.

After exact delegated acceptance, docs-only accepted record, affected implementation review and final sealed load/binding are complete, the original sole writer may make one new explicit same-operation recovery call under the unchanged original contract after fresh required admission facts. This is a corrected fixed recovery call following the known deterministic pre-intent refusal, not normal APPLY replay, a new attempt/operation or an automatic mutation retry. Preserve the failed call/output and require the original fixed driver to send only once, then STATUS. An unknown response or dispatch retains the original subject and receives only allowed status/observation or proved deterministic continuation; never resend the inverse or clear the holder/fence.

All original mutex/OFD/FD9, actual quiescence, six-target inverse, durability, native state progression, service restoration, normal release, warm overlay, retirement order/FINISHED-last and 50GiB floor/remaining-budget requirements remain. Prior five-record absence and readonly bookends are not a replacement for fresh contract-required checks. Recovery/control/retirement count zero business versions. The original two genuine business deliveries, transaction-bound Feishu response, delegated submission and applicable final gates remain unfinished.

<!-- END EXACT ACCEPTED PROPOSAL -->
