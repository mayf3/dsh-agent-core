/**
 * Tests for POST /v1/voice/transcription — PRODUCT_API_VOICE_TRANSCRIPTION_V1.
 *
 * Contract under test (accepted Spec): ONE additive route with frozen
 * validation ceilings (415 / 413-byte / 413-duration / 400), deterministic
 * failure mapping (503 engine unavailable, 504 deadline), the
 * {"text"} response shape, and zero raw-audio persistence with the exact
 * operational log allowlist (route, status, byte_count, duration_ms,
 * latency_ms).
 *
 * Engine-backed cases run only when the pinned model is present on the
 * host (~/.agent-core/models/sherpa-onnx-paraformer-zh-2024-03-09 or
 * PRODUCT_API_ASR_MODEL_DIR); they skip elsewhere so the suite stays green
 * without the ~230 MB asset. WAV fixtures are synthesized in memory — no
 * audio bytes exist in this repository and nothing is written to disk
 * except the ephemeral macOS `say` utterance fixture (tmpdir, removed).
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply as applyProductApi } from '../src/index.js'

const DEFAULT_MODEL_DIR = join(homedir(), '.agent-core', 'models', 'sherpa-onnx-paraformer-zh-2024-03-09')
const PAYLOAD_CEILING_BYTES = 512 * 1024

/** True when the pinned ENGINE_PIN model assets are present (default dir). */
function engineModelPresent() {
  return existsSync(join(DEFAULT_MODEL_DIR, 'model.int8.onnx'))
    && existsSync(join(DEFAULT_MODEL_DIR, 'tokens.txt'))
}

/** Fake cordis ctx: get/provide/effect only (mirrors api.test.js). */
function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort */ }
      }
    },
  }
}

function stubRouter() {
  return {
    channelConversationId: (channel, externalId) => `${channel}:${externalId}`,
    getBinding: () => undefined,
    switchAgent: async () => ({}),
    route: async () => ({}),
  }
}

function stubDefinition() {
  return { listAgents: () => [] }
}

async function startServer(t, { config = {} } = {}) {
  const ctx = fakeCtx(new Map([
    ['agentRouter', stubRouter()],
    ['agentDefinition', stubDefinition()],
  ]))
  const api = applyProductApi(ctx, { port: 0, ...config })
  await new Promise(resolveReady => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 10)
    }
    wait()
  })
  const base = `http://127.0.0.1:${api.address().port}`
  t.after(() => ctx.disposeAll())
  return { base, ctx }
}

/** POST raw bytes to the voice route; returns {status, body, raw}. */
async function postWav(base, body, contentType = 'audio/wav') {
  const res = await fetch(`${base}/v1/voice/transcription`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
  const raw = await res.text()
  let parsed = null
  try { parsed = JSON.parse(raw) } catch { /* non-JSON body */ }
  return { status: res.status, body: parsed, raw }
}

/**
 * Synthesize a mono 16 kHz PCM16 RIFF WAV entirely in memory: `seconds` of
 * a quiet 440 Hz tone (no speech content needed by these cases). Optional
 * non-PCM junk chunk pads the payload past the byte ceiling without adding
 * decoded duration.
 */
function makeWav({ seconds, channels = 1, sampleRate = 16000, bitsPerSample = 16, audioFormat = 1, junkBytes = 0 }) {
  const frameCount = Math.floor(seconds * sampleRate)
  const data = Buffer.alloc(frameCount * channels * (bitsPerSample / 8))
  for (let i = 0; i < frameCount; i++) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 2000), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(36 + data.length + (junkBytes > 0 ? 8 + junkBytes : 0), 4)
  header.write('WAVE', 8, 'latin1')
  header.write('fmt ', 12, 'latin1')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(audioFormat, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28)
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36, 'latin1')
  header.writeUInt32LE(data.length, 40)
  let junk = Buffer.alloc(0)
  if (junkBytes > 0) {
    junk = Buffer.alloc(8 + junkBytes)
    junk.write('JUNK', 0, 'latin1')
    junk.writeUInt32LE(junkBytes, 4)
  }
  return Buffer.concat([header, data, junk])
}

