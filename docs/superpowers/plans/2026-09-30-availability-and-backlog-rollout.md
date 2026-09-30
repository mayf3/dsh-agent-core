# 可用性部署重构与 backlog 分批上线实施计划

> **For agentic workers:** 使用已有 `supervising-local-coding-agents` 管理接管和证据；实施可使用 `superpowers:executing-plans`。默认单实现者按任务推进、一次受影响面复核，不要求新建固定多 Agent 编组。复用原 Goal/PR/分支；勾选必须绑定实际结果。

> **状态对账（2026-10-01，Product [#400](https://github.com/mayf3/dsh-agent-core/issues/400)）：** T0/T1 已由 PR [#374](https://github.com/mayf3/dsh-agent-core/pull/374) 执行（Product [#383](https://github.com/mayf3/dsh-agent-core/issues/383)，WAITING_OWNER；[#385](https://github.com/mayf3/dsh-agent-core/issues/385) 已关闭），T2 的 B→C→B 已非生产验证（[#393](https://github.com/mayf3/dsh-agent-core/issues/393)，CLOSED），T4 资格隔离 = PR [#392](https://github.com/mayf3/dsh-agent-core/pull/392)（[#389](https://github.com/mayf3/dsh-agent-core/issues/389)，待 Owner merge）。文末“交给本地 Agent 的第一轮边界（先只执行 T0 和 T1）”已被该执行消费，**不是现行指令**——不要按它另起第二个 T0/T1 writer。拉取与优先级权威 = Goal [#386](https://github.com/mayf3/dsh-agent-core/issues/386) / Program [#382](https://github.com/mayf3/dsh-agent-core/issues/382)；每次推进前 fresh-read 对应 Product Issue。基线 `51f47739` 是写就时快照，当前 main 已含 [#370](https://github.com/mayf3/dsh-agent-core/pull/370)（`360756e3`）。

**Goal:** 保住已恢复的用户服务，把现场修复变成可重建、可发布、可回退、可重复恢复的版本，同时逐批交付既有 backlog。

**Architecture:** 先完整制品和固定发布闭环，再补完整重置与候选隔离，最后按需要拆稳定接入与迁移状态存储。所有生产变更复用一个已登记的受控执行面；Workflow 业务状态仍由 svc-workflow 管理。

**Tech Stack:** 现有 JavaScript/Node 测试、Python DS/receipt 工具、Rust svc-workflow、TypeScript workflow-todo、PostgreSQL，以及后续独立评估的单机事务状态存储；不引入 Kubernetes。

**Spec/design:** [设计建议](../../reports/AVAILABILITY_DEPLOYMENT_ROADMAP_20260930.md)；[存量与波次](../../reports/DEPLOYMENT_BACKLOG_ROLLOUT_20260930.md)。设计建议不替代现有 governing Specs；T0 和既有合同内的工作先推进，新的持久/权限/生命周期语义在相应任务内处理最小有效决定，不作为其他任务前置。

## Global Constraints

- 基线 `mayf3/dsh-agent-core@51f477394fbab0234eae807bacd0f942ffdc22ed`；开工 fresh-read，不能直接部署旧 pin 或未经核对的最新 main。
- 用户已报告 HR 恢复；本计划不要求重新重置 HR，不触发原 UNKNOWN，不重放探测任务。
- ZCode 优先，模型 `account:bigmodel-individual-coding-plan/GLM-5.3-Flash`；coding 项目入口固定原 dsh-agent-core，隔离 worktree 内修改；本 PR 没有派发任务。
- 不恢复已停的旧 Codex Goal，不与正在写同一分支的作者并发写入；接管以真实任务/会话终态确认，不能仅看 PID。
- 不直接编辑生产 JSON/数据库，不使用签名私钥代替正常认证，不靠全量 root 或关闭安全检查造绿。
- 生产授权按已接受的 operation/profile 核对；本计划本身不授权 deploy/restart/sudo/新 grant/数据迁移。缺少某步生产许可不阻止已授权的隔离准备。
- 第一次生产发布前具备准确制品、回退与普通 Agent/HR 业务验证；不要求所有 T0–T7 全做完。
- 99%、60 秒、3 分钟均为设计中的拟议服务指标；单机故障限制和残余外部动作按设计明确记录。

## Review Focus

- 混装/缺依赖/owner 不同：T0/T1 在等价服务身份下验证实际制品，root 自检不算。
- 断连、权限到期、事务崩溃：T2 用同 intent 回读及预授权收尾；禁止重建请求绕预算。
- 新旧版状态互操作：T3/T6 测回退、部分写和历史 ID 重试，不回滚已完成业务数据。
- 私有 canary 误入普通流量：T4 覆盖缺字段、错身份、重启及候选卡住。
- 队列 ACK、重复投递与多个调度者：T5/T7 验证接收即持久、业务完成另报、单写者和范围去重。

## 执行节奏

```text
T0 → T1 → T2（最小固定发布闭环）→ W1 只读存量 → W2/W3 核心 Workflow
                    ↘ T3/T4（保持可用、分支隔离）
                        ↘ T5/T6（后续增强，不阻塞安全的现有发布）
T7（既有控制器/治理采用）可并行；不占用生产窗口。
```

每个任务结束只交付代码差异、命令与退出结果、准确候选、剩余相关问题。相同输入已有有效证据时引用，不重开完整审计。遇到真实安全/数据错误修对应失败测试；遇到无进展，不自动创建下一套平台。下面的新路径均为**拟新增路径**，不是已存在实现；如已有等价实现，扩展其测试与入口，不再并存第二套。

## T0 — 固定现网基线与逐 Goal 处置；这是第一项工作

**读入位置：**现有 app/Node/harness 的受控只读摘要；已登记服务配置元数据；原 `DEPLOYMENT_BACKLOG` 目录；本计划的 backlog 表；原 PR/交接。仅使用已有授权读面，不因无权读取而搜索秘密或扩大 root。

**产出：**沿原交接附一份非秘密 `baseline-inventory.json` 和一次源码回流 PR；当前服务不动。接口字段：`observedAt, service, sourceSha, artifactDigest, runtimeDigest, configRevision, executionIdentity, stateFormat, featureEvidence[], unresolvedDrift[]`。未知填明确 `unverified`，不生成虚假摘要。

- [ ] 核对同 Goal 实际作者和队列，记录唯一接手者；已有活跃作者则续接或安全交接，不新建竞争 writer。
- [ ] 按服务元数据/回执识别当前加载版本，不依赖 plist 的旧 SHA；只比对受影响发布根，禁止全机内容扫描。
- [ ] 给 backlog 每个业务 Goal 标记 `VERIFY_ONLY / INTEGRATE / INSTALL / ENABLE / IMPLEMENT / HISTORY_ONLY`，每项附依据；只查当前一批及直接依赖，不把全仓总普查作为前置。
- [ ] 将现网有而 main 无的受影响补丁回流隔离分支，核对来源和实际作用；无来源的差异只暂停覆盖它的发布，不停止无关工作。
- [ ] 确认普通 Agent 与 HR 的最近业务成功记录、当前配置/状态一致性读回可取得；本任务不制造新的业务探测 fence。
- [ ] 提交非秘密源码/说明；生产日志、凭据、真实消息、状态原件不入 Git。`git diff --check` 通过，工作区与候选绑定。

**Done:** 明确“当前什么在运行、下一包会改变什么、哪个 backlog 已经不必部署”；不能以“一份无法读取的报告”关闭 T0。

**失败出口：**权限不够或补丁不可归属时，只列一个确切缺口及影响的发布单元；继续可独立完成的离线构建/只读消费端任务，不无限等待同一证据。

## T1 — 干净构建的完整发布包

**Files:** 复用现有构建/部署配方；必要时新增 `scripts/lib/deployment-reuse/release-package.mjs` 与 `scripts/lib/deployment-reuse/test/release-package.test.mjs`；不修改特权执行器。复用 `scripts/lib/deployment-reuse/receipt.py`，先检查其本机路径/安装依赖，避免把机器专属测试冒充通用可复现。

**Interfaces:** 消费 T0 inventory 和固定 recipe；拟议离线函数 `buildRelease({sourceRoot, recipe, outputRoot}) -> {manifest, artifactDigest}`。路径只用于无生产凭据的构建环境，不传给 root 作为任意安装目标。manifest 绑定 recipe、toolchain、完整依赖、非秘密配置结构、兼容范围和覆盖的 Goal。

- [ ] 写失败测试：模块缺失、缺 package.json 的合法目录被漏装、Node/harness 被移走、同 SHA 不同制品、秘密文件混入；前四类拒绝发布、秘密必须不入包。
- [ ] 跑 `node --test scripts/lib/deployment-reuse/test/release-package.test.mjs`，记录实际 RED，不创建未执行的 PASS 表。
- [ ] 最小实现完整枚举/固定排除表/清单和校验；干净构建不依赖现网目录，复用依赖只能引用不可变受控版本。
- [ ] 候选包在独立工作区实际导入、启动，使用等价 uid/gid/mode/配置结构和测试凭据；没有同等身份条件就如实留该验证未完成，不拿 root 结果替代。
- [ ] 测试转 GREEN，提交；不得从安装后的现场目录反向拼一包未来源化的“正式 release”。

**Done:** 一个可重建、可验证的完整制品；候选构建失败时现网零变化。

## T2 — 现有 DS 的一次发布/回退垂直闭环

**Files:** 实际部署器源码位置由 T0 的已安装→仓库映射确定并写入当前任务，不猜测 `agent-deployd` 已是实际执行器；复用 `scripts/lib/deployment-reuse/{receipt.py,test_receipt.py,test_installed_reuse.py}`。必要时新增同目录 `test_release_recovery.py`，不新建 daemon 或队列。

**Interfaces:** 只使用已安装客户端真实支持的注册单元动作、operation/intent 和精确回执；`submit → status/receipt → finalize/rollback` 是流程描述，不是假定已有同名 CLI。T0 确定实际 action/参数与权限后写入原 runbook。

- [ ] 以隔离目标复现 B→C→B、客户端断连、执行器切换中崩溃、两 caller 并发、回执错配、过期新授权、磁盘不足、旧版继续服务。
- [ ] 消除成功条件只看 `/health` 的路径；检查实际加载制品和一条普通业务回复。模型整体故障与候选回归分开，避免反复升级/降级。
- [ ] 修同一执行器的精确事务查询、全事务锁及有界失败收尾；无特权合同变化的动作按既有 PDC 实现。若需增加动作或“授权到期仍可收尾”语义，只给这笔事务补对应范围，不扩大为全平台重建。
- [ ] 通过实际测试后封包，将当前可用版本保留为回退；旧版对升级后的状态兼容性必须在回退前证明。
- [ ] 已有授权覆盖时执行一个低风险注册服务的实际升级并验收；否则交一份 exact 版本/目标/影响/回退/操作者的待执行清单，同时继续隔离验证，不把排队当部署。

**Done:** 既有入口可连续发布两个不同版本并回退、断连可查同操作；不改业务专属安装器、不输入 sudo 密码；源码就绪与实机结果分别记。

**有限放行点:** T0/T1 和本任务的“拟部署路径”实际通过后，允许 W1/W2 用它上线；T3–T7 的长期增强不是普遍 gate。只读独立客户端若无需改生产，也不等待整个 T2。

## T3 — 同一 HR 可重复重置，不再手工修改账本

**Files:** `packages/product-api/src/agent-process-admin-routes.js`；`packages/agent-router/src/ingress-delivery.js`；`packages/agent-router/src/process-registry.js`；`packages/agent-router/src/reconciliation/{admin-abandonment.js,store.js,durable-file.js}`；已有管理入口和恢复测试。

**Interfaces:** 复用已合入 `abandonPendingTurns` 和既有可信管理员 POST；队列/会话释放使用当前状态机，不能建立第二套 Session 权威。新增字段或语义先处理直接受影响合同；已有 D6 不是本计划对未来操作的风险授权。

- [ ] 加“重置返回成功但仍 join 旧 handle”的失败用例；涵盖已排队未执行、当前可识别 worker、外部结果未知三种不同情况。
- [ ] 修复声明、队列占用、索引、审计与准入投影的一致更新，失败可重入；禁止 raw JSON 删除关联键或绕过 bounded collection。
- [ ] 验证未知历史不被伪造为已完成；不同 reset ID、相同 reset ID、部分写入、重启、迟到结果与后续新任务互不串流。
- [ ] 对 #371 的容量修订先做与 main/现网语义对照；未完成声明上限与完成声明去重历史分开，不能删除历史 ID 从而重放，也不能累计 33 次后永久失效。
- [ ] 运行 `node --test packages/agent-router/test/process-lifecycle/admin-abandonment.test.js packages/product-api/test/admin-turn-abandonment-api.test.js scripts/availability-recovery/recovery.acceptance.test.mjs`；原任务恢复期间不并行改主工作树。

**Done:** 正常入口的新任务真实开始/结束；管理员不必去数据库维护；关联普通 Agent 的业务回归通过。此处先修现有 store，不要求同时迁 SQLite。

## T4 — 私有资格测试与正式业务分离

**Files:** `packages/agent-router/src/process/{agent-process.js,turn-execution.js}`；`packages/agent-router/src/parent-rpc-relay.js`；`packages/production-runtime/src/native-arm64/hr-admin-canary-contract.mjs`；拟新增 `packages/agent-router/test/ordinary-admission-isolation.test.js`。

**Interfaces:** 默认普通 Agent 使用无资格绑定的正式通道；资格上下文只进入受控测试对象，不由普通输入获取。更换真实业务 Agent 作为 canary 的长久约束须明确迁移，不通过随意删判断实现。

- [ ] 加反例：`null/undefined/字段缺失` 的正常构造、显式私有对象、错 agentId/generation、混装/回滚后的构造、候选超时、授权到期。
- [ ] 最小修构造及入口，正常业务可用，私有 child 仍不能执行普通工具；缺配置不得隐式把整个 fleet 变 qualification-only。
- [ ] 把测试迁入独立身份/状态/工具策略；受影响部署事务在超时后有已授权收尾，不让用户业务等待测试者回来。
- [ ] 跑新回归及对应现有私有 canary 负例，证明不是删安全检查；源码提交，按 T2 发布。

**Done:** 停掉候选/部署控制者后，正式普通 Agent 仍能处理请求。只有代码 grep 不算验证。

## T5 — 稳定接入与 Runtime 有界切换（后续增强）

**Files:** 复用 `packages/product-api/src/index.js`、`packages/agent-router/src/ingress-delivery.js` 及既有消息存储/投递；拟新增的接入适配与测试归入这些 package，不创建独立业务后台。

**Interfaces:** 接入确认跟执行完成是不同状态；服务端生成/接受可信请求 ID，持久化后 ACK。唯一正式消费者，候选不消费生产。新持久消息协议须先取得对应决定，不改渠道/Session ownership。

- [ ] 写失败用例：ACK 后崩溃、断连重复提交、切换期间排队、旧新 Runtime 同时在线、投递回复失败；丢消息/双执行都应被测试抓住。
- [ ] 实现最小持久 inbox/outbox 或复用已有等价能力；旧 Runtime 不再领取后才让新版本接管，不把等待伪装成完成。
- [ ] 验证 Runtime 升级不丢已 ACK 请求；结果未知外部动作走查询，不盲重放。
- [ ] 单独发布和验收，不捆绑 T6 的存储迁移和所有 backlog。

**Done:** 短暂切换可见为排队，之后正常完成；不宣称上游不可用或主机离线时仍可运行。

## T6 — 事务状态与受限维修工具（后续增强）

**Files:** 现有 reconciliation 模块及其测试；拟新增 `packages/agent-router/src/reconciliation/transactional-backend.js` 和迁移测试。先评估已有数据库适配，避免再维护 JSON/SQLite/PG 三套长期并行模型。

**Interfaces:** 保持 store 对外语义，内部原子地更新记录/关联索引/会话占用/声明/审计；迁移工具不产生业务消息，最终只有一个状态权威。

- [ ] 写基于脱敏副本的验证：中断迁移、旧版读新状态、回滚再升级、重复 ID、无索引/错索引、超过限额、服务账户不可写、磁盘/fsync 错误。
- [ ] 先 expand 兼容读写，再转换，再收缩旧格式；未证明兼容前不切生产。备份用数据库支持的快照机制；不把旧数据库快照覆盖新业务记录。
- [ ] 用固定状态修复接口替代 raw JSON/root Python；精确 scope、并发版本检查、审计与服务身份读写验证。
- [ ] 认证回到正常签发；按本次实际修改范围收紧 scopes 与应急 sudo。无泄露证据不盲目轮换所有密钥。

**Done:** 重复任务恢复无需手改账本；恢复/备份实测；长期旧格式退出有明确消费者和条件。

## T7 — 现有控制器交付闭环与有限治理采用

**Files:** `mayf3/agent-control/controller.py`（核对实际装载源后修改原实现）及原测试；治理采用继续 dsh-agent-core [#364](https://github.com/mayf3/dsh-agent-core/pull/364)，不复制成新 PR。

**Interfaces:** 同一 Goal/intent 关联 start/status/continue/stop；accepted ACK、实际开始、结果完成分开；队列的失败状态不能被新标题重置。

- [ ] 测缺 queued label、issue 关闭但 turn 活跃、旧队列重新唤醒、两会话抢同工作树、相同 evidence 重复评审；未派发不能报运行。
- [ ] 最小修统一提交/状态回读/幂等接续；只按实际新输入触发复核，不把有真实新证据的修复机械禁掉。
- [ ] 接入 #364 的已有差异并验证本地入口不相互矛盾；不要由文档采用 claim 运行器去重已实现。
- [ ] 控制器离线时正式业务继续；监视器只读默认，业务探测专门隔离且有终态收尾。

**Done:** 原任务能实际接收与结束、已完成目标不自动再生；不增加第二套队列或监督服务。

## 交给本地 Agent 的第一轮边界

先只执行 **T0 和 T1**：取得有限稳定基线、处置已点名 backlog、产出完整可重建制品与失败回归。已有等价能力就 VERIFY_ONLY；不要一次开 T0–T7 七个 Goal。T2 需要的已安装执行器事实可只读并行确认，不提前生产切换。

随后优先推进 backlog 的 **W1（只读可见性）**。WEC 未安装时依原基础包先完成 W2；不要直接从 Owner Assistance 的 migration 0028 跳起。每批以原 Goal 的实际用户结果结案，具体顺序见 backlog 文件。

汇报：`STATE / candidate+changed files / commands+results / installed+enabled+accepted 分别状态 / next exact action / needs_user`。没有亲自运行的测试标为历史证据；不把新文档合并当重构完成。
