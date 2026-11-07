# RECEIPT-605-R2 — R7 attribution complete; source delivery gates PASS

STATUS = SOURCE_DELIVERY_READY_PENDING_COMMIT_PUSH_PR_READBACK
REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/h605-r2
BRANCH = fix/compat-reader-writer-guard
BASE_HEAD = 4f7df01bcf087075c114901a96a7a54573110f61
CURRENT_MAIN = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
REVIEW_SNAPSHOT = adf6b4adf65baa0c661b41ed36942b30df44c838 (non-delivery snapshot)

Owner R7 authorizes the exact baseline attribution and exempts clean-base
failures from delivery gates. Route remains REUSE / BRIEF / DURABLE under the
accepted base Contracts listed in BRIEF-605-R2.md. This resumes R6's stop;
historical R2–R6 stops/results remain preserved below and in STOPPED-605-R2.md.
The containing delivery commit binds the final source/receipt; commit SHA,
independent final-Head delta result and live PR readback are recorded in the PR
and subsequent delivery section. No merge or production operation is authorized.

## ① Exact attribution before continuation

All ten R6 failing cases were located first. Stash
`8ff463c7aae2bd2e23f49a09969e3bb1a1d13657` saved tracked and untracked work;
clean status/HEAD verified at `4f7df01b` before and after the ten one-shot runs.
Each exact test returned rc1 with the same concrete original error. Classification:
**10 pre-existing, 0 clean-base passes / identified regressions** under Owner R7.
Stash pop restored every one of 23 recorded file hashes exactly. No product code,
assertion, environment, dependency, or credential was changed for attribution.

The complete per-case table, R6 original text and clean-base stdout/stderr are in
[attribution.md](docs/evidence/605-r7/attribution.md); structured commands, times,
coordinates and SHA256 are in `docs/evidence/605-r7/{baseline,attribution}.json`.
Underlying native-child initialize code1 remains UNKNOWN; clean-base reproduction
supports only this task's pre-existing classification, not a repair/health claim.

## ② Affected suites and structure

Only the nine exact anchored test names were filtered; the one Feishu file that
cannot load without @larksuite/channel was excluded as a whole. Its embedded
behavioral tests remain unexecuted. The original unfiltered R6 full Router result
is still **rc1, 626/614/10/2**. No claim of unfiltered full-suite green is made.
Node reports two empty file PASS wrappers when all credential/native tests are
filtered: raw 616 pass includes those wrappers, not new behavioral coverage.
All other R6 passing test names remain present.

| Gate | Result | Actual raw result | Evidence under docs/evidence/605-r7/ |
|---|---|---|---|
| full-router | rc0 | ℹ tests 618; ℹ pass 616; ℹ fail 0; ℹ skipped 2 | `full-router.log` |
| full-scheduler | rc0 | ℹ tests 485; ℹ pass 485; ℹ fail 0; ℹ skipped 0 | `full-scheduler.log` |
| full-scheduler-router | rc0 | ℹ tests 40; ℹ pass 40; ℹ fail 0; ℹ skipped 0 | `full-scheduler-router.log` |
| full-scheduler-consolidated | rc0 | ℹ tests 485; ℹ pass 485; ℹ fail 0; ℹ skipped 0 | `full-scheduler-consolidated.log` |
| structure | rc0 | CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT | `structure.log` |

The five new compatibility cases/helper were consolidated unchanged into existing
`packages/scheduler/test/occurrence-model.test.js` (320 lines) before the final
structure gate. The new top-level history-compat file would have increased an
already over-width directory from21 to22. Consolidation retains the exact21
baseline child set; no cap/registry/accepted rule was changed and no assertion
was weakened. This is packaging only, independently reviewed. Scheduler was
rerun in full after this change (485/485). Router/bridge and matrix evidence are
rebound by unchanged product/helper bytes. `packaging-delta.json` binds the body.

