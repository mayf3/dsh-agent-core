"""Synthetic fixed-s256 bundle-commitment and no-replay custody tests."""

import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("journal_commitment_test", HERE / "journal.py")
journal = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(journal)


def authorization():
    return {"operationId": journal.OPERATION_ID, "hostId": "fixture-host",
            "startupNonce": "n" * 32, "subjectPreimageSha256": "a" * 64,
            "authorizedStartupAtWallMs": 101,
            "subject": {"reconciliationHandle": journal.HANDLE,
                        "turnExecutionId": journal.HANDLE,
                        "runtimeEpoch": "old-epoch", "agentId": "agt_hr-agent",
                        "processGeneration": 1},
            "consumingBinarySha256": "b" * 64, "archiveSha256": "c" * 64,
            "outputsSha256": ["d" * 64, "e" * 64],
            "holderCheck": {"operationId": journal.OPERATION_ID,
                            "method": "lsof", "openHolderCount": 0,
                            "executedAtWallMs": 100,
                            "paths": ["/fixture/workspace"]}}


def final_bundle(auth, launch_digest):
    return {"bundleSchemaVersion": 2, "subject": auth["subject"],
            "epochRetirement": {"retiredEpoch": "old-epoch"},
            "recoveryCutover": {"operationId": journal.OPERATION_ID,
                "hostId": auth["hostId"], "startupNonce": auth["startupNonce"],
                "subjectPreimageSha256": auth["subjectPreimageSha256"],
                "exclusiveWindowReceiptSha256": "f" * 64,
                "launchSourcesInhibitedReceiptSha256": "f" * 64,
                "oldTreeQuiescedReceiptSha256": "f" * 64,
                "launchAuthorizationReceiptSha256": launch_digest,
                "windowOpenedAtWallMs": 98, "oldTreeQuiescedAtWallMs": 99,
                "authorizedStartupAtWallMs": 101,
                "consumingBinarySha256": auth["consumingBinarySha256"]},
            "deploymentProof": {"floorProvenReceiptSha256": "f" * 64,
                "validatorInstalledReceiptSha256": "f" * 64,
                "deployedBinarySha256": auth["consumingBinarySha256"]},
            "hostCensus": {"operationId": journal.OPERATION_ID,
                "hostId": auth["hostId"], "executedAtWallMs": 100,
                "tools": ["ps", "lsof"], "outputsSha256": auth["outputsSha256"],
                "archiveRef": "fixture-archive", "runtimeTreeProcessCount": 0},
            "holderCheck": auth["holderCheck"],
            "custody": {"executedAs": "root",
                "producedBy": "trusted_cp_recovery_evidence_collector_v1",
                "evidenceDir": "/fixture/root/evidence"},
            "controlledStop": None}


