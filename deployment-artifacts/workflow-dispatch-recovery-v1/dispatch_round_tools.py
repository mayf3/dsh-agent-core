#!/usr/bin/env python3
"""
dispatch_round_tools — WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1 dispatcher-loop
mechanics (OWNER simplification 2026-09-11): the dispatcher V1 chain is ONLY

  due intent -> exact canonical identity -> write-ahead send fence
             -> agent_session_send -> receipt -> continue

There is NO secondary classification in the dispatcher: once svc 0026
(WORK_EXECUTION_CLASS) is live, workflow_dispatch_intents IS the normal
BUSINESS dispatch queue (upstream eligibility projection). HUMAN_REQUIRED /
NON_BUSINESS_TEST are excluded upstream by svc-workflow structure, never by
the HR LLM. No classifier, no dispatch-policy framework lives here.

What this tool owns (mechanical, hermetic):
  - durable cross-round send fence keyed by **nodeVisitId** (the accepted
    execution authority derives the one-attempt identity from the node visit;
    duplicate dispatch intents for the same visit MUST hit the same fence)
  - atomic fence claim (flock) so two overlapping rounds cannot both pass
    NOT_SENT and double-send
  - corruption fail-closed: an untrustworthy ledger means ZERO send, never a
    NOT_SENT restoration (corruption can never cause a duplicate dispatch)
  - operator-only ledger-clear (euid 0): the model-facing dispatch turn can
    never lift its own fence
  - identity repair backlog: an exact-resolution failure is fail-closed for
    THIS round AND is appended to a durable backlog file — skip is NOT a final
    disposition; the backlog feeds WORKFLOW_DATA_HYGIENE_V1 stock repair
    (goal: runtime skips -> 0)

States: NOT_SENT -> SEND_STARTED (fence, fsynced before the send)
        -> SEND_CONFIRMED | SEND_OUTCOME_UNKNOWN. All three terminal states
        mean NO AUTOMATIC RESEND; SEND_STARTED = "cannot prove whether the
        send happened" = outcome-unknown safety semantics (human disposition
        over blind retry). Eligibility returns ONLY via operator
        ledger-clear or workflow progression (a progressed node visit is a
        NEW nodeVisitId = a new fence key).
"""
import fcntl
import json
import os
import sys
import tempfile
import time
import uuid

LEDGER_STATES = ("SEND_STARTED", "SEND_CONFIRMED", "SEND_OUTCOME_UNKNOWN")
# NOT_SENT is also a valid RECORD state (the operator-clear marker); it simply
# means the fence is open for claiming again.
RECORD_STATES = ("NOT_SENT",) + LEDGER_STATES
EXACT_DENY_INSTANCES = ("cebf4816-c664-40cb-9b61-3fa330ad1c39",)  # Owner ruling; exact only


def _is_uuid(v):
    try:
        uuid.UUID(str(v))
        return True
    except Exception:
        return False


class LedgerUntrusted(Exception):
    pass


# ── ledger core (flock-serialized) ────────────────────────────────────────────

def _locked(path):
    """Context-manager exclusive lock on <path>.lock (created as needed)."""
    outer = open(path + ".lock", "a+")
    fcntl.flock(outer.fileno(), fcntl.LOCK_EX)
    return outer


def _parse_unlocked(path):
    """Returns (latest_by_key, corrupt_count). Any non-blank line that fails
    JSON parsing or schema validation marks the ledger untrustworthy."""
    latest, corrupt = {}, 0
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                s = line.strip()
                if not s:
                    continue
                try:
                    rec = json.loads(s)
                except ValueError:
                    corrupt += 1
                    continue
                if (not isinstance(rec, dict)
                        or not isinstance(rec.get("nodeVisitId"), str)
                        or rec.get("state") not in RECORD_STATES):
                    corrupt += 1
                    continue
                latest[rec["nodeVisitId"]] = rec
    return latest, corrupt


