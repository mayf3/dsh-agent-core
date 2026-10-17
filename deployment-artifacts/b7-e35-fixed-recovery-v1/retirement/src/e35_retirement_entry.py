"""Original protected prepare mutation-lease pattern, fixed E35 retirement only.
No input placement, e31 loader, DS publication, recovery invocation or public CLI.
"""
import fcntl,hashlib,json,os,re,stat,sys,types
from pathlib import Path
sys.dont_write_bytecode=True
WB=Path(__file__).resolve().parent
MUTEX='/private/var/db/agent-deploy-system/mutation.lock'
OPERATION='b7-packet-r34-1cfeff2a5b138629-e35'
TRANSACTION='tx-c0fd42f71e074eeb8f0e9902e1a3e084'
PROPOSAL='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'
ENTRY_CONFIG_SHA=None
def need(value, reason):
    if not value:
        raise RuntimeError(reason)

def open_directory(path):
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in Path(path).parts[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd); fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise

def pin(meta):
    return (meta.st_dev, meta.st_ino, meta.st_mode, meta.st_uid, meta.st_gid,
            meta.st_nlink, meta.st_size, meta.st_mtime_ns, meta.st_ctime_ns)

def same_entry(fd, parent, name):
    need(pin(os.fstat(fd)) == pin(os.stat(name, dir_fd=parent, follow_symlinks=False)),
         'HELD_ENTRY_CHANGED')

def held_bytes(name,digest):
    need(type(digest) is str and re.fullmatch('[a-f0-9]{64}',digest),'E35_FINAL_BINDING_REQUIRED')
    need(name in ('e35-retirement-entry.json','e35_terminal_materials_once.py','e35-terminal-material-pins.json'), 'E35_FIXED_LEAF_REQUIRED')
    parent=open_directory(WB)
    try:
        meta=os.fstat(parent)
        need(meta.st_uid==0 and not meta.st_mode&0o022,'INVOCATION_CUSTODY')
        fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
        try:
            before=os.fstat(fd)
            need(stat.S_ISREG(before.st_mode) and (before.st_uid,before.st_gid,before.st_nlink)==(0,0,1) and not before.st_mode&0o022 and 0<before.st_size<=1024*1024,'FIXED_TERMINAL_HELPER_CUSTODY')
            if name.endswith('.json'):need(stat.S_IMODE(before.st_mode)==0o444 and before.st_size<=16384,'FIXED_ENTRY_CONFIG_CUSTODY')
            chunks=[];offset=0
            while offset<before.st_size:
                block=os.pread(fd,min(65536,before.st_size-offset),offset);need(bool(block),'FIXED_TERMINAL_HELPER_SHORT_READ');chunks.append(block);offset+=len(block)
            raw=b''.join(chunks)
            need(pin(before)==pin(os.fstat(fd)),'FIXED_TERMINAL_HELPER_CHANGED');same_entry(fd,parent,name)
            need(hashlib.sha256(raw).hexdigest()==digest,'FIXED_TERMINAL_HELPER_SHA')
            return raw
        finally:os.close(fd)
    finally:os.close(parent)

def read_entry_config():
    raw=held_bytes('e35-retirement-entry.json',ENTRY_CONFIG_SHA)
    def pairs(items):
        value={}
        for key,item in items:need(key not in value,'FIXED_ENTRY_CONFIG_DUPLICATE');value[key]=item
        return value
    config=json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda v:need(False,'FIXED_ENTRY_CONFIG_NONFINITE'))
    need(type(config) is dict and set(config)=={'kind','fixed_terminal_retirement','operation_id','tx_id','accepted_proposal_sha256','helper_sha256','helper_pins_sha256','checkpoint_sha256'},'FIXED_ENTRY_CONFIG_SCHEMA')
    need(config['kind']=='B7_E35_FIXED_RETIREMENT_ENTRY_V1' and config['fixed_terminal_retirement']=='e35-aborted-c0fd42f7' and config['operation_id']==OPERATION and config['tx_id']==TRANSACTION and config['accepted_proposal_sha256']==PROPOSAL,'FIXED_TERMINAL_SUBJECT_REQUIRED')
    for key in ('helper_sha256','helper_pins_sha256','checkpoint_sha256'):need(type(config[key]) is str and re.fullmatch('[a-f0-9]{64}',config[key]),'E35_FINAL_BINDING_REQUIRED')
    return config

def load_fixed_helper(config):
    name='e35_terminal_materials_once.py';raw=held_bytes(name,config['helper_sha256'])
    module=types.ModuleType('b7_fixed_e35_terminal_retirement');module.__file__=str(WB/name)
    exec(compile(raw,module.__file__,'exec'),module.__dict__)
    need((getattr(module,'OPERATION',None),getattr(module,'TRANSACTION',None),getattr(module,'PLAN_SHA256',None),getattr(module,'_PINS_SHA',None))==(OPERATION,TRANSACTION,PROPOSAL,config['helper_pins_sha256']) and callable(getattr(module,'run',None)),'FIXED_TERMINAL_ENTRY_REQUIRED')
    pins=module.strict_json(held_bytes('e35-terminal-material-pins.json',config['helper_pins_sha256']))
    need(type(pins) is dict and pins.get('operation_id')==OPERATION and pins.get('tx_id')==TRANSACTION and pins.get('accepted_proposal_sha256')==PROPOSAL and pins.get('checkpoint_sha256')==config['checkpoint_sha256'],'FIXED_ENTRY_PINS_JOIN')
    # helper.run independently reopens both retained source/config inputs under
    # the original continuous mutation lease.
    return module

def main():
    need(len(sys.argv) == 1 and os.geteuid() == 0, 'FIXED_ROOT_ENTRY_REQUIRED')
    need(not any(k.startswith('DS_') for k in os.environ), 'OVERRIDE_ENVIRONMENT_FORBIDDEN')
    config = read_entry_config()
    lock_parent = open_directory(Path(MUTEX).parent)
    try:
        lock = os.open(Path(MUTEX).name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=lock_parent)
        try:
            meta = os.fstat(lock)
            need(stat.S_ISREG(meta.st_mode) and (meta.st_uid, meta.st_gid) == (0, 80)
                 and stat.S_IMODE(meta.st_mode) == 0o644 and meta.st_nlink == 1, 'MUTEX_CUSTODY')
            lock_pin = pin(meta)
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            def lease_current():
                need(pin(os.fstat(lock)) == lock_pin, 'MUTEX_REPLACED')
                same_entry(lock, lock_parent, Path(MUTEX).name)
                live = open_directory(Path(MUTEX).parent)
                try:
                    need((os.fstat(live).st_dev, os.fstat(live).st_ino) ==
                         (os.fstat(lock_parent).st_dev, os.fstat(lock_parent).st_ino), 'MUTEX_PARENT_CHANGED')
                finally:
                    os.close(live)
            lease_current()
            helper=load_fixed_helper(config)
            outcome=helper.run(lease_current)
            need(type(outcome) is dict and outcome.get('outcome')=='FIXED_E35_TERMINAL_MATERIALS_FINISHED' and outcome.get('business_release') is False,'FIXED_TERMINAL_OUTCOME_REQUIRED')
            lease_current()
            print(json.dumps(outcome,sort_keys=True))
            return outcome
        finally:
            os.close(lock)
    finally:
        os.close(lock_parent)

if __name__=='__main__':main()
