---
spec_id: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E32_PRE_TX_CLOSURE_V1
status: accepted
draft_state: EXACT_PROPOSAL_ACCEPTED_BY_DELEGATED_COORDINATION
parent_spec: AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2
parent_spec_sha256: 7911a67eb61055daf3c5f97ffc924a1e008181d07027e30e4fa2981f5fcd3753
existing_admin_delegation_sha256: 06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57
operation_scope: b7-packet-r31-19e485b2f9fa79a5-e32 only
implementation_authority: accepted_fixed_e32_source_delta_after_spec_merge
production_apply_authority: existing_delegated_bounded_recovery_after_accepted_merge_independent_delta_review_and_existing_pair_maintenance_load
accepted_by: explicitly delegated coordination reviewer; not human Owner testimony
accepted_date: 2026-10-17
accepted_proposal_sha256: cc61fd25120c888fc3a575687a94bf5899eefd212dfce636a15a308b5276e557
independent_proposal_review_sha256: 776a04929406a6dd1cb2f1a230d4dc0dc94f191160ed0b7f2b66d8d6af3b1bc3
acceptance_source: original user response_item in session 01a1437b-f9f3-7a33-a253-8f7fce9459f3 line16018 at 2026-10-17T01:36:20.641Z
acceptance_user_body_sha256: b02d1626c57488edd99d319c8ce2749eb46ca650aadafa0a72381b4064ad5715
acceptance_record_sha256: 3488931dbe12ecfb66feeb2fe613b0c0e2c682f9f28e3eb94375c5b1bf61804d
acceptance_authority_basis: explicit Owner delegated bounded technical decision authority and exact coordination acceptance; original single writer remains
proposal_body_preserved: byte_exact; frontmatter records acceptance without expanding the accepted text
---

# Fixed e32 pre-native-TX closure; no business-stage preservation

## 1. Scope and adoption

This external text is proposed only. It does not accept itself, implement a
recovery branch, mutate the original operation or authorize an execution retry.
The accepted mother Spec, accepted administrator/delegation 064 and latest
explicit user/delegated-coordination direction govern the existing limited
technical recovery. Do not demand a new human Owner decision for every sequence
number as a default: after independent review, the authorized coordinator may
accept this exact fixed-subject text through the original coordination route;
the sole formal writer records that acceptance and merges the accepted Spec
before implementing it. This proposed file is not that acceptance. Existing
permissions and authority are not expanded to arbitrary recovery subjects.

The sole semantic addition is an e29-shaped pre-TX terminal for this consumed
e32. Actual business-stage output is STOP_BEFORE_WRITE/PREIMAGE_SCOPE with
confirmed=[], possibly_written=[], outer_entered=false. Native TX and business
stage are absent. DS registration, execution-intent record and a nine-file
protected execution snapshot were created: this is not a universal zero-effect
claim. The native execute path refuses a consumed execution record; native
resume/reconcile needs an actual mapped TX, which does not exist. Do not fake
TX/ABORT, retry e32, choose a replacement ID to hide UNKNOWN, clear a lock, or
invoke a generic rollback. Fixed e29/e30/e31 exceptions do not themselves cover
e32; this text adds exactly its bounded disposition. No partial-stage branch,
preservation helper, rename or new public operation class is added.

## 2. Immutable fixed subject and original scene

| Field | Exact value |
|---|---|
| operation_id | `b7-packet-r31-19e485b2f9fa79a5-e32` |
| packet_id | `b7-native-execution-r31-c71fd2cc` |
| registered_peer_uid | `integer 502` |
| manifest_sha256 | `19e485b2f9fa79a5603a14536c5613be5f0c4c065d182ab420b6c7809a857109` |
| source_sha256 | `2a881af0daf50547881245f0cfc556d2f52af1f632b0662abc7754cefb3626ff` |
| registration_receipt_sha256 | `48206edf94673da11a569ee3761e96e429892ebb6a60905a0366e91f7027b398` |
| registration_policy_sha256 | `27151bf6484d28b916b790a41a66019aa5161f5418c0970c905a68c22d4e1edd` |
| registration_request_sha256 | `b05bdabffb683a517cd66f15c362a06b6fe1f17085e087f70d5b4b46ac904dc8` |
| execution_record_sha256 | `d84b96aebae1bee1127a5f9bee87adf78e6f4c0cd7debdc1842b3a62068f7f3a` |
| execution_policy_sha256 | `ac2d3e6e04864217d022bbcae35c7ef376081bc72af1e85b70c15ad4420ed15f` |
| journal_sha256 | `ff9f2122af69f557ba731958d47654525a138cb9587989f6664948abe828d8a4` |
| original_output_raw_sha256 | `0ef6a38467d2b472692e273cb06fe1dbccd7f967d305c7bf92f23a1261e137a2` |
| original_output_raw_bytes | `685` |
| scene_receipt_sha256 | `8187c5a517b34369de8bf55a505fc567e8c67ac3d9ccde4c312e0e33fb29caec` |
| status_readback_receipt_sha256 | `a99a1fd23222922d5b5c2b52ccdc30f8da8d132d38f3be659919bd2320d08e67` |
| output_readback_receipt_sha256 | `578ad0339f3b736a2cace7745e576dd997c83d5381450b862964bb5f9eb3151b` |

