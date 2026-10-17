"""Accepted49b fixed E35 retirement. Owned candidate; not deployable
until actual post-recovery pins are generated, sealed and independently reviewed.
No RuntimeBase permission mutation; no public CLI or caller-selected paths.
"""
import base64, datetime, http.client, io, pwd, subprocess, types
from pathlib import Path
from zoneinfo import ZoneInfo
import contextlib, ctypes, errno, fcntl, hashlib, json, math, os, re, stat, sys, time

_ROOT_UID=0

_LOCK_GID=80

_AUDIT_GID=0

APPROVAL_REF='OWNER-B7-RELEASE-20261016-01'

OPERATION='b7-packet-r34-1cfeff2a5b138629-e35'

TRANSACTION='tx-c0fd42f71e074eeb8f0e9902e1a3e084'

PLAN_SHA256='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'

FIXED_MATERIALS=(('/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', 'migration-transaction.e35-aborted-c0fd42f7.json'), ('/private/var/db/agent-core/authsvc-codex-migration/b7-preparation-input.json', 'b7-preparation-input.e35-aborted-c0fd42f7.json'), ('/private/var/db/agent-core/authsvc-codex-migration/migration-fence.json', 'migration-fence.e35-aborted-c0fd42f7.json'), ('/usr/local/share/agent-core/artifacts', 'artifacts.e35-aborted-c0fd42f7'), ('/private/var/db/agent-core/authsvc-codex-migration/activation-code-input', 'activation-code-input.e35-aborted-c0fd42f7'))

class Refused(RuntimeError):
    pass

def need(value, reason):
    if not value:
        raise Refused(reason)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()

def component(name):
    need(type(name) is str and name not in ('', '.', '..') and
         '/' not in name and chr(0) not in name, 'FIXED_COMPONENT_REQUIRED')

def stable(s):
    return (s.st_dev, s.st_ino, s.st_uid, s.st_gid, s.st_mode,
            s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)

def custody(s):
    return (s.st_dev, s.st_ino, s.st_uid, s.st_gid, s.st_mode)

def row(s):
    kind = ('Regular File' if stat.S_ISREG(s.st_mode) else
            'Directory' if stat.S_ISDIR(s.st_mode) else
            'Symbolic Link' if stat.S_ISLNK(s.st_mode) else None)
    need(kind is not None, 'MATERIAL_SPECIAL_OBJECT')
    return dict(type=kind, uid=s.st_uid, gid=s.st_gid,
                mode=format(s.st_mode, 'o'), nlink=s.st_nlink,
                bytes=s.st_size, dev=s.st_dev, inode=s.st_ino,
                mtime=int(s.st_mtime), ctime=int(s.st_ctime))

def open_leaf(parent, name):
    component(name)
    before = os.stat(name, dir_fd=parent, follow_symlinks=False)
    need(stat.S_ISREG(before.st_mode) or stat.S_ISDIR(before.st_mode),
         'MATERIAL_ROOT_TYPE')
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
    if stat.S_ISDIR(before.st_mode):
        flags |= os.O_DIRECTORY
    fd = os.open(name, flags, dir_fd=parent)
    try:
        need(stable(os.fstat(fd)) == stable(before) == stable(os.stat(
            name, dir_fd=parent, follow_symlinks=False)), 'MATERIAL_OPEN_CHANGED')
        return fd
    except BaseException:
        os.close(fd)
        raise

def same_entry(fd, parent, name):
    need(stable(os.fstat(fd)) == stable(os.stat(
        name, dir_fd=parent, follow_symlinks=False)), 'MATERIAL_ENTRY_CHANGED')

def manifest_fd(fd, sync=False, lease_current=lambda: None):
    """Exact typed/inode/custody/byte tree, no symlink traversal.

    Only root ctime is omitted from lineage SHA because our EXCL rename changes
    it. Source pre-rename ctime is separately compared by check_material.
    The read protocol matches the already frozen actual system metadata rows.
    """
    root = os.fstat(fd)
    need(stat.S_ISREG(root.st_mode) or stat.S_ISDIR(root.st_mode), 'MATERIAL_ROOT_TYPE')
    entries, regular_files, regular_bytes = [], 0, 0

    def walk(leaf, relative):
        nonlocal regular_files, regular_bytes
        before = os.fstat(leaf)
        need(before.st_dev == root.st_dev, 'MATERIAL_DEVICE_CHANGED')
        data = row(before)
        if stat.S_ISREG(before.st_mode):
            need(before.st_nlink == 1 and 0 <= before.st_size <= 2 * 1024**3,
                 'MATERIAL_FILE_SCOPE')
            digest, offset = hashlib.sha256(), 0
            while True:
                block = os.pread(leaf, 1024 * 1024, offset)
                if not block:
                    break
                offset += len(block)
                need(offset <= before.st_size, 'MATERIAL_SIZE_CHANGED')
                digest.update(block)
            need(offset == before.st_size, 'MATERIAL_SHORT_READ')
            data['sha256'] = digest.hexdigest()
            regular_files += 1
            regular_bytes += offset
            need(regular_bytes <= 2 * 1024**3, 'MATERIAL_BYTES_LIMIT')
        else:
            names = sorted(os.listdir(leaf))
            for name in names:
                component(name)
                meta = os.stat(name, dir_fd=leaf, follow_symlinks=False)
                need(meta.st_dev == root.st_dev, 'MATERIAL_DEVICE_CHANGED')
                child_relative = ('' if relative == '.' else relative) + '/' + name
                if stat.S_ISLNK(meta.st_mode):
                    link_row = row(meta)
                    link_row['target'] = os.readlink(name, dir_fd=leaf)
                    need(stable(meta) == stable(os.stat(name, dir_fd=leaf,
                         follow_symlinks=False)), 'MATERIAL_SYMLINK_CHANGED')
                    entries.append([child_relative, link_row])
                else:
                    child = open_leaf(leaf, name)
                    try:
                        walk(child, child_relative)
                        same_entry(child, leaf, name)
                    finally:
                        os.close(child)
                need(len(entries) <= 110000, 'MATERIAL_ENTRY_LIMIT')
            need(names == sorted(os.listdir(leaf)), 'MATERIAL_NAMES_CHANGED')
        need(stable(before) == stable(os.fstat(leaf)), 'MATERIAL_READ_CHANGED')
        entries.append([relative, data])
        if sync:
            lease_current()
            os.fsync(leaf)
            need(stable(before) == stable(os.fstat(leaf)), 'MATERIAL_SYNC_CHANGED')

    walk(fd, '.')
    exact = row(root)
    normalized = []
    for relative, data in entries:
        item = dict(data)
        if relative == '.':
            item.pop('ctime')
        normalized.append([relative, item])
    return dict(root=exact, members=len(entries), regular_files=regular_files,
                regular_bytes=regular_bytes,
                lineage_sha256=hashlib.sha256(canonical(sorted(normalized))).hexdigest())

def manifest_at(parent, name):
    fd = open_leaf(parent, name)
    try:
        result = manifest_fd(fd)
        same_entry(fd, parent, name)
        return result
    finally:
        os.close(fd)

def check_material(fd, parent, name, expected, original, sync=False,
                   lease_current=lambda: None):
    actual = manifest_fd(fd, sync=sync, lease_current=lease_current)
    need(all(actual[key] == expected[key] for key in
             ('members', 'regular_files', 'regular_bytes', 'lineage_sha256')),
         'MATERIAL_MANIFEST_MISMATCH')
    if original:
        need(actual['root']['ctime'] == expected['root']['ctime'],
             'MATERIAL_ORIGINAL_CTIME_CHANGED')
    same_entry(fd, parent, name)
    return actual

def rename_exclusive(parent, source, destination):
    component(source)
    component(destination)
    need(source != destination and sys.platform == 'darwin', 'ATOMIC_NOREPLACE_UNSUPPORTED')
    libc = ctypes.CDLL(None, use_errno=True)
    primitive = getattr(libc, 'renameatx_np', None)
    need(primitive is not None, 'ATOMIC_NOREPLACE_UNSUPPORTED')
    primitive.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int,
                          ctypes.c_char_p, ctypes.c_uint)
    primitive.restype = ctypes.c_int
    # Same original platform primitive, macOS SDK RENAME_EXCL=0x4. No fallback.
    if primitive(parent, os.fsencode(source), parent, os.fsencode(destination), 0x4):
        number = ctypes.get_errno()
        raise OSError(number, os.strerror(number))

