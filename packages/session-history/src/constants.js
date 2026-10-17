/**
 * @agent-core/session-history — MOBILE_SESSION_HISTORY_V1 frozen constants.
 *
 * Resource ceilings are exact frozen integers (CTR-SH-011); the public message
 * ID codec constants are grammar-exact (CTR-SH-012); the pinned DSH decoder
 * revisions are recorded here because the read path is only valid against the
 * deployed DSH artifact format (MOBILE_SESSION_HISTORY_V1 §3.5).
 */

/** Frozen per-request decode/project ceilings (CTR-SH-011). */
export const MAX_ARTIFACT_BYTES = 4_000_000
export const MAX_RECORD_BYTES = 512_000
export const MAX_EXPANDED_EVENT_COUNT = 20_000
export const MAX_CONTENT_BLOCKS_PER_MESSAGE = 4_096
export const MAX_PROJECTED_TEXT_BYTES_PER_MESSAGE = 1_000_000
export const MAX_TOTAL_PROJECTED_TEXT_BYTES_PER_RESPONSE = 8_000_000
export const MAX_RESPONSE_MESSAGE_COUNT = 200
export const MAX_DECODE_WALL_TIME_MS = 10_000

/** Public message identity codec (CTR-SH-012). */
export const CODEC_TAG = 'MSH1'
export const PUBLIC_MESSAGE_ID_PREFIX = 'msg_sh1_'
export const PUBLIC_MESSAGE_ID_LENGTH = 51
export const SPEC_TUPLE_CONST = 'MOBILE_SESSION_HISTORY_V1'
export const LOGICAL_MAIN = 'main'

/**
 * Pinned DSH revisions. decodeStorageRecord is consumed from the pinned
 * @deepseek-ai/dsh-session package (pure JS, zero transitive deps); the
 * locator encoding (projectKey/encodeSegment) is a verbatim transcription of
 * @deepseek-ai/dsh-session-persistence-jsonl@0.1.0-rc.8 src/format.ts — that
 * package's public entry exports only its service class (and drags the native
 * zstd binding, which the plaintext-only read path must not load).
 */
export const PINNED_DSH_SESSION_REVISION = '@deepseek-ai/dsh-session@0.1.0-rc.8'
export const PINNED_DSH_SESSION_PERSISTENCE_JSONL_REVISION =
  '@deepseek-ai/dsh-session-persistence-jsonl@0.1.0-rc.8'

/** Maximum public-message-ID cursor input size (CTR-SH-002). */
export const MAX_CURSOR_BYTES = 512

/** Maximum representable canonical ISO-8601 UTC millisecond value. */
export const MAX_ISO_TIME_MS = 8_640_000_000_000_000