Read the complete original records as raw bytes and exact schemas, not selected
matching fields. Registration is the 579-byte DS_B7_PACKET_REGISTRATION_V1,
version integer1, action B7_PACKET_REGISTER_V1, state REGISTERED_ONLY, exact
peer/policy/request and three-field binding above. Execution is the 399-byte
DS_B7_EXECUTION_V2, exact original request/execution-policy linkage, phase
RETAINED, attempt integer1, reason EXECUTION_INTENT, tx_id null,
terminal_output false, input_sequence integer0, input_pending null. Keep JSON
bool/int distinctions and reject duplicates, extras, wrong null semantics or
conflicting raw bytes. Current STATUS is inactive, input_pending false,
input_sequence0, native UNKNOWN/unverified, installed UNKNOWN,
loaded_business_proof false and replay_allowed false. STATUS's false pending
projection is not a replacement for the raw record's required null.

Original paths under `/private/var/db/agent-deploy-system/receipts/` are
`<operation_id>.json` uid0/gid80 mode0644 nlink1 and
`<operation_id>.b7-execution.json` uid0/gid80 mode0600 nlink1. STATE is
uid0/gid80 mode0770 and receipts directory uid0/gid80 mode0755. Keep original
protected nofollow/ancestor/stable-FD/read/path/single-link checks; inaccessible
is not absent. Do not repair metadata or normalize admin to wheel.

The retained execution snapshot is exactly
`/private/var/db/agent-deploy-system-execution/b7-native-execution-r31-c71fd2cc/b7-wired-stage`.
Root is uid0/gid0 mode0700. Exactly the following nine regular leaves exist,
uid0/gid0 mode0600 nlink1, with no extra/missing/link/other objects. Bind bytes,
types, owner/group/mode and complete membership; live FD/entry identities must
remain stable across each observation. Original scene inode numbers are
observations, not permission to substitute another tree with the same basename.

| Snapshot leaf | Bytes | SHA256 |
|---|---:|---|
| `accepted-provisioning-commit.txt` | 323 | `49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9` |
| `accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md` | 13402 | `3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458` |
| `checkpoint-inputs.json` | 36963 | `c6e916129bfc8c1f180409a68e46630fe88c733c25b9b60add2c1c58ff6e66a1` |
| `checkpoint.py` | 21288 | `4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2` |
| `old-stage-lease-disposal-once.py` | 58648 | `519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53` |
| `option-b-quarantine-remove.py` | 15121 | `e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03` |
| `preimage-byte-bindings.json` | 1061 | `2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12` |
| `seed-materials.mjs` | 8819 | `520068ca8d685bcfc34e31d4b448acdb97cb649780e188379e20f46274819346` |
| `stage-seed-once.py` | 29408 | `2a881af0daf50547881245f0cfc556d2f52af1f632b0662abc7754cefb3626ff` |

The original migration parent is
`/private/var/db/agent-core/authsvc-codex-migration`, uid0/gid0 mode0700.
Its existing `.b7-six-journal.jsonl` is exactly40832 bytes, uid0/gid0 mode0600
nlink1 and the journal SHA above. The following eight fixed objects must be
positively absent under safely held and verified parents for the fresh closure
scene (an absent production-lock directory entails holder absence; a failed or
inaccessible parent probe never does):

