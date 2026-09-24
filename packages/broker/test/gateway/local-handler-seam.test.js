/**
 * DSH_AGENT_CORE_MODULARITY_PHASE_A_V1 — the generic LOCAL handler seam.
 *
 * Two architectural regressions in one file:
 *
 *   1. BEHAVIORAL (the load-bearing one): a capability provider the broker
 *      has NEVER heard of — an invented business name, a local manifest and
 *      an injected handler map — is callable end to end through the REAL
 *      applyBroker gateway path. Adding a new LOCAL capability must never
 *      require touching the broker.
 *   2. STATIC: the broker source must not re-grow a business provider
 *      service-name enumeration — no `ctx.get('<something>Access')` may
 *      appear anywhere under packages/broker/src. Composition owns business
 *      names; the broker stays generic.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BROKER_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

test('generic seam: an unknown-to-the-broker capability provider is reachable through applyBroker gateway injection', async (t) => {
  const { createServer } = await import('node:http')
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const broker = await import('../../src/index.js')

  // An INVENTED business capability with a service name that appears
  // nowhere in the broker source. The manifest rides the configured pack
  // (config.manifests), the handler rides the injected resolver — the
  // broker learns neither name.
  const INVENTED_SERVICE = 'sentimentLookupAccess'
  const INVENTED_CAPABILITY_ID = 'agent_sentiment_lookup'

  const tokenServer = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'jwt-seam', expires_in: 3600 }))
    })
  })
  await new Promise((r) => tokenServer.listen(0, '127.0.0.1', r))
  t.after(() => new Promise((r) => tokenServer.close(r)))

  const dir = await mkdtemp(join(tmpdir(), 'acb-local-seam-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = join(dir, 'agent-credentials.json')
  await writeFile(store, JSON.stringify({
    version: 1,
    credentials: { 'agt_seam-caller': { clientId: 'client-seam', clientSecret: 'secret-seam' } },
  }, null, 2))

  const seen = []
  const inventedService = {
    handlers: {
      [INVENTED_CAPABILITY_ID]: {
        lookup: async (args, context) => {
          seen.push({ args, caller: context?.callerAgentId })
          return { ok: true, result: { sentiment: 'sunny', for: args.agentId } }
        },
      },
    },
  }
  const inventedManifest = {
    id: INVENTED_CAPABILITY_ID,
    toolName: INVENTED_CAPABILITY_ID,
    selector: 'operation',
    name: 'Invented Sentiment Lookup',
    description: 'test-only invented capability proving the generic seam',
    local: { resource: 'invented' },
    requiredScopes: [],
    errors: [{ code: 'invalid_arguments', description: 'bad args' }],
    operations: [{
      name: 'lookup',
      description: 'lookup',
      arguments: { properties: { agentId: { type: 'string' } }, required: ['agentId'] },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
    }],
  }

  const provided = {}
  const ctx = {
    get: (name) => (name === INVENTED_SERVICE ? inventedService : undefined),
    provide: (name, value) => { provided[name] = value },
  }

  broker.apply(ctx, {
    mode: 'gateway',
    manifests: [inventedManifest],
    credentialsFile: store,
    authServiceOrigin: `http://127.0.0.1:${tokenServer.address().port}`,
    // Composition-owned enumeration — exactly what production compose.js does.
    resolveLocalHandlers: () => ({
      ...(ctx.get(INVENTED_SERVICE)?.handlers ?? {}),
    }),
  })
  const gateway = provided.brokerGateway
  assert.notEqual(gateway, undefined)

  const result = await gateway.execute(
    { capabilityId: INVENTED_CAPABILITY_ID, operation: 'lookup', args: { agentId: 'agt_seam-target' } },
    { agentId: 'agt_seam-caller' },
  )
  assert.deepEqual(result, { ok: true, result: { sentiment: 'sunny', for: 'agt_seam-target' } })
  assert.deepEqual(seen, [{ args: { agentId: 'agt_seam-target' }, caller: 'agt_seam-caller' }],
    'the invented provider ran through the generic seam with the gateway-frozen caller')
})

test('static regression: no business provider service-name enumeration grows back into broker/src', () => {
  // `ctx.get('<name>Access')` is the LOCAL provider enumeration pattern the
  // modularity phase removed from the gateway branch. Its return anywhere
  // under broker/src means the broker started hard-coding business service
  // names again. (Capability-id strings in manifests are data and stay legal;
  // the broker-owned generic 'agentRpc' child service is read WITHOUT the
  // Access-suffix provider pattern and is unaffected.)
  const businessEnumeration = /ctx\.get\(\s*['"][A-Za-z0-9]*Access['"]\s*\)/
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        if (businessEnumeration.test(readFileSync(full, 'utf8'))) offenders.push(full)
      }
    }
  }
  walk(join(BROKER_ROOT, 'src'))
  assert.deepEqual(offenders, [],
    'broker/src must never enumerate composition-owned provider services (inject them via resolveLocalHandlers)')
})
