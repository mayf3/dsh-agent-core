# AGENT_CORE_SELF_EVOLUTION_PLUGIN_EXPERIMENT_V1 — 最终 evidence correction

> 状态：**VALIDATED_WITH_LIMITS** · 日期：2026-08-16 · 性质：最小真实实验 + 独立 Review 证据修正
> 本版仅修正文档报告（本轮不继续实验、不改插件代码、不实现 Self-Evolution V1）。
> 保留全部原始 evidence，仅对**过度结论**做撤回与降级。

```
AGENT_CORE_SELF_EVOLUTION_PLUGIN_EXPERIMENT_V1
   = VALIDATED_WITH_LIMITS

MEMORY_SOURCE_ISOLATION        = PASS          (fact 不在 new Session history; fact 在 MEMORY.md; model 能从 memory-derived text 召回)
REAL_MEMORY_CONTEXT_PIPELINE   = NOT_PROVEN    (本实验未走 production agent-memory -> systemPrompt.context -> real DSH Session)

TRAJECTORY_REVIEW              = PASS_WITH_LIMITS
REVIEWER_CAN_DERIVE_A_PROCEDURE_FROM_SUCCESSFUL_TRAJECTORY = YES

FILESYSTEM_SKILL_PROMOTION     = NOT_PROVEN
REAL_MODEL_SKILL_REUSE         = NOT_PROVEN
DYNAMIC_SKILL_CATALOG_VISIBILITY = YES          (oskills.register 后 catalog 可见)
DYNAMIC_SKILL_LOAD             = NO             (skill 工具 load 报 source must be a string)

PLUGIN_OPTIONALITY             = PASS

OPENCLAW_MEMORY_MIGRATION_DRY_RUN = PASS
READY_FOR_OPENCLAW_MEMORY_MIGRATION_PILOT = YES

READY_FOR_SELF_EVOLUTION_PLUGIN_V1 = NO

ROUTER_CORE_CHANGE          = NONE
PRODUCTION_RUNTIME_CHANGE   = NONE
KERNEL_CHANGE               = NONE

SELF_EVOLUTION_PLUGIN_DIRECTION       = FEASIBLE
END_TO_END_SELF_EVOLUTION_CHAIN       = NOT_YET_PROVEN
```

---

## 1. 独立 Review 确认项

```
MEMORY_SOURCE_ISOLATED           = YES
REAL_CONTEXT_INJECTION           = NOT_PROVEN
REAL_TRAJECTORY_REVIEW           = YES_WITH_LIMITS
DYNAMIC_SKILL_REGISTRATION       = NOT_PROVEN
FILESYSTEM_SKILL_PATH            = NOT_PROVEN
REAL_MODEL_SKILL_REUSE           = NOT_PROVEN
SELF_EVOLUTION_IS_RUNTIME_DEPENDENCY = NO
OPENCLAW_MIGRATION_DRY_RUN       = PASS
READY_FOR_OPENCLAW_MEMORY_MIGRATION_PILOT = YES
PRODUCTION_CODE_READY_TO_MERGE   = NO
```

## 2. 撤回的过度结论

| 原结论 | 撤权威最终结论 |
|---|---|
| `SKILL_RUNTIME_DISCOVERY = YES` | → `DYNAMIC_SKILL_CATALOG_VISIBILITY = YES`；`DYNAMIC_SKILL_LOAD = NO`（若原意仅为 catalog 可见） |
| `SKILL_USED_BY_REAL_MODEL = YES` | → `REAL_MODEL_SKILL_REUSE = NOT_PROVEN` |
| `READY_FOR_SELF_EVOLUTION_PLUGIN_V1 = YES` | → `READY_FOR_SELF_EVOLUTION_PLUGIN_V1 = NO` |

## 3. Memory 实验 — 明确限定

**已证明（MEMORY_SOURCE_ISOLATION = PASS）**：
- fact **不在** new Session history；
- fact **存在于** `MEMORY.md`；
- model 能从 memory-derived text 召回 `CX airline, seat 43A.`。

**未证明（REAL_MEMORY_CONTEXT_PIPELINE = NOT_PROVEN）**：
`MEMORY.md → production agent-memory → systemPrompt.context → real DSH Session → model recall`
这一条**真实链路本实验未跑**。实验实际走的是：

```
plugin memory/cache (in-memory entries)
   → inline system prompt (memory-derived text 直接拼进 model prompt)
   → llm.stream
```

因此报告明确区分：
- `MEMORY_SOURCE_ISOLATION = PROVEN`
- `REAL_DSH_MEMORY_CONTEXT_PIPELINE = NOT_PROVEN_BY_THIS_EXPERIMENT`

