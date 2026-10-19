---
spec_id: AGENT_CORE_FIXED_HR_ZCODE_FILE_BRIDGE_V2
status: proposed
spec_kind: implementation_contract
implementation_authority: none
owners:
  - mayf3
---

# Fixed HR file bridge v2 — proposed repository contract

This docs-only candidate packages the exact complete v2 unit below, its closed generated-config schema, source closure and relative-v1 delta. It requests the specific HR-only internal-method/composition and formal generator acceptance; it does not implement, activate or grant any live capability. User authorization of the HR advisory effect is separate from repository Spec acceptance. Correct qualified actor is owner mayf3 or a maintainer explicitly authorized for this exact reviewed PR head. B7 and the Auth custody handoff are not substituted for that actor.

Repository copies and original canonical pins are mapped in [PACKAGING-VERIFICATION.json](../reports/hr-zcode-file-bridge-v2-20261019/PACKAGING-VERIFICATION.json). Original local paths in archival JSON remain evidence provenance; they do not claim those files exist in every checkout. The unchanged v1 unit/review are archived under baseline; only the v2 unit, CONFIG-SCHEMA.v2.json and SOURCE-CLOSURE-INDEX.v2.json are the proposed acceptance unit.

<!-- ORIGINAL-V2-BEGIN -->
# PROPOSED HR v2 — fixed file capability, formal generator and native per-Agent join

Status: **PROPOSED_DOCS_ONLY / IMPLEMENTATION_AUTHORITY_NONE**. This complete unit, CONFIG-SCHEMA.v2.json and SOURCE-CLOSURE-INDEX.v2.json request repository acceptance of the finite new DSH mechanism below. They do not authorize code, generated configuration, permission changes, wake/send, deployment or production. User authorization of the HR advisory effect is separately retained; it is not a repository Spec acceptance. Correct acceptor is repository owner mayf3 or the explicitly delegated maintainer recorded against this exact reviewed PR head. B7 acceptance and the Auth handoff cannot substitute for that role.

## 1. Fixed intent and corrected provenance

Only canonical `agt_hr-agent`, original home `/Users/yanfenma/.agent-core/homes/agt_hr-agent`, may use three typed operations: read the fixed ZCode snapshot, read one same-request reply, and create one new inbox request. No arbitrary path, shell, socket, production action, identity/profile/root/domain switch, credential, token, Client/Grant or Auth API is introduced. ZCode remains the only Codex-line writer; query/nudge/relay/report stay advisory, with its existing per-line hourly nudge throttle and no interruption. Initial exercise is query/all only.

Exact README: 1800B / SHA256 `181772d2b5ce142bd3e1debe32fd467020c2c9d02334ca499b1a9a8e6d1dd508`. Root is `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist`. v1 8bd57a67 and its original material PASS16af remain unchanged. This v2 closes its schema/CLI/loader choices; it does not repeat the old source survey.

The new ZCode answer71a5 explicitly says “out-of-Git0600” was product-api history auth-config observation, **not a ready Agent settings generator**. The root-settings addendum b85e safely observed only provider categories: 1039B/502:20/0600, no tool/MCP/harness/generator path, no loaded proof. Neither `.dsh/settings.yaml` provisioning, that root settings file, old backups nor model-provider configuration is this bridge's output. Do not edit or read them to enable this feature. The bounded lookup is finished; no global absence or compulsory new platform is inferred. A genuine later equivalent existing pointer can be reused after exact equivalence is shown.

## 2. Native identity and selected registration path

### Existing source seams (not current loaded facts)

- Router `createProcessRegistry` owns `agentDefinition.getAgent(agentId)`, `workspaceBootstrap.resolveDshHome/resolveWorkspace`, lifecycle slot/generation and `processFactory({agentId,home,profile,...})`. It passes `agentId` and `getProc()` to `createParentRpcHandler`. These are native parent-owned relations, not data from a child request.
- Demo server provides the original stdio `agentRpc.request(method,params)`, correlates the parent reply, and attaches its current native turnExecutionId. Session seam calls `agents.create` or `agents.resume`. Harness `AgentSetup(agentCtx)` runs before session/Agent publication and can return a synchronous commit recheck. `agentCtx.get('tools').register(definition)` registers in that Agent scope; `ToolExecution.agent` is set by the loop. It identifies a Harness execution object, **not** by itself canonical DSH Agent ID.

