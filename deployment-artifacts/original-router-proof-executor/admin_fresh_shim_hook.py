"""Internal, one-use FRESH hook after the fixed shim self-update restart.

There is no request action for this hook. All selectors remain compiled and
inactive by default; the original root producer obtains the DS canonical lock
itself after this hook's durable UNKNOWN intent.
"""
import fcntl
import hashlib
import json
import os
import re
import stat


ADMIN_FRESH_HOOK_ACTIVE = False
ADMIN_FRESH_ROOT_UID = 0
ADMIN_FRESH_SELF_UPDATE_ID = None
ADMIN_FRESH_CAPTURE_ID = None
ADMIN_FRESH_ADMISSION_ID = None
ADMIN_FRESH_OLD_DS_SHA256 = None
ADMIN_FRESH_OLD_SHA256 = None
ADMIN_FRESH_NEW_SHA256 = None  # Six non-self artifacts; current shim comes from receipt.
ADMIN_FRESH_STAGED_SIZE = None
ADMIN_FRESH_OWNER_UID = None
ADMIN_FRESH_OPERATION_ID = 'hr-admin-fresh-prep-20260928-v1'
ADMIN_FRESH_MARKER_DIRECTORY = '/private/var/db/agent-core-admin-fresh-marker-s256'
ADMIN_FRESH_FACTORY = None  # Embedded reviewed producer factory only.
ADMIN_FRESH_BINDER = None  # Private same-process inert package binder only.


def _admin_fresh_root_read(path, limit=65536):
    """Read a fixed root file with stable descriptor and named identity."""
    parent = os.open(os.path.dirname(path),
                     os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        directory = os.fstat(parent)
        require(stat.S_ISDIR(directory.st_mode)
                and directory.st_uid == ADMIN_FRESH_ROOT_UID
                and not stat.S_IMODE(directory.st_mode) & 0o022,
                'ADMIN_FRESH_HOOK_RECEIPT_CUSTODY')
        name = os.path.basename(path)
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode)
                    and before.st_uid == ADMIN_FRESH_ROOT_UID
                    and before.st_nlink == 1
                    and not stat.S_IMODE(before.st_mode) & 0o022
                    and 0 < before.st_size <= limit,
                    'ADMIN_FRESH_HOOK_RECEIPT_CUSTODY')
            identity = lambda st: (st.st_dev, st.st_ino, st.st_mode, st.st_uid,
                                   st.st_gid, st.st_nlink, st.st_size,
                                   st.st_mtime_ns, st.st_ctime_ns)
            raw = os.pread(fd, before.st_size + 1, 0)
            require(len(raw) == before.st_size
                    and identity(os.fstat(fd)) == identity(before)
                    and identity(os.stat(name, dir_fd=parent,
                                         follow_symlinks=False)) == identity(before)
                    and identity(os.fstat(parent)) == identity(directory)
                    and identity(os.stat(os.path.dirname(path),
                                         follow_symlinks=False)) == identity(directory),
                    'ADMIN_FRESH_HOOK_RECEIPT_CHANGED')
            return raw, hashlib.sha256(raw).hexdigest()
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def _admin_fresh_shim_read(path, expected_sha):
    require(type(expected_sha) is str and
            re.fullmatch('[a-f0-9]{64}', expected_sha) is not None,
            'ADMIN_FRESH_HOOK_SHIM_CHANGED')
    raw, digest = _admin_fresh_root_read(path, 8 << 20)
    require(len(raw) > 65536 and digest == expected_sha,
            'ADMIN_FRESH_HOOK_SHIM_CHANGED')
    return raw, digest


def _admin_fresh_marker_directory():
    """Open the one-use marker below a non-Owner-removable root chain."""
    path = ADMIN_FRESH_MARKER_DIRECTORY
    require(type(path) is str and path.startswith('/') and
            not any(part in ('', '.', '..') for part in path.split('/')[1:]),
            'ADMIN_FRESH_HOOK_MARKER_PATH')
    parts = path.split('/')[1:]
    parent = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for index, name in enumerate(parts):
            before = os.fstat(parent)
            require(stat.S_ISDIR(before.st_mode)
                    and before.st_uid in (0, ADMIN_FRESH_ROOT_UID)
                    and not stat.S_IMODE(before.st_mode) & 0o022,
                    'ADMIN_FRESH_HOOK_MARKER_CUSTODY')
            if index == len(parts) - 1:
                try:
                    os.mkdir(name, 0o700, dir_fd=parent)
                    os.fsync(parent)
                except FileExistsError:
                    pass
            child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=parent)
            named = os.stat(name, dir_fd=parent, follow_symlinks=False)
            held = os.fstat(child)
            require((held.st_dev, held.st_ino, held.st_mode, held.st_uid,
                     held.st_gid) ==
                    (named.st_dev, named.st_ino, named.st_mode, named.st_uid,
                     named.st_gid) and stat.S_ISDIR(held.st_mode)
                    and held.st_uid in (0, ADMIN_FRESH_ROOT_UID)
                    and not stat.S_IMODE(held.st_mode) & 0o022
                    and (index != len(parts) - 1 or
                         (held.st_uid == ADMIN_FRESH_ROOT_UID and
                          stat.S_IMODE(held.st_mode) == 0o700))
                    and (os.fstat(parent).st_dev, os.fstat(parent).st_ino,
                         os.fstat(parent).st_mode, os.fstat(parent).st_uid) ==
                        (before.st_dev, before.st_ino, before.st_mode,
                         before.st_uid),
                    'ADMIN_FRESH_HOOK_MARKER_CUSTODY')
            os.close(parent)
            parent = child
        return parent
    except BaseException:
        os.close(parent)
        raise


