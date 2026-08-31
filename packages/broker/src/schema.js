/**
 * @agent-core/broker — Capability manifest schema & validation (V1, Transport V1).
 *
 * A capability manifest is PLAIN DATA (JSON-serializable; no functions) that
 * describes the contract surface of one Agent Core capability: its wire id,
 * its operations, per-operation parameter/result schemas, its error-code table,
 * and human-facing descriptions. The generic broker engine turns such a
 * manifest (+ a separate, code-side handler map) into one model-facing DSH tool.
 *
 * Transport V1 addition: an operation may carry an optional generic `http`
 * binding block (target / method / path / pathParams / query / body /
 * idempotencyKey — see transport.js). Operations with an `http` block are
 * executed by the shared authorized-HTTP transport instead of a
 * process-internal handler; the binding is trusted manifest data that pins
 * the outbound request (never model input).
 *
 * The "handler" that actually performs an operation is deliberately NOT part of
 * the manifest (a manifest must stay data); it lives next to it in code and is
 * keyed by capability id / operation name. This keeps docs/reports/broker-v1.md
 * honest: Forum / Workflow / OKR will only ever provide manifest data + a
 * handler (or an `http` binding), no new generic machinery.
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

  // ---- id (wire capability name) ----
  // Grammar: `external.calculator` (dotted namespace) OR a flat broker wire id
  // like `forum_read_thread` / `workflow_my_tasks` (the ids used by the real
  // deployed capability registry, see docs/investigations/broker-capability-parity.md).
  // Lowercase start; segments may contain letters, digits, underscores.
  if (typeof input.id !== 'string' || input.id.length === 0) {
    errors.push(path('id') + ' must be a non-empty string')
  } else if (!/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/.test(input.id)) {
    errors.push(path('id') + ` "${input.id}" must be a lowercase wire id (dotted like external.calculator, or flat like forum_read_thread)`)
  } else {
    manifest.id = input.id
  }

  // ---- requiredScopes (capability-level; drives the token request scope) ----
  manifest.requiredScopes = []
  if (input.requiredScopes !== undefined) {
    if (!Array.isArray(input.requiredScopes) || input.requiredScopes.length === 0) {
      errors.push(path('requiredScopes') + ' must be a non-empty array of scope strings (e.g. ["workflow.read"])')
    } else {
      for (const [i, s] of input.requiredScopes.entries()) {
        if (typeof s !== 'string' || !/^[a-z][a-zA-Z0-9_.-]*$/.test(s)) {
          errors.push(path(`requiredScopes[${i}]`) + ` "${s}" must be a lowercase scope (e.g. forum.write)`)
        } else {
          manifest.requiredScopes.push(s)
        }
      }
    }
  }

  // ---- toolName (underscore DSH tool name); derive from id by default ----
  if (input.toolName !== undefined) {
    if (typeof input.toolName !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(input.toolName)) {
      errors.push(path('toolName') + ' must be a lowercase identifier (underscore grammar)')
    } else {
      manifest.toolName = input.toolName
    }
  }

  // ---- model selector (backward-compatible default: operation) ----
  // Existing manifests omit this field and keep the historical `operation`
  // selector. A manifest may opt into another lowercase selector (the unified
  // Scheduler declares `action`).
  if (input.selector === undefined) {
    manifest.selector = 'operation'
  } else if (typeof input.selector !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(input.selector)) {
    errors.push(path('selector') + ' must be a lowercase identifier')
  } else {
    manifest.selector = input.selector
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

  // ---- local (in-process capability marker; no http binding) ----
  // AGENT_DEFINITION_ACCESS_V1: a capability with `local: true` (or
  // `local: { resource }`) is executed IN-PROCESS by the parent (gateway
  // mode) against an injected handler; in child mode its tools RELAY to the
  // parent like http-bound ones. `resource` is the nominal token resource
  // used for the optional grant check (see requiredScopes).
  let local = undefined
  if (input.local !== undefined) {
    if (input.local === true) {
      local = { resource: undefined }
    } else if (typeof input.local === 'object' && input.local !== null && !Array.isArray(input.local)) {
      if (typeof input.local.resource !== 'string' || input.local.resource.length === 0) {
        errors.push(path('local') + '.resource must be a non-empty string when local is an object')
      } else {
        local = { resource: input.local.resource }
      }
    } else {
      errors.push(path('local') + ' must be true or { resource: string }')
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
      // A property's declared validationError code must exist in the
      // capability error table (fail-closed: the mapping layer resolves
      // violation codes against that table and would silently downgrade an
      // undeclared one to invalid_arguments).
      for (const [pname, p] of Object.entries(op.arguments?.properties || {})) {
        if (p && typeof p.validationError === 'string') {
          if (input.errors === undefined || !input.errors.some((e) => e && e.code === p.validationError)) {
            errors.push(opPath + `.arguments.properties["${pname}"].validationError references undeclared code "${p.validationError}"`)
          }
        }
      }
      // Generic co-presence groups follow the same fail-closed discipline:
      // their local validation code must be declared by the capability.
      for (const [groupIndex, group] of (op.arguments?.allOrNone ?? []).entries()) {
        if (group && typeof group.validationError === 'string') {
          if (input.errors === undefined || !input.errors.some((e) => e && e.code === group.validationError)) {
            errors.push(opPath + `.arguments.allOrNone[${groupIndex}].validationError references undeclared code "${group.validationError}"`)
          }
        }
      }
      // optional generic HTTP binding (the authorized-HTTP transport contract;
      // see transport.js). When present, this operation is executed by the
      // generic transport instead of a process-internal handler. A LOCAL
      // capability never mixes with http bindings.
      let http = undefined
      if (op.http !== undefined) {
        if (local !== undefined) {
          errors.push(opPath + '.http must not be combined with a local capability')
          continue
        }
        const httpErr = validateHttpBinding(op.http, opPath + '.http', op.arguments?.properties || {})
        if (httpErr) {
          errors.push(httpErr)
          continue
        }
        http = op.http
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
            : {
                type: 'object',
                properties: op.arguments.properties || {},
                required: Array.isArray(op.arguments.required) ? op.arguments.required : [],
                ...(op.arguments.additionalProperties === false ? { additionalProperties: false } : {}),
                ...(Array.isArray(op.arguments.allOrNone)
                  ? {
                      allOrNone: op.arguments.allOrNone.map((group) => ({
                        properties: [...group.properties],
                        validationError: group.validationError,
                      })),
                    }
                  : {}),
              },
        result: op.result === undefined ? { type: 'json' } : op.result,
        errors: [...opErrors],
        http,
      })
    }
  }

  // ---- local (in-process) capability invariants ----
  if (local !== undefined) {
    // The write-side grant check needs scopes; read-only local capabilities
    // may omit them (open to every credentialed agent).
    if (manifest.operations.some((o) => o.http !== undefined)) {
      errors.push(path('local') + ' capability must not declare http bindings')
    }
    manifest.local = local
  }

  // An http-bound capability MUST declare its required scopes: the transport
  // requests `scope=<requiredScopes>` from the token endpoint, so a missing
  // scope list would silently issue a scope-less (useless) token.
  if (manifest.operations.some((o) => o.http !== undefined) && manifest.requiredScopes.length === 0) {
    errors.push(path('requiredScopes') + ' is required when any operation declares an http binding')
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
  if (value.additionalProperties !== undefined && value.additionalProperties !== false) {
    return `${at}.additionalProperties may only be false when declared`
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
      // Broker-side bounds (fail-fast BEFORE any HTTP request): numeric leaves
      // may declare minimum/maximum; a bounds violation reports the leaf's
      // declared `validationError` code (which must exist in the capability's
      // error table — checked below at manifest level).
      for (const bound of ['minimum', 'maximum']) {
        if (p[bound] !== undefined && typeof p[bound] !== 'number') {
          return `${at}.properties["${name}"].${bound} must be a number`
        }
      }
      if (p.validationError !== undefined) {
        if (typeof p.validationError !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(p.validationError)) {
          return `${at}.properties["${name}"].validationError "${p.validationError}" must be a lowercase identifier`
        }
        if ((p.minimum === undefined && p.maximum === undefined)) {
          return `${at}.properties["${name}"].validationError requires minimum or maximum`
        }
      }
      // `nonBlank: true` (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
      // CTR-FMC-006): a string-leaf-only flag; the mapping layer rejects
      // missing/empty/whitespace-only values locally with invalid_arguments
      // before any token mint or business HTTP call.
      if (p.nonBlank !== undefined) {
        if (p.nonBlank !== true && p.nonBlank !== false) {
          return `${at}.properties["${name}"].nonBlank must be a boolean`
        }
        if (p.type !== 'string') {
          return `${at}.properties["${name}"].nonBlank is only allowed on string leaves`
        }
      }
    }
  }
  const req = value.required
  if (req !== undefined) {
    if (!Array.isArray(req) || req.some((r) => typeof r !== 'string')) {
      return `${at}.required must be an array of property names`
    }
  }

  // Root-level generic co-presence constraints. When any named property is
  // supplied, all named properties must be supplied. The mapping layer applies
  // these groups before a handler (and therefore before credential/token/HTTP
  // work); this validator keeps the manifest metadata closed and canonical.
  const groups = value.allOrNone
  if (groups !== undefined) {
    if (!Array.isArray(groups) || groups.length === 0) {
      return `${at}.allOrNone must be a non-empty array of groups`
    }
    for (const [i, group] of groups.entries()) {
      if (group === null || typeof group !== 'object' || Array.isArray(group)) {
        return `${at}.allOrNone[${i}] must be an object`
      }
      if (!Array.isArray(group.properties) || group.properties.length < 2 || group.properties.some((name) => typeof name !== 'string' || name.length === 0)) {
        return `${at}.allOrNone[${i}].properties must be an array of at least 2 property names`
      }
      const seen = new Set()
      for (const name of group.properties) {
        if (seen.has(name)) return `${at}.allOrNone[${i}].properties contains duplicate "${name}"`
        seen.add(name)
        if (props === undefined || !Object.hasOwn(props, name)) {
          return `${at}.allOrNone[${i}] references undeclared property "${name}"`
        }
      }
      if (typeof group.validationError !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(group.validationError)) {
        return `${at}.allOrNone[${i}].validationError "${group.validationError}" must be a lowercase identifier`
      }
    }
  }
  return null
}

/** HTTP methods the generic transport is willing to execute. */
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])

