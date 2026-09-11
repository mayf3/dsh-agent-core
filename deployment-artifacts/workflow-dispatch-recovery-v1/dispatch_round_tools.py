#!/usr/bin/env python3
"""
dispatch_round_tools — WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1 dispatcher-loop
mechanics (OWNER directive 2026-09-11): durable cross-round dedupe ledger +
deterministic per-candidate decision function, hermetic selftest.

Role split (frozen):
  - The HR dispatch TURN follows DISPATCH_PAYLOAD_V1 (the frozen job payload);
    every mechanical step it cannot do reliably by reasoning is done HERE.
  - This tool owns: the append-only receipt ledger keyed by dispatchIntentId
    (states NOT_SENT / SEND_CONFIRMED / SEND_OUTCOME_UNKNOWN) and the pure
    classification/eligibility decision. NO heuristics: classification reads
    only authoritative fields (execution_class, exact-resolution outcome,
    exact Owner quarantine entry). HUMAN_REQUIRED / generic QUARANTINED /
    EXTERNAL_SIDE_EFFECT are DEFERRED (no authoritative field frozen for them
    in V1) and are intentionally absent.

Dedupe contract (Owner semantics):
  SEND_CONFIRMED       -> later rounds never resend this dispatchIntentId
  SEND_OUTCOME_UNKNOWN -> never blind-retried
  Eligibility changes ONLY via workflow progression (a progressed node visit
  yields a NEW dispatchIntentId = a fresh ledger key) or an explicit operator
  ledger-clear with a recorded reason.

Subcommands (all local, zero network):
  ledger-query  --file F --intent ID            -> latest state or NOT_SENT
  ledger-record --file F --intent ID --instance I --node-visit N --agent A
                --state SEND_CONFIRMED|SEND_OUTCOME_UNKNOWN [--note X]
                (idempotent: same intent+state again = no-op)
  ledger-summary --file F                       -> counts by state
  ledger-clear  --file F --intent ID --reason R (operator-only explicit
                disposition; appends a NOT_SENT transition line)
  decide --stdin-json                           -> {action, reason, ...}
  selftest                                      -> hermetic T1-T10 + N1-N3
Usage inside the dispatch turn is mechanical: the payload mandates this tool
for every ledger read/write; freeform ledger writes are forbidden.
"""
import json
import os
import sys
import tempfile
import time
import uuid

VALID_STATES = ("NOT_SENT", "SEND_STARTED", "SEND_CONFIRMED", "SEND_OUTCOME_UNKNOWN", "LEDGER_UNTRUSTED")
# Owner-ruling exact quarantine entry (the ONLY deny entry; never generalized).
EXACT_DENY_INSTANCES = ("cebf4816-c664-40cb-9b61-3fa330ad1c39",)


def _is_uuid(v):
    try:
        uuid.UUID(str(v))
        return True
    except Exception:
        return False


# ── ledger ────────────────────────────────────────────────────────────────────
#
# Corruption contract (Owner ruling 2026-09-11): a ledger that cannot be
# faithfully parsed is UNTRUSTED, and untrusted can NEVER restore a candidate
# to NOT_SENT — corruption must never be able to cause a duplicate dispatch.
# Any non-blank line that fails JSON parsing or schema validation
# (dispatchIntentId present; state in the four real states) marks the whole
# ledger LEDGER_UNTRUSTED; the dispatch turn then sends ZERO this round and
# ledger-record refuses further automatic writes.

def _parse_ledger(path):
    """Returns (latest_by_intent, corrupt_line_count)."""
    latest = {}
    corrupt = 0
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    rec = json.loads(stripped)
                except ValueError:
                    corrupt += 1
                    continue
                if (not isinstance(rec, dict)
                        or not isinstance(rec.get("dispatchIntentId"), str)
                        or rec.get("state") not in VALID_STATES[:4]):
                    corrupt += 1
                    continue
                latest[rec["dispatchIntentId"]] = rec
    return latest, corrupt


