---
spec_id: AGENT_CORE_B7_E42_REMAINING_PHASE_CAPACITY_METHOD_V2
status: accepted
spec_kind: bounded_operational_method
implementation_authority: none
owners:
  - mayf3
accepted_by: original-delegated-B7-technical-actor-01a1378d-e052-7021-9992-f0760eb9f9e7
acceptance_record_sha256: bc89e7683b1ae1aaf2f993b61aff930ff7a3d00497b92f187fbb35ebe6485a47
---

# E42 remaining-phase capacity method — accepted fixed method and conditional ledger

This docs-only base records the original delegated technical acceptance of the exact method unit and its conditional event table. The actor is the original B7 technical delegate; this is not a human Owner signature. The original proposal's historical PROPOSED text is preserved byte for byte below. The [actual decision](../reports/e42-capacity-method-a-v2-20261019/E42-CAPACITY-PLAN-A-V2-ORIGINAL-QUALIFIED-DECISION-20261019.json) controls its accepted scope.

Accepted: reconstruct genuine future event occupancy, preserve simultaneous prefixes/rollback/UNKNOWN, and use `n=5+2G+extra` for the single e42 operation with the conditional table. Not accepted: a current numeric remaining value, a changed guard, dynamic admission, copy amplification changes, or Runbook/product implementation. None of the conditional/saved figures permits registration or an attempt.

The 50GiB floor and fresh-free-minus-genuine-remaining contract remain unchanged. Q1–Q3 saved-evidence joins are separately recorded in [Q1-Q3-SAVED-JOIN.json](../reports/e42-capacity-method-a-v2-20261019/Q1-Q3-SAVED-JOIN.json). Missing values are not replaced with historical S/H, G=2, zero extra calls, or an arbitrary allowance. This commit does not change the frozen e42 app/control inputs or perform production reads/effects.

## Exact accepted method unit

<!-- ORIGINAL-METHOD-BEGIN -->
# PROPOSED A V2 — 当前 e42 未来事件重建与数值裁决面

Status: **PROPOSED_ONLY / FIXED_NONAUTHOR_REVIEW_INPUT / NO_NUMERIC_ADMISSION**。

本 V2 保留同目录首版方法正文，不改其 bytes。按新增明确只读范围，沿当前 R41 索引/包引用读取有限保存源码与 artifact 元数据，从未来事件重新建账，**不要求先把旧 B0 分解后倒扣**。50 GiB floor、原 sole writer `01a1437b-f9f3-7a33-a253-8f7fce9459f3`、原业务契约、原两次 strong validator 顺序、retention/rollback/UNKNOWN 规则均不变。首版 §1 所列 accepted 精确条款及 hash 继续 governing；本文只为原非作者审后交原 actor 裁决，未写 accepted 状态、未执行任何 source/生产/容量流程。Requested `gpt-6.1-sol/ultra`；observed backend/effort `NOT_EXPOSED`。

## 1. 可裁决结论

在 **G=2 个原 route/provision 代表组**、原 S/H/npm operational 假设可继承的条件下，按已定位的当前未来写入拓扑、不预支 clone 或未来清理，得出 **26,352,041,984 B 的 conditional operational estimate**。它不是 APFS 物理硬上界、不是实际未来物理必需量，也不是已接受的当前 remaining。

保存 free 减不变 floor 可容纳 remaining 为 **18,209,165,312 B**。上述条件数已超出 **8,142,876,672 B**；对应旧快照所需 free 是 **80,039,133,184 B**。即使采用这些原假设，当前源码组合也没有支持把预算缩进旧阈值的结果。首版的旧 guard 缺口 457,980,544 B 与本 V2 的组合差额是两种不同算式，不能相加，也不把后者叫已测物理缺口。

**当前裁决面 = 可以审/接受有限方法；不能据此授权任何更小 remaining 或生产准入。** 原 B0=18,667,145,856 B 保留为现行未改动值；本 V2 同时把新发现的原消费者复制事件交原 actor 评估，不能以“旧值仍在”吞掉该差量。原实际入口的 fresh gate 仍由原 1437 执行；本文任何数值都不放行它。

## 2. 当前可证的新增差量：prepare_driven 不是一次

当前 `R41/control-source/b7-release-executor.sh` SHA `968d42e94b2d6345aaac2220714c96c105483902f823ad2af48a23f892db212b`：

