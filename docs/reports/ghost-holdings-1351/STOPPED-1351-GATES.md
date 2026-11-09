# STOPPED-1351-GATES

记录时间：2026-11-08T08:50:05Z。结果：**STOPPED，未实施，未满足完成定义。**

## 坐标与授权

- 仓库：`mayf3/dsh-agent-core`。
- 隔离 worktree：`/Users/yanfenma/workspace/project/worktrees/h1351-gates`。
- 分支：`fix/1351-ghost-holdings-gates`。
- 实现候选 HEAD / 本次 base：`1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1`；本次没有改变 HEAD。
- 输入：根目录 `BRIEF-1351-GATES-IMPL.md` 已完整读取；用户要求四闸源码实现、测试原文、实现提交、回执、push、PR(base main)，不合并，零生产写入。
- issue 正文及唯一收敛评论已通过 GitHub 只读读取：<https://github.com/mayf3/agent-control/issues/1351>、<https://github.com/mayf3/agent-control/issues/1351#issuecomment-6716360936>。删除门禁不拦 disable；交接是过户本身；退役是过户完成加离册。
- 未访问生产服务接口、数据库或控制动作；没有生产写入。相邻仓库只读，未修改 checkout、ref 或工作文件。

## 实际定位结果

探索性空结果不是失败；没有因 `packages/gateway` / `packages/agent-registry` 等预想名称不存在而停止。已按实际 composition 推导并查阅实名入口：

| Surface | 查证结果与坐标 | 尚缺输入 |
| --- | --- | --- |
| Core 身份写面 | `packages/production-runtime/src/compose.js:212` 加载 Agent Definition；`broker-composition.js:25` 的 `mountBrokerGateway` 在 :32–33 拼接 `agentDefinitionAccess.handlers`；`packages/agent-definition/src/access.js` 实际动作只有 create/update/disable/set_default，:117 的 disable 调用 `config.js:312::disableAgentInConfig`。Broker gateway 是 capability gateway。 | issue 所指的现存 registry 删除/离册 callable 的真实版本化源码与调用链尚未绑定；没有把 disable 当删除，没有另造未授权删除接口。 |
| 幽灵巡检 | 本仓 `scripts/scheduler-watchdog.mjs` → `packages/scheduler/src/watchdog/index.js` 是 Scheduler W1/W2 巡检，不能由名字推定为 issue 中的 workflow holdings 检测器。另查 `agent-control-ac-1106`（agent-control Python controller）、`agent-core-remote-gateway`（远程 HTTP boundary）、`watchdog-lark-v3-bb5327f-staging`（旧 Core 副本）及现有安装源码的入口关系，未绑定 issue 所称 NOT_IN_REGISTRY 检查器。 | 该既有检查器的版本化 owner repo、源码入口及 invocation；搜索无命中本身不证明该检查器不存在。 |
| Svc 角色写面 | 相邻 `/Users/yanfenma/workspace/project/svc-workflow` checkout HEAD=`88ff8145eb0842b4ce759117caf4b05f9012ebdc`，较旧，未作为当前权威。另从其本地 `origin/main` 固定 Git 对象 `b5096782f666ad22aa3508fdbf9562278a977c0f` 查证：HTTP provisioning role-bindings → application provisioning → `src/store/postgres/provisioning_repository/mod.rs::upsert_role_binding` (:342)、`replace_domain_owner` (:520)，只锁查本地 `principals.enabled`；另有 `establish_domain_owner` (:288) 与 global role upsert (:449)。 | 新增 registry 活性义务必须覆盖真实 owner 建立/写入/启用/过户路径，不能只补一个 handler 或用旧 checkout 冒充 main。 |
| 在册查询与 workflow 方式 | Core `packages/product-api/src/workflow-admission.js` 提供 `/v1/directory/agents` 的既有权威读面。既有 workflow 通过 definition authoring 的 draft/graph/publish 和 execute.create_instance 创建真实实例；不另造第二套 workflow 语言。 | 这些既有能力不自行授予 GC 删除或全部 role binding 写入的新跨服务义务。 |

## 触发停止的具体前置谓词

