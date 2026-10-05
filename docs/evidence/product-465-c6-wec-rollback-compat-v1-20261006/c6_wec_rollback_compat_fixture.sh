#!/usr/bin/env bash
#
# c6_wec_rollback_compat_fixture.sh — Product #465 (C6 WEC rollback compatibility)
# bounded isolated rollback/readback fixture (TEST_IDENTITY, NON-PRODUCTION).
#
# Mechanically checks the WEC svc rollback target against schema/runtime
# expectations using ONLY: the pinned Owner-accepted 0027-empty-only-recovery.sql,
# the exact on-disk release artifacts (preimage f6a74001 + candidate 9f7c2483),
# and a disposable initdb PostgreSQL cluster on a random 127.0.0.1 port that is
# torn down (and verified torn down) at exit. No production DB/service/config
# contact of any kind.
#
# Cases:
#   C0  artifact identity receipts — every pinned hash must be byte-exact.
#   C1  old binary vs schema 1..27 (seeded WEC rows)  -> startup ABORT: the
#       pinned preimage (sqlx 0.8.6) panics VersionMissing(27) in its boot-time
#       migration validation and never opens a listener — a strictly stronger
#       refusal than a /readyz 503: zero business queries run. Every seeded
#       row must remain byte-identical after the attempt (no silent corruption).
#   C1b structural: the old binary has zero workflow_outbox /
#       workflow_forum_bindings references (strings + source census).
#   C2  pinned empty-only recovery on the exact empty 0027 state -> commit;
#       readback ledger exactly 1..26, both WEC tables absent; then the exact
#       old binary (its own 26-file bundle) returns /readyz 200 + /version
#       gitSha f6a74001.
#   C3  fail-closed negatives, each state-retaining:
#         N1 outbox non-empty        -> RECOVERY_BLOCKED_WORKFLOW_OUTBOX_NOT_EMPTY
#         N2 bindings non-empty      -> RECOVERY_BLOCKED_WORKFLOW_FORUM_BINDINGS_NOT_EMPTY
#         N3 wrong database name     -> RECOVERY_BLOCKED_DATABASE_IDENTITY_MISMATCH
#         N4 unexpected outbox column-> RECOVERY_BLOCKED_OUTBOX_COLUMNS_MISMATCH
#
# Exit 0 iff every case PASSES. Any FAIL exits 1 (the lane then flips from
# VERIFY_ONLY to a RED-first bounded fix).
set -euo pipefail

EV_DIR="${1:?usage: c6_wec_rollback_compat_fixture.sh <evidence-output-dir>}"
mkdir -p "$EV_DIR"
EV_DIR="$(cd "$EV_DIR" && pwd)"
LOG() { printf '[c6-fixture] %s\n' "$*"; }
FAIL() { printf '[c6-fixture] FAIL: %s\n' "$*" >&2; echo "FAIL: $*" >> "$EV_DIR/VERDICT.txt"; EXIT_CODE=1; }

EXIT_CODE=0
: > "$EV_DIR/VERDICT.txt"

WORK="$(mktemp -d /tmp/c6-wec-rollback-fixture.XXXXXX)"
PG_DATA="$WORK/pgdata"
PG_SOCKET="$WORK/pgsock"
OLD_SHA=f6a74001b71af106777045b596b30c3a7e99934d
CAND_SHA=9f7c2483aa2147cb29cf7e192aca2d1fd50293f5
SVC_RELEASES="$HOME/.local/services/svc-workflow/releases"
OLD_DIR="$SVC_RELEASES/$OLD_SHA"
CAND_DIR="$SVC_RELEASES/$CAND_SHA"
PKG=/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/svc-workflow-wec-phase1-candidate-9f7c2483
SQL="$PKG/0027-empty-only-recovery.sql"
PG_BIN=/opt/homebrew/opt/postgresql@16/bin
PG_PORT=""; JWKS_PORT=""; SVC_PORT_C1=""; SVC_PORT_C2=""
PG_PID=""; JWKS_PID=""; OLD_PID=""; OLD_PID2=""

kill_verified() { # $1 pid — SIGTERM, wait, SIGTERM again, wait, SIGKILL; 0 iff gone
  local pid="$1" i
  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0
  kill "$pid" 2>/dev/null || true
  for i in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || return 0; sleep 0.5; done
  kill "$pid" 2>/dev/null || true
  for i in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || return 0; sleep 0.5; done
  kill -9 "$pid" 2>/dev/null || true
  sleep 1
  kill -0 "$pid" 2>/dev/null && return 1 || return 0
}

