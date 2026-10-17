#!/usr/bin/env python3
"""Original peer502 submits only accepted fixed e35 recovery as DELEGATED_EXECUTOR.

No human terminal/signature, Owner INPUT/EOF, fresh EXECUTE/RESUME, Feishu send,
credential provider or mutation retry. Root invokes only this sealed driven byte.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import types

sys.dont_write_bytecode=True
OP='b7-packet-r34-1cfeff2a5b138629-e35'
TX='tx-c0fd42f71e074eeb8f0e9902e1a3e084'
AMENDMENT='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'
DELEGATION='06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57'
EXEC_SHA='1d6742519840e0a2a98409b28725eed69f3e2123d27a7382e88029944aea1895'
HERE=Path(__file__).resolve().parent
SERVER='/usr/local/libexec/agent-deploy-system/deployment_system.py'
CLIENT='/usr/local/libexec/agent-deploy-system/ds_client.py'
ROLE='DELEGATED_EXECUTOR'


def need(ok,reason):
    if not ok:raise RuntimeError('E35_DELEGATED_'+reason)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def custody(s):return (s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode)
def stable(s):return custody(s)+(s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)


def root_file(path,mode,limit,retain=True):
    """Read verified buffers, then compile that buffer; never reopen user code."""
    path=Path(path);need(path.is_absolute() and str(path)==os.path.normpath(path),'FIXED_PATH')
    opened=[];trace=[]
    try:
        parent=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);opened.append(parent)
        root_pin=custody(os.fstat(parent))
        for part in path.parts[1:-1]:
            s=os.stat(part,dir_fd=parent,follow_symlinks=False)
            need(stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022,'ROOT_PARENT_CUSTODY')
            fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);opened.append(fd)
            need(custody(s)==custody(os.fstat(fd)),'ROOT_PARENT_CHANGED');trace.append((parent,part,fd,custody(s)));parent=fd
        s=os.stat(path.name,dir_fd=parent,follow_symlinks=False)
        need(stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==mode and 0<s.st_size<=limit,'ROOT_FILE_CUSTODY')
        fd=os.open(path.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent);opened.append(fd)
        need(stable(s)==stable(os.fstat(fd)),'ROOT_FILE_OPEN_CHANGED')
        h=hashlib.sha256();chunks=[];total=0
        while True:
            b=os.read(fd,1048576)
            if not b:break
            total+=len(b);need(total<=limit,'ROOT_FILE_BOUND');h.update(b)
            if retain:chunks.append(b)
        need(total==s.st_size and stable(s)==stable(os.fstat(fd))==stable(os.stat(path.name,dir_fd=parent,follow_symlinks=False)),'ROOT_FILE_READ_CHANGED')
        need(custody(os.fstat(opened[0]))==root_pin,'ROOT_PARENT_CHANGED')
        for p,n,f,pin in trace:need(custody(os.fstat(f))==custody(os.stat(n,dir_fd=p,follow_symlinks=False))==pin,'ROOT_PARENT_CHANGED')
        return h.hexdigest(),b''.join(chunks) if retain else None
    finally:
        for fd in reversed(opened):os.close(fd)


def valid_status(value):
    need(type(value)is dict and value.get('schema')=='ds-b7-execution-v2' and value.get('ok')is True and value.get('action')=='DS_B7_EXECUTION_STATUS_V2' and value.get('operation_id')==OP and value.get('effect')=='READ_ONLY' and value.get('replay_allowed')is False and value.get('current_runtime_verified')is False and value.get('error')is None,'ORIGINAL_STATUS')
    d=value.get('data');need(type(d)is dict and d.get('phase')=='RETAINED' and d.get('tx_id')==TX and d.get('active')is False and d.get('attempt')==1 and d.get('input_sequence')==0 and d.get('input_pending')is False and d.get('replay_allowed')is False and d.get('loaded_business_proof')is False,'ORIGINAL_STATUS_SUBJECT')
    return d


def terminal(d):
    ov=d.get('recovery_terminal')
    if ov is None:return False
    need(type(ov)is dict and set(ov)=={'native_state','installed','authorization_sha256','original_receipt_sha256'} and ov.get('native_state')=='ABORTED' and ov.get('installed')is False and ov.get('original_receipt_sha256')==EXEC_SHA and re.fullmatch('[0-9a-f]{64}',str(ov.get('authorization_sha256'))),'ORIGINAL_RECOVERY_OVERLAY')
    return True


def perform(client):
    before=client.request(dict(action='DS_B7_EXECUTION_STATUS_V2',operation_id=OP));d=valid_status(before)
    if terminal(d):return dict(actor=ROLE,operation_id=OP,transaction_id=TX,submitted=False,status=before,business_release=False)
    need(d.get('execution_enabled')is True and d.get('reason')=='EXECUTION_INTENT' and d.get('next_action')=='EXPLICIT_SAME_TX_RESUME_OR_NATIVE_DISPOSAL_REVIEW','RECOVERY_ADMISSION_STATUS')
    # One mutation request only. Always attempt the original read-only STATUS,
    # including after an ambiguous response; it never authorizes a resend or
    # turns the ambiguous call into a claimed successful mutation.
    result=None;request_error=None;after=None;status_error=None;observed_terminal=False
    try:result=client.request(dict(action='B7_PACKET_RECOVERY_ABORT_V2',operation_id=OP))
    except Exception as error:request_error=type(error).__name__
    try:
        after=client.request(dict(action='DS_B7_EXECUTION_STATUS_V2',operation_id=OP))
        observed_terminal=terminal(valid_status(after))
    except Exception as error:status_error=type(error).__name__
    accepted=type(result)is dict and result.get('ok')is True and result.get('operation_id')==OP and result.get('action')=='B7_PACKET_RECOVERY_ABORT_V2' and result.get('replay_allowed')is False
    if request_error or status_error or not accepted or not observed_terminal:
        return dict(actor=ROLE,operation_id=OP,transaction_id=TX,submitted=True,result='REFUSED_OR_UNKNOWN',recovery_response=result,request_error=request_error,status=after,status_error=status_error,observed_terminal=observed_terminal,replay_allowed=False,business_release=False)
    return dict(actor=ROLE,operation_id=OP,transaction_id=TX,submitted=True,status=after,business_release=False)


def main():
    need(len(sys.argv)==1 and os.getuid()==os.geteuid()==502,'FIXED_ORIGINAL_PEER_ONLY')
    need(not any(k.startswith('DS_') for k in os.environ),'OVERRIDE_ENVIRONMENT_FORBIDDEN')
    need(str(HERE.parent)=='/private/var/db/agent-deploy-system-driven' and re.fullmatch(r'inv-[A-Za-z0-9]+',HERE.name),'SEALED_DRIVEN_ENTRY_ONLY')
    _,auth_raw=root_file(HERE/'b7-v3-publication-authority.json',0o444,16384)
    authority=json.loads(auth_raw)
    need(authority.get('kind')=='DS_B7_V3_PAIR_PUBLICATION_AUTH_V1' and authority.get('e35_accepted_proposal_sha256')==AMENDMENT and authority.get('delegationClauseSha256')==DELEGATION and OP in authority.get('inScopeOperations',[]),'ACCEPTED_DELEGATED_SCOPE')
    own_sha,_=root_file(HERE/'e35_delegated_recovery.py',0o555,1048576,False)
    need(authority.get('drivenScripts',{}).get('e35_delegated_recovery.py')==own_sha,'SEALED_DELEGATED_SOURCE')
    _,facts_raw=root_file(HERE/'candidate-facts.json',0o444,65536);facts=json.loads(facts_raw)
    server_sha,_=root_file(SERVER,0o555,512*1024*1024,False)
    client_sha,client_raw=root_file(CLIENT,0o555,1048576)
    need((server_sha,client_sha)==(facts.get('SERVER'),facts.get('CLIENT')) and authority.get('artifacts')=={'deployment_system.py':server_sha,'ds_client.py':client_sha},'ACTUAL_LOADED_PAIR_BYTES')
    client=types.ModuleType('_installed_e35_recovery_client');client.__file__=CLIENT
    sys.modules[client.__name__]=client
    exec(compile(client_raw,CLIENT,'exec'),client.__dict__)
    value=perform(client)
    print(json.dumps(value,sort_keys=True))
    return 2 if value.get('result')=='REFUSED_OR_UNKNOWN' else 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps(dict(actor=ROLE,operation_id=OP,transaction_id=TX,result='REFUSED_OR_UNKNOWN',error=type(error).__name__,reason=str(error),replay_allowed=False,business_release=False),sort_keys=True))
        raise SystemExit(2)
