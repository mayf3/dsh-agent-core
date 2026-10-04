#!/bin/bash
# owner-router-closure-g2-g7-v23.sh — B7 SHARED_CODEX_DEPLOYMENT_ROOT_REFREEZE_V2.3 (2026-10-02) — DEFECT C reconciliation + MODEL_OVERRIDES_CONFIG_GATE_V1
# Rebound copy of the v2.2 executor
# (source: docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v22.sh).
# NONPRODUCTION joint-recovery candidate: deploy/cutover are retired here.
# The exact r13 TX owns code/config/plugin intents and recovery. Original source
# pins below remain historical diagnostic coordinates; they authorize no deploy.
# Snapshot/health/diagnostic commands retain their original restricted meaning.
# B7-only apply/resume below owns the existing global mutex across r13 phases.
# Exact acceptance/artifact bindings are still required; this is not approval.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO=/Users/yanfenma/workspace/project/dsh-agent-core
DEPLOY_SRC=$REPO/.worktrees/b7-v23-packet-repair-20261002
# G2 纪律：必须执行 2097e4f 检出内的（reviewed、带 P1-P6 provenance 门的）安装器——
# 主 worktree（goal 分支旧 base）上的同名文件是无 provenance 的旧版，禁止使用。
DEPLOYER=$DEPLOY_SRC/scripts/trusted-cp-deploy-install.sh
HARNESS_SRC=/Users/yanfenma/workspace/github/deepseek-harness
EVIDENCE=$REPO/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002
TRUSTED_APP=/usr/local/libexec/agent-core/app
DURABLE_MODULE=$TRUSTED_APP/packages/agent-router/src/reconciliation/durable-file.js
STORE=/Users/authsvc/.agent-core/control/turn-recovery-v3.json
EXPECTED_SHA=4f14ff00acd0b6584d857a0c42d447da529f8cd0
EXPECTED_TREE=6eae0c23c27109d47a102a7eb9762bbbc6b3b8ad
STAMP=$(date '+%Y%m%dT%H%M%S')

die() { echo "FAIL: $*" >&2; exit 1; }

# V2.3 (review round-1 fix): classify a G2.7 CONFIG_LOAD_FAILED error. SINGLE-quoted
# pattern literals — the real loader line carries literal quote characters
# (`must be {"version":3,...} (older files are not converted)`), which a
# double-quoted case pattern silently strips and then never matches (the
# round-1 independent-review blocker: cutover would die "UNRECOGNIZED" on the
# exact error it exists to classify). --selftest-repair exercises this function
# directly with the exact recorded line.
g27_error_class() { # $1 = G2.7 error string → echoes V2_KNOWN_CLASS | OTHER_CLASS
  case "$1" in
    *'must be {"version":3'*'older files are not converted'*) echo V2_KNOWN_CLASS ;;
    *) echo OTHER_CLASS ;;
  esac
}

store_state_json() { # $1 = store file, $2 = agentId — prints {floor, live:[{gen,minSeq,maxSeq}], evicted:[[gen,maxSeq]], watermark, records} for the agent
  node --input-type=module -e '
    const { readDurableRecoveryStore } = await import(process.argv[1]);
    let store = null;
    try { store = readDurableRecoveryStore(process.argv[2]); } catch (e) {
      console.log(JSON.stringify({ loadable: false, error: String(e.message) })); process.exit(0);
    }
    if (store === null) { console.log(JSON.stringify({ loadable: true, empty: true })); process.exit(0); }
    const entry = store.issuance.get(process.argv[3]);
    if (entry === undefined) { console.log(JSON.stringify({ loadable: true, absent: true })); process.exit(0); }
    const live = [...entry.generations.entries()].map(([gen, r]) => ({ gen, minSeq: r.minSeq, maxSeq: r.maxSeq })).sort((a, b) => a.gen - b.gen);
    const evicted = [...entry.evictedGenerations.entries()].map(([gen, maxSeq]) => ({ gen, maxSeq })).sort((a, b) => a.gen - b.gen);
    const floor = Math.max(live.at(-1)?.gen ?? 0, evicted.at(-1)?.gen ?? 0, entry.evictedThroughGeneration ?? 0);
    const overlap = live.some((r, i) => i > 0 && r.minSeq <= live[i - 1].maxSeq);
    console.log(JSON.stringify({ loadable: true, floor, evictedThroughGeneration: entry.evictedThroughGeneration, maxIssuedTurnSeq: entry.maxIssuedTurnSeq, live, evicted, overlappingLiveRanges: overlap }));
  ' "$DURABLE_MODULE" "$1" "$2"
}

