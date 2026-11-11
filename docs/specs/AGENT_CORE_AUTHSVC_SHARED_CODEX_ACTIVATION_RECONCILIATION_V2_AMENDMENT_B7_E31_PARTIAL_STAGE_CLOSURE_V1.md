---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E31_PARTIAL_STAGE_CLOSURE_V1
status: accepted
draft_state: READY_FOR_OWNER_ACCEPTANCE
draft_revision: 3
prior_proposed_draft_sha256: 0e9e0a12dd4774afe4e223b5ab40f6abcecf329c1bead3117218fa2afa27a68f
parent_spec: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2
parent_spec_sha256: 7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753
contract_pattern: accepted fixed E30 amendment; c122ce451328da4a86a8dfcc3f1b4ced6917e1ef9e99c72eac4ba314114f3d8f
existing_admin_delegation_authority: accepted owner-one-time-config-20261016.md; 06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57
operation_scope: b7-packet-r27-2edfbaeef5c352f2e-e31 only
implementation_authority: accepted_exact_fixed_e31_source_delta_after_spec_merge
production_apply_authority: existing_064_authority_after_independent_actual_delta_review_and_existing_maintenance_load
proposed_by: non-implementation-author external proposal; not an independent review
accepted_by: Owner exact direct user reply in original session, independently verified
accepted_at: 2026-10-17T00:18:39.601Z
accepted_proposal_sha256: 0b9306d9654dd180d775cb41df503acaf014e458342ace55d358b542364778ed
acceptance_user_body_sha256: 0310722df5162be5b2f63cf2ad35bef34e9e646eaa88d923e1743b9f889b9381
acceptance_source: original user session 01a1378d-e052-7021-9992-f0760eb9f9e7 line6327; https://github.com/mayf3/agent-control/issues/424#issuecomment-6227245282
accepted_proposal_independent_review_sha256: 12a8f68a63726b1c2b9218702147c96f9403bb9b1d89c865d68ccc8691c65452
---

# Fixed e31 pre-native-TX closure and partial-stage preservation

## 1. Status, authority and the single semantic addition

This is a proposed amendment, not accepted authority, implementation, closure,
preservation, replay permission or business acceptance. The accepted mother
Spec and accepted 064 administrator/delegated-submission authority remain in
force. Their permissions are not resubmitted for acceptance. The only proposed
addition is one fixed disposition and subsequent preservation for the consumed
e31 subject below, following the accepted fixed-e30 contract shape.

e31 actually consumed attempt 1 and wrote a protected partial stage before
`STOP_PARTIAL / ORIGINAL_ROOT_SOURCE_VALIDATION_REFUSED / outer_entered=false`.
Its original execution record remains RETAINED/EXECUTION_INTENT/null-TX. This
is a partial preparation effect, not a zero-write failure, native ABORT,
installation, actual PONG or successful #508 business release. The original
DS cannot re-EXECUTE an existing execution record; its mapped-TX RESUME and
native-terminal RECONCILE contracts do not close this unmapped/null-TX scene.
Neither the fixed e29 nor accepted fixed e30 exception applies to e31.

The original output SHA is
`24534d0be7e318687e37694270305f510815aff85fb83e2bf234c40377b56454`.
Root's exact original-process OS readback
`f5d1e382531d747a254611b609e8eba831edee433c9f00bd6291da6e2b7eb6cc`
records DocumentsFolder access rejection for Git PID 96588, UID502, responsible
DS PID30709. The original raw validator return code/stderr were not retained;
this amendment does not reconstruct them. The generic stop label alone would
not prove absence of partial writes or identify a unique cause.

Before requesting Owner acceptance of a final proposal digest, complete the
pending validation in §8 and obtain non-author proposal review. No closure
implementation begins before exact Owner acceptance. Afterwards, the existing
sole formal writer may implement only this delta, obtain independent actual-
delta review, freeze its complete pair/maintenance/artifact bindings and use
the existing authorized maintenance/load path. No third executor is introduced.

## 2. Exact subject and immutable original bindings

