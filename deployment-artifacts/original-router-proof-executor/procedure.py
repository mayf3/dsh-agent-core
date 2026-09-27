"""One private original procedure. No events or proof supplied by a caller."""
import hashlib
import json
import os
import re
import stat
import time
import secrets

OBSERVER_SHA = '2aca63e60bb6bba1d52facfa3e29589ab9dc9108610e34eb8790e45f57663c84'
VALIDATOR = '/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/quiescence-bundle.js'
PROOF_DIRECTORY = '/private/var/db/agent-deploy-system/hr-s256-deployment-proof'


def _validator_after_deploy(owner):
    # Existing original DEPLOY has fixed target UID505/GID601. MI's later
    # immutable root0 promotion is a different phase, never an owner allowlist.
    parts=VALIDATOR.strip('/').split('/')
    directory=os.open('/',os.O_RDONLY | os.O_DIRECTORY)
    opened=[directory]
    fd=None
    try:
        for index,name in enumerate(parts[:-1]):
            directory=os.open(name,os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,dir_fd=directory)
            opened.append(directory)
            meta=os.fstat(directory)
            uid=505 if index >= 4 else 0  # app and descendants only.
            require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == uid
                    and (uid == 0 or meta.st_gid == 601) and not meta.st_mode & 0o022,'ORIGINAL_DEPLOYED_NAMESPACE')
        fd=os.open(parts[-1],os.O_RDONLY | os.O_NOFOLLOW,dir_fd=directory)
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == 505 and before.st_gid == 601
                and not before.st_mode & 0o022 and before.st_nlink == 1
                and 0 < before.st_size <= 65536,'ORIGINAL_DEPLOYED_VALIDATOR_CUSTODY')
        raw=os.pread(fd,before.st_size+1,0)
        identity=lambda m:(m.st_dev,m.st_ino,m.st_mode,m.st_uid,m.st_gid,m.st_nlink,
                           m.st_size,m.st_mtime_ns,m.st_ctime_ns)
        require(len(raw) == before.st_size
                and hashlib.sha256(raw).hexdigest() == owner._binding.validator_sha256
                and identity(os.fstat(fd)) == identity(before)
                and identity(os.stat(parts[-1],dir_fd=directory,follow_symlinks=False)) == identity(before),
                'ORIGINAL_DEPLOYED_VALIDATOR_CHANGED')
    finally:
        if fd is not None:os.close(fd)
        for item in reversed(opened):os.close(item)


def _checked_installation(owner):
    parent=_namespace_directory(os.path.dirname(NODE))
    fd=None
    try:
        fd=os.open(os.path.basename(NODE),os.O_RDONLY | os.O_NOFOLLOW,dir_fd=parent)
        _descriptor_bytes(fd,NODE_SHA,128*(1 << 20))
    finally:
        if fd is not None:os.close(fd)
        os.close(parent)
    _validator_after_deploy(owner)
    owner._continuity()
    owner._validator_installed_wall_ms=int(time.time()*1000)


def _observation(owner):
    parent = _namespace_directory(os.path.dirname(__file__))
    fd = None
    try:
        require(type(OBSERVER_SHA) is str and re.fullmatch('[a-f0-9]{64}',OBSERVER_SHA),
                'ORIGINAL_OBSERVER_UNBOUND')
        fd = os.open('observations.py',os.O_RDONLY | os.O_NOFOLLOW,dir_fd=parent)
        raw = _descriptor_bytes(fd,OBSERVER_SHA)
        scope = {'__name__':'_original_owned_observation','__file__':__file__,
            'require':require,'FixedOriginalDriver':FixedOriginalDriver,
            '_namespace_directory':_namespace_directory,'_descriptor_bytes':_descriptor_bytes,
            '_object':_object,'NODE':NODE,'QUALIFIED_OWNER_SHA':QUALIFIED_OWNER_SHA}
        exec(compile(raw,'original-observations.py','exec'),scope)
        return scope['_observe_owned'](owner)
    finally:
        if fd is not None: os.close(fd)
        os.close(parent)


