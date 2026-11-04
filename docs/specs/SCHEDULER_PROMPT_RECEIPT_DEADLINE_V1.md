---
spec_id: SCHEDULER_PROMPT_RECEIPT_DEADLINE_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
intended_implementation_authority_on_acceptance: contracts
authority_action: SUPERSEDE
date: 2026-11-04
repository: mayf3/dsh-agent-core
authoring_base: f767e8d6608cdb0917aad2d471ba0454d0966a0f
scope:
  - Scheduler agentTurn prompt receipt deadline selection and compatibility
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
external_authorities: []
supersedes: []
supersedes_clauses:
  - authority: AGENT_PROCESS_LIFECYCLE_HARDENING_V4
    clause: CLAUSE-PROC-DEADLINE-CONFIG section 5.1
    coordinates: f767e8d6608cdb0917aad2d471ba0454d0966a0f lines 850-870
    effect: complete replacement of section 5.1 with the bounded Scheduler receipt exception
superseded_by: null
owners: [mayf3]
owner_rulings:
  - https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350
  - https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788
references:
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V3.md
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
---

# SCHEDULER_PROMPT_RECEIPT_DEADLINE_V1

## 1. Goal

使 Scheduler agentTurn 的 prompt receipt 窗口与 Job 时限相称，同时保留 deployment 配置、
AgentProcess deadline 起止点及 UNKNOWN 保护。本文为 #527 D1 的 **proposed、docs-first**
权威候选；不表示已经接受、实现、安装或启用。

## 2. Scope and non-goals

本文完整重述 V4 `CLAUSE-PROC-DEADLINE-CONFIG` §5.1 的四字段模型，只改变 Scheduler
agentTurn 的 receipt 默认及受控 per-job 选择。V4 本体保持不变；其余 lifecycle、identity、
RPC、active-turn、shutdown、reconciliation、fence、fresh-lineage 及验收义务继续有效。
不改变 `timeoutSeconds` 的执行时限、权限、retry/catch-up 或 production 配置。

## 3. Authority, scope exception and activation

- **R1**：[Owner 2026-11-04 04:41:56Z 裁定](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350)：
  指定公式、per-job 字段和 env 全局覆盖；120000ms 运维缓解并入后续舰队窗口。
- **R2**：[Owner 2026-11-04 04:51:28Z 补充裁定](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788)：
  指定 V4 §5.1 整体继任、per-job > env > 继任默认、校验与兼容、先 main 接受再实现。
- 本次合同交办进一步明确：只替代 §5.1 deadline 动态语义，保留静态 deployment 值语义，
  不改 V4 稳定 ID 本体；持久原始交办为本工作位 `BRIEF-527-DOCS.md`，PR 亦应记录此范围。

