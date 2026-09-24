/**
 * Startup-boundary per-Agent model route chain configuration.
 *
 * The deployment owns `<productionRoot>/agent-model-overrides.json` version 3
 * (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 §2 / CTR-001, implemented under
 * AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1 CTR-IMPL-001): the ONLY route
 * order authority. Schema:
 *
 *   { "version": 3,
 *     "routeCatalog": { "<routeRef>": { routeKind: builtin|subscription,
 *        provider, model, credentialReadiness, providerEnv?,
 *        plugin + pluginVersion (subscription ONLY — FORBIDDEN on builtin),
 *        reasoningEffort? (GPT6_LUNA_AND_REASONING_EFFORT_V1: the GPT-6 Luna
 *        tuple ONLY — dsh-codex@0.2.3-dshr1 subscription routes; closed
 *        REASONING_EFFORT_VALUES set; absent normalizes to effective medium
 *        on that tuple and is FORBIDDEN everywhere else) } },
 *     "overrides": { "<agentId>": { "model": { "primary": <routeRef>,
 *        "fallbacks": [<routeRef>, ...] } } } }
 *
 * ROUTE_CHAIN = [primary, ...fallbacks] (ordered, ≤ MAX_CONFIGURED_ROUTES;
 * [] = strict). Route CONTENT and ORDER never come from product code
 * (ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN). Malformed configs fail loud
 * at load (duplicate JSON keys at any depth, unresolved/duplicate/alias
 * routeRefs, providerEnv grammar, pin mismatch, out-of-scope agentId);
 * config changes require a controlled restart — this module never watches
 * or writes the file. A missing file (or no entry for an agent) is the
 * rollback/legacy state: the global env route applies, byte-equivalent to
 * the pre-chain behavior.
 */

import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

import { canonicalRouteIdentity } from '../../agent-router/src/route-chain.js'
import {
  CANONICAL_DEFAULT_MODEL_ROUTE,
  GPT6_LUNA_ROUTE_V1,
  REASONING_EFFORT_VALUES,
} from '../../agent-provisioning/src/shared-codex.js'

/**
 * Config-independent pins and scope (parent CTR-011 / CTR-IMPL-009
 * carry-forward). Route tuple VALUES never come from here — only exact
 * dsh-codex/Harness source identity and the canonical credential path do.
 * Canonical path realigned to the yanfenma unified production backend
 * (AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2 CTR-ACT2-002).
 */
export const CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE = '/Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json'

export const CHATGPT_SUBSCRIPTION_V1 = Object.freeze({
  targetAgentId: 'agt_cto-agent',
  plugin: 'dsh-codex',
  pluginVersion: '0.2.3',
  sourceCommit: '75d98d5b10bb926d53108e49019668c1bde2a9eb',
  artifactSha256: '2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',
  dshVersion: '0.1.0-rc.8',
  dshCommit: '514ab7b0029141b88c807704764d0d3e1eea1da4',
  credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
})

/**
 * GPT6_LUNA_AND_REASONING_EFFORT_V1 (CTR-G6R-001/002): the V3 production pin
 * above is preserved byte-for-byte — the dormant GPT-6 tuple lives in
 * GPT6_LUNA_ROUTE_V1 (agent-provisioning/shared-codex.js) and is selected
 * ONLY by a deployment-owned model override. The loader accepts BOTH
 * dsh-codex pins; a single global pin replacement is forbidden, and no
 * reasoning default is injected into the legacy tuple (DEC-G6R-004).
 */

export const PROVIDER_ENV_ALLOWLIST = Object.freeze([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'NODE_USE_ENV_PROXY',
])

/** Hard chain bound (parent Spec Q-1, Owner-frozen 2026-08-25). */
export const MAX_CONFIGURED_ROUTES = 4

function invalid(message, cause) {
  return Object.assign(new Error(`production-runtime: invalid agent model overrides: ${message}`, { cause }), {
    code: 'AGENT_MODEL_OVERRIDE_INVALID',
  })
}

function invalidProviderEnv(key, invalidClass) {
  return invalid(`${key}: ${invalidClass}`)
}

