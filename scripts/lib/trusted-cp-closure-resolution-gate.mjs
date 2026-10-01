#!/usr/bin/env node
// trusted-cp-closure-resolution-gate.mjs — CLOSURE_RESOLUTION_GATE_V1
//
// Fail-closed packaging gate for the trusted control-plane harness closure.
// MUST be invoked under the trusted node itself:
//
//   "$TRUSTED_NODE" scripts/lib/trusted-cp-closure-resolution-gate.mjs \
//     --trusted-root "$TRUSTED_ROOT"
//
// What broke (2026-10-02 availability rollback, Product #414): the harness
// closure was rebuilt by pnpm running under the INVOKING SHELL's node (arm64
// dev host) while the deployed node-runtime is x64. pnpm selects
// platform-optional native packages from the arch of ITS OWN process, so the
// fresh closure shipped `node-addon-require-builtin-darwin-arm64` only. Under
// the x64 runtime the loader's internal-module acquisition
// (vendor/loader/src/internal.ts ModuleLoader.fromInternal →
// node-addon-require-builtin → prebuilt darwin-x64 binary) throws, is caught,
// and `ctx.loader.internal` stays undefined. Tree.import then falls back to a
// RAW `import(name)` whose resolution origin is vendor/loader/lib/index.js —
// a chain that contains no plugin package — so EVERY loader entry
// (@deepseek-ai/cordis-plugin-timer, …, dsh-codex/tui) fails
// ERR_MODULE_NOT_FOUND and every fresh agent-core-production child dies at
// plugin-tree boot ("plugin tree failed to load"). Already-running children
// kept their in-memory modules and continued working, which is why the
// failure surfaced only as a fresh-child boot outage.
//
// This gate re-proves, under the exact trusted node, the two invariants the
// runtime depends on:
//   1. BINDING: the native internal-module binding acquires and reports the
//      SAME platform suffix as the running runtime.
//   2. CENSUS: every @deepseek-ai/* package linked into the closure's
//      resolution surfaces (vendor/loader peers + apps/cli — the baseUrl-side
//      closure that resolves loader entries) exists, is a live link, and its
//      package.json name matches. A dead or missing link fails the gate, so
//      one repaired package cannot mask the next (no whack-a-mole).
//
// It deliberately does NOT use Node's internal module loader API (version
// fragile); the end-to-end proof is the fresh-child boot canary
// (trusted-cp-fresh-child-boot-canary.mjs), which the deploy executor runs
// against the assembled candidate before any cutover.
//
// Exit codes: 0 = PASS, 2 = FAIL (diagnosis on stderr). --json emits a
// machine-readable receipt on stdout in both cases.

import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function parseArgs(argv) {
  const args = { trustedRoot: undefined, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--trusted-root') args.trustedRoot = argv[++i]
    else if (a === '--json') args.json = true
    else {
      console.error(`unknown argument: ${a}`)
      process.exit(2)
    }
  }
  if (!args.trustedRoot) {
    console.error('usage: node trusted-cp-closure-resolution-gate.mjs --trusted-root <TRUSTED_ROOT> [--json]')
    process.exit(2)
  }
  args.trustedRoot = resolve(args.trustedRoot)
  return args
}

/** Platform suffix in the node-addon-native-custom-loader convention. */
export function platformPackageSuffix(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin') return `darwin-${arch}`
  if (platform === 'win32') return `win32-${arch}-msvc`
  return `${platform}-${arch}`
}

/**
 * Whether a binding-reported suffix serves the given runtime platform/arch.
 * darwin/win32 suffixes are exact; linux suffixes carry a libc component
 * (linux-<arch>-gnu|musl) the gate cannot observe portably, so any
 * linux-<arch>-* binding is accepted as arch-correct.
 */
