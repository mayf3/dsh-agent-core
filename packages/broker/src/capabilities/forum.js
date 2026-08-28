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

// ── AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1 (accepted) ───────────────────
//
// Second-batch Forum capabilities, still pure manifest data over the SAME
// generic pipeline. Route/scope facts are pinned to the deployed consumer
// svc-forum@502cfca5 (see the Spec §3.1 / §9.1):
//
// Normal pack (every Agent child; scopes follow the deployed guards):
//   forum_create_thread     POST   /api/threads                       forum.write
//   forum_watch_thread      PUT    /api/threads/{threadId}/watch      forum.write
//   forum_unwatch_thread    DELETE /api/threads/{threadId}/watch      forum.write
//   forum_report_content    POST   /api/reports                       forum.write
//   forum_stats             GET    /api/stats                         forum.read
//
// Moderator pack (registered ONLY for the closed forumModeratorAgentIds list;
// every manifest requires all three scopes — resolve/archive are deliberately
// Broker-side narrowed to the moderator pack per CTR-FMC-009 even though the
// deployed server guards them with forum.write alone):
//   forum_pin_or_feature_thread  PATCH  /api/threads/{threadId}                      (pinned|featured body; server inline-checks forum.moderate)
//   forum_delete_thread          DELETE /api/threads/{threadId}                      forum.moderate+forum.write (soft delete)
//   forum_delete_message         DELETE /api/threads/{threadId}/messages/{messageId} forum.moderate+forum.write (soft delete)
//   forum_resolve_thread         POST   /api/threads/{threadId}/resolve               summaryMd REQUIRED nonBlank
//   forum_archive_thread         POST   /api/threads/{threadId}/archive
//   forum_moderation_queue       GET    /api/reports                                   forum.moderate
//   forum_handle_report          PATCH  /api/reports/{reportId}                       action enum ignore|warn|delete
//   forum_admin_unread           GET    /api/admin/notifications/unread               forum.moderate (NOT forum.admin — no deployed route uses it)

export const forumCreateThreadManifest = withTransportErrors({
  id: 'forum_create_thread',
  toolName: 'forum_create_thread',
  name: 'Forum Create Thread',
  description:
    'Agent Core capability `forum_create_thread` (svc-forum): create a new forum thread. ' +
    'The caller is always added as the creator participant; identity comes from the credential, never from arguments. ' +
    'Returns {ok: true, result: <thread>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'create',
      description:
        'Create a thread. title is required (non-blank). Optional: type (server default discussion), contextType, ' +
        'contextId, pipeline, layer, tags (string[]), participants ({agentId, agentName, role?, status?}[]).',
      arguments: {
        properties: {
          title: { type: 'string', nonBlank: true, description: 'Thread title (required, non-blank).' },
          type: { type: 'string', description: 'Thread type (server default: discussion).' },
          contextType: { type: 'string', description: 'Optional context type.' },
          contextId: { type: 'string', description: 'Optional context id.' },
          pipeline: { type: 'string', description: 'Optional pipeline.' },
          layer: { type: 'string', description: 'Optional layer.' },
          tags: { type: 'json', description: 'Optional tags array (server-validated).' },
          participants: { type: 'json', description: 'Optional participants array (server-validated).' },
        },
        required: ['title'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/threads',
        body: ['title', 'type', 'contextType', 'contextId', 'pipeline', 'layer', 'tags', 'participants'],
      },
    },
  ],
})

export const forumWatchThreadManifest = withTransportErrors({
  id: 'forum_watch_thread',
  toolName: 'forum_watch_thread',
  name: 'Forum Watch Thread',
  description:
    'Agent Core capability `forum_watch_thread` (svc-forum): watch a thread for the calling agent (idempotent). ' +
    'Returns {ok: true, result: <participant>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'watch',
      description: 'Start watching the thread with the given threadId (idempotent; identity = caller).',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'PUT', path: '/api/threads/{threadId}/watch', pathParams: ['threadId'] },
    },
  ],
})

export const forumUnwatchThreadManifest = withTransportErrors({
  id: 'forum_unwatch_thread',
  toolName: 'forum_unwatch_thread',
  name: 'Forum Unwatch Thread',
  description:
    'Agent Core capability `forum_unwatch_thread` (svc-forum): stop watching a thread for the calling agent. ' +
    'Returns {ok: true, result: <participant>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'unwatch',
      description: 'Stop watching the thread with the given threadId (404 when not watching).',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'DELETE', path: '/api/threads/{threadId}/watch', pathParams: ['threadId'] },
    },
  ],
})

