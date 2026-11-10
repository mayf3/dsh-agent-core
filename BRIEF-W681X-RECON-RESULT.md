# BRIEF-W681X-RECON-RESULT — 四态逐文件对账

本次只读对账完成：11 个并集源码文件、15 条窗口记录。去重后按最后触及窗口判断为 **3 CLEAN_INCLUDE、2 NEW_FILE_MISSING、5 DRIFT、1 CONFLICT_RISK、0 ALREADY_CURRENT**。文件级安全候选共 5 个；这不是完整可执行安装包或生产准入结论。现有 index overlay 必须保留，未安装、重启、配置启用、合并或重做既有实现/QA。

## 1. 授权、坐标与边界

- 执行授权：同提交 [BRIEF-W681X-RECON.md](BRIEF-W681X-RECON.md) 及 Owner 2026-11-10 当前任务；允许只读普查、两个文档一个 commit、push/PR 不合并，push 失败允许 `/tmp/transfer-w681x.bundle`。
- 仓库 `mayf3/dsh-agent-core`；隔离工作树 `/private/tmp/w123x-census`；ref `census/w681x-file-reconciliation`；初始 HEAD / BASE_HEAD / 本地 origin/main 均为 `e3586b3fb4680f96cd23790fc888424b9b31df78`。所有 main 列固定该快照。
- installed 采样时间 `2026-11-10T13:05:12.412576+00:00`；入口采样时间 `2026-11-10T13:02:32.619814+00:00`。SHA 均为原始文件内容 SHA256，非 Git object ID；`MISSING` 仅表示本机路径 ENOENT，不表示读权限失败。
- 远端 main 当前 HEAD = **UNKNOWN**：`git ls-remote origin refs/heads/main refs/heads/census/w681x-file-reconciliation` 实际 rc=128，github.com:443 连接失败。本地 origin/main 不冒充已刷新远端。
- `sudo -n /bin/ls ...` 实际 rc=127（`operation not permitted: sudo`）；目标源码原权限允许直接读取，改用非特权 `stat/read_bytes` 和 `ls/shasum` 完成同一范围，未提权或改变权限。`ps` 被环境禁止；`launchctl print` 成功，因此运行入口可查、进程内模块字节仍 UNKNOWN。
- 共享 `.git` 位于只读区；交付使用 `/tmp/w681x-recon-delivery.git` 的独立 HEAD/index/ref，parent 固定 BASE_HEAD，复用共享只读 objects，不改变原工作树/其他作者 ref。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = IMPLEMENTATION (本轮仅文档)
AUTHORITY_ACCEPTED_IN_BASE = YES
PRIMARY_AUTHORITY = AGENT_DELIVERY_RESILIENCE_V1 §4.3 CTR-W1/W2/W3 @ BASE_HEAD
RELATED_AUTHORITIES = Product Architecture; D-008; D-009; Lifecycle Hardening V4;
                      AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1; local governance
