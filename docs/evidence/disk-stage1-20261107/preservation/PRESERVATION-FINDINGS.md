# Codex preservation 创建链只读调查

观察窗口：2026-11-07 15:46:49–15:48:46 UTC（23:46:49–23:48:46 Asia/Shanghai）；补充目录名/归档收据检查至本目录 supplemental.json 和 archive-receipt-metadata.json 各 observed_at。调查没有运行、加载、修改任何所查脚本/调度，也没有读取会话正文、DB 或认证配置。文件时间仅作元数据，不能代替最后业务引用。

**结论：现有证据不能建立“preservation 每晚重建”的实际创建链，该命题为 UNKNOWN；能够归属当前 rollout 可写 FD 的进程、两类真实备份 cron，以及独立 unattended campaign 的按轮次 rename 归档链。不能把这些不同事实拼成一个 nightly preservation 根因。**

## 现存体量与时间事实

下表为独立 du -k -d 2 观察，单位 KiB（1024 bytes）；sessions 正在增长，所以与同一窗口的逐文件 lstat 总和会有差异。目录无父子重叠项相加。du 不证明 APFS 独占物理块。

| 路径 | du KiB | GiB | rc |
|---|---:|---:|---:|
| `/Users/yanfenma/.codex/sessions` | 5,456,856 | 5.2041 | 0 |
| `/Users/yanfenma/.codex/worktrees` | 3,676,528 | 3.5062 | 0 |
| `/Users/yanfenma/.codex/identity-census` | 381,804 | 0.3641 | 0 |
| `/Users/yanfenma/.codex/archived_sessions` | 343,384 | 0.3275 | 0 |
| `/Users/yanfenma/.codex/.tmp` | 139,612 | 0.1331 | 0 |
| `/Users/yanfenma/.codex/memories` | 1,676 | 0.0016 | 0 |
| `/Users/yanfenma/.codex/memories_v2` | 388 | 0.0004 | 0 |
| `/Users/yanfenma/.codex/log` | 8 | 0.0000 | 0 |
| `/Users/yanfenma/.codex/rollout-migrations` | 0 | 0.0000 | 0 |

`observations.json.du` 保留每个完整 d2 排行和逐命令起止/rc；`metadata` 保留按路径月份、birthtime 日期及体量前20文件（仅元数据），没有会话内容。worktrees 前两大分别为 `dsh-native-tool-policy` 1,539,536 KiB、`native-tool-policy-spec-dsh` 1,539,256 KiB；具体子树排行见 du 收据。

- `archived_sessions` 共 445 个文件，全部 `.jsonl.zst`；最新现存文件 birthtime 与 mtime 均为 **2026-10-14T23:57:40.987369Z**。birthtime 分布跨全天小时；没有现存 2026-11 每晚新归档的证据。这并不能排除创建后又删除/替换或其他路径上的任务。
- `sessions` 元数据时点共 2,319 个文件，其中 839 个 `.zst`。按路径月份分域：2026/10 为 4,328,222,720 allocated bytes；2026/11 为 1,086,410,752；2026/09 为 173,187,072。都是 st_blocks 口径，非物理独占空间。
- `rollout-migrations` 现存为空。`memories` / `memories_v2` 约 1.64 MiB / 0.38 MiB，不能解释 GB 级 nightly preservation。两者 `.sqlite` 家族保持只统计/打开路径观察，不读内容。

## 创建者与当前消费者：已证和未证分开

2026-11-07T15:48:45Z 的 `lsof -nP -Fpcafn` 与 `ps -p … -o pid,ppid,lstart,comm` 记录在 `supplemental.json`。`access=u` 是以读写方式打开，并非创建 syscall 的历史审计：