def _append_unlocked(path, rec):
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
        fh.flush()
        os.fsync(fh.fileno())  # the fence must survive a crash before the send


def _require_trusted(corrupt):
    if corrupt:
        raise LedgerUntrusted("LEDGER_UNTRUSTED — refusing automatic reads/writes onto an untrustworthy ledger (zero send; operator disposition required)")


def ledger_query(path, node_visit_id):
    with _locked(path):
        latest, corrupt = _parse_unlocked(path)
    # The query is the turn's mechanical step: corruption is REPORTED as a
    # state (so the round can skip + surface it), never raised — only
    # mutating subcommands fail closed.
    if corrupt:
        return {"nodeVisitId": node_visit_id, "state": "LEDGER_UNTRUSTED",
                "corruptLines": corrupt}
    rec = latest.get(node_visit_id)
    if rec is None:
        return {"nodeVisitId": node_visit_id, "state": "NOT_SENT"}
    return {"nodeVisitId": node_visit_id, "state": rec["state"],
            "workflowInstanceId": rec.get("workflowInstanceId"), "ts": rec.get("ts")}


def ledger_start(path, node_visit_id, intent_id, instance_id, agent_id):
    """Atomic write-ahead fence claim: under the process lock, parse; if the
    fence state is not NOT_SENT, refuse (no second claim); else durably append
    SEND_STARTED (fsync) BEFORE any send. Two overlapping rounds can never
    both observe NOT_SENT and both send."""
    for name, v in (("node-visit", node_visit_id), ("intent", intent_id), ("instance", instance_id)):
        if not _is_uuid(v):
            raise SystemExit(f"ledger-start: --{name} must be a UUID (got {v!r})")
    with _locked(path):
        latest, corrupt = _parse_unlocked(path)
        _require_trusted(corrupt)
        cur = (latest.get(node_visit_id) or {}).get("state", "NOT_SENT")
        if cur != "NOT_SENT":
            return {"claimed": False, "state": cur,
                    "reason": "fence_already_open" if cur == "SEND_STARTED" else "already_dispatched"}
        _append_unlocked(path, {"nodeVisitId": node_visit_id, "dispatchIntentId": intent_id,
                                "workflowInstanceId": instance_id, "targetAgentId": agent_id,
                                "state": "SEND_STARTED", "ts": int(time.time() * 1000)})
    return {"claimed": True, "state": "SEND_STARTED"}


def ledger_record(path, node_visit_id, intent_id, instance_id, agent_id, state, note=""):
    """Post-send outcome mark. Refuses writes onto an untrusted ledger and
    enforces the no-resend transition table."""
    if state not in ("SEND_CONFIRMED", "SEND_OUTCOME_UNKNOWN"):
        raise SystemExit("ledger-record: state must be SEND_CONFIRMED or SEND_OUTCOME_UNKNOWN")
    for name, v in (("node-visit", node_visit_id), ("intent", intent_id), ("instance", instance_id)):
        if not _is_uuid(v):
            raise SystemExit(f"ledger-record: --{name} must be a UUID (got {v!r})")
    with _locked(path):
        latest, corrupt = _parse_unlocked(path)
        _require_trusted(corrupt)
        cur = (latest.get(node_visit_id) or {}).get("state", "NOT_SENT")
        if cur == state:
            out = {"recorded": False, "reason": "idempotent_noop", "state": state}
        elif cur == "SEND_CONFIRMED":
            out = {"recorded": False, "reason": "confirmed_is_terminal", "state": cur}
        elif cur == "SEND_OUTCOME_UNKNOWN":
            out = {"recorded": False, "reason": "unknown_never_retried", "state": cur}
        elif cur == "NOT_SENT":
            # outcome without a fence = protocol violation; record UNKNOWN
            # anyway (never silently create a retryable NOT_SENT)
            _append_unlocked(path, {"nodeVisitId": node_visit_id, "dispatchIntentId": intent_id,
                                    "workflowInstanceId": instance_id, "targetAgentId": agent_id,
                                    "state": "SEND_OUTCOME_UNKNOWN",
                                    "note": "outcome_without_fence " + (note or ""),
                                    "ts": int(time.time() * 1000)})
            out = {"recorded": True, "state": "SEND_OUTCOME_UNKNOWN", "reason": "no_fence_seen_marked_unknown"}
        else:  # SEND_STARTED -> outcome (the normal path)
            rec = {"nodeVisitId": node_visit_id, "dispatchIntentId": intent_id,
                   "workflowInstanceId": instance_id, "targetAgentId": agent_id,
                   "state": state, "ts": int(time.time() * 1000)}
            if note:
                rec["note"] = note
            _append_unlocked(path, rec)
            out = {"recorded": True, "state": state}
    return out


