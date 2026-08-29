/**
 * @agent-core/broker — Forum moderator-pack manifests
 * (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 CTR-FMC-003/004).
 *
 * Pure DATA (JSON-serializable) describing the eight moderator Forum tools.
 * Registered in child mode ONLY when the process's exact DSH_AGENT_ID is a
 * member of the closed `forumModeratorAgentIds` config (CTR-FMC-004); gateway
 * mode always retains them (CTR-FMC-016 trusted control plane).
 */

import { withTransportErrors } from '../transport.js'

/** Shared Forum error codes (per-manifest; transport codes merged generically). */
const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
  { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
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
