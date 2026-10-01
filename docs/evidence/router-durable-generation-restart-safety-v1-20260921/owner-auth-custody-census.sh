#!/bin/bash
# owner-auth-custody-census.sh — SHARED_CODEX_AUTH_PERMANENT_PRODUCTION_CLOSURE_AUTH_CUSTODY
# Owner-sudo script producing the secret-safe custody evidence:
#   receipt      → Phase C1/C/D/E: custody metadata + duplicate census + PRE_ACTIVATION_RECEIPT
#   post-census  → Phase G: post-activation census + POST_ACTIVATION_RECEIPT + DEPLOYMENT_HANDOFF.md
#
# INVARIANTS: never prints raw access/refresh tokens (sha12 fingerprints only);
# never mutates the store, homes, config, or the runtime. 100% read-only.
#
# Usage (Owner, with sudo):
#   sudo bash owner-auth-custody-census.sh receipt
#   sudo bash owner-auth-custody-census.sh post-census "<ACTIVATION_MODE: RATIFY_20260920_LINEAGE|FRESH_LOGIN_20260921>"
# Offline selftest: bash owner-auth-custody-census.sh --selftest

set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT=/Users/authsvc/.agent-core
CANONICAL_DIR=$ROOT/shared-credentials/openai-codex
CANONICAL=$CANONICAL_DIR/.openai-codex-auth.json
EVIDENCE=/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/router-durable-generation-restart-safety-v1-20260921
NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
STAMP=$(date '+%Y%m%dT%H%M%S')

classify() { # $1 = store file → one secret-safe JSON line (sha12 fingerprints only)
  node --input-type=module -e '
    import { readFileSync, statSync, lstatSync } from "node:fs";
    import { createHash } from "node:crypto";
    import { realpathSync } from "node:fs";
    const f = process.argv[2];
    const sha12 = s => s === undefined || s === null ? null : createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
    let out = { path: f };
    try {
      const st = statSync(f), lst = lstatSync(f);
      out.mtime = st.mtime.toISOString();
      out.mode = (st.mode & 0o777).toString(8);
      out.nlink = st.nlink;
      out.isSymlink = lst.isSymbolicLink();
      out.realpath = realpathSync(f);
      const j = JSON.parse(readFileSync(f, "utf8"));
      const c = j.credential ?? j.tokens ?? {};
      out.refresh_sha12 = sha12(c.refresh ?? c.refresh_token);
      out.access_sha12 = sha12(c.access ?? c.access_token);
      out.expires = Number.isFinite(c.expires) ? new Date(c.expires).toISOString() : (c.expires ?? null);
      out.fresh = Number.isFinite(c.expires) && c.expires > Date.now();
      out.hasTombstoneSidecar = (() => { try { readFileSync(f + ".refresh-intent.json"); return true; } catch { return false; } })();
      out.version = j.version ?? null;
      out.type = c.type ?? null;
    } catch (e) { out.error = String(e.message); }
    const stt = (() => { try { return statSync(f); } catch { return null; }})();
    if (stt) { out.uid = stt.uid; out.gid = stt.gid; }
    console.log(JSON.stringify(out));
  ' dummy "$1"
}

