# BRIEF-1377-MINIMPL — 责任收敛最小实现: 接通既有合法消费者((c)合同内缺口修复)

授权: Owner 审查增量②B(原责任链自行补齐)+预授权V1§1。
依据: PR#650 分析(docs/1377-convergence-analysis @ 4928f502, 可只读): (c)合法交接目标已被合同覆盖(既有Owner/Assistance升级, CTR-EKRWAE-007), 缺口=现自动消费者未接通(poller恒返REFUSAL_RESPONSIBILITY_PENDING不接升级入口); **新增系统producer/reason须先接受, 本任务不做**(那是(a)/(b)语义差量线)。
工作面: 本worktree(detach @ main 2d8ce9d0, 含#644+#652)。node_modules已链(只验证)。零生产写入。停止条件: 失败即停写STOPPED-1377-MINIMPL.md。

## 任务
1. PREFLIGHT: 重读PR#650分析§3消费者盘点+LIVENESS CTR-EKRWAE-003/007→冻结DONE_WHEN: REFUSAL_RESPONSIBILITY_PENDING记录接通**既有** Owner/Assistance升级入口(不新增producer/reason/不新增账本/不重放/不伪造结果; 交接=可归属接收+后续处理证据; 送达失败或ACK保留自动责任+下次触发)。
2. 实现: 最小接线+证据字段; 复用#644的义务记录结构。
3. 测试: 新增针对性用例(refused记录→升级入口调用→可归属接收→证据落账; 送达失败→责任保留) + observation-cas全套+blocked-recovery套件+broker 31条rc0(文件展开配方)。
4. engine.js冲突预检结论执行: #1364已合(2d8ce9d0含其整合), 无并行writer冲突。
5. 交付: 分支fix/refusal-consumer-wiring→push开PR(base main)不合并→RECEIPT-1377-MINIMPL.md。
红线: 失败即停; 不动治理文档/.agents/tools; 不rebase; PR禁自合并。