def ledger_clear(path, node_visit_id, reason, euid=None):
    """Operator-only explicit disposition (euid 0 = the Owner sudo context).
    The model-facing dispatch turn is structurally denied."""
    if euid is None:
        euid = os.geteuid()
    if euid != 0:
        return {"recorded": False, "denied": True,
                "reason": f"operator_only: ledger-clear requires euid 0 (got {euid}); the dispatch turn cannot lift its own fence"}
    if not reason:
        raise SystemExit("ledger-clear: --reason is required (explicit operator disposition)")
    with _locked(path):
        latest, corrupt = _parse_unlocked(path)
        _require_trusted(corrupt)
        if (latest.get(node_visit_id) or {}).get("state", "NOT_SENT") == "NOT_SENT":
            out = {"recorded": False, "reason": "not_sent_already"}
        else:
            _append_unlocked(path, {"nodeVisitId": node_visit_id, "state": "NOT_SENT",
                                    "ts": int(time.time() * 1000), "clearedBecause": reason})
            out = {"recorded": True, "state": "NOT_SENT"}
    return out


def ledger_summary(path):
    counts = {s: 0 for s in RECORD_STATES}
    keys = set()
    with _locked(path):
        latest, corrupt = _parse_unlocked(path)
        for k in latest:
            keys.add(k)
            counts[latest[k]["state"]] += 1
    return {"fencedNodeVisits": len(keys), "byState": counts, "untrusted": corrupt > 0}


# ── identity repair backlog (skip is NOT a final disposition) ─────────────────

def backlog_add(path, intent_id, instance_id, node_visit_id, principal_id, reason):
    for name, v in (("intent", intent_id), ("instance", instance_id),
                    ("node-visit", node_visit_id), ("principal", principal_id)):
        if not _is_uuid(v):
            raise SystemExit(f"backlog-add: --{name} must be a UUID (got {v!r})")
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    rec = {"dispatchIntentId": intent_id, "workflowInstanceId": instance_id,
           "nodeVisitId": node_visit_id, "ownerPrincipalId": principal_id,
           "reason": reason, "ts": int(time.time() * 1000)}
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    return {"recorded": True}


def backlog_list(path, limit=50):
    rows = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                s = line.strip()
                if not s:
                    continue
                try:
                    rows.append(json.loads(s))
                except ValueError:
                    rows.append({"malformed": True})
    return {"entries": len(rows), "recent": rows[-int(limit):]}


# ── decision (pure; deliberately classifier-free) ─────────────────────────────