两者**不要混为一谈**。`systemPrompt.context` + `sessions.create` 在本实验中的调用不构成
对真实 production DSH memory 消费链路的证明。

## 4. Reflection 实验 — 明确限定

- Reviewer 确认真实模型 trajectory 被 Reviewer 阅读（**PASS_WITH_LIMITS**）。
- **限制**：trajectory 是插件内存合成的 transcript，**不是**从持久化 DSH session trajectory
  store 读取；且第一次任务本身已得到正确答案（成功 trajectory），非失败→学习。

因此可声明：
- `REVIEWER_CAN_DERIVE_A_PROCEDURE_FROM_SUCCESSFUL_TRAJECTORY = YES`

**不得**宣称：Reviewer 从失败经验自动学习出了新能力。

## 5. Skill 实验 — 以磁盘 evidence 为准（清晰限定）

必须明确记录：
- `oskills.register` 后 catalog 可见（`DYNAMIC_SKILL_CATALOG_VISIBILITY = YES`）
- `skill` 工具 load 该运行期条目失败：`source must be a string`（`DYNAMIC_SKILL_LOAD = NO`）
- 本最终 run `realModelSkillUsedCorrectly = false`

因此：
- `DYNAMIC_SKILL_REGISTRATION = NOT_PROVEN`
- `FILESYSTEM_SKILL_PATH = NOT_PROVEN`
- `REAL_MODEL_SKILL_REUSE = NOT_PROVEN`

原“把 skill body inline 到 prompt 后得到的结果”，**不能算** DSH Skill runtime reuse evidence：
它不是经过 skill-filesystem 发现 → registry → runtime `skill` 工具加载 → 真实模型按 runtime skill
的链路。

## 6. Artifact disposition

| 产物 | 处置 |
|---|---|
| `.dsh/skills/xor-hex-decrypt.md` | **EXPERIMENT_FIXTURE_ONLY** —— 不允许作为真实 project skill 进入 main |
| `experiment/self-evolution-plugin/self-evolution-plugin.host.js` | **EXPERIMENT_REFERENCE_ONLY** |

两者均 **DO_NOT_MERGE_AS_PRODUCTION_CODE**。尤其是 xor-hex-decrypt.md 不能作为真实 project
skill 合并进 main（它是实验 fixture，不是经 skill-filesystem 验证可 load 的正式 skill）。

## 7. 最终实验结论（收敛后）

```
AGENT_CORE_SELF_EVOLUTION_PLUGIN_EXPERIMENT_V1 = VALIDATED_WITH_LIMITS

MEMORY_SOURCE_ISOLATION            = PASS
REAL_MEMORY_CONTEXT_PIPELINE       = NOT_PROVEN

TRAJECTORY_REVIEW                  = PASS_WITH_LIMITS

FILESYSTEM_SKILL_PROMOTION         = NOT_PROVEN
REAL_MODEL_SKILL_REUSE             = NOT_PROVEN

PLUGIN_OPTIONALITY                 = PASS

OPENCLAW_MEMORY_MIGRATION_DRY_RUN  = PASS
READY_FOR_OPENCLAW_MEMORY_MIGRATION_PILOT = YES

READY_FOR_SELF_EVOLUTION_PLUGIN_V1 = NO

ROUTER_CORE_CHANGE          = NONE
PRODUCTION_RUNTIME_CHANGE   = NONE
KERNEL_CHANGE               = NONE
```

## 8. 实验机制与隔离

原始实验载体（外部插件层，非新架构）：
- 真实模型调用 `ctx.llm.stream`；真实新 DSH Session `ctx.sessions.create`；
- `systemPrompt.context` 注入尝试；`ctx.skills.register` + `ctx.shell`（full-access 写文件）。
- 全部在隔离 `.demo/self-evolution-plugin-experiment-v1/` + 独立 worktree；未触碰生产
  MEMORY / skills / DSH Session；OpenClaw 仅快照 dry-run，未写回。

## 9. 下一步（不在此轮执行）

按 Review：当前仅 `SELF_EVOLUTION_PLUGIN_DIRECTION = FEASIBLE`、
`END_TO_END_SELF_EVOLUTION_CHAIN = NOT_YET_PROVEN`。进入 Self-Evolution V1 前需补真实链路：
- memory 走 production `@agent-core/agent-memory` → `systemPrompt.context` → real DSH Session；
- skill 走 skill-filesystem 发现 → runtime `skill` load → 真实模型经 runtime skill 使用。

（本轮按要求：不继续实验、不实现 V1、只修报告。）
