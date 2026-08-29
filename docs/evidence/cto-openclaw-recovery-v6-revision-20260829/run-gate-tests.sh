#!/bin/bash
# REVISION-ONLY driver: authority-gate seam tests for the v6 recovery runner.
# Runs as uid 502. ZERO sudo is executed anywhere in this driver or in any test copy:
#  - the root gate is neutralized in test copies (audit-established 2-line patch pattern),
#  - git_as_repo_owner's sudo prefix is replaced by a DIRECT uid-502 git invocation —
#    the exact process identity `sudo -n -u yanfenma` produces (id -u yanfenma = 502,
#    repo owner uid = 502). The sudo uid-mapping link itself is deferred to the
#    independent audit / Owner run by task constraint "不执行 sudo".
set -u
V6=/tmp/run-agent-core-cto-openclaw-recovery-v6.sh
V6_SHA=ca47ef9fbbde891484798a10aeda221fa9d1ccca7c326127631b2144af3db018
EV=/tmp/cto-v6-revision-evidence
SCRATCH="$EV/scratch"
GATE="$EV/gate"
REPO=/Users/yanfenma/workspace/project/dsh-agent-core
AUTH_COMMIT=73ec666fb860d7257b2f48c3dc76bc967bb578cd
SPEC_PATH=docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md
PHRASE="APPLY EXACT_CTO_OPENCLAW_RECOVERY_V6"
TARGET_WS=/Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab
PASS=0; FAIL=0
pass(){ echo "GATE $1 = PASS"; PASS=$((PASS+1)); }
fail(){ echo "GATE $1 = FAIL: $2"; FAIL=$((FAIL+1)); }

mkdir -p "$GATE" "$SCRATCH/copies"

# ---- 0. seal + identity facts -------------------------------------------------
[ "$(shasum -a 256 "$V6" | awk '{print $1}')" = "$V6_SHA" ] || { echo "V6 SEAL MISMATCH"; exit 90; }
{
  echo "uid=$(id -u) user=$(id -un)"
  echo "id -u yanfenma = $(/usr/bin/id -u yanfenma)"
  echo "git binary: $(command -v git) ; $(/usr/bin/git --version)"
  stat -f 'repo: %HT uid=%u %N' "$REPO" "$REPO/.git"
  /bin/realpath "$REPO"
} > "$GATE/identity-facts.txt" 2>&1

# ---- 0b. zero-write baselines -------------------------------------------------
ls -1 /tmp/agent-core-cto-openclaw-recovery-v4-*.log 2>/dev/null | sort > "$EV/tmp-v4logs-before.txt"
ls -d  /tmp/cto-v4-runner-matrix.* 2>/dev/null | sort > "$EV/tmp-matrixdirs-before.txt"
( cd "$REPO" && git rev-parse HEAD && git status --porcelain | shasum -a 256 ) > "$EV/repo-state-before.txt" 2>&1
[ ! -e "$TARGET_WS/.agent-core-cto-recovery-v4-canary.txt" ] \
  && echo "marker absent: YES" >> "$EV/repo-state-before.txt" \
  || echo "marker absent: NO" >> "$EV/repo-state-before.txt"

# ---- T1: v5 seam identity (different-owner / root perspective) fails -----------
T1OUT="$GATE/t1-dubious-ownership-reproduction.txt"
: > "$T1OUT"
t1_all=1
for q in "cat-file -t $AUTH_COMMIT" "show $AUTH_COMMIT:$SPEC_PATH" "merge-base --is-ancestor $AUTH_COMMIT main"; do
  echo "== GIT_TEST_ASSUME_DIFFERENT_OWNER=1 /usr/bin/git -C \$REPO $q ==" >> "$T1OUT"
  out="$(GIT_TEST_ASSUME_DIFFERENT_OWNER=1 /usr/bin/git -C "$REPO" $q 2>"$GATE/t1-stderr.tmp")"; rc=$?
  echo "rc=$rc" >> "$T1OUT"; echo "stdout=[$out]" >> "$T1OUT"
  sed 's/^/stderr: /' "$GATE/t1-stderr.tmp" >> "$T1OUT"
  if [ "$rc" = "128" ] && [ -z "$out" ] && grep -q 'detected dubious ownership' "$GATE/t1-stderr.tmp"; then :; else t1_all=0; fi
