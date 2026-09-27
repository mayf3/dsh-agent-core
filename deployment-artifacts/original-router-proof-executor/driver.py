"""Original separate executor qualification driver; no HR public dispatcher.

The installation-time exact package binding is deliberately absent. This
module cannot admit a caller-supplied event, path, receipt, or PASS assertion.
"""
import json
import re
import stat
import os
import hashlib
import sys
import secrets
import ast
import time
import subprocess
from dataclasses import dataclass

PROCEDURE_SHA = 'd8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e'
ID = 'original-router-qualification-20260927-v1'
PHASES = ('deployment_start', 'restart_a', 'restart_b')
DAEMON_SHA = '908941f28a851d4a323be1870b6e8e9a6c29da841b7706817f0d9189557987cb'
APP = '/usr/local/libexec/agent-core/app'
QUALIFIED_ORIGINAL_ENTRY = None
HANDOFF_SHA = 'b9238434fe765d45b6746543fc0d9ff09c728daecdffed6f1202426f6c72ab62'
NODE = '/usr/local/libexec/agent-core/node-runtime/bin/node'
NODE_SHA = 'c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b'
GATED = APP + '/packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'
QUALIFIED_DEPLOYMENT = None
QUALIFIED_OWNER_SHA = None
PROCEDURE_DRIVER_SHA = '6f95fb7d30bc50d1bc06cb2c08a14aa30e84dcf81c09f661af8d8c637807909d'
DEPLOYMENT_DRIVER_SHA = 'cef909532829ee3ba3d6fac62fe442ae2e362d75b18ed49430c5cfb563eb2bbe'


@dataclass(frozen=True)
class _EntryBinding:
    entry_sha256: str
    manifest_sha256: str
    consuming_binary_sha256: str
    validator_sha256: str
    helper_sha256: str


@dataclass(frozen=True)
class _DeploymentBinding:
    final_binary_sha256: str
    preimage_binary_sha256: str
    rollback_operation_id: str


class Unknown(Exception):
    pass


def require(ok, reason):
    if not ok:
        raise Unknown(reason)


def _object(raw):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'DUPLICATE_PRIVATE_FIELD')
            value[key] = item
        return value
    try:
        require(type(raw) is bytes and len(raw) <= 65536, 'PRIVATE_FRAME_BOUND')
        value = json.loads(raw, object_pairs_hook=unique)
        require(type(value) is dict, 'PRIVATE_OBJECT_REQUIRED')
        return value
    except (ValueError, TypeError) as exc:
        raise Unknown('PRIVATE_FRAME_INVALID') from exc


def _context(value):
    require(type(value) is dict and set(value) == {'role', 'phase',
        'consumingBinarySha256','validatorSha256','entryManifestSha256', 'procedureSha256', 'startupNonce'},
        'QUALIFICATION_CONTEXT_SHAPE')
    require(value['role'] == 'original_executor_qualification'
        and value['phase'] in PHASES and value['procedureSha256'] == PROCEDURE_SHA,
        'QUALIFICATION_CONTEXT_BINDING')
    for key in ('consumingBinarySha256','validatorSha256','entryManifestSha256', 'startupNonce'):
        require(type(value[key]) is str and re.fullmatch('[a-f0-9]{64}', value[key]),
                'QUALIFICATION_CONTEXT_IDENTITY')
    return value.copy()


def _store_projection(value):
    require(type(value) is dict and set(value) == {'loadable', 'floor',
        'maxIssuedTurnSeq', 'overlappingLiveRanges'}, 'STORE_OBSERVATION_SHAPE')
    require(value['loadable'] is True and value['overlappingLiveRanges'] is False,
            'STORE_UNSAFE')
    require(type(value['floor']) is int and value['floor'] > 0
        and type(value['maxIssuedTurnSeq']) is int and value['maxIssuedTurnSeq'] >= 0,
        'STORE_GENERATION_INVALID')
    return value['floor'], value['maxIssuedTurnSeq']


def _root_regular(meta,limit=65536):
    require(stat.S_ISREG(meta.st_mode) and meta.st_uid == 0
        and not (stat.S_IMODE(meta.st_mode) & 0o022)
        and meta.st_nlink == 1 and 0 <= meta.st_size <= limit,
        'ORIGINAL_ENTRY_CUSTODY')


