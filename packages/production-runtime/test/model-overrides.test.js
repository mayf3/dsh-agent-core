import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  CHATGPT_SUBSCRIPTION_V1,
  loadAgentModelOverrides,
  MAX_CONFIGURED_ROUTES,
  PROVIDER_ENV_ALLOWLIST,
} from '../src/model-overrides.js'
import { agentEnv } from '../../agent-router/src/process/env.js'

const TARGET = CHATGPT_SUBSCRIPTION_V1.targetAgentId
const OTHER = 'agt_other'
const GLOBAL = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })
const VALID_PROVIDER_ENV = Object.freeze({
  HTTP_PROXY: 'http://127.0.0.1:7890',
  HTTPS_PROXY: 'http://127.0.0.1:7890',
  NO_PROXY: 'localhost,127.0.0.1,::1',
  NODE_USE_ENV_PROXY: '1',
})

/**
 * agent-model-overrides.json version 3 (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
 * §2 + Amendment 1 A1.2/A1.4): routeCatalog + overrides.<agentId>.model.
 * {primary, fallbacks[]}. The fixture IS the frozen initial chain tuple:
 * glm53 = builtin (plugin/pluginVersion ABSENT), luna = subscription
 * (dsh-codex@0.2.3 exact). Route CONTENT lives entirely in the config — the
 * code constant below only carries pins/scope (F-10 / ACC-014).
 */
const CATALOG = Object.freeze({
  glm53: {
    routeKind: 'builtin',
    provider: 'zai',
    model: 'glm-5.3',
    credentialReadiness: 'zai-api-key-home',
  },
  luna: {
    routeKind: 'subscription',
    provider: 'openai-codex',
    model: 'gpt-5.6-luna',
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
    credentialReadiness: 'luna-oauth-home',
  },
})
const VALID = {
  version: 3,
  routeCatalog: CATALOG,
  overrides: {
    [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna'] } },
  },
}

test('the code constant carries ONLY pins and scope — no route tuple values (F-10)', () => {
  assert.equal(CHATGPT_SUBSCRIPTION_V1.targetAgentId, 'agt_cto-agent')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.plugin, 'dsh-codex')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.pluginVersion, '0.2.3')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.dshVersion, '0.1.0-rc.8')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.dshCommit, '514ab7b0029141b88c807704764d0d3e1eea1da4')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.credentialFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  assert.equal(CHATGPT_SUBSCRIPTION_V1.provider, undefined, 'provider must come from config only')
  assert.equal(CHATGPT_SUBSCRIPTION_V1.model, undefined, 'model must come from config only')
  assert.equal(MAX_CONFIGURED_ROUTES, 4)
})

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'model-overrides-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, file: join(root, 'agent-model-overrides.json') }
}

