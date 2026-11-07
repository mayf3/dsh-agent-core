# R2 静态检查器（仅文档，不修改方案）

授权为本次用户 R2 续派：修正围栏误报、重跑全量静态检查、创建
`docs/captain-design-proposal` 分支并 commit/push/开 main PR，不合并，零生产写入。
沿用原回执 `REUSE / BRIEF / DURABLE`；不改变 Product Contract 或方案正文。

原误报坐标为 `control-probe.md:32`，在 `:5–41` 的 Python 围栏内；
`namespace["validate_authority"](item, ...)` 是函数调用，没有 Markdown 链接标签。
原 rc1 保留在根目录 STOPPED 文件。检查器先逐行屏蔽 Markdown backtick/tilde
围栏并保留行号，再识别完整 `[label](destination)`；行内 code span 也屏蔽。
没有按目标路径、文件名或任意失败结果白名单放行。外链仅识别/登记，静态检查
不做网络可达性断言；本地目标存在性及 `#L` 行号会检查，章节 slug 不作语义判定。

运行方式：在 worktree 根目录将本文件唯一 Python 围栏提取后交给 `python3 -`。
每个子命令的原始 stdout/stderr/rc 和整体 raw rc 由外层 recorder 写入 JSON。
命令失败即中止；不运行生产代码或重复执行 R1 纯函数探针。

```python
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib
import json
import re
import subprocess

ROOT = Path.cwd().resolve()
REPORT = Path("docs/reports/captain-design-20261107")
BASE = "f6e332d7568b01c5253618449bfef5839102c851"
PROPOSAL_HASH = "bff562271cd15af449c1c0542a1386b340956a9db48fbd1a16a972e0948faa7a"

def command(argv):
    result = subprocess.run(argv, text=True, capture_output=True, check=False)
    print(json.dumps({"argv": argv, "raw_rc": result.returncode,
                      "stdout": result.stdout, "stderr": result.stderr}, ensure_ascii=False))
    if result.returncode:
        raise SystemExit(result.returncode)
    return result.stdout

def sha(data):
    return hashlib.sha256(data).hexdigest()

def visible_lines(content):
    lines, excluded, fence = [], [], None
    for number, line in enumerate(content.splitlines(), 1):
        if fence:
            char, length, start = fence
            if re.fullmatch(r" {0,3}" + re.escape(char) + "{" + str(length) + r",}\s*", line):
                excluded.append({"start": start, "end": number, "reason": "fenced code"})
                fence = None
            lines.append("")
            continue
        opening = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if opening and not (opening[1][0] == "`" and "`" in opening[2]):
            fence = (opening[1][0], len(opening[1]), number)
            lines.append("")
            continue
        # Equal-length backtick delimiters bound inline code spans.
        line = re.sub(r"(`+)(?!`)(.*?)(?<!`)\1(?!`)", "", line)
        lines.append(line)
    assert fence is None, "unclosed code fence"
    return lines, excluded

LINK = re.compile(r"(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)")

def links(content):
    lines, excluded = visible_lines(content)
    found = [(number, m[1], m[2]) for number, line in enumerate(lines, 1)
             for m in LINK.finditer(line)]
    return found, excluded

# Focused regression: actual R1 false positive and real links outside code.
sample = '\n'.join(['```python', 'namespace["validate_authority"](item)',
                    '[hidden](missing)', '```', '[real](CAPTAIN-DESIGN-PROPOSAL.md)',
                    '`[inline](missing)`', '~~~~text', '[hidden2](missing)', '~~~~'])
assert links(sample)[0] == [(5, 'real', 'CAPTAIN-DESIGN-PROPOSAL.md')]
assert len(links(sample)[1]) == 2
print("PASS fenced-code/inline-code regression; real link retained")

command(["python3", ".agents/tools/verify_governance.py", "--target", ".", "--require-accepted"])
assert command(["git", "merge-base", "HEAD", BASE]).strip() == BASE
assert sha(Path("CAPTAIN-DESIGN-PROPOSAL.md").read_bytes()) == PROPOSAL_HASH
print("PASS exact base ancestry and R1 proposal byte identity " + PROPOSAL_HASH)

