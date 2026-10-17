---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E35_FIXED_RECOVERY_V1
status: accepted
parent_spec: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2
parent_spec_sha256: 7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753
operation_scope: b7-packet-r34-1cfeff2a5b138629-e35 only
transaction_scope: tx-c0fd42f71e074eeb8f0e9902e1a3e084 only
existing_admin_delegation_sha256: 06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57
accepted_by: original_deployment_coordinator_under_explicit_user_delegation_not_human_Owner_signature
accepted_date: 2026-10-18
accepted_proposal_sha256: 49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418
accepted_proposal_bytes: 21638
acceptance_source: https://github.com/mayf3/agent-control/issues/424#issuecomment-6239348639
acceptance_body_sha256: d9db054b1400548cc9ee7b25cf74c7d319e909d18692f635e6cbdab261ec6574
acceptance_record_sha256: 6edbdf2cf5ccb38d1b426ce3f3d79fabfe3a3d9bcb055a312c37b0e9ac0e4f1b
implementation_authority: finite_accepted_delta_after_this_governance_commit
production_apply_authority: existing_bounded_admin_after_original_scope_implementation_review_and_actual_original_maintenance_load
proposal_preserved: exact_original_21638_bytes_after_marker
---

The metadata records a delegated technical acceptance, not a human Owner signature,
implementation PASS or actual recovery. The original proposed status below is
preserved as part of the exact accepted historical text, not the current Spec status.
Acceptance retains original runtime->fence->terminal order and phase-appropriate
health evidence; fence still inFlight does not require deliverReady=true.

<!-- BEGIN EXACT ACCEPTED PROPOSAL -->
# Fixed e35 same-TX recovery, runtime restoration and terminal material retirement

Status: PROPOSED. This file is the single finite proposal, not an acceptance, implementation PASS, recovery receipt or business release. Acceptance is to be recorded as the delegated coordinator's own decision under the user's existing delegation, never as a human Owner signature. The accepted bytes and their SHA must remain intact in the accepted Spec record.

## 1. Subject and evidence

Only operation `b7-packet-r34-1cfeff2a5b138629-e35`, TX `tx-c0fd42f71e074eeb8f0e9902e1a3e084` is eligible. The existing sole writer, original native thread/ACTIVE Goal `01a1437b-f9f3-7a33-a253-8f7fce9459f3`, original peer UID502, original DS/OS custody and original restricted executor remain in force. No new Goal, deployer, scheduler, general recovery operation, sudo grant or service account is authorized.

Parent authority is accepted AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2, SHA256 `7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753`, especially CTR-COHORT-002/005 and section6 affected carrier/helper scope. Existing one-time restricted delegation SHA256 `06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57` remains the privilege boundary. E6/e33/e34 subject-specific permission does not transfer to e35; only their already reviewed mechanism patterns are reused.

The original release process exited rc1. Original DS reports RETAINED, inactive, attempt1, input_sequence0, no pending input and replay_allowed=false. Actual native state is ABORT_INCOMPLETE, same-TX fence inFlight=true; the original runtime is quiesced, not healthy. No AWAITING, PONG, COMMIT or business release occurred. The failed wrapper is not to be relaunched.

`SCENE.json` SHA256 `7018389f11b4dca8859643e7bbdc00165e3410afad9acaac100ba9c5824b4f8e` is the fixed initial scene, with the following full bindings (not permission to repair drift):

