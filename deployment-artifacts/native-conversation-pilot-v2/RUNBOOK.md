# #1156 release / rollback audit — 2026-10-16

Status: SOURCE/PACKAGE PREPARATION ONLY. No production mutation, authorization creation, Binding change, restart, B7 action or business send occurred in this audit.

## Correct deployment target

The target is the existing system runtime, not the historical GUI checkout:

- app: `/usr/local/libexec/agent-core/app`
- persistent root: `/Users/authsvc/.agent-core`
- launchd: `system/ai.agent-core.runtime`
- exact system plist: `/Library/LaunchDaemons/ai.agent-core.runtime.plist`, SHA256 `c41e1c18ea87517df1e5674f9f63761498c653f24cd7596754ae657d6767dc59`
- launch arguments: `/usr/local/libexec/agent-core/node-runtime/bin/node /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0`
- system parent observed: PID 43098, authsvc; BIP child identified by the parallel closure audit is PID 67280, PPID 43098, uid 502.
- existing product API: `http://127.0.0.1:8788`; notification ingress: `http://127.0.0.1:8790`. Both returned HTTP 200 health; this proves reachability only.

There is no wrapper on this actual system launch path: launchd invokes Node directly. Preserve the system launcher and plist, rather than editing the unrelated GUI wrapper. Keep `--catchup 0` and every existing environment setting unless the exact approved delta requires a change. `AGENT_CORE_DEPLOYED_SHA=fa4510beb6b01e5c40000a2ae36a62c526759e76` is an environment stamp, not the installed tree identity.

The original 8787 tree (`549dacea…` + overlays), its PID 1329 and its wrapper remain valid historical evidence. They are a separate runtime and must not receive the BIP pilot load, Binding or send. The frozen 67-overlay manifest undercounts the whole historical dirty tree: 24 modified, 1 deleted and 77 untracked paths were observed with full directory expansion. All 67 frozen hashes still matched, with 39 candidate-identical, 27 different and 1 missing in the old candidate. See `overlay-audit.json`; preserve this evidence without using it as the true BIP deployment baseline.

## Minimum preservation boundary

Start with all current true-app bytes and metadata. Apply only the accepted conversation slice and its demonstrated integration seams. Do not replace the launcher, Router, process, reconciler, HR cut, scheduler or whole main tree merely because the old package has newer files.

The actual Router already owns the single `TurnReconciliationStore` in `packages/agent-router/src/index.js` (construction at line 275); actual composition passes `layout.turnRecoveryStore` at compose line 272. Its persistent authority is `/Users/authsvc/.agent-core/control/turn-recovery-v3.json`. Preserve its original runtime epoch, startup qualification, fresh-HR-cut handling, reconciliation callbacks, admission fences and old records. Do not construct an independent conversation-only authority.

The current `packages/agent-router/src/process/event-correlation.js` SHA256 is `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc`; retain this deployed correction. The actual launcher includes native architecture admission and fixed HR startup authentication; copying the old candidate launcher would remove those seams.

All actual runtime dependencies currently resolve inside `app/node_modules` including `.capture-deps`; no new conversation runtime dependency is established by this audit. Preserve exact production dependency bytes. Production schemastery is 3.18.1 and node-sdk is 1.73.0. The old candidate's schemastery 3.18.4/node-sdk 1.75.0 and external `dsh-tools`/channel bridges are not an equivalent pinned dependency closure. The 8787 dependency scope is broken; that fact does not apply to the real system app. See `true-app-dependency-census.json`.

## Independent directory assembly, before any approval

