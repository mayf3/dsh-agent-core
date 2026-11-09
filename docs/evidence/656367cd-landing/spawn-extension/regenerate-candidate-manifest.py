#!/usr/bin/env python3
"""Regenerate candidate-manifest.json after the v3 third-file (spawn.js) extension.

Walks the frozen candidate copy at .build-scratch/656367cd-landing/candidate/app,
emitting the same entry shape as the v2 manifest (path/mode/kind[/size/sha256]),
sorted by path. Then cross-checks against installed-manifest.json: identical
length, and exactly the delta.json paths differ.
"""
import json
import os
import stat

HERE = os.path.dirname(os.path.abspath(__file__))
WORKTREE = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
CAND = os.path.join(
    WORKTREE, ".build-scratch", "656367cd-landing", "candidate", "app")
INSTALLED_MANIFEST = os.path.join(HERE, "..", "installed-manifest.json")
CANDIDATE_MANIFEST = os.path.join(HERE, "..", "candidate-manifest.json")
DELTA = os.path.join(HERE, "..", "delta.json")


def build(root):
    entries = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for name in sorted(dirnames + filenames):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            st = os.lstat(full)
            mode = oct(stat.S_IMODE(st.st_mode))
            if stat.S_ISLNK(st.st_mode):
                entries.append({
                    "path": rel, "mode": mode, "kind": "symlink",
                    "target": os.readlink(full),
                })
            elif stat.S_ISDIR(st.st_mode):
                entries.append({"path": rel, "mode": mode, "kind": "directory"})
            else:
                import hashlib
                digest = hashlib.sha256(open(full, "rb").read()).hexdigest()
                entries.append({
                    "path": rel, "mode": mode, "kind": "file",
                    "size": st.st_size, "sha256": digest,
                })
    entries.sort(key=lambda e: e["path"])
    return entries


def main():
    entries = build(CAND)
    with open(CANDIDATE_MANIFEST, "w") as f:
        json.dump(entries, f, indent=1, ensure_ascii=False)
        f.write("\n")
    installed = json.load(open(INSTALLED_MANIFEST))
    delta_paths = {d["path"] for d in json.load(open(DELTA))}
    ins_by_path = {e["path"]: e for e in installed}
    cand_by_path = {e["path"]: e for e in entries}
    assert len(installed) == len(entries), (len(installed), len(entries))
    only_inst = sorted(set(ins_by_path) - set(cand_by_path))
    only_cand = sorted(set(cand_by_path) - set(ins_by_path))
    assert not only_inst and not only_cand, (only_inst, only_cand)
    differing = sorted(
        p for p in ins_by_path
        if ins_by_path[p] != cand_by_path[p])
    assert set(differing) == delta_paths, (differing, delta_paths)
    print(json.dumps({
        "manifestEntries": len(entries),
        "differingPaths": differing,
        "matchesDeltaJson": True,
    }, indent=1))


if __name__ == "__main__":
    main()
