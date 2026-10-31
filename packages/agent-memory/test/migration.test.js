import './helpers/isolated-workspace.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm, symlink, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const loaded = await import('../src/migration.js').catch(() => null)
const execFileAsync = promisify(execFile)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const entry = '## Title\n\n- **ID**: `entry-1`\n- **Type**: preference\n- **Importance**: 5\n- **Tags**: `one`\n- **Updated**: 2026-10-31T00:00:00.000Z\n- **Source**: user:turn\n\nPRIVATE_ORIGINAL_BODY\n\n---\n'
const source = Buffer.from('维护说明\n\n' + entry + '\n保留尾注')
const update = (expectedEntrySha256 = hash(Buffer.from(entry))) => ({ type: 'UPDATE', entryId: 'entry-1', expectedEntrySha256, patch: { content: 'Candidate body' } })

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'memory-migration-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}
function implementation() {
  assert.equal(typeof loaded?.createMigrationCopy, 'function', 'migration copy API must exist')
  return loaded.createMigrationCopy
}
async function ledger(destination) {
  const path = join(destination, 'memory', '.agent-memory-v2')
  const files = await readdir(join(path, 'transactions'))
  const transactionFile = files.find((name) => name.endsWith('.json'))
  return { path, files, manifest: JSON.parse(await readFile(join(path, 'manifest.json'))),
    checkpoint: JSON.parse(await readFile(join(path, 'checkpoint.json'))),
    transaction: JSON.parse(await readFile(join(path, 'transactions', transactionFile))) }
}
async function runCli(config, extra = [], env = {}) {
  return execFileAsync(process.execPath, [resolve('packages/agent-memory/src/migration-cli.js'), '--config', config, ...extra], {
    env: { ...process.env, DSH_PRIMARY_WORKSPACE: '/__DO_NOT_TOUCH_1248__', DSH_WORKSPACE_DIR: '/__DO_NOT_TOUCH_1248__', ...env },
  })
}

test('new copy preserves original bytes and keeps ledger inactive with unknown checkpoint', async (t) => {
  const root = await fixture(t)
  const destination = join(root, 'candidate')
  const receipt = await implementation()({ sourceBytes: source, destination })
  assert.equal(receipt.status, 'CREATED_COPY')
  assert.deepEqual(await readFile(join(destination, 'MEMORY.md')), source)
  const stored = await ledger(destination)
  assert.equal(stored.manifest.mode, 'MIGRATION_COPY')
  assert.equal(stored.manifest.writer.active, false)
  assert.equal(stored.manifest.writer.ownerEpoch, null)
  assert.equal(stored.manifest.core.sha256, hash(source))
  assert.equal(stored.checkpoint.state, 'UNKNOWN')
  assert.equal(stored.checkpoint.generation, null)
  assert.equal(stored.checkpoint.eventCursor, null)
  assert.deepEqual(stored.checkpoint.eventIds, [])
  assert.equal(stored.transaction.phase, 'CANDIDATE_ONLY')
  assert.equal(stored.transaction.planStatus, 'NOOP')
  assert.ok(!JSON.stringify(receipt).includes('PRIVATE_ORIGINAL_BODY'))
  assert.equal((await lstat(join(destination, 'MEMORY.md'))).mode & 0o222, 0)
})

test('classification preserves structured freeform and mixed source bytes', async (t) => {
  const root = await fixture(t)
  for (const [text, expected] of [[entry, 'STRUCTURED'], ['Freeform only', 'FREEFORM'], [source.toString(), 'MIXED']]) {
    const destination = join(root, expected)
    await implementation()({ sourceBytes: Buffer.from(text), destination })
    assert.deepEqual(await readFile(join(destination, 'MEMORY.md')), Buffer.from(text))
    assert.equal((await ledger(destination)).manifest.core.format, expected)
  }
})

test('ready candidate changes only separate candidate and retains unchanged copied core', async (t) => {
  const root = await fixture(t)
  const destination = join(root, 'candidate')
  const receipt = await implementation()({ sourceBytes: source, destination, operations: [update()] })
  assert.equal(receipt.status, 'CREATED_COPY')
  const stored = await ledger(destination)
  assert.equal(stored.transaction.planStatus, 'READY')
  assert.deepEqual(stored.transaction.operations, [update()])
  assert.deepEqual(await readFile(join(destination, 'MEMORY.md')), source)
  const bytes = await readFile(join(stored.path, 'transactions', stored.transaction.candidateFile))
  assert.equal(bytes.toString(), source.toString().replace('PRIVATE_ORIGINAL_BODY', 'Candidate body'))
  assert.equal(stored.transaction.afterSha256, hash(bytes))
})

