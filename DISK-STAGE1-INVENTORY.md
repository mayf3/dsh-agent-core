# DISK-STAGE1-INVENTORY — Agent 磁盘占用只读实证盘点

本阶段删除 **0 bytes**、移动 **0 项**、生产配置/DB/Secret/活跃 Agent 内容写入 **0 项**。没有执行受查备份、归档、构建、调度或GC脚本；没有提权。仅本隔离 worktree 写入调查报告/脱敏收据，Git 分支/push/PR 属 Owner 明示交付范围。**本报告不授予清理权限；当前已证明可安全回收量为 0。**

固定基线 `bb67ce5ae53908c299e751d3904793b9f4d08240`（远端 main 于建分支时读回）；分支 `docs/disk-stage1`，worktree `/private/tmp/h-disk-inventory`。Owner 原任务见 [BRIEF-DISK-STAGE1.md](BRIEF-DISK-STAGE1.md)。当前调查来源、命令、实际 rc、起止时点及权限错误均落盘，后续时间不倒灌到前一采样。

## 1. 空间账单与约47G差额核对

单位统一：**GB=10⁹ bytes；GiB=2³⁰ bytes；du 的 KiB=1024 bytes**。主账单选唯一 canonical Data 根 `/System/Volumes/Data`，避免 firmlink/父子树重复；不将整个home与其workspace/Codex子项相加。

[同窗命令收据](docs/evidence/disk-stage1-20261107/space-commands.json)：`df -k` 于 **2026-11-07T15:45:01.839Z** 采前态，`du -x -k -d 2 /System/Volumes/Data` 于 **15:45:02.308–15:48:23.690Z** 扫描（201.382秒，rc1），**15:48:23.691Z** 立即采后态；APFS plist 前后各一份。北京时间为11月7日23:45–23:48。只读授权下未冻结writer、未创建快照，所以这是**同一采样窗口**，不冒称同一纳秒原子快照。Data前后变化仅 −5,611,520 bytes；整个容器free增加5,615,616 bytes，不能归为本次释放。

| 口径 | 前态 bytes | GB | GiB |
|---|---:|---:|---:|
| 主APFS容器容量 | 994,610,155,520 | 994.610 | 926.303 |
| 主APFS容器实际已用 | 809,681,940,480 | 809.682 | 754.075 |
| 主APFS容器可用 | 184,928,215,040 | 184.928 | 172.228 |
| Data卷已用（diskutil；df同量级读回） | 767,850,934,272 | 767.851 | 715.117 |
| Data目录可见du（权限缺口，非独占物理量） | 749,962,634,240 | 749.963 | 698.457 |
| Data已用−可见du | 17,888,300,032 | 17.888 | 16.660 |
| 容器已用−Data可见du | 59,719,306,240 | 59.719 | 55.618 |

**本轮没有复现“约47G”作为同口径差值。** 未提供该旧汇总的路径集合、字节单位及采样时点，不能把旧差额当成已定位的垃圾。当前可复核的分解为：

- **59.719 GB = 41.831 GB + 17.888 GB**。前者是容器对Data之外卷及容器开销；后者是Data物理已用与可见目录分配量的有符号余量。后态余量为17.883 GB，两者都远小于47 GB。
- 容器其他项：System 12,639,158,272B，Preboot 9,085,718,528B，Recovery 1,639,956,480B，VM 18,257,113,088B，Update 2,375,680B，容器已用减各卷in-use总和的未归属开销206,684,160B。它们合计41,831,006,208B；共享可用容量不能把多行df的Size/Available相加。
- **17.888 GB尚未逐extent归因**。权限拒绝导致不可见数据，文件系统元数据与已unlinked仍打开文件会形成正余量；可见clone extent重复计算会把du往上推，方向相反。不能把整个正余量全叫权限数据、快照或缓存，也不能因为du有权限缺口就声称它是“物理占用下界”。它只是可见目录分配统计。

[原始字节账单](docs/evidence/disk-stage1-20261107/space-ledger.json)、[df前态](docs/evidence/disk-stage1-20261107/df-before.stdout.txt)、[df后态](docs/evidence/disk-stage1-20261107/df-after.stdout.txt)、[APFS前态plist](docs/evidence/disk-stage1-20261107/apfs-before.stdout.txt)、[Data完整d2排行](docs/evidence/disk-stage1-20261107/du-data-depth2.stdout.txt)。

### Data分域（同一du进程，互不重叠）

