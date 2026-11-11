/** Transport wiring controls; real native loop composition is tested separately. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'

async function boot(t, { required = true, marker, parentVersion } = {}) {
  const program = `
    import { apply } from ${JSON.stringify(new URL('../src/index.js', import.meta.url).href)};
    const services = { goalRoundDriver: ${JSON.stringify(marker ?? null)} };
    const ctx = { get: key => services[key], provide: (key, value) => { services[key] = value },
      on: () => () => {}, root: { fiber: { dispose: async () => {} } } };
    apply(ctx, { nativeGoalContinuation: ${required} });
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], {
    env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'exit') } })
  let output = '', errors = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { errors += chunk })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    cwd: '/isolated-native-goal-test', nativeGoalContinuation: { version: parentVersion },
  } }) + '\n')
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    const result = output.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(value => value.id === 1)
    if (result) return result
    if (child.exitCode !== null) throw new Error(errors)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`initialize did not settle: ${errors}`)
}

test('required composition rejects missing or old native hook and missing parent protocol', async t => {
  for (const options of [
    { marker: null, parentVersion: 1 },
    { marker: { protocolVersion: 1, enqueueMode: 'native' }, parentVersion: 1 },
    { marker: { protocolVersion: 1, enqueueMode: 'external' } },
  ]) {
    const response = await boot(t, options)
    assert.equal(response.error?.code, 'NATIVE_GOAL_PROTOCOL_UNAVAILABLE')
  }
})

test('required compatible composition returns explicit version and legacy ordinary mode stays optional', async t => {
  const response = await boot(t, { marker: { protocolVersion: 1, enqueueMode: 'external' }, parentVersion: 1 })
  assert.equal(response.error, undefined)
  assert.deepEqual(response.result.nativeGoalContinuation, { version: 1 })
  const ordinary = await boot(t, { required: false })
  assert.equal(ordinary.error, undefined)
  assert.equal(ordinary.result.nativeGoalContinuation, null)
})
