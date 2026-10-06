import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { context, prepare, treeDigest, verify, markPluginIntent, proveNoParticipantAbort } from './transaction-recovery.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const carrier = join(repo, 'docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh')
const tool = fileURLToPath(new URL('./transaction-recovery.mjs', import.meta.url))
const loader = join(repo, 'packages/production-runtime/src/model-overrides.js')
const writeJSON = (p, x) => fs.writeFileSync(p, JSON.stringify(x), { mode: 0o600 })
const readJSON = (p) => JSON.parse(fs.readFileSync(p))
export function fixture({ deferPrepare = false } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'b7-joint-test-')))
  const root = join(base, 'root'), trusted = join(base, 'trusted'), recovery = join(base, 'recovery')
  for (const p of [root, trusted, recovery]) fs.mkdirSync(p, { mode: 0o700 })
  const c = context(root, trusted, recovery, 'tx-fixture')
  fs.mkdirSync(c.input)
  const codeDigests = {}
  for (const part of ['app', 'harness', 'node-runtime']) {
    for (const [parent, label] of [[trusted, 'old'], [c.input, 'new']]) {
      const dir = join(parent, part)
      fs.mkdirSync(dir)
      fs.writeFileSync(join(dir, 'generation.txt'), `${label}-${part}`)
      if (part === 'app' && label === 'new') {
        writeJSON(join(dir, 'pack-provenance.json'), {
          provenance: 'TRUSTED_CP_PACK_INPUT_PROVENANCE_V1',
          source_head_sha: 'a'.repeat(40), source_tree_sha: 'b'.repeat(40),
          source_clean: 'yes', generation_label_sha: 'a'.repeat(40), source_label_matches_pack_input: 'YES',
        })
      }
      if (part === 'node-runtime') {
        fs.mkdirSync(join(dir, 'bin'))
        fs.writeFileSync(join(dir, 'bin/node'), `${label}-node-fixture`)
      }
    }
    codeDigests[part] = treeDigest(join(c.input, part))
  }
  const agents = Array.from({ length: 92 }, (_, i) => ({ id: `agt_fix${i}-agent`, name: `fixture${i}`, description: null }))
  writeJSON(join(root, 'agents.json'), { version: 1, defaultAgentId: agents[0].id, agents })
  writeJSON(c.config, { version: 2, routeCatalog: { luna: { routeKind: 'subscription', provider: 'openai-codex',
    model: 'gpt-5.6-luna', plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'bridge-store-bound' } },
    overrides: Object.fromEntries(agents.map((a) => [a.id, { model: { primary: 'luna', fallbacks: [] } }])) })
  const control = join(root, 'control'), preimage = join(control, 'codex-plugin-preimage-fixture')
  const genParent = join(control, 'codex-plugin-runtime/gen-fixture'), gen = join(genParent, 'node_modules')
  fs.mkdirSync(preimage, { recursive: true }); fs.mkdirSync(gen, { recursive: true })
  const current = join(control, 'codex-plugin-runtime/current')
  writeJSON(c.txFile, { txSchema: 1, txId: c.txId, state: 'PREPARED', deploymentRoot: root, config: c.config,
    scriptSha256: sha(fs.readFileSync(carrier)), stamp: 'fixture', genParent, genDir: gen, currentLink: current,
    preimageDir: preimage, manifest: join(preimage, 'manifest.json'), manifestSha256: 'ABSENT', fence: c.fence })
  writeJSON(c.fence, { txId: c.txId, inFlight: true })
  writeJSON(join(root, 'business.json'), { outcome: 'UNKNOWN', effectFence: true, replayCount: 0 })
  writeJSON(join(root, 'mutable-store-fixture.json'), { revision: 2 })
  const packet = { sourceSha: 'a'.repeat(40), sourceTree: 'b'.repeat(40), codeDigests }
  if (!deferPrepare) {
    prepare(c, packet)
    const tx = readJSON(c.txFile)
    tx.state = 'MUTATING_FENCED'
    writeJSON(c.txFile, tx)
  }
  return { base, c, preimage, gen, current, before: fs.readFileSync(c.config), control, packet }
}
export function childApply(f, point = '') {
  if (f.cohort) {
    const path = f.cohort.runtimeContext, x = readJSON(path); x.phase = 'quiesced'; writeJSON(path, x)
  }
  const program = `import {apply,context} from ${JSON.stringify(pathToFileURL(tool).href)};
    const [r,t,s,id,loader,point]=process.argv.slice(1);
    const die=()=>process.kill(process.pid,'SIGKILL');
    const hooks={};
    if(point)hooks[point]=(part)=>{if(!part||part==='app')die()};
    await apply(context(r,t,s,id),loader,hooks);`
  return spawnSync(process.execPath, ['--input-type=module', '-e', program,
    f.c.root, f.c.trusted, f.c.recovery, f.c.txId, loader, point], { encoding: 'utf8', timeout: 20000 })
}
export function abort(f, runtimeFail = false, afterFenceClear = false) {
  return spawnSync('/bin/bash', [carrier, '--tx-child-abort', '--transaction', f.c.txId], {
    encoding: 'utf8', timeout: 20000, env: { ...process.env,
      TXPROBE_ROOT: f.c.root, TXPROBE_CONTROL: f.control, TXPROBE_RECOVERY_ROOT: f.c.recovery,
      TXPROBE_TRUSTED_ROOT: f.c.trusted, TXPROBE_NODE: process.execPath,
      TXPROBE_RUNTIME_FAIL: runtimeFail ? '1' : '0', TXPROBE_ABORT_AFTER_FENCE_CLEAR: afterFenceClear ? '1' : '0' },
  })
}
export function checkRestored(f) {
  assert.equal(verify(f.c, 'pre'), true)
  assert.equal(fs.readFileSync(f.c.config).equals(f.before), true)
  assert.deepEqual(readJSON(join(f.c.root, 'business.json')), { outcome: 'UNKNOWN', effectFence: true, replayCount: 0 })
  assert.deepEqual(readJSON(join(f.c.root, 'mutable-store-fixture.json')), { revision: 2 })
}
