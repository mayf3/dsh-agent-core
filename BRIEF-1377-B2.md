# BRIEF-1377-B2 — blocked/planned 合法自动恢复接回持久自动触发（实现派发）

授权: 常设授权#1(交付PR禁自合并)+预授权V1§1(常规研发)。
权威: `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1`(accepted, #623 merge 2d550bc8) + WAE V3 + D-009 对齐。
定义来源: agent-control issue **#1377**(父#1374)。
停止条件: 失败即停写 STOPPED-1377-B2.md; LOAD_BEARING SPEC_GAP 同样停(参照#1376先例, 写清最小关闭)。

## 环境预置与运行器配方(监管实测, 勿重建勿改)
- node_modules 已预链: node_modules -> /private/tmp/dsh-ekr-p1-new/node_modules。**只验证可达, 不创建不安装。**
- Node v26.7.0 陷阱: `node --test test/`(目录位置参数)会被当模块require报MODULE_NOT_FOUND——**用文件展开**: `node --test test/observation-cas/*.test.js`。
- 已知噪声: 全仓 `node --test` 下 test/stale-quiescence.test.js:176 有版本敏感断言挂(undici bytes()→Uint8Array), 属环境限制, 不作基线门、不修它。
- 观察套件基线: observation-cas 全套 47 条 rc0; broker 侧 owner-obligation 6 条 rc0(真实路径 packages/broker/test/capabilities/workflow-execution/)。

## 背景矩阵实证坐标(base 3c1bcf98)
- 已有: B3 三态对账(#624: engine.js:227-230, recovery/operation.js:60-66,107-109, projection.js:21-57)且 resumeAuthorized=false; production-runtime workflow-execution-runtime.js:456 poll 入口。
- **本任务缺口**: ①poll 对 resolution_blocked 跳过→按权威接回合法自动 recoverAttempt(持久自动触发, 非显式手动入口); ②B2 自动消费者验收; ③真实进程故障场景验收(复用 observation-cas 的真实进程/loopback 模式)。

## 任务项
1. PREFLIGHT: 读权威条款, 冻结 DONE_WHEN(对照 issue #1377 正文+评论与 Spec 条款)。若发现合法触发面缺口(如#1376的入口封闭问题), 停并写最小关闭, 不硬做。
2. 实现: 持久自动触发接线+自动消费者; 遵守 UNKNOWN/精确身份/零重放/零 fence 写边界; DEFAULT OFF 的既有开关语义不变。
3. 测试: 新增针对性用例+observation-cas 全套+broker 6 条 rc0 原文入收据; Docker/compose 依赖如实 SKIP 不伪装。
4. 交付: 分支 `feat/b2-auto-recovery`, push 开 PR(base main), **不合并**; 收据 RECEIPT-1377-B2.md(DONE_WHEN+测试原文rc+变更清单+HEAD SHA+未交付面如实)。

## 红线
失败即停; 不动治理文档/.agents/tools; 不 rebase; 零生产写入; 单写面=本worktree; PR禁自合并。

## R3 PREFLIGHT / blocked-only 冻结（2026-11-07）

用户 R3 明确承接 R2 的 blocked-only 收窄，机械只读路径错误自动继续；实现、验收门失败或权威冲突立即停止并追加 STOPPED。R1/R2 停止记录保留原文。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = REVIEW_TARGET_HEAD = CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
GOAL_OR_TARGET = resolution_blocked 持久自动触发及首次安全 admission
CURRENT_GAP = reconcile 永久 skip blocked；正式 recoverAttempt 尚无自动消费者
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1 CTR-EKRWAE-001/004/005/007 @ BASE_HEAD
RELATED_AUTHORITIES = WAE V3 CTR-WAE-011/012/013（经上述条款接续）；D-009 §8.4/8.5；D009_ALIGNMENT CTR-527D2-002/003
AUTHORITY_ACCEPTED_IN_BASE = YES (#623 merge 2d550bc8147c877db33886fccb85e00a64353e66)
IMPLEMENTATION_AUTHORITY = contracts
ROUTE_STAGE = IMPLEMENTATION
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = EXECUTION_MANDATE = VALID (用户 R3 + 原 Brief)
ISOLATED_WRITE_SURFACE = YES (/private/tmp/h1377-b2；原始 detached HEAD；单一候选树)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (不需要新 Spec，不使用 proposed adoption 的许可)
CONTROLLED_RUNBOOK_REQUIRED = NO (隔离源代码/本地进程验收；不执行生产恢复)
SPEC_GAP_DEPENDENCY = NONE (ordinary planned 依赖已由用户移出本范围)
EVIDENCE_REVIEWABILITY = PASS (仓库及隔离验收可由独立 reviewer 读取/复现)
LIVE_AUTHORITY_GAP = EMERGENCY_STATE = NONE
OWNER_DECISION_REQUIRED = NO
BASE_IMPACT = NONE (本轮 ls-remote main 与 BASE_HEAD 相同)
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (本任务禁止合并)
OPERATION_ALLOWED = NO (无生产授权)
NEXT_ACTION = CONTINUE
```

观察：accepted frontmatter 与末尾 acceptance alignment 共同绑定 #623；文中 authoring 时的 proposed/占位为历史，不使该 accepted 合同失效。node_modules 原链接可达，Node v26.7.0；不安装、不改依赖。

冻结 DONE_WHEN：

1. 既有 startup/reconcile/poll 自动发现 resolution_blocked，调用同一 recoverAttempt；FIFO/OwnerLock/fresh replay 内验证原身份及触发 revision，既有 ledger 持久 next-check、有限预算和有界退避，重启重建且无需人工继续。
2. 可信自动授权仅由已装载控制面规则及内部消费者产生，记录规则/trigger/attempt/request/generation/fresh gate；显式 authorityRef 人工路径保留，无两类授权零写。WAL、Router 次级门、投递前从未启动证明、world gate、UNKNOWN/零 fence 写及至多一次首次 admission 保留。既有 poller 默认 OFF 不变。
3. 隔离真实 fork/SIGKILL + loopback HTTP 验证解析失败后恢复、持久 next-check 后重启、授权后 WAL 前崩溃、WAL 后发送前崩溃、接纳后 ACK 丢失；自动/人工并发及安全负例覆盖。ordinary planned 仅拒绝负例。
4. 新针对性测试、原 observation-cas 47 条、broker owner-obligation 6 条须实际 rc0，原始输出持久保存；受影响合同独立审查及最终头 delta recheck 通过。Docker/compose 未执行面如实 SKIP，不冒充跨服务业务结果。
5. feat/b2-auto-recovery commit/push、base main 开 PR 不合并；RECEIPT-1377-B2.md 绑定实际源码/交付 SHA、测试 rc 原文、调用链、审查及未交付面。planned 半明确未交付（CTR-EKRWAE-004 排除），不声称全量关闭 #1377。

执行顺序：冻结 → 同 ledger 责任事件与内部自动消费者 → 真实进程/负例 → 要求的两套回归 → 独立审查 → 精确提交结构门 → push/PR → 收据最终 readback。失败即停止依赖工作，不修失败后重跑。

Model convergence：RETAIN 既有 reconciler、OwnerLock、ledger、recoverAttempt 与人工入口；MIGRATE blocked 永久 skip 到同一入口的有界自动消费；不新增 Scheduler/timer/queue/恢复引擎。delivery-domain/B3/Owner-resume 保持各自既有责任，不合并不同许可。

EXPANSION_TRIGGER：权威冲突、普通 planned 正向准入、业务 replay/身份或权限扩展、必需验收失败；本任务不得扩展修复。
