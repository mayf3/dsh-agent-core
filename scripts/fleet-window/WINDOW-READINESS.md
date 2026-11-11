# WINDOW-READINESS

**裁决：NO-GO。** 本轮只读对账完成，不放行02:30生产窗口。编号可按实际代码确定；安装器历史权威可以溯源；但结算语义、当前候选闭包、预镜像通过证据与执行授权仍未闭合。详见 [原始证据回执](RECEIPT-V5-PREP.md) 和 [停点](STOPPED-V5-PREP.md)。

评估日期：2026-11-04，Asia/Shanghai。若“今晚”指下一次02:30，则是2026-11-05 02:30；这只是日期解释，实际窗口起止、写者及授权有效期仍UNKNOWN。本报告不产生执行授权。全部耗时是工作量估计，非实测保证；Owner等候时间不能估算。

**只读审计例外/限制**：子审计执行过`git add --dry-run -- pnpm-lock.yaml`。没有实际暂存，但Git可能短暂创建并撤销index.lock；当前锁不存在、index时间仍为11月2日，缺少执行前目录基线，不能认证全程零临时元数据写入。后续已停止此类命令；不得将本轮标为严格零文件系统副作用PASS。详见回执。没有生产操作或安装器执行。

## 1. 阶段编号裁决

canonical（对现存活实现的事实映射）：**00、01、02、03、04、05、05b、06、07、08、09、10、11、12、13，共15节点**。00–13是14个整数阶段，05b是额外节点。依据 `/tmp/fleet-v5-prep/window-executor-v5.sh:956-961` 的main调用序列；不是按dry-run输出猜测。

**09=最终闭包绑定，10=plist bootstrap**（实现916–922）。05b存在于871–876并在958调用；dry-run边界57–84漏了它。前轮重建合同 `BRIEF-V5-REBUILD.md:21-22` 的09=bootstrap/跳过10与活实现不同，前轮回执保留原样，本报告纠正事实解释。

SOP原文31–32省略独立最终绑定节点、49写“14阶段”。以下只是建议diff，未修改SOP：

```diff
--- SOP-DEPLOY-MASTER.md
+++ SOP-DEPLOY-MASTER.md (建议，未应用)
@@ -31,2 +31,3 @@
-**核心（stage_05-10）**：旧实例退出 → 停机空隙结算（stage_05b）→ 完整预镜像（ditto 3600s）→
-pinned 安装（SHA+TREE 双钉 + binding 载荷）→ 安装收据 → plist bootstrap
+**核心（stage_05、05b、06-10）**：旧实例退出（05）→ 停机空隙结算（05b）→ 完整预镜像（06，ditto 3600s）→
+pinned 安装（07，SHA+TREE 双钉 + binding 载荷）→ 安装收据（08）→
+最终闭包与双启动收据绑定（09）→ plist bootstrap（10）
@@ -49 +50 @@
-- v5 执行器：非独立流程——它是入口 C 官方安装器的 pre/post 包装器（14 阶段）
+- v5 执行器：非独立流程——它是入口 C 官方安装器的 pre/post 包装器（00-13共14个整数阶段，另含05b，共15节点）
```

SOP30写150s，实际helper570/585写180s，执行器65/853的说明仍写150s。不能通过改编号顺带选择新静默语义；需明确采用值及依据后统一文字/实现。SOP61的删除保护备份配方与本轮红线冲突，本轮不执行。SOP63–66的四目录依赖配方不闭合，缺`proxy-agent-negotiate`。

## 2. 安装器权威裁决

| 身份 | 绝对路径 | bytes / 行 | SHA-256 |
|---|---|---:|---|
| 主仓旧副本 | `/Users/yanfenma/workspace/project/dsh-agent-core/scripts/trusted-cp-deploy-install.sh` | 25297 / 493 | `39144ad6547eb01c4f0d3ffc81c7922f5bb5e7698a4109714821fd57dd2cd52d` |
| 暂存源码基底 | `/tmp/fleet-roll-src/scripts/trusted-cp-deploy-install.sh` | 76444 / 1315 | `99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c` |
| **历史窗口权威字节副本** | `/tmp/fleet-binding-diag/r3/window-installer/trusted-cp-deploy-install.sh` | 77569 / 1336 | `2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a` |

