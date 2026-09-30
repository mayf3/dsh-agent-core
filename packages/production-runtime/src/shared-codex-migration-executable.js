// shared-codex-migration-executable.js — candidate-r2 (R1-02..R1-10 repair).
//
// Safety model (vs candidate-r1): every invocation is gate-checked via
// ./txn-safety.js — default is READ-ONLY (no writes, no helper execution);
// production mutations require BOTH --production AND --apply and every
// production write must be a member of the declared transaction write set
// (session paths always forbidden). Helper execution is allowlisted
// (script files inside the frozen transaction dir; no '-c' shell strings;
// scrubbed env). The transaction keeps a durable per-step receipt and a
// guarded failure boundary: any failure after a committed mutation invokes
// the manifest-bound runtime rollback before rethrowing. Canaries run in
// the accepted order STOCK → CEO → CTO. Normal mode ABORTS on an
// unexpectedly proven legacy generation (no copy). Bootstrap selection is
// carried forward verbatim per ACT2-002 (fail-closed via the ten-gate
// receipt; unreachable in this 88-agent domain).
import {
  chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { selectAuthoritativeCodexGeneration } from './shared-codex-migration.js'
import { CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE } from './model-overrides.js'
import {
  bindRoot, createWriter, execBinding, gateEnv, parseGate, rootedPath,
  DECLARED_TRANSACTION_WRITES,
  FENCE_PATH, SHARED_CONFIG_PATH, PRODUCTION_ROOT,
} from './txn-safety.js'

const PIN = Object.freeze({
  version: '0.2.3',
  sourceCommit: '75d98d5b10bb926d53108e49019668c1bde2a9eb',
  artifactSha256: '2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',
})
// CTR-ACT2-002 / CTR-ACT2-005 step 10: the accepted canary order.
const CANARIES = Object.freeze(['STOCK', 'CEO', 'CTO'])

const DECLARED_WRITES = DECLARED_TRANSACTION_WRITES

function migrationError(code, message) { return Object.assign(new Error(`shared-codex-migration: ${message}`), { code }) }
function exactObject(actual, expected) {
  return actual !== null && typeof actual === 'object'
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value)
}
function sha256File(file) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
function atomicJson(file, value, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode })
  chmodSync(temp, mode); renameSync(temp, file)
}

const EXPECTED_FLEET = 92

/** CTR-ACT-005: the only accepted candidate class; absent = legacy mode. */
function resolveBootstrap(config) {
  if (config?.candidateClass === undefined) return false
  if (config.candidateClass !== 'BOOTSTRAP_FROM_CONVERGED_SNAPSHOT') throw migrationError('SHARED_CODEX_CONFIG_INVALID', `candidateClass must be BOOTSTRAP_FROM_CONVERGED_SNAPSHOT (got ${JSON.stringify(config.candidateClass)})`)
  return true
}

/**
 * CTR-ACT-005 bootstrap selection (carried forward VERBATIM per CTR-ACT2-002
 * NO_SPECULATIVE_RUNNER_REFACTOR): a passing CTR-SCA-017 pre ten-gate receipt
 * for this root is the only credential-acquisition authority. Fleet
 * cardinality must be exactly 92 — unreachable in this 88-agent domain.
 */
