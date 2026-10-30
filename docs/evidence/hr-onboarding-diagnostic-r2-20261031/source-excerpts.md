# #953 source readback (selected non-secret code and contract excerpts)

Collected: 2026-10-30T20:57:44.417248+00:00
Continuation parent: `f5a530ef7f0baf9f6ca86e3a9e59fd660ba59437`.
Fresh fetched `origin/main`: `20e60dd72a42a0ef69e0acb8516b15c1893ffb01` (reference only; not merged/rebased into this branch).

Commands: `git fetch --no-tags origin main:refs/remotes/origin/main` (rc 0); `git show <sha>:<path>` for each section below (all rc 0). The remote 953 branch was absent at initial `git ls-remote`; this continuation uses the existing local branch ancestry.

## `f5a530ef7f0b` `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`

Whole blob SHA-256: `2ba0da3b4ff7a4b377ac5275524b1ac7010907733d99cc63e4d2d2a3b6a2d014`.
```text
226: ### 4.5 V2 过渡期 ingress 冻结：unknown conversation 必须 fail closed（AMENDMENT Fix 1）
227:
228: **问题（source-verified，origin/main）**：unknown Feishu conversation 今天的行为是
229: Router `resolveChannelConversation()` 发现 `store.get(ccId) === undefined` 后调
230: `resolveDefaultAgent()`（agent-definition `defaultAgentId` → `agt_stock_agent`）并**自动
231: 创建 default Binding**（`packages/agent-router/src/index.js`：resolveChannelConversation /
232: resolveDefaultAgent）。当前这个行为被 conversation workspace/session 注入**掩盖**；一旦
233: 按 §4.2 删除注入，unknown conversation A / B / C 会全部隐式落到
234: `agt_stock_agent / primary Workspace / main` —— 直接违反 D-006
235: （`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`，不重新讨论）。
236:
237: **冻结（V2 过渡期）**：
238:
239: ```text
240: FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY
241:
242: existing known/pre-bound conversation（binding store 已有该
243:   feishu:<conversationId> 的 Binding row）
244:   → proceed（正常 V2 路径）
245:
246: unknown/unbound conversation（binding store 无该 row）
247:   → FAIL CLOSED
248:   → structured rejection（日志 + 固定的「未绑定」回执）
249:   → MUST NOT create Binding to default Agent
250:   → MUST NOT enter default Agent / default Agent main
251:
252: AUTOMATIC_AGENT_BIRTH = OUT_OF_SCOPE
253:   （fail closed 与 automatic birth 相反；unknown conversation 的显式绑定/
254:   provisioning 属更晚的产品决策，本 Spec 不发明任何 provisioning 系统）
```

## `f5a530ef7f0b` `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`

Whole blob SHA-256: `cb3b7644c81ce03790c2b2036637838a34e20e9332f8cbb0b05e60684e420ce0`.
```text
3: - 状态: accepted（本决策是 V2 产品模型的 **Current Authority**；对旧 authority 的处置见
4:   §24 Disposition——未来 Agent 读这一份 + 被标记 PRESERVE 的旧文档即可知道 Current Truth）
5: - 日期: 2026-08-17
6: - 类型: 正式决策（**standalone Current Decision**，不是旧 Spec 的 amendment；不再给旧
7:   Spec 叠 amendment）
8: - 范围: 只改文档（PRODUCT_CODE_CHANGE = NONE / RUNTIME_CHANGE = NONE / MIGRATION = NONE /
9:   KERNEL_CHANGE = NONE）
10: - 关联: D-002 `AGENT_SESSION_CHANNEL_MODEL_V1.md`（PARTIALLY_SUPERSEDE）· D-004
11:   `BINDING_AND_SWITCH_V1.md`（PARTIALLY_SUPERSEDE）· D-003 `MEMORY_V1.md`
12:   （PARTIALLY_SUPERSEDE）·
13:   `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`（PARTIALLY_SUPERSEDE，产品模型条款被本文档
14:   取代）· `FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd`（DO_NOT_ACCEPT / REPLACE_WITH_SMALLER_SPEC）
661: SUPERSEDE（产品语义，以本文档为准）：
662:   - Feishu 参与通用 switchAgent
663:     （本文档 §15/§17：Feishu = FIXED；Feishu main 的 switch 请求 NOT_ALLOWED）
664:   - every ChannelConversation is switchable
665:     （只有 switchable Product Surface（如 Mobile）可切换；§17
666:       SWITCHABLE_PRODUCT_SURFACE_SCOPED）
667:   - first-contact → default Agent
668:     （本文档 §3：first eligible human message → 自动创建新 Agent，
669:       不是绑定 config default Agent）
```

## `f5a530ef7f0b` `packages/production-runtime/src/compose.js`

Whole blob SHA-256: `9a004e1df5963c132b0efc9941cdef908ac9883087a195494bdc7ef13bbfca4f`.
```text
234:   // V2 PREBOUND_ONLY Feishu ingress gate (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
235:   // §4.5/§5.5): composition-layer product wiring over the Router's GENERIC
236:   // read APIs only (getBinding + channelConversationId — zero Router change,
237:   // zero Feishu special-case in the Router). Unknown/unbound conversations
238:   // fail closed BEFORE the Router's first-contact path (no default Binding);
239:   // non-primary Binding.workspace compatibility rows stay on disk but are
240:   // blocked from the V2 normal path.
241:   const wired = feishu !== undefined
242:     ? wireV2IngressGate(feishu, router, ctx.get('workspaceBootstrap'), log)
243:     : false
244:   if (feishu !== undefined) {
245:     if (!wired) throw new Error('production-runtime: feishu connector handle does not expose setIngressGate (V2 ingress gate cannot be wired — fail loud, never run un-gated)')
246:     log.log(`feishu ingress gate wired (${V2_INGRESS_MODE}: pre-bound primary-workspace conversations only)`)
247:   }
248:
249:   // Trusted CP seam: gateway mode always mounted; the credential store path
250:   // and auth origin arrive via env from the supervision unit. Without a
251:   // credentials file every capability call fails closed
252:   // (credential_unavailable) — the gateway never fakes authorization.
253:   const broker = applyBroker(ctx, {
254:     mode: 'gateway',
255:     credentialsFile: opts.broker?.credentialsFile ?? process.env.AGENT_CORE_CREDENTIALS_FILE,
256:     authServiceOrigin: opts.broker?.authServiceOrigin ?? process.env.BROKER_AUTH_ORIGIN,
257:   })
```

## `f5a530ef7f0b` `packages/production-runtime/src/v2-ingress-gate.js`

Whole blob SHA-256: `06d9c0c62cefedad46ccbb726e2f3e81313ccee5e358034ca3b413662679edd1`.
```text
71:   return async function v2PreboundIngressGate(ingress) {
72:     const conversationId = ingress?.conversationId
73:     const ccId = router.channelConversationId(V2_INGRESS_CHANNEL, conversationId)
74:     const binding = router.getBinding(ccId)
75:
76:     if (binding === undefined) {
77:       log?.warn?.(`[v2-ingress-gate] unbound conversation ${ccId} -> FAIL CLOSED (no default binding created)`)
78:       return { allowed: false, reason: 'unbound', channelConversationId: ccId }
79:     }
80:
81:     if (binding.workspace !== null && binding.workspace !== undefined) {
82:       const primaryPath = workspaceBootstrap.resolveWorkspace(binding.activeAgentId)
83:       const boundPath = workspaceBootstrap.resolveWorkspacePath(binding.workspace)
84:       if (boundPath !== primaryPath) {
85:         log?.warn?.(`[v2-ingress-gate] ${ccId} carries a non-primary Binding.workspace (${binding.workspace}) -> transitional compatibility state, blocked from the V2 normal path`)
86:         return { allowed: false, reason: 'non_primary_workspace', channelConversationId: ccId }
87:       }
88:     }
89:
90:     return { allowed: true, reason: 'prebound', channelConversationId: ccId }
```

## `f5a530ef7f0b` `packages/feishu-connector/src/core.js`

Whole blob SHA-256: `de3e8d828715e702a34ec7d57cd76d1d83ac83d3a5d4833360bb7e74a6bdaed7`.
```text
694: export const INGRESS_GATE_REJECTED_REPLY =
695:   '[agent-core] 该会话未完成绑定（not bound）：消息未送达任何 Agent，也未创建任何绑定。请联系管理员完成会话与 Agent 的预绑定。'
739:     // V2 pre-forward gate: after classify decided forward, BEFORE onEvent.
740:     if (typeof config.ingressGate === 'function') {
741:       let gateVerdict
742:       try {
743:         gateVerdict = await config.ingressGate(ingress, { classify: cls })
744:       } catch (error) {
745:         log('warn', `[feishu] ingress gate error (fail closed): ${error?.message ?? error}`)
746:         gateVerdict = { allowed: false, reason: 'gate_error' }
747:       }
748:       if (gateVerdict?.allowed === false) {
749:         log('warn', `[feishu] ingress rejected by gate (${gateVerdict.reason ?? 'unspecified'}) — not forwarded`)
750:         if (typeof reply === 'function') {
751:           try {
752:             await reply(ingress)
753:           } catch (error) {
754:             log('warn', `[feishu] rejection receipt failed: ${error?.message ?? error}`)
755:           }
756:         }
757:         return
```

## `f5a530ef7f0b` `packages/agent-router/src/index.js`

Whole blob SHA-256: `b2821bb15ff529a51c3a58404ad46a42a445a89d33576ffae81adf2163ec8285`.
```text
499:   function assertRunnable(agentId) {
500:     const defined = agentDefinition.getAgent(agentId) // throws AGENT_NOT_FOUND when unknown
501:     if (defined.disabled === true) {
502:       throw Object.assign(new Error(`agent-router: agent ${agentId} is disabled (not runnable)`), { code: 'AGENT_DISABLED' })
503:     }
504:   }
505:
506:   /** Find-or-start the agent's DSH process; never returns a dead one. */
507:   async function ensureRunning(agentId) {
508:     // Unified runnability enforcement FIRST: unknown / disabled -> structured
509:     // rejection -> NEVER spawn. Do NOT insert an await before the spawn
510:     // section (see the audit-round-3 double-spawn invariant below).
581:     proc.onRpcRequest = async (method, params) => {
582:       if (method === BROKER_RPC_METHOD) {
583:         // TRUSTED CREDENTIAL BROKER: the caller identity is THIS proc's
584:         // actual agentId (the trusted spawning relationship) — never
585:         // anything the child says. Forged self-reported fields are ignored.
586:         const selfReported = ['agentId', 'principalId', 'clientId', 'scope', 'audience', 'authorization']
587:           .filter((field) => params?.[field] !== undefined)
588:         if (selfReported.length > 0) {
589:           log.log(`[broker] agent ${agentId}: IGNORING child-supplied identity fields: ${selfReported.join(', ')}`)
590:         }
591:         const gateway = ctx.get('brokerGateway')
592:         if (gateway === undefined || typeof gateway.execute !== 'function') {
593:           return {
594:             ok: true,
595:             result: { ok: false, error: { code: 'invalid_arguments', detail: 'broker gateway unavailable in the control plane' } },
596:           }
597:         }
598:         log.log(`[broker] execute as agent ${agentId} (capability ${params?.capabilityId})`)
599:         // Transport envelope {ok:true, result:<invoke shape>}: the child's
600:         // relay unwraps it; failures stay STRUCTURED (the parent-RPC failure
601:         // channel only carries a message string, so the business envelope is
602:         // always delivered inside the success envelope).
603:         return {
604:           ok: true,
605:           result: await gateway.execute(
606:             { capabilityId: params?.capabilityId, operation: params?.operation, args: params?.args },
607:             { agentId }, // ACTUAL identity — decided here, never from params
608:           ),
609:         }
610:       }
833:     registrySnapshot: () => [...registry.entries()].map(([agentId, proc]) => ({
834:       agentId,
835:       pid: proc.pid,
836:       alive: proc.exit === undefined,
837:       home: proc.home,
838:       workspace: proc.workspace,
839:       profile: proc.profile,
840:       sessions: proc.creations.map(c => ({ ...c })),
841:     })),
842:     /** Test/ops surface: durable Binding table snapshot. */
843:     bindingsSnapshot: () => store.list(),
```

## `f5a530ef7f0b` `packages/agent-definition/src/definition.js`

Whole blob SHA-256: `2a74147bbd89c0582038bfbb32c658c1667b92ae9790dff9e838a9c219b400a1`.
```text
373:   resolveAgentRef(ref) {
374:     if (typeof ref !== 'string' || ref.trim() === '') {
375:       throw new TypeError('agent-definition: ref must be a non-empty string')
376:     }
377:     const exact = this.agents.find((agent) => agent.id === ref)
378:     if (exact !== undefined && !exact.disabled) return { ...exact }
379:     const wanted = ref.trim().toLowerCase()
380:     const byName = this.agents.find((agent) => agent.name.toLowerCase() === wanted)
381:     if (byName === undefined || byName.disabled) {
382:       throw Object.assign(new Error(`agent-definition: agent not found: ${ref}`), { code: AGENT_NOT_FOUND })
383:     }
384:     return { ...byName }
```

## `f5a530ef7f0b` `packages/broker/src/gateway.js`

Whole blob SHA-256: `e4f03a3a630cd79e598a55f01f4fae8a2252b9f79c3d63a128ddfb4cda257985`.
```text
130:   async function execute(call, { agentId }) {
131:     const manifest = byCapability.get(call?.capabilityId)
132:     if (manifest === undefined) {
133:       return { ok: false, error: { code: 'unsupported_operation', detail: `capability not served by the gateway: ${call?.capabilityId}` } }
134:     }
135:     const isLocal = manifest.local !== undefined
136:     const operation = call?.operation
137:     const localHandlersNow = handlersForCall()
138:     if (isLocal && (typeof operation !== 'string' || localHandlersNow[manifest.id]?.[operation] === undefined)) {
139:       return { ok: false, error: { code: 'unsupported_operation', detail: `operation not served by the gateway: ${manifest.id}.${operation}` } }
140:     }
141:     if (!Array.isArray(manifest.operations)) {
142:       return { ok: false, error: { code: 'unsupported_operation', detail: `capability has no operations: ${manifest.id}` } }
143:     }
144:     if (!isLocal && !manifest.operations.some((o) => o && o.http)) {
145:       return { ok: false, error: { code: 'unsupported_operation', detail: `capability not served by the gateway: ${manifest.id}` } }
146:     }
147:     let credential
148:     try {
149:       credential = loadCredentialFor(credentialsFile, agentId)
150:     } catch (error) {
151:       // A broken credential store must never crash the parent RPC; fail the
152:       // call closed with the store error detail (never the secret).
153:       log(`[broker-gateway] credential store error for agent ${agentId}: ${error?.message ?? error}`)
154:       return { ok: false, error: { code: 'credential_unavailable', detail: error?.message ?? 'credential store error' } }
155:     }
156:     if (credential === undefined) {
157:       log(`[broker-gateway] agent ${agentId}: no credential bound (fails closed)`)
158:       return { ok: false, error: { code: 'credential_unavailable', detail: `no MachineClient credential bound to agent ${agentId}` } }
159:     }
160:
161:     // ── LOCAL (in-process) capability: optional Auth-grant check, then the
162:     //    injected handler. No HTTP downstream exists. ─────────────────────
163:     if (isLocal) {
164:       const requiredScopes = Array.isArray(manifest.requiredScopes) ? manifest.requiredScopes : []
165:       if (requiredScopes.length > 0) {
166:         // The Auth grant check: obtain a token for the required scopes. The
167:         // auth-service decides per credential; any failure is a DENIAL.
168:         const resource = manifest.local?.resource
169:         if (typeof resource !== 'string' || resource === '') {
170:           return { ok: false, error: { code: 'access_denied', detail: `local capability ${manifest.id} declares requiredScopes without a local resource` } }
171:         }
172:         try {
173:           await requestAccessToken({
174:             credential,
175:             authServiceOrigin,
176:             resource,
177:             scope: requiredScopes.join(' '),
178:           })
179:         } catch (error) {
180:           log(`[broker-gateway] agent ${agentId}: ${manifest.id} grant denied: ${error?.message ?? error}`)
181:           return {
182:             ok: false,
183:             error: { code: 'access_denied', detail: `grant for ${requiredScopes.join(' ')} not available to this agent` },
184:           }
```

## `f5a530ef7f0b` `packages/broker/src/transport.js`

Whole blob SHA-256: `a461b4d422a86e5fab228ef295e8cc24c8629f3ccfd07c94ec5fa3250a17988b`.
```text
95:   try {
96:     res = await fetchImpl(`${authServiceOrigin}${TOKEN_ENDPOINT_PATH}`, {
97:       method: 'POST',
98:       headers: {
99:         Authorization: `Basic ${basic}`,
100:         'Content-Type': 'application/x-www-form-urlencoded',
101:         Accept: 'application/json',
102:       },
103:       body: body.toString(),
104:       signal: AbortSignal.timeout(timeoutMs),
105:     })
106:   } catch (err) {
107:     throw new Error(`token endpoint unreachable: ${err.message}`)
108:   }
109:   if (!res.ok) {
110:     const text = await res.text().catch(() => '(no body)')
111:     throw new Error(`token endpoint returned ${res.status}: ${text}`)
112:   }
113:   let data
114:   try {
115:     data = await res.json()
116:   } catch {
117:     throw new Error('token endpoint returned a malformed JSON body')
118:   }
119:   if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
120:     throw new Error('token response missing access_token')
```

## `20e60dd72a42` `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md`

Whole blob SHA-256: `2fcfaa333e48bcbe276e6dd6d2043fef784b6ddfd42c68ec7fd642a3d787b3d3`.
```text
3: - 状态: accepted（2026-09-01；**standalone Current Authority**；整份取代 D-006 / V2）
4: - decision id: `D-008`
5: - 日期: 2026-08-31
6: - 类型: 正式决策（完整 Current Decision，不是 V2 §11 amendment）
7: - 范围: 只改 Decision/docs（PRODUCT_CODE_CHANGE = NONE / PRODUCTION_CHANGE = NONE /
8:   RUNTIME_CHANGE = NONE / ROUTER_CHANGE = NONE / BROKER_CHANGE = NONE /
9:   SCHEDULER_CHANGE = NONE / WORKFLOW_CHANGE = NONE / MIGRATION = NONE /
10:   KERNEL_CHANGE = NONE / DEPLOYMENT = NONE）
11: - fresh authoring base: `mayf3/dsh-agent-core origin/main@1a9b81de19c2bf4af01f62f6189acffc1bb6839d`
12: - base current decision: `D-006` / `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`（accepted）
13:   blob `c991010712f4c3a9b826bb38eac16189691bcc3f`
14: - supersedes: `D-006` / `AGENT_WORKSPACE_SESSION_MODEL_V2`（整份；acceptance transaction
15:   已同步将 D-006 标记为 superseded-by-D-008）
16: - Acceptance provenance: reviewed head
17:   `70bd5b2ed064a19f3e99a58e2454c3172c512bf9`；`模型 审计 = PASS`；
18:   `BLOCKER/HIGH/MEDIUM = 0/0/0`；`SEMANTIC_DELTA_AFTER_REVIEW = NONE`；
19:   accepted by Owner `mayf3` at `2026-08-31T21:56:51Z`。
32: ```text
33: Feishu Conversation
34: → first eligible human message creates one Agent
35: → fixed association
```

## `20e60dd72a42` `docs/specs/AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1.md`

Whole blob SHA-256: `d8244bd4b44e8f75c8554cc82506f6800309236574b05f105c1a3c592e4ecf0e`.
```text
1: ---
2: spec_id: AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1
3: status: proposed-candidate
4: spec_kind: bounded_child_supply_spec
5: authority_level: governing_child_spec_pending_acceptance
6: implementation_authority: none_until_accepted
7: production_apply_authority: none
8: proposed_approval_ref_label: OWNER-CANONICAL-ONBOARDING-20260909-01
9: proposed_approval_ref_label_note: "LABEL PROPOSAL ONLY — 生效需 Owner 显式接受；在此之前本 ref 不构成任何 Owner authorization"
10: authorizing_context: OWNER CONTINUE_SAME_GOAL ruling（2026-09-09）：IDENTITY_LIFECYCLE_OWNER=mayf3/dsh-agent-core；PRIMARY_IDENTITY_AUTHORITY=AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1；PREFLIGHT 判定按本文件 §2；PRODUCTION_OPERATION_AUTHORIZED=NO
29: ## 0. AUTHORITY STATUS（三分，owner ruling 2026-09-09 固定）
30:
31: ```text
32: SPEC_STATUS                     = PROPOSED_CANDIDATE（待独立评审 + Owner acceptance）
33: IMPLEMENTATION_STATUS           = COMPLETE_CANDIDATE（PR #234；candidate 架构方向已被 Owner 接受，
34:                                   非 production 基线）
35: PRODUCTION_OPERATION_AUTHORIZED = NO
36: proposed_approval_ref_label     = OWNER-CANONICAL-ONBOARDING-20260909-01（仅为 label 提案，
37:                                   Owner 接受前不构成任何 authorization；实现 Agent 不得自行生成或
38:                                   宣称有效 approvalRef）
39: ```
40:
41: Owner acceptance 前禁止：production migration、真实 canary 创建、credential-store
42: mutation、任何 production onboarding execution。
64: - 现有 accepted spec 均未定义 "definition + identity-ready + mandatory baseline
65:   entitlements = onboarding 完成"：credential provisioning spec 只定义身份语义；
66:   AGENT_DEFINITION_ACCESS_V1 只定义定义变更。本 contract 因此以 **bounded child
67:   authority** 形式落在 dsh-agent-core（不 AMEND 任何 accepted 父 spec 的冻结项，
68:   不在 personal-cognition-audit 持有 authority，不把 Agent lifecycle 反向放进
69:   auth-service，不建 Workbench 专用 onboarding spec，不建 IAM/policy framework）。
```

## `20e60dd72a42` `packages/agent-credential-provisioning/src/index.js`

Whole blob SHA-256: `9fea68765761634bf13b13a6bedc273febaca3c4d92e773100c858264063d3e1`.
```text
106:  * explicitly establishes prerequisite (c). Existing credentials (store entry
107:  * present, or an Auth client already holding the deterministic external_ref)
108:  * fail loud as existing_credential_resolution_required — their reconciliation
109:  * is Phase B and is deliberately not implemented here.
110:  */
111: export async function ensureAgentCredential({
112:   agentId,
113:   agentDefinitionFile,
114:   credentialsFile,
115:   auth,
116:   prerequisites = {},
117:   storeWriteOptions,
118:   verification = {
119:     mode: AUTH_CONTRACT_MODES.v1,
120:     resource: 'svc-forum',
121:     scope: 'forum.read',
122:     validDeployedAudience: true,
123:     prerequisiteDReady: false,
124:   },
125: }) {
126:   // D.7.1 steps 1-2: Agent Definition read; State A precedes every store/Auth step.
```

## `20e60dd72a42` `packages/agent-definition/src/access.js`

Whole blob SHA-256: `0cf284aa9c61f3dba1edf861c0929e13c857831e9a13a4d678f003ee5606f210`.
```text
84:   /** WRITE — allowed only when the broker gateway obtained the scope grant. */
85:   const write = {
86:     /** create {name, description?} -> mint one stable agt_* id, persist. */
87:     async create(args) {
88:       try {
89:         const name = validateString(args?.name, 'name')
90:         const agent = await createAgentInConfig(configFile, { name, description: args?.description ?? null })
91:         refresh()
92:         return { ok: true, result: { agent } }
93:       } catch (error) {
94:         if (error?.code === ACCESS_ERROR_CODES.INVALID_ARGUMENTS) return err(ACCESS_ERROR_CODES.INVALID_ARGUMENTS, error.message)
95:         if (error?.code === 'VALIDATION_ERROR') return err(ACCESS_ERROR_CODES.VALIDATION_ERROR, error.message)
96:         throw error
97:       }
```

## `20e60dd72a42` `scripts/canonical-onboarding-lib.mjs`

Whole blob SHA-256: `b61923ffb3c6262c533ddb8b1af0a6d1388a1b85e8fed8e82fed720dc8d90215`.
```text
202: /** Read-only onboarding-state classification (no mutation, no Auth calls). */
203: export async function classifyOnboardingState(deps, { agentId, authorityFile, storeFile, storeWriteOwner }) {
204:   const doc = readDefinition(authorityFile)
205:   const inAuthority = doc !== undefined && doc.agents.some((agent) => agent.id === agentId)
206:   const disabled = inAuthority ? doc.agents.find((agent) => agent.id === agentId).disabled === true : null
207:   let storeEntry = 'unreadable'
208:   if (inAuthority && !disabled) {
209:     const store = await deps.readCredentialStoreDocument(storeFile, storeWriteOwner)
210:     storeEntry = classifyStoreEntry(store, agentId) === 'absent' ? 'absent' : 'present'
211:   }
212:   const state = !inAuthority ? 'NOT_IN_AUTHORITY'
213:     : disabled ? 'DEFINITION_DISABLED'
214:     : storeEntry === 'absent' ? 'IDENTITY_PENDING'
215:     : 'IDENTITY_READY_OR_LATER'
216:   return { agentId, inAuthority, disabled, storeEntry, state }
```

## `20e60dd72a42` `packages/broker/src/credential-store.js`

Whole blob SHA-256: `4bc68707b98fb436155ebb3a3aa229ab2afcc388ac7e71660f752f2795b13ac0`.
```text
135: /**
136:  * Resolve REDACTED credential METADATA for ONE agent id — the fleet-inventory
137:  * seam (AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1). Answers only whether
138:  * the canonical trusted store has an entry for the EXACT agent id and, when
139:  * present, that entry's non-secret clientId. This is the ONLY sanctioned way
140:  * for trusted inventory to ask presence: it must NOT call loadCredentialFor()
141:  * and receive clientSecret merely to discard it.
142:  *
143:  * The exported seam takes EXACTLY ONE business input: the agentId. The
144:  * credential store path comes solely from the trusted-parent process
145:  * configuration authority (AGENT_CORE_CREDENTIALS_FILE of the authsvc/uid505
146:  * control-plane process) — a child Agent, model tool, child RPC, UI, or any
147:  * other caller CANNOT supply or select a store path: there is no such
148:  * parameter, and the path is re-read from the environment on every call.
149:  *
150:  * Trusted-parent ONLY — the same authsvc/uid505 credential boundary as
151:  * loadCredentialFor: never reachable by a child Agent, model tool, child
152:  * RPC, or UI.
153:  *
154:  * Semantics:
155:  *   - the agent id is validated FIRST by the Agent Definition authority's
156:  *     own validator (single id-grammar authority; no local fallback): every
157:  *     invalid, empty, or path/traversal-shaped id fails LOUD before ANY
158:  *     store path operation or read (STORE_ACCESS_COUNT = 0);
159:  *   - an unconfigured store or an absent exact key -> { entry: 'ABSENT' }
160:  *     (clientId omitted, never null/empty);
161:  *   - a valid entry -> { entry: 'PRESENT', clientId } — a freshly built
162:  *     closed object: the secret-bearing normalized entry never leaves this
163:  *     boundary, and no other key can appear in the result;
164:  *   - a configured store that is missing, unreadable, malformed,
165:  *     unsupported-version, or carries any malformed entry throws the stable
166:  *     CREDENTIALS_STORE_ERROR family — broken trusted state never
167:  *     masquerades as ABSENT;
168:  *   - strictly read-only: no write, chmod, chown, rename, or repair; emits
169:  *     no log, metric, report, stdout, or stderr of its own.
170:  *
171:  * PRESENCE is local-store metadata only: it says nothing about Auth client
172:  * existence/validity, principal binding, grants, or token mintability.
```

## On-disk artifact `/usr/local/libexec/agent-core/app/packages/production-runtime/src/compose.js`

Whole file SHA-256: `27ccc2bde3c123c55805e2fcee32686e5c7dee15fb8331112f83ae9f572d9ffe`. Loaded version UNKNOWN.
```text
290:   // V2 PREBOUND_ONLY Feishu ingress gate (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
291:   // §4.5/§5.5): composition-layer product wiring over the Router's GENERIC
292:   // read APIs only (getBinding + channelConversationId — zero Router change,
293:   // zero Feishu special-case in the Router). Unknown/unbound conversations
294:   // fail closed BEFORE the Router's first-contact path (no default Binding);
295:   // non-primary Binding.workspace compatibility rows stay on disk but are
296:   // blocked from the V2 normal path.
297:   const wired = feishu !== undefined
298:     ? wireV2IngressGate(feishu, router, ctx.get('workspaceBootstrap'), log)
299:     : false
300:   if (feishu !== undefined) {
301:     if (!wired) throw new Error('production-runtime: feishu connector handle does not expose setIngressGate (V2 ingress gate cannot be wired — fail loud, never run un-gated)')
302:     log.log(`feishu ingress gate wired (${V2_INGRESS_MODE}: pre-bound primary-workspace conversations only)`)
303:     // FIRST_HANDSHAKE_AWAIT (AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 §9):
304:     // declare the channel live only after the SDK handshake and bot identity
305:     // both resolve. The gate is wired first, so ingress remains fail-closed
306:     // throughout startup; readiness rejection fails runtime composition loud.
307:     await feishu.ready()
308:     log.log('feishu channel live (first handshake + bot identity resolved)')
311:   // Trusted CP seam: gateway mode always mounted; the credential store path
312:   // and auth origin arrive via env from the supervision unit. Without a
313:   // credentials file every capability call fails closed
314:   // (credential_unavailable) — the gateway never fakes authorization.
315:   // AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R12: the L0 pre-handler denial
316:   // hook is scoped to exactly the agent_session_send capability; a failed
317:   // denial append never changes the denial itself.
318:   const agentSessionRuntime = createAgentSessionRuntime({ layout, definition, workspaceBootstrap, router, log })
319:   const broker = applyBroker(ctx, {
320:     mode: 'gateway',
321:     credentialsFile: opts.broker?.credentialsFile ?? process.env.AGENT_CORE_CREDENTIALS_FILE,
322:     authServiceOrigin: opts.broker?.authServiceOrigin ?? process.env.BROKER_AUTH_ORIGIN,
323:     auditDenial: agentSessionRuntime.auditDenial,
324:   })
```

## On-disk artifact `/usr/local/libexec/agent-core/app/packages/production-runtime/src/v2-ingress-gate.js`

Whole file SHA-256: `06d9c0c62cefedad46ccbb726e2f3e81313ccee5e358034ca3b413662679edd1`. Loaded version UNKNOWN.
```text
71:   return async function v2PreboundIngressGate(ingress) {
72:     const conversationId = ingress?.conversationId
73:     const ccId = router.channelConversationId(V2_INGRESS_CHANNEL, conversationId)
74:     const binding = router.getBinding(ccId)
75:
76:     if (binding === undefined) {
77:       log?.warn?.(`[v2-ingress-gate] unbound conversation ${ccId} -> FAIL CLOSED (no default binding created)`)
78:       return { allowed: false, reason: 'unbound', channelConversationId: ccId }
79:     }
80:
81:     if (binding.workspace !== null && binding.workspace !== undefined) {
82:       const primaryPath = workspaceBootstrap.resolveWorkspace(binding.activeAgentId)
83:       const boundPath = workspaceBootstrap.resolveWorkspacePath(binding.workspace)
84:       if (boundPath !== primaryPath) {
85:         log?.warn?.(`[v2-ingress-gate] ${ccId} carries a non-primary Binding.workspace (${binding.workspace}) -> transitional compatibility state, blocked from the V2 normal path`)
86:         return { allowed: false, reason: 'non_primary_workspace', channelConversationId: ccId }
87:       }
88:     }
89:
90:     return { allowed: true, reason: 'prebound', channelConversationId: ccId }
```

## On-disk artifact `/usr/local/libexec/agent-core/app/packages/agent-definition/src/access.js`

Whole file SHA-256: `0cf284aa9c61f3dba1edf861c0929e13c857831e9a13a4d678f003ee5606f210`. Loaded version UNKNOWN.
```text
84:   /** WRITE — allowed only when the broker gateway obtained the scope grant. */
85:   const write = {
86:     /** create {name, description?} -> mint one stable agt_* id, persist. */
87:     async create(args) {
88:       try {
89:         const name = validateString(args?.name, 'name')
90:         const agent = await createAgentInConfig(configFile, { name, description: args?.description ?? null })
91:         refresh()
92:         return { ok: true, result: { agent } }
93:       } catch (error) {
94:         if (error?.code === ACCESS_ERROR_CODES.INVALID_ARGUMENTS) return err(ACCESS_ERROR_CODES.INVALID_ARGUMENTS, error.message)
95:         if (error?.code === 'VALIDATION_ERROR') return err(ACCESS_ERROR_CODES.VALIDATION_ERROR, error.message)
96:         throw error
97:       }
```

## On-disk artifact `/usr/local/libexec/agent-core/app/packages/agent-credential-provisioning/src/index.js`

Whole file SHA-256: `84a5b2764f24de2828aebdd02ac788c1c506247796cd6adfff520ee2fa78767d`. Loaded version UNKNOWN.
```text
106:  * explicitly establishes prerequisite (c). Existing credentials (store entry
107:  * present, or an Auth client already holding the deterministic external_ref)
108:  * fail loud as existing_credential_resolution_required — their reconciliation
109:  * is Phase B and is deliberately not implemented here.
110:  */
111: export async function ensureAgentCredential({
112:   agentId,
113:   agentDefinitionFile,
114:   credentialsFile,
115:   auth,
116:   prerequisites = {},
117:   storeWriteOptions,
118:   verification = {
119:     mode: AUTH_CONTRACT_MODES.v1,
120:     resource: 'svc-forum',
121:     scope: 'forum.read',
122:     validDeployedAudience: true,
123:     prerequisiteDReady: false,
124:   },
125: }) {
126:   // D.7.1 steps 1-2: Agent Definition read; State A precedes every store/Auth step.
```
