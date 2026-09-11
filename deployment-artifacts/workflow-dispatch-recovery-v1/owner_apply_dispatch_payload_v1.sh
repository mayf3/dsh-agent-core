#!/bin/bash
# owner_apply_dispatch_payload_v1.sh — WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1
# Dispatcher payload freeze packet (DISPATCH_PAYLOAD_V1). ONE Owner sudo block.
#
# Modes:
#   --selftest  offline: payload digest stability + tools selftest + fixture
#              store plan/rollback logic. NO sudo, NO production contact.
#   --plan      READ-ONLY (sudo): live job payload digest/id/enabled/updatedAt.
#   --apply --confirm-upstream-test-exclusion-live   (sudo):
#              gates -> capture live payload preimage -> deploy tools into HR
#              workspace -> CAS update --message -> readback digest.
# Rollback: re-run the printed rollback command (replays the preimage file).
#
# CLI pinning: mutations go through the PINNED production operator
# /usr/local/bin/agentcore-cron (root-owned sealed install; digest-pinned to
# the deployed scheduler generation and re-verified on every run) — never a
# development worktree copy (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 RUNBOOK
# discipline).
#
# Sequencing guard: this v3 payload has NO dispatcher-side classification
# (Owner SIMPLE chain) — NON_BUSINESS_TEST exclusion must already be live
# upstream (svc WORK_EXECUTION_CLASS deployed and excluded from
# workflow_dispatch_intents); --apply requires the explicit attest flag.
#
# Authority: see DISPATCH_PAYLOAD_V1.md §2 (existing accepted authority covers
# the operator payload update; no new spec).
set -u

MODE="${1:-}"
NODE_BIN="/usr/local/libexec/agent-core/node-runtime/bin/node"
CLI="/usr/local/bin/agentcore-cron"
# scripts/agentcore-cron.mjs @ main 35a5b6a (= installed generation bytes).
# If the scheduler lane deploys a generation that changes the CLI, this pin
# must be consciously re-frozen (fail-closed, never auto-trust).
EXPECTED_CLI_SHA256="98a2a0318157aac5677ab9a025081a5f14901dc23ffe81f0d23467bf8c00298e"
STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
JOB_ID="b115cb96-8a4f-49be-9baa-519223022b59"
WS="/Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74"
TOOLS_SRC="$(cd "$(dirname "$0")" && pwd)/dispatch_round_tools.py"
TOOLS_DST="$WS/scripts/dispatch_round_tools.py"
LEDGER="$WS/memory/dispatch-fence.jsonl"
BACKLOG="$WS/memory/identity-repair-backlog.jsonl"
RECEIPT_DIR="$(cd "$(dirname "$0")" && pwd)/receipts"
JQ=/usr/bin/jq; SHASUM=/usr/bin/shasum; STAT=/usr/bin/stat; INSTALL=/usr/bin/install

read -r -d '' NEW_PAYLOAD <<'PAYLOAD_EOF' || true
你是 HR Workflow 调度助手，每30分钟运行一次。请用中文输出短报告。机械按序执行；任何单候选失败只记录原因并继续，绝不终止整轮；不读取任何 workflow 实例详情或全量实例列表面（工具与 HTTP 皆否）；不做任何名称、标题或关键词判断。

1. 候选源：workflow_dispatch_intents(operation=list, limit=100)。轮首先执行一次 backlog-list（--file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/identity-repair-backlog.jsonl --limit 100000），记住返回的 intentIds 数组（历史身份失败登记）。逐条处理 result.items 里的每个 intent；整页全部处理完后，若本轮已发起的 send 调用次数尚未达到 3 且本页返回了 100 条（满页），就用本页最后一条 intent 的 nextEligibleAt 字符串与 dispatchIntentId 分别作为 afterNextEligibleAt 与 afterDispatchIntentId（两个参数必须同时给、一字不差取自该条已消费记录）取下一页继续处理；直到出现短页（返回<100 条）或已发起的 send 调用次数达到 3 才停止取页（每整页都必须推进，页数无固定上限；上限只作用于 send 调用次数——confirmed 与 unknown 尝试都计入）。

