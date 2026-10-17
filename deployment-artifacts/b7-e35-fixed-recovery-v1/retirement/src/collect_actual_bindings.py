"""Fixed E35 readonly binding collector. Never run by author against production.
Only stdout NDJSON observations; no output files, lease, fsync or production write.
Run only after the sole writer has actual recovery rc0 and completed STATUS.
"""
import copy,datetime,hashlib,json,os,stat,subprocess,sys,types
from pathlib import Path
HERE=Path(__file__).resolve().parent
HELPER=HERE/'cli-label-aligned/e35_terminal_materials_once.py'
HELPER_SHA='ff3b034fba7de81e09026f1e72b3c42617b9a0881d9196f24f5675a29eee1252'
BASE_CONFIG=Path('/Users/yanfenma/Documents/Codex/2026-10-16/b7-v50-continuation-audit/codex-r34-coherent-business-candidate-20261018/candidate-freeze/b7-install-r34/packet/b7-wired-stage/checkpoint-inputs.json')
BASE_CONFIG_SHA='393555956947d846e5e9f5772b72d6e6adaafacf069bba6c94680d1d06b6ffc5'
CHECKPOINT='/private/var/db/agent-deploy-system-execution/b7-native-execution-r34-c71fd2cc/b7-wired-stage/checkpoint.py'
CLIENT='/usr/local/libexec/agent-deploy-system/ds_client.py'
CLIENT_SHA='9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67'
RECOVERY_HELPER_SHA='fe95f324d95fec91222881f9abb50ba325d375eafb0e8644c000dc391ae89b0d'
MIGRATION='/private/var/db/agent-core/authsvc-codex-migration'
STATE='/private/var/db/agent-deploy-system'
OP='b7-packet-r34-1cfeff2a5b138629-e35'
TX='tx-c0fd42f71e074eeb8f0e9902e1a3e084'
PROPOSAL='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'
JOURNAL='81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf'

def sha(raw):return hashlib.sha256(raw).hexdigest()
def require(value,reason):
    if not value:raise RuntimeError(reason)
def emit(value):
    # Each record is one original JSON line, never a file-body export.
    sys.stdout.write(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True)+'\n')

def pinned_public_bytes(path,digest,limit=1048576):
    # The only owner-owned input data/code reads; exact fixed digest, nofollow
    # every ancestor/leaf, held bytes, no hash-then-reopen execution.
    fds=[]
    try:
        parent=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);fds.append(parent)
        for name in str(path).strip('/').split('/')[:-1]:
            child=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);fds.append(child);parent=child
        name=Path(path).name;fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent);fds.append(fd);before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and 0<before.st_size<=limit,'COLLECTOR_PUBLIC_INPUT_CUSTODY')
        chunks=[];offset=0
        while offset<before.st_size:
            block=os.pread(fd,min(65536,before.st_size-offset),offset);require(bool(block),'COLLECTOR_PUBLIC_INPUT_SHORT');chunks.append(block);offset+=len(block)
        raw=b''.join(chunks)
        identity=lambda x:(x.st_dev,x.st_ino,x.st_mode,x.st_uid,x.st_gid,x.st_nlink,x.st_size,x.st_mtime_ns,x.st_ctime_ns)
        require(identity(before)==identity(os.fstat(fd))==identity(os.stat(name,dir_fd=parent,follow_symlinks=False)) and sha(raw)==digest,'COLLECTOR_PUBLIC_INPUT_CHANGED')
        return raw
    finally:
        for fd in reversed(fds):os.close(fd)

def load_helper():
    raw=pinned_public_bytes(HELPER,HELPER_SHA)
    m=types.ModuleType('fixed_e35_readonly_binding_source');m.__file__=str(HELPER)
    exec(compile(raw,str(HELPER),'exec'),m.__dict__)
    require(m.OPERATION==OP and m.TRANSACTION==TX and m.PLAN_SHA256==PROPOSAL,'COLLECTOR_SUBJECT')
    return m