| Object | SHA256 / identity |
| --- | --- |
| Original registration receipt | `5bbacce050401210ea3390e9b5b00dbae8e96c9ff4342875f4c66cd5e3cb38df` |
| Original execution receipt | `1d6742519840e0a2a98409b28725eed69f3e2123d27a7382e88029944aea1895` |
| Initial native transaction | `03496ae42466aa9480c8fdbe36a4da6b549d47b533257016aee961ee75d21dde` |
| Initial same-TX fence | `c4299625e681bced76c195edeef938792cf202db5f05aadfa1b0c06613592443` |
| COMPLETE six-target batch, no pending | `a7c6dd52c680a2fe45780cf7e50bdf950fb68901f174a108e7aa589574744687` |
| Current six journal | `81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf` |
| Preparation seed | `71b06fa431ed987bfe423ae3a5d2c3078c458fc640ca2027a46eaf5da31a0d73` |
| TX preparation record | `ce960bbe3cd73ec26244d2ec2e58f1a1218bac592f26e63cb16590e8f6892d96` |
| TX accepted marker | `b98413fec119e5b5a6acf2df5ab466f6431eb96b547799a81ce487ab1191ba78` |
| Original holder | `dd25cd54a5911ea6d98dc5844f81473995ab41ba17b4dd9d04273bd00499818a`, nonce `927b57ed689ae8cdeb480a23354f48cb` |
| Original carrier/native script binding | `5bf6533411d4f08f98f38da8d4714603448ad2222b25dcd63960f427576350f1` |
| Cohort | `4e3e238882f804eef63cb8b119989b1f0660f1e68c184a796f02a6c16532f14c` |
| Original recovery tool | `be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab` |
| Original recovery Node | `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b` |
| Original runtime plist | `c41e1c18ea87517df1e5674f9f63761498c653f24cd7596754ae657d6767dc59` |
| Config exact preimage bytes, actual version2 | `321897cd8fb3024f05c4cb0b2960351fcd76b208d749e9b160ffd5e7b0216bf1` |
| Current pair server / client | `9fd68034efb050b0d7382bc2c4b12dbcc394254a7956b3885b9ecb3134724952` / `e206b5ff1bec5f2223b7314fabcc18b4679f0240bec03d39280b196f20c7528e` |
| Current executor | `9cda4ea0909809718a343119a15c85b37be3fff8b6a89deb02fb933abdfc15c8` |
| Current authority / independent pin | `973b0407b70da39917e91871c89be540bc6905c2aa88d63bd931ef739d251d17` / `44a627b10dd0f92b45d2b99a59220ae2f2c4c2b1f4b4b33ad8c08f78340839f5` |

Let M be `/private/var/db/agent-core/authsvc-codex-migration`, with original logical context `/var/db/agent-core/authsvc-codex-migration`. SCENE records exact root/holder/TX/fence/seed/artifacts/codeinput device, inode, uid/gid and modes. Initial batch.new and M/lock are absent. Original snapshot nine members, original registration policy/terminal bindings, code preimages, six-target preimage store and all applicable protected-resource invariants must be read freshly from original pinned records and verified, not replaced by these top-level hashes.

Root cause is demonstrated by original OUTPUT SHA256 `c88f76b7e8a94bebfc1445ebbbaeab829b45aebbf1b19980b7d113082c9a46ed`, isolated participant RED receipt `715ac911dcc31e6c49381eaad259ef9d4095474c97ec377ea9ff2b402bd71350`, and real read-only preimage proof V2 `1e5ac6cefcf39ef37de5456f847c12563632a8e95b32f390cf763836b19b289e`. The actual participant program entered through logical /var silently skipped CLI dispatch while returning0; canonical same-inode entry runs. The original carrier calls apply before the G3post check; G3 version/journal requirements must stay intact. Ordinary RESUME is not currently a complete recovery path: its ABORT can restore six targets before the old carrier refuses ABORT_INCOMPLETE. It must not be tried speculatively.

## 2. One bounded implementation and original maintenance publication

Implement only the missing finite e35 recovery admission, its exact source/identity-bound protected helper and delegated invocation, finite read-only P0 qualification, and later fixed material retirement described here. Other fixed subjects and ordinary execute/Owner-input/COMMIT paths remain unchanged. Extend the existing `B7_PACKET_RECOVERY_ABORT_V2` dispatch with an exact e35 branch; no additional public protocol action, arbitrary request paths, caller-supplied source, TX selector or general state setter. Existing protocol projection is reused where its exact current fields suffice.

The fixed entry works as DELEGATED_EXECUTOR under the accepted original delegation, not an Owner terminal, fabricated TTY, human confirmation or signature. The restricted root executor performs only the sealed fixed install/invocation class; DS request is submitted by the original UID502 with original peer validation. The helper is installed root-owned, non-writable and SHA-bound in the existing authority/capsule closure. Its own source SHA/role is recorded separately and honestly. It does not pretend to be old carrier5bf, change SELF_SHA to impersonate it, overwrite the consumed e35 source, or change original native provenance fields.

