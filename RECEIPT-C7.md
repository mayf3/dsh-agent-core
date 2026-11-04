# RECEIPT-C7

状态：**C7 隔离实现与 selftest PASS；生产未执行；窗口 GO 未授予。** PR：[dsh-agent-core #615](https://github.com/mayf3/dsh-agent-core/pull/615)，open、merged=false、auto_merge=null。不 merge。

任务：[BRIEF-C7.md](BRIEF-C7.md)。仓库 mayf3/dsh-agent-core；工作区 `/private/tmp/dsh-c7-selftest`；分支 `chore/c7-selftest`；integration base=`55d306a997c02fa57e41b815cc31362c66f9ee18`（本次新鲜 `git ls-remote origin main` 核实）。运行时间 2026-11-04 18:46:59–18:47:01 Asia/Shanghai，UID502/GID20。

实现复用现有 SOP R6/R7、accepted governance/local structure rules与本次任务授权。没有新产品合同、没有执行生产删除或改变 .bak normal3/pinned 规则。原件974行受现行500行规则约束，机械拆出Python；683行内嵌原文中667行保持逐行字节相等，另16行涉及validator提取、quiet predicate调用、分行与completion新增字段。[逐行映射](scripts/fleet-window/C7-EXTRACTION-MAP.json)、[完整源码差异](docs/reports/c7-selftest-20261104/SOURCE.diff)。新增与改动行均在差异原文，无隐含替换脚本。

R6：authority绑定人工基线SHA/对象域/窗口/采集者、stage11 PASS后后态与显式一对一rename map。stage00保存完整C7输入，stage13拒绝任何输入漂移；同时保存原始及映射后差异。隔离实测 `old -> new`，`kept`保留，映射后 `added=[] removed=[]`。缺失、新增、映射碰撞均按预期拒绝。

R7：使用authority明确的最新到最旧代际顺序，精确匹配直接 `.ds-old-*` 目录集，保留最新两代和显式/marker/current/025保护代；**仅列出**，无删除函数。stage13在释放自有mutex前保存 `c7-close.json`、精确元数据JSON与NUL路径清单。隔离实测保留newest/second/pinned/025，待删仅 `.ds-old-oldest`；所有fixture路径仍存在，`.bak-*`和`node_modules.bak`未进入待删集。代际遗漏、authority保护集漂移均拒绝。[完整diff/映射与保留结果](docs/reports/c7-selftest-20261104/c7-focused.json)。这不是生产命名对账或生产待删集。

前后快照schema、保护责任与窗口准备步骤见 [C7-INPUTS.md](scripts/fleet-window/C7-INPUTS.md)。输入定位纠正：`/tmp/v5-rebuild/STOPPED-C5R7.md`无§4表；实际15节点缺口表在WINDOW-READINESS §4，C7行在§5。没有改写旧回执或NO-GO裁决。

实际验证：`git diff --check`、shell语法、Python语法、recorder JS语法、15节点dry-run、selftest均rc0。[逐命令rc/argv](docs/reports/c7-selftest-20261104/validation-gates.json)。结构门在源码提交 `a7bf05fa7a35d7b1f916e2af164b33ed4c9a3512` 实跑rc0：`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，候选违规0、未受影响继承债务29、解决1；并非仓库全局PASS。[原始结构输出](docs/reports/c7-selftest-20261104/structure.stdout.json)。两位独立复核均0 blockers/0 spec gaps，[正式记录](docs/reports/c7-selftest-20261104/INDEPENDENT-REVIEW.md)。原日志因.gitignore遗漏的FOLLOW_UP通过精确force-add闭合，无需重跑测试。

selftest命令：`HOME=/usr/local/v5-boot-isolation TMPDIR=/usr/local/v5-boot-isolation bash scripts/fleet-window/window-executor-v5.sh --selftest`。外层环境也以隔离根为HOME；实际子进程HOME/TMPDIR均为本次新独占子目录，env/argv/cwd/raw SHA完整记录。

原始隔离目录 `/usr/local/v5-boot-isolation/c7-selftest-bkng3h75`；外层验证目录 `/usr/local/v5-boot-isolation/c7-validation-vsyll9ql`。00/01/04复用实际纯validator；01还真实调用拆出的helper phase dispatch，只写本次隔离phase回执；02新鲜祖先protected-routing与关键静态SHA；03重核C5-r11的192材料SHA、两份canary/两份full-runtime语义；C7完整capture/close在合成fixture运行。生产00–04函数的变异路径未调用。

逐阶段输出原文（未改写）：

```text
SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED receipts=/usr/local/v5-boot-isolation/c7-selftest-bkng3h75
BEGIN stage_00_authority_mutex SELFTEST_ISOLATED_CHECKS
END stage_00_authority_mutex PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_01_integrity_clean SELFTEST_ISOLATED_CHECKS
END stage_01_integrity_clean PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_02_fresh_read SELFTEST_ISOLATED_CHECKS
END stage_02_fresh_read PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_03_dual_prerequisites SELFTEST_ISOLATED_CHECKS
END stage_03_dual_prerequisites PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_04_quiet_gate SELFTEST_ISOLATED_CHECKS
END stage_04_quiet_gate PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN c7_R6_R7_close_checks SELFTEST_ISOLATED_CHECKS
END c7_R6_R7_close_checks PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN canary REAL_OFFICIAL_STDIO_FRESH_HOME
END canary PASS REAL_OFFICIAL_STDIO_FRESH_HOME fullRuntime=NOT_EXECUTED
BEGIN postflight_preservation C5_MATERIALS_AND_VALIDATORS
END postflight_preservation PASS C5_MATERIALS_AND_VALIDATORS
SELFTEST PASS_ISOLATED_CHECKS_AND_STDIO_CANARY windowGO=false
```

真实stdio canary：官方helper SHA=`b737d6b42460383f305a741fb9d5f12babe9b1e292f933d3735d68a907447802`，实际child PID/PGID=69625；ready=true，pluginTreeFailed=false，missing/disallowed均空。官方helper SIGKILL returned=true，实际exit/close均code=null, signal=SIGKILL；recorder wait/reap rc0；已观察身份/组最终空。不是优雅退出。未请求TCP端口、未执行模型/凭据/业务请求；本次无full runtime启动。[原始result/退出](docs/reports/c7-selftest-20261104/canary-result.json)、[实际spawn/env](docs/reports/c7-selftest-20261104/canary-spawn.json)、[原始stdout](docs/reports/c7-selftest-20261104/canary-child.stdout.log)、[原始stderr](docs/reports/c7-selftest-20261104/canary-child.stderr.log)。recorder仅附加detached=true以形成自有进程组，官方argv/env/stdio不变。

C5 FINAL=`/usr/local/v5-boot-isolation/RECEIPT-C5-FINAL.md`，SHA=`ee96f779119c9e1f986ee582224c7bd9c06b6f8e193f647559cb0e8766f7a024`。C5材料索引SHA=`c3595d20ac56cfe21fbcb011a75252879b7780411d4d30f6656d41e4989ed4ea`。本次前后192材料与实际使用代码SHA核对通过；未复跑C5双runtime，未全量重哈希当前assembled-root。完整旧C5启动证据仅作为既有证据复用。

源码实测SHA256：

| 文件 | SHA256 |
|---|---|
| `window-executor-v5.sh` | `b1bf4779fdbdd8c3c4e9b783e012c1aa8abe3cfa7c26aae61a0c984e522a463d` |
| `window_executor_state.py` | `5801330a3e0ab30a6e31e4b590e1b7dadcc8d6658fd2f0e722879de888780713` |
| `window_executor_helper.py` | `6ac7643f8da29cc0b81f2224b08711638f3afc52c1e7b99da7fdb4e9cb62f2d2` |
| `window_close.py` | `6488b91e382dfadf9bf0022d11747beb85071a5e70142e92e6c7348c9bef6465` |
| `window-selftest.py` | `ae9ec0184632fe9d176cc260d9853d2a8ff1b43a0a4e1d64ffc8404a27007581` |

[本次证据SHA清单](docs/reports/c7-selftest-20261104/SHA256SUMS.txt)；[源码绑定](docs/reports/c7-selftest-20261104/source-bindings.json)。源码提交为 `a7bf05fa7a35d7b1f916e2af164b33ed4c9a3512`；后续提交仅归档、PR URL及回执，五份已测源码字节保持相同；最终仅文档差异的独立final-head复核与远端HEAD绑定在本回执所链PR正文持久记录（避免提交自引用）。

UNKNOWN / NOT_EXECUTED：

- 本次未提供生产窗口authority/写者/期限、实际命名基线/后态、实际代际顺序和保护集；生产R6/R7收账及实际待删清单均NOT_EXECUTED。
- 生产树、launchd、8788/8787没有读写调用；生产mutex/lockfile清理/fresh-read/settlement/quiet polling/bootstrap/安装/删除均NOT_EXECUTED。生产加载、业务验收与窗口GO保持未认证。
- 原production stage03仍使用历史r2/r3 schema；本次C5-r11 adapter只用于selftest，不能用本结果认定生产stage03或最终闭包已通过。原04/05b结算脚本权限/termination与D-009含义的依赖未在本次运行，仍需C4/C8既有门解决。
- 全部当前assembled-root的逐文件重哈希、实际完整runtime双启动本次NOT_RUN；192历史材料与当前关键文件通过不替代全量当前闭包验证。
- 未采样逃逸后代、OS/Rosetta共享缓存字节、native-arm64/长期负载、真实模型/认证/外部投递/业务、C3 installed Git既有UNKNOWN保持不变。
- 生产删除必须窗口内独立精确授权与新鲜核对；本PR仅list-only，merge由监管验收后代行。
