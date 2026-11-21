# D14 + D13 r2：事实、方向建议与修复门槛

本轮没有产品源码改动，没有部署、重启、home/current 写入或权限变更。D14 对齐方向留给监管；D13 的生产日志未能证明 r1 的维护后 async-context 丢失链路，依本轮用户“吻合才修”条件，相关实现 **STOPPED**。这不是故障修复完成或运行验收。

## 坐标、授权和权威

- 调查与命名集复核：`/tmp/proddsh-d14-fix`，`ac-D14D13-spawn-proof@1921f8795e2212506a7a833bc79b84c17ba50ea1`；r1 证据 `/tmp/proddsh-d14d13-evidence-20261101/` 原样保留。r2 原始投影 `/tmp/proddsh-d14d13-r2-evidence-20261101/`。
- 用户 2026-11-01 r2 任务授权：指定日志 `sudo -n cat/grep/tail` 只读；版本事实只读；隔离实现仅在确认门槛后；commit、push、开 PR；禁止生产写入、部署、重启及共享 checkout 任何写入。
- 本 worktree 原 `.git` 指向禁写 checkout 内的 metadata。开始写工作前已替换为 worktree 内独立 `.git-r2-isolated`，后续 fetch/commit/push 全部使用此副本；依赖也复制到本 worktree，环依赖只连回本地，未使用共享 node_modules 别名。原 metadata 未用于 commit/push。
- Fresh integration base：`main@3a1282b35e7b852f51cd14284ea91fd77a13543e`。原交接 HEAD 与其分叉，含 8 条 main 未含提交、7 文件既有差异；本轮发布另建 main 后代分支，只携带报告/证据，保留原调查分支，不夹带这些差异。
- PREFLIGHT：事实/文档范围 `REUSE + BRIEF`；身份与生命周期相关实现需 `CONTROLLED`，本轮操作权限 `NO`，D14/D13 产品实现均未越过门槛。执行授权与停止条件见 [preflight-r2.json](../evidence/d14-d13-r2-20261101/preflight-r2.json)。
- 当前 main 的 accepted 权威：`AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` CTR-SCA-004/013；`AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1` CTR-G6R-001/002 保留 legacy0.2.3、另允独立 dormant0.2.3-dshr1 tuple；Messaging V2 r5 CTR-ASM2-002/004 保留真实进程与 exact-source proof；Lifecycle **V4** C-001/C-005 保留绝对 deadline。r1 的 V3 引用不能当作当前版本；V3 已 superseded。没有 Spec 语义更改。

## D14：共享 generation 与版本标签漂移

安装源码逐字段读取链：`route.pluginVersion → processConfig.subscription.pluginVersion → requirement.version`；`provisionExactProfilePlugin` 从 `<home>/profiles/node_modules/dsh-codex/package.json.version` 得到 resolved 并精确比较。默认 tuple 为0.2.3。QA 只读日志两次明确 `expected dsh-codex@0.2.3, resolved 0.3.2`。live catalog 读取 EACCES、process-loaded bytes 未独立绑定，均保留 UNKNOWN，不把磁盘源码当运行证明。

四家 home 当前均经 root-owned link 解析到 `control/codex-plugin-runtime/current → gen-032-20261031-123906/node_modules` 的0.3.2；该代 provenance 为 `mayf3/dsh-codex main@7cfa139e111956a7193622afc734126b52d7bf07`。已提升 archive SHA-256 `8755ae67673ddc08ba7511a8b11582151763972cb5c00e733f4e94f87717daf2`，与 generation 的14,299个 archive regular-file字节逐一一致（不覆盖额外文件、权限或运行验收）。

`/tmp/025-r3-staging/BUILD-BASIS-CLARIFICATION.md` 和 `BUILD-RECEIPT.json` 明确 r3 暂存构建的真实版本就是0.3.2，禁止重标0.2.5。全量可读磁盘 home 枚举123个包，117个0.3.2共享上述 current，6个0.2.3；不能将它们等同注册舰队118家或118家运行验收。118家历史滚动精确收据、current 切换操作者及授权、其他三家的历史拒绝仍 UNKNOWN。

| 待裁定方向 | 必需动作与影响 |
|---|---|
| 升级 runtime 期望 | 先完成新的精确0.3.2完整 tuple、Harness/共享认证兼容及本库固定pin权威变更，再独立受控更新/验收；不能只改expected字符串或跟随磁盘包自授权。共享current的117个现存consumer均在潜在影响面。 |
| 四家 home 回到现行 accepted tuple | 先验证具体0.2.3 artifact的完整身份、R1/R2/R3全部共享认证保护及当前credential文档/pending intent/Owner recovery读回与回滚兼容，再冻结preimage和active writer，监管批准后才可四家immutable-generation链接canary；这些兼容证据当前UNKNOWN，readiness=NO。若改共享current则扩至117个home。watchdog会把真实目录重新改链，必须纳入操作方案。不得因包回退清除既有UNKNOWN或fence。 |

