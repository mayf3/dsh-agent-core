# /private/tmp 只读盘点与候选引用

本子调查为 `REUSE + BRIEF + DURABLE / OPERATION`，依据 Owner BRIEF-DISK-STAGE1 与 standing delegation 原§2；只写本 worktree 下本目录。未删除、移动、运行历史脚本、修改调度或生产数据。所有时间为 UTC；容量 GiB=2^30 bytes。

## 账单与边界

`du-tmp.json`：`du -xk -d 1 /private/tmp` 可见总量 **14.209 GiB**，rc=1。所有 stderr 原文保留；包含 fleet-binding-window 各受限目录、W7 scratch preimages、node-compile-cache 等 PERMISSION_DENIED。总量是可见下界，不能把拒绝路径当0。该 du 与根 agent APFS 同窗采样是不同窗口，不用于替代全盘同窗账单。

`candidate-subtrees-du.json` 保留前13目录两层拆分；父子不可相加。前13目录本次可见 lsof 均未见句柄（`live-refs.json`），这不证明没有间接引用或生产消费者。

## 前13体量与 disposition

|路径|GiB(du)|实证引用/留存结果|
|---|---:|---|
|`/private/tmp/w7-k26-requal-r6-20261107-9t72zm46`|5.481|RETAIN：2026-11-07T07:32:51Z 独立qualification receipt绑定89,186-row preimage/rollback；保护树权限缺口，未检查内容。|
|`/private/tmp/sw-367`|0.532|CONDITIONAL：几乎全为target；registry /history/255、273引用父clone；现存.git不完整，rebuild证明UNKNOWN。|
|`/private/tmp/gcr-svc-target`|0.473|CONDITIONAL：Rust .o；最后消费者UNKNOWN。|
|`/private/tmp/sw-1347-evidence`|0.466|CONDITIONAL target-candidate only：delivery绑定svc PR115；fresh read已MERGED；证据/DB不在候选删除范围。|
|`/private/tmp/sw-aa-r4-evidence`|0.313|CONDITIONAL target only：父树含pgdata/dumps/red evidence；最后消费者UNKNOWN。|
|`/private/tmp/sw-d6-fix`|0.311|CONDITIONAL target only：创建actor/最后消费者/可恢复source UNKNOWN。|
|`/private/tmp/dsh-548-r2-iwl_bczh`|0.304|RETAIN：r5/run.py仍读取R2 fixtures和pin/probe；creator setup.py为git archive+tar，禁止执行。|
|`/private/tmp/darwinx64-fix`|0.252|CONDITIONAL：19个versioned npm tgz；消费者和重新下载完整性未证明。|
|`/private/tmp/fleet-w6-s04`|0.159|RETAIN：#605/#630原始S04-R2门与STOP历史；#630已合并仍不解除证据保留。|
|`/private/tmp/dsh-523-impl`|0.128|RETAIN：fresh read仍有 /private/tmp/dsh-523-r3-dependencies/original-node_modules-link -> /tmp/dsh-523-impl/node_modules；#607已合并不能移除被引用target。|
|`/private/tmp/dsh-548-r5-evidence`|0.119|RETAIN_PENDING_RELEASE：R5 preservation evidence，最后消费者UNKNOWN；master.tar重复可另提hash-backed去重建议。|
|`/private/tmp/dsh-548-r4-evidence`|0.119|RETAIN：R5/run.py:89仍引用original-hashes。|
|`/private/tmp/fleet-v5-candidate`|0.118|RETAIN：HEAD f6e332d7568b01c5253618449bfef5839102c851，11/07仍有index活动；C7 source/helper正式历史引用；不可凭旧目录判断。|

## 引用核查的准确含义

- `document-refs.json`：对本Core worktree所有tracked files精确basename搜索，排除本审计自引用；`git-and-cross-repo-refs.json`补svc-workflow与Harness tracked docs。缺命中仅表示指定语料范围内未见，不能证明全局无引用。
- `registry-refs.json`：仅摘取已有DISPATCH-REGISTRY中匹配candidate basename的leaf和record ID。sw-367的现存引用为/history/255/note与/history/273/note。此记录不替代Workflow/Mandate运行态。
- `scheduler-refs.json`：962个可解析plist中无精确basename命中，当前UID crontab无命中。5个plist PERMISSION_DENIED（gateway/workflow-dispatcher/forum-scheduler/host-exec），2个plist解析失败，且间接脚本调用未全解析，故调度引用结论为PARTIAL。
- `last-output-metadata.json`明确只表示最后可见文件mtime；**它不是最后消费者或最后正式引用**。Workflow DB、活跃Agent数据与受保护preimage仅统计，未读取内容；该部分当前引用UNKNOWN。
- `pr-readbacks.json`记录live只读GitHub结果：Core #607、#630与Svc #115均MERGED。Core pull548不存在（真实rc1）；不借数字相似归属该目录。已合PR不提供证据/rollback的释放pin。
- `selected-provenance.json`提供W7 review、W6 receipt/STOP、548 source脚本及1347 delivery的行号摘录和SHA256。原脚本从未执行。

## 物理空间

`hardlink-accounting.json`对每candidate以(dev,ino)去重、比对树内names数量与st_nlink。Rust sw367/gcr/sw1347/sw-aa分别有10609/25064/5427/18508个nlink>1目录条目；逐条st_blocks求和会膨胀到2.29/3.64/1.32/3.58GB。按唯一inode实际regular allocation为571,609,088 / 508,239,872 / 500,228,096 / 336,154,624 bytes；与du匹配。已遍历范围内所有hardlink均完整在对应树内，外部alias-pinned=0，13候选之间same-inode=0。保护preimage与DB子树不含在这项遍历结论内。

`archive-duplicate-hashes.json`：R2 master.tar、R4 base.tar、R5 base.tar均57,241,600 bytes，完整SHA256均`5befa7695bfd22f8561bbf5d93fe6061866609985e963c0e9c8d74e751d166e8`；不同inode、nlink1。**内容相同/不同inode不证明独立物理副本**，clone/private属性由主调查统一read-only getattrlist采样处理。pin.tar内容不同，不能合并。缓存tgz也未凭文件名认定可再生。

`candidate-summary.json`给9条条件GC调查对象的逐项字段。所有当前可释放physical保证下界为0，exclusive upper在clone/snapshot/retention核验前UNKNOWN；du仅作表观上界。本阶段释放0 bytes。

## 第三阶段最小GC建议（未实施）

只把明确生成物Rust target/deps和有锁定版本+完整性+保留副本的npm tgz纳入list-only计划；以(dev,ino)去重并读private allocation，保留任务receipt、red/green原文、DB、rollback及symlink target。先补不完整source/rebuild材料与当前pin/消费者确认，再由独立writer执行获批精确路径清单。三个相同tar可研究一份immutable content-addressed archive+显式消费者迁移，原路径的preservation保留义务未解除前不删除。
