# Definition-first 无人值守改造：Core 本层接续计划

日期：2026-11-07。性质：Owner 请求的设计对齐/实施计划，非 governing Spec，implementation/production authority 由现有本仓规则决定。本 PR 只增加此文和 AGENTS 入口，不改变运行时、在线 Agent、权限或生产状态。

总设计与固定回归绑定 agent-control 文档提交 `782dc58fb87abe9ad394975df5a1e258b41eeb2d`：
- [总设计](https://github.com/mayf3/agent-control/blob/782dc58fb87abe9ad394975df5a1e258b41eeb2d/docs/design/definition-first-zero-ops/README.md)
- [实施切片](https://github.com/mayf3/agent-control/blob/782dc58fb87abe9ad394975df5a1e258b41eeb2d/docs/design/definition-first-zero-ops/IMPLEMENTATION.md)
- [Z01–Z22 回归](https://github.com/mayf3/agent-control/blob/782dc58fb87abe9ad394975df5a1e258b41eeb2d/docs/design/definition-first-zero-ops/REGRESSION.md)
- [本地交接](https://github.com/mayf3/agent-control/blob/782dc58fb87abe9ad394975df5a1e258b41eeb2d/docs/design/definition-first-zero-ops/HANDOFF.md)

agent-control 只是跨仓导航，不取得 Core 的产品权威。不要复制另一份全局规范。

## 1. 本仓职责与已读基线

读取源码基线：`55f442c74414dc723306a6d8e0cdba73d78eb8da`；不是指定部署目标。实施前只对受影响文件 fresh-read，查原作者/在途成果，遵守 `.agents/local/README.md`、当前 Product Architecture、有效 Decisions 与 accepted Specs。

Core 继续作为 DSH 的薄组织层：Agent/Session/Router/Workspace/Broker、原执行与调度恢复。Svc 是 Workflow 业务状态权威，Auth 是身份/授权权威；不重做 DSH Session/工具机制，不添加第二 Workflow engine、全局锁、ledger 或 CTO专属产品分支。Session隔离是任务上下文隔离，不凭此升级成对抗性安全域。

已有关联权威包括当前输入、WAE/WEC、Assignee Capability、Owner Obligation、Prerequisite、固定操作、开发执行与部署规则；按基线中实际生命周期查找，不根据编号较新自动采用。原 #1374 各子项、#637/#638 和业务接线成果继续复用。

## 2. 修改入口与验收

| 责任 | 现有入口 | 最小工作/验收 |
|---|---|---|
| 任务上下文 | `packages/production-runtime/src/workflow-execution-context-runtime.js`，原 Router/ingress/WAE 接线 | 服务核验的Instance/Visit/attempt绑定；模型坐标不能自证；重启/新任务不串历史 |
| 任务型聊天 | 原聊天派发、Workflow dispatch 与 Broker `gateway.js` | 优先通知现有受管任务；确需task-bound chat再做有限合同；普通聊天兼容性不等于事故路径已受保护 |
| 受管操作 | `packages/broker/src/capabilities/workflow/owner-obligation-guard.js` | 原角色、Case、合法子流程关系与CAS保留；不让Actor有A/B权限成为跨任务误写许可 |
| 输入恢复 | 当前task input/body完整读取与submission history | 执行所需精确材料/标准可得；截断、不可读、能力未部署明确区分 |
| 回执与进度 | `packages/workflow-execution/src/judgment.js`、原ledger/projection及命令回执读取 | 检查存在/归属/满足结果；同实例较新事件不等于完成审稿；迟到原回执仍有历史效力 |
| 持久恢复 | `engine.js`、`recovery/readback.js`、`readback-ledger.js`、`owner-assistance-resume-engine.js` | claim/发送/效果/回执各中断点恢复，UNKNOWN不重放，健康候选公平消费 |
| Owner接续 | `production-runtime/src/workflow/owner-assistance-review-wake.js`、`workflow-execution-runtime.js` | ACK与Owner已处理分离；子修复结束后回验原业务 |
| Scheduler | 原scheduler/startup/poll/self_ops | 定时触发是补漏/周期检查；不用每条WAIT另建shell cron；暂停/退役尊重用户决定 |
| 固定操作 | `packages/fixed-operation/src/registry.js`与实际生产owner-operation registry | 仅在有效合同内复用；fixture-only不等于通用代码节点上线；禁止任意shell/脚本路径参数 |

文件名按读取基线列出，实际旧安装的平铺布局不能被repo目录变化替代。每项标 source/installed/enabled/allowed/real-call/business，不靠main测试推断生产可用。

## 3. 角色复用与运行时装配

目标是同一审阅角色服务文章和PPT，而不是每个节点新建身份。当前节点应获得独立、可恢复的任务包：可信坐标、Definition/rubric、精确输入、所需Skill、工具许可和最新有效用户决定。优先复用现有Session/Turn；不在产品里按角色名硬编码路径。

必须的方法由当前Definition声明并确保加载，方法缺失保留修复责任；探索性Skill可按需选择。工具权限由Broker/Auth/任务实际关系执行，不由AGENTS或输入正文授予。AGENTS只留跨任务原则和能力边界，不能成为重试/状态/节点顺序的第二来源。

角色/Skill修改按原维护权限和版本化方法进行。任务材料是数据，不能带出新的权限或重写system指令。作者与独立reviewer维持原分离要求。角色共用不等于把所有业务塞进同一个无限主会话。

## 4. 硬校验、固定操作、LLM的边界

先用已存在提交校验表达产物和身份条件；确定性处理由注册操作和原执行器完成；Agent负责语义判断、假设与探测选择。必需步骤不能仅作为模型可选工具暴露后期待其记得调用。

现有 fixed-operation registry 的合同 hash 不覆盖 handler源码本身；执行器和构建版本应另绑定。I/O不是确定性函数，必须复用效果身份和持久结果。Svc不能被改成任意shell/网络/LLM执行器。

当前 `contextPayload` 具有managed INTAKE/合法gate限制，不是普通authoring的通用Context写许可。不要为交稿越过guard；先使用已合法的Submission/产物交付。若真实业务需要新能力，提交具体跨仓合同差量，而不是直接放宽现有路由。

## 5. 临时工具迁移与故障预算

Root的dispatch辅助器应保留合法发送/诊断/只读投影，而非继续扩大任意命令恢复状态机。迁移临时wait-sweep之前，保全每条责任、原操作和结果；未知执行先读回，不重置CONSUMING再试。原消费者确实承接后才能按有效变更许可停用临时触发。

RECHECK预算不冒充业务attempt预算；耗尽时保留已接受的Owner/后继路径，不清零STOP或换ID逃预算。超时/lease到期不证明终止；原worker及已下发工具的安全隔离条件沿原合同。单项失败不阻断健康后继。

同范围非生产修复可在原mandate内迭代，QA失败返回原作者而非每次要求Owner重新说“继续”。但不以自我修复名义删除有效测试、扩大权限、重放UNKNOWN或自行部署。

## 6. 固定回归与候选交付

优先映射原Z01–Z18到已有测试，补Z19角色切换、Z20注册操作边界、Z21受控改进、Z22组合版本。重点：

- 真实聊天→runtime→Broker写路径，测试actor对两实例都有权限但任务只绑定一项；不伪造provenance。
- 外实例回执实际送入归并函数；新attempt存在后实际提交旧结果，不只比较fixture。
- 真实持久存储中断/重启，服务返回503后恢复；Owner已收消息但未做工作仍未完成。
- 一个项目执行超时，后项仍可消费；原UNKNOWN查回同一effect，不产生第二业务写。
- 正确普通聊天/受管子流程及合法source→target关系仍可用。
- 同角色文章/PPT交错运行，不串rubric/输入/状态；实际读取正文完整性与工具调用可审计。

测试层次和允许替身见总回归文。保留真实Router/Scheduler #637/#638反例。现有npm glob可能漏深层文件，扩展原测试入口的明确suite清单，不新增生产调度器。

独立结论绑定候选+Svc配对+Definition/角色/Skill+相关任务配置；测试通过、源码合并、安装启用、业务验收分别记录。新差量不自动纳入历史窄发布窗口，不要求小修复等待通用新平台。

## 7. 本PR与后续实施的完成界限

本PR只把上述设计接线和交接落仓库，未执行产品测试、未改生产代码、未更新运行中AGENTS/调度任务。原本已接受合同内的修复可由原实施者沿有效mandate继续；新增长期协议按本仓PREFLIGHT，必要时与Svc配对，不能将本计划当作接受记录。

下一次实施回报：最小切片的精确diff、同一原反例RED→GREEN、独立受影响范围QA、原责任如何继续，以及一个真实业务结果或明确的外部条件。不要只交更多接线图、文档或“已摄入”。
