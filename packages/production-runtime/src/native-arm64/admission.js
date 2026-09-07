/** Native production admission, before any application module is loaded. */
export function assertProductionArchitecture({
  required = process.argv.includes('--native-arm64'),
  env = process.env,
  runtime = process,
} = {}) {
  if (!required && env.DSH_RUNTIME_ARCH === undefined) return null
  const fail = (reason) => {
    throw Object.assign(new Error(`NATIVE_RUNTIME_REJECTED: ${reason}`), { code: 'NATIVE_RUNTIME_REJECTED' })
  }
  if (env.DSH_RUNTIME_ARCH !== 'arm64') fail('expected_arch_missing_or_invalid')
  if (runtime.platform !== 'darwin') fail('platform_not_darwin')
  if (runtime.arch !== 'arm64') fail('process_not_native_arm64')
  if (runtime.version !== 'v25.6.1') fail('node_version_not_v25.6.1')
  // Load the sealed binding directly; a writable external native cache is not
  // part of this generation. Set before importing Harness/application code.
  env.NARB_DISABLE_NATIVE_CACHE = '1'
  // Rosetta executes x86_64 code; a running arm64 Node is native, not translated.
  return Object.freeze({
    platform: runtime.platform, arch: runtime.arch, nodeVersion: runtime.version,
    execPath: runtime.execPath, pid: runtime.pid, rosettaTranslated: false,
  })
}
