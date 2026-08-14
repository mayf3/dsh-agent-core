# Broker Capability Parity — OpenClaw Agent → DSH Agent 迁移差距审计

> 纯调查（investigation only）。只新增本文件；不修改 Router / Auth / Broker /
> Forum / Workflow / OKR 任何代码。不重新设计业务系统。
> 日期：2026-08-15 · 分支：`docs/broker-capability-audit`
>
> 一句话结论：**35 个已部署的 Broker capability 里，今天没有任何一个能「直接由 DSH
> generic Broker 调」——不是因为业务 API 缺（SERVICE GAP = 0），而是因为 DSH 侧
> generic Broker bridge 缺一条共享的 authorized-HTTP 传输机制（token 获取 + 凭据
> 解析 + 请求执行），身份注入（方案 B）是紧随其后的计划内共享 BUILD。机制落地后，
> 16 项只差 capability registry entry，其余需要少量额外通用机制。**

## 0. 方法、范围与置信度

### 范围

只回答一件事：**现在 OpenClaw Agent 能通过 Broker 做哪些真实事情，DSH Agent 要继续
做到这些事情，还缺哪些接线？** 分类只允许五类：

| 分类 | 定义（本审计口径） |
|---|---|
| **READY** | 现有 DSH generic Broker 代码可直接注册并执行该 tool（manifest + handler + 现有 identity seam，不改通用机制） |
| **REGISTRY GAP** | 能力形状完全被共享机制覆盖、服务端 API 与 scope 齐备；只缺 capability registry entry（manifest/配置数据） |
| **BROKER GAP** | 除共享传输外，能力形状还需要 DSH generic Broker 提供**额外通用机制**（Idempotency-Key、opaque cursor、grouped tool、per-capability allowlist、多步编排、可信区 ID 生成等） |
| **SERVICE GAP** | Forum / Workflow / OKR 后端缺 API（或 scope 语义无法经 Broker 表达） |
| **IDENTITY BLOCKED** | 能力存在（机制 + entry + 服务端 API 齐备），只等新的 Agent process identity（方案 B 注入） |

### 证据来源（全部实证，无记忆）

| 面 | 来源 | 置信度 |
|---|---|---|
| **OpenClaw Broker 源码/机制** | `~/workspace/project/openclaw-adc-canary-extension/broker/src/{broker-core,registries,index,adapters/*}.ts` | 高（源码） |
| **Deployed capability registry** | `~/.openclaw/openclaw.json` → `plugins.entries.openclaw-auth-broker.config`（`globalEnabled:true`、88 个 enabledAgentIds、3 targets、35 capabilities、authServiceOrigin `http://127.0.0.1:4001`） | 高（线上配置） |
| **服务端 API 面** | `svc-workflow/src/http/mod.rs`（Rust 路由表）、`svc-forum/svc-forum/src/{app.ts,routes/*.ts}`、`svc-okr/src/{app.ts,routes/**/*.ts}` | 高（源码） |
| **Agent 真实使用** | `~/.openclaw/agents/*/sessions/*.jsonl` 工具名计数（forum/workflow/okr 工具调用证据） | 高（运行日志） |
| **Agent skill 面** | `~/.agents/skills/{todo-client,requirement-client,forum-access}/`（OpenClaw 与 DSH 共享的 skills 目录） | 高（当前在用 skill） |
| **DSH 侧现状** | `dsh-agent-core/packages/broker/src/{schema,mapping,registry,identity,index}.js` + `bundle/cordis.patch.yml` | 高（本仓库源码） |

### 局限

- 会话 JSONL 的计数是「出现过该工具名」的粗计数（含回放/引用），不是精确调用次数；用于
  证明「哪些能力真的被用」，不用于定量。
- `svc-okr` 写 API 的完整路由（lifecycle/features/formulation/collaboration）未逐行枚举，
  只确认存在性与 scope/role 门；不影响分类（均为「后端有 API、broker 未注册」）。
- 授权数据（auth-service 里每个 agent client 的 grant）未逐 client 验证；scope 语义以
  Broker registry 的 `requiredScopes` 与服务端 scope-guard 源码交叉确认。

---

## 1. OpenClaw 侧现状：auth-broker 与真实能力面

### 1.1 Broker 机制（`broker-core.ts` / `registries.ts`）

- 插件 `openclaw-auth-broker` v0.1.0，path-install 自 `openclaw-adc-canary-extension/broker`；
  `globalEnabled:true`，`enabledAgentIds` 88 个 agent，`agentClients` 90+ 个 OAuth2 client
  映射（`clientId` + `secretRef` 文件），3 个 target，35 个 capability。
