import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const helper = join(repo, 'scripts/lib/trusted-app-package-copy.mjs')
const installer = join(repo, 'scripts/trusted-cp-deploy-install.sh')

test('trusted pack copies package-root public entries required by production composition', async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'trusted-package-closure-'))
  t.after(() => rmSync(tmp, { recursive: true, force: true }))

  const packedPackages = join(tmp, 'app', 'packages')
  const identitySrc = join(repo, 'packages', 'agent-identity-capabilities')
  const runtimeSrc = join(repo, 'packages', 'production-runtime')
  const feishuSrc = join(repo, 'packages', 'feishu-connector')
  const identityDst = join(packedPackages, 'agent-identity-capabilities')
  const runtimeDst = join(packedPackages, 'production-runtime')
  const feishuDst = join(packedPackages, 'feishu-connector')

  execFileSync(process.execPath, [helper, identitySrc, identityDst], { stdio: 'pipe' })
  execFileSync(process.execPath, [helper, runtimeSrc, runtimeDst], { stdio: 'pipe' })
  execFileSync(process.execPath, [helper, feishuSrc, feishuDst], { stdio: 'pipe' })

  for (const relative of ['package.json', 'index.js', 'src/index.js']) {
    assert.equal(existsSync(join(identityDst, relative)), true,
      `packed identity package must contain ${relative}`)
  }

  const manifest = JSON.parse(readFileSync(join(identityDst, 'package.json'), 'utf8'))
  assert.equal(manifest.exports['.'], './index.js')
  assert.equal(existsSync(join(feishuDst, 'standalone.mjs')), true,
    'the same generic helper must copy another package-root export, not only the identity entry')

  const composePath = join(runtimeDst, 'src', 'compose.js')
  const compose = readFileSync(composePath, 'utf8')
  const line = compose.split('\n').find((row) => row.includes('agent-identity-capabilities/index.js'))
  assert.notEqual(line, undefined)
  const specifier = line.match(/from\s+'([^']+)'/)?.[1]
  assert.equal(typeof specifier, 'string')
  const packedIdentityEntry = resolve(dirname(composePath), specifier)
  assert.equal(packedIdentityEntry, join(identityDst, 'index.js'))
  assert.equal(existsSync(packedIdentityEntry), true,
    'the exact production composition import must resolve inside the packed app')

  const entry = await import(pathToFileURL(packedIdentityEntry).href)
  assert.equal(typeof entry.createAgentPrincipalReverseResolutionAccess, 'function')
})

test('canonical trusted installer uses the package-copy primitive for every package', () => {
  const source = readFileSync(installer, 'utf8')
  assert.match(source, /trusted-app-package-copy\.mjs/)
  assert.match(source, /"\$TRUSTED_NODE" "\$PACKAGE_COPY_HELPER" "\$pkg" "app\/packages\/\$name"/)
  assert.doesNotMatch(source,
    /cp "\$pkg\/package\.json" "app\/packages\/\$name\/package\.json"[\s\S]{0,200}\[ -d "\$pkg\/src" \] && cp -R/,
    'the installer must have one canonical package-copy path rather than a second hand-maintained closure')
})