def _invocation(argv):
    require(len(argv) == 2 and argv[0] == '--original-qualification-fds'
        and type(argv[1]) is str and re.fullmatch('[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+',argv[1]),
        'ORIGINAL_INVOCATION_INVALID')
    descriptors = tuple(int(x) for x in argv[1].split(','))
    require(all(3 <= x <= 1024 for x in descriptors) and len(set(descriptors)) == 6,
        'ORIGINAL_DESCRIPTOR_INVALID')
    return descriptors


def _descriptor_bytes(fd, expected,limit=65536):
    before = os.fstat(fd)
    _root_regular(before,limit)
    raw = bytearray()
    while len(raw) < before.st_size:
        block = os.pread(fd,before.st_size-len(raw),len(raw))
        require(bool(block), 'ORIGINAL_DESCRIPTOR_SHORT_READ')
        raw.extend(block)
    after = os.fstat(fd)
    _root_regular(after,limit)
    identity = lambda m: (m.st_dev,m.st_ino,m.st_mode,m.st_uid,m.st_nlink,
                          m.st_size,m.st_mtime_ns,m.st_ctime_ns)
    require(identity(before) == identity(after)
        and hashlib.sha256(raw).hexdigest() == expected,
        'ORIGINAL_DESCRIPTOR_CHANGED')
    return bytes(raw)


def _entry_manifest(value,binding):
    expected = {'entrySha256':binding.entry_sha256,
        'consumingBinarySha256':binding.consuming_binary_sha256,
        'validatorSha256':binding.validator_sha256,'helperSha256':binding.helper_sha256,
        'procedureSha256':PROCEDURE_SHA}
    require(type(value) is dict and value == expected and set(value) == set(expected),
        'ORIGINAL_ENTRY_MANIFEST_MISMATCH')
    return value.copy()


def _namespace_directory(path):
    """Internal original fixed package namespace, never an invocation path."""
    require(path.startswith('/') and '..' not in path.split('/'),'ORIGINAL_NAMESPACE_UNKNOWN')
    fd = os.open('/',os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.split('/')[1:]:
            if not component: continue
            child = os.open(component,os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,dir_fd=fd)
            os.close(fd)
            fd = child
            meta = os.fstat(fd)
            require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == 0
                    and not meta.st_mode & 0o022,'ORIGINAL_NAMESPACE_CUSTODY')
        return fd
    except BaseException:
        os.close(fd)
        raise


