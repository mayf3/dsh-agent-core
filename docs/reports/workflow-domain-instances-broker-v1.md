# Agent Core on DSH — Workflow Domain Instances Broker V1（域查 执行）

> TASK_NAME = 域查 执行 · TASK_TYPE = 调查+执行 · 目标仓库 mayf3/svc-workflow（本轮 **0 改动**）
> 实现仓库 mayf3/dsh-agent-core（broker 侧，WIP preservation snapshot，未获授权合并）。
> 本轮**未 deploy**、未 restart、未触碰任何 production 状态；PRODUCTION_CHANGE = NONE。

---

## 0. 结论（TL;DR）

- **调查结论**：任务要求的 Domain 范围只读查询能力，svc-workflow 服务端**已经存在并部署**——
  `GET /internal/v1/workflow-instances/domain`（`domain_list` handler，服务端
  `check_domain_owner` 属主强制）。缺口**纯在 broker 侧**：没有任何 manifest 把该端点
  暴露为模型可调用工具。因此 svc-workflow = 0 改动；本能力以 broker 侧
  `workflow_domain_instances` manifest 交付（即任务语言中的 `domain_instances(domain_id)`）。
- **交付形态**：WIP preservation snapshot 分支
  `impl/workflow-domain-instances-broker-v1-wip`（base = `ef2bcac`，即
  AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 的 WIP snapshot；本能力构建于其
  error-preservation 机制族之上）。broker 测试 **92/92 PASS**（74 基线 + 15
  error-preservation + 3 domain 新增）。
- **治理状态**：governing Spec
  `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`（proposed）保存于 docs-only 分支
  `docs/workflow-domain-instances-broker-v1-spec`。per 该 Spec §4 与 ef2bcac/efc815a
  先例：accept 该 Spec 是本实现**唯一**合并授权路径；本轮 MERGE = FORBIDDEN，
  IMPLEMENTATION_AUTHORITY = NONE，未 push、未开 PR、未 deploy。

## 1. 调查证据（svc-workflow，只读 line-verified）

本地 checkout `mayf3/svc-workflow` @ `6f1f546`（与 error-preservation Spec 钉定的
外部证据 revision `6f1f546787bd5fb1644ec91327d3e7374dc28165` 一致）：

| 引用 | 事实 |
|---|---|
| `src/http/mod.rs:114-117` | 路由 `/internal/v1/workflow-instances/domain` → `instances::domain_list` |
| `src/http/handlers/instances.rs:96-150` | `domain_list`：`require_scope("workflow.read")` + lifecycle/status 422 校验 + 查询委托 |
| `src/http/dto.rs:103-118` | `DomainInstanceQuery`：serde `rename_all="camelCase"` + `deny_unknown_fields`；wire 参数名 `domainId` |
| `src/application/workflow_instance/query_service.rs:74-98` | 服务端 `check_domain_owner`；非 owner → `WorkflowInstanceNotFoundOrNotVisible`（先 commit 快照再返回） |
| `src/http/error.rs:503-532` | `from_query`：`workflow_instance_not_found_or_not_visible`→404、`principal_not_found`→404、`principal_disabled`→403、`invalid_pagination`→422、`internal_consistency_error`→500、`service_unavailable`→503 |
| `src/store/postgres/workflow_instance_repository/query_domain_instances.rs:13-26` | 服务端 limit 1..100，默认 20 |

权限模型（服务端唯一权威，broker 不复制不放宽）：

- **DOMAIN_OWNER**：允许——服务端 `check_domain_owner` 通过即返回
  `Page<DomainInstanceSummary>`。
- **DOMAIN_MEMBER（非 owner）**：按现有权限模型限制——404
  `workflow_instance_not_found_or_not_visible`（与 domain 不存在同码，不泄露存在性）；
  member 的合法枚举面仍是 `workflow_my_tasks`。

任务要求字段与下游 projection（snake_case 原样透传，不 reshape）：

| 任务要求 | 下游字段 |
|---|---|
| instance_id | `workflow_instance_id` |
| title | `title` |
| state | `is_terminal` + `current_node`（服务端默认 status=active 过滤语义） |
| current_node | `current_node`（node_id/node_key/display_name/node_type） |
| current_assignee | `current_assignee_principal_id` |
| updated_at | `updated_at` |

