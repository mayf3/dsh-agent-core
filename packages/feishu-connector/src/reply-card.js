/**
 * @agent-core/feishu-connector/src/reply-card.js
 *
 * STATIC_FINAL_CARD_V1 (OWNER_RULING = ENABLE_STATIC_FEISHU_REPLY_CARD,
 * 2026-08-24): deterministic construction of the button-less Feishu CardKit
 * 2.0 static card for the Router SUCCESS reply, plus the deterministic
 * PRE-send request-envelope check. This module is PURE — zero network I/O;
 * the only send primitive remains the pinned SDK's public
 * `channel.send(to, { card }, opts)` invoked by the shell (src/index.js).
 *
 * Frozen rulings:
 *   CARD_VERSION                     = STATIC_FINAL_CARD_V1
 *   CARD_SHAPE                       = CardKit 2.0 JSON (schema "2.0"; one
 *                                      fixed plain_text header title + ONE
 *                                      markdown element carrying the model
 *                                      reply BYTE-UNMODIFIED)
 *   BUTTONS / CARD_ACTION            = NONE (no interactive elements)
 *   CARD_AUTO_MENTION                = NONE (no mentions key is ever
 *                                      composed on a card plan)
 *   AMBIGUOUS_CARD_SEND_FALLBACK     = FORBIDDEN (one card API call; no
 *                                      post-failure markdown re-send)
 *   DETERMINISTIC_PRE_SEND_FALLBACK  = EXISTING_MARKDOWN (oversize/empty is
 *                                      decided BEFORE any card API call)
 *   REPLY_CARD_MAX_REQUEST_BYTES     = 29000 — conservative below the
 *                                      official 30KB request-body cap. The
 *                                      create API documentation records
 *                                      error 230025 for an oversized body;
 *                                      that code is documentation evidence,
 *                                      not runtime classification authority.
 *
 * Table compatibility evidence: the Card JSON 2.0 markdown component
 * natively renders standard GFM pipe tables (2.0-only capability; >5 data
 * rows paginate, max 4 tables per component) — no native table element
 * conversion and no custom Markdown parser are introduced. Real-client
 * display verification belongs to the deploy round (no test app / no
 * production sends this round).
 */

import { replyTargetToSdkSend } from './core.js'

/** Fixed card header title (STATIC_FINAL_CARD_V1; not configurable). */
export const REPLY_CARD_TITLE = 'Agent 回复'

/** Maximum UTF-8 bytes of the final serialized pinned-SDK request body. */
export const REPLY_CARD_MAX_REQUEST_BYTES = 29000

/** CARD_NOT_ATTEMPTED reason: a serialized SDK request body is too large. */
export const CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE = 'REQUEST_BODY_OUT_OF_CARD_ENVELOPE'

/** CARD_NOT_ATTEMPTED reason: empty model reply (empty-reply stays non-card). */
export const CARD_NOT_ATTEMPTED_EMPTY_REPLY = 'EMPTY_REPLY_NO_CARD'

/** Compose the static CardKit 2.0 reply card without performing I/O. */
export function composeReplyCard(text) {
  const body = String(text ?? '')
  if (body === '') {
    return { attempted: false, reason: CARD_NOT_ATTEMPTED_EMPTY_REPLY }
  }
  const card = {
    schema: '2.0',
    header: { title: { tag: 'plain_text', content: REPLY_CARD_TITLE } },
    body: { elements: [{ tag: 'markdown', content: body }] },
  }
  return { attempted: true, card }
}

/**
 * Reproduce the pinned SDK's exact interactive reply body and its
 * target-revoked reply→create fallback body. The larger final serialized
 * UTF-8 body is the card-size authority; raw card JSON bytes are diagnostic
 * only because `content` is JSON-escaped a second time in both wire bodies.
 */
export function measureReplyCardRequestEnvelope(card, actualTo, actualReplyInThread) {
  const cardContent = JSON.stringify(card)
  const replyRequestBody = JSON.stringify({
    content: cardContent,
    msg_type: 'interactive',
    reply_in_thread: actualReplyInThread,
  })
  const createFallbackRequestBody = JSON.stringify({
    receive_id: actualTo,
    msg_type: 'interactive',
    content: cardContent,
  })
  const rawCardJsonBytes = Buffer.byteLength(cardContent, 'utf8')
  const replyRequestBytes = Buffer.byteLength(replyRequestBody, 'utf8')
  const createFallbackRequestBytes = Buffer.byteLength(createFallbackRequestBody, 'utf8')
  return {
    rawCardJsonBytes,
    replyRequestBytes,
    createFallbackRequestBytes,
    wireBytes: Math.max(replyRequestBytes, createFallbackRequestBytes),
  }
}

/**
 * Build the full SDK send plan for the static card reply over the SAME
 * ReplyTarget the markdown path uses. Anchoring (replyTo / replyInThread /
 * receiveId) is derived by delegating to the frozen mapping in core.js with
 * NO ux intent, so a card plan can never carry a mentions entry.
 */
export function replyCardSendPlan(replyTarget, text) {
  const composed = composeReplyCard(text)
  if (!composed.attempted) return { notAttempted: composed.reason }

  // Receipt-style plan (no ux): pure anchoring opts, never a mentions key.
  const anchor = replyTargetToSdkSend(replyTarget, '')
  const requestBytes = measureReplyCardRequestEnvelope(
    composed.card,
    anchor.to,
    anchor.opts.replyInThread,
  )
  if (requestBytes.wireBytes > REPLY_CARD_MAX_REQUEST_BYTES) {
    return {
      notAttempted: CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE,
      ...requestBytes,
    }
  }
  return {
    plan: {
      to: anchor.to,
      input: { card: composed.card },
      opts: anchor.opts,
      method: anchor.method,
    },
    ...requestBytes,
  }
}
