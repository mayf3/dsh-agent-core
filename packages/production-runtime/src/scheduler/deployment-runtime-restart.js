import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function restartSchedulerProductionRuntime({ ctx, phase }) {
  const plistPath = join(ctx.launchdDir, 'ai.agent-core.runtime.plist')
  const preimage = join(ctx.artifactsDir, 'rollback', 'ai.agent-core.runtime.plist.preimage')
  mkdirSync(dirname(preimage), { recursive: true })
  if (!existsSync(preimage)) execFileSync('cp', [plistPath, preimage])
  let plist = readFileSync(plistPath, 'utf8')
  const envAdds = {
    AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json',
    SCHEDULER_RECONCILIATION_EVIDENCE_FILE: '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl',
    SCHEDULER_ROUTING_MANIFEST: '/usr/local/libexec/agent-core/config/scheduler-routing.json',
    SCHEDULER_ROUTING_OWNER_UID: '0',
  }
  let dirty = false
  for (const [key, value] of Object.entries(envAdds)) {
    if (!plist.includes(`<key>${key}</key>`)) {
      plist = plist.replace('<key>HOME</key>', `<key>${key}</key><string>${value}</string>\n\t\t<key>HOME</key>`)
      dirty = true
    }
  }
  if (dirty) {
    const tmp = `${plistPath}.incoming`
    writeFileSync(tmp, plist)
    execFileSync('mv', [tmp, plistPath])
  }
  ctx.kickstart('system/ai.agent-core.runtime')
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
  phase('runtime', true, `plist env ${dirty ? 'patched' : 'already present'}; kickstart; health=ok`)
  return { healthy }
}
