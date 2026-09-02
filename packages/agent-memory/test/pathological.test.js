/**
 * Pathological regression fixtures (SIGTRAP fix v1).
 *
 * Freezes the mechanically-calibrated crash boundary against the OLD codec
 * and proves the NEW code survives the same fixtures with a bounded,
 * structured refusal:
 *   - calibration (measured 2026-09-02, node v26.7.0): old-codec
 *     String.replace on a 2^26-char source dies with SIGTRAP (rc 133,
 *     V8_Fatal — uncatchable); 2^25 survives. Production corrupted files
 *     store sources of exactly this fatal region (max observed 2^26+49).
 *   - the OLD algorithm runs in a CHILD PROCESS (a V8 fatal kills the
 *     process; it can never be asserted in-process).
 *   - the NEW code refuses the same file via the load-side size guard
 *     BEFORE any giant regexp work, leaves the file byte-identical, and
 *     the process exits clean.
 */

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, describe } from 'node:test'

const WORKTREE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MEMORY_JS = join(WORKTREE, 'packages', 'agent-memory', 'src', 'memory.js')
const NOW = '2026-09-02T00:00:00.000Z'

// The historical asymmetric codec (exact pre-fix semantics).
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const oldEsc = (t) => String(t).replace(ESCAPE, '\\$1')

const SEED = 'consolidation:session:cron-run-occ:47081' // HR census seed (51 chars)
const FATAL_REGION = 67_108_864 // 2^26 — calibrated SIGTRAP threshold

function legacyEntryDoc(storedSource, { id = 'pat-1', title = 'pat' } = {}) {
  return `## ${title}\n\n- **ID**: \`${id}\`\n- **Type**: preference\n- **Importance**: 3\n- **Tags**: \`\`\n- **Updated**: ${NOW}\n- **Source**: ${storedSource}\n\nbody\n\n---\n`
}

const OLD_CHILD_SCRIPT = `
const ESCAPE = /([\\\\\`*_\\[\\]{}()#+.!|>~-])/g
const oldEsc = (t) => String(t).replace(ESCAPE, '\\\\$1')
const { readFileSync } = await import('node:fs')
const text = readFileSync(process.env.FIXTURE_FILE, 'utf8')
// OLD parse: source stays RAW; OLD render: esc(source) with no decode.
const m = text.match(/^- \\*\\*Source\\*\\*: (.*)$/m)
const stored = m[1]
const rendered = '- **Source**: ' + oldEsc(stored) + '\\n'
console.log('OLD-RENDER-SURVIVED ' + rendered.length)
`

async function writeFatFixture(dir, targetChars) {
  let stored = SEED
  while (stored.length < targetChars) stored = oldEsc(stored)
  const file = join(dir, 'MEMORY.md')
  await writeFile(file, legacyEntryDoc(stored))
  return { file, storedLen: stored.length }
}

describe('pathological regression fixtures (child-process calibrated)', () => {
  test('OLD codec on the 2^26-char fixture: REPRO_SIGTRAP = YES (process dies, uncatchable)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-pathological-'))
    try {
      const { file, storedLen } = await writeFatFixture(dir, FATAL_REGION)
      assert.ok(storedLen >= FATAL_REGION)
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', OLD_CHILD_SCRIPT], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, FIXTURE_FILE: file } })
      // Frozen from calibration: SIGTRAP (V8 fatal). Assert the process did
      // NOT survive and died by SIGTRAP — never a clean structured refusal.
      assert.ok(child.signal === 'SIGTRAP' || child.status === 133 || child.status === 134,
        `expected SIGTRAP-class death, got signal=${child.signal} status=${child.status} stderr=${child.stderr?.slice(0, 400)}`)
      assert.ok(!child.stdout?.includes('OLD-RENDER-SURVIVED'), 'old codec must not survive the fatal-region fixture')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('OLD codec just below the boundary survives (calibration sanity: 2^25 region)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-pathological-'))
    try {
      await writeFatFixture(dir, FATAL_REGION / 2)
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', OLD_CHILD_SCRIPT], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, FIXTURE_FILE: join(dir, 'MEMORY.md') } })
      assert.equal(child.status, 0, `calibration drift: ${child.stderr?.slice(0, 300)}`)
      assert.match(child.stdout, /OLD-RENDER-SURVIVED/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('NEW code on the same fatal-region file: SIGTRAP = NO, PROCESS_SURVIVES = YES, file untouched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-pathological-'))
    try {
      const { file } = await writeFatFixture(dir, FATAL_REGION)
      const bytesBefore = (await stat(file)).size
      const childScript = `
        const { loadEntries, writeEntries, renderEntries, MemoryGuardError } = await import(${JSON.stringify(MEMORY_JS)})
        try {
          await loadEntries(${JSON.stringify(file)})
          console.log('UNEXPECTED-PARSE-OK')
        } catch (error) {
          console.log('GUARD=' + error.code + ' which=' + error.which)
        }
        try {
          await writeEntries(${JSON.stringify(file)}, [])
          console.log('UNEXPECTED-WRITE-OK')
        } catch (error) {
          console.log('WRITE-GUARD=' + (error.code ?? error.message).slice(0, 60))
        }
        console.log('PROCESS-SURVIVES')
      `
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], { encoding: 'utf8', timeout: 120_000 })
      assert.equal(child.status, 0, `new code must survive: ${child.stderr?.slice(0, 400)}`)
      assert.equal(child.signal, null)
      assert.match(child.stdout, /GUARD=MEMORY_GUARD_LIMIT which=memory file/)
      assert.match(child.stdout, /PROCESS-SURVIVES/)
      // The corrupted file was NOT mutated and no tmp file appeared.
      assert.equal((await stat(file)).size, bytesBefore)
      assert.deepEqual((await readdir(dir)).filter((f) => f.includes('.tmp-')), [])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('NEW code on a mid-size corrupted file (under file bound): decoded-field guard, process survives', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-memory-pathological-'))
    try {
      const file = join(dir, 'MEMORY.md')
      await writeFile(file, legacyEntryDoc('x'.repeat(200_000)))
      const childScript = `
        const { loadEntries, MemoryGuardError } = await import(${JSON.stringify(MEMORY_JS)})
        try {
          await loadEntries(${JSON.stringify(file)})
          console.log('UNEXPECTED-PARSE-OK')
        } catch (error) {
          console.log('GUARD=' + error.code + ' which=' + error.which)
        }
        console.log('PROCESS-SURVIVES')
      `
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], { encoding: 'utf8', timeout: 60_000 })
      assert.equal(child.status, 0)
      assert.match(child.stdout, /GUARD=MEMORY_GUARD_LIMIT which=decoded field/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