| 进程坐标 | 当前直接观察 | 解释边界 |
|---|---|---|
| PID 30709 / PPID 54845 `zcode-cli`；23:42:07 本地启动 | 对本日 23:43–23:44 多个 rollout 保有读写 FD | 可归属当前 native Codex 会话持有者；历史创建 syscall 和 nightly schedule 未证明 |
| PID 30817 / PPID 54845 `zcode-cli`；23:42:30 本地启动 | 对本日 `rollout-2026-11-07T23-42-33-01a1b6ac-f9ff-7d01-b907-1883e01ef5d2.jsonl` 等保有读写 FD | 本轮及并行 native 轮次发生同时期 rollout 活动；不能归因于每日归档任务 |
| PID 55249 / PPID 55169 `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT`；11月3日启动 | 对本日3个 rollout 以及 **9月13日** `rollout-2026-09-13T13-53-38-01a09954-1165-7ae2-a5fb-e6f3b480121a.jsonl` 保有读写 FD（fd76） | 旧日期文件仍被活跃进程引用，必须保留；也不能把该 FD 当成已经完成读取/写入的审计 |

软件消费者有精确源坐标：`~/.codex-zcode-watch/bin/delivery_guard_cli.py:119` 和 `:235–249` 把 `~/.codex/sessions` 作为严格校验根，并以只读 FD 读取最多尾部 2 MiB 的生命周期记录。source SHA256=`61e5e5f9b1fc18702d4d15bf039e8b228319b2b6f86ed7bf67be640beeaf1e3b`。这是实际可执行消费者代码；本次没有执行它，不能因此断言当前调用发生。

正式历史引用反例：`workspace/artifacts/dsh-native-arm64-runtime-v1/owner-requested-final-head-evidence-check.json:20–23` 的 `original_review_provenance.path` 精确指向一个9月7日原 rollout（source SHA256=`cc8897ff8bcde4d29a58305ceeff3a3a9bc8fedacb75a79cc3a44f5288aff8c0` 以 supplemental.json 实测值为准）。该未压缩目标当前 `lstat=NOT_FOUND errno=2`；正式引用未消失，是否迁移/压缩的绑定未知，不能以目标未找到推导其替代副本无保留义务。

## 调度入口与覆盖边界

`observations.json.launchd_config_survey` 逐一列出用户 LaunchAgents、系统 LaunchAgents/LaunchDaemons 的当前 `.plist` 路径、label、SHA256 和必要非 Secret 调度字段。环境变量和 prompt 正文未导出。

1. `~/Library/LaunchAgents/com.codex.zcode-hourly-watch.plist:7–15` 调用 `/usr/bin/python3 ~/.codex-zcode-watch/bin/zcode_hourly_watch.py`，`RunAtLoad=true`、`StartInterval=3600`。源码 `zcode_hourly_watch.py:356–373` 可启动 continuation worker；`codex_continuation_worker.py:50–64` 组装 `codex exec … [resume session_id]`。这条链可产生新的 native Codex 轮次，但配置不是 nightly archival。**当前 `launchctl print gui/502/com.codex.zcode-hourly-watch` rc=113，service not found**；不能声称它现在在每小时运行。
2. 四个 `~/.codex/automations/*/automation.toml` 均为 `PAUSED`：`pdc-progressive-rollout-overnight`、`hr-b7`、`xcode-mac-presence`、`dsh-arm64-goal`。必要 id/status/rrule、原文件SHA与 prompt 关键词布尔值见收据；未导出 prompt。四份 prompt 未匹配 preservation、archived_sessions、rollout、backup、archive。状态配置不证明调度系统过去执行历史，也不覆盖原生服务内置任务。
3. **真实每日03:00 cron**：`bash ~/workspace/openclaw-backup/backup-all.sh`。源码 `:3–6` 注明 itops-agent 创建、仅关键配置/数据、不备份 session/媒体/node_modules；`:14` 为 `RETENTION_DAYS=7`；`:150–158` 按日期目录做原生保留清理。目标 `~/workspace/openclaw-backup/YYYYMMDD`；不是 `~/.codex` 创建链。本次只读脚本，没有运行备份/清理/SSH。脚本目录从10月31日至11月7日共8个日期树；可能由具体时间阈值和执行间隔造成，但本次不替其完整备份/保留正确性作认证。
4. **真实每日07:00 cron**：`~/workspace/scripts/project-scripts/backup-local-mac.sh`，目标 `workspace/project/backups/local-db`，`RETENTION_DAYS=30`（`:13`）；只覆盖脚本列明的本地服务DB备份，不能用于解释 Codex 归档。DB、备份负载内容均未读。
5. `local.codex-remote.cloudcli` plist 是 `RunAtLoad/KeepAlive` 的 Node server，非 nightly schedule。其 DB/认证配置未读。
6. 插件入口调查：`~/.codex/plugins/.plugin-appserver/codex-cli/codex-package.json` 仅表明版本 `0.166.0-alpha.5.1`、`entrypoint=bin/codex`；插件目录 maxdepth5 未见 memory 命名目录。它不证明 native memory job 的 scheduler/retention 实现。没有把 binary/版本号当创建者审计。