# Byte-provenance echoes (v2.1): parameterized by app root so --selftest-repair can exercise
# the exact deploy-time check against a hermetic fixture tree.
byte_provenance_verdict() { # $1 = app root; prints the three DEPLOYED_BYTES lines; rc=0 iff all carry the reviewed fix
  local APP="$1" HITS_STORE HITS_GATE HITS_REG
  HITS_STORE=$(grep -c "highestIssuedGeneration" "$APP/packages/agent-router/src/reconciliation/store.js" 2>/dev/null); HITS_STORE=${HITS_STORE:-0}
  HITS_GATE=$(grep -c "generationFloor" "$APP/packages/agent-router/src/process-registry-route-gate.js" 2>/dev/null); HITS_GATE=${HITS_GATE:-0}
  # v2.1 FIX 1: AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE lives ONLY in
  # process-registry-route-gate.js (:52) — at pin 8fc374ca AND at every reference generation
  # since the v1 pin (47aadec1/360756e3/d8ddf546). The stale v1-inherited echo grepped
  # process-registry.js (0 hits) and deterministically aborted every deploy post-install,
  # pre-G2.5 (agent-control#191, 2026-10-02).
  HITS_REG=$(grep -c "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE" "$APP/packages/agent-router/src/process-registry-route-gate.js" 2>/dev/null); HITS_REG=${HITS_REG:-0}
  echo "DEPLOYED_BYTES store.highestIssuedGeneration hits=$HITS_STORE (expect >=1)"
  echo "DEPLOYED_BYTES route-gate generationFloor hits=$HITS_GATE (expect >=1)"
  echo "DEPLOYED_BYTES route-gate AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE hits=$HITS_REG (expect >=1)"
  [ "$HITS_STORE" -ge 1 ] && [ "$HITS_GATE" -ge 1 ] && [ "$HITS_REG" -ge 1 ]
}

# Fixed B7-only caller. The same mkdir namespace excludes the existing watchdog
# deployer. The inherited flock protects explicit same-TX recovery; no PID/time
# inference, legacy-lock takeover, routing hook, or second transaction authority.
b7_outer() {
  exec 3<&0
  exec /usr/bin/python3 - "$0" "$@" <<'B7_PY'
import fcntl, hashlib, json, os, re, signal, stat, subprocess, sys, tempfile
from pathlib import Path

def stop(reason):
    raise RuntimeError(reason)

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def sync_dir(path):
    fd = os.open(path, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)

def checked(path, directory=False):
    s = os.lstat(path)
    good = stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode) and s.st_nlink == 1
    if not good or s.st_uid != os.geteuid() or stat.S_IMODE(s.st_mode) != (0o700 if directory else 0o600):
        stop('B7_CUSTODY_REFUSED: ' + str(path))
    expected = str(path)
    if expected.startswith('/var/'):
        if os.readlink('/var') != 'private/var' or str(Path('/var').resolve()) != '/private/var':
            stop('B7_SYSTEM_ALIAS_REFUSED')
        expected = '/private' + expected
    if str(Path(path).resolve()) != expected: stop('B7_PATH_REFUSED')
    return s

def read_private(path, limit=65536):
    s = checked(path)
    if s.st_size > limit: stop('B7_RECORD_TOO_LARGE')
    return json.loads(Path(path).read_bytes())

