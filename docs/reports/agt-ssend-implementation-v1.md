# agt-ssend-implementation-v1 — AGENT_CORE_AGENT_SESSION_MESSAGING_V1 implementation record (Contract-by-Contract)

- TASK_NAME = 会话 实现
- AUTHORITY = `AGENT_CORE_AGENT_SESSION_MESSAGING_V1` accepted r3（acceptance commit `23d055a`，
  `implementation_authority: contracts`，final-head audit PASS / READY_FOR_IMPLEMENTATION；
  governance chain 见 `docs/reports/agt-ssend-lifecycle-acceptance-v1.md`）
- IMPLEMENTATION_BASE = `23d055af56430e8b08d39993e77eb3b9140a5ff6`（feat/agent-session-messaging-v1）
- WORKTREE = 独立 clean worktree（用户主 checkout 全程只读，零改动）
- NODE = 部署钉死 v25.6.1（`/usr/local/bin/node`）跑全部测试

## 1. Changed paths（全部在 packages/，docs-only 之外零越界）

```text
packages/broker/src/capabilities/agent-session-messaging.js   NEW  manifest（纯数据）
packages/broker/src/index.js                                  MOD  DEFAULT_MANIFESTS + resolver closure 第三 provider（F9）+ auditDenial 透传
packages/broker/src/gateway.js                                MOD  可选 auditDenial L0 钩子（R12），不改任何 denial 结果
packages/production-runtime/src/agent-session-messaging.js    NEW  受信 handler provider（R2/R3/R5/R7/R8/R10/R12）
packages/production-runtime/src/agent-session-reply-wait.js   NEW  R8 closed mapping + R9 race-safe waiter
packages/production-runtime/src/agent-session-messaging-audit.js NEW L0/L1 bounded JSONL evidence（scheduler 先例，不用其 store）
packages/production-runtime/src/compose.js                    MOD  provider/audit 装配；shared-codex 两函数机械移出（500 行文件不得增长）
packages/production-runtime/src/shared-codex-migration.js     NEW  移入的两函数（逐字不变；compose 保留 re-export，executable import 更新）
packages/production-runtime/src/notification-ingress-runtime.js MOD deliver 证据包装器透传 control 参数（修复 R4 侧车被丢弃）
packages/agent-router/src/parent-rpc-relay.js                 MOD  R3 exact source-turn proof（execution map 三条件）
packages/agent-router/src/ingress-delivery.js                 MOD  deliver(req, {messageOrigin})：exact-allowlist + freeze + fail-loud（R4）
packages/agent-router/src/process/turn-execution.js           MOD  session/prompt 兄弟元数据 messageOrigin（+3 行）
packages/demo-server/src/session-seam.js                      MOD  messageOrigin 校验 → createUserMessage source（R4）
packages/demo-server/src/index.js                             MOD  session/prompt 透传 params.messageOrigin（+2 行）

tests（全部 NEW）:
packages/broker/test/agent-session-messaging.test.js                  13 tests
packages/demo-server/test/session-seam-message-origin.test.js          5
packages/agent-router/test/message-origin.test.js                      9
packages/production-runtime/test/agent-session-reply-wait.test.js     11
packages/production-runtime/test/agent-session-messaging.test.js      16
packages/production-runtime/test/agent-session-messaging-integration.test.js 7（composed A2A）
```

## 2. Contract conformance

| Contract | Implementation | Evidence |
|---|---|---|
| R1 identity | manifest id/toolName `agent_session_send`、operation `send`、`local.resource=agent-session-messaging`、`requiredScopes=['agent.session.send']`；child relay 经既有 relay.js（零 relay 修复）；G8 local relay 测试补齐 | broker test L1-3 |
| R2 三字段 | 受信 handler 首动作 `validateSendArgs`：exact-3-props、`^agt_[a-z0-9-]+$` 5..128、1..65536 UTF-8 bytes、NUL 禁止、timeoutSeconds 整数 0..300 无默认；manifest structural 校验仅 defense-in-depth | handler test R2 ×2；integration forged-fields |
| R3 受信派生 | sourceAgentId=gateway 冻结 caller；correlation=parent-rpc `provenSourceTurnExecutionId`（本进程 generation execution map present + unsettled；turn/deliver 来源都可用）；requestId 每次 fresh；self-send 前置拒绝；proof 缺失 → internal_error 零投递 | parent-rpc test R3 ×4；handler test R3 ×2 |
| R4 侧车 | deliver 第二控制参 exact-allowlist {kind:'inter_agent',sourceAgentId,correlation}、freeze、malformed fail-loud、未知控制字段拒绝；route→AgentProcess→session/prompt 兄弟元数据→session-seam 校验→createUserMessage source 逐字透传（dsh-llm 实测 passthrough）；无侧车 = source user 不变 | router test R4 ×5；demo-server test ×5；integration Case C+G |
| R5 target 身份 | handler 只读 trusted context；A 的身份仅为 origin 元数据；B 的 credential/Principal/grants 由既有 gateway 路径（loadCredentialFor(B)+Auth）决定，零继承 | broker 既有 identity tests + integration |
| R6 授权 | `agent.session.send` 独立 scope；denied/credential 失败 → handler/Router 零触达（Case F 集成断言 spawn=0） | integration Case F ×2 |
| R7 timeout=0 | 真 inbox receipt 后返回 `{status:'accepted'}`；queue-only 绝不冒充（deliver 仅在 prompt receipt resolve） | integration Case C |
| R8 timeout>0 | receipt 起算的 reply deadline；closed mapping 全行（含 F19 `terminated_without_outcome→outcome_unknown`，truncated/failed/no_output 永不成功）；timeout ≠ 其它终态 | reply-wait ×11 + handler R8 ×4 |
| R9 waiter | 9 步算法逐步实现（先读、订阅过滤 exact handle、订阅后复读、剩余 deadline timer、事件后权威复读、超时前末次读、once-guard、每出口清理 timer+listener） | reply-wait ×7 race cases |
| R10 busy/queue | 零 active-run steering；FIFO = BASE 既有；queue-cap → `queue_capacity_exceeded`、fence/其它 proven 零字节 → `not_admitted`；恰好一次 deliver，无 replay | handler deliver-error ×5 + timeout no-replay |
| R11 外部隔离 | 仅 generic deliver；messageOrigin 侧车精确 3 字段，无 Binding/feishu 叶子；feishu.reply/onIngress 零触达 | allowlist 测试 + integration Case C+G |
| R12 审计 | L0 gateway denial 钩子（capability-scoped、不改变 denial、append 失败仅 visibility）；L1 intent 先于 deliver（可证顺序测试）、失败=零投递；outcome 后置、append 失败不改业务结果 + sanitized onAuditFailure；bounded JSONL 轮转 8MiB；字段封闭、无 message text/raw correlation | handler R12 ×4；integration R12 ×2 |

