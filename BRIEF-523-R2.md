# 合同式交办：523-r2 — 20 fail 归因（基线对照）→ 过了就 push+PR

## 背景
STOPPED-523.md：整合字节级成功（492d579d，三 blob==审定版，guard 9/9），但 agent-router 包检查
608 tests / 586 pass / **20 fail** / 2 skipped（原始日志 SHA 0725db8b…）。归因未定。

## 任务（顺序执行）
1. **main 基线**：同依赖环境策略下，对 base f767e8d6（干净 worktree /private/tmp/dsh-523-baseline，
   独立 pnpm install）跑同一 agent-router 包检查命令，记录 pass/fail 集合。
2. **归因**：20 fail 与基线 fail 集合精确对比——
   - 集合相等（全部既有）→ 整合零回归：push 492d579d + 开 PR 引用 #523，PR 描述注明 20 既有失败+基线证据
   - 集合更大（整合引入）→ 不 push，写 STOPPED-523-R2.md 列新增失败
3. 依赖环境注意：前轮 reused dep dir 曾被 provisioning 测试写——本次 baseline 用独立安装，记录来源。

## 红线
零生产写入；失败即停写 STOPPED-523-R2.md；不弱化断言、不豁免 baseline
## 回执（RECEIPT-523-R2.md）
基线命令+输出原文、fail 集合对照表（整合 vs 基线）、结论（零回归/引入）、PR URL 或 STOPPED


## R2 PREFLIGHT / bounded execution record

Recorded UTC: 2026-11-04; actor: current user-authorized Codex worker.

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 492d579d185a524a9b56dd91ce8c3728fe6818a2
BASE_HEAD = f767e8d6608cdb0917aad2d471ba0454d0966a0f
CURRENT_BASE_HEAD = pending fresh read before any publication
ROUTE_STAGE = OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES (same authorities / exact base as retained R1)
GOAL_OR_TARGET = Attribute original 20 failures by independent baseline; publish exact source head only on equal failure sets.
CURRENT_GAP = Original package gate nonzero; baseline failure set not observed.
OBSERVATIONS = Original raw TAP hash verified at comparison; original environment reused mutable npm-flat node_modules; no baseline worktree exists.
WORKING_GUESS = Failure attribution remains UNKNOWN until exact comparison.
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = D-008 section 20 accepted amendment, blob 0c3f6f6005794edec2faf666e4fb035a9c87b009
RELATED_AUTHORITIES = retained D-004 and Binding Workspace invariants; local governance and structure V2
IMPLEMENTATION_AUTHORITY = not_applicable (no source/test/authority changes)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (not needed)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (reuse R1 bounded source-delivery gate; no production operation)
EXECUTION_MANDATE = VALID (verbatim current R2 user mandate above; narrowly resumes R1 for baseline attribution and conditional source publication)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (current integration branch; new detached baseline exact parent; task-specific install/store directories)
CONTROLLED_RUNBOOK_REQUIRED = YES (bounded sequence below)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS (local raw artifacts plus coordinate/hash-bound receipt; public PR evidence only if publication authorized by result)
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = mayf3/dsh-agent-core#523
BASE_IMPACT = BOUNDED (no candidate/source change in R2)
IMPLEMENTATION_ALLOWED = NO (no implementation requested)
MERGE_READY = NO (merge not authorized)
OPERATION_ALLOWED = NO (production not authorized)
EVIDENCE_NEEDED = baseline install provenance, exact command/raw TAP, pass/fail identity comparison, independent comparison audit; retained R1 source review; outstanding structure/integrity gates before publication
DONE_WHEN = RECEIPT-523-R2.md with exact comparison and PR URL or STOPPED-523-R2.md
EXPANSION_TRIGGER = install failure, unavailable original evidence, incomparable environment/sets, new failure, authority conflict, gate failure -> stop dependent publication; preserve evidence and STOPPED
NEXT_REAL_ACTION = create clean detached baseline and independently install dependencies
NEXT_ACTION = CONTINUE
```

Bounded sequence, no source repair, no baseline waiver:
1. Create `/private/tmp/dsh-523-baseline` detached at exact base; record clean tracked/untracked status before install. Do not reuse or repair R1 dependency paths or fixed `/tmp/home` fixture preimages.
2. One independent pnpm install from committed root package.json, no committed root lock exists. Use `--ignore-scripts --no-lockfile --node-linker=hoisted --package-import-method=copy`, task-specific store and isolated HOME, registry npmjs.org. Flat linker matches R1 npm-flat resolution; package versions and metadata hashes will be compared explicitly. No install credentials inherited.
3. One baseline package check using exact R1 argv with only its recorded PATH/TMPDIR and task-local temporary PRODUCTION_RUNTIME_ROOT; preserve raw stdout+stderr, rc, timestamps, source and dependency snapshots. Existing fixture /tmp paths are recorded as limitations, never cleaned or guessed restored.
4. Extract TAP identities including source-relative locations; normalize only worktree prefixes. Preserve original numeric IDs as log coordinates but compare test identities independent of shifted IDs (baseline lacks nine new guard tests). Compare all pass/fail/skip sets and original twenty failures; independent read-only audit.
5. If and only if original failure set equals baseline failure set and required comparability is established, run outstanding accepted structure/integrity/diff gates; fresh remote/base/source impact readback; one push of exact 492d579d and one PR referencing #523. Preserve any raw receipt locally and put reviewable baseline evidence in PR body without adding another source commit. Reuse R1 review for unchanged source bytes.
6. On mismatch/new failure/UNKNOWN or other required failure, no push/PR; write STOPPED-523-R2.md plus full receipt. No retries, tests weakened, source changes, merge, close, deployment, restart, controller dispatch or production writes.

Rollback/abort: preserve isolated candidate, baseline, install/store and logs. No deletion/reset of another checkout; no restoration of unknown shared symlink preimages. Local evidence writes remain allowed after stop. R1 stop remains historical and is not rewritten.
