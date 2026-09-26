"""Fixed installed metadata observation; never grants continuous source closure."""
import hashlib
import json
import os
from pathlib import Path
import selectors
import stat
import subprocess
import time
import xml.etree.ElementTree as ET

ROOT = Path('/Users/authsvc/.agent-core')
APP = Path('/usr/local/libexec/agent-core/app')
GUI = Path('/Users/authsvc/Library/LaunchAgents/ai.agent-core.runtime.plist')
SYSTEM = Path('/Library/LaunchDaemons/ai.agent-core.runtime.plist')
MANIFEST = Path('/private/var/db/agent-deploy-system/hr-s256-deployment-proof/entry-manifest.json')
GATED = 'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'
HELPER = 'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'
RETIRED = 'scripts/production-runtime.mjs'
MAX_BYTES = 65536


class Rejected(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Rejected(code)


def check(deadline):
    require(time.monotonic() < deadline, 'INVENTORY_DEADLINE')


def identity(meta):
    return (meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid, meta.st_mode,
            meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def open_directory(path, deadline):
    check(deadline)
    path = Path(path)
    require(path.is_absolute() and str(path) == os.path.normpath(path), 'INVENTORY_PATH_UNKNOWN')
    current = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:]:
            check(deadline)
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=current)
            os.close(current)
            current = next_fd
        return current
    except BaseException:
        os.close(current)
        raise


def bounded_names(fd, deadline):
    names = []
    with os.scandir(fd) as entries:
        for entry in entries:
            check(deadline)
            require(len(names) < 64, 'INVENTORY_SESSION_BOUND')
            names.append(entry.name)
    return names


