/**
 * @agent-core/feishu-connector/src/processing-reaction.js
 *
 * One-shot processing reaction lifecycle (OWNER_RULING =
 * ENABLE_FEISHU_PROCESSING_REACTION, 2026-08-23): when an inbound message has
 * been admitted by the bridge (self-echo / identity / mention-policy /
 * PREBOUND_ONLY all passed) and the Agent turn starts, add the frozen Feishu
 * native `Typing` reaction on the ORIGINAL inbound message exactly once;
 * after the FULL turn settles — success, Router error, Agent child error,
 * outcome_unknown, final-reply send failure, synchronous throw or rejected
 * Promise — remove it exactly once in a `finally`.
 *
 * Frozen rulings:
 *   PROCESSING_REACTION_EMOJI_TYPE = 'Typing'   (fixed; no free-form emoji
 *     config — an invalid emoji_type would fail silently in Feishu)
 *   ADD_REACTION_CALLS_PER_TURN    = AT_MOST_ONE
 *   DELETE_REACTION_CALLS_PER_TURN = AT_MOST_ONE
 *   KEEPALIVE / PERIODIC_READD / REACTION_BACKGROUND_TIMER = FORBIDDEN
 *     (this module creates ZERO timers of any kind)
 *   REACTION_REMOVED_AFTER_FULL_TURN = REQUIRED
 *   ABRUPT_PROCESS_DEATH_GHOST_REACTION = KNOWN_LIMITATION (a SIGKILL can
 *     leave the Typing reaction on the message until Feishu UI ages it out;
 *     no虚假 "always cleaned" claim is made)
 *
 * Error policy: the reaction is UX feedback, NEVER turn authority. A failed
 * add or delete logs ONE sanitized warning (error message string + message id
 * only — never appSecret/token/Authorization headers, never a raw Axios
 * config object, never message bodies) and the Agent turn proceeds with its
 * own outcome untouched. No failure receipt, no retry loop, no second reply.
 *
 * Admission boundary: this wrapper runs at the connector `config.onEvent`
 * seam — i.e. strictly AFTER the bridge admission segment dropped self-echo,
 * bot/app senders, malformed events, unresolved-identity group messages,
 * ordinary no-mention group drops (requireMentionInGroup=true) and
 * PREBOUND_ONLY rejects, and after the SDK safety pipeline already dropped
 * duplicates (SeenCache + ProcessingLock) — so none of those can ever gain a
 * reaction. The only admission fact re-checked HERE is message staleness
 * (>2min replayed/redelivered messages gain no reaction; the turn itself is
 * still forwarded unchanged — stale-drop stays the SDK's frozen authority).
 *
 * Concurrency: every turn carries its own isolated local state
 * {messageId, reactionId}; the delete always uses the reactionId captured in
 * the SAME closure, so one turn can never remove another turn's reaction
 * even if message ids collide. `dispose()` performs ONE best-effort cleanup
 * pass over the reactions still active in memory, then the caller disconnects
 * the channel; no keepalive or retry loop is ever created.
 */

/** The one and only reaction emoji used for processing feedback. */
export const PROCESSING_REACTION_EMOJI_TYPE = 'Typing'

/** Messages older than this gain no processing reaction (replay guard). */
export const PROCESSING_REACTION_STALE_WINDOW_MS = 2 * 60 * 1000

/** Hard per-turn API call ceilings (asserted by tests, enforced by design). */
export const MAX_REACTION_CREATE_CALLS_PER_TURN = 1
export const MAX_REACTION_DELETE_CALLS_PER_TURN = 1

function reactionApi(channel) {
  // The pinned channel's PUBLIC raw client surface only. Never a second
  // Feishu client, never self-managed tokens, never a REST/axios bypass.
  return channel?.rawClient?.im?.messageReaction ?? undefined
}

function sanitizeError(error) {
  // String-only: keeps Authorization headers / raw Axios config / request
  // bodies out of the logs no matter what shape the client throws.
  const message = error?.message
  return typeof message === 'string' ? message : String(error ?? 'unknown error')
}

/**
 * Create the processing-reaction lifecycle manager for ONE mounted channel.
 *
 * @param {object} p
 * @param {object} p.channel - the @larksuite/channel instance (only its
 *   public `rawClient.im.messageReaction` surface is touched).
 * @param {Function} [p.log] - `(level, ...args)` logger.
 * @param {() => number} [p.now] - clock (tests).
 * @returns {{wrapOnEvent: Function, dispose: Function, activeReactionCount: Function}}
 */
