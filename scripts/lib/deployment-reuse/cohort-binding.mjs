import { readBoundRuntime } from './cohort-runtime.mjs'
import { verifyConsumerArtifacts } from './cohort-artifacts.mjs'
// Stateless validation of the existing operation packet/TX binding. No registry,
// permissions, credential contents, provisioning, business calls or recovery writes.
import * as fs from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, resolve } from 'node:path'
const hash = x => createHash('sha256').update(x).digest('hex')
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
const fail = reason => { throw Object.assign(new Error(`cohort binding: ${reason}`), { code: 'FLEET_CONFIG_COHORT_BINDING_INVALID' }) }
function stable(x) {
  if (Array.isArray(x)) return x.map(stable)
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])]))
  return x
}
export const cohortDigest = x => hash(JSON.stringify(stable(x)))
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const canonical = root => join(root, 'shared-credentials/openai-codex/.openai-codex-auth.json')
function ids(list, count, digest) {
  if (!Array.isArray(list) || !list.length || list.length !== count || !list.every(x => typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x))
    || new Set(list).size !== list.length || !equal(list, [...list].sort()) || hash(JSON.stringify(list)) !== digest) fail('exact sorted identity set/digest')
}
export function assertCohortBinding(b, root, expectedDigest) {
  if (!b || b.schema !== 1 || b.deploymentRoot !== root || !Number.isInteger(b.serviceUid) || b.serviceUid < 0) fail('target/schema/principal')
  if (!isAbsolute(b.trustedRoot ?? '') || resolve(b.trustedRoot) !== b.trustedRoot) fail('trusted code root binding')
  ids(b.registryIds, b.registryCount, b.registrySetSha256); ids(b.migrationIds, b.migrationCount, b.migrationSetSha256)
  if (b.migrationCount >= b.registryCount || !b.migrationIds.every(id => b.registryIds.includes(id))) fail('proper migration subset')
  for (const k of ['registrySha256', 'configPreSha256', 'configPostSha256']) if (!hex(b[k])) fail(`missing ${k}`)
  if (!b.consumers || !equal(Object.keys(b.consumers).sort(), b.registryIds)) fail('complete consumer set')
  if (b.routing?.source !== 'runtime_env'
    || !b.routing.globalRoute || !b.routing.runtime) fail('actual routing context/provenance')
  for (const id of b.registryIds) {
    const c = b.consumers[id]
    if (!c || c.readiness !== 'READY' || !['existing', 'normal'].includes(c.provision) || !hex(c.evidenceSha256)
      || !Array.isArray(c.route?.chain) || !c.route.chain.length
      || !Array.isArray(c.pre) || !Array.isArray(c.post)) fail(`consumer evidence ${id}`)
    const source = b.migrationIds.includes(id) ? 'agent_override' : b.routing.source
    if (c.route.source !== source) fail(`route origin ${id}`)
  }
  const digest = cohortDigest(b)
  if (expectedDigest !== undefined && digest !== expectedDigest) fail('immutable packet digest')
  return digest
}
// Bind all dependency bytes, not only the directory inode. Links are bound
// as links; the existing service-identity import probe verifies resolution.
export function dependencyDigest(root) {
  const rows = []
  function visit(path, relative) {
    const st = fs.lstatSync(path)
    const metadata = [st.uid, st.gid, st.mode & 0o7777]
    if (st.isSymbolicLink()) rows.push([relative, 'link', ...metadata, fs.readlinkSync(path)])
    else if (st.isDirectory()) {
      rows.push([relative, 'directory', ...metadata])
      for (const name of fs.readdirSync(path).sort()) visit(join(path, name), join(relative, name))
    } else if (st.isFile() && st.nlink === 1) rows.push([relative, 'file', ...metadata, hash(fs.readFileSync(path))])
    else fail('unsupported dependency entry')
  }
  visit(root, '.')
  return cohortDigest(rows)
}
function checkProfile(rows, route, root) {
  if (!route.chain.some(r => r.provider === 'openai-codex')) return
  const profile = rows.find(o => o.role === 'profile')
  if (profile.kind === 'absent') return // Normal provisioning remains separately BLOCKED until proven.
  const text = fs.readFileSync(profile.path, 'utf8')
  const begin = '# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1'
  const end = '# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1'
  if (text.split(begin).length !== 2 || text.split(end).length !== 2
    || text.indexOf(begin) > text.indexOf(end)) fail('unique managed profile block required')
  const block = text.slice(text.indexOf(begin) + begin.length, text.indexOf(end))
  if (!/^\s*- id: llm-openai-codex\s*\n\s+config:\s*\n/.test(block)) fail('managed profile plugin configuration missing')
  const refs = [...text.matchAll(/^\s*credentialFile:\s*(.+)\s*$/gm)]
  const blockRefs = [...block.matchAll(/^\s*credentialFile:\s*(.+)\s*$/gm)]
  if (refs.length !== 1 || blockRefs.length !== 1) fail('ambiguous effective canonical reference')
  let value
  try { value = JSON.parse(blockRefs[0][1].trim()) } catch { fail('canonical reference must be explicit JSON string') }
  if (value !== canonical(root)) fail('effective profile uses foreign canonical')
}
function checkObservation(o, b, { id, phase, provision } = {}) {
  if (!o || !isAbsolute(o.path ?? '') || resolve(o.path) !== o.path || !['file', 'directory', 'absent'].includes(o.kind)) fail('observation shape')
  const home = id && join(b.deploymentRoot, 'homes', id)
  const fixed = { home, profile: home && join(home, 'profiles/agent-core-production/cordis.patch.yml'),
    provisioning: join(b.trustedRoot, 'app/packages/agent-provisioning/src/index.js'),
    plugin: home && join(home, 'profiles/node_modules/dsh-codex/lib/index.js'), canonical: canonical(b.deploymentRoot) }
  if (Object.hasOwn(fixed, o.role) && o.path !== fixed[o.role]) fail('foreign consumer path')
  let s
  try { s = fs.lstatSync(o.path) } catch (e) { if (e.code !== 'ENOENT') throw e }
  if (o.kind === 'absent') {
    if (s || phase !== 'pre' || provision !== 'normal' || !['home', 'profile', 'plugin'].includes(o.role)) fail('unproven absence/provisioning')
    return
  }
  if (!s || s.isSymbolicLink() || (o.kind === 'file' ? !s.isFile() || s.nlink !== 1 : !s.isDirectory())) fail('missing/unsafe evidence input')
  if (!Number.isInteger(o.uid) || !Number.isInteger(o.gid) || !Number.isInteger(o.mode)
    || s.uid !== o.uid || s.gid !== o.gid || (s.mode & 0o7777) !== o.mode || fs.realpathSync(o.path) !== o.realpath) fail('evidence metadata drift')
  if (o.role === 'canonical') {
    // Metadata only: never hash/read the credential value.
    const parent = fs.lstatSync(dirname(o.path))
    if (o.kind !== 'file' || o.mode !== 0o600 || s.uid !== b.serviceUid || !parent.isDirectory()
      || parent.isSymbolicLink() || (parent.mode & 0o777) !== 0o700 || parent.uid !== b.serviceUid || Object.hasOwn(o, 'sha256')) fail('canonical custody')
  } else if (o.role === 'dependencies' && o.kind === 'directory') {
    if (!hex(o.treeSha256) || dependencyDigest(o.path) !== o.treeSha256) fail('dependency closure drift')
  } else if (o.kind === 'file' && (!hex(o.sha256) || hash(fs.readFileSync(o.path)) !== o.sha256)) fail('evidence content drift')
}
function describeRoute(p) {
  const s = p.subscription
  return { provider: p.provider, model: p.model, routeKind: s ? 'subscription' : 'builtin',
    plugin: s?.plugin ?? 'ABSENT', pluginVersion: s?.pluginVersion ?? 'ABSENT',
    reasoningEffort: s?.reasoningEffort ?? 'ABSENT', credentialFile: s?.credentialFile ?? 'ABSENT',
    providerEnvSha256: p.providerEnv === undefined ? 'ABSENT' : cohortDigest(p.providerEnv) }
}
export function routeSnapshot(loaded, id, routing) {
  const resolved = loaded.resolveChain(id, routing.globalRoute)
  return { source: resolved.override ? 'agent_override' : routing.source, chain: resolved.routes.map(r => describeRoute(r.processConfig)) }
}