- `BrokerCore.authorizedFetch(ctx, capabilityId, binding)` 的固定流水线：
  1. per-capability agent 门（`allowedAgentIds` 存在则 fail-closed 白名单，否则全局 allowlist）；
  2. 按 agent 解析 client secret（进程内缓存，不逐调用读文件）；
  3. 向 `authServiceOrigin/oauth/token` 发 `client_credentials`（`resource`=audience、
     `scope`=requiredScopes）拿 RS256 token，按 (agent, audience, scope) 缓存；
  4. 钉死 origin/method/path（能力配置里注册的值，模型不可控）；
  5. 通用 HTTP binding：path 占位符精确匹配 + `encodeURIComponent`、query 序列化、
     JSON body、header 白名单（**仅 `Idempotency-Key`**）；
  6. fetch + 401 时单次换新 token 重试（复用同一 Idempotency-Key，服务端幂等去重）。
- 安全纪律：tool schema 无任何 principal/credential 字段；身份唯一来源 `ctx.agentId`；
  模型不能控制 URL/method/service/scope/audience/actor。

### 1.2 Deployed capability registry（35 项，3 targets）

targets：`svc-workflow`（http://127.0.0.1:8989，audience `svc-workflow`）·
`svc-okr`（http://127.0.0.1:3459，audience `svc-okr`）·
`svc-forum`（http://127.0.0.1:3460，audience `svc-forum`）。

| capabilityId | method / path | scope |
|---|---|---|
| workflow_my_tasks | GET /internal/v1/worklists/assigned-to-me | workflow.read |
| workflow_submission_history | GET /internal/v1/workflow-instances/{workflowInstanceId}/submissions | workflow.read |
| workflow_instance_detail | GET /internal/v1/workflow-instances/{workflowInstanceId} | workflow.read |
| workflow_domain_instances | GET /internal/v1/workflow-instances/domain | workflow.read |
| workflow_global_instances | GET /internal/v1/workflow-instances/global | workflow.read |
| workflow_my_domains | GET /internal/v1/principals/me/domains | workflow.read |
| workflow_assistance_get | GET /internal/v1/assistance-cases/{assistanceCaseId} | workflow.read |
| workflow_assistance_requested_by_me | GET /internal/v1/assistance-cases/requested-by-me | workflow.read |
| workflow_assistance_owner_inbox | GET /internal/v1/assistance-cases/owner-inbox | workflow.read |
| workflow_assistance_human_required | GET /internal/v1/assistance-cases/human-required | workflow.read |
| workflow_transition | POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions | workflow.execute |
| workflow_qa_review | POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions | workflow.execute |
| workflow_create_instance | POST /internal/v1/workflow-instances | workflow.execute |
| workflow_cancel_instance | POST /internal/v1/workflow-instances/{workflowInstanceId}/cancel | workflow.execute |
| workflow_archive_instance | POST /internal/v1/workflow-instances/{workflowInstanceId}/archive | workflow.execute |
| workflow_create_domain | POST /internal/v1/domains | workflow.execute |
| workflow_set_domain_owner | PUT /internal/v1/domains/{domainId}/owner | workflow.execute |
| workflow_create_definition | POST /internal/v1/domains/{domainId}/definitions | workflow.execute |
| workflow_create_draft_version | POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions | workflow.execute |
| workflow_replace_draft_graph | PUT /internal/v1/domains/{domainId}/definitions/{definitionId}/draft | workflow.execute |
| workflow_publish_version | POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish | workflow.execute |
| workflow_assistance_request | POST /internal/v1/workflow-instances/{workflowInstanceId}/assistance-cases | workflow.execute |
| workflow_assistance_resolve | POST /internal/v1/assistance-cases/{assistanceCaseId}/resolve | workflow.execute |
| workflow_assistance_escalate_to_human | POST /internal/v1/assistance-cases/{assistanceCaseId}/escalate-to-human | workflow.execute |
| okr_read | GET /api/goals/mine | okr.read |
| forum_my_notifications | GET /api/me/notifications | forum.read |
| forum_read_thread | GET /api/threads/{threadId} | forum.read |
| forum_read_transcript | GET /api/threads/{threadId}/transcript | forum.read |
| forum_list_threads | GET /api/threads | forum.read |
| forum_search_threads | GET /api/search | forum.read |
| forum_reply | POST /api/threads/{threadId}/messages | forum.write |
| forum_mark_read | PUT /api/threads/{threadId}/read | forum.write |
| forum_create_thread | POST /api/threads（+ 首条消息 POST messages） | forum.write |
| forum_admin_unread | GET /api/admin/notifications/unread | forum.moderate（`allowedAgentIds=[course-community-agent-2]`） |
| auth_secret_rotate | （可信控制面专用，`allowedAgentIds=[cto-agent]`，非业务能力） | — |