class Observation:
    """Private owned descriptors; no caller PID/window/custodian assertion."""
    def __init__(self, deadline):
        self.deadline = deadline
        self.files = []
        self.dirs = []
        self.absences = []

    def directory(self, path):
        fd = open_directory(path, self.deadline)
        self.dirs.append((Path(path), fd, identity(os.fstat(fd))))
        return fd

    def file(self, path, uid, header=False):
        parent = self.directory(Path(path).parent)
        fd = os.open(Path(path).name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode) and before.st_uid == uid
                    and not (before.st_mode & 0o022) and before.st_size > 0,
                    'INVENTORY_FILE_CUSTODY')
            if not header:
                require(before.st_size <= MAX_BYTES, 'INVENTORY_OUTPUT_BOUND')
            raw = bytearray()
            # A header read never fetches any bytes after its first newline.
            cap = 4096 if header else MAX_BYTES
            while len(raw) <= cap:
                check(self.deadline)
                block = os.read(fd, 1 if header else min(65536, cap + 1 - len(raw)))
                if not block:
                    break
                raw.extend(block)
                if header and block == b'\n':
                    break
            require(0 < len(raw) <= cap and (not header or raw.endswith(b'\n')),
                    'INVENTORY_HEADER_OR_OUTPUT_UNKNOWN')
            require(identity(before) == identity(os.fstat(fd)), 'INVENTORY_CHANGED')
            self.files.append((Path(path), fd, identity(before), bytes(raw), header))
            return fd, bytes(raw)
        except BaseException:
            os.close(fd)
            raise

    def absent(self, path):
        parent = self.directory(Path(path).parent)
        try:
            os.stat(Path(path).name, dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            self.absences.append(Path(path))
            return
        raise Rejected('INVENTORY_CHANGED')

    def current(self):
        for path, fd, before in self.dirs:
            check(self.deadline)
            fresh = open_directory(path, self.deadline)
            try:
                require(identity(os.fstat(fd)) == before == identity(os.fstat(fresh)), 'INVENTORY_CHANGED')
            finally:
                os.close(fresh)
        for path, fd, before, raw, header in self.files:
            check(self.deadline)
            require(identity(os.fstat(fd)) == before, 'INVENTORY_CHANGED')
            parent = open_directory(path.parent, self.deadline)
            fresh = None
            try:
                fresh = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
                require(identity(os.fstat(fresh)) == before
                        and os.pread(fresh, len(raw), 0) == raw, 'INVENTORY_CHANGED')
            finally:
                if fresh is not None:
                    os.close(fresh)
                os.close(parent)

        for path in self.absences:
            parent = open_directory(path.parent, self.deadline)
            try:
                try:
                    os.stat(path.name, dir_fd=parent, follow_symlinks=False)
                except FileNotFoundError:
                    continue
                raise Rejected('INVENTORY_CHANGED')
            finally:
                os.close(parent)

    def close(self):
        for _, fd, *_ in self.files + self.dirs:
            os.close(fd)
        self.files.clear()
        self.dirs.clear()


def parsed(raw):
    result = json.loads(raw, object_pairs_hook=HR_REAL_OS.unique_object)
    require(type(result) is dict, 'INVENTORY_JSON_UNKNOWN')
    return result


def route(raw):
    require(b'<!ENTITY' not in raw and b'<!DOCTYPE' not in raw.replace(
        b'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', b''),
        'INVENTORY_ROUTE_UNKNOWN')
    tree = ET.fromstring(raw)
    body = tree.find('dict')
    require(tree.tag == 'plist' and body is not None, 'INVENTORY_ROUTE_UNKNOWN')
    fields = {}
    values = list(body)
    require(len(values) % 2 == 0, 'INVENTORY_ROUTE_UNKNOWN')
    for index in range(0, len(values), 2):
        key, value = values[index:index + 2]
        require(key.tag == 'key' and key.text not in fields, 'INVENTORY_ROUTE_UNKNOWN')
        fields[key.text] = value
    args = fields.get('ProgramArguments')
    require(fields.get('Label') is not None and fields['Label'].text == 'ai.agent-core.runtime'
            and args is not None and args.tag == 'array'
            and all(v.tag == 'string' for v in args), 'INVENTORY_ROUTE_UNKNOWN')
    fixed = ['/usr/local/libexec/agent-core/node-runtime/bin/node', str(APP / GATED)]
    require([v.text for v in args] in (fixed, fixed + ['--root', str(ROOT)]),
            'INVENTORY_ROUTE_UNKNOWN')  # Exact MI promoted route or existing fixed-root MF1 representation.
    env = fields.get('EnvironmentVariables')
    if env is not None:
        names = [v.text for v in list(env)[::2]]
        require(not any(name in names for name in ('DSH_HOME', 'DSH_AGENTS_HOME',
            'DSH_WORKSPACE_DIR', 'NODE_OPTIONS')), 'INVENTORY_ROUTE_OVERRIDE_UNKNOWN')


def fixed_installed_inventory():
    if 'HR_REAL_OS' not in globals():
        raise Rejected('PROFILE_NOT_BOOTSTRAPPED')
    HR_REAL_OS.require_activation()  # Before any protected IO.
    deadline = time.monotonic() + 10
    observed = Observation(deadline)
    try:
        subject = HR_PROJECTION.fixed_subject_projection()
        HR_ONE_SHOT.normalized_subject(subject)
        observed.deadline = time.monotonic() + 10  # Existing fixed projection has its own bounded preflight budget.
        manifest = parsed(observed.file(MANIFEST, 0)[1])
        # The MF1 manifest authenticates known entries, not whole-host completeness.
        HR_PROFILE.validate_entry_closure(manifest,
            ['gui/505/ai.agent-core.runtime', 'system/ai.agent-core.runtime', GATED])
        sources = {}
        for path, uid in ((GUI, 0), (SYSTEM, 0)):
            raw = observed.file(path, uid)[1]
            route(raw)
            sources[str(path)] = sha(raw)
        for path, expected in ((GATED, HR_GATED_ENTRY_SHA256),
                (HELPER, HR_CHILD_PROOF_SHA256),
                ('packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs', HR_STARTUP_CONTEXT_SHA256), (RETIRED, manifest['retiredEntry']['sha256'])):
            raw = observed.file(APP / path, 0)[1]
            require(sha(raw) == expected, 'INVENTORY_ENTRY_CHANGED')
            sources[str(APP / path)] = sha(raw)
        bindings_fd, bindings_raw = observed.file(ROOT / 'bindings/bindings.json', 505)
        bindings = parsed(bindings_raw)  # Duplicate keys reject before existing validator.
        require(set(bindings) <= {'version', 'bindings', 'lastSessions', 'freshSessions'}
                and type(bindings.get('bindings')) is dict, 'INVENTORY_BINDINGS_UNKNOWN')
        for row in bindings['bindings'].values():
            require(type(row) is dict and set(row) <= {'channelConversationId',
                'activeAgentId', 'activeSessionId', 'workspace', 'updatedAt'},
                'INVENTORY_BINDINGS_UNKNOWN')
        try:
            primary_raw = observed.file(ROOT / 'primary-workspaces.json', 505)[1]
            primary = parsed(primary_raw)
        except FileNotFoundError:
            observed.absent(ROOT / 'primary-workspaces.json')
            primary_raw, primary = None, {}  # Existing optional-import default, with bound absence.
        sessions = ROOT / 'homes/agt_hr-agent/sessions'
        sessions_fd = observed.directory(sessions)
        names = bounded_names(sessions_fd, observed.deadline)
        require(len(names) <= 64, 'INVENTORY_SESSION_BOUND')
        # Exact opaque session encoding and project mapping are done by existing JS helpers.
        result = derive_holders(bindings_fd, primary, subject, sessions, names, observed)
        observed.current()
        result.update({'sources': sources,
            'inputDigests': {'bindings': sha(bindings_raw), 'primaryWorkspaces': None if primary_raw is None else sha(primary_raw)},
            'subjectPreimageSha256': subject['subjectPreimageSha256'],
            'unresolvedSources': ['LE1_INSTALLED_ENTRY_AND_RESUMPTION_CLOSURE'],
            'holderCoverage': 'INSTALLED_CONFIG_AND_EXACT_SESSION_HEADERS_OBSERVED'})
        scope = HR_REAL_OS.qualified_source_scope()
        require(scope['entryManifest'] == manifest, 'SOURCE_CLOSURE_UNKNOWN')
        result['unresolvedSources'] = []
        return result
    except (OSError, ValueError, ET.ParseError) as exc:
        raise Rejected('INVENTORY_UNKNOWN') from exc
    finally:
        observed.close()


def fixed_source_identities():
    """Recheck only the fixed executable/control entries through consumption.

    The Router record and session files may legitimately change at startup;
    those are not substituted for the immutable source-control projection.
    """
    HR_REAL_OS.require_activation()
    observed = Observation(time.monotonic() + 10)
    try:
        scope = HR_REAL_OS.qualified_source_scope()
        manifest = parsed(observed.file(MANIFEST, 0)[1])
        require(manifest == scope['entryManifest'], 'SOURCE_CLOSURE_UNKNOWN')
        sources = {}
        for path, uid in ((GUI, 0), (SYSTEM, 0)):
            raw = observed.file(path, uid)[1]
            route(raw)
            sources[str(path)] = sha(raw)
        for path, expected in ((GATED, HR_GATED_ENTRY_SHA256),
                (HELPER, HR_CHILD_PROOF_SHA256),
                ('packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs', HR_STARTUP_CONTEXT_SHA256),
                (RETIRED, manifest['retiredEntry']['sha256'])):
            raw = observed.file(APP / path, 0)[1]
            require(sha(raw) == expected, 'INVENTORY_ENTRY_CHANGED')
            sources[str(APP / path)] = sha(raw)
        observed.current()
        return sources
    finally:
        observed.close()


def node_metadata(bindings_fd, primary, subject, deadline, headers=None):
    check(deadline)
    source = HR_INVENTORY_HELPER_SOURCE.replace('../../../packages/', (APP / 'packages').as_uri() + '/')
    source += "\nlet text='';for await(const chunk of process.stdin)text+=chunk;" \
              "process.stdout.write(JSON.stringify(deriveFixedMetadata(JSON.parse(text))));\n"
    inputs = {'bindingsFd': bindings_fd, 'primary': primary, 'subject': subject}
    if headers is not None:
        inputs['headers'] = headers
    raw = json.dumps(inputs).encode()
    require(len(raw) <= MAX_BYTES, 'INVENTORY_OUTPUT_BOUND')
    os.lseek(bindings_fd, 0, os.SEEK_SET)
    child = subprocess.Popen(['/usr/local/libexec/agent-core/node-runtime/bin/node',
        '--input-type=module', '-e', source], pass_fds=(bindings_fd,),
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        user=505, group=601, extra_groups=[], env={'PATH': '/usr/bin:/bin'})
    output = bytearray()
    offset = 0
    try:
        os.set_blocking(child.stdin.fileno(), False)
        os.set_blocking(child.stdout.fileno(), False)
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdin, selectors.EVENT_WRITE, 'input')
            selector.register(child.stdout, selectors.EVENT_READ, 'output')
            while selector.get_map():
                check(deadline)
                events = selector.select(deadline - time.monotonic())
                require(bool(events), 'INVENTORY_DEADLINE')
                for key, _ in events:
                    if key.data == 'input':
                        offset += os.write(key.fileobj.fileno(), raw[offset:])
                        if offset == len(raw):
                            selector.unregister(key.fileobj)
                            child.stdin.close()
                    else:
                        block = os.read(key.fileobj.fileno(), MAX_BYTES + 1 - len(output))
                        if not block:
                            selector.unregister(key.fileobj)
                        else:
                            output.extend(block)
                            require(len(output) <= MAX_BYTES, 'INVENTORY_OUTPUT_BOUND')
        check(deadline)
        require(child.wait(timeout=deadline - time.monotonic()) == 0 and output,
                'HOLDER_PATH_UNKNOWN')
        return parsed(output)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise Rejected('HOLDER_PATH_UNKNOWN') from exc
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
        if not child.stdin.closed:
            child.stdin.close()
        child.stdout.close()


