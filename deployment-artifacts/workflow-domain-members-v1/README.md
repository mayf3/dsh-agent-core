# WORKFLOW_DOMAIN_MEMBERS_CONTROL_PLANE_V1 — Owner dogfood packet

一次性、可复核的生产 dogfood。脚本只讲 authsvc(4001)/svc-workflow(8989) 的正式
HTTP 面 + auth_ro 只读 DB（审计核对）；无 DB 写、无 admin/run-as/OBO、无 UUID 猜测。

## 身份链（goal §5；零 DB 身份查询）
1. **dsh Agent Directory**（deployment-side agent-definition 配置）：display_name
   `龙虾合伙人` 精确唯一匹配 → `agt_ceo-agent`（0 匹配=IDENTITY_NOT_FOUND；
   >1=IDENTITY_AMBIGUOUS；disabled=NOT_FOUND；脚本 STOP）。
2. **目标 agent 自己的 MachineClient 凭证**（CREDS_FILE，sudo 可读）经 authsvc
   client_credentials（resource=svc-workflow）铸 token —— `sub` 即 auth 权威绑定的
   canonical principalId（这正是该 agent 自己 runtime 的认证方式，非 run-as）。
   生产实证：**`25a6789f-daa5-4600-a764-b0209b9c8e19`**（三个同名 principal 消歧后唯一）。
3. **authsvc identity directory 反向一致性证明**（PR#62 已部署面，
   `GET /api/v1/directory/principals/{sub}/agent`，audience=identity-directory，
   scope=auth.directory.read）：返回 agentId 必须 == `agt_ceo-agent` 且 active。

## 运行
```bash
# 1) 离线自测（stub 4001/8989；必过再跑真实）
/path/to/OWNER_DOGFOOD.sh --selftest

# 2) 真实 dogfood（Owner sudo shell；CREDS_FILE 绝对路径）
sudo -s
CREDS_FILE=/path/to/credential-store.json /path/to/OWNER_DOGFOOD.sh
```
产物：`wfdm-dogfood-evidence-<ts>/`（A/B/C 全量 wire 证据 + verdicts）。

## 脚本机械验证的断言（goal §11/§12）
A: 目录精确唯一匹配；sub 反向一致性。
B1 基线 list；B2 add（role 缺省）⇒ 200 DOMAIN_MEMBER；B3 恰一次；
B4 新 key 重复 add ⇒ 409 already_member；B5 同 key replay 字节一致；
B6 role=DOMAIN_OWNER ⇒ 403 domain_owner_delegation_forbidden（冻结 single-owner
invariant；不给龙虾合伙人授 owner）；B7 audit 恰 1 行 member_added（auth_ro）。
C1 龙虾自 context my_domains ⇒ DOMAIN_MEMBER；C2 owner 经 authoring 面发布
V2 minimal 图（FIXED_PRINCIPAL=龙虾）并 create_instance；C3 龙虾 worklist 可见；
C4 workflow_instance_detail ⇒ visibility full + assignee=龙虾。
（DOMAIN_MEMBER 只读可见性=DOMAIN_MEMBER_VISIBILITY_UNCHANGED：可见性来自
assignee 谓词而非 membership——本地 E2E 已双重实证。）

## 注意
- **owner 侧 B/C2 走 wire 契约**（与 `workflow_domain_members` broker 工具逐一
  同形：路径/body/Idempotency-Key）。broker 工具本体已实现（dsh 分支
  agent/workflow-domain-members-broker-v1，Spec proposed），部署后可经工具面重放同 dogfood。
- 本脚本会产生真实业务产物：一条 membership binding + 一个 dogfood 域内的任务
  实例（C2，指派给龙虾合伙人）——这就是 dogfood 的目的；回滚 = 对 binding DELETE
  + 实例 cancel（正式面均可）。
- svc 侧前置：SVC_WORKFLOW_DOMAIN_MEMBERSHIP_CONTROL_PLANE_V1 实现（already_member
  / domain_owner_delegation_forbidden / role 语法）需部署后才可全绿；旧版下
  B4 变 200、B6 是 200 upsert——脚本会 FAIL 并如实暴露。
