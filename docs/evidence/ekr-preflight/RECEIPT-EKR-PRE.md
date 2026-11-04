# Execution Kernel Reliability V1 §1 — 执行回执

STATUS = STOPPED / INCOMPLETE

本轮依“失败即停”终止。交付的是证据停止快照，**没有完成完整 defect-matrix 验收，也没有授权或执行实现/部署**。主记录：[STOPPED-EKR-PRE.md](../../../STOPPED-EKR-PRE.md)；发现：[DEFECT-MATRIX.md](DEFECT-MATRIX.md)。

## 1. 授权、实际动作与坐标

用户授权：只读源码核查、两个版本对照、指定证据报告；禁止任何源码/生产写入。实际源码和治理读取、issue 只读取回、少量纯内存函数验证、选择性 live 文件哈希比较均在此范围内；没有恢复、投递、重试、故障注入生产或读取进程内存。

| 项目 | 实测/执行记录 |
|---|---|
| worktree / branch / HEAD | `/private/tmp/dsh-ekr-preflight` / `ac-ekr-preflight` / `eb8fd18934d827cec98faacaef987869c5cb92e7` |
| origin/main 与远端 fresh main | 开始时均为上述 HEAD；`git ls-remote origin refs/heads/main` 只读；没有 fetch/reset/checkout |
| deployed source | `fa4510beb6b01e5c40000a2ae36a62c526759e76`；本地 git object 可读取；三个 plist 仅取该声明键 |
| svc current main | `59daec042786f0416a6a9061c0b638ba56c0d83e` fresh ls-remote；本地 checkout `88ff8145eb0842b4ce759117caf4b05f9012ebdc` 未当 main；其治理由分组只读读取 |
| 任务书 | `gh issue view 1374 --repo mayf3/agent-control --json ...`，`updatedAt=2026-11-04T15:41:55Z`；全文已读 |
| 审计关联 | 已读 #1363、#1354、#1364、#1366、#1367、#1358；仅引用其明确范围，未复制旧 PASS |
| 源码方法 | `git archive` → Python `io.BytesIO/tarfile`；原函数内存提取，不解压源码、不 import 有 I/O 副作用模块 |
| live readback | 仅文件/plist；真实源码根为 `/usr/local/libexec/agent-core/app`；选择性 hash 见矩阵 §5；不是全树或加载证明 |
| 执行分工 | 三个只读子审计：G1/G2/G4；G3/G5/G8；G6/G7/Owner 状态；主审负责权威、live 选择性比对、H04 和汇总。未向生产 agent 发送任务。 |
| 写入面 | 本轮只新增根 STOPPED 以及本目录两份报告；既有 `BRIEF-EKR-PREFLIGHT.md` 不改；无源码/测试/配置/refs 写入 |

源码归档本轮内存 SHA-256：

```text
main 33228800 bytes b53ae4ea81addccab7568677a2a74b810de943450c9076a24e42c39eeac1f98e
deployed 19681280 bytes dab4b1a2d7a23ff60ad932fca3a53d7edc167214886d566fb49872b76b81d8f7
```

分组报告已在 STOP 后停止所有新核查；后续只汇总停止前记录并机械校验报告，不补跑失败的 harness。

## 2. 八组验证清单及对应矩阵

“覆盖”是证据覆盖，不是产品通过。每组的 currentCommit / existingContract / reproduction / severity / affectedPath / proposedMinimalChange / regressionTest 均在矩阵 §3 对应组内。

