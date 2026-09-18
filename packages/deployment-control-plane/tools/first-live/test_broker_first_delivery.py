"""Private fake transports only; never calls installed tools or live sockets."""
import copy
import json
import tempfile
import unittest
import broker_first_delivery as b


def handoff():
    return {"version": 1, "operation_id": b.OPERATION, "package_sha256": "1" * 64,
            "issuer_sha256": "2" * 64, "ctl_sha256": "3" * 64,
            "artifact_sha256": "4" * 64, "manifest_sha256": "5" * 64,
            "acceptance_revision": "DEPLOYMENT_DELIVERY_V1", "profile_revision": "fixture-profile",
            "issued_at": 100, "expires_at": 2100, "mode": "submit", "existing": None}


def records(h):
    unit = "a" * 64
    attachment = "b" * 64
    tx = {"unit_id": unit, "artifact_sha256": h["artifact_sha256"], "source_sha": b.SOURCE,
          "profile_revision": h["profile_revision"], "target_generation": 2, "attempt": 1,
          "new_service_generation": "fixture-service", "attachment_digests": [attachment],
          "rollback_digest": None, "postimage_digest": "9" * 64}
    goal = {"issuer": "local-verifier", "signature": "f" * 128, "payload": {
        "unit_id": unit, "goal_id": b.GOAL, "acceptance_revision": h["acceptance_revision"],
        "target_generation": 2, "attempt": 1, "service_generation": "fixture-service",
        "attachment_digest": attachment, "outcome": "Pass", "evidence_digest": "e" * 64,
        "revision": 1}}
    status = {"unit": {"deployment_unit_id": unit, "repo": "mayf3/dsh-agent-core",
        "deployment_profile": "dsh-app", "profile_revision": h["profile_revision"],
        "target_runtime": "dsh-system-runtime", "source_sha": b.SOURCE,
        "artifact_sha256": h["artifact_sha256"], "manifest_digest": h["manifest_sha256"],
        "expected_target_generation": 1, "covered_goal_ids": [b.GOAL], "goal_coverage": [{
            "goal_id": b.GOAL, "acceptance_revision": h["acceptance_revision"],
            "source_sha": b.SOURCE, "release_face_sha256": h["manifest_sha256"],
            "verification_profile": "native-installed-readback-v1"}]},
        "state": "Applied", "revision": 7, "mutating_attempts": 1,
        "receipt_digests": [b.sha(b.canonical(tx)), b.sha(b.canonical(goal))]}
    return unit, attachment, tx, goal, status


class Journal:
    def __init__(self): self.rows = {}
    def write(self, name, value):
        if name in self.rows: raise ValueError("EXISTS")
        self.rows[name] = copy.deepcopy(value)
    def consumed(self): return "intent.json" in self.rows


class Fake:
    def __init__(self, h):
        self.h = h; self.calls = []; self.clock = 110
        self.unit, self.attachment, tx, goal, self.status = records(h)
        self.receipts = {b.sha(b.canonical(r)): r for r in [tx, goal]}
    def now(self): return self.clock
    def pause(self): self.clock += 2
    def call(self, action, argument, request):
        self.calls.append((action, argument, request))
        if action == "prepare": return {"proposal_digest": "c" * 64}
        if action == "submit": return {"result": {"unit_id": self.unit, "attachment_digest": self.attachment,
            "install_required": True, "state": "Queued", "status_revision": 1}}
        if action == "status": return {"result": copy.deepcopy(self.status)}
        if action == "receipt": return {"result": copy.deepcopy(self.receipts[argument])}
        if action == "retry-verification": return {"result": {"queued": True}}
        raise AssertionError(action)


