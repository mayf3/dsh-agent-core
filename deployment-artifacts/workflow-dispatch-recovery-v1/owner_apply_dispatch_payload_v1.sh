#!/bin/bash
# owner_apply_dispatch_payload_v1.sh — WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1
# Dispatcher payload freeze packet (DISPATCH_PAYLOAD_V1). ONE Owner sudo block.
#
# Modes:
#   --selftest  offline: payload digest stability + tools selftest + fixture
#              store plan/rollback logic. NO sudo, NO production contact.
#   --plan      READ-ONLY (sudo): live job payload digest/id/enabled/updatedAt.
#   --apply     (sudo): gates -> capture live payload preimage -> deploy tools
#              into HR workspace -> CAS update --message -> readback digest.
# Rollback: re-run the printed rollback command (replays the preimage file).
#
# Authority: see DISPATCH_PAYLOAD_V1.md §2 (existing accepted authority covers
# the operator payload update; no new spec).
set -u

MODE="${1:-}"
NODE_BIN="/usr/local/libexec/agent-core/node-runtime/bin/node"
CLI="/Users/yanfenma/workspace/project/dsh-agent-core/.worktree/step1-closure/.worktree/p0-dispatch/scripts/agentcore-cron.mjs"
STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
JOB_ID="b115cb96-8a4f-49be-9baa-519223022b59"
WS="/Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74"
TOOLS_SRC="$(cd "$(dirname "$0")" && pwd)/dispatch_round_tools.py"
TOOLS_DST="$WS/scripts/dispatch_round_tools.py"
LEDGER="$WS/memory/dispatch-receipts.jsonl"
RECEIPT_DIR="$(cd "$(dirname "$0")" && pwd)/receipts"
JQ=/usr/bin/jq; SHASUM=/usr/bin/shasum

read -r -d '' NEW_PAYLOAD <<'PAYLOAD_EOF' || true
你是 HR Workflow 调度助手，每30分钟运行一次。请用中文输出短报告。严格按以下顺序机械执行；任何单候选失败只记录原因并继续下一个候选，绝不终止整轮；禁止调用 workflow_instance_detail（任何域）。

1. 读取候选：调用 workflow_dispatch_intents(operation=list, limit=100)。本轮只处理前 20 条 due intents（超出部分记 reason=window_bounded）。不扫描全量 active 实例列表。

2. 对每个候选依次执行（派发成功数达到 3 即停止派发，其余记 reason=maxsend_reached）：
a. 查账本（机械执行，禁止手写账本文件）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-query --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-receipts.jsonl --intent <dispatchIntentId>
状态为 SEND_CONFIRMED → 跳过（reason=already_sent）；SEND_OUTCOME_UNKNOWN → 跳过（reason=outcome_unknown_no_retry）；继续下一候选。
b. workflowInstanceId 等于 cebf4816-c664-40cb-9b61-3fa330ad1c39 → 跳过（reason=exact_quarantine_owner_ruling），继续下一候选。
c. 取分类字段：调用 workflow_global_instances(operation=list, lifecycle=active, assigneePrincipalId=<ownerPrincipalId>, limit=20)，在结果中找 workflowInstanceId 对应行：找不到 → 跳过（reason=summary_row_missing）；execution_class 缺席 → 跳过（reason=class_unavailable_fail_closed）；NON_BUSINESS_TEST → 跳过（reason=non_business_test）；BUSINESS → 继续 d。
d. 精确身份门：调用 agent_resolve_principal 解析 ownerPrincipalId：失败/歧义/disabled → 跳过（reason=identity_blocked_错误码），继续下一候选；成功得到 agentId。
e. 派发（消息为完整包，目标零详情前置）：agent_session_send(operation=send, targetAgentId=<agentId>, timeoutSeconds=600, message=统一 Workflow 调度。请处理 workflow_instance_id=<workflowInstanceId>，nodeVisitId=<nodeVisitId>（已由调度方提供，无需为定位节点读取实例详情）。请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；调度方不代为 transition/审批。完成后回报结果与证据。)
f. 每次 send 尝试后立即记账（机械执行）：工具返回 ok 或 accepted → --state SEND_CONFIRMED；超时/报错/无法确认送达 → --state SEND_OUTCOME_UNKNOWN：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-record --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-receipts.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --agent <agentId> --state <状态>

3. 冻结禁令：不用显示名或名称猜测 Agent；不重发任何 SEND_CONFIRMED 或 SEND_OUTCOME_UNKNOWN 的 intent；不对上轮结果未明的任务自动重发；Scheduler accepted 不算业务完成；不代任何 Agent transition 或审批。

4. 报告（中文短报告）：本轮 due 候选数；逐候选一行 disposition（sent 或 skip+reason）；实际派发数；账本新增条目数；下一步条件。
PAYLOAD_EOF

NEW_DIGEST="$(printf '%s' "$NEW_PAYLOAD" | "$SHASUM" -a 256 | awk '{print $1}')"

die() { printf '[packet] STOP: %s\n' "$1" >&2; exit 1; }

