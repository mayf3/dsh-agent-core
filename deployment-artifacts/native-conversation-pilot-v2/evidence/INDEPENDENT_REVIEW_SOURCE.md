# Independent review — #1156 minimal runtime candidate and TLS/config tests

Reviewed 2026-10-16 UTC. Read-only review of code not authored by this reviewer. The review excludes the auth CCR draft authored by this reviewer. No production change, send, credential POST or test against business endpoints was performed.

Scope: initially the17 runtime files listed in `/tmp/pilot1156-closure/closure.json`, the seven modified-file diffs against `pilot1156-fixed-v2/real-baseline/source`, the10 added modules, and packet `tls/token-proxy.mjs` plus `scripts/config-loader-tests.mjs`. After the finding below, the source-only custody repair added one module, bringing the final minimal runtime to18 files(11 added,7 patched). The final18 hashes match `/tmp/pilot1156-closure/RUNTIME.sha256`. Existing installed code outside the patch is assessed for preservation, not re-certified.

## Resolved blocking finding from the initial17-file candidate

### P1 — source custody assumes one OS identity, but the original runtime has a trusted parent505 and a child writer502

Primary location: `/Users/yanfenma/workspace/project/pilot1156-fixed-v2/real-candidate/source/packages/agent-router/src/conversation/persistence.js:15`.

Related locations: same file lines5–9 and20–22; `packages/production-runtime/src/compose.js:274`; `packages/agent-router/src/conversation/source.js:16` (read via same private helper), reserve/write and acknowledge paths.

The original system Router/facade PID43098 runs as authsvc(uid505); its original BIP child PID67280 runs as yanfenma(uid502). The actual system unit has `DSH_AGENT_CHILD_UID=502`, `DSH_AGENT_CHILD_GID=20` and the existing spawn helper. The minimal patch passes the same `/Users/authsvc/.agent-core/control/native-conversation/source` directory into child source retention. The `control` ancestor is authsvc-owned0700. Source `privateDirectory()` requires directory owner equal to the current writer and mode0700; `readPrivateJson()` requires file owner equal to the current reader and mode0600. Parent acknowledge also writes through these same-uid helpers.

With the current custody design, child source reserve cannot traverse the parent-private path. Even if deployment creates a child-owned source leaf with an ACL, the parent formal reader rejects every resulting child-owned file because uid502 differs from its uid505. Chowning rows back to505 makes the next child write fail; broad chmod does not pass the private mode predicate. This prevents the real original BIP line from completing durable result projection and violates CTR-NC-004/ACC-003/005. Same-uid fixture success does not close it.

Verified by running `/tmp/pilot1156-closure/cross-uid-predicate-proof.mjs`: source file owner502; simulated authorized reader505 is rejected with `private storage invalid`. `ps` independently confirms the real parent/child user split. The proof creates only a private temporary fixture and does no production writes. It is a negative predicate proof, not a positive dual-UID custody test.

The initial candidate could not be enabled for send. The repair and positive dual-UID proof below close this code finding; they do not apply production permissions or establish production source readiness. Generic config/request-store file permissions were not widened.

## Narrow repair within accepted source authority

Accepted DSH Spec r3 CTR-NC-004 explicitly requires the original runtime source owner to retain request-specific native-coordinate replies and provide a formal exact reader across the result-commit crash window. A source-only OS-custody implementation is within that accepted implementation scope if it does not add targets/caller authority/history, change routing, or weaken generic file security. Production ACL/ownership changes remain separate approval items.

Recommended bounded implementation:

1. Keep `privateDirectory/readPrivateJson/atomicPrivateJson` for config, request records and parent metadata strictly same-uid. Introduce a separate source-specific custody reader/writer. Derive trusted writerUid from the original controlled spawn configuration(502 here) and readerUid from the trusted parent(505 here), never from model/caller input or an arbitrary accepted-UID list.
2. Keep fixed sourceRoot plus digest(native request ID) paths, exact agent/request/session/message/turn checks, no arbitrary filesystem path or journal reader. The child owns source bodies; the parent gets read access only. Reject unexpected owner, unsafe POSIX mode, symlink/hardlink, unsafe ancestors and mismatched native coordinates. Open with O_NOFOLLOW and verify the opened descriptor with fstat so a path precheck cannot be swapped before reading.
3. Predeclare the exact deployment ACL as an approval artifact: child receives only search on the required505-owned ancestors (current control is0700); source leaf is502-owned0700 with named505 read/search and inherited read-only access to newly created0600 files. No0777, no broad group access, no parent write access to child source body directory and no permission changes elsewhere. Test actual macOS ACL inheritance/rename behavior, not only mode bits.
4. Parent ACK should be an independent505-owned metadata record keyed to exact request/agent/source digest, containing only an expiry/commit acknowledgement, never a second reply body. The formal source reader combines this immutable source with the parent-owned TTL metadata. It must not chown or rewrite502-owned source content. An existing formal owner RPC can be used instead if its crash/restart guarantees are proven. The metadata must survive restart, preserve pending/UNKNOWN sources and fail closed on coordinate/hash mismatch.
5. Before enabled loading, demonstrate real isolated writer502→reader505 custody on a dedicated fixture directory with only the proposed ACL, including write→parent exact read→parent ACK→restart/reset recovery, denied unexpected UID/owner/path/symlink, absent ACL/permission failure, result-write-failure recovery, and zero second send. A getuid mock alone is insufficient for the positive test. The source/version readiness claim must reflect actual usable custody.

## Repair re-review and final pins

Independently reviewed the implementer's `source-ownership.js`, `source.js` and `surface.js` repair, plus the actual dual-UID test and actor helper. It accepts only the exact writer UID derived from trusted original spawn configuration, preserves regular0600/single-link/non-symlink source ownership, uses O_NOFOLLOW and descriptor/inode checks, and binds parent-owned ACK metadata to source raw-byte SHA256 plus exact coordinates. Parent acknowledgement/expiry do not rewrite child-owned source bytes. General `persistence.js` remains unchanged at SHA256 `0a980ab16302e728de14aa0480118b37df7fa9894e0fec059b2382c5016e6f20`.

Independently ran the actual original Node executable against `conversation-source-ownership.test.js`: **2/2 PASS**, including real writer502→reader505 OS access, parent body-write denial, child ACK-write denial, wrong expected source owner, hardlink/symlink rejection, missing search ACL rejection, ACK hash mismatch and source byte/owner preservation across expiry. Every fixture path was a new private temporary tree, and its temporary ACL was cleaned. No production ACL was applied.

Final reviewed source hashes:

| File | SHA256 |
|---|---|
| `packages/agent-router/src/conversation/source-ownership.js` | `cc056c8f0be9618a65dda8a6fb0f4224c13638c2320a65b84de475ee7f83f964` |
| `packages/agent-router/src/conversation/source.js` | `da476c17cb1f7aff328287170b6cb5c9ec3b7e0e758313e689a93296628fd12b` |
| `packages/agent-router/src/conversation/surface.js` | `37ae8cab56036d365dcd090cca504dfd67d772eeaaf78b892ff63090adf794b4` |

Final closure pins: `RUNTIME.sha256` SHA256 `4bfcdba5e4d207baf89cb5ef4e0a6aa6f2954feb1fa5b2dee1c4199b35d014ce`; `closure.json` SHA256 `221d445a10b30bc8dca2ed202fd3b37776b4b494ec686941d3f50a4d2393a5c0`; full baseline diff SHA256 `13cb34154cbf8e3e13708e68536ef7bd9b8d42013b6ebb7fe6259a19c479a3c7`.

Independently verified Git objects in `/Users/yanfenma/workspace/project/dsh-agent-core-pilot-deploy-v1`:

- Actual-system baseline commit `a231f6316cfbe6ea9c29bfd7d36a53742883b536`, tree `2788aa3fc7d3b5cb382d3c42ba62a8ae5c197c28`.
- Reviewed code commit `1c69e052c9d232e67e4b5dc21355ecb0b9798109`, tree `d5bb6afd1d104cbc030a0df7103bd849a57da773`; its parent is exactly the baseline commit. The delta has18 runtime files and10 test/fixture files.
- All18 committed runtime blobs SHA256-match the frozen runtime manifest and the isolated real-candidate source bytes. The seven modified-file preimages in the isolated real-baseline also byte-match their baseline Git blobs. These checks bind this review to the exact code commit, not merely to a branch label or working directory.

The implementer's final eight-file test log `/tmp/pilot1156-closure/green41.log` was read and shows41/41 PASS, SHA256 `6a67ffdceafd7daaf95ddecaf2f56cb16b5b4cfe0701520a15e7acaaa7c58bd0`. This reviewer independently reran the affected dual-UID2 tests, rather than claiming to have rerun all41.

## Other reviewed boundaries

No additional substantive blocking finding was found in the reviewed current TLS/config files or the seven retained-overlay integration patches:

- Native send goes through `sendProductSurface`→existing routeChain admission→existing unified AgentProcess queue/reconciliation store. The patch preserves the original fence/mint-capacity/readiness checks and does not clear UNKNOWN, Scheduler/HR state or old Bindings.
- The dedicated Binding is read/rechecked before admission and after asynchronous workspace resolution; the MCP does not provide a surface/session path. Product context uses the existing trusted turn context and does not forge inter-agent provenance.
- Default config remains OFF when the dedicated env path is absent, and per-call auth/config validation remains fail-closed. Production routing must use the actual system product endpoint8788, not the older8787 process; the code's default8787 is overridden by the preserved system supervision setting.
- Exact native source retention runs before event publication and reconciliation observes the original native operation; available reply bytes are immutable and original execution uncertainty stays separate. The source-only UID repair closes the identified code applicability defect; actual approved ACL installation/readiness remains a production gate.
- Proposed TLS proxy pins its live loopback upstream4001, exact POST `/oauth/token`, body/response caps, no redirects/retries/logging, and retains standard TLS verification. Its callable upstreamPort override is fixture-only; live entry pins4001.

Independent commands run:

- Actual `config-loader-tests.mjs`:18/18 pass, including real MCP loader unsafe mode/symlink/mismatched subject/unauthenticated transport and DSH HTTPS/single-client/target/send-withdrawal validator checks.
- Enhanced actual `tls/token-proxy.test.mjs`:1/1 pass with a dedicated temporary CA and IP-SAN/serverAuth leaf, Basic/form wire, header stripping, denied routes/caps, no redirect/retry, wrong SAN/no CA refusal, and a child process using the same original Node binary with `NODE_EXTRA_CA_CERTS` and actual `fetch`. A no-extra-CA child fails before reaching upstream. This proves isolated Node trust loading, not an authsvc production POST or production installation. Proxy source SHA256 `3383006de6cbb60115319087790600e46c0eb342ef32af7fc5eca9540fae70bb`; enhanced test SHA256 `858a27fe8af22ac8e3b4e9cc30dd0c38d6db9be3a7c3d305701829f9b4ab9ffe`.
- Final18 runtime SHA256s match `/tmp/pilot1156-closure/RUNTIME.sha256`; actual config-loader test SHA256 `f37f0291030009ac87c8aa5df3ad73f8549d908a8fe500127c624c03925a63ac`.

The legacy38-test source report, broader original runtime/HR acceptance, auth-service audience provisioning and production/dot round trip are not independently re-run by this review. The real authsvc production client_credentials POST is NOT_RUN. Before enabling send in production, the original executor must install only the separately approved ACL and demonstrate actual sourceRoot502→505 readiness while the feature remains disabled; child capability version1 or this temporary fixture alone cannot substitute for that production gate.

Review disposition: **PASS for the reviewed18-file candidate and TLS/config preparation scope; no open substantive blocking code findings.** The original P1 is closed by the bounded source-only repair and real dual-UID fixture. Production load, persistent ACL/identity/client/audience/grant/Binding changes, actual authsvc POST acceptance and a dot business round trip remain separate approvals/evidence and are not certified by this review.
