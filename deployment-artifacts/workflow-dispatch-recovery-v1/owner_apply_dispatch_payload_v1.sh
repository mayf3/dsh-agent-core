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

1. 候选源：workflow_dispatch_intents(operation=list, limit=100)。按返回顺序逐条处理；处理中跳过的候选（已栅栏/已入 backlog/隔离）直接越过继续下一条；若整页全部跳过且有下一页，用返回的游标取下一页（最多 5 页）。每轮最多 send 3 个。

2. 每个 intent 提供 dispatchIntentId、nodeVisitId、workflowInstanceId、ownerPrincipalId。依次执行：
a. 栅栏查询（机械执行，禁止手写账本文件）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-query --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId>
SEND_STARTED → 跳过（reason=send_started_no_auto_resend）；SEND_CONFIRMED → 跳过（reason=already_sent）；SEND_OUTCOME_UNKNOWN → 跳过（reason=outcome_unknown_no_retry）；LEDGER_UNTRUSTED → 立即停止一切派发，本轮零 send，报告标注账本不可信待 operator 处置；NOT_SENT → 继续。
b. workflowInstanceId 等于 cebf4816-c664-40cb-9b61-3fa330ad1c39 → 跳过（reason=exact_quarantine_owner_ruling），继续下一候选。
c. 精确身份门：调用 agent_resolve_principal 解析 ownerPrincipalId。失败/歧义/disabled → 机械登记修复待办后跳过：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py backlog-add --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/identity-repair-backlog.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --principal <ownerPrincipalId> --reason <错误码>
（reason=identity_blocked_错误码，已入 backlog；禁止 displayName/名称猜测，禁止 send。）成功得到 agentId → 继续 d。
d. 写前栅栏（先于 send，顺序不可变）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-start --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId>
返回 claimed=false（已被占用）→ 跳过（reason=fence_already_open）。
e. 派发（完整包，目标零详情前置）：agent_session_send(operation=send, targetAgentId=<agentId>, timeoutSeconds=0, message=统一 Workflow 调度。请处理 workflow_instance_id=<workflowInstanceId>，nodeVisitId=<nodeVisitId>（已由调度方提供，无需为定位节点读取实例详情）。请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；调度方不代为 transition/审批。完成后回报结果与证据。)
f. send 返回后立即补记回执：工具正常返回 → --state SEND_CONFIRMED；超时/报错/无法确认送达 → --state SEND_OUTCOME_UNKNOWN：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-record --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId> --state <状态>
send 确认数达到 3 即停止派发（reason=maxsend_reached）。

3. 冻结禁令：不用显示名或名称猜测 Agent；不重发任何 SEND_STARTED、SEND_CONFIRMED 或 SEND_OUTCOME_UNKNOWN 的 node-visit；不对上轮结果未明的任务自动重发；不调用 ledger-clear（operator 专用）也不以任何方式改写账本或 backlog；Scheduler accepted 不算业务完成；不代任何 Agent transition 或审批。

4. 报告（中文短报告）：due 候选数；逐候选一行 disposition（sent / skip+reason / backlog）；实际 send 数；账本新增条目数；backlog 新增条目数；下一步条件。
PAYLOAD_EOF

NEW_DIGEST="$(printf '%s' "$NEW_PAYLOAD" | "$SHASUM" -a 256 | awk '{print $1}')"

die() { printf '[packet] STOP: %s\n' "$1" >&2; exit 1; }

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
LIVE_MSG="$("$JQ" -r '.payload.message' <<<"$DOC")"
LIVE_DIGEST="$(printf '%s' "$LIVE_MSG" | "$SHASUM" -a 256 | awk '{print $1}')"
[ "$LIVE_DIGEST" != "$NEW_DIGEST" ] || die "live payload already equals the frozen target (nothing to do)"

# preimage + receipts live beside the packet in the evidence tree; refuse a
# planted symlink dir before any root write.
[ -L "$RECEIPT_DIR" ] && die "refusing symlink at receipt dir: $RECEIPT_DIR"
mkdir -p "$RECEIPT_DIR"
PREIMAGE="$RECEIPT_DIR/payload-preimage-$(date -u +%Y%m%dT%H%M%SZ).txt"
printf '%s' "$LIVE_MSG" > "$PREIMAGE"
printf '[apply] preimage captured: %s (sha256=%s)\n' "$PREIMAGE" "$LIVE_DIGEST"

