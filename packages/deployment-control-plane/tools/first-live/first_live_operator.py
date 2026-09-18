"""One exact first-live ordinary supervisor; privileged effects stay in native code.

This file prepares the explicitly invoked --execute-exact entry. Its package
requires separate exact Owner approval after source and package review.
"""
if __name__ == "__main__":
    raise SystemExit("Use the exact reviewed first_live_launcher.py entry")

import re
from first_live_io import require, digest
from bind_records import _object, _canonical
import first_live_package as layout
GOAL="WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DELIVERY_V2"
SOURCE="59472b631129d1ea3ca1202cbcbbc0799b083114"
ARTIFACT="165b79833a23f480bd5d265b51377005e2e2526ea1c7dc0aee37fab4ad5c06f1"

OPERATION='first-live-dsh-20260918-01'
LEASE=14400
CONTROLLER='/usr/local/libexec/agent-deployd/agent-deployd'


def grant(packet_raw, now):
    p=_object(packet_raw,16*1024*1024)
    require(type(p.get('version')) is int and p['version']==1 and p.get('operation_id')==OPERATION,'PACKET_BINDING')
    require(type(now) is int and 0 < now < 2**53-LEASE,'CLOCK')
    for name in ['host','review_sha256','controller_sha256','owner_acceptance_digest','source_sha']:
        require(isinstance(p.get(name),str) and re.fullmatch('[0-9a-f]{'+('40' if name=='source_sha' else '64')+'}',p[name]),'PACKET_BINDING')
    return dict(version=1,owner='mayf3',scope='EXACT_DSH_FIRST_LIVE_ONLY',operation_id=OPERATION,
        host=p['host'],packet_sha256=digest(packet_raw),controller_sha256=p['controller_sha256'],
        source_sha=p['source_sha'],review_sha256=p['review_sha256'],issued_at=now,
        expires_at=now+LEASE,temporary_supply_hold=True)


def completed(records, owner_grant, packet_raw):
    """Only joins public protected observations; never creates a signed PASS."""
    expected=grant(packet_raw,owner_grant['issued_at'])
    require(owner_grant==expected,'GRANT_BINDING')
    names={'result.json','enable-intent.json','daemon-startup-intent.json','daemon-readback.json',
        'enable-admission.json','daemon-ready.json','enable-result.json','service.json','daemon-activation.json'}
    require(set(records)==names,'ENABLE_RECORD_SET')
    v={k:_object(records[k],32*1024*1024 if k=='service.json' else 1024*1024) for k in names}
    core=v['result.json'];b=v['enable-intent.json'];rb=v['daemon-readback.json']
    require(set(core)=={'version','operation_id','packet_sha256','grant_sha256','lifecycle_digest',
        'host_safety_receipt_digest','custody_completion_digest','reviewer_login_receipt_digest',
        'standing_receipt_digest','state'},'CORE_SHAPE')
    require(core['version']==1 and core['state']=='STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED'
        and core['operation_id']==OPERATION and core['packet_sha256']==expected['packet_sha256']
        and core['grant_sha256']==digest(_canonical(expected)),'CORE_BINDING')
    for k in ['lifecycle_digest','host_safety_receipt_digest','custody_completion_digest',
              'reviewer_login_receipt_digest','standing_receipt_digest']:
        require(isinstance(core[k],str) and re.fullmatch('[0-9a-f]{64}',core[k]),'CORE_DIGEST')
    wanted=dict(operation_id=OPERATION,package_digest=expected['packet_sha256'],
        grant_digest=digest(_canonical(expected)),controller_digest=expected['controller_sha256'],
        core_digest=digest(records['result.json']),configuration_digest=digest(records['service.json']),
        activation_digest=digest(records['daemon-activation.json']),standing_digest=core['standing_receipt_digest'],
        expires_at=expected['expires_at'])
    require(set(b)==set(wanted)|{'plist_before_digest','plist_after_digest'}
        and all(b.get(k)==val for k,val in wanted.items()),'ENABLE_BINDING')
    require(b['plist_before_digest']==layout.OLD_PLIST and b['plist_after_digest']==layout.NEW_PLIST,'ENABLE_PLIST_DIGEST')
    require(set(rb)=={'startup_intent_digest','binding','process','socket_device','socket_inode'}
        and rb['binding']==b,'READBACK_BINDING')
    process=rb['process']
    require(type(process) is dict and set(process)=={'pid','started_seconds','started_micros','uid','gid','executable'}
        and process['uid']==process['gid']==0 and process['executable']==CONTROLLER,'READBACK_PROCESS')
    for k,minimum in [('pid',2),('started_seconds',1),('started_micros',0)]:
        require(type(process[k]) is int and minimum <= process[k] < 2**53,'READBACK_PROCESS')
    require(process['started_micros']<1000000,'READBACK_PROCESS')
    require(all(type(rb[k]) is int and 0 < rb[k] < 2**64 for k in ['socket_device','socket_inode']),'READBACK_SOCKET')
    intent=v['daemon-startup-intent.json']
    require(intent==dict(binding=b,process=process)
        and rb['startup_intent_digest']==digest(records['daemon-startup-intent.json']),'READBACK_GENERATION')
    rb_digest=digest(_canonical(rb));admission=v['enable-admission.json'];ready=v['daemon-ready.json']
    require(admission==dict(binding=b,readback_digest=rb_digest),'ADMISSION_BINDING')
    require(ready==dict(admission_digest=digest(_canonical(admission)),readback=rb),'READY_BINDING')
    require(v['enable-result.json']==dict(binding=b,readback_digest=rb_digest,ready_digest=digest(_canonical(ready))),
        'ENABLE_RESULT_BINDING')
    return b


