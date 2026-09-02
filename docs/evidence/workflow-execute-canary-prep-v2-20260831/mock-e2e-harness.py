#!/usr/bin/env python3
"""Offline mock e2e for /tmp/run-agent-core-workflow-canary-prep-v2.sh.

Runs a SED-TRANSFORMED COPY of the runner (root gate bypassed, origins/paths
pointed at local mock servers and a sandbox dir) end-to-end, then re-runs it
to prove idempotent adoption + byte-identical config. The sealed runner at
/tmp is NEVER executed and NEVER modified. Artifacts land in
/tmp/canary-prep-v2-test/ (wiped per invocation).
"""
import base64, hashlib, json, os, re, shutil, subprocess, sys, threading, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TEST = "/tmp/canary-prep-v2-test"
MOCKBIN = f"{TEST}/bin"
SANDBOX = f"{TEST}/sandbox"
AUTH_PORT, WF_PORT = 14001, 14089

CANARY_CLIENT = "mc_ohDTyGYRpBLI4qN_sVU88aob"
CANARY_SECRET = "mock-secret-not-real"
CANARY_PRINCIPAL = "d5b3aeb2-e754-49a9-9914-b963521c0985"
TODO_DOMAIN = "10000000-0000-0000-0000-000000000100"
BIP_DOMAIN = "f9b5682c-1c9c-5ace-a7b1-01b9a3be5965"
DEFVER = "95aacea2-5599-4e74-b576-e2eeb61e27a0"
EXPECTED_TID = "7493f6ca-6cf0-4ebf-95f8-f565f2b231ec"
NS = uuid.UUID("b0ca8a1e-6cd5-4f5e-9a6f-3f2f70a20001")

CREATED = {}  # extref -> record


def b64url(obj):
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")


def fake_token():
    return f"{b64url({'alg': 'none'})}.{b64url({'sub': CANARY_PRINCIPAL, 'client_id': CANARY_CLIENT, 'scope': 'workflow.read workflow.execute'})}.sig"