IMPLEMENTATION_AUTHORITY = contracts (既有产品); 本轮产品实现变更 = none
GOAL_OR_TARGET = 绑定运行入口、installed、窗口前后像、main 与 overlay，交付可审计四态结果
CURRENT_GAP = 既有候选与安装基线不同，不能把历史 PR diff 直接当安装缺失集
MUTATION_AUTHORIZATION = VALID (仅本 Brief 两文档/commit/push/未合并PR或bundle)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (只读普查与文档交付)
SPEC_GAP_DEPENDENCY = NONE (不作新产品/部署决定)
EVIDENCE_REVIEWABILITY = PASS (文件字节、Git坐标、逐行diff与重算方法在本文)
LIVE_AUTHORITY_GAP = NONE (现状作为Observation，不赋予授权)
OWNER_DECISION_REQUIRED = NO
MERGE_READY = NOT_APPLICABLE (本任务不合并)
OPERATION_ALLOWED = NO (生产写/安装/激活不在本任务)
DONE_WHEN = 两文档一个commit + 未合并PR，或push失败后已验证bundle
EXPANSION_TRIGGER = 要求覆盖overlay、产品语义改变、生产写或必需证据不可读
NEXT_REAL_ACTION = 完成文档交付；未来安装须先处理本文漂移及依赖闭包
```

以上权威仅用于保持 thin Router、UNKNOWN、既有 reconciliation 与作者实现边界；本文不改变任何 Contract。AGENT_DELIVERY_RESILIENCE_V1 中历史 D-007 引用由 accepted D009_ALIGNMENT 与 D-009 的现行语义控制，不重写历史正文。历史前像/候选/overlay disposition 均为 RETAIN；未创建新兼容模型或执行退役。

## 2. 实际运行入口与安装内容

`launchctl print system/ai.agent-core.runtime` rc=0，state=`running`、pid=`44663`，绑定 `/Library/LaunchDaemons/ai.agent-core.runtime.plist`。该 plist SHA256=`1a1be46557e8650025a3a9186377cd3440e63f71a681be2127fabfac79e53f63`，UserName/GroupName=`authsvc`，WorkingDirectory=`/usr/local/libexec/agent-core/app`。ProgramArguments 为：

```text
/usr/local/libexec/agent-core/node-runtime/bin/node
/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs
--root /Users/authsvc/.agent-core --catchup 0
```

静态入口链：`production-runtime.mjs:14` 动态导入 `packages/production-runtime/src/entry.js`；后者 `:43/:101` 导入/调用 compose；`compose.js:42/:347` 直接导入/调用 `../../agent-router/src/index.js`。Router package exports 同样指向 `src/index.js`，不指向工作树 staging。入口内容哈希如下（路径相对安装 app）：

| 入口文件 | installed SHA256 |
| --- | --- |
| `scripts/production-runtime.mjs` | `6a35dab738acdbdfd9bb9abe5632a9b949426bca15f09a73383428e4762c8588` |
| `packages/production-runtime/src/entry.js` | `59b87c66b22d49f823b3f2fbaf78cd81543388bb20ad68a6051b2a9a6370fb9c` |
| `packages/production-runtime/src/compose.js` | `c31db4e1342344c32810076ab0b6d8a58cb1bf94d8a505fc92623771c5746838` |
| `packages/agent-router/package.json` | `9622010ec44bed87f0e71fd7e6a5cac3427cd68b20e06c4bbaa93e1f99e79e15` |
| `packages/agent-router/src/process/delivery-resilience.js` | `MISSING` |

这些证据将运行 launchd 角色与磁盘安装入口绑定；不能证明 PID 44663 当前缓存的 JS 模块与采样字节相等，`loaded module bytes=UNKNOWN`，也不构成业务健康/恢复验收。没有读取 credential/业务恢复账本或调用业务能力。

目标路径前缀：`/usr/local/libexec/agent-core/app/packages/agent-router/src/`。现存目标均为普通文件、非 symlink，uid=505/gid=601，owner/group=`authsvc:authsvc`、mode=0644；缺失项 owner/mode=N/A。

| 文件 | installed SHA256 | bytes | owner:group | mode |
| --- | --- | --- | --- | --- |
| `conversation/late-reply.js` | `MISSING` | N/A | N/A:N/A | N/A |
| `index.js` | `b9a7f382508dca181b21afc571006a6f10239ded9e8ae8fdcded0f514ad6f889` | 27097 | authsvc:authsvc | 0644 |
| `ingress-delivery.js` | `01eab5d3e535f2b05fd15960e396376a2db339676a2a5f57993a189c868484f6` | 27146 | authsvc:authsvc | 0644 |
| `process/caller-wait-config.js` | `MISSING` | N/A | N/A:N/A | N/A |
| `process/event-correlation.js` | `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` | 19407 | authsvc:authsvc | 0644 |
| `process/ingress-failure.js` | `d3670623daef7e8382fe349beacb1c9c9a82bfa2f976bcec224f634bc479c91c` | 1231 | authsvc:authsvc | 0644 |
| `process/spawn.js` | `add4e95e3318b98f8157c8c2dc3d5e29db219839a2b50484a2f5f3a7a8fc0063` | 10166 | authsvc:authsvc | 0644 |
| `process/state-machine.js` | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | 3313 | authsvc:authsvc | 0644 |
| `reconciliation/delivery-failures.js` | `MISSING` | N/A | N/A:N/A | N/A |
| `reconciliation/late-reply-records.js` | `MISSING` | N/A | N/A:N/A | N/A |
| `route-chain.js` | `261e8ca076a768679b9fc79d3a91eebccec04af3050e26cec0a590f27d93cb7a` | 22920 | authsvc:authsvc | 0644 |

## 3. PR 前后像口径与输入纠偏

PR-pre 采用对应 merge 的第一父，PR-post 采用 merge 本身。W1 feature tip=`d758f7b8946d8d34e17895f87d6c6c007eb3c565`；W2=`57a8b9c95da430593505d3ae7bd0024230f150ba`；W3=`81883da8c3dd9b922bdeb61ccdd89d0fea778d30`。每组 merge tree 与 feature tip tree 完全相等，合并没有额外内容差量。

| 窗口 | PR-pre commit | PR-post commit | 本窗口非测试 src 文件 |
| --- | --- | --- | --- |
| 656 | `56309ed4bd3a7be724bd9f2da3050d85bf37c49c` | `656367cdfa2d8a8c72e63ab16d1932c895396b2b` | `process/event-correlation.js`, `process/spawn.js`, `process/state-machine.js` |
| W1 | `bf39bf47a52721972a9845b5f158974225c8d139` | `90493d5433a83b27288da1c7fa4ea6343ed71550` | `index.js`, `ingress-delivery.js`, `process/caller-wait-config.js` |
| W2 | `90493d5433a83b27288da1c7fa4ea6343ed71550` | `6bdfbe9eafdcd1ac6aaed6ed6daf7054f4f2867f` | `conversation/late-reply.js`, `index.js`, `ingress-delivery.js`, `reconciliation/delivery-failures.js`, `reconciliation/late-reply-records.js`, `route-chain.js` |
| W3 | `6bdfbe9eafdcd1ac6aaed6ed6daf7054f4f2867f` | `19c2261f6b8733edbfe05100e34cfc7226f4e609` | `conversation/late-reply.js`, `ingress-delivery.js`, `process/ingress-failure.js` |

- 656 行使用 `656367cd^→656367cd`，且三份 staging 与对应 post 逐字节相等；staging 路径为 `/Users/yanfenma/workspace/project/worktrees/w681-staging/staging_{event-correlation,spawn,state-machine}.js`，三份 uid=502/gid=20、0644。
- W1 #692 实测 **6 文件 +347/-1，3 个 src**。`deadline-config.js` 未被该 PR 修改；真实接线文件是 `ingress-delivery.js`。不按 brief 的文件摘要虚造 delta。
- W2 #693 实测 **8 文件**，其中 6 个 src。
- W3 #694 实测 **5 文件 +327/-9，3 个 src**。brief 的 **11 文件 +937/-10** 是 `90493d543→81883da8c` 的 W2+W3 累计差量，并非 W3 单窗口。
- W1/W2/W3 去重 8 个 src；加 656 的 3 个 process 文件得到 11 个。文档和测试用于辨认窗口，不纳入安装清单。

## 4. 四态逐窗口完整表

路径均相对 `packages/agent-router/src/`。完整 SHA256 保留，重复文件不折叠其历史前后像。

brief 的分类谓词可能重叠；本表采用保守展示优先级：`CONFLICT_RISK(main≠post) > ALREADY_CURRENT > NEW_FILE_MISSING > CLEAN_INCLUDE > DRIFT`。此优先级只解决展示冲突，不改变任一哈希事实。缺失 installed 但 pre 已存在仍为 DRIFT；安全新文件必须同时满足 pre 不存在。主分类为 CONFLICT 时另标安装漂移。

| 窗口 | 文件 | installed SHA256 | PR-pre SHA256 | PR-post SHA256 | main SHA256 | 分类 |
| --- | --- | --- | --- | --- | --- | --- |
| 656 | `process/event-correlation.js` | `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` | `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` | `1e6340b363df6555bd157ec2a8ceaa6d3e08c7fbb045872cedc2e37994e596fa` | `13a207e2cce2218f7ec0aa8740b9f5a3a748857faea5b13c37f52e422700ed45` | CONFLICT_RISK |
| 656 | `process/spawn.js` | `add4e95e3318b98f8157c8c2dc3d5e29db219839a2b50484a2f5f3a7a8fc0063` | `add4e95e3318b98f8157c8c2dc3d5e29db219839a2b50484a2f5f3a7a8fc0063` | `ca97f2c4aa9112e920c21fbff5b60136e9d54de8bbe08d636213428c4fbaa9e9` | `ca97f2c4aa9112e920c21fbff5b60136e9d54de8bbe08d636213428c4fbaa9e9` | CLEAN_INCLUDE |
| 656 | `process/state-machine.js` | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | `53f02f66ce09da9957373e97148a7a498bb07c8ddef50bc1161f5ea9f7e30ad4` | `53f02f66ce09da9957373e97148a7a498bb07c8ddef50bc1161f5ea9f7e30ad4` | CLEAN_INCLUDE |
| W1 | `index.js` | `b9a7f382508dca181b21afc571006a6f10239ded9e8ae8fdcded0f514ad6f889` | `662e24874af853ac0f641594ca6e844ead3bf0de36d0beac9b9e477d931d5df6` | `b60e38b693f9c577a2d231793fc10d04027aacc229ac608a5abdf555f28804a6` | `e02836036b22410b6cc6f82f283858cd880e125ad1316326051ed07a0cc2c67a` | CONFLICT_RISK；另有安装漂移 |
| W1 | `ingress-delivery.js` | `01eab5d3e535f2b05fd15960e396376a2db339676a2a5f57993a189c868484f6` | `ac67ebb3d06592d49badfdabb79476f564a37914af529411efa94542319fb147` | `fc67faf9e0c1eeab53d0499103dfaac75394eb5fbf5478f53447f8339cfa1a85` | `137bab1ee17ae8b3c70cf82766a47132ff79afb1f1254c8431a62b546c565a3b` | CONFLICT_RISK；另有安装漂移 |
| W1 | `process/caller-wait-config.js` | `MISSING` | `MISSING` | `8afc21b820965c0a3e9205255acb1f9fec2af1d378e68beb1390c42a1fd2f4f2` | `8afc21b820965c0a3e9205255acb1f9fec2af1d378e68beb1390c42a1fd2f4f2` | NEW_FILE_MISSING |
| W2 | `conversation/late-reply.js` | `MISSING` | `MISSING` | `5e5b491dbd70e2dbd816d482603e258ed4bcabc5b3da08924a9865b05ff58840` | `3c635d1f4a4d3610dbee190ea08c35b65f0047a6b6d41ec0eed44483f9ab24fa` | CONFLICT_RISK |
| W2 | `index.js` | `b9a7f382508dca181b21afc571006a6f10239ded9e8ae8fdcded0f514ad6f889` | `b60e38b693f9c577a2d231793fc10d04027aacc229ac608a5abdf555f28804a6` | `e02836036b22410b6cc6f82f283858cd880e125ad1316326051ed07a0cc2c67a` | `e02836036b22410b6cc6f82f283858cd880e125ad1316326051ed07a0cc2c67a` | DRIFT |
| W2 | `ingress-delivery.js` | `01eab5d3e535f2b05fd15960e396376a2db339676a2a5f57993a189c868484f6` | `fc67faf9e0c1eeab53d0499103dfaac75394eb5fbf5478f53447f8339cfa1a85` | `35b799f7a4c9fed04b459a6c4960cdb69fc7d46ef0a6a3230e400c091a606765` | `137bab1ee17ae8b3c70cf82766a47132ff79afb1f1254c8431a62b546c565a3b` | CONFLICT_RISK；另有安装漂移 |
| W2 | `reconciliation/delivery-failures.js` | `MISSING` | `4277fea7b9295be9c7de408ceed8ee19bfcbe7a289739c68e03ffde5360aeeea` | `2836b31084c61cbca665f3cfa32ca485685ffd37ede3086750f397887917646d` | `2836b31084c61cbca665f3cfa32ca485685ffd37ede3086750f397887917646d` | DRIFT |
| W2 | `reconciliation/late-reply-records.js` | `MISSING` | `MISSING` | `b774a70673caec09e2df996f9bf5fb3a90763470a870d32c229c060c336e8a09` | `b774a70673caec09e2df996f9bf5fb3a90763470a870d32c229c060c336e8a09` | NEW_FILE_MISSING |
| W2 | `route-chain.js` | `261e8ca076a768679b9fc79d3a91eebccec04af3050e26cec0a590f27d93cb7a` | `fddd89b4f130430dc6f7aa3cbbbed152d91d2e48d99f714db82cd4beb9e830ef` | `57b6f320be431be02740f755b1a01c66f137c33cc6134b996c6678b4f53a91bd` | `57b6f320be431be02740f755b1a01c66f137c33cc6134b996c6678b4f53a91bd` | DRIFT |
| W3 | `conversation/late-reply.js` | `MISSING` | `5e5b491dbd70e2dbd816d482603e258ed4bcabc5b3da08924a9865b05ff58840` | `3c635d1f4a4d3610dbee190ea08c35b65f0047a6b6d41ec0eed44483f9ab24fa` | `3c635d1f4a4d3610dbee190ea08c35b65f0047a6b6d41ec0eed44483f9ab24fa` | DRIFT |
| W3 | `ingress-delivery.js` | `01eab5d3e535f2b05fd15960e396376a2db339676a2a5f57993a189c868484f6` | `35b799f7a4c9fed04b459a6c4960cdb69fc7d46ef0a6a3230e400c091a606765` | `137bab1ee17ae8b3c70cf82766a47132ff79afb1f1254c8431a62b546c565a3b` | `137bab1ee17ae8b3c70cf82766a47132ff79afb1f1254c8431a62b546c565a3b` | DRIFT |
| W3 | `process/ingress-failure.js` | `d3670623daef7e8382fe349beacb1c9c9a82bfa2f976bcec224f634bc479c91c` | `d3670623daef7e8382fe349beacb1c9c9a82bfa2f976bcec224f634bc479c91c` | `3b8714ba5e5bcc7800edd3991703a2685c6445d90c6027d8992e6f1dea71ef65` | `3b8714ba5e5bcc7800edd3991703a2685c6445d90c6027d8992e6f1dea71ef65` | CLEAN_INCLUDE |

去重结论采用**最后触及该文件的窗口**，从而不会用 W1/W2 旧后像覆盖 W3 正确实现：

| 文件 | 采用窗口 | 主分类 |
| --- | --- | --- |
| `conversation/late-reply.js` | W3 | DRIFT |
| `index.js` | W2 | DRIFT |
| `ingress-delivery.js` | W3 | DRIFT |
| `process/caller-wait-config.js` | W1 | NEW_FILE_MISSING |
| `process/event-correlation.js` | 656 | CONFLICT_RISK |
| `process/ingress-failure.js` | W3 | CLEAN_INCLUDE |
| `process/spawn.js` | 656 | CLEAN_INCLUDE |
| `process/state-machine.js` | 656 | CLEAN_INCLUDE |
| `reconciliation/delivery-failures.js` | W2 | DRIFT |
| `reconciliation/late-reply-records.js` | W2 | NEW_FILE_MISSING |
| `route-chain.js` | W2 | DRIFT |

`conversation/late-reply.js`：W2 的 pre 缺失，但 post 已被 W3 修改，因此 W2 行为 CONFLICT_RISK；W3 的 pre 已存在而 installed 缺失，故 W3 行为 DRIFT。不能把跨窗口累积前像拼成一份并不存在的单 PR，再称其为安全 NEW_FILE_MISSING。`reconciliation/delivery-failures.js` 同样是 installed 缺失而 W2 pre 已存在；这是缺失旧基线文件，不是 W2 新文件。

## 5. 安全候选清单与不得机械覆盖的文件

按最后窗口去重，纳入 `CLEAN_INCLUDE + NEW_FILE_MISSING`、剔除 `ALREADY_CURRENT` 后仅以下 5 项。目标字节取 main，且这些行均满足 main=post；未来写入前仍必须 fresh-read exact installed preimage。**本清单仅说明文件前像匹配，不证明依赖闭包或可独立部署；本次实际安装数=0。**

| 文件 | 理由 | 本次 installed 前像 | main 目标 SHA256 |
| --- | --- | --- | --- |
| `process/caller-wait-config.js` | NEW_FILE_MISSING | `MISSING` | `8afc21b820965c0a3e9205255acb1f9fec2af1d378e68beb1390c42a1fd2f4f2` |
| `process/ingress-failure.js` | CLEAN_INCLUDE | `d3670623daef7e8382fe349beacb1c9c9a82bfa2f976bcec224f634bc479c91c` | `3b8714ba5e5bcc7800edd3991703a2685c6445d90c6027d8992e6f1dea71ef65` |
| `process/spawn.js` | CLEAN_INCLUDE | `add4e95e3318b98f8157c8c2dc3d5e29db219839a2b50484a2f5f3a7a8fc0063` | `ca97f2c4aa9112e920c21fbff5b60136e9d54de8bbe08d636213428c4fbaa9e9` |
| `process/state-machine.js` | CLEAN_INCLUDE | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | `53f02f66ce09da9957373e97148a7a498bb07c8ddef50bc1161f5ea9f7e30ad4` |
| `reconciliation/late-reply-records.js` | NEW_FILE_MISSING | `MISSING` | `b774a70673caec09e2df996f9bf5fb3a90763470a870d32c229c060c336e8a09` |

其余文件与风险来源逐项如下；“内容匹配某 commit”只证明内容来源，不证明当时实际部署行为或作者归属。

| 文件 | 漂移 / 冲突来源与处置边界 |
| --- | --- |
| `process/event-correlation.js` | installed 恰为 656 pre，但 main 比 656 post 多 transport retry 两行，唯一来源 `3259d8cc2c6a3cb0d8e8f16edaacc0c01f0ca3bb`；旧 staging 不能直接作为完整目标，详见下一节。 |
| `index.js` | installed 相对 W1 pre 为 +79/-14，含 R22 健康观察/精确代际恢复、R28 recurrence/恢复状态机、R30 history/escalation 与 processEvidenceSink overlay；main 覆盖会删除这些接线。遍历 `git log --all -- path` 的内容版本没有整文件匹配，三个 overlay 类名的 `git log --all -S` 也无命中；overlay 原作者/安装提交/部署 receipt **UNKNOWN**，必须保留，不能自行归属或覆盖。W1 post→main 的独立变化为 W2 `57a8b9c95` 增加 `ingressDelivery.dispose()`。 |
| `ingress-delivery.js` | installed 字节精确匹配 `dfb654f895d16a464d134d3b9d493af4802adeac`；相对 W1 pre 为 +18/-7，仍是内联 admission/fence 路径，缺后来 recoveryAdmission、failure.userMessage 和 W1/W2/W3 接线。W1 post→main 经 W2 `57a8b9c95` 加 capture/watch/dispose、再经 W3 `81883da8c` 加 UNKNOWN 通知；W2 post→main 仅后者。实际部署来源未证。 |
| `conversation/late-reply.js` | installed ENOENT；W2 新建后，W3 `81883da8c3dd9b922bdeb61ccdd89d0fea778d30` 加 lateReplyId 与 replyAttempted(handle) 的 durable attempted/delivered 检查，防止过时 UNKNOWN 通知。须保留 W3 后像，不能只加 W2 旧文件；最后窗口 pre 已存在导致缺基线 DRIFT。 |
| `reconciliation/delivery-failures.js` | installed ENOENT，但 W2 pre 已有 `4277fea7…`；W2 `57a8b9c95` 在既有 delivery failure store 增加 recordLateReplyDisposition/getLateReplyDisposition。缺失旧模块的安装来源 UNKNOWN，不能声称 W2 delta 是唯一缺失部分。 |
| `route-chain.js` | installed 精确匹配 `dfb654f895d16a464d134d3b9d493af4802adeac`，相对 W1 pre 为 +25/-33；缺后来的 delivery-resilience wrapper/dead-letter、nativeToolPolicy digest、website 日志脱敏/configGeneration 与 W2 getter，故 W2 两行差量并非全部缺失。实际部署来源未证。 |

上述旧 Router 基线后续内容来源还包括 `9c7c9afe072929251afcc8d5b70563591602f921`（native conversation）、`d2e745ee4cc8a1689837a05ec218e755cbb23707`（native tool policy）、`96f2ffaeda634407370f19af4ffccd1a24f658b8` / `a1830cea77ccd67e1ecc4bee9816863f6fadaa43`（website/ACL）、`5c0a6a88b46c2629b2b7389dda11cebc91b41521`（admission）、`3259d8cc2c6a3cb0d8e8f16edaacc0c01f0ca3bb`（resilience）、`38b705a6b2cdd62969bef18b31e69ab974bbc261`（recovery admission）、`492d579d185a524a9b56dd91ce8c3728fe6818a2`（switch guard）、`3be316599df8b5025329414fcb75ad157a4b24db`（routing generation）。未把它们等同于安装履历。

额外上下文：`deadline-config.js` installed SHA256=`dde4a7a2c8c90f92d5944a32720407fc51a32fa3865b86178cba0ae542600485`，authsvc:authsvc/0644，字节匹配 `7f5f719908c61d11d8ea200775c73d766b4c31f5`。W1/W2/W3 所有前后像及 main 均为 `027d59f199c8f909a99fc7776de5e39a650b4ff6c940b300c67d7325f6aa02f0`；installed 缺 `0b729a0cdf0a0bff8741546eefbe2dfbeb9032ae` 的 bindDeploymentReceipt import/绑定。这是额外旧基线漂移，**不属于 W1 delta，不计入 11 文件安全分类**。

因此，全量 W1/W2/W3 或 656 三文件直接覆盖 installed **不满足安全前像条件**。特别是 main event 新增 import 指向的 `process/delivery-resilience.js` 在 installed 也为 ENOENT；不能把修正后的单文件视为完整安装闭包。后续只能在另行授权的隔离准备中保留现有 overlay、补齐基线依赖并复用既有作者/QA，再走实际生产门禁；本次不进行该准备或部署。

## 6. event-correlation 唯一差异逐行核对

656 后像/staging=`1e6340b363df6555bd157ec2a8ceaa6d3e08c7fbb045872cedc2e37994e596fa`；main=`13a207e2cce2218f7ec0aa8740b9f5a3a748857faea5b13c37f52e422700ed45`。全文件 diff **2 hunks、+2/-0，只有以下两行**：

```diff
--- staging_event-correlation.js
+++ main/process/event-correlation.js
@@ -15,0 +16 @@
+import { markTransportRetryEvidence } from './delivery-resilience.js'
@@ -229,0 +231 @@
+      markTransportRetryEvidence(this, execution, error)
```

main 中新增行位于 16 和 231；两行均由 `3259d8cc2c6a3cb0d8e8f16edaacc0c01f0ca3bb` 引入。将 main 中这两条完整行各删除且仅删除一次，所得**全部字节（含空白/EOF）等于 staging**，实算 PASS；不只是抽样或语义推测。656 与该 retry commit 都是本次 main 的 ancestor（`merge-base --is-ancestor` rc=0）。state-machine/spawn 的 656 post=staging=main，没有后续内容变化。

## 7. 写后自证与交付方式

- 实际执行：原始字节 SHA256、owner/mode/ENOENT、4 组固定 Git 前后像差量与 merge/tree 身份、窗口→main history、完整 event diff 与两行删除字节等价、installed overlay/旧基线差异。无产品代码改动，本次不重跑既有实现测试或把旧 QA 改称本轮执行。
- `python3 .agents/tools/verify_governance.py --target . --require-accepted` rc=0；accepted lock 与 vendored bytes 一致。原 brief 保持用户给定字节；交付 diff 仅两份 Markdown。
- 本地机器可复算所需 Git 内容由 BASE_HEAD 与命名历史 commit 定位；bundle 仅包含两个文档的新 commit，prerequisite 为 BASE_HEAD。独立 receiver 在具备该 prerequisite 的仓库执行 `git bundle verify /tmp/transfer-w681x.bundle`，再 fetch `refs/heads/census/w681x-file-reconciliation` 并检查 parent/文件清单即可。
- 交付以 `/tmp/transfer-w681x-receipt.md` 的实际 push rc、commit/tree、bundle SHA256、receiver 导入/读回与独立 final-head review 为准。本文不预先声称 push 成功或 PR 已创建；若 push 成功则由该回执记录 PR 号，不合并；失败时交付规定 bundle。
- 本轮 DONE 表示只读对账与文档交付完成；不表示安装、安全合包、进程内加载一致、生产/业务验收完成。

复算表格的最小方法（在同仓库、持有上述命名 commit 的本机运行；不写生产）：

```python
import hashlib, pathlib, subprocess
prefix = 'packages/agent-router/src/'
installed = pathlib.Path('/usr/local/libexec/agent-core/app')
windows = [('656367cd^','656367cd'), ('90493d543^1','90493d543'),
           ('6bdfbe9e^1','6bdfbe9e'), ('19c2261f^1','19c2261f')]
