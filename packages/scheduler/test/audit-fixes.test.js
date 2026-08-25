import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (relative) => readFileSync(join(root, relative), 'utf8')

const CONTRACTS = Array.from({ length: 37 }, (_, index) => `C-${String(index + 1).padStart(3, '0')}`)
const ACCEPTANCE = Array.from({ length: 37 }, (_, index) => `ACC-${String(index + 1).padStart(3, '0')}`)
const FAULT_MATRIX = [
  'TIMEOUT_BEFORE_TURN_START',
  'TIMEOUT_DURING_ACTIVE_TURN',
  'ABORT_SENT_WITHOUT_TERMINATION',
  'UNKNOWN_FENCES_LATER_SAME_JOB_OCCURRENCE',
  'PROCESS_EXIT_WITHOUT_TURN_ATTRIBUTION',
  'LATE_SUCCESS_AFTER_TIMEOUT',
  'LATE_FAILURE_AFTER_TIMEOUT',
  'LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT',
  'CONCURRENT_DUE_TICKS_SAME_OCCURRENCE',
  'RESTART_AFTER_ADMITTED_BEFORE_ROUTER',
  'RESTART_AFTER_ROUTER_BEFORE_RECEIPT',
  'ORDINARY_FAILED_RETRY_NEW_OCCURRENCE',
  'OUTCOME_UNKNOWN_NO_RETRY',
  'FRESH_SESSION_PER_OCCURRENCE',
  'MIGRATION_NO_CATCH_UP',
  'STORE_UPGRADE_V1_TO_V2',
  'CORRUPT_OCCURRENCE_STORE_FAIL_LOUD',
  'CONCURRENT_CLI_DISABLE_DURING_ADMITTED_OCCURRENCE',
  'PROJECTION_REBUILD_FROM_OCCURRENCE_LEDGER',
  'OPERATOR_RECONCILE_RESOLVES_FENCE',
  'PAYLOAD_HASH_CONFLICT',
  'IDEMPOTENT_KEY_SAME_PAYLOAD_NO_SECOND_ENQUEUE',
  'FENCE_RELEASE_NO_BACKLOG_REPLAY',
]

const FAULT_TO_ACCEPTANCE = {
  TIMEOUT_BEFORE_TURN_START: ['ACC-001', 'ACC-012'],
  TIMEOUT_DURING_ACTIVE_TURN: ['ACC-001', 'ACC-012'],
  ABORT_SENT_WITHOUT_TERMINATION: ['ACC-010'],
  UNKNOWN_FENCES_LATER_SAME_JOB_OCCURRENCE: ['ACC-003'],
  PROCESS_EXIT_WITHOUT_TURN_ATTRIBUTION: ['ACC-007', 'ACC-033'],
  LATE_SUCCESS_AFTER_TIMEOUT: ['ACC-011'],
  LATE_FAILURE_AFTER_TIMEOUT: ['ACC-011'],
  LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT: ['ACC-011'],
  CONCURRENT_DUE_TICKS_SAME_OCCURRENCE: ['ACC-008', 'ACC-026'],
  RESTART_AFTER_ADMITTED_BEFORE_ROUTER: ['ACC-007'],
  RESTART_AFTER_ROUTER_BEFORE_RECEIPT: ['ACC-007'],
  ORDINARY_FAILED_RETRY_NEW_OCCURRENCE: ['ACC-009'],
  OUTCOME_UNKNOWN_NO_RETRY: ['ACC-002', 'ACC-009'],
  FRESH_SESSION_PER_OCCURRENCE: ['ACC-013', 'ACC-031'],
  MIGRATION_NO_CATCH_UP: ['ACC-014'],
  STORE_UPGRADE_V1_TO_V2: ['ACC-033'],
  CORRUPT_OCCURRENCE_STORE_FAIL_LOUD: ['ACC-021', 'ACC-022'],
  CONCURRENT_CLI_DISABLE_DURING_ADMITTED_OCCURRENCE: ['ACC-026', 'ACC-027'],
  PROJECTION_REBUILD_FROM_OCCURRENCE_LEDGER: ['ACC-028', 'ACC-030'],
  OPERATOR_RECONCILE_RESOLVES_FENCE: ['ACC-029'],
  PAYLOAD_HASH_CONFLICT: ['ACC-024'],
  IDEMPOTENT_KEY_SAME_PAYLOAD_NO_SECOND_ENQUEUE: ['ACC-008', 'ACC-023'],
  FENCE_RELEASE_NO_BACKLOG_REPLAY: ['ACC-003'],
}

test('ACC-020 accepted authority disposition remains intact', () => {
  const spec = read('docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md')
  const v1 = read('docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md')
  const d7 = read('docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md')
  const d5 = read('docs/decisions/SCHEDULER_V1.md')
  assert.match(spec, /status: accepted/)
  assert.match(spec, /supersedes: \[SCHEDULER_TIMEOUT_OUTCOME_V1\]/)
  assert.match(v1, /status: superseded/)
  assert.match(d7, /状态: accepted/)
  assert.match(d5, /superseded_by: D-007/)
})

test('ACC-032 CLI is control-only and exposes occurrence/fence reconciliation projection', () => {
  const cli = read('scripts/agentcore-cron.mjs')
  assert.doesNotMatch(cli, /new Scheduler\s*\(/)
  for (const field of ['occurrenceId', 'runId', 'outcome_unknown', 'fence', 'reconcile']) {
    assert.match(cli, new RegExp(field))
  }
})

test('ACC-036 all seven frozen implementation preconditions remain present', () => {
  const spec = read('docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md')
  assert.match(spec, /IMPLEMENTATION_PRECONDITIONS =/)
  for (const number of [1, 2, 3, 4, 5, 6, 7]) assert.match(spec, new RegExp(`\\n\\s*${number}_`))
})

test('ACC-037 import tooling remains dry-run by default and performs no deploy', () => {
  const importer = read('scripts/openclaw-job-import.mjs')
  assert.match(importer, /const write = args\.includes\('--write'\)/)
  assert.match(importer, /dry-run/)
  assert.doesNotMatch(importer, /deploy|ensureRunning|invokeAgent|\.tick\s*\(/)
})

test('37/37 contract and acceptance manifests are complete and sequential', () => {
  assert.equal(CONTRACTS.length, 37)
  assert.equal(new Set(CONTRACTS).size, 37)
  assert.equal(ACCEPTANCE.length, 37)
  assert.equal(new Set(ACCEPTANCE).size, 37)
  const spec = read('docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md')
  for (const id of CONTRACTS) assert.match(spec, new RegExp(`### ${id} —`))
  for (const id of ACCEPTANCE) assert.match(spec, new RegExp(`### ${id} —`))
})

test('23/23 fault matrix manifest is complete and mapped to acceptance', () => {
  assert.equal(FAULT_MATRIX.length, 23)
  assert.equal(new Set(FAULT_MATRIX).size, 23)
  for (const fault of FAULT_MATRIX) {
    assert.ok(FAULT_TO_ACCEPTANCE[fault]?.length > 0, `${fault} has acceptance mapping`)
    assert.ok(FAULT_TO_ACCEPTANCE[fault].every((id) => ACCEPTANCE.includes(id)))
  }
})

export { CONTRACTS, ACCEPTANCE, FAULT_MATRIX, FAULT_TO_ACCEPTANCE }