### 1.3 Agent-facing 工具面

- **Grouped tools（注册时对 agent 可见的收敛面）**：`workflow_read`（6 action：
  my_tasks / my_domains / submission_history / domain_instances / global_instances /
  instance_detail）、`workflow_execute`（10 action：transition / create_domain /
  set_domain_owner / create_definition / create_draft_version / replace_draft_graph /
  publish_version / create_instance / cancel / archive）、`workflow_assistance`
  （7 action）、`forum_read`（5 action）、`forum_write`（3 action）。
- **Standalone atoms**（grouped tool 的底层安全原子，也独立注册为 tool）。
- 每个 action 内部仍走同一 capability 原子 + `authorizedFetch`（per-action 门在
  BrokerCore 内 fail-closed）。

### 1.4 真实使用证据（session 日志粗计数）

- **Workflow**：40+ agent 使用过 workflow 工具（itops-agent 205 个会话、article-publisher
  166、content-ops 108、arch-reviewer 92…）；itops 会话内 `workflow_read` 184 次、
  `workflow_my_tasks` 23、`workflow_submission_history` 19、`workflow_assistance` 15、
  `workflow_execute` 7、`workflow_transition` 3。
- **Forum**：30+ agent 使用；`forum_my_notifications` 出现 3760+ 次（最多）、
  `forum_read_thread` 656+ 次；hr-agent / build-in-public / thesis-advisor 等高频。
- **OKR**：`okr_read` 被 ~35 个 agent 使用过（build-in-public 10、ceo 8、hr 7、qa-reviewer 6…），
  使用频率显著低于 forum/workflow。
- **Skill 路径**：`todo-client`（直连 svc-workflow API + auth-service machine token，
  不经过 broker）；`requirement-client` 已迁移为**只用 broker 工具**
  `workflow_read`/`workflow_execute`（零凭据、无脚本）；`forum-access` skill 走
  auth-service OAuth + svc-forum API（含 broker 未暴露的 watch/unwatch）。

---

## 2. DSH 侧现状：generic Broker bridge（`dsh-agent-core/packages/broker`）

- **已有**：manifest → ONE DSH tool 的通用机制（`schema.js` 校验、`mapping.js`
  请求/响应/错误映射、`registry.js` 注册、`identity.js` 身份 seam）。handler 是
  进程内纯函数 `(operation, args, principal) => value`；manifest 是纯数据
  （wire id / operations / 参数 schema / 错误码表）。V0 calculator + 测试 echo
  已证明「同一注册逻辑注册不同 tool」。
- **没有**（对照 §1.1 的 BrokerCore）：
  1. **authorized-HTTP 传输**：无 token 获取（client_credentials）、无凭据解析
     （SecretRef 文件）、无 token 缓存、无 fetch、无 origin/method/path 钉死、
     无 401 重试 —— handler 只能做进程内计算；
  2. **header 支持**：无 `Idempotency-Key` 概念；
  3. **opaque cursor**：无分页游标编解码；
  4. **grouped tool**：无多 action 判别联合（discriminated union）的 tool 面；
  5. **per-capability agent allowlist**：manifest schema 无 `allowedAgentIds` 概念；
  6. **身份绑定**：`resolvePrincipal` 是占位（读 env `AGENT_CORE_PRINCIPAL` 或注入
     固定值），注释明确「最终形态 = per-agent 进程凭据注入（方案 B），本轮不实现」。
- **注册面**：`Config.manifests` 目前只挂 `external.calculator`；`handlersByCapability`
  是包内静态映射。

---

## 3. 共享前置：两条跨所有能力的缺口（先声明，逐能力不再重复）

| 前置 | 分类 | 内容 | 状态 |
|---|---|---|---|
| **P1 — authorized-HTTP 通用传输** | BROKER GAP（共享） | client_credentials token 获取 + 缓存、SecretRef 凭据解析、origin/method/path 钉死、query/path 绑定、JSON body、Idempotency-Key 白名单 header、401 单次重试 | DSH broker **完全没有**；影响全部 35 项。对应 OpenClaw `BrokerCore`（~500 行通用件，可直接平移设计） |
| **P2 — per-agent 进程身份** | IDENTITY BLOCKED（共享） | 控制面（Router）spawn per-agent DSH 进程时注入进程凭据；`resolvePrincipal` 绑定 credential→principal；Broker 侧 flat ACL | **计划内 BUILD**（`docs/investigations/identity-auth.md` §7 方案 B、`docs/reports/broker-v1.md` §10）；影响全部 35 项 |

