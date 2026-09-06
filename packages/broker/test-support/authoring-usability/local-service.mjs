// Explicit local-only conformance harness; never loads production credentials.
// node packages/broker/test-support/authoring-usability/local-service.mjs <local binary directory> <service source directory>
import assert from 'node:assert/strict'
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { runScenarios } from './scenarios.mjs'
import { startMockServer, json } from '../capability-fixtures.js'

const release = resolve(process.argv[2])
const scratch = `wda_model3_${randomUUID().replaceAll('-', '')}`
const pg = 'postgres://postgres@127.0.0.1:55449'
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
  service = spawn(`${release}/svc-workflow`, [], { cwd: resolve(process.argv[3] || release), env: {
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
  assert.ok(version.gitCommit || version.commit || version.gitSha, JSON.stringify(version))
  assert.equal(sql('SELECT max(version) FROM _sqlx_migrations'), '23')
  // Only fixture identity/domain provisioning is SQL; all Workflow authoring is formal Broker HTTP.
  sql(`INSERT INTO principals(principal_id,principal_type,display_name,enabled) VALUES('${principal}','AGENT','Local model 3',true);
INSERT INTO domains(domain_id,domain_key,display_name,enabled) VALUES('${domainId}','${scratch}','Local model 3',true);
INSERT INTO domain_role_bindings(binding_id,domain_id,principal_id,role_key,enabled) VALUES('${randomUUID()}','${domainId}','${principal}','DOMAIN_OWNER',true),('${randomUUID()}','${domainId}','${principal}','AGENT',true);`)
  await runScenarios({ origin, auth, sql, principal, domainId, temp, version })
} catch (error) {
  console.error(serviceLog.split('\n').filter(line => line.includes('ERROR')).join('\n'))
  throw error
} finally {
  if (service && service.exitCode === null) { service.kill('SIGTERM'); await once(service, 'exit') }
  if (auth) await auth.close()
  if (created) sql(`DROP DATABASE ${scratch} WITH (FORCE)`, 'postgres')
  rmSync(temp, { recursive: true, force: true })
}
