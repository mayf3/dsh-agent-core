# Agent Core Roadmap V1

> 状态：冻结草案（docs-only）· 日期：2026-08-15
> 按产品价值与依赖关系排序，不是机械照抄。配套：`AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`
> （分层与边界）、`AGENT_CORE_COMPONENT_MAP_V1.md`（ADOPT/ADAPT/BUILD/DEFER）。

---

## 路线纪律（最高优先级规则）

**Registry / Session / Memory 完成以后，下一优先级是 Product Integration（Phase 2），
而不是继续横向新增更多插件。**

不允许出现这种情况：

```
Registry ✅ → Session ✅ → Memory ✅ → Self-Evolution ⏳ → Proactive ⏳
→ Artifact ⏳ → Dashboard ⏳ → ...
```

全部分别做完了，但产品仍然只有 `agent-demo + main` 一个可交互的 Agent。

**验收闸门**：每个 Phase 结束时，必须能用「真实用户可见的完整链路」证明价值
（参考 Integration V1 的验收方式：真实消息 → 路由 → per-agent 进程 → 回复），
而不是只证明「组件自己能用」。

---

## Phase 0 — Runtime Foundation ✅（已完成）

| 项 | 状态 | 交付 |
|---|---|---|
| DSH bootstrap | ✅ | V0 vertical slice（external.calculator 6×7=42） |
| Feishu Connector | ✅ | 真实 p2p/group/thread 入站 + 出站回复验收 |
| Workspace Bootstrap | ✅ | agentId → workspace/DSH_HOME 唯一 owner |
| Process Model | ✅ | one Agent = one process；100 常驻 fallback 证明 |
| Integration V1 | ✅ | 真实飞书 → Router → per-agent 进程 → resume → 回复（PR #3） |

## Phase 1 — Long-lived Agent 🔄（进行中，三线并行）

| 项 | 状态 | 一句话价值 |
|---|---|---|
| Agent Registry V1 | 🔄 | 花名册：这个 Agent 是谁（有身份才谈得上长期） |
| Agent Session V1 | 🔄 | 谈话记录：一个 Agent 多个独立会话（main + normal） |
| Agent Memory V1 | 🔄 | 长期经验：跨 Session 记得住（不是第二套日志） |

依赖关系：Registry 是 Session/Memory 的父实体（session/memory 挂 agent 下）；
三者可并行开发，但**产品验证必须三合一**（见 Phase 2 闸门）。

## Phase 2 — Product Integration（Registry + Session + Memory → Router → 真多 Agent）

- 把 Phase 1 三组件接进现有 Router：Binding 路由到 (agentId, sessionId)，不再写死
  `agent-demo + main`；
- **真正多 Agent**：注册多个 Agent，每个有独立 workspace/进程/会话/记忆；
- 验收闸门：真实飞书两条会话分别绑定不同 Agent，各自独立上下文、互不串话；
  同一会话 switchAgent 后进入另一 Agent 的 main。

**这是下一阶段唯一优先级。** 完成后才允许进入 Phase 3+ 的横向扩展。

## Phase 3 — Trusted Agent（进程身份 + Broker 身份）

- process credential：控制面 spawn 时注入 per-agent 进程凭据（TRUST-BOUNDARY 方案 B；
  形态 OPEN：bearer/mTLS/其他）；
- Broker 侧 credential → principal 绑定 + flat capability ACL；
- `resolvePrincipal` 从占位升级为真实绑定；
- 跑 TRUST-BOUNDARY §6 最小攻击测试（参数走私 / prompt 注入 / 插件伪造）；
- 价值：Agent 才能安全访问外部系统（论坛发帖、跑工作流），这是「数字员工上岗」
  的前提。

## Phase 4 — Growing Agent（动态插件生命周期）

- 治理流程：实验 → 测试/证据 → reviewer → promote → disable/rollback；
- 复用 Cordis 动态插件运行时（不重做）；
- 价值：Agent 能学会并保留新技能，且可回滚。