export function verifyCohort(b, { root, registrySource, configSource, phase = 'pre', consumerPhase = phase, loaded, defaultGlobalRoute, expectedDigest, consumers = true, runtimePhase = phase, runtimeRead = readBoundRuntime, candidateRoot = b.trustedRoot }) {
  const digest = assertCohortBinding(b, root, expectedDigest)
  if (!['pre', 'post'].includes(phase) || !['pre', 'code-installed', 'post'].includes(consumerPhase)) fail('verification phase')
  const registry = JSON.parse(registrySource), config = JSON.parse(configSource)
  const active = registry.agents.filter(a => a.disabled !== true).map(a => a.id).sort()
  if (!equal(active, b.registryIds) || !equal(Object.keys(config.overrides ?? {}).sort(), b.migrationIds)
    || hash(registrySource) !== b.registrySha256 || hash(configSource) !== b[phase === 'pre' ? 'configPreSha256' : 'configPostSha256']) fail('live set/input drift')
  let runtime
  try { runtime = runtimeRead(b, { phase: runtimePhase, codePhase: consumerPhase === 'code-installed' ? 'post' : phase }) }
  catch { fail('actual runtime source unavailable or changed') }
  if (!runtime?.inputs || !equal({ source: runtime.source, globalRoute: runtime.globalRoute }, { source: b.routing.source, globalRoute: b.routing.globalRoute })) fail('actual runtime route differs')
  const proof = consumers ? verifyConsumerArtifacts(b, { configSource, runtime, phase: consumerPhase, candidateRoot }) : null
  const routes = {}
  for (const id of b.registryIds) {
    const c = b.consumers[id], route = proof ? { source: b.migrationIds.includes(id) ? 'agent_override' : runtime.source, chain: proof.routes[id].map(describeRoute) } : loaded ? routeSnapshot(loaded, id, b.routing) : c.route
    if (!equal(route, c.route)) fail(`effective route drift ${id}`)
    const codex = route.chain.some(r => r.provider === 'openai-codex')
    for (const r of route.chain) if (r.provider === 'openai-codex' && (r.routeKind !== 'subscription'
      || r.plugin !== 'dsh-codex' || r.credentialFile !== canonical(root))) fail('foreign/missing canonical route')
    if (consumers) {
      const rows = consumerPhase === 'code-installed'
        ? c.pre.map(o => ['app', 'harness', 'node-runtime'].some(part => o.path === join(b.trustedRoot, part)
          || o.path.startsWith(join(b.trustedRoot, part) + '/')
          || o.realpath?.startsWith(join(b.trustedRoot, part) + '/')) ? c.post.find(p => p.role === o.role) : o)
        : c[consumerPhase]
      if (rows.some(o => !o)) fail(`missing stage-specific consumer proof ${id}`)
      const roles = rows.map(o => o.role)
      const required = ['home', 'profile', 'dependencies', 'provisioning', ...(codex ? ['plugin', 'canonical'] : [])]
      if (!required.every(role => roles.includes(role)) || new Set(roles).size !== roles.length) fail(`missing consumer proof ${id}`)
      checkProfile(rows, route, root)
      for (const o of rows) checkObservation(o, b, { id, phase: consumerPhase === 'code-installed' ? 'pre' : consumerPhase, provision: c.provision })
    }
    routes[id] = cohortDigest(route)
  }
  return { cohortSha256: digest, migrationCount: b.migrationCount, compatibilityCount: consumers ? b.registryCount : 0,
    consumerPhase, routes, runtimeIdentity: runtime.instance, runtimeInputsSha256: cohortDigest(runtime.inputs), provisioningSha256: proof ? cohortDigest(proof.requirements) : null, businessVerified: false }
}
export function readCohortFile(path) {
  const s = fs.lstatSync(path)
  if (!s.isFile() || s.nlink !== 1 || s.uid !== process.getuid() || (s.mode & 0o777) !== 0o600) fail('private packet custody')
  const parsed = JSON.parse(fs.readFileSync(path))
  return parsed.activation?.cohort ?? parsed.cohort ?? parsed
}