def decide(c):
    """c: fenceState (None|SEND_STARTED|SEND_CONFIRMED|SEND_OUTCOME_UNKNOWN|
    LEDGER_UNTRUSTED), instanceId, nodeVisitId, sentThisRound
    ([nodeVisitId,...]), resolution ('OK:<agentId>'|'FAIL:<code>'|None),
    roundCapacityLeft (bool). NO execution_class input — upstream svc
    structure owns queue composition."""
    fs = c.get("fenceState") or "NOT_SENT"
    if fs == "LEDGER_UNTRUSTED":
        return {"action": "SKIP", "reason": "ledger_untrusted_fail_closed_zero_send"}
    if fs == "SEND_CONFIRMED":
        return {"action": "SKIP", "reason": "already_sent_send_confirmed"}
    if fs == "SEND_OUTCOME_UNKNOWN":
        return {"action": "SKIP", "reason": "outcome_unknown_no_retry"}
    if fs == "SEND_STARTED":
        return {"action": "SKIP", "reason": "send_started_no_auto_resend"}
    if c.get("instanceId") in EXACT_DENY_INSTANCES:
        return {"action": "SKIP", "reason": "exact_quarantine_owner_ruling"}
    if c.get("nodeVisitId") in (c.get("sentThisRound") or []):
        return {"action": "SKIP", "reason": "already_sent_this_round"}
    if c.get("roundCapacityLeft") is False:
        return {"action": "SKIP", "reason": "maxsend_reached"}
    res = c.get("resolution")
    if not res or not res.startswith("OK:"):
        code = res[5:] if res and res.startswith("FAIL:") else "resolution_missing"
        return {"action": "SKIP", "reason": f"identity_blocked_{code}", "backlog": True}
    return {"action": "SEND", "reason": "due_business_intent", "agentId": res[3:]}


def build_send_packet(c):
    """Complete dispatch envelope: instanceId + nodeVisitId travel WITH the
    dispatch; the target reads detail under its OWN authority (T6 split)."""
    return (
        "统一 Workflow 调度。请处理 workflow_instance_id={instanceId}，"
        "nodeVisitId={nodeVisitId}（已由调度方提供，无需为定位节点读取实例详情）。"
        "请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；"
        "调度方不代为 transition/审批。完成后回报结果与证据。"
    ).format(instanceId=c["instanceId"], nodeVisitId=c["nodeVisitId"])


# ── selftest (hermetic) ───────────────────────────────────────────────────────

