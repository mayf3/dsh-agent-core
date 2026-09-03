# GRANT_READBACK — AGENT_CORE_WORKFLOW_EXECUTE_RECEIPT_RECOVERY_V2 (CTR-RR-005 addendum)

- audit_id: 91531e67-8c19-4abc-90e3-95d6dc1a92d1 (parent: PUBLICATION_AUDIT.md)
- addendum_time_epoch_ms: 1788419569545 (2026-09-03)
- method: local read-only psql (host=localhost user=auth_ro db=agent_dev_center); NO mutation
- provenance: CURRENT_REOBSERVED (recovery-time readback; closes the V2 §9 "current Grant" conjunct)

## Records (each with locator + time + extract_sha256)

1. workflow.execute active client face
   - locator: machine_clients WHERE status='active' AND allowed_scopes::text LIKE '%workflow.execute%'
   - value: workflow_execute_active_clients=105
   - sample extract (first 3 ordered): adc-proxy|{workflow.read,workflow.execute,adc.read}; caller-a|{...}; caller-b|{...}
   - extract_sha256(count line): 6914a97226f9faa43ff9ea40b4dc9d95a5b0266df0100b1792a3ef1f2628342e
   - extract_sha256(sample rows): 35e8ce4ba9f85f8b7ea74031598d781a8e977a9bd281b1190c20945b7a8031c8

2. machine_access_grants per audience
   - value: adc-v2=4, svc-auth=2, svc-forum=179, svc-okr=90, svc-workflow=298
   - extract_sha256: 7574402f73e6ccb2da23fb7f4a1b23662ce564c9fa2e57d3283634862243fd12
   - reading: the svc-workflow workflow.execute grant face is present and populated (298 rows); NOT labelled "unchanged" (no control-flow evidence of pre-transaction value) — recorded as CURRENT_REOBSERVED only.

3. auth_audiences DB face (production DB)
   - value: adc-v2 scopes={adc.execute,adc.read}; svc-auth scopes={auth.identity.provision}; svc-forum scopes={forum.read,forum.write}; svc-okr scopes={okr.read,okr.write}; svc-workflow scopes={workflow.admin,workflow.execute,workflow.read}
   - extract_sha256: 6f907059dbf185f68461e56b8aa6f1ab746693a32149e7ee0ea87435eda76f0f
   - informational: agent-core-notification-ingress-v1 absent from DB face (bundle 1.4.0 registry entry not yet backfilled; production auth-service still serving bundle 1.3.0 per health digest 15f9a591...) — Lane B deployment-round input, not a Lane A fact.

4. absence probe (downstream lanes freshness)
   - value: agent-session-messaging|scheduler audience rows = 0
   - extract_sha256: 9a271f2a916b0b6e... (truncated in shell; full value recorded in MANIFEST.sha256 companion)

## Conclusion

The V2 §9 "current Grant 只读回查" conjunct is now satisfied with locator/time/digest. Remaining NOT_ESTABLISHED driver: parent-transaction historical unknowns (original_transaction.*, owner_root_exit_zero_*) — UNKNOWN_NOT_DURABLY_RECORDED by design; resolution requires the separate accepted authority round (V2 §9 composite-rule conflict), not further evidence collection.
