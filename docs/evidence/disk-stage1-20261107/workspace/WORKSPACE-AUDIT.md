# Workspace / worktrees / artifacts 只读盘点子收据

- 任务授权：BRIEF-DISK-STAGE1 第一阶段，只读扫描；仅本 worktree evidence/workspace 写入。未运行 build/test/install/GC/prune/调度/业务请求；未改变任何受查工作树。Git 读取使用 GIT_OPTIONAL_LOCKS=0。
- 适用 authority：`.agents/local/README.md` precedence；`AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1` CTR-SOD-002（§2调查）；`AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1` §5 fresh worktree 与 §12 Operator-managed retention（没有按年龄自动删除规则）；`AGENT_CORE_BACKUP_RETENTION_V1` pinned/rollback-used/legacy保护。这里只形成调查，不改变合同。
- 主线程固定 integration base / branch，完成整个阶段独立审查与交付。本子任务 route = REUSE / BRIEF / DURABLE；production mutation = NO。

## 空间账单（GiB = 2^30 bytes）

`workspace-du.json`: du -x -k -d2，2026-11-07T15:44:47Z 至15:45:50Z，rc1，因此为可见下界。单个du进程以默认同inode只计一次，不跟随symlink；APFS共享extent仍可能重复计量。后续子域采样区间分别在各JSON，不能冒充同一瞬时快照。

| 不重叠顶层域 | GiB |
|---|---:|
| workspace总量（父级，不与以下相加） | 248.573 |
| project | 117.596 |
| artifacts | 40.224 |
| workspace/.zcode-worktrees | 34.687 |
| github | 14.056 |
| worktrees | 12.753 |
| baby | 9.829 |
| personal | 5.381 |
| deployment-artifacts | 2.914 |
| deployment-worktrees | 1.268 |

`workspace/project/.zcode-worktrees` 仅0.135GiB，和 `workspace/.zcode-worktrees`34.687GiB是不同位置。Core自己的`.worktrees`仅0.448GiB；Svc自己的`.worktrees`12.685GiB。父域已包含这些。

artifacts排名：workflow-unattended-mechanisms-20261027 26.259GiB、production-deployment-control-plane-v1 8.375GiB、goal-svc-workflow-zero-ops-001 2.086GiB、ac549-eacces-repro 1.346GiB可见下界、AGENT_CORE_DEPLOYMENT_SYSTEM_V1 0.584GiB、dsh-native-arm64-runtime-v1 0.483GiB。workflow-unattended内ART10.062、svc-current-input5.278、svc-combined4.822、e2e-runs2.352、pg55432-cluster1.949GiB；DB只统计保留。

worktrees排名：52bd-svc-workflow-20261101 2.594GiB、m2-dispatch-intent-20261101 2.184GiB、codex-wec-kick-token-renewal-20261028 1.633GiB、codex-native-goal-enqueue-20261027 1.502GiB、codex-native-goal-integration-20261027 1.488GiB、harness-ac700-classification1.386GiB。完整排行在`worktrees-du.json`。

元数据有限深度枚举发现2957个命中build类别的路径，其中node_modules有2684实际目录+90symlink，dist160、target13、build6、.next3、closure1；这不是全树绝对总数，也不是可删除目录数。完整范围/排除/错误在`build-targets.json`。

## 大体量但明确留存的域

- `.zcode-worktrees/workspace+project+dsh-agent-core/ac-810`24.405GiB：24.393GiB为evidence，其中b7-first-batch-v5-build23.036GiB，v3-pair-maintenance-workblock20.061GiB，v50-release17.997GiB。包含b7-install-r*、preimage、*.bak、custody/maintenance freeze。没有以“重复/旧”判为可删；已排除出生成cache候选。`ac810-evidence-du.json`、`ac810-workblock-du.json`保留排行。
- `github/deepseek-harness.hold-b7-20261001`整树6.089GiB，有约百项tracked修改。其4.106GiB node_modules仅条件式候选，所有源码和修改留存。
- `artifacts/production-deployment-control-plane-v1`8.375GiB为控制面闭包/先前准备，包含bootstrap和first-live lineage；这里只统计，不移除任何closure/receipt。
- 实测活跃postgres PID30567/30569/30570/30572/30573/30574的cwd均在`worktrees/codex-assistance-resume-svc-contract-20261028/.superpowers/gcr-tests/pgdata`，该DB及父任务不得以旧时间回收。`lsof-cwd.json`有进程证据。
- 当前launchd仍正式引用workspace下production-auth-service两个版本路径、deepseek-harness、boke和agent-core等路径。具体Program/WorkingDirectory坐标在`schedule-references.json`；正式配置引用不是可回收理由。

## 13个非重叠生成叶目录条件式候选