class AuthHandler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/api/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/oauth/token":
            self.send_response(404)
            self.end_headers()
            return
        auth = self.headers.get("Authorization", "")
        try:
            raw = base64.b64decode(auth.split(" ", 1)[1]).decode()
            cid, secret = raw.split(":", 1)
        except Exception:
            cid = secret = ""
        if cid != CANARY_CLIENT or secret != CANARY_SECRET:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":"invalid_client"}')
            return
        payload = json.dumps({"access_token": fake_token(), "token_type": "Bearer",
                              "expires_in": 300}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class WfHandler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        payload = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "ok"})
            return
        if self.path.startswith("/internal/v1/workflow-instances/domain"):
            domain = re.search(r"domainId=([0-9a-f-]+)", self.path).group(1)
            if domain == BIP_DOMAIN:
                self._json(200, {"items": [{"workflow_instance_id": str(uuid.uuid5(NS, "bip-1"))},
                                           {"workflow_instance_id": str(uuid.uuid5(NS, "bip-2"))}],
                                "next_cursor": None})
            else:
                self._json(403, {"error": {"code": "workflow_instance_not_found_or_not_visible",
                                           "message": "not a domain owner"}})
            return
        m = re.match(r"^/internal/v1/workflow-instances/([0-9a-f-]{36})$", self.path)
        if not m:
            self._json(404, {"error": {"code": "instance_not_found", "message": "no"}})
            return
        inst_id = m.group(1)
        rec = next((r for r in CREATED.values() if r["id"] == inst_id), None)
        if rec is None:
            self._json(404, {"error": {"code": "instance_not_found", "message": "no"}})
            return
        self._json(200, {
            "visibility": "full",
            "detail": {
                "instance": {
                    "workflow_instance_id": rec["id"],
                    "domain_id": TODO_DOMAIN,
                    "definition_version_id": DEFVER,
                    "definition_version_status": "PUBLISHED",
                    "created_by_principal_id": CANARY_PRINCIPAL,
                    "workflow_state_version": 1,
                    "external_reference": rec["extref"],
                    "external_url": None,
                    "metadata": rec["metadata"],
                    "created_at": "2026-08-31T12:00:00Z",
                    "domain_enabled": True,
                    "is_terminal": False,
                    "current_node": {"node_id": str(uuid.uuid5(NS, "node-open")),
                                     "node_key": "open", "display_name": "Open", "node_type": "DRAFT"},
                },
                "current_context_revision_id": rec["ctx"],
                "current_node_visit_id": rec["visit"],
                "current_context": {
                    "context_revision_id": rec["ctx"],
                    "workflow_instance_id": rec["id"],
                    "revision_number": 1,
                    "previous_revision_id": None,
                    "payload": {"title": rec["title"], "description": rec["description"]},
                    "payload_digest": "deadbeef",
                    "created_by_principal_id": CANARY_PRINCIPAL,
                    "created_at": "2026-08-31T12:00:00Z",
                },
                "current_visit": {
                    "node_visit_id": rec["visit"],
                    "workflow_instance_id": rec["id"],
                    "node": {"node_id": str(uuid.uuid5(NS, "node-open")), "node_key": "open",
                             "display_name": "Open", "node_type": "DRAFT"},
                    "visit_number": 1,
                    "assignee_principal_id": CANARY_PRINCIPAL,
                    "entered_by_transition_id": None,
                    "instructions": None,
                    "created_at": "2026-08-31T12:00:00Z",
                },
                "outgoing_transitions": [
                    {"transition_id": EXPECTED_TID, "transition_key": "advance-to-completed",
                     "display_name": "Advance to completed", "transition_effect": "ADVANCE",
                     "target_node": {"node_id": str(uuid.uuid5(NS, "node-completed")), "node_key": "completed",
                                     "display_name": "Completed", "node_type": "TERMINAL"},
                     "submission_schema": {"type": "object", "required": ["summary"],
                                           "properties": {"summary": {"type": "string", "maxLength": 2000}},
                                           "additionalProperties": False},
                     "executable_for_actor": True, "blocked_reason": None},
                    {"transition_id": str(uuid.uuid5(NS, "t-cancel")), "transition_key": "cancel",
                     "display_name": "Cancel", "transition_effect": "TERMINATE",
                     "target_node": {"node_id": str(uuid.uuid5(NS, "node-cancelled")), "node_key": "cancelled",
                                     "display_name": "Cancelled", "node_type": "TERMINAL"},
                     "submission_schema": {"type": "object", "required": ["reason"],
                                           "properties": {"reason": {"type": "string", "maxLength": 1000}},
                                           "additionalProperties": False},
                     "executable_for_actor": True, "blocked_reason": None},
                ],
            },
        })

    def do_POST(self):
        if self.path != "/internal/v1/workflow-instances":
            self._json(404, {"error": {"code": "no", "message": "no"}})
            return
        if "Idempotency-Key" not in self.headers:
            self._json(400, {"error": {"code": "invalid_input", "message": "missing idempotency key"}})
            return
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        extref = body["externalReference"]
        if extref not in CREATED:
            CREATED[extref] = {
                "extref": extref,
                "id": str(uuid.uuid5(NS, extref)),
                "visit": str(uuid.uuid5(NS, extref + "-visit")),
                "ctx": str(uuid.uuid5(NS, extref + "-ctx")),
                "title": body["contextPayload"]["title"],
                "description": body["contextPayload"]["description"],
                "metadata": body["metadata"],
                "idempotency": self.headers.get("Idempotency-Key"),
            }
        rec = CREATED[extref]
        self.send_response(201)
        self.send_header("Content-Type", "application/json")
        payload = json.dumps({
            "workflowInstanceId": rec["id"],
            "workflowStateVersion": 1,
            "currentContextRevisionId": rec["ctx"],
            "currentNodeVisitId": rec["visit"],
            "eventSequence": 1,
        }).encode()
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Location", f"/internal/v1/workflow-instances/{rec['id']}")
        self.end_headers()
        self.wfile.write(payload)


