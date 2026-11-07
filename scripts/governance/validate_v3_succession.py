#!/usr/bin/env python3
"""Read-only native V3 proposal gate; requires Python 3 and PyYAML 6.0.3.

Run from the repository root with --base <commit> --head <commit-or-tree>.
The Phase 2 positive/negative fixtures are in memory, never acceptance evidence.
stdout is a coordinate-bound JSON observation; exit 0 PASS, 1 rejection, 2 input error.
"""

import argparse
import copy
import hashlib
import json
import platform
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

BASE = "230de798e340cc6c157e6b21822f0b1fda77e51e"
AFTER_B = "21ac77eabf67008d0612e9c688931b25911d0c8c"
PARENT = "74523bc95e62d6b476af3cff007d88483927ed41"
V2 = ".agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md"
TE = "docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md"
V3 = ".agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md"
SELF = "scripts/governance/validate_v3_succession.py"
VALIDATOR = ".agents/tools/validate_spec_transition.py"
OLD = ["CODE_STRUCTURE_GUARDRAILS_V2", "CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1"]
NEW = "CODE_STRUCTURE_GUARDRAILS_V3"
PAIR = {"path": "scripts/trusted-cp-deploy-install.sh",
        "baseBlob": "ef5053201e6af88b1edbcdfc33e845f872183b2b",
        "headBlob": "356899a8ec0726f245790379429f97dfc6ea3bfb"}
# Existing source commit where the new installer blob has a real 100644 tree entry.
PAIR_HEAD = "67d2bb08e6ec56a3bd2067266fda3be3b7635eec"


class Loader(yaml.SafeLoader):
    pass


Loader.yaml_implicit_resolvers = {
    k: [v for v in values if v[0] != "tag:yaml.org,2002:timestamp"]
    for k, values in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def unique_mapping(loader, node):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if key in result:
            raise ValueError("duplicate YAML key: " + str(key))
        result[key] = loader.construct_object(value_node)
    return result


Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.PIPE)


def show(ref, path):
    return git("show", ref + ":" + path)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def front(raw):
    text = raw.decode("utf-8")
    if not text.startswith("---\n"):
        raise ValueError("missing real YAML frontmatter")
    header, body = text[4:].split("\n---\n", 1)
    fields = yaml.load(header, Loader=Loader)
    if not isinstance(fields, dict):
        raise ValueError("frontmatter is not a mapping")
    return fields, body


def native(raw):
    text = raw.decode("utf-8")
    if text.startswith("---\n"):
        raise ValueError("V2 must retain native fenced metadata")
    header, body = text.split("```text\n", 1)[1].split("\n```", 1)
    fields = {}
    for line in header.splitlines():
        key, value = line.split(" = ", 1)
        if key in fields:
            raise ValueError("duplicate native key")
        fields[key] = value
    return fields, body


def carried(text, kind):
    start, end = "<!-- BEGIN CARRIED_" + kind + " -->\n", "<!-- END CARRIED_" + kind + " -->"
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError("missing/duplicate carry marker: " + kind)
    return text.split(start, 1)[1].split(end, 1)[0]


def records(text):
    blocks = re.findall(r"```STRUCTURE_TRANSITION_EXCEPTION_V1\n(.*?)\n```", text, re.S)
    return [json.loads(block) for block in blocks]


def exact_transition(record, modes, blobs):
    """A fixture predicate for the inherited tuple; never invokes the product verifier."""
    if record != PAIR or modes != ("100644", "100644") or len(blobs) != 2:
        return False
    old, new = blobs
    ids = [hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() for raw in blobs]
    token = b"agentcore-cron.mjs "
    return (ids == [PAIR["baseBlob"], PAIR["headBlob"]]
            and old.count(token) == 1 and old.replace(token, token + b"scheduler-watchdog.mjs ", 1) == new
            and len(old.splitlines()) == len(new.splitlines()) == 1315
            and (len(old), len(new)) == (76444, 76467))