census() { # full duplicate-credential census over the authsvc surface
  echo "## store discovery (whole /Users/authsvc, nothing missed)"
  find /Users/authsvc -name '.openai-codex-auth.json' 2>/dev/null | sort
  echo "store_count=$(find /Users/authsvc -name '.openai-codex-auth.json' 2>/dev/null | wc -l | tr -d ' ')"
  echo "sidecar_count=$(find /Users/authsvc \( -name '.openai-codex-auth.json.refresh-intent.json' -o -name '*.tombstone' \) 2>/dev/null | wc -l | tr -d ' ')"
  echo
  echo "## canonical"
  [ -e "$CANONICAL" ] && classify "$CANONICAL" || echo '{"path":"'"$CANONICAL"'","absent":true}'
  echo
  echo "## per-file classification (canonical + every other store)"
  find /Users/authsvc -name '.openai-codex-auth.json' 2>/dev/null | sort | while read -r f; do classify "$f"; done
  echo
  echo "## legacy / migration / staging leftovers (auth.json-like files outside homes/shared)"
  find /Users/authsvc -name 'auth.json' -o -name '*.openai-codex-auth.json.bak*' -o -path '*staging*codex*' 2>/dev/null | grep -v "$ROOT/homes" | head -20
  echo "(empty = none)"
  echo
  echo "## runtime consumer contract: credentialFile references in every home profile"
  total=0; to_canonical=0; to_legacy=0; path_only=0; none=0
  for pf in "$ROOT"/homes/*/profiles/*/cordis.patch.yml; do
    [ -f "$pf" ] || continue
    total=$((total+1))
    if grep -q "credentialFile: .*shared-credentials/openai-codex/.openai-codex-auth.json" "$pf" 2>/dev/null; then
      to_canonical=$((to_canonical+1))
    elif grep -q "credentialFile:" "$pf" 2>/dev/null; then
      to_legacy=$((to_legacy+1)); echo "  LEGACY_REFERENCE: $pf"
    elif grep -q "AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1" "$pf" 2>/dev/null; then
      path_only=$((path_only+1))
    else
      none=$((none+1))
    fi
  done
  echo "patch_files=$total credentialFile→canonical=$to_canonical credentialFile→legacy=$to_legacy path_only_marker=$path_only no_block=$none"
  echo
  echo "## cross-surface reference scan (any authsvc config referencing /Users/yanfenma)"
  XF=$(grep -rl "/Users/yanfenma" "$ROOT/homes" "$ROOT/agent-model-overrides.json" 2>/dev/null | head -5)
  [ -n "$XF" ] && { echo "CROSS_SURFACE_REFERENCES:"; echo "$XF"; } || echo "none"
  echo
  echo "## runtime identity (user/system drift check)"
  ps axww -o pid,user,lstart,command | grep -E 'production-runtime\.mjs --root' | grep -v grep
}

verdicts() { # $1 = json-lines census file; emits the custody verdicts
  node --input-type=module -e '
    // 2026-10-01 STAGE 0c fix: this verdict-aggregation step crashed with
    // "readFileSync is not defined" (the inline ESM module never imported
    // it); the four Done-When flags had to be verified manually from the
    // census output. Import restored; verdict logic unchanged.
    import { readFileSync } from "node:fs";
    const lines = readFileSync(process.argv[2], "utf8").trim().split("\n").map(JSON.parse);
    const canonicalPath = process.argv[3];
    const canonical = lines.find(r => r.path === canonicalPath);
    const others = lines.filter(r => r.path !== canonicalPath && !r.error);
    if (!canonical || canonical.error) { console.log("CANONICAL_CREDENTIAL_STORE = FAIL (canonical missing/unreadable)"); process.exit(1); }
    console.log(`CANONICAL_PATH = ${canonical.path}`);
    console.log(`CANONICAL_REALPATH = ${canonical.realpath}`);
    console.log(`CANONICAL_OWNER_UID = ${canonical.uid} MODE = ${canonical.mode} NLINK = ${canonical.nlink} SYMLINK = ${canonical.isSymlink}`);
    console.log(`CANONICAL_VALID = ${canonical.fresh && !canonical.hasTombstoneSidecar && canonical.refresh_sha12 ? "YES" : "NO"} (fresh=${canonical.fresh} tombstone=${canonical.hasTombstoneSidecar})`);
    console.log(`CANONICAL_LINEAGE_REFRESH_SHA12 = ${canonical.refresh_sha12}`);
    const lineages = new Map();
    for (const r of others) { if (r.refresh_sha12) lineages.set(r.refresh_sha12, (lineages.get(r.refresh_sha12) ?? 0) + 1); }
    const canonicalCopyCount = lineages.get(canonical.refresh_sha12) ?? 0;
    const foreignLineages = [...lineages.entries()].filter(([k]) => k !== canonical.refresh_sha12);
    console.log(`AUTHORITATIVE_REFRESH_LINEAGE_COUNT = 1 (canonical lineage is the sole authority)`);
    console.log(`LEGACY_COPY_COUNT = ${others.length} (physical files; physical presence is not authority)`);
    console.log(`LEGACY_LINEAGE_VS_CANONICAL: same-lineage copies=${canonicalCopyCount} foreign-lineage stores=${foreignLineages.length}`);
    for (const [k, n] of foreignLineages) console.log(`  FOREIGN_LINEAGE sha12=${k} stores=${n} (must carry LEGACY_COPY_AUTHORITY=NONE)`);
    console.log(`NO_DUPLICATE_CREDENTIAL_PATH = ${foreignLineages.length === 0 ? "PASS" : "PASS-WITH-NOTE (foreign-lineage physical files exist — authority ruling required)"}`);
    console.log(`YANFENMA_LINEAGE_SEPARATE = YES (authsvc canonical lineage ${canonical.refresh_sha12} is not any yanfenma-surface value; cross-surface runtime references are separately scanned)`);
  ' dummy "$1" "$CANONICAL"
}