export function suffixServesRuntime(bindingSuffix, platform = process.platform, arch = process.arch) {
  if (typeof bindingSuffix !== 'string' || bindingSuffix.length === 0) return false
  if (platform === 'linux') return bindingSuffix === `linux-${arch}` || bindingSuffix.startsWith(`linux-${arch}-`)
  return bindingSuffix === platformPackageSuffix(platform, arch)
}

/**
 * Bare-specifier resolution walk (Node's node_modules algorithm, scoped to
 * what this gate needs): from `fromDir` upward, first existing
 * <dir>/node_modules/<specifier> wins. Returns { path, realpath } or null.
 */
export function resolvePackageFromDir(fromDir, specifier) {
  let base = resolve(fromDir)
  for (;;) {
    const candidate = join(base, 'node_modules', specifier)
    if (existsSync(candidate)) {
      const realpath = realpathSync(candidate)
      return { path: candidate, realpath }
    }
    const parent = resolve(base, '..')
    if (parent === base) return null
    base = parent
  }
}

function readPackageName(pkgDir) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
    throw new Error(`package.json at ${pkgDir} has no name`)
  }
  return pkg.name
}

/**
 * Census one closure surface: every entry under
 * <surfaceDir>/node_modules/@scope/ must be present, alive (realpath
 * resolves), and its package.json name must equal `<scope>/<entry>`.
 * Returns { surface, entries: [{name, ok, detail}] , ok }.
 */
export function censusSurface(root, surfaceDir, scope = '@deepseek-ai') {
  const scopeDir = join(root, surfaceDir, 'node_modules', scope)
  const out = { surface: surfaceDir, scopeDir, entries: [], ok: true }
  if (!existsSync(scopeDir)) {
    out.entries.push({ name: `${scope}/*`, ok: false, detail: `scope dir missing: ${scopeDir}` })
    out.ok = false
    return out
  }
  for (const entry of statSync(scopeDir).isDirectory() ? readdirSync(scopeDir).sort() : []) {
    const spec = `${scope}/${entry}`
    try {
      const found = resolvePackageFromDir(join(root, surfaceDir), spec)
      if (!found) throw new Error('not resolvable from this surface (dead or missing link)')
      const name = readPackageName(found.realpath)
      if (name !== spec) throw new Error(`package.json name mismatch: ${name} != ${spec}`)
      out.entries.push({ name: spec, ok: true, detail: found.realpath })
    } catch (error) {
      out.entries.push({ name: spec, ok: false, detail: String(error.message ?? error) })
      out.ok = false
    }
  }
  return out
}

function fail(checks, code, message) {
  checks.push({ check: code, ok: false, detail: message })
  return false
}

