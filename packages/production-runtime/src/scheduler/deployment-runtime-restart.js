import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { quiesceLaunchdServices } from './deployment-launchd.js'
import { capturePlainFileMetadata, listFileXattrs } from './deployment-file-metadata.js'
import { atomicInstallDurableFile, durableCopyPreimage, syncDirectory, syncFile, verifyAndSyncPreimage, verifyReceiptedPreimage } from './deployment-durable-file.js'

export function restartSchedulerProductionRuntime({ ctx, phase, sourceSha }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '') || !Number.isInteger(ctx.authsvcUid) || !Number.isInteger(ctx.authsvcGid)
    || !Number.isInteger(ctx.runtimeReaderGid ?? ctx.authsvcGid)) {
    throw new TypeError('runtime restart requires exact deployed SHA and authsvc ownership coordinates')
  }
  const plistPath = join(ctx.launchdDir, 'ai.agent-core.runtime.plist')
  const preimage = join(ctx.artifactsDir, 'rollback', 'ai.agent-core.runtime.plist.preimage')
  mkdirSync(dirname(preimage), { recursive: true })
  const sourceMetadata = capturePlainFileMetadata(plistPath)
  if (existsSync(preimage) && !readFileSync(plistPath).equals(readFileSync(preimage)) && !ctx.runtimePriorReceipt) {
    unlinkSync(preimage); syncDirectory(dirname(preimage))
  }
  if (!ctx.runtimePriorReceipt && !existsSync(preimage)) {
    durableCopyPreimage(plistPath, preimage, sourceMetadata, { crashAt: ctx.crashAt, onStage: ctx.onDurabilityStage })
  }
  if (ctx.runtimePriorReceipt) {
    if (ctx.runtimePriorReceipt.sourceSha !== sourceSha || ctx.runtimePriorReceipt.plistPath !== plistPath) throw new Error('runtime receipt generation mismatch')
    verifyReceiptedPreimage({ path: preimage, expectedPath: ctx.runtimePriorReceipt.preimage,
      expectedSha256: ctx.runtimePriorReceipt.preimageSha256, expectedMetadata: ctx.runtimePriorReceipt.preimageMetadata,
      expectedXattrs: ctx.runtimePriorReceipt.preimageXattrs })
  }
  const preimageMetadata = capturePlainFileMetadata(preimage)
  const preimageXattrs = listFileXattrs(preimage)
  const preimageSha256 = createHash('sha256').update(readFileSync(preimage)).digest('hex')
  const currentSha256 = createHash('sha256').update(readFileSync(plistPath)).digest('hex')
  if (currentSha256 === preimageSha256) {
    if (JSON.stringify(sourceMetadata) !== JSON.stringify(preimageMetadata)) throw new Error('runtime preimage metadata differs from predecessor')
    verifyAndSyncPreimage(plistPath, preimage, sourceMetadata)
  }
  else {
    const prior = ctx.runtimePriorReceipt
    if (prior?.sourceSha !== sourceSha || prior?.installedSha256 !== currentSha256) throw new Error('runtime plist differs from both durable preimage and receipted generation')
    syncFile(preimage); syncDirectory(dirname(preimage))
  }
  let plist = readFileSync(plistPath, 'utf8')
  const envAdds = {
    AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json',
    SCHEDULER_RECONCILIATION_EVIDENCE_FILE: '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl',
    SCHEDULER_ROUTING_MANIFEST: '/usr/local/libexec/agent-core/config/scheduler-routing.json',
    SCHEDULER_ROUTING_OWNER_UID: '0',
    SCHEDULER_ROUTING_READER_GID: String(ctx.authsvcGid),
    SCHEDULER_INCIDENT_OWNER_UID: String(ctx.authsvcUid),
    SCHEDULER_INCIDENT_OWNER_GID: String(ctx.runtimeReaderGid ?? ctx.authsvcGid),
    AGENT_CORE_DEPLOYED_SHA: sourceSha,
  }
  let dirty = false
  for (const [key, value] of Object.entries(envAdds)) {
    const pair = new RegExp(`<key>${key}</key>\\s*<string>[^<]*</string>`)
    const replacement = `<key>${key}</key><string>${value}</string>`
    if (pair.test(plist)) {
      const updated = plist.replace(pair, replacement)
      if (updated !== plist) { plist = updated; dirty = true }
    } else {
      plist = plist.replace('<key>HOME</key>', `<key>${key}</key><string>${value}</string>\n\t\t<key>HOME</key>`)
      dirty = true
    }
  }
  const expectedInstalledSha256 = createHash('sha256').update(plist).digest('hex')
  ctx.runtimeReceipt?.({ status: 'INSTALLING', sourceSha, plistPath, preimage, preimageSha256, preimageMetadata, preimageXattrs, installedSha256: expectedInstalledSha256 })
  if (dirty) {
    atomicInstallDurableFile(plistPath, Buffer.from(plist), preimageMetadata, { crashAt: ctx.crashAt, onStage: ctx.onDurabilityStage })
  } else {
    syncFile(plistPath); syncDirectory(dirname(plistPath))
  }
  const installed = readFileSync(plistPath, 'utf8')
  const installedSha256 = createHash('sha256').update(installed).digest('hex')
  if (installedSha256 !== expectedInstalledSha256) throw new Error('runtime plist generation changed during install')
  for (const [key, value] of Object.entries(envAdds)) {
    if (!installed.includes(`<key>${key}</key><string>${value}</string>`)) throw new Error(`runtime plist readback mismatch for ${key}`)
  }
  quiesceLaunchdServices(['system/ai.agent-core.runtime'], ctx)
  ctx.bootstrap(plistPath, 'system/ai.agent-core.runtime')
  if (JSON.stringify(capturePlainFileMetadata(plistPath)) !== JSON.stringify(preimageMetadata)) throw new Error('runtime plist metadata readback mismatch')
  ctx.runtimeReceipt?.({ status: 'INSTALLED', sourceSha, plistPath, preimage, preimageSha256, preimageMetadata, preimageXattrs, installedSha256 })
  const deadline = Date.now() + 60_000
  let healthy = false
  while (Date.now() < deadline) {
    try {
      const result = JSON.parse(execFileSync('curl', ['-s', '-m', '3', 'http://127.0.0.1:8790/health'], { encoding: 'utf8' }))
      if (result?.ok === true) { healthy = true; break }
    } catch { /* bounded retry */ }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
  }
  if (!healthy) {
    phase('runtime', false, 'health TIMEOUT after kickstart — RUN ROLLBACK NOW: sudo node scripts/scheduler-cp-rollback.mjs (preimages are in place)')
  }
  phase('runtime', true, `plist env ${dirty ? 'patched' : 'already present'}; bootout/bootstrap; health=ok`)
  return { healthy, deployedSha: sourceSha }
}