* `prepare_driven` 第 152 行每次 `mktemp` 新建 invocation；第 162–174 行复制 **全部** `drivenScripts + drivenConfigs`。内嵌 `authority_manifest()` 原文返回 `driven=auth.get('drivenScripts') or {}` 与完整 `drivenConfigs`，没有历史字段过滤。
* 第 188–191 行另复制整个 `WB/preimage`；第 196–199 行复制完整 `b7-install-r41`。第 228、233 行的第二组相同检查在同一新目录已存在时跳过，不计第二次。`cp -cR` 不获 clone credit，按完整 payload 分配预算；本案不提议删除或改变该语义。
* 第 310、424、436、676 行分别在 `release-b7`、`bind-act`、`place-material`、`gate-receipt` 调用它。每个正常后续调用都新留一个完整 invocation；不是仅 `release-b7` 的一个 B/C pair。

固定 AUTH 保存件 `R41/final-delivery-v2/b7-v3-publication-authority.json` SHA `88a81dbc0d2670a8b51658b750aff662c9967f4e4bd9b788491ec96715b71e2b` 对应 89 个 flat 文件。本轮仅对这些原固定文件名读取 **非生产 WB 保存材料的 size 元数据**，不重 hash 大文件、不读其内容，得到 regular-rounded **809,410,560 B**。当前完整预像目录直接固定为根与已列 `e38-first-control/`、`r37-control/`：9 files、3 dirs，rounded **332,926,976 B**。它不只是一对 Cold。所用 WB 是 executor 第 18 行固定的 `ac-810/evidence/b7-first-batch-v5-build/v3-pair-maintenance-workblock/v50-release`，不是生产树。

当前包 `R41/small-output/R41-FILES-PROJECTED.json` SHA `b1d4d5f4b6151c40cd2af36a48f68a082e30abc9c6468f232b777494d17c3a00`：1,803 regular files rounded=352,882,688 B，288 directories 加 root=289，故 **B_current=354,066,432 B**。沿原 metric `Σceil(file_size/4096)*4096 + directories*4096`，每次已定组件为：

`J = 809,410,560 + 332,926,976 + 354,066,432 + capsule 12,288 + invocation-dir 4,096 = 1,496,420,352 B`。

protected AUTH/PIN 的小副本、answers 等仍归原 aux 的 JSON/evidence membership，不再加一份 J。J 是保存源码和元数据支持的 **operational component**；4096-rounded metric 本身不证明 APFS 实际物理 allocation。89 个文件仅元数据读，未重新证明每个大对象内容稳定；当前 pins 的既有实际 copied225/COMMITTED/post227 证据与本轮 metadata attribution 保持分开。

## 3. 当前固定 consumer 的调用次数与保留区间

`WB/delegated_owner_session.py` 37,950 B，当前 AUTH pin 与本轮实际 SHA 均为 `39e47fd661332afb38457cccfb435659b619090fefcea0b147e2670a6f5856a4`。原 consumer 的一次正常序列是：

| 调用 | 原行段 | 次数 |
|---|---|---:|
| release-b7 的初始 prepare_driven | executor 308–317 | 1 |
| 取 protected context | owner 162–164；599 | 1 |
| 为每个代表 material placement | owner 177–228 | G |
| bind-act | owner 245；601–607，`act_bound` 防重 | 1 |
| commit gate | owner 608；614 `awaiting_owner_done` 防重 | 1 |
| 每组 witnessed gate | owner 659–665 | G |
| confirm gate | owner 666–672 | 1 |

因此 **n=5+2G**；G=2 时 **n=9**，`9J=13,467,783,168 B`。这里的 **G 是同一个 operation / 同一个未来 TX 内的 route/provision 代表 witness 组数**，不是 Goal 数，也不是完成业务 2/2 所需的两个不同版本或两个 operation。调用 `prepare_answers(operation, tx_id)`、`bind_act(operation, tx_id,...)`、每个 gate 的 `operation,tx_id` 复用当前 owner 会话同一绑定；当前拟议参数只能是 e42。G 的实际值来自 owner 171 的 protected `context.representatives`，本文不运行 context；“G=2”仅继承原已存 two-route-class 假设，未冒充当前 native result。

e42 尚未 allocated/registered/execute，**没有 actual TX**。上表冻结的是“未来若原入口准入本 e42 后的单 op/TX 路径”；stage-seed-once 第 495 行才会生成 `tx-` UUID，owner 从本 operation 的实际 STATUS 绑定它，本文不猜造该值。后续第二个不同业务版本/operation 的任何 invocation 均不放入这九次；它仍按自己的原入口独立准入，也没有从当前账中获得预批。

