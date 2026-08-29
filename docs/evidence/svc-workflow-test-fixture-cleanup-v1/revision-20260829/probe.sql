\set QUIET ON
\pset pager off

\i /tmp/svc-workflow-p2b-revision/allowlist-temp-tables.sql

-- ===== lifetime fixture-pattern sets (NO created_at bound; cross refs use the
-- lifetime sets themselves so a self-contained second island is fully visible) =====
CREATE TEMP TABLE lf_p   AS SELECT principal_id FROM principals WHERE display_name IN ('Test User','Test Agent') AND ((principal_type='HUMAN' AND email='test@example.com') OR (principal_type='AGENT' AND email IS NULL)) AND enabled;
CREATE TEMP TABLE lf_dom AS SELECT domain_id FROM domains WHERE domain_key ~ '^test-domain-[0-9a-f]{8}$' AND display_name='Test Domain' AND enabled;
CREATE TEMP TABLE lf_drb AS SELECT b.binding_id FROM domain_role_bindings b WHERE b.role_key='DOMAIN_OWNER' AND b.enabled AND b.domain_id IN (SELECT domain_id FROM lf_dom) AND b.principal_id IN (SELECT principal_id FROM lf_p);
CREATE TEMP TABLE lf_g   AS SELECT b.binding_id FROM global_role_bindings b WHERE b.role_key IN ('GLOBAL_WORKFLOW_COORDINATOR','GLOBAL_WORKFLOW_READER') AND b.principal_id IN (SELECT principal_id FROM lf_p);
CREATE TEMP TABLE lf_def AS SELECT d.workflow_definition_id FROM workflow_definitions d WHERE d.definition_key ~ '^global-test-[0-9a-f]{8}$' AND d.display_name='Global Test Def' AND d.domain_id IN (SELECT domain_id FROM lf_dom);
CREATE TEMP TABLE lf_ver AS SELECT v.definition_version_id FROM workflow_definition_versions v WHERE v.version_number=1 AND v.version_status='PUBLISHED' AND v.context_schema IS NULL AND v.workflow_definition_id IN (SELECT workflow_definition_id FROM lf_def);
CREATE TEMP TABLE lf_n   AS SELECT n.node_id FROM workflow_node_definitions n WHERE n.definition_version_id IN (SELECT definition_version_id FROM lf_ver) AND ((n.node_key='draft' AND n.display_name='Draft' AND n.order_index=0 AND n.node_type='DRAFT' AND n.assignee_ref_type='WORKFLOW_CREATOR') OR (n.node_key='done' AND n.display_name='Done' AND n.order_index=1 AND n.node_type='TERMINAL' AND n.assignee_ref_type IS NULL)) AND n.fixed_principal_id IS NULL;
CREATE TEMP TABLE lf_t   AS SELECT t.transition_id FROM workflow_transition_definitions t WHERE t.transition_key='advance' AND t.display_name='Advance' AND t.transition_effect='ADVANCE' AND t.definition_version_id IN (SELECT definition_version_id FROM lf_ver) AND t.source_node_id IN (SELECT node_id FROM lf_n) AND t.target_node_id IN (SELECT node_id FROM lf_n);
CREATE TEMP TABLE lf_i   AS SELECT i.workflow_instance_id FROM workflow_instances i WHERE i.domain_id IN (SELECT domain_id FROM lf_dom) AND i.definition_version_id IN (SELECT definition_version_id FROM lf_ver) AND i.created_by_principal_id IN (SELECT principal_id FROM lf_p) AND i.cancelled=false AND i.archived_at IS NULL AND i.cancelled_by_principal_id IS NULL AND i.archived_by_principal_id IS NULL;
CREATE TEMP TABLE lf_c   AS SELECT c.command_id FROM workflow_command_receipts c WHERE c.receipt_status='COMPLETED' AND (c.idempotency_key ~ '^create-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR c.idempotency_key IN ('grant-global-1','revoke-global-1','transition-coord-1','grant-reader-1','revoke-reader-1','reader-denied-transition-1')) AND c.principal_id IN (SELECT principal_id FROM lf_p);
CREATE TEMP TABLE lf_r   AS SELECT r.context_revision_id FROM workflow_context_revisions r WHERE r.revision_number=1 AND r.previous_revision_id IS NULL AND r.created_by_principal_id IN (SELECT principal_id FROM lf_p) AND r.workflow_instance_id IN (SELECT workflow_instance_id FROM lf_i) AND r.payload->>'title' IN ('alpha-1','alpha-2','beta-1','page-0','page-1','page-2','page-3','page-4','summary-1','denied-1','boundary-a','boundary-b','lifecycle-1','reader-a1','reader-a2','reader-b1','reader-write-a','reader-write-b','reader-lifecycle-1');
CREATE TEMP TABLE lf_v   AS SELECT v.node_visit_id FROM workflow_node_visits v WHERE v.visit_number=1 AND v.entered_by_transition_id IS NULL AND v.workflow_instance_id IN (SELECT workflow_instance_id FROM lf_i) AND v.assignee_principal_id IN (SELECT principal_id FROM lf_p) AND v.node_id IN (SELECT node_id FROM lf_n);
CREATE TEMP TABLE lf_e   AS SELECT e.event_id FROM workflow_events e WHERE e.event_type='INSTANCE_CREATED' AND e.workflow_instance_id IN (SELECT workflow_instance_id FROM lf_i) AND e.command_id IN (SELECT command_id FROM lf_c) AND e.actor_principal_id IN (SELECT principal_id FROM lf_p);

\set QUIET OFF
\echo '=== [R0] session / role privileges ==='
SELECT current_user, current_database(),
       (SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user) AS can_createdb,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser;

\echo '=== [R1] lifetime-vs-allowlist set equality, 13 tables (lf / al / extra / missing) ==='
SELECT 'principals' t, (SELECT count(*) FROM lf_p) lf, (SELECT count(*) FROM allow_p) al,
  (SELECT count(*) FROM lf_p WHERE principal_id NOT IN (SELECT principal_id FROM allow_p)) extra,
  (SELECT count(*) FROM allow_p WHERE principal_id NOT IN (SELECT principal_id FROM lf_p)) missing
UNION ALL SELECT 'domains', (SELECT count(*) FROM lf_dom), (SELECT count(*) FROM allow_dom),
  (SELECT count(*) FROM lf_dom WHERE domain_id NOT IN (SELECT domain_id FROM allow_dom)),
  (SELECT count(*) FROM allow_dom WHERE domain_id NOT IN (SELECT domain_id FROM lf_dom))
UNION ALL SELECT 'domain_role_bindings', (SELECT count(*) FROM lf_drb), (SELECT count(*) FROM allow_drb),
  (SELECT count(*) FROM lf_drb WHERE binding_id NOT IN (SELECT binding_id FROM allow_drb)),
  (SELECT count(*) FROM allow_drb WHERE binding_id NOT IN (SELECT binding_id FROM lf_drb))
UNION ALL SELECT 'global_role_bindings', (SELECT count(*) FROM lf_g), (SELECT count(*) FROM allow_g),
  (SELECT count(*) FROM lf_g WHERE binding_id NOT IN (SELECT binding_id FROM allow_g)),
  (SELECT count(*) FROM allow_g WHERE binding_id NOT IN (SELECT binding_id FROM lf_g))
UNION ALL SELECT 'workflow_definitions', (SELECT count(*) FROM lf_def), (SELECT count(*) FROM allow_def),
  (SELECT count(*) FROM lf_def WHERE workflow_definition_id NOT IN (SELECT workflow_definition_id FROM allow_def)),
  (SELECT count(*) FROM allow_def WHERE workflow_definition_id NOT IN (SELECT workflow_definition_id FROM lf_def))
UNION ALL SELECT 'workflow_definition_versions', (SELECT count(*) FROM lf_ver), (SELECT count(*) FROM allow_ver),
  (SELECT count(*) FROM lf_ver WHERE definition_version_id NOT IN (SELECT definition_version_id FROM allow_ver)),
  (SELECT count(*) FROM allow_ver WHERE definition_version_id NOT IN (SELECT definition_version_id FROM lf_ver))
UNION ALL SELECT 'workflow_node_definitions', (SELECT count(*) FROM lf_n), (SELECT count(*) FROM allow_n),
  (SELECT count(*) FROM lf_n WHERE node_id NOT IN (SELECT node_id FROM allow_n)),
  (SELECT count(*) FROM allow_n WHERE node_id NOT IN (SELECT node_id FROM lf_n))
UNION ALL SELECT 'workflow_transition_definitions', (SELECT count(*) FROM lf_t), (SELECT count(*) FROM allow_t),
  (SELECT count(*) FROM lf_t WHERE transition_id NOT IN (SELECT transition_id FROM allow_t)),
  (SELECT count(*) FROM allow_t WHERE transition_id NOT IN (SELECT transition_id FROM lf_t))
UNION ALL SELECT 'workflow_instances', (SELECT count(*) FROM lf_i), (SELECT count(*) FROM allow_i),
  (SELECT count(*) FROM lf_i WHERE workflow_instance_id NOT IN (SELECT workflow_instance_id FROM allow_i)),
  (SELECT count(*) FROM allow_i WHERE workflow_instance_id NOT IN (SELECT workflow_instance_id FROM lf_i))
UNION ALL SELECT 'workflow_command_receipts', (SELECT count(*) FROM lf_c), (SELECT count(*) FROM allow_c),
  (SELECT count(*) FROM lf_c WHERE command_id NOT IN (SELECT command_id FROM allow_c)),
  (SELECT count(*) FROM allow_c WHERE command_id NOT IN (SELECT command_id FROM lf_c))
UNION ALL SELECT 'workflow_context_revisions', (SELECT count(*) FROM lf_r), (SELECT count(*) FROM allow_r),
  (SELECT count(*) FROM lf_r WHERE context_revision_id NOT IN (SELECT context_revision_id FROM allow_r)),
  (SELECT count(*) FROM allow_r WHERE context_revision_id NOT IN (SELECT context_revision_id FROM lf_r))
UNION ALL SELECT 'workflow_node_visits', (SELECT count(*) FROM lf_v), (SELECT count(*) FROM allow_v),
  (SELECT count(*) FROM lf_v WHERE node_visit_id NOT IN (SELECT node_visit_id FROM allow_v)),
  (SELECT count(*) FROM allow_v WHERE node_visit_id NOT IN (SELECT node_visit_id FROM lf_v))
UNION ALL SELECT 'workflow_events', (SELECT count(*) FROM lf_e), (SELECT count(*) FROM allow_e),
  (SELECT count(*) FROM lf_e WHERE event_id NOT IN (SELECT event_id FROM allow_e)),
  (SELECT count(*) FROM allow_e WHERE event_id NOT IN (SELECT event_id FROM lf_e));

\echo '=== [R2] shape assumptions on the 224 allowlist rows (all must be 0 unless noted) ==='
SELECT (SELECT count(*) FROM principals WHERE principal_id IN (SELECT principal_id FROM allow_p) AND NOT enabled) AS fixture_principals_not_enabled,
       (SELECT count(*) FROM domains WHERE domain_id IN (SELECT domain_id FROM allow_dom) AND NOT enabled) AS fixture_domains_not_enabled,
       (SELECT count(*) FROM workflow_definition_versions WHERE definition_version_id IN (SELECT definition_version_id FROM allow_ver) AND context_schema IS NOT NULL) AS fixture_versions_with_context_schema,
       (SELECT count(*) FROM workflow_transition_definitions WHERE transition_id IN (SELECT transition_id FROM allow_t) AND NOT (transition_key='advance' AND display_name='Advance' AND transition_effect='ADVANCE')) AS transitions_wrong_shape,
       (SELECT count(*) FROM workflow_node_definitions WHERE node_id IN (SELECT node_id FROM allow_n) AND NOT (((node_key='draft' AND display_name='Draft' AND order_index=0 AND node_type='DRAFT' AND assignee_ref_type='WORKFLOW_CREATOR') OR (node_key='done' AND display_name='Done' AND order_index=1 AND node_type='TERMINAL' AND assignee_ref_type IS NULL)) AND fixed_principal_id IS NULL)) AS nodes_wrong_shape,
       (SELECT count(*) FROM workflow_definitions WHERE workflow_definition_id IN (SELECT workflow_definition_id FROM allow_def) AND definition_key !~ '^global-test-[0-9a-f]{8}$') AS defs_failing_regex,
       (SELECT count(*) FROM domains WHERE domain_id IN (SELECT domain_id FROM allow_dom) AND domain_key !~ '^test-domain-[0-9a-f]{8}$') AS domains_failing_regex;

\echo '=== [R2b] receipt key split on the 25 allowlist receipts (expect 19 uuid-v4 + 6 fixed) ==='
SELECT idempotency_key ~ '^create-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS is_uuid_v4_create,
       idempotency_key IN ('grant-global-1','revoke-global-1','transition-coord-1','grant-reader-1','revoke-reader-1','reader-denied-transition-1') AS is_fixed_test_key,
       count(*)
FROM workflow_command_receipts WHERE command_id IN (SELECT command_id FROM allow_c) GROUP BY 1,2 ORDER BY 3;

\echo '=== [R2c] context title multiset on the 19 allowlist revisions ==='
SELECT payload->>'title' AS title, count(*) FROM workflow_context_revisions WHERE context_revision_id IN (SELECT context_revision_id FROM allow_r) GROUP BY 1 ORDER BY 1;

\echo '=== [R2d] lifetime uuid-v4-create / fixed-key receipt totals DB-wide (expect 19 / 6) ==='
SELECT (SELECT count(*) FROM workflow_command_receipts WHERE idempotency_key ~ '^create-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') AS lifetime_uuid_v4_create,
       (SELECT count(*) FROM workflow_command_receipts WHERE idempotency_key IN ('grant-global-1','revoke-global-1','transition-coord-1','grant-reader-1','revoke-reader-1','reader-denied-transition-1')) AS lifetime_fixed_test_keys;

\echo '=== [R3] extra lifetime rows outside allowlist (must return 0 rows today) ==='
SELECT 'principals' tbl, principal_id::text id FROM lf_p WHERE principal_id NOT IN (SELECT principal_id FROM allow_p)
UNION ALL SELECT 'domains', domain_id::text FROM lf_dom WHERE domain_id NOT IN (SELECT domain_id FROM allow_dom)
UNION ALL SELECT 'domain_role_bindings', binding_id::text FROM lf_drb WHERE binding_id NOT IN (SELECT binding_id FROM allow_drb)
UNION ALL SELECT 'global_role_bindings', binding_id::text FROM lf_g WHERE binding_id NOT IN (SELECT binding_id FROM allow_g)
UNION ALL SELECT 'workflow_definitions', workflow_definition_id::text FROM lf_def WHERE workflow_definition_id NOT IN (SELECT workflow_definition_id FROM allow_def)
UNION ALL SELECT 'workflow_definition_versions', definition_version_id::text FROM lf_ver WHERE definition_version_id NOT IN (SELECT definition_version_id FROM allow_ver)
UNION ALL SELECT 'workflow_node_definitions', node_id::text FROM lf_n WHERE node_id NOT IN (SELECT node_id FROM allow_n)
UNION ALL SELECT 'workflow_transition_definitions', transition_id::text FROM lf_t WHERE transition_id NOT IN (SELECT transition_id FROM allow_t)
UNION ALL SELECT 'workflow_instances', workflow_instance_id::text FROM lf_i WHERE workflow_instance_id NOT IN (SELECT workflow_instance_id FROM allow_i)
UNION ALL SELECT 'workflow_command_receipts', command_id::text FROM lf_c WHERE command_id NOT IN (SELECT command_id FROM allow_c)
UNION ALL SELECT 'workflow_context_revisions', context_revision_id::text FROM lf_r WHERE context_revision_id NOT IN (SELECT context_revision_id FROM allow_r)
UNION ALL SELECT 'workflow_node_visits', node_visit_id::text FROM lf_v WHERE node_visit_id NOT IN (SELECT node_visit_id FROM allow_v)
UNION ALL SELECT 'workflow_events', event_id::text FROM lf_e WHERE event_id NOT IN (SELECT event_id FROM allow_e);