def _admin_fresh_commit_marker(intent, finished):
    parent = _admin_fresh_marker_directory()
    try:
        name = ADMIN_FRESH_OPERATION_ID + '.json'
        old, _ = _admin_fresh_root_read(
            os.path.join(ADMIN_FRESH_MARKER_DIRECTORY, name))
        require(old == canonical(intent), 'ADMIN_FRESH_HOOK_INTENT_CHANGED')
        pending = ADMIN_FRESH_OPERATION_ID + '.committed'
        fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=parent)
        try:
            raw = canonical(finished)
            require(os.write(fd, raw) == len(raw),
                    'ADMIN_FRESH_HOOK_COMMIT_UNKNOWN')
            os.fsync(fd)
        finally:
            os.close(fd)
        os.rename(pending, name, src_dir_fd=parent, dst_dir_fd=parent)
        os.fsync(parent)
        readback, _ = _admin_fresh_root_read(
            os.path.join(ADMIN_FRESH_MARKER_DIRECTORY, name))
        require(readback == raw, 'ADMIN_FRESH_HOOK_COMMIT_UNKNOWN')
    finally:
        os.close(parent)


def _admin_fresh_service_lock():
    parent = _admin_fresh_marker_directory()
    try:
        fd = os.open('service.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW,
                     0o600, dir_fd=parent)
        try:
            held = os.fstat(fd)
            named = os.stat('service.lock', dir_fd=parent, follow_symlinks=False)
            require(stat.S_ISREG(held.st_mode)
                    and held.st_uid == ADMIN_FRESH_ROOT_UID
                    and stat.S_IMODE(held.st_mode) == 0o600
                    and (held.st_dev, held.st_ino, held.st_mode,
                         held.st_uid, held.st_gid) ==
                        (named.st_dev, named.st_ino, named.st_mode,
                         named.st_uid, named.st_gid),
                    'ADMIN_FRESH_HOOK_LOCK_CUSTODY')
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except BaseException:
            os.close(fd)
            raise
    finally:
        os.close(parent)


def admin_fresh_guarded_service_action(operation, request):
    if not ADMIN_FRESH_HOOK_ACTIVE:
        return operation(request)
    lock = _admin_fresh_service_lock()
    try:
        if request.get('operation_id') == ADMIN_FRESH_SELF_UPDATE_ID:
            parent = _admin_fresh_marker_directory()
            try:
                try:
                    os.stat(ADMIN_FRESH_OPERATION_ID + '.json', dir_fd=parent,
                            follow_symlinks=False)
                except FileNotFoundError:
                    pass
                else:
                    require(False, 'ADMIN_FRESH_HOOK_ALREADY_CONSUMED')
            finally:
                os.close(parent)
        return operation(request)
    finally:
        os.close(lock)


def run_admin_fresh_hook():
    if not ADMIN_FRESH_HOOK_ACTIVE:
        return None
    require(os.geteuid() == ADMIN_FRESH_ROOT_UID and not TEST_MODE,
            'ADMIN_FRESH_HOOK_ROOT_REQUIRED')
    lock = _admin_fresh_service_lock()
    try:
        return _run_admin_fresh_hook_locked()
    finally:
        os.close(lock)


