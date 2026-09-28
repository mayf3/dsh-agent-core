/**
 * Child-side half of QE2's fixed one-use canary. The parent-owned protocol
 * must authenticate and arm this before it is allowed to write the prompt;
 * this module is never an authority to arm from caller-supplied metadata.
 * A qualified child accepts no ordinary prompts, so the monotonic tool guard
 * remains installed through its lifetime, including after an uncertain turn.
 */
import { FIXED_ADMIN_CANARY_TEXT, isFixedAdminQualification } from '../../production-runtime/src/native-arm64/hr-admin-canary-contract.mjs'
export { FIXED_ADMIN_CANARY_TEXT }

export function createFixedAdminChildPolicy(ctx) {
  if (typeof ctx?.tools?.guard !== 'function' || typeof ctx?.on !== 'function') {
    throw Object.assign(new Error('fixed admin canary requires both SDK enforcement hooks'), {
      code: 'FIXED_ADMIN_TOOL_ENFORCEMENT_UNAVAILABLE',
    })
  }
  let state = 'inactive'
  let used = false
  ctx.tools.guard(() => state === 'inactive' ? undefined : 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const assembled = await next()
    return state === 'inactive' ? assembled : { ...assembled, tools: [] }
  })
  return Object.freeze({
    armed: () => state === 'armed',
    arm(binding) {
      if (state !== 'inactive' || !isFixedAdminQualification(binding)) {
        state = 'rejected' // A malformed first attempt cannot fall back to ordinary prompts.
        throw Object.assign(new Error('fixed admin canary arm rejected'), {
        code: 'FIXED_ADMIN_CANARY_NO_REPLAY',
        })
      }
      state = 'armed'
    },
    consumePrompt(sessionId, contentBlocks, messageOrigin) {
      if (state !== 'armed' || used || sessionId !== 'main' || messageOrigin !== undefined
          || !Array.isArray(contentBlocks) || contentBlocks.length !== 1
          || contentBlocks[0]?.type !== 'text' || contentBlocks[0]?.text !== FIXED_ADMIN_CANARY_TEXT
          || Object.keys(contentBlocks[0]).length !== 2) {
        throw Object.assign(new Error('fixed admin canary prompt binding rejected'), {
          code: 'FIXED_ADMIN_CANARY_PROMPT_REJECTED',
        })
      }
      // Consume before any fallible session creation or native prompt write.
      used = true
    },
  })
}
