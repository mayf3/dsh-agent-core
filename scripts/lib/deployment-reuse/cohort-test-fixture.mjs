// Synthetic fixture builder only. Never reads a host registry or credential.
import * as fs from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyCandidateClosure, entryDigests, useRuntimeFixture } from './cohort-runtime-fixture.mjs'
import { AGENT_PROFILE_DEFS } from '../../../packages/agent-provisioning/src/index.js'
export const hash = x => createHash('sha256').update(x).digest('hex')
export function stable(x) {
  if (Array.isArray(x)) return x.map(stable)
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])]))
  return x
}
export const objectHash = x => hash(JSON.stringify(stable(x)))
export function observation(role, path) {
  const s = fs.lstatSync(path)
  return { role, path, kind: s.isDirectory() ? 'directory' : 'file', uid: s.uid, gid: s.gid,
    mode: s.mode & 0o7777, realpath: fs.realpathSync(path),
    ...(s.isFile() && role !== 'canonical' ? { sha256: hash(fs.readFileSync(path)) } : {}) }
}
export function cohortFixture(root, nF = 2, nR = 3, trustedRoot = join(root, 'trusted')) {
  const ids = Array.from({ length: nR }, (_, i) => `agt_generic${String(i).padStart(3, '0')}-fixture`)
  const migrationIds = ids.slice(0, nF), canonical = join(root, 'shared-credentials/openai-codex/.openai-codex-auth.json')
  const config = join(root, 'agent-model-overrides.json'), registry = join(root, 'agents.json')
  const write = (p, value) => { fs.mkdirSync(join(p, '..'), { recursive: true }); fs.writeFileSync(p, value, { mode: 0o600 }) }
  write(registry, JSON.stringify({ version: 1, defaultAgentId: ids[0], agents: ids.map(id => ({ id, name: id, description: null })) }))
  const v2 = { version: 2, routeCatalog: { luna: { routeKind: 'subscription', provider: 'openai-codex',
    model: 'gpt-5.6-luna', plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'bridge-store-bound' } },
    overrides: Object.fromEntries(migrationIds.map(id => [id, { model: { primary: 'luna', fallbacks: [] } }])) }
  write(config, JSON.stringify(v2))
  const v3 = structuredClone(v2); v3.version = 3; v3.routeCatalog.luna.credentialFile = canonical
  write(canonical, 'SYNTHETIC FIXTURE - NO TOKEN'); fs.chmodSync(join(canonical, '..'), 0o700)
  const runtimeContext = join(root, 'synthetic-runtime-context.json')
  const globalRoute = { provider: 'oc-go', model: 'deepseek-v4-flash' }
  copyCandidateClosure(trustedRoot)

  const provisioner = join(trustedRoot, 'app/packages/agent-provisioning/src/index.js'), dependencies = join(root, 'synthetic-dependency-closure.json')
  write(dependencies, '{"synthetic":true}')
  const artifactDir = join(root, 'synthetic-artifacts'), packageRoot = join(artifactDir, 'package')
  const pluginBytes = 'exports.OpenAICodexCredentialStore=class {}; exports.loginOpenAICodex=function(){}; exports.OpenAICodexReauthRequiredError=class {}'
  write(join(packageRoot, 'lib/index.js'), pluginBytes); write(join(packageRoot, 'package.json'), '{"name":"dsh-codex","version":"0.2.3","peerDependencies":{"@deepseek-ai/fixture":"*"}}')
  const scopesRoot = join(artifactDir, 'scopes')
  write(join(scopesRoot, '@deepseek-ai/fixture/index.js'), 'exports.synthetic=true')
  fs.cpSync(scopesRoot, join(packageRoot, 'node_modules'), { recursive: true })
  fs.mkdirSync(join(trustedRoot, 'harness/node_modules/.pnpm/node_modules'), { recursive: true })
  fs.cpSync(scopesRoot, join(trustedRoot, 'harness/node_modules/.pnpm/node_modules'), { recursive: true })
  const pluginArchive = join(artifactDir, 'plugin.tgz'), scopesArchive = join(artifactDir, 'scopes.tgz')
  execFileSync('/usr/bin/tar', ['-czf', pluginArchive, '-C', artifactDir, 'package'])
  execFileSync('/usr/bin/tar', ['-czf', scopesArchive, '-C', scopesRoot, './@deepseek-ai'])
  const pluginHash = hash(fs.readFileSync(pluginArchive)), stamp = join(artifactDir, 'source.json')
  const sourceCommit = '75d98d5b10bb926d53108e49019668c1bde2a9eb'
  write(stamp, JSON.stringify({ version: 2, deploymentRoot: root, sourceCommit, artifactSha256: pluginHash }))
  const artifacts = { sourceCommit, plugin: { path: pluginArchive, sha256: pluginHash }, scopes: { path: scopesArchive, sha256: hash(fs.readFileSync(scopesArchive)) }, sourceStamp: { path: stamp, sha256: hash(fs.readFileSync(stamp)) } }
  const environment = { HOME: join(root, 'service-home'), DSH_AGENT_PROVIDER: globalRoute.provider, DSH_AGENT_MODEL: globalRoute.model,
    DSH_HARNESS_ROOT: join(trustedRoot, 'harness'), DSH_SETTINGS_SOURCE: null, DSH_CODEX_PACKAGE_TARBALL: pluginArchive,
    DSH_CODEX_SOURCE_STAMP: stamp, DSH_AGENT_CHILD_UID: null, DSH_AGENT_CHILD_GID: null, DSH_AGENT_SPAWN_HELPER: null }
  const program = join(trustedRoot, 'node-runtime/bin/node')
  const runtime = { target: 'system/ai.agent-core.runtime', user: 'fixture-service', group: 'fixture-service', gid: process.getgid(), home: environment.HOME,
    preInstance: { pid: 654321, uid: process.getuid(), gid: process.getgid(), started: 'Sun Oct  4 13:00:00 2037', program },
    inputs: { program, arguments: [program, join(trustedRoot, 'app/scripts/production-runtime.mjs'), '--root', root], cwd: join(trustedRoot, 'app'),
      user: 'fixture-service', group: 'fixture-service', plist: '/Library/LaunchDaemons/ai.agent-core.runtime.plist', environment },
    entryDigests: { pre: entryDigests(trustedRoot), post: entryDigests(trustedRoot) } }
  write(runtimeContext, JSON.stringify({ runtime, phase: 'pre' })); useRuntimeFixture(runtimeContext)
  const consumers = {}
  const chain = [{ provider: 'openai-codex', model: 'gpt-5.6-luna', routeKind: 'subscription',
    plugin: 'dsh-codex', pluginVersion: '0.2.3', reasoningEffort: 'ABSENT', credentialFile: canonical,
    providerEnvSha256: 'ABSENT' }]
  for (const id of ids) {
    const home = join(root, 'homes', id), profile = join(home, 'profiles/agent-core-production/cordis.patch.yml')
    const plugin = join(home, 'profiles/node_modules/dsh-codex/lib/index.js')
    const definition = AGENT_PROFILE_DEFS['agent-core-production']
    write(join(home, 'profiles/agent-core-production/package.json'), JSON.stringify({ dsh: { profile: { bundles: ['dsh-codex'] } } }))
    for (const [name, target] of Object.entries(definition.farmLinks)) {
      const link = join(home, 'profiles/node_modules/@agent-core', name); fs.mkdirSync(join(link, '..'), { recursive: true }); fs.symlinkSync(join(trustedRoot, 'app', target), link)
    }
    fs.mkdirSync(join(home, 'profiles/node_modules/dsh-codex'), { recursive: true }); fs.cpSync(packageRoot, join(home, 'profiles/node_modules/dsh-codex'), { recursive: true }); fs.cpSync(scopesRoot, join(home, 'profiles/node_modules/dsh-codex/node_modules'), { recursive: true })
    write(profile, `# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n- id: llm-openai-codex\n  config:\n    credentialFile: "${canonical}"\n# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n`); write(plugin, 'exports.OpenAICodexCredentialStore=class {}; exports.loginOpenAICodex=function(){}; exports.OpenAICodexReauthRequiredError=class {}')
    const rows = [observation('home', home), observation('profile', profile), observation('plugin', plugin),
      observation('canonical', canonical), observation('provisioning', provisioner), observation('dependencies', dependencies)]
    consumers[id] = { readiness: 'READY', provision: 'existing', route: { source: migrationIds.includes(id) ? 'agent_override' : 'runtime_env', chain: migrationIds.includes(id) ? chain : [{ provider: globalRoute.provider, model: globalRoute.model, routeKind: 'builtin', plugin: 'ABSENT', pluginVersion: 'ABSENT', reasoningEffort: 'ABSENT', credentialFile: 'ABSENT', providerEnvSha256: 'ABSENT' }] },
      pre: rows, post: rows, evidenceSha256: hash('synthetic existing compatibility evidence') }
  }
  const cohort = { schema: 1, deploymentRoot: root, trustedRoot, serviceUid: process.getuid(),
    registryIds: ids, migrationIds, registryCount: ids.length, migrationCount: migrationIds.length,
    registrySetSha256: hash(JSON.stringify(ids)), migrationSetSha256: hash(JSON.stringify(migrationIds)),
    registrySha256: hash(fs.readFileSync(registry)), configPreSha256: hash(fs.readFileSync(config)),
    configPostSha256: hash(JSON.stringify(v3, null, 2) + '\n'),
    artifacts, provisioning: { profile: 'agent-core-production', definition: AGENT_PROFILE_DEFS['agent-core-production'] },
    routing: { source: 'runtime_env', globalRoute, runtime }, consumers }
  return { root, config, registry, ids, migrationIds, canonical, runtimeContext, cohort, packageRoot, scopesRoot, before: fs.readFileSync(config), registryBefore: fs.readFileSync(registry) }
}
