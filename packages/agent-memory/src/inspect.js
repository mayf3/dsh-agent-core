/** Pure, bounded memory diagnostics. This module never mounts the plugin. */
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { ENTRY_TYPES, INJECT_TYPES, MEMORY_GUARD_LIMITS, MEMORY_HEADER, parseEntries } from './memory.js'

const MAX_BYTES = 32 * 1024 * 1024
const OUTPUT_BYTES = 64 * 1024
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const fixedString = (value, max = 256) => typeof value === 'string' && value.length <= max ? value : null
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null

async function directoryIdentity(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0')) return null
  try {
    // A trusted primary workspace can have an existing legitimate mapping.
    // New members inside it are separately opened nofollow by the source reader.
    const canonical = await realpath(path)
    const info = await stat(canonical)
    return info.isDirectory() ? { path: canonical, dev: String(info.dev), ino: String(info.ino) } : null
  } catch { return null }
}

/** Resolve only trusted caller-owned context; never consult process env. */
export async function resolveMemoryBinding({ agentId, primaryWorkspace, session } = {}) {
  const primaryPath = typeof primaryWorkspace === 'string' && isAbsolute(primaryWorkspace) ? resolve(primaryWorkspace) : null
  const cwd = session?.header?.cwd
  const sessionPath = typeof cwd === 'string' && cwd.trim() !== '' && isAbsolute(cwd) ? resolve(cwd) : null
  const primaryIdentity = await directoryIdentity(primaryPath)
  const sessionIdentity = sessionPath ? await directoryIdentity(sessionPath) : null
  const selected = sessionPath ? sessionIdentity : primaryIdentity
  const workspace = selected?.path ?? sessionPath ?? primaryPath
  const primary = primaryIdentity?.path ?? primaryPath
  const sessionWorkspace = sessionIdentity?.path ?? sessionPath
  const equality = sessionPath && primaryPath
    ? (primaryIdentity && sessionIdentity ? primaryIdentity.dev === sessionIdentity.dev && primaryIdentity.ino === sessionIdentity.ino : null)
    : (primaryIdentity ? true : null)
  const invalidSessionPath = cwd !== undefined && cwd !== null && cwd !== '' && (typeof cwd !== 'string' || !isAbsolute(cwd) || cwd.includes('\0'))
  const status = !workspace || !fixedString(agentId) || invalidSessionPath ? 'REFUSED'
    : equality === false ? 'WORKSPACE_MISMATCH' : !selected ? 'UNKNOWN' : 'COMPLETE'
  const workspaceKey = workspace && fixedString(agentId)
    ? `v1:${digest(JSON.stringify({ agentId, workspace: selected ?? { path: workspace, identity: null } }))}` : null
  return { workspace, realWorkspace: selected?.path ?? null, rootIdentity: selected ? { dev: selected.dev, ino: selected.ino } : null,
    primaryWorkspace: primary, sessionWorkspace, workspaceKey,
    resolverOrigin: sessionPath ? 'SESSION_HEADER_CWD' : 'PRIMARY_WORKSPACE', equality, status }
}

/**
 * Read-only document model. Entry and preserved ranges form an exact partition
 * of the original bytes; unknown text is never reconstructed or discarded.
 */