done
rm -f "$GATE/t1-stderr.tmp"
[ "$t1_all" = "1" ] && pass "T1-dubious-ownership(v5-seam-identity)" || fail "T1-dubious-ownership" "expected rc=128 + empty stdout + fatal dubious ownership on all 3 queries"

# ---- T2: repo-owner identity (uid 502) succeeds --------------------------------
T2OUT="$GATE/t2-repo-owner-identity-success.txt"
{
  echo "== uid 502 (repo owner; the identity sudo -n -u yanfenma produces) =="
  echo "-- cat-file --"
  o="$(/usr/bin/git -C "$REPO" cat-file -t "$AUTH_COMMIT" 2>&1)"; echo "rc=$? out=[$o]"
  echo "-- show spec blob | sed 1,20p --"
  h="$(/usr/bin/git -C "$REPO" show "$AUTH_COMMIT:$SPEC_PATH" 2>/dev/null | sed -n '1,20p')"
  printf '%s\n' "$h" | grep '^spec_id: \|^status: \|^---$'
  echo "spec_id grep rc=$(printf '%s\n' "$h" | grep -c '^spec_id: AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1$')"
  echo "status grep rc=$(printf '%s\n' "$h" | grep -c '^status: accepted$')"
  echo "-- merge-base --"
  /usr/bin/git -C "$REPO" merge-base --is-ancestor "$AUTH_COMMIT" main >/dev/null 2>&1; echo "rc=$?"
} > "$T2OUT" 2>&1
t2_ok=1
[ "$(awk '/^spec_id grep rc=/{print $NF}' "$T2OUT")" = "rc=1" ] || t2_ok=0
[ "$(awk '/^status grep rc=/{print $NF}' "$T2OUT")" = "rc=1" ] || t2_ok=0
[ "$(awk '/^rc=/{print $1}' "$T2OUT" | tail -1)" = "rc=0" ] || t2_ok=0
grep -q 'rc=0 out=\[commit\]' "$T2OUT" || t2_ok=0
[ "$t2_ok" = "1" ] && pass "T2-repo-owner-git-reads" || fail "T2-repo-owner-git-reads" "see $T2OUT"

# ---- synthetic repos -----------------------------------------------------------
REPOA="$SCRATCH/repo-no-commit"
REPOB="$SCRATCH/repo-spec-draft"
REPOC="$SCRATCH/repo-dotgit-symlink"
/usr/bin/git init -q "$REPOA"
/usr/bin/git -C "$REPOA" -c user.email=gate@test -c user.name="Gate Test" commit -q --allow-empty -m base
/usr/bin/git init -q "$REPOB"
mkdir -p "$REPOB/docs/specs"
printf -- '---\nspec_id: AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1\nstatus: draft\ndate: 2026-08-29\n---\n\ngate-test body (status deliberately NOT accepted)\n' \
  > "$REPOB/$SPEC_PATH"
/usr/bin/git -C "$REPOB" add "$SPEC_PATH"
/usr/bin/git -C "$REPOB" -c user.email=gate@test -c user.name="Gate Test" commit -q -m spec
CB="$(/usr/bin/git -C "$REPOB" rev-parse HEAD)"
/usr/bin/git init -q "$REPOC"
/usr/bin/git -C "$REPOC" -c user.email=gate@test -c user.name="Gate Test" commit -q --allow-empty -m base
mv "$REPOC/.git" "$REPOC/.git-real"
ln -s "$REPOC/.git-real" "$REPOC/.git"
ln -s "$REPO" "$SCRATCH/alias-repo"
RA_REAL="$(/bin/realpath "$REPOA")"; RB_REAL="$(/bin/realpath "$REPOB")"; RC_REAL="$(/bin/realpath "$REPOC")"
{
  echo "repoA(pinned commit absent)=$RA_REAL"
  echo "repoB(spec status: draft) HEAD=$CB path=$RB_REAL"
  echo "repoC(.git symlink)=$RC_REAL"
  stat -f 'alias: %HT %N' "$SCRATCH/alias-repo"
  stat -f 'repoC/.git: %HT %N' "$REPOC/.git"
} > "$GATE/synthetic-repos.txt" 2>&1