1. Freeze the real app in the new package's baseline directory, including all regular files, symlink text, owner/group/mode/flags, and the separately pinned production `node_modules` closure. Parent task owns this app capture. Record source pre/post hash and metadata equality. A partial-read failure or drift invalidates the capture.
2. Copy the baseline into an independent candidate directory. Make the narrow source adaptation there. Include the exact Node/runtime dependency coordinates and actual dependencies; do not defer package installation until production loading.
3. Run real imports and focused source/persistence/crash-window checks using this production dependency closure. Use an isolated root only. Never instantiate the app against `/Users/authsvc/.agent-core` during preparation. No production child, canary, or business message is needed to validate a package.
4. Keep the complete offline candidate and dependency snapshot in the fixed package. Build a separate DS deploy-tree directory with `node_modules` omitted, since this existing profile preserves that top-level path. Prove the candidate uses exactly the preserved production dependency closure. If any dependency needs changing, stop and review the exact existing-profile adaptation; do not silently install it at deployment time.
5. Hash all deployable files and the complete offline closure; record absent paths/deletions explicitly. The historical overlay manifest is verification-only and cannot restore bytes.
6. Capture the exact system plist bytes and metadata privately. This audit did so under `private-system-preimage/`. It did not copy secrets, credentials, the runtime root, Bindings, jobs, recovery records, or sessions. Keep raw preimages and ACL/xattr values private.

Safe preparation helper commands (read production; write only a NEW offline directory):

```sh
python3 /Users/yanfenma/workspace/project/pilot1156-fixed-v2/packet/scripts/capture_private_preimage.py --describe
python3 /Users/yanfenma/workspace/project/pilot1156-fixed-v2/packet/scripts/capture_private_preimage.py --output /tmp/pilot1156-release/new-private-app-preimage
python3 /Users/yanfenma/workspace/project/pilot1156-fixed-v2/packet/scripts/observe_original_controller.py --output /tmp/pilot1156-release/new-readonly-observations
```

The app preimage helper is an offline byte/metadata capture, not the privileged DS capture/admission action. Its output explicitly has `rollback_eligible=false`. It has no restore or install mode.

## Original controller and B7 gates

The installed original controller is `/usr/local/libexec/agent-deploy-system/deployment_system.py`, fixed socket `/private/var/run/agent-deploy-system.sock`. Only its declared typed READ_ONLY observations were called here. The disabled historical `/usr/local/libexec/agent-deployd` is not a fallback execution route.

Fresh readback at 2026-10-16T00:15:34Z:

- `DS_UNIT_STATUS_V1(scheduler-whole-main)` reports runtime HEALTHY/ATTRIBUTED/stable, installation UNKNOWN, `current_runtime_verified=false`, registry generation `30aa3e6454a165cc975aa5660185d77bc89c70979a11f78d4f7c27303317c779`.
- `DS_RUNTIME_INPUTS_READONLY_V1` proves loaded launchd argv matches the current plist. It does not prove all loaded JS bytes equal current disk bytes.
- e6 `DS_B7_EXECUTION_STATUS_V2` returns `BINDING_MISMATCH`; no retry or old-binding edit follows.
- e23 execution is inactive/RETAINED, with a disposal-terminal fact `DISPOSED_PRESEALED`; it does not prove that all other B7 work is terminal.
- latest e29 execution is inactive/RETAINED, `reason=EXECUTION_INTENT`, `tx_id=null`, `native_terminal_verified=false`, `installed=UNKNOWN`, `loaded_business_proof=false`, and `next_action=INSPECT_ORIGINAL_STAGE_CUSTODY_NO_STAGE_REPLAY`.
- e29 lifecycle remains REGISTERED_ONLY and reports `execution_enabled=false`. The execution face says enabled; retain both observations and their provenance rather than choosing the favorable field. Every face reports replay prohibited.

Consequently, current B7 custody is a concrete blocking condition. The original authorized B7 executor must reconcile the same retained operation's original stage custody through its accepted path. This audit does not authorize or perform it. A missing mkdir-based `production-deploy.lock`, an inactive launcher, a healthy runtime, or registration-only receipt does not release retained transaction/fence obligations.