每项完整创建者/最后观察引用/保留依据/各引用域/验证方法在`candidate-reference-matrix.json`；这里的“最后”是已查范围内的最新可定位证据，**不是全局最后一次打开时间**。出生时间/mtime不被用作可删理由。所有候选的Workflow/Mandate/rollback当前状态若无合法服务读回仍为UNKNOWN；没有任何一项被确认安全可删。独立reinstall/rebuild没有运行，交由后续阶段授权。物理可释放量由主线程APFS walker另绑定，本子收据不给du=物理释放的假结论。

| ID | 路径 | 独立du GiB | 创建者/工具线索 | 最新观察引用与留存限制 |
|---|---|---:|---|---|
| W01 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/svc-current-input-implementation/target` | 5.201015 | Cargo构建，历史build-candidate.receipt.json可归属工具，具体caller/PID未知 | build-candidate.receipt.json start=2026-10-27T01:50:02Z; final-handoff.json head4eabe824; svc PR90当前MERGED；candidate/svc-workflow-4eabe824cc4a在target外独立保留；source-test-binding与原report保留 |
| W02 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/svc-combined-integration-20261027/target-clean-f4a1` | 4.749569 | Cargo childPid64152，clean-build.json精确targetDir/source绑定 | clean-build.json 2026-10-27T11:38:21Z; CURRENT main docs/reports/WORKFLOW_UNATTENDED_MECHANISMS_20261027.md:255仍引用该artifact；candidate-build-binding引用target/debug binary；target外candidate/svc-workflow-f4a1ed85与原receipt保留 |
| W03 | `/Users/yanfenma/workspace/github/deepseek-harness.hold-b7-20261001/node_modules` | 4.105900 | pnpm标记存在；创建进程/copy方式UNKNOWN | 本次git读取：hold-b7 HEAD419ee11c，tracked约百项修改；当前worktree registry仍登记；literal文档检索无命中≠无引用；保留所有源码/lockfile/修改；dependency手工改动与重建能力未验证 |
| W04 | `/Users/yanfenma/workspace/project/svc-workflow/target` | 3.871174 | Cargo标记存在；具体创建进程UNKNOWN | 本次svc-workflow git worktree registry登记main@88ff8145；target创建2026-11-01不等于最后引用；保留源码/lockfile/已登记checkout；未核生产reader/rollback责任链 |
| W05 | `/Users/yanfenma/workspace/worktrees/52bd-svc-workflow-20261101/target` | 2.589352 | Cargo标记存在；具体创建进程UNKNOWN | 本次svc-workflow registry仍登记detached worktree@6cd6ae55；源码最后commit2026-11-04（不是target最后使用证明）；保留已登记worktree与测试/发布trace；执行态UNKNOWN |
| W06 | `/Users/yanfenma/workspace/worktrees/m2-dispatch-intent-20261101/target` | 2.178993 | Cargo标记存在；具体创建进程UNKNOWN | 本次svc-workflow registry仍登记detached worktree@d799bf27；target出生2026-11-02（不是最后使用）；保留已登记worktree与锁定输入；执行态UNKNOWN |
| W07 | `/Users/yanfenma/workspace/worktrees/codex-wec-kick-token-renewal-20261028/target` | 1.625694 | Cargo标记存在；具体创建进程UNKNOWN | 本次registry登记branch codex/wec-kick-token-renewal-authoring-20261028@dcd5fefb；PR91 MERGED head a381993与当前不同；保留后续source delta与历史调查docs/investigations/2026-10-28-owner-wake-token-lifecycle.md:10（artifact copy）；不能据PR合并丢target |
| W08 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a76-pr106-owner-node-reference-candidate-20261029/build-worktree/target` | 2.517281 | Cargo标记存在；task a76构建输入可归属，caller/PID未知 | a76/svc-component.json:18、svc-source-pin-receipt.json:60、FINAL_CANONICAL_BUILD_INPUT.json:7精确target path；后续a105 mandate族存在；历史正式source/binary/closure引用仍在；只候选生成缓存，原mandate/source/独立binary不动 |
| W09 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a76-pr106-owner-node-reference-candidate-20261029/helper-crate/target` | 1.406673 | Cargo标记存在；具体creator/PID未知 | a76 helper源码Cargo.toml/Cargo.lock仍在；同task a105 mandate族存在；target最后直接引用UNKNOWN；需调用者证明helper可重建、消费者已终止/替代；mandate状态未知 |
| W10 | `/Users/yanfenma/workspace/.zcode-worktrees/workspace+project+svc-workflow/ac-1301-7cd-revise-fix/target` | 4.185993 | Cargo标记存在；具体creator/PID未知 | svc PR85当前OPEN，head e068dd0621068201dc1794133a7952b933e18dfe与当前worktree精确一致；本次registry仍登记；HOLD_OPEN_PR；保持在审候选的构建回放能力 |
| W11 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a45-trusted-native-tool-policy-runtime-20261028/native-runtime-candidate/node_modules` | 1.323326 | pnpm标记存在；creator/copy方式UNKNOWN | a45/native-policy-real-tool-dispatch-smoke.mjs:7引用native-runtime-candidate；mtime2026-10-28T03:30:15Z仅文件坐标；保留task smoke脚本/trace/source/lock；独立reinstall未执行 |
| W12 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a46-cross-definition-runtime-20261028/native-runtime-candidate/node_modules` | 1.323326 | pnpm标记存在；creator/copy方式UNKNOWN | 本次literal引用检索范围内无report；package.json/pnpm-lock.yaml仍在；真正最后消费者UNKNOWN；没有terminal/retention证明，HOLD_UNKNOWN_REFERENCES；独立reinstall未执行 |
| W13 | `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a29-native-tool-env-luna/native-runtime-candidate/node_modules` | 1.323326 | pnpm标记存在；creator/copy方式UNKNOWN | a29/STAGING-REPORT-004.md:17及A29-NATIVE-RUNTIME-CANDIDATE-MANIFEST.json:30/1034；报告mtime2026-10-27T22:10:36Z；历史candidate manifest引用，保留原报告/manifest/source/lock；独立reinstall未执行 |

