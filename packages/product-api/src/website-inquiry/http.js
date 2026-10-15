import { parseWebsiteRoute, validateBody, errorEnvelope, fail } from './protocol.js'

// Reject duplicate JSON keys before JSON.parse discards their first values.
export function strictJson(text) {
  let position = 0
  const space = () => { while (/\s/.test(text[position] ?? '') && position < text.length) position++ }
  function string() {
    const start = position++
    while (position < text.length) {
      const char = text[position++]
      if (char === '\\') position++
      else if (char === '"') return JSON.parse(text.slice(start, position))
    }
    fail()
  }
  function value(depth = 0) {
    if (depth > 30) fail()
    space()
    if (text[position] === '"') { string(); return }
    if (text[position] === '{') {
      position++
      const keys = new Set()
      space()
      if (text[position] === '}') { position++; return }
      while (position < text.length) {
        space()
        if (text[position] !== '"') fail()
        const key = string()
        if (keys.has(key)) fail()
        keys.add(key)
        space()
        if (text[position++] !== ':') fail()
        value(depth + 1)
        space()
        const end = text[position++]
        if (end === '}') return
        if (end !== ',') fail()
      }
      fail()
    }
    if (text[position] === '[') {
      position++
      space()
      if (text[position] === ']') { position++; return }
      while (position < text.length) {
        value(depth + 1)
        space()
        const end = text[position++]
        if (end === ']') return
        if (end !== ',') fail()
      }
      fail()
    }
    const scalar = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(position))
    if (!scalar) fail()
    position += scalar[0].length
  }
  try { value(); space(); if (position !== text.length) fail(); return JSON.parse(text) } catch { fail() }
}
async function readBody(req, signal) {
  if (req.headers['content-type'] !== 'application/json') fail()
  if (req.headers['transfer-encoding'] && req.headers['content-length']) fail()
  const length = req.headers['content-length']
  if (length !== undefined && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > 1048576)) fail('RESOURCE_LIMIT')
  const parts = []
  let size = 0
  for await (const part of req) {
    if (signal.aborted) fail('SOURCE_UNAVAILABLE')
    size += part.length
    if (size > 1048576) fail('RESOURCE_LIMIT')
    parts.push(part)
  }
  if (length !== undefined && Number(length) !== size) fail()
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts)) } catch { fail() }
  return strictJson(text)
}
export function createWebsiteInquiryHandler({ enabled = false, auth, service }) {
  return async function handler(req, res) {
    if (!/^\/(?:internal\/)?v1\/website-inquiries(?:[/?]|$)/.test(req.url ?? '')) return false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const send = (status, body) => {
      if (res.writableEnded || res.destroyed) return
      let bytes = JSON.stringify(body)
      if (Buffer.byteLength(bytes) > 1048576) {
        const error = errorEnvelope({ code: 'RESOURCE_LIMIT' })
        status = error.status
        bytes = JSON.stringify(error.body)
      }
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(bytes)
    }
    try {
      const work = async () => {
        const route = parseWebsiteRoute(req.method, req.url)
        if (!enabled || !auth || !service) fail('NOT_PROVISIONED')
        const body = req.method === 'POST' ? validateBody(route.operation, await readBody(req, controller.signal)) : null
        if (controller.signal.aborted) fail('SOURCE_UNAVAILABLE')
        const verified = route.internal
          ? await auth.controller(req.headers.authorization, route.operation, controller.signal)
          : await auth.human(req.headers.authorization, controller.signal)
        if (controller.signal.aborted) fail('SOURCE_UNAVAILABLE')
        const caller = Object.freeze({ ...verified, signal: controller.signal })
        if (['resolve', 'authorize'].includes(route.operation)) return service[route.operation](caller, body)
        if (route.operation === 'redeem') return service.redeem(caller, route.requestId, body)
        if (route.operation === 'read') return service.read(caller, route.requestId, route.query)
        return service[route.operation](caller, route.query)
      }
      const deadline = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Object.assign(new Error(), { code: 'SOURCE_UNAVAILABLE' })), { once: true }))
      const { status = 200, ...body } = await Promise.race([work(), deadline])
      send(status, body)
    } catch (error) {
      const response = errorEnvelope(error)
      send(response.status, response.body)
    } finally { clearTimeout(timer) }
    return true
  }
}