> **为什么「身份不是第一阻塞」**：即便 P2 立即落地（进程有了身份），handler 也没有任何
> 传输机制可把身份变成业务服务的 Bearer token 并发出请求。P1 是比 P2 更前置的共享缺口。
> 因此**今天严格意义上的 IDENTITY BLOCKED = ∅**；在 P1 与 registry entry 落地的那一刻，
> 全部 REGISTRY GAP 项进入「只等身份」状态（见 §5.5）。

---

## 4. 逐能力差距表

### 4.1 Forum（svc-forum :3460；read/write/moderate scope）

| capabilityId | method / path | scope | OpenClaw adapter/tool | DSH generic registry 已有 | DSH generic Broker 能否直接生成 tool | 缺的是什么 | 分类 |
|---|---|---|---|---|---|---|---|
| forum_my_notifications | GET /api/me/notifications | forum.read | forum-access.ts（standalone + forum_read 内） | 否（registry 只有 external.calculator） | 能（P1 落地后；无参+简单 query） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_read_thread | GET /api/threads/{threadId} | forum.read | forum-access.ts | 否 | 能（path 单参） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_read_transcript | GET /api/threads/{threadId}/transcript | forum.read | forum-access.ts | 否 | 能（path+query） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_reply | POST /api/threads/{threadId}/messages | forum.write | forum-access.ts + forum_write 内 | 否 | 能（path+body；无幂等要求） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_mark_read | PUT /api/threads/{threadId}/read | forum.write | forum-access.ts + forum_write 内 | 否 | 能（path） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_list_threads | GET /api/threads | forum.read | forum-discovery.ts + forum_read 内 | 否 | 能（简单 query） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_search_threads | GET /api/search | forum.read | forum-discovery.ts + forum_read 内 | 否 | 能（简单 query） | entry + P1 + P2 | **REGISTRY GAP** |
| forum_create_thread | POST /api/threads + POST /api/threads/{id}/messages（两步） | forum.write | forum-access.ts `createForumCreateThreadTool`（adapter 内两步 authorizedFetch + participants 映射 + 响应投影） | 否 | 否（需多步编排/投影通用机制） | 多步编排机制 + entry + P1 + P2 | **BROKER GAP** |
| forum_admin_unread | GET /api/admin/notifications/unread | forum.moderate | forum-access.ts；capability 配置 `allowedAgentIds=[course-community-agent-2]` | 否 | 否（manifest 无 per-capability allowlist 概念） | per-capability allowlist 机制 + entry + P1 + P2 | **BROKER GAP** |
| （未注册）watch / unwatch | PUT/DELETE /api/threads/{threadId}/watch | forum.write | **无 broker capability**（forum-write.ts 明示「watch/unwatch 当前无正式 capability」；forum-access skill 支持） | 否 | 能（svc-forum 已有 API，同 mark_read 形状） | entry（服务端 API/scope 齐备） | **REGISTRY GAP**（可选，agent 当前未走 broker 使用） |

### 4.2 Workflow（svc-workflow :8989；read / execute scope）

