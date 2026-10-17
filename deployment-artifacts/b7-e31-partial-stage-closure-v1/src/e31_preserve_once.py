#!/usr/bin/env python3
"""One fixed e31 preservation under the original mutation lease.

The completed historical terminal and exact history remain authoritative when
a successor uses the original path. A new rename additionally requires the
complete original fresh scene. No receipt, lock, journal or old-tree byte is
written. macOS no-replacement rename is mandatory; other platforms refuse.
"""
import ctypes
import errno
import fcntl
import hashlib
import json
import os
import stat
import subprocess
import sys
import types
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v50_e31_closure_source as closure

CLIENT = '/usr/local/libexec/agent-deploy-system/ds_client.py'
OP = closure.E31['operation_id']
STATE_ROOT = '/private/var/db/agent-deploy-system'
MUTATION_LOCK = STATE_ROOT + '/mutation.lock'
NATIVE_TRANSACTION = '/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json'
NATIVE_HOLDER = '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock'
_ROOT = '/'
_ROOT_UID = 0
_LOCK_GID = 80


def fail(reason):
    raise SystemExit('REFUSED: ' + reason)


def need(value, reason):
    if not value:
        fail(reason)


def status():
    # Preserve the original registered-peer UID502 bridge and paired protocol.
    out = subprocess.run(['/usr/bin/python3', CLIENT, 'b7-status-r3', OP],
        capture_output=True, timeout=120, user=502, group=20, extra_groups=[],
        env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'})
    need(out.returncode == 0, 'DS_STATUS_FAILED')
    payload = strict_json(out.stdout)
    need(type(payload) is dict and payload.get('schema') == 'ds-b7-execution-v2' and payload.get('ok') is True and payload.get('action') == 'DS_B7_EXECUTION_STATUS_V2' and payload.get('operation_id') == OP and payload.get('effect') == 'READ_ONLY' and payload.get('replay_allowed') is False and payload.get('current_runtime_verified') is False, 'DS_STATUS_NOT_OK')
    return payload['data']


def identity(meta):
    return (meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid, meta.st_mode)


def file_pin(meta):
    return identity(meta) + (meta.st_nlink, meta.st_size,
                            meta.st_mtime_ns, meta.st_ctime_ns)


class ProtectedPath:
    """Original protected dirfd discipline: nofollow every pinned ancestor.

    Directory identity/custody is retained across the helper's own same-parent
    rename; file reads separately pin size/times/link count and reread the leaf.
    """
    def __init__(self, path, obj=None, owners=None):
        self.path = path
        self.opened = []
        self.trace = []

    def directory(self, meta, path):
        need(stat.S_ISDIR(meta.st_mode) and meta.st_uid == _ROOT_UID,
             'ANCESTOR_CUSTODY')
        if path == STATE_ROOT:
            need(meta.st_gid == _LOCK_GID and stat.S_IMODE(meta.st_mode) == 0o770,
                 'STATE_ROOT_CUSTODY')
        else:
            need(not meta.st_mode & 0o022, 'ANCESTOR_WRITABLE')

    def __enter__(self):
        try:
            need(type(self.path) is str and os.path.isabs(self.path) and
                 os.path.normpath(self.path) == self.path and
                 os.path.commonpath((_ROOT, self.path)) == _ROOT, 'PROTECTED_PATH')
            parent = os.open(_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            self.opened.append(parent)
            self.root_pin = identity(os.fstat(parent))
            self.directory(os.fstat(parent), _ROOT)
            current = _ROOT
            parts = os.path.relpath(self.path, _ROOT).split(os.sep)
            for part in parts[:-1]:
                current = os.path.join(current, part)
                before = os.stat(part, dir_fd=parent, follow_symlinks=False)
                self.directory(before, current)
                fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                             dir_fd=parent)
                self.opened.append(fd)
                need(file_pin(before) == file_pin(os.fstat(fd)), 'ANCESTOR_CHANGED')
                self.trace.append((parent, part, fd, identity(before)))
                parent = fd
            self.parent, self.name = parent, parts[-1]
            self.verify()
            return self
        except BaseException:
            self.close()
            raise

    def verify(self):
        need(self.root_pin == identity(os.fstat(self.opened[0])), 'ROOT_CHANGED')
        for parent, name, fd, pin in self.trace:
            need(pin == identity(os.fstat(fd)) == identity(os.stat(
                name, dir_fd=parent, follow_symlinks=False)), 'ANCESTOR_CHANGED')

    def close(self):
        for fd in reversed(self.opened):
            os.close(fd)
        self.opened.clear()

    def __exit__(self, typ, value, tb):
        try:
            if typ is None:
                self.verify()
        finally:
            self.close()


def read_protected(path, limit, mode=None):
    with ProtectedPath(str(path)) as held:
        before = os.stat(held.name, dir_fd=held.parent, follow_symlinks=False)
        need(stat.S_ISREG(before.st_mode) and before.st_uid == _ROOT_UID and
             before.st_nlink == 1 and not before.st_mode & 0o022 and
             0 < before.st_size <= limit, 'FILE_CUSTODY')
        need(mode is None or stat.S_IMODE(before.st_mode) == mode, 'FILE_MODE')
        fd = os.open(held.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                     dir_fd=held.parent)
        try:
            pin = file_pin(before)
            need(pin == file_pin(os.fstat(fd)), 'FILE_CHANGED')
            chunks, total = [], 0
            while total <= limit:
                block = os.read(fd, min(65536, limit + 1 - total))
                if not block:
                    break
                chunks.append(block)
                total += len(block)
            need(total == before.st_size and total <= limit and
                 pin == file_pin(os.fstat(fd)) == file_pin(os.stat(
                     held.name, dir_fd=held.parent, follow_symlinks=False)), 'FILE_CHANGED')
            return b''.join(chunks)
        finally:
            os.close(fd)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def strict_json(raw):
    def pairs(values):
        result = {}
        for key, value in values:
            need(key not in result, 'DUPLICATE_JSON_FIELD')
            result[key] = value
        return result
    try:
        return json.loads(raw, object_pairs_hook=pairs,
                          parse_constant=lambda _: fail('INVALID_JSON_CONSTANT'))
    except (ValueError, UnicodeError, RecursionError):
        fail('INVALID_JSON')


class PreservationExec:
    active = None
    ds = types.SimpleNamespace(ObservationPath=ProtectedPath,
        ObservationFailure=OSError, canonical=canonical,
        _observation_root_owners=lambda: (_ROOT_UID,),
        receipt_path=lambda op: STATE_ROOT + '/receipts/' + op + '.json')

    def __init__(self):
        self.base = self

    def need(self, value, code='BINDING_MISMATCH', stage='binding'):
        need(value, code + '@' + stage)

    def path(self, op):
        return STATE_ROOT + '/receipts/' + op + '.b7-execution.json'

    def disposal_paths(self, op):
        prefix = self.path(op)[:-5]
        return prefix + '.b7-disposal-auth.json', prefix + '.b7-disposal-terminal.json'

    def read_json(self, path, mode):
        raw = read_protected(path, 1024 * 1024, mode)
        return raw, strict_json(raw)

    def safe_bytes(self, path, limit):
        return read_protected(path, limit)


def stage_rows(root):
    return closure._stage_rows(PreservationExec(), str(root))


def binding_at(root):
    rows = stage_rows(root)
    return (hashlib.sha256(canonical(rows)).hexdigest(),
            sum(row['kind'] == 'D' for row in rows),
            sum(row['kind'] == 'F' for row in rows))


def check_status(data):
    need(type(data) is dict and data.get('phase') == 'RETAINED' and
         data.get('tx_id') is None and data.get('native_state') == 'UNKNOWN' and data.get('native_terminal_verified') is False and data.get('loaded_business_proof') is False and type(data.get('attempt')) is int and data['attempt'] == 1 and type(data.get('input_sequence')) is int and data['input_sequence'] == 0 and data.get('input_pending') is False and data.get('active') is False, 'SUBJECT_NOT_RETAINED')
    overlay = data.get('disposal_terminal')
    need(type(overlay) is dict and overlay.get('native_state') == 'CLOSED_PRE_TX' and
         overlay.get('installed') is False and
         overlay.get('partial_stage_preserved') is True, 'TERMINAL_NOT_CLOSURE')
    return overlay


def checked_terminal(execution, data):
    overlay = check_status(data)
    _, reg = closure._registration(execution, OP)
    closure._execution(execution, OP, reg)
    auth = closure.e31_closure_load(execution, OP, 'auth')
    terminal = closure.e31_closure_load(execution, OP, 'terminal')
    need(auth is not None and terminal is not None, 'NO_COMPLETE_DISPOSAL')
    need(overlay == dict(native_state='CLOSED_PRE_TX', installed=False,
         partial_stage_preserved=True, authorization_sha256=terminal['authorization_sha256'],
         execution_receipt_sha256=terminal['post']['execution_receipt_sha256']),
         'TERMINAL_STATUS_BINDING')
    return auth, terminal


def rename_no_replace(src, dst, parent_fd):
    need(src == Path(closure.E31['original_stage']).name and
         dst == Path(closure.E31['preserved_stage']).name, 'FIXED_RENAME_NAMES')
    need(sys.platform == 'darwin', 'ATOMIC_NOREPLACE_UNSUPPORTED')
    with ProtectedPath(closure.E31['original_stage']) as held:
        need(identity(os.fstat(parent_fd)) == identity(os.fstat(held.parent)),
             'FIXED_RENAME_PARENT')
        libc = ctypes.CDLL(None, use_errno=True)
        primitive = getattr(libc, 'renameatx_np', None)
        need(primitive is not None, 'ATOMIC_NOREPLACE_UNSUPPORTED')
        primitive.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int,
                              ctypes.c_char_p, ctypes.c_uint)
        primitive.restype = ctypes.c_int
        # macOS SDK sys/stdio.h: RENAME_EXCL=0x4; no overwrite fallback.
        if primitive(parent_fd, os.fsencode(src), parent_fd, os.fsencode(dst), 0x4) != 0:
            number = ctypes.get_errno()
            raise OSError(number, os.strerror(number))


