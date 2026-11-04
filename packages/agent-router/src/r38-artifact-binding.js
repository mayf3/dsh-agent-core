import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

function sha256File(file) { return createHash('sha256').update(readFileSync(file)).digest('hex') }

export function verifyArtifactBinding({ tarball, manifestFile, workspaceRoot }) {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!/^[0-9a-f]{40}$/.test(manifest.commit)) throw new Error('artifact manifest commit is not a full commit SHA')
  if (!/^[0-9a-f]{64}$/.test(manifest.tarballSha256)) throw new Error('artifact manifest tarball digest is invalid')
  const actualTarballSha256 = sha256File(tarball)
  if (actualTarballSha256 !== manifest.tarballSha256) throw new Error(`tarball digest mismatch: expected ${manifest.tarballSha256}, got ${actualTarballSha256}`)
  const dir = mkdtempSync(join(tmpdir(), 'r38-artifact-'))
  try {
    execFileSync('tar', ['-xzf', tarball, '-C', dir])
    const embeddedPath = execFileSync('find', [dir, '-name', 'artifact-manifest.json', '-type', 'f', '-print', '-quit'], { encoding: 'utf8' }).trim()
    if (!embeddedPath) throw new Error('artifact-manifest.json missing from tarball')
    const embedded = JSON.parse(readFileSync(embeddedPath, 'utf8'))
    if (embedded.commit !== manifest.commit) throw new Error('embedded manifest commit mismatch')
    for (const [file, expectedSha] of Object.entries(manifest.files ?? {})) {
      const workspaceFile = resolve(workspaceRoot, file)
      const extractedFile = resolve(dir, embedded.root ?? '', file)
      if (relative(dir, extractedFile).startsWith('..')) throw new Error(`unsafe artifact path: ${file}`)
      if (sha256File(workspaceFile) !== expectedSha) throw new Error(`workspace digest mismatch: ${file}`)
      if (sha256File(extractedFile) !== expectedSha) throw new Error(`artifact content mismatch: ${file}`)
    }
    return { commit: manifest.commit, tarballSha256: actualTarballSha256, files: Object.keys(manifest.files ?? {}) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
