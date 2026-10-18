---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E38_FIXED_RECOVERY_AND_RETIREMENT_V1
status: accepted
parent_spec: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2
parent_spec_sha256: 7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753
accepted_proposal_sha256: b8db5eb5c9624a54a555958f8ad1bbd43e6c45f8af78ab6d6a301932826b85fe
accepted_proposal_bytes: 23226
accepted_at_utc: 2026-10-18T11:05:59Z
accepted_by: original_delegated_B7_technical_decision_actor
accepted_by_thread: 01a1378d-e052-7021-9992-f0760eb9f9e7
human_owner_signature: false
original_sole_production_writer: 01a1437b-f9f3-7a33-a253-8f7fce9459f3
acceptance_source: /Users/yanfenma/Documents/Codex/2026-10-18/three-session-followup-0743/E38-ORIGINAL-TECHNICAL-DECISION-20261018.json
acceptance_decision_receipt_sha256: 1c53e90de68bbdb60302c261881b46fae5b598830a45a1fb5d33addd2e5dc9d7
acceptance_issue: https://github.com/mayf3/agent-control/issues/424#issuecomment-6249098066
proposal_only_review_sha256: 0448325fe77b288feec1ae2838b6878fe9ac39fa4eacc4243266c62f2711b04b
proposal_issue: https://github.com/mayf3/agent-control/issues/424#issuecomment-6249026028
fixed_operation_id: b7-packet-r37-de3ddf955a9c5d94-e38
fixed_transaction_id: tx-ded7ad334d9246eb9f07e3c36a524d96
existing_admin_delegation_sha256: 06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57
implementation_authority: finite_accepted_delta_after_this_separate_governance_commit
production_apply_authority: original_sole_writer_after_affected_implementation_review_and_actual_original_predicates
proposal_preserved: exact_original_bytes_between_markers
---

This separate docs-only record preserves the exact unconditional delegated
technical acceptance. The historical PROPOSED status inside the preserved body
is not this Spec's status. The actor is the original B7 technical delegate, not
a human Owner signature or authority borrowed from Auth/Mac or another subject.
Acceptance is not implementation PASS, production admission, recovery,
retirement or business delivery. No new confirmation or writer is added.

