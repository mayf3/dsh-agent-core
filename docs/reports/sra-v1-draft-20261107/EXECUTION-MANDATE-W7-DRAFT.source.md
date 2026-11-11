# EXECUTION-MANDATE-W7-DRAFT

**DRAFT_NOT_ISSUED / OPERATION_ALLOWED_NOW=NO。十节草案完整；不是执行许可。**

仅Owner可签发。签发前零stage00、零authority JSON、零生产写入。此文由R5直接任务授权准备，不改变Product Contracts，不自授窗口、身份或权限。正式签发需未来精确最终hash/发行包、当次readiness、actor/环境/时效/attempt和独立审核。

## 1. 冻结组合、来源与治理坐标

- APP=`f6e332d7568b01c5253618449bfef5839102c851`；tree=`d83d94033619c9ea837db2caf8b944b4c2f7ea69`。
- HARNESS_RECOMMENDED=`13ecda5c759263c7ce7ab93b678f862f65513f34`；tree=`81a047cd4d6574614e88cffe04c5e013cc43535b`；生产现有514ab7b0保持独立观察。
- EXPECTED_OLD_SHA=`393a0afccedc5cce7be8b492c82d68d8d52206f6`；本轮观察PID7188不是未来可复用PID。
- Node binary SHA256=`c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`，darwin-x64 v25.6.1。平台不能现场切换。
- f6e stock installer SHA256=`dba2f136af78b6d89bf58d1b9ab0c15259efa3bf4f4d4f904e9494fd11d7741e`；package helper=`f8118e93306656a0aa45f5f1ca92d710217ecfc3947b8d5cdff6ddd2d4346869`。现有W6实际window installer=`2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a`，未被重新限定或证明适用f6e；W7实际执行installer/bundle为NOT_SELECTED_NOT_QUALIFIED。
- 模板为tools@`8b032c50:EXECUTION-MANDATE-W6-V2.md`，SHA256=`7b35095d2beb0563cbb531e4d444c8bc89b2512e667a16d4e1afe0abf31fb89a`；cb85e94是V1。保留框架，不继承旧签发或当前事实。
- 治理：Architecture仍为冻结草案（docs-only），沿用其边界且不改变lifecycle；已接受的Lifecycle V4、Timeout V3/D-009及相关Workflow Contracts不变。未来operation=REUSE / EXEC_PLAN / CONTROLLED，须独立有效Mandate。当前仅REUSE / DURABLE隔离prep。
- 工具精确hash附本轮receipt；工具worktree HEAD=`63e195ddd79786b4d5f52a2b3f1d730c69a85b5b`；未commit/merge/push。不把该HEAD称为已包含dirty工具修改的发布bundle。

## 2. 保留行为与fork映射增补

正式映射为`scripts/fleet-window/PRODUCTION-FORK-BEHAVIOR-MAP-V1.md`的R5 P2→M2/#621–#647增补。原37提交统计29保留+6吸收+2退役保持历史；以下31个W6-K是历史行为单元身份，不是31个提交。表中a/b和A行号均保留为W6历史定位；不能作为f6e当前已吸收结论。当前是否等价、consumer及门的判定用R5增补和当次实际路径重新绑定，不扩大为本次实现授权。

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


R5增补：21个同号first-parent merge、#637/#638两个间接实现、四个无本地PR引用；不推断远端状态。四重点pause/独立Workflow aud仍未吸收；#646为Router/Scheduler历史reader及新writer guard，#644/#647不是pause/auth替代。M2已接受#623绑定由#631修正。P2新增NEEDS_REVIEW recheck事件可能不被M2 Workflow reader认识，真实生产存在性UNKNOWN；生产启动前用当次授权副本及真实reader核验，不改写事件。历史旧EMPTY清fence执行必须RETIRE，责任经既有exact-proof入口MIGRATE；未实际迁移consumer不声称已完成。

## 3. 精确效果、前镜像与权限边界

以下E01–E17沿用W6效果身份；第三列旧行号仅说明旧W6 W来源，**不是W7最终installer已校准行号**。未来选定W7实际installer后须逐路径重核准确效果，不得借此扩大或先行执行。runtime505:601、child502:20，禁止现场切身份。

| ID | 精确路径 | 历史效果范围，未来逐路径复核 |
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
| E11 | `/usr/local/libexec/agent-core/app` | 递归 `chown -R -h 505:601` / chmod `u+rwX,go+rX,go-w` |
| E12 | `/usr/local/libexec/agent-core/home` | 同 E11 |
| E13 | `/usr/local/libexec/agent-core/harness` | 仅 REUSE_HARNESS !=1 时同 E11；reuse 则保持原 metadata，仍须核验 |
| E14 | `/usr/local/libexec/agent-core/node-runtime` | 仅 REUSE_NODE !=1 时同 E11；不因 x64 选择扩大平台范围 |
| E15 | `/usr/local/libexec/agent-core/home/.credentials.yaml` | chmod0600，不改 Secret 内容 |
| E16 | `/usr/local/libexec/agent-core/config` | 递归 chown505:601/chmod0700；其直接 `*.json` chmod0600；实际匹配文件逐名列于本次私有清单 |
| E17 | `/usr/local/libexec/agent-core/.cache` | 递归 chown root:wheel；仅根 chmod0700 |

