#!/usr/bin/env node
/** Offline operator adapter. No defaults, live-store apply, signal or replay. */
import { reconcileCandidate, validateRecoveryFile } from '../../packages/agent-router/src/reconciliation/operator-candidate.js'

const [command, ...argv] = process.argv.slice(2)
try {
  const allowed = command === 'reconcile'
    ? ['--store', '--loader', '--loader-sha256', '--authorization', '--out']
    : command === 'validate' ? ['--store', '--loader', '--loader-sha256'] : []
  const args = new Map()
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.includes(argv[i]) || args.has(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error('ARGUMENTS_INVALID')
    }
    args.set(argv[i], argv[i + 1])
  }
  if (allowed.length === 0 || allowed.some(key => !args.has(key))) throw new Error('ARGUMENTS_INVALID')
  const options = { sourceFile: args.get('--store'), loader: args.get('--loader'), loaderSha256: args.get('--loader-sha256'),
    authorization: args.get('--authorization'), output: args.get('--out') }
  const receipt = command === 'reconcile' ? await reconcileCandidate(options) : await validateRecoveryFile(options)
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
} catch (error) {
  // No arbitrary loader errors or input bytes enter the operator log.
  process.stderr.write(`turn-recovery: ${/^[A-Z_]+$/u.test(error.code ?? error.message) ? error.code ?? error.message : 'OPERATION_REFUSED'}\n`)
  process.exitCode = 1
}
