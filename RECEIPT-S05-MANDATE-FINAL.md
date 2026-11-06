# RECEIPT-S05-MANDATE-FINAL

2026-11-06 00:37 UTC（08:37 Asia/Shanghai）交付准备；关联[#605](https://github.com/mayf3/dsh-agent-core/issues/605)、[PR #629](https://github.com/mayf3/dsh-agent-core/pull/629)、[S04 #630](https://github.com/mayf3/dsh-agent-core/pull/630)。

**DOC_DELIVERY_PASS / S05_NOT_FULLY_RELEASED / PRODUCTION_STOPPED_UNKNOWN**。用户本轮合同只授权只读调查、Mandate终稿、回执及提交/push/PR；不授权源码或生产操作。两份主体文档完成，另保存明确STOP记录。批准前零stage_00，不创建authority JSON，不调用任何stage/installer/pause/launchctl/runtime/provisioning consumer；生产端口、受保护状态未读写。不会把文档交付称为S05技术全部解除或生产窗口已获批。

## 工作面和变更

唯一文档writer：Codex，宿主`yanfenma uid502/gid20`。worktree `/private/tmp/dsh-fleet-window-tools`（/tmp等价）、branch `chore/fleet-window-tools`。开始HEAD `99b0fa84d38e944dca639fc00a109ab713dd1ac7`；live GitHub只读核对PR630 merged到工具分支，fetch后fast-forward至文档parent `703fcac8b1feb5d80ee91ab71a78a4686f149240`，只引入S04三份既有Markdown。main固定A=`75ece578301b014a23b987568d1eb8af96795300`。本轮提交仅新增本回执和下列三份Markdown；既有未跟踪BRIEF/fork-map/STOPPED-C7/WINDOW-PREP保持原样，不stage、不改写。

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| [EXECUTION-MANDATE-W6-V2.md](EXECUTION-MANDATE-W6-V2.md) | 41067 | `7b35095d2beb0563cbb531e4d444c8bc89b2512e667a16d4e1afe0abf31fb89a` |
| [INVESTIGATION-W6-S05.md](INVESTIGATION-W6-S05.md) | 10305 | `acd4568335dc3c5f4e956f12bda1ec05d32735fc2370994fab585f465b82e8ed` |
| [STOPPED-S05-MANDATE-FINAL.md](STOPPED-S05-MANDATE-FINAL.md) | 2178 | `f3c3bfd66c3177c8d44c126a1451931102bd39404aed48c087d87a051b1aaa19` |

本回执不包含自身hash或未来commit自引用；精确commit/tree与本回执hash由交付后的只读readback及PR记录绑定。PR629已有先前S01 pin源码改动和V1/S04历史，本轮delta四份Markdown；不声称整个既有PR从未改过源码。

## 输入、实测与复用

| 输入 | 本轮/历史绑定 |
|---|---|
| V1基线 | SHA-256 `b6dc4b9ff8008a6e8815c065ec7f89c6a33b3fba8edd0c624ded3bfb45e79cb8`，本轮复核；31项K01–K31完整保留、公开29拆31口径 |
| S04 R1 | `2ac3f4e4a4dcffdad836ceb682dfd3be81012d3ac6df5b369c9022765bdfeb4c`，保留原失败/观察 |
| S04 R2 | `2fa894eb1836cc4993d2160e702facb7517ddbdac091642aab84236d7ccac4d5`，本轮复核；20指定运行门rc0、16checks、cold三例/7进程/0模型均是该隔离收据观察，本轮未重跑 |
| app | A tree `7a68ac22c8eef6340131dacafe1c0f2aa5dfa0d6`，本仓对象复核；不等同loaded生产 |
| harness | `13ecda5c759263c7ce7ab93b678f862f65513f34` / tree `81a047cd4d6574614e88cffe04c5e013cc43535b`，本轮HEAD/tree复核 |
| Node | `/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node`；本轮binary SHA-256 `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`；v25.6.1/darwin-x64由S04绑定 |
| 实际W | `/private/tmp/fleet-binding-diag/r3/window-installer/trusted-cp-deploy-install.sh`，本轮hash `2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a`，读取1150–1239原文，未执行 |
| stock S | A内 `scripts/trusted-cp-deploy-install.sh`，本轮hash `99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c`；与W行号分开 |

治理入口、local governance、PREFLIGHT mode及直接相关Architecture/Decisions/accepted Specs已读；本轮 `schema_version=2 / REUSE / BRIEF / ROUTINE`（文档），Product实现NO、operationNO；不是Product Authority authoring。后续窗口另走CONTROLLED，缺技术门不能靠Mandate文字消解。

## 结果与限制

- Owner②已落实为V2§3逐路径installer权效清单、R2独立两树、pre/post/restore证据坐标；UID/mode/link/ACL/成员范围明确，未生成当次预镜像。发现非R2外树原生前态缺失、§5b部分写但flag未true，均继续STOP；没有伪造可恢复PASS。
- Owner③已落实为05b机制接受、生产授权待终稿；四禁止和每记录只解除本域有权解除的贡献，其余aggregate保留；UNKNOWN业务不改变。
- S05 pause最小方案只覆盖exact退出后到bootstrap前的停机区间。请求Owner明确stage10自然准入释放边界；若要求verify/HR期间继续暂停，冻结tupleSTOP-UNKNOWN。
- stamp精确勘误：26813473负责pause文件；source-stamp冲突为A legacy writer/reuse/backup与A provisioning JSON reader，fork4fc修复未进入A。不修改stamp/源码；真实受影响consumer及必要路径排除仍UNKNOWN。
- S01既有单项修订不重做；新阶段+新pin+S04输入的同一可执行工具bundle坐标未证，记录具体组合门。所有future fresh-prestate/old tools隔离/reader v3兼容/时窗/writer/verifier/SOP绑定仍待证。

## 核查与独立审查

已执行机械核对：K01–K31集合与V1一致（31个）；完整stage顺序；A/H/N精确字符串；四禁止/1150–1218/R1/R2/v3/STOP字段齐备；所有本地Markdown链接目标存在；写入前tracked diff为空。均rc0。交付前对四文档再做staged whitelist/whitespace/hash/link检查，不运行源码/生产测试。已通过的S04和#628机制不重跑。

独立`/root/effects_audit`只读路径/效果审查PASS、无具体修正，确认W行号和R2语义、未来receipt未冒称已存在。独立`/root/s05_investigation`仅读取固定对象返回事实与方案，无文件写入。

独立`/root/final_review`初审PASS；`FROZEN_BLOCKER_UNION=[]`仅指本次文档交付。初审绑定V2 `090a7febb62ef44515b1a7f28b9064850b8bac56fa58a6649658393d4a607946`、调查`acd4568335dc3c5f4e956f12bda1ec05d32735fc2370994fab585f465b82e8ed`、STOP`f3c3bfd66c3177c8d44c126a1451931102bd39404aed48c087d87a051b1aaa19`。建议两项非阻断澄清已落实：K24指向§7条件释放边界、§8标V1读取元数据；另把R2内容保持核对明确为R2动作前后，避免暗示覆盖旧业务内容。最终hash见上表；提交后独立final-head delta/readback另在PR持久记录，未在本回执提前冒称已完成。

只读探索异常披露：工具本地对象尚未fetch时读703fcac8、在本仓查生产fork268，以及一处Lifecycle文件名初查曾返回Git fatal；后续仅通过已有正确对象仓/精确文件名读取，没有运行或重试生产命令。这些不是指定验收门，不列作“全部探索命令rc0”。现有S04收尾辅助脚本异常保持其原收据说明。

发布顺序为四文档commit→独立final-head delta→push→更新现有PR629引用#605，不merge、不执行。GitHub优先用已连接工具；本轮不需要gh命令。任一发布失败/超时立即保留commit写STOPPED并停止，不重试或改道发布。实际push/PR结果以随后readback为准。
