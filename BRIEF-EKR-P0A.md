# 合同式交办：EKR P0-A — 跨 attempt 旧观察提交的 CAS 防护（任务书 #1374 §2）

## 权威输入（先全部读完）
1. gh issue view 1374 --repo mayf3/agent-control ——任务书 §2 全文（反例+要求+回归验收）
2. DEFECT-MATRIX.md G1 双版本对照（docs/evidence/ekr-preflight/ @ main 8011b5a5）——已给完整受影响路径图：
   - 正常 turn 观察: engine.js:254-291 → ledger-records.js:64-88（recordReconciled）
   - stale/run-ended retry: terminal-attempt-operations.js:15-32 → ledger-records.js:100-120
   - escalation: engine.js:88 → ledger-records.js:132-160（lastAttemptId 存档字段未作 CAS）
   - 已有防护参考: recordProgressCheckpoint 已检查 attemptId/reporter；recordStaleSuperseded 已比 state+phase+delivered.atMs
3. 隔离验证经验：两版本 fixture 均实测 committed:true（旧观察被接受）

## 任务（base 8011b5a5，branch ac-ekr-p0a）
1. **现有原子提交边界增加身份 CAS**：recordReconciled 及全部结算类原子提交增加
   `expectedAttemptId` + `expectedGeneration`（从观察者实际读取来源传入，沿真实观察者调用链逐一传参）；
   与当前 record 的 attempt 身份原子比较——不一致返回**可识别 stale observation 结果**（新 action 类型），
   保留旧观察证据、绝不修改新 attempt
2. **观察者侧配套**：正常 turn 观察 / stale retry / escalation 三路径带上各自的 attempt 身份
3. **禁止**：扩大全局锁范围；改 UNKNOWN 语义；动 WAE V3 已接受条款（B1/B2/B4 的 spec 路由另行处理，不在本单）
4. **回归测试（任务书 §2 验收）**：人为控制两个并发观察/推进交错——旧观察提交被拒（stale observation 返回）+
   新 attempt 保持原状 + 同代合法提交通过；覆盖同 phase 不同 generation 与并发调度场景
5. 结构门（全文件 ≤500）+ 既有调度回归 + git diff --check（working+cached）
6. push + PR 引用 #1374 标注 P0-A；**不 merge**（监管验收后代行）

## 红线
不改 15 节点窗口工具；零生产写入；失败或语义不明即停写 STOPPED-EKR-P0A.md（引矩阵行号）
## 回执（RECEIPT-EKR-P0A.md）
base/head SHA、diff 清单、CAS 字段设计说明、回归测试输出原文（含交错场景）、全门输出、PR URL、UNKNOWN

## 当前 PREFLIGHT（2026-11-05）

- schema_version: 2; SPEC_GOVERNANCE_MODE=PREFLIGHT
- TARGET_REPOSITORY=mayf3/dsh-agent-core; BASE_HEAD=8011b5a5e776fa92eba79c1ede067b9e762311f9; isolated worktree=/private/tmp/dsh-ekr-p0a; branch=ac-ekr-p0a.
- GOAL_OR_TARGET=#1374 §2 / matrix G1: old observations cannot settle another attempt; current-gap=phase/state/timestamp CAS omits exact execution identity.
- AUTHORITY_ACTION=REUSE; PRIMARY_AUTHORITY=WAE V3 CTR-WAE-002/004/005 plus SRE V2 CTR-SRE-001/002/003/005 and WEC V3 CTR-WEC1-004/005/008, all accepted in base.
- ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES; IMPLEMENTATION_AUTHORITY=contracts; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE.
- MUTATION_AUTHORIZATION=VALID: user task above and mayf3/agent-control#1374; ISOLATED_WRITE_SURFACE=YES; SPEC_GAP_DEPENDENCY=NONE; IMPLEMENTATION_ALLOWED=YES; OPERATION_ALLOWED=NO; MERGE_READY=NO (user prohibits merge).
- Evidence reviewability=PASS for repository code, isolated real filesystem ledger, raw test receipts; production/runtime/business acceptance remains UNKNOWN.
- Scope: exact attempt ID + attempt generation CAS at external observation settlement boundaries; normal turn, active/terminal stale, run-ended continuation, escalation. Public terminal wrappers also require explicit identity; production private delivery/recovery appenders remain within their existing fresh-read lock.
- RETAIN existing ledger/FIFO/OwnerLock, admission/Owner-resume/quiescence gates, historical generation-1 replay, UNKNOWN and accepted Specs. No parallel store/model or production writes.
- Plan: implement CAS and caller propagation; deterministic concurrent/barrier tests over actual isolated ledger; affected and scheduler regressions; structure + working/cached diff gates; independent affected-Contract review; commit/push/PR only.
- DONE_WHEN=all requested source gates and independent review recorded, pushed PR references #1374 P0-A, receipt binds exact source head and UNKNOWN; no merge.
- EXPANSION_TRIGGER=authority conflict, semantic ambiguity, required gate/test failure, scope beyond G1 or production effect. Stop dependent writes and record STOPPED-EKR-P0A.md with matrix lines 33–41.
- Independent preflight: /root/authority_review supports REUSE/DURABLE; stale identity checked before terminal guard; returned observation evidence plus raw receipt requires no new persistent event type.
