# STOPPED-SRA-V1

STATUS = STOPPED_GIT_REMOTE_READ_FAILURE

本记录执行 BRIEF-SRA-V1-DRAFT 的直接停止条件：“失败即停写 STOPPED-SRA-V1.md”。停止原因是实际 Git 远端读取错误，不是新增 Owner 决策缺口；不标记为 WAITING_OWNER，不把本记录当成任何发布授权。

## 实际失败与停止边界

- 命令：`git ls-remote https://github.com/mayf3/dsh-agent-core.git refs/heads/main refs/heads/docs/standing-release-auth-v1`。
- 实际退出码：`128`；执行会话 `1047`。
- 停止日期：2026-11-07（Asia/Shanghai）；本轮只读来源取证时间坐标含 `2026-11-07T06:47:34.306075+00:00`。该时间不是失败命令的精确完成时间，后者未记录，不编造。
- 原始错误：

```text
error: RPC failed; curl 18 transfer closed with outstanding read data remaining
error: 19 bytes of body are still expected
fatal: expected flush after ref listing
```

失败前同轮独立命令 `gh api repos/mayf3/dsh-agent-core/git/ref/heads/main --jq '.object.sha'` 实际 rc=0，返回 `f6e332d7568b01c5253618449bfef5839102c851`。这证明该次 API 观察的 main 坐标；它不把原生 Git 失败改写为 PASS，也不证明 push 可用。本轮不重试失败命令、不 push、不创建 PR。

## 工作面与实际变更

| 项 | 实际坐标或结果 |
|---|---|
| 仓库 | `mayf3/dsh-agent-core`；base=`main` |
| 原检出 | `/private/tmp/fleet-roll-src`；detached HEAD=`f6e332d7568b01c5253618449bfef5839102c851` |
| 隔离文档 worktree | `/private/tmp/fleet-sra-v1-docs` |
| 新建本地分支 | `docs/standing-release-auth-v1`，parent/HEAD 同上述基线 |
| 实际文档写入 | 仅本 `STOPPED-SRA-V1.md` |
| 正式草案/收据 | 尚未创建 `STANDING-RELEASE-AUTHORIZATION-V1*.md` 或 `RECEIPT-SRA-V1.md` |
| commit / push / PR / merge | 均未执行 |
| 产品代码 / 工具源码 / 生产读写 | 均无变更；未运行生产工具或生产读取 |
| 窗口签发 / authority JSON / stage00 | 均未执行，包括 W7 |

原检出五项既有未跟踪文件保持：`BRIEF-SRA-V1-DRAFT.md`、`BRIEF-W7-INSTALLER-QUAL.md`、`BRIEF-W7-PREP.md`、`RECEIPT-W7-PREP.md`、`STOPPED-W7-PREP.md`。未修改、删除或纳入暂存。创建隔离 worktree/分支产生的本地 Git 元数据不等于提交、发布或合法接受。

最终状态只读回看时，原检出另出现 `ATTACHMENT-W7-MANDATE-S1-INSTALLER-QUAL.md`、`RECEIPT-W7-INSTALLER-QUAL.md`、`STOPPED-W7-INSTALLER-QUAL.md` 三项 untracked。它们不是本任务创建，停止后未读取、核验或修改。因此本记录前述“未找到 installer 资格收据”类事实只限初始取证时点；后续须以真实资格收据与对应 pins 另核，不能据文件名推断 PASS，也不能沿用旧未资格结论冒称当前状态。

## 已完成的只读取证，供原责任链接续

