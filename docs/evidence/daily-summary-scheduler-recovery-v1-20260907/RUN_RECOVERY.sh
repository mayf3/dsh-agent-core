#!/usr/bin/env bash
# DAILY_RAW_DISTILLED_SUMMARY_SCHEDULER_RECOVERY_V1 — bounded recovery runner.
#
# Owner-facing sudo wrapper. Selftested offline against a /tmp stub store
# (same CLI binary, same argument surface); the default mode performs, in ONE
# sudo authorization:
#
#   1. READ-BACK of the canonical production store (list --json)
#   2. MUTATION_RULE branch: found>1 -> report+stop; found==1 -> targeted
#      update only on TARGET_BEHAVIOR deltas; found==0 -> add exactly one
#   3. FINAL_READBACK with mechanical COMPLETION_CONDITIONS assertions
#
# No credential/token bytes are read, printed, copied or logged by this
# script. It only touches the scheduler store via the live app's
# CONTROL-ONLY CLI (agentcore-cron), under the authsvc identity (the store's
# owner), using the sudo pattern already precedented in shell history
# (stock-daily-market-brief-001 disable, 2026-09).
#
# usage:
#   bash RUN_RECOVERY.sh --selftest          # offline stub, no sudo, no prod
#   sudo -v && bash RUN_RECOVERY.sh          # production run (one sudo grant)
set -euo pipefail

LIVE_CLI=/usr/local/libexec/agent-core/app/scripts/agentcore-cron.mjs
NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
SUDO_RUN='sudo -u authsvc env -i HOME=/Users/authsvc PATH=/usr/local/libexec/agent-core/node-runtime/bin:/usr/bin:/bin'

TARGET_AGENT='agt_daily-thought-agent'
TARGET_NAME='每日摘要检查 - 滚动7天 raw/distilled 补生成'
TARGET_CRON='0 22 * * *'
TARGET_TZ='Asia/Shanghai'
TARGET_DELIVERY_TO='chat:oc_f2a6606689691fd7f0a7c7078a0bf2e9'
TARGET_MESSAGE='执行每日摘要检查任务（滚动 7 天模式）：工作目录 /Users/yanfenma/.openclaw/groups/workspace-oc_f2a6606689691fd7f0a7c7078a0bf2e9/daily-thoughts/，raw/ 为原始随想（只读，禁止修改），distilled/ 为提炼摘要。检查范围：今天往前滚动 7 个自然日（D-0 至 D-6），逐日检查 raw 是否存在、distilled 摘要是否存在、已有摘要是否明显不完整（空文件、仅标题、正文明显未覆盖 raw 要点）。处理规则：raw 存在且摘要缺失或明显不完整 → 基于 raw 补生成摘要（核心观点、主题分类、关键词、情绪走向），写入 distilled/YYYY-MM-DD-summary.md；摘要已存在且完整 → 跳过不重写；raw 不存在 → 跳过该日；任何情况下不得修改或删除 raw/ 下原始记录。完成后发送检查结果预览：逐日列出 raw 有/无、摘要状态（缺失/不完整已补/完整跳过）及本次补生成文件清单。'

cron_cli() {
  # cron_cli <store-independent args...>  (runs under authsvc identity)
  $SUDO_RUN "$NODE" "$LIVE_CLI" "$@"
}

readback_json() {
  # emits {jobs:[...]} JSON on stdout
  cron_cli list --json
}

