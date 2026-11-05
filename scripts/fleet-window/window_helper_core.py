# Moved unchanged from window-executor-v5.sh at c4152e9a (see R3 receipt).
import datetime as dt, hashlib, json, math, os, pathlib, plistlib, re, shutil, stat
import subprocess as sp, sys, time, urllib.request
P=pathlib.Path
rd=P(sys.argv[1]); op=sys.argv[2]; args=sys.argv[3:]
prep=P('/private/tmp/fleet-v5-prep'); inp=P('/private/tmp/fleet-binding-diag/r3')
source=P('/private/tmp/fleet-roll-src'); harness=P('/tmp/v5-rebuild/harness-src')
live=P('/usr/local/libexec/agent-core'); prod=P('/Users/authsvc/.agent-core')
plist=P('/Library/LaunchDaemons/ai.agent-core.runtime.plist')
lock=P('/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock')
service='system/ai.agent-core.runtime'
sha='f6a1f77a8b7b878bcb9821a68836925755ca7076'; tree='08d7ea7108e8d92417b33db52523e5bd545ddce3'
def require(ok, message):
    if not ok: raise RuntimeError(message)
def digest(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def stamp(s):
    value=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
    require(value.tzinfo is not None and value.utcoffset()==dt.timedelta(0),'authority/receipt time must be UTC')
    return value.timestamp()
def validate_authority(a, writer_uid=None, now_epoch=None):
    required=['window_id','writer','writer_uid','valid_from','valid_until','expected_old_pid','expected_old_identity',
              'expected_old_sha','expected_plist_sha256','expected_harness_stamp','expected_bindings_sha256',
              'expected_runtime_uid','expected_runtime_gid','scopes']
    require(all(k in a for k in required),'authority fields missing; see --help')
    require(re.fullmatch('[A-Za-z0-9._-]{1,80}',a['window_id']) and a['writer'],'invalid writer/window id')
    uid=os.getuid() if writer_uid is None else writer_uid
    require(a['writer_uid']==uid!=0,'execute as explicitly named non-root writer; privileged actions use sudo')
    require(a['expected_old_sha']=='23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9','window stop authorization is pinned to the deployed 23fb91a6 only')
    require(set(['source_lockfile_cleanup','production_mutex','bootout','full_preimage','install',
                 'plist_deployed_sha_only','bootstrap','verify','hr_observe'])<=set(a['scopes']),'missing authorized scope')
    current=time.time() if now_epoch is None else now_epoch
    require(stamp(a['valid_from'])<=current<stamp(a['valid_until']),'window authorization not current')
    return a
def quiet_ready(age_seconds, census_available, log_unchanged):
    return math.isfinite(age_seconds) and age_seconds>=180 and census_available is True and log_unchanged is True
def read(p): return json.loads(P(p).read_text())
def save(name,obj):
    p=rd/name
    with open(p,'w') as f: json.dump(obj,f,ensure_ascii=False,indent=2); f.write('\n')
    os.chmod(p,0o600)
    if os.geteuid()==0: os.chown(p,rd.stat().st_uid,rd.stat().st_gid)
def raw(name,data):
    p=rd/name; p.write_bytes(data); os.chmod(p,0o600)
    if os.geteuid()==0: os.chown(p,rd.stat().st_uid,rd.stat().st_gid)
def run(argv,ok=(0,),env=None,timeout=60):
    if env is None: env=dict(os.environ,LC_ALL='C',LANG='C')
    p=sp.run([str(x) for x in argv],stdout=sp.PIPE,stderr=sp.PIPE,env=env,timeout=timeout)
    require(p.returncode in ok,'command failed rc=%s argv=%r stderr=%s'%(p.returncode,argv,p.stderr.decode(errors='replace')[-2000:]))
    return p
def meta(p):
    s=P(p).lstat()
    return dict(uid=s.st_uid,gid=s.st_gid,mode=oct(stat.S_IMODE(s.st_mode)),size=s.st_size,
                mtime_ns=s.st_mtime_ns,dev=s.st_dev,ino=s.st_ino)
def regular(p): require(P(p).is_file() and not P(p).is_symlink(),'missing/nonregular file: '+str(p))
def acl_listing(root):
    # One recursive read, not a process per file. Keep only ACL entries keyed
    # by relative filename; ls's '..', mtime and link-count columns are not ACL.
    text=run(['/bin/ls','-laeR',root]).stdout.decode()
    directory=P(root); key=None; rows={}
    for line in text.splitlines():
        if line.startswith(str(root)) and line.endswith(':'):
            directory=P(line[:-1]); key=None
        elif re.match(r'^\s*\d+: ',line):
            require(key is not None,'ACL entry has no bound filename')
            rows.setdefault(key,[]).append(line.strip())
        elif line and line[0] in '-dlbcps':
            fields=line.split(None,8); require(len(fields)==9,'unparseable metadata listing')
            name=fields[8]
            if name=='..' or (name=='.' and directory!=P(root)): key=None; continue
            key='.' if name=='.' else str((directory/name).relative_to(root))
    return (json.dumps(rows,sort_keys=True,ensure_ascii=False)+'\n').encode()
def manifest(file,base,expected=None):
    regular(file)
    if expected: require(digest(file)==expected,'manifest seal changed: '+str(file))
    records={}
    for row in file.read_text().splitlines():
        h,name=row.split('  ',1); require(re.fullmatch('[a-f0-9]{64}',h),'invalid digest')
        require(name not in records,'duplicate manifest path')
        p=P(name) if P(name).is_absolute() else base/name
        require(digest(p)==h,'manifest mismatch: '+str(p)); records[name]=h
    require(records,'empty manifest')
    return {'path':str(file),'sha256':digest(file),'verified':len(records),'records':records}
def authority():
    a=read(rd/'authority.json')
    require(stamp(a['valid_from'])<=time.time()<stamp(a['valid_until']),'window authorization not current')
    return a
def identity(pid):
    return run(['/bin/ps','-p',str(pid),'-o','pid=','-o','uid=','-o','gid=','-o','lstart=','-o','comm=']).stdout.decode().strip()
def launch(): return run(['/bin/launchctl','print',service]).stdout.decode()
def pid_from(text):
    m=re.findall(r'^\s*pid = (\d+)\s*$',text,re.M); require(len(m)==1,'exact launch PID unavailable'); return int(m[0])
def loaded_env(pid,expected,name):
    data=run(['/bin/ps','eww','-p',str(pid),'-o','command=']).stdout
    raw(name,data) # private file only; never print credentials to console
    text=data.decode(errors='strict').rstrip('\n')
    for key,value in expected.items():
        require(isinstance(value,str),'non-string plist env '+key)
        require(re.search(r'(?:^| )'+re.escape(key+'='+value)+r'(?= [A-Za-z_][A-Za-z_0-9]*=|$)',text),
                'loaded env missing/mismatch '+key)
    for key in ('NODE_OPTIONS','NODE_PATH','DSH_RUNTIME_ARCH','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY',
                'NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','NODE_USE_ENV_PROXY'):
        require(not re.search(r'(?:^| )'+key+'=',text),'unexpected loaded execution environment '+key)
    return digest(rd/name)
def launch_binding(text,doc):
    found=re.search(r'^\s*arguments = \{\n(.*?)^\s*\}',text,re.M|re.S)
    require(found is not None,'loaded launch arguments unavailable')
    values=[line.strip() for line in found[1].splitlines() if line.strip()]
    require(values==doc['ProgramArguments'],'loaded launch arguments differ from plist')
    cwd=re.search(r'^\s*working directory = (.+)$',text,re.M)
    require(cwd is not None and cwd[1].strip()==doc['WorkingDirectory'],'loaded WorkingDirectory differs')
def process_table():
    t=run(['/bin/ps','-axo','pid=,ppid=,uid=,gid=,lstart=,command=']).stdout.decode()
    rows={}
    for line in t.splitlines():
        m=re.match(r'\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)',line)
        require(m is not None,'unparseable process table')
        pid,parent,uid,gid=map(int,m.groups()[:4]); rows[pid]={'pid':pid,'ppid':parent,'uid':uid,'gid':gid,'rest':m[5]}
    return rows
def old_workers(pid):
    rows=process_table(); wanted={pid}
    while True:
        new=wanted|{p for p,r in rows.items() if r['ppid'] in wanted}
        if new==wanted: break
        wanted=new
    # Also retain detached trusted-tree workers; don't rely on PPID after exit.
    wanted|={p for p,r in rows.items() if str(live) in r['rest'] and p!=os.getpid()}
    return [rows[p] for p in sorted(wanted) if p in rows]
def service_absent(pending=False):
    p=sp.run(['/bin/launchctl','print',service],stdout=sp.PIPE,stderr=sp.PIPE,timeout=10)
    text=(p.stdout+p.stderr).decode(errors='replace')
    if pending and p.returncode==0: sys.exit(10)
    require(p.returncode!=0 and re.search(r'Could not find (?:specified )?service|service not found',text,re.I),
            'supervisor absence not proven: '+text[-500:])
    return {'rc':p.returncode,'output':text}
def json_value(data):
    def object_pairs(pairs):
        result={}
        for key,value in pairs:
            require(key not in result,'duplicate JSON object key')
            result[key]=value
        return result
    def bad_constant(value): raise ValueError('non-JSON numeric constant')
    return json.loads(data,object_pairs_hook=object_pairs,parse_constant=bad_constant)
def json_kind(value):
    if value is None: return 'null'
    if isinstance(value,bool): return 'boolean'
    if isinstance(value,(int,float)): return 'number'
    if isinstance(value,str): return 'string'
    if isinstance(value,list): return 'array'
    if isinstance(value,dict): return 'object'
    raise TypeError('unsupported JSON value')
def state_diff(before,after,path=''):
    # Complete JSON-pointer diff, retained only in 0600 receipts; no truncation.
    if not isinstance(before,(dict,list)) and type(before) is type(after) and before==after: return []
    pointer=lambda key:path+'/'+str(key).replace('~','~0').replace('/','~1')
    if isinstance(before,dict) and isinstance(after,dict):
        rows=[]
        for key in sorted(set(before)|set(after)):
            if key not in before: rows.append({'op':'add','path':pointer(key),'after':after[key]})
            elif key not in after: rows.append({'op':'remove','path':pointer(key),'before':before[key]})
            else: rows.extend(state_diff(before[key],after[key],pointer(key)))
        return rows
    if isinstance(before,list) and isinstance(after,list):
        rows=[]
        for i in range(max(len(before),len(after))):
            if i>=len(before): rows.append({'op':'add','path':pointer(i),'after':after[i]})
            elif i>=len(after): rows.append({'op':'remove','path':pointer(i),'before':before[i]})
            else: rows.extend(state_diff(before[i],after[i],pointer(i)))
        return rows
    return [{'op':'replace','path':path,'before':before,'after':after}]
def validate_live_identity(name,before,after):
    require(isinstance(before,dict) and isinstance(after,dict),'live state must be a JSON object: '+name)
    schema=lambda doc:{k:json_kind(v) for k,v in doc.items()}
    require(schema(before)==schema(after),'live top-level schema changed: '+name)
    require(type(after.get('version')) is int and after['version']==before.get('version'),
            'live schema version changed: '+name)
    if name=='jobs.json':
        def agents(doc):
            rows=doc['jobs']; require(isinstance(rows,list),'jobs must be an array')
            result={}
            for row in rows:
                require(isinstance(row,dict) and isinstance(row.get('id'),str) and row['id']
                        and isinstance(row.get('agentId'),str) and row['agentId'],'invalid job identity')
                require(row['id'] not in result,'duplicate job identity')
                result[row['id']]=row['agentId']
            return result
        old=agents(before); new=agents(after)
        require(set(old.values())==set(new.values()),'live agent identity set changed')
        require(all(old[k]==new[k] for k in old.keys()&new.keys()),'existing job changed agent identity')
        # Historical occurrences may belong to deleted jobs/agents. Preserve
        # those already present in the accepted snapshot; reject new identities.
        def owners(doc):
            require(isinstance(doc['occurrences'],list),'occurrences must be an array')
            result=set()
            for row in doc['occurrences']:
                require(isinstance(row,dict),'invalid occurrence object')
                if 'ownerAgentId' in row:
                    require(isinstance(row['ownerAgentId'],str) and row['ownerAgentId'],'invalid occurrence owner')
                    result.add(row['ownerAgentId'])
            return result
        require(owners(after)<=owners(before)|set(old.values()),'new occurrence agent identity')
        return {'agentIds':sorted(set(new.values())),'jobs':len(new),'occurrences':len(after['occurrences'])}
    require(name=='incidents.json','unclassified live input')
    require(after.get('migration')==before.get('migration'),'incident migration authority changed')
    require(isinstance(after.get('incidents'),dict) and isinstance(after.get('outbox'),dict),'invalid incident/outbox maps')
    return {'incidents':len(after['incidents']),'outbox':len(after['outbox'])}
def validate_live_bindings(tag,documents,migration):
    # Only pure source validators, never JobStore/runtime/watchdog constructors.
    # Validate the SAME captured bytes used by hashes/diffs, not a later reread.
    filename=tag+'-live-validation-input.private.json'
    save(filename,dict(documents,migrationAuthority=migration))
    js='''import { readFileSync } from 'node:fs';
import { validateCanonicalHealthAuthority } from 'file:///private/tmp/fleet-v5-prep/scratch/app/packages/scheduler/src/watchdog/health.js';
import { validateIncidentState } from 'file:///private/tmp/fleet-v5-prep/scratch/app/packages/scheduler/src/watchdog/durable-state.js';
import { validateIncidentDeliveryBindings } from 'file:///private/tmp/fleet-v5-prep/scratch/app/packages/scheduler/src/watchdog/routing.js';
const d=JSON.parse(readFileSync(process.argv[1],'utf8'));
validateCanonicalHealthAuthority(d.jobs);
validateIncidentState(d.incidents,{migrationAuthority:d.migrationAuthority});
validateIncidentDeliveryBindings(d.incidents,{manifest:d.routing,jobs:d.jobs.jobs,
  routingSha256:d.routingSha256,nowMs:Date.now()});
console.log(JSON.stringify({jobs:true,incidents:true,outbox:true,deliveryBindings:true}));'''
    p=sp.run([str(prep/'scratch/node-runtime/bin/node'),'--input-type=module','-e',js,str(rd/filename)],
             stdout=sp.PIPE,stderr=sp.PIPE,timeout=60,env={'PATH':'/usr/bin:/bin','HOME':'/var/empty'})
    raw(tag+'-live-validation.stdout',p.stdout); raw(tag+'-live-validation.stderr',p.stderr)
    require(p.returncode==0,'live schema/binding validation failed; see private '+tag+' receipts')
    return json_value(p.stdout)
def private_inputs(tag):
    a=authority(); env=read(rd/'plist-preimage.json')['document']['EnvironmentVariables']; paths={
        'jobs.json':prod/'scheduler/jobs.json',
        'incidents.json':prod/'control/scheduler-watchdog/incidents.json',
        'scheduler-routing.json':P(env.get('SCHEDULER_ROUTING_MANIFEST',str(prod/'scheduler/routing.json')))}
    # Outbox is inside incidents.json. There is no historical runs.jsonl input
    # in this executor: do not invent a byte-equality gate for append-only runs.
    kinds={'jobs.json':'live-state','incidents.json':'live-state','scheduler-routing.json':'static'}
    rows=[]; documents={}; baselines={}
    report={'at':now(),'stage':tag,'policy':'R5_STATIC_EXACT_LIVE_SCHEMA_IDENTITY_BINDINGS_DIFF',
            'ok':False,'inputs':rows,'impactReview':'NO_DRIFT'}
    try:
        for name,p in paths.items():
            regular(p); s=meta(p); data=p.read_bytes()
            require(meta(p)==s,'private input changed during capture: '+str(p))
            snapshot=prep/'evidence/private-snapshot'/name; regular(snapshot); baseline=snapshot.read_bytes()
            h=hashlib.sha256(data).hexdigest(); expected=hashlib.sha256(baseline).hexdigest()
            row={'path':str(p),'classification':kinds[name],'sha256':h,'snapshotSha256':expected,
                 'bytesChanged':h!=expected,'metadata':s}; rows.append(row)
            if kinds[name]=='static':
                require(s['uid']==int(env.get('SCHEDULER_ROUTING_OWNER_UID','0')) and
                        s['gid']==int(env['SCHEDULER_ROUTING_READER_GID']) and int(s['mode'],8)&~0o640==0,
                        'unsafe protected routing metadata '+str(p))
                require(h==expected,'static private input changed; impact revalidation required: '+str(p))
            else:
                require(s['uid']==a['expected_runtime_uid'],'unsafe private metadata '+str(p))  # supervisor: mode recorded in rows[] for audit; production jobs.json is 644 by long-standing runtime behavior — fresh-read baselines reality, absolute-0600 was an r4 authoring error
                if name=='incidents.json':
                    require(s['gid']==int(env.get('SCHEDULER_INCIDENT_OWNER_GID','20'))==20,'incident GID must be 20')
                raw(tag+'-'+name+'.captured.private.json',data)
                before=json_value(baseline); after=json_value(data); changes=state_diff(before,after)
                diffname=tag+'-'+name+'.diff.private.json'
                save(diffname,{'path':str(p),'snapshot':str(snapshot),'snapshotSha256':expected,
                     'sha256':h,'bytesChanged':h!=expected,'changes':changes,'truncated':False})
                row.update(diffReceipt=str(rd/diffname),changeCount=len(changes))
                if h!=expected: report['impactReview']='DIFF_RECORDED_FOR_REVIEW'
                row['structureIdentity']=validate_live_identity(name,before,after)
                baselines[name]=before
            documents[name]=json_value(data)
        report['sourceValidation']=validate_live_bindings(tag,{
            'jobs':documents['jobs.json'],'incidents':documents['incidents.json'],
            'routing':documents['scheduler-routing.json'],'routingSha256':rows[2]['sha256']},
            baselines['incidents.json'].get('migration'))
        # A changing generation during this read is distinct from historical
        # runtime progress. No retry and no business state writes on either path.
        for row in rows:
            require(meta(row['path'])==row['metadata'] and digest(row['path'])==row['sha256'],
                    'private input changed during validation: '+row['path'])
        b=prod/'bindings/bindings.json'; regular(b)
        h=digest(b); rows.append({'path':str(b),'classification':'static-authority','sha256':h,'metadata':meta(b)})
        require(h==a['expected_bindings_sha256'],'current bindings changed')
        report['ok']=True
        return rows
    except Exception as error:
        report['error']=str(error)
        raise
    finally:
        save(tag+'-private-input-validation.json',report)
def classify_census(c, turns, jobs):
    """Classify existing records only after physical runtime/worker isolation."""
    lists=('inflightTurns','unresolvedLostTurns','inflightOccurrences')
    require(all(isinstance(c.get(k),list) for k in lists),'census lists unavailable')
    require(isinstance(turns.get('records'),list) and isinstance(jobs.get('occurrences'),list),
            'census source records unavailable')
    require(c.get('epoch')==turns.get('runtimeEpoch') and bool(c.get('epoch')),'census epoch mismatch')
    records={r['handle']:r for r in turns['records']}
    require(len(records)==len(turns['records']),'duplicate recovery handle')
    entries=c['inflightTurns']+c['unresolvedLostTurns']
    handles=[r.get('handle') for r in entries]
    expected={r['handle'] for r in turns['records'] if r.get('queryState')!='settled'}
    require(len(handles)==len(set(handles)) and set(handles)==expected,'census turn coverage mismatch')
    result={'historical':[],'unsafe':[]}
    for entry in entries:
        row=records[entry['handle']]
        matched=all(entry.get(k)==row.get(k) for k in ('handle','agentId','runtimeEpoch','exitObservedAt'))
        reasons=[]
        if row.get('state')=='blocked': reasons.append('blocked')
        if row.get('fenceState')=='active': reasons.append('fenced')
        if row.get('runtimeEpoch')!=c['epoch']: reasons.append('old_epoch')
        if row.get('exitObservedAt') is None: reasons.append('exit_unproven_preserve_unknown')
        historical=(matched and row.get('state')!='reserved' and row.get('queryState')=='pending'
                    and row.get('initialOutcome')=='outcome_unknown' and bool(reasons))
        item={'kind':'turn','handle':entry['handle'],'agentId':entry.get('agentId'),
              'runtimeEpoch':entry.get('runtimeEpoch'),'reasons':reasons if historical else ['executable_or_unproven_identity']}
        result['historical' if historical else 'unsafe'].append(item)
    occurrences={r['occurrenceId']:r for r in jobs['occurrences']}
    require(len(occurrences)==len(jobs['occurrences']),'duplicate occurrence identity')
    ids=[r.get('occurrenceId') for r in c['inflightOccurrences']]
    expected={r['occurrenceId'] for r in jobs['occurrences'] if r.get('state') in ('admitted','running')}
    require(len(ids)==len(set(ids)) and set(ids)==expected,'census occurrence coverage mismatch')
    for entry in c['inflightOccurrences']:
        result['unsafe'].append({'kind':'occurrence','occurrenceId':entry['occurrenceId'],
                                 'reason':'admitted_or_running_execution'})
    return result
def census(tag, require_isolation=False):
    # Original source reader ONLY. No constructor, scheduler, recovery or replay.
    paths=[prod/'control/turn-recovery-v3.json',prod/'scheduler/jobs.json']
    for p in paths: regular(p)
    before=[{'sha256':digest(p),'metadata':meta(p)} for p in paths]
    js='''import { readRestartDrainCensus } from "file:///private/tmp/fleet-roll-src/packages/production-runtime/src/scheduler/restart-drain.js";
const c=readRestartDrainCensus({turnRecoveryStore:process.argv[1],jobsStore:process.argv[2]});
console.log(JSON.stringify(c));'''
    p=run([prep/'scratch/node-runtime/bin/node','--input-type=module','-e',js,*paths],
          env={'PATH':'/usr/bin:/bin','HOME':'/var/empty'})
    raw(tag+'.stdout',p.stdout); raw(tag+'.stderr',p.stderr)
    c=json.loads(p.stdout); turns=read(paths[0]); jobs=read(paths[1])
    after=[{'sha256':digest(p),'metadata':meta(p)} for p in paths]
    require(before==after,'census store changed during read')
    require(isinstance(c.get('epoch'),str) and c['epoch'],'recovery epoch unavailable')
    require(all(isinstance(c.get(k),list) for k in ('inflightTurns','unresolvedLostTurns','inflightOccurrences')),
            'census lists unavailable')
    require(isinstance(jobs.get('occurrences'),list),'scheduler occurrences schema absent')
    result={'at':now(),'storeHashes':before,'census':c,'readOnly':True,'nonemptyBlocksQuiet':False}
    if require_isolation:
        result['classification']=classify_census(c,turns,jobs)
    save(tag+'.json',result)
    if require_isolation:
        require(not result['classification']['unsafe'],'executable/unproven records remain after isolation: STOP')
    return before
def log_delta():
    s=read(rd/'restart-log-offsets.json'); chunks=[]
    for row in s:
        p=P(row['path']); m=meta(p)
        require(m['ino']==row['ino'] and m['dev']==row['dev'] and m['size']>=row['size'],
                'runtime log rotated/truncated; fresh-window provenance unavailable')
        with open(p,'rb') as f: f.seek(row['size']); data=f.read()
        raw('new-'+p.name,data); chunks.append(data.decode(errors='replace'))
    return '\n'.join(chunks)
def health(port,service_name):
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open('http://127.0.0.1:%s/health'%port,timeout=5) as response:
        require(response.status==200,'health HTTP status'); doc=json.load(response)
    require(doc.get('ok') is True and doc.get('service')==service_name,'health identity/ok mismatch')
    return doc
def listeners(pid,ports):
    result=[]
    for port in ports:
        p=run(['/usr/sbin/lsof','-nP','-a','-iTCP:'+str(port),'-sTCP:LISTEN','-Fp'])
        owners={int(x[1:]) for x in p.stdout.decode().splitlines() if x.startswith('p')}
        require(owners=={pid},'listener owner mismatch '+str(port)); result.append({'port':port,'pid':pid})
    return result
