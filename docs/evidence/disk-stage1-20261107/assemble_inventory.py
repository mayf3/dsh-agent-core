#!/usr/bin/env python3
"""Assemble the read-only observations into reviewable Stage 1 documentation."""
import json,datetime
from pathlib import Path
P=Path(__file__).parent
G=1024**3
load=lambda n:json.loads((P/n).read_text())
phys={}
for f in ['physical-workspace.json','physical-workspace-additional.json','physical-tmp-leaves.json','physical-initial.json']:
 for r in load(f)['roots']:phys[r['path']]=r
rows=[]
for r in load('workspace/candidate-reference-matrix.json')['rows']:
 a=phys[r['path']]['aggregate'];rows.append({'path':r['path'],'allocated_bytes':r['du_allocated_bytes'],'private_payload_bytes':a['private_bytes_all_links_in_root'],'physical_probe':next(f for f in ['physical-workspace.json','physical-workspace-additional.json']if any(v['path']==r['path']for v in load(f)['roots'])),'creator':r['creator'],'last_observed_reference':r['latest_observed_reference'],'retention_basis':r['retention_basis'],'reclaim_reason':r['recoverability_reason'],'references':r['references'],'verification_method':r['verification_method'],'evidence':'workspace/candidate-reference-matrix.json#'+r['id'],'clone_files':a['clone_refcount_gt1_files'],'hardlink_inodes':a['hardlink_inodes']})
for r in load('tmp/candidate-summary.json')['rows']:
 if r['path'] not in ['/private/tmp/sw-367/target','/private/tmp/gcr-svc-target','/private/tmp/sw-1347-evidence/target-candidate','/private/tmp/sw-aa-r4-evidence/target','/private/tmp/sw-d6-fix/target','/private/tmp/darwinx64-fix']:continue
 a=phys[r['path']]['aggregate'];rows.append({'path':r['path'],'allocated_bytes':r['allocated_bytes_ceiling'],'private_payload_bytes':a['private_bytes_all_links_in_root'],'physical_probe':'physical-tmp-leaves.json'if '/darwinx64-'not in r['path']else'physical-initial.json','creator':r['creator'],'last_observed_reference':r['last_observed_reference'],'retention_basis':r['retention_basis'],'reclaim_reason':'生成Rust构建对象或19份版本化npm缓存；source/lock/完整性与重建性尚待验证。','references':{'process':'NO_MATCH_IN_VISIBLE_SNAPSHOT','schedule':'PARTIAL_READABLE_CONFIGS_ONLY; permission and parse gaps','Workflow':'UNKNOWN; no protected DB reads','Mandate':'UNKNOWN_CURRENT_STATE; historical references only','PR':'SVC115_MERGED'if'sw-1347'in r['path']else'UNKNOWN','Receipt':r['last_observed_reference'],'rollback':'UNKNOWN; preserve parent evidence/DB','formal_reference':r['last_observed_reference']},'verification_method':r['verification_method'],'evidence':'tmp/candidate-summary.json','clone_files':a['clone_refcount_gt1_files'],'hardlink_inodes':a['hardlink_inodes']})
