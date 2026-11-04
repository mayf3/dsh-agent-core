# C6：stage_06 预镜像失败只读调查

调查日期：2026-11-04。目标：`run-20261103T220916Z.n2s9w7`。

**结论：已定位可核验的可疑条目与校验/耗时缺口；实际 copy 差异条目仍 UNKNOWN，根因未完成隔离验证，C6 不解除。** 现存复制前 inventory 有 1,473,654 条记录，但没有复制后目标清单、源树复查清单或复制逐字段 diff。不能把下述候选冒充实际差异。没有执行任何修复、复制、安装、回滚或隔离实测。

最具体的首查条目是 `app/node_modules/@deepseek-ai`：全清单唯一 `mode=0o777` 的 symlink。另有 1,168 个 symlink 的 xattr 采集结果为 `<unreadable>`。历史 generation/old/new 目录占条目数 93.2528%；这是长耗时的强规模证据，尚不是复制不一致的直接证明。

## 1. 证据坐标与可证明范围

以下缩写只用于本回执，均指已有证据文件：

- `R` = `/tmp/fleet-roll-prep/window-receipt-v5/run-20261103T220916Z.n2s9w7`
- `I` = `R/preimage-live-inventory.json`
- `P` = `/tmp/v5-rebuild/RECEIPT-V5-PREP.md`
- `W` = `/tmp/v5-rebuild/worker-prep.log`

目标 run 位于上述 `fleet-roll-prep/window-receipt-v5`，`window.log:1,32` 与 `invocation.json:5` 分别绑定 receipt 目录和 `/tmp/fleet-v5-prep/window-executor-v5.sh`。在两个 prep 顶层 manifest 中检索目标 run、预镜像清单及执行器文件名，没有对应记录；这不构成全盘不存在其它证据的证明。本轮没有递归搜索 scratch、private-snapshot 或任何 preimage 子树。

| 证据 | 本轮读取结果 | SHA-256 |
|---|---|---|
| `R/phase-events.jsonl` | 1,791 bytes；15–16 行是 06 BEGIN/FAIL | `41819e61bee059494d62371f66cfc9fc9696068e8c7f63ed562af9cf250f59fb` |
| `R/window.log` | 3,908 bytes；26–29 行为比较失败；31 行安装未开始 | `e9a3bf33771437f211e47623669f50d206d04a0f3263136160bd6b4843c215ad` |
| `R/stage_06_full_preimage.json` | 149 bytes；FAIL，rc=1，line=91 | `5ddc8e3b195803c5d47f90a13d5ab4c7f5b1a18e44b4ad556c77e96588506bbc` |
| `I` | 631,263,245 bytes；15,974,171 行；1,473,654 条记录 | `17f4048761a87480ef548ad41f7041ebba56e6776fd46a3749cb186d9eaa382b` |
| `R/preimage-acl-listing.private.txt` | 3 bytes，原文 `{}\n` | `ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356` |
| `R/manifest-verification.json` | 531 bytes；记录输入 manifest 验证，不是复制差异清单 | `23b145f82feef596205ceb32b2738b75cea146a9770342c718831eb8b00a088f` |
| `/tmp/fleet-v5-prep/MANIFEST.sha256` | 当前实测摘要与上项第 4 行所记相同；没有据此读取它列出的成员 | `b28eda4cc2eb47bbaf0834a144c40194d6b2f633542a7ef09192b84288ace3e6` |

对 `R` 仅列举根层目录项的 lstat 元数据：没有看到目标复制后 inventory、source-after inventory 或 copy diff 文件；`rollback-preimage.json`、`external-preimage-metadata.json` 不存在。`preimage-full` 只取得根层目录项元数据，没有进入或读取其内容。根层 `stage-06-jobs.json.diff.private.json`、`stage-06-incidents.json.diff.private.json` 属于业务输入差异产物，不能按文件名当作树复制 diff，本轮未读取其业务内容。

**代码版本限制：** 比较逻辑来自 `P:1730–1747` 的既有代码摘录；函数定义来自日志 `W:2903–2980`。运行入口 `invocation.json` 记录路径，没有记录执行器 SHA；输入 manifest 也没有其成员记录。因此这些摘录与本次 traceback/清单 schema 强一致，但本轮不能补造“历史执行字节已完全封印”的证明。下述基于实现顺序的推断均带此前提。

