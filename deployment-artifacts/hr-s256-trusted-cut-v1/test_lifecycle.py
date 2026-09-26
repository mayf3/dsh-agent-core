"""Disposable fixed lifecycle projections, never a trusted host proof."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_commitment import authorization, bytes_of, final_bundle

HERE = Path(__file__).resolve().parent


def load(name, journal=None):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    if journal is not None:
        module.HR_JOURNAL = journal
    spec.loader.exec_module(module)
    return module


class FixedLifecycleTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.j = load("journal")
        self.j.TEST_MODE, self.j.STATE_ROOT = True, self.tmp.name
        self.l = load("lifecycle", self.j)
        self.j.seal_intent("n" * 32, "a" * 64, 97)
        self.auth = authorization()
        auth_digest = self.j.seal_launch_authorization(self.auth)
        self.bundle = bytes_of(final_bundle(self.auth, auth_digest))
        self.commitment = self.j.seal_bundle_commitment(self.bundle, 102)
        self.ownership = {"ownedChild": {"pid": 99999, "identitySha256": "1" * 64},
            "windowIdentity": [2, 3], "canonicalLockIdentity": [4, 5],
            "canonicalLockOwnershipReceiptSha256": "2" * 64,
            "launchSourcesInhibitedReceiptSha256": json.loads(self.bundle)["recoveryCutover"]["launchSourcesInhibitedReceiptSha256"],
            "windowHeld": True, "canonicalLockHeld": True, "sourcesInhibited": True}
        self.startup = {"ownership": self.ownership,
            "launchAuthorizationReceiptSha256": auth_digest,
            "consumingBinarySha256": self.auth["consumingBinarySha256"],
            "challengeReceiptSha256": "4" * 64}
        self.consumption = {"ownership": self.ownership,
            "validatedStoreSha256": "5" * 64,
            "validatorBinarySha256": self.auth["consumingBinarySha256"],
            "settlement": {"reconciliationHandle": self.j.HANDLE,
                "queryState": "settled", "fenceState": "cleared",
                "initialOutcome": "outcome_unknown",
                "terminationEvidence": "restart_quiescence_proven"},
            "storeReadbackReceiptSha256": "6" * 64}
        self.release = {"ownership": self.ownership,
            "ownedChildDispositionReceiptSha256": "7" * 64,
            "launchSourceDispositionReceiptSha256": "8" * 64,
            "windowReleaseReceiptSha256": "9" * 64,
            "canonicalLockDispositionReceiptSha256": "0" * 64,
            "businessOutcome": "outcome_unknown"}

    def tearDown(self):
        self.tmp.cleanup()

    @property
    def directory(self):
        return Path(self.tmp.name) / self.j.DIRECTORY

    def start(self):
        self.j.claim_one_launch(103)
        return self.l.record_startup_observed(self.startup, 104)

    def test_six_phase_chain_is_exclusive_linked_and_read_back(self):
        startup_digest = self.start()
        self.assertEqual(self.l.readback("phase-startup")[1], startup_digest)
        consume_digest = self.l.record_consumption_readback(self.consumption, 105)
        self.assertEqual(self.l.readback("phase-consumption")[0]
                         ["previousPhaseSha256"], startup_digest)
        self.l.record_closed(self.release, 106)
        closed, _ = self.l.readback("phase-closed")
        self.assertEqual(closed["previousPhaseSha256"], consume_digest)
        self.assertEqual(self.l.snapshot()["disposition"], "CLOSED")
        self.assertFalse(self.l.snapshot()["launchAllowed"])
        self.assertTrue((self.directory / "key-tombstone.json").exists())
        self.assertEqual(self.l.readback("key-tombstone")[0]["phase"], "CLOSED")
        for action in (lambda: self.l.record_startup_observed(self.startup, 107),
                       lambda: self.l.record_consumption_readback(self.consumption, 107),
                       lambda: self.l.record_closed(self.release, 107),
                       lambda: self.j.claim_one_launch(107)):
            with self.assertRaises(self.j.Rejected):
                action()

    def test_reordered_wrong_child_store_and_caller_pass_are_rejected(self):
        with self.assertRaises(self.j.Rejected):
            self.l.record_startup_observed(self.startup, 104)
        self.j.claim_one_launch(103)
        for changed in ({**self.startup, "callerPass": True},
                        {**self.startup, "consumingBinarySha256": "0" * 64},
                        {**self.startup, "ownership": {**self.ownership, "windowHeld": False}},
                        {**self.startup, "ownership": {**self.ownership,
                            "ownedChild": {"pid": True, "identitySha256": "1" * 64}}}):
            with self.subTest(changed=changed), self.assertRaises(self.j.Rejected):
                self.l.record_startup_observed(changed, 104)
        self.assertFalse((self.directory / "phase-startup.json").exists())
        self.l.record_startup_observed(self.startup, 104)
        for changed in ({**self.consumption, "validatorBinarySha256": "0" * 64},
                        {**self.consumption, "settlement": {**self.consumption["settlement"],
                            "initialOutcome": "completed"}},
                        {**self.consumption, "settlement": {**self.consumption["settlement"],
                            "reconciliationHandle": "other"}},
                        {**self.consumption, "settlement": {**self.consumption["settlement"],
                            "fenceState": "active"}},
                        {**self.consumption, "ownership": {**self.ownership,
                            "ownedChild": {"pid": 99998, "identitySha256": "1" * 64}}}):
            with self.subTest(changed=changed), self.assertRaises(self.j.Rejected):
                self.l.record_consumption_readback(changed, 105)
        with self.assertRaises(self.j.Rejected):
            self.l.record_closed(self.release, 106)
        self.assertFalse((self.directory / "phase-closed.json").exists())

    def test_restart_missing_or_torn_state_is_unknown_never_launch_permission(self):
        self.j.claim_one_launch(103)
        restarted = load("lifecycle", load("journal"))
        restarted.HR_JOURNAL.TEST_MODE, restarted.HR_JOURNAL.STATE_ROOT = True, self.tmp.name
        state = restarted.snapshot()
        self.assertEqual(state["disposition"], "UNKNOWN")
        self.assertTrue(state["launchMayHaveOccurred"])
        self.assertFalse(state["launchAllowed"])
        with self.assertRaises(restarted.HR_JOURNAL.Rejected):
            restarted.HR_JOURNAL.claim_one_launch(104)
        (self.directory / "phase-launch-attempt.json").write_bytes(b'{"torn":')
        self.assertEqual(restarted.snapshot()["disposition"], "UNKNOWN")
        self.assertFalse(restarted.snapshot()["launchAllowed"])

    def test_unknown_containment_preserves_custody_without_replay_or_release(self):
        self.start()
        unknown = {"ownership": self.ownership, "custodian": "fixed-DS-owner",
                   "dispositionDeadlineWallMs": 110, "reason": "READBACK_UNAVAILABLE"}
        self.l.record_unknown(unknown, 105)
        state = self.l.snapshot()
        self.assertEqual(state["disposition"], "UNKNOWN")
        self.assertEqual(state["custodian"], "fixed-DS-owner")
        self.assertTrue(state["retainInhibition"])
        self.assertFalse(state["launchAllowed"])
        self.assertFalse(state["releaseAllowed"])
        with self.assertRaises(self.j.Rejected):
            self.l.record_consumption_readback(self.consumption, 106)
        with self.assertRaises(self.j.Rejected):
            self.l.record_closed(self.release, 106)
        self.assertFalse((self.directory / "key-tombstone.json").exists())

    def test_prelaunch_unknown_keeps_null_child_as_unknown_not_no_launch_proof(self):
        self.assert_null_child_unknown_retains_every_gate(False)

    def test_possible_launch_unknown_keeps_null_child_without_reconstruction(self):
        self.assert_null_child_unknown_retains_every_gate(True)

    def assert_null_child_unknown_retains_every_gate(self, attempted):
        if attempted:
            self.j.claim_one_launch(103)
        unknown = {"ownership": {**self.ownership, "ownedChild": None},
            "custodian": "fixed-DS-owner", "dispositionDeadlineWallMs": 110,
            "reason": "READBACK_UNAVAILABLE"}
        self.l.record_unknown(unknown, 104)
        recorded, _ = self.l.readback("phase-unknown")
        self.assertIsNone(recorded["observation"]["ownership"]["ownedChild"])
        state = self.l.snapshot()
        self.assertEqual(state["custodian"], "fixed-DS-owner")
        self.assertEqual(state["disposition"], "UNKNOWN")
        self.assertTrue(state["launchMayHaveOccurred"])
        self.assertTrue(state["retainInhibition"])
        self.assertFalse(state["launchAllowed"])
        self.assertFalse(state["releaseAllowed"])
        self.assertFalse((self.directory / "key-tombstone.json").exists())
        with self.assertRaises(self.j.Rejected):
            self.j.claim_one_launch(105)
        no_launch = {**self.release, "ownership": unknown["ownership"],
                     "noLaunchReceiptSha256": "f" * 64}
        with self.assertRaises(self.j.Rejected):
            self.l.record_abandoned(no_launch, 105)

    def test_unknown_after_startup_records_lost_continuity_truth_not_permission(self):
        self.start()
        unknown = {"ownership": {**self.ownership, "ownedChild": None,
            "windowHeld": False, "canonicalLockHeld": None, "sourcesInhibited": False},
            "custodian": "fixed-DS-owner", "dispositionDeadlineWallMs": 110,
            "reason": "CUSTODY_CONTINUITY_UNKNOWN"}
        self.l.record_unknown(unknown, 105)
        record, _ = self.l.readback("phase-unknown")
        self.assertIsNone(record["observation"]["ownership"]["ownedChild"])
        self.assertIsNone(record["observation"]["ownership"]["canonicalLockHeld"])
        self.assertFalse(record["observation"]["ownership"]["windowHeld"])
        self.assertFalse(record["observation"]["ownership"]["sourcesInhibited"])
        state = self.l.snapshot()
        self.assertEqual(state["custodian"], "fixed-DS-owner")
        self.assertEqual(state["disposition"], "UNKNOWN")
        self.assertTrue(state["launchMayHaveOccurred"])
        self.assertFalse(state["launchAllowed"])
        self.assertFalse(state["releaseAllowed"])
        self.assertFalse((self.directory / "key-tombstone.json").exists())
        with self.assertRaises(self.j.Rejected):
            self.l.record_closed(self.release, 106)

    def test_unknown_cannot_substitute_known_descriptor_or_source_identity(self):
        self.start()
        for changed in ({"windowIdentity": [20, 30]}, {"canonicalLockIdentity": [40, 50]},
                        {"ownedChild": {"pid": 99998, "identitySha256": "1" * 64}},
                        {"canonicalLockOwnershipReceiptSha256": "e" * 64},
                        {"launchSourcesInhibitedReceiptSha256": "0" * 64}):
            unknown = {"ownership": {**self.ownership, **changed},
                "custodian": "fixed-DS-owner", "dispositionDeadlineWallMs": 110,
                "reason": "CUSTODY_CONTINUITY_UNKNOWN"}
            with self.subTest(changed=changed), self.assertRaises(self.j.Rejected):
                self.l.record_unknown(unknown, 105)
        self.assertFalse((self.directory / "phase-unknown.json").exists())

    def test_abandonment_requires_affirmative_no_launch_and_permanent_tombstone(self):
        no_launch = {**self.release, "ownership": {**self.ownership, "ownedChild": None},
                     "noLaunchReceiptSha256": "f" * 64}
        with self.assertRaises(self.j.Rejected):
            self.l.record_abandoned({k: v for k, v in no_launch.items()
                                     if k != "noLaunchReceiptSha256"}, 103)
        self.l.record_abandoned(no_launch, 103)
        self.assertEqual(self.l.snapshot()["disposition"], "ABANDONED")
        self.assertFalse(self.l.snapshot()["launchAllowed"])
        with self.assertRaises(self.j.Rejected):
            self.j.claim_one_launch(104)
        self.assertFalse((self.directory / "phase-launch-attempt.json").exists())
        self.assertEqual(self.l.readback("key-tombstone")[0]["phase"], "ABANDONED")

    def test_abandonment_forbidden_after_possible_launch_or_lost_ack(self):
        self.j.claim_one_launch(103)
        no_launch = {**self.release, "ownership": {**self.ownership, "ownedChild": None},
                     "noLaunchReceiptSha256": "f" * 64}
        with self.assertRaises(self.j.Rejected):
            self.l.record_abandoned(no_launch, 104)
        self.startup["ownership"]["ownedChild"]["pid"] = 99999
        self.l.record_startup_observed(self.startup, 104)
        self.l.record_consumption_readback(self.consumption, 105)
        write = self.l._write_once
        def lost_ack(kind, record):
            result = write(kind, record)
            if kind == "key-tombstone":
                raise self.j.Rejected("SYNTHETIC_ACK_LOSS")
            return result
        with patch.object(self.l, "_write_once", side_effect=lost_ack):
            with self.assertRaises(self.j.Rejected):
                self.l.record_closed(self.release, 106)
        self.assertTrue((self.directory / "key-tombstone.json").exists())
        self.assertFalse((self.directory / "phase-closed.json").exists())
        self.assertEqual(self.l.snapshot()["disposition"], "UNKNOWN")
        with self.assertRaises(self.j.Rejected):
            self.l.record_closed(self.release, 107)

    def test_duplicate_noncanonical_parent_hash_and_symlink_fail_closed(self):
        self.start()
        path = self.directory / "phase-startup.json"
        original = path.read_bytes()
        record = json.loads(original)
        for raw in (original.replace(b'"phase":"STARTUP_OBSERVED"',
                    b'"phase":"STARTUP_OBSERVED","phase":"STARTUP_OBSERVED"'),
                    original + b" ", bytes_of({**record, "privatePayload": "x"}),
                    bytes_of({**record, "previousPhaseSha256": "0" * 64})):
            path.write_bytes(raw)
            with self.subTest(raw=raw), self.assertRaises(self.j.Rejected):
                self.l.readback("phase-startup")
        path.write_bytes(original)
        (self.directory / "phase-consumption.json").symlink_to(path)
        with self.assertRaises(self.j.Rejected):
            self.l.record_consumption_readback(self.consumption, 105)
        self.assertEqual(path.read_bytes(), original)

    def test_phase_lost_ack_does_not_permit_second_write(self):
        self.j.claim_one_launch(103)
        write = self.l._write_once
        def lost_ack(kind, record):
            result = write(kind, record)
            if kind == "phase-startup":
                raise self.j.Rejected("SYNTHETIC_ACK_LOSS")
            return result
        with patch.object(self.l, "_write_once", side_effect=lost_ack):
            with self.assertRaises(self.j.Rejected):
                self.l.record_startup_observed(self.startup, 104)
        self.assertTrue((self.directory / "phase-startup.json").exists())
        with self.assertRaises(self.j.Rejected):
            self.l.record_startup_observed(self.startup, 105)
        self.assertFalse(self.l.snapshot()["launchAllowed"])


if __name__ == "__main__":
    unittest.main()
