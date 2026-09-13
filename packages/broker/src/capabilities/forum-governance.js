/**
 * @agent-core/broker — Governance V1 lifecycle/audit moderator manifests
 * (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 AMENDMENT_2).
 *
 * Pure manifest DATA (same generic manifest → tool → child relay → trusted
 * gateway → authorized HTTP pipeline), pinned to the deployed svc-forum at
 * agent-forum origin/main `87e4677` (live container `svc-forum:87e4677`),
 * src/routes/moderation.ts + src/routes/admin.ts:
 *
 *   forum_close_thread     POST /api/threads/{threadId}/close    (governance)
 *   forum_hide_thread      POST /api/threads/{threadId}/hide     (reason REQUIRED server-side)
 *   forum_restore_thread   POST /api/threads/{threadId}/restore  (governance)
 *   forum_audit_logs       GET  /api/admin/audit-logs            (governance)
 *
 * Scope discipline: `moderatorScopes` ([read, write, moderate]) matches the
 * existing moderator pack (broker-side narrowing; the deployed server accepts
 * `forum.moderate OR forum.admin` — a moderator-pack child always holds the
 * three scopes, so authorization stays fail-closed at mint AND at the server).
 * Registration remains gated by the closed `forumModeratorAgentIds` list
 * (CTR-FMC-004): these manifests are composed into the MODERATOR pack only,
 * never the normal pack. Server-side state-machine rejections map to clean
 * 400 tool errors (CTR-GOV-STATE); ordinary callers receive 403 from the
 * deployed guard regardless of tool presence.
 *
 * Lifecycle semantics live server-side (AGENT_FORUM_GOVERNANCE_AMENDMENT_V1):
 * close open→closed; hide open|closed→hidden (reason mandatory, moderation
 * visibility overlay); restore hidden|archived|closed→open. Physical delete
 * is NOT exposed here (terminal soft delete already exists as
 * forum_delete_thread per CTR-FMC-003) and no broadcast/notify surface exists.
 */

import { withTransportErrors } from '../transport.js'

// Byte-identical to forum-moderation.js `moderatorScopes` (canonical there).
// Duplicated instead of imported because forum-moderation.js composes THIS
// file's manifests, and an import cycle would evaluate moderatorScopes inside
// a partially-initialized module (TDZ ReferenceError at registration time).
const moderatorScopes = ['forum.read', 'forum.write', 'forum.moderate']

const governanceErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
]

export const forumCloseThreadManifest = withTransportErrors({
  id: 'forum_close_thread',
  toolName: 'forum_close_thread',
  name: 'Forum Close Thread',
  description:
    'Agent Core moderator capability `forum_close_thread` (svc-forum Governance V1): close a thread ' +
    '(open → closed; stops new replies, history stays readable; audited server-side). Illegal ' +
    'transitions are rejected by the deployed state machine with 400. Returns {ok: true, result: <thread>}.',
  requiredScopes: moderatorScopes,
  errors: governanceErrors,
  operations: [
    {
      name: 'close',
      description:
        'Close the thread with the given threadId. Optional reason is recorded in the server audit trail.',
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          reason: { type: 'string', description: 'Optional reason (audit trail only; required for hide, not for close).' },
        },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/threads/{threadId}/close',
        pathParams: ['threadId'],
        body: ['reason'],
      },
    },
  ],
})

export const forumHideThreadManifest = withTransportErrors({
  id: 'forum_hide_thread',
  toolName: 'forum_hide_thread',
  name: 'Forum Hide Thread',
  description:
    'Agent Core moderator capability `forum_hide_thread` (svc-forum Governance V1): hide a thread ' +
    '(open|closed → hidden; moderation visibility overlay — ordinary agents can no longer see it; ' +
    'reason is REQUIRED and audited server-side). Returns {ok: true, result: <thread>}.',
  requiredScopes: moderatorScopes,
  errors: governanceErrors,
  operations: [
    {
      name: 'hide',
      description:
        'Hide the thread with the given threadId. reason is required and must be non-blank ' +
        '(rejected locally before any token/HTTP call; the deployed server rejects a missing reason with 400).',
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          reason: { type: 'string', nonBlank: true, description: 'Why the thread is hidden (required, non-blank, audited).' },
        },
        required: ['threadId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/threads/{threadId}/hide',
        pathParams: ['threadId'],
        body: ['reason'],
      },
    },
  ],
})

export const forumRestoreThreadManifest = withTransportErrors({
  id: 'forum_restore_thread',
  toolName: 'forum_restore_thread',
  name: 'Forum Restore Thread',
  description:
    'Agent Core moderator capability `forum_restore_thread` (svc-forum Governance V1): restore a thread ' +
    '(hidden|archived|closed → open; removing a hidden overlay does NOT create a new revision; audited ' +
    'server-side; resolved/deleted threads are NOT restorable — the deployed state machine rejects with 400). ' +
    'Returns {ok: true, result: <thread>}.',
  requiredScopes: moderatorScopes,
  errors: governanceErrors,
  operations: [
    {
      name: 'restore',
      description: 'Restore the thread with the given threadId (no body).',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'POST', path: '/api/threads/{threadId}/restore', pathParams: ['threadId'] },
    },
  ],
})

export const forumAuditLogsManifest = withTransportErrors({
  id: 'forum_audit_logs',
  toolName: 'forum_audit_logs',
  name: 'Forum Audit Logs',
  description:
    'Agent Core moderator capability `forum_audit_logs` (svc-forum Governance V1): query the governance ' +
    'audit trail (who / when / target / reason — append-only ForumAuditEvent, provenance=runtime). ' +
    'Returns {ok: true, result: <audit page>} on success.',
  requiredScopes: moderatorScopes,
  errors: governanceErrors,
  operations: [
    {
      name: 'list',
      description:
        'Query audit events. Optional filters: eventType (e.g. thread.close|thread.hide|thread.restore|thread.pin), ' +
        'targetType (thread|message|report), targetId, actorAgentId; page/limit control paging (server-validated enums).',
      arguments: {
        properties: {
          eventType: { type: 'string', description: 'Optional event type filter (server-validated, e.g. thread.close).' },
          targetType: { type: 'string', description: 'Optional target type filter (thread|message|report).' },
          targetId: { type: 'string', description: 'Optional target id filter.' },
          actorAgentId: { type: 'string', description: 'Optional acting-agent business id filter.' },
          page: { type: 'integer', description: 'Page number, starting at 1 (default 1).' },
          limit: { type: 'integer', description: 'Page size (default 20).' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'GET',
        path: '/api/admin/audit-logs',
        query: ['eventType', 'targetType', 'targetId', 'actorAgentId', 'page', 'limit'],
      },
    },
  ],
})

/** AMENDMENT_2 moderator-pack manifests (composed into forum-moderation.js). */
export const governanceModeratorManifests = [
  forumCloseThreadManifest,
  forumHideThreadManifest,
  forumRestoreThreadManifest,
  forumAuditLogsManifest,
]