### Exact new joins, all proposed

1. Add `readHrBridgeBinding({agentId,getProc,definition,workspaceBootstrap,slotSnapshot,layout,config})` to new parent module. It checks actual parent closure Agent ID is HR, native definition enabled, original home/profile/runtime root match, current process/slot/ownership/generation and no stop/drain/revocation, exact current config/artifact pins and finite validity. It returns a frozen binding or typed denial. It derives identity only from those trusted object references. UID/PID, env, file mode/hash, `from`, a requested Agent ID or a credential do not authenticate HR.
2. `startProcessForSlot` computes an optional nonsecret HR discovery descriptor only when the native Agent is HR and the validated config is present. Pass it as an optional constructor option into AgentProcess. `ready()` appends `hrFileBridge:{version:2,enrollmentId,configSha256}` to the existing initialize packet only for that descriptor. Omitted means original byte-equivalent initialize behavior. This is discovery/matching data, **not a bearer credential or authorization proof**.
3. Demo initialize stores that optional descriptor in an immutable closure. Session create **and** resume pass `setup: agentCtx => composeHrBridgeTools(agentCtx, descriptor, ctx.agentRpc)`. With no descriptor it returns immediately without config reads, tools or extra RPC, preserving all non-HR behavior. The setup uses the existing Agent-scoped factory before publication; its commit verifies the same descriptor has not changed. Failure rolls back that unpublished Agent scope.
4. The new child function defines one `hr_zcode_bridge` tool, containing only three model operations. `execute(args,exec)` verifies the same scoped Agent object/lifecycle, forwards exec.signal, and uses the original channel to call a single finite new internal method `agent_core.hr_file_bridge`. Its parameters carry the typed operation, enrollment/config digest and same-request fields, **no identity/path/root**. There is no Broker capability manifest, Auth check bypass, HTTP endpoint or new channel.
5. The existing parent relay gains only this exact HR branch with an injected callback. It first preserves the original process stop/exit barrier, then calls `readHrBridgeBinding` using the native `agentId/getProc` closure. It ignores any claimed identity and denies non-HR calls. For actual file operations it also requires the original `turnExecutionId` to identify a live execution owned by this same process/generation; missing/foreign/stale turn denies. No new active-turn requirement is added to existing Message lookup or unrelated methods. A private setup-only `inspectBinding` verb on this same internal method can return only descriptor applicability with **no file effect** before a turn exists; it is not a fourth model tool operation, wake or identity mint.

This is a narrowly requested Runtime/Router internal-method and composition exception. It is not currently implemented/accepted and is not obtained by reusing the MC505 credential-reader trust model. The established native Router process relationship is reused without a new trust root/daemon. No Harness core patch or global tool registration is proposed. Actual loaded generation/profile/caller facts remain UNKNOWN until the original phase proves them.

## 3. Generated JSON: exact schema and meaning

CONFIG-SCHEMA.v2.json is normative Draft2020-12. Every object is closed (`additionalProperties:false`), every listed top-level property required, no default/unknown fields. Types are exact (booleans are not numbers; JSON number coercion is forbidden). It fixes Agent/home/profile, all four I/O literals, operations and 65536B limit. Hashes are lowercase64hex; acceptedCommit is40hex; timestamps are RFC3339 and must additionally parse as finite UTC instants with `notBefore < expiresAt`. The generator enforces timestamp formats even if the chosen schema validator does not enable format assertions. Duplicate JSON keys, nonfinite numbers, invalid UTF-8 and noncanonical path aliases are rejected.

`runtimeRoot` must equal the original native runtime root from the enrollment basis; its syntactic absolute-path schema is not permission to choose a new one. `definitionSha256` is canonical JSON SHA256 of the original loaded HR definition projection used for this enrollment; no secret/provider fields enter it. `runtimeCodeSha256` and four artifact digests bind the actually selected accepted installation, not a claimed env value. `profileId=agent-core-production` is this fixed candidate's matcher, not permission to change HR's profile; if the actual original profile differs, planning fails with PROFILE_MISMATCH and reports the concrete delta. No silent profile migration.

