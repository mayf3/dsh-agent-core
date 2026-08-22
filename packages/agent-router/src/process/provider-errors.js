/**
 * @agent-core/agent-router/src/process/provider-errors.js — the provider
 * error boundary of the per-agent DSH process client.
 *
 * Provider/account failures stay truthful and never trigger route fallback.
 * This is the only provider-error boundary used for both JSON-RPC responses
 * and the asynchronous DSH turn/end reason. It deliberately reads only
 * code/message: arbitrary provider payloads, causes and OAuth objects never
 * cross the Router boundary.
 */

/** Redact common OAuth/API token shapes before an error reaches logs/callers. */
export function redactSensitiveText(value) {
  return String(value ?? '')
    .replace(/(["'](?:access_token|refresh_token|id_token|token|authorization|openai_api_key|client_secret)["']\s*:\s*["'])[^"']*(["'])/giu, '$1[REDACTED]$2')
    .replace(/\b(Authorization\s*:\s*)(?:Bearer\s+)?[^\s,;]+/giu, '$1[REDACTED]')
    .replace(/\b(Bearer\s+)[^\s,;]+/giu, '$1[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/gu, '[REDACTED]')
    .replace(/((?:access|refresh|id)[_-]?token|OPENAI_API_KEY|client_secret)\s*[=:]\s*[^\s,;}]+/giu, '$1=[REDACTED]')
}

/** Provider/account failures stay truthful and never trigger route fallback. */
export function classifyProviderError({ code, message } = {}) {
  const text = `${code ?? ''} ${message ?? ''}`.toLowerCase()
  if (/insufficient[_ -]?quota|account[_ -]?quota|quota (?:exhausted|exceeded)|usage limit/u.test(text)) return 'account_quota_exhausted'
  if (/oauth.*(?:expired|revoked)|(?:expired|revoked).*oauth|invalid[_ -]?grant/u.test(text)) return 'oauth_expired_or_revoked'
  if (/credential[_ -]?missing|auth(?:entication)? file.*(?:missing|not found)|provider is not configured/u.test(text)) return 'credential_missing'
  if (/model[_ -]?(?:unavailable|not[_ -]?found)|unknown model|unsupported model/u.test(text)) return 'model_unavailable'
  if (/provider[_ -]?unavailable|service unavailable|econnrefused|enotfound|network.*unavailable/u.test(text)) return 'provider_unavailable'
  if (code === 'SESSION_WORKSPACE_MISMATCH') return code
  return 'provider_runtime_rejection'
}

export function sanitizeProviderError(providerError, { agentId, provider, model } = {}) {
  const safeCode = redactSensitiveText(providerError?.code ?? 'provider_error')
  const safeMessage = redactSensitiveText(providerError?.message ?? 'provider request failed')
  const classification = classifyProviderError({ code: safeCode, message: safeMessage })
  const layer = classification === 'account_quota_exhausted' || classification === 'oauth_expired_or_revoked'
    ? 'provider/account'
    : classification === 'model_unavailable'
      ? 'provider/model'
      : classification === 'credential_missing'
        ? 'agent/credential'
        : classification === 'SESSION_WORKSPACE_MISMATCH'
          ? 'session'
        : 'provider'
  return Object.assign(new Error(`${safeCode}: ${safeMessage}`), {
    name: 'ProviderError',
    code: classification,
    class: classification,
    layer,
    agentId,
    provider,
    model,
  })
}

/** Provider error classes that fail loud at initialize (no retry masking). */
export const FAIL_LOUD_PROVIDER_ERRORS = new Set([
  'credential_missing',
  'oauth_expired_or_revoked',
  'provider_unavailable',
  'account_quota_exhausted',
  'model_unavailable',
])