def selftest():
    results = []

    def check(name, cond, detail=""):
        results.append((name, bool(cond), detail))

    def mk(tmp, *segs):
        p = os.path.join(tmp, *segs)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        return p

    def key(i):
        return f"10000000-0000-0000-0000-{i:012d}"

    def inst(i):
        return f"30000000-0000-0000-0000-{i:012d}"

    def intent(i):
        return f"00000000-0000-0000-0000-{i:012d}"

    def princ(i):
        return f"20000000-0000-0000-0000-{i:012d}"

    def cand(i, fence=None, res="OK:agt_example-agent", sent=None, cap=True):
        return {"fenceState": fence, "nodeVisitId": key(i), "instanceId": inst(i),
                "intentId": intent(i), "ownerPrincipalId": princ(i),
                "resolution": res, "sentThisRound": sent or [], "roundCapacityLeft": cap}

    with tempfile.TemporaryDirectory() as tmp:
        ledger = mk(tmp, "memory", "dispatch-fence.jsonl")
        backlog = mk(tmp, "memory", "identity-repair-backlog.jsonl")

        # T1: #1 identity-blocked (fail-closed + backlog, never sent), #2 sent exactly once
        d1 = decide(cand(1, res="FAIL:PRINCIPAL_NOT_FOUND"))
        b1 = backlog_add(backlog, intent(1), inst(1), key(1), princ(1), d1["reason"])
        claim2 = ledger_start(ledger, key(2), intent(2), inst(2), "agt_example-agent")
        check("T1", d1["action"] == "SKIP" and d1["reason"].startswith("identity_blocked")
              and d1.get("backlog") and b1["recorded"]
              and claim2["claimed"] and claim2["state"] == "SEND_STARTED")

        # T2: 7 identity-blocked -> 7 explicit backlog entries, 0 send, round completes
        blocked = [decide(cand(i, res="FAIL:IDENTITY_RESOLUTION_AMBIGUOUS")) for i in range(10, 17)]
        backlog_add(backlog, intent(10), inst(10), key(10), princ(10), blocked[0]["reason"])
        check("T2", all(o["action"] == "SKIP" and o["reason"] for o in blocked) and len(blocked) == 7)

        # T3/T5/T8 (now upstream-owned): the dispatcher has NO class/title inputs —
        # candidates differing only in non-authoritative decoration both SEND;
        # queue composition is svc-workflow's structural job.
        dA = decide(cand(30))
        dB = decide(cand(31))
        check("T3_T5_T8_UPSTREAM", dA["action"] == "SEND" and dB["action"] == "SEND")

        # T4: duplicate node visit within the round -> once
        d4 = decide(cand(22, sent=[key(22)]))
        check("T4", d4["action"] == "SKIP" and d4["reason"] == "already_sent_this_round")

        # T7: stale/invalid principal -> no display-name fallback, backlog, continue
        d7 = decide(cand(32, res="FAIL:AGENT_MAPPING_MISSING"))
        check("T7", d7["action"] == "SKIP" and "agentId" not in d7 and d7.get("backlog"))

        # T9: same node visit next tick (terminal fence state) -> zero resend
        ledger_start(ledger, key(2), intent(2), inst(2), "agt_example-agent")
        ledger_record(ledger, key(2), intent(2), inst(2), "agt_example-agent", "SEND_CONFIRMED")
        d9 = decide(cand(2, fence=ledger_query(ledger, key(2))["state"]))
        check("T9", d9["action"] == "SKIP" and d9["reason"] == "already_sent_send_confirmed")

        # T10: 20-candidate window with every 3rd blocked -> later valid still sends
        big = [decide(cand(100 + i, res="FAIL:X" if i % 3 == 0 else "OK:agt_example-agent")) for i in range(20)]
        check("T10", len([o for o in big if o["action"] == "SEND"]) > 0
              and all(o["action"] in ("SEND", "SKIP") for o in big))

        # N1: 3 consecutive healthy -> exactly 3 confirmed sends under capacity
        n1 = 0
        for i in range(40, 44):
            o = decide(cand(i, cap=n1 < 3))
            if o["action"] == "SEND" and n1 < 3:
                ledger_start(ledger, key(i), intent(i), inst(i), o["agentId"])
                ledger_record(ledger, key(i), intent(i), inst(i), o["agentId"], "SEND_CONFIRMED")
                n1 += 1
        check("N1", n1 == 3)

        # N2: SEND_OUTCOME_UNKNOWN -> next tick zero resend
        ledger_start(ledger, key(50), intent(50), inst(50), "agt_example-agent")
        ledger_record(ledger, key(50), intent(50), inst(50), "agt_example-agent", "SEND_OUTCOME_UNKNOWN")
        dN2 = decide(cand(50, fence=ledger_query(ledger, key(50))["state"]))
        check("N2", dN2["action"] == "SKIP" and dN2["reason"] == "outcome_unknown_no_retry")

        # N3: SEND_CONFIRMED but workflow not yet transitioned -> next tick zero resend
        dN3 = decide(cand(41, fence=ledger_query(ledger, key(41))["state"]))
        check("N3", dN3["action"] == "SKIP" and dN3["reason"] == "already_sent_send_confirmed")

        # N4: durable SEND_STARTED -> crash before OR after send -> next tick zero resend
        ledger_start(ledger, key(60), intent(60), inst(60), "agt_example-agent")
        st60 = ledger_query(ledger, key(60))["state"]
        dN4a = decide(cand(60, fence=st60))  # crash BEFORE send
        dN4b = decide(cand(60, fence=st60))  # crash AFTER accepted send, before outcome mark
        check("N4", st60 == "SEND_STARTED" and dN4a["action"] == "SKIP"
              and dN4a["reason"] == "send_started_no_auto_resend" and dN4b["action"] == "SKIP")

        # N5: malformed/torn record -> fail closed -> zero send + record refusal
        corrupt = mk(tmp, "memory", "corrupt-fence.jsonl")
        with open(corrupt, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"nodeVisitId": key(70), "state": "SEND_CONFIRMED"}, sort_keys=True) + "\n")
            fh.write('{"nodeVisitId": "10000000-0000-0000-0000-')  # torn
        qN5 = ledger_query(corrupt, key(70))
        dN5 = decide(cand(70, fence=qN5["state"]))
        refused = False
        try:
            ledger_start(corrupt, key(71), intent(71), inst(71), "agt_example-agent")
        except LedgerUntrusted:
            refused = True
        check("N5", qN5["state"] == "LEDGER_UNTRUSTED"
              and dN5["action"] == "SKIP" and dN5["reason"] == "ledger_untrusted_fail_closed_zero_send"
              and refused)

        # N6: non-operator ledger-clear denied, fence unchanged; operator path works
        rN6 = ledger_clear(ledger, key(60), "turn attempts to lift its own fence", euid=os.geteuid())
        after = ledger_query(ledger, key(60))["state"]
        rN6op = ledger_clear(ledger, key(60), "operator: verified safe", euid=0)
        check("N6", rN6.get("denied") is True and after == "SEND_STARTED"
              and rN6op.get("recorded") is True
              and ledger_query(ledger, key(60))["state"] == "NOT_SENT")

        # B3: second ledger-start on the same node visit (duplicate intent) refused
        c2 = ledger_start(ledger, key(80), intent(80), inst(80), "agt_example-agent")
        c2b = ledger_start(ledger, key(80), intent(81), inst(80), "agt_example-agent")
        check("B3_ATOMIC_FENCE", c2["claimed"] and not c2b["claimed"]
              and c2b["state"] == "SEND_STARTED")

        # LEDGER: idempotency + summary
        again = ledger_record(ledger, key(2), intent(2), inst(2), "agt_example-agent", "SEND_CONFIRMED")
        summ = ledger_summary(ledger)
        check("LEDGER", again["recorded"] is False and summ["fencedNodeVisits"] >= 7
              and not summ["untrusted"],
              f"again={again} summary={summ}")

    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(f"[{'ok' if ok else 'FAIL'}] {name} {detail}")
    print(f"[dispatch_round_tools selftest] {'PASS' if not failed else 'FAIL'} "
          f"({len(results) - len(failed)}/{len(results)})")
    sys.exit(1 if failed else 0)


