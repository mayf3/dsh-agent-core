"""Closed paths and inputs for one future Owner-approved first-live operation.

Pure mapping only: this module has no subprocess, root call or execution entry.
"""
import re
from first_live_io import require

OPERATION='first-live-dsh-20260918-01'
PACKET='/private/var/db/agent-deploy-first-live'
ROOT='/private/var/db/agent-deployd'
CODE='/usr/local/libexec/agent-deployd'
SOCKET='/private/var/run/agent-deployd'
ATTEMPT='/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01'
PLIST='/Library/LaunchDaemons/ai.agent-deployd.plist'
HANDOFF=SOCKET+'/broker-first-delivery.json'
LABEL='system/ai.agent-deployd'
STAT_FORMAT='%u|%g|%p|%l|%f|%z|%m|%c|%i|%B|%d|%HT'
OLD_PLIST='c09e24824db86db2267da236594b94d1d36399171e9d6b25e78a928c66af095b'
NEW_PLIST='1ea0bb35dbe9aa0929b14e0395b70837618c0d8d4cb852c6c4d315a1245e290f'
OLD_CODE={
 'agent-deploy-bootstrap':'d918d8f6f1d5e84334cd4a5e130cca998bcc5eb049a5de10a95093c0f4e7fe3c',
 'agent-deployd':'d334470bfac831b6dee1ce314ac8db6aecdafcca7aec9804336ad6362e743a88',
 'agent-deploy-issuer':'13f1afd7173356069939253ea53a06b757ca0d76442cff42fd9c61f3161b22cb',
 'codex':'b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3',
 'review-output-schema.json':'8c19ccf24f5f929bcbcc70bafff468b0fd23cbaf272fc64497157d02e4eb7e50'}
RECORDS=['result.json','enable-intent.json','daemon-startup-intent.json','daemon-readback.json',
 'enable-admission.json','daemon-ready.json','enable-result.json','service.json','daemon-activation.json']


def sha(value):
    require(isinstance(value,str) and re.fullmatch('[0-9a-f]{64}',value) and value!='0'*64,'PACKAGE_DIGEST')
    return value


def inputs(packet):
    life=packet['lifecycle'];payloads=life['node_payloads']
    require(type(payloads) is dict and len(payloads)==22 and 'bin/node' in payloads,'LOADER_CLOSURE')
    require(all(k=='bin/node' or re.fullmatch(r'lib/[A-Za-z0-9._+-]+',k) for k in payloads),'LOADER_PATH')
    result={name:sha(life[key]) for name,key in [('app-inventory.json','app_inventory_sha256'),
        ('harness-inventory.json','harness_inventory_sha256'),('node-inventory.json','node_inventory_sha256')]}
    result.update({'payloads/'+sha(h):h for h in payloads.values()})
    result['payloads/'+sha(life['retired_binary_sha256'])]=life['retired_binary_sha256']
    result.update({'agent-deployd':sha(packet['controller_sha256']),
        'agent-deploy-issuer':sha(packet['review_helper_sha256']),
        'tailscaled':'5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da',
        'tailscaled.plist':'ec12e0c62acf5cd44984fdf8474dca8fafc098842c2a9f8c3f62bfb03caa19f8'})
    return result


def file_spec(hash_value=None,mode='0600',gid=0):
    value=dict(uid=0,gid=gid,mode=mode,nlink=1,flags=0)
    if hash_value is not None:value['sha256']=sha(hash_value)
    return value


def prefix_files(packet):
    p=packet['previous']
    out={CODE+'/'+name:file_spec(h,'0444' if name.endswith('.json') else '0555') for name,h in OLD_CODE.items()}
    out[PLIST]=file_spec(OLD_PLIST,'0644')
    for path,key in [(ATTEMPT+'/steps/installation.json','installation_receipt_sha256'),
                     (ROOT+'/service.json','service_sha256'),(ROOT+'/local-trust.json','trust_sha256'),
                     (ROOT+'/issuer-policy.json','issuer_policy_sha256'),
                     (ROOT+'/registry/state-00000000000000000001.json','registry_sha256')]:
        out[path]=file_spec(p[key])
    out[ATTEMPT+'/login-intent.json']=file_spec('3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6')
    return out