- `/private/var/db/agent-core/authsvc-codex-migration/activation-code-input`
- `/private/var/db/agent-core/authsvc-codex-migration/b7-preparation-input.json`
- `/private/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json`
- `/private/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json.new`
- `/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json`
- `/private/var/db/agent-core/authsvc-codex-migration/migration-fence.json`
- `/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock`
- `/usr/local/share/agent-core/artifacts`

The prior e31 history
`activation-code-input.e31-closed-2edfbaee` is retained at its original path and
custody. e29/e30/e31 original receipts, histories, journal, mutex inode and HR
service remain untouched. Neither this history nor the DS snapshot is an e32
partial stage, and neither may be renamed, removed or repackaged by closure.
Snapshot and historical-record evidence is retained permanently. The original
status/output receipt hashes above are readback evidence; the decoded original
685 output bytes have their own distinct digest above. A stop label, log line,
process absence, or output alone is not authority or proof of the full scene.

## 3. One fixed branch, original peer and fresh lease

After exact acceptance and formal merge, add only this subject to the original
DS `B7_PACKET_DISPOSAL_V3` handling and paired original STATUS/output reads.
Preserve original exact request schema/action admission, serialized slot,
actual peer UID integer502 and equality to registered peer. Permit historical
registration/execution policy identity only for the exact original values in
§2 and this subject's reads/disposition; do not weaken current identity checks
for new registrations, other subjects or policy rows. Keep all old rows and
old sealed e29/e30/e31 behavior unchanged.

Hold the original mutation lease continuously with its original protected
existing inode/path/custody checks and original execution guard. Do not create,
replace, clear or bypass the mutex. Require no active original child. Before
EACH new disposal-record write, freshly revalidate complete original raw
registration/execution/schema/policies, protected nine-leaf snapshot, original
journal, all eight native absences and original scene/lease stability. A
changed, unknown or inaccessible observation refuses with no new write; no
preflight-only pin is enough. Never spawn, stage, EXECUTE, RESUME, send business
input, synthesize ACK/COMMIT/PONG, map a TX or invoke either completed old tool.

Write only these two NEW original fixed per-op paths in order:

1. `/private/var/db/agent-deploy-system/receipts/b7-packet-r31-19e485b2f9fa79a5-e32.b7-execution.b7-disposal-auth.json`
2. `/private/var/db/agent-deploy-system/receipts/b7-packet-r31-19e485b2f9fa79a5-e32.b7-execution.b7-disposal-terminal.json`

Reuse the exact complete e29 V1 schemas, without optional extra fields:

- Auth: kind DS_B7_PRE_TX_DISPOSAL_AUTH_V1; operation_id; manifest_sha256;
  source_sha256; execution_receipt_sha256; journal_sha256; evidence exactly
  {execution_phase:RETAINED, attempt:integer1, tx_id:null, holder_present:false}.
  All digests and the op are exactly §2. Registration/raw-policy/snapshot and
  the stronger fresh absence predicates are required implementation guards;
  do not invent a new schema to store them or treat their absence from V1 as
  permission to skip them.
- Terminal: kind DS_B7_PRE_TX_DISPOSAL_TERMINAL_V1; operation_id;
  authorization_sha256=SHA256(original DS canonical complete auth);
  disposal exactly {native_state:CLOSED_PRE_TX, installed:false};
  pre and post each exactly {execution_receipt_sha256:the original §2 digest}.
  Validate complete schemas, raw/canonical representation, same-op identity and
  all cross-bindings every time either record is consumed.

Use protected uid0/gid80 mode0600 nlink1 atomic no-replacement persistence,
held file fsync then held parent fsync, same entry/FD/readback and original
parent custody. No overwrite, metadata repair, new marker, side authority,
journal edit or mutation of the original registration/execution/output occurs.
This records a truthful pre-TX closure overlay, never native COMMITTED/ABORTED,
installation, preservation, actual business PONG or successful release.

## 4. Crash, durability, duplicates and read-only STATUS

A visible entry, exact JSON and ordinary readback do not prove file/parent
fsync completion. Failure or uncertainty at either fsync retains UNKNOWN and
all objects; do not clean, replace, retry content writes or advance merely
because a record is visible. Terminal without auth, partial/foreign/conflicting
records, cross-binding drift or lost lease refuse. Auth-only is retained.

