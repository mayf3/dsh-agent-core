# STOPPED-XATTRFIX-R2

状态：STOPPED_REPOSITORY_INVARIANT_CONFLICT；记录时间：2026-11-04T11:59:30.242007+00:00。

目标 worktree：`/private/tmp/dsh-fleet-window-tools`；branch：`chore/fleet-window-tools`；HEAD/base：`c4152e9a45e2f1798807492c73516d924dcaf855`。
执行器：`scripts/fleet-window/window-executor-v5.sh`；实测 974 physical lines；SHA-256：`7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe`；与 HEAD 字节完全相同。

## 原范围冲突已闭合

`BRIEF-XATTRFIX-R2.md` 是用户当前可归因的执行授权，明确允许 `STOPPED-XATTRFIX.md` 的三处消费者适配。旧 SCOPE_ESCALATION 不再阻断这三处修改。独立只读消费者普查未发现三处之外的新 inventory 消费者冲突。

## 新的精确冲突

阻断分类：REPOSITORY_INVARIANT_VIOLATION；必要拆分另触发当前最小范围的 SCOPE_ESCALATION。不是 xattr 实测失败，尚未写实现或运行合成测试。

1. `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md:25,41,57`：`scripts/**` 在手写代码范围内，文件上限 500 行；执行器为 974 行 `.sh`。
2. 同规则 `:98,103`：任何被修改文件成为 affected surface；被触及的超限文件必须在同一候选拆分或缩减至上限。`:61,64` 的 MUST_NOT_GROW 不构成未登记超限文件的豁免。
3. `scripts/verify-code-structure.mjs:14,70-73,236-242,354-359`：`.sh` 纳入范围；无 registry 行的超限文件产生 `FILE_LINE_LIMIT / UNREGISTERED_LEGACY_TOUCHED`，该文件受影响时进入 candidate violations。这是代码路径推导，不是实际运行 verifier 的失败输出；本轮未执行结构 gate。
4. `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md` 的 `CTR-CSV-003` / `CTR-CSV-004` 也要求受影响的历史 finding 进入 candidate violation。
5. `.agents/structure-registry.json` 无执行器行且无 generated allowlist；固定基线 `d506f81105e8aa05177a01b817ebe11dcc076ba5` 中无该文件。不能通过为这份新入库执行器补登记获得固定基线例外。规则 `:53,68,70,74,101,107` 禁止自改上限、重设基线、候选内补例外或密集压行规避。
6. `BRIEF-XATTRFIX-R2.md:11,18` 限定 xattr + 三处最小适配，并要求“15 节点其余逻辑一字不动”。把单文件执行器拆成每份 <=500 行的模块需要改变其余节点的物理组织/入口，超出本轮明确授权。

规则接受提交 `cb827a696f8cb55927555472fa38ce103592fcdd` 分别为 HEAD 与本地 `origin/main` 祖先（`git merge-base --is-ancestor` 两次 rc=0）；规则已在实施基线，并非未合并候选。`origin/main` 是本地 tracking snapshot，未声称已刷新远端。

用户 AGENTS.md 的原文约束适用："When authority conflicts or drift are found, stop the dependent work and report the concrete conflict"。本轮未用任务、历史工具入库或已存在代码覆盖已接受的约束。

## 最小闭合

需要 Owner 明确扩大范围，授权保持 15 节点语义的执行器拆分并达到结构上限，再继续 xattr 补丁；若仍坚持单文件最小修改，须先完成适用的独立 accepted 规则变更。不能自行放宽红线、重写 authority 或补 registry 绕过。当前授权已足以修复三处消费者，无需重复批准它们。

## 独立复核

非作者只读 reviewer `/root/xattr_scope_review` 核对同一 HEAD、规则接受祖先关系、974 行、registry/allowlist/固定基线缺失及消费者普查，结论一致。
`FROZEN_BLOCKER_UNION = [REPOSITORY_INVARIANT_VIOLATION: unregistered affected executor >500; SCOPE_ESCALATION: required split outside R2 smallest patch]`。

## 停止边界和执行状态

IMPLEMENTATION_ALLOWED=NO（上述结构冲突依赖）；MERGE_READY=NO；PRODUCTION_OPERATION_ALLOWED=NO。
未修改执行器、其余节点、治理文件或旧交接文件；未创建测试树；未运行 helper、xattr、ditto、生产阶段、生产读取或服务访问。仅新增本停点与 `RECEIPT-XATTRFIX-R2.md`。
未 commit、未 push、未创建/更新 PR、未 merge；任务规定失败即停，未把停点文档发布成修复完成。

安全独立检查：原执行器 dry-run rc=0（不调用 stage/helper）；`git diff --check` rc=0。不把原件 dry-run 当成新补丁验收。
