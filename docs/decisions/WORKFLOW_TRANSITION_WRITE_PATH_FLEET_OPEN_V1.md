# WORKFLOW_TRANSITION_WRITE_PATH_FLEET_OPEN_V1

```text
DECISION_ID: WORKFLOW_TRANSITION_WRITE_PATH_FLEET_OPEN_V1
OWNER_RULING: OPEN_WRITE_PATH_FLEET_WIDE
DECIDED_BY: mayf3 (Owner, interactive directive via coordinator dialog, 2026-09-02)
EFFECT: AUTH_V1_CANARY_WRITE_ENABLED true（fleet-wide；gate 不再限制 transition 执行，实际可写主体仍受既有 workflow.execute Grant 集合约束）
SUPERSEDES: 无（本裁决为新增 Owner 明令；不修改任何已接受 Spec 的语义）
SCOPE_EXCLUDED: 无
```

## Ruling

Owner 于 2026-09-02 在 coordinator 对话中明确选择「全量开放写路径」：所有持有
`workflow.execute` Grant 的主体可立即对真实业务 Workflow 执行
`workflow_transition`（submit）。Owner 在被告知以下事实后作出本裁决：

1. 已接受的试跑授权提案（PR #137，仍为 proposed）自身规定「一次 canary 通过
   不授权任何 fleet 写开放」——即本裁决**不是**该 spec 的执行结果，而是 Owner
   在 canary 之前作出的独立、更高级别明令（canary spec 亦承认 gate 终态
   "直到 Owner 明令"）。
2. 写路径尚未经 canary 实测（canary 窗口被本裁决跳过）；首次真实执行的
   失败模式是该次调用报错，不产生静默数据损坏（transition 为受校验的状态机
   推进）。
3. 实际可写主体 = 当前持有 `workflow.execute` Grant 的集合（已知含
   agt_build-in-public-agent / principal d5b3aeb2…；全量 grantee 清单受 auth
   .env 0600 边界，未做 root census）。
4. 每次真实 transition 均产生服务端 event/receipt/audit 记录，可审计、可追溯。

## Execution record

- 2026-09-02：`AUTH_V1_CANARY_WRITE_ENABLED` 由 `false` 翻转为 `true`
  （svc-workflow dotenv 单键精确编辑，其余字节不变；执行前后 sha256 记录于
  GOAL_STATE/EVENTS）；`gui/502/com.svc-workflow` kickstart 重启使 env 生效。
- 执行方式：coordinator 直接编辑（该 dotenv 为 Owner 用户所有、gui/502 服务
  为 Owner 用户域，无需 sudo/无需 osascript）。
- 关闭方式：同一单键翻回 `false` + kickstart（Owner 任何时候明令即可）。

## Non-goals / 不变量

- 不修改 Grant、Principal、Credential（本裁决只动 gate）。
- 不修改产品代码与已部署字节（workflow.js 保持 577c8778…）。
- 不构成对 PR #137（试跑授权）的接受或拒绝；该 PR 维持 proposed 原状，
  是否继续 canary 由 Owner 另行决定。
- broker 部署契约（577c8778… / catalog 15 / gate 之外的不变量）不变。
