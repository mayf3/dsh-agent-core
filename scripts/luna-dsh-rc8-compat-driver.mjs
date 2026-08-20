#!/usr/bin/env node
/**
 * LUNA_DSH_RC8_VERSION_ALIGNMENT_V1 — isolated real compatibility driver.
 *
 * Proves (or refutes) that dsh-codex@0.2.3 loads and runs on the REAL
 * production DSH harness build 0.1.0-rc.8, using ONLY:
 *   - the real rc.8 harness checkout (read-only),
 *   - a temporary DSH_HOME / workspace / operator HOME,
 *   - the real dsh-codex@0.2.3 npm artifact (npm pack, registry shasum verified),
 *   - a FIXTURE OAuth credential (fake tokens — never the production store),
 *   - a local HTTP observer as the openai-codex provider baseURL.
 *
 * It never touches the production agent-core checkout on disk (all imports
 * are read-only; provisioning writes only under the temp root), never sends
 * Feishu messages, never writes a Luna override, and never reads the real
 * credential file.
 *
 * Usage: node scripts/luna-dsh-rc8-compat-driver.mjs
 */

import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Execution coordinates (frozen by the investigation preflight).
const PROD_REPO = '/Users/yanfenma/workspace/project/production-dsh-agent-core'
const HARNESS = '/Users/yanfenma/workspace/github/deepseek-harness'
const AGENT_CORE_MAIN = '34d7c73456f2b177b8ad042e67359bc86fae8861'
const CANDIDATE = Object.freeze({
  dshVersion: '0.1.0-rc.8',
  dshCommit: '514ab7b0029141b88c807704764d0d3e1eea1da4',
  plugin: 'dsh-codex',
  pluginVersion: '0.2.3',
  registryShasum: '010fa8dd4ad9d5d38f36052d7be07bd143282d95',
  // npm pack (same npm) reproduces byte-for-byte the artifact the accepted
  // implementation round froze in chatgpt-subscription-real.test.js.
  frozenArtifactSha256: '8c3d4e3418c8e267a7b61dc4ad4cd982eaf1c1ec93a4e580961e0292579c23dc',
  provider: 'openai-codex',
  model: 'gpt-5.6-luna',
})

// Read-only imports of the EXACT production code (bit-identical to 34d7c73).
const { provisionAgentHome, readHarnessIdentity } = await import(
  `${PROD_REPO}/packages/agent-provisioning/src/index.js`
)
const { AgentProcess } = await import(`${PROD_REPO}/packages/agent-router/src/process.js`)

const results = []
let failed = 0
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) })
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${String(detail).slice(0, 400)}` : ''}`)
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// ---------------------------------------------------------------- preflight
const identity = readHarnessIdentity(HARNESS)
check('A1 harness identity = candidate pin',
  identity.version === CANDIDATE.dshVersion && identity.commit === CANDIDATE.dshCommit,
  `${identity.version} @ ${identity.commit}`)
