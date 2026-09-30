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
  // deployment-artifacts/ is a frozen evidence archive (preimages/, targets/,
  // ... snapshots of pre-fix files). It ships inside the package untouched but
  // is not live code: its internal relative imports reference the snapshot's
  // original layout and are not closure edges of this tree.
  const archiveTop = join(sourceRoot, 'deployment-artifacts') + sep
  for (const f of files.filter((f) => /\.mjs$|\.js$/.test(f))) {
    if (f.startsWith(archiveTop)) continue
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
  if (recipe.harnessRoot) {
    let harness
    try { harness = realpathSync(recipe.harnessRoot) } catch { throw new ReleaseRefused('HARNESS_ABSENT', String(recipe.harnessRoot)) }
    if (!statSync(harness).isDirectory()) throw new ReleaseRefused('HARNESS_ABSENT', String(recipe.harnessRoot))
  }
  return nodeVersion
}

function gitSha(sourceRoot) {
  try {
    return execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
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
  const nodeVersion = checkToolchain(recipe)

  const fileEntries = files.map((f) => {
    const buf = readFileSync(f)
    return { path: relative(src, f).split(sep).join('/'), sha256: sha256(buf), bytes: buf.length, mode: (statSync(f).mode & 0o777).toString(8) }
  }).sort((a, b) => a.path.localeCompare(b.path))

  const manifest = {
    manifestVersion: 1,
    recipe: { name: recipe.name, exclude: [...exemptExcludes].sort(), coveredGoals: recipe.coveredGoals ?? [], compat: recipe.compat ?? {} },
    toolchain: { node: recipe.nodeRuntime, nodeVersion, harness: recipe.harnessRoot ?? null },
    sourceSha: gitSha(src),
    source: { files: fileEntries, fileCount: fileEntries.length, totalBytes: fileEntries.reduce((n, f) => n + f.bytes, 0) },
    dependencies: dependencySummary(files, src),
    configStructure: configStructure(files, src),
    builtAt: new Date().toISOString(),
  }
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
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return { manifest, artifactDigest }
}