| 验证清单 | 已取得 | 未完成/状态 | 矩阵引用 |
|---|---|---|---|
| G1 P0-A | 双版本 settlement/stale/progress/recovery/retry/escalation 调用定位；phase-only fixture | 旧代交错真实 ledger/多进程未跑；stale timestamp/escalation 未动态复现 | DEFECT-MATRIX §3/G1 |
| G2 B1 | 双版本 unavailable 分支、候选排除、现有 accepted 保守语义 | 真 HTTP503/依赖恢复/重启 E2E 未跑 | §3/G2 |
| G3 B2 | 双版本 recoverAttempt 实现/导出/转发/测试命中普查；无正式自动调用者 | live blocked census、受权自动恢复未验证；语义需正式变更 | §3/G3 |
| G4 B3 | WAL/fsync/delivery_started 与普通 planned 分类；main Owner-resume 特例 | 三位置真实进程故障、原发送 receipt 对账未跑 | §3/G4 |
| G5 B4 | 双版本 baseline/version stale predicate；恢复路径缺基线的静态定位 | **新内存 harness rc=1，未执行断言；触发 STOP** | §3/G5 |
| G6 P1-A | Core D01 条件与 wake ack；Svc producer/error、通知/outbox/吸收态静态链 | HUMAN 答复/验证/重唤醒未普查完；动态公平性/DB 未跑 | §3/G6 |
| G7 P1-B | M managed effect/receipt 与 D 文件缺失、fixture-only 区分；Svc schema/核心事务 | 外部工具全量三分类、丢回执/DB并发/跨服务未跑 | §3/G7 |
| G8 调度契约 | WAE 主要状态、Scheduler restart fence、Owner 部分状态；M H04 mount 内存复核 | 全部非终态×消费者×权限×触发×关闭完整矩阵未完成；真实重启未跑 | §3/G8、§4 |

## 3. 已执行隔离结果原始摘要

### R1 / settlement、503 分类与候选筛选（两个版本各 Node rc=0）

```json
{
  "sourceSha": ["eb8fd18934d827cec98faacaef987869c5cb92e7", "fa4510beb6b01e5c40000a2ae36a62c526759e76"],
  "testName": "in-memory-extracted-settlement-and-candidates",
  "faultInjection": "old observation after fresh generation; unavailable/http503; planned/started without delivered linkage",
  "initialState": "fixture generation2 ACTIVE with same phase as held generation1 observation; settled turn/read unavailable; planned or delivery_started without linkage",
  "expectedSafeTarget": "old observation rejected; same generation accepted; unknown outcome never replayed; future authorized readback responsibility remains discoverable",
  "actualResultPerVersion": {
    "oldCommitAccepted": true,
    "sameGenerationAccepted": true,
    "unavailableVerdict": {"state":"NEEDS_REVIEW","judgment":"settle_check_unavailable","reason":"http_503"},
    "automaticCandidateCounts": {"active":0,"stale":0,"runEnded":0},
    "plannedJudgment":"delivery_unverified",
    "deliveryStartedJudgment":"delivery_unverified"
  },
  "nodeExitCodePerVersion": 0
}
```

M 提取原 `recordReconciled` 函数，通过 data URL 加载；D 类方法仅将 this/private receiver 等义适配为注入 ledger/io。假 mutate/Map/clock，无文件或服务；query/judgment 原函数提取。适配函数 SHA-256：M `ec1c64efac152e7dfaf651c96ec9f36aad2bfc03a89ee08812e7ae46df407b78`；D `45fe9d062eeef2ff24ff90dc882a338c03ee98f8bce6929251d747a0adf3fab9`。

**证据更正：** 子审计原展示标签 `wrongAttemptEventId=attempt2` 来自 fake io，不是真实 ledger 字段，已排除在正式结果外。真实初始 settlement event M `ledger.js:405` / D `:599` 只有 nodeVisitId/atMs，后续不写 attemptId/generation。有效结论是旧观察在 fixture 被接受并结算 fresh attempt，不是声称读取到了真实事件中的 attempt2 字段。

R1 不是 HTTP fault injection、真实文件 ledger、多进程或跨服务验收。Node rc=0 表示反例观察脚本如期执行，不表示缺陷修复 PASS。

### R2 / main H04 生命周期（Node rc=0）

从 M archive 取 `packages/production-runtime/src/scheduler/auto-reconcile-runtime.js`；仅移除 import/export 包装，在 Node vm 注入假定时器、内存 readFileSync、deferred settlement，不加载真实 store/router。调用 tick→保持 settlement pending→stop→释放 deferred→再次显式 tick。

```json
{
  "sourceSha":"eb8fd18934d827cec98faacaef987869c5cb92e7",
  "testName":"H04-stop-inflight-and-poststop-tick",
  "faultInjection":"deferred settlement, fake timers and in-memory readFileSync",
  "stopReturnsPromise":false,
  "inflightStillPending":true,
  "callsAfterPostStopTick":2,
  "expectedSafe":{"stopReturnsPromise":true,"inflightStillPending":false,"callsAfterPostStopTick":1},
  "observedDefect":true,
  "exitCode":0
}
```

