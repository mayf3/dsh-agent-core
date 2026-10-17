"""Accepted fixed e35 native recovery internals, distinct helper identity.

Original e35 source, context, native provenance and DS receipts are unchanged.
No public CLI or import-time filesystem action. Only the fixed original DS
RECOVERY branch may call this module after sealed source/subject admission.
"""
import base64,copy,ctypes,fcntl,hashlib,json,os,re,selectors,signal,stat,subprocess,sys,time,types
from contextlib import contextmanager
from datetime import datetime,timezone
import urllib.request
from pathlib import Path
_FS_ROOT='/'
E35 = {'operation_id': 'b7-packet-r34-1cfeff2a5b138629-e35', 'tx_id': 'tx-c0fd42f71e074eeb8f0e9902e1a3e084', 'migration_root': '/private/var/db/agent-core/authsvc-codex-migration', 'migration_inode': [16777233, 111949693], 'artifacts_parent_inode': [16777233, 186170744], 'lock_root': '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', 'mutation_inode': [16777233, 102163320], 'holder_inode': [16777233, 207636016], 'holder_sha256': 'dd25cd54a5911ea6d98dc5844f81473995ab41ba17b4dd9d04273bd00499818a', 'holder': {'format': 'B7_GLOBAL_HOLDER_V1', 'phase': 'SEALED', 'nonce': '927b57ed689ae8cdeb480a23354f48cb', 'binding': {'txId': 'tx-c0fd42f71e074eeb8f0e9902e1a3e084', 'deploymentRoot': '/Users/authsvc/.agent-core', 'trustedRoot': '/usr/local/libexec/agent-core', 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'outerPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'outerSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'carrierPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'carrierSha256': '5bf6533411d4f08f98f38da8d4714603448ad2222b25dcd63960f427576350f1', 'toolSha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'migrationToolSha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'preparationToolSha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'installerSha256': 'e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d', 'sixTargetProducerSha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'canaryProducerSha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'ownerRecorderSha256': '243357f274a6a8a7ed9bcdad0dd366f3f3699a55e4b10d67ce68c274e6c8d39b', 'cohortSha256': '4e3e238882f804eef63cb8b119989b1f0660f1e68c184a796f02a6c16532f14c', 'cohortToolSha256': '2c1484006c5d1b80e9b85c527d8bc1641ac75557a8e1117fcf5fb988ca0d1cf4', 'cohortSupport': {'cohort-runtime.mjs': '90de190504c0882e1d5ff6c32317793d591fe8e6ee21c06ad2d56dd5215a040c', 'cohort-artifacts.mjs': '6e1e6056d9e8740801f591a62f00b8a5e198d7beae29c13f1921bcc2110e315e'}}}, 'tools': {'outerPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'logical_path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'sha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'dev': 16777233, 'ino': 207543139, 'uid': 0, 'gid': 0, 'mode': 420, 'bytes': 40784, 'nlink': 1}, 'carrierPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'logical_path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'sha256': '5bf6533411d4f08f98f38da8d4714603448ad2222b25dcd63960f427576350f1', 'dev': 16777233, 'ino': 207543091, 'uid': 0, 'gid': 0, 'mode': 420, 'bytes': 103052, 'nlink': 1}, 'participant': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-tx-c0fd42f71e074eeb8f0e9902e1a3e084/tools/deployment-reuse/transaction-recovery.mjs', 'logical_path': '/var/db/agent-core/authsvc-codex-migration/activation-tx-c0fd42f71e074eeb8f0e9902e1a3e084/tools/deployment-reuse/transaction-recovery.mjs', 'sha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'dev': 16777233, 'ino': 208617153, 'uid': 0, 'gid': 0, 'mode': 420, 'bytes': 21544, 'nlink': 1}, 'node': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-tx-c0fd42f71e074eeb8f0e9902e1a3e084/old-node-runtime/bin/node', 'logical_path': '/var/db/agent-core/authsvc-codex-migration/activation-tx-c0fd42f71e074eeb8f0e9902e1a3e084/old-node-runtime/bin/node', 'sha256': 'c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b', 'dev': 16777233, 'ino': 208612126, 'uid': 0, 'gid': 0, 'mode': 493, 'bytes': 52160, 'nlink': 1}, 'preparationToolPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/b7-preparation.mjs', 'logical_path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/b7-preparation.mjs', 'sha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'dev': 16777233, 'ino': 207544322, 'uid': 0, 'gid': 0, 'mode': 420, 'bytes': 26274, 'nlink': 1}}, 'trees': {'codeinput': {'root': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input'}, 'publicArtifacts': {'root': '/usr/local/share/agent-core/artifacts'}}, 'histories': {'codeinput': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input.e35-aborted-c0fd42f7'}}
E35['six_ids'] = ['agt_data-engineer-agent', 'agt_family-insurance-manager-agent', 'agt_investment-manager-agent', 'agt_lw-lifecycle-canary', 'agt_machine-learning-engineer-agent', 'agt_technical-writer-agent']

def _sha(raw):return hashlib.sha256(raw).hexdigest()

def _id(s):return (s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode)

def _file(s):return _id(s)+(s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)

def _strict(raw):
 def pairs(items):
  out={}
  for k,v in items:
   if k in out:raise ValueError('DUPLICATE_FIELD')
   out[k]=v
  return out
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('JSON_CONSTANT')))

def _reader_path(e,path):
 """Recognize only the recorded fixed M system alias; never general realpath.
 Native records and original callee context keep their original logical bytes.
 """
 logical=E35['holder']['binding']['recoveryRoot'];physical=E35['migration_root']
 if path!=logical and not path.startswith(logical+'/'):return path
 suffix='/db/agent-core/authsvc-codex-migration';e.need(logical.endswith('/var'+suffix) and physical.endswith('/private/var'+suffix))
 var=logical[:-len(suffix)]
 with FixedPath(e,var) as h:
  st=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(stat.S_ISLNK(st.st_mode) and (st.st_uid,st.st_gid,stat.S_IMODE(st.st_mode),st.st_nlink)==(0,0,0o755,1) and os.readlink(h.name,dir_fd=h.parent)=='private/var')
  e.need(_file(st)==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)));h.verify()
 return physical+path[len(logical):]

class FixedPath:
 """Held nofollow traversal for this fixed subject's root/service-owned data.
 Parent timestamps may change through our fixed publications; identity/custody
 and every traversed pathname remain pinned. Leaf content has separate proofs.
 """
 def __init__(self,e,path):self.e=e;self.logical_path=str(path);self.path=_reader_path(e,str(path));self.fds=[];self.trace=[]
 def __enter__(self):
  e=self.e;parts=os.path.relpath(self.path,_FS_ROOT).split(os.sep)
  e.need(os.path.normpath(self.path)==self.path and os.path.commonpath((_FS_ROOT,self.path))==_FS_ROOT)
  e.need(all(p not in ('','..','.') for p in parts))
  try:
   parent=os.open(_FS_ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);self.fds.append(parent)
   self.root_pin=_id(os.fstat(parent));current=_FS_ROOT
   for name in parts[:-1]:
    current=os.path.join(current,name);s=os.stat(name,dir_fd=parent,follow_symlinks=False)
    if current==E35['migration_root']:e.need([s.st_dev,s.st_ino]==E35['migration_inode'] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,0,0o700))
    if current==str(Path(E35['trees']['publicArtifacts']['root']).parent):e.need([s.st_dev,s.st_ino]==E35['artifacts_parent_inode'] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,0,0o755))
    e.need(stat.S_ISDIR(s.st_mode) and s.st_uid in (0,502,505))
    e.need(not s.st_mode&0o022 or (current==e.ds.STATE_ROOT and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,80,0o770)))
    fd=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);self.fds.append(fd)
    e.need(_id(s)==_id(os.fstat(fd)));self.trace.append((parent,name,fd,_id(s)));parent=fd
   self.parent,self.name=parent,parts[-1];self.verify();return self
  except BaseException:self.close();raise
 def verify(self):
  self.e.need(self.root_pin==_id(os.fstat(self.fds[0])))
  for p,n,fd,pin in self.trace:self.e.need(pin==_id(os.fstat(fd))==_id(os.stat(n,dir_fd=p,follow_symlinks=False)))
 def close(self):
  for fd in reversed(self.fds):os.close(fd)
  self.fds=[]
 def __exit__(self,t,v,b):
  try:
   if t is None:self.verify()
  finally:self.close()

def _exists(e,path):
 with FixedPath(e,path) as h:
  try:os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);return True
  except FileNotFoundError:return False

def _absent(e,path):e.need(not _exists(e,path))

def _blob(e,path,want=None,limit=33554432,sync=False):
 with FixedPath(e,path) as h:
  before=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and 0<=before.st_size<=limit)
  fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=h.parent)
  try:
   pin=_file(before);e.need(pin==_file(os.fstat(fd)));chunks=[];total=0
   while True:
    _budget(e)
    part=os.read(fd,min(65536,limit+1-total))
    if not part:break
    chunks.append(part);total+=len(part);e.need(total<=limit)
   raw=b''.join(chunks);e.need(len(raw)==before.st_size)
   if want is not None:
    if 'stable_pin' in want:e.need(pin==want['stable_pin'])
    e.need(_sha(raw)==want['sha256'])
    for key,got in (('uid',before.st_uid),('gid',before.st_gid),('mode',stat.S_IMODE(before.st_mode)),('bytes',len(raw)),('dev',before.st_dev),('ino',before.st_ino)):
     if key in want:e.need(got==want[key])
   if sync:
    e.need(want is not None);os.fsync(fd);os.fsync(h.parent);os.lseek(fd,0,os.SEEK_SET);e.need(os.read(fd,limit+1)==raw)
   e.need(pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)));h.verify()
   return raw,pin
  finally:os.close(fd)