function write(file, value) {
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

function invalid(file, source, extra = []) {
  write(file, source)
  assert.throws(
    () => loadAgentModelOverrides(file, [TARGET, OTHER]),
    (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID',
    typeof source === 'string' ? source : JSON.stringify(source),
  )
  for (const agents of extra) {
    assert.throws(() => loadAgentModelOverrides(file, agents), (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  }
}

test('missing file = global passthrough; valid v3 chain resolves primary-first with identities', (t) => {
  const { file } = fixture(t)
  const missing = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(missing.filePresent, false)
  const passthrough = missing.resolveChain(TARGET, GLOBAL)
  assert.equal(passthrough.override, false)
  assert.equal(passthrough.routes.length, 1)
  assert.deepEqual(
    { provider: passthrough.routes[0].provider, model: passthrough.routes[0].model },
    GLOBAL,
  )
  assert.deepEqual(passthrough.routes[0].processConfig, GLOBAL)

  write(file, VALID)
  const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(Object.keys(loaded.overrides).length, 1)
  const chain = loaded.resolveChain(TARGET, GLOBAL)
  assert.equal(chain.override, true)
  assert.deepEqual(chain.routes.map((route) => route.routeRef), ['glm53', 'luna'])
  assert.deepEqual(
    chain.routes.map((route) => [route.provider, route.model]),
    [['zai', 'glm-5.3'], ['openai-codex', 'gpt-5.6-luna']],
  )
  assert.notEqual(chain.routes[0].identity, chain.routes[1].identity)
  assert.equal(Object.isFrozen(chain.routes), true)
  assert.equal(Object.isFrozen(chain.routes[0].processConfig), true)
  // Compat single-route resolver = the chain's primary (a builtin route
  // carries no plugin fields).
  assert.deepEqual(loaded.resolve(TARGET, GLOBAL), {
    provider: 'zai', model: 'glm-5.3',
  })
  assert.deepEqual(loaded.resolve(OTHER, GLOBAL), GLOBAL)
  // Same config -> stable chain identity across loads (turn snapshot anchor).
  const again = loadAgentModelOverrides(file, [TARGET, OTHER]).resolveChain(TARGET, GLOBAL)
  assert.equal(again.chainId, chain.chainId)
})

test('version discipline: older files fail loud (no auto conversion)', (t) => {
  const { file } = fixture(t)
  invalid(file, { version: 1, overrides: { [TARGET]: { provider: 'x', model: 'y' } } })
  invalid(file, { version: 2, routeCatalog: {}, overrides: {} })
})

test('malformed family: bad JSON, wrong shape, extra keys, deep duplicate keys fail loud', (t) => {
  const { file } = fixture(t)
  invalid(file, '{not json')
  invalid(file, '[]')
  invalid(file, { ...VALID, extra: true })
  invalid(file, { version: 3, routeCatalog: CATALOG })
  invalid(file, { version: 3, routeCatalog: CATALOG, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna'] }, extra: 1 } } })
  // Duplicate JSON key at the deepest level (providerEnv), before parse.
  const luna = JSON.stringify(CATALOG.luna)
  invalid(file, `{"version":3,"routeCatalog":{"luna":${luna.slice(0, -1)},"credentialReadiness":"luna-oauth"},"overrides":{}}`)
  const override = JSON.stringify(VALID.overrides[TARGET])
  invalid(file, `{"version":3,"routeCatalog":${JSON.stringify(CATALOG)},"overrides":{"${TARGET}":${override.slice(0, -1)},"fallbacks":["luna"]}}}`)
})

test('reference integrity and dedup: unknown ref, repeated ref, canonical alias duplicates fail loud', (t) => {
  const { file } = fixture(t)
  invalid(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'missing', fallbacks: [] } } } })
  invalid(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['glm53'] } } } })
  invalid(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna', 'luna'] } } } })
  // Two different routeRefs with the SAME canonical seven-field identity
  // (ACC-017: builtin plugin/pluginVersion normalize to explicit ABSENT).
  const aliased = { ...CATALOG, glm53_alias: { ...CATALOG.glm53 } }
  invalid(file, { ...VALID, routeCatalog: aliased })
  // Same provider/model but a different credentialReadiness is a distinct
  // canonical route (the reference is part of the identity).
  const distinct = { ...CATALOG, luna_canary: { ...CATALOG.luna, credentialReadiness: 'luna-oauth-canary' } }
  write(file, { ...VALID, routeCatalog: distinct, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['luna', 'luna_canary'] } } } })
  assert.doesNotThrow(() => loadAgentModelOverrides(file, [TARGET, OTHER]))
  // ACC-017: a builtin and a subscription route with the SAME provider/model
  // never collapse — routeKind participates in the canonical identity.
  const crossKind = { ...CATALOG, glm53_sub: { ...CATALOG.glm53, routeKind: 'subscription', plugin: 'other-plugin', pluginVersion: '0.2.3' } }
  write(file, { ...VALID, routeCatalog: crossKind, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['glm53_sub'] } } } })
  assert.doesNotThrow(() => loadAgentModelOverrides(file, [TARGET, OTHER]))
})

test('hard bound: chain length ≤ MAX_CONFIGURED_ROUTES = 4 (never 2)', (t) => {
  const { file } = fixture(t)
  const extraRoutes = {
    routeB: { ...CATALOG.glm53, model: 'glm-5.3-b', credentialReadiness: 'zai-oauth-b' },
    routeC: { ...CATALOG.glm53, model: 'glm-5.3-c', credentialReadiness: 'zai-oauth-c' },
  }
  const catalog4 = { ...CATALOG, ...extraRoutes }
  // Length 4 (primary + three fallbacks) is the frozen maximum.
  write(file, { ...VALID, routeCatalog: catalog4, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['routeB', 'routeC', 'luna'] } } } })
  const loaded4 = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.equal(loaded4.resolveChain(TARGET, GLOBAL).routes.length, 4)
  // Length 5 exceeds the bound.
  const catalog5 = { ...catalog4, routeD: { ...CATALOG.glm53, model: 'glm-5.3-d', credentialReadiness: 'zai-oauth-d' } }
  invalid(file, { ...VALID, routeCatalog: catalog5, overrides: { [TARGET]: { model: { primary: 'glm53', fallbacks: ['routeB', 'routeC', 'luna', 'routeD'] } } } })
  // fallbacks: [] = strict chain of one.
  write(file, { ...VALID, overrides: { [TARGET]: { model: { primary: 'luna', fallbacks: [] } } } })
  const strict = loadAgentModelOverrides(file, [TARGET, OTHER])
  assert.deepEqual(strict.resolveChain(TARGET, GLOBAL).routes.map((route) => route.routeRef), ['luna'])
})

