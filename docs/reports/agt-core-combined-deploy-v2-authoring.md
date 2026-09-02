# AGT_CORE_COMBINED_DEPLOY_V2_AUTHORING (TASK_NAME = 合署 执行)

- date: 2026-08-31
- type: deployment authoring (runner + receipt template + --check result)
- production change: **NONE** (authoring round; runner never applied)
- old runner `/tmp/run-agent-core-workflow-combined-deploy-v1.sh` (sha256
  `e00f8330b9a872d40cad5649c587f4ad1a8dcffa9ece5fe21abf4bade5bb3fd5`) re-verified
  byte-identical and **left untouched**; the new runner is a separate file.

## 1. Outcome

`合署 执行 = RUNNER_READY (canary prerequisite pending external task)`.
One new combined runner + one new receipt template were authored and validated
(`bash -n` PASS, `shellcheck` 0 findings, read-only `--check` executed,
embedded programs syntax-checked and the smoke program live-proved against the
real TARGET_MAIN blobs in a simulated tree). The runner carries BOTH the
pending accepted Workflow Broker delta and the freshly merged Forum Broker
delta as **ONE DEPLOY + ONE AGENT CORE RELOAD**. It is **not** executed this
round; `--apply` additionally fail-closes until the separate canary-prep task
delivers `/tmp/agent-core-workflow-canary-v1.json`.

## 2. Authoring gate (all six steps, fresh)

1. **Fresh fetch after Forum merge.** `git fetch github main` executed at
   authoring time; the Forum merge landed mid-round (PR #105 merge
   `2392a41d4655ba25ed9e9749fbf8beb0ad1c71b4`, parents `6478356` + impl head
   `83165dea530956a8836e9830c54811eb3a8ae93e`).
2. **TARGET_MAIN pinned** = `2392a41d4655ba25ed9e9749fbf8beb0ad1c71b4`
   (fresh github/main at authoring time; runner requires exact equality and
   refuses if main moves — re-audit required).
3. **LIVE_MANIFEST recomputed** with the audited v1 algorithm (non-root,
   world-readable live tree): **132 files /
   `9ac84954fefc3d5893b7e5ca7045b2bb7cf0ad7492d121607d2b0659a230f4b1`**
   — byte-identical to the drift-v3 frozen state (live unchanged since
   2026-08-30T16:23Z). No old manifest SHA was reused as authority: the
   BASE digest was re-derived this round from the live tree itself.
4. **Fresh exact OID census** live → TARGET_MAIN over the union of the live
   manifest scope and main's tree under the same prune rules
   (`evidence/census-diff.txt`): 9 in-manifest OID diffs, 0 live-only paths,
   2 main-only new src files, plus 1 out-of-manifest bundle-config diff.
5. **Every drift classified** (below).
6. **Nothing deployed merely because it is on main.**

## 3. Census classification

### 3.1 AUTHORIZED_DEPLOYMENT_FILES (9; every file traces to accepted Spec
with `implementation_authority: contracts` + merged implementation)

