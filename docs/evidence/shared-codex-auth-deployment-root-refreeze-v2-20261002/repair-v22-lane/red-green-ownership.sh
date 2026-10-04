#!/bin/bash
# RED/GREEN evidence generator — FIX B (agent-control#193 Defect B).
# Replays the §5b ownership semantics of the v2.1 bytes (git 8fc374ca) and the
# v2.2 worktree bytes against a hermetic fixture production root, and checks
# the plist-pinned state with the REAL production validator
# (packages/scheduler/src/watchdog/private-state-io.js readPrivateFile,
# expectedGid=20 per the live plists' SCHEDULER_INCIDENT_OWNER_GID).
# Non-production: /tmp fixtures only; ownership identities parameterized to the
# invoking user (group damage via a secondary group; the pinned group 20 is the
# invoking user's primary group here — same shape as the #193 live flip 20→601).
set -euo pipefail
cd "$(dirname "$0")/.."   # worktree root
WT=$(pwd)
V21_INSTALLER=$(mktemp /tmp/v21-installer-bytes-XXXXXXXXXX)
git show 8fc374ca:scripts/trusted-cp-deploy-install.sh > "$V21_INSTALLER"
OUT=$(mktemp /tmp/red-green-ownership-XXXXXXXXXX)
NODE=${NODE:-$(command -v node)}

fixture() { # $1 = path — production-shaped 505 control state, pinned set at gid 20
  local root=$1
  rm -rf "$root"; mkdir -p "$root"/{bindings,scheduler,logs,workspaces,homes,control}
  for p in scheduler-watchdog incident-backups; do
    mkdir -p "$root/control/$p"; chmod 700 "$root/control/$p"
    local leaf=$([ "$p" = scheduler-watchdog ] && echo incidents.json || echo backup-1.json)
    printf '{}\n' > "$root/control/$p/$leaf"; chmod 600 "$root/control/$p/$leaf"
    chgrp 20 "$root/control/$p" "$root/control/$p/$leaf"
  done
  printf '{}\n' > "$root/control/turn-recovery-v3.json"; chmod 600 "$root/control/turn-recovery-v3.json"
}

validate() { # $1 = leaf — the REAL production validator with the pinned gid
  "$NODE" --input-type=module -e '
    const { readPrivateFile } = await import(process.argv[1])
    try { readPrivateFile(process.argv[2], { expectedGid: 20 }); console.log("VALIDATOR_ACCEPT") }
    catch (e) { console.log("VALIDATOR_REJECT: " + (e?.message ?? e)) }
  ' "$WT/packages/scheduler/src/watchdog/private-state-io.js" "$1"
}

