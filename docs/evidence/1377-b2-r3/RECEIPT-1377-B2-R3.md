# RECEIPT-1377-B2 — R3 blocked-only / STOPPED_AT_REQUIRED_REVIEW_GATE

日期：2026-11-07，Asia/Shanghai。此为**失败出口和可恢复检查点**，不是成功交付或验收 PASS 收据。

## 坐标、授权和停止位置

| 项 | 实际结果 |
| --- | --- |
| repository / worktree | mayf3/dsh-agent-core / `/private/tmp/h1377-b2` |
| branch | `feat/b2-auto-recovery`（本地已建立） |
| base / PREFLIGHT current main | `3c1bcf98bc40a2c34cca24f241c87d1b12cea216`；本轮 ls-remote 相同 |
| implementation / test / review HEAD | `77b9644b2a6ff70cb6af2cf00bb134502a0eef8b` |
| source after tests/review | `git diff HEAD -- packages` 为空；逐文件实测哈希见 [checkpoint.json](docs/evidence/1377-b2-r3/checkpoint.json) |
| execution mandate | 用户 R3 + 原 Brief；blocked-only、单 worktree、机械读错自动续行、失败即停、不 rebase、零生产写入、PR 不合并 |
| authority | base 中 accepted Recovery Liveness V1 CTR-EKRWAE-001/004/005/007；WAE V3 其余边界、D-009 / D009_ALIGNMENT 保留 |
| route | REUSE / BRIEF / DURABLE / IMPLEMENTATION；冻结记录见 [BRIEF R3](BRIEF-1377-B2.md) |
| environment | Node v26.7.0；原 node_modules 链接 `/private/tmp/dsh-ekr-p1-new/node_modules` 可达；未安装/重建依赖 |
| source commit | 本地已提交，提交在实际测试及独立审查之前 |
| independent review | **REVISE**；1 个 CONTRACT_VIOLATION，0 个 SPEC_GAP |
| push / PR / merge | **NOT_PERFORMED — 必要独立审查门失败即停** |
| production writes | **0** |

## 冻结 DONE_WHEN 与实际完成面

1. 既有 startup/reconcile/poll 自动发现 eligible resolution_blocked，共享 recoverAttempt、FIFO/OwnerLock/fresh replay；原身份/trigger revision、有限预算和同 ledger 持久 next-check、重启自动消费：**隔离机制测试通过**。
2. 内部可信规则授权、原 request/attempt/generation、WAL、Router 次级门、从未启动/工具未派发证据、world gate、UNKNOWN/零 fence 写和单次首次 admission：**所测安全反例通过**；world-drift 拒绝后的责任闭环缺失，**本项整体未完成**。
3. 真实子进程/loopback 验证依赖恢复、重启发现、授权后 WAL 前 SIGKILL、WAL 后发送前 SIGKILL、接纳后 ACK 丢失、自动/人工竞争：**5/5 通过**；普通 planned 仅拒绝负例。
4. 新测试、原 observation-cas、broker 必需六例及相关回归：**全部实际 rc0**；独立审查必要门：**FAIL / REVISE**。
5. branch 已建立；push/开 base=main PR：**未执行**。按失败即停保存本收据、STOPPED 和实际证据；未交付成功 PR。

blocked-only DONE_WHEN **未满足**。不把测试 PASS、函数存在或源代码 commit 当成整体完成。

## 候选实现及实际调用链

`mountWorkflowExecutionRuntime` → 既有 configured poller（未配置默认 OFF）→ engine startup/reconcile/poll → `reconcileBlocked` → 内部单次 capability → 同一 `recoverAttempt` → FIFO/OwnerLock/fresh replay → exact trigger 检查 → 同 ledger `recovery_checked` 持久下一次 → fresh WAL/Router/resolver/world gate → `recovery_authorized`（规则/trigger/identity/gate audit）→ fresh resolve → `delivery_started` append+fsync → 原 requestId 首次 deliver。

自动权限不能由公开 recoverAttempt 参数构造；显式 authorityRef 人工入口保留。临时 resolver/Router/instance read 不可用保持 blocked 及有界退避；不新增 Scheduler、timer、queue、execution ledger 或业务重试引擎。

变更文件：

- `src/recovery/automatic.js` / `automatic-ledger.js`：消费者、预算/退避、精确触发 CAS、同 ledger 责任事件和自动授权审计校验。
- `src/recovery/operation.js`：复用正式入口、内部授权 capability、共享安全 gate 与 world/target/revocation 检查。
- `src/ledger.js` / `ledger-records.js` / `ledger-events.js`：锁内 scope-bound 责任 appender、追加与重放、自动来源 audit。
- `src/engine.js` / production-runtime `workflow-execution-runtime.js`：接回既有自动消费者，沿用原默认 OFF 开关。
- `src/owner-assistance-resume-engine.js`：导出已有 exact activation predicate 供共享校验，未改其判断语义。
- 三个新增 observation-cas 文件：`blocked-recovery.test.js`、`blocked-recovery-process.js`、`blocked-recovery-restart.test.js`。

上述 `src/` 路径除特别标明 runtime 外均位于 `packages/workflow-execution/`。未改治理、`.agents/tools`、accepted Specs、依赖或生产配置。

## 实测原文和 rc

原始文件均包含完整执行命令、`EKR_SOURCE_SHA=77b9644b2a6ff70cb6af2cf00bb134502a0eef8b`（测试）、未裁剪输出及末尾 `exit_code: 0`。没有管道末段 rc 掩盖测试失败。

