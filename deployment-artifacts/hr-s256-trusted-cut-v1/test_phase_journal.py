"""Synthetic fixed-operation prelaunch phase ordering and crash tests."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_commitment import authorization, bytes_of, final_bundle


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("journal_phase_test", HERE / "journal.py")
journal = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(journal)


class FixedPhaseJournalTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        journal.TEST_MODE = True
        journal.STATE_ROOT = self.tmp.name
        journal.seal_intent("n" * 32, "a" * 64, 97)
        self.auth = authorization()
        self.auth_digest = journal.seal_launch_authorization(self.auth)
        self.bundle = bytes_of(final_bundle(self.auth, self.auth_digest))

    def tearDown(self):
        self.tmp.cleanup()

    @property
    def directory(self):
        return Path(self.tmp.name) / journal.DIRECTORY

    def test_sealed_phase_precedes_durable_attempt_and_one_claim(self):
        commitment_digest = journal.seal_bundle_commitment(self.bundle, 102)
        self.assertTrue((self.directory / "phase-sealed.json").exists())
        sealed, sealed_digest = journal.readback("phase-sealed")
        self.assertEqual(sealed["phase"], "SEALED_NOT_ATTEMPTED")
        self.assertEqual(sealed["bundleCommitmentSha256"], commitment_digest)
        self.assertIsNone(sealed["previousPhaseSha256"])
        self.assertFalse((self.directory / "phase-launch-attempt.json").exists())
        journal.claim_one_launch(103)
        attempt, _ = journal.readback("phase-launch-attempt")
        self.assertEqual(attempt["phase"], "LAUNCH_ATTEMPT_COMMITTED")
        self.assertEqual(attempt["previousPhaseSha256"], sealed_digest)
        self.assertEqual(journal.readback("launch-claimed")[0]["atWallMs"], 103)
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(104)

    def test_crash_before_sealed_phase_never_admits_attempt_or_reseal(self):
        write_once = journal.write_once

        def fail_before_phase(kind, record):
            if kind == "phase-sealed":
                raise journal.Rejected("SYNTHETIC_CRASH")
            return write_once(kind, record)

        with patch.object(journal, "write_once", side_effect=fail_before_phase):
            with self.assertRaises(journal.Rejected):
                journal.seal_bundle_commitment(self.bundle, 102)
        self.assertTrue((self.directory / "bundle-commitment.json").exists())
        self.assertFalse((self.directory / "phase-sealed.json").exists())
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(103)
        with self.assertRaises(journal.Rejected):
            journal.seal_bundle_commitment(self.bundle, 102)

    def test_lost_ack_after_attempt_marker_is_unknown_not_replay(self):
        journal.seal_bundle_commitment(self.bundle, 102)
        write_once = journal.write_once

        def lose_ack(kind, record):
            digest = write_once(kind, record)
            if kind == "phase-launch-attempt":
                raise journal.Rejected("SYNTHETIC_ACK_LOSS")
            return digest

        with patch.object(journal, "write_once", side_effect=lose_ack):
            with self.assertRaises(journal.Rejected):
                journal.claim_one_launch(103)
        self.assertEqual(journal.readback("phase-launch-attempt")[0]["phase"],
                         "LAUNCH_ATTEMPT_COMMITTED")
        self.assertFalse((self.directory / "launch-claimed.json").exists())
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(104)

    def test_restart_or_attempt_write_failure_never_reuses_sealed_nonce(self):
        journal.seal_bundle_commitment(self.bundle, 102)
        fresh_spec = importlib.util.spec_from_file_location("journal_restarted", HERE / "journal.py")
        restarted = importlib.util.module_from_spec(fresh_spec)
        fresh_spec.loader.exec_module(restarted)
        restarted.TEST_MODE = True
        restarted.STATE_ROOT = self.tmp.name
        with self.assertRaises(restarted.Rejected):
            restarted.claim_one_launch(103)
        write_once = journal.write_once

        def fail_before_attempt(kind, record):
            if kind == "phase-launch-attempt":
                raise journal.Rejected("SYNTHETIC_WRITE_FAILURE")
            return write_once(kind, record)

        with patch.object(journal, "write_once", side_effect=fail_before_attempt):
            with self.assertRaises(journal.Rejected):
                journal.claim_one_launch(103)
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(104)
        self.assertFalse((self.directory / "launch-claimed.json").exists())

    def test_tampered_or_wrong_identity_phase_never_admits_launch(self):
        journal.seal_bundle_commitment(self.bundle, 102)
        path = self.directory / "phase-sealed.json"
        self.assertTrue(path.exists())
        original = json.loads(path.read_bytes())
        for changed in ({**original, "extra": "private"},
                        {**original, "operationId": "other"},
                        {**original, "startupNonceSha256": "0" * 64},
                        {**original, "version": True}):
            path.write_bytes(bytes_of(changed))
            with self.subTest(changed=changed), self.assertRaises(journal.Rejected):
                journal.readback("phase-sealed")
            self.assertFalse((self.directory / "phase-launch-attempt.json").exists())
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(103)
        path.write_bytes(bytes_of(original))
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(104)

    def test_attempt_parent_hash_tamper_invalidates_claim_readback(self):
        journal.seal_bundle_commitment(self.bundle, 102)
        journal.claim_one_launch(103)
        attempt_path = self.directory / "phase-launch-attempt.json"
        attempt = json.loads(attempt_path.read_bytes())
        attempt_path.write_bytes(bytes_of({**attempt, "previousPhaseSha256": "0" * 64}))
        with self.assertRaises(journal.Rejected):
            journal.readback("phase-launch-attempt")
        with self.assertRaises(journal.Rejected):
            journal.readback("launch-claimed")


if __name__ == "__main__":
    unittest.main()
