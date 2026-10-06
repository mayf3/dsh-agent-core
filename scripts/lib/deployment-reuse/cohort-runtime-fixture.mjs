// Test-only launchd/ps/plist stand-in. Never reaches a host service/process.
import fs from 'node:fs'
import cp from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const realExec = cp.execFileSync
const fixtureFile = fileURLToPath(import.meta.url)
const repo = resolve(dirname(fixtureFile), '../../..')
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const error = (status, stderr = '') => Object.assign(new Error('synthetic command refusal'), { status, stderr, stdout: '' })
cp.execFileSync = function(file, args, options) {
  if (!['/bin/launchctl', '/bin/ps', '/usr/bin/plutil'].includes(file)) return realExec(file, args, options)
  const path = process.env.B7_COHORT_RUNTIME
  if (!path) throw Error('fixture command cannot query host')
  const x = JSON.parse(fs.readFileSync(path)), r = x.runtime
  const instance = x.phase === 'post' ? { ...r.preInstance, pid: 654322, started: 'Sun Oct  4 14:00:00 2037' } : r.preInstance
  if (file === '/bin/launchctl') {
    if (x.phase === 'quiesced') throw error(113, 'Could not find service')
    const j = r.inputs, env = Object.entries(j.environment).filter(([,v]) => v !== null).map(([k,v]) => `\t\t${k} => ${v}`).join('\n')
    return `system/ai.agent-core.runtime = {\n path = ${j.plist}\n state = running\n program = ${j.program}\n working directory = ${j.cwd}\n username = ${j.user}\n group = ${j.group}\n pid = ${instance.pid}\n arguments = {\n${j.arguments.join('\n')}\n }\n environment = {\n${env}\n }\n}\n`
  }
  if (file === '/bin/ps') {
    if (x.phase === 'quiesced') throw error(1)
    return `${instance.pid} ${instance.uid} ${instance.gid} ${instance.started} ${instance.program}\n`
  }
  const j = x.plistInputs ?? r.inputs
  return JSON.stringify({ Label: 'ai.agent-core.runtime', Program: j.program, ProgramArguments: j.arguments, WorkingDirectory: j.cwd,
    UserName: j.user, GroupName: j.group, EnvironmentVariables: Object.fromEntries(Object.entries(j.environment).filter(([,v]) => v !== null)) })
}
syncBuiltinESMExports()
export function useRuntimeFixture(path) {
  process.env.B7_COHORT_RUNTIME = path
  process.env.NODE_OPTIONS = `--import=${fixtureFile}`
}
export function runtimePhase(f, phase) {
  const path = f.runtimeContext ?? f.cohort?.runtimeContext
  if (!path) return
  const x = JSON.parse(fs.readFileSync(path)); x.phase = phase; fs.writeFileSync(path, JSON.stringify(x))
}
export function copyCandidateClosure(trusted) {
  const done = new Set()
  function copy(src) {
    if (done.has(src)) return; done.add(src)
    const dest = join(trusted, 'app', relative(repo, src)), bytes = fs.readFileSync(src, 'utf8')
    fs.mkdirSync(dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes)
    for (const m of bytes.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) copy(resolve(dirname(src), m[1]))
  }
  for (const p of ['packages/production-runtime/src/model-overrides.js', 'packages/agent-provisioning/src/index.js', 'packages/agent-definition/src/definition.js']) copy(join(repo, p))
  for (const p of ['scripts/production-runtime.mjs','packages/production-runtime/src/entry.js','packages/production-runtime/src/compose.js','profile-production/package.json','profile-production/cordis.patch.yml']) {
    const dest=join(trusted,'app',p);fs.mkdirSync(dirname(dest),{recursive:true});fs.copyFileSync(join(repo,p),dest)
  }
  fs.writeFileSync(join(trusted,'app/package.json'), '{"type":"module"}')
  for (const dir of ['bundle-demo','packages/owner-guard','packages/demo-server','bundle-memory','packages/agent-memory','bundle-agent-switch','packages/agent-switch','packages/workspace-bootstrap','bundle-broker','packages/broker']) fs.mkdirSync(join(trusted,'app',dir),{recursive:true})
  fs.mkdirSync(join(trusted,'node-runtime/bin'),{recursive:true});fs.writeFileSync(join(trusted,'node-runtime/bin/node'),'synthetic node')
  fs.mkdirSync(join(trusted,'harness/apps/cli/lib'),{recursive:true});fs.writeFileSync(join(trusted,'harness/apps/cli/lib/bin.js'),'// synthetic harness')
  fs.writeFileSync(join(trusted,'harness/package.json'),'{"version":"0.1.0-rc.8"}')
  fs.writeFileSync(join(trusted,'harness/.source-stamp'),JSON.stringify({commit:'514ab7b0029141b88c807704764d0d3e1eea1da4',dirtyCount:0}))
}
export const entryDigests = trusted => Object.fromEntries(['app/scripts/production-runtime.mjs','app/packages/production-runtime/src/entry.js','app/packages/production-runtime/src/compose.js','app/packages/production-runtime/src/model-overrides.js','app/packages/agent-provisioning/src/shared-codex.js'].map(p=>[p,hash(join(trusted,p))]))
