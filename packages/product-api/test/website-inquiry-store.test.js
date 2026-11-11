import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InquiryStore } from '../src/website-inquiry/store.js'

test('durable RID transaction survives separate store handles and consumes once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'whi-store-'))
  const file = join(dir, 'requests.sqlite')
  const a = new InquiryStore(file)
  const b = new InquiryStore(file)
  try {
    a.transaction('scope', state => { state.requests.rid = { digest: 'original', status: 'AUTHORIZED' } })
    b.transaction('scope', state => { assert.equal(state.requests.rid.digest, 'original'); state.requests.rid.status = 'ATTEMPT_STARTED' })
    a.transaction('scope', state => { assert.equal(state.requests.rid.status, 'ATTEMPT_STARTED') })
    assert.throws(() => a.transaction('scope', state => { state.requests.rid.digest = 'bad'; throw Error('crash') }))
    assert.equal(b.snapshot('scope').requests.rid.digest, 'original')
    a.close()
    const restarted = new InquiryStore(file)
    assert.equal(restarted.snapshot('scope').requests.rid.status, 'ATTEMPT_STARTED')
    restarted.close()
  } finally { b.close(); rmSync(dir, { recursive: true, force: true }) }
})
