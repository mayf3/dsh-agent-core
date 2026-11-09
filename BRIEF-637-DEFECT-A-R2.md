# 合同式交办：#637 R2 —— 依赖面已修复，RED→GREEN 继续（2026-11-07）

## R1 停点裁定（监管）：依赖面机械缺陷，已修复
R1 停点 = 新 worktree 缺 node_modules（croner 不可用）。监管已链接共享 node_modules（/private/tmp/dsh-ekr-p1-new），Scheduler 基线实测可运行。

## 任务（同 R1，全门继续）
1. Scheduler 基线全绿确认（基线计数如实记录）
2. RED→GREEN：普通终态（completed/failed/not_admitted）纳入可结算分类（沿 classifyRouter/结算接口最小修复）
3. 验收场景 3 条全测试 + 既有套件不回退
4. RECEIPT-637.md（RED→GREEN 原文+计数）+ 提交 push + PR 引 #637（gh 超时提交即停）

## 红线
不放宽 UNKNOWN/身份/终止保护；零生产写入；不 merge PR；失败即停写 STOPPED-637-R2.md

## R2 resume coordinates and gates

- Worktree: `/private/tmp/h637-fix`; branch: `fix/sched-classify-normal-terminals`.
- Candidate/base/origin-main at resume: `09e8f34e8563f4d5e0e41ef96f4cdceb7427db84`.
- Resume the R1 `REUSE + BRIEF + DURABLE` implementation preflight in
  `BRIEF-637-DEFECT-A.md`; authority and scope are unchanged. The supplied R2
  task restores the dependency prerequisite, not production permission.
- Fresh unchanged baseline: `npm run test:scheduler`, exit 0, **454/454**, no
  skips/cancellations; raw log `docs/evidence/issue-637/R2-BASELINE-scheduler.txt`.
- Reproduce with real disposable Router and Scheduler files: terminate an
  isolated child immediately after Router `settleDirect`, before Scheduler
  writeback, then reopen both stores and run the real restart sweep/tick.
- Expected defect assertions in the designated RED run are reproduction
  evidence, as in R1. Any unexpected test/gate/delivery failure stops R2 and
  is recorded in `STOPPED-637-R2.md`; a submission timeout is never retried.
- Minimal normalization is after existing owner/exact-correlation checks;
  retain `lateOutcome ?? outcome`, termination-only proof gates and the one
  existing settlement writer. Independent affected-contract review required.