| Field | Fixed value |
|---|---|
| operation_id | `b7-packet-r27-2edfbaeef5c352f2e-e31` |
| packet_id | `b7-native-execution-r27-new-candidate-uninstallable` |
| registered_peer_uid | integer `502` |
| manifest_sha256 | `2edfbaee8c97de99d9ebb8896ee0886232adb09e744c8c01f7eb6c809d4992ae` |
| source_sha256 (registered worker) | `d4741d3e3c85024729ff85d57418ab4084fc6b3a14359cea951c294914e1ea20` |
| registration_receipt_sha256 | `f4cd8c3122b85830ad3497eff512c656377a2aed3844dc9a6e23daa2ec7f8c4f` |
| registration_policy_sha256 | `924aa20b8afbcb8af3bb1775dbd9a1966f71a0c05dbdd9467b8799867e225721` |
| registration_request_sha256 | `40905c26509ad76ce05cc83dcf4c2a51ca453f19c68d32aa2f226d7eb262df18` |
| execution_record_sha256 | `0c6ca506b0626875e23afdfb38fb969a79ff310489e928e23dd9be16cddec9af` |
| execution_policy_sha256 | `9f7e779ab1d597e4ee8ba137e783b1698122befb733f2070fb380c9a4ce9ae07` |
| journal_sha256 | `ff9f2122af69f557ba731958d47654525a138cb9587989f6664948abe828d8a4` |
| partial_stage_manifest_sha256 (canonical projection) | `fd26fbfc8ba4208787fa7fb1a995ffc0b19564621d38533c1c2240cc4d606343` |
| audit manifest file_sha256 (distinct encoding) | `38122530eece4d570bc8baa0363b16e48bb3c0df6152d3d2e502f2a88c581a9c` |
| partial_stage_objects | `1644` = `213` directories including root + `1431` regular files; no links/other kinds |
| partial_stage_file_bytes | `18386388` |
| staged seed relative path | `b7-entry-code/b7-wired-stage/seed-materials.mjs` |
| staged seed bytes / sha256 | `8819` / `bdeebc35ae21eb1bea8bbcbee977c9cee21bb7c025f34957eca5768bfb19ea1e` |
| original_partial_stage | `/private/var/db/agent-core/authsvc-codex-migration/activation-code-input` |
| preserved_partial_stage | `/private/var/db/agent-core/authsvc-codex-migration/activation-code-input.e31-closed-2edfbaee` |

Registration remains the exact 599-byte `DS_B7_PACKET_REGISTRATION_V1`,
version integer 1, action `B7_PACKET_REGISTER_V1`, state `REGISTERED_ONLY`,
original peer/policy/request and complete binding. Execution remains the exact
400-byte `DS_B7_EXECUTION_V2`, phase RETAINED, attempt integer 1, reason
EXECUTION_INTENT, tx_id null, terminal_output false, input_sequence integer 0,
input_pending null, linked to the original request and execution policy. No
schema relaxation, truthy boolean/integer substitution or invented null meaning
is permitted. Validate raw digests and complete schemas, not selected fields.

Original paths below `/private/var/db/agent-deploy-system/receipts/` are
`<operation_id>.json` (uid0/gid80,0644,nlink1) and
`<operation_id>.b7-execution.json` (uid0/gid80,0600,nlink1). The 40832-byte
`.b7-six-journal.jsonl` below the migration root is uid0/gid0,0600,nlink1.
STATE is uid0/gid80,0770; receipts directory uid0/gid80,0755. Migration root
is uid0/gid0,0700. Preserve these actual differing custodians/modes; do not
normalize admin to wheel or repair metadata to make a check pass. Require the
original protected nofollow/single-link/stable-read/ancestor checks throughout.

## 3. Persistent partial-stage manifest

Use the accepted e30 projection without changing its semantics: root first
with relative path `.`, followed by descendants in lexicographic path-component
tuple order (the order of `sorted(Path(root).rglob('*'))`). Traverse without
following links. Each row has exactly `path`, integer `uid`, integer `gid`,
`mode=oct(stat.S_IMODE(st_mode))`, and `kind` (`D`/`F`); files additionally have
integer `bytes`, lowercase `sha256`, and integer `nlink`. Directory nlink is
excluded. Encode the complete row array using Python
`json.dumps(rows, sort_keys=True, separators=(',', ':'), ensure_ascii=True)`
as UTF-8 with no trailing newline, then SHA-256. Absolute prefix, device/inode,
mtime and ctime are excluded from this persistent content digest. They may
still be used for live read/lease stability and custody checks.

