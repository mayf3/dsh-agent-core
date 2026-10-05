"""Nonprivileged observer of the existing DS per-ID receipt publication.

No socket request, retry, lock mutation or privileged code. UNKNOWN means
unreconciled, never no effect. A COMPLETE receipt is not current app health.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

ROOT=Path('/private/var/db/agent-deploy-system/receipts')
UNITS=frozenset(('scheduler-whole-main','self-ops','workflow'))
ID=re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}')
CAP=65536

class Unknown(Exception):pass

def need(ok,reason):
    if not ok:raise Unknown(reason)

def identity(m):
    return (m.st_dev,m.st_ino,m.st_uid,m.st_gid,m.st_mode,m.st_nlink,m.st_size,m.st_mtime_ns,m.st_ctime_ns)

def unique(pairs):
    result={}
    for key,value in pairs:
        need(key not in result,'DUPLICATE_FIELD');result[key]=value
    return result

def _observe(root,operation_id,unit,uid,*,fixture=False):
    opened=[];trace=[];leaf=None
    try:
        need(type(operation_id) is str and ID.fullmatch(operation_id) and operation_id not in ('.','..'),'INVALID_OPERATION_ID')
        need(unit in UNITS,'UNREGISTERED_UNIT')
        if fixture:
            parent=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);opened.append(parent)
            m=os.fstat(parent);need(m.st_uid==uid and not m.st_mode&0o022,'PARENT_CUSTODY')
        else:
            need(root==ROOT and uid==0,'FIXED_ROOT_REQUIRED')
            parent=os.open('/',os.O_RDONLY|os.O_DIRECTORY);opened.append(parent)
            root_meta=os.fstat(parent)
            need(root_meta.st_uid==0 and not root_meta.st_mode&0o022,'ROOT_CUSTODY')
            current=''
            for part in ROOT.parts[1:]:
                current+='/'+part
                before=os.stat(part,dir_fd=parent,follow_symlinks=False)
                need(stat.S_ISDIR(before.st_mode) and before.st_uid==0,'PARENT_CUSTODY')
                if current=='/private/var/db/agent-deploy-system':
                    need(before.st_gid==80 and stat.S_IMODE(before.st_mode)==0o770,'DS_PARENT_CUSTODY')
                else:need(not before.st_mode&0o022,'PARENT_WRITABLE')
                fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);opened.append(fd)
                need(identity(before)==identity(os.fstat(fd)),'PARENT_CHANGED')
                trace.append((parent,part,fd,identity(before)));parent=fd
        name=operation_id+'.json'
        before=os.stat(name,dir_fd=parent,follow_symlinks=False)
        need(stat.S_ISREG(before.st_mode) and before.st_uid==uid and before.st_nlink==1
             and stat.S_IMODE(before.st_mode)==0o644 and 0<before.st_size<=CAP,'RECEIPT_CUSTODY')
        leaf=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parent)
        need(identity(before)==identity(os.fstat(leaf)),'RECEIPT_CHANGED')
        raw=b''
        while len(raw)<=CAP:
            block=os.read(leaf,min(65536,CAP+1-len(raw)))
            if not block:break
            raw+=block
        need(len(raw)==before.st_size and len(raw)<=CAP,'RECEIPT_SIZE_CHANGED')
        need(identity(before)==identity(os.fstat(leaf))==identity(os.stat(name,dir_fd=parent,follow_symlinks=False)),'RECEIPT_CHANGED')
        for ancestor,part,fd,pin in trace:
            need(pin==identity(os.fstat(fd))==identity(os.stat(part,dir_fd=ancestor,follow_symlinks=False)),'PARENT_CHANGED')
        value=json.loads(raw,object_pairs_hook=unique)
        need(type(value) is dict and value.get('operation_id')==operation_id and value.get('unit')==unit,'RECEIPT_BINDING')
        action=value.get('action')
        if action is None:
            # Installed DEPLOY v1 omits action; recognize its exact terminal shape.
            stages=value.get('stages')
            need(value.get('version')==1 and type(stages) is list and stages
                 and all(type(x) is dict and type(x.get('stage')) is str for x in stages), 'RECEIPT_ACTION')
            need(stages[0]['stage']=='PREPARE', 'RECEIPT_ACTION')
            if value.get('state')=='COMPLETE':
                need(stages[-1]['stage']=='READBACK_VERIFIED' and type(value.get('generation')) is dict
                     and type(value.get('deployed_artifact_sha')) is str
                     and re.fullmatch('[a-f0-9]{64}',value['deployed_artifact_sha']), 'RECEIPT_ACTION')
            action='DEPLOY'
        need(action in ('DEPLOY','ROLLBACK'),'RECEIPT_ACTION')
        need(value.get('state') in ('COMPLETE','FAILED'),'NONTERMINAL_OR_UNKNOWN')
        generation=value.get('registry_generation')
        need(type(generation) is str and re.fullmatch('[a-f0-9]{64}',generation),'REGISTRY_BINDING')
        return {'observation':'MATCH','operation_id':operation_id,'unit':unit,'action':action,
                'state':value['state'],'registry_generation':generation,'receiptSha256':hashlib.sha256(raw).hexdigest(),
                'replayAllowed':False,'currentRuntimeVerified':False}
    except (OSError,ValueError,Unknown) as exc:
        reason=str(exc) if isinstance(exc,Unknown) else type(exc).__name__
        return {'observation':'UNKNOWN','reason':reason,'replayAllowed':False,'currentRuntimeVerified':False}
    finally:
        if leaf is not None:os.close(leaf)
        for fd in reversed(opened):os.close(fd)

def observe(operation_id,unit):
    return _observe(ROOT,operation_id,unit,0)

if __name__=='__main__':
    if len(sys.argv)!=3:raise SystemExit('usage: receipt.py OPERATION_ID REGISTERED_UNIT')
    result=observe(sys.argv[1],sys.argv[2]);print(json.dumps(result,sort_keys=True))
    raise SystemExit(0 if result['observation']=='MATCH' else 2)
