import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../src/schema.js'
import {
  assertValidManifest,
  invoke,
  resolveCode,
  validateArguments,
} from '../src/mapping.js'
import { createIdentityResolver } from '../src/identity.js'
import { manifest as calculatorManifest, handlers as calculatorHandlers } from '../src/calculator.manifest.js'
import { buildToolDefinition, registerCapability } from '../src/registry.js'

// ---- minimal echo capability used to prove manifest-driven genericity ----
const echoManifest = {
  id: 'demo.echo',
  toolName: 'demo_echo',
  name: 'Echo',
  description: 'Echo a message back to the caller.',
  errors: [
    { code: 'invalid_arguments', description: 'Arguments invalid.' },
    { code: 'unsupported_operation', description: 'Unsupported.' },
  ],
  operations: [
    {
      name: 'echo',
      description: 'Return { message } unchanged.',
      arguments: {
        properties: { message: { type: 'string', required: true, description: 'Text to echo.' } },
        required: ['message'],
      },
      result: { type: 'object' },
      errors: ['invalid_arguments'],
    },
  ],
}
const echoHandlers = {
  echo: (_op, args) => ({ message: args.message }),
}
// ----/echo ----

test('schema: valid calculator manifest passes and is canonicalized', () => {
  const res = validateManifest(calculatorManifest)
  assert.equal(res.ok, true)
  const m = res.manifest
  assert.equal(m.id, 'external.calculator')
  assert.equal(m.toolName, 'external_calculator')
  assert.equal(m.operations.length, 4)
  assert.deepEqual(m.operations.map(o => o.name), ['add', 'subtract', 'multiply', 'divide'])
  assert.deepEqual(m.errors.map(e => e.code), [
    'invalid_arguments', 'unsupported_operation', 'divide_by_zero',
  ])
  // toolName derived from id when absent
  const derived = validateManifest({ ...calculatorManifest, toolName: undefined })
  assert.equal(derived.ok, true)
  assert.equal(derived.manifest.toolName, 'external_calculator')
})

test('schema: rejects non-object input', () => {
  assert.equal(validateManifest(null).ok, false)
  assert.equal(validateManifest(42).ok, false)
  assert.equal(validateManifest('x').ok, false)
  assert.equal(validateManifest([1]).ok, false)
})

test('schema: rejects missing operations', () => {
  const res = validateManifest({ id: 'a.b', description: 'x', operations: [] })
  assert.equal(res.ok, false)
  assert.ok(res.errors.some(e => e.includes('operations')))
})

test('schema: rejects invalid error-code table', () => {
  // code not a lowercase identifier
  const bad1 = validateManifest({
    id: 'a.b', description: 'x', errors: [{ code: 'Bad Code' }],
    operations: [{ name: 'op', arguments: { properties: {} } }],
  })
  assert.equal(bad1.ok, false)
  assert.ok(bad1.errors.some(e => e.includes('code')))
  // duplicate code
  const bad2 = validateManifest({
    id: 'a.b', description: 'x',
    errors: [{ code: 'e1' }, { code: 'e1' }],
    operations: [{ name: 'op', arguments: { properties: {} } }],
  })
  assert.equal(bad2.ok, false)
  assert.ok(bad2.errors.some(e => e.includes('duplicate')))
  // operation references undeclared code
  const bad3 = validateManifest({
    id: 'a.b', description: 'x',
    errors: [{ code: 'e1' }],
    operations: [{ name: 'op', errors: ['nope'], arguments: { properties: {} } }],
  })
  assert.equal(bad3.ok, false)
  assert.ok(bad3.errors.some(e => e.includes('undeclared code')))
})

test('schema: rejects invalid parameter schema', () => {
  // bad property type
  const bad = validateManifest({
    id: 'a.b', description: 'x',
    operations: [{ name: 'op', arguments: { properties: { a: { type: 'nope' } } } }],
  })
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.some(e => e.includes('type')))
  // required entry not a string
  const bad2 = validateManifest({
    id: 'a.b', description: 'x',
    operations: [{ name: 'op', arguments: { properties: { a: { type: 'number' } }, required: [1] } }],
  })
  assert.equal(bad2.ok, false)
  assert.ok(bad2.errors.some(e => e.includes('required')))
})

test('V0 regression: multiply(6,7) = 42 through the mapping layer', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'multiply', args: { a: 6, b: 7 } }, { resolvePrincipal: () => undefined })
  assert.deepEqual(res, { ok: true, result: 42 })
})

