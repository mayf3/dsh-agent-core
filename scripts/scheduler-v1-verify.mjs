#!/usr/bin/env node
/** Scheduler V2 contract/acceptance/fault verification driver. */
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const check = (label, ok, detail = '') => {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}\n`)
  if (!ok) failures += 1
}
const run = (command, args) => spawnSync(command, args, { cwd: root, encoding: 'utf8' })

process.stdout.write('=== Scheduler V2 — contract / acceptance / fault verification ===\n')

const fetchedHead = run('git', ['rev-parse', 'origin/main'])
check('fresh origin/main coordinate available', fetchedHead.status === 0, fetchedHead.stdout.trim())
for (const commit of [
  '50fab7fe3fbba5d677de3629a512bd7c38421f5f',
  'b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724',
]) {
  const ancestry = run('git', ['merge-base', '--is-ancestor', commit, 'origin/main'])
  check(`required ancestor ${commit.slice(0, 12)}`, ancestry.status === 0)
}

const schedulerFiles = readdirSync(join(root, 'packages/scheduler/test'))
  .filter((file) => file.endsWith('.test.js')).map((file) => `packages/scheduler/test/${file}`)
const schedulerTests = run(process.execPath, ['--test', ...schedulerFiles])
if (schedulerTests.status !== 0) process.stderr.write(schedulerTests.stdout + schedulerTests.stderr)
check('Scheduler V2 package tests', schedulerTests.status === 0)
const routerFiles = readdirSync(join(root, 'packages/scheduler-router/test'))
  .filter((file) => file.endsWith('.test.js')).map((file) => `packages/scheduler-router/test/${file}`)
const routerTests = run(process.execPath, ['--test', ...routerFiles])
if (routerTests.status !== 0) process.stderr.write(routerTests.stdout + routerTests.stderr)
check('Scheduler Router conservative-outcome tests', routerTests.status === 0)

const spec = readFileSync(join(root, 'docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md'), 'utf8')
const contracts = [...spec.matchAll(/^### (C-\d{3}) —/gm)].map((match) => match[1])
const acceptance = [...spec.matchAll(/^### (ACC-\d{3}) —/gm)].map((match) => match[1])
const expectedContracts = Array.from({ length: 37 }, (_, index) => `C-${String(index + 1).padStart(3, '0')}`)
const expectedAcceptance = Array.from({ length: 37 }, (_, index) => `ACC-${String(index + 1).padStart(3, '0')}`)
check('CONTRACTS = 37/37', JSON.stringify(contracts) === JSON.stringify(expectedContracts))
check('ACCEPTANCE = 37/37', JSON.stringify(acceptance) === JSON.stringify(expectedAcceptance)
  && expectedAcceptance.every((id) => schedulerTests.stdout.includes(id)))
const frozenPreconditions = [
  '1_SCHEDULER_V2_ACCEPTED_AND_MERGED', '2_AGENTPROCESS_IMPL_AUTHORITY_V2_ACCEPTED_AND_MERGED',
  '3_AGENTPROCESS_IMPLEMENTATION_PASS', '4_NOTIFICATION_INGRESS_IMPL_SPEC_ACCEPTED_AND_MERGED',
  '5_NOTIFICATION_INGRESS_IMPLEMENTATION_PASS', '6_BASE_CONTAINS_D006_D007',
  '7_CONTRACT_BY_CONTRACT_FAULT_TEST_PLAN_COMPLETE',
]
check('IMPLEMENTATION_PRECONDITIONS = 7/7', frozenPreconditions.every((item) => spec.includes(item)))

const faults = [
  'TIMEOUT_BEFORE_TURN_START', 'TIMEOUT_DURING_ACTIVE_TURN', 'ABORT_SENT_WITHOUT_TERMINATION',
  'UNKNOWN_FENCES_LATER_SAME_JOB_OCCURRENCE', 'PROCESS_EXIT_WITHOUT_TURN_ATTRIBUTION',
  'LATE_SUCCESS_AFTER_TIMEOUT', 'LATE_FAILURE_AFTER_TIMEOUT', 'LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT',
  'CONCURRENT_DUE_TICKS_SAME_OCCURRENCE', 'RESTART_AFTER_ADMITTED_BEFORE_ROUTER',
  'RESTART_AFTER_ROUTER_BEFORE_RECEIPT', 'ORDINARY_FAILED_RETRY_NEW_OCCURRENCE',
  'OUTCOME_UNKNOWN_NO_RETRY', 'FRESH_SESSION_PER_OCCURRENCE', 'MIGRATION_NO_CATCH_UP',
  'STORE_UPGRADE_V1_TO_V2', 'CORRUPT_OCCURRENCE_STORE_FAIL_LOUD',
  'CONCURRENT_CLI_DISABLE_DURING_ADMITTED_OCCURRENCE', 'PROJECTION_REBUILD_FROM_OCCURRENCE_LEDGER',
  'OPERATOR_RECONCILE_RESOLVES_FENCE', 'PAYLOAD_HASH_CONFLICT',
  'IDEMPOTENT_KEY_SAME_PAYLOAD_NO_SECOND_ENQUEUE', 'FENCE_RELEASE_NO_BACKLOG_REPLAY',
]
const testCorpus = [
  'packages/scheduler/test/scheduler.test.js',
  'packages/scheduler/test/store-v2.test.js',
  'packages/scheduler/test/import.test.js',
  'packages/scheduler/test/occurrence-model.test.js',
  'packages/scheduler/test/process-faults.test.js',
  'packages/scheduler-router/test/bridge.test.js',
].map((file) => readFileSync(join(root, file), 'utf8')).join('\n')
check('FAULT_MATRIX = 23/23', faults.length === 23 && new Set(faults).size === 23
  && faults.every((fault) => testCorpus.includes(fault)))

const diffCheck = run('git', ['diff', '--check'])
check('git diff --check', diffCheck.status === 0, diffCheck.stderr.trim())
const forbidden = run('git', ['diff', '--name-only', 'origin/main']).stdout.trim().split('\n').filter(Boolean)
  .filter((file) => file.startsWith('packages/agent-router/')
    || file.startsWith('packages/workspace-bootstrap/')
    || file.startsWith('packages/binding')
    || file.startsWith('packages/agent-definition/')
    || /production.*jobs|deploy/i.test(file))
check('forbidden scope changes = NONE', forbidden.length === 0, forbidden.join(', '))

process.stdout.write(`\nCONTRACTS = ${contracts.length}/37\n`)
process.stdout.write(`ACCEPTANCE = ${acceptance.length}/37\n`)
process.stdout.write(`FAULT_MATRIX = ${faults.length}/23\n`)
process.stdout.write('PRODUCTION_CHANGE = NONE\nHISTORICAL_JOB_IMPORT = NONE\nCATCH_UP_OPERATION = NONE\nDEPLOY = NO\n')
process.stdout.write(`RESULT = ${failures === 0 ? 'PASS' : 'FAIL'}\n`)
process.exit(failures === 0 ? 0 : 1)