/**
 * Validate one operation's optional `http` binding block:
 *
 *   http: {
 *     target: 'svc-forum',                 // targetId from the targets registry (trusted config)
 *     method: 'GET',                       // GET | POST | PUT | DELETE | PATCH (pinned, model cannot change)
 *     path: '/api/threads/{threadId}',     // path template; {name} placeholders
 *     pathParams: ['threadId'],            // arg names bound to {placeholders} (exact match)
 *     query: ['page', 'limit'],            // arg names forwarded as query params
 *     body: ['content'],                   // arg names forwarded as a JSON body object (write methods)
 *     idempotencyKey: false,               // transport generates & forwards Idempotency-Key
 *   }
 *
 * Why this extension is needed: the V1 manifest described ONLY the model-facing
 * contract surface (operations + argument schemas + error codes) and delegated
 * execution to a process-internal handler. The authorized-HTTP transport needs
 * trusted (model-uncontrollable) metadata that pins the outbound request —
 * which target, which method, which path, and which argument names may flow
 * into path/query/body. There is no existing field that can carry this, so the
 * generic `http` block is the minimal extension (one capability never hardcodes
 * a business system; the transport is driven by this data alone).
 *
 * @param {unknown} http - candidate http binding block.
 * @param {string} at - human path for error messages.
 * @param {object} properties - the operation's argument property schemas.
 * @returns {string | null} an error message, or null when valid.
 */
