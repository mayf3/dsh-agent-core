#!/bin/zsh -f
set -eu
umask 077
DCP_OPS=/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01
/bin/mkdir "$DCP_OPS/diagnostic-invocation"
# Read-only continuation of the stopped attempt. No installation or login command.
/usr/bin/sudo -n /bin/ls -laeO /private/var/db/agent-deploy-bootstrap > "$DCP_OPS/readback/bootstrap-root.metadata" 2> "$DCP_OPS/readback/bootstrap-root.stderr"
/usr/bin/sudo -n /usr/bin/stat -f '%u %g %Lp %l %f %m %c %N' /private/var/db/agent-deploy-bootstrap/bootstrap.lock /private/etc/sudoers > "$DCP_OPS/readback/bootstrap-lock-sudoers.metadata"
/usr/bin/sudo -n /usr/bin/xattr /private/etc/sudoers > "$DCP_OPS/readback/sudoers-xattr-names.txt"
/usr/bin/sudo -n /usr/bin/shasum -a 256 /private/etc/sudoers > "$DCP_OPS/readback/sudoers.sha256"
/usr/bin/sudo -n /usr/sbin/visudo -c > "$DCP_OPS/readback/sudoers-validation.txt" 2> "$DCP_OPS/readback/sudoers-validation.stderr"
print -r -- 'READ_ONLY_DIAGNOSTICS_COMPLETE' > "$DCP_OPS/diagnostic-result.txt"
print -r -- '前置检查失败已保留。只读回读完成；未执行重试或登录。'
