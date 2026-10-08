#!/usr/bin/env python3
"""Check that the adoption claim is internally consistent (deterministic).

Compares `.agents/governance.lock.json` adoption metadata against the adoption
Spec's declared lifecycle status and the vendored verifier's accepted-state
semantics. This is a consumer CI adapter for the central governance contract
("truthful adoption state"); it defines no new governance rule.

    python3 .agents/local/tools/check_adoption_state.py --spec docs/specs/<SPEC_ID>.md

Exit 0 = consistent; exit 1 = mismatch or unreadable input.
"""

import argparse
import json
import re
import subprocess
import sys

import yaml
from pathlib import Path

STATUS_RE = re.compile(r"^status:\s*([A-Za-z0-9_-]+)\s*$", re.MULTILINE)


def spec_status(path):
    text = Path(path).read_text(encoding="utf-8")
    parts = text.split("---")
    if len(parts) < 3:
        raise ValueError("no frontmatter block found")
    match = STATUS_RE.search(parts[1])
    if not match:
        raise ValueError("frontmatter has no top-level status field")
    return match.group(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", default=".", help="repository root")
    parser.add_argument("--spec", required=True, help="adoption Spec markdown path")
    parser.add_argument("--transition-records", default=None,
                        help="comma-separated governing-Spec markdown paths forming the "
                             "full authority chain; when given, the vendored raw transition "
                             "validator runs over their complete frontmatter and extra "
                             "bindings (reciprocal backlinks, reviewed-commit, index "
                             "agreement) are enforced — the validator alone does not "
                             "check those")
    parser.add_argument("--index", default=None,
                        help="Spec index markdown; checked against the transition "
                             "records' frontmatter statuses")
    args = parser.parse_args()

    root = Path(args.target)
    lock = json.loads((root / ".agents" / "governance.lock.json").read_text(encoding="utf-8"))
    adoption = lock.get("adoption") or {}
    status = adoption.get("status")
    declared = spec_status(root / args.spec)

    problems = []
    if status not in ("proposed", "accepted"):
        problems.append("lock adoption.status must be proposed or accepted, got %r" % (status,))
    elif declared != status:
        problems.append("Spec %s declares status %r but lock adoption.status is %r"
                        % (args.spec, declared, status))
    if status == "proposed":
        if adoption.get("accepted_by") is not None or adoption.get("accepted_at") is not None:
            problems.append("proposed adoption must keep accepted_by/accepted_at null")
    if status == "accepted":
        if not adoption.get("accepted_by") or not adoption.get("accepted_at"):
            problems.append("accepted adoption must record accepted_by and accepted_at")
        verifier = root / ".agents" / "tools" / "verify_governance.py"
        result = subprocess.run([sys.executable, str(verifier), "--target", str(root),
                                 "--require-accepted"], capture_output=True, text=True)
        if result.returncode != 0:
            problems.append("verify_governance --require-accepted failed on an accepted claim:\n%s"
                            % (result.stdout + result.stderr).strip())

    if args.transition_records:
        problems.extend(check_transition(
            root, [s.strip() for s in args.transition_records.split(",") if s.strip()],
            args.index))

    if problems:
        sys.stderr.write("adoption state INCONSISTENT:\n" + "".join("- %s\n" % p for p in problems))
        return 1
    print("adoption state consistent: %s (spec %s)" % (status, args.spec))
    return 0


HEX40_RE = re.compile(r"^[0-9a-f]{40}$")


def frontmatter_meta(path):
    parts = Path(path).read_text(encoding="utf-8").split("---")
    if len(parts) < 3:
        raise ValueError("no frontmatter block: %s" % path)
    return yaml.safe_load(parts[1])


def check_transition(root, record_paths, index_path):
    """Whole-authority checks beyond the single-spec/lock agreement.

    1. The vendored raw transition validator judges the complete frontmatter
       set as one lifecycle (a later V2-to-accepted flip, a removed backlink
       or any other topology break fails here).
    2. Adapter bindings the validator does not know about: exactly one
       accepted adoption record, that record keeps its reviewed-commit and
       verdict bindings, and the Spec index agrees with the frontmatter.
    Historical sparse records (e.g. RKGV1/V0 without modern fields) are
    passed through unmodified — the checker never demands retrofit fields.
    """
    import tempfile

    problems = []
    metas = []
    try:
        for rel in record_paths:
            metas.append(frontmatter_meta(root / rel))
    except Exception as exc:  # unreadable/absent record is a hard failure
        return ["transition record unreadable: %s" % exc]

    validator = root / ".agents" / "tools" / "validate_spec_transition.py"
    with tempfile.TemporaryDirectory(prefix="adoption-transition-") as td:
        state = Path(td) / "current.json"
        state.write_text(json.dumps(metas, ensure_ascii=False, default=str))
        result = subprocess.run([sys.executable, str(validator),
                                 "--base", str(state), "--candidate", str(state)],
                                capture_output=True, text=True)
        if result.returncode != 0:
            problems.append("raw five-record transition validation failed:\n%s%s"
                            % (result.stdout.strip(), result.stderr.strip()))

    accepted = [m for m in metas if m.get("status") == "accepted"]
    if len(accepted) > 1:
        problems.append("the authority chain must settle at exactly one accepted "
                        "record, found %d (%s)" % (len(accepted),
                        [m.get("spec_id") for m in accepted]))
    # A still-proposed pilot legitimately has zero accepted records; the
    # single-accepted requirement binds only once the claim is accepted
    # (status comes from the lock/spec agreement checked above).
    for m in accepted:
        commit = m.get("accepted_reviewed_spec_commit") or ""
        if not HEX40_RE.match(str(commit)):
            problems.append("accepted record %s has no 40-hex "
                            "accepted_reviewed_spec_commit binding" % m.get("spec_id"))
        if not str(m.get("acceptance_review_verdict") or "").strip():
            problems.append("accepted record %s has no acceptance_review_verdict" % m.get("spec_id"))

    if index_path:
        try:
            index_text = (root / index_path).read_text(encoding="utf-8")
        except OSError as exc:
            problems.append("Spec index unreadable: %s" % exc)
            index_text = ""
        for rel, m in zip(record_paths, metas):
            spec_id = m.get("spec_id")
            row = next((ln for ln in index_text.split("\n")
                        if ln.startswith("| `%s`" % spec_id)), None)
            if row is None:
                problems.append("index is missing the row for %s" % spec_id)
                continue
            expected = m.get("status")
            if expected == "accepted" and "accepted" not in row:
                problems.append("index row for %s does not reflect accepted" % spec_id)
            if expected == "superseded" and "superseded" not in row:
                problems.append("index row for %s does not reflect superseded" % spec_id)
            if expected == "proposed" and ("accepted / current" in row or "superseded" in row):
                problems.append("index row for %s does not reflect proposed" % spec_id)
            backlink = m.get("superseded_by")
            if expected == "superseded" and backlink:
                # Index rows are history-formatted (some legacy rows use a
                # dash or an abbreviated name); only a contradicting successor
                # name is a finding, a missing one is not.
                if str(backlink) not in row and "AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION" in row:
                    problems.append("index row for %s names a successor other than %s"
                                    % (spec_id, backlink))
    return problems



if __name__ == "__main__":
    sys.exit(main())
