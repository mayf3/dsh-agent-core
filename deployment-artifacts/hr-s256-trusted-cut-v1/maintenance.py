"""Private fixed maintenance phase; no request surface or production activation.

Compiled payloads stay absent. A future reviewed package supplies the finite
source delta and exact two route bytes; this code never discovers a candidate
from a caller. It preserves dependency material and never starts a process.
"""
import hashlib
import json
import os
from pathlib import Path
import stat
import time
import xml.etree.ElementTree as ET

TRUSTED_INSTALLATION = None
APP = Path('/usr/local/libexec/agent-core/app')
ROUTES = {
    'gui/505/ai.agent-core.runtime': Path('/Users/authsvc/Library/LaunchAgents/ai.agent-core.runtime.plist'),
    'system/ai.agent-core.runtime': Path('/Library/LaunchDaemons/ai.agent-core.runtime.plist'),
}
CUSTODY_UID = 0
APP_SHA = '05607ce1e384b11984c163b138dabac9d7655abe5665ccc224a40a97f6c6617a'
DAEMON_BASE = '908941f28a851d4a323be1870b6e8e9a6c29da841b7706817f0d9189557987cb'
CLIENT_SHA = '88505ceb28ef360e01777ae128a4bf2b8cc92002f35428014c4c6163e1a3c76c'
ID = 'hr-s256-profile-bootstrap-20260926-v1'
_state = {'attempted': False, 'waiting': False}


def require(ok, reason):
    HR_PROFILE.require(ok, reason)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _directory(path):
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in Path(path).parts[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
            meta = os.fstat(fd)
            require(meta.st_uid == CUSTODY_UID and not meta.st_mode & 0o022,
                    'MAINTENANCE_PARENT_CUSTODY')
        return fd
    except BaseException:
        os.close(fd)
        raise


def _read(parent, name, missing=False):
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    except FileNotFoundError:
        if missing: return None
        raise
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == CUSTODY_UID
                and not before.st_mode & 0o022 and before.st_size <= 4 * 1024 * 1024,
                'MAINTENANCE_OUTPUT_CUSTODY')
        raw = os.pread(fd, before.st_size + 1, 0)
        require(len(raw) == before.st_size and os.fstat(fd) == before
                and os.stat(name, dir_fd=parent, follow_symlinks=False) == before,
                'MAINTENANCE_OUTPUT_CHANGED')
        return raw
    finally:
        os.close(fd)


def _tree_manifest():
    """Same DS manifest digest, descriptor traversal and closed source-only set."""
    entries, directories, total = [], 0, 0
    root = _directory(APP)
    def walk(fd, prefix):
        nonlocal directories, total
        for name in sorted(os.listdir(fd)):
            if not prefix and name == 'node_modules': continue  # Existing preserved material untouched.
            meta = os.stat(name, dir_fd=fd, follow_symlinks=False)
            require(meta.st_uid == CUSTODY_UID and not meta.st_mode & 0o022,
                    'MAINTENANCE_OUTPUT_CUSTODY')
            rel = prefix + name
            if stat.S_ISDIR(meta.st_mode):
                child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                try:
                    require(os.fstat(child) == meta, 'MAINTENANCE_OUTPUT_CHANGED')
                    directories += 1
                    require(directories <= 128, 'MAINTENANCE_TREE_BOUND')
                    walk(child, rel + '/')
                    require(os.stat(name, dir_fd=fd, follow_symlinks=False) == meta,
                            'MAINTENANCE_OUTPUT_CHANGED')
                finally: os.close(child)
            else:
                raw = _read(fd, name)
                entries.append({'p': rel, 's': len(raw), 'h': sha(raw)})
                total += len(raw)
                require(len(entries) <= 512 and total <= 4 * 1024 * 1024, 'MAINTENANCE_TREE_BOUND')
    try: walk(root, '')
    finally: os.close(root)
    entries.sort(key=lambda entry: entry['p'])
    return {'dirs': directories, 'entries': entries, 'links': [], 'total': total}


def _tree():
    return sha(canonical(_tree_manifest()))


def _planned(p):
    manifest = _tree_manifest()
    require(sha(canonical(manifest)) == p['baseSourceSha256'], 'MAINTENANCE_BASE_CHANGED')
    entries = {entry['p']: entry for entry in manifest['entries']}
    for path, raw in p['files'].items():
        fd = _directory((APP / path).parent)  # Fixed finite delta creates no unknown directory.
        os.close(fd)
        entries[path] = {'p': path, 's': len(raw), 'h': sha(raw)}
    result = {**manifest, 'entries': sorted(entries.values(), key=lambda entry: entry['p']),
        'total': sum(entry['s'] for entry in entries.values())}
    require(sha(canonical(result)) == p['appSourceSha256'], 'MAINTENANCE_CANDIDATE_CHANGED')


