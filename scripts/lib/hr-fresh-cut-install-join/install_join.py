"""Source inserted into the pinned shim, limited to four existing DS targets.

The current operation is an update of an already installed DS. A first bootstrap
has more state than these four files and must not be called a four-file rollback.
"""

_DS_SCRIPT_LIMIT = 128 * 1024 * 1024
_DS_INSTALL_ORDER = ('deployment-registry.json', 'deployment_system.py',
                     'ds_client.py', 'plist')
_DS_MODES = {'deployment_system.py': 0o555, 'ds_client.py': 0o555,
             'deployment-registry.json': 0o600, 'plist': 0o644}
_DS_PRIVATE_ROOT = (os.path.join(os.path.dirname(STATE_ROOT),
                                 'fixed-ds-install-records') if TEST_MODE else
                    '/private/var/db/agent-deploy-shim-fixed-ds-install')


def _ds_record_dir(name, create=False):
    """Keep new proof and rollback records outside the admin-writable inbox."""
    require(name in ('intents', 'terminals', 'rollback'),
            'DS_RECORD_DIR_UNKNOWN')
    parent = os.path.dirname(_DS_PRIVATE_ROOT)
    parent_meta = os.stat(parent, follow_symlinks=False)
    require(stat.S_ISDIR(parent_meta.st_mode) and
            (TEST_MODE or (parent_meta.st_uid == 0 and
             stat.S_IMODE(parent_meta.st_mode) & 0o022 == 0)),
            'DS_RECORD_PARENT_CUSTODY')
    if create:
        try:
            os.mkdir(_DS_PRIVATE_ROOT, 0o700)
        except FileExistsError:
            pass
    root_meta = os.stat(_DS_PRIVATE_ROOT, follow_symlinks=False)
    require(stat.S_ISDIR(root_meta.st_mode) and
            stat.S_IMODE(root_meta.st_mode) == 0o700 and
            (TEST_MODE or root_meta.st_uid == 0), 'DS_RECORD_ROOT_CUSTODY')
    if create:
        # A prior interrupted attempt may have created this directory without
        # proving its name durable. Reconfirm the parent on every effect path.
        _ds_fsync_dir(parent)
    target = os.path.join(_DS_PRIVATE_ROOT, name)
    if create:
        try:
            os.mkdir(target, 0o700)
        except FileExistsError:
            pass
    meta = os.stat(target, follow_symlinks=False)
    require(stat.S_ISDIR(meta.st_mode) and
            stat.S_IMODE(meta.st_mode) == 0o700 and
            (TEST_MODE or meta.st_uid == 0), 'DS_RECORD_DIR_CUSTODY')
    if create:
        _ds_fsync_dir(_DS_PRIVATE_ROOT)
    return target


def _ds_target(name):
    require(name in DS_ARTIFACTS, 'DS_ARTIFACT_UNKNOWN')
    if name == 'plist':
        return DS_PLIST_PATH
    if name == 'deployment-registry.json':
        return os.path.join(DS_CONFIG_DIR, name)
    return os.path.join(DS_INSTALL_DIR, name)


def _ds_limit(name):
    return _DS_SCRIPT_LIMIT if name == 'deployment_system.py' else ARTIFACT_MAX


def _ds_identity(meta):
    return (meta.st_dev, meta.st_ino, meta.st_mode, meta.st_uid, meta.st_gid,
            meta.st_nlink, meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)


def _ds_stream(source, digest, limit, exact_size=None, sink=None):
    """Hash bounded bytes from one no-follow inode, optionally copying them."""
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1,
                'DS_FILE_CUSTODY')
        require(0 < before.st_size <= limit, 'ARTIFACT_TOO_LARGE')
        if exact_size is not None:
            require(before.st_size == exact_size, 'DS_SCRIPT_SIZE_MISMATCH')
        h = hashlib.sha256()
        size = 0
        while True:
            block = os.read(fd, 65536)
            if not block:
                break
            size += len(block)
            require(size <= limit, 'ARTIFACT_TOO_LARGE')
            h.update(block)
            if sink is not None:
                view = memoryview(block)
                while view:
                    written = os.write(sink, view)
                    require(written > 0, 'DS_COPY_SHORT_WRITE')
                    view = view[written:]
        after = os.fstat(fd)
        current = os.stat(source, follow_symlinks=False)
        require(size == before.st_size and _ds_identity(before) ==
                _ds_identity(after) == _ds_identity(current), 'DS_FILE_CHANGED')
        require(h.hexdigest() == digest, 'DS_PREIMAGE_OR_CANDIDATE_HASH_MISMATCH')
        return before
    finally:
        os.close(fd)


