# EXECUTION-MANDATE-W6-V2

状态：**FINAL_FOR_OWNER_REVIEW / NOT_AUTHORIZED / EXECUTION_STOPPED_UNKNOWN**。2026-11-06，Asia/Shanghai。关联 [#605](https://github.com/mayf3/dsh-agent-core/issues/605)、草案 [#629](https://github.com/mayf3/dsh-agent-core/pull/629)、S04 [#630](https://github.com/mayf3/dsh-agent-core/pull/630)。本文件是本次操作申请终稿，替代 V1 的申请文本；不 supersede 任何 Product Authority，不改 V1 历史证据。

**批准前零 stage_00**，不创建 authority JSON。本次仅文档/只读调查：零生产写入、零源码改动。Owner 裁定②已明确安装/回退必需的冻结精确路径权效边界；裁定③已接受 05b 机制，生产权限仍待本终稿批准。下面的计划、路径表和建议时间均未执行。

S04 已通过的隔离门直接复用；S05 不能伪称全解除：冻结 app 不读旧 pause；source-stamp 存在可达格式冲突；权限回退的部分树外前态尚缺。具体调查见 [INVESTIGATION-W6-S05.md](INVESTIGATION-W6-S05.md)，停止边界见 [STOPPED-S05-MANDATE-FINAL.md](STOPPED-S05-MANDATE-FINAL.md)。未满足的条件不得用 Owner 批准文本替代技术证据。

## 1. 冻结组合、来源和治理坐标

| 对象 | 精确冻结身份 | 获取/证据坐标 |
|---|---|---|
| app A（已合并 #628） | `75ece578301b014a23b987568d1eb8af96795300`；tree `7a68ac22c8eef6340131dacafe1c0f2aa5dfa0d6` | 本仓 Git 对象；`git show A:<path>`，不以本工作树旧文件替代 A |
| harness H | `13ecda5c759263c7ce7ab93b678f862f65513f34`；tree `81a047cd4d6574614e88cffe04c5e013cc43535b` | `/tmp/v5-rebuild/harness-src`，本轮 HEAD/tree 实测 |
| Node N | darwin-x64 v25.6.1；binary SHA-256 `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b` | `/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node`，本轮复核字节 hash；版本/架构由 S04 收据绑定 |
| 实际冻结窗口安装器 W | SHA-256 `2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a` | `/private/tmp/fleet-binding-diag/r3/window-installer/trusted-cp-deploy-install.sh`，本轮实测 |
| A 内 stock 安装器 S | SHA-256 `99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c` | `A:scripts/trusted-cp-deploy-install.sh`，本轮实测；不是 W |
| S04 组合闭包 | `accepted-r2-inputs.sha256` SHA-256 `f2fc01914a06ab4f686d5c0166077e167a8891a0943ee7eb94b9420d5127f7e2`；73,887 regular files | `/private/tmp/fleet-v5-prep/r3/accepted-r2-inputs.sha256`；不是只凭 Git tree 认定依赖完整 |
| 源码索引（V1 实测保留） | app `396f3e441c5ab2db47fdf54e3da1e33829bab845115019bd643dd5f276040262`（2,383项）；harness `43e6ea35a4f68449273e21855663786835e828021f3697b65da417a354e62863`（7,839项） | 原始 `git ls-tree -r --full-tree -z <commit>` NUL 字节 SHA-256；不替代装配/动态库闭包 |

W 是既有 R3 固定输入，包含 stock 在第872行附近增加的21行 x64 payload 供应块；本轮没有制作或修改安装器。**§3 行号均 W；S 对应生产权限段少21行**。用户指定 W:1150–1218 为生产根权效段；安装树权限另在 W:1226–1239，不能误拿 S 同行号或遗漏该段。后续 main 前进不更改 A/H/N。

只读复核：`git rev-parse A^{tree}`、`git -C /tmp/v5-rebuild/harness-src rev-parse HEAD HEAD^{tree}`、`git show A:scripts/trusted-cp-deploy-install.sh | shasum -a 256`、`shasum -a 256 <W> <N>`。原部署树、生产端口、launchd、受保护状态本轮均未探测。

本次写面 `/private/tmp/dsh-fleet-window-tools`，branch `chore/fleet-window-tools`；初始 `99b0fa84d38e944dca639fc00a109ab713dd1ac7`，只读查到 PR630 合入该分支后 fast-forward 至 `703fcac8b1feb5d80ee91ab71a78a4686f149240`，仅带入三份 S04 Markdown。authority branch main 本轮读取仍 A。文档父提交703fcac8与生产 app A严格分列。

治理：`PREFLIGHT / REUSE / BRIEF / ROUTINE`（本轮文档），`ROUTE_STAGE=IMPLEMENTATION`仅指文档准备；Product 实现/操作均 NO。未来窗口另为 `REUSE / EXEC_PLAN / CONTROLLED / OPERATION`，尚无有效 execution mandate。直接依据：仓库 grammar/local governance、D-008、D-009、accepted `SCHEDULER_TIMEOUT_OUTCOME_V3`、`AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1`、`AGENT_PROCESS_LIFECYCLE_HARDENING_V4`、WAE V3/WEC V3 和 `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`。Architecture 仍标冻结草案；不改其 lifecycle。A 中 `AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1` 仍 proposed/none，不能由本文件激活。Owner 本轮②③为一次性 scope 裁定，未签发生产执行。

## 2. 31 项“必须保留”处置清单

来源为既有固定 fork 映射：P=`23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9`，旧 M=`4b865cce8ee8880ec1503c856a1eddcd0d40cdaa`；映射原统计是 **37 提交 = 29 必须保留 + 6 已吸收 + 2 退役**。V1 基线的 31 是明确的**行为处置单元**：把 29 中 `b95562eb` 的凭据/产物及 `26813473` 的 pause/effect 分别拆开。不是伪称原表有 31 个必须保留提交；沿用该已公开映射，不改变处置单元。来源文件 `scripts/fleet-window/PRODUCTION-FORK-BEHAVIOR-MAP-V1.md:14-75,177-472`，SHA-256 `90f57e79c0113fb730f7cc0e2cfd6d755a652bec0f02ba522392455abaf6b7b9`。

**a = 本冻结候选已存在的 wiring 承接责任**；不表示本轮移植了源码。**b = 延后独立 PR**；每项稳定追踪为 `#605 → 本文 W6-Kxx → 独立 PR 待创建`，未创建的 PR 不虚构编号。b 不等于风险消失：下表标为“执行前门”的项目必须证明不在本次实际路径、或闭合其依赖，才能进入相应阶段。其他观测/历史证据项不膨胀为发布前置。P 的完整历史对象/映射/回执始终保留，不删除。

下表路径省略公共前缀时，`router`=`packages/agent-router/src`，`runtime`=`packages/production-runtime/src`，`api`=`packages/product-api/src`，`broker`=`packages/broker/src`；坐标均冻结 app A，P 特别注明。

| ID / 来源 | 处置 | 具体迁移点、理由与边界 |
|---|---|---|
| W6-K01 / bd8f74c4 | b | `runtime/entry.js` conversation auth config → productApi facade 缺 wiring；独立核 `PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE` 真实 consumer 后补 seam，当前 consumer UNKNOWN，不擅自退役。 |
| W6-K02 / 09c7e8b4 | b | history env passthrough 与 history 单独启用 productApi 缺失；核监督单元/监听需求后接 `compose.js productApiCfg.history`，属于可选观测面。 |
| W6-K03 / e9a61dee | b | `api/history-listener.js` bind 错误每 60 秒重试、30 次上限缺失；可选监听恢复后续补，连同 close/timer 生命周期审查；#555 只覆盖 containment。 |
| W6-K04 / 1921f879 | b | `broker/transport/errors.js parseServiceErrorBody` 和 `registry.js` sanitized detail 兼容；沿 bounded detail 信封修，不透传任意 raw details。P 普通 HTTP 全链路也未证明成功。 |
| W6-K05 / 7ea0ffec | b；执行前门 | `api/index.js:332-346` 四个 Workflow 路由仍用 scheduler verifier；`runtime/scheduler/history-runtime.js` 无独立 workflow verifier。后续接独立 aud，不全局改 Scheduler aud；配置握手/实际 aud/consumer 未证即 STOP 相关调用。 |
| W6-K06 / 673b6ed8 | b | r22 周期 health snapshot/exit alert 缺失；观测增强独立整合 lifecycle diagnostics；未有活调用的 refusal/injection helper 只保留历史证据。 |
| W6-K07 / dd9e1d86 | a | 恢复责任由 `router/reconciliation/operator-candidate.js:61-90` exact handle/epoch/agent/generation、durable exit/cleanup proof 与 `router/index.js:368-372` restart-lost 拒绝面承接。旧 EMPTY 清 fence facade 不进入候选；本窗不调用恢复。 |
| W6-K08 / 07acadb4 | b | router health watch timer/processHealthSnapshot 独立接一次 diagnostics；不复活旧 operator 清 fence facade。 |
| W6-K09 / 29e0ebc1 | b | REAP→AGENT_PROCESS_EXITED 只读 health projection 后续补；REAP 不等于完整 termination/cleanup proof。 |
| W6-K10 / 8d176831 | b；闭包门 | `feishu-connector/src/index.js:24` 仍 static import `@larksuite/channel`，lazy import 后续 PR；本次完整 runtime 必须证明 SDK 及依赖齐全。死 txn-safety 不恢复，fixture 留历史。 |
| W6-K11 / 9509b130 | b | r28 recurrence monitor/exact kick builder 缺失；观测/升级交唯一 owner。旧 EMPTY 自动清 fence 禁止移入；P kick builder 无生产 import，不称已部署恢复。 |
| W6-K12 / 6fa2bb8d | b | injected detect/evidence/recover/rewake/verify/continue facade 的 provider UNKNOWN；先核 `workflowRecoveryDeps` consumer/权威，再独立整合，不新建第二 Workflow 引擎。 |
| W6-K13 / e3a207ec | b | open-fault retry/elapsed、JSONL stage history、R30 通知 receipt 后续单 owner 接续；UNCONFIGURED/日志不是送达。#592 blocked alert 仅部分覆盖。 |
| W6-K14 / ca497770 | b | R28 测试更名证据保留；随 K12 PR 延续 `r28-recovery-state-machine.test.js`，没有独立运行 delta，不称真实 E2E。 |
| W6-K15 / 5f3e283a | b | “controlled child exit through injected Workflow seams”测试标题/边界随 K12 保留；不扩大成跨系统业务恢复。 |
| W6-K16 / bd701b2c | b | `docs/designs/R30-defect-closure.md` 历史证据后续建立引用/核销；NOT_APPLIED 只说明当时时点，不推断当前 loaded。 |
| W6-K17 / 7f28c6cf | b | `.faults.json`、age/attempt/escalation receipt 与 stage resume 后续迁移，完整预镜像保留字节；禁止直接移植未按 workflow/agent/generation scoped 的全局 `last(state)` resume。 |
| W6-K18 / 802b0278 | b | dispatcher 必须在 store 初始化后构造的 ordering 修复随 K13；A 无该 dispatcher，不为搬修复引入无用组件。 |
| W6-K19 / eb37f8ad | b | `r37-cross-process-restart.test.js`/fixture 随保留的 fault model 迁移；SIGKILL/file restore 不升级为业务恢复。 |
| W6-K20 / c1e8d4e7 | b | rehearsal authoritative due-feed/exact dispatchIntentId、event/turn 独立 readback 责任随隔离 PR 保留；本窗不发真实 kick；ACK 不等于完成。 |
| W6-K21 / b95562eb 凭据 | b；调用前门 | 分离 Svc due-read 与 Core kick 的 endpoint/token/aud/scope；实际 consumer UNKNOWN。独立 PR 和配置握手，不把 token 共用假定为兼容。 |
| W6-K22 / b95562eb 产物 | a | artifact 内容绑定由 `scripts/lib/deployment-reuse/release-package.mjs:318-394` 的 sourceSha/逐文件 SHA/artifactDigest/toolchain 和窗口 `window_helper.py:252-278` final binding 承接。不叠 R38 tarball 模型；外部 R38 schema consumer UNKNOWN，发现真实 consumer 时先迁移再切换该 consumer。 |
| W6-K23 / cc52a38f | b | R47 audit 历史问题后续逐项核销；#622/#624/#625 只算对应修复，#623 proposed 不称 accepted/全部风险关闭。 |
| W6-K24 / 26813473 pause | b；bootstrap 前门 | A 无 AdmissionPauseControl/file reader/checkpoints/远程操作面。旧文件不约束新 runtime；本轮不移植；当前窗口处置以 §7 为准：请求 stage10 明确释放停机 containment；若要求 bootstrap 后继续暂停，须跨 restart 全入口零准入证明，缺证即 STOP-UNKNOWN。 |
| W6-K25 / 26813473 effect | b | `runtime/workflow-execution-runtime.js:280-282` 无 idempotencyKey 透传；P Router 也无 consumer。先核外部 effect 执行边界及 Svc 去重职责，不能把字符串当防重成功，不叠第二身份保护。 |
| W6-K26 / 4fc07f95 | b；install 前门 | JSON source-stamp writer/reuse/backup、runtime arch env 后续 PR。A `scripts/lib/trusted-source-git-stamp.sh:49` 生成 HEAD+dirtyCount legacy wire，installer `:603,:831` 原样写出，provisioning `index.js:85-115` 要求 JSON `{commit,dirtyCount}`；精确 reuse/最终 stamp 未实证兼容即 STOP，不手工伪造 stamp。 |
| W6-K27 / f682514b | b；闭包门 | 所有 runtime optional package 非零 regular bytes census 缺失；独立 gate PR。本窗须独立实测全部实际 payload，单次 resolve/import 不能代表闭包完整。 |
| W6-K28 / 4a5ab2cd | b | EMPTY+exactly-one unresolved health trigger 后续 PR；恢复只经 K07 唯一 exact-proof 入口，EMPTY 不证明 worker/tools/effects 停止。 |
| W6-K29 / 56b545a3 | b；闭包门 | K27 的 `lstat` no-follow 与 R64 历史对账随同一 PR；symlink 不为包 payload 充数，历史对账不升级为 live PASS。 |
| W6-K30 / f917aeba | b；闭包门 | 20 项 darwin-x64 seed manifest/materializer/install hook 缺失；独立供应闭包 PR。固定 x64 不证明 tarball 存在/哈希/lock 匹配，必须以实际封印闭包验收。 |
| W6-K31 / 23fb91a6 | b | reconciliationStore→health snapshot 显式 wiring 随 K28；A 的只读 reconciliationRuntimeStatus 不等于 watch 已装配或恢复成功。 |

原已吸收项 `2133c2de/a62b0627` 不混作 31：保留 main #622 mandatory `expectedAttemptId/expectedGeneration`、锁内 fresh replay/CAS 一套；不增加 `requireReconciledIdentity/status` 保护，不因 P 更宽泛拒绝就覆盖 main 身份模型。未证 effect consumer 的责任已归 K25。两项合法退役只退出执行，历史仍保留。

## 3. 效果清单：只限冻结路径与安装/回退必需

目标固定 `system/ai.agent-core.runtime`、plist `/Library/LaunchDaemons/ai.agent-core.runtime.plist`、live `/usr/local/libexec/agent-core`。固定 installer 身份 `authsvc=505:601`、child `502:20`（W 常量）；当次 fresh-read 必须一致，不现场改 UID/GID。这里的 `root:wheel` 同样是既有固定 custody，非授权扩大安全策略。

### 3.1 W:1150–1218 逐路径表

| ID | 精确绝对路径 | W 行号 / 允许效果 |
|---|---|---|
| E01 | `/Users/authsvc/.agent-core` | 1155–56,1171,1178；必要 mkdir 父目录；仅根 chown505:601 / chmod0711 |
| E02 | `/Users/authsvc/.agent-core/bindings` | 1156,1194–95；mkdir；递归 chown505:601 / chmod `u+rwX,go-rwx` |
| E03 | `/Users/authsvc/.agent-core/scheduler` | 同 E02，单独绑定本树成员 |
| E04 | `/Users/authsvc/.agent-core/logs` | 同 E02，单独绑定本树成员 |
| E05 | `/Users/authsvc/.agent-core/control` | 1156,1196–1207；mkdir；根及后代 chown505:601 / chmod `u+rwX,go-rwx`；严格排除 E07/E08 根与其后代 |
| E06 | `/Users/authsvc/.agent-core/agents.json` | 1160–61；仅重建指向 `/usr/local/libexec/agent-core/config/agents.json` 的 symlink；前态必须已是同目标 symlink，否则 STOP，不删除未知普通 authority 文件 |
| E07 | `/Users/authsvc/.agent-core/control/scheduler-watchdog` | 1193,1208–16；已存在树只递归 chgrp20，UID/mode保持；源码缺失分支 mkdir/505:20/0700，但当次合法预镜像要求该树已存在，缺失即 STOP |
| E08 | `/Users/authsvc/.agent-core/control/incident-backups` | 同 E07，独立树/证据 |
| E09 | `/Users/authsvc/.agent-core/workspaces` | 1156,1217–18；mkdir；仅根 chown502:20 / chmod0755；不递归接管 agent 子树 |
| E10 | `/Users/authsvc/.agent-core/homes` | 同 E09，独立根 |

### 3.2 W:1226–1239 安装树权限（同一安装必需）

| ID | 精确绝对路径 | 允许效果 |
|---|---|---|
| E11 | `/usr/local/libexec/agent-core/app` | 递归 `chown -R -h 505:601` / chmod `u+rwX,go+rX,go-w` |
| E12 | `/usr/local/libexec/agent-core/home` | 同 E11 |
| E13 | `/usr/local/libexec/agent-core/harness` | 仅 REUSE_HARNESS !=1 时同 E11；reuse 则保持原 metadata，仍须核验 |
| E14 | `/usr/local/libexec/agent-core/node-runtime` | 仅 REUSE_NODE !=1 时同 E11；不因 x64 选择扩大平台范围 |
| E15 | `/usr/local/libexec/agent-core/home/.credentials.yaml` | chmod0600，不改 Secret 内容 |
| E16 | `/usr/local/libexec/agent-core/config` | 递归 chown505:601/chmod0700；其直接 `*.json` chmod0600；实际匹配文件逐名列于本次私有清单 |
| E17 | `/usr/local/libexec/agent-core/.cache` | 递归 chown root:wheel；仅根 chmod0700 |

递归范围由**当次 preimage/新闭包逐成员绝对路径 inventory**封印，包含文件类型、link target、UID/GID/mode/ACL/xattr。上表是所有固定根/显式文件，不伪称已经获得生产逐叶清单；当前具体叶名 UNKNOWN。目录越界 link、不可读成员、未列实际落点即 STOP，不能把目录根/通配符当任意树外写许可。只运行冻结 W 自身已有操作；不另加宽泛 chown/chmod。

### 3.3 RESTORE-R2 树外路径独立表（仅 metadata）

RD 为本次唯一 receipt 根；**当前 RD 未分配、preimage 未执行**。

| 精确路径 | bootout 前 preimage 坐标 | 本 invocation 触发/恢复/readback |
|---|---|---|
| `/Users/authsvc/.agent-core/control/scheduler-watchdog` | `RD/external-preimage-metadata.json` 中同名绝对路径 key 的 root/entries/aclListingSha256；`RD/external-scheduler-watchdog-acl.private.txt` | 本次 §5b 权效已发生才适用；仅重申GID20；逐成员 UID/mode/ACL与metadata前态核对；内容只比较本次R2动作前后，当前业务内容不覆盖 |
| `/Users/authsvc/.agent-core/control/incident-backups` | 同 JSON 独立 key；`RD/external-incident-backups-acl.private.txt` | 同上，独立核验，不与 E07 混作一棵树 |

`RD/rollback-preimage.json.externalMetadata` 必须指向该 JSON，`preparedBeforeBootout=true`。触发证据：本次 `install-start.json` 时间/previousMutationReceiptSha256 + 新 `failed-install-mutation-receipt.json`，或本次 `successful-install-rollback.json` 的 unique BAK、installLogSha256、section5bCompletion。不得借用旧 run。

**部分写入陷阱**：W:1220 才 `note_stage prod_root_5b`，W:1171 起已可改变 metadata。中途失败时 restore_r2_required=false/无 completion 不证明零写。必须结合本次 child 终止、日志和逐路径实际 poststate 对账；不明 `mutation_truth=UNKNOWN / STOP`，不盲做第二安装或 R2。

R2 的 GID20 重申仅在 bootout 前逐成员前态已证明该 pinned 值、UID/mode可保持时构成恢复；否则标不兼容并 STOP。它不是将任意前态统一改成20的额外策略授权。

### 3.4 其他必要效果与前后态证明

附属申请逐项：自有 `/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock`；`/private/tmp/fleet-binding-window-v5.<unique>` root custody bundle；仅 `/private/tmp/fleet-roll-src/pnpm-lock.yaml` 已枚举 untracked 原件备份后清洁；`/tmp/fleet-roll-prep/window-receipt-v5/run-<unique>` 回执/预镜像；live 同父唯一 `.bak-<本次时间>` 和失败树；仅现行 config 缺项原字节 carry-forward；plist 仅 deployed SHA delta；安装器本次 `/usr/local/libexec/agent-core-install-mutation-receipt.json`。路径的 `<unique>` 是当次分配坐标，执行前封印，不接受旧 receipt/猜测BAK。

W:1079–88 可创建 `/Users/authsvc/.dsh`、`/Users/authsvc/.dsh/settings.yaml`、`/Users/authsvc/.dsh/.credentials.yaml`；W:1257 可安装 `/usr/local/libexec/dsh-agent-spawn-helper` root:wheel4755。**本申请要求这些既有输入已合法齐备（helper还须正确owner/mode），缺失即 STOP**；不走本次隐式新建特权helper或补Seed分支。mkdir 已存在为无新增对象，不掩盖实际 metadata 写。

Owner②要求的前后态/回退可恢复证明覆盖 E01–E17 和附属效果。现行 helper 原生只封印完整 live 树与 R2 两树，**不能证明 E01–E06/E09/E10 的树外 metadata/link 完整可恢复**。因此未来获批窗口前须在隔离可审查材料中规定并验证逐路径采集/恢复法，bootout前生成 `RD/installer-effects-preimage.private.json`、权限ACL/link/存在性/成员清单及哈希；本次 install 前再核基线，install后（包括部分失败）`RD/installer-effects-postimage.private.json`，恢复后 `RD/installer-effects-restore-verification.private.json`。这些是**要求的未来证据坐标，现有工具不自动生成、本轮未创建**。没有证据就 STOP 于 bootout 前；不得用手写预期冒充现有收据或给未来脚本自授实现权。可优先证明额外树外项已等于 W 后态且成员受停机边界固定，从而该等项无净权限delta；不满足则另行准备受审的最小可恢复配方。

唯一 writer：本轮文档 Codex 在 `yanfenma uid502/gid20`；**拟申请未来唯一操作 writer 为 yanfenma(uid502)，须Owner明确绑定实际操作者/窗口ID**，当前尚未任命；runtime固定505:601。root子动作仅经既有入口，独立 verifier 只读且由Owner指定。mutex EEXIST即STOP，不清他人锁；失败保留本人mutex和证据，只有成功close释放。Secret只进0700/0600私有目录，公开只键名/脱敏hash。

## 4. 05b 精确语义与四禁止

机制接受来自Owner③及既有D-009；生产 mutation 只有终稿批准且当次全部前置成立后才可进行。允许停机后逐条消费可信、exact、当前适用epoch、handle/attempt/generation/agent绑定一致、exitObservedAt及exit_wait成功/child_real_exit正证据，且无业务/来源冲突的记录；调用既有 `settleLate(...terminated_without_outcome)`，保留原业务 UNKNOWN 和历史，不以“处理所有pending”为目标。

**四禁止：批量结算（包括 quiet 前后造 clean census）、业务结果推断、重放、重新投递。** 不能把 termination 映为 succeeded/failed/cancelled；不重跑旧 occurrence，不发新 kick绕过旧身份。现有工具可能将逐条合法结果同一原子发布；这不允许 blanket settle-all，也不允许一条证据授权其他记录。

Fence contribution：只允许解除**该条 exact 已证明终止记录在其拥有域有权解除的 contribution**。Router按Agent、Scheduler按job/occurrence各由其既有owner重算aggregate；Router settlement不隐式授权写Scheduler jobs或清另一域fence。另一未证UNKNOWN、另一Agent/job/epoch的贡献仍保留。`FENCE_ACTIVE = 存在本域未获合法outcome/termination settlement的UNKNOWN贡献`，不是“见一条终止即全局放行”。解除不创建retry/catchup；业务历史与已提交外部effect仍UNKNOWN。

missing/stale/conflicting/wrong-epoch/registry-absent/PID-only均零 authoritative settlement 写。旧unproven历史保留、不因其存在阻安装；但仍可执行或真实副作用边界隔离缺证时阻断。发布前CAS/第二writer/部分内存失败零发布；rename后或读回失败写入真值UNKNOWN，STOP对账，不能报零写。每记录收据须有exact identity、证据摘要hash、前后业务字段hash、贡献/aggregate前后、是否写入；只读观察不造结果。

## 5. 窗口阶段、PASS、失败 STOP 和时间预算

推荐 **下一次Owner确认的工作日10:00–12:00 Asia/Shanghai**（例如2026-11-09；02:00–04:00 UTC），便于Owner/writer/verifier同场；Owner定具体日期时间。准备可在前一日/当日窗口前完成，最长4h。此建议**不是有效时窗**，不自动安排/布防。每阶段到点不再启动后继动作，先对账在途child，超时不等于已终止。

必须顺序：`00→01→02→03→03b→06a→04→05→05b→06→07→08→09→10→11→12→13`。

| 阶段 | PASS | 时间预算（建议上限） | 失败 STOP 配方 |
|---|---|---|---|
| 00 | 当次Owner批准最终commit/hash、精确writer/UID/窗口/attempt1/全部effects；只持有本人mutex | 2min | 缺批准不得启动；过期/争锁停，不清锁 |
| 01 | 封印W/payload/工具bundle；仅授权lockfile备份清洁，其他dirty为0 | 10min | 保持旧服务；不扩大清洁/工具替换 |
| 02 | source A/H、旧stop SHA `23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9`、exactPID/UID/GID/lstart/plist/env/Binding、helper均fresh一致 | 5min | UNKNOWN/漂移停，不换identity |
| 03 | 重读S04同tuple封印与双启动结果、源→装配→scratch字节/link/mode、工具可消费本收据 | 10min | 旧receipt/缺member停；不重跑未变门凑证据 |
| 03b | 真实形状脱敏当前v3/jobs副本由真实candidate reader读取；按Agent fence、原UNKNOWN保持、无replay/outbound/源覆盖；配置握手覆盖实际消费者 | 5min；child45s | reader/oracle/config必需门失败停 |
| 06a | 旧runtime仍活；完整树预镜像+所有effects前态/ACL/link/外部两树、rollback绑定封印 | 60min（含全扫描复制总量） | 不可读/漂移/时间超限不bootout；不排除难复制成员 |
| 04 | mtime≥180s，census可读且期间日志不变；允许非空，纯观察 | 最多40min（80×30s） | 超时/错误停；不结算制造quiet |
| 05 | 一次bootout后supervisor/exact旧进程/ports消失；workers与已派发写/投递边界终止或有效隔离有证 | 2min（原exit轮询60s） | 已停但未安装走pre-install恢复；PID absence不证明remote取消 |
| 05b | §4逐条exact证据、适用epoch、无冲突、仅合法贡献，历史仍UNKNOWN | 2min | 不可信零写；竞态/发布未知STOP，不批量弥补 |
| 06 | 仅复核06a完整树inventory/ACL与当前schema/Agent/Binding，不再复制 | 2min | 漂移停；缺预镜像不临时ditto |
| 07 | 精确W/三参数/source A/H/固定R3 payload；installer和tee真实rc=0 | 12min | started/interrupted真值UNKNOWN；核child/log/本receipt，不第二install |
| 08 | 本次BAK/reuse marker/§5b/log/closure PASS+rc0；仅遗漏现行config字节carry-forward | 3min | 不猜BAK/借旧receipt；失败走§6 |
| 09 | 最终bytes/link/mode/ACL/config/Node外部依赖与同sealed组合一致，effects前后/恢复证明与stamp/必要consumer门过 | 5min | 不同/缺证明在bootstrap前STOP，不临场补包/改stamp |
| 10 | §7明确准入释放边界已单独获批且所有前置PASS；plist只deployed SHA；一次bootstrap，稳定25s | 1min | 无继承证明而要求继续pause即STOP；失败不重试，先核新worker隔离 |
| 11 | 新exactPID/SHA/env/UID/GID/listener owner；公开health/capability（50HTTP/19local）/Scheduler ready独立readback | 3min | 必需公开就绪失败STOP；auth保持实际UNKNOWN |
| 12 | 完整600s只读观察，可归属新HR broker execute，期间PID稳定；不人为触发 | 10min | 未观察为HR_NOT_OBSERVED，本门未PASS，不重投/推业务完成 |
| 13 | 各门/UNKNOWN/效果/恢复/独立poststate回执齐备，retention只列不删；成功才释放自有mutex | 2min | 缺证据不宣布成功，保留phase/mutex |

05→11目标20min、硬上限30min；恢复自决定恢复起预算30min、累计停机申请上限60min；12另10min，均受Owner有效期约束。阶段预算是单项上限，不可相加借用超过总上限；剩余不足停止后继。原工具ditto单命令3600s、quiet80×30s、candidate45s、稳定25s、HR600s；无全局deadline/全部恢复SLA，预算可达性与独立计时执行法尚UNKNOWN，需隔离证明后才可承诺，不改源码补计时器。

共同STOP：记录 `STOPPED / window_id / writer / stage / UTC / rc / install_state / stop_state / exact child / receipt hashes / mutation_truth / affected_readiness`；保存raw、mutex；不自动恢复/重试/清锁/切身份/重放。每条恢复另需同一批准中精确scope、终止与兼容门。S05依赖的生产动作停止，本轮授权文档交付可继续。

## 6. 恢复：bootout 前预镜像、R1/R2 与 D-009 v3 版本线

当次 `RD=/tmp/fleet-roll-prep/window-receipt-v5/run-<UTC>.<unique>`（物理等价/private/tmp），当前UNKNOWN。必须在bootout前取得：`preimage-full` 完整live（app/harness/node-runtime/.cache/config/home/generations）；`preimage-live-inventory.json`、`preimage-acl-listing.private.txt`（源→副本→源复核）；`plist.preimage`、`plist-preimage.json`、`old-loaded-env.private.txt`、`old-process.json`；§3.3 external JSON/ACL；§3.4全部effects前态；`rollback-preimage.json` 绑定hash与坐标、`preparedBeforeBootout=true / businessSnapshotRestoreAllowed=false`。Secret不进Git。06停后仅recheck，预镜像不延后至停机复制。

1. install=not_started：不猜BAK；若bootout已尝试，fresh-read并证明完整原树/plist/env/identity未变、旧worker/tools不会并发，再在获批恢复bootstrap范围内恢复原callable service。未证明则STOP。
2. started/interrupted：先证明本次installer child终止并对账log/mutation receipt。超时不授权kill/第二安装；无终止事实保持UNKNOWN。
3. failed：仅本次 `failed-install-mutation-receipt.json`；NOTHING_WAS_MUTATED还须§3部分写陷阱对账一致；TREE_WRITTEN_BY_THIS_RUN按本次BAK与reuse标记；无新receipt停。success后失败只用本次 `successful-install-rollback.json`（installLogSha256/uniqueBAK/section5bCompletion），不混用failed receipt。
4. 先停止/隔离exact失败新实例、workers及已派发tools；保留failed完整树到新唯一路径，不覆盖旧证据。
5. **选旧代码前兼容门**：冻结A既有 `scripts/fleet-window/anarrowed/candidate-state.mjs --rollback-check --candidate-root /VERIFIED/OLD/CLOSURE --turn-recovery-store /CURRENT/control/turn-recovery-v3.json --jobs-store /CURRENT/scheduler/jobs.json --receipt-dir /NEW/ISOLATED/RECEIPTS`；真实旧Router/Scheduler reader读取当前副本，hash/源保持，必须PASS。未验证命令仅作为既有配方，不在本轮执行。
6. **D-009 §10.2 / Timeout V3版本线**：jobs单document version2→3；V2 reader/writer读v3必须fail-loud；一旦v3/terminationSettlement提交，不得降级，旧V2代码回退禁止，保持停止只走V3-aware forward fix。Router recovery-v3与Scheduler jobs v3分别验读，不凭同一个“3”推兼容；不strip字段或恢复旧jobs/Binding/incident/runs/fence/credential快照。
7. **RESTORE-R1**：本次BAK `.preimage-reused-subtrees` 只允许node-runtime/harness/.cache；被搬走子树仅从本次已验证preimage-full补回；核全tree bytes/link/UID/GID/mode/ACL/xattr。缺子树的BAK直接mv不等于恢复。
8. **RESTORE-R2**：只限§3.3两个精确树；本次§5b实际触发（部分失败也须实态对账）+前态GID20证据；按既有配方递归重申GID20，不恢复旧内容、不加改UID/mode。E01–E06/E09/E10不能靠R2覆盖，须§3.4独立前后态/可恢复证明；缺则STOP，不临场扩大R2。
9. 完整旧closure+当前状态兼容+所有metadata恢复PASS后才允许一次旧bootstrap，复核exactPID/SHA/env/listener/health并独立收据；旧业务UNKNOWN保持。预算到点仍未证安全则停止新增动作报Owner。

## 7. S04 复用、S05 最小方案与验收分列

S04 `RECEIPT-W6-S04-R2.md`（SHA-256 `2fa894eb1836cc4993d2160e702facb7517ddbdac091642aab84236d7ccac4d5`，PR630 merge703fcac8）足以支持：20个指定命令rc0/无超时、官方装配与graph PASS、selected input/mode对账、r2 fresh-child、r3完整runtime16/16 true、73,887 regular files封存、cold三例/7fresh进程/零模型。canary以原工具SIGKILL结束，runtime SIGTERM后rc0；不把canary写成graceful。新harness接受精确Codex历史、旧514ab7b0期望拒绝、无关required event仍拒绝；不是任意未知event都接受。R1失败与辅助只读脚本异常历史保留。

| 验收责任 | 当前结论 |
|---|---|
| I01 fresh-child / I02完整runtime / I03非空cold历史 | **PASS_ISOLATED_S04_R2**，绑定A/H/N/合成空业务/无凭据/18788/18790。closed tuple未变不重跑 |
| I04真实形状状态/按Agent fence + 实际配置消费者握手 | 既有#628机制证据可引用；本次真实生产形状/全部auth消费者握手未完成，NOT_VERIFIED，不借16checks冒称已闭合 |
| I05当前旧closure读v3/完整R1/R2/全部权效回退证明 | 机制证据可引用；当次current state/全metadata/预算实证仍UNKNOWN |

**pause最小窗口方案**：沿既有bootout，不加launchd disable override/profile、不改env/plist、不新建持久协议；从stage05 exact exit/实际tool副作用边界已隔离后至stage10之前持续supervisor不存在、workers/ports无新owner，不bootstrap/kickstart。该方案只覆盖停机区间。旧pause仅构造时缓存，A无reader；bootstrap会开启Scheduler及已配置poller/入站，事后再stop存在竞态。

本申请拟把 **stage10 bootstrap 明确列为停机containment结束、恢复既有自然准入的释放点**，须Owner对该边界明确批准，不能称pause跨restart继承；释放仍受原各Agent/job fence与所有准入合同约束。若Owner要求在stage11/12仍零业务新准入，则冻结组合**STOP-UNKNOWN before bootstrap**，没有本轮零代码可用的已证明方案。远端已提交effects仍UNKNOWN。

stamp：268是pause文件，真正source-stamp冲突见调查。只读记录不手填/转写/伪造dirtyCount；需要无.git provisioning reader的路径NOT_READY。若声称本次必需配置/最终provenance gate兼容，须真实writer→reader→reuse→backup证据；未证STOP受影响consumer及依赖的bootstrap。已有固定Agent不使用该consumer的排除证据也未取得，不能凭推测解除整个门。

结果必须分列：SOURCE_AND_MECHANISM（已有）；ISOLATED_TUPLE_ACCEPTANCE（仅上表PASS范围）；INSTALLED_AND_LOADED（未执行）；AUTHENTICATED_CAPABILITY（UNKNOWN/NOT_TESTED）；HR_OBSERVATION（未执行）；SINGLE_HISTORICAL_RECOVERY（未执行/UNKNOWN）；BUSINESS_COMPLETION（未执行/UNKNOWN）。生产成功须完整安装/加载、公开health、capability与Scheduler就绪、600s可归属新HR记录、独立poststate。没有自然HR记录不触发新请求；health/ACK/in-progress不能升格业务完成。本scope不执行历史恢复。

## 8. #628 负向矩阵与 R2 oracle：仅机制证据

V1起草时已读取 [#628](https://github.com/mayf3/dsh-agent-core/pull/628) MERGED 元数据：code `c063f5569bcfd8c51240281a04cc3f42e8ed68c9`，PR head `bf7942002ef7bfb578cb2968b2b659f1fa5009a6`，merge 为冻结 app。冻结 `RECEIPT-WINDOW-ANARROWED-R2.md:15-26` 记录 oracle 精化，:29-49 映射与结果，:51-54 原始路径。

原始 selftest `/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/summary.json` V1起草时只读复核 SHA-256 `1154abead3dbb35c0689f83f41b267974bd6f853c28d9267f39f97a2b07fa1bb`；结果 `PASS_ISOLATED_CHECKS_AND_STDIO_CANARY`，`productionStageExecution=NOT_EXECUTED / productionWrite=false / windowGO=false`。本轮也没有重跑。

| 负向场景 | 已有结果/限制 | 冻结实现坐标 |
|---|---|---|
| quiet只观察、历史旧epoch/null exit、unsafe/running/遗漏记录分类 | 历史 selftest PASS；历史 UNKNOWN 可携带，unsafe 必须停 | window-selftest.py:296-330 |
| 错epoch、陈旧证明、裸 child label、exitObservedAt=null | 零 authoritative 写，UNKNOWN保留 | settle_unresolved_runtime_down.test.mjs:165-200 |
| memory/disk 第二writer竞态 | 拒绝 stale publication，竞争者状态保持 | 同测试:202-224 |
| 部分 in-memory settlement失败 | 整批不发布 | 同测试:225-244 |
| 真实隔离活worker | 先拒绝 settlement，单独停worker；不是生产worker实验 | 同测试:245起 |
| bootstrap失败 | rc19，停下游、无自动回滚、current业务hash不变 | anarrowed/rollback.test.mjs:13-46 |
| candidate真实加载/Agent fence | 历史16 checks true；不代表本次75ece组合 | R2回执:29-49、candidate-state/child |
| R2启动诊断oracle | 65反例 PASS，旧业务字段/计数/动作/未知键不能放宽 | candidate-oracle.mjs / .test.mjs，R2回执:15-26,42-47 |
| 旧v2 reader读取v3当前状态 | 拒绝；禁止旧业务快照覆盖，只能安全STOP/forward fix | candidate-state --rollback-check、R2回执:42-47 |

历史结构门为 `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`（候选违规0，既有债务29），不称全仓零债务。这些证据支持工具机制，不证明组合闭包、生产安装、live恢复或业务结果。

## 9. 剩余 UNKNOWN、已处置条件和禁止越界

| ID | 当前事实 / 最小解除 |
|---|---|
| S01 | 已有99b0fa84钉针修订与旧selftest证据保留，不重做。**工具组合交付仍需绑定**：A自带executor/helper_core仍钉f6a1f77a；工具分支99b已钉A但不包含A的03b/06a/anarrowed完整实现。不得直接运行任一不完整面；只能引用既有产物，执行前证明某一受审完整bundle同时具备新阶段+新pin+S04输入绑定。本轮零源码，不在文档里假造该bundle已存在 |
| S02 | Owner②效果范围已解决；本申请逐路径落表。全部树外metadata可恢复证据仍UNKNOWN，见§3.4；不是继续请求原则裁定 |
| S03 | Owner③05b机制已接受；生产权限待终稿批准；§4四禁止及contribution边界生效，不再把合法termination-only误写成业务结算 |
| S04 | 指定隔离门PASS，复用R2；未覆盖的I04/I05仍独立UNKNOWN |
| S05-pause | 停机containment方案明确；bootstrap释放点待Owner明确接受；持续暂停通过verify/HR不可证明则STOP-UNKNOWN |
| S05-stamp | legacy writer/JSON reader冲突未实现修复；必要消费者真实排除/闭环兼容证据缺失，STOP受影响路径 |
| U-auth | workflowTokenVerifier及haltable token真实aud/issuer/scope、producer→consumer握手UNKNOWN；不能改Scheduler全局aud兜底，不mint/轮换token |
| U-consumer | history/env/R28/R30/R38/effect-key真实consumer/provider UNKNOWN；未实证不退役、不增永久兼容层 |
| U-svc | Svc后继/paired acceptance context accepted heads、loaded协议与Core兼容UNKNOWN；Core源码或S04不证明Svc业务通过 |
| U-authority | A中#625 liveness后继仍proposed/none；实际accepted权威binding UNKNOWN，不能由Mandate激活 |
| U-live | 当次旧app/harness/PID/UID/GID/plist/env/Binding、活动writer、old tool/remote effect隔离、pause/stamp实际状态UNKNOWN；不复用旧PID49103 |
| U-recovery | bootout前完整preimage/metadata逐叶、实际旧reader/v3兼容、恢复时间预算可达性UNKNOWN |
| U-SOP | #605 Owner链接的入口C `b7ctl/SOP-DEPLOY-MASTER.md` 精确路径/hash未取得；执行前提供并核对，不新建平行部署流程 |

这些不是一概否定历史UNKNOWN的安装资格；真正阻断的是新准入/工具/回退/所选消费者的具体缺证。缺长期authority时停止依赖动作并RE_PREFLIGHT，调查/运行状态不替代accepted authority。未证明的tuple/bundle/mutation truth均不得写PASS。

## 10. 精确执行申请（尚未签发）

请求Owner在技术门闭合后，批准**一次**本机fleet窗口及下列具体scope；批准须绑定本文件最终审核commit和SHA-256（以最终提交及回执实测为准）、唯一期限/attempt/writer/verifier。当前不是要求立即执行，不因本PR完成而运行。

```text
ISSUER = Owner mayf3；签发记录待Owner给出
MANDATE_ID = EXECUTION-MANDATE-W6-V2
APP = 75ece578301b014a23b987568d1eb8af96795300
APP_TREE = 7a68ac22c8eef6340131dacafe1c0f2aa5dfa0d6
HARNESS = 13ecda5c759263c7ce7ab93b678f862f65513f34
HARNESS_TREE = 81a047cd4d6574614e88cffe04c5e013cc43535b
NODE_SHA256 = c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b
INSTALLER_SHA256 = 2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a
PROPOSED_WRITER = yanfenma uid502；Owner当次实名指定实际操作者
RUNTIME = authsvc uid505/gid601；child502/20
WINDOW_ID / VALID_FROM / VALID_UNTIL = UNKNOWN；Owner明确UTC起止，含恢复预算
MAX_ATTEMPTS = 1；失败/超时不得重置
TARGET = system/ai.agent-core.runtime；/usr/local/libexec/agent-core
SCOPES = source_lockfile_cleanup, production_mutex, full_preimage,
         bootout, exact_05b_termination_only, install,
         installer_exact_path_metadata, plist_deployed_sha_only,
         bootstrap, verify, hr_observe,
         conditional_preinstall_restore_bootstrap, conditional_RESTORE_R1,
         conditional_RESTORE_R2_exact_two_paths
ANCILLARY_EFFECTS = 仅§3逐路径及必需附属效果，全部本次preimage/receipt绑定
ADMISSION_RELEASE = 请求明确批准stage10；若要求持续pause则STOP-UNKNOWN
POST_STATE_VERIFIER = Owner指定的独立只读verifier，当前UNKNOWN
MAY_CHANGE_PRODUCT_CONTRACTS / MAY_EXPAND_SCOPE = NO
SELF_ISSUED_BY_ACTING_AGENT = NO
OPERATION_ALLOWED_NOW = NO
BEFORE_APPROVAL_STAGE_00_COUNT = 0
```

禁止：批量结算、业务结果推断、重放/重新投递、跨域/全局清fence、清他人锁、旧业务快照覆盖、token/Secret/Grant/身份政策变更、额外restart、两遍窗口、未批准特权helper安装、controller/profile激活、kickstart -k、Node架构变更、真实HR请求触发、retention删除。root现有入口的权限metadata效果仅§3必需精确范围，非笼统“权限变更零”也非权限扩张。

DONE_WHEN（本次）：调查+V2+回执（及明确STOP记录）完整、实测hash/只读独立审查、仅文档commit/push/PR引用#605；生产零写/源码零改/stage00零/authorityJSON零。gh超时则已提交即停，写STOPPED，不重试或换通道发布。技术UNKNOWN不消失，生产执行保持STOP。完成文档交付即停，不另做源码实现或重跑S04。
