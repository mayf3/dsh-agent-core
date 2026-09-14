import { join } from 'node:path'
import { verifyReceiptedPreimage } from './deployment-durable-file.js'

const SHA256 = /^[0-9a-f]{64}$/

export function verifyWatchdogReplayReceipt(receipt, { sourceSha, launchdDir, artifactsDir }) {
  if (!receipt || receipt.sourceSha !== sourceSha || !Array.isArray(receipt.plists) || receipt.plists.length !== 2
    || [...receipt.plists].map((item) => item?.role).sort().join(',') !== 'w1,w2') throw new Error('watchdog rerun generation mismatch')
  for (const item of receipt.plists) {
    const label = `ai.agent-core.scheduler-watchdog-${item.role}`
    const path = join(launchdDir, `${label}.plist`)
    const preimage = join(artifactsDir, 'rollback', `${label}.plist.preimage`)
    if (item.label !== label || item.path !== path || item.preimage !== preimage || typeof item.existed !== 'boolean'
      || !SHA256.test(item.installedSha256 ?? '') || (item.existed ? !SHA256.test(item.preimageSha256 ?? '')
        || !item.preimageMetadata || !Array.isArray(item.preimageXattrs)
        : item.preimageSha256 !== null || item.preimageMetadata !== null || item.preimageXattrs?.length !== 0)) {
      throw new Error(`watchdog receipt is incoherent: ${item.role}`)
    }
    verifyReceiptedPreimage({ path: item.preimage, expectedPath: preimage,
      expectedSha256: item.preimageSha256, expectedMetadata: item.preimageMetadata, expectedXattrs: item.preimageXattrs })
  }
  return receipt
}
