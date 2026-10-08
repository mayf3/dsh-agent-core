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


class AdoptionTransitionIntegrity(unittest.TestCase):
    """PR#497 review P1: the checker must catch whole-authority breakage, not
    just V3/lock status agreement. Four destructive mutations must each be
    caught; both proposed-pilot and accepted fixtures must stay green."""

    FIVE_RECORDS = {
        "AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1":
            "spec_id: AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1\nstatus: superseded\nsuperseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0\ngoverned_by: []\n",
        "AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0":
            "spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0\nstatus: superseded\nsuperseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1\nsupersedes:\n  - AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1\ngoverned_by: []\n",
        "AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1":
            "spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1\nstatus: superseded\nsuperseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2\nsupersedes:\n  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0\ngoverned_by: []\n",
        "AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2":
            "spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2\nstatus: superseded\nsuperseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3\nsupersedes:\n  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1\ngoverned_by: []\n",
        "AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3":
            "spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3\nstatus: accepted\nsupersedes:\n  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2\ngoverned_by: []\naccepted_date: 2026-10-08\naccepted_by: mayf3\naccepted_at: 2026-10-08T12:34:53Z\naccepted_reviewed_spec_commit: fd5881bb6f93c50f19578fefa24a64f3fdbcdf07\nacceptance_review_verdict: PASS\n",
    }
    INDEX_ROWS = (
        "| `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` | accepted / current governance | invariant | repo | `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2` |\n"
        "| `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2` | superseded (by `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3`) | invariant | repo | `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` |\n"
        "| `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` | superseded (by `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2`) | invariant | repo | `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` |\n"
        "| `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` | superseded (by `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1`) | invariant | repo | `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` |\n"
        "| `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` | superseded | legacy governance | repo | \u2014 |\n"
    )

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="adoption-transition-selftest-")
        self.addCleanup(self.tmp.cleanup)
        self.target = copy_agents(Path(self.tmp.name))
        specs = self.target / "docs" / "specs"
        specs.mkdir(parents=True, exist_ok=True)
        for name, fm in self.FIVE_RECORDS.items():
            (specs / (name + ".md")).write_text("---\n" + fm + "---\n# t\n")
        (specs / "README.md").write_text(
            "# Governing Specs\n\n| Spec ID | Status | Kind | Scope | Supersedes |\n|---|---|---|---|---|\n"
            + self.INDEX_ROWS)

    def set_lock(self, status, accepted_by=None, accepted_at=None):
        lock_path = self.target / ".agents" / "governance.lock.json"
        lock = json.loads(lock_path.read_text())
        lock["adoption"] = {"mode": "vendored", "status": status,
                            "prepared_by": "fixture-preparer",
                            "prepared_at": "2026-09-29T03:16:20.214729Z",
                            "accepted_by": accepted_by, "accepted_at": accepted_at}
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")

    def run_checker(self):
        return subprocess.run(
            [sys.executable, str(CHECKER), "--target", str(self.target),
             "--spec", "docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md",
             "--transition-records",
             ",".join("docs/specs/" + n + ".md" for n in self.FIVE_RECORDS),
             "--index", "docs/specs/README.md"],
            capture_output=True, text=True)

    def edit(self, name, old, new):
        p = self.target / "docs" / "specs" / name
        t = p.read_text()
        assert old in t, (name, old)
        p.write_text(t.replace(old, new, 1))

    def test_intact_accepted_fixture_passes(self):
        # The fixture lock is set explicitly so the test does not depend on
        # which consumer repository's checkout it runs from.
        self.set_lock("accepted", accepted_by="mayf3", accepted_at="2026-10-08T12:34:53Z")
        result = self.run_checker()
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_v2_restored_to_accepted_is_caught(self):
        self.edit("AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2.md",
                  "status: superseded", "status: accepted")
        self.assertNotEqual(0, self.run_checker().returncode,
                            "two accepted adoption authorities must be refused")

    def test_removed_v2_backlink_is_caught(self):
        self.edit("AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2.md",
                  "superseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3",
                  "superseded_by: null")
        self.assertNotEqual(0, self.run_checker().returncode,
                            "a superseded record without its reciprocal backlink must be refused")

    def test_erased_reviewed_commit_is_caught(self):
        self.edit("AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md",
                  "accepted_reviewed_spec_commit: fd5881bb6f93c50f19578fefa24a64f3fdbcdf07\n", "")
        self.assertNotEqual(0, self.run_checker().returncode,
                            "an accepted adoption without its reviewed-commit binding must be refused")

    def test_reverted_index_is_caught(self):
        idx = self.target / "docs" / "specs" / "README.md"
        t = idx.read_text()
        t = t.replace("`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` | accepted / current governance",
                      "`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` | proposed / draft pilot")
        t = t.replace("`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2` | superseded (by V3)",
                      "`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2` | accepted / current governance")
        idx.write_text(t)
        self.assertNotEqual(0, self.run_checker().returncode,
                            "an index contradicting the frontmatter must be refused")

    def test_proposed_pilot_without_review_fields_still_passes(self):
        # A proposed pilot (the agent-control shape: a single-record adoption
        # with a proposed lock) has no reviewed-commit/verdict yet; requiring
        # them there would fabricate history. Historical sparse records are
        # never modernized by the checker.
        self.set_lock("proposed")
        self.edit("AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md",
                  "status: accepted", "status: proposed")
        self.edit("AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md",
                  "supersedes:\n  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2\n",
                  "supersedes: []\n")
        for field in ("accepted_date: 2026-10-08\n", "accepted_by: mayf3\n",
                      "accepted_at: 2026-10-08T12:34:53Z\n",
                      "accepted_reviewed_spec_commit: fd5881bb6f93c50f19578fefa24a64f3fdbcdf07\n",
                      "acceptance_review_verdict: PASS\n"):
            self.edit("AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md", field, "")
        idx = self.target / "docs" / "specs" / "README.md"
        t = idx.read_text()
        t = t.replace("`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` | accepted / current governance",
                      "`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` | proposed / draft pilot")
        idx.write_text(t)
        result = subprocess.run(
            [sys.executable, str(CHECKER), "--target", str(self.target),
             "--spec", "docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md",
             "--transition-records", "docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md"],
            capture_output=True, text=True)
        self.assertEqual(0, result.returncode,
                         "a proposed pilot with no review fields must stay valid: "
                         + result.stdout + result.stderr)


