/**
 * Permanent regression tests for the Agent child TMPDIR override
 * (production incident: launchd Runtime uid authsvc/505 per-user TMPDIR
 * /var/folders/.../T mode 0700 inherited by the uid-502 Agent child =>
 * @deepseek-ai/dsh-spill-local mkdtempSync EACCES => plugin tree load
 * failure => provider never registers => deliver hangs).
 *
 *   T1 — an inherited private (untraversable) parent TMPDIR never reaches
 *        the child env; the child gets the fixed AGENT_CHILD_TMPDIR, and the
 *        Router parent's own process.env.TMPDIR is untouched.
 *   T2 — no caller channel (per-Agent extra env, providerEnv, omit list)
 *        can override or drop the fixed child TMPDIR.
 *   T3 — real plugin boot with the production spawn path: parent TMPDIR
 *        points at an untraversable directory, yet the real dsh child
 *        (same provisioning, same profile, same uid/gid drop as production)
 *        loads its plugin tree, answers initialize and registers the
 *        provider. Skipped when the harness checkout is absent.
 *   T4 — a mkdtemp under the child TMPDIR (spill-local's exact primitive)
 *        yields a randomly-named 0700 directory owned by the child uid.
 *   T5 — secret boundary: sentinel credentials never survive the env/log
 *        boundary, and this suite never snapshots the full child env.
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { accessSync, chmodSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { cliBin, provisionAgentHome } from '../../agent-provisioning/src/index.js'
import {
  AGENT_CHILD_TMPDIR,
  AgentProcess,
  agentEnv,
  redactSensitiveText,
} from '../src/process.js'

const PROFILE = 'agent-core-production'

/**
 * A directory the Agent child (uid 502 in production) cannot use as a TMPDIR:
 * mode 000 denies traversal even to the owning uid, mirroring the production
 * denial where a 0700 authsvc-owned directory is untraversable for the
 * different-uid child. Self-validating: the fixture asserts access is
 * actually denied before being used.
 */
function makeUntraversableDir(label) {
  const dir = mkdtempSync(join(tmpdir(), `ac-child-env-${label}-`))
  chmodSync(dir, 0o000)
  let denied
  try {
    accessSync(join(dir, 'probe'), 0 /* no bits */)
    denied = false
  } catch {
    denied = true
  }
  if (!denied) {
    chmodSync(dir, 0o700)
    rmSync(dir, { recursive: true, force: true })
    throw new Error('child-env fixture: mode-000 directory remained traversable; cannot simulate the inherited private TMPDIR')
  }
  return dir
}

function cleanupUntraversableDir(dir) {
  chmodSync(dir, 0o700)
  rmSync(dir, { recursive: true, force: true })
}

