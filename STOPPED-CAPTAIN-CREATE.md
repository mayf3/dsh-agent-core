# STOPPED-CAPTAIN-CREATE

```text
STATE = STOPPED_BEFORE_CREATE
STOPPED_AT_UTC = 2026-11-07T15:01:17.468393Z
DESIGNATION = release-captain-agent-core-20261107
PRINCIPAL_UUID = UNKNOWN
IDENTITY_CREATION_STATE = NOT_CREATED_BY_THIS_TASK
APPOINTMENT_STATE = NOMINATED_NOT_APPOINTED
AUTH_CREATE_POST_ATTEMPTS = 0
AUTH_MUTATION_PERFORMED = NO
RUNTIME_8788_REQUESTS = 0
PRODUCTION_WRITE_PERFORMED = NO
```

Owner §4 和本任务已授权通过现有合法管理路径创建专用身份，不需要再次批准相同创建目的。执行者当前未建立该入口的合法认证：2026-11-07T15:01:17Z，`GET http://127.0.0.1:4001/api/v1/principals/by-external-ref`（无 Bearer）返回 HTTP 401，`Authentication required: Bearer token missing`。该结果只证明此次无认证请求被拒绝，不证明没有其他合法管理员。skill 连接的 `auth_ro` 只读查询 rc0、`transaction_read_only=on`、`canSelectPrincipal=true`、`canInsertPrincipal=false`。未按名称寻找、借用或签造管理员凭据，未尝试 raw SQL / legacy CLI 绕过管理认证。

本机 `agent_dev_center` / `::1:5432` 在上述时点对 designation、`agt_release-captain-agent-core-20261107` 和精确展示名的无状态过滤查询为零行。其他主机、未知别名及全局存在性仍为 UNKNOWN。观察原文、查询和 hash 见 [只读证据](docs/reports/captain-principal-creation-20261107/auth-readonly-observations.json)。

源码存在独立 `POST /api/v1/principals`，可与 Client/Secret/Grant 创建隔离；但当前 actor 尚未证明有权调用。此入口也不自动建立 canonical lifecycle：accepted Auth Foundation 明确要求显式 lifecycle，CSESB 管理路径要求 exact typed Principal/Agent pair、合法 attestation 与 fresh unique enabled Core Definition。语法正确不等于 canonical 已验证。故本次没有按猜测确定 UUID、external_ref、owner 或 Session，也没有创建半成品后宣称成功。

| 阻塞原因 | 受影响动作 | 责任主体 | 现有授权 | 最小补证 / 差量 | 下次合法触发及恢复条件 |
|---|---|---|---|---|---|
| 当前执行者没有经验证的 `svc-auth / auth.identity.provision` 管理身份；skill 只有只读 DB 权限 | 创建 POST、创建后权威读回 | Auth 既有有权管理员 / 凭据保管者 | Owner standing §4；本任务 | 优先由已有权限的 Auth 管理员执行一次精确 identity-only 请求并提供脱敏回执；不向本 worker 新发 Client/Secret/Grant，不授通用 DB 写权 | 管理员提供可归属 actor、合法入口/加载版本、精确请求及隔离证明后，在新的明确续接任务核对旧任务零尝试与最新前态 |
| canonical 方案尚未完成 Auth 权威验证，S1 创建不写 lifecycle | 宣称 canonical、完成唯一 Principal/Session 条件 | Auth 身份权威与现有 Core 身份责任链 | Owner §4 限身份绑定，未授权 Core runtime 写入 | 核定 exact 类型、agentId、opaque external_ref、custody、canonical pair/lifecycle、可信 Session 绑定及合法 attestation；若需新 Core Definition、安装/写适配或扩权，先给 Owner 精确新增效果差量 | 全部前提在现有合法路径可满足且不产生禁止效果才续接；否则保持 STOP，不建立临时 fallback / 自写 provider |

最小权限结论：**当前不请求新增任何 Client、Secret、Grant、特权 helper 或生产写权限。** 优先差量是既有 Auth 管理员的一次受控执行和权威证明。若现有管理路径无法提供 canonical 的身份绑定而不扩大工作面，报告所需的 exact effect / actor / target / rollback 后交 Owner/Auth 管理员裁定；本报告不授予该差量。

STOP 只冻结身份创建及其依赖的任命/签发。本任务继续完成已经授权的登记草案、证据、commit、push 和 base=`main` 的 PR；不合并。五条件及尚未执行的负向清单见 [证据包](CAPTAIN-CREATION-PACKAGE.md)，最终交付见 [收据](RECEIPT-CAPTAIN-CREATE.md)。