function bootstrapSelection(config, root, binding) {
  let receipt
  try { receipt = JSON.parse(readFileSync(rootedPath(binding, config.bootstrapGateReceiptPath), 'utf8')) } catch (cause) { throw migrationError('SHARED_CODEX_GATE_RECEIPT_INVALID', `ten-gate receipt unreadable: ${cause.message}`) }
  if (receipt?.gate !== 'CTR_SCA_017_TEN_GATE' || receipt?.phase !== 'pre' || receipt?.result !== 'PASS' || receipt?.root !== root) throw migrationError('SHARED_CODEX_GATE_RECEIPT_INVALID', 'bootstrap requires a passing CTR-SCA-017 pre ten-gate receipt produced for this root')
  if (receipt.inventory_count !== EXPECTED_FLEET) throw migrationError('SHARED_CODEX_FLEET_CARDINALITY_INVALID', `authoritative fleet must be exactly ${EXPECTED_FLEET} for this one-time transaction (got ${JSON.stringify(receipt.inventory_count)}); unresolved/extra/missing members are fail-closed`)
  if (typeof config.bootstrapStore !== 'string' || config.bootstrapStore === '' || !config.bootstrapStore.startsWith('/')) throw migrationError('SHARED_CODEX_BOOTSTRAP_STORE_INVALID', 'bootstrapStore must be an absolute production credential path')
  if (!Array.isArray(receipt.inventory_paths) || !receipt.inventory_paths.includes(config.bootstrapStore)) throw migrationError('SHARED_CODEX_BOOTSTRAP_STORE_INVALID', 'bootstrapStore must be a member of the receipt equality set')
  return Object.freeze({ legacyCredentialReuseAllowed: true, authoritativeStore: config.bootstrapStore, bootstrap: true, canonicalReauthRequired: false })
}

/** Native store document schema (dsh-codex store.ts): types/keys only, never values. */
function assertNativeCredentialDocument(file) {
  let parsed
  try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch (cause) {
    throw migrationError('SHARED_CODEX_CREDENTIAL_INVALID', `canonical credential is not parseable JSON (${cause.message})`)
  }
  const credential = parsed?.credential
  // expires: the runtime credential store requires a positive finite NUMBER
  // (epoch milliseconds) — `new Date(credential.expires)` semantics.
  if (parsed?.version !== 1 || credential === null || typeof credential !== 'object'
      || credential.type !== 'oauth'
      || typeof credential.access !== 'string' || credential.access === ''
      || typeof credential.refresh !== 'string' || credential.refresh === ''
      || typeof credential.expires !== 'number' || !Number.isFinite(credential.expires) || credential.expires <= 0
      || typeof credential.accountId !== 'string' || credential.accountId === '') {
    throw migrationError('SHARED_CODEX_CREDENTIAL_INVALID', 'canonical credential does not match the dsh-codex native store schema {version:1,credential:{type:oauth,access,refresh,expires:number-ms,accountId}}')
  }
}

function validateCanonical(file) {
  if (!existsSync(file) || !statSync(file).isFile()) throw migrationError('SHARED_CODEX_CREDENTIAL_MISSING', 'canonical Owner credential was not established directly')
  const info = lstatSync(file)
  chmodSync(file, 0o600)
  if ((statSync(file).mode & 0o077) !== 0) throw migrationError('SHARED_CODEX_PERMISSION_INVALID', 'canonical sensitive file must have group/world bits zero')
  if (info.nlink !== 1) throw migrationError('SHARED_CODEX_PERMISSION_INVALID', `canonical credential must be a regular file with link count 1 (got ${info.nlink})`)
  if (info.uid !== 502) throw migrationError('SHARED_CODEX_PERMISSION_INVALID', `canonical credential must be owned by uid502 (got ${info.uid})`)
  assertNativeCredentialDocument(file)
}

