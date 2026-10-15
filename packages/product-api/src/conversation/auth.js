import { parseBasicCredential } from '../../../notification-ingress/src/auth.js'
import { lstatSync } from 'node:fs'
import { dirname } from 'node:path'
import { readPrivateJson } from '../../../agent-router/src/conversation/persistence.js'
import { fault } from './protocol.js'
export const RESOURCE = 'agent-core-mcp-conversation-v1'
export const SCOPE = 'conversation.access'
export function loadConversationConfig(path) {
  try {
    const directory=lstatSync(dirname(path))
    if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== process.getuid?.() || (directory.mode & 0o077) !== 0) return null
    return readPrivateJson(path, 1024 * 1024)
  } catch { return null }
}
export function validateConfig(config) {
  if (config?.enabled !== true) throw fault('NOT_PROVISIONED', 503)
  let origin
  try { origin = new URL(config.authServiceOrigin) } catch { throw fault('NOT_PROVISIONED', 503) }
  if (origin.protocol !== 'https:' || origin.origin + '/' !== origin.href || !Number.isSafeInteger(config.retentionMs)
    || config.retentionMs <= 0 || !Number.isSafeInteger(config.maxRecords) || config.maxRecords <= 0
    || !Array.isArray(config.clients) || config.clients.length !== 1) throw fault('NOT_PROVISIONED', 503)
  const client = config.clients[0]
  for (const key of ['clientId','subject_id','communication_scope_id','principal_id']) {
    if (typeof client[key] !== 'string' || !client[key] || client[key].length > 256) throw fault('NOT_PROVISIONED', 503)
  }
  if (!Array.isArray(client.operations) || client.operations.some(op => !['resolve','send','result'].includes(op))
    || !Array.isArray(client.targets) || client.targets.length !== 1) throw fault('NOT_PROVISIONED', 503)
  const target = client.targets[0]
  for (const key of ['agent_id','principal_id','domain_id','binding_id','routing_version']) {
    if (typeof target[key] !== 'string' || !target[key]) throw fault('NOT_PROVISIONED', 503)
  }
  return {...config,authServiceOrigin:origin.origin}
}
export async function authenticate({ authorization, config, operation, fetchImpl }) {
  const credential = parseBasicCredential(authorization)
  if (!credential) throw fault('INVALID_CREDENTIAL', 401)
  let response, body
  try {
    response = await fetchImpl(config.authServiceOrigin + '/oauth/token', { method: 'POST', redirect:'error', headers: {
      Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', resource: RESOURCE, scope: SCOPE }).toString(), signal: AbortSignal.timeout(15000) })
    body = await response.json()
  } catch { throw fault('AUTH_INCONCLUSIVE', 503) }
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500 && ['invalid_client','invalid_scope','invalid_grant','invalid_resource','invalid_target'].includes(body?.error)) throw fault('INVALID_CREDENTIAL', 401)
    throw fault('AUTH_INCONCLUSIVE', 503)
  }
  if (response.status !== 200 || typeof body?.access_token !== 'string' || !body.access_token
    || typeof body.token_type !== 'string' || body.token_type.toLowerCase() !== 'bearer'
    || !Number.isSafeInteger(body.expires_in) || body.expires_in <= 0
    || (body.resource !== undefined && body.resource !== RESOURCE) || (body.scope !== undefined && !body.scope.split(' ').includes(SCOPE))) throw fault('AUTH_INCONCLUSIVE', 503)
  const principal = config.clients.find(client => client.clientId === credential.clientId)
  if (!principal || !principal.operations.includes(operation)) throw fault('NO_ACCESS', 403)
  return principal
}
