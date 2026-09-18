#!/bin/zsh -f
set -eu
umask 077
DCP_OPS=/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01
DCP_PACKAGE=/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd
DCP_AUTH=/private/var/db/genesis-65559dd-20260918-01.authorization.json
DCP_RUNNER=/usr/local/libexec/agent-deployd/agent-deploy-bootstrap
DCP_PHASE=entry
# Fixed read-only receipt export; private keys and login credential contents are excluded.
dcp_readback() {
  /bin/mkdir -p "$DCP_OPS/readback"
  /usr/bin/sudo -n /bin/ls -ldeO /usr/local/libexec/agent-deployd /private/var/db/agent-deployd /private/var/db/agent-deployd/issuer-keys /private/var/db/agent-deploy-review /private/var/db/agent-deploy-review-workspace /private/var/db/agent-deploy-bootstrap /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01 > "$DCP_OPS/readback/directories.metadata" 2> "$DCP_OPS/readback/directories.stderr"
  /usr/bin/sudo -n /bin/ls -laeO /private/var/db/agent-deployd/issuer-keys > "$DCP_OPS/readback/keys.metadata" 2> "$DCP_OPS/readback/keys.stderr"
  /usr/bin/sudo -n /usr/bin/stat -f '%u %g %Lp %l %N' /private/var/db/agent-deploy-review/auth.json > "$DCP_OPS/readback/reviewer-auth.metadata" 2> "$DCP_OPS/readback/reviewer-auth.stderr"
  /usr/bin/sudo -n /bin/ls -laeO /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps > "$DCP_OPS/readback/steps.metadata" 2> "$DCP_OPS/readback/steps.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/owner-authorization.json > "$DCP_OPS/readback/journal-owner-authorization.json" 2> "$DCP_OPS/readback/journal-owner-authorization.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/preflight.json > "$DCP_OPS/readback/journal-preflight.json" 2> "$DCP_OPS/readback/journal-preflight.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/login-intent.json > "$DCP_OPS/readback/journal-login-intent.json" 2> "$DCP_OPS/readback/journal-login-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/login-result.json > "$DCP_OPS/readback/journal-login-result.json" 2> "$DCP_OPS/readback/journal-login-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/000-intent.json > "$DCP_OPS/readback/journal-steps-000-intent.json" 2> "$DCP_OPS/readback/journal-steps-000-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/001-result.json > "$DCP_OPS/readback/journal-steps-001-result.json" 2> "$DCP_OPS/readback/journal-steps-001-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/002-intent.json > "$DCP_OPS/readback/journal-steps-002-intent.json" 2> "$DCP_OPS/readback/journal-steps-002-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/003-result.json > "$DCP_OPS/readback/journal-steps-003-result.json" 2> "$DCP_OPS/readback/journal-steps-003-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/004-intent.json > "$DCP_OPS/readback/journal-steps-004-intent.json" 2> "$DCP_OPS/readback/journal-steps-004-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/005-result.json > "$DCP_OPS/readback/journal-steps-005-result.json" 2> "$DCP_OPS/readback/journal-steps-005-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/006-intent.json > "$DCP_OPS/readback/journal-steps-006-intent.json" 2> "$DCP_OPS/readback/journal-steps-006-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/007-result.json > "$DCP_OPS/readback/journal-steps-007-result.json" 2> "$DCP_OPS/readback/journal-steps-007-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/008-intent.json > "$DCP_OPS/readback/journal-steps-008-intent.json" 2> "$DCP_OPS/readback/journal-steps-008-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/009-result.json > "$DCP_OPS/readback/journal-steps-009-result.json" 2> "$DCP_OPS/readback/journal-steps-009-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/010-intent.json > "$DCP_OPS/readback/journal-steps-010-intent.json" 2> "$DCP_OPS/readback/journal-steps-010-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/011-result.json > "$DCP_OPS/readback/journal-steps-011-result.json" 2> "$DCP_OPS/readback/journal-steps-011-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/012-intent.json > "$DCP_OPS/readback/journal-steps-012-intent.json" 2> "$DCP_OPS/readback/journal-steps-012-intent.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/013-result.json > "$DCP_OPS/readback/journal-steps-013-result.json" 2> "$DCP_OPS/readback/journal-steps-013-result.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/failure.json > "$DCP_OPS/readback/journal-steps-failure.json" 2> "$DCP_OPS/readback/journal-steps-failure.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/installation.json > "$DCP_OPS/readback/journal-steps-installation.json" 2> "$DCP_OPS/readback/journal-steps-installation.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deployd/service.json > "$DCP_OPS/readback/service.json" 2> "$DCP_OPS/readback/service.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deployd/local-trust.json > "$DCP_OPS/readback/local-trust.json" 2> "$DCP_OPS/readback/local-trust.json.stderr"
  /usr/bin/sudo -n /bin/cat /private/var/db/agent-deployd/registry/state-00000000000000000001.json > "$DCP_OPS/readback/registry-state-1.json" 2> "$DCP_OPS/readback/registry-state-1.json.stderr"
  /usr/bin/sudo -n /bin/cat /Library/LaunchDaemons/ai.agent-deployd.plist > "$DCP_OPS/readback/disabled-controller.plist" 2> "$DCP_OPS/readback/disabled-controller.plist.stderr"
  /usr/bin/sudo -n /usr/bin/shasum -a 256 /Library/LaunchDaemons/ai.agent-core.runtime.plist /Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w1.plist /Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w2.plist /Library/LaunchDaemons/com.adobe.acc.installer.v2.plist /Library/LaunchDaemons/com.auth-service.plist /Library/LaunchDaemons/com.docker.socket.plist /Library/LaunchDaemons/com.docker.vmnetd.plist /Library/LaunchDaemons/com.microsoft.OneDriveStandaloneUpdaterDaemon.plist /Library/LaunchDaemons/com.microsoft.OneDriveUpdaterDaemon.plist /Library/LaunchDaemons/com.microsoft.autoupdate.helper.plist /Library/LaunchDaemons/com.microsoft.office.licensingV2.helper.plist /Library/LaunchDaemons/com.openclaw.forum-scheduler.plist /Library/LaunchDaemons/com.openclaw.gateway.plist /Library/LaunchDaemons/com.openclaw.host-exec-runner.plist /Library/LaunchDaemons/com.openclaw.workflow-dispatcher.plist /Library/LaunchDaemons/com.tailscale.tailscaled.plist /Library/LaunchDaemons/com.west2online.ClashXPro.ProxyConfigHelper.plist > "$DCP_OPS/readback/existing-system-plists.sha256" 2> "$DCP_OPS/readback/existing-system-plists.stderr"
  /usr/bin/sudo -n /bin/ls -ldeO /private/var/db/agent-deployd/activation.json /private/var/db/agent-deployd/daemon-activation.json /private/var/run/agent-deployd > "$DCP_OPS/readback/activation-paths.metadata" 2> "$DCP_OPS/readback/activation-paths.stderr"
  return 0
}
trap 'DCP_RC=$?; set +e; if [[ $DCP_PHASE != entry && $DCP_PHASE != external_preimage ]]; then dcp_readback; fi; print -r -- "$DCP_RC $DCP_PHASE" > "$DCP_OPS/operator-exit.txt"; if (( DCP_RC != 0 )); then print -r -- "STOP: $DCP_PHASE (exit $DCP_RC). Do not rerun. Evidence retained."; fi' EXIT
/bin/mkdir "$DCP_OPS/entry-invocation"
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
print -r -- '已授权的一次禁用安装。请在此终端输入本机管理员密码；密码不会写入日志。'
/usr/bin/sudo -v
DCP_PHASE=external_preimage
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
[[ $(/bin/date +%s) -lt 1789700026 ]]
[[ ! -e /usr/local/libexec/agent-deployd && ! -L /usr/local/libexec/agent-deployd ]]
[[ ! -e "$DCP_AUTH" && ! -L "$DCP_AUTH" ]]
[[ ! -e /private/var/db/agent-deploy-bootstrap && ! -L /private/var/db/agent-deploy-bootstrap ]]
DCP_HASH=$(/usr/bin/shasum -a 256 /usr/bin/install)
[[ ${DCP_HASH%% *} == 66a36cfae72df019e1dc8649331f956fc93d3d096226b535a4e5931535d024cc ]]
DCP_HASH=$(/usr/bin/shasum -a 256 "$DCP_PACKAGE/executables/agent-deploy-bootstrap")
[[ ${DCP_HASH%% *} == 2a8550ac3ffde4ccd21d501d7869608628bacd8ccb4feaab44aeb1803546d301 ]]
DCP_HASH=$(/usr/bin/shasum -a 256 "$DCP_OPS/owner-authorization.json")
[[ ${DCP_HASH%% *} == dc416250cf805465ab50de917ac1f59323a6096b2f0745600d40a374ded3a37e ]]
DCP_PHASE=install_protected_runner
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
/usr/bin/sudo -n /usr/bin/install -d -o root -g wheel -m 0755 /usr/local/libexec/agent-deployd
/usr/bin/sudo -n /usr/bin/install -o root -g wheel -m 0555 "$DCP_PACKAGE/executables/agent-deploy-bootstrap" "$DCP_RUNNER"
# This readback runs as the ordinary caller, before any root runner invocation.
/usr/bin/shasum -a 256 "$DCP_RUNNER" > "$DCP_OPS/installed-runner.sha256"
read -r DCP_HASH DCP_REST < "$DCP_OPS/installed-runner.sha256"
[[ $DCP_HASH == 2a8550ac3ffde4ccd21d501d7869608628bacd8ccb4feaab44aeb1803546d301 ]]
/usr/bin/stat -f '%u %g %Lp %l %N' "$DCP_RUNNER" > "$DCP_OPS/installed-runner.metadata"
[[ $(/usr/bin/stat -f '%u:%g:%Lp:%l' "$DCP_RUNNER") == 0:0:555:1 ]]
DCP_PHASE=install_external_grant
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
/usr/bin/sudo -n /usr/bin/install -o root -g wheel -m 0600 "$DCP_OPS/owner-authorization.json" "$DCP_AUTH"
DCP_HASH=$(/usr/bin/sudo -n /usr/bin/shasum -a 256 "$DCP_AUTH")
[[ ${DCP_HASH%% *} == dc416250cf805465ab50de917ac1f59323a6096b2f0745600d40a374ded3a37e ]]
/usr/bin/sudo -n /usr/bin/stat -f '%u %g %Lp %l %N' "$DCP_AUTH" > "$DCP_OPS/protected-grant.metadata"
DCP_PHASE=native_install
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
/usr/bin/sudo -n "$DCP_RUNNER" install "$DCP_PACKAGE" "$DCP_AUTH" 7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065 81aee70d3d96b976b55f2e92b814e876121b5f31a2dc40960247fc327e695d06 89f50873ae411a3df017d45e1d72feadc3b0c52862a51c86422094c26f15ea82 2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842 254ac64e7c3c3f0a4026b6feab568f2090cd2701234308c5e0594f4fcbdd7bb0 > "$DCP_OPS/install.stdout.json" 2> "$DCP_OPS/install.stderr.txt"
DCP_PHASE=dedicated_reviewer_login
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
print -r -- '禁用安装命令已成功。请按下方设备登录提示，使用预定评审账户在本机完成登录。'
print -r -- '登录码只显示于本终端，不采集到操作日志。超时或失败后不要重试。'
/usr/bin/sudo -n "$DCP_RUNNER" reviewer-login "$DCP_PACKAGE" "$DCP_AUTH" 7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065 81aee70d3d96b976b55f2e92b814e876121b5f31a2dc40960247fc327e695d06 89f50873ae411a3df017d45e1d72feadc3b0c52862a51c86422094c26f15ea82 2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842 254ac64e7c3c3f0a4026b6feab568f2090cd2701234308c5e0594f4fcbdd7bb0
DCP_PHASE=installed_and_login_completed_pending_readback
print -r -- "$DCP_PHASE" > "$DCP_OPS/operator-phase.txt"
print -r -- '安装和专用登录命令完成；服务仍保持禁用，Agent 将继续回读核验。'
