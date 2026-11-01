import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(process.argv[2])
const packageRoot = resolve(process.argv[3])
const browserAttempts = []
const spawn = childProcess.spawn
childProcess.spawn = (command, args) => {
  assert.ok(['open', 'xdg-open', 'rundll32.exe'].includes(command), 'fixture only intercepts browser opener; unexpected subprocess refuses')
  browserAttempts.push({ command, args })
  const child = new EventEmitter(); child.unref = () => {}; return child
}
syncBuiltinESMExports()
const originalFetch = globalThis.fetch
const calls = []
const jwt = email => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' }, ...(email ? { email } : {}) })).toString('base64url')}.signature`
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (!url.startsWith('https://auth.openai.com/')) return originalFetch(input, init)
  calls.push({ url, grant: init?.body instanceof URLSearchParams ? init.body.get('grant_type') : undefined })
  if (url.endsWith('/deviceauth/usercode')) return Response.json({ device_auth_id: 'fixture-device', user_code: 'FIXTURE', interval: 0 })
  if (url.endsWith('/deviceauth/token')) return Response.json({ authorization_code: 'fixture-approval', code_verifier: 'fixture-verifier' })
  if (url === 'https://auth.openai.com/oauth/token') return Response.json({ access_token: jwt(), refresh_token: 'fixture-owner-new', id_token: jwt('fixture@example.invalid'), expires_in: 3600 })
  throw Error('unexpected synthetic OAuth endpoint')
}
const observations = []
let result = 'PASS'
try {
  const plugin = await import(pathToFileURL(join(packageRoot, 'lib/index.js')).href)
  const store = new plugin.OpenAICodexCredentialStore()
  assert.ok(store.filename.startsWith(process.env.DSH_HOME + '/'), 'CLI default store stays inside synthetic DSH_HOME')
  await store.modify(plugin.OPENAI_CODEX_PROVIDER, async () => ({ type: 'oauth', access: jwt(), refresh: 'fixture-old', accountId: 'fixture-account', expires: Date.now() + 3600000 }))
  const cli = await import(pathToFileURL(join(packageRoot, 'lib/bin.js')).href)
  assert.equal(await cli.run(['login', '--device-code']), 0)
  assert.equal((await store.read(plugin.OPENAI_CODEX_PROVIDER)).email, 'fixture@example.invalid')
  await assert.rejects(fs.stat(store.refreshIntentFilename), { code: 'ENOENT' })
  assert.equal(calls.filter(call => call.grant === 'refresh_token').length, 1)
  assert.equal(browserAttempts.length, 1)
  const output = []
  const stdoutWrite = process.stdout.write
  let statusCode
  try {
    process.stdout.write = chunk => { output.push(String(chunk)); return true }
    statusCode = await cli.run(['status', '--json'])
  } finally { process.stdout.write = stdoutWrite }
  assert.equal(statusCode, 0)
  const status = JSON.parse(output.join(''))
  assert.equal(status.status, 'signed-in')
  assert.equal(status.package, 'dsh-codex')
  assert.equal(status.version, '0.3.2')
  assert.equal(calls.length, 4, 'status adds no OAuth calls')
  console.log(JSON.stringify(status))
  observations.push({ name: 'released CLI run login --device-code and status --json use real auth/store on valid nonshared default document', result: 'PASS', explicitCompletingRefreshGrants: 1, syntheticProviderCalls: calls.length, browserOpenersSuppressed: browserAttempts.length, defaultStoreInsideSyntheticDshHome: true })
  console.log('PASS compiled CLI normal nonshared login/status with synthetic fetch; no actual browser spawned')
} catch (error) {
  result = 'FAIL'; process.exitCode = 1; console.error(error)
  observations.push({ result: 'FAIL', error: { name: error.name, message: error.message, stack: error.stack } })
} finally {
  childProcess.spawn = spawn; syncBuiltinESMExports(); globalThis.fetch = originalFetch
  await fs.writeFile(join(root, 'cli-extra-result.json'), JSON.stringify({ result, observedAt: new Date().toISOString(), observations, calls, browserAttempts, proofScope: 'compiled CLI run(argv) export, argument parser/stdin facade/auth/provider/store unmocked; synthetic fetch; browser launcher replaced with no-op emitter', limits: ['Not dsh plugin exec wrapper or actual installed Harness', 'No real OAuth or production credential access', 'Valid default nonshared CLI path only; no malformed/pending shared recovery or canonical credentialFile selection claim'], productionAdmissionEstablished: false }, null, 2) + '\n')
}