## Phase 5 — Proactive Agent（主动持续工作）

- schedule / goal / inbox 之上的薄封装：常驻 daemon + 冷启动批量恢复；
- jobs persistence（当前纯内存，重启即失联）+ cron/calendar 语义（DEFER 到期）；
- 价值：没人催也会继续工作（定时巡检、长任务续跑）。

## Phase 6 — Product Surface（对外产品面）

- Agent Core API（HTTP `/v1`，契约已冻结在 D-002 api.json）；
- Mobile / Web UI（首屏 listAgents + getBinding；切换 switchAgent；聊天
  sendMessage/getMessages）；
- 更多 Channel 适配器（WeChat/Android/Web——契约已渠道无关，新渠道 = 新 adapter）。

## Phase 7 — Operations（运维面）

- Artifact（产物/日志展示）；
- Observability（telemetry/errors 聚合）；
- Dashboard（官方 UI 之上的控制面面板，数据面现成）。

---

## 依赖与理由

- Phase 1 → 2：三组件单独成立，但只有接进 Router 才构成「多 Agent 产品」；
- Phase 2 → 3：多 Agent 上线后，跨进程访问外部系统才成为日常需求（安全边界优先于
  功能扩展）；
- Phase 3 → 4/5：凭据与 Broker 身份是「长期 Agent 干真活」的安全前提；
- Phase 4/5 可并行（技能成长 vs 主动工作互不阻塞），但都不早于 Phase 3 的进程身份；
- Phase 6/7 依赖 Phase 2 的产物形态（API 的 agent/session 语义来自 Registry/Session）。

## 冲突与处理（与既有文档）

| 现有文档结论 | 本路线判断 | 处理 |
|---|---|---|
| V0 报告 E 节：「下一步唯一迁移目标是旧 Kernel Run/Session 面 → DSH agent/session 组合」 | 该目标已在 Integration V1 达成（agent/session 组合 = per-agent 进程 + DSH session + resume） | 历史结论 → 已完成事实，不再排期 |
| CAPABILITY_MATRIX：六项 BUILD（含 broker 侧绑定、consolidation、daemon） | 分散在各 Phase（3/1/5）而非一次性 | 无冲突：矩阵是「必须做什么」，路线是「先做什么」 |
| always-on 调查：daemon ≡ 控制面（Router）为同一组件 | Phase 5 的 proactive runtime 与 Router 合并形态仍保持该结论 | 无冲突；实现时验证 |
| TRUST-BOUNDARY：方案 B 为唯一成立方案 | Phase 3 按方案 B 实施 | 无冲突 |
| D-002 契约：V1 不实现后端 | 本路线把 API 实现排在 Phase 6 | 一致 |

## 最终判断

1. **三份文档路径**（见文首标题对应文件）。
2. **最终 Agent Core 一句话**：基于 DSH 的薄组织层，把通用 Agent 运行时组织成
   长期存在的数字员工（身份/办公桌/会话/记忆/进程身份/外部能力/成长），不重做
   Runtime、不内置外部业务系统。
3. **FROZEN**：所有权边界、one Agent = one process 安全域、Channel ≠ Agent ≠
   Session、workspace-bootstrap 映射唯一 owner、DSH 是 Runtime、Forum/Workflow/OKR
   在外部、Broker 是统一入口。
4. **OPEN**：sessionId 映射、consolidation 时机、credential 形态、proactive 选型、
   jobs 持久化实现、daemon 托管、Artifact、Dashboard。
5. **与现有文档冲突**：仅一处「历史结论 vs 已完成事实」（V0 报告 E 节迁移目标已
   达成），已在表中说明，不覆盖旧决策。
6. **下一阶段唯一优先级**：Phase 2 Product Integration——Registry + Session +
   Memory 接进 Router，实现真正多 Agent（真实双会话各自独立上下文 + switchAgent）。