正常后续每个 invocation 一直保留至原终态/历史保全，失败和 UNKNOWN 已创建或可能创建的 prefix 也保留；不靠未来清理抵消。某个调用失败中途，其 partial 不会大于该次已建模完整 payload；前面每次完整 payload 与 partial 并存。不把 N/F/R 三个全流程分别相加。原业务 rollback 在 outer/participant 内运行，不自动增加 executor `rollback` 或重发 `release-b7`；原 UNKNOWN 禁重放仍生效。

该 n 的适用条件是同一次原正常有限 call 序列、每组一次 material/witnessed、一次 bind/commit/confirm。若原当前计划还需尚未发生的 `place-delegation`、额外 invocation、原合法恢复步骤，或代表组数变化，须显式加实例；本文不默认它们为零，也不授权为了压预算复用/缓存已封闭 invocation。原 writer 可从已经持有的计划/receipt 补 `G`、`extra_prepare_driven_count`；不需发起生产探测。

## 4. 执行部分从当前未来 producer 重建

`R41/small-output/package-overlay/packet/b7-wired-stage/stage-seed-once.py` SHA `490bd9570d7915e29213b78bffb625e6970ce3158eb67afc7b4128db5284bc79` 第 456–488 行实际未来创建 operation-code tree、三份 app/harness/node 输入树、三个 public artifact 及 sidecars/seed；469/492 是原两次 source validation；507 交给原 outer。没有调用它们。

`transaction-recovery.mjs` SHA `db45db7230ec25015321081f8c9c1357355c61df517d8f6392924fd7ce06f55f` 第 149–157 行对三个 parts 各复制 old live S 和 input N；205–216 再复制 new→staged N；265–293 在 rollback 复制 old→restore S，再 rename 原 live/failed。rename 不释放预算、不产生额外 payload 副本。由此，包含失败前缀和 rollback 共存的包络为 **3N + 2S**，而非正常和 rollback 全流程简单相加。

当前 APP 与原 archive-accounting parent 仅两个成员变化，有保存 delta receipt；只读当前 tar header 得 provenance 1,794→2,257 B（同一 block），shared-codex 12,194→12,670 B（增加 4,096 B）。其余成员/header 未变来自已存 receipt；harness/Node artifact SHA 与旧 accounting 完全相同。因此 `N_current=1,258,639,360 B`，`3N=3,775,918,080 B`。当前固定 OP 归档只读 header aggregate 是 1,639 members / 1,430 regular / 209 directories，**O_current=22,339,584 B**；未解包到磁盘、未重压缩。

原完整 six-npm allowance 的保存 producer `NPM-OPERATIONAL-ALLOWANCE.json` SHA `9680a975a70400e03233535c0cb2675193242a06de27ec6ad1af19e057860145` 明确每次：final package expansion + FileFetcher temporary expansion + tarball temporary/cache copy，六次全相加为 **2,579,447,808 B**。当前 fixed `six-target-provision.mjs` SHA `dd96d67eca9d27afb1d4b656f870b2a13f45e80d7ab51c444ed549ed0c5f3bb9` 113–118、486–489 保留原 offline/no-save/no-lock/ignore-scripts/legacy-peer-deps 安装；本文只核源码，不读当前 native npm 或 cache。

当前 preparation SHA `00811809c5b1fb4a2d64b909f6410051733c8c0fafb97aa576fda97d605bd3b3` 第 247–252 行先 six-target，285 行后对迁移 home 的 `profiles/node_modules` 做 shadow copy，然后 288 行才去掉 shadow plugin。旧 H 是 restored-profile 统计，不能自动覆盖新装的六个 plugin。因此保守再留 **6×192,720,896=1,156,325,376 B** shadow 写入，完全不预贷那次删除。这个项不能漏在旧 H 外，也不能用“只是 scratch”跳过。full six-npm 不因此减少。

| 组件 | 条件数值 B | 证据性质 |
|---|---:|---|
| 3N_current | 3,775,918,080 | 当前 header 差量 + 固定 copy topology |
| O_current | 22,339,584 | 当前固定 OP header metadata |
| P public artifacts | 47,616,000 | 当前 pins 与原相同 artifact、rounded copy |
| 2G generation/reference scratch（此处 G 是旧 recipe 的 generation-size 记号，非代表组数量） | 962,527,232 | 原相同 plugin/scopes；保留全部 scratch |
| 2S live code prepare/rollback | 3,212,312,576 | **保存 S=1,606,156,288；当前 join 未建立** |
| H 原 profile shadow | 53,592,064 | **保存 H；当前 base-tree join 未建立** |
| 完整 six-npm | 2,579,447,808 | 原 trusted native/npm/config 假设的 conditional allowance |
| 六个新增 plugin 的 shadow | 1,156,325,376 | 当前 shadow producer；不预贷删除 |
| execution snapshot | 438,272 | 当前 PACKET 九文件 rounded=212,992；原 2×+3dirs |
| 原 aux 一次 | 1,073,741,824 | 下述限定 membership |
| **执行 conditional subtotal K** | **12,884,258,816** | **不能单独称完整当前上界** |
| **9J**（仅 G=2、无额外 executor invocation） | **13,467,783,168** | 完整前缀/partial/UNKNOWN 保留 |
| **conditional sum K+9J** | **26,352,041,984** | **operational estimate；非物理硬上界，非准入** |