**建议供监管裁定：当前两案均未满足执行前提；第二案仅作有条件的最小四家canary备选，不推荐直接降级。** 外部accepted保护Spec仍要求R1/R2/R3全部保护，并明确不修改Core的0.2.3 pin、不授予生产adoption；不能以版本相等代替保护与数据兼容，也不能以新版本已恢复保护代替Core admission权威。若第二案兼容证据成立，再由监管选择四家canary并登记其余共享consumer；若选第一案，则先闭合新tuple权威与互操作证据。详见 [保护/回滚约束](../evidence/d14-d13-r2-20261101/rollback-protection-constraints.json)。两案都需生产写入，本轮均未执行；当前不需要代码改造，D14 RED→GREEN 为 NOT_APPLICABLE。

完整文件:行、home/清单路径、哈希及两案步骤见 [D14 事实与方案](../evidence/d14-d13-r2-20261101/D14-R2-FACTS-AND-OPTIONS.md)。

## D13：拒绝属实，生产机制关联仍 UNKNOWN

HR main `session.jsonl:778` 首次拒绝发生于 `2026-10-21T14:38:15.814Z`，对应 `:718` turn/start 后 **16.121秒**；`:799` completed，整轮22.034秒。实际直接 `agent_session_send` 拒绝仅两次（`:778/:780`，对应真实调用`:777/:779`），均在turn7，延迟16.121/16.170秒。源码也没有 proof TTL，不能按“长轮过期”进行续期修复。

首次 compaction/start 在 `:2704`，晚于首拒；但 compaction 不代表全部 maintenance，缺少事件不能排除 maintenance。获准日志没有把同一进程/代际的 maintenance、prompt messageId/native turn、Router execution handle 和 RPC carrier/parent map 状态关联起来。**SIGNATURE_MATCH=UNKNOWN，既未确认也未排除 r1 async-context 机制；IMPLEMENTATION=STOPPED。** 不假定另一根因，不延长硬 deadline。

最小后续证据是上述 exact generation/turn/handle 的关联读回。若监管补齐并确认吻合，再实现私有 real-message/native-turn/tool-call 到 Router handle 的因果载体；不采用 session 最新handle回退，也不单独按可跨轮复用的 signal 绑定。保留父进程 map 的 generation/unsettled 校验。必要 fixtures：maintenance排队后长轮尾部发送、短轮不变、未验证轮拒、迟到A不借B、跨turn/session同callId隔离、原生子agent可信继承、settled拒绝和hard deadline不变。该设计未实现，不能标GREEN。

精确来源路径、日志哈希、时间线和缺口见 [D13 核对报告](../evidence/d14-d13-r2-20261101/D13_SIGNATURE_READBACK.md) 与 [去重时间线](../evidence/d14-d13-r2-20261101/denial-timeline.json)。完整对话未入Git。

## 验证与交付状态

- 隔离依赖下对原调查 HEAD `1921f879` 重跑r1同一123文件命令：938 tests，867 passed、62 failed、9 skipped、exit1。使用r1已留失败名清单，新增失败名=0、移除失败名=0、全部命名状态diff=[]；未修复或排除既有失败。不是GREEN。命令、结果、基线失败清单与双边938项投影见 [comparison-result.json](../evidence/d14-d13-r2-20261101/comparison-result.json)、[named-results.json](../evidence/d14-d13-r2-20261101/named-results.json)。这不是对当前main另跑的测试，也不是产品修复回归。
- 共享checkout收工 `ls -la` 与开工字节一致；30条全树symlink的路径、目标、inode、mtimeNs完全一致，双边SHA-256均为 `4346ef42597f0209f06a7c7280751dcebdb333b0d3adfdb91c8fac7eb468adaf`。原worktree index自隔离前检查后stat未变。见 [shared-links-comparison.json](../evidence/d14-d13-r2-20261101/shared-links-comparison.json)。这些快照证明所检查边界，不冒称全盘所有普通文件的全时写入审计。
- 独立首轮审查 `REVISE`，冻结阻塞 `D13-EVD-001`：最初的字符串命中投影错误地把论坛/grep/read/调度提示中的引用计为新拒绝。该统计被撤回，改按真实tool/call name与callId关联，排除15条引用命中；不能保留17/11/7轮的错误结论。更正投影通过6个真假fixture（1真、5假）及真实投影/时间线断言，见 [projector-verification.json](../evidence/d14-d13-r2-20261101/projector-verification.json)。这是证据分类验证，不是D13产品修复GREEN。首轮记录见 [independent-review-r1.json](../evidence/d14-d13-r2-20261101/independent-review-r1.json)；最终commit的限定delta复核绑定在PR正文。

产品源码delta为空，D14/D13运行修复未执行，D13 GREEN未取得。本轮交付为方向裁定事实与停止门槛，整体故障修复仍未完成。
