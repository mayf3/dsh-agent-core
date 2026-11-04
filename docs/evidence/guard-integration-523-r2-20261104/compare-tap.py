#!/usr/bin/env python3
"""Compare existing raw R1/cold baseline TAP without executing tests."""
import collections
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = pathlib.Path(__file__).resolve().parent


def parse(path, worktree):
    raw = path.read_bytes()
    text = raw.decode()
    lines = text.splitlines()
    results = []
    for index, line in enumerate(lines):
        match = re.fullmatch(r"(ok|not ok) (\d+) - (.+)", line)
        if not match:
            continue
        outcome, number, title = match.groups()
        skipped = " # SKIP" in title
        title, _, skip_reason = title.partition(" # SKIP")
        block = []
        for following in lines[index + 1:]:
            block.append(following)
            if following == "  ...":
                break
            if re.match(r"^(?:# Subtest:|ok |not ok )", following):
                block.pop()
                break
        block_text = "\n".join(block)
        location = re.search(r"^  location: ['\"](.+?)['\"]$", block_text, re.M)
        relative_location = location.group(1).replace(worktree + "/", "") if location else None
        results.append({
            "title": title,
            "outcome": "skip" if skipped else ("pass" if outcome == "ok" else "fail"),
            "tapId": int(number),
            "line": index + 1,
            "location": relative_location,
            "skipReason": skip_reason.strip() if skipped else None,
            "rawFailure": "\n".join([line] + block) if outcome == "not ok" else None,
        })
    duplicates = {key: count for key, count in collections.Counter(r["title"] for r in results).items() if count > 1}
    assert not duplicates, duplicates
    summary = {key: int(value) for key, value in re.findall(r"^# (tests|pass|fail|cancelled|skipped|todo|suites) (\d+)$", text, re.M)}
    counts = collections.Counter(r["outcome"] for r in results)
    assert summary["tests"] == len(results)
    assert all(counts[k] == summary[k if k != "skip" else "skipped"] for k in ["pass", "fail", "skip"])
    assert summary["cancelled"] == summary["todo"] == 0
    return {"source": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "summary": summary, "duplicateTitles": duplicates, "results": results}


original = parse(ROOT / "docs/evidence/guard-integration-523-20261104/agent-router.tap", "/private/tmp/dsh-523-integration")
baseline = parse(EVIDENCE / "baseline-agent-router.tap", "/private/tmp/dsh-523-baseline")
assert original["sha256"] == "0725db8bc5de77a29d8db961342ac71fb17f55fca67386bfbcec781aa141de59"
for label, result in [("integration", original), ("baseline", baseline)]:
    (EVIDENCE / f"{label}-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
maps = [{r["title"]: r for r in result["results"]} for result in [original, baseline]]
fail_sets = [{title for title, result in mapping.items() if result["outcome"] == "fail"} for mapping in maps]
all_titles = sorted(set(maps[0]) | set(maps[1]))
comparison = {
    "identity": "Exact unique test title; duplicate-title checks pass on both logs. Failure file:line locations normalized only by worktree prefix and retained for cross-check. TAP IDs are coordinates, not identity.",
    "originalSummary": original["summary"],
    "baselineSummary": baseline["summary"],
    "originalSha256": original["sha256"],
    "baselineSha256": baseline["sha256"],
    "equalFailureSets": fail_sets[0] == fail_sets[1],
    "sharedFailures": sorted(fail_sets[0] & fail_sets[1]),
    "integrationOnlyFailures": sorted(fail_sets[0] - fail_sets[1]),
    "baselineOnlyFailures": sorted(fail_sets[1] - fail_sets[0]),
    "integrationOnlyTests": sorted(set(maps[0]) - set(maps[1])),
    "baselineOnlyTests": sorted(set(maps[1]) - set(maps[0])),
    "allResults": [{"title": title, "integration": maps[0].get(title), "baseline": maps[1].get(title)} for title in all_titles],
}
(EVIDENCE / "comparison.json").write_text(json.dumps(comparison, ensure_ascii=False, indent=2) + "\n")
rows = ["| 测试原文标题 | 测试文件与位置 | 整合 R1 | 基线 R2 | 集合判定 |", "|---|---|---|---|---|"]
for title in sorted(fail_sets[0] | fail_sets[1], key=lambda t: (maps[0].get(t) or maps[1][t])["tapId"]):
    a, b = maps[0].get(title), maps[1].get(title)
    location = (a or b)["location"]
    verdict = "共同失败" if title in fail_sets[0] & fail_sets[1] else "整合独有失败" if title in fail_sets[0] else "基线独有失败"
    def cell(result):
        return f'{result["outcome"].upper()} / TAP {result["tapId"]} / L{result["line"]}' if result else "ABSENT"
    rows.append(f'| {title.replace("|", "&#124;")} | `{location}` | {cell(a)} | {cell(b)} | {verdict} |')
(EVIDENCE / "failure-table.md").write_text("\n".join(rows) + "\n")
print(json.dumps({k: v for k, v in comparison.items() if k != "allResults"}, ensure_ascii=False, indent=2))