sweep_port() { # $1 port — last-resort listener kill (can only be fixture children)
  local pids
  pids=$(lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true)
  [[ -z "$pids" ]] || { printf '%s\n' $pids | xargs kill -9 2>/dev/null || true; }
}

cleanup() {
  trap - EXIT
  set +e
  kill_verified "$OLD_PID"
  kill_verified "$OLD_PID2"
  kill_verified "$JWKS_PID"
  [[ -n "$PG_PID" ]] && "$PG_BIN/pg_ctl" -D "$PG_DATA" -m fast stop >/dev/null 2>&1
  sweep_port "$SVC_PORT_C1"; sweep_port "$SVC_PORT_C2"; sweep_port "$JWKS_PORT"
  # the disposable cluster itself must be gone; a surviving listener means we
  # cannot silently leave a scratch server behind
  sweep_port "$PG_PORT"
  pkill -9 -f "c6-wec-rollback-fixture.*/pgdata" 2>/dev/null
  rm -rf "$WORK"
  # NOTE: an EXIT trap's return value cannot override the script's exit status;
  # the FAIL path exits 1 explicitly before reaching here.
  return 0
}
trap cleanup EXIT

for BIN in psql createdb curl jq openssl python3 shasum lsof; do
  command -v "$BIN" >/dev/null || { echo "missing tool: $BIN"; exit 2; }
done

free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }
PG_PORT=$(free_port); JWKS_PORT=$(free_port); SVC_PORT_C1=$(free_port); SVC_PORT_C2=$(free_port)