依“历史实跑路径”，指定第三份`2a6b…`为窗口包装器的历史权威副本，`99cc…`只是它的基底。不是在前两份中强选一份。`WINDOW-SEQUENCE-v5.md:9`明确该路径/哈希；executor471强钉，830–839复制到root物理bundle，529–539验证完整manifest/成员/custody，890–895才调用该bundle的脚本。payload及lib必须随bundle整体绑定，不能只拿一个sh文件。

历史实际安装也用了这条链：`/tmp/fleet-roll-prep/window-receipt-v4/window.log:242-243,285-293,350-353` 有bundle坐标、供包、closure PASS及安装rc0；但363是`WINDOW V4 VERIFY_FAIL`。这证明历史安装入口，不证明完整窗口通过，也不证明本次候选可执行。新窗口采用该副本仍需Owner明确接受精确bundle及授权期限。

| gate名称 | 主仓/暂存/历史sh字面次数 | 真实行为 |
|---|---:|---|
| `EXPECTED_SOURCE_SHA` | 0 / 19 / 19 | 必须提供，等于source HEAD；clean及pack后TOCTOU校验，暂存250、294–298、947–954 |
| `EXPECTED_SOURCE_TREE` | 0 / 16 / 16 | 必须提供，等于`HEAD^{tree}`，暂存251、295、297 |
| `R3_BINDING_PAYLOAD` | 0 / 0 / 2 | 仅历史副本875–894有：fresh harness特定缺包布局供给x64 binding；异常布局/symlink拒绝，已有目录不覆盖；reuse仍过原gate。载荷哈希/custody由wrapper保证 |
| `CLOSURE_RESOLUTION_GATE` | 0 / 0 / 0 | **helper日志判据，不是env变量**。暂存890–895、历史911–915调用helper；helper172–238检查native/census/resolve，259输出、261返回0/2。主sh无此字符串不能单独证明无gate |

两份closure helper SHA均为`af43b33739ba05c0b178f5a87347edd774866dc7395ca302ce2a2b962ffded88`。前轮“暂存有全部四token”的隐含前提不成立；主仓与暂存差异还包括mutex/provenance/预算/架构/收据/属主等，不能用补四个字符串替代归并。

主仓→暂存完整逐字节unified diff附回执；首差为0-based offset1859。归并责任在 **dsh-agent-core安装器维护/合并线，由Owner mayf3或明确授权maintainer接受并归并**；监管本轮不复制覆盖主仓。两边相关提交作者均mayf3，但作者不等于当前任务认领者，具体worker/PR=UNKNOWN。

## 3. 源码树精确化清单

源码HEAD=`ce1d13c1e8585759c6a5f194fb5553d990574b5b`，TREE=`4b4a6a52cfe53a3569c5d14d909b90cdeb842704`；tracked diff rc0，status仍是`?? node_modules.bak/`及`?? pnpm-lock.yaml`。根lock为34335 bytes，SHA256=`e086823c00d7afcc3919514131721aad54a32893df1a1583c4ff08474f395baa`。保护目录不能删除/移动，不能加ignore来宣称clean。

| 不洁/缺件 | 兼容性结论 | 窗口前处理路径及权限 |
|---|---|---|
| 未跟踪pnpm-lock.yaml | 未纳入当前Git TREE；直接暂存仍不满足clean，纳入新commit才会改变SHA/TREE并需重绑pin/收据；直接删会丢当前依赖证据 | 本轮保留；建议新隔离candidate只取精确tracked commit，原lock作为证据保留；worker需下一任务授权 |
| node_modules.bak | 当前clean gate会拒绝；SOP61删除它与红线冲突 | 本轮保留；在新candidate拷贝node_modules而不拷贝bak；需Owner认可新路径及wrapper重新绑定，不在原树hide dirty |
| nested agent-base=9.0.0 | 当前https-proxy-agent9.1.0/package.json:28精确要求9.0.0；agent-base/dist/index.js:6已有具名Agent导出 | **保留@9组合做当前候选验证，不盲降@7**。#605的@7.1.4仅为历史组合，不能推广为所有https@9的规则；维护者需更新配方/证据说明 |
| 缺proxy-agent-negotiate1.1.0 | https package.json:29精确依赖、dist/index.js:8静态导入；当前和bak均缺；7级真实Node查找位置均无 | `/tmp/refmods/node_modules/proxy-agent-negotiate`有5文件可离线补入新candidate；rsync只读dry-run rc0，原始输出/5文件SHA见回执 |

