"""Real fixed adapter methods against disposable bytes/fake OS, never live host."""

import importlib.util
import json
import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch


HERE = Path(__file__).resolve().parent


class FixedRealAdapterTest(unittest.TestCase):
    def load(self):
        spec = importlib.util.spec_from_file_location("fixed_real_input", HERE / "fixed_os.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_unbootstrapped_guard_has_zero_protected_reads_even_when_root(self):
        module = self.load()
        with patch.object(module.os, "geteuid", return_value=0), patch.object(
                module, "protected_json", side_effect=AssertionError("protected read")):
            with self.assertRaisesRegex(module.Rejected, "PROFILE_NOT_BOOTSTRAPPED"):
                module.require_activation()

    def test_disposable_pinned_no_follow_input_rejects_tamper_duplicate_and_symlink(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root).resolve()
            path = directory / "proof.json"
            raw = b'{"operationId":"' + module.OPERATION_ID.encode() + b'"}\n'
            path.write_bytes(raw)
            path.chmod(0o600)
            sha = hashlib.sha256(raw).hexdigest()
            self.assertEqual(module.protected_json(path, sha, os.getuid())["operationId"],
                             module.OPERATION_ID)
            with self.assertRaisesRegex(module.Rejected, "PROTECTED_INPUT_DIGEST"):
                module.protected_json(path, "0" * 64, os.getuid())
            duplicate = b'{"a":"privatePayload=sensitive-fixture","a":1}\n'
            path.write_bytes(duplicate)
            with self.assertRaisesRegex(module.Rejected, "PROTECTED_JSON_DUPLICATE_KEY"):
                module.protected_json(path, hashlib.sha256(duplicate).hexdigest(), os.getuid())
            path.unlink()
            path.symlink_to(directory / "elsewhere")
            with self.assertRaisesRegex(module.Rejected, "PROTECTED_INPUT_UNAVAILABLE"):
                module.protected_bytes(path, os.getuid())

    def test_existing_receipt_preflight_rejects_unknown_floor_before_rollback_read(self):
        module = self.load()
        package = {"operationId": module.OPERATION_ID, "hostId": "fixture-host",
            "consumingBinarySha256": "a" * 64, "floorProvenReceiptSha256": "b" * 64,
            "validatorInstalledReceiptSha256": "c" * 64,
            "rollbackCaptureOperationId": "synthetic-capture", "expectedRegistrySha256": "d" * 64}
        floor = {"status": "UNKNOWN", "floorCommit": "2097e4f9",
            "deployedBinarySha256": "a" * 64, "provedAtWallMs": 10}
        validator = {"evidenceKind": "restart_quiescence_proven",
            "deployedBinarySha256": "a" * 64, "installedAtWallMs": 11}
        with patch.object(module, "require_activation", return_value=package), patch.object(module, "protected_json", side_effect=[floor, validator]), patch.object(
                module, "load_registry", side_effect=AssertionError("rollback read"), create=True):
            with self.assertRaisesRegex(module.Rejected, "DEPLOYMENT_PREREQUISITE_UNKNOWN"):
                module.deployed_prerequisites(package, 12)

    def test_existing_admitted_capture_is_read_only_and_exact_floor_bound(self):
        module = self.load()
        package = {"operationId": module.OPERATION_ID, "hostId": "fixture-host",
            "consumingBinarySha256": "a" * 64, "floorProvenReceiptSha256": "b" * 64,
            "validatorInstalledReceiptSha256": "c" * 64,
            "rollbackCaptureOperationId": "synthetic-capture", "expectedRegistrySha256": "d" * 64}
        floor = {"status": "ROUTER_RESTART_SAFETY=PROVEN", "floorCommit": "2097e4f9",
            "deployedBinarySha256": "a" * 64, "provedAtWallMs": 10}
        validator = {"evidenceKind": "restart_quiescence_proven",
            "deployedBinarySha256": "a" * 64, "installedAtWallMs": 11}
        capture = {"closure_sha256": "a" * 64}
        with patch.object(module, "require_activation", return_value=package), patch.object(module, "protected_json", side_effect=[floor, validator]), patch.object(
                module, "load_registry", return_value=({}, "d" * 64), create=True), patch.object(
                module, "unit_from_registry", return_value={"target": str(module.APP_ROOT),
                    "uid": 505, "gid": 601}, create=True), patch.object(
                module, "_verified_admitted_capture", return_value=("unused", capture), create=True) as verify:
            self.assertEqual(module.deployed_prerequisites(package, 12)["rollbackCapture"], capture)
            verify.assert_called_once_with("synthetic-capture", "d" * 64, str(module.APP_ROOT), check_live=True)

    def test_deployment_method_cannot_bypass_activation_with_caller_package(self):
        module = self.load()
        with patch.object(module, "protected_json", side_effect=AssertionError("protected read")):
            with self.assertRaisesRegex(module.Rejected, "PROFILE_NOT_BOOTSTRAPPED"):
                module.deployed_prerequisites({}, 100)
    def test_actual_fd_readback_binds_original_commitment_and_changed_store_rejects(self):
        module = self.load()
        with tempfile.TemporaryFile() as store:
            store.write(b"disposable-store"); store.flush()
            meta = os.fstat(store.fileno())
            subject = {"reconciliationHandle": module.HANDLE, "turnExecutionId": module.HANDLE,
                "runtimeEpoch": "old", "agentId": "agt_hr-agent", "processGeneration": 1}
            projection = {"subject": subject, "settlement": {"reconciliationHandle": module.HANDLE,
                "queryState": "settled", "fenceState": "cleared", "initialOutcome": "outcome_unknown",
                "terminationEvidence": "restart_quiescence_proven"}}
            adapter = SimpleNamespace(pinned_validator_sources=lambda: {"pinned": "fixture"},
                opened_fixed_store=lambda: (os.dup(store.fileno()), os.fstat(store.fileno())),
                digest_fd=lambda fd, size: hashlib.sha256(os.pread(fd, size, 0)).hexdigest(),
                identity=lambda m: (m.st_dev, m.st_ino, m.st_size, m.st_mtime_ns))
            committed = {key: value for key, value in subject.items() if key != "reconciliationHandle"}
            journal = SimpleNamespace(readback=lambda kind: ({"subject": committed}, "fixture-sha"))
            with patch.object(module, "require_activation", return_value={"consumingBinarySha256": "a" * 64}), patch.object(
                    module, "HR_JOURNAL", journal, create=True), patch.object(
                    module, "bounded_validator_output", return_value=json.dumps(projection).encode()):
                result = module.installed_settlement_projection(adapter, "fixture", module.digest(b"fixture"))
                self.assertEqual(result["subject"], subject)
                journal.readback = lambda kind: ({"subject": {**committed, "runtimeEpoch": "different"}}, "sha")
                with self.assertRaisesRegex(module.Rejected, "READBACK_SUBJECT_MISMATCH"):
                    module.installed_settlement_projection(adapter, "fixture", module.digest(b"fixture"))
                journal.readback = lambda kind: ({"subject": committed}, "sha")
                def mutate(*args):
                    os.pwrite(store.fileno(), b"changed", 0)
                    return json.dumps(projection).encode()
                with patch.object(module, "bounded_validator_output", side_effect=mutate):
                    with self.assertRaisesRegex(module.Rejected, "READBACK_CHANGED"):
                        module.installed_settlement_projection(adapter, "fixture", module.digest(b"fixture"))
            self.assertEqual(meta.st_ino, os.fstat(store.fileno()).st_ino)

    def test_assembled_candidate_guard_refuses_before_protected_io(self):
        builder_path = HERE.parents[2] / "deployment-artifacts/hr-s256-trusted-cut-v1/build_candidate.py"
        spec = importlib.util.spec_from_file_location("builder", builder_path)
        builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
        source = builder.build_bytes().decode()
        start = source.index("def _make_HR_REAL_OS():")
        end = source.index("def hr_s256_action(request):", start)
        context = {"types": __import__("types")}
        exec(source[start:end], context)
        adapter = context["HR_REAL_OS"]
        with patch.object(adapter.os, "geteuid", return_value=0):
            with self.assertRaisesRegex(adapter.Rejected, "PROFILE_NOT_BOOTSTRAPPED"):
                adapter.require_activation()

    def test_fixed_receipt_uses_canonical_owner_root_not_namespace_attribute(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            directory = root / module.OPERATION_ID
            directory.mkdir(mode=0o700)
            journal = SimpleNamespace(DIRECTORY=module.OPERATION_ID,
                canonical=lambda value: json.dumps(value, sort_keys=True).encode(),
                opened_custody=lambda create: (os.open(root, os.O_RDONLY), os.open(directory, os.O_RDONLY)))
            observation = {"subject": {"handle": module.HANDLE},
                "validatedStoreSha256": "a" * 64, "validatorBinarySha256": "b" * 64,
                "settlement": {"queryState": "settled"}}
            actual_reader = module.protected_bytes
            with patch.object(module, "HR_JOURNAL", journal, create=True), patch.object(
                    module, "STATE_ROOT", str(root), create=True), patch.object(
                    module, "HR_PROJECTION", None, create=True), patch.object(
                    module, "HR_READBACK_HELPER_SOURCE", "fixture", create=True), patch.object(
                    module, "HR_READBACK_HELPER_SHA256", "c" * 64, create=True), patch.object(
                    module, "installed_settlement_projection", return_value=observation), patch.object(
                    module, "protected_bytes", side_effect=lambda path: actual_reader(path, os.getuid())):
                receipt = module.fixed_settlement_readback()
                raw = (directory / "store-readback.json").read_bytes()
                self.assertEqual(receipt["storeReadbackReceiptSha256"], hashlib.sha256(raw).hexdigest())
                with self.assertRaisesRegex(module.Rejected, "READBACK_RECEIPT_UNKNOWN"):
                    module.fixed_settlement_readback()

    def test_guarded_fixed_os_adapter_exists_before_any_real_method_can_be_enabled(self):
        path = HERE / "fixed_os.py"
        self.assertTrue(path.exists(), "fixed root-capable OS adapter is absent")
        spec = importlib.util.spec_from_file_location("fixed_real_adapter", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with self.assertRaises(module.Rejected) as rejected:
            module.require_activation()
        self.assertEqual(str(rejected.exception), "PROFILE_NOT_BOOTSTRAPPED")


if __name__ == "__main__":
    unittest.main()