明确不足：以下 `.plist` 为 **PERMISSION_DENIED**，不重试提权、不猜配置：用户 `ai.openclaw.gateway.plist`，系统 `com.openclaw.forum-scheduler.plist`、`com.openclaw.gateway.plist`、`com.openclaw.workflow-dispatcher.plist`、`com.openclaw.host-exec-runner.plist`。`/Library/LaunchDaemons/zcode.fda-check.plist` 被 plistlib 判为 `READ_ERROR/ValueError`。因此不能声称全机器所有调度任务无 preservation。生产 Agent Scheduler/Workflow store、authsvc、generation、Secret/认证配置的正文不在读取范围，保持 UNKNOWN。

目录名覆盖：`~/.codex` maxdepth3、`Documents/Codex` maxdepth6、`Library/Application Support/Codex` maxdepth4 没有 `*preserv*` 目录匹配（完整 argv/rc 在 supplemental）；这只是名称搜索。Documents/Codex 的 archival/preservation 收据中，选查 `2026-10-18/three-session-followup-0743/ARCHIVE-INDEPENDENT-VERIFICATION.json` 指向 `pilot1156-review-20261018/native-conversation-20261018.source-addendum.fixed.tar.gz` 的一次 read-only tar validation（56 files），不是 nightly rebuild。workspace/artifacts 的精确 `.codex/sessions`/`archived_sessions`/`rollout-migrations` 文本索引发现历史来源引用，未绑定当前 nightly 创建入口。普通 preservation 一词也大量用于 B7/部署/回滚证据，名称相近不能合并为 Codex 归档责任。

## log / SQLite / rollout 增长补证（仅元数据）

`growth-metadata.json` 在 **15:52:00.443–00.687Z** 和 **15:52:16.101–16.392Z** 做了两次 lstat sweep，中间只等待15秒；未连接或查询 SQLite，未运行任何 potential producer。前后是同一批 inode 的元数据比较，文件数固定，错误列表均为空：

| 分域 | sample A allocated bytes | sample B allocated bytes | logical变化 |
|---|---:|---:|---:|
| `top-level-sqlite-and-index` | 3,752,521,728 | 3,752,521,728 | +0 bytes |
| `sqlite` | 13,422,592 | 13,422,592 | +0 bytes |
| `log` | 8,192 | 8,192 | +0 bytes |
| `sessions` | 5,594,112,000 | 5,594,112,000 | +106,713 bytes |
| `archived_sessions` | 351,625,216 | 351,625,216 | +0 bytes |

6个本日 rollout 在原 inode 上合计增加 **106,713 logical bytes**，allocated bytes 本窗口未变；`state_5.sqlite-wal`、`thread_history_1.sqlite-wal` mtime变动但大小/分配不变。`archived_sessions` 的文件数、logical与allocated总量均不变。这个短窗口只证明当前连续追加活动，不能预测一晚空间增长，也不能把 logical追加量当物理消耗量。

`thread_history_1.sqlite` 当前 logical=3,592,933,376、allocated=3,601,149,952 bytes，`logs_2.sqlite` 为74,813,440 allocated bytes，`logs_2.sqlite-wal` 为32,509,952 allocated bytes；它们都属于受保护的当前数据。相同窗口 lsof：PID30709/30817 持有 thread_history、state_5、memories两族；PID30709/30817/55249/93906 持有 logs_2；PID55169 持有 `~/.codex/sqlite/`。这些是实际消费者坐标，不存在以“日志”标签默认回收DB/WAL的结论。