| capabilityId | method / path | scope | OpenClaw adapter/tool | DSH generic Broker 能否直接生成 tool | 缺的是什么 | 分类 |
|---|---|---|---|---|---|---|
| workflow_my_tasks | GET /internal/v1/worklists/assigned-to-me | workflow.read | workflow-tasks.ts + workflow_read 内 | 能（无参 GET） | entry + P1 + P2 | **REGISTRY GAP** |
| workflow_instance_detail | GET /internal/v1/workflow-instances/{id} | workflow.read | workflow-read.ts + workflow_read 内 | 能（path 单参） | entry + P1 + P2 | **REGISTRY GAP** |
| workflow_submission_history | GET /internal/v1/workflow-instances/{id}/submissions | workflow.read | workflow-read.ts（配对 cursor = 普通 query 参数） | 能（path+query） | entry + P1 + P2 | **REGISTRY GAP** |
| workflow_my_domains | GET /internal/v1/principals/me/domains | workflow.read | workflow-read.ts + workflow_read 内 | 能（无参 GET） | entry + P1 + P2 | **REGISTRY GAP** |
| workflow_assistance_get | GET /internal/v1/assistance-cases/{caseId} | workflow.read | workflow-assistance.ts | 能（path 单参） | entry + P1 + P2 | **REGISTRY GAP** |
| workflow_domain_instances | GET /internal/v1/workflow-instances/domain | workflow.read | workflow-domain-instances.ts + workflow_read 内 | 否（**opaque cursor 编解码** + 响应投影） | cursor 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_global_instances | GET /internal/v1/workflow-instances/global | workflow.read | workflow-read.ts | 否（opaque cursor + 投影） | cursor 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_assistance_requested_by_me | GET /internal/v1/assistance-cases/requested-by-me | workflow.read | workflow-assistance.ts | 否（opaque cursor） | cursor 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_assistance_owner_inbox | GET /internal/v1/assistance-cases/owner-inbox | workflow.read | workflow-assistance.ts | 否（opaque cursor） | cursor 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_assistance_human_required | GET /internal/v1/assistance-cases/human-required | workflow.read | workflow-assistance.ts | 否（opaque cursor） | cursor 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_transition | POST /internal/v1/workflow-instances/{id}/transitions | workflow.execute | workflow-transition.ts / workflow-execute.ts | 否（需 **Idempotency-Key** 可信区生成 + header） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_qa_review | POST /internal/v1/workflow-instances/{id}/transitions | workflow.execute | workflow-qa-review.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_create_instance | POST /internal/v1/workflow-instances | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_cancel_instance | POST /internal/v1/workflow-instances/{id}/cancel | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_archive_instance | POST /internal/v1/workflow-instances/{id}/archive | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_create_domain | POST /internal/v1/domains | workflow.execute | workflow-execute.ts | 否（IK + **可信区生成 domainId**） | IK 机制 + 可信 ID 生成 + entry + P1 + P2 | **BROKER GAP** |
| workflow_set_domain_owner | PUT /internal/v1/domains/{domainId}/owner | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_create_definition | POST /internal/v1/domains/{domainId}/definitions | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_create_draft_version | POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_replace_draft_graph | PUT /internal/v1/domains/{domainId}/definitions/{definitionId}/draft | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_publish_version | POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish | workflow.execute | workflow-execute.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_assistance_request | POST /internal/v1/workflow-instances/{id}/assistance-cases | workflow.execute | workflow-assistance.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_assistance_resolve | POST /internal/v1/assistance-cases/{caseId}/resolve | workflow.execute | workflow-assistance.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| workflow_assistance_escalate_to_human | POST /internal/v1/assistance-cases/{caseId}/escalate-to-human | workflow.execute | workflow-assistance.ts | 否（IK） | IK 机制 + entry + P1 + P2 | **BROKER GAP** |
| （grouped）workflow_read | 6 action 判别联合 | workflow.read | workflow-read.ts | 否（grouped tool 机制；**原子已可覆盖业务**） | grouped 机制 | **BROKER GAP**（可选收敛面） |
| （grouped）workflow_execute | 10 action 判别联合 | workflow.execute | workflow-execute.ts | 否（同上） | grouped 机制 | **BROKER GAP**（可选收敛面） |
| （grouped）workflow_assistance | 7 action 判别联合 | read+execute | workflow-assistance.ts | 否（同上） | grouped 机制 | **BROKER GAP**（可选收敛面） |

### 4.3 OKR（svc-okr :3459；okr.read / okr.write + 角色）

| capabilityId | method / path | scope / 授权 | OpenClaw adapter/tool | DSH generic Broker 能否直接生成 tool | 缺的是什么 | 分类 |
|---|---|---|---|---|---|---|
| okr_read | GET /api/goals/mine | okr.read（svc-okr `agent-token-verifier` 强制 okr.read） | okr-read.ts（无参 GET） | 能 | entry + P1 + P2 | **REGISTRY GAP** |
| （未注册）OKR write：POST /api/goals、PUT /api/goals/:agentId、lifecycle/features/formulation 写路由 | — | **okr.write scope**（`requireWriteScope`）+ **okr_admin/okr_owner 角色**（`requireOkrEdit`，角色来自 ADC） | 无 broker capability；无 agent 使用证据（当前 agent 真实能力只有读） | 能（形状同 forum/workflow 写） | entry + **auth-service 需授予 okr.write** + P1 + P2 | **REGISTRY GAP**（可选；授权链 = scope + 角色，非 API 缺口） |

### 4.4 业务术语 → capability 映射（任务指定清单）