psql_root() { "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
psql_svc() { # $1 = dbname, rest = psql args; connects as svc_wf (recovery SQL pins CURRENT_USER)
  local db="$1"; shift
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U svc_wf -d "$db" -v ON_ERROR_STOP=1 -qAt "$@"
}

# ---------------------------------------------------------------------------
# 0. Artifact identity receipts (hash pins; fail fast on drift)
# ---------------------------------------------------------------------------
LOG "case C0: artifact identity receipts"
{
  echo "recovery_sql=$(shasum -a 256 "$SQL" | awk '{print $1}')"
  echo "recovery_sql_expected=49cf0921202ec1fc0bf33212985a535dd643ccede7cdec56b01d802f8ce6ec96"
  echo "amendment=$(shasum -a 256 "$PKG/WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_ROLLBACK_AMENDMENT_DRAFT.md" | awk '{print $1}')"
  echo "amendment_expected=b76fa3aabc51d572d0bfaaa426e9acc273181c2f1e185636787bd4b240f50398"
  echo "candidate_binary=$(shasum -a 256 "$CAND_DIR/svc-workflow" | awk '{print $1}')"
  echo "candidate_binary_expected=0f63ec53e702c18612bbac729252938034b78ba046019bc0bfbb83400efa2ef9"
  echo "old_binary=$(shasum -a 256 "$OLD_DIR/svc-workflow" | awk '{print $1}')"
  echo "old_binary_expected=4dc498396f18fd7571c80726f8c08f638903353c508774beee10ba14ca1b2a98"
  echo "candidate_bundle=$(cd "$CAND_DIR" && shasum -a 256 migrations/*.sql | shasum -a 256 | awk '{print $1}')"
  echo "candidate_bundle_expected=b2824bf49cb28c423f7d51ccd6da812c632260a5eb13744a5a4c160ab029b647"
  echo "old_bundle=$(cd "$OLD_DIR" && shasum -a 256 migrations/*.sql | shasum -a 256 | awk '{print $1}')"
  echo "old_bundle_expected=57635e82ba6264cebaa41e73065c0c2a419bb9b91966fbc2313bd4907fcfd4bd"
  echo "old_bundle_files=$(ls "$OLD_DIR/migrations" | wc -l | tr -d ' ')"
  echo "candidate_bundle_files=$(ls "$CAND_DIR/migrations" | wc -l | tr -d ' ')"
} > "$EV_DIR/artifact-identity.txt"
pin_ok() { # $1 name — compare <name> line to <name>_expected line
  local got want
  got=$(grep "^$1=" "$EV_DIR/artifact-identity.txt" | cut -d= -f2- || true)
  want=$(grep "^${1}_expected=" "$EV_DIR/artifact-identity.txt" | cut -d= -f2- || true)
  [[ -n "$got" && "$got" == "$want" ]] || FAIL "artifact drift: $1 got '$got' want '$want'"
}
pin_ok recovery_sql
pin_ok amendment
pin_ok candidate_binary
pin_ok old_binary
pin_ok candidate_bundle
pin_ok old_bundle
if grep -q "FAIL" "$EV_DIR/VERDICT.txt"; then
  cat "$EV_DIR/artifact-identity.txt"; exit 1
fi
LOG "case C0: PASS (all six pins byte-exact)"

# ---------------------------------------------------------------------------
# Disposable cluster with the exact recovery-SQL identity
# (database svc_workflow_dogfood_clean, runtime actor svc_wf)
# ---------------------------------------------------------------------------
LOG "setup: disposable postgres on 127.0.0.1:$PG_PORT (data $PG_DATA)"
mkdir -p "$PG_SOCKET"
"$PG_BIN/initdb" -A trust -U postgres -D "$PG_DATA" > "$EV_DIR/setup-initdb.log" 2>&1
"$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$EV_DIR/setup-pg.log" \
  -o "-p $PG_PORT -k $PG_SOCKET -c listen_addresses=127.0.0.1" -w start > /dev/null 2>&1
PG_PID=$(head -1 "$PG_DATA/postmaster.pid")
psql_root -c "CREATE ROLE svc_wf LOGIN SUPERUSER" > /dev/null
psql_root -c "CREATE DATABASE svc_workflow_dogfood_clean OWNER svc_wf" > /dev/null
# isolation guard: every connection string in this script is constructed from
# 127.0.0.1:$PG_PORT — no ambient DATABASE_URL is ever consulted
DBURL="postgres://svc_wf@127.0.0.1:$PG_PORT/svc_workflow_dogfood_clean"
[[ "$DBURL" == "postgres://svc_wf@127.0.0.1:$PG_PORT/"* ]] || { FAIL "DSN construction guard"; exit 1; }

migrate_27() { # $1 = dbname — exact production deploy path: candidate binary, its reviewed 27-file bundle
  ( cd "$CAND_DIR" && DATABASE_URL="postgres://svc_wf@127.0.0.1:$PG_PORT/$1" \
      "$CAND_DIR/svc-workflow" --migrate > "$EV_DIR/migrate-$1.log" 2>&1 )
}
wec_fingerprint() { # $1 = dbname — forward-state fingerprint (tables must EXIST)
  psql_svc "$1" -c "SELECT (SELECT count(*) FROM _sqlx_migrations WHERE success) || '|' ||
    (SELECT count(*) FROM _sqlx_migrations WHERE NOT success) || '|' ||
    COALESCE((SELECT to_regclass('public.workflow_outbox')::text),'absent') || '|' ||
    COALESCE((SELECT to_regclass('public.workflow_forum_bindings')::text),'absent') || '|' ||
    (SELECT count(*) FROM workflow_outbox) || '|' || (SELECT count(*) FROM workflow_forum_bindings)"
}
wec_ledger_fp() { # $1 = dbname — post-recovery fingerprint (tables may be DROPPED)
  psql_svc "$1" -c "SELECT (SELECT count(*) FROM _sqlx_migrations WHERE success) || '|' ||
    (SELECT count(*) FROM _sqlx_migrations WHERE NOT success) || '|' ||
    COALESCE((SELECT to_regclass('public.workflow_outbox')::text),'absent') || '|' ||
    COALESCE((SELECT to_regclass('public.workflow_forum_bindings')::text),'absent')"
}
force_drop_db() { # $1 dbname — terminate lingering sessions, then drop
  psql_root -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$1' AND pid<>pg_backend_pid()" > /dev/null
  psql_root -c "DROP DATABASE IF EXISTS $1" > /dev/null
}
seed_wec_rows() { # $1 = dbname — one instance + one FORUM_EVENT row + one PENDING binding
  psql_svc "$1" > /dev/null <<'SQL'
BEGIN;
INSERT INTO domains (domain_id, domain_key, display_name)
  VALUES ('c6111111-1111-4111-8111-111111111111','c6-rollback-fixture','C6 rollback fixture domain');
INSERT INTO principals (principal_id, principal_type, display_name)
  VALUES ('c6222222-2222-4222-8222-222222222222','AGENT','C6 rollback fixture principal');
INSERT INTO workflow_definitions (workflow_definition_id, domain_id, definition_key, display_name)
  VALUES ('c6333333-3333-4333-8333-333333333333','c6111111-1111-4111-8111-111111111111','c6_rollback_fixture','C6 rollback fixture definition');
INSERT INTO workflow_definition_versions (definition_version_id, workflow_definition_id, version_number)
  VALUES ('c6444444-4444-4444-8444-444444444444','c6333333-3333-4333-8333-333333333333',1);
INSERT INTO workflow_instances (workflow_instance_id, domain_id, definition_version_id, created_by_principal_id)
  VALUES ('c6555555-5555-4555-8555-555555555555','c6111111-1111-4111-8111-111111111111','c6444444-4444-4444-8444-444444444444','c6222222-2222-4222-8222-222222222222');
INSERT INTO workflow_outbox (outbox_id, workflow_instance_id, outbox_kind, event_key, payload)
  VALUES ('c6666666-6666-4666-8666-666666666666','c6555555-5555-4555-8555-555555555555','FORUM_EVENT','wf_created:c6fixture','{"fixture":true}');
INSERT INTO workflow_forum_bindings (workflow_instance_id, binding_state)
  VALUES ('c6555555-5555-4555-8555-555555555555','PENDING');
COMMIT;
SQL
}
wec_row_digest() { # $1 = dbname — byte-exact forward-rows fingerprint (content, not just counts)
  psql_svc "$1" -c "SELECT md5(coalesce((SELECT string_agg(outbox_id::text||'|'||outbox_kind||'|'||event_key||'|'||payload::text||'|'||attempt_count::text||'|'||coalesce(delivered_at::text,'NULL')||'|'||coalesce(last_error::text,'NULL'), '|' ORDER BY outbox_id) FROM workflow_outbox),'empty') || '#' || coalesce((SELECT string_agg(workflow_instance_id::text||'|'||binding_state||'|'||coalesce(forum_thread_id::text,'NULL'), '|' ORDER BY workflow_instance_id) FROM workflow_forum_bindings),'empty'))"
}

start_jwks_stub() { # $1 = stub dir; serves one static jwks.json (valid RSA key, kid c6-fixture-key)
  # direct background + exec: JWKS_PID is the python process itself, so the
  # teardown kill always targets the real listener (no orphaned launchers)
  mkdir -p "$1"
  openssl genrsa -out "$1/keys.pem" 2048 > /dev/null 2>&1
  openssl rsa -in "$1/keys.pem" -noout -modulus 2>/dev/null | sed 's/^Modulus=//' > "$1/modulus.hex"
  python3 - "$1" <<'PY'
import base64, json, sys
d = sys.argv[1]
mod = open(f"{d}/modulus.hex").read().strip()
n = base64.urlsafe_b64encode(bytes.fromhex(mod)).decode().rstrip("=")
e = base64.urlsafe_b64encode(bytes.fromhex("010001")).decode().rstrip("=")
open(f"{d}/jwks.json", "w").write(json.dumps(
    {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256",
               "kid": "c6-fixture-key", "n": n, "e": e}]}))
