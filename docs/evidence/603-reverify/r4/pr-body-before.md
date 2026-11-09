CTR-S4 的移植、production-runtime 接线和 watchdog 打包清单已合在本分支；本轮完成 D-009 修订 ACCEPTED 定稿与离线源码交付包。PR base `main`，部署目标线 **`ac1159-deploy`**；不执行合并、部署、重启或启用。

- 最终 HEAD `815ac7c94b1775eec3aa57f19ca8a3842f592217`；tree `93b03891ca30427602a6a2bfa6e78892efb8f6ba`。worktree `/tmp/ctr-s4-prep`，branch `ac-ctr-s4-runtime-prep`；已 push 并远端读回。
- Owner 2026-11-02 裁定原文：**“termination-only 证据判 failed，修订 D-009”**。增补段现为 **ACCEPTED**，Decision index 已同步。保留原文和既有有界政策：recurring termination-only 政策 failed 持久保留 business UNKNOWN，不伪造 executionOutcome；exact current-epoch/identity/coherence、不 replay/retry/catch-up、无记录 UNKNOWN、one-shot HUMAN_REQUIRED 均保留。接受不等于已合入 main/目标线或生产启用。
- 采用 r3 核实源 `825664850abce61e821eb505063241341d419907`；`2d28545b` 是早期 Spec-only 提交。沿用 `8dfd2854` 修复、`4c24a9d5` 单项 decoder pin 和 `e8b086e8` 获批结构登记。本轮 11 文件均为文档/证据/交付清单；packages/scripts/registry 字节未变。

接线保留 Router 精确证据查询、同一 mutateDoc 锁内复验/持久 receipt、committed-ack-loss 回读、audit 失败可见、compose stop/drain 后再释放 Router。flag **默认 OFF**。完整 app installer 复制 package src 并通过共享白名单携带 scheduler-watchdog；旧 23-path overlay 不能代替 CTR-S4 完整 app 发布。

本轮实际验证：
- Scheduler **434/434 rc0**；auto-reconcile + runtime wiring **32/32 rc0**。
- 原421、r2的427、r3的434测试名多重集完整保留；对r3 diff=∅，duplicates=0。
- 最终 exact-HEAD 结构 **rc1 / 11项基座既有目录债，新0**；逐违规元组与 task-base `1921f879` 一致。不是全局结构全绿。
- 实际 package-copy 临时分阶段复制44/50个Scheduler/runtime源文件，逐文件字节相同、排除测试；watchdog两处白名单循环一致。shell/JS syntax rc0。
- 离线 bundle verify、独立干净 clone、archive清单哈希、安装器只读 `--validate-source`、SHA256SUMS 均通过。
- 独立 `/root/authority_review` 对最终 HEAD delta review **PASS / 0 blockers / 0 spec gaps**；源码既有修复复用历史独审，本轮核对未变的测试字节和原始日志，不冒充重跑更广 runtime。

交付目录：`/tmp/ctr-s4-release-815ac7c9`（bundle、tar.gz、manifest、SHA256SUMS、exact-head结构/独审回执）。
- bundle SHA256 `2f89838c9dbf7614f958689c30575d871b678ea36f871d3ca4d71bd2972370be`
- archive SHA256 `059b1d5cf6fa762c726c5c55ad0465e7c72d0562536463dfa07ea956e6874de9`
- manifest SHA256 `df57b31cbb80739bade2f39ef3bc9181591b407476879f0da745b55ff89c97cb`

[交付/启停说明](https://github.com/mayf3/dsh-agent-core/blob/815ac7c94b1775eec3aa57f19ca8a3842f592217/deployment-artifacts/ctr-s4-runtime-prep-v1/README.md) · [文件哈希清单](https://github.com/mayf3/dsh-agent-core/blob/815ac7c94b1775eec3aa57f19ca8a3842f592217/deployment-artifacts/ctr-s4-runtime-prep-v1/source-files.json) · [新鲜验证与原始日志绑定](https://github.com/mayf3/dsh-agent-core/blob/815ac7c94b1775eec3aa57f19ca8a3842f592217/docs/evidence/ctr-s4-delivery/final-validation.json) · [续接报告](https://github.com/mayf3/dsh-agent-core/blob/815ac7c94b1775eec3aa57f19ca8a3842f592217/docs/reports/CTR_S4_PREPARATION_R2.md)

监管启用时将 `AGENT_CORE_FENCE_AUTO_RECONCILE=on` 放进**实际受监督 Runtime 环境**，经已有授权 reload 生效；回滚移除该 env key并经同一路径reload，stop/drain后读回DISABLED。外部shell unset或只编辑plist不改变现有PID。保留UNKNOWN-aware decoder和已提交receipt，停用不抹除历史结算。源码包不含新安装的Node/DSH依赖闭包。

保留限制：与 live main `26178b4f459cdc2737724f6614b5e2bc9bdc77b0` 的既有合并冲突仍在，**MERGE_READY=NO**；26项 broader-runtime 基座失败、两项旧overlay digest漂移未处理。监管先整合并绑定目标候选，再按预授权部署/启用和真实 canary。默认OFF；未部署、未重启、零生产写入、未改共享checkout、未merge/auto-merge、未退役stopgap。#417保持open等待安装/启用/业务验收。