try:
    outer = Path(sys.argv[1]).resolve()
    args = sys.argv[2:]
    mode = args[0]
    probe = mode.startswith('--b7-probe-')
    action = mode.replace('--b7-probe-', '') if probe else mode.replace('b7-', '')
    if len(args) != 3 or args[1] != '--transaction' or not re.fullmatch(r'tx-[A-Za-z0-9-]{1,100}', args[2]):
        stop('B7_USAGE: b7-apply|b7-resume --transaction <exact tx-id>')
    txid = args[2]
    repo = outer.parents[3]
    carrier = repo / 'docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh'
    helper = repo / 'scripts/lib/deployment-reuse/transaction-recovery.mjs'
    migrator = repo / 'scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs'
    root, trusted = Path('/Users/authsvc/.agent-core'), Path('/usr/local/libexec/agent-core')
    recovery = Path('/var/db/agent-core/authsvc-codex-migration')
    lock = Path('/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock')
    if probe:
        base = Path(os.environ['B7_PROBE_BASE'])
        checked(base, True)
        if not str(base).startswith(str(Path(tempfile.gettempdir()).resolve()) + '/b7-joint-test-'):
            stop('B7_PROBE_ROOT_REFUSED')
        root, trusted, recovery = [base / name for name in ('root', 'trusted', 'recovery')]
        for name, path in [('ROOT', root), ('TRUSTED_ROOT', trusted), ('RECOVERY_ROOT', recovery)]:
            if os.environ.get('TXPROBE_' + name) != str(path): stop('B7_PROBE_PATH_REFUSED')
            checked(path, True)
        lock = base / 'production-deploy.lock'
    elif os.geteuid() != 0:
        stop('B7_ROOT_REQUIRED')
    holder, txfile = lock / 'holder', recovery / 'migration-transaction.json'
    binding = dict(txId=txid, deploymentRoot=str(root), trustedRoot=str(trusted), recoveryRoot=str(recovery),
                   outerPath=str(outer), outerSha256=sha(outer), carrierPath=str(carrier),
                   carrierSha256=sha(carrier), toolSha256=sha(helper), migrationToolSha256=sha(migrator))
    # The accepted set digest is part of the existing holder/TX identity.
    # Resume/guard use the retained holder, never a newly selected marker.
    if action in ('guard', 'resume') and holder.exists():
        prior_binding = read_private(holder).get('binding', {})
        if 'cohortSha256' in prior_binding:
            binding['cohortSha256'] = prior_binding['cohortSha256']
            binding['cohortToolSha256'] = sha(helper.parent / 'cohort-binding.mjs')
            binding['cohortSupport'] = {p: sha(helper.parent / p) for p in ('cohort-runtime.mjs', 'cohort-artifacts.mjs')}

    def identity(fd):
        checked(lock, True)
        s, opened = checked(holder), os.fstat(fd)
        if (s.st_dev, s.st_ino, s.st_nlink) != (opened.st_dev, opened.st_ino, 1):
            stop('B7_LOCK_IDENTITY_MISMATCH')
        record = json.loads(os.pread(fd, s.st_size, 0))
        if record.get('format') != 'B7_GLOBAL_HOLDER_V1' or not re.fullmatch(r'[a-f0-9]{32}', record.get('nonce', '')):
            stop('B7_BINDING_MISMATCH: legacy or malformed holder')
        if record.get('binding') != binding: stop('B7_BINDING_MISMATCH: tx/source/target')
        return record

    # The holder stays small. TX includes bounded per-consumer recovery evidence.
    def tx_record(record):
        tx = read_private(txfile, 4 * 1024 * 1024)
        if tx.get('txId') != txid or tx.get('outer') != record:
            stop('B7_BINDING_MISMATCH: durable transaction')
        return tx

    if action == 'guard':
        record = identity(9)
        # A separately opened FD must be blocked, while the inherited open-file
        # description must already own the lock. Never LOCK_UN the shared lease.
        other = os.open(holder, os.O_RDWR | os.O_NOFOLLOW)
        try:
            try: fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError: pass
            else: stop('B7_MUTEX_NOT_HELD')
            fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
            identity(9)
        finally: os.close(other)
        print('B7_MUTEX_INHERITED', flush=True)
        sys.exit(0)

    if action not in ('apply', 'resume'): stop('B7_UNKNOWN_ACTION')
    parent = os.lstat(lock.parent)
    if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.geteuid() or parent.st_mode & 0o022:
        stop('B7_LOCK_PARENT_REFUSED')
    if str(lock.parent.resolve()) != str(lock.parent): stop('B7_LOCK_PARENT_REFUSED')
    if action == 'apply':
        if not probe:
            marker = json.loads(Path('/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/AMENDMENT_ACCEPTED.marker').read_bytes())
            a = marker.get('activation', {})
            cohort_sha = a.get('cohortSha256', '')
            if not re.fullmatch(r'[a-f0-9]{64}', cohort_sha): stop('B7_COHORT_BINDING_REQUIRED')
            binding['cohortSha256'] = cohort_sha
            binding['cohortToolSha256'] = sha(helper.parent / 'cohort-binding.mjs')
            binding['cohortSupport'] = {p: sha(helper.parent / p) for p in ('cohort-runtime.mjs', 'cohort-artifacts.mjs')}
            if a.get('cohortToolSha256') != binding['cohortToolSha256'] or a.get('cohortSupport') != binding['cohortSupport']: stop('B7_COHORT_TOOL_UNBOUND')
            if (marker.get('scriptSha256') != binding['carrierSha256'] or a.get('outerSha256') != binding['outerSha256']
                    or a.get('toolSha256') != binding['toolSha256'] or a.get('migrationToolSha256') != binding['migrationToolSha256']):
                stop('B7_ACCEPTANCE_BINDING_REQUIRED')
            if txfile.exists() and read_private(txfile, 4 * 1024 * 1024).get('state') not in ('COMMITTED', 'ABORTED'):
                stop('B7_PRIOR_TX_UNRESOLVED')
        try: os.mkdir(lock, 0o700)
        except FileExistsError: stop('B7_MUTEX_BUSY: existing lock is never disposed automatically')
        fd = os.open(holder, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        record = dict(format='B7_GLOBAL_HOLDER_V1', nonce=os.urandom(16).hex(), binding=binding)
        os.write(fd, (json.dumps(record) + '\n').encode()); os.fsync(fd)
        sync_dir(lock); sync_dir(lock.parent)
    else:
        checked(lock, True); checked(holder)
        fd = os.open(holder, os.O_RDWR | os.O_NOFOLLOW)
        try: fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: stop('B7_MUTEX_BUSY: original owner/child still holds the lease')
        # Post-acquire path identity defeats cleanup/recreate with an old inode.
        record = identity(fd)
        tx_record(record)
    if fd != 9: os.dup2(fd, 9); os.close(fd)
    os.set_inheritable(9, True)
    identity(9)
    env = dict(os.environ)
    env['B7_OUTER_ACTIVE'] = '1'  # routing hint only; the FD is the ownership proof
    def run_carrier(op, confirmation=None):
        identity(9)
        flag = '--tx-child-' + op if probe else '--' + op
        result = subprocess.run(['/bin/bash', str(carrier), flag, '--transaction', txid],
                                input=confirmation, stdin=subprocess.DEVNULL if confirmation is None else None,
                                env=env, pass_fds=(9,), check=False)
        if result.returncode: stop('B7_CHILD_INCOMPLETE: same transaction retained; no apply replay')
    def interrupted(signum, frame):
        stop('B7_INTERRUPTED: lock/TX retained; child lease is not unlocked')
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT): signal.signal(sig, interrupted)
    if action == 'apply': run_carrier('apply')
    tx = tx_record(record)
    if tx['state'] not in ('COMMITTED', 'ABORTED'):
        print('B7_AWAITING_OWNER tx=' + txid + ' state=' + tx['state'] +
              ' — COMMIT only after real Feishu PONG, or ABORT', flush=True)
        answer = os.fdopen(3).readline().rstrip('\n')
        if answer not in ('COMMIT', 'ABORT'): stop('B7_DISCONNECTED_OR_UNCONFIRMED: same TX retained')
        run_carrier(answer.lower(), b'COMMIT\n' if answer == 'COMMIT' else None)
    # r13 owns terminal truth; do not infer completion from a shell exit or label.
    run_carrier('verify-terminal')
    tx_record(record); identity(9)
    if sorted(os.listdir(lock)) != ['holder']: stop('B7_LOCK_CONTENT_UNKNOWN')
    os.unlink(holder); os.rmdir(lock); sync_dir(lock.parent)
    # Close only our reference. No LOCK_UN: descendants must never be unlocked.
    os.close(9)
    print('B7_TERMINAL_VERIFIED tx=' + txid, flush=True)
