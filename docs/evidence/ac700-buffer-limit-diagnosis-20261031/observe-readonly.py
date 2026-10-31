import collections,datetime,hashlib,json,os,re,subprocess
AGENT='agt_family-steward-agent'
ORIGINAL='om_x100b63b755c5bca8b1ceb9b2c452815'
ROOT='/Users/authsvc/.agent-core'
SESSION=ROOT+'/homes/'+AGENT+'/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_6331d216dd4911f0966d3683f8451ad4--/main/session.jsonl'
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def iso(v):
    if isinstance(v,(int,float)):return datetime.datetime.fromtimestamp(v/1000,datetime.timezone.utc).isoformat()
    return v

def readbytes(p):
    with open(p,'rb') as f:return f.read()
def metadata(p,b):
    return dict(path=p,realpath=os.path.realpath(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),mtime=iso(os.stat(p).st_mtime*1000))
def projection(r,fields):return {k:r.get(k) for k in fields if k in r and isinstance(r[k],(str,int,float,bool,type(None)))}
ID_FIELDS={'id','requestId','messageId','feishuMessageId','channelMessageId','replyToMessageId','originalMessageId'}
def exact_ids(x):
    if isinstance(x,dict):
        return any(k in ID_FIELDS and v==ORIGINAL for k,v in x.items()) or any(exact_ids(v) for v in x.values() if isinstance(v,(dict,list)))
    if isinstance(x,list):return any(exact_ids(v) for v in x if isinstance(v,(dict,list)))
    return False
out={'schema':'ac700-readonly-metadata-v1','observed_at':stamp(),'method':{'scope':'exact family-steward receipt/session status only','withheld':['all message content','assistant output','tool arguments/results','tokens','credentials','settings contents'],'production_writes':0,'probe_messages_sent':0}}
packages=[]
for p in ['/usr/local/libexec/agent-core/harness/package.json','/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/package.json',ROOT+'/control/codex-plugin-runtime/current/dsh-codex/package.json']:
    b=readbytes(p);d=json.loads(b);m=metadata(p,b);m.update(name=d.get('name'),version=d.get('version'));packages.append(m)
out['disk_packages']=packages
link=ROOT+'/control/codex-plugin-runtime/current';out['shared_plugin_link']={'path':link,'target':os.readlink(link)}
p='/usr/local/libexec/agent-core/app/pack-provenance.json';b=readbytes(p);d=json.loads(b);out['app_disk_provenance']=metadata(p,b);out['app_disk_provenance'].update(projection(d,['source_head_sha','source_tree_sha','source_clean','packed_app_tree_sha256']))
b=readbytes(SESSION);types=collections.Counter();ends=[];starts=[];inputs=[];original_hits=0;buffer_hits=0;parse_errors=0
for line in b.splitlines():
    try:d=json.loads(line)
    except (ValueError,TypeError):parse_errors+=1;continue
    typ=d.get('type');types[typ]+=1;v=d.get('data') or {};time=iso(d.get('time',d.get('time0')))
    # Do not expose or interpret message bodies, tool payloads or free error text.
    if typ=='turn/start':starts.append({'turn':v.get('turn'),'time':time})
    if typ=='user/message':inputs.append(dict(projection(v,['id','role']),time=time))
    if typ=='turn/end':
        reason=v.get('reason');kind=reason.get('kind') if isinstance(reason,dict) else reason
        ends.append({'turn':v.get('turn'),'time':time,'seq':d.get('seq',d.get('seq0')),'kind':kind if isinstance(kind,str) else 'UNKNOWN'})
    if exact_ids(d):original_hits+=1
    if b'exceeded request buffer limit while retrying upstream' in line:buffer_hits+=1
out['main_session']=dict(metadata(SESSION,b),event_counts=dict(types),parse_errors=parse_errors,turn_starts=starts,turn_ends=ends,last_input_metadata=inputs[-4:],exact_original_id_metadata_hits=original_hits,exact_error_text_line_hits=buffer_hits,history_scope='current retained main file only; no claim about deleted or rotated content')
fields=['kind','phase','agentId','sourceAgentId','targetAgentId','sessionId','requestId','messageId','pid','status','code','failureCode','failureSource']
for n in ['runtime-evidence.jsonl','agent-session-messaging-audit.jsonl']:
    p=ROOT+'/control/'+n;b=readbytes(p);rows=[];hits=[];errors=0
    for line in b.splitlines():
        try:d=json.loads(line)
        except (ValueError,TypeError):errors+=1;continue
        if exact_ids(d):hits.append(dict(projection(d,fields),time=iso(d.get('ts'))))
        if AGENT not in [d.get('agentId'),d.get('targetAgentId')]:continue
        rows.append(dict(projection(d,fields),time=iso(d.get('ts'))))
    out[n]=dict(metadata(p,b),target_family_rows=len(rows),parse_errors=errors,exact_original_id_metadata_matches=hits,last_rows=rows[-4:])
p=ROOT+'/control/turn-recovery-v3.json';b=readbytes(p);d=json.loads(b);records=d.get('records',{});records=list(records.values()) if isinstance(records,dict) else records
family=[r for r in records if r.get('agentId')==AGENT];epoch=d.get('runtimeEpoch');hits=[];rows=[]
fields=['handle','agentId','runtimeEpoch','processGeneration','turnSeq','sessionId','messageId','promptRequestId','state','initialOutcome','outcome','lateOutcome','recoveryState','fenceState','errorClass','admitted','promptWriteAttempted']
for r in family:
    v=projection(r,fields);v['createdAt']=iso(r.get('createdAtWallMs',r.get('createdAt')));rows.append(v)
    if exact_ids(r):hits.append(v)
out['reconciliation_store']=dict(metadata(p,b),current_runtime_epoch=epoch,family_record_count=len(family),family_records_in_current_epoch=sum(r.get('runtimeEpoch')==epoch for r in family),state_counts=dict(collections.Counter(r.get('state') for r in family)),outcome_counts=dict(collections.Counter(str(r.get('outcome')) for r in family)),exact_original_id_metadata_matches=hits,last_rows=rows[-2:])
# Only classify exact historical error text; never return adjacent log content.
logs=[]
for n in ['runtime.log','runtime.err.log']:
    p=ROOT+'/logs/'+n;b=readbytes(p);hits=[]
    for lineno,line in enumerate(b.splitlines(),1):
        if b'exceeded request buffer limit while retrying upstream' in line:
            hits.append({'line':lineno,'sha256':hashlib.sha256(line).hexdigest(),'family_id_on_same_line':AGENT.encode() in line,'original_id_on_same_line':ORIGINAL.encode() in line})
    logs.append(dict(metadata(p,b),exact_error_lines=hits,correlation='No timestamp or family/request binding inferred from uncorrelated log lines'))
out['runtime_logs']=logs
p=ROOT+'/homes/'+AGENT+'/demo-owner.lock';v=json.loads(readbytes(p));pid=v if isinstance(v,int) else None
ps=subprocess.run(['/bin/ps','-p',str(pid),'-o','pid=,ppid=,lstart=,comm='],capture_output=True,text=True) if pid else None
out['family_lock']={'path':p,'pid':pid,'ps_rc':ps.returncode if ps else None,'process_metadata':ps.stdout.strip() if ps else None,'meaning':'lock presence alone does not prove a live worker'}
out['finished_at']=stamp()
print(json.dumps(out,ensure_ascii=False,indent=2,sort_keys=True))
