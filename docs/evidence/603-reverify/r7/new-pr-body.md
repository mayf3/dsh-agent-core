**supersedes #603 integration**。旧 #603 的 head `ac-ctr-s4-runtime-prep@815ac7c94b1775eec3aa57f19ca8a3842f592217` 含已失效的 termination-only→failed D-009 增补。整合已在包含 accepted V3 及 #645 verifier 的 main 基线 `1ff1e81cbd74a51761dab46a5fcee532c41fe4ed` 上重新实现与验证；本 PR 以 `ac-ctr-s4-reverify` 对 `main` 提供实际整合 diff。按 R7 续行的 R6 B 方案替代旧整合交付，不向旧 head 合并或强推。新 PR 保持 OPEN，不合并；独立产品审查由监管另派。

改动补齐默认 OFF 的 CTR-S4 runtime 生命周期：停止后拒绝 tick，排空已准入的 mutation/receipt，动态 OFF 在锁内复验，单 in-flight，随后 dispose Router；installer 只加入 V3 允许的精确 whitelist token。缺证据读取使用纯读 `_readDocRaw()`，V1/V2 返回 UNKNOWN，不做格式迁移或归一化落盘。复用 main 唯一 Scheduler policy/writer，termination-only 保持 `outcome_unknown` 并追加 `terminationSettlement`，缺可信证明零 authoritative 写入；无 retry/replay。

阶段 A 已逐个审阅全部 **18 commits**，详见 [完整评估](https://github.com/mayf3/dsh-agent-core/blob/ac-ctr-s4-reverify/ASSESSMENT-603-REVERIFY.md)：

| 分类 | 数量 | 整合处置 |
|---|---:|---|
| a 仍相关 | 1 | `67d2bb08` 精确 installer whitelist，1315 行和可见 debt 保留 |
| b 已取代、抵消或历史保留 | 12 | 排除 `5049c6cd` 死 D-009 增补、已覆盖/净零改动、旧日志/PASS/decoder pin/registry/packet；历史 Git 对象保留 |
| c 需适配 | 5 | `8dfd2854` 仅生命周期部分迁移到当前 helper；另 4 项 native env/history env/retry/diagnostics 为范围外 carryover，未整合、不声称 main 已覆盖 |

八门与证据（R4 实测，本轮 docs-only 不冒称重跑）：

| 门 | 结果 | 原始坐标，均位于 docs/evidence/603-reverify/ |
|---|---|---|
| 1 结构 V3 | 正式 source HEAD rc0；0 新违规、28 既有债；installer exact exception 保留 | `r4/structure-final-source.command.json`、stdout/stderr |
| 2 变化/接线/installer、零写负测 | 40/40 rc0，原 13 项代理拒绝全 PASS；installer syntax/blob rc0。V2 缺证据前后 SHA256 相同，mutations=0、upgrades=0 | `r4/changed-runtime.*`（stdout:90–91）、`installer-syntax.*`、`installer-binding.*`；`r2/independent-source-review.md` |
| 3 Scheduler | 480/480 rc0 | `r4/scheduler.*` |
| 4 Scheduler-Router | 40/40 rc0 | `r4/scheduler-router.*` |
| 5 EKR/B2 | 93+31+147+12=283/283 rc0；双 EKR SHA 绑定验证 snapshot | `r4/ekr-observation-cas.*`、`ekr-broker.*`、`ekr-workflow.*`、`ekr-runtime.*` |
| 6 D-009/源码独审 | PASS、0 blocker；termination-only UNKNOWN+terminationSettlement；无证明零写、aggregate fence 保留 | `r4/independent-d009-review.md`、`independent-gate-review.md`、`independent-source-final-head-review.md` |
| 7 静态/绑定/原文打包 | JS/governance/source binding rc0。R4/R6 cached rc2 与 R5 精确豁免 rc0 原样保留。R7 监管裁定 603-R7-RAW-CLASS-001：verbatim docs/evidence/**/*.diff/.stderr/.stdout/.log 按类排除，编成件全检；R7 打包 rc0、独立 docs delta PASS | `r4/*syntax*`、`governance.*`、`*source-binding.*`；`r7/environment-recipe.json`、`prepublication-cached-check.command.json`、`independent-prepublication-review.md` |
| 8 发布/PR 生命周期 | source `87735ecee0e0ebfaa575f889785d7c5037ab9145` 及 docs 已发布到整合分支；本 PR 承载替代整合，#603 的评论/关闭和最终读回记入 R7 收据 | `r7/` 操作回执；[根收据](https://github.com/mayf3/dsh-agent-core/blob/ac-ctr-s4-reverify/RECEIPT-603-REVERIFY.md) |

动态合计 **843/843 rc0**（40+480+40+283），全部 fail/cancelled/skipped/todo=0。V2 零写负测前后 SHA256 均为 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`。

九键处置：仅测试/静态门子进程显式清除 `HTTP_PROXY`、`HTTPS_PROXY`、`http_proxy`、`https_proxy`、`ALL_PROXY`、`all_proxy`、`NO_PROXY`、`no_proxy`、`NODE_USE_ENV_PROXY`；实测均不存在，使用既有 Node v25.6.1，不改主机环境、依赖或 guard。完整 argv、UTC、真实 rc 和 SHA256 见各 `.command.json`；Git 网络操作使用继承网络环境，Secret 值不记录。R2/R3 原拒绝与 R4/R5 失败原文均保留。

精确坐标：implementation=`87735ecee0e0ebfaa575f889785d7c5037ab9145`；base=`1ff1e81cbd74a51761dab46a5fcee532c41fe4ed`；verification snapshot=`0f25ce5270c0964476184af509c5857acbdf1527`，产品/测试字节与 source 相同。R5 package=`f1b1466b2645ec861c80bcb934db410ff544e6ca`；后续 R6/R7 docs 仅补授权、通用打包配方与 PR 交付证据。

main 前移至 `bc69bff131c50af7357d39045b6d3084e5fd6fca` 的相关影响已有独立静态审查 0 blocker，merge-tree 文本兼容 rc0；**未执行 `bc69bff1+603` 合并树动态门**，843 PASS 仅绑定上述原 base/source 元组。四项范围外功能、28 项结构债未闭合；零生产写入，未运行 installer、部署、启用或 UNKNOWN 重放。源码/本地机制验证不等于生产或业务验收。

评估与完整收据：[ASSESSMENT-603-REVERIFY.md](https://github.com/mayf3/dsh-agent-core/blob/ac-ctr-s4-reverify/ASSESSMENT-603-REVERIFY.md)、[RECEIPT-603-REVERIFY.md](https://github.com/mayf3/dsh-agent-core/blob/ac-ctr-s4-reverify/RECEIPT-603-REVERIFY.md)、[R7 授权](https://github.com/mayf3/dsh-agent-core/blob/ac-ctr-s4-reverify/BRIEF-603-REVERIFY.md)、[R7 原始操作回执](https://github.com/mayf3/dsh-agent-core/tree/ac-ctr-s4-reverify/docs/evidence/603-reverify/r7)。

R7 全仓后续交付通用裁定：`git diff --cached --check -- .` 加 `:(exclude)docs/evidence/**/*.diff`、`:(exclude)docs/evidence/**/*.stderr`、`:(exclude)docs/evidence/**/*.stdout`、`:(exclude)docs/evidence/**/*.log`。只适用于 verbatim 机器捕获件；字节保真优先，收据/Markdown/JSON/MJS/脚本仍全检。收据与阶段 A 台账环境配方均已记录；原始捕获件未修剪。