| 域 | 可见GB | 可见GiB |
|---|---:|---:|
| `/System/Volumes/Data/Users` | 589.690 | 549.191 |
| `/System/Volumes/Data/private` | 65.394 | 60.903 |
| `/System/Volumes/Data/Applications` | 34.878 | 32.483 |
| `/System/Volumes/Data/usr` | 33.711 | 31.396 |
| `/System/Volumes/Data/opt` | 15.383 | 14.327 |
| `/System/Volumes/Data/System` | 6.510 | 6.063 |
| `/System/Volumes/Data/Library` | 4.170 | 3.884 |
| `/System/Volumes/Data/Previous Content` | 0.214 | 0.199 |
| `/System/Volumes/Data/.PreviousSystemInformation` | 0.010 | 0.009 |

顶层之和749,962,626,048B与Data根749,962,634,240B只差根自身8,192B；并不存在顶层账单内部少了47G的数学缺口。

### 重复口径、快照与开放文件的实测

- `/Users`与`/System/Volumes/Data/Users`、`/private`与Data/private、`/usr/local`与Data/usr/local、`/Applications`与Data/Applications均为**同dev+inode**；`/tmp`与`/private/tmp`也为同对象。不得相加。
- 补采 `du -x -k -d1 /` 实测返回 **1,516,186,564,608B**，其中`/System`已含Data，别名视图又列出Users/private等；**本机`-x /`并不能得到隔离的System账单**。它是重复视图的反例，不用于总量。其窗口15:48:23–15:54:53与主账单不同；最终df Data增至771,018,907,648B，变化不归因为扫描，未定位的并发writer保持UNKNOWN。
- Data卷快照 **0份**；System卷有一份不可purge的`com.apple.os.update-*`启动更新快照。System快照不可再次加到卷in-use；未给出其独占空间，不能用它解释Data余量。
- `lsof +L1`按device+inode去重后，可见191个regular已unlinked文件，逻辑长度总计235,993,965B。不是235MB独占物理量，也未覆盖不可见身份；这不足以单独解释17.888GB。没有关闭任何进程或句柄。
- 挂载外盘`/Volumes/My PSSD`为 **ExFAT**，容量2,048,577,241,088B，后续du可见102,343,114,752B，主要models与cache。它不在主APFS容器内，不能做APFS clone推算。它的df前后发生较大变化，且du窗口不同，**外盘差额未归因**，不计入可回收收益。

[别名inode收据](docs/evidence/disk-stage1-20261107/path-aliases.json)；[root重复视图](docs/evidence/disk-stage1-20261107/du-system-depth1.stdout.txt)；[Data快照](docs/evidence/disk-stage1-20261107/snapshots-data.stdout.txt) / [System快照](docs/evidence/disk-stage1-20261107/snapshots-root.stdout.txt)；[unlinked摘要](docs/evidence/disk-stage1-20261107/open-unlinked-summary.json)；[外盘类型](docs/evidence/disk-stage1-20261107/external-info.plist)。

## 2. Owner重点域体量排行

这些子域有各自命令窗口，均在收据注明；不是另一份能与父级相加的总账。完整表与权限缺口分别在子报告。

| 域 | 排行与GiB |
|---|---|
| `/private/tmp` | 总14.209；W7 K26 requal 5.481（**回退材料保留**）；sw-367 0.532；gcr-svc-target 0.473；sw-1347-evidence 0.466；sw-aa-r4 0.313；sw-d6-fix 0.311。 |
| `~/.codex` | 总约13.74；sessions约5.20；worktrees 3.506（其中dsh-native-tool-policy 1.468、native-tool-policy-spec-dsh 1.468）；顶层thread_history SQLite约3.354；identity-census0.364；archived_sessions0.327；.tmp0.133。SQLite只lstat，不打开。 |
| `workspace` | 总248.573；project117.596；artifacts40.224；顶层.zcode-worktrees34.687；github14.056；worktrees12.753；deployment-artifacts2.914；deployment-worktrees1.268。 |
| `workspace/worktrees` | 52bd-svc-workflow2.594；m2-dispatch-intent2.184；codex-wec-kick-token-renewal1.633；native-goal-enqueue1.502；native-goal-integration1.488；harness-ac700-classification1.386。 |
| `workspace/artifacts` | workflow-unattended26.259（其ART10.062、current-input5.278、combined4.822、e2e-runs2.352、pg-cluster1.949，**DB保留**）；production-deployment-control-plane8.375（**闭包/lineage保留**）；goal-svc-zero-ops2.086；ac549-eacces-repro1.346可见。 |
| 重复构建/组装 | 大target分别5.201、4.750、4.186、3.871、2.589、2.517、2.179、1.626、1.407；依赖树hold-b7/node_modules4.106；三个ART/node_modules各1.323。后面按叶目录单列，未与父树相加。 |

