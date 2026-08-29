\set QUIET ON
\pset pager off
\pset tuples_only on
\echo '=== 18-table whole-table count+md5 (sorted row ids) ==='
SELECT 'principals|'||count(*)||'|'||md5(coalesce(string_agg(principal_id::text, ',' ORDER BY principal_id::text),'')) FROM principals
UNION ALL SELECT 'domains|'||count(*)||'|'||md5(coalesce(string_agg(domain_id::text, ',' ORDER BY domain_id::text),'')) FROM domains
UNION ALL SELECT 'domain_role_bindings|'||count(*)||'|'||md5(coalesce(string_agg(binding_id::text, ',' ORDER BY binding_id::text),'')) FROM domain_role_bindings
UNION ALL SELECT 'global_role_bindings|'||count(*)||'|'||md5(coalesce(string_agg(binding_id::text, ',' ORDER BY binding_id::text),'')) FROM global_role_bindings
UNION ALL SELECT 'workflow_definitions|'||count(*)||'|'||md5(coalesce(string_agg(workflow_definition_id::text, ',' ORDER BY workflow_definition_id::text),'')) FROM workflow_definitions
UNION ALL SELECT 'workflow_definition_versions|'||count(*)||'|'||md5(coalesce(string_agg(definition_version_id::text, ',' ORDER BY definition_version_id::text),'')) FROM workflow_definition_versions
UNION ALL SELECT 'workflow_node_definitions|'||count(*)||'|'||md5(coalesce(string_agg(node_id::text, ',' ORDER BY node_id::text),'')) FROM workflow_node_definitions
UNION ALL SELECT 'workflow_transition_definitions|'||count(*)||'|'||md5(coalesce(string_agg(transition_id::text, ',' ORDER BY transition_id::text),'')) FROM workflow_transition_definitions
UNION ALL SELECT 'workflow_instances|'||count(*)||'|'||md5(coalesce(string_agg(workflow_instance_id::text, ',' ORDER BY workflow_instance_id::text),'')) FROM workflow_instances
UNION ALL SELECT 'workflow_node_visits|'||count(*)||'|'||md5(coalesce(string_agg(node_visit_id::text, ',' ORDER BY node_visit_id::text),'')) FROM workflow_node_visits
UNION ALL SELECT 'workflow_context_revisions|'||count(*)||'|'||md5(coalesce(string_agg(context_revision_id::text, ',' ORDER BY context_revision_id::text),'')) FROM workflow_context_revisions
UNION ALL SELECT 'workflow_events|'||count(*)||'|'||md5(coalesce(string_agg(event_id::text, ',' ORDER BY event_id::text),'')) FROM workflow_events
UNION ALL SELECT 'workflow_command_receipts|'||count(*)||'|'||md5(coalesce(string_agg(command_id::text, ',' ORDER BY command_id::text),'')) FROM workflow_command_receipts
UNION ALL SELECT 'workflow_submissions|'||count(*)||'|'||md5(coalesce(string_agg(submission_id::text, ',' ORDER BY submission_id::text),'')) FROM workflow_submissions
UNION ALL SELECT 'workflow_command_attempt_audits|'||count(*)||'|'||md5(coalesce(string_agg(audit_id::text, ',' ORDER BY audit_id::text),'')) FROM workflow_command_attempt_audits
UNION ALL SELECT 'workflow_security_audits|'||count(*)||'|'||md5(coalesce(string_agg(audit_id::text, ',' ORDER BY audit_id::text),'')) FROM workflow_security_audits
UNION ALL SELECT 'workflow_instance_node_assignees|'||count(*)||'|'||md5(coalesce(string_agg(workflow_instance_id::text||'#'||node_key, ',' ORDER BY workflow_instance_id::text||'#'||node_key),'')) FROM workflow_instance_node_assignees
UNION ALL SELECT 'workflow_assistance_cases|'||count(*)||'|'||md5(coalesce(string_agg(assistance_case_id::text, ',' ORDER BY assistance_case_id::text),'')) FROM workflow_assistance_cases
ORDER BY 1;
\echo '=== 18 non-internal trigger states ==='
SELECT tgname||' on '||c.relname||' => '||t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT tgisinternal ORDER BY c.relname, tgname;
\echo '=== global max created_at (whole db) ==='
SELECT max(c) FROM (
  SELECT created_at c FROM principals UNION ALL SELECT created_at FROM domains UNION ALL SELECT created_at FROM domain_role_bindings
  UNION ALL SELECT created_at FROM global_role_bindings UNION ALL SELECT created_at FROM workflow_definitions UNION ALL SELECT created_at FROM workflow_definition_versions
  UNION ALL SELECT created_at FROM workflow_node_definitions UNION ALL SELECT created_at FROM workflow_transition_definitions UNION ALL SELECT created_at FROM workflow_instances
  UNION ALL SELECT created_at FROM workflow_node_visits UNION ALL SELECT created_at FROM workflow_context_revisions UNION ALL SELECT created_at FROM workflow_events
  UNION ALL SELECT created_at FROM workflow_command_receipts UNION ALL SELECT created_at FROM workflow_submissions UNION ALL SELECT created_at FROM workflow_command_attempt_audits
  UNION ALL SELECT created_at FROM workflow_security_audits UNION ALL SELECT created_at FROM workflow_instance_node_assignees UNION ALL SELECT created_at FROM workflow_assistance_cases
) s;
