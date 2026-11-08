# D-STORE-QA-547 — v3 STOPPED，当前快照 QA 未完成

本次已消费 BRIEF v3 / Owner Watch3 五点并复核 v1/v2 STOPPED。**没有完成当前快照采集或隔离验证，不是 D QA PASS，不具备生产发布结论。生产切换未执行、不在本任务授权内。**

## 执行坐标与停点

- Repository `mayf3/dsh-agent-core`；worktree `/Users/yanfenma/workspace/project/worktrees/h547-store-diag`；branch `diag/547-durable-store`；执行 parent `c8036802f1543b108eddce3f8fce474bdc2d4d99`。
- integration snapshot `origin/main=95a8e1cb512fc99dc018209d837250dd51b4d08f`；本轮没有 fresh remote-main tip readback，不能将其称为实时 remote tip。本地旧 `main=5c7b62055e40e3ad0c7ec80a2896a51fd0e33814` 未用于 D reader。
- 授权为本次用户 v3 指令与 [BRIEF](BRIEF-547-STORE-DIAG.md)；`PREFLIGHT / REUSE / BRIEF / DURABLE / OPERATION`。不变更 Product Contract，不实现第二份 D，不执行 A 二次手术或 C transport 诊断。
- v3 本地源码核查子任务引用不存在的 `reconciliation/dispatch-faults.js`，`rg` 返回 rc=2。按失败再停，root 停止新鲜采集与离线验证；详见 [停止原文](STOPPED-547-STORE-DIAG.md) v3 及 [错误收据](docs/evidence/h547-store-diag/stop-v3-receipt.json)。这是查询错误，**不是生产 store 失败谓词**。
- 错误精确发生时刻 UNKNOWN；root 固定停点时钟为 `2026-11-08 07:13:49 UTC`，不能回填成错误时间。同一 helper exec 在错误后还完成三条已安排的本地 Spec 读取，均 rc=0；不声称逐命令即时停止。
- v3 生产读取命令=0、生产写入=0、authsvc 调用=0、restart/signal=0、旧 UNKNOWN 重放请求=0。这里的 0 是本次操作边界，不是历史副作用的判定。

## Watch3 五点落实状态

| 要求 | 本轮事实 | 状态 |
|---|---|---|
| 精确白名单与复用 | 按 paths.js + store.js + durable-file.js + index.js 组合规则形成新脚本草稿；旧 v1/v2 原件和 receipt 不改、不重跑、不重采目录 | 已读取规则；草稿未验证/未执行 |
| 当前新鲜一致副本与四条事实 | 尚未发起 v3 采集，也未解析保护副本核实四条异常 | NOT_RUN |
| D 查重 | 已定位 main 中的既有三件套、作者和 PR；公开 open PR 未见重叠实现 | 已完成限定范围查重 |
| 完整离线加载、持续阻断、no-replay、窄容忍 | 未执行任何 constructor、validator 或测试 | NOT_RUN |
| 安全发布条件与交付 | 本报告明确缺项；既有 PR #670 仅交停止证据 | 未达到 QA 完成条件 |

精确消费集合是 `control/turn-recovery-v3.json`，及存在时的 `.faults.json`、`.abandonment-declarations.json`、`.r28-history.jsonl`、`turn-recovery-v3.json.tmp-*`；不接纳 `.lock`、泛 `history`、`.bak*` 或 `pre-fleet-unblock`。这里声明的是授权范围，不是已经观察到的 v3 membership。

保留的 v1 单读 active SHA `85c4b0ce0957c03d6074edd7624ae33e8c2678feb9796087d27c5b7f7cd4b508` 不具一致性证明；v2 active SHA `682f7d8af8c537a341346b880f99ce75135f21ce71e48992a97936f9771a5a2b` 是 07:00:23..24Z 的历史稳定观察，且 v2 范围 FAIL。它们均不替代当前快照。

## 四条文件事实核实矩阵

以下序号仅是用户要求的四个待核槽位，不声称已从当前文件发现四个对象。不会用历史投影或旧矩阵的固定 indices 补充身份。

| 目标 | 精确 handle | 当前文件 SHA / raw-record SHA | sidecar/marker 一致性 | reader 兼容性 | `admissionBlockerForAgent` 实际返回 |
|---|---|---|---|---|---|
| 待核 1 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |
| 待核 2 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |
| 待核 3 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |
| 待核 4 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |

四条内容摘要、字节坐标、原始 tuple、caller correlation 与 UNKNOWN 保留证明均未取得。该表不认证异常数量、三条 legacy 加一条普通 blocked 的组合，或任何个体仍被阻断。

## D 最小候选与重复开发核查

