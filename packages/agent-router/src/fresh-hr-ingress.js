/** Fixed post-cut Feishu Binding admission; direct routes keep the old fence. */
function postCutMessage(ingress, cut, oldRecord) {
  const rawMessage = ingress?.raw?.message
  const rawTime = rawMessage?.create_time
  if (rawMessage?.message_id !== ingress.messageId
      || typeof rawTime !== 'string' || !/^\d{10,13}$/.test(rawTime)) return false
  const numeric = Number(rawTime)
  const createdAtMs = numeric > 1e12 ? numeric : numeric * 1000
  return Number.isSafeInteger(createdAtMs) && createdAtMs > cut.cutCommittedAtMs
    && ingress.timestamp === createdAtMs
    && ingress.messageId !== oldRecord?.ingressCorrelation?.feishuMessageId
}

export function freshHrIngressState({ reconciliationStore, store, binding,
  channelConversation, ingress, authenticatedFeishu, isFeishuEntry }) {
  const cut = reconciliationStore.freshHrLineage
  const committed = cut?.agentId === binding.activeAgentId
    ? store.getFreshHrCutBinding?.() : null
  const bindingReady = cut?.agentId === binding.activeAgentId
    && authenticatedFeishu && isFeishuEntry
    && committed?.channelConversationId === channelConversation.id
    && committed.operationId === cut.operationId
    && committed.oldHandle === cut.oldHandle
    && committed.rootReceiptSha256 === cut.rootReceiptSha256
    && committed.newRuntimeEpoch === reconciliationStore.runtimeEpoch
    && committed.newSessionId === binding.activeSessionId
    && postCutMessage(ingress, cut, reconciliationStore.records.get(cut.oldHandle))
  return {
    bindingReady,
    fence: bindingReady
      ? reconciliationStore.admissionFenceForAgent(binding.activeAgentId,
        { sessionId: binding.activeSessionId })
      : typeof reconciliationStore.admissionBlockerForAgent === 'function'
        ? reconciliationStore.admissionBlockerForAgent(binding.activeAgentId)
        : reconciliationStore.activeFenceForAgent?.(binding.activeAgentId),
  }
}
