# 合同式交办：窗口执行器收窄 A 修订（Owner 裁定 2026-11-06 第二节点）

## 本轮 PREFLIGHT 与实施顺序

`schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; ROUTE_STAGE=IMPLEMENTATION`。
目标仓库 mayf3/dsh-agent-core；隔离写面 `/private/tmp/anarrowed-wt`，唯一目标
`chore/fleet-window-anarrowed`，父分支 `chore/fleet-window-tools`，两者起点均为
`e61458e0666bc6aa962d31561beeff1ada4a4f56`。分支在接手时已经存在，未重建或覆盖。

`AUTHORITY_ACTION=REUSE; AUTHORITY_ACCEPTED_IN_BASE=YES; PLAN_LEVEL=EXEC_PLAN;
ASSURANCE_LEVEL=DURABLE; IMPLEMENTATION_AUTHORITY=contracts;
MUTATION_AUTHORIZATION=VALID; ISOLATED_WRITE_SURFACE=YES;
SPEC_GAP_DEPENDENCY=NONE; IMPLEMENTATION_ALLOWED=YES; OPERATION_ALLOWED=NO`。
本交办授权本地工具、隔离验证、回执、push/PR；不授权生产操作或合并。
主权威：D-009 §8.4–8.5/§10.2、SCHEDULER_TIMEOUT_OUTCOME_V3 C-033/C-038、
AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1 CTR-527D2-002/003、
AGENT_PROCESS_LIFECYCLE_HARDENING_V4 C-016/C-019；遵守本地恢复与结构约束。
这些文件已在上述基线中；不更改任何 accepted Contract。

实施顺序：并行核查 authority 与隔离测试；调整观察/退出分类及预镜像顺序；
补候选状态加载与当前业务 schema 回退守门；冻结代码后一次执行所列 gates，
任一实际 gate 失败即保存 `STOPPED-WINDOW-ANARROWED.md` 并停止写入后续流程；
通过后做独立受影响面审阅、逐条回执、提交、push 和引用 #605 的 PR。
gh 超时则停止，不盲重试可能已提交的请求。

`DONE_WHEN`：六项裁定落地、指定 gates 全通过、独立受影响合同审阅及回执可复核、
分支推送和 PR 可读回。`EXPANSION_TRIGGER`：真实数据损失风险、authority 冲突、
实际验证失败或外部提交结果未知。H01 批结算入口 RETIRE（封存件 RETAIN），
精确结算与 Agent-scoped fence RETAIN；旧 schema 不能读当前业务态时只允许 forward fix，
不得以旧快照恢复业务状态。生产及业务验收均为 NOT_EXECUTED/UNKNOWN。

## 裁定要点（逐条落实到代码）
1. **quiet 纯观察**：删除 stage_04 内批量结算调用（封存件保留但退出管线执行面）；gate=mtime 静默 + 只读 census 记录；census 非空不阻止进入后续阶段
2. **stage_05 隔离证明**：bootout 后 exit-check 保持 PID/端口消失证明；census 结果**分类记录**："可隔离历史"（fenced/blocked/旧 epoch/exitObservedAt=null 的既有记录）vs "仍可执行/无法证明停止"——只有后者 STOP
3. **stage_05b 证据合同**：settle_unresolved_runtime_down.mjs 只结算满足 D-009 精确证据合同（同 epoch+exitObservedAt+attemptedActions exit_wait succeeded/child_real_exit+无冲突）的记录；unproven 剩余=保留进新运行时并记录回执，**不作为安装阻塞**
4. **候选状态加载验证**（新增 stage）：隔离双前置中用真实状态副本（脱敏记录）启动候选 → 验证：原 UNKNOWN 保留、admissionBlockerForAgent 按 Agent 拒绝受 fence 影响 agent 且不误伤其他 agent、不重放不覆盖；参考 main Router packages/agent-router/src/reconciliation/admission.js 的 agent-scoped 机制（审阅已验证该机制存在）
5. **预镜像前置**：stage_06 的全树 ditto 移到 bootout **之前**（运行时存活期树静态），bootout 后仅做 inventory 漂移复核再安装
6. **负向隔离测试**（window-selftest.py 扩展）：活 worker 场景、跨 epoch、exitObservedAt=null、内存/磁盘双写者竞态、部分结算失败、启动失败回退路径、D-009 v3 durable schema 版本边界（旧实例读不懂新状态时不得用旧快照覆盖现有业务状态）

## 已知机制事实（审阅验证，直接引用）
- last-writer-wins：磁盘结算后原运行时再持久化会复活 blocked 记录（合成复现）
- 05b hasExactExit 三例：同 epoch 精确退出=true；缺 exitObservedAt=false；旧 epoch=false
- main Router 加载旧 UNKNOWN：globalStoreReady=true、原 agent blocked、其他 agent 不受影响、字节不变
- R76 blocked 记录属于旧 epoch 2cf50faf（census epoch 1f3677ab）
- #625 是 Workflow 对 Svc 读取失败的持久责任，不是 Router store 修复

## 工作面
- 分支 chore/fleet-window-tools（基线 e61458e0 已含 f6a1f77a/23fb91a6 钉针 + H01 封存）；在其上新建 chore/fleet-window-anarrowed
- 门：window-selftest.py 全 PASS（含新负向测试）+ executor --dry-run 边界更新 + /bin/bash -n + helper py_compile
- 交付：RECEIPT-WINDOW-ANARROWED.md（逐裁定条款→代码坐标映射表）+ push 分支 + gh PR 引 #605（gh 超时提交即停）
- 明确不做：不执行任何生产阶段；authority/窗口方案（Execution Mandate）另行走监管流程

## 红线
零生产写入；不动生产收据与既有证据；失败即停写 STOPPED-WINDOW-ANARROWED.md；apply_patch 锚点完整行