静态依赖图：当前channel可达57包，唯一required missing为negotiate1.1.0；refmods可达56包、无required/optional missing。计数包含实际nested重复；这里只证明package元数据引用可定位，不代表导出/ABI/动态认证/启动通过。negotiate的kerberos是optional peer，真实Negotiate认证需按实际配置另验，不能把静态缺件补齐视为认证已通过。

历史`r2/input-validation.json:7-15`确实记录nested agent-base7.1.4通过，历史scratch的https9.1.0声明却仍要求9.0.0：两项事实均保留。**9.0.0当前值已证实，auto-correct实际命令/时间/rc来源未找到，过程=UNKNOWN**；不伪造其执行来源。

具体未来命令见回执“离线修复命令”。已实测补包rsync-n的文件计划，并对完整新candidate命令做`bash -n`，rc0；未执行clone、checkout或copy，未创建新candidate。SOP62的pnpm安装没有运行，包括所谓install dry-run也未运行。包管理器可重装性/离线缓存完备性仍未认证。

## 4. 执行器逐阶段缺口

下表均为静态代码结论；本轮没有执行任何阶段。SOP路径为 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/SOP-DEPLOY-MASTER.md`。

| canonical | 实际函数/行 | SOP依据 | 已有与缺口 |
|---|---|---|---|
| 00 | `stage_00_authority_mutex` 825–829；helper441–462 | 28、39–42 | 权威/期限/互斥已有；当前新窗口授权/锁归属UNKNOWN；不清锁 |
| 01 | `stage_01_integrity_clean` 830–842；463–496 | 28、58–66 | manifest/bundle/lock备份删除/clean已有；prod瘦身安装与完整nested恢复**未实现**；保护备份仍使clean失败 |
| 02 | `stage_02_fresh_read` 843；497–528 | 29 | source/harness/plist/env/PID/活状态分类已有；本轮不读生产，不继承历史通过 |
| 03 | `stage_03_dual_prerequisites` 844；540–563 | 29、53 | 校验历史r2/r3收据及scratch闭包；**未生成当前瘦身候选的双启动收据**；非缺函数 |
| 04 | `stage_04_quiet_gate` 845–857；564–578 | 29–30 | settle-at-quiet已在574；实际180s；依赖未钉哈希结算脚本，quiet不证明逐record退出，rc1也被重试 |
| 05 | `stage_05_old_exit` 858–870；579–601 | 31、39–40 | bootout/旧PID/worker/监督器/监听退出已有；before-stop实际180s |
| 05b | `stage_05b_settle_unresolved` 871–876 | 31、38–40 | **已存在并被调用**；dry-run漏报；结算权限scope未单列，逐记录证据不闭合 |
| 06 | `stage_06_full_preimage` 878；602–619 | 31、35 | ditto3600s/完整manifest/ACL/树外元数据已有；历史06实际FAIL；失败原因精确条目UNKNOWN |
| 07 | `stage_07_pinned_install` 879–908 | 32、42 | 历史bundle、三参数、双钉/payload及真实rc已有；不是直接调用39144或99cc |
| 08 | `stage_08_install_receipt` 909–915；637–676 | 32 | 本轮install坐标、reuse/§5b、closure日志/rc及config保留已有；本次未安装 |
| 09 | `stage_09_final_binding` 916；677–703 | 29、32 | **独立最终闭包绑定已存在**；不可跳过；当前瘦身闭包不能套历史收据 |
| 10 | `stage_10_plist_bootstrap` 917–922；704–718 | 32 | **bootstrap在10存在**，不是缺阶段；保留env，仅改deployedSHA |
| 11 | `stage_11_production_verify` 923；719–745 | 33 | exact PID/env/listener/log/public health已有；authenticated canonical health仍UNKNOWN |
| 12 | `stage_12_hr_watch` 924–937；746–763 | 33 | 完整600s及新HR broker execute判据已有；不等于业务成功 |
| 13 | `stage_13_close` 938；775–779 | 33、43–44 | 只释放自有mutex/写completion；R6命名集diff=∅及R7两代保留**缺失**，非换名存在 |

历史06事实纠正：可读顶层回执中，`run-20261102T123731Z.AClqMi`为BEGIN；`run-20261103T193519Z.fepWxL`及`run-20261103T220916Z.n2s9w7`为FAIL，没有06 PASS。后者`phase-events.jsonl:1-14`是00至05b PASS，15–16为06 BEGIN/FAIL；`window.log:26-29`为`full preimage copy differs`，31为`install_state=not_started`。不读取历史preimage子树或生产补证；可读记录缺失不推断全局不存在其它证据。

最后这次06从2026-11-03T22:13:24.085206Z到2026-11-04T02:10:50.961239Z，**3小时57分26.876秒后失败**。`ditto timeout=3600s`只约束复制命令，不约束前后inventory/xattr/ACL扫描的整阶段总时长。不能用源码249MB或SOP20–30min估计替代当前预镜像速度/可完成性证据。

## 5. 放行前条件与责任

当前证据不足以给CONDITIONAL-GO。以下是转为可重新裁决所需条件，并非本轮待执行命令；均未完成生产验收。

| 条件 | 执行主体 | 预计耗时 | 闭合证据 |
|---|---|---|---|
| C1 编号/入口文档对齐（15节点、09/10、dry-run漏05b） | 监管离线可做：本报告建议已完成；未来worker应用文档/代码差异 | 10–20min | 受审diff、准确阶段清单；不改旧回执 |
| C2 接受精确历史bundle或归并后的官方安装器，明确主仓归并认领 | 需Owner确定接受/授权；worker/maintainer归并；监管只读复核 | Owner等待UNKNOWN；工程30–90min | 精确commit、sh/lib/payload完整SHA manifest、三参/gate调用证据 |
| C3 净化候选而保留原lock和node_modules.bak，补全nested依赖闭包 | 需Owner授权新的候选面/重绑方式；worker离线装配；监管复核 | 20–45min（本地材料可用前提） | clean status、HEAD/TREE、精确package/静态导入闭包、保留备份证据 |
| C4 150/180阈值与04/05b结算规则/权限/终止证据闭合 | 需Owner裁明操作scope；worker依既有authority修复；不能用Owner口头同意改写长期业务语义 | 30–90min以上；授权/缺证等待UNKNOWN | exact record/epoch/child终止证据，非零/UNKNOWN拒绝；外部脚本SHA和权限；旧结果UNKNOWN保留 |
| C5 当前最终候选的fresh-child+完整runtime双启动并绑定同闭包 | worker在另行授权隔离面运行；监管只读复核 | 20–45min | 同app/harness/Node/config/权限面完整文件链接清单、两个收据及子进程完全退出；本轮NOT_RUN |
| C6 06预镜像失败精确差异定位与隔离验证 | worker；监管可先读已存差异证据，本轮不读生产/历史preimage子树 | 调查30–120min以上；实际复制验收时长UNKNOWN，最近一次约3h57后失败 | 从已有inventory/候选隔离副本定位条目；修正后证明完整复制/ACL/xattr，不能仅ditto rc0 |
| C7 13补R6命名集收账与R7保留策略 | worker离线实现/验证；实际删除需Owner的精确生产范围授权 | 20–45min；生产清理耗时UNKNOWN | 命名映射与diff=∅；最新两代/受保护代/精确待删集；不触bak或025材料 |
| C8 新窗口exact写者/时间/PID/env/锁/终止与回滚坐标、实际生产验收 | 需Owner及独占worker；监管只读核回执 | 前置15–30min；SOP窗口20–30min仅历史估计（含600s观察）；可能超时 | fresh authority/归属/termination、预镜像、生产PID/日志/health及600s HR；业务成功另有实证才可认定 |

这些工作部分可并行，不能把估计相加当作保证。阻断解除后须重新读取当时精确候选和授权坐标再裁决；本报告不预签GO。

## 6. 本轮边界

交付文件为新建的 `WINDOW-READINESS.md`、`RECEIPT-V5-PREP.md`、`STOPPED-V5-PREP.md`。未运行执行器、installer、结算、包管理安装或候选runtime；未调用launchd、生产服务/端口或写生产树；未实施任何SOP/源码修复或删除移动保护备份/025材料。Git dry-run临时锁可能性已单列，不能认证严格零元数据写入。原始diff、依赖命令及dry-run、输入前后指纹见回执。源码树元数据manifest只是有界未变更证据，不冒充全树字节哈希证明。
