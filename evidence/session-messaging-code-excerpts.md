# session-messaging-code-excerpts — verbatim evidence (BASE 840d2f4)

All paths relative to the worktree root at BASE `840d2f4ad91f8252eb1f163330c041216a0dd9c4`. Excerpts are verbatim; line numbers from the worktree files.

## E1. relay.js — local capabilities DO get relay handlers at BASE (finding F8)

`packages/broker/src/relay.js:148-156`:
```js
export function createRelayHandlers(manifest, requestFn) {
  const handlers = {}
  // LOCAL (in-process) capabilities relay exactly like HTTP-bound ones: the
  // parent's gateway executes them and answers in the same envelope shape,
  // so the child-side wire result is identical either way.
  const isLocalManifest = manifest?.local !== undefined
  for (const op of manifest.operations) {
    if (!op.http && !isLocalManifest) continue
```

## E2. broker index.js — child-mode local relay routing (F8)

`packages/broker/src/index.js:301-309`:
```js
  const capabilities = manifests.map((manifest) => {
    const id = manifest && typeof manifest.id === 'string' ? manifest.id : ''
    const hasHttp = Array.isArray(manifest.operations) && manifest.operations.some((o) => o && o.http)
    // LOCAL capabilities (agent.definition.*) also RELAY to the trusted
    // parent in child mode — they execute in-process in the gateway.
    const relays = hasHttp || manifest?.local !== undefined
    // HTTP/local capabilities RELAY to the trusted parent; process-internal
    // capabilities (calculator) stay local — they need no credential.
    const handlers = relays ? createRelayHandlers(manifest, requestFn) : handlersByCapability[id] ?? {}
```

## E3. broker index.js — localHandlerResolver: execute-time CLOSED two-service merge (F9, G3)

`packages/broker/src/index.js:264-277`:
```js
    const gateway = createBrokerGateway({
      manifests,
      targets,
      authServiceOrigin,
      credentialsFile: config.credentialsFile,
      // LOCAL capability handlers are injected by the control-plane
      // composition and resolved at EXECUTE time (sibling services are
      // concurrent-loaded; reading them at APPLY time would race).
      localHandlerResolver: () => ({
        ...(ctx.get('agentDefinitionAccess')?.handlers ?? {}),
        ...(ctx.get('selfServiceSchedulerAccess')?.handlers ?? {}),
      }),
```

## E4. gateway.js — execute order: handler resolution → credential → grant → handler (F14, F22, F23)

`packages/broker/src/gateway.js:168-181` (fail-closed handler resolution):
```js
    const isLocal = manifest.local !== undefined
    const operation = call?.operation
    const localHandlersNow = handlersForCall()
    const localHandler = isLocal ? localHandlerFor(localHandlersNow, manifest, operation) : undefined
    if (isLocal && (typeof operation !== 'string' || localHandler === undefined)) {
      return { ok: false, error: { code: 'unsupported_operation', detail: `operation not served by the gateway: ${manifest.id}.${operation}` } }
    }
```

`packages/broker/src/gateway.js:186-192` (authoritative re-validation is scheduler-only, F13):
```js
    let localArgs = manifest.id === 'scheduler' ? call?.args : (call?.args ?? {})
    if (manifest.id === 'scheduler') {
      // This is the authoritative boundary: a child can bypass its own tool
      // mapper and call parent RPC directly, so repeat exact validation here
      // before credential, grant, handler, or store access.
      const validated = validateInvocation(manifest, { operation, args: localArgs })
      if (!validated.ok) return validated
```

`packages/broker/src/gateway.js:209-221` (credential fail-closed):
```js
    let credential
    try {
      credential = loadCredentialFor(credentialsFile, agentId)
    } catch (error) {
      // A broken credential store must never crash the parent RPC; fail the
      // call closed with the store error detail (never the secret).
      log(`[broker-gateway] credential store error for agent ${agentId}: ${error?.message ?? error}`)
      return { ok: false, error: { code: 'credential_unavailable', detail: error?.message ?? 'credential store error' } }
    }
    if (credential === undefined) {
      log(`[broker-gateway] agent ${agentId}: no credential bound (fails closed)`)
      return { ok: false, error: { code: 'credential_unavailable', detail: `no MachineClient credential bound to agent ${agentId}` } }
    }
```