class StructureNonRegressionComparator(unittest.TestCase):
    """PR#497 review P1: rule conformance and increment checking are separate
    dimensions — a head carrying rule violations (scripts 64 > cap 40) must
    never be reported as conformance-compliant, and growth detection stays."""

    def write_reports(self, tmp, violations_head, violations_base=None):
        def report(viol):
            return {"summary": {"violations": len(viol), "head": "x"},
                    "findings": [{"check": "DIRECTORY_CHILD_LIMIT", "severity": "VIOLATION",
                                  "rule": r, "path": p, "directChildren": n,
                                  "baselineValue": b, "headValue": n}
                                 for (r, p, n, b) in viol]}
        base = report(violations_base if violations_base is not None else violations_head)
        head = report(violations_head)
        bp, hp = tmp / "base.json", tmp / "head.json"
        bp.write_text(json.dumps(base))
        hp.write_text(json.dumps(head))
        return str(bp), str(hp)

    def run_comparator(self, tmp, base_report, head_report, extra=()):
        comparator = REPO / ".agents" / "local" / "tools" / "check_structure_nonregression.py"
        return subprocess.run([sys.executable, str(comparator), base_report, head_report, *extra],
                              capture_output=True, text=True)

    def test_rule_violations_are_reported_as_conformance_fail(self):
        tmp = Path(tempfile.mkdtemp(prefix="struct-selftest-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        viol = [("DIRECTORY_OVER_CEILING", "scripts", 64, 40),
                ("UNREGISTERED_LEGACY_DIRECTORY", "scripts/lib", 26, 26)]
        b, h = self.write_reports(tmp, viol)
        result = self.run_comparator(tmp, b, h,
                                     extra=["--rule-conformance-report", h])
        combined = result.stdout + result.stderr
        self.assertIn("RULE_CONFORMANCE", combined)
        self.assertIn("FAIL", combined)
        self.assertIn("scripts", combined)
        self.assertNotIn("RULE_CONFORMANCE: PASS", combined)

    def test_growth_of_existing_violation_still_fails(self):
        tmp = Path(tempfile.mkdtemp(prefix="struct-selftest-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        base_v = [("UNREGISTERED_LEGACY_DIRECTORY", "scripts/lib", 26, 26)]
        head_v = [("UNREGISTERED_LEGACY_DIRECTORY", "scripts/lib", 27, 27)]
        b, h = self.write_reports(tmp, head_v, base_v)
        result = self.run_comparator(tmp, b, h)
        self.assertNotEqual(0, result.returncode, "26 -> 27 growth must fail")
        self.assertIn("GREW", result.stdout + result.stderr)

    def test_new_violation_still_fails(self):
        tmp = Path(tempfile.mkdtemp(prefix="struct-selftest-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        base_v = [("DIRECTORY_OVER_CEILING", "scripts", 64, 40)]
        head_v = base_v + [("DIRECTORY_CHILD_LIMIT", "some/new/dir", 25, 25)]
        b, h = self.write_reports(tmp, head_v, base_v)
        result = self.run_comparator(tmp, b, h)
        self.assertNotEqual(0, result.returncode, "a new violation must fail")
        self.assertIn("NEW", result.stdout + result.stderr)

    def test_unmeasurable_rule_report_is_recorded_as_fact_not_hidden(self):
        tmp = Path(tempfile.mkdtemp(prefix="struct-selftest-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        viol = [("DIRECTORY_OVER_CEILING", "scripts", 64, 40)]
        b, h = self.write_reports(tmp, viol)
        empty = tmp / "empty.json"
        empty.write_text("")
        fact = tmp / "fact.txt"
        fact.write_text("registry file entry is not a baseline >500-line file: packages/broker/src/capabilities/workflow.js | exit=2")
        result = self.run_comparator(tmp, b, h,
                                     extra=["--rule-conformance-report", str(empty),
                                            "--config-fact-file", str(fact)])
        combined = result.stdout + result.stderr
        self.assertEqual(0, result.returncode, combined)
        self.assertIn("RULE_CONFORMANCE: UNMEASURABLE", combined)
        self.assertIn("exit=2", combined)
        self.assertIn("NON_REGRESSION: PASS", combined)

    def test_output_states_both_dimensions(self):
        tmp = Path(tempfile.mkdtemp(prefix="struct-selftest-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        viol = [("DIRECTORY_OVER_CEILING", "scripts", 64, 40)]
        b, h = self.write_reports(tmp, viol)
        result = self.run_comparator(tmp, b, h,
                                     extra=["--rule-conformance-report", h])
        combined = result.stdout + result.stderr
        self.assertIn("NON_REGRESSION", combined)
        self.assertIn("RULE_CONFORMANCE", combined)


if __name__ == "__main__":
    unittest.main()

    unittest.main()