The original host mutation domain includes the DS `mutation.lock` flock and legacy native B7 mutex/transaction/fence custody. Do not acquire a second writer, remove/recreate a lock inode, clear a fence, amend an old marker, register another B7 operation, or issue a generic DS DEPLOY as a way around retained work. Exact operation authorization and the original executor's release/custody proof are required before admitting the pilot release.

## Gated cutover through the existing profile

The installed source defines `scheduler-whole-main` as the fixed app tree target `/usr/local/libexec/agent-core/app`, uid 505/gid 601, `preserve=["node_modules"]`, with a system-runtime restart. A current registry readback and accepted operation mandate must bind those exact values; the registry is protected and was not read directly by this process.

After the B7 gate is lawfully resolved, the authorized original executor must perform this existing sequence under its own mutation domain, not a package shell script:

1. Fresh authority/source/package/preimage/registry/custody checks; prove the affected Router/Scheduler turns, workers, dispatched effects and refresh writers quiescent. Stop on unreadable or unproven census. Do not treat a version of `restart-drain.js` in a development tree as evidence that the installed executor invoked it. The actual app lacks that module and generic DS `restart_runtime` itself does not establish this gate.
2. `CAPTURE_CURRENT_GENERATION` with the controller-measured registry, live source-tree and preserved dependency hashes. This writes an original controller capture under the same fixed profile; it first produces CAPTURED_UNPROVEN, not an admitted rollback generation.
3. `ADMIT_CAPTURED_SCHEDULER_ROLLBACK` for that same capture. The original controller performs a fixed isolated cold import/boot probe as the runtime identity, revalidates preimages and metadata, fsyncs the generation, and publishes the trusted proof/rollback pointer. Only the resulting ADMITTED generation is an executable rollback source.
4. Original executor stages the fixed deploy-tree into the controller inbox and submits the existing DEPLOY with `unit=scheduler-whole-main`, exact preimage/artifact tree hashes and `admitted_rollback_generation` equal to the admitted capture ID. IDs must be assigned only at this authorized step; they must not reuse B7 IDs or imply a fresh B7 apply.
5. Existing DS makes an independent sibling version directory (`.ds-new-<operation_id>`), validates it, records rollback linkage, performs the controlled rename/switch and one system restart, then checks health/readback. Unknown restart or response loss enters read-only classification of the same operation. No blind retry.
6. Any new conversation config/env/privilege/TLS/Binding write must be explicitly included in its own original approved fixed effect and preimage scope. The tree profile alone does not write the system plist or configuration. This package must not sneak a plist/config write through the code artifact. Reuse the original configuration/Binding authority path; if no existing fixed effect covers a required env key, that integration remains an explicit blocking item.
7. Prove actual loaded identity/code/config, fail-closed mounted route and zero unapproved Router calls. Production loading, permission provisioning and the first real new request remain separate approvals. Health is not a BIP reply/result acceptance.

No cutover was attempted. There is no truthful immediately runnable apply command while the retained B7 custody and exact configuration-effect binding remain unresolved. The above steps are executable through the installed original operations once their real prerequisites are met; no replacement control platform is proposed.

## Rollback

Normal operational stop first removes `send` from the DSH client's operations, retains `result` (optionally resolve), and keeps MCP enabled. It preserves every request, tombstone, UNKNOWN, source artifact and result. Verify this through the original config authority and retain its own preimage/readback.

For code failure, the original executor uses the same profile's ROLLBACK with a fresh authorized rollback operation ID and the exact admitted generation. The installed implementation clones the admitted captured app plus its preserved/materialized dependencies into an independent `.ds-rb-<id>` directory, verifies the full closure, switches through the original profile, performs its controlled system restart and confirms health/readback. Do not restore from a SHA manifest or copy over the live app manually.

