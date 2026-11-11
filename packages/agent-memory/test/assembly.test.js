import './helpers/isolated-workspace.js'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as memory from '../src/memory.js'

test('assembly retains installed tail parse protection and refuses oversized files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'memory-assembly-'))
  t.after(() => rm(dir, {recursive:true, force:true}))
  const file = join(dir, 'MEMORY.md')
  const entry = title => memory.normalizeEntry({type:'preference',title,content:'fact',source:'tool'})
  const old = memory.renderEntries([entry('older')])
  const recent = memory.renderEntry(entry('newest'))
  await writeFile(file, old + '\n'.repeat(600000) + recent)
  assert.equal(typeof memory.loadEntriesTailSync, 'function')
  assert.deepEqual(memory.loadEntriesTailSync(file).map(x=>x.title), ['newest'])
  assert.throws(()=>memory.loadEntriesTailSync(file,{limits:{...memory.MEMORY_GUARD_LIMITS,maxFileBytes:100}}),{code:'MEMORY_GUARD_LIMIT'})
})