# Deploy the dispatcher mechanics into the HR workspace (idempotent,
# digest-checked; ownership MUST return to yanfenma — root-owned workspace
# files break the HR turn).
#
# No-follow / no-pre-existing-chown discipline: every component is checked for
# symlink substitution BEFORE any root write or chown; pre-existing directories
# are NEVER chowned (they must already be yanfenma-owned); pre-existing files
# owned by a third party abort the apply. (Single-admin workspace; checks and
# writes run back-to-back in this root shell.)
[ -d "$WS" ] || die "HR workspace missing: $WS"
[ -L "$WS" ] && die "refusing symlink at workspace root: $WS"
WS_UID="$("$STAT" -f %u "$WS")"
for d in "$WS/scripts" "$WS/memory"; do
  [ -L "$d" ] && die "refusing symlink at workspace path: $d"
  if [ -e "$d" ] && [ ! -d "$d" ]; then die "not a directory: $d"; fi
  if [ -d "$d" ] && [ "$("$STAT" -f %u "$d")" != "$WS_UID" ]; then
    die "pre-existing directory not yanfenma-owned (refusing to chown it): $d"
  fi
done
NEW_SCRIPTS=0; [ -d "$WS/scripts" ] || NEW_SCRIPTS=1
NEW_MEMORY=0; [ -d "$WS/memory" ] || NEW_MEMORY=1
mkdir -p "$WS/scripts" "$WS/memory"
[ "$NEW_SCRIPTS" = 1 ] && chown yanfenma:staff "$WS/scripts"
[ "$NEW_MEMORY" = 1 ] && chown yanfenma:staff "$WS/memory"
for f in "$TOOLS_DST" "$LEDGER" "$BACKLOG"; do
  [ -L "$f" ] && die "refusing symlink at target file: $f"
  if [ -e "$f" ]; then
    OWN="$("$STAT" -f %u "$f")"
    { [ "$OWN" = "$WS_UID" ] || [ "$OWN" = 0 ]; } \
      || die "pre-existing file owned by a third party (not touching it): $f"
  fi
done
"$INSTALL" -m 0755 "$TOOLS_SRC" "$TOOLS_DST"
chown yanfenma:staff "$TOOLS_DST"
if [ ! -e "$LEDGER" ]; then : > "$LEDGER"; fi
if [ ! -e "$BACKLOG" ]; then : > "$BACKLOG"; fi
chown yanfenma:staff "$LEDGER" "$BACKLOG"
[ "$("$SHASUM" -a 256 < "$TOOLS_DST" | awk '{print $1}')" = "$("$SHASUM" -a 256 < "$TOOLS_SRC" | awk '{print $1}')" ] \
  || die "tools deploy digest mismatch"
printf '[apply] tools deployed + ledger/backlog ready (yanfenma-owned)\n'

# CAS compare-before-write payload update via the PINNED production operator seam
sudo -u authsvc "$NODE_BIN" "$CLI" update "$JOB_ID" \
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

cat > "$RECEIPT_DIR/apply-receipt-$(date -u +%Y%m%dT%H%M%SZ).json" <<EOF
{"jobId":"$JOB_ID","oldPayloadSha256":"$LIVE_DIGEST","newPayloadSha256":"$NEW_DIGEST","preimage":"$PREIMAGE","casUpdatedAtMs":"$LIVE_UPDATED_AT","appliedAt":"$(date -u +%FT%TZ)"}
EOF
printf '[apply] RECEIPT written. Rollback command:\n'
printf '  sudo -u authsvc %s %s update %s --expected-updated-at %s --message "$(%s < %s)" --store %s --json\n' \
  "$NODE_BIN" "$CLI" "$JOB_ID" "$("$JQ" -r .updatedAtMs <<<"$DOC2")" cat "$PREIMAGE" "$STORE"
printf '[apply] DONE. Next natural occurrence proves the new loop (upstream NON_BUSINESS_TEST exclusion attested via --confirm-upstream-test-exclusion-live).\n'