export const forumReportContentManifest = withTransportErrors({
  id: 'forum_report_content',
  toolName: 'forum_report_content',
  name: 'Forum Report Content',
  description:
    'Agent Core capability `forum_report_content` (svc-forum): report a thread or message to the moderation queue. ' +
    'Returns {ok: true, result: <report>} on success.',
  requiredScopes: ['forum.write'],
  errors: baseErrors,
  operations: [
    {
      name: 'report',
      description:
        'Report content. targetType (thread|message), targetId and reason (spam|abuse|off_topic|violation|other) ' +
        'are required; note is optional. Duplicate reports by the same caller are rejected server-side (409).',
      arguments: {
        properties: {
          targetType: { type: 'string', enum: ['thread', 'message'], description: 'Reported content type.' },
          targetId: { type: 'string', description: 'Reported thread or message id.' },
          reason: {
            type: 'string',
            enum: ['spam', 'abuse', 'off_topic', 'violation', 'other'],
            description: 'Report reason.',
          },
          note: { type: 'string', description: 'Optional free-text note.' },
        },
        required: ['targetType', 'targetId', 'reason'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/reports',
        body: ['targetType', 'targetId', 'reason', 'note'],
      },
    },
  ],
})

export const forumStatsManifest = withTransportErrors({
  id: 'forum_stats',
  toolName: 'forum_stats',
  name: 'Forum Stats',
  description:
    'Agent Core capability `forum_stats` (svc-forum): read aggregate forum statistics. ' +
    'Returns {ok: true, result: <stats>} on success.',
  requiredScopes: ['forum.read'],
  errors: baseErrors,
  operations: [
    {
      name: 'stats',
      description: 'Read forum stats (threads by status/type, message totals, participants, reply rate). No arguments.',
      arguments: { properties: {}, required: [] },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/stats' },
    },
  ],
})

/** Normal second-batch Forum manifests (registered for every Agent child). */
export const normalManifests = [
  forumCreateThreadManifest,
  forumWatchThreadManifest,
  forumUnwatchThreadManifest,
  forumReportContentManifest,
  forumStatsManifest,
]

const moderatorScopes = ['forum.read', 'forum.write', 'forum.moderate']
const moderatorErrors = baseErrors

export const forumPinOrFeatureThreadManifest = withTransportErrors({
  id: 'forum_pin_or_feature_thread',
  toolName: 'forum_pin_or_feature_thread',
  name: 'Forum Pin Or Feature Thread',
  description:
    'Agent Core moderator capability `forum_pin_or_feature_thread` (svc-forum): pin or feature a thread via the ' +
    'deployed PATCH endpoint (server inline-checks forum.moderate for pinned/featured). ' +
    'Returns {ok: true, result: <thread>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'set_pinned',
      description: "Set or clear the thread's pinned flag.",
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          pinned: { type: 'boolean', description: 'New pinned value.' },
        },
        required: ['threadId', 'pinned'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'PATCH', path: '/api/threads/{threadId}', pathParams: ['threadId'], body: ['pinned'] },
    },
    {
      name: 'set_featured',
      description: "Set or clear the thread's featured flag.",
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          featured: { type: 'boolean', description: 'New featured value.' },
        },
        required: ['threadId', 'featured'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'PATCH', path: '/api/threads/{threadId}', pathParams: ['threadId'], body: ['featured'] },
    },
  ],
})

export const forumDeleteThreadManifest = withTransportErrors({
  id: 'forum_delete_thread',
  toolName: 'forum_delete_thread',
  name: 'Forum Delete Thread',
  description:
    'Agent Core moderator capability `forum_delete_thread` (svc-forum): soft-delete a thread via the deployed ' +
    'DELETE endpoint (status -> "deleted"; no hard-delete seam). ' +
    'Returns {ok: true, result: <thread>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'delete_thread',
      description: 'Soft-delete the thread with the given threadId.',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'DELETE', path: '/api/threads/{threadId}', pathParams: ['threadId'] },
    },
  ],
})

export const forumDeleteMessageManifest = withTransportErrors({
  id: 'forum_delete_message',
  toolName: 'forum_delete_message',
  name: 'Forum Delete Message',
  description:
    'Agent Core moderator capability `forum_delete_message` (svc-forum): soft-delete one message via the deployed ' +
    'DELETE endpoint (deletedAt timestamp; no hard-delete seam). ' +
    'Returns {ok: true, result: <ack>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'delete_message',
      description: 'Soft-delete one message of a thread.',
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          messageId: { type: 'string', description: 'Message id to delete.' },
        },
        required: ['threadId', 'messageId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'DELETE',
        path: '/api/threads/{threadId}/messages/{messageId}',
        pathParams: ['threadId', 'messageId'],
      },
    },
  ],
})

export const forumResolveThreadManifest = withTransportErrors({
  id: 'forum_resolve_thread',
  toolName: 'forum_resolve_thread',
  name: 'Forum Resolve Thread',
  description:
    'Agent Core moderator capability `forum_resolve_thread` (svc-forum): resolve a thread with a required ' +
    'outcome summary (summaryMd, non-blank; rejected locally before any token/HTTP call). ' +
    'Returns {ok: true, result: <thread>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'resolve',
      description:
        'Resolve the thread. summaryMd is required and must be non-blank. Optional structured outcome JSON ' +
        'fields (decisionsJson, actionItemsJson, rejectedOptionsJson, openQuestionsJson) pass through as named body fields.',
      arguments: {
        properties: {
          threadId: { type: 'string', description: 'Forum thread id.' },
          summaryMd: { type: 'string', nonBlank: true, description: 'Outcome summary in Markdown (required, non-blank).' },
          decisionsJson: { type: 'json', description: 'Optional decisions JSON.' },
          actionItemsJson: { type: 'json', description: 'Optional action items JSON.' },
          rejectedOptionsJson: { type: 'json', description: 'Optional rejected options JSON.' },
          openQuestionsJson: { type: 'json', description: 'Optional open questions JSON.' },
        },
        required: ['threadId', 'summaryMd'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'POST',
        path: '/api/threads/{threadId}/resolve',
        pathParams: ['threadId'],
        body: ['summaryMd', 'decisionsJson', 'actionItemsJson', 'rejectedOptionsJson', 'openQuestionsJson'],
      },
    },
  ],
})