def exists_at(parent, name):
    try:
        os.stat(name, dir_fd=parent, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False

def preserve_one(parent, source, history, expected, lease_current, before_effect=None):
    """One exact no-replacement transition; uncertainty leaves actual namespace.

    Caller has admitted the fixed subject/full scene and continuously owns both
    original leases. This internal routine neither acquires/releases leases nor
    reads a live DS STATUS. No finally cleanup or history rewrite is permitted.
    """
    component(source)
    component(history)
    need(source != history, 'DISTINCT_FIXED_NAMES_REQUIRED')
    parent_pin = custody(os.fstat(parent))
    need(stat.S_ISDIR(parent_pin[4]), 'MATERIAL_PARENT_TYPE')

    def fresh():
        lease_current()
        need(custody(os.fstat(parent)) == parent_pin, 'MATERIAL_PARENT_CHANGED')

    fresh()
    original, retained = exists_at(parent, source), exists_at(parent, history)
    need(original != retained, 'MATERIAL_SOURCE_HISTORY_AMBIGUOUS')
    name = source if original else history
    fd = open_leaf(parent, name)
    try:
        check_material(fd, parent, name, expected, original)
        fresh()
        check_material(fd, parent, name, expected, original,
                       sync=True, lease_current=fresh)
        fresh()
        same_entry(fd, parent, name)
        if original:
            if before_effect is not None:
                before_effect()
            fresh()
            same_entry(fd, parent, name)
            rename_exclusive(parent, source, history)
            need(not exists_at(parent, source), 'MATERIAL_SOURCE_STILL_PRESENT')
        same_entry(fd, parent, history)
        check_material(fd, parent, history, expected, False)
        fresh()
        os.fsync(fd)
        fresh()
        os.fsync(parent)
        same_entry(fd, parent, history)
        check_material(fd, parent, history, expected, False)
        fresh()
        return 'MOVED' if original else 'HISTORY_SYNCED'
    finally:
        os.close(fd)

def strict_json(raw):
    def finite(number):
        value = float(number)
        need(math.isfinite(value), 'INVALID_JSON_NUMBER')
        return value
    def unique(pairs):
        value = {}
        for key, item in pairs:
            need(key not in value, 'DUPLICATE_JSON_FIELD')
            value[key] = item
        return value
    try:
        return json.loads(raw, object_pairs_hook=unique, parse_float=finite,
            parse_constant=lambda _: need(False, 'INVALID_JSON_CONSTANT'))
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise Refused('INVALID_JSON') from exc

def strict_payload(value):
    def check(item, depth=0):
        need(depth <= 64, 'AUDIT_PAYLOAD_DEPTH')
        if type(item) is dict:
            need(all(type(k) is str for k in item), 'AUDIT_PAYLOAD_JSON_KEY')
            for child in item.values():
                check(child, depth + 1)
        elif type(item) is list:
            for child in item:
                check(child, depth + 1)
        else:
            need(type(item) in (str, int, float, bool, type(None)), 'AUDIT_PAYLOAD_JSON_TYPE')
            need(type(item) is not float or math.isfinite(item), 'AUDIT_PAYLOAD_JSON_NUMBER')
    check(value)
    return canonical(value)

class AuditTrail:
    """Exactly four finite outcomes in the ORIGINAL executor receipt stream.

    No file creation, rotation, truncation or other record schema. The fixed
    caller supplies already protected existing FDs; all writes append the old
    five-field shape, under its original file flock and mutation lease.
    """
    name = 'receipts.jsonl'
    outcomes = ('FIXED_E35_INTENT', 'FIXED_E35_ADMITTED',
                'FIXED_E35_MATERIALS_DURABLE', 'FIXED_E35_FINISHED')

    def __init__(self, fd, parent, lease_current):
        self.fd, self.parent, self.lease_current = fd, parent, lease_current
        self.parent_pin = custody(os.fstat(parent))
        self.file_pin = custody(os.fstat(fd))
        self.verify()

    def verify(self):
        s, parent = os.fstat(self.fd), os.fstat(self.parent)
        need(stat.S_ISDIR(parent.st_mode) and
             (parent.st_uid, parent.st_gid, stat.S_IMODE(parent.st_mode)) == (_ROOT_UID, _AUDIT_GID, 0o700)
             and custody(parent) == self.parent_pin, 'AUDIT_PARENT_CUSTODY')
        need(stat.S_ISREG(s.st_mode) and
             (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode), s.st_nlink) == (_ROOT_UID, _AUDIT_GID, 0o644, 1)
             and custody(s) == self.file_pin and 0 <= s.st_size <= 64 * 1024 * 1024,
             'AUDIT_FILE_CUSTODY')
        flags = fcntl.fcntl(self.fd, fcntl.F_GETFL)
        need(flags & os.O_APPEND and flags & os.O_ACCMODE == os.O_RDWR,
             'AUDIT_APPEND_FD_REQUIRED')
        same_entry(self.fd, self.parent, self.name)

    @contextlib.contextmanager
    def locked(self):
        fcntl.flock(self.fd, fcntl.LOCK_EX)
        try:
            self.verify()
            yield
        finally:
            fcntl.flock(self.fd, fcntl.LOCK_UN)

    def records_locked(self):
        self.verify()
        before = os.fstat(self.fd)
        chunks, offset = [], 0
        while offset < before.st_size:
            block = os.pread(self.fd, min(1024 * 1024, before.st_size - offset), offset)
            need(bool(block), 'AUDIT_SHORT_READ')
            chunks.append(block)
            offset += len(block)
        need(stable(before) == stable(os.fstat(self.fd)), 'AUDIT_READ_CHANGED')
        self.verify()
        raw = b''.join(chunks)
        need(not raw or raw.endswith(b'\n'), 'AUDIT_PARTIAL_HISTORY_RETAINED')
        own = []
        for line in raw.splitlines(keepends=True):
            need(0 < len(line) <= 65536, 'AUDIT_ROW_SIZE')
            outer = strict_json(line)
            need(type(outer) is dict and set(outer) ==
                 {'ts', 'approval_ref', 'operation', 'outcome', 'detail'} and
                 all(type(v) is str for v in outer.values()), 'AUDIT_EXISTING_ROW_SHAPE')
            if not outer['outcome'].startswith('FIXED_E35_'):
                continue
            need(outer['outcome'] in self.outcomes and
                 outer['approval_ref'] == APPROVAL_REF and outer['operation'] == 'e35-retire',
                 'AUDIT_FIXED_OPERATION_BINDING')
            detail = strict_json(outer['detail'])
            need(type(detail) is dict and set(detail) ==
                 {'plan_sha256', 'operation_id', 'tx_id', 'payload'} and
                 detail['plan_sha256'] == PLAN_SHA256 and detail['operation_id'] == OPERATION and
                 detail['tx_id'] == TRANSACTION and type(detail['payload']) is dict,
                 'AUDIT_FIXED_SUBJECT_BINDING')
            own.append(dict(row_sha256=hashlib.sha256(line).hexdigest(),
                            outcome=outer['outcome'], payload=detail['payload']))
        need(tuple(r['outcome'] for r in own) == self.outcomes[:len(own)] and
             len(own) <= len(self.outcomes), 'AUDIT_FIXED_PHASE_HISTORY_AMBIGUOUS')
        return own

    def find(self, outcome):
        need(outcome in self.outcomes, 'AUDIT_FIXED_OUTCOME_REQUIRED')
        with self.locked():
            return next((r for r in self.records_locked() if r['outcome'] == outcome), None)

    def append_once(self, outcome, payload):
        need(outcome in self.outcomes and type(payload) is dict, 'AUDIT_FIXED_OUTCOME_REQUIRED')
        payload_bytes = strict_payload(payload)
        with self.locked():
            records = self.records_locked()
            existing = next((r for r in records if r['outcome'] == outcome), None)
            if existing is not None:
                need(strict_payload(existing['payload']) == payload_bytes, 'AUDIT_FIXED_ROW_PAYLOAD_CHANGED')
                result = existing
            else:
                need(len(records) < len(self.outcomes) and outcome == self.outcomes[len(records)],
                     'AUDIT_FIXED_PHASE_ORDER')
                detail = canonical(dict(plan_sha256=PLAN_SHA256, operation_id=OPERATION,
                                        tx_id=TRANSACTION, payload=payload)).decode()
                body = (json.dumps(dict(ts=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    approval_ref=APPROVAL_REF, operation='e35-retire', outcome=outcome,
                    detail=detail), sort_keys=True) + '\n').encode()
                need(len(body) <= 65536, 'AUDIT_ROW_SIZE')
                before = os.fstat(self.fd).st_size
                offset = 0
                while offset < len(body):
                    self.lease_current()
                    self.verify()
                    try:
                        count = os.write(self.fd, body[offset:])
                    except InterruptedError:
                        continue
                    need(count > 0, 'AUDIT_INCOMPLETE_WRITE')
                    offset += count
                self.verify()
                need(os.fstat(self.fd).st_size == before + len(body) and
                     os.pread(self.fd, len(body), before) == body, 'AUDIT_APPEND_READBACK')
                result = dict(row_sha256=hashlib.sha256(body).hexdigest(),
                              outcome=outcome, payload=payload)
            for fd in (self.fd, self.parent):
                self.lease_current()
                self.verify()
                os.fsync(fd)
            self.verify()
            return result

