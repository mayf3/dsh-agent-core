import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createBrokerGateway } from '../../src/gateway.js'
import { apply as applyBroker, DEFAULT_MANIFESTS } from '../../src/index.js'
import { validateManifest } from '../../src/schema.js'
import { targets } from '../../src/targets.js'
import {
  TARGET_HUMAN_PRINCIPAL_ID,
  WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID,
  manifests,
  workflowHumanPrincipalProjectionManifest,
} from '../../src/capabilities/workflow-human-principal-projection.js'

const exactArgs = {
  principalId: TARGET_HUMAN_PRINCIPAL_ID,
  principalType: 'HUMAN',
  status: 'active',
}

test('manifest is one exact LOCAL workflow.admin capability', () => {
  assert.deepEqual(manifests, [workflowHumanPrincipalProjectionManifest])
  assert.equal(WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID, 'workflow_human_principal_projection')
  assert.equal(workflowHumanPrincipalProjectionManifest.local.resource, 'svc-workflow')
  assert.deepEqual(workflowHumanPrincipalProjectionManifest.requiredScopes, ['workflow.admin'])
  assert.equal(workflowHumanPrincipalProjectionManifest.operations.length, 1)
  assert.equal(workflowHumanPrincipalProjectionManifest.operations[0].name, 'provision')
  assert.equal(workflowHumanPrincipalProjectionManifest.operations[0].errors.includes('internal_consistency_error'), true)
  assert.equal(validateManifest(workflowHumanPrincipalProjectionManifest).ok, true)
  assert.equal(DEFAULT_MANIFESTS.filter((manifest) => manifest.id === WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID).length, 1)
})

test('manifest exposes only three required single-value arguments', () => {
  const args = workflowHumanPrincipalProjectionManifest.operations[0].arguments
  assert.equal(args.additionalProperties, false)
  assert.deepEqual(args.required, ['principalId', 'principalType', 'status'])
  assert.deepEqual(Object.keys(args.properties), ['principalId', 'principalType', 'status'])
  assert.deepEqual(args.properties.principalId.enum, [TARGET_HUMAN_PRINCIPAL_ID])
  assert.deepEqual(args.properties.principalType.enum, ['HUMAN'])
  assert.deepEqual(args.properties.status.enum, ['active'])
  for (const forbidden of ['url', 'source', 'enabled', 'credential', 'token', 'callerAgentId', 'idempotencyKey']) {
    assert.equal(Object.hasOwn(args.properties, forbidden), false, forbidden)
  }
})

function credentialStore(t) {
  const dir = mkdtempSync(join(tmpdir(), 'whpp-gateway-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'credentials.json')
  writeFileSync(file, `${JSON.stringify({
    version: 1,
    credentials: { 'hr-agent': { clientId: 'client-hr', clientSecret: 'secret-hr' } },
  })}\n`)
  chmodSync(file, 0o600)
  return file
}

async function tokenServer(t, status) {
  const server = createServer((_req, res) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(status === 200
      ? JSON.stringify({ access_token: 'trusted-token', expires_in: 60 })
      : JSON.stringify({ error: 'insufficient_scope' }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

test('gateway denies missing credential before the LOCAL handler', async () => {
  let handlerCalls = 0
  const gateway = createBrokerGateway({
    manifests,
    targets,
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: undefined,
    localHandlers: {
      [WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID]: {
        provision: async () => { handlerCalls += 1; return { ok: true } },
      },
    },
  })
  const result = await gateway.execute({ capabilityId: WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID, operation: 'provision', args: exactArgs }, { agentId: 'hr-agent' })
  assert.equal(result.error.code, 'credential_unavailable')
  assert.equal(handlerCalls, 0)
})

test('gateway denies missing workflow.admin grant before the LOCAL handler', async (t) => {
  let handlerCalls = 0
  const gateway = createBrokerGateway({
    manifests,
    targets,
    authServiceOrigin: await tokenServer(t, 403),
    credentialsFile: credentialStore(t),
    localHandlers: {
      [WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID]: {
        provision: async () => { handlerCalls += 1; return { ok: true } },
      },
    },
  })
  const result = await gateway.execute({ capabilityId: WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID, operation: 'provision', args: exactArgs }, { agentId: 'hr-agent' })
  assert.equal(result.error.code, 'access_denied')
  assert.equal(handlerCalls, 0)
})

test('gateway derives the caller and invokes the handler only after grant admission', async (t) => {
  const seen = []
  const gateway = createBrokerGateway({
    manifests,
    targets,
    authServiceOrigin: await tokenServer(t, 200),
    credentialsFile: credentialStore(t),
    localHandlers: {
      [WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID]: {
        provision: async (args, context) => {
          seen.push({ args, callerAgentId: context.callerAgentId })
          return { ok: true, result: { admitted: true } }
        },
      },
    },
  })
  const absent = await gateway.execute({ capabilityId: WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID, operation: 'provision', args: exactArgs }, { agentId: 'agt_other' })
  assert.equal(absent.error.code, 'credential_unavailable')
  const admitted = await gateway.execute({ capabilityId: WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID, operation: 'provision', args: exactArgs }, { agentId: 'hr-agent' })
  assert.deepEqual(admitted, { ok: true, result: { admitted: true } })
  assert.deepEqual(seen, [{ args: exactArgs, callerAgentId: 'hr-agent' }])
})

test('gateway-mode apply resolves the projection provider at execute time', async (t) => {
  const provided = {}
  const services = {
    workflowHumanPrincipalProjectionAccess: {
      handlers: {
        [WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID]: {
          provision: async (_args, context) => ({ ok: true, result: { caller: context.callerAgentId } }),
        },
      },
    },
  }
  const ctx = {
    get: (name) => services[name],
    provide: (name, value) => { provided[name] = value },
  }
  applyBroker(ctx, {
    mode: 'gateway',
    manifests,
    targets,
    authServiceOrigin: await tokenServer(t, 200),
    credentialsFile: credentialStore(t),
    // DSH_AGENT_CORE_MODULARITY_PHASE_A_V1: providers are injected through
    // the composition-owned resolveLocalHandlers seam (the broker keeps no
    // business service-name enumeration).
    resolveLocalHandlers: () => ({
      ...(services.workflowHumanPrincipalProjectionAccess?.handlers ?? {}),
    }),
  })
  const result = await provided.brokerGateway.execute({
    capabilityId: WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID,
    operation: 'provision',
    args: exactArgs,
  }, { agentId: 'hr-agent' })
  assert.deepEqual(result, { ok: true, result: { caller: 'hr-agent' } })
})