def bytes_of(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


class FixedCommitmentTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        journal.TEST_MODE = True
        journal.STATE_ROOT = self.tmp.name
        journal.seal_intent("n" * 32, "a" * 64, 97)
        self.auth = authorization()
        self.launch_digest = journal.seal_launch_authorization(self.auth)
        self.bundle = final_bundle(self.auth, self.launch_digest)

    def tearDown(self):
        self.tmp.cleanup()

    @property
    def directory(self):
        return Path(self.tmp.name) / journal.DIRECTORY

    def test_create_only_exact_final_bytes_and_index_before_launch_claim(self):
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(103)
        raw = bytes_of(self.bundle)
        digest = journal.seal_bundle_commitment(raw, 102)
        record, observed = journal.readback("bundle-commitment")
        self.assertEqual(observed, digest)
        self.assertEqual(record["bundleByteLength"], len(raw))
        self.assertEqual(record["bundleSha256"], journal.sha256(raw))
        self.assertEqual(record["subject"]["turnExecutionId"], journal.HANDLE)
        self.assertEqual(journal.readback("live-handle-index")[0]["bundleSha256"],
                         journal.sha256(raw))
        journal.claim_one_launch(103)
        with self.assertRaises(journal.Rejected):
            journal.seal_bundle_commitment(raw, 104)
        with self.assertRaises(journal.Rejected):
            changed = {**self.bundle, "controlledStop": {"extra": "different"}}
            journal.seal_bundle_commitment(bytes_of(changed), 104)
        self.assertEqual(journal.readback("bundle-commitment")[1], digest)

    def test_wrong_subject_cut_or_bytes_reject_before_index_creation(self):
        bad = [
            {**self.bundle, "subject": {**self.bundle["subject"], "agentId": "other"}},
            {**self.bundle, "recoveryCutover": {
                **self.bundle["recoveryCutover"], "startupNonce": "other"}},
            {**self.bundle, "recoveryCutover": {
                **self.bundle["recoveryCutover"],
                "launchAuthorizationReceiptSha256": "0" * 64}},
            {**self.bundle, "privatePayload": "forbidden"},
        ]
        for changed in bad:
            with self.subTest(changed=changed), self.assertRaises(journal.Rejected):
                journal.seal_bundle_commitment(bytes_of(changed), 102)
            self.assertFalse((self.directory / "live-handle-index.json").exists())
        for raw in (b"", b"{", b"x" * 65537):
            with self.subTest(raw=raw[:8]), self.assertRaises(journal.Rejected):
                journal.seal_bundle_commitment(raw, 102)
            self.assertFalse((self.directory / "live-handle-index.json").exists())
        raw = bytes_of(self.bundle)
        duplicate = raw.replace(b'"bundleSchemaVersion":2,',
                                b'"bundleSchemaVersion":2,"bundleSchemaVersion":2,', 1)
        with self.assertRaises(journal.Rejected):
            journal.seal_bundle_commitment(duplicate, 102)
        self.assertFalse((self.directory / "bundle.json").exists())

    def test_tampered_receipt_index_or_symlink_blocks_readback_and_launch(self):
        raw = bytes_of(self.bundle)
        journal.seal_bundle_commitment(raw, 102)
        index = self.directory / "live-handle-index.json"
        index.write_bytes(index.read_bytes() + b" ")
        with self.assertRaises(journal.Rejected):
            journal.readback("bundle-commitment")
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(103)
        index.unlink()
        index.symlink_to(self.directory / "bundle-commitment.json")
        with self.assertRaises(journal.Rejected):
            journal.readback("bundle-commitment")

    def test_changed_final_bytes_or_receipt_reject_after_registration(self):
        journal.seal_bundle_commitment(bytes_of(self.bundle), 102)
        bundle_path = self.directory / "bundle.json"
        bundle_path.write_bytes(bundle_path.read_bytes() + b" ")
        with self.assertRaises(journal.Rejected):
            journal.readback("bundle-commitment")
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(103)

    def test_receipt_with_private_field_rejects_before_launch_claim(self):
        journal.seal_bundle_commitment(bytes_of(self.bundle), 102)
        receipt_path = self.directory / "bundle-commitment.json"
        receipt = json.loads(receipt_path.read_bytes())
        receipt["privatePayload"] = "forbidden"
        receipt_path.write_bytes(bytes_of(receipt))
        with self.assertRaises(journal.Rejected):
            journal.readback("bundle-commitment")
        with self.assertRaises(journal.Rejected):
            journal.claim_one_launch(103)

    def test_launch_authorization_outer_schema_and_integer_version_are_closed(self):
        path = self.directory / "launch-authorization.json"
        original = json.loads(path.read_bytes())
        altered = (
            {**original, "unexpected": "private"},
            {key: value for key, value in original.items() if key != "intentSha256"},
            {**original, "version": 2},
            {**original, "version": True},
        )
        for record in altered:
            path.write_bytes(bytes_of(record))
            with self.subTest(record=record), self.assertRaises(journal.Rejected):
                journal.readback("launch-authorization")
        path.write_bytes(bytes_of(altered[0]))
        changed = copy.deepcopy(self.bundle)
        changed["recoveryCutover"]["launchAuthorizationReceiptSha256"] = journal.sha256(
            bytes_of(altered[0]))
        with self.assertRaises(journal.Rejected):
            journal.seal_bundle_commitment(bytes_of(changed), 102)
        self.assertFalse((self.directory / "bundle.json").exists())

    def test_bool_version_in_antecedent_or_claim_is_not_one(self):
        intent_path = self.directory / "intent.json"
        original_intent = json.loads(intent_path.read_bytes())
        intent_path.write_bytes(bytes_of({**original_intent, "version": True}))
        with self.assertRaises(journal.Rejected):
            journal.readback("intent")
        intent_path.write_bytes(bytes_of(original_intent))
        journal.seal_bundle_commitment(bytes_of(self.bundle), 102)
        journal.claim_one_launch(103)
        claim_path = self.directory / "launch-claimed.json"
        original_claim = json.loads(claim_path.read_bytes())
        claim_path.write_bytes(bytes_of({**original_claim, "version": True}))
        with self.assertRaises(journal.Rejected):
            journal.readback("launch-claimed")

    def test_bool_counts_and_noninteger_receipt_numbers_reject(self):
        for field in ("runtimeTreeProcessCount",):
            changed = copy.deepcopy(self.bundle)
            changed["hostCensus"][field] = False
            with self.assertRaises(journal.Rejected):
                journal.seal_bundle_commitment(bytes_of(changed), 102)
        changed = copy.deepcopy(self.bundle)
        changed["holderCheck"]["openHolderCount"] = False
        with self.assertRaises(journal.Rejected):
            journal.seal_bundle_commitment(bytes_of(changed), 102)
        journal.seal_bundle_commitment(bytes_of(self.bundle), 102)
        receipt_path = self.directory / "bundle-commitment.json"
        original = json.loads(receipt_path.read_bytes())
        for field, replacement in (("receiptVersion", True),
                                   ("bundleByteLength", float(original["bundleByteLength"]))):
            changed = {**original, field: replacement}
            receipt_path.write_bytes(bytes_of(changed))
            with self.subTest(field=field), self.assertRaises(journal.Rejected):
                journal.readback("bundle-commitment")
        receipt_path.write_bytes(bytes_of(original))

    def test_crash_between_bundle_index_and_receipt_is_ineligible_no_replay(self):
        write_once = journal.write_once
        for stopped_at in ("live-handle-index", "bundle-commitment"):
            with self.subTest(stopped_at=stopped_at), tempfile.TemporaryDirectory() as root:
                journal.STATE_ROOT = root
                journal.seal_intent("n" * 32, "a" * 64, 97)
                auth = authorization()
                digest = journal.seal_launch_authorization(auth)
                current = bytes_of(final_bundle(auth, digest))

                def crash(kind, record):
                    if kind == stopped_at:
                        raise journal.Rejected("SYNTHETIC_CRASH")
                    return write_once(kind, record)

                with patch.object(journal, "write_once", side_effect=crash):
                    with self.assertRaises(journal.Rejected):
                        journal.seal_bundle_commitment(current, 102)
                with self.assertRaises(journal.Rejected):
                    journal.claim_one_launch(103)
                with self.assertRaises(journal.Rejected):
                    journal.seal_bundle_commitment(current, 102)
                self.assertEqual((Path(root) / journal.DIRECTORY /
                                  "bundle.json").read_bytes(), current)
        journal.STATE_ROOT = self.tmp.name


if __name__ == "__main__":
    unittest.main()
