# Captain Auth identity-only 创建差量收据

结果：`STOPPED_BEFORE_AUTH_MUTATION`。没有创建 Captain Principal；没有取得 UUID、创建时间或创建者回执。当前执行上下文缺少合法可用的管理认证输入；**没有证据证明所有现有 Auth 管理员都无法完成**。

## 授权与固定坐标

- 工作面：`/private/tmp/h-captain-auth`，分支 `docs/captain-auth-create`。
- 初始 detached HEAD：`24974c720d634b965943e08bfd0862657b9be0e1`。
- 新分支固定 base：main `80fc43bd626ceaf5a680f9355ac9c8b209cdd82b`。其包含已合并的常设授权；本轮未修改 accepted 权威或产品源码。
- 执行依据：[用户 Brief](BRIEF-CAPTAIN-AUTH-CREATE.md)；Owner 原件 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json` 的唯一 selector `$.rulings[id=owner-20261108-three-unified]`、`items[0]`，时间 `2026-11-08 06:11`。
- ruling canonical SHA256：`00f1fb2995d5f83a3bb9f50f442754fadb13f46274c2f1cbafd5f90253d5b218`。算法、原文快照及来源文件哈希见 [observations.json](docs/reports/captain-auth-create-20261108/observations.json) 和 [owner-ruling.json](docs/reports/captain-auth-create-20261108/owner-ruling.json)。
- accepted [Standing Operational Delegation V1](docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md) `CTR-SOD-004` 已批准专用身份目的；创建、五条件任命、控制生效、单 Mandate 签发是独立事实。[SRA V1](docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md) `SRA-C-001` 的身份、独立性、时效及撤销要求保持。

本轮不要求重新批准创建目的，不申请新增信任边界，不生成新的 HUMAN_GATE。

## PREFLIGHT 与实际执行边界

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core + mayf3/auth-service formal management API
BASE_HEAD = 80fc43bd626ceaf5a680f9355ac9c8b209cdd82b
ROUTE_STAGE = OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES (Core standing purpose; Auth definitions inspected below)
GOAL_OR_TARGET = identity-only creation of release-captain-agent-core-20261107
CURRENT_GAP = no authenticated existing management actor in current execution context
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = CTR-SOD-004 + owner-20261108-three-unified items[0]
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = YES
SPEC_GAP_DEPENDENCY = NONE
OWNER_DECISION_REQUIRED = NO
IMPLEMENTATION_ALLOWED = NOT_APPLICABLE
OPERATION_ALLOWED = NO (Auth creation)
MERGE_READY = NOT_APPLICABLE
DONE_WHEN = real creation receipt OR exact failure delta committed/pushed as unmerged PR
EXPANSION_TRIGGER = new actor/trust boundary, Client/Secret/Grant, DB bypass or lifecycle enrollment
NEXT_ACTION = STOP
```

Mandate 的目的/范围授权有效，实际 actor 资格与创建前置条件尚未满足；runbook 未进入写入步骤。停止仅针对 Auth 写入，失败登记和 PR 继续。此块是本次 preflight 的可读记录，不是 schema route-validator 的通过声明，也不签发任何生产授权。

## ① 正式接口、身份和权限核验

已应用本机 [auth-service 技能](/Users/yanfenma/.openclaw/skills/auth-service/SKILL.md) 及 API 参考。技能的 Principal 查询脚本直接访问数据库，本轮未运行；技能列举的 HR `workflow.admin` 不能推导 Auth registry 写权限。

系统 `com.auth-service` 的只读 launchd 观察为 running、PID `62443`、last exit code `0`，声明的工作目录/首个 Node 入口为：

`/Users/yanfenma/workspace/project/production-auth-service-0227f9d6b16dbc306c5fd0a7c1edc95cf5a77c15`

该 checkout HEAD 为 `0227f9d6b16dbc306c5fd0a7c1edc95cf5a77c15`，`git status --short` 空。以下行号均绑定该目录；源码和已存在 dist 产物 SHA256 载于 observations。launchd 声明、磁盘代码和 public health **不证明运行进程加载了全部相同字节**。