Structure runner is extracted byte-for-byte from accepted current-main1ff1e81c
(the base's retired runner cannot validate V3). Exact runner/source SHA256 and
snapshot tree coordinates are in review-snapshot.json. Result is
CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT, zero candidate violations; inherited
debt remains visible in the full JSON, not waived or called repository-wide PASS.
Vendored integrity verifier and source-only git diff --check returned rc0.
The later staged documentation formatting check found whitespace-only quoted
blank lines; Markdown whitespace was normalized without changing quoted content.
Raw logs and JSON originals retain exact bytes, and raw R6 receipt/STOPPED bytes
are archived in historical-markdown-originals.json. The formatting-only check
is not an Owner delivery gate; no required gate failed. Final scoped formatting
readback is recorded with the commit.
Current main differs from base in six verifier/receipt/test files only, with no
Router/Scheduler or relevant authority movement. No rebase or adoption was needed.

## ③ R6 mechanism/data evidence retained

R6 helper remains 32 entries /65536 UTF-8 JSON bytes, anchored Router V4:1420–1421,
with the same 4/4 positive/negative evidence and independent boundary review.
The seven-row matrix remains all rc0 (R5 decode reused; R6 six rows). Those passed
rows were not needlessly rerun. R5 digest-retention repair and all UNKNOWN/fence
semantics remain intact. Fresh R7 hashes match all four read-only source inputs
and the retained continuation SHA256
`0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8`.
Exact R6 bytes rebind 5227 records, three complete protected records and seven
historical digests; details remain in R6 facts-readback.json and new
`data-preservation-readback.json`. No production store was opened or mutated.

## Review, DONE_WHEN and boundaries

Independent non-author `/root/failure_attribution_review` reviewed source,
authority, attribution evidence, exact exclusions and packaging delta. Product
semantic blockers=0, Spec gaps=0; detailed result is in independent-review.txt.
Final-Head delta review and PR readback are required before reporting delivery.
Regulator-assigned product acceptance, merge, installation, live recovery and
business outcome remain separate and are not claimed. Production provenance,
old UNKNOWN business outcomes, and unexecuted live runtime acceptance remain
UNKNOWN. No production replay, fence clear, settlement, deployment or merge.

# R6 historical receipt (content preserved; Markdown whitespace normalized)

# RECEIPT-605-R2 — R6 helper 修复完成；全 Router rc1 后停止

STATUS = STOPPED_REQUIRED_FULL_ROUTER_RC1
TASK_1_HELPER = DONE
TASK_2_DELIVERY = INCOMPLETE_FAIL_STOP
DELIVERY_COMPLETE = NO
WORKTREE = /private/tmp/h605-r2
BRANCH = fix/compat-reader-writer-guard
HEAD = BASE_HEAD = 4f7df01bcf087075c114901a96a7a54573110f61
CURRENT_BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
RUNTIME = Node v26.7.0
COMMIT = NOT_CREATED; PUSH = NOT_EXECUTED; PR = NOT_CREATED; MERGE = NOT_EXECUTED

R6 仅修改 helper、新增其正负向测试和任务/证据文档，保留 R5 产品实现。
2026-11-07T04:20:21.495398+00:00 全 Router 返回 rc1 后立即停止：未修改产品代码、
未修环境/改断言/重试，未跑后续 Scheduler/Scheduler-Router，未 commit/push/PR。
依当前 Owner “失败即停照旧”，当前授权不覆盖失败后的再修复续跑。

## 上限来源与 helper 边界坐标

原任务书 `/private/tmp/h605-compat/BRIEF-605-COMPAT.md:7-10` 保护原三条记录及
UNKNOWN，`:19-20` 要求七项矩阵，`:26/:29` 要求全套 rc0 和失败即停。
原任务书没有另设 audit 数值；本 helper 采用其 governing authority 已有上限：

| 对象 | 上限 | 既有来源 |
| --- | --- | --- |
| Router 每 record attemptedActions | 32 条 / 65,536 UTF-8 JSON 字节 | `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md:1420-1421`，`:1433` 双 cap；`packages/agent-router/src/reconciliation/capacity.js:19-20` |
| 审计字段和 startup 缺 ownership | closed action/result + timestamp + bounded reason，保持 fence | 同一 Router V4 `:1356-1378`；既有 `state-machine.js:142-144` 使用 `.slice(-32)` |
| Scheduler runs.jsonl | 10 MB、append-only、保留完整最新行轮转 | D-009 `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md:699-711`；这是独立 evidence log，不是 Router ring 的数值 |
| UNKNOWN/history/terminal authority | 持久保留，不伪造结果 | D-009 `:574-588/:663-695`；原任务书 `:7/:29` |

实现 `scripts/availability-recovery/compat-store-facts.mjs:7-30`：先验证 32/65536，
再验证 old suffix 与 new prefix 逐字段相等，其后至少一条新审计；只能在 count cap
下移除最旧 audit prefix。无界增长、中间改写/重排/删除、无法证明追加的整 ring
替换都拒绝。新增项仅允许 C-019 closed action/result、非负安全整数 timestamp、
<=256 字符 reasonCode 和四个固定字段。`:37` 拒绝 record 增删；`:47-49` 保证除
审计、派生 bytes、允许的 updatedAt 外所有业务/evidence 字段全等。`:51-63` 仅允许
有证明的追加或原来精确 cleanup 情形推进 updatedAt。三条 protected records 另有全记录
逐字段相等检查，不能靠 audit 例外修改。

`scripts/availability-recovery/compat-store-facts.test.mjs:23` 起四组测试实测 rc0：
合法 empty/nonempty/full-ring append、条数/UTF-8 字节超限、rewrite/reorder/delete/
full replacement、非法 entry、UNKNOWN/fence/settlement/termination/digest/identity 和
record 删除反例。没有更改产品 Contract、cap 或 durable writer。

## R5(b) 成果保持与最终 facts readback

R5 serializer 修复坐标：`packages/agent-router/src/reconciliation/durable-file.js:302-315`，
尤其 `:306-307` 在没有答案正文时保留已验证 digest；回归用例
`packages/agent-router/test/runtime-hygiene/recovery-compat.test.js:119-135`。
原 7 个摘要位置 `records[5163,5193,5195,5196,5220,5221,5223].finalAssistantOutputEvidence`
在全部六项 R6 matrix after snapshots 均保持原值，没有再次 null 化。
R5 targeted 48/48 rc0、decode rc0 原证据复用，未重跑原 R3/R4/R5 已通过修复。

R6 前后 `git diff --binary` SHA256 均为
`3fc44ad5e09d77cb9e2d81af4e4d08c7731581b67c7b6f9871ab9c5549ac2c23`；
原 tracked 产品 diff 完全未改，initial-files.json 也绑定既有 untracked package tests。

六行矩阵继续使用 R5 保留副本 `/private/tmp/h605-r5-evidence/continuation`，没有逐行
重置输入。开始 SHA256=`c43e83044b8bca34208b295615ea49feb4f04b8716a1d60a8c747e4f7f5f624c`；
最后 SHA256=`0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8`，
full Router 前后该副本哈希也相同。5227 条 records 完整保留；idx5124/5125/5127 三条
逐字段全等，原 UNKNOWN 保留。排除仅 bytes/updatedAt/attemptedActions 后，所有 records
差异索引=[]。实际 max audit=32 条/4289 UTF-8 JSON bytes。完整坐标和七个原/后 digest
在 `docs/evidence/605-r6/facts-readback.json`；独立 reviewer 已逐 snapshot 复核。

## 七项矩阵与全套实际结果

环境：COMPAT_STATE_INPUT=/private/tmp/w6-state-compat-readable/sanitized；
COMPAT_MATRIX_STATE=/private/tmp/h605-r5-evidence/continuation。
`docs/evidence/605-r6/gates.json` 保存每个 argv、cwd、Head、时间、rc、log SHA256 和前后
snapshot SHA256；逐行 raw log 随本 worktree 留存。runner 拒绝 failed gate 后再跑或重复 gate。

| 门 | 实测 | 原文位置 |
| --- | --- | --- |
| helper 正负向 | rc0，4/4 | helper-bounds.log |
| 1 解码 | R5 rc0 复用；Router 5227/93，Scheduler 59/5002/7，unverifiable=5002 | r5-matrix-decode.log |
| 2 冷启动 | R6 rc0，1/1，spawn=0 | matrix-cold-start.log |
| 3 重启 | R6 rc0，1/1，quarantine/UNKNOWN 保持 | matrix-restart.log |
| 4 Agent 隔离 | R6 rc0，1/1；3 legacy + 1 existing blocked，89 others/fresh allowed；spawn=route=0 | matrix-isolation.log |
| 5 无 replay | R6 rc0，1/1；2 correlations retained，duplicate mint refused；replay/spawn=0 | matrix-no-replay.log |
| 6 负向持久化 | R6 rc0，1/1；三条 bad-clear 拒绝，拒绝前后 bytes/内存不变 | matrix-negative-persistence.log |
| 7 回滚 | R6 rc0，1/1；base fail-closed，返回 candidate 后 quarantine 保留 | matrix-rollback.log |
| 全 Router（64 显式文件） | **rc1；626 tests，614 pass，10 fail，2 skipped** | full-router.log |
| 全 Scheduler（53 文件） | NOT_EXECUTED，失败即停；无 rc | 无 |
| 全 Scheduler-Router（4 文件） | NOT_EXECUTED，失败即停；无 rc | 无 |
| commit / push / PR(base main) | NOT_EXECUTED | 无 |

回滚 PASS 仅证明旧代码安全 fail-closed；不表示旧代码能恢复可用性。

### decode — rc0 (R5 reused)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX decode$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX decode$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
decoded Router=5227/93 Scheduler=59/5002/7 unverifiableHistory=5002; all original facts/fences and input hashes unchanged
✔ MATRIX decode (215.87275ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 269.6245

rc=0
```

### cold-start — rc0 (R6)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX cold-start$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
cold startup ready; 5227 business/evidence records and all three full protected records unchanged; epoch/capacity bookkeeping allowed; spawn=0
✔ MATRIX cold-start (290.475959ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 352.653083
```

### restart — rc0 (R6)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX restart$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
restart preserves quarantine, UNKNOWN, null evidence and repeatable history
✔ MATRIX restart (426.535167ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 479.073375
```

### isolation — rc0 (R6)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX isolation$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
legacyBlocked=3 existingStockBlocked=1 otherAgentsAllowed=89 freshAllowed=true spawn=0 route=0
✔ MATRIX isolation (265.812542ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 320.305625
```

### no-replay — rc0 (R6)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX no-replay$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
old correlations=2 retained; duplicate mint=refused; third record quarantined; replay/spawn=0
✔ MATRIX no-replay (245.958792ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 296.864541
```

### negative-persistence — rc0 (R6)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX negative-persistence$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
all three bad-clear writes rejected; durable bytes and in-memory records unchanged
✔ MATRIX negative-persistence (224.595917ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 274.083875
```

### rollback — rc0 (R6)

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX rollback$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
RC=0
base rollback safely fails closed; availability rollback unsupported; return-to-candidate quarantine intact
✔ MATRIX rollback (528.465041ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 581.243333
```

## required-gate failure 原文与 stop

完整全套 argv（64 文件）见 gates.json，不使用 Node 目录参数，也没有遗漏失败文件。
full-router 开始 2026-11-07T04:19:45.773846+00:00，结束 04:20:21.495398+00:00，rc1。
完整 raw log SHA256：`ac1b00609c56c1df3f611e07a75d7e5a6e694445ee2b34c6875c589a0dc5abdd`。

10 个失败分组：broker-rpc.test.js:322/:334 两个 regex 与 STILL_UNKNOWN 文案不符；
luna-credential-chain.test.js:157/:169/:186 三个缺 DSH CLI；
feishu-reply-delivery-result.test.js 模块加载缺 @larksuite/channel；
message-origin.test.js:175 读取 undefined.ctx；native-goal-composed.test.js:14 缺 paired
native build，:74 两个子用例 initialize 退出 AGENT_PROCESS_EXITED。
这些不是原任务书明确排除的 stale-quiescence 噪声。未跑 clean-base，故是否既有失败或
本候选回归仍为 UNKNOWN。两个 child initialize 失败的精确根因也为 UNKNOWN；
没有据环境表象豁免必需门或伪造全套 rc0。

模块缺失关键原文：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@larksuite/channel' imported from /private/tmp/h605-r2/packages/feishu-connector/src/index.js
```

全套总结及全部 failing-test 原文：

```text
ℹ tests 626
ℹ suites 0
ℹ pass 614
ℹ fail 10
ℹ cancelled 0
ℹ skipped 2
ℹ todo 0
ℹ duration_ms 35671.139916

✖ failing tests:

test at packages/agent-router/test/broker-rpc.test.js:322:1
✖ seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept) (0.491083ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /response was lost/. Input:

  'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back transport failed"}'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/broker-rpc.test.js:330:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back transport failed"}',
    expected: /response was lost/,
    operator: 'match',
    diff: 'simple'
  }

test at packages/agent-router/test/broker-rpc.test.js:334:1
✖ seam: a structured gateway failure passes through declared codes verbatim at the correct depth (0.155875ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /outcome is unknown/. Input:

  'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back response unusable"}'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/broker-rpc.test.js:340:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'scheduler mutation outcome STILL_UNKNOWN after canonical read-back: {"state":"STILL_UNKNOWN","operation":"create","reason":"read-back response unusable"}',
    expected: /outcome is unknown/,
    operator: 'match',
    diff: 'simple'
  }

test at packages/agent-router/test/luna-credential-chain.test.js:157:1
✖ E: valid canonical credential — child initializes on the openai-codex route (1.7235ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:158:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)

test at packages/agent-router/test/luna-credential-chain.test.js:169:1
✖ F: missing credential fails loud on the real chain — never a silent fallback (0.098834ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:170:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:969:18)
      at Test.postRun (node:internal/test_runner/test:1537:19)
      at Test.run (node:internal/test_runner/test:1462:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3)

test at packages/agent-router/test/luna-credential-chain.test.js:186:1
✖ G: unsafe credential (group/world readable) fails loud on the real chain (0.09325ms)
  Error: dsh CLI not found at /private/github/deepseek-harness/apps/cli/lib/bin.js; set DSH_HARNESS_ROOT to the deepseek-harness checkout
      at cliBin (file:///private/tmp/h605-r2/packages/agent-provisioning/src/index.js:76:11)
      at gates (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:42:46)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/luna-credential-chain.test.js:187:8)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:969:18)
      at Test.postRun (node:internal/test_runner/test:1537:19)
      at Test.run (node:internal/test_runner/test:1462:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7)

test at packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js:1:1
✖ packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js (37.034625ms)
  'test failed'

test at packages/agent-router/test/process-lifecycle/message-origin.test.js:175:1
✖ R3: a settled or unknown turnExecutionId proves nothing (absent leaf) (0.126125ms)
  TypeError: Cannot read properties of undefined (reading 'ctx')
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/process-lifecycle/message-origin.test.js:180:32)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7)

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:14:1
✖ scripted native rounds obtain fresh parent proof after prior settlement through real child transport (0.6665ms)
  AssertionError [ERR_ASSERTION]: paired native build is required; this conformance test must not silently skip
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/route-chain/native-goal-composed.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child timeout removes native queued admission before old owner release (37.646541ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:77:47)
      at ChildProcess.wrapper (node:events:639:12)
      at ChildProcess.emit (node:events:514:20)
      at ChildProcess._handle.onexit (node:internal/child_process:294:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child cancel removes native queued admission before old owner release (34.797875ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/src/process/spawn.js:77:47)
      at ChildProcess.wrapper (node:events:639:12)
      at ChildProcess.emit (node:events:514:20)
      at ChildProcess._handle.onexit (node:internal/child_process:294:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }
```

BLOCKER_CLASS = REQUIRED_GATE_FAILURE
SOURCE = 原任务书全套 rc0 + R6 “失败即停照旧”
COUNTEREXAMPLE = full-router.log rc1，626/614/10/2，完整原文如上
IMPACT = full_suites/delivery/commit/push/pr readiness NO
MINIMAL_CLOSURE = 新有效续跑授权下先诊断并闭合上述精确环境/断言失败，再继续剩余门；
  本轮不重试、不修代码或环境、不运行后续门
IMPLEMENTATION_ALLOWED = NO(dependent continuation)
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP

## 独立 affected-delta review 与范围

非作者 `/root/authority_review_r6` 只读核对 governing、helper/tests、所有 executed logs/hash、
六个 after snapshots、三条 protected 和七 digest；未跑测试/改文件，回传持久化结论：

```text
schema_version=2
SPEC_GOVERNANCE_MODE=REVIEW
REVIEW_KIND=AFFECTED_CONTRACT
REVIEW_TARGET_HEAD=4f7df01bcf087075c114901a96a7a54573110f61 + R6 uncommitted delta
BASE_HEAD=4f7df01bcf087075c114901a96a7a54573110f61
CURRENT_BASE_HEAD=1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
REVIEWER_ID=/root/authority_review_r6
AUTHOR_INDEPENDENCE=PASS
REVIEW_SCOPE=DELTA
SCOPE_REASON=bounded R6 harness repair and directly dependent evidence
AUTHORITY_REVIEW=PASS
PRIMITIVE_BOUNDARY_REVIEW=PASS
CONTRACT_REVIEW=PASS(helper/source only)
MANDATE_SCOPE_REVIEW=PASS
EVIDENCE_REVIEWABILITY=PASS
BASE_IMPACT=BOUNDED
ACCEPTANCE_COVERAGE_REVIEW=FAIL
PRODUCT_SEMANTIC_BLOCKERS_FOUND=0
REQUIRED_GATE_FAILURES=1
BLOCKERS=1
SPEC_GAPS=0
IMPLEMENTATION_ALLOWED=NO(dependent continuation)
MERGE_READY=NO
OPERATION_ALLOWED=NO
FINAL_HEAD_RECHECK=NOT_APPLICABLE(no final commit)
NEXT_ACTION=STOP
```

current main 新增的六个 verifier-adaptation 文件与本候选 Router/Scheduler 和相关 authority
无冲突。base 自带 runner 尚未适配 V3的旧说明只描述 4f7df01b；current main 已有适配，
不能把旧说明扩写为“main 当前不支持”。本轮因 full-router 必需门失败停止，未运行结构门、
未改 verifier。未来如有新续跑，按实际 base impact 处理，不将 main 移动当全量重审理由。

## DONE_WHEN、证据、UNKNOWN 与未交付面

任务① helper 修复完成，边界验证/独立 source review 通过；任务②七项 matrix 机制证据
齐备，但全套要求未达成，所以交付不完整。所有修改仍在原分支/worktree，HEAD 未变。
没有 final commit，不声称 final-Head review、push 或 PR 完成。

原 input 四文件 fresh 哈希与 R5完全相同，见 facts-readback.json。完整日志、gates、runner、
facts-readback 和 manifest 均位于 `docs/evidence/605-r6/`；大 snapshot 留在
`/private/tmp/h605-r6-evidence/`，每项可由 gates 坐标检索。
原 R5 诊断/失败收据和其 STOPPED 历史完整保留在下方及 STOPPED-605-R2.md。

这里仅是源实现/脱敏副本 mechanism evidence。生产三条记录独立 manifest、当前 live runtime、
外部业务 side effect 仍为 UNKNOWN；监管随后指定的独立产品验收未执行。
零 replay、零生产读写、零服务重启、零部署、零 merge。原业务 UNKNOWN 保留。

---

# R5 historical receipt (content preserved; Markdown whitespace normalized)

# RECEIPT-605-R2 — R5 变异归因与 fail-stop checkpoint

STATUS = STOPPED_REQUIRED_COLD_START_RC1_HARNESS_OVERCONSTRAINT
DELIVERY_COMPLETE = NO
REVIEW_TARGET_HEAD = 4f7df01bcf087075c114901a96a7a54573110f61 + uncommitted diff
BASE_HEAD = CURRENT_BASE_HEAD = 4f7df01bcf087075c114901a96a7a54573110f61
WORKTREE = /private/tmp/h605-r2
BRANCH = fix/compat-reader-writer-guard
RUNTIME = Node v26.7.0

Owner R5 先诊断、按 (a)/(b) 续行的授权已执行；本次新必需门 rc1 后，
依同一消息“失败即停照旧”停止。未 commit、push、建 PR 或 merge。
全部输入均为 Owner 指定的脱敏材料，零生产读写。不能把 source review、测试
主体中间输出或本机哈希当成完整矩阵/生产恢复 PASS。

## 原任务书和 governing 原文坐标

- `/private/tmp/h605-compat/BRIEF-605-COMPAT.md:7-10`：三条记录和 UNKNOWN
  不修改、不删除、不伪造 settlement；reader 按 Agent 阻断；writer 缺证据不清 fence；七项矩阵。
- 原任务书 `:19-20`：真实形状脱敏副本的“解码 PASS / 冷启动 PASS / 重启后投影保持 /
  Agent 级隔离 / 旧外部操作防重放 / 持久化写入负向 / 回退验证”。
- 原任务书 `:4` 的“字节不变”是既有 STATE-FORENSICS-V1 结果，不能自行升级为冷启动
  整文件字节相同的产品硬门；`:29` 的受保护记录红线和失败即停仍然有效。
- `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md:574-600`（D-009 §8.4/8.5）：
  可信 settlement 追加保存，不覆盖 UNKNOWN history；missing evidence 不得写 authoritative reconciliation。
- D-009 `:663-695`：identity、payloadHash、state、timestamps、fence、settlement、
  terminal evidence reference 持久保留；不得 strip 新字段或丢失 authority。
- `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md:1272,1285-1306,1440-1442`：
  winning output/evidence 不覆盖、durable recovery 为单一 authority、durable hashes 保留。
- 同一 Router V4 `:1356-1378,1420-1421,1433,1442`：允许有界 ownership_check/blocked
  action、wall-clock audit/reason；action cap=32，重启缺 ownership 继续 fenced。

以上均为当前 base 中已接受的 authority。Route 继续 REUSE + BRIEF + DURABLE；
未改 Spec 含义。监管随后指定的独立产品语义验收仍是独立 gate，本机子审阅不替代它。

## ① before/after 字段级归因：判为 (b)

R4 fixture teardown 已删除其 after 副本。R5 没有恢复或冒称持有该历史文件，而是从
相同已核验 source 在隔离面复现完全相同的 constructor/epoch `compat-cold`，保留
before、after 和完整 JSON-pointer 字段清单。startup 使用 Date.now，故 after 哈希与
R4 不同；历史 R4 原字节的精确变异仍不可独立复原。当前可复现的实际根因已查明。

原 source before SHA256：
`1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a`。
R4 记录 after：`29502793cc56d7662abd794f283b6fd929abc4c4c597002d89354eec5b516222`。
R5 修复前重现 after：`e881a68d0d00cf06b2f2337951751d6448c607727d71901ef2bba15b780499a1`。

完整字段清单（每项含 path/kind/before/after）：
`docs/evidence/605-r5/router-open-diff.json`，共 **255** 个叶路径变化，全为 replace。
JSON 由原格式重序列化为 compact 格式还改变空白；格式变化不计 JSON 叶路径。

| 路径/变更种类 | 条数 | 分类和依据 |
| --- | ---: | --- |
| `/runtimeEpoch` | 1 | 合法新 runtime bookkeeping；不改 record canonical identity |
| `/runtimeEpochs/*` | 180 位置 | cap=256 下集合新增 `compat-cold`、删除唯一无记录引用旧 epoch `5044bdf8-21d4-42ea-9c68-1b2a52221c9f` 并重排；无在用 epoch 丢失 |
| `/records/4394/updatedAt` | 1 | 已 settled/blocked/active 的缺 registry-cleanup 记录重查时间；UNKNOWN、settlement、termination、fence 不变 |
| `/records/*/bytes` | 66 | 派生容量重计数，不是业务结果 |
| `/records/*/finalAssistantOutputEvidence` 对象→null | **7** | **业务终态证据丢失，(b)，不合法** |
| record/occurrence 增删 | 0 | 5227 records、issuance、correlation 完整；Scheduler 文件未写 |
| fence/UNKNOWN/settlement/termination 变化 | 0 | 三条 protected records 完全相等；无伪造终止或 settlement |
| Router unverifiable marker 落盘 | 0 | 无新增 Router marker 写入 |

七个 evidence-loss 原路径：`/records/5163/finalAssistantOutputEvidence`、
`/records/5193/finalAssistantOutputEvidence`、`/records/5195/finalAssistantOutputEvidence`、
`/records/5196/finalAssistantOutputEvidence`、`/records/5220/finalAssistantOutputEvidence`、
`/records/5221/finalAssistantOutputEvidence`、`/records/5223/finalAssistantOutputEvidence`。
所有原 digest 值均在字段清单逐项保存，没有新造 digest 或推断业务 outcome。

根因：`packages/agent-router/src/reconciliation/durable-file.js:302-321` 的 serializer
在 decoded `finalAssistantOutput=null` 时重新算出 null，覆盖 reader 已验证的历史 digest。
现 `:304-307` 在 live output 缺席时深拷贝保留现有 digest；有 output 时仍从原分支生成 hash。
答案正文仍不落盘。最小修复未更改 UNKNOWN、identity、settlement 或 termination protection。

回归测试：`packages/agent-router/test/runtime-hygiene/recovery-compat.test.js:119-135`，
固定 `ok` 的实测 SHA256，覆盖 digest 创建→cold open→再次写→restart→再写。
修复后从保存的 before 恢复诊断 continuation 副本，再使用修复代码打开；其 snapshot 为
`/private/tmp/h605-r5-evidence/after-router-open-repaired.json`，SHA256
`9a3d78035cf763129926c99b85261b5a7f88735226851c5de069454e3832894c`。
5227 记录、7 digest 全保留；三条 protected records 全等；其余仅 66 bytes + 1 updatedAt。

Scheduler R4 的 `historyVerification` 是内存 read projection；5002 条 history 被标为
unverifiable/UNKNOWN，所有原始 occurrence/history/fence 和 source 文件哈希不改。
该 marker 未落账、未被当作 admitted/执行或 writer authority。

## ② 本次实际执行与七项矩阵

环境：`COMPAT_STATE_INPUT=/private/tmp/w6-state-compat-readable/sanitized`，
`COMPAT_MATRIX_STATE=/private/tmp/h605-r5-evidence/continuation`。
两项矩阵使用同一份修复后的保留副本，未给每行重置 state。
完整 argv、开始/结束时间和 rc 在 `/private/tmp/h605-r5-evidence/gates.json`。

| Gate | 本次实际 rc/结果 |
| --- | --- |
| 针对性相关测试（10 个显式文件） | rc0，48/48，含新 digest 用例 |
| 1 解码 | rc0，Router 5227/93；Scheduler 59/5002/7；unverifiable=5002 |
| 2 冷启动 | **rc1，after hook helper 过严**；主体已完成，但整项不能记 PASS |
| 3 重启投影 | NOT_EXECUTED；无 rc，不填 0 |
| 4 Agent 级隔离 | NOT_EXECUTED；无 rc |
| 5 旧外部操作防重放 | NOT_EXECUTED；无 rc |
| 6 持久化写入负向 | NOT_EXECUTED；无 rc |
| 7 回退验证 | NOT_EXECUTED；无 rc |
| 全 Router（64 files） | NOT_EXECUTED |
| 全 Scheduler（53 files） | NOT_EXECUTED |
| 全 Scheduler-Router（4 files） | NOT_EXECUTED |
| commit / push / PR(base main) | NOT_EXECUTED，fail-stop |

R3 归因/修复、42/42 和 R4 prior 64/64 的既有证据保留，不冒称本次重跑；
本次新 targeted 48 例是不同显式 selection，不以它替代全套。

解码原文：

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX decode$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
decoded Router=5227/93 Scheduler=59/5002/7 unverifiableHistory=5002; all original facts/fences and input hashes unchanged
✔ MATRIX decode (215.87275ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 269.6245

rc=0
```

冷启动 rc1 原文（相关段；完整未截断 stdout/stderr 见下方 hash-bound log）：

```text
COMMAND: ["node", "--test", "--test-concurrency=1", "--test-name-pattern=^MATRIX cold-start$", "scripts/availability-recovery/compat-reader-matrix.test.mjs"]
cold startup ready; 5227 business/evidence records and all three full protected records unchanged; epoch/capacity bookkeeping allowed; spawn=0
✖ MATRIX cold-start (291.538625ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 343.005875

✖ failing tests:

test at scripts/availability-recovery/compat-reader-matrix.test.mjs:149:1
✖ MATRIX cold-start (291.538625ms)
  AssertionError [ERR_ASSERTION]: record 4765: every business/evidence field preserved
  + actual - expected
  ... Skipped lines

    {
      adminAbandonment: null,
      admitted: true,
      agentId: 'agt_stock_agent',
      attemptedActions: [
        {
          action: 'ownership_check',
  -       observedAtWallMs: 1793835664612,
  -       reasonCode: 'runtime_restart_ownership_unavailable',
  -       result: 'blocked'
  -     },
  -     {
  -       action: 'ownership_check',
          observedAtWallMs: 1793835674640,
          reasonCode: 'runtime_restart_ownership_unavailable',
          result: 'blocked'
        },
        {
  ...
        },
  +     {
  +       action: 'ownership_check',
  +       observedAtWallMs: 1794024668795,
  +       reasonCode: 'runtime_restart_ownership_unavailable',
  +       result: 'blocked'
  +     }
      ],
      audit: [],
      callerCorrelation: {
        occurrenceId: 'occ:7711b9a466fda803',
        requestId: 'occ:7711b9a466fda803',

      at assertRouterFacts (file:///private/tmp/h605-r2/scripts/availability-recovery/compat-store-facts.mjs:18:12)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/scripts/availability-recovery/compat-reader-matrix.test.mjs:43:7)
      at TestHook.runInAsyncScope (node:async_hooks:226:14)
      at TestHook.run (node:internal/test_runner/test:1397:25)
      at TestHook.run (node:internal/test_runner/test:1741:18)
      at TestHook.run (node:internal/util:581:20)
      at Test.runHook (node:internal/test_runner/test:1284:20)
      at after (node:internal/test_runner/test:1337:20)
      at Test.run (node:internal/test_runner/test:1423:13)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
```

针对性测试原文（tail；完整原文保留于 targeted.log）：

```text
✔ MULTI_UNKNOWN_ISOLATED: releasing one fence never releases another (C-016) (3.49125ms)
✔ CHILD_EXIT_SETTLES_TERMINATED_WITHOUT_OUTCOME: fence released, no new admission needed (122.798625ms)
✔ RELEASE_SENDS_NOTHING_NEW: deliver-mode late settlement produces no second business prompt and no duplicate delivery (153.966625ms)
✔ classifyUnknownFence covers the six bounded, secret-free categories (1.148792ms)
✔ exact legacy tuple decodes without normalization; malformed neighbors still fail closed (45.338791ms)
✔ writer rejects pending/partial evidence and a prior bad clear with zero persistent/local effect (57.251583ms)
✔ fence persistence failure rolls back the durable transition and retains the local fence (48.426416ms)
✔ normal abandonment and exact settlement retain their distinct admission semantics (83.396417ms)
✔ answer digest survives cold open, another durable write and restart without answer text (77.03375ms)
✔ R4 arbitrary non-enum history to values decode as unverifiable without inventing admission (1.969333ms)
✔ R4 invalid from/final enums retain their raw values; marker is recomputed, never trusted (0.142667ms)
✔ R4 structurally unusable records and independently provable corruption still fail loud (0.494459ms)
✔ R4 redacted late-settlement linkage is unverifiable while settlement authority stays strict (0.132625ms)
✔ R4 JobStore read/restart preserves raw UNKNOWN fences; strict mutation rejects with zero file writes (12.825417ms)
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2661.232041

rc=0
```

## 新停点：合法 bounded audit 被新增 helper 当成非法变化

SOURCE = 原任务书 :20/:26/:29 + Owner R5“失败即停照旧”。
COUNTEREXAMPLE = `matrix-cold-start.log` rc1；
  `compat-reader-matrix.test.mjs:43` after hook → `compat-store-facts.mjs:18`。
IMPACT = 五项后续矩阵、全套 rc0、commit/push/PR 无证据，交付不能宣称完成。
BLOCKER_CLASS = REQUIRED_GATE_FAILURE
AFFECTED_READINESS = cold_start,matrix,full_suites,delivery,commit,push,pr
IMPLEMENTATION_ALLOWED = NO (dependent continuation)
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP

本轮 root 新增的 `assertRouterFacts` 断言过严，错误地要求所有 attemptedActions 原值
完全不变，超出了原冷启动要求。它发现的实际变异不是新的产品语义缺陷：
index 4765 `agt_stock_agent` 在 registry 启动时追加真实
`ownership_check/blocked/runtime_restart_ownership_unavailable` 审计，并更新 updatedAt。
`process-registry.js:58-61` → `state-machine.js:129-148`，其中 `:142-144` `.slice(-32)`。
actions 前后都为 32；精确满足 `old[1:] == new[:-1]`，最新一项真实时间为
1794024668795；无 settlement、termination、UNKNOWN、identity 或 fence 变更。
这是 Router V4 :1356-1378/1420-1442 明确允许的有界恢复审计。

停后只读结构化差异已保存 `/private/tmp/h605-r5-evidence/registry-cold-start-diff.json`：
从 repaired-open snapshot 到 registry 后 snapshot 共 34 叶变更：index4394 updatedAt 1、
index4765 updatedAt 1、32 action wall-clock 槽位；其余字段全等。
最终保留副本和独立 snapshot 同 SHA256：
`c43e83044b8bca34208b295615ea49feb4f04b8716a1d60a8c747e4f7f5f624c`。
全部 5227 记录、三条 protected record、七个原 digest 保留。

MINIMAL_CLOSURE = 新的有效续跑授权下，仅修正 helper，允许证据限定的正常 bounded
ownership-check ring shift/append 及对应时间戳，同时继续禁止任意 history/UNKNOWN/
identity/settlement/fence/evidence 改写，再从此保留副本执行未完成门。
本轮未在 rc1 后修改 helper、重试测试、跑剩余门、commit 或 push。

## 独立 affected-delta review 与交付边界

非作者 `/root/authority_review` 只读查证 accepted authority、原任务书、两个诊断 snapshot
和源 diff，未改文件/跑测试。初始 source review product semantic blockers=0、
spec gaps=0；实际 rc1 后已更新为 ACCEPTANCE_COVERAGE_REVIEW=FAIL、
REQUIRED_GATE_FAILURES=1、IMPLEMENTATION_ALLOWED=NO、NEXT_ACTION=STOP。
独立确认七个 digest 修复、三条 protected records 保留，也确认 stock 的 audit 变化合法。
该 review 不能替代完整 executed matrix、最终 commit Head review 或监管随后指定的产品验收。

Reviewed tracked binary diff SHA256：
`3fc44ad5e09d77cb9e2d81af4e4d08c7731581b67c7b6f9871ab9c5549ac2c23`。
代码/测试在失败后冻结；只写本收据、STOPPED 和外部证据快照/manifest。

`.agents/local/README.md:105-125` 已声明 structure runner 未适配 V3，适配属另案；
本轮不改 runner，也不声称未执行的结构门 rc0。

## 哈希绑定和 UNKNOWN

原始输入 fresh readback：

| 输入 | Bytes | SHA256 |
| --- | ---: | --- |
| `/private/tmp/w6-state-compat-readable/sanitized/control/turn-recovery-v3.json` | 10700760 | `1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a` |
| `/private/tmp/w6-state-compat-readable/sanitized/control/turn-recovery-v3.json.abandonment-declarations.json` | 4062 | `139348609fb6e4936cb2339450ad47ef23869a9337f08f8a76bf1b27501839d3` |
| `/private/tmp/w6-state-compat-readable/sanitized/control/turn-recovery-v3.json.faults.json` | 147 | `1177da0f7dbe7b722ec2dce5ae6a404d2a0460d05bb901f0493dec3f180d3486` |
| `/private/tmp/w6-state-compat-readable/sanitized/scheduler/jobs.json` | 7016723 | `5fe2b0d530f271e5c9c0c0f41e62b0732c9735580d4d0ff12dabb1de26609d77` |

外部完整证据（当前 source/命令/时间/rc 绑定见 r5-stop-evidence.json）：

| 路径 | Bytes | SHA256 |
| --- | ---: | --- |
| `/private/tmp/h605-r5-evidence/targeted.log` | 5876 | `c35f5c6498e94c31427c890c1e76d2e9a02bd6acef7a8fb6f15f018b5ffe39e0` |
| `/private/tmp/h605-r5-evidence/matrix-decode.log` | 427 | `9c5647ef604c8fcc09df66f5f00e2885258437581a962e97cad4ec9ee22a0bc3` |
| `/private/tmp/h605-r5-evidence/matrix-cold-start.log` | 6920 | `969bd462304d5407dda2ca4353f7196ab4a50999bd0327cf2b128a9b82bd0a91` |
| `/private/tmp/h605-r5-evidence/gates.json` | 1838 | `31bb4633091ce5194618301c441ba01697fe02d304184d56518d944d1ebf8bb6` |
| `/private/tmp/h605-r5-evidence/router-open-diff.json` | 100147 | `1dc002256b58aada4edbedcd58b002ad0eecff5cf68cf0ecc8e20005e8726394` |
| `/private/tmp/h605-r5-evidence/registry-cold-start-diff.json` | 6360 | `016dce1e4ccdc6821765a5a02ecfbb7d843e5b35006983dd6f580ae6531f644b` |
| `/private/tmp/h605-r5-evidence/before/control/turn-recovery-v3.json` | 10700760 | `1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a` |
| `/private/tmp/h605-r5-evidence/after-router-open.json` | 8311932 | `e881a68d0d00cf06b2f2337951751d6448c607727d71901ef2bba15b780499a1` |
| `/private/tmp/h605-r5-evidence/after-router-open-repaired.json` | 8312711 | `9a3d78035cf763129926c99b85261b5a7f88735226851c5de069454e3832894c` |
| `/private/tmp/h605-r5-evidence/after-registry-cold-start.json` | 8312711 | `c43e83044b8bca34208b295615ea49feb4f04b8716a1d60a8c747e4f7f5f624c` |

source 输入从未经 Store constructor 或 writer 打开；所有 mutable stores 仅在隔离副本。
生产原始三条记录的独立 manifest、当前 live runtime、实际业务 side effect 均为 UNKNOWN。
原业务 UNKNOWN 保留；零 replay、零生产写入、零服务重启、零部署、零 merge。

# R6 STOPPED_REQUIRED_GATE_FAILURE

{
  "label": "full-router",
  "command": [
    "node",
    "--test",
    "--test-concurrency=1",
    "packages/agent-router/test/binding-store.test.js",
    "packages/agent-router/test/broker-rpc.test.js",
    "packages/agent-router/test/child-env.test.js",
    "packages/agent-router/test/deadline-config.test.js",
    "packages/agent-router/test/default-model-route.test.js",
    "packages/agent-router/test/delivery.test.js",
    "packages/agent-router/test/feishu-regression.test.js",
    "packages/agent-router/test/feishu-ux-seam.test.js",
    "packages/agent-router/test/feishu-v2-normal.test.js",
    "packages/agent-router/test/generation-restart-safety.test.js",
    "packages/agent-router/test/luna-credential-chain.test.js",
    "packages/agent-router/test/primary-workspace.test.js",
    "packages/agent-router/test/process-delivery.test.js",
    "packages/agent-router/test/process-descriptors.test.js",
    "packages/agent-router/test/process-lifecycle/admin-abandonment.test.js",
    "packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js",
    "packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence.test.js",
    "packages/agent-router/test/process-lifecycle/auto-recovery-v3.test.js",
    "packages/agent-router/test/process-lifecycle/correlation.test.js",
    "packages/agent-router/test/process-lifecycle/evidence-caps.test.js",
    "packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js",
    "packages/agent-router/test/process-lifecycle/ingress-exact-id.test.js",
    "packages/agent-router/test/process-lifecycle/late-settlement.test.js",
    "packages/agent-router/test/process-lifecycle/message-origin.test.js",
    "packages/agent-router/test/process-lifecycle/pipe-failure.test.js",
    "packages/agent-router/test/process-lifecycle/restart-convergence-matrix.test.js",
    "packages/agent-router/test/process-lifecycle/restart-quiescence-salvaged.test.js",
    "packages/agent-router/test/process-lifecycle/restart-quiescence.test.js",
    "packages/agent-router/test/process-lifecycle/rpc.test.js",
    "packages/agent-router/test/process-lifecycle/shutdown.test.js",
    "packages/agent-router/test/process-lifecycle/stale-registration-recovery.test.js",
    "packages/agent-router/test/process-lifecycle/startup.test.js",
    "packages/agent-router/test/process-lifecycle/timeout.test.js",
    "packages/agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js",
    "packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js",
    "packages/agent-router/test/process-lifecycle/v5-ingress-correlation.test.js",
    "packages/agent-router/test/process-lifecycle/workflow-execution-origin.test.js",
    "packages/agent-router/test/process-registry.test.js",
    "packages/agent-router/test/process-startup-wedge.test.js",
    "packages/agent-router/test/reconciliation-store.test.js",
    "packages/agent-router/test/route-chain/blocked-delivery-alerts.test.js",
    "packages/agent-router/test/route-chain/canary-seam.test.js",
    "packages/agent-router/test/route-chain/conversation-runtime-seam.test.js",
    "packages/agent-router/test/route-chain/conversation-source.test.js",
    "packages/agent-router/test/route-chain/delivery-race-repro.test.js",
    "packages/agent-router/test/route-chain/delivery-readiness.test.js",
    "packages/agent-router/test/route-chain/delivery-resilience.test.js",
    "packages/agent-router/test/route-chain/ingress-fallback.test.js",
    "packages/agent-router/test/route-chain/native-goal-admission.test.js",
    "packages/agent-router/test/route-chain/native-goal-composed.test.js",
    "packages/agent-router/test/route-chain/parent-rpc-stop-barrier.test.js",
    "packages/agent-router/test/route-chain/process-registry-route-gate.test.js",
    "packages/agent-router/test/route-chain/provider-route.test.js",
    "packages/agent-router/test/route-chain/quota-classifier.test.js",
    "packages/agent-router/test/route-chain/reconcile-batch.test.js",
    "packages/agent-router/test/route-chain/reconcile-cli.test.js",
    "packages/agent-router/test/route-chain/route-chain.test.js",
    "packages/agent-router/test/route-chain/startup-carrier.test.js",
    "packages/agent-router/test/route-chain/switch-workspace-guard.test.js",
    "packages/agent-router/test/router.test.js",
    "packages/agent-router/test/runtime-hygiene/no-hidden-hr-runtime-knowledge.test.js",
    "packages/agent-router/test/runtime-hygiene/recovery-compat.test.js",
    "packages/agent-router/test/single-flight.test.js",
    "packages/agent-router/test/workspace-binding.test.js"
  ],
  "cwd": "/private/tmp/h605-r2",
  "startedAt": "2026-11-07T04:19:45.773846+00:00",
  "head": "4f7df01bcf087075c114901a96a7a54573110f61",
  "log": "/private/tmp/h605-r6-evidence/full-router.log",
  "routerBeforeSHA256": "0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8",
  "rc": 1,
  "finishedAt": "2026-11-07T04:20:21.495398+00:00",
  "logSHA256": "ac1b00609c56c1df3f611e07a75d7e5a6e694445ee2b34c6875c589a0dc5abdd",
  "routerAfterSHA256": "0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8"
}
