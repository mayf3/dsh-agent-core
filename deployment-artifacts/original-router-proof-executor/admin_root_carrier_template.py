"""Separate original root executor carrier for one fixed admin qualification.

Compilation fills the two pins. The checked-in template has no active host
entry. A caller cannot select an action, target, proof, path, or descriptor.
"""
import array
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import socket
import stat
import subprocess
import sys
import threading
import time
import types


PINS = None
LAUNCHER_SHA = None
# The checked-in source remains inert with PINS/LAUNCHER_SHA unset. A compiled
# fixed package may use the original driver's live canonical/window/child
# custody path; installation and actual host qualification remain separate.
CUSTODIAN_BOUND = True
WINDOW_DIRECTORY = Path('/private/var/db/agent-deploy-system/original-router-qualification-20260927-v1')
PACKAGE_DIRECTORY = WINDOW_DIRECTORY / 'package'
PROOF_DIRECTORY = Path('/private/var/db/agent-deploy-system/hr-s256-deployment-proof')
RESULT_NAME = '.carrier-result.json'
CHALLENGE_SECONDS = 0.75


class CarrierRejected(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise CarrierRejected(reason)


def _directory(path):
    require(path in (WINDOW_DIRECTORY, PACKAGE_DIRECTORY, PROOF_DIRECTORY,
                     Path('/usr/bin'))
            and path.is_absolute() and '..' not in path.parts,
            'ADMIN_CARRIER_NAMESPACE')
    opened = []
    trace = []
    identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid, m.st_gid,
                          m.st_nlink, m.st_mtime_ns, m.st_ctime_ns)
    try:
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
        opened.append(fd)
        root = os.fstat(fd)
        require(stat.S_ISDIR(root.st_mode) and root.st_uid == 0
                and not stat.S_IMODE(root.st_mode) & 0o022,
                'ADMIN_CARRIER_NAMESPACE')
        relative = ''
        for component in path.parts[1:]:
            relative += '/' + component
            before = os.stat(component, dir_fd=fd, follow_symlinks=False)
            require(stat.S_ISDIR(before.st_mode) and before.st_uid == 0,
                    'ADMIN_CARRIER_NAMESPACE')
            if relative == '/private/var/db/agent-deploy-system':
                require(before.st_gid == 80 and stat.S_IMODE(before.st_mode) == 0o770,
                        'ADMIN_CARRIER_DS_PARENT')
            else:
                require(not stat.S_IMODE(before.st_mode) & 0o022,
                        'ADMIN_CARRIER_NAMESPACE')
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=fd)
            opened.append(child)
            require(identity(before) == identity(os.fstat(child))
                    and identity(before) == identity(os.stat(component, dir_fd=fd,
                                                              follow_symlinks=False)),
                    'ADMIN_CARRIER_NAMESPACE_CHANGED')
            trace.append((fd, component, child, identity(before)))
            fd = child
        for parent, component, child, expected in trace:
            require(identity(os.stat(component, dir_fd=parent,
                                     follow_symlinks=False)) == expected
                    and identity(os.fstat(child)) == expected,
                    'ADMIN_CARRIER_NAMESPACE_CHANGED')
        return opened.pop(), opened
    except BaseException:
        for fd in reversed(opened): os.close(fd)
        raise


def _file(directory, name, expected, limit):
    before = os.stat(name, dir_fd=directory, follow_symlinks=False)
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0
            and not stat.S_IMODE(before.st_mode) & 0o022
            and before.st_nlink == 1 and 0 < before.st_size <= limit,
            'ADMIN_CARRIER_FILE_CUSTODY')
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    try:
        opened = os.fstat(fd)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid, m.st_gid,
                              m.st_nlink, m.st_size, m.st_mtime_ns, m.st_ctime_ns)
        require(identity(before) == identity(opened), 'ADMIN_CARRIER_FILE_CHANGED')
        raw = os.pread(fd, before.st_size + 1, 0)
        require(len(raw) == before.st_size and hashlib.sha256(raw).hexdigest() == expected
                and identity(opened) == identity(os.fstat(fd))
                and identity(before) == identity(os.stat(name, dir_fd=directory,
                                                         follow_symlinks=False)),
                'ADMIN_CARRIER_FILE_CHANGED')
        return fd
    except BaseException:
        os.close(fd)
        raise