class Reader:
    """Retain fixed nofollow FD chains. No creating/modifying syscall exists."""
    def __init__(self,m):self.m=m;self.paths=[];self.fds=[];self.files=[];self.runtime_traces=[]
    def path(self,path):
        p=self.m.FixedPath(path);p.__enter__();self.paths.append(p);return p
    def file(self,path,limit=4*1024*1024):
        p=self.path(path);fd=self.m.open_leaf(p.parent,p.name);self.fds.append(fd)
        raw=self.m._raw_fd(fd,limit);s=os.fstat(fd);self.m.same_entry(fd,p.parent,p.name)
        self.files.append((p,fd,sha(raw),limit))
        return raw,dict(sha256=sha(raw),uid=s.st_uid,gid=s.st_gid,mode=stat.S_IMODE(s.st_mode),dev=s.st_dev,inode=s.st_ino,bytes=s.st_size)
    def material(self,path):
        p=self.path(path);fd=self.m.open_leaf(p.parent,p.name);self.fds.append(fd);return p,fd
    def runtime_file(self,path,limit=1048576):
        # Only the five literal runtime source entries. They have known service
        # owned ancestors. No generic app-module execution or credential reads.
        require(path in [self.m._RUNTIME_ROOT+'/'+x for x in self.m._RUNTIME_ENTRIES],'COLLECTOR_RUNTIME_PATH')
        fds=[];trace=[]
        try:
            parent=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);fds.append(parent)
            for component in path.strip('/').split('/')[:-1]:
                before=os.stat(component,dir_fd=parent,follow_symlinks=False)
                require(stat.S_ISDIR(before.st_mode) and before.st_uid in (0,505) and not before.st_mode&0o022,'COLLECTOR_RUNTIME_ANCESTOR')
                fd=os.open(component,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);fds.append(fd)
                require(self.m.stable(before)==self.m.stable(os.fstat(fd)),'COLLECTOR_RUNTIME_ANCESTOR_DRIFT')
                trace.append((parent,component,fd,self.m.custody(before)));parent=fd
            name=path.rsplit('/',1)[1];fd=self.m.open_leaf(parent,name);fds.append(fd)
            raw=self.m._raw_fd(fd,limit);s=os.fstat(fd)
            require(s.st_uid in (0,505) and not s.st_mode&0o022,'COLLECTOR_RUNTIME_LEAF')
            self.m.same_entry(fd,parent,name)
            for p,n,c,pin in trace:require(pin==self.m.custody(os.fstat(c))==self.m.custody(os.stat(n,dir_fd=p,follow_symlinks=False)),'COLLECTOR_RUNTIME_ANCESTOR_DRIFT')
            return raw,s
        finally:
            for fd in reversed(fds):os.close(fd)
    def guard(self):
        for p in self.paths:p.verify()
        for p,fd,digest,limit in self.files:
            self.m.same_entry(fd,p.parent,p.name)
            require(sha(self.m._raw_fd(fd,limit))==digest,'COLLECTOR_FILE_DRIFT')
    def close(self):
        for fd in reversed(self.fds):os.close(fd)
        for p in reversed(self.paths):p.close()

def inventory(m,reader,path,label):
    p,fd=reader.material(path);original=m.canonical;capture=[]
    def canonical(value):
        # Exact original manifest_fd normalized full inventory, captured only
        # at its final hashing call. Root ctime is separately in the summary.
        capture.append(value);return original(value)
    m.canonical=canonical
    try:summary=m.manifest_fd(fd,sync=False)
    finally:m.canonical=original
    require(len(capture)==1 and type(capture[0]) is list,'COLLECTOR_MANIFEST_CAPTURE')
    m.same_entry(fd,p.parent,p.name)
    if summary['root']['type']=='Directory':
        for relative,row in capture[0]:emit(dict(kind='E35_READONLY_INVENTORY_ROW_V1',inventory=label,relative=relative,metadata=row))
    return summary,p,fd

