# EKR-preflight-r3 执行回执

STATUS = COMPLETE

本回执对应 [R3 mandate](../../../BRIEF-EKR-PRE-R3.md) 与 [agent-control #1374 §1](https://github.com/mayf3/agent-control/issues/1374)。原 [STOP R1](../../../STOPPED-EKR-PRE.md)、[STOP R2](../../../STOPPED-EKR-PRE-R2.md)、[原回执](RECEIPT-EKR-PRE.md) 均保留，不改写历史失败。本次只读预检的完成与 #1374 产品修复、持久存储故障回归、独立发布和业务验收分别记录。

## 坐标、授权与实际写入面

- worktree：`/private/tmp/dsh-ekr-preflight`；branch：`ac-ekr-preflight`；初始 HEAD / integration base / fresh remote main：`eb8fd18934d827cec98faacaef987869c5cb92e7`（M）。
- 部署源码对照 D：`fa4510beb6b01e5c40000a2ae36a62c526759e76`。仅 git archive 源码对照，本轮未重新访问 live 树、生产状态 API、plist 或运行进程。
- Svc 静态对照：`59daec042786f0416a6a9061c0b638ba56c0d83e`；不是对 Svc 已部署版本的声明。
- `SPEC_GOVERNANCE_MODE=COMPLIANCE`；`AUTHORITY_ACTION=REUSE`；`PLAN_LEVEL=BRIEF`；`ASSURANCE_LEVEL=ROUTINE`。原 Brief 覆盖精确任务与坐标，不新建产品 Spec。
- accepted Product Architecture、WAE V3/WEC V3/SRE V2/Owner V2 与 D 对应前代分别核查；authority/source bytes、Git blob、运行版本、archive 哈希见 [r3-coordinates.json](r3-coordinates.json)。
- 用户明确授权修脚手架、报告续写、commit/push、创建引用 #1374 的 PR；禁止 merge、产品源码/配置修改、生产写入。本次写入仅根 Brief/历史 STOP 的入库及 `docs/evidence/ekr-preflight/` 报告和隔离 harness。没有启动服务、真实 Router 投递、DB 操作、UNKNOWN 重放或生产 agent 派发。

## Harness 修复

原 B4 命令从上一轮真实工具调用恢复，原文在 [before](b4-harness.before.py.txt)，修复在 [b4-harness.py](b4-harness.py)，精确差异在 [b4-harness.diff](b4-harness.diff)。先替换 REV，再注入 SOURCE，防止污染 `NEEDS_REVIEW`；新增子进程非零返回码传播。没有重新执行已知损坏的旧脚本。

```diff
-""".replace('SOURCE',json.dumps(src)).replace('REV',json.dumps(rev))
+""".replace('REV',json.dumps(rev)).replace('SOURCE',json.dumps(src))
+ if p.returncode != 0: raise SystemExit(p.returncode)
```

`before` SHA-256：`79f7514e23b2b9fdb614b1e39e6e0a1adfdc2b262432978b790755fdc3af0d2e`；修复版 SHA-256：`20aacf865d552209fb70dfda1572b052852da31b2cf50683f982ae4fbeed0065`。

## 各组结果与原文

[矩阵](DEFECT-MATRIX.md) 原始前 29,999 字节保持不变（SHA-256 `94826f2b25bb60905cd04289c73f12abad2d1d097c62a109b2b449141563973d`），R3 结果仅从 §9 追加。以下原文文件是本回执的组成工件，完整保留 stdout/stderr、失败与有效重跑；不以截断摘要替代原始结果。

| 组 | 已执行结果 | 原文与解释 |
|---|---|---|
| G1 / P0-A | 沿用原双版本函数 fixture；本轮未重跑，未修改原文 | [原回执 R1](RECEIPT-EKR-PRE.md)、矩阵 §3/G1 |
| G5 / B4（先执行） | M/D Node rc=0；缺基线 unavailable，同 visit 版本升降均 progressed | [原文](g5-b4.raw.txt)、[harness](b4-harness.py)、矩阵 §9.1 |
| G2 / B1 | M/D Node rc=0；503 seam 后 NEEDS_REVIEW，依赖恢复/内存重建后候选与再读均 0；正常 moved visit→SETTLED | [原文](g2-g4.raw.txt)、[分组解释](G2-G4-R3.md)、[harness](g2-g4-harness.py) |
| G3 / B2 | 同版三次 poll 均保留 blocked；显式恢复九种 gate 仅完整健康 case 原 request 投递一次 | 同上；不会把 fixture-authority 当真实授权 |
| G4 / B3 | planned / deliver-entered / accepted-without-receipt 三处内存暂停重建，均 delivery_unverified、0 新投递，未对账原 receipt | 同上；真实进程崩溃、文件存储及 M Owner-resume 专门路径未测 |
| G6 / P1-A | M pre-plan 和 M/D exception 队首预算反例；tail control 只证明发现候选；wake pending/settled failed 均按 ACK 复用 | [原文含三次 harness 失败](g6-g7.raw.txt)、[分组解释](G6-G7-R3.md)、[harness](g6-g7-harness.py) |
| G7 / P1-B | M 真实 Core guard + 独立 Svc 响应桩；UNKNOWN 类 0 写，原成功 replay 仍发一次 POST；D 无 managed bridge；Broker M119/D110 operation 清单 | 同上；独立 fixture 不构成连续 response-loss/持久去重证明，所有工具候选分类均 UNCERTIFIED |
| G8 / 调度 | M/D Node rc=0；遗留 admitted/running→UNKNOWN+fence；正常 every slot 一次桩投递，同 slot/第二内存 engine 不重放 | [原文](g8.raw.txt)、[完整状态表](G8-R3.md)、[harness](g8-harness.py) |

G6 更正：旧 §3/G6 和部分 raw 将 D 的 synthetic pre_plan shape 当作实际 pre-plan 分支，R3 已撤回该解释。D 无该分支，这个不适配 fixture 是 engine_error，不用于证明 D 的 pre-plan 缺口；D 公平性结论仅依赖实际异常捕获/预算源码与 throw/control 观察。旧 raw 的 healthyTailReached 只代表 sentinel 触达，不能称健康业务已准入。

G8 更正：D 虽缺 M-only 的额外 auto-reconcile mount，两个版本的 Scheduler 内置 tick 都有 exact Router readback 消费者；不能说 D 完全没有自动读回。普通 settle probe 仅依赖 visibility/current visit，is_terminal 属于 stale probe 的 progressed 分支，不混为 same-visit terminal→SETTLED。

有效执行坐标和退出码：G2–G4、B4、G8 两版均完成整组 Node rc=0；G6/G7 采用保留历史的分段有效证据：M full run rc=0 + M tail control rc=0；D fairness/wake/inventory 完成后 transport 布局装载失败，再对受影响的 transport-only 定向重跑 rc=0。D 非法 pre-plan fixture 已明确排除。没有宣称整个执行历程零非零返回。

复现入口（默认 stdout，Python 传播 Node 失败码）：

```sh
python3 docs/evidence/ekr-preflight/b4-harness.py
python3 docs/evidence/ekr-preflight/g2-g4-harness.py
python3 docs/evidence/ekr-preflight/g6-g7-harness.py
python3 docs/evidence/ekr-preflight/g8-harness.py
```

`rc=0` 是当前源码观察断言完成，仍成立的反例和 accepted 语义限制未被产品修复。所有 mutation/Router/Principal/Svc/store seam 都是内存替身；原源码归档没有解压到源码目录。

## 停机纪律与探索错误

本轮按 R3 四类条件裁定。路径定位的非零、harness 装载/模板错误和工具派发噪声均记录并在允许范围修正；不将其隐去为零失败。已解释的当前产品反例记录为现状，不把 current-behavior assertion 成功当成产品目标通过。

主审探索噪声见 [坐标记录](r3-coordinates.json)：一次猜测 Spec 路径不存在、工具调用 aborted before dispatch（原始命令读取和一次 mailbox wait）、一次 zsh 无匹配 glob；均未触及生产。分组探索和 harness 失败原文保留于各组记录。

## UNKNOWN 与完成边界

真实 HTTP503、文件 ledger/fsync/torn-tail/跨进程交错、真实进程崩溃和重启、可信隔离 DB 事务/并发、Svc effect 丢回执原子性、跨服务 E2E、live 加载身份/配置/积压/业务结果均未执行或 UNKNOWN。HUMAN_REQUIRED 的可靠人类通知、经过认证的答复、验证和重新唤醒纵向闭环不能因存在 API/源码片段而视为通过。外部 native shell/file/MCP/动态插件能力全集与启用状态不在 bounded Broker manifest 清单内，保留 UNKNOWN。

`attempt.generation`、Router `processGeneration`、runtime epoch 分别属于不同身份域；业务 effect/operation identity 也不等于每次调用或 request key。当前 managed Core guard 的内存 seam 证据不能替代 Svc 数据库中“只产生一次真实效果”的证明。

## 交付与检查

PR URL：[mayf3/dsh-agent-core#621](https://github.com/mayf3/dsh-agent-core/pull/621)，draft/open，创建回读 merged=false。引用 mayf3/agent-control#1374。仅创建 PR；禁止 merge。

已执行治理完整性校验：`python3 .agents/tools/verify_governance.py --target .`，rc=0，原文 `vendored governance bytes match governance.lock.json`。结构 gate、PR 和最终 readback 见下文。


预检定稿：矩阵 §9.5 `R3_FINAL_STATUS=COMPLETE`。G1 沿用原证据；G2–G8 在本次只读源码/内存范围已完成处置。Svc intent7/effect5/Assistance4 与派生责任的清点在 G6/G7 末表；Core WAE 与 Scheduler 五态在 G8。已解释的无消费者/无可靠触发格子明确标注 UNKNOWN，不以“完整表”声称自动恢复实现完整。


独立受影响工件审查：

- [REVIEW-R3.md](REVIEW-R3.md)：非作者审查 G2–G4/B4 及最终整合；仅对已声明证据范围负责。
- [REVIEW-G6-G8-R3.md](REVIEW-G6-G8-R3.md)：非作者审查 G6–G8，三项证据归因/边界/分类更正均已闭合，开放 blocker=0；没有重跑未变测试。

机械检查见 [r3-checks.json](r3-checks.json)：仅授权路径新增、tracked 产品 diff 为空、原矩阵前缀哈希一致、43 个本地链接全部可达、4 个 harness 在内存 compile 语法检查通过且无 pycache。产品 suite 未运行；本次报告/harness 不修改产品行为。最终 artifact manifest 与 Git/PR fresh readback 在交付阶段补入。


交付回读：

- 初次证据提交/push：`99d5986ffcf5969a9cb6c33726b0286704df5140`；26 个任务 Brief/历史 STOP/证据工件，0 产品源码/配置变更。远端 main fresh readback 仍为 M；无 force push、merge、rebase、reset 或产品 refs 操作。
- [r3-pr-created.json](r3-pr-created.json) 保存 PR 创建时 base/head/open/draft/未 merge 回读。此后本分支只补 PR URL、结构检查 raw、机械回执/独立 recheck 和哈希清单；分组报告/harness/raw/矩阵语义均不改。
- 结构检查命令：`node scripts/verify-code-structure.mjs --base eb8fd18934d827cec98faacaef987869c5cb92e7 --head 99d5986ffcf5969a9cb6c33726b0286704df5140 --json`；rc=0，`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，既有 baseline debt=29，不是全库零债务。原文 [r3-structure.raw.json](r3-structure.raw.json)。后续仅报告 metadata 变更，通过独立 delta review 绑定，不因 SHA 变化重跑不受影响的产品测试。
- [r3-artifact-hashes.json](r3-artifact-hashes.json) 逐文件记录实测 bytes/SHA-256（清单排除自身）。最终 Git/PR head 以完成后的 fresh readback 绑定；回执不自嵌自身提交 SHA。

DONE_WHEN_MET=YES（R3 §1 预检和 PR 交付）；PRODUCT_IMPLEMENTATION_STATE=NOT_STARTED；VERIFICATION_STATE=PARTIAL（真实持久/进程/DB/E2E 未执行）；PRODUCT_CONFORMANCE=UNKNOWN；OPERATION_COMPLETE=NOT_APPLICABLE。除本任务已授权的 GitHub 证据分支/PR 外，生产状态零写入；此 COMPLETE 不授权产品修复、merge、部署或业务恢复。