日志中的生产路径只是历史文本：`worker.log:1482` 记录 `live=/usr/local/libexec/agent-core`、`prod=/Users/authsvc/.agent-core`；本轮没有访问这两个树，也没有访问用户特别禁止的 `/Users/yanfenma/workspace/project/production-dsh-agent-core`。

## 2. 差异结论与首批可疑条目

### 2.1 为什么无法给出实际 copy 差异清单

`P:1732–1737` 所记顺序为：

```python
before = inventory(live)                  # 唯一保存的树 inventory
save('preimage-live-inventory.json', before)
acl = acl_listing(live)                   # 保存的是解析后的 ACL JSON
run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', live, target], timeout=3600)
require(inventory(target) == before and inventory(live) == before,
        'full preimage copy differs')
require(acl_listing(live) == acl and acl_listing(target) == acl,
        'preimage ACL/listing differs')
```

第一个比较使用短路 `and`：目标不同就不再复查源；目标相同而源改变也抛同一句错误。两个 post inventory 都没有持久化。因此既不能选择失败分支，也不能从 before 单独推导新增、缺失或字段变化的确切条目。缺失这一侧证据不能在本轮通过重新扫描生产或历史副本补齐。

`W:2949–2963` 和完整 `I` schema 表明，可导致这个比较不同的内容只有：路径命名集、`kind`、文件 `sha256`、链接 `target`、`uid/gid/mode`、`flags`、`xattrs`。`size/mtime_ns/dev/ino` 虽被 `meta()` 获取，却未写入 inventory；`nlink` 未记录。故不能将新 inode、目录大小、mtime 差异、JSON 排序或 hardlink 拓扑直接认作本次报错原因。字典相等与遍历顺序无关。

### 2.2 可操作的首批可疑集（不是已证实差异，也不是排他集合）

| 优先级 | 精确条目/集合与原始行号 | 已知元数据及可疑理由 | 尚缺什么 |
|---|---|---|---|
| 1 | `I:902157–902167`，`app/node_modules/@deepseek-ai` | link；target=`../../harness/node_modules/.pnpm/node_modules/@deepseek-ai`；uid/gid=0/0；mode=`0o777`；flags=0；xattrs.cli=`ab30a675…`。全清单唯一 0777；旧树同 target 多为 0755 | 目标复制后 link mode、属主及 xattr；不能断言 ditto 改过它 |
| 2 | `row.kind == 'link' and row.xattrs.cli == '<unreadable>'`，共 1,168 条 | 全部是 link；读取失败被同一字符串代替，无法区分无属性、权限错误、悬空或瞬时变化 | 原错误类型、完整 xattr 采集状态及目标侧对应记录 |
| 3 | `kind=link` 且 target 以 `/usr/local/libexec/agent-core/` 开头，共 258 条 | 全部绝对 link 均指这个历史 live 根；目标字符串相同不代表复制后的读取已与源树隔离 | nofollow 采集一致性、源引用漂移；不能跟随原链接补证 |
| 4 | 根 `.`（`I:2`），`config`（573）、`credential-store`（583）、`.deploy-receipts`（43），以及下面权限特例 | root 元数据也参加比较；混合属主和受限 mode 是保真核验点 | 各条目标侧 `uid/gid/mode/xattrs`；它们目前没有被证明复制失败 |

1,168 个读取失败 link 的分布：`.ds-generations` 1,161，`harness` 4，下面三个 `.ds-old…` 根各 1。可用上述谓词从唯一 inventory 精确重建该集合；它是读取失败清单，不是 copy diff。

