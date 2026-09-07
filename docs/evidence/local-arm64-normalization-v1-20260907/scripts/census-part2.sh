#!/bin/bash
# LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1 — READ-ONLY census part 2
# critical command resolution / bin inventories / native modules / hardcoded /usr/local
# / env files (redacted) / stateful data roots / GUI apps
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"

# --- 19: critical command resolution (login zsh) ---
CMDS="node npm npx yarn pnpm python3 python python3.9 python3.10 python3.11 python3.12 python3.13 pip3 pipx uv uvx git gh glab wget curl tmux deno bun starship cmake ninja make gcc g++ clang clang++ psql pg_ctl pg_dump redis-server redis-cli nginx syncthing tailscale tailscaled cloudflared ngrok docker ffmpeg ffprobe pandoc tesseract jq yq fzf rg fd bat eza exa htop sqlite3 mysql mongod ssh gpg op age brew arch zoxide atuin claude codex go rustc cargo ruby gem php composer perl java javac mvn gradle ant dotnet R Rscript latex pdflatex openssl sshpass mosquitto_sub tor aria2c axel htop btop ncdu duf lazygit delta batcat exiftool imagemagick convert magick sox"
: > "$RAW/19-critical-command-resolution.txt"
{
echo "# per-command: name | whence-type | resolved | realpath | file-arch"
for c in $CMDS; do
  resolved="$(/bin/zsh -lc "command -v $c" 2>/dev/null)"
  wtype="$(/bin/zsh -ic "whence -w $c" 2>/dev/null | head -1)"
  if [ -n "$resolved" ] && [ -f "$resolved" ]; then
    rp="$(realpath "$resolved" 2>/dev/null || echo "$resolved")"
    fa="$(/usr/bin/file -b "$rp" 2>/dev/null | cut -c1-90)"
    # for universal binaries, record which arch would execute
    if printf '%s' "$fa" | grep -q 'universal'; then
      exearch="$(/usr/bin/arch -arm64 /usr/bin/true 2>/dev/null && echo arm64)"
      fa="universal(would-run:arm64) $(printf '%s' "$fa" | cut -c1-60)"
    fi
    echo "$c | ${wtype:-file} | $resolved | $rp | $fa"
  else
    echo "$c | ${wtype:-not-found} | ${resolved:-NONE} | - | -"
  fi
done
} > "$RAW/19-critical-command-resolution.txt" 2>&1

