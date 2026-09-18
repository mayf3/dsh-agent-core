// Offline ABI/library and pure Scheduler/Broker import smoke; no transport calls.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const modules = ['assert', 'buffer', 'crypto', 'dns', 'events', 'fs', 'http', 'http2', 'https', 'net', 'os', 'path', 'perf_hooks', 'querystring', 'readline', 'stream', 'string_decoder', 'timers', 'tls', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib']
for (const name of modules) assert.ok(require(`node:${name}`))
const { createHash } = require('node:crypto')
assert.equal(createHash('sha256').update('abc').digest('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
const z = require('node:zlib'); const bytes = Buffer.from('private-node-proof')
for (const [compress, decompress] of [[z.gzipSync, z.gunzipSync], [z.brotliCompressSync, z.brotliDecompressSync], [z.zstdCompressSync, z.zstdDecompressSync]]) assert.deepEqual(decompress(compress(bytes)), bytes)
assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric' }).format(new Date(0)), '1970')
assert.equal(new URL('https://example.invalid/a').hostname, 'example.invalid')
const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:'); assert.equal(db.prepare('select 1 as n').get().n, 1); db.close()
const base = process.argv[2]
const load = (p) => import(pathToFileURL(`${base}/${p}`))
const { manifests } = await load('packages/broker/src/capabilities/workflow.js')
assert.ok(manifests.some(m => m.id === 'workflow_global_instances'))
const { notificationKey } = await load('packages/scheduler/src/watchdog/incident-lifecycle.js')
const key = notificationKey({ incidentId: 'fixture', transitionRevision: 1, transitionKind: 'opened', routeClass: 'fixture' })
assert.match(key, /^[0-9a-f]{64}$/)
const { canonicalJSON } = await load('packages/scheduler/src/occurrence-model.js')
assert.equal(canonicalJSON({ b: 2, a: 1 }), '{"a":1,"b":2}')
console.log(JSON.stringify({ version: process.version, arch: process.arch, platform: process.platform, versions: process.versions, builtins: modules, assertions: 'PASS', broker_manifests: manifests.length, network_calls: 0, database: 'memory-only', application_scope: 'pure imports and deterministic fixture functions only' }))
