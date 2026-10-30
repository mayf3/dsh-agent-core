# #896 — HR 派发计数与真实发送关联：SOURCE 与离线诊断

日期：2026-10-31（Asia/Shanghai）。性质：Investigation；不创建 Product Contract，不授予实现、加载或业务恢复权限。

结论：**真实源码已定位，当前字节与历史两套交付均不同。当前 `dispatchCount` 是 executor 的成功标记分支触发的 exact-key 计数，不是实发、可信回执、接收、ACK 或业务进展证明。** 零网络复现的 35 个行为断言通过；可信持久关联准则 3 项 RED；UNKNOWN 跨小时不重放准则 2 项 RED。没有修复产品源码，没有生产写入；历史 09:57 的加载版本与发送结果仍 UNKNOWN。

## 1. 授权、基线与 DEVELOPMENT_PREFLIGHT

用户本轮明确授权 #896 最小 SOURCE 工作、假 sender 离线复现、隔离分支 commit 和 issue 交付评论。原 issue 全文及 23 条评论的固定读回见 [issue snapshot](../evidence/hr-dispatch-count-source-896-20261031/issue-896-readback.json)。

```text
GOAL_OR_TARGET = 定位真实源码并证明计数/发送关联边界，交 SOURCE 诊断
CURRENT_GAP = 当前路径/版本未在新分支固定；旧工件需与现存源码区分
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 20e60dd72a42a0ef69e0acb8516b15c1893ffb01
CURRENT_BASE_HEAD_AT_START = 20e60dd72a42a0ef69e0acb8516b15c1893ffb01
ISOLATED_REF = ac-task/896-dispatch-count-source
ISOLATED_WRITE_SURFACE = /tmp/dsh-896-source (equivalent isolated clone)
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = accepted AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
RELATED_AUTHORITY = .agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md
GOVERNANCE_SOURCE = 6301662e18adaed88e4412394ad9bdb959d92355
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = IMPLEMENTATION (evidence tooling only)
IMPLEMENTATION_AUTHORITY = not_applicable (no product change)
PRODUCT_IMPLEMENTATION_ALLOWED = NO
PRODUCTION_OPERATION_ALLOWED = NO
MUTATION_AUTHORIZATION = VALID: user task, bounded evidence/commit/comment
Need new/amended Spec = NO for evidence; required before a new product contract
DONE_WHEN = source/hash + offline evidence + diagnosis in commit; #896 comment
EXPANSION_TRIGGER = need production/private reads or change durable product behavior
```

原 checkout 为 `docs/agent-delivery-resilience-v1@2d28545b3a17818e4a0b9481827fd56a18cd4c3c`，已有 20 条 tracked index/worktree 变动；没有接管或提交它们。`git worktree add` 因 `.git/refs/...lock` 的 `Operation not permitted` 失败。改在 `/tmp` 独立本地 clone 创建指定分支，随后只在该 clone fetch main；远端 main 与冻结 base 相同。原 checkout 保留。

相关 authority 搜索覆盖 main 的 `docs/specs/`、`docs/decisions/`、`docs/investigations/`。没有找到覆盖当前 HR Python 源码变更的 accepted Spec；旧 checkout 的 `AGENT_CORE_HR_DISPATCHER_V1` 是 proposed、implementation authority none，不能作实现许可。当前 accepted Workflow authority 是背景约束，不能代替这两份独立 Python 脚本的版本绑定。

相关调查直接复用 #896 原交付与有限验收；不重开已通过候选。拒绝/排除项：旧 v1 替代当前 v5、另造 FSM、缺 receipt 就归零、旧 UNKNOWN 重放、重复 18 脚本 caller 扫描、Agent 问询、绕 #754 安装拒绝。新证据仅为本轮精确源字节及合成执行结果。

## 2. 脚本位置、hash 与版本边界