| `I` 行号 | 读取失败代表路径 | 链接 target |
|---:|---|---|
| 4567 | `.ds-old-whole-main-canonical-g3/node_modules/node_modules/@deepseek-ai` | `../../harness/node_modules/.pnpm/node_modules/@deepseek-ai` |
| 32611 | `.ds-old-wec-dsh-phase1-delivery-eacces-recovery-20260924-v1/node_modules/node_modules/@deepseek-ai` | 同上 |
| 463369 | `.ds-old-wec-dsh-phase1-20260924-v1/node_modules/node_modules/@deepseek-ai` | 同上 |
| 3713824 | `G/@agent-core/agent-credential-provisioning` | `../../../packages/agent-credential-provisioning` |
| 3713835 | `G/@agent-core/agent-definition` | `../../../packages/agent-definition` |
| 3713846 | `G/@agent-core/agent-memory` | `../../../packages/agent-memory` |
| 3713857 | `G/@agent-core/agent-provisioning` | `../../../packages/agent-provisioning` |
| 3713868 | `G/@agent-core/agent-router` | `../../../packages/agent-router` |
| 3713879 | `G/@agent-core/agent-switch` | `../../../packages/agent-switch` |
| 3713890 | `G/@agent-core/broker` | `../../../packages/broker` |

其中 `G` 完整展开为 `.ds-generations/scheduler-whole-main/wec-bridge-capture-current-20260924-v2/preserved/node_modules/node_modules`。

绝对 link 代表：`I:10251`，`.ds-old-whole-main-canonical-g3/node_modules/node_modules/@agent-core/agent-credential-provisioning` → `/usr/local/libexec/agent-core/app/packages/agent-credential-provisioning`。这里只分析 target 字符串，没有 stat、resolve 或跟随。

权限特例：`I:925615` 的 `config/scheduler-desired-state.json` 和 `925626` 的 `config/scheduler-routing.json` 为 0640；`28696` 的 `credential-store/agent-credentials.json` 与 `925571` 的 `config/agent-credentials.json` 为 0440；`925637` 的 `config/visit-canary-01a07001` 为 0711。只读取清单记录，没有读取这些文件。

### 2.3 全清单规模、类型与元数据模式

完整只读流式解析得到：dir=160,533，file=1,253,347，link=59,774，其它类型=0。相对 link=59,516，绝对 link=258。对相对 target 仅做字符串层面的词法规范化，没有逃出 inventory 根的记录；这不证明目标存在或链接链最终留在根内。

| 首路径组件/集合 | 条目数 | 占全清单比例/说明 | 原根条目行号 |
|---|---:|---|---:|
| `.ds-generations` | 995,814 | 67.5745% | 53 |
| `.ds-generations/scheduler-whole-main` | 995,809 | 上一行的子集，不重复相加 | — |
| 全部 `.ds-old*` 首组件 | 341,801 | 23.1941% | 多个 |
| `.ds-new-wec-dsh-phase1-bridge-20260924-v2` | 36,609 | 2.4842% | 63 |
| 上述 generation/old/new 并集 | 1,374,224 | 93.2528% | — |
| `harness` | 87,069 | dir/file/link=10687/70764/5618 | 593 |
| `node-runtime` | 2,416 | 485/1931/0 | 623 |
| `app` | 2,169 | 334/1811/24 | 533 |
| `.cache` | 1,157 | 82/1075/0 | 23 |
| `config` | 599 | 97/501/1 | 573 |
| `.deploy-backups` | 44 | 22/22/0 | 33 |
| `backups` | 41 | 22/19/0 | 563 |
| 任意路径组件为 `node_modules` | 1,433,571 | 97.2800%；与以上目录集合重叠 | — |

旧目录代表：`.ds-old-p402-w1-rb3-20261004-1107` 37,726 条（`I:303`），`.ds-old-hr-reset-rollback-20260929-r2` 36,979 条（263），`.ds-old-p0-avail-restore-20260928-v1` 36,665 条（283）。`.ds-generations` 只有 `scheduler-whole-main`、`self-ops`、`workflow` 三个直接子项，后两者各 2 条。

至少含两层 `node_modules` 组件的路径有 188,892 条；这本身是依赖嵌套，不能证明递归备份。精确组件 `node_modules.bak` 或以 `node_modules.bak` 开头的组件均为 0。不能把候选源码的 `node_modules.bak` 问题移植为本次历史 live 的事实。按明确备份目录名检查也未发现两层备份目录祖先；该命名检查不穷尽所有可能的备份语义，**递归备份污染未证实**。

