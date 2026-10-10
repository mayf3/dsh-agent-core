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
    parser.add_argument("--transition-base-ref", default=None,
                        help="git ref holding the BEFORE state of the transition "
                             "records (e.g. the pre-acceptance commit). When given, "
                             "before-frontmatter is extracted via 'git show "
                             "<ref>:<path>' and the vendored validator judges the "
                             "real before→after transition; without it only the "
                             "current topology is judged, which is NOT a "
                             "transition check")
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
            args.index, args.transition_base_ref))

    if problems:
        sys.stderr.write("adoption state INCONSISTENT:\n" + "".join("- %s\n" % p for p in problems))
        return 1
    print("adoption state consistent: %s (spec %s)" % (status, args.spec))
    return 0


HEX40_RE = re.compile(r"^[0-9a-f]{40}$")


def frontmatter_text(text):
    parts = text.split("---")
    if len(parts) < 3:
        raise ValueError("no frontmatter block in provided text")
    return yaml.safe_load(parts[1])


def frontmatter_meta(path):
    return frontmatter_text(Path(path).read_text(encoding="utf-8"))


def git_show(root, ref, rel):
    result = subprocess.run(["git", "-C", str(root), "show", "%s:%s" % (ref, rel)],
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise ValueError("git show %s:%s failed: %s" % (ref, rel, result.stderr.strip()))
    return result.stdout


def check_transition(root, record_paths, index_path, base_ref=None):
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
        after = Path(td) / "after.json"
        after.write_text(json.dumps(metas, ensure_ascii=False, default=str))
        if base_ref:
            before_metas = []
            try:
                for rel in record_paths:
                    before_metas.append(frontmatter_text(git_show(root, base_ref, rel)))
            except Exception as exc:
                return ["transition before-state extraction failed: %s" % exc]
            before = Path(td) / "before.json"
            before.write_text(json.dumps(before_metas, ensure_ascii=False, default=str))
            result = subprocess.run([sys.executable, str(validator),
                                     "--base", str(before), "--candidate", str(after)],
                                    capture_output=True, text=True)
            label = "raw transition validation (%s -> working tree)" % base_ref
        else:
            result = subprocess.run([sys.executable, str(validator),
                                     "--base", str(after), "--candidate", str(after)],
                                    capture_output=True, text=True)
            label = "raw transition validation (current topology only; no base ref given)"
        if result.returncode != 0:
            problems.append("%s failed:\n%s%s" % (label, result.stdout.strip(), result.stderr.strip()))

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
            # Parse the STATUS CELL (second column), not the whole row: a row
            # like `superseded (was accepted)` contains the substring
            # "accepted" and must not satisfy an accepted record.
            cells = [c.strip() for c in row.split("|")]
            status_cell = cells[2] if len(cells) > 2 else ""
            cell_status = status_cell.split()[0] if status_cell.split() else ""
            if expected != cell_status:
                problems.append("index row for %s states %r but frontmatter status is %r"
                                % (spec_id, status_cell, expected))
                continue
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