def _window(directory):
    # This is a private original-executor namespace, never the HR cut window.
    fd = os.open('window.lock', os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                 0o600, dir_fd=directory)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        os.fsync(fd)
        os.fsync(directory)
        return fd
    except BaseException:
        os.close(fd)
        raise


def _record_unknown(directory, window, reason):
    """One-use root journal; this says nothing about child termination."""
    require(re.fullmatch('[A-Z][A-Z0-9_]{0,63}', reason) is not None,
            'ADMIN_CARRIER_UNKNOWN_REASON')
    observed = os.stat('window.lock', dir_fd=directory, follow_symlinks=False)
    held = os.fstat(window)
    require(stat.S_ISREG(observed.st_mode) and observed.st_uid == 0
            and stat.S_IMODE(observed.st_mode) == 0o600
            and (observed.st_dev, observed.st_ino) == (held.st_dev, held.st_ino),
            'ADMIN_CARRIER_UNKNOWN_WINDOW')
    raw = json.dumps({'version': 1,
        'qualificationOperationId': PINS['qualificationOperationId'],
        'disposition': 'UNKNOWN', 'reason': reason},
        sort_keys=True, separators=(',', ':')).encode()
    fd = None
    try:
        fd = os.open('qualification-unknown.json', os.O_RDWR | os.O_CREAT |
                     os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        require(os.write(fd, raw) == len(raw), 'ADMIN_CARRIER_UNKNOWN_SHORT_WRITE')
        os.fsync(fd)
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
                and stat.S_IMODE(meta.st_mode) == 0o600 and meta.st_nlink == 1
                and meta.st_size == len(raw) and os.pread(fd, len(raw) + 1, 0) == raw,
                'ADMIN_CARRIER_UNKNOWN_READBACK')
        os.fsync(directory)
        return hashlib.sha256(raw).hexdigest()
    finally:
        if fd is not None: os.close(fd)


def _park_unknown(window, process):
    # The carrier keeps its actual OFD and Popen object. It does not terminate
    # the original driver or infer release from a timeout or a serialized PID.
    require(window is not None, 'ADMIN_CARRIER_WINDOW_UNOWNED')
    custody = (window, process)
    parked = threading.Event()
    while True:
        try:
            parked.wait()
        except BaseException:
            # A catchable interruption does not close the owned OFD/child.
            continue


def _retain_unknown(directory, window, process, reason):
    # Only the still-owned window/child objects enter this path. A failed or
    # competing journal cannot authorize cleanup or a second qualification.
    try:
        _record_unknown(directory, window, reason)
    except BaseException:
        pass
    _park_unknown(window, process)


def _digest(items):
    return hashlib.sha256(json.dumps(items, separators=(',', ':')).encode()).hexdigest().encode()


def _proof(directory, name, expected_binary):
    before = os.stat(name, dir_fd=directory, follow_symlinks=False)
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0
            and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1
            and 0 < before.st_size <= 2048, 'ADMIN_CARRIER_PROOF_CUSTODY')
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    try:
        opened = os.fstat(fd)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid, m.st_gid,
                              m.st_nlink, m.st_size, m.st_mtime_ns, m.st_ctime_ns)
        require(identity(before) == identity(opened), 'ADMIN_CARRIER_PROOF_CHANGED')
        raw = os.pread(fd, before.st_size + 1, 0)
        require(len(raw) == before.st_size and identity(opened) == identity(os.fstat(fd))
                and identity(before) == identity(os.stat(name, dir_fd=directory,
                                                         follow_symlinks=False)),
                'ADMIN_CARRIER_PROOF_CHANGED')
    finally:
        os.close(fd)
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'ADMIN_CARRIER_PROOF_DUPLICATE')
            value[key] = item
        return value
    value = json.loads(raw, object_pairs_hook=unique)
    require(type(value) is dict and raw == json.dumps(value, sort_keys=True,
            separators=(',', ':')).encode() and
            value.get('deployedBinarySha256') == expected_binary,
            'ADMIN_CARRIER_PROOF_INVALID')
    if name == 'floor-proven.json':
        require(set(value) == {'status', 'floorCommit', 'deployedBinarySha256',
                               'provedAtWallMs'} and
                value['status'] == 'ROUTER_RESTART_SAFETY=PROVEN' and
                value['floorCommit'] == '2097e4f9' and
                type(value['provedAtWallMs']) is int and value['provedAtWallMs'] > 0,
                'ADMIN_CARRIER_PROOF_INVALID')
    else:
        require(name == 'validator-installed.json' and
                set(value) == {'evidenceKind', 'deployedBinarySha256',
                               'installedAtWallMs'} and
                value['evidenceKind'] == 'restart_quiescence_proven' and
                type(value['installedAtWallMs']) is int and value['installedAtWallMs'] > 0,
                'ADMIN_CARRIER_PROOF_INVALID')
    return value