`enrollmentId` is SHA256 of the canonical proposed config with enrollmentId omitted; it is a local content identifier, not a production operation ID or auth token. `expectedPriorConfig` is either exact absence or exact prior canonical config digest; it never permits arbitrary replacement. The full serialized output is canonical UTF-8 JSON plus one LF. `authority` fields are nonsecret audit references to user effect authorization and the future accepted exact Spec commit; they are not proof of caller identity or new authority by themselves. Current dates/roots/generations/pins are not filled with fixture values in this docs task.

The configuration is a desired enrollment matcher. A 0600 file does not prove actual loaded identity or effective tool enablement: the native parent must independently match every applicable field and its current ownership state on each operation. Missing file, stale config/generation, expired window or an original stop/revocation condition disables new operations. No separate token, policy database, long-lived Grant or global authority service is created.

## 4. Formal generator CLI and custody (proposed executable ABI)

New executable: `node scripts/hr-zcode-bridge-config.mjs <plan|generate|rollback>`. These are proposed commands, not commands currently safe to invoke. Unknown command/flag rejects before I/O. There is no --agent, --home, --root, --profile, --credential, --path or arbitrary --output option. Paths are compiled constants:

- fixed config: `/Users/yanfenma/.agent-core/homes/agt_hr-agent/.agent-core/hr-zcode-bridge.json`;
- fixed administrative input/ledger directory: sibling `.agent-core/hr-zcode-bridge-admin/`, private generated0700, containing only basis, content-addressed plans, exact preimages and generator receipts;
- basis: `basis.json`, generated by the original configuration phase from the new pure accessor `exportHrBridgeBasis({definition,workspaceBootstrap,profile,layout,artifacts,authority,window})`. This accessor belongs to parent.js and accepts trusted in-process services/records, not model arguments; it emits only the nonsecret expected native binding projection and pins. The original authorized sole configuration writer persists it at this fixed input location with its original phase/record references. No general runtime endpoint is introduced. A basis file is expected matching data; parent runtime checks still determine actual applicability.

Exact command shapes (H denotes an actual lowercase64hex hash, T an explicit RFC3339 instant; these symbols are documentation metavariables):

```
node scripts/hr-zcode-bridge-config.mjs plan --basis-sha256 H --expect absent --not-before T --expires-at T
node scripts/hr-zcode-bridge-config.mjs plan --basis-sha256 H --expect-sha256 H --not-before T --expires-at T
node scripts/hr-zcode-bridge-config.mjs generate --plan-sha256 H
node scripts/hr-zcode-bridge-config.mjs rollback --receipt-sha256 H --expect-config-sha256 H
```

Exactly one expect mode is required for plan. Window must be within the original phase's authorized finite window; no default/permanent duration. `plan` reads only the fixed basis and required fixed config/preimage metadata, checks schema/native-basis pins and expected preimage, and creates a0600 content-addressed immutable plan under the fixed admin directory. It does not enable tools. A missing basis is BASIS_MISSING, not a request to search credentials/settings or fill fields. Planning an expired/mismatching basis refuses. This task requests the pure accessor/generator source contract; it does not claim an already emitted basis or a current loaded projection.

`generate` opens the exact content-addressed plan without following symlinks, rechecks plan/input/artifact/expected-config identities, captures an existing config's exact0600 preimage in the fixed ledger, creates a new0600 temp, fsyncs it, conditionally publishes only against the expected prior state under the original single configuration-writer lock, fsyncs parent and reads back exact bytes/metadata. Original/new owner must be502:20 and mode0600; require the original authorized owner-side generator execution, no new UID transition or secret import. No chmod/chown/ACL is applied to an existing home/settings/provider file. Creating only this new private admin directory/config with their declared modes is an explicit generated-output effect, not a general permission change.

Return is `{status:PLANNED|GENERATED|ROLLED_BACK|REFUSED|UNKNOWN, planSha256?,configSha256?,receiptSha256?,reason?}` with closed per-status schemas. Generate success also records fixed path, actual ownership/mode, old absence/hash, new hash, source/pins and native basis references; only hashes/nonsecret metadata are returned to the operator, never an unrelated file or environment. Full readback/hash and parent durability are required for GENERATED. If any write/publication/fsync/readback phase is ambiguous, record the known prefix as UNKNOWN and consult the same plan/receipt/config; do not regenerate/rewrite or choose a new plan to hide it.

