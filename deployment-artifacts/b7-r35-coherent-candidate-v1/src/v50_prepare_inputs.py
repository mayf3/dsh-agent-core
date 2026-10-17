#!/usr/bin/env python3
"""Place only the fixed SOURCE-corrected R33 inputs after exact e31 preservation.

Old R30 inputs, old snapshot and all histories stay in place. The original DS
alone creates the next snapshot. Partial placement remains UNKNOWN in the same
fixed staging/destination; it is never deleted, repaired or recopied.
"""
import ctypes
import fcntl
import hashlib
import importlib.util
import json
import os
import stat
import subprocess
import sys
import types
from pathlib import Path

sys.dont_write_bytecode = True
WB = Path(__file__).resolve().parent
E31 = 'b7-packet-r27-2edfbaeef5c352f2e-e31'
EXECUTION_SHA = '0c6ca506b0626875e23afdfb38fb969a79ff310489e928e23dd9be16cddec9af'
INPUT = '/private/var/db/agent-deploy-system/inputs/b7-install-r34'
MUTEX = '/private/var/db/agent-deploy-system/mutation.lock'
MIGRATION = '/private/var/db/agent-core/authsvc-codex-migration'
STAGING_ROOT = '/private/var/db/agent-deploy-system-driven'


def need(value, reason):
    if not value:
        raise RuntimeError(reason)

def tree_digest(path, captured=None):
    path = Path(path)
    need(path.is_dir() and not path.is_symlink(), 'DIRECTORY_REQUIRED')
    rows = []
    for base, dirs, files in os.walk(path, followlinks=False):
        for name in dirs + files:
            item = Path(base) / name
            meta = item.lstat()
            rel = item.relative_to(path).as_posix()
            if stat.S_ISLNK(meta.st_mode):
                rows.append([rel, 'L', os.readlink(item)])
            elif stat.S_ISDIR(meta.st_mode):
                rows.append([rel, 'D'])
            elif stat.S_ISREG(meta.st_mode):
                need(meta.st_nlink == 1, 'TREE_FILE_CUSTODY')
                raw = item.read_bytes()
                rows.append([rel, 'F', hashlib.sha256(raw).hexdigest()])
                if captured is not None and rel == 'packet/PACKET.json':
                    captured[rel] = raw
            else:
                need(False, 'TREE_TYPE')
    return hashlib.sha256(json.dumps(sorted(rows), sort_keys=True,
                         separators=(',', ':')).encode()).hexdigest()

