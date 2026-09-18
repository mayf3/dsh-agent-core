"""Fixed non-root first Broker delivery; receipt observation, never state authority."""
import hashlib
import json
import re

OPERATION = "first-live-dsh-20260918-01"
GOAL = "WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DELIVERY_V2"
SOURCE = "59472b631129d1ea3ca1202cbcbbc0799b083114"
REQUEST = OPERATION + "-broker-submit"


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def digest(value):
    require(isinstance(value, str) and re.fullmatch("[0-9a-f]{64}", value), "DIGEST")
    return value


def positive(value, minimum=1):
    require(type(value) is int and minimum <= value < 2 ** 53, "INTEGER")
    return value


def check_handoff(h, now):
    require(type(h) is dict and set(h) == {
        "version", "operation_id", "package_sha256", "issuer_sha256", "ctl_sha256",
        "artifact_sha256", "manifest_sha256", "acceptance_revision", "profile_revision",
        "issued_at", "expires_at", "mode", "existing"}, "HANDOFF_SHAPE")
    require(type(h["version"]) is int and h["version"] == 1 and
            h["operation_id"] == OPERATION and h["acceptance_revision"] == "DEPLOYMENT_DELIVERY_V1",
            "HANDOFF_BINDING")
    for key in ("package", "issuer", "ctl", "artifact", "manifest"):
        digest(h[key + "_sha256"])
    require(isinstance(h["profile_revision"], str) and
            re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", h["profile_revision"]), "PROFILE")
    start, end = positive(h["issued_at"]), positive(h["expires_at"])
    require(start <= now <= start + 60 and now < end <= start + 3600, "HANDOFF_EXPIRED")
    require(h["mode"] in ("submit", "verify-existing"), "HANDOFF_MODE")
    e = h["existing"]
    if h["mode"] == "submit":
        require(e is None, "HANDOFF_EXISTING")
    else:
        require(type(e) is dict and set(e) == {"unit_id", "attempt", "target_generation",
                "service_generation", "no_inflight_mutation", "goal_receipt_digest"}, "HANDOFF_EXISTING")
        digest(e["unit_id"])
        positive(e["attempt"])
        positive(e["target_generation"])
        require(e["no_inflight_mutation"] is True and isinstance(e["service_generation"], str)
                and 0 < len(e["service_generation"]) <= 512, "STOP_RECONCILE")
        if e["goal_receipt_digest"] is not None:
            digest(e["goal_receipt_digest"])


def check_status(s, h, unit):
    require(type(s) is dict and type(s.get("unit")) is dict, "STATUS_SHAPE")
    u = s["unit"]
    expected = {"deployment_unit_id": unit, "repo": "mayf3/dsh-agent-core",
        "deployment_profile": "dsh-app", "profile_revision": h["profile_revision"],
        "target_runtime": "dsh-system-runtime", "source_sha": SOURCE,
        "artifact_sha256": h["artifact_sha256"], "manifest_digest": h["manifest_sha256"]}
    require(all(u.get(k) == v for k, v in expected.items()), "UNIT_BINDING")
    require(u.get("covered_goal_ids") == [GOAL] and u.get("goal_coverage") == [{
        "goal_id": GOAL, "acceptance_revision": h["acceptance_revision"], "source_sha": SOURCE,
        "release_face_sha256": h["manifest_sha256"], "verification_profile": "native-installed-readback-v1"}],
        "GOAL_BINDING")
    positive(u.get("expected_target_generation"), 0)
    positive(s.get("revision"))
    positive(s.get("mutating_attempts"), 0)
    require(s.get("state") in ("Queued", "Precheck", "Applying", "Restarting", "Verifying", "Finalizing", "Applied"),
            "STOP_RECONCILE")
    receipts = s.get("receipt_digests")
    require(type(receipts) is list and len(receipts) <= 256 and len(set(receipts)) == len(receipts), "RECEIPT_LIST")
    for d in receipts:
        digest(d)
    e = h["existing"]
    if e:
        require(s["state"] == "Applied" and s["mutating_attempts"] == e["attempt"] and
                u["expected_target_generation"] + 1 == e["target_generation"], "STOP_RECONCILE")
    return s


def match_receipts(records, s, h, attachment):
    """Controller already validates signatures; retain hashes, do not assert independent signing authority."""
    unit = s["unit"]["deployment_unit_id"]
    generation = s["unit"]["expected_target_generation"] + 1
    attempt = s["mutating_attempts"]
    transactions, goals = [], []
    for d in s["receipt_digests"]:
        r = records[d]
        if r.get("unit_id") == unit and r.get("attempt") == attempt and "postimage_digest" in r:
            require(all(r.get(k) == v for k, v in {"artifact_sha256": h["artifact_sha256"],
                "source_sha": SOURCE, "profile_revision": h["profile_revision"],
                "target_generation": generation, "rollback_digest": None}.items()), "TRANSACTION_BINDING")
            require(isinstance(r.get("new_service_generation"), str) and r["new_service_generation"], "SERVICE_GENERATION")
            transactions.append((d, r))
        p = r.get("payload")
        if type(p) is dict and p.get("unit_id") == unit and p.get("goal_id") == GOAL and p.get("attempt") == attempt:
            require(p.get("acceptance_revision") == h["acceptance_revision"] and
                    p.get("target_generation") == generation, "GOAL_RECEIPT_BINDING")
            positive(p.get("revision"))
            require(p.get("outcome") in ("Pass", "Fail", "Pending", "WaitingExternalAcceptance", "OutcomeUnknown"), "GOAL_OUTCOME")
            goals.append((d, r))
    if not transactions or not goals:
        return None
    require(len(transactions) == 1, "TRANSACTION_AMBIGUOUS")
    td, tx = transactions[0]
    goals.sort(key=lambda pair: pair[1]["payload"]["revision"])
    require(len({r["payload"]["revision"] for _, r in goals}) == len(goals), "GOAL_REVISION")
    gd, gr = goals[-1]
    p = gr["payload"]
    require(p.get("service_generation") == tx["new_service_generation"] and
            p.get("attachment_digest") in tx.get("attachment_digests", []) and
            (attachment is None or p["attachment_digest"] == attachment), "GOAL_RECEIPT_BINDING")
    if h["existing"]:
        require(tx["new_service_generation"] == h["existing"]["service_generation"], "STOP_RECONCILE")
    require(p["outcome"] not in ("Fail", "OutcomeUnknown"), "STOP_RECONCILE")
    if p["outcome"] != "Pass":
        return None
    digest(p.get("evidence_digest"))
    require(isinstance(gr.get("issuer"), str) and gr["issuer"] != "daemon-observation" and
            isinstance(gr.get("signature"), str) and re.fullmatch("[0-9a-fA-F]{128}", gr["signature"]), "SIGNED_GOAL_RECEIPT")
    return td, gd, tx


def run_once(handoff, journal, transport):
    h = handoff
    check_handoff(h, transport.now())
    require(not journal.consumed(), "ONCE_ALREADY_CONSUMED")
    journal.write("intent.json", {"version": 1, "request_id": REQUEST, "handoff_sha256": sha(canonical(h)),
        "operation_id": OPERATION, "goal_id": GOAL, "source_sha": SOURCE})
    end = min(h["expires_at"], transport.now() + 1800)
    sequence = 0

    def call(action, argument):
        nonlocal sequence
        require(transport.now() < end, "OUTCOME_UNKNOWN_DEADLINE")
        sequence += 1
        name = f"call-{sequence:04d}"
        journal.write(name + "-intent.json", {"action": action, "argument": argument, "request_id": REQUEST})
        reply = transport.call(action, argument, REQUEST)
        journal.write(name + "-result.json", reply)
        require(type(reply) is dict and "error" not in reply, "CONTROLLER_ERROR")
        require(transport.now() < end, "OUTCOME_UNKNOWN_DEADLINE")
        if action == "prepare":
            return reply
        require(set(reply) == {"result"} and type(reply["result"]) is dict, "REPLY_SHAPE")
        return reply["result"]

    cache, before, attachment = {}, set(), None
    if h["mode"] == "submit":
        proposal = digest(call("prepare", SOURCE).get("proposal_digest"))
        submitted = call("submit", proposal)
        unit = digest(submitted.get("unit_id"))
        attachment = digest(submitted.get("attachment_digest"))
        require(type(submitted.get("install_required")) is bool, "SUBMISSION_SHAPE")
        # CLI exposes no current-installation proof. Already-landed without protected coordinates stops.
        require(submitted["install_required"], "STOP_RECONCILE")
    else:
        unit = h["existing"]["unit_id"]
    retried = False
    while True:
        s = check_status(call("status", unit), h, unit)
        for d in s["receipt_digests"]:
            if d not in cache:
                r = call("receipt", d)
                require(sha(canonical(r)) == d, "RECEIPT_DIGEST")
                cache[d] = r
        matched = match_receipts(cache, s, h, attachment)
        if h["existing"] and not retried:
            known = h["existing"]["goal_receipt_digest"]
            if known is not None:
                require(matched is not None and matched[1] == known, "STOP_RECONCILE")
            else:
                # An old PASS cannot prove that a queued retry actually ran.
                require(matched is None, "STOP_RECONCILE")
                before = set(s["receipt_digests"])
                require(call("retry-verification", unit) == {"queued": True}, "RETRY_REPLY")
                retried = True
                transport.pause()
                continue
        if s["state"] == "Applied" and matched:
            td, gd, tx = matched
            require(not retried or gd not in before, "STOP_RECONCILE")
            final = check_status(call("status", unit), h, unit)
            require(final == s, "STATUS_DRIFT")
            result = {"version": 1, "state": "BROKER_DELIVERY_RECEIPTS_OBSERVED",
                "operation_id": OPERATION, "request_id": REQUEST, "goal_id": GOAL, "source_sha": SOURCE,
                "handoff_sha256": sha(canonical(h)), "unit_id": unit, "transaction_receipt_digest": td,
                "goal_receipt_digest": gd, "attempt": tx["attempt"], "target_generation": tx["target_generation"],
                "service_generation": tx["new_service_generation"], "status_revision": s["revision"],
                "observation_basis": "protected-handoff-and-controller-receipts" if h["existing"] else "new-submission-and-controller-receipts",
                "observed_at": transport.now(), "business_goal_complete": False,
                "global_current_state_attested": False}
            journal.write("result.json", result)
            return result
        transport.pause()


if __name__ == "__main__":
    from broker_delivery_io import main
    main()