The rollback manifest includes actual code bytes, dependency material and required metadata; the system plist's original bytes and metadata are separately retained. The actual system path has no wrapper. If an approved operation changes its plist, its exact original fixed-effect rollback must restore the preimage bytes, uid 0/gid 0/mode 0644, ACL/xattrs/flags and original launch arguments/environment, rather than merely deleting a new line. No plist change is part of the tree profile by implication.

Never replace, snapshot-restore, migrate or delete `/Users/authsvc/.agent-core` business state during code rollback: this includes agents, Bindings/bookmarks, scheduler jobs/runs, turn-recovery ledger/fences, sessions/history, UNKNOWN, source/result stores, audit/outbox, canonical credentials and B7 transactions. Retain any newly created conversation records across source rollback. A pre-pilot code rollback can preserve records while temporarily lacking the result API; result availability must not be claimed until an approved reader is loaded. Prefer send revocation while leaving the result-capable reader loaded.

Final rollback verification must include actual code/dependency closure and metadata equality, original system plist/argv, attributed system-runtime health, preserved runtime record counts/hashes or an authorized bounded readback, and truthful result-reader availability. A health response alone is insufficient. Rollback failure or an uncertain switch stays explicit UNKNOWN/pending under the same operation; do not report a completed abort or replay work.

## Blocking items this audit can establish

1. The old package targets the wrong runtime/port/Binding root. The revised package must use the true BIP system baseline and 8788 endpoint.
2. e29 retained stage custody is unresolved; same-operation original-executor reconciliation is required. It is not a permission request to clear locks.
3. The exact pilot code closure and isolated tests must be completed on the true app, preserving the existing reconciliation authority and deployed event-correlation repair.
4. A trusted DS capture/admission is needed before actual deploy; offline preimage capture alone is not an admitted rollback generation.
5. Any required new system config/env fixed effect must be concretely bound and rehearsed through the original authority, separate from app-tree deployment. No direct GUI wrapper/launchctl fallback is valid.
6. Source-on-disk and loaded-memory byte identity remain different facts. Fixed launchd argv was verified; the original controller still returns `current_runtime_verified=false`.

Identity, HTTPS/auth-service provisioning and MCP loader evidence are owned by parallel audits and must be joined into the final approval packet. No new permissions or real business sends were performed here.

## v2 source custody and configuration activation order

The final source candidate closes the parent505/child502 source-custody defect using a source-only exact-owner reader, inherited read-only ACL and parent-private hash-bound TTL ACK. General private config/request-store checks remain unchanged. See SOURCE_CUSTODY_ACL_DRAFT.md and the independent review. Do not transplant legacy UID assumptions.

After an explicitly approved permissions/configuration operation, the original executor must verify actual system spawn UID502/GID20 and parent UID505, capture each ACL preimage, provision only the fixed source/ACK paths and exact ACEs, then execute a bounded zero-business source-custody readiness probe under the real two identities on those actual paths. It must prove source reserve/write/read, atomic rename inheritance, parent cannot alter child body, child cannot alter ACK, exact-hash ACK and readable source retention across reopen. Keep native enabled=false (or send removed) until this actual-path proof succeeds. A /tmp fixture or child capability version alone is insufficient. Probe records are separately namespaced, never canonical business requests, and their exact cleanup belongs to that approved operation.

Original system plist delta is exactly PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE=/Users/authsvc/.agent-core/config/native-conversation.json and NODE_EXTRA_CA_CERTS=/usr/local/etc/agent-core-native-auth-tls/ca.crt. Preserve the original DSH_AGENT_CHILD_UID/GID/spawn-helper, HR qualification/cut and all unrelated environment fields. Configuration render defaults disabled and only writes a NEW child directory under the fixed offline generated-configs root; the original approved configuration executor performs installation/readback. TLS and credential delivery have their own explicit effects, not the app-tree payload.

Normal stop-send retains this ACL, TLS, credential, read grant and canonical data. It changes only the DSH operations list to retain resolve/result. Full source/code withdrawal follows the original admitted rollback route and truthfully reports whether a result reader is loaded.
