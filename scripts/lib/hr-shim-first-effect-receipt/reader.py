"""Fixed, read-only root receipt projection for one consumed shim operation.

This source is inserted into a hash-pinned offline DS candidate. The request
contains no selector; the root path, peer and record schema are constants.
"""
import hashlib as _hr_hashlib
import json as _hr_json
import os as _hr_os
import stat as _hr_stat


HR_READBACK_ACTIVE = False  # The unbound candidate is inert.
_HR_PARTS = ('private', 'var', 'db', 'agent-deploy-bootstrap')
_HR_DIRECTORY = 'hr-shim-shim-hr-admin-fresh-20260928-v1'
_HR_OPERATION = 'shim-hr-admin-fresh-20260928-v1'
_HR_HOST = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
_HR_OLD = '5661fbd0c7fde5139b10cb1adf9546a1ce507e413d89177b821ddd683146d7f8'
_HR_NEW = '53b149bf6e4ca9b99d1946955af4093547ed3a41b6d8d8f5afb8fd4a640b5f80'
_HR_METADATA = {'uid': 0, 'gid': 0, 'mode': 365, 'flags': 0,
                'acl': 'absent', 'xattrs': []}
_HR_INTENT_KEYS = frozenset(('operationId', 'state', 'hostId', 'oldSha256',
                             'newSha256', 'oldMetadata', 'oldDsPid'))
_HR_COMMIT_KEYS = _HR_INTENT_KEYS | {'oldPid', 'newPid', 'lockNames'}
_HR_FILES = frozenset(('intent.json', 'committed.json',
                       'rollback.py', 'candidate.py'))
_HR_FLAGS = _hr_os.O_RDONLY | _hr_os.O_NOFOLLOW | _hr_os.O_CLOEXEC


def _hr_result(status='UNKNOWN', digest=None, ok=True):
    return {'ok': ok, 'status': status, 'recordSha256': digest}


def _hr_identity(meta):
    return (meta.st_dev, meta.st_ino, meta.st_mode, meta.st_uid, meta.st_gid,
            meta.st_nlink, meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)


def _hr_valid_dir(meta, uid, exact_mode=None):
    mode = _hr_stat.S_IMODE(meta.st_mode)
    return (_hr_stat.S_ISDIR(meta.st_mode) and meta.st_uid == uid
            and not mode & 0o022
            and (exact_mode is None or mode == exact_mode))


def _hr_open_dir(parent, name, uid, exact_mode=None):
    before_parent = _hr_os.fstat(parent)
    if not _hr_valid_dir(before_parent, uid):
        raise ValueError('directory custody')
    fd = _hr_os.open(name, _HR_FLAGS | _hr_os.O_DIRECTORY, dir_fd=parent)
    try:
        held = _hr_os.fstat(fd)
        named = _hr_os.stat(name, dir_fd=parent, follow_symlinks=False)
        if (not _hr_valid_dir(held, uid, exact_mode)
                or _hr_identity(held) != _hr_identity(named)
                or _hr_identity(before_parent) != _hr_identity(_hr_os.fstat(parent))):
            raise ValueError('directory changed')
        return fd, _hr_identity(held), _hr_identity(before_parent)
    except Exception:
        _hr_os.close(fd)
        raise


def _hr_check_dir(parent, name, fd, held_identity, parent_identity):
    named = _hr_os.stat(name, dir_fd=parent, follow_symlinks=False)
    return (_hr_identity(_hr_os.fstat(fd)) == held_identity
            == _hr_identity(named)
            and _hr_identity(_hr_os.fstat(parent)) == parent_identity)


def _hr_read_record(operation_fd, name, uid):
    try:
        fd = _hr_os.open(name, _HR_FLAGS, dir_fd=operation_fd)
    except FileNotFoundError:
        return None
    try:
        before = _hr_os.fstat(fd)
        if (not _hr_stat.S_ISREG(before.st_mode) or before.st_uid != uid
                or before.st_nlink != 1
                or _hr_stat.S_IMODE(before.st_mode) != 0o600
                or not 0 < before.st_size <= 4096):
            raise ValueError('record custody')
        raw = _hr_os.read(fd, before.st_size + 1)
        named = _hr_os.stat(name, dir_fd=operation_fd,
                            follow_symlinks=False)
        if (len(raw) != before.st_size
                or _hr_identity(before) != _hr_identity(_hr_os.fstat(fd))
                or _hr_identity(before) != _hr_identity(named)):
            raise ValueError('record changed')
        return raw
    finally:
        _hr_os.close(fd)


def _hr_entries(operation_fd, uid):
    """Inspect at most the launched writer's four names, without file reads."""
    observed = {}
    with _hr_os.scandir(operation_fd) as names:
        for entry in names:
            name = entry.name
            if name not in _HR_FILES or name in observed or len(observed) == 4:
                return None
            meta = _hr_os.stat(name, dir_fd=operation_fd,
                               follow_symlinks=False)
            mode = _hr_stat.S_IMODE(meta.st_mode)
            if not _hr_stat.S_ISREG(meta.st_mode) or meta.st_uid != uid:
                return None
            if name in ('intent.json', 'committed.json'):
                valid = (mode == 0o600 and meta.st_nlink == 1
                         and 0 < meta.st_size <= 4096)
            elif name == 'candidate.py':
                valid = (mode == 0o400 and meta.st_nlink == 1
                         and 0 < meta.st_size <= (16 << 20))
            else:  # rollback.py is the launched hard link to the old 0555 shim.
                valid = (mode == 0o555 and meta.st_nlink in (1, 2)
                         and 0 < meta.st_size <= (16 << 20))
            if not valid:
                return None
            observed[name] = _hr_identity(meta)
    return observed


