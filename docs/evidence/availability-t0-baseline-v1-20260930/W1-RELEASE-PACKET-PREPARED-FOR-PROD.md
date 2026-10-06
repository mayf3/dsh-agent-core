# W1 first production release packet — PREPARED_FOR_PROD (NOT executed)

Status: awaiting existing production authorization / Owner approval. Nothing in
this packet has been run against production. No new permission is claimed.

## Exact release

- Branch/HEAD: `live-restore/t0-backflow-20260930` @ `36c8830c` (merge of main `360756e3`; includes PR #370 error passthrough)
- sourceSha: `71f8bcf65859959f72784dfd65a47135e4ec9f54`
- artifactDigest: `3aba4b2a26c448dad6881e40963cb220bcb88ed95ea346f0de7b1314e6e69998`
- dependencyDigest: `3f7e8dff1dbc790e295b966e7d956a821dff875392304c22dc24f373017aff1c` (npm lockfile, 102 resolved deps, sha512 integrity; git deps commit-pinned)
- toolchain: node v25.6.1 (sha256 c6c9bfa8eb5d0c67…) — the SAME binary the production runtimes execute
- build recipe: `t1-closure-assembly-20260930/candidate-recipe-v3.json` → `release-candidate-cli.mjs --recipe`; assembly = copy app/ + ONE delta (`workspaces: ["packages/*"]`) + `npm ci`
- isolated proof on this exact tree: entry import OK; `release-startup-closure --full` PASS (HR + ordinary Agent delivered, 401 negative, controlled restart, durable replay `duplicate:true`); broker 381/381 post-merge

## Target

- Service: authsvc runtime (SYSTEM domain, uid 505 `authsvc`) — the only launch chain with FEISHU_CREDS_PATH; real-HR Feishu channel + broker-credentialed agent execution (entry-mapping round 2). W1 read surfaces (MY_SESSIONS / Execution History / Human Attention) are INSTALL on this runtime.
- Install root: `/usr/local/libexec/agent-core/app` (controlled root; sibling rollback generations retained)
- W1 query entry to verify post-deploy: `http://127.0.0.1:8790/health` (ingress), product-api 8788; W1 reads through the real service identity.

## Operation (exact, via the canonical existing entry)

- Executor: `agent-deploy-system` (DS) DEPLOY, TREE-kind unit bound in the root-owned registry; state machine PREPARE→…→READBACK_VERIFIED→COMPLETE; receipts at `/private/var/db/agent-deploy-system/receipts/<operation_id>.json`, read back per exact operation id via `scripts/lib/deployment-reuse/receipt.py` (never via STATUS.last_receipt).
- Rehearsal evidence for this exact path (non-production, DS_TEST_MODE, zero prod effects): `scripts/lib/deployment-reuse/test_installed_reuse.py` (B→C→B, disconnected-client same-operation readback) and `test_release_recovery.py` (concurrent callers → second fails closed PREIMAGE_MISMATCH; consumed op-id replay refused; bad preimage FAILED with target intact; post-failure deploy COMPLETE; generation-chain rollback → B business readback PASS). Installed executor bytes pinned: sha256 `95dc02f87106ca9e131839e6d9843a65adcff6018bfbf47725e9241b4e80961d`.

## Rollback

- DS ROLLBACK restores the recorded tree generation (APFS-clone preimage captured before mutation). Rehearsed: undo-D → undo-C1 → B COMPLETE, business readback passes.

## Canary (low-risk, post-deploy)

1. `/health` 200 from the REAL service account (not root), loaded-generation provenance bound to `AGENT_CORE_DEPLOYED_SHA` = sourceSha above;
2. one self session query (W1 MY_SESSIONS read surface) as a real credentialed agent;
3. one ordinary Agent round-trip through the ingress→Router→worker path;
4. HR remains able to complete a request (no reset, no probe replay).

## Explicit unknowns (blockers only if they bind at execution time)

- Registry unit name/shape for the authsvc app TREE is root-side state (`/private/var/db/agent-deploy-system-config` is 0700 root; not readable unprivileged). The unit may already exist (deploy history in receipts suggests registry-driven TREE deploys happened). Owner/root-side confirmation of the unit binding (or an ADMIT/CAPTURE operation) is the one root-side step this packet cannot self-serve.
- authsvc service identity (uid 505) readback of the new tree requires the deploy itself; cannot be rehearsed unprivileged.

## When authorized

`submit → status/receipt → finalize` through the existing DS client surface with the operation id recorded here; failure ⇒ DS ROLLBACK per receipt; no sudo beyond what the registered unit already grants.
