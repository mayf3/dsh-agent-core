# ADMISSION_SEAM_OPERATOR_RUNBOOK_V1

Goal: 把 svc-workflow admission 链路（10-17 事故面，PRODUCT #525）的**稳定脱敏错误码**映射到
操作员动作，并冻结 agent 侧求助/重试规约（P4+P5）。本文件零生产变更；P2 跨服务 canary 探针
**不在本 runbook 内**（deferred，与 #523 R3 绑定漂移、#527 D3 scheduler health 合并评审，
禁止重复 watcher/probe）。

**脱敏红线（继承 AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 R3）**：错误码/detail 永远
不含 principal UUID、token、URL 凭据、会话内容。本 runbook 只记录 code 名与动作，不记录任何
身份素材。

## §1 Admission 链路坐标（哪个环节断了，code 会说话）

```text
agent ──mint──▶ auth-service ──token──▶ svc-workflow admission
                                          │  (WORKFLOW_ADMISSION_ENABLED=1)
                                          ├─ AUTH_BASE_URL  → auth-service 验 token
                                          └─ CORE_BASE_URL  → agent-core 目录读
                                               GET /v1/directory/agents/:agentId
                                               （agent-core 侧验证器 JWKS 来源 =
                                                AGENT_DIRECTORY_AUTH_JWKS_URL）
```

- svc-workflow 侧 env：`WORKFLOW_ADMISSION_ENABLED` / `WORKFLOW_ADMISSION_AUTH_BASE_URL` /
  `WORKFLOW_ADMISSION_CORE_BASE_URL`（svc github/main bfc28c15 src/auth/admission.rs）。
- agent-core 侧 env：`AGENT_DIRECTORY_AUTH_JWKS_URL`（compose 挂载
  `createWorkflowAdmissionHandler`；**缺失即拒绝组合启动**——P1 fail-loud，不再静默全 401。
  精确语义：仅当 product API enabled 时要求该 env；`PRODUCT_API_ENABLED=0` 的组合不受影响）。

## §2 svc-workflow `admission_*` 稳定错误码 → 操作员动作

来源：svc @ bfc28c15320acab8cf7d7a36128cd5c9db9a1b1a `sanitized_code()/sanitized_status()`
（已核对 github/main）。**422 = 单 principal 业务拒绝；503 = 基础设施/不确定，全局性**——
先看 4xx/5xx 分类即可分辨"我的参数错了"还是"基础设施挂了"（#525 P4c）。

| code | HTTP | 含义 | 操作员动作 |
|---|---|---|---|
| `admission_rejected` | 422 | principal 被 admission 拒绝（单主体） | 核对该 agent 的 principal/enabled 状态；确认 agent 在 auth-service ACTIVE 且未被禁用 |
| `admission_denied` | 422 | 该 caller 的 assignment admission 被拒（单主体） | 核对 caller 对目标 assignment 的授权关系；无需重启任何服务 |
| `admission_timeout` | 422 | admission 检查超时未出决定 | 先重试一次（见 §4）；连续超时→检查 auth/agent-core 目录服务延迟与健康位 |
| `admission_unavailable` | 503 | admission 目录不可达（**全局性**） | 检查 agent-core product-api 是否存活：`GET /health` 看 `admission.state`；检查 `WORKFLOW_ADMISSION_CORE_BASE_URL` 指向 |
| `admission_configuration` | 503 | admission 目录配置错误（**全局性**） | 核对 svc 侧两个 BASE_URL env 与 agent-core 侧 `AGENT_DIRECTORY_AUTH_JWKS_URL`；配置修复需重启对应 runtime（走部署授权，勿热改） |
| `admission_malformed_response` | 503 | 目录返回畸形响应（**全局性**） | 抓 agent-core 侧日志/evidence；多半是版本错配——对齐两侧部署代次 |
| `admission_commit_outcome_unknown` | 503 | commit 阶段结果不确定，服务端已 fail-closed | **不是盲目重试信号**：先核对实例/版本实际状态，再决定是否安全重试（§4 规约同样适用但必须先读状态） |