def exception_controls(blobs):
    old, new = blobs
    cases = [
        ("alternate_path", dict(PAIR, path="scripts/alias.sh"), ("100644", "100644"), blobs),
        ("base_blob_identity_changed", dict(PAIR, baseBlob="0" * 40), ("100644", "100644"), blobs),
        ("head_blob_identity_changed", dict(PAIR, headBlob="0" * 40), ("100644", "100644"), blobs),
        ("file_mode_changed", PAIR, ("100644", "100755"), blobs),
        ("same_length_content_edit", PAIR, ("100644", "100644"), (old, new.replace(b"scheduler-watchdog.mjs", b"scheduler-watchdog.mjt", 1))),
        ("additional_line", PAIR, ("100644", "100644"), (old, new + b"\n")),
        ("future_edit_from_new_base", PAIR, ("100644", "100644"), (new, new)),
        ("unknown_record_field", dict(PAIR, approved_max_lines=1315), ("100644", "100644"), blobs),
    ]
    results = []
    for name, record, modes, data in cases:
        if exact_transition(record, modes, data):
            raise ValueError("exception scope negative admitted: " + name)
        results.append({"case": name, "expected_rejection_observed": True})
    return results


def inspect(s, originals, validator, phase="proposal"):
    errors = []

    def need(ok, label):
        if not ok:
            errors.append(label)

    try:
        for path in (V2, TE, V3):
            need(path in s, "missing authority: " + path)
        if errors:
            return errors
        v2, v2_body = native(s[V2])
        te, te_body = front(s[TE])
        v3, body = front(s[V3])
        original_v2, original_body = native(originals[V2])
        original_te, original_te_body = front(originals[TE])
        need(v2["RULE_ID"] == OLD[0], "V2 identity")
        need(te["spec_id"] == OLD[1], "TE identity")
        need(v3["spec_id"] == NEW, "V3 identity")
        need(v3.get("supersedes") == OLD, "exact whole predecessor set")
        need(v3.get("superseded_by") is None, "V3 active backlink")
        for key, value in {"authority_level": "repository_local_rule", "rule_kind": "repository-local binding rule",
                           "spec_kind": "invariant", "implementation_authority": "none",
                           "production_apply_authority": "none", "owners": ["mayf3"],
                           "governed_by": [], "external_authorities": []}.items():
            need(v3.get(key) == value, "V3 metadata: " + key)
        need(not any(k.startswith(("accepted_", "acceptance_")) for k in v3), "invented acceptance")
        errors.extend(validator["validate_metadata"](v3, "native V3"))
        errors.extend(validator["validate_metadata"](te, "raw TE"))
        need(validator["is_strict_spec_id"](v2["RULE_ID"]), "V2 strict ID")
        if phase == "proposal":
            need(v3.get("status") == "proposed", "proposal must stay proposed")
            need(v2.get("LIFECYCLE") == "ACCEPTED", "V2 premature retirement")
            need("SUPERSEDED_BY" not in v2, "V2 premature backlink")
            need(te.get("status") == "accepted" and te.get("superseded_by") is None, "TE premature retirement/backlink")
            need(s[V2] == originals[V2], "V2 bytes changed")
            need(s[TE] == originals[TE], "TE bytes changed after B")
        else:
            need(v3.get("status") == "accepted", "simulated V3 acceptance missing")
            need(v2.get("LIFECYCLE") == "SUPERSEDED", "V2 not retired atomically")
            need(v2.get("SUPERSEDED_BY") == NEW, "V2 reciprocal backlink missing/wrong")
            need(te.get("status") == "superseded", "TE not retired atomically")
            need(te.get("superseded_by") == NEW, "TE reciprocal backlink missing/wrong")
            need(v2_body == original_body, "V2 body changed at retirement")
            need(te_body == original_te_body, "TE body changed at retirement")
            for key in set(v2) | set(original_v2):
                if key not in {"LIFECYCLE", "SUPERSEDED_BY"}:
                    need(v2.get(key) == original_v2.get(key), "retired V2 metadata drift: " + key)
            for key in set(te) | set(original_te):
                if key not in {"status", "superseded_by"}:
                    need(te.get(key) == original_te.get(key), "retired TE metadata drift: " + key)
        source_policy = "## 1. Goal and scope" + originals[V2].decode().split("## 1. Goal and scope", 1)[1]
        source_te = "## 4. Exact exception record and Contracts" + originals["original_TE"].decode().split(
            "## 4. Exact exception record and Contracts", 1)[1].split("## 6. Delivery and stops", 1)[0]
        need(carried(body, "V2_POLICY") == source_policy, "V2 complete policy carry drift")
        need(carried(body, "TE_CONTRACTS") == source_te, "TE complete contract carry drift")
        for key in ("IMPLEMENTATION_CONTRACTS", "ENFORCEMENT", "BASELINE_COMMIT", "ACCEPTANCE_ACTORS", "REGISTRY_APPROVAL_ACTORS"):
            need(key + " = " + original_v2[key] in body, "V2 header constant missing: " + key)
        need(records(body) == [PAIR], "exception must be the single exact blob pair")
        acceptance = body.split("## 13. Acceptance, validation and stop boundary", 1)[1]
        for label in ["CTR-V3TE-00" + str(i) for i in range(1, 5)] + ["CTR-CSG3-ABS-001", "CTR-CSG3-SUC-001", "CTR-CSG3-SUC-002"]:
            # The existing acceptance table uses the inclusive range CTR-V3TE-001–004.
            need(label in acceptance or (label.startswith("CTR-V3TE-") and "CTR-V3TE-001–004" in acceptance),
                 "acceptance coverage missing: " + label)
    except (KeyError, ValueError, IndexError, TypeError, yaml.YAMLError) as exc:
        errors.append("malformed native input: " + str(exc))
    return errors


