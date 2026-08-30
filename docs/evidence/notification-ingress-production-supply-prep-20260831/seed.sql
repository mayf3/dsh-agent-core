TRUNCATE auth_audiences, machine_access_grants, machine_clients, machine_principals, grant_change_audits, auth_security_audits, human_audience_grants, delegation_grants CASCADE;
INSERT INTO auth_audiences (audience_id,resource_service,scope_namespace,accepted_principal_types,registered_scopes,human_access_enabled,machine_access_enabled,delegated_access_enabled,status,freeze_ready,version,created_at,updated_at) VALUES
('adc-v2','adc-v2','adc',ARRAY['agent']::text[],ARRAY['adc.execute','adc.read']::text[],false,true,false,'active',true,1,now(),now()),
('svc-auth','svc-auth','auth',ARRAY['service']::text[],ARRAY['auth.identity.provision']::text[],false,true,false,'active',true,1,now(),now()),
('svc-forum','svc-forum','forum',ARRAY['agent']::text[],ARRAY['forum.read','forum.write']::text[],false,true,false,'active',true,1,now(),now()),
('svc-okr','svc-okr','okr',ARRAY['user','agent']::text[],ARRAY['okr.read','okr.write']::text[],true,true,false,'active',true,1,now(),now()),
('svc-workflow','svc-workflow','workflow',ARRAY['agent']::text[],ARRAY['workflow.admin','workflow.execute','workflow.read']::text[],false,true,true,'active',true,1,now(),now());
INSERT INTO machine_principals (id,principal_type,agent_id,owner_user_id,display_name,external_ref,request_digest,status,created_at,updated_at)
VALUES ('857b20c3-8d84-497d-950a-7b185a116687','service',NULL,NULL,'Agent Provisioning Broker','openclaw:broker:provisioning',NULL,'active',now(),now());
INSERT INTO machine_clients (id,client_id,machine_principal_id,secret_hash,external_ref,status,allowed_resources,allowed_scopes,created_at,updated_at)
VALUES ('11111111-1111-4111-8111-111111111111','mc_prov_N9NO0yYvw_3fR1ucqusIqw','857b20c3-8d84-497d-950a-7b185a116687','aabbccddaabbccddaabbccddaabbccdd:'||repeat('ab',64),'openclaw:broker:client:provisioning','active','{}'::text[],'{}'::text[],now(),now());
INSERT INTO machine_access_grants (machine_client_id,audience_id,scopes,version,created_at,updated_at)
VALUES ('11111111-1111-4111-8111-111111111111','svc-auth',ARRAY['auth.identity.provision']::text[],1,now(),now());
INSERT INTO machine_principals (id,principal_type,agent_id,owner_user_id,display_name,external_ref,request_digest,status,created_at,updated_at)
VALUES ('22222222-2222-4222-8222-222222222222','agent','agt_demo',NULL,'demo agent','agentcore:v1:principal:agt_demo',NULL,'active',now(),now());
INSERT INTO machine_clients (id,client_id,machine_principal_id,secret_hash,external_ref,status,allowed_resources,allowed_scopes,created_at,updated_at)
VALUES ('33333333-3333-4333-8333-333333333333','mc_demo00000000000000000000','22222222-2222-4222-8222-222222222222','aabbccddaabbccddaabbccddaabbccdd:'||repeat('ab',64),'agentcore:v1:client:agt_demo','active','{}'::text[],'{}'::text[],now(),now());
INSERT INTO machine_access_grants (machine_client_id,audience_id,scopes,version,created_at,updated_at)
VALUES ('33333333-3333-4333-8333-333333333333','svc-forum',ARRAY['forum.read','forum.write']::text[],1,now(),now());
