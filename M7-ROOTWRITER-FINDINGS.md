# M7 root 写者调查（只读）

调查日期：2026-11-08，时区 Asia/Shanghai（UTC+08:00）。最近条目表及摄入判断冻结于 23:16:43；指定请求另于 23:19:12 补核绑定。后续自然活动不覆盖这些时间坐标。本记录是调查，不是产品授权或生产恢复验收。

## 结论

1. **现场抓到 root 发送写者**：23:12:12 的 `ps` 记录 PID **93744**、UID **0**，argv 为 Homebrew Python 执行 `dispatch.py send`。祖先链为 `launchd → ZCode → zcode-host-local-1 → zcode-cli → zsh(uid502) → sudo → Python(root)`。23:12:14 出现 registry 原子替换；23:12:21 对应新派发 `9bb647ff-7edd-4f52-b2c8-daa99b052f6e` 记录为 `DELIVERED`。本调查没有发起这次派发。
2. **周期写者也已现场抓到**：23:16:23 的 root PID **96689** 执行 `dispatch.py wait-sweep`，父链 `launchd → sudo(96687) → Python(96689)`。对应已加载的 `gui/502/com.r124-wait-sweep` 每 900 秒触发。该次替换后文件内容 SHA-256 完全相同，sent=1014 不变，日志新增 `no due items`。因此周期 mtime 不能单独证明刚发送了消息。
3. **root 上下文 M7 发送实际在工作**，依据是本次现场 root `send` 进程、写入窗口和新 `DELIVERED` 的关联。此前 22:51 那笔另有精确 Dispatch-ID 摄入证据；不能仅凭后来 root 属主反推那笔历史发送者 UID。两者均不能证明 Workflow transition 或业务完成。
4. **尚未发现 HR 可调用的受限 root 派发接口**。已安装的 sweep 是固定调度器，其登记项的 `consume` 经 `bash -c` 执行；它不是可直接开放给 HR 的认证请求接口。本调查只给机制选项，未启用任何路径。

## 坐标、授权与输入缺口

```text
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /Users/yanfenma/workspace/project/worktrees/recon-m7-writer
BRANCH = recon/m7-root-writer
START_HEAD / BASE_HEAD = 6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef
SPEC_GOVERNANCE_MODE = PREFLIGHT
ROUTE_STAGE = OPERATION (read-only investigation and documentation)
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = repository development governance; no Product Contract change
IMPLEMENTATION_AUTHORITY = not_applicable
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE (published evidence report)
EXECUTION_MANDATE = current Owner task + BRIEF-M7-ROOTWRITER-HUNT.md
MUTATION_AUTHORIZATION = isolated report/evidence, commit, push, PR(base main) only
PRODUCTION_WRITE_ALLOWED = NO
MERGE_ALLOWED = NO
GOAL_OR_TARGET = identify root writer, dispatch behavior, trigger chain, uid502 options
CURRENT_GAP = root-owned registry and mtime did not identify process or successful send
EVIDENCE_NEEDED = ps/mtime/fs trace, registry readback, launchd/source/log provenance
DONE_WHEN = findings + evidence + independent review + commit/push/open PR; no merge
EXPANSION_TRIGGER = production mutation, new dispatch, permission change, process control
```

已完整读取根目录简报、`.agents/README.md`、`.agents/local/README.md`、`AGENTS.md`、`spec-governance/SKILL.md` 与 PREFLIGHT mode；读取 Product Architecture、Current Decisions 索引、Hardening Program 的相关身份边界及 accepted adoption/lock。没有修改这些 authority。

**指定前置材料缺失**：`STOPPED-M7-RESOLVER.md` 不在本 worktree，精确文件名搜索项目/worktrees、workspace/artifacts、`/private/tmp`、Documents/Codex、`.agents`、`.agent-core`、`.openclaw`、`.zcode` 和 authsvc homes/workspaces 均未命中；也无该路径的 Git 全 ref 历史命中。已询问原文件位置。本报告没有完整读到它，故 **a–d 四源不可用仅是任务提供的摘要，未独立复核原文**。不复跑四源、不修改解析源，也不据此判定业务不存在。这个输入缺口不改变下面独立取得的写者证据；写者已可判定，故未写 `STOPPED-M7-ROOTWRITER.md`。