# ---- patcher -------------------------------------------------------------------
make_copy() {
  # $1=name; remaining args: python snippets appended to PATCHES list
  local name="$1"; shift
  python3 - "$V6" "$SCRATCH/copies/$name.sh" "$@" <<'PY'
import sys, hashlib, difflib
src, dst = sys.argv[1], sys.argv[2]
snippets = sys.argv[3:]
with open(src) as f: text = f.read()
P_ROOTGATE_OLD = '[ "$(id -u)" = "0" ] || zero_write_exit "must run through sudo as root"\n'
P_ROOTGATE_NEW = ': # GATE-TEST root gate neutralized\n'
P_HELPER_OLD  = '  /usr/bin/sudo -n -u yanfenma /usr/bin/git -C "$REPO" "$@"\n'
P_HELPER_NEW  = '  /usr/bin/git -C "$REPO" "$@" # GATE-TEST: direct uid-502 identity (identical to sudo -n -u yanfenma output identity; sudo not executable this round)\n'
P_GATESTOP_OLD = 'ok "accepted governing Spec is in main; separate execution and production authorization bound"\n'
P_GATESTOP_NEW = 'ok "accepted governing Spec is in main; separate execution and production authorization bound"; log "GATE_TEST: authority gate passed as repo-owner identity; controlled stop before any production-path step"; exit 0\n'
REPO_LINE = 'REPO="/Users/yanfenma/workspace/project/dsh-agent-core"\n'
PIN_LINE = 'REPO_PIN="/Users/yanfenma/workspace/project/dsh-agent-core"\n'
AUTH_LINE = 'AUTH_COMMIT="73ec666fb860d7257b2f48c3dc76bc967bb578cd"\n'
def rep(text, old, new, label):
    n = text.count(old)
    assert n == 1, f"{label}: expected 1 match, found {n}"
    return text.replace(old, new, 1)
pairs = []
for s in snippets:
    pairs.append(eval(s))
for old, new, label in pairs:
    text = rep(text, old, new, label)
with open(dst, 'w') as f: f.write(text)
import os; os.chmod(dst, 0o600)
PY
  diff -u "$V6" "$SCRATCH/copies/$name.sh" > "$GATE/patch-$name.diff" || true
}

RG="(P_ROOTGATE_OLD, P_ROOTGATE_NEW, 'rootgate')"
HP="(P_HELPER_OLD, P_HELPER_NEW, 'helper-identity')"
GS="(P_GATESTOP_OLD, P_GATESTOP_NEW, 'gatestop')"
REPO_LINE='REPO="/Users/yanfenma/workspace/project/dsh-agent-core"\n'
PIN_LINE='REPO_PIN="/Users/yanfenma/workspace/project/dsh-agent-core"\n'
AUTH_LINE='AUTH_COMMIT="73ec666fb860d7257b2f48c3dc76bc967bb578cd"\n'

make_copy pos "$RG" "$HP" "$GS"
make_copy commit-missing "$RG" "$HP" "(REPO_LINE, 'REPO=\"%s\"\\n' % '$RA_REAL', 'repo-a')" "(PIN_LINE, 'REPO_PIN=\"%s\"\\n' % '$RA_REAL', 'pin-a')"
make_copy spec-draft "$RG" "$HP" "(REPO_LINE, 'REPO=\"%s\"\\n' % '$RB_REAL', 'repo-b')" "(PIN_LINE, 'REPO_PIN=\"%s\"\\n' % '$RB_REAL', 'pin-b')" "(AUTH_LINE, 'AUTH_COMMIT=\"$CB\"\\n'.replace(chr(36)+'CB','$CB'), 'auth-b')"
make_copy path-drift "$RG" "$HP" "(REPO_LINE, 'REPO=\"%s\"\\n' % '$RA_REAL', 'repo-a')"
make_copy path-unresolved "$RG" "$HP" "(REPO_LINE, 'REPO=\"%s\"\\n' % '$SCRATCH/nonexistent-repo', 'repo-none')"
make_copy owner-drift "$RG" "$HP" "(REPO_LINE, 'REPO=\"/Users/Shared\"\\n', 'repo-shared')" "(PIN_LINE, 'REPO_PIN=\"/Users/Shared\"\\n', 'pin-shared')"
make_copy repo-symlink "$RG" "$HP" "(REPO_LINE, 'REPO=\"%s\"\\n' % '$SCRATCH/alias-repo', 'repo-alias')"
make_copy dotgit-symlink "$RG" "$HP" "(REPO_LINE, 'REPO=\"%s\"\\n' % '$RC_REAL', 'repo-c')" "(PIN_LINE, 'REPO_PIN=\"%s\"\\n' % '$RC_REAL', 'pin-c')"