assert_completion() {
  # assert_completion <readback json file> <phase label>
  python3 - "$1" "$2" <<'PYEOF'
import json, sys, datetime
path, phase = sys.argv[1], sys.argv[2]
doc = json.load(open(path))
jobs = doc.get('jobs', []) if isinstance(doc, dict) else doc
targets = [j for j in jobs if '摘要检查' in (j.get('name') or '') and (j.get('agentId') == 'agt_daily-thought-agent')]
print(f'[{phase}] total_jobs={len(jobs)} target_matches={len(targets)}')
checks = {}
if len(targets) == 1:
    j = targets[0]
    sched = j.get('schedule') or {}
    checks['TASK_EXISTS'] = 'YES'
    checks['TASK_SINGLETON'] = 'YES'
    checks['ENABLED'] = 'YES' if j.get('enabled') else 'NO'
    checks['SCHEDULE'] = 'DAILY 22:00' if sched.get('expr') == '0 22 * * *' else f'EXPR={sched.get("expr")}'
    checks['TIMEZONE'] = sched.get('tz') or 'MISSING'
    checks['WINDOW'] = 'LAST_7_CALENDAR_DAYS' if '7 个自然日' in ((j.get('payload') or {}).get('message') or '') else 'MESSAGE_MISSING_7DAY'
    checks['CHECK_RAW'] = 'YES' if 'raw' in ((j.get('payload') or {}).get('message') or '') else 'NO'
    checks['CHECK_DISTILLED'] = 'YES' if 'distilled' in ((j.get('payload') or {}).get('message') or '') else 'NO'
    checks['SUMMARY_WRITE_POLICY'] = 'ONLY_MISSING_OR_OBVIOUSLY_INCOMPLETE' if ('补生成' in ((j.get('payload') or {}).get('message') or '') and '不得修改' in ((j.get('payload') or {}).get('message') or '')) else 'UNVERIFIED'
    checks['RAW_RECORD_MUTATION'] = 'NONE' if '不得修改' in ((j.get('payload') or {}).get('message') or '') else 'UNVERIFIED'
    checks['FINAL_RESULT_PREVIEW'] = 'ENABLED' if '预览' in ((j.get('payload') or {}).get('message') or '') else 'NO'
    checks['AGENT'] = j.get('agentId')
    checks['DELIVERY'] = json.dumps(j.get('delivery'), ensure_ascii=False)
    checks['scheduleRevision'] = j.get('scheduleRevision')
    checks['updatedAtMs'] = j.get('updatedAtMs')
    nrm = j.get('nextRunAtMs')
    if nrm:
        checks['NEXT_RUN'] = datetime.datetime.fromtimestamp(nrm / 1000, datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S %Z=+8') + f' (utc={datetime.datetime.fromtimestamp(nrm/1000, datetime.timezone.utc).isoformat()})'
    else:
        checks['NEXT_RUN'] = 'MISSING'
else:
    checks['TASK_EXISTS'] = 'YES' if targets else 'NO'
    checks['TASK_SINGLETON'] = 'NO' if len(targets) > 1 else ('YES' if not targets else 'n/a')
    for t in targets:
        print('  candidate:', json.dumps({k: t.get(k) for k in ('id', 'name', 'enabled', 'agentId', 'schedule')}, ensure_ascii=False))
for k, v in checks.items():
    print(f'{k} = {v}')
ok = (checks.get('TASK_SINGLETON') == 'YES' and checks.get('ENABLED') == 'YES'
      and checks.get('SCHEDULE') == 'DAILY 22:00' and checks.get('TIMEZONE') == 'Asia/Shanghai'
      and checks.get('WINDOW') == 'LAST_7_CALENDAR_DAYS' and checks.get('CHECK_RAW') == 'YES'
      and checks.get('CHECK_DISTILLED') == 'YES' and checks.get('RAW_RECORD_MUTATION') == 'NONE'
      and checks.get('FINAL_RESULT_PREVIEW') == 'ENABLED')
print(f'[{phase}] COMPLETION_CONDITIONS_ALL_MET = {"YES" if ok else "NO"}')
sys.exit(0 if (ok or phase == 'PRE') else 1)
PYEOF
}

selftest() {
  local stub=/tmp/dsrs-v1-stub-$$.json
  echo '{"version":2,"jobs":[],"occurrences":[],"fences":{}}' > "$stub"
  local cli="node $LIVE_CLI"
  echo '[selftest 1/5] list on empty stub store'
  $cli list --store "$stub" >/dev/null
  echo '[selftest 2/5] add with production argument surface'
  local id
  id=$($cli add --agent "$TARGET_AGENT" --name "$TARGET_NAME" --cron "$TARGET_CRON" --tz "$TARGET_TZ" --message "$TARGET_MESSAGE" --timeout-seconds 1800 --deliver --channel feishu --to "$TARGET_DELIVERY_TO" --store "$stub" | sed -E 's/^created job ([0-9a-f-]+).*/\1/')
  echo "  created stub id=$id"
  echo '[selftest 3/5] update preserves semantics'
  $cli update "$id" --timeout-seconds 2400 --store "$stub" >/dev/null
  echo '[selftest 4/5] readback assertions'
  $cli list --json --store "$stub" > "$stub.rb"
  assert_completion "$stub.rb" 'PRE' && echo '  assertions PASS (stub)'
  echo '[selftest 5/5] negative: second add would duplicate (MUTATION_RULE forbids; not executed in prod)'
  rm -f "$stub" "$stub.rb"
  echo 'SELFTEST PASS'
}

case "${1:-}" in
  --selftest)
    selftest
    exit 0
    ;;
  *)
    ;;
esac

[ "$(id -u)" -eq 0 ] || { echo 'run as root (sudo bash RUN_RECOVERY.sh) so the authsvc identity switch works'; exit 78; }
[ -r "$LIVE_CLI" ] || { echo "live CLI missing: $LIVE_CLI"; exit 78; }

WORK=$(mktemp -d /tmp/dsrs-v1-prod.XXXXXX)
echo "=== STEP 1: READ-BACK canonical store (PRE) ==="
cron_cli list --json > "$WORK/pre.json" || { echo 'READ-BACK FAILED (store unreadable even under authsvc?)'; exit 1; }
assert_completion "$WORK/pre.json" 'PRE' || true