test('read-only and stale operations remain proposals without publishing candidate bytes', async (t) => {
  const root = await fixture(t)
  for (const [name, bytes, operation, expected] of [
    ['readonly', Buffer.from('Unstructured notes'), update(), 'READ_ONLY_FORMAT'],
    ['stale', source, update('0'.repeat(64)), 'CONFLICT'],
  ]) {
    const destination = join(root, name)
    const result = await implementation()({ sourceBytes: bytes, destination, operations: [operation] })
    assert.equal(result.status, 'CREATED_COPY')
    const stored = await ledger(destination)
    assert.equal(stored.transaction.planStatus, expected)
    assert.deepEqual(stored.transaction.operations, [operation])
    assert.equal(stored.transaction.candidateFile, null)
    assert.equal(stored.files.filter((file) => file.endsWith('.candidate')).length, 0)
    assert.deepEqual(await readFile(join(destination, 'MEMORY.md')), bytes)
  }
})

test('existing output and missing real parent refuse without overwriting evidence', async (t) => {
  const root = await fixture(t)
  const destination = join(root, 'existing')
  await mkdir(destination)
  await writeFile(join(destination, 'MEMORY.md'), 'Keep newer delta')
  const result = await implementation()({ sourceBytes: source, destination })
  assert.equal(result.status, 'REFUSED')
  assert.equal(result.reason, 'DESTINATION_EXISTS')
  assert.equal(await readFile(join(destination, 'MEMORY.md'), 'utf8'), 'Keep newer delta')
  const missing = await implementation()({ sourceBytes: source, destination: join(root, 'missing', 'candidate') })
  assert.equal(missing.status, 'REFUSED')
  assert.deepEqual(await readdir(root), ['existing'])
})

test('symlink parent and final output links cannot redirect a copy write', async (t) => {
  const root = await fixture(t)
  const target = join(root, 'real')
  await mkdir(target)
  await symlink(target, join(root, 'alias'))
  const parent = await implementation()({ sourceBytes: source, destination: join(root, 'alias', 'candidate') })
  assert.equal(parent.status, 'REFUSED')
  assert.equal(parent.reason, 'UNSAFE_PATH')
  const final = await implementation()({ sourceBytes: source, destination: join(root, 'alias') })
  assert.equal(final.status, 'REFUSED')
  assert.deepEqual(await readdir(target), [])
})

test('source bytes are owned before asynchronous work and invalid bytes never create output', async (t) => {
  const root = await fixture(t)
  const input = Buffer.from(source)
  const pending = implementation()({ sourceBytes: input, destination: join(root, 'owned') })
  input.fill(88)
  await pending
  assert.deepEqual(await readFile(join(root, 'owned', 'MEMORY.md')), source)
  const invalid = await implementation()({ sourceBytes: 'not bytes', destination: join(root, 'invalid') })
  assert.equal(invalid.status, 'REFUSED')
  assert.equal(invalid.reason, 'INVALID_INPUT')
  assert.deepEqual(await readdir(root), ['owned'])
})

test('transaction pressure refuses before creating a new copy', async (t) => {
  const root = await fixture(t)
  const operation = { ...update(), patch: { content: 'x'.repeat(64 * 1024 * 1024) } }
  const result = await implementation()({ sourceBytes: source, destination: join(root, 'pressure'), operations: [operation] })
  assert.equal(result.status, 'REFUSED')
  assert.equal(result.reason, 'STORE_PRESSURE')
  assert.deepEqual(await readdir(root), [])
})

test('CLI defaults to byte-only dry-run and create-copy requires explicit flag', async (t) => {
  const root = await fixture(t)
  const config = join(root, 'config.json')
  const destination = join(root, 'copy')
  await writeFile(config, JSON.stringify({ reviewed: true, sourceText: source.toString(), destination, operations: [update()] }))
  const dry = JSON.parse((await runCli(config)).stdout)
  assert.equal(dry.status, 'DRY_RUN')
  assert.equal(dry.planStatus, 'READY')
  assert.ok(!JSON.stringify(dry).includes('PRIVATE_ORIGINAL_BODY'))
  assert.deepEqual(await readdir(root), ['config.json'])
  const created = JSON.parse((await runCli(config, ['--create-copy'])).stdout)
  assert.equal(created.status, 'CREATED_COPY')
  assert.deepEqual(await readFile(join(destination, 'MEMORY.md')), source)
})

test('CLI only reads reviewed fixed files under explicit real sourceRoot', async (t) => {
  const root = await fixture(t)
  const copyRoot = join(root, 'reviewed-copy')
  await mkdir(copyRoot)
  const sourceFile = join(copyRoot, 'MEMORY.md')
  await writeFile(sourceFile, source)
  const config = join(root, 'config.json')
  await writeFile(config, JSON.stringify({ reviewed: true, sourceRoot: copyRoot, sourceFile, destination: join(root, 'candidate') }))
  assert.equal(JSON.parse((await runCli(config)).stdout).source.sha256, hash(source))
  await symlink(sourceFile, join(copyRoot, 'alias'))
  await writeFile(config, JSON.stringify({ reviewed: true, sourceRoot: copyRoot, sourceFile: join(copyRoot, 'alias') }))
  assert.equal(JSON.parse((await runCli(config)).stdout).status, 'REFUSED')
  await writeFile(config, JSON.stringify({ reviewed: false, sourceText: 'PRIVATE_SECRET' }))
  const refused = JSON.parse((await runCli(config)).stdout)
  assert.equal(refused.status, 'REFUSED')
  assert.ok(!JSON.stringify(refused).includes('PRIVATE_SECRET'))
})