def _ds_fsync_dir(directory):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _ds_install_file(source, target, digest, limit, exact_size, mode, uid, gid):
    """Stream to an exclusive temp, pin source again, atomically swap/read back."""
    directory = os.path.dirname(target)
    temp = os.path.join(directory, '.ds-install-%d-%d.tmp' % (os.getpid(),
                                                               time.time_ns()))
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW |
                 os.O_CLOEXEC, mode)
    replaced = False
    try:
        _ds_stream(source, digest, limit, exact_size, fd)
        os.fchmod(fd, mode)
        if not TEST_MODE:
            os.fchown(fd, uid, gid)
        os.fsync(fd)
        os.close(fd)
        fd = None
        os.replace(temp, target)
        replaced = True
        _ds_fsync_dir(directory)
        _ds_stream(target, digest, limit, exact_size)
    finally:
        if fd is not None:
            os.close(fd)
        if not replaced:
            try:
                os.unlink(temp)
            except FileNotFoundError:
                pass


def _ds_intent_path(operation_id):
    return os.path.join(_DS_PRIVATE_ROOT, 'intents', operation_id + '.json')


def _ds_terminal_path(operation_id):
    return os.path.join(_DS_PRIVATE_ROOT, 'terminals', operation_id + '.json')


def _ds_existing_mutation_lock():
    """Join the installed DS writer lock without creating a second lock inode."""
    directory = os.open(DS_STATE_DIR, os.O_RDONLY | os.O_DIRECTORY |
                        os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        parent = os.fstat(directory)
        require(TEST_MODE or (parent.st_uid == 0 and
                stat.S_ISDIR(parent.st_mode)), 'DS_LOCK_DIR_CUSTODY')
        fd = os.open('mutation.lock', os.O_RDWR | os.O_NOFOLLOW |
                     os.O_CLOEXEC, dir_fd=directory)
        try:
            before = os.fstat(fd)
            current = os.stat('mutation.lock', dir_fd=directory,
                              follow_symlinks=False)
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                    _ds_identity(before) == _ds_identity(current) and
                    (TEST_MODE or (before.st_uid == 0 and
                     stat.S_IMODE(before.st_mode) & 0o022 == 0)),
                    'DS_LOCK_CUSTODY')
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Failure('MUTATION_ALREADY_RUNNING')
            current = os.stat('mutation.lock', dir_fd=directory,
                              follow_symlinks=False)
            require(_ds_identity(before) == _ds_identity(current),
                    'DS_LOCK_CHANGED')
            return fd
        except BaseException:
            os.close(fd)
            raise
    finally:
        os.close(directory)


def _ds_write_intent(operation_id, value):
    parent = _ds_record_dir('intents', create=True)
    path = _ds_intent_path(operation_id)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW |
                 os.O_CLOEXEC, 0o600)
    try:
        raw = canonical(value)
        view = memoryview(raw)
        while view:
            count = os.write(fd, view)
            require(count > 0, 'DS_INTENT_SHORT_WRITE')
            view = view[count:]
        os.fsync(fd)
    finally:
        os.close(fd)
    _ds_fsync_dir(parent)


def _ds_terminal(operation_id, value):
    # Unlike legacy write_receipt, terminal replacement never truncates a live
    # receipt in place. An interrupted replace leaves intent and hence UNKNOWN.
    parent = _ds_record_dir('terminals', create=True)
    atomic_write(_ds_terminal_path(operation_id), canonical(value), 0o600)
    _ds_fsync_dir(parent)


