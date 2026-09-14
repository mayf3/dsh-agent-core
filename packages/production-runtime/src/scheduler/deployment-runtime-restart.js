import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, chownSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { quiesceLaunchdServices } from './deployment-launchd.js'
import { capturePlainFileMetadata, clearGeneratedFileXattrs } from './deployment-file-metadata.js'

export function restartSchedulerProductionRuntime({ ctx, phase, sourceSha }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '') || !Number.isInteger(ctx.authsvcUid) || !Number.isInteger(ctx.authsvcGid)) {
    throw new TypeError('runtime restart requires exact deployed SHA and authsvc ownership coordinates')
  }
  const plistPath = join(ctx.launchdDir, 'ai.agent-core.runtime.plist')
  const preimage = join(ctx.artifactsDir, 'rollback', 'ai.agent-core.runtime.plist.preimage')
  mkdirSync(dirname(preimage), { recursive: true })
  if (!existsSync(preimage)) { capturePlainFileMetadata(plistPath); execFileSync('cp', ['-p', plistPath, preimage]); clearGeneratedFileXattrs(preimage) }
  const preimageMetadata = capturePlainFileMetadata(preimage)
  const preimageSha256 = createHash('sha256').update(readFileSync(preimage)).digest('hex')
  let plist = readFileSync(plistPath, 'utf8')
  const envAdds = {
    AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json',
    SCHEDULER_RECONCILIATION_EVIDENCE_FILE: '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl',
    SCHEDULER_ROUTING_MANIFEST: '/usr/local/libexec/agent-core/config/scheduler-routing.json',
    SCHEDULER_ROUTING_OWNER_UID: '0',
    SCHEDULER_ROUTING_READER_GID: String(ctx.authsvcGid),
    SCHEDULER_INCIDENT_OWNER_UID: String(ctx.authsvcUid),
    SCHEDULER_INCIDENT_OWNER_GID: String(ctx.authsvcGid),
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
  ctx.runtimeReceipt?.({ status: 'INSTALLING', sourceSha, plistPath, preimage, preimageSha256, preimageMetadata, installedSha256: expectedInstalledSha256 })
  if (dirty) {
    const tmp = `${plistPath}.incoming`
    writeFileSync(tmp, plist)
    clearGeneratedFileXattrs(tmp)
    chmodSync(tmp, preimageMetadata.mode)
    if (process.getuid?.() === 0) chownSync(tmp, preimageMetadata.uid, preimageMetadata.gid)
    execFileSync('mv', [tmp, plistPath])
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
  ctx.runtimeReceipt?.({ status: 'INSTALLED', sourceSha, plistPath, preimage, preimageSha256, preimageMetadata, installedSha256 })
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
