import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mountDevelopmentExecutionRuntime } from '../../production-runtime/src/development-execution-runtime.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'core-retired-closure-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, devDir: join(root, 'development') }
}

function mount(devDir, mountRuntime = mountDevelopmentExecutionRuntime) {
  const services = new Map()
  const runtime = mountRuntime({
    ctx: { provide: (name, value) => services.set(name, value) },
    layout: { developmentExecutionDir: devDir },
    writerAuthorityRetired: false,
  })
  assert.equal(services.get('developmentExecutionAccess').engine, runtime.engine)
  return runtime
}

function seed(devDir, events) {
  mkdirSync(join(devDir, 'ledger'), { recursive: true })
  const bytes = events.map((event) => JSON.stringify(event)).join('\n') + '\n'
  writeFileSync(join(devDir, 'ledger', 'executions.jsonl'), bytes)
  return bytes
}

const started = {
  atMs: 1000, type: 'execution_started', executionId: 'historical',
  backend: 'codex', repo: 'core', worktree: '/historical/worktree',
  baseSha: '0'.repeat(40), branch: 'legacy/repair', agentId: 'legacy-agent',
}

test('retired production mount reads history without parsing retired backend or repository configuration', async (t) => {
  const { devDir } = fixture(t)
  const bytes = seed(devDir, [started, {
    atMs: 2000, type: 'state', executionId: 'historical', state: 'RUNNING', pid: 999999999,
  }])
  writeFileSync(join(devDir, 'backend.json'), '{ malformed retired backend config')
  writeFileSync(join(devDir, 'repos.json'), '{ malformed retired repository config')
  const { engine, handlers } = mount(devDir)
  const response = await handlers.development_execute.status({ executionId: 'historical' })
  assert.equal(response.ok, true)
  assert.equal(response.result.state, 'RUNNING')
  assert.equal(engine.result('historical').terminal, false)
  assert.equal(readFileSync(join(devDir, 'ledger', 'executions.jsonl'), 'utf8'), bytes)
})

test('absent history remains absent across production mount, reads, and writer refusal', async (t) => {
  const { devDir } = fixture(t)
  const { engine, handlers } = mount(devDir)
  assert.equal(existsSync(devDir), false, 'mount must not create the retired ledger directory')
  assert.throws(() => engine.status('missing'), (error) => error.code === 'execution_not_found')
  assert.throws(() => engine.result('missing'), (error) => error.code === 'execution_not_found')
  const retired = (error) => error.code === 'writer_authority_retired'
  await assert.rejects(() => handlers.development_execute.start({}, { callerAgentId: 'agent' }), retired)
  await assert.rejects(() => handlers.development_execute.continue({}, { callerAgentId: 'agent' }), retired)
  await assert.rejects(() => handlers.development_execute.cancel({}), retired)
  assert.equal(existsSync(devDir), false, 'refusals must not initialize execution storage')
})

test('historical terminal receipt, continuation disposition, and error projection survive repeated mounts without writes', async (t) => {
  const { devDir } = fixture(t)
  const bytes = seed(devDir, [started,
    { atMs: 1500, type: 'state', executionId: 'historical', state: 'RUNNING', pid: 42, sessionId: 'legacy-session' },
    { atMs: 1600, type: 'continue_requested', executionId: 'historical', instruction: 'verify' },
    { atMs: 1700, type: 'continue_delivery', executionId: 'historical', instruction: 'verify', disposition: 'delivered' },
    { atMs: 3000, type: 'terminal', executionId: 'historical', terminalState: 'FAILED',
      candidateSha: 'a'.repeat(40), changedFiles: ['app.js'],
      testEvidence: { ran: true, evidenceRefs: [7, 'test-log'] }, reviewEvidence: { verdict: 'REJECTED' },
      errorClass: 'test_failed', failureDetail: 'historical failure', evidenceRefs: ['receipt-log'] },
  ])
  const expected = {
    executionId: 'historical', backend: 'codex', terminalState: 'FAILED', repo: 'core',
    worktree: '/historical/worktree', baseSha: '0'.repeat(40), candidateSha: 'a'.repeat(40),
    changedFiles: ['app.js'], tests: { ran: true, evidenceRefs: ['7', 'test-log'] },
    startedAt: 1000, terminalAt: 3000, failureClass: 'test_failed',
    failureDetail: 'historical failure', evidenceRefs: ['receipt-log'],
  }
  for (let restart = 0; restart < 2; restart++) {
    const { engine, handlers } = mount(devDir)
    assert.deepEqual(engine.result('historical').receipt, expected)
    const { result } = await handlers.development_execute.status({ executionId: 'historical' })
    assert.deepEqual(result.continueRequests, [{ instruction: 'verify', disposition: 'delivered', atMs: 1600 }])
    assert.equal(result.pid, 42)
    assert.equal(result.sessionId, 'legacy-session')
    assert.equal(result.updatedAt, 3000)
    assert.deepEqual(result.reviewEvidence, { verdict: 'REJECTED' })
  }
  assert.equal(readFileSync(join(devDir, 'ledger', 'executions.jsonl'), 'utf8'), bytes)
})

