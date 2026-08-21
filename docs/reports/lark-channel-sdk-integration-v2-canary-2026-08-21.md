# Lark Channel SDK Integration V2 — Merge-candidate Canary Evidence

> 状态：completed · 日期：2026-08-21
> 仓库：`mayf3/dsh-agent-core`
> final implementation base：`ed07cc09614075ce1b1a3d56e53aa7a4462b6f9c`
> final implementation commit：`cd517b654e224bf771c47c19cf6dd98da0da5dd9`
> live-tested pre-reconcile commit：`3c09a9fe5f70823c148153f10983d6533729768b`
> governing Spec：`AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2`（file revision commit `e1ae7fdc5e7dabcba17819c02935395a5f19e9b0`）
> child amendment：`AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2_INGRESS_CONTENT_COMPATIBILITY_AMENDMENT`（file revision commit `b581acafd6ac8ee2f95daaaa5ab294a8850c960f`）
> 环境：dedicated non-production Feishu test App `cli_a907e201cf78dbb4`，群「大侠 - 小虾米」，真人发送入站消息
> 最终模型路由：`openai-codex / gpt-5.6-luna`（PRIMARY `zai / glm-5.3` 明确配额耗尽后按任务规则切换）

---

## 1. 结论

```text
SPEC_GOVERNANCE_MODE = COMPLIANCE
IMPLEMENTATION_STATE = COMPLETE
VERIFICATION_STATE = SUFFICIENT_FOR_RECORDED_PHASE_A_LIVE_GATES
CONFORMANCE = VERIFIED_FOR_RECORDED_CONTRACTS

PRIMARY_ZAI_START = EXECUTED
PRIMARY_ZAI_RESULT = account_quota_exhausted
FALLBACK_PROVIDER_SWITCH = EXPLICIT
FALLBACK_FULL_RERUN = openai-codex/gpt-5.6-luna

LIVE_CONNECT_SANITY = PASS
LIVE_GROUP_AT_BOT = PASS
LIVE_P2P = PASS
LIVE_ATALL_ONLY = PASS
LIVE_NO_MENTION_DROP = PASS
LIVE_TOPIC_REPLY_TARGET_EQUALITY = PASS
LIVE_PENDING_TURN_DUPLICATE = PASS
CREATE_THREAD_ROOT_ID_PARITY = PASS
WEBSOCKET_RECONNECT = PASS
ROLLBACK_WITHOUT_STATE_MIGRATION = PASS
SECRET_DISCLOSURE_MATCHES = 0
```

本报告只记录 Phase A implementation/canary conformance，不授权 Phase B typing、reaction、card、media、markdown streaming 或 per-group no-mention UX。

### 1.1 Post-canary latest-main reconciliation

Live canary 完成后 `origin/main` 从 `79cc8e8` 前进到 `ed07cc0`（PR #29）。增量只修改 Luna rc.8 investigation/spec 与 compatibility driver；没有修改本 PR 的 Feishu、Router 或 production-runtime implementation paths。三个 implementation commits 已重放到 `ed07cc0`，并得到 final code head `cd517b6`。

```text
git diff --exit-code 3c09a9f..cd517b6 -- \
  packages/feishu-connector \
  packages/production-runtime/src/compose.js \
  packages/production-runtime/test/feishu-readiness.test.js \
  packages/production-runtime/test/v2-ingress-gate.test.js

exit = 0
oldFeishuTree = f7d05ce9a5fe29dc7d3dbadcc2a1d4e38f1f4ef2
newFeishuTree = f7d05ce9a5fe29dc7d3dbadcc2a1d4e38f1f4ef2
```

因此本报告不把 `cd517b6` 冒充为 live-executed SHA；它以 path-level byte identity 把 `3c09a9f` 的 live Observations 关联到 final implementation tree。重放后自动化验证另行重跑。

---

## 2. Provider 与运行时 provenance

### OBS-PROVIDER-PRIMARY-QUOTA

- candidate：`3c09a9fe5f70823c148153f10983d6533729768b`
- route：`zai / glm-5.3`
- 首场真人群消息：`MC27 SANITY`
- 结果：`account_quota_exhausted`
- provider 原始稳定分类：HTTP 429，code `1308`，`Usage limit reached for 5 hour`
- disposition：停止 PRIMARY run；显式切换 provider；从全新 state 重跑，未把失败 run 的场景证据混入最终结果。

