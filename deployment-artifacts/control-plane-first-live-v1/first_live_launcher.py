"""Fixed source-only launcher. Invoke only with system Python -I -S -B.

Only the standard library is imported before all eight exact package sources
have been authenticated. Local modules compile verified bytes, never .pyc.
"""
import hashlib
import importlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys

FILES=frozenset({'first_live_launcher.py','first_live_os.py','first_live_io.py','first_live_operator.py',
    'first_live_package.py','bind_records.py','broker_first_delivery.py','broker_delivery_io.py'})
LIMIT=16*1024*1024


def require(ok,reason):
    if not ok:raise RuntimeError(reason)


def sha(raw):return hashlib.sha256(raw).hexdigest()


def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()


def identity(m):
    return (m.st_dev,m.st_ino,m.st_uid,m.st_gid,m.st_mode,m.st_nlink,m.st_size,
            m.st_mtime_ns,m.st_ctime_ns,getattr(m,'st_flags',0))


def open_package(path):
    require(path.is_absolute() and '..' not in path.parts,'PACKAGE_PATH')
    fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_CLOEXEC)
    try:
        for part in path.parts[1:]:
            nxt=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
            os.close(fd);fd=nxt
        m=os.fstat(fd)
        require(m.st_uid==502 and m.st_gid==20 and stat.S_IMODE(m.st_mode)==0o700
                and getattr(m,'st_flags',0)==0,'PACKAGE_METADATA')
        return fd
    except BaseException:os.close(fd);raise


def read_source(parent,name,expected):
    require(re.fullmatch('[0-9a-f]{64}',expected) and expected!='0'*64,'DIGEST_FORMAT')
    fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC|os.O_NONBLOCK,dir_fd=parent)
    try:
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid==502 and before.st_gid==20 and
            before.st_nlink==1 and stat.S_IMODE(before.st_mode) in (0o400,0o500) and
            getattr(before,'st_flags',0)==0 and 0<before.st_size<=LIMIT,'SOURCE_METADATA')
        raw=bytearray()
        while len(raw)<=LIMIT:
            part=os.read(fd,min(1024*1024,LIMIT+1-len(raw)))
            if not part:break
            raw.extend(part)
        require(len(raw)==before.st_size and sha(raw)==expected,'SOURCE_DIGEST')
        require(identity(os.fstat(fd))==identity(before) and
            identity(os.stat(name,dir_fd=parent,follow_symlinks=False))==identity(before),'SOURCE_CHANGED')
        return bytes(raw)
    finally:os.close(fd)


def unique(pairs):
    result={}
    for key,value in pairs:
        require(key not in result,'DUPLICATE_JSON_KEY');result[key]=value
    return result


class VerifiedSources:
    """Private import hook backed only by already authenticated immutable bytes."""
    def __init__(self,package,sources):
        self.package=package
        self.sources={name[:-3]:raw for name,raw in sources.items() if name!='first_live_launcher.py'}

    def find_spec(self,fullname,path=None,target=None):
        if fullname in self.sources:
            return importlib.util.spec_from_loader(fullname,self,origin=str(self.package/(fullname+'.py')))
        return None

    def create_module(self,spec):return None

    def exec_module(self,module):
        name=module.__spec__.name
        require(name in self.sources,'UNLISTED_SOURCE')
        path=str(self.package/(name+'.py'))
        module.__file__=path;module.__cached__=None;module.__package__=''
        exec(compile(self.sources[name],path,'exec',dont_inherit=True),module.__dict__)


def main():
    require(sys.flags.isolated and sys.flags.no_site and sys.flags.dont_write_bytecode
            and sys.flags.ignore_environment and sys.flags.no_user_site,'ISOLATED_SYSTEM_PYTHON_REQUIRED')
    require(os.getuid()==os.geteuid()==502 and os.getgid()==os.getegid()==20
            and 1 not in os.getgroups(),'UID502_GID20_REQUIRED')
    require(len(sys.argv)==3 and sys.argv[1] in ('--execute-exact','--broker-exact'),'EXACT_ENTRY_ARGUMENTS')
    # Apple's fixed /usr/bin entry dispatches to this observed CLT interpreter.
    require(Path(sys.executable)==Path('/Library/Developer/CommandLineTools/usr/bin/python3'),'SYSTEM_PYTHON_REQUIRED')
    package=Path(__file__).absolute().parent
    require(str(package) not in sys.path and '' not in sys.path,'LOCAL_IMPORT_PATH_FORBIDDEN')
    parent=open_package(package)
    try:
        raw=read_source(parent,'manifest.json',sys.argv[2])
        manifest=json.loads(raw,object_pairs_hook=unique)
        require(type(manifest) is dict and canonical(manifest)==raw and type(manifest.get('version')) is int and manifest['version']==1
                and manifest.get('operation_id')=='first-live-dsh-20260918-01','MANIFEST_BINDING')
        require(type(manifest.get('operator_files')) is dict and set(manifest['operator_files'])==FILES,'SOURCE_SET')
        sources={name:read_source(parent,name,manifest['operator_files'][name]) for name in sorted(FILES)}
    finally:os.close(parent)
    importer=VerifiedSources(package,sources)
    require(not (set(importer.sources)&set(sys.modules)),'PRELOADED_LOCAL_MODULE')
    sys.meta_path.insert(0,importer)
    # Keep the finder installed through the actual operation for its later local imports.
    if sys.argv[1]=='--execute-exact':
        importlib.import_module('first_live_operator').main()
    else:
        sys.argv=[str(package/'broker_first_delivery.py')]
        importlib.import_module('broker_delivery_io').main()


if __name__=='__main__':main()
