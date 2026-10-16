# #1156 fixed native conversation backport

The true original BIP controller is system app /usr/local/libexec/agent-core/app with root /Users/authsvc/.agent-core (parent UID505). Its actual BIP child UID502 is under the same original Router. The old8787 instance is an auxiliary historical runtime and must not receive a second BIP sender.

Real candidate: /Users/yanfenma/workspace/project/pilot1156-fixed-v2/real-candidate/source

The completed minimal closure is18 runtime files:11 additions and7 local patches. There is no whole-main migration.303 original source files remain:296 byte-identical and7 changed only for native conversation wiring. No existing file deleted. Existing process registry, all reconciliation modules, HR cut/admin qualification/B7 startup contexts, installed model defaults, unique mobile correlation and event-correlation SHA25647693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc are retained.

The accepted #512 source was backported in place; bd8 contributes only the dedicated config-path entry injection. Actual app APIs already provide the original queue, fences, durable correlation and onTurnReconciled hooks. No new Process, Store, Router or scheduler was created. The source-specific UID repair is within accepted r3 CTR-NC-004 and passed independent identity_tls review; it does not expand caller, target, history, authentication or business authority.

Cross-UID custody: source writer UID comes from the existing trusted DSH_AGENT_CHILD_UID=502 spawn configuration, reader is the trusted505 parent. Only source reads accept that exact502 owner, with regular0600/non-symlink/nlink1/openNOFOLLOW+fstat checks. General privateJSON, auth/config and request storage stay strict sameUID. Parent ACKs live in505-owned control/native-conversation/acks and contain only coordinates, raw source hash and expiresAt. Parent never changes child-owned source bytes or owner. Hash-bound ACK governs TTL visibility; mismatch is unrecoverable and expiry preserves source/UNKNOWN records. No extra business body store or scheduler exists.

41/41 targeted tests across8 files passed using the actual Node v25.6.1 and copied system dependency closure. The real dualUID test runs writer502 and sudo -n -u authsvc505 under temporary /private/tmp directories with temporary ACLs, then cleans them. It proves parent read, parent OS write denial on body, child OS denial on ACK, inherited ACL after atomic rename, wrong expectedUID/hardlink/symlink/missingsearch rejection, ACK hash mismatch, and body hash/owner preservation on expiry. SameUID mocks are not claimed as dualUID evidence. Full log: green41.log.

No production load, live OAuth mint, persistent ACL, identity/client/resource/grant/Binding creation or business send ran. Persistent source/search/read ACLs are prepared separately by identity_tls and remain approval items, as do HTTPS/auth provisioning, original controlled profile deployment and first live dot roundtrip.

Artifacts: closure.json, changes.json, overlay-hunks.json, real-app-minimal.diff, RUNTIME.sha256, green41.log. Candidate source ownership patch is independently reviewed; production activation remains on HOLD until the explicit operational/permission approvals.
