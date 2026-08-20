# Agent Core Roadmap V1

> 状态：冻结草案（docs-only）· 日期：2026-08-15  
> Authority amendment：2026-08-18  
> 按产品价值与依赖关系排序，不是机械照抄。配套：`AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`
> （分层与边界）、`AGENT_CORE_COMPONENT_MAP_V1.md`（ADOPT/ADAPT/BUILD/DEFER）。
>
> **安全域声明修订：**本路线原先把“one Agent = one process 安全域”作为当前
> peer-Agent 对抗隔离事实。该 claim 已被
> [`AGENT_CORE_HARDENING_PROGRAM_V1`](specs/AGENT_CORE_HARDENING_PROGRAM_V1.md)
> amendment：
>
> ```text
> PEER_AGENT_SECURITY_DOMAIN_CLAIM = SUPERSEDED
> REPLACED_BY = AGENT_CORE_HARDENING_PROGRAM_V1
>
> one Agent = one process
> = runtime / lifecycle / DSH_HOME / Session-owner boundary
> != current adversarial peer-Agent isolation boundary
> ```
>
> 当前 shared-host Agents 属于 cooperative trust domain。Phase 3 的 process
> credential / Broker identity 继续用于保护 Control Plane、服务凭据与外部访问身份，
> 但不再被描述为共享 UID Agents 之间已经成立的强隔离保证。

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
| Process Model | ✅ | one Agent = one process（runtime / lifecycle / DSH_HOME / Session-owner boundary）；100 常驻 fallback 证明 |
| Integration V1 | ✅ | 真实飞书 → Router → per-agent 进程 → resume → 回复（PR #3） |

> Phase 0 的 Process Model 完成证明的是独立运行时 owner 与恢复链路，不是当前
> shared-host peer-Agent adversarial isolation。后者已 defer 到未来独立
> `PER_AGENT_SECURITY_DOMAIN_V1`。

## Phase 1 — Long-lived Agent ✅（已完成，PR #5/#6/#7）

| 项 | 状态 | 一句话价值 |
|---|---|---|
| Agent Registry V1 | ✅ | 花名册：这个 Agent 是谁（有身份才谈得上长期） |
| Agent Session V1 | ✅ PoC 已完成（实验定案） | 谈话记录：一个 Agent 多个独立会话（main + normal）；**结论：product sessionId = DSH native sessionId，identity = (agentId, sessionId)，不建独立 session 包**（见 Component Map §2） |
| Agent Memory V1 | ✅ | 长期经验：跨 Session 记得住（不是第二套日志） |

依赖关系：Registry 是 Session/Memory 的父实体（session/memory 挂 agent 下）；
三者可并行开发，但**产品验证必须三合一**（见 Phase 2 闸门）。Session 线已收敛为
「DSH 原生直通 + Product metadata 薄层（延后到 Product API milestone）」，不再消耗
独立组件开发。

## Phase 2 — Product Integration（Registry + Session + Memory → Router → 真多 Agent）✅（已完成，PR #8）

- 把 Phase 1 三组件接进现有 Router：Binding 路由到 (agentId, sessionId)，不再写死
  `agent-demo + main`；
- **真正多 Agent**：注册多个 Agent，每个有独立 workspace/进程/会话/记忆；
- 验收闸门：真实飞书两条会话分别绑定不同 Agent，各自独立上下文、互不串话；
  同一会话 switchAgent 后进入另一 Agent 的 main。

交付（2026-08-15，`feat/product-integration-v1`，报告
`docs/reports/product-integration-v1.md`）：

- 统一 Router domain operation `switchAgent(bindingContext, targetAgentId,
  {targetSessionId?})`：Registry 校验 → Router 选 Session（显式/缺省 main）→
  更新并持久化 Binding → 返回新 Binding（决策 D-004，
  `docs/decisions/BINDING_AND_SWITCH_V1.md`）；
- Binding 持久化 = 原子 JSON（`<home>/.dsh/bindings/bindings.json`）：切到 Agent B →
  控制面重启 → 仍是 Agent B（进程内重建 + 真实控制面进程启动双验证）；
- DSH 侧 `agent_core_switch_agent` adapter（parent-RPC 转发，零策略）；
- 验收 `scripts/product-integration-v1-verify.mjs`：A/B 双 Agent 28 项断言全 PASS
  （注册 / workspace·home·进程·main session·memory 五隔离 / switch / 消息真实进入
  B / A 与其它 Binding 不受修改 / 重启恢复 / kill-resume / 自然语言 switch 工具）。

**下一阶段唯一优先级已兑现**；Phase 3+ 的横向扩展现在才允许开始。

## Phase 3 — Trusted Agent（进程身份 + Broker 身份）

- process credential：控制面 spawn 时为每个 Agent 建立独立的外部访问身份
  （形态 OPEN：bearer/mTLS/其他）；
- Broker 侧 credential → principal 绑定 + flat capability ACL；
- `resolvePrincipal` 从占位升级为真实绑定；
- 跑 TRUST-BOUNDARY §6 的参数走私 / prompt 注入 / self-reported identity 测试；
- 价值：Agent 能以不可自报、可审计的真实身份访问外部系统（论坛发帖、跑工作流），
  同时 Control Plane / Broker credential 不交给模型或请求体。

