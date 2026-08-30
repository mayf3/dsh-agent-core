#!/usr/bin/env python3
"""Sandbox stub for svc-workflow /version /healthz /readyz on 127.0.0.1:8990.

Behavior is derived from the ACTUAL installed sandbox binary sha:
  new (f0c74ee artifact) -> serves MAIN_COMMIT state
  old (91fc4e4 artifact) -> serves PROD_SHA state
Scenario flags (files in FLAGS dir):
  version_hang    -> always serve OLD version (deploy never "comes up")
  healthz_newbreak-> healthz/readyz 500 ONLY while the NEW binary is installed
  always_unhealthy-> healthz/readyz 500 unconditionally
"""
import hashlib, http.server, json, os, socketserver, sys

FLAGS = "/tmp/svc-wf-deploy-sbx/flags"
BINARY = "/tmp/svc-wf-deploy-sbx/service/svc-workflow"
NEW_SHA = "4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356"
MAIN_SHA = "f0c74eefd63ca71a1fcb670ad31ac35f19f69539"
OLD_SHA = "91fc4e40f400ee9cc17351f857a1ab2860682681"

def installed_new():
    try:
        with open(BINARY, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest() == NEW_SHA
    except OSError:
        return False

def flag(name):
    return os.path.exists(os.path.join(FLAGS, name))

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def _hits(self):
        f = "/tmp/svc-wf-deploy-sbx/hits"
        n = 0
        try:
            n = int(open(f).read().strip() or "0")
        except (OSError, ValueError):
            pass
        open(f, "w").write(str(n + 1))
        try:
            t = int(open("/tmp/svc-wf-deploy-sbx/hit-threshold").read().strip() or "0")
        except (OSError, ValueError):
            t = 0  # threshold file absent => feature disabled
        return n + 1 > t if t > 0 else False

    def do_GET(self):
        if self.path == "/version":
            new = installed_new() and not flag("version_hang")
            body = {"service": "svc-workflow", "version": "0.3.1",
                    "gitSha": MAIN_SHA if new else OLD_SHA,
                    "gitTreeState": "clean", "schemaVersion": "0022",
                    "apiContractVersion": "internal-v0"}
            data = json.dumps(body).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path in ("/healthz", "/readyz"):
            bad = self._hits() or flag("always_unhealthy") or (flag("healthz_newbreak") and installed_new())
            code = 500 if bad else 200
            self.send_response(code)
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()

class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == "__main__":
    os.makedirs(FLAGS, exist_ok=True)
    S(("127.0.0.1", 8990), H).serve_forever()
