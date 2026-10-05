#!/usr/bin/env node
/**
 * GPT6_LUNA_AND_REASONING_EFFORT_V1 — REAL GPT-6 Luna canary (isolated).
 *
 * Drives one real generation turn against the ChatGPT Codex backend through
 * the patched dsh-codex artifact + pi-ai 0.87.1 + the installed rc8 harness
 * seam — the production-equivalent request path. Production state is NEVER
 * touched: the canonical OAuth store is READ once and COPYED into the scratch
 * tree; the canary runs against the copy, so even a successful token refresh
 * can never mutate the production credential domain.
 *
 * An observing fetch tap records the outbound request (decoding the
 * zstd-compressed body) so the evidence includes the actual model id and the
 * reasoning effort that reached the wire. Secrets (tokens/headers) are never
 * printed.
 *
 * Usage:
 *   node real-canary.mjs <patched-dsh-codex-dir> <real-credential-file> [model] [effort]
 */

import { spawnSync } from 'node:child_process'
import * as zlib from 'node:zlib'
import {
  chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const HARNESS = '/usr/local/libexec/agent-core/harness'
const SCOPE = '/tmp/dsh-codex-a1/scopes-node_modules'

const [patchedDir, credentialSource, modelArg, effortArg] = process.argv.slice(2)
if (patchedDir === undefined || credentialSource === undefined) {
  console.error('usage: real-canary.mjs <patched-dsh-codex-dir> <real-credential-file> [model=gpt-6-luna] [effort=medium]')
  process.exit(2)
}
if (!existsSync(credentialSource)) {
  console.error(`FAIL: credential file not found: ${credentialSource}`)
  process.exit(2)
}
const MODEL = modelArg ?? 'gpt-6-luna'
const EFFORT_PLUGIN = effortArg ?? 'medium'

// --- scratch tree (same assembly as verify-request-boundary.mjs) ------------
// realpath: macOS /var is a symlink and the credential store refuses any
// symlinked path component — the scratch must live on a real path.
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'dshr1-canary-')))
const nodeModules = join(scratch, 'node_modules')
mkdirSync(nodeModules, { recursive: true })

function linkUnion(sourceRoot) {
  if (!existsSync(sourceRoot)) return
  for (const entry of readdirSync(sourceRoot)) {
    const target = join(sourceRoot, entry)
    const dest = join(nodeModules, entry)
    if (entry.startsWith('@')) {
      mkdirSync(dest, { recursive: true })
      for (const scoped of readdirSync(target)) {
        const scopedDest = join(dest, scoped)
        if (existsSync(scopedDest)) continue
        cpSync(join(target, scoped), scopedDest, { recursive: true, dereference: true })
      }
    } else if (!existsSync(dest)) {
      symlinkSync(target, dest, 'dir')
    }
  }
}
linkUnion(join(HARNESS, 'apps', 'cli', 'node_modules'))
linkUnion(SCOPE)
rmSync(join(nodeModules, '@deepseek-ai', 'dsh-llm'), { recursive: true, force: true })
symlinkSync(join(HARNESS, 'packages', 'llm', 'llm'), join(nodeModules, '@deepseek-ai', 'dsh-llm'), 'dir')
rmSync(join(nodeModules, '@deepseek-ai', 'dsh-llm-pi-ai'), { recursive: true, force: true })
symlinkSync(join(HARNESS, 'packages', 'llm', 'llm-pi-ai'), join(nodeModules, '@deepseek-ai', 'dsh-llm-pi-ai'), 'dir')

cpSync(patchedDir, join(nodeModules, 'dsh-codex'), { recursive: true })
// pi-ai 0.87.1 via npm cache/registry
{
  const pack = spawnSync('npm', ['pack', '@earendil-works/pi-ai@0.87.1', '--pack-destination', scratch], { encoding: 'utf8' })
  if (pack.status !== 0) { console.error('FAIL: cannot obtain pi-ai 0.87.1'); process.exit(1) }
  spawnSync('/usr/bin/tar', ['-xzf', join(scratch, 'earendil-works-pi-ai-0.87.1.tgz'), '-C', scratch])
  rmSync(join(nodeModules, '@earendil-works', 'pi-ai'), { recursive: true, force: true })
  cpSync(join(scratch, 'package'), join(nodeModules, '@earendil-works', 'pi-ai'), { recursive: true })
  rmSync(join(scratch, 'package'), { recursive: true, force: true })
}