D archive 没有此文件，不执行 R2；live 的另一实现只读见 stopped/inFlight/await inFlight，本轮未跑它。不能将 M 的 R2 绑定到 live 进程。

### R3 / B4 harness 失败（两版 Node rc=1；外层 Python rc=0）

```text
input source: packages/workflow-execution/src/judgment.js from each exact git archive
generation: template.replace("SOURCE", json.dumps(src)).replace("REV", json.dumps(rev))
child command: node --input-type=module (stdin, data URL source import)
child result: returncode=1, SyntaxError: missing ) after argument list
runtime: Node.js v26.7.0
failure: second string replacement corrupted injected NEEDS_REVIEW, e.g. NEEDS_"fa4510be"IEW
assertions reached: NO
outer Python result: 0 (subprocess error not propagated)
disposition: STOP; no repair/retry; B4 dynamic result UNKNOWN
```

这是验证工具失败，不是 B4 产品反例执行结果，也不是产品正常。主审收到后通知三个分组停止；本轮没有修复 harness 后继续验证。

更早路径探索中的不存在目录/归档文件曾产生 rg 非零/KeyError，被当作定位信息继续。按严格“任何失败即停”口径属于执行偏差，已在 STOPPED 明记；不宣称停机纪律 PASS。deployed 无 auto-reconcile.js / ledger-records.js 等是真实路径差异，不能假定等名文件存在。

## 4. 现有契约、源码和部署状态的分离

- B1、B2、B4 多处保守停止行为有 accepted 契约来源；#1374 的目标不自动覆盖这些 stable ID，后续须正式路由。
- M 的 effect/receipt 机制存在，不等于 D 已安装、live 已加载、丢回执测试已通过或业务无重复。
- M 的 H04 mount 反例成立，不等于 D 有同文件，也不等于 live 同样有缺陷。
- 既有 WAE due/persistent replay/部分重启 drain 存在，不等于全部 UNKNOWN/blocked/Owner 责任自动闭环。
- 没有执行原完整测试套件、可信隔离 DB、多进程故障注入、跨服务 E2E 或生产验收；没有新独立审查/发布回执。

## 5. UNKNOWN、接续边界与完成定义

本轮未满足“完整 defect-matrix、全部非终态调度契约、八组有效验证”的完成定义。仍未知：live blocked 队列、真实运行加载身份与开关、Svc 部署坐标、工具能力全集、HUMAN_REQUIRED 答复验证闭环、真实重启责任保持、业务副作用丢回执结果、正常路径不回归。

建议后续依矩阵 §7 接续，先解决 harness 与权威冲突、再做已界定的隔离验证。不能自动重跑本轮，也不能以本报告授权修源码、部署、唤醒或重放未知请求。全部原始 UNKNOWN 和 STOP 记录保留。

## 6. 报告工件机械 readback

停止后仅执行报告文件链接/哈希与工作树写入范围核对，未继续产品审计。机械核对命令 rc=0；三份文档相对链接均存在；`git diff --name-only HEAD` 为空。`git --no-optional-locks status --short --untracked-files=all` 仅列原有 Brief 和三份新报告，未提交、未 stage。

```text
STOPPED-EKR-PRE.md
  bytes=2787
  sha256=019ada56bc7c0230d210b8b9bfc42010f1637575ecdc69b7ac1df9d997525597
docs/evidence/ekr-preflight/DEFECT-MATRIX.md
  bytes=29999
  sha256=94826f2b25bb60905cd04289c73f12abad2d1d097c62a109b2b449141563973d
trackedDiffPaths=[]
untracked=[BRIEF-EKR-PREFLIGHT.md, STOPPED-EKR-PRE.md,
           docs/evidence/ekr-preflight/DEFECT-MATRIX.md,
           docs/evidence/ekr-preflight/RECEIPT-EKR-PRE.md]
```

本回执自身不自嵌哈希，避免循环声明。以上机械成功不改变 `STATUS=STOPPED / INCOMPLETE`。