def open_directory(path):
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in Path(path).parts[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd); fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def load_preservation():
    # This sibling is independently reviewed and bound by the protected driven
    # manifest. Its original fixed-history seam never renames or creates records.
    spec = importlib.util.spec_from_file_location('b7_fixed_e31_preservation', WB / 'e31_preserve_once.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_terminal_retirement():
    # Existing executor authority seals every driven sibling before invocation.
    # Consume this one protected leaf through its held FD, never a caller path.
    name = 'e34_terminal_materials_once.py'
    parent = open_directory(WB)
    try:
        meta = os.fstat(parent)
        need(meta.st_uid == 0 and not meta.st_mode & 0o022, 'INVOCATION_CUSTODY')
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        try:
            before = os.fstat(fd)
            need(stat.S_ISREG(before.st_mode) and
                 (before.st_uid, before.st_gid, before.st_nlink) == (0, 0, 1) and
                 not before.st_mode & 0o022 and 0 < before.st_size <= 1024 * 1024,
                 'FIXED_TERMINAL_HELPER_CUSTODY')
            chunks, offset = [], 0
            while offset < before.st_size:
                block = os.pread(fd, min(65536, before.st_size - offset), offset)
                need(bool(block), 'FIXED_TERMINAL_HELPER_SHORT_READ')
                chunks.append(block)
                offset += len(block)
            need(pin(before) == pin(os.fstat(fd)), 'FIXED_TERMINAL_HELPER_CHANGED')
            same_entry(fd, parent, name)
            module = types.ModuleType('b7_fixed_e34_terminal_retirement')
            module.__file__ = str(WB / name)
            exec(compile(b''.join(chunks), module.__file__, 'exec'), module.__dict__)
            need(callable(getattr(module, 'run', None)), 'FIXED_TERMINAL_ENTRY_REQUIRED')
            return module
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def pin(meta):
    return (meta.st_dev, meta.st_ino, meta.st_mode, meta.st_uid, meta.st_gid,
            meta.st_nlink, meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)


def same_entry(fd, parent, name):
    need(pin(os.fstat(fd)) == pin(os.stat(name, dir_fd=parent, follow_symlinks=False)),
         'HELD_ENTRY_CHANGED')


def read_config():
    parent = open_directory(WB)
    try:
        meta = os.fstat(parent)
        need(meta.st_uid == 0 and not meta.st_mode & 0o022, 'INVOCATION_CUSTODY')
        fd = os.open('v50-input-preparation.json', os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            meta = os.fstat(fd)
            need(stat.S_ISREG(meta.st_mode) and (meta.st_uid, meta.st_gid) == (0, 0)
                 and stat.S_IMODE(meta.st_mode) == 0o444 and meta.st_nlink == 1
                 and 0 < meta.st_size <= 16384, 'CONFIG_CUSTODY')
            raw = os.read(fd, 16385)
            need(len(raw) == meta.st_size and pin(os.fstat(fd)) == pin(meta), 'CONFIG_CHANGED')
            same_entry(fd, parent, 'v50-input-preparation.json')
            return json.loads(raw)
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def tree_at(fd, sync=False, material=False):
    """Original digest rows, but untrusted placed trees are read by nofollow FDs.

    The parent of the final inputs is user-owned. Never follow a swapped leaf
    or directory while root, and never chmod/chown a published pathname.
    """
    if material:
        meta = os.fstat(fd)
        need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (502, 80, 0o755),
             'MATERIAL_DIRECTORY_CUSTODY')
    rows = []
    def walk(directory, prefix):
        names = sorted(os.listdir(directory))
        for name in names:
            before = os.stat(name, dir_fd=directory, follow_symlinks=False)
            rel = prefix + name
            if material:
                need((before.st_uid, before.st_gid) == (502, 80), 'MATERIAL_FILE_CUSTODY')
                if not stat.S_ISLNK(before.st_mode):
                    need(stat.S_IMODE(before.st_mode) == 0o755 if stat.S_ISDIR(before.st_mode)
                         else stat.S_IMODE(before.st_mode) in (0o644, 0o755), 'MATERIAL_FILE_MODE')
            if stat.S_ISLNK(before.st_mode):
                target = os.readlink(name, dir_fd=directory)
                need(pin(before) == pin(os.stat(name, dir_fd=directory, follow_symlinks=False)), 'TREE_ENTRY_CHANGED')
                rows.append([rel, 'L', target])
                continue
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if stat.S_ISDIR(before.st_mode):
                child = os.open(name, flags | os.O_DIRECTORY, dir_fd=directory)
                try:
                    need(pin(before) == pin(os.fstat(child)), 'TREE_ENTRY_CHANGED')
                    rows.append([rel, 'D'])
                    walk(child, rel + '/')
                    same_entry(child, directory, name)
                finally:
                    os.close(child)
            else:
                need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'TREE_FILE_CUSTODY')
                child = os.open(name, flags, dir_fd=directory)
                try:
                    need(pin(before) == pin(os.fstat(child)), 'TREE_ENTRY_CHANGED')
                    h = hashlib.sha256()
                    while True:
                        block = os.read(child, 1048576)
                        if not block:
                            break
                        h.update(block)
                    need(pin(before) == pin(os.fstat(child)), 'TREE_FILE_CHANGED')
                    same_entry(child, directory, name)
                    if sync:
                        os.fsync(child)
                    rows.append([rel, 'F', h.hexdigest()])
                finally:
                    os.close(child)
        need(names == sorted(os.listdir(directory)), 'TREE_ENTRIES_CHANGED')
        if sync:
            os.fsync(directory)
    walk(fd, '')
    return hashlib.sha256(json.dumps(sorted(rows), sort_keys=True,
                         separators=(',', ':')).encode()).hexdigest()


