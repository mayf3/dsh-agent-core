# draft/ — configuration templates (NOT runnable, NOT installed by this packet)

Every value marked `OWNER-…` is a placeholder decided by the Owner approval items A1–A4 (../README.md §10). The isolated schema validation (README §8) was executed against shape-identical dummy values, not these files.

| Template | Install target at provisioning | Schema |
|---|---|---|
| `dsh-native-conversation.example.json` | `~/.agent-core/config/native-conversation.json` (0600, owner-only non-symlink dir) | `packages/product-api/src/conversation/auth.js validateConfig` @ CODE_CANDIDATE — single client, single target, operations ⊆ {resolve,send,result} |
| `mcp-native-conversation.example.json` | `~/.config/read-mcp/native-conversation.json` (0600, ≤16 KiB) | strict zod schema in dot-read-mcp `src/native-conversation.mjs` @ 46cbba8 — loopback endpoint only, no extra keys |
| `mcp-native-conversation.client.example.json` | `~/.config/read-mcp/native-conversation.client.json` (0600) | strict zod `credentialSchema`; `connector_subject` must equal the config file's; secret lives ONLY here |

These templates intentionally carry no `_comment` keys (the MCP side is `.strict()` and would reject them). The rollback-first shape is `operations:["resolve","result"]` — validated accepted by `validateConfig`.