class Broker(unittest.TestCase):
    def test_normal_delivery_uses_once_fixed_identity_and_matching_receipts(self):
        h = handoff(); j = Journal(); f = Fake(h)
        result = b.run_once(h, j, f)
        self.assertEqual(result["state"], "BROKER_DELIVERY_RECEIPTS_OBSERVED")
        self.assertFalse(result["business_goal_complete"])
        self.assertEqual(f.calls[:2], [("prepare", b.SOURCE, b.REQUEST), ("submit", "c" * 64, b.REQUEST)])
        calls = list(f.calls)
        with self.assertRaises(ValueError): b.run_once(h, j, f)
        self.assertEqual(f.calls, calls)

    def test_json_error_even_exit_zero_never_reaches_submit(self):
        h = handoff(); j = Journal(); f = Fake(h)
        f.call = lambda *args: {"error": "PRIOR_DEPENDENCY_PENDING", "state": "BLOCKED"}
        with self.assertRaisesRegex(ValueError, "CONTROLLER_ERROR"): b.run_once(h, j, f)
        self.assertTrue(j.consumed()); self.assertNotIn("result.json", j.rows)

    def test_wrong_goal_generation_artifact_or_receipt_hash_never_completes(self):
        for field in ["source_sha", "artifact_sha256", "target_runtime", "expected_target_generation"]:
            h = handoff(); f = Fake(h); j = Journal()
            f.status["unit"][field] = 99 if field == "expected_target_generation" else "wrong"
            with self.subTest(field=field), self.assertRaises(ValueError): b.run_once(h, j, f)
            self.assertNotIn("result.json", j.rows)

    def existing(self, with_pass=True):
        h = handoff(); f = Fake(h)
        h["mode"] = "verify-existing"
        h["existing"] = {"unit_id": f.unit, "attempt": 1, "target_generation": 2,
            "service_generation": "fixture-service", "no_inflight_mutation": True,
            "goal_receipt_digest": f.status["receipt_digests"][1] if with_pass else None}
        return h, f

    def test_current_root_observed_pass_uses_no_issuance_submit_or_retry(self):
        h, f = self.existing(); j = Journal()
        result = b.run_once(h, j, f)
        self.assertEqual(result["goal_receipt_digest"], h["existing"]["goal_receipt_digest"])
        self.assertFalse(result["global_current_state_attested"])
        self.assertTrue(all(c[0] in ("status", "receipt") for c in f.calls))

    def test_missing_pass_retries_once_and_requires_new_correlated_goal_receipt(self):
        h, f = self.existing(False); j = Journal()
        old_pass = f.status["receipt_digests"].pop()
        f.receipts.pop(old_pass)
        _, _, _, goal, _ = records(h)
        waiting = copy.deepcopy(goal); waiting["payload"]["outcome"] = "WaitingExternalAcceptance"
        wd = b.sha(b.canonical(waiting)); f.receipts[wd] = waiting
        f.status["receipt_digests"].append(wd)
        goal["payload"]["revision"] = 2; gd = b.sha(b.canonical(goal))
        original = f.call
        def call(*args):
            result = original(*args)
            if args[0] == "retry-verification":
                f.receipts[gd] = goal; f.status["receipt_digests"].append(gd)
                f.status["revision"] += 1
            return result
        f.call = call
        result = b.run_once(h, j, f)
        self.assertEqual(result["goal_receipt_digest"], gd)
        self.assertEqual([c[0] for c in f.calls].count("retry-verification"), 1)

    def test_old_pass_without_current_root_digest_stops_before_retry(self):
        h, f = self.existing(False); j = Journal()
        with self.assertRaisesRegex(ValueError, "STOP_RECONCILE"): b.run_once(h, j, f)
        self.assertFalse(any(c[0] == "retry-verification" for c in f.calls))

    def test_existing_drift_and_inflight_reject(self):
        for field, value in [("attempt", 2), ("target_generation", 3),
                              ("service_generation", "wrong"), ("no_inflight_mutation", False),
                              ("goal_receipt_digest", "0" * 64)]:
            h, f = self.existing(); h["existing"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): b.run_once(h, Journal(), f)
            self.assertFalse(any(c[0] in ("prepare", "submit", "retry-verification") for c in f.calls))

    def test_no_install_required_without_current_proof_stops_no_apply_fallback(self):
        h = handoff(); f = Fake(h); original = f.call
        def call(*args):
            result = original(*args)
            if args[0] == "submit": result["result"]["install_required"] = False
            return result
        f.call = call
        with self.assertRaisesRegex(ValueError, "STOP_RECONCILE"): b.run_once(h, Journal(), f)
        self.assertEqual([x[0] for x in f.calls], ["prepare", "submit"])

    def test_newest_failure_or_unknown_not_masked_by_earlier_pass(self):
        for outcome in ["Fail", "OutcomeUnknown"]:
            h = handoff(); f = Fake(h); _, _, _, g, _ = records(h)
            g["payload"].update(outcome=outcome, revision=2)
            d = b.sha(b.canonical(g)); f.receipts[d] = g; f.status["receipt_digests"].append(d)
            with self.subTest(outcome=outcome), self.assertRaisesRegex(ValueError, "STOP_RECONCILE"):
                b.run_once(h, Journal(), f)

    def test_unknown_submit_preserves_once_intent_no_changed_id_replay(self):
        h = handoff(); f = Fake(h); j = Journal(); original = f.call
        def call(*args):
            if args[0] == "submit": raise ValueError("OUTCOME_UNKNOWN_TRANSPORT")
            return original(*args)
        f.call = call
        with self.assertRaisesRegex(ValueError, "OUTCOME_UNKNOWN"): b.run_once(h, j, f)
        self.assertIn("call-0002-intent.json", j.rows)
        self.assertNotIn("call-0002-result.json", j.rows)
        with self.assertRaisesRegex(ValueError, "ONCE_ALREADY_CONSUMED"): b.run_once(h, j, f)

    def test_terminal_and_deadline_never_replay_submission(self):
        for state in ["Blocked", "RollingBack", "RolledBack", "Quarantined", "Cancelled", "Superseded", "Recovering", "Queued"]:
            h = handoff(); f = Fake(h); f.status["state"] = state
            h["expires_at"] = 114
            with self.subTest(state=state), self.assertRaises(ValueError): b.run_once(h, Journal(), f)
            self.assertEqual([c[0] for c in f.calls].count("submit"), 1)

    def test_receipt_hash_and_exact_join_reject(self):
        for field, value in [("goal_id", "OTHER"), ("service_generation", "stale"),
            ("attachment_digest", "0" * 64), ("target_generation", 99), ("attempt", 8)]:
            h = handoff(); h["expires_at"] = 114; f = Fake(h)
            d = f.status["receipt_digests"].pop(); r = f.receipts.pop(d)
            r["payload"][field] = value
            nd = b.sha(b.canonical(r)); f.status["receipt_digests"].append(nd); f.receipts[nd] = r
            with self.subTest(field=field), self.assertRaises(ValueError): b.run_once(h, Journal(), f)
        h = handoff(); f = Fake(h); d = f.status["receipt_digests"][1]
        f.receipts[d]["payload"]["evidence_digest"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "RECEIPT_DIGEST"): b.run_once(h, Journal(), f)

    def test_bad_handoff_rejects_before_intent_or_any_call(self):
        for key, value in [("operation_id", "other"), ("expires_at", 109), ("issued_at", 1),
            ("ctl_sha256", "wrong"), ("version", True), ("extra", True)]:
            h = handoff(); h[key] = value; j = Journal(); f = Fake(h)
            with self.subTest(key=key), self.assertRaises(ValueError): b.run_once(h, j, f)
            self.assertFalse(j.rows); self.assertFalse(f.calls)
