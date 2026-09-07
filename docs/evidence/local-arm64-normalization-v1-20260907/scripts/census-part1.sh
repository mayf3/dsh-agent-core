#!/bin/bash
# LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1 — READ-ONLY census part 1
# system identity / PATH / Rosetta / processes / launchd / dual brew
# No install, no upgrade, no restart, no rewrite.
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"

sec(){ echo; echo "===== $1 ====="; }

{
sec DATE; date
sec UNAME_M; uname -m
sec UNAME_A; uname -a
sec SW_VERS; sw_vers
sec CPU_BRAND; sysctl -n machdep.cpu.brand_string
sec HW_MACHINE; sysctl -n hw.machine
sec HW_OPTIONAL_ARM64; sysctl -n hw.optional.arm64 2>/dev/null
sec ROSETTA_OAHD_PROCESS; pgrep -l oahd 2>/dev/null || echo "oahd not running"
sec ROSETTA_INSTALL_DIR; ls -la "/Library/Apple/usr/share/rosetta" 2>/dev/null || echo "rosetta dir absent"
sec ROSETTA_EXEC_TEST; /usr/bin/arch -x86_64 /usr/bin/true 2>&1 && echo "x86_64-exec OK (Rosetta functional)" || echo "x86_64-exec FAILED"
sec ID; id
sec THIS_SHELL_PATH; echo "$PATH"
sec LOGIN_ZSH_PATH; /bin/zsh -lc 'echo "$PATH"'
sec ETC_PATHS; cat /etc/paths
sec ETC_PATHS_D; ls -la /etc/paths.d 2>/dev/null; for f in /etc/paths.d/*; do [ -f "$f" ] && { echo "-- $f"; cat "$f"; }; done 2>/dev/null
sec HW_NCPU_MEMSIZE; sysctl -n hw.ncpu; sysctl -n hw.memsize
} > "$RAW/01-system.txt" 2>&1

ps -axww -o pid,ppid,user,stat,%cpu,%mem,lstart,comm > "$RAW/02-processes.txt" 2>&1

ps -axww -o comm= 2>/dev/null | sort -u > "$RAW/03-process-executables-raw.txt"
: > "$RAW/04-process-executable-arch.txt"
while IFS= read -r exe; do
  case "$exe" in /*) ;; *) continue;; esac
  [ -f "$exe" ] || continue
  rp="$(realpath "$exe" 2>/dev/null || echo "$exe")"
  fa="$(/usr/bin/file -b "$rp" 2>/dev/null)"
  echo "${rp} :: ${fa}" >> "$RAW/04-process-executable-arch.txt"
done < "$RAW/03-process-executables-raw.txt"

{
sec LAUNCHCTL_USER_LIST
launchctl list 2>&1
} > "$RAW/05-launchctl-user.txt"

{
echo "## ~/Library/LaunchAgents"; ls -la "$HOME/Library/LaunchAgents" 2>/dev/null
echo "## /Library/LaunchAgents"; ls -la "/Library/LaunchAgents" 2>/dev/null
echo "## /Library/LaunchDaemons"; ls -la "/Library/LaunchDaemons" 2>/dev/null
} > "$RAW/06-launchd-dirs.txt"

/usr/bin/python3 - "$HOME/Library/LaunchAgents" "/Library/LaunchAgents" "/Library/LaunchDaemons" > "$RAW/07-launchd-plists-sanitized.json" 2>&1 <<'PYEOF'
import sys, os, glob, json, plistlib, re
SECRET = re.compile(r'(token|secret|password|passwd|credential|api[_-]?key|private[_-]?key|auth[_-]?key|bearer)', re.I)
def mask(s):
    if not isinstance(s, str): return s
    if SECRET.search(s):
        return (s[:4] + "...REDACTED...") if len(s) > 8 else "REDACTED"
    out = re.sub(r'((?:token|key|password|secret|bearer)\s*[=:]\s*)(\S+)', r'\1REDACTED', s, flags=re.I)
    out = re.sub(r'\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|xox[bap]-[A-Za-z0-9-]{8,})\b', 'REDACTED', out)
    out = re.sub(r'\b[A-Fa-f0-9]{40,}\b', 'REDACTED_LONG_HEX', out)
    return out
docs=[]
for d in sys.argv[1:]:
    for p in sorted(glob.glob(os.path.join(d,'*.plist'))):
        try:
            with open(p,'rb') as f: pl=plistlib.load(f)
            def clean(o):
                if isinstance(o,str): return mask(o)
                if isinstance(o,list): return [clean(x) for x in o]
                if isinstance(o,dict): return {k:clean(v) for k,v in o.items()}
                return o
            docs.append({"path":p,"content":clean(pl)})
        except Exception as e:
            docs.append({"path":p,"error":str(e)})
print(json.dumps(docs,indent=1,default=str))
PYEOF

/usr/bin/python3 - > "$RAW/08-launchd-executables-arch.txt" 2>&1 <<'PYEOF'
import json,subprocess,os
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"
data=json.load(open(RAW+"/07-launchd-plists-sanitized.json"))
for doc in data:
    if "error" in doc:
        print(f'{doc["path"]} :: PARSE_ERROR'); continue
    pa=doc["content"].get("ProgramArguments") or []
    prog=doc["content"].get("Program") or (pa[0] if pa else None)
    if not prog:
        print(f'{doc["path"]} :: NO_PROGRAM'); continue
    exe=prog
    arch="not-absolute-or-missing"
    if os.path.isabs(exe) and os.path.isfile(exe):
        try: arch=subprocess.run(["/usr/bin/file","-b",exe],capture_output=True,text=True).stdout.strip()[:200]
        except Exception as e: arch=f"err {e}"
    print(f'{doc["path"]} :: {prog} :: {arch}')
PYEOF

{
sec ARM_BREW_VERSION; /opt/homebrew/bin/brew --version 2>&1 | head -3
sec ARM_BREW_PREFIX; /opt/homebrew/bin/brew --prefix 2>&1
sec INTEL_BREW_VERSION; /usr/local/bin/brew --version 2>&1 | head -3
sec INTEL_BREW_PREFIX; /usr/local/bin/brew --prefix 2>&1
} > "$RAW/09-brew-versions.txt"

/opt/homebrew/bin/brew config > "$RAW/10-arm-brew-config.txt" 2>&1
/usr/local/bin/brew config > "$RAW/11-intel-brew-config.txt" 2>&1
/opt/homebrew/bin/brew services list > "$RAW/12-arm-brew-services.txt" 2>&1
/usr/local/bin/brew services list > "$RAW/13-intel-brew-services.txt" 2>&1
/opt/homebrew/bin/brew list --versions > "$RAW/14-arm-brew-formulae.txt" 2>&1
/usr/local/bin/brew list --versions > "$RAW/15-intel-brew-formulae.txt" 2>&1
/opt/homebrew/bin/brew list --cask --versions > "$RAW/16-arm-brew-casks.txt" 2>&1
/usr/local/bin/brew list --cask --versions > "$RAW/17-intel-brew-casks.txt" 2>&1

{
sec LISTEN_TCP
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null
sec UDP_HEAD50
lsof -nP -iUDP 2>/dev/null | head -50
} > "$RAW/18-ports.txt"

echo "PART1 DONE"