| 核验项 | 结果与具体坐标 |
|---|---|
| 正式创建接口 | `POST http://127.0.0.1:4001/api/v1/principals`；`src/server.ts:163` 挂载，`src/routes/idempotent.ts:114–138`；构建产物 `dist/src/routes/idempotent.js:77–96`。本轮未调用。 |
| 所需管理权限 | `src/middleware/v1-management-auth.ts:28–31,59–115`：Auth 签发的 V1 RS256 Bearer token，`aud=svc-auth`、`scope` 包含 **`auth.identity.provision`**；fresh 核验 active Principal、active Client 和 Client→Principal 归属。 |
| 合法管理 caller 类型 | `contract-bundles/minimal-auth-v1/audience-registry.json:46–56`：`svc-auth` 只接受 `service`，machine enabled，Human/delegated disabled。OS UID、User admin 角色、HR 的 workflow 管理权限都不能替代上述认证。 |
| 现有管理员历史线索 | `docs/audits/runtime-reconciliation/RECEIPT_20260724000100_PROVISIONING_BOOTSTRAP.md:23–26,67–75` 于 **2026-07-26** 记录 Principal `857b20c3-8d84-497d-950a-7b185a116687`、Client `mc_prov_N9NO0yYvw_3fR1ucqusIqw` 具有该 audience/scope。**现任、唯一性、active/Grant/Secret 有效性均未 live 验证，保持 UNKNOWN。** |
| 现有正式操作入口引用 | Core `scripts/canonical-agent-onboarding.mjs:99,124–144` 引用 `/Users/yanfenma/.openclaw/credentials/broker-provisioning-v2-secret` 并通过 `/oauth/token` 获取管理 token。本轮只读源码；完整 onboarding 会创建 Client/Grant 等，故未调用。 |
| 本次真实执行身份 | `uid=502(yanfenma)`；不是已认证 Auth Principal。不会把当前 Agent、UID、历史管理员 UUID 冒认为创建者。 |
| 具体不可用认证输入 | 上述凭据文件 fresh metadata：regular、UID `505`、GID `601`、mode `0600`、nonempty；当前 UID 502 的 `os.access(R_OK)=false`。没有读取、复制或哈希凭据内容，也未更改权限、切身份或 mint token。 |
| 已有机制检查的限制 | 只读检查现有入口、`/usr/local/libexec` 和 `/etc/sudoers.d` 名称及可读政策；三个 HR/LW policy 文件不可读，未提权读取、未运行 executor。没有建立当前任务可用的 attributable Auth 管理调用路径。此有限检查不能推出所有现有管理员/机制不存在。 |

唯一 live HTTP 操作是 `GET /api/health`，于 `2026-11-07T22:14:44.571898Z` 返回 HTTP 200、`authContractMode=v1`、`authContractVersion=1.15.0`、digest `78e51dc942356da289840dbae1c79c753925f0acc7ea566e55c06614545cb291`。这只证明 public health；没有认证或目标查询结果。

## ② identity-only 隔离能力核验

**声明的生产源码和 dist 中存在独立的 Principal-only 创建路径；未作 live 创建验证。**

- `src/routes/idempotent.ts:38–46,114–138` 接收 opaque `external_ref`、可选 `display_name`、`principal_type=agent|service`、`agent_id`、`owner_user_id` 和可选 claim 字段；默认类型为 service。不能把默认值当作 Captain 的已批准类型。
- `src/lib/oauth/v1/idempotent.ts:278–312` 新建分支只写 MachinePrincipal 的身份字段并记录 `principal.created` 审计；不创建 Client、Secret、Grant、Agent Definition、Session 或 canonical lifecycle。`external_ref` 为唯一 opaque key；display name 不是唯一身份。
- POST 是 create-or-get/claim 管理操作；既有 legacy 行还可能补 `requestDigest`（同文件 `:123–139`），不得当成无副作用查询。未发送 `expected_principal_id`，也未调用任何 POST 来探测目标。
- `/api/v1/clients` 是另一条路径；它会生成首次 Secret，并可能自动提供 fleet send / execution-history Grants。本任务不得调用。bootstrap、完整 onboarding、SQL/CLI 直写也没有执行。
- 创建响应字段为 `id/principal_type/display_name/status/external_ref/created_at/created`，**不含 creator**。中间件设置 `req.actor`，创建 helper 未接收 actor；未来创建者归属须另以实际通过正式验证的 caller `sub/client_id`、请求时间和响应收据绑定，不能伪称 API 返回 creator 字段。

## ③ 类型、canonical、Agent/Session 和生命周期

Auth 当前架构 [MINIMAL_AUTH_FOUNDATION_V2](/Users/yanfenma/workspace/project/production-auth-service-0227f9d6b16dbc306c5fd0a7c1edc95cf5a77c15/docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md) exact-incorporates V1 的稳定身份/Profile 规则。相关 accepted Specs 和 schema 已核验，未改其含义。

| 要求 | 权威定义及本次状态 |
|---|---|
| Principal 稳定标识 | `docs/contracts/minimal-auth-v1/README.md:150–170`：Principal 是 stable UUID，名称/工作区/部署变化不改变 UUID。通用类型有 user/agent/service；本机器接口仅 agent/service。指定字符串 `release-captain-agent-core-20261107` 是任务身份标签，**不是已证明的 UUID 或 canonical Agent ID**。 |
| Agent / Service Profile | accepted `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1.md:144–169`：AGENT 需要非空 agent_id；owner_user_id 可为 null，不得伪造人类 owner。SERVICE 不带 agent_id。不能因接口默认 service 或角色名含 captain 就选定类型。 |
| Auth 原生状态 | `prisma/schema.prisma:98–100,116` 仅 `active|disabled`，默认 active；创建请求没有 status 字段。**`created_not_appointed` 是预期治理登记状态，不是 Auth 原生 status，本轮也尚未达到 created。** |
| canonical Agent | accepted `AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1.md:65–85`：无显式 lifecycle 为 unresolved；canonical 要求 active AGENT + exact `^agt_[a-z0-9-]+$`、长度 5..128 Agent ID + 显式 canonical lifecycle。名称和 active 都不能自动提升为 canonical。 |
| 创建与 enrollment 分离 | accepted `AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1.md:304–329` 的 canonical transition 面向已存在 exact pair，并有 typed authority/fresh Definition 等条件。普通 Principal POST 不做 enrollment。本次没有追加 lifecycle、Agent Definition 或 successor 操作。 |
| Agent / Session 所有权 | Core `AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2` 由 Auth 拥有 UUID/type/status/agentId，Definition 拥有 Agent existence/enabled；`AGENT_WORKSPACE_SESSION_MODEL_V3` §22：principal/credential/grants 属于 Agent，Session 归 target/executing Agent。Auth Principal-only 创建不建立 Router Session、Session 映射或跨 Session 归属证明。 |

