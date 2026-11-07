#!/usr/bin/env python3
"""Read-only native Phase2 lifecycle gate; no product/verifier adaptation.

The unchanged proposal C gate is separate evidence at REVIEWED. This gate reads
actual native records; it never invents governing-Spec frontmatter for V2.
"""

import argparse
import copy
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import validate_v3_succession as c

REVIEWED = "7f36750bf08d308cd7f648153e24c0b0e528e4c6"
READOPT = "b8333ef43d3e3433d5276cb8af49be7c949a18c8"
RULING = "owner-20261107-642-643-1377"
COMMENT = "https://github.com/mayf3/dsh-agent-core/pull/642#issuecomment-6701500077"
SELF = "scripts/governance/validate_v3_phase2.py"
LOCK = ".agents/governance.lock.json"
ADOPTION = "docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md"
LOCAL = ".agents/local/README.md"
INDEX = "docs/specs/README.md"
PATHS = [c.V2, c.TE, c.V3, LOCK, ADOPTION, LOCAL, INDEX]
ACCEPTANCE_FIELDS = {
    "accepted_by": "mayf3", "accepted_date": "2026-11-07",
    "accepted_reviewed_semantic_head": REVIEWED,
    "acceptance_authority": COMMENT, "acceptance_ruling_id": RULING,
    "acceptance_final_head_review": "PENDING_REGULATOR",
}


def remove_record(body, name):
    start = "<!-- BEGIN PHASE2_" + name + " -->\n"
    end = "<!-- END PHASE2_" + name + " -->\n"
    if body.count(start) != 1 or body.count(end) != 1:
        raise ValueError("missing/duplicate Phase2 record: " + name)
    before, rest = body.split(start, 1)
    record, after = rest.split(end, 1)
    return before + after, record