PY
  ( cd "$1" && exec python3 -m http.server "$JWKS_PORT" --bind 127.0.0.1 > "$EV_DIR/jwks-stub.log" 2>&1 ) &
  JWKS_PID=$!
}

start_old_binary() { # $1 = port, $2 = dbname, $3 = log name
  # direct background + exec: the spawned pid IS ./svc-workflow; run with CWD =
  # the exact preimage release dir so its own 26-file bundle is used
  ( cd "$OLD_DIR" && exec env \
      DATABASE_URL="postgres://svc_wf@127.0.0.1:$PG_PORT/$2" \
      WORKFLOW_PORT="$1" WORKFLOW_BIND_ADDR=127.0.0.1 \
      WORKFLOW_JWKS_URL="http://127.0.0.1:$JWKS_PORT/jwks.json" \
      WORKFLOW_JWT_ISSUER=auth-service WORKFLOW_JWT_AUDIENCE=svc-workflow \
      WORKFLOW_ADMISSION_ENABLED=false \
      ./svc-workflow > "$EV_DIR/$3" 2>&1 ) &
  OLD_SPAWN_PID=$!
}

probe() { # $1 = port, $2 = path -> "HTTPCODE<TAB>BODY"
  curl -s -m 5 -o "$WORK/body" -w '%{http_code}' "http://127.0.0.1:$1$2" ; printf '\t'; cat "$WORK/body"
}
wait_listening() { # $1 = port
  local i
  for i in $(seq 1 60); do
    curl -s -m 2 -o /dev/null "http://127.0.0.1:$1/healthz" && return 0
    sleep 0.5
  done
  return 1
}