Require the exact canonical digest, counts, total file bytes and seed above.
All rows have uid0/gid0; all files have nlink1. Retain every recorded mode,
including root0700, and every file length/hash. Missing, foreign, inaccessible,
linked, changed or unaccounted entries refuse. EACCES is never absence. The
same projection applies at the original or fixed history root. e30's different
`81030d7d…` history manifest is not e31 preservation evidence.

## 4. Exact DS disposition after acceptance

Add only this subject to the original `B7_PACKET_DISPOSAL_V3` handling and its
paired STATUS/output projection. Keep original action admission, actual peer
UID502 and registered-peer equality, original mutation lease, lease custody/
identity and execution guard. Any historical-policy read exception is confined
to the exact registration/execution identities in §2 for this subject's reads
and disposal; it is not permission for new registration or other operations.
No spawn, stage, EXECUTE, RESUME, business replay, fake TX or mapping ACK occurs.

While holding the same original mutation lease continuously, before **each**
new disposal-record write, revalidate the complete original registration and
execution schemas/raw hashes/custody; no active original child; original
native TX absent; production-deploy.lock directory/holder absent; final
`b7-preparation-input.json` absent; journal bytes unchanged; exact original
partial manifest in place; and fixed preservation destination absent. Use
protected dirfd lookups with positively verified parents. The existing
`/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock`
absence includes holder absence only because that directory is absent; do not
infer absence from a failed/inaccessible probe. Native TX is the original
`migration-transaction.json` under the migration root. Do not create or remove
any of these objects.

Write only, in order, these **new** original per-op record paths:

1. `/private/var/db/agent-deploy-system/receipts/b7-packet-r27-2edfbaeef5c352f2e-e31.b7-execution.b7-disposal-auth.json`,
   kind `DS_B7_PRE_TX_PARTIAL_STAGE_DISPOSAL_AUTH_V1`;
2. `/private/var/db/agent-deploy-system/receipts/b7-packet-r27-2edfbaeef5c352f2e-e31.b7-execution.b7-disposal-terminal.json`,
   kind `DS_B7_PRE_TX_PARTIAL_STAGE_DISPOSAL_TERMINAL_V1`.

Reuse the existing complete V1 schemas, strict equality/cross-record validation,
root:admin (0:80)0600 single-link custody and existing atomic no-replacement,
file/parent-fsync persistence. No new schema, closure marker or auxiliary
authority record is introduced. Auth binds exact op/manifest/worker,
registration bytes/policy/request, execution bytes/policy, journal and complete
evidence: native_transaction_absent, production_lock_absent,
preparation_seed_absent, exact partial-stage definition/digest/counts/paths,
stop_reason `ORIGINAL_ROOT_SOURCE_VALIDATION_REFUSED`, outer_entered false.
Terminal binds canonical auth SHA, equal original pre/post execution SHA, the
same partial-stage binding, and exactly
`{native_state: CLOSED_PRE_TX, installed: false, partial_stage_preserved: true}`.
Every consumer verifies all these bindings, not merely existence or kind.

Auth-only interruption retains that record. Orphan terminal, conflict, drift,
active child or uncertain persistence never permits record replacement, replay
or advancement merely because a file is visible and its JSON is valid. No
historical registration/execution/policy/raw-output/journal byte is edited.

### 4.1 Existing-record durability, interruption and restart

A visible directory entry, valid schema, matching raw/canonical hash and ordinary
readback prove content/identity, **not completion of file or parent fsync**.
Any failed/unknown file or parent fsync leaves the corresponding persistence
UNKNOWN. STATUS/output remain strictly read-only: they do not fsync, repair,
rewrite, create a marker, or turn visibility into a durable terminal.

