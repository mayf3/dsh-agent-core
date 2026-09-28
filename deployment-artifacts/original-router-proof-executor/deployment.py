"""Original executor's fixed private deployment callsite, never DS dispatch.

The retained DS source is admitted on its existing sealed descriptor. Only the
private original driver replaces its ordinary startup callsite with the QF
startup it directly owns; public DS/server/source bytes remain unchanged.
"""
import os
import stat
import subprocess
import time
from types import SimpleNamespace


def _deploy_owned(owner):
    # Names below are bound by the sealed driver, not invocation parameters.
    require(type(owner) is FixedOriginalDriver and not owner._unknown,
            'ORIGINAL_CUSTODY_UNKNOWN')
    binding = QUALIFIED_DEPLOYMENT
    require(type(binding) is _DeploymentBinding,'ORIGINAL_DEPLOYMENT_UNBOUND')
    require(binding.final_binary_sha256 == owner._binding.consuming_binary_sha256,
            'ORIGINAL_DEPLOYMENT_BINARY_MISMATCH')
    raw = _descriptor_bytes(owner._daemon_fd,DAEMON_SHA,128 * (1 << 20))
    scope = {'__name__':'_original_fixed_deployment_instance',
             '__file__':'original-pinned-deployment-system.py'}
    exec(compile(raw,scope['__file__'],'exec'),scope)
    require(scope.get('TEST_MODE') is False
            and scope.get('STATE_ROOT') == '/private/var/db/agent-deploy-system'
            and scope.get('GEN_ROOT') == '/usr/local/libexec/agent-core/.ds-generations',
            'ORIGINAL_DEPLOYMENT_INSTANCE_UNSAFE')
    original_lock = scope['mutation_lock']
    original_health = scope['health_check']

    def checked_health():
        owner._continuity()
        deadline=min(owner._operation_deadline,owner._startup_deadline)
        require(time.monotonic() < deadline,'ORIGINAL_HEALTH_DEADLINE')
        original_process=scope['subprocess']
        original_time=scope['time']
        def probe(argv,**kwargs):
            require(argv == ['/usr/bin/curl','-fsS','--max-time','5',
                             'http://127.0.0.1:8790/health'],'ORIGINAL_HEALTH_COMMAND')
            remaining=deadline-time.monotonic()
            require(remaining > 0,'ORIGINAL_HEALTH_DEADLINE')
            return subprocess.run(argv,**kwargs,timeout=remaining)
        def bounded_sleep(seconds):
            remaining=deadline-time.monotonic()
            require(remaining > 0,'ORIGINAL_HEALTH_DEADLINE')
            time.sleep(min(seconds,remaining))
        try:
            # Private source instance only; the installed DS/public health
            # method is unchanged. Every original probe retains Root's bound.
            scope['subprocess']=SimpleNamespace(run=probe)
            scope['time']=SimpleNamespace(monotonic=time.monotonic,sleep=bounded_sleep)
            value=original_health()
            require(time.monotonic() < deadline and type(value) is dict
                    and value.get('ok') is True and value.get('deliverReady') is True
                    and value.get('faked') is not True,'ORIGINAL_HEALTH_UNKNOWN')
            owner._continuity()
            return value
        finally:
            scope['subprocess']=original_process;scope['time']=original_time

    scope['health_check']=checked_health
    owner._health_original=checked_health

    def retain_original_lock():
        require(owner._canonical_fd is None,'ORIGINAL_CANONICAL_ALREADY_OWNED')
        fd = original_lock()  # Actual existing fixed namespace/flock callsite.
        owner._canonical_fd = fd  # Preserve exact known descriptor on any failure.
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
                and not meta.st_mode & 0o022,'ORIGINAL_CANONICAL_CUSTODY')
        owner._canonical_fd = os.dup(fd)
        owner._canonical_identity = (meta.st_dev,meta.st_ino)
        return fd  # DS closes this copy; owner's genuine OFD stays held.

    def qualification_start(wait_for_unload=False):
        require(wait_for_unload is True,'ORIGINAL_DEPLOYMENT_TARGET_UNKNOWN')
        # Fixed two-route initial stop only. This is not old-tree quiescence,
        # LE1, or ownership of an arbitrary PID. No ordinary bootstrap occurs.
        deadline = min(owner._operation_deadline,time.monotonic() + 30)
        for route in ('gui/505/ai.agent-core.runtime','system/ai.agent-core.runtime'):
            require(time.monotonic() < deadline,'ORIGINAL_UNLOAD_DEADLINE')
            subprocess.run(['/bin/launchctl','bootout',route],stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                timeout=deadline-time.monotonic(),check=False)
            while True:
                remaining = deadline-time.monotonic()
                require(remaining > 0,'ORIGINAL_UNLOAD_DEADLINE')
                result = subprocess.run(['/bin/launchctl','print',route],
                    stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                    timeout=remaining,check=False)
                require(time.monotonic() < deadline,'ORIGINAL_UNLOAD_DEADLINE')
                if result.returncode == 113: break
                require(result.returncode == 0,'ORIGINAL_UNLOAD_UNKNOWN')
                time.sleep(min(0.1,deadline-time.monotonic()))
        owner._verify_installed()
        owner._launch_phase('deployment_start')
        return {'restarted':True}  # Derived from this actual owned callsite.

    scope['mutation_lock'] = retain_original_lock
    scope['restart_runtime'] = qualification_start
    # Exact existing DEPLOY grammar, private fixed values only. No public
    # request is added; no installed daemon/client or E7 handler is replaced.
    result = scope['deploy']({'action':'DEPLOY','operation_id':ID + '-deploy',
        'unit':'scheduler-whole-main','artifact_tree_sha256':binding.final_binary_sha256,
        'expected_tree_sha256':binding.preimage_binary_sha256,
        'admitted_rollback_generation':binding.rollback_operation_id})
    require(type(result) is dict and result.get('ok') is True
            and result.get('state') == 'COMPLETE' and result.get('operation_id') == ID + '-deploy',
            'ORIGINAL_DEPLOYMENT_INCOMPLETE')
    # The same private source instance reads its actual emitted receipt. The
    # caller cannot supply a COMPLETE log or fabricated deployment timestamp.
    receipt, _ = scope['read_verified'](scope['receipt_path'](ID + '-deploy'))
    value = _object(receipt)
    require(type(value.get('version')) is int and value['version'] == scope['VERSION']
            and value.get('operation_id') == ID + '-deploy'
            and value.get('unit') == 'scheduler-whole-main'
            and value.get('state') == 'COMPLETE'
            and value.get('deployed_artifact_sha') == binding.final_binary_sha256,
            'ORIGINAL_DEPLOYMENT_READBACK_UNKNOWN')
    owner._continuity()
    return value
