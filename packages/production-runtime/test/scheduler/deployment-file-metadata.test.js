import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readProtectedPlainFile } from '../../src/scheduler/deployment-file-metadata.js'

test('protected audit read validates every ancestor and rejects a symlinked parent', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'protected-token-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const real = join(root, 'real'), link = join(root, 'link'); mkdirSync(real); symlinkSync(real, link)
  const token = join(real, 'token'); writeFileSync(token, 'opaque', { mode: 0o600 }); chmodSync(root, 0o700); chmodSync(real, 0o700)
  const stat = lstatSync(token), security = { boundary: root, expectedUid: stat.uid, expectedGid: stat.gid, mode: 0o600 }
  assert.equal(readProtectedPlainFile(token, security).bytes.toString(), 'opaque')
  assert.throws(() => readProtectedPlainFile(join(link, 'token'), security), /canonical|ancestor/)
})