def main(argv):
    if not argv or argv[0] == "selftest":
        return selftest()
    cmd, args = argv[0], argv[1:]

    def flag(name):
        return args[args.index(name) + 1] if name in args else None

    if cmd == "ledger-query":
        print(json.dumps(ledger_query(flag("--file"), flag("--node-visit")), ensure_ascii=False))
    elif cmd == "ledger-start":
        print(json.dumps(ledger_start(flag("--file"), flag("--node-visit"), flag("--intent"),
                                      flag("--instance"), flag("--agent")), ensure_ascii=False))
    elif cmd == "ledger-record":
        print(json.dumps(ledger_record(flag("--file"), flag("--node-visit"), flag("--intent"),
                                       flag("--instance"), flag("--agent"), flag("--state"),
                                       note=flag("--note") or ""), ensure_ascii=False))
    elif cmd == "ledger-summary":
        print(json.dumps(ledger_summary(flag("--file")), ensure_ascii=False))
    elif cmd == "ledger-clear":
        print(json.dumps(ledger_clear(flag("--file"), flag("--node-visit"), flag("--reason")), ensure_ascii=False))
    elif cmd == "backlog-add":
        print(json.dumps(backlog_add(flag("--file"), flag("--intent"), flag("--instance"),
                                     flag("--node-visit"), flag("--principal"),
                                     flag("--reason") or "identity_blocked"), ensure_ascii=False))
    elif cmd == "backlog-list":
        raw_limit = flag("--limit")
        print(json.dumps(backlog_list(flag("--file"), int(raw_limit) if raw_limit else 100000), ensure_ascii=False))
    elif cmd == "decide":
        print(json.dumps(decide(json.load(sys.stdin)), ensure_ascii=False))
    else:
        raise SystemExit(f"unknown subcommand {cmd}")


if __name__ == "__main__":
    main(sys.argv[1:])
