export function buildPostdeployAcceptanceReceipt({ sourceSha, health, canary, passiveReplay, storeDelta, observedAt }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '')) throw new TypeError('postdeploy gate requires exact source SHA')
  const countsExact = Number.isInteger(health?.enabled) && health.enabled === health.healthy + health.degraded + health.blocked + health.unknown
  const healthPass = health?.complete === true && health?.unknown === 0 && countsExact
    && health?.provenance?.runtime === sourceSha && health?.provenance?.canonicalPair === true
  const canaryPass = canary?.newDisposableJob === true && canary?.sideEffectFree === true
    && canary?.outcome === 'succeeded' && canary?.unrelatedJobIsolation === 'PASS'
  const replayPass = passiveReplay?.syntheticEvidence === false && passiveReplay?.quarantinePreserved === true
    && passiveReplay?.incidentDedupe === 'PASS'
  if (!healthPass || !canaryPass || !replayPass || storeDelta !== 'CANARY_ONLY') throw new Error('postdeploy acceptance gate failed')
  return Object.freeze({
    status: 'ACCEPTED', sourceSha, observedAt, health: { enabled: health.enabled, healthy: health.healthy, degraded: health.degraded, blocked: health.blocked, unknown: health.unknown },
    canaryOccurrenceId: canary.occurrenceId, syntheticEvidence: false, storeDelta: 'CANARY_ONLY', currentSixAuthorized: true,
  })
}