def final_observation(raw, producer, binding, records):
    value=_object(raw,1024*1024)
    wanted=dict(version=1,operation_id=OPERATION,package_digest=binding['package_digest'],
        controller_digest=binding['controller_digest'],configuration_digest=binding['configuration_digest'],
        activation_digest=binding['activation_digest'],enable_result_digest=digest(records['enable-result.json']),
        goal_id=GOAL,source_sha=SOURCE,artifact_sha256=ARTIFACT,target_runtime='dsh-system-runtime',
        deployment_profile='dsh-app',business_goal_complete=False)
    require(set(value)==set(wanted)|{'state','reason','evidence'} and
        all(type(value.get(k)) is type(v) and value[k]==v for k,v in wanted.items()),'COMPLETION_BINDING')
    if value['state']=='PENDING':
        require(isinstance(value['reason'],str) and 0<len(value['reason'])<=128,'COMPLETION_PENDING_REASON')
        return 'PENDING'
    require(value['state']=='COMPLETE' and value['reason'] is None,'COMPLETION_STATE')
    e=value['evidence'];joins=['unit_id','attempt','target_generation','service_generation','goal_receipt_digest']
    hashes=['installation_binding_digest','native_observation_digest','registry_ledger_digest','closure_digest']
    require(type(e) is dict and set(e)==set(joins+hashes+['registry_revision','registry_row_revision','outbox_id','delivered'])
        and e['delivered'] is True,'COMPLETION_EVIDENCE')
    require(all(type(e[k]) is type(producer[k]) and e[k]==producer[k] for k in joins),'COMPLETION_SUBMISSION')
    for k in hashes+['unit_id','service_generation','goal_receipt_digest','outbox_id']:layout.sha(e[k])
    for k in ['attempt','target_generation','registry_revision','registry_row_revision']:
        require(type(e[k]) is int and 0<e[k]<2**63,'COMPLETION_COORDINATES')
    return 'COMPLETE'



def protected_read(io,path,spec):
    before=io.expect(path,spec)
    raw=io.call(['/bin/cat',path],expected_digest=spec.get('sha256'))
    require(io.metadata(path)==before,'PROTECTED_READ_CHANGED')
    return raw


def prefix_gate(io,packet):
    for path,mode in layout.directories().items():
        m=io.metadata(path)
        require(m['type']=='Directory' and m['uid']==0,'PROTECTED_ANCESTOR')
        if path=='/private/var/run':
            require(m['gid']==1 and m['mode']==0o775,'SOCKET_ANCESTOR')
        else:require(m['mode'] & 0o7022==0,'PROTECTED_ANCESTOR')
        if mode is not None:require(m['mode']==int(mode,8) and m['flags']==0,'PROTECTED_DIRECTORY')
    old={}
    for path,spec in layout.prefix_files(packet).items():
        if path==layout.CODE+'/codex':io.stream_hash_fixed_codex(path,spec)
        else:old[path]=protected_read(io,path,spec)
    for path in layout.absent_paths():
        require(io.metadata(path,absent=True) is None,'PRIOR_OPERATION_PRESENT')
    require(io.call(['/bin/launchctl','print',layout.LABEL],missing=True) is None,'CONTROLLER_ALREADY_LOADED')
    disabled=io.call(['/bin/launchctl','print-disabled','system']).decode('utf-8').splitlines()
    rows=[line.strip() for line in disabled if '"ai.agent-deployd"' in line]
    require(rows==['"ai.agent-deployd" => true'],'CONTROLLER_NOT_DISABLED')
    before=io.metadata('/usr/bin/sudo')
    sudo_line=io.call(['/usr/bin/shasum','-a','256','/usr/bin/sudo'])
    require(io.metadata('/usr/bin/sudo')==before,'SUDO_ENTRY_CHANGED')
    from bind_records import _sudo_digest
    _sudo_digest(sudo_line)
    return old,sudo_line