E07/E08严格排除在E05递归权限树外，RESTORE-R2只涉及这两树：`/Users/authsvc/.agent-core/control/scheduler-watchdog`与`/Users/authsvc/.agent-core/control/incident-backups`；当前前态GID20须fresh证据，UID/mode/业务字节保持。E06前态若非相同目标symlink则STOP，不删除未知authority文件。E09/E10仅根metadata，不递归接管agent子树。E15只权限，不暴露/改Secret内容。

前态需包含所有effects的逐叶存在性、成员、UID/GID/mode/mtime/link/ACL/xattr及本次restore proof；不能用只覆盖live树和R2两树的现有helper冒称覆盖其他树外effects。未来`RD/installer-effects-preimage.private.json`、postimage、restore-verification及哈希均FRESH_AT_WINDOW，当前未创建。原状态并非预期/可恢复证据缺失则STOP于bootout前。missing helper或DSH seed不齐则STOP，不隐式新装setuid helper、controller或profile。精确plist/env/directory/backup附属效果只能在未来签发清单内。

## 4. 05b停机间隙D-009语义与四禁止

逐条exact处理当前适用epoch、agent/handle/attempt/generation一致，有exitObservedAt与可信exit_wait succeeded/child_real_exit正证据且无冲突的termination-only记录。business outcome仍UNKNOWN；只解除该记录在其拥有域内有权解除的fence contribution，保留其他Agent/job/UNKNOWN贡献，Router不得越权写Scheduler。

四禁止：**批量结算（含制造clean census）、推断业务结果、重放、重新投递**。missing/stale/wrong epoch/PID-only证据零settlement写。CAS或第二writer拒绝、内存部分失败不发布；rename后或readback失败mutation truth=UNKNOWN→STOP，不把未知提交当作安全重试。没有exact worker及已派发tool/effect边界终止或有效隔离证据，不新准入。05b不是业务恢复或旧UNKNOWN完成证明。

## 5. 阶段、PASS、STOP与预算

必须顺序：`00→01→02→03→03b→06a→04→05→05b→06→07→08→09→10→11→12→13`。下表预算仅建议，UTC窗口/actor/有效期及可达性验证尚UNKNOWN；阶段计时不允许超过总有效期，超时不证明child终止，也不授权第二次install/bootstrap或清锁。

| 阶段 | PASS | 时间预算（建议上限） | 失败 STOP 配方 |
|---|---|---|---|
| 00 | 当次Owner批准最终commit/hash、精确writer/UID/窗口/attempt1/全部effects；只持有本人mutex | 2min | 缺批准不得启动；过期/争锁停，不清锁 |
| 01 | 封印W/payload/工具bundle；仅授权lockfile备份清洁，其他dirty为0 | 10min | 保持旧服务；不扩大清洁/工具替换 |
| 02 | source A/H、旧stop SHA `393a0afccedc5cce7be8b492c82d68d8d52206f6`、exactPID/UID/GID/lstart/plist/env/Binding、helper均fresh一致 | 5min | UNKNOWN/漂移停，不换identity |
| 03 | 重读R5精确tuple封印与双启动结果、源→装配→scratch字节/link/mode、工具可消费本收据 | 10min | 旧receipt/缺member停；不重跑未变门凑证据 |
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


补充03b：必须覆盖实际Workflow历史词汇、Router/Scheduler各自真实reader、Agent fence和auth真实consumer，不用#646或空fixture替代。05→11建议20min/硬上限30min；恢复建议30min/累计停机申请上限60min；HR另600s。工具未证明有全局deadline及全部恢复SLA，须先隔离证明可达性后才承诺。共同STOP收据必须写window/writer/stage/UTC/raw rc/install_state/stop_state/exact child/mutation_truth/affected_readiness/hash；保留mutex与证据，不自动恢复/重试/清锁/切身份/重放。

## 6. 回滚：停机前完整预镜像、R1/R2与版本线

当次RD未知，拟`/private/tmp/fleet-roll-prep/window-receipt-v5/run-<UTC>.<unique>`。06a须在旧runtime仍活时取得完整live(app/harness/node-runtime/.cache/config/home/generations)、源→copy→源inventory、ACL/xattr、plist/env/identity、E01–E17和两树外前态，封印`rollback-preimage.json`；`preparedBeforeBootout=true`、`businessSnapshotRestoreAllowed=false`。Secret只留私有授权面。06停后仅recheck，不拖至停机复制。

