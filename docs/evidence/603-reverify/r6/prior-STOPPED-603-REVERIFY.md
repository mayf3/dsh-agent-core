# STOPPED-603-REVERIFY — R5

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
HEAD = f1b1466b2645ec861c80bcb934db410ff544e6ca
TREE = 2f6d479cc93f885005ff743785a6b5a75909c0c0
SOURCE_PARENT = 87735ecee0e0ebfaa575f889785d7c5037ab9145
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
CACHED_DIFF_CHECK = PASS rc0 (5 exact files / 56 coordinates exempt)
FINAL_INDEX_BINDING = PASS (125 paths; checked tree == commit tree)
DOCS_COMMIT = PASS_LOCAL_ONLY
FINAL_DOCS_HEAD_REVIEW = PASS
PR_HEAD_COMMAND = FAILED rc1, unknown flag: --head
OPEN_BLOCKER = 603-R5-PR-001 / REQUIRED_GATE_FAILURE
DOCS_PUSH = NOT_ATTEMPTED
FINAL_PR_HEAD = ac-ctr-s4-runtime-prep @ 815ac7c94b1775eec3aa57f19ca8a3842f592217
FINAL_PR_STATE = OPEN / merged=false
REMOTE_INTEGRATION_HEAD = 87735ecee0e0ebfaa575f889785d7c5037ab9145
POST_COMMIT_RECEIPTS = LOCAL_UNCOMMITTED
MERGE = NOT_ATTEMPTED
PRODUCTION_WRITES = 0
NEXT_ACTION = STOP
```

- SOURCE：Owner R5 第③步及“失败即停”；现态 schema_version=2。
- COUNTEREXAMPLE：`gh pr edit 603 --head ac-ctr-s4-reverify` 实际 rc1：`unknown flag: --head`。完整 command/stdout/stderr 和 FAILED.json 位于 `docs/evidence/603-reverify/r5/`，原文未修剪。
- IMPACT / affected_readiness：[PR_HEAD_POINTS_TO_INTEGRATION, DOCS_DELIVERY_PUBLISHED, TASK_DONE] = NO。打包门、docs本地commit、独审PASS和原R4成果继续保留；docs尚未push。
- MINIMAL_CLOSURE：Owner 调整平台不支持的第③步并另行续行；不擅自新建/关闭PR、改base或强推旧head。

失败后只补事实收据并只读核对远端与 PR 终态，没有后续门、commit、push 或 PR 写入。R4 原停止记录和收据完整保存在 r5/prior-*；本文件、根完成状态收据及post-commit appendices尚未提交发布，不声称已在f1b1466b中。

八门总表、全部豁免坐标、完整日志链接与最终PR回执见 [RECEIPT](RECEIPT-603-REVERIFY.md)。
