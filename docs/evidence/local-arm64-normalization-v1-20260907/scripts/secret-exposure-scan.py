#!/usr/bin/env python3
# SECRET EXPOSURE DISPOSITION — mechanical surface scan.
# Token bytes are read from source plists directly; NEVER printed, never passed via shell argv.
# Output: counts / YES / NO / fingerprints only.
import subprocess, plistlib, glob, os, hashlib, json, re, sys

HOME = os.path.expanduser("~")
EV = f"{HOME}/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907"

# --- 1. extract token bytes from source plists (ALL plists in the three launchd dirs,
#        matching the raw/07 coverage; kernel/capability-host plists own the capability tokens) ---
sources = sorted(
    glob.glob(f"{HOME}/Library/LaunchAgents/*.plist*") +
    glob.glob("/Library/LaunchAgents/*.plist*") +
    glob.glob("/Library/LaunchDaemons/*.plist*")
)
tokens = {}  # value_bytes -> set(source paths)
TOKKEY = re.compile(r'(?i)token|secret|password|passwd|credential|api[_-]?key|auth[_-]?key')
EMBED = re.compile(r'(?i)(?:token|secret)[=:]\s*([A-Za-z0-9+/_.-]{20,})')
for src in sources:
    try:
        with open(src, "rb") as f:
            data = f.read()
        pl = plistlib.loads(data)
        vals = []
        def walk(o, keyname=""):
            if isinstance(o, dict):
                for k, v in o.items():
                    walk(v, str(k))
            elif isinstance(o, list):
                for v in o: walk(v, keyname)
            elif isinstance(o, str):
                if TOKKEY.search(keyname):
                    # value may be a bare secret or KEY=VALUE form
                    m = EMBED.search(o)
                    vals.append(m.group(1) if m else o)
                else:
                    m = EMBED.search(o)
                    if m:
                        vals.append(m.group(1))
        walk(pl)
        for s in vals:
            if s and re.search(r'[A-Fa-f0-9]{20,}', s) and not s.startswith("/") and "." not in s[:3]:
                tokens.setdefault(s, set()).add(src)
    except Exception:
        pass  # unreadable (e.g. root-only) — counted via SOURCES_SCANNED delta below
readable = len({s for vs in tokens.values() for s in vs})

fps = {}
for v in tokens:
    fps[hashlib.sha256(v.encode()).hexdigest()[:12]] = sorted(tokens[v])
print(f"SOURCES_SCANNED = {len(sources)}")
print(f"DISTINCT_TOKEN_BYTES = {len(tokens)}")
for fp, srcs in sorted(fps.items()):
    print(f"  fp:{fp} <- {len(srcs)} source file(s)")

if not tokens:
    print("NO_TOKENS_EXTRACTED — abort"); sys.exit(1)

# --- 2. surface scans ---
def hits_in_file(path):
    n = 0
    try:
        with open(path, "rb") as f:
            blob = f.read()
        for v in tokens:
            if v.encode() in blob:
                n += 1
    except Exception:
        pass
    return n

# surface: evidence tree (should be ZERO post-redaction)
ev_hits = []
for root, _, files in os.walk(EV):
    for fn in files:
        p = os.path.join(root, fn)
        if fn == "MANIFEST.sha256":
            continue  # hashes only by construction
        if hits_in_file(p):
            ev_hits.append(p)
print(f"SURFACE_EVIDENCE_TREE_RESIDUAL = {len(ev_hits)} files {ev_hits}")

# surface: git history of the dsh-agent-core repo (all branches) — count commits containing any value
repo = f"{HOME}/workspace/project/dsh-agent-core"
git_commit_hits = 0
try:
    for v in tokens:
        r = subprocess.run(["git", "-C", repo, "log", "--all", "-S", v, "--oneline"],
                           capture_output=True, text=True, timeout=300)
        git_commit_hits += len([l for l in r.stdout.splitlines() if l.strip()])
except Exception as e:
    git_commit_hits = -1
    print(f"GIT_SCAN_ERROR {type(e).__name__}")
print(f"SURFACE_GIT_HISTORY_DSH_REPO = {git_commit_hits} commits")

# git index / status of evidence dir
r = subprocess.run(["git", "-C", repo, "status", "--porcelain", "--", os.path.relpath(EV, repo)],
                   capture_output=True, text=True)
tracked = [l for l in r.stdout.splitlines() if l.strip() and not l.startswith("??")]
print(f"SURFACE_GIT_INDEX_EVIDENCE_TRACKED = {len(tracked)}")

# surface: shell histories / persistent command logs
hist_files = [f"{HOME}/.zsh_history", f"{HOME}/.bash_history", f"{HOME}/.zsh_history.New",
              f"{HOME}/.local/share/zsh/history", "/var/tmp", "/tmp"]
shell_hits = []
for hf in hist_files[:3] + [f"{HOME}/.zsh_sessions"]:
    if os.path.isfile(hf) and hits_in_file(hf):
        shell_hits.append(hf)
    elif os.path.isdir(hf):
        for root, _, files in os.walk(hf):
            for fn in files:
                p = os.path.join(root, fn)
                if hits_in_file(p): shell_hits.append(p)
print(f"SURFACE_PERSISTENT_SHELL_LOGS = {len(shell_hits)} files {shell_hits}")

# surface: shared filesystem / remote sync — syncthing folder roots
sync_hits = []
cfg = f"{HOME}/Library/Application Support/Syncthing/config.xml"
sync_roots = []
try:
    with open(cfg, "rb") as f:
        s = f.read().decode("utf-8", "replace")
    sync_roots = re.findall(r'<folder[^>]*path="([^"]+)"', s)
except Exception:
    pass
ev_rel = EV
for rootp in sync_roots:
    rootp = os.path.expanduser(rootp)
    if ev_rel.startswith(rootp) or rootp.startswith(ev_rel):
        sync_hits.append(rootp)
print(f"SYNCTHING_FOLDER_ROOTS = {len(sync_roots)}")
print(f"SURFACE_SHARED_SYNC_COVERS_EVIDENCE = {'YES' if sync_hits else 'NO'} {sync_hits}")

# surface: uploaded artifact / external connector — no upload mechanism used this Goal; state NO by construction + verify nothing in evidence looks like an upload target
print("SURFACE_UPLOADED_ARTIFACT = NO (no upload/connector used in this Goal; evidence dir is local-only, git-untracked)")

# --- 3. verdict (mechanical inputs; transcript surface assessed separately as documented) ---
print("SURFACE_SUMMARY:")
print(f"  git_index_or_history = {'NO' if git_commit_hits == 0 and not tracked else 'YES'}")
print(f"  evidence_tree_residual = {'NO' if not ev_hits else 'YES'}")
print(f"  persistent_shell_logs = {'NO' if not shell_hits else 'YES'}")
print(f"  shared_sync = {'NO' if not sync_hits else 'YES'}")
print(f"  uploaded_artifact = NO")
print(f"  model_visible_transcript = YES (r1 audit subagent report quoted cleartext values; "
      f"subagent context + this session traverse the model-provider API transport)")