### OBS-RUNTIME-READY

最终有效 run：

```text
runtimePid = 69784
candidateHead = 3c09a9fe5f70823c148153f10983d6533729768b
provider = openai-codex
model = gpt-5.6-luna
connectionStatus = connected
botIdentityResolved = true
bindingHash = 7368c54f045c53411568639330b0c2110dca51c0cf1bf080d9533b0c76ba65d0
secretDisclosureMatches = 0
nonStringConsoleValues = 0
```

Parent compose 在启动前清除了全部 recognized proxy env。ChatGPT subscription 仅通过 accepted target override 给 child 注入：

```text
HTTP_PROXY = http://127.0.0.1:7890
HTTPS_PROXY = http://127.0.0.1:7890
NO_PROXY = localhost,127.0.0.1,::1
NODE_USE_ENV_PROXY = 1
```

这保持 `assertTargetProxyRuntime()` 的 parent proxy-env-free gate，同时满足 target-only provider transport。

---

## 3. 真人入站场景 Observations

### OBS-SELF-SENT-SEMANTICS

`normalizedToIngressEvent` 把 SDK `senderType === "bot" || senderType === "app"` 映射为 `sender.selfSent=true`；bridge 在 mention eligibility、PREBOUND_ONLY gate 与 Router 之前执行：

```text
if (ingress.sender.selfSent || ingress.sender.isBotSelf) return
```

因此 App/bot 自发消息及其 echo 不能作为五项 mandatory 入站证据；最终场景均由真人账号发送，记录中的 `senderSelfSent=false`。这也是 canary 不以 bot 自动回灌代替真人输入的结构性理由。

### OBS-LIVE-GROUP-AT-BOT

```text
messageId = om_x100b67b2061044a4b1d5ed1d4d9e040
senderSelfSent = false
chatType = group
mentionedBot = true
bindingHit = true
outcomeError = false
replyMessageId = om_x100b67b2075de8a0de2320b66aee22b
reply = MC27 SANITY COMPLETE
```

### OBS-LIVE-P2P

```text
messageId = om_x100b67b207de94a0b10abbe9bac3331
senderSelfSent = false
chatType = p2p
mentionedBot = false
bindingHit = true
outcomeError = false
replyMessageId = om_x100b67b207a76ca0c39f57c5bb67093
reply = MC27 P2P COMPLETE
```

### OBS-LIVE-ATALL-METADATA

```text
messageId = om_x100b67b207bbd0a4b1f7f08341afbb2
senderSelfSent = false
mentionAll = true
mentionedBot = false
platformRawEventObserved = true
platformRawContentHasAtAllPlaceholder = true
platformRawMentionsPresent = false
platformRawMentionsCount = 0
ingressMentionsShape = [{ key: "@_all", type: "all" }]
rawBotMentions = 0
outcomeError = false
```

飞书该真实事件不提供 `message.mentions` 数组；平台原始 `message.content` 以 `@_all` placeholder 表达 @所有人。SDK 以此生成 `mentionAll=true`，bridge 保留为 `{key:"@_all",type:"all"}`。报告明确保留这一真实平台形态，不伪造不存在的 raw mention-array entry。

### OBS-LIVE-NO-MENTION-20S-WINDOW

测试 App 初始缺少 `im:message.group_msg`，普通群消息不会投递到 WS；history API 明确返回 `230027 Lack of necessary permissions, need scope: im:message.group_msg`。Owner 为 dedicated test App 授权并发布后，同一 API 返回 HTTP 200，随后真人重新发送普通群消息。

```text
messageId = om_x100b67b2372478a0b4c13db68bf08ae
rawMentionCount = 0
observationWindowStart = 2026-08-21T14:58:38.957Z
observationWindowEnd = 2026-08-21T14:58:58.963Z
observationWindowMs = 20006

before = {
  sdkHandler: 6,
  ingressGate: 5,
  router: 5,
  agentTurn: 5,
  rejectionReceipt: 6,
  reply: 6
}
after = before
deltas = {
  sdkHandler: 0,
  ingressGate: 0,
  router: 0,
  agentTurn: 0,
  rejectionReceipt: 0,
  reply: 0
}

bindingHashUnchanged = true
bindingSizeUnchanged = true
bindingMtimeUnchanged = true
runtimeLog = "[feishu] ordinary no-mention message dropped (om_x100b67b2372478a0b4c13db68bf08ae)"
```

