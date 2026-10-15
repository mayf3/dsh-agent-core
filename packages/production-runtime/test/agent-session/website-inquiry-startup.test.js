import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProductionRuntime } from '../../src/entry.js'
import { mountWebsiteInquiryRuntime } from '../../src/agent-session/website-inquiry/runtime.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'whi-startup-'))
  const dir = join(root, 'private')
  mkdirSync(dir, { mode: 0o700 })
  const configFile = join(dir, 'config.json'), keyFile = join(dir, 'cursor.key'), storeFile = join(dir, 'requests.sqlite')
  const human = { kind: 'human', principalId: '00000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + 900 }
  const config = { schema_version: 1, enabled: true, storeFile, cursorKeyFile: keyFile, jwksUrl: 'https://synthetic.example/.well-known/jwks.json',
    registry: [{ binding_id: 'binding', version: '1', enabled: true, site_project_id: 'site', site_owner_id: 'owner', issuer: 'auth-service',
      auth_subject: human.principalId, human_principal_id: human.principalId, communication_scope_id: 'scope',
      pilot_surface: { channel: 'website', external_id: 'pilot', expected_agent_id: 'agt_pilot' },
      allowed_operations: ['bound_resolve', 'preauthorize', 'own_read', 'own_events'], transport_client_id: 'agent-control-website-inquiry-v1',
      transport_principal_id: '00000000-0000-4000-8000-000000000002', exact_web_origin: 'https://synthetic.example' }] }
  writeFileSync(keyFile, Buffer.alloc(32, 7), { mode: 0o600 })
  const save = () => writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 })
  save()
  return { root, dir, configFile, keyFile, storeFile, human, config, save, close: () => rmSync(root, { recursive: true, force: true }) }
}
async function startup(f, extraArgs) {
  const handlers = new Map(), logs = [], disposed = []
  let mounted, started = 0, stopped = 0
  const ctx = { provide() {}, on: (_, fn) => disposed.push(fn) }
  const proc = { pid: 12345, stdout: { write: value => logs.push(value) }, stderr: { write: value => logs.push(value) },
    on: (event, fn) => handlers.set(event, fn), exit() {} }
  // Substitute the pre-existing service graph, while exercising the actual
  // resident argument parser, config loader and website runtime mount.
  await runProductionRuntime(['--root', f.root, ...extraArgs], proc, { compose: async options => {
    mounted = await mountWebsiteInquiryRuntime({ ctx, config: options.websiteInquiry,
      router: { onTurnReconciled: () => () => {}, admitWebsiteInquiry() {} }, definition: {}, workspaceBootstrap: {} })
    return { start: async () => { started++ }, stop: async () => { stopped++; disposed.forEach(fn => fn()) },
      writeEvidence() {}, definition: { getDefaultAgent: () => null }, notificationIngress: { address: () => ({ port: 0 }) } }
  } })
  return { get mounted() { return mounted }, logs, started, close: async () => { handlers.get('SIGTERM')(); await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, 1) } }
}

test('original resident entry flags reach the real website config and mount boundary', async () => {
  const f = fixture()
  let run
  try {
    run = await startup(f, ['--website-inquiry-enabled', 'true', '--website-inquiry-config', f.configFile])
    assert.ok(run.mounted?.service, 'supported original startup must mount the configured source')
    assert.equal(run.started, 1)
    assert.equal(existsSync(f.storeFile), true)
    assert.equal(run.logs.join('').includes(f.configFile), false)
    assert.equal(run.logs.join('').includes('cursor.key'), false)
  } finally { await run?.close(); f.close() }
})

import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { Readable } from 'node:stream'

async function response(handler) {
  let code, body
  await handler(Object.assign(Readable.from([Buffer.from('{}')]), { method: 'POST', url: '/v1/website-inquiries/resolve', headers: { 'content-type': 'application/json' } }),
    { writeHead(value) { code = value }, end(value) { body = JSON.parse(value) } })
  return { code, body }
}

test('OFF original entry does zero website filesystem, credential or network IO and preserves resident start/stop', async t => {
  const f = fixture()
  let touches = 0
  try {
    for (const method of ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'writeFileSync', 'chmodSync']) {
      t.mock.method(fs, method, () => { touches++; throw Error('unexpected website IO') })
    }
    syncBuiltinESMExports()
    t.mock.method(globalThis, 'fetch', async () => { touches++; throw Error('unexpected network') })
    for (const args of [[], ['--website-inquiry-config', f.configFile], ['--website-inquiry-enabled', 'false', '--website-inquiry-config', f.configFile]]) {
      const run = await startup(f, args)
      try { assert.equal(run.mounted, null); assert.equal(run.started, 1) } finally { await run.close() }
    }
    assert.equal(touches, 0)
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); f.close() }
})