# ---------------------------------------------------------------------------
# C1: old binary vs forward schema 1..27 with live WEC rows
# ---------------------------------------------------------------------------
LOG "case C1: old binary against migrated-forward 1..27 (seeded WEC rows)"
psql_root -c "DROP DATABASE IF EXISTS c6_mismatch" > /dev/null
psql_root -c "CREATE DATABASE c6_mismatch OWNER svc_wf" > /dev/null
migrate_27 c6_mismatch
seed_wec_rows c6_mismatch
BEFORE_FP=$(wec_fingerprint c6_mismatch)
BEFORE_DIGEST=$(wec_row_digest c6_mismatch)
echo "before_fingerprint=$BEFORE_FP" > "$EV_DIR/c1-mismatch.txt"
echo "before_row_digest=$BEFORE_DIGEST" >> "$EV_DIR/c1-mismatch.txt"
[[ "$BEFORE_FP" == "27|0|workflow_outbox|workflow_forum_bindings|1|1" ]] || FAIL "C1: seeded pre-state wrong (got $BEFORE_FP)"
start_jwks_stub "$WORK/jwks"
sleep 1
start_old_binary "$SVC_PORT_C1" c6_mismatch c1-old-binary.log
OLD_PID=$OLD_SPAWN_PID
# the preimage must abort at boot (migration validation), never reach listening
for i in $(seq 1 30); do kill -0 "$OLD_PID" 2>/dev/null || break; sleep 0.5; done
if kill -0 "$OLD_PID" 2>/dev/null; then
  # still alive: probe once, then fail — a live old binary would be the hazard
  C1_STILL_ALIVE_PROBE=$(probe "$SVC_PORT_C1" /readyz || echo "connection-refused")
  echo "still_alive_probe=$C1_STILL_ALIVE_PROBE" >> "$EV_DIR/c1-mismatch.txt"
  FAIL "C1: old binary survived against ledger 1..27 — expected boot abort"
else
  echo "old_binary_process=ABORTED" >> "$EV_DIR/c1-mismatch.txt"
  grep -q 'VersionMissing(27)' "$EV_DIR/c1-old-binary.log" || FAIL "C1: boot abort must be VersionMissing(27)"
  grep -q 'failed to run database migrations' "$EV_DIR/c1-old-binary.log" || FAIL "C1: abort must occur in boot-time migration validation"
  if curl -s -m 2 "http://127.0.0.1:$SVC_PORT_C1/readyz" > /dev/null 2>&1; then
    FAIL "C1: listener responded although process should be dead"
  else
    echo "listener=connection-refused" >> "$EV_DIR/c1-mismatch.txt"
  fi
fi
sleep 2  # give any (wrongful) background writer time to act
AFTER_FP=$(wec_fingerprint c6_mismatch)
AFTER_DIGEST=$(wec_row_digest c6_mismatch)
echo "after_fingerprint=$AFTER_FP" >> "$EV_DIR/c1-mismatch.txt"
echo "after_row_digest=$AFTER_DIGEST" >> "$EV_DIR/c1-mismatch.txt"
[[ "$BEFORE_FP" == "$AFTER_FP" ]] || FAIL "C1: forward-state fingerprint changed under old binary"
[[ "$BEFORE_DIGEST" == "$AFTER_DIGEST" ]] || FAIL "C1: WEC row bytes changed under old binary"
kill_verified "$OLD_PID"; OLD_PID=""
LOG "case C1: PASS so far (fails=$(grep -c FAIL "$EV_DIR/VERDICT.txt" || true))"

