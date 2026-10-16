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

test('set path forwards verbatim as enabled conversation with authConfigFile', () => {
  assert.deepEqual(
    productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: '/Users/yanfenma/.agent-core/config/native-conversation.json' }),
    { productApi: { conversation: { enabled: true, authConfigFile: '/Users/yanfenma/.agent-core/config/native-conversation.json' } } },
  )
})

test('non-string env values are not wires (defense against supervision typos)', () => {
  assert.deepEqual(productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: undefined }), {})
  assert.deepEqual(productApiCompositionFromEnv({ PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE: 42 }), {})
})
