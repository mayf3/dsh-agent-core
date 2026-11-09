# BRIEF-656367CD-LANDING — 终态归类修复落地准备（复用 656367cd，Dev/QA 链）

## 授权与背景
- Owner 2026-11-09 机制审计：安装版 `event-correlation.js` 终态归类缺陷（aborted/disposed → late_completed + exact_turn_end_success）已由监管独立复核；修复 `656367cd` 已在 main（监管 diff 核验：25 行，含 exactTurnOutcome 三分判定 + markExecutionUnknown + terminalReject 信封 + 新依赖）
- 指令："复用已有修复，核对当前安装候选的兼容性和回归范围，再通过原发布链落地，而不是新增一套恢复机制"
- 发布约束（RELEASE-CONVERGENCE-547）：**无可回滚组合**——本候选为前向修复，受控安装由 deploy 链执行，本任务只做**落地准备**

## 任务
1. **依赖闭包核验**：修复引入 `envelopeCarrier/exactTurnOutcome`（state-machine.js）与 `markTransportRetryEvidence`（delivery-resilience.js）——核验安装版（/usr/local/libexec/agent-core/app 同路径文件）是否已导出这些符号；列出**最小文件替换集**（event-correlation.js + 不满足的依赖文件）
2. **安装候选构建**（隔离区，不安装）：基于现役组合（393 基础+081 六文件差量+Gap B+#1374+#1386）+ 最小替换集 = 候选文件清单（逐文件前后 SHA256 + diff 摘要）
3. **Owner 合成反例 RED→GREEN**（隔离沙箱，合成对象）：
   - RED：安装版函数——aborted/disposed → late_completed + exact_turn_end_success（复现缺陷）
   - GREEN：候选版函数——aborted/disposed → **terminated_without_outcome**（无 outcomeEvidence）；completed → late_completed（不变）；failed → late_failed（不变）；null outcome → markExecutionUnknown 路径
   - 回归：正常完成仍完成；UNKNOWN 历史副作用保留语义；不重跑已发生操作
4. **受控安装 runbook**（交付不执行）：排空核验清单（引用 00:12 后活跃 agent 现状）+ 原子替换步骤 + 验证命令 + 回滚说明（注：无可回滚组合——回滚=回退本差量文件集至现役前像）
5. **范围外登记**：优先二（调用方超时生命周期+迟到结果交付）与优先三（长任务接续）不在本任务——引用 Owner 审计原文坐标为后续任务定义

## 完成定义
`656367CD-LANDING-PREP.md`（依赖闭包核验表+候选清单+RED→GREEN 测试原文+runbook）→ 候选文件落隔离区 → commit → push → PR(base main) 不合并。失败即停写 STOPPED-656CD-LANDING.md（失败语义=探索空结果≠失败）

## 边界
零生产写入（不安装/不重启/不改生产文件）；sudo authsvc 只读；合成测试全部用隔离沙箱合成对象（不触真实业务数据）

## 续办补充（v2，2026-11-09 监管裁定）
- v1 停点 = worktree 内 `node_modules` 悬空符号链接（→ /private/tmp/dsh-ekr-p1-new，已被午夜清理删除）与 build.py scratch 路径（node_modules/.cache/...）碰撞。前置事实：h1370-impl worktree 已有同因先例（删悬空链接+npm install 恢复）。
- v2 步骤：① lstat 预检确认 node_modules 为悬空链接（target 不存在）→ 删除该悬空链接（不删目标——目标已不存在）② build.py 的 SCRATCH 路径改为 worktree 本地非碰撞路径（`./.build-scratch/656367cd-landing`）③ 重跑 build → 候选隔离区 → RED→GREEN（Owner 反例）→ 回归 → runbook → commit/push/PR 不合并
- 已核事实复用：最小替换集 = event-correlation.js + state-machine.js（Git656 原始 blob，SHA 已 pin 于 STOPPED §3）；envelopeCarrier 安装版已导出；transport 尾巴不在原 fix 内（选原 Git656 blob 规避）；spawn.js 超范围保留现役
- 失败语义不变：探索空结果≠失败；真实构建/测试失败才停
