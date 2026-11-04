# ASSEMBLY-RECIPE-C5R3

这是隔离提取配方与失败收据，不是已验证的 assembled root。原安装器没有可单独 source 的装配函数，相关逻辑位于顶层 §1a/§2/§2b/§2c/§3/§5；runner 将其包成有界函数，从不 source/执行原安装器入口。

原安装器：`/tmp/fleet-roll-src/scripts/trusted-cp-deploy-install.sh`，SHA256 `99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c`。
runner：`/tmp/v5-rebuild/assemble-runner.sh`，SHA256 `90688e01aa8fa28868b81b7475de573ac9dbbe86f899262c3c31ee10f38ec204`。

| 配方段 | 原安装器行 | runner 行 | 本轮 |
|---|---|---|---|
| input/source guards | 569, 598-603 | 26-41 | 来源 guard 执行，exit 2 |
| Node anchor | 758-768 | 44-56 | NOT_REACHED |
| directory layout | 742-743 | 60-61 | NOT_REACHED |
| harness closure | 810-831 | 59-72 | NOT_REACHED |
| Node materialization | 841-867 | 75-84 | NOT_REACHED |
| harness closure gate | 891-894 | 115 | NOT_REACHED |
| app copy | 898-1032 | 88-97 | NOT_REACHED |
| fresh config skeleton | 1110, 1116 | 95-96 | NOT_REACHED |
| runtime app graph gate | 1049-1052 | 117 | NOT_REACHED |

对应原文与 SHA 见 [installer-excerpts.json](c5r3-receipt/installer-excerpts.json)，机器映射见 [assembly-line-map.json](c5r3-receipt/assembly-line-map.json)。映射为选定段的保留/改写关系，不声称整个 runner 是原脚本逐字复制。

固定输入：app=/tmp/fleet-v5-candidate；HARNESS_SRC=/Users/yanfenma/workspace/github/deepseek-harness；装配输出=/tmp/v5-rebuild/assembled-root。要求 app HEAD/status 符合 C3-R2；harness HEAD 必须精确等于本轮远端 master/#9 merge 的 13ecda5c759263c7ce7ab93b678f862f65513f34，且干净。宿主 Node 由 /usr/local/bin/node 的 Cellar 目标推导 NODE_VERSION_DIR，使用同一 Node 运行 pnpm 以固定 native optional arch。宿主输入只读。

隔离 env：只读 git 使用 env -i、禁 optional locks/lazy fetch/hooks/fsmonitor/global config；装配 HOME/TMPDIR/XDG_CACHE_HOME 位于 OUT。pnpm offline 并不保证 store 只读，因此后续未执行分支要求已准备的隔离 C5R3_PNPM_STORE_DIR 与 COREPACK_HOME（均须在 WORK 下）；本轮未解析、复制或运行宿主 pnpm/corepack/store，也未验证隔离缓存是否具备所需对象。不得把这两个未来输入当作本轮已确认缺件。

拟产物布局：harness/ 为原 tar 选择后的源加 offline pnpm closure；node-runtime/ 为 NODE_VERSION_DIR 的 cp -RL；app/ 为 C3-R2 候选除 .git 的字节拷贝；home/ 为骨架，canary 启动 HOME 另建；config/{agents.json,agent-credentials.json} 仅空文档；.cache/ 为隔离缓存。本轮上述目录全部未生成。

app 差异说明：候选已有 13 个 physical @deepseek-ai 包。为保留用户指定 C3 app 字节，配方不重放安装器 line992 的 scope symlink，也不运行 MAIN_REPO top-level deps/vendored覆盖步骤。应通过未来 app 图 gate 和实际启动验证兼容性，当前均 NOT_RUN。该选择不改变原候选。

原安装器的 backup/mv/reuse、生产常量赋值、mutex、预算、宿主凭据/用户 HOME、生产 config、helper/UID 权限安装与服务步骤均未提取。runner 未设置生产端口、未调用 launchd/launchctl、未使用 live root。

实测 /bin/bash -n 成功；/bin/bash assemble-runner.sh --assemble 在 HARNESS_SRC SHA guard 退出2，早于 resolve_node/mkdir/tar/pnpm/config。未执行分支没有装配有效性或 runtime PASS。runner 后续还有 source TOCTOU、cache realpath/symlink containment、assembled symlink census、copy模式与运行加载绑定等未验证项；来源修正后须先读独立 review，再接续必要 gate，不能直接作为放行凭据。

## C5-r7 官方 app 配方增补（取代上文 app 替代配方）

本节只替代此前“C3 整树 tar、保留 physical @deepseek-ai、跳过官方 bridge/third-party/vendor”这一 app 装配选择；历史 r3/r5 的事实与收据保持可读。监管 C5-r7 已明确授权按官方安装器配方扩大隔离 app 装配。

官方精确结论：安装器只有 harness `pnpm install`（823-824 行），**没有 app pnpm install、app workspace 根输入生成或 app lock 读取/拷贝**。因此本轮不复制源树 root lock，也不把 `node_modules/.pnpm/lock.yaml` 提升为 root lock；两者都不是官方 app 输入。app 依赖来源是官方 992 行 harness scope bridge、1004-1011 行 MAIN_REPO 可见顶层 third-party 实体副本、1028-1031 行候选 vendor 覆盖。官方用什么输入即使用什么输入，没有另造 workspace/peer 闭包语义。

