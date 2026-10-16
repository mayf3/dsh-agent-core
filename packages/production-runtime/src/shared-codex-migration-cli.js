#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  executeFleetSharedCodexMigration, executeFleetSharedCodexRollback,
} from './shared-codex-migration-executable.js'

const [mode, configArg, activation] = process.argv.slice(2)
if (!['migrate', 'rollback'].includes(mode) || !configArg) {
  process.stderr.write('usage: shared-codex-migration-cli.js <migrate|rollback> <absolute-config.json> [--activate-production]\n')
  process.exit(2)
}
const configFile = resolve(configArg)
const config = JSON.parse(readFileSync(configFile, 'utf8'))
const options = { allowProduction: activation === '--activate-production' }
const report = mode === 'migrate'
  ? executeFleetSharedCodexMigration(config, options)
  : executeFleetSharedCodexRollback(config, options)
process.stdout.write(`${JSON.stringify(report)}\n`)
