#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const [output, commit, ...files] = process.argv.slice(2)
if (!output || !/^[0-9a-f]{40}$/.test(commit) || files.length === 0) {
  throw new Error('usage: create-r38-artifact.mjs OUTPUT_TARBALL FULL_COMMIT_SHA FILE...')
}
const root = join(tmpdir(), `r38-build-${process.pid}`)
mkdirSync(root, { recursive: true })
const packageRoot = join(root, 'artifact')
mkdirSync(packageRoot, { recursive: true })
const entries = {}
for (const file of files) {
  const source = resolve(file); const target = join(packageRoot, file)
  mkdirSync(resolve(target, '..'), { recursive: true }); cpSync(source, target)
  entries[file] = createHash('sha256').update(readFileSync(source)).digest('hex')
}
writeFileSync(join(packageRoot, 'artifact-manifest.json'), JSON.stringify({ root: 'artifact', commit, files: entries }, null, 2) + '\n')
execFileSync('tar', ['-czf', output, '-C', root, 'artifact'])
const tarballSha256 = createHash('sha256').update(readFileSync(output)).digest('hex')
writeFileSync(`${output}.manifest.json`, JSON.stringify({ artifact: basename(output), commit, tarballSha256, files: entries }, null, 2) + '\n')
rmSync(root, { recursive: true, force: true })
console.log(JSON.stringify({ output, manifest: `${output}.manifest.json`, commit, tarballSha256 }))