## §3 agent-core 目录读侧码（同一链路的上游断点）

路由 wire 契约冻结于 AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1（CTR-IAD-002/003），本 runbook
不改码、只映射：

| code | HTTP | 含义 | 操作员动作 |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | 验证失败（含 JWKS 不可达/未配置） | **10-17 事故形态**。看 `/health` 的 `admission.state`：`auth_unavailable` = JWKS 拉不到（auth-service 挂/URL 错）；缺 env 的进程现在根本起不来（enabled 组合拒绝组合），若进程在跑则 env 存在但目录不可达 |
| `ACCESS_DENIED` | 403 | caller 缺 `agent.directory.read` scope（token 有效） | 单 caller 授权问题：补目录读 grant，非故障 |
| `INVALID_AGENT_ID` | 400 | 路径 ID 非法 | caller bug，非故障 |
| `AGENT_DEFINITION_TIMEOUT` | 504 | 目录读超 1s 截止 | 重试一次；连续出现→agent-core 进程过载排查 |
| `AGENT_DEFINITION_AMBIGUOUS` | 409 | 定义快照重复/损坏 | agent 定义文件修复（数据面），修后自恢复 |
| `AGENT_DEFINITION_QUERY_FAILED` | 500 | 定义读存储错误 | agent-core 日志排查 |

### P1 健康位（观测面，非探针）

`GET /health`（product-api，存活语义不变）新增 additive 字段：

```json
{ "ok": true, "service": "agent-core-product-api",
  "admission": { "configured": true, "state": "unproven|ready|auth_unavailable" } }
```

- `unproven`：进程启动后尚无一次成功验证（冷启动正常，不告警）。
- `ready`：至少一次 JWT 验证成功，可能使用已接受的有界 JWKS 缓存；不证明当前 JWKS 可达、caller scope、目标 enabled 或业务全链路健康。
- `auth_unavailable`：请求期间观察到 JWKS 拉取失败/不可用，相关请求 fail-closed。后续成功验证恢复 `ready`；普通无效 token 不改变状态。
  此字段没有主动探测能力；≤5 分钟巡检与提前告警属于尚未交付的 P2，不能由本健康位推断。
- 状态迁移时 runtime log 输出一行 warn（进入 `auth_unavailable` 一次、恢复 `ready` 一次），
  不随请求刷屏；行内无 token/principal 素材。

## §4 Agent/舰队运维规约（P5，写入 workspace AGENTS 模板前的冻结文案）

1. **重试=新信息**：admission/发布失败后，操作者或 owner 的任何明确指示都是新信息，先按原参数
   重试**一次**再停手求助；不得静默放弃，也不得无限重试。
2. **publish/transition 失败状态安全**：422 形态（`admission_rejected`/`admission_denied`/
   `admission_timeout`）是事务前拒绝，实例/版本原样（svc 侧 fail-closed zero-delta 已验收），
   重试**不需要**新建版本或新实例。
3. **503 区别对待**：`admission_commit_outcome_unknown` 永远先读实例实际状态再动；其余 503 按全局
   基础设施处理（上报，不要逐 agent 试）。
4. **求助汇报格式**：必须带 `request_id`（broker 信封 `requestId`，透传自下游 `x-request-id`，
   AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 R2）+ 重试一次的结果（code + status）。
   没有 request_id 的求助无法对账，视同未完成汇报。

## §5 明确不做（本 runbook 边界）

- 不新增 daemon/定时探针/watchdog（P2 deferred，与 #523/#527 合并评审）。
- 不改任何生产 env/plist、不重启、不部署；§2/§3 的修复动作落地均需独立生产授权。
- 不把 `UNAUTHORIZED` 细分身份原因外泄到 wire（脱敏契约冻结于 CTR-IAD-002）。