## 现场发送写者：PID 与 argv

只读采样器用 `ps -axo pid=,ppid=,uid=,lstart=,args= -ww`，约每 0.35 秒取快照；以约 0.10 秒间隔 stat registry。原始选段及完整相关 argv 保存在随本 PR 提交的 [固定证据](docs/reports/m7-rootwriter-20261108-evidence.json)。以下 argv 省略长任务正文；完整版本以证据 JSON 为准。

```text
2026-11-08T23:12:12.323062+08:00
 PID   PPID UID  argv
93744 93739   0  /opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python dispatch.py send --agent Build in Public 主理人 --instances 89f19a8b-da6a-4eed-819b-730b49aa670c,2a5c8a00-8716-4bae-8ac4-a37fea07ab6f --task … --acceptance …
93739 93735   0  sudo -n python3 dispatch.py send …
93735 81031 502  /bin/zsh -c … cd ~/.agents/skills/dispatch/scripts && sudo -n python3 dispatch.py send …
81031 81019 502  zcode-cli
81019 81002 502  zcode-host-local-1
81002     1 502  ZCode
    1     0   0  /sbin/launchd
```

这是外部 ZCode 会话树，调查 Codex 自身的父进程为 PID 89356；两条树不同。未凭应用名推断具体人类操作者或产品 Agent 身份，这两项仍 UNKNOWN。

23:19:12 对指定 `9bb647ff…` 做只读补核：将 ps argv 中 `\012` 还原换行后，`--task` 正文逐字包含于 registry 的不可变请求 text，任务 SHA-256 为 `94026e80615cc31702322d23583a1d7fdc503bbfe4e70141e8b492ea2090e1cd`；使用记录的 chat/text/idempotencyKey 重算 requestHash，等于存储值 `fce7825add69e39b1f8dfe14c77542207149b015b83262b9a6bed5e1099563ad`。这补强了进程与具体派发对象的关联。

文件变化原文：

```text
23:12:14.506913 stat:
before inode=361255566 mtime_ns=1794150083116934258 uid=0 mode=0600 size=2128268
after  inode=361267478 mtime_ns=1794150734405732334 uid=0 mode=0600 size=2132790
23:12:15.594198 sudo -n lsof -nP <registry>: rc=1, stdout="", stderr=""
```

`lsof` 未抓到打开描述符；这个空结果未用于否定写入。并行的内核文件采样命令是 `sudo -n /usr/bin/fs_usage -w -f filesys -t 480 Python`，其过滤输出原文包含：

```text
23:12:14.405183 WrData[S] … /.reg-tyl34rh5.tmp … Python.1536229
23:12:14.408344 rename … /.reg-tyl34rh5.tmp … Python.1536229
23:12:14.408420 chmod <rw-------> … /lark-cli-registry.json … Python.1536229
23:12:21.050637 rename … /.reg-0_qz2_iy.tmp … Python.1536229
23:12:21.050673 chmod <rw-------> … /lark-cli-registry.json … Python.1536229
```

`fs_usage -w` 的 `Python.1536229` 后缀是 **thread ID，不是 PID**（本机 `man fs_usage` 的 PROCESS NAME 段）；本报告 PID 来自 `ps`。内核 trace、ps argv、创建/完成时间、条目对象和两阶段原子写入共同关联该发送；没有虚构 PID/thread 的直接映射。

## registry 最近条目与派发现状

实际路径：`/Users/yanfenma/workspace/artifacts/production-backlog-remediation-20261031/lark-cli-registry.json`。

23:11:42 只读快照：root:staff 0600，2,128,268 bytes，sent=1012，SHA-256 `82bd10bc69faabc4c9560c38177a1e0bfe8832772f58c0da96753541f1f42b1e`。23:12:54 只读快照：sent=1014，2,136,326 bytes，SHA-256 `1b0b2a4619af109341e782e4678869c0df46d6139057b29d188248bf76a0d52e`。

| sent index | agent | Dispatch-ID | 创建时间 | attempts 最后时间 / 状态 |
|---|---|---|---|---|
| 1011 | agt_article-publisher-agent | 02ef50bc-f5c1-4117-b2de-2ee89bc7cc24 | 22:51:23 | 22:51:26 / DELIVERED |
| 1012 | agt_build-in-public-agent | 9bb647ff-7edd-4f52-b2c8-daa99b052f6e | 23:12:14 | 23:12:21 / DELIVERED |
| 1013 | agt_article-publisher-agent | 57daddf5-9345-4c18-8b08-8f22ab617eda | 23:12:35 | 23:12:40 / DELIVERED |