1. install未开始：证明原树/plist/env/identity完整且旧workers/tools不并发后，才可在已批准恢复范围内一次原service bootstrap。不猜BAK。
2. started/interrupted：先证明本次installer child终止并核log与mutation receipt。timeout不授予kill或重装；真值不明保留UNKNOWN。
3. failed只用本次failed-install-mutation-receipt；NOTHING_WAS_MUTATED须与全部effects对账，TREE_WRITTEN用本次BAK/reuse marker。success后失败只用本次successful-install-rollback，绑定installLogSha256/uniqueBAK/section5bCompletion，不借旧run。
4. 停止/隔离exact失败新实例、workers、已派发tools/effects，保留完整failed tree到新唯一路径，不覆盖旧证据。
5. 旧代码选择前，真实旧Router与Scheduler reader必须分别读取**当前**v3副本；用既有`candidate-state.mjs --rollback-check`配方绑定已验证旧closure、current turn-recovery/jobs及新隔离receipt。命令路径/consumer须当次核验，本轮未执行。
6. D-009/Timeout V3：一旦version3/terminationSettlement提交不得downgrade；V2 reader拒绝时STOP，只走V3-aware forward fix，不strip字段、不恢复旧jobs/Binding/incident/runs/fence/credential业务快照。Router recovery-v3与Scheduler jobs-v3分别验读。
7. RESTORE-R1仅本次BAK `.preimage-reused-subtrees`允许的harness/node-runtime/.cache，从本次已验证完整preimage补回，并核byte/link/metadata/ACL/xattr。残缺BAK直接mv不算恢复。
8. RESTORE-R2仅§3两精确树，本次真实触发（含部分失败）、前态GID20证据，递归重申GID20，不恢复旧内容或改UID/mode。其他树外effects另有前后态/恢复证明，缺则STOP，不临场扩R2。
9. 完整旧closure+当前状态兼容+全部metadata恢复PASS后才允许获批的一次old bootstrap及独立PID/SHA/env/listener/health收据。旧业务UNKNOWN保持。

## 7. R5隔离验收与生产验收分列

R5证据 `/private/tmp/w7-prep-r5-20261107-z6cb74d4`；scratch `/usr/local/v5-boot-isolation/w7-prep-r5-09lfcybz`；实际assembly rc0。canonical依据C5R11:163及Owner R5裁定：assemble→官方provision→完整不变性基线→gates/canary/boots。27项bridge和父node_modulesmtime在receipt逐项列为预期官方delta；其后594项完整manifest零变更，hash`99bbe9a821ff01ec2bcc0027884135c597550770978107007bcf097d70374777`，不忽略GID/mtime、不改官方门。

canary同HOME first setupProfile、second setupProfile:false证明配置/CLI restart幂等，不称provision幂等；第二canary官方helper SIGKILL结束，不称graceful。独立homes full runtime两次health200/ready、SIGTERM后exit/close0。合成空jobs/无凭据/无model/无业务，端口18941/18942/JWKS18943。采样不证明未采样逃逸后代从未存在。harness86758/Node2415项与原源前后均0-delta含GID。源码状态和生产绑定前后需本轮收尾readback，非签发前未来fresh gate替代。

| 责任 | R5结论 |
|---|---|
| SOURCE_AND_MECHANISM | tasks1–3原证据复用，四工具hash相同 |
| ISOLATED_TUPLE_ACCEPTANCE | R5 task4实际rc0，限本fixture/tuple |
| INSTALLED_AND_LOADED | NOT_EXECUTED |
| AUTHENTICATED_CAPABILITY | NOT_TESTED/UNKNOWN |
| HR_OBSERVATION | NOT_EXECUTED |
| HISTORICAL_RECOVERY | NOT_EXECUTED/UNKNOWN |
| BUSINESS_COMPLETION | NOT_EXECUTED/UNKNOWN |

pause最小拟案只覆盖05 exact exit/effect隔离之后到10之前停机区间；旧pause无M2 reader，不继承。**stage10拟作为停机containment结束和自然准入释放点，必须未来Owner明确批准**，各Agent/job原fence仍约束。若11/12仍要求零新准入而无已证明方案，STOP于bootstrap前，不能先启动再stop。远端已提交effects仍UNKNOWN。现有legacy stamp与JSON reader矛盾须在真实必要writer→reader→reuse→backup路径证明兼容，不手写stamp；未证STOP相关生产consumer/依赖bootstrap，不阻止此草案交付。

## 8. 负向矩阵与oracle，仅机制证据

