"""Non-root fixed-operation custody and one-launch handoff fixtures."""

import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


journal = load("journal")
handoff = load("handoff")


def authorization(nonce="n" * 32, digest="a" * 64):
    return {"operationId": journal.OPERATION_ID, "hostId": "fixture-host",
            "subjectPreimageSha256": digest, "startupNonce": nonce,
            "authorizedStartupAtWallMs": 101,
            "subject": {"reconciliationHandle": journal.HANDLE,
                        "turnExecutionId": journal.HANDLE,
                        "runtimeEpoch": "old-epoch", "agentId": "agt_hr-agent",
                        "processGeneration": 1},
            "consumingBinarySha256": "b" * 64, "archiveSha256": "c" * 64,
            "outputsSha256": ["d" * 64, "e" * 64],
            "holderCheck": {"operationId": journal.OPERATION_ID,
                            "method": "lsof", "openHolderCount": 0,
                            "executedAtWallMs": 100}}


class FixedCustodyTest(unittest.TestCase):
    def test_intent_and_launch_receipt_are_exclusive_fsynced_and_read_back(self):
        with tempfile.TemporaryDirectory() as root:
            journal.TEST_MODE = True
            journal.STATE_ROOT = root
            nonce = "n" * 32
            digest = "a" * 64
            intent_hash = journal.seal_intent(nonce, digest, 100)
            self.assertEqual(journal.readback("intent")[1], intent_hash)
            op_dir = Path(root) / journal.DIRECTORY
            self.assertEqual(op_dir.stat().st_mode & 0o777, 0o700)
            self.assertEqual((op_dir / "intent.json").stat().st_mode & 0o777, 0o600)
            with self.assertRaises(journal.Rejected):
                journal.seal_intent(nonce, digest, 100)
            receipt = authorization(nonce, digest)
            receipt_hash = journal.seal_launch_authorization(receipt)
            self.assertEqual(journal.readback("launch-authorization")[1], receipt_hash)
            claim_hash = journal.claim_one_launch(102)
            self.assertEqual(journal.readback("launch-claimed")[1], claim_hash)
            with self.assertRaises(journal.Rejected):
                journal.claim_one_launch(103)
            restarted = load("journal")
            restarted.TEST_MODE = True
            restarted.STATE_ROOT = root
            with self.assertRaises(restarted.Rejected):
                restarted.claim_one_launch(103)
            with self.assertRaises(journal.Rejected):
                journal.seal_launch_authorization(receipt)
            (op_dir / "intent.json").write_bytes(b"{}")
            with self.assertRaises(journal.Rejected):
                journal.readback("intent")

    def test_wrong_nonce_preimage_and_symlinked_custody_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            journal.TEST_MODE = True
            journal.STATE_ROOT = root
            journal.seal_intent("n" * 32, "a" * 64, 100)
            base = authorization()
            for change in ({"startupNonce": "x" * 32},
                           {"subjectPreimageSha256": "b" * 64},
                           {"authorizedStartupAtWallMs": 99},
                           {"subject": {**base["subject"], "agentId": "other"}},
                           {"callerPass": True}):
                with self.subTest(change=change), self.assertRaises(journal.Rejected):
                    journal.seal_launch_authorization({**base, **change})
            self.assertFalse((Path(root) / journal.DIRECTORY /
                              "launch-authorization.json").exists())
        with tempfile.TemporaryDirectory() as root:
            journal.STATE_ROOT = root
            (Path(root) / journal.DIRECTORY).symlink_to(Path(root) / "other")
            with self.assertRaises(journal.Rejected):
                journal.seal_intent("n" * 32, "a" * 64, 100)

    def test_nonce_window_descriptors_are_one_launch_and_challenged(self):
        with tempfile.TemporaryDirectory() as root:
            journal.TEST_MODE = True
            journal.STATE_ROOT = root
            nonce = "n" * 32
            journal.seal_intent(nonce, "a" * 64, 100)
            receipt_hash = journal.seal_launch_authorization(authorization(nonce))
            journal.claim_one_launch(102)
            window = os.open(Path(root) / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
            try:
                gate = handoff.OneLaunchHandoff(receipt_hash, window, nonce)
                child_fd, window_child_fd = gate.take_child_fds()
                with self.assertRaises(handoff.Rejected):
                    gate.take_child_fds()
                script = ("import importlib.util,sys; "
                          "s=importlib.util.spec_from_file_location('handoff',sys.argv[1]); "
                          "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                          "m.child_prove(int(sys.argv[2]),int(sys.argv[3]),sys.argv[4])")
                child = subprocess.Popen([sys.executable, "-c", script,
                    str(HERE / "handoff.py"), str(child_fd), str(window_child_fd), receipt_hash],
                    pass_fds=(child_fd, window_child_fd), stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                gate.close_child_fds()
                gate.challenge()
                self.assertEqual(child.wait(timeout=2), 0)
                child.stderr.close()
                with self.assertRaises(handoff.Rejected):
                    gate.challenge()
                gate.close()
            finally:
                os.close(window)

    def test_wrong_receipt_or_missing_fd_never_authenticates(self):
        with tempfile.TemporaryDirectory() as root:
            window = os.open(Path(root) / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
            try:
                gate = handoff.OneLaunchHandoff("a" * 64, window, "n" * 32)
                child_fd, window_child_fd = gate.take_child_fds()
                with self.assertRaises(handoff.Rejected):
                    handoff.child_prove(-1, window_child_fd, "a" * 64)
                gate.close_child_fds()
                with self.assertRaises(handoff.Rejected):
                    gate.challenge()
                gate.close()
            finally:
                os.close(window)

    def test_inherited_fd_with_wrong_receipt_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            window = os.open(Path(root) / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
            try:
                gate = handoff.OneLaunchHandoff("a" * 64, window, "n" * 32)
                child_fd, window_child_fd = gate.take_child_fds()
                script = ("import importlib.util,sys; "
                          "s=importlib.util.spec_from_file_location('handoff',sys.argv[1]); "
                          "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                          "m.child_prove(int(sys.argv[2]),int(sys.argv[3]),'b'*64)")
                child = subprocess.Popen([sys.executable, "-c", script,
                    str(HERE / "handoff.py"), str(child_fd), str(window_child_fd)],
                    pass_fds=(child_fd, window_child_fd), stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                gate.close_child_fds()
                with self.assertRaises(handoff.Rejected):
                    gate.challenge()
                self.assertNotEqual(child.wait(timeout=2), 0)
                child.stderr.close()
                gate.close()
            finally:
                os.close(window)

    def test_inherited_challenge_with_wrong_window_fd_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            window = os.open(Path(root) / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
            wrong = os.open(Path(root) / "other.lock", os.O_RDWR | os.O_CREAT, 0o600)
            try:
                gate = handoff.OneLaunchHandoff("a" * 64, window, "n" * 32)
                child_fd, _ = gate.take_child_fds()
                script = ("import importlib.util,sys; "
                          "s=importlib.util.spec_from_file_location('handoff',sys.argv[1]); "
                          "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                          "m.child_prove(int(sys.argv[2]),int(sys.argv[3]),'a'*64)")
                child = subprocess.Popen([sys.executable, "-c", script,
                    str(HERE / "handoff.py"), str(child_fd), str(wrong)],
                    pass_fds=(child_fd, wrong), stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                gate.close_child_fds()
                with self.assertRaises(handoff.Rejected):
                    gate.challenge()
                self.assertNotEqual(child.wait(timeout=2), 0)
                child.stderr.close()
                gate.close()
            finally:
                os.close(wrong)
                os.close(window)