def write_fixtures():
    os.makedirs(MOCKBIN, exist_ok=True)
    os.makedirs(SANDBOX, exist_ok=True)
    with open(f"{TEST}/mock-creds.json", "w") as fh:
        json.dump({"credentials": {
            "agt_build-in-public-agent": {"clientId": CANARY_CLIENT, "clientSecret": CANARY_SECRET},
            "agt_someone-else": {"clientId": "mc_other", "clientSecret": "x"},
        }}, fh)
    with open(f"{TEST}/mock.env", "w") as fh:
        fh.write("DATABASE_URL=postgresql://mock:mockpass@localhost:5432/mockdb\n"
                 "WORKFLOW_BIND_ADDR=127.0.0.1\n"
                 "AUTH_V1_CANARY_ENABLED=true\n"
                 "AUTH_V1_CANARY_WRITE_ENABLED=true\n")
    psql = (
        "#!/bin/bash\n"
        "# mock psql: dispatches on the SQL text; records invoked SQL\n"
        "sql=\"$(printf '%s' \"$*\")\"\n"
        "if ! printf '%s' \"$sql\" | grep -q ' -c '; then\n"
        "  sql=\"$sql $(cat)\"  # W5 block arrives via stdin heredoc\n"
        "fi\n"
        f"printf '%s\\n' \"$sql\" >> {SANDBOX}/psql-invocations.log\n"
        "if printf '%s' \"$sql\" | grep -q 'FROM workflow_instances WHERE external_reference'; then\n"
        "  exit 0  # adoption probe: fresh mock DB has no prior fixture rows\n"
        "fi\n"
        "if printf '%s' \"$sql\" | grep -q 'BEGIN READ ONLY'; then\n"
        "  printf 'census_domain|192\\ncanary_transition_events|0\\ncanary_events|INSTANCE_CREATED|1\\ncontrol_events|INSTANCE_CREATED|1\\n'\n"
        "fi\n"
        "exit 0\n"
    )
    with open(f"{MOCKBIN}/psql", "w") as fh:
        fh.write(psql)
    os.chmod(f"{MOCKBIN}/psql", 0o755)


def build_test_copy():
    src = "/tmp/run-agent-core-workflow-canary-prep-v2.sh"
    with open(src) as fh:
        text = fh.read()
    reps = [
        ('[ "$(id -u)" = "0" ] || die "must run as root (sudo bash $SCRIPT_NAME)"',
         ': # MOCK: root gate bypassed for offline test'),
        ('readonly CRED_STORE="/usr/local/libexec/agent-core/config/agent-credentials.json"',
         f'readonly CRED_STORE="{TEST}/mock-creds.json"'),
        ('readonly AUTH_ORIGIN="http://127.0.0.1:4001"',
         f'readonly AUTH_ORIGIN="http://127.0.0.1:{AUTH_PORT}"'),
        ('readonly WF_ORIGIN="http://127.0.0.1:8989"',
         f'readonly WF_ORIGIN="http://127.0.0.1:{WF_PORT}"'),
        ('readonly WF_ENV="/Users/yanfenma/.local/services/svc-workflow/.env"',
         f'readonly WF_ENV="{TEST}/mock.env"'),
        ('export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"',
         f'export PATH="{MOCKBIN}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"'),
        ('readonly CANARY_CONFIG="/tmp/agent-core-workflow-canary-v1.json"',
         f'readonly CANARY_CONFIG="{SANDBOX}/agent-core-workflow-canary-v1.json"'),
        ('readonly MARKER_CANARY="/tmp/workflow-canary-prep-v2-canary.json"',
         f'readonly MARKER_CANARY="{SANDBOX}/canary.json"'),
        ('readonly MARKER_CONTROL="/tmp/workflow-canary-prep-v2-control.json"',
         f'readonly MARKER_CONTROL="{SANDBOX}/control.json"'),
        ('readonly FACTS_FILE="/tmp/workflow-canary-prep-v2-facts.json"',
         f'readonly FACTS_FILE="{SANDBOX}/facts.json"'),
        ('/tmp/canary-prep-v2-create-body.json', f'{SANDBOX}/cp2-create-body.json'),
        ('/tmp/canary-prep-v2-detail-canary.json', f'{SANDBOX}/cp2-detail-canary.json'),
        ('/tmp/canary-prep-v2-detail-control.json', f'{SANDBOX}/cp2-detail-control.json'),
        ('/tmp/canary-prep-v2-probe-todo.json', f'{SANDBOX}/cp2-probe-todo.json'),
        ('/tmp/canary-prep-v2-probe-bip.json', f'{SANDBOX}/cp2-probe-bip.json'),
    ]
    for old, new in reps:
        assert old in text, f"transform source missing: {old[:60]}"
        text = text.replace(old, new)
    out = f"{TEST}/runner-validated.sh"
    with open(out, "w") as fh:
        fh.write(text)
    os.chmod(out, 0o755)
    return out


def run_runner(path):
    return subprocess.run(["bash", path], input="APPLY WORKFLOW_CANARY_PREP_V2\n",
                          capture_output=True, text=True, timeout=120)


