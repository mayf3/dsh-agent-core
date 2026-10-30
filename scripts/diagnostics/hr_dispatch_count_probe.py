#!/usr/bin/env python3
"""#896 evidence probe; executes hash-pinned copies with synthetic state only.

Observation assertions describe these exact source bytes, not a new FSM contract.
The correlation/no-replay modes deliberately expose unmet investigation criteria.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import types
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/evidence/hr-dispatch-count-source-896-20261031"
PINS = {
    "dispatch_escalation": "abe30587670765e13999f0c4d9955a92464981c9d3b702d6cb6b01bc56296383",
    "dispatcher_v5": "5bb4c879958a8bec1320c260c1a856e3df91a0fd2441ae02b37177b90377190b",
}
T0 = 1791712656827  # Synthetic fixture time; never an observation of that event.
HOUR = 3600000
IID = "a8960000-0000-4000-8000-000000000001"
TARGET = "agt_fixture-agent"
VISIT = "fixture-visit-896"
KEY = f"{IID}|visit:{VISIT}"
FIELDS = (
    "dispatchCount", "noProgressCount", "action", "dispatchClaimedAt",
    "lastDispatchAt", "nextEligibleAt", "followUpAt", "followUpRequired",
    "progressObserved", "progressEvent", "threadId", "ownerNotified",
    "reportIssued", "receiptRef", "deliveryOutcome", "lastProgressAt",
)


def archive_modules():
    package = types.ModuleType("scripts")
    package.__path__ = []
    sys.modules["scripts"] = package
    loaded = {}
    for name, expected in PINS.items():
        path = EVIDENCE / "source" / f"{name}.py.txt"
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError(f"archive hash mismatch: {name}")
        mod = types.ModuleType(f"scripts.{name}")
        mod.__file__ = str(path)
        mod.__package__ = "scripts"
        sys.modules[mod.__name__] = mod
        exec(compile(data, str(path), "exec"), mod.__dict__)
        setattr(package, name, mod)
        loaded[name] = mod
    return loaded["dispatcher_v5"], loaded["dispatch_escalation"]


def install_guard(temp_root, counters):
    def guard(event, args):
        if event.startswith(("socket.", "subprocess.")) or event in {
            "os.system", "os.posix_spawn", "os.exec", "ctypes.dlopen",
        }:
            counters["forbidden_attempts"] += 1
            raise RuntimeError(f"offline probe forbids {event}")
        if event == "open":
            path, mode, flags = args
            writing = (isinstance(mode, str) and any(c in mode for c in "wax+"))
            writing = writing or bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT))
            if writing and not isinstance(path, int):
                if not Path(path).resolve().is_relative_to(temp_root):
                    raise RuntimeError("write outside synthetic temporary directory")
                counters["synthetic_write_opens"] += 1
    sys.addaudithook(guard)


def row(follow_up=None):
    value = {
        "workflowInstanceId": IID, "nodeVisitId": VISIT,
        "currentNodeKey": "fixture-node", "status": "active",
        "classification": "ACTIONABLE_NOW", "definitionKey": "fixture-definition",
        "current_owner_principal_id": "fixture-principal", "updated_at": T0 - 1,
    }
    if follow_up is not None:
        value["followUpAt"] = follow_up
    return value


def envelope(target=TARGET):
    return {"ok": True, "result": {
        "status": "accepted", "targetAgentId": target,
        "sessionId": "fixture-session", "messageId": "fixture-message",
    }}


class Sender:
    def __init__(self, events, response=None, raises=None):
        self.events = events
        self.response = response
        self.raises = raises
        self.calls = 0

    def __call__(self, target, message, candidate):
        self.calls += 1
        self.events.append("send_called")
        assert target == TARGET and candidate["candidateKey"] == KEY
        if self.raises:
            self.events.append("simulated_remote_accept_before_response_loss")
            raise self.raises("synthetic response lost")
        self.events.append("send_returned")
        return self.response


def run(mode):
    observations, checks = [], []
    counters = {"forbidden_attempts": 0, "synthetic_write_opens": 0}

    def check(name, condition):
        checks.append({"name": name, "pass": bool(condition)})

    with tempfile.TemporaryDirectory(prefix="hr-896-probe-") as tmp:
        temp_root = Path(tmp).resolve()
        install_guard(temp_root, counters)
        v5, fsm = archive_modules()

        def state(path):
            return fsm.get(str(path), IID, "fixture-node", node_visit_id=VISIT)

        def plan(path, when=T0, source=None):
            latest, corrupt = fsm._read(str(path))
            assert not corrupt
            return v5.plan_round([source or row()], [], state=latest, now_ms=when,
                                 resolve_owner=lambda _: TARGET)

        def execute(path, sender, when=T0, source=None, **extra):
            original_claim, original_record = fsm.claim_dispatch, fsm.record_dispatch

            def claim(*args, **kwargs):
                result = original_claim(*args, **kwargs)
                sender.events.append("claim_written" if result["claimed"] else "claim_refused")
                return result

            def record(*args, **kwargs):
                sender.events.append("record_dispatch_called")
                return original_record(*args, **kwargs)

            with patch.object(fsm, "claim_dispatch", claim), patch.object(fsm, "record_dispatch", record):
                return v5.execute_round(plan(path, when, source), sender,
                                        state_path=str(path), now_ms=when, **extra)

        def observe(name, path, sender, report=None, **extra):
            current = state(path)
            data = {"case": name, "send_calls": sender.calls,
                    "trace": list(sender.events),
                    "state": {k: current[k] for k in FIELDS if k in current}, **extra}
            if report is not None:
                data["report_dispatch_count"] = report["dispatch_count"]
                data["skip_reasons"] = [s["reason"] for s in report["structured_skips"]]
                data["round_receipts"] = [s.get("receipt") for s in report["dispatches"]]
            observations.append(data)
            return current

        path = temp_root / "planning.jsonl"
        sender = Sender([])
        planned = plan(path)
        current = observe("planning_without_send", path, sender)
        check("planning selects but neither sends nor counts",
              len(planned["ranking"]["selected"]) == 1 and sender.calls == 0
              and current["dispatchCount"] == 0 and not path.exists())

        cases = [
            ("same_target_envelope", envelope(), 1, None),
            ("bare_ok_without_coordinates", {"ok": True}, 1, None),
            ("foreign_target_envelope", envelope("agt_other-fixture"), 1, None),
            ("null_return", None, 0, "SEND_OUTCOME_UNKNOWN"),
            ("false_return", False, 0, "SEND_OUTCOME_UNKNOWN"),
            ("send_started", {"status": "SEND_STARTED"}, 0, "SEND_OUTCOME_UNKNOWN"),
            ("explicit_failure", {"ok": False, "error": "synthetic"}, 0, "SEND_FAILED"),
        ]
        for name, response, expected_count, reason in cases:
            path = temp_root / f"{name}.jsonl"
            sender = Sender([], response)
            report = execute(path, sender)
            current = observe(name, path, sender, report)
            check(f"{name}: observed count and classification",
                  sender.calls == 1 and current["dispatchCount"] == expected_count
                  and report["dispatch_count"] == expected_count
                  and (not reason or reason in observations[-1]["skip_reasons"]))
            check(f"{name}: claim precedes send; count write follows return",
                  sender.events[:2] == ["claim_written", "send_called"]
                  and (("record_dispatch_called" in sender.events) == bool(expected_count)))
            check(f"{name}: receipt reference absent in current ledger",
                  "receiptRef" not in current)

        path = temp_root / "repeat_success.jsonl"
        sender = Sender([], envelope())
        execute(path, sender)
        report = execute(path, sender, T0 + 1)
        current = observe("repeat_success_within_hour", path, sender, report)
        check("same-hour repeat neither calls nor counts again",
              sender.calls == 1 and current["dispatchCount"] == 1)

        for name, exc in [("response_loss", TimeoutError), ("sender_crash", SystemExit)]:
            path = temp_root / f"{name}.jsonl"
            sender = Sender([], raises=exc)
            try:
                report = execute(path, sender)
            except SystemExit:
                report = None
            current = observe(name, path, sender, report, external_outcome="UNKNOWN")
            check(f"{name}: possible acceptance does not count; reservation retained",
                  sender.calls == 1 and current["dispatchCount"] == 0
                  and current["action"] == "DISPATCH_RESERVED")
            execute(path, sender, T0 + 1)
            check(f"{name}: same-hour fence prevents second call", sender.calls == 1)
            try:
                report = execute(path, sender, T0 + HOUR + 1)
            except SystemExit:
                report = None
            observe(f"{name}_after_hour", path, sender, report, external_outcome="UNKNOWN")
            check(f"{name}: after-hour current source calls again", sender.calls == 2)

        path = temp_root / "record_crash.jsonl"
        sender = Sender([], envelope())
        with patch.object(fsm, "record_dispatch", side_effect=SystemExit("before count append")):
            try:
                execute(path, sender)
            except SystemExit:
                pass
        current = observe("crash_after_return_before_record", path, sender,
                          external_outcome="UNKNOWN: fake sender returned; no durable receipt")
        check("crash after return retains zero-count reservation",
              sender.calls == 1 and current["dispatchCount"] == 0)

        path = temp_root / "followup.jsonl"
        sender = Sender([], envelope())
        execute(path, sender, source=row(T0 + HOUR))
        report = execute(path, sender, T0 + HOUR + 1)
        check("explicit expired followUpAt yields FOLLOW_UP_REQUIRED",
              sender.calls == 1 and any(s["reason"] == "FOLLOW_UP_REQUIRED"
                                       for s in report["structured_skips"]))
        observe("expired_followup", path, sender, report)
        fsm.record_observation(str(path), IID, "fixture-node", observed_ts=T0 + HOUR + 2,
                               progress_ts=T0 + HOUR + 2, progress_event="TRANSITION",
                               node_visit_id=VISIT)
        report = execute(path, sender, T0 + HOUR + 3)
        current = observe("same_visit_transition_after_followup", path, sender, report)
        check("direct authoritative fixture resets noProgressCount, preserves dispatchCount",
              current["noProgressCount"] == 0 and current["dispatchCount"] == 1
              and current["progressObserved"] is True)
        check("old followUpAt still fences same visit despite followUpRequired false",
              current["followUpRequired"] is False and sender.calls == 1
              and any(s["reason"] == "FOLLOW_UP_REQUIRED" for s in report["structured_skips"]))

        path = temp_root / "transition_without_deadline.jsonl"
        sender = Sender([], envelope())
        execute(path, sender)
        fsm.record_observation(str(path), IID, "fixture-node", observed_ts=T0 + 1,
                               progress_ts=T0 + 1, progress_event="TRANSITION",
                               node_visit_id=VISIT)
        report = execute(path, sender, T0 + HOUR + 1)
        current = observe("transition_without_followup_after_hour", path, sender, report)
        check("without old deadline transition permits later dispatch; dispatchCount accumulates",
              sender.calls == 2 and current["dispatchCount"] == 2
              and current["noProgressCount"] == 1)

        path = temp_root / "snapshot.jsonl"
        sender = Sender([], envelope())
        diff = {"candidateKey": KEY, "progressEvent": "TRANSITION", "progressAt": T0 + 1}
        report = execute(path, sender, read_snapshot=lambda: {"fixture": True},
                         pre_snapshot={}, diff_builder=lambda before, after: diff)
        current = observe("post_dispatch_snapshot_transition", path, sender, report)
        check("post-send snapshot fixture is valid but observation clock rejects reset",
              report["snapshot"]["status"] == "SUCCESS"
              and v5._snapshot_authoritative_evidence(diff, row() | {"candidateKey": KEY}, T0)
              == ("TRANSITION", T0 + 1)
              and current["noProgressCount"] == 1 and current["progressObserved"] is False)

        evidence_checks = []
        if mode == "correlation":
            for name in ("same_target_envelope", "bare_ok_without_coordinates", "foreign_target_envelope"):
                obs = next(o for o in observations if o["case"] == name)
                evidence_checks.append({"name": f"{name}: counted send has durable validated receipt association",
                                        "pass": bool(obs["state"].get("receiptRef"))})
        if mode == "no-replay":
            for name in ("response_loss_after_hour", "sender_crash_after_hour"):
                obs = next(o for o in observations if o["case"] == name)
                evidence_checks.append({"name": f"{name}: unresolved UNKNOWN is not called again",
                                        "pass": obs["send_calls"] == 1})
        failed = sum(not c["pass"] for c in checks + evidence_checks)
        result = {"mode": mode, "source_sha256": PINS, "synthetic_only": True,
                  "network_and_process_guard": counters, "observations": observations,
                  "observation_assertions": checks, "investigation_criteria": evidence_checks,
                  "failed": failed}
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("semantics", "correlation", "no-replay"), default="semantics")
    sys.exit(run(parser.parse_args().mode))
