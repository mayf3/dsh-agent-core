\pset pager off
\echo '=== [1] all tables + row counts ==='
SELECT relname AS table_name, n_live_tup FROM pg_stat_user_tables ORDER BY relname;
\echo '=== [2] ALL non-internal triggers (name/table/enabled/fn/events) ==='
SELECT tgname, c.relname AS on_table, p.proname AS fn,
       CASE t.tgenabled WHEN 'O' THEN 'origin-enabled' WHEN 'D' THEN 'disabled' WHEN 'A' THEN 'always' WHEN 'R' THEN 'replica' END AS state,
       (t.tgtype & 2) > 0 AS before_row, (t.tgtype & 1) > 0 AS row_level, t.tgtfoid::regproc IS NOT NULL AS has_fn
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal ORDER BY c.relname, tgname;
\echo '=== [3] FK constraint stats ==='
SELECT count(*) AS total_fks,
       count(*) FILTER (WHERE confdeltype='a') AS no_action, count(*) FILTER (WHERE confdeltype='c') AS cascade,
       count(*) FILTER (WHERE confdeltype='r') AS restrict, count(*) FILTER (WHERE confdeltype='n') AS set_null,
       count(*) FILTER (WHERE consrc LIKE '%DEFERRABLE%' OR condeferrable) AS deferrable
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace;
\echo '=== [4] per-table rows inside claimed window [08:17:36.396306, 08:17:43.997024) ==='
SELECT 'principals' t, count(*) FROM principals WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'domains', count(*) FROM domains WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'domain_role_bindings', count(*) FROM domain_role_bindings WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'global_role_bindings', count(*) FROM global_role_bindings WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_definitions', count(*) FROM workflow_definitions WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_definition_versions', count(*) FROM workflow_definition_versions WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_node_definitions', count(*) FROM workflow_node_definitions WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_transition_definitions', count(*) FROM workflow_transition_definitions WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_instances', count(*) FROM workflow_instances WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_node_visits', count(*) FROM workflow_node_visits WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_context_revisions', count(*) FROM workflow_context_revisions WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_events', count(*) FROM workflow_events WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_command_receipts', count(*) FROM workflow_command_receipts WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_submissions', count(*) FROM workflow_submissions WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_command_attempt_audits', count(*) FROM workflow_command_attempt_audits WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_security_audits', count(*) FROM workflow_security_audits WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_instance_node_assignees', count(*) FROM workflow_instance_node_assignees WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_assistance_cases', count(*) FROM workflow_assistance_cases WHERE created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08';
\echo '=== [5] any 2026-08-29 writes OUTSIDE the minute 08:17 (whole-db, any table with created_at) ==='
SELECT count(*) AS writes_on_0829_outside_window FROM (
  SELECT created_at FROM principals WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM domains WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM domain_role_bindings WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM global_role_bindings WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_definitions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_definition_versions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_node_definitions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_transition_definitions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_instances WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_node_visits WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_context_revisions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_events WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_command_receipts WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_submissions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_command_attempt_audits WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_security_audits WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_instance_node_assignees WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
  UNION ALL SELECT created_at FROM workflow_assistance_cases WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36.396306+08' AND created_at < '2026-08-29 08:17:43.997024+08')
) s;
\echo '=== [6] global write extremes across 18 tables ==='
SELECT min(c) AS earliest_write, max(c) AS latest_write,
       max(c) FILTER (WHERE c < '2026-08-29 08:17:36.396306+08') AS last_business_write
