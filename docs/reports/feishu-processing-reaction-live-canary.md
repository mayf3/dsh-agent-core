# FEISHU_PROCESSING_REACTION — Live Canary (Phase A runtime + Phase B observer)

> 状态：**部分完成（STOPPED）** · 报告日期：2026-08-23（本地 CST）
> Verdict：P2P 路径 live 验证 **PASS**；group / topic / fail 三个 marker **NOT_OBSERVED**
> （owner 侧输入未到达，非产品失败信号）。总判定：状态执行 = STOPPED。

## 结论一览

| Marker | 期望路径 | Live 观察 | 判定 |
| --- | --- | --- | --- |
| `canary-20260823-2253-p2p` | P2P 成功回合 | 12/12 observer 检查全过（见下） | **PASS** |
| `canary-20260823-2253-group` | 群聊免 @ 入场 | 未到达 runtime（原始 WS 事件层即无记录） | **NOT_OBSERVED** |
| `canary-20260823-2253-topic` | topic 内回复成功回合 | 同上 | **NOT_OBSERVED** |
| `canary-20260823-2253-fail` | 失败回合清理 | 同上 | **NOT_OBSERVED** |

## 冻结坐标

- Product HEAD（PR #58）：`3a87b1d4d397c62a9969b4abc19ff086c5f15ad1`（remote headRefOid 已核对一致；本报告 commit 仅新增 docs + scripts，无产品代码改动）
- Harness：`a12bb03c6861969985f066bfbf0cb7e5dd5ac567`（rc.5）
- 测试 App（专用非生产）：`cli_aa03fbf9a4789d2d`（appHash `a606ee923641e00d`）
- Runtime：PID 94644，隔离 root `/private/tmp/feishu-processing-reaction-phaseA/runtime-root`，
  配置 `processingReactionEnabled=true requireMentionInGroup=false autoMentionTriggerSender=false`，
  auto-shutdown 2026-08-24 01:35 local。

## 权限证据（Phase A，独立验证）

`im:message.reactions:write_only` 已授予并发布；真实 API
create → list(1) → delete → list(0) 全链路 PASS。
证据：`docs/evidence/feishu-processing-reaction-canary-20260823/permission-evidence.json`。

## P2P marker 逐项验证（PASS）

Inbound `om_…87f2e2`（hash `5fb25fc9e5a7fd32`，text，0 mention，P2P chat hash `c3f2fa5b4914f0a5`）：

| 时间 (UTC) | 事件 |
| --- | --- |
| 13:58:21.778 | REACTION_API_CALL create（Typing）— 入场后、Agent turn 之前 |
| 13:58:21.782 | INBOUND_MESSAGE 记录 |
| 13:58:23.837 | AGENT_TURN_STARTED |
| 13:58:30.424 | AGENT_TURN_FINISHED（replyPresent=true） |
| 13:58:31.142 | OUTBOUND_SENT（reply hash `974bcb916c1962f4`，replyTo=inbound，markdownInput=true，mentionsCount=0） |
| 13:58:31.145 | REACTION_API_CALL delete（settle 后） |

- create=1 精确一次、delete=1 精确一次；一次 ingress 恰好一个 Agent turn。
- Live API（观察者独立 channel）：`Typing` 反应当前在该消息上 **ABSENT**（liveCount=0）。
- Reply 实体核验：`msg_type=post`，含 `md`（markdown）元素，`mentionsEnt=none`，
  body 0 个 `@_user_*`，echo 了 marker，`root_id` = inbound（P2P 非线程）。
- 完整检查输出：`docs/evidence/feishu-processing-reaction-canary-20260823/observer-p2p.jsonl`（ALL_PASS 12/12）。

## §五 调用统计（对已观察回合的证明）

- `MAX_REACTION_CREATE_CALLS_PER_TURN = 1`
- `MAX_REACTION_DELETE_CALLS_PER_TURN = 1`
- `PERIODIC_READD_CALLS = 0`：日志扫描证明 —— 全部 REACTION_API_CALL 行（create 1 + delete 1）均与唯一 inbound 相邻（±120s 内）；settle（13:58:31Z）之后至观察结束（15:38Z）零新增 reaction 调用；HEARTBEAT 计数器仅在 inbound 后的心跳从 0/0 → 1/1 跳变一次，其余心跳全部持平。
- `KEEPALIVE_TIMER_COUNT = 0`：evidence JSONL 无任何 keepalive/timer 类行（28 行全量扫描）。
- 证明文件：`docs/evidence/feishu-processing-reaction-canary-20260823/stats.json`。
- **Caveat**：以上统计基于 1 个真实人类回合（P2P）。

## Group / Topic / Fail 未观察（NOT_OBSERVED）

- Runtime 在 **原始 websocket 事件层**（`im.message.receive_v1`，先于任何入场判断）记录
  INBOUND_MESSAGE；观察至 23:38 local（marker 标称时间 22:53 之后 45+ 分钟）始终只有 1 条
  inbound（P2P）。⇒ 这三条消息**从未到达 App websocket**，不是被 gate 拦截。
- P2P 会话历史 live 扫描仅见 p2p marker 与其回复；群历史无法独立扫描（App 缺
  `im:message.group_msg` scope，API 230027）。
- 判定为运营侧缺口（人类输入缺失），**未观察到任何产品缺陷**；不可据此判 FAIL。
- 详见 `docs/evidence/feishu-processing-reaction-canary-20260823/missing-markers.json`。

## Evidence 文件（全部 sanitized：仅 hash/计数/枚举，无 secret/token/原文 body）

- `permission-evidence.json` — scope 真实 API 验证
- `runtime-evidence.jsonl` — Phase A runtime sanitized JSONL 快照
- `observer-p2p.jsonl` — Phase B observer 输出（12/12 PASS）
- `stats.json` — §五 统计与证明
- `missing-markers.json` — 未到 marker 的检测方法与判定

隔离 runtime 状态保留于 `/private/tmp/feishu-processing-reaction-phaseA/` 以备审计（不删除）。

## Runtime 处置

Runtime（PID 94644）**保持存活**至其 auto-shutdown（2026-08-24 01:35 local）：因三条 marker
未到，提前杀掉将使 owner 后续补发消息彻底失去验证机会；4 小时 auto-shutdown 提供硬性安全
上界。若 markers 在 auto-shutdown 前到达，evidence JSONL 将自动记录，可事后离线核验。

## 判定

状态执行 = **STOPPED**（P2P live PASS；group/topic/fail NOT_OBSERVED，待 owner 补发输入后可续做）