def _ds_read_record(path, mode):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    except FileNotFoundError:
        return None
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                stat.S_IMODE(before.st_mode) == mode and
                (TEST_MODE or before.st_uid == 0) and
                0 < before.st_size <= 8192, 'DS_RECEIPT_CUSTODY')
        raw = os.read(fd, 8193)
        after = os.fstat(fd)
        require(len(raw) == before.st_size and _ds_identity(before) ==
                _ds_identity(after), 'DS_RECEIPT_CHANGED')
        value = json.loads(raw)
        require(type(value) is dict, 'DS_RECEIPT_SCHEMA')
        return value, hashlib.sha256(raw).hexdigest()
    finally:
        os.close(fd)


def install_deployment_system_status(request):
    operation_id = request.get('operation_id')
    require(type(operation_id) is str and OP_ID.fullmatch(operation_id),
            'BAD_OPERATION_ID')
    try:
        _ds_record_dir('intents')
        terminal = _ds_read_record(_ds_terminal_path(operation_id), 0o600)
        intent = _ds_read_record(_ds_intent_path(operation_id), 0o600)
        if intent is None or intent[0].get('action') != 'INSTALL_DEPLOYMENT_SYSTEM' \
                or intent[0].get('operation_id') != operation_id:
            return {'ok': True, 'operation_id': operation_id, 'state': 'UNKNOWN',
                    'reason': 'INTENT_ABSENT_OR_INVALID', 'replayAllowed': False}
        if terminal is None or terminal[0].get('action') != 'INSTALL_DEPLOYMENT_SYSTEM' \
                or terminal[0].get('operation_id') != operation_id:
            return {'ok': True, 'operation_id': operation_id, 'state': 'UNKNOWN',
                    'reason': 'NO_VALID_TERMINAL', 'replayAllowed': False}
        record, receipt_sha = terminal
        state = record.get('state')
        require(state in ('COMMITTED', 'FAILED', 'UNKNOWN'), 'DS_RECEIPT_STATE')
        require(type(record.get('artifacts')) is dict and
                record['artifacts'] == intent[0].get('artifacts') and
                type(record.get('expected_preimage_sha256')) is dict and
                record['expected_preimage_sha256'] ==
                intent[0].get('expected_preimage_sha256'),
                'DS_RECEIPT_INTENT_MISMATCH')
        require(record.get('rollback') in ('NOT_NEEDED', 'RESTORED', 'UNKNOWN',
                                           'NOT_ATTEMPTED'),
                'DS_RECEIPT_ROLLBACK')
        if state == 'COMMITTED':
            require(record.get('rollback') == 'NOT_NEEDED' and
                    type(record.get('ds_status_pid')) is int and
                    record['ds_status_pid'] > 0, 'DS_RECEIPT_COMMIT_SCHEMA')
        return {'ok': True, 'operation_id': operation_id, 'state': state,
                'receipt_sha256': receipt_sha, 'rollback': record.get('rollback'),
                'ds_status_pid': record.get('ds_status_pid'),
                'error': record.get('error'),
                'artifacts': record.get('artifacts'),
                'expected_preimage_sha256': record.get('expected_preimage_sha256'),
                'replayAllowed': False}
    except Exception:
        return {'ok': True, 'operation_id': operation_id, 'state': 'UNKNOWN',
                'reason': 'RECEIPT_READBACK_UNKNOWN', 'replayAllowed': False}


def _ds_start_and_status():
    if TEST_MODE:
        return {'ok': True, 'pid': 1, 'units': []}
    boot = subprocess.run(['/bin/launchctl', 'kickstart', '-k',
                           'system/' + DS_LABEL], capture_output=True, text=True)
    require(boot.returncode == 0, 'DS_RESTART_FAILED')
    return _ds_wait_socket_and_status()