The new candidate host may supply an exact e35 read-only P0 qualification while this initial retained scene is present. Keep the original request shape, DS mutation lease, pair/preimage/authority independent-pin checks, metadata, stopped-unit proof, publication journaling/rollback and every unrelated P0 predicate. Qualify only this exact retained scene and actual absence of competing writers; never turn false ABSENT predicates into true, delete the scene, or borrow fixed E6 qualification. Existing `maintenance_entry_v50.py` already executes verified newly staged host bytes before its original `p0_reader_pair_guard` and `ds_update`: reuse that chain, no manual installed-pair replacement or new bootstrap service. Close all actual upstream prepare/install prerequisites in the frozen candidate and test the real entry composition. Do not claim merely adding a callable qualification constitutes executable publication.

Before privileged loading: complete original-scope non-author review of the minimal recovery delta and mechanical coupling of pair, helper, executor/delegate, authority, pin, capsule, seed/manifest/SOURCE-CONTENT/INSTALL-PINS as actually affected; exercise real frozen layouts and owner-scoped Git. Use one coherent final bundle; retain existing unchanged PASS results. Record real loaded DS PID and actual file bytes after original maintenance restart, not only source or control-plane COMMITTED. Current pair above is the explicit original rollback preimage; protecting existing normal services and HR remains mandatory.

## 3. Exact same-TX recovery, before material retirement

Recovery keeps original DS mutation lease/active exclusion, same registered peer and original policy/snapshot/guard. Acquire the existing native holder's same-inode flock/OFD lease by the original reviewed acquisition semantics; verify exact holder binding/nonce, dead prior owner and no live descendants/competing FD owner. Never unlink, rename, truncate, overwrite or force-clear a live or ambiguous holder. DS-global mutex alone does not exclude an old deployer. Record fixed recovery authorization/progress in the existing E6 V1 recovery-record pattern, bound to this e35 subject and its immutable original receipts. Original registration/execution receipts remain byte-for-byte unchanged.

Before initial mutation under both leases, recheck the SCENE baseline, all original nine snapshot hashes and native/outer/cohort/intent/source bindings; full six-target owned postimage/preimage and no pending stage; all three code-tree preimage digests; actual config bytes and required metadata; actual plugin/backup/manifest and protected resource invariants from original records. Initial plugin manifest is ABSENT and must be observed absent. `intent` rc3, `plugin-started` rc3, `verify pre` PASS and pluginIntent=false are limited predicates, not full plugin/config no-write proofs. Do not infer all resources unchanged from them. Drift outside this fixed recoverable original-owned scope refuses before mutation.

Under the original native lease, in this order:

1. Preserve the exact initial batch/native/holder/source proof in root-custody evidence without logging credential content. Run the original six-target whole-batch preflight, then its existing recorded-owned recovery semantics: restore only the six owned resources from the original preimage store, normally remove the original batch manifest, leave original journal bytes/history and preimage store intact. This is resource byte recovery, not journal rollback. No blanket home deletion or revert of unrelated business additions. File/directory durability for these actual writes must be established; uncertain partial recovery is retained UNKNOWN, not silently readmitted or replayed.
2. Execute the original SHA-pinned participant restore with its original SHA-pinned Node, canonicalizing only the actual callee program path after same dev/inode/bytes proof. Keep ROOT/TRUSTED and original logical /var context arguments, cohort paths, all historical binding strings and recorded hashes unchanged. `restore`'s legitimate `activation.restored` update is allowed; its existing source/body remains unchanged. No apply, prepare, stage replay, plugin upgrade or fresh business TX is authorized here. Independently verify actual complete original code/config/plugin preconditions after restore, not only rc0. Retain original native script/outer/provenance bindings.
3. Restore only original `ai.agent-core.runtime` from its exact existing plist, using original ensure-runtime-running semantics; prove real process/loaded source identity and actual health response on the existing local health interface. Do not substitute the deployment daemon's health for this runtime. Failure leaves truthful incomplete/pending runtime state and original fence/holder; no successful terminal or fence clear before real runtime restoration.
4. Then use the original durable same-TX fence-clear semantics, preserving the fence's recorded ownership/mode and refusing foreign/missing/drifted state. Failure leaves an honest pending fence-clear state. Then persist actual native ABORTED with file and parent fsync. This is an explicit e35-only implementation of the old carrier's private terminal-transition conditions (ensure runtime -> clear same-TX fence -> tx_save ABORTED), not an invented claim that an unchanged public finish-abort CLI exists. Only state/timestamps and the original participant restored fields may evolve as required; no forged proof, revised intent, source identity, business PONG or COMMIT fields.
5. Normally release the original native holder/lock by the original lease/owner semantics only after its terminal conditions. Verify real native ABORTED and original holder absent; persist original-pattern recovery terminal and progress records with exact unchanged original receipt SHA, real native terminal SHA and new helper identity. Then perform the original DS STATUS readback; it must truthfully expose recovery ABORTED/installedfalse. This is recovery, not a business release.