`producer-process-paths.json` 用 macOS `libproc.proc_pidpath`（返回值/errno逐一留存）进一步绑定：

- PID30709、30817 → `/opt/homebrew/Caskroom/codex/0.164.0/bin/codex`（同dev/inode，现有文件metadata已收）；父PID54845实际程序路径为 `/Applications/ZCode.app/Contents/Frameworks/ZCode Helper.app/Contents/MacOS/ZCode Helper`，ps的进程名为zcode-cli。
- PID55249 → `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`，父PID55169 → `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT`。
- 内置 memory/archival 定时执行若存在，其真实 job实现、触发记录和保留政策尚无本次可读证据；另一个插件 appserver 的manifest版本不等于上述正在打开文件的CLI版本。

要最小补齐 nightly 因果链，缺件是 **一条被指称每晚重建的精确输出路径 + 对应前/后样本时间 + producer现有创建/调度收据的精确文件坐标**。当前 `NIGHTLY_OUTPUT_ROOT=UNKNOWN / NIGHTLY_RUN_ID=UNKNOWN / NIGHTLY_CREATOR_RECEIPT=UNKNOWN`，不能捏造一个应有路径。目前已针对 `~/.codex/{sessions,archived_sessions,worktrees,rollout-migrations,memories,memories_v2,log,sqlite}` 与顶层SQLite族完成当前路径绑定；这些路径各自的现存metadata不能代替丢失的历史创建审计。

## 新的具体线索：unattended campaign homes 归档链

由 workspace 分域调查提供精确路径后，本调查只读查验 `workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a76-pr106-owner-node-reference-candidate-20261029/` 的现存非 Secret 收据/源文件；**没有进入 `/Users/authsvc` 会话正文、DB或Secret**。完整必要字段、源SHA和代码行片段见 `campaign-archive-chain.json`。

**这是实际存在的按续跑轮次归档责任，不是目前已证明的每日定时重建，更不是 `~/.codex/archived_sessions`。**

- 12份 `a45/a88/a90/a91/a93/a96/a97/a98/a100/a101/a103/a104-home-sessions-archive-inventory.json` 共37条 archive entries；其中a97/a100为零entries，不能伪计为实际归档。原始 archivedAt 字符串逐一保留，有些含 `+00:00Z` 双重时区后缀，不替作者修正时间或据此排序执行。
- `a88-home-sessions-archive-inventory.json` 给出真正输出例子：`/Users/authsvc/.agent-core/agt_unattended-canary-trial-20261027-a9-cto/archive-trial-20261027-a88-sessions-41126d3c858c7491`。其余role/轮次是各自的 archive，不是同一路径每晚重建。a101 的 `movedFrom` 为对应home的 `sessions`，basis明确说明“新run admission因旧sessions拒绝 → rename-never-delete”。a103、a104和a105 prepare/one-shot mandate继续引用上一轮archive库存，说明正式保留/消费者引用存在。
- 续跑触发坐标：`a105-one-shot-launch-mandate.json` 记录 issuer 为 `resuming independent reviewer session (Root role) under PA2 pre-authorization`，`maxInvocations=1`，argv为 `/opt/homebrew/bin/python3 -B …/e2e-harness-g6-native-run-20261029-v14/continuous-run-to-launch.py --run-dir …/trial-20261027-a105`。这是收据对issuer/一次调用的自述，不能替代对作者真实权限或真实PID的另行核验，也不等于已经执行。没有可读cron/launchd证据将该轮次链绑定为nightly job。
- 可绑定的早期实执行例子：`a12-home-reuse-preparation/root-archive-execution.json` 记录 **2026-10-27T14:51:57.100796Z–14:51:57.611838Z**、实际argv `/usr/bin/python3 -I -B …/home-reuse.py archive --package-sha256 … --preflight-sha256 …`、`actualExitCode=0`。其结果 `archive-result.json` 实测SHA256=`4c9e73a8211ad2a79b3a641249151e715ad6ded9c01d978f7c1af95936058982`、`status=ARCHIVED_COMPLETE`，九个role各有原 `sessions` 到 `archive-a11-sessions-1fdef9c168e5a702` 的完成坐标，并保留a9/a10两个旧archive。实执行receipt提供任务级调用出处，未记录真实执行PID，不能补造。
- 复制方式已有明确源码：`a12-home-reuse-preparation/reuse_core.py:190–200` 逐home核前态、记录RENAME_INTENT、`:195` 调 `rename_exclusive(home_fd, 'sessions', row['archiveName'])`、再核前后tree一致；`reuse_fs.py:128–140` 是 **同parent `renameatx_np(RENAME_EXCL)` + `fsync`**。`a16-generic-home-archive-executor/execute_archive.py:507–518` 同样使用排他rename。已绑定a12执行属于名称移动，payload不会仅因rename产生全量独立物理副本；后续新轮次产生新sessions才增加新数据。不能将这段旧源码自动绑定成a104实际执行脚本。
- 当前保留消费者的源坐标：`e2e-harness-g6-native-run-20261029-v14/home_run_admission.py:69–75` 对现存active `sessions`报 `ACTIVE_SESSIONS_PATH_PRESENT`；`:427–429` 在准入时要求active sessions缺席且逐项 `check_archive`。`:405–409` 的老固定模式要求a9/a10/a11三个archive，generic generation模式另绑定已有库存。现存库存是准入/恢复证据依赖，不能按年龄直接删。没有在所查source/receipt找到按天TTL或自动清理规则。
- `poll-a101.sh` 是50次、每次120秒的 `pgrep` + `psql` 观察，源码没有archive/rename/copy写入。脚本本次未执行；不能把该poller当归档producer。

