# EXECUTION-MANDATE-W6-V1

状态：**DRAFT_FOR_OWNER_REVIEW / EXECUTION_BLOCKED / NOT_AUTHORIZED**。起草日期：2026-11-06（Asia/Shanghai）。本文件落实 Owner 执行序第 3 节，只请求一次后续窗口的精确授权；本次交办只授权文档和只读核查。本文件、提交、PR 或 Owner 对冻结组合的原则采纳均不执行生产动作，也不自动变成窗口授权。

本稿完整保留冻结组合、31 项处置、阶段/回退/验收定义及执行申请。已发现的执行依赖冲突见 §10；在这些冲突闭合前，不得生成可执行 authority JSON 或进入 stage_00。停止记录为 [STOPPED-EXECUTION-MANDATE.md](STOPPED-EXECUTION-MANDATE.md)，实测回执为 [RECEIPT-EXECUTION-MANDATE.md](RECEIPT-EXECUTION-MANDATE.md)。

## 1. 冻结声明、权威与实测来源

候选永久绑定下表，后续 main 前进不改变本 Mandate。PR [#628](https://github.com/mayf3/dsh-agent-core/pull/628) 的 merge commit 即冻结 app；含 EKR #621–#625、#626 和 #628 窗口工具。不得换成“届时最新 main”。

| 输入 | 冻结身份与实测值 | 获取坐标 |
|---|---|---|
| app | commit `75ece578301b014a23b987568d1eb8af96795300`；Git tree SHA-1 `7a68ac22c8eef6340131dacafe1c0f2aa5dfa0d6` | 只读对象仓 `/Users/yanfenma/workspace/project/production-dsh-agent-core`；不是对该仓 checkout 或 loaded production 的断言 |
| harness | commit `13ecda5c759263c7ce7ab93b678f862f65513f34`；Git tree SHA-1 `81a047cd4d6574614e88cffe04c5e013cc43535b` | `/tmp/v5-rebuild/harness-src`；实测 HEAD 精确相等、porcelain 为空 |
| Node | **darwin / x64 / v25.6.1**；二进制 SHA-256 `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`；Mach-O x86_64 | 现役 scratch `/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node`；`/private/tmp/v5-rebuild/assembled-root/node-runtime/bin/node` 同哈希。Node 不属本次两仓 Git commit/tree，用实际字节 SHA 绑定，不编造 Node Git SHA |

两仓源码闭包索引均在起草时实测：规范编码为 `git ls-tree -r --full-tree -z <commit>` 的**原始 NUL 字节**，包含 mode/type/blob/path；两仓 gitlink 均为 0。

| 清单 | 条目 / 原始字节 | 清单 SHA-256 |
|---|---|---|
| app 全部 tracked 源码 | 2,383 / 269,899 | `396f3e441c5ab2db47fdf54e3da1e33829bab845115019bd643dd5f276040262` |
| harness 全部 tracked 源码 | 7,839 / 881,047 | `43e6ea35a4f68449273e21855663786835e828021f3697b65da417a354e62863` |

源码清单不是含依赖、链接、权限、外部 dylib 的安装闭包清单。新组合的装配闭包与全部隔离验收当前 **NOT_BUILT_OR_VERIFIED**。Node 的外部 `/usr/local/opt` dylib 依赖也必须纳入运行闭包，二进制哈希不能代替它们。

只读复核命令如下；不 checkout、不安装、不运行生产工具：

```sh
git -C /Users/yanfenma/workspace/project/production-dsh-agent-core rev-parse '75ece578301b014a23b987568d1eb8af96795300^{tree}'
git -C /Users/yanfenma/workspace/project/production-dsh-agent-core ls-tree -r --full-tree -z 75ece578301b014a23b987568d1eb8af96795300 | shasum -a 256
git -C /tmp/v5-rebuild/harness-src rev-parse HEAD '13ecda5c759263c7ce7ab93b678f862f65513f34^{tree}'
git -C /tmp/v5-rebuild/harness-src ls-tree -r --full-tree -z 13ecda5c759263c7ce7ab93b678f862f65513f34 | shasum -a 256
GIT_OPTIONAL_LOCKS=0 git -C /tmp/v5-rebuild/harness-src status --porcelain=v1
shasum -a 256 /private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node
file /private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node
/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node -p 'JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})'
```

本次文档写面：`/private/tmp/dsh-fleet-window-tools`（`/tmp/dsh-fleet-window-tools` 同一工作树），branch `chore/fleet-window-tools`，parent `e61458e0666bc6aa962d31561beeff1ada4a4f56`。该 parent 是冻结 app 的祖先，但本工具工作树仍是旧版本；不得从工作树文件名推断已经具有 #628 实现。读取冻结工具一律用上述 app 对象的 `git show <app>:<path>`。

本次治理路由：`PREFLIGHT / REUSE / BRIEF / ROUTINE`，仅起草操作文件、不改变长期 Product Contract；未来窗口为独立 `REUSE / EXEC_PLAN / CONTROLLED / OPERATION`，须有效 Mandate、runbook、当次回执及独立 post-state 核验。当前 `IMPLEMENTATION_ALLOWED=NO / OPERATION_ALLOWED=NO / MERGE_READY=NOT_APPLICABLE`，文档可提交供审批。

直接读取的约束来自冻结 app 内 `.agents/README.md`、`.agents/local/README.md`、accepted governance lock、Architecture、D-008、D-009，以及 Lifecycle V4、WAE V3、WEC V3、D009_ALIGNMENT、PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1。它们保留 native Session、唯一恢复/业务所有权和 UNKNOWN 语义；implementation acceptance 不授权 production apply。Architecture 文首仍标“冻结草案”，不擅自改成 accepted。`AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1` 在冻结 app 仍为 `proposed / implementation_authority:none`；#625 代码与 Owner 接受评论不替代该 lifecycle，相关后继权威绑定必须复核。

## 2. 31 项“必须保留”处置清单

来源为既有固定 fork 映射：P=`23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9`，旧 M=`4b865cce8ee8880ec1503c856a1eddcd0d40cdaa`；映射原统计是 **37 提交 = 29 必须保留 + 6 已吸收 + 2 退役**。本稿的 31 是明确的**行为处置单元**：把 29 中 `b95562eb` 的凭据/产物及 `26813473` 的 pause/effect 分别拆开。不是伪称原表有 31 个必须保留提交；请求 Owner 确认该映射。来源文件 `scripts/fleet-window/PRODUCTION-FORK-BEHAVIOR-MAP-V1.md:14-75,177-472`，SHA-256 `90f57e79c0113fb730f7cc0e2cfd6d755a652bec0f02ba522392455abaf6b7b9`。

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
| W6-K24 / 26813473 pause | b；bootstrap 前门 | A 无 AdmissionPauseControl/file reader/checkpoints/远程操作面。旧文件不约束新 runtime；独立 PR 或另批全入口 containment，必须跨 restart 验证真实入口零新准入。没有证明即 STOP。 |
| W6-K25 / 26813473 effect | b | `runtime/workflow-execution-runtime.js:280-282` 无 idempotencyKey 透传；P Router 也无 consumer。先核外部 effect 执行边界及 Svc 去重职责，不能把字符串当防重成功，不叠第二身份保护。 |
| W6-K26 / 4fc07f95 | b；install 前门 | JSON source-stamp writer/reuse/backup、runtime arch env 后续 PR。A `scripts/lib/trusted-source-git-stamp.sh:49` 生成 HEAD+dirtyCount legacy wire，installer `:603,:831` 原样写出，provisioning `index.js:85-115` 要求 JSON `{commit,dirtyCount}`；精确 reuse/最终 stamp 未实证兼容即 STOP，不手工伪造 stamp。 |
| W6-K27 / f682514b | b；闭包门 | 所有 runtime optional package 非零 regular bytes census 缺失；独立 gate PR。本窗须独立实测全部实际 payload，单次 resolve/import 不能代表闭包完整。 |
| W6-K28 / 4a5ab2cd | b | EMPTY+exactly-one unresolved health trigger 后续 PR；恢复只经 K07 唯一 exact-proof 入口，EMPTY 不证明 worker/tools/effects 停止。 |
| W6-K29 / 56b545a3 | b；闭包门 | K27 的 `lstat` no-follow 与 R64 历史对账随同一 PR；symlink 不为包 payload 充数，历史对账不升级为 live PASS。 |
| W6-K30 / f917aeba | b；闭包门 | 20 项 darwin-x64 seed manifest/materializer/install hook 缺失；独立供应闭包 PR。固定 x64 不证明 tarball 存在/哈希/lock 匹配，必须以实际封印闭包验收。 |
| W6-K31 / 23fb91a6 | b | reconciliationStore→health snapshot 显式 wiring 随 K28；A 的只读 reconciliationRuntimeStatus 不等于 watch 已装配或恢复成功。 |

原已吸收项 `2133c2de/a62b0627` 不混作 31：保留 main #622 mandatory `expectedAttemptId/expectedGeneration`、锁内 fresh replay/CAS 一套；不增加 `requireReconciledIdentity/status` 保护，不因 P 更宽泛拒绝就覆盖 main 身份模型。未证 effect consumer 的责任已归 K25。两项合法退役只退出执行，历史仍保留。

## 3. 操作边界与唯一写者

未来目标固定为本机 `system/ai.agent-core.runtime`，plist `/Library/LaunchDaemons/ai.agent-core.runtime.plist`，安装树 `/usr/local/libexec/agent-core`，既有运行身份 `authsvc`（精确 UID/GID 须窗口前实测），生产端口 8788/8790。旧 app 预期 `23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9`，是执行器允许的 stop identity，**不是本次实测 loaded 状态**。PID/启动时刻/plist hash/loaded env/harness stamp/Binding hash 均留待 fresh-read，不挪用旧 PID 49103。

请求的业务操作类只有：**bootout / install / bootstrap / verify / hr_observe**。附属效果必须逐项被 Owner 明确纳入同一批准：独占生产 mutex、当前完整树预镜像、仅 staging untracked lockfile 的备份/清洁、root custody bundle、现行 config 缺项原字节 carry-forward、plist 的 deployed SHA 唯一 delta、当次回执写入及兼容性通过后的 R1 恢复。它们不是可忽略的“只读”。目前不授予任何这些生产效果。

明确不做：不 replay/重新投递旧 UNKNOWN，不手动清 fence/锁，不变更身份/Grant/Secret/权限策略，不生成/轮换 token，不做真实 business success/failure settlement，不改 jobs/Binding/incident/runs/credential 历史，不删 generations/备份/旧证据，不启动部署 controller/profile，不用 kickstart -k，不改 Node 架构，不把 hr_observe 变成发起 HR 请求。

05b 的 termination-only settlement 与 installer/R2 的权限元数据写入是 §10 明列的**待裁定效果**，不能由“install”一词概括授权。本稿不默许它们，也不把它们伪称零写。

唯一 writer 规则：未来 Owner 只能指定一名非 root 操作者及确切 UID/window_id，root 子动作只经既有已允许入口；同一 writer 持有 `/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock`。writer 名称、UID、有效 UTC 起止目前 **UNKNOWN / 未签发**。不并行启动第二生产 writer，mutex EEXIST 即 STOP，不清他人锁。独立 verifier 只读，不另开生产执行面。本次文档唯一写者为当前 Codex；并行助手只读取证。

Secret 处理：不把 token、credential、原始 loaded env 或业务原文写入 Git/PR。运行时私有证据目录 0700、文件 0600；公开回执仅记键名、哈希、坐标与脱敏结论。Secret 值不为“证明可审查”而公开。

## 4. #628 阶段流程、PASS 与失败 STOP 配方

**以下是冻结 #628 机制和拟执行门的对照，不是允许现在运行的命令。** 顺序必须为：

`00 → 01 → 02 → 03 → 03b → 06a → 04 → 05 → 05b → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13`

| 阶段 | PASS 条件 | 失败 STOP / 恢复入口 |
|---|---|---|
| 00 authority/mutex | Owner 当次有效签发、唯一 writer/UID/时窗/attempt=1、旧 exact identity 和允许效果齐全，独占 mutex | 未签发/过期/争锁立即停；不清锁、不触碰 service |
| 01 integrity/clean | 精确 manifest、root custody bundle；仅已批准 staging untracked pnpm-lock.yaml 备份/哈希后清洁，其他 dirty 为零 | 停在 bootout 前；保留输入，不扩大删除范围 |
| 02 fresh-read | 冻结 source/harness、tree/clean；fresh plist/loaded env/PID/UID/GID/old SHA/Binding 精确匹配 | 任一 UNKNOWN/漂移 STOP；不得换 identity 继续 |
| 03 双启动前置 | §6 同一封印组合 fresh-child canary + 完整 runtime 均 PASS，完整文件/链接/权限与 receipt 匹配 | 旧 receipt、空闭包/成员差异即 STOP；不 bootout |
| 03b candidate state | 真实候选加载脱敏真实形状副本，原 UNKNOWN 保留、按 Agent fence、不误伤其他 Agent、无 replay/outbound/源覆盖 | 子进程/reader/oracle 失败 STOP；原文件/metadata 不变 |
| 06a **bootout 前预镜像** | 旧 runtime 存活；完整树 inventory/ACL、ditto/xattr、源→目标→源复核一致；完整回退坐标封印 | 副本/扫描/ACL/来源漂移失败，保持生产原态，install=not_started |
| 04 quiet | mtime ≥180s、census 可读且观测期间日志不变；**纯观察，census 可非空** | 超时/不可读 STOP；不结算制造 CLEAN，不 bootout |
| 05 old exit | 单次 bootout 后，supervisor、exact old PID/worker、8788/8790 消失；旧工具/已派发写操作终止或真实边界隔离有证；历史 UNKNOWN 与 unsafe 分类完整 | executable/unproven 或隔离缺证 STOP；已停机但未安装按 §5 pre-install 路径恢复，不以 PID absence 推远端效果取消 |
| 05b exact settlement | 机制要求同 epoch、exitObservedAt + exit_wait succeeded/child_real_exit、无冲突；unproven 留 UNKNOWN 不阻安装 | **当前范围未授权此写入，整窗仍 STOP 于 00 前**；不得擅自跳阶段。若另获批准，发布前竞态/部分内存失败拒绝发布；跨 rename/读回失败时 writes=UNKNOWN，STOP 对账，不声称零写 |
| 06 停后复核 | 只核 inventory/ACL 与 06a 一致，schema/agent/Binding 当前有效；此处不再 ditto | 漂移 STOP；不把完整复制推到停机期，不安装 |
| 07 pinned install | source/bundle/隔离再核；官方安装器三个固定输入参数和 R3 payload 精确封印；真实 installer/tee rc | started/中断时 mutation truth=UNKNOWN；查本次 child/log，禁止第二 install |
| 08 receipt/config carry | 本 invocation rc0、closure PASS、唯一 BAK/reuse marker/§5b 完成证据；仅补 installer 遗漏的现行 config | 缺/旧 receipt STOP，不猜 BAK，不覆盖既有 config |
| 09 final binding | 最终 app/harness/Node 全部 bytes/link/mode/ACL/config 对应 §6 同一组合；UID/GID custody 独立核对；stamp/provenance 真实 | 任何不同在 bootstrap 前 STOP，回到相应隔离验收，不“临场补包” |
| 10 plist/bootstrap | plist 除 deployed SHA 外完全保留；bootstrap 一次；等待稳定25s；启动前 containment 门已过 | 失败 STOP，无自动重试/回滚；先证明新实例与工具停止，再按兼容门选恢复 |
| 11 production verify | exact new PID/UID/GID/env/listener owner，health/capability/Scheduler ready；认证面按事实 UNKNOWN | 必需公开就绪失败 STOP；健康不替代 auth/业务证明 |
| 12 hr_observe | 完整600s，仅观察新 `broker execute as agent agt_hr-agent` 可归属日志；不人为触发 | 缺日志/进程变化即该门未通过；保留 HEALTH_PASS 与 HR_NOT_OBSERVED 的区别，不重发旧请求 |
| 13 close | 各门结果、UNKNOWN、恢复/业务独立报告；retention 只列不删；仅成功释放本人 mutex | 失败保留 mutex/phase evidence；不宣布窗口完成，不自动清场 |

共同 STOP 配方：记录阶段、时间、rc、writer、install_state/stop_state、本次子进程/回执坐标；保留 mutex 与原始证据；禁止自动恢复、重放、重试、删锁或换身份。回执未知就写 UNKNOWN，不套用旧记录。上表不把历史 fenced/blocked/旧 epoch/exitObservedAt=null 本身当发布阻塞；仅仍可执行或不能证明隔离的风险阻断。

## 5. 完整预镜像、R1/R2 与失败恢复预算

未来运行目录必须由唯一 writer 分配：`RD=/tmp/fleet-roll-prep/window-receipt-v5/run-<UTC timestamp>.<unique>`（冻结 executor 的 mktemp 形式）；window_id 通过 authority/invocation 绑定。**当前尚未执行，因此具体 RD、全树哈希、旧 loaded identity 均 UNKNOWN；下列是将要生成的坐标合同，不伪称副本已存在。** `RD` 必须在 live 树外，不复用/覆盖先前 run。

| 必备坐标（全部 bootout 前取得） | 内容与封印条件 |
|---|---|
| `RD/preimage-full` | 完整 `/usr/local/libexec/agent-core` 树，含 app/harness/node-runtime/.cache/config/home、历史 generations、链接、UID/GID/mode/xattr/ACL；不设静默排除集 |
| `RD/preimage-live-inventory.json`、`preimage-acl-listing.private.txt` | 源/副本/后置源的命名集、类型、内容/链接及 metadata 可核对；失败不封印为 PASS |
| `RD/plist.preimage`、`plist-preimage.json`、`old-loaded-env.private.txt` | 当次 plist、hash、loaded args/env、精确旧进程身份；Secret 留私有 |
| `RD/external-preimage-metadata.json` | 树外 control/scheduler-watchdog、control/incident-backups 的当次 metadata；不是旧业务内容快照恢复授权 |
| `RD/rollback-preimage.json` | 以上坐标、完整树与 metadata 的已验证绑定；`businessSnapshotRestoreAllowed=false` |

06a 在旧 runtime 仍存活时完成树副本。04 quiet/05 bootout 后，06 只复核 inventory/ACL 漂移，防止复制期间变化；不能为追求 PASS 排除历史目录、权限、链接或凭据材料。完整可恢复预镜像未封印就不得 bootout。

恢复按实际 mutation 分支选择：

1. **install=not_started**：不恢复猜测 BAK。若 bootout 已尝试，fresh-read supervisor/PID 与完整原树/plist/env；在窗口已明确允许恢复 bootstrap 时，只恢复原 callable service，保持现行业务 state。旧 stop 身份不确定则 STOP。
2. **install=started/interrupted**：installer termination、写入进度和 mutation truth UNKNOWN，先对账本 invocation child/log/新 mutation receipt；不得发第二安装，也不得与未证退出的安装器并行恢复。
3. **install=failed**：只采用本次 `failed-install-mutation-receipt.json`。NOTHING_WAS_MUTATED 不盲恢复；TREE_WRITTEN_BY_THIS_RUN 才按该 receipt 的 BAK/R1/R2 标记走恢复。缺失或无法确认 receipt 时 STOP。
4. **install=success 后失败**：只采用本次 `successful-install-rollback.json`、本次 install.log/BAK marker/§5b 证据，不借用旧 mutation receipt。先停止/隔离 exact failed 新实例及 workers/tools，保留完整 failed-* 树到新唯一路径。
5. **选旧 code 前的当前状态兼容门**：用旧完整闭包的真实 Router/Scheduler reader，在隔离新目录执行 `anarrowed/candidate-state.mjs --rollback-check`，输入是**当前** recovery-v3/jobs state；只读、保留其 hash。旧 v2 reader 不懂 v3 或无证据时 STOP，只能另走 V3-aware forward fix；不删字段、不降级、不拿旧 jobs/Binding/incident/runs/fence/credential 快照覆盖。
6. **RESTORE-R1**：按本次 BAK `.preimage-reused-subtrees`，仅从本次已验证 `preimage-full` 补齐被复用移走的 node-runtime/harness/.cache；完整核 bytes/link/UID/GID/mode/ACL 后才可启动。单纯 mv 一个缺子树的 BAK 不是完整恢复。
7. **RESTORE-R2**：只在本次 installer §5b 确已完成时，按 external metadata 证据处理树外 scheduler-watchdog/incident-backups 的 GID20；**仅 metadata，不恢复旧内容**。现行“权限变更零”不授权该动作；未另获精确裁定不得执行 R2，也不得声称回退可闭环。
8. 最后只 bootstrap 通过兼容门的完整旧闭包，fresh-read PID/SHA/env/listener owner/health；旧业务仍 UNKNOWN。缺树/权限/termination proof 均 STOP，交 Owner，不清锁、不换身份。

**拟申请的时间预算，不是已验证 SLA**：bootout 前准备最多4h（超时放弃窗口且不动生产）；05→11 目标20min、硬上限30min；恢复从决定恢复起预算30min，累计停机申请上限60min；12 另有600s只读观察。任一预算到点停止新增动作，先对账在途 child/外部效果，不能把超时当成终止证明。预算不足或 reader 不兼容时保持安全停止并报 Owner，不强制旧快照回滚。

冻结工具实际已有的局部预算仅为 quiet 80×30s、exit 30×2s、ditto 单命令3600s、candidate child45s、bootstrap稳定25s、HR600s；**无已验证的整阶段/全恢复 deadline**。尤其3600s不是全树扫描+复制总时长。上述总预算必须在隔离 rehearsal 测量/受控 writer 计时方案与 Owner 批准后才可承诺，当前预算可达性 UNKNOWN。

## 6. 隔离验收定义：同一冻结组合

每份新 receipt 必须同时绑定 app commit/tree、harness commit/tree、Node binary SHA/version/platform/arch、recipe/input manifest、装配完整 manifest digest、config 输入键名/脱敏 hash、时间/actor、退出与 teardown；同一 sealed root 不得验收后补包或换链接。最终安装树若与该封印不同，在09 STOP。闭包包括依赖 payload、symlink 实际目标与边界、mode/ACL、native bindings 和 Node 动态库。seed/stamp/SDK 缺口必须实测，不把 Git tree 当依赖闭包。

| 验收 ID | 必做输入/动作和 PASS 条件 | 当前结果 |
|---|---|---|
| W6-I01 fresh-child | 在独立 HOME 运行官方 fresh-child boot canary；使用真实组合/完整 plugin tree；ready、无 missing/disallowed/native load 错误；退出/close、descendant/端口 teardown 有证 | NOT_RUN_FOR_FROZEN_TUPLE |
| W6-I02 完整 runtime | 原 runProductionRuntime/compose/Scheduler readiness，隔离18788/18790；真实 SDK/Broker/plugin 导入与路由配置；health、listener ownership、ready logs；干净 shutdown，源/config 无越界写 | NOT_RUN_FOR_FROZEN_TUPLE |
| W6-I03 历史 cold-session | 使用合法脱敏、**含历史事件**的 native Session（非空 fixture）；冷启动 fresh child 后 resume 同一 (agentId,sessionId)，历史顺序/身份保留、不重发旧 prompt/tool/消息；新 runtime 真实读取，不以文件存在当 resume | NOT_RUN；旧 empty fixture 不满足 |
| W6-I04 状态与配置握手 | 真实形状 recovery-v3/jobs 副本；按Agent fence（原Agent拒绝、其他Agent不误伤）、UNKNOWN/旧业务字段保持、无重放；完整配置消费者握手，见下文 | NOT_RUN_FOR_FROZEN_TUPLE |
| W6-I05 失败与回退 | 隔离模拟 bootstrap失败/installer部分失败/R1复用子树/R2 metadata（若授权）与当前 v3→旧reader；旧reader不兼容必须 STOP，current业务hash保持；验证所有失败无自动重试 | 历史机制可引用；新组合/实际旧闭包仍 NOT_RUN |

关键配置握手逐键记录 producer→consumer→实际加载结果：`AGENT_DIRECTORY_AUTH_JWKS_URL`、Scheduler audience、Workflow 独立 audience/issuer/scope（不得靠更改全局 Scheduler aud 兼容）、health-incident routing binding、Broker credential provider、notification ingress authConfigured、真实 Git SDK 及 agent-base/https-proxy-agent、harness JSON source stamp、Node arch/native binding、poller及所有恢复/入站入口 containment。无真实 token 的隔离验证只能证明配置形状与 fail-closed；真实认证仍 UNKNOWN，不 mint token凑 PASS。

**跨切换准入门**：P 的 AdmissionPauseControl 只在构造时读文件、缓存状态，坏文件 fail-open；pause 不覆盖显式 recoverAttempt/所有 Router/入站路径，也不取消已过检查点 inflight；A 完全不读该文件。必须在 bootstrap前以另经批准的全入口 containment 与 restart 测试证明不会准入新业务，且 old worker/工具实际副作用边界已隔离。不接受“文件 paused:true”“未配 poller”“PID没了”单项作为完整证明。当前证明未建立。

R2 state oracle 仅允许已白名单的启动诊断追加：旧记录/身份/业务字段/历史 epochs/旧 attemptedActions 前缀保持；新 action 只能 ownership_check/blocked/runtime_restart_ownership_unavailable 及精确四字段；时间不倒退、bytes计数按可信函数精确重算。源 fixture/admission/jobs、rollback reader 不享有诊断豁免。未知字段/任意 reason/业务 outcome 或 fence 改动均 FAIL。

## 7. 成功验收与结果分列

窗口成功必须依次证明：新完整安装组合与封印相等；exact PID/UID/GID/loaded SHA/env/listener owner 正确；product API 8788 与 ingress 8790 的公开 health 通过；实际 capability 数与隔离基线一致（旧证据为50 HTTP/19 local，不能硬把旧数当新事实）；日志包含 product-api listening、notification-ingress ready/store ready、production-runtime ready、Scheduler loop online/完整 startup readiness；12 的600s观察完成并有可归属的新 HR broker execute 记录；独立只读 verifier 读回。

冻结 helper:311-315 的现成 verify 仍硬要求50 HTTP/19 local；若新隔离基线不同，stage11仍必须STOP，另行授权工具输入/门绑定修订，本稿不自行放宽。

必须分别报告以下结果，互不代替：

- `SOURCE_AND_MECHANISM`：冻结源码和 #628 机制证据。
- `ISOLATED_TUPLE_ACCEPTANCE`：W6-I01..I05 全部新组合结果；未跑保持 NOT_RUN。
- `INSTALLED_AND_LOADED`：实际 tree/manifest/PID/env/capability/readiness，不能只报 installer rc0。
- `AUTHENTICATED_CAPABILITY`：实际 authenticated canonical probe 未获本 scope 授权/未执行时写 UNKNOWN 或 NOT_TESTED；公开 health 不升格。
- `HR_OBSERVATION`：600s是否观察到新 broker execute 及 exact lineage；无记录如实 NOT_OBSERVED。
- `SINGLE_HISTORICAL_RECOVERY`：单条旧 handle/Agent/epoch/generation 的停止、恢复、readback证据；本 scope 不调用恢复，结果 NOT_EXECUTED/UNKNOWN。
- `BUSINESS_COMPLETION`：权威 Svc command receipt/event/transition 的独立业务结论；本 scope 零真实业务结算，保持 NOT_EXECUTED/UNKNOWN。

HR日志、in-progress、turn delivery、ACK 或恢复mechanism PASS 都不证明历史恢复或业务完成。不得为了让12通过而 replay旧请求；没有自然可归属新记录就报告该验收未通过并由 Owner 处理。

## 8. #628 负向矩阵与 R2 oracle：仅机制证据

已读取 [#628](https://github.com/mayf3/dsh-agent-core/pull/628) MERGED 元数据：code `c063f5569bcfd8c51240281a04cc3f42e8ed68c9`，PR head `bf7942002ef7bfb578cb2968b2b659f1fa5009a6`，merge 为冻结 app。冻结 `RECEIPT-WINDOW-ANARROWED-R2.md:15-26` 记录 oracle 精化，:29-49 映射与结果，:51-54 原始路径。

原始 selftest `/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/summary.json` 本次只读复核 SHA-256 `1154abead3dbb35c0689f83f41b267974bd6f853c28d9267f39f97a2b07fa1bb`；结果 `PASS_ISOLATED_CHECKS_AND_STDIO_CANARY`，`productionStageExecution=NOT_EXECUTED / productionWrite=false / windowGO=false`。本次没有重跑。

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

## 9. 剩余 UNKNOWN 与解除所需证据

| ID | UNKNOWN / 未满足项 | 责任与最小解除证据 |
|---|---|---|
| W6-U01 | 本次完整 app+harness+Node 装配、dependencies、外部dylib、config manifest | build/独立 verifier：精确 tuple manifest与 W6-I01..05，旧ce1d PASS不替代 |
| W6-U02 | workflowTokenVerifier aud/issuer/scope、mint与配置兼容 | Auth/Svc/Core owner：不泄Secret的实际consumer握手/拒绝路径证据；未证部分保持UNKNOWN |
| W6-U03 | 真正使用 history/env/R28/R30/R38/effect-key 的 consumer/provider | 各接口owner：活调用/配置/版本证据；无证据不退役、不另造兼容层 |
| W6-U04 | Svc后继依赖/paired acceptance context、权威版本与真实部署兼容 | Svc/Core authority owner：精确accepted heads、loaded版本/协议握手；不以Core source通过推Svc完成 |
| W6-U05 | #625后继 Spec lifecycle | 冻结对象仍proposed/none；Owner/监管给出已接受的精确权威、范围与binding，不能由本Mandate激活 |
| W6-U06 | 跨切换全入口 containment、旧worker/tools与已派发远端effects | 控制面owner：真实边界隔离/终止证据；已提交远端effects仍可UNKNOWN，不 replay |
| W6-U07 | 当前loaded旧app/harness/PID/UID/GID/plist/env/Binding与活动writer | 当次独立fresh-read，不能复用夜班快照 |
| W6-U08 | JSON stamp、seed供应、SDK/native optional真实payload | 构建owner：最终闭包实际hash/regular bytes/no-follow/reader兼容，不能手填stamp |
| W6-U09 | 完整预镜像、旧closure读当前v3、恢复时间预算 | 运行writer/verifier：本次06a封印+隔离rehearsal；旧reader不兼容即forward-only |
| W6-U10 | 认证canonical能力、历史恢复、业务完成 | 需各自另获scope及实际证据；当前结果保持UNKNOWN/NOT_EXECUTED，不为发布清空历史 |
| W6-U11 | SOP入口C精确版本 | #605 Owner评论指向 `b7ctl/SOP-DEPLOY-MASTER.md`；本机限定搜索未定位文件，执行前由监管提供精确hash/路径并复核；不新建替代部署流程 |

## 10. 执行申请与当前 STOP 条件

申请目标是对 §1 冻结组合执行 §3 的 **bootout/install/bootstrap/verify/hr_observe** 各一次，严格按 §4，保留 §5 回退与 §7 分列验收；无源码实现、权限策略/Grant变更、真实业务结算、旧UNKNOWN重放或历史恢复授权。Owner批准须绑定本文件最终审核commit/哈希及下面的具体窗口字段，不能只写“同意部署”：

```text
ISSUER = Owner mayf3（实际签发记录待补，不自签）
MANDATE_ID = EXECUTION-MANDATE-W6-V1
APP = 75ece578301b014a23b987568d1eb8af96795300
HARNESS = 13ecda5c759263c7ce7ab93b678f862f65513f34
NODE_SHA256 = c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b
WRITER / WRITER_UID / WINDOW_ID = UNKNOWN；Owner当次唯一指定
VALID_FROM / EXPIRES_AT = UNKNOWN；UTC明确起止，含恢复预算
MAX_ATTEMPTS = 1；超时/失败不自动重置attempt
TARGET = system/ai.agent-core.runtime；/usr/local/libexec/agent-core
SCOPES = bootout, install, bootstrap, verify, hr_observe
ANCILLARY_EFFECTS = §3逐项签认；不由SCOPES隐式扩大
INDEPENDENT_POST_STATE_VERIFICATION = REQUIRED；具体verifier待指定
MAY_CHANGE_PRODUCT_CONTRACTS = NO
MAY_EXPAND_SCOPE = NO
SELF_ISSUED_BY_ACTING_AGENT = NO
OPERATION_ALLOWED_NOW = NO
```

以下是阻止签发/执行的具体依赖，必须明确处置后才能申请可执行版。它们不阻本次只读起草交付：

| STOP ID / 类别 | SOURCE / 可达反例 | 影响 / 最小解除 |
|---|---|---|
| W6-S01 REQUIRED_GATE_FAILURE | 冻结 executor:13-14、helper_core:12 仍钉 app f6a1f77a/tree08d7ea；prerequisites:97-120 仍读旧r2/r3。执行会拒绝75ece或绑定旧组合 | 00/02/03/07/09不可就绪。另行授权工具输入钉针修订或已存在的合法输入方式，独立审查确切工具hash；本次零源码不修，不改变app冻结 |
| W6-S02 SCOPE_ESCALATION | 本次未授权生产/权限写；installer:1150-1218含chown/chmod、新目录provisioning，R2含树外GID20恢复 | 07与回退不可执行。Owner须明确区分原metadata精确恢复与权限政策扩张并签范围；保持零权限写则需独立准备一条符合该边界的既有安装路径，不能默认豁免 |
| W6-S03 SCOPE_ESCALATION | 05b实际 `settleLate(...terminated_without_outcome)`并原子写store（settlement:147-170），可能改变execution fence；“业务仍UNKNOWN”不等于无写入 | 05b不可执行。Owner明确裁定termination-only允许范围，或另授权可验证的零settlement执行路径；不擅自删除/跳过阶段 |
| W6-S04 REQUIRED_GATE_FAILURE | 新组合无完整闭包/I01..05；cold-session历史非空未执行，旧证据sourceHead为ce1d13c1 | 03/03b/09不可就绪。只在隔离面完成新组合装配/验收，保留UNKNOWN |
| W6-S05 REQUIRED_GATE_FAILURE | K24跨切换pause无reader；K26 stamp writer/reader格式冲突；真实consumer/Svc后继/权威binding仍未核 | bootstrap及受影响consumer不得启用；按§2/§6/§9逐个取最小证据；禁止平行保护/凭空补Spec |

**DONE_WHEN（本次起草）**：两份指定文档含实测冻结坐标、31项可追踪处置、全部流程/回退/验收/UNKNOWN及精确执行申请；冲突持久STOP；零源码/生产变化；指定分支新提交，gh可用则创建引用 #605 的文档PR，不 merge。完成即停，不重做已通过窗口机制、不开启新源码工作。未来生产 DONE_WHEN 单独以 §7 和当次签发为准。
