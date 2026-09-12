/**
 * ensureSymlink — create or repair one symlink; fails loud on a real file at
 * the target.
 *
 * REALPATH EQUIVALENCE (fleet EACCES class, 2026-09-12): a link that resolves
 * to the same file as the target through a DIFFERENT spelling (e.g. a nested
 * pnpm layout vs the flat candidate the provisioner would pick) is
 * semantically correct and must be accepted as-is. Rewriting such links
 * (a) churns them on every spawn and (b) fails EACCES in agent homes the
 * runtime cannot write — which starved production deliveries for days. Only a
 * link whose realpath genuinely differs (or a dangling/plain-file impostor) is
 * replaced.
 */
import { lstatSync, mkdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    const linked = stat.isSymbolicLink() ? readlinkSync(link) : undefined
    if (linked === undefined) {
      throw new Error(`ensureSymlink: refusing to replace a non-symlink at ${link}`)
    }
    if (resolve(dirname(link), linked) === resolve(target)) return
    try { if (realpathSync(link) === realpathSync(target)) return } catch (error) {
      if (error?.code !== 'ENOENT') throw error // dangling link/target = repair
    }
    rmSync(link, { recursive: true, force: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
}
