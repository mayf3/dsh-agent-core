#!/usr/bin/env node
// Isolated real-candidate boot/readback. Never opens a production writer.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { checkCandidateCopies } from './candidate-oracle.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const json = (file, value) => writeFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: 'wx' })
const metadata = stat => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid']
  .map(key => String(stat[key])).join(':')

function snapshot(file) {
  const stat = lstatSync(file, { bigint: true })
  assert(stat.isFile() && !stat.isSymbolicLink(), 'input is not a regular file')
  const bytes = readFileSync(file)
  assert(metadata(stat) === metadata(lstatSync(file, { bigint: true })), 'input changed during capture')
  return { bytes, sha256: sha(bytes), metadata: metadata(stat) }
}

// Opaque authority identities, enums, timestamps, hashes and correlations stay
// intact. Natural-language/transport payload is never needed by a reader gate.
function sanitized(value, key = '') {
  if (Array.isArray(value)) return value.map(item => sanitized(item, key))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, sanitized(entry, name)]))
  }
  if (typeof value === 'string' && (/^(?:message|text|prompt|answer|name|description|output|lastError|to|email)$/i.test(key)
    || /(?:token|secret|password|credential|authorization|cookie|api.?key)$/i.test(key))) {
    return '[redacted]'
  }
  return value
}

function prepareRuntime(directory, recovery, jobs) {
  const home = join(directory, 'home'), root = join(home, 'runtime')
  for (const path of [home, root, join(home, '.dsh'), join(home, 'tmp'), join(root, 'control'),
    join(root, 'scheduler'), join(root, 'control/scheduler-watchdog')]) mkdirSync(path, { mode: 0o700 })
  json(join(root, 'control/turn-recovery-v3.json'), recovery)
  json(join(directory, 'admission-probe.json'), recovery)
  json(join(directory, 'jobs-copy.json'), jobs)
  const ids = new Set(recovery.records.map(record => record.agentId))
  let unrelated = 'agt_window_unrelated'
  while (ids.has(unrelated)) unrelated += '_new'
  ids.add(unrelated)
  json(join(root, 'agents.json'), { version: 1, defaultAgentId: unrelated,
    agents: [...ids].map(id => ({ id, name: 'isolated candidate agent', disabled: false })) })
  // Scheduler startup uses an intentionally empty document. The real jobs
  // copy is validated separately; no historical job is ever admitted.
  json(join(root, 'scheduler/jobs.json'), { version: 3, jobs: [], occurrences: [], fences: {} })
  json(join(root, 'scheduler/routing.json'), { version: 1,
    canonicalOpsTarget: { channel: 'feishu', to: 'isolated-no-send' }, ownerTargets: {}, jobFailureTargets: {} })
  json(join(root, 'control/scheduler-watchdog/incidents.json'), { version: 1, incidents: {}, outbox: {} })
  json(join(root, 'credentials.json'), { version: 1, credentials: {} })
  writeFileSync(join(root, 'scheduler/runs.jsonl'), '', { flag: 'wx', mode: 0o600 })
  return { home, root, unrelated }
}

async function runChild(node, args, options) {
  return new Promise(resolveResult => {
    const child = spawn(node, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', timedOut = false, launchError = null
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    child.on('error', error => { launchError = error.message })
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, 45_000)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolveResult({ pid: child.pid ?? null, code, signal, stdout, stderr, timedOut, launchError,
        closeObserved: true })
    })
  })
}

