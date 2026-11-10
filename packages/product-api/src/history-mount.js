/** Optional history activation and ctx.effect teardown (CTR-ARR-001/002). */
const loadHistoryModules = () => Promise.all([
  import('@agent-core/session-history'),
  import('./history-listener.js'),
  import('./history-auth.js'),
])

export function mountOptionalHistory(ctx, {
  historyConfig, workspaceBootstrap, router, definition, channel, log,
}, loadModules = loadHistoryModules) {
  const report = (method, line) => {
    try { log[method](line) } catch { /* a log sink cannot gate the runtime */ }
  }
  if (historyConfig.enabled !== true) return Promise.resolve()
  const host = historyConfig.host ?? ''
  if (host === '' || host === '0.0.0.0' || host === '::' || host === '*') {
    report('error', 'history listener enabled but no Tailscale bind host configured; history route stays absent')
    return Promise.resolve()
  }
  if (workspaceBootstrap === undefined) {
    report('error', 'history listener enabled but workspaceBootstrap service is absent; history route stays absent')
    return Promise.resolve()
  }

  let stopped = false
  let listener
  // Register before the asynchronous import, so a disposed context cannot
  // later acquire a listener (even if its effect registry is already gone).
  ctx.effect(() => () => {
    stopped = true
    return listener?.close()
  })
  return Promise.resolve().then(() => stopped ? null : loadModules())
    .then((modules) => {
      if (stopped) return
      const [{ createSessionHistoryService }, { startHistoryListener }, {
        loadAuthConfigProfile, createWhoIsResolver, createNodeHttpWhoIsTransport,
      }] = modules
      const sessionHistory = createSessionHistoryService({
        router, definition, channel,
        resolveAgentWorkspace: (agentId) => workspaceBootstrap.resolveWorkspace(agentId),
        resolveAgentHome: (agentId) => workspaceBootstrap.resolveDshHome(agentId),
      })
      const profile = loadAuthConfigProfile(
        historyConfig.authConfigFile || process.env.PRODUCT_API_AUTH_CONFIG_FILE,
      )
      if (!profile.ready) {
        report('error', 'history auth config not ready (PRODUCT_API_AUTH_CONFIG_FILE); listener mounted fail-closed (503)')
      }
      const resolver = createWhoIsResolver({
        socketPath: historyConfig.tailscaledSocket || undefined,
        timeoutMs: Number.isFinite(historyConfig.whoisTimeoutMs) ? historyConfig.whoisTimeoutMs : 1500,
        transport: createNodeHttpWhoIsTransport(),
      })
      const port = Number.isFinite(historyConfig.port) ? historyConfig.port : 8788
      listener = startHistoryListener({
        host, port, profile, sessionHistory, resolveStableNodeId: resolver,
      })
      if (stopped) return listener.close()
      listener.server.once('listening', () => {
        if (!stopped) report('log', `history listener listening on http://${host}:${port} (profile ready=${profile.ready})`)
      })
    })
    .catch(() => {
      // Fixed text only: module/config errors may carry credentials or paths.
      report('error', 'history listener failed to mount; history route stays absent')
    })
}
