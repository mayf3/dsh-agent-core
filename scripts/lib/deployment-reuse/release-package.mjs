// buildRelease — complete-tree release packager for the deployment-reuse surface
// (T1 of the availability rollout plan, PR #373).
//
// Contract: validate the WHOLE tree first (completeness, local-module closure,
// secret absence, declared toolchain presence), then copy once and emit a
// content-bound manifest. Every refusal happens BEFORE outputRoot is created,
// so a failed candidate build leaves the target (and any live tree) untouched.
// The builder reads only `sourceRoot`; it never reads a live/installed tree.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const CODE_RE = /\.(mjs|cjs|js)$/
// Non-source filenames that look like secrets are refused outright. Source-code
// files are exempt from the name heuristic: credential-store.js style modules
// are legitimate code and must not be silently excluded from a release.
const SECRET_NAME_RE = /(^|\.)(env|pem|key|p12|pfx)$|(^id_(rsa|ecdsa|ed25519))|((credentials|creds|secret|token)[^/]*\.(json|ya?ml|txt|env)$)/i
// Excluded: VCS metadata, dependency installs (re-installed per manifest
// dependency summary, never copied), and build outputs. git-tracked source
// content (incl. deployment-artifacts/, examples/, test trees) stays IN the
// package: code and tests import from it, and the module-closure check relies
// on it — the installed layout mirrors the checked-out tree minus these.
const DEFAULT_EXCLUDE = new Set(['node_modules', '.git', '.github', '.DS_Store', '.worktrees', '.zcode', 'out', 'dist', 'coverage'])
const PACKAGE_JSON_EXEMPT = new Set(['docs', 'scripts', 'bundle-broker', 'profile-production', 'profile-demo', 'profile-integration', 'evidence'])

export class ReleaseRefused extends Error {
  constructor(code, detail) {
    super(`release-package: ${code}${detail ? `: ${detail}` : ''}`)
    this.code = code
  }
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function listFiles(dir, exemptExcludes) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue
    if (DEFAULT_EXCLUDE.has(entry.name) || exemptExcludes.has(entry.name)) continue
    const p = join(dir, entry.name)
    if (entry.isSymbolicLink()) throw new ReleaseRefused('SYMLINK_IN_SOURCE', relative(dir, p))
    if (entry.isDirectory()) out.push(...listFiles(p, exemptExcludes))
    else if (entry.isFile()) out.push(p)
  }
  return out
}