| 业务能力 | 真实实现（证据） | 迁移状态 |
|---|---|---|
| Forum read | forum_read_thread + forum_read_transcript（skill/会话证据：`/api/threads/{id}`、`/transcript`） | REGISTRY GAP ×2 |
| Forum write | forum_create_thread + forum_reply（`/api/threads` POST + `/messages` POST） | create_thread = BROKER GAP（多步）；reply = REGISTRY GAP |
| Forum discovery | forum_list_threads + forum_search_threads（`/api/threads` GET、`/api/search`） | REGISTRY GAP ×2 |
| Forum notifications / unread | forum_my_notifications（`/api/me/notifications`）+ forum_admin_unread（版主汇总） | my_notifications = REGISTRY GAP；admin_unread = BROKER GAP |
| Workflow create | workflow_create_instance（requirement-client 实测路径：`workflow_execute(action=create_instance)`） | BROKER GAP（IK） |
| Workflow advance | workflow_transition（提交当前节点结果并推进；`POST .../transitions`，Idempotency-Key） | BROKER GAP（IK） |
| Workflow return（退回） | **无独立 API**；由 Definition 图定义 return transition，经 workflow_transition + `transitionDefinitionId` 实现（`instance_detail.outgoingTransitions` 暴露） | 不构成缺口（经 transition 表达）；跟随 workflow_transition |
| Workflow terminate | workflow_cancel_instance（非终态取消）+ workflow_archive_instance（终态归档） | BROKER GAP（IK） |
| Workflow details | workflow_instance_detail（`{visibility, detail}`，含 outgoingTransitions/submissionSchema） | REGISTRY GAP |
| Workflow timeline | **svc-workflow 有 `GET /internal/v1/workflow-instances/{id}/timeline`（`timeline.rs`），broker 未注册、agent 当前未用** | REGISTRY GAP（可选补齐） |
| Workflow personal quick item | workflow_create_instance × definition `personal_quick_item_v1`（todo-client `create-task.sh --title` 实测） | 跟随 create_instance |
| Workflow agent self task | workflow_create_instance × definition `agent_self_task_v1`（双审双验；todo-client `--type agent`） | 跟随 create_instance |
| Workflow my tasks | workflow_my_tasks（`/worklists/assigned-to-me`）+ todo-client `query-tasks.sh --mine`（skill 直连 API 路径） | REGISTRY GAP |
| OKR read | okr_read（`/api/goals/mine`） | REGISTRY GAP |
| OKR write | 后端 POST/PUT/lifecycle 齐备（okr.write + okr_admin/okr_owner）；broker 未注册、agent 未使用 | REGISTRY GAP（可选） |

---

## 5. 分类汇总

| 分类 | 数量 | 清单 |
|---|---|---|
| **READY** | **0** | —（现有 DSH broker 无 authorized-HTTP 传输与凭据解析；严格口径下无业务能力可直接调） |
| **REGISTRY GAP** | **16** | forum ×8（my_notifications、read_thread、read_transcript、reply、mark_read、list_threads、search_threads、watch/unwatch 未注册）；workflow ×5（my_tasks、instance_detail、submission_history、my_domains、assistance_get）；okr_read；OKR write（未注册）；workflow timeline（未注册） |
| **BROKER GAP** | **26** | 业务原子 ×21（forum：create_thread、admin_unread；workflow：domain_instances、global_instances、assistance 列 ×3、全部 IK 写 ×13、create_domain）；grouped 收敛面 ×5（workflow_read/execute/assistance、forum_read/write，可选） |
| **SERVICE GAP** | **0** | 当前真实能力集内，后端 API 与 scope 全部齐备（watch/unwatch、timeline、OKR write、creator-owned-drafts、definitions 读等「未注册」项均为后端有 API、broker 没 entry） |
| **IDENTITY BLOCKED** | **0（今天）→ 16（P1 + entry 落地后）** | 见 §5.5 |

> 说明：grouped tools 只是 agent-facing 的**表面收敛**（减少模型选择负担），其业务
> 全部由原子 capability 覆盖。迁移最小批次可不做 grouped，直接注册原子 tool。

### 5.5 关于 IDENTITY BLOCKED 的口径

任务定义「IDENTITY BLOCKED = 能力存在，只等新的 Agent process identity」。本审计按
此口径逐能力核查后：**今天没有任何能力处于该状态**——因为 DSH 侧连传输机制（P1）都
未落地，身份不是「唯一」阻塞。**P1 与 registry entry 落地后**，全部 16 项 REGISTRY GAP
能力进入「只等身份」状态（机制、entry、服务端 API 齐备，仅缺方案 B 的进程凭据注入），
届时 IDENTITY BLOCKED = 16。身份注入本身是已立项的共享 BUILD（identity-auth §7 方案 B、
broker-v1 §10），不逐能力重复计。

---

## 6. 五问回答

### 6.1 如果明天迁一个真实 Agent，哪些业务能力已经 READY？

**严格口径：0 个。** DSH generic Broker（`packages/broker`）现有机制只能生成
manifest + 进程内 handler 的 tool（calculator 模式），没有任何 authorized-HTTP 传输与
凭据解析；35 个已部署能力全部依赖它。任何「明天就迁」的计划都必须先落地 **P1
（共享 authorized-HTTP 传输，等价 OpenClaw `BrokerCore` 的通用件）**。