def checked_material(parent, name, want):
    fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        meta = os.fstat(fd)
        need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (502, 80, 0o755),
             'MATERIAL_DIRECTORY_CUSTODY')
        need(tree_at(fd, material=True) == want, 'PLACED_TREE_MISMATCH')
        need(tree_at(fd, sync=True, material=True) == want, 'PLACED_TREE_MISMATCH')
        need(tree_at(fd, material=True) == want, 'PLACED_TREE_MISMATCH')
        same_entry(fd, parent, name)
        return fd
    except BaseException:
        os.close(fd)
        raise


def original_place(source, destination):
    # Only the root0700 staging container is passed here, never the user-owned
    # inputs parent. Preserve symlinks; metadata writes never follow their target.
    subprocess.run(['/bin/cp', '-R', str(source) + '/.', str(destination)], check=True)
    fd = open_directory(destination)
    try:
        apply_custody(fd)
    finally:
        os.close(fd)


def apply_custody(fd):
    for name in os.listdir(fd):
        before = os.stat(name, dir_fd=fd, follow_symlinks=False)
        if stat.S_ISLNK(before.st_mode):
            os.chown(name, 502, 80, dir_fd=fd, follow_symlinks=False)
            continue
        need(stat.S_ISDIR(before.st_mode) or
             (stat.S_ISREG(before.st_mode) and before.st_nlink == 1), 'TREE_FILE_CUSTODY')
        flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
        if stat.S_ISDIR(before.st_mode):
            flags |= os.O_DIRECTORY
        child = os.open(name, flags, dir_fd=fd)
        try:
            need(pin(before) == pin(os.fstat(child)), 'TREE_ENTRY_CHANGED')
            apply_custody(child) if stat.S_ISDIR(before.st_mode) else set_custody(child)
        finally:
            os.close(child)
    set_custody(fd)


def set_custody(fd):
    meta = os.fstat(fd)
    mode = stat.S_IMODE(meta.st_mode)
    need(not mode & 0o7000, 'SPECIAL_MODE_FORBIDDEN')
    mode |= 0o644
    if stat.S_ISDIR(meta.st_mode) or mode & 0o111:
        mode |= 0o111
    os.fchown(fd, 502, 80)
    os.fchmod(fd, mode)


def publish_staged(stage_parent, input_parent):
    # Fixed leaf only; no fallback to overwrite, cp/delete or user-selected path.
    need(sys.platform == 'darwin', 'ATOMIC_NOREPLACE_UNSUPPORTED')
    need(os.fstat(stage_parent).st_dev == os.fstat(input_parent).st_dev, 'CROSS_DEVICE_REFUSED')
    libc = ctypes.CDLL(None, use_errno=True)
    primitive = getattr(libc, 'renameatx_np', None)
    need(primitive is not None, 'ATOMIC_NOREPLACE_UNSUPPORTED')
    primitive.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint)
    primitive.restype = ctypes.c_int
    if primitive(stage_parent, b'b7-install-r34', input_parent, b'b7-install-r34', 0x4) != 0:
        number = ctypes.get_errno()
        raise OSError(number, os.strerror(number))


def check_staging(root, container):
    meta = os.fstat(root)
    need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (0, 0, 0o755), 'STAGING_ROOT_CUSTODY')
    live = open_directory(STAGING_ROOT)
    try:
        need((os.fstat(live).st_dev, os.fstat(live).st_ino) == (meta.st_dev, meta.st_ino), 'STAGING_ROOT_CHANGED')
    finally:
        os.close(live)
    meta = os.fstat(container)
    need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (0, 0, 0o700), 'STAGING_CUSTODY')
    same_entry(container, root, '.r34-input-placement')
    names = os.listdir(container)
    need(not names or names == ['b7-install-r34'], 'FOREIGN_STAGING_ENTRY')
    return names