f=next(r for r in load('physical-duplicate-archives.json')['files']if'r5-evidence'in r['path'])
rows.append({'path':f['path'],'allocated_bytes':f['allocated_bytes'],'private_payload_bytes':f['attr']['private_bytes'],'physical_probe':'physical-duplicate-archives.json','creator':'R5 run.py snapshot/archive函数；历史执行PID UNKNOWN。','last_observed_reference':'R5 run.py及preservation.log属于11/04 R5证据；run.py:13–14、:89仍引用R2/R4；本tar最后直接消费者UNKNOWN。','retention_basis':'保留R2 master.tar与R4 base.tar及全部R5报告/manifest；原路径的引用/pin未解除，不能直接删除重复tar。','reclaim_reason':'与R2/R4全SHA256相同，getattrlist实测私有独立数据57,241,600B；有保留副本的去重候选。','references':{'process':'NO_MATCH_IN_VISIBLE_SNAPSHOT','schedule':'PARTIAL; no literal basename match in readable configs','Workflow':'UNKNOWN','Mandate':'UNKNOWN_CURRENT_STATE','PR':'UNKNOWN; pull548 nonexistent, no numeric attribution','Receipt':'tmp/selected-provenance.json + archive-duplicate-hashes.json','rollback':'UNKNOWN; historical evidence retention not released','formal_reference':'R5 evidence and cross-attempt dependencies retained'},'verification_method':'Fresh full hash+retained-copy readback; update/accept original path consumers and pin disposition; recheck handles/Workflow/Mandate/rollback; stage3 only.','evidence':'tmp/archive-duplicate-hashes.json + tmp/selected-provenance.json','clone_files':0,'hardlink_inodes':0})
rows.sort(key=lambda r:(-r['allocated_bytes'],r['path']))
assert len(rows)==20
for i,r in enumerate(rows,1):r.update({'rank':i,'id':f'C{i:02}','current_disposition':'HOLD_NOT_PROVEN_SAFE','guaranteed_reclaimable_now_bytes':0,'actual_freed_bytes':0,'physical_interpretation':'APFS private payload estimate after all names in this root removed and references/handles legally released; shared-final-owner and inode metadata unmeasured; not an execution promise'})
# Paths are canonical and non-overlapping. Parent totals are excluded from candidate sums.
for i,a in enumerate(rows):
 for b in rows[i+1:]:assert not(a['path'].startswith(b['path']+'/')or b['path'].startswith(a['path']+'/'))