function resolveLocal(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec)
  for (const cand of [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, join(base, 'index.js'), join(base, 'index.mjs')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

function extractRelativeSpecifiers(code) {
  // Blank out comments first: spec text like `export { X } from './y.js'`
  // inside a comment must not read as a real import.
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') })
  const specs = new Set()
  // Lines inside a multi-line template literal are generated-code text whose
  // relative specifiers resolve against the fixture's future location, not this
  // file — track backtick parity and skip them.
  let insideTemplate = false
  for (const line of stripped) {
    const backticks = (line.match(/`/g) ?? []).length
    const lineStartsInside = insideTemplate
    if (backticks % 2 === 1) insideTemplate = !insideTemplate
    if (lineStartsInside) continue
    // Static imports/exports only at statement position: strings that EMBED an
    // import statement (delayed-import anchors like const importAnchor = "import
    // { x } from '../..'" resolve against a different base) are not static edges.
    if (/^(?:import|export)\b/.test(line.trim())) {
      const re = /from\s*['"]([^'"\n]+)['"]|import\s*['"]([^'"\n]+)['"]/g
      let m
      while ((m = re.exec(line))) {
        const spec = m[1] ?? m[2]
        if (spec && (spec.startsWith('./') || spec.startsWith('../'))) specs.add(spec)
      }
    }
    // Real dynamic import calls anywhere (import(...) with a literal relative spec).
    const dyn = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
    let d
    while ((d = dyn.exec(line))) {
      const spec = d[1]
      if (spec && (spec.startsWith('./') || spec.startsWith('../'))) specs.add(spec)
    }
  }
  return [...specs]
}

function checkSecrets(files, sourceRoot) {
  for (const f of files) {
    if (CODE_RE.test(f)) continue
    if (SECRET_NAME_RE.test(basename(f))) throw new ReleaseRefused('SECRET_FILE_PRESENT', relative(sourceRoot, f))
  }
}

function checkPackageJsonCompleteness(files, sourceRoot, exemptExcludes) {
  const codeFiles = files.filter((f) => CODE_RE.test(f))
  // packages/<X> first-level directories are install units: each one holding
  // code must declare itself, or no dependency install can ever cover it
  // (the development-execution gap this check exists for).
  const pkgsRoot = join(sourceRoot, 'packages')
  const pkgNames = new Set()
  for (const f of codeFiles) {
    const rel = relative(pkgsRoot, dirname(f))
    if (!rel.startsWith('..') && rel !== '') pkgNames.add(rel.split(sep)[0])
  }
  for (const name of [...pkgNames].sort()) {
    if (!existsSync(join(pkgsRoot, name, 'package.json'))) {
      throw new ReleaseRefused('PACKAGE_JSON_MISSING', `packages/${name}`)
    }
  }
  // Code outside packages/ must at least be covered by a package.json up its
  // ancestor chain (root package.json is a valid boundary).
  for (const f of codeFiles) {
    if (relative(pkgsRoot, f).startsWith('..')) {
      let dir = dirname(f)
      for (;;) {
        if (existsSync(join(dir, 'package.json'))) break
        if (dir === sourceRoot) throw new ReleaseRefused('PACKAGE_JSON_MISSING', relative(sourceRoot, dirname(f)))
        const parent = dirname(dir)
        if (parent === dir) throw new ReleaseRefused('PACKAGE_JSON_MISSING', relative(sourceRoot, dirname(f)))
        dir = parent
      }
    }
  }
}

function checkModuleClosure(files, sourceRoot) {
  const known = new Set(files)
  // Frozen evidence archives ship inside the package untouched but are not
  // live code: their internal relative imports reference the snapshot's
  // original layout and are not closure edges of this tree.
  //   deployment-artifacts/ — preimage/target snapshots of pre-fix files
  //   docs/evidence/        — timestamped evidence dirs (postimages, archived
  //                           scripts, manifests); a postimage copy of a
  //                           source file legitimately imports siblings of
  //                           its ORIGINAL location, not of the archive.
  const archiveTops = [join(sourceRoot, 'deployment-artifacts') + sep, join(sourceRoot, 'docs', 'evidence') + sep]
  for (const f of files.filter((f) => /\.mjs$|\.js$/.test(f))) {
    if (archiveTops.some((top) => f.startsWith(top))) continue
    const code = readFileSync(f, 'utf8')
    for (const spec of extractRelativeSpecifiers(code)) {
      const target = resolveLocal(f, spec)
      if (!target || !known.has(target)) {
        throw new ReleaseRefused('MODULE_MISSING', `${relative(sourceRoot, f)} imports '${spec}'`)
      }
    }
  }
}

function checkToolchain(recipe) {
  if (!recipe?.nodeRuntime || !existsSync(recipe.nodeRuntime)) {
    throw new ReleaseRefused('NODE_RUNTIME_ABSENT', String(recipe?.nodeRuntime))
  }
  const nodeVersion = execFileSync(recipe.nodeRuntime, ['--version'], { encoding: 'utf8' }).trim()
  const nodeSha256 = sha256(readFileSync(recipe.nodeRuntime))
  let harness = null
  if (recipe.harnessRoot) {
    let harnessReal
    try { harnessReal = realpathSync(recipe.harnessRoot) } catch { throw new ReleaseRefused('HARNESS_ABSENT', String(recipe.harnessRoot)) }
    if (!statSync(harnessReal).isDirectory()) throw new ReleaseRefused('HARNESS_ABSENT', String(recipe.harnessRoot))
    // The harness tree can be huge; the bounded honest anchor is the entry
    // package (apps/cli — the directory resolveHarnessRoot keys on). Its
    // digest plus the declared versions pin what the built artifact is
    // resolved against; scope is recorded so it is never read as whole-tree.
    const entryPkgDir = join(harnessReal, 'apps', 'cli')
    if (!existsSync(join(entryPkgDir, 'package.json'))) {
      throw new ReleaseRefused('HARNESS_ENTRY_ABSENT', join(harnessReal, 'apps', 'cli'))
    }
    let version = null
    let rootVersion = null
    try { version = JSON.parse(readFileSync(join(entryPkgDir, 'package.json'), 'utf8')).version ?? null } catch { /* recorded as null */ }
    try { rootVersion = JSON.parse(readFileSync(join(harnessReal, 'package.json'), 'utf8')).version ?? null } catch { /* recorded as null */ }
    harness = { root: recipe.harnessRoot, entryPackage: 'apps/cli', version, rootVersion, entryPackageDigest: directoryDigest(entryPkgDir), digestScope: 'apps/cli entry package only, not the whole harness tree' }
  }
  return { nodeVersion, nodeSha256, harness }
}

function directoryDigest(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') && entry.name !== '.well-known') continue
      if (DEFAULT_EXCLUDE.has(entry.name)) continue // dependency installs inside the anchored package are re-installed per the app lockfile, not part of the anchor
      const p = join(dir, entry.name)
      if (entry.isSymbolicLink()) throw new ReleaseRefused('SYMLINK_IN_SOURCE', relative(root, p))
      if (entry.isDirectory()) walk(p)
      else if (entry.isFile()) out.push(`${relative(root, p).split(sep).join('/')}\0${sha256(readFileSync(p))}\n`)
    }
  }
  walk(root)
  return sha256(out.join(''))
}

function gitSha(sourceRoot) {
  try {
    return execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function dependencySummary(files, sourceRoot) {
  const deps = {}
  for (const f of files.filter((f) => basename(f) === 'package.json')) {
    try {
      const pkg = JSON.parse(readFileSync(f, 'utf8'))
      for (const [name, range] of Object.entries(pkg.dependencies ?? {})) deps[name] = range
    } catch { /* non-JSON package.json would have failed completeness via parse elsewhere; keep summary best-effort */ }
  }
  return deps
}

// package-lock v3 top-level install entries: `node_modules/<pkg>` and
// `node_modules/<scope>/<pkg>` (nested `node_modules/x/node_modules/y` keys
// describe transitive placements and are covered by their own top-level name).
const TOP_LEVEL_LOCK_KEY = /^node_modules\/(?:(@[^/]+)\/)?([^/]+)$/

/**
 * Extract the pinned external closure from a package-lock document. Registry
 * deps pin by integrity; git-hosted deps pin by the commit sha embedded in
 * the resolved URL (no integrity is invented). `link: true` entries are
 * internal workspace members, not external pins.
 */
function extractDependencyClosure(lockDoc) {
  if (lockDoc === null || typeof lockDoc !== 'object' || Array.isArray(lockDoc)) {
    throw new ReleaseRefused('DEPENDENCY_LOCK_UNPARSABLE', 'lockfile root must be an object')
  }
  const resolved = {}
  const workspaceLinks = {}
  for (const [key, entry] of Object.entries(lockDoc.packages ?? {})) {
    if (key === '' || entry === null || typeof entry !== 'object') continue
    const m = TOP_LEVEL_LOCK_KEY.exec(key)
    if (m === null) continue
    const name = (m[1] !== undefined ? `${m[1]}/` : '') + m[2]
    if (resolved[name] !== undefined || workspaceLinks[name] !== undefined) continue
    if (entry.link === true) { workspaceLinks[name] = { resolved: entry.resolved ?? null }; continue }
    const version = entry.version
    const target = entry.resolved ?? null
    if (typeof version !== 'string' || version === '' || target === null) {
      throw new ReleaseRefused('DEPENDENCY_LOCK_MALFORMED', key)
    }
    const record = { version, resolved: target }
    if (typeof entry.integrity === 'string' && entry.integrity !== '') record.integrity = entry.integrity
    else if (typeof target === 'string' && target.includes('#')) record.gitCommitSha = target.slice(target.indexOf('#') + 1)
    else throw new ReleaseRefused('DEPENDENCY_LOCK_UNPINNED', name)
    resolved[name] = record
  }
  return { resolved, workspaceLinks }
}

/**
 * The declared external dependency union across the packaged tree must be
 * covered by an out-of-band package-lock.json (generated from the authorized
 * registry in a clean assembly workspace). Without it the 901-file source
 * package has no rebuildable dependency closure — exactly the T1 gap.
 */
function checkDependencyClosure(files, sourceRoot, recipe) {
  const declared = dependencySummary(files, sourceRoot)
  const declaredNames = Object.keys(declared).sort()
  if (declaredNames.length === 0) {
    if (recipe?.dependencies !== undefined) {
      throw new ReleaseRefused('DEPENDENCY_LOCK_UNEXPECTED', 'recipe.dependencies provided but the tree declares no external dependencies')
    }
    return { declared, packageManager: null, registry: null, resolved: {}, workspaceLinks: {}, lockfile: null, lockBytes: null }
  }
  const dep = recipe?.dependencies
  if (dep === null || typeof dep !== 'object' || typeof dep.lockfilePath !== 'string' || dep.lockfilePath === '') {
    throw new ReleaseRefused('DEPENDENCY_LOCK_MISSING', `tree declares external dependencies (${declaredNames.join(', ')}); recipe.dependencies.lockfilePath (package-lock.json from the authorized registry) is required`)
  }
  let lockDoc
  let lockBytes
  try {
    lockBytes = readFileSync(dep.lockfilePath)
    lockDoc = JSON.parse(lockBytes.toString('utf8'))
  } catch (error) {
    throw new ReleaseRefused('DEPENDENCY_LOCK_UNPARSABLE', `${dep.lockfilePath}: ${error?.message ?? error}`)
  }
  const { resolved, workspaceLinks } = extractDependencyClosure(lockDoc)
  const missing = declaredNames.filter((name) => resolved[name] === undefined && workspaceLinks[name] === undefined)
  if (missing.length > 0) throw new ReleaseRefused('DEPENDENCY_LOCK_INCOMPLETE', `lockfile does not cover: ${missing.join(', ')}`)
  return {
    declared,
    packageManager: dep.packageManager ?? 'npm',
    registry: dep.registry ?? null,
    resolved: Object.fromEntries(Object.keys(resolved).sort().map((k) => [k, resolved[k]])),
    workspaceLinks: Object.fromEntries(Object.keys(workspaceLinks).sort().map((k) => [k, workspaceLinks[k]])),
    lockfile: { lockfileVersion: lockDoc.lockfileVersion ?? null, sha256: sha256(lockBytes), bytes: lockBytes.length },
    lockBytes,
  }
}

/** includeTestTree/includeArchives are recipe-declared; contradiction with the
 *  packaged content refuses instead of silently meaning the opposite. */
function checkRecipeContentConsistency(files, sourceRoot, recipe) {
  const rel = (f) => relative(sourceRoot, f).split(sep).join('/')
  const hasTests = files.some((f) => /(^|\/)(test|tests)(\/|$)/.test(rel(f)) || /\.test\.[cm]?js$/.test(rel(f)))
  const hasArchives = files.some((f) => rel(f).startsWith('deployment-artifacts/'))
  if (recipe.includeTestTree === false && hasTests) throw new ReleaseRefused('INCONSISTENT_RECIPE', 'includeTestTree=false but the tree contains test files')
  if (recipe.includeArchives === false && hasArchives) throw new ReleaseRefused('INCONSISTENT_RECIPE', 'includeArchives=false but the tree contains deployment-artifacts/')
  return { includeTestTree: recipe.includeTestTree ?? true, includeArchives: recipe.includeArchives ?? true }
}

function configStructure(files, sourceRoot) {
  return files
    .filter((f) => /\.(ya?ml|json)$/.test(f) && /profile-|bundle-/.test(relative(sourceRoot, f)))
    .map((f) => relative(sourceRoot, f))
    .sort()
}

export function buildRelease({ sourceRoot, recipe, outputRoot }) {
  const src = resolve(sourceRoot)
  if (!existsSync(src) || !statSync(src).isDirectory()) throw new ReleaseRefused('SOURCE_ROOT_ABSENT', String(sourceRoot))
  if (!outputRoot) throw new ReleaseRefused('OUTPUT_ROOT_REQUIRED')
  const out = resolve(outputRoot)
  if (out === src || out.startsWith(src + sep)) throw new ReleaseRefused('OUTPUT_INSIDE_SOURCE')
  if (existsSync(out)) throw new ReleaseRefused('OUTPUT_ROOT_EXISTS', out)

  const exemptExcludes = new Set(recipe.exclude ?? [])
  const files = listFiles(src, exemptExcludes)
  if (files.length === 0) throw new ReleaseRefused('EMPTY_SOURCE')

  checkSecrets(files, src)
  checkPackageJsonCompleteness(files, src, exemptExcludes)
  checkModuleClosure(files, src)
  const recipeInclusion = checkRecipeContentConsistency(files, src, recipe)
  const deps = checkDependencyClosure(files, src, recipe)
  const toolchain = checkToolchain(recipe)

  const fileEntries = files.map((f) => {
    const buf = readFileSync(f)
    return { path: relative(src, f).split(sep).join('/'), sha256: sha256(buf), bytes: buf.length, mode: (statSync(f).mode & 0o777).toString(8) }
  }).sort((a, b) => a.path.localeCompare(b.path))

  const manifest = {
    manifestVersion: 1,
    recipe: { name: recipe.name, exclude: [...exemptExcludes].sort(), coveredGoals: recipe.coveredGoals ?? [], compat: recipe.compat ?? {}, ...recipeInclusion },
    toolchain: { node: recipe.nodeRuntime, nodeVersion: toolchain.nodeVersion, nodeSha256: toolchain.nodeSha256, harness: toolchain.harness },
    sourceSha: gitSha(src),
    source: { files: fileEntries, fileCount: fileEntries.length, totalBytes: fileEntries.reduce((n, f) => n + f.bytes, 0) },
    dependencies: {
      declared: deps.declared,
      packageManager: deps.packageManager,
      registry: deps.registry,
      lockfile: deps.lockfile,
      resolved: deps.resolved,
      workspaceLinks: deps.workspaceLinks,
      resolvedCount: Object.keys(deps.resolved).length,
    },
    assembly: {
      layout: 'npm-workspaces-union',
      steps: [
        'copy the app/ tree as-is',
        'npm ci --ignore-scripts inside app/ with app/package-lock.json (registry tarballs verified by sha512 integrity; git deps pinned by commit sha)',
      ],
      verification: [
        'npm ci refuses lockfile/package.json drift',
        "import('packages/production-runtime/src/entry.js') must resolve the full chain from the assembled app",
      ],
    },
    configStructure: configStructure(files, src),
    builtAt: new Date().toISOString(),
  }
  const dependencyDigest = deps.lockfile === null ? null : sha256(
    Object.entries(deps.resolved).map(([name, r]) => `${name}@${r.version}\0${r.integrity ?? `git:${r.gitCommitSha}`}\n`).sort().join(''),
  )
  manifest.dependencyDigest = dependencyDigest
  const artifactDigest = sha256(fileEntries.map((f) => `${f.path}\0${f.sha256}\n`).join(''))
  manifest.artifactDigest = artifactDigest

  // Validation complete — only now materialize the artifact.
  const appDir = join(out, 'app')
  mkdirSync(appDir, { recursive: true })
  for (const f of files) {
    const dest = join(appDir, relative(src, f))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, readFileSync(f), { mode: statSync(f).mode & 0o777 })
  }
  const generated = []
  if (deps.lockBytes !== null) {
    writeFileSync(join(appDir, 'package-lock.json'), deps.lockBytes)
    generated.push({ path: 'package-lock.json', sha256: deps.lockfile.sha256, bytes: deps.lockfile.bytes })
  }
  manifest.generated = generated
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return { manifest, artifactDigest }
}
