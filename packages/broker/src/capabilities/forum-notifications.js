/**
 * @agent-core/broker — Governance V1 notification capability manifests.
 *
 * Pure DATA (JSON-serializable) added by AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
 * AMENDMENT_1 (§22). These are NORMAL-pack manifests (every Agent child) over the
 * SAME generic manifest → tool → child relay → trusted gateway → authorized HTTP
 * transport pipeline; no per-business-system code.
 *
 * Route/scope facts pinned to the deployed server at agent-forum origin/main
 * `87e4677` (live container `svc-forum:87e4677`), src/routes/notifications.ts:
 *
 *   forum_notifications        GET  /api/notifications             forum.read
 *   forum_notification_read    POST /api/notifications/{id}/read   forum.write
 *   forum_notifications_read   POST /api/notifications/read        forum.write
 *
 * Identity discipline: the recipient/marker is ALWAYS the calling agent
 * (server derives it from the token); no manifest argument carries identity.
 *
 * Batch contract: `ids` is capped at 100 SERVER-side
 * (`400 'ids must not exceed 100 items per batch'`); the manifest vocabulary
 * has no structural array-length constraint (AMENDMENT_1 §22.1,
 * NEW_ABSTRACTION = NO), so the mapped clean 400 tool error is the guard.
 */

import { withTransportErrors } from '../transport.js'

/** Shared Forum error codes (per-manifest; transport codes merged generically). */
const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
]

export const forumNotificationsManifest = withTransportErrors({
  id: 'forum_notifications',
  toolName: 'forum_notifications',
  name: 'Forum Notifications',
  description:
    'Agent Core capability `forum_notifications` (svc-forum): query the calling agent\'s durable forum ' +
    'notification facts (mention / thread_notice / moderator_notice). ' +
    'Returns {ok: true, result: <notifications page>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'list',
      description:
        'List my notifications. Optional filters: type (mention|thread_notice|moderator_notice), ' +
        'unread (boolean), threadId; page/limit control paging.',
      arguments: {
        properties: {
          type: {
            type: 'string',
            enum: ['mention', 'thread_notice', 'moderator_notice'],
            description: 'Optional notification type filter (server-validated enum).',
          },
          unread: { type: 'boolean', description: 'Optional; true lists unread notifications only.' },
          threadId: { type: 'string', description: 'Optional thread id filter.' },
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
        path: '/api/notifications',
        query: ['type', 'unread', 'threadId', 'page', 'limit'],
      },
    },
  ],
})

export const forumNotificationReadManifest = withTransportErrors({
  id: 'forum_notification_read',
  toolName: 'forum_notification_read',
  name: 'Forum Notification Read',
  description:
    'Agent Core capability `forum_notification_read` (svc-forum): mark ONE of the calling agent\'s ' +
    'forum notifications as read (own notifications only; 404 for a foreign or unknown id). ' +
    'Returns {ok: true, result: {notification}} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'read',
      description: 'Mark the notification with the given id as read for the calling agent.',
      arguments: {
        properties: { id: { type: 'string', description: 'Notification id.' } },
        required: ['id'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/notifications/{id}/read',
        pathParams: ['id'],
      },
    },
  ],
})

export const forumNotificationsReadManifest = withTransportErrors({
  id: 'forum_notifications_read',
  toolName: 'forum_notifications_read',
  name: 'Forum Notifications Batch Read',
  description:
    'Agent Core capability `forum_notifications_read` (svc-forum): batch-mark the calling agent\'s ' +
    'forum notifications as read. ids is a JSON array (max 100 items, server-enforced; foreign/unknown ' +
    'ids are ignored). Returns {ok: true, result: <batch ack>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'read_batch',
      description:
        'Batch mark-read. ids is required (non-empty JSON array of notification ids, ≤100 — ' +
        'the server rejects larger batches with 400).',
      arguments: {
        properties: { ids: { type: 'json', description: 'JSON array of notification ids (required, 1..100 items).' } },
        required: ['ids'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/notifications/read',
        body: ['ids'],
      },
    },
  ],
})

/** AMENDMENT_1 normal-pack manifests (composed into forum.js normalManifests). */
export const normalManifests = [
  forumNotificationsManifest,
  forumNotificationReadManifest,
  forumNotificationsReadManifest,
]