def open_staging(allow_create):
    root = open_directory(STAGING_ROOT)
    try:
        meta = os.fstat(root)
        need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (0, 0, 0o755), 'STAGING_ROOT_CUSTODY')
        try:
            os.stat('.r34-input-placement', dir_fd=root, follow_symlinks=False)
        except FileNotFoundError:
            need(allow_create, 'DESTINATION_WITHOUT_STAGING_HISTORY')
            # The existing fixed root is never created or repaired here.
            os.mkdir('.r34-input-placement', 0o700, dir_fd=root)
            os.fsync(root)
        container = os.open('.r34-input-placement', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root)
        try:
            check_staging(root, container)
        except BaseException:
            os.close(container)
            raise
        return root, container
    except BaseException:
        os.close(root)
        raise


def main():
    need(len(sys.argv) == 1 and os.geteuid() == 0, 'FIXED_ROOT_ENTRY_REQUIRED')
    need(not any(k.startswith('DS_') for k in os.environ), 'OVERRIDE_ENVIRONMENT_FORBIDDEN')
    config = read_config()
    if config.get('source_package') == 'b7-install-r35':
        return place_r35(config)
    need(config['source_package'] == 'b7-install-r34', 'FIXED_SOURCE_CONVENTION')
    expected = WB / 'b7-install-r34'
    config['source_package'] = str(expected)
    need(config['input_path'] == INPUT, 'FIXED_DESTINATIONS')
    lock_parent = open_directory(Path(MUTEX).parent)
    try:
        lock = os.open(Path(MUTEX).name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=lock_parent)
        try:
            meta = os.fstat(lock)
            need(stat.S_ISREG(meta.st_mode) and (meta.st_uid, meta.st_gid) == (0, 80)
                 and stat.S_IMODE(meta.st_mode) == 0o644 and meta.st_nlink == 1, 'MUTEX_CUSTODY')
            lock_pin = pin(meta)
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            def lease_current():
                need(pin(os.fstat(lock)) == lock_pin, 'MUTEX_REPLACED')
                same_entry(lock, lock_parent, Path(MUTEX).name)
                live = open_directory(Path(MUTEX).parent)
                try:
                    need((os.fstat(live).st_dev, os.fstat(live).st_ino) ==
                         (os.fstat(lock_parent).st_dev, os.fstat(lock_parent).st_ino), 'MUTEX_PARENT_CHANGED')
                finally:
                    os.close(live)
            lease_current()
            if 'fixed_terminal_retirement' in config:
                need(config['fixed_terminal_retirement'] == 'e34-aborted-891730d1',
                     'FIXED_TERMINAL_SUBJECT_REQUIRED')
                helper = load_terminal_retirement()
                outcome = helper.run(lease_current)
                need(type(outcome) is dict, 'FIXED_TERMINAL_OUTCOME_REQUIRED')
                lease_current()
                print(json.dumps(outcome, sort_keys=True))
                return outcome
            preservation = load_preservation()
            execution = preservation.PreservationExec()
            history_parent = open_directory(MIGRATION)
            target_parent = open_directory(Path(INPUT).parent)
            try:
                target_pin = pin(os.fstat(target_parent))
                need((target_pin[3], target_pin[4], stat.S_IMODE(target_pin[2])) == (502, 80, 0o755), 'INPUT_PARENT_CUSTODY')
                def fresh():
                    lease_current()
                    live = open_directory(Path(INPUT).parent)
                    try:
                        actual = os.fstat(live)
                        need((actual.st_dev, actual.st_ino) == target_pin[:2], 'INPUT_PARENT_CHANGED')
                        need((actual.st_uid, actual.st_gid, stat.S_IMODE(actual.st_mode)) == (502, 80, 0o755), 'INPUT_PARENT_CUSTODY')
                    finally:
                        os.close(live)
                    data = preservation.status()
                    preservation.fsync_fixed_history(execution, data, history_parent, lease_current)
                    return data
                fresh()
                captured = {}
                need(tree_digest(expected, captured) == config['new_input_tree_sha256'], 'SOURCE_TREE_CHANGED')
                json.loads(captured['packet/PACKET.json'])['files']
                try:
                    existing = os.stat('b7-install-r34', dir_fd=target_parent, follow_symlinks=False)
                except FileNotFoundError:
                    existing = None
                stage_root, stage_parent = open_staging(existing is None)
                try:
                    names = check_staging(stage_root, stage_parent)
                    if existing is not None:
                        need(not names, 'DESTINATION_STAGING_CONFLICT')
                        held = checked_material(target_parent, 'b7-install-r34', config['new_input_tree_sha256'])
                        try:
                            fresh()
                            check_staging(stage_root, stage_parent)
                            same_entry(held, target_parent, 'b7-install-r34')
                            os.fsync(target_parent)
                            os.fsync(stage_parent)
                            os.fsync(stage_root)
                            need(tree_at(held, material=True) == config['new_input_tree_sha256'], 'PLACED_TREE_MISMATCH')
                            same_entry(held, target_parent, 'b7-install-r34')
                        finally:
                            os.close(held)
                        state = 'ALREADY_PLACED_R34'
                    else:
                        stage = Path(STAGING_ROOT) / '.r34-input-placement' / 'b7-install-r34'
                        if not names:
                            fresh()
                            need(tree_digest(expected) == config['new_input_tree_sha256'], 'SOURCE_TREE_CHANGED')
                            check_staging(stage_root, stage_parent)
                            os.mkdir('b7-install-r34', 0o700, dir_fd=stage_parent)
                            os.fsync(stage_parent)
                            original_place(expected, stage)
                        held = checked_material(stage_parent, 'b7-install-r34', config['new_input_tree_sha256'])
                        try:
                            fresh()
                            need(tree_digest(expected) == config['new_input_tree_sha256'], 'SOURCE_TREE_CHANGED')
                            check_staging(stage_root, stage_parent)
                            same_entry(held, stage_parent, 'b7-install-r34')
                            publish_staged(stage_parent, target_parent)
                            os.fsync(target_parent)
                            os.fsync(stage_parent)
                            same_entry(held, target_parent, 'b7-install-r34')
                            need(tree_at(held, material=True) == config['new_input_tree_sha256'], 'PLACED_TREE_MISMATCH')
                            fresh()
                            check_staging(stage_root, stage_parent)
                        finally:
                            os.close(held)
                        state = 'PLACED_R34'
                finally:
                    os.close(stage_parent)
                    os.close(stage_root)
                lease_current()
                print(json.dumps(dict(inputs=state, old_inputs_untouched=True, old_snapshot_untouched=True,
                    new_snapshot_created=False, history_parent_fsync=True, placement_fsync=True, replay_allowed=False), sort_keys=True))
            finally:
                os.close(target_parent)
                os.close(history_parent)
        finally:
            os.close(lock)
    except OSError as exc:
        raise RuntimeError('PLACEMENT_UNKNOWN_OS_ERROR_' + str(exc.errno)) from exc
    finally:
        os.close(lock_parent)