function switchFleetConfig(file) {
  const current = JSON.parse(readFileSync(file, 'utf8'))
  if (current?.version !== 3 || current.routeCatalog === null || typeof current.routeCatalog !== 'object') {
    throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'fleet model overrides must already be schema v3')
  }
  let changed = 0
  const routeCatalog = Object.fromEntries(Object.entries(current.routeCatalog).map(([name, route]) => {
    if (route?.provider !== 'openai-codex') return [name, route]
    changed += 1
    return [name, { ...route, credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE }]
  }))
  if (changed === 0) throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'fleet config contains no OpenAI Codex route')
  atomicJson(file, { ...current, routeCatalog }, 0o644)
}
function fleetConfigUsesCanonical(file) {
  const config = JSON.parse(readFileSync(file, 'utf8'))
  const codexRoutes = Object.values(config?.routeCatalog ?? {}).filter((route) => route?.provider === 'openai-codex')
  return codexRoutes.length > 0 && codexRoutes.every((route) => route.credentialFile === CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
}

function validateConfig(config, binding) {
  if (!config || typeof config !== 'object') throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'config object required')
  if (config.canonicalCredentialPath !== CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE) throw migrationError('SHARED_CODEX_PATH_INVALID', 'canonical credential path is not the accepted path')
  if (config.sharedConfigPath !== SHARED_CONFIG_PATH) throw migrationError('SHARED_CODEX_PATH_INVALID', 'fleet config path is not the production model-overrides authority')
  if (config.fencePath !== undefined && config.fencePath !== FENCE_PATH) throw migrationError('SHARED_CODEX_PATH_INVALID', 'fence path is not the accepted path')
  if (!exactObject(config.artifact, PIN)) throw migrationError('SHARED_CODEX_ARTIFACT_MISMATCH', 'artifact pin differs from accepted identity')
  if (typeof config.transactionDir !== 'string' || !config.transactionDir.startsWith('/')) throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'transactionDir (frozen transaction helper dir, absolute) is required so helper execution can be allowlisted')
  if (config.preimageConfigSha256 === undefined || !/^[0-9a-f]{64}$/u.test(config.preimageConfigSha256)) throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'preimageConfigSha256 (v1 preimage digest) is required for rollback postchecks')
  const bootstrap = resolveBootstrap(config)
  for (const name of [
    'installClosure', 'migrateConfigV1ToV3', 'inventoryLegacyProvenance',
    'quiesceLunaDispatch', 'quiesceRefreshWriters', ...(bootstrap ? [] : ['ownerReauthCanonical']),
    'grantControlPlaneAcl', 'probeCanonicalPermissions', 'verifyZeroPerHomeRuntimeOpens',
    'installPinnedArtifact', 'verifyOverlayInstall', 'controlledRestart',
    'verifyFleetHealth', 'verifyPreimageRestored', 'rollbackRuntime',
  ]) if (!Array.isArray(config.commands?.[name])) throw migrationError('SHARED_CODEX_BINDING_INVALID', `missing binding ${name}`)
  if (bootstrap && config.commands?.ownerReauthCanonical !== undefined) throw migrationError('SHARED_CODEX_REAUTH_FORBIDDEN', 'bootstrap mode forbids an ownerReauthCanonical binding (Owner reauth is forbidden for this incident)')
  for (const canary of CANARIES) if (!Array.isArray(config.commands?.canaries?.[canary])) throw migrationError('SHARED_CODEX_BINDING_INVALID', `missing canary binding ${canary}`)
}

function bindingArgv(config, name) {
  // 'canaries.STOCK' resolves into the nested canary binding table.
  const value = name.split('.').reduce((node, key) => node?.[key], config.commands)
  if (!Array.isArray(value)) throw migrationError('SHARED_CODEX_BINDING_INVALID', `missing binding ${name}`)
  return value
}

function runBinding(config, binding, name, label, extraEnv = {}) {
  // Accept both `runBinding(..., { A: 1 })` and `runBinding(..., { env: { A: 1 } })`.
  const extra = extraEnv?.env !== undefined && Object.keys(extraEnv).length === 1 ? extraEnv.env : extraEnv
  const result = execBinding(bindingArgv(config, name), {
    allowedScriptDir: config.transactionDir,
    name: label,
    env: {
      ...gateEnv(binding.gate),
      AGENT_CORE_MIGRATION_ROOT: config.root,
      AGENT_CORE_BINDING: binding.kind,
      ...(typeof config.configPath === 'string' ? { AGENT_CORE_TXN_CONFIG: config.configPath } : {}),
      ...extra,
    },
  })
  if (result.status !== 0) {
    throw migrationError('SHARED_CODEX_BINDING_FAILED', `${label} failed with status ${result.status}${result.stderr ? `: ${String(result.stderr).slice(0, 400)}` : ''}`)
  }
  return result
}

