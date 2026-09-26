"""Assembled fixed action tests; all OS observations are disposable fixtures."""

import importlib.util
import fcntl
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

from fixture_io import SyntheticFixedIO


ROOT = Path(__file__).resolve().parents[3]
BUILDER = ROOT / "deployment-artifacts/hr-s256-trusted-cut-v1/build_candidate.py"


class FixedAssembledActionTest(unittest.TestCase):
    def assembled(self, root):
        spec = importlib.util.spec_from_file_location("builder_components", BUILDER)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        path = Path(root) / "deployment_system.py"
        path.write_bytes(builder.build_bytes())
        with patch.dict(os.environ, {"DS_TEST_MODE": "1", "DS_STATE_ROOT": root,
                "DS_INSTALL_DIR": root + "/install", "DS_GEN_ROOT": root + "/gens"}):
            spec = importlib.util.spec_from_file_location("assembled_components", path)
            ds = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(ds)
        return ds

    def run_fixture(self, ds, io):
        request = {"action": ds.HR_PROFILE.ACTION, "operation_id": ds.HR_PROFILE.OPERATION_ID}
        with patch.object(ds.HR_ONE_SHOT, "fixed_io", return_value=io), patch.object(
                ds.HR_PROJECTION, "fixed_subject_projection", return_value=io.projection), patch.object(
                ds.HR_COLLECTOR, "collect_whole_host", side_effect=io.collect):
            return ds.handle(json.dumps(request).encode())[0]

    def cleanup_custody(self, ds):
        # Test teardown only; no request/API releases retained exclusion.
        if hasattr(ds.HR_ONE_SHOT, "_custody"):
            owned = ds.HR_ONE_SHOT._custody.pop("fixed-DS-owner", None)
            if owned is not None:
                os.close(owned["canonicalFd"])

    def test_missing_manifest_route_never_authorizes_or_launches_after_inhibition(self):
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o755)
            ds = self.assembled(root)
            io = SyntheticFixedIO(root, ds)
            original = io.observed_entry_closure
            io.observed_entry_closure = lambda: (original()[0], original()[1][:-1])
            try:
                response = self.run_fixture(ds, io)
                self.assertFalse(response["ok"])
                self.assertIn("LAUNCH_WINDOW_OR_SOURCE_UNKNOWN", str(response))
                self.assertIsNone(io.child)
                self.assertFalse((Path(root) / ds.HR_PROFILE.OPERATION_ID / "launch-authorization.json").exists())
            finally:
                self.cleanup_custody(ds)
                if io.window is not None:
                    os.close(io.window)

    def test_actual_handler_retains_exact_lock_after_effect_unknown_and_blocks_next_request(self):
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o755)
            ds = self.assembled(root)
            io = SyntheticFixedIO(root, ds)
            io.window_lost_at = 1  # Intent/inhibit already happened, no proof fabricated.
            try:
                result = self.run_fixture(ds, io)
                self.assertEqual(result["disposition"], "UNKNOWN")
                contender = os.open(Path(root) / "mutation.lock", os.O_RDWR)
                try:
                    with self.assertRaises(BlockingIOError):
                        fcntl.flock(contender, fcntl.LOCK_EX | fcntl.LOCK_NB)
                finally:
                    os.close(contender)
                self.assertEqual(ds.read_receipt(ds.HR_PROFILE.OPERATION_ID)["status"],
                                 "OUTCOME_UNKNOWN")
                next_result = self.run_fixture(ds, io)
                self.assertEqual(next_result["error"], "MUTATION_ALREADY_RUNNING")
                self.assertNotIn("launch", io.effects)
                self.assertNotIn("release", io.effects)
                self.assertTrue((Path(root) / ds.HR_JOURNAL.DIRECTORY / "intent.json").exists())
                self.assertFalse((Path(root) / ds.HR_JOURNAL.DIRECTORY / "bundle.json").exists())
            finally:
                self.cleanup_custody(ds)
                io.cleanup()

    def test_actual_archive_journal_fd_lifecycle_chain_and_second_execution_refusal(self):
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o755)
            ds = self.assembled(root)
            io = SyntheticFixedIO(root, ds)
            try:
                result = self.run_fixture(ds, io)
                self.assertEqual(result, {"ok": True, "disposition": "CLOSED", "nonproduction": True})
                self.assertEqual(io.effects.count("launch"), 1)
                self.assertEqual(ds.HR_LIFECYCLE.snapshot()["disposition"], "CLOSED")
                self.assertEqual(ds.HR_ARCHIVE.readback()["archive"]["runtimeTreeProcessCount"], 0)
                self.assertEqual(ds.HR_JOURNAL.readback("launch-claimed")[0]["phase"], "LAUNCH_CLAIMED")
                contender = os.open(Path(root) / "mutation.lock", os.O_RDWR)
                try:
                    fcntl.flock(contender, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(contender, fcntl.LOCK_UN)
                finally:
                    os.close(contender)
                repeat = self.run_fixture(ds, io)
                self.assertFalse(repeat["ok"])
                self.assertEqual(io.effects.count("launch"), 1)
            finally:
                io.cleanup()

    def test_hidden_same_uid_actor_rejects_before_intent_and_any_effect(self):
        with tempfile.TemporaryDirectory() as root:
            ds = self.assembled(root)
            io = SyntheticFixedIO(root, ds)
            io.residual_actor = True
            result = self.run_fixture(ds, io)
            self.assertEqual(result["error"], "SOURCE_CLOSURE_UNKNOWN")
            self.assertEqual(io.effects, [])
            self.assertFalse((Path(root) / ds.HR_JOURNAL.DIRECTORY).exists())

    def test_real_production_configuration_cannot_reach_synthetic_internal_io(self):
        with tempfile.TemporaryDirectory() as root:
            ds = self.assembled(root)
            ds.TEST_MODE = False
            request = {"action": ds.HR_PROFILE.ACTION,
                       "operation_id": ds.HR_PROFILE.OPERATION_ID}
            with patch.object(ds.HR_ONE_SHOT, "fixed_io", side_effect=AssertionError(
                    "synthetic IO reached")), patch.object(ds.HR_PROJECTION,
                    "fixed_subject_projection", side_effect=AssertionError("protected read")):
                result, _ = ds.handle(json.dumps(request).encode())
            self.assertEqual(result, {"ok": False, "error": "PROFILE_NOT_BOOTSTRAPPED"})

    def test_lost_exact_readback_keeps_actual_state_unknown_and_exclusion(self):
        with tempfile.TemporaryDirectory() as root:
            os.chmod(root, 0o755)
            ds = self.assembled(root)
            io = SyntheticFixedIO(root, ds)
            try:
                with patch.object(io, "exact_consumption_readback", side_effect=OSError("lost")):
                    result = self.run_fixture(ds, io)
                self.assertEqual(result["disposition"], "UNKNOWN")
                self.assertEqual(result["error"], "OBSERVATION_UNAVAILABLE")
                self.assertEqual(ds.HR_LIFECYCLE.snapshot()["disposition"], "UNKNOWN")
                self.assertFalse((Path(root) / ds.HR_JOURNAL.DIRECTORY /
                                  "phase-consumption.json").exists())
                self.assertNotIn("release", io.effects)
            finally:
                self.cleanup_custody(ds)
                io.cleanup()

    def test_loss_at_each_post_seal_boundary_stays_unknown_no_release_or_replay(self):
        for lost_at in (6, 7, 8, 9, 10, 11):
            with self.subTest(lost_at=lost_at), tempfile.TemporaryDirectory() as root:
                os.chmod(root, 0o755)
                ds = self.assembled(root)
                io = SyntheticFixedIO(root, ds)
                io.window_lost_at = lost_at
                try:
                    result = self.run_fixture(ds, io)
                    self.assertFalse(result["ok"])
                    self.assertEqual(result["disposition"], "UNKNOWN")
                    self.assertTrue(result["unknownReceiptWritten"])
                    self.assertEqual(ds.HR_LIFECYCLE.snapshot()["disposition"], "UNKNOWN")
                    self.assertNotIn("release", io.effects)
                    launches = io.effects.count("launch")
                    self.run_fixture(ds, io)
                    self.assertEqual(io.effects.count("launch"), launches)
                finally:
                    self.cleanup_custody(ds)
                    io.cleanup()

    def test_fixed_action_dispatches_internal_owner_under_canonical_mutex(self):
        spec = importlib.util.spec_from_file_location("fixed_builder_dispatch", BUILDER)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "deployment_system.py"
            path.write_bytes(builder.build_bytes())
            with patch.dict(os.environ, {"DS_TEST_MODE": "1", "DS_STATE_ROOT": root,
                    "DS_INSTALL_DIR": root + "/install", "DS_GEN_ROOT": root + "/gens"}):
                spec = importlib.util.spec_from_file_location("fixed_dispatch", path)
                ds = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ds)
            seen = []
            def internal_owner(request, lock_fd):
                seen.append((request, os.fstat(lock_fd).st_ino))
                return {"ok": True, "disposition": "NONPRODUCTION_DISPATCH_ONLY"}
            with patch.object(ds, "HR_ONE_SHOT", types.SimpleNamespace(
                    run_fixed=internal_owner, canonical_fd_owned=lambda fd: False), create=True):
                request = {"action": ds.HR_PROFILE.ACTION,
                           "operation_id": ds.HR_PROFILE.OPERATION_ID}
                response, restart = ds.handle(json.dumps(request).encode())
            self.assertEqual(response, {"ok": True,
                "disposition": "NONPRODUCTION_DISPATCH_ONLY"})
            self.assertEqual(len(seen), 1)
            self.assertIsNone(restart)

    def test_assembled_action_has_fixed_orchestration_without_production_activation(self):
        spec = importlib.util.spec_from_file_location("fixed_builder", BUILDER)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "deployment_system.py"
            path.write_bytes(builder.build_bytes())
            with patch.dict(os.environ, {"DS_TEST_MODE": "1", "DS_STATE_ROOT": root,
                    "DS_INSTALL_DIR": root + "/install", "DS_GEN_ROOT": root + "/gens"}):
                spec = importlib.util.spec_from_file_location("fixed_assembled", path)
                ds = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ds)
            request = {"action": ds.HR_PROFILE.ACTION,
                       "operation_id": ds.HR_PROFILE.OPERATION_ID}
            response, restart = ds.handle(json.dumps(request).encode())
            self.assertEqual(response, {"ok": False, "error": "PROFILE_NOT_BOOTSTRAPPED"})
            self.assertIsNone(restart)
            self.assertTrue(hasattr(ds, "HR_ONE_SHOT"),
                "assembled action lacks fixed orchestration module after canonical mutex")
            self.assertTrue(callable(ds.HR_ONE_SHOT.run_fixed))


if __name__ == "__main__":
    unittest.main()
