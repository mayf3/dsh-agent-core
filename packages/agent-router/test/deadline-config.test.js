/**
 * Deterministic unit tests for the four-field deadline configuration model
 * (CLAUSE-PROC-DEADLINE-CONFIG) — packages/agent-router/src/deadline-config.js.
 *
 * Covered (V2 §10.2 items 26 + ACC-PROC-001/012/014 config aspects):
 *   - four independent fields with code defaults;
 *   - global deployment env names override defaults;
 *   - legacy compatibility: DSH_AGENT_TURN_TIMEOUT -> turnTimeoutMs (incl.
 *     the production DSH_AGENT_TURN_TIMEOUT=900000 mitigation) and
 *     DSH_AGENT_DELIVER_TIMEOUT -> promptReceiptTimeoutMs, ONLY when the
 *     new-style variable is absent — never a fifth timeout field;
 *   - precedence: per-Agent static override > global env > code default;
 *   - the per-Agent override file: version/unknown-field/duplicate-key/
 *     non-positive validation all fail loud; read at the process-start
 *     boundary only;
 *   - invalid env values fail loud before any spawn.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  AGENT_PROCESS_OVERRIDES_FILENAME,
  DEADLINE_DEFAULTS,
  DEADLINE_ENV_NAMES,
  DEADLINE_FIELDS,
  loadAgentProcessOverrides,
  resolveDeadlineConfig,
} from '../src/deadline-config.js'

const BASE_ENV = Object.freeze({
  DSH_AGENT_INITIALIZE_TIMEOUT_MS: undefined,
  DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: undefined,
  DSH_AGENT_TURN_TIMEOUT_MS: undefined,
  DSH_AGENT_SHUTDOWN_GRACE_MS: undefined,
  DSH_AGENT_TURN_TIMEOUT: undefined,
  DSH_AGENT_DELIVER_TIMEOUT: undefined,
  DSH_AGENT_PROCESS_OVERRIDES_FILE: undefined,
})

function envWith(overrides) {
  return { ...BASE_ENV, ...overrides }
}

test('four independent deadline fields with the frozen code defaults', () => {
  const { deadlines } = resolveDeadlineConfig(envWith({}))
  assert.deepEqual({ ...deadlines }, { ...DEADLINE_DEFAULTS })
  assert.deepEqual([...DEADLINE_FIELDS], [
    'initializeTimeoutMs',
    'promptReceiptTimeoutMs',
    'turnTimeoutMs',
    'shutdownGraceMs',
  ])
  assert.equal(DEADLINE_ENV_NAMES.turnTimeoutMs, 'DSH_AGENT_TURN_TIMEOUT_MS')
})

test('global deployment env names override the code defaults', () => {
  const { deadlines } = resolveDeadlineConfig(envWith({
    DSH_AGENT_INITIALIZE_TIMEOUT_MS: '45000',
    DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: '15000',
    DSH_AGENT_TURN_TIMEOUT_MS: '600000',
    DSH_AGENT_SHUTDOWN_GRACE_MS: '5000',
  }))
  assert.deepEqual({ ...deadlines }, {
    initializeTimeoutMs: 45000,
    promptReceiptTimeoutMs: 15000,
    turnTimeoutMs: 600000,
    shutdownGraceMs: 5000,
  })
})

test('legacy DSH_AGENT_TURN_TIMEOUT=900000 maps to turnTimeoutMs only (production mitigation preserved)', () => {
  const { deadlines } = resolveDeadlineConfig(envWith({ DSH_AGENT_TURN_TIMEOUT: '900000' }))
  assert.equal(deadlines.turnTimeoutMs, 900000)
  assert.equal(deadlines.promptReceiptTimeoutMs, DEADLINE_DEFAULTS.promptReceiptTimeoutMs, 'legacy turn timeout maps to exactly one field')
  const { deadlines: mixed } = resolveDeadlineConfig(envWith({
    DSH_AGENT_TURN_TIMEOUT: '900000',
    DSH_AGENT_TURN_TIMEOUT_MS: '120000',
  }))
  assert.equal(mixed.turnTimeoutMs, 120000, 'the new-style variable always wins over the legacy one')
})

test('legacy DSH_AGENT_DELIVER_TIMEOUT maps to promptReceiptTimeoutMs only', () => {
  const { deadlines } = resolveDeadlineConfig(envWith({ DSH_AGENT_DELIVER_TIMEOUT: '120000' }))
  assert.equal(deadlines.promptReceiptTimeoutMs, 120000)
  assert.equal(deadlines.turnTimeoutMs, DEADLINE_DEFAULTS.turnTimeoutMs)
})

test('per-Agent static override > global env > code default', () => {
  const config = resolveDeadlineConfig(envWith({ DSH_AGENT_TURN_TIMEOUT_MS: '600000' }), {
    overrides: {
      agt_x: { turnTimeoutMs: 1200000 },
      agt_partial: { shutdownGraceMs: 7000 },
    },
  })
  assert.equal(config.perAgent('agt_x').turnTimeoutMs, 1200000)
  assert.equal(config.perAgent('agt_x').initializeTimeoutMs, DEADLINE_DEFAULTS.initializeTimeoutMs)
  assert.equal(config.perAgent('agt_partial').shutdownGraceMs, 7000)
  assert.equal(config.perAgent('agt_partial').turnTimeoutMs, 600000, 'unset fields fall back to global env')
  assert.equal(config.perAgent('agt_other').turnTimeoutMs, 600000, 'unknown agents get the global config')
  assert.equal(config.deadlines.turnTimeoutMs, 600000, 'the global deadlines never see the per-Agent override')
})

test('invalid env values fail loud before any spawn', () => {
  assert.throws(() => resolveDeadlineConfig(envWith({ DSH_AGENT_TURN_TIMEOUT_MS: 'soon' })), /positive safe integer/)
  assert.throws(() => resolveDeadlineConfig(envWith({ DSH_AGENT_TURN_TIMEOUT_MS: '0' })), /positive safe integer/)
  assert.throws(() => resolveDeadlineConfig(envWith({ DSH_AGENT_SHUTDOWN_GRACE_MS: '-5' })), /positive safe integer/)
})

test('per-Agent override file: valid shape loads; unknown agent entries apply only to that agent', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dcfg-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, AGENT_PROCESS_OVERRIDES_FILENAME)
  await writeFile(file, JSON.stringify({
    version: 1,
    overrides: { agt_x: { initializeTimeoutMs: 12345 } },
  }))
  const { perAgent } = resolveDeadlineConfig(envWith({}), { overridesFile: file })
  assert.equal(perAgent('agt_x').initializeTimeoutMs, 12345)
  assert.equal(perAgent('agt_x').turnTimeoutMs, DEADLINE_DEFAULTS.turnTimeoutMs)
})

test('per-Agent override file: malformed content fails loud', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dcfg-invalid-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, AGENT_PROCESS_OVERRIDES_FILENAME)

  await writeFile(file, '{ not json')
  assert.throws(() => loadAgentProcessOverrides(file), /invalid JSON/)

  await writeFile(file, JSON.stringify({ version: 2, overrides: {} }))
  assert.throws(() => loadAgentProcessOverrides(file), /unsupported version/)

  await writeFile(file, JSON.stringify({ version: 1 }))
  assert.throws(() => loadAgentProcessOverrides(file), /missing the "overrides" object/)

  await writeFile(file, JSON.stringify({ version: 1, overrides: { agt_x: { timeoutMs: 5 } } }))
  assert.throws(() => loadAgentProcessOverrides(file), /unknown field/)

  await writeFile(file, JSON.stringify({ version: 1, overrides: { agt_x: { turnTimeoutMs: 0 } } }))
  assert.throws(() => resolveDeadlineConfig(envWith({}), { overridesFile: file }), /positive safe integer/)

  // Duplicate keys fail loud even though JSON.parse would silently keep the last.
  await writeFile(file, '{"version":1,"overrides":{"agt_x":{"turnTimeoutMs":1,"turnTimeoutMs":2}}}')
  assert.throws(() => loadAgentProcessOverrides(file), /duplicate key/)
})

test('absent override file is not an error; DSH_AGENT_PROCESS_OVERRIDES_FILE locates it', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dcfg-absent-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, AGENT_PROCESS_OVERRIDES_FILENAME)
  const { perAgent, overridesFile } = resolveDeadlineConfig(envWith({ DSH_AGENT_PROCESS_OVERRIDES_FILE: file }))
  assert.equal(overridesFile, file)
  assert.equal(perAgent('agt_anyone').turnTimeoutMs, DEADLINE_DEFAULTS.turnTimeoutMs)
})