def inspect(state, originals):
    errors = []

    def need(ok, message):
        if not ok:
            errors.append(message)

    try:
        for path in PATHS:
            need(path in state, "missing actual authority: " + path)
        if errors:
            return errors
        v2, _ = c.native(state[c.V2])
        te, _ = c.front(state[c.TE])
        v3, body = c.front(state[c.V3])
        old_v3, old_body = c.front(originals[c.V3])
        expected_v2 = originals[c.V2].replace(b"LIFECYCLE = ACCEPTED", b"LIFECYCLE = SUPERSEDED", 1).replace(
            b"\n```\n", b"\nSUPERSEDED_BY = CODE_STRUCTURE_GUARDRAILS_V3\n```\n", 1)
        expected_te = originals[c.TE].replace(b"status: accepted", b"status: superseded", 1).replace(
            b"superseded_by: null", b"superseded_by: CODE_STRUCTURE_GUARDRAILS_V3", 1)
        need(v2.get("LIFECYCLE") == "SUPERSEDED", "V2 not retired")
        need(v2.get("SUPERSEDED_BY") == c.NEW, "V2 reciprocal backlink")
        need(te.get("status") == "superseded", "TE not retired")
        need(te.get("superseded_by") == c.NEW, "TE reciprocal backlink")
        need(state[c.V2] == expected_v2, "V2 delta exceeds native lifecycle fields")
        need(state[c.TE] == expected_te, "TE delta exceeds raw lifecycle fields")
        need(v3.get("status") == "accepted", "V3 not accepted")
        need(v3.get("supersedes") == c.OLD, "V3 reciprocal predecessor set")
        need(v3.get("superseded_by") is None, "V3 must terminate chain")
        for key, value in ACCEPTANCE_FIELDS.items():
            need(v3.get(key) == value, "acceptance coordinate: " + key)
        recorded = v3.get("accepted_recorded_at")
        need(isinstance(recorded, str) and datetime.fromisoformat(recorded.replace("Z", "+00:00")).tzinfo is not None,
             "acceptance recording time")
        clean_meta = {k: v for k, v in v3.items() if k not in {*ACCEPTANCE_FIELDS, "accepted_recorded_at"}}
        need(clean_meta == dict(old_v3, status="accepted"), "V3 non-lifecycle metadata drift")
        clean_body, current = remove_record(body, "CURRENT")
        clean_body, acceptance = remove_record(clean_body, "ACCEPTANCE")
        need(clean_body == old_body, "V3 reviewed body drift")
        need("historical" in current and "accepted" in current, "current versus historical lifecycle note")
        for coordinate in (REVIEWED, RULING, COMMENT):
            need(coordinate in acceptance, "V3 acceptance provenance: " + coordinate)
        for kind in ("V2_POLICY", "TE_CONTRACTS"):
            need(c.carried(body, kind) == c.carried(old_body, kind), "carried block drift: " + kind)
        lock, old_lock = [json.loads(raw) for raw in (state[LOCK], originals[LOCK])]
        expected_lock = copy.deepcopy(old_lock)
        expected_lock["adoption"].update(status="accepted", accepted_by="mayf3", accepted_at=recorded)
        need(lock == expected_lock, "lock exceeds exact acceptance update")
        need(lock["adoption"]["status"] == "accepted", "lock still proposed")
        need(lock["version"] == "2.0.0-rc.3", "wrong distribution version")
        need(lock["source_commit"] == "c1fad8976e50e96adb27a4c7e2dd4f97bf2e899e", "wrong source pin")
        ad_body, ad_record = remove_record(state[ADOPTION].decode(), "READOPTION")
        need(ad_body == originals[ADOPTION].decode(), "historical adoption Contract drift")
        for coordinate in (REVIEWED, READOPT, RULING, COMMENT, c.sha(state[LOCK]), c.sha(originals[LOCK])):
            need(coordinate in ad_record, "readoption provenance: " + coordinate)
        need("RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md" in state[LOCAL].decode(), "local current rule pointer")
        need("explicit rc.3 update" in state[INDEX].decode(), "adoption index update")
        need("CODE_STRUCTURE_GUARDRAILS_V3.md" in state[INDEX].decode(), "structural authority index update")
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        errors.append("malformed actual lifecycle record: " + str(exc))
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    args = parser.parse_args()
    base = c.git("rev-parse", args.base + "^{commit}").decode().strip()
    head = c.git("rev-parse", args.head + "^{tree}").decode().strip()
    if base != REVIEWED:
        raise ValueError("Phase2 requires exact Owner-reviewed semantic base")
    if Path(__file__).read_bytes() != c.show(head, SELF):
        raise ValueError("executing Phase2 source differs from candidate tree")
    preserved = [c.SELF, c.VALIDATOR, ".agents/tools/verify_governance.py",
                 ".agents/structure-registry.json", "scripts/verify-code-structure.mjs",
                 "docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md",
                 ".agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md", "docs/decisions/README.md"]
    if any(c.show(head, p) != c.show(base, p) for p in preserved):
        raise ValueError("preserved source/authority bytes changed")
    if c.show(base, LOCK) != c.show(READOPT, LOCK):
        raise ValueError("reviewed lock differs from readoption source commit")
    state = {p: c.show(head, p) for p in PATHS}
    originals = {p: c.show(base, p) for p in PATHS}
    errors = inspect(state, originals)
    if errors:
        print(json.dumps({"gate": "V3_PHASE2_NATIVE", "result": "FAIL", "errors": errors}, indent=2))
        return 1
    controls = []
    cases = [
        (c.V2, b"LIFECYCLE = SUPERSEDED", b"LIFECYCLE = ACCEPTED", "V2 not retired"),
        (c.TE, b"status: superseded", b"status: accepted", "TE not retired"),
        (c.V3, b"status: accepted", b"status: proposed", "V3 not accepted"),
        (c.V3, b"accepted_by: mayf3", b"accepted_by: worker", "acceptance coordinate: accepted_by"),
        (c.V3, REVIEWED.encode(), b"0" * 40, "acceptance coordinate: accepted_reviewed_semantic_head"),
        (c.V3, b"HANDWRITTEN_FILE_MAX_LINES = 500", b"HANDWRITTEN_FILE_MAX_LINES = 501", "carried block drift: V2_POLICY"),
        (c.V3, b'"headBlob": "356899a8ec0726f245790379429f97dfc6ea3bfb"', b'"headBlob": "' + b"0" * 40 + b'"', "carried block drift: TE_CONTRACTS"),
        (LOCK, b'"status": "accepted"', b'"status": "proposed"', "lock still proposed"),
        (LOCAL, b"RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md", b"RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md", "local current rule pointer"),
    ]
    for path, prefix in ((c.V2, b"SUPERSEDED_BY = "), (c.TE, b"superseded_by: ")):
        for value in (b"", b"UNRELATED_V1"):
            cases.append((path, prefix + c.NEW.encode(), prefix + value,
                          ("V2" if path == c.V2 else "TE") + " reciprocal backlink"))
    for predecessor in c.OLD:
        cases.append((c.V3, ("  - " + predecessor + "\n").encode(), b"", "V3 reciprocal predecessor set"))
    for path, old, new, expected in cases:
        changed = copy.deepcopy(state)
        if old not in changed[path]:
            raise ValueError("negative fixture source absent: " + expected)
        changed[path] = changed[path].replace(old, new, 1)
        observed = inspect(changed, originals)
        if not any(expected in error for error in observed):
            raise ValueError("negative control failed to reject: " + expected)
        controls.append({"path": path, "expected_error": expected, "observed_errors": observed})
    print(json.dumps({
        "gate": "V3_PHASE2_NATIVE", "result": "PASS", "exit_code": 0,
        "observed_at": datetime.now(timezone.utc).isoformat(), "base_commit": base, "candidate_tree": head,
        "command": ["python3", SELF, "--base", base, "--head", head],
        "records": {p: {"before_blob": c.git("rev-parse", base + ":" + p).decode().strip(),
                        "after_blob": c.git("rev-parse", head + ":" + p).decode().strip(),
                        "before_sha256": c.sha(originals[p]), "after_sha256": c.sha(state[p])} for p in PATHS},
        "native_V2": c.native(state[c.V2])[0], "raw_TE": c.front(state[c.TE])[0], "raw_V3": c.front(state[c.V3])[0],
        "carried_sha256": {kind: c.sha(c.carried(c.front(state[c.V3])[1], kind).encode()) for kind in ("V2_POLICY", "TE_CONTRACTS")},
        "negative_controls": controls, "negative_control_count": len(controls), "preserved_paths": preserved,
        "limits": "Actual native structural lifecycle and explicit lock/readoption/index closure. Not governing-Spec-only CLI certification; no final independent review, main activation, verifier adaptation or production acceptance.",
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({"gate": "V3_PHASE2_NATIVE", "result": "ERROR", "error": str(exc)}, indent=2))
        sys.exit(2)