以上时间均为 2026-11-08 UTC+08:00。三笔 `errorClass=ok`、`exitCode=0`，完整 `messageId`、attempts 和来源 hash 见固定证据。只将 **1012** 绑定到现场捕获的 root PID 93744；1013 另有 trace 写入，但未取得其 sender PID，不由此声称它的 OS actor。

源码 `send_msg()`（第 188–203 行）将 lark-cli 发送成功标成 `DELIVERED`；本地 skill 同时要求验证目标摄入。因此分层判定为：

- **发送侧成功：SUPPORTED**，包括本次 root 1012。
- **22:51 那笔目标摄入：SUPPORTED**。目标 `agt_article-publisher-agent` 的 main `session.jsonl` 第 7562 行 `agent/inbox/spliced`（seq 63543，22:51:30.241）和第 7566 行 `user/message`（seq 63547，22:51:31.638）包含完整 `02ef50bc…`。行 hash、绝对路径及毫秒时间在固定证据中。
- **23:12 两笔摄入：UNKNOWN**。截至 23:16:43 的固定 readback，在相应 agent 的 `/Users/authsvc/.agent-core/homes/<agent>/sessions/**/session.jsonl` 内未命中这两个完整 Dispatch-ID（采集器只检查文件 mtime 不早于当天 06:20 的文件）；不扩大成“所有入口均未摄入”或“发送失败”。未执行会以 O_CREAT/O_RDWR 打开锁的 `dispatch.py verify`，只直接读 session 文件。
- **Workflow transition / 业务完成：UNKNOWN，未调查/未核验**；发送和摄入不能替代真实业务回执。

registry 不记录 OS PID/UID/argv；原子替换也会重置 owner。因此此前 registry 的 root 属主不能证明所有历史派发均由 root 发送。

## 周期写者与触发链

`/Users/yanfenma/Library/LaunchAgents/com.r124-wait-sweep.plist` 的原文配置：

```text
ProgramArguments = /usr/bin/sudo -n /usr/bin/python3 /Users/yanfenma/.agents/skills/dispatch/scripts/dispatch.py wait-sweep
StartInterval = 900
RunAtLoad = true
StandardOutPath = /Users/yanfenma/Library/Logs/r124-wait-sweep.log
```

23:11 前的 `launchctl print gui/502/com.r124-wait-sweep` 原文为 `type = LaunchAgent`、`runs = 35`、`last exit code = 0`、`run interval = 900 seconds`。当前源码（SHA-256 `9dd3989842f2252f29d02d2f89c980d90b043a6554e66e7e6b96db726a4549a7`）关键逻辑节选（注释为说明，完整逐行原文在证据 JSON）：

```python
# dispatch.py:213–221, 533–559, 567, 627
def record(reg, entry=None):
    # mkstemp in REG.parent; json.dump; flush; os.fsync
    os.replace(tmp, REG)
    os.chmod(REG, 0o600)
def cmd_wait_sweep():
    # lock and inspect waits; collect fired
    record(reg)  # unconditional, even fired == []
    # only fired items invoke subprocess.run(['bash','-c',w.get('consume','')], ...)
    # if not results: print('WAIT_SWEEP: no due items')
```

现场周期样本原文：

```text
2026-11-08T23:16:23.304066+08:00
96689 96687 0 /Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python /Users/yanfenma/.agents/skills/dispatch/scripts/dispatch.py wait-sweep
96687     1 0 /usr/bin/sudo -n /usr/bin/python3 /Users/yanfenma/.agents/skills/dispatch/scripts/dispatch.py wait-sweep
    1     0 0 /sbin/launchd

23:16:23.509102 stat:
inode 361267858 → 361270191
mtime_ns 1794150760469253757 → 1794150983453776766
uid=0 mode=0600 size=2136326 → same
sha256 1b0b2a4619af109341e782e4678869c0df46d6139057b29d188248bf76a0d52e → same
launchctl runs 35 → 36; last exit code=0; sent 1014 → 1014
no due items line count 121 → 122
```

