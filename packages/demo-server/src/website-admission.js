import { createHash } from 'node:crypto'
export const WEBSITE_NAMESPACE = 'website-human-inquiry-v1'
const keys = ['namespace', 'human_principal_id', 'communication_scope_id', 'request_id', 'payload_digest', 'site_owner_binding_version']
export function validateWebsiteAdmission(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some(key => typeof value[key] !== 'string' || !value[key]) || value.namespace !== WEBSITE_NAMESPACE
    || !/^[a-f0-9]{64}$/.test(value.payload_digest) || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.request_id)) throw new TypeError('invalid website admission')
  return Object.freeze(Object.fromEntries(keys.map(key => [key, value[key]])))
}
export const custodyKey = carrier => createHash('sha256').update(JSON.stringify(keys.map(key => carrier[key]))).digest('hex')