def _payload():
    p = TRUSTED_INSTALLATION
    require(type(p) is dict and set(p) == {'appSourceSha256', 'baseSourceSha256',
        'daemonBaseSha256', 'clientSha256', 'files', 'routes', 'baseRoutes'}, 'MAINTENANCE_PACKAGE_UNKNOWN')
    require(p['appSourceSha256'] == APP_SHA and p['daemonBaseSha256'] == DAEMON_BASE
        and p['clientSha256'] == CLIENT_SHA and HR_PROFILE.valid_hash(p['baseSourceSha256']),
        'MAINTENANCE_TYPED_IDENTITY')
    require(type(p['files']) is dict and 1 <= len(p['files']) <= 32
        and type(p['routes']) is dict and type(p['baseRoutes']) is dict
        and set(p['routes']) == set(p['baseRoutes']) == set(ROUTES), 'MAINTENANCE_ROUTE_SET')
    snapshot = {**p, 'files': dict(p['files']), 'routes': dict(p['routes']), 'baseRoutes': dict(p['baseRoutes'])}
    for path, raw in snapshot['files'].items():
        require(type(path) is str and path.startswith(('packages/', 'scripts/'))
            and all(v not in ('', '.', '..', 'node_modules') for v in path.split('/'))
            and type(raw) is bytes and 0 < len(raw) <= 65536, 'MAINTENANCE_FILE_SCOPE')
    for route, raw in snapshot['routes'].items():
        require(type(raw) is bytes and 0 < len(raw) <= 65536
            and HR_PROFILE.valid_hash(snapshot['baseRoutes'][route]), 'MAINTENANCE_ROUTE_BYTES')
    return snapshot


def _route(old, new):
    def decode(raw):
        # No entity declarations, dynamic XML, duplicate plist dictionary keys.
        require(b'<!ENTITY' not in raw and b'<!DOCTYPE' not in raw.replace(
            b'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', b''),
            'MAINTENANCE_ROUTE_SHAPE')
        root = ET.fromstring(raw)
        require(root.tag == 'plist' and len(root) == 1 and root[0].tag == 'dict', 'MAINTENANCE_ROUTE_SHAPE')
        children = list(root[0]); require(len(children) % 2 == 0, 'MAINTENANCE_ROUTE_SHAPE')
        result = {}
        for index in range(0, len(children), 2):
            key, value = children[index:index + 2]
            require(key.tag == 'key' and key.text not in result, 'MAINTENANCE_ROUTE_SHAPE')
            result[key.text] = ET.tostring(value)
        return result, root[0]
    left, _ = decode(old); right, body = decode(new)
    require('Label' in left and ET.fromstring(left['Label']).tag == 'string'
            and ET.fromstring(left['Label']).text == 'ai.agent-core.runtime',
            'MAINTENANCE_ROUTE_IDENTITY')
    require(set(left) == set(right) and {k: v for k,v in left.items() if k != 'ProgramArguments'}
        == {k: v for k,v in right.items() if k != 'ProgramArguments'}, 'MAINTENANCE_TOPOLOGY_CHANGED')
    values = list(body)
    args = values[values.index(next(v for v in values if v.tag == 'key' and v.text == 'ProgramArguments')) + 1]
    expected = ['/usr/local/libexec/agent-core/node-runtime/bin/node', str(APP /
        'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs')]
    require(args.tag == 'array' and all(v.tag == 'string' for v in args)
        and [v.text for v in args] == expected, 'MAINTENANCE_GATED_ENTRY')


def _continuity(io, deadline):
    require(time.monotonic() < deadline, 'MAINTENANCE_DEADLINE')
    require(type(io) is HR_FIXED_IO.FixedIO and type(io._owner) is HR_OWNED_STOP._Owner
        and type(io._stop) is HR_FINITE_STOP.FixedStop and io._stop._owner is io._owner,
        'MAINTENANCE_PRIVATE_OWNER')
    io._active()
    io._owner.check()
    io._stop.observe()  # Existing owned route inhibition observation, not LE1.
    require(time.monotonic() < deadline, 'MAINTENANCE_DEADLINE')