Only the **same original B7_PACKET_DISPOSAL_V3 action for this fixed e31** may
complete durability of an existing, complete, exact auth and/or terminal. Hold
the original mutation lease and execution guard continuously; recheck their
custody/identity and the applicable complete scene below. For each existing
record, use the protected held parent and fixed leaf name; require exact V1
schema, raw/canonical content, all cross-bindings, uid0/gid80,0600,nlink1 and
read/entry stability. Fsync that held **file FD**, then its held **parent FD**;
verify the same FD/path/parent identity and unchanged raw bytes/bindings after
both calls. No record content or namespace rewrite, chmod/chown, extra durable
marker or schema/protocol field is permitted. Any failed/uncertain call or
unstable read leaves UNKNOWN and stops; it cannot be called completed disposal.
Report actual fsync calls and outcomes honestly, never as zero system calls.

There are only these state-specific readmissions:

- **Auth only, original stage exact, destination absent:** validate the complete
  original fresh scene from §4, including current native/holder/seed absence
  and unchanged journal. Establish auth durability by successful original
  persistence in this daemon lifetime or the finite file+parent completion
  above. Then recheck the entire original scene again immediately before the
  missing terminal write. Use the original atomic persistence once; terminal
  file+parent durability must likewise be established. A partial/foreign auth
  is never repaired, and history already present with only auth is not a valid
  route to manufacture a missing terminal.
- **Both records complete, original stage exact, destination absent:** verify
  all cross-bindings and the complete fresh original scene, and establish both
  record durabilities as above without rewriting either. Only then may this
  action confirm its complete CLOSED_PRE_TX overlay and permit §5 preservation.
- **Both records complete and exact fixed history already present:** use the
  bound historical scene: exact original registration/execution bytes and
  policies, exact complete auth/terminal and their original evidence bindings,
  and exact retained history manifest/custody. No missing record may be created
  on this branch. Record fsync-only completion may establish their durability
  under the same lease/guard/FD checks. A later candidate's original-path stage,
  current TX/holder/seed or later journal growth is not the old historical
  scene; do not claim those current facts are absent, use them to rewrite old
  evidence, move the new stage, or invalidate a completed historical terminal.
  Conflict or missing history refuses. History's own rename/parent durability
  remains separately governed by §5, not inferred from record fsync.

The durability evidence is the successful fsync sequence on the exact held
objects, not a new authority document. A bounded volatile observation may retain
that proof only for these exact identities/content in the same daemon lifetime;
any identity/content change invalidates it. **A fresh daemon/restart has no such
proof merely by loading visible auth/terminal.** Its readonly STATUS must retain
UNKNOWN/refusal rather than assert durable completion; the original disposal
entry must first perform the applicable finite revalidation/fsync-only branch.
STATUS may subsequently recognize the unchanged terminal using that still-valid
observed durability and full immutable bindings, without doing any sync/write.
If no valid durability evidence is available, it remains UNKNOWN. This does not
re-execute e31, create a TX, replay disposal-record content writes, or add a
resumption platform. Exact durable repeats need no content/namespace write;
when durability must be re-established, the explicit fsync-only action is
reported as such. No original record is silently rewritten to solve uncertainty.

STATUS keeps native state UNKNOWN, native_terminal_verified false, and exposes
only the exact fixed subject's verified `disposal_terminal`, CLOSED_PRE_TX,
installed=false, partial_stage_preserved=true, auth/execution digests and
next_action `COHERENT_CANDIDATE_NEXT`. This is an accounted-for retained partial
effect, initially in place and later at history, not a native ABORT or proof
that execution had no effects. Actual installation/business completion remain
unproven. Repeated STATUS/output never write or sync. A complete duplicate
whose exact durability proof is still valid needs no content/namespace rewrite;
a restart or uncertain record uses only the explicit §4.1 disposal fsync-only
branch before durable completion can again be asserted.

## 5. One fixed preservation, completion and crash boundaries

Only after original DS verifies that complete terminal may the existing
authorized bounded maintenance preserve this e31 partial tree. This extends
only its fixed-subject handling; no new public executor class, arbitrary path,
script, identity or permission is granted. Hold the original mutation lease;
validate its custody/identity and the complete fresh terminal, original
receipts, journal, no child, native TX/holder/seed absence, original manifest
and absent destination immediately before the namespace write.

