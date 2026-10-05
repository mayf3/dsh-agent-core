#!/usr/bin/env node
// trusted-cp-model-overrides-config-gate.mjs — MODEL_OVERRIDES_CONFIG_GATE_V1 (G2.7)
//
// Pre-cutover fleet-config gate (agent-control#195 Defect C, Product #414,
// 2026-10-02): runs the INSTALLED tree's OWN loadAgentModelOverrides against
// the REAL production agent-model-overrides.json + REAL agents.json registry,
// READ-ONLY, BEFORE any restart. The #195 class — a freshly packed generation
// whose loader contract diverged from the deployed fleet config (v3-required
// loader vs v2 config → `must be {"version":3,...} (older files are not
// converted)` FATAL crash-loop at boot) — now fails closed at this gate
// instead of at cutover.
//
// Coverage gap this closes (same family as #191/#193, one layer deeper):
// installer §2c covers the harness closure arch/resolution; §3b/G2.6 cover
// the runtime app-graph IMPORT in a throwaway home (no config compose);
// G2.5 covers the fresh-child plugin tree. No earlier gate composes the
// production runtime against the REAL production config. G2.7 does — with
// the exact loader bytes and registry the restarted generation will use
// (compose.js:263 calls loadAgentModelOverrides at boot AND re-reads at
// every process boundary, so this is the same code path the cutover
// exercises).
//
// Usage (executor; invoke under the INSTALLED node-runtime):
//   node scripts/lib/trusted-cp-model-overrides-config-gate.mjs \
//     --installed-root /usr/local/libexec/agent-core/app \
//     --config /Users/authsvc/.agent-core/agent-model-overrides.json \
//     --registry /Users/authsvc/.agent-core/agents.json \
//     --deployment-root /Users/authsvc/.agent-core [--json]
// Hermetic mode (tests / executor --selftest-repair): pass
// --model-overrides-module and --definition-module explicitly to point at
// source-tree bytes instead of the installed tree.
//
// Verdict:
//   exit 0 = the real config loads clean under the real loader (file absent
//            is ALSO a pass — the loader's own legacy-passthrough semantics:
//            a missing file composes the global env route, it never fails);
//   exit 2 = any load failure. The loader's exact error is printed verbatim
//            (e.g. the #195 FATAL line) with its code.
// READ-ONLY: the config and registry are only ever read, and only by the
// loader itself; no file is written, no service touched, no sudo inside.

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function usage() {
  process.stderr.write([
    'usage: node trusted-cp-model-overrides-config-gate.mjs --installed-root <APP DIR> \\',
    '     --config <fleet config json> --registry <agents.json> --deployment-root <ROOT> [--json]',
    '     (hermetic: --model-overrides-module <path> --definition-module <path> instead of --installed-root)',
  ].join('\n') + '\n')
}

export function parseArgs(argv) {
  const args = {
    installedRoot: undefined,
    config: undefined,
    registry: undefined,
    deploymentRoot: undefined,
    modelOverridesModule: undefined,
    definitionModule: undefined,
    json: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--installed-root') args.installedRoot = argv[++i]
    else if (a === '--config') args.config = argv[++i]
    else if (a === '--registry') args.registry = argv[++i]
    else if (a === '--deployment-root') args.deploymentRoot = argv[++i]
    else if (a === '--model-overrides-module') args.modelOverridesModule = argv[++i]
    else if (a === '--definition-module') args.definitionModule = argv[++i]
    else if (a === '--json') args.json = true
    else { usage(); process.exit(2) }
  }
  if (!args.config || !args.registry || !args.deploymentRoot) { usage(); process.exit(2) }
  if (!args.installedRoot && !args.modelOverridesModule) { usage(); process.exit(2) }
  for (const [name, value] of [['--config', args.config], ['--registry', args.registry], ['--deployment-root', args.deploymentRoot], ['--installed-root', args.installedRoot], ['--model-overrides-module', args.modelOverridesModule]]) {
    if (value !== undefined && !isAbsolute(value)) {
      process.stderr.write(`${name} must be an absolute path (got ${value})\n`)
      process.exit(2)
    }
  }
  if (args.installedRoot) {
    args.modelOverridesModule = args.modelOverridesModule
      ?? join(resolve(args.installedRoot), 'packages/production-runtime/src/model-overrides.js')
    args.definitionModule = args.definitionModule
      ?? join(resolve(args.installedRoot), 'packages/agent-definition/src/definition.js')
  }
  if (!args.definitionModule) {
    // Same-tree derivation: model-overrides.js sits at
    // <tree>/packages/production-runtime/src/, the definition loader at
    // <tree>/packages/agent-definition/src/ — identical in the source
    // checkout and in the packed/installed app closure.
    args.definitionModule = join(dirname(args.modelOverridesModule), '../../agent-definition/src/definition.js')
  }
  return args
}