- xattrs 只有 `cli` 的记录 1,435,908；空对象 37,746。前者中 1,434,740 条是同一个完整摘要 `ab30a6750b1ca1f42777f995a2c098d82a2fe7469c552b9bc6639b1236955f61`，1,168 条为 `<unreadable>`。`cli` 是采集器字段，不是真实属性名，不能由摘要还原属性内容。
- uid/gid 完整分布：0/0=11,432；505/601=244,230；505/20=2；0/601=1,217,807；502/20=183。不能把组 601 自动解释为错误。
- mode 完整分布：0755=222,074；0644=1,251,135；0640=3；0700=35；0600=382；0440=2；0777=1；0711=8；0400=11；0500=3。flags 全部为 0。
- inventory 没有文件 size、mtime、nlink/dev/ino。**631 MB 是证据清单大小，不是源树总字节数**；原树字节规模、hardlink 组和逐条修改时间仍 UNKNOWN。

## 3. 耗时定位

`R/phase-events.jsonl:15–16` 实测阶段跨度为 `2026-11-03T22:13:24.085206Z` 至 `2026-11-04T02:10:50.961239Z`，共 **14,246.876033 秒，即 3h57m26.876s**。外层 `window.log` 只精确到秒，不能替代此时间。

下面是本轮读取的 receipt 文件元数据；除 BEGIN/FAIL 外，不是历史记录的子步骤 monotonic 计时：

| 边界 | UTC | 推断限制 |
|---|---|---|
| 06 BEGIN | 11-03 22:13:24.085206 | phase event |
| `private-inputs-at-install.json` mtime | 11-03 22:13:24.795409 | 按摘录顺序位于 inventory 之前 |
| before inventory 文件 birthtime | 11-03 23:40:40.094187 | 按代码先完成扫描再打开文件保存 |
| before inventory 文件 mtime | 11-03 23:40:47.343503 | 与上项相差约 7.249s，不等于扫描耗时 |
| ACL 文件 mtime | 11-03 23:41:23.639421 | 距 before 文件 mtime 约 36.296s |
| 06 FAIL | 11-04 02:10:50.961239 | phase event |

若摘录版本对应实跑且这些文件未被后续改写，则第一遍 inventory 约占 **1h27m15s**（private-inputs 写毕至 before 文件创建）；ACL 文件写毕后到 FAIL 仍有 **2h29m27.322s**，包含复制以及至少一遍完整 post inventory。前后文件时间只能辅助定位，不能冒充已采集的准确子步骤耗时。

`W:2924–2928` 的 `run()` 对非零 rc 或 timeout 直接抛错。目标 run 到了后续 `full preimage copy differs`，与“ditto 返回 0 并进入比较”一致；没有成功 rc 独立收据，也不能据此宣告副本完整。在该实现前提下，即使把全部 3,600s 都算给 ditto，阶段其它工作仍至少约 **2h57m26.876s**；ACL 保存之后的非 ditto 工作仍至少约 **1h29m27.322s**。3,600s 是对子命令的约束，不是整阶段预算，且不是严格实测复制时长。

为什么扫描有此成本：`W:2933–2947` 在原生 xattr API 失败后，为每条起一个 `xattr -l PATH` 子进程，默认单次 timeout=60s；1,435,908 条 `cli` 记录证明 before 采集广泛走过该 fallback。树还要逐文件 SHA-256，比较时再完整扫描目标，可能再扫描源；inventory 使用整棵 dict，没有阶段总 deadline。具体 CPU、磁盘、进程启动和内存各占多少，没有历史 profile，仍待隔离测量。

不要把上一次错误混为本次：前一 run `run-20261103T193519Z.fepWxL/window.log:27–38` 明确为 **ditto timed out after 60 seconds**，其 phase15–16 跨约 2h18m14s；本次则是后续比较断言失败。它也说明历史执行版本有变化，不能用今天的 3,600s 参数倒写前一 run。

`preimage-full` 根目录的 birthtime/mtime 为 22:44:13，早于 before 文件保存。复制工具可能保留源目录时间；不能拿这个目录时间当复制开始时间、认定顺序倒置或断言并发污染。本轮未进入该目录补证。

## 4. 根因假设排序与修正提案

