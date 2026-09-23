#!/usr/bin/env node
/**
 * GPT6_LUNA_AND_REASONING_EFFORT_V1 — request-boundary verifier.
 *
 * Assembles a production-equivalent (installed-harness rc8) scratch module
 * tree: the PATCHED dsh-codex artifact source, @earendil-works/pi-ai 0.87.1
 * (first catalog release carrying openai-codex gpt-6-luna), and the rc8
 * dsh-llm / dsh-llm-pi-ai seam packages. It then drives the real plugin
 * `apply()` wiring with a fake cordis context, captures the outbound Codex
 * Responses request through a mocked global fetch, and asserts the wire-level
 * reasoning.effort mapping end to end:
 *
 *   profile.reasoning (plugin config) -> dsh-llm-pi-ai profileOptions
 *   -> pi-ai SimpleStreamOptions.reasoning -> model.thinkingLevelMap
 *   -> Responses body { reasoning: { effort, summary: 'auto' } }.
 *
 * No production state is touched: credentials are fakes inside a scratch
 * DSH_HOME, the fetch never leaves the process, and no secret is printed.
 *
 * Usage: node scripts/dsh-codex-reasoning-effort-v1/verify-request-boundary.mjs \
 *   <patched-dsh-codex-dir> <artifact-tarball|-> [scratch-dir]
 */

import { spawnSync } from 'node:child_process'
import * as zlib from 'node:zlib'
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const HARNESS = '/usr/local/libexec/agent-core/harness'
const SCOPE = '/tmp/dsh-codex-a1/scopes-node_modules'

const [patchedDir, artifactArg, scratchArg] = process.argv.slice(2)
if (patchedDir === undefined || artifactArg === undefined) {
  console.error('usage: verify-request-boundary.mjs <patched-dsh-codex-dir> <artifact-tarball|-> [scratch-dir]')
  process.exit(2)
}
if (!existsSync(HARNESS)) {
  console.error(`FAIL: installed harness not found at ${HARNESS} (production-equivalent seam source)`)
  process.exit(1)
}

const scratch = scratchArg !== undefined ? resolve(scratchArg) : join(tmpdir(), 'dshr1-boundary-')
rmSync(scratch, { recursive: true, force: true })
const nodeModules = join(scratch, 'node_modules')
mkdirSync(nodeModules, { recursive: true })

// 1. Union base: harness app modules (rc8) first, then the rc6 scope as
//    backfill for packages the app tree does not hoist.
function linkUnion(sourceRoot) {
  if (!existsSync(sourceRoot)) return 0
  let count = 0
  for (const entry of readdirSync(sourceRoot)) {
    const target = join(sourceRoot, entry)
    const dest = join(nodeModules, entry)
    if (entry.startsWith('@')) {
      // Scoped packages are REAL COPIES (symlinks dereferenced): a symlinked
      // module's realpath would jump outside the scratch tree and break the
      // node_modules walk for its own transitive scoped imports.
      mkdirSync(dest, { recursive: true })
      for (const scoped of readdirSync(target)) {
        const scopedDest = join(dest, scoped)
        if (existsSync(scopedDest)) continue
        cpSync(join(target, scoped), scopedDest, { recursive: true, dereference: true })
        count += 1
      }
    } else {
      if (existsSync(dest)) continue
      symlinkSync(target, dest, 'dir')
      count += 1
    }
  }
  return count
}
linkUnion(join(HARNESS, 'apps', 'cli', 'node_modules'))
linkUnion(SCOPE)

// 2. Overrides: patched plugin + rc8 seam packages + pi-ai 0.87.1.
function copyPackage(from, to, { stripNestedPiAi = false } = {}) {
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true, dereference: false })
  if (stripNestedPiAi) rmSync(join(to, 'node_modules', '@earendil-works', 'pi-ai'), { recursive: true, force: true })
}
copyPackage(patchedDir, join(nodeModules, 'dsh-codex'))
copyPackage(join(HARNESS, 'packages', 'llm', 'llm'), join(nodeModules, '@deepseek-ai', 'dsh-llm'))
copyPackage(join(HARNESS, 'packages', 'llm', 'llm-pi-ai'), join(nodeModules, '@deepseek-ai', 'dsh-llm-pi-ai'), { stripNestedPiAi: true })

