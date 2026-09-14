const OPTIONAL_RECEIPTS = ['runtime', 'watchdog', 'routing', 'desired', 'overlay', 'operator']

export function buildSchedulerRollbackPlan({ progress, receipts = {} } = {}) {
  if (!progress || typeof progress !== 'object' || !/^[0-9a-f]{40}$/.test(progress.sourceSha ?? '')
    || progress.phases === null || typeof progress.phases !== 'object' || Array.isArray(progress.phases)) {
    throw new TypeError('invalid deployment progress authority')
  }
  for (const name of Object.keys(receipts)) {
    if (!OPTIONAL_RECEIPTS.includes(name) || typeof receipts[name] !== 'boolean') throw new TypeError(`invalid rollback receipt coordinate: ${name}`)
  }
  const actions = ['STOP_WATCHDOGS', 'STOP_RUNTIME']
  for (const [receipt, action] of [
    ['runtime', 'RESTORE_RUNTIME'], ['watchdog', 'RESTORE_WATCHDOGS'], ['routing', 'RESTORE_ROUTING'], ['desired', 'RESTORE_DESIRED_STATE'],
    ['overlay', 'RESTORE_OVERLAY'], ['operator', 'RESTORE_OPERATOR'],
  ]) if (receipts[receipt] === true) actions.push(action)
  actions.push('START_RUNTIME', 'START_WATCHDOGS', 'VERIFY_HEALTH')
  return Object.freeze({ sourceSha: progress.sourceSha, completedPhases: Object.freeze(Object.keys(progress.phases)), actions: Object.freeze(actions) })
}

export function classifyRollbackGeneration({ currentSha256, installedSha256, preimageSha256 }) {
  if (currentSha256 === installedSha256) return 'RESTORE'
  if (currentSha256 === preimageSha256) return 'ALREADY_RESTORED'
  throw new Error('rollback generation advanced')
}