live_job_doc() { # prints the live job object
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
  if printf '%s' "$NEW_PAYLOAD" | grep -q 'workflow_instance_detail'; then
    # the ONLY permitted occurrence is the prohibition clause
    [ "$(printf '%s' "$NEW_PAYLOAD" | grep -c 'workflow_instance_detail')" = 1 ] || die "detail references beyond prohibition"
    printf '%s' "$NEW_PAYLOAD" | grep -q '禁止调用 workflow_instance_detail' || die "detail mention is not a prohibition"
  fi
  ok "payload invariants (feed source / packet completeness / detail prohibition)"
  python3 "$TOOLS_SRC" selftest >/dev/null || die "dispatch_round_tools selftest failed"
  ok "dispatch_round_tools selftest (T1-T10 + N1-N3 + ledger) PASS"
  # fixture store: plan/rollback logic on a synthetic doc
  FX=$(mktemp -d)
  cat > "$FX/store.json" <<EOF
{"jobs":[{"id":"$JOB_ID","agentId":"agt_hr-agent","enabled":false,"updatedAtMs":1789000000000,"payload":{"kind":"agentTurn","message":"OLD"},"schedule":{"kind":"every","everyMs":1800000}}]}
EOF
  OLD_D="$("$JQ" -r '.jobs[0].payload.message' "$FX/store.json" | "$SHASUM" -a 256 | awk '{print $1}')"
  UPDATED_AT="$("$JQ" -r '.jobs[0].updatedAtMs' "$FX/store.json")"
  [ "$OLD_D" != "$NEW_DIGEST" ] || die "fixture self-check"
  NEWF="$("$JQ" -r --arg m "$NEW_PAYLOAD" '.jobs[0].payload.message = $m | .jobs[0].payload.message' "$FX/store.json")"
  [ "$(printf '%s' "$NEWF" | "$SHASUM" -a 256 | awk '{print $1}')" = "$(printf '%s' "$NEW_PAYLOAD" | "$SHASUM" -a 256 | awk '{print $1}')" ] \
    || die "readback digest math failed"
  ok "plan/rollback digest math on fixture (CAS key=$UPDATED_AT)"
  rm -rf "$FX"
  printf '[packet selftest] PASS\n'
  exit 0
fi

# ── plan (read-only) ──────────────────────────────────────────────────────────
if [ "$MODE" = "--plan" ]; then
  DOC=$(live_job_doc) || die "cannot read live store"
  [ -n "$DOC" ] || die "job $JOB_ID not found"
  printf 'job_id=%s\nenabled=%s\nschedule=%s\nupdatedAtMs=%s\nlive_payload_sha256=%s\nnew_payload_sha256=%s\n' \
    "$("$JQ" -r .id <<<"$DOC")" "$("$JQ" -r .enabled <<<"$DOC")" \
    "$("$JQ" -c .schedule <<<"$DOC")" "$("$JQ" -r .updatedAtMs <<<"$DOC")" \
    "$("$JQ" -r .payload.message <<<"$DOC" | "$SHASUM" -a 256 | awk '{print $1}')" "$NEW_DIGEST"
  exit 0
fi

# ── apply ─────────────────────────────────────────────────────────────────────
[ "$MODE" = "--apply" ] || { printf 'usage: %s --selftest | --plan | --apply\n' "$0" >&2; exit 64; }
[ "$(id -u)" = 0 ] || die "--apply requires root (single Owner sudo gate)"

DOC=$(live_job_doc); [ -n "$DOC" ] || die "job not found"
LIVE_UPDATED_AT="$("$JQ" -r .updatedAtMs <<<"$DOC")"
LIVE_MSG="$("$JQ" -r '.payload.message' <<<"$DOC")"
LIVE_DIGEST="$(printf '%s' "$LIVE_MSG" | "$SHASUM" -a 256 | awk '{print $1}')"
[ "$LIVE_DIGEST" != "$NEW_DIGEST" ] || die "live payload already equals the frozen target (nothing to do)"

mkdir -p "$RECEIPT_DIR"
PREIMAGE="$RECEIPT_DIR/payload-preimage-$(date -u +%Y%m%dT%H%M%SZ).txt"
printf '%s' "$LIVE_MSG" > "$PREIMAGE"
printf '[apply] preimage captured: %s (sha256=%s)\n' "$PREIMAGE" "$LIVE_DIGEST"

# deploy the dispatcher mechanics into the HR workspace (idempotent, digest-checked;
# ownership MUST return to yanfenma — root-owned workspace files break the HR turn)
mkdir -p "$WS/scripts" "$WS/memory"
install -m 0755 "$TOOLS_SRC" "$TOOLS_DST"
chown yanfenma:staff "$TOOLS_DST" "$WS/scripts" "$WS/memory"
[ "$(shasum -a 256 < "$TOOLS_DST" | awk '{print $1}')" = "$(shasum -a 256 < "$TOOLS_SRC" | awk '{print $1}')" ] \
  || die "tools deploy digest mismatch"
if [ ! -f "$LEDGER" ]; then : > "$LEDGER"; fi
chown yanfenma:staff "$LEDGER"
printf '[apply] tools deployed + ledger ready (yanfenma-owned): %s\n' "$LEDGER"

# CAS compare-before-write payload update via the canonical operator seam
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
printf '[apply] DONE. Next natural occurrence proves the new loop (dryRun observation: first round should skip everything class_unavailable until execution_class is live).\n'
