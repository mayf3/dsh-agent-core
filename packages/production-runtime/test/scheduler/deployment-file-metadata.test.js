import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { capturePlainFileMetadata } from '../../src/scheduler/deployment-file-metadata.js'

test('protected deployment metadata rejects non-platform extended attributes', { skip: process.platform !== 'darwin' }, (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-metadata-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'candidate')
  writeFileSync(file, 'candidate')
  execFileSync('/usr/bin/xattr', ['-w', 'user.scheduler-test', 'unsafe', file])
  assert.throws(() => capturePlainFileMetadata(file), /ACL\/xattrs are unsupported/)
})