def simulated_acceptance(s):
    fixture = copy.deepcopy(s)
    # Match the native metadata's closing fence, not its opening ```text fence.
    fixture[V2] = fixture[V2].replace(b"LIFECYCLE = ACCEPTED", b"LIFECYCLE = SUPERSEDED", 1).replace(
        b"\n```\n", b"\nSUPERSEDED_BY = " + NEW.encode() + b"\n```\n", 1)
    fixture[TE] = fixture[TE].replace(b"status: accepted", b"status: superseded", 1).replace(
        b"superseded_by: null", b"superseded_by: " + NEW.encode(), 1)
    fixture[V3] = fixture[V3].replace(b"status: proposed", b"status: accepted", 1)
    return fixture


def negative_controls(s, fixture, originals, validator):
    results = []

    def reject(name, phase, mutate, expected):
        altered = copy.deepcopy(s if phase == "proposal" else fixture)
        mutate(altered)
        errors = inspect(altered, originals, validator, phase)
        if not any(expected in error for error in errors):
            raise ValueError("negative control did not reject as expected: " + name)
        results.append({"case": name, "phase": phase, "expected_error": expected, "observed_errors": errors})

    def change(path, old, new):
        def mutate(state):
            if old not in state[path]:
                raise ValueError("negative control source absent")
            state[path] = state[path].replace(old, new, 1)
        return mutate

    cases = [
        ("V2_body_mutation", V2, b"HANDWRITTEN_FILE_MAX_LINES = 500", b"HANDWRITTEN_FILE_MAX_LINES = 501", "V2 bytes changed"),
        ("V2_clause_changed_in_V3", V3, b"HANDWRITTEN_FILE_MAX_LINES = 500", b"HANDWRITTEN_FILE_MAX_LINES = 501", "V2 complete policy carry drift"),
        ("V2_clause_omitted", V3, b"MAX_STATEMENTS_PER_LINE = 3\n", b"", "V2 complete policy carry drift"),
        ("TE_body_mutation", TE, b"500 physical lines", b"501 physical lines", "TE bytes changed after B"),
        ("base_blob_changed", V3, ('"baseBlob": "' + PAIR["baseBlob"]).encode(), b'"baseBlob": "' + b"0" * 40, "TE complete contract carry drift"),
        ("head_blob_changed", V3, ('"headBlob": "' + PAIR["headBlob"]).encode(), b'"headBlob": "' + b"0" * 40, "TE complete contract carry drift"),
        ("exception_record_path_alias", V3, b'"path": "scripts/trusted-cp-deploy-install.sh"', b'"path": "scripts/alias.sh"', "single exact blob pair"),
        ("duplicate_exception", V3, b"<!-- END CARRIED_TE_CONTRACTS -->", ("```STRUCTURE_TRANSITION_EXCEPTION_V1\n" + json.dumps(PAIR) + "\n```\n<!-- END CARRIED_TE_CONTRACTS -->").encode(), "single exact blob pair"),
        ("missing_TE_edge", V3, ("  - " + OLD[1] + "\n").encode(), b"", "exact whole predecessor set"),
        ("partial_edge", V3, ("  - " + OLD[0] + "\n").encode(), ("  - " + OLD[0] + "#part\n").encode(), "invalid whole-authority ID"),
        ("premature_V2_backlink", V2, b"\n```\n", b"\nSUPERSEDED_BY = " + NEW.encode() + b"\n```\n", "V2 premature backlink"),
        ("premature_TE_backlink", TE, b"superseded_by: null", b"superseded_by: " + NEW.encode(), "TE premature retirement/backlink"),
        ("premature_V2_retirement", V2, b"LIFECYCLE = ACCEPTED", b"LIFECYCLE = SUPERSEDED", "V2 premature retirement"),
        ("premature_V3_acceptance", V3, b"status: proposed", b"status: accepted", "proposal must stay proposed"),
        ("legacy_active_V3_ID", V3, ("spec_id: " + NEW).encode(), b"spec_id: CODE_STRUCTURE_V3_LEGACY", "strict _V<number>"),
        ("invented_governing_spec", V3, b"authority_level: repository_local_rule", b"authority_level: governing_spec", "V3 metadata: authority_level"),
    ]
    for name, path, old, new, expected in cases:
        reject(name, "proposal", change(path, old, new), expected)
    for path in (V2, TE):
        reject("missing_" + ("V2" if path == V2 else "TE"), "proposal", lambda state, p=path: state.pop(p), "missing authority")
    for label, path, prefix in [("V2", V2, b"SUPERSEDED_BY = "), ("TE", TE, b"superseded_by: ")]:
        for suffix, replacement in [("missing", b""), ("wrong", prefix + b"UNRELATED_V1")]:
            original = prefix + NEW.encode()
            if label == "V2" and suffix == "missing":
                original = b"\n" + original
            reject(label + "_acceptance_backlink_" + suffix, "simulated_acceptance",
                   change(path, original, replacement), label + " reciprocal backlink missing/wrong")
    reject("TE_not_atomically_retired", "simulated_acceptance", change(TE, b"status: superseded", b"status: accepted"), "TE not retired atomically")
    reject("V2_not_atomically_retired", "simulated_acceptance", change(V2, b"LIFECYCLE = SUPERSEDED", b"LIFECYCLE = ACCEPTED"), "V2 not retired atomically")
    return results