function assertProxyUrl(key, value) {
  if (typeof value !== 'string' || value === '') throw invalidProviderEnv(key, 'invalid_non_empty_string')
  let url
  try {
    url = new URL(value)
  } catch {
    throw invalidProviderEnv(key, 'invalid_url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalidProviderEnv(key, 'invalid_scheme')
  if (url.username !== '' || url.password !== '' || value.includes('@')) throw invalidProviderEnv(key, 'userinfo_forbidden')
  if (url.hostname === '') throw invalidProviderEnv(key, 'host_missing')
  if (url.pathname !== '' && url.pathname !== '/') throw invalidProviderEnv(key, 'path_forbidden')
  if (url.search !== '') throw invalidProviderEnv(key, 'query_forbidden')
  if (url.hash !== '') throw invalidProviderEnv(key, 'fragment_forbidden')
}

function validPort(port) {
  if (port === undefined) return true
  if (!/^[0-9]+$/u.test(port)) return false
  const number = Number(port)
  return Number.isInteger(number) && number >= 1 && number <= 65_535
}

function validHostname(host) {
  if (host.length === 0 || host.length > 253) return false
  return host.split('.').every((label) => (
    label.length >= 1
    && label.length <= 63
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label)
  ))
}

function validNoProxyEntry(entry) {
  if (entry === '*') return true

  const bracketed = entry.match(/^\[([^\]]+)\](?::([0-9]+))?$/u)
  if (bracketed !== null) return isIP(bracketed[1]) === 6 && validPort(bracketed[2])
  if (entry.includes('[') || entry.includes(']')) return false

  // A raw IPv6 literal is valid only without a port. Brackets are mandatory
  // for the IPv6 + port form, keeping the grammar mechanically unambiguous.
  if (isIP(entry) === 6) return true

  const hostPort = entry.match(/^([^:]+)(?::([0-9]+))?$/u)
  if (hostPort === null || !validPort(hostPort[2])) return false
  const host = hostPort[1]
  if (isIP(host) === 4) return true
  // Numeric dotted input is an IPv4 candidate, never a hostname fallback.
  if (/^[0-9.]+$/u.test(host)) return false
  return validHostname(host)
}

function assertNoProxy(value) {
  if (typeof value !== 'string' || value === '') {
    throw invalidProviderEnv('NO_PROXY', 'invalid_non_empty_string')
  }
  // Shell expansion syntax is forbidden. '*' and '[' / ']' are handled only
  // by their exact grammar positions in validNoProxyEntry.
  if (/[\s\u0000-\u001f\u007f'"`$\\?{}();&|<>!~]/u.test(value)) {
    throw invalidProviderEnv('NO_PROXY', 'invalid_character')
  }
  const entries = value.split(',')
  if (entries.some((entry) => entry === '' || !validNoProxyEntry(entry))) {
    throw invalidProviderEnv('NO_PROXY', 'invalid_entry')
  }
}

function validateProviderEnv(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidProviderEnv('providerEnv', 'invalid_type')
  }
  const allowed = new Set(PROVIDER_ENV_ALLOWLIST)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw invalidProviderEnv(key, 'unknown_key')
  }
  for (const key of PROVIDER_ENV_ALLOWLIST) {
    if (!Object.hasOwn(value, key)) throw invalidProviderEnv(key, 'missing_key')
  }
  assertProxyUrl('HTTP_PROXY', value.HTTP_PROXY)
  assertProxyUrl('HTTPS_PROXY', value.HTTPS_PROXY)
  assertNoProxy(value.NO_PROXY)
  if (value.NODE_USE_ENV_PROXY !== '1') {
    throw invalidProviderEnv('NODE_USE_ENV_PROXY', 'invalid_value')
  }
  return Object.freeze(Object.fromEntries(PROVIDER_ENV_ALLOWLIST.map((key) => [key, value[key]])))
}

/**
 * JSON.parse silently keeps the final value for duplicate object keys. The
 * deployment contract is fail-loud instead, so scan the already-valid JSON
 * grammar and reject a repeated key in any object before using the value.
 */
