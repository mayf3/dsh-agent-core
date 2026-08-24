/**
 * @agent-core/feishu-connector/src/reply-card.js
 *
 * STATIC_FINAL_CARD_V1 (OWNER_RULING = ENABLE_STATIC_FEISHU_REPLY_CARD,
 * 2026-08-24): deterministic construction of the button-less Feishu CardKit
 * 2.0 static card for the Router SUCCESS reply, plus the deterministic
 * PRE-send envelope check. This module is PURE — zero network I/O; the only
 * send primitive remains the pinned SDK's public
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
 *   REPLY_CARD_MAX_JSON_BYTES        = 30000 — conservative under the
 *                                      official interactive request-body cap
 *                                      ("卡片及富文本消息最大不能超过 30KB",
 *                                      Feishu error 230026); the SDK card
 *                                      path does NOT chunk, so an oversize
 *                                      card must never be attempted.
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

/**
 * Deterministic pre-send envelope: the UTF-8 byte size of the serialized
 * card JSON must not exceed this. Conservative under the official 30KB
 * interactive message-body limit (Feishu 230026).
 */
export const REPLY_CARD_MAX_JSON_BYTES = 30000

/** CARD_NOT_ATTEMPTED reason: serialized card JSON exceeds the envelope. */
export const CARD_NOT_ATTEMPTED_CONTENT_OUT_OF_ENVELOPE = 'CONTENT_OUT_OF_CARD_ENVELOPE'

/** CARD_NOT_ATTEMPTED reason: empty model reply (empty-reply stays non-card). */
export const CARD_NOT_ATTEMPTED_EMPTY_REPLY = 'EMPTY_REPLY_NO_CARD'

/**
 * Compose the static reply card for one final Agent reply body.
 * PURE and deterministic: builds the card JSON, measures its serialized
 * size, and decides attemptability BEFORE any card API call.
 *
 * @param {string} text - the final model reply (never rewritten here).
 * @returns {{attempted:true, card:object, jsonBytes:number}|
 *   {attempted:false, reason:string, jsonBytes?:number}}
 */
export function composeReplyCard(text) {
  const body = String(text ?? '')
  // EMPTY_REPLY protection: the empty-reply path keeps its current
  // (non-card) treatment — it is never cardified.
  if (body === '') {
    return { attempted: false, reason: CARD_NOT_ATTEMPTED_EMPTY_REPLY }
  }
  const card = {
    schema: '2.0',
    header: { title: { tag: 'plain_text', content: REPLY_CARD_TITLE } },
    body: { elements: [{ tag: 'markdown', content: body }] },
  }
  const jsonBytes = Buffer.byteLength(JSON.stringify(card), 'utf8')
  if (jsonBytes > REPLY_CARD_MAX_JSON_BYTES) {
    return { attempted: false, reason: CARD_NOT_ATTEMPTED_CONTENT_OUT_OF_ENVELOPE, jsonBytes }
  }
  return { attempted: true, card, jsonBytes }
}

/**
 * Build the full SDK send plan for the static card reply over the SAME
 * ReplyTarget the markdown path uses. Anchoring (replyTo / replyInThread /
 * receiveId) is derived by delegating to the frozen mapping in core.js with
 * NO ux intent — so a card plan can never carry a mentions entry
 * (CARD_AUTO_MENTION = NONE) and stays anchored byte-compatibly with the
 * markdown success reply (topic never escapes; p2p still replies to the
 * original message).
 *
 * @param {object} replyTarget - a ReplyTarget object.
 * @param {string} text - the final model reply.
 * @returns {{plan:{to:string, input:{card:object}, opts:object, method:string}, jsonBytes:number}|
 *   {notAttempted:string, jsonBytes?:number}} the card plan, or the
 *   deterministic not-attempted decision for the caller to fall back on.
 */
export function replyCardSendPlan(replyTarget, text) {
  const composed = composeReplyCard(text)
  if (!composed.attempted) {
    return { notAttempted: composed.reason, ...(composed.jsonBytes !== undefined ? { jsonBytes: composed.jsonBytes } : {}) }
  }
  // Receipt-style plan (no ux): pure anchoring opts, never a mentions key.
  const anchor = replyTargetToSdkSend(replyTarget, '')
  return {
    plan: {
      to: anchor.to,
      input: { card: composed.card },
      opts: anchor.opts,
      method: anchor.method,
    },
    jsonBytes: composed.jsonBytes,
  }
}
