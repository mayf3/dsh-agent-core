# PUBLICATION_AUDIT — AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V2

```text
audit_id             = 91531e67-8c19-4abc-90e3-95d6dc1a92d1
spec_id              = AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V2
accepted_commit      = 062120bd3a588c4bede5d3130772355f7d4c25e0
audit_time_epoch_ms  = 1788418996610 (2026-09-03 ~15:03 CST)
auditor              = INDEPENDENT_READ_ONLY_PUBLICATION_AUDIT
round                = CTR-RR-005 final stage; post-publication, production-READ-ONLY re-verification
declared_path        = /Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/workflow-execute-receipt-recovery-v2-20260903/PUBLICATION_AUDIT.md
written_at           = /Users/yanfenma/workspace/worktrees/dsh-receipt-recovery-v2-audit/docs/evidence/workflow-execute-receipt-recovery-v2-20260903/PUBLICATION_AUDIT.md (branch docs/workflow-execute-receipt-recovery-v2-audit, base 4c384ccb14fa7e023912098a07f045df5cda871e)
```

Frozen inputs re-hashed independently this round:

```text
artifact manifest sha256 (ARTIFACT_MANIFEST.json)          = dbe04d889d2d67fdfef98dac26dc68c190de50627fafe587237235a1196af893  [MATCH frozen]
wrapper sha256 (manifest .wrapper.sha256)                  = 3ed44a2171fd655cf964a356226789daf35740b4e9c13043dc2fba7fa428bd82  [MATCH frozen; == published body .recovery_authority.artifact_sha256]
supplement_body.sha256 / bytes (manifest)                  = 70bb1672361d52ec0ad1d87cfbc3d01af1fd113cde079f9eea704c9a61ac2239 / 8437  [MATCH frozen]
```

## 1. Published supplement — PASS

Path: `/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT_RECOVERY_V1.json`

| Check | Observed | Verdict |
|---|---|---|
| exists / nonempty | present, `wc -c` = 8437 bytes | PASS |
| sha256 | `70bb1672361d52ec0ad1d87cfbc3d01af1fd113cde079f9eea704c9a61ac2239` | PASS (== frozen body/published sha == manifest `.supplement_body.sha256`) |
| regular file | stat mode `100644`, nlink=1, uid=0, gid=0 (root:wheel 0644) | PASS |
| jq schema | `jq -e .` exit 0 (JQ_VALID) | PASS |
| `.receipt_kind` | `RECEIPT_RECOVERY_SUPPLEMENT_V2` | PASS |
| `.recovery_authority.accepted_commit` | `062120bd3a588c4bede5d3130772355f7d4c25e0` | PASS |
| `.recovery_authority.artifact_sha256` | `3ed44a2171fd655cf964a356226789daf35740b4e9c13043dc2fba7fa428bd82` (== frozen wrapper sha) | PASS |
| body sha vs manifest | `cmp` vs `/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-receipt-recovery-v2-artifact/supplement.body.json` → BYTE_IDENTICAL; body sha == manifest `.supplement_body.sha256` | PASS |
| `.failure_cause` | `null` | PASS |
| forbidden keys | top-level keys = [control_flow, current_reobserved, failure_cause, original_receipt, original_transaction, post_publication_audit_evidence, pre_recovery_durable, receipt_kind, recovery_authority, recovery_transaction_id]; `has("identity_after") or has("receipt_recovery_publication") or has("workflow_execute_production_ready")` = false (pointer names in `.post_publication_audit_evidence.carries` only, as allowed) | PASS |

Informational (no byte effect): the NEW file carries macOS provenance xattr — `ls -lO` shows `@` with `com.apple.provenance` (11 bytes); BSD flags raw value `0` (`flags=-` in ls -lO), no ACL (`ls -le` has no entries). Requirements tested are nonempty/schema/hash/ownership/mode/nlink — all PASS.

stat census: `dev=16777230 inode=62733028 mode=100644 nlink=1 uid=0 gid=0 size=8437 mtime=1788418352 birthtime=1788418352`

## 2. original_receipt.identity_after — MATCH = YES

```json
{
  "value": "device=16777230 inode=62490135 size=0 uid=0 gid=0 mode=0644 mtime_epoch=1788391655 birthtime_epoch=1788391655 nlink=1 flags=- acl=empty xattr=empty sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "path": "/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT.json",
  "time": 1788418996590,
  "extract_sha256": "d0b8e3dd14a59caf7b0fb7b8f600b2bc7572481ffb11c8906383a5f7d87b155d",
  "provenance": "CURRENT_REOBSERVED"
}
```