function assertNoDuplicateJsonKeys(source) {
  let index = 0
  const whitespace = () => {
    while (/\s/u.test(source[index] ?? '')) index += 1
  }
  const string = () => {
    const start = index
    index += 1
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2
      } else if (source[index] === '"') {
        index += 1
        return JSON.parse(source.slice(start, index))
      } else {
        index += 1
      }
    }
    throw invalid('unterminated JSON string')
  }
  const value = () => {
    whitespace()
    if (source[index] === '{') {
      index += 1
      whitespace()
      const keys = new Set()
      if (source[index] === '}') { index += 1; return }
      for (;;) {
        whitespace()
        const key = string()
        if (keys.has(key)) throw invalid(`duplicate JSON key ${JSON.stringify(key)}`)
        keys.add(key)
        whitespace()
        index += 1 // ':' (JSON.parse already established valid syntax)
        value()
        whitespace()
        if (source[index] === '}') { index += 1; return }
        index += 1 // ','
      }
    }
    if (source[index] === '[') {
      index += 1
      whitespace()
      if (source[index] === ']') { index += 1; return }
      for (;;) {
        value()
        whitespace()
        if (source[index] === ']') { index += 1; return }
        index += 1 // ','
      }
    }
    if (source[index] === '"') {
      string()
      return
    }
    while (index < source.length && !/[\s,\]}]/u.test(source[index])) index += 1
  }
  value()
}

function exactKeys(value, expected) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

/**
 * CANONICAL_ROUTE_IDENTITY (parent Amendment 1 A1.3): seven-field canonical
 * form — routeKind, provider, model, plugin-or-ABSENT, pluginVersion-or-ABSENT,
 * credentialReadiness reference and canonical providerEnv. Pure deterministic
 * normalization; nothing is dropped. A builtin and a subscription route never
 * collapse to the same identity even when every other field matches. Two
 * different routeRefs resolving to the same canonical identity are a malformed
 * config (no alias bypass of ATTEMPTED_AT_MOST_ONCE).
 *
 * GPT6_LUNA_AND_REASONING_EFFORT_V1: the route's EFFECTIVE reasoningEffort
 * joins the canonical form for the GPT-6 tuple only — `gpt-6-luna + medium`
 * and `gpt-6-luna + high` are DIFFERENT routes because their requests differ,
 * while ABSENT and explicit medium normalize to the same effective identity
 * (DEC-G6R-004/CTR-G6R-003). Every other route keeps the exact pre-change
 * identity bytes (CTR-G6R-001).
 */
function effectiveRouteReasoningEffort(route) {
  if (route?.routeKind === 'subscription'
      && route?.plugin === GPT6_LUNA_ROUTE_V1.plugin
      && route?.pluginVersion === GPT6_LUNA_ROUTE_V1.pluginVersion) {
    return route.reasoningEffort ?? GPT6_LUNA_ROUTE_V1.defaultReasoningEffort
  }
  return route.reasoningEffort
}

function catalogCanonicalIdentity(route) {
  const reasoningEffort = effectiveRouteReasoningEffort(route)
  return JSON.stringify([
    route.routeKind,
    route.provider,
    route.model,
    route.plugin ?? 'ABSENT',
    route.pluginVersion ?? 'ABSENT',
    ...(reasoningEffort === undefined ? [] : [reasoningEffort]),
    route.credentialFile ?? 'ABSENT',
    route.credentialReadiness,
    route.providerEnv === undefined
      ? 'ABSENT'
      : PROVIDER_ENV_ALLOWLIST.map((key) => [key, route.providerEnv[key]]),
  ])
}

function assertNonEmptyString(value, what) {
  if (typeof value !== 'string' || value === '') throw invalid(`${what} must be a non-empty string`)
  return value
}

/** One resolved chain route entry: frozen process config + reuse identity. */
function makeChainRoute(routeRef, route) {
  const processConfig = Object.freeze({
    provider: route.provider,
    model: route.model,
    omitEnv: Object.freeze(['OPENAI_API_KEY']),
    ...(route.providerEnv === undefined ? {} : { providerEnv: route.providerEnv }),
    // DEC-IMPL-011: only a subscription route carries the provisioning
    // block; a builtin processConfig has NO subscription key, so the spawn
    // side's conditional expansion keeps it off the plugin/pin path entirely.
    ...(route.routeKind === 'subscription' ? {
      subscription: subscriptionProcessConfigBlock(route.plugin, route.pluginVersion, route.credentialFile, effectiveRouteReasoningEffort(route)),
    } : {}),
  })
  return Object.freeze({
    routeRef,
    provider: route.provider,
    model: route.model,
    identity: canonicalRouteIdentity(processConfig),
    processConfig,
  })
}