export function runGate({ trustedRoot, platform = process.platform, arch = process.arch } = {}) {
  const checks = []
  const root = resolve(trustedRoot)
  const suffix = platformPackageSuffix(platform, arch)

  // -- check 0: closure shape ------------------------------------------------
  const loaderLib = join(root, 'harness/vendor/loader/lib/index.js')
  if (!existsSync(loaderLib)) {
    fail(checks, 'CLOSURE_SHAPE', `missing ${loaderLib} — not a harness closure tree`)
    return { ok: false, checks, suffix }
  }
  checks.push({ check: 'CLOSURE_SHAPE', ok: true, detail: loaderLib })

  // -- check 1: native internal-module binding -------------------------------
  // Resolution origin must be the loader package itself (its optional peer is
  // linked at vendor/loader/node_modules/node-addon-require-builtin).
  try {
    const requireFromLoader = createRequire(pathToFileURL(loaderLib).href)
    const addon = requireFromLoader('node-addon-require-builtin')
    const info = addon.getBindingInfo()
    const problems = []
    if (!info || typeof info !== 'object') problems.push('getBindingInfo() did not return an object')
    if (info && !suffixServesRuntime(info.platformPackageSuffix, platform, arch)) {
      problems.push(
        `binding platformPackageSuffix ${info.platformPackageSuffix} does not serve runtime ${suffix} ` +
        `(binding source: ${info.bindingSource}, package: ${info.optionalPackageName})`,
      )
    }
    if (info && !info.bindingSource) problems.push('binding has no bindingSource (acquisition path unknown)')
    if (problems.length > 0) {
      fail(
        checks,
        'NATIVE_BINDING',
        problems.join('; ') +
        ' — the loader would fall back to raw import() from vendor/loader/lib/index.js and EVERY ' +
        'plugin entry fails ERR_MODULE_NOT_FOUND at fresh-child boot (2026-10-02 rollback class). ' +
        `Expected optional package node-addon-require-builtin-${suffix} to be present in the closure; ` +
        'rebuild the closure with the runtime-arch node (installer §2a/§2 pins pnpm to it).',
      )
    } else {
      checks.push({
        check: 'NATIVE_BINDING',
        ok: true,
        detail: `suffix=${info.platformPackageSuffix} source=${info.bindingSource} package=${info.optionalPackageName} backend=${info.backend} abi=${info.abi}`,
      })
    }
  } catch (error) {
    fail(
      checks,
      'NATIVE_BINDING',
      `cannot acquire node-addon-require-builtin from vendor/loader: ${error.message} — ` +
      'loader internal import disabled → raw import() fallback → every plugin entry ' +
      'ERR_MODULE_NOT_FOUND at fresh-child boot (2026-10-02 rollback class).',
    )
  }

  // -- check 2: resolution-surface census ------------------------------------
  // vendor/loader's own peers (cordis, cosmokit) and the full apps/cli
  // @deepseek-ai surface — the baseUrl-side closure that resolves loader
  // entries. Every entry must be alive and name-consistent; this is the
  // anti-whack-a-mole property: the census is mechanical over the WHOLE
  // surface, not a checklist of previously-broken names.
  for (const surface of ['harness/vendor/loader', 'harness/apps/cli']) {
    const result = censusSurface(root, surface)
    checks.push({
      check: `CENSUS:${surface}`,
      ok: result.ok,
      detail: result.ok
        ? `${result.entries.length} entries alive and name-consistent`
        : result.entries.filter((e) => !e.ok).map((e) => `${e.name}: ${e.detail}`).join('; '),
    })
  }

  // -- check 3: the canonical failing specifier resolves from apps/cli -------
  // (cosmokit is intentionally absent here: it is a loader/vendored peer, not
  // an apps/cli dependency — its surface census is check 2's vendor/loader row.)
  const appsCliDir = join(root, 'harness/apps/cli')
  for (const spec of ['@deepseek-ai/cordis-plugin-timer', '@deepseek-ai/cordis']) {
    try {
      const found = resolvePackageFromDir(appsCliDir, spec)
      if (!found) throw new Error('not resolvable')
      readPackageName(found.realpath)
      checks.push({ check: 'RESOLVE', ok: true, detail: `${spec} -> ${found.realpath}` })
    } catch (error) {
      fail(checks, 'RESOLVE', `${spec}: ${error.message ?? error}`)
    }
  }

  return { ok: checks.every((c) => c.ok), checks, suffix }
}

// ---- CLI (only when executed directly, not when imported by tests) --------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const { ok, checks, suffix } = runGate({ trustedRoot: args.trustedRoot })
  if (args.json) {
    console.log(JSON.stringify({
      gate: 'CLOSURE_RESOLUTION_GATE_V1',
      trustedRoot: args.trustedRoot,
      runtime: { platform: process.platform, arch: process.arch, node: process.versions.node, modules: process.versions.modules },
      expectedSuffix: suffix,
      ok,
      checks,
    }, null, 2))
  } else {
    for (const c of checks) {
      console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.check}  ${c.detail}`)
    }
    console.log(`${ok ? 'CLOSURE_RESOLUTION_GATE PASS' : 'CLOSURE_RESOLUTION_GATE FAIL'} (runtime ${process.platform}-${process.arch}, expected suffix ${suffix})`)
  }
  process.exit(ok ? 0 : 2)
}