Perform exactly one same-parent **atomic no-replace** rename from
`activation-code-input` to `activation-code-input.e31-closed-2edfbaee`, using
the held verified parent and fixed names. Reject unsupported no-replace
semantics rather than falling back to overwrite. Fsync the parent and read
back the unchanged complete canonical manifest/custody at history. No tree
byte, mode or owner is changed; no unlink, overwrite, chmod/chown or copy/delete
substitution is authorized. The old e29/e30 records and retained history remain
untouched. Do not disturb the online HR service or unrelated application state.

If exact bound history is already present and durable, preservation is already
complete. A later candidate's original-path stage is not e31 evidence and is
left untouched; do not require its mutable scene to match old e31, redo the
rename, or rewrite historical records. Conflicting history, missing original
without exact history, unexpected original before completion, custody drift or
uncertain preservation refuses and retains evidence. A rename success followed
by failed/unknown parent fsync is not durable completion. A subsequent legal
retry may, under the original lease and verified fixed history/parent, complete
parent fsync and unchanged manifest readback without namespace/data rewrite;
failure remains UNKNOWN. Such a durability retry is not “zero system calls”.
Complete recognized repeats otherwise perform no record/data/namespace writes.
Record durability after restart follows §4.1; history visibility/readback alone
likewise does not prove a prior parent fsync. The existing preservation entry
may establish history durability through this fixed-parent fsync-only branch,
then unchanged history readback, even when a later candidate has a new stage.
Never apply old native-absence/journal conditions to that later candidate in
order to redo historical preservation. A full global lease/custody or immutable
history/terminal binding failure still refuses. No extra marker or history
rewrite may conceal uncertainty.

## 6. Corrected candidate SOURCE preparation and later registration

The failed e31 payload and old Documents source root remain unchanged:
`/Users/yanfenma/Documents/Codex/2026-10-16/b7-v50-continuation-audit/codex-app-current-baseline-candidate/source`.
No SOURCE validator code change is proposed: installer SHA
`e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d`
and adjacent source-owner Git helper SHA
`cab5749dadf03cf4598cb4c361c61f785627f7aa9d6978a02e499c4d3b81818a`
retain exact HEAD/tree/clean/source-label/source-owner/refusal semantics.

The already prepared, distinct workspace candidate root is
`/Users/yanfenma/workspace/.zcode-worktrees/workspace+project+dsh-agent-core/ac-810/evidence/b7-first-batch-v5-build/codex-app-source-c71fd2cc`.
It derives from the existing pinned source bundle
`b11ef3c9895f84803c8ab9196a0ba846f4a6005d90992e526acdf54803a286cc`,
HEAD `c71fd2ccaa7fbf310101048622a1d22fe7141adc`, tree
`dfe0b029ddaa40019e52496f7990c15491acce99`. Preparation receipt
`4b44b33b9fc36bd2d1f8d867ce90792ee26fb62642049a3c799994a74902aa9e`
reports 936 tracked entries exact, independent checkout, clean/fsck and same-
owner original Git-stamp PASS. It explicitly does **not** prove actual DS-domain
readability. This draft likewise supplies no such PASS.

Before any corrected successor registration, require exact e31 history durable
and recognized; actual original-daemon responsibility-chain, sanitized original
validator SOURCE-only validation of the new fixed root, exact HEAD/tree/clean/
label/owner and unchanged refusal predicates; affected wrong HEAD/tree/label,
dirty/foreign-source negatives in owned fixtures; and independent non-author
delta review. The separately authorized fixed dual-root readonly probe may
retain both the old-root refusal and new-root result; a candidate-root PASS
must never be relabeled as an old-e31 binding PASS or e31 retry. Retain raw-rc
unknown where historical evidence is absent.

The original caller joins must also remain exact. Registered d474 stage
`packet/b7-wired-stage/stage-seed-once.py:378–380` reads the pinned outer
`APP-PACK-PROVENANCE.json` and requires its `repo_src_realpath` to equal
`pins.appSource.root`, with matching source label/tree/baseline/HR lineage.
Original `scripts/lib/deployment-reuse/b7-preparation.mjs:133–147` validates the
**inner** `app/pack-provenance.json` real source through the original installer;
`:155–157` requires that inner realpath to equal activation.appSourceRoot and
binds its actual bytes to tx.activation.appProvenanceSha256. Both checks remain.
The current outer receipt SHA
`41745489f4f5d8a8ff774978a57ee2e064cf7c9b543001d37e03a7ffa6edb752`
records the old Documents root; Root also reports that current f651 app archive's
inner receipt has the same old real root. Merely changing a pins/config pointer
to the workspace checkout cannot satisfy these existing joins.