/** DEC-IMPL-011 subscription provisioning block, shared by routeCatalog
 * entries and the built-in default route (DEFAULT_MODEL_ROUTING_CONFIG_V1).
 * GPT6_LUNA_AND_REASONING_EFFORT_V1: reasoningEffort rides the block so the
 * spawn's provisioning writes it into the plugin config patch — one route
 * tuple, one internally consistent provisioning output. The stamped artifact
 * identity is the ROUTE'S OWN pin (CTR-G6R-002): legacy routes carry the V3
 * dsh-codex@0.2.3 identity, the GPT-6 tuple carries the exact dshr1
 * identity; a single global stamp is forbidden. */
function subscriptionProcessConfigBlock(plugin, pluginVersion, credentialFile, reasoningEffort) {
  const tupleIdentity = pluginVersion === GPT6_LUNA_ROUTE_V1.pluginVersion ? GPT6_LUNA_ROUTE_V1 : CHATGPT_SUBSCRIPTION_V1
  return Object.freeze({
    plugin,
    pluginVersion,
    sourceCommit: tupleIdentity.sourceCommit,
    artifactSha256: tupleIdentity.artifactSha256,
    dshVersion: tupleIdentity.dshVersion,
    dshCommit: tupleIdentity.dshCommit,
    ...(credentialFile === undefined ? {} : { credentialFile }),
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    ...(process.env.DSH_CODEX_PACKAGE_TARBALL === undefined ? {} : {
      packageArtifact: process.env.DSH_CODEX_PACKAGE_TARBALL,
    }),
    ...(process.env.DSH_CODEX_SOURCE_STAMP === undefined ? {} : {
      sourceStamp: process.env.DSH_CODEX_SOURCE_STAMP,
    }),
  })
}

/**
 * The canonical built-in default global route (DEFAULT_MODEL_ROUTING_CONFIG_V1
 * §2): GPT Luna as a COMPLETE subscription route — the same processConfig
 * shape a routeCatalog subscription entry resolves to, so a zero-config Agent
 * mounts the dsh-codex plugin + shared canonical credential exactly like an
 * explicitly configured Luna Agent. A missing canonical credential or plugin
 * artifact fails loud at provision; there is never a silent oc-go fallback.
 */
export function canonicalDefaultGlobalRoute() {
  return Object.freeze({
    provider: CANONICAL_DEFAULT_MODEL_ROUTE.provider,
    model: CANONICAL_DEFAULT_MODEL_ROUTE.model,
    subscription: subscriptionProcessConfigBlock(
      CHATGPT_SUBSCRIPTION_V1.plugin,
      CHATGPT_SUBSCRIPTION_V1.pluginVersion,
      CHATGPT_SUBSCRIPTION_V1.credentialFile,
    ),
  })
}

/**
 * Load the frozen V3 route chain schema. Missing file is the rollback/legacy
 * state (global env route for every agent). Malformed files fail loud.
 * @param {string} file
 * @param {Iterable<string>} registeredAgentIds
 * @returns {{filePresent:boolean, overrides:Readonly<Record<string,object>>,
 *   resolve:(agentId:string, globalRoute:object)=>object,
 *   resolveChain:(agentId:string, globalRoute:object)=>object}}
 */
