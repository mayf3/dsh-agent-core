#!/usr/bin/env node
/**
 * MIGRATE_REGISTRY_TO_DEFINITION — the ONE-TIME, thin migration path from
 * the old writable agent-registry store (`registry.json`) to the Agent
 * Definition config (AGENT_DEFINITION_CONFIG_V1).
 *
 * There is no migration service, no reconcile loop, no database and no
 * provisioning platform: this CLI is a pure, one-shot converter over
 * `convertRegistryStore` (packages/agent-definition/src/config.js). It is
 * meant to be run ONCE at cutover — after that the registry store is no
 * longer an authority anywhere.
 *
 * Conversion semantics (all fail-loud, never silently dropped/mangled):
 *   - every existing stable `agt_*` id is preserved VERBATIM;
 *   - the `defaultAgentId` choice is preserved VERBATIM;
 *   - `avatar` (never read by any production caller) and the internal
 *     `createdAt` / `updatedAt` bookkeeping are dropped;
 *   - persona / workspace / credential / runtime fields do not exist in the
 *     old store and are never invented.
 *
 * Usage:
 *   node scripts/migrate-registry-to-definition.mjs \
 *       [--from <old registry.json>] [--to <new agents.json>] [--force]
 *
 * Defaults:
 *   --from   ~/.dsh/registry/agents.json   (the old default store)
 *   --to     ~/.dsh/agents.json            (the new default config)
 *
 * --force overwrites an EXISTING target config; without it an existing
 * target aborts (the source of truth for the new authority must be
 * deliberate). Exit 0 on success, 1 on validation failure, 2 on infra
 * failure.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { convertRegistryStore } from '../packages/agent-definition/src/config.js'
import { writeAgentDefinition } from '../packages/agent-definition/src/config.js'

const here = dirname(fileURLToPath(import.meta.url))

function argValue(args, name, fallback) {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

async function main() {
  const argv = process.argv.slice(2)
  const from = resolve(argValue(argv, '--from', join(homedir(), '.dsh', 'registry', 'agents.json')))
  const to = resolve(argValue(argv, '--to', join(homedir(), '.dsh', 'agents.json')))
  const force = argv.includes('--force')

  if (!existsSync(from)) {
    console.error(`[migrate] source registry store not found: ${from} (nothing to migrate; the new config authority is empty until provisioned)`)
    process.exit(2)
  }
  if (existsSync(to) && !force) {
    console.error(`[migrate] target Agent Definition config already exists: ${to} (pass --force to overwrite; the old store is no longer an authority)`)
    process.exit(1)
  }

  let store
  try {
    store = JSON.parse(readFileSync(from, 'utf8'))
  } catch (error) {
    console.error(`[migrate] cannot read source store ${from}: ${error.message}`)
    process.exit(2)
  }

  try {
    const converted = convertRegistryStore(store)
    await writeAgentDefinition(to, converted)
    console.log(`[migrate] converted ${from} -> ${to}`)
    console.log(`[migrate] agents: ${converted.agents.map((a) => `${a.id} (${a.name})`).join(', ') || '(none)'}`)
    console.log(`[migrate] default: ${converted.defaultAgentId ?? '(none)'}`)
    console.log('[migrate] done — the Agent Definition config is now the SINGLE Agent existence authority')
  } catch (error) {
    console.error(`[migrate] conversion failed: ${error?.message ?? error}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`[migrate] infra failure: ${error?.stack ?? error}`)
  process.exit(2)
})