`.zcode-worktrees/...dsh-agent-core/ac-810`总24.405GiB，主要是evidence24.393GiB；b7-first-batch-v5-build23.036、v3-pair workblock20.061、v50-release17.997都是**嵌套关系**，不是额外61GB。内含preimage/old install/backup/custody，整体排除GC候选。

生产域只统计：`/Users/authsvc`可见约23.192GiB、`/usr/local/libexec`可见约5.757GiB，均rc1、存在权限缺口；failed/quarantine/bak命名不解除rollback/pin。本报告未读取其中DB、Secret或活跃会话内容。另有活跃postgres PID30567/30569/30570/30572/30573/30574，cwd精确落在worktree的`.superpowers/gcr-tests/pgdata`，该DB保留。

[tmp排行/引用](docs/evidence/disk-stage1-20261107/tmp/REPORT.md)；[workspace排行/引用](docs/evidence/disk-stage1-20261107/workspace/WORKSPACE-AUDIT.md)；[Codex排行/创建链](docs/evidence/disk-stage1-20261107/preservation/PRESERVATION-FINDINGS.md)；[Codex顶层文件metadata](docs/evidence/disk-stage1-20261107/codex-root-files.json)；[libexec权限拒绝](docs/evidence/disk-stage1-20261107/du-libexec-depth1.stderr.txt)；[authsvc权限拒绝](docs/evidence/disk-stage1-20261107/du-authsvc-depth1.stderr.txt)。

## 3. 前20名条件式可回收候选

**20项均为HOLD；现在没有可安全执行删除的候选。** 这是在本次实测大域中筛出的**优先复核集合**，按分配体量降序；不是全机所有可再生目录的穷尽top20，也不把“未知”改写成“无引用”。workspace深度≤6枚举共2957个build类别路径命中（大量嵌套依赖），未逐一du全部目录；symlink、生产、DB、rollback/preimage与证据主体被排除。探测覆盖见 [覆盖/排除清单](docs/evidence/disk-stage1-20261107/workspace/coverage-and-exclusions.json)。

本表中 **A**=独立du/allocated计数，**P**=APFS `ATTR_CMNEXT_PRIVATESIZE`按dev+inode去重、且确认本根含该inode全部hardlink名字后的**私有payload估计**。P排除共享extent，不包含目录/inode元数据；不是实际释放承诺。合法解除所有引用/句柄、保持同一前态后，P才是优先采用的payload收益估计；共享块最后持有者和跨候选组合释放仍未知，A仅粗上界。**每项当前保证可回收量均0，实际释放也为0。**

20项A合计 **41,663,488,000B（38.802GiB）**，P合计 **34,060,652,544B（31.721GiB）**；这两数均不可写成“已确认可清理”。完整逐候选九字段与八类引用结果在 [20项机器可读矩阵](docs/evidence/disk-stage1-20261107/candidates-20.json)。