After real candidate-root daemon SOURCE validation, later candidate repair must
use the original legitimate pack recipe against the actual workspace checkout
and produce new truthful outer/inner pack provenance and corresponding app
metadata/artifact bytes. Retain unchanged implementation/dependency bytes where
exact reuse is supported; this is necessary existing provenance closure, not a
new business version or a reason to rebuild unrelated tools. Do not edit old
proof to pretend it used the new root, copy live app to invent Git provenance,
or delete/weaken the original join predicates. The complete actual next package
must pass the original joins and independent final artifact/source review.
These are future candidate requirements, not accomplished PASS evidence, and
supply no e31 replay or additional semantic authority.

Freeze the complete new source-path/config, source bundle, app/tool/worker,
packet/pair, authority/pin/capsule and affected maintenance bytes consistently;
independently validate the actual final package and original callee before
registering one exact later candidate under the existing production mandate.
This proposal creates no successor operation ID, pair publication ID or new
business permission. No root-daemon FDA/TCC/ACL/Git trust change, identity
fallback, credential read/copy, or service privilege expansion is authorized.
Existing accepted administrator/delegation permissions and real native PONG/
scope/route/session gates remain binding, without a new Owner reauthorization.

## 7. Bounded implementation evidence required after acceptance

Tests use actual affected handler/paired-client and maintenance logic in owned
isolation, with root identity/custody/native-syscall coverage limitations explicit;
fixtures are not actual root execution or business proof. Preserve assertions.

| Required case | Required observation |
|---|---|
| Fixed original e31 valid scene | Original handler auth → terminal → paired STATUS; exactly two new V1 records, original bytes unchanged, native UNKNOWN overlay only |
| Wrong op/peer/registration/request/policies/raw schema/custody | Reject at original guard; no record, rename or child |
| Native TX, seed, holder/lock, active child, journal or complete stage drift | Recheck before each record/rename; reject without advancing |
| Auth/terminal file-fsync and parent-fsync failure, crash and restart | Visible/valid JSON never proves durable; STATUS stays read-only UNKNOWN; original same-action/lease exact-scene completion fsyncs held file+parent/readbacks without content or namespace rewrite; failures never advance |
| Auth-only, orphan terminal, conflict, interrupted persistence | Only exact auth with established durability plus another complete fresh original scene can finish missing terminal; orphan/partial/conflicting record refuses; no rewrite/replay |
| Complete duplicate/STATUS and exact history with successor stage | Same-lifetime valid proof permits readonly repeat; restart uses only bounded record durability completion; history fsync-only via existing preservation entry; no duplicate content/namespace write or touch to successor stage; missing/conflicting history refuses |
| Rename destination race, parent/lease identity drift, unsupported EXCL | Actual no-replace refusal; both trees and outside sentinel unchanged |
| Rename/fsync/readback crash boundaries | No false completion; legal fixed-history durability retry may fsync only; no new marker/old-record repair |
| Original SOURCE predicate and final package | Actual daemon fixed-root result plus bounded fixture negatives; real new-root pack outer/inner receipts, pins, activation root and final source/artifact/config/worker closure independently checked; pointer-only change refuses |
| Unchanged e29/e30 and transport/admission | Exact inherited sealed bytes where unchanged; reuse prior bounded PASS and run only affected integration controls |

After independent review and exact frozen package verification, actual original
DS closure → STATUS → bounded preservation → history readback must be recorded
separately from later registration/execution/business acceptance. Do not promote
test counts, source preparation or pair loading to completed closure/release.

## 8. Validation still pending; stop/revoke boundary