## 2. 交付面（相对 base ef2bcac 的 delta，纯新增、零删除）

- `packages/broker/src/capabilities/workflow.js`（+60）：新增
  `workflowDomainInstancesManifest` 并入 `manifests` 导出（12→13）。
  - id/toolName `workflow_domain_instances`；唯一 operation `list`；
    `GET /internal/v1/workflow-instances/domain`，query 仅 `['domainId','limit']`；
    scope `workflow.read`。
  - 参数面：`domainId`（必填 UUID）、`limit`（1..20，broker-side fail-fast
    `invalid_pagination`，token/HTTP 调用计数 = 0）。
  - 错误表 declared-codes-only（base + auth + query + pagination +
    `workflow_instance_not_found_or_not_visible`），undeclared 服务码 fail-closed
    降级 `http_4xx`/`http_5xx`。
  - 只读红线：GET-only、无 body、无 Idempotency-Key、未声明 query 名物理上到不了
    svc-workflow（cursor/过滤器不透出，单页合同）。
- `packages/broker/test/capabilities.test.js`（+120）：manifest 计数 13 + 三个
  domain 测试（见 §3）。
- 其余 7 个 error-preservation closure 文件与 ef2bcac 字节一致（本轮零改动）。

## 3. 测试证据（本轮两次独立运行：主 worktree 与本分支 worktree 均 92/92 PASS）

1. `workflow_domain_instances: GET with camelCase domainId query mapping + workflow.read scope`
   — owner 成功路径：断言 wire query 恰为 `{domainId, limit}`（camelCase 实证）、
   token 请求 scope=`workflow.read`、summary 原样透传（workflow_instance_id /
   current_node.node_key / current_assignee_principal_id / updated_at 断言）。
2. `workflow_domain_instances: non-owner 404 preserves service code, status, request-id`
   — **权限测试**：非 owner（DOMAIN_MEMBER / 其他 domain owner）服务端 404
   `workflow_instance_not_found_or_not_visible` 端到端透出（code + status=404 +
   下游 `x-request-id`，不伪造、不压扁、不改写为 invalid_arguments）。
3. `workflow_domain_instances: limit out of bounds fails fast locally — HTTP call count = 0`
   — limit ∈ {0, -1, 21} 本地 `invalid_pagination`，零 token / 零业务 HTTP。

非回归：既有 `workflow_my_tasks` / `workflow_my_domains` /
`workflow_instance_detail` / `workflow_submission_history`、Forum/OKR/calculator、
relay/gateway/transport 全套随 92/92 一并通过；成功路径渲染字节未变。

## 4. 分支与状态

```
impl/workflow-domain-instances-broker-v1-wip  = ef2bcac + 上述 delta + 本报告（本地，未 push）
docs/workflow-domain-instances-broker-v1-spec = main(9cb17a1) + BROKER_V1 Spec（本地，未 push）
```

- 两分支均**未 push**、未开 PR、未合并、未 deploy（PRODUCTION_CHANGE = NONE）。
- 与既有 `spec/workflow-domain-instances-capability-v1`（f5ebb8a，绑定"新专用路由"
  方案，依赖 svc-workflow 新实现）的关系：本 BROKER_V1 方案改为绑定**已部署**端点，
  svc-workflow 0 改动即可交付任务语义；两份 proposed Spec 的取舍（是否废弃前者）
  属 Owner/spec 评审决策，本轮未代作。
- 合并路径（沿 ef2bcac 同款纪律）：先 accept
  `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`（其 WIP 是本分支 base），
  再 accept `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`，之后按
  GOVERNING_SPEC_UNMODIFIED 纪律评审合并（实现 PR 不得修改 Spec 文件）。

## 5. 红线核对（任务「严格禁止」项）

| 禁止项 | 本轮状态 |
|---|---|
| 修改 Workflow 状态 | 未触及（GET-only，无 transition 绑定） |
| 修改 assignment | 未触及（assignee 仅作为只读 projection 字段透传） |
| 修改 Domain | 未触及（svc-workflow 0 改动） |
| 修改 Principal | 未触及 |
| 修改权限 | 未触及（属主判定 100% 服务端，broker 不复制不放宽） |
| 修改历史 | 未触及（无任何写路径） |