export const forumArchiveThreadManifest = withTransportErrors({
  id: 'forum_archive_thread',
  toolName: 'forum_archive_thread',
  name: 'Forum Archive Thread',
  description:
    'Agent Core moderator capability `forum_archive_thread` (svc-forum): archive a thread (status -> "archived"). ' +
    'Returns {ok: true, result: <thread>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'archive',
      description: 'Archive the thread with the given threadId (no body).',
      arguments: {
        properties: { threadId: { type: 'string', description: 'Forum thread id.' } },
        required: ['threadId'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'POST', path: '/api/threads/{threadId}/archive', pathParams: ['threadId'] },
    },
  ],
})

export const forumModerationQueueManifest = withTransportErrors({
  id: 'forum_moderation_queue',
  toolName: 'forum_moderation_queue',
  name: 'Forum Moderation Queue',
  description:
    'Agent Core moderator capability `forum_moderation_queue` (svc-forum): list moderation reports. ' +
    'Pending queue = status=pending. Returns {ok: true, result: <reports page>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'list',
      description:
        'List reports. Optional filters: status (pending|ignored|warned|deleted), targetType (thread|message), page, limit.',
      arguments: {
        properties: {
          status: { type: 'string', enum: ['pending', 'ignored', 'warned', 'deleted'], description: 'Optional report status filter.' },
          targetType: { type: 'string', enum: ['thread', 'message'], description: 'Optional reported-content type filter.' },
          page: { type: 'integer', description: 'Page number, starting at 1 (default 1).' },
          limit: { type: 'integer', description: 'Page size (default 20, server-capped 100).' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/reports', query: ['status', 'targetType', 'page', 'limit'] },
    },
  ],
})

export const forumHandleReportManifest = withTransportErrors({
  id: 'forum_handle_report',
  toolName: 'forum_handle_report',
  name: 'Forum Handle Report',
  description:
    'Agent Core moderator capability `forum_handle_report` (svc-forum): handle one pending report with exactly one ' +
    'of ignore|warn|delete (delete soft-deletes the reported content server-side). ' +
    'Returns {ok: true, result: <report>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'handle',
      description:
        'Handle a report. action is required and restricted to ignore|warn|delete (validated locally); note is optional. ' +
        'Only pending reports are actionable (409 otherwise).',
      arguments: {
        properties: {
          reportId: { type: 'string', description: 'Report id.' },
          action: { type: 'string', enum: ['ignore', 'warn', 'delete'], description: 'Handling action (closed enum).' },
          note: { type: 'string', description: 'Optional handling note.' },
        },
        required: ['reportId', 'action'],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc-forum',
        method: 'PATCH',
        path: '/api/reports/{reportId}',
        pathParams: ['reportId'],
        body: ['action', 'note'],
      },
    },
  ],
})

export const forumAdminUnreadManifest = withTransportErrors({
  id: 'forum_admin_unread',
  toolName: 'forum_admin_unread',
  name: 'Forum Admin Unread',
  description:
    'Agent Core moderator capability `forum_admin_unread` (svc-forum): global aggregated unread notification view ' +
    'across agents (deployed admin plane guards with forum.moderate; forum.admin does not exist). ' +
    'Returns {ok: true, result: <aggregated unread>} on success.',
  requiredScopes: moderatorScopes,
  errors: moderatorErrors,
  operations: [
    {
      name: 'unread',
      description:
        'Read the aggregated admin unread view. Optional filters: reason (mention|watch), since (ISO8601), ' +
        'agentId (single-agent business filter — never caller identity).',
      arguments: {
        properties: {
          reason: { type: 'string', enum: ['mention', 'watch'], description: 'Optional notification reason filter.' },
          since: { type: 'string', description: 'Optional ISO8601 timestamp lower bound.' },
          agentId: { type: 'string', description: 'Optional single-agent business filter (not caller identity).' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/admin/notifications/unread', query: ['reason', 'since', 'agentId'] },
    },
  ],
})

/** Moderator Forum manifests (registered only for the closed moderator list). */
export const moderatorManifests = [
  forumPinOrFeatureThreadManifest,
  forumDeleteThreadManifest,
  forumDeleteMessageManifest,
  forumResolveThreadManifest,
  forumArchiveThreadManifest,
  forumModerationQueueManifest,
  forumHandleReportManifest,
  forumAdminUnreadManifest,
]
