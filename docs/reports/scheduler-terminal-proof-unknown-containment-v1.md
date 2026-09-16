# SCHEDULER_TERMINAL_PROOF_AND_UNKNOWN_CONTAINMENT_V1 — Goal Report

- date: 2026-09-16
- base: origin/main `aa4caf449b9e999b0b932a2ab1b0a7768c23f877`
- branch: `goal/scheduler-terminal-proof-unknown-containment-v1`（isolated worktree）
- mode: NO_PRODUCTION_MUTATION / NO_MERGE / NO_DEPLOY / NO_RESTART / NO_RECONCILE / store untouched
- governing authorities（零 Spec 文本改动）：SCHEDULER_TIMEOUT_OUTCOME_V3（C-001/C-003/C-004/C-027/C-028/C-039/C-040/C-044）、SCHEDULER_OCCURRENCE_OUTCOME_V3 (D-009)、AGENT_PROCESS_LIFECYCLE_HARDENING_V2（C-010/C-015/C-016/C-020 — Router 侧冻结约束）

## DEVELOPMENT_PREFLIGHT

改动不被任何新 Spec 文本需要：它是把已 accepted 的 V3 C-004（failed = proven pre-start rejection
或 terminal failure）与 C-028（fence 仅在 unknown 且无 business/termination settlement 时存在）
在 9/16 事故暴露的实现 seam 上落实。被否决并记录的替代方案：直接改 Router child-exit caller
envelope 为 failed —— 被 LIFECYCLE V2 C-016（"不得改写为 ordinary failed"）与 C-020 步骤 4 禁止，
故 Router 零改动，由 scheduler 侧消费 Router 已发布权威面。

## ROOT_CAUSE

9/16 agent 进程 SIGTRAP crash-loop 暴露 Router → Invoker → Scheduler 链路上两个语义 seam：

1. **Bridge 折叠权威结算（SEAM-1，scheduler-router/index.js catch）**：旧规则
   `unknown = explicitlyUnknown || (turnDispatched && !provenTerminal)` 把
   `turnDispatched`（route chain 在 acquire 边界即触发 onDispatch，先于 process admission）
   当作"已开始"，于是：
   - Router 权威 `not_admitted` envelope（Agent/session unknown-fence 拒绝、queue cap、
     draining）→ 被折叠成 outcome_unknown ⇒ 新班次生成第二个 unknown（CONTAINMENT 破坏）；
   - Router 权威 `failed` envelope（structured RPC error response，terminationEvidence=null）
     → 因不在 4 类 evidence 词表 → outcome_unknown（TERMINAL PROOF 丢失，形成 401/429 式
     词表依赖而非 proof 类别判定）。
2. **Scheduler 过早 running 污染分类（SEAM-2，occurrence.js classify）**：
   `record.__started`（由 onDispatch 提前置位）使任何无 evidence 词表的失败都判 unknown，
   连 envelope 明确 `started:false` 的确定性拒绝也被覆盖。
3. **child 真实退出的 proof 不回流（SEAM-3）**：Router 侧 C-016/C-020 冻结语义正确
   （store 结算 `terminated_without_outcome` + `child_real_exit`、caller envelope
   outcome_unknown、fence 同步释放），但 Scheduler 从不消费该权威结算 —— exact turn 已被
   real child exit 证明终止却终局落为 outcome_unknown + fence。

## MINIMAL_FIX（3 文件 + 2 测试文件；agent-router 零字节改动）

