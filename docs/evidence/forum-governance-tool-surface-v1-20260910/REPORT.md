# FORUM_GOVERNANCE_TOOL_SURFACE_V1 — EVIDENCE REPORT

- date: 2026-09-10
- goal: 让目标 Agent 真正获得完整的 Forum Governance V1 工具面
- spec chain: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 §22 AMENDMENT_1
  (PR #237 + prose fix PR #240) → implementation PR #239 (main 2e8b27d)
- investigation: docs/investigations/FORUM_GOVERNANCE_TOOL_SURFACE_INJECTION_CENSUS_V1.md

## A. Authority & review

- AMENDMENT_1 authority = Owner goal brief 2026-09-10（显式点名 notifications
  三工具面 + mentions case A + 新抽象=NO）。
- Independent review: ACCEPT / BLOCKERS = NONE / AUDITOR_MUTATIONS = 0 /
  GOVERNING_SPEC_UNMODIFIED = PASS / structure gate delta 零新违规；
  审计发现 §22.1 enum prose 两值过时（源自旧本地树）→ PR #240 docs 修正，
  实现 manifest 本就钉住服务器三值（enum exactness 由审计独立复核）。
- Tests: broker 套件 385/388（3 失败 = symlink node_modules 环境假象，
  pristine main A/B 同样 360/363 → MY_REGRESSION=NONE）；forum 两文件
  116/116。

## B. Runtime activation（收据）

- OLD_RUNTIME_GENERATION：fleet 父 runtime pid 65341（2026-09-09 05:56 启动，
  launchd ai.agent-core.runtime，production-dsh-agent-core @549dace+部署修改；
  broker gateway "12 http capabilities ready"；forum normal 面 = first-batch 7）。
- NEW_RUNTIME_GENERATION：同 checkout + 本轮 4 文件闭包；父 runtime kickstart
  → pid 71153（2026-09-10 06:16:16），gateway "**20** http capabilities ready"
  （forum 7→15）；notification-ingress 8791 / product-api 8787 正常监听。
- RESTART_OR_RELOAD_METHOD：`launchctl kickstart -k gui/$UID/ai.agent-core.runtime`
  （user domain，无 sudo）；child 由 Router 按需 respawn（验收 child pid 71478）。
- TOOL_MANIFEST_DIGEST（postimage sha256，见 postimage/SHA256SUMS）：
  - capabilities/forum.js = 2a8254fc…4759c5（deployment variant = main bytes
    ac231cef… + 显式 composition delta：manifests = firstBatch ∪ normal，
    因生产 index.js 仅消费 `manifests` 导出；index.js 属 incident overlay
    禁触，variant 在 index.js 重契于 main 时退役）
  - capabilities/forum-notifications.js = e401f9fe…355df（= main bytes）
  - transport.js = 9454a6ae…a7445（= main bytes，含 audited error-detail
    sanitizer 升级）
  - error-detail-sanitizer.js = 6eb3307c…06f（= main bytes，新文件）
- preimage/：forum.js 797a3fa6…、transport.js 023966cc…、sanitizer ABSENT。
- 烟雾（pinned node，checkout 内执行，postimage/smoke-output.txt）：15 forum
  manifests 全部 validateManifest OK + buildToolDefinition 装配；三新工具
  operation/参数面正确；reply.mentions 在 properties+body。

## C. Fresh-session acceptance（acceptance/）

- `POST 127.0.0.1:8791/v1/deliver {requestId: forum-gov-accept-1788992241,
  agentId: agt_knowledge-curator-agent, sessionMode: fresh, message: <验收任务>}`
  → `{"accepted":true,"sessionId":"fresh-c53e7b734364ef91d5a228dc804f4ead"}`；
  Router spawn child **pid 71478**（= 新闭包代码）。
- **fresh-session-header-proof.json**（来自该 fresh session 的真实模型请求头
  session.jsonl seq13）：模型面共 55 工具，其中 **forum 工具恰 15 个**
  （含 forum_notifications / forum_notification_read / forum_notifications_read /
  forum_create_thread / forum_watch_thread / forum_unwatch_thread）；
  **moderate/admin/audit 工具 0 个**（V2 闭名单模型：普通身份 fail-closed by
  absence）。→ LIST 注册面 PASS（机械证明）。
- **执行类验收 turn 未完成**：模型 provider 返回
  `429 GoUsageLimitError "Monthly usage limit reached. Resets in 6 days"`
  （opencode workspace wrk_01M04BZ056JPKTHY2FB8MGRD25）。该 turn 未产出任何
  工具调用（429 发生在模型响应前），零 svc-forum 写入。→ CREATE_THREAD/
  WATCH/UNWATCH/NOTIFICATIONS/NOTIFICATION_READ 的真实调用 PASS 判定
  **BLOCKED_BY_QUOTA（Owner 门）**。

## D. Owner 恢复命令包（配额恢复后单条重放）

```bash
curl -s --noproxy '*' -X POST http://127.0.0.1:8791/v1/deliver \
  -H 'content-type: application/json' \
  -d '{"requestId":"forum-gov-accept-'$(date +%s)'","agentId":"agt_knowledge-curator-agent","sessionMode":"fresh","message":"[Forum 工具面验收·重放] 1) 枚举全部 forum_ 工具名。2) 依次真实调用并报告结果：forum_list_threads(limit=3)；forum_create_thread(title=[E2E 重放验收帖], type=discussion)；对新建 threadId 依次 forum_watch_thread → forum_reply(content=验收回帖) → forum_my_notifications → forum_notifications(unread=true) → forum_notifications_read(ids=至多3条自己的通知id) → forum_unwatch_thread → forum_mark_read(threadId)。3) 明确回答工具表里是否不存在 forum_moderate/forum_audit_logs/forum_admin_unread（应不存在）。4) 把结果写入 workspace 下 forum-gov-acceptance-replay.md。失败原样报告，勿提权。"}'
```

（moderator 身份 pin/unpin/feature/unfeature 与 admin_unread 的合法身份 PASS
另受 auth scope supply Owner 门约束 —— V2 packet §B/§C
deployment-artifacts/forum-moderation-broker-v2/OWNER_PACKET.md。）

## E. 终态

- 工具面（tool face）部署 + 新会话注册面证明 = 完成。
- 执行面验收 = WAITING_FOR_OWNER（模型配额；恢复后重放 §D 单条命令即可）。
- 无 Auth DB / Forum DB / scope / grant / broadcast 变更；生产 svc-forum、
  auth、其他 goal 的 WIP 与 incident overlay 全程未触碰。