export async function runGate(args) {
  const result = {
    gate: 'MODEL_OVERRIDES_CONFIG_GATE_V1',
    config: args.config,
    registry: args.registry,
    deploymentRoot: args.deploymentRoot,
    modelOverridesModule: resolve(args.modelOverridesModule),
    definitionModule: resolve(args.definitionModule),
    ok: false,
    filePresent: false,
    overrideCount: 0,
    registeredAgentCount: 0,
    error: undefined,
    errorCode: undefined,
  }
  try {
    if (!existsSync(result.modelOverridesModule)) throw new Error(`loader module missing: ${result.modelOverridesModule}`)
    if (!existsSync(result.definitionModule)) throw new Error(`definition module missing: ${result.definitionModule}`)
    const loader = await import(pathToFileURL(result.modelOverridesModule).href)
    if (typeof loader.loadAgentModelOverrides !== 'function') throw new Error(`loadAgentModelOverrides not exported from ${result.modelOverridesModule}`)
    const definitionMod = await import(pathToFileURL(result.definitionModule).href)
    if (typeof definitionMod.parseDefinition !== 'function') throw new Error(`parseDefinition not exported from ${result.definitionModule}`)
    const registryText = (await import('node:fs')).readFileSync(args.registry, 'utf8')
    const definition = definitionMod.parseDefinition(registryText, { source: args.registry })
    const registeredAgentIds = Object.freeze(definition.agents.map((agent) => agent.id))
    result.registeredAgentCount = registeredAgentIds.length
    // The loader reads the config file itself — the gate never opens it (single
    // reader, exactly the compose.js call shape: loadAgentModelOverrides(file,
    // registeredAgentIds, { deploymentRoot })). A filePresent=false return is a
    // PASS (the loader's documented legacy-passthrough state).
    const loaded = loader.loadAgentModelOverrides(args.config, registeredAgentIds, { deploymentRoot: args.deploymentRoot })
    result.filePresent = loaded.filePresent === true
    result.overrideCount = Object.keys(loaded.overrides).length
    result.ok = true
  } catch (cause) {
    result.error = cause?.message ?? String(cause)
    result.errorCode = cause?.code
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const result = await runGate(args)
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else {
    process.stdout.write(`MODEL_OVERRIDES_CONFIG_GATE_V1 config=${result.config}\n`)
    process.stdout.write(`  loader=${result.modelOverridesModule}\n`)
    process.stdout.write(`  registry=${result.registry} registeredAgents=${result.registeredAgentCount}\n`)
    process.stdout.write(`  deploymentRoot=${result.deploymentRoot}\n`)
    if (result.ok) {
      process.stdout.write(`  CONFIG_LOAD_OK filePresent=${result.filePresent} overrides=${result.overrideCount}\n`)
    } else {
      process.stdout.write(`  CONFIG_LOAD_FAILED code=${result.errorCode ?? 'NONE'}\n  ${result.error}\n`)
    }
  }
  process.exit(result.ok ? 0 : 2)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
