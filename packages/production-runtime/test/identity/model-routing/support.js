import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRoutingConfigRuntime } from '../../../src/identity/model-routing/generation.js'

export const A = 'agt_a'
export const B = 'agt_b'
export const C = 'agt_c'
export const GLOBAL = { provider: 'global-provider', model: 'global-model' }
export const PROXY = {
  HTTP_PROXY: 'http://127.0.0.1:7890',
  HTTPS_PROXY: 'http://127.0.0.1:7890',
  NO_PROXY: 'localhost,127.0.0.1,::1',
  NODE_USE_ENV_PROXY: '1',
}

export function entry(primary = 'r0', fallbacks = []) {
  return { model: { primary, fallbacks } }
}

export function config() {
  return {
    version: 3,
    routeCatalog: Object.fromEntries(['r0', 'r1', 'r2', 'r3'].map(ref => [ref, {
      routeKind: 'builtin', provider: 'fixture-provider', model: `model-${ref}`,
      credentialReadiness: 'fixture-credential-path-identity',
    }])),
    overrides: { [A]: entry(), [B]: entry('r1'), [C]: entry('r2') },
  }
}

export function setup(t, initial = config()) {
  const root = mkdtempSync(join(tmpdir(), 'rcg-generation-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'overrides.json')
  const messages = []
  const context = {
    options: { deploymentRoot: root },
    globalRoute: structuredClone(GLOBAL),
    layers: { globalSource: 'composition_config', explicitGlobal: structuredClone(GLOBAL) },
  }
  const write = value => writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
  if (initial !== null) write(initial)
  const options = {
    file, registeredAgentIds: [A, B, C], readContext: () => context,
    log: Object.fromEntries(['log', 'warn', 'error'].map(key => [key, (...parts) => messages.push(parts.join(' '))])),
  }
  const create = extra => createRoutingConfigRuntime({ ...options, ...extra })
  return { root, file, context, messages, write, create, options }
}

export function badB(value = config()) {
  value.overrides[B] = entry('missing')
  return value
}