这将“空扫描也写文件”的源码解释绑定到了本次实际进程和文件结果；不是历史残留，也不是本周期失败循环。历史日志原有 121 条 `WAIT_SWEEP: no due items`、mtime 为 23:01:23.119365，本次新增后为 122 条。registry 的 waits 为 5 条 `ARCHIVED_LEGACY` + 5 条 `CONSUMED`，没有当前 WAITING 到期项。四条历史自动消费的 `consumed/CONSUMED` 回执包括两条今天早上 09:12–09:13 的 sendOk/strong verify；不把无时间戳日志行当本窗口派发。stderr 的旧 `KeyError: 'consumption'` mtime 为 11-07 14:53:37，不能作为当前失败证据。

root crontab 无条目，uid502 crontab 未发现 dispatch/wait-sweep；这是所检查范围内的阴性结果，不声称穷尽所有可能触发器。

`.audit-heartbeat` 的独立来源为 `gui/502/com.workflow-audit.deterministic → /usr/bin/python3 …/audit_deterministic.py`，间隔 1800 秒，源码第 32 行写心跳。它未引用 registry；不能把 uid502 心跳当 root 写者。

## uid502 / HR 的可达性选项（未实施）

本调查操作者 UID=502，`sudo -n id` 实测返回 UID=0，host sudo policy 含 `(ALL) NOPASSWD: ALL`。这只证明当前操作者主机能力；不能推导 HR 的工具环境、执行授权、调用边界也相同，更不授权任意 root 执行。已观察到的 ZCode 路径是操作者经 sudo 使用 M7，并非已建立的 HR 自助受控 API。

| 选项 | 可复用事实与所需条件 | 当前可达性结论 |
|---|---|---|
| 既有 root 操作者代执行精确请求 | 经明确任务授权，fresh-read 精确实例，调用现有 M7，回传 Dispatch-ID、messageId、目标摄入；不重放 UNKNOWN | 操作者 root send 本次实证工作；本调查未发送交办，HR→操作者的受控请求入口未证实 |
| 受限特权派发服务/固定 helper | 调用者认证，固定 M7 操作，严格 schema/对象范围/授权绑定/幂等/查询回执；禁止任意命令及 bash -c 输入 | **候选设计，未安装/未授权/未验收**；不能直接开放现有 wait consume |
| uid502 非敏感权威映射投影 | 由 authority owner 发布最小 agent→chat/current identity 投影，保留来源/时效；另核 registry/lock/board 写入及凭据边界 | **候选设计**；只解决部分解析读权限，不保证端到端 send；不得复制 Secret 或直接 chmod 生产文件 |

现有 wait 登记也要读写 root0600 registry/锁；把 HR 请求直接追加 waits 既违反本任务零生产写入，也不是当前已证明可达的受限机制。上述选项均需各自后续授权和审查，本报告不选择或激活它们。

## 证据与边界

固定证据 JSON 保留观察时间、源 metadata/hash、原始 ps/文件 trace 选段、registry 字段投影、session 行坐标/hash及 launchd 原文。完整本地采样位于 `/private/tmp/m7-rootwriter-20261108-2x3kyfey/`；该目录只作为临时原始留档，PR 内固定证据不依赖它长期存在。归因时排除调查器自身读操作，无关 ps 匹配不纳入写者结论；未发布 Secret 内容。

所有生产访问均为 stat、read、ps、lsof、launchctl print、crontab -l、只读 log 查询或有超时的 fs_usage 采样。没有执行 dispatch/resolve/verify/wait-sweep，没有发送消息、改权限、改配置、重启或终止进程。自然发生的 ZCode/launchd 写入单独归因，不算调查器的生产写入。采样器按预设期限自然退出。

验证：vendored governance integrity（含 accepted adoption）PASS；JSON 解析及 sent/count/hash/inode/noDue/UID-PID/requestHash/trace 自然结束的一致性检查 PASS；`git diff --check` PASS。独立审阅 `/root/findings_review` 已核原始采样、来源 hash、registry 请求对象及六条受保护 session 原始行，`FROZEN_BLOCKER_UNION=[]`。最终 commit 的 delta 复核和 PR 坐标记入 PR；本交付无产品代码改动，未运行无关产品测试。