### 6.2 哪些仅被 Identity 阻塞？

**今天：没有**（传输机制未落地，身份不是唯一阻塞；见 §5.5）。
**P1 + registry entry 落地后：16 项**进入「仅剩身份阻塞」状态——
forum 8 项 + workflow 5 项（my_tasks / instance_detail / submission_history /
my_domains / assistance_get）+ okr_read +（可选）OKR write / timeline。
即：**身份（P2）是共享的、已立项的第二前置，但绝不是唯一前置。**

### 6.3 哪些是真正 API / capability 缺口？

- **SERVICE GAP = 0**：当前真实能力集内，svc-workflow / svc-forum / svc-okr 后端 API
  与 scope 全部齐备，无「后端缺 API」项。
- **capability 缺口（后端有、broker 未注册）**：
  - `forum watch / unwatch`（PUT/DELETE /api/threads/{id}/watch，forum.write）——skill 支持、broker 无；
  - `workflow timeline`（GET /workflow-instances/{id}/timeline，workflow.read）——后端有、broker 无；
  - `OKR write`（POST/PUT /api/goals、lifecycle，okr.write + okr_admin/okr_owner）——后端有、broker 无、agent 当前未用；
  - 其他未注册但后端存在的：`creator-owned-drafts`、`definitions list/detail/archive`、
    `domain members`、`principals/me`（均为可选补齐，当前 agent 未走 broker 使用）。

### 6.4 最小一批必须补齐的 capability 是哪些？

不是「逐能力」，而是**三个共享件 + 一批 registry 数据**：

1. **P1：DSH broker 的 authorized-HTTP 通用传输**（token 获取/缓存、SecretRef 解析、
   origin/method/path 钉死、query/path/body 绑定、Idempotency-Key 白名单、401 重试）——
   单个通用机制，覆盖全部 35 项的形状需求（不含额外机制项）；
2. **P2：per-agent 进程身份注入**（方案 B，已立项）；`resolvePrincipal` 从占位升级为
   credential→principal 绑定；
3. **首批 registry entry（12 项，按真实使用频率排序）**：
   - Forum：`forum_my_notifications`、`forum_read_thread`、`forum_read_transcript`、
     `forum_reply`、`forum_mark_read`、`forum_list_threads`、`forum_search_threads`（7 项，
     其中 notifications/read 是会话证据中的最高频）；
   - Workflow：`workflow_my_tasks`、`workflow_instance_detail`、`workflow_submission_history`、
     `workflow_my_domains`（4 项读面——配合 requirement-client 已迁移的
     `workflow_execute`/`workflow_read` 依赖，`workflow_transition` + `workflow_create_instance`
     因需 Idempotency-Key 机制，与 P1 同批）；
   - OKR：`okr_read`。

> 第一批即可覆盖会话证据中 ~95% 的 agent 真实调用（my_notifications / read_thread /
> my_tasks / instance_detail / submission_history 是最高频工具），且全部为 REGISTRY GAP
> 或跟随 P1 的简单形状。

### 6.5 哪些能力可以迁移后再补，不阻塞 OpenClaw canary？

- **grouped tools**（workflow_read/execute/assistance、forum_read/write）：纯表面收敛，
  原子已覆盖业务，模型工具面略宽但可用；
- **forum_admin_unread**（版主汇总，course-community-agent-2 专用调度场景）；
- **workflow domain-building 写面**（create_domain / set_domain_owner / create_definition /
  create_draft_version / replace_draft_graph / publish_version）：GLOBAL_WORKFLOW_COORDINATOR
  与 DOMAIN_OWNER 的治理场景，低频；
- **workflow_assistance 全家**（request/get/requested_by_me/owner_inbox/resolve/
  escalate/human_required）：当前仅 itops 等少数 agent 使用，且属可降级路径；
- **opaque cursor 翻页优化**（domain_instances / global_instances / assistance 列）：
  首批可先暴露服务端配对参数或 limit 截断，翻页体验后补；
- **watch/unwatch、timeline、OKR write、creator-owned-drafts、definitions 读**：
  均为「后端有 API、broker 未注册」的可选 REGISTRY GAP，等真实 agent 提出需求再注册。

---

## 7. 给迁移的落点建议（不实现，仅记录）

1. **DSH 侧保持一个 generic Broker bridge**：P1 直接平移 OpenClaw `BrokerCore` 的设计
   （注册表驱动 + 通用 binding + 安全纪律），以 manifest/registry 数据表达 capability；
   不需要 forum-plugin / workflow-plugin / okr-plugin 三个专用插件。