**不是探索性空结果，而是必需的实施授权谓词不满足。**

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
ROUTE_SCHEMA_VERSION = 2
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO  # 指本次新增四闸义务；非既有治理框架
IMPLEMENTATION_AUTHORITY = none  # 常设授权框架自身
MUTATION_AUTHORIZATION = VALID   # 用户任务授权存在；不代替 Product Contracts
ISOLATED_WRITE_SURFACE = YES
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
SPEC_GAP_DEPENDENCY = LOAD_BEARING
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = RE_PREFLIGHT
```

依据与具体依赖：

1. `AGENTS.md` 及 `.agents/local/README.md:50–60` 要求 REUSE 落在已接受实施合同内；CONTROLLED 仍 docs-first。`.agents/skills/spec-governance/SKILL.md` 明文：`AMEND/NEW + CONTROLLED and every SUPERSEDE route are docs-first.`；选定 `modes/PREFLIGHT.md` 要求新增受控权威进入 base 前不实施。
2. `AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1` 已在本次 base，但 frontmatter :26 是 `implementation_authority: none`。原 §2 允许自主工程和合法实施，§3C 允许同类可靠性改进的规范接受链；二者不能直接替代具体 implementation-authorizing child Contracts。§3C 同时要求非作者独立语义审查、接受者真实身份权限、reviewed HEAD 与最终接受事务。没有把独审建议当成正式接受。
3. 已检查本仓 Product Architecture、Current Decision index、直接相关 identity/bootstrap/standing authorities，并独立检查 Svc 固定 main 对象的 Product/Architecture/contracts/specs。Svc `docs/contracts/IDENTITY_PROVISIONING_API_V0.md:111–116,129–132` 和 coordinator control-plane owner target 规则只要求本地 Principal 存在且 enabled。现有 canonical identity admission 合同的 assignment/context 切片不能自行扩大为全部 owner binding 写入的跨服务拒绝。
4. **可达反例**：本地 `principals.enabled=true`，Core Definition 已离册，provisioning 接受 DOMAIN_OWNER enabled 写入；现有仓储本地校验可通过。任务要求新增 registry 在册/启用拒绝、明确错误码以及校验器不可用时的写入处理。这是身份/责任生命周期的新义务，不是单纯修正既有本地 enabled 检查的实现 bug。只执行离线源码任务并不消除该 Contract 变化。
5. Core bootstrap Spec `AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1.md:718–738` 也记录无通用 remove seam，其既有失败处理保留 disabled identity。不能默默添加删除行为并宣称已有合同已决定该意义。

影响范围：四闸中依赖新增身份/删除 Contracts 的实现、行为定义测试、同 PR 假称已授权实现均不允许。未把缺少生产授权作为停止非生产工作的原因，也未改变 D-009、UNKNOWN 或 fence。用户额外规定“失败即停”，所以本次在记录后停止，没有继续补无调用方 helper 或伪造四闸完成。

## 最小接续路径与责任

- 原因：四闸新增受控身份/删除义务尚无 accepted-in-base 的具体实施合同；GC 与既有幽灵巡检的真实源码入口尚未绑定。
- 受影响动作：本次直接四闸实现及其三条验收、实现提交和实现 PR。
- 责任主体：相应 Core/Svc/实际 gateway/watchdog 代码所有者；常设 §3C 下既有合法规范接受责任链与非作者 reviewer。
- 现有授权：用户任务、issue 收敛决定与常设 §2/§3C 已授权推进；**不是要求重复 Owner 业务裁决**。
- 最小补证/闭环：绑定真实 GC/巡检源码版本及 invocation；仅对新增四闸写有界 child authority，明确 disable 例外、holdings 范围、owner 全写点、错误与不可用行为；经非作者独审及真实有权接受事务，docs-first 权威进入对应实现 base 后，以 REUSE 接续实现。不能用当前分支自写 accepted 状态替代主线接受。
- 下次合法触发/关闭条件：上述具体 authority 已在实现 base 且源码入口绑定；重新核对受影响 base delta 后继续。本任务“不合并”的边界不允许本 worker 为跨过此前置自行合并权威 PR。
- 审核独立性：只读子任务 `/root/surface_map` 复核真实来源，`/root/authority_check` 独立复核上述实施路由；均未编辑或生产写入。该复核不是产品接受事务。

## 测试及交付实态

**没有运行测试，故无测试原文可报告；没有把查找命令 rc=1/路径探索 rc=2 算成测试失败。**

| 要求 | 本次实态 |
| --- | --- |
| 验收一：持有实例的 agent 删除被拦截 | NOT_EXECUTED；尚未实施 |
| 验收二：巡检含幽灵 holdings 清单 | NOT_EXECUTED；尚未实施 |
| 验收三：不在册 owner 新设被拒 | NOT_EXECUTED；尚未实施 |
| disable 不受 GC 门禁、四闸各自测试、受影响回归 | NOT_EXECUTED；尚未实施 |
| 实现 commit | NONE；HEAD 未变 |
| IMPL-RECEIPT-1351.md | 未创建；避免冒称实现回执 |
| push / PR(base main) / merge | 均未执行 |
| 生产写入 | 0 |

写本记录前 `git diff --stat` 无输出，`git diff --quiet` 与 `git diff --cached --quiet` 均 rc=0；工作区只有用户原有未跟踪简报。此次唯一新增文件是本 STOPPED 记录；原简报未改。