`packages/broker/src/gateway.js:225-258` (grant check before handler; handler gets frozen parent-owned context):
```js
    if (isLocal) {
      const requiredScopes = Array.isArray(manifest.requiredScopes) ? manifest.requiredScopes : []
      if (requiredScopes.length > 0) {
        // The Auth grant check: obtain a token for the required scopes. The
        // auth-service decides per credential; any failure is a DENIAL.
        const resource = manifest.local?.resource
        if (typeof resource !== 'string' || resource === '') {
          return { ok: false, error: { code: 'access_denied', detail: `local capability ${manifest.id} declares requiredScopes without a local resource` } }
        }
        try {
          await requestAccessToken({
            credential,
            authServiceOrigin,
            resource,
            scope: requiredScopes.join(' '),
          })
        } catch (error) {
          log(`[broker-gateway] agent ${agentId}: ${manifest.id} grant denied: ${error?.message ?? error}`)
          return {
            ok: false,
            error: {
              code: error?.errorCode === 'credential_invalid' ? 'credential_invalid'
                : error?.errorCode === 'transport_failure' ? 'transport_failure'
                  : 'access_denied',
              detail: `grant for ${requiredScopes.join(' ')} not available to this agent`,
            },
          }
        }
      }
      try {
        // Forward the Parent-owned invocation context, not anything from args.
        // `agentId`/`callerAgentId` are overwritten from the actual gateway
        // caller relationship and the snapshot is immutable for the handler.
        return await localHandler(localArgs, trustedContext)
```

`packages/broker/src/gateway.js:182`:
```js
    let trustedContext = Object.freeze({ ...context, agentId, callerAgentId: agentId })
```

## E5. parent-rpc-relay.js — caller from spawning relationship; exact source-turn proof; deliver-source gap (F14, F15)

`packages/agent-router/src/parent-rpc-relay.js:40-63`:
```js
    if (method === BROKER_RPC_METHOD) {
      // TRUSTED CREDENTIAL BROKER: the caller identity is THIS proc's
      // actual agentId (the trusted spawning relationship) — never
      // anything the child says. Forged self-reported fields are ignored.
      const selfReported = [
        'agentId', 'callerAgentId', 'principalId', 'clientId', 'scope', 'audience', 'authorization',
        'processGeneration', 'turnExecutionId', 'channelNamespace', 'channelConversationId',
        'feishuChatId', 'feishuConversationId', 'feishuMessageId',
        'ingressContext', 'activeIngressContext',
      ].filter((field) => params?.[field] !== undefined)
      if (selfReported.length > 0) {
        log.log(`[broker] agent ${agentId}: IGNORING child-supplied identity fields: ${selfReported.join(', ')}`)
      }
      const proc = getProc()
      const active = proc.activeIngressContext
      const activeExecution = active && proc.executions?.get(active.turnExecutionId)
      const boundIngressContext = active
        && active.callerAgentId === agentId
        && active.processGeneration === proc.processGeneration
        && rpcMeta.turnExecutionId === active.turnExecutionId
        && activeExecution !== undefined
        && activeExecution.settled !== true
        ? active
        : undefined
```

## E6. turn-execution.js — bounded shared FIFO; handle mint; turn-only ingress context; receipt-only resolve; prompt payload (F4, F7, F15, F17)

