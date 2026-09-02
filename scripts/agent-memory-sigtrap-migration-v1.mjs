#!/usr/bin/env node
/**
 * agent-memory SIGTRAP fix v1 — one-off SOURCE escape-amplification migration.
 *
 * Repairs MEMORY.md files written by the historical asymmetric codec (source
 * escaped on render, never decoded on parse), whose `- **Source**:` lines
 * carry esc^k(original) values up to tens of MB. See
 * packages/agent-memory/src/memory.js "SOURCE CODEC CONTRACT (frozen)".
 *
 * Transform: per entry, ONLY the `- **Source**:` line is rewritten, and only
 * when the recovery is mechanical: the stored value is unwrapped while
 * escape-canonical (recoverSource); a non-canonical or pair-free state is
 * exactly the original, and the line is re-escaped exactly once (esc(candidate))
 * — the byte shape the FIXED codec renders, so parse(render(file)) is a
 * byte fixpoint afterwards. Entries whose recovery is ambiguous (candidate
 * still carries a `\`+ESCAPE pair, or the unwrap bound was hit) are NOT
 * rewritten: the stored line is already bounded and stable under the fixed
 * codec, so keeping it verbatim is the fail-safe representation and preserves
 * the raw evidence in place. Nothing else in the file is touched (no
 * re-render, no canonicalization) — non-source memory content cannot be
 * lost by construction, and this is verified per entry before any write.
 *
 * Safety (default is DRY-RUN; --apply required for any mutation):
 *   1. immutable timestamped backup (copyFile + fsync + chmod 0400 + sha256)
 *   2. preimage gate: re-stat + re-sha the live file right before the rename
 *   3. tmp file in the SAME directory, fsynced, original mode/uid/gid carried
 *   4. atomic rename + directory fsync
 *   5. post-validate the installed file (parse under PRODUCTION guard limits,
 *      render fixpoint, sha equality)
 *   6. any failure after the rename restores the exact backup bytes and
 *      verifies the sha before exiting non-zero
 *
 * Usage:
 *   node scripts/agent-memory-sigtrap-migration-v1.mjs --file <MEMORY.md> \
 *        [--apply] [--report <dir>] [--backup-dir <dir>]
 *
 * Exit codes: 0 OK · 1 runtime error (rolled back if mutated) · 2 refusal
 * (preimage gate / validation failure, no mutation performed).
 */

