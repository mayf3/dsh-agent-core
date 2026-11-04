---
spec_id: AGENT_CORE_FIXED_HR_ZCODE_FILE_BRIDGE_V1
status: proposed
implementation_authority: none
---

# PROPOSED — fixed HR Agent file-bridge configuration and tool boundary

## 1. Purpose, evidence and present limit

User scope is fixed `agt_hr-agent`, home `/Users/yanfenma/.agent-core/homes/agt_hr-agent`, advisory query/nudge/relay/report through the existing ZCode file protocol. The desired result is a formally generated private configuration, actual HR tool enablement, then one real Session Message carrying the unchanged README and one `query targetLine=all` roundtrip. This document prepares the smallest missing mechanism; it is not an accepted implementation Spec, live configuration, wake, permission, or production grant. A/B capacity/MC work and e42 inputs are independent and unchanged.

The exact README is 1800 bytes / SHA256 `181772d2b5ce142bd3e1debe32fd467020c2c9d02334ca499b1a9a8e6d1dd508`. The two handoffs and finite source pins are listed in SOURCE-CLOSURE-INDEX.v1.json. Saved HR home metadata is 502:20/0700; saved snapshot updatedAt is `2026-10-19T18:25:59+0800`. Neither proves a current enabled definition, profile, process, loaded tools, freshness, caller Grant or wake.

Existing `provisionAgentHome(home,workspace,{profile,subscription?,deploymentRoot?})` provisions known profiles/credential references; it is not an exact directory-capability generator. Generic FS `cwd` is explicitly not containment, workspace-write permits additional roots, and its observation policy can authorize replacement after a read. Those knobs cannot be substituted for the requested scope. Formal existing generator/registration remains unlocated in this bounded graph, not globally absent. No config or home is changed to test that gap.

## 2. Selected minimal carrier and alternatives

Select one HR-only local tool adapter plus a fixed no-path-argument filesystem helper and a formal generated enrollment. It uses ordinary runtime/profile loading and the existing file protocol, not Broker HTTP, an Auth Client/Grant, token bridge, external attach, Codex socket, scheduler, or a new service. The helper is a fixed product callee, not arbitrary shell or a new Agent/writer; no helper runs in this document task.

Rejected here: (a) enabling generic filesystem/shell/fullaccess or moving the workspace to the bridge root, since those do not enforce the read/create-only contract; (b) forwarding bridge actions through Broker/Auth or inventing an external RPC/token system; (c) hand-editing a 0600 file and treating its mode as proof of authorized configuration. If the original locator later supplies a genuine existing exact generator/provider, REUSE it under this contract instead of implementing duplicate carriers; no presumed existing entry is asserted here.

## 3. Exact proposed source and identity closure

Proposed DSH delta is limited to:

- `packages/hr-zcode-file-bridge/src/index.js`: register only the fixed tool below for the enrolled HR execution, validate typed arguments and lifecycle binding, invoke the fixed helper without a shell, return its typed result. New module, not present/accepted today.
- `packages/hr-zcode-file-bridge/bin/fixed-file-io.py`: fixed config location and fixed three I/O operations; descriptor-relative no-follow reads/EXCL publication. New helper, no arbitrary pathname or executable selection.
- `scripts/hr-zcode-bridge-config.mjs`: formal HR-only enrollment generator with expected-preimage, private generated output and exact readback. New entry, not an existing command or authority.
- Only necessary HR-specific enrollment/loader joins in `packages/agent-provisioning/src/index.js` and its trusted runtime caller. No global production-profile bundle enablement and no change to another Agent. Existing credential/profile behavior remains byte-equivalent outside the explicit HR enrollment branch.

The trusted producer must be the existing runtime's canonical Agent Definition/Router-owned process and home binding, consumed by the original deployment/provisioning role. It supplies a native immutable enrollment tuple: `{agentId=agt_hr-agent, canonicalHome, definitionRevision, profileId, runtimeRoot/domain, codeGeneration, enrollmentGeneration, expiry, revocation/stop state}`. The exact native field/accessor mapping is a required new internal loader join; the inspected generic FS actor is an opaque execution/session owner, not an authenticated Agent-ID provider. No assertion that this join already exists is made. No DSH_AGENT_ID/env hash, PID, UID, socket name, request `from`, model arguments, JWT or B7 qualification may replace that mapping.