按本次报错的证据强度排序为 **H2 > H1 > H3 > H4**：H2 有明确采集代码缺陷和读取失败记录；H1 有具体权限孤例，但没有目标侧变化；H3 有很长的漂移窗口，没有写入实证；H4 对不一致本身没有直接证明。**对长耗时则 H4 的证据最强**，规模、采集机制与时间边界相互支持，具体成本占比仍待实测。这里的排序不把“缺陷存在”升级为“历史因果已确认”；没有一个复制差异假设达到 VERIFIED。

| 排名 / 假设 | 支持证据 | 反对证据或缺口 | stage_06 具体修正提案 | 离线验证 |
|---|---|---|---|---|
| 1 / H2：xattr fallback 的不可比表示或读取失败，产生假差异/无法归因 | `W:2936–2946`：API 为逐属性 nofollow 摘要，fallback 为 CLI 整段 stdout 摘要，没有显式固定同一链接读取语义；异常统一 `<unreadable>`；历史确有 1,168 条错误 | 不知道两侧实际后端、失败原因和属性值；同样的错误哨兵也可能相等，因此不是已证明不一致来源 | 在扫描前锁定并自检同一 nofollow 后端；统一为属性名→原始值摘要，记录 backend/status/error。读取失败记 UNKNOWN 并提前拒绝，而不是用哨兵参与相等判断。禁止把空 xattrs 与 unreadable 混同；每阶段错误清单保留路径和错误类别 | YES，空/二进制/多属性、权限拒绝、后端切换、悬空 link、绝对 link 夹具；不使用历史凭据或读取历史 link 目标 |
| 2 / H1：symlink 的 mode/属主或链接元数据读取语义造成差异 | 唯一 0777 link 精确到 `I:902157`；59,774 个 link；258 个绝对 target；比较包含 link mode/uid/gid | 没有 dest record；其它同 target 的旧 link 0755 只说明 baseline 不同；不能推断 ditto 必然改权限 | 对根和所有 link 先做低成本 nofollow 元数据清单与逐字段 diff，单独输出该 0777 条目；保留 mode/uid/gid/target 要求，不用全局忽略权限掩盖失败。若需目的侧修复元数据，必须先在新隔离夹具证明保真，并重新完整校验 | YES，合成相同相对布局及 0755/0777、混合 uid/gid、绝对与悬空 link；没有特权模拟时明确未覆盖属主维度 |
| H3：源在 before 扫描、复制、post 扫描之间被修改，或扫描自身不是同一时间点 | 阶段跨近 4 小时；before 扫描亦跨约 87 分钟；没有不可变快照标识；合并断言也覆盖 source-after；`window.log:18–20` 尚记录另一个 runtime 进程 | `old-exit.json:16` 对目标旧实例记录 remaining=[]；另一个 runtime 路径不同，日志没有证明它写过此次 live 树；mtime 未入 inventory；没有真实 source-after | 后续授权窗口中绑定精确不可变源视图或完整写入屏障，记录覆盖范围和终止证据；单独保存 before、dest-after、source-after 三份清单，分别输出 copy-diff 与 source-drift。dest 失败时若预算不足以采 source-after，明确记 NOT_RUN，不能再混称同一原因。扫描每文件用打开前后 stat/身份变化检测并拒绝不稳定视图 | YES，在纯合成树注入字节/路径/权限/xattr/链接变化及扫描中途变更；真实生产并发写者身份本轮 UNKNOWN |
| H4：历史目录扩张使全量扫描/复制成本过高，扩大漂移窗口；是否属于备份污染另论 | 93.2528% 条目在历史 generation/old/new，97.28% 经过 node_modules；逐条 CLI + 多趟 SHA；没有全阶段 deadline。这是最强耗时解释 | 记录无文件 size，不能证明这些目录字节量；没有递归备份嵌套证据；没有 profile，不能量化成本占比；大本身不使 dict 不相等 | 默认完整覆盖，不新增排除。按首组件及限定条目数分块，保存路径命名集、每块 inventory/diff/count/error/耗时；扫描器使用有界内存和不逐条起进程的后端。若以后把不可变历史代移到独立恢复单元，须先证明完整回滚覆盖并改变契约，不能直接跳过 `.ds-*` | YES，合成百万条 metadata/依赖层级、受控数据字节量与链接比例，实测各步骤及峰值资源；无需读取历史 preimage |