`packages/agent-router/src/process/turn-execution.js:142-151`:
```js
      // B05 / C-013: every prompt-producing path shares this one bounded
      // admission queue. Receipt-only delivery may resolve its caller early,
      // but it retains queue ownership until terminal or outcome_unknown.
      if (this.turnQueueEntries.length >= PROCESS_EVIDENCE_CAPS.MAX_QUEUED_TURNS_PER_PROCESS
          || this.queuedPromptBytes + promptBytes > PROCESS_EVIDENCE_CAPS.MAX_QUEUED_PROMPT_BYTES_PER_PROCESS) {
        reject(envelopeCarrier('not_admitted', null, 'AGENT_PROCESS_QUEUE_CAP',
          `agent ${this.agentId}: queued prompt caps exceeded (${this.turnQueueEntries.length} entries / ${this.queuedPromptBytes}B)`))
        return
      }
```

`packages/agent-router/src/process/turn-execution.js:215-236`:
```js
      // C-010: handle minted by the Router reconciliation store BEFORE the
      // watermark and any prompt bytes; capacity fails loud pre-reservation.
      handle = this.store.mintTurnExecution({
        agentId: this.agentId,
        processGeneration: this.processGeneration,
        sessionId,
        callerCorrelation: opts?.callerCorrelation ?? null,
      })
```
```js
    execution.promptRequestId = `req-${this.processGeneration}-${this.seq + 1}`
```

`packages/agent-router/src/process/turn-execution.js:255-271` (activeIngressContext installed ONLY for mode 'turn'):
```js
    if (mode === 'turn') {
      const ingress = opts?.ingressContext
      // CTR-CTX-001: identity comes only from this Router-owned process and
      // the handle minted for THIS execution. Copy only the allowlisted
      // ingress leaves so queued callers cannot mutate or inject identity.
      this.activeIngressContext = Object.freeze({
        callerAgentId: this.agentId,
        processGeneration: this.processGeneration,
        turnExecutionId: handle,
```

`packages/agent-router/src/process/turn-execution.js:276-292` (receipt-only resolve):
```js
      const receipt = await this.promptWrite(execution, sessionId, text, opts)
      execution.promptMs = Date.now() - startedWall
      if (!execution.settled) execution.phase = 'running'
      if (mode === 'deliver') {
        // Receipt-only: the caller returns now; the execution keeps its
        // terminal/unknown fence tracking in the background (C-010).
        resolve({
          accepted: true,
          sessionId,
          messageId: execution.receiptMessageId,
          ms: Date.now() - startedWall,
          reconciliationHandle: handle,
          evidence: execution.evidenceSnapshot(),
        })
```

`packages/agent-router/src/process/turn-execution.js:316-336` (prompt payload: no source/provenance field):
```js
  async promptWrite(execution, sessionId, text, opts) {
    const receiptDeadlineMono = Math.min(execution.promptReceiptDeadlineMono, execution.turnDeadlineMono)
    const requestId = execution.promptRequestId
    const receipt = await this.request('session/prompt', {
      sessionId,
      contentBlocks: [{ type: 'text', text }],
      // Parent-minted protocol metadata, consumed by demo-server's private
      // agentRpc carrier and never exposed as model tool arguments.
      turnExecutionId: execution.handle,
      ...(opts?.cwd === undefined ? {} : { cwd: opts.cwd }),
    }, undefined, {
```

`packages/agent-router/src/process/turn-execution.js:84-95` (bounded tail truncation flag):
```js
  /** BOUNDED rule 10: incremental UTF-8-safe tail capture — never buffers the full output. */
  appendAssistantText(text) {
    if (typeof text !== 'string' || text === '') return
    const bytes = Buffer.byteLength(text, 'utf8')
    this.assistantOriginalBytes += bytes
    this.assistantSegments.push({ text, bytes })
    let kept = this.assistantSegments.reduce((sum, segment) => sum + segment.bytes, 0)
    while (kept > PROCESS_EVIDENCE_CAPS.MAX_FINAL_ASSISTANT_OUTPUT_BYTES && this.assistantSegments.length > 1) {
      const dropped = this.assistantSegments.shift()
      kept -= dropped.bytes
      this.assistantTruncated = true
    }
```

## E7. session-seam.js — reuse/resume/create single-flight; hardcoded user provenance (F2, F7)

