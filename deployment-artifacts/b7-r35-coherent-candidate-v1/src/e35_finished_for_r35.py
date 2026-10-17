"""Fixed read-only R35 placement admission. No STATUS, recovery or retirement.

Actual completion pins are supplied only by the existing root-sealed prepare
config after Root's real returns/readbacks; visible records alone are no proof.
"""
import contextlib,fcntl,hashlib,json,os,re,stat,types
from pathlib import Path
KIND='B7_FIXED_E35_FINISHED_FOR_R35_V1'
OP='b7-packet-r34-1cfeff2a5b138629-e35'
TX='tx-c0fd42f71e074eeb8f0e9902e1a3e084'
PLAN='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'
ORIGINAL_EIGHT_ABSENT=['/var/db/agent-core/authsvc-codex-migration/'+name for name in ('activation-code-input','b7-preparation-input.json','b7-six-target-batch.json','b7-six-target-batch.json.new','migration-transaction.json','migration-fence.json')]+['/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock','/usr/local/share/agent-core/artifacts']
def need(v,reason):
 if not v:raise RuntimeError(reason)
def digest(v):need(type(v)is str and re.fullmatch('[a-f0-9]{64}',v),'ACTUAL_COMPLETION_PIN_REQUIRED');return v
def completed(value):
 need(type(value)is dict and set(value)=={'actual_result_sha256','full_readback_sha256','durability_completed'} and value['durability_completed'] is True,'ACTUAL_DURABILITY_COMPLETION_REQUIRED')
 for k in ('actual_result_sha256','full_readback_sha256'):digest(value[k])
def validate_binding(v):
 need(type(v)is dict and set(v)=={'kind','retirement_helper_sha256','retirement_pins_sha256','finished_row_sha256','completed_retirement_proof'} and v['kind']==KIND,'FIXED_SUCCESSOR_BINDING_REQUIRED')
 for k in ('retirement_helper_sha256','retirement_pins_sha256','finished_row_sha256'):digest(v[k])
 completed(v['completed_retirement_proof'])