**不支持的直接归因：** 当前报错不是后置 ACL gate（`P:1737`）；ACL 文件 `{}` 仅说明该解析器输出零条 ACL，不能证明 ACL 能力或完整性。hardlink 拓扑未被记录，不能用本次比较证明其保留，也不能仅以链接数变化解释该断言。若完整预镜像需要 hardlink 保真，后续清单应增加按相对路径分组的拓扑记录；不能比较源、目标的原始 inode 数字是否相同。

## 5. 建议校验顺序、排除集与总预算

下列为未应用方案，不是待本轮执行的生产命令：

1. 在 06 入口记录单调时钟和不可延长的总 deadline；读取已经绑定的窗口截止时间，预留安装/恢复及完整 600s 观察等后续时间。预算或源视图身份缺失即停止。先验证采集器对 root、file、link、ACL 的表示和错误处理，再开始昂贵全树扫描。
2. 对固定源视图生成完整命名/类型集合与 nofollow 元数据；按相对路径分块，尽早暴露 unreadable、unsupported type、link mode 等问题。块不能切断覆盖，完整命名集和总计数必须可对账；数据散列仍覆盖所有常规文件。不得用抽样代替完整 SHA。
3. before 清单、ACL 清单和块索引写入本次新 receipt 并封印，然后复制到唯一新目的地。记录 copy argv、rc、stderr 摘要、起止和剩余预算；保留失败副本，不覆盖旧证据。
4. 保存 dest-after，分开比较 added/missing/kind/sha256/target/uid/gid/mode/flags/xattrs；保存 source-after 或不可变源身份复核，并给 source-drift 独立结论。记录未执行的检查及原因。消除无证据的短路 `and`；ACL 比较也分别保存源和目标解析结果及读取错误。
5. 只有全部内容、命名集、链接、权限、xattr、ACL及要求的hardlink拓扑通过，才封印 `rollback-preimage.json`。失败保持 install_state=not_started，不清锁、不自动恢复、不启动实例。

**排除集：保持为空。** `P:1738` 明确完整副本保留 `node-runtime/harness/.cache`；不能为了速度排除这些内容、`.ds-*`、受保护 BAK、凭据目录或 025 材料。若源根实际上包含本次 receipt/目的目录，应在启动前依据精确根边界直接拒绝嵌套目的地，而不是在复制中静默过滤。现有证据的 live 与 receipt 根不同，没有证明本次发生了这种自包含。

预算应写成 `T06 = Tbefore + Tcopy + Tdest + Tsource_after + Tacl_external + Tseal`，每项都有起止、count、bytes、errors、剩余总时间。对子命令传 `min(该步骤上限, deadline-now)`；同一 deadline 覆盖扫描、散列、序列化、diff及树外元数据，长循环中也检查，子进程有界终止并保存超时收据。即使每个子命令没超时，阶段到期仍必须失败。

保留 `ditto` 的 3,600s 上限不能使总预算自动成立；若窗口剩余时间更短，必须取更小值，或在进入停机阶段之前依据实测判断容量不足。最终实际 `T06_budget` 及可承诺窗口长度仍 UNKNOWN，应由隔离规模实测和窗口余量确定，本报告不指定未经测量的生产通过阈值，更不认证 SOP 20–30min。可先在隔离超时夹具用总预算 10s、两个各需 6s 的子步骤验证：第二步受剩余预算约束，阶段在总预算加明确终止宽限内结束；这是机制验收参数，不是生产预算。

## 6. 待隔离实测清单与状态

全部 **NOT_RUN**；本轮仅解析已有清单，没有创建隔离副本或运行 ditto。

