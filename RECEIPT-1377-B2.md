# RECEIPT-1377-B2 — R5 SOURCE_AND_ISOLATED_VALIDATION_VERIFIED

2026-11-07，Asia/Shanghai。R5 单一回归修复完成；规定测试、结构门及独立受影响合同审查均通过。
R3/R4 停止记录保留；本收据区分源码验收、PR 发布和生产/业务结果。

## 精确坐标

- 唯一写面：`/private/tmp/h1377-b2`；branch：`feat/b2-auto-recovery`；不 rebase。
- integration base / 最近核对 main：`3c1bcf98bc40a2c34cca24f241c87d1b12cea216`。
- 实际源码交付 HEAD：`d3d4410c9184ca5d1c05607c5d47c3ca024b66c8`。
- 精确测试/独立语义审查候选：`ba16e0529a7ac68683d076416106140fdd018009`，tree `13260734c4568b9ccee6e69f63eed060249e5d6a`。
  它是未挂分支的 review object；**不是冒称已发布的分支 HEAD**。
  源码交付提交与该候选的整个 `packages/` 树差量为零，逐文件实测 SHA 在
  [candidate.json](docs/evidence/1377-b2-r5/candidate.json)；绑定见
  [implementation.json](docs/evidence/1377-b2-r5/implementation.json)。
- 本收据与日志由随后文档提交保存；最终文档 HEAD、独立 final-head readback、push rc 和
  base=main PR URL/未合并状态由交付 PR 正文与 GitHub 元数据绑定，避免伪造收据自指 SHA。
  源码 HEAD 与最终文档 HEAD 不混用。
- REUSE / BRIEF / DURABLE / IMPLEMENTATION；用户 R5 + 原 Brief 授权。
  只复用 base accepted Contracts；没有使用 proposed adoption 的原子许可。

## 修复与调用链

R3 blocked-only 自动恢复主体继续保留：既有 startup/poll/reconcile → `reconcileBlocked` →
同一正式 `recoverAttempt` → FIFO/OwnerLock/fresh replay/identity+revision → fresh Router
次级拒绝门与 world gate → 持久 authorization → fresh resolution → 持久 `delivery_started`
WAL → 至多一次首次 admission。原 attempt/request/generation、UNKNOWN 与停止证明边界不变。

R4 持久责任方案保持：自动 world drift 拒绝前，在 ACTIVE、同 ledger/锁内 append+fsync
`recovery_checked.refusalSchedule`，持久原身份、accepted CTR-007、原消费者、首次检查锚点、
正有限 cadence。随后 `recovery_refused` 落终态；原 poller 重启后从记录重建只读义务。
只读消费不调用任何 record port，不写 reconciled/关闭或释放事件，不调用 recovery 或投递。
依赖失败、world 恢复/迁移/终结均保留 pending/UNKNOWN；不假冒 Owner/Assistance 交接。
未来合法交接/关闭仍需 CTR-007 证据。本记录本身承载责任，不靠改写 terminal attempt。

**R5 唯一源码语义差量**位于 `src/ledger-records.js:recordReconciled`：在原 locked mutation
中保留 identity/generation CAS 最先，将已有 expectedPhase CAS 放到 terminalGuard 之前。
旧 ACTIVE 观察落后于另一 writer 的终态落盘时，返回 `committed:false/cause:attempt_changed`，
append/apply 均不发生。明确以当前 terminal phase 追加的 caller 仍由原 terminalGuard
fail-loud；private appender/replay guard 不变，没有放宽终态追加权限。

两条原失败真实进程用例补强断言：首次终态后继续多轮 poll，仅一个 reconciled，ledger 全字节
与终态投影保持不变；原 `errors=[]`、WAL 优先、ACK 丢失 UNKNOWN、零二次投递断言保持。
原 ledger identity 用例另验证同代旧 ACTIVE 观察被 CAS 拒绝，明确终态写仍抛错。

R4+R5 相对 R3 的当前提交改动限 recovery 的四个源码文件、ledger-records 和四个测试文件；
R5 相对 R4 仅一个源码文件及三个测试文件。完整差量见
[source-delta.patch](docs/evidence/1377-b2-r5/source-delta.patch)。未改治理、accepted 权威、
依赖或生产配置；没有第二账本、Scheduler、queue、timer、模型恢复工具或权限扩展。

配置沿用默认 OFF。blocked/refusal 扫描各有 maxRecoveryChecksPerPoll 上限，合计至多
`2 * budget`（默认50项/poll）；refusal 首延迟 recoveryRetryDelayMs（默认30秒），
周期 recoveryMaxDelayMs（默认300秒）。单slot节流和轮转为进程内只读预算；重启责任仍来自
持久 cadence。后续 observation 是实际只读结果，不伪称新持久事件或责任交接。

## 本轮实测门（全部 rc0）

所有原文均含实际命令、UTC 开始时间、stdout/stderr 和真实 exit_code；
[gate-results.json](docs/evidence/1377-b2-r5/gate-results.json) 索引完整命令与顺序。
Node 实测 v26.7.0，原 node_modules 链接可达，未重建/安装依赖。