The adapter is absent for every other execution. Missing/ambiguous/stopped/revoked/stale binding rejects before helper I/O. The helper cannot authenticate a caller by itself; only the trusted registered adapter may invoke it, and its configuration/path checks are additional containment, not identity proof. A generated file's mode alone cannot activate this tool. The enrollment must not change the actual HR target, UID, home, runtime root/domain or credential provider. Any such extra effect is outside this fixed unit and must be separately stated, not silently repaired.

## 4. Fixed I/O contract

Root is exactly `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist`. One model-facing tool `hr_zcode_bridge` accepts a closed discriminated union, no path/cwd/root/executable/Agent-ID parameters:

| operation | arguments | only native effect | result |
|---|---|---|---|
| `snapshot` | none | read fixed `STATUS-SNAPSHOT.json` regular file | parsed snapshot plus exact read hash/observed metadata; missing freshness is explicit UNKNOWN |
| `reply` | requestId | read `hr-outbox/<requestId>.json` regular file | same requestId and `done/rejected/deferred` reply; missing is PENDING, not dispatch permission |
| `submit` | requestId, action, optional targetLine, ask, optional contextPaths | create new `hr-inbox/<requestId>.json` once, never replace | `CREATED` with requestId/content hash; not ZCode reply or business success |

`requestId` is a basename identifier (1–96 ASCII alphanumeric, `_`, `-`, `.`; first alphanumeric; never `.`/`..`, slash, NUL, percent/path decoding). JSON has no extra keys, `from` is fixed `hr-agent`. Action and targetLine follow the README enums; omitted targetLine remains omitted for the existing receiver semantics. contextPaths are inert advisory strings, never authority for file reads or execution. Per-file UTF-8 input/output is capped at 65536 bytes; over-limit refuses without a truncated success. This finite proposed cap is a bridge bound, not an assertion about the generic FS API.

Use anchored directory descriptors, validate each fixed ancestor and directory identity, reject symlinks/special files, open child leaves with no-follow, and check held identity before/after. Reads are regular-file-only and bounded; directory replacement or read instability returns UNKNOWN/REFUSED, not mixed success. `submit` must publish a fully serialized JSON atomically with no-replace semantics, then fsync the new leaf and parent and exact-readback. Private temporary names cannot equal README or any request, are only within the held inbox, and may only be cleaned by this helper's proven ownership. No pre-existing leaf is overwritten, linked through, renamed away, chmodded or deleted. `README-HR-BRIDGE-CONTRACT.md` is never a writable or readable tool target. No whole-directory export/listing, glob, recursive traversal, arbitrary file tools or shell fallback is added. The existing generic provider's `createIfAbsent` contract is a semantic reference; its realpath resolver alone is not claimed to prove anchored confinement.

ZCode remains the only Codex-line writer and the existing reply producer. HR tools never read or write Codex app-server sockets, threads or production. `nudge` remains max one per actual line per hour with merge/no interruption; `all` cannot bypass it. The receiver owns its existing normalization/throttle/relay decision and rejects unsupported requests. This sender adds no fanout list, receiver implementation, or permission. Initial acceptance exercise uses only `query/all`, never nudge/relay.

## 5. Formal out-of-git generation, enablement and rollback

Proposed output is fixed `$HR_HOME/.agent-core/hr-zcode-bridge.json` (outside Git), generated 0600 under the existing private HR home, without changing that home's ownership/mode. Its schema is closed: the trusted enrollment tuple, fixed root/read/request paths, exact README and adapter/helper artifact hashes, only the above operation set, expected prior config hash/absence, generation, expiry and revocation reference. No secret/token, raw environment, credentialFile, Auth configuration, general allowlist or arbitrary target is accepted.

The formal generator must be invoked by the existing authorized configuration/lifecycle role, with the canonical native tuple and current expected preimage; it never accepts model-supplied identity. It validates all bindings before writing, stages a 0600 same-parent temp, fsyncs, conditionally installs only against that preimage, fsyncs parent and returns a nonsecret config-path/hash/metadata readback and exact rollback reference. Existing nonmatching output refuses; no broad chmod/chown/ACL or manual fallback. Missing private parent creation, if needed, must be an explicit HR-only generated enrollment effect within the accepted implementation, not a repaired global directory. Rollback restores the exact original config or removes only the newly generated owned file after generation/absence checks; it cannot erase requests/replies or other profile state.