Raw driver row 的 `sdkHandlerDropLogged` 为 `false`，原因是该检查只读取 compose 注入 logger 的内存数组，而实际 bridge debug 行由 connector console seam 输出；managed job stdout 同时捕获了上面的精确 drop 行。该 collector 缺口不改变六个零 delta、binding 三项不变、raw mention count 0 或真实 drop log。这里显式 adjudicate，而不是把 raw row 改写成通过。

### OBS-LIVE-TOPIC-TARGET-EQUALITY

```text
ingressMessageId = om_x100b67b218080ca0b36912ef6d1cfda
outboundMessageId = om_x100b67b219db38a4c363bbcb94f7e2c
chatId = oc_92332c45c1cac2ef89857abfee8ed762
rootId = om_x100b674e3657dca8c1c4445e2618461
threadId = omt_19e22f40830f9bb0
outboundParentId = ingressMessageId
replyInThread = true
sameChat = true
sameRoot = true
sameThread = true
replyParentIsIngressMessage = true
escapedToGroupTimeline = false
outcomeError = false
```

双向 equality 来自 Feishu server 对 ingress/outbound 两个 messageId 的独立查询，不只依赖本地 ReplyTarget 计划。

### OBS-LIVE-PENDING-TURN-DUPLICATE

```text
messageId = om_x100b67b2026ff0a4b39502b52d43533
mode = LIVE_EVENT_PLUS_EXACT_LOCAL_REPLAY
replayRawIdentical = true
processingLeaseStillHeld = true
seenBeforeSettle = false
routerDeltaDuringReplay = 0
agentTurnDeltaDuringReplay = 0
agentTurnActive = 1
finalReplyCount = 1
connectorRetryReplay = 0
seenCacheMarkedAfterSettle = true
processingLeaseReleased = true
bindingUnchanged = true
reply = MC27 DUPLICATE LONG COMPLETE
```

---

## 4. create_thread live parity

### OBS-CREATE-THREAD-ROOT-ID-PARITY

通过 candidate 的 `replyTargetToSdkSend(kind=create_thread)` 与同一 pinned SDK channel 创建 fresh root，再查询两个 server objects：

```text
rootMessageId = om_x100b67b2cc82dca4c4538c1671778a4
threadMessageId = om_x100b67b2cc92e0a0c43160837739fba
rootChatId = oc_92332c45c1cac2ef89857abfee8ed762
threadChatId = oc_92332c45c1cac2ef89857abfee8ed762
threadRootId = rootMessageId
threadThreadId = omt_19ede0edd30f5be9
rootIdParity = true
sameChat = true
threadAnchoredInThread = true
```

结果满足 Contract E 的 SDK-native `replyTo=rootMsgId + replyInThread=true` 产品语义；未使用 raw client 或第二 Feishu client authority。

---

## 5. 其他 fresh runtime gates

### OBS-WEBSOCKET-RECONNECT

对 candidate live runtime 执行 SIGSTOP 100 秒越过 heartbeat window，再 SIGCONT：

```text
[lark-channel] [ws] reconnect
[feishu] connection lost; SDK reconnecting (count=1)
[feishu] SDK reconnected
status = connected
```

### OBS-ROLLBACK-WITHOUT-STATE-MIGRATION

旧 base code 读取 candidate 写入的 Binding store：

```text
binding store loaded = 4 bindings
beforeHash = 00fc91ef674c784ccf660c2f44e32526ceea6ad5357c77e9f55e5559342675ac
afterHash = 00fc91ef674c784ccf660c2f44e32526ceea6ad5357c77e9f55e5559342675ac
migration = none
result = PASS
```

---

## 6. Automated verification summary

在 reconciled candidate `3c09a9f` 上已执行：