保留W6/#628历史机制证据及R3最新selftest，不因起草重跑不变门。R3 selftest command rc0，stdout hash`6afb2e98ef8bc8f1f77b973bbf559699744d705a9bbbcdb3a8bab5e4fa3a7ba4`；`PASS_ISOLATED_CHECKS_AND_STDIO_CANARY / productionStageExecution=NOT_EXECUTED / windowGO=false`。下表为继承的旧测试/receipt观察，当前tuple/生产状态不由它自动认证。

| 负向场景 | 已有结果/限制 | 冻结实现坐标 |
|---|---|---|
| quiet只观察、历史旧epoch/null exit、unsafe/running/遗漏记录分类 | 历史 selftest PASS；历史 UNKNOWN 可携带，unsafe 必须停 | window-selftest.py:296-330 |
| 错epoch、陈旧证明、裸 child label、exitObservedAt=null | 零 authoritative 写，UNKNOWN保留 | settle_unresolved_runtime_down.test.mjs:165-200 |
| memory/disk 第二writer竞态 | 拒绝 stale publication，竞争者状态保持 | 同测试:202-224 |
| 部分 in-memory settlement失败 | 整批不发布 | 同测试:225-244 |
| 真实隔离活worker | 先拒绝 settlement，单独停worker；不是生产worker实验 | 同测试:245起 |
| bootstrap失败 | rc19，停下游、无自动回滚、current业务hash不变 | anarrowed/rollback.test.mjs:13-46 |
| candidate真实加载/Agent fence | 历史16 checks true；仅属历史75ece组合，不代表本轮f6e组合 | R2回执:29-49、candidate-state/child |
| R2启动诊断oracle | 65反例 PASS，旧业务字段/计数/动作/未知键不能放宽 | candidate-oracle.mjs / .test.mjs，R2回执:15-26,42-47 |
| 旧v2 reader读取v3当前状态 | 拒绝；禁止旧业务快照覆盖，只能安全STOP/forward fix | candidate-state --rollback-check、R2回执:42-47 |


原结构观察是CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT，不能改写全仓零债务。机制证据不证明生产安装/live恢复/业务结果。R5实际官方门和最终不变性见§7与RECEIPT-W7-PREP，不复制旧PASS到变更坐标。

## 9. 当次UNKNOWN、前置门与禁止越界

当次writer/window/expiry/verifier/RD、最终installer/bundle custody与完整manifest、全effects/回退preimage、当前Workflow/Router/Scheduler reader、实际auth producer→consumer、旧workers/tools及external-effect边界、SOP C精确hash、必要stamp consumer兼容、预算可达性均UNKNOWN/FRESH_AT_WINDOW。当前OPERATION_ALLOWED=NO，原因是本稿未签发且这些未来必需证据未绑定；不是R5 prep失败。旧W6调查事实保持原坐标，既不冒充已复核当前状态，也不一概阻止草案。

共同禁止：跨域/全局清fence、清他人锁、覆盖旧业务快照、token/Secret/Grant/身份政策变更、额外restart或两遍窗口、未批准特权helper新装、controller/profile激活、kickstart -k、Node架构变更、真实HR请求触发、retention删除。没有自然HR记录只能HR_NOT_OBSERVED，不重投、不从health/ACK推业务完成。未来执行任何Required gate失败即停，记录真实phase和rc。

## 10. 精确申请字段：尚未签发

```text
STATUS = DRAFT_NOT_ISSUED
MANDATE_ID = EXECUTION-MANDATE-W7
ISSUER / SIGNATURE / REVIEWED_FINAL_COMMIT = UNKNOWN
APP = f6e332d7568b01c5253618449bfef5839102c851
APP_TREE = d83d94033619c9ea837db2caf8b944b4c2f7ea69
HARNESS_RECOMMENDED = 13ecda5c759263c7ce7ab93b678f862f65513f34
HARNESS_TREE = 81a047cd4d6574614e88cffe04c5e013cc43535b
EXPECTED_OLD_SHA = 393a0afccedc5cce7be8b492c82d68d8d52206f6
ACTUAL_EXECUTION_INSTALLER / FULL_BUNDLE_MANIFEST = NOT_SELECTED_NOT_QUALIFIED
WINDOW_ID / WRITER / VERIFIER / VALID_FROM / VALID_UNTIL / RD = UNKNOWN
MAX_ATTEMPTS_PROPOSED = 1
OPERATION_ALLOWED_NOW = NO
SELF_ISSUED_BY_ACTING_AGENT = NO
BEFORE_APPROVAL_STAGE_00_COUNT = 0
AUTHORITY_JSON_CREATED = NO
MAY_CHANGE_PRODUCT_CONTRACTS / MAY_EXPAND_SCOPE = NO
```

本稿完成即停止prep；不创建authority JSON、不stage00、不安排或启动生产窗口。Owner未来签发是独立步骤，本稿不向执行者授予任何尚缺权限。