export function parseMemoryDocument(buffer, { deadline = Infinity } = {}) {
  const assertBudget = () => {
    if (performance.now() >= deadline) {
      const error = new Error('TIME_BUDGET')
      error.code = 'TIME_BUDGET'
      throw error
    }
  }
  const checkInterval = (index) => { if ((index & 1023) === 0) assertBudget() }
  assertBudget()
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? '')
  const result = { format: 'FREEFORM', entries: [], spans: [], preservedSpans: [],
    coverage: { bytes: bytes.length, parsedBytes: 0, unparsedBytes: bytes.length },
    issues: [], sha256: digest(bytes) }
  assertBudget()
  if (bytes.length > MAX_BYTES) {
    result.format = 'INVALID'; result.issues.push({ code: 'SOURCE_TOO_LARGE' })
    if (bytes.length) result.preservedSpans.push({ byteStart: 0, byteEnd: bytes.length, kind: 'unparsed' })
    return result
  }
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch {
    result.format = 'INVALID'; result.issues.push({ code: 'INVALID_UTF8' })
    if (bytes.length) result.preservedSpans.push({ byteStart: 0, byteEnd: bytes.length, kind: 'unparsed' })
    return result
  }
  assertBudget()
  const lines = []
  let byteOffset = 0
  for (const match of text.matchAll(/[^\n]*\n|[^\n]+$/g)) {
    checkInterval(lines.length)
    const raw = match[0]
    const length = Buffer.byteLength(raw)
    lines.push({ text: raw.replace(/\r?\n$/, ''), charStart: match.index,
      byteStart: byteOffset, byteEnd: byteOffset + length })
    byteOffset += length
  }
  const candidates = []
  for (let i = 0; i < lines.length; i++) {
    checkInterval(i)
    if (!lines[i].text.startsWith('## ')) continue
    let metaLine = i + 1
    while (metaLine < lines.length && lines[metaLine].text === '') { checkInterval(metaLine); metaLine++ }
    if (/^- \*\*ID\*\*: `[^`]+`$/.test(lines[metaLine]?.text ?? '') &&
        /^- \*\*Type\*\*:/.test(lines[metaLine + 1]?.text ?? '')) candidates.push({ line: i, metaLine })
  }
  for (let i = 0; i < candidates.length; i++) {
    checkInterval(i)
    const candidate = candidates[i]
    const start = candidate.line
    const boundary = candidates[i + 1]?.line ?? lines.length
    let end = boundary
    // The final structural separator belongs to the entry; later human notes
    // remain preserved. Earlier separators can be part of verbatim content.
    let separator = -1
    for (let j = candidate.metaLine + 2; j < boundary; j++) {
      checkInterval(j)
      if (/^---[ \t]*$/.test(lines[j].text)) separator = j
    }
    if (separator !== -1) end = separator + 1
    const byteStart = lines[start].byteStart
    const byteEnd = end < lines.length ? lines[end].byteStart : bytes.length
    const title = lines[start].text.slice(3)
    const type = lines[candidate.metaLine + 1].text.slice('- **Type**:'.length).trim()
    let code = null
    // Canonical title escapes are the inverse of the existing codec. Broken
    // escape runs stay visible as unparsed text instead of acquiring identity.
    if (!ENTRY_TYPES.has(type)) code = 'INVALID_ENTRY_TYPE'
    else if (malformedEscape(title)) code = 'INVALID_ENTRY_ESCAPE'
    else if (title.length > MEMORY_GUARD_LIMITS.maxFieldChars) code = 'ENTRY_GUARD_LIMIT'
    const id = lines[candidate.metaLine].text.slice('- **ID**: `'.length, -1)
    if (!code && id.length > MEMORY_GUARD_LIMITS.maxFieldChars) code = 'ENTRY_GUARD_LIMIT'
    for (let j = candidate.metaLine + 1; !code && j < end; j++) {
      checkInterval(j)
      if (lines[j].text === '') break
      const field = lines[j].text.match(/^- \*\*(Updated|Source)\*\*: ?(.*)$/)
      if (field && field[2].length > MEMORY_GUARD_LIMITS.maxFieldChars) code = 'ENTRY_GUARD_LIMIT'
      if (field?.[1] === 'Source' && malformedEscape(field[2])) code = 'INVALID_ENTRY_ESCAPE'
    }
    let parsed
    if (!code) {
      try {
        parsed = parseEntries(bytes.subarray(byteStart, byteEnd).toString('utf8'))
        if (parsed.length !== 1 || !parsed[0].title || !ENTRY_TYPES.has(parsed[0].type)) code = 'INVALID_ENTRY_STRUCTURE'
        else if (parsed[0].content.length > MEMORY_GUARD_LIMITS.maxContentChars) code = 'ENTRY_GUARD_LIMIT'
      } catch { code = 'ENTRY_GUARD_LIMIT' }
      assertBudget()
    }
    if (code) { result.issues.push({ code, byteStart, byteEnd }); continue }
    const entry = parsed[0]
    result.entries.push(entry)
    result.spans.push({ byteStart, byteEnd, entryId: entry.id, entry })
  }
  let offset = 0
  for (const [index, span] of result.spans.entries()) {
    checkInterval(index)
    if (span.byteStart > offset) result.preservedSpans.push({ byteStart: offset, byteEnd: span.byteStart, kind: 'preserved' })
    offset = span.byteEnd
    result.coverage.parsedBytes += span.byteEnd - span.byteStart
  }
  if (offset < bytes.length) result.preservedSpans.push({ byteStart: offset, byteEnd: bytes.length, kind: 'preserved' })
  result.coverage.unparsedBytes = bytes.length - result.coverage.parsedBytes
  const nonStructural = result.preservedSpans.some(({ byteStart, byteEnd }, index) => {
    checkInterval(index)
    const piece = bytes.subarray(byteStart, byteEnd).toString('utf8')
    return piece.replace(MEMORY_HEADER.trimEnd(), '').trim() !== ''
  })
  result.format = result.issues.length ? 'INVALID'
    : result.entries.length ? (nonStructural ? 'MIXED' : 'STRUCTURED') : 'FREEFORM'
  assertBudget()
  return result
}