**supersedes（条款范围，接受后生效）**：
[`AGENT_PROCESS_LIFECYCLE_HARDENING_V4`, `CLAUSE-PROC-DEADLINE-CONFIG` §5.1](https://github.com/mayf3/dsh-agent-core/blob/f767e8d6608cdb0917aad2d471ba0454d0966a0f/docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md#L850-L870)。
其 §5.2 和 2024–2026 行的禁止仅在本文明确允许的 Scheduler receipt 选择上让位，
其余静态所有权和禁止保持有效。

通常的 `.agents/local/README.md` / `SPEC_FORMAT_V0` 要求 whole-authority successor，
禁止 partial supersession 和 fragment 形式的 `supersedes` 元数据。本次按用户明确合同与 R2
执行指定的条款范围例外，**不声称是 whole-V4 supersession，也不形成一般例外**。
frontmatter `supersedes: []` 只表示没有整份 Spec 的 lifecycle 替代；真实条款指向完整记录在
`supersedes_clauses` 及上文，不把 fragment 填进整份 Spec 的元数据。

本文保持 proposed / implementation_authority=none。监管验收后，只有 mayf3 或 PR 中明确授权的
maintainer 可绑定独立 reviewed semantic head、文档哈希与最终 accepted head，接受此具体例外和
本文；在接受记录明确条款关系并合入 main 后，才可激活 `implementation_authority=contracts`。
这不是将整份 V4 标为 superseded 的授权。后续实现必须另起任务，绑定包含 accepted 本文的 base。
R2 的批准日期不使未合并候选提前生效。本任务不 merge、不改任何生产状态。

## 4. Recorded observations and evidence

`OBS-527D1-001`：于 2026-11-04 只读核对 base `f767e8d6...` 的 V4:850–920、2024–2026，
其 receipt code default 为 30000ms，禁止 Scheduler 动态覆盖，静态配置启动时冻结。
`OBS-527D1-002`：同日经 `gh issue view 527 --repo mayf3/dsh-agent-core --comments`
和 GitHub issue/comments API 核对 R1/R2；两条评论作者均为 mayf3，内容与 §3 锚点一致。

`EVD-527D1-001`：上述原文直接支持本次默认/所有权冲突及 R2 的起草方向；只证明文档输入，
不证明新 deadline 的实现或生产效果。原停止记录为
`/private/tmp/dsh-527-scheduler/STOPPED-527.md`（本任务只读），D1 来源坐标见下表。

## 5. Decision and conflict crosswalk

`DEC-527D1-001`：按 R1/R2，采用下列完整四字段模型及 receipt 选择；只对可信 Scheduler
agentTurn 开放此窄口，其他调用不获得任意 per-message deadline override。

下列旧行号全部绑定 base `f767e8d6608cdb0917aad2d471ba0454d0966a0f`。

| 旧条款原文与行号 | 新语义 / 保留关系 | Owner 裁定锚点 |
|---|---|---|
| V4:852–870 §5.1；861「不得由…Scheduler 动态覆盖」；866 receipt 默认 `30000` | §6 完整重述四字段，仅 Scheduler receipt 可按 Job 字段或比例默认选择；其余字段及非 Scheduler 默认保留 | [R1 D1](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350)、[R2 D1](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4:874–877 `per-Agent static override > global deployment value > code default`；880–920 env、legacy 和启动冻结 | Scheduler 的 per-job > deployment 层 > 继任默认；deployment 层内部完整保留 static > env > legacy；不修改已运行 process 配置 | [R2 优先级、兼容](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788)；本次交办明确保留静态值 |
| V4:870「positive safe integers」「fail-loud」；920 非法配置拒绝 | 新秒字段及转换结果同样校验，禁止无效值静默降级；旧 deployment 校验保留 | [R2 校验与兼容](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4:2024–2026「per-message / Scheduler dynamic timeout override…拒绝」 | 仅本文 receipt 选择是显式例外；任意消息、其他 deadline override 仍禁止 | [R2 D1 §5.1 继任范围](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4:943–949 prompt receipt 同时受更早 active turn deadline 限制 | 原义保留；配置窗口不能延长 turn deadline、重置 retry deadline 或改变 UNKNOWN 处理 | [R2 继任范围、兼容](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| V4 静态配置可运维调整；R1 指定 `DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS=120000` 过渡缓解 | 仍是 startup-only deployment 值；生效只能走另行授权的舰队窗口，本 PR 无运行时效果 | [R1 第 2 项](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350) |

## 6. Contracts — complete replacement of §5.1

### CTR-527D1-001 — Four independent fields

仍只有以下四种 AgentProcess deadline，不得合并为通用 `timeoutMs`：

| Field | Starts | Ends / meaning | Default |
|---|---|---|---|
| `initializeTimeoutMs` | INITIALIZING，首次 initialize write 前 | READY 或启动失败 | 90000ms，保留 |
| `promptReceiptTimeoutMs` | active turn watermark 建立后、prompt write 前 | exact `session/prompt` receipt | Scheduler 见 CTR-002/003；其他调用 30000ms |
| `turnTimeoutMs` | 同一 prompt write 前 | exact turn terminal 及所需 idle/termination evidence | 300000ms，保留 |
| `shutdownGraceMs` | graceful stop 进入 DRAINING | voluntary exit，逾期后按既有规则 kill/await real exit | 30000ms，保留 |

四个 resolved ms 值 MUST 为正 safe integer，deployment 配置 MUST 在 spawn 前 fail-loud 校验。
Feishu、Binding、Session 及任意消息不得覆盖它们；唯一新增例外为本文 Scheduler receipt 选择。
来源：R2 的 §5.1 整体继任、校验/兼容要求；四字段及起止点来自 V4 原文。

### CTR-527D1-002 — Job field and default formula

Job 的 agentTurn payload 新增可选 `payload.receiptTimeoutSeconds`，与现有
`payload.timeoutSeconds` 同属 per-job 定义；不增加同义 top-level 字段或第五种 process timeout。
这是 R1/R2 指定 per-job 字段在既有 D-009 §3 payload 模型中的落位。

未选中显式 receipt 值时：

```text
effectiveTimeoutSeconds = payload.timeoutSeconds, absent => 3600
receiptDefaultSeconds = max(120, 0.05 * effectiveTimeoutSeconds)
receiptDefaultMs = max(120000, 50 * effectiveTimeoutSeconds)
```

`timeoutSeconds` 缺省 3600 继承 accepted `SCHEDULER_TIMEOUT_OUTCOME_V3` C-025，
因此缺省任务 receipt 为 180000ms；3600s → 180000ms，600s → 120000ms，7200s → 360000ms。
120s 是**默认公式**的下限，不是显式 per-job/deployment 值的新增下限。
来源：R1/R2 公式及 per-job 字段；现有 execution timeout 规则保持不变。

### CTR-527D1-003 — Priority and static compatibility

可信 Scheduler agentTurn 必须依以下顺序选择一次 receipt budget：

```text
1. payload.receiptTimeoutSeconds * 1000, when present and valid
2. retained deployment receipt layer, when explicitly configured:
   a. per-Agent static promptReceiptTimeoutMs
   b. DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS
   c. legacy DSH_AGENT_DELIVER_TIMEOUT, only if the new env name is absent
3. receiptDefaultMs from CTR-002
```

这展开了 R2 的 `per-job > env > 继任默认 > 无`：旧 static override 仍在 deployment 层
内部先于 global env；legacy env 仍按 V4 §5.2 映射。code default 30000 不是显式 deployment
值，不能遮蔽 Scheduler 的比例默认；无更高层值时默认公式必得有限正值，“无”不表示无限等待。
非 Scheduler 调用完整保留 V4 的 static > env/legacy > 30000ms。

per-Agent 文件载体、version、未知字段/Agent/重复 key 的拒绝规则均不变；读取仍只在
process-start configuration boundary，运行中的 resolved deployment config immutable，
不 file-watch、不 per-turn 重读 env 或文件。per-job 选择是 exact scheduled invocation 的
receipt budget，不得回写共享 process 配置或串扰其他 Job/交互 turn。来源：R2 优先级与兼容，
本次交办明确保留静态 deployment 语义；旧层内部顺序来自 V4:874–920。

### CTR-527D1-004 — Validation and exact deadline consumption

显式 `receiptTimeoutSeconds` MUST 为正 safe integer；转毫秒及公式所得毫秒值也 MUST 是正
safe integer。拒绝 0、负数、fraction、NaN/Infinity、字符串及转换溢出，不得把无效的显式值
当缺省值静默回退。Job create/update 在持久化前校验；调度读取旧定义时在 dispatch 前校验，
非法定义不投递。既有 `timeoutSeconds` 和 deployment 校验不放宽。

可信 Scheduler 从所选 Job definition 派生 budget；模型、Session、消息内容不能借此传入
任意 deadline。不得改写已 admission occurrence 的身份、execution deadline 或历史。
在 V4 C-001 规定的 prompt write 边界一次冻结 monotonic absolute deadline，仍受更早 active
turn deadline 限制；retry 不重置，receipt timeout 仍按 V4 进入 UNKNOWN/reconciliation，
不生成 success/failure、replay 或 fence release。来源：R2 校验与兼容、指定 receipt 范围；
exact deadline/UNKNOWN 规则来自保留的 V4 C-001/C-009/C-012。

## 7. Acceptance

各项均为后续实现的验收定义，**本 docs-only PR 不声称已执行这些实现测试**。

| Acceptance | Contracts | Method / environment / inputs | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-527D1-001 | CTR-001,002 | 隔离单测：无显式值，timeout=600/3600/7200/absent；非 Scheduler 对照 | exact implementation SHA、配置、resolved budget、测试 rc | 120000/180000/360000/180000；非 Scheduler 30000；沿用 30000 遮蔽公式即失败 |
| ACC-527D1-002 | CTR-003 | 隔离配置组合：job=90s、static=80000、env=120000、legacy=70000，逐层移除；两个 Job 复用一个 process | 每组合所选 source/budget、process 配置前后快照、rc | 90000→80000→120000→70000→公式；跨 Job/turn 串扰、热重读或丢 legacy 即失败 |
| ACC-527D1-003 | CTR-001,004 | create/update/旧定义 dispatch 的 0、负数、fraction、字符串及 safe-integer 溢出；非法 deployment | 拒绝结果、持久化/dispatch/spawn 计数 | 按各自边界 fail-loud，无静默 fallback、非法 Job 无 dispatch、非法 deployment 无 spawn |
| ACC-527D1-004 | CTR-001,004 | effect-free fake child：冷启动 receipt 延迟 34.5s、timeout=3600；另注入更早 turn deadline、retry、无 receipt | exact clock/receipt/deadline trace、UNKNOWN/replay/fence 读回 | 不再 30s receipt 误超时；更早 turn deadline 仍生效；无证据保持 UNKNOWN，replay=0；延长 turn 或重置 deadline 即失败 |

每个 CTR 均有 Acceptance 覆盖；文档审查和 schema 校验不替代上述实现证据。

## 8. Compatibility, migration and rollback

旧 Job 无新字段可按保留 deployment 值或比例默认解析，无 bulk store 回填；不改历史 occurrence。
未接受前仍以 accepted base 为准，后续实现必须另行 preflight；公开 Job 字段的实际接入及
兼容验证属于该实现任务。回滚实现/配置须遵守其既有发布与旧 reader 约束，本文不授权删除新字段、
丢弃 UNKNOWN 或生产回退操作。R1 的静态 120000ms 缓解需另行生产 mandate，本 PR 不执行。

## 9. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE (Owner-directed clause scope)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this successor)
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
PARTIAL_SUPERSESSION = EXPLICIT_TASK_SCOPED_EXCEPTION (section 3; not whole V4)
CONTRACT_COUNT = 4
CONTRACTS_WITH_ACCEPTANCE = 4
OPEN_OWNER_DECISIONS = NONE_FOR_AUTHORING
NORMATIVE_TBD = NONE
READY_TO_MARK_ACCEPTED = NO (independent review and authorized acceptance required)
NEXT_ACTION = REVIEW
```