原 aux 的精确保存 split 是 evidence/ACT 268,435,456；JSON live+temp 268,435,456；tools/config/preimages 134,217,728；normal npm cache indexes/log/helper receipts 134,217,728；symlink/inode/other metadata 268,435,456 B。它覆盖这些既有正常 workload 的 operational allowance，**不默认包住未识别的额外 package、额外全树 preimage、任意 raw/log 增长或同池其他写者**。新源码copy产生的完整payload已计 J/3N/2S；不以 clone/COW 省额。当前 source/material 输出 caps 与 aux 是否仍保持原预算条件，交原 reviewer 对既有 pins/正常数量判定；不能把 1 GiB 写成任意 COW/evidence 的数学上界。

## 5. 剩余具体未成立字段；无需扩现场

当前已能量化大量项，余下不是泛化“旧账没拆”。本 V2 已停在以下精确 quantity/binding；作者不继续扩闭包，也不要求重新扫描 home 或全机无写入：

1. **S/H 当前继承 join**：原 `ACTUAL-S-H-ORIGINAL-METRIC.json` SHA `5970ea3ebd8221521033599be720089a401eb612ef7928b1f441ec591f00fb77` 的 `S_bytes=1606156288 / H_bytes=53592064 / configuration_sha256=321897cd…`，是否已有保存的内容/身份 join 到当前 e42 待复制 `/usr/local/libexec/agent-core/{app,harness,node-runtime}` 与原 95-root profile dependency 基线。E41 pre-outer 停止本身不能构成 join。本轮未持有该 join；原 writer 如已有，只需交其 **receipt path/SHA、对应树 identity/content digest、原数量字段、未覆盖额外文件/增长字段**；不用抽象 freshness 理由重扫。
2. **代表数量与额外 invocation**：当前已存 e42 scope/plan 的 `representative_group_count G`、正常/失败/UNKNOWN `extra_prepare_driven_count`；实际字段入口为 pinned owner `context.representatives` 与上述固定调用点。G=2 仅条件；若没有已存当前 scope，保留公式 `n=5+2G+extra`，不跑 context 取得新 source 结果。
3. **npm/aux operational 假设的继承**：原保存 native npm implementation/config pin 与当前正常原身份是否有既有 join；六个固定 prefix 是否有额外 dependency set（旧 recipe 明确排除隐藏额外集合）。producer 是当前 `six-target-provision.mjs:113–118,486–489`；它不强制一个磁盘物理 byte quota。需原保存 `native/config identity pin` 与 `prefix_dependency_set_basis`，而不是新 npm rehearsal。aux 仅上述 split，未据此得同池竞争硬上界。

同池竞争、APFS metadata/COW 超过原 operational metric 的差额，本轮没有数据支持新增硬保证；不把这些变成全机审计、服务停止或新锁门。原控制/输入材料已在 saved free 中，不计过去 payload，也不当未来 cleanup credit。本 V2 不发生产探测，不对另线资产采取动作。

即便上述条件暂全部取原值，K+9J 也已超旧 snapshot 阈值。因此**补 join 并不意味着容量会放行**。当前最小可路由下一步是把这份固定 source-derived call/copy 差量交原非作者审和原 actor：确认每次 invocation 的完整复制是既有契约的真实未来支出，原 total 是否需被更完整账替代。若选择减少复制，必须另形成有限 source amendment，例如在 exact capsule/custody/原 invocation 证据语义不变下消除重复完整闭包；本轮不授权共享缓存、不改 prepare_driven、不删历史/原像、不实施该方向。

原 actor 可以作“接受方法/条件账用于计划，拒绝新的更低 remaining/准入”的具体裁决。唯一生产执行线仍是原 1437，真实准入只能由其在原入口消费实际有据 remaining 与 fresh available，不能由本作者或此文的 saved 数字决定。业务 0/2、e42 未 allocated/registered/attempt、P3 UNKNOWN 和全部原历史保持。
<!-- ORIGINAL-METHOD-END -->
