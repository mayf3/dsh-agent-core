import './helpers/isolated-workspace.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, realpath, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveMemoryBinding, inspectMemory, parseMemoryDocument } from '../src/inspect.js'

const execFileAsync = promisify(execFile)
const entry = '## 中文\\*标题\n\n- **ID**: `entry-1`\n- **Type**: preference\n- **Importance**: 5\n- **Tags**: `one`\n- **Updated**: 2026-10-31T00:00:00.000Z\n- **Source**: user:turn\n\nPRIVATE_BODY_不应回显\n\n---\n'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'memory-inspect-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return realpath(root)
}
async function snapshot(root) {
  const out = []
  async function walk(path, relative = '') {
    for (const name of (await readdir(path)).sort()) {
      const target = join(path, name)
      const info = await lstat(target)
      const record = { path: relative + name, mode: info.mode, mtimeMs: info.mtimeMs, size: info.size }
      if (info.isDirectory()) { out.push(record); await walk(target, relative + name + '/') }
      else { if (info.isFile()) record.hash = hash(await readFile(target)); out.push(record) }
    }
  }
  await walk(root)
  return out
}

test('lossless document spans cover bytes and retain freeform without inventing entries', () => {
  const input = Buffer.from('维护说明：保留此行\n\n' + entry + '\n尾注没有换行')
  const doc = parseMemoryDocument(input)
  assert.equal(doc.format, 'MIXED')
  assert.equal(doc.entries.length, 1)
  assert.equal(doc.entries[0].id, 'entry-1')
  assert.equal(doc.entries[0].title, '中文*标题')
  assert.equal(doc.sha256, hash(input))
  const spans = [...doc.spans, ...doc.preservedSpans].sort((a, b) => a.byteStart - b.byteStart)
  let offset = 0
  for (const span of spans) { assert.equal(span.byteStart, offset); assert.ok(span.byteEnd > offset); offset = span.byteEnd }
  assert.equal(offset, input.length)
  const span = doc.spans[0]
  assert.equal(span.entryId, 'entry-1')
  assert.equal(input.subarray(span.byteStart, span.byteEnd).toString(), entry)
  assert.equal(doc.coverage.parsedBytes, Buffer.byteLength(entry))
  assert.equal(doc.coverage.unparsedBytes, input.length - Buffer.byteLength(entry))
})

test('metadata-like freeform and damaged entry escapes remain visible as preserved bytes', () => {
  for (const text of [
    '说明\n- **ID**: `not-an-entry`\n- **Type**: preference\nplain text',
    '## broken\n\n- **ID**: `bad`\n- **Type**: invalid\ntext',
    entry.replace('中文\\*标题', 'broken\\q'),
    entry.replace('PRIVATE_BODY_不应回显', 'x'.repeat(128 * 1024)),
    entry.replace('`entry-1`', '`' + 'i'.repeat(8193) + '`'),
    entry.replace('2026-10-31T00:00:00.000Z', 'u'.repeat(8193)),
    entry.replace('user:turn', 'broken\\q'),
  ]) {
    const bytes = Buffer.from(text)
    const doc = parseMemoryDocument(bytes)
    assert.equal(doc.entries.length, 0)
    assert.equal(doc.coverage.unparsedBytes, bytes.length)
    assert.ok(['FREEFORM', 'INVALID'].includes(doc.format))
  }
})

test('generated header and UTF-8 entry without final LF preserve exact coordinates', () => {
  const header = '# MEMORY.md — long-term memory (file-first)\n\n<!-- Human-editable: this file IS the memory. Machine writes re-read it first, so manual edits win. -->\n'
  const text = header + '\n' + entry.trimEnd()
  const doc = parseMemoryDocument(Buffer.from(text))
  assert.equal(doc.format, 'STRUCTURED')
  assert.equal(doc.entries.length, 1)
  assert.equal(doc.spans[0].byteStart, Buffer.byteLength(header + '\n'))
  assert.equal(doc.spans[0].byteEnd, Buffer.byteLength(text))
})

