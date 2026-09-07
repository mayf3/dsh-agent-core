/** Inspect actual native bytes and resolved links in a sealed darwin-arm64 generation. */
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const MACHO = new Set(['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'])
const systemLibrary = (path) => path.startsWith('/usr/lib/') || path.startsWith('/System/Library/')
const inside = (root, path) => path === root || path.startsWith(root + sep)
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

function command(bin, args) {
  return execFileSync(bin, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 }).trim()
}

function header(path) {
  const fd = openSync(path, 'r')
  try {
    const bytes = Buffer.alloc(4)
    readSync(fd, bytes, 0, 4, 0)
    return bytes.toString('hex')
  } finally { closeSync(fd) }
}

function rpaths(path) {
  const output = command('/usr/bin/otool', ['-l', path])
  return [...output.matchAll(/cmd LC_RPATH\n[^]*?\n\s*path (.+?) \(offset/g)].map((match) => match[1])
}

/** All non-system dynamic libraries must resolve inside the selected generation. */
function dependencies(path, executableDirectory) {
  const output = command('/usr/bin/otool', ['-L', path])
  const installNames = new Set(command('/usr/bin/otool', ['-D', path]).split('\n').slice(1).map((line) => line.trim()))
  const names = output.split('\n').filter((line) => line.startsWith('\t')).map((line) => line.trim().split(' (compatibility')[0])
  const expand = (name) => name.replace('@loader_path', dirname(path)).replace('@executable_path', executableDirectory)
  return names.filter((name) => !installNames.has(name)).map((name) => {
    if (systemLibrary(name)) return { name, path: name, system: true }
    let target = expand(name)
    if (name.startsWith('@rpath/')) {
      const matches = rpaths(path).map((base) => resolve(expand(base), name.slice(7))).filter(existsSync)
      target = [...new Set(matches.map((path) => realpathSync(path)))].at(0)
    }
    if (!target || !isAbsolute(target) || !existsSync(target)) throw new Error(`NATIVE_DEPENDENCY_UNRESOLVED: ${path} -> ${name}`)
    return { name, path: realpathSync(target), system: false }
  })
}

/**
 * Inspect a generation. The only x64 inert exception is bundled node-pty prebuilds,
 * and requires an executed ARM selection receipt from that exact package.
 * @param {string[]} roots - Complete runtime roots, including Node, app and Harness.
 * @param {object} options - Node executable and actual node-pty ARM load evidence.
 */
export function inspectNativeClosure(roots, { nodePath, ptySelection = null } = {}) {
  const canonicalRoots = roots.map((path) => realpathSync(path))
  const node = realpathSync(nodePath)
  if (!canonicalRoots.some((root) => inside(root, node))) throw new Error('NODE_OUTSIDE_GENERATION')
  const visited = new Set()
  const files = []
  const links = []
  const failures = []
  const label = (path) => canonicalRoots.map((root, i) => inside(root, path) ? `${i}:${relative(root, path)}` : null).find(Boolean) ?? path
  const fail = (code, path, detail) => failures.push({ code, path: label(path), detail })
  const walk = (path) => {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      let target
      try { target = realpathSync(path) } catch { fail('BROKEN_LINK', path); return }
      links.push({ path: label(path), target: label(target) })
      if (!canonicalRoots.some((root) => inside(root, target))) { fail('EXTERNAL_LINK', path, target); return }
      walk(target)
      return
    }
    const real = realpathSync(path)
    if (visited.has(real)) return
    visited.add(real)
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        if (name === '.git') continue
        walk(join(path, name))
      }
      return
    }
    if (!stat.isFile()) { fail('UNSUPPORTED_FILE', path); return }
    const magic = header(path)
    if (!MACHO.has(magic)) {
      if (path.endsWith('.node') && !/[/\\]node-pty[/\\]prebuilds[/\\](linux|win32)-/.test(path)) fail('UNKNOWN_NATIVE_FILE', path)
      return
    }
    let architectures
    try { architectures = command('/usr/bin/lipo', ['-archs', path]).split(/\s+/) }
    catch { fail('UNKNOWN_MACHO', path); return }
    const sha256 = digest(path)
    const native = architectures.includes('arm64')
    const pty = /[/\\]node-pty[/\\]prebuilds[/\\]darwin-x64[/\\](pty.node|spawn-helper)$/.test(path)
    const ptyRoot = pty ? resolve(dirname(path), '../..') : null
    const provenPty = pty && ptySelection?.packageRoot === ptyRoot && ptySelection.arch === 'arm64'
      && ptySelection.loaded?.length > 0 && ptySelection.loaded.every((entry) => {
        const loaded = realpathSync(entry.path)
        return inside(join(ptyRoot, 'prebuilds/darwin-arm64'), loaded) && digest(loaded) === entry.sha256
      }) && ptySelection.spawnPassed === true
    const classification = native ? (architectures.length > 1 ? 'UNIVERSAL_WITH_ARM64' : 'ARM64_NATIVE')
      : provenPty ? 'NOT_RUNTIME_REQUIRED' : 'X64_ONLY_OR_UNKNOWN'
    const record = { path: label(path), architectures, sha256, classification, dependencies: [] }
    files.push(record)
    if (!native && !provenPty) { fail('INCOMPATIBLE_NATIVE_FILE', path, architectures); return }
    if (!native) return
    try {
      record.dependencies = dependencies(path, dirname(node))
      for (const dependency of record.dependencies) {
        if (dependency.system) continue
        if (!canonicalRoots.some((root) => inside(root, dependency.path))) fail('EXTERNAL_DYLIB', path, dependency.path)
        else walk(dependency.path)
      }
    } catch (error) { fail('NATIVE_DEPENDENCY_UNRESOLVED', path, error.message) }
  }
  for (const root of canonicalRoots) walk(root)
  if (!files.some((file) => file.path === label(node) && file.classification === 'ARM64_NATIVE')) fail('NODE_NOT_NATIVE_ARM64', node)
  const result = { roots: canonicalRoots, node, files, links, failures, compatible: failures.length === 0 }
  if (failures.length) throw Object.assign(new Error(`NATIVE_CLOSURE_REJECTED: ${failures.length} failure(s)`), { result })
  return result
}
