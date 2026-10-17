/**
 * §8 index tests: coordinate-only content, lazy rebuild on drift, lookups.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, appendFileSync, utimesSync } from 'node:fs'
import { join } from 'node:path'

import { buildSessionIndex, ensureFreshSessionIndex, loadSessionIndex, indexLookups, extractJournalCoordinates } from '../src/session-index.js'
import { buildFixtureRoot, destroyFixtureRoot, WF_ID, MESSAGE_ID, OCC_ID } from './fixtures.js'

test('index builds coordinate-only entries; no message text ever lands in the index file', async () => {
  const fixture = buildFixtureRoot()
  try {
    const indexDir = join(fixture.paths.controlDir, 'execution-history-index')
    const built = buildSessionIndex({ homesRoot: fixture.paths.homesRoot, indexDir })
    assert.ok(built.entries.length >= 3, 'three fixture journals indexed')
    const raw = loadSessionIndex(indexDir)
    assert.ok(raw !== null)
    const serialized = JSON.stringify(raw)
    assert.ok(!serialized.includes('private user text'), 'no message text in index')
    assert.ok(!serialized.includes('HR private diary'), 'no foreign text in index')
    const lookups = indexLookups(raw)
    assert.ok(lookups.byWorkflowInstanceId(WF_ID).some((e) => e.agentId === 'agt_a'))
    assert.ok(lookups.byMessageId(MESSAGE_ID).some((e) => e.agentId === 'agt_a'))
    assert.ok(lookups.byCronOccurrence(OCC_ID).some((e) => e.agentId === 'agt_hr'), 'cron-run naming join')
  } finally { destroyFixtureRoot(fixture) }
})

test('ensureFresh rebuilds on drift (append + mtime bump) and is stable when untouched', async () => {
  const fixture = buildFixtureRoot()
  try {
    const indexDir = join(fixture.paths.controlDir, 'execution-history-index')
    const first = ensureFreshSessionIndex({ homesRoot: fixture.paths.homesRoot, indexDir })
    assert.equal(first.rebuilt, true)
    const second = ensureFreshSessionIndex({ homesRoot: fixture.paths.homesRoot, indexDir })
    assert.equal(second.rebuilt, false, 'unchanged corpus → cached index reused')

    appendFileSync(fixture.agtAMainFile, `${JSON.stringify({ type: 'user/message', seq: 99, data: { content: 'new tail' } })}\n`)
    const now = new Date()
    utimesSync(fixture.agtAMainFile, now, now)
    const third = ensureFreshSessionIndex({ homesRoot: fixture.paths.homesRoot, indexDir })
    assert.equal(third.rebuilt, true, 'size/mtime drift → rebuild')
    const lookups = indexLookups(third.entries)
    assert.ok(lookups.all().length >= third.entries.length)
  } finally { destroyFixtureRoot(fixture) }
})

test('extractJournalCoordinates: partial scan flag and dedupe', async () => {
  const fixture = buildFixtureRoot()
  try {
    const extracted = extractJournalCoordinates(fixture.agtAMainFile, { maxScanBytes: 64 })
    assert.equal(extracted.partialScan, true, 'bounded scan reported honestly')
    const full = extractJournalCoordinates(fixture.agtAMainFile)
    assert.equal(full.partialScan, false)
    assert.ok(full.coordinates.workflowInstanceIds.includes(WF_ID))
    assert.equal(full.coordinates.messageIds.filter((id) => id === MESSAGE_ID).length, 1, 'unique-sorted ids')
    assert.equal(full.coordinates.hasInterAgent, true)
  } finally { destroyFixtureRoot(fixture) }
})