class MaintenanceReservation:
    """One distinguishable finite lease in the ORIGINAL native namespace.

    Parent/INTENT/ADMITTED/durable row authenticity is established by the fixed
    root caller, not by CLI input. This class creates only its new own objects,
    never recreates or removes an old native holder, and closes FDs on failure
    without unlinking. Empty gaps require actual durable recorded inode proof.
    """
    name = 'production-deploy.lock'

    def __init__(self, parent, intent, admitted, lease_current):
        need(type(intent) is dict and set(intent) == {'nonce', 'row_sha256'} and
             type(intent['nonce']) is str and re.fullmatch('[a-f0-9]{32}', intent['nonce']) and
             type(intent['row_sha256']) is str and re.fullmatch('[a-f0-9]{64}', intent['row_sha256']),
             'RESERVATION_INTENT_BINDING')
        self.parent, self.intent, self.admission = parent, dict(intent), admitted
        self.lease_current = lease_current
        self.parent_pin = custody(os.fstat(parent))
        self.directory_fd = self.holder_fd = None
        self.directory_pin = None
        self.retired = False
        self.body = canonical(dict(kind='B7_E35_TERMINAL_MATERIAL_RESERVATION_V1',
            operation_id=OPERATION, tx_id=TRANSACTION, plan_sha256=PLAN_SHA256,
            intent_nonce=intent['nonce'], intent_row_sha256=intent['row_sha256'])) + b'\n'

    def fresh(self):
        self.lease_current()
        need(custody(os.fstat(self.parent)) == self.parent_pin,
             'RESERVATION_PARENT_CHANGED')

    @staticmethod
    def directory_proof(s):
        return [s.st_dev, s.st_ino, s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode)]

    def directory_current(self):
        need(self.directory_fd is not None, 'NO_RESERVATION_DIRECTORY')
        s = os.fstat(self.directory_fd)
        need(stat.S_ISDIR(s.st_mode) and
             (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode)) == (_ROOT_UID, _LOCK_GID, 0o700),
             'RESERVATION_DIRECTORY_CUSTODY')
        same_entry(self.directory_fd, self.parent, self.name)
        need(self.directory_proof(s) == self.directory_pin,
             'RESERVATION_DIRECTORY_CHANGED')
        return s

    def proof(self):
        directory = self.directory_current()
        holder = os.fstat(self.holder_fd)
        return dict(intent_nonce=self.intent['nonce'], intent_row_sha256=self.intent['row_sha256'],
                    directory=self.directory_proof(directory),
                    holder=[holder.st_dev, holder.st_ino, holder.st_uid, holder.st_gid,
                            stat.S_IMODE(holder.st_mode), holder.st_nlink, holder.st_size],
                    holder_sha256=hashlib.sha256(self.body).hexdigest())

    def verify(self):
        self.fresh()
        self.directory_current()
        need(sorted(os.listdir(self.directory_fd)) == ['holder'], 'RESERVATION_EXTRA_ENTRY')
        need(self.holder_fd is not None, 'NO_RESERVATION_HOLDER')
        s = os.fstat(self.holder_fd)
        need(stat.S_ISREG(s.st_mode) and
             (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode), s.st_nlink) == (_ROOT_UID, _LOCK_GID, 0o600, 1)
             and s.st_size == len(self.body), 'RESERVATION_HOLDER_CUSTODY')
        same_entry(self.holder_fd, self.directory_fd, 'holder')
        need(os.pread(self.holder_fd, len(self.body) + 1, 0) == self.body,
             'RESERVATION_HOLDER_BINDING')
        # An independent OFD must fail while this lease is exclusively held.
        other = os.open('holder', os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK,
                        dir_fd=self.directory_fd)
        try:
            try:
                fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                pass
            else:
                fcntl.flock(other, fcntl.LOCK_UN)
                raise Refused('RESERVATION_OFD_NOT_HELD')
        finally:
            os.close(other)
        if self.admission is not None:
            need(self.proof() == self.admission, 'RESERVATION_ADMITTED_IDENTITY_CHANGED')

    def acquire(self, record_admitted):
        self.fresh()
        present = exists_at(self.parent, self.name)
        if not present:
            need(self.admission is None, 'PRIOR_RESERVATION_DISAPPEARED')
            os.mkdir(self.name, 0o700, dir_fd=self.parent)
        self.directory_fd = open_leaf(self.parent, self.name)
        if not present:
            self.fresh()
            os.fchown(self.directory_fd, _ROOT_UID, _LOCK_GID)
            self.fresh()
            os.fchmod(self.directory_fd, 0o700)
        ds = os.fstat(self.directory_fd)
        self.directory_pin = self.directory_proof(ds)
        self.directory_current()
        if present:
            need(sorted(os.listdir(self.directory_fd)) == ['holder'],
                 'UNKNOWN_PREEXISTING_RESERVATION')
            self.holder_fd = os.open('holder', os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK,
                                     dir_fd=self.directory_fd)
            s = os.fstat(self.holder_fd)
            need(stat.S_ISREG(s.st_mode) and
                 (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode), s.st_nlink) == (_ROOT_UID, _LOCK_GID, 0o600, 1)
                 and s.st_size == len(self.body) and
                 os.pread(self.holder_fd, len(self.body) + 1, 0) == self.body,
                 'UNKNOWN_PREEXISTING_RESERVATION')
            same_entry(self.holder_fd, self.directory_fd, 'holder')
            fcntl.flock(self.holder_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        else:
            self.fresh()
            self.holder_fd = os.open('holder', os.O_RDWR | os.O_CREAT | os.O_EXCL |
                                     os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=self.directory_fd)
            fcntl.flock(self.holder_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.fresh()
            os.fchown(self.holder_fd, _ROOT_UID, _LOCK_GID)
            self.fresh()
            os.fchmod(self.holder_fd, 0o600)
            offset = 0
            while offset < len(self.body):
                self.fresh()
                try:
                    count = os.write(self.holder_fd, self.body[offset:])
                except InterruptedError:
                    continue
                need(count > 0, 'RESERVATION_SHORT_WRITE')
                offset += count
        self.verify()
        for fd in (self.holder_fd, self.directory_fd, self.parent):
            self.fresh()
            os.fsync(fd)
        self.verify()
        actual = self.proof()
        if self.admission is None:
            # Caller appends/fsyncs this in original executor receipts before
            # it permits any base-mode or material namespace effect.
            record_admitted(actual)
            self.admission = actual
        need(actual == self.admission, 'RESERVATION_ADMISSION_MISMATCH')
        return actual

    def retire(self, durable):
        need(self.admission is not None and type(durable) is dict and
             durable.get('outcome') == 'FIXED_E35_MATERIALS_DURABLE' and
             type(durable.get('row_sha256')) is str and
             re.fullmatch('[a-f0-9]{64}', durable['row_sha256']) and
             durable.get('reservation') == self.admission and
             self.admission.get('intent_nonce') == self.intent['nonce'] and
             self.admission.get('intent_row_sha256') == self.intent['row_sha256'],
             'MATERIALS_DURABLE_PROOF_REQUIRED')
        self.fresh()
        if exists_at(self.parent, self.name):
            if self.directory_fd is None:
                self.directory_fd = open_leaf(self.parent, self.name)
                self.directory_pin = self.directory_proof(os.fstat(self.directory_fd))
            self.directory_current()
            need(self.directory_pin == self.admission['directory'],
                 'FOREIGN_RESERVATION_EXIT_FORBIDDEN')
            names = sorted(os.listdir(self.directory_fd))
            need(names in ([], ['holder']), 'RESERVATION_EXTRA_ENTRY')
            if names:
                if self.holder_fd is None:
                    # Reacquire only the same fully proven own holder. No new
                    # acquisition/nonce or business operation is performed.
                    os.close(self.directory_fd)
                    self.directory_fd = None
                    self.acquire(lambda _: (_ for _ in ()).throw(Refused('PERSISTENT_ADMISSION_REQUIRED')))
                self.verify()
                self.fresh()
                os.unlink('holder', dir_fd=self.directory_fd)
            self.fresh()
            need(not os.listdir(self.directory_fd), 'RESERVATION_NOT_EMPTY')
            same_entry(self.directory_fd, self.parent, self.name)
            os.fsync(self.directory_fd)
            self.fresh()
            os.rmdir(self.name, dir_fd=self.parent)
        self.fresh()
        os.fsync(self.parent)
        need(not exists_at(self.parent, self.name), 'RESERVATION_EXIT_READBACK_UNCERTAIN')
        self.retired = True

    def close(self):
        # Never an automatic namespace cleanup. On any failed/unknown phase,
        # retain the protected holder/dir and exact intent/admission evidence.
        for attr in ('holder_fd', 'directory_fd'):
            fd = getattr(self, attr)
            if fd is not None:
                os.close(fd)
                setattr(self, attr, None)

_METADATA_LIBC = None

def metadata_libc():
    global _METADATA_LIBC
    need(sys.platform == 'darwin', 'METADATA_PLATFORM_UNSUPPORTED')
    if _METADATA_LIBC is None:
        lib = ctypes.CDLL(None, use_errno=True)
        # Actual installed SDK sys/xattr.h and sys/acl.h prototypes. Unlike
        # pathname probes, these calls bind to the already held base FD.
        lib.flistxattr.argtypes = (ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int)
        lib.flistxattr.restype = ctypes.c_ssize_t
        lib.fgetxattr.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_void_p,
                                 ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int)
        lib.fgetxattr.restype = ctypes.c_ssize_t
        lib.acl_get_fd_np.argtypes = (ctypes.c_int, ctypes.c_int)
        lib.acl_get_fd_np.restype = ctypes.c_void_p
        lib.acl_to_text.argtypes = (ctypes.c_void_p, ctypes.POINTER(ctypes.c_ssize_t))
        lib.acl_to_text.restype = ctypes.c_void_p
        lib.acl_free.argtypes = (ctypes.c_void_p,)
        lib.acl_free.restype = ctypes.c_int
        _METADATA_LIBC = lib
    return _METADATA_LIBC

def metadata_fd(fd):
    before = os.fstat(fd)
    need(stat.S_ISDIR(before.st_mode) and before.st_nlink >= 1, 'BASE_DIRECTORY_REQUIRED')
    lib = metadata_libc()

    def checked(result):
        if result < 0:
            number = ctypes.get_errno()
            raise OSError(number, os.strerror(number))
        need(result <= 65536, 'BASE_METADATA_SIZE_BOUND')
        return result

    def names():
        size = checked(lib.flistxattr(fd, None, 0, 0))
        buf = ctypes.create_string_buffer(max(1, size))
        got = checked(lib.flistxattr(fd, buf, size, 0))
        need(got == size, 'BASE_XATTR_LIST_CHANGED')
        raw = ctypes.string_at(buf, got)
        need(not raw or raw.endswith(b'\0'), 'BASE_XATTR_ENCODING')
        parts = raw[:-1].split(b'\0') if raw else []
        need(all(parts) and len(parts) == len(set(parts)) if raw else True, 'BASE_XATTR_NAMES')
        return sorted(parts)

    original_names = names()
    attributes = {}
    for name in original_names:
        size = checked(lib.fgetxattr(fd, name, None, 0, 0, 0))
        buf = ctypes.create_string_buffer(max(1, size))
        got = checked(lib.fgetxattr(fd, name, buf, size, 0, 0))
        need(got == size, 'BASE_XATTR_VALUE_CHANGED')
        value = ctypes.string_at(buf, got)
        attributes[name.decode('utf-8')] = dict(bytes=got, sha256=hashlib.sha256(value).hexdigest())
    need(names() == original_names, 'BASE_XATTR_NAMES_CHANGED')
    ctypes.set_errno(0)
    acl = lib.acl_get_fd_np(fd, 0x100)  # ACL_TYPE_EXTENDED, actual macOS SDK.
    acl_text = b''
    if acl:
        text = None
        try:
            length = ctypes.c_ssize_t()
            text = lib.acl_to_text(acl, ctypes.byref(length))
            need(bool(text) and 0 <= length.value <= 65536, 'BASE_ACL_READ')
            acl_text = ctypes.string_at(text, length.value).rstrip(b'\0')
        finally:
            if text:
                lib.acl_free(text)
            lib.acl_free(acl)
    else:
        # macOS returns ENOENT for no extended ACL on an existing held FD.
        # Any unsupported, denied, or invalid FD error stays UNKNOWN/refused.
        number = ctypes.get_errno()
        need(number in (errno.ENOENT, getattr(errno, 'ENOATTR', 93)), 'BASE_ACL_UNAVAILABLE')
    entries = sorted(os.listdir(fd))
    need(stable(before) == stable(os.fstat(fd)), 'BASE_METADATA_CHANGED')
    return dict(device=before.st_dev, inode=before.st_ino, uid=before.st_uid,
                gid=before.st_gid, mode=stat.S_IMODE(before.st_mode),
                nlink=before.st_nlink, bytes=before.st_size,
                mtime_ns=before.st_mtime_ns, ctime_ns=before.st_ctime_ns,
                flags=before.st_flags, xattrs=attributes,
                acl_empty=acl_text.strip() in (b'', b'!#acl 1'),
                acl_sha256=hashlib.sha256(acl_text).hexdigest(),
                names_sha256=hashlib.sha256(canonical(entries)).hexdigest())

_PATH_ROOT = '/'

_STATE_ROOT = '/private/var/db/agent-deploy-system'

_MIGRATION = '/private/var/db/agent-core/authsvc-codex-migration'

_NATIVE_PARENT = '/usr/local/var/agent-core/production-mutation-locks'

_NODE = '/usr/local/libexec/agent-core/node-runtime/bin/node'

_AUDIT = '/private/var/db/agent-deploy-system-config/b7-release-executor.receipts/receipts.jsonl'

_NODE_ANCESTORS = {
    '/usr/local/libexec/agent-core/node-runtime': (16777233,132682817,505,601,0o755),
    '/usr/local/libexec/agent-core/node-runtime/bin': (16777233,132682820,505,601,0o755),
}

_SERVICE_ANCESTORS = {
    '/Users/authsvc': (16777233, 37633129, 0, 80, 0o755),
    '/Users/authsvc/.agent-core': (16777233, 39136979, 505, 601, 0o711),
    '/Users/authsvc/.agent-core/control': (16777233, 39136984, 505, 601, 0o700),
}

class FixedPath:
    """Held nofollow ancestors with only the preexisting, exact exceptions."""
    def __init__(self, path):
        self.path, self.fds, self.trace = path, [], []
        self.service_metadata = {}

    @staticmethod
    def service_signature(fd):
        value = metadata_fd(fd)
        need(value['acl_empty'] and value['flags'] == 0, 'FIXED_SERVICE_ANCESTOR_METADATA')
        return {k:value[k] for k in ('device','inode','uid','gid','mode','flags',
                                    'acl_empty','acl_sha256','xattrs')}

    def directory(self, meta, path):
        need(stat.S_ISDIR(meta.st_mode), 'FIXED_ANCESTOR_DIRECTORY')
        actual = (meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid, stat.S_IMODE(meta.st_mode))
        if path in _SERVICE_ANCESTORS:
            need(actual == _SERVICE_ANCESTORS[path] and meta.st_flags == 0,
                 'FIXED_SERVICE_ANCESTOR')
        elif self.path == _NODE and path in _NODE_ANCESTORS:
            # Original fixed installed-Node reader principal profile, narrowed
            # to its two fresh-read actual service-owned parent identities.
            need(actual == _NODE_ANCESTORS[path], 'FIXED_NODE_ANCESTOR')
        else:
            need(meta.st_uid == _ROOT_UID, 'FIXED_ANCESTOR_OWNER')
            if path == _STATE_ROOT:
                need((meta.st_gid, stat.S_IMODE(meta.st_mode)) == (_LOCK_GID, 0o770),
                     'ORIGINAL_STATE_ROOT_CUSTODY')
            else:
                need(not meta.st_mode & 0o022, 'FIXED_ANCESTOR_WRITABLE')

    def __enter__(self):
        try:
            need(type(self.path) is str and chr(0) not in self.path and
                 os.path.isabs(self.path) and os.path.normpath(self.path) == self.path and
                 os.path.commonpath((_PATH_ROOT, self.path)) == _PATH_ROOT and
                 self.path != _PATH_ROOT, 'FIXED_ABSOLUTE_PATH')
            parent = os.open(_PATH_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            self.fds.append(parent)
            self.root_pin = custody(os.fstat(parent))
            self.directory(os.fstat(parent), _PATH_ROOT)
            path = _PATH_ROOT
            parts = os.path.relpath(self.path, _PATH_ROOT).split('/')
            for name in parts[:-1]:
                component(name)
                path = os.path.join(path, name)
                before = os.stat(name, dir_fd=parent, follow_symlinks=False)
                self.directory(before, path)
                child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
                self.fds.append(child)
                need(stable(before) == stable(os.fstat(child)), 'FIXED_ANCESTOR_OPEN_DRIFT')
                self.trace.append((parent, name, child, custody(before), path))
                if path in _SERVICE_ANCESTORS:
                    self.service_metadata[path] = self.service_signature(child)
                parent = child
            self.parent, self.name = parent, parts[-1]
            component(self.name)
            self.verify()
            return self
        except BaseException:
            self.close()
            raise

    def verify(self):
        need(custody(os.fstat(self.fds[0])) == self.root_pin, 'FIXED_ROOT_CHANGED')
        for parent, name, fd, pin, path in self.trace:
            current = os.fstat(fd)
            self.directory(current, path)
            need(pin == custody(current) == custody(os.stat(name, dir_fd=parent,
                 follow_symlinks=False)), 'FIXED_ANCESTOR_CHANGED')
            if path in _SERVICE_ANCESTORS:
                need(strict_payload(self.service_signature(fd)) == strict_payload(self.service_metadata[path]),
                     'FIXED_SERVICE_ANCESTOR_METADATA_CHANGED')

    def close(self):
        for fd in reversed(self.fds):
            os.close(fd)
        self.fds.clear()

    def __exit__(self, typ, value, tb):
        self.close()

def _raw_fd(fd, limit):
    before = os.fstat(fd)
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
         0 < before.st_size <= limit, 'FIXED_REGULAR_BOUND')
    result, offset = [], 0
    while offset < before.st_size:
        block = os.pread(fd, min(65536, before.st_size - offset), offset)
        need(bool(block), 'FIXED_SHORT_READ')
        result.append(block)
        offset += len(block)
    need(stable(before) == stable(os.fstat(fd)), 'FIXED_READ_DRIFT')
    return b''.join(result)

_RUNTIME_TARGET = 'system/ai.agent-core.runtime'

_RUNTIME_PLIST = '/Library/LaunchDaemons/ai.agent-core.runtime.plist'

_RUNTIME_ROOT = '/usr/local/libexec/agent-core'

_RUNTIME_KEYS = ('HOME','DSH_AGENT_PROVIDER','DSH_AGENT_MODEL','DSH_HARNESS_ROOT','DSH_SETTINGS_SOURCE',
                 'DSH_CODEX_PACKAGE_TARBALL','DSH_CODEX_SOURCE_STAMP','DSH_AGENT_CHILD_UID',
                 'DSH_AGENT_CHILD_GID','DSH_AGENT_SPAWN_HELPER')

_RUNTIME_FORBIDDEN = ('NODE_OPTIONS','NODE_PATH','DYLD_INSERT_LIBRARIES','DYLD_LIBRARY_PATH')

_RUNTIME_ENTRIES = ('app/scripts/production-runtime.mjs','app/packages/production-runtime/src/entry.js',
    'app/packages/production-runtime/src/compose.js','app/packages/production-runtime/src/model-overrides.js',
    'app/packages/agent-provisioning/src/shared-codex.js')

def _runtime_command(file, args):
    # No user-authored interpreter, scripts, argv or environment. These are the
    # original pre observer's three fixed system read surfaces, not B1/provider.
    valid = (file == '/bin/launchctl' and args == ['print',_RUNTIME_TARGET] or
             file == '/usr/bin/plutil' and args == ['-convert','json','-o','-',_RUNTIME_PLIST] or
             file == '/bin/ps' and len(args)==14 and args[0]=='-p' and
             type(args[1]) is str and re.fullmatch('[1-9][0-9]*',args[1]) and
             args[2:]==['-o','pid=','-o','pgid=','-o','uid=','-o','gid=','-o','lstart=','-o','comm='])
    need(valid,'ORIGINAL_RUNTIME_COMMAND_REFUSED')
    result = subprocess.run([file]+args,stdin=subprocess.DEVNULL,capture_output=True,
        timeout=10,cwd='/',close_fds=True,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'})
    need(result.returncode==0 and not result.stderr and 0<len(result.stdout)<=1024*1024,
         'ORIGINAL_RUNTIME_COMMAND_UNKNOWN')
    try:
        return result.stdout.decode('utf-8')
    except UnicodeError as exc:
        raise Refused('ORIGINAL_RUNTIME_COMMAND_ENCODING') from exc

def _runtime_selected(env):
    need(type(env) is dict,'ORIGINAL_RUNTIME_ENVIRONMENT_SHAPE')
    return {key:env.get(key) for key in _RUNTIME_KEYS}

def _parse_runtime_launchd(text):
    # Faithful fixed subset of frozen cohort-runtime90de parseLaunchd, used by
    # original worker0915 observeRuntime/guardRuntimeRun. Unknown env is omitted.
    stack,fields,arguments,environment,other = [],{},[],{},{}
    for line in text.split('\n'):
        s = line.strip()
        if s.endswith('= {'):
            stack.append(s[:-3].strip());continue
        if s == '}':
            if stack: stack.pop()
            continue
        parent = stack[-1] if stack else None
        if len(stack)==2 and parent=='arguments':
            arguments.append(s)
        elif len(stack)==2 and parent.endswith('environment'):
            match = re.fullmatch(r'([^=]+?)\s*=>\s*(.*)',s)
            if match and match[1].strip() in _RUNTIME_KEYS+_RUNTIME_FORBIDDEN:
                key = match[1].strip()
                target = environment if parent=='environment' else other
                need(key not in target,'ORIGINAL_RUNTIME_DUPLICATE_ENVIRONMENT')
                target[key]=match[2]
        elif len(stack)==1:
            match = re.fullmatch(r'([^=]+?)\s*=\s*(.*)',s)
            if match and match[1].strip() in ('path','program','working directory','username','group','pid','state'):
                fields[match[1].strip()]=match[2]
    need(not stack and fields.get('pid') and arguments,'ORIGINAL_RUNTIME_INCOMPLETE_JOB')
    need(not any(k in other and k not in environment for k in _RUNTIME_KEYS),
         'ORIGINAL_RUNTIME_INHERITED_INPUT_UNPROVEN')
    need(not any(k in environment or k in other for k in _RUNTIME_FORBIDDEN),
         'ORIGINAL_RUNTIME_PRELOAD_ENVIRONMENT')
    need(all(environment.get(k) for k in ('HOME','DSH_AGENT_PROVIDER','DSH_AGENT_MODEL','DSH_HARNESS_ROOT')),
         'ORIGINAL_RUNTIME_EXPLICIT_INPUT_MISSING')
    need(re.fullmatch('[0-9]+',fields['pid']) is not None,'ORIGINAL_RUNTIME_PID_SHAPE')
    return dict(program=fields.get('program'),arguments=arguments,cwd=fields.get('working directory'),
                user=fields.get('username'),group=fields.get('group'),plist=fields.get('path'),
                pid=int(fields['pid']),environment=_runtime_selected(environment))

def _runtime_started(value):
    # /bin/ps under the original LC_ALL=C surface, no process-wide locale edit.
    match=re.fullmatch(r'(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})',value)
    need(match is not None,'ORIGINAL_RUNTIME_START_TIME')
    try:
        month=('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec').index(match[2])+1
        # The original worker has a minimal environment without caller TZ.
        # Interpret its C-locale /bin/ps date in the host default zone too.
        with open('/etc/localtime','rb') as system_zone:
            zone = ZoneInfo.from_file(system_zone)
        return datetime.datetime(int(match[7]),month,int(match[3]),int(match[4]),int(match[5]),int(match[6]),
                                 tzinfo=zone).timestamp()
    except (ValueError,OverflowError,OSError) as exc:
        raise Refused('ORIGINAL_RUNTIME_START_TIME') from exc

"""Finite coordinator source fragment, embedded by the owned builder.
No import or externally supplied scene is a public management entry.
"""
_COMPLETED = None

def _phase_records(trail):
    intent, admitted, durable, finished = [trail.find(k) for k in trail.outcomes]
    hashes={'status_sha256','pins_sha256','checkpoint_sha256','recovery_proof_sha256','runtime_sha256','inventory_sha256'}
    if intent is not None:
        p=intent['payload']
        need(set(p)==hashes|{'nonce'} and type(p['nonce']) is str and re.fullmatch('[a-f0-9]{32}',p['nonce']) and all(type(p[k]) is str and re.fullmatch('[a-f0-9]{64}',p[k]) for k in hashes),'INTENT_FIXED_SCHEMA')
    if admitted is not None:
        p=admitted['payload']
        need(set(p)=={'intent_row_sha256','recovery_proof_sha256','reservation'} and p['intent_row_sha256']==intent['row_sha256'] and p['recovery_proof_sha256']==intent['payload']['recovery_proof_sha256'] and type(p['reservation']) is dict,'ADMITTED_FIXED_BINDING')
        body=canonical(dict(kind='B7_E35_TERMINAL_MATERIAL_RESERVATION_V1',operation_id=OPERATION,tx_id=TRANSACTION,plan_sha256=PLAN_SHA256,intent_nonce=intent['payload']['nonce'],intent_row_sha256=intent['row_sha256']))+b'\n'
        proof=p['reservation']
        need(set(proof)=={'intent_nonce','intent_row_sha256','directory','holder','holder_sha256'} and proof['intent_nonce']==intent['payload']['nonce'] and proof['intent_row_sha256']==intent['row_sha256'] and proof['holder_sha256']==hashlib.sha256(body).hexdigest() and type(proof['directory']) is list and len(proof['directory'])==5 and type(proof['holder']) is list and len(proof['holder'])==7 and all(type(x) is int for x in proof['directory']+proof['holder']) and proof['directory'][2:]==[_ROOT_UID,_LOCK_GID,0o700] and proof['holder'][2:]==[_ROOT_UID,_LOCK_GID,0o600,1,len(body)] and proof['directory'][0]==proof['holder'][0] and all(x>0 for x in proof['directory'][:2]+proof['holder'][:2]),'ADMITTED_RESERVATION_INTENT_PROOF')
    if durable is not None:
        p=durable['payload']
        need(set(p)=={'intent_row_sha256','admitted_row_sha256','recovery_proof_sha256','reservation','history_lineages'} and p['intent_row_sha256']==intent['row_sha256'] and p['admitted_row_sha256']==admitted['row_sha256'] and p['recovery_proof_sha256']==intent['payload']['recovery_proof_sha256'] and strict_payload(p['reservation'])==strict_payload(admitted['payload']['reservation']) and type(p['history_lineages']) is list and len(p['history_lineages'])==5 and all(type(x) is str and re.fullmatch('[a-f0-9]{64}',x) for x in p['history_lineages']),'MATERIALS_DURABLE_FIXED_BINDING')
    if finished is not None:
        p=finished['payload']
        need(type(p.get('checkpoint')) is dict and set(p)=={'intent_row_sha256','materials_row_sha256','reservation','history_lineages','checkpoint'} and strict_payload(p)==strict_payload(_finished_payload(intent,durable,p['checkpoint'])),'FINISHED_FIXED_BINDING')
    return intent,admitted,durable,finished

def _finished_payload(intent,durable,checkpoint):
    return dict(intent_row_sha256=intent['row_sha256'],materials_row_sha256=durable['row_sha256'],reservation=durable['payload']['reservation'],history_lineages=durable['payload']['history_lineages'],checkpoint=checkpoint)

def _retire_fixed(scene):
    global _COMPLETED
    trail=scene.audit
    intent,admitted,durable,finished=_phase_records(trail)
    if intent is not None:scene.bind_intent(intent['payload'])
    if durable is not None:
        # Full history is validated read-only before any record/material fsync.
        lineages=scene.verify_history(sync=False)
        need(lineages==durable['payload']['history_lineages'],'DURABLE_HISTORY_CHANGED')
        known=(finished is not None and _COMPLETED==(intent['row_sha256'],durable['row_sha256'],finished['row_sha256']))
        if finished is not None and not known:
            # Visible FINISHED is not evidence its former parent fsync succeeded.
            # A cold uncertain completion must still satisfy applicable current
            # conditions before we may publish durability; never borrow a lock.
            checkpoint=scene.post_checkpoint()
            need(strict_payload(checkpoint)==strict_payload(finished['payload']['checkpoint']),'COLD_COMPLETION_CHECKPOINT_CHANGED')
        lineages=scene.verify_history(sync=True)
        for previous in (intent,admitted,durable):trail.append_once(previous['outcome'],previous['payload'])
        if finished is not None:
            trail.append_once(finished['outcome'],finished['payload'])
            _COMPLETED=(intent['row_sha256'],durable['row_sha256'],finished['row_sha256'])
            return dict(outcome='FIXED_E35_TERMINAL_MATERIALS_FINISHED',completed_history_only=True,row_sha256=finished['row_sha256'],old_live_status_archive_fallback=False,business_release=False)
        reservation=MaintenanceReservation(scene.native_parent,dict(nonce=intent['payload']['nonce'],row_sha256=intent['row_sha256']),admitted['payload']['reservation'],scene.ds_guard)
        scene.reservation=reservation
    else:
        start=scene.start(None if intent is None else intent['payload'])
        if intent is None:intent=trail.append_once('FIXED_E35_INTENT',dict(start,nonce=os.urandom(16).hex()))
        else:
            need(strict_payload(start)==strict_payload({k:v for k,v in intent['payload'].items() if k!='nonce'}),'ORIGINAL_INTENT_PREIMAGE_CHANGED')
            trail.append_once(intent['outcome'],intent['payload'])
        if admitted is not None:trail.append_once(admitted['outcome'],admitted['payload'])
        reservation=MaintenanceReservation(scene.native_parent,dict(nonce=intent['payload']['nonce'],row_sha256=intent['row_sha256']),None if admitted is None else admitted['payload']['reservation'],scene.ds_guard)
        def record_admitted(proof):
            nonlocal admitted
            scene.reservation=reservation;scene.fresh()
            admitted=trail.append_once('FIXED_E35_ADMITTED',dict(intent_row_sha256=intent['row_sha256'],recovery_proof_sha256=intent['payload']['recovery_proof_sha256'],reservation=proof))
        reservation.acquire(record_admitted);scene.reservation=reservation
        need(admitted is not None,'PERSISTENT_ADMISSION_MISSING');scene.fresh()
        need(len(scene.materials)==5,'FIXED_FIVE_MATERIALS')
        for material in scene.materials:
            scene.fresh()
            preserve_one(material['parent'],material['source'],material['history'],material['expected'],scene.guard,before_effect=scene.fresh)
        scene.fresh();lineages=scene.verify_history(sync=True)
        durable=trail.append_once('FIXED_E35_MATERIALS_DURABLE',dict(intent_row_sha256=intent['row_sha256'],admitted_row_sha256=admitted['row_sha256'],recovery_proof_sha256=intent['payload']['recovery_proof_sha256'],reservation=reservation.proof(),history_lineages=lineages))
    reservation.retire(dict(outcome=durable['outcome'],row_sha256=durable['row_sha256'],reservation=durable['payload']['reservation']))
    scene.reservation=None;reservation.close()
    # Eight-name absence is possible only after this normal own-lease exit.
    checkpoint=scene.post_checkpoint()
    finished=trail.append_once('FIXED_E35_FINISHED',_finished_payload(intent,durable,checkpoint))
    _COMPLETED=(intent['row_sha256'],durable['row_sha256'],finished['row_sha256'])
    return dict(outcome='FIXED_E35_TERMINAL_MATERIALS_FINISHED',completed_history_only=False,row_sha256=finished['row_sha256'],checkpoint=checkpoint,old_live_status_archive_fallback=False,business_release=False)

"""Finite accepted49b fixed caller. Actual post-recovery pins remain unbound.
This fragment is assembled into one sealed module, never imported as a plugin.
"""
_PINS_SHA = None
_CHECKPOINT = '/private/var/db/agent-deploy-system-execution/b7-native-execution-r34-c71fd2cc/b7-wired-stage/checkpoint.py'
_CHECKPOINT_SHA = '4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2'
_JOURNAL_SHA = '81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf'
_REG_SHA = '5bbacce050401210ea3390e9b5b00dbae8e96c9ff4342875f4c66cd5e3cb38df'
_EXEC_SHA = '1d6742519840e0a2a98409b28725eed69f3e2123d27a7382e88029944aea1895'
_WORKER_RELATIVE = 'b7-entry-code/b7-wired-stage/seed-materials.mjs'
_WORKER_SHA = '0915dfe7d2b00f80911acea912cd0ba91ecd36c359042472d0250013e2f827bb'

def _digest(value):
    need(type(value) is str and re.fullmatch('[a-f0-9]{64}',value),'ACTUAL_PIN_REQUIRED')
    return value

class FixedE35Scene:
    def __init__(self,lease_current):
        self.lease_current=lease_current;self.paths=[];self.fds=[];self._path_cache={}
        self.reservation=None;self.materials=[];self.immutable_files=[];self.tools=[];self.tool_relatives=[]
        self._native_parent=None;self.wb=os.path.dirname(os.path.abspath(__file__))
        self.mutex_path=self.path(_STATE_ROOT+'/mutation.lock');self.mutex_fd=self.leaf(self.mutex_path)
        s=os.fstat(self.mutex_fd)
        need((s.st_dev,s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(16777233,102163320,0,80,0o644,1),'ORIGINAL_MUTATION_LOCK_BINDING')
        raw,_=self.bound(self.wb+'/e35-terminal-material-pins.json',_digest(_PINS_SHA),0,0,0o444)
        self.pins=strict_json(raw)
        need(self.pins.get('kind')=='B7_E35_TERMINAL_MATERIAL_RETIREMENT_PINS_V1' and self.pins.get('operation_id')==OPERATION and self.pins.get('tx_id')==TRANSACTION and self.pins.get('accepted_proposal_sha256')==PLAN_SHA256,'FIXED_E35_CONFIG_SUBJECT')
        for name in ('native_sha256','false_fence_sha256','status_sha256','runtime_sha256','recovery_proof_sha256','checkpoint_sha256'):_digest(self.pins[name])
        # These are root-sealed projections of actual completed return/readback,
        # not an assertion reconstructed from visible auth/terminal JSON alone.
        proof=self.pins['completed_recovery_proof']
        need(type(proof) is dict and set(proof)=={'actual_result_sha256','full_readback_sha256','durability_completed'} and proof['durability_completed'] is True,'COMPLETED_RECOVERY_PROOF_REQUIRED')
        _digest(proof['actual_result_sha256']);_digest(proof['full_readback_sha256'])
        self.proof_sha=hashlib.sha256(canonical(proof)).hexdigest()
        need(self.proof_sha==self.pins['recovery_proof_sha256'],'RECOVERY_PROOF_BINDING')
        ap=self.path(_AUDIT);fd=os.open(ap.name,os.O_RDWR|os.O_APPEND|os.O_NOFOLLOW|os.O_NONBLOCK|os.O_CLOEXEC,dir_fd=ap.parent);self.fds.append(fd)
        self.audit=AuditTrail(fd,ap.parent,self.guard);self.ds_guard()

    def path(self,name):
        cache=getattr(self,'_path_cache',{})
        if name in cache:cache[name].verify();return cache[name]
        p=FixedPath(name);p.__enter__();self.paths.append(p);cache[name]=p;self._path_cache=cache;return p
    def absent_fixed(self,name):
        try:p=self.path(name)
        except FileNotFoundError:return
        need(not exists_at(p.parent,p.name),'ORIGINAL_PUBLIC_MANIFEST_OR_LINK_PRESENT')
    def leaf(self,p):
        fd=open_leaf(p.parent,p.name);self.fds.append(fd);return fd
    def bound(self,path,digest,uid,gid,mode,inode=None,size=None,dev=None):
        p=self.path(path);fd=self.leaf(p);s=os.fstat(fd)
        need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(uid,gid,mode,1) and (inode is None or s.st_ino==inode) and (dev is None or s.st_dev==dev) and (size is None or s.st_size==size),'FIXED_FILE_CUSTODY')
        raw=_raw_fd(fd,4*1024*1024);need(hashlib.sha256(raw).hexdigest()==_digest(digest),'FIXED_FILE_BYTES');same_entry(fd,p.parent,p.name)
        self.immutable_files.append((p,fd,digest));return raw,fd
    def descriptor(self,path,want):
        need(type(want) is dict and set(want)=={'sha256','uid','gid','mode','dev','inode','bytes'} and all(type(want[k]) is int for k in ('uid','gid','mode','dev','inode','bytes')),'FIXED_DESCRIPTOR_REQUIRED')
        return self.bound(path,want['sha256'],want['uid'],want['gid'],want['mode'],want['inode'],want['bytes'],want['dev'])
    @property
    def native_parent(self):
        if self._native_parent is None:
            p=self.path(_NATIVE_PARENT+'/production-deploy.lock');s=os.fstat(p.parent)
            need((s.st_dev,s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(16777233,80401185,0,80,0o755),'FIXED_NATIVE_PARENT');self._native_parent=p.parent
        return self._native_parent
    def ds_guard(self):
        self.lease_current()
        for p in self.paths:p.verify()
        same_entry(self.mutex_fd,self.mutex_path.parent,self.mutex_path.name)
        other=os.open(self.mutex_path.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=self.mutex_path.parent)
        try:
            try:fcntl.flock(other,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:pass
            else:
                fcntl.flock(other,fcntl.LOCK_UN);raise Refused('ORIGINAL_MUTATION_OFD_NOT_HELD')
        finally:os.close(other)
    def guard(self):
        self.ds_guard()
        if self.reservation is not None:self.reservation.verify()
        for p,fd,digest in self.immutable_files:same_entry(fd,p.parent,p.name)
        for parent,name,fd,digest in self.tools:same_entry(fd,parent,name)
    def original_records(self):
        if getattr(self,'records_loaded',False):return
        receipts=_STATE_ROOT+'/receipts/'+OPERATION
        need((self.pins['original_records']['registration']['uid'],self.pins['original_records']['registration']['gid'],self.pins['original_records']['registration']['mode'])==(0,80,0o644) and (self.pins['original_records']['execution']['uid'],self.pins['original_records']['execution']['gid'],self.pins['original_records']['execution']['mode'])==(0,80,0o600),'ORIGINAL_RECORD_CUSTODY')
        reg,_=self.descriptor(receipts+'.json',self.pins['original_records']['registration'])
        exe,_=self.descriptor(receipts+'.b7-execution.json',self.pins['original_records']['execution'])
        need(hashlib.sha256(reg).hexdigest()==_REG_SHA and hashlib.sha256(exe).hexdigest()==_EXEC_SHA,'ORIGINAL_RECEIPTS_CHANGED')
        records={}
        for name in ('auth','terminal','progress'):
            want=self.pins['recovery_records'][name];need((want['uid'],want['gid'],want['mode'])==(0,80,0o600),'RECOVERY_RECORD_CUSTODY')
            raw,_=self.descriptor(receipts+'.b7-execution.b7-recovery-'+name+'.json',want);v=strict_json(raw)
            need(v.get('kind')=='DS_B7_RECOVERY_'+name.upper()+'_V1' and v.get('operation_id')==OPERATION and v.get('tx_id')==TRANSACTION and v.get('helper_source_sha256')==self.pins['recovery_helper_sha256'],'RECOVERY_RECORD_SUBJECT')
            records[name]=(raw,v)
        auth=records['auth'][1];term=records['terminal'][1];progress=records['progress'][1];authsha=hashlib.sha256(records['auth'][0]).hexdigest()
        need(auth.get('original_receipt_sha256')==_EXEC_SHA and auth.get('helper_role')=='FIXED_E35_RECOVERY_NOT_ORIGINAL_CARRIER' and term.get('authorization_sha256')==authsha and progress.get('authorization_sha256')==authsha and progress.get('phase')=='TERMINAL' and progress.get('terminal_output') is True,'RECOVERY_RECORD_COMPLETION')
        need(term.get('original_receipt_sha256_pre')==term.get('original_receipt_sha256_post')==_EXEC_SHA and term.get('original_policy_sha256')==auth.get('original_policy_sha256'),'RECOVERY_ORIGINAL_PROVENANCE')
        try:original=base64.b64decode(auth['original_receipt_bytes_b64'],validate=True)
        except Exception as exc:raise Refused('ORIGINAL_RECOVERY_RECEIPT_ENCODING') from exc
        need(original==exe,'RECOVERY_ORIGINAL_RECEIPT_BYTES')
        terminal=term['terminal']
        need(terminal.get('native_state')=='ABORTED' and terminal.get('installed') is False and terminal.get('transaction_sha256')==self.pins['native_sha256'],'RECOVERY_NATIVE_TERMINAL_PROOF')
        self.auth_sha=authsha;self.terminal=terminal;self.records_loaded=True
    def open_materials(self,historical=False):
        if self.materials:return
        need(type(self.pins['objects']) is list and len(self.pins['objects'])==5,'FIXED_FIVE_OBJECTS')
        for pin,(source,history) in zip(self.pins['objects'],FIXED_MATERIALS):
            need(pin['path']==source and pin['history']==os.path.dirname(source)+'/'+history,'FIXED_MATERIAL_PATH')
            p=self.path(source);s=os.fstat(p.parent)
            wanted=(16777233,186170744,0,0,0o755) if source.startswith('/usr/local/share/') else (16777233,111949693,0,0,0o700)
            need((s.st_dev,s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==wanted,'FIXED_MATERIAL_PARENT')
            a,b=exists_at(p.parent,p.name),exists_at(p.parent,history)
            need((not a and b) if historical else a!=b,'FIXED_MATERIAL_AMBIGUOUS')
            name=p.name if a else history;fd=open_leaf(p.parent,name);self.fds.append(fd)
            expected={k:pin[k] for k in ('root','members','regular_files','regular_bytes','lineage_sha256')}
            check_material(fd,p.parent,name,expected,a)
            self.materials.append(dict(parent=p.parent,source=p.name,history=history,expected=expected,fd=fd,original=a))
    def native_bytes(self):
        raw=_raw_fd(self.materials[0]['fd'],4*1024*1024)
        need(hashlib.sha256(raw).hexdigest()==self.pins['native_sha256'],'ACTUAL_ABORTED_NATIVE_BYTES')
        tx=strict_json(raw);need(tx.get('txId')==TRANSACTION and tx.get('state')=='ABORTED' and tx.get('activation',{}).get('restored') is True and tx.get('outer',{}).get('binding',{}).get('txId')==TRANSACTION,'NATIVE_ABORTED_BINDING')
        fence_raw=_raw_fd(self.materials[2]['fd'],65536);f=strict_json(fence_raw);s=os.fstat(self.materials[2]['fd'])
        need(hashlib.sha256(fence_raw).hexdigest()==self.pins['false_fence_sha256'] and set(f)=={'txId','inFlight','at'} and f['txId']==TRANSACTION and f['inFlight'] is False and type(f['at']) is str and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(505,601,0o600,1),'FALSE_FENCE_BINDING')
        return tx
    def status(self):
        self.ds_guard();need(not exists_at(self.native_parent,MaintenanceReservation.name),'STATUS_BEFORE_RESERVATION_ONLY')
        path='/usr/local/libexec/agent-deploy-system/ds_client.py';client=self.pins['installed_client'];need(client['uid']==0 and client['mode']&0o022==0,'INSTALLED_CLIENT_CUSTODY');self.descriptor(path,client)
        r=subprocess.run(['/usr/bin/python3','-I','-B',path,'b7-status-r3',OPERATION],capture_output=True,timeout=120,user=502,group=20,extra_groups=[],env={'PATH':'/usr/bin:/bin','LC_ALL':'C'},close_fds=True)
        need(r.returncode==0 and not r.stderr and len(r.stdout)<=65536,'ORIGINAL_STATUS_FAILED')
        value=strict_json(r.stdout)
        need(value.get('schema')=='ds-b7-execution-v2' and value.get('ok') is True and value.get('action')=='DS_B7_EXECUTION_STATUS_V2' and value.get('effect')=='READ_ONLY' and value.get('operation_id')==OPERATION and value.get('replay_allowed') is False,'ORIGINAL_STATUS_ENVELOPE')
        data=value['data']
        for key,wanted in dict(phase='RETAINED',active=False,attempt=1,input_sequence=0,input_pending=False,installed='UNKNOWN',native_state='UNKNOWN',native_terminal_verified=False,replay_allowed=False,tx_id=TRANSACTION).items():
            need(type(data.get(key)) is type(wanted) and data[key]==wanted,'ORIGINAL_STATUS_SUBJECT')
        need(data.get('recovery_terminal')==dict(native_state='ABORTED',installed=False,authorization_sha256=self.auth_sha,original_receipt_sha256=_EXEC_SHA),'ORIGINAL_STATUS_RECOVERY_OVERLAY')
        digest=hashlib.sha256(r.stdout).hexdigest();need(digest==self.pins['status_sha256'],'ACTUAL_STATUS_PROJECTION_CHANGED');return digest
    def load_checkpoint(self):
        if hasattr(self,'checkpoint'):return
        raw,_=self.bound(_CHECKPOINT,_CHECKPOINT_SHA,0,0,0o600)
        module=types.ModuleType('fixed_e35_original_checkpoint');module.__file__=_CHECKPOINT;exec(compile(raw,_CHECKPOINT,'exec'),module.__dict__)
        cfg,_=self.bound(self.wb+'/e35-retirement-checkpoint-inputs.json',self.pins['checkpoint_sha256'],0,0,0o444);config=strict_json(cfg)
        compat=config['oldProducer']['preimageCompatibility']
        need(compat['journalSha256']==compat['currentJournal']['journalSha256']==_JOURNAL_SHA and compat['byteBindingPath']==os.path.dirname(_CHECKPOINT)+'/preimage-byte-bindings.json','ACTUAL_CHECKPOINT_LAYOUT')
        self.checkpoint_module=module;self.checkpoint=module.Production(config,hashlib.sha256(cfg).hexdigest(),None);self.option=self.checkpoint.source('option');self.old=self.checkpoint.source('oldDisposal')
    def hold_tools(self):
        if self.tools:return
        binding=self.native_bytes()['outer']['binding'];prefix=_MIGRATION+'/activation-code-input/'
        source=prefix+'b7-entry-code/b7-wired-inputs/dsh-agent-core/'
        tools=[(binding['outerPath'],binding['outerSha256']),(binding['carrierPath'],binding['carrierSha256'])]
        for name,key in (('transaction-recovery.mjs','toolSha256'),('b7-preparation.mjs','preparationToolSha256'),('six-target-provision.mjs','sixTargetProducerSha256'),('canary-producer.mjs','canaryProducerSha256'),('b7-owner-confirmation.py','ownerRecorderSha256'),('cohort-binding.mjs','cohortToolSha256')):tools.append((source+'scripts/lib/deployment-reuse/'+name,binding[key]))
        tools += [(source+'scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs',binding['migrationToolSha256']),(source+'scripts/trusted-cp-deploy-install.sh',binding['installerSha256']),(prefix+_WORKER_RELATIVE,_WORKER_SHA)]
        need(set(binding['cohortSupport'])=={'cohort-artifacts.mjs','cohort-runtime.mjs'},'FIXED_COHORT_SUPPORT')
        for name,digest in binding['cohortSupport'].items():tools.append((source+'scripts/lib/deployment-reuse/'+name,digest))
        need(len(tools)==13 and len({p for p,d in tools})==13,'FIXED_THIRTEEN_TOOLS')
        for absolute,digest in tools:
            need(absolute.startswith(prefix) and os.path.normpath(absolute)==absolute,'FIXED_TOOL_SCOPE');parts=absolute[len(prefix):].split('/');parent=self.materials[4]['fd']
            for name in parts[:-1]:
                fd=open_leaf(parent,name);self.fds.append(fd);need(stat.S_ISDIR(os.fstat(fd).st_mode),'FIXED_TOOL_ANCESTOR');parent=fd
            fd=open_leaf(parent,parts[-1]);self.fds.append(fd);need(hashlib.sha256(_raw_fd(fd,4*1024*1024)).hexdigest()==_digest(digest),'FIXED_TOOL_BYTES')
            self.tools.append((parent,parts[-1],fd,digest));self.tool_relatives.append(absolute[len(prefix):])
    def public_runtime(self):
        alias=self.pins['public_bindings']['alias']
        need(set(alias)=={'target','uid','gid','mode','dev','inode','bytes'} and alias['target']=='/usr/local/libexec/agent-core/config/agents.json' and (alias['uid'],alias['gid'],alias['mode'])==(0,601,0o755),'FIXED_REGISTRY_ALIAS_BINDING')
        if not hasattr(self,'alias_path'):self.alias_path=self.path('/Users/authsvc/.agent-core/agents.json')
        p=self.alias_path;s=os.stat(p.name,dir_fd=p.parent,follow_symlinks=False)
        need(stat.S_ISLNK(s.st_mode) and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_dev,s.st_ino,s.st_size,s.st_nlink)==(alias['uid'],alias['gid'],alias['mode'],alias['dev'],alias['inode'],alias['bytes'],1) and os.readlink(p.name,dir_fd=p.parent)==alias['target'] and stable(s)==stable(os.stat(p.name,dir_fd=p.parent,follow_symlinks=False)),'ORIGINAL_PUBLIC_ALIAS_DRIFT')
        tx=self.native_bytes()
        for key in ('manifest','currentLink'):
            path=tx[key]
            need(type(path) is str and (path.startswith(_MIGRATION+'/') or path.startswith('/var/db/agent-core/authsvc-codex-migration/') or path.startswith('/Users/authsvc/.agent-core/control/')) and os.path.normpath(path)==path,'FIXED_NATIVE_PUBLIC_ABSENCE_PATH')
            if path.startswith('/var/'):path='/private'+path
            self.absent_fixed(path)
    def observe_runtime(self):
        # Faithful original loaded/plist/entry check, but the restored instance
        # is the actual E35 proof; never borrow E34's literal former PID.
        self.guard();self.public_runtime();runtime=self.native_bytes()['activation']['cohort']['routing']['runtime']
        wanted=runtime['inputs'];entry=runtime['entryDigests']['pre']
        need(set(entry)==set(_RUNTIME_ENTRIES),'FIXED_RUNTIME_ENTRY_SCOPE')
        def job():
            value=_parse_runtime_launchd(_runtime_command('/bin/launchctl',['print',_RUNTIME_TARGET]))
            need(0<value['pid']<=9007199254740991 and value['program']==_NODE and value['plist']==_RUNTIME_PLIST and value['user']=='authsvc' and {k:v for k,v in value.items() if k!='pid'}==wanted,'RESTORED_LOADED_INPUTS_CHANGED')
            return value
        def process(pid):
            text=_runtime_command('/bin/ps',['-p',str(pid),'-o','pid=','-o','pgid=','-o','uid=','-o','gid=','-o','lstart=','-o','comm=']).strip()
            match=re.fullmatch(r'(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+?\d{4})\s+(/.*)',text)
            need(match is not None and int(match[1])==pid and int(match[2])>0 and int(match[2])!=os.getpgrp() and int(match[3])==505 and int(match[4])==601 and match[6]==_NODE,'RESTORED_RUNTIME_PROCESS')
            _runtime_started(match[5]);return dict(pid=pid,pgid=int(match[2]),uid=505,gid=601,started=match[5].strip(),program=match[6])
        first=job();p1=process(first['pid'])
        for relative,digest in entry.items():
            raw,s=self.checkpoint_module.read_file(_RUNTIME_ROOT+'/'+relative)
            need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and hashlib.sha256(raw).hexdigest()==digest and s.st_mtime_ns/1000000<_runtime_started(p1['started'])*1000,'RESTORED_RUNTIME_ENTRY_GENERATION')
        second=job();p2=process(second['pid'])
        need(strict_payload(first)==strict_payload(second) and strict_payload(p1)==strict_payload(p2),'RESTORED_RUNTIME_INSTANCE_CHANGED')
        plist=strict_json(_runtime_command('/usr/bin/plutil',['-convert','json','-o','-',_RUNTIME_PLIST]));env=plist.get('EnvironmentVariables',{});args=plist.get('ProgramArguments')
        need(plist.get('Label')==_RUNTIME_TARGET[7:] and type(env) is dict and not any(k in env for k in _RUNTIME_FORBIDDEN),'RESTORED_RUNTIME_PLIST')
        loaded=dict(program=plist.get('Program',args[0] if args else None),arguments=args,cwd=plist.get('WorkingDirectory'),user=plist.get('UserName'),group=plist.get('GroupName'),plist=_RUNTIME_PLIST,environment=_runtime_selected(env))
        need(loaded==wanted,'RESTORED_LOADED_PLIST_DRIFT')
        for relative,digest in entry.items():
            raw,s=self.checkpoint_module.read_file(_RUNTIME_ROOT+'/'+relative)
            need(hashlib.sha256(raw).hexdigest()==digest and s.st_mtime_ns/1000000<_runtime_started(p1['started'])*1000,'RESTORED_RUNTIME_ENTRY_GENERATION')
        self.guard();value=dict(inputs=loaded,instance=p1,entryDigests=entry)
        return hashlib.sha256(canonical(value)).hexdigest()
    def original_absence(self,binding,native_archived,fence_archived):
        old,option=self.old,self.option;paths=old.Paths(old.RECOVERY,old.LOCK,old.DEPLOYMENT,old.AGENT_CORE.parent,old.PACKAGE)
        rec=old.open_directory(paths.recovery,protected=True);dep=old.open_directory(paths.deployment)
        try:
            if native_archived and fence_archived:
                old.prove_no_mutation(paths,rec,dep,option.TX_ID,binding['nonce'][:16])
            else:
                # Only the admitted same-TX native and false fence are present.
                # Every other original constituent remains its original test.
                if fence_archived:old.require_absent(rec,paths.fence_name)
                for name in ('b7-preparation-'+option.TX_ID+'.json','b7-accepted-'+option.TX_ID+'.json','b7-post-conditions-'+option.TX_ID):old.require_absent(rec,name)
                try:control=old.open_dir_at(dep,'control')
                except FileNotFoundError:control=None
                if control is not None:
                    try:
                        try:r=old.open_dir_at(control,'codex-plugin-runtime')
                        except FileNotFoundError:r=None
                        if r is not None:
                            try:old.require_absent(r,'gen-b7-'+option.TX_ID+'-'+binding['nonce'][:16])
                            finally:os.close(r)
                        old.require_absent(control,'codex-plugin-preimage-b7-'+option.TX_ID+'-'+binding['nonce'][:16])
                    finally:os.close(control)
        finally:os.close(rec);os.close(dep)
    def quiescent(self):
        r=subprocess.run(['/bin/ps','-axo','pid=,ppid=,uid=,command='],capture_output=True,timeout=15,env={'PATH':'/usr/bin:/bin','LC_ALL':'C'},close_fds=True)
        need(r.returncode==0 and not r.stderr and len(r.stdout)<=16*1024*1024,'ORIGINAL_WORKER_OBSERVATION_UNKNOWN')
        markers=(OPERATION,TRANSACTION,_MIGRATION+'/activation-code-input','b7-native-execution-r34-c71fd2cc')
        for line in r.stdout.splitlines():
            fields=line.split(None,3);need(len(fields)==4 and all(p.isdigit() for p in fields[:3]),'ORIGINAL_PROCESS_OBSERVATION_SHAPE')
            if int(fields[0])!=os.getpid():need(not any(x.encode() in fields[3] for x in markers),'ORIGINAL_WORKER_OR_DESCENDANT_STILL_PRESENT')
        names=[];code_name=None
        for material in self.materials:
            name=material['source'] if exists_at(material['parent'],material['source']) else material['history'];parent='/usr/local/share/agent-core' if material['source']=='artifacts' else _MIGRATION
            names.append(parent+'/'+name)
            if material['source']=='activation-code-input':code_name=name
        need(code_name is not None,'FIXED_CODEINPUT_OBSERVATION')
        names += [_MIGRATION+'/'+code_name+'/'+relative for relative in self.tool_relatives]
        r=subprocess.run(['/usr/sbin/lsof','-nP','-Fp','--']+names,capture_output=True,timeout=30,env={'PATH':'/usr/bin:/bin','LC_ALL':'C'},close_fds=True)
        need(r.returncode in (0,1) and not r.stderr and len(r.stdout)<=65536 and (bool(r.stdout) or r.returncode==1),'ORIGINAL_MATERIAL_OPENERS_UNKNOWN')
        own=False
        for line in r.stdout.splitlines():
            if line.startswith(b'p') and line[1:].isdigit():need(int(line[1:])==os.getpid(),'FOREIGN_MATERIAL_OPENER');own=True
            else:need(own and line.startswith(b'f') and line[1:].isdigit(),'FOREIGN_MATERIAL_OPENER')
    def fresh(self):
        self.guard()
        for p,fd,digest in self.immutable_files:need(hashlib.sha256(_raw_fd(fd,4*1024*1024)).hexdigest()==digest,'ORIGINAL_IMMUTABLE_BYTES_CHANGED');same_entry(fd,p.parent,p.name)
        for parent,name,fd,digest in self.tools:need(hashlib.sha256(_raw_fd(fd,4*1024*1024)).hexdigest()==digest,'HELD_TOOL_CHANGED');same_entry(fd,parent,name)
        self.native_bytes();moved=[]
        for r in self.materials:
            a,b=exists_at(r['parent'],r['source']),exists_at(r['parent'],r['history']);need(a!=b,'FIXED_MATERIAL_AMBIGUOUS')
            check_material(r['fd'],r['parent'],r['source'] if a else r['history'],r['expected'],a);moved.append(b)
        need(moved==sorted(moved,reverse=True),'FIXED_MATERIAL_MOVE_ORDER')
        need(self.observe_runtime()==self.pins['runtime_sha256'],'RESTORED_RUNTIME_BINDING_DRIFT')
        cp=self.checkpoint
        for name in ('b7-six-target-batch.json','b7-six-target-batch.json.new'):self.checkpoint_module.absent(_MIGRATION+'/'+name)
        _,binding=cp.controlled_option_receipt(self.option);self.original_absence(binding,moved[0],moved[2]);cp.recovered_six(self.option)
        for record in cp.c['liveDeltas']:
            raw,s=self.checkpoint_module.read_file(record['path'])
            need(hashlib.sha256(raw).hexdigest()==record['sha256'] and len(raw)==record['bytes'] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(record['uid'],record['gid'],record['mode']),'ORIGINAL_LIVE_INCREMENT_DRIFT')
        hr,_=self.checkpoint_module.read_file('/usr/local/libexec/agent-core/app/packages/agent-router/src/process/event-correlation.js')
        need(hashlib.sha256(hr).hexdigest()=='47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc','PROTECTED_HR_CHANGED')
        h=cp.c['health'];need(type(h) is dict and type(h.get('host')) is str and h['host']=='127.0.0.1' and type(h.get('port')) is int and h['port']==8790 and type(h.get('path')) is str and h['path']=='/health','FIXED_HEALTH_TARGET')
        connection=http.client.HTTPConnection(h['host'],h['port'],timeout=5)
        try:
            connection.request('GET',h['path']);response=connection.getresponse();raw=response.read(65537)
            need(response.status==200 and len(raw)<=65536,'ORIGINAL_PUBLIC_HEALTH_STATUS');value=strict_json(raw)
            need(type(value) is dict and value.get('ok') is True and value.get('deliverReady') is True,'ORIGINAL_PUBLIC_HEALTH_NOT_READY')
        finally:connection.close()
        self.quiescent();self.guard()
    def bind_intent(self,payload):
        wanted=dict(status_sha256=self.pins['status_sha256'],pins_sha256=_PINS_SHA,checkpoint_sha256=self.pins['checkpoint_sha256'],recovery_proof_sha256=self.proof_sha,runtime_sha256=self.pins['runtime_sha256'],inventory_sha256=hashlib.sha256(canonical(self.pins['objects'])).hexdigest())
        need({k:v for k,v in payload.items() if k!='nonce'}==wanted,'EXISTING_INTENT_CONFIG_CHANGED')
    def start(self,previous):
        self.original_records();self.open_materials();self.native_bytes();self.load_checkpoint();self.hold_tools()
        self.descriptor(_MIGRATION+'/.b7-six-journal.jsonl',self.pins['journal'])
        node=self.pins['installed_node'];need((node['uid'],node['gid'],node['mode'])==(0,0,0o755),'ORIGINAL_INSTALLED_NODE_CUSTODY');self.descriptor(_NODE,node)
        need(self.pins['journal']['sha256']==_JOURNAL_SHA,'CURRENT_JOURNAL_BINDING')
        for name,path in (('config','/Users/authsvc/.agent-core/agent-model-overrides.json'),('registry','/usr/local/libexec/agent-core/config/agents.json'),('plist',_RUNTIME_PLIST)):
            self.descriptor(path,self.pins['public_bindings'][name])
        if previous is None:need(all(r['original'] for r in self.materials),'UNPROVEN_PRIOR_RETIREMENT')
        else:
            need(previous['pins_sha256']==_PINS_SHA and previous['checkpoint_sha256']==self.pins['checkpoint_sha256'] and previous['recovery_proof_sha256']==self.proof_sha,'FIXED_INTENT_PROVENANCE')
            if not all(r['original'] for r in self.materials):need(self.audit.find('FIXED_E35_ADMITTED') is not None,'UNPROVEN_PRIOR_RETIREMENT')
        if not exists_at(self.native_parent,MaintenanceReservation.name):status_sha=self.status()
        else:
            need(previous is not None and self.audit.find('FIXED_E35_ADMITTED') is not None,'FOREIGN_OR_UNPROVEN_RESERVATION');status_sha=previous['status_sha256']
        need(self.observe_runtime()==self.pins['runtime_sha256'],'RESTORED_RUNTIME_BINDING_DRIFT');self.fresh()
        return dict(status_sha256=status_sha,pins_sha256=_PINS_SHA,checkpoint_sha256=self.pins['checkpoint_sha256'],recovery_proof_sha256=self.proof_sha,runtime_sha256=self.pins['runtime_sha256'],inventory_sha256=hashlib.sha256(canonical(self.pins['objects'])).hexdigest())
    def verify_history(self,sync):
        self.original_records();self.open_materials(historical=True);self.native_bytes();out=[]
        for r in self.materials:
            self.ds_guard();need(not exists_at(r['parent'],r['source']),'CANONICAL_REAPPEARED')
            # Validate the entire exact held history before any synchronization.
            check_material(r['fd'],r['parent'],r['history'],r['expected'],False)
        for r in self.materials:
            check_material(r['fd'],r['parent'],r['history'],r['expected'],False,sync=sync,lease_current=self.ds_guard)
            if sync:self.ds_guard();os.fsync(r['parent'])
            out.append(r['expected']['lineage_sha256'])
        for p,fd,digest in self.immutable_files:need(hashlib.sha256(_raw_fd(fd,4*1024*1024)).hexdigest()==digest,'HISTORICAL_RECORD_CHANGED')
        return out
    def post_checkpoint(self):
        self.ds_guard();self.load_checkpoint();need(not exists_at(self.native_parent,MaintenanceReservation.name),'NATIVE_RESERVATION_NOT_RELEASED')
        for source,history in FIXED_MATERIALS:
            p=self.path(source);need(not exists_at(p.parent,p.name),'CANONICAL_MATERIAL_STILL_PRESENT')
        with contextlib.redirect_stdout(io.StringIO()):facts=self.checkpoint.clean_checkpoint()
        self.ds_guard();return dict(kind=facts['kind'],liveIncrementFiles=len(facts['liveIncrementFiles']),restoredPreimages=len(facts['sixTargetRecovery']['restoredPreimages']),loadedBusinessProof=False)
    def close(self):
        if self.reservation is not None:self.reservation.close()
        for fd in reversed(self.fds):os.close(fd)
        self.fds.clear()
        for p in reversed(self.paths):p.close()
        self.paths.clear()

def run(lease_current):
    need(os.geteuid()==0 and os.getuid()==0 and callable(lease_current),'FIXED_ROOT_ENTRY_REQUIRED')
    need(not any(k.startswith('DS_') for k in os.environ),'OVERRIDE_ENVIRONMENT_FORBIDDEN')
    _digest(_PINS_SHA)
    scene=FixedE35Scene.__new__(FixedE35Scene);scene.paths=[];scene.fds=[];scene.reservation=None
    try:
        scene.__init__(lease_current);return _retire_fixed(scene)
    finally:scene.close()

if __name__=='__main__':raise SystemExit('REFUSED: ORIGINAL_FIXED_PREPARE_ENTRY_REQUIRED')