- **F1 bridge**（scheduler-router/src/index.js）：C-010 closed-union envelope 透传 ——
  `not_admitted` ⇒ `{status:'error', started:false, routerEnvelope, routerCode}`；
  `failed` ⇒ `{status:'error', routerEnvelope:'failed'}`；`outcome_unknown` 增加 trusted
  readback：经 Router 已发布 `resolveCallerCorrelation`（与 self-ops C-040 同一权威面），
  仅当 exact triple 当前记录 settled `terminated_without_outcome` 且 terminationEvidence ∈
  4 类可信词表且 agentId/callerCorrelation 精确匹配 ⇒ 收敛
  `{status:'error', evidence:{terminationEvidence, source:'router_disposition_readback'}}`。
  pending/restart_lost/evicted/never_existed/late_completed/late_failed/任何 mismatch ⇒
  保持 outcome_unknown（fail-closed 不变；business late outcome 归其授权 seam）。
  无错误码白名单 —— 只信任 envelope 结算类别与既有 4 类 terminationEvidence。
- **F2 classify**（scheduler/src/occurrence.js）：`routerEnvelope` 'not_admitted'/'failed'
  为权威，outrank 过早的 `__started` ⇒ failed（pre-start-rejection / turn-terminal）。
  legacy fail-closed 默认逐字保留。
- **F3 late settlement**（同文件）：接受 `routerEnvelope` 'failed'/'not_admitted' 为
  trusted late evidence（unknown → failed + fence 释放，C-044 自然恢复不变）。
- INVOKE_CONTRACT 文档补 `routerEnvelope`/`routerCode` 字段。

## RED_REPRODUCTION

RED 先行（改动前实测失败）：
- bridge：not_admitted-fence→unknown、rpc failed-envelope→unknown、child-exit readback
  无法收敛 —— 3 RED；
- scheduler：fence-rejected shift→unknown+fence（D）、跨 Job unknown 繁殖（E）、rpc 失败
  →unknown（A）、late failed-envelope 不解 unknown —— 4 RED；
- fail-closed guards（pending/无 readback 面/bare error → unknown；C timeout→unknown+fence）
  RED 阶段即 GREEN，实现后保持 GREEN。

## TARGETED_TESTS / FULL_TESTS

- 新增：packages/scheduler-router/test/terminal-envelope.test.js（7）、
  packages/scheduler/test/terminal-proof-containment.test.js（6）。
- scheduler 338/338 PASS；scheduler-router 29/29 PASS；workflow-execution 66/66 PASS；
  production-runtime test/scheduler 可跑 53/53 PASS。
- agent-router 315/321 —— 6 失败经 `git stash` 在 clean main 逐文件复现，全部 pre-existing。
- 环境预存（与本改动无关，clean main 同样失败）：本机缺 `@larksuite/channel` git 依赖
  （compose-cross-agent-history 文件级加载失败）；`scripts/scheduler-v1-verify.mjs` 的
  fault 词表含 stale 令牌 `STORE_UPGRADE_V1_TO_V2`（测试已更名 V3）。

## INDEPENDENT_REVIEW

独立 semantic review（未参与实现的评审代理，逐项读码 + 复跑测试）：
**SEMANTIC_REVIEW = PASS，BLOCKERS = 0**。要点：每条确定性路径均有 router 权威依据
（closed union 全部产生于 AgentProcess 内部；post-dispatch `failed` 均先 store 结算）；
readback triple 由 minting 绑定且 rebind fail-loud，无碰撞面；`terminated_without_outcome`
唯一 live 生产者是 onChildExit（同步先结算后 reject，进程死亡 ⇒ turn 不可能继续）；
containment 9/16 形状端到端验证；Router 包与 main byte-identical（C-016 合规）；
watchdog/relay/self-ops/deliver 消费面无行为回归。
非阻塞注记（5 条，已记录不处理）：canary fixture 的 failed envelope 无 store 记录
（default-off 测试 seam，语义正确）；pre-start-rejection kind 可能出现于
admitted→running→failed history（双 start 语义的已知表现）；watchLateSettlement 的
not_admitted 接受分支冗余（belt-and-braces）等。

## Terminal state

```text
PRODUCTION_MUTATION_PERFORMED = NO
MERGED = NO
STATUS = READY_FOR_MERGE
NEXT_SINGLE_ACTION = Owner 审定后按 merge gate 流程发起 PR（CODE_REVIEW/SECURITY_REVIEW 通道）
```