def protected_leaf(path,sha,mode):
 """Root-controlled driven files only; no caller-supplied executable path."""
 parent=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  for part in Path(path).parts[1:-1]:
   fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);s=os.fstat(fd)
   need(s.st_uid==0 and not s.st_mode&0o022,'PROTECTED_ANCESTOR_REQUIRED');os.close(parent);parent=fd
  fd=os.open(Path(path).name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
  try:
   before=os.fstat(fd);need(stat.S_ISREG(before.st_mode) and (before.st_uid,before.st_gid,stat.S_IMODE(before.st_mode),before.st_nlink)==(0,0,mode,1) and 0<before.st_size<=4*1024*1024,'PROTECTED_LEAF_REQUIRED')
   raw=os.pread(fd,before.st_size+1,0);after=os.stat(Path(path).name,dir_fd=parent,follow_symlinks=False)
   sig=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_gid,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
   need(len(raw)==before.st_size and sig(before)==sig(os.fstat(fd))==sig(after) and hashlib.sha256(raw).hexdigest()==digest(sha),'PROTECTED_LEAF_CHANGED');return raw
  finally:os.close(fd)
 finally:os.close(parent)
def retirement_module(binding,wb):
 raw=protected_leaf(Path(wb)/'e35_terminal_materials_once.py',binding['retirement_helper_sha256'],0o555)
 module=types.ModuleType('fixed_e35_finished_reader');module.__file__=str(Path(wb)/'e35_terminal_materials_once.py');exec(compile(raw,module.__file__,'exec'),module.__dict__)
 need((module.OPERATION,module.TRANSACTION,module.PLAN_SHA256)==(OP,TX,PLAN) and module._PINS_SHA==binding['retirement_pins_sha256'],'RETIREMENT_SOURCE_SUBJECT');return module
def finished_rows(r,lease_current):
 """Reuse original finite parser/schema under a shared, read-only audit FD."""
 need('e35-retire' in r.AuditTrail.records_locked.__code__.co_consts and 'prepare-inputs' not in r.AuditTrail.records_locked.__code__.co_consts,'E35_RETIRE_AUDIT_LABEL_REQUIRED')
 class ReadOnly(r.AuditTrail):
  def verify(self):
   s,p=os.fstat(self.fd),os.fstat(self.parent)
   r.need(stat.S_ISDIR(p.st_mode) and (p.st_uid,p.st_gid,stat.S_IMODE(p.st_mode))==(0,0,0o700) and r.custody(p)==self.parent_pin,'AUDIT_PARENT_CUSTODY')
   r.need(stat.S_ISREG(s.st_mode) and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(0,0,0o644,1) and r.custody(s)==self.file_pin and 0<=s.st_size<=64*1024*1024,'AUDIT_FILE_CUSTODY')
   r.need(fcntl.fcntl(self.fd,fcntl.F_GETFL)&os.O_ACCMODE==os.O_RDONLY,'READ_ONLY_AUDIT_REQUIRED');r.same_entry(self.fd,self.parent,self.name);lease_current()
  @contextlib.contextmanager
  def locked(self):
   fcntl.flock(self.fd,fcntl.LOCK_SH)
   try:self.verify();yield;self.verify()
   finally:fcntl.flock(self.fd,fcntl.LOCK_UN)
 with r.FixedPath(r._AUDIT) as p:
  fd=os.open(p.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=p.parent)
  try:
   trail=ReadOnly(fd,p.parent,lease_current)
   with trail.locked():rows=trail.records_locked()
  finally:os.close(fd)
 table={row['outcome']:row for row in rows};need(len(rows)==4,'FIXED_RETIREMENT_NOT_FINISHED')
 obj=types.SimpleNamespace(outcomes=r.AuditTrail.outcomes,find=lambda key:table.get(key))
 return r._phase_records(obj)
def assert_finished(binding,lease_current,wb):
 validate_binding(binding);lease_current();r=retirement_module(binding,wb)
 # The read-only scene uses the same protected file/path primitives. Its normal
 # constructor opens an append FD, so do not invoke it for successor admission.
 s=r.FixedE35Scene.__new__(r.FixedE35Scene)
 s.lease_current=lease_current;s.paths=[];s.fds=[];s._path_cache={};s.reservation=None;s.materials=[];s.immutable_files=[];s.tools=[];s.tool_relatives=[];s._native_parent=None;s.wb=str(wb)
 try:
  raw=protected_leaf(Path(wb)/'e35-terminal-material-pins.json',binding['retirement_pins_sha256'],0o444);s.pins=r.strict_json(raw)
  need((s.pins.get('kind'),s.pins.get('operation_id'),s.pins.get('tx_id'),s.pins.get('accepted_proposal_sha256'))==('B7_E35_TERMINAL_MATERIAL_RETIREMENT_PINS_V1',OP,TX,PLAN),'FIXED_RETIREMENT_PINS_SUBJECT')
  completed(s.pins['completed_recovery_proof']);s.proof_sha=hashlib.sha256(r.canonical(s.pins['completed_recovery_proof'])).hexdigest();need(s.proof_sha==s.pins['recovery_proof_sha256'],'COMPLETED_RECOVERY_PROOF_BINDING')
  s.mutex_path=s.path(r._STATE_ROOT+'/mutation.lock');s.mutex_fd=s.leaf(s.mutex_path);m=os.fstat(s.mutex_fd)
  need((m.st_dev,m.st_ino,m.st_uid,m.st_gid,stat.S_IMODE(m.st_mode),m.st_nlink)==(16777233,102163320,0,80,0o644,1),'ORIGINAL_MUTATION_LOCK_BINDING')
  s.ds_guard();s.original_records()
  intent,admitted,durable,finished=finished_rows(r,lease_current);s.bind_intent(intent['payload'])
  need(finished['row_sha256']==binding['finished_row_sha256'],'FIXED_FINISHED_ROW_CHANGED')
  need(durable['payload']['history_lineages']==[p['lineage_sha256'] for p in s.pins['objects']],'FIXED_FIVE_HISTORY_PROOF_BINDING')
  # No cache requirement and no full old history/current native reconstruction.
  # Original post-checkpoint enforces eight canonical absences and restored
  # original live/HR/six+journal predicates. It cannot rerun retirement.
  s.load_checkpoint();need(s.checkpoint.c['oldCleanAbsent']==ORIGINAL_EIGHT_ABSENT,'ORIGINAL_EIGHT_ABSENCE_SCOPE_CHANGED')
  checkpoint=s.post_checkpoint();need(r.strict_payload(checkpoint)==r.strict_payload(finished['payload']['checkpoint']),'ORIGINAL_RESTORED_CHECKPOINT_CHANGED');s.ds_guard()
  return dict(kind=KIND,recovery_terminal_sha256=s.pins['recovery_records']['terminal']['sha256'],retirement_finished_row_sha256=finished['row_sha256'],checkpoint=checkpoint,status_called=False,history_rebuilt=False)
 finally:s.close()
if __name__=='__main__':raise SystemExit('FIXED_SEALED_PREPARE_SIBLING_ONLY')