`packages/demo-server/src/session-seam.js:77-91`:
```js
  async function getOrCreateSession(sessionId, resolvedCwd) {
    const effectiveCwd = resolvedCwd ?? settings.cwd
    const existing = handles.get(sessionId)
    if (existing !== undefined) {
      // Hot path: the live handle already froze this session's cwd at
      // creation/resume — a different resolved workspace is an R3 mismatch.
      assertSessionCwd(sessionId, existing, effectiveCwd)
      return existing
    }
    const inFlight = pendingCreations.get(sessionId)
    if (inFlight !== undefined) {
      const handle = await inFlight
      assertSessionCwd(sessionId, handle, effectiveCwd)
      return handle
    }
```

`packages/demo-server/src/session-seam.js:123-146`:
```js
      const headers = await persistence.list()
      const header = headers.find(item => item.id === id)
      if (header !== undefined) {
        // R2: resume restores the PERSISTED header (meta:{cwd} is never
        // passed on resume — DSH has no runtime cwd mutation semantics).
        handle = await agents.resume({ resumeSessionId: id, agentOptions })
```
```js
      if (!resumed) {
        // R1: the only creation contract — the effective workspace freezes
        // into the new session's header at create time.
        handle = await agents.create({ sessionId: id, meta: { cwd: effectiveCwd }, agentOptions })
      }
```

`packages/demo-server/src/session-seam.js:161-167`:
```js
  /** Queue one user prompt on a session, creating or resuming it first. */
  async function prompt(sessionId, contentBlocks, resolvedCwd) {
    const handle = await getOrCreateSession(sessionId, resolvedCwd)
    const message = createUserMessage({ content: contentBlocks, source: { kind: 'user' } })
    handle.agent.followup(message)
    return { messageId: message.id }
  }
```

## E8. ingress-delivery.js — deliver contract; sessionId rejection; fixed main (F1, F3, F21)

`packages/agent-router/src/ingress-delivery.js:208-230`:
```js
  async function deliver(req) {
    const requestId = req?.requestId
    const sessionMode = req?.sessionMode
    const message = req?.message
    if (typeof requestId !== 'string' || requestId === '') {
      throw new TypeError('agent-router: deliver requestId must be a non-empty string')
    }
    if (sessionMode !== 'main' && sessionMode !== 'fresh') {
      throw new TypeError(`agent-router: deliver sessionMode must be 'main' or 'fresh' (got ${JSON.stringify(sessionMode)})`)
    }
    if (typeof message !== 'string') {
      throw new TypeError('agent-router: deliver message must be a string')
    }
    if (req?.sessionId !== undefined) {
      // DELIVERY V0 boundary: the frozen interface has no sessionId. Reject
      // fail-loud (the same policy product-api applies to switchAgent) so no
      // caller can name or resume an arbitrary historical non-main session.
      throw new TypeError('agent-router: deliver has no sessionId field — the Router owns session selection (main | fresh-by-requestId)')
    }
```

`packages/agent-router/src/ingress-delivery.js:235-243`:
```js
    reconciliationStore.assertMintCapacity(agent.id)
```
```js
    const sessionId = sessionMode === 'main'
      ? 'main'
```

`packages/agent-router/src/ingress-delivery.js:264-268`:
```js
    const receipt = await routeChain.admitWithRouteChain(agent.id, {
      sessionId,
      message,
      opts: { cwd: workspacePath, callerCorrelation: { requestId } },
    })
```

## E9. reconciliation — output states; terminal vocabularies; subscriber (F5, F18, F19, F20)