import { createHash } from 'node:crypto'
import { open, chmod, chown, copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

const WORKTREE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const { parseEntries, renderEntries, recoverSource, escapeFieldValue, MEMORY_GUARD_LIMITS, MIGRATION_GUARD_LIMITS } =
  await import(`${WORKTREE_ROOT}/packages/agent-memory/src/memory.js`)

const TOOL = 'agent-memory-sigtrap-migration-v1'
const ANCHOR_RE = /^- \*\*ID\*\*: `([^`]+)`\n- \*\*Type\*\*:/gm
const SOURCE_LINE_RE = /^- \*\*Source\*\*: (.*)$/m

const args = process.argv.slice(2)
function argValue(flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const fileArg = argValue('--file')
const file = fileArg ? resolve(fileArg) : undefined
const apply = args.includes('--apply')
const reportDir = argValue('--report') ? resolve(argValue('--report')) : undefined
const backupDir = argValue('--backup-dir') ? resolve(argValue('--backup-dir')) : undefined
if (!file) {
  console.error('usage: --file <MEMORY.md> [--apply] [--report <dir>] [--backup-dir <dir>]')
  process.exit(2)
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const logicalProjection = (e) => JSON.stringify([e.type, e.title, e.content, e.tags, e.importance, e.updatedAt])

async function fsyncPath(path) {
  const handle = await open(path, 'r')
  try { await handle.sync() } finally { await handle.close() }
}
async function fsyncDir(dir) {
  const handle = await open(dir, 'r')
  try { await handle.sync() } finally { await handle.close() }
}

// ── read + analyze (read-only) ─────────────────────────────────────────────
const info = await stat(file)
const rawBuf = await readFile(file)
const rawSha = sha256(rawBuf)
const text = rawBuf.toString('utf8')

// Walk entry blocks exactly like parseEntries anchors, then locate each
// block's FIRST Source meta line (same first-match-wins rule as META_RE).
const anchors = [...text.matchAll(ANCHOR_RE)]
const entries = []
for (let i = 0; i < anchors.length; i++) {
  const blockStart = anchors[i].index
  const blockEnd = i + 1 < anchors.length ? anchors[i + 1].index : text.length
  const block = text.slice(blockStart, blockEnd)
  const m = block.match(SOURCE_LINE_RE)
  if (!m) {
    // Block without a Source meta line: kept as a placeholder so entry
    // indexes stay aligned with parseEntries output for validation.
    entries.push({ index: i, id: anchors[i][1], raw: undefined, noSource: true,
      rewritten: false, layers: 0, ambiguous: false, bounded: false, source: undefined })
    continue
  }
  const valueStart = blockStart + m.index + '- **Source**: '.length
  const raw = m[1]
  const recovery = recoverSource(raw, MIGRATION_GUARD_LIMITS)
  const lineEnd = valueStart + raw.length // exclusive (excludes the \n)
  entries.push({
    index: i,
    id: anchors[i][1],
    raw,
    rawLen: raw.length,
    rawSha256: sha256(raw),
    rawHead: raw.length > 64 ? raw.slice(0, 32) + '…' + raw.slice(-16) : raw,
    lineStart: valueStart,
    lineEnd,
    eol: text.slice(lineEnd, lineEnd + 1) === '\r' ? '\r\n' : '\n',
    ...recovery,
    rewritten: false,
  })
}
const originalParsed = parseEntries(text, { limits: MIGRATION_GUARD_LIMITS })

// ── build the candidate transform ──────────────────────────────────────────
let out = ''
let cursor = 0
for (const e of entries) {
  if (e.layers === 0 && !e.ambiguous && e.raw === e.source) continue // nothing to do
  if (e.ambiguous) continue // fail-safe: keep the raw line (bounded + stable + evidence in place)
  const replacement = escapeFieldValue(e.source, MIGRATION_GUARD_LIMITS)
  if (replacement === e.raw) continue // already at the one-layer fixpoint
  out += text.slice(cursor, e.lineStart) + replacement
  cursor = e.lineEnd
  e.rewritten = true
  e.newLen = replacement.length
}
out += text.slice(cursor)

// ── validate the candidate BEFORE any mutation ─────────────────────────────
const validations = {}
let refused = null
try {
  const migratedParsed = parseEntries(out, { limits: MEMORY_GUARD_LIMITS })
  validations.parseUnderProductionLimits = true
  validations.entryCountEqual = migratedParsed.length === originalParsed.length
  validations.idSequenceEqual = migratedParsed.every((e, i) => e.id === originalParsed[i].id)
  validations.logicalContentPreserved = migratedParsed.every((e, i) =>
    logicalProjection(e) === logicalProjection(originalParsed[i]))
  validations.sourceRecovered = migratedParsed.every((e, i) => {
    const expected = entries[i].rewritten ? entries[i].source : originalParsed[i].source
    return e.source === expected
  })
  validations.sourcesBounded = migratedParsed.every((e) => e.source.length <= MEMORY_GUARD_LIMITS.maxFieldChars)
  validations.renderFixpoint = renderEntries(migratedParsed) === out
  let stable = out
  for (let i = 0; i < 3; i++) stable = renderEntries(parseEntries(stable))
  validations.repeatedRenderStable = stable === out
  validations.rewrittenCount = entries.filter((e) => e.rewritten).length
  validations.ambiguousCount = entries.filter((e) => e.ambiguous).length
  const required = ['entryCountEqual', 'idSequenceEqual', 'logicalContentPreserved', 'sourceRecovered',
    'sourcesBounded', 'renderFixpoint', 'repeatedRenderStable']
  if (!required.every((k) => validations[k])) {
    refused = `candidate validation failed: ${required.filter((k) => !validations[k]).join(',')}`
  }
} catch (error) {
  refused = `candidate rejected: ${error.message}`
}

const report = {
  tool: TOOL,
  file,
  applied: false,
  mode: apply ? 'apply' : 'dry-run',
  original: { bytes: info.size, sha256: rawSha, mode: (info.mode & 0o7777).toString(8), uid: info.uid, gid: info.gid, mtime: info.mtime.toISOString() },
  entriesAnalyzed: entries.length,
  validations,
  entries: entries.map((e) => ({
    id: e.id, layers: e.layers, ambiguous: e.ambiguous, bounded: e.bounded, rewritten: e.rewritten,
    rawLen: e.rawLen, newLen: e.newLen ?? e.rawLen, rawSha256: e.rawSha256,
    candidate: e.source, candidateSha256: sha256(e.source), rawHead: e.rawHead,
  })),
  refused,
}
if (refused) {
  await writeReport(report)
  console.log(JSON.stringify(report, null, 1))
  console.error(`${TOOL}: REFUSED — ${refused} (no mutation performed)`)
  process.exit(2)
}

// ── backup + apply (only with --apply) ─────────────────────────────────────
async function writeReport(report) {
  if (!reportDir) return
  await mkdir(reportDir, { recursive: true })
  await writeFile(join(reportDir, `${basename(file)}.sigtrap-migration.json`), JSON.stringify(report, null, 1))
}

async function makeBackup() {
  const dir = backupDir ?? dirname(file)
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(dir, `${basename(file)}.pre-sigtrapfix-v1-${stamp}`)
  await copyFile(file, backupPath)
  await fsyncPath(backupPath)
  await chmod(backupPath, 0o400)
  const backupSha = sha256(await readFile(backupPath))
  if (backupSha !== rawSha) throw new Error(`backup sha mismatch (${backupSha} != ${rawSha})`)
  await writeFile(`${backupPath}.sha256`, `${backupSha}  ${basename(backupPath)}\n`)
  return backupPath
}

async function restoreFromBackup(backupPath) {
  const backupBytes = await readFile(backupPath)
  const restoredSha = sha256(backupBytes)
  if (restoredSha !== rawSha) throw new Error(`backup content changed, refusing restore (sha ${restoredSha})`)
  const tmp = `${file}.sigtrap-restore-${process.pid}-${Date.now()}`
  const handle = await open(tmp, 'w', info.mode & 0o7777)
  try {
    await handle.write(backupBytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
  try { await chown(tmp, info.uid, info.gid) } catch { /* best effort when not the owner */ }
  await rename(tmp, file)
  await fsyncDir(dirname(file))
  const verifySha = sha256(await readFile(file))
  if (verifySha !== rawSha) throw new Error(`restore sha mismatch after rename (${verifySha})`)
}

if (!apply) {
  report.applied = false
  await writeReport(report)
  console.log(JSON.stringify(report, null, 1))
  console.log(`${TOOL}: DRY-RUN OK — ${validations.rewrittenCount} source line(s) would be rewritten, ${validations.ambiguousCount} ambiguous kept as-is`)
  process.exit(0)
}

let backupPath
try {
  backupPath = await makeBackup()
  // Write the migrated document to a same-directory tmp file, fsynced, with
  // the original metadata carried over.
  const tmp = `${file}.sigtrap-migrate-${process.pid}-${Date.now()}`
  const handle = await open(tmp, 'w', info.mode & 0o7777)
  try {
    await handle.write(out, 0, 'utf8')
    try { await handle.chown(info.uid, info.gid) } catch { /* best effort when not the owner */ }
    await handle.sync()
  } finally {
    await handle.close()
  }
  // Preimage gate: the live file must still be exactly what we analyzed.
  const gateStat = await stat(file)
  const gateSha = sha256(await readFile(file))
  if (gateStat.size !== info.size || gateSha !== rawSha) {
    await unlink(tmp).catch(() => {})
    throw Object.assign(new Error(`preimage gate failed: live file changed since analysis (sha ${gateSha})`), { code: 'PREIMAGE_GATE' })
  }
  await rename(tmp, file)
  await fsyncDir(dirname(file))

  // Post-validate the INSTALLED file.
  const installedBuf = await readFile(file)
  const installedSha = sha256(installedBuf)
  if (installedSha !== sha256(out)) throw new Error(`installed sha mismatch (${installedSha})`)
  const installedParsed = parseEntries(installedBuf.toString('utf8'))
  if (renderEntries(installedParsed) !== installedBuf.toString('utf8')) throw new Error('installed render fixpoint failed')

  report.applied = true
  report.backup = backupPath
  report.migrated = { bytes: info.size - (rawBuf.length - Buffer.byteLength(out)), sha256: installedSha }
  await writeReport(report)
  console.log(JSON.stringify(report, null, 1))
  console.log(`${TOOL}: APPLIED — backup ${backupPath}, ${validations.rewrittenCount} line(s) rewritten, post-validate PASS`)
  process.exit(0)
}
catch (error) {
  report.applied = false
  report.error = error.message
  if (error.code === 'PREIMAGE_GATE') {
    // The live file was modified by someone else after our analysis: it is
    // not ours to touch. Leave it byte-exact as the concurrent writer left
    // it (never clobber their newer content with the analyzed preimage).
    report.restoredFrom = null
    report.leftUntouched = true
    await writeReport(report).catch(() => {})
    console.error(JSON.stringify(report, null, 1))
    console.error(`${TOOL}: REFUSED — ${error.message} (live file left untouched)`)
    process.exit(2)
  }
  const mutated = backupPath !== undefined
    && (await stat(file).then(async () => sha256(await readFile(file)) !== rawSha).catch(() => true))
  let restored = null
  if (mutated) {
    await restoreFromBackup(backupPath)
    restored = backupPath
  }
  report.restoredFrom = restored
  await writeReport(report).catch(() => {})
  console.error(JSON.stringify(report, null, 1))
  console.error(`${TOOL}: FAILED — ${error.message}${restored ? ` (original restored from ${restored}, sha verified)` : ' (no mutation had been performed)'}`)
  process.exit(1)
}
