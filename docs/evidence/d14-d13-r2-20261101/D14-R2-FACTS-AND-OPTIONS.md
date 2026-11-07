# D14 r2 版本事实与待裁定方向

观察时间：2026-11-01（精确UTC在各JSON）；调查不改产品代码、不写生产、不部署、不重启。下文是非权威事实和建议，不执行方向裁定。

## 1. expected 的真实读取链

安装源码坐标 `/usr/local/libexec/agent-core/app/`：

- `packages/agent-provisioning/src/shared-codex.js:236-244` 的 `CHATGPT_SUBSCRIPTION_V1.pluginVersion` 是 **0.2.3**，并绑定 sourceCommit `75d98d5b10bb926d53108e49019668c1bde2a9eb`、archive SHA `2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0`、Harness `0.1.0-rc.8@514ab7b0029141b88c807704764d0d3e1eea1da4`。
- `packages/production-runtime/src/model-overrides.js:197` 将 catalog route 的 `route.pluginVersion` 交给 `subscriptionProcessConfigBlock`，`:224` 保存为 `processConfig.subscription.pluginVersion`；默认路径 `:251-253` 从上述常量取值；catalog校验 `:319-346` 仅接受 legacy0.2.3或独立GPT6 tuple0.2.3-dshr1。
- `packages/agent-router/src/process-registry.js:330-332` 的 `provisionHome(... subscription:processConfig.subscription)` 保留该值（存证含安装文件实际行与哈希）。`packages/agent-provisioning/src/index.js:398` 将 `subscription.pluginVersion` 转成 requirement `version`。
- 同文件 `:206-211` 定位 `<home>/profiles/node_modules/<plugin>/package.json`，通过 `plugin-artifact.js:13-15` 的 `JSON.parse(...).version` 得出 **resolved**；existingVersion与requirement.version不同即抛 `plugin_version_mismatch`。不是 deployment SHA 判等，也不是读取0.3.2 package后自动推导期望。
- `/Users/authsvc/.agent-core/agent-model-overrides.json` 普通读取为EACCES13，未扩大sudo；**精确live catalog字段值与当前进程加载字节身份仍UNKNOWN**。安装源文件的读取链、哈希已保存；不能将磁盘文件等同于process-loaded proof。
- 只读日志 `/Users/authsvc/.agent-core/logs/runtime.err.log:99985-99988` 有同次QA admission的具名route失败及明确 expected0.2.3/resolved0.3.2；`:100505-100508` 再现。具名route记录时间分别为 `2026-10-31T12:40:03.536Z` 和 `2026-10-31T23:22:08.539Z`；version-error行本身无时间字段，二者按相邻同次admission关联，不冒称error自带精确时间。其余三家当前解析版本有据，但本文件未观察到同类具名version-error，不伪造四家相同历史日志。

`expected-version-chain.json` 保存安装源文件精确片段与SHA；`runtime-log-signature.json` 保存限定grep命令、返回码、行号与脱敏事件。

## 2. 四家home实际来自同一generation

共同链路：

`<home>/profiles/node_modules/dsh-codex` → `/Users/authsvc/.agent-core/control/codex-plugin-runtime/current/dsh-codex` → `/Users/authsvc/.agent-core/control/codex-plugin-runtime/gen-032-20261031-123906/node_modules/dsh-codex`。

| Agent | home | home link mtime UTC |
|---|---|---|
| QA | `/Users/authsvc/.agent-core/homes/agt_qa-reviewer` | 2026-10-28T15:17:59.935990+00:00 |
| 家庭管家 | `/Users/authsvc/.agent-core/homes/agt_family-steward-agent` | 2026-10-28T15:07:52.485010+00:00 |
| 文风分析师 | `/Users/authsvc/.agent-core/homes/agt_writing-style-analyst-agent` | 2026-10-28T15:13:57.422457+00:00 |
| 购物清单管家 | `/Users/authsvc/.agent-core/homes/agt_shopping-list-agent` | 2026-10-28T14:59:40.077865+00:00 |

四个link均uid0。`current` link mtime为 **2026-10-31T12:39:32.765210Z**。四家最终 `package.json:4` 都是version **0.3.2**，共同package SHA `f9a6ea3e647901ea1f6b218bc27aa2e3cd9ff9a9579b9036489a12354363f5bc`。

该generation的 `build-provenance/build-inputs.json:6-15` 明确源为 `mayf3/dsh-codex main@7cfa139e111956a7193622afc734126b52d7bf07`，tree `5f144d38a10eb40ce5cf33c597a72a81bd21e537`，真实版本0.3.2。`runtime-closure-manifest.json` 绑定相同sourceCommit，dependency treeDigest `119f74e67b61a1ecace6219ebcf7f2df8874ce71d27cc2170d8e91667d1990b0`，14,224 dependency files。

已提升 `/usr/local/share/agent-core/artifacts/dsh-codex-0.3.2-release.tgz` 实测SHA **8755ae67673ddc08ba7511a8b11582151763972cb5c00e733f4e94f87717daf2**；source-stamp.json同digest、同sourceCommit。对该tgz的14,299个regular-file逐一比较generation文件字节，**mismatch=[]**。这不检查额外安装文件或权限，不冒称完整运行时验收。详情见`version-facts.json`；发布的home枚举仅保留四家和聚合计数，见`home-census-summary.json`。

## 3. “118家0.2.5-r3”与0.3.2的关系

不是证据支持的“四家独立升级到另一条0.3.2”。观察到的是更广的共享current解析：对所有现存可读 `homes/agt_*/profiles/node_modules/dsh-codex` 枚举，共123个包；**117个0.3.2，且117个均指向上述current；另6个0.2.3**。这是磁盘home包清单，**不等于注册舰队数、118家验收或运行进程已加载版本**。

