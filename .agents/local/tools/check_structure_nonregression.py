#!/usr/bin/env python3
"""Structure non-regression comparison for verify-code-structure.mjs output.

Consumes two verifier JSON reports (frozen baseline ref vs current head) and
enforces exactly two properties, without raising limits or hiding legacy debt:

1. NO NEW VIOLATION: every (check, rule, path) violation at head must exist at
   the baseline too.
2. NO GROWTH: for a violation present on both sides, its measured size
   (directChildren for directory rules, physicalLines for file rules) must not
   exceed the baseline value.

All legacy debt is still printed, so the original verifier semantics stay
visible; exit 0 with existing debt is the honest steady state of this
repository today.

    python3 check_structure_nonregression.py BASE.json HEAD.json
"""

import json
import sys


def metric(finding):
    if finding.get("directChildren") is not None:
        return finding["directChildren"]
    if finding.get("physicalLines") is not None:
        return finding["physicalLines"]
    return None


def violations(report, label):
    try:
        data = json.load(open(report, encoding="utf-8"))
    except (OSError, ValueError) as exc:
        sys.stderr.write("%s report unreadable (%s); refusing to pass silently\n" % (label, exc))
        sys.exit(2)
    findings = data.get("findings")
    if findings is None:
        sys.stderr.write("%s report has no findings array; refusing to pass silently\n" % label)
        sys.exit(2)
    out = {}
    for f in findings:
        if f.get("severity") == "VIOLATION":
            out[(f.get("check"), f.get("rule"), f.get("path"))] = (f, metric(f))
    return out, data.get("summary", {})


def main():
    if len(sys.argv) != 3:
        sys.stderr.write(__doc__)
        return 2
    base, base_summary = violations(sys.argv[1], "baseline")
    head, head_summary = violations(sys.argv[2], "head")

    new = {k: v for k, v in head.items() if k not in base}
    grown = {k: (base[k][1], v[1]) for k, v in head.items()
             if k in base and v[1] is not None and base[k][1] is not None and v[1] > base[k][1]}

    print("structure baseline %s -> head %s" % (base_summary.get("head", "?"), head_summary.get("head", "?")))
    print("violations: baseline=%s head=%s (legacy debt listed below)" % (base_summary.get("violations"), head_summary.get("violations")))
    for (check, rule, path) in sorted(head):
        f = head[(check, rule, path)][0]
        print("  DEBT %s %s %s (baseline=%s head=%s)" % (rule, path, f.get("detail") or "", base.get((check, rule, path), (None, f.get("baselineValue")))[1], f.get("headValue")))

    if new:
        sys.stderr.write("STRUCTURE REGRESSION — new violations vs frozen baseline:\n")
        for (check, rule, path), (f, _) in sorted(new.items()):
            sys.stderr.write("  NEW %s %s %s\n" % (rule, path, f.get("detail") or ""))
        return 1
    if grown:
        sys.stderr.write("STRUCTURE REGRESSION — existing violations grew vs frozen baseline:\n")
        for (check, rule, path), (b, h) in sorted(grown.items()):
            sys.stderr.write("  GREW %s %s %s -> %s\n" % (rule, path, b, h))
        return 1
    print("NO NEW VIOLATIONS, NO GROWTH vs the frozen baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