def enabled_records(io):
    area=io.metadata(layout.ROOT+'/first-live-operation')
    require(area['type']=='Directory' and area['uid']==area['gid']==0 and
        area['mode']==0o700 and area['flags']==0,'ENABLE_AREA')
    out={}
    for name in layout.RECORDS:
        spec=layout.file_spec(mode='0600' if name=='service.json' else '0400')
        out[name]=protected_read(io,layout.record_path(name),spec)
    io.expect(layout.PLIST,layout.file_spec(layout.NEW_PLIST,'0644'))
    return out


def handoff(packet,grant_value,manifest,now):
    require(type(now) is int and grant_value['issued_at']<=now<grant_value['expires_at']-1800,
        'BROKER_LEASE_WINDOW')
    return dict(version=1,operation_id=OPERATION,package_sha256=grant_value['packet_sha256'],
        issuer_sha256=packet['review_helper_sha256'],ctl_sha256=manifest['files']['agent-deployctl']['sha256'],
        artifact_sha256=ARTIFACT,manifest_sha256=ARTIFACT,acceptance_revision='DEPLOYMENT_DELIVERY_V1',
        profile_revision=packet['configuration']['catalog']['profiles']['dsh-app']['revision'],
        issued_at=now,expires_at=min(now+3600,grant_value['expires_at']),mode='submit',existing=None)


def execute(io,manifest,package_path):
    """No retries: any failed/unknown prefix consumes the same outer attempt."""
    from pathlib import Path
    from first_live_io import read_local
    from bind_records import bind_packet
    package_path=Path(package_path)
    io.local_validate()
    def local(name):
        row=manifest['files'][name]
        raw=read_local(package_path/name,row['sha256'])
        require(len(raw)==row['size'],'PACKAGE_FILE_SIZE')
        return raw
    template=local('packet-template.json');p=_object(template,16*1024*1024)
    expected=layout.inputs(p)
    require(manifest['version']==1 and manifest['operation_id']==OPERATION and
        manifest['source_sha']==p['source_sha'] and manifest['controller_sha256']==p['controller_sha256'],
        'PACKAGE_SOURCE_BINDING')
    require(set(expected)<=set(manifest['files']) and all(manifest['files'][n]['sha256']==h for n,h in expected.items()),
        'PACKAGE_INPUT_BINDING')
    require(digest(local('owner-scope.json'))==p['owner_acceptance_digest'],'OWNER_SCOPE_BINDING')
    ctl=manifest['files']['agent-deployctl']['sha256'];layout.sha(ctl)
    require(manifest['root_argv_allowlist']==layout.commands(p,ctl),'ROOT_COMMAND_SET')
    wrapper=['/usr/bin/python3','-I','-S','-B',str(package_path/'first_live_launcher.py'),'--broker-exact']
    require(manifest['ordinary_argv_allowlist']==[wrapper],'ORDINARY_COMMAND_SET')
    io.claim()
    try:
        io.phase('protected-prefix');io.authenticate()
        old,sudo_line=prefix_gate(io,p)
        packet_raw=bind_packet(template,digest(template),sudo_line)
        p=_object(packet_raw,16*1024*1024)
        io.phase('protected-copy')
        io.call(['/bin/mkdir','-m','0700',layout.PACKET])
        io.call(['/bin/mkdir','-m','0700',layout.PACKET+'/payloads'])
        prepare_socket(io,p)
        for name in ['agent-deployd','agent-deploy-issuer']:
            value=old[layout.CODE+'/'+name]
            io.copy(value,digest(value),'0400',layout.PACKET+'/original-'+name)
        for name,(dest,mode,gid) in layout.copies(p,ctl).items():
            io.copy(local(name),manifest['files'][name]['sha256'],mode,dest,gid=gid)
        io.copy(packet_raw,digest(packet_raw),'0400',layout.PACKET+'/packet.json')
        g=grant(packet_raw,int(io.now()));grant_raw=_canonical(g)
        io.copy(grant_raw,digest(grant_raw),'0600',layout.PACKET+'/owner-grant.json')
        io.record('grant-binding.json',g)
        io.phase('native-first-live-enable')
        require(io.now()<g['expires_at'],'OWNER_GRANT_EXPIRED')
        io.call([CONTROLLER,'--first-live-and-enable'],visible=True)
        io.phase('enabled-readback');io.authenticate()
        require(io.now()<g['expires_at'],'OWNER_GRANT_EXPIRED')
        records=enabled_records(io);binding=completed(records,g,packet_raw)
        for name in ['agent-deployd','agent-deploy-issuer','agent-deployctl']:
            io.expect(layout.CODE+'/'+name,layout.file_spec(manifest['files'][name]['sha256'],'0555'))
        parent=io.metadata(layout.SOCKET)
        require(parent['type']=='Directory' and parent['uid']==0 and parent['mode'] & 0o7022==0
            and parent['flags']==0,'HANDOFF_PARENT')
        for name in ['control.sock','issuer.sock']:
            m=io.metadata(layout.SOCKET+'/'+name)
            require(m['type']=='Socket' and m['uid']==0 and m['gid']==602 and m['mode']==0o660,'SERVICE_SOCKET')
        require(io.metadata(layout.HANDOFF,absent=True) is None,'HANDOFF_ALREADY_PRESENT')
        h=handoff(p,g,manifest,int(io.now()));h_raw=_canonical(h)
        io.copy(h_raw,digest(h_raw),'0440',layout.HANDOFF,gid=20)
        io.phase('ordinary-broker-delivery')
        producer=_object(io.call(wrapper,root=False),8*1024*1024)
        require(producer.get('state')=='BROKER_DELIVERY_RECEIPTS_OBSERVED' and
            producer.get('operation_id')==OPERATION and producer.get('goal_id')==GOAL and
            producer.get('source_sha')==SOURCE and producer.get('handoff_sha256')==digest(h_raw) and
            producer.get('business_goal_complete') is False,'BROKER_RESULT_BINDING')
        io.record('producer-result.json',producer)
        io.phase('current-closure-readback');io.authenticate()
        require(io.now()<g['expires_at'],'OWNER_GRANT_EXPIRED')
        observed=io.call([CONTROLLER,'--first-live-completion'])
        status=final_observation(observed,producer,binding,records)
        result=dict(version=1,state='FIRST_AUTOMATIC_DELIVERY_'+status,operation_id=OPERATION,
            package_sha256=g['packet_sha256'],completion=_object(observed,1024*1024),
            parent_goal_complete=False,business_goal_complete=False)
        io.record('operator-result.json',result)
        return result
    except BaseException:
        try:io.record('operator-error.json',dict(state='STOP_RECONCILE',retry_forbidden=True,
            automatic_rollback=False,parent_goal_complete=False))
        except (OSError,RuntimeError,ValueError):pass
        raise