实现 `42487e65b36f049811b0e83f90178510a3da28b7`，作者 `mayf3`；已由 [PR #646](https://github.com/mayf3/dsh-agent-core/pull/646) 合入，merge `bc69bff131c50af7357d39045b6d3084e5fd6fca`，时间 `2026-11-07T04:53:03Z`。PR final head `131cadcd3baf0e745c5d636b86c21eef5dc2e50b`。本次 helper 对 `42487e65`、`95a8e1cb`、执行 parent 比较，三件套内容相同；`42487e65..origin/main` 的三个路径无后续 commit。

路径均以 `packages/agent-router/src/reconciliation/` 为前缀：

| 文件 | 源码观察 | SHA-256 |
|---|---|---|
| `state-machine.js` | :27 窄识别；:169 clear 前检查 settlement/termination，未证实抛 `RECONCILIATION_FENCE_CLEAR_UNPROVEN` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` |
| `durable-file.js` | :211-221 仅豁免 exact legacy tuple 的部分交叉字段限制，其余 schema/cap 校验保留 | `db854ee6061c7f8a56d48f686905d667353c9930bfcd64c95464752075542a1c` |
| `admin-abandonment.js` | :105-115 cleared UNKNOWN 属 legacy tuple 时仍返回 blocker | `62237fb500694f95d894f0f75516ee97fee05cd961971156783120bcbe059710` |

窄 tuple 是 cleared + outcome_unknown + pending query + blocked recovery + exitObservedAt/terminationEvidence/settlementResult 全 null。**不是四条当前记录已匹配的证据。** commit/PR 还含其他改动，不能把完整 commit 说成只有三个文件；三文件摘要也不是可安装制品 pin。

查重时间 `2026-11-08T07:12:08..07:12:31Z`：全部公开 open PR 69 个；超过 100 文件的 #486/#530/#591/#600 已补全分页。未发现触及 reconciliation 源码、`recovery-compat.test.js`、`scripts/availability-recovery/compat*` 的 open PR。未发布工作 UNKNOWN。详见 [candidate-audit-v3.md](docs/evidence/h547-store-diag/candidate-audit-v3.md)。

## 隔离验证输出原文与限制

```text
V3_FRESH_CAPTURE = NOT_RUN
FULL_STORE_CONSTRUCTOR_LOAD = NOT_RUN
FOUR_EXACT_RECORDS_IDENTIFIED = NOT_VERIFIED
CONTINUED_ADMISSION_BLOCKING = NOT_RUN
OLD_UNKNOWN_NO_REPLAY = NOT_RUN
NARROW_LEGACY_TOLERANCE = NOT_RUN
INDEPENDENT_CURRENT_SNAPSHOT_QA = NOT_RUN
PRODUCTION_CUTOVER = NOT_EXECUTED / OUT_OF_SCOPE
```

上面是执行状态声明，没有伪装为程序输出。唯一失败工具输出的逐字原文保留在停止收据。没有测试 stdout、rc 或 validator 成功输出可附。

续办须另有恢复调查指令后才可执行：先审核未执行的 `capture-v3.py`，验证精确 allowlist 反例，复用旧源码 hash，采当前白名单一致副本；用固定 main reader 完整依赖集，只对另一份可写 scratch 实例化真实 store，读取 registry/fault sidecar，逐 handle 核实。构造器会执行 startup recovery 并可能持久化，不能指向采集原件；不能重用旧 runtimeEpoch 或裁 epoch 来制造 PASS。`admissionBlockerForAgent` 只返回同 Agent 首条 blocker，需保留实际 handle，不能假定逐条都独立返回。旧 caller correlation 须通过同一 no-replay 入口验证；缺少 correlation 时明确覆盖缺项。旧固定索引/计数的 sanitized 矩阵不能充当当前快照 QA。

## D 安全发布条件清单

| 条件 | 已满足部分 | 缺项 / 结论 |
|---|---|---|
| 独立 QA | 独立候选源码与公开 PR 查重已执行；停点有复核 | 当前快照四事实、完整加载、持续阻断、no-replay、窄容忍的独立执行证据缺失；NOT_SATISFIED |
| 精确制品 pin | 已固定 source commit 与三文件 SHA | 完整安装包/Node/依赖 manifest、可信 pack digest、目标 loaded bytes 与启动绑定缺失；NOT_SATISFIED |
| 在途排空 | 本次未发新请求或重放 | 旧 worker/已发出 tools 在实际效果边界的终止或隔离证明、写者排空与切换窗口授权缺失；UNKNOWN |
| 回滚方案 | 原始证据保留；已知旧 reader 可能 fail-closed | 精确 rollback 制品、store/sidecar 兼容性、回滚后可用性与不重放方案未核实；不能称 rollback ready |
| 生产操作授权 | 本次诊断权限明确 | 生产切换授权不存在，亦非本次交付；禁止执行 |

`D_QA_COMPLETE=NO; SAFE_TO_PUBLISH=NO; BUSINESS_RECOVERED=UNKNOWN; OPERATION_ALLOWED=NO`（只读诊断停点以后）。保留 UNKNOWN 与历史 fence/evidence；不依据 reader 源码推断现场已恢复。
