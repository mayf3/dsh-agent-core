#!/usr/bin/env python3
"""R2 author-only document check; no product or vendored checker changes.

Run from the repository root. The sole serialization repair is the JSON
normalization immediately after safe_load. R1 proposal/input bytes stay frozen.
The lifecycle input is scoped to the one NEW proposal, not the historic corpus.
"""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import re
import subprocess
import sys
import tempfile
from urllib.parse import unquote

import jsonschema
import yaml

ROOT = Path.cwd().resolve()
REPORT = Path("docs/reports/refusal-terminal-proposal-20261107")
PROPOSAL = Path("docs/specs/AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1.md")
BASE = "2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648"
FROZEN = {
    PROPOSAL.as_posix(): "c5fe3b5da21082e417c2c78d0952ed6df2246d5e3e222316a6943152515ff212",
    (REPORT / "source-provenance.json").as_posix(): "f809f59b3017474deafe39c706b1d75e3b45207daf1fdeff43af85d78b35a578",
    "BRIEF-REFUSAL-PROPOSAL.md": "eac7da6ed1b5727cd090a32de3b3394f825422d031174924c5b69fe00cba50b5",
}


def git(*args):
    return subprocess.check_output(["git", *args])


def sha(data):
    return hashlib.sha256(data).hexdigest()


for name, expected in FROZEN.items():
    assert sha(Path(name).read_bytes()) == expected, ("frozen bytes", name)
print("frozen R1 proposal/provenance/Brief: PASS", flush=True)

text = PROPOSAL.read_text()
raw_fm = yaml.safe_load(text.split("---", 2)[1])
fm = json.loads(json.dumps(raw_fm, default=str))
assert type(raw_fm["date"]).__name__ == "date"
assert fm["date"] == "2026-11-07" and isinstance(fm["date"], str)
schema = json.loads(Path(".agents/schemas/spec-frontmatter.schema.json").read_text())
jsonschema.Draft202012Validator(schema).validate(fm)
assert fm["spec_id"] == "AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1"
assert fm["status"] == "proposed" and fm["implementation_authority"] == "none"
assert fm["production_apply_authority"] == "none" and fm["authority_action"] == "NEW"
assert fm["supersedes"] == [] and fm["superseded_by"] is None
assert fm["authoring_base"] == BASE
print("frontmatter: date -> JSON string; schema/proposed/none/NEW: PASS", flush=True)

sections = re.findall(r"^## (\d+)\. (.+)$", text, re.M)
assert [int(n) for n, _ in sections] == list(range(1, 14)), sections
contracts = re.findall(r"^### (CTR-RTH-\d{3}) —", text, re.M)
assert contracts == [f"CTR-RTH-{i:03}" for i in range(1, 7)], contracts
acceptance_rows = re.findall(r"^\| (ACC-RTH-\d{3}) \| ([^|]+) \|([^\n]+)$", text, re.M)
assert [row[0] for row in acceptance_rows] == [f"ACC-RTH-{i:03}" for i in range(1, 8)]
expected_coverage = {
    "001": [1, 2, 3, 7], "002": [1, 2, 3, 5, 7], "003": list(range(1, 8)),
    "004": [1, 3, 4, 6, 7], "005": [1, 4, 5, 7], "006": [1, 2, 5, 6, 7],
}
coverage = {c[-3:]: [] for c in contracts}
for acc, refs, rest in acceptance_rows:
    cells = rest.rstrip("|").split("|")
    assert len(cells) == 3 and all(c.strip() for c in cells), acc
    if ".." in refs:
        start, end = re.fullmatch(r"CTR-RTH-(\d{3})\.\.(\d{3})", refs.strip()).groups()
        ids = [f"{i:03}" for i in range(int(start), int(end) + 1)]
    else:
        ids = refs.strip().removeprefix("CTR-RTH-").split("/")
    for item in ids:
        assert item in coverage, (acc, item)
        coverage[item].append(int(acc[-3:]))
assert coverage == expected_coverage, coverage
print("13 sections; 6 contracts; 7 acceptance definitions; reverse coverage 6/6: PASS", flush=True)

provenance = json.loads((REPORT / "source-provenance.json").read_text())
assert provenance["base_head"] == BASE and len(provenance["sources"]) == 7
for source in provenance["sources"]:
    ref = source["revision"] + ":" + source["path"]
    assert git("rev-parse", ref).decode().strip() == source["blob"], ref
    assert sha(git("show", ref)) == source["sha256"], ref
assert len(provenance["local_inputs"]) == 2
for source in provenance["local_inputs"]:
    assert sha(Path(source["path"]).read_bytes()) == source["sha256"], source["path"]
print("7 fixed Git sources/blob/hash; 2 local input hashes: PASS", flush=True)

root_docs = {"BRIEF-REFUSAL-PROPOSAL.md", "STOPPED-REFUSAL-PROPOSAL.md", "RECEIPT-REFUSAL-PROPOSAL.md"}
changed = set(git("diff", "--name-only", BASE, "--").decode().splitlines())
changed.update(git("ls-files", "--others", "--exclude-standard").decode().splitlines())
assert changed
assert all(p in root_docs or p == PROPOSAL.as_posix() or p.startswith(REPORT.as_posix() + "/")
           for p in changed), ("docs-only scope", sorted(changed))
base_tracked = set(git("ls-tree", "-r", "--name-only", BASE).decode().splitlines())
assert not (changed & base_tracked), ("existing tracked files changed", sorted(changed & base_tracked))
checked = []
authored = sorted(p for p in changed if p.endswith(".md"))
for name in authored:
    fence = None
    for lineno, line in enumerate(Path(name).read_text().splitlines(), 1):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            if fence is None:
                fence = marker[1][0]
            elif marker[1][0] == fence:
                fence = None
            continue
        if fence:
            continue
        for match in re.finditer(r"\[[^\]\n]+\]\(([^)\n]+)\)", line):
            target = match[1]
            if re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|#", target):
                continue
            resolved = (ROOT / name).parent.joinpath(unquote(target.split("#", 1)[0])).resolve()
            relative = resolved.relative_to(ROOT).as_posix()
            assert resolved.is_file() and relative in base_tracked | changed, (name, lineno, target)
            checked.append({"file": name, "line": lineno, "target": target})
print(json.dumps({"docs_only_scope": "PASS", "relative_file_links": checked,
                  "scope_files": sorted(changed),
                  "limits": "No network/anchor validation; no product/runtime acceptance."}, ensure_ascii=False, indent=2), flush=True)

with tempfile.TemporaryDirectory(prefix="refusal-spec-check-") as directory:
    base_path = Path(directory) / "base.json"
    candidate_path = Path(directory) / "candidate.json"
    base_path.write_text("[]\n")
    candidate_path.write_text(json.dumps([fm], indent=2) + "\n")
    command = [sys.executable, ".agents/tools/validate_spec_transition.py", "--base", str(base_path), "--candidate", str(candidate_path)]
    print("lifecycle argv=" + json.dumps(command), flush=True)
    result = subprocess.run(command, check=False)
    print("lifecycle rc=" + str(result.returncode), flush=True)
    if result.returncode:
        raise SystemExit(result.returncode)
print(json.dumps({"result": "PASS", "proposal_sha256": FROZEN[PROPOSAL.as_posix()],
                  "python": sys.version, "PyYAML": importlib.metadata.version("PyYAML"),
                  "jsonschema": importlib.metadata.version("jsonschema")}), flush=True)
