/**
 * @agent-core/broker — Workflow Authoring File Entry (candidate:
 * AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1).
 *
 * ONE narrow child-side tool beside the existing capability tools:
 *
 *   workflow_definition_authoring_file(path, expectedSha256?)
 *
 * It reads ONE explicitly named local JSON file inside the agent's primary
 * workspace, parses it, re-validates it against the UNCHANGED
 * `workflow_definition_authoring` manifest, and relays it as the EXISTING
 * `replace_draft_graph` operation over the existing parent-RPC broker
 * channel. Nothing else: no other capability, no other operation, no
 * generic file→RPC surface. Caller identity, credential, scope and the
 * Idempotency-Key stay owned by the existing trusted seams (the parent
 * strips child-supplied identity fields; `additionalProperties=false` on
 * the operation root rejects any identity field inside the file BEFORE the
 * relay).
 *
 * The read is single-shot and bounded: the exact bytes read once are
 * hashed (SHA-256), parsed, validated, relayed and persisted as evidence —
 * no second read, no TOCTOU window. The complete parsed args object and
 * its hash are appended to the evidence JSONL BEFORE the relay (a write
 * failure aborts the call); the full result/error envelope (including the
 * downstream requestId when present) is appended after it. Unknown
 * outcomes are never auto-retried.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, statSync, appendFileSync } from 'node:fs'
import { isAbsolute, join as joinPath, sep } from 'node:path'

import { validateInvocation } from './mapping.js'
import { BROKER_RPC_METHOD } from './relay.js'

/** Proposed tool name (underscore-safe per existing tool conventions; the
 *  Owner may rename before acceptance without a semantic delta). */
export const AUTHORING_FILE_ENTRY_TOOL_NAME = 'workflow_definition_authoring_file'

/** The ONE operation this entry may relay. */
export const AUTHORING_FILE_ENTRY_OPERATION = 'replace_draft_graph'

/** Read bound aligned with the existing parent-RPC frame cap (1 MiB). */
export const AUTHORING_FILE_ENTRY_MAX_BYTES = 1048576

const EVIDENCE_DIR = '.workflow-authoring-file-entry'
const SHA256_HEX = /^[0-9a-f]{64}$/i

function fail(detail) {
  return { ok: false, error: { code: 'invalid_arguments', detail } }
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Resolve the agent's primary workspace from the EXISTING spawn env channel
 * ($DSH_PRIMARY_WORKSPACE — the same mechanism agent-memory uses). Returns
 * the REAL absolute path, or undefined when the channel is absent/relative
 * or the directory does not exist (fail closed — callers skip registration).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | undefined}
 */
export function resolveAuthoringWorkspace(env = process.env) {
  const raw = env?.DSH_PRIMARY_WORKSPACE
  if (typeof raw !== 'string' || isAbsolute(raw) === false || raw.trim() === '') return undefined
  try {
    return realpathSync(raw)
  } catch {
    return undefined
  }
}

