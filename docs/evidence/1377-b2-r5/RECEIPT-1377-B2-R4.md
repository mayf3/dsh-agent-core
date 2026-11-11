# RECEIPT-1377-B2 — R4 STOPPED_AT_REQUIRED_TEST_GATE

日期：2026-11-07，Asia/Shanghai。R4 候选已编写，**必要测试门失败；不是成功交付或审查闭合**。

## 实际坐标与状态

- worktree：`/private/tmp/h1377-b2`；branch：`feat/b2-auto-recovery`。
- 实际 branch HEAD：`77b9644b2a6ff70cb6af2cf00bb134502a0eef8b`，本轮未推进。
- base / fresh current main：`3c1bcf98bc40a2c34cca24f241c87d1b12cea216`。
- 精确测试源码候选：`2419593722d4846ab6eda915e440af0c477c7e1e`，tree `da66e9d5eaf5baa36c2f26112d23d8c6a0c3ce7f`。
  这是隔离临时 index 创建的无引用 review commit object，**不是已提交到分支的交付 HEAD**。
  [candidate.json](docs/evidence/1377-b2-r4/candidate.json) 记录逐文件 SHA-256；
  [source-delta.patch](docs/evidence/1377-b2-r4/source-delta.patch) 完整保存相对 R3 的源码/测试差量。
- route：REUSE / BRIEF / DURABLE / IMPLEMENTATION；用户 R4 + 原 Brief 授权；
  单 worktree、不 rebase、零生产写入、PR 不合并、必需门失败即停。
- 原未提交 R3 收据完整归档为 [RECEIPT-1377-B2-R3.md](docs/evidence/1377-b2-r3/RECEIPT-1377-B2-R3.md)，
  与进入 R4 时实测哈希相同。R3 原证据未修改，STOPPED 历史原文保留。

## 唯一 blocker 的候选修复及权威坐标

选择 **保留原消费者的持久自动触发义务**，不宣称已升级/交接。
权威为 Recovery Liveness V1 CTR-EKRWAE-003:203–205、004:238–239、005:243–255、
007:278–285。§8:160 与 CTR-003:207–215 只给 B1/B4 开放终态追加，WAE V3 E3 保留。

实际链路：既有 poller → reconcileBlocked → 同一 recoverAttempt fresh lock/gate →
ACTIVE 时 recovery_checked append+fsync 持久 refusalSchedule（原身份、CTR-007、consumer、
firstCheckAtMs、intervalMs）→ 原 recovery_refused 终态 → 同一 poller 的只读消费者 →
同 OwnerLock/fresh identity/revision → 目标 Principal resolver / instance detail 只读观察。

终态后没有 ledger append、recoverAttempt 再准入、关闭责任或业务结果写入；原事件、
state/phase/reason、UNKNOWN、原 attempt/request/generation 保留。后续 next-check 从持久
anchor/cadence 重建。读失败、读到原 world 恢复、moved visit、terminal 都保持责任 pending；
消费者无关闭/交接权限，未来合法 Owner/Assistance 移交仍须 CTR-007 的真实证据。
不借用 WEC CTR-WEC1-005 次数耗尽，不新建权限、不触碰 #1379 传输面、不建第二账本。
裸 manual/history refusal 没有该自动 schedule 时不扩展授权来源。

配置仍沿既有默认 OFF。blocked 与 refusal 两类扫描各有 maxRecoveryChecksPerPoll 上界，
合计至多 `2 * budget`（默认 50 项/poll）；新 obligation 首延迟 recoveryRetryDelayMs
（默认30秒）与 recurrence recoveryMaxDelayMs（默认300秒）持久化。单slot节流和轮转仅为
进程内读预算；重启仍由台账重建。后续 observation 是返回的实际读结果，**没有追加持久化**，
最后持久事实仍是 refusal 前 schedule/lastResult，不把运行日志当新责任账本。

## 实测门与失败原文

| 门 | 本轮结果 | 原文 |
| --- | --- | --- |
| 7个变更JS语法检查 | 每项 rc0 | [R4证据目录](docs/evidence/1377-b2-r4/) 的 syntax-1..7.txt |
| diff whitespace | rc0 | [diff-check.txt](docs/evidence/1377-b2-r4/diff-check.txt) |
| 原33 + 新13针对性 | **46 tests / 44 pass / 2 fail / rc1** | [blocked-targeted.txt](docs/evidence/1377-b2-r4/blocked-targeted.txt) |
| observation-cas 原47 | NOT_RUN — 前门失败停止 | R3历史 rc0未冒作本轮 |
| broker 31 | NOT_RUN — 前门失败停止 | 同上 |
| 受影响回归135 | NOT_RUN — 前门失败停止 | 同上 |
| 结构门 | NOT_RUN — 前门失败停止 | 不复用R3结构PASS |
| 正式独立delta / final-head审查 | NOT_RUN；**原blocker未验收闭合** | 静态预核不是正式PASS |
| 分支交付commit / push / PR / merge | NOT_PERFORMED | 实际HEAD仍R3 |

完整针对性命令及 stdout/stderr 原文、candidate source SHA、UTC开始时间和真实 exit code
均保存在日志。原33中31通过/2失败；新增12个责任用例和1个真实进程用例均通过，不能以此
覆盖整门失败。新真实场景实际完成 refusal fsync后SIGKILL → 重启503至少两个cadence消费 →
再重启恢复至少两次读；terminal ledger/Router bytes不变、E3 no-op、零准入均通过。

两条失败：

1. `B2 real SIGKILL after-wal: restart never sends the delivery-domain request`，
   `blocked-recovery-restart.test.js:212`：`actual.errors` 非空。
2. `B2 real SIGKILL after Router acceptance with HTTP ACK lost: restart preserves UNKNOWN and sends no second request`，
   同文件 `:248`：同一错误。

共同实际错误（日志有完整上下文）：

```text
workflow-execution: refusing reconciled for nodeVisit 0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11 — attempt is terminal (state=NEEDS_REVIEW, phase=reconciled)
expected errors: []
actual errors: [workflow-execution: reconcile error ... refusing reconciled ...]
exit_code: 1
```

这是当前候选的必需验收失败；本轮未执行对照重跑，**不将根因擅定为候选引入或旧环境噪声**。
脚本在 rc1 自动退出，未继续47/31/135或结构门。根收到失败后只读提取错误并保存本失败出口，
没有修复源码/测试、重跑或继续正式审查/交付。

## 可恢复检查点与限制

[checkpoint.json](docs/evidence/1377-b2-r4/checkpoint.json) 保存本轮实际状态；
[SHA256SUMS.txt](docs/evidence/1377-b2-r4/SHA256SUMS.txt) 为实测哈希；
[inherited-files.json](docs/evidence/1377-b2-r4/inherited-files.json) 绑定进入时文件。
代码变更限四个 recovery 源文件和三个 observation-cas 测试文件；未改治理、accepted Specs、
依赖/生产配置。源码和测试差量保留在当前工作树，未commit到分支，未push/开PR。

Docker/compose、真实Svc DB、安装启用、live业务/全流程无人值守：NOT_RUN/UNKNOWN。
planned半仍排除，不能声称全量关闭#1377。R3审查B2-R3-REV-001保持待正式验收闭合；
本轮没有新增权威缺口结论。R4只读定位误猜 escalation.js 曾rc1，按机械失败续行定位真实路径；
它不是本轮停止原因。实际停止原因是上述必需测试门rc1。