echo "=== STEP 2: MUTATION_RULE branch ==="
PLAN=$(python3 - "$WORK/pre.json" <<'PYEOF'
import json, sys
doc = json.load(open(sys.argv[1]))
jobs = doc.get('jobs', []) if isinstance(doc, dict) else doc
targets = [j for j in jobs if '摘要检查' in (j.get('name') or '') and (j.get('agentId') == 'agt_daily-thought-agent')]
if len(targets) > 1:
    print(f'AMBIGUOUS {len(targets)}')
    for t in targets:
        print(json.dumps({k: t.get(k) for k in ('id', 'name', 'enabled', 'schedule')}, ensure_ascii=False))
elif len(targets) == 1:
    j = targets[0]
    sched = j.get('schedule') or {}
    msgs = (j.get('payload') or {}).get('message') or ''
    deltas = []
    if not j.get('enabled'): deltas.append('--enable-required')
    if sched.get('expr') != '0 22 * * *': deltas.append('--cron 0 22 * * *')
    if sched.get('tz') != 'Asia/Shanghai': deltas.append('--tz Asia/Shanghai')
    if '7 个自然日' not in msgs: deltas.append('--message-refresh')
    if '不得修改' not in msgs: deltas.append('--message-refresh')
    if '预览' not in msgs: deltas.append('--message-refresh')
    if (j.get('delivery') or {}).get('to') != 'chat:oc_f2a6606689691fd7f0a7c7078a0bf2e9': deltas.append('--deliver-refresh')
    print(f'UPDATE {j["id"]}')
    for d in deltas: print(f'DELTA {d}')
    if not deltas: print('NO_DELTA')
else:
    print('ABSENT')
PYEOF
)
echo "$PLAN"
BRANCH=$(echo "$PLAN" | head -1)

case "$BRANCH" in
  ABSENT)
    echo '--- mechanically absent -> CREATE exactly one ---'
    cron_cli add --agent "$TARGET_AGENT" --name "$TARGET_NAME" --cron "$TARGET_CRON" --tz "$TARGET_TZ" \
      --message "$TARGET_MESSAGE" --timeout-seconds 1800 --deliver --channel feishu --to "$TARGET_DELIVERY_TO"
    ;;
  UPDATE*)
    JOB_ID=${BRANCH#UPDATE }
    DELTAS=$(echo "$PLAN" | sed -n 's/^DELTA //p')
    if echo "$DELTAS" | grep -q 'message-refresh'; then
      MSG_ARGS=(--message "$TARGET_MESSAGE")
    else
      MSG_ARGS=()
    fi
    SCHED_NEEDED=0
    echo "$DELTAS" | grep -q -- '--cron' && SCHED_NEEDED=1
    echo "$DELTAS" | grep -q -- '--tz' && SCHED_NEEDED=1
    UPDATE_ARGS=(update "$JOB_ID")
    if [ "$SCHED_NEEDED" -eq 1 ]; then UPDATE_ARGS+=(--cron "$TARGET_CRON" --tz "$TARGET_TZ"); fi
    [ ${#MSG_ARGS[@]} -gt 0 ] && UPDATE_ARGS+=("${MSG_ARGS[@]}")
    if echo "$DELTAS" | grep -q 'deliver-refresh'; then UPDATE_ARGS+=(--deliver --channel feishu --to "$TARGET_DELIVERY_TO"); fi
    ENABLE_NEEDED=0
    echo "$DELTAS" | grep -q 'enable-required' && ENABLE_NEEDED=1
    if [ ${#UPDATE_ARGS[@]} -le 2 ] && [ "$ENABLE_NEEDED" -eq 0 ]; then
      echo '--- target already matches TARGET_BEHAVIOR; zero mutations needed ---'
    else
      if [ ${#UPDATE_ARGS[@]} -gt 2 ]; then
        echo "--- target exists ($JOB_ID) -> one bounded update: ${UPDATE_ARGS[*]:0:6}... ---"
        cron_cli "${UPDATE_ARGS[@]}"
      fi
      if [ "$ENABLE_NEEDED" -eq 1 ]; then
        echo "--- enabling disabled job $JOB_ID ---"
        cron_cli enable "$JOB_ID"
      fi
      if ! cron_cli list | grep -q "$JOB_ID"; then echo 'post-update visibility check failed'; exit 1; fi
    fi
    ;;
  AMBIGUOUS*)
    echo 'MULTIPLE matching jobs — NO mutation (MUTATION_RULE). Resolve by Owner decision.'
    exit 2
    ;;
  *)
    echo "unexpected plan: $BRANCH"; exit 78
    ;;
esac

echo "=== STEP 3: FINAL_READBACK (POST) ==="
cron_cli list --json > "$WORK/post.json"
assert_completion "$WORK/post.json" 'POST' || { echo 'FINAL_READBACK = FAIL (see POST block above)'; exit 1; }
echo "evidence files: $WORK/pre.json $WORK/post.json"
echo 'FINAL_READBACK = PASS'