- Full census re-observed read-only this round (stat + raw flags + `ls -lO` + `ls -l@` + `ls -le` + sha256). Raw BSD flags = 0 (=> `flags=-`); ACL empty; xattr empty.
- `extract_sha256` above = sha256(value + LF), independently recomputed = `d0b8e3dd14a59caf7b0fb7b8f600b2bc7572481ffb11c8906383a5f7d87b155d` — byte-for-byte EQUAL to the published body `original_receipt.identity_before.extract_sha256`, proving the census-string construction is byte-identical to the pre-publication one.
- value == body `original_receipt.identity_before.value` == frozen identity string, byte-for-byte. ORIGINAL_RECEIPT_PRESERVED = YES.

## 3. supplement.identity_after

```json
{
  "value": "device=16777230 inode=62733028 size=8437 uid=0 gid=0 mode=0644 mtime_epoch=1788418352 birthtime_epoch=1788418352 nlink=1 flags=- acl=empty xattr=com.apple.provenance sha256=70bb1672361d52ec0ad1d87cfbc3d01af1fd113cde079f9eea704c9a61ac2239",
  "path": "/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT_RECOVERY_V1.json",
  "time": 1788418996610,
  "extract_sha256": "a3f74555c9160c6893dbf65a83bda5cbe0b63d770bb9023d660561c84b39927b",
  "provenance": "CURRENT_REOBSERVED"
}
```

`xattr=com.apple.provenance` is informational macOS provenance metadata (no byte effect); sha256/content unchanged.

## 4. receipt_recovery_publication = PASS

- Owner transcript locator: `/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-receipt-recovery-v2-artifact/OWNER_EXECUTION_TRANSCRIPT.txt`
  - `exit_code=0`
  - `RESULT_PUBLISHED final_path=/Users/yanfenma/workspace/deployment-artifacts/workflow-execute-unified-a7e732f/DEPLOYMENT_RECEIPT_RECOVERY_V1.json sha256=70bb1672361d52ec0ad1d87cfbc3d01af1fd113cde079f9eea704c9a61ac2239 bytes=8437` — sha and bytes MATCH this round's independent re-hash of the live file.
  - `ORIGINAL_RECEIPT_IDENTITY_AFTER=device=16777230 inode=62490135 size=0 uid=0 gid=0 mode=0644 mtime_epoch=1788391655 birthtime_epoch=1788391655 nlink=1 flags=- acl=empty xattr=empty sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` — MATCHES §2 value byte-for-byte.
  - `TRANSIENT_CLEANED=yes`
  - transcript sha256 = `84347dd8f658f5fb135fcc25722c2e6fa139428d2815c47e258683793d28bb61`; mtime 2026-09-03 14:52 CST (publication execution time).

## 5. transient_cleaned = YES

- staging dir `/Users/yanfenma/workspace/deployment-artifacts/.rr2-staging-e01de92c4331076553f87de1` — ABSENT (`No such file or directory`).
- temp receipt `/Users/yanfenma/workspace/deployment-artifacts/.rr2-staging-e01de92c4331076553f87de1/DEPLOYMENT_RECEIPT_RECOVERY_V1.json.tmp` — ABSENT.
- `ls deployment-artifacts | grep -i rr2` → NO_RR2_LEFTOVERS.

## 6. p1_p2_unchanged = YES

P1 `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js`:
- sha256 `7e4c6fa9b6f455506812f774565abcda2b394857a908c1f8cc1f36bc69c67aee` == baseline `.current_reobserved.p1_git_blob.sha256`
- `git hash-object` = `db7688fe1cc428aa1260e1372920ff744a076013` == baseline p1 git blob
- root:wheel, mode `100644`, mtime epoch `1788391461` (Sep 3 07:24 CST — before publication), size 25211, inode 62489236

P2 `/usr/local/libexec/agent-core/app/packages/broker/src/registry.js`:
- sha256 `628abde2069028c832eb76699ad2dd8521528288f396680d39dffb353d985382` == baseline `.current_reobserved.p2_git_blob.sha256`
- `git hash-object` = `2f5e55b772e25093b7fec480a76fe47d6993b860` == baseline p2 git blob
- root:wheel, mode `100644`, mtime epoch `1788391461` (Sep 3 07:24 CST), size 9382, inode 62489237