provenance = json.loads((REPORT / "source-provenance.json").read_text())
coordinates = provenance["repository_coordinates"] + [provenance["sra_proposed_input"]]
for item in coordinates:
    spec = item["commit"] + ":" + item["path"]
    blob = subprocess.check_output(["git", "rev-parse", spec], text=True).strip()
    data = subprocess.check_output(["git", "show", spec])
    assert blob == item["git_blob"] and sha(data) == item["sha256"], item["path"]
assert sha((REPORT / "BRIEF-CAPTAIN-DESIGN.source.md").read_bytes()) == provenance["source_brief_sha256"]
print("PASS source commit/blob/SHA256 coordinates=" + str(len(coordinates)) + "; BRIEF hash")

owner = json.loads((REPORT / "owner-selected-records.json").read_text())
for item in owner["records"]:
    canonical = json.dumps(item["record"], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    assert sha(canonical) == item["canonical_sha256"], item["selector"]
probe = json.loads((REPORT / "control-probe-result.json").read_text())
assert probe["raw_rc"] == 0 and probe["production_calls"] == 0 and probe["network_calls"] == 0
assert probe["source_sha256"] == sha(Path(probe["source"]).read_bytes())
assert [x["result"] for x in probe["results"]] == ["ACCEPTED_BY_PURE_VALIDATOR"] * 3 + ["REJECTED_BY_PURE_VALIDATOR"]
print("PASS Owner canonical hashes=2; R1 probe evidence rebound without re-execution")

changed = set(command(["git", "diff", "--name-only", BASE]).splitlines())
changed.update(command(["git", "ls-files", "--others", "--exclude-standard"]).splitlines())
allowed_roots = {"CAPTAIN-DESIGN-PROPOSAL.md", "RECEIPT-CAPTAIN-DESIGN.md", "STOPPED-CAPTAIN-DESIGN.md"}
for path in changed:
    assert path in allowed_roots or (path.startswith(str(REPORT) + "/") and Path(path).suffix in {".md", ".json"}), path
print("PASS docs-only changed-path scope files=" + str(len(changed)))

files = [Path(p) for p in sorted(allowed_roots)] + sorted(REPORT.glob("*.md"))
checked, external, exclusions = [], [], []
for path in files:
    found, excluded = links(path.read_text())
    exclusions.extend({"path": str(path), **entry} for entry in excluded)
    for number, label, destination in found:
        if destination.startswith("<") and destination.endswith(">"):
            destination = destination[1:-1]
        parsed = urlsplit(destination)
        if parsed.scheme or parsed.netloc:
            external.append({"path": str(path), "line": number, "target": destination})
            continue
        target = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path.resolve()
        assert target.is_relative_to(ROOT) and target.is_file(), (path, number, destination)
        if re.fullmatch(r"L\d+(?:-L\d+)?", parsed.fragment):
            numbers = [int(n) for n in re.findall(r"\d+", parsed.fragment)]
            assert min(numbers) >= 1 and max(numbers) <= len(target.read_text().splitlines()), (path, number, destination)
        checked.append({"path": str(path), "line": number, "target": destination})
for path in REPORT.glob("*.json"):
    json.loads(path.read_text())
print(json.dumps({"local_markdown_links": checked, "external_links_not_network_checked": external,
                  "excluded_fences": exclusions}, ensure_ascii=False))
print("PASS Markdown links files=" + str(len(files)) + "; local=" + str(len(checked)) + "; external=" + str(len(external)))

command(["git", "diff", "--check"])
command(["git", "diff", "--cached", "--check"])
# Include untracked docs, which ordinary git diff --check does not inspect.
for path in changed:
    data = Path(path).read_text()
    for number, line in enumerate(data.splitlines(), 1):
        assert not line.endswith((" ", "\t")), (path, number, "trailing whitespace")
    assert not data or data.endswith("\n"), (path, "missing final newline")
print("PASS git diff --check; cached diff --check; all changed/untracked docs whitespace")
print("ALL_STATIC_CHECKS_PASS raw_rc=0")
```