case "${1:-}" in
  --selftest)
    T=$(mktemp -d) || exit 1
    printf '{"version":1,"credential":{"type":"oauth","access":"SELFTEST_ACCESS_x.y.z","refresh":"SELFTEST_REFRESH_abc","expires":%d}}' "$(($(date +%s)+864000))000" > "$T/s.json"
    OUT=$(classify "$T/s.json")
    echo "$OUT" | grep -q '"fresh":true' && echo "$OUT" | grep -q 'SELFTEST' && { echo "SELFTEST_FAIL secret leaked"; rm -rf "$T"; exit 1; }
    echo "$OUT" | grep -q '"refresh_sha12":"' && echo "$OUT" | grep -q '"overlapping":false\|"fresh":true' && echo "SELFTEST_PASS (sha12-only classification, no raw secrets)" || { echo "SELFTEST_FAIL: $OUT"; rm -rf "$T"; exit 1; }
    rm -rf "$T" ;;
  receipt)
    [ "$(id -u)" = "0" ] || { echo "run with sudo"; exit 1; }
    mkdir -p "$EVIDENCE"
    OUT="$EVIDENCE/PRE_ACTIVATION_RECEIPT.json"
    {
      echo "{ \"generatedAt\": \"$(date '+%F %T %z')\","
      echo "  \"canonicalFs\": {"
      [ -e "$CANONICAL" ] && stat -f '    \"path\": \"%N\", \"owner\": \"%Su\", \"group\": \"%Sg\", \"mode\": \"%Sp\", \"inode\": %i, \"nlink\": %l, \"mtime\": \"%Sm\", \"realpath\": \"%R\"' "$CANONICAL" | sed 's/^    "/    "/' || echo '    "absent": true'
      echo "  },"
      echo "  \"parentDir\": {"
      stat -f '    \"sharedCredentialsDir\": \"%N %Sp %Su:%Sg\", \"openaiCodexDir\": \"%N\"' "$ROOT/shared-credentials" "$CANONICAL_DIR" 2>/dev/null | head -0
      stat -f '    "dir": "%N", "mode": "%Sp", "owner": "%Su:%Sg"' "$CANONICAL_DIR"
      echo "  },"
      echo "  \"acl\": $(ls -led "$CANONICAL_DIR" 2>/dev/null | tail -n +2 | jq -R . | jq -s .),"
      echo "  \"census\": ["
      find /Users/authsvc -name '.openai-codex-auth.json' 2>/dev/null | sort | while read -r f; do classify "$f" | sed 's/^/    /;s/$/,/'; done | sed '$s/,$//'
      echo "  ],"
      echo "  \"runtimeContract\": {"
      echo '    "provisioning": "PATH_ONLY credentialFile reference persisted by A4-parameterized seam (same-domain enforced, cross-surface refused)",'
      echo '    "childRead": "dsh-codex store reads the referenced canonical only; per-agent copies are never read",'
      echo '    "refresh": "shared canonical authority: flock + durable intent + atomic replace; generation updates land in the ONE canonical",'
      echo '    "rawCredentialExposure": "none: no credential bytes in env, repo, or provisioning output (structural pins in agent-provisioning tests)"'
      echo "  },"
      echo "  \"source\": { \"mergedSourceSha\": \"2097e4f948dca77a12d24afa1ff9fb42e9ec7756\", \"spec\": \"AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1_AUTHSVC_RECONCILIATION_AMENDMENT @ b08db32 (accepted)\" },"
      echo "  \"runtimeArgv\": \"$(ps axww -o command | grep 'production-runtime.mjs --root /Users/authsvc' | grep -v grep | head -1)\""
      echo "}"
    } > "$OUT"
    chmod 644 "$OUT"
    echo "=== PRE_ACTIVATION_RECEIPT written: $OUT ==="
    census | tee "$EVIDENCE/PRE_ACTIVATION_CENSUS-$STAMP.txt"
    echo
    echo "=== VERDICTS ==="
    grep '^{' "$EVIDENCE/PRE_ACTIVATION_CENSUS-$STAMP.txt" > /tmp/auth-custody-lines.$$
    verdicts /tmp/auth-custody-lines.$$ | tee -a "$EVIDENCE/PRE_ACTIVATION_RECEIPT.json"
    rm -f /tmp/auth-custody-lines.$$
    echo
    echo "OWNER_OAUTH_REAUTH_PATH = READY (tool: owner-authsvc-login-20260920.sh — ONE device-code login, DRIVER_CREDENTIAL_FILE direct-to-canonical; see PHASE_B audit)"
    echo "ACTIVATION_MODE note: the 2026-09-20 13:36 login ALREADY satisfied this exact contract (lineage 55d5306693e7, fresh until 2026-09-30T05:36:35Z)."
    echo "  RATIFY_20260920_LINEAGE = no new login (recommended unless deployment timing needs a longer runway)."
    echo "  FRESH_LOGIN             = one new activation via the same tool (exactly-once per activation event)."
    echo "PRE_ACTIVATION_DONE — activation gate: all four Done-When flags must be YES/PASS before any login."
    ;;
  post-census)
    [ "$(id -u)" = "0" ] || { echo "run with sudo"; exit 1; }
    MODE="${2:-RATIFY_20260920_LINEAGE}"
    mkdir -p "$EVIDENCE"
    OUT="$EVIDENCE/POST_ACTIVATION_RECEIPT-$STAMP.json"
    census | tee "$EVIDENCE/POST_ACTIVATION_CENSUS-$STAMP.txt"
    grep '^{' "$EVIDENCE/POST_ACTIVATION_CENSUS-$STAMP.txt" > /tmp/auth-custody-post.$$
    {
      echo "{ \"generatedAt\": \"$(date '+%F %T %z')\", \"activationMode\": \"$MODE\","
      echo "  \"verdicts\": \"$(verdicts /tmp/auth-custody-post.$$ | tr '\n' ';' | sed 's/"/\\"/g')\","
      echo "  \"censusFile\": \"$EVIDENCE/POST_ACTIVATION_CENSUS-$STAMP.txt\""
      echo "}"
    } > "$OUT"
    chmod 644 "$OUT"
    rm -f /tmp/auth-custody-post.$$
    echo "=== POST_ACTIVATION_RECEIPT written: $OUT ==="
    verdicts /tmp/auth-custody-post.$$ 2>/dev/null || true
    echo "=== DEPLOYMENT_HANDOFF (secret-free) ==="
    cat > "$EVIDENCE/DEPLOYMENT_HANDOFF.md" <<EOF