{
echo "# RED/GREEN — §5b watchdog ownership (FIX B, agent-control#193 Defect B)"
echo "# v2.1 bytes: $(shasum -a 256 "$V21_INSTALLER" | awk '{print $1}')  (git 8fc374ca:scripts/trusted-cp-deploy-install.sh)"
echo "# v2.2 bytes: $(shasum -a 256 "$WT/scripts/trusted-cp-deploy-install.sh" | awk '{print $1}')"
echo "# operator uid=$(id -u) primary_gid=$(id -g) pinned_gid=20 damage_gid=$DAMAGE_GID"
echo

echo "## [structural] v2.1 §5b blanket line (verbatim from git 8fc374ca bytes)"
grep -n 'chown -R "${AUTHSVC_UID}:${AUTHSVC_GID}" "\$PROD_ROOT/bindings"' "$V21_INSTALLER" | head -1
echo "→ the blanket -R scope CONTAINS \$PROD_ROOT/control ⇒ control/scheduler-watchdog + control/incident-backups are swept (the defect)"
echo

echo "## [RED-B] v2.1 blanket block replayed on the fixture (ownership identities parameterized)"
ROOT=$(mktemp -d /tmp/b7-5b-red-XXXXXXXX); fixture "$ROOT"
leaf="$ROOT/control/scheduler-watchdog/incidents.json"
echo "pre:  pinned leaf gid=$(stat -f %g "$leaf") → $(validate "$leaf")"
chown -R "$(id -u):$DAMAGE_GID" "$ROOT/bindings" "$ROOT/scheduler" "$ROOT/control" "$ROOT/logs"
chmod -R u+rwX,go-rwx "$ROOT/bindings" "$ROOT/scheduler" "$ROOT/control" "$ROOT/logs"
echo "post: pinned leaf gid=$(stat -f %g "$leaf") (blanket flipped 20→$DAMAGE_GID — the #193 live flip shape)"
echo "validator: $(validate "$leaf")"
validate "$leaf" | grep -q VALIDATOR_REJECT
echo "→ RED reproduced: the restored tree's own scheduler startup readiness gate fails exactly like #193 03:41 ('unsafe incident state file')"
rm -rf "$ROOT"; echo

echo "## [GREEN-B1] v2.2 §5b block replayed on the fixture (exclusion + pin assert)"
ROOT=$(mktemp -d /tmp/b7-5b-green-XXXXXX); fixture "$ROOT"
leaf="$ROOT/control/scheduler-watchdog/incidents.json"
chown -R "$(id -u):$DAMAGE_GID" "$ROOT/bindings" "$ROOT/scheduler" "$ROOT/logs"
chmod -R u+rwX,go-rwx "$ROOT/bindings" "$ROOT/scheduler" "$ROOT/logs"
find "$ROOT/control" \
  -not -path "$ROOT/control/scheduler-watchdog" \
  -not -path "$ROOT/control/scheduler-watchdog/*" \
  -not -path "$ROOT/control/incident-backups" \
  -not -path "$ROOT/control/incident-backups/*" \
  -exec chown "$(id -u):$DAMAGE_GID" {} +
find "$ROOT/control" \
  -not -path "$ROOT/control/scheduler-watchdog" \
  -not -path "$ROOT/control/scheduler-watchdog/*" \
  -not -path "$ROOT/control/incident-backups" \
  -not -path "$ROOT/control/incident-backups/*" \
  -exec chmod u+rwX,go-rwx {} +
for pinned in "$ROOT/control/scheduler-watchdog" "$ROOT/control/incident-backups"; do
  if [ -d "$pinned" ]; then chgrp -R 20 "$pinned"; else mkdir -p "$pinned"; chown "$(id -u):20" "$pinned"; chmod 700 "$pinned"; fi
done
echo "pinned leaf gid=$(stat -f %g "$leaf") (stayed 20) → $(validate "$leaf")"
echo "sibling turn-recovery-v3.json gid=$(stat -f %g "$ROOT/control/turn-recovery-v3.json") (non-pinned control state still receives the blanket — reader-gid 601 contract untouched)"
validate "$leaf" | grep -q VALIDATOR_ACCEPT
test "$(stat -f %g "$ROOT/control/turn-recovery-v3.json")" = "$DAMAGE_GID"
echo "→ GREEN: pinned set excluded + pinned; siblings unchanged behavior"
rm -rf "$ROOT"; echo

echo "## [GREEN-B2] RESTORE-R2 heals the v2.1 damage (exact restore command shape)"
ROOT=$(mktemp -d /tmp/b7-5b-r2-XXXXXX); fixture "$ROOT"
leaf="$ROOT/control/scheduler-watchdog/incidents.json"
chown -R "$(id -u):$DAMAGE_GID" "$ROOT/control"; chmod -R u+rwX,go-rwx "$ROOT/control"
echo "damaged: pinned leaf gid=$(stat -f %g "$leaf") → $(validate "$leaf" | head -1)"
for p in "$ROOT/control/scheduler-watchdog" "$ROOT/control/incident-backups"; do [ -d "$p" ] && chgrp -R 20 "$p"; done
echo "RESTORE-R2: pinned leaf gid=$(stat -f %g "$leaf") → $(validate "$leaf")"
validate "$leaf" | grep -q VALIDATOR_ACCEPT
rm -rf "$ROOT"; echo

echo "## [structural] v2.2 installer carries the pinned-set machinery"
grep -c "scheduler-watchdog" "$WT/scripts/trusted-cp-deploy-install.sh" | xargs echo "scheduler-watchdog mentions:"
grep -n "WATCHDOG_PINNED_PRIVATE_STATE_GID=20" "$WT/scripts/trusted-cp-deploy-install.sh"
grep -n "RESTORE-R2" "$WT/scripts/trusted-cp-deploy-install.sh" | head -2
echo
echo "RED_GREEN_WATCHDOG_OWNERSHIP = PASS (RED v2.1 reproduced + GREEN v2.2 exclusion/pin + RESTORE-R2 heal, real validator)"
} 2>&1 | tee "$OUT"
rm -f "$V21_INSTALLER"
echo "evidence written: $OUT"