def _prior_qualification(window_dir, proof_dir, expected_binary):
    """Read the original root producer's completed chain before a new window.

    An entirely absent chain permits one qualification. Partial, malformed or
    unbound existing evidence is UNKNOWN and cannot be overwritten or replayed.
    """
    names = ('floor-proven.json', 'validator-installed.json')
    def present(directory, name):
        try:
            os.stat(name, dir_fd=directory, follow_symlinks=False)
            return True
        except FileNotFoundError:
            return False
        except OSError as exc:
            raise CarrierRejected('ADMIN_CARRIER_PRIOR_UNKNOWN') from exc
    present_proofs = [present(proof_dir, name) for name in names]
    present_result = present(window_dir, RESULT_NAME)
    if not any(present_proofs) and not present_result:
        return None
    require(all(present_proofs) and present_result,
            'ADMIN_CARRIER_PRIOR_INCOMPLETE')
    floor, validator = (_proof(proof_dir, name, expected_binary) for name in names)
    require(validator['installedAtWallMs'] <= floor['provedAtWallMs'],
            'ADMIN_CARRIER_PRIOR_ORDER_UNKNOWN')
    before = os.stat(RESULT_NAME, dir_fd=window_dir, follow_symlinks=False)
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0
            and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1
            and 0 < before.st_size <= 4096, 'ADMIN_CARRIER_PRIOR_RESULT_CUSTODY')
    fd = os.open(RESULT_NAME, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=window_dir)
    try:
        opened = os.fstat(fd)
        identity = lambda m: (m.st_dev, m.st_ino, m.st_mode, m.st_uid, m.st_gid,
                              m.st_nlink, m.st_size, m.st_mtime_ns, m.st_ctime_ns)
        require(identity(before) == identity(opened), 'ADMIN_CARRIER_PRIOR_RESULT_CHANGED')
        raw = os.pread(fd, before.st_size + 1, 0)
        require(len(raw) == before.st_size and identity(opened) == identity(os.fstat(fd))
                and identity(before) == identity(os.stat(RESULT_NAME, dir_fd=window_dir,
                                                        follow_symlinks=False)),
                'ADMIN_CARRIER_PRIOR_RESULT_CHANGED')
    finally:
        os.close(fd)
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'ADMIN_CARRIER_PRIOR_RESULT_INVALID')
            value[key] = item
        return value
    try:
        result = json.loads(raw, object_pairs_hook=unique)
    except (ValueError, TypeError) as exc:
        raise CarrierRejected('ADMIN_CARRIER_PRIOR_RESULT_INVALID') from exc
    canonical = lambda value: json.dumps(value, sort_keys=True,
                                         separators=(',', ':')).encode()
    require(type(result) is dict and raw == canonical(result)
            and set(result) == {'schema', 'operationId', 'state', 'workerPid',
                                'replayAllowed', 'qualificationComplete', 'proofSha256',
                                'branch', 'sourceChainSha256'}
            and result['schema'] == 'HR_ORIGINAL_CARRIER_JOB_V1'
            and result['operationId'] == PINS['qualificationOperationId']
            and result['state'] == 'QUALIFICATION_COMPLETE'
            and type(result['workerPid']) is int and result['workerPid'] > 0
            and result['replayAllowed'] is False
            and result['qualificationComplete'] is True
            and result['branch'] == 'fixed_admin_canary'
            and result['sourceChainSha256'] == _source_chain()
            and result['proofSha256'] == [hashlib.sha256(canonical(value)).hexdigest()
                                         for value in (floor, validator)],
            'ADMIN_CARRIER_PRIOR_RESULT_INVALID')
    return floor, validator


