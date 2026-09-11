-- WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1 · PHASE 1 fresh production census (READ ONLY)
-- ROLE (Owner authority correction 2026-09-11): WORKFLOW_SNAPSHOT + SUCCESSOR_LINEAGE
-- + ASSIGNEE_FACTS + RAW_VS_UNIQUE + DISPATCH_INTENT + EXECUTION_CLASS_IF_DEPLOYED.
-- This census is NOT identity authority (sole authority = AUTH_SERVICE_INTERNAL_
-- IDENTITY_DIRECTORY_V1); WISL rows here are historical repair lineage only.
-- Owner run (suggested invocation — transaction_read_only guard MANDATORY):
--   sudo -u postgres env \
--     PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000' \
--     psql -d svc_workflow_dogfood_clean -tA \
--     -f /Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/workflow-dispatch-recovery-v1-20260911/census.sql
-- Block 0 emits the guards: if transaction_read_only != on =>
-- STOP_WITH_ZERO_MUTATION (discard the output, do not proceed).
-- Blocks are intentionally independent: a missing column/table fails ONLY its
-- own block (psql continues by default; do not add ON_ERROR_STOP).
\echo ===0_SNAPSHOT_STAMP_AND_GUARDS
SELECT current_database() AS db,
       current_setting('transaction_read_only') AS transaction_read_only,
       now() AS census_at;
\echo ===0b_MIGRATION_VERSION_STATE
SELECT version, description FROM _sqlx_migrations ORDER BY version DESC LIMIT 3;

\echo ===1_TABLE_PRESENCE
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
('workflow_instances','workflow_node_visits','workflow_node_definitions',
 'workflow_instance_node_assignees','workflow_identity_successor_lines',
 'workflow_definitions','workflow_definition_versions','workflow_events',
 'workflow_transitions','dispatch_intents','workflow_dispatch_intents','domains')
ORDER BY 1;

\echo ===2_INSTANCE_COUNTS
SELECT count(*) AS total_instances, count(DISTINCT workflow_instance_id) AS unique_ids,
       min(created_at) AS oldest, max(created_at) AS newest
FROM workflow_instances;

\echo ===3_CANDIDATE_ROWS_ONE_PER_INSTANCE
-- current node + working assignee + pending flag (no outbound transition event
-- from the current visit = still awaiting work/transition)
SELECT i.workflow_instance_id AS instance_id,
       i.domain_id,
       d.definition_key,
       nd.node_key AS current_node_key,
       v.assignee_principal_id AS current_assignee_principal_id,
       (NOT EXISTS (SELECT 1 FROM workflow_events e
                     WHERE e.source_node_visit_id = v.node_visit_id)) AS looks_pending,
       i.created_at,
       i.updated_at
FROM workflow_instances i
LEFT JOIN workflow_node_visits v ON v.node_visit_id = i.current_node_visit_id
LEFT JOIN workflow_node_definitions nd ON nd.node_id = v.node_id
JOIN workflow_definition_versions dv ON dv.definition_version_id = i.definition_version_id
JOIN workflow_definitions d ON d.workflow_definition_id = dv.workflow_definition_id
ORDER BY i.created_at;

\echo ===4_DECLARED_NODE_ASSIGNEES
-- may fail harmlessly if 0016 column shape differs; block-isolated
SELECT workflow_instance_id, assignee_principal_id
FROM workflow_instance_node_assignees
ORDER BY workflow_instance_id;

\echo ===5_EXECUTION_CLASS (migration 0026; absent pre-deploy = expected)
SELECT workflow_instance_id, execution_class FROM workflow_instances;

\echo ===6_IDENTITY_SUCCESSOR_LINES (0025 immutable authority)
SELECT id, source_principal_id, successor_principal_id, legacy_agent_id, canonical_agent_id
FROM workflow_identity_successor_lines;

\echo ===7_DISTINCT_WORKING_ASSIGNEES (join target for classification)
SELECT DISTINCT assignee_principal_id FROM workflow_node_visits ORDER BY 1;

\echo ===8_DOMAIN_ROLES_SNAPSHOT (who owns/members which domain)
SELECT domain_id, principal_id, role FROM domain_role_bindings ORDER BY domain_id, principal_id;

\echo ===9_DISPATCH_INTENTS_TABLES_SHAPE (presence + counts; absent = expected)
SELECT 'dispatch_intents' AS t, count(*) FROM dispatch_intents
UNION ALL
SELECT 'workflow_dispatch_intents', count(*) FROM workflow_dispatch_intents;