Only after the accepted source implementation/review and original maintenance/activation admission establishes actual loaded artifact generation, enrollment, stop/revocation state, HR definition/profile match and the unchanged root/domain may the original sole runtime writer run this generator and enable this fixed adapter. No current loaded facts are inferred from source/manifest or 502 home ownership. This proposal does not authorize a restart of unrelated services, provisioning all Agents, credential copying, profile substitution, a new Client/Grant/API/scope, or changing e42 app/control. Actual activation source and command must be the existing precise lifecycle entry, or a separately accepted minimal loader implementation; this document does not invent a working command.

## 6. Wake/delivery and one real bridge roundtrip

Configuration must be proved effective first. Then use the accepted Session Messaging V2 normal `send` surface with `targetAgentId=agt_hr-agent`, the actual legally bound caller/sourceTurn and original Grant, and a bounded positive timeout in its existing 1..300 range. The message contains the exact README text plus its hash and requests: acknowledge the contract, read snapshot first, submit exactly one new `query targetLine=all`, then read only the same request's outbox reply. It grants no additional tool scope. `timeoutSeconds=0` proves only inbox receipt and is not wake/completion proof. Do not use proposed old `agent_wake`, dispatcher notification, direct DSH spawn, Codex session resume or the old phone-smoke thread as HR.

Record separately (1) native Message toolcall/requestId and target Agent/home/session/Run receipt, (2) HR-owned bridge requestId and exact immutable file receipt, (3) ZCode same-ID reply, (4) HR final response proving read/action/reply and advisory limits. They are not interchangeable. A tool returning exposed/queued is not actual tool execution or Agent wake. If credential_unavailable is observed before a requestId, preserve that zero-ID failure and follow the original Auth custody mechanism; never fabricate a caller, mint/copy a credential, change profile or send as another identity.

Every timeout/transport UNKNOWN retains the original requestId/Run and only the original reconciliation/result surface. Never resend send, resubmit with a new bridge ID, overwrite a request, clear a fence or kill a running turn to manufacture success. A deterministic existing request returns ALREADY_EXISTS without exposing inbox contents. Missing outbox reply is pending/deferred. Revocation stops new operations; an ambiguous publication is UNKNOWN and requires same-ID readback, not another create. Native file I/O is best-effort cancelable as the existing provider contract states; no fictitious deadline or rollback of an already published request is promised.

## 7. Acceptance and bounded verification

The single proposed acceptance unit is this contract plus SOURCE-CLOSURE-INDEX.v1.json: accept the finite HR-only tool/identity enrollment, exact filesystem helper semantics and formal 0600 generation/loader joins, or select an actually existing exact equivalent carrier with evidence. It is not automatically accepted by B7 or the Auth custody handoff. Correct DSH repository authority must accept the exact unit before product code; true extra loader/permission effects must be enumerated, not hidden in a generic Owner question. Auth counterpart reports no delta only under unchanged Auth interfaces/claims/Client/Grant/custody.

After actual acceptance, required affected offline proof is finite: exact trusted HR enrollment positive and wrong Agent/home/session/generation/revocation negatives; no env/UID/PID/self-ID fallback; ancestor/leaf symlink and rename-race rejection; README/existing request cannot change; same-ID concurrent create publishes once; post-publication UNKNOWN does not retry; runtime tool set excludes generic shell/path/global FS; actual generator output mode/preimage/rollback and other Agent/profile whole inverse. Existing unrelated R41/MC/source suites are reused, not rerun. Live wake/bridge results still require the separate actual lifecycle above.

Current status: **PROPOSED_CONTRACT_MATERIAL_ONLY**, no product code/test/config/wake/send or source/production mutation. The narrow checked sources do not supply the HR-only formal generator/registration; this is a concrete new-interface proposal, not an implementation-ready assertion or global absence claim. All original evidence, HR476, source/release/rollback/production/threads/daemon remain protected.
