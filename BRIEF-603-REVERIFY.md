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

## R2 续行授权（2026-11-07）

Owner 本轮明确授权修复独审 `603-REVIEW-001`，保留 `91e224bc` 阶段 A 与现有候选，续阶段 B 的完整门、commit、push 新分支并更新 PR603；不合并、零生产写入。读路径必须纯读，缺证据不得触发格式迁移或归一化落盘；负向用例须实测 V2 文件哈希不变。继续沿阶段 A 的 `REUSE + EXEC_PLAN + DURABLE` 路线，不修改 accepted 产品含义。

最小修复采用 JobStore 现有非迁移分类读取 `_readDocRaw()`；V1/V2 原文不迁移，返回 `UNKNOWN`，只有合法 V3 才进入既有 evidence-gated planner/writer。正式 Scheduler 启动的 C-033 迁移不属于本自动读路径，不更改全局 Store/decoder/normalizer。选定阶段 A 项、全部门与独审通过后提交；任一新的 required-gate failure/权威冲突仍立即停止并保存事实，不自动修复或继续推送。

## R3 续验与交付授权（2026-11-07）

Owner 明确保留 R2 零写修复 PASS、V2 哈希不变负测、独审 PASS 与结构 rc0（0 新违规、28 债）。R2 的 13 项 compose 拒绝归因已裁定为本机 shell 继承代理环境；产品 guard 按设计拒绝，该原始拒绝保留为有效负向证据。本轮使用 `env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy` 子进程前缀续跑变化门及原定剩余 Scheduler、Scheduler-Router、EKR/B2、D-009 和交付门；采用本机已有 `/usr/local/bin/node` v25.6.1 满足现有精确版本守卫，仅调整测试子进程 PATH，不修改主机环境、依赖或守卫。

沿用 `REUSE + EXEC_PLAN + DURABLE`、既有候选及阶段 A。全部 required 门 rc0、证据独审与最终 HEAD delta 复核后，commit 分支 `ac-ctr-s4-reverify`，push 并更新 PR #603 正文说明候选分支与收据；不合并。GitHub 不能改现有 PR 的 head 分支，依阶段 A 的既定处置说明新分支，不强推旧 head。保留原 R2 收据、停止记录及完整原始日志。任何新的非预期 required 门失败仍立即停止后续门、产品写入和推送，只补事实收据；不自动修复。零生产写入，不运行 installer，不部署或启用，不重放 UNKNOWN。


## R4 续验与交付授权（2026-11-07）

Owner 明确授权补全环境清单：所有剩余测试子进程逐一使用完整九键清洁前缀 `env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy -u NO_PROXY -u no_proxy -u NODE_USE_ENV_PROXY`，保留本机已有 `/usr/local/bin/node` v25.6.1 与 EKR exact snapshot SHA 绑定。重跑含原 13 项拒绝的完整变化门，再按阶段 A 顺序执行 Scheduler、Scheduler-Router、EKR/B2 和 D-009 符合性，保存所有原始 stdout/stderr/真实 rc/哈希。保留 R2/R3 失败原文，不修改产品、守卫、主机环境或依赖，不重做已 PASS 修复。沿用 REUSE / EXEC_PLAN / DURABLE、COMPLIANCE；通过全部 required 门及独立 evidence/final-HEAD delta 复核后 commit `ac-ctr-s4-reverify`、push 新分支并更新 PR603 正文和完成收据；不合并、不强推旧 head、零生产写入、不运行 installer。末尾“失败即停照旧”仍是停止边界：任一新的非预期 required-gate failure 立即停止后续门与交付，只补事实收据。

## R5 打包与 PR 收尾授权（2026-11-07）

Owner 本轮明确保留 R4 的 843/843 rc0、原 13 项全过、D-009 独审、源码 `87735ece` 已 push 和 PR603 正文已更新的事实。沿用 #642 同类裁定：verbatim `.diff` 归档的单空格空上下文行、push stderr 原始行尾空格以字节保真优先，豁免 whitespace 检查；精确坐标与理由入收据，其余 staged 文件全量过检。R4 失败门 stdout 对上述字节的逐字回显亦保留原文并单列坐标；不得修剪 raw 日志、不得新增 `.gitattributes`、不得改写 R4 原 rc2。

依次：①按精确豁免重跑 cached-diff-check；②证据与收据 docs commit 并独立 final-HEAD delta 复核；③执行 Owner 指定 `gh pr edit 603 --head ac-ctr-s4-reverify`，目标为 PR 头指向整合分支、旧分支留档；④push 与 PR 终读回（head SHA、state）；⑤完成八门总表、豁免坐标和 PR 回执。不合并，失败即停。此授权不包含强推或覆盖历史 head、关闭旧 PR、另建 PR、部署、安装或生产写入。若指定命令/平台不支持改 head，不伪称成功、不擅自替换操作；保留真实结果并停止依赖交付，只补事实收据。
