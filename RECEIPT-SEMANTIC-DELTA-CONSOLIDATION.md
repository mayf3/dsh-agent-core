# RECEIPT — SEMANTIC-DELTA-CONSOLIDATION

状态：**COMPLETED_DOCUMENT_DELIVERY**。R1 链接检查 rc1 保留为历史事实；R2 修正后检查 rc0，评估文档已 commit/push，并创建 [PR #653](https://github.com/mayf3/dsh-agent-core/pull/653)，base main，OPEN / 未合并；本收据随后以仅收据提交归档。不是产品接受、实现或生产完成收据。

- 执行授权：当前用户「R2续派(机械假阳性自动继续)」①修正检查方式并登记坐标/理由，不得改评估正文语义；②链接检查 rc0 后 commit 到 `docs/semantic-delta-consolidation`、push、`gh pr create --base main`，不合并，完成 RECEIPT；零生产写入，失败即停。原 Brief 和 Owner 预授权 V2 §5 的文档边界继续有效。
- worktree：`/private/tmp/h1377-minimpl`；branch：`docs/semantic-delta-consolidation`；parent / BASE：`2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`。R2 只读核得 remote main 仍是该 SHA。
- 续接路线：`schema_version=2`；沿用正文 §7 的 `REUSE / BRIEF / DURABLE`、investigation-only 路线。没有新产品语义、Spec 或实现工作；允许文档发布，不允许 merge / 产品实现 / 生产操作。
- [评估正文](SEMANTIC-DELTA-CONSOLIDATION.md) 整份字节冻结：SHA256 `281eb6b0543af493cf86faa2cba07907191d18abb10ba07e45c3d51b25abbc69`，Git blob `aefe90a08084d5a865e5669617ef8514ca317d7a`。结论仍为两处独立语义缺口共用系统 Assistance 机制；仅加第二 reason 不覆盖 #1377，保持两份提案边界，不合并为一提案。
- [provenance](docs/reports/semantic-delta-consolidation-20261107/source-provenance.json) 的 22 项来源与 [Svc/Owner 选中项](docs/reports/semantic-delta-consolidation-20261107/paired-source-observations.json) 均保留 R1 原字节。R2 只改本收据；评估正文、三份输入原件/快照、两份来源 JSON 均不改。原 R1 停点文件留在本 worktree，不改成已关闭，也不把未跟踪文件加入发布。

## 链接检查修正：范围、坐标与理由

R1 原检查把七文件中的快照 Markdown 也按 `((root/p).parent/target.split('#')[0]).exists()` 解析，首次遇到 `docs/reports/semantic-delta-consolidation-20261107/STOPPED-1377-MINIMPL.md:93` 的 `.agents/skills/spec-governance/SKILL.md` 即 **rc1**，后续 staged whitespace/integrity 未执行；本收据不把当时未执行项改记 PASS。

R2 采用用户允许的「跳过原字节快照内相对链接，只查真实新增正文链接」。跳过集合只取 provenance 中三个 `kind=local-input-byte-copy` 的精确 `snapshot` 路径，不是排除整个 `docs/reports/`。先核对三个原件与快照字节及声明的 SHA256，再跳过其内部链接；因此历史 Evidence 不被为适应复制目录而重写，原件上下文也不会被错误宣告损坏。

| 快照坐标 | 原目录上下文 / 处置理由 |
|---|---|
| `docs/reports/semantic-delta-consolidation-20261107/STOPPED-1377-MINIMPL.md:93`，`.agents/skills/spec-governance/SKILL.md` | 原件 `/private/tmp/h1377-minimpl/STOPPED-1377-MINIMPL.md:93`；应解析为 `/private/tmp/h1377-minimpl/.agents/skills/spec-governance/SKILL.md`，R2 实核存在；按复制目录解析是假阳性 |
| 同一快照 `:93`，`.agents/skills/spec-governance/modes/PREFLIGHT.md` | 应解析为 `/private/tmp/h1377-minimpl/.agents/skills/spec-governance/modes/PREFLIGHT.md`，R2 实核存在；与上一项同一原文行，R1 尚未扫描至此；同样跳过且不改字节 |
| 同目录 `BRIEF-1377-MINIMPL.md`、`BRIEF-SEMANTIC-DELTA-CONSOLIDATION.md` | 同为 provenance 明示的原字节快照；本次未发现 Markdown 相对链接，仍显式列入同一快照规则 |

真正新增 Markdown 仅正文与本收据；逐行扫描 Markdown inline links（跳过 fenced code），每个相对文件目标按其实际文档目录解析，同时要求目标存在且在 Git candidate 中。两份 JSON 无 Markdown 正文链接。HTTPS/mailto 与页内 anchor 不属本次相对文件路径门，不声称网络可达或 anchor 完整性 PASS。快照从新正文被引用的路径仍正常检查。

本次实际检查脚本保存在 `/private/tmp/h1377-r2-xkcdliv6/check_documents.py`，SHA256 `53b591d669c2940121a9a26fcd22b263cd2e3d41e3d72861621d4f43e795e6dc`。以下为同一脚本原文，可在仓库根目录复现；七文件集合、22 项来源与正文不变也包含在检查中：

```python
from pathlib import Path
import hashlib, json, re, subprocess

root = Path.cwd().resolve()
base = "2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648"
folder = Path("docs/reports/semantic-delta-consolidation-20261107")
provenance = json.loads((folder / "source-provenance.json").read_text())
snapshots = {s["snapshot"]: s for s in provenance["sources"]
             if s["kind"] == "local-input-byte-copy"}
authored = ["SEMANTIC-DELTA-CONSOLIDATION.md",
            "RECEIPT-SEMANTIC-DELTA-CONSOLIDATION.md"]
expected = set(authored) | set(snapshots) | {
    str(folder / "source-provenance.json"),
    str(folder / "paired-source-observations.json")}
def git(*args):
    return subprocess.check_output(["git", *args])
changed = set(git("diff", "--name-only", base, "--").decode().splitlines())
assert changed == expected, ("scope", sorted(changed))
tracked = set(git("ls-files", "-z").decode().rstrip("\0").split("\0"))
assert hashlib.sha256(Path(authored[0]).read_bytes()).hexdigest() == (
    "281eb6b0543af493cf86faa2cba07907191d18abb10ba07e45c3d51b25abbc69")
for s in provenance["sources"]:
    if s["kind"] == "local-input-byte-copy":
        data = Path(s["snapshot"]).read_bytes()
        assert data == Path(s["source"]).read_bytes(), s["snapshot"]
    else:
        data = git("show", s["revision"] + ":" + s["path"])
        assert git("rev-parse", s["revision"] + ":" + s["path"]).decode().strip() == s["blob"]
    assert hashlib.sha256(data).hexdigest() == s["sha256"], s
checked = []
external_count = 0
for name in authored:
    fence = None
    for number, line in enumerate(Path(name).read_text().splitlines(), 1):
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
                external_count += 1
                continue
            path = target.split("#", 1)[0]
            resolved = (root / name).parent.joinpath(path).resolve()
            relative = resolved.relative_to(root).as_posix()
            assert resolved.is_file() and relative in tracked, (name, number, target)
            checked.append({"file": name, "line": number, "target": target,
                            "resolved": relative})
print(json.dumps({"result": "PASS", "scope_files": len(expected),
                  "source_checks": len(provenance["sources"]),
                  "report_sha256": hashlib.sha256(Path(authored[0]).read_bytes()).hexdigest(),
                  "skipped_byte_snapshots": sorted(snapshots),
                  "checked_relative_links": checked,
                  "external_or_anchor_links_outside_filesystem_gate": external_count},
                 ensure_ascii=False, indent=2))
```

## 执行结果与独立审查

| 检查 | R2 实际结果 / 范围 |
|---|---|
| accepted vendored integrity | `python3 .agents/tools/verify_governance.py --target . --require-accepted` rc0；本轮实核，不改治理工具 |
| 固定来源 | 独立 reviewer 已实核 22 项 provenance PASS；Svc 固定 revision 全文/blob/hash/摘录与 Owner 选中项 canonical hash 匹配 |
| scope + hash + 修正后的 Markdown 相对链接 | `python3 /private/tmp/h1377-r2-xkcdliv6/check_documents.py` rc0：七文件、22 项来源、正文 SHA256 和三份原件/快照均通过；8 个新增相对文件链接 PASS，精确跳过上述三份快照内部链接 |
| whitespace / accepted integrity | R2 `git diff --check`、`git diff --cached --check` 均 rc0；accepted integrity rc0；提交前最终 staged 内容也已实际 rc0，未沿用 R1 未执行结果 |
| 独立文档初审 | `/root/document_review`，非正文/来源作者，只读 FULL INITIAL_REVIEW PASS；`FROZEN_BLOCKER_UNION=[]`；正文 SHA256 如上，初始 index tree `7e4905eab60d33639bcfa2593b9d2f4e7db14139`，BASE=HEAD=parent。第一次 receipt-only delta 复核 PASS、BLOCKERS=0，reviewed tree `320ffaf44d3f91b46fb5f1182626d0628dff206d`，receipt SHA256 `326a19c1a5de69f09182f7f6361ac5d8f8f0c84ffaeff7b826a585b3d1bdef95`；reviewer 独立运行同一 checker rc0、嵌入脚本字节一致。之后仅登记实际复核/发布事实；精确最终 Head delta 结果与远端绑定登记在 PR #653 发布记录，不用初审或此收据的自引用 SHA 冒充最终复核 |
| 产品测试 / RED-GREEN / observation-cas / 跨服务 E2E | NOT_RUN；本轮无实现，不复跑已通过产品门，不把历史 PASS 当本轮 PASS |
| structure runner | NOT_RUN；local governance 明示 V3 verifier qualification 待另项任务；本次不适配 runner |
| 生产读写、部署、Owner/Assistance发送 | NOT_RUN / 零调用；零业务 replay / fence / identity / Grant 写入 |

## 发布记录

- `git commit -m "docs: assess separate responsibility handoff semantic gaps"` rc0：`3ca4afa297e44828d83fc2e31b64a1d27610b4e6`，tree `bcec9861e865f7fb74824e11da7e587366b2439a`，七份文档；正文和五份来源均为 R1 原字节。
- `git push -u origin docs/semantic-delta-consolidation` rc0，创建同名远端分支，未 force push。
- `gh pr create --repo mayf3/dsh-agent-core --base main --head docs/semantic-delta-consolidation --title "docs: distinguish independent responsibility handoff semantic gaps" --body-file /private/tmp/h1377-r2-xkcdliv6/pr-body.md` rc0，返回 PR #653。
- 创建后 `gh pr view 653` 实读：`state=OPEN`，`baseRefName=main`，`headRefName=docs/semantic-delta-consolidation`，`headRefOid=3ca4afa297e44828d83fc2e31b64a1d27610b4e6`，`mergedAt=null`，`autoMergeRequest=null`。没有 merge、auto-merge 或产品激活动作。
- 本收据的完成记录在后续 receipt-only commit 中持久化；自身最终 commit SHA 不写入自身字节。精确最终 Head、最终远端读回及独立 final-head delta 以 PR #653 发布记录绑定；该变更只归档已经发生的检查/发布事实，不重写评估语义。
- 原始三份输入与 `STOPPED-SEMANTIC-DELTA-CONSOLIDATION.md` 仍为未跟踪本地输入/历史停点，不误装入 PR。原 #1377 停点保持。

若后续归档、push 或必需复核失败，立即停止并如实登记；不能以此前成功掩盖最终交付失败。

`IMPLEMENTATION_ALLOWED=NO`，`MERGE_READY=NO`，`OPERATION_ALLOWED=NO`。文档发布不接受新语义、不关闭 #1377 或原 MINIMPL 停点；安装/运行时/业务/无人值守结果仍为 NOT_RUN / UNKNOWN。