| # | path | live OID | TARGET OID | authority |
|---|---|---|---|---|
| 1 | packages/broker/src/capabilities/workflow.js | 04ca8550 | 83df50eb | TRANSITION V1 (PR #125 → `1aa8248`) + PAGINATION V2 (PR #126 → `4d7ca24`) |
| 2 | packages/broker/src/mapping.js | 890d35b9 | 74e83e11 | TRANSITION + PAGINATION + FORUM V2 (PR #105) |
| 3 | packages/broker/src/schema.js | 13f80f87 | 1bd36bbe | TRANSITION + PAGINATION + FORUM V2 (PR #105) |
| 4 | packages/broker/src/capabilities/forum.js | f068c171 | b64b7357 | FORUM V2 (PR #105 → `2392a41`) |
| 5 | packages/broker/src/capabilities/forum-moderation.js | ABSENT (new) | 90cf87c3 | FORUM V2 CTR-FMC-003/014 (PR #105) |
| 6 | packages/broker/src/error-detail-sanitizer.js | ABSENT (new) | 25e02239 | FORUM V2 CTR-FMC-012/013/014 (PR #105) |
| 7 | packages/broker/src/index.js | 6c4a60af | a543e586 | FORUM V2 CTR-FMC-004/014 (PR #105) |
| 8 | packages/broker/src/transport.js | b697850c | 942e9880 | FORUM V2 CTR-FMC-013/014 (PR #105) |
| 9 | bundle-broker/cordis.patch.yml | b84c6296 | 768ddec | FORUM V2 CTR-FMC-004/014 (PR #105) |

Governing specs (all at TARGET_MAIN, `status: accepted`):
`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1` (contracts; amended
2026-08-31 incl. CTR-009 canary gate, accepted via PR #129 → `6478356`),
`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2` (contracts),
`AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2` (contracts; whole successor of
V1), plus the ERROR_PRESERVATION_V1 family discipline (accepted; its own
implementation already deployed at PR #82 — this delta preserves the family
and lands the V2 sanitizer restatement, `error-detail-sanitizer.js`).

Notes on fresh derivation:
- The closure was derived from the census, **not** from the old runner's
  "Workflow 3 files" or any "Forum 7 files" number. At TARGET_MAIN,
  `mapping.js`/`schema.js` carry BOTH the Workflow and Forum deltas (their
  OIDs differ from the old runner's pagination-era pins — exactly why the old
  runner could not be reused).
- File 9 (`bundle-broker/cordis.patch.yml`, the moderator registration
  config) is **outside the app manifest** (bundle-* is pruned by the audited
  manifest algorithm); it is pinned and deployed by its own blob OID and
  enters production **through the normal bundle build flow**: the per-agent
  child composition resolves `bundle-broker` via the repo farm link
  (`agent-provisioning` `farmLinks: bundle-broker → bundle-broker`), so the
  single reload picks it up at child composition. No per-agent copy is
  hand-patched.
- PR #105's other 4 files are tests (`broker.test.js`,
  `forum-capabilities.test.js`, `generic-deltas.test.js`,
  `transport.test.js`); none exist in the live app manifest — **tests are not
  production delta** (structural: the live tree carries no test files).

### 3.2 EXCLUDED_DRIFT (live ≠ TARGET_MAIN; pinned at live OID; NEVER written;
any drift in either direction refuses all writes)

| path | live OID | main OID | authority reason |
|---|---|---|---|
| packages/production-runtime/src/model-overrides.js | ea44819a | f1e09d47 | emergency breakglass (2026-08-30T16:23Z, luna fleet), pending Owner ratification; never written by any deploy runner |
| packages/feishu-connector/src/index.js | 2e6bd089 | bd3b0e5b | introduced by `9386ac4` "feat: enable scheduler success Feishu cards" — merged but NOT authorized for this deployment (no accepted deployment authority in this task; separate monotonic round required) |
| packages/scheduler-router/src/index.js | b1f55634 | c05c6087 | same `9386ac4`; unauthorized Scheduler delta |

Also structurally out of scope (untouched, not even pinned in the manifest
scope): credentials store, identity stores, svc-workflow, Forum server
(svc-forum container untouched — FORUM V2 reuses the deployed server per
CTR-FMC-001).

## 4. Manifest states (fresh)

- BASE (current live): **132 / `9ac84954fefc3d5893b7e5ca7045b2bb7cf0ad7492d121607d2b0659a230f4b1`**
- TARGET (after the 6 in-manifest OID swaps + 2 new files; derived
  mechanically, `evidence/census-target-manifest.txt`):
  **134 / `865b6569591e361b18ffcde01251c0b2c2ba160818a0738127a2e8a0bcf2a8d6`**
- The two new files are absent in BASE ("ABSENT" pins) — preflight requires
  their absence; rollback removes them and fsyncs the parents.

## 5. Canary prerequisite (fail closed)

`/tmp/agent-core-workflow-canary-v1.json` (fixed path, generated by the
separate canary-prep task) **does not exist at authoring time** →
`CANARY_PREREQS_READY = NO` → `--check` **fails closed (exit 2, CHECK=FAIL)**
and `--apply` refuses before any write. This is the required behavior, not a
defect; when the config lands, `--check` re-evaluates it.

Runner-side validation (embedded python3, never prints config bytes):
- exists, regular file, non-symlink, non-empty, valid JSON;
- **no placeholders** (PLACEHOLDER/TODO/TBD/FIXME/CHANGEME/`<var>`/example.
  com/your-/XXX patterns);
- **no secrets** (private-key headers, JWT-looking strings, ≥48-hex runs,
  ≥44-base64 runs, and secret-like keys with values: clientSecret/token/
  password/apiKey/...);
- **SHA pin**: `--check` prints `CANARY_CONFIG_SHA256`; `--apply` takes that
  digest as its only argument and refuses on any byte mismatch — the reviewed
  config is the applied config;
- **canary identity == accepted CTR-009** default (and currently only) canary
  identity `agt_build-in-public-agent` (TRANSITION V1 §9 CTR-009);
- **dedicated instance** (`canaryInstanceId ≠ controlInstanceId`, title must
  contain "canary", `dedicatedNoBusinessSideEffects: true`);
- **exact assignee** (`expectedAssigneePrincipalId` UUID; the canary program
  additionally proves the credential JWT `sub` equals it at wire time);
- **baselines valid** (`expectedWorkflowStateVersion` integer ≥ 1,
  `transitionDefinitionId` UUID, pagination constraints 1..20 / ≥2 pages /
  instances > one page, optional `submissionPayload` object, optional
  `expectedSubmissionSchemaKeys` string list).
- Optional `forumSmokeAgentId` (agt_* with forum.read) enables read-only
  forum wire smoke; absent → `FORUM_WIRE_SMOKE=SKIPPED_NO_IDENTITY`.

Validator fixture matrix (`evidence/validator-fixtures-output.txt`):
valid → READY=YES; placeholder → NO; secret → NO; wrong identity → NO;
missing → NO.

## 6. New runner

- **NEW_RUNNER** = `/tmp/run-agent-core-combined-deploy-v2.sh`
- **NEW_RUNNER_SHA256** = `18c1fdc64941f67b1a0fc3a7f03cad48063d9620a9e0b57a837eee8635708944`
  (sealed byte-identical copy in evidence)
- `BASH_N = PASS`; `SHELLCHECK = PASS` (0 findings)
- Owner command (after the canary config passes `--check`):
  1. `bash /tmp/run-agent-core-combined-deploy-v2.sh --check`
  2. `sudo bash /tmp/run-agent-core-combined-deploy-v2.sh --apply <CANARY_CONFIG_SHA256>`
     with interactive phrase `APPLY AGENT_CORE_COMBINED_DEPLOY_V1`.

### 6.1 Inherited audited safety mechanisms (all present)

root gate (uid-0 required; runner never sudo) · explicit owner phrase ·
pre-manifest SHA (BASE/TARGET dual state machine) · exact source blob pins
(`git show TARGET_COMMIT:path` + hash-object verify, per file) · exact file
closure (9 paths, index-aligned pins) · breakglass pin (never written) ·
lstat/symlink guards (live root, backup root, credentials, every delta path;
new-file paths must be absent) · stage (`mktemp -d` under TRUSTED_ROOT, fsynced)
· durable backup (+README provenance incl. census + runner self-sha256) ·
fsync (file + dir + parent chain, python3 O_NOFOLLOW/O_DIRECTORY helpers) ·
byte verification (staged OID + pre/post-install tree verification) · atomic
install (install-to-tmp + fsync + mv + parent fsync) · **ONE reload**
(`launchctl kickstart -k system/ai.agent-core.runtime` once on success,
RESTART_COUNT invariant) · post-manifest verification · workflow transition
canary (pre-reload, against installed files; failure ⇒ durable rollback with
zero reloads) · idempotent replay (TARGET ⇒ `APPLY=NOOP_ALREADY_TARGET`,
exit 0) · control instance unchanged (canary asserts byte-equal detail +
domain membership) · rollback (restore 7 + remove 2 new + fsync + verify
BASE) · rollback reload (single recovery restart after the success-path
restart) · `ROLLBACK_INCOMPLETE` exit 3 (lock+backup retained) · durable
receipt (JSON receipt fsynced inside backup + ledger line fsynced; commit
point semantics preserved) · rerun NOOP · secret zero output (config bytes
never echoed; programs print only id/boolean summaries).

### 6.2 Canaries and smoke

- **Transition canary (pre-reload)** — audited v1 program plus CTR-009
  acceptance assertions: pagination full-walk (no duplicate ids/cursors,
  terminal null cursor, ≥ pages/instances floor); exact-assignee proof
  (JWT `sub` == pinned principal); `Idempotency-Key` prefix;
  **response `workflowStateVersion == V+1`, `eventSequence` present,
  `currentNodeVisitId != sourceNodeVisitId`**; same-key replay byte-identical
  (status + content-type + raw body + parsed); detail re-read == V+1 with a
  new current node visit; control instance byte-unchanged; other domain
  instances unchanged.
- **Post-reload combined smoke (same single reload)** —
  Workflow: all 7 manifests visible incl. `workflow_domain_instances`,
  `workflow_global_instances`, `workflow_transition` (submit = POST +
  idempotent binding);
  Forum normal: `forum_create_thread`/`forum_watch_thread`/
  `forum_unwatch_thread`/`forum_report_content`/`forum_stats` visible with
  exact CTR-FMC-002 scopes; existing 7 tools invariant (CTR-FMC-010);
  optional read-only list/search/read wire calls when `forumSmokeAgentId`
  is supplied;
  Moderator: exactly `agt_course-community-agent-2` — 8-tool pack with exact
  CTR-FMC-003 scopes, `resolveForumModeratorRegistration` matrix
  (member=8 / non-member=0 / absent env=0 / empty list=0 / malformed list=0),
  deployed `bundle-broker/cordis.patch.yml` list == exactly
  `['agt_course-community-agent-2']`, and DEFAULT_MANIFESTS carries zero
  moderator tools. **Moderator tools are never invoked** by the runner: an
  unsupplied `forum.moderate` grant (authorization_denied at call time) is
  the expected fail-closed state and must not roll back the normal Forum
  deployment — so the proof is the registration seam, by design.
- Smoke program live-proved against the real TARGET_MAIN blobs in a
  simulated live-layout tree (real `@deepseek-ai` deps, unchanged live
  packages symlinked): all three sections PASS,
  `FORUM_WIRE_SMOKE=SKIPPED_NO_IDENTITY` (`evidence/smoke-sim-output.txt`).

### 6.3 Receipt template

`evidence/receipt-template.json` (also embedded as `write_receipt_template`
in the runner): static provenance (TARGET_MAIN, merge authorities, BASE/
TARGET manifests, 9-file delta table with base/target OIDs, excluded-drift
table with reasons, canary identity) + runtime fields (timestamps, runner
self-sha256, backup path, canary config sha256, canary + smoke summaries,
reload count). Rendered receipts are JSON-validated before they become
durable; the ledger line points at the receipt path.

## 7. --check result (this round)

```
CANARY_ISSUE=file_missing: /tmp/agent-core-workflow-canary-v1.json
CANARY_PREREQS_READY=NO
LIVE_MANIFEST=132/9ac84954... state=BASE
DEPLOYMENT_DELTA=9 files (7 modified + 2 new; 8 in-manifest + 1 bundle config) iff state=BASE; 0 iff state=TARGET
BREAKGLASS=packages/production-runtime/src/model-overrides.js@ea44819a pinned-never-written
EXCLUDED_DRIFT=packages/feishu-connector/src/index.js@2e6bd089 packages/scheduler-router/src/index.js@b1f55634 (unauthorized 9386ac4; pinned-never-written)
TARGET_MAIN=2392a41d... contains=1aa8248,4d7ca24,2392a41 (forum impl head 83165de)
CHECK=FAIL (canary prerequisites not ready; apply is refused)   [exit 2]
```

Everything except the external canary config PASSed (fresh fetch + authority
pins, BASE manifest, service preflight). `CHECK_MODE = FAIL (fail-closed by
design — external prerequisite pending)`.

## 8. Boundaries

- **Docs/evidence only**; the runner was never applied; no deploy, no reload,
  no production write, **PRODUCTION_CHANGE = NONE**.
- Production access entirely read-only: live manifest recompute (world-
  readable tree), `/health` GET, `launchctl print`, file stats.
- Zero credential reads (the smoke sim never constructed a gateway).
- Old runner v1 left byte-identical and untouched; its B1 (main moved past
  `4d7ca24`) and B2 (canary config absent) blockers are inherited-resolved by
  this runner's fresh TARGET_MAIN pin and the canary prerequisite gate.
- Pre-existing WIP (broker modifications, untracked docs, hotstandby
  evidence revisions) untouched; new files staged by explicit path only.

## 9. Final

```
TASK_NAME = 合署 执行
TARGET_MAIN = 2392a41d4655ba25ed9e9749fbf8beb0ad1c71b4
LIVE_MANIFEST_FILES = 132
LIVE_MANIFEST_SHA256 = 9ac84954fefc3d5893b7e5ca7045b2bb7cf0ad7492d121607d2b0659a230f4b1
AUTHORIZED_DEPLOYMENT_FILES =
  packages/broker/src/capabilities/workflow.js            04ca8550 -> 83df50eb
  packages/broker/src/mapping.js                          890d35b9 -> 74e83e11
  packages/broker/src/schema.js                           13f80f87 -> 1bd36bbe
  packages/broker/src/capabilities/forum.js               f068c171 -> b64b7357
  packages/broker/src/capabilities/forum-moderation.js    NEW      -> 90cf87c3
  packages/broker/src/error-detail-sanitizer.js           NEW      -> 25e02239
  packages/broker/src/index.js                            6c4a60af -> a543e586
  packages/broker/src/transport.js                        b697850c -> 942e9880
  bundle-broker/cordis.patch.yml                          b84c6296 -> 768ddec   (bundle build flow)
EXCLUDED_DRIFT =
  packages/production-runtime/src/model-overrides.js   (breakglass, pending ratification; pinned ea44819a)
  packages/feishu-connector/src/index.js               (unauthorized 9386ac4; pinned 2e6bd089)
  packages/scheduler-router/src/index.js               (unauthorized 9386ac4; pinned b1f55634)
CANARY_CONFIG_SHA256 = UNAVAILABLE (file not yet generated; gate fail-closed)
NEW_RUNNER = /tmp/run-agent-core-combined-deploy-v2.sh
NEW_RUNNER_SHA256 = 18c1fdc64941f67b1a0fc3a7f03cad48063d9620a9e0b57a837eee8635708944
BASH_N = PASS
SHELLCHECK = PASS (0 findings)
CHECK_MODE = FAIL (fail-closed: CANARY_PREREQS_READY != YES; all other checks PASS)
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 合署 审计
```
