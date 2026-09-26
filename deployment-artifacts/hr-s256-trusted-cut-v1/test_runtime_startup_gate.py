"""Synthetic startup tests: no Router import before the root-held R2 challenge."""

import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SPEC = importlib.util.spec_from_file_location("r2_handoff", HERE / "handoff.py")
handoff = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(handoff)


class RuntimeStartupGateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "packages" / "production-runtime" / "src" / "native-arm64").mkdir(parents=True)
        (self.root / "package.json").write_text('{"type":"module"}')
        source_entry = REPO / "packages" / "production-runtime" / "src" / "native-arm64" / "hr-s256-r2-gated-runtime.mjs"
        if source_entry.exists():
            shutil.copyfile(source_entry,
                            self.root / "packages" / "production-runtime" / "src" /
                            "native-arm64" / "hr-s256-r2-gated-runtime.mjs")
        source_helper = REPO / "packages" / "production-runtime" / "src" / "native-arm64" / "hr-s256-r2-child-proof.py"
        if source_helper.exists():
            shutil.copyfile(source_helper,
                            self.root / "packages" / "production-runtime" / "src" /
                            "native-arm64" / "hr-s256-r2-child-proof.py")
        (self.root / "packages" / "production-runtime" / "src" / "native-arm64" /
         "admission.js").write_text("export function assertProductionArchitecture() {}\n")
        (self.root / "packages" / "production-runtime" / "src" / "entry.js").write_text(
            "import {writeFileSync} from 'node:fs';\n"
            "export async function runProductionRuntime() {\n"
            "  writeFileSync(process.env.R2_TEST_MARKER_PATH, 'router-imported');\n"
            "}\n")
        self.marker = self.root / "router-started"
        self.receipt = "a" * 64
        self.nonce = "n" * 32
        self.node = shutil.which("node")
        self.assertIsNotNone(self.node)

    def run_surrogate_child(self, challenge_fd, window_fd):
        script = ("import importlib.util,os,sys; "
                  "s=importlib.util.spec_from_file_location('client',sys.argv[1]); "
                  "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                  "m.prove(int(sys.argv[2]),int(sys.argv[3]),sys.argv[4],"
                  "trusted_uid=os.geteuid())")
        return subprocess.Popen([sys.executable, "-c", script,
            str(REPO / "packages" / "production-runtime" / "src" /
                "native-arm64" / "hr-s256-r2-child-proof.py"),
            str(challenge_fd), str(window_fd), self.receipt],
            pass_fds=(challenge_fd, window_fd), stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    def add_child_cleanup(self, child):
        def cleanup():
            if child.poll() is None:
                child.kill()
                child.wait(timeout=2)
            child.stdout.close() if child.stdout else None
            child.stderr.close() if child.stderr else None
        self.addCleanup(cleanup)

    def run_entry(self, *, challenge_fd=None, window_fd=None, env_overrides=None):
        args = [self.node, str(self.root / "packages" / "production-runtime" / "src" /
                "native-arm64" / "hr-s256-r2-gated-runtime.mjs"),
                "--hr-r2-receipt-sha256", self.receipt]
        passed = []
        if challenge_fd is not None:
            args.extend(["--hr-r2-challenge-fd", str(challenge_fd)])
            passed.append(challenge_fd)
        if window_fd is not None:
            args.extend(["--hr-r2-window-fd", str(window_fd)])
            passed.append(window_fd)
        return subprocess.Popen(args, pass_fds=tuple(passed),
                                env={**os.environ, "R2_TEST_MARKER_PATH": str(self.marker),
                                     **(env_overrides or {})},
                                cwd=self.root, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def test_direct_manual_entry_without_inherited_descriptors_never_imports_router(self):
        child = self.run_entry()
        self.add_child_cleanup(child)
        self.assertEqual(child.wait(timeout=3), 2)
        self.assertFalse(self.marker.exists())

    def test_matching_one_use_window_proves_only_with_surrogate_root_approval(self):
        window = os.open(self.root / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
        gate = handoff.OneLaunchHandoff(self.receipt, window, self.nonce)
        try:
            challenge_fd, window_fd = gate.take_child_fds()
            child = self.run_surrogate_child(challenge_fd, window_fd)
            self.add_child_cleanup(child)
            gate.close_child_fds()
            gate.challenge()
            self.assertEqual(child.wait(timeout=3), 0)
        finally:
            gate.close()
            os.close(window)

    def test_separately_opened_same_window_inode_gets_no_parent_approval(self):
        path = self.root / "window.lock"
        window = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
        separate = os.open(path, os.O_RDWR)
        gate = handoff.OneLaunchHandoff(self.receipt, window, self.nonce)
        try:
            challenge_fd, _ = gate.take_child_fds()
            child = self.run_surrogate_child(challenge_fd, separate)
            self.add_child_cleanup(child)
            gate.close_child_fds()
            with self.assertRaises(handoff.Rejected):
                gate.challenge()
            self.assertNotEqual(child.wait(timeout=3), 0)
        finally:
            gate.close()
            os.close(separate)
            os.close(window)

    def test_stale_one_use_challenge_gets_no_parent_approval(self):
        window = os.open(self.root / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
        gate = handoff.OneLaunchHandoff(self.receipt, window, self.nonce)
        try:
            challenge_fd, window_fd = gate.take_child_fds()
            time.sleep(handoff.CHALLENGE_TIMEOUT + 0.1)
            child = self.run_surrogate_child(challenge_fd, window_fd)
            self.add_child_cleanup(child)
            gate.close_child_fds()
            with self.assertRaises(handoff.Rejected):
                gate.challenge()
            gate.root.close()
            self.assertNotEqual(child.wait(timeout=3), 0)
        finally:
            gate.close()
            os.close(window)

    def test_same_uid_forged_socket_window_cannot_open_actual_runtime_entry(self):
        self.assertNotEqual(os.geteuid(), 0)
        window = os.open(self.root / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
        gate = handoff.OneLaunchHandoff(self.receipt, window, self.nonce)
        try:
            challenge_fd, window_fd = gate.take_child_fds()
            child = self.run_entry(challenge_fd=challenge_fd, window_fd=window_fd)
            self.add_child_cleanup(child)
            gate.close_child_fds()
            with self.assertRaises(handoff.Rejected):
                gate.challenge()
            self.assertEqual(child.wait(timeout=3), 2)
            self.assertFalse(self.marker.exists())
        finally:
            gate.close()
            os.close(window)

    def test_client_cli_rejects_same_uid_forged_root_peer(self):
        self.assertNotEqual(os.geteuid(), 0)
        window = os.open(self.root / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
        gate = handoff.OneLaunchHandoff(self.receipt, window, self.nonce)
        try:
            challenge_fd, window_fd = gate.take_child_fds()
            helper = (REPO / "packages" / "production-runtime" / "src" /
                      "native-arm64" / "hr-s256-r2-child-proof.py")
            child = subprocess.Popen([sys.executable, str(helper), "--child-prove",
                str(challenge_fd), str(window_fd), self.receipt],
                pass_fds=(challenge_fd, window_fd), stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            self.add_child_cleanup(child)
            gate.close_child_fds()
            self.assertEqual(child.wait(timeout=2), 2)
            self.assertIn(b"ROOT_PEER_MISMATCH", child.stderr.read())
        finally:
            gate.close()
            os.close(window)

    def test_inherited_python_path_cannot_execute_before_root_gate(self):
        poison = self.root / "poison"
        poison.mkdir()
        marker = self.root / "python-sitecustomize-ran"
        (poison / "sitecustomize.py").write_text(
            "from pathlib import Path\n"
            f"Path({str(marker)!r}).write_text('executed')\n")
        window = os.open(self.root / "window.lock", os.O_RDWR | os.O_CREAT, 0o600)
        gate = handoff.OneLaunchHandoff(self.receipt, window, self.nonce)
        try:
            challenge_fd, window_fd = gate.take_child_fds()
            child = self.run_entry(challenge_fd=challenge_fd, window_fd=window_fd,
                                   env_overrides={"PYTHONPATH": str(poison)})
            self.add_child_cleanup(child)
            gate.close_child_fds()
            self.assertEqual(child.wait(timeout=3), 2)
            self.assertFalse(marker.exists())
            self.assertFalse(self.marker.exists())
        finally:
            gate.close()
            os.close(window)


if __name__ == "__main__":
    unittest.main()