| 顺序/门 | 实测结果 | 原文 |
| --- | --- | --- |
| 9项 JS syntax + whitespace | 每项 rc0 | [R5证据目录](docs/evidence/1377-b2-r5/) syntax-1..9.txt / diff-check.txt |
| 针对性（原33+R4新13） | **46/46，fail0/skip0，rc0** | [blocked-targeted.txt](docs/evidence/1377-b2-r5/blocked-targeted.txt) |
| observation-cas 文件展开全套 | **93/93=原47+原33+新13，fail0/skip0，rc0** | [observation-cas-full.txt](docs/evidence/1377-b2-r5/observation-cas-full.txt) |
| broker owner-obligation | **31/31，rc0**，含要求的6例 | [broker-owner-obligation-31.txt](docs/evidence/1377-b2-r5/broker-owner-obligation-31.txt) |
| recovery/engine/Owner-resume/control/runtime 回归 | **135/135，rc0** | [affected-regressions-135.txt](docs/evidence/1377-b2-r5/affected-regressions-135.txt) |
| 额外 ledger terminal-refusal 回归 | **12/12，rc0** | [ledger-terminal-regression.txt](docs/evidence/1377-b2-r5/ledger-terminal-regression.txt) |
| 精确候选结构门 | **rc0，candidate violations0，baseline debt28** | [structure.json.txt](docs/evidence/1377-b2-r5/structure.json.txt) |

结构结果为 `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，不声称全仓零债务。
旧部分 observation-cas 单例诊断 sourceSha 仍 UNKNOWN；套件执行命令和 B2 进程 receipt
绑定精确候选，不补造旧单例坐标。未执行已知环境敏感的全仓 node --test 作为新增门。

## 责任与故障实证

- resolution 503 后依赖恢复、调度进程重启，无人工 recover 调用，同 request 首次投递。
- WAL 前真实 SIGKILL 可接续原 blocked；WAL 后 SIGKILL 即使 Router never_existed 也零投递。
- Router 已接纳而 HTTP ACK 丢失再 SIGKILL：重启保留 UNKNOWN、原 receipt/fence、零二次投递。
- 自动/人工跨进程竞争至多一次首次 admission；错误 identity/revision/授权/epoch 和 ordinary
  planned 等负例保持；默认 OFF、UNKNOWN/no fence write 和 fresh lock/gate 保留。
- refusal fsync 后真实 SIGKILL → 两次真实重启（先 HTTP503、再可读原 world），每次至少两轮
  cadence 消费；终态 ledger/投影/Router bytes 不变，E3 no-op、零 admission。
- 新13全部通过；包括责任重建、失败保留、后续 slot、有限预算/公平性、并发安全读和手动历史
  refusal 不被擅自纳入。这里证明原自动责任持续，不伪称人工已接管或业务已完成。

## 独立审查与历史保全

独立 reviewer `/root/r5_independent_review` 未作者被审语义，只读核对 exact candidate、
accepted authority、9个文件 SHA、实际日志与 frozen union；未运行额外测试或写文件。
[审查原文](docs/evidence/1377-b2-r5/REVIEW-1377-B2-R5.md)：**PASS，blockers0/spec gaps0**，
`B2-R3-REV-001=CLOSED_FOR_THIS_SOURCE_CANDIDATE`，R5 terminal regression 同样闭合。
最终文档 HEAD 还须独立 delta recheck；其原文随 PR 正文持久保存。

R3 未提交收据原归档、R3/R4 测试/失败/checkpoint/patch 均逐字保留；R4 进入时当前收据
归档为 [RECEIPT-1377-B2-R4.md](docs/evidence/1377-b2-r5/RECEIPT-1377-B2-R4.md)，实测 SHA256
`fff4eb89b9527a59e5df1920fd63be3f4717a9b63f5dd6102bacd49e5200848b`。
[inherited-files.json](docs/evidence/1377-b2-r5/inherited-files.json) 与
[verification.json](docs/evidence/1377-b2-r5/verification.json) 保留进入时哈希和27项历史原文核对。
原 STOPPED 历史只追加 R5 处置；Brief 只追加本轮授权和预检。root 的机械读取曾猜错两个
文件名，按用户机械失败可继续规则处理；没有 mandatory gate 失败后修复/重跑。另有自加的全暂存区包装 whitespace 诊断 rc2
（Python包装rc1）命中原始日志/patch空白，文档commit未执行；原文保留，
手写文件检查排除raw evidence，不修改归档或源码。此非冻结产品门，详见
[packaging-diagnostic.txt](docs/evidence/1377-b2-r5/packaging-diagnostic.txt)。

## 交付与未交付面

本收据可确认：源码已在 `feat/b2-auto-recovery` 提交为上述实际 implementation HEAD，
规定测试与结构门全部 rc0、受影响合同独立审查 PASS。最终文档提交只携收据/证据/Brief/
STOPPED 历史；源码不再改动。发布顺序为 final HEAD 独立复核 → 普通 push → base=main
PR，**不 merge**；最终完成/远端 SHA/PR 状态以交付 PR 的真实 readback 为准。

ordinary planned 正向恢复仍不在本单，不能声称全量关闭 #1377。
本机真实 file ledger + Router store + child/SIGKILL + loopback HTTP 是隔离机制证据。
Docker/compose、真实 Svc DB、安装启用、生产恢复、跨服务业务及全流程无人值守：
**NOT_RUN/UNKNOWN**。零生产写入；没有把源码/离线PASS提升为 live业务PASS。