function malformedEscape(field) {
  const allowed = new Set('\\`*_[\]{}()#+.!|>~-')
  for (let i = 0; i < field.length; i++) {
    if (field[i] !== '\\') continue
    if (!allowed.has(field[++i])) return true
  }
  return false
}

function evidence(evidenceKind, asOf, ref = null) { return { evidenceKind, asOf, ref } }
function annotate(group, kinds, observedAt, refs = {}) {
  group.evidence = Object.fromEntries(Object.keys(group).map((key) => [key,
    evidence(group[key] === null ? 'UNKNOWN' : kinds[key] ?? 'CONFIGURED', observedAt, refs[key] ?? null)]))
  return group
}
function cleanReceipt(input, workspaceKey) {
  const unknownDigest = input?.coreSha256 === null && ((input.result === 'EMPTY' && input.reason === 'MISSING') ||
    (input.result === 'REFUSED' && ['READ_REFUSED', 'GUARD_LIMIT', 'STALE'].includes(input.reason)))
  if (!input || input.workspaceKey !== workspaceKey || (!unknownDigest && !/^[a-f0-9]{64}$/.test(input.coreSha256 ?? '')) ||
      !/^[a-f0-9]{64}$/.test(input.selectedIdsDigest ?? '') || count(input.selectedCount) === null ||
      count(input.charCount) === null || !['EMPTY', 'INJECTED', 'REFUSED'].includes(input.result) ||
      !fixedString(input.time, 64)) return null
  return { workspaceKey, coreSha256: input.coreSha256, selectedIdsDigest: input.selectedIdsDigest,
    selectedCount: input.selectedCount, charCount: input.charCount, result: input.result,
    reason: fixedString(input.reason, 64), time: input.time }
}
function cleanQueryCoverage(input) {
  if (!input || typeof input !== 'object' || count(input.filesPlanned) === null ||
      count(input.filesVerified) === null || count(input.bytesRead) === null) return null
  return { filesPlanned: input.filesPlanned, filesVerified: input.filesVerified, bytesRead: input.bytesRead,
    observedAt: fixedString(input.observedAt, 64),
    reasons: Array.isArray(input.reasons) ? input.reasons.filter((reason) => typeof reason === 'string' && /^[A-Z_]{1,64}$/.test(reason)).slice(0, 32) : [] }
}
function injectionSelection(entries, maxEntries, maxChars) {
  const candidates = entries.filter((entry) => INJECT_TYPES.has(entry.type) &&
    (entry.type === 'preference' || entry.importance >= 3)).sort((a, b) =>
    Number(a.type !== 'preference') - Number(b.type !== 'preference') || b.importance - a.importance)
  let charCount = '[memory] cross-session long-term memory of this agent:'.length + 1
  let selected = 0
  for (const entry of candidates) {
    const line = `- [${entry.type}] ${entry.title} (importance ${entry.importance}): ${entry.content}`
    if (selected >= maxEntries || charCount + line.length > maxChars) break
    charCount += line.length + 1; selected++
  }
  return { selected, excluded: entries.length - selected }
}