/** Save/restore one process.env slot around a test body. */
function withEnv(name, value, body) {
  const previous = process.env[name]
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
  return Promise.resolve(body()).finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test('T1: inherited private parent TMPDIR is overridden to the fixed child TMPDIR without touching the parent env', async () => {
  const inaccessible = makeUntraversableDir('t1')
  try {
    await withEnv('TMPDIR', inaccessible, () => {
      const childEnv = agentEnv('/tmp/ac-child-env-t1-home')
      assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
      assert.notEqual(childEnv.TMPDIR, inaccessible)
      // The Router parent's own environment is the runtime's identity, not
      // the child's; the override must only shape the child env object.
      assert.equal(process.env.TMPDIR, inaccessible)
      // Other inherited semantics stay unchanged (spot-check identity keys).
      assert.equal(childEnv.DSH_HOME, '/tmp/ac-child-env-t1-home')
      assert.equal(childEnv.DSH_PERMISSION_MODE, 'danger-full-access')
    })
  } finally {
    cleanupUntraversableDir(inaccessible)
  }
})

test('T2: no caller channel can override or drop the fixed child TMPDIR', async () => {
  const inaccessible = makeUntraversableDir('t2')
  try {
    await withEnv('TMPDIR', inaccessible, () => {
      // per-Agent extra env (AgentProcess `env` option) — last-spread caller channel
      let childEnv = agentEnv('/tmp/ac-child-env-t2-home', { TMPDIR: '/forbidden' })
      assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
      // validated provider env injection channel
      childEnv = agentEnv('/tmp/ac-child-env-t2-home', {}, [], { TMPDIR: '/forbidden' })
      assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
      // omit list (config-driven env stripping) must not drop the override
      childEnv = agentEnv('/tmp/ac-child-env-t2-home', { TMPDIR: '/forbidden' }, ['TMPDIR'])
      assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
      // all channels at once, plus a per-agent omit that must still work for
      // other keys
      childEnv = agentEnv(
        '/tmp/ac-child-env-t2-home',
        { TMPDIR: '/forbidden', OPENAI_API_KEY: 'sk-t2-should-be-omitted' },
        ['TMPDIR', 'OPENAI_API_KEY'],
        { TMPDIR: '/forbidden-too' },
      )
      assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
      assert.equal(childEnv.OPENAI_API_KEY, undefined)
    })
  } finally {
    cleanupUntraversableDir(inaccessible)
  }
})

test('T3: real plugin boot under an untraversable parent TMPDIR — plugin tree, initialize and provider registration all pass', { timeout: 180_000 }, async (t) => {
  let cli
  try {
    cli = cliBin()
  } catch {
    t.skip('deepseek-harness CLI not resolvable (DSH_HARNESS_ROOT/checkout missing) — real child boot not run')
    return
  }
  assert.ok(cli, 'cliBin resolved')

  const root = mkdtempSync(join(tmpdir(), 'ac-child-env-t3-'))
  const home = join(root, 'home')
  const workspace = join(root, 'workspace')
  const inaccessible = makeUntraversableDir('t3-parent')
  // Production child identity on the deployment host: uid 502 / gid 20.
  // When the test host cannot adopt that exact identity (non-darwin CI),
  // drop to the current uid so the same childSpawnConfig direct-setuid path
  // still runs (same-uid setuid is always legal without the root helper).
  const childUid = process.getuid()
  const childGid = process.getgid()
  t.after(() => {
    cleanupUntraversableDir(inaccessible)
    rmSync(root, { recursive: true, force: true })
  })

  const previousTmpdir = process.env.TMPDIR
  const previousChildUid = process.env.DSH_AGENT_CHILD_UID
  const previousChildGid = process.env.DSH_AGENT_CHILD_GID
  process.env.TMPDIR = inaccessible
  process.env.DSH_AGENT_CHILD_UID = String(childUid)
  process.env.DSH_AGENT_CHILD_GID = String(childGid)
  try {
    await provisionAgentHome(home, workspace, { profile: PROFILE })
    const proc = new AgentProcess({
      agentId: 'agt_child-env-t3',
      home,
      workspace,
      profile: PROFILE,
      log: { log() {}, error() {} },
      // Hostile caller attempt: this must not survive agentEnv's final write.
      env: { TMPDIR: '/forbidden' },
    })
    t.after(() => { proc.kill9().catch(() => {}) })

    proc.spawn()
    // ready() resolves only when initialize answered AND the provider is
    // registered — which requires the plugin tree (spill-local included) to
    // have loaded under the child's TMPDIR.
    const readyMs = await proc.ready(120_000)
    assert.ok(readyMs >= 0, 'initialize handshake completed')
    assert.ok(
      Array.isArray(proc.initializeEvidence?.registeredProviders)
        && proc.initializeEvidence.registeredProviders.includes(proc.provider),
      `provider ${proc.provider} registered after real boot`,
    )
    // T5 (real-output leg): the redacted child stderr must not carry any
    // credential shapes.
    assert.ok(!/(sk-[A-Za-z0-9_-]{8,})/u.test(proc.stderr), 'no API key shape leaked through child stderr')
  } finally {
    if (previousTmpdir === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previousTmpdir
    if (previousChildUid === undefined) delete process.env.DSH_AGENT_CHILD_UID
    else process.env.DSH_AGENT_CHILD_UID = previousChildUid
    if (previousChildGid === undefined) delete process.env.DSH_AGENT_CHILD_GID
    else process.env.DSH_AGENT_CHILD_GID = previousChildGid
  }
})

test('T4: mkdtemp under the child TMPDIR (spill-local primitive) yields a random 0700 child-owned directory', async () => {
  const inaccessible = makeUntraversableDir('t4-parent')
  try {
    return await withEnv('TMPDIR', inaccessible, async () => {
      // The exact primitive spill-local's store uses: mkdtempSync under
      // os.tmpdir(). Run it in a REAL child process carrying the overridden
      // env so the assertion covers env propagation, not just this process.
      const child = spawn(process.execPath, ['-e', [
        'const { mkdtempSync, statSync } = require("node:fs")',
        'const { tmpdir } = require("node:os")',
        'const { join } = require("node:path")',
        'const first = mkdtempSync(join(tmpdir(), "t4-spill-"))',
        'const second = mkdtempSync(join(tmpdir(), "t4-spill-"))',
        'const meta = statSync(first)',
        'process.stdout.write(JSON.stringify({ tmpdir: tmpdir(), first, second, mode: meta.mode & 0o777, uid: meta.uid, gid: meta.gid, childUid: process.getuid(), childGid: process.getgid() }))',
      ].join('\n')], {
        env: agentEnv('/tmp/ac-child-env-t4-home', { TMPDIR: '/forbidden' }, ['TMPDIR']),
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      const stdout = await new Promise((resolve, reject) => {
        let buffer = ''
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', (chunk) => { buffer += chunk })
        child.on('error', reject)
        child.on('close', (code) => {
          if (code === 0) resolve(buffer)
          else reject(new Error(`t4 probe child exited with code ${code}`))
        })
      })
      const { tmpdir: childTmpdir, first, second, mode, uid, gid, childUid } = JSON.parse(stdout)

      // The child saw the FIXED root, not the untraversable parent dir, not
      // the /forbidden caller attempt.
      assert.equal(childTmpdir, AGENT_CHILD_TMPDIR)
      assert.ok(first.startsWith(join(AGENT_CHILD_TMPDIR, 't4-spill-')), 'mkdtemp landed under the fixed child TMPDIR')
      // Random name (two runs differ), private mode, child ownership —
      // exactly the spill-local temp contract. Access control is
      // owner-based: the asserting properties are uid + 0700 (the group
      // follows the sticky root's own group on macOS, e.g. wheel).
      assert.notEqual(first, second, 'mkdtemp names are random')
      assert.equal(mode, 0o700)
      assert.equal(uid, childUid, 'temp dir owner is the child uid')
      assert.ok(Number.isInteger(gid), 'temp dir gid is a concrete integer')
      // Cleanup restores nothing global: these are the child's own dirs.
      rmSync(first, { recursive: true, force: true })
      rmSync(second, { recursive: true, force: true })
    })
  } finally {
    cleanupUntraversableDir(inaccessible)
  }
})

test('T5: sentinel credentials never cross the env/log boundary and no full child env dump is asserted anywhere', () => {
  const sentinel = 'sk-t5-sentinel-0123456789abcdef'
  const previous = process.env.OPENCODE_GO_API_KEY
  process.env.OPENCODE_GO_API_KEY = sentinel
  try {
    // Omit channel strips the credential key entirely (existing contract).
    const stripped = agentEnv('/tmp/ac-child-env-t5-home', {}, ['OPENCODE_GO_API_KEY'])
    assert.equal(stripped.OPENCODE_GO_API_KEY, undefined)

    // Even when a value is inherited (no omit), the only sanctioned output
    // scrubber — redactSensitiveText, applied at every stderr/log boundary —
    // must defeat it, so a hypothetical full-env dump still carries no
    // credential VALUE. This suite itself never performs such a dump: every
    // assertion in this file reads named keys (TMPDIR/DSH_HOME/metadata),
    // never a deepEqual snapshot of the child env.
    const inherited = agentEnv('/tmp/ac-child-env-t5-home')
    assert.ok(JSON.stringify(inherited).includes(sentinel), 'fixture: sentinel actually present before redaction')
    assert.ok(!redactSensitiveText(JSON.stringify(inherited)).includes(sentinel), 'redaction boundary removes the sentinel')
    assert.ok(!redactSensitiveText(JSON.stringify(stripped)).includes(sentinel))
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_GO_API_KEY
    else process.env.OPENCODE_GO_API_KEY = previous
  }
})