`packages/agent-router/src/reconciliation/query.js:92-110`:
```js
  /**
   * Non-consuming output query (C-018):
   *   available {text,truncated,originalBytes,terminalState}
   *   | pending | no_output {terminalState}
   *   | evicted | restart_lost | never_existed
   */
  readFinalAssistantOutput(handle) {
    const classified = this.classifyHandle(handle)
    if (classified.record === undefined) return { state: classified.state }
    const record = classified.record
    if (record.state !== 'settled') return { state: 'pending' }
    const terminalState = record.lateOutcome ?? record.outcome
    if (record.finalAssistantOutput === null || record.finalAssistantOutput === undefined) {
      return { state: 'no_output', terminalState }
    }
    return {
      state: 'available',
      text: record.finalAssistantOutput.text,
      truncated: record.finalAssistantOutput.truncated === true,
      originalBytes: record.finalAssistantOutput.originalBytes,
      terminalState,
    }
  },
```

`packages/agent-router/src/reconciliation/query.js:149-153`:
```js
  /** At-most-once reconciliation notification subscriber (§13.2). */
  onTurnReconciled(listener) {
    if (typeof listener !== 'function') throw new TypeError('onTurnReconciled: listener function required')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  },
```

`packages/agent-router/src/reconciliation/state-machine.js:13-15`:
```js
export const LATE_OUTCOMES = Object.freeze(['late_completed', 'late_failed', 'terminated_without_outcome'])

export const DIRECT_OUTCOMES = Object.freeze(['completed', 'failed', 'not_admitted'])
```

## E10. Router service seams + evidence caps (F5, F6, F28)

`packages/agent-router/src/index.js:338-348`:
```js
    getTurnReconciliation: (handle) => reconciliationStore.getTurnReconciliation(handle),
    readFinalAssistantOutput: (handle) => reconciliationStore.readFinalAssistantOutput(handle),
    resolveCallerCorrelation: (triple) => reconciliationStore.resolveCallerCorrelation(triple),
    onTurnReconciled: (listener) => reconciliationStore.onTurnReconciled(listener),
    turnExecutionSnapshot: (turnExecutionId) => {
      const owner = registry.findOwningProcess(turnExecutionId)
      if (owner !== null && typeof owner.turnExecutionSnapshot === 'function') {
        return owner.turnExecutionSnapshot(turnExecutionId)
      }
      return reconciliationStore.getTurnReconciliation(turnExecutionId)
    },
```

`packages/agent-router/src/process/evidence-buffer.js:26-29`:
```js
  MAX_FINAL_ASSISTANT_OUTPUT_BYTES: 1048576,
  MAX_QUEUED_TURNS_PER_PROCESS: 64,
  MAX_QUEUED_PROMPT_BYTES_PER_PROCESS: 4194304,
  MAX_PROMPT_BYTES: 1048576,
```

## E11. demo-server parent-RPC carrier — turnExecutionId origin (F15)

`packages/demo-server/src/index.js:66-72, 88-91`:
```js
  // Parent mints one opaque execution handle per prompt. AsyncLocalStorage
  // preserves its origin across delayed async work, so an RPC born in turn A
  // cannot inherit turn B merely because B is current when it reaches stdout.
  const rpcTurnContext = new AsyncLocalStorage()
```
```js
        notify('rpc.request', {
          requestId,
          method,
          params,
          turnExecutionId: rpcTurnContext.getStore(),
        })
```

## E12. Schema — local capability marker (F29 grammar feasibility)

`packages/broker/src/schema.js:128-141`:
```js
  let local = undefined
  if (input.local !== undefined) {
    if (input.local === true) {
      local = { resource: undefined }
    } else if (typeof input.local === 'object' && input.local !== null && !Array.isArray(input.local)) {
      if (typeof input.local.resource !== 'string' || input.local.resource.length === 0) {
        errors.push(path('local') + '.resource must be a non-empty string when local is an object')
      } else {
        local = { resource: input.local.resource }
      }
    } else {
      errors.push(path('local') + ' must be true or { resource: string }')
    }
  }
```

## E13. mapping.js — string validation has no maxLength / byte / NUL support (F12)

