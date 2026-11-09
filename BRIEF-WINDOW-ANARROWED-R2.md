# 合同式交办：窗口收窄 A R2 —— oracle 精化（2026-11-06，接 STOPPED-WINDOW-ANARROWED）

## R1 停点裁定（监管）
R1 九项核心断言 PASS（unknown保留/affected blocked/unrelated allowed/global ready/fullRuntime/noReplay/noOutbound/三零尝试/源fixture不变），唯一 FAIL 为 candidateUnchanged/noOverwrite 断言对**启动诊断追加**过严：候选 runtime 向恢复副本追加了 ownership_check/blocked/runtime_restart_ownership_unavailable（append-only；initialOutcome/fenceState/业务字段不变）。裁定：**测试 oracle 精化，非产品缺陷**。

## R2 变更（最小）
1. **oracle 精化**：candidate-state 探针的"不覆盖"断言按字段分类——
   - 必须不变（业务/语义字段）：records[].initialOutcome、fenceState、recoveryState、exitObservedAt、attemptedActions 既有项、bytes 前缀
   - 允许追加（append-only 诊断）：records[].attemptedActions 追加新项、updatedAt、failureReason、top-level runtimeEpoch(s) 切换
   - 追加项只允许已知白名单 action/reason（如 ownership_check / blocked / runtime_restart_ownership_unavailable）；白名单外追加仍 FAIL
2. 其余 R1 六条修订与负向测试**不回退**：R1 已 PASS 的 settlement 负向 suite、bootstrap 回退 suite 原样保留
3. 补跑 R1 未执行的两例：启动失败 suite、旧 v2 reader 用例

## 门
window-selftest.py 全 PASS（含精化后 candidate suite + 全部负向 suite + stdio canary + 结构门）；git diff --check、bash -n、py_compile、dry-run 常规门

## 交付
代码增量提交（branch chore/fleet-window-anarrowed）+ RECEIPT-WINDOW-ANARROWED-R2.md（R1→R2 oracle diff 理由表 + 全门输出原文）+ push + gh PR 引 #605（gh 超时提交即停，推送监管补做）

## 红线
零生产写入；不动既有收据；oracle 放宽仅限上述字段分类，不得放宽业务字段；失败即停写 STOPPED-WINDOW-ANARROWED-R2.md

## R2 接续 PREFLIGHT

`schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; ROUTE_STAGE=IMPLEMENTATION`。
仓库 `mayf3/dsh-agent-core`，隔离写面 `/private/tmp/anarrowed-wt`，唯一分支
`chore/fleet-window-anarrowed`；`REVIEW_TARGET_HEAD=BASE_HEAD=CURRENT_BASE_HEAD=
e61458e0666bc6aa962d31561beeff1ada4a4f56`（继承尚未提交的 R1 增量）。
本用户交办为 attributable mutation authorization；无生产权限、无合并权限。

`AUTHORITY_ACTION=REUSE; AUTHORITY_ACCEPTED_IN_BASE=YES;
IMPLEMENTATION_AUTHORITY=contracts; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
MUTATION_AUTHORIZATION=VALID; ISOLATED_WRITE_SURFACE=YES;
SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE; IMPLEMENTATION_ALLOWED=YES;
OPERATION_ALLOWED=NO; MERGE_READY=NO`（待门及独立审阅）。
主权威继承 R1 的 D-009 §8.4–8.5/§10.2、Timeout V3 C-033/C-038、
ADR D009 alignment CTR-527D2-002/003、Lifecycle V4 C-016/C-019，均存在于基线；
V4 C-019 要求启动恢复 unresolved fence 并在缺 ownership 时输出诊断。
本轮仅修订测试 oracle，不改 accepted Contract 或产品代码。

OBSERVATION：R1 停点及 fixture 只读核对确认全部业务字段未变，只追加已知启动诊断。
durable `records[].bytes` 实为数值型 owned-state 计数：原值3436，经 reader 解码计量3472，
诊断追加后3626（与可信容量函数重算一致）。不把该数值当作任意可变 payload；
严格保存所有非诊断字段与既有 action 前缀，计数变化仅允许诊断追加后精确重算；
独立 admission/jobs 副本和源文件仍须逐字节相等。无新增 WORKING_GUESS。

R1 preimage / hashes：`/usr/local/v5-boot-isolation/anarrowed-r2-42tttior/r1-preimage.json`。
settlement 与 bootstrap 负向 suite 原样 RETAIN；当前 v3/旧 v2 reader 边界 RETAIN；
无新增旧模型或 bridge。selftest 只增加 oracle 绑定/反例，并保护既有 STOPPED-C7 不被覆盖。
EVIDENCE_NEEDED：全部指定门输出、原 suite 哈希、独立受影响面审阅、提交/推送/PR读回。
DONE_WHEN：精化 oracle、两项遗漏用例及全部门 PASS、R2收据、代码提交、push和引用 #605 的PR。
EXPANSION_TRIGGER：实际门失败、权限/合同冲突、业务字段变化或外部提交超时；立即停止下游并写R2停点。
NEXT_REAL_ACTION：冻结最小 oracle 增量，独立审阅，然后顺序执行 gates。