Backlinks: [parent reconciliation](AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2.md),
[original PDC](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md),
[Stage Isolation](PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1.md),
[fixed e37 primitive precedent, not transferred acceptance](AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E37_TERMINAL_MATERIAL_RETIREMENT_V1.md),
[original proposal/review](https://github.com/mayf3/agent-control/issues/424#issuecomment-6249026028),
and [exact delegated acceptance](https://github.com/mayf3/agent-control/issues/424#issuecomment-6249098066).
The accepted subject includes real recovery before retirement; original attempt1
and its records remain distinct from the new recovery terminal. Cold or unknown
completion is not fabricated. Implementation must not edit this governing body.

<!-- BEGIN EXACT ACCEPTED PROPOSAL -->
# Fixed E38 same-TX recovery, terminal-material retirement and successor preparation

Status: DRAFT FOR THE ORIGINAL QUALIFIED DELEGATE. This unique proposed body is not accepted, an implementation/review PASS, production admission or a terminal receipt. It supersedes the earlier closure drafts as the proposed text only; preserve those drafts and all evidence. Do not implement this new fixed recovery before exact delegated acceptance and the repository DEVELOPMENT_PREFLIGHT. Keep the original Goal, sole production writer, restricted management chain and delegated actor; no new platform, scheduler, executor identity or Owner signature.

## 1. Exact subject, governing boundaries and evidence

Only OP `b7-packet-r37-de3ddf955a9c5d94-e38`, TX `tx-ded7ad334d9246eb9f07e3c36a524d96`, original holder nonce `6d2bbec007e2db70448c123c38bccb7f`, cohort seal `23ea68463b4188e2d1bfdd8dfa4d59648e0a69d3f793ea0d83646f03656d6a95` is eligible. This is continuation of the consumed attempt1, not EXECUTE replay, a new TX or a business release. E35/E36/E37 authorizations and receipts cannot authorize or prove E38.

The accepted reconciliation Spec `7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753`, PDC Spec `c46b84ef91637a88929dd0f297bfb794ca80ee6b2719f495f90d0034aaa84e25`, Stage Isolation Spec `715394d773593b56cc399087a4151d3a44290f972db427cf63449c64f798d28b` and existing restricted delegation remain governing. Reuse accepted E37 body `f73b70f0d27c0ec9c8bd429f3055824c4757e886b34a4aabc03152400a543544` only for unchanged finite retirement primitives; E38 needs this independent subject and its real recovery-record ABI.

Saved evidence is under `codex-e37-terminal-material-retirement/actual-release-e38` (O), without another live scan:

| Saved receipt | SHA256 | What it proves / limit |
| --- | --- | --- |
| POST-RETURN-FIXED-SCENE.json | f4e8fb081620ac3086ce5c752a8908410fa87ff845b7a0ccf71738702c915382 | Original return rc1; native MUTATING_FENCED with activation.restored=true; original DS RETAINED/attempt1/input0/no pending/terminal_output=false; retained SEALED holder; same-TX false fence; saved restored-service health. Not six-target completion. |
| RETAINED-STAGE-BINDING-PROJECTION.json | f4d93884c3d3bddb3cf6407da1c949d0ef1b970c1b131df3ac64d46fb01778b6 | SEALED stage, native, holder and TX have the same cohort/nonce/path binding; scope receipt still matches. The seed is not the SEALED stage record. |
| POST-RETURN-HOLDER-RUNTIME-IDENTITY.json | 48d1f274101ce0292a726fad54a3aa869f4bd2dcad8ca394563e74514c0e8ba1 | Saved empty holder-lsof and restored original service identity. Not acquisition of the native OFD. PID75674 is historical evidence, not a future fixed PID gate. |
| GENERATION-EXACT-DELTA.json | db221aac6ca6ccb44d407296fa377db96993eb79920a28790d0d3bb449932bb4 | Original treeDigest calibration and one exact added stamp row; not permission to delete it or rewrite sealed input. |
| RETAINED-SIX-BATCH-SAFE-NAMESPACE.json | a5265f8d77304546f5350ed93696efc90a48783a0261d702c74b5ce92776a13c | One 23,087,288-byte manifest read: six PARTIAL targets, pending=false, each 21,739 file records/11 created entries/3 preimages. No actual file hashes or restoration were performed by that read. |

Original native SHA is `b0bd0798dd92fe9ea42bbb854253cb6f413a53d4a25e721a04a1dd509ab4ec3f`; retained execution SHA `c48644d6fa0ffb9ae449fdb3554ade6fd63bd540b17c5ddf7783d47a813c58e5`; holder SHA `c0fce1c896f44de72b657600c96726bd1b332dedaf9ac14c78cc17a1df7c74e7`; false fence SHA `3b8aaae26206488c229a40aec49b8049aa7f091130dfb9d3aca788a70f47aae2`. Original execution policy SHA is `35c766ebea7bb61a12576f7ff9783386f616108656fa330d659cbf27495d47c3`. Bind original registration raw bytes independently; its request_sha256 `b85b1198b5b2456356a325c0d37933e5a5fa0e01386a861422a51ce819cc6e30` is not a substitute for its raw-file SHA.

The batch byte SHA is `0dc0d48ad25194b489be49af788a41e9a71f222f81fc40ed00b9047a6ba95773`; its journal SHA is `9d66242a1093259af92c1dc0792eadbdb2a0b42d54fec54f78405f5e628e904a`, not the batch SHA. Preserve current journal/history; never reset to an earlier E37 or E36 hash.

## 2. Selected executable protocol and sealed source admission

Use the existing formal DS request exactly `{"action":"B7_PACKET_RECOVERY_ABORT_V2","operation_id":"b7-packet-r37-de3ddf955a9c5d94-e38"}` from the original authorized UID502 peer. Add only a fixed E38 dispatch to the existing recovery/overlay hooks, mirroring `install_e35_recovery(ds,e,source_sha256)` and `recover_fixed_e35(e,r,peer)` in sealed `v54_e35_recovery_source.py:652-750`; choose the concrete E38 names `install_e38_recovery` and `recover_fixed_e38`. Every other OP/action keeps its previous handler. No caller-selected TX/path/program/source/state or Owner terminal input is accepted. A fixed delegated driver performs original STATUS, one RECOVERY request, then STATUS even after transport/error; it never automatically resends the mutation and never upgrades UNKNOWN merely because post-STATUS shows a terminal.

The root-trusted assembler, not the request, supplies the actual reviewed helper SHA. Seal helper, host extension, fixed driver, original input/tool closure, necessary exact E38 policy and paired client through the existing authority/pin/capsule/restricted loading chain, with original source inverses and post-load readback. Preserve consumed source/seed/records and original guard/tool bindings separately from the new helper seal. Do not make new bytes pass as the original consumed source. Any required host/pair loading must use its existing publication contract and preserve original custody/worker exclusion; no arbitrary root shell, writable privileged script, sudoers expansion or ad-hoc daemon replacement. Keep the same live DS instance from recovery through its completed overlay readback; after interruption/reload without reliable completed proof, return UNKNOWN rather than inventing a cold terminal.

Reuse the existing request schema, strict response projection and `recovery_terminal` shape. If the fixed recovery can use the existing <=7200-second policy, extend the paired client's existing 7260-second long-call rule only to this exact E38 OP+RECOVERY conjunction; other OP/actions and timeout/UNKNOWN/no-retry semantics remain unchanged. Do not use the Owner-terminal wrapper to simulate an Owner. Report helper role `FIXED_E38_RECOVERY_NOT_ORIGINAL_CARRIER` and the actual delegated executor.

Use the original DS in-process mutation mutex plus original global DS-OFD reservation. Acquire the existing native holder with no-follow, exact scene dev/inode/bytes/metadata/nonce and nonblocking exclusive OFD; independently prove a second open cannot acquire it. A saved empty lsof is insufficient. Hold original validated source/tool FDs. The exact guard child remains `/bin/bash <original frozen outerPath> b7-guard --transaction <fixed TX>`, launched with the inherited native FD duplicated to FD9 and original restricted environment, requiring exactly `B7_MUTEX_INHERITED\n`. Verify the original guard source and transitive bindings before and after child dispatch. Never unlock/replace a foreign holder. Guard rejection remains a refusal.

## 3. Durable original-operation recovery records and narrow exceptions

Reuse the existing record paths derived from the original execution path: `.b7-recovery-auth.json`, `.b7-recovery-progress.json`, `.b7-recovery-terminal.json`, `.b7-recovery-native.json`, `.b7-recovery-batch.json`. Record kinds remain `DS_B7_RECOVERY_AUTH_V1`, `DS_B7_RECOVERY_PROGRESS_V1`, `DS_B7_RECOVERY_TERMINAL_V1`; change only fixed subject/reason/role and necessary E38 scene detail. Use protected uid0:gid80/0600, EXCL establishment, exact prior-byte CAS, object and parent fsync, original no-follow/held-FD guards. Persist original native and batch snapshots before inverse intent. Preserve original registration/execution bytes and their pre/post hashes, including RETAINED attempt1, input_sequence=0, input_pending=null, terminal_output=false. Do not manufacture normal attempt2, normal terminal output, COMMIT, actor input or old carrier output.

AUTH binds accepted body/scene/source seals, actual original registration/execution/policy, expected terminalBinding, original holder raw SHA/bytes/nonce, original tools and source closure, native/batch/stage/seed/journal, six fixed IDs, generation/stamp exception and authorized run limits. PROGRESS binds AUTH and actual bounded child argv/source/rc/stdout+stderr byte counts/hashes, definite phase and dispatch uncertainty; secrets are excluded. The phase/attempt/terminal_output fields inside recovery progress are recovery records, not edits to normal execution history.

Only this restored recovery edge may accept native MUTATING_FENCED with activation.restored=true and the exact same-TX fence `{txId,inFlight:false,clearedAt:<original string>}`. Independently verify restored code/config/plugins and source identities first. Preserve the false fence bytes; do not write true to pass `tx_load`, weaken normal `tx_load`, or claim this is still an active mutation fence. Controlled recovery quiescence below is explicit and separately proven. Ordinary APPLY/COMMIT keep their original predicates.

Let generation G be `/Users/authsvc/.agent-core/control/codex-plugin-runtime/gen-b7-tx-ded7ad334d9246eb9f07e3c36a524d96-6d2bbec007e2db70`. Its one exceptional row is exactly `./node_modules/dsh-codex/.agent-core-artifact-identity.json`, regular single-link UID505:GID601/0444, 156 bytes, SHA `a0e1599bbdd3b767e918393c6360c94f6284d5d322f362bc0e4a966c65725dd7`, containing the saved sourceCommit `75d98d5b10bb926d53108e49019668c1bde2a9eb` and artifactSha256 `869b8e64095a796a0fe6cfbe7bc09e5cf49dfa35defba7b69d621cfec0d0290f`. Bind its actual inode/custody from the independently collected scene; do not invent them. Verify this row separately and, with only that row omitted from the original tree grammar, require remaining G digest exactly sealed `38b42a64fc6183981da39e4df8b3e9d89b35cba303d1aca89b4dbe09c0abce5e`. Actual full digest `a2d082af28961f0c5a00eab7009f3d76a4458a911ea41c177a94b924410e6307` and saved row-set SHA `24699cc0534ee19e100869a9a94b6911637b9cbbb2a01d4f5f297d89fa8c74ab` are evidence, not a new expected sealed stage. Require scope receipt SHA `6d2b17a0fadea0afa0be5c2905cd95f7ac4c7fc4334a9a8a615669164efbc1a3`. Reject any other generation/scope/metadata drift. Preserve the stamp and old stage; neither deletion nor resealing is authorized. This exception belongs solely to fixed E38 recovery verification, never normal prepare/apply/COMMIT.

## 4. Recover the outstanding six targets and reach a real terminal

The original normal route is unsafe to trial: outer d323f702:306-313 invokes recover-six-target before carrier abort; preparation db1977a2:246 dispatches it before verifyStage:247. Carrier ba571c77:795-797 then refuses MUTATING_FENCED+falsefence, and later tx_save:592 would fail original verifyStage:151 on the added stamp. Do not invoke blind normal RESUME/ABORT or delete the stamp to make it pass.

The fixed helper executes this one ordered chain under the above guards:

1. Read/verify original records, snapshot, actual scene and exact exceptions. Independently verify all original participant app/harness/Node preimages and live trees, config/registry/plist, plugin manifest/current/per-home restored predicates, non-six cohort members, source owner and HR. Saved restore PASS lines are useful lineage, not a replacement for these actual preconditions. Do not reapply code/config/plugin restore already proved complete. Separately admit the six still-PARTIAL objects and their exact original store/journal.
2. Establish AUTH/snapshots and durable QUIESCE_INTENT; use the original finite service-quiesce mechanism, restricted to the actually matched original runtime, and prove it stopped before six writes. Preserve the false fence; guard/lease/quiescence are explicit recovery controls. Do not stop unrelated services or rewrite healthy service configuration. A quiesce error/uncertain result retains same intent and original holder; no inverse is dispatched until quiescence is proved.
3. Establish SIX_INTENT. With original inherited FD9, invoke the original pinned Node/preparation callee `recover-six-target <fixed TX>` directly, once. Its guard and complete all-six poststate preflight stay strict. Fixed IDs are data-engineer, family-insurance-manager, investment-manager, lw-lifecycle-canary, machine-learning-engineer and technical-writer agent IDs exactly as the batch. Preserve original 21,739-file-per-target recorded hash/shape checks, 11 created entries, 3 preimages, protected namespace, foreign/pending rejection and capture-only preimage semantics. Only original six-byte restore/authorized created-entry cleanup/batch completion are allowed. The namespace receipt alone authorizes no inference of successful file checking or restoration.
4. Independently verify all six restored poststates, 18 original preimages and original created-entry absence, batch/batch.new absence, unchanged non-six and code/config/plugin proofs; sync actual objects/parents under guard. Require exact original inverse output `B7_SIX_TARGET_RECOVERED <TX> <JSON six IDs>`. Progress advances to SIX_COMPLETE only with both actual callee success and independent poststate. Never rerun inverse after unknown dispatch, even an apparent equal-byte no-op. A continuously observed reliable in-process completion may advance; a cold/partial state without sufficient proof remains UNKNOWN under the same AUTH/holder/records for original qualified recovery handling.
5. Only after restored postproof, allow native state progression MUTATING_FENCED → ABORTED_PENDING_RUNTIME_RESTORE → ABORTED_PENDING_FENCE_CLEAR → ABORTED, with updatedAt. Preserve all other native fields byte-value equivalently, including holder/outer/cohort, preparation/source/plugin/activation records; activation.restored must stay true, not be manufactured. Use original protected atomic write/CAS/fsync and whole-object inverse projection. No resetting inputs, editing a failed normal receipt or arbitrary native setter. Ensure the original restored runtime using original pinned service mechanism and actual code/config/plugin identity; no needless second service reconfiguration. Before final ABORTED, require fresh HTTP200/ok=true/deliverReady=true and original service/consumer predicates with restored six. Verify same-TX false fence unchanged; already false is a verified no-op, not a fabricated clear action.
6. Sync/verify final native ABORTED and every postproof, then normally release the original native reservation by the existing verified holder-unlink/empty-lock-rmdir/parent-fsync path; retain FD custody until that point. No `LOCK_UN`, manual clear or release after incomplete restore. Only after normal release invoke original `e.verify_terminal` using its E35 recovery-only local verifier input `dict(original_s, terminal_output=True)`. This local input is not persisted as normal terminal_output or presented as original carrier output. Require actual ABORTED/installed=false/current transaction SHA, original lock absent, fence and full restored proof. Original source/carrier terminal verification is not weakened.
7. Establish durable `DS_B7_RECOVERY_TERMINAL_V1` with AUTH SHA, actual verified terminal, identical original execution pre/post SHA and policy SHA; write TERMINAL recovery progress last. Set only the existing same-DS reliable completion proof. Return/read existing strict `recovery_terminal={native_state:'ABORTED',installed:false,authorization_sha256,original_receipt_sha256}` overlay, with ordinary phase/history still truthful. Require original single-call return and warm same-DS STATUS readback plus complete persisted records. Native ABORTED or helper rc0 alone is insufficient. If release succeeded but terminal persistence/proof failed, report that precise UNKNOWN; do not recreate a holder, rewrite original history or invent a completed overlay.

Use original bounded child I/O, process-group timeout/reaping and no-retry limits. Other than proved state-based read/sync continuation, errors keep original op/TX/AUTH/progress/holder/history and stop unsafe side effects. A recovery record, intent or visible file does not prove completed fsync/child effects. Preserve exact failed calls and output; no switch of executor or ID to bypass uncertainty.

## 5. Separate finite E38 five-material retirement

Only after section4's real completed recovery overlay, original normal holder release and complete readback may bind this phase. Reuse E37's reviewed finite DS-OFD plus new native material reservation, held tool/source FDs, no-follow paths, strict metadata/lineage, audit parser, same-intent continuation and durability primitives. Use a new material reservation nonce created durably for this phase; do not impersonate continuation of the released recovery OFD/nonce. One private no-argument restricted command `e38-retire`, helper `e38_terminal_materials_once.py`, entry/config/pins and outcome labels `FIXED_E38_INTENT`, `FIXED_E38_ADMITTED`, `FIXED_E38_MATERIALS_DURABLE`, `FIXED_E38_FINISHED` are fixed to this subject. No generic path/subject parameters.

Let M=`/private/var/db/agent-core/authsvc-codex-migration`. Only these same-parent preservation renames are permitted, in order, with destinations initially absent and no overwrite/merge:

| Canonical source | Fixed retained destination |
| --- | --- |
| M/migration-transaction.json | M/migration-transaction.e38-aborted-ded7ad33.json |
| M/b7-preparation-input.json | M/b7-preparation-input.e38-aborted-ded7ad33.json |
| M/migration-fence.json | M/migration-fence.e38-aborted-ded7ad33.json |
| /usr/local/share/agent-core/artifacts | /usr/local/share/agent-core/artifacts.e38-aborted-ded7ad33 |
| M/activation-code-input | M/activation-code-input.e38-aborted-ded7ad33 |

Codeinput is last; retain validated required FDs through their final consumers. Independently bind actual complete regular-file/symlink/directory inventories and actual dev/inode/owner/group/mode/ACL/xattr/flags under original grammar, not only top stat or a fabricated fullmanifest. The separately sealed actual scene may carry machine/Node/service-ancestor identities, as in the existing finite binding pattern; fill only measured values and retain inverse lineage, never stale E35/E37 inodes. File/parent fsync and exact held-FD→retained-history same-inode/bytes/complete-lineage proof are required before MATERIALS_DURABLE, then normal material-reservation release. Preserve AUTH/progress/terminal and original records, TX-specific accepted/preparation records, generation/stamp/scope/preimage assets, current journal and all historical sources.option/oldDisposal. Do not include the four old app residues or unrelated trees.

A partial rename/fsync/transport/restart or changed scene retains same intent/ADMITTED nonce/reservation/records/history and follows only the original proved deterministic continuation. ADMITTED+zero moves has no cancel/holder-unlink authority. A close closes only owned FDs. No second retirement, clearing locks, fabricated completion or unconditional cold historical replay. Preserve original audit order and lock discipline.

After material-reservation release run the original complete restored checkpoint, with all eight real canonical ABSENT predicates: codeinput, seed, batch, batch.new, native TX, fence, native lock and public artifacts. Recheck restored six, original code/config/plugin/runtime/owner provenance and protected HR `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc`. Bind the actual legally advanced journal and canonical snapshot byteBindingPath; do not restore an earlier journal or migrate intentionally historical option/oldDisposal paths. FINISHED is last, after durable five-object proof, normal release and full CP, bound to real E38 recovery terminal and actual executing identity. E37 normal TERMINAL/attempt2/FINISHED cannot stand in for this recovery-overlay subject.

## 6. Successor connection, affected proof and acceptance boundary

Add only `e38_finished_for_successor.py` and the original normal prepare's fixed completed-E38 branch. The reader uses immutable original record bindings, actual recovery AUTH/TERMINAL and completed return/readback, E38 audit FINISHED via the original parser, complete CP/current legitimate journal and original restricted placement I/O. It does not invoke retirement, old native STATUS/PID, a full mutable historical reconstruction or a synthetic E37 normal-terminal record. Completion/config bindings remain UNBOUND until real evidence exists; missing proof refuses. The successor's final package/op derives from real final material only after the old subject is legally closed; no new registration/execute is implied now.

Reuse candidate preparation `d75a4508a10a38c848ef9ad0cb130ecabf440da9214adc1ea1b2f5156eb06877` and affected review `36c6b8139106c6b3e22f03fe16fcc390388aa541a293dd52a9bea3b02eddfa7e` for the unchanged two shadow-symlink-mode spans. Its local 8PASS is neither the E38 failure-instant proof nor an admitted final package. Mechanically join the future real archive/SOURCE-CONTENT/INSTALL-PINS/template/seed/worker/manifest/policy/pair/authority/executor/pin/capsule; preserve APP505, profile order, original histories and unchanged source PASS. Run applicable original final-package validators and only affected recovery/retirement/reader compositions and necessary negatives. Do not rerun unrelated gates or change their thresholds.

Before implementation, the original qualified delegate must decide this exact body/SHA once and record acceptance in the original repository governance path. Then emit DEVELOPMENT_PREFLIGHT/SPEC_COMPLIANCE, complete original-scope non-author review of the actual new code and binding, and use the original sole writer for real load/call/terminal/retirement/CP. The author of this proposal cannot supply its independent PASS. No production action is authorized merely by drafting, source testing, receipt existence or a review result.

The remaining actual proof is explicit: precise current original registration/source/lock/tool and protected scene pins; original guard + newly sealed helper load composition; real quiescence and full six poststate preflight/inverse/postverify; final service/native/release/DS recovery records; subsequently complete five-material inventories, actual bound helper/entry/pins, durable FD/rename/fsync proofs, full CP/FINISHED and reader→normal placement. Saved namespace and generation receipts are reused at their stated scope. No fullmanifest, actual restoration, release or business success is asserted here.

After lawful closure and final admission, the genuinely new candidate follows original register/execute, actual load/AWAITING, transaction-bound real Feishu Agent response, exact WITNESSED/CONFIRM, authorized delegated COMMIT and Gate6, then distinct #508 business version. Recovery, retirement and control COMMITTED count zero business releases. The 50GiB floor, original remaining-budget rules, HR protection, credentials confidentiality and single-writer scope remain unchanged.
<!-- END EXACT ACCEPTED PROPOSAL -->