The new helper may implement the original private save/restore/terminal primitives directly in a finite reviewed module; no arbitrary-root-shell entry or user-writable script is executed. Bind every call, argument, result, process identity and durable write to the same e35 transaction and sealed helper. Existing original stage/source FDs and the original native lock stay held through the relevant original calls. Every mutable write has a fresh expected-scene/lease check appropriate to its preceding proven step; do not demand that initial byte hashes remain constant after authorized recovery itself.

## 4. Failure, durability, restart and historical truth

Before first mutation, an original-record exact refusal may be diagnosed without changing intent. Once recovery intent or a write may have happened, transport loss, restart, partial write, unknown child outcome, fsync failure or broken lease is UNKNOWN: retain the same op/TX, all original evidence/journal/locks and the fixed progress evidence. Do not spawn again from incomplete progress or reset/relabel it as a fresh attempt. Only read original status/output and finish an already proven deterministic durable step under the original same-TX supported primitive; no automatic generic repair admission is created here.

A visible auth/terminal pair does not itself prove its prior parent fsync succeeded. Before first completed durable closure, including a cold daemon retry after terminal fsync failure, recheck the original applicable scene and original conditions before permitting success. Reuse the existing R1 rule and V1 durable-record primitives. A successfully completed current invocation may retain its in-memory completion proof. A cold daemon with no reliable historical completion proof and changed scene must say UNKNOWN, not claim unconditional historical verification. Do not make reconstructing a retired old scene a gate for a future release. A historical recovery overlay proves that recorded terminal event; it is not current runtime/business proof and must not say replay_allowed=true.

## 5. Post-terminal retirement under a separate finite reservation

Restore service and obtain actual native ABORTED plus original STATUS BEFORE this phase. Retirement or future CLI/source review is not a prerequisite for service restoration. Because unchanged original terminal verification needs the canonical native TX and absent holder, do not claim one original FD9 is continuously held through both that STATUS and canonical TX retirement. Acquire a new finite original maintenance reservation and a real original-namespace native lock/FD9 lease excluding unmanaged old deployers, with exact terminal binding and no other live writer. Use accepted fixed retirement mechanism patterns, not blanket E34 subject permission.

Require completed durable recovery proof, exact current terminal TX/false same-TX fence, runtime restored, six restored-state verification, batch and batch.new both absent, original receipts and journal intact. Capture and pin the complete actual tree inventory/metadata of the two directories under this reservation before moving anything; SCENE top-level directory inode alone is insufficient. No unknown destination may be overwritten. Only these five moves, in this order, are allowed (same parent/filesystem rename, file and affected parent fsync, complete readback):

| Source | Fixed retained destination |
| --- | --- |
| M/migration-transaction.json | M/migration-transaction.e35-aborted-c0fd42f7.json |
| M/b7-preparation-input.json | M/b7-preparation-input.e35-aborted-c0fd42f7.json |
| M/migration-fence.json (now false, same TX) | M/migration-fence.e35-aborted-c0fd42f7.json |
| /usr/local/share/agent-core/artifacts | /usr/local/share/agent-core/artifacts.e35-aborted-c0fd42f7 |
| M/activation-code-input | M/activation-code-input.e35-aborted-c0fd42f7 |