`rollback` accepts only the exact same generator receipt and current config hash, restores the captured original bytes/mode or removes only the newly generated config proven absent before, fsyncs and reads back. It never deletes the admin ledger, inbox request, reply, README or unrelated settings. Original state mismatch refuses. It does not roll back an already delivered bridge request or turn; actual admission and same-ID outcome handling stay separate. No command reads credentials, root settings YAML, backups, full env, DB, arbitrary paths, SourceRoot or product state outside this fixed enrollment.

## 5. Tool and file I/O ABI

One closed tool union, no additional properties:

- `{operation:'snapshot'}`;
- `{operation:'reply',requestId}`;
- `{operation:'submit',requestId,action,targetLine?,ask,contextPaths?}`.

requestId is1..96 ASCII characters, first alphanumeric, remaining alphanumeric/dot/underscore/hyphen; never slash/NUL/percent decoding or dot/dotdot. Submit's from is internally fixed to `hr-agent`. Actions/targetLine follow the unchanged README enums; omitted targetLine is omitted, not reinterpreted. ask is a nonblank UTF-8 string, contextPaths an optional array of inert strings; serialized request and each input/output regular file are <=65536 bytes. Context strings never authorize reads. Extra fields including Agent/home/path/command reject before dispatch.

Parent dispatch invokes only argv `['/usr/bin/python3','-I',fixed_reviewed_helper_artifact]`, with minimal `LANG=C,LC_ALL=C` environment and no inherited extra descriptors; typed command goes on bounded stdin. This is the fixed proposed interpreter, not a claim it is installed/usable; original activation pins its native custody/identity or refuses without fallback. No shell, full environment export or user-selected executable is accepted. This existing-runtime-owned short-lived I/O callee is not a daemon/new Agent or identity change. Its parent-owned config/readset and received binding digest are fixed; child model data cannot set a root or action outside the union. No helper may run before parent native admission. No new Auth/broker credentials/token are read or sent to child.

Helper uses descriptor-relative no-follow traversal anchored to the exact root and inbox/outbox directories, with held identity verification before/after. Root/ancestor identity, symlink/special-file replacement or leaf instability fails closed; generic fs cwd/resolve/observation are not substituted. Snapshot reads only the fixed regular snapshot; reply reads only `hr-outbox/<sameRID>.json`, requires matching requestId and existing done/rejected/deferred status. Missing reply is PENDING, missing freshness is UNKNOWN, never a fabricated live snapshot.

Submit serializes the exact README request schema, atomically publishes one new `hr-inbox/<RID>.json` with no-replace, fsyncs the leaf and parent, and performs exact readback. Existing leaf—including README—can never be overwritten, renamed away, edited, chmodded, deleted or exposed as inbox content. Private temp belongs only to this call and cannot be a request/README basename. Duplicate RID returns ALREADY_EXISTS without request content. Successful output is `{status:'CREATED',requestId,contentSha256}`; read replies use `{status:'REPLY',requestId,reply}`; snapshot uses `{status:'SNAPSHOT',snapshot,contentSha256,observedMetadata,freshness:'KNOWN'|'UNKNOWN'}`. Missing reply is `{status:'PENDING',requestId}`; denials are `{status:'REFUSED',reason}`; possible I/O effect without verified terminal is `{status:'UNKNOWN',requestId?,phase}`. No result implies Codex relay/business success. Stable reason enums include SCHEMA_INVALID, BINDING_MISSING, BINDING_MISMATCH, STOPPED, EXPIRED, PATH_IDENTITY, FILE_TYPE, SIZE_LIMIT, ALREADY_EXISTS, IO_REFUSED; arbitrary raw stderr/path content is not returned.

There is no directory listing/export/glob, README tool read, arbitrary outbox basename or general shell/FS registration. Original unrelated HR capabilities are not silently reconfigured by this bridge; any actual loaded capability capable of bypassing this fixed contract must be reported at the original activation phase and cannot be used as a substitute. The bridge itself enables no such fallback. ZCode alone handles advisory throttling/relay/replies; this unit does not patch its receiver or invent fanout membership.

## 6. Scope ceiling, original lifecycle and proof

Only these files may change in a later separately authorized implementation (necessary package metadata/export entries limited to the new module are mechanical):