const prodHead = execFileSync('git', ['-C', PROD_REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const prodDirty = execFileSync('git', ['-C', PROD_REPO, 'status', '--porcelain'], { encoding: 'utf8' })
check('A2 production agent-core = 34d7c73 clean', prodHead === AGENT_CORE_MAIN && prodDirty === '')
check('A3 node = v25.6.1 exact', process.version === 'v25.6.1', process.version)

// ------------------------------------------------- real plugin artifact
const root = mkdtempSync(join(tmpdir(), 'luna-rc8-compat-'))
const tarball = join(root, 'dsh-codex-0.2.3.tgz')
execFileSync('npm', ['pack', 'dsh-codex@0.2.3', '--pack-destination', root], { encoding: 'utf8' })
const packed = readFileSync(tarball)
check('A4 packed artifact sha256 = accepted-round frozen artifact', sha256(packed) === CANDIDATE.frozenArtifactSha256, sha256(packed).slice(0, 16))

// Same-code proof: packed lib byte-identical to the production-installed plugin.
const installed = '/Users/yanfenma/.agent-core/homes/agt_cto-agent/profiles/node_modules/dsh-codex'
const packList = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n')
const libFiles = packList.filter((f) => /^package\/lib\/[^/]+\.js$/.test(f))
let byteIdentical = 0
for (const f of libFiles) {
  const name = f.replace(/^package\//, '')
  const packedBuf = execFileSync('tar', ['-xzf', tarball, '-O', f])
  if (sha256(packedBuf) === sha256(readFileSync(join(installed, name)))) byteIdentical += 1
}
check('A5 packed lib == installed lib (byte-identical)', byteIdentical === libFiles.length && libFiles.length > 0,
  `${byteIdentical}/${libFiles.length} files`)

// ------------------------------------------------------------ temp layout
const operatorHome = join(root, 'operator-home')
const home = join(root, 'agent-home')
const workspace = join(root, 'workspace')
mkdirSync(operatorHome, { recursive: true, mode: 0o700 })
mkdirSync(workspace, { recursive: true })

// Local network observer = a plain HTTP PROXY on an ephemeral port that
// records every CONNECT target (and plain-HTTP request), then refuses the
// tunnel. Pointing the target child's HTTP(S)_PROXY at it — instead of the
// real ClashX — keeps the whole compatibility run LOCAL: the plugin's
// chatgpt.com fetch/WebSocket reaches only this observer, no real network.
const observed = []
const observer = createServer((req, res) => {
  observed.push({ kind: 'http', method: req.method, url: req.url })
  res.writeHead(401, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'fixture observer: unauthorized (expected)' } }))
})
observer.on('connect', (req, socket) => {
  observed.push({ kind: 'connect', target: req.url })
  socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
  socket.end()
  socket.destroy()
})
await new Promise((resolve) => observer.listen(0, '127.0.0.1', resolve))
const observerPort = observer.address().port

// Settings mirror the production target home EXACTLY in shape: NO
// openai-codex entry — the plugin self-registers the provider and owns its
// chatgpt.com base URL (verified empirically: a settings baseURL entry does
// NOT redirect the adapter-registered model).
const settingsSource = join(root, 'settings.yaml')
writeFileSync(settingsSource, [
  'llm-pi-ai:',
  '  providers:',
  '    oc-go:',
  '      displayName: oc-go',
  '      apiKeyEnv: OC_GO_API_KEY',
  '      api: openai-completions',
  '      baseURL: http://127.0.0.1:9/no-network-test',
  '      models:',
  '        - id: deepseek-v4-flash',
  'agent-default-model:',
  '  provider: oc-go',
  '  model: deepseek-v4-flash',
  'permission:',
  '  defaultPreset: danger-full-access',
  '',
].join('\n'), 'utf8')

const envSnapshot = (({ HOME, DSH_SETTINGS_SOURCE, DSH_HARNESS_ROOT, DSH_AGENT_PROVIDER, DSH_AGENT_MODEL, OPENAI_API_KEY }) =>
  ({ HOME, DSH_SETTINGS_SOURCE, DSH_HARNESS_ROOT, DSH_AGENT_PROVIDER, DSH_AGENT_MODEL, OPENAI_API_KEY }))(process.env)
process.env.HOME = operatorHome
process.env.DSH_SETTINGS_SOURCE = settingsSource
process.env.DSH_HARNESS_ROOT = HARNESS
delete process.env.OPENAI_API_KEY
delete process.env.DSH_AGENT_PROVIDER
delete process.env.DSH_AGENT_MODEL

