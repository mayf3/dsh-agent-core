/**
 * @agent-core/broker — Capability manifest schema & validation (V1).
 *
 * A capability manifest is PLAIN DATA (JSON-serializable; no functions) that
 * describes the contract surface of one Agent Core capability: its wire id,
 * its operations, per-operation parameter/result schemas, its error-code table,
 * and human-facing descriptions. The generic broker engine turns such a
 * manifest (+ a separate, code-side handler map) into one model-facing DSH tool.
 *
 * The "handler" that actually performs an operation is deliberately NOT part of
 * the manifest (a manifest must stay data); it lives next to it in code and is
 * keyed by capability id / operation name. This keeps docs/reports/broker-v1.md
 * honest: Forum / Workflow / OKR will only ever provide manifest data + a
 * handler, no new generic machinery.
 */

/**
 * Validate a capability manifest object into its canonical form.
 * Returns `{ ok: true, manifest }` on success, or `{ ok: false, errors: string[] }`.
 *
 * Pure validator: unit-testable without any DSH context.
 *
 * @param {unknown} input - candidate manifest (from data / config).
 * @returns {{ ok: true, manifest: object } | { ok: false, errors: string[] }}
 */
export function validateManifest(input) {
  const errors = []
  const path = (m) => (m === undefined ? '<manifest>' : `<manifest>.${m}`)

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [path() + ' must be a plain object'] }
  }

  const manifest = {}

  // ---- id (wire capability name, dotted namespace like external.calculator) ----
  if (typeof input.id !== 'string' || input.id.length === 0) {
    errors.push(path('id') + ' must be a non-empty string')
  } else if (!/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(input.id)) {
    errors.push(path('id') + ` "${input.id}" must be a dotted wire id (e.g. external.calculator)`)
  } else {
    manifest.id = input.id
  }

  // ---- toolName (underscore DSH tool name); derive from id by default ----
  if (input.toolName !== undefined) {
    if (typeof input.toolName !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(input.toolName)) {
      errors.push(path('toolName') + ' must be a lowercase identifier (underscore grammar)')
    } else {
      manifest.toolName = input.toolName
    }
  }

  // ---- human-facing text ----
  if (input.name !== undefined && typeof input.name !== 'string') {
    errors.push(path('name') + ' must be a string')
  }
  if (typeof input.description !== 'string') {
    errors.push(path('description') + ' must be a string')
  }

  // ---- error-code table (capability level) ----
  manifest.errors = []
  if (input.errors !== undefined) {
    if (!Array.isArray(input.errors)) {
      errors.push(path('errors') + ' must be an array')
    } else {
      for (const [i, e] of input.errors.entries()) {
        const ep = path(`errors[${i}]`)
        if (e === null || typeof e !== 'object' || typeof e.code !== 'string' || e.code.length === 0) {
          errors.push(ep + ' must be an object with a non-empty string "code"')
        } else if (!/^[a-z][a-zA-Z0-9_]*$/.test(e.code)) {
          errors.push(ep + ` code "${e.code}" must be a lowercase identifier`)
        } else if (manifest.errors.some((x) => x.code === e.code)) {
          errors.push(ep + ` duplicate error code "${e.code}"`)
        } else {
          manifest.errors.push({ code: e.code, description: typeof e.description === 'string' ? e.description : '' })
        }
      }
    }
  }

  // ---- operations ----
  manifest.operations = []
  if (!Array.isArray(input.operations) || input.operations.length === 0) {
    errors.push(path('operations') + ' must be a non-empty array')
  } else {
    const seen = new Set()
    for (const [i, op] of input.operations.entries()) {
      const opPath = path(`operations[${i}]`)
      if (op === null || typeof op !== 'object' || Array.isArray(op)) {
        errors.push(opPath + ' must be a plain object')
        continue
      }
      if (typeof op.name !== 'string' || op.name.length === 0) {
        errors.push(opPath + '.name must be a non-empty string')
        continue
      }
      if (!/^[a-z][a-zA-Z0-9_]*$/.test(op.name)) {
        errors.push(opPath + `.name "${op.name}" must be a lowercase identifier`)
        continue
      }
      if (seen.has(op.name)) {
        errors.push(opPath + ` duplicate operation "${op.name}"`)
        continue
      }
      seen.add(op.name)

      // parameter schema: { properties: {...}, required: [...] } plain object
      const argErr = validatePropertiesSchema(op.arguments, opPath + '.arguments')
      if (argErr) {
        errors.push(argErr)
        continue
      }
      // per-operation allowed error codes (all must exist in the table)
      const opErrors = new Set()
      if (op.errors !== undefined) {
        if (!Array.isArray(op.errors)) {
          errors.push(opPath + '.errors must be an array of codes')
          continue
        }
        let bad = false
        for (const code of op.errors) {
          if (typeof code !== 'string') {
            errors.push(opPath + '.errors[?] must be a string code')
            bad = true
            continue
          }
          if (input.errors === undefined || !input.errors.some((e) => e && e.code === code)) {
            errors.push(opPath + `.errors references undeclared code "${code}"`)
            bad = true
            continue
          }
          opErrors.add(code)
        }
        if (bad) continue
      }

      manifest.operations.push({
        name: op.name,
        description: typeof op.description === 'string' ? op.description : '',
        arguments:
          op.arguments === undefined
            ? { type: 'object', properties: {}, required: [] }
            : { type: 'object', properties: op.arguments.properties || {}, required: Array.isArray(op.arguments.required) ? op.arguments.required : [] },
        result: op.result === undefined ? { type: 'json' } : op.result,
        errors: [...opErrors],
      })
    }
  }

  // toolName derived default: strip dots from id, e.g. external.calculator -> external_calculator
  if (manifest.toolName === undefined && manifest.id !== undefined) {
    manifest.toolName = manifest.id.replace(/\./g, '_')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, manifest }
}

/**
 * Validate one operation's `arguments` property-schema shape.
 * @param {unknown} value - candidate { properties, required } object.
 * @param {string} at - human path for error messages.
 * @returns {string | null} an error message, or null when valid.
 */
function validatePropertiesSchema(value, at) {
  if (value === undefined) return null
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return `${at} must be { properties, required } or omitted`
  }
  const props = value.properties
  if (props !== undefined) {
    if (props === null || typeof props !== 'object' || Array.isArray(props)) {
      return `${at}.properties must be a plain object of property schemas`
    }
    for (const [name, p] of Object.entries(props)) {
      if (p === null || typeof p !== 'object' || Array.isArray(p)) {
        return `${at}.properties["${name}"] must be an object (a JSON-schema-ish leaf)`
      }
      if (p.type !== undefined && !['string', 'number', 'integer', 'boolean', 'array', 'object', 'null', 'json'].includes(p.type)) {
        return `${at}.properties["${name}"].type "${p.type}" is not allowed`
      }
    }
  }
  const req = value.required
  if (req !== undefined) {
    if (!Array.isArray(req) || req.some((r) => typeof r !== 'string')) {
      return `${at}.required must be an array of property names`
    }
  }
  return null
}