def _completed_turn(owner):
    while True:
        owner._continuity()
        require(time.monotonic() < owner._startup_deadline,'ORIGINAL_STARTUP_DEADLINE')
        value = _observation(owner)
        owner._continuity()
        require(time.monotonic() < owner._startup_deadline,'ORIGINAL_STARTUP_DEADLINE')
        if value is not None: return value
        # Wait only for the legitimate external Owner event. Never send/replay.
        time.sleep(min(0.1,owner._startup_deadline-time.monotonic()))


def _checked_turn(value, previous, owner):
    require(type(value) is dict and set(value) == {'floor','maxIssuedTurnSeq','live','evicted',
        'watermark','turnExecutionId','processGeneration','nativeMessageSha256',
        'nativeReceiptSha256','completedAtWallMs'},'ORIGINAL_OBSERVATION_SHAPE')
    for name in ('floor','maxIssuedTurnSeq','processGeneration','completedAtWallMs'):
        require(type(value[name]) is int and value[name] > 0,'ORIGINAL_OBSERVATION_INTEGER')
    require(value['floor'] == value['processGeneration']
            and value['completedAtWallMs'] >= owner._phase_started_wall_ms,
            'ORIGINAL_GENERATION_OR_EVENT_STALE')
    require(type(value['turnExecutionId']) is str and bool(value['turnExecutionId']),
            'ORIGINAL_TURN_HANDLE_UNKNOWN')
    require(all(type(value[k]) is str and re.fullmatch('[a-f0-9]{64}',value[k])
                for k in ('nativeMessageSha256','nativeReceiptSha256')),
            'ORIGINAL_NATIVE_RECEIPT_UNKNOWN')
    require(type(value['live']) is list and type(value['evicted']) is list
            and (value['watermark'] is None or type(value['watermark']) is int),
            'ORIGINAL_STORE_RANGES_UNKNOWN')
    if previous is not None:
        require(value['processGeneration'] > previous['processGeneration']
                and value['maxIssuedTurnSeq'] > previous['maxIssuedTurnSeq']
                and all(value[k] != previous[k] for k in
                    ('turnExecutionId','nativeMessageSha256','nativeReceiptSha256')),
                'ORIGINAL_RESTART_OR_TURN_REPLAY')
    return value


def _seal_owned(owner):
    owner._continuity()
    require(len(owner._procedure_turns) == 3,'ORIGINAL_PROCEDURE_INCOMPLETE')
    parent = _namespace_directory(PROOF_DIRECTORY)
    opened = []
    try:
        now = int(time.time()*1000)
        require(now >= owner._validator_installed_wall_ms
                and all(now >= turn['completedAtWallMs'] for turn in owner._procedure_turns),
                'ORIGINAL_WALL_ORDER_UNKNOWN')
        # Claim BOTH fixed existing output names before writing either. Existing
        # files, crash remnants and ambiguous partial publication never replay.
        for name in ('floor-proven.json','validator-installed.json'):
            opened.append(os.open(name,os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                                  0o600,dir_fd=parent))
        values = ({'status':'ROUTER_RESTART_SAFETY=PROVEN','floorCommit':'2097e4f9',
            'deployedBinarySha256':owner._binding.consuming_binary_sha256,'provedAtWallMs':now},
            {'evidenceKind':'restart_quiescence_proven',
             'deployedBinarySha256':owner._binding.consuming_binary_sha256,
             'installedAtWallMs':owner._validator_installed_wall_ms})
        for fd,value in zip(opened,values):
            owner._continuity()
            raw=json.dumps(value,sort_keys=True,separators=(',',':')).encode()
            require(os.write(fd,raw) == len(raw),'ORIGINAL_PROOF_SHORT_WRITE')
            os.fsync(fd)
            require(_descriptor_bytes(fd,hashlib.sha256(raw).hexdigest()) == raw,
                    'ORIGINAL_PROOF_READBACK_UNKNOWN')
        os.fsync(parent)
        owner._continuity()
        return values
    finally:
        for fd in opened: os.close(fd)
        os.close(parent)