| Verification | Result |
|---|---|
| standalone/shared log redaction | PASS；新增 10 个 standalone 场景，secret/auth/body/query 匹配均 0 |
| feishu-connector | 117 pass / 0 fail |
| agent-router | 102 pass / 0 fail |
| production-runtime（clean parent proxy env） | 41 pass / 0 fail / 2 deterministic gated skips |
| frozen rc.5 full repository suite | 594 pass / 0 fail / 3 gated skips |
| gated skip set | `DSH_CODEX_PACKAGE_TARBALL` ×2；`SEAM_ENABLED` ×1；均位于未修改包 |
| real Binding read-only replay | PASS |
| governance verifier | PASS |
| syntax / JSON / diff check | PASS |
| gitleaks | 0 branch-introduced findings；两个 repository findings 与 main baseline byte-identical |
| exact secret-pattern diff scan | 0 matches |
| SDK runtime pin | `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f` PASS |
| harness pin | `a12bb03c6861969985f066bfbf0cb7e5dd5ac567` PASS |
| forbidden authority surfaces | Router / AgentProcess / Binding / v2-ingress-gate / Workspace / Kernel branch delta = 0 |

### 6.1 Post-reconcile rerun on `cd517b6`

```text
feishu-connector = 115 pass / 0 fail
agent-router = 102 pass / 0 fail
production-runtime = 41 pass / 0 fail / 2 gated skip
full repository = 594 pass / 0 fail / 3 gated skip
```

命令显式使用 frozen rc.5 Harness (`DSH_HARNESS_ROOT=/private/tmp/dsh-harness-rc5-pr27-audit`) 并清除 parent recognized proxy env。首次并行启动 production-runtime 与全仓重复套件时，10 秒 WebSocket proxy observer 在资源竞争下超时；同一 full-suite invocation 中该 observer 已通过，随后在无并行重复套件时单独重跑 production-runtime 全部通过。没有为此修改 product/test code，也没有隐藏失败尝试。

---

## 7. Evidence relations

| Evidence ID | Relation | Contract / AC | Sufficiency and limitation |
|---|---|---|---|
| EVD-LIVE-ATALL | SATISFIES | Contract B; AC-ATALL-V0-PARITY | 真人 @all-only；真实 raw content metadata + normalized mention metadata；prebound turn/reply success |
| EVD-LIVE-NO-MENTION | SATISFIES | Contract B; AC-NO-MENTION-STILL-DROPPED | 真人普通群消息；20.006s 全字段零 delta；binding 全属性不变；真实 drop log。Raw collector 对 injected-vs-console logger 的选择错误已显式说明 |
| EVD-LIVE-DUPLICATE | SATISFIES | Contract D; AC-PROCESSING-LOCK-COVERS-TURN | live event + byte-identical exact replay；pending lease、router/turn zero delta、post-settle seen/release、单回复 |
| EVD-LIVE-TOPIC | SATISFIES | Contract C identity fields; topic ReplyTarget semantics | server-side ingress/outbound same chat/root/thread，parent 精确指向 ingress，未逃逸主时间线 |
| EVD-LIVE-CREATE-THREAD | SATISFIES | Contract E; AC-CREATE-THREAD test-app gate | fresh root + SDK-native create_thread + server query；root parity/same chat/thread anchoring 全 true |
| EVD-RECONNECT | SATISFIES | preserved V1 readiness/reconnect gate | live forced heartbeat loss and SDK reconnect；恢复 connected |
| EVD-ROLLBACK | SATISFIES | V1/V2 rollback and no-state-migration policy | previous code reads four candidate bindings；store hash unchanged |
| EVD-AUTOMATED | SATISFIES | remaining applicable V2 Phase A unit/integration/pin/no-authority-drift ACs | exact commands/results summarized above；raw local logs are operational provenance, this report is persistent evidence relation |

---

## 8. Raw provenance

最终 live JSONL：

```text
/private/tmp/pr27c-canary-20260821-6/control/pr27c-live-canary-evidence.jsonl
sha256 = 24f66fe0f2cfa2381683160230f318ce678df8b0eeb76b7ec3e13179a016f43e
```

Reconnect source log：

```text
/private/tmp/pr27c-canary-driver-2.log
sha256 = 1372d3ff82689c234a9880f48fad48c9f7bb7924cd386fe78bf2b51c1de8d5e6
```

Raw logs remain local operational material and may expire；本报告保留所有 load-bearing leaf observations、message IDs、hashes、coordinates、relations 与已知 collector limitation，使结果可解释、可查询并绑定到精确 implementation/spec revision。