test('fleet activation accepts any registered Agent and rejects unregistered Agent ids', (t) => {
  const { file } = fixture(t)
  write(file, { ...VALID, overrides: { [OTHER]: VALID.overrides[TARGET] } })
  assert.doesNotThrow(() => loadAgentModelOverrides(file, [TARGET, OTHER]))
  invalid(file, { ...VALID, overrides: { agt_unregistered: VALID.overrides[TARGET] } })
  write(file, VALID)
  assert.throws(
    () => loadAgentModelOverrides(file, [OTHER]),
    /unregistered agentId/,
  )
})

test('CTR-011 pin: a dsh-codex route with any other pluginVersion fails loud (not a fallback class)', (t) => {
  const { file } = fixture(t)
  for (const pluginVersion of ['0.2.4', '^0.2.3', '0.2.2']) {
    invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: { ...CATALOG.luna, pluginVersion } } })
  }
  // A provider=openai-codex route cannot escape the canonical plugin/path by
  // changing the plugin name.
  // subscription pluginVersion must still be an exact pin (A1.2: no ^/~
  // ranges — same grammar the provisioner enforces).
  invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: { ...CATALOG.luna, plugin: 'other-plugin', pluginVersion: '9.9.9' } } })
  for (const pluginVersion of ['^9.9.9', '~9.9.0', '9.9.x', '9.x', '9.9.9 || 9.9.10', '9.9.9 - 9.9.10']) {
    invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: { ...CATALOG.luna, plugin: 'other-plugin', pluginVersion } } })
  }
})

test('shared mode rejects missing, per-home, relative, and non-canonical credentialFile values', (t) => {
  const { file } = fixture(t)
  const { credentialFile, ...missing } = CATALOG.luna
  invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: missing } })
  for (const invalidCredentialFile of [
    '.openai-codex-auth.json',
    '/Users/authsvc/agent-home/.openai-codex-auth.json',
    `${CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE}.copy`,
    '',
  ]) {
    invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: { ...CATALOG.luna, credentialFile: invalidCredentialFile } } })
  }
})

test('ACC-016 routeKind family: missing/invalid routeKind and plugin keys on a builtin fail loud', (t) => {
  const { file } = fixture(t)
  const { routeKind, ...bareGlm53 } = CATALOG.glm53
  // Missing / non-string / non-enum routeKind values are malformed.
  for (const routeKind of [undefined, 7, null, 'BUILTIN', 'hybrid', '']) {
    const glm53 = routeKind === undefined ? bareGlm53 : { ...CATALOG.glm53, routeKind }
    invalid(file, { ...VALID, routeCatalog: { ...CATALOG, glm53 } })
  }
  // A builtin route with a plugin or pluginVersion KEY present is malformed
  // whatever the value — ABSENT is the only legal builtin form.
  for (const extra of [
    { plugin: 'dsh-zai' },
    { plugin: null },
    { plugin: '' },
    { pluginVersion: '1.4.2' },
    { pluginVersion: null },
    { pluginVersion: '' },
    { plugin: 'dsh-zai', pluginVersion: '1.4.2' },
  ]) {
    invalid(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, ...extra } } })
  }
  // A subscription route missing plugin or pluginVersion is malformed.
  const bareLuna = (({ plugin, pluginVersion, ...rest }) => rest)(CATALOG.luna)
  invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: bareLuna } })
  const lunaNoVersion = (({ pluginVersion, ...rest }) => rest)(CATALOG.luna)
  invalid(file, { ...VALID, routeCatalog: { ...CATALOG, luna: lunaNoVersion } })
})

