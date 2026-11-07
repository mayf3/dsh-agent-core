# BRIEF-DISK-STAGE1 — Agent 磁盘占用只读实证盘点（Owner 三阶段第一阶段, 零删除）

授权: Owner 磁盘治理指令第一阶段(只读实证盘点)+常设授权§2(调查)。**只读——零删除零移动零写入生产面**。
工作面: 本worktree(收据落盘)+全盘只读扫描。
停止条件: 只读任务无失败即停场景, 但权限不足的路径如实记 PERMISSION_DENIED 不跳过不猜测。

## 任务(Owner 第一阶段五项逐项)
1. **同一时点口径核对**: APFS(df/容量)+目录占用(du)同刻采样, 解释当前约47G顶层汇总差额与可能的重复统计(APFS clone/硬链接/快照对du的影响)。
2. **重点追踪**: /private/tmp、Codex preservation(~/.codex归档/rollout)、workspace/worktrees、workspace/artifacts、重复构建目录(node_modules/closure/组装树)——各给体量排行。
3. **preservation 每晚重建根因**: 找出实际创建者/调度入口(launchd/cron/我们自己的轮次?)/保留规则/消费者——如实到进程与配置坐标。
4. **候选逐一检查当前引用**: 进程/调度任务/Workflow/Mandate/PR/Receipt/rollback/正式引用——**不因目录时间较旧就认定可删除**(每候选给"最后引用"证据)。
5. **大文件物理空间判定**: APFS clonefile/硬链接/缓存/独立物理副本区分, 估计真正可释放的物理空间(非表观)。

## 交付(Owner 优先项)
DISK-STAGE1-INVENTORY.md: 空间账单(总量/分域/差额解释)+**前20名可回收候选**(路径/大小/创建者/最后引用/保留依据/可回收理由/预估物理释放/验证方法)+preservation重建根因+GC最小修改建议(第三阶段才执行)。commit新分支docs/disk-stage1→push→PR(base main)不合并。
红线: 只读; 零删除; 生产路径(/Users/authsvc、生产generation、DB、Secret、活跃Agent数据)只统计不触碰。