R35_INPUT = '/private/var/db/agent-deploy-system/inputs/b7-install-r35'

def load_r35_successor():
    parent = open_directory(WB)
    try:
        meta = os.fstat(parent)
        need(meta.st_uid == 0 and not meta.st_mode & 0o022, 'INVOCATION_CUSTODY')
        fd = os.open('e35_finished_for_r35.py', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        try:
            before = os.fstat(fd)
            need(stat.S_ISREG(before.st_mode) and (before.st_uid, before.st_gid, stat.S_IMODE(before.st_mode), before.st_nlink) == (0, 0, 0o555, 1) and 0 < before.st_size <= 1024*1024, 'FIXED_R35_READER_CUSTODY')
            raw = os.pread(fd, before.st_size+1, 0)
            need(len(raw) == before.st_size and pin(before) == pin(os.fstat(fd)), 'FIXED_R35_READER_CHANGED')
            same_entry(fd, parent, 'e35_finished_for_r35.py')
            module = types.ModuleType('fixed_e35_finished_for_r35')
            module.__file__ = str(WB / 'e35_finished_for_r35.py')
            exec(compile(raw, module.__file__, 'exec'), module.__dict__)
            same_entry(fd, parent, 'e35_finished_for_r35.py')
            return module
        finally: os.close(fd)
    finally: os.close(parent)

def r35_publish_staged(stage_parent, input_parent):
    # Fixed leaf only; no fallback to overwrite, cp/delete or user-selected path.
    need(sys.platform == 'darwin', 'ATOMIC_NOREPLACE_UNSUPPORTED')
    need(os.fstat(stage_parent).st_dev == os.fstat(input_parent).st_dev, 'CROSS_DEVICE_REFUSED')
    libc = ctypes.CDLL(None, use_errno=True)
    primitive = getattr(libc, 'renameatx_np', None)
    need(primitive is not None, 'ATOMIC_NOREPLACE_UNSUPPORTED')
    primitive.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint)
    primitive.restype = ctypes.c_int
    if primitive(stage_parent, b'b7-install-r35', input_parent, b'b7-install-r35', 0x4) != 0:
        number = ctypes.get_errno()
        raise OSError(number, os.strerror(number))