def _source_chain():
    # Private root result binds the original fixed branch and compiled inputs;
    # historical unbound CTO results are deliberately ineligible for reuse.
    raw = json.dumps({'branch': 'fixed_admin_canary', 'pins': PINS,
                      'launcherSha256': LAUNCHER_SHA}, sort_keys=True,
                     separators=(',', ':')).encode()
    return hashlib.sha256(raw).hexdigest()


def _driver_module(driver_fd):
    # The actual pinned entry must select the admin branch before any effect.
    meta = os.fstat(driver_fd)
    raw = os.pread(driver_fd, meta.st_size + 1, 0)
    require(len(raw) == meta.st_size and
            hashlib.sha256(raw).hexdigest() == PINS['entrySha256'],
            'ADMIN_CARRIER_CURRENT_DRIVER_CHANGED')
    module = types.ModuleType('_admin_prior_fixed_driver')
    module.__file__ = str(PACKAGE_DIRECTORY / 'driver.py')
    sys.modules[module.__name__] = module
    try:
        exec(compile(raw, module.__file__, 'exec'), module.__dict__)
    finally:
        sys.modules.pop(module.__name__, None)
    return module


def _current_binary(module, daemon_fd):
    # Actual original driver whole-app observer, with the pinned daemon bytes.
    module.DAEMON_SHA = PINS['daemonSha256']
    owner = object.__new__(module.FixedOriginalDriver)
    owner._daemon_fd = daemon_fd
    observed = owner._binary()
    require(type(observed) is str and re.fullmatch('[a-f0-9]{64}', observed),
            'ADMIN_CARRIER_CURRENT_BINARY_UNKNOWN')
    return observed


def _record_complete(directory, window, process, floor, validator):
    """Commit the original root producer's exact closed proof-chain result."""
    require(window is not None and process is not None
            and type(process.pid) is int and process.pid > 0,
            'ADMIN_CARRIER_COMPLETE_OWNER_UNKNOWN')
    observed = os.stat('window.lock', dir_fd=directory, follow_symlinks=False)
    held = os.fstat(window)
    require(stat.S_ISREG(observed.st_mode) and observed.st_uid == 0
            and stat.S_IMODE(observed.st_mode) == 0o600
            and (observed.st_dev, observed.st_ino) == (held.st_dev, held.st_ino),
            'ADMIN_CARRIER_COMPLETE_WINDOW_UNKNOWN')
    canonical = lambda value: json.dumps(value, sort_keys=True,
                                         separators=(',', ':')).encode()
    value = {'schema': 'HR_ORIGINAL_CARRIER_JOB_V1',
             'operationId': PINS['qualificationOperationId'],
             'state': 'QUALIFICATION_COMPLETE', 'workerPid': process.pid,
             'replayAllowed': False, 'qualificationComplete': True,
             'branch': 'fixed_admin_canary', 'sourceChainSha256': _source_chain(),
             'proofSha256': [hashlib.sha256(canonical(item)).hexdigest()
                             for item in (floor, validator)]}
    raw = canonical(value)
    fd = os.open(RESULT_NAME, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                 0o600, dir_fd=directory)
    try:
        require(os.write(fd, raw) == len(raw), 'ADMIN_CARRIER_COMPLETE_SHORT_WRITE')
        os.fsync(fd)
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
                and stat.S_IMODE(meta.st_mode) == 0o600 and meta.st_nlink == 1
                and meta.st_size == len(raw) and os.pread(fd, len(raw) + 1, 0) == raw,
                'ADMIN_CARRIER_COMPLETE_READBACK')
        os.fsync(directory)
    finally:
        os.close(fd)
    return value