Loader consistency (verify #8, no E2E re-run): deployed workflow.js is the exact audited/accepted blob (db7688fe); its in-file surface comment binds `workflow_execute` as "the sole workflow write tool" (DEC-010) with exactly two operations (create_instance, transition); registry.js blob unchanged; runtime PIDs/health unchanged vs baseline. The workflow_execute surface is untouched.

## 7. pids_unchanged_vs_baseline = YES / RUNTIME_RESTARTED = NO

Per §7 the publication transaction is bound against the 13:36:11 baseline in the published body (the child production-runtime restart at ~13:36:11 PRE-DATES the publication transaction and is the baseline):

- PID 69904 `/usr/local/libexec/agent-core/node-runtime/bin/node /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0` — started `Thu Sep  3 13:36:11 2026`, STILL RUNNING at audit time (identical PID + start time to baseline `.current_reobserved.parent_child_pid_start` → no restart caused by the publication transaction).
- PID 1696 `... production-runtime.mjs --root /Users/yanfenma/.agent-core-scheduler-v2 --catchup 0` — started `Sun Aug 30 01:17:33 2026`, matches baseline.

## 8. runtime_health = PASS

- `curl 127.0.0.1:8790/health` → `{"ok":true,"service":"agent-core-notification-ingress","deliverReady":true,"authConfigured":false,"storeReady":true}` — byte-equal to baseline `.current_reobserved.runtime_health.runtime_8790_health`.
- `curl 127.0.0.1:4001/api/health` → `{"ok":true,"service":"auth-service","version":"1.0.0","issuer":"auth-service","audience":"agent-platform","authContractMode":"v1","authContractVersion":"1.3.0","authContractDigest":"15f9a591e25fb1dca99c2a02d8362c83e41f4a932ca0710d97a602e18a8234ad","timestamp":"2026-09-03T06:57:10.704Z"}` — `ok:true`, authContractDigest == baseline; live timestamp.

## 9. no_unrelated_mutation — UNRELATED_PRODUCTION_MUTATION = NONE

- launchd (`launchctl list | grep -E "agent-core|svc-workflow|auth-service"`):
  - `ai.agent-core.scheduler-v2` PID 1696 — identical to body-era observable.
  - `com.svc-workflow` PID 58020, started `Wed Sep  2 18:19:18 2026` — predates the transaction, stable across the whole audit window.
  - `com.auth-service` label shows flapping transient child PIDs with last-exit-status 1 (PID 86488 present at first sample ~14:56, gone by 14:57; 86877 seen ~14:59). The actual 4001 server is PID 829 (`node .../production-auth-service-3b2ae71c/dist/src/server.js`, started `Sun Aug 30 01:16:54 2026`) and serves health `ok:true` with the SAME authContractDigest as baseline throughout. This flapping pattern pre-existed the audit window (transient PID already present at first sample, before any audit action) and the baseline body recorded no launchd/auth-service PIDs; the comparison basis is the health endpoint (same shape + same contract digest) and the file mtime scans below. Recorded informationally; no evidence of transaction-caused change.
  - `com.svc-workflow-monitor` — `-` (no resident PID; periodic job), see note below.
- Grant: NOT re-read (forbidden: metadata only). No Grant artifact census exists pre or post; recorded as absence-of-census (same as baseline body). `grant_current.value = null` in the published body — carried forward unchanged; GRANT_CHANGED = NO is supported by absence of any change vector (auth-service DB untouched; no credential/Grant artifacts written by the transaction; only durable output was the allowlisted supplement JSON).
- Credential (metadata-only census, no content read): `/usr/local/libexec/agent-core/config/agent-credentials.json` size=`11723` mtime epoch=`1787881119` (uid=505 gid=601 mode=`0600` inode=56011171) — EXACTLY equals baseline `.current_reobserved.credential_current` (size_bytes 11723, mtime_epoch 1787881119). CREDENTIAL_CHANGED = NO.
- File mtime scans (`find <tree> -newermt "2026-09-03 13:38:00"`, artifact freeze time):
  - `/usr/local/libexec/agent-core` → ZERO paths modified after 13:38.
  - `/Users/yanfenma/workspace/project/production-auth-service-3b2ae71c` (auth-service install, per `/Library/LaunchDaemons/com.auth-service.plist`) → ZERO paths modified after 13:38 (excl. node_modules).
  - `/Users/yanfenma/.local/services/svc-workflow` → exactly ONE path with post-13:38 mtime: `monitor/fail-counter.state` (size 2, content `0`, mtime 1788418788 = 14:59:48 CST, uid 502). Determined to be the pre-existing svc-workflow-monitor's own per-60s health-check bookkeeping: `monitor/check.sh` (dated Jul 28) rewrites the fail counter (`write_state 0`) on EVERY healthy cycle; `~/Library/Logs/svc-workflow/monitor.log` shows `OK port=1 healthz=200 readyz=200 jwks=200` every minute (30683 OK entries; last alert Aug 13). Healthy value, by-design periodic churn of observability infrastructure — NOT a production code/config/data/Grant/credential/receipt mutation, NOT caused by the receipt publication (the transaction's only durable output was the allowlisted supplement JSON). Recorded for transparency.

