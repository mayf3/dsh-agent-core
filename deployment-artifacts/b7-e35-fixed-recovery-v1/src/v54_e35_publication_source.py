"""Fixed e35 qualification for the unchanged original P0 reader-pair guard.

Read-only. The existing original DS lease/consumed job/pair DS_UPDATE owns all
publication effects. This module accepts no caller-supplied scene or path.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess

OP='b7-packet-r34-1cfeff2a5b138629-e35'
TX='tx-c0fd42f71e074eeb8f0e9902e1a3e084'
AMENDMENT='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'
DELEGATION='06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57'
DOMAIN='private/var/db/agent-core/authsvc-codex-migration'
P0_OP='p0-runtime-role-20260927-8ab18f71-445f-4402-993c-8d498e37f52b'
STAGE=DOMAIN+'/composite-'+P0_OP
ABSENT=[STAGE,STAGE+'/journal',STAGE+'/journal/transaction.json',DOMAIN+'/lock',DOMAIN+'/migration-fence.json',DOMAIN+'/migration-transaction.json']
PAIR={'deployment_system.py','ds_client.py'}
PREIMAGE={'deployment_system.py':'f93609e70db39ef87ca6013c6ccb944b11a568a772848b65f84d3c095b7224de','ds_client.py':'9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67'}
NATIVE_SHA='03496ae42466aa9480c8fdbe36a4da6b549d47b533257016aee961ee75d21dde'
FENCE_SHA='c4299625e681bced76c195edeef938792cf202db5f05aadfa1b0c06613592443'
REG_SHA='5bbacce050401210ea3390e9b5b00dbae8e96c9ff4342875f4c66cd5e3cb38df'
EXEC_SHA='1d6742519840e0a2a98409b28725eed69f3e2123d27a7382e88029944aea1895'
HOLDER_SHA='dd25cd54a5911ea6d98dc5844f81473995ab41ba17b4dd9d04273bd00499818a'
NONCE='927b57ed689ae8cdeb480a23354f48cb'
COHORT='4e3e238882f804eef63cb8b119989b1f0660f1e68c184a796f02a6c16532f14c'
SCENE_FILES={
 'b7-six-target-batch.json':'a7c6dd52c680a2fe45780cf7e50bdf950fb68901f174a108e7aa589574744687',
 '.b7-six-journal.jsonl':'81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf',
 'b7-preparation-input.json':'71b06fa431ed987bfe423ae3a5d2c3078c458fc640ca2027a46eaf5da31a0d73',
 'b7-preparation-'+TX+'.json':'ce960bbe3cd73ec26244d2ec2e58f1a1218bac592f26e63cb16590e8f6892d96',
 'b7-accepted-'+TX+'.json':'b98413fec119e5b5a6acf2df5ab466f6431eb96b547799a81ce487ab1191ba78'}
FENCE_PATH='/'+DOMAIN+'/migration-fence.json'
FENCE_INODE=(16777233,208619812)


def digest(raw):return hashlib.sha256(raw).hexdigest()
def need(ok,reason):
    if not ok:raise RuntimeError('E35_PUBLICATION_'+reason)
def hash_pair(value):
    return type(value)is dict and set(value)==PAIR and all(type(v)is str and re.fullmatch(r'[0-9a-f]{64}',v) for v in value.values())
def identity(s):return (s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)


def fixed_fence():
    """Original generic observer honestly says UNSAFE_CUSTODY for UID505.

    This finite fixed-subject reader validates that exact accepted service-owned
    fence separately; it does not change any original observer/owner rule.
    """
    fds=[];trace=[]
    try:
        parent=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);fds.append(parent)
        root=identity(os.fstat(parent))
        for part in Path(FENCE_PATH).parts[1:-1]:
            before=os.stat(part,dir_fd=parent,follow_symlinks=False)
            need(stat.S_ISDIR(before.st_mode) and before.st_uid==0 and not before.st_mode&0o022,'FENCE_PARENT_CUSTODY')
            fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);fds.append(fd)
            need(identity(before)==identity(os.fstat(fd)),'FENCE_PARENT_CHANGED')
            trace.append((parent,part,fd,identity(before)));parent=fd
        name=Path(FENCE_PATH).name;s=os.stat(name,dir_fd=parent,follow_symlinks=False)
        need(stat.S_ISREG(s.st_mode) and (s.st_dev,s.st_ino)==FENCE_INODE and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(505,601,0o600,1) and 0<s.st_size<=4096,'FENCE_CUSTODY')
        fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent);fds.append(fd)
        need(identity(s)==identity(os.fstat(fd)),'FENCE_OPEN_CHANGED')
        raw=os.pread(fd,4097,0)
        need(len(raw)==s.st_size and digest(raw)==FENCE_SHA,'FENCE_BYTES_CHANGED')
        value=json.loads(raw);need(value.get('txId')==TX and value.get('inFlight')is True,'FENCE_SUBJECT')
        need(identity(s)==identity(os.fstat(fd))==identity(os.stat(name,dir_fd=parent,follow_symlinks=False)),'FENCE_READ_CHANGED')
        need(identity(os.fstat(fds[0]))==root,'FENCE_ROOT_CHANGED')
        for p,n,f,pin in trace:need(identity(os.fstat(f))==identity(os.stat(n,dir_fd=p,follow_symlinks=False))==pin,'FENCE_PARENT_CHANGED')
        return raw
    finally:
        for fd in reversed(fds):os.close(fd)


def settings_bound(diagnosis,settings):
    need(settings.get('DOMAIN')==DOMAIN and settings.get('STAGE')==STAGE and settings.get('ABSENT')==ABSENT,'SETTINGS_PATHS_CHANGED')
    need(type(diagnosis)is dict and diagnosis.get('schema')=='P0_FIXED_SETTINGS_DIAGNOSIS_V1' and diagnosis.get('operationId')==P0_OP,'SETTINGS_SCHEMA')
    facts=diagnosis.get('maintenanceFacts',{})
    need(all(facts.get(k)is True for k in ('settingsMetadataComplete','stable','ownedFailedJob','jobBundlePins')) and facts.get('workerState')=='ENDED' and facts.get('stageAndTransactionAbsent')is False and diagnosis.get('changedDuringRead')==[] and diagnosis.get('maintenancePreconditionsObserved')is False,'OTHER_MAINTENANCE_PREDICATE')
    entries=diagnosis.get('currentTransactionRows')
    need(type(entries)is list and all(type(r)is dict and type(r.get('path'))is str for r in entries),'PATH_ROWS')
    rows={r['path']:r for r in entries};need(len(rows)==len(entries),'DUPLICATE_PATH_ROWS')
    need(all(rows.get('/'+p,{}).get('status')=='ENOENT' for p in ABSENT[:-2]),'OTHER_PATH_PRESENT_OR_UNKNOWN')
    native=rows.get('/'+ABSENT[-1],{});fence=rows.get('/'+ABSENT[-2],{})
    need(native.get('status')=='PRESENT' and native.get('sha256')==NATIVE_SHA,'TX_OBSERVER_NOT_BOUND')
    need(fence.get('status')=='UNSAFE_CUSTODY' and 'sha256' not in fence,'ORIGINAL_FENCE_OBSERVER_CHANGED')


def readonly_quiescent(engine,holder):
    # Same original fixed metadata-only ps/lsof admission: no PID timeout,
    # forced lock takeover or inference from a new host's empty active map.
    r=subprocess.run(['/bin/ps','-axo','pid=,ppid=,command='],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LC_ALL':'C'},cwd='/',timeout=10,check=False)
    need(r.returncode==0 and len(r.stdout)<=1048576 and len(r.stderr)<=65536,'PROCESS_OBSERVATION')
    targets=[holder['binding'][k] for k in ('outerPath','carrierPath')]
    for line in r.stdout.decode('utf8','strict').splitlines():
        fields=line.strip().split(None,2);need(len(fields)==3 and fields[0].isdigit() and fields[1].isdigit(),'PROCESS_OBSERVATION')
        if int(fields[0])!=os.getpid():need(not any(p in fields[2] for p in targets) and TX not in fields[2],'WRITER_PROCESS_ACTIVE')
    paths=['/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock/holder',str(Path(engine.ds.STATE_ROOT)/'mutation.lock')]
    r=subprocess.run(['/usr/sbin/lsof','-nP','-Fpf','--']+paths,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'},cwd='/',timeout=10,check=False)
    need(r.returncode in (0,1) and not r.stderr and len(r.stdout)<=65536,'OPEN_FD_OBSERVATION')
    if r.returncode==1 and not r.stdout:return
    need(bool(r.stdout),'OPEN_FD_OBSERVATION');owner=None
    for line in r.stdout.decode('ascii','strict').splitlines():
        need(len(line)>1 and line[0] in ('p','f'),'OPEN_FD_OBSERVATION')
        if line[0]=='p':need(line[1:].isdigit(),'OPEN_FD_OBSERVATION');owner=int(line[1:]);need(owner==os.getpid(),'WRITER_FD_ACTIVE')
        else:need(owner is not None and line[1:].rstrip('rwu').isdigit(),'OPEN_FD_OBSERVATION')


def qualify(engine,request,diagnosis,settings,receipt_exists,install_dir,read_verified):
    """Exactly original P0 shape/custody/lease recheck and DS_UPDATE body.

    The original guard owns its unchanged DS mutation FD, consumed P0 reader job
    and ancestor/receipt checks. No stage, lock, metadata or record is written here.
    """
    need(type(request)is dict and set(request)=={'action','operation_id','artifacts'} and request.get('action')=='DS_UPDATE' and type(request.get('operation_id'))is str and re.fullmatch(r'ds-reader-pair-[a-z0-9]{12}',request['operation_id']) and hash_pair(request.get('artifacts')),'REQUEST_SHAPE')
    root=Path(engine.ds.STATE_ROOT)
    def observe(prior):
        pin_raw,pin=engine.base.read_json(str(root/'b7-v3-publication-pin.json'),0o400,4096)
        auth_raw,auth=engine.base.read_json(str(root/'b7-v3-publication-authority.json'),0o400,16384)
        need(type(pin)is dict and set(pin)=={'kind','authorization_sha256'} and pin.get('kind')=='DS_B7_V3_PAIR_PUBLICATION_PIN_V1' and digest(auth_raw)==pin.get('authorization_sha256'),'INDEPENDENT_DIGEST')
        need(type(auth)is dict and auth.get('kind')=='DS_B7_V3_PAIR_PUBLICATION_AUTH_V1' and auth.get('e35_accepted_proposal_sha256')==AMENDMENT and auth.get('delegationClauseSha256')==DELEGATION,'AUTHORITY_SUBJECT')
        need(auth.get('publication_operation_id')==request['operation_id'] and hash_pair(auth.get('artifacts')) and auth['artifacts']==request['artifacts'] and auth.get('preimage_artifacts')==PREIMAGE and auth.get('next_b7_operation')==OP and OP in auth.get('inScopeOperations',[]),'PUBLICATION_BINDING')
        need(engine.active is None,'WRITER_ACTIVE')
        reg_raw=engine.safe_bytes(engine.ds.receipt_path(OP),1048576,REG_SHA)
        _,reg=engine.base.registration(OP);name=reg['binding']['packetId'];need(name=='b7-native-execution-r34-c71fd2cc' and name in engine.policy['packets'],'REGISTERED_PACKET')
        policy=engine.policy['packets'][name]
        need(policy.get('enabled')is True and reg['binding']['manifestSha256']==policy['manifestSha256'],'REGISTERED_MANIFEST')
        raw,_=engine.base.read_json(engine.path(OP),0o600);state=engine.load(OP,reg)
        need(digest(raw)==EXEC_SHA and state is not None and state['phase']=='RETAINED' and state['tx_id']==TX and state['attempt']==1 and state['input_sequence']==0 and state['input_pending']is None and state['terminal_output']is False,'ORIGINAL_RECEIPT_CHANGED')
        need(digest(engine.ds.canonical(engine.policy))==engine.policy_sha==state['execution_policy_sha256'],'WHOLE_POLICY_CHANGED')
        engine.verify_snapshot(policy)
        tx_raw,tx=engine.base.read_json(policy['nativeTransactionPath'],0o600,4*1024*1024);engine.native_binding(tx,policy)
        holder_raw,holder=engine.base.read_json(str(Path(policy['nativeLockPath'])/'holder'),0o600)
        need(tx.get('txId')==TX and tx.get('state')=='ABORT_INCOMPLETE' and tx.get('outer')==holder and holder.get('phase')=='SEALED' and holder.get('nonce')==NONCE and holder.get('binding',{}).get('cohortSha256')==COHORT and digest(tx_raw)==NATIVE_SHA and digest(holder_raw)==HOLDER_SHA,'NATIVE_PREIMAGE_CHANGED')
        need(os.path.realpath(policy['nativeTransactionPath'])=='/'+ABSENT[-1],'NATIVE_PATH_CHANGED')
        engine.safe_bytes(policy['resumeOuterPath'],1048576,policy['resumeOuterSha256'])
        readonly_quiescent(engine,holder)
        fence_raw=fixed_fence();settings_bound(prior,settings)
        extra=tuple(engine.safe_bytes('/'+DOMAIN+'/'+name,32*1024*1024,pin) for name,pin in SCENE_FILES.items())
        return (pin_raw,auth_raw,reg_raw,raw,tx_raw,holder_raw,fence_raw,extra,engine.ds.canonical(engine.policy),engine.ds.canonical(reg)),auth
    frozen,auth=observe(diagnosis)
    operation=request['operation_id']
    need(not receipt_exists(operation) and not os.path.lexists(root/'ds-generations'/operation) and not os.path.lexists(root/'inbox'/operation),'ALREADY_CONSUMED_STAGED_OR_UNKNOWN')
    for name,sha in PREIMAGE.items():
        path=os.path.join(install_dir,name);s=os.lstat(path)
        need(stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o555,'PAIR_PREIMAGE_CUSTODY')
        need(read_verified(path)[1]==sha,'PAIR_PREIMAGE_CHANGED')
    def recheck(prior):
        current,_=observe(prior);need(current==frozen,'PROTECTED_REFERENCE_CHANGED')
    return recheck

if __name__=='__main__':raise SystemExit('E35_ORIGINAL_P0_GUARD_ONLY')