/** Durable per-step transaction receipt (atomic append via rewrite). */
function makeReceiptStore(writer, receiptPath) {
  // BOTH load and persist go through the BOUND path: a sandbox run must
  // never read (or be seeded by) the production receipt file.
  const boundReceiptPath = writer.assert(receiptPath)
  let receipt = { version: 1, startedAt: new Date().toISOString(), steps: [] }
  if (existsSync(boundReceiptPath)) {
    try { receipt = JSON.parse(readFileSync(boundReceiptPath, 'utf8')) } catch { /* fresh receipt over corrupt residue */ }
  }
  const persist = () => atomicJson(boundReceiptPath, receipt, 0o600)
  return Object.freeze({
    step(name, detail = {}) {
      receipt.steps.push({ name, at: new Date().toISOString(), ...detail })
      persist()
    },
    fail(name, error, detail = {}) {
      receipt.steps.push({ name: `FAILED_AT_${name}`, at: new Date().toISOString(), error: `${error?.code ?? 'ERROR'}: ${error?.message ?? String(error)}`, ...detail })
      receipt.failedAt = name
      persist()
    },
    finish(outcome) {
      receipt.finishedAt = new Date().toISOString()
      receipt.outcome = outcome
      persist()
    },
    snapshot: () => JSON.parse(JSON.stringify(receipt)),
  })
}