def _challenge(channel, window, manifest_sha, *, trusted_uid=0):
    # Root retains the original OFD; a second open of the same inode is not it.
    meta = os.fstat(window)
    require(stat.S_ISREG(meta.st_mode) and meta.st_uid == trusted_uid
            and stat.S_IMODE(meta.st_mode) == 0o600 and meta.st_nlink == 1,
            'ADMIN_CARRIER_WINDOW_CUSTODY')
    identity = [meta.st_dev, meta.st_ino]
    nonce, challenge = secrets.token_hex(32), secrets.token_hex(32)
    frame = json.dumps({'nonce': nonce, 'challenge': challenge,
                        'receiptSha256': manifest_sha, 'windowIdentity': identity},
                       separators=(',', ':')).encode() + b'\n'
    require(len(frame) <= 512, 'ADMIN_CARRIER_FRAME_BOUND')
    deadline = time.monotonic() + CHALLENGE_SECONDS
    reply_fds = []
    try:
        channel.settimeout(max(0, deadline - time.monotonic()))
        channel.sendall(frame)
        answer = bytearray()
        while len(answer) < 64:
            remaining = deadline - time.monotonic()
            require(remaining > 0, 'ADMIN_CARRIER_CHALLENGE_DEADLINE')
            channel.settimeout(remaining)
            block, ancillary, flags, _ = channel.recvmsg(64 - len(answer),
                socket.CMSG_SPACE(array.array('i').itemsize))
            require(bool(block) and not flags & socket.MSG_CTRUNC,
                    'ADMIN_CARRIER_CHALLENGE_CLOSED')
            for level, kind, raw in ancillary:
                require(level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS,
                        'ADMIN_CARRIER_CHALLENGE_FD')
                values = array.array('i')
                require(len(raw) % values.itemsize == 0,
                        'ADMIN_CARRIER_CHALLENGE_FD')
                values.frombytes(raw)
                reply_fds.extend(values)
            answer.extend(block)
        require(len(reply_fds) == 1 and bytes(answer) ==
                _digest([nonce, challenge, manifest_sha, identity]),
                'ADMIN_CARRIER_CHALLENGE_MISMATCH')
        returned = reply_fds[0]
        other = os.fstat(returned)
        require((other.st_dev, other.st_ino) == tuple(identity),
                'ADMIN_CARRIER_WINDOW_FD')
        old, returned_old = os.lseek(window, 0, os.SEEK_CUR), os.lseek(returned, 0, os.SEEK_CUR)
        try:
            os.lseek(returned, old + 1, os.SEEK_SET)
            require(os.lseek(window, 0, os.SEEK_CUR) == old + 1,
                    'ADMIN_CARRIER_WINDOW_OFD')
        finally:
            os.lseek(returned, returned_old, os.SEEK_SET)
            os.lseek(window, old, os.SEEK_SET)
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'ADMIN_CARRIER_CHALLENGE_DEADLINE')
        channel.settimeout(remaining)
        channel.sendall(_digest(['ROOT_APPROVED', nonce, challenge, manifest_sha, identity]))
    finally:
        for fd in reply_fds:
            os.close(fd)