# C1b: structural — the old binary cannot even name the forward tables
OLD_HITS=$(strings "$OLD_DIR/svc-workflow" | grep -c 'workflow_outbox\|workflow_forum_bindings' || true)
SRC_HITS=$({ git -C /Users/yanfenma/workspace/project/svc-workflow grep -l 'workflow_outbox\|workflow_forum_bindings' "$OLD_SHA" -- src/ || true; } | wc -l | tr -d ' ')
echo "binary_string_hits=$OLD_HITS" > "$EV_DIR/c1b-structural.txt"
echo "source_tree_hits=$SRC_HITS" >> "$EV_DIR/c1b-structural.txt"
[[ "$OLD_HITS" == "0" ]] || FAIL "C1b: old binary contains forward-table strings ($OLD_HITS)"
[[ "$SRC_HITS" == "0" ]] || FAIL "C1b: old source tree references forward tables ($SRC_HITS files)"

# ---------------------------------------------------------------------------
# C2: pinned empty-only recovery + readback + old binary restored readiness
# ---------------------------------------------------------------------------
LOG "case C2: empty-only recovery on exact 0027 state, then old-binary readback"
force_drop_db svc_workflow_dogfood_clean
psql_root -c "CREATE DATABASE svc_workflow_dogfood_clean OWNER svc_wf" > /dev/null
migrate_27 svc_workflow_dogfood_clean
PRE=$(wec_fingerprint svc_workflow_dogfood_clean)
echo "pre_recovery_fingerprint=$PRE" > "$EV_DIR/c2-empty-recovery-readback.txt"
[[ "$PRE" == "27|0|workflow_outbox|workflow_forum_bindings|0|0" ]] || FAIL "C2: pre-state must be exactly ledger 27 clean, both WEC tables present+empty (got $PRE)"
if psql_svc svc_workflow_dogfood_clean -f "$SQL" > "$EV_DIR/c2-recovery-sql.out" 2>&1; then
  echo "recovery=COMMITTED" >> "$EV_DIR/c2-empty-recovery-readback.txt"
  echo "recovery_psql=exit-0-quiet(-qAt success; empty .out is expected)" >> "$EV_DIR/c2-recovery-sql.out"
else
  echo "recovery=ABORTED" >> "$EV_DIR/c2-empty-recovery-readback.txt"
  FAIL "C2: recovery SQL must commit on the exact empty 0027 state"
fi
POST=$(wec_ledger_fp svc_workflow_dogfood_clean)
LEDGER=$(psql_svc svc_workflow_dogfood_clean -c "SELECT array_agg(version ORDER BY version) FROM _sqlx_migrations WHERE success" )
echo "post_recovery_fingerprint=$POST" >> "$EV_DIR/c2-empty-recovery-readback.txt"
echo "post_recovery_ledger=$LEDGER" >> "$EV_DIR/c2-empty-recovery-readback.txt"
[[ "$POST" == "26|0|absent|absent" ]] || FAIL "C2: post-state must be exactly ledger 26, both WEC tables absent (got $POST)"
[[ "$LEDGER" == *"{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26}"* ]] || FAIL "C2: readback ledger is not exactly 1..26"
start_old_binary "$SVC_PORT_C2" svc_workflow_dogfood_clean c2-old-binary-readback.log
OLD_PID2=$OLD_SPAWN_PID
wait_listening "$SVC_PORT_C2" || { FAIL "C2: old binary did not start after recovery"; }
C2_READY=$(probe "$SVC_PORT_C2" /readyz)
C2_VERSION=$(probe "$SVC_PORT_C2" /version)
echo "readyz=$C2_READY" >> "$EV_DIR/c2-empty-recovery-readback.txt"
echo "version=$C2_VERSION" >> "$EV_DIR/c2-empty-recovery-readback.txt"
echo "$C2_READY" | grep -q '^200' || FAIL "C2: expected /readyz 200 after empty-only recovery, got: $C2_READY"
echo "$C2_READY" | grep -q '"status":"ready"' || FAIL "C2: expected ready body"
echo "$C2_VERSION" | grep -q 'f6a74001b71af106777045b596b30c3a7e99934d' || FAIL "C2: /version gitSha must be the pinned preimage"
kill_verified "$OLD_PID2"; OLD_PID2=""
LOG "case C2 done"

