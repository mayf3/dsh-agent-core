import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { fail, tokenValid } from './protocol.js'
// RFC8785 for the admitted JSON subset (finite numbers, Unicode strings,
// no lone surrogates). ECMAScript JSON.stringify provides number/string form;
// UTF-16 key ordering is the JCS property ordering.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  if (typeof value === 'number' && !Number.isFinite(value)) fail()
  if (value === undefined) fail()
  return JSON.stringify(value)
}
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')
export const opaque = () => randomBytes(32).toString('base64url')
export function resolutionBinding(resolution) {
  const { observed_at, field_availability, binding_source, ...binding } = resolution
  return binding
}
export function cursorCodec(key) {
  if (!Buffer.isBuffer(key) || key.length < 32) fail('NOT_PROVISIONED')
  return {
    encode(data) {
      const body = Buffer.from(canonical(data)).toString('base64url')
      return Buffer.from(`${body}.${createHmac('sha256', key).update(body).digest('base64url')}`).toString('base64url')
    },
    decode(token) {
      if (!tokenValid(token)) fail()
      const decoded = Buffer.from(token, 'base64url')
      if (decoded.toString('base64url') !== token) fail()
      const [body, signature, extra] = decoded.toString().split('.')
      const expected = createHmac('sha256', key).update(body ?? '').digest()
      const actual = Buffer.from(signature ?? '', 'base64url')
      if (extra !== undefined || actual.length !== expected.length || !timingSafeEqual(actual, expected)) fail('CURSOR_STALE')
      try { return JSON.parse(Buffer.from(body, 'base64url').toString()) } catch { fail() }
    },
  }
}