test('mapping: invalid_arguments for non-numeric operands', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'add', args: { a: 'x', b: 1 } }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'invalid_arguments' } })
  const res2 = await invoke(manifest, calculatorHandlers, { operation: 'add', args: { a: 1 } }, {})
  assert.deepEqual(res2, { ok: false, error: { code: 'invalid_arguments' } })
})

test('mapping: divide_by_zero maps correctly', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'divide', args: { a: 10, b: 0 } }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'divide_by_zero' } })
})

test('mapping: unsupported_operation for unknown operation', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const res = await invoke(manifest, calculatorHandlers, { operation: 'modulo', args: { a: 1, b: 2 } }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'unsupported_operation' } })
})

test('mapping: declared arithmetic results for all four operations', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  const cases = [
    ['add', [1, 2], { ok: true, result: 3 }],
    ['subtract', [10, 4], { ok: true, result: 6 }],
    ['multiply', [6, 7], { ok: true, result: 42 }],
    ['divide', [9, 3], { ok: true, result: 3 }],
  ]
  for (const [op, [a, b], expected] of cases) {
    const res = await invoke(manifest, calculatorHandlers, { operation: op, args: { a, b } }, {})
    assert.deepEqual(res, expected)
  }
})

test('mapping: unknown error code fails closed to a declared code', async () => {
  const manifest = assertValidManifest({
    id: 'a.b', description: 'x',
    errors: [{ code: 'invalid_arguments' }],
    operations: [{ name: 'op', arguments: { properties: {} } }],
  })
  const res = await invoke(manifest, { op: () => ({ errorCode: 'completely_unknown' }) }, { operation: 'op', args: {} }, {})
  assert.deepEqual(res, { ok: false, error: { code: 'invalid_arguments' } })
})

test('resolveCode: unknown code downgraded to fallback', () => {
  const manifest = assertValidManifest(calculatorManifest)
  assert.deepEqual(resolveCode(manifest, 'unsupported_operation', 'unsupported_operation'), { code: 'unsupported_operation' })
  assert.deepEqual(resolveCode(manifest, 'nope', 'unsupported_operation'), { code: 'unsupported_operation' })
})

test('validateArguments: property/required enforcement', () => {
  const schema = { properties: { a: { type: 'number' }, b: { type: 'string', enum: ['x', 'y'] } }, required: ['a', 'b'] }
  assert.deepEqual(validateArguments(schema, { a: 1, b: 'x' }), [])
  assert.ok(validateArguments(schema, { a: 1 }).length > 0)
  assert.ok(validateArguments(schema, { a: 'no', b: 'x' }).length > 0)
  assert.ok(validateArguments(schema, { a: 1, b: 'z' }).length > 0)
  assert.ok(validateArguments(schema, 'not-an-object').length > 0)
})

test('registration: tool name / description / parameter schema conform for calculator', () => {
  const spy = []
  const tool = registerCapability(
    { manifest: calculatorManifest, handlers: calculatorHandlers },
    { register: d => spy.push(d) },
    d => d, // passthrough define
  )
  assert.equal(spy.length, 1)
  assert.equal(spy[0].name, 'external_calculator')
  assert.ok(spy[0].description.includes('external.calculator'))
  assert.ok(spy[0].description.includes('multiply'))
  // operation enum
  assert.deepEqual(spy[0].parameters.operation.enum, ['add', 'subtract', 'multiply', 'divide'])
  assert.equal(spy[0].parameters.operation.required, true)
  // shared operands required (every operation requires them)
  assert.equal(spy[0].parameters.a.required, true)
  assert.equal(spy[0].parameters.b.required, true)
})

test('identity: tool parameter schema has NO principal field', () => {
  const { definition } = buildToolDefinition({ manifest: calculatorManifest, handlers: calculatorHandlers })
  const names = Object.keys(definition.parameters)
  assert.ok(!names.some(n => /principal|agentid|credential|identity/i.test(n)))
  // nested property schemas too
  const flat = JSON.stringify(definition.parameters).toLowerCase()
  assert.ok(!flat.includes('principalid'))
})

test('identity: model-supplied principalId in args is ignored', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  // args carry a smuggled principalId; mapping must ignore it and still compute
  const res = await invoke(manifest, calculatorHandlers, {
    operation: 'multiply',
    args: { a: 6, b: 7, principalId: 'AGENT_B' },
  }, { resolvePrincipal: () => undefined })
  assert.deepEqual(res, { ok: true, result: 42 })
})