function validateHttpBinding(http, at, properties) {
  if (http === null || typeof http !== 'object' || Array.isArray(http)) {
    return `${at} must be an object`
  }
  if (typeof http.target !== 'string' || http.target.length === 0) {
    return `${at}.target must be a non-empty string (a targetId from the targets registry)`
  }
  if (typeof http.method !== 'string' || !HTTP_METHODS.has(http.method)) {
    return `${at}.method must be one of ${[...HTTP_METHODS].join('|')}`
  }
  if (typeof http.path !== 'string' || http.path.length === 0 || !http.path.startsWith('/')) {
    return `${at}.path must be a non-empty string starting with "/"`
  }
  const placeholders = extractPlaceholders(http.path)
  if (placeholders.some((p) => !/^[a-zA-Z0-9_]+$/.test(p))) {
    return `${at}.path contains an invalid {placeholder}`
  }

  // Binding lists: arrays of argument names, unique, all declared in the
  // operation's argument schema (fail-closed: the transport may only forward
  // arguments the manifest declares).
  const bound = {}
  for (const key of ['pathParams', 'query', 'body']) {
    const list = http[key]
    if (list === undefined) {
      bound[key] = []
      continue
    }
    if (!Array.isArray(list) || list.some((x) => typeof x !== 'string')) {
      return `${at}.${key} must be an array of argument names`
    }
    const seen = new Set()
    for (const name of list) {
      if (seen.has(name)) return `${at}.${key} contains duplicate "${name}"`
      seen.add(name)
      if (!Object.hasOwn(properties, name)) {
        return `${at}.${key} references undeclared argument "${name}"`
      }
    }
    bound[key] = list
  }

  // Every path placeholder must be bound by pathParams (exact match; the
  // transport rejects missing/extra params at request time too).
  for (const ph of placeholders) {
    if (!bound.pathParams.includes(ph)) {
      return `${at}.path placeholder "{${ph}}" has no pathParams binding`
    }
  }

  if (http.idempotencyKey !== undefined && typeof http.idempotencyKey !== 'boolean') {
    return `${at}.idempotencyKey must be a boolean`
  }
  return null
}

/** Extract `{name}` placeholders from a path template, in order. */
function extractPlaceholders(path) {
  const out = []
  const re = /\{([^}]+)\}/g
  let m
  while ((m = re.exec(path)) !== null) out.push(m[1])
  return out
}