def absent_paths():
    return [PACKET,SOCKET,CODE+'/agent-deployctl']+[ATTEMPT+'/'+n for n in
        ['login-result.json','login-reconciliation-intent.json','login-reconciliation-result.json',
         'login-reconciliation-failure.json','rollback-intent.json','rollback-result.json','failure.json']]+[
        ROOT+'/'+n for n in ['queue.db','queue.db-wal','queue.db-shm','queue.db-journal','activation.json',
        'daemon-activation.json','issuer-bindings.json','first-live-pending.json','first-live-materialization.json',
        'watchdog-observer-policy.json','first-live-operation','adoptions','adoption-authorizations']]


def record_path(name):
    require(name in RECORDS,'PUBLIC_RECORD_NAME')
    return ROOT+('/' if name in ('service.json','daemon-activation.json') else '/first-live-operation/')+name


def directories():
    return {'/':None,'/usr':None,'/usr/local':None,'/usr/local/libexec':None,CODE:'0755',
        '/Library':None,'/Library/LaunchDaemons':None,'/private':None,'/private/var':None,
        '/private/var/db':None,ROOT:'0700',ROOT+'/registry':'0700',
        '/private/var/db/agent-deploy-bootstrap':'0700',ATTEMPT:'0700',ATTEMPT+'/steps':'0700',
        '/private/var/run':'0775'}


def copies(packet,ctl_hash):
    result={name:(CODE+'/'+name,'0555',0) if name in ('agent-deployd','agent-deploy-issuer')
            else (PACKET+'/'+name,'0400',0) for name in inputs(packet)}
    sha(ctl_hash);result['agent-deployctl']=(CODE+'/agent-deployctl','0555',0)
    return result


def commands(packet,ctl_hash):
    """Exact public reads and finite fixed writes; no caller paths, keys or auth."""
    mapping=copies(packet,ctl_hash)
    read_paths=set(prefix_files(packet))|set(record_path(n) for n in RECORDS)
    write_paths={dest:(mode,gid) for dest,mode,gid in mapping.values()}
    write_paths.update({PACKET+'/packet.json':('0400',0),PACKET+'/owner-grant.json':('0600',0),
        HANDOFF:('0440',20),PACKET+'/original-agent-deployd':('0400',0),
        PACKET+'/original-agent-deploy-issuer':('0400',0)})
    read_paths |= set(write_paths)
    metadata_paths=read_paths|set(absent_paths())|set(directories())|{PACKET,PACKET+'/payloads',SOCKET,
        ROOT+'/first-live-operation',SOCKET+'/control.sock',SOCKET+'/issuer.sock','/usr/bin/sudo'}
    argv=[]
    for path in sorted(metadata_paths):
        argv.extend([['/usr/bin/stat','-f',STAT_FORMAT,path],['/bin/ls','-ldeO',path]])
    argv += [['/bin/cat',p] for p in sorted(read_paths)]
    argv += [['/usr/bin/install','-o','root','-g','wheel' if gid==0 else '20','-m',mode,'/dev/fd/0',p]
             for p,(mode,gid) in sorted(write_paths.items())]
    argv += [['/bin/mkdir','-m','0700',p] for p in [PACKET,PACKET+'/payloads']]
    argv += [['/usr/bin/shasum','-a','256','/usr/bin/sudo'],['/bin/launchctl','print',LABEL],
             ['/bin/launchctl','print-disabled','system'],[CODE+'/agent-deployd','--first-live-and-enable'],
             [CODE+'/agent-deployd','--first-live-completion']]
    return argv
