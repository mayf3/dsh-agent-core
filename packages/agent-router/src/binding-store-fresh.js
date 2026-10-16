/** Fixed HR Binding cut and Delivery V0 fresh-session methods. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const FRESH_HR_AGENT_ID = 'agt_hr-agent'
export const FRESH_HR_CUT_OPERATION_ID = 'hr-fresh-lineage-cut-20260929-0d8235e7'
const SHA256 = /^[a-f0-9]{64}$/
const CORRUPT_STORE = 'CORRUPT_STORE'
const VALIDATION_ERROR = 'VALIDATION_ERROR'
const digestJson = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function validateFreshHrCutBinding(suppliedCut, bindings) {
  const cut = suppliedCut
      const keys = ['bindingCutSha256', 'channelConversationId', 'newRuntimeEpoch',
        'newSessionId', 'oldHandle', 'oldSessionId', 'operationId',
        'preimageSha256', 'rootReceiptSha256']
      if (cut === null || typeof cut !== 'object' || Array.isArray(cut)
          || Object.keys(cut).sort().join(',') !== keys.sort().join(',')
          || cut.operationId !== FRESH_HR_CUT_OPERATION_ID
          || typeof cut.oldHandle !== 'string' || !cut.oldHandle.startsWith('turn:')
          || cut.oldHandle.length > 256
          || typeof cut.newSessionId !== 'string' || cut.newSessionId === ''
          || cut.newSessionId === cut.oldSessionId
          || typeof cut.newRuntimeEpoch !== 'string' || cut.newRuntimeEpoch === ''
          || typeof cut.oldSessionId !== 'string' || cut.oldSessionId === ''
          || typeof cut.channelConversationId !== 'string'
          || !cut.channelConversationId.startsWith('feishu:')
          || !SHA256.test(cut.preimageSha256 ?? '')
          || !SHA256.test(cut.rootReceiptSha256 ?? '')
          || !SHA256.test(cut.bindingCutSha256 ?? '')
          || digestJson({ channelConversationId: cut.channelConversationId,
            operationId: cut.operationId, oldSessionId: cut.oldSessionId,
            newSessionId: cut.newSessionId, newRuntimeEpoch: cut.newRuntimeEpoch,
            oldHandle: cut.oldHandle, rootReceiptSha256: cut.rootReceiptSha256,
            preimageSha256: cut.preimageSha256 }) !== cut.bindingCutSha256
          || !bindings.has(cut.channelConversationId)) {
        throw Object.assign(new Error('binding-store: invalid fixed HR Binding cut'),
          { code: CORRUPT_STORE })
      }
  return { ...cut }
}

export class FreshBindingMethods {
  getFreshHrCutBinding() {
    return this.freshHrCutBinding === null ? null : { ...this.freshHrCutBinding }
  }

  /** Router startup only: join a root PREPARED cut with the sole existing HR
   * Feishu Binding under this store's native serialization lock. This method
   * does not accept a caller-supplied chat ID or old updatedAt. The old row
   * and its preimage digest are captured inside the same mutation transaction.
   * The Router keeps ingress closed until this durable result is read back. */
  commitFreshHrBindingCut(cut) {
    if (cut?.operationId !== FRESH_HR_CUT_OPERATION_ID
        || typeof cut.oldHandle !== 'string' || !cut.oldHandle.startsWith('turn:')
        || cut.oldHandle.length > 256
        || !SHA256.test(cut.rootReceiptSha256 ?? '')
        || typeof cut.newSessionId !== 'string' || cut.newSessionId === ''
        || typeof cut.oldSessionId !== 'string' || cut.oldSessionId === ''
        || cut.oldSessionId === cut.newSessionId
        || typeof cut.newRuntimeEpoch !== 'string' || cut.newRuntimeEpoch === '') {
      throw Object.assign(new TypeError('binding-store: invalid fixed HR cut input'),
        { code: VALIDATION_ERROR })
    }
    return this.enqueue(async () => {
      if (this.freshHrCutBinding !== null) {
        throw Object.assign(new Error('binding-store: HR cut already committed'),
          { code: 'HR_FRESH_BINDING_CUT_ALREADY_COMMITTED' })
      }
      const candidates = [...this.bindings.values()].filter(row =>
        row.channelConversationId.startsWith('feishu:') && row.activeAgentId === FRESH_HR_AGENT_ID)
      if (candidates.length !== 1) {
        throw Object.assign(new Error('binding-store: exactly one HR Feishu Binding required'),
          { code: 'HR_FRESH_BINDING_AMBIGUOUS' })
      }
      const old = candidates[0]
      if (old.activeSessionId !== cut.oldSessionId
          || typeof old.updatedAt !== 'string' || old.updatedAt === '') {
        throw Object.assign(new Error('binding-store: HR old Binding preimage mismatch'),
          { code: 'HR_FRESH_BINDING_PREIMAGE_MISMATCH' })
      }
      const preimageSha256 = digestJson(old)
      const receipt = {
        channelConversationId: old.channelConversationId,
        operationId: cut.operationId,
        oldSessionId: old.activeSessionId,
        newSessionId: cut.newSessionId,
        newRuntimeEpoch: cut.newRuntimeEpoch,
        oldHandle: cut.oldHandle,
        rootReceiptSha256: cut.rootReceiptSha256,
        preimageSha256,
      }
      receipt.bindingCutSha256 = digestJson(receipt)
      this.bindings.set(old.channelConversationId, {
        ...old, activeSessionId: cut.newSessionId, updatedAt: this.now(),
      })
      this.freshHrCutBinding = receipt
      return { ...receipt }
    }, async receipt => {
      const onDisk = JSON.parse(readFileSync(this.storeFile, 'utf8'))
      if (onDisk.bindings?.[receipt.channelConversationId]?.activeSessionId !== cut.newSessionId
          || JSON.stringify(onDisk.freshHrCutBinding) !== JSON.stringify(receipt)) {
        throw Object.assign(new Error('binding-store: HR cut post-persist readback mismatch'),
          { code: 'HR_FRESH_BINDING_READBACK_UNKNOWN' })
      }
    }, { durable: true })
  }

  /**
   * Read one Delivery V0 fresh mapping: the native session owned by
   * (agentId, requestId), or undefined when this requestId was never
   * delivered fresh.
   * @param {string} agentId
   * @param {string} requestId
   * @returns {FreshSessionRow | undefined}
   */
  getFreshSession(agentId, requestId) {
    const row = this.freshSessions.get(agentId)?.get(requestId)
    return row === undefined ? undefined : { ...row }
  }

  /**
   * Read-or-mint the Delivery V0 fresh mapping for (agentId, requestId),
   * atomically inside the mutation queue: two concurrent first deliveries of
   * the same requestId can never mint two different session ids — the second
   * caller observes the row the first one persisted. Persists only when a
   * row is minted.
   *
   * @param {string} agentId - the delivering Agent (mapping namespace).
   * @param {string} requestId - the caller's opaque delivery id.
   * @param {(used: Set<string>) => string} mint - called ONLY on first sight
   *   of the requestId, inside the critical section; receives the set of
   *   session ids already in use by this agent and must return a non-empty
   *   id outside that set (the router derives `fresh-<hash>` from the
   *   requestId; the check guards against any collision).
   * @param {{lineageOperationId:string}} [lineage] - Router-private fixed HR
   *   cut marker for a mapping first minted after authenticated readiness.
   * @returns {Promise<FreshSessionRow>} the (existing or minted) row.
   */
  freshSessionFor(agentId, requestId, mint, lineage = undefined) {
    if (typeof agentId !== 'string' || agentId === ''
        || typeof requestId !== 'string' || requestId === '') {
      throw Object.assign(new TypeError('binding-store: freshSessionFor agentId and requestId (non-empty strings) are required'), {
        code: VALIDATION_ERROR,
      })
    }
    if (typeof mint !== 'function') {
      throw Object.assign(new TypeError('binding-store: freshSessionFor mint(usedIds) is required'), {
        code: VALIDATION_ERROR,
      })
    }
    if (lineage !== undefined && (agentId !== 'agt_hr-agent'
        || lineage === null || typeof lineage !== 'object' || Array.isArray(lineage)
        || Object.keys(lineage).join(',') !== 'lineageOperationId'
        || lineage.lineageOperationId !== FRESH_HR_CUT_OPERATION_ID)) {
      throw Object.assign(new TypeError('binding-store: exact fresh HR lineage marker invalid'), {
        code: VALIDATION_ERROR,
      })
    }
    return this.enqueue(async () => {
      let perRequest = this.freshSessions.get(agentId)
      if (perRequest === undefined) {
        perRequest = new Map()
        this.freshSessions.set(agentId, perRequest)
      }
      const existing = perRequest.get(requestId)
      if (existing !== undefined) return { ...existing }
      const used = new Set([...perRequest.values()].map(row => row.sessionId))
      const sessionId = mint(used)
      if (typeof sessionId !== 'string' || sessionId === '' || used.has(sessionId)) {
        throw Object.assign(new TypeError('binding-store: mint returned an invalid or duplicate sessionId'), {
          code: VALIDATION_ERROR,
        })
      }
      const createdAt = this.now()
      if (lineage !== undefined && !Number.isSafeInteger(Date.parse(createdAt))) {
        throw Object.assign(new TypeError('binding-store: fresh HR lineage creation time invalid'), {
          code: VALIDATION_ERROR,
        })
      }
      const row = { agentId, requestId, sessionId, createdAt,
        ...(lineage === undefined ? {} : { lineageOperationId: lineage.lineageOperationId }) }
      perRequest.set(requestId, row)
      return { ...row }
    })
  }

  /**
   * Every Delivery V0 fresh mapping row (test/evidence surface). Flattened,
   * insertion order. @returns {FreshSessionRow[]}
   */
  freshSessionsSnapshot() {
    const rows = []
    for (const [agentId, perRequest] of this.freshSessions.entries()) {
      for (const row of perRequest.values()) {
        rows.push({ ...row })
      }
    }
    return rows
  }}