因此当前能解释的 accumulation 是“运行留下sessions → 下一轮fresh-home准入拒绝 → 一次性归档保全并续跑”这一有实收据的责任链。它不是已证明的Codex nightly全量复制根因。剩余最小缺件是后续a104等每次inventory所对应的**精确执行receipt/代码pin/PID**，以及Owner所称nightly输出的精确根路径；不能用该campaign填补原生Codex归档的未知部分。

第三阶段建议增量：复用这条已有home-generation/准入receipt链，为已终止、没有消费者/rollback pin的旧generation提出引用迁移与精确GC提案；先补消费者pin/最后引用，不把需要保留的归档改成删除。源路径已指向受保护authsvc域，本阶段只统计，任何未来实际GC另属第二/第三阶段。

## 保留依据与第三阶段最小建议

- 当前 Codex sessions 有活跃读写 FD、实际源码消费者、正式审核 provenance 引用；本阶段全部 **RETAIN**。archived_sessions 未观察到打开 FD，但 last consumer/保留TTL均 **UNKNOWN**，仍 RETAIN，不能因无句柄或旧mtime判定可删。
- 本次没有找到 Codex native archival/memory-job 的已接受保留政策或精确GC入口，故没有可核验的“今晚又重建”诊断，也没有可安全关闭的确切任务。不要修改已查明的03:00/07:00备份去试错。
- 第三阶段最小修订候选：只在真正 producer 已绑定后，给其现有收据增加 `producer PID/PPID/entrypoint SHA/schedule ID/run ID/source manifest/output manifest/copy mode/retention policy/consumer pins`；按已接受政策的 live-reference/rollback/recovery/receipt pins 建 dry-run 清单与预算。配额/TTL的数值须由Owner第二阶段决定。先证明引用可转移与可恢复，再批准精确GC，不新增第二个盲目全量归档器。
- 若后续确有某晚体量跳变，应对同一路径在前后两次只读取样建立 inode/birthtime/mtime/blocks 增量，匹配该窗口的已有创建/调度收据；无此历史证据时保持 creator/trigger UNKNOWN。本阶段不启用 fs tracing、不运行隐藏诊断/本地CLI以免其初始化写状态。