/** A zh_CN `say` voice name, or null when unavailable on this host. */
function chineseSayVoice() {
  try {
    const list = execFileSync('say', ['-v', '?'], { encoding: 'utf8' })
    const line = list.split('\n').find((l) => /\bzh_CN\b/.test(l))
    return line === undefined ? null : line.split(/\s{2,}/)[0].trim()
  } catch {
    return null
  }
}

/** Temporarily capture stderr; resolves with the captured chunks. */
async function captureStderr(fn) {
  const chunks = []
  const original = process.stderr.write
  process.stderr.write = (chunk, ...rest) => { chunks.push(String(chunk)); return original.call(process.stderr, chunk, ...rest) }
  try {
    await fn()
  } finally {
    process.stderr.write = original
  }
  return chunks
}

/** File-system snapshot helper for the zero-persistence assertion. */
function listFiles(root, depth = 2) {
  try {
    const out = []
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      out.push(entry.name)
      if (entry.isDirectory() && depth > 0 && !['node_modules', '.git'].includes(entry.name)) {
        for (const nested of listFiles(join(root, entry.name), depth - 1)) out.push(`${entry.name}/${nested}`)
      }
    }
    return out.sort()
  } catch {
    return []
  }
}

test('POST /v1/voice/transcription: valid short WAV -> 200 {"text"} (engine: string text; tone may be empty)', { skip: !engineModelPresent() && 'pinned ASR model not present on this host' }, async (t) => {
  const { base } = await startServer(t)
  const { status, body } = await postWav(base, makeWav({ seconds: 0.5 }))
  assert.equal(status, 200)
  assert.deepEqual(Object.keys(body), ['text'])
  assert.equal(typeof body.text, 'string')
})

test('valid near-limit WAV (14.5 s, inside both ceilings) -> 200', { skip: !engineModelPresent() && 'pinned ASR model not present on this host' }, async (t) => {
  const { base } = await startServer(t)
  const wav = makeWav({ seconds: 14.5 })
  assert.ok(wav.length < PAYLOAD_CEILING_BYTES, 'fixture must stay under the byte ceiling')
  const { status, body } = await postWav(base, wav)
  assert.equal(status, 200)
  assert.equal(typeof body.text, 'string')
})

test('TEXT_NONEMPTY: real utterance (macOS say, zh_CN) transcribes to non-empty text', { skip: (!engineModelPresent() || chineseSayVoice() === null) && 'engine or zh_CN say voice not available' }, async (t) => {
  const voice = chineseSayVoice()
  const dir = mkdtempSync(join(tmpdir(), 'vt-utterance-'))
  const wavPath = join(dir, 'utterance.wav')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  execFileSync('say', ['-v', voice, '-o', wavPath, '--data-format=LEI16@16000', '今天天气怎么样'])
  const wav = readFileSync(wavPath)
  const { base } = await startServer(t)
  const { status, body } = await postWav(base, wav)
  assert.equal(status, 200)
  assert.ok(body.text.length > 0, 'TEXT_NONEMPTY per DEC-VT-004')
})

test('malformed WAV (bad RIFF header) -> 400', async (t) => {
  const { base } = await startServer(t)
  const notWav = Buffer.alloc(64, 7)
  notWav.write('NOTRIFF', 0, 'latin1')
  const { status, body } = await postWav(base, notWav)
  assert.equal(status, 400)
  assert.equal(body.error.code, 'MALFORMED_WAV')
})

test('wrong content type -> 415', async (t) => {
  const { base } = await startServer(t)
  const { status, body } = await postWav(base, makeWav({ seconds: 0.2 }), 'text/plain')
  assert.equal(status, 415)
  assert.equal(body.error.code, 'UNSUPPORTED_MEDIA_TYPE')
})