2. 每个 intent 提供 dispatchIntentId、nodeVisitId、workflowInstanceId、ownerPrincipalId。按顺序机械执行：
a. 栅栏查询（机械执行，禁止手写账本文件）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-query --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId>
SEND_STARTED → 跳过（reason=send_started_no_auto_resend）；SEND_CONFIRMED → 跳过（reason=already_sent）；SEND_OUTCOME_UNKNOWN → 跳过（reason=outcome_unknown_no_retry）；LEDGER_UNTRUSTED → 立即停止一切派发，本轮零 send，报告标注账本不可信待 operator 处置；NOT_SENT → 继续。
b. workflowInstanceId 等于 cebf4816-c664-40cb-9b61-3fa330ad1c39 → 跳过（reason=exact_quarantine_owner_ruling），继续下一候选。
c. 精确身份门：调用 agent_resolve_principal 解析 ownerPrincipalId（每一次都真实调用，backlog 历史绝不代替或绕过解析——身份修复后候选即自然恢复派发）。
   - 成功得到 agentId → 继续 d。
   - 失败/歧义/disabled：若该 dispatchIntentId 已在轮首 intentIds 数组中 → 跳过（reason=already_in_backlog），绝不重复登记；否则先 backlog-add：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py backlog-add --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/identity-repair-backlog.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --principal <ownerPrincipalId> --reason <错误码>
     然后跳过（reason=identity_blocked_错误码）。禁止 displayName/名称猜测，禁止 send。
d. 写前栅栏（先于 send，顺序不可变）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-start --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId>
返回 claimed=false（已被占用）→ 跳过（reason=fence_already_open）。
e. 派发（完整包，目标零详情前置）：agent_session_send(operation=send, targetAgentId=<agentId>, timeoutSeconds=0, message=统一 Workflow 调度。请处理 workflow_instance_id=<workflowInstanceId>，nodeVisitId=<nodeVisitId>（已由调度方提供，无需为定位节点读取实例详情）。请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；调度方不代为 transition/审批。完成后回报结果与证据。)
f. send 返回后立即补记回执：工具正常返回 → --state SEND_CONFIRMED；超时/报错/无法确认送达 → --state SEND_OUTCOME_UNKNOWN：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-record --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId> --state <状态>
send 调用次数达到 3 即停止派发（reason=maxsend_reached；当前页剩余候选记 not_processed_this_round，下轮经栅栏/身份门快速越过自然推进）。

3. 冻结禁令：不用显示名或名称猜测 Agent；不重发任何 SEND_STARTED、SEND_CONFIRMED 或 SEND_OUTCOME_UNKNOWN 的 node-visit；不对上轮结果未明的任务自动重发；不调用 ledger-clear（operator 专用）也不以任何方式改写账本或 backlog；Scheduler accepted 不算业务完成；不代任何 Agent transition 或审批。

4. 报告（中文短报告）：due 候选数与取页数；逐候选一行 disposition（sent / skip+reason / backlog）；send 调用次数（confirmed / unknown 分列）；账本新增条目数；backlog 新增条目数；停止原因（short_page / maxsend_reached / ledger_untrusted）；下一步条件。
PAYLOAD_EOF

NEW_DIGEST="$(printf '%s' "$NEW_PAYLOAD" | "$SHASUM" -a 256 | awk '{print $1}')"

die() { printf '[packet] STOP: %s\n' "$1" >&2; exit 1; }

# Leaf publisher (codex P1: no privileged pathname chmod/mv after publication).
# Data arrives via PUBLISH_DATA; the leaf is created as a private mkstemp,
# mode+ownership set through its descriptor, contents written, the temp path
# inode-verified against the descriptor immediately before an atomic rename
# (rename REPLACES any planted destination symlink and never follows). If the
# private name is swapped out from under us we retry with a fresh one.
PUBLISH_PY='
import os, sys, tempfile, pwd, grp
dst, mode = sys.argv[1], int(sys.argv[2], 8)
data = os.environ.get("PUBLISH_DATA", "").encode()
u = pwd.getpwnam("yanfenma").pw_uid
g = grp.getgrnam("staff").gr_gid
d = os.path.dirname(dst)
for attempt in range(4):
    fd, tmp = tempfile.mkstemp(prefix=".publish-", dir=d)
    try:
        os.fchmod(fd, mode)
        os.fchown(fd, u, g)
        view = memoryview(data)
        while view:
            n = os.write(fd, view)
            view = view[n:]
        st = os.stat(tmp)
        fst = os.fstat(fd)
        if (st.st_ino, st.st_dev) != (fst.st_ino, fst.st_dev):
            continue
        os.rename(tmp, dst)
        break
    finally:
        os.close(fd)