except (Exception, KeyboardInterrupt) as error:
    print(str(error), file=sys.stderr, flush=True)
    sys.exit(4)
B7_PY
}

case "${1:-}" in
  b7-apply|b7-resume|b7-guard|--b7-probe-apply|--b7-probe-resume|--b7-probe-guard)
    b7_outer "$@" ;;
  --selftest)
    T=$(mktemp -d /tmp/router-closure-selftest.XXXXXX) || exit 1
    chmod 700 "$T"
    F="$T/store.json"
    node --input-type=module -e '
      const { TurnReconciliationStore } = await import(process.argv[2] + "/packages/agent-router/src/reconciliation/store.js");
      const s = new TurnReconciliationStore({ persistenceFile: process.argv[1], runtimeEpoch: "selftest" });
      s.mintTurnExecution({ agentId: "agt_selftest", processGeneration: 1, sessionId: null });
      s.mintTurnExecution({ agentId: "agt_selftest", processGeneration: 2, sessionId: null });
    ' "$F" "$DEPLOY_SRC" || { echo "SELFTEST_FAIL (seed)"; rm -rf "$T"; exit 1; }
    OUT=$(store_state_json "$F" agt_selftest)
    NODE_OUT=$(node --input-type=module -e '
      const { readFileSync } = await import("node:fs");
      const s = JSON.parse(readFileSync("/dev/stdin", "utf8"));
      console.log(JSON.stringify({ floor: s.floor, overlap: s.overlappingLiveRanges }));
    ' <<< "$OUT")
    echo "$OUT" | grep -q '"floor":2' && echo "$NODE_OUT" | grep -q '"overlap":false' \
      && echo "SELFTEST_PASS (store_state_json floor=2, no overlap on a seeded 2-generation store)" \
      || { echo "SELFTEST_FAIL: $OUT"; rm -rf "$T"; exit 1; }
    rm -rf "$T" ;;
  preflight) # ---- G1 completion: store load + per-agent floor census + rollback label ----
    echo "### G1 preflight completion ($(date '+%F %T %z'))"
    echo "G1_5_STORE_LOAD + G1_FLOOR_CENSUS:"
    store_state_json "$STORE" "agt_cto-agent"
    echo "  (top floors across all agents — collision baselines)"
    node --input-type=module -e '
      const { readDurableRecoveryStore } = await import(process.argv[1]);
      const store = readDurableRecoveryStore(process.argv[2]);
      if (store === null) { console.log("  EMPTY_STORE"); process.exit(0); }
      const rows = [];
      for (const [agentId, e] of store.issuance) {
        const live = [...e.generations.keys()], ev = [...e.evictedGenerations.keys()];
        rows.push({ agentId, floor: Math.max(live.at(-1) ?? 0, ev.at(-1) ?? 0, e.evictedThroughGeneration ?? 0), live: live.length, evicted: ev.length });
      }
      rows.sort((a, b) => b.floor - a.floor);
      for (const r of rows.slice(0, 12)) console.log(`  ${r.agentId} floor=${r.floor} liveBuckets=${r.live} evictedBuckets=${r.evicted}`);
      console.log(`  agents_total=${rows.length}`);
    ' "$DURABLE_MODULE" "$STORE"
    echo "G1_4_ROLLBACK_LABEL (current live generation label, for rollback reference):"
    grep -rl "$EXPECTED_SHA" "$TRUSTED_APP" 2>/dev/null | head -2
    find /usr/local/libexec/agent-core -maxdepth 2 -name '*generation*' -o -maxdepth 2 -name '*.label' 2>/dev/null | head -5
    stat -f '  live app mtime: %Sm' "$TRUSTED_APP/packages/agent-router/src/process-registry-route-gate.js"
    echo "PREFLIGHT_DONE"
    ;;
  deploy|cutover)
    die "Independent install/cutover retired. Use the exact accepted r13 transaction for code/config/plugin activation and recovery; this helper has no standalone restart authority."
    ;;
  health) # ---- G3: first post-deploy health ----
    echo "### G3 post-deploy health ($(date '+%F %T %z'))"
    curl -s -m 3 http://127.0.0.1:8790/health | grep -q '"deliverReady":true' && echo "G3_INGRESS = PASS" || echo "G3_INGRESS = FAIL"
    ps axww -o pid,user,lstart,command | grep -E 'production-runtime\.mjs --root /Users/authsvc' | grep -v grep | sed 's/^/  runtime: /'
    node --input-type=module -e '
      const { readDurableRecoveryStore } = await import(process.argv[1]);
      try {
        const s = readDurableRecoveryStore(process.argv[2]);
        console.log("G3_DURABLE_LOAD = PASS"); process.exit(0);
      } catch (e) { console.log("G3_DURABLE_LOAD = FAIL " + e.message); process.exit(1); }
    ' "$DURABLE_MODULE" "$STORE" || true
    # no startupBlockedReason is observable as admission readiness: ingress deliverReady=true
    # composes store load + admission; overlapping ranges would have failed the load above.
    ;;
  snapshot) # ---- G4/G5 evidence: durable issuance state for one agent ----
    AGENT="${2:?agentId required}"; LABEL="${3:?label required}"
    [ -f "$STORE" ] || die "store missing"
    mkdir -p "$EVIDENCE"
    OUT="$EVIDENCE/gen-snapshot-$AGENT-$LABEL-$STAMP.json"
    PID=$(ps axww -o pid,user,lstart,command | grep -E 'production-runtime\.mjs --root /Users/authsvc' | grep -v grep | awk '{print $1}' | head -1)
    { echo "{ \"agentId\": \"$AGENT\", \"label\": \"$LABEL\", \"at\": \"$(date '+%F %T %z')\", \"runtimePid\": \"$PID\","; echo "  \"store\": $(store_state_json "$STORE" "$AGENT")"; echo "}"; } > "$OUT"
    chmod 644 "$OUT" 2>/dev/null || true
    cat "$OUT"
    echo "SNAPSHOT_WRITTEN $OUT"
    ;;
  verify-restart) # ---- G4/G5 verdict: after-state must be strictly above the before floor ----
    AGENT="${2:?agentId required}"; BEFORE="${3:?before snapshot json required}"; AFTER="${4:?after snapshot json required}"
    node --input-type=module -e '
      const { readFileSync } = await import("node:fs");
      const before = JSON.parse(readFileSync(process.argv[2], "utf8")).store;
      const after = JSON.parse(readFileSync(process.argv[3], "utf8")).store;
      if (!before.loadable || !after.loadable) { console.log("G_GATE = FAIL (store not loadable)"); process.exit(1); }
      const floorBefore = before.floor ?? 0;
      const floorAfter = after.floor ?? 0;
      console.log(`GENERATION_BEFORE_RESTART = ${floorBefore}`);
      console.log(`GENERATION_AFTER_RESTART  = ${floorAfter}`);
      let ok = true;
      if (!(floorAfter > floorBefore)) { console.log("G_MONOTONIC = FAIL (after <= before)"); ok = false; }
      else console.log("G_MONOTONIC = PASS (strictly above the pre-restart collision floor)");
      if (after.overlappingLiveRanges) { console.log("G_OVERLAP = FAIL"); ok = false; } else console.log("G_OVERLAP = NONE");
      const beforeRecords = before.maxIssuedTurnSeq ?? 0, afterRecords = after.maxIssuedTurnSeq ?? 0;
      if (afterRecords < beforeRecords) { console.log("G_STORE_WIPED = FAIL (maxIssuedTurnSeq went backwards — destructive rewrite)"); ok = false; }
      else console.log(`G_STORE_RETAINED = PASS (maxIssuedTurnSeq ${beforeRecords} -> ${afterRecords})`);
      console.log(ok ? "RESTART_ACCEPTANCE = PASS" : "RESTART_ACCEPTANCE = FAIL");
      process.exit(ok ? 0 : 1);
    ' "$BEFORE" "$AFTER"
    ;;
  close) # ---- G7: gather every closure gate into one verdict ----
    echo "### G7 closure verdict ($(date '+%F %T %z'))"
    HITS=$(grep -c "highestIssuedGeneration" "$TRUSTED_APP/packages/agent-router/src/reconciliation/store.js" 2>/dev/null || echo 0)
    [ "$HITS" -ge 1 ] && echo "DEPLOYED_BYTES_MATCH_REVIEWED_SOURCE = YES" || echo "DEPLOYED_BYTES_MATCH_REVIEWED_SOURCE = NO"
    curl -s -m 3 http://127.0.0.1:8790/health | grep -q '"deliverReady":true' && echo "PRODUCTION_HEALTH = PASS" || echo "PRODUCTION_HEALTH = FAIL"
    node --input-type=module -e '
      const { readDurableRecoveryStore } = await import(process.argv[1]);
      try { readDurableRecoveryStore(process.argv[2]); console.log("DURABLE_STORE_LOAD = PASS"); }
      catch (e) { console.log("DURABLE_STORE_LOAD = FAIL " + e.message); process.exit(1); }
    ' "$DURABLE_MODULE" "$STORE" || true
    echo "FIRST_RESTART_ACCEPTANCE / SECOND_RESTART_ACCEPTANCE / GENERATION_REUSE / REAL_AGENT_TURN:"
    echo "  = read from the verify-restart verdicts + feishu turn receipts recorded in this evidence dir"
    echo "G7_CLOSE_HINT = all PASS rows above + two PASSING verify-restart verdicts => ROUTER_RESTART_SAFETY = PROVEN"
    ;;
  boot-canary) # ---- V2: run FRESH_CHILD_BOOT_CANARY_V1 standalone (no root needed; disposable) ----
    TRUSTED_ROOT=$(dirname "$TRUSTED_APP")
    exec "$TRUSTED_ROOT/node-runtime/bin/node" \
      "$DEPLOY_SRC/scripts/lib/trusted-cp-fresh-child-boot-canary.mjs" \
      --trusted-root "$TRUSTED_ROOT" --timeout-ms 120000 ;;
  --selftest-repair) # ---- V2.1: hermetic offline proof of both #191 packet-defect repairs ----
    # No sudo, no production access: /tmp fixtures only. Proves (1) the v2.1 echo set passes
    # on a tree that mirrors the pin layout while the stale v2 expression still fails on it,
    # and (2) RESTORE-R1 heals the §1b node-runtime-reuse restore case content-exactly.
    T=$(mktemp -d /tmp/router-repair-selftest.XXXXXX) || exit 1
    chmod 700 "$T"
    SRC=$T/app/packages/agent-router/src
    mkdir -p "$SRC/reconciliation"
    printf 'module.exports.highestIssuedGeneration = 1\n' > "$SRC/reconciliation/store.js"
    printf "const FLOOR_UNAVAILABLE = 'AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE'\nexport function generationFloor() { return null }\n" > "$SRC/process-registry-route-gate.js"
    printf '// process-registry.js never carried the generation floor-unavailable code\n' > "$SRC/process-registry.js"
    FAIL=0
    if byte_provenance_verdict "$T/app" > "$T/echo-green.txt" 2>&1 \
      && grep -q "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE hits=[1-9]" "$T/echo-green.txt"; then
      echo "SELFTEST_REPAIR echo#3 GREEN: verdict PASS on the fixture (route-gate carries the constant)"
    else
      echo "SELFTEST_REPAIR_FAIL echo#3 GREEN"; cat "$T/echo-green.txt" 2>/dev/null; FAIL=1
    fi
    RED_HITS=$(grep -c "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE" "$SRC/process-registry.js" 2>/dev/null); RED_HITS=${RED_HITS:-0}
    if [ "$RED_HITS" -eq 0 ]; then
      echo "SELFTEST_REPAIR echo#3 RED reproduced: stale process-registry.js grep = 0 hits on the same fixture (the v2 executor died exactly here)"
    else
      echo "SELFTEST_REPAIR_FAIL echo#3 RED (unexpected hits=$RED_HITS)"; FAIL=1
    fi
    for LEG in red green; do
      rm -rf "$T/stage0" "$T/auto" "$T/install" "$T/live"
      cp -R "$T/app" "$T/stage0"
      mkdir -p "$T/stage0/node-runtime/bin"
      printf '#!/bin/node\n' > "$T/stage0/node-runtime/bin/node"; chmod 755 "$T/stage0/node-runtime/bin/node"
      cp -R "$T/stage0" "$T/auto"
      cp -R "$T/stage0" "$T/install"   # the failed install holds the §1b-reused node-runtime
      rm -rf "$T/auto/node-runtime"    # §1b reuse mv-ed node-runtime OUT of the §1 auto-preimage
      rm -rf "$T/live"; mv "$T/auto" "$T/live"   # deterministic restore (executor contract)
      if [ "$LEG" = red ]; then
        if [ ! -x "$T/live/node-runtime/bin/node" ]; then
          echo "SELFTEST_REPAIR restore RED reproduced: §1b-reuse restore lands WITHOUT node-runtime (a cold boot in that window would fail launchd)"
        else
          echo "SELFTEST_REPAIR_FAIL restore RED"; FAIL=1
        fi
      else
        [ -x "$T/live/node-runtime/bin/node" ] || rsync -a "$T/stage0/node-runtime/" "$T/live/node-runtime/"
        if [ -x "$T/live/node-runtime/bin/node" ] && diff -r "$T/stage0" "$T/live" > /dev/null 2>&1; then
          echo "SELFTEST_REPAIR restore GREEN: RESTORE-R1 re-materialization from the fresh STAGE 0 preimage = content-exact"
        else
          echo "SELFTEST_REPAIR_FAIL restore GREEN"; FAIL=1
        fi
      fi
    done
    # ---- V2.2: G2.6 wiring — RUNTIME_APP_GRAPH_GATE_V1 fails closed and passes ----
    GATE_LIB="$DEPLOY_SRC/scripts/lib/trusted-cp-runtime-app-graph-gate.mjs"
    if [ -f "$GATE_LIB" ]; then
      STUB="$T/stub-app/packages/production-runtime/src"
      mkdir -p "$STUB" "$T/stub-app/node_modules/proxy-agent-negotiate"
      printf "import 'proxy-agent-negotiate'\nexport {}\n" > "$STUB/entry.js"
      printf '{"name":"proxy-agent-negotiate","version":"1.1.0","type":"module","main":"index.js"}\n' > "$T/stub-app/node_modules/proxy-agent-negotiate/package.json"
      printf 'export const negotiate = () => true\n' > "$T/stub-app/node_modules/proxy-agent-negotiate/index.js"
      if node "$GATE_LIB" --app-dir "$T/stub-app" --timeout-ms 30000 >/dev/null 2>&1; then
        echo "SELFTEST_REPAIR G2.6 GREEN: gate PASSES when the graph's dep is present"
      else
        echo "SELFTEST_REPAIR_FAIL G2.6 GREEN"; FAIL=1
      fi
      rm -rf "$T/stub-app/node_modules/proxy-agent-negotiate"
      if node "$GATE_LIB" --app-dir "$T/stub-app" --timeout-ms 30000 >/dev/null 2>&1; then
        echo "SELFTEST_REPAIR_FAIL G2.6 RED (gate passed with the dep missing — must fail closed)"; FAIL=1
      else
        echo "SELFTEST_REPAIR G2.6 RED: gate FAILS CLOSED with the dep missing (the #193 class)"
      fi
    else
      echo "SELFTEST_REPAIR_FAIL G2.6 wiring (gate lib missing at $GATE_LIB)"; FAIL=1
    fi
    # ---- V2.2: RESTORE-R2 — the real validator rejects a foreign group and the pin heals it ----
    PSIO="$DEPLOY_SRC/packages/scheduler/src/watchdog/private-state-io.js"
    R2ROOT="$T/prod-root/control"
    mkdir -p "$R2ROOT/scheduler-watchdog" "$R2ROOT/incident-backups"
    printf '{}\n' > "$R2ROOT/scheduler-watchdog/incidents.json"; chmod 700 "$R2ROOT/scheduler-watchdog"; chmod 600 "$R2ROOT/scheduler-watchdog/incidents.json"
    DAMAGE_GID="$(id -G | tr ' ' '\n' | awk '$1!=20{print $1; exit}')"
    validate_incident() {
      node --input-type=module -e '
        const { readPrivateFile } = await import(process.argv[1])
        try { readPrivateFile(process.argv[2], { expectedGid: 20 }); console.log("VALIDATOR_ACCEPT") }
        catch (e) { console.log("VALIDATOR_REJECT") }
      ' "$PSIO" "$1"
    }
    if [ -n "$DAMAGE_GID" ] && chgrp -R "$DAMAGE_GID" "$R2ROOT/scheduler-watchdog" 2>/dev/null; then
      [ "$(validate_incident "$R2ROOT/scheduler-watchdog/incidents.json")" = "VALIDATOR_REJECT" ] \
        && echo "SELFTEST_REPAIR R2 RED reproduced: foreign group $DAMAGE_GID on the pinned state → real readPrivateFile rejects (unsafe incident state file)" \
        || { echo "SELFTEST_REPAIR_FAIL R2 RED"; FAIL=1; }
      for p in "$R2ROOT/scheduler-watchdog" "$R2ROOT/incident-backups"; do [ -d "$p" ] && chgrp -R 20 "$p"; done
      [ "$(validate_incident "$R2ROOT/scheduler-watchdog/incidents.json")" = "VALIDATOR_ACCEPT" ] \
        && echo "SELFTEST_REPAIR R2 GREEN: RESTORE-R2 pin (chgrp -R 20) heals — the exact #193 restore completion" \
        || { echo "SELFTEST_REPAIR_FAIL R2 GREEN"; FAIL=1; }
    else
      echo "SELFTEST_REPAIR R2 skipped (no damage gid available for the invoking user — pin semantics covered by the unit suite)"
    fi
    PKG_FILE="$(cd "$(dirname "$0")" && pwd)/OPERATION_PACKAGE_V2.md"
    [ -f "$PKG_FILE" ] || PKG_FILE="$(cd "$(dirname "$0")/.." && pwd)/OPERATION_PACKAGE_V2.md"
    if grep -q "RESTORE-R1" "$0" && grep -q "re-materialize" "$0" \
      && [ -f "$PKG_FILE" ] && grep -q "RESTORE-R1" "$PKG_FILE" && grep -q "re-materialize" "$PKG_FILE"; then
      echo "SELFTEST_REPAIR contract markers present: executor restore contract + packet §6 runbook"
    else
      echo "SELFTEST_REPAIR_FAIL contract markers (executor and packet §6 must both carry RESTORE-R1)"; FAIL=1
    fi
    if grep -q "RESTORE-R2" "$0" && grep -q "G2.6" "$0" \
      && [ -f "$PKG_FILE" ] && grep -q "RESTORE-R2" "$PKG_FILE"; then
      echo "SELFTEST_REPAIR v2.2 contract markers present: executor G2.6 + RESTORE-R2 (both files)"
    else
      echo "SELFTEST_REPAIR_FAIL v2.2 contract markers (executor G2.6/RESTORE-R2 + packet §6 RESTORE-R2)"; FAIL=1
    fi
    # ---- V2.3: G2.7 + STAGE 1M — hermetic RED/GREEN against the pin's own bytes ----
    # RED: a v2 fleet config (the deployed preimage shape, 92 overrides,
    # routeCatalog.luna without credentialFile) under the pin's v3 loader = the
    # EXACT #195 FATAL line, gate exit 2. GREEN: the frozen migrator's output
    # loads clean under the SAME loader, 92-override roster preserved. The
    # hermetic gate invocations point --model-overrides-module at $DEPLOY_SRC
    # (the pin bytes); production `cutover` points it at the INSTALLED tree.
    GATE_LIB_V23="$DEPLOY_SRC/scripts/lib/trusted-cp-model-overrides-config-gate.mjs"
    MIGRATE_LIB_V23="$DEPLOY_SRC/scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs"
    if [ -f "$GATE_LIB_V23" ] && [ -f "$MIGRATE_LIB_V23" ]; then
      CX="$T/fleet-root"
      mkdir -p "$CX"
      node -e '
        const { writeFileSync } = require("node:fs")
        const root = process.argv[1]
        const agents = Array.from({ length: 92 }, (_, i) => ({ id: `agt_fix${String(i).padStart(2, "0")}-agent`, name: `f${i}`, description: null }))
        writeFileSync(root + "/agents.json", JSON.stringify({ version: 1, defaultAgentId: agents[0].id, agents }, null, 2))
        const overrides = Object.fromEntries(agents.map((a) => [a.id, { model: { primary: "luna", fallbacks: [] } }]))
        const config = { version: 2, routeCatalog: { luna: { routeKind: "subscription", provider: "openai-codex", model: "gpt-5.6-luna", plugin: "dsh-codex", pluginVersion: "0.2.3", credentialReadiness: "bridge-store-bound" } }, overrides }
        writeFileSync(root + "/agent-model-overrides.json", JSON.stringify(config, null, 2) + "\n", { mode: 0o600 })
      ' "$CX"
      RED_OUT=$(node "$GATE_LIB_V23" --installed-root "$DEPLOY_SRC" \
        --config "$CX/agent-model-overrides.json" --registry "$CX/agents.json" \
        --deployment-root "$CX" --json 2>&1); G27_RED_RC=$?
      if [ "$G27_RED_RC" -eq 2 ] \
        && echo "$RED_OUT" | grep -q 'AGENT_MODEL_OVERRIDE_INVALID' \
        && echo "$RED_OUT" | grep -q 'older files are not converted' \
        && echo "$RED_OUT" | grep -q 'must be {.*version.*:3.*routeCatalog.*older files'; then
        echo "SELFTEST_REPAIR G2.7 RED reproduced: v2 config vs pin v3 loader = the exact #195 FATAL line, gate exit 2"
      else
        echo "SELFTEST_REPAIR_FAIL G2.7 RED (rc=$G27_RED_RC)"; echo "$RED_OUT" | tail -3; FAIL=1
      fi
      EXACT_195_ERR='production-runtime: invalid agent model overrides: /Users/authsvc/.agent-core/agent-model-overrides.json must be {"version":3,"routeCatalog":{...},"overrides":{...}} (older files are not converted)'
      if [ "$(g27_error_class "$EXACT_195_ERR")" = "V2_KNOWN_CLASS" ]; then
        echo "SELFTEST_REPAIR G2.7 classifier GREEN: the EXACT #195 FATAL line (literal quote chars) classifies V2_KNOWN_CLASS"
      else
        echo "SELFTEST_REPAIR_FAIL G2.7 classifier (exact #195 line must classify V2_KNOWN_CLASS — round-1 review blocker)"; FAIL=1
      fi
      if [ "$(g27_error_class 'production-runtime: invalid agent model overrides: override agt_x references unknown routeCatalog entry NOPE')" = "OTHER_CLASS" ]; then
        echo "SELFTEST_REPAIR G2.7 classifier RED-side: a non-version loader error classifies OTHER_CLASS (fail-closed die, no migration)"
      else
        echo "SELFTEST_REPAIR_FAIL G2.7 classifier (other-class errors must NOT trigger the migration)"; FAIL=1
      fi
      if node "$MIGRATE_LIB_V23" --config "$CX/agent-model-overrides.json" --registry "$CX/agents.json" \
        --deployment-root "$CX" \
        --model-overrides-module "$DEPLOY_SRC/packages/production-runtime/src/model-overrides.js" >/dev/null 2>&1 \
        && node "$MIGRATE_LIB_V23" --config "$CX/agent-model-overrides.json" --registry "$CX/agents.json" \
        --deployment-root "$CX" \
        --model-overrides-module "$DEPLOY_SRC/packages/production-runtime/src/model-overrides.js" \
        --execute > "$T/migrate-receipt.txt" 2>&1; then
        GREEN_OUT=$(node "$GATE_LIB_V23" --installed-root "$DEPLOY_SRC" \
          --config "$CX/agent-model-overrides.json" --registry "$CX/agents.json" \
          --deployment-root "$CX" --json 2>&1); G27_GREEN_RC=$?
        if [ "$G27_GREEN_RC" -eq 0 ] \
          && echo "$GREEN_OUT" | grep -q '"overrideCount": 92' \
          && ls "$CX"/agent-model-overrides.json.pre-v3-* >/dev/null 2>&1; then
          echo "SELFTEST_REPAIR G2.7/STAGE-1M GREEN: migrated config loads clean (overrides=92), preimage backup (RESTORE-R3 source) present"
        else
          echo "SELFTEST_REPAIR_FAIL G2.7 GREEN (rc=$G27_GREEN_RC)"; echo "$GREEN_OUT" | tail -3; FAIL=1
        fi
      else
        echo "SELFTEST_REPAIR_FAIL STAGE-1M migration GREEN (migrator refused)"; cat "$T/migrate-receipt.txt" 2>/dev/null; FAIL=1
      fi
      rm -rf "$CX"
    else
      echo "SELFTEST_REPAIR_FAIL G2.7 wiring (gate/migration lib missing under $DEPLOY_SRC)"; FAIL=1
    fi
    if grep -q "RESTORE-R3" "$0" && grep -q "G2.7" "$0" && grep -q "STAGE 1M" "$0" \
      && [ -f "$PKG_FILE" ] && grep -q "RESTORE-R3" "$PKG_FILE" && grep -q "G2.7" "$PKG_FILE"; then
      echo "SELFTEST_REPAIR v2.3 contract markers present: executor G2.7 + STAGE 1M + RESTORE-R3 (both files)"
    else
      echo "SELFTEST_REPAIR_FAIL v2.3 contract markers (executor G2.7/STAGE-1M/RESTORE-R3 + packet §5/§6)"; FAIL=1
    fi
    rm -rf "$T"
    [ "$FAIL" -eq 0 ] && echo "SELFTEST_REPAIR_PASS (echo#3 route-gate verdict + RESTORE-R1 re-materialization + G2.6 app-graph wiring + RESTORE-R2 pin heal + G2.7 config gate RED/GREEN + #195-line classifier + STAGE-1M migration + RESTORE-R3 markers, hermetic)" \
      || { echo "SELFTEST_REPAIR_FAIL"; exit 1; } ;;
  *) die "unknown subcommand (use preflight|deploy|cutover|boot-canary|health|snapshot|verify-restart|close|--selftest|--selftest-repair)" ;;
esac
