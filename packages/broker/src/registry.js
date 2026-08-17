/**
 * @agent-core/broker — Manifest -> tool registration (V1).
 *
 * Turns a validated capability manifest + a code-side handler map into ONE
 * model-facing `defineTool`-shaped definition and registers it through a
 * `ctx.tools`-like interface. The only dependency on the real DSH tool
 * registry is the injected `register(definition)` callback and the injected
 * `define`, so the whole path is unit-testable with a minimal stub.
 *
 * Naming decision (see docs/history/reports/broker-v1.md for full rationale):
 * ONE capability -> ONE tool (multi-operation dispatch) rather than one tool
 * per operation. This preserves V0's accepted model-visible shape exactly —
 * the model still calls `external_calculator` with { operation, a, b } — while
 * keeping the wire capability id (`external.calculator`) as the manifest id and
 * in the description. The `operation` parameter is always required and its enum
 * lists all operations; strict per-operation parameter & result validation is
 * performed in the mapping layer after dispatch.
 *
 * Identity discipline: the built parameter schema never includes a principal
 * field. Identity flows only through the injected `deps.resolvePrincipal`.
 */

import { assertValidManifest, invoke } from './mapping.js'

/**
 * Build the exact `defineTool({...})` options object plus the capability id.
 *
 * @param {object} capability
 * @param {object} capability.manifest - raw (unvalidated) manifest data.
 * @param {object} capability.handlers - operationName -> pure function map.
 * @param {object} [capability.deps]
 * @param {() => unknown} [capability.deps.resolvePrincipal] - the single identity source.
 * @returns {{ definition: object, capabilityId: string }} defineTool options + wire id.
 */
export function buildToolDefinition({ manifest: rawManifest, handlers, deps = {} }) {
  const manifest = assertValidManifest(rawManifest)
  const resolvePrincipal = deps.resolvePrincipal
  const wireId = manifest.id

  // Model-facing parameter schema in `defineTool` format (per-property map
  // with `required: true`). `operation` is always required; shared properties
  // are required only when EVERY operation requires them (the coarse schema is
  // a model hint; strict per-operation validation happens in mapping.js).
  const parameters = {
    operation: {
      type: 'string',
      required: true,
      enum: manifest.operations.map((o) => o.name),
      description: 'The capability operation to perform.',
    },
  }
  const requiredEverywhere = {}
  for (const op of manifest.operations) {
    for (const [name, spec] of Object.entries(op.arguments.properties)) {
      if (!Object.hasOwn(parameters, name)) {
        parameters[name] = {
          type: spec.type,
          ...(spec.enum ? { enum: spec.enum } : {}),
          description: spec.description || `${op.name}: ${name}`,
        }
      }
      const opReq = Array.isArray(op.arguments.required) && op.arguments.required.includes(name)
      requiredEverywhere[name] = (requiredEverywhere[name] ?? true) && opReq
    }
  }
  for (const [name, allRequire] of Object.entries(requiredEverywhere)) {
    if (allRequire && !parameters[name].required) parameters[name].required = true
  }

  const outputSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean' },
      result: { type: 'json' },
      error: {
        type: 'object',
        additionalProperties: false,
        properties: {
          code: { type: 'string' },
          // Transport-produced errors additionally carry the upstream HTTP
          // status and a short detail (upstream body / cause), when available.
          status: { type: 'number' },
          detail: { type: 'string' },
        },
      },
    },
  }

  const renderArgs = (args) =>
    Object.entries(args)
      .filter(([k]) => k !== 'operation')
      // Values only, in argument order — keeps the V0 acceptance text format
      // (`external.calculator: multiply(6, 7) = 42 (ok: true)`) byte-identical.
      .map(([, v]) => (typeof v === 'string' ? v : JSON.stringify(v)))
      .join(', ')

  return {
    capabilityId: wireId,
    definition: {
      name: manifest.toolName,
      description:
        `Agent Core capability \`${wireId}\`: ${manifest.description} ` +
        `Supported operations: ${manifest.operations.map((o) => o.name).join(', ')}.`,
      parameters,
      output: {
        schema: outputSchema,
        render: (args, value) =>
          value && value.ok === true
            ? [{ type: 'text', text: `${wireId}: ${args.operation}(${renderArgs(args)}) = ${JSON.stringify(value.result)} (ok: true)` }]
            : [{ type: 'text', text: `${wireId}: ${args.operation}(${renderArgs(args)}) failed: ${value?.error?.code}` }],
      },
      async execute(args) {
        // Single identity source: resolvePrincipal, never from args.
        return invoke(manifest, handlers, { operation: args.operation, args }, { resolvePrincipal })
      },
      presentCall: (args) => ({
        card: 'generic',
        title: wireId,
        kind: 'other',
        rawInput: args,
      }),
    },
  }
}

/**
 * Register one capability through a registry callback.
 *
 * @param {object} capability - `{ manifest, handlers, deps }`.
 * @param {{ register: (definition: object) => unknown }} registry - `ctx.tools` in
 *   production; a spy in tests.
 * @param {(definition: object) => object} define - a `defineTool`-compatible function
 *   (production passes the real `defineTool`; tests pass a passthrough).
 * @returns {object} the produced ToolDefinition (via `define`).
 */
export function registerCapability(capability, registry, define) {
  const { definition } = buildToolDefinition(capability)
  const tool = define ? define(definition) : definition
  registry.register(tool)
  return tool
}

/**
 * Register many capabilities into a real `ctx` that carries `tools`.
 * @param {object} ctx - registrant context carrying `ctx.tools`.
 * @param {(definition: object) => object} defineTool - the real DSH `defineTool`.
 * @param {Array<{ manifest: object, handlers: object, deps?: object }>} capabilities
 * @returns {Array<object>} registered ToolDefinitions.
 */
export function registerCapabilities(ctx, defineTool, capabilities) {
  return capabilities.map((c) => registerCapability(c, ctx.tools, (def) => defineTool(def)))
}