test('binding uses trusted frozen cwd and identifies mismatch without merging directories', async (t) => {
  const root = await fixture(t)
  const primary = join(root, 'primary'); const session = join(root, 'session')
  await mkdir(primary); await mkdir(session)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: primary, session: { header: { cwd: session } } })
  assert.equal(binding.workspace, session)
  assert.equal(binding.primaryWorkspace, primary)
  assert.equal(binding.sessionWorkspace, session)
  assert.equal(binding.equality, false)
  assert.equal(binding.status, 'WORKSPACE_MISMATCH')
  assert.equal(binding.resolverOrigin, 'SESSION_HEADER_CWD')
  assert.match(binding.workspaceKey, /^v1:[a-f0-9]{64}$/)
  const same = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: primary, session: { header: { cwd: primary } } })
  assert.equal(same.equality, true)
  assert.notEqual(same.workspaceKey, binding.workspaceKey)
})

test('missing inspect creates nothing and separates absent runtime proof from configuration', async (t) => {
  const root = await fixture(t)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const before = await snapshot(root)
  const report = await inspectMemory({ binding, observedRuntime: { installedSource: 'installed-only', configuredProfile: 'profile-a' } })
  assert.equal(report.schema, 'AGENT_MEMORY_INSPECT_V1')
  assert.equal(report.core.exists, false)
  assert.equal(report.core.format, 'MISSING')
  assert.equal(report.version.installedSource, 'installed-only')
  assert.equal(report.version.loadedSource, null)
  assert.equal(report.version.evidence.loadedSource.evidenceKind, 'UNKNOWN')
  assert.equal(report.injection.lastObservedAssembly, null)
  assert.deepEqual(await snapshot(root), before)
  assert.ok(Buffer.byteLength(JSON.stringify(report)) <= 64 * 1024)
  assert.ok(!JSON.stringify(report).includes(root), 'model report must not expose absolute workspace')
})

test('coverage inspect reports structure without changing source bytes or returning content', async (t) => {
  const root = await fixture(t)
  await writeFile(join(root, 'MEMORY.md'), '维护说明\n\n' + entry)
  await mkdir(join(root, 'memory'))
  await writeFile(join(root, 'memory', '2026-10-31.md'), 'HISTORY_PRIVATE_BODY')
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const before = await snapshot(root)
  const report = await inspectMemory({ binding, detail: 'coverage' })
  assert.equal(report.core.format, 'MIXED')
  assert.equal(report.core.entries, 1)
  assert.equal(report.core.sha256, hash(await readFile(join(root, 'MEMORY.md'))))
  assert.ok(report.core.unparsedBytes > 0)
  assert.ok(report.core.parsedByteCoverage.spans.length > 0)
  assert.equal(report.injection.predictedSelectionCount, 1)
  assert.equal(report.core.tokens, null)
  assert.ok(!JSON.stringify(report).includes('PRIVATE_BODY'))
  assert.ok(!JSON.stringify(report).includes('HISTORY_PRIVATE_BODY'))
  assert.deepEqual(await snapshot(root), before)
})

test('receipt reports actual empty, injected and failed assemblies without manufacturing observations', async (t) => {
  const root = await fixture(t)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  for (const [result, selectedCount, charCount] of [['EMPTY', 0, 0], ['INJECTED', 2, 123], ['REFUSED', 0, 0]]) {
    const receipt = { workspaceKey: binding.workspaceKey, coreSha256: 'a'.repeat(64), selectedIdsDigest: 'b'.repeat(64), selectedCount, charCount, result, reason: result === 'REFUSED' ? 'READ_FAILED' : null, time: '2026-10-31T00:00:00.000Z' }
    const report = await inspectMemory({ binding, observedRuntime: { injection: { lastObservedAssembly: receipt } } })
    assert.deepEqual(report.injection.lastObservedAssembly, receipt)
    assert.equal(report.injection.evidence.lastObservedAssembly.evidenceKind, 'IN_PROCESS')
  }
})

test('invalid detail and hostile runtime payload cannot leak arbitrary content or expand output', async (t) => {
  const root = await fixture(t)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const refused = await inspectMemory({ binding, detail: 'all-history' })
  assert.equal(refused.status, 'REFUSED')
  assert.ok(refused.reasons.includes('INVALID_DETAIL'))
  const report = await inspectMemory({ binding, observedRuntime: { prompt: 'SECRET', injection: { lastObservedAssembly: { body: 'PRIVATE_BODY', workspaceKey: binding.workspaceKey } }, writer: { mode: 'x'.repeat(100000), private: 'SECRET' } } })
  assert.ok(!JSON.stringify(report).includes('SECRET'))
  assert.ok(!JSON.stringify(report).includes('PRIVATE_BODY'))
  assert.ok(Buffer.byteLength(JSON.stringify(report)) <= 64 * 1024)
})

