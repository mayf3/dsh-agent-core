"""Ordinary UID502 transport for one exact Owner-reviewed first-live package.

No authorization is minted here. The main entry must first verify --execute-exact
against manifest.json. Root receives only closed argv and verified unlinked fd0.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import selectors
import stat
import subprocess
import sys
import tempfile
import time
from first_live_io import read_local, require
from first_live_package import EXECUTION_ID, OPERATION, PREDECESSOR

STAT_FORMAT = '%u|%g|%p|%l|%f|%z|%m|%c|%i|%B|%d|%HT'
LIMIT = 128 * 1024 * 1024
TOOLS = {'/bin/cat','/bin/chmod','/bin/launchctl','/bin/ls','/bin/mkdir','/bin/mv','/bin/sync',
         '/usr/bin/install','/usr/bin/python3','/usr/bin/shasum','/usr/bin/stat','/usr/bin/sudo'}
HANDOFF = '/private/var/run/agent-deployd/broker-first-delivery.json'
NATIVE = '/usr/local/libexec/agent-deployd/agent-deployd'
CODEX = '/usr/local/libexec/agent-deployd/codex'
SOCKET_DIRECTORY_INSTALL = ['/usr/bin/install','-d','-o','root','-g','602','-m','0750','/private/var/run/agent-deployd']
BROKER_LOADER = '''import hashlib,os,stat,sys
fd=int(sys.argv[1]);expected=sys.argv[2];manifest=sys.argv[3];logical=sys.argv[4];mode=sys.argv[5]
def require(value,reason):
    if not value:raise RuntimeError(reason)
identity=lambda value:(value.st_dev,value.st_ino,value.st_uid,value.st_gid,value.st_mode,value.st_nlink,
    value.st_size,value.st_mtime_ns,value.st_ctime_ns,getattr(value,"st_flags",0))
before=os.fstat(fd)
require(stat.S_ISREG(before.st_mode) and before.st_uid==502 and before.st_gid==20 and before.st_nlink==1
    and stat.S_IMODE(before.st_mode) in (0o400,0o500) and getattr(before,"st_flags",0)==0
    and 0<before.st_size<=16777216,"LAUNCHER_METADATA")
raw=bytearray()
while len(raw)<=16777216:
    chunk=os.read(fd,min(1048576,16777217-len(raw)))
    if not chunk:break
    raw.extend(chunk)
require(len(raw)==before.st_size and identity(os.fstat(fd))==identity(before)
    and hashlib.sha256(raw).hexdigest()==expected,"LAUNCHER_DIGEST")
sys.argv=[logical,mode,manifest]
namespace={"__name__":"__main__","__file__":logical,"__package__":None,"__cached__":None}
exec(compile(bytes(raw),logical,"exec",dont_inherit=True),namespace)'''


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()


def exact_digest(value, length=64):
    require(isinstance(value,str) and re.fullmatch('[0-9a-f]{'+str(length)+'}',value), 'DIGEST_FORMAT')


def ordinary():
    require(os.getuid()==os.geteuid()==502 and os.getgid()==os.getegid()==20 and
            1 not in os.getgroups(),'UID502_GID20_REQUIRED')
    user=pwd.getpwuid(502)
    require(user.pw_uid==502 and user.pw_gid==20 and Path(user.pw_dir).is_absolute(),'PASSWD_BINDING')
    return user.pw_dir


def directory(path):
    path=Path(path)
    require(path.is_absolute() and '..' not in path.parts,'ABSOLUTE_DIRECTORY_REQUIRED')
    fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_CLOEXEC)
    try:
        for name in path.parts[1:]:
            nxt=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
            os.close(fd);fd=nxt
        return fd
    except BaseException:
        os.close(fd);raise


def tuple_of(m):
    return (m.st_dev,m.st_ino,m.st_mode,m.st_uid,m.st_gid,m.st_nlink,m.st_size,
            m.st_mtime_ns,m.st_ctime_ns,getattr(m,'st_flags',0))


class OperatorIO:
    def __init__(self, manifest, package_path, journal_path):
        self.manifest=copy.deepcopy(manifest)
        self.manifest_digest=sha(canonical(self.manifest))
        self.package=Path(package_path);self.journal=Path(journal_path)
        self.home=ordinary();self.journal_fd=None;self.stopped=False
        self.sequence=0;self.auth_count=0;self.current_phase='entry'
        self.started=time.monotonic();self.last_tick=self.started
        self.initial_wall=time.time();self.last_now=self.initial_wall
        self.env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','HOME':self.home,'LANG':'C','LC_ALL':'C'}
        require(self.package.is_absolute() and self.journal==Path(self.home)/'.agent-deploy-first-live-operator'/EXECUTION_ID,'ABSOLUTE_PATH_REQUIRED')
        m=self.manifest
        require(m.get('version')==1 and m.get('operation_id')==OPERATION,'MANIFEST_BINDING')
        require(m.get('execution_id')==EXECUTION_ID and m.get('predecessor')==PREDECESSOR,'SUCCESSOR_BINDING')
        exact_digest(m['source_sha'],40);exact_digest(m['source_tree'],40)
        for key in ('operator_files','files','tool_files'):
            require(type(m[key]) is dict,'MANIFEST_MAP')
        for key in ('root_argv_allowlist','ordinary_argv_allowlist'):
            rows=m[key]
            require(type(rows) is list and all(type(row) is list and row and
                all(type(v) is str and v and '\0' not in v for v in row) for row in rows), 'ARGV_SCHEMA')
            require(len({tuple(row) for row in rows})==len(rows),'ARGV_DUPLICATE')
        require(m['ordinary_argv_allowlist']==[['/usr/bin/python3','-I','-S','-B',str(self.package/'first_live_launcher.py'),'--broker-exact']],'ORDINARY_ARGV')
        for row in m['root_argv_allowlist']:
            require(row[0] in TOOLS-{'/usr/bin/sudo','/usr/bin/python3'} or
                row in ([NATIVE,'--first-live-recovery-and-enable'],[NATIVE,'--first-live-completion']), 'ROOT_PROGRAM')
            if row[0]=='/usr/bin/install' and row!=SOCKET_DIRECTORY_INSTALL:
                require(len(row)==9 and row[:3]==['/usr/bin/install','-o','root'] and
                    row[3]=='-g' and row[5]=='-m' and row[7]=='/dev/fd/0' and
                    ((row[4]=='wheel' and row[6] in ('0400','0555','0600')) or
                     (row[4]=='20' and row[6]=='0440' and row[8]==HANDOFF)),'INSTALL_ARGV')

    def now(self):
        tick=time.monotonic()
        require(tick>=self.last_tick,'MONOTONIC_ROLLBACK');self.last_tick=tick
        self.last_now=max(time.time(),self.initial_wall+tick-self.started,self.last_now)
        return int(self.last_now)

    def _package_inputs(self,full=True):
        m=self.manifest
        path=self.package/'manifest.json'
        require(sha(canonical(m))==self.manifest_digest,'MANIFEST_MEMORY_DRIFT')
        raw=read_local(path,self.manifest_digest)
        require(json.loads(raw)==m,'MANIFEST_DRIFT')
        require(Path(__file__).absolute()==self.package/'first_live_os.py','OPERATOR_LOCATION')
        required={'first_live_os.py','first_live_io.py','first_live_operator.py','broker_first_delivery.py',
            'broker_delivery_io.py','first_live_package.py','bind_records.py','first_live_launcher.py',
            'p4r14_reconcile.py'}
        require(required==set(m['operator_files']),'OPERATOR_SET')
        for name,digest in m['operator_files'].items():
            require(re.fullmatch(r'[a-z0-9_]+\.py',name),'OPERATOR_NAME');exact_digest(digest)
            p=self.package/name;read_local(p,digest)
            meta=p.lstat()
            require(meta.st_uid==502 and stat.S_IMODE(meta.st_mode) in (0o400,0o500) and
                    getattr(meta,'st_flags',0)==0,'OPERATOR_METADATA')
        for name,row in (m['files'].items() if full else []):
            parts=Path(name).parts
            require(parts and not Path(name).is_absolute() and all(p not in ('..','.') for p in parts),'PACKAGE_FILE_NAME')
            exact_digest(row['sha256'])
            raw=read_local(self.package/name,row['sha256'])
            require(len(raw)==row['size'],'PACKAGE_FILE_SIZE')

    def _tool(self,path,row):
        p=Path(path)
        before=p.lstat()
        require(stat.S_ISREG(before.st_mode),'TOOL_TYPE')
        for key,actual in [('uid',before.st_uid),('gid',before.st_gid),('mode',stat.S_IMODE(before.st_mode)),
            ('nlink',before.st_nlink),('flags',getattr(before,'st_flags',0)),('size',before.st_size)]:
            require(row[key]==actual,'TOOL_METADATA:'+key)
        require(before.st_uid==0 and before.st_gid==0 and not before.st_mode & 0o022,'TOOL_OWNER_MODE')
        if path=='/usr/bin/sudo':
            require(row['sha256'] is None and row['digest_state']=='ONLY_AUTHORIZED_PROTECTED_PREFIX_MAY_OBSERVE'
                    and stat.S_IMODE(before.st_mode)==0o4511,'SUDO_METADATA_ONLY')
        else:
            exact_digest(row['sha256'])
            fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK|os.O_CLOEXEC)
            try:
                require(tuple_of(os.fstat(fd))==tuple_of(before) and 0<before.st_size<=LIMIT,'TOOL_OPEN_DRIFT')
                raw=bytearray()
                while len(raw)<=LIMIT:
                    chunk=os.read(fd,min(1024*1024,LIMIT+1-len(raw)))
                    if not chunk:break
                    raw.extend(chunk)
                require(len(raw)==before.st_size and sha(raw)==row['sha256'] and
                        tuple_of(os.fstat(fd))==tuple_of(before),'TOOL_DIGEST_DRIFT')
            finally:os.close(fd)
        require(tuple_of(p.lstat())==tuple_of(before),'TOOL_PATH_DRIFT')

    def _acl(self,path):
        status,out,err=self._invoke(['/bin/ls','-ldeO',str(path)],visible=False,stdin=None)
        require(status==0 and not err and len(out.decode().splitlines())==1,'TOOL_ACL')

    def _validate_tools(self,paths=None):
        require(set(self.manifest['tool_files'])==TOOLS,'TOOL_SET')
        for ancestor in ('/','/usr','/usr/bin','/bin'):
            m=Path(ancestor).lstat()
            require(stat.S_ISDIR(m.st_mode) and m.st_uid==0 and not m.st_mode & 0o022,'TOOL_ANCESTOR')
        selected=TOOLS if paths is None else set(paths)|{'/usr/bin/sudo','/bin/ls'}
        require(selected<=TOOLS,'TOOL_SET')
        for path in selected:self._tool(path,self.manifest['tool_files'][path])
        # The already hash-checked fixed ls runs only as ordinary UID502 here.
        for path in sorted(selected|{'/','/usr','/usr/bin','/bin'}):
            self._acl(path)
            if path in TOOLS:self._tool(path,self.manifest['tool_files'][path])

    def local_validate(self):
        require(ordinary()==self.home,'HOME_DRIFT')
        fd=directory(self.package)
        try:
            m=os.fstat(fd)
            require(m.st_uid==502 and stat.S_IMODE(m.st_mode)==0o700,'PACKAGE_DIRECTORY')
        finally:os.close(fd)
        self._package_inputs();self._validate_tools()
        return True

    def claim(self):
        require(self.journal_fd is None and not self.stopped,'ATTEMPT_CONSUMED')
        self.local_validate()
        home=directory(Path(self.home))
        try:
            try:os.mkdir('.agent-deploy-first-live-operator',0o700,dir_fd=home);os.fsync(home)
            except FileExistsError:pass
            parent=os.open('.agent-deploy-first-live-operator',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=home)
        finally:os.close(home)
        m=os.fstat(parent)
        if not (m.st_uid==502 and stat.S_IMODE(m.st_mode)==0o700 and getattr(m,'st_flags',0)==0):
            os.close(parent);raise RuntimeError('JOURNAL_PARENT_METADATA')
        try:
            self._acl(self.journal.parent)
            os.mkdir(self.journal.name,mode=0o700,dir_fd=parent);os.fsync(parent)
            self.journal_fd=os.open(self.journal.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=parent)
        finally:os.close(parent)
        self.journal_identity=(os.fstat(self.journal_fd).st_dev,os.fstat(self.journal_fd).st_ino)
        self.record('claim.json',{'operation_id':self.manifest['operation_id'],
            'execution_id':self.manifest['execution_id'],'predecessor':self.manifest['predecessor'],
            'manifest_digest':sha(canonical(self.manifest)),'observed_at':self.now(),'retry_forbidden':True})

    def record(self,name,publicvalue):
        ordinary();require(self.journal_fd is not None,'ATTEMPT_NOT_CLAIMED')
        require(re.fullmatch('[a-zA-Z0-9_.-]{1,160}',name) and name not in ('.','..'),'RECORD_NAME')
        meta=self.journal.lstat()
        require((meta.st_dev,meta.st_ino)==self.journal_identity and stat.S_ISDIR(meta.st_mode)
                and meta.st_uid==502 and stat.S_IMODE(meta.st_mode)==0o700,'JOURNAL_DRIFT')
        data=canonical(publicvalue);require(len(data)<=1024*1024,'RECORD_BOUND')
        fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600,dir_fd=self.journal_fd)
        with os.fdopen(fd,'wb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
        os.fsync(self.journal_fd)

    def phase(self,name):
        require(re.fullmatch('[a-z0-9-]{1,60}',name),'PHASE_NAME')
        self.record('phase-'+name+'.json',{'phase':name,'observed_at':self.now()});self.current_phase=name

    def _ready(self,argv=None):
        require(self.journal_fd is not None and not self.stopped,'ATTEMPT_NOT_ACTIVE')
        require(ordinary()==self.home,'HOME_DRIFT')
        self._package_inputs(full=False)
        relevant={argv[0]} if argv and argv[0] in TOOLS else set()
        self._validate_tools(relevant)
        if argv and argv[0]==NATIVE:
            row=self.manifest['files']['agent-deployd']
            raw=read_local(self.package/'agent-deployd',row['sha256'])
            require(len(raw)==row['size'],'PACKAGE_FILE_SIZE')

    def _invoke(self,argv,*,visible,stdin,pass_fds=(),timeout=120):
        if visible:
            require(stdin is None and not pass_fds and sys.stdin.isatty() and sys.stdout.isatty(),
                    'VISIBLE_TTY_REQUIRED')
            result=subprocess.run(argv,env=self.env,cwd='/',close_fds=True,check=False)
            return result.returncode,b'',b''
        p=subprocess.Popen(argv,env=self.env,cwd='/',stdin=stdin if stdin is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,close_fds=True,pass_fds=pass_fds)
        selector=selectors.DefaultSelector();data=[bytearray(),bytearray()]
        try:
            for i,stream in enumerate((p.stdout,p.stderr)):selector.register(stream,selectors.EVENT_READ,i)
            end=time.monotonic()+timeout
            while selector.get_map() or p.poll() is None:
                require(time.monotonic()<end,'COMMAND_TIMEOUT')
                for key,_ in selector.select(min(0.1,max(0,end-time.monotonic()))):
                    raw=os.read(key.fileobj.fileno(),65536)
                    if not raw:selector.unregister(key.fileobj);continue
                    data[key.data].extend(raw);require(len(data[key.data])<=LIMIT,'OUTPUT_BOUND')
            return p.returncode,bytes(data[0]),bytes(data[1])
        except BaseException:
            if p.poll() is None:
                p.kill()
                try:p.wait(timeout=2)
                except subprocess.TimeoutExpired:pass
            raise
        finally:
            selector.close();p.stdout.close();p.stderr.close()

    def _command(self,argv,*,visible=False,stdin=None,expected_digest=None,missing=False,
                 pass_fds=(),timeout=120):
        self.sequence+=1;name=f'{self.sequence:04d}-{self.current_phase}'
        self.record(name+'-intent.json',{'argv':argv,'visible':visible,'observed_at':self.now()})
        try:
            status,out,err=self._invoke(argv,visible=visible,stdin=stdin,pass_fds=pass_fds,timeout=timeout)
            require(len(out)<=LIMIT and len(err)<=LIMIT,'OUTPUT_BOUND')
            self.record(name+'-result.json',{'exit':status,'stdout_sha256':sha(out),'stdout_size':len(out),
                'stderr_sha256':sha(err),'stderr_size':len(err),'contents_retained':False,'visible':visible})
            if missing and status!=0:
                command=argv[2:] if argv[:2]==['/usr/bin/sudo','-n'] else argv
                stat_absence=command[:3]==['/usr/bin/stat','-f',STAT_FORMAT] and status==1 and b'No such file or directory' in err
                job_absence=command==['/bin/launchctl','print','system/ai.agent-deployd'] and status==113 and b'Could not find service' in err
                require(not out and b'Permission denied' not in err and (stat_absence or job_absence),'ABSENCE_UNPROVEN')
                return None
            require(status==0,'COMMAND_FAILED')
            require(expected_digest is None or sha(out)==expected_digest,'PROTECTED_DIGEST')
            return out
        except BaseException as error:
            self.stopped=True
            self.record(name+'-unknown.json',{'state':'STOP_RECONCILE','error_type':type(error).__name__,'retry_forbidden':True})
            raise RuntimeError(str(error)) from error

    def _broker_command(self,argv):
        require(argv==self.manifest['ordinary_argv_allowlist'][0],'ORDINARY_ARGV')
        path=self.package/'first_live_launcher.py'
        expected=self.manifest['operator_files']['first_live_launcher.py']
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK|os.O_CLOEXEC)
        try:
            before=os.fstat(fd)
            require(stat.S_ISREG(before.st_mode) and before.st_uid==502 and before.st_gid==20
                    and before.st_nlink==1 and stat.S_IMODE(before.st_mode) in (0o400,0o500)
                    and getattr(before,'st_flags',0)==0 and 0<before.st_size<=16*1024*1024,
                    'LAUNCHER_METADATA')
            raw=bytearray()
            while len(raw)<=16*1024*1024:
                chunk=os.read(fd,min(1024*1024,16*1024*1024+1-len(raw)))
                if not chunk:break
                raw.extend(chunk)
            require(len(raw)==before.st_size and sha(raw)==expected
                    and tuple_of(os.fstat(fd))==tuple_of(before)
                    and tuple_of(path.lstat())==tuple_of(before),'LAUNCHER_DIGEST')
            os.lseek(fd,0,os.SEEK_SET)
            actual=['/usr/bin/python3','-I','-S','-B','-c',BROKER_LOADER,str(fd),expected,
                self.manifest_digest,str(path),'--broker-exact']
            return self._command(actual,pass_fds=(fd,),timeout=1900)
        finally:
            os.close(fd)

    def stream_hash_fixed_codex(self,path,spec):
        self._ready()
        require(path==CODEX and set(spec)=={'uid','gid','mode','nlink','flags','size','sha256'},
                'FIXED_CODEX_SPEC')
        exact_digest(spec['sha256'])
        require(type(spec['size']) is int and spec['size']>LIMIT,'FIXED_CODEX_SIZE')
        self.sequence+=1;name=f'{self.sequence:04d}-{self.current_phase}'
        self.record(name+'-intent.json',{'path':path,'operation':'stream-sha256','observed_at':self.now()})
        parent_path=Path(path).parent;parent=None
        try:
            protected_before=self.metadata(path)
            require(protected_before['type']=='Regular File','PROTECTED_TYPE')
            for key in ('uid','gid','nlink','flags','size'):
                require(protected_before[key]==spec[key],'PROTECTED_METADATA:'+key)
            require(protected_before['mode']==int(spec['mode'],8),'PROTECTED_MODE')
            parent=directory(parent_path)
            parent_before=tuple_of(os.fstat(parent))
            fd=os.open(Path(path).name,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=parent)
            try:
                before=os.fstat(fd)
                require(stat.S_ISREG(before.st_mode),'PROTECTED_TYPE')
                actual={'uid':before.st_uid,'gid':before.st_gid,'mode':stat.S_IMODE(before.st_mode),
                    'nlink':before.st_nlink,'flags':getattr(before,'st_flags',0),'size':before.st_size}
                expected={**spec,'mode':int(spec['mode'],8)};expected.pop('sha256')
                require(actual==expected,'PROTECTED_METADATA')
                require((before.st_dev,before.st_ino)==
                        (protected_before['device'],protected_before['inode']),'PROTECTED_OPEN_DRIFT')
                opened=tuple_of(before);hashed=hashlib.sha256();size=0
                while True:
                    chunk=os.read(fd,1024*1024)
                    if not chunk:break
                    hashed.update(chunk);size+=len(chunk)
                    require(size<=spec['size'],'PROTECTED_SIZE')
                require(size==spec['size'],'PROTECTED_SIZE')
                require(hashed.hexdigest()==spec['sha256'],'PROTECTED_DIGEST')
                require(tuple_of(os.fstat(fd))==opened,'PROTECTED_FD_DRIFT')
                require(tuple_of(os.stat(Path(path).name,dir_fd=parent,follow_symlinks=False))==opened,
                        'PROTECTED_PATH_DRIFT')
                require(tuple_of(os.fstat(parent))==parent_before,'PROTECTED_PARENT_DRIFT')
                rebound=directory(parent_path)
                try:
                    require(tuple_of(os.fstat(rebound))==parent_before,'PROTECTED_PARENT_DRIFT')
                    require(tuple_of(os.stat(Path(path).name,dir_fd=rebound,follow_symlinks=False))==opened,
                            'PROTECTED_PATH_DRIFT')
                finally:os.close(rebound)
            finally:os.close(fd)
            require(self.metadata(path)==protected_before,'PROTECTED_CHANGED_DURING_READ')
            self.record(name+'-result.json',{'sha256':hashed.hexdigest(),'size':size,
                'contents_retained':False})
        except BaseException as error:
            self.stopped=True
            self.record(name+'-unknown.json',{'state':'STOP_RECONCILE','error_type':type(error).__name__,
                'retry_forbidden':True})
            raise RuntimeError(str(error)) from error
        finally:
            if parent is not None:os.close(parent)

    def call(self,argv,root=True,visible=False,stdin=None,expected_digest=None,missing=False):
        require(type(argv) is list and all(type(x) is str for x in argv),'ARGV_SCHEMA')
        self._ready(argv)
        require(argv in self.manifest['root_argv_allowlist' if root else 'ordinary_argv_allowlist'],'ARGV_NOT_AUTHORIZED')
        require(not visible or root and argv==[NATIVE,'--first-live-recovery-and-enable'],'VISIBLE_COMMAND_NOT_AUTHORIZED')
        require(argv!=[NATIVE,'--first-live-recovery-and-enable'] or visible,'NATIVE_VISIBLE_REQUIRED')
        if expected_digest is not None:exact_digest(expected_digest)
        if argv==SOCKET_DIRECTORY_INSTALL:
            require(stdin is None,'DIRECTORY_INSTALL_STDIN_FORBIDDEN')
        elif argv[0]=='/usr/bin/install':
            require(stdin is not None,'INSTALL_INPUT_FD')
            m=os.fstat(stdin.fileno())
            require(stat.S_ISREG(m.st_mode) and m.st_uid==502 and m.st_nlink==0 and
                stat.S_IMODE(m.st_mode)==0o600 and 0<m.st_size<=LIMIT and stdin.tell()==0,'INSTALL_INPUT_FD')
        else:require(stdin is None,'UNEXPECTED_STDIN')
        if not root:return self._broker_command(argv)
        actual=['/usr/bin/sudo','-n']+argv
        return self._command(actual,visible=visible,stdin=stdin,
            expected_digest=expected_digest,missing=missing)

    def authenticate(self):
        self._ready(['/usr/bin/sudo']);require(self.auth_count<3,'AUTHENTICATION_BOUND')
        self.auth_count+=1
        return self._command(['/usr/bin/sudo','-v'],visible=True)

    def metadata(self,path,absent=False):
        command=['/usr/bin/stat','-f',STAT_FORMAT,str(path)]
        first=self.call(command,missing=absent)
        if first is None:return None
        fields=first.decode().strip().split('|');require(len(fields)==12,'STAT_FORMAT')
        keys=['uid','gid','mode','nlink','flags','size','mtime','ctime','inode','birthtime','device']
        result={k:int(v,8 if k=='mode' else 10) for k,v in zip(keys,fields)}
        result['mode']&=0o7777;result['type']=fields[-1]
        acl=self.call(['/bin/ls','-ldeO',str(path)]).decode().splitlines()
        require(len(acl)==1,'ACL_PRESENT')
        require(self.call(command)==first,'PROTECTED_CHANGED_DURING_METADATA')
        return result

    def expect(self,path,spec,directory=False):
        before=self.metadata(path)
        require(before['type']==('Directory' if directory else 'Regular File'),'PROTECTED_TYPE')
        require(before['mode']==int(spec['mode'],8),'PROTECTED_MODE')
        for key in ('uid','gid','nlink','flags','size','mtime','ctime','device','inode'):
            if key in spec:require(before[key]==spec[key],'PROTECTED_METADATA:'+key)
        if directory:require(before['flags']==0,'PROTECTED_DIRECTORY_FLAGS')
        if 'names' in spec:
            names=self.call(['/bin/ls','-1A',str(path)]).decode().splitlines()
            require(names==spec['names'],'PROTECTED_INVENTORY')
        if 'sha256' in spec:self.call(['/bin/cat',str(path)],expected_digest=spec['sha256'])
        require(self.metadata(path)==before,'PROTECTED_CHANGED_DURING_READ')
        return before

    def copy(self,raw,digest,mode,dest,gid=0):
        self._ready()
        require(type(raw) is bytes and 0<len(raw)<=LIMIT and sha(raw)==digest,'INSTALL_INPUT_DIGEST')
        require((gid==0 and mode in ('0400','0555','0600')) or
                (gid==20 and mode=='0440' and dest==HANDOFF),'INSTALL_OWNERSHIP')
        require(type(dest) is str and dest.startswith('/') and '\0' not in dest,'INSTALL_DESTINATION')
        with tempfile.TemporaryFile(dir=self.journal) as source:
            source.write(raw)
            source.flush()
            source.seek(0)
            m=os.fstat(source.fileno())
            require(stat.S_ISREG(m.st_mode) and m.st_uid==502 and m.st_nlink==0 and
                stat.S_IMODE(m.st_mode)==0o600 and m.st_size==len(raw) and sha(source.read())==digest,'INSTALL_INPUT_FD')
            source.seek(0)
            self.call(['/usr/bin/install','-o','root','-g','wheel' if gid==0 else '20','-m',mode,'/dev/fd/0',dest],stdin=source)
        return self.expect(dest,{'uid':0,'gid':gid,'mode':mode,'flags':0,'nlink':1,'size':len(raw),'sha256':digest})
