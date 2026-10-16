/** Private, fixed QE2 child protocol; never a caller-facing Router option. */
export const FIXED_ADMIN_CANARY_TEXT = 'Fixed qualification canary. Reply with a short acknowledgement.'
export const FIXED_ADMIN_CANARY_AGENT = 'agt_efficiency-agent'
const PHASES = new Set(['deployment_start', 'restart_a', 'restart_b'])
const KEYS = ['role', 'agentId', 'phase', 'hostId', 'packageSha256',
  'consumingBinarySha256', 'startupNonce', 'processGeneration']

export function isFixedAdminQualification(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...KEYS].sort().join(',')
    && value.role === 'fixed_admin_qualification'
    && value.agentId === FIXED_ADMIN_CANARY_AGENT && PHASES.has(value.phase)
    && value.hostId === 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
    && ['packageSha256', 'consumingBinarySha256', 'startupNonce']
      .every(key => /^[a-f0-9]{64}$/.test(value[key] ?? ''))
    && Number.isSafeInteger(value.processGeneration) && value.processGeneration > 0
}

/** Derive the child arm only from the authenticated root qualification and
 * the registry's actually allocated generation, never from an ingress opts. */
export function fixedAdminBindingFromRoot(context, processGeneration) {
  if (!context || context.role !== 'original_executor_admin_qualification'
      || !['deployment_start', 'restart_a', 'restart_b'].includes(context.phase)
      || context.procedureSha256 !== 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44'
      || !['entryManifestSha256', 'consumingBinarySha256', 'startupNonce']
        .every(key => /^[a-f0-9]{64}$/.test(context[key] ?? ''))
      || !Number.isSafeInteger(processGeneration) || processGeneration < 1) {
    throw Object.assign(new Error('fixed admin root context unavailable'), { code: 'FIXED_ADMIN_ROOT_CONTEXT_INVALID' })
  }
  return Object.freeze({ role: 'fixed_admin_qualification', agentId: FIXED_ADMIN_CANARY_AGENT,
    phase: context.phase, hostId: 'FF99ABD5-79A0-5EE0-9E0B-B62671271560',
    packageSha256: context.entryManifestSha256,
    consumingBinarySha256: context.consumingBinarySha256,
    startupNonce: context.startupNonce, processGeneration })
}