test('ACC-016/ACC-018: the frozen initial chain tuple loads; builtin processConfig has NO subscription block', (t) => {
  const { file } = fixture(t)
  // The A1.4 frozen tuple itself (glm53 builtin + luna subscription).
  write(file, VALID)
  const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
  const [primary, fallback] = loaded.resolveChain(TARGET, GLOBAL).routes
  // builtin: no subscription block, no plugin fields anywhere resolved.
  assert.equal('subscription' in primary.processConfig, false)
  assert.equal(primary.processConfig.subscription, undefined)
  assert.equal(loaded.overrides[TARGET].routes.glm53.plugin, undefined)
  assert.equal(Object.hasOwn(loaded.overrides[TARGET].routes.glm53, 'plugin'), false)
  // subscription: the provisioning block is constructed with the frozen pins.
  assert.deepEqual(fallback.processConfig.subscription, {
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    sourceCommit: CHATGPT_SUBSCRIPTION_V1.sourceCommit,
    artifactSha256: CHATGPT_SUBSCRIPTION_V1.artifactSha256,
    dshVersion: CHATGPT_SUBSCRIPTION_V1.dshVersion,
    dshCommit: CHATGPT_SUBSCRIPTION_V1.dshCommit,
    credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  })
})

test('subscription route omits the legacy oc-go credential env (Luna never inherits OPENCODE_GO_API_KEY)', (t) => {
  const { file } = fixture(t)
  write(file, VALID)
  const [primary, fallback] = loadAgentModelOverrides(file, [TARGET, OTHER]).resolveChain(TARGET, GLOBAL).routes
  // builtin route: the legacy byte-identical single omission.
  assert.deepEqual(primary.processConfig.omitEnv, ['OPENAI_API_KEY'])
  // subscription route: the Luna child also strips the legacy oc-go keys —
  // OPENCODE_GO_API_KEY (env.js injects it from <home>/.credentials.yaml on
  // every spawn) and OC_GO_API_KEY (carried by the launchd parent env).
  assert.deepEqual(fallback.processConfig.omitEnv, ['OC_GO_API_KEY', 'OPENAI_API_KEY', 'OPENCODE_GO_API_KEY'])
})

test('agentEnv boundary: the Luna child never sees the oc-go credential; the builtin child is unchanged', (t) => {
  const { root, file } = fixture(t)
  write(file, VALID)
  const [primary, fallback] = loadAgentModelOverrides(file, [TARGET, OTHER]).resolveChain(TARGET, GLOBAL).routes
  const home = join(root, 'home')
  mkdirSync(home, { recursive: true })
  writeFileSync(join(home, '.credentials.yaml'), 'OPENCODE_GO_API_KEY: "oc-go-secret"\n', 'utf8')
  const parentEnv = {
    PATH: '/usr/bin:/bin',
    OC_GO_API_KEY: 'parent-oc-go-secret',
    OPENAI_API_KEY: 'parent-openai-secret',
  }
  const previous = { ...process.env }
  // agentEnv spreads the Router parent's process.env; pin just the keys under
  // test so the assertion is hermetic against the test-runner environment.
  for (const key of Object.keys(process.env)) {
    if (key in parentEnv || key.startsWith('HTTP_PROXY') || key.startsWith('HTTPS_PROXY')) delete process.env[key]
  }
  Object.assign(process.env, parentEnv)
  try {
    const lunaEnv = agentEnv(home, {}, fallback.processConfig.omitEnv, fallback.processConfig.providerEnv ?? {})
    assert.equal('OPENCODE_GO_API_KEY' in lunaEnv, false)
    assert.equal('OC_GO_API_KEY' in lunaEnv, false)
    assert.equal('OPENAI_API_KEY' in lunaEnv, false)
    const glmEnv = agentEnv(home, {}, primary.processConfig.omitEnv, primary.processConfig.providerEnv ?? {})
    // The builtin child keeps today's exact behavior: the oc-go key from
    // <home>/.credentials.yaml is present (only OPENAI_API_KEY is omitted).
    assert.equal(glmEnv.OPENCODE_GO_API_KEY, 'oc-go-secret')
    assert.equal('OPENAI_API_KEY' in glmEnv, false)
  } finally {
    process.env = previous
  }
})

test('ACC-019 reuse-gate identity: builtin and subscription processes never share an identity', (t) => {
  const { file } = fixture(t)
  // Same provider/model/env on both sides of the routeKind boundary.
  const catalog = {
    builtinRoute: { routeKind: 'builtin', provider: 'zai', model: 'glm-5.3', credentialReadiness: 'zai-api-key-home' },
    subscriptionRoute: { routeKind: 'subscription', provider: 'zai', model: 'glm-5.3', plugin: 'other-plugin', pluginVersion: '0.2.3', credentialReadiness: 'zai-api-key-home' },
  }
  write(file, { version: 3, routeCatalog: catalog, overrides: { [TARGET]: { model: { primary: 'builtinRoute', fallbacks: ['subscriptionRoute'] } } } })
  const [builtin, subscription] = loadAgentModelOverrides(file, [TARGET, OTHER]).resolveChain(TARGET, GLOBAL).routes
  assert.notEqual(builtin.identity, subscription.identity)
  // The identity difference is exactly the plugin fields the subscription
  // process carries (canonicalRouteIdentity: plugin/pluginVersion null vs
  // exact strings) — same provider/model on both tuples.
  assert.equal(builtin.processConfig.provider, subscription.processConfig.provider)
  assert.equal(builtin.processConfig.model, subscription.processConfig.model)
})

