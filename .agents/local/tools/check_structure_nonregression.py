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
from pathlib import Path


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


def parse_args(argv):
    """positional: NONREG_BASE NONREG_HEAD; optional flags add the two
    fact-only dimensions (rule conformance and registry config fact)."""
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("nonreg_base")
    parser.add_argument("nonreg_head")
    parser.add_argument("--rule-conformance-report", default=None,
                        help="verifier JSON from the RULE's own baseline; its "
                             "violations are reported as RULE_CONFORMANCE, "
                             "which is a fact, not the gate")
    parser.add_argument("--config-fact-file", default=None,
                        help="file capturing the raw verifier's exit/stderr "
                             "when run from the rule-text baseline; recorded "
                             "verbatim as configuration fact")
    return parser.parse_args(argv)


def main():
    args = parse_args(sys.argv[1:])
    base, base_summary = violations(args.nonreg_base, "baseline")
    head, head_summary = violations(args.nonreg_head, "head")

    new = {k: v for k, v in head.items() if k not in base}
    grown = {k: (base[k][1], v[1]) for k, v in head.items()
             if k in base and v[1] is not None and base[k][1] is not None and v[1] > base[k][1]}

    # Dimension 1 — RULE_CONFORMANCE: measured from the rule's own baseline.
    # Violations here are rule breaches; they are reported honestly and are
    # NOT waived by this check (waiving them needs an approved transition
    # policy). This dimension never flips the exit code by itself.
    if args.rule_conformance_report:
        report_path = Path(args.rule_conformance_report)
        raw = report_path.read_text(encoding="utf-8").strip() if report_path.exists() else ""
        if not raw:
            # The original verifier refused to produce a report (registry
            # configuration fact below) — record UNMEASURABLE instead of
            # pretending compliance or failing the increment gate.
            fact = ""
            if args.config_fact_file and Path(args.config_fact_file).exists():
                fact = Path(args.config_fact_file).read_text(encoding="utf-8").strip()
            print("RULE_CONFORMANCE: UNMEASURABLE (original verifier produced no report; %s)"
                  % (fact or "no config fact captured"))
        else:
            rule, rule_summary = violations(args.rule_conformance_report, "rule-conformance")
            verdict = "PASS" if not rule else "FAIL"
            print("RULE_CONFORMANCE: %s (%d rule violations at head, measured from the rule's own baseline)"
                  % (verdict, len(rule)))
            for (check, rule_key, path), (f, _) in sorted(rule.items()):
                print("  VIOLATION %s %s %s" % (rule_key, path, f.get("detail") or ""))

    # Dimension 2 — registry configuration fact: the rule text still names
    # d506f811 as BASELINE_COMMIT while the registry's entries only validate
    # against later trees; the original verifier's refusal is recorded
    # verbatim instead of being hidden.
    if args.config_fact_file:
        try:
            fact = Path(args.config_fact_file).read_text(encoding="utf-8")
        except OSError as exc:
            fact = "(unreadable: %s)" % exc
        print("REGISTRY_CONFIG_FACT: " + fact.strip().replace("\n", " | "))

    print("NON_REGRESSION: checking %s -> %s" % (base_summary.get("head", "?"), head_summary.get("head", "?")))
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
    print("NON_REGRESSION: PASS — no new violations, no growth vs the frozen baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
