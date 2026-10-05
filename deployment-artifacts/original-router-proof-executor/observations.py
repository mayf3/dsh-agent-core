"""Fixed original driver's direct store/native observation; no accept-events."""
import os
import stat
import select
import subprocess
import time
import hashlib
import re

STORE_PARTS = ('Users','authsvc','.agent-core','control')
SCRIPT_SHA = 'ba0d2e1b21594b15af6e9c1a87dc12c870a5bf167cf1257e64bfb15160f3567c'


def _observe_owned(owner):
    require(type(owner) is FixedOriginalDriver and not owner._unknown,
            'ORIGINAL_CUSTODY_UNKNOWN')
    require(type(QUALIFIED_OWNER_SHA) is str and re.fullmatch('[a-f0-9]{64}',QUALIFIED_OWNER_SHA),
            'ORIGINAL_OWNER_SELECTOR_UNBOUND')
    owner._continuity()
    require(time.monotonic() < owner._startup_deadline,'ORIGINAL_READBACK_DEADLINE')
    require(owner._child is not None and owner._child.poll() is None,
            'ORIGINAL_CHILD_EXIT_UNKNOWN')
    parent = _namespace_directory(os.path.dirname(__file__))
    script_fd = None
    directories = []
    store_fd = None
    child = None
    try:
        script_fd = os.open('observation.mjs',os.O_RDONLY | os.O_NOFOLLOW,dir_fd=parent)
        script = _descriptor_bytes(script_fd,SCRIPT_SHA)
        directory = os.open('/',os.O_RDONLY | os.O_DIRECTORY)
        directories.append(directory)
        for index,name in enumerate(STORE_PARTS):
            directory = os.open(name,os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,dir_fd=directory)
            directories.append(directory)
            meta = os.fstat(directory)
            require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == (0 if index == 0 else 505)
                    and not meta.st_mode & 0o022,'ORIGINAL_STORE_NAMESPACE')
        store_fd = os.open('turn-recovery-v3.json',os.O_RDONLY | os.O_NOFOLLOW,dir_fd=directory)
        before = os.fstat(store_fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == 505
                and before.st_gid == 601 and stat.S_IMODE(before.st_mode) == 0o600
                and before.st_nlink == 1 and 0 < before.st_size <= 16*(1 << 20),
                'ORIGINAL_STORE_CUSTODY')
        def digest_store():
            digest = hashlib.sha256()
            offset = 0
            while offset < before.st_size:
                block = os.pread(store_fd,min(65536,before.st_size-offset),offset)
                require(bool(block),'ORIGINAL_STORE_SHORT_READ')
                offset += len(block);digest.update(block)
            return digest.hexdigest()
        digest = digest_store()
        deadline = min(owner._operation_deadline,owner._startup_deadline,time.monotonic() + 15)
        require(time.monotonic() < deadline,'ORIGINAL_READBACK_DEADLINE')
        child = subprocess.Popen([NODE,'--input-type=module','-',f'/dev/fd/{store_fd}',
            QUALIFIED_OWNER_SHA,str(owner._phase_started_wall_ms)],
            pass_fds=(store_fd,),stdin=subprocess.PIPE,stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,user=505,group=601,extra_groups=[],env={'PATH':'/usr/bin:/bin'})
        child.stdin.write(script)
        child.stdin.close()
        output = bytearray()
        while True:
            remaining = deadline-time.monotonic()
            require(remaining > 0 and select.select([child.stdout],[],[],remaining)[0],
                    'ORIGINAL_READBACK_DEADLINE')
            block = os.read(child.stdout.fileno(),65537-len(output))
            if not block: break
            output.extend(block)
            require(len(output) <= 65536,'ORIGINAL_READBACK_BOUND')
        remaining = deadline-time.monotonic()
        require(remaining > 0 and child.wait(timeout=remaining) == 0,
                'ORIGINAL_OBSERVATION_UNKNOWN')
        require(time.monotonic() < deadline,'ORIGINAL_READBACK_DEADLINE')
        identity = lambda m:(m.st_dev,m.st_ino,m.st_mode,m.st_uid,m.st_gid,m.st_nlink,
                             m.st_size,m.st_mtime_ns,m.st_ctime_ns)
        require(digest_store() == digest and identity(os.fstat(store_fd)) == identity(before)
                and identity(os.stat('turn-recovery-v3.json',dir_fd=directory,
                                     follow_symlinks=False)) == identity(before),
                'ORIGINAL_STORE_CHANGED')
        require(_descriptor_bytes(script_fd,SCRIPT_SHA) == script,'ORIGINAL_OBSERVER_CHANGED')
        owner._continuity()
        value = _object(bytes(output))
        if value == {'waiting':True}: return None
        require(set(value) == {'floor','maxIssuedTurnSeq','live','evicted','watermark',
                'turnExecutionId','processGeneration','nativeMessageSha256',
                'nativeReceiptSha256','completedAtWallMs'},'ORIGINAL_OBSERVATION_SHAPE')
        return value
    finally:
        # This is the exact readonly probe object, never the owned Runtime.
        if child is not None:
            if child.poll() is None: child.kill()
            child.wait(timeout=max(0.001,deadline-time.monotonic()))
            child.stdout.close()
        if store_fd is not None: os.close(store_fd)
        for fd in reversed(directories): os.close(fd)
        if script_fd is not None: os.close(script_fd)
        os.close(parent)
