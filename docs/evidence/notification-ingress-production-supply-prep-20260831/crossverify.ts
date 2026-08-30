import { verifyClientSecret } from '/Users/yanfenma/workspace/project/auth-service/src/lib/oauth/secret';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const q = (s: string) => execSync(`docker exec -i authsvc_ni_sandbox_pg psql -U postgres -d agent_dev_center -t -A -c "${s}"`).toString().trim();
const db1 = q("select secret_hash from machine_clients where external_ref='service:v1:client:svc-forum:agent-core-notification-ingress-v1'");
const db2 = q("select secret_hash from machine_clients where external_ref='service:v1:client:svc-workflow:agent-core-notification-ingress-v1'");
const f1 = fs.readFileSync('/tmp/ni-sandbox/dest/forum.env','utf8').split('\n').find((l)=>l.startsWith('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='))!;
const f2 = fs.readFileSync('/tmp/ni-sandbox/dest/workflow.env','utf8').split('\n').find((l)=>l.startsWith('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='))!;
console.log(verifyClientSecret(f1.slice('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='.length), db1) + ',' + verifyClientSecret(f2.slice('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='.length), db2));
