#!/usr/bin/env node
// CLI driver for buildRelease: the build recipe is a FILE (reviewable,
// re-runnable) instead of an inline one-liner, so a candidate build command is
// exactly reproducible:
//
//   node scripts/lib/deployment-reuse/release-candidate-cli.mjs --recipe <recipe.json>
//
// recipe.json: { sourceRoot, outputRoot, recipe: { name, nodeRuntime,
//   harnessRoot?, exclude?, coveredGoals?, compat?, includeTestTree?,
//   includeArchives?, dependencies?: { packageManager, registry, lockfilePath } } }
//
// Exit codes: 0 built (prints the manifest summary as JSON); 2 refused
// (ReleaseRefused code + detail on stderr, outputRoot untouched).
import { readFileSync } from 'node:fs'
import { buildRelease, ReleaseRefused } from './release-package.mjs'

function argValue(name) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

const recipeFile = argValue('--recipe')
if (!recipeFile) {
  process.stderr.write('usage: release-candidate-cli.mjs --recipe <recipe.json>\n')
  process.exit(2)
}

let input
try {
  input = JSON.parse(readFileSync(recipeFile, 'utf8'))
} catch (error) {
  process.stderr.write(`release-candidate-cli: cannot parse recipe file ${recipeFile}: ${error?.message ?? error}\n`)
  process.exit(2)
}

try {
  const { manifest, artifactDigest } = buildRelease({
    sourceRoot: input.sourceRoot,
    outputRoot: input.outputRoot,
    recipe: input.recipe,
  })
  process.stdout.write(`${JSON.stringify({
    artifactDigest,
    dependencyDigest: manifest.dependencyDigest,
    fileCount: manifest.source.fileCount,
    totalBytes: manifest.source.totalBytes,
    resolvedDependencies: manifest.dependencies.resolvedCount,
    sourceSha: manifest.sourceSha,
    nodeVersion: manifest.toolchain.nodeVersion,
    manifestPath: `${input.outputRoot}/manifest.json`,
  }, null, 2)}\n`)
} catch (error) {
  if (error instanceof ReleaseRefused) {
    process.stderr.write(`release-candidate-cli: REFUSED ${error.code}: ${error.message}\n`)
    process.exit(2)
  }
  throw error
}
