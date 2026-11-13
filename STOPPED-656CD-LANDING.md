> **历史 v1 停点记录。** Owner v2 续办已授权解除本次停点；v2 独立构建/测试与交付见 [656367CD-LANDING-PREP](656367CD-LANDING-PREP.md)。以下保留 v1 真实失败及当时状态，不代表 v2 当前状态。

# STOPPED-656CD-LANDING — 首次候选构建失败，按简报停写

**STOPPED_REQUIRED_GATE_FAILURE / candidate_build_rc1。** 本轮未完成落地准备；没有候选隔离区、RED→GREEN、回归、QA PASS、受控安装 runbook 或 commit/push/PR。根目录 `656367CD-LANDING-PREP.md` 是失败前的 PREPARING 草稿，不得作为交付或部署准入。

## 1. 授权、停止来源和精确坐标

- 来源：用户本次指令与 `BRIEF-656367CD-LANDING.md` 完成定义：“失败即停写 STOPPED-656CD-LANDING.md（失败语义=探索空结果≠失败）”。本次真正失败的是候选构建，不是探索缺文件。
- Repo/worktree：`mayf3/dsh-agent-core` / `/Users/yanfenma/workspace/project/worktrees/ops-656-landing`。
- Branch：`fix/656367cd-landing-prep`；HEAD / integration base / fresh origin/main：`6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef`。
- 唯一写者：Codex root；独立 QA：`/root/qa`，只读复核，没有写入或执行测试。
- 停止读回时间：`2026-11-08T23:45:12.543451+00:00`（上海 2026-11-09 07:45:12）。
- 失败后只进行了停止协调、只读状态/哈希读回和本 STOPPED 写入；没有修复链接、换路径重跑、测试、commit、push、创建 PR 或合并。

## 2. 真实失败及错误原文

执行命令，rc **1**：

```sh
python3 docs/evidence/656367cd-landing/build.py
```

失败位置为 `build.py:49` 的 `SCRATCH.mkdir(parents=True)`。脚本此前仅在内存清点 live app；尚未复制 live、创建候选、覆盖文件、输出 manifest 或运行候选。原始错误：

```text
Traceback (most recent call last):
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/pathlib/__init__.py", line 1011, in mkdir
    os.mkdir(self, mode)
    ~~~~~~~~^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: '/Users/yanfenma/workspace/project/worktrees/ops-656-landing/node_modules/.cache/656367cd-landing'

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/pathlib/__init__.py", line 1011, in mkdir
    os.mkdir(self, mode)
    ~~~~~~~~^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: '/Users/yanfenma/workspace/project/worktrees/ops-656-landing/node_modules/.cache'

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/Users/yanfenma/workspace/project/worktrees/ops-656-landing/docs/evidence/656367cd-landing/build.py", line 89, in <module>
    main()
    ~~~~^^
  File "/Users/yanfenma/workspace/project/worktrees/ops-656-landing/docs/evidence/656367cd-landing/build.py", line 49, in main
    SCRATCH.mkdir(parents=True)
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/pathlib/__init__.py", line 1015, in mkdir
    self.parent.mkdir(parents=True, exist_ok=True)
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/pathlib/__init__.py", line 1015, in mkdir
    self.parent.mkdir(parents=True, exist_ok=True)
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/pathlib/__init__.py", line 1011, in mkdir
    os.mkdir(self, mode)
    ~~~~~~~~^^^^^^^^^^^^
FileExistsError: [Errno 17] File exists: '/Users/yanfenma/workspace/project/worktrees/ops-656-landing/node_modules'
```

只读根因确认（Dev 与独立 QA 一致）：

```text
node_modules -> /private/tmp/dsh-ekr-p1-new/node_modules
nodeModulesIsSymlink = true
nodeModulesExists = false
targetExists = false
scratchExists = false
```

这是已有悬空链接与所选隔离路径冲突；该路径选择未在构建前检查，是本次准备脚本问题。没有删除、修复或遍历目标写入。未将其伪装为探索空结果或环境豁免。

## 3. 失败前已核事实（不是构建/测试 PASS）

已完整读取简报、AGENTS/.agents 入口、直接相关 Architecture、Current Decision 和 accepted 生命周期合同，路线 REUSE / EXEC_PLAN / DURABLE；生产操作始终 NO。

Git `656367cdfa2d8a8c72e63ab16d1932c895396b2b` 已在 base 祖先链。静态 diff 与独立 QA 表明，以下两份原始 blob 是 terminal+idle 路径的最小拟替换集；**尚未落入候选隔离区**：

| 路径（前缀 `packages/agent-router/src/process/`） | 安装前像 SHA256 | Git656 原始 blob SHA256 | 差量 |
|---|---|---|---|
| `event-correlation.js` | `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` | `1e6340b363df6555bd157ec2a8ceaa6d3e08c7fbb045872cedc2e37994e596fa` | 原 fix 23 行 changed：三态 outcome、unknown、terminalReject envelope |
| `state-machine.js` | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | `53f02f66ce09da9957373e97148a7a498bb07c8ddef50bc1161f5ea9f7e30ad4` | 仅新增 exactTurnOutcome 10 行 |

