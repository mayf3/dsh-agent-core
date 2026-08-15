/**
 * @agent-core/broker — First-batch Forum capability manifests (V1, P1).
 *
 * Pure DATA (JSON-serializable) describing the deployed svc-forum capabilities
 * that a DSH agent needs first. capabilityId / method / path / scope follow
 * docs/investigations/broker-capability-parity.md §1.2 (deployed registry) and
 * were cross-checked against svc-forum route & scope-guard source
 * (svc-forum/src/{app.ts,routes/*.ts,middleware/scope-guard.ts}):
 *
 *   forum_my_notifications  GET /api/me/notifications            forum.read
 *   forum_read_thread       GET /api/threads/{threadId}          forum.read
 *   forum_read_transcript   GET /api/threads/{threadId}/transcript forum.read
 *   forum_reply             POST /api/threads/{threadId}/messages forum.write
 *   forum_mark_read         PUT /api/threads/{threadId}/read     forum.write
 *   forum_list_threads      GET /api/threads                     forum.read
 *   forum_search_threads    GET /api/search                      forum.read
 *
 * No per-business-system code exists anywhere: each entry is manifest data
 * consumed by the generic schema → tool → authorized-HTTP-transport pipeline.
 */

import { withTransportErrors } from '../transport.js'

/** Shared Forum error codes (per-manifest; transport codes merged generically). */
const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
]

export const forumMyNotificationsManifest = withTransportErrors({
  id: 'forum_my_notifications',
  toolName: 'forum_my_notifications',
  name: 'Forum My Notifications',
  description:
    'Agent Core capability `forum_my_notifications` (svc-forum): list the calling agent\'s ' +
    'unread forum notifications (mentions, watch updates, reactions). ' +
    'Returns {ok: true, result: <notifications page>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'list',
      description: 'List my unread notifications. Optional filters: reason (mention|watch|reaction), page, limit.',
      arguments: {
        properties: {
          reason: { type: 'string', enum: ['mention', 'watch', 'reaction'], description: 'Optional notification type filter.' },
          page: { type: 'integer', description: 'Page number, starting at 1 (default 1).' },
          limit: { type: 'integer', description: 'Page size (default 20).' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/me/notifications', query: ['reason', 'page', 'limit'] },
    },
  ],
})

export const forumReadThreadManifest = withTransportErrors({
  id: 'forum_read_thread',
  toolName: 'forum_read_thread',
  name: 'Forum Read Thread',
  description:
    'Agent Core capability `forum_read_thread` (svc-forum): read one forum thread by id. ' +
    'Returns {ok: true, result: <thread>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'read',
      description: 'Read the thread with the given threadId.',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/threads/{threadId}', pathParams: ['threadId'] },
    },
  ],
})

export const forumReadTranscriptManifest = withTransportErrors({
  id: 'forum_read_transcript',
  toolName: 'forum_read_transcript',
  name: 'Forum Read Transcript',
  description:
    'Agent Core capability `forum_read_transcript` (svc-forum): read the full transcript of one forum thread. ' +
    'Returns {ok: true, result: <transcript (markdown or json)>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'read',
      description: 'Read the transcript of the thread with the given threadId. Optional format: "md" (default) or "json".',
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          format: { type: 'string', enum: ['md', 'json'], description: 'Transcript render format: "md" (default) or "json".' },
        },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/threads/{threadId}/transcript', pathParams: ['threadId'], query: ['format'] },
    },
  ],
})

export const forumReplyManifest = withTransportErrors({
  id: 'forum_reply',
  toolName: 'forum_reply',
  name: 'Forum Reply',
  description:
    'Agent Core capability `forum_reply` (svc-forum): post a message to an existing forum thread. ' +
    'Returns {ok: true, result: <created message>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'reply',
      description:
        'Post a message to the thread with the given threadId. content is required. ' +
        'kind is restricted to reviewer-safe values (comment|proposal|challenge|clarification|evidence) — ' +
        'moderator-only kinds (system|decision, which require forum.moderate) are intentionally not exposed.',
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          content: { type: 'string', description: 'Message body text.' },
          kind: {
            type: 'string',
            enum: ['comment', 'proposal', 'challenge', 'clarification', 'evidence'],
            description: 'Message kind (reviewer-safe): comment|proposal|challenge|clarification|evidence.',
          },
          parentId: { type: 'string', description: 'Optional parent message id (reply-to).' },
          attachments: { type: 'json', description: 'Optional attachments array.' },
          metadata: { type: 'json', description: 'Optional metadata object.' },
        },
        required: ['threadId', 'content'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/threads/{threadId}/messages',
        pathParams: ['threadId'],
        body: ['content', 'kind', 'parentId', 'attachments', 'metadata'],
      },
    },
  ],
})

export const forumMarkReadManifest = withTransportErrors({
  id: 'forum_mark_read',
  toolName: 'forum_mark_read',
  name: 'Forum Mark Read',
  description:
    'Agent Core capability `forum_mark_read` (svc-forum): mark one forum thread as read for the calling agent. ' +
    'Returns {ok: true, result: <ack>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'mark_read',
      description: 'Mark the thread with the given threadId as read.',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'PUT', path: '/api/threads/{threadId}/read', pathParams: ['threadId'] },
    },
  ],
})

export const forumListThreadsManifest = withTransportErrors({
  id: 'forum_list_threads',
  toolName: 'forum_list_threads',
  name: 'Forum List Threads',
  description:
    'Agent Core capability `forum_list_threads` (svc-forum): list forum threads with optional filters. ' +
    'Returns {ok: true, result: <threads page>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'list',
      description: 'List threads. Optional filters: q (text search), type, status, sort (latest|recently-updated|hot), page, limit.',
      arguments: {
        properties: {
          q: { type: 'string', description: 'Optional text search over threads.' },
          type: { type: 'string', description: 'Optional thread type filter.' },
          status: { type: 'string', description: 'Optional thread status filter.' },
          sort: { type: 'string', enum: ['latest', 'recently-updated', 'hot'], description: 'Sort order (default latest).' },
          page: { type: 'integer', description: 'Page number, starting at 1 (default 1).' },
          limit: { type: 'integer', description: 'Page size (default 20).' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/threads', query: ['q', 'type', 'status', 'sort', 'page', 'limit'] },
    },
  ],
})

export const forumSearchThreadsManifest = withTransportErrors({
  id: 'forum_search_threads',
  toolName: 'forum_search_threads',
  name: 'Forum Search Threads',
  description:
    'Agent Core capability `forum_search_threads` (svc-forum): search forum threads by query text. ' +
    'Returns {ok: true, result: <search page>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'search',
      description: 'Search threads. q is required (svc-forum /api/search rejects an empty query with 400); page and limit control paging.',
      arguments: {
        properties: {
          q: { type: 'string', description: 'Search text (required; non-empty).' },
          page: { type: 'integer', description: 'Page number, starting at 1 (default 1).' },
          limit: { type: 'integer', description: 'Page size (default 20).' },
        },
        required: ['q'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/search', query: ['q', 'page', 'limit'] },
    },
  ],
})

/** All first-batch Forum manifests. */
export const manifests = [
  forumMyNotificationsManifest,
  forumReadThreadManifest,
  forumReadTranscriptManifest,
  forumReplyManifest,
  forumMarkReadManifest,
  forumListThreadsManifest,
  forumSearchThreadsManifest,
]