class FixedOriginalDriver:
    def __init__(self):
        # Before any filesystem/process action: a thread/euid is not admission.
        require(QUALIFIED_ORIGINAL_ENTRY is not None, 'QUALIFICATION_ENTRY_UNBOUND')
        require(type(QUALIFIED_ORIGINAL_ENTRY) is _EntryBinding
            and all(type(value) is str and re.fullmatch('[a-f0-9]{64}',value)
                for value in vars(QUALIFIED_ORIGINAL_ENTRY).values()),
            'QUALIFICATION_ENTRY_BINDING')
        self._binding = QUALIFIED_ORIGINAL_ENTRY
        self._unknown = True
        self._admit()
        self._unknown = False

    def _admit(self):
        challenge,window,manifest,entry,helper,daemon = _invocation(sys.argv[1:])
        binding = self._binding
        raw = _descriptor_bytes(manifest,binding.manifest_sha256)
        _entry_manifest(_object(raw),binding)
        _descriptor_bytes(entry,binding.entry_sha256)
        # This executing sealed entry must be the actual admitted file, not an
        # unrelated root-owned FD. No caller-selected pathname is accepted.
        own = os.stat(__file__,follow_symlinks=False)
        admitted = os.fstat(entry)
        _root_regular(own)
        require((own.st_dev,own.st_ino) == (admitted.st_dev,admitted.st_ino),
                'ORIGINAL_EXECUTING_ENTRY_MISMATCH')
        helper_bytes = _descriptor_bytes(helper,binding.helper_sha256)
        # Reuse the exact separately pinned existing root-peer/OFD primitive;
        # never execute unqualified source supplied by an invocation.
        scope = {'__name__':'_original_executor_pinned_child_proof'}
        exec(compile(helper_bytes,'hr-s256-r2-child-proof.py','exec'),scope)
        approved = scope['prove'](challenge,window,binding.manifest_sha256)
        require(type(approved) is dict and type(approved.get('nonce')) is str
                and re.fullmatch('[a-f0-9]{64}',approved['nonce']),
                'ORIGINAL_CUSTODY_NONCE_UNKNOWN')
        # Original manifest and executing entry are rechecked after the fallible
        # authenticated challenge, before permitting any procedure edge.
        require(_descriptor_bytes(manifest,binding.manifest_sha256) == raw,
                'ORIGINAL_ENTRY_MANIFEST_CHANGED')
        _descriptor_bytes(entry,binding.entry_sha256)
        self._window_fd = window
        meta = os.fstat(window)
        _root_regular(meta)
        self._window_identity = (meta.st_dev,meta.st_ino,meta.st_uid,meta.st_mode)
        self._nonce = approved['nonce']
        self._used_phases = set()
        self._daemon_fd = daemon
        self._operation_deadline = time.monotonic() + 300
        self._child = None
        self._owned_children = []
        self._stopped_children = set()
        self._context_fds = []
        self._canonical_fd = None

    def _binary(self):
        # Actual fixed original driver observation, not a supplied snapshot.
        # Read the retained reviewed daemon descriptor and execute only its two
        # pure manifest functions. No public dispatcher or module import runs.
        raw = _descriptor_bytes(self._daemon_fd,DAEMON_SHA,1 << 20)
        parsed = ast.parse(raw)
        functions = [n for n in parsed.body if isinstance(n,ast.FunctionDef)
                     and n.name in ('canonical','tree_manifest')]
        require(len(functions) == 2,'DEPLOYED_TREE_ALGORITHM_UNKNOWN')
        scope = {'os':os,'stat':stat,'hashlib':hashlib,'json':json,
                 'require':require,'TREE_MAX_FILES':20000,'TREE_MAX_BYTES':2*(1 << 30)}
        exec(compile(ast.Module(body=functions,type_ignores=[]),'<pinned-ds-tree>','exec'),scope)
        entries,links,dirs,total = scope['tree_manifest'](APP,APP,['node_modules'])
        require(not links,'QUALIFICATION_LINK_UNKNOWN')
        result = hashlib.sha256(scope['canonical']({'dirs':dirs,'entries':entries,
                                                  'links':links,'total':total})).hexdigest()
        _descriptor_bytes(self._daemon_fd,DAEMON_SHA,1 << 20)
        return result

    def _next_context(self,phase):
        require(not self._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
        try:
            require(len(self._used_phases) < len(PHASES)
                    and phase in PHASES and phase == PHASES[len(self._used_phases)],
                    'QUALIFICATION_PHASE_NO_REPLAY')
            meta = os.fstat(self._window_fd)
            _root_regular(meta)
            require((meta.st_dev,meta.st_ino,meta.st_uid,meta.st_mode) == self._window_identity,
                    'ORIGINAL_WINDOW_CHANGED')
            if getattr(self,'_canonical_fd',None) is not None:
                canonical = os.fstat(self._canonical_fd)
                _root_regular(canonical)
                require((canonical.st_dev,canonical.st_ino) == self._canonical_identity,
                        'ORIGINAL_CANONICAL_CHANGED')
            require(self._binary() == self._binding.consuming_binary_sha256,
                    'CONSUMING_BINARY_CHANGED')
            # Consume once before a fallible launch; UNKNOWN cannot retry it.
            self._used_phases.add(phase)
            return _context({'role':'original_executor_qualification','phase':phase,
                'consumingBinarySha256':self._binding.consuming_binary_sha256,
                'validatorSha256':self._binding.validator_sha256,
                'entryManifestSha256':self._binding.manifest_sha256,
                'procedureSha256':PROCEDURE_SHA,'startupNonce':secrets.token_hex(32)})
        except Exception:
            self._unknown = True
            raise

    def _continuity(self):
        require(not self._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
        try:
            require(time.monotonic() < self._operation_deadline,'ORIGINAL_PROCEDURE_DEADLINE')
            meta = os.fstat(self._window_fd)
            _root_regular(meta)
            require((meta.st_dev,meta.st_ino,meta.st_uid,meta.st_mode) == self._window_identity,
                    'ORIGINAL_WINDOW_CHANGED')
            if getattr(self,'_canonical_fd',None) is not None:
                canonical = os.fstat(self._canonical_fd)
                _root_regular(canonical)
                require((canonical.st_dev,canonical.st_ino) == self._canonical_identity,
                        'ORIGINAL_CANONICAL_CHANGED')
            require(self._binary() == self._binding.consuming_binary_sha256,
                    'CONSUMING_BINARY_CHANGED')
            require(time.monotonic() < self._operation_deadline,'ORIGINAL_PROCEDURE_DEADLINE')
        except BaseException:
            self._unknown = True
            raise

    def _stop_owned_child(self):
        # Qualification restart only. Never reconstruct ownership from a PID,
        # invoke kill(pid), or terminate a child after custody became UNKNOWN.
        require(not self._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
        try:
            child = self._child
            require(child is not None and any(child is c for c in self._owned_children),
                    'ORIGINAL_CHILD_UNOWNED')
            require(id(child) not in self._stopped_children,'ORIGINAL_CHILD_NO_REPLAY')
            self._continuity()
            self._stopped_children.add(id(child))  # Claim before the fallible effect.
            deadline = min(self._operation_deadline,time.monotonic() + 30)
            require(child.poll() is None,'ORIGINAL_CHILD_EXIT_UNKNOWN')
            child.terminate()
            remaining = deadline - time.monotonic()
            require(remaining > 0,'ORIGINAL_STOP_DEADLINE')
            child.wait(timeout=remaining)
            require(time.monotonic() < deadline,'ORIGINAL_STOP_DEADLINE')
            self._continuity()
            # Keep the exact known object even after observed exit. Its PID is
            # neither a capability for another process nor proof of LE1.
        except BaseException:
            self._unknown = True
            raise

    def _parent_handoff_type(self):
        parent = _namespace_directory(os.path.dirname(__file__))
        fd = None
        try:
            fd = os.open('handoff.py',os.O_RDONLY | os.O_NOFOLLOW,dir_fd=parent)
            raw = _descriptor_bytes(fd,HANDOFF_SHA)
            scope = {'__name__':'_original_fixed_handoff'}
            exec(compile(raw,'original-fixed-handoff.py','exec'),scope)
            return scope['OneLaunchHandoff']
        finally:
            if fd is not None: os.close(fd)
            os.close(parent)

    def _launch_phase(self,phase):
        require(not self._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
        handoff = None
        parent = None
        try:
            self._continuity()
            require(self._child is None or id(self._child) in self._stopped_children,
                    'ORIGINAL_CHILD_STILL_OWNED')
            context = self._next_context(phase)
            self._phase_context = context
            self._phase_query_used = False
            raw = json.dumps(context,sort_keys=True,separators=(',',':')).encode()
            digest = hashlib.sha256(raw).hexdigest()
            parent = _namespace_directory(os.path.dirname(__file__))
            # Private phase context doubles as an O_EXCL launch claim. It is
            # not a fifth proof output or a qualification receipt. Crash/UNKNOWN
            # cannot recreate it or restart this phase from a supplied log.
            fd = os.open('.qualification-' + phase,os.O_RDWR | os.O_CREAT | os.O_EXCL
                         | os.O_NOFOLLOW,0o600,dir_fd=parent)
            self._context_fds.append(fd)
            require(os.write(fd,raw) == len(raw),'QUALIFICATION_CONTEXT_SHORT_WRITE')
            os.fsync(fd)
            os.fsync(parent)
            require(_descriptor_bytes(fd,digest) == raw,'QUALIFICATION_CONTEXT_CHANGED')
            handoff = self._parent_handoff_type()(digest,self._window_fd,context['startupNonce'])
            self._phase_handoff = handoff
            challenge,window = handoff.take_child_fds()
            self._continuity()
            argv = [NODE,GATED,'--hr-qf-context-sha256',digest,
                    '--hr-qf-challenge-fd',str(challenge),'--hr-qf-window-fd',str(window),
                    '--hr-qf-context-fd',str(fd),'--root','/Users/authsvc/.agent-core']
            # Exact object ownership is acquired from this private callsite,
            # never reconstructed from a pid/JSON field or accepted from caller.
            self._startup_deadline = min(self._operation_deadline,time.monotonic() + 120)
            self._phase_started_wall_ms = int(time.time()*1000)
            child = subprocess.Popen(argv,pass_fds=(challenge,window,fd),
                stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                user=505,group=601,extra_groups=[],env={'PATH':'/usr/bin:/bin'})
            self._child = child
            self._owned_children.append(child)
            handoff.close_child_fds()
            handoff.challenge()  # Existing actual OFD proof, absolute 750ms.
            self._continuity()
            require(child.poll() is None,'ORIGINAL_STARTUP_EXIT_UNKNOWN')
            return child
        except BaseException:
            self._unknown = True
            # Known child, phase claim, window and carrier descriptors remain;
            # failure cannot authorize termination, release, retry or a seal.
            raise
        finally:
            if handoff is not None and getattr(self,'_phase_handoff',None) is not handoff: handoff.close()
            if parent is not None: os.close(parent)

    def _deploy_original(self):
        require(not self._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
        parent = None
        fd = None
        try:
            require(type(QUALIFIED_DEPLOYMENT) is _DeploymentBinding,'ORIGINAL_DEPLOYMENT_UNBOUND')
            require(all(type(v) is str and re.fullmatch('[a-f0-9]{64}',v)
                    for v in (QUALIFIED_DEPLOYMENT.final_binary_sha256,
                              QUALIFIED_DEPLOYMENT.preimage_binary_sha256))
                    and type(QUALIFIED_DEPLOYMENT.rollback_operation_id) is str
                    and re.fullmatch('[A-Za-z0-9_.-]{1,128}',QUALIFIED_DEPLOYMENT.rollback_operation_id),
                    'ORIGINAL_DEPLOYMENT_BINDING_INVALID')
            parent = _namespace_directory(os.path.dirname(__file__))
            fd = os.open('deployment.py',os.O_RDONLY | os.O_NOFOLLOW,dir_fd=parent)
            raw = _descriptor_bytes(fd,DEPLOYMENT_DRIVER_SHA)
            scope = {'__name__':'_original_fixed_deployment',
                'FixedOriginalDriver':FixedOriginalDriver,'QUALIFIED_DEPLOYMENT':QUALIFIED_DEPLOYMENT,
                '_DeploymentBinding':_DeploymentBinding,'require':require,
                '_descriptor_bytes':_descriptor_bytes,'_object':_object,'DAEMON_SHA':DAEMON_SHA,'ID':ID}
            exec(compile(raw,'original-deployment.py','exec'),scope)
            return scope['_deploy_owned'](self)
        except BaseException:
            self._unknown = True
            raise
        finally:
            if fd is not None: os.close(fd)
            if parent is not None: os.close(parent)

    def run(self):
        require(not self._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
        parent = fd = None
        try:
            require(type(QUALIFIED_OWNER_SHA) is str
                    and re.fullmatch('[a-f0-9]{64}',QUALIFIED_OWNER_SHA),
                    'ORIGINAL_OWNER_SELECTOR_UNBOUND')
            require(type(PROCEDURE_DRIVER_SHA) is str
                    and re.fullmatch('[a-f0-9]{64}',PROCEDURE_DRIVER_SHA),
                    'ORIGINAL_PROCEDURE_SOURCE_UNBOUND')
            require(not getattr(self,'_procedure_claimed',False),'ORIGINAL_PROCEDURE_NO_REPLAY')
            self._procedure_claimed = True
            parent = _namespace_directory(os.path.dirname(__file__))
            fd = os.open('procedure.py',os.O_RDONLY | os.O_NOFOLLOW,dir_fd=parent)
            raw = _descriptor_bytes(fd,PROCEDURE_DRIVER_SHA)
            scope = {'__name__':'_original_fixed_procedure','__file__':__file__,
                'FixedOriginalDriver':FixedOriginalDriver,'require':require,'Unknown':Unknown,
                '_namespace_directory':_namespace_directory,'_descriptor_bytes':_descriptor_bytes,
                '_object':_object,'NODE':NODE,'NODE_SHA':NODE_SHA,
                'QUALIFIED_OWNER_SHA':QUALIFIED_OWNER_SHA}
            exec(compile(raw,'original-procedure.py','exec'),scope)
            return scope['_run_owned'](self)
        except BaseException:
            self._unknown = True
            raise
        finally:
            if fd is not None: os.close(fd)
            if parent is not None: os.close(parent)


if __name__ == '__main__':
    # Only the original admitted fixed Root carrier can reach this procedure.
    # All qualification/Owner/deployment selectors remain unbound by default.
    FixedOriginalDriver().run()
