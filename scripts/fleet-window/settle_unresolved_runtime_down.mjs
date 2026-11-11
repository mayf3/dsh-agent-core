#!/usr/bin/env node
// Termination-only recovery per AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, fsyncSync, lstatSync, mkdtempSync, openSync, readFileSync,
  renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const DEFAULT_STORE = '/Users/authsvc/.agent-core/control/turn-recovery-v3.json'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const requireProof = (condition, message) => { if (!condition) throw new Error(message) }

function snapshot(file) {
  const stat = lstatSync(file, { bigint: true })
  requireProof(stat.isFile() && (Number(stat.mode) & 0o022) === 0, 'unsafe evidence/store file')
  requireProof(process.getuid() === 0 || [0, process.getuid()].includes(Number(stat.uid)), 'untrusted evidence/store owner')
  const metadata = value => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid']
    .map(key => String(value[key])).join(':')
  const bytes = readFileSync(file)
  requireProof(metadata(stat) === metadata(lstatSync(file, { bigint: true })), 'input changed during read')
  return { bytes, sha256: digest(bytes), metadata: metadata(stat) }
}

function processRows(readPs) {
  const output = readPs()
  requireProof(typeof output === 'string' && output.trim() !== '', 'ps evidence unavailable')
  return output.trim().split('\n').map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
    requireProof(match !== null, 'unparseable ps evidence')
    return { pid: Number(match[1]), uid: Number(match[2]), command: match[3] }
  })
}

function runtimeDown(rows, proof) {
  const workers = rows.filter(row => row.pid !== process.pid
    && (/\b(?:codex|dsh-agent)\b/i.test(row.command)
      || row.command.includes('/usr/local/libexec/agent-core')))
  requireProof(workers.length === 0, `worker ps gate refused: ${workers.length} live worker-like processes`)
  const pids = new Set(rows.map(row => row.pid))
  requireProof(proof.oldProcesses.every(row => !pids.has(row.pid)), 'stage_05 PID still present (reuse is UNKNOWN)')
}

function stage05Proof(directory, source, epoch) {
  const files = ['old-exit.json', 'post-bootout-census.json'].map(name => join(directory, name))
  const snapshots = files.map(snapshot)
  const [proof, census] = snapshots.map(row => JSON.parse(row.bytes))
  const at = Date.parse(proof.at)
  const censusAt = Date.parse(census.at)
  requireProof(Number.isFinite(at) && at <= Date.now() && Date.now() - at <= 300_000,
    'stage_05 proof missing/stale')
  requireProof(Number.isFinite(censusAt) && censusAt <= at && at - censusAt <= 300_000,
    'stage_05 census timestamp mismatch')
  requireProof(Array.isArray(proof.remaining) && proof.remaining.length === 0
    && Array.isArray(proof.oldProcesses) && proof.oldProcesses.length > 0
    && proof.oldProcesses.every(row => Number.isSafeInteger(row.pid) && row.pid > 0),
  'stage_05 process exit proof incomplete')
  requireProof(Number.isInteger(proof.supervisor?.rc) && proof.supervisor.rc !== 0
    && /could not find (?:specified )?service|service not found/i.test(proof.supervisor.output ?? ''),
  'stage_05 supervisor absence unproven')
  requireProof(JSON.stringify(proof.portsAbsent) === '[8788,8790]'
    && Array.isArray(census.classification?.unsafe) && census.classification.unsafe.length === 0,
  'stage_05 ports/classified isolation unproven')
  requireProof(census.readOnly === true && census.census?.epoch === epoch
    && census.storeHashes?.[0]?.sha256 === source.sha256, 'stage_05 store hash/epoch mismatch')
  return { proof, at, files, snapshots }
}

function hasExactExit(record, stage, epoch) {
  return record.runtimeEpoch === epoch && record.updatedAt <= stage.at
    && Number.isSafeInteger(record.exitObservedAt)
    && record.exitObservedAt >= record.createdAt && record.exitObservedAt <= stage.at
    && record.outcome === null && record.outcomeEvidence === null && record.lateOutcome === null
    && record.settlementResult === null
    && !(record.audit ?? []).some(entry => entry.kind === 'conflict_ignored')
    && [null, 'child_real_exit'].includes(record.terminationEvidence)
    && record.attemptedActions.some(action => action.action === 'exit_wait'
      && action.result === 'succeeded' && action.reasonCode === 'child_real_exit'
      && action.observedAtWallMs === record.exitObservedAt)
}