const processes = []
async function shutdownAll() {
  for (const proc of processes.reverse()) await proc.shutdown(10_000).catch(() => {})
  observer.close()
  for (const [k, v] of Object.entries(envSnapshot)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

// ---------------------------------------------- B real provisioning (rc.8)
let provisioned = false
try {
  provisionAgentHome(home, workspace, {
    profile: 'agent-core-production',
    subscription: {
      plugin: CANDIDATE.plugin,
      pluginVersion: CANDIDATE.pluginVersion,
      dshVersion: CANDIDATE.dshVersion,
      dshCommit: CANDIDATE.dshCommit,
      credentialFile: '.openai-codex-auth.json',
      packageArtifact: tarball,
    },
  })
  provisioned = true
} catch (error) {
  check('B1 provisionAgentHome on rc.8', false, error.message)
}
if (provisioned) {
  check('B1 provisionAgentHome on rc.8', true)
  const farm = join(home, 'profiles', 'node_modules')
  const pkg = JSON.parse(readFileSync(join(farm, 'dsh-codex', 'package.json'), 'utf8'))
  check('B2 installed plugin = 0.2.3', pkg.version === CANDIDATE.pluginVersion)
  const profilePkg = JSON.parse(readFileSync(join(home, 'profiles', 'agent-core-production', 'package.json'), 'utf8'))
  check('B3 profile bundles include dsh-codex', (profilePkg.dsh?.profile?.bundles ?? []).includes('dsh-codex'))
  check('B4 peers resolve from farm',
    existsSync(join(farm, '@earendil-works', 'pi-ai', 'package.json'))
    && existsSync(join(farm, '@deepseek-ai', 'cordis', 'package.json'))
    && existsSync(join(farm, '@deepseek-ai', 'dsh-llm-pi-ai', 'package.json')))
}

// Same four-key shape as the production providerEnv allowlist, but the
// proxies point at the LOCAL observer so no real network is reachable.
const providerEnv = Object.freeze({
  HTTP_PROXY: `http://127.0.0.1:${observerPort}`,
  HTTPS_PROXY: `http://127.0.0.1:${observerPort}`,
  NO_PROXY: 'localhost,127.0.0.1,::1',
  NODE_USE_ENV_PROXY: '1',
})

function boot() {
  const proc = new AgentProcess({
    agentId: 'agt_luna_rc8_compat_probe',
    home,
    workspace,
    profile: 'agent-core-production',
    provider: CANDIDATE.provider,
    model: CANDIDATE.model,
    omitEnv: ['OPENAI_API_KEY'],
    providerEnv,
    env: { DSH_AGENT_ID: 'agt_luna_rc8_compat_probe' },
    log: { log() {}, error() {} },
  })
  processes.push(proc)
  proc.spawn()
  return proc
}

async function childEnvProbe(pid) {
  try {
    return execFileSync('ps', ['eww', String(pid)], { encoding: 'utf8' })
  } catch {
    return ''
  }
}

try {
  // ------------------------------------------------------ C first boot
  const first = boot()
  try {
    await first.ready(90_000)
  } catch (error) {
    check('C0 child boot diagnostics', false,
      `pid=${first.pid} exit=${JSON.stringify(first.exit)} stderr=${JSON.stringify(first.stderr.slice(-400))}`)
    throw error
  }
  check('C1 initialize route', JSON.stringify(first.initializeEvidence?.route)
    === JSON.stringify({ provider: CANDIDATE.provider, model: CANDIDATE.model }),
    JSON.stringify(first.initializeEvidence?.route))
  check('C2 plugin service openAICodex', first.initializeEvidence?.pluginServices?.openAICodex === true)
  check('C3 provider registered', (first.initializeEvidence?.registeredProviders ?? []).includes(CANDIDATE.provider),
    (first.initializeEvidence?.registeredProviders ?? []).join(','))

  // Child env isolation evidence (live process, same spawn path as production).
  const envText = await childEnvProbe(first.pid)
  const four = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'NODE_USE_ENV_PROXY']
    .every((k) => envText.includes(`${k}=`))
  check('C5 child env: four providerEnv keys present, OPENAI_API_KEY absent',
    four && !/(^|\s)OPENAI_API_KEY=/.test(envText))

  // Turn 1 — no credential file: must fail at the credential boundary with
  // the plugin loaded and the provider registered (never a load failure).
  const boundary = await first.turn('main', 'LUNA-RC8-COMPAT-1：请只回复 LUNA-RC8-COMPAT-OK，不调用工具。', {}, 60_000)
    .then(() => { throw new Error('turn unexpectedly succeeded without credential') }, (error) => error)
  check('C4 turn#1 credential boundary (create)',
    boundary?.class === 'credential_missing' && boundary?.layer === 'agent/credential'
    && boundary?.provider === CANDIDATE.provider && boundary?.model === CANDIDATE.model,
    `class=${boundary?.class} layer=${boundary?.layer}`)
  check('C6 turn#1 session created', first.creations.at(-1)?.mode === 'created',
    first.creations.at(-1)?.mode)

  // ------------------------------------------------------ D fixture credential + observer
  // The pi-ai codex adapter parses the access token as a JWT and reads
  // payload["https://api.openai.com/auth"].chatgpt_account_id — the fixture
  // token must carry that shape (fake values, never a real token).
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const fixtureJwt = [
    b64url({ alg: 'none', typ: 'JWT' }),
    b64url({
      sub: 'fixture-user',
      exp: Math.floor(Date.now() / 1000) + 86_400,
      'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account-id' },
    }),
    b64url({ sig: 'fixture-signature' }),
  ].join('.')
  const fixtureCredential = {
    version: 1,
    credential: {
      type: 'oauth',
      access: fixtureJwt,
      refresh: 'fixture-refresh-token-not-a-real-secret',
      expires: Date.now() + 86_400_000,
      accountId: 'fixture-account-id',
    },
  }
  const credFile = join(home, '.openai-codex-auth.json')
  writeFileSync(credFile, `${JSON.stringify(fixtureCredential, null, 2)}\n`, { mode: 0o600 })
  chmod0600(credFile)

  const turnsBefore = observed.length
  const providerError = await first.turn('main', 'LUNA-RC8-COMPAT-2：请只回复 LUNA-RC8-COMPAT-OK，不调用工具。', {}, 60_000)
    .then(() => undefined, (error) => error)
  const newObserved = observed.slice(turnsBefore)
  const connects = newObserved.filter((o) => o.kind === 'connect')
  check('D1 proxy observer captured CONNECT chatgpt.com:443',
    connects.some((o) => /^chatgpt\.com:443$/.test(o.target)),
    JSON.stringify(newObserved.slice(0, 6)))
  // Reaching the CONNECT stage proves the JWT account-id extraction passed
  // (pi-ai extracts it BEFORE any network) — i.e. the fixture OAuth token
  // crossed the plugin->adapter seam in the expected shape.
  check('D5 turn#2 fails provider-side (NOT credential_missing)', providerError !== undefined
    && providerError?.class !== 'credential_missing',
    `class=${providerError?.class} code=${providerError?.code} message=${providerError?.message}`)
  check('D6 turn#2 session mode recorded', ['created', 'resumed'].includes(first.creations.at(-1)?.mode),
    first.creations.at(-1)?.mode)

  // ------------------------------------------------------ E clean exit + cold restart
  await first.shutdown(10_000)
  check('E1 clean exit recorded', first.exit !== undefined, JSON.stringify(first.exit))

  const second = boot()
  await second.ready(90_000)
  check('E2 cold restart: plugin reloads', second.initializeEvidence?.pluginServices?.openAICodex === true
    && (second.initializeEvidence?.registeredProviders ?? []).includes(CANDIDATE.provider))

  const turnsBefore2 = observed.length
  const providerError2 = await second.turn('main', 'LUNA-RC8-COMPAT-3：请只回复 LUNA-RC8-COMPAT-OK，不调用工具。', {}, 60_000)
    .then(() => undefined, (error) => error)
  const connects2 = observed.slice(turnsBefore2).filter((o) => o.kind === 'connect')
  check('E3 after restart: observer hit again (credential reused, session resumed)',
    connects2.some((o) => /^chatgpt\.com:443$/.test(o.target))
    && second.creations.at(-1)?.mode === 'resumed'
    && providerError2?.class !== 'credential_missing',
    `connects=${JSON.stringify(connects2.slice(0, 4))} mode=${second.creations.at(-1)?.mode} class=${providerError2?.class}`)
  await second.shutdown(10_000)
  check('E4 second clean exit', second.exit !== undefined, JSON.stringify(second.exit))
} catch (error) {
  check('driver completed without unexpected error', false, error?.stack ?? String(error))
} finally {
  await shutdownAll()
  rmSync(root, { recursive: true, force: true })
}

function chmod0600(file) {
  // writeFileSync mode only applies at creation; enforce explicitly.
  chmodSync(file, 0o600)
}

console.log('\n==== LUNA_DSH_RC8_COMPAT DRIVER SUMMARY ====')
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}`)
console.log(`RESULT=${failed === 0 ? 'PASS' : 'FAIL'} CHECKS=${results.length} FAILED=${failed}`)
process.exitCode = failed === 0 ? 0 : 1