test('CLI refuses inherited production root aliases and production path components', async (t) => {
  const root = await fixture(t)
  const primary = join(root, 'primary')
  await mkdir(primary)
  const sourceFile = join(primary, 'MEMORY.md')
  await writeFile(sourceFile, 'DO_NOT_READ_OR_COPY')
  const config = join(root, 'config.json')
  await writeFile(config, JSON.stringify({ reviewed: true, sourceRoot: primary, sourceFile, destination: join(root, 'candidate') }))
  const denied = JSON.parse((await runCli(config, [], { DSH_PRIMARY_WORKSPACE: primary })).stdout)
  assert.equal(denied.status, 'REFUSED')
  assert.equal(denied.reason, 'PROTECTED_PATH')
  const protectedParent = join(root, '.openclaw')
  await mkdir(protectedParent)
  await writeFile(config, JSON.stringify({ reviewed: true, sourceText: 'synthetic', destination: join(protectedParent, 'candidate') }))
  const deniedOutput = JSON.parse((await runCli(config, ['--create-copy'])).stdout)
  assert.equal(deniedOutput.status, 'REFUSED')
  assert.equal(deniedOutput.reason, 'PROTECTED_PATH')
  assert.deepEqual(await readdir(protectedParent), [])
})

test('CLI rejects canonical aliases of inherited primary and reads only direct MEMORY.md', async (t) => {
  const root = await fixture(t)
  const copyRoot = join(root, 'reviewed-copy')
  await mkdir(copyRoot)
  await writeFile(join(copyRoot, 'MEMORY.md'), 'DO_NOT_READ_OR_COPY')
  const alias = join(root, 'primary-alias')
  await symlink(copyRoot, alias)
  const config = join(root, 'config.json')
  await writeFile(config, JSON.stringify({ reviewed: true, sourceRoot: copyRoot, sourceFile: join(copyRoot, 'MEMORY.md') }))
  const protectedSource = JSON.parse((await runCli(config, [], { DSH_PRIMARY_WORKSPACE: alias })).stdout)
  assert.equal(protectedSource.status, 'REFUSED')
  assert.equal(protectedSource.reason, 'PROTECTED_PATH')
  await writeFile(join(copyRoot, 'session.json'), 'PRIVATE_SESSION')
  await writeFile(config, JSON.stringify({ reviewed: true, sourceRoot: copyRoot, sourceFile: join(copyRoot, 'session.json') }))
  const nonCore = JSON.parse((await runCli(config)).stdout)
  assert.equal(nonCore.status, 'REFUSED')
  assert.equal(nonCore.reason, 'UNSAFE_PATH')
  assert.ok(!JSON.stringify(nonCore).includes('PRIVATE_SESSION'))
})

test('CLI refuses a protected destination during dry-run without creating it', async (t) => {
  const root = await fixture(t)
  const config = join(root, 'config.json')
  await writeFile(config, JSON.stringify({ reviewed: true, sourceText: 'synthetic', destination: join(root, '.agent-core', 'copy') }))
  const result = JSON.parse((await runCli(config)).stdout)
  assert.equal(result.status, 'REFUSED')
  assert.equal(result.reason, 'PROTECTED_PATH')
  assert.deepEqual(await readdir(root), ['config.json'])
})

test('replacement of a newly created ancestor refuses before writing outside the copy', async (t) => {
  const fs = (await import('node:fs')).default
  const { syncBuiltinESMExports } = await import('node:module')
  const root = await fixture(t)
  const destination = join(root,'candidate')
  const outside = join(root,'outside')
  await mkdir(outside)
  const original = fs.promises.mkdir
  let injected = false
  fs.promises.mkdir = async (path,...args) => {
    const result = await original(path,...args)
    if (path === join(destination,'memory') && !injected) {
      injected = true
      await fs.promises.rename(path,join(destination,'memory-original'))
      await fs.promises.symlink(outside,path)
    }
    return result
  }
  syncBuiltinESMExports()
  let result
  try { result = await implementation()({sourceBytes:source,destination}) }
  finally { fs.promises.mkdir = original; syncBuiltinESMExports() }
  assert.equal(injected,true)
  assert.equal(result.status,'REFUSED')
  assert.equal(result.reason,'COPY_INCOMPLETE')
  assert.deepEqual(await readdir(outside),[])
  assert.ok((await readdir(destination)).includes('memory-original'))
})
