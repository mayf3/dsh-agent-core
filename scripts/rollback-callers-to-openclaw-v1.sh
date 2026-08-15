#!/usr/bin/env bash
#
# rollback-callers-to-openclaw-v1.sh — SCHEDULER_PRODUCTION_CUTOVER_CLOSURE_V1
#
# 把三个生产 caller 从 Agent Core Scheduler（agentcore-cron）恢复为 OpenClaw cron
# （pre-migration 版本），并清理 Agent Core store 中的孤儿 job。
#
# 幂等：已恢复的文件再次运行会从同一备份恢复（覆盖为相同内容）。
# 安全：先保留迁移版 live 副本（*.bak-caller-migration-v1-live-<ts>），不丢代码。
#
# 用法：bash scripts/rollback-callers-to-openclaw-v1.sh

set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
HOME_DIR="${HOME:-/Users/yanfenma}"
FORUM_SCRIPT="$HOME_DIR/.openclaw/cron/scripts/forum-scheduler.sh"
DISPATCHER_DIR="$HOME_DIR/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab/skills/cron-domain-scheduler/scripts"
AGENTCORE_STORE="$HOME_DIR/.agent-core/scheduler/jobs.json"

echo "=== [1/3] preserve migrated live copies (do not lose migration code) ==="
cp -p "$FORUM_SCRIPT" "$FORUM_SCRIPT.bak-caller-migration-v1-live-$TS"
cp -p "$DISPATCHER_DIR/unified-dispatcher.py" "$DISPATCHER_DIR/unified-dispatcher.py.bak-caller-migration-v1-live-$TS"
cp -p "$DISPATCHER_DIR/check-dispatch-health.py" "$DISPATCHER_DIR/check-dispatch-health.py.bak-caller-migration-v1-live-$TS"

echo "=== [2/3] restore pre-migration (OpenClaw) versions from saved backups ==="
cp -p "$FORUM_SCRIPT.bak-caller-migration-v1-20260815-121248" "$FORUM_SCRIPT"
cp -p "$DISPATCHER_DIR/unified-dispatcher.py.bak-caller-migration-v1-20260815-121248" "$DISPATCHER_DIR/unified-dispatcher.py"
cp -p "$DISPATCHER_DIR/check-dispatch-health.py.bak-caller-migration-v1-20260815-121248" "$DISPATCHER_DIR/check-dispatch-health.py"

# forum-scheduler.sh ACL（launchd daemon 以 UID505 authsvc 执行；备份文件无 ACL）
chmod -E "$FORUM_SCRIPT" <<'EOF'
user:yanfenma allow read,execute,readattr,readextattr
user:authsvc allow read,write,append,readattr,writeattr,readextattr,writeextattr
EOF

echo "=== [3/3] drain orphaned Agent Core store jobs (backup first) ==="
if [ -f "$AGENTCORE_STORE" ]; then
  cp -p "$AGENTCORE_STORE" "$AGENTCORE_STORE.bak-closure-v1-$TS"
  agentcore-cron list --json 2>/dev/null | python3 -c "
import sys, json, subprocess
d = json.load(sys.stdin)
jobs = d.get('jobs', [])
print(f'removing {len(jobs)} orphaned job(s):')
for j in jobs:
    print(' -', j['id'], j.get('name', ''))
    subprocess.run(['agentcore-cron', 'rm', j['id']], check=True)
print('agentcore store drained')
"
else
  echo "no agentcore store file — nothing to drain"
fi

echo "=== done. verify: grep openclaw cron in restored callers ==="
grep -l "openclaw cron" "$FORUM_SCRIPT" "$DISPATCHER_DIR/unified-dispatcher.py" "$DISPATCHER_DIR/check-dispatch-health.py" || exit 1
echo "rollback complete (TS=$TS)"