test('corrupt historical evidence still fails loudly without rewriting or reconciling it', (t) => {
  const { devDir } = fixture(t)
  mkdirSync(join(devDir, 'ledger'), { recursive: true })
  const bytes = '{ corrupt evidence\n'
  writeFileSync(join(devDir, 'ledger', 'executions.jsonl'), bytes)
  assert.throws(() => mount(devDir), /corrupt \(unparseable\) executions\.jsonl line/)
  assert.equal(readFileSync(join(devDir, 'ledger', 'executions.jsonl'), 'utf8'), bytes)
})

test('production imports, replay and refusals do not invoke filesystem or process mutation primitives', (t) => {
  const { devDir } = fixture(t)
  const bytes = seed(devDir, [started, { atMs: 2000, type: 'state', executionId: 'historical', state: 'RUNNING', pid: 999999999 }])
  const wrapperUrl = pathToFileURL(join(repoRoot, 'packages/production-runtime/src/development-execution-runtime.js')).href
  // Patch built-ins before importing the production dependency cone in a fresh
  // process. Any accidental constructor, orphan recovery or writer effect fails
  // at the actual primitive, including writes outside the fixture directory.
  const probe = `
    import fs from 'node:fs';
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import assert from 'node:assert/strict';
    const deny = (name) => () => { throw new Error('retired effect reached: ' + name) };
    for (const name of ['mkdir', 'mkdirSync', 'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'write', 'writeSync', 'rm', 'rmSync', 'rename', 'renameSync']) fs[name] = deny(name);
    for (const name of ['open', 'openSync']) {
      const original = fs[name];
      fs[name] = (path, flags, ...args) => {
        if (flags !== 'r' && flags !== fs.constants.O_RDONLY) deny(name)();
        return original(path, flags, ...args);
      };
    }
    for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) childProcess[name] = deny(name);
    process.kill = deny('process.kill');
    syncBuiltinESMExports();
    const { mountDevelopmentExecutionRuntime } = await import(${JSON.stringify(wrapperUrl)});
    const { engine, handlers } = mountDevelopmentExecutionRuntime({ ctx: { provide() {} }, layout: { developmentExecutionDir: ${JSON.stringify(devDir)} } });
    assert.equal(engine.status('historical').state, 'RUNNING');
    assert.equal(engine.result('historical').terminal, false);
    for (const operation of ['start', 'continue', 'cancel']) {
      await assert.rejects(() => handlers.development_execute[operation](), (error) => error.code === 'writer_authority_retired');
    }
  `
  execFileSync(process.execPath, ['--input-type=module', '-e', probe])
  assert.equal(readFileSync(join(devDir, 'ledger', 'executions.jsonl'), 'utf8'), bytes)
})

test('canonical application packaging excludes the legacy writer and leaves the history facade independently importable', async (t) => {
  const { root, devDir } = fixture(t)
  const repoFixture = join(root, 'source')
  const packRoot = join(root, 'pack')
  mkdirSync(join(repoFixture, 'packages'), { recursive: true })
  mkdirSync(join(packRoot, 'app/packages'), { recursive: true })
  for (const name of ['production-runtime', 'development-execution']) {
    cpSync(join(repoRoot, 'packages', name), join(repoFixture, 'packages', name), { recursive: true })
  }
  // Execute the actual installer's package-copy section, without its privileged
  // runtime installation or cutover phases. This catches special-copy paths
  // that metadata-only package checks cannot see.
  const installer = readFileSync(join(repoRoot, 'scripts/trusted-cp-deploy-install.sh'), 'utf8')
  const from = installer.indexOf('# packages: package.json + src')
  const to = installer.indexOf('# bundles + profiles', from)
  assert.ok(from >= 0 && to > from, 'canonical package-copy section must be available')
  execFileSync('bash', ['-eu', '-c', installer.slice(from, to)], {
    cwd: packRoot,
    env: { ...process.env, REPO_SRC: repoFixture, TRUSTED_NODE: process.execPath,
      PACKAGE_COPY_HELPER: join(repoRoot, 'scripts/lib/trusted-app-package-copy.mjs') },
  })
  assert.equal(existsSync(join(packRoot, 'app/packages/development-execution')), false,
    'test-only writer machinery must not enter the canonical application pack')
  assert.equal(existsSync(join(packRoot, 'app/packages/production-runtime/test')), false)
  const packedModule = await import(pathToFileURL(join(packRoot, 'app/packages/production-runtime/src/development-execution-runtime.js')).href)
  const bytes = seed(devDir, [started, { atMs: 2000, type: 'state', executionId: 'historical', state: 'RUNNING', pid: 999999999 }])
  const { engine } = mount(devDir, packedModule.mountDevelopmentExecutionRuntime)
  assert.equal(engine.status('historical').state, 'RUNNING')
  await assert.rejects(() => engine.start({}, 'agent'), (error) => error.code === 'writer_authority_retired')
  assert.equal(readFileSync(join(devDir, 'ledger', 'executions.jsonl'), 'utf8'), bytes)
  assert.deepEqual(readdirSync(join(devDir, 'ledger')), ['executions.jsonl'])
})