def _run_admin_fresh_hook_locked():
    require(os.geteuid() == ADMIN_FRESH_ROOT_UID and not TEST_MODE,
            'ADMIN_FRESH_HOOK_ROOT_REQUIRED')
    require(type(ADMIN_FRESH_SELF_UPDATE_ID) is str
            and ADMIN_FRESH_SELF_UPDATE_ID == 'shim-hr-admin-fresh-20260928-v1'
            and type(ADMIN_FRESH_CAPTURE_ID) is str
            and type(ADMIN_FRESH_ADMISSION_ID) is str
            and OP_ID.fullmatch(ADMIN_FRESH_CAPTURE_ID) is not None
            and OP_ID.fullmatch(ADMIN_FRESH_ADMISSION_ID) is not None
            and ADMIN_FRESH_CAPTURE_ID != ADMIN_FRESH_ADMISSION_ID
            and type(ADMIN_FRESH_OLD_DS_SHA256) is str
            and re.fullmatch('[a-f0-9]{64}', ADMIN_FRESH_OLD_DS_SHA256) is not None
            and type(ADMIN_FRESH_OLD_SHA256) is dict
            and set(ADMIN_FRESH_OLD_SHA256) ==
                {'deployment_system.py', 'ds_client.py', 'plist',
                 'deployment-registry.json'}
            and all(type(value) is str and re.fullmatch('[a-f0-9]{64}', value)
                    for value in ADMIN_FRESH_OLD_SHA256.values())
            and ADMIN_FRESH_OLD_SHA256['deployment_system.py'] ==
                ADMIN_FRESH_OLD_DS_SHA256
            and type(ADMIN_FRESH_NEW_SHA256) is dict
            and set(ADMIN_FRESH_NEW_SHA256) ==
                {'deployment_system.py', 'ds_client.py', 'plist',
                 'deployment-registry.json', 'node-runtime', 'python-runtime'}
            and all(type(value) is str and re.fullmatch('[a-f0-9]{64}', value)
                    for value in ADMIN_FRESH_NEW_SHA256.values())
            and type(ADMIN_FRESH_STAGED_SIZE) is dict
            and set(ADMIN_FRESH_STAGED_SIZE) ==
                {'deployment_system.py', 'ds_client.py', 'plist',
                 'deployment-registry.json'}
            and all(type(value) is int and 0 < value <= 128 << 20
                    for value in ADMIN_FRESH_STAGED_SIZE.values())
            and type(ADMIN_FRESH_OWNER_UID) is int
            and ADMIN_FRESH_OWNER_UID == AUTHORIZED_OWNER_UID
            and callable(ADMIN_FRESH_FACTORY)
            and callable(ADMIN_FRESH_BINDER),
            'ADMIN_FRESH_HOOK_UNBOUND')
    update_path = receipt_path(ADMIN_FRESH_SELF_UPDATE_ID)
    update_raw, _ = _admin_fresh_root_read(update_path)
    update = json.loads(update_raw)
    installed_path = os.path.join(SERVICE_INSTALL_DIR, 'deploy_shim.py')
    require(type(update) is dict and type(update.get('artifacts')) is dict,
            'ADMIN_FRESH_HOOK_SELF_UPDATE_UNKNOWN')
    installed_raw, installed_sha = _admin_fresh_shim_read(
        installed_path, update['artifacts'].get('deploy_shim.py'))
    require(type(update) is dict
            and update.get('operation_id') == ADMIN_FRESH_SELF_UPDATE_ID
            and update.get('action') == 'SERVICE_UPDATE'
            and update.get('state') == 'COMMITTED'
            and update.get('generation') == ADMIN_FRESH_SELF_UPDATE_ID
            and update.get('restart') == 'self'
            and type(update.get('artifacts')) is dict
            and update['artifacts'].get('deploy_shim.py') == installed_sha
            and service_current().get('generation') == ADMIN_FRESH_SELF_UPDATE_ID,
            'ADMIN_FRESH_HOOK_SELF_UPDATE_UNKNOWN')
    # This one-use marker cannot be displaced with STATE_ROOT/receipts.
    parent = _admin_fresh_marker_directory()
    try:
        meta = os.fstat(parent)
        require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == ADMIN_FRESH_ROOT_UID
                and stat.S_IMODE(meta.st_mode) == 0o700,
                'ADMIN_FRESH_HOOK_RECEIPT_CUSTODY')
        name = ADMIN_FRESH_OPERATION_ID + '.json'
        intent = {'operation_id': ADMIN_FRESH_OPERATION_ID,
                  'action': 'INTERNAL_ADMIN_FRESH', 'state': 'UNKNOWN',
                  'selfUpdateOperationId': ADMIN_FRESH_SELF_UPDATE_ID,
                  'shimSha256': installed_sha, 'replayAllowed': False}
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=parent)
        try:
            raw = canonical(intent)
            require(os.write(fd, raw) == len(raw),
                    'ADMIN_FRESH_HOOK_INTENT_UNKNOWN')
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(parent)
    finally:
        os.close(parent)
    binding = {'captureId': ADMIN_FRESH_CAPTURE_ID,
               'admissionId': ADMIN_FRESH_ADMISSION_ID,
               'reviewedDsSha256': ADMIN_FRESH_OLD_DS_SHA256,
               'reviewedOldSha256': dict(ADMIN_FRESH_OLD_SHA256),
               'reviewedNewSha256': dict(ADMIN_FRESH_NEW_SHA256,
                                        **{'deploy_shim.py': installed_sha}),
               'reviewedStagedSize': ADMIN_FRESH_STAGED_SIZE,
               'shimInboxOwnerUid': ADMIN_FRESH_OWNER_UID}
    owner = ADMIN_FRESH_FACTORY(binding)
    result = owner.produce()  # Acquires the DS canonical flock; never under shim lock.
    def finish(fresh_sha):
        finished = dict(intent, state='COMMITTED', freshSha256=fresh_sha)
        _admin_fresh_commit_marker(intent, finished)
        return finished
    return ADMIN_FRESH_BINDER(result, owner, finish)