def original_status(reader,client_pin,auth_sha):
    require((client_pin['uid'],client_pin['gid'])==(0,0) and client_pin['sha256']==CLIENT_SHA and not client_pin['mode']&0o022,'COLLECTOR_INSTALLED_CLIENT')
    result=subprocess.run(['/usr/bin/python3','-I','-B',CLIENT,'b7-status-r3',OP],capture_output=True,timeout=120,user=502,group=20,extra_groups=[],env={'PATH':'/usr/bin:/bin','LC_ALL':'C'},close_fds=True)
    require(result.returncode==0 and not result.stderr and len(result.stdout)<=65536,'COLLECTOR_ORIGINAL_STATUS_FAILED')
    value=reader.m.strict_json(result.stdout)
    require(type(value) is dict and value.get('schema')=='ds-b7-execution-v2' and value.get('ok') is True and value.get('action')=='DS_B7_EXECUTION_STATUS_V2' and value.get('effect')=='READ_ONLY' and value.get('operation_id')==OP and value.get('replay_allowed') is False,'COLLECTOR_STATUS_ENVELOPE')
    data=value['data']
    for k,v in dict(phase='RETAINED',active=False,attempt=1,input_sequence=0,input_pending=False,installed='UNKNOWN',native_state='UNKNOWN',native_terminal_verified=False,replay_allowed=False,tx_id=TX).items():require(type(data.get(k)) is type(v) and data[k]==v,'COLLECTOR_STATUS_SUBJECT')
    require(data.get('recovery_terminal')==dict(native_state='ABORTED',installed=False,authorization_sha256=auth_sha,original_receipt_sha256=reader.m._EXEC_SHA),'COLLECTOR_STATUS_COMPLETED_OVERLAY_REQUIRED')
    reader.guard();return sha(result.stdout),dict(phase=data['phase'],attempt=1,input_sequence=0,tx_id=TX,recovery_terminal=data['recovery_terminal'],caller_uid=502,caller_gid=20)

def config_draft(reader,journal_pin,utc):
    # This external original data file is exactly pinned and only contains
    # approved paths/public digests. It is never imported or executed.
    raw=pinned_public_bytes(BASE_CONFIG,BASE_CONFIG_SHA)
    base=reader.m.strict_json(raw);new=copy.deepcopy(base)
    a=new['oldProducer']['preimageCompatibility'];old=base['oldProducer']['preimageCompatibility']
    require(a['byteBindingPath']==str(Path(CHECKPOINT).parent/'preimage-byte-bindings.json'),'COLLECTOR_ORIGINAL_BYTE_BINDING')
    a['journalSha256']=journal_pin['sha256'];a['currentJournal']['journalSha256']=journal_pin['sha256']
    a['currentJournal']['authority']='accepted-e35-49b-fixed-readonly-post-recovery-observation'
    a['currentJournal']['reader']='originalUID0-fixed-E35-binding-collector/no-write'
    a['currentJournal']['utc']=utc
    inverse=copy.deepcopy(new);q=inverse['oldProducer']['preimageCompatibility'];q['journalSha256']=old['journalSha256'];q['currentJournal']=copy.deepcopy(old['currentJournal']);require(inverse==base and (json.dumps(inverse,indent=2)+'\n').encode()==raw,'COLLECTOR_CP_EXTRA_MUTATION')
    return dict(kind='B7_E35_CP_CONFIG_MECHANICAL_DRAFT_V1',actual_config_not_installed=True,original_config_sha256=sha(raw),only_two_hash_three_provenance_fields_changed=True,inverse_original_raw_bytes_exact=True,config_draft_sha256=sha((json.dumps(new,indent=2)+'\n').encode()),byteBindingPath_unchanged=True,historical_sources_and_attestations_unchanged=True,provenance_means_actual_readonly_observation_not_recovery_success=True,actual_recovery_return_sha256=None,actual_completed_full_readback_sha256=None,config_draft=new)