def _hr_unique_pairs(pairs):
    row = {}
    for key, value in pairs:
        if key in row:
            raise ValueError('duplicate field')
        row[key] = value
    return row


def _hr_parse(raw):
    return _hr_json.loads(raw.decode('utf-8'), object_pairs_hook=_hr_unique_pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(
                              ValueError('non-json constant')))


def _hr_valid_base(row, keys, state):
    if type(row) is not dict or set(row) != keys:
        return False
    if (row['operationId'] != _HR_OPERATION or row['state'] != state
            or row['hostId'] != _HR_HOST or row['oldSha256'] != _HR_OLD
            or row['newSha256'] != _HR_NEW
            or type(row['oldDsPid']) is not int or row['oldDsPid'] <= 0):
        return False
    meta = row['oldMetadata']
    if type(meta) is not dict or set(meta) != set(_HR_METADATA):
        return False
    if any(type(meta[key]) is not int for key in ('uid', 'gid', 'mode', 'flags')):
        return False
    return (type(meta['acl']) is str and type(meta['xattrs']) is list
            and meta == _HR_METADATA)


def _hr_valid_commit(row, intent):
    if not _hr_valid_base(row, _HR_COMMIT_KEYS, 'COMMITTED'):
        return False
    if (any(row[key] != intent[key] for key in _HR_INTENT_KEYS
            if key != 'state')
            or type(row['oldPid']) is not int or row['oldPid'] != 41153
            or type(row['newPid']) is not int or row['newPid'] <= 0
            or row['newPid'] == row['oldPid']):
        return False
    names = row['lockNames']
    return (type(names) is dict and set(names) == {'ds', 'shim'}
            and all(type(value) is list and len(value) == 2
                    and all(type(item) is int and item > 0 for item in value)
                    for value in names.values()))


def _hr_status_from_parent(parent_fd, root_uid):
    """Private disposable-fixture seam; production passes only the fixed parent."""
    try:
        parent_before = _hr_os.fstat(parent_fd)
        if not _hr_valid_dir(parent_before, root_uid, 0o700):
            return _hr_result()
        try:
            operation_fd, operation_identity, parent_identity = _hr_open_dir(
                parent_fd, _HR_DIRECTORY, root_uid, 0o700)
        except FileNotFoundError:
            if _hr_identity(parent_before) != _hr_identity(_hr_os.fstat(parent_fd)):
                return _hr_result()
            return _hr_result('NO_DURABLE_INTENT_OBSERVED')
        try:
            entries = _hr_entries(operation_fd, root_uid)
            if entries is None:
                return _hr_result()
            intent_raw = _hr_read_record(operation_fd, 'intent.json', root_uid)
            if intent_raw is None:
                return _hr_result()
            intent = _hr_parse(intent_raw)
            if not _hr_valid_base(intent, _HR_INTENT_KEYS, 'UNKNOWN'):
                return _hr_result()
            commit_raw = _hr_read_record(operation_fd, 'committed.json', root_uid)
            if commit_raw is None:
                status = 'INTENT_PRESENT_UNKNOWN'
                selected = intent_raw
            else:
                if not _hr_valid_commit(_hr_parse(commit_raw), intent):
                    return _hr_result()
                status = 'COMMITTED_RECEIPT_PRESENT'
                selected = commit_raw
            if not _hr_check_dir(parent_fd, _HR_DIRECTORY, operation_fd,
                                 operation_identity, parent_identity):
                return _hr_result()
            if any(_hr_identity(_hr_os.stat(name, dir_fd=operation_fd,
                                           follow_symlinks=False)) != identity
                   for name, identity in entries.items()):
                return _hr_result()
            return _hr_result(status, _hr_hashlib.sha256(selected).hexdigest())
        finally:
            _hr_os.close(operation_fd)
    except Exception:
        return _hr_result()


def _hr_read_status():
    if _hr_os.geteuid() != 0 or _hr_os.getuid() != 0:
        return _hr_result()
    fds = []
    links = []
    try:
        root = _hr_os.open('/', _HR_FLAGS | _hr_os.O_DIRECTORY)
        fds.append(root)
        if not _hr_valid_dir(_hr_os.fstat(root), 0):
            return _hr_result()
        parent = root
        for index, name in enumerate(_HR_PARTS):
            fd, held, prior = _hr_open_dir(
                parent, name, 0, 0o700 if index == len(_HR_PARTS) - 1 else None)
            links.append((parent, name, fd, held, prior))
            fds.append(fd)
            parent = fd
        result = _hr_status_from_parent(parent, 0)
        if not all(_hr_check_dir(*entry) for entry in links):
            return _hr_result()
        return result
    except Exception:
        return _hr_result()
    finally:
        for fd in reversed(fds):
            _hr_os.close(fd)


def hr_first_effect_request(peer):
    """The DS handler passes its kernel getpeereid result, never request data."""
    if (not HR_READBACK_ACTIVE or type(peer) is not int
            or peer != 502 or peer != AUTHORIZED_OWNER_UID):
        return _hr_result(ok=False)
    try:
        return _hr_read_status()
    except Exception:
        return _hr_result()