**修订后的边界：**Phase 3 保护的是 Control Plane 与外部系统身份链，不等于当前
shared-host peer Agents 已经互相隔离。若未来要求 A 无法读写 B 的主机资源，需要新的
`PER_AGENT_SECURITY_DOMAIN_V1`，不由本 Phase 静默承担。

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
- Phase 2 → 3：多 Agent 上线后，跨进程访问外部系统才成为日常需求；先保护
  Control Plane / Broker / service identity，再扩大真实外部副作用；
- Phase 3 → 4/5：凭据与 Broker 身份是「长期 Agent 干真活」的安全前提；
- Phase 4/5 可并行（技能成长 vs 主动工作互不阻塞），但都不早于 Phase 3 的进程身份；
- Phase 6/7 依赖 Phase 2 的产物形态（API 的 agent/session 语义来自 Registry/Session）；
- adversarial peer-Agent isolation 当前不在上述主线依赖中；触发条件出现后单独排期。

## 冲突与处理（与既有文档）

| 现有文档结论 | 本路线判断 | 处理 |
|---|---|---|
| V0 报告 E 节：「下一步唯一迁移目标是旧 Kernel Run/Session 面 → DSH agent/session 组合」 | 该目标已在 Integration V1 达成（agent/session 组合 = per-agent 进程 + DSH session + resume） | 历史结论 → 已完成事实，不再排期 |
| CAPABILITY_MATRIX：六项 BUILD（含 broker 侧绑定、consolidation、daemon） | 分散在各 Phase（3/1/5）而非一次性 | 无冲突：矩阵是「必须做什么」，路线是「先做什么」 |
| always-on 调查：daemon ≡ 控制面（Router）为同一组件 | Phase 5 的 proactive runtime 与 Router 合并形态仍保持该结论 | 无冲突；实现时验证 |
| TRUST-BOUNDARY：若要求 A 无法攻击 B，方案 B / 额外 per-Agent security domain 才成立 | 当前 V1 采用 cooperative shared-host trust domain；Phase 3 只实现可信外部身份链，peer-Agent adversarial isolation defer | **旧“当前已无冲突并兑现 peer 安全域”解释已 superseded**；evidence 保留，current authority = `AGENT_CORE_HARDENING_PROGRAM_V1` |
| D-002 契约：V1 不实现后端 | 本路线把 API 实现排在 Phase 6 | 一致 |
| **D-002 契约 §2.2/§2.5：Session.id 为「全局唯一不透明 id（ses_ 前缀）」** | **新实验证据：product sessionId = DSH native sessionId；DSH SessionId 作用域是 per-Agent DSH_HOME（非全局），identity = (agentId, sessionId)** | **⚠️ 待 reconciliation 的已知契约冲突**：契约的「全局唯一 / ses_ 前缀」约束与「(agentId, sessionId) 直通 DSH」冲突。本 Architecture PR **不修改 D-002**（避免与并行 Registry PR 同文件冲突），仅登记；建议后续独立契约修订 PR 将 Session.id 语义改为「per-Agent 唯一 opaque id（可等于 DSH sessionId），全局唯一由 (agentId, sessionId) 复合保证」 |

## 最终判断

1. **三份文档路径**（见文首标题对应文件）。
2. **最终 Agent Core 一句话**：基于 DSH 的薄组织层，把通用 Agent 运行时组织成
   长期存在的数字员工（身份/办公桌/会话/记忆/进程身份/外部能力/成长），不重做
   Runtime、不内置外部业务系统。
3. **FROZEN**：所有权边界、one Agent = one process 的 runtime/lifecycle/DSH_HOME/
   Session-owner 边界、当前 shared-host Agents = cooperative trust domain、
   Channel ≠ Agent ≠ Session、workspace-bootstrap 映射唯一 owner、DSH 是 Runtime、
   **product sessionId = DSH native sessionId（(agentId, sessionId) 复合身份，不建映射层）**、
   Forum/Workflow/OKR 在外部、Broker 是统一入口。
4. **SUPERSEDED**：`one Agent = one process` 当前已经提供 peer-Agent adversarial
   isolation。替代 authority：`docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md`。
5. **OPEN**：consolidation 时机、credential 形态、proactive 选型、jobs 持久化
   实现、daemon 托管、Artifact、Dashboard，以及未来 adversarial isolation 机制。
6. **与现有文档冲突**：三处——①「历史结论 vs 已完成事实」（V0 报告 E 节迁移目标
   已达成）；②「新实验证据 vs D-002 契约」（sessionId 全局唯一/ses_ 前缀约束）；
   ③旧 peer-Agent security-domain claim 已由 Hardening Program amendment。
7. **下一阶段唯一优先级（历史原文）**：Phase 2 Product Integration——Registry +
   Session + Memory 接进 Router，实现真正多 Agent（真实双会话各自独立上下文 + switchAgent）。
   该项现已完成；当前后续工作按最新 accepted Spec / Program 决定。