§5 taxonomy：manifest error 表 = 15 类闭合（含 F23 transport_failure/unsupported_operation，测试断言与表逐项相等）；§7 Cases A/B/C/F/G 集成覆盖，D/E/H/I 契约由单元+既有 router/broker 套件覆盖（E 的 deadline-at-receipt 由 handler 测试专测；H 为 BASE 既有 identity 套件；I 结构性成立：deliver 路径无 Binding 触点）。

## 3. Verification

```text
FULL SUITE（pinned node v25.6.1，proxy env unset）
= 1379 tests / 1374 pass / 2 fail
FAIL-1 TRUSTED_INGRESS（agent-router feishu-regression）   = BASE 已存在（stash 对照验证；测试期望落后于 BASE 的 feishuSenderOpenId 注入）
FAIL-2 harness resolution（agent-provisioning）            = 环境性（需要 DSH checkout）
其余包（含 broker 288 / demo-server / production-runtime 133）全绿
结构 guardrails：node scripts/verify-code-structure.mjs --base 23d055a --head HEAD = exit 0 PASS
compose.js 500→447 行（shared-codex 机械移出后回到 500 以下并留装配空间）
```

实现中依据测试发现并修复的真缺陷：reply-wait once-guard 在 timer 未安装时的 clear(undefined)
防御；notification-ingress deliver 证据包装器丢弃控制参数（R4 侧车被吞）。

## 4. Boundaries

```text
PRODUCT_CODE_CHANGE = packages/ 仅限上列 14 src + 6 test 文件
GRANT_CHANGE = NONE（agent.session.send 的实际发放是部署/Owner 事项）
PRODUCTION_CHANGE = NONE；无 sudo、无 restart、无生产访问
MAIN_MERGE = NONE（不 merge、不推送；PR #138 保持 OPEN 不由本链处置）
用户主 checkout = 全程未进入未修改
```

## 5. FOLLOW_UP_DEBT

1. F1（PR #130 disposition 注记陈旧）、F2（§3 部分证据行锚点未逐一复测）、
   final-head audit note（spec change_log 未补 acceptance 条目）——accepted head 不改，随下次 spec 触碰清理。
2. TRUSTED_INGRESS 测试期望落后于 BASE 行为（feishuSenderOpenId）——BASE 继承债，独立测试修复轮处理。
3. `target_disabled` 在 BASE 语义下不可区分（disabled resolveAgentRef 抛 AGENT_NOT_FOUND→target_not_found）；
   分类保留在闭合表内，出现频率为零。
4. relay 本地路径仅补最小覆盖（G8）；waiter 无持久化（R9 明确 V1 不做 restart 恢复）。
5. agent_wake PR #130 待 owner close-as-obsolete（spec §2.1 disposition）。

## 6. Independent-audit closure addendum

The exact-`c2a1194` independent implementation audit returned `REVISE`; its
frozen seven-item blocker union is persisted in
`docs/reports/agt-ssend-implementation-audit-revise-v1.md`.

The earlier structure-PASS statement above did not reproduce on takeover:
`packages/agent-router/test` had 21 direct tracked children. The closure moves
the new message-origin test into the existing `test/process-lifecycle/`
directory; it does not add an exception. The same closure also fixes only the
audited blockers: parent-RPC ambiguous outcome classification, legal opaque
source Agent ids, disabled-target distinction, R12 validation-denial evidence,
and a composed test path that now traverses child mapping/relay, parent-RPC,
the real gateway/provider/Router, and the real target session seam.

The standalone accepted-Spec final-head evidence is persisted at
`docs/reports/agt-ssend-final-head-audit-v1.md`. Final readiness is determined
only by the subsequent exact-new-head independent re-audit, not by this author
addendum.