1. NEW `packages/hr-zcode-file-bridge/src/parent.js`: schema/config validation, pure exportHrBridgeBasis/readHrBridgeBinding, parent dispatch and fixed helper runner.
2. NEW `packages/hr-zcode-file-bridge/src/child.js`: composeHrBridgeTools with scoped ToolDefinition and original relay result unwrap.
3. NEW `packages/hr-zcode-file-bridge/bin/fixed-file-io.py`: anchored finite I/O, same-ID/durability behavior.
4. NEW `scripts/hr-zcode-bridge-config.mjs`: only the CLI above.
5. `packages/agent-router/src/process-registry.js`: optional HR descriptor/parent callback binding only.
6. `packages/agent-router/src/process/agent-process.js`: optional descriptor constructor storage and initialize field only; original deadline/retry/lifecycle unchanged.
7. `packages/agent-router/src/parent-rpc-relay.js`: one exact internal method, original stop/ownership/turn guard preserved, no switch/Broker/Message semantics changed.
8. `packages/demo-server/src/index.js`: optional initialize descriptor and callback pass-through, no additional public lifecycle method.
9. `packages/demo-server/src/session-seam.js`: AgentSetup passed to create and resume, no changes to session/cwd/owner semantics.

No global profile bundle, Harness core, Auth service, Client/Grant/resource/scope, Router scheduling/lifecycle, runtime root/domain/UID, model provider settings, old HR476, B7 app/control/e42 or secret store changes. The parent branch and prepublication setup are the specific finite composition/RPC exception for repository authority to accept; not a generic Runtime NONE waiver. New module metadata cannot expand the nine-file semantic ceiling.

Actual config generation/enablement requires the original accepted source/review plus current original role/window, native target/home/profile/current installed generation, original preimage/rollback and existing lifecycle admission. Source model or declared manifest is not installed proof. No new future-scene or generic Owner precondition is created by missing actual data; unresolved concrete mismatches are reported to their original role. Until this Spec is accepted and implemented, config/wake/send remain0.

After effective config/loaded tool proof, use the accepted ordinary SessionMessageV2 send with actual legally bound caller/sourceTurn and existing Grant, `targetAgentId=agt_hr-agent`, bounded positive timeout1..300, exact README text/hash, and instruction to read snapshot then issue exactly one query/all and read sameRID reply. Do not use timeout0 as wake proof, proposed old wake, dispatcher notification, direct process spawn, Codex old thread resume or another Agent. Record separately native Message request/Agent-home-Run receipt, HR bridge RID/file receipt, ZCode sameRID response and HR final acknowledgement. credential_unavailable with noRID is that failure, not permission to mint/copy a token or choose another caller.

Timeout/cancellation/transport or post-publication UNKNOWN never permits resend/newRID/recollect/overwrite/fence-clear. Only the original exact request/Run/receipt/result surface is read. Stop/revocation denies new dispatch; do not interrupt a running turn. File I/O has no fictitious killable deadline; the original signal is cooperatively forwarded, and known already published effects are retained. No replay is hidden inside initialize or setup.

Affected offline proof after exact acceptance: HR native-parent positive vs wrong-process/Agent/home/generation/expired/stop negatives; forged descriptor/env/UID/self-ID cannot enable file effect; create+resume setup before publication and failure rollback; no-descriptor/non-HR whole inverse and zero extra RPC/read; exact config schema/CLI/preimage/mode/rollback and unknown retention; symlink/ancestor races/README/existing/concurrentRID rejection; one publish with fsync/readback and sameRIDUNKNOWN isolation; actual Message+four-layer bridge proof only at its original live phase. Reuse v1 unaffected semantics and unrelated prior PASS; no product test is run for this docs-only preparation.

## 7. Exact acceptance points and current result

Accept or reject this whole v2 plus its schema/source closure: (a) fixed HR-only capability/read/create set, (b) explicit native parent internal method and actual AgentSetup joins, (c) fixed formal generator/basis accessor/custody/rollback, (d) source ceiling and split implementation vs actual activation evidence. User effect authorization, qualified Spec acceptance, source review, generated config, loaded enablement, real wake and business reply remain distinct.

Current result is **PROPOSED_FIXED_PR_MATERIAL**, not accepted/implementation-ready/live. The two new provenance records narrow the old generator claim; they do not establish a ready existing equivalent, loaded identity or need to modify the root model-provider file. v1 originals and review stay frozen. No product source, generated config, permissions, wake/send, credentials, production or Goal/e42 state changes occurred.
<!-- ORIGINAL-V2-END -->