def install_deployment_system(request):
    """CAS update, owned rollback, exact-op readback; first bootstrap excluded."""
    operation_id = request.get('operation_id')
    artifacts = request.get('artifacts')
    expected = request.get('expected_preimage_sha256')
    old_size = request.get('ds_script_preimage_size')
    new_size = request.get('ds_script_candidate_size')
    require(type(operation_id) is str and OP_ID.fullmatch(operation_id),
            'BAD_OPERATION_ID')
    require(type(artifacts) is dict and set(artifacts) == set(DS_ARTIFACTS)
            and type(expected) is dict and set(expected) == set(DS_ARTIFACTS),
            'DS_ARTIFACT_SET_INVALID')
    for digest in list(artifacts.values()) + list(expected.values()):
        require(type(digest) is str and re.fullmatch('[a-f0-9]{64}', digest),
                'DS_HASH_INVALID')
    require(type(old_size) is int and 0 < old_size <= _DS_SCRIPT_LIMIT and
            type(new_size) is int and 0 < new_size <= _DS_SCRIPT_LIMIT,
            'DS_SCRIPT_SIZE_INVALID')
    lock_fd = os.open(os.path.join(STATE_ROOT, 'mutation.lock'),
                      os.O_RDWR | os.O_CREAT | os.O_CLOEXEC, 0o644)
    ds_lock_fd = None
    intent_written = False
    effect_started = False
    commit_terminal_started = False
    backup = None
    started = time.time()
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        ds_lock_fd = _ds_existing_mutation_lock()
        require(not os.path.lexists(_ds_intent_path(operation_id)) and
                not os.path.lexists(_ds_terminal_path(operation_id)) and
                not os.path.lexists(receipt_path(operation_id)),
                'OPERATION_ALREADY_CONSUMED')
        _ds_write_intent(operation_id, {
            'action': 'INSTALL_DEPLOYMENT_SYSTEM', 'operation_id': operation_id,
            'state': 'RUNNING', 'artifacts': artifacts,
            'expected_preimage_sha256': expected, 'started': started})
        intent_written = True
        try:
            # Check every staged and live inode before any swap. The copy path
            # verifies each source again, so a post-check change cannot install.
            live_meta = {}
            for name in DS_ARTIFACTS:
                limit = _ds_limit(name)
                size = new_size if name == 'deployment_system.py' else None
                _ds_stream(os.path.join(STATE_ROOT, 'inbox', operation_id, name),
                           artifacts[name], limit, size)
                size = old_size if name == 'deployment_system.py' else None
                live_meta[name] = _ds_stream(_ds_target(name), expected[name],
                                             limit, size)
                require(TEST_MODE or live_meta[name].st_uid == 0,
                        'DS_PREIMAGE_OWNER')
                require(stat.S_IMODE(live_meta[name].st_mode) == _DS_MODES[name],
                        'DS_PREIMAGE_MODE')
            plist_raw, plist_sha = read_verified(os.path.join(
                STATE_ROOT, 'inbox', operation_id, 'plist'))
            require(plist_sha == artifacts['plist'], 'DS_PLIST_HASH_CHANGED')
            plist_text = plist_raw.decode('utf-8')
            require(DS_LABEL in plist_text and
                    os.path.join(DS_INSTALL_DIR, 'deployment_system.py') in plist_text,
                    'DS_PLIST_CONTENT_INVALID')
            rollback_parent = _ds_record_dir('rollback', create=True)
            backup = os.path.join(rollback_parent, 'ds-' + operation_id)
            os.mkdir(backup, 0o700)
            for name in DS_ARTIFACTS:
                size = old_size if name == 'deployment_system.py' else None
                _ds_install_file(_ds_target(name), os.path.join(backup, name),
                                 expected[name], _ds_limit(name), size,
                                 0o600, 0, 0)
            _ds_fsync_dir(backup)
            _ds_fsync_dir(rollback_parent)
            # Recheck the live CAS after backup, under the same shim lock.
            for name in DS_ARTIFACTS:
                size = old_size if name == 'deployment_system.py' else None
                _ds_stream(_ds_target(name), expected[name], _ds_limit(name), size)
            for name in _DS_INSTALL_ORDER:
                size = new_size if name == 'deployment_system.py' else None
                effect_started = True
                _ds_install_file(os.path.join(STATE_ROOT, 'inbox', operation_id, name),
                                 _ds_target(name), artifacts[name], _ds_limit(name),
                                 size, _DS_MODES[name], live_meta[name].st_uid,
                                 live_meta[name].st_gid)
            status = _ds_start_and_status()
            require(status.get('ok') is True, 'DS_STATUS_UNAVAILABLE')
            for name in DS_ARTIFACTS:
                size = new_size if name == 'deployment_system.py' else None
                _ds_stream(_ds_target(name), artifacts[name], _ds_limit(name), size)
            record = {'action': 'INSTALL_DEPLOYMENT_SYSTEM',
                      'operation_id': operation_id, 'state': 'COMMITTED',
                      'artifacts': artifacts, 'expected_preimage_sha256': expected,
                      'ds_status_pid': status.get('pid'), 'rollback': 'NOT_NEEDED',
                      'started': started, 'version': VERSION}
            commit_terminal_started = True
            _ds_terminal(operation_id, record)
            return {'ok': True, 'operation_id': operation_id,
                    'state': 'COMMITTED', 'rollback': 'NOT_NEEDED'}
        except Exception as exc:
            if commit_terminal_started:
                # atomic_write can fail after replacing a COMMITTED receipt.
                # Rolling back here could leave that receipt claiming the new
                # bytes while the old service is live. Reconcile by exact ID.
                return {'ok': False, 'operation_id': operation_id,
                        'state': 'UNKNOWN', 'rollback': 'NOT_ATTEMPTED',
                        'error': 'COMMIT_RECEIPT_AMBIGUOUS',
                        'replayAllowed': False}
            rollback = 'NOT_NEEDED'
            if effect_started:
                try:
                    require(backup is not None, 'DS_BACKUP_ABSENT')
                    for name in reversed(_DS_INSTALL_ORDER):
                        size = old_size if name == 'deployment_system.py' else None
                        _ds_install_file(os.path.join(backup, name),
                                         _ds_target(name), expected[name],
                                         _ds_limit(name), size,
                                         stat.S_IMODE(live_meta[name].st_mode),
                                         live_meta[name].st_uid,
                                         live_meta[name].st_gid)
                    restored = _ds_start_and_status()
                    require(restored.get('ok') is True, 'DS_ROLLBACK_STATUS_UNKNOWN')
                    for name in DS_ARTIFACTS:
                        size = old_size if name == 'deployment_system.py' else None
                        _ds_stream(_ds_target(name), expected[name],
                                   _ds_limit(name), size)
                    rollback = 'RESTORED'
                except Exception:
                    rollback = 'UNKNOWN'
            state = 'FAILED' if rollback != 'UNKNOWN' else 'UNKNOWN'
            error = str(exc) if isinstance(exc, Failure) else type(exc).__name__
            record = {'action': 'INSTALL_DEPLOYMENT_SYSTEM',
                      'operation_id': operation_id, 'state': state,
                      'artifacts': artifacts, 'expected_preimage_sha256': expected,
                      'rollback': rollback, 'error': error,
                      'started': started, 'version': VERSION}
            _ds_terminal(operation_id, record)
            return {'ok': False, 'operation_id': operation_id, 'state': state,
                    'rollback': rollback, 'error': error}
    except Exception as exc:
        error = str(exc) if isinstance(exc, Failure) else type(exc).__name__
        # The intent inode can exist even when its final fsync raised. Never
        # describe that ambiguous one-use operation as safely rejected.
        consumed = intent_written or os.path.lexists(_ds_intent_path(operation_id))
        return {'ok': False, 'operation_id': operation_id,
                'state': 'UNKNOWN' if consumed else 'REJECTED',
                'error': error, 'replayAllowed': False}
    finally:
        if ds_lock_fd is not None:
            try:
                fcntl.flock(ds_lock_fd, fcntl.LOCK_UN)
            finally:
                os.close(ds_lock_fd)
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
        finally:
            os.close(lock_fd)