else:
    raise SystemExit("publish: unable to secure a private temp leaf")
'
publish_file() { # $1=dst $2=mode(octal); data in PUBLISH_DATA
  PUBLISH_DATA="$PUBLISH_DATA" python3 -c "$PUBLISH_PY" "$1" "$2" || die "publish failed: $1"
}

# Trust path for the operator CLI: root-owned, digest-pinned, never resolvable
# into the user-writable source worktree.
verify_cli() {
  local real got
  real="$(readlink -f "$CLI" 2>/dev/null || printf '%s' "$CLI")"
  printf '%s' "$real" | grep -q '^/Users/yanfenma/workspace/project/dsh-agent-core' \
    && die "CLI resolves inside the user-writable source worktree: $real"
  [ "$("$STAT" -f %u "$real")" = 0 ] || die "CLI resolved target is not root-owned: $real"
  got="$("$SHASUM" -a 256 < "$real" | awk '{print $1}')"
  [ "$got" = "$EXPECTED_CLI_SHA256" ] || die "CLI digest drift: expected $EXPECTED_CLI_SHA256 got $got (re-pin the packet to the deployed scheduler generation first)"
  printf '%s' "$real"
}

live_job_doc() {
  sudo -u authsvc "$NODE_BIN" "$CLI" list --json --store "$STORE" \
    | "$JQ" -c --arg jid "$JOB_ID" '.jobs[] | select(.id == $jid)'
}

