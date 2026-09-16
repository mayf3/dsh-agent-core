# CANONICAL_AGENT_FLEET_SEND — PRODUCTION_RECOVERY_PACKET v2

- date: 2026-09-16
- stage: READY_FOR_OWNER_REDEPLOY_GATE（SOURCE_FIXED=YES / PRODUCTION_FIXED=NO）
- PR #75 historical merge remains `587c7199c0d626c595c4da8603a6135a7677305f` from exact reviewed head `7741b76c438e878d8f5edadf325a276f0eeaa92c`.
- Auth `main` has since advanced; this v2 supersedes packet v1's deployment target and its obsolete “no schema migration exists” statement.
- This packet authorizes nothing by itself. Production process switch remains Owner-gated; `reconcile --apply` and canonical-subject DDL/data apply remain separately gated.

## 1. Fresh Auth main / deployed-version readback

```text
AUTH_CURRENT_MAIN = 785d7430fd0b6b9dd3aa7c110ed857fed9fea865
LOCAL_AUTH_CHECKOUT = 785d7430fd0b6b9dd3aa7c110ed857fed9fea865
PR75_MERGE_IN_LINEAGE = YES

587c719 -> 785d743:
  AHEAD_BY = 18 commits
  FLEET_SEND_IMPLEMENTATION_FILES_CHANGED = NO
  SERVER/ROUTES/DIRECT/TOKEN_ISSUANCE_RUNTIME_PATHS_CHANGED = NO
  NEW_DOMAIN = canonical-subject enrollment control plane

DEPLOYED_RUNTIME = production-auth-service-session-trace-v2-r2-4e68f83ee4d3
DEPLOYED_LAGS_MAIN = YES
HEALTH = PASS
AUTH_CONTRACT_VERSION = 1.12.0
AUTH_CONTRACT_DIGEST = 131105f186688f6020aa3bae56f551ca1762b2a2cd31c29d07e97e7a4244e212
```

## 2. Main drift disposition: canonical-subject migration is dormant and NOT part of this deploy

`785d743` adds:

```text
prisma/migrations/202609160001_canonical_subject_enrollment/migration.sql
prisma/schema.prisma additions
src/lib/oauth/v1/canonical-subject-enrollment.ts
scripts/canonical-subject-enrollment.ts
```

Its accepted governing Spec states:

```text
production_apply_authority: none
PRODUCTION_APPLY_ALLOWED = NO
```

Fresh source check proves the new control plane is not imported by `src/server.ts`, routes, broker runtime paths, direct issuance, or token issuance. It is exposed only through the explicit standalone CLI/package script.

Therefore the fleet-send production closure may redeploy the current main process bytes, but MUST NOT run:

```text
prisma migrate / prisma db push
canonical-subject-enrollment apply
any canonical-subject production DDL/data mutation
```

The old packet-v1 phrase “this main has no Prisma schema change” is retired as false for current main. The correct boundary is: **current main contains a dormant, production-apply-forbidden migration; this redeploy does not apply it.**

## 3. Fresh staging and verification

Exact staging directory:

```text
/Users/yanfenma/workspace/project/
production-auth-service-fleet-send-785d7430fd0b6b9dd3aa7c110ed857fed9fea865
```

Preparation/readback:

```text
SOURCE_ARCHIVE_HEAD = 785d7430fd0b6b9dd3aa7c110ed857fed9fea865
NPM_INSTALL = PASS
PRISMA_GENERATE = PASS
DIST_SERVER = PRESENT
DIST_FLEET_MODULE = PRESENT

SERVER_SHA256 = f540ed511032898728ad8eb26ed9554ab9878009b94e22f9fecae2af8c846828
FLEET_MODULE_SHA256 = dbf2b06c10733004aa9f75fac383ed9be2b9f341e5210526ffe78501cdcf190c
RECONCILE_SOURCE_SHA256 = 69affa7298fdfadb796e008155bbdaf2523462e0b4d64e5d447c3a54714e6874
CSE_MIGRATION_SHA256 = 7a37e90f73a97a346b2a0516700e09bb9897a0c68471f62a656abca9b9ac9df3
```

Build truth, without laundering the inherited baseline:

```text
npm run build = EXIT 2
TYPECHECK_DIAGNOSTIC_COUNT = 1
ONLY_DIAGNOSTIC = src/lib/oauth/forum-direct-agent-token.ts:142 TS2322
                 forum.direct_agent_token.minted not assignable to AuditEventType
DIAGNOSTIC = inherited baseline already recorded by merged current-main implementation report
DIST_EMIT_SUCCEEDED = YES
NEW_FLEET/CSE_TYPESCRIPT_DIAGNOSTICS = 0 observed in the build output
```

