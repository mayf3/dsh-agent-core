/**
 * POST /v1/voice/transcription — PRODUCT_API_VOICE_TRANSCRIPTION_V1.
 *
 * ONE additive route on the existing product-api server (DEC-VT-001):
 *
 *   POST /v1/voice/transcription
 *     Content-Type: audio/wav (else 415)
 *     Body: raw bounded WAV bytes — mono 16 kHz PCM16 RIFF (DEC-VT-001)
 *     Ceilings (DEC-VT-002): payload 512 KB else 413 (reading stops),
 *                            decoded duration 15 s else 413,
 *                            malformed WAV -> 400
 *   -> 200 {"text": "<transcript>"} application/json
 *
 * Failure mapping (DEC-VT-005): engine unavailable / model not loadable ->
 * 503; the frozen SERVICE DEADLINE (1500 ms, test-only override via
 * PRODUCT_API_ASR_DEADLINE_MS) exceeded -> 504. No retries.
 *
 * ENGINE_PIN (DEC-VT-003): sherpa-onnx v1.13.7 Node addon +
 * sherpa-onnx-paraformer-zh-2024-03-09 int8 Paraformer, num_threads=2,
 * greedy_search. The model loads ONCE into a long-lived worker_threads
 * worker (same process — no sockets, no second backend); the main thread
 * posts the in-memory PCM, enforces the deadline, and DISCARDS the late
 * result after a timeout (in-process cancellation; the blocking native
 * decode cannot be aborted mid-call). The worker is (re-)initialized
 * lazily per request until the first successful load, so the server boots
 * cleanly without model files (503 until the model is present).
 *
 * Zero raw-audio persistence (DEC-VT-006): the WAV is parsed straight from
 * the request buffer in memory; audio is never written to disk, never
 * logged. Operational log fields are EXACTLY the allowlist: route, status,
 * byte_count, duration_ms, latency_ms.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'

/** Route + frozen wire constants (DEC-VT-001, DEC-VT-002). */
export const VOICE_TRANSCRIPTION_ROUTE = '/v1/voice/transcription'
const PAYLOAD_CEILING_BYTES = 512 * 1024
const DURATION_CEILING_SECONDS = 15
const DEFAULT_DEADLINE_MS = 1500

/** ENGINE_PIN asset digests (DEC-VT-003) — verified at every engine load. */
const MODEL_FILE = 'model.int8.onnx'
const MODEL_SHA256 = '90bc03034ae1bef9575f8cc798cd1519c8be8aa9e8b458a033e32017ff4d584c'
const TOKENS_FILE = 'tokens.txt'
const TOKENS_SHA256 = '6c0e3b35cece259829e6cb5b8d90d13db88f61ea3a2953d11898e4b2bfd7a2e2'

function defaultModelDir() {
  return process.env.PRODUCT_API_ASR_MODEL_DIR
    ?? join(homedir(), '.agent-core', 'models', 'sherpa-onnx-paraformer-zh-2024-03-09')
}

/** SERVICE DEADLINE (DEC-VT-005). PRODUCT_API_ASR_DEADLINE_MS: TEST-ONLY override. */
function deadlineMs() {
  const raw = Number(process.env.PRODUCT_API_ASR_DEADLINE_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DEADLINE_MS
}

/** Deterministic route failure carrying its frozen HTTP mapping. */
function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

/**
 * Parse a bounded mono 16 kHz PCM16 RIFF WAV from an in-memory buffer
 * (DEC-VT-006: no temp file ever exists). Anything that is not a RIFF/WAVE
 * container, or whose PCM format is not the frozen body contract
 * (mono / 16 kHz / PCM16 — DEC-VT-001), is MALFORMED WAV -> 400.
 */
export function parseWav(buf) {
  const malformed = (why) => httpError(400, 'MALFORMED_WAV', `malformed WAV: ${why}`)
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
    throw malformed('RIFF/WAVE header required')
  }
  let fmt = null
  let data = null
  let offset = 12
  while (offset + 8 <= buf.length) {
    const id = buf.toString('latin1', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ' && size >= 16) {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length))
      break
    }
    offset = body + size + (size % 2) // RIFF chunks are word-aligned
  }
  if (fmt === null) throw malformed('fmt chunk required')
  if (data === null) throw malformed('data chunk required')
  if (fmt.audioFormat !== 1) throw malformed('PCM format required')
  if (fmt.channels !== 1) throw malformed('mono required')
  if (fmt.sampleRate !== 16000) throw malformed('16 kHz required')
  if (fmt.bitsPerSample !== 16) throw malformed('PCM16 required')
  const durationSeconds = data.length / (fmt.sampleRate * 2)
  return { data, durationSeconds }
}

