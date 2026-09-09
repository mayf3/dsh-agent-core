# WDA STRUCTURAL DIAGNOSTICS — DEPLOYMENT PACKET V1（冻结）

GOAL = WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_RECOVERY_V1 · 2026-09-09
STATUS = READY_FOR_PRODUCTION_APPLY · PRODUCTION_APPLY = HOLD（等 slot，冻结不轮询）

## 坐标（frozen）

```text
PR                     = mayf3/dsh-agent-core#225（branch agent/wda-structural-diagnostics-v1）
AUTHORITY_COMMIT       = 2a3a107（AMENDMENT_1 docs；Owner AMENDMENT_1_ACCEPTED）
ACCEPTANCE_COMMIT      = c572c9f（lifecycle acceptance finalize，docs-only）
IMPLEMENTATION_COMMIT  = 09d9eb3
INDEPENDENT_AUDIT      = ACCEPT / BLOCKERS=[]（12/12 checkpoints PASS；
                         pristine-main 失败集 equality CONFIRMED）
CLOSURE                = 3 文件窄闭包（mapping.js / schema.js /
                         capabilities/workflow-definition-authoring.js）
                         + registry/transport/relay/workflow.js/index.js 零触碰
TARGET_DIGESTS         = SHA256SUMS.txt（targets/*；post-merge 与 main 逐字节复核）
LIVE_BASELINE          = SHA256SUMS.txt（preimages/* + guard 六文件，
                         captured 2026-09-09T05:52Z，--precheck 已 PASS 零漂移）
```

## Owner 步骤（密码一次注意力原则：先 dry 后真）

```bash
# 0) selftest（离线，只写 /tmp）——必须先绿
bash <PACKET_DIR>/run-wda-structural-diagnostics-v1.sh --selftest

# 1) 只读预检（无需 sudo）
bash <PACKET_DIR>/run-wda-structural-diagnostics-v1.sh --precheck

# 2) 安装（sudo；自动 preimage 备份 + 逐文件 readback + 装后 in-place smoke）
sudo bash <PACKET_DIR>/run-wda-structural-diagnostics-v1.sh --install

# 3) 重启 runtime（同一 kickstart seam）
sudo launchctl kickstart -k system/ai.agent-core.runtime
```

`<PACKET_DIR>` = 本 packet 在 checkout 内的绝对路径
（deployment-artifacts/wda-structural-diagnostics-v1）。--install 任一步 FAIL
即停：勿重跑，把输出发回（preimage 备份在 packet 目录 `*.install-backup`）。

## 回滚

```bash
sudo bash <PACKET_DIR>/run-wda-structural-diagnostics-v1.sh --rollback
sudo launchctl kickstart -k system/ai.agent-core.runtime
```

## 安装后机械验收（Agent 侧，无需 sudo）

1. live 三文件 sha256 == targets/*；guard 六文件 == baseline（脚本已内建）。
2. runtime 重启后 pid 变更；broker catalog 引导不变（authoring 工具仍在）。
3. E2E（agent-driven，见下）→ svc stdout.log 出现该 definition 的
   `PUT .../draft` 行；DB 只读回读 `definition_digest non-null`。

## E2E（使用 EXISTING draft 2cba2687-073a-420e-a49c-ab271d1583aa，禁建替身）

唯一合法写入者 = 域唯一 enabled DOMAIN_OWNER = d5b3aeb2
（agt_build-in-public-agent 本体）→ **模型面 agent-driven**，Owner 经飞书
对 build-in-public 群发自然话术（一步到位，Agent 依次执行并回报每步原文）：

> 请用 workflow_definition_authoring 把现有播客草稿版本
> （definitionVersionId 2cba2687-073a-420e-a49c-ab271d1583aa）完成定稿并发布。
> 分两步做：第一步，先故意发一次带多余参数 `graph: {}` 的 replace_draft_graph，
> 把工具返回的**完整错误文本原样**报给我（这是在验证错误提示）；第二步，
> 用 linear 步骤表单重试：steps 依次为「素材整理」「播客初稿」「审核定稿」
> （instructions 用一句话说明该步骤要做什么，assigneePrincipalId 用你自己的
> canonical Principal UUID），terminalOutcome 为「播客稿完成」；成功后
> publish_version，然后用 workflow_execute.create_instance 建实例，
> contextPayload 用：
> {"title":"从语言模型到世界模型：GPT 如何开始改造物理世界",
>  "sourceMaterialPath":"/Users/yanfenma/gpt6-podcast-material.md",
>  "coreThesis":"GPT 正从理解语言走向理解空间、操作软件、制造实体并影响物理世界。",
>  "targetDurationMinutes":20,
>  "outline":["视觉与语音：AI 获得人类式感知接口","Blender：从生成图像走向三维空间理解","3D 打印：数字模型变成现实结构件","电路与机器人：从结构件到可行动实体","仿真与现实验证：数字世界和物理世界互相校正","区分 GPT-6 已展示能力与未来推演"],
>  "editorialGuidance":"明确区分官方事实、社区案例和未来推演，不把 Blender Demo 直接等同于完整世界模型或 AGI。"}
> 实例建好后不要替别人推进：用 workflow_instance_detail 查看当前节点与
> assignee，若当前节点 assignee 是你自己，就由你自己执行一次
> workflow_execute.transition 推进它。最后把 definitionVersionId、
> publish 结果、workflowInstanceId、detail 里看到的当前节点/assignee/出边、
> 以及 transition 结果一起报给我。

验收门（Agent 回报 + 机械回读双证）：

```text
STRUCTURAL_DIAGNOSTICS      第一步返回含 unknown property "graph" 的字段级 detail（非裸码）
VALID_MINIMAL_GRAPH         第二步 linear replace = ok:true
EXACT_EXISTING_DRAFT_REPLACE= 同一 2cba2687；svc log PUT /draft 出现；DB digest non-null
FINAL_BUSINESS_GRAPH_REPLACE= 同上（业务三步图即 minimal 图的业务化）
PUBLISH_VERSION             version_status=PUBLISHED（DB 只读回读）
CREATE_INSTANCE             workflowInstanceId 在场
ASSIGNEE_RESOLUTION_FAILED  = NO
INSTANCE_DETAIL             current node + canonical assignee + outgoingTransitions
SELF_TRANSITION             恰一次；state/version 恰 +1；下节点符合 primary 链
```

## 边界与排序注记

- 本闭包与 pending dsh #224（workflow agent execution impl）文件不重叠
  （彼侧动 workflow.js/index.js 族；本侧三文件）；但两者共享 kickstart
  seam——**同一 slot 内先装本 packet、再随 #224 一起 kickstart 可省一次重启**；
  由 Owner 排序裁决。
- install 后、kickstart 前：运行中的 runtime 不受影响（进程已加载旧模块）；
  smoke 在独立进程对 staged 字节执行。
- EXACT_HISTORICAL_INVOCATION_PAYLOAD = NOT_RECOVERED（诚实边界）——
  本 E2E 的第一步（故意 invalid + 原文回报）在生产面直接关闭该不确定性。
