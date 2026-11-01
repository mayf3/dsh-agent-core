import { resolveCanonicalTarget, readStableHeader } from '../../../../session-history/src/locator.js'
import { parseHeaderRecord } from '../../../../session-history/src/snapshot.js'
import { currentMainGenerationDigest, sha256Hex } from '../../../../session-history/src/ids.js'
export function readBoundMainMetadata(workspaceBootstrap, agentId) {
  try {
    const workspaceDir = workspaceBootstrap.resolveWorkspace(agentId)
    const target = resolveCanonicalTarget({ agentHome: workspaceBootstrap.resolveDshHome(agentId), workspaceDir })
    const bytes = readStableHeader(target.artifactPath, target.sessionRoot)
    const header = parseHeaderRecord(bytes)
    if (header.cwd !== workspaceDir) return { state: 'unavailable', generation: null }
    return { state: 'exists', generation: currentMainGenerationDigest(header, sha256Hex(bytes)) }
  } catch (error) {
    return { state: error.code === 'SESSION_NOT_FOUND' ? 'absent' : 'unavailable', generation: null }
  }
}