`packages/broker/src/mapping.js:99-106`:
```js
      } else if (spec.type === 'string') {
        if (typeof val !== 'string') violations.push(`property "${label}" must be a string`)
        else if (typeof spec.minLength === 'number' && val.length < spec.minLength) violations.push(`property "${label}" must have length >= ${spec.minLength}`)
        // `nonBlank: true` (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
        // CTR-FMC-006): reject empty / whitespace-only strings LOCALLY, before
        // any token mint or business HTTP call — e.g. a resolve without an
        // outcome summary never leaves the broker.
        else if (spec.nonBlank === true && val.trim() === '') violations.push(`property "${label}" must be a non-blank string`)
```

## E14. Audit precedent — scheduler self-service (F22, G6)

`packages/scheduler/src/self-service.js:223-235`:
```js
export function createSelfServiceSchedulerAccess({ store, assertGrant, onAuditFailure = () => {} }) {
```
```js
  async function appendAudit(operation, { jobId, operatorAgentId, targetAgentId, before, after, nowMs }) {
```

`packages/production-runtime/src/compose.js:433-450`:
```js
  ctx.provide('selfServiceSchedulerAccess', createSelfServiceSchedulerAccess({
    store,
    assertGrant: async (agentId, scope, resource) => {
      try {
        const credential = loadCredentialFor(brokerCredentialsFile, agentId)
        if (credential === undefined) return false
        await requestAccessToken({ credential, authServiceOrigin: brokerAuthServiceOrigin, resource, scope })
        return true
      } catch {
        return false
      }
    },
    // A definition commit is authoritative even when the separate audit append
    // fails. Emit only the sanitized operation/job coordinates; the message,
    // destination, credentials, and digests never enter the Runtime log.
    onAuditFailure: ({ operation, jobId }) => {
      log.error(`[scheduler-self-service] audit append failed after committed ${operation} for job ${jobId}`)
    },
  }))
```

## E15. Accepted decisions — D-008/V3 supersedes V2; TARGET_MAIN frozen; implementation deferred (F10, G10, G12)

Worktree `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:2-10`:
```md
- 状态: accepted（2026-09-01；**standalone Current Authority**；整份取代 D-006 / V2）
- decision id: `D-008`
...
- supersedes: `D-006` / `AGENT_WORKSPACE_SESSION_MODEL_V2`（整份；acceptance transaction
  已同步将 D-006 标记为 superseded-by-D-008）
```

`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:19-21`:
```md
- read-only proposed input: `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2`
  （`sha256:20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169`；
  不随本 Decision 提交、不在本轮接受或实现）
```

`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:366-378`:
```md
AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN
AGENT_TO_AGENT_MESSAGING_TARGET = TARGET_AGENT_CANONICAL_MAIN

existing main → resume
absent main   → establish/create canonical main
one send      → one new target Run/Turn
one send      → NOT one new Session
```

`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:382-388`:
```md
对应 generic primitive：

agent_session_send
→ messaging
→ target main
→ one send = one new Run/Turn, not one new Session
```

`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:979-982` (§29 Future implementation boundaries):
```md
- agent_session_send implementation
- explicit delegation/spawn capability name and contract
- Router change
- Broker manifest or local capability wiring
```

Superseded V2 §11 (`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md:328-338`) — the gate target the draft spec §2.2 argues against:
```md
AGENT_TO_AGENT_SESSION_SCOPE = PER_TASK
LONG_LIVED_PAIR_SESSION = NO
MULTI_TURN_WITHIN_TASK = YES

Agent A 找 Agent B 做事：
  one task / delegation → one B non-main Session
```

## E16. Zero-implementation proof

Repo-wide grep in the worktree at BASE:
```
$ grep -rn "agent_session_send" --include="*.js" .
(no output; exit 1)

$ grep -rn "agent_session_send|agent-session-send|agentSessionSend|agent.session.send|agentSessionMessaging" --include="*.js" --include="*.json" --include="*.md" .
docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:384:agent_session_send
docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:981:- agent_session_send implementation
```

The draft spec itself is untracked at BASE:
```
$ git ls-files docs/specs/ | grep -i "SESSION_MESSAGING|WAKE"
(no output; exit 1)
```