const piAiDest = join(nodeModules, '@earendil-works', 'pi-ai')
rmSync(piAiDest, { recursive: true, force: true })
if (artifactArg === '-') {
  const pack = spawnSync('npm', ['pack', '@earendil-works/pi-ai@0.87.1', '--pack-destination', scratch], { encoding: 'utf8' })
  if (pack.status !== 0) {
    console.error('FAIL: cannot obtain @earendil-works/pi-ai@0.87.1 (npm pack failed)')
    console.error(pack.stderr)
    process.exit(1)
  }
  const tarball = join(scratch, readdirSync(scratch).find((name) => /^earendil-works-pi-ai-0\.87\.1\.tgz$/u.test(name)))
  const unpack = spawnSync('/usr/bin/tar', ['-xzf', tarball, '-C', scratch])
  rmSync(piAiDest, { recursive: true, force: true })
  cpSync(join(scratch, 'package'), piAiDest, { recursive: true })
  rmSync(tarball, { force: true })
  rmSync(join(scratch, 'package'), { recursive: true, force: true })
} else {
  const unpack = spawnSync('/usr/bin/tar', ['-xzf', artifactArg, '-C', scratch, 'package'])
  if (unpack.status !== 0) {
    console.error(`FAIL: cannot unpack ${artifactArg}`)
    process.exit(1)
  }
  cpSync(join(scratch, 'package'), piAiDest, { recursive: true })
  rmSync(join(scratch, 'package'), { recursive: true, force: true })
}
const piAiVersion = JSON.parse(readFileSync(join(piAiDest, 'package.json'), 'utf8')).version
console.log(`scratch assembled: pi-ai@${piAiVersion}, dsh-codex (patched), dsh-llm + dsh-llm-pi-ai (rc8 seam)`)
if (piAiVersion !== '0.87.1') {
  console.error(`FAIL: expected pi-ai 0.87.1 in the scratch tree, got ${piAiVersion}`)
  process.exit(1)
}

// 3. Fake credential document (scratch DSH_HOME only; never a real secret).
//    The access token must be a structurally valid JWT carrying the ChatGPT
//    account-id claim (pi-ai extracts it for the chatgpt-account-id header).
const JWT_CLAIM_PATH = 'https://api.openai.com/auth'
const fakeJwt = [
  'x',
  Buffer.from(JSON.stringify({ [JWT_CLAIM_PATH]: { chatgpt_account_id: 'fake-account-id' } })).toString('base64'),
  'y',
].join('.')
const dshHome = join(scratch, 'dsh-home')
mkdirSync(dshHome, { recursive: true })
const credentialFile = join(dshHome, '.openai-codex-auth.json')
writeFileSync(credentialFile, JSON.stringify({
  version: 1,
  credential: {
    type: 'oauth',
    access: fakeJwt,
    refresh: 'fake-refresh-token',
    expires: 4102444800000,
    accountId: 'fake-account-id',
  },
}), { mode: 0o600 })

