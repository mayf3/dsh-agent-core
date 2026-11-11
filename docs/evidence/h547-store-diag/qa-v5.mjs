/** #547 v5: real captured bytes stay immutable; only fresh scratch copies open. */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const BASELINE = '95a8e1cb512fc99dc018209d837250dd51b4d08f'
const BASE = 'turn-recovery-v3.json'
const evidence = dirname(fileURLToPath(import.meta.url))
const privateRoot = realpathSync(join(evidence, 'private'))
const [readerArg, captureArg, scratchArg] = process.argv.slice(2)
const report = { schema_version: 5, status: 'STARTED', phase: 'harness_preflight', baseline: BASELINE,
  started_at_utc: new Date().toISOString(), node: process.version, checks: [], targets: [],
  boundaries: { production_access: false, production_write: false, network_requests: false,
    explicit_epoch_override: false, epoch_trimming: false, original_snapshot_constructor: false } }
const hash = data => createHash('sha256').update(data).digest('hex')
const hashFile = file => hash(readFileSync(file))
const equal = (a, b) => isDeepStrictEqual(a, b)
function check(name, actual, expected = true) {
  const pass = equal(actual, expected)
  report.checks.push({ name, actual, expected, pass })
  if (!pass) throw new Error(`UNEXPECTED_PREDICATE:${name}`)
}
function inside(path, parent) { return path.startsWith(parent + sep) }
function manifest(root) {
  return readdirSync(root).sort().map(name => {
    const file = join(root, name)
    if (!lstatSync(file).isFile()) throw new Error('INPUT_NOT_REGULAR_FILE')
    return { name, bytes: lstatSync(file).size, sha256: hashFile(file) }
  })
}
// Parse exact raw object byte spans without reserializing production records.
function recordSpans(buffer) {
  const text = buffer.toString('utf8')
  const arrayKey = /"records"\s*:\s*\[/.exec(text)
  if (!arrayKey) throw new Error('RECORD_ARRAY_NOT_FOUND')
  let position = arrayKey.index + arrayKey[0].length
  const result = []
  for (;;) {
    while (/\s|,/.test(text[position] ?? '') && position < text.length) position++
    if (text[position] === ']') break
    if (text[position] !== '{') throw new Error('RECORD_SPAN_INVALID')
    const start = position
    let depth = 0, inString = false, escape = false
    for (; position < text.length; position++) {
      const char = text[position]
      if (inString) {
        if (escape) escape = false
        else if (char === '\\') escape = true
        else if (char === '"') inString = false
      } else if (char === '"') inString = true
      else if (char === '{' || char === '[') depth++
      else if (char === '}' || char === ']') {
        depth--
        if (depth === 0) { position++; break }
      }
    }
    const end = position
    const value = text.slice(start, end)
    result.push({ value: JSON.parse(value), byte_offset: Buffer.byteLength(text.slice(0, start)),
      byte_length: Buffer.byteLength(value), raw_record_sha256: hash(Buffer.from(value)) })
  }
  return result
}
function summary(record) {
  const fields = ['agentId', 'runtimeEpoch', 'processGeneration', 'queryState', 'state', 'recoveryState',
    'initialOutcome', 'outcome', 'lateOutcome', 'fenceState', 'settlementResult',
    'terminationEvidence', 'exitObservedAt', 'failureReason', 'nextSafeAction']
  return Object.fromEntries(fields.filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]))
}
function expectError(name, operation, code, type = null) {
  let actual = null
  try { operation() } catch (error) { actual = type ? error.name : error.code }
  check(name, actual, type ?? code)
}
let capture, scratch, snapshotBefore
try {
  check('three_arguments', process.argv.length, 5)
  const reader = realpathSync(readerArg)
  capture = realpathSync(captureArg)
  scratch = resolve(scratchArg)
  check('reader_is_private', inside(reader, privateRoot))
  check('capture_is_private', inside(capture, privateRoot))
  check('scratch_under_private_v5', inside(scratch, join(privateRoot, 'v5')))
  check('scratch_distinct_from_capture_and_reader', !inside(scratch, capture) && !inside(capture, scratch)
    && !inside(scratch, reader) && !inside(reader, scratch))
  const scratchExists = existsSync(scratch)
  report.scratch_precreated = scratchExists
  if (scratchExists) {
    check('scratch_is_plain_directory', lstatSync(scratch).isDirectory() && !lstatSync(scratch).isSymbolicLink())
    check('scratch_real_path_matches', realpathSync(scratch), scratch)
    check('scratch_is_empty', readdirSync(scratch).length, 0)
  }
  report.paths = { reader: relative(evidence, reader), capture: relative(evidence, capture), scratch: relative(evidence, scratch) }
  report.phase = 'reader_imports'
  const module = async path => import(pathToFileURL(join(reader, path)).href)
  const { TurnReconciliationStore } = await module('packages/agent-router/src/reconciliation-store.js')
  const { readDurableRecoveryStore, readAbandonmentDeclarationRegistry,
    abandonmentDeclarationRegistryPathFor } = await module('packages/agent-router/src/reconciliation/durable-file.js')
  const { isLegacyUnprovenFenceClear } = await module('packages/agent-router/src/reconciliation/state-machine.js')
  const { createRecoveryAdmission } = await module('packages/agent-router/src/reconciliation/admission.js')
  const { promptFenceError } = await module('packages/agent-router/src/process/state-machine.js')
  const { createProcessRegistry } = await module('packages/agent-router/src/process-registry.js')
  const { RECONCILIATION_CAPS } = await module('packages/agent-router/src/reconciliation/capacity.js')
  report.reader_sources = ['reconciliation/store.js', 'reconciliation/durable-file.js', 'reconciliation/state-machine.js',
    'reconciliation/admin-abandonment.js', 'reconciliation/query.js', 'reconciliation/admission.js',
    'reconciliation/capacity.js', 'process/state-machine.js', 'process-registry.js'].map(path => ({
      path: 'packages/agent-router/src/' + path, sha256: hashFile(join(reader, 'packages/agent-router/src', path)),
    }))
  report.phase = 'capture_read'
  snapshotBefore = manifest(capture)
  report.capture_before = snapshotBefore
  check('capture_active_exists', snapshotBefore.some(entry => entry.name === BASE))
  const originalBytes = readFileSync(join(capture, BASE))
  const raw = JSON.parse(originalBytes)
  const spans = recordSpans(originalBytes)
  check('all_raw_record_spans_parsed', spans.length, raw.records.length)
  check('spans_equal_raw_records', equal(spans.map(entry => entry.value), raw.records))
  report.raw = { active_sha256: hash(originalBytes), records: raw.records.length, issuance: raw.issuance.length,
    correlation_index: raw.correlationIndex.length, runtimeEpoch: raw.runtimeEpoch,
    runtimeEpochs: [...raw.runtimeEpochs], epoch_cap: RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS }
  report.phase = 'product_pure_reader'
  const decoded = readDurableRecoveryStore(join(capture, BASE)) // pure reader only
  check('pure_reader_full_count', decoded.records.size, raw.records.length)
  const registry = readAbandonmentDeclarationRegistry(abandonmentDeclarationRegistryPathFor(join(capture, BASE)))
  const faultFile = join(capture, BASE + '.faults.json')
  const faults = existsSync(faultFile) ? JSON.parse(readFileSync(faultFile)) : null
  report.sidecars = { registry_present: registry !== null, registry_entries: registry?.length ?? 0,
    faults_present: faults !== null, fault_entries: faults === null ? 0 : Object.keys(faults).length,
    faults_consumer_in_pinned_store: /faultPersistenceFile|recoveryFaults/.test(readFileSync(join(reader,
      'packages/agent-router/src/reconciliation/store.js'), 'utf8')) }
  report.phase = 'scratch_copy'
  if (!scratchExists) mkdirSync(scratch, { recursive: false, mode: 0o700 })
  for (const entry of snapshotBefore) copyFileSync(join(capture, entry.name), join(scratch, entry.name))
  check('scratch_copy_matches_capture', manifest(scratch), snapshotBefore)
  const file = join(scratch, BASE)
  report.phase = 'product_constructor'
  const store = new TurnReconciliationStore({ persistenceFile: file }) // intentionally default fresh UUID
  report.constructor = { business_admission: store.businessAdmissionStatus(), runtimeEpoch: store.runtimeEpoch,
    runtimeEpochs: [...store.runtimeEpochs], record_count: store.records.size,
    scratch_active_sha256: hashFile(file), durable_runtimeEpochs: JSON.parse(readFileSync(file)).runtimeEpochs }
  check('fresh_runtime_epoch', raw.runtimeEpochs.includes(store.runtimeEpoch), false)
  check('full_constructor_ready', store.businessAdmissionStatus(), { ready: true, reason: null })
  check('full_constructor_count', store.records.size, raw.records.length)
  const referencedEpochs = [...new Set(raw.records.map(record => record.runtimeEpoch))]
  report.constructor.referenced_epoch_count = referencedEpochs.length
  report.constructor.native_dropped_historical_epochs = raw.runtimeEpochs.filter(epoch => !store.runtimeEpochs.has(epoch))
  report.constructor.in_memory_epoch_count = store.runtimeEpochs.size
  check('all_record_epochs_retained_in_memory', referencedEpochs.every(epoch => store.runtimeEpochs.has(epoch)))
  const derived = raw.records.filter(record => record.initialOutcome === 'outcome_unknown'
    && (isLegacyUnprovenFenceClear(record) || (record.fenceState !== 'cleared'
      && (record.adminAbandonment ?? null) === null)))
  report.discovery = { predicate: 'initialOutcome==outcome_unknown AND (isLegacyUnprovenFenceClear OR (fenceState!=cleared AND adminAbandonment==null))',
    target_count: derived.length, requested_four_count_matches: derived.length === 4,
    legacy_count: derived.filter(isLegacyUnprovenFenceClear).length }
  check('at_least_one_current_target', derived.length > 0)
  const count = { processFactoryCalls: 0, workspaceWrites: 0, effects: 0 }
  report.phase = 'product_registry'
  const registryInstance = createProcessRegistry({
    log: { log() {}, error() {} }, cfg: { agentProfile: '547-offline-v5' },
    workspaceBootstrap: { ensure: async () => {}, resolveWorkspace: () => join(scratch, 'unused-workspace'),
      resolveDshHome: () => join(scratch, 'unused-home') },
    agentDefinition: { getAgent: id => ({ id, disabled: false }) },
    deadlineConfig: { perAgent: () => ({ turnTimeoutMs: 1000, promptReceiptTimeoutMs: 1000,
      initializeTimeoutMs: 1000, shutdownGraceMs: 1000 }) }, reconciliationStore: store,
    processFactory: () => { count.processFactoryCalls++; throw new Error('FORBIDDEN_OFFLINE_SPAWN') },
    resolveProcessConfig: () => ({}), provisionHome() { count.workspaceWrites++; throw new Error('FORBIDDEN_OFFLINE_PROVISION') },
    switchAgent: async () => { count.effects++; throw new Error('FORBIDDEN_OFFLINE_SWITCH') },
    getBrokerGateway: () => undefined,
  })
  const admission = createRecoveryAdmission(store, {})
  admission.assertReady()
  report.phase = 'product_per_handle_qa'
  for (const original of derived) {
    const handle = original.handle
    const record = store.requireRecord(handle)
    const span = spans.find(entry => entry.value.handle === handle)
    const legacy = isLegacyUnprovenFenceClear(original)
    const marker = original.adminAbandonment ?? null
    const entries = (registry ?? []).filter(entry => entry.handles.includes(handle))
    const markerEntry = marker === null ? null : (registry ?? []).find(entry => entry.declarationId === marker.declarationId)
    const matchingFaults = Object.entries(faults ?? {}).filter(([key, value]) =>
      key.includes(handle) || JSON.stringify(value).includes(handle))
    const generationFault = faults?.[`${original.agentId}:${original.processGeneration}`] ?? null
    const item = { handle, active_sha256: hash(originalBytes), raw_record_sha256: span.raw_record_sha256,
      raw_record_byte_offset: span.byte_offset, raw_record_byte_length: span.byte_length,
      canonical_record_sha256: hash(JSON.stringify(original)), raw_summary: summary(original),
      loaded_summary: summary(record), type: legacy ? 'legacy_unproven_fence_clear' : 'ordinary_admission_blocker',
      sidecars: { marker_present: marker !== null, marker_sha256: marker === null ? null : hash(JSON.stringify(marker)),
        registry_memberships: entries.map(entry => ({ declarationId_sha256: hash(entry.declarationId), agentId: entry.agentId,
          declaredAt: entry.declaredAt, scope_count: entry.handles.length })),
        marker_registry_consistent: marker === null ? null : markerEntry !== undefined && markerEntry !== null
          && markerEntry.agentId === original.agentId && markerEntry.handles.includes(handle)
          && markerEntry.declaredAt === marker.declaredAt,
        exact_handle_fault_matches: matchingFaults.map(([key, value]) => ({ key_sha256: hash(key), value_sha256: hash(JSON.stringify(value)) })),
        generation_fault_key: `${original.agentId}:${original.processGeneration}`,
        generation_fault_present: generationFault !== null,
        generation_fault_sha256: generationFault === null ? null : hash(JSON.stringify(generationFault)),
        generation_fault_field_names: generationFault === null ? [] : Object.keys(generationFault).sort(),
        faults_semantics: 'diagnostic sidecar, not consumed by pinned main store; no fault entry is termination/admission authority' },
    }
    report.targets.push(item)
    const query = store.getTurnReconciliation(handle)
    item.identification = { query_state: query.state, exact_handle: query.snapshot?.handle,
      legacyFormat: query.snapshot?.legacyFormat ?? null }
    check(`identified:${handle}`, query.snapshot?.handle, handle)
    check(`unknown_retained:${handle}`, record.initialOutcome, 'outcome_unknown')
    for (const key of ['outcome', 'lateOutcome', 'terminationEvidence', 'settlementResult', 'exitObservedAt', 'fenceState'])
      check(`protected_field:${key}:${handle}`, record[key], original[key])
    if (marker !== null && registry !== null) check(`marker_registry:${handle}`, item.sidecars.marker_registry_consistent)
    const blocker = store.admissionBlockerForAgent(original.agentId)
    item.admission = { actual_first_blocker_handle: blocker?.handle ?? null,
      target_is_first: blocker?.handle === handle, prompt_gate_blocker_handle: promptFenceError(store, original.agentId)?.fencedBy ?? null }
    check(`agent_blocked:${handle}`, blocker !== null)
    check(`prompt_gate_matches_first_blocker:${handle}`, item.admission.prompt_gate_blocker_handle, blocker.handle)
    expectError(`admission_rejected:${handle}`, () => admission.assertUnfenced(original.agentId), 'AGENT_PROCESS_TURN_FENCED')
    let registryError = null
    try { await registryInstance.ensureRunning(original.agentId) } catch (error) { registryError = { code: error.code ?? null, fencedBy: error.fencedBy ?? null } }
    check(`spawn_admission_rejected:${handle}`, registryError?.code, 'AGENT_PROCESS_TURN_FENCED')
    check(`spawn_gate_matches_first_blocker:${handle}`, registryError?.fencedBy, blocker.handle)
    const noReplayBefore = { disk_sha256: hashFile(file), record_count: store.records.size,
      correlation_count: store.correlationIndex.size, record_sha256: hash(JSON.stringify(store.requireRecord(handle))) }
    const correlation = original.callerCorrelation ?? null
    item.no_replay = { entrypoints: ['resolveCallerCorrelation', 'mintTurnExecution', 'processRegistry.ensureRunning'],
      correlation_present: correlation !== null, status: correlation === null ? 'CORRELATION_COVERAGE_GAP; admission quarantine verified' : 'VERIFIED',
      before: noReplayBefore, registry_rejection: registryError }
    if (correlation !== null) {
      const resolved = store.resolveCallerCorrelation(correlation)
      item.no_replay.correlation_sha256 = hash(JSON.stringify(correlation))
      item.no_replay.resolved_handle = resolved.handle
      check(`old_correlation_resolves:${handle}`, resolved.handle, handle)
      expectError(`duplicate_mint_refused:${handle}`, () => store.mintTurnExecution({ agentId: original.agentId,
        processGeneration: store.highestIssuedGeneration(original.agentId) + 1,
        sessionId: original.sessionId, callerCorrelation: correlation }), 'RECONCILIATION_CORRELATION_CONFLICT')
    }
    const afterNoReplay = { disk_sha256: hashFile(file), record_count: store.records.size,
      correlation_count: store.correlationIndex.size, record_sha256: hash(JSON.stringify(store.requireRecord(handle))) }
    item.no_replay.after = afterNoReplay
    check(`no_replay_zero_delta:${handle}`, afterNoReplay, noReplayBefore)
    item.narrow_tolerance = { raw_predicate: legacy, loaded_predicate: isLegacyUnprovenFenceClear(record), neighbor_rejections: [] }
    check(`legacy_recognition_unchanged:${handle}`, item.narrow_tolerance.loaded_predicate, legacy)
    if (legacy) {
      check(`legacy_projection:${handle}`, query.snapshot?.legacyFormat, 'unproven_fence_clear')
      const negativeDir = join(scratch, 'negative-' + report.targets.length)
      mkdirSync(negativeDir, { mode: 0o700 })
      const negativeFile = join(negativeDir, BASE)
      for (const delta of [{ state: 'pending_unknown' }, { queryState: 'settled' },
        { initialOutcome: null }, { exitObservedAt: 1 }, { terminationEvidence: 'child_real_exit' },
        { settlementResult: 'terminated_without_outcome' }, { failureReason: null }]) {
        const mutated = structuredClone(raw)
        Object.assign(mutated.records.find(candidate => candidate.handle === handle), delta)
        writeFileSync(negativeFile, JSON.stringify(mutated), { mode: 0o600 })
        expectError(`malformed_neighbor:${JSON.stringify(delta)}:${handle}`,
          () => readDurableRecoveryStore(negativeFile), null, 'TypeError')
        item.narrow_tolerance.neighbor_rejections.push({ delta, expected: 'TypeError', actual: 'TypeError' })
      }
    }
  }
  check('no_process_factory_calls', count.processFactoryCalls, 0)
  check('no_workspace_provision', count.workspaceWrites, 0)
  check('no_switch_effects', count.effects, 0)
  report.effect_counters = count
  report.scratch_after = { active_sha256: hashFile(file), runtimeEpochs: JSON.parse(readFileSync(file)).runtimeEpochs,
    registry_sha256: existsSync(file + '.abandonment-declarations.json') ? hashFile(file + '.abandonment-declarations.json') : null,
    faults_sha256: existsSync(file + '.faults.json') ? hashFile(file + '.faults.json') : null }
  report.scratch_after.native_dropped_historical_epochs = raw.runtimeEpochs.filter(epoch => !report.scratch_after.runtimeEpochs.includes(epoch))
  check('all_record_epochs_retained_durable', referencedEpochs.every(epoch => report.scratch_after.runtimeEpochs.includes(epoch)))
  report.phase = 'final_integrity'
  check('capture_unchanged', manifest(capture), snapshotBefore)
  report.status = 'PASS'
  report.phase = 'complete'
  report.limitations = ['Local source/real-copy mechanism QA only; no production cutover, loaded-byte proof, worker/tool termination or business acceptance.',
    'Missing caller correlation remains an explicit coverage gap; no invented request identity.',
    'Fault sidecar is independently parsed and hashed; pinned main reader has no fault-store consumer.',
    'Negative fixtures modify only separate scratch documents; no manual epoch edits/old epoch overrides. Native reader compaction, if any, is reported explicitly.']
} catch (error) {
  const localScratchPermission = error.code === 'ERR_ACCESS_DENIED'
    && typeof error.resource === 'string' && scratch
    && (error.resource === scratch || inside(error.resource, scratch))
  const harnessPhase = ['harness_preflight', 'reader_imports', 'capture_read', 'scratch_copy'].includes(report.phase)
  const requiredInputMissing = error.code === 'ENOENT' || error.message === 'UNEXPECTED_PREDICATE:capture_active_exists'
  report.status = !requiredInputMissing && (localScratchPermission || harnessPhase) ? 'HARNESS_ERROR' : 'STOPPED'
  report.failure_class = localScratchPermission ? 'LOCAL_SCRATCH_PERMISSION'
    : requiredInputMissing ? 'REQUIRED_INPUT_MISSING' : harnessPhase ? 'LOCAL_HARNESS_INPUT_OR_IO'
      : error.message.startsWith('UNEXPECTED_PREDICATE:') ? 'PRODUCT_PREDICATE' : 'PRODUCT_VALIDATION_OR_IO'
  report.error = { name: error.name, code: error.code ?? null, message: error.message,
    permission: error.permission ?? null, resource: error.resource ?? null, stack: error.stack ?? null }
  if (capture && snapshotBefore) report.capture_after_error = manifest(capture)
} finally {
  report.ended_at_utc = new Date().toISOString()
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}
process.exitCode = report.status === 'PASS' ? 0 : 1