def r35_check_staging(root, container):
    meta = os.fstat(root)
    need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (0, 0, 0o755), 'STAGING_ROOT_CUSTODY')
    live = open_directory(STAGING_ROOT)
    try:
        need((os.fstat(live).st_dev, os.fstat(live).st_ino) == (meta.st_dev, meta.st_ino), 'STAGING_ROOT_CHANGED')
    finally:
        os.close(live)
    meta = os.fstat(container)
    need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (0, 0, 0o700), 'STAGING_CUSTODY')
    same_entry(container, root, '.r35-input-placement')
    names = os.listdir(container)
    need(not names or names == ['b7-install-r35'], 'FOREIGN_STAGING_ENTRY')
    return names


def r35_open_staging(allow_create):
    root = open_directory(STAGING_ROOT)
    try:
        meta = os.fstat(root)
        need((meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode)) == (0, 0, 0o755), 'STAGING_ROOT_CUSTODY')
        try:
            os.stat('.r35-input-placement', dir_fd=root, follow_symlinks=False)
        except FileNotFoundError:
            need(allow_create, 'DESTINATION_WITHOUT_STAGING_HISTORY')
            # The existing fixed root is never created or repaired here.
            os.mkdir('.r35-input-placement', 0o700, dir_fd=root)
            os.fsync(root)
        container = os.open('.r35-input-placement', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root)
        try:
            r35_check_staging(root, container)
        except BaseException:
            os.close(container)
            raise
        return root, container
    except BaseException:
        os.close(root)
        raise