# ---------------------------------------------------------------------------
# C3: fail-closed negatives (each state-retaining)
# ---------------------------------------------------------------------------
NEG_COMMON(){ # $1 dbname, $2 outfile — 0 iff recovery aborted as required
  if psql_svc "$1" -f "$SQL" > "$2" 2>&1; then
    echo "recovery=COMMITTED(SHOULD-FAIL)" >> "$2"; return 1
  else
    echo "recovery=ABORTED" >> "$2"; return 0
  fi
}
reset_neg_db() { # $1 dbname
  force_drop_db "$1"
  psql_root -c "CREATE DATABASE $1 OWNER svc_wf" > /dev/null
  migrate_27 "$1"
}
assert_retained() { # $1 dbname, $2 case label, $3 expected outbox|binding row counts
  local fp; fp=$(wec_fingerprint "$1")
  echo "retained_fingerprint=$fp" >> "$EV_DIR/$2"
  [[ "$fp" == "27|0|workflow_outbox|workflow_forum_bindings|$3" ]] || FAIL "$2: state not retained (fingerprint $fp)"
}

# N1 outbox non-empty (db named exactly svc_workflow_dogfood_clean so the
# identity gate passes and the EMPTINESS gate is the blocker being proven;
# bindings emptied because the SQL checks bindings first)
reset_neg_db svc_workflow_dogfood_clean
seed_wec_rows svc_workflow_dogfood_clean
psql_svc svc_workflow_dogfood_clean -c "DELETE FROM workflow_forum_bindings" > /dev/null
NEG_COMMON svc_workflow_dogfood_clean "$EV_DIR/c3-n1-outbox-nonempty.txt" || FAIL "N1: recovery should abort"
grep -q 'RECOVERY_BLOCKED_WORKFLOW_OUTBOX_NOT_EMPTY' "$EV_DIR/c3-n1-outbox-nonempty.txt" || FAIL "N1: wrong refusal code"
assert_retained svc_workflow_dogfood_clean c3-n1-outbox-nonempty.txt "1|0"

# N2 bindings non-empty
reset_neg_db svc_workflow_dogfood_clean
seed_wec_rows svc_workflow_dogfood_clean
psql_svc svc_workflow_dogfood_clean -c "DELETE FROM workflow_outbox" > /dev/null   # only the binding remains
NEG_COMMON svc_workflow_dogfood_clean "$EV_DIR/c3-n2-binding-nonempty.txt" || FAIL "N2: recovery should abort"
grep -q 'RECOVERY_BLOCKED_WORKFLOW_FORUM_BINDINGS_NOT_EMPTY' "$EV_DIR/c3-n2-binding-nonempty.txt" || FAIL "N2: wrong refusal code"
assert_retained svc_workflow_dogfood_clean c3-n2-binding-nonempty.txt "0|1"

# N3 wrong database name
reset_neg_db svc_workflow
NEG_COMMON svc_workflow "$EV_DIR/c3-n3-wrong-database.txt" || FAIL "N3: recovery should abort"
grep -q 'RECOVERY_BLOCKED_DATABASE_IDENTITY_MISMATCH' "$EV_DIR/c3-n3-wrong-database.txt" || FAIL "N3: wrong refusal code"
N3_FP=$(wec_fingerprint svc_workflow)
echo "retained_fingerprint=$N3_FP" >> "$EV_DIR/c3-n3-wrong-database.txt"
[[ "$N3_FP" == "27|0|workflow_outbox|workflow_forum_bindings|0|0" ]] || FAIL "N3: state not retained"

# N4 unexpected outbox column
reset_neg_db svc_workflow_dogfood_clean
psql_svc svc_workflow_dogfood_clean -c "ALTER TABLE workflow_outbox ADD COLUMN rogue_forward_column integer" > /dev/null
NEG_COMMON svc_workflow_dogfood_clean "$EV_DIR/c3-n4-schema-drift.txt" || FAIL "N4: recovery should abort"
grep -q 'RECOVERY_BLOCKED_OUTBOX_COLUMNS_MISMATCH' "$EV_DIR/c3-n4-schema-drift.txt" || FAIL "N4: wrong refusal code"
assert_retained svc_workflow_dogfood_clean c3-n4-schema-drift.txt "0|0"

# ---------------------------------------------------------------------------
if grep -q "FAIL" "$EV_DIR/VERDICT.txt"; then
  LOG "VERDICT: FAIL"; cat "$EV_DIR/VERDICT.txt"; exit 1
fi
echo "ALL_CASES_PASS" > "$EV_DIR/VERDICT.txt"
LOG "VERDICT: ALL_CASES_PASS (evidence in $EV_DIR)"