本轮固定输入：`REPO_SRC=/tmp/fleet-v5-candidate`；`MAIN_REPO=/tmp/fleet-roll-src`（第三方 dev-install 输入，只读）；已通过 r5 的 `assembled-root/harness` 与 `node-runtime` 原位复用；harness 源仍为 `/tmp/v5-rebuild/harness-src` exact HEAD `13ecda5c759263c7ce7ab93b678f862f65513f34`。app/MAIN_REPO exact HEAD `ce1d13c1e8585759c6a5f194fb5553d990574b5b`。候选和 MAIN_REPO tracked 均只读。

官方安装器 SHA256 仍为 `99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c`。官方 package-copy helper 为候选 `scripts/lib/trusted-app-package-copy.mjs`，SHA256 `f8118e93306656a0aa45f5f1ca92d710217ecfc3947b8d5cdff6ddd2d4346869`。runner 在修改 app 前校验这两个固定字节值。r5 runner 原文保存在 `c5r7-receipt/assemble-runner.c5r5.sh`。

| 官方安装器行号 | C5-r7 runner 行号 | 等价实现与来源 |
|---|---|---|
| 568-573, 591-596 | 10-15, 44-59 | 分离 REPO_SRC 与 MAIN_REPO；固定 HEAD/clean tracked；记录器另存 HEAD/tree/完整 manifest。 |
| 625-627 | 14, 19-20, 54 | 相同 helper、相同 11 项脚本白名单；helper 字节固定。 |
| 898-903 | 63-71 | 创建 fresh app/packages 与 node_modules；复制 root package.json 和白名单脚本；不复制 `.git`、tests、workspace 或 lock。 |
| 604, 904 | 15, 72-75 | 同一官方 trusted-source-git-stamp.sh 直接复制。隔离中省略 root-owned 临时 install 及 root ownership；内容来源不变，权限由记录器按来源 manifest 重贴。 |
| 905-910 | 76-80 | trusted Node 运行官方 helper，选择 package.json、src 和精确 metadata public root files。 |
| 921-925 | 81-86 | 明确复制无 package.json 的 development-execution/src。 |
| 928-933 | 87-93 | bundle/profile 仅 package.json 与可选 cordis.patch.yml。 |
| 943-954 | 32-35, 94-97, 131 | 只读 Git HEAD/tree/status stamp 在 pack 前后相等；另复核 tracked diff。C3 已批准的 STOPPED-C3.md untracked 例外保留，不改候选。 |
| 956-958 / 306-331 | 外部 r7 recorder | 不复制会混淆 source-only 与 dependency-inclusive aggregate 的旧 pack-provenance.json。隔离记录器保存选中输入到输出的内容/模式来源，以及完整装配后 manifest；此为证据存放形式差异，必须在回执中绑定其路径与哈希。 |
| 960-985 | 98-110 | agent-definition/agent-registry 及 production-runtime 必需表面断言相同。 |
| 988-993 | 111-113 | 精确 `../../harness/node_modules/.pnpm/node_modules/@deepseek-ai` bridge；所有解析目标限制在隔离 root。 |
| 1004-1013 | 114-121 | 从 MAIN_REPO 可见顶层 `node_modules/*/` 按官方三个名称 skip，`cp -RL` 实体化；断言 @larksuiteoapi/croner。 |
| 1028-1031 | 59, 122-124 | 候选 vendor/proxy-agent-negotiate 在 ambient 第三方复制之后覆盖。 |
| 1049-1052 | 外部 r7 recorder，在 mode 对账后 | 同一 unchanged 官方 RUNTIME_APP_GRAPH_GATE_V1、同一可信 Node，使用 canonical `/private/tmp` argv；rc 非零立即停止，禁止 canary/双启动。 |
| 742-743, 770-805, 1110/1116 | 38-43, 129-140 | 只重装 app，复用已有通过的 harness/Node/空 config/home；本轮不重装未变化依赖，不触及生产 reuse、backup、用户/凭据/ownership/service 路径。 |

runner `--check` 只查输入；`--reassemble-app` 要求旧 app 已由记录器归档且新 app 不存在，装配后明确输出 `APP_ASSEMBLED_ONLY_MODE_RECONCILIATION_OFFICIAL_GATES_CANARY_DUAL_BOOT_PENDING`。为使 3,826 项历史 mode 差异能先完成对账，本 runner 不自动运行 gate；记录器必须先完成 source-manifest mode 重贴和 selected-input 对账，再执行官方 gate → canary → 双启动 → 退出核验。旧 app 的不再入选文件及被 scope bridge 替代的物理 scope 应逐项注明“移除/替代”，不得称仍与 C3 全树相等。

本增补完成时仅 `/bin/bash -n assemble-runner.sh` rc0；没有执行 assembly、gate、canary 或启动，因此不构成运行 PASS。独立静态分析见 `c5r7-recipe-audit.md`。最终实测状态以 RECEIPT-C5R7.md 与其哈希绑定证据为准。
