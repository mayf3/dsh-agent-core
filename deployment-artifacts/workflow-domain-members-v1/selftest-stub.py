#!/usr/bin/env python3
"""Selftest stub stack for OWNER_DOGFOOD.sh (--selftest mode).

Plays auth-service (4001) + svc-workflow (8989) with URL-shape-matched
stateless-ish stubs. A tiny in-memory state makes the membership semantics
real enough to exercise every assertion: bindings map, receipt map (IK ->
(status, body)), delegation rejection, worklist, instance detail.
Field names mirror the wire contract exactly (camelCase requests where
deny_unknown_fields applies, snake_case business responses).
"""
import json, sys, re, base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE = {
    "principals": {
        "agt_efficiency-agent": {"sub": "b21ddb23-0000-4000-8000-00000000eff1"},
        "agt_ceo-agent": {"sub": "25a6789f-daa5-4600-a764-b0209b9c8e19"},
    },
    "domain": "10000000-0000-0000-0000-000000000100",
    "bindings": {     # (domain, principal) -> role; the owner owns the domain (production state)
        ("10000000-0000-0000-0000-000000000100", "b21ddb23-0000-4000-8000-00000000eff1"): "DOMAIN_OWNER",
    },
    "receipts": {},   # IK -> (status, body)
    "instances": {},  # id -> assignee
    "definitions": 0,
    "version": 0,
}
TOKEN_RE = re.compile(r"tok-(efficiency|ceo|directory)-(.+)", re.S)

def principal_of(who):
    return STATE["principals"]["agt_efficiency-agent" if who == "owner" else "agt_ceo-agent"]["sub"]