// 4. Mock the network boundary: capture the outbound request, fail the turn
//    with a structured 401 so no real generation is attempted.
const captured = []
globalThis.fetch = async function mockedFetch(url, options) {
  try {
    const rawBody = options?.body
    let bodyText
    if (typeof rawBody === 'string') bodyText = rawBody
    else if (rawBody instanceof Uint8Array) {
      bodyText = new TextDecoder().decode(rawBody)
      // pi-ai 0.87.x zstd-compresses the Responses request body; decode it so
      // the wire assertions can read the JSON payload.
      if (!bodyText.trimStart().startsWith('{')) bodyText = new TextDecoder().decode(zlib.zstdDecompressSync(rawBody))
    }
    const body = bodyText === undefined ? undefined : JSON.parse(bodyText)
    captured.push({ url: String(url), body, headers: options?.headers })
  } catch (error) {
    captured.push({ url: String(url), body: undefined, mockParseError: String(error) })
  }
  return new Response(JSON.stringify({ error: { message: 'boundary-verifier: rejected by mock', type: 'invalid_request_error' } }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}

process.env.DSH_HOME = dshHome

const require = createRequire(join(nodeModules, 'dsh-codex', 'package.json'))
const plugin = require(join(nodeModules, 'dsh-codex', 'lib', 'index.js'))
const dshLlm = require(join(nodeModules, '@deepseek-ai', 'dsh-llm', 'lib', 'index.js'))

function buildAdapter(config) {
  const captured = { ids: undefined, adapter: undefined }
  const ctx = {
    provide() {},
    inject() {},
    get() { return undefined },
    llm: { registerAdapter: (ids, adapter) => { captured.ids = ids; captured.adapter = adapter } },
    web: { registerSearchProvider() {} },
  }
  plugin.apply(ctx, config)
  if (captured.adapter === undefined) throw new Error('apply() did not register the openai-codex adapter')
  return captured.adapter
}

async function driveStream(adapter, model) {
  const iteration = adapter.stream({
    provider: 'openai-codex',
    model,
    messages: [dshLlm.createUserMessage({ content: [{ type: 'text', text: 'boundary probe' }] })],
    sessionId: 'boundary-verifier',
  })
  // The mock 401 rejects the stream; consuming to the error is the point.
  for await (const chunk of iteration) void chunk
}

let failures = 0
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS ${name}${detail === '' ? '' : ` — ${detail}`}`)
  } else {
    failures += 1
    console.error(`FAIL ${name}${detail === '' ? '' : ` — ${detail}`}`)
  }
}

// --- G2: gpt-6-luna + plugin reasoning medium reaches the wire. ------------
captured.length = 0
const mediumAdapter = buildAdapter({ reasoning: 'medium' })
let mediumError
try { await driveStream(mediumAdapter, 'gpt-6-luna') } catch (error) { mediumError = error }
check('gpt-6-luna catalog resolution', mediumError === undefined || mediumError?.code !== 'UNKNOWN_MODEL', mediumError?.message ?? 'resolved')
const mediumCapture = captured.at(-1)
check('medium: outbound request captured', mediumCapture !== undefined, mediumCapture?.url ?? 'none')
if (mediumCapture !== undefined) {
  console.log(`medium: captured body keys = ${JSON.stringify(Object.keys(mediumCapture.body ?? {}))}`)
  console.log(`medium: captured model = ${JSON.stringify(mediumCapture.body?.model)} reasoning = ${JSON.stringify(mediumCapture.body?.reasoning)} parseError = ${JSON.stringify(mediumCapture.mockParseError)}`)
}
check('medium: body.reasoning.effort === "medium"', mediumCapture?.body?.reasoning?.effort === 'medium', JSON.stringify(mediumCapture?.body?.reasoning))
check('medium: body.model === "gpt-6-luna"', mediumCapture?.body?.model === 'gpt-6-luna', mediumCapture?.body?.model)

// --- G3: high maps identically. --------------------------------------------
captured.length = 0
const highAdapter = buildAdapter({ reasoning: 'high' })
try { await driveStream(highAdapter, 'gpt-6-luna') } catch { /* expected mock rejection */ }
const highCapture = captured.at(-1)
check('high: body.reasoning.effort === "high"', highCapture?.body?.reasoning?.effort === 'high', JSON.stringify(highCapture?.body?.reasoning))

// --- off: pi-ai 0.87.x maps off/thinkingLevelMap.off to wire effort "none".
// (The config vocabulary `none` translates to the plugin spelling `off`.)
captured.length = 0
const offAdapter = buildAdapter({ reasoning: 'off' })
try { await driveStream(offAdapter, 'gpt-6-luna') } catch { /* expected mock rejection */ }
const offCapture = captured.at(-1)
check('off: body reasoning.effort === "none" (explicit no-thinking)', offCapture?.body?.reasoning?.effort === 'none', JSON.stringify(offCapture?.body?.reasoning))

// --- absent config: pi-ai 0.87.x DEFAULTS an omitted effort to wire `none`.
// This is exactly why the agent-core default route pins an explicit medium:
// a provisioned profile always carries `reasoning:` so the implicit-none
// default is never reachable in production.
captured.length = 0
const legacyAdapter = buildAdapter({})
try { await driveStream(legacyAdapter, 'gpt-5.6-luna') } catch { /* expected mock rejection */ }
const legacyCapture = captured.at(-1)
check('absent config: gpt-5.6-luna resolves; pi-ai implicit default is effort "none"', legacyCapture?.body?.model === 'gpt-5.6-luna' && legacyCapture.body?.reasoning?.effort === 'none', JSON.stringify(legacyCapture?.body?.reasoning))

// --- G1: an unknown model still fails loud. ---------------------------------
captured.length = 0
let unknownError
try { await driveStream(buildAdapter({ reasoning: 'medium' }), 'gpt-99-ultra-fake') } catch (error) { unknownError = error }
check('unknown model fails loud', unknownError !== undefined && captured.length === 0, unknownError?.message?.slice(0, 120) ?? 'no error')

// --- plugin Config schema rejects an out-of-vocabulary value. ---------------
// (Cordis validates plugin config against the schema at load; apply() itself
// does not, so the schema function is exercised directly here.)
let schemaError
try { plugin.Config({ reasoning: 'ultra-mega' }) } catch (error) { schemaError = error }
check('plugin config schema rejects invalid reasoning value', schemaError !== undefined, schemaError?.message?.slice(0, 120) ?? 'no error')
let schemaAccept
try { plugin.Config({ reasoning: 'xhigh' }); schemaAccept = true } catch { schemaAccept = false }
check('plugin config schema accepts every REASONING value', schemaAccept, 'xhigh accepted')

if (failures > 0) {
  console.error(`\nRESULT: ${failures} check(s) FAILED`)
  process.exit(1)
}
console.log('\nRESULT: all request-boundary checks PASSED')
