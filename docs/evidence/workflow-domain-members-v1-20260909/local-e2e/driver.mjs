/**
 * WORKFLOW_DOMAIN_MEMBERS_CONTROL_PLANE_V1 — local full-chain E2E driver.
 *
 * Drives the REAL broker model face (capabilities + registry + transport
 * from this worktree, i.e. the exact code the agent runtime executes)
 * against the REAL local svc-workflow binary (Rust, real DB, real JWKS
 * verification). Nothing here touches the database directly: the DB is
 * seeded ONCE before boot by run.sh (pre-migration fixture), and every
 * business step speaks HTTPS-shaped HTTP through the broker transport.
 *
 * Phases (goal §11 local analogue; production dogfood = Owner script):
 *   B. owner-side membership operations (list/add/duplicate/replay/
 *      delegation-forbidden/negatives) + audit counts read back via psql
 *      (read-only) by run.sh afterwards
 *   C. target-agent read verification in the lobster's OWN authenticated
 *      context: my_domains shows the domain with callerRole=DOMAIN_MEMBER;
 *      an instance whose entry node assigns the lobster (definition
 *      published by the owner through the authoring surface) is visible
 *      via workflow_my_tasks and readable via workflow_instance_detail.
 *
 * Idempotency replay (same Idempotency-Key twice) is exercised at the wire
 * layer by run.sh with curl — the broker transport generates a fresh key
 * per command BY DESIGN, so transport-level replay is a wire concern.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_DIR = process.env.WFDM_APP_DIR
  ?? join(HERE, '../../../..')
const brokerSrc = (p) => join(APP_DIR, 'packages/broker/src', p)
const { mockTargets } = await import(join(APP_DIR, 'packages/broker/test-support/capability-fixtures.js'))

const { manifests: workflowManifests } = await import(brokerSrc('capabilities/workflow.js'))
const { buildToolDefinition } = await import(brokerSrc('registry.js'))
const { createHttpHandlers, createHttpTransport } = await import(brokerSrc('transport.js'))

const SVC = process.env.WFDM_SVC_ORIGIN // e.g. http://127.0.0.1:55991
const tokenFor = (who) => readFileSync(join(HERE, `${who}.token`), 'utf8').trim()

// --- A local one-shot token endpoint per persona stands in for the auth-service
// --- client_credentials exchange; each persona's token is pre-minted.
import http from 'node:http'

async function startTokenServerFor(who) {
  const token = tokenFor(who)
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: 590 }))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}

const record = (step, ok, detail) => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ' :: ' + JSON.stringify(detail) : ''}`)
}

const OUT = join(HERE, 'e2e-transcript.json')
const dump = (label, value) => {
  writeFileSync(join(HERE, `${label}.json`), JSON.stringify(value, null, 2))
}

const DOMAIN_ID = process.env.WFDM_DOMAIN_ID
const OWNER = process.env.WFDM_OWNER_ID
const LOBSTER = process.env.WFDM_LOBSTER_ID
const STRANGER = process.env.WFDM_STRANGER_ID

const results = []
const sessions = {}

// Deep key lookup — response shapes are read from the wire, never guessed
// (workflow responses nest ids at different depths per surface).
const deepFind = (value, key) => {
  if (Array.isArray(value)) {
    for (const item of value) { const hit = deepFind(item, key); if (hit !== undefined) return hit }
    return undefined
  }
  if (value && typeof value === 'object') {
    if (key in value) return value[key]
    for (const v of Object.values(value)) { const hit = deepFind(v, key); if (hit !== undefined) return hit }
  }
  return undefined
}
for (const who of ['owner', 'lobster', 'stranger']) sessions[who] = await startTokenServerFor(who)

function wiredTool(manifestId, who) {
  const manifest = workflowManifests.find((m) => m.id === manifestId)
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: `mc-${who}`, clientSecret: 'e2e' }) },
    targets: mockTargets({ 'svc-workflow': SVC }),
    authServiceOrigin: sessions[who].origin,
  })
  return buildToolDefinition({ manifest, handlers: createHttpHandlers(manifest, transport), deps: {} })
}

const ownerMembers = wiredTool('workflow_domain_members', 'owner')
const lobsterMembers = wiredTool('workflow_domain_members', 'lobster')
const ownerAuthoring = wiredTool('workflow_definition_authoring', 'owner')
const ownerExecute = wiredTool('workflow_execute', 'owner')
const lobsterDomains = wiredTool('workflow_my_domains', 'lobster')
const lobsterTasks = wiredTool('workflow_my_tasks', 'lobster')
const lobsterDetail = wiredTool('workflow_instance_detail', 'lobster')

// ─── Phase B1: baseline list (owner) ────────────────────────────────────────
{
  const res = await ownerMembers.definition.execute({ operation: 'list', domainId: DOMAIN_ID })
  dump('b1-list-baseline', res)
  record('B1 list baseline ok', res.ok === true && Array.isArray(res.result.items), { count: res.result?.items?.length })
}

// ─── Phase B2: add lobster (role omitted ⇒ DOMAIN_MEMBER default) ──────────
let addReplayKey
{
  const res = await ownerMembers.definition.execute({ operation: 'add', domainId: DOMAIN_ID, principalId: LOBSTER })
  dump('b2-add-member', res)
  addReplayKey = res.requestId // unused for replay (wire-level replay in run.sh)
  record('B2 add lobster ⇒ DOMAIN_MEMBER', res.ok === true && res.result?.role === 'DOMAIN_MEMBER', res.result)
}

// ─── Phase B3: list shows lobster exactly once ─────────────────────────────
{
  const res = await ownerMembers.definition.execute({ operation: 'list', domainId: DOMAIN_ID })
  dump('b3-list-after-add', res)
  const hits = (res.result?.items ?? []).filter((i) => i.principal_id === LOBSTER)
  record('B3 lobster listed exactly once', res.ok === true && hits.length === 1, { hits: hits.length })
}

// ─── Phase B4: logical duplicate with a NEW command ⇒ already_member ───────
{
  const res = await ownerMembers.definition.execute({ operation: 'add', domainId: DOMAIN_ID, principalId: LOBSTER })
  dump('b4-duplicate-add', res)
  record('B4 duplicate add ⇒ already_member', res.ok === false && res.error?.code === 'already_member' && res.error?.status === 409, res.error)
}

// ─── Phase B5: DOMAIN_OWNER delegation ⇒ forbidden (server-side invariant) ─
{
  const res = await ownerMembers.definition.execute({ operation: 'add', domainId: DOMAIN_ID, principalId: LOBSTER, role: 'DOMAIN_OWNER' })
  dump('b5-delegation-forbidden', res)
  record('B5 role=DOMAIN_OWNER ⇒ domain_owner_delegation_forbidden', res.ok === false && res.error?.code === 'domain_owner_delegation_forbidden' && res.error?.status === 403, res.error)
}

// ─── Phase B6: negatives — stranger is not DOMAIN_OWNER ────────────────────
{
  const list = await wiredTool('workflow_domain_members', 'stranger').definition.execute({ operation: 'list', domainId: DOMAIN_ID })
  const add = await wiredTool('workflow_domain_members', 'stranger').definition.execute({ operation: 'add', domainId: DOMAIN_ID, principalId: OWNER })
  const del = await wiredTool('workflow_domain_members', 'stranger').definition.execute({ operation: 'remove', domainId: DOMAIN_ID, principalId: LOBSTER })
  dump('b6-stranger-negatives', { list, add, del })
  record('B6 stranger list/add/remove ⇒ not_domain_owner',
    list.error?.code === 'not_domain_owner' && add.error?.code === 'not_domain_owner' && del.error?.code === 'not_domain_owner',
    { list: list.error?.code, add: add.error?.code, del: del.error?.code })
}

// ─── Phase B7: negatives — unknown domain / unknown principal ──────────────
{
  const unknownDomain = await ownerMembers.definition.execute({ operation: 'add', domainId: '00000000-0000-4000-8000-00000000dead', principalId: LOBSTER })
  const unknownPrincipal = await ownerMembers.definition.execute({ operation: 'add', domainId: DOMAIN_ID, principalId: '00000000-0000-4000-8000-00000000beef' })
  const removeMissing = await ownerMembers.definition.execute({ operation: 'remove', domainId: DOMAIN_ID, principalId: STRANGER })
  dump('b7-not-found-negatives', { unknownDomain, unknownPrincipal, removeMissing })
  // Upstream contract note (recorded honestly): add/remove check the caller's
  // DOMAIN_OWNER status BEFORE the domain lookup, so a nonexistent domain
  // surfaces not_domain_owner (no caller owns it) rather than domain_not_found;
  // domain_not_found fires when the caller owns SOME domain but the target
  // domain is missing/disabled. principal_not_registered / member_not_found
  // are the not_found family members reachable through the tool face.
  record('B7 not_found family: unknown principal ⇒ principal_not_registered; remove missing binding ⇒ member_not_found; unknown domain ⇒ owner-check-first (not_domain_owner)',
    unknownPrincipal.error?.code === 'principal_not_registered'
    && removeMissing.error?.code === 'member_not_found'
    && unknownDomain.error?.code === 'not_domain_owner',
    { unknownDomain: unknownDomain.error?.code, unknownPrincipal: unknownPrincipal.error?.code, removeMissing: removeMissing.error?.code })
}

// ─── Phase B8: lobster is NOT permitted to manage (pre-membership negative
//     via the SAME surface, now as a member — server-side owner gate) ───────
{
  const res = await lobsterMembers.definition.execute({ operation: 'add', domainId: DOMAIN_ID, principalId: OWNER })
  dump('b8-member-not-owner', res)
  record('B8 lobster (member, not owner) add ⇒ not_domain_owner', res.ok === false && res.error?.code === 'not_domain_owner', res.error)
}

// ─── Phase C: target-agent read verification in its own context ────────────
// C1: lobster discovers the domain via formal caller-scoped discovery.
{
  const res = await lobsterDomains.definition.execute({ operation: 'list' })
  dump('c1-lobster-my-domains', res)
  const mine = (res.result?.items ?? []).find((d) => d.domain_id === DOMAIN_ID)
  record('C1 lobster my_domains sees dogfood domain as DOMAIN_MEMBER',
    res.ok === true && mine?.caller_role === 'DOMAIN_MEMBER', mine)
}

// C2: owner authors + publishes a minimal V2 definition whose entry node
//     assigns the lobster (FIXED_PRINCIPAL), then creates an instance.
let instanceId
{
  const defKey = `wfdm-e2e-${Date.now()}`
  const created = await ownerAuthoring.definition.execute({ operation: 'create_definition', domainId: DOMAIN_ID, definitionKey: defKey, displayName: 'WFDm E2E 成员可见性' })
  dump('c2a-create-definition', created)
  if (!created.ok) throw new Error('create_definition failed: ' + JSON.stringify(created))
  const definitionId = created.result?.workflowDefinitionId ?? created.result?.definitionId ?? created.result?.id
  const draft = await ownerAuthoring.definition.execute({ operation: 'create_draft_version', domainId: DOMAIN_ID, definitionId, semanticModelVersion: 2 })
  dump('c2b-create-draft', draft)
  if (!draft.ok) throw new Error('create_draft_version failed: ' + JSON.stringify(draft))
  const versionId = draft.result?.definitionVersionId ?? draft.result?.definition_version_id
      ?? draft.result?.versionId ?? draft.result?.id
  const graph = await ownerAuthoring.definition.execute({
    operation: 'replace_draft_graph', domainId: DOMAIN_ID,
    definitionId,
    definitionVersionId: versionId,
    nodes: [
      { node_key: 'task', display_name: '龙虾任务', order_index: 0, node_type: 'NORMAL', assignee_ref_type: 'FIXED_PRINCIPAL', fixed_principal_id: LOBSTER },
      { node_key: 'done', display_name: '完成', order_index: 1, node_type: 'TERMINAL' },
    ],
    transitions: [
      { transition_key: 'finish', display_name: '完成', source_node_key: 'task', target_node_key: 'done', transition_effect: 'ADVANCE' },
    ],
  })
  dump('c2c-replace-graph', graph)
  if (!graph.ok) throw new Error('replace_draft_graph failed: ' + JSON.stringify(graph))
  const published = await ownerAuthoring.definition.execute({ operation: 'publish_version', domainId: DOMAIN_ID, definitionId, versionId })
  dump('c2d-publish', published)
  if (!published.ok) throw new Error('publish_version failed: ' + JSON.stringify(published))
  const inst = await ownerExecute.definition.execute({ operation: 'create_instance', domainId: DOMAIN_ID, definitionVersionId: versionId, contextPayload: {}, metadata: null })
  dump('c2e-create-instance', inst)
  if (!inst.ok) throw new Error('create_instance failed: ' + JSON.stringify(inst))
  instanceId = inst.result?.workflowInstanceId ?? inst.result?.workflow_instance_id
  record('C2 owner authored/published/created instance for lobster', Boolean(instanceId), { instanceId })
}

// C3: lobster sees the instance via the worklist read surface.
{
  const res = await lobsterTasks.definition.execute({ operation: 'list', limit: 20 })
  dump('c3-lobster-my-tasks', res)
  const hit = deepFind(res.result, 'workflow_instance_id') === instanceId
    || deepFind(res.result, 'workflowInstanceId') === instanceId
  record('C3 lobster workflow_my_tasks contains the instance', res.ok === true && hit, { found: hit })
}

// C4: lobster reads the instance detail through the formal read surface.
{
  const res = await lobsterDetail.definition.execute({ operation: 'read', workflowInstanceId: instanceId })
  dump('c4-lobster-instance-detail', res)
  const assignee = deepFind(res.result, 'assignee_principal_id')
  record('C4 lobster workflow_instance_detail ⇒ readable (full visibility), current visit assignee = lobster',
    res.ok === true && assignee === LOBSTER, { assignee, visibility: res.result?.visibility })
}

for (const s of Object.values(sessions)) s.close()

writeFileSync(OUT, JSON.stringify({ domainId: DOMAIN_ID, owner: OWNER, lobster: LOBSTER, stranger: STRANGER, results }, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\nE2E ${results.length - failed.length}/${results.length} steps passed`)
process.exit(failed.length === 0 ? 0 : 1)
