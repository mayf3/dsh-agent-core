#!/usr/bin/env python3
"""Local E2E identity stack: RSA keypair + JWKS endpoint + direct-token minter.

Plays the auth-service role for the local stack (production role: authsvc
4001, V1 RS256 direct machine tokens). Serves /.well-known/jwks.json and
mints the three personas' tokens:
  owner    - DOMAIN_OWNER of the dogfood domain (efficiency-butler analogue)
  lobster  - the dogfood target agent (canonical principal under test)
  stranger - negative-test principal (no role anywhere)
Tokens carry the exact direct-token claim grammar svc-workflow enforces
(deny_unknown_fields): iss/aud/sub/principal_type=agent/client_id/token_use=
access/type=access/version=v1/scope(ASCII-sorted)/jti/iat/nbf/exp<=600s.
"""
import json, sys, uuid, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import base64

KID = "wfdm-e2e-v1"
HERE = Path(__file__).parent

def b64uint(n):
    b = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def main():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    (HERE / "signing-key.pem").write_bytes(priv)
    pub_jwk = {
        "kty": "RSA", "use": "sig", "alg": "RS256", "kid": KID,
        "n": b64uint(key.public_key().public_numbers().n),
        "e": b64uint(key.public_key().public_numbers().e),
    }

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/.well-known/jwks.json":
                body = json.dumps({"keys": [pub_jwk]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404); self.end_headers()

        def log_message(self, *a):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), Handler)
    print("jwks mock ready", flush=True)
    server.serve_forever()

def mint(principal_id, scope, out):
    key = serialization.load_pem_private_key((HERE / "signing-key.pem").read_bytes(), None)
    now = int(time.time())
    claims = {
        "iss": "auth-service", "sub": principal_id, "aud": "svc-workflow",
        "principal_type": "agent", "client_id": f"mc-e2e-{principal_id[:8]}",
        "token_use": "access", "type": "access", "version": "v1",
        "scope": " ".join(sorted(scope.split())), "jti": str(uuid.uuid4()),
        "iat": now, "nbf": now, "exp": now + 590,
    }
    token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": KID, "typ": "at+jwt"})
    Path(out).write_text(token)
    print(f"minted {out} sub={principal_id} scope={scope}")

if __name__ == "__main__":
    if sys.argv[1] == "serve":
        main()
    elif sys.argv[1] == "mint":
        mint(sys.argv[2], sys.argv[3], sys.argv[4])