def run():
    require(type(PINS) is dict and PINS.get('qualificationOperationId') ==
            'original-router-qualification-20260927-v1'
            and PINS.get('cutOperationId') ==
            'hr-s256-admin-emergency-cut-20260928-v1'
            and type(PINS.get('hostId')) is str
            and PINS['hostId'] == 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
            and all(type(PINS.get(key)) is str and re.fullmatch('[a-f0-9]{64}', PINS[key])
                for key in ('entryManifestSha256', 'entrySha256', 'helperSha256',
                            'daemonSha256', 'pythonSha256'))
            and type(LAUNCHER_SHA) is str and re.fullmatch('[a-f0-9]{64}', LAUNCHER_SHA),
            'ADMIN_CARRIER_UNBOUND')
    require(sys.argv[1:] == [], 'ADMIN_CARRIER_INVOCATION')
    require(CUSTODIAN_BOUND is True, 'ADMIN_CARRIER_CUSTODIAN_UNBOUND')
    require(os.geteuid() == 0, 'ADMIN_CARRIER_ROOT_REQUIRED')
    require(Path(__file__).parent == PACKAGE_DIRECTORY,
            'ADMIN_CARRIER_PACKAGE_PATH')
    fds = []
    directories = []
    channel = child = process = window = None
    try:
        window_dir, ancestors = _directory(WINDOW_DIRECTORY)
        directories.extend([*ancestors, window_dir])
        package_dir, ancestors = _directory(PACKAGE_DIRECTORY)
        directories.extend([*ancestors, package_dir])
        own = os.stat('admin_root_carrier.py', dir_fd=package_dir,
                      follow_symlinks=False)
        executing = Path(__file__).lstat()
        require(stat.S_ISREG(own.st_mode) and own.st_uid == 0
                and own.st_nlink == 1 and not stat.S_IMODE(own.st_mode) & 0o022
                and (executing.st_dev, executing.st_ino) ==
                    (own.st_dev, own.st_ino), 'ADMIN_CARRIER_ENTRY_CUSTODY')
        for name, field, limit in (
            ('entry-manifest.json', 'entryManifestSha256', 2048),
            ('driver.py', 'entrySha256', 65536),
            ('child-proof.py', 'helperSha256', 65536),
            ('deployment_system.py', 'daemonSha256', 128 * (1 << 20)),
        ):
            fds.append(_file(package_dir, name, PINS[field], limit))
        fds.append(_file(package_dir, 'admin_launcher.py', LAUNCHER_SHA, 65536))
        python_dir, ancestors = _directory(Path('/usr/bin'))
        directories.extend([*ancestors, python_dir])
        fds.append(_file(python_dir, 'python3', PINS['pythonSha256'], 128 * (1 << 20)))
        driver_module = _driver_module(fds[1])
        proof_dir, ancestors = _directory(PROOF_DIRECTORY)
        directories.extend([*ancestors, proof_dir])
        prior = _prior_qualification(window_dir, proof_dir, PINS['finalTreeSha256'])
        if prior is not None:
            require(_current_binary(driver_module, fds[3]) == PINS['finalTreeSha256'],
                    'ADMIN_CARRIER_CURRENT_BINARY_CHANGED')
            return prior
        # All reviewed bytes and fixed interpreter precede the one-use window.
        channel, child = socket.socketpair()
        operation_deadline = time.monotonic() + 300
        window = _window(window_dir)
        fds.insert(0, window)
        # Exact six descriptors; no caller field, shell, environment override,
        # or inherited unrelated FD is admitted to the original executor.
        child_fds = (child.fileno(), *fds[:5])
        process = subprocess.Popen(['/usr/bin/python3', '-I', '-S', '-B',
            str(PACKAGE_DIRECTORY / 'admin_launcher.py'),
            '--original-qualification-fds', ','.join(map(str, child_fds))],
            pass_fds=child_fds, close_fds=True, stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
        child.close(); child = None
        _challenge(channel, fds[0], PINS['entryManifestSha256'])
        remaining = operation_deadline - time.monotonic()
        require(remaining > 0 and process.wait(timeout=remaining) == 0,
                'ADMIN_CARRIER_CHILD_UNKNOWN')
        floor = _proof(proof_dir, 'floor-proven.json', PINS['finalTreeSha256'])
        validator = _proof(proof_dir, 'validator-installed.json', PINS['finalTreeSha256'])
        require(validator['installedAtWallMs'] <= floor['provedAtWallMs']
                and time.monotonic() < operation_deadline,
                'ADMIN_CARRIER_PROOF_ORDER_UNKNOWN')
        _record_complete(window_dir, window, process, floor, validator)
        return floor, validator
    except BaseException as exc:
        # Once the one-use window exists, the original child may be executing
        # or retaining a canonical FD. Journal UNKNOWN, then keep this root
        # carrier and its actual window/child objects resident. No kill/retry.
        if window is not None:
            reason = str(exc)
            if re.fullmatch('[A-Z][A-Z0-9_]{0,63}', reason) is None:
                reason = 'ADMIN_CARRIER_OUTCOME_UNKNOWN'
            _retain_unknown(window_dir, window, process, reason)
        raise
    finally:
        if child is not None: child.close()
        if channel is not None: channel.close()
        for fd in reversed(fds): os.close(fd)
        for fd in reversed(directories): os.close(fd)


if __name__ == '__main__':
    run()