test('identity: identity is only obtained via resolvePrincipal (injected and called)', async () => {
  const manifest = assertValidManifest(calculatorManifest)
  let calls = 0
  let observedPrincipal
  // a handler that records the principal it received
  const observingHandlers = {
    multiply: (_op, _args, principal) => {
      observedPrincipal = principal
      return 42
    },
    add: calculatorHandlers.add,
    subtract: calculatorHandlers.subtract,
    divide: calculatorHandlers.divide,
  }
  const resolver = () => { calls += 1; return 'principal-A' }
  const res = await invoke(manifest, observingHandlers, { operation: 'multiply', args: { a: 6, b: 7 } }, { resolvePrincipal: resolver })
  assert.deepEqual(res, { ok: true, result: 42 })
  assert.equal(calls, 1)
  assert.equal(observedPrincipal, 'principal-A')
})

test('identity: resolvePrincipal placeholder reads env, falls back to injected', () => {
  const viaEnv = createIdentityResolver({ source: { AGENT_CORE_PRINCIPAL: 'principal-env' } })
  assert.equal(viaEnv(), 'principal-env')
  const viaInjected = createIdentityResolver({ source: {}, injected: 'principal-injected' })
  assert.equal(viaInjected(), 'principal-injected')
  const neither = createIdentityResolver({ source: {} })
  assert.equal(neither(), undefined)
})

test('manifest-driven genericity: a different manifest registers a different tool', () => {
  const spy = []
  const tool = registerCapability(
    { manifest: echoManifest, handlers: echoHandlers },
    { register: d => spy.push(d) },
    d => d,
  )
  assert.equal(spy.length, 1)
  assert.equal(spy[0].name, 'demo_echo')
  assert.ok(spy[0].description.includes('demo.echo'))
  assert.deepEqual(spy[0].parameters.operation.enum, ['echo'])
  assert.equal(spy[0].parameters.message.required, true)
  assert.ok(!spy[0].parameters.a) // calculator operands must NOT leak in
})

test('manifest-driven genericity: echo executes through the same pipeline', async () => {
  const manifest = assertValidManifest(echoManifest)
  const res = await invoke(manifest, echoHandlers, { operation: 'echo', args: { message: 'hi' } }, {})
  assert.deepEqual(res, { ok: true, result: { message: 'hi' } })
})

test('buildToolDefinition exposes capabilityId constant', () => {
  const { capabilityId, definition } = buildToolDefinition({ manifest: calculatorManifest })
  assert.equal(capabilityId, 'external.calculator')
  assert.equal(definition.name, 'external_calculator')
})

// ═══ AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 (accepted) ═════════════════
//
// Moderator pack registration boundary (CTR-FMC-004) + the three bounded
// generic deltas (CTR-FMC-013): PATCH allowlist, nonBlank leaf validation,
// and the sanitizer's additive hardening are unit-proved here (their
// end-to-end business behavior is proved in capabilities.test.js).

// The broker plugin entry (src/index.js) imports `@deepseek-ai/dsh-tools`
// (defineTool), which exists only in the DSH runtime composition — that is why
// no historical test imports index.js. The registration boundary
// (CTR-FMC-004) lives there, so these tests bootstrap a MINIMAL passthrough
// stub into the gitignored root node_modules (never overwriting a real
// package when one is present) and import the entry dynamically. The stub
// changes no product file and no closure file.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const stubDir = join(repoRoot, 'node_modules', '@deepseek-ai', 'dsh-tools')
if (!existsSync(join(stubDir, 'package.json'))) {
  mkdirSync(stubDir, { recursive: true })
  writeFileSync(join(stubDir, 'package.json'), `${JSON.stringify({
    name: '@deepseek-ai/dsh-tools',
    version: '0.0.0-unit-test-passthrough',
    type: 'module',
    main: 'index.js',
    exports: './index.js',
  }, null, 2)}\n`)
  writeFileSync(join(stubDir, 'index.js'), 'export const defineTool = (options) => options\n')
}
const {
  DEFAULT_MANIFESTS,
  resolveForumModeratorRegistration,
  apply: brokerApply,
} = await import('../src/index.js')
import { manifests as forumFirstBatch } from '../src/capabilities/forum.js'
import { moderatorManifests } from '../src/capabilities/forum-moderation.js'
import { createHttpHandlers, createHttpTransport } from '../src/transport.js'

const MODERATOR_TOOL_NAMES = [
  'forum_pin_or_feature_thread', 'forum_delete_thread', 'forum_delete_message',
  'forum_resolve_thread', 'forum_archive_thread', 'forum_moderation_queue',
  'forum_handle_report', 'forum_admin_unread',
]

const withEnv = (env, fn) => {
  const saved = { ...process.env }
  Object.assign(process.env, env)
  try {
    return fn()
  } finally {
    process.env = { ...saved }
  }
}