# --- 20: /usr/local/bin full inventory with arch ---
{
echo "# name | realpath | file-arch"
for f in /usr/local/bin/*; do
  [ -e "$f" ] || continue
  rp="$(realpath "$f" 2>/dev/null || echo "$f")"
  fa="$(/usr/bin/file -b "$rp" 2>/dev/null | cut -c1-80)"
  echo "$(basename "$f") | $rp | $fa"
done
} > "$RAW/20-usrlocal-bin-arch.txt" 2>&1

# --- 21: /opt/homebrew/bin non-arm64 entries + histogram ---
{
echo "# /opt/homebrew/bin entries that are NOT arm64-native"
for f in /opt/homebrew/bin/*; do
  [ -e "$f" ] || continue
  rp="$(realpath "$f" 2>/dev/null || echo "$f")"
  [ -f "$rp" ] || continue
  fa="$(/usr/bin/file -b "$rp" 2>/dev/null)"
  case "$fa" in
    *arm64*) ;;
    *) echo "$(basename "$f") | $rp | $(printf '%s' "$fa" | cut -c1-80)" ;;
  esac
done
} > "$RAW/21-homebrew-bin-nonarm64.txt" 2>&1

{
echo "## histograms"
echo "-- /usr/local/bin arch histogram:"
awk -F' \\| ' '{print $3}' "$RAW/20-usrlocal-bin-arch.txt" 2>/dev/null | \
  sed -E 's/(Mach-O [0-9]+-bit executable[^,]*).*/\1/; s/^Mach-O 64-bit executable x86_64.*/x86_64/; s/^Mach-O 64-bit executable arm64.*/arm64/; s/^Mach-O universal.*/universal/; s/^a zsh script.*/zsh-script/; s/^POSIX shell script.*/sh-script/; s/^Python script.*/python-script/; s/^Bourne-Again shell script.*/bash-script/; s/^perl.*/perl-script/' | sort | uniq -c | sort -rn
echo "-- /opt/homebrew/bin arch histogram:"
cnt_arm=0; cnt_other=0; cnt_total=0
for f in /opt/homebrew/bin/*; do
  [ -f "$f" ] || continue
  rp="$(realpath "$f" 2>/dev/null || echo "$f")"
  fa="$(/usr/bin/file -b "$rp" 2>/dev/null)"
  cnt_total=$((cnt_total+1))
  case "$fa" in *arm64*) cnt_arm=$((cnt_arm+1));; *) cnt_other=$((cnt_other+1));; esac
done
echo "total=$cnt_total arm64=$cnt_arm other=$cnt_other"
} > "$RAW/22-bin-histograms.txt" 2>&1

# --- 23: /usr/local top-level + Cellar + opt links ---
{
echo "## /usr/local top-level"; ls -la /usr/local 2>/dev/null
echo "## /usr/local/Cellar"; ls -la /usr/local/Cellar 2>/dev/null
echo "## /usr/local/opt"; ls -la /usr/local/opt 2>/dev/null
echo "## /opt/homebrew/Cellar"; ls /opt/homebrew/Cellar 2>/dev/null
} > "$RAW/23-usrlocal-tree.txt" 2>&1

# --- 24: node global modules native addons ---
{
echo "## node binaries"
for nb in /opt/homebrew/bin/node /usr/local/bin/node /usr/local/opt/node*/bin/node; do
  [ -f "$nb" ] && echo "$nb :: $(/usr/bin/file -b "$nb" 2>/dev/null | cut -c1-60)"
done
echo "## ARM brew global node_modules *.node"
find /opt/homebrew/lib/node_modules -name '*.node' -type f 2>/dev/null | head -100 | while IFS= read -r f; do
  echo "$f :: $(/usr/bin/file -b "$f" 2>/dev/null | grep -oE '\b(arm64|x86_64)\b' | sort -u | tr '\n' ',')"
done
echo "## Intel brew global node_modules *.node"
find /usr/local/lib/node_modules -name '*.node' -type f 2>/dev/null | head -100 | while IFS= read -r f; do
  echo "$f :: $(/usr/bin/file -b "$f" 2>/dev/null | grep -oE '\b(arm64|x86_64)\b' | sort -u | tr '\n' ',')"
done
echo "## ~/.npm-global / ~/.pnpm-store presence"
ls -lad "$HOME/.npm-global" "$HOME/.pnpm-store" "$HOME/Library/pnpm" 2>/dev/null
} > "$RAW/24-node-native-modules.txt" 2>&1

# --- 25: python interpreters + site-packages native ext arch sample ---
{
for py in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3 /usr/local/bin/python3.9 /usr/local/opt/python*/bin/python3*; do
  [ -f "$py" ] || continue
  echo "== $py :: $(/usr/bin/file -b "$py" 2>/dev/null | cut -c1-70)"
  "$py" -c 'import sys,sysconfig; print("version:",sys.version.split()[0]); print("prefix:",sys.prefix)' 2>/dev/null
  sp="$("$py" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])' 2>/dev/null)"
  [ -n "$sp" ] && {
    echo "site-packages: $sp"
    find "$sp" -name '*.so' -type f 2>/dev/null | head -40 | while IFS= read -r so; do
      echo "  $(basename "$so") :: $(/usr/bin/file -b "$so" 2>/dev/null | grep -oE '\b(arm64|x86_64)\b' | sort -u | tr '\n' ',')"
    done
  }
  echo
done
echo "## pyenv/conda presence"
ls -lad "$HOME/.pyenv" "$HOME/miniconda3" "$HOME/anaconda3" "$HOME/.virtualenvs" 2>/dev/null
} > "$RAW/25-python-closures.txt" 2>&1

# --- 26: hardcoded /usr/local & rosetta forcing in launchd + profiles + IDE ---
{
echo "## launchd plists referencing /usr/local or arch -x86_64"
grep -RIlE '/usr/local|arch -x86_64' "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons 2>/dev/null
echo "## matching lines (redacted pass in separate file)"
for f in "$HOME/.zshenv" "$HOME/.zprofile" "$HOME/.zshrc" "$HOME/.zlogin" "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc"; do
  [ -f "$f" ] || continue
  echo "-- $f (sha256 $(shasum -a 256 "$f" | cut -d' ' -f1), $(wc -l < "$f" | tr -d ' ') lines)"
  grep -nE '/usr/local|/opt/homebrew|arch -x86_64|rosetta|PATH=' "$f" 2>/dev/null | \
    sed -E 's/(token|secret|password|credential|key)[=:][^ ]*/\1=REDACTED/Ig'
done
echo "## IDE settings"
for f in "$HOME/Library/Application Support/Code/User/settings.json" \
         "$HOME/Library/Application Support/Cursor/User/settings.json" \
         "$HOME/.config/Code/User/settings.json"; do
  [ -f "$f" ] || continue
  echo "-- $f"
  grep -nE '/usr/local|/opt/homebrew|arch -x86_64' "$f" 2>/dev/null | head -20
done
} > "$RAW/26-hardcoded-usrlocal.txt" 2>&1