因此 Captain 的真实 type、UUID、canonical pair、精确 Session 及生命周期均未确认。没有按名称推断映射，没有将该标签硬塞入 `agt_...` 路由，没有拿 human、service 或当前执行 Agent 代替 Captain。恢复时由原 Auth 身份责任链按既有权威提供精确 typed 解释及允许的创建字段；本收据不自行新增类型政策，也不宣称需要新的 Owner 产品决定。

## ④ STOP 差量、责任链与恢复条件

| 六要素 | 本次记录 |
|---|---|
| 原因 | 当前 UID 502 无可用的正式管理认证输入，无法证明 `svc-auth/auth.identity.provision` 的 live caller 身份与权限；目标 typed/canonical/Session 事实亦未建立。 |
| 受影响动作 | 所有 Captain Auth 创建、目标认领、canonical enrollment、任命、签发和依赖生产动作。失败登记及 PR 仍在授权内。 |
| 责任主体 | 既有 Auth 合法管理责任链提供真实管理员/正式调用机制和类型解释；原任命链处理后续条件任命；当前 worker 仅记录查证及停止结果。未发送外部交办消息。 |
| 现有授权 | Owner `owner-20261108-three-unified` items[0]、`CTR-SOD-004`；不重批创建目的、不自授认证/Grant、不借系统 admin 身份冒充 Auth 管理员。 |
| 最小补证 | 原 Auth 管理员经既有正式接口验证的 caller Principal/Client、当前 `auth.identity.provision` 权限与合法 Secret custody/call path；Captain exact type/canonical/Agent-Session/lifecycle 解释；实际创建或只读前态及可归属回执。无需把 Secret 值交给本 worker。 |
| 下次合法触发及关闭条件 | 原有合法管理员/已存在的获准调用机制可用后，在原授权下 fresh preflight；失败/未知即停，不盲重试。只有确需新增信任边界时才提出该新增部分的最小 HUMAN_GATE。通过正式接口创建并独立核对真实 UUID/time/caller 与零附赠 Client/Secret/Grant 后，才把治理状态记为 `created_not_appointed`；不能将此次 STOP 自动续为写入尝试。 |

这不是“现有管理员确实无法完成”的证明：现有管理员历史线索存在，当前 live 权限和全部合法途径的可用性仍为 UNKNOWN。缺口为本次执行上下文的身份/机制可用性，没有虚构权限拒绝响应、403、管理员失效或唯一性结论。

## 实际结果、验证与交付

| 项目 | 本次结果 |
|---|---|
| Principal UUID / 创建时间 | `UNKNOWN` / `UNKNOWN`；未创建、未查询目标，不宣称不存在。 |
| 创建者 | `NOT_EXECUTED`；当前 worker 没有已认证 Auth 身份。 |
| 创建 / 目标认领 / token mint | 全部 `NOT_EXECUTED`，请求数 0。 |
| Client / Secret / Grant / DB / runtime:8788 | 本任务操作数全部 0；没有凭据读取或权限修改。此为本次操作记录，不是全局数据库零变更证明。 |
| 任命 / 控制生效 / 生产发布 | 本次未任命 / `NOT_VERIFIED` / `FORBIDDEN`。 |
| 停止记录 | [STOPPED-CAPTAIN-AUTH-CREATE.md](STOPPED-CAPTAIN-AUTH-CREATE.md)。 |
| 可复核证据 | observations 中的 source/blob/SHA256、Owner 原文快照、文件 metadata 和单次 health 观察。未保存 Secret、token、credential verifier 或受保护业务行。 |
| 独立核验 | `/root/auth_contract_audit` 完成生产声明源码/dist/权威只读核验；`/root/captain_authority_audit` 完成 Owner/accepted Core authority 核验。文档 candidate 的独立 exact-HEAD 评审和最终差量复核另见本目录评审文件（生成后绑定实际 HEAD）。 |

交付目标为已提交、已推送的 `docs/captain-auth-create` 和以 main 为 base 的未合并 PR。最终 commit/PR 以 Git 对象和 PR 实际读回为准；文档审查不等于创建、任命或生产验收。