async function verify(options, mode) {
  const { candidateRoot, turnRecoveryStore, jobsStore, receiptDir } = options ?? {}
  const report = { kind: mode === 'boot' ? 'ISOLATED_REAL_CANDIDATE_STATE_BOOT' : 'READ_ONLY_ROLLBACK_COMPATIBILITY',
    status: 'UNKNOWN', checks: {}, businessOutcome: 'UNKNOWN', productionWrites: 0,
    businessSnapshotRestoreAllowed: false, rollbackAllowed: false }
  let inputs = [], outputCreated = false
  try {
    assert([candidateRoot, turnRecoveryStore, jobsStore, receiptDir].every(path => typeof path === 'string'
      && isAbsolute(path)), 'absolute candidate, input and receipt paths required')
    assert(![turnRecoveryStore, jobsStore].some(path => resolve(path).startsWith(`${resolve(receiptDir)}/`)),
      'receipt directory must not contain source state')
    mkdirSync(receiptDir, { mode: 0o700 })
    outputCreated = true
    const directory = realpathSync(receiptDir)
    inputs = [turnRecoveryStore, jobsStore].map(path => ({ path, ...snapshot(path) }))
    const recovery = sanitized(JSON.parse(inputs[0].bytes))
    const jobs = sanitized(JSON.parse(inputs[1].bytes))
    assert(Array.isArray(recovery.records), 'recovery records unavailable')
    const fixture = prepareRuntime(directory, recovery, jobs)
    const app = existsSync(join(candidateRoot, 'app/packages')) ? join(candidateRoot, 'app') : candidateRoot
    const candidateNode = join(candidateRoot, 'node-runtime/bin/node')
    assert(existsSync(candidateNode), 'candidate Node runtime missing; invoking Node is not a candidate substitute')
    const node = candidateNode
    report.nodeSelection = 'candidate-node-runtime'
    report.nodePath = realpathSync(node)
    report.nodeSha256 = snapshot(report.nodePath).sha256
    const env = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LC_ALL: 'C', LANG: 'C',
      HOME: fixture.home, DSH_HOME: join(fixture.home, '.dsh'), TMPDIR: join(fixture.home, 'tmp'),
      DSH_HARNESS_ROOT: join(candidateRoot, 'harness'), PRODUCTION_RUNTIME_ROOT: fixture.root,
      DSH_MEMORY_WORKSPACE_ROOT: join(fixture.root, 'workspaces'),
      AGENT_CORE_DEPLOYED_SHA: '0000000000000000000000000000000000000000',
      AGENT_CORE_CREDENTIALS_FILE: join(fixture.root, 'credentials.json'),
      BROKER_AUTH_ORIGIN: 'http://127.0.0.1:1', AGENT_DIRECTORY_AUTH_JWKS_URL: 'http://127.0.0.1:1/jwks',
      PRODUCT_API_ENABLED: '1', NOTIFICATION_INGRESS_ENABLED: '1',
      SCHEDULER_ROUTING_MANIFEST: join(fixture.root, 'scheduler/routing.json'),
      SCHEDULER_ROUTING_OWNER_UID: String(process.getuid()), SCHEDULER_ROUTING_READER_GID: String(process.getgid()),
      SCHEDULER_INCIDENT_OWNER_UID: String(process.getuid()), SCHEDULER_INCIDENT_OWNER_GID: String(process.getgid()),
      AGENT_CORE_FENCE_AUTO_RECONCILE: 'off' }
    const copiedFiles = [join(fixture.root, 'control/turn-recovery-v3.json'), join(directory, 'admission-probe.json'),
      join(directory, 'jobs-copy.json')]
    const copiedBytes = copiedFiles.map(path => snapshot(path).bytes)
    json(join(directory, 'child-config.json'), { app: realpathSync(app), directory, ...fixture, mode })
    const child = await runChild(node, [join(dirname(fileURLToPath(import.meta.url)), 'candidate-child.mjs'),
      join(directory, 'child-config.json')], { env, cwd: directory })
    writeFileSync(join(directory, 'child.stdout.private.log'), child.stdout, { mode: 0o600, flag: 'wx' })
    writeFileSync(join(directory, 'child.stderr.private.log'), child.stderr, { mode: 0o600, flag: 'wx' })
    report.child = { ...child, stdout: undefined, stderr: undefined,
      stdoutSha256: sha(child.stdout), stderrSha256: sha(child.stderr) }
    if (existsSync(join(directory, 'child-result.json'))) Object.assign(report,
      JSON.parse(readFileSync(join(directory, 'child-result.json'), 'utf8')))
    report.parentPreservation = checkCandidateCopies(copiedBytes,
      copiedFiles.map(path => snapshot(path).bytes), mode === 'boot')
    report.checks.candidateUnchanged = report.parentPreservation.ok
    report.checks.noOverwrite = report.checks.candidateUnchanged
    report.checks.cleanShutdown = child.closeObserved && child.code === 0 && child.signal === null && !child.timedOut
    assert(report.checks.cleanShutdown, child.launchError ?? 'candidate startup/readback/shutdown failed; see private child logs')
    assert(report.checks.candidateUnchanged, report.parentPreservation.error ?? 'candidate overwrote copied authority before child exit')
    assert(report.ok === true, 'candidate evidence checks failed')
  } catch (error) {
    report.error ??= error.message
  } finally {
    try {
      report.checks.sourceUnchanged = inputs.length === 2 && inputs.every(input => {
        const after = snapshot(input.path)
        return after.sha256 === input.sha256 && after.metadata === input.metadata
      })
    } catch { report.checks.sourceUnchanged = false }
    report.inputs = inputs.map(({ path, sha256, metadata: entryMetadata }) => ({ path, sha256, metadata: entryMetadata }))
    report.ok = report.ok === true && !report.error && report.checks.sourceUnchanged === true
    report.status = report.ok ? 'PASS_ISOLATED' : 'STOPPED_ON_FAILURE'
    report.rollbackAllowed = mode === 'rollback' && report.ok
    report.finishedAt = new Date().toISOString()
    if (outputCreated) json(join(receiptDir, 'candidate-state-receipt.json'), report)
  }
  return { report, exitCode: report.ok ? 0 : 5 }
}

export const verifyCandidateState = options => verify(options, 'boot')
export const verifyRollbackCompatibility = options => verify(options, 'rollback')

async function main() {
  const { values } = parseArgs({ options: { 'candidate-root': { type: 'string' },
    'turn-recovery-store': { type: 'string' }, 'jobs-store': { type: 'string' },
    'receipt-dir': { type: 'string' }, 'rollback-check': { type: 'boolean' } } })
  const invoke = values['rollback-check'] ? verifyRollbackCompatibility : verifyCandidateState
  const result = await invoke({ candidateRoot: values['candidate-root'], turnRecoveryStore: values['turn-recovery-store'],
    jobsStore: values['jobs-store'], receiptDir: values['receipt-dir'] })
  console.log(JSON.stringify(result.report))
  process.exitCode = result.exitCode
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 5 })
}