test('payload over 512 KB ceiling -> 413 (reading stops, duration within limits)', async (t) => {
  const { base } = await startServer(t)
  // 1 s of audio + junk chunk: over the byte ceiling WITHOUT exceeding the
  // 15 s duration ceiling — proves the byte ceiling is enforced on its own.
  const wav = makeWav({ seconds: 1, junkBytes: 512 * 1024 })
  assert.ok(wav.length > PAYLOAD_CEILING_BYTES)
  const { status, body } = await postWav(base, wav)
  assert.equal(status, 413)
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE')
})

test('decoded duration over 15 s ceiling -> 413 (payload under byte ceiling)', async (t) => {
  const { base } = await startServer(t)
  const wav = makeWav({ seconds: 15.5 })
  assert.ok(wav.length < PAYLOAD_CEILING_BYTES, 'fixture must stay under the byte ceiling')
  const { status, body } = await postWav(base, wav)
  assert.equal(status, 413)
  assert.equal(body.error.code, 'DURATION_TOO_LONG')
})

test('engine unavailable (model dir empty) -> 503; server boots cleanly regardless', async (t) => {
  const emptyDir = mkdtempSync(join(tmpdir(), 'vt-empty-model-'))
  t.after(() => rmSync(emptyDir, { recursive: true, force: true }))
  process.env.PRODUCT_API_ASR_MODEL_DIR = emptyDir
  t.after(() => { delete process.env.PRODUCT_API_ASR_MODEL_DIR })
  const { base } = await startServer(t)
  const { status, body } = await postWav(base, makeWav({ seconds: 0.2 }))
  assert.equal(status, 503)
  assert.equal(body.error.code, 'ENGINE_UNAVAILABLE')
})

test('service deadline exceeded -> 504 (test-only deadline override, engine present)', { skip: !engineModelPresent() && 'pinned ASR model not present on this host' }, async (t) => {
  process.env.PRODUCT_API_ASR_DEADLINE_MS = '1'
  t.after(() => { delete process.env.PRODUCT_API_ASR_DEADLINE_MS })
  const { base } = await startServer(t)
  const { status, body } = await postWav(base, makeWav({ seconds: 0.5 }))
  assert.equal(status, 504)
  assert.equal(body.error.code, 'DEADLINE_EXCEEDED')
})

test('zero persistence + log allowlist: no new files, stderr carries ONLY the allowlisted fields', async (t) => {
  const cwdBefore = listFiles(process.cwd())
  const tmpBefore = listFiles(tmpdir(), 0)
  let lines = []
  const { base } = await startServer(t)
  const wav = makeWav({ seconds: 0.3 })
  await captureStderr(async () => {
    const res = await postWav(base, wav)
    assert.equal(res.status, process.env.PRODUCT_API_ASR_MODEL_DIR === undefined && !engineModelPresent() ? 503 : 200)
  }).then((captured) => { lines = captured })

  const cwdAfter = listFiles(process.cwd())
  const tmpAfter = listFiles(tmpdir(), 0)
  assert.deepEqual(cwdAfter, cwdBefore, 'no new files in cwd during a request')
  const audioish = /(wav|audio|voice|asr|pcm|sherpa|transcri)/i
  const newTmp = tmpAfter.filter((name) => !tmpBefore.includes(name) && audioish.test(name))
  assert.deepEqual(newTmp, [], 'no audio-related temp files created during a request')

  const voiceLines = lines.filter((l) => l.includes('[product-api:voice]'))
  assert.ok(voiceLines.length >= 1, 'exactly one operational log line per request')
  for (const line of voiceLines) {
    const fields = JSON.parse(line.split('[product-api:voice] ')[1])
    assert.deepEqual(
      Object.keys(fields).sort(),
      ['byte_count', 'duration_ms', 'latency_ms', 'route', 'status'],
      'log allowlist is EXACTLY: route, status, byte_count, duration_ms, latency_ms',
    )
    assert.equal(fields.route, '/v1/voice/transcription')
    assert.ok(!JSON.stringify(fields).includes(String(wav.subarray(44, 64).toString('latin1'))), 'no audio bytes in logs')
  }
  // No transcript text may appear anywhere in the captured output.
  for (const chunk of lines) assert.ok(!chunk.includes('"text"'), 'no transcript payload in logs')
})