main = 'e3586b3fb4680f96cd23790fc888424b9b31df78'
def read(ref, path):
    if subprocess.run(['git','cat-file','-e',ref+':'+path], capture_output=True).returncode:
        return None
    return subprocess.check_output(['git','show',ref+':'+path])
def sha(b):
    return 'MISSING' if b is None else hashlib.sha256(b).hexdigest()
for pre, post in windows:
    paths = subprocess.check_output(['git','diff','--name-only',pre,post,'--',prefix]).decode().splitlines()
    for p in paths:
        try: b = (installed/p).read_bytes()
        except FileNotFoundError: b = None
        print(p, sha(b), sha(read(pre,p)), sha(read(post,p)), sha(read(main,p)))
```

## 附录：installed src 全量逐文件内容清单

同次只读枚举共 50 个现存文件，均为 authsvc:authsvc（505:601）/0644。路径相对 installed src，包含目标之外的既有内容，用于复查基线；不扩大本次候选安装范围。上表的 ENOENT 项不在此现存文件列表。

| installed src 文件 | SHA256 | bytes | owner:group | mode |
| --- | --- | --- | --- | --- |
| `binding-resolution.js` | `615f8cab77dbed9ff89e4c92cfaf7055afc028240b4525cb212ba60aaeb4f738` | 14092 | authsvc:authsvc | 0644 |
| `binding-store.js` | `4fe013a03dcbc0a6a8503c4a8ed83a869835557decc84a6b7b63ba9ef5194cf5` | 27490 | authsvc:authsvc | 0644 |
| `channel-conversation.js` | `18e787bc1950077e8eac811a212925cb7ab6cbd0b90167c655b5903c09d33c25` | 3310 | authsvc:authsvc | 0644 |
| `conversation/persistence.js` | `0a980ab16302e728de14aa0480118b37df7fa9894e0fec059b2382c5016e6f20` | 2808 | authsvc:authsvc | 0644 |
| `conversation/source.js` | `ea96a9d09eaadcc044a6f040abf8f96b323cc12260e2400ddd1a9683c87e341c` | 6124 | authsvc:authsvc | 0644 |
| `conversation/surface.js` | `08deaada5571030b5d4ce67f458d3b01cc06bdbf42b61d2197311240e4fe1210` | 2053 | authsvc:authsvc | 0644 |
| `deadline-config.js` | `dde4a7a2c8c90f92d5944a32720407fc51a32fa3865b86178cba0ae542600485` | 10949 | authsvc:authsvc | 0644 |
| `index.js` | `b9a7f382508dca181b21afc571006a6f10239ded9e8ae8fdcded0f514ad6f889` | 27097 | authsvc:authsvc | 0644 |
| `ingress-authenticated.js` | `17dcedddf0b15c644e61c523e72619e5e93584d23c0e4cecd8e88320d5d4f95e` | 2871 | authsvc:authsvc | 0644 |
| `ingress-delivery.js` | `01eab5d3e535f2b05fd15960e396376a2db339676a2a5f57993a189c868484f6` | 27146 | authsvc:authsvc | 0644 |
| `operator-exact-generation-recovery.js` | `12b94a3ea713b37044e78698ba13797419ae4f6c5f4d027c684be8e2e7181941` | 3707 | authsvc:authsvc | 0644 |
| `parent-rpc-relay.js` | `1ac2e0e03a405d8d84a0dc52116c0b84318009726f8a0457032341d8875e021a` | 7822 | authsvc:authsvc | 0644 |
| `process/agent-process.js` | `47c4dfcfc13203283282405df57ecd0b27adf765b2ba218405f9cddb8b60a195` | 17091 | authsvc:authsvc | 0644 |
| `process/env.js` | `d80e523341543ed1778327acfc5f80693d04b11c49cab82dd38893221023eb4e` | 6146 | authsvc:authsvc | 0644 |
| `process/event-correlation.js` | `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` | 19407 | authsvc:authsvc | 0644 |
| `process/evidence-buffer.js` | `c5f1938bbc199927d6e2e9ddf30563ebcf61066b392bb175474a2b0118b8ecbc` | 6396 | authsvc:authsvc | 0644 |
| `process/index.js` | `ade2ecf1f1fdb94001d8cf10fd16da7a6b8116cbc759077e537519102454350b` | 1440 | authsvc:authsvc | 0644 |
| `process/ingress-failure.js` | `d3670623daef7e8382fe349beacb1c9c9a82bfa2f976bcec224f634bc479c91c` | 1231 | authsvc:authsvc | 0644 |
| `process/provider-errors.js` | `3e25f3269b39a0e253949c022d7845709a255d62d74fb2cb98750bc4766578b6` | 3298 | authsvc:authsvc | 0644 |
| `process/route-chain-evidence.js` | `b682c18dc244f22f11ccbe1f587ab7b0dda6487ccfda1f03c08d33575e5d65b9` | 909 | authsvc:authsvc | 0644 |
| `process/rpc-channel.js` | `23810dad5218da19e67a9a3c1f13103eab8dc390e074e35ee9ed5ae4d84cb7ee` | 18554 | authsvc:authsvc | 0644 |
| `process/shutdown.js` | `159381ce7afdc1dfe11656973e6e0d00b4b59cb69ad2dbdab6f6e312f2829eab` | 8671 | authsvc:authsvc | 0644 |
| `process/spawn.js` | `add4e95e3318b98f8157c8c2dc3d5e29db219839a2b50484a2f5f3a7a8fc0063` | 10166 | authsvc:authsvc | 0644 |
| `process/state-machine.js` | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | 3313 | authsvc:authsvc | 0644 |
| `process/turn-execution.js` | `d1e5ec10b20599aeeff3c5adb040469777c9df02424b7122f938628b68549cc6` | 20939 | authsvc:authsvc | 0644 |
| `process-registry-route-gate.js` | `949343251aad7feda52b24c4856b3fae938dbc2e7486508ddea6a25665e7b566` | 8427 | authsvc:authsvc | 0644 |
| `process-registry-startup.js` | `675ae69f454a8a9c0ae27e549a2f404a10fbaee25e24d4befa8f7ac8e5ac3a49` | 4736 | authsvc:authsvc | 0644 |
| `process-registry.js` | `87abee00c4c4911bca44b002ecfdc1815eb680f8c1fd18444d32ba06c38334ae` | 21813 | authsvc:authsvc | 0644 |
| `process.js` | `b07a27f6b8ec9f43969f871ad17e0db2b8df8df23af72fff2f6b655aeb558e07` | 565 | authsvc:authsvc | 0644 |
| `r22-reliability-observability.js` | `9684f07af0128851487f8394a46490e471e2e0a444e82f29649b70f882037e2c` | 4221 | authsvc:authsvc | 0644 |
| `r28-recovery-control.js` | `e66906cbc1c6c94a665f37690d0aac1f87164f762273eaddd25522234a8bb864` | 2065 | authsvc:authsvc | 0644 |
| `r28-recovery-state-machine.js` | `f4936bfafb70b8f9cfa9d5af246105235ac0ec7fc2b3ae01b0e810e8a505af79` | 4779 | authsvc:authsvc | 0644 |
| `r30-escalation.js` | `51d2dffdb4b054241f591acfa87a74b62ce0f5482ceac9bde11feaa1abdd9ff1` | 2986 | authsvc:authsvc | 0644 |
| `r38-artifact-binding.js` | `74191c2babb9f08fae97f3a40861efbffabbf287278503316c64ac7216b28bde` | 2321 | authsvc:authsvc | 0644 |
| `reconciliation/admin-abandonment.js` | `95172846f40ec0589f3a10ffcc350e3eda5d05f0e7f396d0c3d3570c14e8e19e` | 13370 | authsvc:authsvc | 0644 |
| `reconciliation/authority-capacity.js` | `994b4c87365a51fa2b4458d9ff8d2b0837f61a6428ecb548a6fd513bc934c7c9` | 16048 | authsvc:authsvc | 0644 |
| `reconciliation/capacity.js` | `237afe154801a0900209e68ddae47f1d7e0ca531594729209f16f687c73bb8b0` | 2640 | authsvc:authsvc | 0644 |
| `reconciliation/durable-file.js` | `db854ee6061c7f8a56d48f686905d667353c9930bfcd64c95464752075542a1c` | 21137 | authsvc:authsvc | 0644 |
| `reconciliation/index.js` | `8f8d56082e0513397ca89c3799c9bd745bbafa540050b7c4189bdb3f2a61a91f` | 823 | authsvc:authsvc | 0644 |
| `reconciliation/ingress-correlation.js` | `ac33ff2964f8a434dcc931e1b16e56cd783c0b9c6a284f55207457d28fea53ca` | 1452 | authsvc:authsvc | 0644 |
| `reconciliation/query.js` | `3725875b5df2d02099b4bb766a92679aa770d946012a10f1a1c325f0a111ae63` | 11151 | authsvc:authsvc | 0644 |
| `reconciliation/quiescence-bundle.js` | `f2a724c2b0e5e00d5b81e1a5eb86efddc97365519fb75daa3321e5417e1694ed` | 13284 | authsvc:authsvc | 0644 |
| `reconciliation/quiescence-custody.js` | `0a64281ff4beb6aab0e91bb249f2b58c78715ee579148d6fd45632e4073edef8` | 4904 | authsvc:authsvc | 0644 |
| `reconciliation/startup-recovery.js` | `795c3cf863023d11f270ec2600bf350d0eaf04bd07c392503696ef57dba04963` | 10171 | authsvc:authsvc | 0644 |
| `reconciliation/state-machine.js` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` | 18433 | authsvc:authsvc | 0644 |
| `reconciliation/store.js` | `1c38068b26142d454c99cf1d670bfd3693dda2e32a084f68942109385defd0e3` | 24680 | authsvc:authsvc | 0644 |
| `reconciliation-store.js` | `eb5ef8b3b4a0db0222d6529f16da1ba12a708b0e9099759448292ad585f9efcd` | 443 | authsvc:authsvc | 0644 |
| `route-chain-canary.js` | `ca228549abbbdfb4c7519641a8b5d6e08de7dca3ba5b72dac82f5ca562afc4b9` | 12097 | authsvc:authsvc | 0644 |
| `route-chain.js` | `261e8ca076a768679b9fc79d3a91eebccec04af3050e26cec0a590f27d93cb7a` | 22920 | authsvc:authsvc | 0644 |
| `workflow-recovery-chain.js` | `3d1cf784125b33957c2e52097be6774718f69382b40ba8818db4e06f869c7e48` | 1085 | authsvc:authsvc | 0644 |
