# WORKFLOW_DOMAIN_MEMBERS_CONTROL_PLANE_V1 — Closure Report (2026-09-09)

## Heads

- Start: dsh-agent-core `origin/main = 232bc2d`；svc-workflow `github/main = 4bbbbe9`。
- Final (this worktree): dsh branch `agent/workflow-domain-members-broker-v1` @ `9898bd0`；
  svc branch `agent/workflow-domain-members-v1-impl` @ `30d5cf2`（含 spec commit `368d84f`）。

## Deliverables

| Repo | Artifact | Commit |
|---|---|---|
| svc-workflow | Spec ① SVC_WORKFLOW_DOMAIN_MEMBERSHIP_CONTROL_PLANE_V1（实现授权：role 语法 / already_member / domain_owner_delegation_forbidden / receipt hash+role / 契约镜像） | `368d84f` |
| svc-workflow | Spec ② SVC_WORKFLOW_DOMAIN_OWNER_DELEGATION_V1（§7 gate 提案：ownership audit Q1–Q5 + 有界 multi-owner 模型；**proposed，不 gate ①**） | `368d84f` |
| svc-workflow | 实现（application/receipt/handlers/dto/error + errors.json/openapi/contract.md 镜像 + tests/18 +7） | `30d5cf2` |
| dsh | Spec AGENT_CORE_WORKFLOW_DOMAIN_MEMBERS_BROKER_V1（proposed；WIP 先例：Owner accept = 唯一合并授权） | `ebc9703` |
| dsh | `workflow_domain_members` capability（list/add/remove manifest）+ 冻结 inventory 同步 + 6 测试 + sorted-scope transport 修复 | `ebc9703`/`d11bb90`/`228ca21` |
| dsh | 本地全链 E2E（12/12 PASS + wire replay + audit==1） | `d11bb90` |
| dsh | OWNER_DOGFOOD.sh 生产 dogfood packet（--selftest 19/19 PASS） | `9898bd0` |

## Verification summary

- svc：全套 27 test binary 0 失败（tests/18 = 32/32 含 7 个新测试）。首跑 01_migration_tests
  0019 失败为并行 suite 首建库 race（pristine A/B 绿、复跑稳定绿，非本改动回归）。
- dsh：broker 全套 387/387（manifest-inventory 18→19；workflow-execute reads+PURE_WRITE
  划分；forum CTR-FMC scope-string 同步——scope 集合不变，wire 串 ASCII 排序）。
- 本地全链 E2E：真实 svc 二进制（本实现）+ 真实 broker 模型面（本 worktree）+ 真实 DB +
  JWKS/JWT。B1–B8 + C1–C4 12/12 PASS；wire 级同 Idempotency-Key replay 字节一致；
  `workflow_security_audits` 恰 1 行 member_added。证据：
  `docs/evidence/workflow-domain-members-v1-20260909/local-e2e/`。
- OWNER_DOGFOOD.sh `--selftest`：离线 stub 全流程 19/19 PASS（每次交付 Owner 的脚本先自测）。

## 关键语义裁定（实现中所做的、可复核的裁决）

1. **§7 gate 成立**：`idx_drb_single_owner` partial unique index + 冻结
   `DOMAIN_OWNER_CAN_MANAGE_DOMAIN_OWNER=false` + 生产数据（todo 域 4 owner 行仅 1 enabled）
   ⇒ DOMAIN_OWNER 自主授予 = contract delta，走 Spec ②（提案）。实现侧把该 invariant
   表达为稳定 403 `domain_owner_delegation_forbidden`（receipt-completed，replay 稳定），
   不绕过、不静默转 DOMAIN_MEMBER。
2. **already_member**：替换静默 upsert 成功（OBS-DMC-001 实证）为 409；replay 返回存储
   原结果；同 key 异 role = `idempotency_conflict`（receipt hash 纳入 role）；
   remove-then-re-add 保持合法。
3. **未知域的错误序**（上游契约观察，记录于 E2E 与本报告）：add/remove 先查 DOMAIN_OWNER
   再查 domain，故不存在的域对非 owner 表现为 `not_domain_owner` 而非 `domain_not_found`。
   未重排（超出本 Spec 授权面），如需调整走上游 amendment。
4. **multi-scope token**：transport 现将 requiredScopes ASCII 排序后请求 token
   （auth-service/svc-workflow scope 文法）；单 scope manifest 行为不变。
5. **可见性**：DOMAIN_MEMBER 不因 membership 获得实例读权（frozen
   DOMAIN_MEMBER_VISIBILITY_UNCHANGED）；C 阶段可见性经 assignee 谓词
   （FIXED_PRINCIPAL 指派实例 → CurrentAssigneeFull）实证。

## Final verdicts

```text
CANONICAL_IDENTITY_DISCOVERY   = PASS      # 形式链：Agent Directory 唯一精确名匹配 agt_ceo-agent
                                           # → 目标自身凭证 token sub = 25a6789f-daa5-4600-a764-b0209b9c8e19
                                           # → authsvc identity-directory 反向证明（packet A 阶段机械重放）
DOMAIN_MEMBER_MANAGEMENT       = PASS      # 服务端契约 + 测试 + 本地真实链 E2E；生产 apply=deploy 门控
DOMAIN_OWNER_SEMANTICS         = PASS      # single-owner invariant 维持；授予=403 契约结果；
                                           # delegation delta=SVC_WORKFLOW_DOMAIN_OWNER_DELEGATION_V1（提案，等 Owner）
SERVER_SIDE_AUTHZ              = PASS      # broker 零角色逻辑；负例全绿（not_domain_owner/direct_token 等）
IDEMPOTENCY                    = PASS      # transport replay 字节一致；already_member；同 key 异 role=conflict
AUDIT                          = PASS      # in-tx durable audit；真实 mutation 恰 1 行；重复不伪造
LOBSTER_PARTNER_DOGFOOD        = BLOCKED   # 生产执行需：①svc 实现部署（Owner slot）②Owner sudo 跑
                                           #   OWNER_DOGFOOD.sh（--selftest 已 19/19）；本地同构 E2E 12/12 PASS
TARGET_AGENT_DOMAIN_READ       = BLOCKED   # 同上（本地 PASS：my_domains=DOMAIN_MEMBER）
WORKFLOW_INSTANCE_DETAIL_READ  = BLOCKED   # 同上（本地 PASS：visibility=full，assignee=龙虾）
DIRECT_DB_WRITE                = NO
LEGACY_API_USED                = NO
ADMIN_OR_RUN_AS_FALLBACK       = NO
GUESSED_PRINCIPAL_UUID         = NO
NORMAL_NEW_USE_READY           = YES       # Spec accept + 两仓部署 + Owner dogfood 后即终态
```

**GOAL_STATUS = READY_FOR_OWNER_DOGFOOD**（实现/测试/集成/证据全闭环；生产 dogfood 是
唯一剩余步骤，其前置 = Owner accept specs → 部署 → Owner 执行 packet）。
