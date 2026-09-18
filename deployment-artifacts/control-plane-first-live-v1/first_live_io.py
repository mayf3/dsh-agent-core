"""Ordinary-user fixed operation I/O; root never opens a caller input path.

Reuses the independently reviewed OP-R1 regular, unlinked fd0 copy boundary.
This module cannot authorize an operation; its caller supplies the exact
Owner-reviewed closed command set and checks all protected pre/postimages.
"""
import hashlib
import os
import stat
import tempfile
from pathlib import Path


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_local(path, expected, maximum=128*1024*1024, nlink=1):
    """Read public package/tool bytes as the ordinary caller; never privileged."""
    require(os.getuid() == os.geteuid() != 0, 'ORDINARY_INPUT_ONLY')
    path=Path(path)
    require(path.is_absolute() and len(path.parts)>1 and '..' not in path.parts
            and 0 < maximum <= 128*1024*1024 and nlink in (1,2), 'LOCAL_INPUT_PATH')
    flags=os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC|os.O_NONBLOCK
    parent=os.open('/',flags|os.O_DIRECTORY)
    fd=None
    try:
        for part in path.parts[1:-1]:
            nxt=os.open(part,flags|os.O_DIRECTORY,dir_fd=parent)
            os.close(parent);parent=nxt
        fd=os.open(path.name,flags,dir_fd=parent)
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink==nlink
                and before.st_uid in (0,os.getuid()) and before.st_mode & 0o022==0
                and 0 < before.st_size <= maximum, 'LOCAL_FILE_METADATA')
        def identity(m):
            return (m.st_dev,m.st_ino,m.st_uid,m.st_gid,m.st_mode,m.st_nlink,m.st_size,
                    m.st_mtime_ns,m.st_ctime_ns,getattr(m,'st_flags',0))
        def read():
            data=bytearray()
            while len(data) <= maximum:
                chunk=os.read(fd,min(1024*1024,maximum+1-len(data)))
                if not chunk:
                    break
                data.extend(chunk)
            require(len(data)==before.st_size,'LOCAL_INPUT_CHANGED')
            return bytes(data)
        data=read();os.lseek(fd,0,os.SEEK_SET)
        require(read()==data and identity(os.fstat(fd))==identity(before)
                and identity(os.stat(path.name,dir_fd=parent,follow_symlinks=False))==identity(before),
                'LOCAL_INPUT_CHANGED')
        require(digest(data)==expected,'LOCAL_DIGEST_MISMATCH')
        return data
    finally:
        if fd is not None:
            os.close(fd)
        os.close(parent)


def install_bytes(data, expected, mode, destination, directory, invoke):
    require(os.getuid() == os.geteuid() != 0, 'ORDINARY_COPY_SOURCE_ONLY')
    require(isinstance(data, bytes) and 0 < len(data) <= 128 * 1024 * 1024
            and digest(data) == expected, 'INSTALL_INPUT_DIGEST')
    require(mode in ('0400', '0555', '0600') and isinstance(destination, str)
            and destination.startswith('/') and '\0' not in destination, 'INSTALL_ARGUMENTS')
    with tempfile.TemporaryFile(dir=directory) as source:
        source.write(data)
        source.flush()
        source.seek(0)
        metadata = os.fstat(source.fileno())
        require(stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 0
                and metadata.st_uid == os.getuid() and stat.S_IMODE(metadata.st_mode) == 0o600
                and metadata.st_size == len(data), 'INSTALL_INPUT_FD')
        require(digest(source.read()) == expected, 'INSTALL_INPUT_DIGEST')
        source.seek(0)
        invoke(['/usr/bin/install', '-o', 'root', '-g', 'wheel', '-m', mode,
                '/dev/fd/0', destination], stdin=source)
