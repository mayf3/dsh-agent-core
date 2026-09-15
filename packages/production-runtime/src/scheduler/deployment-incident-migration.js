import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const SHA256 = /^[0-9a-f]{64}$/

export function runSchedulerIncidentMigration({ ctx, sources } = {}) {
  const requiredPaths = ['legacyStatePath', 'legacyEvidencePath', 'factsPath']
  const requiredHashes = ['legacyStateSha256', 'legacyEvidenceSha256', 'factsFileSha256', 'factsSha256']
  if (!ctx?.runtimeNode || !ctx?.liveRoot || !ctx?.watchdogStateDir
    || requiredPaths.some((key) => typeof sources?.[key] !== 'string' || sources[key] === '')
    || requiredHashes.some((key) => !SHA256.test(sources?.[key] ?? ''))
    || !Number.isInteger(ctx.authsvcUid) || !Number.isInteger(ctx.authsvcGid)) {
    throw new TypeError('incident migration requires exact paths, hashes, runtime and ownership coordinates')
  }
  const output = execFileSync(ctx.runtimeNode, [join(ctx.liveRoot, 'scripts/scheduler-watchdog.mjs'), '--migrate-incident-state'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SCHEDULER_WATCHDOG_STATE_DIR: ctx.watchdogStateDir,
      SCHEDULER_INCIDENT_STATE: join(ctx.watchdogStateDir, 'incidents.json'),
      SCHEDULER_INCIDENT_OWNER_UID: String(ctx.authsvcUid),
      SCHEDULER_INCIDENT_OWNER_GID: String(ctx.authsvcGid),
      SCHEDULER_MIGRATION_FACTS_FILE: sources.factsPath,
      SCHEDULER_MIGRATION_FACTS_FILE_SHA256: sources.factsFileSha256,
      SCHEDULER_MIGRATION_FACTS_SHA256: sources.factsSha256,
      SCHEDULER_LEGACY_ALERT_STATE: sources.legacyStatePath,
      SCHEDULER_LEGACY_ALERT_STATE_SHA256: sources.legacyStateSha256,
      SCHEDULER_LEGACY_DELIVERY_EVIDENCE: sources.legacyEvidencePath,
      SCHEDULER_LEGACY_DELIVERY_EVIDENCE_SHA256: sources.legacyEvidenceSha256,
    },
  })
  const receipt = JSON.parse(output)
  if (!['MIGRATED', 'ALREADY_MIGRATED', 'MIGRATION_EXTENDED'].includes(receipt.status)
    || receipt.legacySha256 !== sources.legacyStateSha256
    || receipt.evidenceSha256 !== sources.legacyEvidenceSha256
    || receipt.factsSha256 !== sources.factsSha256) throw new Error('incident migration readback mismatch')
  return receipt
}
