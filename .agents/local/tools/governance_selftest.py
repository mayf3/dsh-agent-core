#!/usr/bin/env python3
"""Hermetic behavior tests for the vendored governance mechanisms.

These tests exercise the vendored verifier and the local adoption-state checker
against synthetic copies in a temporary directory: the real repository files are
only read, never modified. No network, no platform services, stdlib only.

    python3 .agents/local/tools/governance_selftest.py
"""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VERIFY = REPO / ".agents" / "tools" / "verify_governance.py"
CHECKER = Path(__file__).resolve().parent / "check_adoption_state.py"


def run_verifier(target, extra=()):
    return subprocess.run([sys.executable, str(VERIFY), "--target", str(target), *extra],
                          capture_output=True, text=True)


def copy_agents(dest):
    shutil.copytree(REPO / ".agents", dest / ".agents",
                    ignore=shutil.ignore_patterns("__pycache__"))
    return dest


class VerifierBehavior(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="governance-selftest-")
        self.addCleanup(self.tmp.cleanup)
        self.target = copy_agents(Path(self.tmp.name))

    def test_real_repository_verifies_clean(self):
        result = run_verifier(REPO)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_copied_snapshot_verifies_clean(self):
        result = run_verifier(self.target)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_single_tampered_byte_is_detected(self):
        managed = json.loads((self.target / ".agents" / "governance.lock.json").read_text())["files"][0]["path"]
        payload = self.target / managed
        data = payload.read_bytes()
        payload.write_bytes(data + b"\n")  # one-byte drift
        result = run_verifier(self.target)
        self.assertNotEqual(0, result.returncode, "tampered snapshot must fail")
        self.assertIn("mismatch", (result.stdout + result.stderr).lower())

    def test_missing_managed_file_is_detected(self):
        managed = json.loads((self.target / ".agents" / "governance.lock.json").read_text())["files"][-1]["path"]
        (self.target / managed).unlink()
        result = run_verifier(self.target)
        self.assertNotEqual(0, result.returncode, "missing managed file must fail")

    def test_require_accepted_rejects_proposed_lock(self):
        status = json.loads((self.target / ".agents" / "governance.lock.json").read_text())["adoption"]["status"]
        result = run_verifier(self.target, ("--require-accepted",))
        if status == "proposed":
            self.assertNotEqual(0, result.returncode,
                                "--require-accepted must reject a proposed lock")
        else:
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_accepted_state_with_null_actor_is_rejected(self):
        lock_path = self.target / ".agents" / "governance.lock.json"
        lock = json.loads(lock_path.read_text())
        lock["adoption"]["status"] = "accepted"  # accepted claim without actor fields
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")
        result = run_verifier(self.target, ("--require-accepted",))
        self.assertNotEqual(0, result.returncode,
                            "accepted claim without accepted_by/at must fail")


class AdoptionStateChecker(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="adoption-state-selftest-")
        self.addCleanup(self.tmp.cleanup)
        self.target = copy_agents(Path(self.tmp.name))
        (self.target / "docs" / "specs").mkdir(parents=True, exist_ok=True)

    def write_spec(self, status):
        spec = self.target / "docs" / "specs" / "ADOPTION_SELFTEST_V1.md"
        spec.write_text("---\nspec_id: ADOPTION_SELFTEST_V1\nstatus: %s\n---\n# t\n" % status)
        return spec

    def run_checker(self, spec):
        return subprocess.run([sys.executable, str(CHECKER), "--target", str(self.target),
                               "--spec", str(spec)], capture_output=True, text=True)

    def test_proposed_lock_matches_proposed_spec(self):
        self.assertEqual(0, self.run_checker(self.write_spec("proposed")).returncode)

    def test_status_mismatch_is_refused(self):
        self.assertNotEqual(0, self.run_checker(self.write_spec("accepted")).returncode)

    def test_proposed_with_fabricated_acceptance_fields_is_refused(self):
        lock_path = self.target / ".agents" / "governance.lock.json"
        lock = json.loads(lock_path.read_text())
        lock["adoption"]["accepted_by"] = "someone"
        lock["adoption"]["accepted_at"] = "2026-01-01T00:00:00Z"
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")
        result = self.run_checker(self.write_spec("proposed"))
        self.assertNotEqual(0, result.returncode, "fabricated acceptance fields must fail")
        self.assertIn("null", result.stderr)

    def test_accepted_claim_requires_verifier_confirmation(self):
        lock_path = self.target / ".agents" / "governance.lock.json"
        lock = json.loads(lock_path.read_text())
        lock["adoption"]["status"] = "accepted"
        lock["adoption"]["accepted_by"] = "maintainer"
        lock["adoption"]["accepted_at"] = "2026-01-01T00:00:00Z"
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")
        result = self.run_checker(self.write_spec("accepted"))
        self.assertNotEqual(0, result.returncode,
                            "accepted claim must be confirmed by --require-accepted")


if __name__ == "__main__":
    unittest.main()