test('oversized core is bounded and preserves all source bytes', async (t) => {
  const root = await fixture(t)
  const file = join(root, 'MEMORY.md')
  await writeFile(file, Buffer.alloc(32 * 1024 * 1024 + 1, 65))
  const before = await lstat(file)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const report = await inspectMemory({ binding })
  assert.equal(report.status, 'PARTIAL')
  assert.equal(report.core.entries, null)
  assert.equal(report.core.sha256, null)
  assert.equal(report.core.bytes, 32 * 1024 * 1024 + 1)
  assert.deepEqual((await lstat(file)).mtimeMs, before.mtimeMs)
})

test('CLI accepts an explicit trusted config and never mounts or creates memory files', async (t) => {
  const root = await fixture(t)
  const workspace = join(root, 'workspace'); await mkdir(workspace)
  const config = join(root, 'inspect-config.json')
  await writeFile(config, JSON.stringify({ agentId: 'owned-agent', primaryWorkspace: workspace }))
  const before = await snapshot(root)
  const { stdout } = await execFileAsync(process.execPath, [resolve('packages/agent-memory/src/inspect-cli.js'), '--config', config, '--detail', 'coverage'], { env: { ...process.env, DSH_PRIMARY_WORKSPACE: undefined, DSH_AGENT_ID: undefined, DSH_WORKSPACE_DIR: undefined } })
  const report = JSON.parse(stdout)
  assert.equal(report.schema, 'AGENT_MEMORY_INSPECT_V1')
  assert.equal(report.core.format, 'MISSING')
  assert.deepEqual(await snapshot(root), before)
  const help = await execFileAsync(process.execPath, [resolve('packages/agent-memory/src/inspect-cli.js'), '--help'])
  assert.match(help.stdout, /--config/)
})


test('binding refuses a relative frozen cwd and exposes verified root identity internally', async (t) => {
  const root = await fixture(t)
  const refused = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root, session: { header: { cwd: '../other' } } })
  assert.equal(refused.status, 'REFUSED')
  assert.equal((await inspectMemory({ binding: refused })).status, 'REFUSED')
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const info = await lstat(root)
  assert.equal(binding.realWorkspace, root)
  assert.deepEqual(binding.rootIdentity, { dev: String(info.dev), ino: String(info.ino) })
})

test('receipt preserves a missing or refused assembly with unknown digest instead of guessing one', async (t) => {
  const root = await fixture(t)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  for (const [result, reason] of [['EMPTY', 'MISSING'], ['REFUSED', 'READ_REFUSED'], ['REFUSED', 'GUARD_LIMIT'], ['REFUSED', 'STALE']]) {
    const receipt = { workspaceKey: binding.workspaceKey, coreSha256: null, selectedIdsDigest: 'b'.repeat(64), selectedCount: 0, charCount: 0, result, reason, time: '2026-10-31T00:00:00.000Z' }
    const report = await inspectMemory({ binding, observedRuntime: { injection: { lastObservedAssembly: receipt } } })
    assert.deepEqual(report.injection.lastObservedAssembly, receipt)
  }
})

test('last query coverage includes observed counts but strips caller content and paths', async (t) => {
  const root = await fixture(t)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const report = await inspectMemory({ binding, observedRuntime: { history: { lastQueryCoverage: { filesPlanned: 8, filesVerified: 7, bytesRead: 1234, observedAt: '2026-10-31T00:00:00Z', reasons: ['TIME_BUDGET'], excerpt: 'PRIVATE_BODY', unsearchedSources: [{ relativePath: '/private/secret', content: 'PRIVATE_BODY' }] } } } })
  assert.equal(report.history.lastQueryCoverage.filesPlanned, 8)
  assert.equal(report.history.lastQueryCoverage.filesVerified, 7)
  assert.equal(report.history.lastQueryCoverage.bytesRead, 1234)
  assert.deepEqual(report.history.lastQueryCoverage.reasons, ['TIME_BUDGET'])
  assert.equal(report.history.sourceCount, null)
  assert.ok(!JSON.stringify(report).includes('PRIVATE_BODY'))
  assert.ok(!JSON.stringify(report).includes('/private/secret'))
})

