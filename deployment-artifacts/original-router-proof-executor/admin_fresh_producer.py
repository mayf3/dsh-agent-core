"""Fixed, default-inert root producer for the admin binder's FRESH input.

This is a private original-executor operation, not a DS action or caller API.
The reviewed package must bind all constants before this can touch installed
state. A partial output is deliberately retained and cannot be replayed.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import types

from admin_host_identity import EXPECTED_HOST_ID, observe_fixed_host
from admin_final_binding import (QUALIFICATION_ID, CUT_OPERATION_ID,
    INSTALL_OPERATION_ID, FINAL_TREE_SHA, FRESH_DIRECTORY)


ACTIVE = False
CAPTURE_ID = None
ADMISSION_ID = None
REVIEWED_DS_SHA256 = None
REVIEWED_NEW_SHA256 = None
ROOT_UID = 0
HOST_ID = EXPECTED_HOST_ID
APP = Path('/usr/local/libexec/agent-core/app')
DS_FILE = Path('/usr/local/libexec/agent-deploy-system/deployment_system.py')
OLD_PATHS = {
    'deployment_system.py': DS_FILE,
    'ds_client.py': Path('/usr/local/libexec/agent-deploy-system/ds_client.py'),
    'plist': Path('/Library/LaunchDaemons/ai.agent-deploy-system.plist'),
    'deployment-registry.json': Path('/private/var/db/agent-deploy-system-config/deployment-registry.json'),
}
NEW_NAMES = frozenset((*OLD_PATHS, 'deploy_shim.py', 'node-runtime', 'python-runtime'))
SHIM_INBOX = Path('/private/var/db/agent-deploy-shim/inbox') / INSTALL_OPERATION_ID
NEW_PATHS = {name: SHIM_INBOX / name for name in OLD_PATHS}
NEW_PATHS.update({
    'deploy_shim.py': Path('/usr/local/libexec/agent-deploy-shim/deploy_shim.py'),
    'node-runtime': Path('/usr/local/libexec/agent-core/node-runtime/bin/node'),
    'python-runtime': Path('/usr/bin/python3'),
})
READ_LIMIT = 128 << 20


class FreshRejected(Exception):
    pass


def _require(ok, code):
    if not ok:
        raise FreshRejected(code)


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _hash(value):
    return type(value) is str and re.fullmatch('[a-f0-9]{64}', value) is not None


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def _identity(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_uid, st.st_gid,
            st.st_nlink, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def _read_owned(path):
    """Read only one compiled fixed file through a no-follow descriptor."""
    path = Path(path)
    parent = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        first_dir = os.fstat(parent)
        _require(stat.S_ISDIR(first_dir.st_mode) and first_dir.st_uid == ROOT_UID,
                 'ADMIN_FRESH_CUSTODY')
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            first = os.fstat(fd)
            _require(stat.S_ISREG(first.st_mode) and first.st_uid == ROOT_UID
                     and first.st_nlink == 1 and 0 < first.st_size <= READ_LIMIT
                     and not (stat.S_IMODE(first.st_mode) & 0o022),
                     'ADMIN_FRESH_CUSTODY')
            raw = os.pread(fd, first.st_size + 1, 0)
            _require(len(raw) == first.st_size
                     and _identity(os.fstat(fd)) == _identity(first)
                     and _identity(os.stat(path.name, dir_fd=parent,
                                           follow_symlinks=False)) == _identity(first)
                     and _identity(os.stat(path.parent, follow_symlinks=False)) ==
                         _identity(first_dir), 'ADMIN_FRESH_CHANGED')
            return raw
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def _load_backend():
    """Load only the exact reviewed installed daemon implementation."""
    raw = _read_owned(DS_FILE)
    _require(_sha(raw) == REVIEWED_DS_SHA256, 'ADMIN_FRESH_DS_CHANGED')
    module = types.ModuleType('_admin_fresh_reviewed_ds')
    module.__file__ = str(DS_FILE)
    exec(compile(raw, str(DS_FILE), 'exec'), module.__dict__)
    return module


def _observe_host():
    return observe_fixed_host()


def _artifact(raw):
    return {'sha256': _sha(raw), 'size': len(raw)}


def _write_exact(directory, name, raw):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                 0o600, dir_fd=directory)
    try:
        _require(os.fstat(fd).st_uid == ROOT_UID, 'ADMIN_FRESH_CUSTODY')
        count = os.write(fd, raw)
        _require(count == len(raw), 'ADMIN_FRESH_WRITE_UNKNOWN')
        os.fsync(fd)
    finally:
        os.close(fd)
    verify = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    try:
        _require(os.pread(verify, len(raw) + 1, 0) == raw,
                 'ADMIN_FRESH_READBACK_UNKNOWN')
    finally:
        os.close(verify)


def produce():
    """Observe fixed current inputs and publish one immutable fresh set."""
    _require(ACTIVE and _hash(REVIEWED_DS_SHA256)
             and type(CAPTURE_ID) is str and re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', CAPTURE_ID)
             and type(ADMISSION_ID) is str and re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', ADMISSION_ID)
             and type(REVIEWED_NEW_SHA256) is dict
             and set(REVIEWED_NEW_SHA256) == NEW_NAMES
             and set(NEW_PATHS) == NEW_NAMES
             and all(_hash(v) for v in REVIEWED_NEW_SHA256.values()),
             'ADMIN_FRESH_UNBOUND')
    _require(os.geteuid() == ROOT_UID, 'ADMIN_FRESH_ROOT_REQUIRED')
    _require('DS_TEST_MODE' not in os.environ, 'ADMIN_FRESH_TEST_MODE')
    _require(not FRESH_DIRECTORY.exists(), 'ADMIN_FRESH_NO_REPLAY')
    ds = _load_backend()
    lock = ds.mutation_lock()
    try:
        _require(not FRESH_DIRECTORY.exists(), 'ADMIN_FRESH_NO_REPLAY')
        _require(_observe_host() == HOST_ID, 'ADMIN_FRESH_HOST_UNKNOWN')
        registry, generation = ds.load_registry()
        unit = ds.unit_from_registry(registry, 'scheduler-whole-main')
        _require(unit['kind'] == 'tree' and unit['target'] == str(APP)
                 and unit.get('preserve') == ['node_modules']
                 and unit['uid'] == 505 and unit['gid'] == 601,
                 'ADMIN_FRESH_UNIT_CHANGED')
        _, current, _ = ds.dir_tree_state(str(APP), str(APP), ['node_modules'])
        _require(_hash(current) and current != FINAL_TREE_SHA,
                 'ADMIN_FRESH_APP_UNKNOWN')
        generation_dir, capture = ds._verified_admitted_capture(
            CAPTURE_ID, generation, str(APP))
        pointer_raw, _ = ds.read_verified(os.path.join(generation_dir,
                                                       'rollback-pointer.json'))
        pointer = json.loads(pointer_raw)
        admission = ds.read_receipt(ADMISSION_ID)
        _require(type(pointer) is dict
                 and pointer.get('operation_id') == ADMISSION_ID
                 and type(admission) is dict and admission.get('state') == 'ADMITTED'
                 and admission.get('unit') == 'scheduler-whole-main'
                 and admission.get('capture_operation_id') == CAPTURE_ID
                 and capture.get('tree_sha256') == current,
                 'ADMIN_FRESH_ROLLBACK_UNKNOWN')
        old = {name: _read_owned(path) for name, path in OLD_PATHS.items()}
        _require(_sha(old['deployment_system.py']) == REVIEWED_DS_SHA256,
                 'ADMIN_FRESH_DS_CHANGED')
        new = {name: _read_owned(NEW_PATHS[name]) for name in NEW_NAMES}
        _require(all(_sha(raw) == REVIEWED_NEW_SHA256[name]
                     for name, raw in new.items()), 'ADMIN_FRESH_NEW_CHANGED')
        _, rechecked, _ = ds.dir_tree_state(str(APP), str(APP), ['node_modules'])
        _require(rechecked == current, 'ADMIN_FRESH_APP_CHANGED')
        value = {'version': 1,
                 'qualificationOperationId': QUALIFICATION_ID,
                 'cutOperationId': CUT_OPERATION_ID,
                 'installOperationId': INSTALL_OPERATION_ID,
                 'hostId': HOST_ID, 'finalTreeSha256': FINAL_TREE_SHA,
                 'currentAppTreeSha256': current,
                 'preimageTreeSha256': current,
                 'rollbackOperationId': ADMISSION_ID,
                 'oldDsArtifacts': {k: _artifact(v) for k, v in old.items()},
                 'newDsArtifacts': {k: _artifact(new[k]) for k in OLD_PATHS},
                 'reviewedShim': {'deploy_shim.py': _artifact(new['deploy_shim.py'])},
                 'newRuntime': {k: _artifact(new[k]) for k in
                                ('deployment_system.py', 'node-runtime', 'python-runtime')}}
        # Directory creation is the one-use durable intent. Any later error is
        # UNKNOWN; retain the directory and reject every retry.
        os.mkdir(FRESH_DIRECTORY, 0o700)
        parent = os.open(FRESH_DIRECTORY.parent,
                         os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
        directory = os.open(FRESH_DIRECTORY,
                            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            _require(os.fstat(directory).st_uid == ROOT_UID,
                     'ADMIN_FRESH_CUSTODY')
            for name, raw in sorted(new.items()):
                _write_exact(directory, name, raw)
            _write_exact(directory, 'FRESH.json', _canonical(value))
            os.fsync(directory)
        finally:
            os.close(directory)
        return value
    finally:
        os.close(lock)


if __name__ == '__main__':
    produce()