# --- 27: repo deployment scripts referencing /usr/local (bounded) ---
{
if command -v rg >/dev/null 2>&1; then
  echo "## rg scan of ~/workspace/project (sh/plist/mk/yaml/json/ts/js), excludes node_modules/.git"
  rg -l --no-messages --glob '!**/node_modules/**' --glob '!**/.git/**' \
     --glob '*.{sh,plist,mk,yaml,yml,json,ts,js}' --max-depth 6 \
     -e '/usr/local/bin' -e '/usr/local/opt' -e 'arch -x86_64' \
     "$HOME/workspace/project" 2>/dev/null | head -150
  echo "## hit count:"
  rg -l --no-messages --glob '!**/node_modules/**' --glob '!**/.git/**' \
     --glob '*.{sh,plist,mk,yaml,yml,json,ts,js}' --max-depth 6 \
     -e '/usr/local/bin' -e '/usr/local/opt' -e 'arch -x86_64' \
     "$HOME/workspace/project" 2>/dev/null | wc -l
else
  echo "rg not available"
fi
} > "$RAW/27-repo-scripts-usrlocal.txt" 2>&1

# --- 28: stateful service data roots ---
{
echo "## postgres data dirs"
ls -lad /usr/local/var/postgres* /opt/homebrew/var/postgres* /usr/local/var/log/postgres* 2>/dev/null
for d in /usr/local/var/postgres* /opt/homebrew/var/postgres*; do
  [ -f "$d/PG_VERSION" ] && echo "$d PG_VERSION=$(cat "$d/PG_VERSION")  postmaster.pid=$( [ -f "$d/postmaster.pid" ] && echo PRESENT || echo absent )"
done
echo "## mysql/mariadb/redis/memcached data"
ls -lad /usr/local/var/mysql* /opt/homebrew/var/mysql* /usr/local/var/redis* /opt/homebrew/var/redis* /usr/local/var/db/redis* /opt/homebrew/var/db/redis* /usr/local/var/memcached* 2>/dev/null
echo "## syncthing config presence (metadata only)"
ls -la "$HOME/Library/Application Support/Syncthing" 2>/dev/null | head -30
cfg="$HOME/Library/Application Support/Syncthing/config.xml"
[ -f "$cfg" ] && echo "config.xml sha256=$(shasum -a 256 "$cfg" | cut -d' ' -f1) size=$(wc -c < "$cfg" | tr -d ' ')"
echo "## tailscale state presence"
ls -lad "$HOME/Library/Tailscale" /var/run/tailscaled.socket /usr/local/var/run/tailscale 2>/dev/null
echo "## docker data"
ls -lad "$HOME/Library/Containers/com.docker.docker" "$HOME/.docker" 2>/dev/null
} > "$RAW/29-stateful-data-roots.txt" 2>&1

# --- 30: GUI applications arch inventory (informational) ---
{
echo "# app | executable | arch"
for app in /Applications/*.app "$HOME/Applications"/*.app; do
  [ -d "$app" ] || continue
  info="$app/Contents/Info.plist"
  [ -f "$info" ] || continue
  exe="$(/usr/bin/plutil -extract CFBundleExecutable raw "$info" 2>/dev/null)"
  [ -n "$exe" ] || continue
  bin="$app/Contents/MacOS/$exe"
  [ -f "$bin" ] || continue
  fa="$(/usr/bin/file -b "$bin" 2>/dev/null | cut -c1-60)"
  echo "$(basename "$app") | $exe | $fa"
done
} > "$RAW/30-gui-apps-arch.txt" 2>&1

# --- 31: DSH production runtime observation (F-class evidence only, no mutation) ---
{
echo "## node-family processes from census (reference 02-processes.txt)"
ps -axww -o pid,ppid,user,comm | grep -iE 'node|electron|python|postgres|syncthing|tailscale|redis' | grep -v grep
} > "$RAW/31-dsh-runtime-observation.txt" 2>&1

echo "PART2 DONE"