test('incomplete, wrong, unsafe and symlink config inputs disable only new routes with sanitized503', async () => {
  const mutations = [
    f => { f.config.registry[0].human_principal_id = 'manual-name'; f.save() },
    f => { f.config.unexpected = 'SECRET-SENTINEL'; f.save() },
    f => { f.config.enabled = false; f.save() },
    f => { f.config.storeFile = '/not-approved/requests.sqlite'; f.save() },
    f => { f.config.jwksUrl = 'http://synthetic.example/jwks'; f.save() },
    f => writeFileSync(f.configFile, '{invalid SECRET-SENTINEL'),
    f => writeFileSync(f.configFile, ' '.repeat(65537)),
    f => writeFileSync(f.keyFile, Buffer.alloc(31)),
    f => chmodSync(f.configFile, 0o644),
    f => chmodSync(f.keyFile, 0o644),
    f => chmodSync(f.dir, 0o755),
    f => { fs.renameSync(f.configFile, f.configFile + '.real'); symlinkSync(f.configFile + '.real', f.configFile) },
    f => { fs.renameSync(f.keyFile, f.keyFile + '.real'); symlinkSync(f.keyFile + '.real', f.keyFile) },
    f => { fs.renameSync(f.dir, f.dir + '-real'); symlinkSync(f.dir + '-real', f.dir) },
    f => writeFileSync(f.storeFile, 'not a SQLite database', { mode: 0o600 }),
  ]
  for (const mutate of mutations) {
    const f = fixture()
    let run
    try {
      mutate(f)
      run = await startup(f, ['--website-inquiry-enabled', 'true', '--website-inquiry-config', f.configFile])
      assert.equal(run.started, 1)
      assert.equal(run.mounted.service, null)
      const got = await response(run.mounted.handler)
      assert.equal(got.code, 503)
      assert.equal(got.body.error.class, 'NOT_PROVISIONED')
      assert.equal(JSON.stringify(got).includes('SECRET-SENTINEL'), false)
      assert.equal(run.logs.join('').includes(f.configFile), false)
    } finally { await run?.close(); f.close() }
  }
  const f = fixture()
  try {
    for (const args of [['--website-inquiry-enabled', 'true'], ['--website-inquiry-enabled', '1', '--website-inquiry-config', f.configFile],
      ['--website-inquiry-enabled', 'true', '--website-inquiry-config', 'relative.json'],
      ['--website-inquiry-enabled', 'true', '--website-inquiry-enabled', 'false', '--website-inquiry-config', f.configFile]]) {
      const run = await startup(f, args)
      try { assert.equal((await response(run.mounted.handler)).code, 503); assert.equal(existsSync(f.storeFile), false) } finally { await run.close() }
    }
  } finally { f.close() }
})

test('current file ACL revocation denies next own-read; scope and pinned storage/key/JWKS changes never migrate existing identities', async () => {
  const f = fixture()
  let run
  try {
    run = await startup(f, ['--website-inquiry-enabled', 'true', '--website-inquiry-config', f.configFile])
    const service = run.mounted.service
    const { InquiryStore } = await import('../../../product-api/src/website-inquiry/store.js')
    const { makeRecord, recordKey, commitProjection } = await import('../../../product-api/src/website-inquiry/records.js')
    const seed = new InquiryStore(f.storeFile)
    seed.transaction('scope', state => {
      const record = makeRecord(f.config.registry[0], f.human, { request_id: 'existing-rid', message: 'saved question', purpose: 'workflow_facts', context_refs: [], allow_create_main: false },
        { canonical_agent_id: 'agt_pilot', main_generation: 'a'.repeat(64) }, Date.now(), 1)
      record.shell.trace.native_user_message_id = 'synthetic-user'
      commitProjection(state, record, { userMessageId: 'synthetic-user', message: 'saved question', turnId: 1, assistantMessageId: 'synthetic-reply',
        status: 'completed', complete: true, content: 'PRIVATE_SAVED_RESULT' }, Date.now())
      state.requests[recordKey(f.human.principalId, 'existing-rid')] = record
    })
    seed.close()
    assert.equal((await service.read(f.human, 'existing-rid', {})).body_page.content, 'PRIVATE_SAVED_RESULT')
    f.config.registry[0].allowed_operations = ['bound_resolve', 'preauthorize', 'own_events']; f.save()
    await assert.rejects(service.read(f.human, 'existing-rid', {}), { code: 'FORBIDDEN' })
    f.config.registry[0].allowed_operations.push('own_read'); f.config.registry[0].version = '2'; f.save()
    assert.equal((await service.read(f.human, 'existing-rid', {})).body_page.content, 'PRIVATE_SAVED_RESULT')
    f.config.registry[0].communication_scope_id = 'new-scope'; f.save()
    await assert.rejects(service.read(f.human, 'existing-rid', {}), { code: 'BINDING_CHANGED' })
    f.config.registry[0].communication_scope_id = 'scope'
    for (const field of ['storeFile', 'cursorKeyFile', 'jwksUrl']) {
      const original = f.config[field]
      f.config[field] = field === 'jwksUrl' ? 'https://other.example/.well-known/jwks.json' : join(f.dir, 'other')
      f.save()
      await assert.rejects(service.read(f.human, 'existing-rid', {}), { code: 'NOT_PROVISIONED' })
      f.config[field] = original; f.save()
    }
    writeFileSync(f.keyFile, Buffer.alloc(32, 9))
    await assert.rejects(service.read(f.human, 'existing-rid', {}), { code: 'NOT_PROVISIONED' })
    assert.equal(existsSync(join(f.dir, 'other')), false)
  } finally { await run?.close(); f.close() }
})