def main():
    os.chdir("/tmp")
    shutil.rmtree(TEST, ignore_errors=True)
    write_fixtures()
    auth = ThreadingHTTPServer(("127.0.0.1", AUTH_PORT), AuthHandler)
    wf = ThreadingHTTPServer(("127.0.0.1", WF_PORT), WfHandler)
    threading.Thread(target=auth.serve_forever, daemon=True).start()
    threading.Thread(target=wf.serve_forever, daemon=True).start()
    copy = build_test_copy()

    proc = run_runner(copy)
    out = proc.stdout + proc.stderr
    print("=== RUN 1 (fresh) ===")
    print(out)
    if proc.returncode != 0:
        print("MOCK_E2E=FAIL (run1 rc=%d)" % proc.returncode)
        return 1
    for needle in [
        "W1 PASS", "W2 PASS", "W3 PASS", "W4 PASS", "W5 PASS", "W6 PASS", "W7 PASS", "W8 PASS",
        "CANARY_PREREQS_READY=YES", "CANARY_INSTANCE_PROVISIONED = YES",
        "HTTP=403", "build-in-public-dogfood HTTP=200",
    ]:
        if needle not in out:
            print("MOCK_E2E=FAIL (missing marker: %s)" % needle)
            return 1
    if "CANARY_ISSUE" in out:
        print("MOCK_E2E=FAIL (unexpected CANARY_ISSUE)")
        return 1

    cfg_path = f"{SANDBOX}/agent-core-workflow-canary-v1.json"
    raw1 = open(cfg_path, "rb").read()
    sha1 = hashlib.sha256(raw1).hexdigest()
    cfg = json.loads(raw1)
    assert cfg["agentId"] == "agt_build-in-public-agent"
    assert cfg["domainId"] == TODO_DOMAIN
    assert cfg["canaryInstanceId"] == str(uuid.uuid5(NS, "workflow_execute_canary_v1"))
    assert cfg["controlInstanceId"] == str(uuid.uuid5(NS, "workflow_execute_canary_v1_control"))
    assert cfg["canaryInstanceId"] != cfg["controlInstanceId"]
    assert cfg["expectedAssigneePrincipalId"] == CANARY_PRINCIPAL
    assert "CANARY" in cfg["expectedCanaryTitle"]
    assert cfg["transitionDefinitionId"] == EXPECTED_TID
    assert cfg["expectedWorkflowStateVersion"] == 1
    assert cfg["paginationLimit"] == 2 and cfg["expectedMinimumPages"] >= 2
    assert cfg["expectedMinimumInstances"] > cfg["paginationLimit"]
    assert cfg["dedicatedNoBusinessSideEffects"] is True
    assert cfg["submissionPayload"] == {"summary": cfg["submissionPayload"]["summary"]}
    assert set(cfg["expectedSubmissionSchemaKeys"]) == {"summary"}

    proc2 = run_runner(copy)
    out2 = proc2.stdout + proc2.stderr
    print("=== RUN 2 (rerun/adoption) ===")
    print(out2)
    if proc2.returncode != 0:
        print("MOCK_E2E=FAIL (run2 rc=%d)" % proc2.returncode)
        return 1
    if "SKIP create: marker present" not in out2:
        print("MOCK_E2E=FAIL (rerun did not skip creates)")
        return 1
    raw2 = open(cfg_path, "rb").read()
    sha2 = hashlib.sha256(raw2).hexdigest()
    if raw1 != raw2 or sha1 != sha2:
        print("MOCK_E2E=FAIL (config not byte-identical on rerun)")
        return 1

    env_now = open(f"{TEST}/mock.env").read()
    if "ALLOWED" in env_now:
        print("MOCK_E2E=FAIL (allowlist written)")
        return 1
    if len(CREATED) != 2:
        print("MOCK_E2E=FAIL (created %d instances, expected 2)" % len(CREATED))
        return 1

    with open(f"{SANDBOX}/run1-transcript.txt", "w") as fh:
        fh.write(out)
    with open(f"{SANDBOX}/run2-transcript.txt", "w") as fh:
        fh.write(out2)
    shutil.copy(cfg_path, f"{SANDBOX}/generated-config.json")

    print("MOCK_E2E=PASS run1_rc=0 run2_rc=0 instances_created=2 config_sha256=%s" % sha1)
    print("MOCK_CFG_BYTES=%d" % len(raw1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