function appendEvidenceLine(evidenceFile, entry, log) {
  try {
    mkdirSync(joinPath(evidenceFile, '..'), { recursive: true })
    appendFileSync(evidenceFile, `${JSON.stringify(entry)}\n`)
    return true
  } catch (cause) {
    log?.(`[broker] authoring file entry: evidence append failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    return false
  }
}

/**
 * Build the tool definition. The caller supplies:
 * @param {object} opts
 * @param {object} opts.manifest - the (validated) workflow_definition_authoring
 *   manifest — the ONLY source of argument validation (unchanged).
 * @param {(call: {capabilityId: string, operation: string, args: object}) =>
 *   Promise<{ok: true, result: unknown} | {ok: false, error: {code: string,
 *   status?: number, detail?: string, requestId?: string}}>} opts.requestFn -
 *   the relay seam returning the gateway INVOKE-SHAPED envelope (the child
 *   wiring in maybeRegisterAuthoringFileEntry unwraps the transport layer).
 * @param {string} opts.workspaceRoot - REAL absolute workspace path.
 * @param {string} opts.evidenceFile - absolute evidence JSONL path.
 * @param {(msg: string) => void} [opts.log]
 */
export function createAuthoringFileEntryTool({ manifest, requestFn, workspaceRoot, evidenceFile, log }) {
  const workspaceReal = realpathSync(workspaceRoot)
  const operationSpec = manifest.operations.find((op) => op.name === AUTHORING_FILE_ENTRY_OPERATION)
  if (operationSpec === undefined) {
    throw new Error(`authoring file entry: manifest has no ${AUTHORING_FILE_ENTRY_OPERATION} operation`)
  }

  async function execute(args) {
    const requestedPath = args?.path
    if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
      return fail('path is required (absolute path of the arguments JSON file inside the agent workspace)')
    }
    if (isAbsolute(requestedPath) === false) {
      return fail(`path must be absolute and inside the agent workspace (${workspaceReal})`)
    }
    const expectedSha256 = args?.expectedSha256
    if (expectedSha256 !== undefined && (typeof expectedSha256 !== 'string' || SHA256_HEX.test(expectedSha256) === false)) {
      return fail('expectedSha256 must be a 64-character lowercase hex digest when supplied')
    }

    let fileReal
    try {
      fileReal = realpathSync(requestedPath)
    } catch (cause) {
      return fail(`arguments file not readable at ${requestedPath}: ${cause?.code ?? cause?.message ?? cause}`)
    }
    if (fileReal !== workspaceReal && fileReal.startsWith(`${workspaceReal}${sep}`) === false) {
      return fail(`arguments file resolves outside the agent workspace boundary (${workspaceReal}): ${fileReal}`)
    }
    let stats
    try {
      stats = statSync(fileReal)
    } catch (cause) {
      return fail(`arguments file not statable at ${fileReal}: ${cause?.code ?? cause?.message ?? cause}`)
    }
    if (stats.isFile() === false) {
      return fail(`arguments path is not a regular file: ${fileReal}`)
    }
    if (stats.size > AUTHORING_FILE_ENTRY_MAX_BYTES) {
      return fail(`arguments file is ${stats.size} bytes, over the ${AUTHORING_FILE_ENTRY_MAX_BYTES} (1 MiB) read bound`)
    }

    // Single read: hash/parse/validate/relay/persist exactly these bytes.
    const bytes = readFileSync(fileReal)
    if (bytes.byteLength > AUTHORING_FILE_ENTRY_MAX_BYTES) {
      return fail(`arguments file grew past the ${AUTHORING_FILE_ENTRY_MAX_BYTES} (1 MiB) read bound between stat and read`)
    }
    const digest = sha256Hex(bytes)
    if (expectedSha256 !== undefined && digest !== expectedSha256.toLowerCase()) {
      return fail(`arguments file sha256 ${digest} does not match expectedSha256 ${expectedSha256.toLowerCase()}; the file changed — re-read it and retry with the fresh digest`)
    }

    let parsed
    try {
      parsed = JSON.parse(bytes.toString('utf8'))
    } catch (cause) {
      return fail(`arguments file is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fail('arguments file must contain a single JSON object')
    }

    // Existing full validation, unchanged manifest, BEFORE any relay.
    const validated = validateInvocation(manifest, { operation: AUTHORING_FILE_ENTRY_OPERATION, args: parsed })
    if (validated.ok !== true) {
      appendEvidenceLine(evidenceFile, {
        ts: Date.now(), stage: 'rejected', path: fileReal, bytes: bytes.byteLength, sha256: digest,
        envelope: validated.error,
      }, log)
      // validateInvocation already returns the exact envelope shape.
      return validated
    }

    const requestWritten = appendEvidenceLine(evidenceFile, {
      ts: Date.now(), stage: 'request', tool: AUTHORING_FILE_ENTRY_TOOL_NAME,
      capabilityId: manifest.id, operation: AUTHORING_FILE_ENTRY_OPERATION,
      path: fileReal, bytes: bytes.byteLength, sha256: digest, args: parsed,
    }, log)
    if (requestWritten === false) {
      return { ok: false, error: { code: 'evidence_write_failed', detail: `the request evidence line (full args + sha256) could not be persisted to ${evidenceFile}; nothing was submitted` } }
    }

    let envelope
    try {
      envelope = await requestFn({ capabilityId: manifest.id, operation: AUTHORING_FILE_ENTRY_OPERATION, args: parsed })
    } catch (cause) {
      const error = { code: 'invalid_arguments', detail: `broker relay failed: ${cause instanceof Error ? cause.message : String(cause)}` }
      appendEvidenceLine(evidenceFile, { ts: Date.now(), stage: 'response', path: fileReal, sha256: digest, envelope: error }, log)
      return { ok: false, error }
    }
    if (envelope === undefined || envelope === null
      || (envelope.ok !== true && envelope.ok !== false)
      || (envelope.ok === false && (envelope.error === undefined || typeof envelope.error?.code !== 'string'))) {
      const error = { code: 'invalid_arguments', detail: 'broker relay returned an unusable envelope; nothing was retried' }
      appendEvidenceLine(evidenceFile, { ts: Date.now(), stage: 'response', path: fileReal, sha256: digest, envelope: error }, log)
      return { ok: false, error }
    }
    appendEvidenceLine(evidenceFile, {
      ts: Date.now(), stage: 'response', path: fileReal, sha256: digest, envelope,
    }, log)
    return envelope
  }

  return {
    definition: {
      name: AUTHORING_FILE_ENTRY_TOOL_NAME,
      description:
        'Submit a complete workflow definition draft graph from a local JSON file, without restating it. ' +
        `The file must be a single JSON object holding the EXACT arguments of workflow_definition_authoring ` +
        `${AUTHORING_FILE_ENTRY_OPERATION} (domainId, definitionId, definitionVersionId, and either nodes+transitions or ` +
        'steps+terminalOutcome, optionally contextSchema). The file must already exist INSIDE your workspace; pass its ' +
        'absolute path. Use this instead of typing large graphs inline: read/produce the file first (e.g. with your file ' +
        'tools), then call this tool once. The full object is validated and relayed verbatim under your own caller ' +
        'identity (DOMAIN_OWNER authorization and idempotency are enforced downstream); identity fields in the file are ' +
        'rejected. Returns the same envelope as workflow_definition_authoring. Never retry an unknown outcome automatically.',
      parameters: {
        path: {
          type: 'string',
          required: true,
          description: 'Absolute path of the arguments JSON file, inside your own workspace.',
        },
        expectedSha256: {
          type: 'string',
          description: 'Optional sha256 of the file contents; when supplied and the file hash differs, the call is rejected before submission (staleness guard).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            result: { type: 'json' },
            error: {
              type: 'object',
              additionalProperties: false,
              properties: {
                code: { type: 'string', required: true },
                status: { type: 'number' },
                detail: { type: 'string' },
                requestId: { type: 'string' },
              },
            },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: value?.ok === true
            ? `workflow_definition_authoring.replace_draft_graph(file) = ${JSON.stringify(value.result)} (ok: true)`
            : `workflow_definition_authoring.replace_draft_graph(file) failed: ${value?.error?.code ?? 'unknown_error'}${typeof value?.error?.detail === 'string' && value.error.detail.length > 0 ? `: ${value.error.detail.slice(0, 400)}` : ''}`,
        }],
      },
      execute,
    },
  }
}