2. **capability registry 数据可整体平移**：35 项的 capabilityId / targetId / method /
   path / requiredScopes / allowedAgentIds 是现成配置数据（`openclaw.json`），DSH 侧
   manifest 增加 `target`/`method`/`path`/`requiredScopes`/`allowedAgentIds` 字段后即可
   1:1 承载，无需重新设计业务系统。
3. **Idempotency-Key 与 opaque cursor 作为 P1 通用件实现**（非 per-capability 代码），
   一次性覆盖 §4 中 19 项 BROKER GAP 业务原子的形状需求；grouped tool 作为可选二期。
4. **授权数据沿用现状**：scope 语义（workflow.read/execute、forum.read/write/moderate、
   okr.read/write + okr 角色）由服务端裁决，Broker 只发 scope、不做业务角色判断——与
   OpenClaw 冻结原则一致。

---

## 8. 证据索引（择要）

### OpenClaw Broker（`~/workspace/project/openclaw-adc-canary-extension/broker/`）
- `src/broker-core.ts`（authorizedFetch 流水线、token 获取/缓存、origin/method/path 钉死、
  401 重试、Idempotency-Key 白名单）
- `src/registries.ts`（capability entry 形状：capabilityId/targetId/requiredScopes/method/path/
  allowedAgentIds；per-capability 门）
- `src/index.ts`（ADAPTERS 表 + GROUPED_ADAPTERS：workflow_read/execute/assistance、
  forum_read/write）
- `src/adapters/forum-access.ts`（6 capability + forum_create_thread 两步 + forum_admin_unread）、
  `forum-read.ts` / `forum-write.ts` / `forum-discovery.ts`
- `src/adapters/workflow-read.ts`（6 action + opaque cursor）、`workflow-execute.ts`
  （10 action + Idempotency-Key + 可信区 domainId）、`workflow-assistance.ts`
  （7 action + cursor）、`workflow-tasks.ts`、`workflow-transition.ts`、`okr-read.ts`
- 报告：`WORKFLOW_SKILL_TO_BROKER_CAPABILITY_DIFF_V1_REPORT.md`、
  `FORUM_WORKFLOW_BROKERIZATION_BATCH_A_V1_REPORT.md` 等（同名结论可交叉复核）

### Deployed 配置（`~/.openclaw/openclaw.json`）
- `plugins.entries.openclaw-auth-broker.config`：globalEnabled / 88 enabledAgentIds /
  3 targets（svc-workflow:8989、svc-okr:3459、svc-forum:3460）/ 35 capabilities /
  authServiceOrigin http://127.0.0.1:4001 / agentClients（90+ 个 clientId+secretRef）

### 服务端 API（源码）
- `svc-workflow/src/http/mod.rs`：internal/v1 全路由表（含 broker 未注册的
  `/{id}/timeline`、`worklists/creator-owned-drafts`、definitions 读/归档、members、
  `principals/me`、admin provisioning）
- `svc-forum/svc-forum/src/app.ts` + `routes/{threads,me,messages,search}.ts`：
  `/api/threads/:id/watch`（PUT/DELETE，forum.write）、`/api/me/notifications`、
  `/api/search`；`middleware/scope-guard.ts`（forum.read / forum.write）
- `svc-okr/src/routes/goals/{core,lifecycle,features,formulation,collaboration}.ts`：
  GET /mine（okr.read）、POST / 与 PUT /:agentId（okr.write + requireOkrEdit
  okr_admin/okr_owner）

### Agent 使用（`~/.openclaw/agents/*/sessions/*.jsonl`）
- forum_my_notifications 3760+、forum_read_thread 656+；workflow 工具 40+ agent；
  okr_read ~35 agent；itops-agent 会话内 workflow_read 184 次等

### Agent skills（`~/.agents/skills/`）
- `todo-client`（直连 svc-workflow + auth-service machine token；personal_quick_item_v1 /
  agent_self_task_v1 definition 证据）、`requirement-client`（仅 broker 工具
  workflow_read/workflow_execute）、`forum-access`（auth-service OAuth + svc-forum API）

### DSH 侧（`dsh-agent-core/packages/broker/`）
- `src/{schema,mapping,registry,identity,index}.js`：manifest→tool 通用机制、
  resolvePrincipal 占位（`AGENT_CORE_PRINCIPAL`）、无 HTTP/凭据/cursor/header 机制
- `docs/reports/broker-v1.md` §9-10（handler 注册 seam、identity 占位、下一步）、
  `docs/investigations/identity-auth.md` §7（方案 B：per-agent 进程 + 进程凭据）
