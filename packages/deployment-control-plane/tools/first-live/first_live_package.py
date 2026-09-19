"""Closed paths and inputs for one future Owner-approved first-live operation.

Pure mapping only: this module has no subprocess, root call or execution entry.
"""
import re
from first_live_io import require

OPERATION='first-live-dsh-20260918-01'
EXECUTION_ID='first-live-dsh-20260918-01-p4r15-recovery-successor'
PREDECESSOR={
 'operation_id':OPERATION,
 'execution_id':'first-live-dsh-20260918-01-p4r13-successor',
 'package_sha256':'43d3a4661f768d9bdfd32349e8aa87c11a9ae1a7cf22a9f20895beb0df00d68d',
 'plan_sha256':'72e3201520c617e96342ecf04214e92041add0765bfc9263cca2e0f064cea7c7',
 'operation_packet_sha256':'04ffd0d460f4ee1e61667a3ba4dc5b5d4457b2c2ecc033d6869d79b6e29dd174',
 'disposition':'AUTHORIZED_ATTEMPT_CONSUMED_RETAINED_SAFE_STOP_FIRST_LIVE_SERVICE_SUDO_POLICY',
 'consumed':True,
 'retry_forbidden':True,
 'stop_class':'FIRST_LIVE_SERVICE_SUDO_POLICY',
 'production_mutation_performed':True,
 'control_plane_staging_performed':True,
 'controller_enable_performed':False,
 'retained_fence_flag':131072,
 'retained_operation_inode':88513828,
 'fresh_production_revalidation_required':True,
 'standing_successor_authority_applies':True,
}
PACKET='/private/var/db/agent-deploy-first-live'
ROOT='/private/var/db/agent-deployd'
CODE='/usr/local/libexec/agent-deployd'
SOCKET='/private/var/run/agent-deployd'
ATTEMPT='/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01'
PLIST='/Library/LaunchDaemons/ai.agent-deployd.plist'
HANDOFF=SOCKET+'/broker-first-delivery.json'
LABEL='system/ai.agent-deployd'
P4R9_OPERATION_ARCHIVE=ROOT+'/first-live-operation-p4r9-superseded'
P4R9_PACKET_ARCHIVE='/private/var/db/agent-deploy-first-live-p4r9-superseded'
P4R14_OPERATION_ARCHIVE=ROOT+'/first-live-operation-p4r14r2-retained'
P4R14_PACKET_ARCHIVE='/private/var/db/agent-deploy-first-live-p4r14r2-retained'
P4R14_PENDING_ARCHIVE=ROOT+'/first-live-pending-p4r14r2-retained.json'
P4R15_RECONCILIATION=ROOT+'/first-live-p4r15-reconciliation'
# Historical module constants remain only for its immutable regression tests.
P4R12_OPERATION_ARCHIVE=ROOT+'/first-live-operation-p4r12-superseded'
P4R12_PACKET_ARCHIVE='/private/var/db/agent-deploy-first-live-p4r12-superseded'
LEGACY_ANCESTOR='/usr/local/var/agent-core'
LEGACY_DEPLOY_LOCK=LEGACY_ANCESTOR+'/production-mutation-locks/production-deploy.lock'
LEGACY_TRANSACTION_LOCK='/private/var/db/agent-core/production-transaction.lock'
SUDOERS_ACTIVE='/private/etc/sudoers.d'
LEGACY_SUDOERS_NAMES=('openclaw-gateway-restart','openclaw-gateway-restart.ztWs0g')
SUDOERS_RETIREMENT=ROOT+'/first-live-sudoers-retirement-p4r15'
FENCE_PROBE_BINARY=CODE+'/agent-deploy-first-live-fence-probe'
FENCE_PROBE_ROOT=ROOT+'/first-live-fence-capability-p4r13'
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


def prefix_files(packet, installed=None):
    p=packet['previous']
    out={CODE+'/'+name:file_spec(h,'0444' if name.endswith('.json') else '0555') for name,h in OLD_CODE.items()}
    out[CODE+'/codex']['size']=220584000
    out[PLIST]=file_spec(OLD_PLIST,'0644')
    for path,key in [(ATTEMPT+'/steps/installation.json','installation_receipt_sha256'),
                     (ROOT+'/service.json','service_sha256'),(ROOT+'/local-trust.json','trust_sha256'),
                     (ROOT+'/issuer-policy.json','issuer_policy_sha256'),
                     (ROOT+'/registry/state-00000000000000000001.json','registry_sha256')]:
        out[path]=file_spec(p[key])
    out[ATTEMPT+'/login-intent.json']=file_spec('3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6')
    if installed is not None:
        require(type(installed) is dict and set(installed)=={'agent-deployd','agent-deploy-issuer','agent-deployctl'},
            'STAGED_INSTALLED_SET')
        for name,spec in installed.items():out[CODE+'/'+name]=spec
    return out