精确源根（来自 [原 #896 交付](https://github.com/mayf3/agent-control/issues/896#issuecomment-6110658264)，本轮只读这两个普通源码文件与其 AGENTS 派发段）：

```text
/Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/
```

| 当前源相对路径 | 字节数 | 本轮 SHA-256 |
|---|---:|---|
| `scripts/dispatcher_v5.py` | 74402 | `5bb4c879958a8bec1320c260c1a856e3df91a0fd2441ae02b37177b90377190b` |
| `scripts/dispatch_escalation.py` | 29115 | `abe30587670765e13999f0c4d9955a92464981c9d3b702d6cb6b01bc56296383` |
| `AGENTS.md`（仅保存 L244–251 派发段） | 全文11219 | 全文 `083e137827017dbe889d42cd8a8468182c75b146f9d3173b81fa9e9001f6e82b` |

完整脚本按原字节封存为非执行的 [dispatcher archive](../evidence/hr-dispatch-count-source-896-20261031/source/dispatcher_v5.py.txt) 与 [escalation archive](../evidence/hr-dispatch-count-source-896-20261031/source/dispatch_escalation.py.txt)。复制后重读源文件相等；未改任何原字节。逐文件时间、mtime_ns、原路径见 [source manifest](../evidence/hr-dispatch-count-source-896-20261031/source-manifest.json)。

**版本只绑定内容 hash。** 当前父目录属于 `.openclaw` Git 树，HEAD 为 `245795ce0731a46629181fe5239b6c2c889e9463`；但这两个 exact path 不在 index、其 exact-path log 为空。不能将父 HEAD 当作它们的源码版本，更不能当作已加载版本。`dispatcher_v5` 名称/模块注释只给 v5 标签，无可验证发布版本。[精确 VCS 查询](../evidence/hr-dispatch-count-source-896-20261031/source-vcs.json)没有枚举其他路径。

AGENTS 派发段称 accepted 仅送达、超期无变化应 FOLLOW_UP_REQUIRED、不清 fence、不盲重发。[保存的原文段](../evidence/hr-dispatch-count-source-896-20261031/source/AGENTS-dispatch-protocol.excerpt.txt)是调查输入，不授予生产或私有会话读取权限；没有继续读其其他授权引用。

### 查过的全部位置及结果

| 面 | 方法/坐标 | 结果与边界 |
|---|---|---|
| Core 本轮隔离树 | base `20e60dd7…`，tree `0029033a65ab232bc673ffee0cacd8bfe1b3ad7e` | exact filename 历史查找：1070 本地 refs、2995 可达 commits，non-shallow；两目标均无命中 |
| Core main 文档/指令 | `docs/evidence/`、`docs/investigations/`、`docs/specs/`、`docs/decisions/`、`AGENTS.md`、`.agents/README.md` 的两脚本名 | `git grep` rc1，无引用；这是命名引用查询，不是所有代码语义扫描 |
| `mayf3/agent-workflow-operations` | `/tmp/awo-896` 完整 clone；所有 advertised refs 为 `317614d86e660414a8186fe4ee0c00e4f377b825` | 1 commit，仅 README；无 scripts/AGENTS/docs/evidence；README SHA `17f68872ac41e77fcf7ebaafdb9e7042e6f54583e78db3272f59a55a571d5484` |
| 历史隔离工件根1 | `~/Documents/Codex/2026-10-10/task-hr-readonly-inquiry/output/hr-dispatch-fsm-repro/` | 本轮 stat=`FileNotFoundError errno=2`；不能冒称已取到旧完整源码 |
| 历史隔离工件根2 | `~/Documents/Codex/2026-10-17/task-hr-receipt-contract-alignment/output/hr-receipt-contract-alignment-20261017-v1/` | 同上；没有由缺目录推导出可宽扫权限 |
| 精确受权源面 | 上述两脚本 + AGENTS 派发段 | FOUND，hash 如上；未读取 ledger、私有会话、凭据或运行日志 |
| issue 合法原件 | #896 全文/评论、#893/#894、ops#9、#779、#953 R2 | 复用路径与交接；没有重复 18 脚本 caller 搜索 |

实际命令、完整输出及 exact ref 清单在 [repository-search.json](../evidence/hr-dispatch-count-source-896-20261031/repository-search.json)；目录缺席/VCS 根查询在 [path-checks.json](../evidence/hr-dispatch-count-source-896-20261031/path-checks.json)。1070 refs 的统计冻结于 locator 查询时；之后隔离 clone 的 main fetch 不新增这两脚本。Core1117933f/agent-control9855aea 的旧完整树缺席结论仅沿用用户已知起点，未重做。**结论不是“脚本全局缺席”，而是仓库面无该文件，准确外部源路径已找到。**

## 3. 历史交付复用与本轮差量

[原语义交付](https://github.com/mayf3/agent-control/issues/896#issuecomment-6110658264)固定原 dispatcher `27abe1fd523188508bcb489029cfd8e14d5808b9af13530c488164c0c3d4375e`、escalation `7553318a442b5f2e0f33bdf9bec7735afc5b50c472cbeef69160712136ffd579`。23/23 是当时作者离线结果，无 RED；已被有限纠正为不能证明历史加载/实发，不能继承到本轮新 hash。

[最新 receipt 有限静态 PASS](https://github.com/mayf3/agent-control/issues/896#issuecomment-6230399616)固定候选 dispatcher `c8ebdcf56dacac43233ba0087b3dcfc0a373901139319e5a930752551d5547db`、escalation `30fdac7be1da3dbd7d01971c2b78550925e92e86904d3e60ad2a3a6176c88ef1`。44/44 + 16/16 + 23/23 是作者执行结果，独审只做静态；没有集成/加载证明。FOLLOWUP 候选 [有限验收](https://github.com/mayf3/agent-control/issues/896#issuecomment-6111727559)也保留为独立 SOURCE 候选，不混装成一个“当前通过版本”。

本轮从已发布 fenced blocks 恢复旧 `minimal_v3_review_fix.diff`（`8d0a9f54f6202bee11491e883996b8e18b7cc844149d79fe5e292578087c3f6c`）、最终 envelope 测试（`d0e1e67ea5c57f159706416c534c1c445b547f108eccb588e0f10a9ab4e43277`）及 receipt 测试（`dc0de447fab2786a2a52ca8c3a1da6b51e795d541ebb6ab39857cdbd0044e77b`），原字节 hash 一致，见 [published-history manifest](../evidence/hr-dispatch-count-source-896-20261031/published-history/manifest.json)。这些 `.py.txt` 是历史非执行证据，本轮未重跑、未改造旧测试。

公开评论没有完整两脚本或 `test_fsm_repro.py` 的源码，不能由片段拼造完整文件并冒原 hash。新源码的确认分支和 FOLLOW_UP 规则已经改变，旧 PASS 未被投射到新版本。当前未见已评审 receiptRef adapter；单凭当前磁盘源码也不能断言它被删除、回滚或从未接入，来源演变 UNKNOWN。

## 4. 当前源码全链（行号均针对封存原字节）

以下 D=dispatcher、E=escalation，不指生产已加载实现。

1. **候选/选择**：D247–377 UNION exact key 去重、冲突排除；D623–749 用 followUp/eligibility/cooldown 和注入的 exact Owner resolver，再 fair rank，最多5个。计划只带 `planned`，不会 send 或计数。
2. **发送前预留**：D812–836 先调用 E209–270 `claim_dispatch`。E187–191 append+flush+fsync；写 `DISPATCH_RESERVED`、`dispatchClaimedAt`，不增 dispatchCount。预留拒绝则 sender 实调次数为0。
3. **send 与 receipt**：D838–878 调注入 sender。显式顶层失败优先；否则 dict 的 `ok is True` / `accepted is True` / 特定 accepted-like 顶层 status 任一即可判 confirmed。null/False/SEND_STARTED→UNKNOWN；Exception→SEND_FAILED。可能已发生外部效果的 Exception 仍应按外部 UNKNOWN 解释，不能读作“确定未发送”。
4. **计数写点**：只有 confirmed 分支经 D879–906 到 E273–370 `record_dispatch`；E339 exact-key dispatchCount+1；noProgressCount 为 max(原值, projection attempt)+1。action=NONE 与 threadId=null/ownerNotified=false/reportIssued=false 在首轮完全相容。裸 `record_dispatch` API 不自行验证调用者有成功回执，本轮没有枚举真实 caller。
5. **关联限制**：D845–854 不核 message/session/target/attempt；同目标 envelope、`{ok:true}`、foreign-target envelope 均计1。raw receipt 只在 round item；D893–905 持久层只接顶层 status→deliveryOutcome 及候选上下文，没有 receiptRef。上下文 `agentId/dispatchIntentId` 不是 receipt 观察值。
6. **冷却/跟进**：D399–428 将 lastDispatchAt/dispatchClaimedAt 纳入 fence。E246–256 仅在距上次小于1h时拒绝；到时不查未决 outcome，可再 claim。D662–670 的到期 `followUpAt` 优先产生 FOLLOW_UP_REQUIRED，且不依赖 followUpRequired boolean；没有 deadline 时满1h可继续派。
7. **进展/升级**：E345–350 在 noProgressCount≥3 请求 thread，已有thread后≥4通知Owner，已有Owner通知后≥5出report；D914–979 可持久化 handler 回执。E373–435 的五类权威事件才可复位 no-progress；accepted 不算进展，dispatchCount 不随 observation 归零。

## 5. 最小零网络离线复现与真实 rc

入口：[scripts/availability-recovery/hr_dispatch_count_probe.py](../../scripts/availability-recovery/hr_dispatch_count_probe.py)。它验证两个源 hash 后加载封存副本，注入 fake sender/Owner/snapshot，只把 ledger 与 lock 写入随机临时目录；不运行原 CLI/selftest，不用默认 memory 路径。Python audit hook 禁 socket/process 调用并限制写 open 到临时目录。每轮实测禁止调用尝试为0、synthetic write opens=74；无真实发送或 Workflow 请求。

```bash
python3 -B scripts/availability-recovery/hr_dispatch_count_probe.py --mode semantics
python3 -B scripts/availability-recovery/hr_dispatch_count_probe.py --mode correlation
python3 -B scripts/availability-recovery/hr_dispatch_count_probe.py --mode no-replay
```

| 命令模式 | 实际 rc | 结果 |
|---|---:|---|
| semantics | 0 | 18 个 observation，35/35 当前行为断言通过 |
| correlation | 1 | 35/35 行为断言仍通过；3/3 持久可信关联调查准则 RED |
| no-replay | 1 | 35/35 行为断言仍通过；2/2 UNKNOWN 跨小时不重放准则 RED |

完整 stdout JSON、空 stderr、argv/cwd/rc 各自保存在 [runs/](../evidence/hr-dispatch-count-source-896-20261031/runs/)。这些 RED 是用户要求核实的关联/不重放边界，不是作者自建 accepted Product Contract，**没有绿色修复版**。

| 场景（合成 fixture） | sender 实调 / dispatchCount | 观察 |
|---|---|---|
| 仅计划，未调用 executor | 0 / 0 | 选中但不生成 ledger |
| 同目标 envelope 正常返回 | 1 / 1 | round 保留 receipt；ledger 无 receiptRef |
| 裸 ok:true、foreign target envelope | 各1 / 1 | 均通过成功标记分支；无可信坐标校验/持久关联 |
| null、False、SEND_STARTED | 各1 / 0 | SEND_OUTCOME_UNKNOWN，预留保持；不能解读成未调用 |
| 显式失败包 | 1 / 0 | SEND_FAILED；保留预留，未按缺 receipt 重置历史行 |
| 成功后同小时重复 | 总1 / 1 | COOLDOWN_NOT_ELAPSED，无第二次send |
| 假远端已受理后 TimeoutError | 1 / 0；>1h 后总2 / 0 | 表面 SEND_FAILED，外部 UNKNOWN；当前函数可再调用 |
| 假远端受理后 SystemExit 崩溃 | 同上 | 同小时不重放；>1h 可再调用，无永久 UNKNOWN latch |
| sender 已返回、record 写入前崩溃 | 1 / 0 | DISPATCH_RESERVED 保持；证明计数0也不等未发送 |
| 显式 followUpAt 到期 | 总1 / 1 | FOLLOW_UP_REQUIRED，未再调用 |
| 同visit真实事件形状的 TRANSITION observation | 总1 / 1、noProgress=0 | 直接复位成功，但旧 followUpAt 保留，仍 FOLLOW_UP_REQUIRED |
| 无旧deadline的 TRANSITION 后满1h | 总2 / 2、noProgress=1 | 允许下一派，累计dispatchCount不归零 |
| post-dispatch snapshot 的同key TRANSITION | 1 / 1、noProgress=1 | snapshot SUCCESS，自动 observation 未复位 |

最后两类是**权威事件输入的合成形状**，没有执行真实 Workflow transition。自动 snapshot 限制有精确矛盾：D1093–1096 要求 progressAt>dispatch_ts，而 D1016 把 observed_ts=dispatch_ts 传给 E417–421，后者要求 progressAt≤observed_ts。同visit deadline 限制来自 E423–427 只清 boolean、没有清旧 followUpAt，D663–670 又不依赖 boolean。新 NodeVisit/新locator 的行为不能由同visit fixture 泛化。

## 6. 诊断 disposition、UNKNOWN 与下一责任

**SOURCE disposition：no_change；缺口已实测，不修产品。** 精确写点和 RED 均已给出，但真实 producer/caller 合同、历史加载绑定和覆盖当前 Python 语义的 accepted 实现 authority 不齐。不能直接移植旧 adapter、改变计数、延长 fence 或另造 UNKNOWN/FSM。可由原 SOURCE 维护线针对已绑定版本承接最小变更；本轮只新增证据归档与离线工具。`SPEC_COMPLIANCE` 限于授权调查范围：未改 governing authority、产品/runtime/线上脚本；不构成产品 Spec PASS。

仍为 UNKNOWN：

- 1791712656827/09:57 当次实际执行/加载的两文件 hash，是否 sender 曾调用、是否远端受理/消费；当前源码无法倒证。
- 真实 HR caller、send 返回路径及 broker 实际暴露 shape；fixture 不证明真实接线。错误标记为 SEND_FAILED 也不能证明外部无效果。
- 旧 receipt/FOLLOWUP 候选的集成、采用、安装与运行代际；当前磁盘存在不是加载证明。
- 外层 caller 是否另有阻止满1h UNKNOWN 重放的 gate；本轮证明的是当前这两函数的可达行为，没有声称线上发生重派。
- 购物/博客当前业务状态、家庭403/#788 恢复、运行健康、原 Owner ACK；均未验证，业务恢复0。

**下一责任 dot，沿原准入安排。** 复用 [#896 原接续](https://github.com/mayf3/agent-control/issues/896#issuecomment-6111874915)与 [最新限定 PASS](https://github.com/mayf3/agent-control/issues/896#issuecomment-6230399616)：通过原维护线取得既有合法 caller/return 合同原件、实际返回包暴露形状和明确源码/加载版本绑定，再决定最小 SOURCE delta；不得重复 18 脚本扫描或另发 Agent 问询。

业务侧仍是 [source9/#779](https://github.com/mayf3/agent-control/issues/779) 的 `ac-779` 原执行线，#893/#894 沿同线，controller 的 writer/UNKNOWN/capacity 准入为最终裁定；本轮新离线分支不是替代 writer。[#754 原拒绝](https://github.com/mayf3/agent-control/issues/754#issuecomment-6107617247)是 local-controller 安装续段的 BLOCKED_TOOL_BEFORE_COMMAND_CREATION，必须沿原支持审查路径，不换 issue/session/tool 重试。本轮不提交 operator disposition、不触发准入、不 wake/重派/submit、不清 fence、不部署、不读取私有会话/凭据。

交付评论沿 [#953 R2](https://github.com/mayf3/agent-control/issues/953#issuecomment-6533425954) 的交付段/证据段/UNKNOWN段格式。该评论是已授权 SOURCE 结果交付，不是对 HR 或业务 Agent 的执行指令。完成 commit 和评论后即停止。

## 7. 交付检查记录

初版 commit `d3bd15282c290d52a7a2d1392270b5e19308d57d` 的结构 gate rc1：新增 diagnostics 目录使 scripts 立即子项66→67，属于候选新增违反。仅将探针原样移至现有 `scripts/availability-recovery/`（子项4→5），没有改业务代码或放宽结构规则。初次运行和失败检查均保留在 `runs/initial-diagnostics-path/` 与 `checks/initial-*`，不隐去失败。最终路径重新执行的完整输出在 `runs/` 顶层。

全差量 whitespace 检查 rc2，5处均为不可改写的原字节历史 diff/源码/测试尾空格；手写 runner 和报告的检查 rc0。治理锁完整性 rc0。最终结构 gate、独立受影响面审查与最终 hash 清单另见同 evidence 目录的交付检查收据。整体测试不得称全绿；语义证明通过不消除关联/UNKNOWN两组 RED。