| 编号 | 后续纯隔离验证 | 必须形成的证据/不能提前宣称的结论 |
|---|---|---|
| V1 | 合成 `app/node_modules/@deepseek-ai` 布局，0755/0777 link、混合属主、相对/绝对/悬空 link，经相同 ditto 参数复制 | 三份 inventory 及逐字段 diff、命令 rc/计时；确认或反驳 H1。合成绝对 target 必须只指隔离路径，禁止指向原生产树 |
| V2 | 两种 xattr 后端与异常、二进制属性、权限拒绝、读取失败夹具 | nofollow 语义、统一表示、错误独立门禁；确认或反驳 H2，不能把相同 unreadable 算 PASS |
| V3 | 分别在 before 期间、复制期间、复查期间注入新增/删除/字节/权限/链接/xattr 变化 | copy-diff/source-drift 分开，检测混合时间视图；确认 H3 可被辨别，不证明历史发生过该写入 |
| V4 | ACL、受限 mode、root 元数据、硬链接组、特殊文件、含空格/换行的文件名 | 验证解析器不漏项、unsupported 明确拒绝、拓扑保真；历史 `{}` 不能替代此测试 |
| V5 | 合成百万级条目和受控文件字节量，比较逐条 CLI 与统一后端/分块方式 | 各步骤墙钟与 monotonic、文件/字节/错误计数、峰值资源、所有块命名集闭合；历史真实字节量仍 UNKNOWN |
| V6 | 总 deadline、单步骤 timeout、序列化/diff 阶段到期、子进程拒绝及时结束、dest 不同后预算不足 | 有界停止/终止证据、未执行检查标识、无 07 调用；3,600s 仅约束复制的缺口实际修复 |
| V7 | 排除集为空与恢复覆盖审查；若日后提出拆分历史代，验证独立恢复清单 | node-runtime/harness/.cache、配置/权限、历史代及受保护材料全覆盖；不得把性能优化当完整回滚证明 |

历史实际差异字段、真实写者、ditto 精确用时、原树总字节、硬链接拓扑、读取失败的真实 errno、历史执行器精确 SHA、修复后的生产适用性仍 UNKNOWN。即使以上隔离测试通过，也只能得到隔离验证结论，不能追认历史复制 PASS 或新生产窗口 GO。

## 7. 本轮动作边界与保全

动作仅为本机文件/目录元数据读取、允许证据的关键词定位、已有 inventory 的有界流式解析、独立只读交叉审查，以及新增本回执。没有调用执行器、installer、结算、服务/端口、launchd、模型服务、网络或包管理器；没有读取历史 preimage 子树原始内容，也没有读取生产树。未更改任何已有交付物、manifest、锁、receipt 或保护目录。

**范围偏差如实登记：** 首次定位时，额外对非生产暂存文件 `/tmp/fleet-v5-prep/window-executor-v5.sh` 和既有 `/tmp/v5-rebuild/v5-executor.py` 做过只读 `rg` 命中行检索，未执行。按“只读 receipt/inventory/日志”（`BRIEF-C6-PREIMAGE.md:21`）的严格文件类型白名单，这是额外读取，不能标记严格白名单遵约 PASS；随后已停止直接源文件读取，正式代码证据使用已有 receipt/log 摘录。没有由此扩大到任何生产树或历史 preimage 内容。

已有根层 20 个静态文件（含两份旧 worker 日志，不含本轮由外部记录器追加的 `worker-c6.log`）在回执写入前后对 SHA-256、bytes、mtime_ns、mode 做只读核对；最终核对结果见下方。没有改写 DELIVERY-MANIFEST，也没有运行会刷新 Git index 的命令。`worker-c6.log` 的外部自动追加与本调查的显式写操作分开记录，不把“零生产写入”泛化为“全环境没有任何文件写入”。

最终保全核对：20/20 静态文件的 SHA-256、bytes、mtime_ns、mode 与原始基线一致，diff=[]；根层新增静态文件仅 `C6-PREIMAGE-ANALYSIS.md`；核对 rc=0。初次检查经过 JS Number 传递纳秒整数，因精度丢失误报时间差；随后改用原始工具输出中的十进制字符串进行精确比较，已排除此检查器误报。各类型、uid/gid、mode、xattr 分类计数求和均与 1,473,654 对账，rc=0。

独立审查：已检查版本限制、短路分支、可比较字段、ACL 后置、条目与字节的区分、证据强度排序及 NOT_RUN 边界；没有另行复验全清单统计，也没有生产/副本验收。调查回执完成，根因隔离验证和 C6 解堵未完成。
