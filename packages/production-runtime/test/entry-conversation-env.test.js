/**
 * DSH_MCP_NATIVE_CONVERSATION_V1 pilot — supervision-unit composition seam.
 *
 * The conversation facade is mounted only through
 * PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE. The env is the single enablement
 * input: absent/empty must compose EXACTLY the pre-pilot runtime (no
 * productApi key at all — the mount stays unconstructed and default-OFF per
 * CTR-NC-001), and a set path must forward verbatim as
 * productApi.conversation={enabled:true,authConfigFile} (the path is only
 * validated per request by the facade's own 0600/directory checks, never at
 * boot — a bad file must not take the runtime down).
 *
 * AC1159 user-runtime seam extension: the seam also carries the T48 history
 * env passthrough (mechanical config flow with the identical pre-pilot
 * overlay shape — listener stays ABSENT unless PRODUCT_API_HISTORY_ENABLED=1
 * with a concrete Tailnet host). With no conversation env and history
 * disabled, the composition is still exactly {} (default-OFF preserved).
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { productApiCompositionFromEnv } from '../src/entry.js'

test('absent env composes exactly the pre-pilot runtime (no productApi key)', () => {
  assert.deepEqual(productApiCompositionFromEnv({}), {})
})

test('empty env value is treated as unset (no productApi key)', () => {
  assert.deepEqual(productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: '' }), {})
})

test('history-disabled conversation env forwards conversation with inert history defaults', () => {
  assert.deepEqual(
    productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: '/Users/yanfenma/.agent-core/config/native-conversation.json' }),
    {
      productApi: {
        conversation: { enabled: true, authConfigFile: '/Users/yanfenma/.agent-core/config/native-conversation.json' },
        history: { enabled: false, host: '', port: 8788, authConfigFile: '', whoisTimeoutMs: 1500 },
      },
    },
  )
})

test('history env forwards the pre-pilot overlay shape verbatim', () => {
  assert.deepEqual(
    productApiCompositionFromEnv({
      PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: '/Users/yanfenma/.agent-core/config/native-conversation.json',
      PRODUCT_API_HISTORY_ENABLED: '1',
      PRODUCT_API_HISTORY_HOST: '100.103.205.36',
      PRODUCT_API_HISTORY_PORT: '8789',
      PRODUCT_API_AUTH_CONFIG_FILE: '/Users/yanfenma/.agent-core/config/product-api-history-auth.json',
      PRODUCT_API_HISTORY_TAILSALED_SOCKET: '/var/run/tailscaled.sock',
    }),
    {
      productApi: {
        conversation: { enabled: true, authConfigFile: '/Users/yanfenma/.agent-core/config/native-conversation.json' },
        history: {
          enabled: true, host: '100.103.205.36', port: 8789,
          authConfigFile: '/Users/yanfenma/.agent-core/config/product-api-history-auth.json',
          tailscaledSocket: '/var/run/tailscaled.sock', whoisTimeoutMs: 1500,
        },
      },
    },
  )
})

test('history enabled alone composes productApi without the conversation mount', () => {
  const composed = productApiCompositionFromEnv({ PRODUCT_API_HISTORY_ENABLED: '1', PRODUCT_API_HISTORY_HOST: '100.103.205.36' })
  assert.equal(composed.productApi.conversation, undefined)
  assert.equal(composed.productApi.history.enabled, true)
})

test('non-string env values are not wires (defense against supervision typos)', () => {
  assert.deepEqual(productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: undefined }), {})
  assert.deepEqual(productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: 42 }), {})
})