This draft is **DRAFT_PENDING_VALIDATION**. At authoring, pinned Root native
scene evidence and offline complete-manifest recomputation are available;
actual daemon candidate-root SOURCE result and independent proposal review are
pending. No implemented e31 disposition, reviewed delta pair, actual closure,
preservation or successor registration is claimed. Root must append the real
probe and independent-review receipt references, resolve review findings and
freeze the final proposal bytes before offering that exact SHA for acceptance.
Do not replace pending evidence with forecast PASS or silently revise an accepted
digest. This external draft does not modify any repository accepted Spec.

Owner acceptance of the final exact proposal would cover only this fixed e31
CLOSED_PRE_TX overlay/two records and one fixed preservation rename under the
existing contracts. It does not reopen mother/064 administrator/delegation
approval. No e29/e30 disposition is repeated or generalized. No native TX is
manufactured, ABORT asserted, old business replayed, lock/fence cleared, original
receipt/raw output/journal/policy/marker/store overwritten, or new recovery
platform created. Generic executor rollback is not a DS pair inverse.

Stopping before completion retains the exact original records, partial tree,
any durable new auth/terminal and all history; it never authorizes cleanup.
Existing management authority can disable the narrow entry/branch to revoke
future use while preserving evidence. Once history is preserved, revocation
does not rename it back or erase terminal records. Uncertain I/O or any failed
guard stops with evidence retained and requires readback of this same subject;
no new op, replay or speculative inverse follows from this amendment.


## 9. Actual validation appendix — READY_FOR_OWNER_ACCEPTANCE only

This appendix updates only the historical pending observations in §8. The entire
0e9e normative body is unchanged;1406/0e9e and their evidence remain retained.
**Owner acceptance is pending. No closure implementation, e31 disposition,
preservation, successor readiness or business completion is claimed.**

Non-author proposal-v2 review resolved R1, receipt
`6f993191e428d254d24cb019ad5d0783d6f47e2fc835b06184b599d89632bd53`
(report `dcba4f099a681b4590f8ee63168063a4d315365710687150b2136fd14ed0c85f`).
It covers the finite record-durability/restart/readonly STATUS clarification
and original SOURCE/provenance joins. It is not Owner acceptance.

Root actually published the already-authorized readonly diagnostic through the
original management line: publication `ds-reader-pair-dd0b5b336f56`, actual native
DS_UPDATE COMMITTED receipt SHA
`20c3c04071ca59dd4e5395cb67dc2a024cded6f1d679f5625ecafffda851e5f8`,
root:admin0644/nlink1, exact generation/op/restart=self and artifacts below.
This control publication is not an e31 replay or a business release.

| Actual frozen/runtime binding | SHA256 |
|---|---|
| server | `f127ce746322b375d34eb6ef7dabd1d41ba8b832d242f9097b55b91f24e5b35b` |
| unchanged client | `4801449a6b183bf1a5ed6c244dbb088601aa81d545320e992af7613a10c212a3` |
| diagnostic source | `2fc16194d0484d03994311d6ce1e2502c9e075d4cdde2941978624e01a21990f` |
| diagnostic non-author code review receipt | `0c9e871914b50fd7aaec79a336e840a8cdb578de3b3ddcee88378ef559685734` |
| authority | `207c5e1693f1646e6fedde9c7b8a0a7add44400e0ba0a356bf4bb05684f5be17` |
| pin | `954dd0da18b261c8e7e25fcd7cf2dd42554e864a2c800ace604141c4925f5667` |
| capsule | `fd6f233fab8d512f803ec9efbdc52af9738ee7cbe1afc5c4457da0b47d012d43` |
| actual original verifier | `90be69fd6f982e1f3b7ddaabf7f580d958353ff37387736013c8533088ed6663` |
| verifier non-author review receipt | `99751b11f7e680ea7b5bac4574926f42da08abe210f55ad09342468c12223593` |

Root's actual load readback SHA
`4a3aae315840ea3cc0decaaa236c6a716a2d58f0e776f320748b9a2328f75d35`
records daemonPID19247 and exact installed pair. Unmocked original post-publication
verifier rc0/61-of-61 PASS receipt SHA
`7c5108c2ab24babdd4d8432aa98cb4d32c5c68ae152e73428339a65eb877adbf`
is control-cohort validation, not business proof. Cohort inventory SHA
`a1f2448ff0b5955e7dc8eb5e540766238023b528c96842e0ca7df98508d9f2eb`.

