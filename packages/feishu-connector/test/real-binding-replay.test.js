/**
 * REAL Binding continuity replay (spec §7.2-4 / AC5) — READ-ONLY.
 *
 * If a production bindings.json is present on this machine
 * ($AGENT_CORE_REAL_BINDINGS_STORE, default ~/.agent-core/bindings/
 * bindings.json), one REAL `feishu:<conversationId>` row key is replayed
 * through the new chain:
 *
 *   conversationId (from the row key) → synthetic wire event → pinned SDK
 *   normalize → thin adapter → ccId via the REAL Router id owner →
 *   BindingStore row lookup (same durable format the Router reads).
 *
 * The store is NEVER written (BindingStore construction only reads); the
 * store file, row contents and any user content stay OUT of the repo — the
 * PR records only the sanitized pass/fail evidence. Absent store = SKIP
 * (evidence then comes from the deployment machine).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { normalize } from '@larksuite/channel'
import { channelConversationId } from '../../agent-router/src/index.js'
import { BindingStore } from '../../agent-router/src/binding-store.js'
import { normalizedToIngressEvent } from '../src/bridge.js'

const storePath = process.env.AGENT_CORE_REAL_BINDINGS_STORE
  ?? join(homedir(), '.agent-core', 'bindings', 'bindings.json')

const hasStore = existsSync(storePath)

test('real binding replay: derivation from a production row key hits the SAME binding row', { skip: !hasStore && 'no production bindings store on this machine (PENDING — evidence from deployment machine)' }, async () => {
  const store = new BindingStore({ storeFile: storePath }) // read-only load
  const keys = [...store.bindings.keys()].filter((k) => k.startsWith('feishu:') && !k.includes(':topic:'))
  assert.ok(keys.length > 0, 'the store carries feishu rows')

  // Replay the FIRST plain feishu row (no conversation content is read or
  // recorded — only the opaque conversationId participates).
  const ccIdRow = keys[0]
  const conversationId = ccIdRow.slice('feishu:'.length)

  const wireEvent = {
    schema: '2.0',
    event_id: 'evt_real_replay',
    event_type: 'im.message.receive_v1',
    create_time: String(Date.now()),
    token: 'x',
    app_id: 'cli_replay',
    sender: { sender_id: { open_id: 'ou_replay' }, sender_type: 'user' },
    message: {
      message_id: 'om_replay_001',
      create_time: String(Date.now()),
      chat_id: conversationId,
      chat_type: 'p2p',
      message_type: 'text',
      content: '{"text":"replay"}',
      mentions: [],
    },
  }

  const botIdentity = { openId: 'ou_bot_replay', name: 'bot' }
  const msg = await normalize(wireEvent, { botIdentity, includeRaw: true })
  const ev = normalizedToIngressEvent(msg, { botIdentity })

  // byte-equal conversationId derivation from the real row's conversationId
  assert.equal(ev.conversationId, conversationId)
  const ccId = channelConversationId('feishu', ev.conversationId)
  assert.equal(ccId, ccIdRow)

  // the derived ccId hits the EXISTING row (getBinding semantics — same
  // durable map the Router's getBinding reads)
  const binding = store.bindings.get(ccId)
  assert.ok(binding !== undefined, `derived ccId ${ccId} must hit an existing binding row`)
  assert.equal(binding.channelConversationId, ccIdRow)
})