所有13项在可见lsof描述符快照内均无匹配；这不证明外UID权限、未来任务、Workflow或rollback不存在。launchd的可读配置无literal候选路径匹配，但存在权限拒绝/解析失败，不能写“无调度引用”。PR85仍OPEN且exact head相同，为明确HOLD；PR90/91/106已MERGED只说明source生命周期，未授权销毁测试或恢复证据。

两个最大artifact target均已有独立交付binary在target之外，绑定在`candidate-binary-bindings.json`。原manifest仍引用target/debug路径，后续若评估移除target，必须保留target外binary并验证当前hash、source/lock/toolchain可重建、引用责任链明确允许cache失效。A76还存在a44–a105 prepare/launch mandate族与后续checkpoint，不能凭PR106合并而认定helper/build target失去消费者。`a76-mandate-build-references.json`精确记录source/binary/target坐标。

## 权限/可见性缺口

- PERMISSION_DENIED `/Users/yanfenma/workspace/artifacts/ac549-eacces-repro/locked`。
- PERMISSION_DENIED `/Users/yanfenma/workspace/project/dsh-agent-core/"/Users/yanfenma/.recovery-backups/workflow-recovery-20260821T145031Z"`（引号是实际路径组件的一部分）。
- launchd配置PERMISSION_DENIED：用户`ai.openclaw.gateway.plist`；系统`com.openclaw.forum-scheduler.plist`、`com.openclaw.gateway.plist`、`com.openclaw.workflow-dispatcher.plist`、`com.openclaw.host-exec-runner.plist`。`zcode.fda-check.plist`为解析失败unexpected key at line12。未提权、未猜测。
- 未直接打开生产DB、Secret文件或活跃Agent会话内容；Workflow/Mandate current runtime不在这个子任务的合法读取收据中，因此保留UNKNOWN。

## 第三阶段最小GC建议（未执行）

复用当前构建/任务receipt，以显式artifact manifest区分源码+lock/toolchain、必须留存的binary/closure、可再生target/node_modules。先由原引用/rollback责任链解除条件，再从最小叶级生成cache评估；不新增按mtime批量清理任务，不让一次PR合并触发删除worktree。Worktree registry中的条目先证明任务终止/dirty state/PR状态、恢复输入和消费者，再讨论Operator retention。APFS clone或hardlink副本应先去重统计再报物理释放区间；真实释放仅在另行授权的后续删除时由同口径df区间验证。

## 候选覆盖与最后引用分类补记

`coverage-and-exclusions.json`记录扫描深度、范围、10个明确留存prefix及各prefix下已发现生成目录数。2957为元数据路径命中，不是2957个已量过的可回收cache；其中target/node_modules/closure真实目录2698个，原扫描在依赖根剪枝，目录之间没有发现包含关系，90个symlink node_modules排除。只对已测大域选取的13个独立生成叶目录作此候选审查。其余未逐项候选du/引用核验，不宣称比这13项小或无引用。这里是有限范围的优先调查候选，不是全机绝对top13/20可回收排行。

每项`reference_evidence_class`严格三分：`current`为新鲜git登记、exact-head OPEN PR或当前main仍存引用；`last_observed_historical`为定位到的原receipt/脚本/manifest；`unknown`包含全局最后读用、live Workflow、完整Mandate终止/consumer、rollback及外UID描述符。没有直接历史使用事件的项明确UNKNOWN，不将目录birth/mtime或Git源码commit时间伪装为target最后使用。