function syncFile(file) {
  const fd = openSync(file, 'r')
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

// The official writer creates the candidate. Retain untouched raw rows and
// all old answer digests before atomic publication; the stock serializer
// normalizes restored rows and cannot reconstruct historical answer text.
function publishCandidate(file, store, original, selected, authority, beforePublish) {
  const temporary = mkdtempSync(join(dirname(file), '.settle-candidate-'))
  try {
    const candidate = join(temporary, 'turn-recovery.json')
    authority.writeDurableRecoveryStore(candidate, store)
    const encoded = JSON.parse(readFileSync(candidate, 'utf8'))
    const byHandle = new Map(encoded.records.map(row => [row.handle, row]))
    const document = { ...original, ...encoded, records: original.records.map(row => selected.has(row.handle)
      ? { ...byHandle.get(row.handle), finalAssistantOutputEvidence: row.finalAssistantOutputEvidence } : row) }
    writeFileSync(candidate, `${JSON.stringify(document)}\n`, { mode: 0o600 })
    authority.readDurableRecoveryStore(candidate)
    syncFile(candidate)
    beforePublish()
    renameSync(candidate, file)
    syncFile(dirname(file))
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

export async function settleRuntimeDown({ sourceRoot, storeFile = DEFAULT_STORE,
  stage05ReceiptDir, readPs = () => execFileSync('/bin/ps', ['-axo', 'pid=,uid=,command='],
    { encoding: 'utf8', timeout: 10_000 }) } = {}) {
  const report = { settled: 0, skipped: 0, unproven: 0, remaining: null,
    writes: 0, businessOutcome: 'UNKNOWN', unprovenHandles: [], carryForward: null }
  try {
    requireProof([sourceRoot, storeFile, stage05ReceiptDir].every(value => typeof value === 'string'
      && isAbsolute(value)), 'absolute --source-root, --store and --stage-05-receipt-dir required')
    const source = snapshot(storeFile)
    const document = JSON.parse(source.bytes)
    const stage = stage05Proof(stage05ReceiptDir, source, document.runtimeEpoch)
    runtimeDown(processRows(readPs), stage.proof)
    const authority = await import(pathToFileURL(join(sourceRoot,
      'packages/agent-router/src/reconciliation/durable-file.js')).href)
    const { TurnReconciliationStore } = await import(pathToFileURL(join(sourceRoot,
      'packages/agent-router/src/reconciliation/store.js')).href)
    const decoded = authority.readDurableRecoveryStore(storeFile)
    requireProof(decoded !== null, 'recovery store unavailable')
    // Never pass persistenceFile: that constructor runs restart recovery.
    const store = new TurnReconciliationStore({ runtimeEpoch: document.runtimeEpoch })
    for (const key of ['runtimeEpochs', 'records', 'issuance', 'correlationIndex', 'discriminatorSeq']) {
      store[key] = decoded[key]
    }
    store.recountCapacity()
    const selected = new Set()
    for (const [handle, record] of store.records) {
      if (record.state === 'settled' || record.initialOutcome !== 'outcome_unknown') {
        report.skipped++
        continue
      }
      // Global ps absence alone never proves the identity of an old turn.
      if (!hasExactExit(record, stage, document.runtimeEpoch)) {
        report.unproven++
        report.unprovenHandles.push(handle)
        continue
      }
      const result = store.settleLate(handle, { lateOutcome: 'terminated_without_outcome',
        terminationEvidence: 'child_real_exit' })
      requireProof(result.won === true, 'official settlement refused; no publication')
      selected.add(handle)
    }
    report.remaining = [...store.records.values()].filter(row => row.state !== 'settled').length
    if (selected.size > 0) {
      publishCandidate(storeFile, store, document, selected, authority, () => {
        requireProof(Date.now() - stage.at <= 300_000, 'stage_05 proof expired before write')
        runtimeDown(processRows(readPs), stage.proof)
        const current = snapshot(storeFile)
        requireProof(current.sha256 === source.sha256 && current.metadata === source.metadata, 'store changed before write')
        stage.files.forEach((file, index) => {
          const currentProof = snapshot(file)
          requireProof(currentProof.sha256 === stage.snapshots[index].sha256
            && currentProof.metadata === stage.snapshots[index].metadata, 'stage_05 proof changed before write')
        })
        // A failure after this point may follow rename; never claim zero writes.
        report.writes = null
      })
      report.writes = 1
      const readback = authority.readDurableRecoveryStore(storeFile)
      for (const handle of selected) {
        requireProof(readback.records.get(handle)?.lateOutcome === 'terminated_without_outcome', 'settlement readback mismatch')
      }
      report.settled = selected.size
    }
    report.carryForward = { status: 'RETAINED_WITHOUT_REPLAY', installationBlocking: false,
      handles: [...store.records.values()].filter(row => row.state !== 'settled').map(row => row.handle),
      beforeSha256: source.sha256, afterSha256: snapshot(storeFile).sha256,
      businessOutcome: 'UNKNOWN' }
    return { report, exitCode: 0 }
  } catch (error) {
    return { report: { ...report, status: 'UNKNOWN', error: error.message }, exitCode: 5 }
  }
}

async function main() {
  try {
    const { values } = parseArgs({ options: { 'source-root': { type: 'string' },
      store: { type: 'string' }, 'stage-05-receipt-dir': { type: 'string' }, help: { type: 'boolean', short: 'h' } } })
    if (values.help) {
      console.log('Usage: settle_unresolved_runtime_down.mjs --source-root /source --stage-05-receipt-dir /receipts [--store /fixture.json]')
      console.log('No per-record exact proof: retain UNKNOWN without blocking installation. Invalid isolation, unreadable state or failed settlement: exit 5. Production execution requires a separate window mandate.')
      return
    }
    const { report, exitCode } = await settleRuntimeDown({ sourceRoot: values['source-root'],
      storeFile: values.store, stage05ReceiptDir: values['stage-05-receipt-dir'] })
    console.log(JSON.stringify(report))
    process.exitCode = exitCode
  } catch (error) {
    console.log(JSON.stringify({ status: 'UNKNOWN', error: error.message, writes: 0 }))
    process.exitCode = 5
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