/** Read the raw request body in memory, stopping at the payload ceiling. */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    let over = false
    req.on('data', (chunk) => {
      if (over) return
      size += chunk.length
      if (size > PAYLOAD_CEILING_BYTES) {
        over = true
        req.pause() // DEC-VT-002: stop reading; the socket closes on reply
        reject(httpError(413, 'PAYLOAD_TOO_LARGE', 'payload exceeds 512 KB ceiling'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks)) })
    req.on('error', () => { if (!over) { over = true; reject(httpError(400, 'MALFORMED_WAV', 'request aborted')) } })
  })
}

/** JSON reply with the same envelope discipline as index.js. */
function reply(res, status, body) {
  if (res.writableEnded || res.destroyed) return
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function errorBody(error) {
  return { error: { code: error?.code ?? 'INTERNAL_ERROR', message: error?.message ?? 'internal error' } }
}

/**
 * Long-lived engine: ONE worker thread holding the model for the whole
 * process lifetime (loaded once; never reloaded per request).
 */
class VoiceEngine {
  constructor() {
    this.worker = null
    this.initialized = false
    this.initializing = null
    this.pending = new Map() // request id -> { resolve }
    this.nextId = 1
  }

  /** Spawn + initialize the worker; resolves on ready, rejects on failure. */
  #spawn() {
    const worker = new Worker(new URL('./voice-transcription-worker.js', import.meta.url), {
      workerData: {
        modelDir: defaultModelDir(),
        modelFile: MODEL_FILE,
        modelSha256: MODEL_SHA256,
        tokensFile: TOKENS_FILE,
        tokensSha256: TOKENS_SHA256,
      },
    })
    this.worker = worker
    return new Promise((resolveSpawn, rejectSpawn) => {
      const fail = (error) => {
        if (this.worker === worker) this.worker = null
        this.initialized = false
        this.initializing = null
        worker.removeAllListeners('message')
        // A failed/crashed worker is never reusable; kill it so no thread
        // (or native model asset) outlives the failure.
        void worker.terminate()
        rejectSpawn(error)
      }
      worker.on('message', (msg) => {
        if (msg?.type === 'ready') {
          this.initialized = true
          resolveSpawn()
        } else if (msg?.type === 'initError') {
          fail(new Error('ASR engine init failed'))
        } else {
          this.#onResult(msg)
        }
      })
      worker.once('error', () => fail(new Error('ASR engine crashed')))
      worker.once('exit', () => { if (!this.initialized) fail(new Error('ASR engine exited')) })
    })
  }

  /** Ensure the engine is initialized; retry per request until first success. */
  async #ensure() {
    if (this.initialized) return
    this.initializing ??= this.#spawn().finally(() => { this.initializing = null })
    try {
      await this.initializing
    } catch {
      throw httpError(503, 'ENGINE_UNAVAILABLE', 'ASR engine unavailable')
    }
    // Post-init death: fail in-flight requests, re-init on the next request.
    this.worker.once('error', () => this.#reset())
    this.worker.once('exit', () => { if (this.initialized) this.#reset() })
  }

  /** Worker death after a successful init: fail in-flight, re-init next time. */
  #reset() {
    if (this.initialized) {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.resolve(httpError(503, 'ENGINE_UNAVAILABLE', 'ASR engine unavailable'))
      }
      this.pending.clear()
    }
    const worker = this.worker
    this.worker = null
    this.initialized = false
    if (worker !== null) void worker.terminate()
  }

  #onResult(msg) {
    const pending = this.pending.get(msg?.id)
    if (pending === undefined) return // late result after 504: DISCARDED
    this.pending.delete(msg.id)
    clearTimeout(pending.timer)
    if (msg?.ok) pending.resolve({ text: typeof msg.text === 'string' ? msg.text : '' })
    else pending.resolve(httpError(503, 'ENGINE_UNAVAILABLE', 'ASR engine unavailable'))
  }

  /**
   * Transcribe in-memory PCM16 mono 16 kHz bytes under the service deadline.
   * The deadline timer starts immediately, so it covers engine init +
   * queueing + decode; it rejects with the frozen 503/504 mapping and the
   * worker's late result is discarded.
   */
  transcribe(pcm) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Deadline: drop the entry AND mark it cancelled so a not-yet-posted
        // decode is never started (the late worker result, if any, lands on
        // a deleted id and is DISCARDED).
        const entry = this.pending.get(id)
        if (entry !== undefined) entry.cancelled = true
        this.pending.delete(id)
        reject(httpError(504, 'DEADLINE_EXCEEDED', 'transcription deadline exceeded'))
      }, deadlineMs())
      const failPending = (error) => {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(error)
      }
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          value instanceof Error ? reject(value) : resolve(value)
        },
        timer,
      })
      this.#ensure().then(() => {
        const entry = this.pending.get(id)
        if (entry === undefined || entry.cancelled) return // deadline fired first
        try {
          // Structured-clone post: the worker decodes its own copy; the
          // main thread keeps no audio reference beyond this request.
          this.worker.postMessage({ type: 'transcribe', id, pcm: Buffer.from(pcm) })
        } catch {
          failPending(httpError(503, 'ENGINE_UNAVAILABLE', 'ASR engine unavailable'))
        }
      }, failPending)
    })
  }

  dispose() {
    for (const pending of this.pending.values()) clearTimeout(pending.timer)
    this.pending.clear()
    const worker = this.worker
    this.worker = null
    this.initialized = false
    if (worker !== null) void worker.terminate()
  }
}