// --- isolated credential: one read-only COPY of the canonical store ---------
const dshHome = join(scratch, 'dsh-home')
mkdirSync(dshHome, { recursive: true, mode: 0o700 })
chmodSync(dshHome, 0o700)
const credentialCopy = join(dshHome, '.openai-codex-auth.json')
copyFileSync(credentialSource, credentialCopy)
chmodSync(credentialCopy, 0o600)

// Observing tap: records model + reasoning effort; NEVER records headers.
const observations = { url: undefined, model: undefined, reasoning: undefined, accountFingerprint: undefined }
const realFetch = globalThis.fetch
globalThis.fetch = async function observingFetch(url, options) {
  try {
    const raw = options?.body
    let text
    if (typeof raw === 'string') text = raw
    else if (raw instanceof Uint8Array) {
      text = new TextDecoder().decode(raw)
      if (!text.trimStart().startsWith('{')) text = new TextDecoder().decode(zlib.zstdDecompressSync(raw))
    }
    if (text !== undefined) {
      const body = JSON.parse(text)
      observations.url = String(url)
      observations.model = body.model
      observations.reasoning = body.reasoning
    }
  } catch { /* observation is best-effort; the request proceeds unchanged */ }
  return realFetch(url, options)
}

process.env.DSH_HOME = dshHome
// Codex backend reachability follows the production proxy topology.
process.env.NODE_USE_ENV_PROXY = process.env.NODE_USE_ENV_PROXY ?? '1'

const require = createRequire(join(nodeModules, 'dsh-codex', 'package.json'))
const plugin = require(join(nodeModules, 'dsh-codex', 'lib', 'index.js'))
const dshLlm = require(join(nodeModules, '@deepseek-ai', 'dsh-llm', 'lib', 'index.js'))

const captured = {}
const ctx = {
  provide() {}, inject() {}, get() { return undefined },
  llm: { registerAdapter: (ids, adapter) => { captured.adapter = adapter } },
  web: { registerSearchProvider() {} },
}
// effortArg 'absent' reproduces the legacy no-reasoning plugin config.
plugin.apply(ctx, EFFORT_PLUGIN === 'absent' ? { credentialFile: credentialCopy } : { credentialFile: credentialCopy, reasoning: EFFORT_PLUGIN })

console.log(`canary: model=${MODEL} effort=${EFFORT_PLUGIN} (credential is an isolated copy)`)
let outcome = 'unknown'
let replyHead = ''
let failure = undefined
try {
  const iteration = captured.adapter.stream({
    provider: 'openai-codex',
    model: MODEL,
    messages: [dshLlm.createUserMessage({ content: [{ type: 'text', text: 'Reply with exactly: CANARY-OK' }] })],
    sessionId: 'gpt6-canary-v1',
    maxTokens: 512,
  })
  for await (const chunk of iteration) {
    if (chunk?.type === 'text' && typeof chunk.text === 'string') replyHead += chunk.text
    if (chunk?.type === 'finish' && chunk.reason?.kind === 'error') failure = chunk.reason.failure
  }
  outcome = failure === undefined ? 'completed' : 'chunk_error'
} catch (error) {
  outcome = 'threw'
  failure = { message: String(error?.message ?? error), code: error?.code ?? error?.name }
}

console.log(`outcome:            ${outcome}`)
console.log(`failure:            ${failure === undefined ? '(none)' : JSON.stringify({ code: failure.code, message: String(failure.message ?? '').slice(0, 300) })}`)
console.log(`reply head:         ${JSON.stringify(replyHead.slice(0, 120))}`)
console.log(`observed URL:       ${observations.url ?? '(none)'}`)
console.log(`observed model:     ${observations.model ?? '(none)'}`)
console.log(`observed reasoning: ${observations.reasoning === undefined ? '(none)' : JSON.stringify(observations.reasoning)}`)

const ok = outcome === 'completed'
  && observations.model === MODEL
  && observations.reasoning?.effort === EFFORT_PLUGIN
  && replyHead.includes('CANARY-OK')
console.log(`REAL_CANARY_RESULT: ${ok ? 'PASS' : 'FAIL'}`)
rmSync(scratch, { recursive: true, force: true })
process.exit(ok ? 0 : 1)
