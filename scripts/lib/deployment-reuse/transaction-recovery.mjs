// Participant in the existing r13 TX. Owns code/config intents, never terminal
// status, locks, credentials, business state or replay. r13 owns plugin recovery.
import * as fs from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCohortBinding, verifyCohort, cohortDigest } from './cohort-binding.mjs'
import { runGate } from '../trusted-cp-model-overrides-config-gate.mjs'
import { runMigration, restoreMigration } from '../trusted-cp-fleet-config-v2v3-migration.mjs'

const PARTS = ['app', 'harness', 'node-runtime']
const GATES = ['trusted-cp-fresh-child-boot-canary.mjs', 'trusted-cp-runtime-app-graph-gate.mjs', 'trusted-cp-model-overrides-config-gate.mjs']
const digest = (b) => createHash('sha256').update(b).digest('hex')
const fail = (reason) => { throw new Error(`RECOVERY_UNKNOWN: ${reason}`) }
const metadata = (s) => [s.uid, s.gid, s.mode & 0o7777]
const exists = (p) => {
  try { fs.lstatSync(p); return true } catch (e) { if (e.code === 'ENOENT') return false; throw e }
}
function syncDir(p) {
  const fd = fs.openSync(p, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function directory(p) {
  if (!fs.lstatSync(p).isDirectory()) fail(`not a directory: ${p}`)
}
export function treeDigest(p) {
  const entries = []
  function visit(path, rel) {
    const s = fs.lstatSync(path)
    if (s.isSymbolicLink()) entries.push([rel, 'link', ...metadata(s), fs.readlinkSync(path)])
    else if (s.isDirectory()) {
      entries.push([rel, 'dir', ...metadata(s)])
      for (const name of fs.readdirSync(path).sort()) visit(join(path, name), `${rel}/${name}`)
    } else if (s.isFile() && s.nlink === 1) entries.push([rel, 'file', ...metadata(s), digest(fs.readFileSync(path))])
    else fail(`unsupported entry: ${path}`)
  }
  visit(p, '.')
  return digest(JSON.stringify(entries))
}
function copyExact(src, dest) {
  const s = fs.lstatSync(src)
  if (s.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(src), dest)
  else if (s.isDirectory()) {
    fs.mkdirSync(dest, { mode: 0o700 })
    for (const name of fs.readdirSync(src)) copyExact(join(src, name), join(dest, name))
  } else if (s.isFile() && s.nlink === 1) {
    const fd = fs.openSync(dest, 'wx', s.mode & 0o7777)
    try { fs.writeFileSync(fd, fs.readFileSync(src)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  } else fail(`unsupported copy: ${src}`)
  if (process.getuid?.() === 0) fs.lchownSync(dest, s.uid, s.gid)
  if (!s.isSymbolicLink()) fs.chmodSync(dest, s.mode & 0o7777)
  if (s.isFile()) {
    const fd = fs.openSync(dest, 'r')
    try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  }
  if (s.isDirectory()) syncDir(dest)
}
export function context(root, trusted, recovery, txId) {
  if (!/^tx-[a-zA-Z0-9-]+$/.test(txId)) fail('transaction id')
  for (const p of [root, trusted, recovery]) {
    if (resolve(p) !== p) fail('absolute roots required')
    directory(p)
  }
  const s = fs.lstatSync(recovery)
  if (s.uid !== process.getuid() || (s.mode & 0o777) !== 0o700) fail('recovery root custody')
  return { root, trusted, recovery, txId, txFile: join(recovery, 'migration-transaction.json'),
    assets: join(recovery, `activation-${txId}`), input: join(recovery, 'activation-code-input'),
    config: join(root, 'agent-model-overrides.json'), fence: join(recovery, 'migration-fence.json') }
}
function readTx(c) {
  const s = fs.lstatSync(c.txFile)
  if (!s.isFile() || s.nlink !== 1 || (s.mode & 0o777) !== 0o600 || s.uid !== process.getuid()) fail('TX custody')
  const tx = JSON.parse(fs.readFileSync(c.txFile))
  if (tx.txId !== c.txId || tx.deploymentRoot !== c.root || tx.config !== c.config) fail('TX identity')
  return tx
}
function save(c, tx) {
  const tmp = `${c.txFile}.participant-${process.pid}`
  const fd = fs.openSync(tmp, 'wx', 0o600)
  try { fs.writeFileSync(fd, `${JSON.stringify(tx, null, 2)}\n`); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(tmp, c.txFile)
  syncDir(c.recovery)
}
function rowPaths(c, part) {
  return { part, live: join(c.trusted, part), old: join(c.assets, `old-${part}`), next: join(c.assets, `new-${part}`),
    staged: join(c.trusted, `.${part}-${c.txId}-next`), displaced: join(c.trusted, `.${part}-${c.txId}-displaced`),
    restore: join(c.trusted, `.${part}-${c.txId}-restore`), failed: join(c.trusted, `.${part}-${c.txId}-failed`) }
}
function binding(c, tx) {
  const a = tx.activation
  if (!a || a.txId !== c.txId || a.assets !== c.assets || a.trustedRoot !== c.trusted || a.rows?.length !== PARTS.length) fail('participant binding')
  if (a.cohort) assertCohortBinding(a.cohort, c.root, a.cohortSha256)
  else if (a.cohortSha256) fail('cohort missing')
  directory(c.assets)
  for (const [i, part] of PARTS.entries()) {
    const row = a.rows[i]
    for (const [key, value] of Object.entries(rowPaths(c, part))) if (row[key] !== value) fail('resource path')
    for (const p of [row.old, row.next]) directory(p)
    for (const p of [row.live, row.staged, row.displaced, row.restore, row.failed]) if (exists(p)) directory(p)
    if (treeDigest(row.old) !== row.pre || treeDigest(row.next) !== row.post) fail('pre/post image digest')
  }
  if (a.configIntent) {
    const r = a.configIntent
    if (r.config !== c.config || r.deploymentRoot !== c.root || dirname(r.backupPath) !== c.root
      || !r.backupPath.startsWith(`${c.config}.pre-v3-`)) fail('config binding')
  }
  return a
}
function fenced(c, tx) {
  if (!['MUTATING_FENCED', 'ROLLING_BACK', 'ROLLBACK_APPLIED', 'ABORT_INCOMPLETE',
    'ABORTED_PENDING_RUNTIME_RESTORE', 'APPLIED_AWAITING_PONG', 'COMMITTING'].includes(tx.state)) fail('TX phase')
  const s = fs.lstatSync(c.fence)
  if (!s.isFile() || s.nlink !== 1) fail('fence custody')
  const f = JSON.parse(fs.readFileSync(c.fence))
  if (f.txId !== c.txId || f.inFlight !== true) fail('fence missing or foreign')
}
function validateAppProvenance(c, packet) {
  directory(join(c.input, 'app'))
  const path = join(c.input, 'app/pack-provenance.json')
  if (!exists(path)) fail('app provenance missing')
  const stat = fs.lstatSync(path)
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 65536) fail('app provenance file shape')
  const bytes = fs.readFileSync(path)
  let value
  try { value = JSON.parse(bytes) } catch { fail('app provenance malformed') }
  if (!value || typeof value !== 'object' || value.provenance !== 'TRUSTED_CP_PACK_INPUT_PROVENANCE_V1'
    || value.source_head_sha !== packet.sourceSha || value.source_tree_sha !== packet.sourceTree
    || value.source_clean !== 'yes' || value.source_label_matches_pack_input !== 'YES'
    || (value.generation_label_sha !== '' && value.generation_label_sha !== packet.sourceSha)) fail('app provenance source mismatch')
  // This binds the existing pack receipt to the accepted source coordinates.
  // The receipt is not a substitute for the reviewed pack or dependency closure.
  return digest(bytes)
}
export function prepare(c, packet) {
  const tx = readTx(c)
  if (tx.state !== 'PREPARED' || Object.hasOwn(tx, 'activation') || exists(c.assets)) fail('preparation replay')
  if (!/^[a-f0-9]{40}$/.test(packet.sourceSha) || !/^[a-f0-9]{40}$/.test(packet.sourceTree)) fail('source binding')
  if (packet.cohort) {
    if (packet.cohort.trustedRoot !== c.trusted) fail('cohort trusted code root')
    if (!/^[a-f0-9]{64}$/.test(packet.cohortSha256)) fail('cohort digest missing')
    assertCohortBinding(packet.cohort, c.root, packet.cohortSha256)
    if (tx.outer?.binding?.cohortSha256 && tx.outer.binding.cohortSha256 !== packet.cohortSha256) fail('outer cohort binding')
    verifyCohort(packet.cohort, { root: c.root, registrySource: fs.readFileSync(join(c.root, 'agents.json'), 'utf8'), configSource: fs.readFileSync(c.config, 'utf8'), candidateRoot: c.input })
  }
  directory(c.input)
  const appProvenanceSha256 = validateAppProvenance(c, packet)
  fs.mkdirSync(c.assets, { mode: 0o700 })
  const rows = []
  for (const part of PARTS) {
    const row = rowPaths(c, part), input = join(c.input, part)
    directory(row.live); directory(input)
    if (part === 'node-runtime' && metadata(fs.lstatSync(join(row.live, 'bin/node'))).join() !== metadata(fs.lstatSync(join(input, 'bin/node'))).join()) fail('runtime Node custody changed')
    row.pre = treeDigest(row.live)
    row.post = treeDigest(input)
    if (packet.codeDigests?.[part] !== row.post) fail('frozen code digest')
    copyExact(row.live, row.old); copyExact(input, row.next)
    if (treeDigest(row.old) !== row.pre || treeDigest(row.next) !== row.post) fail('copy drift')
    row.intent = false
    rows.push(row)
  }
  fs.mkdirSync(join(c.assets, 'tools'), { mode: 0o700 })
  fs.mkdirSync(join(c.assets, 'tools/deployment-reuse'), { mode: 0o700 })
  const cohortSupport = {}
  for (const name of ['cohort-runtime.mjs', 'cohort-artifacts.mjs']) {
    const path = fileURLToPath(new URL(`./${name}`, import.meta.url))
    copyExact(path, join(c.assets, 'tools/deployment-reuse', name)); cohortSupport[name] = digest(fs.readFileSync(path))
  }
  copyExact(fileURLToPath(new URL('./cohort-binding.mjs', import.meta.url)), join(c.assets, 'tools/deployment-reuse/cohort-binding.mjs'))
  copyExact(fileURLToPath(import.meta.url), join(c.assets, 'tools/deployment-reuse/transaction-recovery.mjs'))
  copyExact(fileURLToPath(new URL('../trusted-cp-fleet-config-v2v3-migration.mjs', import.meta.url)), join(c.assets, 'tools/trusted-cp-fleet-config-v2v3-migration.mjs'))
  const gates = {}
  for (const name of GATES) {
    const source = fileURLToPath(new URL(`../${name}`, import.meta.url))
    copyExact(source, join(c.assets, 'tools', name))
    gates[name] = digest(fs.readFileSync(source))
  }
  tx.activation = { cohort: packet.cohort ? structuredClone(packet.cohort) : null, cohortSha256: packet.cohortSha256 ?? null,
    cohortSupport, cohortToolSha256: digest(fs.readFileSync(new URL('./cohort-binding.mjs', import.meta.url))), appProvenanceSha256, gates, txId: c.txId, assets: c.assets, trustedRoot: c.trusted, rows,
    sourceSha: packet.sourceSha, sourceTree: packet.sourceTree, configIntent: null, restored: false, pluginIntent: false, plugins: [],
    toolSha256: digest(fs.readFileSync(fileURLToPath(import.meta.url))),
    migrationToolSha256: digest(fs.readFileSync(new URL('../trusted-cp-fleet-config-v2v3-migration.mjs', import.meta.url))),
    recoveryTool: join(c.assets, 'tools/deployment-reuse/transaction-recovery.mjs'),
    recoveryNode: join(c.assets, 'old-node-runtime/bin/node'),
    recoveryNodeSha256: digest(fs.readFileSync(join(c.assets, 'old-node-runtime/bin/node'))) }
  syncDir(c.assets)
  save(c, tx)
}
export async function apply(c, loader, hooks = {}) {
  let tx = readTx(c)
  fenced(c, tx)
  let a = binding(c, tx)
  if (a.configIntent || a.rows.some((r) => r.intent)) fail('apply intent exists; reconcile, never replay')
  const result = await runMigration({ config: c.config, registry: join(c.root, 'agents.json'),
    deploymentRoot: c.root, modelOverridesModule: loader, execute: true, cohort: a.cohort ?? undefined, runtimePhase: 'quiesced',
    candidateRoot: { app: join(c.assets, 'new-app'), harness: join(c.assets, 'new-harness') } }, {
    beforeReplace(receipt) {
      tx = readTx(c); fenced(c, tx); a = binding(c, tx)
      a.configIntent = { ...receipt, configReplaced: true }
      save(c, tx) // MAY_SWAP intent, not an observation that rename completed.
      hooks.afterConfigIntent?.()
    },
    afterSwap() { hooks.afterConfigSwap?.() },
  })
  if (!result.ok) fail(`migration: ${result.errorCode}`)
  for (const part of PARTS) {
    tx = readTx(c); fenced(c, tx); a = binding(c, tx)
    const row = a.rows.find((r) => r.part === part)
    if (treeDigest(row.live) !== row.pre || exists(row.displaced) || exists(row.staged)) fail('code preimage drift')
    copyExact(row.next, row.staged)
    row.intent = true
    save(c, tx)
    hooks.beforeCodeSwap?.(part)
    fs.renameSync(row.live, row.displaced)
    syncDir(c.trusted)
    hooks.afterCodeDisplaced?.(part)
    fs.renameSync(row.staged, row.live)
    syncDir(c.trusted)
    hooks.afterCodeSwap?.(part)
  }
  verify(c, 'post')
}
export function markPluginIntent(c) {
  const tx = readTx(c)
  fenced(c, tx)
  const a = binding(c, tx)
  if (a.pluginIntent) fail('plugin intent exists; never replay freeze')
  verify(c, 'post')
  const ids = Object.keys(JSON.parse(fs.readFileSync(c.config)).overrides).sort()
  a.plugins = ids.map((id) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) fail('plugin identity')
    return join(c.root, 'homes', id, 'profiles/node_modules/dsh-codex')
  })
  a.plugins.push(join(c.root, 'control/codex-plugin-runtime/current'))
  a.plugins = a.plugins.map((path) => ({ path, pre: exists(path) ? treeDigest(path) : null }))
  a.pluginIntent = true
  save(c, tx)
}
export function verifyPlugins(c) {
  const a = binding(c, readTx(c))
  if (!a.pluginIntent) return true
  const ids = Object.keys(JSON.parse(fs.readFileSync(c.config)).overrides).sort()
  const paths = ids.map((id) => join(c.root, 'homes', id, 'profiles/node_modules/dsh-codex'))
  paths.push(join(c.root, 'control/codex-plugin-runtime/current'))
  if (a.plugins?.length !== paths.length) fail('plugin preimage set')
  for (const [i, path] of paths.entries()) {
    if (a.plugins[i].path !== path) fail('plugin path binding')
    if ((exists(path) ? treeDigest(path) : null) !== a.plugins[i].pre) fail('plugin preimage mismatch')
  }
  return true
}
export function hasIntent(c) {
  const tx = readTx(c)
  if (!Object.hasOwn(tx, 'activation')) return false
  const a = binding(c, tx)
  return Boolean(a.configIntent || a.rows.some((r) => r.intent))
}
function classifyConfig(c, a) {
  if (!a.configIntent) return
  const r = a.configIntent, s = fs.lstatSync(c.config), b = fs.lstatSync(r.backupPath)
  if (![s, b].every((v) => v.isFile() && v.nlink === 1
    && metadata(v).join() === [r.preMetadata.uid, r.preMetadata.gid, r.preMetadata.mode].join())) fail('config metadata')
  if (digest(fs.readFileSync(r.backupPath)) !== r.preSha256) fail('config preimage digest')
  if (![r.preSha256, r.postSha256].includes(digest(fs.readFileSync(c.config)))) fail('foreign config')
}
export function restore(c) {
  const tx = readTx(c)
  const a = binding(c, tx)
  if (a.restored) {
    const f = JSON.parse(fs.readFileSync(c.fence))
    if (f.txId !== c.txId) fail('foreign completed fence')
    verify(c, 'pre')
    return // Exact pair already restored: no mutation and no replay after fence clear.
  }
  fenced(c, tx)
  classifyConfig(c, a)
  for (const row of a.rows) {
    const actual = exists(row.live) ? treeDigest(row.live) : null
    if (actual !== row.pre && actual !== row.post && !(actual === null && row.intent && exists(row.displaced) && treeDigest(row.displaced) === row.pre)) fail('foreign code')
    if (!row.intent && actual !== row.pre) fail('unrecorded code change')
    if (exists(row.displaced) && treeDigest(row.displaced) !== row.pre) fail('foreign displaced code')
    if (exists(row.failed) && treeDigest(row.failed) !== row.post) fail('foreign failed code')
  }
  for (const row of [...a.rows].reverse()) {
    if (exists(row.live) && treeDigest(row.live) === row.pre) continue
    if (!exists(row.restore)) copyExact(row.old, row.restore)
    if (treeDigest(row.restore) !== row.pre) fail('restore staging')
    if (exists(row.live)) {
      if (exists(row.failed)) fail('ambiguous failed generation')
      fs.renameSync(row.live, row.failed)
      syncDir(c.trusted)
    }
    fs.renameSync(row.restore, row.live)
    syncDir(c.trusted)
  }
  if (a.configIntent) {
    const result = restoreMigration(a.configIntent)
    if (!result.ok) fail(result.error)
  }
  a.restored = true
  save(c, tx)
  verify(c, 'pre')
}
export function verify(c, side) {
  const tx = readTx(c), a = binding(c, tx)
  if (!['pre', 'post'].includes(side)) fail('verification side')
  for (const row of a.rows) if (!exists(row.live) || treeDigest(row.live) !== row[side]) fail(`code ${side}`)
  classifyConfig(c, a)
  if (a.configIntent) {
    const r = a.configIntent
    if (digest(fs.readFileSync(c.config)) !== (side === 'pre' ? r.preSha256 : r.postSha256)) fail(`config ${side}`)
  } else if (side === 'post') fail('missing config intent')
  if (side === 'post' && a.cohort) cohortInputs(c, 'post')
  return true
}
export function cohortInputs(c, phase = 'post') {
  const tx = readTx(c), a = binding(c, tx)
  if (!a.cohort) return null
  const runtimePhase = ['MUTATING_FENCED', 'MUTATING_NO_FENCE', 'FENCE_CREATING'].includes(tx.state) ? 'quiesced' : phase
  return verifyCohort(a.cohort, { root: c.root, registrySource: fs.readFileSync(join(c.root, 'agents.json'), 'utf8'),
    configSource: fs.readFileSync(c.config, 'utf8'), phase, expectedDigest: a.cohortSha256, consumers: false, runtimePhase })
}
export async function cohortCoverage(c) {
  const tx = readTx(c), a = binding(c, tx)
  if (!a.cohort) return null
  const result = await runGate({ config: c.config, registry: join(c.root, 'agents.json'), deploymentRoot: c.root,
    modelOverridesModule: join(c.trusted, 'app/packages/production-runtime/src/model-overrides.js'),
    definitionModule: join(c.trusted, 'app/packages/agent-definition/src/definition.js'), cohort: a.cohort })
  if (!result.ok) fail(`full consumer compatibility: ${result.errorCode}`)
  a.compatibility = result.cohort
  save(c, tx)
  return result.cohort
}
export function verifyCanaries(c) {
  const a = binding(c, readTx(c))
  if (!a.cohort) return true
  if (a.compatibility?.cohortSha256 !== a.cohortSha256 || a.compatibility.compatibilityCount !== a.cohort.registryCount) fail('compatibility receipt missing')
  const path = join(c.recovery, 'commit-confirmation.json'), st = fs.lstatSync(path)
  if (!st.isFile() || st.nlink !== 1 || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o600) fail('canary confirmation custody')
  const record = JSON.parse(fs.readFileSync(path)), groups = new Set(Object.entries(a.cohort.consumers).map(([id, item]) => `${a.compatibility.routes[id]}:${item.provision}`))
  if (record.confirmed !== 'yes' || record.txId !== c.txId || record.cohortSha256 !== a.cohortSha256 || !Array.isArray(record.canaries)) fail('actual canary evidence missing')
  for (const r of record.canaries) {
    const item = a.cohort.consumers[r.agentId]
    if (!item || r.txId !== c.txId || r.sourceSha !== a.sourceSha || r.routeSha256 !== a.compatibility.routes[r.agentId]
      || r.runtimeInputsSha256 !== a.compatibility.runtimeInputsSha256 || r.runtimeIdentitySha256 !== cohortDigest(a.compatibility.runtimeIdentity)
      || r.outcome !== 'PONG' || !/^[a-f0-9]{64}$/.test(r.evidenceSha256)) fail('foreign/missing actual canary evidence')
    groups.delete(`${r.routeSha256}:${item.provision}`)
  }
  if (groups.size) fail('distinct route/provision paths lack actual canary evidence')
  return true
}
// Only PREPARED predates the participant: prepare freezes private assets before
// saving activation, and no live write can run without that durable binding.
export function proveNoParticipantAbort(c) {
  const tx = readTx(c)
  if (Object.hasOwn(tx, 'activation')) fail('participant is not absent')
  if (!/^[A-Za-z0-9-]+$/.test(tx.stamp)) fail('no-participant stamp')
  const preimage = join(c.root, 'control', `codex-plugin-preimage-${tx.stamp}`)
  if (tx.preimageDir !== preimage || tx.manifest !== join(preimage, 'manifest.json')
    || tx.manifestSha256 !== 'ABSENT' || exists(tx.manifest)) fail('no-participant journal')
  if (tx.state === 'PREPARED') {
    tx.abortBeforeParticipant = true
    save(c, tx)
  } else if (!['ABORTED_PENDING_RUNTIME_RESTORE', 'ABORTED_PENDING_FENCE_CLEAR', 'ABORTED'].includes(tx.state)
    || tx.abortBeforeParticipant !== true) fail('no-participant abort proof')
  return true
}
export function verifyTerminal(c) {
  const tx = readTx(c)
  if (!['COMMITTED', 'ABORTED'].includes(tx.state)) fail('not terminal')
  if (Object.hasOwn(tx, 'activation')) binding(c, tx)
  else proveNoParticipantAbort(c)
  if (exists(c.fence)) {
    const f = JSON.parse(fs.readFileSync(c.fence))
    if (f.txId !== c.txId || f.inFlight !== false) fail('terminal fence')
  } else if (tx.state === 'COMMITTED' || hasIntent(c)) fail('terminal fence missing')
  return true
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [op, root, trusted, recovery, txId, arg] = process.argv.slice(2)
    const c = context(root, trusted, recovery, txId)
    if (op === 'prepare') prepare(c, JSON.parse(fs.readFileSync(arg)).activation)
    else if (op === 'apply') await apply(c, arg)
    else if (op === 'restore') restore(c)
    else if (op === 'verify') verify(c, arg)
    else if (op === 'cohort-inputs') cohortInputs(c, arg)
    else if (op === 'cohort-coverage') await cohortCoverage(c)
    else if (op === 'canary') verifyCanaries(c)
    else if (op === 'terminal') verifyTerminal(c)
    else if (op === 'no-participant-abort') proveNoParticipantAbort(c)
    else if (op === 'plugin-intent') markPluginIntent(c)
    else if (op === 'verify-plugins') verifyPlugins(c)
    else if (op === 'plugin-started') process.exit(binding(c, readTx(c)).pluginIntent ? 0 : 3)
    else if (op === 'intent') process.exit(hasIntent(c) ? 0 : 3)
    else fail('unknown operation')
    process.stdout.write(`PARTICIPANT_${op.toUpperCase()}=PASS\n`)
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2 }
}