# ── selftest ──────────────────────────────────────────────────────────────────
if [ "$MODE" = "--selftest" ]; then
  ok() { printf '[ok] %s\n' "$1"; }
  [ ${#NEW_PAYLOAD} -gt 1000 ] || die "payload embedding too short"
  [ "$(printf '%s' "$NEW_PAYLOAD" | "$SHASUM" -a 256 | awk '{print $1}')" = "$NEW_DIGEST" ] \
    || die "payload digest unstable"
  ok "payload embedded, sha256=$NEW_DIGEST"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'workflow_dispatch_intents' || die "candidate source missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'nodeVisitId=<nodeVisitId>' || die "packet completeness missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q -- '--node-visit <nodeVisitId>' || die "fence not keyed by nodeVisitId"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'ledger-start' || die "write-ahead fence step missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'LEDGER_UNTRUSTED' || die "corruption fail-closed clause missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'send_started_no_auto_resend' || die "fence no-resend clause missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'backlog-add' || die "identity repair backlog missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'backlog-list' || die "round-start backlog set missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q '短页' || die "full-page advance-until-short-page clause missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q '不调用 ledger-clear' || die "operator-only ledger clause missing"
  printf '%s' "$NEW_PAYLOAD" | grep -q 'timeoutSeconds=0' || die "send timeout not 0 (accepted range 0..300)"
  for banned in 'workflow_instance_detail' 'workflow_global_instances' 'execution_class'; do
    printf '%s' "$NEW_PAYLOAD" | grep -q "$banned" && die "forbidden surface present: $banned"
  done
  ok "payload invariants (feed source / packet completeness / nodeVisitId fence / backlog / zero detail+summary+class surfaces / timeout=0)"
  python3 "$TOOLS_SRC" selftest >/dev/null || die "dispatch_round_tools selftest failed"
  ok "dispatch_round_tools selftest (T + N + B3_ATOMIC_FENCE + LEDGER) PASS"
  FX=$(mktemp -d)
  cat > "$FX/store.json" <<EOF
{"jobs":[{"id":"$JOB_ID","agentId":"agt_hr-agent","enabled":false,"updatedAtMs":1789000000000,"payload":{"kind":"agentTurn","message":"OLD"},"schedule":{"kind":"every","everyMs":1800000}}]}
EOF
  OLD_D="$("$JQ" -r '.jobs[0].payload.message' "$FX/store.json" | "$SHASUM" -a 256 | awk '{print $1}')"
  UPDATED_AT="$("$JQ" -r '.jobs[0].updatedAtMs' "$FX/store.json")"
  [ "$OLD_D" != "$NEW_DIGEST" ] || die "fixture self-check"
  NEWF="$("$JQ" -r --arg m "$NEW_PAYLOAD" '.jobs[0].payload.message = $m | .jobs[0].payload.message' "$FX/store.json")"
  [ "$(printf '%s' "$NEWF" | "$SHASUM" -a 256 | awk '{print $1}')" = "$NEW_DIGEST" ] \
    || die "readback digest math failed"
  ok "plan/rollback digest math on fixture (CAS key=$UPDATED_AT)"
  rm -rf "$FX"
  printf '[packet selftest] PASS\n'
  exit 0
fi

# ── plan (read-only) ──────────────────────────────────────────────────────────
if [ "$MODE" = "--plan" ]; then
  CLI_REAL="$(verify_cli)" || exit 1
  DOC=$(live_job_doc) || die "cannot read live store"
  [ -n "$DOC" ] || die "job $JOB_ID not found"
  printf 'operator_cli=%s -> %s\n' "$CLI" "$CLI_REAL"
  printf 'cli_sha256=%s (pinned %s)\n' "$("$SHASUM" -a 256 < "$CLI_REAL" | awk '{print $1}')" "$EXPECTED_CLI_SHA256"
  printf 'job_id=%s\nenabled=%s\nschedule=%s\nupdatedAtMs=%s\nlive_payload_sha256=%s\nnew_payload_sha256=%s\n' \
    "$("$JQ" -r .id <<<"$DOC")" "$("$JQ" -r .enabled <<<"$DOC")" \
    "$("$JQ" -c .schedule <<<"$DOC")" "$("$JQ" -r .updatedAtMs <<<"$DOC")" \
    "$("$JQ" -r .payload.message <<<"$DOC" | "$SHASUM" -a 256 | awk '{print $1}')" "$NEW_DIGEST"
  exit 0
fi

# ── apply ─────────────────────────────────────────────────────────────────────
[ "$MODE" = "--apply" ] || { printf 'usage: %s --selftest | --plan | --apply --confirm-upstream-test-exclusion-live\n' "$0" >&2; exit 64; }
[ "$(id -u)" = 0 ] || die "--apply requires root (single Owner sudo gate)"
[ "${2:-}" = "--confirm-upstream-test-exclusion-live" ] \
  || die "sequencing guard: this payload has NO dispatcher-side classification (Owner SIMPLE chain); NON_BUSINESS_TEST must ALREADY be excluded upstream (svc WORK_EXECUTION_CLASS live + excluded from workflow_dispatch_intents). Re-run with --confirm-upstream-test-exclusion-live to attest."

CLI_REAL="$(verify_cli)" || exit 1
printf '[apply] operator CLI verified: %s (sha256 pinned)\n' "$CLI_REAL"

DOC=$(live_job_doc); [ -n "$DOC" ] || die "job not found"
LIVE_UPDATED_AT="$("$JQ" -r .updatedAtMs <<<"$DOC")"
LIVE_SCHEDULE_REV="$("$JQ" -r '.scheduleRevision' <<<"$DOC")"
{ [ -n "$LIVE_SCHEDULE_REV" ] && [ "$LIVE_SCHEDULE_REV" != "null" ]; } \
  || die "live job doc missing scheduleRevision — the operator CLI rejects a partial CAS pair (both fields required)"
LIVE_MSG="$("$JQ" -r '.payload.message' <<<"$DOC")"
LIVE_DIGEST="$(printf '%s' "$LIVE_MSG" | "$SHASUM" -a 256 | awk '{print $1}')"
[ "$LIVE_DIGEST" != "$NEW_DIGEST" ] || die "live payload already equals the frozen target (nothing to do)"

# preimage + receipts live beside the packet in the evidence tree; refuse a
# planted symlink dir before any root write. Leaf files are created via
# mktemp (O_EXCL, unpredictable name) and moved into place with rename, which
# atomically REPLACES any pre-planted leaf symlink instead of following it.
[ -L "$RECEIPT_DIR" ] && die "refusing symlink at receipt dir: $RECEIPT_DIR"
mkdir -p "$RECEIPT_DIR"
# published via private leaf + rename; 0644 so the printed rollback (authsvc)
# can replay the preimage
PREIMAGE="$RECEIPT_DIR/payload-preimage-$(date -u +%Y%m%dT%H%M%SZ).txt"
PUBLISH_DATA="$LIVE_MSG" publish_file "$PREIMAGE" 0644
printf '[apply] preimage captured: %s (sha256=%s)\n' "$PREIMAGE" "$LIVE_DIGEST"

# Deploy the dispatcher mechanics into the HR workspace (idempotent,
# digest-checked; ownership MUST return to yanfenma — root-owned workspace
# files break the HR turn).
#
# Leaf-install discipline (codex P1, check-then-chown race eliminated for the
# realistic accident classes): $WS is yanfenma-writable by design, so no
# pre-check can make pathname chown/redirect safe against an ACTIVE hostile
# race (single-principal workspace — see DISPATCH_PAYLOAD_V1.md §0 trust
# boundary). Every leaf this packet installs is therefore created fresh by
# root via mktemp (O_EXCL, unpredictable private name), chown/chmod'd while
# still private, and moved into place with rename — rename atomically
# REPLACES whatever occupied the destination (stale/planted symlink included)
# and never follows it. Root's only operations on pre-existing files are
# read-only stat/shasum.
[ -d "$WS" ] || die "HR workspace missing: $WS"
[ -L "$WS" ] && die "refusing symlink at workspace root: $WS"
# Directory creation + ownership through no-follow descriptors (codex P1:
# yanfenma owns $WS and can swap a freshly-created directory for a symlink
# between mkdir and a pathname chown — root would follow it onto an
# attacker-chosen target). mkdir → O_DIRECTORY|O_NOFOLLOW open → fstat →
# fchown on the descriptor; a planted link is unlinked (unlink never follows)
# and the create-verify-chown cycle retried, bounded.
python3 - "$WS/scripts" "$WS/memory" <<'PYDIR' || die "workspace directory setup failed"
import grp, os, pwd, stat, sys, errno
u = pwd.getpwnam("yanfenma").pw_uid
g = grp.getgrnam("staff").gr_gid
for d in sys.argv[1:3]:
    for attempt in range(4):
        try:
            os.mkdir(d)
        except FileExistsError:
            pass
        try:
            fd = os.open(d, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        except OSError as e:
            if e.errno in (errno.ELOOP, errno.ENOTDIR, errno.ENOENT):
                try:
                    if os.path.islink(d):
                        os.unlink(d)
                except OSError:
                    pass
                continue
            raise
        try:
            st = os.fstat(fd)
            if not stat.S_ISDIR(st.st_mode):
                raise SystemExit("not a directory: %s" % d)
            if st.st_uid not in (0, u):
                raise SystemExit("pre-existing directory owned by a third party (not touching it): %s" % d)
            os.fchown(fd, u, g)
            break
        finally:
            os.close(fd)
    else:
        raise SystemExit("unable to secure directory (planted link kept reappearing): %s" % d)
PYDIR

PUBLISH_DATA="$(cat "$TOOLS_SRC")" publish_file "$TOOLS_DST" 0755

# ledger/backlog: an existing REGULAR yanfenma/root-owned file is the live
# append-only surface — kept untouched (never rewritten by this packet).
# Anything else (missing, planted symlink) is atomically replaced by a fresh
# yanfenma-owned empty leaf via the same private-temp + rename path.
install_leaf() {
  leaf="$1"
  if [ -d "$leaf" ]; then
    # also catches a symlink planted to a directory (-d follows): mv would
    # move INTO it instead of replacing it
    die "refusing directory at ledger/backlog path: $leaf"
  fi
  if [ -f "$leaf" ] && [ ! -L "$leaf" ]; then
    OWN="$("$STAT" -f %u "$leaf")"
    if [ "$OWN" = "$("$STAT" -f %u "$WS")" ]; then
      return 0
    fi
    if [ "$OWN" = 0 ]; then
      # prior-run root-owned residue: the HR turn could never append to it.
      # Repair through a no-follow descriptor (content untouched, nothing
      # copied, zero check-then-open window): open O_RDONLY|O_NOFOLLOW,
      # fstat-verify a root-owned regular file, fchown/fchmod on the
      # descriptor only.
      python3 - "$leaf" <<'PYLEAF' || die "root-owned ledger repair failed: $leaf"
import grp, os, pwd, stat, sys
leaf = sys.argv[1]
uid = pwd.getpwnam("yanfenma").pw_uid
gid = grp.getgrnam("staff").gr_gid
fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW)
try:
    st = os.fstat(fd)
    if not stat.S_ISREG(st.st_mode) or st.st_uid != 0:
        raise SystemExit("no-follow guard: %s is not a root-owned regular file" % leaf)
    os.fchown(fd, uid, gid)
    os.fchmod(fd, 0o644)
finally:
    os.close(fd)
PYLEAF
      return 0
    fi
    die "pre-existing file owned by a third party (not touching it): $leaf"
  fi
  PUBLISH_DATA="" publish_file "$leaf" 0644
}
install_leaf "$LEDGER"
install_leaf "$BACKLOG"

[ "$("$SHASUM" -a 256 < "$TOOLS_DST" | awk '{print $1}')" = "$("$SHASUM" -a 256 < "$TOOLS_SRC" | awk '{print $1}')" ] \
  || die "tools deploy digest mismatch"
printf '[apply] tools deployed + ledger/backlog ready (yanfenma-owned, rename-installed)\n'

# CAS compare-before-write payload update via the PINNED production operator seam.
# The CLI requires BOTH revision fields together (expectedRevisionFromFlags).
sudo -u authsvc "$NODE_BIN" "$CLI" update "$JOB_ID" \
  --expected-schedule-revision "$LIVE_SCHEDULE_REV" \
  --expected-updated-at "$LIVE_UPDATED_AT" \
  --message "$NEW_PAYLOAD" --store "$STORE" --json \
  || die "CAS update failed (store moved? re-run --plan)"

# readback
DOC2=$(live_job_doc) || die "readback failed"
RB_DIGEST="$(printf '%s' "$("$JQ" -r '.payload.message' <<<"$DOC2")" | "$SHASUM" -a 256 | awk '{print $1}')"
[ "$RB_DIGEST" = "$NEW_DIGEST" ] || die "READBACK MISMATCH (expected $NEW_DIGEST got $RB_DIGEST) — rollback:"
printf '[apply] READBACK PASS: payload sha256=%s\n' "$RB_DIGEST"
printf '[apply] enabled=%s schedule=%s (must be unchanged)\n' \
  "$("$JQ" -r .enabled <<<"$DOC2")" "$("$JQ" -c .schedule <<<"$DOC2")"

RECEIPT_JSON="{\"jobId\":\"$JOB_ID\",\"oldPayloadSha256\":\"$LIVE_DIGEST\",\"newPayloadSha256\":\"$NEW_DIGEST\",\"preimage\":\"$PREIMAGE\",\"casScheduleRevision\":\"$LIVE_SCHEDULE_REV\",\"casUpdatedAtMs\":\"$LIVE_UPDATED_AT\",\"appliedAt\":\"$(date -u +%FT%TZ)\"}"
RECEIPT="$RECEIPT_DIR/apply-receipt-$(date -u +%Y%m%dT%H%M%SZ).json"
PUBLISH_DATA="$RECEIPT_JSON" publish_file "$RECEIPT" 0644
printf '[apply] RECEIPT written: %s. Rollback command:\n' "$RECEIPT"
printf '  sudo -u authsvc %s %s update %s --expected-schedule-revision %s --expected-updated-at %s --message "$(%s < %s)" --store %s --json\n' \
  "$NODE_BIN" "$CLI" "$JOB_ID" "$("$JQ" -r .scheduleRevision <<<"$DOC2")" "$("$JQ" -r .updatedAtMs <<<"$DOC2")" cat "$PREIMAGE" "$STORE"
printf '[apply] DONE. Next natural occurrence proves the new loop (upstream NON_BUSINESS_TEST exclusion attested via --confirm-upstream-test-exclusion-live).\n'