def derive_holders(bindings_fd, primary, subject, sessions, names, observed):
    for path, digest in HR_INVENTORY_VALIDATOR_PINS.items():
        require(sha(observed.file(APP / path, 0)[1]) == digest, 'INVENTORY_VALIDATOR_CHANGED')
    metadata = node_metadata(bindings_fd, primary, subject, observed.deadline)
    require(set(metadata) == {'paths', 'encodedSession', 'sessionsRoot'}
            and metadata['sessionsRoot'] == str(sessions), 'HOLDER_PATH_UNKNOWN')
    encoded = metadata['encodedSession']
    require(type(encoded) is str and encoded not in ('', '.', '..')
            and '/' not in encoded and '\\' not in encoded, 'HOLDER_PATH_UNKNOWN')
    require(type(metadata['paths']) is list, 'HOLDER_PATH_UNKNOWN')
    for path in metadata['paths']:
        require(type(path) is str and Path(path).is_absolute(), 'HOLDER_PATH_UNKNOWN')
        observed.directory(path)  # Bind identities before the later header/Node observations.
    headers = []
    for name in sorted(names):
        check(observed.deadline)
        require(name not in ('.', '..') and '/' not in name, 'HOLDER_PATH_UNKNOWN')
        project = sessions / name
        project_fd = observed.directory(project)
        children = bounded_names(project_fd, observed.deadline)
        require(len(children) <= 64, 'INVENTORY_SESSION_BOUND')
        if encoded in children:
            raw = observed.file(project / encoded / 'session.jsonl', 505, header=True)[1]
            header = parsed(raw)
            require(set(header) <= {'type', 'version', 'id', 'createdAt', 'cwd'},
                    'HOLDER_HEADER_UNKNOWN')
            require(type(header.get('cwd')) is str and Path(header['cwd']).is_absolute(),
                    'HOLDER_PATH_UNKNOWN')
            observed.directory(header['cwd'])
            # Only metadata is forwarded; extra session header values never escape.
            headers.append({'projectKey': name, 'header': {
                key: header.get(key) for key in ('type', 'id', 'cwd')}})
    require(bool(headers), 'HOLDER_PATH_UNKNOWN')
    metadata = node_metadata(bindings_fd, primary, subject, observed.deadline, headers)
    require(set(metadata) == {'paths', 'encodedSession', 'sessionsRoot'}
            and metadata['sessionsRoot'] == str(sessions) and metadata['encodedSession'] == encoded,
            'HOLDER_PATH_UNKNOWN')
    paths = metadata['paths'] + [str(sessions)]
    require(type(metadata['paths']) is list and 1 <= len(paths) <= 65
            and all(type(path) is str and Path(path).is_absolute() for path in paths),
            'HOLDER_PATH_UNKNOWN')
    descriptors = []
    for path in sorted(set(paths)):
        fd = observed.directory(path)
        meta = os.fstat(fd)
        descriptors.append({'path': path, 'device': meta.st_dev, 'inode': meta.st_ino,
                            'uid': meta.st_uid, 'mode': stat.S_IMODE(meta.st_mode)})
    return {'holderPaths': sorted(set(paths)), 'holderDirectoryIdentities': descriptors,
            'sessionHeaderCount': len(headers)}
