# REVIEW-1377-B2-R3 — independent affected-Contract review

原文来源：独立 reviewer `/root/blocked_scope_advice` 最终回传；根仅持久记录。reviewer 未作者源码、测试或本候选文档，未运行额外测试。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_RESULT = REVISE
SPEC_REVIEW = NOT_APPLICABLE
REVIEW_TARGET_HEAD = 77b9644b2a6ff70cb6af2cf00bb134502a0eef8b
BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
REVIEWER_ID = /root/blocked_scope_advice
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = 本候选首次独立受影响合同审查；仅 blocked-only 变更及直接依赖
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = FAIL
ACCEPTANCE_COVERAGE_REVIEW = FAIL
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 1
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
FROZEN_BLOCKER_UNION = [B2-R3-REV-001]
```

`IMPLEMENTATION_ALLOWED=NO` 指用户“失败即停”下本轮不得继续修复；不表示 accepted blocked-only 实现授权失效。

## B2-R3-REV-001

**CONTRACT_VIOLATION：自动 world-drift refusal 进入终态后失去后续消费者，未实现可靠交接。**

- **SOURCE：** `AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md:238` 要求 world drift 沿旧 refusal 保留事实并可靠交接；`:278–284` 要求状态、消费者、持久触发、失败责任和关闭条件闭环，明确不能仅凭 `NEEDS_REVIEW` 标签或通知 ACK 宣称交接。
- **COUNTEREXAMPLE：** 原 `resolution_blocked` 被自动消费者发现，fresh read 返回 visit 已迁移、assignee 已改变或实例已终止。`recovery/operation.js:140–155` 追加 `recovery_refused`，投影进入终态；之后 `automatic.js:19–20` 仅选取 `ACTIVE/resolution_blocked`，永久排除该项。`operation.js:212–214` 也只为仍 blocked 的项更新检查结果。原 `recoveryCheck.nextCheckAtMs` 虽留在投影中，但已经没有消费者。没有 `delivered` 的该项也不能进入既有 readback 消费者；Forum projection 对未渲染的 `recovery_refused` 在 `forum-projection.js:203–207` 直接跳过。现有 world-drift 测试证明拒绝路径可达，却只验零 admission 和 refusal audit，没有验拒绝后的持续责任或可靠交接。
- **IMPACT：** 安全准入拒绝正确，但 world drift 后该项只留下 `NEEDS_REVIEW`，没有接收责任方、交接证明、答复验证或重新触发路径；不满足本次 affected `CTR-EKRWAE-004/007`，不能将 blocked-only DONE_WHEN 判为完成。
- **MINIMAL_CLOSURE：** 完成该终态 refusal 的实际责任延续或合法可靠交接，使其在重启后仍有可验证的消费者和失败重试责任；成功移交须绑定真实接收方、送达证据及答复验证/重新触发路径。保持终态 `recoverAttempt` no-op、零二次 admission、原身份及 UNKNOWN。新增对应的拒绝后重启、交接失败保留责任及合法交接验证。不能以新增标签、单次日志、Forum 通知 ACK 或伪造 assistance case 替代。
- **affected_readiness：** `implementation=NO`（本轮停止）、`merge=NO`、`operation=NO`。

这是候选对既有 accepted 合同的实现不足，**不是新的 Product Authority 缺口**；没有理由为机械恢复另造 Spec，亦不得冒用 `ATTEMPTS_EXHAUSTED/STALE_LOOP_EXHAUSTED` 创建 Assistance。

其他受审边界未发现第二个当前可达阻断项：自动授权由内部单次 capability 产生，锁内比较原身份和检查 revision；持续 resolver/Router 不可用保留同身份持久 next-check 和有界退避；WAL 优先于 Router 缺失标签，ordinary planned 排除，自动/人工并发至多一次首次 admission，UNKNOWN/fence 没有被恢复路径改写。

已读取实际原文结果：新针对性 **33/33 rc0**、原 observation-cas **47/47 rc0**、broker **31/31 rc0**（含指定六例）、受影响回归 **135/135 rc0**。真实进程 SIGKILL、WAL 前后、ACK 丢失和跨进程并发证据可读。上述测试通过不覆盖本阻断项的拒绝后交接闭环，也不等于安装启用或跨服务业务验收。未运行额外测试、未写文件。