/** Concrete filesystem/process migration path; there are no operation callbacks. */
export function executeFleetSharedCodexMigration(config, options = {}) {
  const gate = options.gate ?? parseGate()
  const binding = bindRoot(config, gate)
  validateConfig(config, binding)
  const writer = createWriter(binding, DECLARED_WRITES)
  // Production-shaped transaction paths; bound (root-mapped, declared)
  // targets are derived ONCE per use via writer.assert — never re-rooted.
  const P = Object.freeze({
    canonical: config.canonicalCredentialPath,
    sharedConfig: config.sharedConfigPath,
    provenance: `${PRODUCTION_ROOT}/control/provenance-inventory.json`,
    receipt: `${PRODUCTION_ROOT}/control/transaction-receipt.json`,
    artifactReceipt: `${PRODUCTION_ROOT}/control/dsh-codex-artifact-receipt.json`,
    fence: FENCE_PATH,
  })

  if (!gate.mutationAllowed) {
    // READ-ONLY CHECK (default): pure reads only — no helper execution (a
    // helper may itself mutate), no markers, no receipts.
    let liveVersion
    try { liveVersion = JSON.parse(readFileSync(rootedPath(binding, P.sharedConfig), 'utf8'))?.version } catch { liveVersion = 'UNREADABLE' }
    return Object.freeze({
      checked: true, gate, canaries: CANARIES,
      liveConfigVersion: liveVersion,
      canonicalPresent: existsSync(rootedPath(binding, P.canonical)),
      fencePresent: existsSync(rootedPath(binding, P.fence)),
      priorReceiptPresent: existsSync(rootedPath(binding, P.receipt)),
    })
  }

  const receipts = makeReceiptStore(writer, P.receipt)
  // Armed BEFORE the first mutating binding: any binding failure after the
  // boundary is armed invokes the manifest-bound runtime rollback (a failed
  // binding may still have left partial mutations — e.g. an install that
  // copied some files before its bookkeeping write failed).
  let mutationsCommitted = true
  try {
    // Pre-stage (CTR-ACT2-005 step 1): closure install + staged v1→v3
    // migration — both fail-closed and validated in isolation by the
    // helpers themselves before any live rename.
    runBinding(config, binding, 'installClosure', 'closure install (release-manifest bound)')
    receipts.step('installClosure')
    runBinding(config, binding, 'migrateConfigV1ToV3', 'staged v1→v3 config migration', { env: { AGENT_CORE_PREIMAGE_SHA256: config.preimageConfigSha256 } })
    receipts.step('migrateConfigV1ToV3', { sharedConfig: sha256File(writer.assert(P.sharedConfig)) })

    runBinding(config, binding, 'quiesceLunaDispatch', 'quiesce Luna dispatch')
    runBinding(config, binding, 'quiesceRefreshWriters', 'quiesce refresh writers')
    const fenceBound = writer.assert(P.fence)
    atomicJson(fenceBound, { version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true, transaction: 'activation-v2' }, 0o600)
    receipts.step('fence', { fence: fenceBound })

    // Fresh provenance inventory at transaction time (R1-06): the runner
    // invokes the binding; it never trusts a pre-existing provenance file.
    const provenanceBound = writer.assert(P.provenance)
    runBinding(config, binding, 'inventoryLegacyProvenance', 'legacy provenance inventory', { env: { AGENT_CORE_PROVENANCE_OUT: provenanceBound } })
    const inventory = JSON.parse(readFileSync(provenanceBound, 'utf8'))
    receipts.step('inventoryLegacyProvenance', { candidates: Array.isArray(inventory?.candidates) ? inventory.candidates.length : null })

    const bootstrap = resolveBootstrap(config)
    const selection = bootstrap
      ? bootstrapSelection(config, config.root, binding)
      : selectAuthoritativeCodexGeneration({ ...inventory, lunaDispatchQuiesced: true, refreshWritersQuiesced: true })
    if (!bootstrap && selection.legacyCredentialReuseAllowed === true) {
      // CTR-ACT2-005 step 4: a proven legacy generation in normal mode
      // contradicts this domain's zero-proven-generation fact — ABORT, never copy.
      throw migrationError('SHARED_CODEX_UNEXPECTED_PROVEN_GENERATION', 'normal ONE_CANONICAL_OWNER_REAUTH mode aborted: inventory unexpectedly yielded a proven legacy generation')
    }
    receipts.step('selection', { mode: bootstrap ? 'bootstrap' : 'owner-reauth', legacyReuseAllowed: selection.legacyCredentialReuseAllowed === true })

    const canonicalDirBound = dirname(writer.assert(P.canonical))
    mkdirSync(canonicalDirBound, { recursive: true, mode: 0o700 }); chmodSync(canonicalDirBound, 0o700)
    runBinding(config, binding, 'grantControlPlaneAcl', 'canonical-owner control-plane preparation')
    let canonicalReauthCount = 0
    if (selection.legacyCredentialReuseAllowed) {
      // Bootstrap branch only (ten-gate receipt bound). Normal mode aborted above.
      const source = writer.assert(selection.authoritativeStore)
      const canonicalBound = writer.assert(P.canonical)
      const temp = `${canonicalBound}.tmp-${process.pid}`
      copyFileSync(source, temp); chmodSync(temp, 0o600); renameSync(temp, canonicalBound)
    } else {
      canonicalReauthCount = 1
      runBinding(config, binding, 'ownerReauthCanonical', 'canonical Owner reauth (native explicit store)', { env: { AGENT_CORE_CANONICAL_CREDENTIAL: writer.assert(P.canonical) } })
    }
    validateCanonical(writer.assert(P.canonical))
    receipts.step('canonicalCredential', { canonicalReauthCount })

    const canonicalForProbes = writer.assert(P.canonical)
    runBinding(config, binding, 'probeCanonicalPermissions', 'canonical permission probes', { env: { AGENT_CORE_CANONICAL_CREDENTIAL: canonicalForProbes } })
    receipts.step('probeCanonicalPermissions')
    const sharedConfigBound = writer.assert(P.sharedConfig)
    switchFleetConfig(sharedConfigBound)
    receipts.step('switchFleetConfig', { sharedConfig: sha256File(sharedConfigBound), usesCanonical: fleetConfigUsesCanonical(sharedConfigBound) })
    runBinding(config, binding, 'verifyZeroPerHomeRuntimeOpens', 'verify zero per-home OAuth runtime opens')
    receipts.step('verifyZeroPerHomeRuntimeOpens')
    const artifactReceiptBound = writer.assert(P.artifactReceipt)
    runBinding(config, binding, 'installPinnedArtifact', 'install exact pinned dsh-codex artifact', { env: { AGENT_CORE_ARTIFACT_RECEIPT: artifactReceiptBound } })
    const installed = JSON.parse(readFileSync(artifactReceiptBound, 'utf8'))
    if (!exactObject({ version: installed.version, sourceCommit: installed.sourceCommit, artifactSha256: installed.artifactSha256 }, PIN)
      || installed.sourceStamp !== config.sourceStamp || !Array.isArray(installed.installedFiles) || installed.installedFiles.length === 0) {
      throw migrationError('SHARED_CODEX_ARTIFACT_MISMATCH', 'post-install artifact receipt is not exact (must carry verified installedFiles digests)')
    }
    runBinding(config, binding, 'verifyOverlayInstall', 'verify closure overlay bytes in deployment checkout')
    receipts.step('installPinnedArtifact', { artifactReceipt: artifactReceiptBound })
    runBinding(config, binding, 'controlledRestart', 'controlled restart')
    receipts.step('controlledRestart')
    // Fence lifetime ends here: the canonical credential is committed and
    // validated, the fleet config is switched, and the accepted v3 runtime
    // is up and healthy. The canaries are the FIRST AUTHORIZED admissions
    // that prove the new credential (ACT2-005 step 10) — they must be able
    // to admit. If anything fails from here on, the failure boundary rolls
    // back to the Luna-disabled runtime state (per-home never resumes).
    unlinkSync(writer.assert(P.fence))
    receipts.step('fenceCleared', { reason: 'canonical validated + v3 runtime healthy; admitting canaries' })
    const canaryResults = []
    for (const canary of CANARIES) {
      runBinding(config, binding, 'canaries.' + canary, `${canary} canary`, { env: { AGENT_CORE_CANARY_LABEL: canary } })
      canaryResults.push(canary)
      receipts.step(`canary.${canary}`)
    }
    runBinding(config, binding, 'verifyFleetHealth', 'fleet verification')
    receipts.step('verifyFleetHealth')
    receipts.finish('COMPLETED')
    return Object.freeze({ selection, canonicalReauthCount, canaries: CANARIES, canonicalCredential: writer.assert(P.canonical), receipt: receipts.snapshot() })
  } catch (error) {
    receipts.fail(error?.stepName ?? 'transaction', error)
    if (mutationsCommitted && options.autoRollbackOnFailure !== false) {
      // Guarded failure boundary (R1-04): a committed mutation means the
      // runtime may be mid-transition — restore the manifest-bound safe
      // state before rethrowing. Quiesce stays UP through rollback.
      try {
        runBinding(config, binding, 'rollbackRuntime', 'failure-boundary runtime rollback')
        receipts.step('failureBoundaryRollback', { restored: true })
      } catch (rollbackError) {
        receipts.fail('failureBoundaryRollback', rollbackError)
        throw migrationError('SHARED_CODEX_FAILURE_BOUNDARY_ROLLBACK_FAILED', `transaction failed (${error.message}) AND failure-boundary rollback failed (${rollbackError.message}) — OPERATOR intervention required; fence retained`)
      }
    }
    throw error
  }
}

