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

    if problems:
        sys.stderr.write("adoption state INCONSISTENT:\n" + "".join("- %s\n" % p for p in problems))
        return 1
    print("adoption state consistent: %s (spec %s)" % (status, args.spec))
    return 0


if __name__ == "__main__":
    sys.exit(main())