| ID | 精确路径 | A GiB | P GiB | 物理证据 |
|---|---|---:|---:|---|
| C01 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/svc-current-input-implementation/target` | 5.201015 | 4.820961 | clone>1文件177；hardlink inode3,584；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C02 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/svc-combined-integration-20261027/target-clean-f4a1` | 4.749569 | 4.368935 | clone>1文件177；hardlink inode2,972；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C03 | `/Users/yanfenma/workspace/.zcode-worktrees/workspace+project+svc-workflow/ac-1301-7cd-revise-fix/target` | 4.185993 | 3.569126 | clone>1文件346；hardlink inode1,605；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C04 | `/Users/yanfenma/workspace/github/deepseek-harness.hold-b7-20261001/node_modules` | 4.105900 | 2.634148 | clone>1文件56,407；hardlink inode3；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C05 | `/Users/yanfenma/workspace/project/svc-workflow/target` | 3.871174 | 3.444836 | clone>1文件278；hardlink inode1,851；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C06 | `/Users/yanfenma/workspace/worktrees/52bd-svc-workflow-20261101/target` | 2.589352 | 2.326942 | clone>1文件165；hardlink inode1,519；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C07 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a76-pr106-owner-node-reference-candidate-20261029/build-worktree/target` | 2.517281 | 2.072872 | clone>1文件161；hardlink inode475；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C08 | `/Users/yanfenma/workspace/worktrees/m2-dispatch-intent-20261101/target` | 2.178993 | 1.890903 | clone>1文件167；hardlink inode1,109；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C09 | `/Users/yanfenma/workspace/worktrees/codex-wec-kick-token-renewal-20261028/target` | 1.625694 | 1.577442 | clone>1文件161；hardlink inode256；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C10 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a76-pr106-owner-node-reference-candidate-20261029/helper-crate/target` | 1.406673 | 1.291435 | clone>1文件158；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-workspace.json) |
| C11 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a29-native-tool-env-luna/native-runtime-candidate/node_modules` | 1.323326 | 0.000000 | clone>1文件56,143；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-workspace-additional.json) |
| C12 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a45-trusted-native-tool-policy-runtime-20261028/native-runtime-candidate/node_modules` | 1.323326 | 0.000004 | clone>1文件56,142；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-workspace-additional.json) |
| C13 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a46-cross-definition-runtime-20261028/native-runtime-candidate/node_modules` | 1.323326 | 1.323326 | clone>1文件0；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-workspace-additional.json) |
| C14 | `/private/tmp/sw-367/target` | 0.532352 | 0.532352 | clone>1文件0；hardlink inode2,081；[probe](docs/evidence/disk-stage1-20261107/physical-tmp-leaves.json) |
| C15 | `/private/tmp/gcr-svc-target` | 0.473335 | 0.473335 | clone>1文件0；hardlink inode2,350；[probe](docs/evidence/disk-stage1-20261107/physical-tmp-leaves.json) |
| C16 | `/private/tmp/sw-1347-evidence/target-candidate` | 0.465870 | 0.465870 | clone>1文件0；hardlink inode1,809；[probe](docs/evidence/disk-stage1-20261107/physical-tmp-leaves.json) |
| C17 | `/private/tmp/sw-aa-r4-evidence/target` | 0.313068 | 0.313068 | clone>1文件0；hardlink inode1,277；[probe](docs/evidence/disk-stage1-20261107/physical-tmp-leaves.json) |
| C18 | `/private/tmp/sw-d6-fix/target` | 0.310982 | 0.310982 | clone>1文件0；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-tmp-leaves.json) |
| C19 | `/private/tmp/darwinx64-fix` | 0.251606 | 0.251606 | clone>1文件0；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-initial.json) |
| C20 | `/private/tmp/dsh-548-r5-evidence/base.tar` | 0.053310 | 0.053310 | clone>1文件0；hardlink inode0；[probe](docs/evidence/disk-stage1-20261107/physical-duplicate-archives.json) |

下表ID与上表一一对应。“最后引用”仅指**本次可定位的当前/历史观察证据**；全局最后消费者在未证明时仍为UNKNOWN，mtime/创建时间不代替引用。

| ID | 创建者/工具线索 | 最后观察引用及坐标 | 保留依据 | 可回收理由与验证 |
|---|---|---|---|---|
| C01 | Cargo构建，历史build-candidate.receipt.json可归属工具，具体caller/PID未知 | build-candidate.receipt.json start=2026-10-27T01:50:02Z; final-handoff.json head4eabe824; svc PR90当前MERGED | candidate/svc-workflow-4eabe824cc4a在target外独立保留；source-test-binding与原report保留 | 生成Cargo对象；验证V1；当前HOLD |
| C02 | Cargo childPid64152，clean-build.json精确targetDir/source绑定 | clean-build.json 2026-10-27T11:38:21Z; CURRENT main docs/reports/WORKFLOW_UNATTENDED_MECHANISMS_20261027.md:255仍引用该artifact | candidate-build-binding引用target/debug binary；target外candidate/svc-workflow-f4a1ed85与原receipt保留 | 生成Cargo对象；验证V1；当前HOLD |
| C03 | Cargo标记存在；具体creator/PID未知 | svc PR85当前OPEN，head e068dd0621068201dc1794133a7952b933e18dfe与当前worktree精确一致；本次registry仍登记 | HOLD_OPEN_PR；保持在审候选的构建回放能力 | 生成Cargo对象；验证V1；当前HOLD |
| C04 | pnpm标记存在；创建进程/copy方式UNKNOWN | 本次git读取：hold-b7 HEAD419ee11c，tracked约百项修改；当前worktree registry仍登记；literal文档检索无命中≠无引用 | 保留所有源码/lockfile/修改；dependency手工改动与重建能力未验证 | 生成依赖；验证V2；当前HOLD |
| C05 | Cargo标记存在；具体创建进程UNKNOWN | 本次svc-workflow git worktree registry登记main@88ff8145；target创建2026-11-01不等于最后引用 | 保留源码/lockfile/已登记checkout；未核生产reader/rollback责任链 | 生成Cargo对象；验证V1；当前HOLD |
| C06 | Cargo标记存在；具体创建进程UNKNOWN | 本次svc-workflow registry仍登记detached worktree@6cd6ae55；源码最后commit2026-11-04（不是target最后使用证明） | 保留已登记worktree与测试/发布trace；执行态UNKNOWN | 生成Cargo对象；验证V1；当前HOLD |
| C07 | Cargo标记存在；task a76构建输入可归属，caller/PID未知 | a76/svc-component.json:18、svc-source-pin-receipt.json:60、FINAL_CANONICAL_BUILD_INPUT.json:7精确target path；后续a105 mandate族存在 | 历史正式source/binary/closure引用仍在；只候选生成缓存，原mandate/source/独立binary不动 | 生成Cargo对象；验证V1；当前HOLD |
| C08 | Cargo标记存在；具体创建进程UNKNOWN | 本次svc-workflow registry仍登记detached worktree@d799bf27；target出生2026-11-02（不是最后使用） | 保留已登记worktree与锁定输入；执行态UNKNOWN | 生成Cargo对象；验证V1；当前HOLD |
| C09 | Cargo标记存在；具体创建进程UNKNOWN | 本次registry登记branch codex/wec-kick-token-renewal-authoring-20261028@dcd5fefb；PR91 MERGED head a381993与当前不同 | 保留后续source delta与历史调查docs/investigations/2026-10-28-owner-wake-token-lifecycle.md:10（artifact copy）；不能据PR合并丢target | 生成Cargo对象；验证V1；当前HOLD |
| C10 | Cargo标记存在；具体creator/PID未知 | a76 helper源码Cargo.toml/Cargo.lock仍在；同task a105 mandate族存在；target最后直接引用UNKNOWN | 需调用者证明helper可重建、消费者已终止/替代；mandate状态未知 | 生成Cargo对象；验证V1；当前HOLD |
| C11 | pnpm标记存在；creator/copy方式UNKNOWN | a29/STAGING-REPORT-004.md:17及A29-NATIVE-RUNTIME-CANDIDATE-MANIFEST.json:30/1034；报告mtime2026-10-27T22:10:36Z | 历史candidate manifest引用，保留原报告/manifest/source/lock；独立reinstall未执行 | 生成依赖；验证V2；当前HOLD |
| C12 | pnpm标记存在；creator/copy方式UNKNOWN | a45/native-policy-real-tool-dispatch-smoke.mjs:7引用native-runtime-candidate；mtime2026-10-28T03:30:15Z仅文件坐标 | 保留task smoke脚本/trace/source/lock；独立reinstall未执行 | 生成依赖；验证V2；当前HOLD |
| C13 | pnpm标记存在；creator/copy方式UNKNOWN | 本次literal引用检索范围内无report；package.json/pnpm-lock.yaml仍在；真正最后消费者UNKNOWN | 没有terminal/retention证明，HOLD_UNKNOWN_REFERENCES；独立reinstall未执行 | 生成依赖；验证V2；当前HOLD |
| C14 | Rust/Cargo build products; actual historical creating process UNKNOWN | DISPATCH-REGISTRY /history/273/note references parent /tmp/sw-367; no current exact target consumer observed | Rebuild requires retained source/compiler/lock proof; current .git incomplete; formal release UNKNOWN | 生成Cargo对象；验证V1；当前HOLD |
| C15 | Rust/Cargo build products from .o shape; creating actor UNKNOWN | UNKNOWN: no exact basename match in scanned tracked Core/Svc/Harness docs, readable launch plists or current crontab | Source/receipt/Workflow owner and recovery proof UNKNOWN | 生成Cargo对象；验证V1；当前HOLD |
| C16 | Rust/Cargo build products; parent delivery.json identifies ac-d6d11-impl / 22419bfc and svc PR115 | Parent delivery.json verified_at 2026-11-01T03:42:23.445349Z; live PR115 MERGED 2026-11-01T03:50:54Z | PR merge does not release original test evidence; preserve pgdata/delivery artifact; release of build outputs UNKNOWN | 生成Cargo对象；验证V1；当前HOLD |
| C17 | Rust/Cargo build products; actual creating actor UNKNOWN | UNKNOWN: no exact basename reference in scoped documentation/schedule readbacks | Parent has pgdata/dumps/red/frozen-overlay evidence; target-only disposal still requires source/replayable build proof | 生成Cargo对象；验证V1；当前HOLD |
| C18 | Rust/Cargo build products; actual creating actor UNKNOWN | UNKNOWN: no exact basename reference in scoped documentation/schedule readbacks | Source is incomplete/unknown in parent; preserve until recovered source and closure evidence | 生成Cargo对象；验证V1；当前HOLD |
| C19 | 19 versioned Darwin x64 npm tarballs + package-name list; actual creating actor UNKNOWN | UNKNOWN: scoped exact basename searches found no reference; no visible open handle | Need current W7/frozen archive dependency and content-integrity/re-download proof before GC | 版本化下载缓存；验证V2；当前HOLD |
| C20 | R5 run.py snapshot/archive函数；历史执行PID UNKNOWN。 | R5 run.py及preservation.log属于11/04 R5证据；run.py:13–14、:89仍引用R2/R4；本tar最后直接消费者UNKNOWN。 | 保留R2 master.tar与R4 base.tar及全部R5报告/manifest；原路径的引用/pin未解除，不能直接删除重复tar。 | 重复tar；验证V3；当前HOLD |

验证方法（第三阶段才执行任何重建或删除）：

- **V1 / Cargo**：原责任链确认source、Cargo.lock、toolchain、构建环境与独立交付binary/hash；先解除当前Workflow/Mandate/PR/Receipt/rollback/pin对精确target路径的依赖，再在获准隔离面验证重建。只评估target叶目录，保留source、DB和证据主体。
- **V2 / 依赖和下载缓存**：保留package/lock/integrity/版本和必要不可替代归档；查手工修改、实际symlink、活跃任务；在获准隔离面验证可恢复。不能因目录名node_modules或存在lockfile就认定可再生。
- **V3 / 重复tar**：重验R2/R4保留副本的完整SHA256与原消费者；获得对R5原路径/manifest/pin的明确处置，先迁移引用再讨论一份重复payload。保留原报告、原哈希和审计关系。
- **每项共同门**：新鲜进程/FD/cwd、可读调度及间接脚本、合法Workflow/Mandate服务读回、PR状态/精确head、Receipt、rollback与正式引用逐项重核；同口径APFS/private/clone/hardlink/快照；只有后续获批精确清单才进入第三阶段。当前这些条件未完成，不能按0句柄/PR合并判可删。

引用域检查并未留空：13项workspace逐项八域见candidate-reference-matrix；tmp各项见candidate-summary、scheduler-refs、registry-refs、selected-provenance和pr-readbacks。可见lsof无匹配仅是这个快照；962个可读plist与当前UID cron未见tmp精确basename，不排除间接入口。5个plist权限拒绝及解析失败完整保留。Workflow/当前Mandate/rollback状态未走合法服务读回，**UNKNOWN**；未打开生产DB取证，也没有绕权切换身份。

## 4. 大文件/硬链接/clone的物理空间判定

只用`lstat`与Darwin `getattrlist`，从本机SDK man/header读取真实API定义；`FSOPT_NOFOLLOW | FSOPT_PACK_INVAL_ATTRS | FSOPT_ATTR_CMN_EXTENDED`，返回mask逐项验证。没有创建测试clone、没有写受查文件。可复核脚本为physical_probe.py与physical_inventory.py；系统API源坐标/SHA在methodology-sources.json。

- **硬链接**：tmp Rust树内许多.o文件是同一dev+inode的多个名字。逐name相加会把sw-367膨胀到约2.29GB，gcr到3.64GB；实际唯一inode allocation仅571,609,088B与508,239,872B。被完整遍历的这些树中，名字数等于st_nlink，未发现树外hardlink；这是时点限定结论。单次du默认已去重，不能在其结果上再扣一次。
- **共享clone**：a45依赖树A=1,420,910,592B，P=4,096B，56,142文件clone_refcount>1；a29同A而P=0，56,143文件共享。单独清这些目录不应按各1.323GiB申报payload收益。即使两目录一起释放，剩余clone/extent持有者未闭合时也不能承诺整份A。
- **独立私有副本**：a46同体量依赖树P=1,420,910,592B，probe未见clone_refcount>1；它与a29/a45的物理属性不同。是否业务上可删仍由引用/恢复门决定。
- **实际重复大文件**：R2 master.tar、R4 base.tar、R5 base.tar三份完整SHA256均`5befa7695bfd22f8561bbf5d93fe6061866609985e963c0e9c8d74e751d166e8`；每份57,241,600B、nlink1、不同inode和cloneID，refcount1、private=allocated=57,241,600B。这次有独立物理payload证据，不只是hash相等。只将R5一份列条件式候选，R2/R4和跨轮证据继续保留。
- **缓存与稀疏**：cache是用途分类，不是物理属性；逻辑size与st_blocks/private分别记录。没有把虚拟盘逻辑容量或压缩文件解压大小计为可释放空间。ExFAT与受保护树不套用本次APFS私有量结论。

[硬链接去重](docs/evidence/disk-stage1-20261107/tmp/hardlink-accounting.json)；[三份完整tar哈希](docs/evidence/disk-stage1-20261107/tmp/archive-duplicate-hashes.json)；[tar独立物理probe](docs/evidence/disk-stage1-20261107/physical-duplicate-archives.json)；[a29/a45/a46实测](docs/evidence/disk-stage1-20261107/physical-workspace-additional.json)。APFS支持共享空间、clone与快照的官方背景见[Apple Platform Security](https://support.apple.com/en-gb/guide/security/seca6147599e/web)；本机物理量以上述本地观测为准。

## 5. preservation“每晚重建”根因：已证链与UNKNOWN

**不能把原生Codex归档、当前rollout增长、campaign的home保留和B7闭包preimage合并成同一个责任。** 本次找到实际按续跑轮次保留的创建/消费链，但未证实`~/.codex`每晚复制重建。

| 对象 | 实证创建/触发/消费者 | 保留与结论 |
|---|---|---|
| 原生`~/.codex/archived_sessions` | 445份全部.zst；最新现存birth/mtime2026-10-14T23:57:40.987Z；未找到11月nightly创建收据。 | TTL和全量producer UNKNOWN；保留。没有把旧文件时间直接当安全依据。 |
| 原生rollout当前增长 | proc_pidpath把30709/30817绑定Homebrew Codex0.164.0、55249绑定ChatGPT bundled CLI；有读写FD。15秒内六份同inode文件共增长106,713 logical bytes。 | 能证明当前轮次活动，不能证明创建syscall历史或夜间调度。9月13日旧rollout仍有PID55249 fd76读写引用。 |
| 我们campaign的home-session archive | a12 `root-archive-execution.json`实收据2026-10-27T14:51:57Z、rc0、9home `ARCHIVED_COMPLETE`；`reuse_core.py:195`→`reuse_fs.py:128–140`同parent `renameatx_np(RENAME_EXCL)`+fsync。后续12份a88–a105库存共37条archive记录。 | 目标在`/Users/authsvc/.agent-core/agt_unattended-canary-trial-20261027-a9-{role}/archive-trial-*`，不是`~/.codex`。这是**按轮次rename保留，不是全量copy重建**；不读取其受保护payload。 |
| campaign准入消费者 | `v14/home_run_admission.py:427–429`要求active sessions不存在并校验既有archive；a101 basis解释“新run因旧sessions被拒→rename-never-delete”。 | 无TTL清理规则；a104 inventory不能自证该次执行PID/脚本；a105 AUTHORIZED_ONCE不是已执行。consumer pins在，保留。 |
| 每日03:00 cron | `workspace/openclaw-backup/backup-all.sh`，脚本归属itops-agent，RETENTION_DAYS=7；声明不备份sessions/node_modules，目标按日期。 | 真调度、异责任；不能冒充Codex nightly根因。本次未运行。 |
| 每日07:00 cron | `workspace/scripts/project-scripts/backup-local-mac.sh`，RETENTION_DAYS=30，目标local-db。 | DB备份责任；内容不读，不归入Codex。 |
| Codex automations/hourly watcher | 4份automations配置均PAUSED；hourly-watch配置StartInterval3600，但`launchctl print gui/502/...` rc113未加载。 | 配置存在不证明运行；不改动它们试错。不可读launchd及native内置调度覆盖仍UNKNOWN。 |

准入consumer为何保留：每次续跑要证明旧home/session没有被未经授权重用，原保留链以archive库存作证；未发现接受过的TTL或解除条件。本次能解释**已有archive积累与我们轮次准入的关系**，不能将其扩大成“每晚都有全量新副本”。若要确认另一条nightly命题，最低缺件是精确增长根及同路径前后inode/blocks清单、已有run/创建收据；本次未开启追踪或生产诊断来制造历史。

实际源码消费者另见`~/.codex-zcode-watch/bin/delivery_guard_cli.py:119,235–249`；正式旧rollout provenance也仍有引用，未找到目标不解除压缩/替代件的保留义务。官方[Codex App Server说明](https://learn.chatgpt.com/docs/app-server)将archive/unarchive描述为日志目录之间移动；它不证明本机版本的执行史，也不提供这里可采用的nightly TTL。

[完整创建链调查](docs/evidence/disk-stage1-20261107/preservation/PRESERVATION-FINDINGS.md)；[campaign创建/消费源码与实收据](docs/evidence/disk-stage1-20261107/preservation/campaign-archive-chain.json)；[rollout增量](docs/evidence/disk-stage1-20261107/preservation/growth-metadata.json)；[实际可执行进程坐标](docs/evidence/disk-stage1-20261107/preservation/producer-process-paths.json)。

## 6. 权限缺口与结论边界

所有du stderr全文保留，权限拒绝逐路径记为 **PERMISSION_DENIED**，不置0、不提权、不因失败结束其他只读采集。Data/home/tmp/workspace/libexec/authsvc的rc1都代表不完整可见性。汇总索引见permission-index.json；原始错误来源保留，可由合法Owner继续复核。

没有查询生产Workflow/DB、Secret、活跃会话正文或运行隐藏诊断。因而当前Workflow/Mandate/rollback全量引用状态仍UNKNOWN，扫描未命中和无可见FD不能替代这类状态。没有任何“安全删除PASS”、完整nightly根因PASS或可释放物理总量承诺。

## 7. 第三阶段才实施的GC最小修改建议

以下为调查建议，不是新保留合同或实现授权；第二阶段由Owner决定具体清单/预算/TTL，第三阶段才执行：

1. 在**现有producer的原收据**补`producer PID/PPID/entrypoint SHA/schedule或run ID/source+output manifest/copy-mode/private bytes/consumer pins`。复用当前归档/构建责任链，不新增全量夜间复制器或第二事实账本。
2. 将生成target/node_modules与source/lock/toolchain、独立交付binary、Receipt/rollback/DB分清到精确叶目录。保留现有小型交付件；现存manifest若引用target/debug，先由原消费者确认可失效或迁移，不能先删再修引用。
3. 先提供list-only GC计划：仍OPEN的PR、活跃run/FD/DB、未知Workflow/Mandate、rollback-used、pinned、legacy和旧home准入证据一律保留；UNKNOWN不自动到期。不采用mtime全盘清理。
4. 已接受BACKUP_RETENTION_V1仅管其部署backup责任与已明确前置，不把NORMAL_RETENTION=3推广到Codex、campaign、tmp或全部历史闭包。campaign目前无TTL，新增/改变保留含义需其适用权威决策，不能用调查报告改旧stable ID。
5. 优先核独立私有payload较大的构建cache；对a29/a45共享clone先算实际收益，避免“清出两份2.65GiB”的虚报；重复tar在保留副本验证及原路径消费者迁移后再单项评估。
6. 后续执行应有精确路径/前态/引用处置/回退方式及单writer收据，并以同口径df前后区间验证；本阶段没有触发这一执行链。

## 8. 授权、复核与交付

本次route为 **REUSE / BRIEF / DURABLE / OPERATION**，仅调查+文档交付；依据Owner任务及基线已含CTR-SOD-002。Product Architecture的shared-host/Secret边界、D-008/D-009、DEVELOPMENT_EXECUTION_SURFACE的Operator retention及BACKUP_RETENTION的pin/legacy限制保持。未创建新产品合同、未改变retention、不执行治理/控制器升级、不合并PR。PREFLIGHT见preflight.json。

只读工具自身及原始元数据收据可供独立复核；已执行校验与非作者审查记录见VALIDATION.md、INDEPENDENT-REVIEW.md，证据文件hash见SHA256SUMS。commit与远端交付坐标由PR和最终交付读回记录；不能用“已入队/已运行/文档PASS”表示GC或生产结果。