`/tmp/025-r3-staging/BUILD-BASIS-CLARIFICATION.md:3-9` 明确“正常合并和构建”取当时main，真实版本0.3.2、禁止重标0.2.5。`/tmp/025-r3-staging/BUILD-RECEIPT.json` 的source、artifacts与生产generation provenance/已提升archive哈希相同。因此 **r3暂存任务名称不代表包版本0.2.5-r3；当前证据里的r3构建实际就是0.3.2主线产物**。较早原生0.2.5和0.2.5-r2是另外的实际构建，不能把它们与本次r3混称。

安装 `/usr/local/libexec/agent-core/scripts/artifacts-watchdog.sh:11-17` 会把homes下任何真实dsh-codex目录搬为backup并改为共享current link；`/Library/LaunchDaemons/ai.agent-core-artifacts-watchdog.plist:11` 配置每120秒。它会覆盖“只重装四家真实目录”的方案。脚本和配置证明可达机制，不证明特定历史writer PID或当前daemon正在运行。**118家历史滚动的精确收据、精确切换操作者/授权、4家为何当时最先触发重建，仍UNKNOWN**；本轮不扩权读保护日志/控制ledger。

## 4. 给监管的两案（均含生产写入，均未执行）

| 方案 | 必需动作 | 影响面/风险 | 本轮状态 |
|---|---|---|---|
| A 升级runtime期望 | 先接受新的精确兼容tuple与本库固定pin语义的authority变更；绑定真实0.3.2 source/digest/Harness与共享auth保护；验证依赖身份、模型/凭证路径和fail-loud负例；再以独立受控mandate更新runtime与配置并受控重启/验收 | 触及全局admission、固定兼容线、共享auth与新DSH依赖；不是只改expected字符串。若共享current保留，117个现存consumer均在潜在影响面 | 方向待监管；无改pin/配置化实现 |
| B 对受影响home回到现行accepted精确版本 | 先证明选定domain artifact符合现行0.2.3完整tuple，且保留外部accepted R1/R2/R3全部共享认证保护、可兼容读取当前credential文档/pending intent/Owner recovery；这两项当前未证，B readiness=NO；冻结current和home链接preimage、active writer及旧worker/工具副作用边界；采用监管批准的四家immutable精确generation链接作为有界canary，或经扩大mandate统一收敛current；处置watchdog的覆盖责任；逐home只读readback与授权新请求验收，保留回滚 | 四家精确link canary可限定四家，但不会消除其他113个current consumer的同类潜在错配；修改共享current将影响117个home。真实目录重装会被watchdog再次改链。既有旧execution UNKNOWN与fence不能因包回退自动清除 | 方向待监管；无home/current写入 |

**方向建议（补查外部accepted保护契约后收紧）：当前A、B均未达到可执行裁定前提，方向依赖的版本变更保持STOPPED。** B仅作为有条件的最小四家canary备选：须先证明具体0.2.3 artifact保留R1/R2/R3全部保护和当前credential/intent/Owner recovery兼容，不能只凭version等于0.2.3就降级；这两项当前UNKNOWN，故不推荐直接回滚。若该完整证据成立，再由监管选择B及四家canary，并登记117个共享consumer整体收敛事项。若目标是0.3.2，则A须独立闭合Core固定pin权威及完整互操作证据。不要将“回正确版本”写成0.2.5-r3。两案都要求生产写入；当前只交事实和方案，不执行。

### 外部保护契约与本库pin的同时约束

已只读复核构建receipt指定的 `/tmp/025-r3-staging/source/docs/specs/DSH_CODEX_SHARED_AUTH_PROTECTION_RESTORE_V1.md`，实测SHA **26e9d3c645f24eec02d6035f744a5083a2cdb94f2a1db1f917d7b5796afe1df5** 与receipt吻合。frontmatter为accepted、implementation_authority=contracts、production_apply_authority=none；`:24-28`、`:60-65`、`:172` 明确三组保护（canonical配置/身份/权限、cross-process lock+durable refresh intent、unknown outcome fail-closed+explicit Owner recovery）仍REQUIRED，无一obsolete。`:161-167` 明确任何未来adoption须另证reader/rollback兼容与Owner apply，且不修改Core V3的0.2.3 pin、不建立full V3互操作或生产admission。

该外部Spec没有“按版本号一概禁止回0.2.3”的条款，且`:30-35`、`:172`把donor75d98d5的0.2.3认作保护来源、将原生0.2.5列为rejected。因此不能把所有0.2.3说成缺保护，也不能把任意0.2.3说成等价当前已恢复的全部保护。当前可读旧archive只核了hash/version，具体保护等价、当前数据/intent回读与安全回滚均UNKNOWN；未读credential正文。

这不是外部新release自动supersede本库pin。两个authority同时要求保护与合法互操作，当前generation0.3.2和Core0.2.3 admission之间有待闭合的adoption/兼容缺口。本轮不得以移除保护换取pin相等，也不得以保护修复成功默许新版本admission。最小闭合：监管绑定精确候选/源/哈希、证明R1/R2/R3不退化及reader/rollback兼容，再裁定四家精确恢复或另行更新Core兼容权威。详见`rollback-protection-constraints.json`与复制的外部Spec。

无需为了当前事实做代码改造。把expected改成“跟随当前注册包清单”会让观测状态替代现行固定pin契约，可能默许本次0.3.2漂移；不是in-contract bugfix。现行`AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` CTR-SCA-004（:636-650）和CTR-SCA-013（:812-835）保留0.2.3/fail-loud，方向变更需监管及对应authority，不能自行配置化绕过。故本轮D14源码delta=∅，RED→GREEN=NOT_APPLICABLE，版本对齐生产修复=NOT_EXECUTED。