def absent_paths(staged=False):
    initial=[PACKET] if staged else [PACKET,SOCKET,CODE+'/agent-deployctl']
    return initial+[ATTEMPT+'/'+n for n in
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


def commands(packet,ctl_hash,reconciliation=None):
    """Exact public reads and finite fixed writes; no caller paths, keys or auth."""
    mapping=copies(packet,ctl_hash)
    installed=None if reconciliation is None else reconciliation.get('installed_files')
    protected_paths=set(prefix_files(packet,installed))|set(record_path(n) for n in RECORDS)
    read_paths=protected_paths-{CODE+'/codex'}
    write_paths={dest:(mode,gid) for dest,mode,gid in mapping.values()}
    write_paths.update({PACKET+'/packet.json':('0400',0),PACKET+'/owner-grant.json':('0600',0),
        HANDOFF:('0440',20),PACKET+'/original-agent-deployd':('0400',0),
        PACKET+'/original-agent-deploy-issuer':('0400',0)})
    read_paths |= set(write_paths)
    metadata_paths=protected_paths|read_paths|set(absent_paths(reconciliation is not None))|set(directories())|{PACKET,PACKET+'/payloads',SOCKET,
        ROOT+'/first-live-operation',SOCKET+'/control.sock',SOCKET+'/issuer.sock','/usr/bin/sudo'}
    argv=[]
    for path in sorted(metadata_paths):
        argv.extend([['/usr/bin/stat','-f',STAT_FORMAT,path],['/bin/ls','-ldeO',path]])
    argv += [['/bin/cat',p] for p in sorted(read_paths)]
    argv += [['/usr/bin/install','-o','root','-g','wheel' if gid==0 else '20','-m',mode,'/dev/fd/0',p]
             for p,(mode,gid) in sorted(write_paths.items())]
    argv += [['/bin/mkdir','-m','0700',p] for p in [PACKET,PACKET+'/payloads',SOCKET]]
    argv += [['/bin/ls','-1A',SOCKET],['/usr/bin/install','-d','-o','root','-g','602','-m','0750',SOCKET]]
    argv += [['/usr/bin/shasum','-a','256','/usr/bin/sudo'],['/bin/launchctl','print',LABEL],
             ['/bin/launchctl','print-disabled','system'],[CODE+'/agent-deployd','--first-live-recovery-and-enable'],
             [CODE+'/agent-deployd','--first-live-completion']]
    if reconciliation is not None:
        require(type(reconciliation) is dict and type(reconciliation.get('staging_files')) is dict,
            'P4R14_RECONCILIATION_SHAPE')
        p4reads={ROOT+'/first-live-pending.json'}
        p4reads.update(ROOT+'/first-live-operation/'+name for name in reconciliation['operation_files'])
        p4reads.update(PACKET+'/'+name for name in reconciliation['staging_files'])
        p4reads.add(SUDOERS_RETIREMENT+'/retirement-complete.json')
        p4reads.update(SUDOERS_RETIREMENT+'/preimages/'+name for name in LEGACY_SUDOERS_NAMES)
        for path,value in reconciliation['legacy_locks'].items():
            p4reads.add(path+'/'+value['holder_name'])
        reconcile_records={P4R15_RECONCILIATION+'/'+name for name in (
            'intent.json','pending-archive-result.json','operation-archive-result.json',
            'packet-archive-result.json','complete.json')}
        write_paths.update({path:('0400',0) for path in reconcile_records})
        p4meta=p4reads|{ROOT+'/first-live-operation',
            ROOT+'/first-live-operation/first-live-maintenance-0-0',P4R14_OPERATION_ARCHIVE,
            P4R14_PACKET_ARCHIVE,P4R14_PENDING_ARCHIVE,P4R15_RECONCILIATION,
            LEGACY_ANCESTOR,SUDOERS_RETIREMENT,SUDOERS_RETIREMENT+'/preimages',
            P4R14_OPERATION_ARCHIVE+'/first-live-intent.json',P4R14_PENDING_ARCHIVE,
            P4R14_PACKET_ARCHIVE+'/packet.json'}|set(reconciliation['legacy_locks'])
        p4meta.update(SUDOERS_ACTIVE+'/'+name for name in LEGACY_SUDOERS_NAMES)
        p4meta |= reconcile_records
        archive_originals={P4R14_PACKET_ARCHIVE+'/original-agent-deployd',
            P4R14_PACKET_ARCHIVE+'/original-agent-deploy-issuer'}
        p4meta |= archive_originals
        for path in sorted(p4meta):
            argv.extend([['/usr/bin/stat','-f',STAT_FORMAT,path],['/bin/ls','-ldeO',path]])
        argv += [['/bin/cat',p] for p in sorted(p4reads|archive_originals|reconcile_records|{
            P4R14_OPERATION_ARCHIVE+'/first-live-intent.json',P4R14_PENDING_ARCHIVE,
            P4R14_PACKET_ARCHIVE+'/packet.json'})]
        argv += [['/bin/ls','-1A',ROOT+'/first-live-operation'],['/bin/ls','-1A',PACKET],
            ['/bin/ls','-1A',PACKET+'/payloads'],
            ['/bin/ls','-1A',ROOT+'/first-live-operation/first-live-maintenance-0-0']]
        argv += [['/bin/ls','-1A',path] for path in (
            SUDOERS_RETIREMENT,LEGACY_ANCESTOR,P4R14_OPERATION_ARCHIVE,P4R14_PACKET_ARCHIVE)]
        argv += [['/bin/ls','-1A',path] for path in reconciliation['legacy_locks']]
        argv += [['/usr/bin/install','-o','root','-g','wheel','-m','0400','/dev/fd/0',p]
            for p in sorted(reconcile_records)]
        argv += [['/bin/mkdir','-m','0700',P4R15_RECONCILIATION],
            ['/bin/mv',ROOT+'/first-live-pending.json',P4R14_PENDING_ARCHIVE],
            ['/bin/mv',ROOT+'/first-live-operation',P4R14_OPERATION_ARCHIVE],
            ['/bin/mv',PACKET,P4R14_PACKET_ARCHIVE],['/bin/sync']]
    return [list(row) for row in dict.fromkeys(tuple(row) for row in argv)]
