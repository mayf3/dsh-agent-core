import http from 'node:http';
import fs from 'node:fs';
const SB='/tmp/ni-sandbox';
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