# ---- runner of variants --------------------------------------------------------
run_variant() {
  # $1=name $2=expect_rc $3=required grep -F substring $4=forbidden substring ("-" = none)
  local name="$1" want_rc="$2" need="$3" forbid="${4:-}"
  local out rc
  out="$(printf '%s\n' "$PHRASE" | bash "$SCRATCH/copies/$name.sh" 2>&1)"; rc=$?
  { echo "===== GATE-TEST $name (expect rc=$want_rc) ====="; printf '%s\n' "$out"; echo "RC=$rc"; } > "$GATE/gate-$name.out.txt"
  local ok=1
  [ "$rc" = "$want_rc" ] || ok=0
  printf '%s\n' "$out" | grep -qF "$need" || ok=0
  if [ "$want_rc" = "2" ]; then
    printf '%s\n' "$out" | grep -q 'FINAL: FAILED_PRE_FLIGHT; WRITES=NONE' || ok=0
    printf '%s\n' "$out" | grep -q 'accepted governing Spec is in main' && ok=0
  else
    printf '%s\n' "$out" | grep -q 'GATE_TEST: authority gate passed' || ok=0
    printf '%s\n' "$out" | grep -q 'PREFLIGHT_FAIL' && ok=0
  fi
  [ "$forbid" = "-" ] || ! printf '%s\n' "$out" | grep -qF "$forbid" || ok=0
  [ "$ok" = "1" ] && pass "$name" || fail "$name" "rc=$rc (want $want_rc); needed [$need]"
}

run_variant pos 0 "accepted governing Spec is in main" "-"
run_variant commit-missing 2 "authority commit missing" "-"
run_variant spec-draft 2 "authority spec not accepted" "-"
run_variant path-drift 2 "repo realpath drift" "unresolved"
run_variant path-unresolved 2 "unresolved" "-"
run_variant owner-drift 2 "repo owner uid drift" "-"
run_variant repo-symlink 2 "repo is not a plain directory" "-"
run_variant dotgit-symlink 2 "repo .git missing or not a plain directory" "-"

# ---- bash -x trace of the positive gate run (proves executed commands + zero sudo) --
( printf '%s\n' "$PHRASE" | bash -x "$SCRATCH/copies/pos.sh" ) > "$GATE/gate-pos.trace.out.txt" 2> "$GATE/gate-pos.trace.txt"
grep -c 'sudo' "$GATE/gate-pos.trace.txt" > "$GATE/gate-pos.trace-sudo-count.txt" || true

# ---- post-state zero-write proof ------------------------------------------------
( cd "$REPO" && git rev-parse HEAD && git status --porcelain | shasum -a 256 ) > "$EV/repo-state-after.txt" 2>&1
if [ ! -e "$TARGET_WS/.agent-core-cto-recovery-v4-canary.txt" ]; then
  echo "marker absent: YES" >> "$EV/repo-state-after.txt"
else
  echo "marker absent: NO" >> "$EV/repo-state-after.txt"
fi
if cmp -s "$EV/repo-state-before.txt" "$EV/repo-state-after.txt"; then pass "zero-write-real-repo-state"; else fail "zero-write-real-repo-state" "repo state changed"; fi

echo "GATE_PASS=$PASS GATE_FAIL=$FAIL"