/**
 * Create the route handler + engine for the product-api server.
 * Logs via process.stderr with EXACTLY the allowlisted fields.
 */
export function createVoiceTranscriptionHandler() {
  const engine = new VoiceEngine()

  return {
    /** POST /v1/voice/transcription (DEC-VT-001). */
    async handle(req, res) {
      const startedAt = Date.now()
      let status = 500
      let byteCount = 0
      let durationMs = null
      try {
        const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
        if (contentType !== 'audio/wav') {
          throw httpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'content-type must be audio/wav')
        }
        const body = await readRawBody(req)
        byteCount = body.length
        const { data, durationSeconds } = parseWav(body)
        durationMs = Math.round(durationSeconds * 1000)
        if (durationSeconds > DURATION_CEILING_SECONDS) {
          throw httpError(413, 'DURATION_TOO_LONG', 'decoded duration exceeds 15 s ceiling')
        }
        const { text } = await engine.transcribe(data)
        status = 200
        reply(res, 200, { text }) // DEC-VT-001: {"text": "<transcript>"}
      } catch (error) {
        status = error?.status ?? 500
        reply(res, status, errorBody(error))
      } finally {
        // DEC-VT-006 log allowlist — EXACTLY these fields, never audio/text.
        process.stderr.write(`[product-api:voice] ${
          JSON.stringify({ route: VOICE_TRANSCRIPTION_ROUTE, status, byte_count: byteCount, duration_ms: durationMs, latency_ms: Date.now() - startedAt })}\n`)
      }
    },
    dispose: () => engine.dispose(),
  }
}
