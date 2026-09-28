"""Default-inert installation-time original qualifier package handoff.

Only a separately compiled, reviewed DS image may enable the fixed selector.
The root shim publishes the exact package and seal from its one-use install;
this source never embeds or pins its own daemon bytes or digest.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import threading
import time


QUALIFIER_ACTIVE = False
START_TIME = time.time()  # This DS process instance, not a historical PID.
ROOT_HOST_OBSERVER = None  # Must be the reviewed root OS identity source; never caller data.
EXPECTED_HOST_ID = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
OPERATION_ID = 'original-router-qualification-20260927-v1'
SHIM_OPERATION_ID = 'ds-hr-admin-private-install-20260928-v1'
PACKAGE_DIRECTORY = Path('/private/var/db/agent-deploy-system/' + OPERATION_ID + '/package')
STATE_DIRECTORY = Path('/private/var/db/agent-deploy-system/receipts')
SHIM_RECEIPT = Path('/private/var/db/agent-deploy-shim/receipts/'
    + SHIM_OPERATION_ID + '.json')
SEAL_NAME = 'INSTALL-SEAL.json'
CLAIM_NAME = OPERATION_ID + '-launch.json'
PYTHON = Path('/usr/bin/python3')
DAEMON = Path('/usr/local/libexec/agent-deploy-system/deployment_system.py')
FIXED_FILES = frozenset(('PACKAGE.json', 'entry-manifest.json', 'driver.py',
    'procedure.py', 'admin_procedure.py', 'deployment.py', 'admin_observation.mjs',
    'handoff.py', 'child-proof.py', 'deployment_system.py',
    'admin_launcher.py', 'admin_root_carrier.py'))
_state = {'attempted': False, 'child': None}


class BootstrapRejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise BootstrapRejected(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _digest(value):
    return type(value) is str and re.fullmatch('[a-f0-9]{64}', value)


def _binding(seal):
    require(type(seal) is dict and set(seal) ==
            {'version', 'operationId', 'installOperationId', 'hostId',
             'packageSha256', 'fileSha256',
             'pythonSha256', 'state', 'replayAllowed'}
            and type(seal['version']) is int and seal['version'] == 1
            and seal['operationId'] == OPERATION_ID
            and seal['installOperationId'] == SHIM_OPERATION_ID
            and seal['hostId'] == EXPECTED_HOST_ID
            and seal['state'] == 'INSTALLED_WAITING'
            and seal['replayAllowed'] is False
            and type(seal['fileSha256']) is dict
            and set(seal['fileSha256']) == FIXED_FILES,
            'ADMIN_INSTALL_BINDING_UNKNOWN')
    require(all(_digest(value) for value in seal['fileSha256'].values())
            and _digest(seal['packageSha256']) and _digest(seal['pythonSha256'])
            and sha(canonical(seal['fileSha256'])) == seal['packageSha256'],
            'ADMIN_INSTALL_HASH_UNKNOWN')
    return seal


def _root_metadata(path):
    meta = os.stat(path, follow_symlinks=False)
    require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == 0
            and not stat.S_IMODE(meta.st_mode) & 0o022
            and meta.st_nlink >= 1, 'ADMIN_INSTALL_CUSTODY_UNKNOWN')
    return meta


def _parent(path):
    require(path.is_absolute() and '..' not in path.parts,
            'ADMIN_INSTALL_NAMESPACE_UNKNOWN')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    opened = [fd]
    trace = []
    identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                          m.st_gid, m.st_nlink, m.st_mtime_ns, m.st_ctime_ns)
    try:
        current = ''
        for component in path.parts[1:-1]:
            current += '/' + component
            before = os.stat(component, dir_fd=fd, follow_symlinks=False)
            require(stat.S_ISDIR(before.st_mode) and before.st_uid == 0,
                    'ADMIN_INSTALL_NAMESPACE_UNKNOWN')
            if current == '/private/var/db/agent-deploy-system':
                require(before.st_gid == 80 and stat.S_IMODE(before.st_mode) == 0o770,
                        'ADMIN_INSTALL_DS_PARENT_UNKNOWN')
            else:
                require(not stat.S_IMODE(before.st_mode) & 0o022,
                        'ADMIN_INSTALL_NAMESPACE_UNKNOWN')
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=fd)
            opened.append(child)
            require(identity(before) == identity(os.fstat(child)),
                    'ADMIN_INSTALL_NAMESPACE_CHANGED')
            trace.append((fd, component, child, identity(before)))
            fd = child
        for parent, component, child, expected in trace:
            require(identity(os.stat(component, dir_fd=parent,
                                     follow_symlinks=False)) == expected
                    and identity(os.fstat(child)) == expected,
                    'ADMIN_INSTALL_NAMESPACE_CHANGED')
        opened.pop()
        for old in reversed(opened): os.close(old)
        return fd
    except BaseException:
        for old in reversed(opened): os.close(old)
        raise


def _python_identity():
    parent = _parent(PYTHON)
    try:
        fd = os.open(PYTHON.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            meta = os.fstat(fd)
            require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
                    and not stat.S_IMODE(meta.st_mode) & 0o022
                    and meta.st_nlink == 1 and 0 < meta.st_size <= 128 * (1 << 20),
                    'ADMIN_INSTALL_PYTHON_CUSTODY')
            raw = os.pread(fd, meta.st_size + 1, 0)
            identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                                  m.st_gid, m.st_nlink, m.st_size,
                                  m.st_mtime_ns, m.st_ctime_ns)
            require(len(raw) == meta.st_size and identity(os.fstat(fd)) == identity(meta)
                    and identity(os.stat(PYTHON.name, dir_fd=parent,
                                         follow_symlinks=False)) == identity(meta),
                    'ADMIN_INSTALL_PYTHON_CHANGED')
            return sha(raw)
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def _publish(parent, name, raw):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                 0o600, dir_fd=parent)
    try:
        os.fchown(fd, 0, 0)
        os.fchmod(fd, 0o600)
        view = memoryview(raw)
        while view:
            count = os.write(fd, view)
            require(count > 0, 'ADMIN_INSTALL_SHORT_WRITE')
            view = view[count:]
        os.fsync(fd)
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
                and stat.S_IMODE(meta.st_mode) == 0o600 and meta.st_nlink == 1
                and meta.st_size == len(raw), 'ADMIN_INSTALL_FILE_CUSTODY')
    finally:
        os.close(fd)
    os.fsync(parent)
    check = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        after = os.fstat(check)
        pathname = os.stat(name, dir_fd=parent, follow_symlinks=False)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                              m.st_gid, m.st_nlink, m.st_size,
                              m.st_mtime_ns, m.st_ctime_ns)
        require(identity(after) == identity(pathname) and after.st_uid == 0
                and stat.S_IMODE(after.st_mode) == 0o600
                and os.pread(check, len(raw) + 1, 0) == raw
                and identity(os.fstat(check)) == identity(after),
                'ADMIN_INSTALL_READBACK_CHANGED')
    finally:
        os.close(check)


def _read_sealed(path, limit, mode=0o600):
    parent = _parent(path)
    try:
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            before = os.fstat(fd)
            identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid,
                                  m.st_gid, m.st_nlink, m.st_size,
                                  m.st_mtime_ns, m.st_ctime_ns)
            require(stat.S_ISREG(before.st_mode) and before.st_uid == 0
                    and stat.S_IMODE(before.st_mode) == mode
                    and before.st_nlink == 1 and 0 < before.st_size <= limit,
                    'ADMIN_INSTALL_FILE_CUSTODY')
            raw = os.pread(fd, before.st_size + 1, 0)
            require(len(raw) == before.st_size
                    and identity(os.fstat(fd)) == identity(before)
                    and identity(os.stat(path.name, dir_fd=parent,
                                         follow_symlinks=False)) == identity(before),
                    'ADMIN_INSTALL_FILE_CHANGED')
            return raw
        finally:
            os.close(fd)
    finally:
            os.close(parent)


def _committed_install(seal):
    receipt = json.loads(_read_sealed(SHIM_RECEIPT, 8192, 0o644))
    require(type(receipt) is dict
            and receipt.get('operation_id') == SHIM_OPERATION_ID
            and receipt.get('action') == 'INSTALL_DEPLOYMENT_SYSTEM'
            and receipt.get('state') == 'COMMITTED'
            and receipt.get('qualificationPackageSha256') == seal['packageSha256']
            and type(receipt.get('artifacts')) is dict
            and receipt['artifacts'].get('deployment_system.py') ==
                seal['fileSha256']['deployment_system.py']
            and type(receipt.get('ds_status')) is dict
            and type(receipt['ds_status'].get('pid')) is int
            and receipt['ds_status']['pid'] == os.getpid()
            and type(receipt.get('started')) in (int, float)
            and type(receipt.get('committedAt')) in (int, float)
            and receipt['started'] <= START_TIME <= receipt['committedAt']
            and receipt['committedAt'] <= time.time()
            and time.time() - receipt['committedAt'] <= 120,
            'ADMIN_INSTALL_SHIM_COMMIT_UNKNOWN')


def installation_bootstrap():
    if not QUALIFIER_ACTIVE:
        return None  # The installed, uncompiled source never reads protected state.
    require(not _state['attempted'], 'ADMIN_INSTALL_NO_REPLAY')
    _state['attempted'] = True
    require(os.geteuid() == 0, 'ADMIN_INSTALL_ROOT_REQUIRED')
    seal = _binding(json.loads(_read_sealed(PACKAGE_DIRECTORY / SEAL_NAME, 8192)))
    _committed_install(seal)  # INSTALLED_WAITING alone grants no startup.
    require(ROOT_HOST_OBSERVER is not None and
            ROOT_HOST_OBSERVER() == seal['hostId'], 'ADMIN_INSTALL_HOST_UNKNOWN')
    require(_python_identity() == seal['pythonSha256'], 'ADMIN_INSTALL_PYTHON_CHANGED')
    _root_metadata(PACKAGE_DIRECTORY.parent)
    _root_metadata(STATE_DIRECTORY)
    for name in FIXED_FILES:
        raw = _read_sealed(PACKAGE_DIRECTORY / name,
            128 * (1 << 20) if name == 'deployment_system.py' else 65536)
        require(sha(raw) == seal['fileSha256'][name],
                'ADMIN_INSTALL_PACKAGE_CHANGED')
    require(sha(_read_sealed(DAEMON, 128 * (1 << 20), 0o555)) ==
            seal['fileSha256']['deployment_system.py'],
            'ADMIN_INSTALL_DAEMON_CHANGED')
    lock = mutation_lock()  # Existing canonical DS mutation domain.
    parent = package_fd = state_fd = None
    try:
        state_fd = _parent(STATE_DIRECTORY / CLAIM_NAME)
        try:
            os.stat(CLAIM_NAME, dir_fd=state_fd, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise BootstrapRejected('ADMIN_INSTALL_NO_REPLAY')
        _publish(state_fd, CLAIM_NAME, canonical({'operationId': OPERATION_ID,
            'state': 'UNKNOWN', 'packageSha256': seal['packageSha256'],
            'replayAllowed': False}))
    finally:
        for fd in (state_fd,):
            if fd is not None: os.close(fd)
        fcntl.flock(lock, fcntl.LOCK_UN)
        os.close(lock)
    # The original child obtains the canonical lock itself. The durable UNKNOWN
    # intent bars replay even if DS dies between publication and this spawn.
    child = subprocess.Popen([str(PYTHON), '-I', '-S', '-B',
        str(PACKAGE_DIRECTORY / 'admin_root_carrier.py')], close_fds=True,
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
    _state['child'] = child  # Keep actual Popen custody while this DS lives.
    return {'state': 'STARTED', 'operationId': OPERATION_ID}


def wait_for_committed_install():
    if not QUALIFIER_ACTIVE:
        return None
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            _read_sealed(SHIM_RECEIPT, 8192, 0o644)
        except FileNotFoundError:
            time.sleep(0.1)
            continue
        return installation_bootstrap()
    raise BootstrapRejected('ADMIN_INSTALL_SHIM_COMMIT_TIMEOUT')
