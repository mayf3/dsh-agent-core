# RECEIPT-W6-S04 — STOPPED / 隔离闭包未完成

关联：[Issue #605](https://github.com/mayf3/dsh-agent-core/issues/605)。Owner 交办日期：2026-11-06（Asia/Shanghai）。执行器停止时间：STOP.json 记录 `2026-11-05T23:46:57.659906+00:00`，即北京时间 2026-11-06 07:46:57。

**结论：S04 未通过。记录器 preflight 引用了不存在的 built 文件，按 Owner“失败即停写 STOPPED-W6-S04.md”停止；没有自动修正重试。该错误属于本次检查脚本，不构成候选回归证据。** App 重组、官方门、scratch 替换、重封 accepted-r2-inputs、r2/r3 启动和 cold-session 均 NOT_EXECUTED。S05 只读事实调查完成，两个已知兼容性问题仍未解除。没有生产安装、重启、权限修改、真实消息/模型调用或业务验收；没有 bind/connect 8788/8790。

## 1. 坐标、授权和作用面

| 对象 | 冻结坐标 / 本次实测 |
|---|---|
| app | `75ece578301b014a23b987568d1eb8af96795300` |
| app tree | `7a68ac22c8eef6340131dacafe1c0f2aa5dfa0d6` |
| harness source | `13ecda5c759263c7ce7ab93b678f862f65513f34`，tree `81a047cd4d6574614e88cffe04c5e013cc43535b` |
| Node | `/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node`，darwin-x64 v25.6.1 |
| Node SHA-256 | `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`；mode `0755` |
| 工具执行起点 | `99b0fa84d38e944dca639fc00a109ab713dd1ac7`，`chore/fleet-window-tools` |
| 隔离交付工作树 | `/private/tmp/dsh-w6-s04-receipt`，分支 `chore/fleet-w6-s04-20261106`，parent 同上 |
| 本次证据目录 | `/private/tmp/fleet-w6-s04`；Git 仅纳入本收据与 STOP 收据 |

治理路由：`schema_version=2 / REUSE / EXEC_PLAN / DURABLE / OPERATION`。执行授权为本次 Owner 合同式交办；现有 `BRIEF-W6-S04-CLOSURE.md` 是逐字交办记录，不将本收据或旧生产 Mandate 当作生产授权。已读取 grammar、local README、router/PREFLIGHT、Architecture、Current Decision 索引与直接相关部署权威 `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`。其 accepted 权威允许 nonproduction verification，`production_apply_authority=none`。不修改长期 Product Contract；不存在本次可执行生产授权。

目标是新组合的隔离闭包与指定门；当前缺口是该组合完整实测证据。顺序为输入绑定→官方 app 重组→selected-input/mode 对账→官方 app 图门→scratch 同步/封印→r2+r3→cold-session→收据。任一失败即停止后续操作。S05 仅调查；不修改 pause/stamp 实现。旧 harness 仅计划作为对照，未执行迁移或替换。

## 2. 实际动作与逐门状态

1. 新建隔离收据工作树；原工具工作树既有未跟踪文件保持原状，没有纳入本提交。
2. 从本机 `/Users/yanfenma/workspace/project/production-dsh-agent-core` 只读提供的 Git 对象，向两个临时候选仓 fetch 精确冻结 app SHA，并 detach checkout。没有切换该 production-dsh-agent-core 工作树。两个临时 checkout 命令均 rc=0。
3. `/tmp/fleet-v5-candidate` 最终 status 原文 `?? STOPPED-C3.md`；`/tmp/fleet-roll-src` clean；`/tmp/v5-rebuild/harness-src` clean 且 HEAD 冻结正确。
4. 写入临时 recorder `/private/tmp/fleet-w6-s04/execute.py`；它在 PREFLIGHT 检查失败，未到 runner 生成或装配阶段。
5. 写 STOP 收据；之后只做只读查证及收据封存、提交/PR。未改动装配 runner 的原文件、scratch runtime 脚本或任何 production 文件。

| 门 / 阶段 | 本轮状态 | rc / 输出 |
|---|---|---|
| 隔离 Git fetch/checkout | 已执行 | 各 rc=0，原文见 §3 |
| harness tracked 源字节检查 | 部分 preflight Observation | 7,831 个 tracked file 与 assembled 对应字节匹配，缺失 0；这不等于依赖闭包/构建验收 |
| recorder preflight built 检查 | **FAIL / STOP** | FileNotFoundError，原文见 §3；顶层进程 rc 未保留，UNKNOWN，不能冒记 rc=0 或 rc=1 |
| runner pin 最小修订 / `--check` | NOT_EXECUTED | 无本轮输出；临时 runner 尚未生成 |
| `assemble-runner.sh --reassemble-app` | NOT_EXECUTED | 无本轮输出 |
| selected-input manifest + mode reconciliation | NOT_EXECUTED | 无本轮 selected-input/mode 验收证据；不能复用 C5-r7 历史 PASS |
| `RUNTIME_APP_GRAPH_GATE_V1`，canonical argv/trusted Node | NOT_EXECUTED | 无本轮输出 / PASS |
| scratch app/harness 替换 | NOT_EXECUTED | 无本轮同步/对账 PASS |
| accepted-r2-inputs 重封 | NOT_EXECUTED | 原清单仍是旧组合，不能用于新组合放行 |
| r2 原 `run-canary.mjs` | NOT_EXECUTED | 无本轮收据，旧 canary 不代表本次组合 |
| r3 `run-runtime.py` / 16 checks | NOT_EXECUTED | SHA 常量仍为旧 ce1d；本轮 true 项数量 **UNKNOWN**，不得填 0/16 或 16/16 |
| cold-session 新版 / 旧版对照 / sibling 拒绝 | NOT_EXECUTED | 仅静态方案；无历史写入、冷加载或恢复输出 |
| W6-S05 只读调查 | 完成事实记录 | §5；对应生产就绪 NO |

## 3. 原始输出与停止原因

隔离准备命令的持久原文来自 `preparation.jsonl`：

```text
$ git -c core.hooksPath=/dev/null worktree add -b chore/fleet-w6-s04-20261106 /tmp/dsh-w6-s04-receipt HEAD
rc=0
stdout:
HEAD is now at 99b0fa84 chore(fleet-window): W6-S01 advance executor pins to frozen candidate 75ece578 (tree 7a68ac22)
stderr:
Preparing worktree (new branch 'chore/fleet-w6-s04-20261106')


$ git -c core.hooksPath=/dev/null -c gc.auto=0 -C /tmp/fleet-v5-candidate fetch --no-tags --no-auto-maintenance /Users/yanfenma/workspace/project/production-dsh-agent-core 75ece578301b014a23b987568d1eb8af96795300
rc=0
stdout:
stderr:
From /Users/yanfenma/workspace/project/production-dsh-agent-core
 * branch            75ece578301b014a23b987568d1eb8af96795300 -> FETCH_HEAD


$ git -c core.hooksPath=/dev/null -C /tmp/fleet-v5-candidate checkout --detach 75ece578301b014a23b987568d1eb8af96795300
rc=0
stdout:
stderr:
Previous HEAD position was f6a1f77 Merge pull request #625 from mayf3/ac-ekr-b1b4
HEAD is now at 75ece57 Merge pull request #628 from mayf3/chore/fleet-window-anarrowed


$ git -C /tmp/fleet-v5-candidate status --porcelain=v1 --untracked-files=all
rc=0
stdout:
?? STOPPED-C3.md
stderr:


$ git -c core.hooksPath=/dev/null -c gc.auto=0 -C /tmp/fleet-roll-src fetch --no-tags --no-auto-maintenance /Users/yanfenma/workspace/project/production-dsh-agent-core 75ece578301b014a23b987568d1eb8af96795300
rc=0
stdout:
stderr:
From /Users/yanfenma/workspace/project/production-dsh-agent-core
 * branch              75ece578301b014a23b987568d1eb8af96795300 -> FETCH_HEAD


$ git -c core.hooksPath=/dev/null -C /tmp/fleet-roll-src checkout --detach 75ece578301b014a23b987568d1eb8af96795300
rc=0
stdout:
stderr:
Previous HEAD position was f6a1f77a Merge pull request #625 from mayf3/ac-ekr-b1b4
HEAD is now at 75ece578 Merge pull request #628 from mayf3/chore/fleet-window-anarrowed


$ git -C /tmp/fleet-roll-src status --porcelain=v1 --untracked-files=all
rc=0
stdout:
stderr:

```

Recorder STOP.json 原文：

```json
{
  "at": "2026-11-05T23:46:57.659906+00:00",
  "exception": "FileNotFoundError(2, 'No such file or directory')",
  "phase": "PREFLIGHT",
  "traceback": "Traceback (most recent call last):\n  File \"/tmp/fleet-w6-s04/execute.py\", line 60, in execute\n    assert sha(W/'harness-src'/rel)==sha(R/'harness'/rel),rel\n           ~~~^^^^^^^^^^^^^^^^^^^^^\n  File \"/tmp/fleet-w6-s04/execute.py\", line 7, in sha\n    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()\n         ~~~~~~~~~~~~^^^^^^\n  File \"/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/pathlib/__init__.py\", line 771, in open\n    return io.open(self, mode, buffering, encoding, errors, newline)\n           ~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nFileNotFoundError: [Errno 2] No such file or directory: '/tmp/v5-rebuild/harness-src/packages/session/session/lib/index.js'\n"
}
```

失败代码使用 `packages/session/session/lib/index.js`，实际 session built 路径是 `packages/core/session/lib/index.js`。第二次读取是停止后的只读定位，**未修改 recorder、未重跑 preflight**。完整 7,831 tracked 源比较已经完成，但无 dependencies、mode、gate 或 runtime 的等价推论。顶层 shell 在工具返回时未保留最终退出码，收据明确 UNKNOWN。

原工具仓 runner 的 EXPECTED_APP_HEAD 实测为 `f6a1f77a8b7b878bcb9821a68836925755ca7076`；`/tmp/v5-rebuild/assemble-runner.sh` 则仍是 `ce1d13c1e8585759c6a5f194fb5553d990574b5b`。均未被本轮修改。脚本中拟议的 pin/OUT/Node 修订未到执行点，不是已实施变更。

## 4. cold-session 静态证据与剩余缺口

现场存在版本错配：assembled harness `.source-stamp` 原文为 `13ecda5c759263c7ce7ab93b678f862f65513f340`（末尾 0 是 legacy dirtyCount）；scratch 原文为 `514ab7b0029141b88c807704764d0d3e1eea1da40`。scratch 仍是旧 harness，不能只凭 harness-src HEAD 称运行组合已更新。

| 文件（harness 内） | source/assembled SHA-256 | scratch 旧 payload SHA-256 |
|---|---|---|
| `packages/core/session/lib/index.js` | `3577555364d6d1b002eea139f9b71ebbc56785e50909c83228982863860d7231` | `dc14c845b915a9faaeb867499966e7b1991af3b6285f314bf353417e939d9c36` |
| `packages/session/session-persistence/lib/index.js` | `f991cb38520ed17c0a260751c9e478ab89bb6ab57571861503c3dfb7ebd9364d` | `d08210e95ae22c7cb22a6208f0ebc02d38898f01aabf4f82924ee2bffcbc2cad` |
| `packages/session/session-persistence-jsonl/lib/index.js` | `8b6ebc4509a3e969ab3ad6e0dfb553ae4861e5b101831afed23e593d148d97f3` | 相同 |
| `packages/session/session-persistence/src/coordinator.ts` | `5e9a3d932bc4109f7db9ebd220641eecf5c4991929973a6e9d6bfdf505d41633` | `80f044b43da1224e0e97208d27d0451f29f8acb579a43389af398eb36f98c096` |

13ecda5c 的 `packages/core/session/src/known-event-types.ts:69` 注册精确 Codex event；`packages/session/session-persistence/src/coordinator.ts:1079-1083` 有 exact named-list tolerance。应验证的是“旧 build 未识别的 `web/openai-codex-search-llm-request` 历史事件”，不能扩为任意未知 required event 均可恢复。

建议脚本 `/private/tmp/fleet-w6-s04/cold-worker-proposed.mjs` 仅已写出，未执行。建议分别以全新 Node 进程 write/load/prepare/实际 `ctx.agents.resume`；新 payload 正向、旧 514ab7b0 期望拒绝、无关 `web/unregistered-telemetry` 负向拒绝，零模型调用。该脚本未经实际运行或本轮独立可执行性验收，**不构成 cold-session PASS，也没有实测旧版拒绝对照**。

## 5. W6-S05 只读事实记录

此处“pause JSON”与“source JSON stamp”是两个独立责任，分别源自 `26813473b825a6bd9f9bd05e878fd05ae29a9467` 和 `4fc07f95e2ca14610b8e0a9633af60b148741aac`。两者均非 frozen A 75ece578 祖先；结论依据精确源码比较，不仅依据 ancestry。读取使用本机对象仓 `git show <固定 SHA>:<path>`，不切换源工作树。原文见 `s05-readonly-source-observations.json`。

### K24 — pause 文件无 main consumer

- 268 的 `packages/workflow-execution/src/admission-control.js:6-38` 定义 AdmissionPauseControl；构造时仅一次读取 JSON。只有 `paused===true` 才暂停；缺文件/坏 JSON/IO 错误均恢复 open。`:22-28,33-37` 原子发布 `{paused:boolean,reason:string|null,updatedAtMs:number}`；status/isPaused 读缓存，无 watch/refresh。
- 268 的 `packages/production-runtime/src/workflow-execution-runtime.js:183,211-214,419-423` 创建 `<workflowExecutionDir>/admission-control.json`，注入 engine 并暴露进程内 pause/resume/status。`engine.js:119-120,372-375` 有普通准入和 reconcile 后 checkpoint；`:480-489` 显式 recovery 无 control。pause 不等待已过 checkpoint 的 inflight 排空。
- A 的 `packages/workflow-execution/src/engine.js:35-49,84-85,316-332` 没有该 control/checkpoint。A `packages/production-runtime/src/workflow/capability-runtime.js:42-59` 只有 traces、attention、kick、ownerAssistanceWake；A 的 `packages/product-api/src/workflow-execution-routes.js:5-13` 无 pause/resume 入口。
- 对 A packages/scripts 的 `git grep -n -E 'AdmissionPauseControl|admission-control.json|pauseAdmission|resumeAdmission'` 无命中（预期 no-match rc=1，不是验收门运行失败）；scheduler 的 admissionStatus 是无关字段。

源码推导：保留旧 `paused:true` 文件不能证明 A 跨 restart containment；poller/kick 仍可能正常准入。旧 pause 也不覆盖显式 recovery/已过 checkpoint inflight。未执行 live pause 或生产准入测试。

### K26 — source stamp writer/reader/reuse/backup 格式冲突

| A 的固定位置 | 实际行为 |
|---|---|
| `scripts/lib/trusted-source-git-stamp.sh:3,36-49` | 输出无分隔 `<40位 commit><十进制 dirtyCount>` |
| `scripts/trusted-cp-deploy-install.sh:603,831` | 原样写 harness/.source-stamp |
| 同文件 `:780-781` | reuse 原文比较 legacy wire |
| `scripts/agent-core-backup-ops.sh:262-270` | 取前40字符作 commit |
| `packages/agent-provisioning/src/index.js:93-120` | JSON.parse，exact keys `{commit,dirtyCount}`；commit 为40位小写 hex，dirtyCount 非负且必须0 |
| 同文件 `:138-146` | Git 不可用时调用该 JSON reader |

4fc 的 installer `:604-606,784-785,836` 则构造/比较/写 JSON；backup `:266-275` 支持 JSON 与历史 wire。4fc 还含 npm platform/arch 和 pnpm --force 变化，不能整个当作 stamp-only 修复移植。

源码推导：无 `.git` 的部署 harness legacy stamp 会进入 JSON consumer 的 `dsh_commit_mismatch`；已有 JSON stamp 反向交给 A reuse/backup 也不兼容。本轮没有改 stamp、伪造 dirtyCount、运行安装器或执行该 consumer 的动态测试。

关键固定文件 SHA-256：

```text
26813473 packages/workflow-execution/src/admission-control.js
4c4fb663e5b394102f1b88f7967cb56dc7be519239ff7cc895a09a0a5267463f
A scripts/lib/trusted-source-git-stamp.sh
64c2bb1b2be9464e10406685243f9661090795d7c2246cf2b35a08585bc4e847
A scripts/trusted-cp-deploy-install.sh
99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c
A packages/agent-provisioning/src/index.js
ba397d8cb92d56f11158400256097379edbea69271a6ac5fee471b56127eb0cf
A scripts/agent-core-backup-ops.sh
245d4dc926ede0bbdb06cee81f8cecb021530f0ac7b6b2f321a82bc00238d210
```

S05 调查完成；K24/K26 的 bootstrap/受影响 consumer 就绪仍为 **NO**。实际 loaded writer/reader、生产 pause 状态、live pause 入口、旧 inflight/tools/远端 effects、生产 stamp provenance 均 UNKNOWN。S04 启动即使未来通过，也不会自动解除 S05。本轮无实现、Spec 修改或生产权限。

## 6. 证据封存与下一动作

本轮 raw artifacts 均保留在 `/private/tmp/fleet-w6-s04`，不进 Git。文件哈希如下（封存清单本身 SHA 单列）：

| 文件 | SHA-256 |
|---|---|
| `STOP.json` | `79c80814fd669ade4b8862efd438d8dae0d7023c4792db5a69d8b7a557429f4d` |
| `STOPPED-W6-S04.md` | `2c3ee96fbff30b2bcd6e6679f610de696238573eecbbeb276d57200fafcd9053` |
| `cold-payload-static-binding.json` | `0317f73a6eb2ad5940bbb40ff774a129f7a1fbfe74b2348ce04bbb1c050ac64d` |
| `cold-worker-proposed.mjs` | `f28e271940b5995d1c39e0a9c20ac6a32083087cfcee1501647c42205495a0dc` |
| `execute.py` | `06f5f7905c3ddbce5cce92e99895f68d85ceb4b7a276f09c4d279ad0fed0d8f2` |
| `harness-tracked-source-binding.json` | `f576bb7c3e9f69a851554b5ccd24afdbf6884cdec6cb923867b9bea63b4568f8` |
| `preparation.jsonl` | `6a5825e2c854cdc0d6781df5cf8e479917ddd3ee8f88c79897f64fac505a1591` |
| `s05-readonly-source-observations.json` | `6bf9c9bec248e08567920fb464581b64c7ac51b64007b20698e06b7750d2a526` |

`EVIDENCE-MANIFEST.json` SHA-256：`2983bfd6023e84fc133a28f9eb039ab4ab8736bd8d806034c3d968f668d260c3`。本收据内嵌停止原文、准备原文和关键静态 hash；raw artifact 仍是本机临时路径，不承诺远端永久可用。没有把 inaccessible raw evidence 视为远端可复现 PASS。

最小后续：另一次明确恢复执行指令下修正 recorder 的 built 路径并保留本次失败，先完成新 harness payload/source/依赖绑定，再按原顺序执行未跑门。scratch 必须最终使用冻结 13ecda5c payload；当前旧 scratch 不得放行。这里不自动重试，不请求生产授权，不声明生产就绪或验收。