def place_r35(config):
    need(len(sys.argv) == 1 and os.geteuid() == 0, 'FIXED_ROOT_ENTRY_REQUIRED')
    need(not any(k.startswith('DS_') for k in os.environ), 'OVERRIDE_ENVIRONMENT_FORBIDDEN')
    need(config['source_package'] == 'b7-install-r35', 'FIXED_SOURCE_CONVENTION')
    expected = WB / 'b7-install-r35'
    config['source_package'] = str(expected)
    need(config['input_path'] == R35_INPUT, 'FIXED_DESTINATIONS')
    lock_parent = open_directory(Path(MUTEX).parent)
    try:
        lock = os.open(Path(MUTEX).name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=lock_parent)
        try:
            meta = os.fstat(lock)
            need(stat.S_ISREG(meta.st_mode) and (meta.st_uid, meta.st_gid) == (0, 80)
                 and stat.S_IMODE(meta.st_mode) == 0o644 and meta.st_nlink == 1, 'MUTEX_CUSTODY')
            lock_pin = pin(meta)
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            def lease_current():
                need(pin(os.fstat(lock)) == lock_pin, 'MUTEX_REPLACED')
                same_entry(lock, lock_parent, Path(MUTEX).name)
                live = open_directory(Path(MUTEX).parent)
                try:
                    need((os.fstat(live).st_dev, os.fstat(live).st_ino) ==
                         (os.fstat(lock_parent).st_dev, os.fstat(lock_parent).st_ino), 'MUTEX_PARENT_CHANGED')
                finally:
                    os.close(live)
            lease_current()
            need('fixed_terminal_retirement' not in config, 'R35_ORDINARY_ENTRY_ONLY')
            successor = load_r35_successor()
            target_parent = open_directory(Path(R35_INPUT).parent)
            try:
                target_pin = pin(os.fstat(target_parent))
                need((target_pin[3], target_pin[4], stat.S_IMODE(target_pin[2])) == (502, 80, 0o755), 'INPUT_PARENT_CUSTODY')
                def fresh():
                    lease_current()
                    live = open_directory(Path(R35_INPUT).parent)
                    try:
                        actual = os.fstat(live)
                        need((actual.st_dev, actual.st_ino) == target_pin[:2], 'INPUT_PARENT_CHANGED')
                        need((actual.st_uid, actual.st_gid, stat.S_IMODE(actual.st_mode)) == (502, 80, 0o755), 'INPUT_PARENT_CUSTODY')
                    finally:
                        os.close(live)
                    return successor.assert_finished(config['fixed_e35_successor'], lease_current, WB)
                fresh()
                captured = {}
                need(tree_digest(expected, captured) == config['new_input_tree_sha256'], 'SOURCE_TREE_CHANGED')
                json.loads(captured['packet/PACKET.json'])['files']
                try:
                    existing = os.stat('b7-install-r35', dir_fd=target_parent, follow_symlinks=False)
                except FileNotFoundError:
                    existing = None
                stage_root, stage_parent = r35_open_staging(existing is None)
                try:
                    names = r35_check_staging(stage_root, stage_parent)
                    if existing is not None:
                        need(not names, 'DESTINATION_STAGING_CONFLICT')
                        held = checked_material(target_parent, 'b7-install-r35', config['new_input_tree_sha256'])
                        try:
                            fresh()
                            r35_check_staging(stage_root, stage_parent)
                            same_entry(held, target_parent, 'b7-install-r35')
                            os.fsync(target_parent)
                            os.fsync(stage_parent)
                            os.fsync(stage_root)
                            need(tree_at(held, material=True) == config['new_input_tree_sha256'], 'PLACED_TREE_MISMATCH')
                            same_entry(held, target_parent, 'b7-install-r35')
                        finally:
                            os.close(held)
                        state = 'ALREADY_PLACED_R35'
                    else:
                        stage = Path(STAGING_ROOT) / '.r35-input-placement' / 'b7-install-r35'
                        if not names:
                            fresh()
                            need(tree_digest(expected) == config['new_input_tree_sha256'], 'SOURCE_TREE_CHANGED')
                            r35_check_staging(stage_root, stage_parent)
                            os.mkdir('b7-install-r35', 0o700, dir_fd=stage_parent)
                            os.fsync(stage_parent)
                            original_place(expected, stage)
                        held = checked_material(stage_parent, 'b7-install-r35', config['new_input_tree_sha256'])
                        try:
                            fresh()
                            need(tree_digest(expected) == config['new_input_tree_sha256'], 'SOURCE_TREE_CHANGED')
                            r35_check_staging(stage_root, stage_parent)
                            same_entry(held, stage_parent, 'b7-install-r35')
                            r35_publish_staged(stage_parent, target_parent)
                            os.fsync(target_parent)
                            os.fsync(stage_parent)
                            same_entry(held, target_parent, 'b7-install-r35')
                            need(tree_at(held, material=True) == config['new_input_tree_sha256'], 'PLACED_TREE_MISMATCH')
                            fresh()
                            r35_check_staging(stage_root, stage_parent)
                        finally:
                            os.close(held)
                        state = 'PLACED_R35'
                finally:
                    os.close(stage_parent)
                    os.close(stage_root)
                lease_current()
                print(json.dumps(dict(inputs=state, old_inputs_untouched=True, old_snapshot_untouched=True,
                    new_snapshot_created=False, e35_finished_proof_read_only=True, placement_fsync=True, replay_allowed=False), sort_keys=True))
            finally:
                os.close(target_parent)
        finally:
            os.close(lock)
    except OSError as exc:
        raise RuntimeError('PLACEMENT_UNKNOWN_OS_ERROR_' + str(exc.errno)) from exc
    finally:
        os.close(lock_parent)


if __name__ == '__main__':
    main()
