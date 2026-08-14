/**
 * @agent-core/broker — V1 generic capability broker.
 *
 * Turns CAPABILITY MANIFESTS (plain data: wire id, operations, parameter/result
 * schemas, error-code table, descriptions) plus a code-side handler map into
 * model-facing DSH tools via `ctx.tools`. This generalizes the V0 calculator
 * fixture adapter: the calculator is now a manifest, and any future capability
 * (Forum / Workflow / OKR) needs only manifest data + a handler — no new
 * generic machinery. V0's accepted model-visible shape is preserved 1:1:
 *
 *   arguments: { operation: add|subtract|multiply|divide, a: number, b: number }
 *   success:   { ok: true, result: <number> }
 *   failure:   { ok: false, error: { code: invalid_arguments|unsupported_operation|divide_by_zero } }
 *   acceptance: multiply 6 × 7 -> 42
 *
 * Plugin identity: `export const name = 'broker'` is kept identical to V0 so the
 * installed profile keeps resolving the plugin; the bundle patch references the
 * package `@agent-core/broker` (unchanged in package.json). The `broker` name
 * also matches @agent-core/router's convention of a short Cordis plugin name.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

import { registerCapabilities } from './registry.js'
import { createIdentityResolver } from './identity.js'
import { manifest as calculatorManifest, handlers as calculatorHandlers } from './calculator.manifest.js'

/** Stable plugin name referenced by bundle patches / loaded as plugin identity. */
export const name = 'broker'

/** Core services required before the tool registry is reachable. */
export const inject = ['tools']

/** Plugin config: the list of capability manifests to register as tools. */
export const Config = z.object({
  /** Capability manifests to register. Each maps to ONE tool. */
  manifests: z
    .array(z.any())
    // NOTE: no .required() — schemastery's required check runs BEFORE the
    // default, so `.required().default(x)` still rejects an absent value.
    .default([calculatorManifest]),
})

/**
 * Capability id -> handler map. The calculator's handlers live next to its
 * manifest; future capabilities register their handlers here (or via a registry
 * seam) — keeping execution code separate from manifest data.
 */
const handlersByCapability = {
  'external.calculator': calculatorHandlers,
}

/**
 * Register every configured capability manifest as a model-facing tool.
 * Identity is resolved only through the internal `resolvePrincipal` interface.
 * @param {import('@deepseek-ai/cordis').Context} ctx - registrant context.
 * @param {object} [config] - resolved plugin config.
 */
export function apply(ctx, config = {}) {
  const manifests = config.manifests ?? [calculatorManifest]

  const capabilities = manifests.map((manifest) => {
    const id = manifest && typeof manifest.id === 'string' ? manifest.id : ''
    const handlers = handlersByCapability[id] ?? {}
    return {
      manifest,
      handlers,
      deps: {
        // Single identity source (see identity.js / TRUST-BOUNDARY Plan B).
        resolvePrincipal: createIdentityResolver(),
      },
    }
  })

  registerCapabilities(ctx, defineTool, capabilities)
}
