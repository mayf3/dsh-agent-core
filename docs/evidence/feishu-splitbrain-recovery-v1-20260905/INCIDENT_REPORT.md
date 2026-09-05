# FEISHU_PRODUCTION_REPLY_RECOVERY_V1 — Incident Report

Date: 2026-09-05 (CST) · Priority: P0_INCIDENT · Final: **FEISHU_PRODUCTION_REPLY_READY = YES, GOAL_STATUS = COMPLETE**

## Symptom

Owner 报告飞书消息发后 Agent 不回复，且症状按 agent/按条随机翻转（先 "efficiency 回 / hr 不回"，后 "hr 回 / 其他人不回"）。

## Root Cause (PROVEN — mechanical)

**双 WebSocket 消费者 split-brain**：同一飞书 app（cli_a9d7abdf05385cd3）被两个 runtime 同时持有长连接，飞书把每条事件随机投递给其中一条连接：

| 实例 | 进程 | 域 | root | 说明 |
|---|---|---|---|---|
| 生产 | pid 63411（8:16:09 起） | launchd system `ai.agent-core.runtime`（authsvc） | /Users/authsvc/.agent-core | 正确消费者；事件到达即正常回复 |
| 孤儿 legacy | pid 53506（7:34:58 起，**launchd 未追踪的孤儿**，gui 域服务态=disabled） | 用户域 | /Users/yanfenma/.agent-core | 旧生产残留（luna-rc8 harness + glm53 wrapper） |

legacy 吞消息三条路径（均有日志证据）：
1. **群消息静默 skip**：legacy plist 未设 `FEISHU_REQUIRE_MENTION_IN_GROUP=false`（默认 true），生产设了 false → 同一条群消息生产会回、legacy 记 `group_not_mentioned` skip（08:57–09:36 共 6 条）。
2. **PREBOUND_ONLY gate fail-closed**：旧 binding store（90 entries）缺的会话直接丢弃。
3. **死模型**：命中旧 store 的 DM 走 opencode（429 月配额 GoUsageLimitError）/ openai-codex（401 refresh_token_reused）→ turn error 无出站。

排除项：scheduler runtime（pid 1696，`~/.agent-core-scheduler-v2`）feishu channel OFF；dsh lark-pilot（pid 1697）唯一外连为 dsh 后端（googleusercontent），非 feishu 消费者；生产 runtime 本身（63411）全链路健康（efficiency "hi" 09:09:18→09:09:24 6s 完成）。

## Minimal Fix (APPLIED — 用户域，零 sudo，生产零改动)

1. Preimage：`~/Library/LaunchAgents/ai.agent-core.runtime.plist` → `.bak-feishu-recovery-v1-20260905`（sha256 `9a779a829630a0e65b7167d2152c07836099b2719652d9a9f1671724c0f63286`）。
2. `plutil -remove EnvironmentVariables.FEISHU_CREDS_PATH`（diff 确认仅移除该键）。
3. `kill -TERM 53506`（优雅停，runtime-evidence.jsonl 记 `stopped 53506 SIGTERM`）。
4. `launchctl enable + bootstrap gui/502/ai.agent-core.runtime` → 新 pid **18234**，日志确认 `WARN feishu credentials not configured (FEISHU_CREDS_PATH=(unset)); channel OFF`。

未动面：生产 63411（pid 不变）、移动面 8787、scheduler 1696、svc-workflow 8989、auth 4001、credential/grant/svc 代码零变更。PRODUCTION_MUTATION = 仅上述用户域 plist + 进程替换。

## Real Feishu E2E (PASS — turn 73, byte-exact)

- 10:31:44 入站 `FEISHU-RECOVERY-CANARY-20260905-K4TZ92`（恰 1 条 user/message）→ 10:31:50 回复 `已收到：\`FEISHU-RECOVERY-CANARY-20260905-K4TZ92\``（id 逐字节一致）。
- 机械计数（生产 efficiency session main/session.jsonl turn 73）：INBOUND=1、TURN=1、MODEL_RUN=1（1 step，usage in 1231/out 26，finish=stop，0 tool calls）、OUTBOUND=1、USER_VISIBLE=YES（Owner 确认）。
- legacy 侧 canary id 0 命中、修复后 0 条 feishu 日志行 → 单消费者证明。
- 首次 canary（turn 72）入站为字面模板含占位符，agent 自填后缀 ACK7M2——链路计数同样全 1，但同 id 回显协议以 turn 73 为准。

## Terminal Checklist

ROOT_CAUSE=PROVEN · FAILURE_HOP=PROVEN（ingress→legacy swallow）· MINIMAL_FIX=APPLIED · FEISHU_CONNECTION=PASS · INBOUND/ROUTER/AGENT_CHILD/MODEL/OUTBOUND=PASS · REAL_FEISHU_E2E=PASS · UNRELATED_CORE_CAPABILITIES=PRESERVED（scheduler / agent_session_send（当日 B2 A2A turns 正常）/ workflow_execute 面零接触，runtime health PASS）

**FEISHU_PRODUCTION_REPLY_READY = YES · GOAL_STATUS = COMPLETE**

遗留债务（非本 goal 范围）：legacy 实例（18234，channel OFF）仍承载移动面与其旧 scheduler loop，其模型 provider（opencode 429 / codex OAuth 401）已死——后续应裁决 legacy runtime 的退役/收编方案；生产侧复杂 turn 可达 20+ 分钟（DSH_AGENT_TURN_TIMEOUT=900s），勿误判为故障。
