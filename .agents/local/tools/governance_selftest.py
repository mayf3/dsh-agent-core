#!/usr/bin/env python3
"""Hermetic behavior tests for the vendored governance mechanisms.

These tests exercise the vendored verifier and the local adoption-state checker
against synthetic copies in a temporary directory: the real repository files are
only read, never modified. Every fixture's adoption state is constructed
explicitly (proposed and accepted both covered), so the tests stay valid across
the repository's real lifecycle — before and after a legitimate acceptance —
and never depend on the live lock's current status. No network, no platform
services, stdlib only.

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

PROPOSED = {"status": "proposed", "accepted_by": None, "accepted_at": None}
ACCEPTED = {"status": "accepted", "accepted_by": "fixture-maintainer",
            "accepted_at": "2026-01-02T00:00:00Z"}


def run_verifier(target, extra=()):
    return subprocess.run([sys.executable, str(VERIFY), "--target", str(target), *extra],
                          capture_output=True, text=True)


def copy_agents(dest):
    shutil.copytree(REPO / ".agents", dest / ".agents",
                    ignore=shutil.ignore_patterns("__pycache__"))
    return dest


def write_lock_state(target, *, status, accepted_by, accepted_at):
    """Explicitly construct a fixture adoption state on the copied lock.

    The 25 managed files stay byte-identical to the lock's manifest; only the
    adoption metadata is rewritten, so verdicts test the state machine, not
    whatever state the live checkout happens to be in today.
    """
    lock_path = target / ".agents" / "governance.lock.json"
    lock = json.loads(lock_path.read_text())
    lock["adoption"] = {"mode": "vendored", "status": status,
                        "prepared_by": "fixture-preparer",
                        "prepared_at": "2026-01-01T00:00:00Z",
                        "accepted_by": accepted_by, "accepted_at": accepted_at}
    lock_path.write_text(json.dumps(lock, indent=2) + "\n")
    return lock_path


class VerifierBehavior(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="governance-selftest-")
        self.addCleanup(self.tmp.cleanup)
        self.target = copy_agents(Path(self.tmp.name))

    def propose(self):
        return write_lock_state(self.target, **PROPOSED)

    def accept(self):
        return write_lock_state(self.target, **ACCEPTED)

    def test_real_repository_verifies_clean(self):
        # Lifecycle-independent: proposed and accepted are both valid states
        # for a plain (no --require-accepted) verification of the real repo.
        result = run_verifier(REPO)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_explicit_proposed_fixture_verifies_clean(self):
        self.propose()
        result = run_verifier(self.target)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_explicit_accepted_fixture_verifies_clean_with_require_accepted(self):
        self.accept()
        result = run_verifier(self.target)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        result = run_verifier(self.target, ("--require-accepted",))
        self.assertEqual(0, result.returncode,
                         "a well-formed accepted fixture must pass --require-accepted: "
                         + result.stdout + result.stderr)

    def test_require_accepted_rejects_proposed_fixture(self):
        self.propose()
        result = run_verifier(self.target, ("--require-accepted",))
        self.assertNotEqual(0, result.returncode,
                            "--require-accepted must reject a proposed lock")

    def test_single_tampered_byte_is_detected(self):
        self.propose()
        managed = json.loads((self.target / ".agents" / "governance.lock.json").read_text())["files"][0]["path"]
        payload = self.target / managed
        payload.write_bytes(payload.read_bytes() + b"\n")  # one-byte drift
        result = run_verifier(self.target)
        self.assertNotEqual(0, result.returncode, "tampered snapshot must fail")
        self.assertIn("mismatch", (result.stdout + result.stderr).lower())

    def test_missing_managed_file_is_detected(self):
        self.propose()
        managed = json.loads((self.target / ".agents" / "governance.lock.json").read_text())["files"][-1]["path"]
        (self.target / managed).unlink()
        result = run_verifier(self.target)
        self.assertNotEqual(0, result.returncode, "missing managed file must fail")

    def test_accepted_claim_with_null_actor_is_rejected(self):
        # Accepted status without actor fields — constructed from scratch so a
        # legitimately accepted live lock cannot mask the missing fields.
        self.propose()
        lock_path = self.target / ".agents" / "governance.lock.json"
        lock = json.loads(lock_path.read_text())
        lock["adoption"]["status"] = "accepted"  # actor fields stay null
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")
        result = run_verifier(self.target, ("--require-accepted",))
        self.assertNotEqual(0, result.returncode,
                            "accepted claim without accepted_by/at must fail")

    def test_accepted_before_prepared_at_is_rejected(self):
        write_lock_state(self.target, status="accepted",
                         accepted_by="fixture-maintainer",
                         accepted_at="2025-12-31T00:00:00Z")  # precedes prepared_at
        result = run_verifier(self.target, ("--require-accepted",))
        self.assertNotEqual(0, result.returncode,
                            "accepted_at earlier than prepared_at must fail")


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

    def test_consistent_states_pass_in_both_starting_states(self):
        # proposed lock + proposed spec, then accepted lock + accepted spec:
        # the checker must stay green across the real lifecycle, and the
        # accepted leg is confirmed end-to-end by --require-accepted inside
        # the checker.
        self.write_lock(PROPOSED)
        self.assertEqual(0, self.run_checker(self.write_spec("proposed")).returncode)
        self.write_lock(ACCEPTED)
        result = self.run_checker(self.write_spec("accepted"))
        self.assertEqual(0, result.returncode,
                         "consistent accepted state must pass: " + result.stderr)

    def write_lock(self, fields):
        return write_lock_state(self.target, **fields)

    def test_status_mismatch_is_refused_in_both_directions(self):
        self.write_lock(PROPOSED)
        self.assertNotEqual(0, self.run_checker(self.write_spec("accepted")).returncode)
        self.write_lock(ACCEPTED)
        self.assertNotEqual(0, self.run_checker(self.write_spec("proposed")).returncode)

    def test_proposed_with_fabricated_acceptance_fields_is_refused(self):
        self.write_lock(PROPOSED)
        lock_path = self.target / ".agents" / "governance.lock.json"
        lock = json.loads(lock_path.read_text())
        lock["adoption"]["accepted_by"] = "someone"
        lock["adoption"]["accepted_at"] = "2026-01-01T00:00:00Z"
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")
        result = self.run_checker(self.write_spec("proposed"))
        self.assertNotEqual(0, result.returncode, "fabricated acceptance fields must fail")
        self.assertIn("null", result.stderr)

    def test_accepted_claim_requires_verifier_confirmation(self):
        # An accepted claim whose managed bytes no longer match the lock must
        # be refused: the checker re-runs --require-accepted under the hood.
        self.write_lock(ACCEPTED)
        self.assertEqual(0, self.run_checker(self.write_spec("accepted")).returncode)
        managed = json.loads((self.target / ".agents" / "governance.lock.json").read_text())["files"][0]["path"]
        payload = self.target / managed
        payload.write_bytes(payload.read_bytes() + b"\n")
        result = self.run_checker(self.write_spec("accepted"))
        self.assertNotEqual(0, result.returncode,
                            "accepted claim failing --require-confirmed bytes must be refused")


if __name__ == "__main__":
    unittest.main()