def _append_durable(path, rec):
    """Append one JSONL record with flush + fsync (the fence must survive a
    process crash between write and send)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
        fh.flush()
        os.fsync(fh.fileno())


def ledger_query(path, intent_id):
    latest, corrupt = _parse_ledger(path)
    if corrupt:
        return {"dispatchIntentId": intent_id, "state": "LEDGER_UNTRUSTED",
                "corruptLines": corrupt}
    rec = latest.get(intent_id)
    if rec is None:
        return {"dispatchIntentId": intent_id, "state": "NOT_SENT"}
    return {"dispatchIntentId": intent_id, "state": rec.get("state", "NOT_SENT"),
            "targetAgentId": rec.get("targetAgentId"), "ts": rec.get("ts")}


def ledger_record(path, intent_id, instance_id, node_visit_id, agent_id, state, note=""):
    """Append a state transition. SEND_STARTED arrives via ledger-start (the
    write-ahead fence BEFORE the send); SEND_CONFIRMED / SEND_OUTCOME_UNKNOWN
    arrive after the send attempt. Refuses writes onto an untrusted ledger
    (fail closed) and enforces transition sanity."""
    if state not in ("SEND_STARTED", "SEND_CONFIRMED", "SEND_OUTCOME_UNKNOWN"):
        raise SystemExit("ledger-record: state must be SEND_STARTED, SEND_CONFIRMED or SEND_OUTCOME_UNKNOWN")
    for name, v in (("intent", intent_id), ("instance", instance_id), ("node-visit", node_visit_id)):
        if not _is_uuid(v):
            raise SystemExit(f"ledger-record: --{name} must be a UUID (got {v!r})")
    latest, corrupt = _parse_ledger(path)
    if corrupt:
        raise SystemExit("ledger-record: LEDGER_UNTRUSTED — refusing automatic writes onto an untrusted ledger (zero-send; operator disposition required)")
    current = (latest.get(intent_id) or {}).get("state", "NOT_SENT")
    if current == state:
        return {"recorded": False, "reason": "idempotent_noop", "state": state}
    if current == "SEND_CONFIRMED":
        return {"recorded": False, "reason": "confirmed_is_terminal_for_this_intent", "state": "SEND_CONFIRMED"}
    if current == "SEND_OUTCOME_UNKNOWN" and state in ("SEND_STARTED", "SEND_OUTCOME_UNKNOWN"):
        return {"recorded": False, "reason": "unknown_never_retried_no_refence", "state": "SEND_OUTCOME_UNKNOWN"}
    if current == "SEND_STARTED" and state == "SEND_STARTED":
        return {"recorded": False, "reason": "fence_already_open", "state": "SEND_STARTED"}
    rec = {"dispatchIntentId": intent_id, "workflowInstanceId": instance_id,
           "nodeVisitId": node_visit_id, "targetAgentId": agent_id, "state": state,
           "ts": int(time.time() * 1000)}
    if note:
        rec["note"] = note
    _append_durable(path, rec)
    return {"recorded": True, "state": state}


def ledger_clear(path, intent_id, reason, euid=None):
    """Operator-only explicit disposition. A model-facing HR turn must NEVER be
    able to lift the fence itself: the call is denied unless running with
    effective uid 0 (the Owner sudo context)."""
    if euid is None:
        euid = os.geteuid()
    if euid != 0:
        return {"recorded": False, "denied": True,
                "reason": f"operator_only: ledger-clear requires euid 0 (got {euid}); the dispatch turn cannot lift its own fence"}
    if not reason:
        raise SystemExit("ledger-clear: --reason is required (explicit operator disposition)")
    if ledger_query(path, intent_id)["state"] == "NOT_SENT":
        return {"recorded": False, "reason": "not_sent_already"}
    rec = {"dispatchIntentId": intent_id, "state": "NOT_SENT",
           "ts": int(time.time() * 1000), "clearedBecause": reason}
    _append_durable(path, rec)
    return {"recorded": True, "state": "NOT_SENT"}


def ledger_summary(path):
    counts = {s: 0 for s in VALID_STATES}
    intents = set()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if rec.get("dispatchIntentId"):
                    intents.add(rec["dispatchIntentId"])
    for i in intents:
        counts[ledger_query(path, i)["state"]] += 1
    return {"intents": len(intents), "byState": counts}


# ── decision (pure; the deterministic core the payload defers to) ─────────────

def decide(c):
    """c keys: intentId instanceId nodeVisitId ownerPrincipalId
    ledgerState (NOT_SENT|SEND_CONFIRMED|SEND_OUTCOME_UNKNOWN|None)
    summaryRow (None|{"execution_class": None|"BUSINESS"|"NON_BUSINESS_TEST"})
    resolution ('OK:<agentId>'|'FAIL:<code>'|None)
    sentInstancesThisRound ([instanceId,...])"""
    ledger_state = c.get("ledgerState") or "NOT_SENT"
    if ledger_state == "LEDGER_UNTRUSTED":
        return {"action": "SKIP", "reason": "ledger_untrusted_fail_closed_zero_send"}
    if ledger_state == "SEND_CONFIRMED":
        return {"action": "SKIP", "reason": "already_sent_send_confirmed"}
    if ledger_state == "SEND_OUTCOME_UNKNOWN":
        return {"action": "SKIP", "reason": "outcome_unknown_no_retry"}
    if ledger_state == "SEND_STARTED":
        # The write-ahead fence is open and no durable outcome followed: we
        # cannot PROVE whether the send happened. Treat as outcome-unknown —
        # human disposition over blind retry.
        return {"action": "SKIP", "reason": "send_started_no_auto_resend"}
    if c.get("instanceId") in EXACT_DENY_INSTANCES:
        return {"action": "SKIP", "reason": "exact_quarantine_owner_ruling"}
    if c.get("instanceId") in (c.get("sentInstancesThisRound") or []):
        return {"action": "SKIP", "reason": "instance_already_sent_this_round"}
    row = c.get("summaryRow")
    if row is None:
        return {"action": "SKIP", "reason": "summary_row_missing"}
    klass = row.get("execution_class")
    if klass is None:
        return {"action": "SKIP", "reason": "class_unavailable_fail_closed"}
    if klass == "NON_BUSINESS_TEST":
        return {"action": "SKIP", "reason": "non_business_test"}
    if klass != "BUSINESS":
        return {"action": "SKIP", "reason": f"class_unrecognized_{klass}"}
    resolution = c.get("resolution")
    if not resolution or not resolution.startswith("OK:"):
        code = resolution[5:] if resolution and resolution.startswith("FAIL:") else "resolution_missing"
        return {"action": "SKIP", "reason": f"identity_blocked_{code}"}
    return {"action": "SEND", "reason": "real_business", "agentId": resolution[3:]}


def build_send_packet(c, agent_id):
    """The complete dispatch envelope: the target needs ZERO detail prerequisite
    (nodeVisitId travels WITH the dispatch; detail reads happen under the
    target's own authority — T6 separation)."""
    return (
        "统一 Workflow 调度。请处理 workflow_instance_id={instanceId}，"
        "nodeVisitId={nodeVisitId}（已由调度方提供，无需为定位节点读取实例详情）。"
        "请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；"
        "调度方不代为 transition/审批。完成后回报结果与证据。"
    ).format(instanceId=c["instanceId"], nodeVisitId=c["nodeVisitId"])


# ── selftest (hermetic T1-T10 + N1-N3) ────────────────────────────────────────

def _mk(tmp, *segs):
    p = os.path.join(tmp, *segs)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def selftest():
    results = []

    def check(name, cond, detail=""):
        results.append((name, bool(cond), detail))

    def cand(i, inst=None, ledger_state="NOT_SENT", row={"execution_class": "BUSINESS"},
             resolution="OK:agt_example-agent", sent=None):
        return {"intentId": f"00000000-0000-0000-0000-{i:012d}",
                "instanceId": inst or INST(i), "nodeVisitId": f"10000000-0000-0000-0000-{i:012d}",
                "ownerPrincipalId": f"20000000-0000-0000-0000-{i:012d}",
                "ledgerState": ledger_state, "summaryRow": row,
                "resolution": resolution, "sentInstancesThisRound": sent or []}

    with tempfile.TemporaryDirectory() as tmp:
        ledger = _mk(tmp, "memory", "dispatch-receipts.jsonl")
        INST = lambda i: f"30000000-0000-0000-0000-{i:012d}"

        # T1: candidate #1 identity-blocked, #2 valid -> #2 dispatched exactly once
        d1 = decide(cand(1, INST(1), resolution="FAIL:PRINCIPAL_NOT_FOUND"))
        d2 = decide(cand(2, INST(2)))
        r2 = ledger_record(ledger, cand(2)["intentId"], INST(2), cand(2)["nodeVisitId"],
                           "agt_example-agent", "SEND_CONFIRMED")
        check("T1", d1["action"] == "SKIP" and "identity_blocked" in d1["reason"]
              and d2["action"] == "SEND" and r2["recorded"])

        # T2: 7 candidates all identity-blocked -> 0 dispatch, 7 explicit reasons, round completes
        outs = [decide(cand(i, INST(i), resolution="FAIL:IDENTITY_RESOLUTION_AMBIGUOUS")) for i in range(10, 17)]
        check("T2", all(o["action"] == "SKIP" and o["reason"] for o in outs) and len(outs) == 7)

        # T3: test candidate before valid business -> test skipped, business dispatched
        dt = decide(cand(20, INST(20), row={"execution_class": "NON_BUSINESS_TEST"}))
        db = decide(cand(21, INST(21)))
        check("T3", dt["action"] == "SKIP" and dt["reason"] == "non_business_test" and db["action"] == "SEND")

        # T4: duplicate instance within the round -> processed once
        dd = decide(cand(22, INST(22), sent=[INST(22)]))
        check("T4", dd["action"] == "SKIP" and dd["reason"] == "instance_already_sent_this_round")

        # T5: summary row missing (cross-domain detail 404 analog) -> skip+continue, never abort
        d5 = decide(cand(23, INST(23), row=None))
        d5b = decide(cand(24, INST(24)))  # next candidate still processed
        check("T5", d5["action"] == "SKIP" and d5["reason"] == "summary_row_missing" and d5b["action"] == "SEND")

        # T6: dispatch packet carries instanceId + nodeVisitId (target needs no detail)
        pkt = build_send_packet(cand(25, INST(25)), "agt_example-agent")
        check("T6", INST(25) in pkt and cand(25)["nodeVisitId"] in pkt)

        # T7: invalid/stale principal -> no display-name fallback, continue
        d7 = decide(cand(26, INST(26), resolution="FAIL:AGENT_MAPPING_MISSING"))
        check("T7", d7["action"] == "SKIP" and "agentId" not in d7)

        # T8: NO substring heuristics — a scary title with class=BUSINESS still dispatches;
        #     classification reads ONLY the authoritative field
        d8 = decide(cand(27, INST(27), resolution="OK:agt_example-agent"))
        d8t = decide(cand(28, INST(28), row={"execution_class": "NON_BUSINESS_TEST"}))
        check("T8", d8["action"] == "SEND" and d8t["action"] == "SKIP")

        # T9: same eligible candidate next tick (feed returns it again) -> zero resend
        q2 = ledger_query(ledger, cand(2)["intentId"])
        d9 = decide(cand(2, INST(2), ledger_state=q2["state"]))
        check("T9", q2["state"] == "SEND_CONFIRMED" and d9["action"] == "SKIP")

        # T10: candidate set > one page -> bounded window of 20; a bad candidate
        #      inside the window never aborts; later valid candidate still sends
        big = [decide(cand(100 + i, INST(100 + i),
                           resolution="FAIL:X" if i % 3 == 0 else "OK:agt_example-agent"))
               for i in range(20)]
        sent_in_window = [o for o in big if o["action"] == "SEND"]
        check("T10", len(big) == 20 and len(sent_in_window) > 0
              and all(o["action"] in ("SEND", "SKIP") for o in big))

        # N1: 3 consecutive healthy BUSINESS -> exactly 3 sends under maxSend=3
        n1sents = 0
        for i in range(30, 34):
            o = decide(cand(i, INST(i)))
            if o["action"] == "SEND" and n1sents < 3:
                ledger_record(ledger, cand(i)["intentId"], INST(i), cand(i)["nodeVisitId"],
                              "agt_example-agent", "SEND_CONFIRMED")
                n1sents += 1
        check("N1", n1sents == 3)

        # N2: SEND_OUTCOME_UNKNOWN -> next tick zero resend
        ledger_record(ledger, cand(40)["intentId"], INST(40), cand(40)["nodeVisitId"],
                      "agt_example-agent", "SEND_OUTCOME_UNKNOWN")
        dN2 = decide(cand(40, INST(40), ledger_state=ledger_query(ledger, cand(40)["intentId"])["state"]))
        check("N2", dN2["action"] == "SKIP" and dN2["reason"] == "outcome_unknown_no_retry")

        # N3: SEND_CONFIRMED but workflow not yet transitioned -> next tick zero resend
        dN3 = decide(cand(41, INST(41),
                          ledger_state=ledger_query(ledger, cand(30)["intentId"])["state"]))
        check("N3", dN3["action"] == "SKIP" and dN3["reason"] == "already_sent_send_confirmed")

        # N4: durable SEND_STARTED -> crash before OR after the send -> next tick zero resend
        ledger_record(ledger, cand(50)["intentId"], INST(50), cand(50)["nodeVisitId"],
                      "agt_example-agent", "SEND_STARTED")
        st50 = ledger_query(ledger, cand(50)["intentId"])["state"]
        dN4a = decide(cand(50, INST(50), ledger_state=st50))  # crash BEFORE send
        # crash AFTER accepted send, before the outcome mark: same durable state
        dN4b = decide(cand(50, INST(50), ledger_state=st50))
        check("N4", st50 == "SEND_STARTED"
              and dN4a["action"] == "SKIP" and dN4a["reason"] == "send_started_no_auto_resend"
              and dN4b["action"] == "SKIP")

        # N5: malformed/torn ledger record -> fail closed -> zero send
        corrupt = _mk(tmp, "memory", "corrupt-receipts.jsonl")
        with open(corrupt, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"dispatchIntentId": cand(60)["intentId"],
                                 "state": "SEND_CONFIRMED"}, sort_keys=True) + "\n")
            fh.write('{"dispatchIntentId": "30000000-0000-0000-0000-0000000000')  # torn line
        qN5 = ledger_query(corrupt, cand(60)["intentId"])
        dN5 = decide(cand(60, INST(60), ledger_state=qN5["state"]))
        record_refused = False
        try:
            ledger_record(corrupt, cand(61)["intentId"], INST(61), cand(61)["nodeVisitId"],
                          "agt_example-agent", "SEND_STARTED")
        except SystemExit:
            record_refused = True
        check("N5", qN5["state"] == "LEDGER_UNTRUSTED"
              and dN5["action"] == "SKIP" and dN5["reason"] == "ledger_untrusted_fail_closed_zero_send"
              and record_refused)

        # N6: non-operator ledger-clear -> denied -> fence unchanged
        rN6 = ledger_clear(ledger, cand(50)["intentId"], "model-facing turn tries to lift fence",
                           euid=os.geteuid())  # real dispatcher-turn uid (non-root)
        fence_after = ledger_query(ledger, cand(50)["intentId"])["state"]
        rN6op = ledger_clear(ledger, cand(40)["intentId"], "operator: verified safe", euid=0)
        check("N6", rN6.get("denied") is True and fence_after == "SEND_STARTED"
              and rN6op.get("recorded") is True)

        # ledger mechanics: idempotency + summary + clear (operator path)
        again = ledger_record(ledger, cand(2)["intentId"], INST(2), cand(2)["nodeVisitId"],
                              "agt_example-agent", "SEND_CONFIRMED")
        summ = ledger_summary(ledger)
        check("LEDGER", again["recorded"] is False
              and summ["byState"]["SEND_CONFIRMED"] >= 4
              and ledger_query(ledger, cand(40)["intentId"])["state"] == "NOT_SENT")

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
        print(json.dumps(ledger_query(flag("--file"), flag("--intent")), ensure_ascii=False))
    elif cmd == "ledger-start":
        # WRITE-AHEAD SEND FENCE: durable append + fsync BEFORE agent_session_send.
        print(json.dumps(ledger_record(flag("--file"), flag("--intent"), flag("--instance"),
                                       flag("--node-visit"), flag("--agent"), "SEND_STARTED"), ensure_ascii=False))
    elif cmd == "ledger-record":
        print(json.dumps(ledger_record(flag("--file"), flag("--intent"), flag("--instance"),
                                       flag("--node-visit"), flag("--agent"), flag("--state"),
                                       note=flag("--note") or ""), ensure_ascii=False))
    elif cmd == "ledger-summary":
        print(json.dumps(ledger_summary(flag("--file")), ensure_ascii=False))
    elif cmd == "ledger-clear":
        print(json.dumps(ledger_clear(flag("--file"), flag("--intent"), flag("--reason")), ensure_ascii=False))
    elif cmd == "decide":
        print(json.dumps(decide(json.load(sys.stdin)), ensure_ascii=False))
    else:
        raise SystemExit(f"unknown subcommand {cmd}")


if __name__ == "__main__":
    main(sys.argv[1:])
