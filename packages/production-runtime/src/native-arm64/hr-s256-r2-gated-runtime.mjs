#!/usr/bin/env node
/**
 * Fixed s256 R2 successor entry. This is not the ordinary launchd entry and
 * does not establish whole-host launch-source closure by itself.
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CHILD_PROOF = fileURLToPath(new URL('./hr-s256-r2-child-proof.py', import.meta.url))
const PYTHON = '/usr/bin/python3'

function parsedInvocation(argv) {
  const fields = new Map()
  const runtimeArgs = []
  const names = new Set([
    '--hr-r2-receipt-sha256', '--hr-r2-challenge-fd', '--hr-r2-window-fd',
  ])
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i]
    if (names.has(name)) {
      if (fields.has(name) || i + 1 >= argv.length) throw new Error('R2_INVOCATION_INVALID')
      fields.set(name, argv[++i])
    } else {
      runtimeArgs.push(name)
    }
  }
  const receipt = fields.get('--hr-r2-receipt-sha256')
  const challengeFd = Number(fields.get('--hr-r2-challenge-fd'))
  const windowFd = Number(fields.get('--hr-r2-window-fd'))
  if (!/^[0-9a-f]{64}$/.test(receipt ?? '') ||
      !Number.isSafeInteger(challengeFd) || challengeFd < 3 ||
      !Number.isSafeInteger(windowFd) || windowFd < 3 ||
      challengeFd === windowFd || !fields.has('--hr-r2-challenge-fd') ||
      !fields.has('--hr-r2-window-fd')) {
    throw new Error('R2_INVOCATION_INVALID')
  }
  return { receipt, challengeFd, windowFd, runtimeArgs }
}

async function main() {
  const { receipt, challengeFd, windowFd, runtimeArgs } = parsedInvocation(process.argv.slice(2))
  // The fixed helper's CLI requires root peer/window custody. No caller flag
  // can downgrade that requirement. It must receive the parent's approval
  // after the root side validates the returned same-open-file-description FD.
  const proof = spawnSync(PYTHON, ['-I', '-S', CHILD_PROOF, '--child-prove', '3', '4', receipt], {
    stdio: ['ignore', 'ignore', 'pipe', challengeFd, windowFd],
    env: { PATH: '/usr/bin:/bin', PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1' },
    timeout: 750,
  })
  if (proof.error || proof.status !== 0) throw new Error('R2_STARTUP_PROOF_REJECTED')

  // Nothing that opens the Router store or publishes business admission loads
  // before the proof above. The normal entry remains an independent route.
  const { assertProductionArchitecture } = await import('./admission.js')
  assertProductionArchitecture()
  process.argv = [process.argv[0], process.argv[1], ...runtimeArgs]
  const { runProductionRuntime } = await import('../entry.js')
  return runProductionRuntime()
}

main().catch((error) => {
  process.stderr.write(`[hr-s256-r2-gated-runtime] FATAL ${error?.message ?? error}\n`)
  process.exit(2)
})
