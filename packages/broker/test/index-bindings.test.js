import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

// 2026-09-09 fleet boot regression (AGENT_PROCESS_EXITED, scheduler overlay):
// `export { X } from './y.js'` does NOT create a local binding for X — when
// the module body also CALLS X, evaluation of that call throws ReferenceError
// and (for broker) every agent child died before JSON-RPC startup. This file
// is deliberately dependency-free: broker/src/index.js imports
// @deepseek-ai/dsh-tools, which is unresolvable in CI worktrees, so the
// regression gate parses the source instead of executing it.

const INDEX = readFileSync(join(import.meta.dirname, '..', 'src', 'index.js'), 'utf8')

function exportedWithoutLocalBinding(source) {
  const missing = []
  const reExport = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = reExport.exec(source)) !== null) {
    const names = m[1].split(',').map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean)
    for (const name of names) {
      // A local binding exists iff the module also imports the name for itself.
      const localImport = new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]${m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      ).test(source)
      const localDecl = new RegExp(`\\b(?:function|const|let|var|class)\\s+${name}\\b`).test(source)
      if (!localImport && !localDecl) missing.push({ name, from: m[2] })
    }
  }
  return missing
}

test('shared broker boot regression: no re-exported symbol is used without a local binding', () => {
  const missing = exportedWithoutLocalBinding(INDEX)
  assert.deepEqual(missing, [], `re-export-without-binding = ReferenceError at apply() (fleet killer): ${JSON.stringify(missing)}`)
})

test('the fleet-killer symbol specifically has BOTH a local binding and its re-export', () => {
  assert.match(INDEX, /import\s*\{[^}]*withSchedulerMutationMask[^}]*\}\s*from\s*'\.\/readiness\.js'/, 'local binding required by apply()')
  assert.match(INDEX, /export\s*\{\s*withSchedulerMutationMask\s*\}\s*from\s*'\.\/readiness\.js'/, 'public re-export retained')
  const callSites = [...INDEX.matchAll(/(?<![\w.])(withSchedulerMutationMask)\s*\(/g)].length
  assert.ok(callSites >= 1, 'apply() call site present')
})