def _replace(parent, name, raw, mode):
    temporary = name + '.hr-s256-maintenance'
    # Fixed same-directory temporary; crash never reuses/removes it.
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=parent)
    try:
        os.fchown(fd, CUSTODY_UID, 0)
        os.fchmod(fd, mode)
        remaining = memoryview(raw)
        while remaining:
            count = os.write(fd, remaining)
            require(count > 0, 'MAINTENANCE_WRITE_UNKNOWN')
            remaining = remaining[count:]
        os.fsync(fd)
    finally: os.close(fd)
    os.rename(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
    os.fsync(parent)
    require(_read(parent, name) == raw, 'MAINTENANCE_OUTPUT_CHANGED')


def _verify_proofs():
    hashes, sealed = HR_BOOTSTRAP._validated_inputs()
    for name, path in HR_BOOTSTRAP.TARGETS.items():
        fd = HR_BOOTSTRAP._parent(path)
        try: require(HR_BOOTSTRAP._read_at(fd, path.name) == sealed[name], 'MAINTENANCE_PROOF_CHANGED')
        finally: os.close(fd)
    require(HR_BOOTSTRAP.activation_pins() == {'authority': hashes['hr-s256-one-shot-authority.json'],
        'scope': hashes['hr-s256-source-scope.json']}, 'MAINTENANCE_PROOF_UNKNOWN')


def _verify(p):
    require(_tree() == p['appSourceSha256'], 'MAINTENANCE_APP_CHANGED')
    for route, path in ROUTES.items():
        fd = _directory(path.parent)
        try: require(_read(fd, path.name) == p['routes'][route], 'MAINTENANCE_ROUTE_CHANGED')
        finally: os.close(fd)
    _verify_proofs()


def promote_waiting(io):
    """Private installation phase only; neither serve nor the cut invokes it."""
    if TRUSTED_INSTALLATION is None: return None  # Before any protected IO.
    require(not _state['attempted'], 'MAINTENANCE_NO_REPLAY')
    _state['attempted'] = True
    p = _payload()
    deadline = time.monotonic() + 300  # Stops active execution, never releases custody.
    parent = None
    try:
        _continuity(io, deadline)
        _verify_proofs()  # Causally required before effects; never minted here.
        # Already-installed path is readonly but never authorizes repeated startup.
        receipt = Path(STATE_ROOT) / 'receipts' / (ID + '.maintenance.json')
        parent = _directory(receipt.parent)
        expected = {'operation_id': ID, 'action': 'HR_S256_PROFILE_INSTALLATION',
            'state': 'INSTALLED_WAITING', 'version': VERSION,
            'artifacts': {'app': p['appSourceSha256'], **{route: sha(raw) for route,raw in p['routes'].items()}}}
        prior = _read(parent, receipt.name, True)
        if prior is not None:
            value = json.loads(prior, object_pairs_hook=HR_REAL_OS.unique_object)
            require(type(value) is dict and type(value.get('version')) is int
                and value['version'] == VERSION and value == expected, 'MAINTENANCE_UNKNOWN_NO_REPLAY')
            _verify(p)
        else:
            _planned(p)  # Reject wrong source bytes BEFORE reservation/promotion.
            for route, path in ROUTES.items():
                fd = _directory(path.parent)
                try:
                    old = _read(fd, path.name)
                    require(sha(old) == p['baseRoutes'][route], 'MAINTENANCE_ROUTE_CHANGED')
                    _route(old, p['routes'][route])
                finally: os.close(fd)
            # Reserve UNKNOWN with existing O_EXCL/fsync/readback primitive before any app/route byte.
            HR_BOOTSTRAP._publish(parent, receipt.name, canonical({**expected, 'state': 'UNKNOWN'}))
            for path, raw in p['files'].items():
                _continuity(io, deadline)
                target = APP / path
                fd = _directory(target.parent)
                try:
                    _read(fd, target.name, True)  # Reject unsafe existing output.
                    _replace(fd, target.name, raw, 0o644)
                finally: os.close(fd)
            for route, path in ROUTES.items():
                _continuity(io, deadline)
                fd = _directory(path.parent)
                try:
                    require(sha(_read(fd, path.name)) == p['baseRoutes'][route], 'MAINTENANCE_ROUTE_CHANGED')
                    _replace(fd, path.name, p['routes'][route], 0o644)
                finally: os.close(fd)
            _continuity(io, deadline)
            _verify(p)
            _replace(parent, receipt.name, canonical(expected), 0o600)
        _continuity(io, deadline)
        _state['waiting'] = True
        return expected
    except BaseException:
        _state['waiting'] = False
        if type(io) is HR_FIXED_IO.FixedIO:
            io._unknown = True  # Exact owner retains custody; never auto-release/rollback.
        raise
    finally:
        if parent is not None: os.close(parent)


def _waiting_receipt(p):
    path = Path(STATE_ROOT) / 'receipts' / (ID + '.maintenance.json')
    fd = _directory(path.parent)
    try:
        value = json.loads(_read(fd, path.name), object_pairs_hook=HR_REAL_OS.unique_object)
        expected = {'operation_id': ID, 'action': 'HR_S256_PROFILE_INSTALLATION',
            'state': 'INSTALLED_WAITING', 'version': VERSION,
            'artifacts': {'app': p['appSourceSha256'], **{r: sha(raw) for r,raw in p['routes'].items()}}}
        require(type(value) is dict and type(value.get('version')) is int
            and value['version'] == VERSION and value == expected, 'MAINTENANCE_RECEIPT_CHANGED')
    finally: os.close(fd)


def handoff_waiting(io):
    """No launch here: fresh readonly eligibility for existing one-use private startup."""
    require(_state['waiting'], 'MAINTENANCE_UNKNOWN_NO_REPLAY')
    try:
        _continuity(io, time.monotonic() + 10)
        payload = _payload()
        _waiting_receipt(payload)
        _verify(payload)
        _state['waiting'] = False  # One handoff, no repeated eligibility.
    except BaseException:
        _state['waiting'] = False
        io._unknown = True
        raise