1. 已读 `.agents/README.md`、`.agents/local/README.md`、直接相关 Architecture/Current Decisions/Specs，以及 `spec-governance` 路由与 AUTHOR 模式。两名非作者分析 agent 只读取证，未创作草案；其分析不等于独立审查已完成，更不等于接受。
2. Owner 原件：`/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`，选择器 `$.rulings[id=owner-20261107-preauth-v2]`，登记时间 `2026-11-07 14:43`。六条款=`items[0..5]`，行动=`items[6]`。观察文件 SHA256=`a57e9b12d6849635f63bf9591671f158b5e151dc5d22ecfaaafa1f7bf5139ba7`；选中 ruling 的规范化 JSON SHA256=`087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006`。规范化算法为 UTF-8、`json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，无末尾换行。台账可能继续前移，后续须按选择器和子记录 hash 对照，不以整个文件 hash 永久不变为前提。
3. 首任提名在同文件 `$.history[660]`，`round=sra-v1-draft-dispatched`、时间 `2026-11-07 14:44`，`actions[1]` 为监管会话(uid 502，台账归属)。同算法子记录 SHA256=`0498d4a65f2eb5d66cc3ec686a377ccbbbc3a779d79460a7ba6569233dc004e5`。精确监管 session/principal 登记尚未找到；不能拿旧 `reviewer_session.id` 补齐，也不能把提名写成已任命。
4. W7 十节来源：`/private/tmp/dsh-fleet-window-tools/EXECUTION-MANDATE-W7-DRAFT.md`，SHA256=`ffe1088eca1df5b63ae8e1a4e4897d5c390aa38cf76021fcc45e323fad96c911`。状态 `DRAFT_NOT_ISSUED`；实际 installer/bundle=`NOT_SELECTED_NOT_QUALIFIED`，未来运行门仍 `UNKNOWN/FRESH_AT_WINDOW`。这些是每次签发前的必需证据，不能把 R5 隔离 prep PASS 当成生产 PASS。旧稿“仅 Owner 可签发”的适配只能在合法委托生效后进行；本轮未改旧稿。
5. 本地接受规则：`mayf3` 或 PR 中明确授权的维护者正式接受；非作者独审 PASS 不自动接受；接受须绑定 reviewed commit 和最终 accepted head。SRA 为新增委托机制，不能把 Owner §2 对“既定且无实质语义变化的规范继任”的委托擅自扩大成任意新权威接受权。
6. 直接相关约束：D-009、`SCHEDULER_TIMEOUT_OUTCOME_V3`、`AGENT_PROCESS_LIFECYCLE_HARDENING_V4` 保留 UNKNOWN、exact termination/effect proof、原 fence 和不重放；`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1` 的 accepted implementation Contracts 不授生产 apply，新 controller/profile/trust-root/目标/特权不得借 SRA 激活；提示词、自写 JSON、hash 均不能代替合法授权与可执行控制。

## 尚未完成及接续边界

- 未起草六节正文、Owner 六条款覆盖收据、完整每门“核验什么+证据坐标”表；未进行草案独立语义审查或正式接受。
- 正文须保留 Owner §4 原文语义：旧 runtime 与已派发外部操作终止或有效隔离、全部技术与合同门通过后，标准发布 stage10 可结束停机 containment，仅恢复原有合法自然准入；保留历史 UNKNOWN/fence/认证，不重放。bootstrap 后仍需全局暂停属于非标准类，机制须另证。
- Owner §5 可操作化为四类升级：未授权语义变化；危险迁移；扩权；无法安全回退或超发布策略重大风险。普通缺陷、测试失败、installer 未资格、构建不兼容、缺证由原责任链补齐重验；缺证禁止依赖操作，不自动变成 WAITING_OWNER。
- 角色任命身份、受托接受者的具体权限登记、明确有效期、控制绑定与资格证明、当次窗口事实均不能伪造；W7 不自动签发。
- 最小接续是原责任链先处理 Git 连接失败；本次停止后未做网络诊断、配置变更或重试。后续恢复本任务时沿用当前文档分支和既有只读证据，对移动的 authority/source/HEAD 做实际影响复核，再继续六节草案、非作者审查、docs-only commit/push 和 base main PR；不合并，不做生产写入。
