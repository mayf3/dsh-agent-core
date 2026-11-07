# BRIEF-1376-AMEND-AUTHOR — readback-aging 合法交接入口 AMEND 提案（docs-only 作者派发）

授权: 常设预授权V1§2(治理Spec链); 依据=STOPPED-1376-BUDGET.md 的 MINIMAL_CLOSURE(b)。
你只写提案文档(proposed), 零产品代码、零 .agents/tools 改动。停止条件: 失败即停追加 STOPPED-1376-BUDGET.md。

## 任务
起草 AMEND 提案: 在既有系统级 Assistance 入口上开**有界 readback-aging 分支**。设计约束(来自停点最小关闭, 逐条绑定):
1. 新 reason(命名自定, 如 READBACK_WAIT_BUDGET_EXHAUSTED)扩展 WEC V3 CTR-WEC1-008 封闭枚举; 触发=读回等待预算耗尽(aging 独立于失败计数, DW-1 语义); 不得把等待超限伪装成 ATTEMPTS_EXHAUSTED/STALE_LOOP_EXHAUSTED。
2. actor=poller/系统收据 actor; 不得冒充 assignee; 不给 poller assignee 写角色(LIVENESS_V1 §8 crosswalk 边界)。
3. 保全: 原始身份+UNKNOWN+零重放/零 fence 写(WEC008/LIVENESS CTR-EKRWAE-001/003)。
4. 交接义务: 幂等服务收据/读回、接收方与后续消费者、答复验证、可再触发(CTR-EKRWAE-003/007 全绑); 送达失败或仅 ACK → 保留自动责任+下次触发。
5. 策略 DTO 保持封闭(只扩枚举+必要字段, 不开放任意载荷); 需列出新字段的 schema 与向后兼容(旧消费者不识新 reason 的行为必须明确)。
6. 与 #1379 Wake 传输面解耦; 不建第二账本/平台/盲目业务重试。

## 交付
- 文档: `docs/specs/`下 AMEND 提案(含对三个权威的精确条款坐标: LIVENESS_V1/WEC V3/WAE V3), status: proposed, 零实施权。
- 分支 `docs/readback-aging-handoff-amend`, push 开 PR(base main), **不合并**。
- 收据 `RECEIPT-1376-AMEND.md`: 条款对照表+DONE_WHEN+HEAD SHA+PR链接。
- 链路: 提案→独立审查→Owner 接受→#1376 实现 RE_PREFLIGHT 复用已冻结 DONE_WHEN。
