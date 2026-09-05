// Explicit local-only conformance harness; never loads production credentials.
// node packages/broker/test-support/model3-real-service.mjs <official release dir>
import assert from 'node:assert/strict'
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createBrokerGateway } from '../src/gateway.js'
import { buildToolDefinition } from '../src/registry.js'
import { createRelayHandlers } from '../src/relay.js'
import { manifests } from '../src/capabilities/workflow.js'
import { createHttpTransport } from '../src/transport.js'
import { wire, startMockServer, json, mockTargets } from './capability-fixtures.js'

const release = resolve(process.argv[2])
const scratch = `wda_model3_${randomUUID().replaceAll('-', '')}`
const pg = 'postgres://postgres:postgres@127.0.0.1:55432'
const sql = (query, database = scratch) => execFileSync('psql', [`${pg}/${database}`, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim()
const principal = randomUUID(), domainId = randomUUID(), kid = randomUUID()
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' }
const token = (scope) => {
  const now = Math.floor(Date.now() / 1000)
  const b = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const value = `${b({ alg: 'RS256', kid, typ: 'JWT' })}.${b({ iss: 'auth-service', sub: principal, aud: 'svc-workflow', principal_type: 'agent', client_id: 'mc_local_model3', token_use: 'access', type: 'access', version: 'v1', scope, agent_id: 'local-model3', jti: randomUUID(), iat: now, nbf: now - 5, exp: now + 600 })}`
  return `${value}.${createSign('RSA-SHA256').update(value).sign(privateKey).toString('base64url')}`
}
const temp = mkdtempSync(`${tmpdir()}/wda-model3-`)
let service, auth, created = false, serviceLog = ''
try {
  sql(`CREATE DATABASE ${scratch}`, 'postgres'); created = true
  auth = await startMockServer((_req, res, entry) => entry.pathname === '/jwks.json'
    ? json(res, 200, { keys: [jwk] })
    : json(res, 200, { access_token: token(entry.body.scope), token_type: 'Bearer', expires_in: 300 }))
  const portServer = createServer().listen(0, '127.0.0.1')
  await once(portServer, 'listening')
  const port = portServer.address().port
  await new Promise((done) => portServer.close(done))
  const origin = `http://127.0.0.1:${port}`
  service = spawn(`${release}/svc-workflow`, [], { cwd: release, env: {
    PATH: process.env.PATH, DATABASE_URL: `${pg}/${scratch}`, WORKFLOW_BIND_ADDR: '127.0.0.1', WORKFLOW_PORT: String(port),
    WORKFLOW_JWKS_URL: `${auth.origin}/jwks.json`, WORKFLOW_JWT_ISSUER: 'auth-service', WORKFLOW_JWT_AUDIENCE: 'svc-workflow',
    AUTH_V1_CANARY_ENABLED: 'true', AUTH_V1_CANARY_WRITE_ENABLED: 'true', WORKFLOW_PROVISIONING_PRINCIPAL_IDS: principal,
  }, stdio: ['ignore', 'pipe', 'pipe'] })
  service.stdout.on('data', (s) => { serviceLog += s }); service.stderr.on('data', (s) => { serviceLog += s })
  let healthy = false
  for (let attempt = 0; attempt < 150; attempt++) {
    try { healthy = (await fetch(`${origin}/healthz`)).ok } catch {}
    if (healthy) break
    if (service.exitCode !== null) throw Error(`local svc exited: ${serviceLog}`)
    await new Promise((done) => setTimeout(done, 200))
  }
  assert.ok(healthy, 'scratch svc health')
  const version = await (await fetch(`${origin}/version`)).json()
  assert.equal(version.gitTreeState, 'clean')
  assert.equal(sql('SELECT max(version) FROM _sqlx_migrations'), '23')
  // Only fixture identity/domain provisioning is SQL; all Workflow authoring is formal Broker HTTP.
  sql(`INSERT INTO principals(principal_id,principal_type,display_name,enabled) VALUES('${principal}','AGENT','Local model 3',true);
INSERT INTO domains(domain_id,domain_key,display_name,enabled) VALUES('${domainId}','${scratch}','Local model 3',true);
INSERT INTO domain_role_bindings(binding_id,domain_id,principal_id,role_key,enabled) VALUES('${randomUUID()}','${domainId}','${principal}','DOMAIN_OWNER',true),('${randomUUID()}','${domainId}','${principal}','AGENT',true);`)
  const transport = createHttpTransport({ credentialProvider: { getCredential: async () => ({ clientId: 'mc_local_model3', clientSecret: 'local-only' }) }, targets: mockTargets({ 'svc-workflow': origin }), authServiceOrigin: auth.origin })
  const tool = (id) => wire(manifests.find((m) => m.id === id), transport).definition
  const author = tool('workflow_definition_authoring')
  const call = async (args) => { const r = await author.execute(args); assert.equal(r.ok, true, JSON.stringify(r)); return r.result }
  const definition = await call({ operation: 'create_definition', domainId, definitionKey: scratch, displayName: 'Model 3 local' })
  const definitionId = definition.workflowDefinitionId
  const draft = await call({ operation: 'create_draft_version', domainId, definitionId, semanticModelVersion: 3 })
  const definitionVersionId = draft.definitionVersionId
  const graph = { operation: 'replace_draft_graph', domainId, definitionId, definitionVersionId, nodes: [
    { node_key: 'work', display_name: 'Work', order_index: 0, node_type: 'TASK', assignee_ref_type: 'WORKFLOW_CREATOR', primary_advance_transition_key: 'finish' },
    { node_key: 'done', display_name: 'Done', order_index: 1, node_type: 'TERMINAL' },
  ], transitions: [{ transition_key: 'finish', display_name: 'Finish', source_node_key: 'work', target_node_key: 'done', transition_effect: 'ADVANCE' }] }
  const bad = structuredClone(graph); bad.nodes[0].node_type = 'NORMAL'
  const rejected = await author.execute(bad)
  assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'internal_consistency_error')
  assert.equal(sql(`SELECT count(*) FROM workflow_node_definitions WHERE definition_version_id='${definitionVersionId}'`), '0')
  await call(graph)
  const published = await call({ operation: 'publish_version', domainId, definitionId, versionId: definitionVersionId })
  assert.equal(published.definitionVersionId, definitionVersionId)
  const instance = await tool('workflow_execute').execute({ operation: 'create_instance', domainId, definitionVersionId, contextPayload: {}, metadata: null })
  assert.equal(instance.ok, true, JSON.stringify(instance))
  const workflowInstanceId = instance.result.workflowInstanceId
  const readback = await tool('workflow_instance_detail').execute({ operation: 'read', workflowInstanceId })
  assert.equal(readback.ok, true, JSON.stringify(readback))
  const stored = JSON.parse(sql(`SELECT row_to_json(x) FROM (SELECT i.definition_version_id,i.semantic_model_version,v.version_status,v.semantic_model_version AS version_model FROM workflow_instances i JOIN workflow_definition_versions v USING(definition_version_id) WHERE i.workflow_instance_id='${workflowInstanceId}') x`))
  assert.equal(stored.definition_version_id, definitionVersionId)
  assert.equal(stored.semantic_model_version, 3); assert.equal(stored.version_model, 3); assert.equal(stored.version_status, 'PUBLISHED')
  assert.ok(JSON.stringify(readback.result).includes(definitionVersionId), 'canonical HTTP readback binds published version')
  let productionFlow
  if (process.argv[3]) {
    // Optional same-engine canary rehearsal; formal provisioning grants only scratch fixture role.
    const provision = await fetch(`${origin}/internal/v1/admin/global-role-bindings/${principal}`, {
      method: 'PUT', headers: { authorization: `Bearer ${token('workflow.admin')}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
      body: JSON.stringify({ roleKey: 'GLOBAL_SCHEDULER_READ', enabled: true }),
    })
    assert.equal(provision.ok, true, await provision.text())
    const credentialsFile = `${temp}/credentials.json`
    writeFileSync(credentialsFile, JSON.stringify({ version: 1, credentials: { 'local-model3': { clientId: 'mc_local_model3', clientSecret: 'local-only' } } }), { mode: 0o600 })
    const gateway = createBrokerGateway({ manifests, targets: mockTargets({ 'svc-workflow': origin }), authServiceOrigin: auth.origin, credentialsFile })
    const { runFlow } = await import(pathToFileURL(resolve(process.argv[3])))
    productionFlow = await runFlow({ domainId, principal, key: randomUUID().replaceAll('-', ''), call: async (capabilityId, operation, args) => {
      const manifest = manifests.find((m) => m.id === capabilityId)
      const handlers = createRelayHandlers(manifest, async (call) => ({ ok: true, result: await gateway.execute(call, { agentId: 'local-model3' }) }))
      const { definition } = buildToolDefinition({ manifest, handlers })
      const r = await definition.execute({ operation, ...args }); assert.equal(r.ok, true, JSON.stringify(r)); return r.result
    } })
  }
  console.log(JSON.stringify({ result: 'PASS', productionFlow, environment: 'disposable localhost PostgreSQL + official svc + ephemeral RS256 JWKS/token + actual Broker transport/handlers', serviceVersion: version, definitionId, definitionVersionId, workflowInstanceId, stored, readback: readback.result, negativeGraph: rejected.error.code, productionUsed: false }, null, 2))
} finally {
  if (service && service.exitCode === null) { service.kill('SIGTERM'); await once(service, 'exit') }
  if (auth) await auth.close()
  if (created) sql(`DROP DATABASE ${scratch} WITH (FORCE)`, 'postgres')
  rmSync(temp, { recursive: true, force: true })
}