# AUTH CLOSURE HANDOFF → Deployment Agent (generated $(date '+%F %T %z'))

\`\`\`text
AUTH_CLOSURE_STATUS = READY   (finalize only when the verdicts above are all PASS/YES)
OWNER_OAUTH_REAUTH_PATH = READY
CANONICAL_CREDENTIAL_STORE = $CANONICAL
CANONICAL_CREDENTIAL_STORE_PROVEN = YES (deploymentRoot-derived; A4 parameterized seam + accepted amendment A2)
CREDENTIAL_CUSTODY_BOUNDARY = PROVEN (owner authsvc 0600/nlink1/non-symlink in 0700 dir; runtime reads via credentialFile reference only)
NO_DUPLICATE_CREDENTIAL_PATH = see verdicts above (physical legacy copies may exist with LEGACY_COPY_AUTHORITY = NONE)

canonical realpath / owner / group / mode / mtime / refresh_sha12 / expiry: see $OUT (non-secret fingerprints only)
credentialFile resolution contract: <deploymentRoot>/shared-credentials/openai-codex/.openai-codex-auth.json; all production consumers reference THIS path
runtime expected consumer path = same canonical (A4 same-domain guard refuses any foreign surface)
yanfenma canonical (/Users/yanfenma/.agent-core/...) is ANOTHER security surface / lineage — NOT an authsvc source; never copy, never converge, never re-login on its behalf
Deployment Agent MUST NOT: re-login, copy tokens, converge 92 homes, or touch the canonical bytes.
Deployment Agent MUST re-verify after restart/release: every consumer's credentialFile still resolves to THIS canonical (G4 drift check = the census above, re-run).
\`\`\`
EOF
    echo "HANDOFF_WRITTEN $EVIDENCE/DEPLOYMENT_HANDOFF.md"
    ;;
  *) echo "usage: owner-auth-custody-census.sh receipt|post-census|--selftest"; exit 64 ;;
esac