| 门 | 实际结果 | 完整原文 |
| --- | --- | --- |
| 12 个 JS 语法检查 + diff whitespace | 全部 rc0 | [syntax.txt](docs/evidence/1377-b2-r3/syntax.txt) |
| 新 B2 针对性，含真实进程 5 条 | tests 33 / pass 33 / fail 0 / rc0 | [blocked-targeted.txt](docs/evidence/1377-b2-r3/blocked-targeted.txt) |
| 原 base 中 8 个 observation-cas 测试文件 | tests 47 / pass 47 / fail 0 / rc0 | [observation-cas-47.txt](docs/evidence/1377-b2-r3/observation-cas-47.txt) |
| broker owner-obligation-attempt + owner-obligation | tests 31 / pass 31 / fail 0 / rc0 | [broker-owner-obligation-31.txt](docs/evidence/1377-b2-r3/broker-owner-obligation-31.txt) |
| recovery / engine / Owner-resume / execution-control / runtime-wiring | tests 135 / pass 135 / fail 0 / rc0 | [affected-regressions.txt](docs/evidence/1377-b2-r3/affected-regressions.txt) |
| exact base→candidate 结构门 | rc0；候选违规 0；既有 debt 28 | [structure.json.txt](docs/evidence/1377-b2-r3/structure.json.txt) |

broker 31 条中的**要求六条**来自 `packages/broker/test/capabilities/workflow-execution/owner-obligation-attempt.test.js`，覆盖 create_instance / resolve_current_governance_review / escalate_to_human 各自 SUCCEEDED / UNKNOWN；另一个 owner-obligation 文件额外 25 条。实际不是“只跑六条”，原文保留实际 31 计数。总计本轮执行 **246 条，246 PASS，0 fail**。

原 observation-cas 从冻结 base 的已存在 `.test.js` 文件集合展开，明确保留原 47 计数；新增 33 另行执行，两者合起来覆盖本候选该目录全部测试。未用 Node v26 不支持的目录位置参数。

真实故障场景在临时隔离目录、真实 JSONL append+fsync、真实 Router receipt store、fork/SIGKILL 及 loopback HTTP 上执行。SIGKILL 在 record 原函数返回（fsync 完成）后通过 IPC barrier 注入；不是 throw 模拟。ACK 丢失场景先持久原 receipt，重启读取 UNKNOWN/fence 并验证零第二次投递。每个场景的身份、事件、发送计数、child exit 和限制均在原始 diagnostic 中。

## 必要审查门失败：B2-R3-REV-001

审查原文：[REVIEW-1377-B2-R3.md](docs/evidence/1377-b2-r3/REVIEW-1377-B2-R3.md)。

```text
REVIEW_RESULT = REVISE
AUTHORITY_REVIEW = PASS
CONTRACT_REVIEW = FAIL
ACCEPTANCE_COVERAGE_REVIEW = FAIL
FROZEN_BLOCKER_UNION = [B2-R3-REV-001]
BLOCKERS = 1
SPEC_GAPS = 0
affected_readiness = implementation:NO, merge:NO, operation:NO
NEXT_ACTION = STOP
```

`operation.js:140–155` 自动 world drift 追加 recovery_refused 后成为终态；`automatic.js:19–20` 永久排除该项；原 next-check 无后续消费者，Forum 也跳过 refusal。违反 accepted `CTR-EKRWAE-004:238` / `CTR-EKRWAE-007:278–284` 的可靠交接/持续责任要求。所执行 world-drift 用例未验证拒绝后的交接闭环，故测试通过不能关闭该 blocker。

最小关闭是完成实际持久责任消费者或合法可靠交接，证明重启再发现、交接失败仍保留责任、真实接收方与答复验证/重新触发；不改变终态 recoverAttempt no-op、零重放及 UNKNOWN。**不是新的权威阻碍，不需为此另造 Spec。** 本轮按用户失败即停，不进行修复或重审。

## 限制、未交付面与历史衔接

- **planned 半未交付**：CTR-EKRWAE-004 明确排除 ordinary planned 正向恢复；本轮只测拒绝，不声称全量关闭 #1377。
- **blocked-only 未完成面**：上述 world-drift refusal 后的责任延续/可靠交接；成功 PR/push 因审查门失败未交付。
- Docker/compose：**SKIP / NOT_RUN**，本轮未执行；不推断 Docker 不可用。真实 Svc DB 和跨服务业务验收未执行。
- 安装、生产启用、live business acceptance、无人值守业务端到端：**UNKNOWN / NOT_RUN**。只证明隔离环境自动消费者机制，故障测试本身包含父进程注入；不称为真实业务全流程无人值守。
- 全仓 `node --test` 与已知环境敏感 stale-quiescence 断言：**NOT_RUN**，依 Brief 配方不作本轮基线，不修无关测试。
- 原 R1/R2 STOPPED 保留，未改写历史。R3 的只读定位也出现错误路径/无匹配 glob（含 test/observation-cas、packages/router/src、误猜 Broker 路径及子 agent 报告的 helper 路径）；依用户“机械失败自动继续”使用实际观察路径接续。它们不是测试/权威门 PASS，也未被伪装为本轮停止原因。
- 子 agent 仅按分工新增三个测试文件，未运行测试/提交；根统一执行实际验收。独立 reviewer 未作者语义 delta。所有写入限本 worktree，无生产/远端消息写入。

收到审查失败后仅保存 evidence、checkpoint、REVIEW、STOPPED 与本收据，未再修源码、跑测试、commit、push、开 PR 或 merge。R3 日志和停止文档当前保存在本 worktree，尚未提交；源码 checkpoint 已在上述本地 HEAD。实测哈希清单见同目录 `SHA256SUMS.txt`。