/**
 * Child-mode wiring: resolve the workspace from the spawn env channel, build
 * the relay seam over the EXISTING parent-RPC channel (lazy agentRpc lookup,
 * transport-envelope unwrap — the same two layers the capability relay
 * unwraps), register the tool, and return its definition. Skips (fail
 * closed, zero surface) when config disables it, the workspace channel is
 * absent, or the manifest lacks the operation.
 * @param {object} ctx - plugin context (needs `tools.register`, `get`).
 * @param {(definition: object) => object} defineTool
 * @param {object} opts
 * @param {object} opts.manifest - the workflow_definition_authoring manifest.
 * @param {boolean} [opts.enabled]
 * @param {(msg: string) => void} [opts.log]
 */
export function maybeRegisterAuthoringFileEntry(ctx, defineTool, { manifest, enabled = true, log = (m) => process.stderr.write(`${m}\n`) }) {
  if (enabled === false) {
    log('[broker] authoring file entry: disabled by config')
    return undefined
  }
  const workspaceRoot = resolveAuthoringWorkspace()
  if (workspaceRoot === undefined) {
    log('[broker] authoring file entry: not registered (DSH_PRIMARY_WORKSPACE absent or not an existing absolute directory)')
    return undefined
  }
  const requestFn = async (call) => {
    const agentRpc = ctx.get('agentRpc')
    if (agentRpc === undefined || typeof agentRpc.request !== 'function') {
      return { ok: false, error: { code: 'invalid_arguments', detail: 'broker relay unavailable: no parent-RPC channel' } }
    }
    let transport
    try {
      transport = await agentRpc.request(BROKER_RPC_METHOD, call)
    } catch (cause) {
      return { ok: false, error: { code: 'invalid_arguments', detail: `broker relay failed: ${cause instanceof Error ? cause.message : String(cause)}` } }
    }
    if (transport?.ok === true && transport.result !== null && typeof transport.result === 'object'
      && (transport.result.ok === true || transport.result.ok === false)) {
      return transport.result
    }
    return { ok: false, error: { code: 'invalid_arguments', detail: 'broker relay returned an unusable envelope; nothing was retried' } }
  }
  const { definition } = createAuthoringFileEntryTool({
    manifest,
    requestFn,
    workspaceRoot,
    evidenceFile: joinPath(workspaceRoot, EVIDENCE_DIR, 'evidence.jsonl'),
    log,
  })
  const tool = defineTool(definition)
  ctx.tools.register(tool)
  log(`[broker] authoring file entry registered: ${AUTHORING_FILE_ENTRY_TOOL_NAME} (${workspaceRoot})`)
  return tool
}
