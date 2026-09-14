import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertProtectedAncestorMetadata, readProtectedPlainFile } from '../../src/scheduler/deployment-file-metadata.js'

test('protected audit read validates every ancestor and rejects a symlinked parent', (t) => {
  const root = mkdtempSync(join(process.cwd(), '.protected-token-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const real = join(root, 'real'), link = join(root, 'link'); mkdirSync(real); symlinkSync(real, link)
  const token = join(real, 'token'); writeFileSync(token, 'opaque', { mode: 0o600 }); chmodSync(root, 0o700); chmodSync(real, 0o700)
  const stat = lstatSync(token), security = { boundary: '/', expectedUid: stat.uid, expectedGid: stat.gid, mode: 0o600 }
  assert.throws(() => readProtectedPlainFile(token, security), /ancestor chain/)
  assert.throws(() => readProtectedPlainFile(join(link, 'token'), security), /canonical|ancestor/)
  if (process.platform === 'darwin') {
    execFileSync('/usr/bin/xattr', ['-w', 'test.scheduler.unsafe', '1', real])
    assert.throws(() => readProtectedPlainFile(token, security), /ancestor chain/)
  }
})

test('strict audit ancestor policy rejects even platform xattrs', () => {
  assert.throws(() => assertProtectedAncestorMetadata({ directory: true, symlink: false, uid: process.getuid(),
    mode: 0o700, extendedAcl: false, extendedAttributes: true }, process.getuid()), /ancestor chain/)
})
