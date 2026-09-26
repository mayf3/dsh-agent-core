/** Fixed542e HR overlay only. Existing V5/Ingress bytes are never replaced. */
import { createHash } from 'node:crypto'
import contract from './hr-post-coherent-patches.json' with { type: 'json' }
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const reject = () => { throw new Error('HR_ROUTER_BASE_UNKNOWN') }
const index = 'packages/agent-router/src/index.js'
const startup = 'packages/agent-router/src/reconciliation/startup-recovery.js'
export const POST_COHERENT_HR_INPUT_PATHS = Object.freeze(Object.keys(contract.baseInputs))
export const POST_COHERENT_HR_LEAF_PATHS = Object.freeze(Object.keys(contract.proofLeaves))
const replace = (source, before, after) => {
  if (source.split(before).length !== 2) reject()
  return source.replace(before, after)
}

/** Two closed finite maps, never caller-selected paths or executable commands. */
export function composeHrPostCoherentSource(base, accepted) {
  const required = [startup, ...POST_COHERENT_HR_LEAF_PATHS]
  if (Object.keys(base).length !== POST_COHERENT_HR_INPUT_PATHS.length
      || Object.keys(accepted).length !== required.length) reject()
  for (const path of POST_COHERENT_HR_INPUT_PATHS) {
    if (!Buffer.isBuffer(base[path]) || sha(base[path]) !== contract.baseInputs[path]) reject()
  }
  if (!Buffer.isBuffer(accepted[startup]) || sha(accepted[startup]) !== contract.acceptedStartupSha256) reject()
  for (const path of POST_COHERENT_HR_LEAF_PATHS) {
    if (!Buffer.isBuffer(accepted[path]) || sha(accepted[path]) !== contract.proofLeaves[path]) reject()
  }
  const replacements = {}
  const importAnchor = "import { provisionAgentHome } from '../../agent-provisioning/src/index.js'"
  let router = replace(base[index].toString(), importAnchor, importAnchor +
    "\nimport { getFixedStartupContext, signalFixedStartupConsumptionFinished } from '../../production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'")
  const bindingAnchor = '  const bindingResolution = createBindingResolution({ agentDefinition, workspaceBootstrap, store, cfg, log })'
  router = replace(router, bindingAnchor,
    '  const fixedStartup = getFixedStartupContext()\n' +
    '  if (fixedStartup !== undefined) {\n' +
    '    reconciliationStore.consumeStartupQuiescence(fixedStartup)\n' +
    '    signalFixedStartupConsumptionFinished()\n' +
    '  }\n\n' + bindingAnchor)
  replacements[index] = Buffer.from(router)
  const authority = accepted[startup].toString()
  const start = authority.indexOf('  consumeStartupQuiescence(')
  const end = authority.indexOf('  restoreCrashInterruptedRecords()')
  if (start < 0 || end <= start) reject()
  const imports = authority.slice(authority.indexOf("import { readdirSync }"), authority.indexOf('export const startupRecoveryMethods'))
  replacements[startup] = Buffer.from(replace(base[startup].toString(),
    'export const startupRecoveryMethods = {\n', imports + 'export const startupRecoveryMethods = {\n' + authority.slice(start, end)))
  for (const [path, edits] of Object.entries(contract.patches)) {
    let source = base[path].toString()
    for (const edit of [...edits].reverse()) {
      if (source.slice(edit.offset, edit.offset + edit.before.length) !== edit.before) reject()
      source = source.slice(0, edit.offset) + edit.after + source.slice(edit.offset + edit.before.length)
    }
    replacements[path] = Buffer.from(source)
  }
  for (const path of POST_COHERENT_HR_LEAF_PATHS) replacements[path] = Buffer.from(accepted[path])
  return replacements
}