Codeinput is last. Hold the original validated source/tool FDs through their last consumers and all relevant moves; end with held FD -> exact historical same-inode/byte-equivalent proof, then release the finite native holder normally. Persist terminal retirement proof last after all readbacks and durability. Incomplete retirement preserves exact progress and reservations under original finite recovery rules; do not clear lock, overwrite history, start a new release or generalize rename reconciliation. No rollback of current journal, HR476, business credentials or unrelated services. TX-specific preparation/accepted records, activation/gen/preimage/shadow history are not global staging collisions and stay in place; their retirement is not authorized merely for neatness.

The canonical original checkpoint's eight ABSENT names are codeinput, preparation seed, batch, batch.new, native transaction, native fence, original native lock and public artifacts. Demonstrate all eight genuinely absent after normal release, plus original restored-state/recovered-six predicates, by the actual pinned existing complete read-only checkpoint. No deletion or fabricated ABSENT observation. Historical STATUS after canonical retirement may be limited to its recorded overlay; do not add a generic archive fallback or claim live native revalidation. This limitation is not a new gate requiring reopening closed old work.

## 6. Coherent successor and real business acceptance

In parallel under the existing parent Spec, repair only the four actually affected CLI entry predicates: transaction-recovery and the three actually called fresh-child, runtime-app-graph and model-overrides gates. Compare same physical entry identity for direct invocation; ordinary import must not run CLI. Keep the original /var context strings, all business checks, G3ordering, plugin journal requirements and consumer identity intact. The migration CLI not actually called by this path is not enlarged into the patch scope.

Use original harness plus real Node actual CLI canonical/alias positives, structured refusal negatives, effects and ordinary import controls. Freeze original RED before candidate GREEN; importing functions or checking rc0/nonempty output alone is insufficient. The three original gate RED receipt is `7ce7f387116ae646328a0c51e435d88e86ca1147bf59f5100b92b7cf5de75f6e`. Independently review only changed code and relevant composition, retain previous profile24/shell6 and other unchanged PASS. One evidenced Bash carrier span remains the accepted prior mechanical correction, not a second invented fix.

After lawful old recovery/retirement, freeze one internally consistent genuine successor package, mechanically derived source/content/install/manifest/authority/executor/delegate pins, actual fixed layout/header/owner-Git/full existing validator and complete safe checkpoint/downstream preflights. Do not modify consumed e35 tool/seed/snapshot/holder to replay it, and do not claim e35 was zero-stage. Only then a genuine new candidate may get a legitimate new operation through original prepare/register/execute/AWAITING. Actual auth-service-authorized Feishu request and target Agent response must bind current transaction/route/representative Agent/session/fresh source; send/file placement/recorder input alone is not PONG. Drive original exact WITNESSED/CONFIRM, authorized delegated COMMIT and Gate6 without pretending human terminal input. Count actual loaded/PONG/COMMIT business release separately, then the different #508 W1 release; control-plane COMMITTED and this ABORTED recovery count as zero business releases.

## 7. Delivery and verification scope

Publish this exact proposal SHA, original failure/scene/RED proofs and non-author scope review to original #424. A delegated acceptance authorizes this fixed semantic amendment; it is not implementation PASS. Record accepted Spec in a separate governance change without altering the accepted body; then emit DEVELOPMENT_PREFLIGHT and implement the limited recovery delta first. Verify original admission/lease/source/scene negative cases, actual callee execution and postconditions, service restoration failure, same-TX-only fence/native writes, both V1 records/file+parent fsync failures, restart before durable success, original receipt/journal/HR preservation and retirement-to-original-checkpoint composition. Use isolated original fixtures and exact frozen real layout; do not use production EXECUTE as a test.

No new production gate, platform, background audit loop, wider sudoers or Owner per-step approval is introduced. Original remaining-capacity rule and budgets stay unchanged. Store only small source deltas/receipts and existing source exports; no new full-workspace copy factory. Continue within the original ACTIVE Goal after concrete recovery results; only a real new permission, changed safety invariant or unsupported unsafe recovery beyond this exact accepted scope is referred as one precise issue to the delegated coordinator/Owner as appropriate.