The one actual original-DS fixed diagnostic result is
`actual-source-diagnostic.result.json` SHA
`d86d5f303ea00fe62d23dde5bb4db68b060c04f4bf9ff9eb5f974fbc3f6aeb0e`,
cross-bound to invocation intent SHA
`77e1260a0e740b8f933b65d7cee82afbefc21381a71efbebdfdcb8d4c204acf6`.
It reports actual peer502/root DSUID-EUID0/PID19247 and the exact §6 roots/c71/dfe:
retained-source has metadata ACCESS_DENIED, executed=false, rcnull, no stream
hashes; candidate-source actually executes original e342/cab, integer rc0,
PROVENANCE_VALIDATE_PASS, complete streams/group settled/no timeout, source
UID502. Exact cab delegates Git to that source owner; no separate childPID/EUID
readback is invented. New-root PASS does not make the old Documents root pass
or rebind e31. Full original scene and STATUS before/after match: inactive
RETAINED/attempt1/nullTX, nativeUNKNOWN/unverified, no replay; original raw/policy/
journal and stagefd26/native23118 bindings unchanged. After legitimate restart,
output_available=false; earlier saved output24534d remains historical evidence.

Goal independently read/cross-bound the actual intent/result/native receipt and
installed root:wheel0555/nlink1 pair, without repeating a DS request:
`codex-e31-pretx-closure-proposal-v2-review/ACTUAL-VALIDATION-ADDENDUM.md`
SHA `fe1c36335afee224c4da4a3b01f92a61e822d7de2523ad775cd0c850c1aa0aee`,
receipt `973043706d58860ad2f48192ee311058353b63a361b7bca73d6c926007fdd513`.
The formerly pending actual daemon candidate-root SOURCE predicate is now proven.

Root post-scene receipt SHA
`cd94a4b8176381c62639de7b79de54904aa5245d3ecee7259b6a672ec3e250f6`
confirms original reg/execution/journal, stagefd26/native23118, mutation-lock
original dev/inode/custody, current executor9ff/narrow sudoers and authority/pin
unchanged; HR476 preserved and health ok/deliverReady true. It explicitly says
e31_closed=false/e31_replayed=false/business_releases=0. Health is not PONG proof.
Existing e30 readonly STATUS SHA
`a0365626637ac9d5cb7989da9d7c67348422b96c80d19dcfc9dea4d125778ede`
retains its CLOSED_PRE_TX/preserved/COHERENT_CANDIDATE_NEXT overlay and nativeUNKNOWN;
no disposal/preserve was invoked. No old history is relabeled e31 evidence.

The real workspace-root pack is now separately prepared: app
`505cff8f9627d5986594c3464ab11b48cca36b187ff9c78c4ccb26b404587e83`,
inner/outer proof `ac35f9d8fb1bb1a072afcfc6e47133930b0fd1ce9aebd820b3a09576efd9ebe8`.
Non-author app/provenance review receipt
`908d1aeb1bd6409d4f69f369f678e895b5f4c54b34393aa1b9fde2d2f86bc154`
(report `78d204b35fe3c8b0b15fe07f4d99ceb774b3e9215cdaf9ff11c501db22c524e6`)
checks actual1420members/one provenance payload change/1419exact/1165mtime changes,
real original recipe execution evidence, original-source/R30 stability and actual
stage/preparation/header/validator joins (10Python/6Node checks PASS). Only proof
repo_src_realpath changes; old f651/proof remain untouched. This is preparation,
not publication: copied R31 retains historical snapshot coordinates and is
NOT_EXECUTABLE, with no new operation ID/pair/authority. All §§4–7 implementation,
exact-history, fresh namespace/final package and real business gates still apply.

All actual source/control receipt paths above are in
`codex-sole-writer-takeover-20261017/source-diagnostic-publication/`; full external
review/evidence paths and hashes are bound in this final INPUT-PINS manifest.
The single requested decision is acceptance of this exact final proposal digest
for fixed e31 disposition/durability/preservation only. Already accepted mother/
064 management/delegation authority is not asked again. No Spec is marked accepted
and no closure is implemented by this finalization.
