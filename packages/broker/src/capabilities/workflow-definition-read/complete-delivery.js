import { COMPLETE_BODY_ID, exactKeys, validCompleteResult } from './complete-contract.js'

/** Preserve the bounded original through native's existing tool-owned value seam.
 * Generic spill, downstream policy, nested calls and other tool owners retain
 * their normal behavior. This does not pin history against later compaction.
 */
export function registerCompleteBodyDelivery(ctx, capabilities, tools) {
  const capability = capabilities.find(c => c.manifest?.id === COMPLETE_BODY_ID
    && c.manifest.toolName === COMPLETE_BODY_ID && c.manifest.infrastructure !== true)
  const tool = capability && tools.find(t => t.name === COMPLETE_BODY_ID)
  if (!tool || typeof ctx.on !== 'function') return
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (decision.kind !== 'accept' || Object.hasOwn(decision, 'content') || Object.hasOwn(decision, 'value')
      || exec.parent !== undefined || exec.name !== tool.name || result.isError
      || ctx.tools.get(exec.name, exec.agent) !== tool || exec.arguments?.operation !== 'read') return decision
    const value = result.value
    const { operation: _operation, ...args } = exec.arguments
    if (!exactKeys(value, ['ok', 'result']) || value.ok !== true || !validCompleteResult(value.result, args)) return decision
    // Native snapshots, validates and renders this value again. Its prepended
    // spill policy explicitly defers to accepted tool-owned value decisions.
    return { ...decision, value }
  })
}
