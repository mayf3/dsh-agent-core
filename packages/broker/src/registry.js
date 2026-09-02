/**
 * @agent-core/broker — Manifest -> tool registration (V1).
 *
 * Turns a validated capability manifest + a code-side handler map into ONE
 * model-facing `defineTool`-shaped definition and registers it through a
 * `ctx.tools`-like interface. The only dependency on the real DSH tool
 * registry is the injected `register(definition)` callback and the injected
 * `define`, so the whole path is unit-testable with a minimal stub.
 *
 * Naming decision (see docs/reports/broker-v1.md for full rationale):
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

const MODEL_ANNOTATIONS = ['description', 'title', 'default', 'examples']

/** Convert a full manifest schema node into the intentionally smaller
 * defineTool value-schema DSL. Bounds stay authoritative in mapping.js. */
function modelValueSchema(spec, required = false) {
  const out = {}
  for (const key of MODEL_ANNOTATIONS) {
    if (Object.hasOwn(spec, key)) out[key] = spec[key]
  }
  if (required) out.required = true
  if (Array.isArray(spec.oneOf)) {
    out.oneOf = spec.oneOf.map((branch) => modelValueSchema(branch))
    return out
  }
  out.type = spec.type
  if (spec.type === 'object') {
    out.additionalProperties = spec.additionalProperties !== false
    const requiredNames = new Set(Array.isArray(spec.required) ? spec.required : [])
    out.properties = Object.fromEntries(Object.entries(spec.properties ?? {}).map(([name, child]) => [
      name,
      modelValueSchema(child, requiredNames.has(name)),
    ]))
  } else if (spec.type === 'array' && spec.items !== undefined) {
    out.items = modelValueSchema(spec.items)
  } else {
    if (Array.isArray(spec.enum)) out.enum = spec.enum
    if (Object.hasOwn(spec, 'const')) out.const = spec.const
  }
  return out
}

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
  // with `required: true`). Existing manifests default to `operation`; an
  // opted-in manifest (Scheduler V1) may declare `action`. The coarse schema
  // is guidance; authoritative per-branch validation happens in mapping.js.
  const selector = manifest.selector ?? 'operation'
  const parameters = {
    [selector]: {
      type: 'string',
      required: true,
      enum: manifest.operations.map((o) => o.name),
      description: `The capability ${selector} to perform.`,
    },
  }
  const requiredEverywhere = {}
  for (const op of manifest.operations) {
    for (const [name, spec] of Object.entries(op.arguments.properties)) {
      if (!Object.hasOwn(parameters, name)) {
        parameters[name] = modelValueSchema({
          ...spec,
          description: spec.description || `${op.name}: ${name}`,
        })
      }
      const opReq = Array.isArray(op.arguments.required) && op.arguments.required.includes(name)
      requiredEverywhere[name] = (requiredEverywhere[name] ?? true) && opReq
    }
  }
  // CTR-011 (workflow_execute unified write tool): "required everywhere" means
  // EVERY operation declares the property AND requires it. The collection loop
  // above only ANDs across operations that declare a property, so an argument
  // required by just one operation of a multi-operation manifest (declared by
  // none of the others) would be lifted to a tool-level requirement and the
  // coarse host schema would demand create args for transition calls and vice
  // versa. Recompute over all operations; per-operation strictness stays in
  // mapping.js.
  for (const name of Object.keys(requiredEverywhere)) {
    requiredEverywhere[name] = manifest.operations.every((op) =>
      Object.hasOwn(op.arguments.properties, name)
      && Array.isArray(op.arguments.required)
      && op.arguments.required.includes(name)
    )
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
          // status, a short SANITIZED detail (upstream message / cause) and
          // the downstream `x-request-id` for error correlation, when
          // available.
          status: { type: 'number' },
          detail: { type: 'string' },
          requestId: { type: 'string' },
        },
      },
    },
  }

  const renderArgs = (args) =>
    Object.entries(args)
      .filter(([k]) => k !== selector)
      // Values only, in argument order — keeps the V0 acceptance text format
      // (`external.calculator: multiply(6, 7) = 42 (ok: true)`) byte-identical.
      .map(([, v]) => (typeof v === 'string' ? v : JSON.stringify(v)))
      .join(', ')

  // Downstream error rendering: the model-visible failure line carries the
  // precise diagnostics (upstream HTTP status + downstream x-request-id),
  // never a bare flattened `http_4xx`.
  const renderError = (error) => {
    const parts = []
    if (typeof error?.status === 'number') parts.push(`status=${error.status}`)
    if (typeof error?.requestId === 'string' && error.requestId.length > 0) parts.push(`request_id=${error.requestId}`)
    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : ''
    return `${error?.code ?? 'unknown_error'}${suffix}`
  }

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
            ? [{ type: 'text', text: `${wireId}: ${args[selector]}(${renderArgs(args)}) = ${JSON.stringify(value.result)} (ok: true)` }]
            : [{ type: 'text', text: `${wireId}: ${args[selector]}(${renderArgs(args)}) failed: ${renderError(value?.error)}` }],
      },
      async execute(args) {
        // Dispatch consumes the selector; handlers receive only business args.
        // Identity remains exclusively resolvePrincipal/trusted gateway context.
        const operation = args?.[selector]
        const businessArgs = Object.fromEntries(Object.entries(args ?? {}).filter(([key]) => key !== selector))
        return invoke(manifest, handlers, { operation, args: businessArgs }, { resolvePrincipal })
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
