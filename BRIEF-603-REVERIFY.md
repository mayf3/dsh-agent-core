# BRIEF-603-REVERIFY — CTR-S4 整合重验（V3+verifier 就绪后, Owner 已授权独立任务）

授权: Owner 处置#2("之后由独立任务完成verifier适配及#603重验"); verifier适配已合(#645)。
权威要点(重验基准): D-009 终裁=main 现行 alignment(#610: termination-only保持outcome_unknown+terminationSettlement投影)——**分支上的 D-009 增补段(termination写failed)已被裁定取代, 不得重新引入**; V3 为现行结构权威(#642); verifier 已适配退役后生命周期(#645)。
工作面: 本worktree(detach @ main 1ff1e81c)。零生产写入。停止条件: 失败即停写STOPPED-603-REVERIFY.md; 权威冲突即停。

## 对象
- PR #603: 分支 ac-ctr-s4-runtime-prep @ 815ac7c9(base 26178b4f, OPEN); 分支领先其base 18 commits, 落后 main 344 commits。
- 历史脉络: R系列曾推进到468/469+全门; 因D-009权威冲突/V2结构门停点多轮; Owner最终裁定走V3路线。

## 任务(两阶段)
**阶段A 只读评估(先出报告再动手)**: 逐个检视分支18 commits, 三分类:
  a) 仍相关(CTR-S4运行时准备中未被main后续工作覆盖的部分)
  b) 已被取代(D-009增补段=死条文; 与main已有实现重复的)
  c) 需适配(相关但架构已演进: B2自动恢复/fence治理R1-R4/EKR批均在main)
  产出: 整合计划(每commit去留+理由+依赖), 写入评估文件后再执行阶段B。
**阶段B 整合+全门**: 按 plan 将仍相关部分整合到新分支(ac-ctr-s4-reverify, 自main); 适配当前架构; 门: 结构门V3(适配后verifier)+Scheduler全套+EKR套件+D-009符合性(零termination→failed写入路径)+新增/变化测试rc0原文; push 更新PR#603(head或新分支说明), **不合并**。
完成定义: 阶段A评估文件+阶段B收据 RECEIPT-603-REVERIFY.md(逐commit处置+全门rc原文+HEAD SHA+未覆盖面如实)。