## 10. §9 Success criterion

```text
RECEIPT_RECOVERY_AUTHORITY = ACCEPTED
RECEIPT_RECOVERY_ARTIFACT_GATE = PASS
RECEIPT_RECOVERY_PUBLICATION = PASS
ORIGINAL_RECEIPT_PRESERVED = YES
P1_P2_UNCHANGED = YES
RUNTIME_RESTARTED = NO
WORKFLOW_E2E_REPEATED = NO
GRANT_CHANGED = NO
CREDENTIAL_CHANGED = NO
UNRELATED_PRODUCTION_MUTATION = NONE
WORKFLOW_EXECUTE_RECEIPT_TERMINALIZATION = PASS
```

Line justifications (this round, all read-only): authority commit `062120bd…` accepted (frozen inputs re-hashed, all MATCH); artifact gate PASS (frozen gate inputs re-verified: manifest/wrapper/body digests); publication PASS (§4); original receipt preserved (§2, byte-for-byte); P1/P2 unchanged (§6); runtime not restarted BY THIS TRANSACTION — PID 69904 start 13:36:11 unchanged vs the §7-bound baseline (§7); no E2E repeated in this audit round (verify #8 done via blob/registry/PID/health invariance only); GRANT_CHANGED = NO (no Grant access, no change vector, absence-of-census carried forward unchanged); CREDENTIAL_CHANGED = NO (§9, metadata exact match); unrelated mutation NONE (§9, incl. the monitor-state informational note); terminalization PASS = conjunction of the above.

## 11. WORKFLOW_EXECUTE_PRODUCTION_READY = NOT_ESTABLISHED

Per §9, `WORKFLOW_EXECUTE_PRODUCTION_READY = YES` requires ALL of: pre-recovery durable target-live catalog; create/transition/final-readback E2E; Owner/root exit-zero with exact-wrapper-derived safety assertions; and the recovery-time read-backs of P1/P2/PID/health/current Grant/current credential — each with verifiable locator/time/digest and mutually consistent. MUST fall to `NOT_ESTABLISHED` if any element is missing or has unknown provenance, and receipt recovery MUST NOT self-upgrade parent-transaction evidence; unknown original values remain unknown.

Present with verifiable locator/time/digest (verified this round):

- pre-recovery durable target-live catalog — published body `.pre_recovery_durable.catalog_header` (session.jsonl seq 49984, time 1788391646586, extract_sha256 `9e17c49b…`), carried in the byte-verified published supplement.
- create/transition/final-readback E2E — published body `.pre_recovery_durable.e2e_events` (6 events, seq 50593–51038, each with time + extract_sha256; EXACTLY_ONCE bound by single transition call + terminal readback).
- recovery-time Owner/root exit-zero + exact wrapper — transcript path §4 with exit_code=0, sha256 `84347dd8…`, wrapper sha `3ed44a21…` bound in both frozen manifest and published body `.recovery_authority.artifact_sha256`.
- recovery-time P1/P2 read-back — §6 (digests + git blobs + mtime).
- recovery-time PID/health read-back — §7/§8 (vs §7-bound 13:36:11 baseline).
- recovery-time current credential read-back — §9 (size 11723 / mtime 1787881119 exact match, metadata-only).

Missing / unknown (decisive per §9 MUST):

1. current Grant read-back: `grant_current.value = null` in the published body ("auth-service DB not directly readable in this round; recorded as metadata-only absence-of-census"); this audit round is likewise forbidden from Grant access (metadata only). No locator/time/digest exists for a current-Grant observation → required conjunction element MISSING.
2. parent-transaction unknowns that receipt recovery may not self-upgrade: `original_transaction` (transaction_id, a4_before, grant_before_sha256, credential_before_sha256) all `null` provenance `UNKNOWN_NOT_DURABLY_RECORDED`, and `control_flow.owner_root_exit_zero_evidence/conclusion = null` provenance `UNKNOWN_NOT_DURABLY_RECORDED` for the ORIGINAL unified-publication wrapper (`OWNER_EXECUTE_WORKFLOW_EXECUTE_UNIFIED_A7E732F.sh`). Per §9, "任一缺失或 provenance 为 unknown 时 MUST 写 NOT_ESTABLISHED" and unknown original values remain unknown.

Therefore: `WORKFLOW_EXECUTE_PRODUCTION_READY = NOT_ESTABLISHED` (not a finding against the recovery — RECEIPT_TERMINALIZATION = PASS stands; the composite production-ready upgrade is withheld because the required current-Grant census and durable parent-transaction evidence remain absent/unknown, and recovery may not manufacture them).
