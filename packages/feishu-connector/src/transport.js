/**
 * @agent-core/feishu-connector/src/transport.js
 *
 * WebSocket long-connection transport wrapping the Lark node-sdk `WSClient`.
 *
 * V0 keeps this thin on purpose: reconnect + heartbeat + event dispatch are
 * already handled inside the SDK's long connection. This module adds the
 * channel-layer value the contract asks for on top of that:
 *   - a connection state machine (connected / disconnected / reconnecting)
 *   - reconnect counter + failure alarm logging
 *   - one normalized callback for inbound events (handed to core)
 *   - graceful shutdown
 *
 * It does NOT touch DSH; it only needs a callback to receive normalized events
 * and another to receive connection-state changes.
 */

/**
 * Wrap the Feishu long connection.
 *
 * @param {object} options
 * @param {object} options.client - a Lark.Client (used to derive appId/token store).
 * @param {object} options.ws   - a Lark.WSClient (already built with appId/appSecret).
 * @param {Function} options.eventDispatcher - a Lark.EventDispatcher already bound to handlers.
 * @param {Function} options.onEvent - async (ingressEvent) => void ; called with normalized events
 *                                     AFTER dedup (see index.js wiring).
 * @param {Function} [options.log] - (level, msg, ...args) => void
 * @param {object}  [options.config] - { appId }
 */
export function createFeishuTransport(options) {
  const {
    ws,
    eventDispatcher,
    onEvent,
    log = console.log,
    config = {},
  } = options

  const state = {
    connectionStatus: 'disconnected', // disconnected | connecting | connected | reconnecting
    reconnectCount: 0,
    started: false,
    stopped: false,
  }

  function emitStatus(status) {
    state.connectionStatus = status
    if (typeof options.onStatus === 'function') {
      try {
        options.onStatus({ status, reconnectCount: state.reconnectCount })
      } catch (e) {
        log('error', `feishu-transport: onStatus handler threw: ${e?.message ?? e}`)
      }
    }
  }

  /**
   * Start the long connection. Resolves once the connection is established.
   * The SDK's `start` returns a promise that settles after connect (or fails).
   */
  async function start() {
    if (state.started || state.stopped) return
    state.started = true
    emitStatus('connecting')
    log('info', `feishu-transport: starting long connection (app=${config.appId ?? '-'})`)

    try {
      await ws.start({ eventDispatcher })
      emitStatus('connected')
      log('info', 'feishu-transport: connected')
    } catch (error) {
      emitStatus('disconnected')
      // A rejection from start / an SDK-level reconnect that keeps failing ends
      // up here; report it loudly and let the caller decide whether to retry.
      log('error', `feishu-transport: failed to start/keep connection: ${error?.message ?? error}`)
      throw error
    }
  }

  /**
   * Hook invoked by the plugin on every inbound event BEFORE normalization, so
   * the transport can route it to the registered onEvent callback. Dedup is
   * applied at the index layer, not here.
   */
  async function ingest(raw) {
    if (state.stopped || typeof onEvent !== 'function') return
    try {
      await onEvent(raw)
    } catch (error) {
      log('error', `feishu-transport: event handler error: ${error?.message ?? error}`)
    }
  }

  /**
   * The SDK long connection reconnects and re-establishes heartbeats itself.
   * We surface that fact into the state machine and count it; the user can
   * attach their own reconnect bookkeeping via options.onReconnect.
   */
  function notifyReconnect() {
    state.reconnectCount += 1
    emitStatus('reconnecting')
    log('warn', `feishu-transport: reconnecting (count=${state.reconnectCount})`)
    if (typeof options.onReconnect === 'function') {
      try {
        options.onReconnect({ count: state.reconnectCount })
      } catch (e) {
        log('error', `feishu-transport: onReconnect handler threw: ${e?.message ?? e}`)
      }
    }
  }

  /**
   * Graceful shutdown: call ws.close() if the SDK exposes it, then mark stopped.
   */
  async function stop() {
    state.stopped = true
    if (typeof ws.close === 'function') {
      try {
        await ws.close()
      } catch (e) {
        log('error', `feishu-transport: close failed: ${e?.message ?? e}`)
      }
    }
    emitStatus('disconnected')
    log('info', 'feishu-transport: stopped')
  }

  return {
    state,
    start,
    stop,
    ingest,
    notifyReconnect,
  }
}
