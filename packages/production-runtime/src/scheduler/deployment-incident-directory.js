import {
  closeSync, constants, existsSync, fchmodSync, fchownSync, fstatSync, lstatSync, mkdirSync, openSync,
} from 'node:fs'

import { hasExtendedAcl } from './deployment-file-metadata.js'

const fail = () => { throw new TypeError('unsafe incident state directory') }

export function preparePrivateRuntimeDirectory({ path, expectedUid, expectedGid, allowedLegacyGids = [] } = {}) {
  if (typeof path !== 'string' || path === '' || !Number.isInteger(expectedUid) || !Number.isInteger(expectedGid)
    || !Array.isArray(allowedLegacyGids) || allowedLegacyGids.some((gid) => !Number.isInteger(gid))) fail()
  let created = false
  if (!existsSync(path)) {
    mkdirSync(path, { mode: 0o700 })
    created = true
  }
  const before = lstatSync(path)
  if (!before.isDirectory() || before.isSymbolicLink() || hasExtendedAcl(path)) fail()
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    let opened = fstatSync(fd)
    if (!opened.isDirectory() || before.dev !== opened.dev || before.ino !== opened.ino) fail()
    if (created && process.getuid?.() === 0) {
      fchownSync(fd, expectedUid, expectedGid)
      opened = fstatSync(fd)
    }
    const mode = opened.mode & 0o777
    const legacyGid = opened.gid !== expectedGid && allowedLegacyGids.includes(opened.gid)
    if (opened.uid !== expectedUid || (!legacyGid && opened.gid !== expectedGid) || ![0o700, 0o755].includes(mode)) fail()
    if (legacyGid) {
      fchownSync(fd, expectedUid, expectedGid)
      opened = fstatSync(fd)
    }
    if (mode === 0o755) fchmodSync(fd, 0o700)
    const final = fstatSync(fd)
    const readback = lstatSync(path)
    if (final.uid !== expectedUid || final.gid !== expectedGid || (final.mode & 0o777) !== 0o700
      || readback.dev !== final.dev || readback.ino !== final.ino || hasExtendedAcl(path)) fail()
    return Object.freeze({ status: legacyGid ? (mode === 0o755 ? 'OWNERSHIP_AND_MODE_MIGRATED' : 'OWNERSHIP_MIGRATED') : mode === 0o755 ? 'NARROWED' : 'READY' })
  } finally { closeSync(fd) }
}
