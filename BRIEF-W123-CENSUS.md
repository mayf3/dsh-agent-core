# BRIEF-W123-CENSUS — CTR-W1/W2/W3 实施状态普查（只读，#1388 首步）

仓库 worktree（main HEAD）。只读普查 + docs PR(base main) 不合并；生产写入=0。

## 任务

accepted 合同 AGENT_DELIVERY_RESILIENCE_V1 §4.3 CTR-W1/W2/W3 要求已明确（读 spec 原文）。逐项判定 main 的实现现状：

1. **W1 等待上限可配置**：caller 等待上限当前值在哪实现（观测样本默认 100s——找实际常量/配置面）；是否已按 surface/agent class 可配置？判定 IMPLEMENTED/PARTIAL/MISSING + 坐标
2. **W2 late 回复补投**：turn 在 caller 上限后 settle 且 outcomeEvidence=exact_turn_end_success 时——现 main 是否有补投路径（"(补投)"标记、可检索记录、CTR-R5 计数）？相关现有机制（PR #590 的 Router 韧性、turn-recovery、late settlement 存储如 reconciliation store）各覆盖哪部分？判定+坐标
3. **W3 outcome_unknown 入口可见性**：stop:outcome_unknown 现是否向入口 surface 通知"结果未证实/稍后补投或重发"？D-007 reconciliation 钩子现状？判定+坐标
4. **复用清单**：已存在可直接复用的组件（存储/投递通道/计数器/配置面）——列坐标；缺什么补什么的精确清单
5. **结论**：W1/W2/W3 各自最小差量一句话 + 是否已有合同内路径（不另造 Spec）

## 边界
- 只读；不改代码；PR 只含普查报告 BRIEF-W123-CENSUS-RESULT.md + 本简报
- 每个 EXISTS 判定带 main HEAD 坐标；不确定写 UNKNOWN
- push 失败（代理 7890）→ bundle 交接 /tmp/transfer-w123.bundle

## 工具指令
shell git/gh；禁 MCP github；写后 wc -l 自证。