export function loadAgentModelOverrides(file, registeredAgentIds) {
  const filePresent = existsSync(file)
  const mutableOverrides = new Map()
  if (filePresent) {
    let source
    let parsed
    try {
      source = readFileSync(file, 'utf8')
      parsed = JSON.parse(source)
      assertNoDuplicateJsonKeys(source)
    } catch (cause) {
      if (cause?.code === 'AGENT_MODEL_OVERRIDE_INVALID') throw cause
      throw invalid(`cannot parse ${file}`, cause)
    }
    if (!exactKeys(parsed, ['overrides', 'routeCatalog', 'version']) || parsed.version !== 3
        || parsed.routeCatalog === null || typeof parsed.routeCatalog !== 'object'
        || Array.isArray(parsed.routeCatalog)
        || parsed.overrides === null || typeof parsed.overrides !== 'object'
        || Array.isArray(parsed.overrides)) {
      throw invalid(`${file} must be {"version":3,"routeCatalog":{...},"overrides":{...}} (older files are not converted)`)
    }
    // routeCatalog: routeRef -> frozen validated route + canonical dedup.
    const catalog = new Map()
    const canonicalIdentities = new Map()
    for (const [routeRef, route] of Object.entries(parsed.routeCatalog)) {
      // Parent Amendment 1 A1.2: routeKind is the closed-enum discriminator;
      // the legal key set is routeKind-conditional (an existing plugin/
      // pluginVersion key is malformed on a builtin route whatever its value).
      const routeKind = route?.routeKind
      if (routeKind !== 'builtin' && routeKind !== 'subscription') {
        throw invalid(`routeCatalog.${routeRef}.routeKind must be "builtin" or "subscription" (got ${JSON.stringify(routeKind)})`)
      }
      const isSubscription = routeKind === 'subscription'
      const isOpenAICodex = route?.provider === 'openai-codex' || route?.plugin === CHATGPT_SUBSCRIPTION_V1.plugin
      const hasProviderEnv = Object.hasOwn(route ?? {}, 'providerEnv')
      const hasReasoningEffort = Object.hasOwn(route ?? {}, 'reasoningEffort')
      // GPT6_LUNA_AND_REASONING_EFFORT_V1 (CTR-G6R-002): the loader accepts
      // BOTH dsh-codex pins — the V3 production pin (legacy tuple) and the
      // dormant GPT-6 tuple pin. A single global pin that makes an existing
      // V3 config invalid is forbidden.
      const isDshCodexSubscription = isSubscription && route?.plugin === CHATGPT_SUBSCRIPTION_V1.plugin
      const isLegacyCodexTuple = isDshCodexSubscription && route.pluginVersion === CHATGPT_SUBSCRIPTION_V1.pluginVersion
      const isGpt6Tuple = isDshCodexSubscription && route.pluginVersion === GPT6_LUNA_ROUTE_V1.pluginVersion
      const routeKeys = [
        'credentialReadiness', 'model', 'provider', 'routeKind',
        ...(isSubscription ? ['plugin', 'pluginVersion'] : []),
        ...(isSubscription && isOpenAICodex ? ['credentialFile'] : []),
        ...(hasProviderEnv ? ['providerEnv'] : []),
        ...(hasReasoningEffort ? ['reasoningEffort'] : []),
      ]
      if (routeRef === '' || !exactKeys(route, routeKeys)) {
        throw invalid(isSubscription
          ? `routeCatalog.${routeRef} must contain routeKind, provider, model, plugin, pluginVersion, credentialReadiness and optional providerEnv/reasoningEffort only`
          : `routeCatalog.${routeRef} must contain routeKind, provider, model, credentialReadiness and optional providerEnv only (plugin/pluginVersion are FORBIDDEN on a builtin route)`)
      }
      const requiredFields = isSubscription
        ? ['provider', 'model', 'plugin', 'pluginVersion', 'credentialReadiness']
        : ['provider', 'model', 'credentialReadiness']
      for (const field of requiredFields) {
        assertNonEmptyString(route[field], `routeCatalog.${routeRef}.${field}`)
      }
      if (isSubscription && /^[~^*]|[xX]$|\s\|\||\s-\s/u.test(route.pluginVersion)) {
        throw invalid(`routeCatalog.${routeRef}.pluginVersion must be an exact pin (got ${route.pluginVersion})`)
      }
      if (isDshCodexSubscription && !isLegacyCodexTuple && !isGpt6Tuple) {
        // CTR-011 + CTR-G6R-002: a dsh-codex pin mismatch is a config error,
        // never a fallback trigger. Scoped to subscription routes carrying
        // the plugin (a builtin route has no plugin key at all).
        throw invalid(`routeCatalog.${routeRef}: pluginVersion pin mismatch (${CHATGPT_SUBSCRIPTION_V1.plugin} must be ${CHATGPT_SUBSCRIPTION_V1.pluginVersion} or ${GPT6_LUNA_ROUTE_V1.pluginVersion} exactly, got ${JSON.stringify(route.pluginVersion)})`)
      }
      if (isOpenAICodex && (
        !isSubscription
        || route.provider !== 'openai-codex'
        || !(isLegacyCodexTuple || isGpt6Tuple)
        || route.credentialFile !== CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE
      )) {
        throw invalid(`routeCatalog.${routeRef}: openai-codex shared mode requires dsh-codex@${CHATGPT_SUBSCRIPTION_V1.pluginVersion} or @${GPT6_LUNA_ROUTE_V1.pluginVersion} and credentialFile ${CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE}`)
      }
      if (isGpt6Tuple && route.model !== GPT6_LUNA_ROUTE_V1.model) {
        // DEC-G6R-002: the dshr1 pin is bound to exactly one model tuple.
        throw invalid(`routeCatalog.${routeRef}: pluginVersion ${GPT6_LUNA_ROUTE_V1.pluginVersion} is the ${GPT6_LUNA_ROUTE_V1.model} tuple pin and requires model ${GPT6_LUNA_ROUTE_V1.model} (got ${JSON.stringify(route.model)})`)
      }
      if (isLegacyCodexTuple && route.model === GPT6_LUNA_ROUTE_V1.model) {
        // ACC-G6R-005: the GPT-6 tuple with the wrong pluginVersion is a
        // negative fixture, never a valid route.
        throw invalid(`routeCatalog.${routeRef}: model ${GPT6_LUNA_ROUTE_V1.model} requires pluginVersion ${GPT6_LUNA_ROUTE_V1.pluginVersion} (got ${JSON.stringify(route.pluginVersion)})`)
      }
      // GPT6_LUNA_AND_REASONING_EFFORT_V1: an explicit per-route reasoning
      // effort is legal ONLY on the GPT-6 tuple — the provisioned passthrough
      // seam of the patched dsh-codex artifact (DEC-G6R-004). Builtin routes,
      // non-dsh-codex subscription routes and the legacy dsh-codex@0.2.3
      // tuple carrying the field are malformed configuration and fail loud.
      // The value vocabulary is the closed REASONING_EFFORT_VALUES set;
      // per-MODEL capability is enforced downstream fail-loud
      // (dsh-llm UNSUPPORTED_REASONING_EFFORT, never a clamp or fallback).
      if (hasReasoningEffort && !isGpt6Tuple) {
        throw invalid(`routeCatalog.${routeRef}.reasoningEffort is only supported on the GPT-6 Luna tuple (${GPT6_LUNA_ROUTE_V1.plugin}@${GPT6_LUNA_ROUTE_V1.pluginVersion} subscription routes; routeKind ${routeKind}${isSubscription ? ', plugin ' + JSON.stringify(route.plugin) + ', pluginVersion ' + JSON.stringify(route.pluginVersion) : ''})`)
      }
      if (hasReasoningEffort && !REASONING_EFFORT_VALUES.includes(route.reasoningEffort)) {
        throw invalid(`routeCatalog.${routeRef}.reasoningEffort must be one of ${REASONING_EFFORT_VALUES.join(', ')} (got ${JSON.stringify(route.reasoningEffort)})`)
      }
      const providerEnv = hasProviderEnv ? validateProviderEnv(route.providerEnv) : undefined
      const frozenRoute = Object.freeze({
        routeKind,
        provider: route.provider,
        model: route.model,
        ...(isSubscription ? { plugin: route.plugin, pluginVersion: route.pluginVersion } : {}),
        ...(isOpenAICodex ? { credentialFile: route.credentialFile } : {}),
        credentialReadiness: route.credentialReadiness,
        ...(hasReasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
        ...(providerEnv === undefined ? {} : { providerEnv }),
      })
      const canonical = catalogCanonicalIdentity(frozenRoute)
      if (canonicalIdentities.has(canonical)) {
        throw invalid(`routeCatalog.${routeRef} and ${canonicalIdentities.get(canonical)} resolve to the same canonical route identity`)
      }
      canonicalIdentities.set(canonical, routeRef)
      catalog.set(routeRef, frozenRoute)
    }
    // overrides: exactly the activated scope, registered agents only.
    const registered = new Set(registeredAgentIds)
    for (const [agentId, entry] of Object.entries(parsed.overrides)) {
      if (!registered.has(agentId)) throw invalid(`unregistered agentId ${JSON.stringify(agentId)}`)
      if (!exactKeys(entry, ['model']) || entry.model === null || typeof entry.model !== 'object'
          || Array.isArray(entry.model) || !exactKeys(entry.model, ['fallbacks', 'primary'])) {
        throw invalid(`override ${agentId} must contain exactly model.{primary, fallbacks}`)
      }
      const primary = assertNonEmptyString(entry.model.primary, `override ${agentId}.model.primary`)
      if (!Array.isArray(entry.model.fallbacks)) throw invalid(`override ${agentId}.model.fallbacks must be an array`)
      const chain = [primary, ...entry.model.fallbacks]
      const seenRefs = new Set()
      for (const routeRef of chain) {
        assertNonEmptyString(routeRef, `override ${agentId}.model routeRef`)
        if (!catalog.has(routeRef)) throw invalid(`override ${agentId} references unknown routeCatalog entry ${JSON.stringify(routeRef)}`)
        if (seenRefs.has(routeRef)) throw invalid(`override ${agentId} repeats routeRef ${JSON.stringify(routeRef)}`)
        seenRefs.add(routeRef)
      }
      if (chain.length > MAX_CONFIGURED_ROUTES) {
        throw invalid(`override ${agentId} chain length ${chain.length} exceeds MAX_CONFIGURED_ROUTES ${MAX_CONFIGURED_ROUTES}`)
      }
      mutableOverrides.set(agentId, Object.freeze({
        primary,
        fallbacks: Object.freeze([...entry.model.fallbacks]),
        routes: Object.freeze(Object.fromEntries(chain.map((ref) => [ref, catalog.get(ref)]))),
      }))
    }
  }
  const overrides = Object.freeze(Object.fromEntries(mutableOverrides))

  const passthroughRoute = (globalRoute) => Object.freeze({
    routeRef: null,
    provider: globalRoute.provider,
    model: globalRoute.model,
    identity: canonicalRouteIdentity(globalRoute),
    // DEFAULT_MODEL_ROUTING_CONFIG_V1: a composition-provided subscription
    // (the built-in Luna default) rides the legacy passthrough so the
    // zero-config spawn provisions like an explicitly configured route;
    // absent (env/opts routes) keeps the historical two-field shape.
    processConfig: Object.freeze({
      provider: globalRoute.provider,
      model: globalRoute.model,
      ...(globalRoute.subscription === undefined ? {} : { subscription: globalRoute.subscription }),
    }),
  })

  const chainIds = new Map()
  function chainIdFor(agentId, identities) {
    const digest = createHash('sha256').update(JSON.stringify(identities)).digest('hex').slice(0, 16)
    const id = `chain-${agentId}-${digest}`
    chainIds.set(id, true)
    return id
  }

  return Object.freeze({
    filePresent,
    overrides,
    resolve(agentId, globalRoute) {
      const override = overrides[agentId]
      if (override === undefined) {
        return Object.freeze({
          provider: globalRoute.provider,
          model: globalRoute.model,
          ...(globalRoute.subscription === undefined ? {} : { subscription: globalRoute.subscription }),
        })
      }
      const route = override.routes[override.primary]
      return Object.freeze({
        provider: route.provider,
        model: route.model,
        ...(route.plugin === undefined ? {} : { plugin: route.plugin, pluginVersion: route.pluginVersion }),
        ...(route.credentialFile === undefined ? {} : { credentialFile: route.credentialFile }),
        ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
        ...(route.providerEnv === undefined ? {} : { providerEnv: route.providerEnv }),
      })
    },
    /** Immutable turn-start chain snapshot (parent CTR-007). */
    resolveChain(agentId, globalRoute) {
      const override = overrides[agentId]
      if (override === undefined) {
        const route = passthroughRoute(globalRoute)
        return Object.freeze({
          agentId,
          override: false,
          chainId: chainIdFor(agentId, [route.identity]),
          routes: Object.freeze([route]),
        })
      }
      const chain = [override.primary, ...override.fallbacks]
      const routes = Object.freeze(chain.map((ref) => makeChainRoute(ref, override.routes[ref])))
      return Object.freeze({
        agentId,
        override: true,
        chainId: chainIdFor(agentId, routes.map((route) => route.identity)),
        routes,
      })
    },
  })
}