/** Fixed-schema model-safe inspector. No body text or absolute path escapes. */
export async function inspectMemory({ binding, observedRuntime = {}, detail = 'summary' } = {}) {
  const observedAt = new Date().toISOString()
  const reasons = []
  const validBinding = binding && typeof binding.workspace === 'string' && isAbsolute(binding.workspace) && fixedString(binding.workspaceKey) && binding.status !== 'REFUSED'
  const validDetail = detail === 'summary' || detail === 'coverage'
  let status = validBinding && validDetail ? 'COMPLETE' : 'REFUSED'
  if (!validBinding) reasons.push('INVALID_BINDING')
  if (!validDetail) reasons.push('INVALID_DETAIL')
  if (validBinding && validDetail && binding?.status === 'WORKSPACE_MISMATCH') { status = 'PARTIAL'; reasons.push('WORKSPACE_MISMATCH') }
  const modelBinding = annotate({ workspaceKey: binding?.workspaceKey ?? null,
    resolverOrigin: fixedString(binding?.resolverOrigin), primary: binding?.primaryWorkspace ? { workspace: '.', memory: 'MEMORY.md' } : null,
    session: binding?.sessionWorkspace ? { workspace: binding.equality === true ? '.' : null, memory: 'MEMORY.md' } : null,
    injection: binding?.primaryWorkspace ? 'MEMORY.md' : null, writeTarget: validBinding ? 'MEMORY.md' : null,
    equality: typeof binding?.equality === 'boolean' ? binding.equality : null },
  { workspaceKey: 'IN_PROCESS', resolverOrigin: 'IN_PROCESS', primary: 'IN_PROCESS', session: 'IN_PROCESS', injection: 'IN_PROCESS', writeTarget: 'IN_PROCESS', equality: 'IN_PROCESS' }, observedAt)
  const version = annotate({ configuredProfile: fixedString(observedRuntime.configuredProfile),
    installedSource: fixedString(observedRuntime.installedSource), loadedSource: fixedString(observedRuntime.loadedSource),
    attestationKind: fixedString(observedRuntime.attestationKind) },
  { configuredProfile: 'CONFIGURED', installedSource: 'INSTALLED', loadedSource: 'IN_PROCESS', attestationKind: 'IN_PROCESS' }, observedAt)
  const core = { exists: null, bytes: null, sha256: null, format: null, entries: null, parsedByteCoverage: null,
    unparsedBytes: null, guardStatus: null, budgetStatus: null, readOnlyReason: null, tokens: null }
  const configuredEntries = count(observedRuntime.injection?.maxEntries) ?? 6
  const configuredChars = count(observedRuntime.injection?.maxChars) ?? 2400
  const injection = { configured: typeof observedRuntime.injection?.configured === 'boolean' ? observedRuntime.injection.configured : null,
    configuredMaxEntries: configuredEntries, configuredMaxChars: configuredChars, predictedSelectionCount: null,
    excludedSelectionCount: null, lastObservedAssembly: cleanReceipt(observedRuntime.injection?.lastObservedAssembly, binding?.workspaceKey) }
  const history = { enabled: null, manifestDigest: null, sourceKinds: ['core', 'daily', 'archive'], sourceCount: null, lastQueryCoverage: cleanQueryCoverage(observedRuntime.history?.lastQueryCoverage) }
  const writer = { mode: fixedString(observedRuntime.writer?.mode, 64), ownerKnown: typeof observedRuntime.writer?.ownerKnown === 'boolean' ? observedRuntime.writer.ownerKnown : null,
    pendingTransaction: fixedString(observedRuntime.writer?.pendingTransaction, 128), cursorState: fixedString(observedRuntime.writer?.cursorState, 64),
    lastCommit: fixedString(observedRuntime.writer?.lastCommit, 128), pressure: fixedString(observedRuntime.writer?.pressure, 64) }
  const checks = []
  if (validBinding && validDetail) {
    const { readVerifiedSource, readHistoryManifest } = await import('./history.js')
    const source = await readVerifiedSource(binding, 'MEMORY.md', { maxBytes: MAX_BYTES })
    core.bytes = count(source.size)
    if (source.bytes && source.status === 'COMPLETE') {
      const document = parseMemoryDocument(source.bytes)
      core.exists = true; core.sha256 = source.sha256; core.format = document.format; core.entries = document.entries.length
      core.unparsedBytes = document.coverage.unparsedBytes
      core.parsedByteCoverage = { complete: detail === 'coverage', bytes: document.coverage.parsedBytes, totalBytes: document.coverage.bytes,
        spans: detail === 'coverage' ? document.spans.map(({ byteStart, byteEnd }) => ({ byteStart, byteEnd })) : null,
        preservedSpans: detail === 'coverage' ? document.preservedSpans : null }
      core.guardStatus = document.issues.length ? 'INVALID' : 'PASS'
      core.readOnlyReason = document.issues.length ? 'READ_ONLY_FORMAT' : null
      core.budgetStatus = source.size > 64 * 1024 || document.entries.length > 128 ? 'OVER_CORE_BUDGET' : 'WITHIN_CORE_BUDGET'
      const selected = injectionSelection(document.entries, configuredEntries, configuredChars)
      injection.predictedSelectionCount = selected.selected; injection.excludedSelectionCount = selected.excluded
      if (document.issues.length) { status = 'PARTIAL'; reasons.push(...new Set(document.issues.map((issue) => issue.code))) }
    } else if (source.reason === 'MISSING' || source.status === 'MISSING') {
      core.exists = false; core.bytes = 0; core.format = 'MISSING'; core.entries = 0; core.unparsedBytes = 0
      core.guardStatus = 'MISSING'; core.budgetStatus = 'MISSING'
      injection.predictedSelectionCount = 0; injection.excludedSelectionCount = 0
    } else {
      core.exists = source.size !== null && source.size !== undefined ? true : null
      status = source.status === 'STALE' ? 'STALE' : 'PARTIAL'; reasons.push(fixedString(source.reason, 64) ?? 'CORE_UNVERIFIED')
      core.guardStatus = 'UNVERIFIED'
    }
    const manifest = await readHistoryManifest(binding)
    history.enabled = typeof manifest.enabled === 'boolean' ? manifest.enabled : manifest.status === 'COMPLETE' && manifest.digest !== null
    history.manifestDigest = fixedString(manifest.digest, 64)
    // Summary deliberately does not enumerate/read daily or archive bodies.
    history.sourceCount = null // Daily members were not enumerated; do not invent a corpus count.
    if (manifest.status !== 'COMPLETE') { status = status === 'STALE' || manifest.reason === 'STALE' ? 'STALE' : 'PARTIAL'; reasons.push(fixedString(manifest.reason, 64) ?? 'HISTORY_MANIFEST_UNVERIFIED') }
    checks.push({ check: 'CORE_READ', status: source.status, evidenceKind: 'OBSERVED_FILE', asOf: observedAt, ref: 'MEMORY.md' },
      { check: 'HISTORY_METADATA_ONLY', status: manifest.status, evidenceKind: 'OBSERVED_FILE', asOf: observedAt, ref: 'memory/history-manifest.json' })
  }
  annotate(core, Object.fromEntries(Object.keys(core).map((key) => [key, key === 'readOnlyReason' ? 'CONFIGURED' : 'OBSERVED_FILE'])), observedAt,
    Object.fromEntries(Object.keys(core).map((key) => [key, 'MEMORY.md'])))
  annotate(injection, { predictedSelectionCount: 'OBSERVED_FILE', excludedSelectionCount: 'OBSERVED_FILE', lastObservedAssembly: 'IN_PROCESS' }, observedAt)
  annotate(history, { manifestDigest: 'OBSERVED_FILE', enabled: 'OBSERVED_FILE', sourceCount: 'OBSERVED_FILE', lastQueryCoverage: 'IN_PROCESS' }, observedAt)
  annotate(writer, Object.fromEntries(Object.keys(writer).map((key) => [key, 'IN_PROCESS'])), observedAt)
  const report = { schema: 'AGENT_MEMORY_INSPECT_V1', status, observedAt,
    scope: { workspaceKey: binding?.workspaceKey ?? null, detail: validDetail ? detail : null, currentCore: 'MEMORY.md', history: 'METADATA_ONLY' },
    binding: modelBinding, version, core, injection, history, writer, checks, reasons: [...new Set(reasons)] }
  if (Buffer.byteLength(JSON.stringify(report)) > OUTPUT_BYTES) {
    report.status = 'PARTIAL'; report.reasons.push('OUTPUT_BUDGET')
    report.core.parsedByteCoverage.complete = false
    report.core.parsedByteCoverage.spans = null; report.core.parsedByteCoverage.preservedSpans = null
  }
  return report
}