def _sequence_owned(owner):
    require(type(owner) is FixedOriginalDriver and not owner._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
    try:
        require(type(OBSERVER_SHA) is str and re.fullmatch('[a-f0-9]{64}',OBSERVER_SHA),
                'ORIGINAL_OBSERVER_UNBOUND')
        owner._procedure_turns = []
        owner._observed_runtimes = set()
        # Only this actual owned callsite installs the private prelaunch check.
        owner._verify_installed = lambda: _checked_installation(owner)
        owner._deploy_original()
        for index,phase in enumerate(('deployment_start','restart_a','restart_b')):
            if index:
                owner._stop_owned_child()
                owner._launch_phase(phase)
            value=_completed_turn(owner)
            runtime=_owned_turn(owner,value)
            owner._health_original()  # Actual retained original health callsite.
            require(runtime not in getattr(owner,'_observed_runtimes',set()),'ORIGINAL_RUNTIME_REUSED')
            owner._observed_runtimes.add(runtime)
            previous=owner._procedure_turns[-1] if owner._procedure_turns else None
            owner._procedure_turns.append(_checked_turn(value,previous,owner))
        owner._stop_owned_child()  # Final finite qualification child, before seal.
        owner._continuity()
        return _seal_owned(owner)
    except BaseException:
        owner._unknown = True
        raise


def _owned_turn(owner, value):
    owner._continuity()
    deadline=min(owner._operation_deadline,owner._startup_deadline,time.monotonic()+15)
    require(time.monotonic() < deadline,'ORIGINAL_READBACK_DEADLINE')
    require(owner._child is not None and any(owner._child is c for c in owner._owned_children)
            and owner._child.poll() is None,'ORIGINAL_CHILD_UNOWNED')
    require(not getattr(owner,'_phase_query_used',False),'ORIGINAL_READBACK_NO_REPLAY')
    owner._phase_query_used = True
    challenge=secrets.token_hex(16)
    query={'context':owner._phase_context,'challenge':challenge,'handle':value['turnExecutionId'],
           'deadlineMonotonicNs':str(int(deadline*1_000_000_000))}
    channel=owner._phase_handoff.root  # Exact socket from our actual OFD challenge.
    channel.settimeout(deadline-time.monotonic())
    channel.sendall(json.dumps(query,sort_keys=True,separators=(',',':')).encode()+b'\n')
    raw=bytearray()
    while not raw.endswith(b'\n'):
        remaining=deadline-time.monotonic()
        require(remaining > 0,'ORIGINAL_READBACK_DEADLINE')
        channel.settimeout(remaining)
        block=channel.recv(4097-len(raw))
        require(bool(block) and len(raw)+len(block) <= 4096,'ORIGINAL_READBACK_BOUND')
        raw.extend(block)
    require(raw.count(b'\n') == 1,'ORIGINAL_READBACK_SHAPE')
    frame=_object(bytes(raw))
    require(set(frame) == {'context','challenge','handle','runtimeGeneration','processGeneration',
            'nativeMessageSha256','nativeReceiptSha256','completedAtWallMs','replyReceiptSha256'}
            and frame['context'] == owner._phase_context and frame['challenge'] == challenge
            and frame['handle'] == value['turnExecutionId']
            and all(type(frame[k]) is type(value[k]) and frame[k] == value[k] for k in
                ('processGeneration','nativeMessageSha256','nativeReceiptSha256','completedAtWallMs'))
            and type(frame['runtimeGeneration']) is str and 0 < len(frame['runtimeGeneration']) <= 128,
            'ORIGINAL_OWNED_RUNTIME_MISMATCH')
    require(type(frame['replyReceiptSha256']) is str
            and re.fullmatch('[a-f0-9]{64}',frame['replyReceiptSha256']),
            'ORIGINAL_REPLY_RECEIPT_UNKNOWN')
    require(time.monotonic() < deadline,'ORIGINAL_READBACK_DEADLINE')
    owner._continuity()
    require(owner._child.poll() is None,'ORIGINAL_CHILD_EXIT_UNKNOWN')
    owner._phase_handoff.close()  # Private query copy only; original custody remains.
    return frame['runtimeGeneration']


def _run_owned(owner):
    return _sequence_owned(owner)