两份安装文件在停止后哈希读回仍为上表前像；没有声称全 app 在构建前后完成了落盘 manifest 比较。

| 检查符号 | 安装版静态观察 | 最小集含义 |
|---|---|---|
| `envelopeCarrier` | state-machine.js 已显式导出 | 无需为它另加文件 |
| `exactTurnOutcome` | state-machine.js 未导出 | 拟替换 state-machine.js |
| `markTransportRetryEvidence` | delivery-resilience.js 不存在 | 后续 main event blob 引入；Git656 原 event blob不导入、不调用它 |

安装版 event 到 Git656 原 event 的 diff 正好是原 fix；main event 相对 Git656 另加 transport import/call，成为 25 行 changed。为复用原 fix 而不引入额外重试闭包，拟选原 Git656 的两份文件。独立 QA支持此最小范围判断，但**尚无可导入闭包/行为测试证据，不能称闭包最终验证 PASS**。

`spawn.js` 的 child-exit outcome 修复也在656原提交中；本次简报的最小集不含它，仍保留现役。所有 child-exit 路径均修复、完整656已安装等主张均不成立；不能将此现存范围外路径称为本次新增回归。

## 4. 已定位的发布审计来源与仍缺输入

- 原发布收敛报告：[PR #679](https://github.com/mayf3/dsh-agent-core/pull/679)，独立只读定位 head `9e5e18efa918df79d84a7c9d739112091fce9e0d`、状态 OPEN，未合并，不是本任务 PR。
- [固定报告](https://github.com/mayf3/dsh-agent-core/blob/9e5e18efa918df79d84a7c9d739112091fce9e0d/RELEASE-CONVERGENCE-547.md) L3、§3、§5 记录现役393+081六文件（admin叠Gap B）+app#1374三文件+external Harness#1386两文件；11个历史备份旧reader拒读；未认证出可用完整回滚组合。L44记录当时PID22118于上海00:13:26启动。该报告为前序时间绑定证据，本轮未把它冒充新鲜 loaded-byte认证。
- [原简报](https://github.com/mayf3/dsh-agent-core/blob/9e5e18efa918df79d84a7c9d739112091fce9e0d/BRIEF-RELEASE-CONVERGENCE.md) L6转述00:12仍有真实broker执行；本轮未定位对应原broker行，不升级为本轮独立活动取证。
- Owner 2026-11-09“三优先线”机制审计原文坐标仍 UNKNOWN。已向用户异步请求路径/链接；既有GitHub #1374、Core #547、Shared命名发布目录及相关审计索引没有找到该原文。此探索空结果不是本次停止原因。

没有撤081/Gap B/#1374/#1386，没有把零散前像称为历史完整回滚。未来受权 runbook 应将回退定义为“仅回退本差量集到切换窗口的现役前像”，而不是回纯393或恢复旧业务snapshot；本轮 runbook未编制/执行。

## 5. 独立 QA 的冻结结论

```text
FROZEN_BLOCKER_UNION = [REQUIRED_GATE_FAILURE: candidate_build_rc1]
SOURCE = BRIEF-656367CD-LANDING.md completion definition and fail-stop
COUNTEREXAMPLE = dangling node_modules prevents isolated candidate mkdir
IMPACT = candidate / RED-GREEN / regression / QA / delivery not completed
MINIMAL_CLOSURE = explicit subsequent Owner continuation; choose an independently
  writable isolated path after lstat preflight, then build (NOT executed this turn)
affected_readiness = candidate,red_green,regression,qa,commit,push,pr
all_affected_readiness = NO
OPERATION_ALLOWED = NO
QA_VERDICT = STOPPED, NOT_PASS
```

独立 QA 已做安装源哈希、原fix静态差量复核和悬空链接根因复核；没有执行任何行为测试。不得将拟定的 Owner RED/GREEN测试定义算作已执行证据。

## 6. 保留工件与生产边界

| 失败前工件 | SHA256 | 状态 |
|---|---|---|
| `BRIEF-656367CD-LANDING.md` | `88579b92bfefffea4921237d6ad27b4330c65ebd5050290e9ceec34e6a1ae342` | 原输入保留 |
| `656367CD-LANDING-PREP.md` | `4189afc5b24e39d02fd2fd4de69ed230882f93e023c694bd1d72ede03e51ffe7` | PREPARING 草稿，未完成 |
| `docs/evidence/656367cd-landing/build.py` | `a4c494f595fe1a15c93ddfdb5480107a1720112e39c70774a7beab36a8d8a3ec` | 首次执行rc1，原样保留，不再执行 |

候选隔离区不存在；没有 candidate/preimage/manifests、测试原文、runbook或本任务PR。HEAD未变、没有暂存/提交/推送；保留未跟踪材料供后续审阅。

本操作者生产写入=0；安装=0；重启/signal=0；清fence/改store/重放/新业务请求=0；生产Agent派发=0；真实store constructor=0。sudo authsvc 仅做目录只读清点，未读credential。安装 app仅静态读取；未运行安装版或候选版函数。INSTALLED/LOADED/BUSINESS_VERIFIED均未因本任务提升。