Only the SAME original fixed-subject disposal action may complete durability
of an already complete exact record: under the same continuous original lease
and guard, validate schema/raw/cross-bindings/custody and applicable scene,
fsync the held exact file FD then its held parent FD, and read back unchanged
content plus same FD/path/parent identity. These are real reported system
calls, not zero-call recovery. No content/namespace rewrite, extra marker or
schema change is allowed. Do not fsync foreign raw bytes before validating
that they are the expected canonical record.

With auth only, the entire fresh original scene in §2/§3 must still hold.
Establish auth durability, then revalidate that entire scene immediately
before writing the missing terminal once. With both records complete before
any successor, validate that same scene and establish both durabilities; no
record is rewritten. Once the exact pair is established durable, completed
repeats verify immutable original record/snapshot identities and return the
same closure with no content/namespace write. After a later candidate changes
native stage/TX/holder/seed/journal, those mutable successor facts are not old
e32 evidence: do not use them to rewrite historical records or invalidate an
already complete historical pair. If a new daemon needs durability proof for
that already complete exact pair, it may only re-establish file+parent fsync
on the two existing exact records under the original lease/guard and full
immutable original registration/execution/snapshot/cross-binding checks; it
cannot create a missing terminal on a historical/successor scene. Any missing
or conflicting immutable object or uncertain sync remains UNKNOWN.

STATUS/output stay strictly read-only: no fsync, records, repairs, mutation or
new paths. A bounded volatile proof may retain successful durability only for
the exact unchanged identities/content in the same daemon lifetime; daemon
restart invalidates it. Merely loading both visible records on restart cannot
make STATUS claim durable closure; original fixed disposal must first perform
the applicable finite fsync-only completion. STATUS then may project
`disposal_terminal` from the exact pair with native_state CLOSED_PRE_TX,
installed false, canonical authorization digest and original execution digest,
and next_action COHERENT_CANDIDATE_NEXT. Preserve the original RETAINED/null-TX,
native UNKNOWN/unverified and no-business/replay-false facts. Add no
partial_stage_preserved flag or staged-object claim for e32.

## 5. Acceptance, tests, successor and stopping

Before production use: non-author review of this exact text, coordination
acceptance recorded by the sole formal writer and accepted Spec merge; bounded
actual-module implementation and independent affected-delta review; coherent
final sealed pair/policies/client/maintenance/authority/pin/capsule and genuine
original maintenance publication/load. Reuse unchanged prior proofs. No third
writer, new privilege/identity/service/platform, arbitrary-script/path/action
port or new public executor class is introduced.

The minimum meaningful implementation tests are original DS handler/install
and same-peer STATUS/disposal positive; wrong op/peer/registered peer; every
raw/policy/schema/type/duplicate-field/snapshot/hash/custody/lease drift;
active child; each absent leaf present and inaccessible-parent refusal; fresh
scene drift immediately before either write; auth-only interruption; orphan or
foreign terminal; no-replacement conflict; file AND parent fsync failure for
auth AND terminal; crash/restart visible-record UNKNOWN; valid same-action
fsync-only completion without duplicate content writes; exact duplicates and
repeated read-only STATUS; completed history after successor changes native
scene; unchanged e29/e30/e31 regressions. Failed/UNKNOWN runs retain objects
and evidence. Tests must not weaken expected refusal or count errored fixtures
as PASS. Root/custody/transport models remain explicit, never live-proof claims.

Only after the original DS has actually verified this closure may the sole
formal writer finalize/register a coherent successor under the existing task
contract. No successor ID is selected by this proposal. The known checkpoint
repair is a separate already-authorized candidate correction: derive only
preimageCompatibility.byteBindingPath from the actual canonical snapshot and
its bytes pin, retain the original strict equality and evidence pins, then
cascade true config/worker/packet/cohort hashes. Leave the historical
sources.oldDisposal and sources.option paths unchanged as explicitly directed.
Do not alter e32 snapshot/config/pins or receipts in place and do not re-execute
e32. Future actual material/business validation remains independently required.

Stopping/revocation means stop invoking the narrow action or disable its
existing fixed policy/entry through the original managed process. Leave all
records, snapshot, journal, histories and UNKNOWN facts retained. No inverse
that deletes closure history, no automatic cleanup, no fence removal, no
permissions/TCC/credential change and no generic recovery facility is granted.