def fsync_fixed_history(execution, data, parent_fd, lease_current):
    """Internal fixed-history durability seam; caller retains the original lease.

    No path argument, rename, missing-record completion, metadata change or
    successor scene access. The supplied callback is the sealed caller's
    held-original-mutation-FD/path/custody verification, never user input.
    """
    need(callable(lease_current), 'HELD_LEASE_REQUIRED')
    lease_current()
    need(closure._probe(execution, closure.E31['preserved_stage']), 'EXACT_HISTORY_REQUIRED')
    with ProtectedPath(closure.E31['preserved_stage']) as held:
        need(identity(os.fstat(parent_fd)) == identity(os.fstat(held.parent)),
             'FIXED_HISTORY_PARENT')
        checked_terminal(execution, data)
        before = closure._stage_binding(execution)
        lease_current()
        os.fsync(parent_fd)
        after = closure._stage_binding(execution)
        checked_terminal(execution, data)
        need(canonical(before) == canonical(after), 'HISTORY_CHANGED_AFTER_FSYNC')
        held.verify()
        lease_current()
        return after


def main():
    need(os.geteuid() == 0, 'ROOT_REQUIRED')
    first = status()
    original_overlay = check_status(first)
    original = Path(closure.E31['original_stage'])
    history = Path(closure.E31['preserved_stage'])
    need(original.parent == history.parent, 'PARENT_MISMATCH')
    execution = PreservationExec()
    preservation_present = False
    try:
        with ProtectedPath(str(original)) as parent, ProtectedPath(MUTATION_LOCK) as lock:
            fd = os.open(lock.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                         dir_fd=lock.parent)
            try:
                meta = os.fstat(fd)
                need(stat.S_ISREG(meta.st_mode) and meta.st_uid == _ROOT_UID and
                     meta.st_gid == _LOCK_GID and stat.S_IMODE(meta.st_mode) == 0o644
                     and meta.st_nlink == 1, 'MUTEX_CUSTODY')
                pin = file_pin(meta)
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)

                def lease_current():
                    lock.verify()
                    parent.verify()
                    need(pin == file_pin(os.fstat(fd)) == file_pin(os.stat(
                        lock.name, dir_fd=lock.parent, follow_symlinks=False)), 'MUTEX_REPLACED')

                lease_current()
                current = status()
                need(check_status(current) == original_overlay, 'TERMINAL_CHANGED_UNDER_LEASE')
                lease_current()
                auth, terminal = checked_terminal(execution, current)
                if closure._probe(execution, str(history)):
                    # Historical records select exact history, never successor
                    # original/native/journal/seed state. Parent fsync establishes
                    # durability after a prior rename/fsync interruption, without
                    # changing any pathname/content/metadata or renaming again.
                    lease_current()
                    preservation_present = True
                    partial = fsync_fixed_history(execution, current, parent.parent, lease_current)
                    state = 'ALREADY_PRESERVED'
                else:
                    need(current.get('active') is False, 'ACTIVE_CHILD')
                    fresh = closure._fresh_evidence(execution, dict(
                        nativeTransactionPath=NATIVE_TRANSACTION, nativeLockPath=NATIVE_HOLDER))
                    need(canonical(fresh) == canonical(auth['evidence']), 'FRESH_SCENE_BINDING')
                    lease_current()
                    rename_no_replace(original.name, history.name, parent.parent)
                    preservation_present = True
                    os.fsync(parent.parent)
                    need(not closure._probe(execution, str(original)), 'RENAME_INCOMPLETE')
                    partial = closure._stage_binding(execution)
                    lease_current()
                    state = 'PRESERVED'
                print(json.dumps(dict(kind='E31_PARTIAL_STAGE_PRESERVATION_V1',
                    state=state, history=str(history), sha256=partial['sha256'],
                    directories=partial['directories'], files=partial['files'],
                    terminal_authorization_sha256=terminal['authorization_sha256'])))
            finally:
                os.close(fd)
    except OSError as exc:
        prefix = 'PRESERVATION_DURABILITY_UNKNOWN_OS_ERROR_' if preservation_present else 'OS_ERROR_'
        fail(prefix + str(exc.errno))


if __name__ == '__main__':
    main()