// ─── CTR-FMC-004: closed-list registration resolution (pure matrix) ────────

test('CTR-FMC-004: exact moderator id + valid closed list registers 8 tools', () => {
  const { manifests, reason } = withEnv(
    { DSH_AGENT_ID: 'agt_course-community-agent-2' },
    () => resolveForumModeratorRegistration({ forumModeratorAgentIds: ['agt_course-community-agent-2'] }),
  )
  assert.equal(manifests.length, 8)
  assert.deepEqual(manifests.map((m) => m.toolName).sort(), [...MODERATOR_TOOL_NAMES].sort())
  assert.match(reason, /registered for "agt_course-community-agent-2"/)
})

test('CTR-FMC-004: non-member agent registers ZERO moderator tools', () => {
  for (const agentId of ['agt_someone-else', 'course-community-agent-2', 'agt_course-community-agent', '']) {
    const { manifests } = withEnv(
      { DSH_AGENT_ID: agentId },
      () => resolveForumModeratorRegistration({ forumModeratorAgentIds: ['agt_course-community-agent-2'] }),
    )
    assert.equal(manifests.length, 0, `agentId=${JSON.stringify(agentId)} must get zero moderator tools`)
  }
})

test('CTR-FMC-004: missing/absent DSH_AGENT_ID registers ZERO moderator tools', () => {
  withEnv({ DSH_AGENT_ID: '' }, () => {
    const { manifests, reason } = resolveForumModeratorRegistration({ forumModeratorAgentIds: ['agt_course-community-agent-2'] })
    assert.equal(manifests.length, 0)
    assert.match(reason, /DSH_AGENT_ID is absent/)
  })
  const envWithout = { ...process.env }
  delete envWithout.DSH_AGENT_ID
  const { manifests } = resolveForumModeratorRegistration({ forumModeratorAgentIds: ['agt_x'] }, envWithout)
  assert.equal(manifests.length, 0)
})

test('CTR-FMC-004: malformed config fails closed with ZERO moderator tools', () => {
  const validEnv = { DSH_AGENT_ID: 'agt_course-community-agent-2' }
  for (const config of [
    {}, // missing
    { forumModeratorAgentIds: [] }, // empty
    { forumModeratorAgentIds: ['agt_a', 'agt_a'] }, // duplicate
    { forumModeratorAgentIds: ['course-community-agent-2'] }, // non-agt_*
    { forumModeratorAgentIds: ['agt_ok', 'not-agt'] }, // one invalid entry
    { forumModeratorAgentIds: 'agt_course-community-agent-2' }, // wrong type
    { forumModeratorAgentIds: [42] }, // non-string entry
    { forumModeratorAgentIds: ['*'] }, // wildcard
  ]) {
    const { manifests, reason } = withEnv(validEnv, () => resolveForumModeratorRegistration(config))
    assert.equal(manifests.length, 0, `config=${JSON.stringify(config)} must register zero moderator tools`)
    assert.ok(typeof reason === 'string' && reason.length > 0)
  }
})

test('CTR-FMC-002: DEFAULT_MANIFESTS gains the five normal tools and NO moderator tools', () => {
  const ids = DEFAULT_MANIFESTS.map((m) => m.id)
  for (const id of ['forum_create_thread', 'forum_watch_thread', 'forum_unwatch_thread', 'forum_report_content', 'forum_stats']) {
    assert.ok(ids.includes(id), `${id} must be in DEFAULT_MANIFESTS`)
  }
  for (const id of ['forum_pin_or_feature_thread', 'forum_delete_thread', 'forum_delete_message', 'forum_resolve_thread', 'forum_archive_thread', 'forum_moderation_queue', 'forum_handle_report', 'forum_admin_unread']) {
    assert.ok(!ids.includes(id), `${id} must NOT be default-registered (closed-list gate only)`)
  }
  // The seven first-batch Forum tools are all still default-registered.
  for (const m of forumFirstBatch) assert.ok(ids.includes(m.id))
})

// ─── apply()-level child registration: normal fast path vs moderator gate ───

function fakeCtx() {
  const registered = []
  return {
    registered,
    tools: { register: (definition) => registered.push(definition) },
    get: () => undefined,
    provide: () => {},
  }
}

test('apply() child mode: normal agent registers the 5 normal tools, ZERO moderator tools (config present)', () => {
  const ctx = fakeCtx()
  withEnv({ DSH_AGENT_ID: 'agt_plain-agent' }, () => {
    brokerApply(ctx, { mode: 'child', forumModeratorAgentIds: ['agt_course-community-agent-2'] })
  })
  const names = new Set(ctx.registered.map((d) => d.name))
  for (const t of ['forum_create_thread', 'forum_watch_thread', 'forum_unwatch_thread', 'forum_report_content', 'forum_stats']) {
    assert.ok(names.has(t), `normal agent missing normal tool ${t}`)
  }
  for (const t of MODERATOR_TOOL_NAMES) assert.ok(!names.has(t), `normal agent must NOT see ${t}`)
})

