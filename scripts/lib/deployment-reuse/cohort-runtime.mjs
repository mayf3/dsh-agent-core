// Read the fixed launchd source. No packet-authored route/context file is evidence.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
const TARGET = 'system/ai.agent-core.runtime'
const PLIST = '/Library/LaunchDaemons/ai.agent-core.runtime.plist'
const KEYS = ['HOME', 'DSH_AGENT_PROVIDER', 'DSH_AGENT_MODEL', 'DSH_HARNESS_ROOT', 'DSH_SETTINGS_SOURCE',
  'DSH_CODEX_PACKAGE_TARBALL', 'DSH_CODEX_SOURCE_STAMP', 'DSH_AGENT_CHILD_UID', 'DSH_AGENT_CHILD_GID', 'DSH_AGENT_SPAWN_HELPER']
const FORBIDDEN = ['NODE_OPTIONS', 'NODE_PATH', 'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH']
const fail = s => { throw Object.assign(new Error(`cohort runtime: ${s}`), { code: 'FLEET_CONFIG_COHORT_BINDING_INVALID' }) }
const stable = x => x && typeof x === 'object' ? (Array.isArray(x) ? x.map(stable) : Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])]))) : x
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const hash = b => createHash('sha256').update(b).digest('hex')
const runDefault = (file, args) => execFileSync(file, args, { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
function selected(env) { return Object.fromEntries(KEYS.map(k => [k, Object.hasOwn(env, k) ? env[k] : null])) }
export function parseLaunchd(text) {
  const stack = [], fields = {}, arguments_ = [], environment = {}, other = {}
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (s.endsWith('= {')) { stack.push(s.slice(0, -3).trim()); continue }
    if (s === '}') { stack.pop(); continue }
    const parent = stack.at(-1)
    if (stack.length === 2 && parent === 'arguments') arguments_.push(s)
    else if (stack.length === 2 && /environment$/.test(parent)) {
      const m = /^([^=]+?)\s*=>\s*(.*)$/.exec(s)
      if (m && [...KEYS, ...FORBIDDEN].includes(m[1].trim())) {
        const target = parent === 'environment' ? environment : other
        if (Object.hasOwn(target, m[1].trim())) fail('duplicate environment key')
        target[m[1].trim()] = m[2]
      }
    } else if (stack.length === 1) {
      const m = /^([^=]+?)\s*=\s*(.*)$/.exec(s)
      if (m && ['path', 'program', 'working directory', 'username', 'group', 'pid', 'state'].includes(m[1].trim())) fields[m[1].trim()] = m[2]
    }
  }
  if (stack.length || !fields.pid || !arguments_.length) fail('incomplete loaded job')
  if (KEYS.some(k => Object.hasOwn(other, k) && !Object.hasOwn(environment, k))) fail('inherited runtime input is not proven explicit')
  if (FORBIDDEN.some(k => Object.hasOwn(environment, k) || Object.hasOwn(other, k))) fail('unproven runtime preload environment')
  // This fixed operation has explicit routing and HOME. Missing values are
  // unknown, never inferred from the helper's environment or a default block.
  if (['HOME', 'DSH_AGENT_PROVIDER', 'DSH_AGENT_MODEL', 'DSH_HARNESS_ROOT'].some(k => !environment[k])) fail('explicit runtime input absent/unknown')
  return { program: fields.program, arguments: arguments_, cwd: fields['working directory'],
    user: fields.username, group: fields.group, plist: fields.path, pid: Number(fields.pid), environment: selected(environment) }
}
function processIdentity(run, pid) {
  const text = run('/bin/ps', ['-p', String(pid), '-o', 'pid=', '-o', 'uid=', '-o', 'gid=', '-o', 'lstart=', '-o', 'comm=']).trim()
  const m = /^(\d+)\s+(\d+)\s+(\d+)\s+(.+?\d{4})\s+(\/.*)$/.exec(text)
  if (!m || Number(m[1]) !== pid || !Number.isFinite(Date.parse(m[4]))) fail('process instance unavailable')
  return { pid, uid: Number(m[2]), gid: Number(m[3]), started: m[4].trim(), program: m[5] }
}
function inputs(job) { const { pid, ...rest } = job; return rest }
function plistInputs(run) {
  const p = JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', PLIST]))
  if (p.Label !== TARGET.slice(7) || FORBIDDEN.some(k => Object.hasOwn(p.EnvironmentVariables ?? {}, k))) fail('plist target/preload')
  return { program: p.Program ?? p.ProgramArguments?.[0], arguments: p.ProgramArguments, cwd: p.WorkingDirectory,
    user: p.UserName, group: p.GroupName, plist: PLIST, environment: selected(p.EnvironmentVariables ?? {}) }
}
function assertEntry(b, job) {
  const r = b.routing.runtime, args = job.arguments
  if (r.target !== TARGET || job.plist !== PLIST || job.program !== join(b.trustedRoot, 'node-runtime/bin/node')
    || args?.[0] !== job.program || args[1] !== join(b.trustedRoot, 'app/scripts/production-runtime.mjs')
    || job.cwd !== join(b.trustedRoot, 'app') || job.user !== r.user || job.group !== r.group
    || job.environment.HOME !== r.home || job.environment.DSH_HARNESS_ROOT !== join(b.trustedRoot, 'harness')) fail('fixed entry/principal/root')
  let roots = 0
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--native-arm64') continue
    if (!['--root', '--catchup', '--tick-ms', '--concurrency'].includes(args[i]) || i + 1 >= args.length) fail('unexpected entry argument')
    const key = args[i++], value = args[i]
    if (key === '--root') { if (value !== b.deploymentRoot) fail('deployment root'); roots++ }
    else if (!/^\d+$/.test(value)) fail('entry argument value')
  }
  if (roots !== 1) fail('exact root argument required')
  if (!equal(inputs(job), r.inputs)) fail('loaded launch inputs drift')
}
export function readBoundRuntime(b, { phase = 'pre', codePhase = phase, run = runDefault } = {}) {
  const r = b.routing?.runtime
  if (!r?.preInstance || !['pre', 'quiesced', 'post'].includes(phase)) fail('missing runtime source binding')
  let observation
  if (phase === 'quiesced') {
    try { run('/bin/launchctl', ['print', TARGET]); fail('job still loaded') } catch (e) {
      if (!Number.isInteger(e.status) || e.status === 0 || !/Could not find (?:specified )?service|service not found/i.test(String(e.stderr ?? ''))) throw e
    }
    try {
      const current = processIdentity(run, r.preInstance.pid)
      if (equal(current, r.preInstance)) fail('old instance still exists')
      // A different start identity is a reused PID, not this transaction's worker.
    } catch (e) {
      if (e.status !== 1 || String(e.stdout ?? '').trim() || String(e.stderr ?? '').trim()) throw e
    }
    const job = { ...plistInputs(run) }; assertEntry(b, job)
    observation = { phase, inputs: inputs(job), instance: null }
  } else {
    const first = parseLaunchd(run('/bin/launchctl', ['print', TARGET]))
    const p1 = processIdentity(run, first.pid)
    const second = parseLaunchd(run('/bin/launchctl', ['print', TARGET]))
    const p2 = processIdentity(run, second.pid)
    if (!equal(first, second) || !equal(p1, p2)) fail('instance changed during source read')
    assertEntry(b, first)
    if (!equal(inputs(first), plistInputs(run))) fail('loaded job differs from next bootstrap plist')
    if (p1.uid !== b.serviceUid || p1.gid !== r.gid || p1.program !== first.program) fail('actual service identity')
    if (phase === 'pre' && !equal(p1, r.preInstance)) fail('pre instance drift')
    if (phase === 'post' && equal(p1, r.preInstance)) fail('candidate runtime was not restarted')
    observation = { phase, inputs: inputs(first), instance: p1 }
  }
  const entries = r.entryDigests?.[codePhase]
  const required = ['app/scripts/production-runtime.mjs', 'app/packages/production-runtime/src/entry.js',
    'app/packages/production-runtime/src/compose.js', 'app/packages/production-runtime/src/model-overrides.js', 'app/packages/agent-provisioning/src/shared-codex.js']
  if (!entries || !required.every(p => /^[a-f0-9]{64}$/.test(entries[p] ?? ''))) fail('entry generation unbound')
  for (const p of required) {
    const path = join(b.trustedRoot, p), s = fs.lstatSync(path)
    if (!s.isFile() || s.isSymbolicLink() || hash(fs.readFileSync(path)) !== entries[p]) fail('entry generation drift')
    if (observation.instance && s.mtimeMs >= Date.parse(observation.instance.started)) fail('entry newer than running instance')
  }
  const env = observation.inputs.environment
  return { ...observation, source: 'runtime_env', globalRoute: { provider: env.DSH_AGENT_PROVIDER, model: env.DSH_AGENT_MODEL } }
}
