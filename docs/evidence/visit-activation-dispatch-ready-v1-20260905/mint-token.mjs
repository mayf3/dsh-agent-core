// mint-token.mjs — SIMULATION ONLY: generate a local RSA keypair + JWKS and
// mint a direct-machine-profile JWT matching svc-workflow's strict V1 claims
// contract (src/auth/claims.rs V1DirectMachineClaims, deny_unknown_fields).
import { generateKeyPairSync, createSign } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;
const sub = process.argv[2];
const scope = process.argv[3];
const kid = process.argv[4] || 'vad-sim-key-1';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubJwk = publicKey.export({ format: 'jwk' });
writeFileSync(`${dir}/jwks.json`, JSON.stringify({
  keys: [{ kty: pubJwk.kty, n: pubJwk.n, e: pubJwk.e, kid, alg: 'RS256', use: 'sig' }],
}, null, 2));
writeFileSync(`${dir}/mock-jwks-note.txt`,
  'SIMULATION ONLY: locally generated keypair; the scratch service validated the\n' +
  'RS256/JWKS protocol path against this local endpoint, not production auth-service.\n');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
const payload = b64u(JSON.stringify({
  iss: 'auth-service',
  sub,
  aud: 'svc-workflow',
  principal_type: 'agent',
  client_id: 'mc_vad_simulation_client',
  token_use: 'access',
  type: 'access',
  version: 'v1',
  scope,
  agent_id: 'hr-agent',
  jti: `vad-sim-${now}-${Math.floor(Math.random() * 1e6)}`,
  iat: now,
  nbf: now - 5,
  exp: now + 600,
}));
const signer = createSign('RSA-SHA256');
signer.update(`${header}.${payload}`);
const sig = b64u(signer.sign(privateKey.export({ format: 'pem', type: 'pkcs8' })));
console.log(`${header}.${payload}.${sig}`);
