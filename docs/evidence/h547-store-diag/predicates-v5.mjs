// Read-only invocation of the retained, byte-bound deployed reader. No constructor.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readDurableRecoveryStore, readAbandonmentDeclarationRegistry } from './private/v2/source/packages/agent-router/src/reconciliation/durable-file.js'
import { RECONCILIATION_CAPS } from './private/v2/source/packages/agent-router/src/reconciliation/capacity.js'

const file = new URL('./private/v3/pass-1/turn-recovery-v3.json', import.meta.url)
const bytes = readFileSync(file)
const raw = JSON.parse(bytes)
const decoded = readDurableRecoveryStore(file)
const registry = readAbandonmentDeclarationRegistry(new URL(`${file.href}.abandonment-declarations.json`))
assert.equal(decoded.records.size, raw.records.length)
console.log(JSON.stringify({
  method: 'retained deployed readDurableRecoveryStore + readAbandonmentDeclarationRegistry; no constructor/write',
  source_provenance: 'capture-v2-receipt.json source_files, all 18 hashes rechecked in path-selfcheck-v5.json',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  records: decoded.records.size,
  epochs: decoded.runtimeEpochs.size,
  epoch_cap: RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS,
  declarations: registry.length,
  actual: 'all deployed file/schema/record/issuance decoding predicates passed',
  expected: 'preserve actual result; a past durable_store_invalid is not required to reproduce',
  failure: null,
  limitation: 'not full constructor/capacity recount, not loaded runtime evidence',
}, null, 2))
