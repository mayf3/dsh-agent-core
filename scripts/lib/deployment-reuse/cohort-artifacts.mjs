// Read-only consumer closure proof using the candidate's actual loader and
// normal provisioning preconditions. Temporary config is synthetic input only.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join, dirname, relative } from 'node:path'
import { tmpdir } from 'node:os'
const hash = x => createHash('sha256').update(x).digest('hex')
const fail = s => { throw Object.assign(new Error(`cohort artifact: ${s}`), { code: 'FLEET_CONFIG_COHORT_BINDING_INVALID' }) }
const program = String.raw`
import fs from 'node:fs'; import {join} from 'node:path'; import {pathToFileURL} from 'node:url';
const x=JSON.parse(fs.readFileSync(0,'utf8'));
const loader=await import(pathToFileURL(join(x.code,'packages/production-runtime/src/model-overrides.js')));
const provision=await import(pathToFileURL(join(x.code,'packages/agent-provisioning/src/index.js')));
const artifact=await import(pathToFileURL(join(x.code,'packages/agent-provisioning/src/plugin-artifact.js')));
const packageJson=artifact.inspectArtifactComposition(x.artifacts.plugin.path,x.artifacts.scopes.path);
const artifactContext=loader.createModelArtifactContext(x.root);
const loaded=loader.loadAgentModelOverrides(x.config,x.ids,{deploymentRoot:x.root,artifactContext});
const requirements={}, routes={};
for(const id of x.ids){
 const chain=loaded.resolveChain(id,x.globalRoute).routes;
 routes[id]=chain.map(r=>r.processConfig);
 for(const r of chain){
  const s=r.processConfig.subscription;if(!s)continue;
  artifact.resolvePluginPeerLinks(packageJson,join(x.root,'homes',id,'profiles'),x.harness,{plugin:s.plugin,version:s.pluginVersion,dshVersion:s.dshVersion});
  const key=JSON.stringify(s);if(requirements[key])continue;
  if(s.packageArtifact!==x.artifacts.plugin.path||s.sourceStamp!==x.artifacts.sourceStamp.path)throw Error('runtime provisioning artifact paths differ');
  if(s.artifactSha256!==x.artifacts.plugin.sha256||s.sourceCommit!==x.artifacts.sourceCommit)throw Error('normal provisioning pin differs from G2 artifact');
  provision.verifyPluginProvisioningInputs({...s,version:s.pluginVersion},{packageArtifact:s.packageArtifact,sourceStamp:s.sourceStamp,harnessRoot:x.harness,deploymentRoot:x.root});
  requirements[key]=s;
 }
}
const definition=provision.AGENT_PROFILE_DEFS['agent-core-production'];
if(!definition?.repoDir||!definition.farmLinks)throw Error('actual profile definition missing');
for(const file of ['package.json','cordis.patch.yml'])fs.accessSync(join(x.code,definition.repoDir,file),fs.constants.R_OK);
fs.accessSync(join(x.harness,'apps/cli/lib/bin.js'),fs.constants.R_OK);
const payload={};
for(const id of x.ids){
 if(!routes[id].some(r=>r.subscription))continue;
 // F old plugin is not expected to equal the candidate until after wiring.
 if(x.phase!=='post'&&x.migrationIds.includes(id))continue;
 const root=join(x.root,'homes',id,'profiles/node_modules/dsh-codex');
 if(!artifact.installedArtifactMatches(root,x.artifacts.plugin.path,undefined,{dependencyArtifact:x.artifacts.scopes.path}))throw Error('installed plugin/dependency payload differs '+id);
 payload[id]=true;
}
process.stdout.write(JSON.stringify({requirements:Object.values(requirements),definition,payload,routes}));
`
export function verifyConsumerArtifacts(b, { configSource, runtime, phase = 'pre', candidateRoot = b.trustedRoot } = {}) {
  const app = typeof candidateRoot === 'string' ? join(candidateRoot, 'app') : candidateRoot.app
  const harness = typeof candidateRoot === 'string' ? join(candidateRoot, 'harness') : candidateRoot.harness
  const a = b.artifacts
  if (!a || !/^[a-f0-9]{40}$/.test(a.sourceCommit ?? '')) fail('accepted artifacts missing')
  for (const key of ['plugin', 'scopes', 'sourceStamp']) {
    const o = a[key], s = o?.path && fs.lstatSync(o.path)
    if (!s?.isFile() || s.isSymbolicLink() || s.nlink !== 1 || !/^[a-f0-9]{64}$/.test(o.sha256 ?? '')
      || hash(fs.readFileSync(o.path)) !== o.sha256) fail(`accepted ${key} artifact drift`)
  }
  const post = JSON.parse(configSource)
  if (post.version === 2) {
    post.version = 3
    for (const r of Object.values(post.routeCatalog ?? {})) if (r.provider === 'openai-codex' && r.routeKind === 'subscription' && r.credentialFile === undefined)
      r.credentialFile = join(b.deploymentRoot, 'shared-credentials/openai-codex/.openai-codex-auth.json')
  }
  const bytes = JSON.stringify(post, null, 2) + '\n'
  if (hash(bytes) !== b.configPostSha256) fail('approved v3 validation image differs')
  const scratch = fs.mkdtempSync(join(tmpdir(), 'b7-consumer-proof-'))
  let proof
  try {
    const config = join(scratch, 'config.json'); fs.writeFileSync(config, bytes, { mode: 0o600 })
    const environment = Object.fromEntries(Object.entries(runtime.inputs.environment).filter(([, v]) => v !== null))
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', program], {
      input: JSON.stringify({ code: app, harness, root: b.deploymentRoot, config, ids: b.registryIds,
        migrationIds: b.migrationIds, globalRoute: runtime.globalRoute, artifacts: a, phase }),
      env: { PATH: '/usr/bin:/bin', ...environment }, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    proof = JSON.parse(output)
  } catch { fail('actual loader/provisioning/payload check failed') }
  finally { fs.rmSync(scratch, { recursive: true, force: true }) }
  const expected = b.provisioning
  if (!expected || expected.profile !== 'agent-core-production'
    || JSON.stringify(proof.definition) !== JSON.stringify(expected.definition)) fail('candidate provisioning profile differs')
  // Fixed farm targets must resolve through the same live app path that this
  // transaction replaces. Check candidate targets independently before swaps.
  for (const [id, c] of Object.entries(b.consumers)) {
    const home = join(b.deploymentRoot, 'homes', id), farm = join(home, 'profiles/node_modules')
    const pkg = JSON.parse(fs.readFileSync(join(home, 'profiles/agent-core-production/package.json')))
    for (const [name, rel] of Object.entries(proof.definition.farmLinks)) {
      if (relative(app, join(app, rel)).startsWith('..')) fail('foreign candidate farm target')
      fs.accessSync(join(app, rel), fs.constants.R_OK)
      if (fs.realpathSync(join(farm, '@agent-core', name)) !== fs.realpathSync(join(b.trustedRoot, 'app', rel))) fail('foreign home farm target')
    }
    if (proof.routes[id].some(r => r.subscription) && !pkg?.dsh?.profile?.bundles?.includes('dsh-codex')) fail('plugin absent from actual profile bundles')
  }
  return proof
}