test('providerEnv accepts only the frozen four-key set and safe host-list grammar', (t) => {
  const { file } = fixture(t)
  const validNoProxy = [
    'localhost',
    'localhost:8080',
    'example.com,api.example.com:443',
    '127.0.0.1,192.168.1.20:8443',
    '::1,2001:db8::1',
    '[::1],[2001:db8::1]:443',
    '*',
  ]
  for (const NO_PROXY of validNoProxy) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, NO_PROXY } } } })
    const loaded = loadAgentModelOverrides(file, [TARGET, OTHER])
    const providerEnv = loaded.overrides[TARGET].routes.glm53.providerEnv
    assert.deepEqual(Object.keys(providerEnv), PROVIDER_ENV_ALLOWLIST)
    assert.equal(providerEnv.NO_PROXY, NO_PROXY)
    assert.equal(Object.isFrozen(providerEnv), true)
  }

  const invalidNoProxy = [
    ' localhost', 'localhost ', 'local host', 'localhost\nexample.com',
    '"example.com"', "'example.com'", '`example.com`', '$HOST', '$(hostname)',
    'example.com,,localhost', 'bad_host', '999.1.1.1', '[not-ipv6]',
    '[::1]:0', '[::1]:65536', 'example.com:0', 'example.com:65536',
  ]
  for (const NO_PROXY of invalidNoProxy) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, NO_PROXY } } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('NO_PROXY: invalid_')
        && !error.message.includes(NO_PROXY),
      NO_PROXY,
    )
  }
})

test('providerEnv URL, key and value failures are fail-loud without secret echo', (t) => {
  const { file } = fixture(t)
  const cases = [
    ['HTTP_PROXY', '', 'invalid_non_empty_string'],
    ['HTTP_PROXY', 'not-a-url-secret', 'invalid_url'],
    ['HTTP_PROXY', 'socks5://proxy-secret.invalid:1080', 'invalid_scheme'],
    ['HTTP_PROXY', 'http://token-secret@proxy.invalid:7890', 'userinfo_forbidden'],
    ['HTTP_PROXY', 'http://proxy.invalid:7890/secret-token-path', 'path_forbidden'],
    ['HTTPS_PROXY', 'https://proxy.invalid:7890/?token=secret-query', 'query_forbidden'],
    ['HTTPS_PROXY', 'https://proxy.invalid:7890/#secret-fragment', 'fragment_forbidden'],
    ['NODE_USE_ENV_PROXY', '0', 'invalid_value'],
  ]
  for (const [key, value, invalidClass] of cases) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, [key]: value } } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes(`${key}: ${invalidClass}`)
        && (value === '' || !error.message.includes(value)),
    )
  }

  for (const providerEnv of [null, [], 'secret-value']) {
    write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv } } })
    assert.throws(
      () => loadAgentModelOverrides(file, [TARGET, OTHER]),
      (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID'
        && error.message.includes('providerEnv: invalid_type')
        && !error.message.includes('secret-value'),
    )
  }

  const missing = { ...VALID_PROVIDER_ENV }
  delete missing.NO_PROXY
  write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: missing } } })
  assert.throws(() => loadAgentModelOverrides(file, [TARGET, OTHER]), /NO_PROXY: missing_key/u)

  write(file, { ...VALID, routeCatalog: { ...CATALOG, glm53: { ...CATALOG.glm53, providerEnv: { ...VALID_PROVIDER_ENV, http_proxy: 'http://secret.invalid' } } } })
  assert.throws(
    () => loadAgentModelOverrides(file, [TARGET, OTHER]),
    (error) => error.message.includes('http_proxy: unknown_key') && !error.message.includes('secret.invalid'),
  )
})

// The composition-level runtime tests (target-proxy runtime gate, the
// runtimeFixture family: primary/global resolution, target-only rollback,
// malformed-config respawn isolation) live in model-overrides-runtime.test.js
// since the 500-line structure cap split — same suite glob, zero semantic
// change.