obj={'schema_version':1,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'20 prioritized non-overlapping candidates selected from measured Agent-related domains, ranked by allocated bytes; not an exhaustive globally ranked deletable set','rows':rows,'totals':{'allocated_bytes':sum(r['allocated_bytes']for r in rows),'private_payload_bytes':sum(r['private_payload_bytes']for r in rows),'guaranteed_reclaimable_now_bytes':0,'actual_freed_bytes':0}}
(P/'candidates-20.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(obj['totals'],indent=2))
ledger=load('space-ledger.json')
E='docs/evidence/disk-stage1-20261107/'
link=lambda file,label:f'[{label}]({E}{file})'
md=f'''# DISK-STAGE1-INVENTORY — Agent 磁盘占用只读实证盘点

本阶段删除 **0 bytes**、移动 **0 项**、生产配置/DB/Secret/活跃 Agent 内容写入 **0 项**。没有执行受查备份、归档、构建、调度或GC脚本；没有提权。仅本隔离 worktree 写入调查报告/脱敏收据，Git 分支/push/PR 属 Owner 明示交付范围。**本报告不授予清理权限；当前已证明可安全回收量为 0。**

固定基线 `bb67ce5ae53908c299e751d3904793b9f4d08240`（远端 main 于建分支时读回）；分支 `docs/disk-stage1`，worktree `/private/tmp/h-disk-inventory`。Owner 原任务见 [BRIEF-DISK-STAGE1.md](BRIEF-DISK-STAGE1.md)。当前调查来源、命令、实际 rc、起止时点及权限错误均落盘，后续时间不倒灌到前一采样。

## 1. 空间账单与约47G差额核对

单位统一：**GB=10⁹ bytes；GiB=2³⁰ bytes；du 的 KiB=1024 bytes**。主账单选唯一 canonical Data 根 `/System/Volumes/Data`，避免 firmlink/父子树重复；不将整个home与其workspace/Codex子项相加。

{link('space-commands.json','同窗命令收据')}：`df -k` 于 **2026-11-07T15:45:01.839Z** 采前态，`du -x -k -d 2 /System/Volumes/Data` 于 **15:45:02.308–15:48:23.690Z** 扫描（201.382秒，rc1），**15:48:23.691Z** 立即采后态；APFS plist 前后各一份。北京时间为11月7日23:45–23:48。只读授权下未冻结writer、未创建快照，所以这是**同一采样窗口**，不冒称同一纳秒原子快照。Data前后变化仅 −5,611,520 bytes；整个容器free增加5,615,616 bytes，不能归为本次释放。

| 口径 | 前态 bytes | GB | GiB |
|---|---:|---:|---:|
'''
for name,n in [('主APFS容器容量',ledger['apfs_container']['capacity']),('主APFS容器实际已用',ledger['apfs_container']['used_before']),('主APFS容器可用',ledger['apfs_container']['free_before']),('Data卷已用（diskutil；df同量级读回）',ledger['data']['df_used_before']),('Data目录可见du（权限缺口，非独占物理量）',ledger['data']['du_visible_allocation']),('Data已用−可见du',ledger['data']['df_minus_du_before']),('容器已用−Data可见du',ledger['data']['container_minus_du_before'])]:
 md+=f'| {name} | {n:,} | {n/1e9:.3f} | {n/G:.3f} |\n'
md+='''
**本轮没有复现“约47G”作为同口径差值。** 未提供该旧汇总的路径集合、字节单位及采样时点，不能把旧差额当成已定位的垃圾。当前可复核的分解为：

- **59.719 GB = 41.831 GB + 17.888 GB**。前者是容器对Data之外卷及容器开销；后者是Data物理已用与可见目录分配量的有符号余量。后态余量为17.883 GB，两者都远小于47 GB。
- 容器其他项：System 12,639,158,272B，Preboot 9,085,718,528B，Recovery 1,639,956,480B，VM 18,257,113,088B，Update 2,375,680B，容器已用减各卷in-use总和的未归属开销206,684,160B。它们合计41,831,006,208B；共享可用容量不能把多行df的Size/Available相加。
- **17.888 GB尚未逐extent归因**。权限拒绝导致不可见数据，文件系统元数据与已unlinked仍打开文件会形成正余量；可见clone extent重复计算会把du往上推，方向相反。不能把整个正余量全叫权限数据、快照或缓存，也不能因为du有权限缺口就声称它是“物理占用下界”。它只是可见目录分配统计。

'''
md+=link('space-ledger.json','原始字节账单')+'、'+link('df-before.stdout.txt','df前态')+'、'+link('df-after.stdout.txt','df后态')+'、'+link('apfs-before.stdout.txt','APFS前态plist')+'、'+link('du-data-depth2.stdout.txt','Data完整d2排行')+'。\n\n'
md+='''### Data分域（同一du进程，互不重叠）

| 域 | 可见GB | 可见GiB |
|---|---:|---:|
'''
for r in ledger['top_level_data'][:9]:md+=f"| `{r['path']}` | {r['bytes']/1e9:.3f} | {r['bytes']/G:.3f} |\n"
md+='''
顶层之和749,962,626,048B与Data根749,962,634,240B只差根自身8,192B；并不存在顶层账单内部少了47G的数学缺口。

### 重复口径、快照与开放文件的实测

- `/Users`与`/System/Volumes/Data/Users`、`/private`与Data/private、`/usr/local`与Data/usr/local、`/Applications`与Data/Applications均为**同dev+inode**；`/tmp`与`/private/tmp`也为同对象。不得相加。
- 补采 `du -x -k -d1 /` 实测返回 **1,516,186,564,608B**，其中`/System`已含Data，别名视图又列出Users/private等；**本机`-x /`并不能得到隔离的System账单**。它是重复视图的反例，不用于总量。其窗口15:48:23–15:54:53与主账单不同；最终df Data增至771,018,907,648B，变化不归因为扫描，未定位的并发writer保持UNKNOWN。
- Data卷快照 **0份**；System卷有一份不可purge的`com.apple.os.update-*`启动更新快照。System快照不可再次加到卷in-use；未给出其独占空间，不能用它解释Data余量。
- `lsof +L1`按device+inode去重后，可见191个regular已unlinked文件，逻辑长度总计235,993,965B。不是235MB独占物理量，也未覆盖不可见身份；这不足以单独解释17.888GB。没有关闭任何进程或句柄。
- 挂载外盘`/Volumes/My PSSD`为 **ExFAT**，容量2,048,577,241,088B，后续du可见102,343,114,752B，主要models与cache。它不在主APFS容器内，不能做APFS clone推算。它的df前后发生较大变化，且du窗口不同，**外盘差额未归因**，不计入可回收收益。

'''
md+=link('path-aliases.json','别名inode收据')+'；'+link('du-system-depth1.stdout.txt','root重复视图')+'；'+link('snapshots-data.stdout.txt','Data快照')+' / '+link('snapshots-root.stdout.txt','System快照')+'；'+link('open-unlinked-summary.json','unlinked摘要')+'；'+link('external-info.plist','外盘类型')+'。\n\n'
md+='''## 2. Owner重点域体量排行

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

'''
md+=link('tmp/REPORT.md','tmp排行/引用')+'；'+link('workspace/WORKSPACE-AUDIT.md','workspace排行/引用')+'；'+link('preservation/PRESERVATION-FINDINGS.md','Codex排行/创建链')+'；'+link('codex-root-files.json','Codex顶层文件metadata')+'；'+link('du-libexec-depth1.stderr.txt','libexec权限拒绝')+'；'+link('du-authsvc-depth1.stderr.txt','authsvc权限拒绝')+'。\n\n'
md+=f'''## 3. 前20名条件式可回收候选

**20项均为HOLD；现在没有可安全执行删除的候选。** 这是在本次实测大域中筛出的**优先复核集合**，按分配体量降序；不是全机所有可再生目录的穷尽top20，也不把“未知”改写成“无引用”。workspace深度≤6枚举共2957个build类别路径命中（大量嵌套依赖），未逐一du全部目录；symlink、生产、DB、rollback/preimage与证据主体被排除。探测覆盖见 {link('workspace/coverage-and-exclusions.json','覆盖/排除清单')}。

本表中 **A**=独立du/allocated计数，**P**=APFS `ATTR_CMNEXT_PRIVATESIZE`按dev+inode去重、且确认本根含该inode全部hardlink名字后的**私有payload估计**。P排除共享extent，不包含目录/inode元数据；不是实际释放承诺。合法解除所有引用/句柄、保持同一前态后，P才是优先采用的payload收益估计；共享块最后持有者和跨候选组合释放仍未知，A仅粗上界。**每项当前保证可回收量均0，实际释放也为0。**

20项A合计 **{obj['totals']['allocated_bytes']:,}B（{obj['totals']['allocated_bytes']/G:.3f}GiB）**，P合计 **{obj['totals']['private_payload_bytes']:,}B（{obj['totals']['private_payload_bytes']/G:.3f}GiB）**；这两数均不可写成“已确认可清理”。完整逐候选九字段与八类引用结果在 {link('candidates-20.json','20项机器可读矩阵')}。

| ID | 精确路径 | A GiB | P GiB | 物理证据 |
|---|---|---:|---:|---|
'''
for r in rows:
 md+=f"| {r['id']} | `{r['path']}` | {r['allocated_bytes']/G:.6f} | {r['private_payload_bytes']/G:.6f} | clone>1文件{r['clone_files']:,}；hardlink inode{r['hardlink_inodes']:,}；{link(r['physical_probe'],'probe')} |\n"
md+='''
下表ID与上表一一对应。“最后引用”仅指**本次可定位的当前/历史观察证据**；全局最后消费者在未证明时仍为UNKNOWN，mtime/创建时间不代替引用。

| ID | 创建者/工具线索 | 最后观察引用及坐标 | 保留依据 | 可回收理由与验证 |
|---|---|---|---|---|
'''
for r in rows:
 reason='重复tar；验证V3'if'base.tar'in r['path']else('版本化下载缓存；验证V2'if'darwinx64'in r['path']else('生成依赖；验证V2'if'node_modules'in r['path']else'生成Cargo对象；验证V1'))
 md+=f"| {r['id']} | {r['creator']} | {r['last_observed_reference']} | {r['retention_basis']} | {reason}；当前HOLD |\n"
md+='''
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

'''
md+=link('tmp/hardlink-accounting.json','硬链接去重')+'；'+link('tmp/archive-duplicate-hashes.json','三份完整tar哈希')+'；'+link('physical-duplicate-archives.json','tar独立物理probe')+'；'+link('physical-workspace-additional.json','a29/a45/a46实测')+'。APFS支持共享空间、clone与快照的官方背景见[Apple Platform Security](https://support.apple.com/en-gb/guide/security/seca6147599e/web)；本机物理量以上述本地观测为准。\n\n'
md+='''## 5. preservation“每晚重建”根因：已证链与UNKNOWN

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

'''
md+=link('preservation/PRESERVATION-FINDINGS.md','完整创建链调查')+'；'+link('preservation/campaign-archive-chain.json','campaign创建/消费源码与实收据')+'；'+link('preservation/growth-metadata.json','rollout增量')+'；'+link('preservation/producer-process-paths.json','实际可执行进程坐标')+'。\n\n'
md+='''## 6. 权限缺口与结论边界

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
'''
Path('DISK-STAGE1-INVENTORY.md').write_text(md)
print('report_bytes',len(md.encode()))
