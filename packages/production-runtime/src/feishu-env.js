/**
 * @agent-core/production-runtime/src/feishu-env.js — STRICT env parsing for
 * every Feishu channel switch (extracted from compose.js verbatim:
 * CODE_STRUCTURE_GUARDRAILS_V1 file-size cap).
 *
 * Every resolver here is strict: ONLY the exact accepted values pass, any
 * other value throws a machine-readable error. WHEN that strictness applies
 * is the composition's decision (audit Product #442): the ENABLED channel
 * parses these resolvers and fails composition LOUD; the DISABLED channel's
 * switches are inert, so invalid values are reported via
 * warnInvalidUnconfiguredFeishuEnv without blocking the unrelated base path.
 */

/**
 * STRICT boolean env parsing for the Feishu UX switches: ONLY the exact
 * strings 'true' / 'false' are accepted. Any other value (case variants,
 * '1'/'0', 'yes', whitespace, ...) fails composition LOUD — a typo'd
 * supervision-unit env must never silently revert admission/mention policy.
 * Unset or empty means "not configured" (undefined): the connector's own
 * defaults (true/true) apply.
 *
 * @param {object} env - env map (process.env).
 * @param {string} key - the env var name.
 * @returns {boolean|undefined} true / false, or undefined when unset/empty.
 * @throws {Error} code FEISHU_UX_SWITCH_INVALID on any non-boolean value.
 */
export function parseStrictBooleanEnv(env, key) {
  const raw = env[key]
  if (raw === undefined || raw === '') return undefined
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw Object.assign(
    new Error(`production-runtime: ${key} must be exactly 'true' or 'false' (got ${JSON.stringify(raw)})`),
    { code: 'FEISHU_UX_SWITCH_INVALID' },
  )
}

/**
 * Resolve both Feishu UX switches from env (FEISHU_REQUIRE_MENTION_IN_GROUP /
 * FEISHU_AUTO_MENTION_TRIGGER_SENDER). Called by the composition for the
 * ENABLED channel only — an invalid value fails composition loud there;
 * with the channel OFF the composition routes the same strictness through
 * warnInvalidUnconfiguredFeishuEnv instead (audit Product #442).
 *
 * @param {object} [env] - env map (default process.env).
 * @returns {{requireMentionInGroup?:boolean, autoMentionTriggerSender?:boolean}}
 *   only the configured keys (absent = connector defaults).
 */
export function resolveFeishuUxSwitches(env = process.env) {
  return dropUndefined({
    requireMentionInGroup: parseStrictBooleanEnv(env, 'FEISHU_REQUIRE_MENTION_IN_GROUP'),
    autoMentionTriggerSender: parseStrictBooleanEnv(env, 'FEISHU_AUTO_MENTION_TRIGGER_SENDER'),
  })
}

function dropUndefined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

/**
 * STRICT boolean env parsing for the processing-reaction switch
 * (FEISHU_PROCESSING_REACTION_ENABLED): unset/empty => false (connector
 * default OFF); EXACTLY 'true'/'false' => that boolean; anything else fails
 * composition LOUD with FEISHU_PROCESSING_REACTION_INVALID. Always a definite
 * boolean — production target is an explicit DEPLOY-time opt-in (not this
 * round). @throws {Error} FEISHU_PROCESSING_REACTION_INVALID.
 */
export function resolveProcessingReactionConfig(env = process.env) {
  const raw = env.FEISHU_PROCESSING_REACTION_ENABLED
  if (raw === undefined || raw === '') return false
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw Object.assign(
    new Error(`production-runtime: FEISHU_PROCESSING_REACTION_ENABLED must be exactly 'true' or 'false' (got ${JSON.stringify(raw)})`),
    { code: 'FEISHU_PROCESSING_REACTION_INVALID' },
  )
}

/**
 * STRICT render-mode env parsing (STATIC_FINAL_CARD_V1,
 * FEISHU_REPLY_RENDER_MODE): unset/empty => 'markdown' (the connector
 * default — byte-identical current production rendering); EXACTLY
 * 'markdown' | 'card' => that mode; anything else fails composition LOUD
 * with FEISHU_REPLY_RENDER_MODE_INVALID. The production target value is
 * 'card', but it is NOT applied this round (deploy-round decision with
 * atomic rollback).
 * @throws {Error} code FEISHU_REPLY_RENDER_MODE_INVALID.
 */
export function resolveReplyRenderMode(env = process.env) {
  const raw = env.FEISHU_REPLY_RENDER_MODE
  if (raw === undefined || raw === '') return 'markdown'
  if (raw === 'markdown' || raw === 'card') return raw
  throw Object.assign(
    new Error(`production-runtime: FEISHU_REPLY_RENDER_MODE must be 'markdown' or 'card' (got ${JSON.stringify(raw)})`),
    { code: 'FEISHU_REPLY_RENDER_MODE_INVALID' },
  )
}

/**
 * Channel-OFF observability (audit Product #442): with the adapter DISABLED
 * the channel-specific switches configure nothing, so an invalid value must
 * be REPORTED — one warn line per strict error, code included — instead of
 * failing the whole composition. The misconfiguration stays visible; the
 * unrelated base path stays up. The ENABLED branch never routes through
 * here: it parses the same resolvers strictly and fails loud.
 */
export function warnInvalidUnconfiguredFeishuEnv(env = process.env, warn = () => {}) {
  const probes = [
    () => parseStrictBooleanEnv(env, 'FEISHU_REQUIRE_MENTION_IN_GROUP'),
    () => parseStrictBooleanEnv(env, 'FEISHU_AUTO_MENTION_TRIGGER_SENDER'),
    () => resolveProcessingReactionConfig(env),
    () => resolveReplyRenderMode(env),
  ]
  for (const probe of probes) {
    try { probe() } catch (error) {
      warn(`production-runtime: feishu channel OFF — ignoring invalid adapter env [${error?.code ?? 'FEISHU_ADAPTER_ENV_INVALID'}]: ${error?.message ?? error}`)
    }
  }
}