def collect():
    require(len(sys.argv)==1 and os.getuid()==0 and os.geteuid()==0,'COLLECTOR_FIXED_ROOT_NO_ARGS')
    require(not any(k.startswith('DS_') for k in os.environ),'COLLECTOR_OVERRIDE_ENVIRONMENT')
    m=load_helper();reader=Reader(m);utc=datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        records={};values={};base=STATE+'/receipts/'+OP
        for name,suffix in [('registration','.json'),('execution','.b7-execution.json'),('auth','.b7-execution.b7-recovery-auth.json'),('terminal','.b7-execution.b7-recovery-terminal.json'),('progress','.b7-execution.b7-recovery-progress.json')]:
            raw,pin=reader.file(base+suffix);records[name]=pin;values[name]=m.strict_json(raw)
        require(records['registration']['sha256']==m._REG_SHA and records['execution']['sha256']==m._EXEC_SHA and (records['registration']['uid'],records['registration']['gid'],records['registration']['mode'])==(0,80,0o644) and (records['execution']['uid'],records['execution']['gid'],records['execution']['mode'])==(0,80,0o600),'COLLECTOR_ORIGINAL_RECEIPTS')
        for name in ('auth','terminal','progress'):
            value=values[name];require(value.get('kind')=='DS_B7_RECOVERY_'+name.upper()+'_V1' and value.get('operation_id')==OP and value.get('tx_id')==TX,'COLLECTOR_RECOVERY_RECORD_SUBJECT')
            require((records[name]['uid'],records[name]['gid'],records[name]['mode'])==(0,80,0o600),'COLLECTOR_RECOVERY_RECORD_CUSTODY')
        auth_sha=records['auth']['sha256'];auth=values['auth'];terminal=values['terminal'];progress=values['progress']
        require(auth.get('helper_role')=='FIXED_E35_RECOVERY_NOT_ORIGINAL_CARRIER' and auth.get('original_receipt_sha256')==m._EXEC_SHA and terminal.get('authorization_sha256')==progress.get('authorization_sha256')==auth_sha and progress.get('phase')=='TERMINAL' and progress.get('terminal_output') is True,'COLLECTOR_RECOVERY_NOT_COMPLETED')
        helper_sha=auth.get('helper_source_sha256');require(terminal.get('helper_source_sha256')==progress.get('helper_source_sha256')==helper_sha==RECOVERY_HELPER_SHA,'COLLECTOR_RECOVERY_HELPER_MIXED')
        require(terminal.get('original_receipt_sha256_pre')==terminal.get('original_receipt_sha256_post')==m._EXEC_SHA and terminal.get('original_policy_sha256')==auth.get('original_policy_sha256')==values['execution']['execution_policy_sha256'],'COLLECTOR_RECOVERY_ORIGINAL_PROVENANCE')
        raw,client=reader.file(CLIENT);status_sha,status=original_status(reader,client,auth_sha)
        # No interpretation of visible records as prior durable success.
        objects=[];held=[]
        for i,(path,history) in enumerate(m.FIXED_MATERIALS):
            summary,p,fd=inventory(m,reader,path,'artifacts' if i==3 else 'codeinput' if i==4 else ('native','seed','falsefence')[i]);held.append((p,fd));objects.append(dict(path=path,history=str(Path(path).parent/history),**summary))
        native_raw=m._raw_fd(held[0][1],4*1024*1024);native=m.strict_json(native_raw);fence_raw=m._raw_fd(held[2][1],65536);fence=m.strict_json(fence_raw)
        require(native.get('txId')==TX and native.get('state')=='ABORTED' and native.get('activation',{}).get('restored') is True,'COLLECTOR_NATIVE_NOT_ABORTED')
        fence_meta=os.fstat(held[2][1]);require(fence.get('txId')==TX and fence.get('inFlight') is False and set(fence)=={'txId','inFlight','at'} and (fence_meta.st_uid,fence_meta.st_gid,stat.S_IMODE(fence_meta.st_mode),fence_meta.st_nlink)==(505,601,0o600,1),'COLLECTOR_FENCE_NOT_FALSE')
        require(terminal.get('terminal',{}).get('transaction_sha256')==sha(native_raw) and terminal['terminal'].get('native_state')=='ABORTED' and terminal['terminal'].get('installed') is False,'COLLECTOR_NATIVE_TERMINAL_JOIN')
        _,journal=reader.file(MIGRATION+'/.b7-six-journal.jsonl');require(journal['sha256']==JOURNAL,'COLLECTOR_JOURNAL_CHANGED');journal_utc=datetime.datetime.now(datetime.timezone.utc).isoformat()
        _,node=reader.file(m._NODE,1048576);require((node['uid'],node['gid'],node['mode'])==(0,0,0o755),'COLLECTOR_INSTALLED_NODE')
        public={}
        for key,path in [('config','/Users/authsvc/.agent-core/agent-model-overrides.json'),('registry','/usr/local/libexec/agent-core/config/agents.json'),('plist',m._RUNTIME_PLIST)]:_,public[key]=reader.file(path)
        alias_path=reader.path('/Users/authsvc/.agent-core/agents.json');s=os.stat(alias_path.name,dir_fd=alias_path.parent,follow_symlinks=False)
        require(stat.S_ISLNK(s.st_mode) and s.st_nlink==1,'COLLECTOR_ALIAS_TYPE');public['alias']=dict(target=os.readlink(alias_path.name,dir_fd=alias_path.parent),uid=s.st_uid,gid=s.st_gid,mode=stat.S_IMODE(s.st_mode),dev=s.st_dev,inode=s.st_ino,bytes=s.st_size)
        scene=m.FixedE35Scene.__new__(m.FixedE35Scene);scene.pins=dict(public_bindings=public);scene.guard=reader.guard;scene.path=reader.path;scene.absent_fixed=lambda path:absent_fixed(reader,path)
        scene.native_bytes=lambda:native;scene.checkpoint_module=types.SimpleNamespace(read_file=reader.runtime_file)
        runtime_sha=scene.observe_runtime() # Same actual pure-read method; not run/retire.
        _,checkpoint=reader.file(CHECKPOINT);require(checkpoint['sha256']==m._CHECKPOINT_SHA,'COLLECTOR_CHECKPOINT_SOURCE')
        for p,fd in held:m.same_entry(fd,p.parent,p.name)
        reader.guard()
        cfg=config_draft(reader,journal,journal_utc)
        summary=dict(kind='B7_E35_ACTUAL_BINDING_READONLY_SUMMARY_V1',complete=True,utc=utc,journal_observed_utc=journal_utc,operation_id=OP,tx_id=TX,accepted_proposal_sha256=PROPOSAL,collector_sha256=sha(Path(__file__).read_bytes()),retirement_helper_source_sha256=HELPER_SHA,recovery_helper_sha256=helper_sha,original_records={k:records[k] for k in ('registration','execution')},recovery_records={k:records[k] for k in ('auth','terminal','progress')},status_sha256=status_sha,status_projection=status,native_sha256=sha(native_raw),false_fence_sha256=sha(fence_raw),objects=objects,installed_client=client,installed_node=node,journal=journal,public_bindings=public,runtime_sha256=runtime_sha,checkpoint_source=checkpoint,actual_recovery_return_sha256=None,actual_completed_full_readback_sha256=None,completed_recovery_proof=dict(actual_result_sha256=None,full_readback_sha256=None,durability_completed=None),recovery_proof_sha256=None,checkpoint_sha256=None,checkpoint_config_draft=cfg,limits=['Read-only unlocked observations, not global atomic snapshot or durability proof.','No lease, fsync, helper.run/retire/recovery, provider/store/B1/finish, source execution or production writes.','Partial FixedE35Scene.observe_runtime is a real readonly value derivation; final actual FixedE35Scene must independently reverify all guards and completed proof under its original DS lease.','STATUS subprocess truly UID502/GID20; no caller identity fabrication.','Auth/base64/file contents never emitted; inventories contain metadata/relative paths/file SHA only.','Summary valid only when whole stream received and process rc0; external actual recovery return/full readback must be bound separately.'])
        emit(summary)
    finally:reader.close()

def absent_fixed(reader,path):
    try:p=reader.path(path)
    except FileNotFoundError:return
    require(not reader.m.exists_at(p.parent,p.name),'COLLECTOR_PUBLIC_NAME_PRESENT')

if __name__=='__main__':
    try:collect()
    except Exception as exc:
        # Never expose raw subprocess text, exception payload, auth or file body.
        sys.stderr.write('FIXED_E35_COLLECTOR_REFUSED\n');raise SystemExit(2)
