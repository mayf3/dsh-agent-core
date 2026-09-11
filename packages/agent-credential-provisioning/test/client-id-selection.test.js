// Production-shaped regression for the MachineClient identity selection rule
// (the deployed POST /api/v1/clients response carries BOTH ids: `id` = the
// machine_clients DB row UUID, `client_id` = the OAuth public id). Credential
// identity is the public id on every face — Basic auth, token mint, and the
// credential store — never the DB row id. Kept in its own structure-compliant
// file: provisioning.test.js is a frozen grandfathered surface that must not
// grow (CODE_STRUCTURE_GUARDRAILS_V1 §6).

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ensureAgentCredential } from '../src/index.js'

const AGENT_ID = 'agt_client_id_selection'

const opaque = () => randomBytes(32).toString('base64url')

async function productionShapedFaces(t) {
  const directory = await mkdtemp(join(tmpdir(), 'client-id-selection-'))
  const definitionFile = join(directory, 'agents.json')
  const storeDir = join(directory, 'store')
  await mkdir(storeDir, { mode: 0o700 })
  const credentialsFile = join(storeDir, 'credentials.json')
  await writeFile(definitionFile, `${JSON.stringify({
    version: 1,
    defaultAgentId: AGENT_ID,
    agents: [{ id: AGENT_ID, name: 'Client Id Selection', description: null }],
  })}\n`)
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })) })
  return { definitionFile, credentialsFile }
}

test('clean bootstrap carries the OAuth public client_id, never the DB row id (production-shaped ensureClient)', async (t) => {
  const { definitionFile, credentialsFile } = await productionShapedFaces(t)
  const DB_ROW_ID = '11220ead-2c90-452d-806f-cdb60fb43426'
  const PUBLIC_CLIENT_ID = 'mc_expected'
  const PRINCIPAL_ROW_ID = '857b20c3-8d84-497d-950a-7b185a116687'
  const secret = opaque()
  const auth = {
    state: { verifiedClientId: undefined },
    async beginManagementOperation() {
      return {
        ensurePrincipal: async () => ({ id: PRINCIPAL_ROW_ID, created: true, status: 'active' }),
        ensureClient: async () => ({ id: DB_ROW_ID, client_id: PUBLIC_CLIENT_ID, created: true, status: 'active', secret }),
      }
    },
    async verifyCredential({ credential }) {
      auth.state.verifiedClientId = credential.clientId
      return { status: 200 }
    },
  }
  const result = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: definitionFile,
    credentialsFile, auth, prerequisites: { c: true },
  })
  assert.equal(result.clientId, PUBLIC_CLIENT_ID)
  // Principal extraction unchanged: its row id IS the principal id.
  assert.equal(result.principalId, PRINCIPAL_ROW_ID)
  const persisted = JSON.parse(await readFile(credentialsFile, 'utf8'))
  assert.equal(persisted.credentials[AGENT_ID].clientId, PUBLIC_CLIENT_ID)
  assert.equal(persisted.credentials[AGENT_ID].clientSecret, secret)
  assert.equal(auth.state.verifiedClientId, PUBLIC_CLIENT_ID) // verification mint receives the public id
  // The DB row UUID never travels as an OAuth client id on any face.
  assert.equal(JSON.stringify(persisted).includes(DB_ROW_ID), false)
  assert.equal(JSON.stringify(result).includes(DB_ROW_ID), false)
  assert.notEqual(auth.state.verifiedClientId, DB_ROW_ID)
})
