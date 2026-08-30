#!/bin/bash
# NI supply runner sandbox harness — disposable postgres + stubs + seed.
set -Eeuo pipefail
SB=/tmp/ni-sandbox
PG_NAME=authsvc_ni_sandbox_pg
PG_PORT=55434
DB_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/agent_dev_center"
REPO=/Users/yanfenma/workspace/project/auth-service

mkdir -p "$SB"
rm -rf "${SB:?}"/*
mkdir -p "$SB/stub" "$SB/plist" "$SB/dest" "$SB/out" "$SB/lock" "$SB/repo"

# ---- 1. postgres container ----
docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
docker run -d --name "$PG_NAME" -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:${PG_PORT}:5432 postgres:16-alpine >/dev/null
for i in $(seq 1 40); do docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$PG_NAME" psql -U postgres -c "CREATE DATABASE agent_dev_center;" >/dev/null

# ---- 2. schema: full DDL generated from prisma/schema.prisma (the repo
# migration dir is a partial history; production carries 54 applied) ----
cd "$REPO"
git show github/main:prisma/schema.prisma > "$SB/schema.prisma"
/usr/local/bin/node node_modules/prisma/build/index.js migrate diff \
  --from-empty --to-schema-datamodel "$SB/schema.prisma" --script > "$SB/full-schema.sql"
docker exec -i "$PG_NAME" psql -U postgres -d agent_dev_center -v ON_ERROR_STOP=1 -q < "$SB/full-schema.sql"
echo "SCHEMA_TABLES=$(docker exec "$PG_NAME" psql -U postgres -d agent_dev_center -t -A -c "select count(*) from information_schema.tables where table_schema='public';")"

# ---- 3. seed frozen baseline ----
docker exec -i "$PG_NAME" psql -U postgres -d agent_dev_center -v ON_ERROR_STOP=1 -q <<'SQL'
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
SQL
echo "SEEDED_AUDIENCES=$(docker exec "$PG_NAME" psql -U postgres -d agent_dev_center -t -A -c 'select count(*) from auth_audiences;')"

# ---- 4. sandbox git repo + VARIANT-B (accepted spec) commit ----
git clone --quiet --no-hardlinks "$REPO" "$SB/repo"
git -C "$SB/repo" remote remove origin 2>/dev/null || true
git -C "$SB/repo" remote add github "$REPO"
git -C "$SB/repo" config remote.github.fetch '+refs/remotes/github/main:refs/remotes/github/main'
git -C "$SB/repo" remote set-url github "$SB/repo"   # self-fetch: matrix pins github/main per variant
git -C "$SB/repo" fetch --quiet github
git -C "$REPO" show '87edae60bfa5d30b60526668814052725d843692:docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1.md' > "$SB/spec-proposed.md"
python3 - "$SB/spec-proposed.md" > "$SB/spec-accepted.md" <<'PY'
import sys
lines = open(sys.argv[1]).read().split('\n')
out = []
for l in lines:
    if l == 'status: proposed': out.append('status: accepted')
    elif l == 'implementation_authority: none': out.append('implementation_authority: contracts')
    else: out.append(l)
print('\n'.join(out))
PY
MAIN_SHA=$(git -C "$SB/repo" rev-parse github/main)
git -C "$SB/repo" checkout --quiet -b variant-b "$MAIN_SHA"
mkdir -p "$SB/repo/docs/specs"
cp "$SB/spec-accepted.md" "$SB/repo/docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1.md"
git -C "$SB/repo" -c user.email=sb@sb -c user.name=sb commit --quiet -am 'sandbox: accepted credential grant spec (VARIANT-B)'
VARIANT_B_SHA=$(git -C "$SB/repo" rev-parse HEAD)
git -C "$SB/repo" checkout --quiet -b variant-a "$MAIN_SHA"
echo "MAIN_SHA=$MAIN_SHA"
echo "VARIANT_B_SHA=$VARIANT_B_SHA"

# ---- 5. stubs ----
cat > "$SB/stub/launchctl" <<EOF
#!/bin/bash
echo "\$(date -u +%FT%TZ) \$*" >> "$SB/stub/launchctl.log"
if [ "\$1" = 'bootout' ]; then rm -f "$SB/stub/bootstrapped.marker"; fi
if [ "\$1" = 'bootstrap' ]; then touch "$SB/stub/bootstrapped.marker"; fi
exit 0
EOF
chmod +x "$SB/stub/launchctl"

if [ -f "$SB/stub/health-server.pid" ] && kill -0 "$(cat "$SB/stub/health-server.pid")" 2>/dev/null; then
  kill "$(cat "$SB/stub/health-server.pid")" || true; sleep 1
fi
cat > "$SB/stub/health-server.mjs" <<EOF
import http from 'node:http';
import fs from 'node:fs';
const SB='$SB';
const PROD_DIGEST='15f9a591e25fb1dca99c2a02d8362c83e41f4a932ca0710d97a602e18a8234ad';
const server = http.createServer((req, res) => {
  let v = '1.3.0', d = PROD_DIGEST;
  if (fs.existsSync(SB + '/stub/bootstrapped.marker')) {
    v = '1.4.0';
    try {
      const rc = JSON.parse(fs.readFileSync(SB + '/new-deploy/generated/minimal-auth-v1/runtime-contract.json', 'utf8'));
      d = rc.runtimeDigest;
    } catch { d = 'sandbox-skip-build-digest'; }
  }
  if (fs.existsSync(SB + '/stub/health-override.json')) {
    try { const o = JSON.parse(fs.readFileSync(SB + '/stub/health-override.json', 'utf8')); v = o.version ?? v; d = o.digest ?? d; } catch {}
  }
  const body = { ok: true, service: 'auth-service', authContractMode: 'v1', authContractVersion: v, authContractDigest: d };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
});
server.listen(45401, '127.0.0.1', () => console.log('health stub on 45401'));
EOF
nohup /usr/local/bin/node "$SB/stub/health-server.mjs" > "$SB/stub/health-server.log" 2>&1 &
echo $! > "$SB/stub/health-server.pid"
sleep 1
curl -s http://127.0.0.1:45401/api/health | head -c 200; echo

cat > "$SB/plist/template.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.auth-service</string>
	<key>ProgramArguments</key>
	<array>
		<string>/usr/local/bin/node</string>
		<string>/Users/yanfenma/workspace/project/production-auth-service-3b2ae71c/dist/src/server.js</string>
	</array>
	<key>WorkingDirectory</key>
	<string>/Users/yanfenma/workspace/project/production-auth-service-3b2ae71c</string>
</dict>
</plist>
EOF
cp "$SB/plist/template.plist" "$SB/plist/com.auth-service.test.plist"

printf 'DATABASE_URL=x\nWORKFLOW_PORT=8989\n' > "$SB/dest/workflow.env"; chmod 600 "$SB/dest/workflow.env"
: > "$SB/dest/forum.env"; chmod 600 "$SB/dest/forum.env"

echo "HARNESS_READY"
echo "DB_URL=$DB_URL"
