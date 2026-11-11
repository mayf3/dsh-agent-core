/** Trusted per-operation transport limits. Never constructed from model args. */
export class TransportControlError extends Error {
  constructor(kind) {
    super(kind)
    this.kind = kind
    this.errorCode = kind === 'limit' ? 'transport_limit_exceeded'
      : kind === 'deadline' ? 'transport_deadline_exceeded'
        : kind === 'protocol' ? 'malformed_response' : 'transport_failure'
  }
}

export function createTransportControl({ deadlineMs, maxEntityBytes, maxTotalBytes, maxAttempts,
  now = () => performance.now(), signal } = {}) {
  const controller = new AbortController()
  const deadline = now() + deadlineMs
  let totalBytes = 0, attempts = 0
  const fail = kind => { throw new TransportControlError(kind) }
  const expire = () => controller.abort(new TransportControlError('deadline'))
  const cancel = () => controller.abort(new TransportControlError('cancelled'))
  const timer = setTimeout(expire, deadlineMs)
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  function check() {
    if (now() >= deadline && !controller.signal.aborted) expire()
    if (controller.signal.aborted) throw controller.signal.reason
  }
  async function wait(start) {
    check()
    let abort
    const stopped = new Promise((_, reject) => {
      abort = () => reject(controller.signal.reason)
      controller.signal.addEventListener('abort', abort, { once: true })
    })
    try {
      const value = await Promise.race([Promise.resolve().then(() => { check(); return start() }), stopped])
      check()
      return value
    } finally {
      controller.signal.removeEventListener('abort', abort)
    }
  }
  async function readEntity(response) {
    check()
    if (!response.body?.getReader) fail('protocol')
    const reader = response.body.getReader()
    const chunks = []
    let bytes = 0
    try {
      while (true) {
        const { done, value } = await wait(() => reader.read())
        if (done) break
        if (!(value instanceof Uint8Array)) fail('protocol')
        bytes += value.byteLength
        totalBytes += value.byteLength
        if (bytes > maxEntityBytes || totalBytes > maxTotalBytes) fail('limit')
        chunks.push(value)
      }
      check()
      try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, bytes)) }
      catch { fail('protocol') }
    } catch (error) {
      // Do not wait for a broken source's cancellation acknowledgement.
      Promise.resolve(reader.cancel()).catch(() => {})
      throw error
    } finally { reader.releaseLock() }
  }
  return {
    signal: controller.signal, retry401: false, check, wait, readEntity,
    attempt() { check(); if (++attempts > maxAttempts) fail('limit') },
    stats() { return { attempts, totalBytes } },
    close() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      if (!controller.signal.aborted) cancel()
    },
  }
}