FROM (
  SELECT created_at c FROM principals UNION ALL SELECT created_at FROM domains UNION ALL SELECT created_at FROM domain_role_bindings
  UNION ALL SELECT created_at FROM global_role_bindings UNION ALL SELECT created_at FROM workflow_definitions UNION ALL SELECT created_at FROM workflow_definition_versions
  UNION ALL SELECT created_at FROM workflow_node_definitions UNION ALL SELECT created_at FROM workflow_transition_definitions UNION ALL SELECT created_at FROM workflow_instances
  UNION ALL SELECT created_at FROM workflow_node_visits UNION ALL SELECT created_at FROM workflow_context_revisions UNION ALL SELECT created_at FROM workflow_events
  UNION ALL SELECT created_at FROM workflow_command_receipts UNION ALL SELECT created_at FROM workflow_submissions UNION ALL SELECT created_at FROM workflow_command_attempt_audits
  UNION ALL SELECT created_at FROM workflow_security_audits UNION ALL SELECT created_at FROM workflow_instance_node_assignees UNION ALL SELECT created_at FROM workflow_assistance_cases
) s;
\echo '=== [7] exact window bounds of the 224 rows (union over 13 non-empty tables) ==='
SELECT min(c) AS burst_min, max(c) AS burst_max FROM (
  SELECT created_at c FROM principals WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM domains WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM domain_role_bindings WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM global_role_bindings WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_definitions WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_definition_versions WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_node_definitions WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_transition_definitions WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_instances WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_node_visits WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_context_revisions WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_events WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
  UNION ALL SELECT created_at FROM workflow_command_receipts WHERE created_at >= '2026-08-29 08:17:00+08' AND created_at < '2026-08-29 08:18:00+08'
) s;
\pset pager off
\echo '=== [A] rows at EXACTLY 08:17:43.997024 (closed-burst-end boundary rows) ==='
SELECT 'workflow_instances' t, count(*) FROM workflow_instances WHERE created_at = '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_node_visits', count(*) FROM workflow_node_visits WHERE created_at = '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_context_revisions', count(*) FROM workflow_context_revisions WHERE created_at = '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_events', count(*) FROM workflow_events WHERE created_at = '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'workflow_command_receipts', count(*) FROM workflow_command_receipts WHERE created_at = '2026-08-29 08:17:43.997024+08'
UNION ALL SELECT 'principals', count(*) FROM principals WHERE created_at = '2026-08-29 08:17:43.997024+08';
\echo '=== [B] recount with RUNNER window [08:17:36+08, 08:17:45+08) ==='
SELECT 'principals' t, count(*) FROM principals WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'domains', count(*) FROM domains WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'domain_role_bindings', count(*) FROM domain_role_bindings WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'global_role_bindings', count(*) FROM global_role_bindings WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_definitions', count(*) FROM workflow_definitions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_definition_versions', count(*) FROM workflow_definition_versions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_node_definitions', count(*) FROM workflow_node_definitions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_transition_definitions', count(*) FROM workflow_transition_definitions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_instances', count(*) FROM workflow_instances WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_node_visits', count(*) FROM workflow_node_visits WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_context_revisions', count(*) FROM workflow_context_revisions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_events', count(*) FROM workflow_events WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_command_receipts', count(*) FROM workflow_command_receipts WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_submissions', count(*) FROM workflow_submissions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_command_attempt_audits', count(*) FROM workflow_command_attempt_audits WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_security_audits', count(*) FROM workflow_security_audits WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_instance_node_assignees', count(*) FROM workflow_instance_node_assignees WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_assistance_cases', count(*) FROM workflow_assistance_cases WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08';
\echo '=== [C] 2026-08-29 rows OUTSIDE runner window (must be 0) ==='
SELECT count(*) FROM (
  SELECT created_at FROM principals WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM domains WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM domain_role_bindings WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM global_role_bindings WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_definitions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_definition_versions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_node_definitions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_transition_definitions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_instances WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_node_visits WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_context_revisions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_events WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_command_receipts WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_submissions WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_command_attempt_audits WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_security_audits WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_instance_node_assignees WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
  UNION ALL SELECT created_at FROM workflow_assistance_cases WHERE created_at::date='2026-08-29' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
) s;
\pset pager off
\echo '=== [2-fix] ALL non-internal triggers ==='
SELECT tgname, c.relname AS on_table, p.proname AS fn,
       CASE t.tgenabled WHEN 'O' THEN 'origin-enabled' WHEN 'D' THEN 'DISABLED' WHEN 'A' THEN 'always' WHEN 'R' THEN 'replica' END AS state,
       (t.tgtype & 2) > 0 AS is_before, (t.tgtype & 1) > 0 AS is_row_level
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal ORDER BY c.relname, tgname;
\echo '=== [3-fix] FK stats ==='
SELECT count(*) AS total_fks,
       count(*) FILTER (WHERE confdeltype='a') AS no_action, count(*) FILTER (WHERE confdeltype='c') AS cascade,
       count(*) FILTER (WHERE confdeltype='r') AS restrict, count(*) FILTER (WHERE confdeltype='n') AS set_null,
       count(*) FILTER (WHERE condeferrable) AS deferrable, count(*) FILTER (WHERE condeferred) AS deferred_default
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace;
\echo '=== [8] in-window receipt keys (all 25) ==='
SELECT idempotency_key, receipt_status, count(*) FROM workflow_command_receipts
WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
GROUP BY 1,2 ORDER BY 1;
\echo '=== [9] uuid-format create keys: in vs out of window ==='
SELECT count(*) FILTER (WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08') AS in_window,
       count(*) FILTER (WHERE NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')) AS out_window
FROM workflow_command_receipts WHERE idempotency_key ~ '^create-[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';
\echo '=== [10] fixed test keys anywhere in DB (lifetime), by in/out window ==='
SELECT idempotency_key,
       count(*) FILTER (WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08') AS in_window,
       count(*) FILTER (WHERE NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')) AS out_window
FROM workflow_command_receipts
WHERE idempotency_key IN ('grant-global-1','revoke-global-1','transition-coord-1','grant-reader-1','revoke-reader-1','reader-denied-transition-1',
                          'grant-global-2','grant-reader-2','cancel-coord-1','archive-coord-1','reader-denied-create-1','reader-denied-owner-1','reader-denied-cancel-1','reader-denied-archive-1')
GROUP BY 1 ORDER BY 1;
\echo '=== [11] out-of-window lookalike scan (LIFETIME, any time) ==='
SELECT 'principals Test User/Agent' what, count(*) FROM principals WHERE display_name IN ('Test User','Test Agent') AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'principals email=test@example.com', count(*) FROM principals WHERE email='test@example.com' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'domains test-domain-%', count(*) FROM domains WHERE domain_key LIKE 'test-domain-%' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'defs global-test-%', count(*) FROM workflow_definitions WHERE definition_key LIKE 'global-test-%' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'defs test-def-%', count(*) FROM workflow_definitions WHERE definition_key LIKE 'test-def-%' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'defs display=Global Test Def', count(*) FROM workflow_definitions WHERE display_name='Global Test Def' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'global bindings READER (out of window)', count(*) FROM global_role_bindings WHERE role_key='GLOBAL_WORKFLOW_READER' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08')
UNION ALL SELECT 'global bindings COORDINATOR (out of window, historical business)', count(*) FROM global_role_bindings WHERE role_key='GLOBAL_WORKFLOW_COORDINATOR' AND NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08');
\echo '=== [12] in-window global binding split ==='
SELECT role_key, enabled, count(*) FROM global_role_bindings WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' GROUP BY 1,2 ORDER BY 1,2;
\echo '=== [13] historical business global bindings (6 expected, must NOT match allowlist) ==='
SELECT binding_id, principal_id, role_key, enabled, created_at FROM global_role_bindings WHERE NOT (created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08') ORDER BY created_at;
\echo '=== [14] in-window context titles (19, sorted) ==='
SELECT context_payload->>'title' AS title, count(*) FROM workflow_context_revisions
WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' GROUP BY 1 ORDER BY 1;
\echo '=== [15] in-window events type split / visits shape / revisions shape ==='
SELECT event_type, count(*) FROM workflow_events WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' GROUP BY 1;
SELECT 'visits: non-1 visit_number' k, count(*) FROM workflow_node_visits WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' AND visit_number <> 1
UNION ALL SELECT 'visits: entered_by NOT NULL', count(*) FROM workflow_node_visits WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' AND entered_by_transition_id IS NOT NULL
UNION ALL SELECT 'revisions: non-1 revision_number', count(*) FROM workflow_context_revisions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' AND revision_number <> 1
UNION ALL SELECT 'revisions: previous NOT NULL', count(*) FROM workflow_context_revisions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' AND previous_revision_id IS NOT NULL
UNION ALL SELECT 'instances: cancelled', count(*) FROM workflow_instances WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' AND cancelled
UNION ALL SELECT 'instances: archived', count(*) FROM workflow_instances WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08' AND archived_at IS NOT NULL;
\pset pager off
\echo '=== [16] the CASCADE FK ==='
SELECT conname, conrelid::regclass AS on_table, confrelid::regclass AS refs_table, pg_get_constraintdef(oid) AS def
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND confdeltype='c';
\echo '=== [17] the 12 DEFERRABLE FKs ==='
SELECT conname, conrelid::regclass AS on_table, confrelid::regclass AS refs_table, condeferrable, condeferred
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND condeferrable ORDER BY conname;
\echo '=== [18] workflow_context_revisions columns ==='
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='workflow_context_revisions' ORDER BY ordinal_position;
\pset pager off
\set w0 '''2026-08-29 08:17:36+08'''
\set w1 '''2026-08-29 08:17:45+08'''
\echo '=== [19] 60-FK two-directional isolation (fully inline, window subqueries) ==='
DO $$
DECLARE r record; i int; joinc text; notnullc text; qa int; qb int;
  pkmap jsonb := '{"principals":"principal_id","domains":"domain_id","domain_role_bindings":"binding_id",
   "global_role_bindings":"binding_id","workflow_definitions":"workflow_definition_id",
   "workflow_definition_versions":"definition_version_id","workflow_node_definitions":"node_id",
   "workflow_transition_definitions":"transition_id","workflow_instances":"workflow_instance_id",
   "workflow_node_visits":"node_visit_id","workflow_context_revisions":"context_revision_id",
   "workflow_events":"event_id","workflow_command_receipts":"command_id"}';
  wtab text; dstw text; srcw text; spk text; in13src bool; in13dst bool;
  total_a int := 0; total_b int := 0; n int := 0; bad int := 0;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass::text src, c.confrelid::regclass::text dst,
      (SELECT array_agg(a.attname ORDER BY o.ord) FROM unnest(c.conkey) WITH ORDINALITY o(attnum,ord)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=o.attnum) scols,
      (SELECT array_agg(b.attname ORDER BY o.ord) FROM unnest(c.confkey) WITH ORDINALITY o(attnum,ord)
        JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=o.attnum) dcols
    FROM pg_constraint c WHERE c.contype='f' AND c.connamespace='public'::regnamespace
  LOOP
    n := n + 1;
    joinc := ''; notnullc := '';
    FOR i IN 1..array_length(r.scols,1) LOOP
      joinc := joinc || format('s.%I = d.%I', r.scols[i], r.dcols[i]);
      notnullc := notnullc || format('s.%I IS NOT NULL', r.scols[i]);
      IF i < array_length(r.scols,1) THEN joinc := joinc || ' AND '; notnullc := notnullc || ' AND '; END IF;
    END LOOP;
    in13src := pkmap ? r.src; in13dst := pkmap ? r.dst;
    -- window-set subquery for dst (if dst is one of the 13 tables)
    IF in13dst THEN
      DECLARE dcols_list text := '';
      BEGIN
        FOR i IN 1..array_length(r.dcols,1) LOOP
          IF i = 1 THEN dcols_list := format('%I', r.dcols[i]); ELSE dcols_list := dcols_list || ', ' || format('%I', r.dcols[i]); END IF;
        END LOOP;
        dstw := format('(SELECT %s FROM %I WHERE created_at >= %L AND created_at < %L)', dcols_list, r.dst, '2026-08-29 08:17:36+08', '2026-08-29 08:17:45+08');
      END;
    END IF;
    -- DirA: window row of src (all FK cols non-null) referencing a row OUTSIDE the window set of dst
    IF in13src AND in13dst THEN
      spk := pkmap->>r.src;
      srcw := format('created_at >= %L AND created_at < %L', '2026-08-29 08:17:36+08', '2026-08-29 08:17:45+08');
      EXECUTE format('SELECT count(*) FROM %I s WHERE %s AND %s AND NOT EXISTS (SELECT 1 FROM %s d WHERE %s)',
                     r.src, srcw, notnullc, dstw, joinc) INTO qa;
    ELSIF in13src AND NOT in13dst THEN
      srcw := format('created_at >= %L AND created_at < %L', '2026-08-29 08:17:36+08', '2026-08-29 08:17:45+08');
      EXECUTE format('SELECT count(*) FROM %I s WHERE %s AND %s AND EXISTS (SELECT 1 FROM %I d WHERE %s)',
                     r.src, srcw, notnullc, r.dst, joinc) INTO qa;
    ELSE qa := 0; END IF;
    -- DirB: row OUTSIDE the window set of src (or any row if src not among the 13) referencing a window row of dst
    IF in13dst THEN
      IF in13src THEN
        spk := pkmap->>r.src;
        srcw := format('NOT (created_at >= %L AND created_at < %L)', '2026-08-29 08:17:36+08', '2026-08-29 08:17:45+08');
        EXECUTE format('SELECT count(*) FROM %I s WHERE %s AND EXISTS (SELECT 1 FROM %s d WHERE %s)',
                       r.src, srcw, dstw, joinc) INTO qb;
      ELSE
        EXECUTE format('SELECT count(*) FROM %I s WHERE EXISTS (SELECT 1 FROM %s d WHERE %s)',
                       r.src, dstw, joinc) INTO qb;
      END IF;
    ELSE qb := 0; END IF;
    total_a := total_a + qa; total_b := total_b + qb;
    IF qa <> 0 OR qb <> 0 THEN
      bad := bad + 1;
      RAISE NOTICE 'VIOLATION %: %.% -> %  dirA=% dirB=%', r.conname, r.src, r.scols, r.dst, qa, qb;
    END IF;
  END LOOP;
  RAISE NOTICE 'RESULT constraints=% total_dirA=% total_dirB=% violating_constraints=%', n, total_a, total_b, bad;
END $$;
\echo '=== [20] window ID dump (tbl|id), for 3-way comparison ==='
SELECT 'principals' tbl, principal_id::text id FROM principals WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'domains', domain_id::text FROM domains WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'domain_role_bindings', binding_id::text FROM domain_role_bindings WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'global_role_bindings', binding_id::text FROM global_role_bindings WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_definitions', workflow_definition_id::text FROM workflow_definitions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_definition_versions', definition_version_id::text FROM workflow_definition_versions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_node_definitions', node_id::text FROM workflow_node_definitions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_transition_definitions', transition_id::text FROM workflow_transition_definitions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_instances', workflow_instance_id::text FROM workflow_instances WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_node_visits', node_visit_id::text FROM workflow_node_visits WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_context_revisions', context_revision_id::text FROM workflow_context_revisions WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_events', event_id::text FROM workflow_events WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
UNION ALL SELECT 'workflow_command_receipts', command_id::text FROM workflow_command_receipts WHERE created_at >= '2026-08-29 08:17:36+08' AND created_at < '2026-08-29 08:17:45+08'
ORDER BY 1, 2;
\pset pager off
SELECT 'principals' t, count(*), md5(coalesce(string_agg(principal_id::text, ',' ORDER BY principal_id::text), '')) FROM principals
UNION ALL SELECT 'domains', count(*), md5(coalesce(string_agg(domain_id::text, ',' ORDER BY domain_id::text), '')) FROM domains
UNION ALL SELECT 'domain_role_bindings', count(*), md5(coalesce(string_agg(binding_id::text, ',' ORDER BY binding_id::text), '')) FROM domain_role_bindings
UNION ALL SELECT 'global_role_bindings', count(*), md5(coalesce(string_agg(binding_id::text, ',' ORDER BY binding_id::text), '')) FROM global_role_bindings
UNION ALL SELECT 'workflow_definitions', count(*), md5(coalesce(string_agg(workflow_definition_id::text, ',' ORDER BY workflow_definition_id::text), '')) FROM workflow_definitions
UNION ALL SELECT 'workflow_definition_versions', count(*), md5(coalesce(string_agg(definition_version_id::text, ',' ORDER BY definition_version_id::text), '')) FROM workflow_definition_versions
UNION ALL SELECT 'workflow_node_definitions', count(*), md5(coalesce(string_agg(node_id::text, ',' ORDER BY node_id::text), '')) FROM workflow_node_definitions
UNION ALL SELECT 'workflow_transition_definitions', count(*), md5(coalesce(string_agg(transition_id::text, ',' ORDER BY transition_id::text), '')) FROM workflow_transition_definitions
UNION ALL SELECT 'workflow_instances', count(*), md5(coalesce(string_agg(workflow_instance_id::text, ',' ORDER BY workflow_instance_id::text), '')) FROM workflow_instances
UNION ALL SELECT 'workflow_node_visits', count(*), md5(coalesce(string_agg(node_visit_id::text, ',' ORDER BY node_visit_id::text), '')) FROM workflow_node_visits
UNION ALL SELECT 'workflow_context_revisions', count(*), md5(coalesce(string_agg(context_revision_id::text, ',' ORDER BY context_revision_id::text), '')) FROM workflow_context_revisions
UNION ALL SELECT 'workflow_events', count(*), md5(coalesce(string_agg(event_id::text, ',' ORDER BY event_id::text), '')) FROM workflow_events
UNION ALL SELECT 'workflow_command_receipts', count(*), md5(coalesce(string_agg(command_id::text, ',' ORDER BY command_id::text), '')) FROM workflow_command_receipts
UNION ALL SELECT 'workflow_submissions', count(*), md5(coalesce(string_agg(submission_id::text, ',' ORDER BY submission_id::text), '')) FROM workflow_submissions
UNION ALL SELECT 'workflow_command_attempt_audits', count(*), md5(coalesce(string_agg(audit_id::text, ',' ORDER BY audit_id::text), '')) FROM workflow_command_attempt_audits
UNION ALL SELECT 'workflow_security_audits', count(*), md5(coalesce(string_agg(audit_id::text, ',' ORDER BY audit_id::text), '')) FROM workflow_security_audits
UNION ALL SELECT 'workflow_instance_node_assignees', count(*), md5(coalesce(string_agg(workflow_instance_id::text || '#' || node_key, ',' ORDER BY workflow_instance_id::text || '#' || node_key), '')) FROM workflow_instance_node_assignees
UNION ALL SELECT 'workflow_assistance_cases', count(*), md5(coalesce(string_agg(assistance_case_id::text, ',' ORDER BY assistance_case_id::text), '')) FROM workflow_assistance_cases
ORDER BY 1;
SELECT 'TRIGGERS', string_agg(tgname || ':' || tgenabled, ' ' ORDER BY tgname) FROM pg_trigger WHERE NOT tgisinternal;
SELECT 'MAXTS', max(c) FROM (SELECT created_at c FROM principals UNION ALL SELECT created_at FROM workflow_events UNION ALL SELECT created_at FROM workflow_command_receipts UNION ALL SELECT created_at FROM workflow_instances UNION ALL SELECT created_at FROM workflow_node_visits UNION ALL SELECT created_at FROM workflow_context_revisions UNION ALL SELECT created_at FROM domains UNION ALL SELECT created_at FROM domain_role_bindings UNION ALL SELECT created_at FROM global_role_bindings UNION ALL SELECT created_at FROM workflow_definitions UNION ALL SELECT created_at FROM workflow_definition_versions UNION ALL SELECT created_at FROM workflow_node_definitions UNION ALL SELECT created_at FROM workflow_transition_definitions UNION ALL SELECT created_at FROM workflow_submissions UNION ALL SELECT created_at FROM workflow_command_attempt_audits UNION ALL SELECT created_at FROM workflow_security_audits UNION ALL SELECT created_at FROM workflow_instance_node_assignees UNION ALL SELECT created_at FROM workflow_assistance_cases) s;
