/** One reviewed offline restored-app input to one fixed admin source candidate.
 * This is source composition only. It neither authenticates an installed host
 * nor qualifies floor, validator, rollback, root custody or execution. */
import { createHash } from 'node:crypto'
import contract from './hr-admin-overlay-patches.json' with { type: 'json' }

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const fail = () => { throw new Error('HR_ADMIN_SOURCE_BASE_UNKNOWN') }

export const FIXED_ADMIN_SOURCE_PATHS = Object.freeze(Object.keys(contract.paths))
export const FIXED_ADMIN_SOURCE_CANDIDATE = contract.candidateCommit

/** Closed map. Shared files are patched over their exact restored preimage;
 * replacing them with the repository file would revert unrelated Agent bytes. */
export function composeFixedAdminSource(base, candidate) {
  const paths = FIXED_ADMIN_SOURCE_PATHS
  if (base === null || candidate === null || typeof base !== 'object'
      || typeof candidate !== 'object' || Array.isArray(base) || Array.isArray(candidate)
      || Object.keys(base).sort().join('\0') !== paths.filter(path => contract.paths[path].baseSha256 !== null).sort().join('\0')
      || Object.keys(candidate).sort().join('\0') !== [...paths].sort().join('\0')) fail()
  const output = {}
  for (const path of paths) {
    const pin = contract.paths[path]
    const prior = base[path]
    const accepted = candidate[path]
    if (pin.baseSha256 !== null && (!Buffer.isBuffer(prior) || sha(prior) !== pin.baseSha256)) fail()
    if (!Buffer.isBuffer(accepted) || sha(accepted) !== pin.candidateSha256) fail()
    let bytes = accepted
    if (pin.patches !== undefined) {
      let text = prior.toString('utf8')
      if (!Buffer.from(text).equals(prior)) fail()
      for (const patch of pin.patches) {
        if (text.split(patch.before).length !== 2) fail()
        text = text.replace(patch.before, patch.after)
      }
      bytes = Buffer.from(text)
    }
    if (sha(bytes) !== pin.stageSha256) fail()
    output[path] = bytes
  }
  return output
}