def main():
    import sys
    from pathlib import Path
    import pwd
    from first_live_io import read_local
    from first_live_os import OperatorIO
    require(len(sys.argv)==3 and sys.argv[1]=='--execute-exact','EXACT_OWNER_EXECUTION_ARGUMENT_REQUIRED')
    manifest_hash=layout.sha(sys.argv[2]);package=Path(__file__).resolve().parent
    manifest=_object(read_local(package/'manifest.json',manifest_hash),16*1024*1024)
    # This explicit invocation is only supplied in the separately approved package.
    home=Path(pwd.getpwuid(502).pw_dir)
    io=OperatorIO(manifest,package,home/'.agent-deploy-first-live-operator'/OPERATION)
    print(_canonical(execute(io,manifest,package)).decode())



def prepare_socket(io, packet):
    expected=packet['configuration']['socket_ancestor']
    keys=['device','inode','uid','gid','mode','flags']
    def parent():
        m=io.metadata('/private/var/run')
        require(m['type']=='Directory' and all(type(m[k]) is int and m[k]==expected[k] for k in keys),
            'SOCKET_ANCESTOR_BINDING')
    parent()
    require(io.metadata(layout.SOCKET,absent=True) is None,'SOCKET_NAMESPACE_ALREADY_PRESENT')
    io.call(['/bin/mkdir','-m','0700',layout.SOCKET])
    before=io.metadata(layout.SOCKET)
    require(before['type']=='Directory' and before['uid']==0 and before['mode']==0o700
        and before['flags']==0,'SOCKET_NAMESPACE_CLAIM')
    require(io.call(['/bin/ls','-1A',layout.SOCKET])==b'','SOCKET_NAMESPACE_NOT_EMPTY')
    io.call(['/usr/bin/install','-d','-o','root','-g','602','-m','0750',layout.SOCKET])
    after=io.metadata(layout.SOCKET)
    require(after['type']=='Directory' and after['uid']==0 and after['gid']==602 and after['mode']==0o750
        and after['flags']==0 and (after['device'],after['inode'])==(before['device'],before['inode']),
        'SOCKET_NAMESPACE_CHANGED')
    require(io.call(['/bin/ls','-1A',layout.SOCKET])==b'','SOCKET_NAMESPACE_NOT_EMPTY')
    parent()
