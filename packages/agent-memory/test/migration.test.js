/**
 * Migration tool CLI tests (SIGTRAP fix v1) — synthetic corrupted MEMORY.md
 * fixtures through the real CLI: dry-run purity, apply with backup +
 * metadata preservation, validation refusals, idempotent re-run.
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, describe } from 'node:test'

import { loadEntries, MEMORY_HEADER, renderEntries } from '../src/memory.js'

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'agent-memory-sigtrap-migration-v1.mjs')
const NOW = '2026-09-02T00:00:00.000Z'

// The historical asymmetric codec (exact pre-fix semantics).
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const oldEsc = (t) => String(t).replace(ESCAPE, '\\$1')
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

function legacyBlock({ id, title, source, layers, content = 'body' }) {
  let stored = source
  for (let i = 0; i < layers; i++) stored = oldEsc(stored)
  return `## ${oldEsc(title)}\n\n- **ID**: \`${id}\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`${oldEsc('t*')}\`\n- **Updated**: ${NOW}\n- **Source**: ${stored}\n\n${content}\n\n---\n`
}

function legacyDoc() {
  // Three entries: clean-ish one-layer no-op, heavily amplified, one-layer
  // with specials (already at the stored fixpoint — must NOT be rewritten).
  // Byte-exact header (the real production files carry MEMORY_HEADER).
  return MEMORY_HEADER
    + legacyBlock({ id: 'id-a', title: 'A', source: 'consolidation:session:main', layers: 1 })
    + legacyBlock({ id: 'id-b', title: 'B', source: 'consolidation:session:x-1', layers: 12 })
    + legacyBlock({ id: 'id-c', title: 'C', source: 'tool (v1.0)', layers: 1, content: 'body `c` ---\nline2' })
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, ...env } })
}

describe('agent-memory-sigtrap-migration-v1 CLI', () => {
  test('dry-run: correct rewrite census, zero mutation, report written', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-migration-'))
    try {
      const file = join(dir, 'MEMORY.md')
      const doc = legacyDoc()
      await writeFile(file, doc)
      const reports = join(dir, 'reports')
      const child = runCli(['--file', file, '--report', reports])
      assert.equal(child.status, 0, child.stderr?.slice(0, 400))
      assert.match(child.stdout, /DRY-RUN OK — 1 source line\(s\) would be rewritten, 0 ambiguous/)
      assert.equal(await readFile(file, 'utf8'), doc) // read-only
      const report = JSON.parse(await readFile(join(reports, 'MEMORY.md.sigtrap-migration.json'), 'utf8'))
      assert.equal(report.applied, false)
      assert.equal(report.refused, null)
      assert.equal(report.entriesAnalyzed, 3)
      assert.equal(report.validations.rewrittenCount, 1)
      assert.equal(report.validations.renderFixpoint, true)
      assert.equal(report.validations.logicalContentPreserved, true)
      const amplified = report.entries.find((e) => e.id === 'id-b')
      assert.equal(amplified.layers, 12)
      assert.equal(amplified.candidate, 'consolidation:session:x-1')
      assert.equal(amplified.rewritten, true) // dry-run marks the candidate it WOULD rewrite
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('apply: rewrites only the amplified line, backup immutable + sha-verified, metadata preserved, fixpoint installed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-migration-'))
    try {
      const file = join(dir, 'MEMORY.md')
      const doc = legacyDoc()
      await writeFile(file, doc)
      await chmod(file, 0o640)
      const backupDir = join(dir, 'backups')
      const child = runCli(['--file', file, '--apply', '--backup-dir', backupDir])
      assert.equal(child.status, 0, child.stderr?.slice(0, 400))
      assert.match(child.stdout, /APPLIED/)

      const migrated = await readFile(file, 'utf8')
      // Only the id-b Source line changed.
      // Stored form is esc(candidate): the '-' carries one escape level.
      assert.match(migrated, /^- \*\*Source\*\*: consolidation:session:x\\-1$/m)
      assert.equal(migrated.includes('\\'.repeat(8)), false)
      assert.match(migrated, /^- \*\*Source\*\*: consolidation:session:main$/m)
      assert.match(migrated, /^- \*\*Source\*\*: tool \\\(v1\\.0\\\)$/m)
      // Full semantic + format validation under PRODUCTION limits.
      const parsed = await loadEntries(file)
      assert.equal(parsed.length, 3)
      assert.deepEqual(parsed.map((e) => e.source), ['consolidation:session:main', 'consolidation:session:x-1', 'tool (v1.0)'])
      assert.equal(parsed[2].content, 'body `c` ---\nline2')
      assert.equal(renderEntries(parsed), migrated) // byte fixpoint
      // Metadata preserved (mode 0640 carried through the rename).
      assert.equal(((await stat(file)).mode & 0o777), 0o640)
      // Immutable backup + sidecar sha.
      const backups = await readdir(backupDir)
      const backup = backups.find((f) => f.includes('.pre-sigtrapfix-v1-') && !f.endsWith('.sha256'))
      assert.ok(backup, 'timestamped backup exists')
      assert.equal((await stat(join(backupDir, backup))).mode & 0o777, 0o400)
      assert.equal(await readFile(join(backupDir, backup), 'utf8'), doc)
      const sidecar = backups.find((f) => f.endsWith('.sha256'))
      assert.ok(sidecar)
      const entries = await readdir(dir)
      assert.deepEqual(entries.filter((f) => f.includes('.sigtrap-migrate-') || f.includes('.tmp-')), [])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('apply is idempotent: second run rewrites nothing and keeps bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-migration-'))
    try {
      const file = join(dir, 'MEMORY.md')
      await writeFile(file, legacyDoc())
      assert.equal(runCli(['--file', file, '--apply']).status, 0)
      const once = await readFile(file, 'utf8')
      const child = runCli(['--file', file, '--apply'])
      assert.equal(child.status, 0, child.stderr?.slice(0, 300))
      assert.match(child.stdout, /0 line\(s\) rewritten, post-validate PASS/)
      assert.equal(await readFile(file, 'utf8'), once)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('refusal: a file failing the candidate validation is never mutated (exit 2)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-migration-'))
    try {
      const file = join(dir, 'MEMORY.md')
      // Prose between the header and the first anchor breaks the render
      // fixpoint (renderEntries would drop it) → strict refusal.
      const noisy = legacyDoc().replace('\n## ', 'HUMAN PROSE LINE\n\n## ')
      await writeFile(file, noisy)
      const child = runCli(['--file', file, '--apply'])
      assert.equal(child.status, 2)
      assert.match(child.stderr, /REFUSED/)
      assert.equal(await readFile(file, 'utf8'), noisy)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('missing --file is a usage refusal', () => {
    const child = runCli([])
    assert.equal(child.status, 2)
    assert.match(child.stderr, /usage:/)
  })
})