Fresh tests on this exact staging tree:

```text
FLEET_FOCUSED = PASS 13/13
  includes RG1 HR dual-scope preservation
  includes RG2 secret-loss rollback/retry
  includes RG3 P2002 convergence
RECONCILE_SELFTEST = PASS / SELFTEST_ALL_OK 3/3
CANONICAL_SUBJECT_ISOLATED_TESTS = PASS 28/28
NPM_TEST = PASS 48/48
```

DB-dependent generic idempotent conformance was not run against production; an earlier mixed invocation without `DATABASE_URL` failed for environment absence and is not counted as a product failure.

## 4. Fresh production lane / prestate

```text
LIVE_PLIST = /Library/LaunchDaemons/com.auth-service.plist
LIVE_PROGRAM = .../production-auth-service-session-trace-v2-r2-4e68f83ee4d3/dist/src/server.js
LIVE_WORKING_DIRECTORY = .../production-auth-service-session-trace-v2-r2-4e68f83ee4d3
LIVE_ENV_META = authsvc:authsvc 0600
PROGRAM_ARGUMENT_2_PRESENT = NO
HEALTH = 200 / ok=true
MUTATION_PROCESS_SCAN = FREE
  no active fleet reconcile --apply
  no prisma migrate
  no canonical-subject apply
```

This is a point-in-time process-lane readback only. The deploy script repeats the prestate and lane gates immediately before any mutation.

## 5. Exact Owner-run switch prepared

Prepared local script:

```text
/private/tmp/auth-fleet-send-main-switch-785d743.sh
SHA256 = 2d2dbe1bde9c7215c7bbb67eb4d7c60fc0c120e8e290974fa5ed720f2a248dd2
SHELL_SYNTAX = PASS
--preflight = PASS
PRODUCTION_MUTATION_PERFORMED_BY_PREFLIGHT = NO
```

The script is pinned to exact target `785d7430fd0b6b9dd3aa7c110ed857fed9fea865` and fails before mutation if live prestate, artifact hashes, health/contract digest, plist argument shape, `.env` ownership, JWKS, or mutation-lane checks drift.

Apply behavior is deliberately narrow:

```text
1. re-run all preflight gates
2. exact backup of current plist
3. preserve live .env as authsvc:authsvc 0600 in the staged tree
4. change only ProgramArguments[1] and WorkingDirectory
5. bootout + bootstrap com.auth-service (loaded definition is reread)
6. verify exactly one :4001 listener and exact staged server path
7. health + contract digest + JWKS readback
8. on any post-mutation failure restore exact plist preimage and bootstrap old 4e68f83e runtime
```

Explicitly absent from the switch script:

```text
prisma migrate / db push
canonical-subject apply
reconcile-fleet-send-grants --apply
Grant mutation
credential mutation
```

Owner execution command, only after the production redeploy gate is granted:

```bash
sudo bash /private/tmp/auth-fleet-send-main-switch-785d743.sh
```

## 6. Post-deploy sequence (not yet executed)

After the switch returns `AUTH_SERVICE_DEPLOYED_MAIN=YES` and health readback passes:

```text
A. fresh live version/path readback
B. reconcile --selftest
C. reconcile default DRY_RUN only
D. review the fresh census and every ADD/NORMALIZE disposition
E. obtain a separate production authorization for --apply
F. reconcile --apply
G. post-apply fresh census; require SEND_ENTITLEMENT_MISSING_COUNT=0
H. verify HR inspection preserved
I. accepted §10.1 / E2E acceptance chain
```

No historical `≈89/≈87` estimate may authorize mutation. Fresh DRY_RUN is authoritative.

## Current state

```text
CURRENT_MAIN = 785d7430fd0b6b9dd3aa7c110ed857fed9fea865
DEPLOYED_VERSION = 4e68f83e generation
CURRENT_STAGE = READY_FOR_OWNER_REDEPLOY_GATE
SELFTEST = PASS
DRY_RUN = NOT_RUN
APPLY = NOT_RUN
MISSING_COUNT = UNKNOWN_FRESH
PRODUCTION_MUTATION_PERFORMED = NO
CURRENT_BLOCKER = Owner production redeploy gate only
NEXT_SINGLE_ACTION = OWNER_AUTHORIZE_AND_RUN_EXACT_785D743_PROCESS_SWITCH
```