test('large coverage report stops at output budget and declares omitted ranges', async (t) => {
  const root = await fixture(t)
  await writeFile(join(root, 'MEMORY.md'), entry.repeat(2000))
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const report = await inspectMemory({ binding, detail: 'coverage' })
  assert.equal(report.status, 'PARTIAL')
  assert.ok(report.reasons.includes('OUTPUT_BUDGET'))
  assert.equal(report.core.parsedByteCoverage.complete, false)
  assert.ok(Buffer.byteLength(JSON.stringify(report)) <= 64 * 1024)
})

test('invalid detail remains REFUSED even when trusted workspace roots mismatch', async (t) => {
  const root = await fixture(t)
  await mkdir(join(root, 'primary')); await mkdir(join(root, 'session'))
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: join(root, 'primary'), session: { header: { cwd: join(root, 'session') } } })
  const report = await inspectMemory({ binding, detail: 'all-history' })
  assert.equal(report.status, 'REFUSED')
  assert.equal(report.core.exists, null)
})


test('workspace replacement remains STALE when both core and manifest verification reject identity', async (t) => {
  const root = await fixture(t)
  const workspace = join(root, 'workspace'); await mkdir(workspace)
  await writeFile(join(workspace, 'MEMORY.md'), entry)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: workspace })
  await rename(workspace, join(root, 'retired'))
  await mkdir(workspace)
  await writeFile(join(workspace, 'MEMORY.md'), 'replacement PRIVATE_BODY')
  const report = await inspectMemory({ binding })
  assert.equal(report.status, 'STALE')
  assert.equal(report.core.sha256, null)
  assert.equal(report.core.entries, null)
})

test('document parsing rejects an expired monotonic deadline before constructing line coverage', () => {
  const bytes = Buffer.from('freeform 中文 line\n'.repeat(4096))
  const before = hash(bytes)
  assert.throws(() => parseMemoryDocument(bytes, { deadline: -1 }), (error) => error.code === 'TIME_BUDGET' && error.message === 'TIME_BUDGET')
  assert.equal(hash(bytes), before)
  assert.equal(parseMemoryDocument(Buffer.from('one line'), { deadline: Infinity }).coverage.unparsedBytes, 8)
})

test('injection prediction respects the installed 512KiB tail window instead of full-file preferences', async (t) => {
  const root = await fixture(t)
  const recentHistory = entry.replace('entry-1', 'history-2').replace('**Type**: preference', '**Type**: history')
  await writeFile(join(root, 'MEMORY.md'), entry + '\n'.repeat(600 * 1024) + recentHistory)
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const report = await inspectMemory({ binding })
  assert.equal(report.core.entries, 2, 'document coverage still includes the entire current core')
  assert.equal(report.injection.predictedSelectionCount, 0, 'only the recent history entry survives assembly tail parsing')
  assert.equal(report.injection.configuredAssemblyParseBytes, 512 * 1024)
  assert.equal(report.injection.evidence.configuredAssemblyParseBytes.evidenceKind, 'CONFIGURED')
})

test('injection prediction is unknown when the exact assembly parser rejects a guarded field', async (t) => {
  const root = await fixture(t)
  await writeFile(join(root, 'MEMORY.md'), entry.replace('user:turn', 'x'.repeat(9000)))
  const binding = await resolveMemoryBinding({ agentId: 'owned-agent', primaryWorkspace: root })
  const report = await inspectMemory({ binding })
  assert.equal(report.injection.predictedSelectionCount, null)
  assert.equal(report.injection.excludedSelectionCount, null)
  assert.ok(report.reasons.includes('ASSEMBLY_GUARD_LIMIT'))
})

test('inspector honors refused trusted binding instead of reading the fallback primary',async t=>{
 const root=await mkdtemp(join(tmpdir(),'memory-refused-binding-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 await writeFile(join(root,'MEMORY.md'),'must remain unobserved')
 const binding=await resolveMemoryBinding({agentId:'synthetic',primaryWorkspace:root,session:{header:{cwd:'relative'}}})
 const report=await inspectMemory({binding})
 assert.equal(report.status,'REFUSED')
 assert.equal(report.core.sha256,null)
 assert.equal(report.core.exists,null)
})
