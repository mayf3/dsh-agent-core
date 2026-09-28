const PLAIN_OBJECT = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const PROGRESS_CHECKPOINT_LIMITS = Object.freeze({
  maxItemsPerList: 8,
  maxItemChars: 240,
  maxBlockerChars: 500,
  maxArtifactRefs: 12,
  maxArtifactRefChars: 500,
})

const ALLOWED_KEYS = Object.freeze(['accomplished', 'current', 'next', 'blocker', 'artifacts'])
const ALLOWED_KEY_SET = new Set(ALLOWED_KEYS)

function normalizeText(value, { field, maxChars }) {
  if (typeof value !== 'string') {
    throw new TypeError(`workflow-progress: ${field} entries must be strings`)
  }
  const text = value.trim()
  if (text === '') throw new TypeError(`workflow-progress: ${field} entries must be non-blank`)
  if ([...text].length > maxChars) {
    throw new TypeError(`workflow-progress: ${field} entry exceeds ${maxChars} characters`)
  }
  return text
}

function normalizeList(value, { field, maxItems, maxChars }) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new TypeError(`workflow-progress: ${field} must be an array`)
  if (value.length > maxItems) {
    throw new TypeError(`workflow-progress: ${field} may contain at most ${maxItems} entries`)
  }
  return value.map((entry) => normalizeText(entry, { field, maxChars }))
}
/**
 * Normalize the deliberately thin progress checkpoint surface.
 *
 * This is EXECUTION RESUME metadata only. It is not workflow business
 * progress, never transitions a Workflow, and must never feed stale/re-entry
 * judgment. Keeping the shape small prevents this ledger from becoming a
 * second transcript store.
 */
export function normalizeProgressCheckpoint(input) {
  if (!PLAIN_OBJECT(input)) throw new TypeError('workflow-progress: checkpoint must be an object')

  const unknown = Object.keys(input).filter((key) => !ALLOWED_KEY_SET.has(key))
  if (unknown.length > 0) {
    throw new TypeError(`workflow-progress: unknown checkpoint field ${JSON.stringify(unknown[0])}`)
  }

  const accomplished = normalizeList(input.accomplished, {
    field: 'accomplished',
    maxItems: PROGRESS_CHECKPOINT_LIMITS.maxItemsPerList,
    maxChars: PROGRESS_CHECKPOINT_LIMITS.maxItemChars,
  })
  const current = normalizeList(input.current, {
    field: 'current',
    maxItems: PROGRESS_CHECKPOINT_LIMITS.maxItemsPerList,
    maxChars: PROGRESS_CHECKPOINT_LIMITS.maxItemChars,
  })
  const next = normalizeList(input.next, {
    field: 'next',
    maxItems: PROGRESS_CHECKPOINT_LIMITS.maxItemsPerList,
    maxChars: PROGRESS_CHECKPOINT_LIMITS.maxItemChars,
  })
  const artifacts = normalizeList(input.artifacts, {
    field: 'artifacts',
    maxItems: PROGRESS_CHECKPOINT_LIMITS.maxArtifactRefs,
    maxChars: PROGRESS_CHECKPOINT_LIMITS.maxArtifactRefChars,
  })
  let blocker = null
  if (input.blocker !== undefined && input.blocker !== null) {
    blocker = normalizeText(input.blocker, {
      field: 'blocker',
      maxChars: PROGRESS_CHECKPOINT_LIMITS.maxBlockerChars,
    })
  }

  if (
    accomplished.length === 0
    && current.length === 0
    && next.length === 0
    && artifacts.length === 0
    && blocker === null
  ) {
    throw new TypeError('workflow-progress: checkpoint must contain at least one progress field')
  }

  return Object.freeze({
    accomplished: Object.freeze(accomplished),
    current: Object.freeze(current),
    next: Object.freeze(next),
    blocker,
    artifacts: Object.freeze(artifacts),
  })
}