export function createProcessingReactionLifecycle({ channel, log = () => {}, now = Date.now }) {
  /** In-memory registry of still-active turns' reactions (dispose cleanup). */
  const activeReactions = new Set()

  /**
   * Add the Typing reaction to the original inbound message. Returns the
   * per-turn state object, or undefined when no reaction was added (disabled,
   * stale, API absent, or the add failed — all non-fatal by policy).
   */
  async function addReaction(ingress) {
    const api = reactionApi(channel)
    if (api?.create === undefined) return undefined
    try {
      const result = await api.create({
        path: { message_id: ingress.messageId },
        data: { reaction_type: { emoji_type: PROCESSING_REACTION_EMOJI_TYPE } },
      })
      const reactionId = result?.data?.reaction_id
      if (!reactionId) {
        log('warn', '[feishu] processing reaction add returned no reaction_id', { messageId: ingress.messageId })
        return undefined
      }
      return { messageId: ingress.messageId, reactionId, removed: false }
    } catch (error) {
      // UX feedback only: log sanitized warning, turn continues unaffected.
      log('warn', '[feishu] processing reaction add failed', {
        messageId: ingress.messageId,
        error: sanitizeError(error),
      })
      return undefined
    }
  }

  /**
   * Remove one turn's reaction. At most one delete call per turn: the
   * `removed` flag makes the turn's `finally` and a `dispose()` pass
   * mutually exclusive for the same state object.
   */
  async function removeReaction(state) {
    if (state === undefined || state.removed) return
    state.removed = true
    activeReactions.delete(state)
    const api = reactionApi(channel)
    if (api?.delete === undefined) return
    try {
      await api.delete({
        path: { message_id: state.messageId, reaction_id: state.reactionId },
      })
    } catch (error) {
      // Never overrides the turn outcome; no retry loop, no second reply.
      log('warn', '[feishu] processing reaction delete failed', {
        messageId: state.messageId,
        error: sanitizeError(error),
      })
    }
  }

  /**
   * Wrap ONE `config.onEvent` handler with the processing-reaction
   * lifecycle. The wrapper is installed at the connector's onEvent seam, so
   * it only ever sees messages the bridge ALREADY admitted.
   *
   * The reaction switch (`cfg.processingReactionEnabled`, default false) is
   * read LIVE per event — a runtime config swap takes effect immediately,
   * exactly like requireMentionInGroup / autoMentionTriggerSender.
   *
   * @param {Function} onEvent - the live Router onIngress callback.
   * @param {object} cfg - the LIVE plugin config object.
   * @returns {Function} the wrapped async handler (same args, same
   *   resolution/rejection semantics; only the reaction rides along).
   */
  function wrapOnEvent(onEvent, cfg) {
    if (typeof onEvent !== 'function') return onEvent
    return async function processingReactionWrappedOnEvent(ingress, handlerCtx) {
      // Stale/replayed message: no reaction; the turn itself is forwarded
      // unchanged (stale-drop authority stays with the frozen SDK options).
      const age = now() - (ingress?.timestamp ?? 0)
      const stale = age > PROCESSING_REACTION_STALE_WINDOW_MS
      const enabled = cfg?.processingReactionEnabled === true
      const state = enabled && !stale && typeof ingress?.messageId === 'string' && ingress.messageId !== ''
        ? await addReaction(ingress)
        : undefined
      if (state !== undefined) activeReactions.add(state)
      try {
        return await onEvent(ingress, handlerCtx)
      } finally {
        // REACTION_REMOVED_AFTER_FULL_TURN: runs on success, Router-returned
        // {error}, Agent child error, outcome_unknown, final-reply send
        // failure, synchronous throws and rejected Promises alike.
        await removeReaction(state)
      }
    }
  }

  /**
   * Graceful-dispose cleanup: ONE best-effort delete pass over the reactions
   * still active in memory, then the caller disconnects the channel. No
   * keepalive, no retry loop. Abrupt process death is a KNOWN_LIMITATION.
   */
  async function dispose() {
    const pending = [...activeReactions]
    activeReactions.clear()
    await Promise.allSettled(pending.map((state) => removeReaction(state)))
  }

  function activeReactionCount() {
    return activeReactions.size
  }

  return { wrapOnEvent, dispose, activeReactionCount }
}

/**
 * Build the bridge-facing config facade for a LIVE plugin config: every
 * bridge-read key stays a live getter over the real cfg (setCallback /
 * setIngressGate / runtime swaps keep working), and `onEvent` is returned
 * wrapped with the processing-reaction lifecycle. bridge.js itself stays
 * byte-identical (the structure gate: BRIDGE_JS_LINE_COUNT_MUST_NOT_GROW).
 *
 * @param {object} cfg - the LIVE plugin config object.
 * @param {{wrapOnEvent: Function}} lifecycle - the channel's lifecycle.
 * @returns {object} facade with live getters (onEvent wrapped).
 */
export function bridgeConfigWithProcessingReaction(cfg, lifecycle) {
  return {
    get onEvent() {
      return lifecycle.wrapOnEvent(cfg.onEvent, cfg)
    },
    get ingressGate() {
      return cfg.ingressGate
    },
    get requireMentionInGroup() {
      return cfg.requireMentionInGroup
    },
  }
}
