import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const STORE_VERSION = 2
const LEGACY_STATE_FIELDS = [
  'runningAtMs', 'lastRunAtMs', 'lastRunStatus', 'lastStatus', 'lastError',
  'lastDurationMs', 'lastDeliveryStatus', 'lastDelivered', 'consecutiveErrors', 'nextRunAtMs',
]

function digestJSON(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

function fail(context, error) {
  const wrapped = new Error(`scheduler store: ${context}: ${error?.message ?? error}`)
  wrapped.cause = error
  throw wrapped
}

/** Load the latest document for mutation; upgrade v1 without fabricating runs. */
async function loadDocForMutation() {
  const classified = await this._readDocRaw()
  if (classified.status === 'empty') {
    return { doc: this._emptyDoc(), sourceStatus: 'empty', existed: false }
  }
  if (classified.status === 'v2') {
    return { doc: structuredClone(classified.doc), sourceStatus: 'v2', existed: true }
  }
  const backup = await this._writeV1Backup(classified.raw)
  const { doc, report } = this._transformV1Doc(classified, backup)
  await this._recordUpgradeSidecar(doc, backup)
  return {
    doc,
    sourceStatus: 'v1',
    existed: true,
    upgrade: { report, backupFile: backup.file },
  }
}

async function ensureUpgraded() {
  const { doc, upgrade } = await this.mutateDoc(() => {})
  return {
    upgraded: upgrade !== null,
    report: upgrade?.report,
    evidenceStatus: upgrade?.evidenceStatus,
    doc: structuredClone(doc),
  }
}

function transformV1Doc(classified, backup) {
  const report = {
    upgradedAtMs: this.clock(),
    backupFile: backup.file,
    jobs: [],
    inFlightJobs: [],
    disabledByUpgrade: [],
    strippedSessionFields: [],
    fabricatedOccurrences: 0,
  }
  const jobs = []
  for (const raw of classified.jobs) {
    const job = structuredClone(raw)
    const entry = { id: job?.id ?? '(unknown)', strippedExecutionState: [], strippedSessionFields: null }
    const legacyState = job.state && typeof job.state === 'object' ? job.state : {}
    for (const key of LEGACY_STATE_FIELDS) {
      if (legacyState[key] !== undefined) entry.strippedExecutionState.push(key)
    }
    if (typeof legacyState.runningAtMs === 'number') {
      job.enabled = false
      job.migrationRestoreBlocked = true
      report.inFlightJobs.push({ id: job.id, name: job.name ?? '(unknown)', runningAtMs: legacyState.runningAtMs })
      report.disabledByUpgrade.push(job.id)
    }
    // With an empty occurrence ledger no legacy summary can be grounded.
    job.state = {}
    if (job.sessionTarget !== undefined || job.sessionKey !== undefined) {
      entry.strippedSessionFields = {
        sessionTarget: job.sessionTarget ?? null,
        sessionKey: job.sessionKey ?? null,
      }
      report.strippedSessionFields.push({ id: job.id, ...entry.strippedSessionFields })
      if (job.sessionTarget === 'main' || (typeof job.sessionKey === 'string' && job.sessionKey !== '')) {
        job.enabled = false
        job.migrationRestoreBlocked = true
        report.disabledByUpgrade.push(job.id)
      }
      delete job.sessionTarget
      delete job.sessionKey
    }
    job.scheduleRevision = job.scheduleRevision ?? 1
    job.revisionActivatedAtMs = job.revisionActivatedAtMs ?? this.clock()
    report.jobs.push(entry)
    jobs.push(job)
  }
  report.disabledByUpgrade = [...new Set(report.disabledByUpgrade)]
  return { doc: { version: STORE_VERSION, jobs, occurrences: [], fences: {} }, report }
}

async function writeV1Backup(raw) {
  await this._ensureDir()
  const file = `${this.filePath}.v1.${this.clock()}-${process.pid}-${this._tmpSeq + 1}.bak`
  try {
    const handle = await fs.open(file, 'wx')
    try {
      await handle.writeFile(`${JSON.stringify(raw, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await this._syncDir(path.dirname(file))
  } catch (error) {
    fail(`write generation backup ${file}`, error)
  }
  return { file, digest: digestJSON(raw) }
}

async function recordUpgradeSidecar(doc, backup) {
  await this._writeSidecar({
    upgradedAtMs: this.clock(),
    baseJobsDigest: digestJSON(doc.jobs),
    sourceDigest: backup.digest,
    backupFile: backup.file,
    jobMutationSeen: false,
  })
}

/** Monotonic guard: once any post-upgrade Job mutation is attempted, rollback stays refused. */
async function markV2JobMutation() {
  const sidecar = await this._readUpgradeSidecar()
  // Native-v2 stores have no v1 backup and are never eligible for rollback;
  // therefore they need no mutation sidecar.
  if (!sidecar) return
  if (sidecar.jobMutationSeen === true) return
  await this._writeSidecar({ ...sidecar, jobMutationSeen: true, firstJobMutationAtMs: this.clock() })
}

async function writeSidecar(value) {
  await this._ensureDir()
  const tmp = `${this.upgradeMetaPath}.tmp-${process.pid}-${++this._tmpSeq}`
  const handle = await fs.open(tmp, 'wx')
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, this.upgradeMetaPath)
  await this._syncDir(path.dirname(this.upgradeMetaPath))
}

async function readUpgradeSidecar() {
  try {
    return JSON.parse(await fs.readFile(this.upgradeMetaPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    fail(`read ${this.upgradeMetaPath}`, error)
  }
}

async function listV1Backups() {
  let names
  try {
    names = await fs.readdir(this.dir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    fail(`readdir ${this.dir}`, error)
  }
  const base = path.basename(this.filePath)
  return names
    .filter((name) => name.startsWith(`${base}.v1.`)
      && (name.endsWith('.bak') || name.endsWith('.bak.consumed')))
    .sort()
}

async function checkRollbackToV1() {
  const classified = await this._readDocRaw()
  if (classified.status !== 'v2') {
    return { allowed: false, reason: `document is not v2 (status: ${classified.status})`, conditions: null }
  }
  const sidecar = await this._readUpgradeSidecar()
  const unresolved = classified.doc.occurrences.filter(
    (record) => record.state === 'outcome_unknown' && record.lateSettlement === undefined,
  )
  const conditions = {
    occurrencesEmpty: classified.doc.occurrences.length === 0,
    fencesEmpty: Object.keys(classified.doc.fences).length === 0,
    noUnresolvedOutcomeUnknown: unresolved.length === 0,
    noV2EraJobMutation: sidecar !== null && sidecar.jobMutationSeen !== true
      && digestJSON(classified.doc.jobs) === sidecar.baseJobsDigest,
  }
  if (!conditions.noUnresolvedOutcomeUnknown) {
    return { allowed: false, reason: 'unresolved outcome_unknown exists', conditions }
  }
  if (!conditions.fencesEmpty) return { allowed: false, reason: 'active fences exist', conditions }
  if (!conditions.occurrencesEmpty) return { allowed: false, reason: 'occurrence authority exists', conditions }
  if (!sidecar) return { allowed: false, reason: 'upgrade sidecar missing', conditions }
  if (!conditions.noV2EraJobMutation) return { allowed: false, reason: 'V2-era Job mutation was observed', conditions }
  return { allowed: true, conditions }
}

async function rollbackToV1({ operator } = {}) {
  const run = this._mutexChain.then(() => this._withLock(async () => {
    const check = await this.checkRollbackToV1()
    if (!check.allowed) {
      const error = Object.assign(
        new Error(`ROLLBACK_TO_V1 REFUSED: ${check.reason} — recovery=forward-fix-or-reconcile`),
        { code: 'ROLLBACK_REFUSED', conditions: check.conditions },
      )
      throw error
    }
    const sidecar = await this._readUpgradeSidecar()
    const backupPath = sidecar?.backupFile
    const backupName = typeof backupPath === 'string' ? path.basename(backupPath) : ''
    const safeBackupPath = typeof backupPath === 'string'
      && path.dirname(path.resolve(backupPath)) === path.resolve(this.dir)
      && backupName.startsWith(`${path.basename(this.filePath)}.v1.`)
      && backupName.endsWith('.bak')
    let backupRaw
    let backupData
    try {
      if (!safeBackupPath) throw new Error('sidecar backup path is invalid')
      backupRaw = await fs.readFile(backupPath, 'utf8')
      backupData = JSON.parse(backupRaw)
      const validV1 = Array.isArray(backupData)
        || backupData?.version === 1 && Array.isArray(backupData.jobs)
      if (!validV1) throw new Error('backup is not a valid v1 document')
      if (digestJSON(backupData) !== sidecar.sourceDigest) throw new Error('backup digest does not match sidecar')
    } catch (cause) {
      throw Object.assign(new Error(`ROLLBACK_TO_V1 REFUSED: exact generation backup invalid: ${cause.message}`), {
        code: 'ROLLBACK_REFUSED', cause,
      })
    }
    const archivePath = `${this.filePath}.v2.${this.clock()}-${process.pid}.archive.json`
    const archive = await fs.open(archivePath, 'wx')
    try {
      await archive.writeFile(await fs.readFile(this.filePath, 'utf8'), 'utf8')
      await archive.sync()
    } finally {
      await archive.close()
    }
    await this._syncDir(this.dir)
    await this._writeRawAtomic(await fs.readFile(backupPath, 'utf8'))
    await fs.rename(backupPath, `${backupPath}.consumed`)
    await fs.rm(this.upgradeMetaPath, { force: true })
    await this._syncDir(this.dir)
    this._cacheDoc = null
    this._mtimeMs = -1
    const evidenceStatus = await this.appendRunEvent({
      ts: this.clock(),
      action: 'store_rollback_v2_to_v1',
      archiveFile: archivePath,
      restoredBackup: backupName,
      operator: operator ?? '(unspecified)',
    })
    return { archiveFile: archivePath, restoredBackup: backupName, evidenceStatus }
  }))
  this._mutexChain = run.catch(() => {})
  return run
}

export const storeMigrationMethods = {
  _loadDocForMutation: loadDocForMutation,
  ensureUpgraded,
  _transformV1Doc: transformV1Doc,
  _writeV1Backup: writeV1Backup,
  _recordUpgradeSidecar: recordUpgradeSidecar,
  _markV2JobMutation: markV2JobMutation,
  _writeSidecar: writeSidecar,
  _readUpgradeSidecar: readUpgradeSidecar,
  listV1Backups,
  checkRollbackToV1,
  rollbackToV1,
}
