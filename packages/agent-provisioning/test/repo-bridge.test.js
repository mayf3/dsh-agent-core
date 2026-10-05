import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const sourceRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function fixture(t, { immutable = false, missingBridgeDir = false, physicalImmutable = false } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'agent-core-repo-bridge-')))
  t.after(() => {
    if (existsSync(bridge)) chmodSync(bridge, 0o700)
    rmSync(dir, { recursive: true, force: true })
  })
  const repo = join(dir, 'repo')
  const bridge = join(repo, 'node_modules', '@agent-core')
  cpSync(join(sourceRepo, 'packages/agent-provisioning/src'), join(repo, 'packages/agent-provisioning/src'), { recursive: true })
  writeFileSync(join(repo, 'package.json'), '{"type":"module"}')
  cpSync(join(sourceRepo, 'profile-production'), join(repo, 'profile-production'), { recursive: true })
  // Actual production profile/farm declarations, isolated from real homes,
  // settings, credentials, harnesses and backends.
  const source = readFileSync(join(sourceRepo, 'packages/agent-provisioning/src/index.js'), 'utf8')
  const farm = source.match(/'agent-core-production':\s*\{[\s\S]*?farmLinks:\s*\{([\s\S]*?)\}/)[1]
  for (const [, name, target] of farm.matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    const path = join(repo, target)
    mkdirSync(path, { recursive: true })
    writeFileSync(join(path, 'package.json'), JSON.stringify({ name: `@agent-core/${name}` }))
  }
  const unrelated = join(repo, 'packages/agent-identity-capabilities')
  mkdirSync(unrelated, { recursive: true })
  writeFileSync(join(unrelated, 'package.json'), '{"name":"@agent-core/agent-identity-capabilities"}')
  mkdirSync(join(dir, 'isolated-home'))
  if (!missingBridgeDir) mkdirSync(bridge, { recursive: true })

  function run(body) {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      import assert from 'node:assert/strict';
      import { join, resolve } from 'node:path';
      const repo = ${JSON.stringify(repo)};
      const bridge = ${JSON.stringify(bridge)};
      const protectedPath = p => typeof p === 'string' && (resolve(p) === join(repo, 'node_modules') || resolve(p).startsWith(join(repo, 'node_modules') + '/'));
      const writes = [];
      if (${physicalImmutable}) fs.chmodSync(bridge, 0o555);
      if (${immutable}) {
        const access = fs.accessSync;
        fs.accessSync = (p, mode) => {
          if (!${physicalImmutable} && protectedPath(p) && mode === fs.constants.W_OK) throw Object.assign(new Error('immutable fixture'), { code: 'EACCES' });
          return access(p, mode);
        };
        for (const name of ['mkdirSync', 'symlinkSync', 'rmSync', 'renameSync', 'writeFileSync', 'copyFileSync']) {
          const original = fs[name];
          fs[name] = (...args) => {
            const destination = ['symlinkSync', 'renameSync', 'copyFileSync'].includes(name) ? args[1] : args[0];
            if (protectedPath(destination)) {
              writes.push({ name, destination });
              throw Object.assign(new Error('attempted immutable repository write: ' + destination), { code: 'EACCES' });
            }
            return original(...args);
          };
        }
        syncBuiltinESMExports();
      }
      const mod = await import(${JSON.stringify(join(repo, 'packages/agent-provisioning/src/index.js'))});
      ${body}
      assert.equal(writes.length, 0, 'immutable repository must receive no topology-write attempts');
    `], {
      encoding: 'utf8',
      env: { ...process.env, HOME: join(dir, 'isolated-home'), DSH_SETTINGS_SOURCE: join(dir, 'absent-settings.yaml') },
    })
    assert.equal(child.status, 0, child.stderr || child.stdout)
  }
  return { dir, repo, bridge, run }
}

test('writable dev repository still creates every workspace/bundle bridge', t => {
  const f = fixture(t)
  f.run('mod.ensureRepoCoreBridge();')
  assert.equal(readlinkSync(join(f.bridge, 'agent-identity-capabilities')), join(f.repo, 'packages/agent-identity-capabilities'))
  assert.equal(readlinkSync(join(f.bridge, 'bundle-memory')), join(f.repo, 'bundle-memory'))
})

test('writable dev repository still repairs a genuinely wrong existing bridge', t => {
  const f = fixture(t)
  symlinkSync(f.repo, join(f.bridge, 'agent-memory'))
  f.run('mod.ensureRepoCoreBridge();')
  assert.equal(readlinkSync(join(f.bridge, 'agent-memory')), join(f.repo, 'packages/agent-memory'))
})

test('immutable repo skips missing unrelated identity package with no topology-write attempt', t => {
  const f = fixture(t, { immutable: true })
  f.run('mod.ensureRepoCoreBridge();')
  assert.equal(existsSync(join(f.bridge, 'agent-identity-capabilities')), false)
})

test('immutable repo rejects a wrong existing bridge without repairing it', t => {
  const f = fixture(t, { immutable: true })
  symlinkSync(f.repo, join(f.bridge, 'agent-memory'))
  f.run("assert.throws(() => mod.ensureRepoCoreBridge(), /immutable repository bridge mismatch/);")
  assert.equal(readlinkSync(join(f.bridge, 'agent-memory')), f.repo)
})

test('immutable repo accepts a realpath-equivalent existing bridge without rewriting it', t => {
  const f = fixture(t, { immutable: true })
  symlinkSync(join(f.repo, 'packages'), join(f.dir, 'package-alias'))
  symlinkSync(join(f.dir, 'package-alias', 'agent-memory'), join(f.bridge, 'agent-memory'))
  f.run('mod.ensureRepoCoreBridge();')
  assert.equal(readlinkSync(join(f.bridge, 'agent-memory')), join(f.dir, 'package-alias', 'agent-memory'))
})

test('immutable repo rejects a dangling link and a plain-file impostor without writes', t => {
  for (const kind of ['dangling', 'file']) {
    const f = fixture(t, { immutable: true })
    const link = join(f.bridge, 'agent-memory')
    if (kind === 'dangling') symlinkSync(join(f.repo, 'absent-target'), link)
    else writeFileSync(link, 'impostor')
    f.run("assert.throws(() => mod.ensureRepoCoreBridge(), /immutable repository bridge mismatch/);")
    if (kind === 'dangling') assert.equal(readlinkSync(link), join(f.repo, 'absent-target'))
    else assert.equal(readFileSync(link, 'utf8'), 'impostor')
  }
})

test('OS-denied writable access selects read-only provisioning without topology writes', { skip: process.getuid?.() === 0 }, t => {
  const f = fixture(t, { immutable: true, physicalImmutable: true })
  f.run('mod.ensureRepoCoreBridge();')
  assert.equal(existsSync(join(f.bridge, 'agent-identity-capabilities')), false)
})

test('immutable repo does not create a missing bridge directory', t => {
  const f = fixture(t, { immutable: true, missingBridgeDir: true })
  mkdirSync(join(f.repo, 'node_modules'))
  f.run('mod.ensureRepoCoreBridge();')
  assert.equal(existsSync(f.bridge), false)
})

test('actual agent-core-production profile provisions its writable home beside an immutable repo', t => {
  const f = fixture(t, { immutable: true })
  f.run(`
    const home = join(${JSON.stringify(f.dir)}, 'agent-home');
    mod.provisionAgentHome(home, join(${JSON.stringify(f.dir)}, 'workspace'), { profile: 'agent-core-production' });
    mod.provisionAgentHome(home, join(${JSON.stringify(f.dir)}, 'workspace'), { profile: 'agent-core-production' });
    const profile = JSON.parse(fs.readFileSync(join(home, 'profiles/agent-core-production/package.json'), 'utf8'));
    assert.equal(profile.name, 'dsh-profile-agent-core-production');
    for (const [name, target] of Object.entries(mod.AGENT_PROFILE_DEFS['agent-core-production'].farmLinks)) {
      assert.equal(fs.realpathSync(join(home, 'profiles/node_modules/@agent-core', name)), join(repo, target));
    }
    assert.equal(fs.existsSync(join(bridge, 'agent-identity-capabilities')), false);
    assert.equal(fs.existsSync(join(home, '.credentials.yaml')), false);
  `)
})