test('apply() child mode: normal pack works with NO moderator config at all (fast path)', () => {
  const ctx = fakeCtx()
  withEnv({ DSH_AGENT_ID: 'agt_plain-agent' }, () => brokerApply(ctx, { mode: 'child' }))
  const names = new Set(ctx.registered.map((d) => d.name))
  assert.ok(names.has('forum_stats'))
  assert.ok(names.has('forum_reply')) // first-batch still present
  for (const t of MODERATOR_TOOL_NAMES) assert.ok(!names.has(t))
})

test('apply() child mode: exact moderator registers all 8 moderator tools', () => {
  const ctx = fakeCtx()
  withEnv({ DSH_AGENT_ID: 'agt_course-community-agent-2' }, () => {
    brokerApply(ctx, { mode: 'child', forumModeratorAgentIds: ['agt_course-community-agent-2'] })
  })
  const names = new Set(ctx.registered.map((d) => d.name))
  for (const t of MODERATOR_TOOL_NAMES) assert.ok(names.has(t), `moderator missing ${t}`)
  // and the normal pack is fully present too
  for (const t of ['forum_create_thread', 'forum_stats', 'forum_reply']) assert.ok(names.has(t))
})

test('apply() child mode: malformed moderator config fails closed without breaking normal tools', () => {
  const ctx = fakeCtx()
  withEnv({ DSH_AGENT_ID: 'agt_course-community-agent-2' }, () => {
    brokerApply(ctx, { mode: 'child', forumModeratorAgentIds: ['dup', 'dup'] })
  })
  const names = new Set(ctx.registered.map((d) => d.name))
  for (const t of MODERATOR_TOOL_NAMES) assert.ok(!names.has(t))
  assert.ok(names.has('forum_create_thread'), 'normal pack must survive invalid moderator config')
})

test('apply() gateway mode: moderator manifests retained for trusted relay execution', async () => {
  const provided = []
  const ctx = {
    tools: { register: () => {} },
    get: () => undefined,
    provide: (key, value) => provided.push({ key, value }),
  }
  withEnv({ DSH_AGENT_ID: 'agt_plain-agent' }, () => {
    brokerApply(ctx, { mode: 'gateway', credentialsFile: '/nonexistent-test-store.json' })
  })
  assert.equal(provided.length, 1)
  assert.equal(provided[0].key, 'brokerGateway')
  const gateway = provided[0].value
  // A moderator capability is resolvable in the gateway (reaches the
  // credential layer and fails closed credential_unavailable — versus an
  // unknown capability which is rejected as unsupported before that).
  const known = await gateway.execute({ capabilityId: 'forum_admin_unread', operation: 'unread', args: {} })
  assert.equal(known.ok, false)
  assert.equal(known.error.code, 'credential_unavailable')
  const unknown = await gateway.execute({ capabilityId: 'forum_does_not_exist', operation: 'x', args: {} })
  assert.equal(unknown.ok, false)
  assert.notEqual(unknown.error.code, 'credential_unavailable')
})

test('writer-only moderator call reaches Credential/Auth once and never business HTTP', async () => {
  const calls = { credentialCalls: 0, tokenCalls: 0, businessCalls: 0 }
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/oauth/token')) {
      calls.tokenCalls += 1
      return new Response('{"error":"invalid_scope"}', { status: 400, headers: { 'content-type': 'application/json' } })
    }
    calls.businessCalls += 1
    throw new Error('business HTTP must not run')
  }
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => { calls.credentialCalls += 1; return { clientId: 'writer', clientSecret: 'secret' } } },
    targets: [{ targetId: 'svc-forum', audience: 'svc-forum', allowedOrigin: 'https://forum.invalid' }],
    authServiceOrigin: 'https://auth.invalid', fetchImpl,
  })
  const manifest = moderatorManifests.find((item) => item.id === 'forum_admin_unread')
  const { definition } = buildToolDefinition({ manifest, handlers: createHttpHandlers(manifest, transport), deps: { resolvePrincipal: () => undefined } })
  const result = await definition.execute({ operation: 'unread' })
  assert.equal(result.error.code, 'authorization_denied')
  assert.deepEqual(calls, { credentialCalls: 1, tokenCalls: 1, businessCalls: 0 })
})