/** Roll back runtime only; canonical rotating credentials and shared path are never rolled back. */
export function executeFleetSharedCodexRollback(config, options = {}) {
  const gate = options.gate ?? parseGate()
  const binding = bindRoot(config, gate)
  validateConfig(config, binding)
  const writer = createWriter(binding, DECLARED_WRITES)
  const P = Object.freeze({
    canonical: config.canonicalCredentialPath,
    sharedConfig: config.sharedConfigPath,
    fence: FENCE_PATH,
    receipt: `${PRODUCTION_ROOT}/control/transaction-receipt.json`,
  })
  if (!gate.mutationAllowed) {
    const canonicalRo = rootedPath(binding, P.canonical)
    return Object.freeze({
      checked: true, gate,
      liveConfigVersion: (() => { try { return JSON.parse(readFileSync(rootedPath(binding, P.sharedConfig), 'utf8'))?.version } catch { return 'UNREADABLE' } })(),
      canonicalPresent: existsSync(canonicalRo), canonicalDigest: existsSync(canonicalRo) ? sha256File(canonicalRo) : null,
      intentPresent: existsSync(`${canonicalRo}.refresh-intent.json`),
    })
  }
  const receipts = makeReceiptStore(writer, P.receipt)
  try {
    runBinding(config, binding, 'quiesceLunaDispatch', 'rollback quiesce Luna dispatch')
    runBinding(config, binding, 'quiesceRefreshWriters', 'rollback quiesce refresh writers')
    const fenceBound = writer.assert(P.fence)
    atomicJson(fenceBound, { version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true, rollback: true, transaction: 'activation-v2-rollback' }, 0o600)
    receipts.step('fence', { fence: fenceBound })

    // Canonical retention evidence captured BEFORE rollback (R1-08): digest
    // AND inode identity; the postcheck compares both.
    const canonicalBound = writer.assert(P.canonical)
    const before = existsSync(canonicalBound)
      ? { sha256: sha256File(canonicalBound), ino: lstatSync(canonicalBound).ino }
      : null
    validateCanonical(canonicalBound)
    const intentPresent = existsSync(`${canonicalBound}.refresh-intent.json`)
    if (intentPresent && options.containIntent !== true) {
      throw migrationError('SHARED_CODEX_REAUTH_REQUIRED', 'ambiguous canonical refresh intent present: rerun with --contain-intent to roll back the runtime while Luna admission stays fenced (intent preserved for the Owner)')
    }
    runBinding(config, binding, 'rollbackRuntime', 'runtime rollback retaining canonical credentials', { env: { AGENT_CORE_PREIMAGE_SHA256: config.preimageConfigSha256 } })
    // Restored-state postchecks (R1-08): the runtime is back at the v1
    // preimage; requiring live v3 here was the r1 self-defeating bug.
    runBinding(config, binding, 'verifyPreimageRestored', 'preimage restoration verification', { env: { AGENT_CORE_PREIMAGE_SHA256: config.preimageConfigSha256 } })
    const after = existsSync(canonicalBound)
      ? { sha256: sha256File(canonicalBound), ino: lstatSync(canonicalBound).ino }
      : null
    if (before === null || after === null || before.sha256 !== after.sha256 || before.ino !== after.ino) {
      throw migrationError('SHARED_CODEX_ROLLBACK_CANONICAL_MUTATED', 'canonical credential generation changed across rollback (content digest or inode mismatch)')
    }
    if (intentPresent) {
      if (!existsSync(`${canonicalBound}.refresh-intent.json`)) throw migrationError('SHARED_CODEX_INTENT_LOST', 'pending refresh intent must be preserved across rollback')
      receipts.step('intentContained', { fenceRetained: true })
    }
    // CTR-ACT2-007 / CTR-SCA-014: the fence is RETAINED on EVERY rollback —
    // Luna admission stays structurally off (overlay runtimes refuse codex
    // admission while it exists; the restored preimage runtime additionally
    // runs a Luna-disabled config, see rollback-runtime.mjs) pending the
    // Owner's explicit disposition. Nothing in the rollback path clears it.
    receipts.step('fenceRetained', { fence: fenceBound })
    receipts.finish('ROLLED_BACK')
    return Object.freeze({ canonicalCredentialRetained: true, legacyCredentialRollback: false, intentContained: intentPresent, fenceRetained: true, receipt: receipts.snapshot() })
  } catch (error) {
    receipts.fail(error?.stepName ?? 'rollback', error)
    throw error
  }
}

export const FLEET_SHARED_CODEX_ARTIFACT_PIN = PIN