class Handler(BaseHTTPRequestHandler):
    def _json(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("x-request-id", "stub-req-1")
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _auth(self):
        m = TOKEN_RE.match(self.headers.get("Authorization", "")[7:] or "")
        if not m:
            return None
        return {"efficiency": "owner", "ceo": "lobster", "directory": "directory"}[m.group(1)]

    def do_GET(self):
        who = self._auth()
        if self.path == "/version":
            return self._json(200, {"service": "svc-workflow", "version": "selftest", "gitSha": "stubsha"})
        if self.path.startswith("/api/v1/directory/principals/"):
            pid = self.path.rstrip("/").split("/")[-2]  # .../{principalId}/agent
            if pid == principal_of("lobster"):
                return self._json(200, {"principalId": pid, "agentId": "agt_ceo-agent", "principalStatus": "active"})
            return self._json(404, {"error": "PRINCIPAL_NOT_FOUND"})
        if who is None:
            return self._json(401, {"error": {"code": "unauthenticated", "message": "stub"}})
        if self.path.startswith("/internal/v1/principals/me/domains"):
            me = principal_of(who)
            items = []
            if STATE["bindings"].get((STATE["domain"], me)):
                items.append({"domain_id": STATE["domain"], "domain_key": "workflow-todo-dogfood",
                              "display_name": "Workflow Todo Dogfood", "caller_role":
                              STATE["bindings"][(STATE["domain"], me)], "binding_created_at": "stub"})
            return self._json(200, {"items": items})
        if self.path.startswith("/internal/v1/domains/") and self.path.endswith("/members"):
            items = [{"principal_id": p, "principal_type": "agent", "display_name": "龙虾合伙人",
                      "role": r, "binding_created_at": "stub"}
                     for (d, p), r in STATE["bindings"].items() if d == STATE["domain"] and r == "DOMAIN_MEMBER"]
            return self._json(200, {"items": items, "next_cursor": None})
        if self.path.startswith("/internal/v1/worklists/assigned-to-me"):
            me = principal_of(who)
            items = [{"detail": {"instance": {"workflow_instance_id": i, "domain_id": STATE["domain"]}}}
                     for i, a in STATE["instances"].items() if a == me]
            return self._json(200, {"items": items, "next_cursor": None})
        m = re.match(r"^/internal/v1/workflow-instances/([^/]+)$", self.path)
        if m and who:
            iid = m.group(1)
            if iid in STATE["instances"]:
                me = principal_of(who)
                return self._json(200, {"visibility": "full" if STATE["instances"][iid] == me else "restricted",
                                        "detail": {"current_visit": {"assignee_principal_id": STATE["instances"][iid]}}})
            return self._json(404, {"error": {"code": "workflow_instance_not_found_or_not_visible", "message": "stub"}})
        return self._json(404, {"error": {"code": "route_not_found", "message": "stub"}})

    def do_POST(self):
        if self.path == "/oauth/token":
            import base64 as b64
            from urllib.parse import parse_qs
            form = parse_qs(self._body().decode())
            who = (form.get("client_id") or [None])[0]
            if who is None:
                basic = self.headers.get("Authorization", "")
                if basic.startswith("Basic "):
                    who = b64.b64decode(basic[6:]).decode().split(":")[0]
            sub = STATE["principals"].get(who, {}).get("sub")
            if sub is None:
                return self._json(400, {"error": "invalid_client"})
            resource = (form.get("resource") or [None])[0]
            if who is None or STATE["principals"].get(who, {}).get("sub") is None:
                return self._json(400, {"error": "invalid_client"})
            kind = "directory" if resource == "identity-directory" else who.replace("agt_", "").split("-")[0]
            seg = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=").decode()
            jwt_like = seg({"alg": "none", "typ": "JWT"}) + "." + seg({"sub": sub, "token_use": "access"}) + ".stub-sig"
            return self._json(200, {"access_token": f"tok-{kind}-" + jwt_like, "token_type": "Bearer", "expires_in": 590})
        who = self._auth()
        if who is None:
            return self._json(401, {"error": {"code": "unauthenticated", "message": "stub"}})
        if re.match(r"^/internal/v1/domains/[0-9a-f-]+/definitions$", self.path):
            return self._json(200, {"workflowDefinitionId": "stub-definition-1", "definitionKey": "stub", "domainId": STATE["domain"]})
        if "/definitions" in self.path and self.path.endswith("/versions"):
            STATE["definitions"] += 1
            return self._json(200, {"definitionVersionId": "stub-version-1", "status": "DRAFT", "revision": "r1"})
        if self.path.endswith("/draft"):
            return self._json(200, {"ok": True, "status": "DRAFT"})
        if self.path.endswith("/publish"):
            return self._json(200, {"status": "PUBLISHED"})
        if self.path == "/internal/v1/workflow-instances":
            lobster = principal_of("lobster")
            iid = f"stub-instance-{len(STATE['instances']) + 1}"
            STATE["instances"][iid] = lobster
            return self._json(200, {"workflowInstanceId": iid, "workflowStateVersion": 1})
        return self._json(404, {"error": {"code": "route_not_found", "message": "stub"}})

    def do_PUT(self):
        who = self._auth()
        if who is None:
            return self._json(401, {"error": {"code": "unauthenticated", "message": "stub"}})
        if re.match(r"^/internal/v1/domains/[0-9a-f-]+/definitions/[^/]+/draft$", self.path):
            return self._json(200, {"status": "DRAFT"})
        m = re.match(r"^/internal/v1/domains/([0-9a-f-]+)/members/([0-9a-f-]+)$", self.path)
        if not m:
            return self._json(404, {"error": {"code": "route_not_found", "message": "stub"}})
        domain, target = m.group(1), m.group(2)
        if domain != STATE["domain"]:
            return self._json(404, {"error": {"code": "domain_not_found", "message": "stub"}})
        me = principal_of(who)
        if STATE["bindings"].get((domain, me)) != "DOMAIN_OWNER":
            return self._json(403, {"error": {"code": "not_domain_owner", "message": "caller is not a domain owner"}})
        ik = self.headers.get("Idempotency-Key", "")
        if ik in STATE["receipts"]:
            status, body = STATE["receipts"][ik]
            return self._json(status, body)
        role = "DOMAIN_MEMBER"
        raw = self._body()
        if raw:
            req = json.loads(raw)
            role = req.get("role", "DOMAIN_MEMBER")
        if role == "DOMAIN_OWNER":
            body = {"error": {"code": "domain_owner_delegation_forbidden",
                              "message": "a domain owner cannot grant DOMAIN_OWNER (stub)"}}
            STATE["receipts"][ik] = (403, body)
            return self._json(403, body)
        if target == principal_of("owner"):
            body = {"error": {"code": "principal_is_owner", "message": "stub"}}
            STATE["receipts"][ik] = (409, body)
            return self._json(409, body)
        if STATE["bindings"].get((domain, target)) == "DOMAIN_MEMBER":
            body = {"error": {"code": "already_member", "message": "stub"}}
            STATE["receipts"][ik] = (409, body)
            return self._json(409, body)
        STATE["bindings"][(domain, target)] = "DOMAIN_MEMBER"
        body = {"domainId": domain, "principalId": target, "role": "DOMAIN_MEMBER"}
        STATE["receipts"][ik] = (200, body)
        return self._json(200, body)

    def log_message(self, *a):
        pass

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