def format_controls(validator):
    # Synthetic governing-Spec format fixtures only; neither fixture represents native V2.
    legacy, successor = "EXAMPLE_V1_HISTORICAL", "EXAMPLE_SUCCESSOR_V2"
    old = {"spec_id": legacy, "status": "accepted", "spec_kind": "invariant", "authority_level": "governing_spec",
           "implementation_authority": "none", "scope": ["synthetic format fixture"], "governed_by": [],
           "external_authorities": [], "supersedes": [], "superseded_by": None, "owners": ["fixture"]}
    new = dict(old, spec_id=successor, supersedes=[legacy])
    retired = dict(old, status="superseded", superseded_by=successor)
    cases = [
        ("V2_strict", validator["is_strict_spec_id"](OLD[0])),
        ("TE_strict_despite_internal_V3", validator["is_strict_spec_id"](OLD[1])),
        ("V3_strict", validator["is_strict_spec_id"](NEW)),
        ("legacy_recognized", validator["is_legacy_spec_id"](legacy)),
        ("active_legacy_rejected", bool(validator["validate_metadata"](old))),
        ("existing_legacy_atomic_retirement", not validator["validate_transition"]([old], [retired, new])),
        ("new_legacy_rejected", bool(validator["validate_transition"]([], [old]))),
        ("invented_retired_legacy_rejected", bool(validator["validate_transition"]([], [retired, new]))),
        ("fragment_rejected", not validator["is_reference_id"](OLD[0] + "#clause")),
        ("lowercase_rejected", not validator["is_reference_id"]("example_V1")),
        ("object_reference_rejected", not validator["is_reference_id"]({"scope": OLD[0]})),
    ]
    if not all(ok for _, ok in cases):
        raise ValueError("strict/legacy control failed: " + repr(cases))
    return [{"case": name, "expected_result_observed": ok} for name, ok in cases]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True, help="immutable candidate commit or tree")
    args = parser.parse_args()
    base = git("rev-parse", args.base + "^{commit}").decode().strip()
    head = git("rev-parse", args.head + "^{tree}").decode().strip()
    if base != BASE:
        raise ValueError("this bounded gate requires the original integration base")
    snapshot = {p: show(head, p) for p in (V2, TE, V3)}
    originals = {V2: show(base, V2), TE: show(AFTER_B, TE), "original_TE": show(base, TE)}
    if Path(__file__).read_bytes() != show(head, SELF):
        raise ValueError("executing script differs from candidate tree source")
    validator_source = show(head, VALIDATOR)
    if validator_source != show(PARENT, VALIDATOR):
        raise ValueError("pinned rc.3 validator changed")
    validator = {"__name__": "pinned_rc3_format_rules"}
    exec(compile(validator_source, VALIDATOR, "exec"), validator)
    errors = inspect(snapshot, originals, validator)
    if errors:
        print(json.dumps({"gate": "C_NATIVE_LOCAL_RULE", "result": "FAIL", "base": base, "candidate_tree": head, "errors": errors}, indent=2))
        return 1
    fixture = simulated_acceptance(snapshot)
    errors = inspect(fixture, originals, validator, "simulated_acceptance")
    if errors:
        raise ValueError("simulated atomic acceptance fixture failed: " + repr(errors))
    old_blob, new_blob = [git("cat-file", "blob", PAIR[key]) for key in ("baseBlob", "headBlob")]
    if not exact_transition(PAIR, ("100644", "100644"), (old_blob, new_blob)):
        raise ValueError("actual Git blob pair is not the exact token-only transition")
    entries = [git("ls-tree", ref, "--", PAIR["path"]).decode().strip() for ref in (base, PAIR_HEAD)]
    for entry, blob in zip(entries, (PAIR["baseBlob"], PAIR["headBlob"])):
        if entry != "100644 blob " + blob + "\t" + PAIR["path"]:
            raise ValueError("missing exact path/blob/100644 Git tree evidence")
    negatives = negative_controls(snapshot, fixture, originals, validator)
    exception_scope = exception_controls((old_blob, new_blob))
    strict_legacy = format_controls(validator)
    report = {
        "schema_version": 1, "gate": "C_NATIVE_LOCAL_RULE", "result": "PASS", "exit_code": 0,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "environment": {"python": platform.python_version(), "pyyaml": yaml.__version__, "platform": platform.platform(), "git": git("--version").decode().strip()},
        "base_commit": base, "after_B_commit": AFTER_B, "reviewed_parent": PARENT, "candidate_tree": head,
        "command": ["python3", SELF, "--base", base, "--head", head],
        "files": {p: {"blob": git("rev-parse", head + ":" + p).decode().strip(), "sha256": sha(show(head, p))} for p in (V2, TE, V3, SELF, VALIDATOR)},
        "source_policy_sha256": sha(carried(snapshot[V3].decode(), "V2_POLICY").encode()),
        "source_exception_contracts_sha256": sha(carried(snapshot[V3].decode(), "TE_CONTRACTS").encode()),
        "V2_provenance": {
            "base_record": {"origin": "native-fenced-metadata", "source_commit": base,
                            "source_path": V2, "source_blob": git("rev-parse", base + ":" + V2).decode().strip(),
                            "yaml_frontmatter": False, "derived_from_carried_policy": False},
            "carried_policy": {"origin": "derived-from-carried-policy", "source_tree": head,
                               "source_path": V3, "marker": "CARRIED_V2_POLICY", "used_as_base_metadata": False},
        },
        "actual_proposal": {"V2_native": native(snapshot[V2])[0], "TE_raw": front(snapshot[TE])[0], "V3_raw": front(snapshot[V3])[0]},
        "simulated_acceptance_only": {"result": "PASS", "V2_native": native(fixture[V2])[0], "TE_raw": front(fixture[TE])[0], "V3_raw": front(fixture[V3])[0], "writes": 0},
        "exception_objects": {"record": PAIR, "tree_refs": [base, PAIR_HEAD], "tree_entries": entries, "physical_lines": [1315, 1315], "bytes": [76444, 76467], "sha256": [sha(old_blob), sha(new_blob)], "exact_token_insertion": True},
        "negative_controls": negatives,
        "exception_scope_negative_controls": exception_scope,
        "strict_legacy_controls": strict_legacy,
        "control_summary": {name: {"result": "PASS", "executed": len(results)} for name, results in
                            [("negative_controls", negatives), ("exception_scope", exception_scope), ("strict_legacy", strict_legacy)]},
        "limits": "Native proposal source/lifecycle gate and explicitly simulated Phase 2 backlinks. Not governing-Spec-only full-transition certification, actual Owner acceptance/retirement, structure-verifier runtime regression, runtime or production conformance. Later Validation/Brief/receipt additions require independent delta recheck; receipt hash is not self-referential.",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, KeyError, IndexError, TypeError, OSError, subprocess.CalledProcessError, yaml.YAMLError) as exc:
        print(json.dumps({"gate": "C_NATIVE_LOCAL_RULE", "result": "ERROR", "exit_code": 2, "error": str(exc)}, indent=2))
        sys.exit(2)
