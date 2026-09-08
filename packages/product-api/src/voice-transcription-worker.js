/**
 * worker_threads worker for POST /v1/voice/transcription
 * (PRODUCT_API_VOICE_TRANSCRIPTION_V1, DEC-VT-003/005).
 *
 * Holds the long-lived ENGINE_PIN recognizer: sherpa-onnx v1.13.7 +
 * Paraformer-zh int8, num_threads=2, greedy_search. The model loads ONCE
 * per worker; each request message decodes in memory and returns only the
 * transcript string. Decode is a blocking native call, so it runs here —
 * same process, no sockets, no second backend — while the main thread
 * enforces the 1500 ms service deadline and discards late results.
 *
 * sha256 of both model assets is verified BEFORE load; any mismatch or
 * load failure is reported as initError and the route answers 503. The
 * worker never touches disk beyond reading the verified model assets and
 * never logs audio or transcript text.
 */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'

const { modelDir, modelFile, modelSha256, tokensFile, tokensSha256 } = workerData

/** sha256 of a file, streamed. */
async function sha256File(path) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  return hash.digest('hex')
}

async function init() {
  const modelPath = join(modelDir, modelFile)
  const tokensPath = join(modelDir, tokensFile)
  const [actualModel, actualTokens] = await Promise.all([sha256File(modelPath), sha256File(tokensPath)])
  if (actualModel !== modelSha256) throw new Error('model digest mismatch')
  if (actualTokens !== tokensSha256) throw new Error('tokens digest mismatch')
  // sherpa-onnx-node is CJS; the default interop binding is module.exports.
  const { default: sherpa } = await import('sherpa-onnx-node')
  // ENGINE_PIN CONFIG (DEC-VT-003): num_threads=2, greedy_search.
  const recognizer = new sherpa.OfflineRecognizer({
    modelConfig: {
      paraformer: { model: modelPath },
      tokens: tokensPath,
      numThreads: 2,
      decodingMethod: 'greedy_search',
    },
  })
  return recognizer
}

/**
 * PCM16 LE mono 16 kHz bytes -> Float32 samples in [-1, 1]. The bytes
 * arrive through structuredClone as a plain Uint8Array (Buffer does not
 * survive the crossing), so read through a DataView.
 */
function toFloat32(bytes) {
  const frameCount = bytes.byteLength >> 1
  const samples = new Float32Array(frameCount)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < frameCount; i++) samples[i] = view.getInt16(i * 2, true) / 32768
  return samples
}

let recognizer = null

// Eager init at worker start: the model loads ONCE; the main thread waits
// for exactly one ready/initError verdict before any decode is posted.
init()
  .then((instance) => {
    recognizer = instance
    parentPort.postMessage({ type: 'ready' })
  })
  .catch(() => {
    parentPort.postMessage({ type: 'initError' })
  })

parentPort.on('message', (msg) => {
  if (msg?.type !== 'transcribe') return
  if (recognizer === null) {
    parentPort.postMessage({ id: msg.id, ok: false })
    return
  }
  try {
    const stream = recognizer.createStream()
    stream.acceptWaveform({ sampleRate: 16000, samples: toFloat32(msg.pcm) })
    recognizer.decode(stream)
    const result = recognizer.getResult(stream)
    parentPort.postMessage({ id: msg.id, ok: true, text: result?.text ?? '' })
  } catch {
    parentPort.postMessage({ id: msg.id, ok: false })
  }
})