class NativeLease:
 def __init__(self,e):self.e=e;self.fd=None;self.tools={};self.released=False
 def __enter__(self):
  e=self.e;self.lock=FixedPath(e,E35['lock_root']);self.lock.__enter__()
  try:
   self.dir=os.open(self.lock.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=self.lock.parent)
   s=os.fstat(self.dir);e.need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,80,0o700));e.need([s.st_dev,s.st_ino]==[E35['scene_objects'][E35['lock_root']]['dev'],E35['scene_objects'][E35['lock_root']]['ino']]);self.dir_pin=_id(s)
   low=os.open('holder',os.O_RDWR|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=self.dir)
   try:self.fd=fcntl.fcntl(low,fcntl.F_DUPFD_CLOEXEC,64)
   finally:os.close(low)
   fcntl.flock(self.fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
   history=False;_absent(e,E35['histories']['codeinput'])
   for key,row in E35['tools'].items():
    path=E35['histories']['codeinput']+row['path'][len(E35['trees']['codeinput']['root']):] if history else row['path']
    with FixedPath(e,path) as h:
     fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=h.parent)
     try:self.tools[key]=(fd,_file(os.fstat(fd)));self.tool(key,history)
     except BaseException:os.close(fd);self.tools.pop(key,None);raise
   self.verify(history);return self
  except BaseException:self.__exit__(*sys.exc_info());raise
 def tool(self,key,history):
  e=self.e;fd,pin=self.tools[key];row=E35['tools'][key]
  path=row['path']
  if history:path=E35['histories']['codeinput']+path[len(E35['trees']['codeinput']['root']):]
  with FixedPath(e,path) as h:
   s=os.fstat(fd);e.need(pin==_file(s)==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)))
   e.need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and [s.st_dev,s.st_ino]==[row['dev'],row['ino']] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_size)==(row['uid'],row['gid'],row['mode'],row['bytes']))
   e.need(_sha(os.pread(fd,s.st_size+1,0))==row['sha256'])
 def verify(self,history=False):
  e=self.e;self.lock.verify();e.need(self.dir_pin==_id(os.fstat(self.dir))==_id(os.stat(self.lock.name,dir_fd=self.lock.parent,follow_symlinks=False)))
  e.need(sorted(os.listdir(self.dir))==['holder']);s=os.fstat(self.fd)
  e.need(stat.S_ISREG(s.st_mode) and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(0,80,0o600,1) and [s.st_dev,s.st_ino]==E35['holder_inode'])
  e.need(_file(s)==_file(os.stat('holder',dir_fd=self.dir,follow_symlinks=False)))
  raw=os.pread(self.fd,65537,0);e.need(len(raw)==s.st_size<=65536 and _sha(raw)==E35['holder_sha256'] and _strict(raw)==E35['holder'])
  other=os.open('holder',os.O_RDWR|os.O_NOFOLLOW,dir_fd=self.dir)
  try:
   try:fcntl.flock(other,fcntl.LOCK_EX|fcntl.LOCK_NB)
   except BlockingIOError:pass
   else:e.need(False,'MUTATION_BUSY','admission')
   fcntl.flock(self.fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  finally:os.close(other)
  for key in self.tools:self.tool(key,history)
 def guard(self):self.verify(False);_run_child(self.e,self.fd,'guard');self.verify(False)
 def release(self):
  self.verify(False);e=self.e
  os.unlink('holder',dir_fd=self.dir);e.need(not os.listdir(self.dir));os.rmdir(self.lock.name,dir_fd=self.lock.parent);os.fsync(self.lock.parent);_absent(e,E35['lock_root']);self.released=True
 def __exit__(self,*args):
  for fd,pin in self.tools.values():os.close(fd)
  self.tools={}
  if self.fd is not None:os.close(self.fd);self.fd=None
  if hasattr(self,'dir'):os.close(self.dir)
  if hasattr(self,'lock'):self.lock.close()

# Fixed argv only; no caller program/path/environment or Owner channel.
CHILD_LAUNCH = """import os,sys,json
fd=int(sys.argv[1]);argv=json.loads(sys.argv[2])
if fd<64:raise SystemExit(92)
os.dup2(fd,9,inheritable=True);os.close(fd)
os.execve(argv[0],argv,{'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C','B7_OUTER_ACTIVE':'1'})
"""

def _child_argv(mode):
    t=E35['tools'];tx=E35['tx_id']
    common=['/Users/authsvc/.agent-core','/usr/local/libexec/agent-core','/var/db/agent-core/authsvc-codex-migration',tx]
    if mode=='guard':return ['/bin/bash',t['outerPath']['path'],'b7-guard','--transaction',tx]
    if mode=='inverse':return [t['node']['path'],t['preparationToolPath']['path'],'recover-six-target',tx]
    if mode=='restore':return [t['node']['path'],t['participant']['path'],'restore']+common
    if mode=='verify-pre':return [t['node']['path'],t['participant']['path'],'verify']+common+['pre']
    raise ValueError('E35_FIXED_CHILD_MODE')

def _stop_child(child):
 if child is None:return
 try:os.killpg(child.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 child.wait(timeout=10)
 for stream in (child.stdin,child.stdout,child.stderr):
  if stream is not None and not stream.closed:stream.close()

def _bounded_io(child,input_bytes,timeout,limit):
 """Bound bytes while reading, not after unbounded communicate accumulation."""
 deadline=time.monotonic()+timeout;selector=selectors.DefaultSelector();buffers={'out':bytearray(),'err':bytearray()};offset=0
 for stream,tag in ((child.stdout,'out'),(child.stderr,'err')):
  os.set_blocking(stream.fileno(),False);selector.register(stream,selectors.EVENT_READ,tag)
 if child.stdin is not None:
  if input_bytes:
   os.set_blocking(child.stdin.fileno(),False);selector.register(child.stdin,selectors.EVENT_WRITE,'in')
  else:child.stdin.close();child.stdin=None
 try:
  while selector.get_map():
   left=deadline-time.monotonic()
   if left<=0:raise TimeoutError('E35_CHILD_DEADLINE')
   for key,_ in selector.select(min(left,.2)):
    if key.data=='in':
     n=os.write(key.fd,input_bytes[offset:offset+65536]);offset+=n
     if offset==len(input_bytes):selector.unregister(key.fileobj);key.fileobj.close();child.stdin=None
    else:
     part=os.read(key.fd,65536)
     if not part:selector.unregister(key.fileobj);continue
     buffers[key.data].extend(part)
     if len(buffers[key.data])>limit:raise ValueError('E35_CHILD_OUTPUT_BOUND')
  child.wait(timeout=max(.01,deadline-time.monotonic()))
  out,err=bytes(buffers['out']),bytes(buffers['err'])
  for stream in (child.stdout,child.stderr):
   if stream is not None and not stream.closed:stream.close()
  child.stdout=None;child.stderr=None
  return out,err
 finally:selector.close()

def _run_child(e,lease_fd,mode):
    e.need(lease_fd>=64,'BINDING_MISMATCH')
    argv=_child_argv(mode)
    child=None
    try:
        child=subprocess.Popen(['/usr/bin/python3','-I','-B','-c',CHILD_LAUNCH,str(lease_fd),json.dumps(argv)],
            stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'},cwd='/',
            close_fds=True,pass_fds=(lease_fd,),start_new_session=True)
        out,err=_bounded_io(child,None,min(20 if mode=='guard' else 1800,max(.01,getattr(e,'_e35_deadline',time.monotonic()+1800)-time.monotonic())),1048576)
        e.need(len(out)<=1048576 and len(err)<=1048576,'INVALID_SHAPE','read')
        record=dict(mode=mode,returncode=child.returncode,stdout_sha256=_sha(out),stderr_sha256=_sha(err),
                    stdout_bytes=len(out),stderr_bytes=len(err),child_source_sha256=_sha(CHILD_LAUNCH.encode()))
        e._e35_child_receipts.append(record)
        e.need(child.returncode==0,'NONTERMINAL','observe')
        if mode=='guard':e.need(out==b'B7_MUTEX_INHERITED\n','BINDING_MISMATCH')
        elif mode=='inverse':
            prefix=('B7_SIX_TARGET_RECOVERED '+E35['tx_id']+' ').encode()
            e.need(out.startswith(prefix),'BINDING_MISMATCH')
            e.need(_strict(out[len(prefix):])==E35['six_ids'],'BINDING_MISMATCH')
        elif mode=='restore':e.need(out==b'PARTICIPANT_RESTORE=PASS\n','BINDING_MISMATCH')
        elif mode=='verify-pre':e.need(out==b'PARTICIPANT_VERIFY=PASS\n','BINDING_MISMATCH')
        return record
    except BaseException:
        # Close only this known child's process group. Uncertain recovery intent
        # stays UNKNOWN; no automatic new child or native lease disposal.
        _stop_child(child)
        raise



E35.update({'pins': {'migration-transaction.json': '03496ae42466aa9480c8fdbe36a4da6b549d47b533257016aee961ee75d21dde', 'migration-fence.json': 'c4299625e681bced76c195edeef938792cf202db5f05aadfa1b0c06613592443', 'b7-six-target-batch.json': 'a7c6dd52c680a2fe45780cf7e50bdf950fb68901f174a108e7aa589574744687', '.b7-six-journal.jsonl': '81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf', 'b7-preparation-input.json': '71b06fa431ed987bfe423ae3a5d2c3078c458fc640ca2027a46eaf5da31a0d73', 'b7-preparation-tx-c0fd42f71e074eeb8f0e9902e1a3e084.json': 'ce960bbe3cd73ec26244d2ec2e58f1a1218bac592f26e63cb16590e8f6892d96', 'b7-accepted-tx-c0fd42f71e074eeb8f0e9902e1a3e084.json': 'b98413fec119e5b5a6acf2df5ab466f6431eb96b547799a81ce487ab1191ba78'}, 'registration_sha256': '5bbacce050401210ea3390e9b5b00dbae8e96c9ff4342875f4c66cd5e3cb38df', 'execution_sha256': '1d6742519840e0a2a98409b28725eed69f3e2123d27a7382e88029944aea1895', 'config_sha256': '321897cd8fb3024f05c4cb0b2960351fcd76b208d749e9b160ffd5e7b0216bf1', 'registry_sha256': 'e0800b0fde6fc46b2873decd0f83c9b807b48b56cc3c9ad9cf578a5685b5b6fe', 'plist_sha256': 'c41e1c18ea87517df1e5674f9f63761498c653f24cd7596754ae657d6767dc59', 'six_public': [{'id': 'agt_data-engineer-agent', 'prestate': 'PARTIAL', 'pending': False, 'recorded_files': 21739, 'created': ['profiles/node_modules/.bin/dsh-openai-codex', 'profiles/node_modules/@agent-core/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard', 'profiles/node_modules/@agent-core/demo-server', 'profiles/node_modules/@agent-core/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker', 'profiles/node_modules/@agent-core/broker'], 'preimages': [{'rel': 'settings.yaml', 'storeFile': 'agt_data-engineer-agent__settings.yaml', 'sha256': '85617ec7cc166b95a6c4cbbfd62e689b3a892e4278873f2c406cf5b1bf7fe5ed', 'bytes': 60}, {'rel': 'profiles/agent-core-production/package.json', 'storeFile': 'agt_data-engineer-agent__profiles__agent-core-production__package.json', 'sha256': '19cffb0937eecfbe2db6cc516e66efd706a1ce494b818a6fd823e49447220f33', 'bytes': 815}, {'rel': 'profiles/agent-core-production/cordis.patch.yml', 'storeFile': 'agt_data-engineer-agent__profiles__agent-core-production__cordis.patch.yml', 'sha256': '655574d86efd905dcbde884b07fb9149d6b689b68a6efc6b32f97a4b6a515866', 'bytes': 2336}]}, {'id': 'agt_family-insurance-manager-agent', 'prestate': 'PARTIAL', 'pending': False, 'recorded_files': 21739, 'created': ['profiles/node_modules/.bin/dsh-openai-codex', 'profiles/node_modules/@agent-core/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard', 'profiles/node_modules/@agent-core/demo-server', 'profiles/node_modules/@agent-core/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker', 'profiles/node_modules/@agent-core/broker'], 'preimages': [{'rel': 'settings.yaml', 'storeFile': 'agt_family-insurance-manager-agent__settings.yaml', 'sha256': '85617ec7cc166b95a6c4cbbfd62e689b3a892e4278873f2c406cf5b1bf7fe5ed', 'bytes': 60}, {'rel': 'profiles/agent-core-production/package.json', 'storeFile': 'agt_family-insurance-manager-agent__profiles__agent-core-production__package.json', 'sha256': '19cffb0937eecfbe2db6cc516e66efd706a1ce494b818a6fd823e49447220f33', 'bytes': 815}, {'rel': 'profiles/agent-core-production/cordis.patch.yml', 'storeFile': 'agt_family-insurance-manager-agent__profiles__agent-core-production__cordis.patch.yml', 'sha256': '655574d86efd905dcbde884b07fb9149d6b689b68a6efc6b32f97a4b6a515866', 'bytes': 2336}]}, {'id': 'agt_investment-manager-agent', 'prestate': 'PARTIAL', 'pending': False, 'recorded_files': 21739, 'created': ['profiles/node_modules/.bin/dsh-openai-codex', 'profiles/node_modules/@agent-core/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard', 'profiles/node_modules/@agent-core/demo-server', 'profiles/node_modules/@agent-core/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker', 'profiles/node_modules/@agent-core/broker'], 'preimages': [{'rel': 'settings.yaml', 'storeFile': 'agt_investment-manager-agent__settings.yaml', 'sha256': '85617ec7cc166b95a6c4cbbfd62e689b3a892e4278873f2c406cf5b1bf7fe5ed', 'bytes': 60}, {'rel': 'profiles/agent-core-production/package.json', 'storeFile': 'agt_investment-manager-agent__profiles__agent-core-production__package.json', 'sha256': '19cffb0937eecfbe2db6cc516e66efd706a1ce494b818a6fd823e49447220f33', 'bytes': 815}, {'rel': 'profiles/agent-core-production/cordis.patch.yml', 'storeFile': 'agt_investment-manager-agent__profiles__agent-core-production__cordis.patch.yml', 'sha256': '655574d86efd905dcbde884b07fb9149d6b689b68a6efc6b32f97a4b6a515866', 'bytes': 2336}]}, {'id': 'agt_lw-lifecycle-canary', 'prestate': 'PARTIAL', 'pending': False, 'recorded_files': 21739, 'created': ['profiles/node_modules/.bin/dsh-openai-codex', 'profiles/node_modules/@agent-core/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard', 'profiles/node_modules/@agent-core/demo-server', 'profiles/node_modules/@agent-core/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker', 'profiles/node_modules/@agent-core/broker'], 'preimages': [{'rel': 'settings.yaml', 'storeFile': 'agt_lw-lifecycle-canary__settings.yaml', 'sha256': '3a3406785e34ecf6d333551d10dd090d1e160e12088ecfa3ec87b826bbeb64aa', 'bytes': 500}, {'rel': 'profiles/agent-core-production/package.json', 'storeFile': 'agt_lw-lifecycle-canary__profiles__agent-core-production__package.json', 'sha256': '19cffb0937eecfbe2db6cc516e66efd706a1ce494b818a6fd823e49447220f33', 'bytes': 815}, {'rel': 'profiles/agent-core-production/cordis.patch.yml', 'storeFile': 'agt_lw-lifecycle-canary__profiles__agent-core-production__cordis.patch.yml', 'sha256': '655574d86efd905dcbde884b07fb9149d6b689b68a6efc6b32f97a4b6a515866', 'bytes': 2336}]}, {'id': 'agt_machine-learning-engineer-agent', 'prestate': 'PARTIAL', 'pending': False, 'recorded_files': 21739, 'created': ['profiles/node_modules/.bin/dsh-openai-codex', 'profiles/node_modules/@agent-core/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard', 'profiles/node_modules/@agent-core/demo-server', 'profiles/node_modules/@agent-core/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker', 'profiles/node_modules/@agent-core/broker'], 'preimages': [{'rel': 'settings.yaml', 'storeFile': 'agt_machine-learning-engineer-agent__settings.yaml', 'sha256': '85617ec7cc166b95a6c4cbbfd62e689b3a892e4278873f2c406cf5b1bf7fe5ed', 'bytes': 60}, {'rel': 'profiles/agent-core-production/package.json', 'storeFile': 'agt_machine-learning-engineer-agent__profiles__agent-core-production__package.json', 'sha256': '19cffb0937eecfbe2db6cc516e66efd706a1ce494b818a6fd823e49447220f33', 'bytes': 815}, {'rel': 'profiles/agent-core-production/cordis.patch.yml', 'storeFile': 'agt_machine-learning-engineer-agent__profiles__agent-core-production__cordis.patch.yml', 'sha256': '655574d86efd905dcbde884b07fb9149d6b689b68a6efc6b32f97a4b6a515866', 'bytes': 2336}]}, {'id': 'agt_technical-writer-agent', 'prestate': 'PARTIAL', 'pending': False, 'recorded_files': 21739, 'created': ['profiles/node_modules/.bin/dsh-openai-codex', 'profiles/node_modules/@agent-core/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard', 'profiles/node_modules/@agent-core/demo-server', 'profiles/node_modules/@agent-core/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker', 'profiles/node_modules/@agent-core/broker'], 'preimages': [{'rel': 'settings.yaml', 'storeFile': 'agt_technical-writer-agent__settings.yaml', 'sha256': '85617ec7cc166b95a6c4cbbfd62e689b3a892e4278873f2c406cf5b1bf7fe5ed', 'bytes': 60}, {'rel': 'profiles/agent-core-production/package.json', 'storeFile': 'agt_technical-writer-agent__profiles__agent-core-production__package.json', 'sha256': '19cffb0937eecfbe2db6cc516e66efd706a1ce494b818a6fd823e49447220f33', 'bytes': 815}, {'rel': 'profiles/agent-core-production/cordis.patch.yml', 'storeFile': 'agt_technical-writer-agent__profiles__agent-core-production__cordis.patch.yml', 'sha256': '655574d86efd905dcbde884b07fb9149d6b689b68a6efc6b32f97a4b6a515866', 'bytes': 2336}]}]})

E35['created_links'] = {'/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/.bin/dsh-openai-codex': {'target': '../dsh-codex/lib/bin.js', 'dev': 16777233, 'inode': 207707008, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/bundle-demo': {'target': '/usr/local/libexec/agent-core/app/bundle-demo', 'dev': 16777233, 'inode': 207707063, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/owner-guard': {'target': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'dev': 16777233, 'inode': 207707064, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/demo-server': {'target': '/usr/local/libexec/agent-core/app/packages/demo-server', 'dev': 16777233, 'inode': 207707065, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/bundle-memory': {'target': '/usr/local/libexec/agent-core/app/bundle-memory', 'dev': 16777233, 'inode': 207707066, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/agent-memory': {'target': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'dev': 16777233, 'inode': 207707067, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/bundle-agent-switch': {'target': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'dev': 16777233, 'inode': 207707068, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/agent-switch': {'target': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'dev': 16777233, 'inode': 207707069, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/workspace-bootstrap': {'target': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'dev': 16777233, 'inode': 207707070, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/bundle-broker': {'target': '/usr/local/libexec/agent-core/app/bundle-broker', 'dev': 16777233, 'inode': 207707071, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/node_modules/@agent-core/broker': {'target': '/usr/local/libexec/agent-core/app/packages/broker', 'dev': 16777233, 'inode': 207707072, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/.bin/dsh-openai-codex': {'target': '../dsh-codex/lib/bin.js', 'dev': 16777233, 'inode': 207778036, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/bundle-demo': {'target': '/usr/local/libexec/agent-core/app/bundle-demo', 'dev': 16777233, 'inode': 207778059, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/owner-guard': {'target': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'dev': 16777233, 'inode': 207778060, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/demo-server': {'target': '/usr/local/libexec/agent-core/app/packages/demo-server', 'dev': 16777233, 'inode': 207778061, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/bundle-memory': {'target': '/usr/local/libexec/agent-core/app/bundle-memory', 'dev': 16777233, 'inode': 207778062, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/agent-memory': {'target': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'dev': 16777233, 'inode': 207778063, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/bundle-agent-switch': {'target': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'dev': 16777233, 'inode': 207778064, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/agent-switch': {'target': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'dev': 16777233, 'inode': 207778065, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/workspace-bootstrap': {'target': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'dev': 16777233, 'inode': 207778066, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/bundle-broker': {'target': '/usr/local/libexec/agent-core/app/bundle-broker', 'dev': 16777233, 'inode': 207778067, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/node_modules/@agent-core/broker': {'target': '/usr/local/libexec/agent-core/app/packages/broker', 'dev': 16777233, 'inode': 207778068, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/.bin/dsh-openai-codex': {'target': '../dsh-codex/lib/bin.js', 'dev': 16777233, 'inode': 207848987, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/bundle-demo': {'target': '/usr/local/libexec/agent-core/app/bundle-demo', 'dev': 16777233, 'inode': 207848992, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/owner-guard': {'target': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'dev': 16777233, 'inode': 207848993, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/demo-server': {'target': '/usr/local/libexec/agent-core/app/packages/demo-server', 'dev': 16777233, 'inode': 207848994, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/bundle-memory': {'target': '/usr/local/libexec/agent-core/app/bundle-memory', 'dev': 16777233, 'inode': 207848995, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/agent-memory': {'target': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'dev': 16777233, 'inode': 207848996, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/bundle-agent-switch': {'target': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'dev': 16777233, 'inode': 207848997, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/agent-switch': {'target': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'dev': 16777233, 'inode': 207848998, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/workspace-bootstrap': {'target': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'dev': 16777233, 'inode': 207848999, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/bundle-broker': {'target': '/usr/local/libexec/agent-core/app/bundle-broker', 'dev': 16777233, 'inode': 207849000, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/node_modules/@agent-core/broker': {'target': '/usr/local/libexec/agent-core/app/packages/broker', 'dev': 16777233, 'inode': 207849001, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/.bin/dsh-openai-codex': {'target': '../dsh-codex/lib/bin.js', 'dev': 16777233, 'inode': 207919917, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/bundle-demo': {'target': '/usr/local/libexec/agent-core/app/bundle-demo', 'dev': 16777233, 'inode': 207919930, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/owner-guard': {'target': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'dev': 16777233, 'inode': 207919931, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/demo-server': {'target': '/usr/local/libexec/agent-core/app/packages/demo-server', 'dev': 16777233, 'inode': 207919932, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/bundle-memory': {'target': '/usr/local/libexec/agent-core/app/bundle-memory', 'dev': 16777233, 'inode': 207919933, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/agent-memory': {'target': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'dev': 16777233, 'inode': 207919934, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/bundle-agent-switch': {'target': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'dev': 16777233, 'inode': 207919935, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/agent-switch': {'target': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'dev': 16777233, 'inode': 207919936, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/workspace-bootstrap': {'target': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'dev': 16777233, 'inode': 207919937, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/bundle-broker': {'target': '/usr/local/libexec/agent-core/app/bundle-broker', 'dev': 16777233, 'inode': 207919938, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/node_modules/@agent-core/broker': {'target': '/usr/local/libexec/agent-core/app/packages/broker', 'dev': 16777233, 'inode': 207919939, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/.bin/dsh-openai-codex': {'target': '../dsh-codex/lib/bin.js', 'dev': 16777233, 'inode': 207990864, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/bundle-demo': {'target': '/usr/local/libexec/agent-core/app/bundle-demo', 'dev': 16777233, 'inode': 207990882, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/owner-guard': {'target': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'dev': 16777233, 'inode': 207990883, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/demo-server': {'target': '/usr/local/libexec/agent-core/app/packages/demo-server', 'dev': 16777233, 'inode': 207990884, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/bundle-memory': {'target': '/usr/local/libexec/agent-core/app/bundle-memory', 'dev': 16777233, 'inode': 207990885, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/agent-memory': {'target': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'dev': 16777233, 'inode': 207990886, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/bundle-agent-switch': {'target': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'dev': 16777233, 'inode': 207990888, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/agent-switch': {'target': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'dev': 16777233, 'inode': 207990889, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/workspace-bootstrap': {'target': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'dev': 16777233, 'inode': 207990890, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/bundle-broker': {'target': '/usr/local/libexec/agent-core/app/bundle-broker', 'dev': 16777233, 'inode': 207990891, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/node_modules/@agent-core/broker': {'target': '/usr/local/libexec/agent-core/app/packages/broker', 'dev': 16777233, 'inode': 207990892, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/.bin/dsh-openai-codex': {'target': '../dsh-codex/lib/bin.js', 'dev': 16777233, 'inode': 208061829, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/bundle-demo': {'target': '/usr/local/libexec/agent-core/app/bundle-demo', 'dev': 16777233, 'inode': 208061854, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/owner-guard': {'target': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'dev': 16777233, 'inode': 208061855, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/demo-server': {'target': '/usr/local/libexec/agent-core/app/packages/demo-server', 'dev': 16777233, 'inode': 208061856, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/bundle-memory': {'target': '/usr/local/libexec/agent-core/app/bundle-memory', 'dev': 16777233, 'inode': 208061857, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/agent-memory': {'target': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'dev': 16777233, 'inode': 208061858, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/bundle-agent-switch': {'target': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'dev': 16777233, 'inode': 208061859, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/agent-switch': {'target': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'dev': 16777233, 'inode': 208061860, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/workspace-bootstrap': {'target': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'dev': 16777233, 'inode': 208061861, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/bundle-broker': {'target': '/usr/local/libexec/agent-core/app/bundle-broker', 'dev': 16777233, 'inode': 208061862, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/node_modules/@agent-core/broker': {'target': '/usr/local/libexec/agent-core/app/packages/broker', 'dev': 16777233, 'inode': 208061863, 'uid': 0, 'gid': 20, 'mode': 448, 'nlink': 1}}

E35['restore_leaves'] = {'/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/settings.yaml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/settings.yaml', 'dev': 16777233, 'inode': 185118912, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792247793768756459, 'ctime_ns': 1792247793768756459}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_data-engineer-agent__settings.yaml', 'dev': 16777233, 'inode': 186170800, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792259756421387668, 'ctime_ns': 1792259756421387668}}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/agent-core-production/package.json': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/agent-core-production/package.json', 'dev': 16777233, 'inode': 185118915, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792247793769079377, 'ctime_ns': 1792247793769079377}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_data-engineer-agent__profiles__agent-core-production__package.json', 'dev': 16777233, 'inode': 186170801, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792259756433484744, 'ctime_ns': 1792259756433484744}}, '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/agent-core-production/cordis.patch.yml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent/profiles/agent-core-production/cordis.patch.yml', 'dev': 16777233, 'inode': 185118916, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792247793769316753, 'ctime_ns': 1792247793769316753}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_data-engineer-agent__profiles__agent-core-production__cordis.patch.yml', 'dev': 16777233, 'inode': 186170802, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792259756445935367, 'ctime_ns': 1792259756445935367}}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/settings.yaml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/settings.yaml', 'dev': 16777233, 'inode': 185189743, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792247795966561560, 'ctime_ns': 1792247795966561560}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_family-insurance-manager-agent__settings.yaml', 'dev': 16777233, 'inode': 186170808, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792259797096481827, 'ctime_ns': 1792259797096481827}}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/agent-core-production/package.json': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/agent-core-production/package.json', 'dev': 16777233, 'inode': 185189746, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792247795967154063, 'ctime_ns': 1792247795967154063}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_family-insurance-manager-agent__profiles__agent-core-production__package.json', 'dev': 16777233, 'inode': 186170809, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792259797104178902, 'ctime_ns': 1792259797104178902}}, '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/agent-core-production/cordis.patch.yml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent/profiles/agent-core-production/cordis.patch.yml', 'dev': 16777233, 'inode': 185189747, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792247795967690398, 'ctime_ns': 1792247795967690398}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_family-insurance-manager-agent__profiles__agent-core-production__cordis.patch.yml', 'dev': 16777233, 'inode': 186170810, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792259797112181397, 'ctime_ns': 1792259797112181397}}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/settings.yaml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/settings.yaml', 'dev': 16777233, 'inode': 185260580, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792247798576849385, 'ctime_ns': 1792247798576849385}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_investment-manager-agent__settings.yaml', 'dev': 16777233, 'inode': 186170833, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792259832735212686, 'ctime_ns': 1792259832735212686}}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/agent-core-production/package.json': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/agent-core-production/package.json', 'dev': 16777233, 'inode': 185260583, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792247798577541805, 'ctime_ns': 1792247798577541805}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_investment-manager-agent__profiles__agent-core-production__package.json', 'dev': 16777233, 'inode': 186170834, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792259832743441892, 'ctime_ns': 1792259832743441892}}, '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/agent-core-production/cordis.patch.yml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent/profiles/agent-core-production/cordis.patch.yml', 'dev': 16777233, 'inode': 185260584, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792247798578033391, 'ctime_ns': 1792247798578033391}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_investment-manager-agent__profiles__agent-core-production__cordis.patch.yml', 'dev': 16777233, 'inode': 186170835, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792259832752053435, 'ctime_ns': 1792259832752053435}}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/settings.yaml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/settings.yaml', 'dev': 16777233, 'inode': 73612936, 'uid': 502, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 500, 'mtime_ns': 1792247801066627129, 'ctime_ns': 1792247801066627129}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_lw-lifecycle-canary__settings.yaml', 'dev': 16777233, 'inode': 149086382, 'uid': 502, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 500, 'mtime_ns': 1792259867122938998, 'ctime_ns': 1792259867122938998}}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/agent-core-production/package.json': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/agent-core-production/package.json', 'dev': 16777233, 'inode': 73612940, 'uid': 502, 'gid': 20, 'mode': 420, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792247801067191173, 'ctime_ns': 1792247801067191173}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_lw-lifecycle-canary__profiles__agent-core-production__package.json', 'dev': 16777233, 'inode': 149086383, 'uid': 502, 'gid': 20, 'mode': 420, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792259867130383821, 'ctime_ns': 1792259867130383821}}, '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/agent-core-production/cordis.patch.yml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary/profiles/agent-core-production/cordis.patch.yml', 'dev': 16777233, 'inode': 73612941, 'uid': 502, 'gid': 20, 'mode': 420, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792247801067654259, 'ctime_ns': 1792247801067654259}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_lw-lifecycle-canary__profiles__agent-core-production__cordis.patch.yml', 'dev': 16777233, 'inode': 149086384, 'uid': 502, 'gid': 20, 'mode': 420, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792259867138359524, 'ctime_ns': 1792259867138359524}}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/settings.yaml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/settings.yaml', 'dev': 16777233, 'inode': 185402226, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792247803681649642, 'ctime_ns': 1792247803681649642}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_machine-learning-engineer-agent__settings.yaml', 'dev': 16777233, 'inode': 186170852, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792259898350256598, 'ctime_ns': 1792259898350256598}}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/agent-core-production/package.json': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/agent-core-production/package.json', 'dev': 16777233, 'inode': 185402229, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792247803682066061, 'ctime_ns': 1792247803682066061}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_machine-learning-engineer-agent__profiles__agent-core-production__package.json', 'dev': 16777233, 'inode': 186170853, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792259898359210686, 'ctime_ns': 1792259898359210686}}, '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/agent-core-production/cordis.patch.yml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent/profiles/agent-core-production/cordis.patch.yml', 'dev': 16777233, 'inode': 185402230, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792247803682405312, 'ctime_ns': 1792247803682405312}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_machine-learning-engineer-agent__profiles__agent-core-production__cordis.patch.yml', 'dev': 16777233, 'inode': 186170854, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792259898366914178, 'ctime_ns': 1792259898366914178}}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/settings.yaml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/settings.yaml', 'dev': 16777233, 'inode': 185473055, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792247806251952705, 'ctime_ns': 1792247806251952705}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_technical-writer-agent__settings.yaml', 'dev': 16777233, 'inode': 186170874, 'uid': 0, 'gid': 20, 'mode': 384, 'nlink': 1, 'bytes': 60, 'mtime_ns': 1792259930271087896, 'ctime_ns': 1792259930271087896}}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/agent-core-production/package.json': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/agent-core-production/package.json', 'dev': 16777233, 'inode': 185473058, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792247806252992709, 'ctime_ns': 1792247806252992709}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_technical-writer-agent__profiles__agent-core-production__package.json', 'dev': 16777233, 'inode': 186170875, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 815, 'mtime_ns': 1792259930279100985, 'ctime_ns': 1792259930279100985}}, '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/agent-core-production/cordis.patch.yml': {'live': {'path': '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent/profiles/agent-core-production/cordis.patch.yml', 'dev': 16777233, 'inode': 185473059, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792247806253512295, 'ctime_ns': 1792247806253512295}, 'backup': {'path': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store/agt_technical-writer-agent__profiles__agent-core-production__cordis.patch.yml', 'dev': 16777233, 'inode': 186170877, 'uid': 0, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 2336, 'mtime_ns': 1792259930285984398, 'ctime_ns': 1792259930285984398}}}

E35['scene_objects'] = {'/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json': {'dev': 16777233, 'ino': 208620487, 'uid': 0, 'gid': 0, 'mode': 384, 'nlink': 1, 'bytes': 660849}, '/private/var/db/agent-core/authsvc-codex-migration/migration-fence.json': {'dev': 16777233, 'ino': 208619812, 'uid': 505, 'gid': 601, 'mode': 384, 'nlink': 1, 'bytes': 108}, '/private/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json': {'dev': 16777233, 'ino': 208061865, 'uid': 0, 'gid': 0, 'mode': 384, 'nlink': 1, 'bytes': 23087288}, '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input': {'dev': 16777233, 'ino': 207542809, 'uid': 0, 'gid': 0, 'mode': 448, 'nlink': 6, 'bytes': 192}, '/private/var/db/agent-core/authsvc-codex-migration/b7-preparation-input.json': {'dev': 16777233, 'ino': 207636012, 'uid': 0, 'gid': 0, 'mode': 384, 'nlink': 1, 'bytes': 5087}, '/usr/local/share/agent-core/artifacts': {'dev': 16777233, 'ino': 207635924, 'uid': 0, 'gid': 0, 'mode': 493, 'nlink': 8, 'bytes': 256}, '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock': {'dev': 16777233, 'ino': 207636015, 'uid': 0, 'gid': 80, 'mode': 448, 'nlink': 3, 'bytes': 96}, '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock/holder': {'dev': 16777233, 'ino': 207636016, 'uid': 0, 'gid': 80, 'mode': 384, 'nlink': 1, 'bytes': 1912}}

def _budget(e):e.need(time.monotonic()<getattr(e,'_e35_deadline',float('inf')),'NONTERMINAL','observe')

E35['import_closure'] = {'preparation': {'scripts/lib/deployment-reuse/b7-preparation.mjs': {'sha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'bytes': 26274, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/six-target-provision.mjs': {'sha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'bytes': 17459, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/capture-boundaries.mjs': {'sha256': '7fe28dcd295aef0211244f89b5fe52f26fb944b3057814efad2ce8904107f228', 'bytes': 15437, 'mode': 420, 'uid': 0, 'gid': 0}, 'packages/production-runtime/src/identity/provider-environment.js': {'sha256': '3deb221a63dd5998cc29f579de2a4842b72f065f571fb6622d3acc315d0337b1', 'bytes': 4061, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/cohort-binding.mjs': {'sha256': '2c1484006c5d1b80e9b85c527d8bc1641ac75557a8e1117fcf5fb988ca0d1cf4', 'bytes': 11555, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/cohort-runtime.mjs': {'sha256': '90de190504c0882e1d5ff6c32317793d591fe8e6ee21c06ad2d56dd5215a040c', 'bytes': 8205, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/cohort-artifacts.mjs': {'sha256': '6e1e6056d9e8740801f591a62f00b8a5e198d7beae29c13f1921bcc2110e315e', 'bytes': 6662, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/transaction-recovery.mjs': {'sha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'bytes': 21544, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/trusted-cp-model-overrides-config-gate.mjs': {'sha256': '0ceb1ac15791a9808bf0911115418a98225fb7e8089c71051b7e88f8f1f3e53d', 'bytes': 8927, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs': {'sha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'bytes': 25005, 'mode': 420, 'uid': 0, 'gid': 0}}, 'participant': {'scripts/lib/deployment-reuse/transaction-recovery.mjs': {'sha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'bytes': 21544, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/cohort-binding.mjs': {'sha256': '2c1484006c5d1b80e9b85c527d8bc1641ac75557a8e1117fcf5fb988ca0d1cf4', 'bytes': 11555, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/cohort-runtime.mjs': {'sha256': '90de190504c0882e1d5ff6c32317793d591fe8e6ee21c06ad2d56dd5215a040c', 'bytes': 8205, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/deployment-reuse/cohort-artifacts.mjs': {'sha256': '6e1e6056d9e8740801f591a62f00b8a5e198d7beae29c13f1921bcc2110e315e', 'bytes': 6662, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/trusted-cp-model-overrides-config-gate.mjs': {'sha256': '0ceb1ac15791a9808bf0911115418a98225fb7e8089c71051b7e88f8f1f3e53d', 'bytes': 8927, 'mode': 420, 'uid': 0, 'gid': 0}, 'scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs': {'sha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'bytes': 25005, 'mode': 420, 'uid': 0, 'gid': 0}}}

def _json(x):return (json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def _now():return datetime.now(timezone.utc).isoformat()
def _pin(raw,uid=0,gid=0,mode=0o600):return dict(sha256=_sha(raw),uid=uid,gid=gid,mode=mode,bytes=len(raw))
def _regular(e,path,sha=None,**kw):return _blob(e,path,dict(sha256=sha,**kw) if sha else None)[0]
def _m(name):return E35['migration_root']+'/'+name

def _rename_new(parent,old,new):
 if sys.platform!='darwin':raise RuntimeError('E35_MAC_ONLY_EXCL')
 call=ctypes.CDLL(None,use_errno=True).renameatx_np
 call.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint);call.restype=ctypes.c_int
 if call(parent,os.fsencode(old),parent,os.fsencode(new),4):
  err=ctypes.get_errno();raise OSError(err,os.strerror(err))

def _put(e,path,raw,guard,expected=None,uid=0,gid=80,mode=0o600):
 """One fixed same-parent publication. Expected=None is EXCL, never overwrite.
 A visible post-rename entry on failed parent-fsync remains UNKNOWN; no cleanup.
 """
 e.need(path in e._e35_writable_paths,'BINDING_MISMATCH')
 with FixedPath(e,path) as h:
  s=os.fstat(h.parent);e.need(s.st_uid==0 and not s.st_mode&0o022)
  if expected is None:_absent(e,path)
  else:_blob(e,path,expected)
  guard();tmp='.'+h.name+'.e35-'+os.urandom(12).hex()+'.tmp'
  fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=h.parent)
  try:
   os.fchown(fd,uid,gid);os.fchmod(fd,mode);n=0
   while n<len(raw):
    wrote=os.write(fd,raw[n:]);e.need(wrote>0);n+=wrote
   os.fsync(fd);p=_file(os.fstat(fd));guard();h.verify()
   e.need(p==_file(os.stat(tmp,dir_fd=h.parent,follow_symlinks=False)))
   if expected is None:_rename_new(h.parent,tmp,h.name)
   else:
    _blob(e,path,expected);os.replace(tmp,h.name,src_dir_fd=h.parent,dst_dir_fd=h.parent)
   os.fsync(h.parent)
   _blob(e,path,_pin(raw,uid,gid,mode));guard()
  finally:os.close(fd)

def _establish(e,path,value,guard):
 raw=value if isinstance(value,bytes) else _json(value)
 if _exists(e,path):
  _blob(e,path,_pin(raw),sync=True) if path in (_m('migration-transaction.json'),) else _blob(e,path,_pin(raw,0,80),sync=True)
  guard()
 else:_put(e,path,raw,guard)
 return _sha(raw)

@contextmanager
def _global_lease(e):
 path=e.ds.STATE_ROOT+'/mutation.lock'
 with FixedPath(e,path) as h:
  s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need([s.st_dev,s.st_ino]==E35['mutation_inode'] and stat.S_ISREG(s.st_mode) and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink,s.st_size)==(0,80,0o644,1,0))
  fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=h.parent)
  try:
   fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);pin=_file(s)
   def check():h.verify();e.need(pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)))
   check();yield check;check()
  finally:os.close(fd)

def _command(e,argv,timeout=10,limit=1048576):
 _budget(e);timeout=min(timeout,max(.01,getattr(e,'_e35_deadline',time.monotonic()+timeout)-time.monotonic()))
 r=subprocess.run(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'},cwd='/',timeout=timeout,check=False)
 e.need(len(r.stdout)<=limit and len(r.stderr)<=65536,'INVALID_SHAPE','read');return r

def _quiescent(e):
 r=_command(e,['/bin/ps','-axo','pid=,ppid=,command=']);e.need(r.returncode==0)
 for line in r.stdout.decode('utf-8','strict').splitlines():
  fields=line.strip().split(None,2);e.need(len(fields)==3 and fields[0].isdigit() and fields[1].isdigit())
  if int(fields[0])!=os.getpid():e.need(not any(t['path'] in fields[2] for t in E35['tools'].values()) and E35['tx_id'] not in fields[2],'MUTATION_BUSY','admission')
 r=_command(e,['/usr/sbin/lsof','-nP','-Fpf','--',E35['lock_root']+'/holder',e.ds.STATE_ROOT+'/mutation.lock'],limit=65536)
 e.need(r.returncode in (0,1) and not r.stderr and (bool(r.stdout) or r.returncode==1));pid=None
 for line in r.stdout.decode('ascii','strict').splitlines():
  e.need(len(line)>1 and line[0] in ('p','f'))
  if line[0]=='p':e.need(line[1:].isdigit());pid=int(line[1:]);e.need(pid==os.getpid(),'MUTATION_BUSY','admission')
  else:e.need(pid is not None and line[1:].rstrip('rwu').isdigit())

def _tree(e,path):
 """Original participant treeDigest grammar, no link traversal."""
 rows=[]
 def visit(parent,name,rel):
  _budget(e);st=os.stat(name,dir_fd=parent,follow_symlinks=False);meta=[st.st_uid,st.st_gid,stat.S_IMODE(st.st_mode)]
  if stat.S_ISLNK(st.st_mode):rows.append([rel,'link']+meta+[os.readlink(name,dir_fd=parent)])
  elif stat.S_ISDIR(st.st_mode):
   fd=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
   try:
    pin=_id(st);e.need(pin==_id(os.fstat(fd)));names=sorted(os.listdir(fd),key=lambda x:x.encode('utf-16be'));rows.append([rel,'dir']+meta)
    for n in names:visit(fd,n,rel+'/'+n)
    e.need(names==sorted(os.listdir(fd),key=lambda x:x.encode('utf-16be')) and pin==_id(os.fstat(fd))==_id(os.stat(name,dir_fd=parent,follow_symlinks=False)))
   finally:os.close(fd)
  else:
   e.need(stat.S_ISREG(st.st_mode) and st.st_nlink==1);fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parent)
   try:
    pin=_file(st);e.need(pin==_file(os.fstat(fd)));h=hashlib.sha256()
    while True:
     b=os.read(fd,1048576)
     if not b:break
     h.update(b)
    e.need(pin==_file(os.fstat(fd))==_file(os.stat(name,dir_fd=parent,follow_symlinks=False)));rows.append([rel,'file']+meta+[h.hexdigest()])
   finally:os.close(fd)
 with FixedPath(e,path) as p:visit(p.parent,p.name,'.')
 return _sha(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode())

# A finite source-bound adapter to original functions. It is new helper code,
# never attributed to old carrier5bf or used as a replacement participant.
COHORT_SOURCE=r'''
import fs from 'node:fs';import {join,dirname} from 'node:path';import {pathToFileURL} from 'node:url';
const x=JSON.parse(fs.readFileSync(0,'utf8'));
const {assertCohortBinding,verifyCohort}=await import(pathToFileURL(join(x.tools,'cohort-binding.mjs')));
const {readBoundRuntime}=await import(pathToFileURL(join(x.tools,'cohort-runtime.mjs')));
assertCohortBinding(x.cohort,x.root,x.digest);
const registrySource=fs.readFileSync(join(x.root,'agents.json'),'utf8'),configSource=fs.readFileSync(x.config,'utf8');
let result;
if(x.mode==='initial')result=verifyCohort(x.cohort,{root:x.root,registrySource,configSource,phase:'pre',consumerPhase:'pre',runtimePhase:'quiesced',expectedDigest:x.digest,candidateRoot:x.input});
else {
 const runtime=readBoundRuntime(x.cohort,{phase:x.mode==='running'?'post':'quiesced',codePhase:'pre'});
 const ids=x.cohort.registryIds.filter(id=>!x.six.includes(id));
 // The original complete98 consumer call is valid only before inverse.
 // No cohort IDs or migration set are rewritten for a second loader call.
 // Python rechecks every original non-six pre observation/closure plus all
 // original code/config and accepted artifacts; source/routing inputs remain
 // exactly those whose full loader proof succeeded before original inverse.
 result={nonSix:ids,runtime,businessVerified:false};
}
process.stdout.write(JSON.stringify(result));
'''

def _json_child(e,lease,argv,value,timeout=600):
 lease.verify();child=None
 try:
  child=subprocess.Popen(['/usr/bin/python3','-I','-B','-c',CHILD_LAUNCH,str(lease.fd),json.dumps(argv)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'},cwd='/',close_fds=True,pass_fds=(lease.fd,),start_new_session=True)
  out,err=_bounded_io(child,_json(value),min(timeout,max(.01,getattr(e,'_e35_deadline',time.monotonic()+timeout)-time.monotonic())),8388608)
  e.need(child.returncode==0 and not err and len(out)<=8388608,'NONTERMINAL','observe');lease.verify()
  e._e35_child_receipts.append(dict(mode='cohort-'+value['mode'],adapter_sha256=_sha(COHORT_SOURCE.encode()),argv_sha256=_sha(_json(argv)),stdout_sha256=_sha(out),stderr_sha256=_sha(err),returncode=child.returncode))
  return _strict(out)
 except BaseException:
  _stop_child(child)
  raise

def _scene_inode(e,path):
 w=E35['scene_objects'][path]
 with FixedPath(e,path) as h:
  s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(not stat.S_ISLNK(s.st_mode) and (s.st_dev,s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(w['dev'],w['ino'],w['uid'],w['gid'],w['mode'],w['nlink']))
  if stat.S_ISREG(s.st_mode):e.need(s.st_size==w['bytes'])

class RecoveryScene:
 def __init__(self,e,p,original,batch):self.e=e;self.p=p;self.original=original;self.batch=batch;self.native_path=_m('migration-transaction.json');self.fence_path=_m('migration-fence.json');self.base=E35['holder']['binding'];self.root=self.base['deploymentRoot'];self.trusted=self.base['trustedRoot']
 def native(self):
  raw,_=_blob(self.e,self.native_path);tx=_strict(raw);old=copy.deepcopy(self.original);new=copy.deepcopy(tx)
  self.e.need(tx['txId']==E35['tx_id'] and tx['outer']==E35['holder'] and tx['state'] in ('ABORT_INCOMPLETE','ABORTED_PENDING_RUNTIME_RESTORE','ABORTED_PENDING_FENCE_CLEAR','ABORTED') and type(tx['activation']['restored'])is bool)
  for obj in (old,new):
   obj.pop('state',None);obj.pop('updatedAt',None);obj['activation'].pop('restored',None)
  self.e.need(new==old);return raw,tx
 def fixed(self):
  e=self.e
  self.import_closure()
  for path in (E35['trees']['codeinput']['root'],E35['trees']['publicArtifacts']['root'],_m('b7-preparation-input.json')):_scene_inode(e,path)
  for name,sha in E35['pins'].items():
   if name in ('migration-transaction.json','migration-fence.json','b7-six-target-batch.json'):continue
   _blob(e,_m(name),dict(sha256=sha,uid=0,gid=0,mode=0o600))
  _absent(e,_m('b7-six-target-batch.json.new'));_absent(e,_m('lock'))
  _blob(e,self.root+'/agent-model-overrides.json',dict(sha256=E35['config_sha256'],uid=505,gid=601,mode=0o600))
  alias=self.root+'/agents.json'
  with FixedPath(e,alias) as h:
   s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);e.need(stat.S_ISLNK(s.st_mode) and s.st_uid==0 and s.st_gid==601 and os.readlink(h.name,dir_fd=h.parent)==self.trusted+'/config/agents.json')
  _blob(e,self.trusted+'/config/agents.json',dict(sha256=E35['registry_sha256'],uid=0,gid=0,mode=0o644))
  _blob(e,'/Library/LaunchDaemons/ai.agent-core.runtime.plist',dict(sha256=E35['plist_sha256'],uid=0,gid=0,mode=0o644))
  _absent(e,self.original['manifest']);_absent(e,self.original['currentLink'])
  # Actual original code preimages are independently read, not inferred from
  # intent count or participant's exit status.
  a=self.original['activation'];e.need(a['configIntent'] is None and a['pluginIntent'] is False and a['plugins']==[] and len(a['rows'])==3)
  prep_raw,_=_blob(e,_m('b7-preparation-'+E35['tx_id']+'.json'),dict(sha256=E35['pins']['b7-preparation-'+E35['tx_id']+'.json'],uid=0,gid=0,mode=0o600));prep=_strict(prep_raw)
  e.need(prep['phase']=='SEALED' and prep['txId']==E35['tx_id'] and prep['holderNonce']==E35['holder']['nonce'] and prep['cohortSha256']==self.base['cohortSha256'])
  e.need(prep['genParent']==self.original['genParent'] and prep['genDir']==self.original['genDir'] and prep['preimageDir']==self.original['preimageDir'] and prep['scopeReceipt']==self.original['closureDigestsFile'])
  e.need(_tree(e,prep['genParent'])==prep['generationDigest'])
  _blob(e,prep['scopeReceipt'],dict(sha256=prep['scopeReceiptSha256']))
  for row in a['rows']:
   e.need(row['live'] in [self.trusted+'/'+part for part in ('app','harness','node-runtime')] and row['intent'] is False)
   e.need(_tree(e,row['live'])==row['pre'] and _tree(e,row['old'])==row['pre'])
   e.need(row['part'] in ('app','harness','node-runtime') and _tree(e,_m('activation-code-input/')+row['part'])==row['post'] and _tree(e,row['next'])==row['post'])
   for path in (row['displaced'],row['failed'],row['restore']):_absent(e,path)
 def import_closure(self):
  e=self.e;repo=str(Path(E35['tools']['preparationToolPath']['path']).parents[3]);private=str(Path(E35['tools']['participant']['path']).parents[1])
  for role,rows in E35['import_closure'].items():
   for relative,want in rows.items():
    path=repo+'/'+relative if role=='preparation' else private+'/'+relative.removeprefix('scripts/lib/')
    _blob(e,path,want)
  a=self.original['activation']
  e.need(a['migrationToolSha256']==E35['import_closure']['participant']['scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs']['sha256'])
  e.need(a['gates']['trusted-cp-model-overrides-config-gate.mjs']==E35['import_closure']['participant']['scripts/lib/trusted-cp-model-overrides-config-gate.mjs']['sha256'])
 def fence(self,cleared=False):
  raw,_=_blob(self.e,self.fence_path);f=_strict(raw)
  self.e.need(f.get('txId')==E35['tx_id'] and f.get('inFlight') is (not cleared))
  # Only the original at/timestamp may change with the same-TX clear.
  self.e.need(set(f)=={'txId','inFlight','at'});self.e.need(type(f['at'])is str)
  with FixedPath(self.e,self.fence_path) as h:
   s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);self.e.need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(505,601,0o600,1))
  return raw
 def batch_check(self,post=False,sync=False):
  e=self.e;b=self.batch
  e.need(b.get('kind')=='B7_SIX_TARGET_BATCH_V1' and b.get('phase')=='COMPLETE' and b.get('journalFile')=='.b7-six-journal.jsonl' and b.get('journalSha256')==E35['pins']['.b7-six-journal.jsonl'] and b.get('preimageStore')==self.base['recoveryRoot']+'/.b7-six-preimage-store')
  e.need([t['id'] for t in b['targets']]==E35['six_ids'])
  if post:_absent(e,_m('b7-six-target-batch.json'))
  else:_blob(e,_m('b7-six-target-batch.json'),dict(sha256=E35['pins']['b7-six-target-batch.json'],uid=0,gid=0,mode=0o600))
  journal,_=_blob(e,_m('.b7-six-journal.jsonl'),dict(sha256=b['journalSha256'],uid=0,gid=0,mode=0o600))
  facts={}
  for line in journal.splitlines():
   r=_strict(line)
   if r.get('phase')=='FACTS' and isinstance(r.get('path'),str) and isinstance(r.get('target'),str):facts[r['path']]=r['target']
  for t,want in zip(b['targets'],E35['six_public']):
   e.need(t['prestate']=='PARTIAL' and t.get('pending') is False)
   e.need(t['created']==want['created'] and len(t['files'])==want['recorded_files'])
   e.need([{k:r[k] for k in ('rel','storeFile','sha256')} for r in t['preimages']]==[{k:r[k] for k in ('rel','storeFile','sha256')} for r in want['preimages']])
   home=self.root+'/homes/'+t['id']
   def safe(rel):e.need(type(rel)is str and not rel.startswith('/') and '..' not in rel.split('/') and '.' not in rel.split('/'));return home+'/'+rel
   if not post:
    for rel,sha in t['files'].items():_blob(e,safe(rel),dict(sha256=sha),limit=268435456)
   for pre in t['preimages']:
    e.need('/' not in pre['storeFile'] and pre['storeFile'] not in ('.','..'))
    store=_m('.b7-six-preimage-store/')+pre['storeFile'];dst=safe(pre['rel']);w=E35['restore_leaves'][dst]
    backup=w['backup'];live=w['live']
    raw,pin=_blob(e,store,dict(sha256=pre['sha256'],uid=backup['uid'],gid=backup['gid'],mode=backup['mode'],dev=backup['dev'],ino=backup['inode'],bytes=pre['bytes']))
    # copyFile preserves the existing destination's custody/inode; backup
    # ownership is not authority to chown a canary or service-owned leaf.
    want=dict(sha256=pre['sha256'] if post or pre['rel'] not in t['files'] else t['files'][pre['rel']],uid=live['uid'],gid=live['gid'],mode=live['mode'],dev=live['dev'],ino=live['inode'])
    _blob(e,dst,want,sync=sync if post else False)
   for rel in t['created']:
    path=safe(rel)
    if post:_absent(e,path)
    else:
     with FixedPath(e,path) as h:
      s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);w=E35['created_links'][path]
      e.need(stat.S_ISLNK(s.st_mode) and path in facts and os.readlink(h.name,dir_fd=h.parent)==facts[path]==w['target'] and (s.st_dev,s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(w['dev'],w['inode'],w['uid'],w['gid'],w['mode'],w['nlink']))
   if post:
    _absent(e,home+'/profiles/node_modules/dsh-codex')
    if sync:
     for suffix in ('','/profiles','/profiles/node_modules','/profiles/node_modules/.bin','/profiles/node_modules/@agent-core','/profiles/agent-core-production'):
      with FixedPath(e,home+suffix+'/__e35_absent__') as h:os.fsync(h.parent);h.verify()
  if sync:
   with FixedPath(e,_m('b7-six-target-batch.json')) as h:os.fsync(h.parent)
 def observations(self):
  """Exact original non-six pre rows, including full dependency closure.
  Credential observation is metadata-only; never read its value.
  """
  e=self.e;b=self.original['activation']['cohort'];ids=sorted(set(b['registryIds'])-set(E35['six_ids']))
  e.need(len(ids)+len(E35['six_ids'])==len(b['registryIds']))
  for agent in ids:
   for o in b['consumers'][agent]['pre']:
    path=o['path']
    if o['kind']=='absent':_absent(e,path);continue
    with FixedPath(e,path) as h:
     s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
     e.need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(o['uid'],o['gid'],o['mode']) and not stat.S_ISLNK(s.st_mode) and path==o['realpath'])
     e.need((stat.S_ISREG(s.st_mode) and s.st_nlink==1) if o['kind']=='file' else o['kind']=='directory' and stat.S_ISDIR(s.st_mode))
     if o['role']=='canonical':
      parent=os.fstat(h.parent);e.need(stat.S_ISDIR(parent.st_mode) and parent.st_uid==b['serviceUid'] and stat.S_IMODE(parent.st_mode)==0o700)
    if o['role']=='canonical':
     e.need(o['kind']=='file' and o['mode']==0o600 and s.st_uid==b['serviceUid'] and s.st_nlink==1 and 'sha256' not in o)
    elif o['kind']=='file':_blob(e,path,dict(sha256=o['sha256'],uid=o['uid'],gid=o['gid'],mode=o['mode']))
    elif o['role']=='dependencies':e.need(_dependency(e,path)==o['treeSha256'])
 def cohort(self,lease,mode):
  e=self.e;a=self.original['activation'];tools=str(Path(E35['tools']['participant']['path']).parent)
  for name,sha in self.base['cohortSupport'].items():_blob(e,tools+'/'+name,dict(sha256=sha,uid=0,gid=0,mode=0o644))
  _blob(e,tools+'/cohort-binding.mjs',dict(sha256=self.base['cohortToolSha256'],uid=0,gid=0,mode=0o644))
  for key in ('plugin','scopes','sourceStamp'):
   artifact=a['cohort']['artifacts'][key];_blob(e,artifact['path'],dict(sha256=artifact['sha256']),limit=268435456)
  value=dict(mode=mode,tools=tools,cohort=a['cohort'],digest=self.base['cohortSha256'],root=self.root,config=self.root+'/agent-model-overrides.json',input=self.base['recoveryRoot']+'/activation-code-input',six=E35['six_ids'])
  result=_json_child(e,lease,[E35['tools']['node']['path'],'--input-type=module','-e',COHORT_SOURCE],value)
  if mode=='initial':e.need(result.get('compatibilityCount')==len(a['cohort']['registryIds']) and result.get('runtimeIdentity') is None and result.get('businessVerified') is False)
  else:e.need(result.get('nonSix')==[i for i in a['cohort']['registryIds'] if i not in E35['six_ids']]);self.observations()
  return result
 def initial(self,lease):
  _scene_inode(self.e,self.native_path);_scene_inode(self.e,self.fence_path);_scene_inode(self.e,_m('b7-six-target-batch.json'))
  raw,tx=self.native();self.e.need(_sha(raw)==E35['pins']['migration-transaction.json'] and tx['state']=='ABORT_INCOMPLETE' and tx['activation']['restored'] is False)
  self.fixed();self.e.need(_sha(self.fence(False))==E35['pins']['migration-fence.json']);self.batch_check();lease.guard();self.cohort(lease,'initial');self.fixed();self.batch_check();lease.guard()
 def after_six(self,lease):
  self.fixed();self.batch_check(True,True);_run_child(self.e,lease.fd,'verify-pre');self.cohort(lease,'after-six');self.fixed();lease.guard()
 def post(self,lease,running=False,sync=False):
  self.fixed();self.batch_check(True,sync);raw,tx=self.native();self.e.need(tx['activation']['restored'] is True)
  _run_child(self.e,lease.fd,'verify-pre')
  if running is None:self.observations()
  else:self.cohort(lease,'running' if running else 'after-six')
  self.fixed()
 def ensure_runtime(self,lease,guard):
  e=self.e;target='system/ai.agent-core.runtime';r=_command(e,['/bin/launchctl','print',target])
  if r.returncode:
   e.need(b'Could not find' in r.stderr or b'service not found' in r.stderr)
   guard();r=_command(e,['/bin/launchctl','bootstrap','system','/Library/LaunchDaemons/ai.agent-core.runtime.plist'],timeout=30)
   if r.returncode:guard();r=_command(e,['/bin/launchctl','kickstart','-k',target],timeout=30);e.need(r.returncode==0,'NONTERMINAL','observe')
  # readBoundRuntime original post/codePhase=pre proves actual PID/UID/GID,
  # loaded plist/root/entry/source bytes; retry bounded only read observations.
  last=None
  for _ in range(30):
   _budget(e)
   try:proof=self.cohort(lease,'running');last=None;break
   except Exception as ex:last=ex;time.sleep(1)
  if last is not None:raise last
  # Existing runtime health, never deployment daemon health or provider calls.
  self.health(False);return proof
 def health(self,require_ready):
  e=self.e;_budget(e);request=urllib.request.Request('http://127.0.0.1:8790/health',method='GET')
  opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
  with opener.open(request,timeout=min(10,max(.01,getattr(e,'_e35_deadline',time.monotonic()+10)-time.monotonic()))) as response:
   raw=response.read(65537);e.need(response.status==200 and len(raw)<=65536)
  health=_strict(raw);e.need(health.get('ok') is True and type(health.get('deliverReady'))is bool and (not require_ready or health['deliverReady'] is True),'NONTERMINAL','observe');return health

def _dependency(e,path):
 # Same traversal as original dependencyDigest; only directory token differs.
 # No reading of canonical credential rows is routed through this function.
 rows=[]
 def walk(p,rel):
  _budget(e)
  with FixedPath(e,p) as h:
   s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);meta=[s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode)]
   if stat.S_ISLNK(s.st_mode):rows.append([rel,'link']+meta+[os.readlink(h.name,dir_fd=h.parent)])
   elif stat.S_ISREG(s.st_mode):raw,_=_blob(e,p);rows.append([rel,'file']+meta+[_sha(raw)])
   else:
    e.need(stat.S_ISDIR(s.st_mode));fd=os.open(h.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=h.parent)
    try:
     names=sorted(os.listdir(fd));pin=_id(s);rows.append([rel,'directory']+meta)
     for n in names:walk(p+'/'+n,n if rel=='.' else rel+'/'+n)
     e.need(pin==_id(os.fstat(fd))==_id(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)) and names==sorted(os.listdir(fd)))
    finally:os.close(fd)
 walk(path,'.');return _sha(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode())

def _paths(e):
 base=e.path(E35['operation_id']).removesuffix('.json')
 return {key:base+'.b7-recovery-'+key+'.json' for key in ('auth','terminal','progress','native','batch')}

def _original_receipts(e,p):
 op=E35['operation_id'];regraw,_=e.base.registration(op)
 e.need(_sha(regraw)==E35['registration_sha256'])
 raw,_=_blob(e,e.path(op),dict(sha256=E35['execution_sha256'],uid=0,gid=80,mode=0o600))
 s=_strict(raw);e.need(s['tx_id']==E35['tx_id'] and s['phase']=='RETAINED' and s['attempt']==1 and type(s['attempt'])is int and s['input_sequence']==0 and type(s['input_sequence'])is int and s['input_pending'] is None and s['terminal_output'] is False)
 e.need(p['nativeTransactionPath']==_m('migration-transaction.json') and p['nativeLockPath']==E35['lock_root'] and p['resumeOuterPath']==E35['tools']['outerPath']['path'] and p['resumeOuterSha256']==E35['tools']['outerPath']['sha256'])
 e.need(all(E35['holder']['binding'].get(k)==v for k,v in p['terminalBinding'].items()))
 return raw,s

def _snapshot(e,p):
 with FixedPath(e,p['snapshotRoot']+'/__e35_absent__') as h:
  s=os.fstat(h.parent);e.need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,0,0o700))
  e.need(sorted(os.listdir(h.parent))==sorted(r['relative'] for r in p['files']) and len(p['files'])==9)
  for row in p['files']:
   e.need(type(row['relative'])is str and '/' not in row['relative'] and row['relative'] not in ('.','..'))
   _blob(e,p['snapshotRoot']+'/'+row['relative'],dict(sha256=row['sha256'],uid=0,gid=0,mode=0o600,bytes=row['bytes']))

def _load_record(e,key):
 path=_paths(e)[key]
 if not _exists(e,path):return None
 raw,_=_blob(e,path,dict(sha256=_sha(_blob(e,path)[0]),uid=0,gid=80,mode=0o600));value=_strict(raw)
 if key in ('auth','terminal','progress'):
  e.need(value.get('kind')=='DS_B7_RECOVERY_'+key.upper()+'_V1' and value.get('operation_id')==E35['operation_id'] and value.get('tx_id')==E35['tx_id'] and value.get('helper_source_sha256')==e._e35_source_sha256)
 return raw,value

def _progress(e,phase,auth_sha,guard,detail=None):
 value=dict(kind='DS_B7_RECOVERY_PROGRESS_V1',operation_id=E35['operation_id'],tx_id=E35['tx_id'],helper_source_sha256=e._e35_source_sha256,authorization_sha256=auth_sha,phase=phase,attempt=1,reason='FIXED_E35_RECOVERY',input_sequence=0,input_pending=None,terminal_output=phase=='TERMINAL',detail=dict(calls=copy.deepcopy(getattr(e,'_e35_child_receipts',[])),**(detail or {})))
 path=_paths(e)['progress'];prior=_load_record(e,'progress')
 if prior is not None:e.need(prior[1]['authorization_sha256']==auth_sha)
 if prior is not None and prior[0]==_json(value):_blob(e,path,_pin(prior[0],0,80),sync=True);guard()
 else:_put(e,path,_json(value),guard,None if prior is None else _pin(prior[0],0,80))
 return value

def _rewrite_native(e,scene,state,guard):
 raw,tx=scene.native();e.need(state in ('ABORTED_PENDING_RUNTIME_RESTORE','ABORTED_PENDING_FENCE_CLEAR','ABORTED'))
 if tx['state']==state:
  _blob(e,scene.native_path,_pin(raw),sync=True);guard();return raw
 tx['state']=state;tx['updatedAt']=_now();path=scene.native_path
 _put(e,path,_json(tx),guard,_pin(raw),gid=0);return _json(tx)

def _clear_fence(e,scene,guard):
 raw,_=_blob(e,scene.fence_path);f=_strict(raw)
 if f.get('inFlight') is False:
  scene.fence(True);_blob(e,scene.fence_path,_pin(raw,505,601),sync=True);guard();return
 raw=scene.fence(False);e.need(_sha(raw)==E35['pins']['migration-fence.json']);f=_strict(raw);f['inFlight']=False;f['at']=_now()
 _put(e,scene.fence_path,_json(f),guard,_pin(raw,505,601),uid=505,gid=601);scene.fence(True)

def _overlay(e):
 """Read-only historical overlay. Cold/no durable proof is UNKNOWN.
 Never rehash 1GB trees, acquire leases, fsync, restart service or write STATUS.
 """
 proof=getattr(e,'_e35_completed',None)
 if proof is None:return None
 try:
  a=_load_record(e,'auth');t=_load_record(e,'terminal')
  e.need(a is not None and t is not None and _sha(a[0])==proof['auth_sha256'] and _sha(t[0])==proof['terminal_sha256'])
  e.need(t[1]['authorization_sha256']==_sha(a[0]) and t[1]['original_receipt_sha256_post']==E35['execution_sha256'])
  _blob(e,e.path(E35['operation_id']),dict(sha256=E35['execution_sha256'],uid=0,gid=80,mode=0o600))
  e.need(t[1]['terminal']==proof['terminal'])
  e.need(_blob(e,_paths(e)['auth'])[1]==proof['auth_pin'] and _blob(e,_paths(e)['terminal'])[1]==proof['terminal_pin'])
  return dict(native_state='ABORTED',installed=False,authorization_sha256=_sha(a[0]),original_receipt_sha256=E35['execution_sha256'])
 except Exception:return None

def recover_fixed_e35(e,r,peer):
 """Synchronous existing RECOVERY action, no execute/Owner input or new TX."""
 e._e35_deadline=time.monotonic()+7200
 e.need(r.get('operation_id')==E35['operation_id'] and peer==502,'PROFILE_NOT_AUTHORIZED','authorize')
 reg,p=e.identity(E35['operation_id'],peer);e.need(p['enabled'],'PROFILE_NOT_AUTHORIZED','authorize');e.need(type(p['maxRunSeconds'])is int and 0<p['maxRunSeconds']<=7200);e._e35_deadline=time.monotonic()+p['maxRunSeconds']
 paths=_paths(e);e._e35_writable_paths=set(paths.values())|{_m('migration-transaction.json'),_m('migration-fence.json')};e._e35_child_receipts=[]
 with e.guard:
  e.need(e.active is None,'MUTATION_BUSY','admission')
  with _global_lease(e) as global_check:
   original_raw,s=_original_receipts(e,p)
   if _overlay(e) is not None:return e.view(E35['operation_id'],reg,p,s)
   _snapshot(e,p);_quiescent(e)
   auth=_load_record(e,'auth');term=_load_record(e,'terminal');progress=_load_record(e,'progress')
   # A visible auth/progress pair cannot prove that an interrupted original
   # inverse never began. Only a continuously observed in-process state can.
   if auth is not None:
    e.need(getattr(e,'_e35_attempt',None) is not None,'NONTERMINAL','observe')
    e.need(term is None and progress is not None and auth[1]['original_receipt_sha256']==E35['execution_sha256'])
   else:
    e.need(term is None and progress is None and not _exists(e,paths['native']) and not _exists(e,paths['batch']),'NONTERMINAL','observe')
   with NativeLease(e) as lease:
    def guard():e.need(time.monotonic()<e._e35_deadline,'NONTERMINAL','observe');global_check();_original_receipts(e,p);lease.guard()
    guard()
    if auth is None:
     native_raw,_=_blob(e,_m('migration-transaction.json'),dict(sha256=E35['pins']['migration-transaction.json'],uid=0,gid=0,mode=0o600))
     batch_raw,_=_blob(e,_m('b7-six-target-batch.json'),dict(sha256=E35['pins']['b7-six-target-batch.json'],uid=0,gid=0,mode=0o600))
     scene=RecoveryScene(e,p,_strict(native_raw),_strict(batch_raw));scene.initial(lease)
     value=dict(kind='DS_B7_RECOVERY_AUTH_V1',operation_id=E35['operation_id'],tx_id=E35['tx_id'],helper_source_sha256=e._e35_source_sha256,original_receipt_sha256=E35['execution_sha256'],original_receipt_bytes_b64=base64.b64encode(original_raw).decode(),original_policy_sha256=s['execution_policy_sha256'],expected_binding=E35['holder']['binding'],holder_nonce=E35['holder']['nonce'],cohort_seal=E35['holder']['binding']['cohortSha256'],native_sha256=_sha(native_raw),batch_sha256=_sha(batch_raw),holder_sha256=E35['holder_sha256'],holder_bytes_b64=base64.b64encode(os.pread(lease.fd,65537,0)).decode(),original_tool_pins=E35['tools'],helper_role='FIXED_E35_RECOVERY_NOT_ORIGINAL_CARRIER',pre_phase=s['phase'],pre_attempt=s['attempt'],pre_reason=s['reason'],owner_idle_seconds=p['ownerIdleSeconds'],max_run_seconds=p['maxRunSeconds'])
     auth_sha=_establish(e,paths['auth'],value,guard)
     # Set reliable not-begun only after our own authorization publication.
     e._e35_attempt={'phase':'NOT_BEGUN','auth_sha256':auth_sha}
     _establish(e,paths['native'],native_raw,guard);_establish(e,paths['batch'],batch_raw,guard)
    else:
     auth_sha=_sha(auth[0]);e.need(auth_sha==e._e35_attempt['auth_sha256'])
     native_raw=_blob(e,paths['native'],dict(sha256=auth[1]['native_sha256'],uid=0,gid=80,mode=0o600))[0]
     batch_raw=_blob(e,paths['batch'],dict(sha256=auth[1]['batch_sha256'],uid=0,gid=80,mode=0o600))[0]
     scene=RecoveryScene(e,p,_strict(native_raw),_strict(batch_raw))
    phase=e._e35_attempt['phase']
    if phase=='NOT_BEGUN':
     scene.initial(lease);_progress(e,'SIX_INTENT',auth_sha,guard);scene.initial(lease)
     # Monotone tri-state: never set NOT_BEGUN after this point, including a
     # child failure before its first byte-changing copy of equal bytes.
     e._e35_attempt['phase']='SIX_UNKNOWN'
     guard();_run_child(e,lease.fd,'inverse')
     scene.batch_check(True,True);guard();e._e35_attempt['phase']='SIX_COMPLETE'
     _progress(e,'SIX_COMPLETE',auth_sha,guard)
    e.need(e._e35_attempt['phase'] in ('SIX_COMPLETE','RESTORE_UNKNOWN','RESTORED','RUNTIME_PENDING','RUNTIME','FENCE_CLEAR','ABORTED'),'NONTERMINAL','observe')
    scene.batch_check(True,True);guard()
    if e._e35_attempt['phase']=='SIX_COMPLETE':
     scene.after_six(lease);_progress(e,'RESTORE_INTENT',auth_sha,guard);e._e35_attempt['phase']='RESTORE_UNKNOWN';_run_child(e,lease.fd,'restore');scene.post(lease,sync=True)
     e._e35_attempt['phase']='RESTORED';_progress(e,'RESTORED',auth_sha,guard)
    if e._e35_attempt['phase']=='RESTORE_UNKNOWN':
     # The original restore is not replayed after uncertain dispatch. Only an
     # already complete actual poststate can advance this read/sync branch.
     scene.post(lease,sync=True);e._e35_attempt['phase']='RESTORED';_progress(e,'RESTORED',auth_sha,guard)
    if e._e35_attempt['phase']=='RESTORED':
     scene.post(lease,sync=True);_rewrite_native(e,scene,'ABORTED_PENDING_RUNTIME_RESTORE',guard)
     e._e35_attempt['phase']='RUNTIME_PENDING';_progress(e,'RUNTIME_INTENT',auth_sha,guard)
    if e._e35_attempt['phase']=='RUNTIME_PENDING':
     # Runtime may now legitimately be loaded by our previous ensure step.
     # Check code/config/non-six/six here, then prove current actual source and
     # health through original ensure before advancing or clearing the fence.
     scene.post(lease,None,True);scene.ensure_runtime(lease,guard);scene.post(lease,True,True)
     e._e35_attempt['phase']='RUNTIME';_progress(e,'RUNTIME_RESTORED',auth_sha,guard)
    if e._e35_attempt['phase']=='RUNTIME':
     scene.post(lease,True,True);_rewrite_native(e,scene,'ABORTED_PENDING_FENCE_CLEAR',guard)
     _progress(e,'FENCE_CLEAR_INTENT',auth_sha,guard);_clear_fence(e,scene,guard)
     e._e35_attempt['phase']='FENCE_CLEAR';_progress(e,'FENCE_CLEAR',auth_sha,guard)
    if e._e35_attempt['phase']=='FENCE_CLEAR':
     scene.fence(True);scene.post(lease,True,True);scene.health(True);final_raw=_rewrite_native(e,scene,'ABORTED',guard)
     e._e35_attempt['phase']='ABORTED';_progress(e,'ABORTED',auth_sha,guard)
    scene.fence(True);scene.post(lease,True,True);scene.health(True);final_raw,tx=scene.native();e.need(tx['state']=='ABORTED')
    _blob(e,scene.native_path,_pin(final_raw),sync=True);guard();lease.release();global_check()
   # Original native verification becomes valid only after normal release.
   terminal=e.verify_terminal(dict(s,terminal_output=True),p);e.need(terminal['native_state']=='ABORTED' and terminal['installed'] is False)
   def terminal_guard():
    global_check();_original_receipts(e,p);_absent(e,E35['lock_root']);raw,tx=scene.native();e.need(tx['state']=='ABORTED' and _sha(raw)==terminal['transaction_sha256']);scene.fence(True)
   value=dict(kind='DS_B7_RECOVERY_TERMINAL_V1',operation_id=E35['operation_id'],tx_id=E35['tx_id'],helper_source_sha256=e._e35_source_sha256,authorization_sha256=auth_sha,terminal=terminal,original_receipt_sha256_pre=E35['execution_sha256'],original_receipt_sha256_post=E35['execution_sha256'],original_policy_sha256=s['execution_policy_sha256'])
   terminal_sha=_establish(e,paths['terminal'],value,terminal_guard);_progress(e,'TERMINAL',auth_sha,terminal_guard)
   terminal_guard();e._e35_completed=dict(auth_sha256=auth_sha,terminal_sha256=terminal_sha,terminal=terminal,auth_pin=_blob(e,paths['auth'])[1],terminal_pin=_blob(e,paths['terminal'])[1])
   return e.view(E35['operation_id'],reg,p,s)

def install_e35_recovery(ds,e,source_sha256):
 """Called only by sealed host with the actual compiled source SHA.
 The trusted assembler owns this identity input; no request can select it.
 """
 e.need(type(source_sha256)is str and re.fullmatch(r'[a-f0-9]{64}',source_sha256) is not None)
 e._e35_source_sha256=source_sha256;e._e35_completed=None;e._e35_attempt=None
 old_recovery=e.recovery_abort;old_overlay=e.recovery_view_overlay;old_load=e.load
 def recovery(self,r,peer):
  if r.get('operation_id')!=E35['operation_id']:return old_recovery(r,peer)
  return recover_fixed_e35(self,r,peer)
 def overlay(self,op):return _overlay(self) if op==E35['operation_id'] else old_overlay(op)
 def load(self,op,reg):
  if op!=E35['operation_id']:return old_load(op,reg)
  raw,_=_blob(self,self.path(op),dict(sha256=E35['execution_sha256'],uid=0,gid=80,mode=0o600));s=_strict(raw)
  self.need(s['registration_sha256']==reg['request_sha256'] and s['tx_id']==E35['tx_id']);return s
 e.recovery_abort=types.MethodType(recovery,e);e.recovery_view_overlay=types.MethodType(overlay,e);e.load=types.MethodType(load,e)
 return e

if __name__=='__main__':raise SystemExit('E35_ORIGINAL_DS_RECOVERY_ONLY')
