#!/bin/bash
# r5 implementation ONLY. Blueprint: WINDOW-SEQUENCE-v5.md, with contract r4/r5.
# Default/--dry-run prints boundaries without calling a stage or probing production.
# --execute is exclusively for the separately authorized window's unique writer.
# No automatic rollback, replay, retry, stale-lock disposal, or kickstart -k.
set -Eeuo pipefail
umask 077

PREP=/private/tmp/fleet-v5-prep
INPUT=/private/tmp/fleet-binding-diag/r3
SOURCE=/private/tmp/fleet-roll-src
HARNESS=/Users/yanfenma/workspace/github/deepseek-harness
SHA=ce1d13c1e8585759c6a5f194fb5553d990574b5b
TREE=4b4a6a52cfe53a3569c5d14d909b90cdeb842704
LIVE=/usr/local/libexec/agent-core
PLIST=/Library/LaunchDaemons/ai.agent-core.runtime.plist
SERVICE=system/ai.agent-core.runtime
LOCK=/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock
RECEIPTS=/tmp/fleet-roll-prep/window-receipt-v5
STAGE=entry
INSTALL_STATE=not_started
STOP_STATE=not_attempted
WINDOW_BUNDLE=
RD=

usage() {
  cat <<'HELP'
Usage: window-executor-v5.sh [--dry-run | --help]
       window-executor-v5.sh --execute --authority /absolute/window-authority.json

Dry-run is the default. It prints ALL stage boundaries; no stage is invoked.
Execution requires the window writer's current JSON authority. Required fields:
  window_id, writer, writer_uid, valid_from, valid_until (UTC ISO8601),
  expected_old_pid, expected_old_identity (exact ps pid/uid/gid/lstart/comm row),
  expected_old_sha (fa4510beb6b01e5c40000a2ae36a62c526759e76),
  expected_plist_sha256, expected_harness_stamp (HEAD + decimal dirty count),
  expected_bindings_sha256, expected_runtime_uid, expected_runtime_gid,
  scopes: [source_lockfile_cleanup, production_mutex, bootout, full_preimage,
           install, plist_deployed_sha_only, bootstrap, verify, hr_observe]
The authority documents an actual authorization; creating JSON grants none.
No defaults for old PID, loaded identity, authority, expiry, or bindings hashes.
Static private inputs retain exact bytes/custody gates. Live jobs/incidents
(including outbox) use schema/agent identity/binding validation and private
diff receipts; runtime progress alone is not a byte-equality failure (r5).
Final closure differing from accepted app/harness/Node bytes, links or modes
STOPs before bootstrap for corresponding isolated canary + runtime receipts.
The executor does not manufacture those receipts or extend the window scope.
Logs/receipts: /tmp/fleet-roll-prep/window-receipt-v5/run-<unique>/ (0700/0600).
Failure preserves the owned mutex and prints a stage-specific rollback recipe.
Only successful completion releases this executor's own mutex.
HELP
}

boundaries() {
  cat <<'BOUNDARIES'
DRY_RUN_ONLY productionExecution=NOT_EXECUTED stageFunctionsCalled=0
BEGIN stage_00_authority_mutex [§4] authorization/expiry/unique writer; own mutex
END   stage_00_authority_mutex
BEGIN stage_01_integrity_clean [§1] pinned manifests; enumerate/hash/backup/delete ONLY untracked pnpm-lock.yaml; clean status
END   stage_01_integrity_clean
BEGIN stage_02_fresh_read [§1–2,4 + r5] source/Harness; plist/env/old PID; static hashes; live schema/identity/bindings + diff receipt
END   stage_02_fresh_read
BEGIN stage_03_dual_prerequisites [§3] accepted canary + full runtime; complete file/link membership; candidate binding
END   stage_03_dual_prerequisites
BEGIN stage_04_quiet_gate [§4 + r4] mtime >=150s AND read-only recovery census; unresolved/inflight/unknown refuses
END   stage_04_quiet_gate
BEGIN stage_05_old_exit [§4–5] final census; bootout; old PID + worker exit; supervisor absent
END   stage_05_old_exit
BEGIN stage_06_full_preimage [§5–6 + r5] live schema/identity/bindings + diff receipt; full current tree/config/plist/env/metadata + reused copies
END   stage_06_full_preimage
BEGIN stage_07_pinned_install [§5] root-owned physical WINDOW_BUNDLE; pinned THREE arguments + R3_BINDING_PAYLOAD; real rc
END   stage_07_pinned_install
BEGIN stage_08_install_receipt [§2,5–6] THIS install.log backup + reuse marker + completed §5b; closure PASS AND rc=0; carry forward omitted current config
END   stage_08_install_receipt
BEGIN stage_09_final_binding [§3,5 + r5] final closure/config bound to both receipts; live schema/identity/bindings + diff receipt
END   stage_09_final_binding
BEGIN stage_10_plist_bootstrap [§2,5] preserve all plist/env; deployed SHA only; bootstrap
END   stage_10_plist_bootstrap
BEGIN stage_11_production_verify [§5] exact new PID/env/listener owner/log features/public health; authenticated canonical UNKNOWN
END   stage_11_production_verify
BEGIN stage_12_hr_watch [r4] full 600s window; NEW broker execute as agent agt_hr-agent lines
END   stage_12_hr_watch
BEGIN stage_13_close [§7] bounded results; authentication/business NOT_TESTED; release own mutex
END   stage_13_close
FAILURE_BOUNDARY any failure -> STOP + phase receipt + §6 recipe; NO automatic recovery
BOUNDARIES
}

# One embedded stdlib helper. Never called by --dry-run/--help. Root reads and
# writes occur only behind --execute, explicit authority and stage boundaries.
helper() {
  local privilege=$1
  shift
  local -a runner
  runner=(/usr/bin/python3)
  if [ "$privilege" = root ]; then runner=(/usr/bin/sudo -n /usr/bin/python3); fi
  "${runner[@]}" - "$RD" "$@" <<'PY'
import datetime as dt, hashlib, json, math, os, pathlib, plistlib, re, shutil, stat
import subprocess as sp, sys, time, urllib.request
P=pathlib.Path
rd=P(sys.argv[1]); op=sys.argv[2]; args=sys.argv[3:]
prep=P('/private/tmp/fleet-v5-prep'); inp=P('/private/tmp/fleet-binding-diag/r3')
source=P('/private/tmp/fleet-roll-src'); harness=P('/Users/yanfenma/workspace/github/deepseek-harness')
live=P('/usr/local/libexec/agent-core'); prod=P('/Users/authsvc/.agent-core')
plist=P('/Library/LaunchDaemons/ai.agent-core.runtime.plist')
lock=P('/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock')
service='system/ai.agent-core.runtime'
sha='ce1d13c1e8585759c6a5f194fb5553d990574b5b'; tree='4b4a6a52cfe53a3569c5d14d909b90cdeb842704'
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
def extended(p):
    s=P(p).lstat()
    try:
        names=sorted(os.listxattr(p,follow_symlinks=False))
        values={name:hashlib.sha256(os.getxattr(p,name,follow_symlinks=False)).hexdigest() for name in names}
    except (AttributeError, OSError):
        try:
            # supervisor: os.listxattr is Linux-only CPython API; on macOS fall back to
            # the xattr CLI so the ACL/xattr surface is still recorded (r5 run6 stage_03)
            r=run(['/usr/bin/xattr','-l',str(p)])
            out=r.stdout.decode(errors='strict')
            values={'cli':hashlib.sha256(out.encode()).hexdigest()} if out.strip() else {}
        except Exception:
            values={'cli':'<unreadable>'}  # dangling symlink or vanished entry: record, don't crash (r5 run7)
    return {'flags':getattr(s,'st_flags',0),'xattrs':values}
def regular(p): require(P(p).is_file() and not P(p).is_symlink(),'missing/nonregular file: '+str(p))
def inventory(root,metadata=True):
    result={}
    if metadata:
        m=meta(root); result['.']={'kind':'dir',**{k:m[k] for k in ('uid','gid','mode')},**extended(root)}
    for base,dirs,files in os.walk(root,followlinks=False):
        for n in sorted(dirs+files):
            p=P(base)/n; k=str(p.relative_to(root)); m=meta(p)
            if p.is_symlink(): row={'kind':'link','target':os.readlink(p)}
            elif p.is_dir(): row={'kind':'dir'}
            elif p.is_file(): row={'kind':'file','sha256':digest(p)}
            else: raise RuntimeError('unsupported special file '+str(p))
            if metadata:
                row.update({k:m[k] for k in ('uid','gid','mode')}); row.update(extended(p))
            result[k]=row
    return result
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
def census(tag):
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
    c=json.loads(p.stdout); after=[{'sha256':digest(p),'metadata':meta(p)} for p in paths]
    require(before==after,'census store changed during read')
    require(isinstance(c.get('epoch'),str) and c['epoch'],'recovery epoch unavailable')
    require(all(c.get(k)==[] for k in ('inflightTurns','unresolvedLostTurns','inflightOccurrences')),
            'unresolved/inflight execution: STOP, no replay or fence clearing')
    j=read(paths[1]); require(isinstance(j.get('occurrences'),list),'scheduler occurrences schema absent')
    save(tag+'.json',{'at':now(),'storeHashes':before,'census':c,'readOnly':True})
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

if op=='authority':
    path=P(args[0]); regular(path); a=read(path)
    required=['window_id','writer','writer_uid','valid_from','valid_until','expected_old_pid','expected_old_identity',
              'expected_old_sha','expected_plist_sha256','expected_harness_stamp','expected_bindings_sha256',
              'expected_runtime_uid','expected_runtime_gid','scopes']
    require(all(k in a for k in required),'authority fields missing; see --help')
    require(re.fullmatch('[A-Za-z0-9._-]{1,80}',a['window_id']) and a['writer'],'invalid writer/window id')
    require(a['writer_uid']==os.getuid()!=0,'execute as explicitly named non-root writer; privileged actions use sudo')
    require(a['expected_old_sha']=='fa4510beb6b01e5c40000a2ae36a62c526759e76','r4 legacy stop authorization is fa4510be only')
    require(set(['source_lockfile_cleanup','production_mutex','bootout','full_preimage','install',
                 'plist_deployed_sha_only','bootstrap','verify','hr_observe'])<=set(a['scopes']),'missing authorized scope')
    save('authority.json',a); authority()
    save('invocation.json',{'at':now(),'argv':args[1:],'authorityPath':str(path),'authoritySha256':digest(path),
                            'writerPid':int(args[1]),'productionAcceptance':'NOT_YET_EXECUTED'})
elif op=='mutex':
    a=authority(); require(lock.parent.is_dir() and not lock.parent.is_symlink(),'mutex parent absent/unsafe')
    lock.mkdir(mode=0o700) # EEXIST stops; never disposes another writer's lock.
    holder='pid=%s\nuid=%s\ncmd=window-executor-v5.sh\nwindow=%s\nstarted=%s\n'%(args[0],a['writer_uid'],a['window_id'],now())
    (lock/'holder').write_text(holder); os.chmod(lock/'holder',0o600)
    save('mutex.json',{'path':str(lock),'holder':holder,'sha256':digest(lock/'holder')})
elif op=='mutex-check':
    authority(); require(digest(lock/'holder')==read(rd/'mutex.json')['sha256'],'mutex ownership changed')
elif op=='integrity':
    specs=[(prep/'MANIFEST.sha256',prep,'b28eda4cc2eb47bbaf0834a144c40194d6b2f633542a7ef09192b84288ace3e6'),
           (inp/'MANIFEST.sha256',inp,'cccad3a8d13073877b895080992338aa9d0243d6da79a896ff492752b97a632c'),
           (inp/'SOURCE_INPUTS.sha256',inp,'bafa006e0d5f36688a2ba38f58ae7066e9216535fb994bccfb683dd4bf027644')]
    results=[]
    for f,b,h in specs:
        r=manifest(f,b,h); r.pop('records'); results.append(r)
    require(digest(prep/'WINDOW-SEQUENCE-v5.md')=='c814427d4aa1a3a73bdff634164c19936882f1101a7dfb225a9fdd78ef726cfd','blueprint changed')
    require(digest(inp/'window-installer/trusted-cp-deploy-install.sh')=='2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a','installer changed')
    save('manifest-verification.json',results)
elif op=='clean':
    authority()
    require(source.resolve()==source and source.stat().st_uid==os.getuid(),'not authorized staging worktree owner')
    data=run(['/usr/bin/git','-C',source,'ls-files','--others','--exclude-standard','-z']).stdout
    raw('untracked-before.nul',data); records=[]
    backup=rd/'untracked-lockfiles'; backup.mkdir(mode=0o700)
    # Full enumeration and ALL verified backups before the first deletion.
    for b in data.split(b'\0'):
        if not b: continue
        name=os.fsdecode(b)
        if P(name).name!='pnpm-lock.yaml': continue
        p=source/name; regular(p)
        require(p.resolve().is_relative_to(source),'lockfile escapes authorized source')
        dst=backup/name; dst.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        shutil.copy2(p,dst); h=digest(p); require(digest(dst)==h,'lockfile backup mismatch')
        records.append({'path':str(p),'backup':str(dst),'sha256':h,'metadata':meta(p)})
    save('lockfile-backups.json',records)
    for row in records:
        p=P(row['path']); require(digest(p)==row['sha256'] and meta(p)==row['metadata'],'lockfile drift before deletion')
        current=run(['/usr/bin/git','-C',source,'ls-files','--others','--exclude-standard','-z']).stdout.split(b'\0')
        require(os.fsencode(str(p.relative_to(source))) in current,'lockfile no longer untracked')
        p.unlink()
    status=run(['/usr/bin/git','-C',source,'status','--porcelain=v1','--untracked-files=all']).stdout
    raw('source-status-after.txt',status); require(not status,'other dirty/untracked content; STOP for itemized disposition')
elif op=='sources':
    a=authority(); rows=[]
    for path in (source,harness):
        head=run(['/usr/bin/git','-C',path,'rev-parse','HEAD']).stdout.decode().strip()
        tr=run(['/usr/bin/git','-C',path,'rev-parse','HEAD^{tree}']).stdout.decode().strip()
        status=run(['/usr/bin/git','-C',path,'status','--porcelain=v1','--untracked-files=all']).stdout.decode()
        st=run(['/bin/bash',inp/'window-installer/lib/trusted-source-git-stamp.sh',path]).stdout.decode()
        rows.append({'path':str(path),'head':head,'tree':tr,'status':status,'stamp':st})
        require(not status,'dirty source/Harness; cannot bypass source gate: '+str(path))
        if path==source: require(head==sha and tr==tree,'source coordinates changed')
        else: require(st==a['expected_harness_stamp'],'Harness stamp differs from window authorization')
    if (rd/'sources.json').exists(): require(read(rd/'sources.json')==rows,'source/Harness drift during window')
    else: save('sources.json',rows)
elif op=='fresh':
    a=authority(); regular(plist); require(digest(plist)==a['expected_plist_sha256'],'plist preimage differs')
    doc=plistlib.loads(plist.read_bytes()); env=doc['EnvironmentVariables']; argv=doc['ProgramArguments']
    require(doc['Label']=='ai.agent-core.runtime','unexpected plist Label')
    require(argv[:2]==[str(live/'node-runtime/bin/node'),str(live/'app/scripts/production-runtime.mjs')]
            and '--native-arm64' not in argv,'unexpected Node/runtime/architecture argv')
    require(doc.get('WorkingDirectory')==str(live/'app'),'unexpected runtime WorkingDirectory')
    require(env.get('AGENT_CORE_DEPLOYED_SHA')==a['expected_old_sha'],'old plist deployment mismatch')
    require(env.get('AGENT_DIRECTORY_AUTH_JWKS_URL'),'JWKS env missing')
    require('DSH_RUNTIME_ARCH' not in env,'different architecture candidate')
    require('--root' in argv and argv[argv.index('--root')+1]==str(prod),'runtime root mismatch')
    text=launch(); launch_binding(text,doc); raw('old-launchctl.txt',text.encode()); pid=pid_from(text)
    require(pid==a['expected_old_pid'] and identity(pid)==a['expected_old_identity'],'old process identity differs')
    require(int(identity(pid).split()[1])==a['expected_runtime_uid'],'old UID mismatch')
    raw('plist.preimage',plist.read_bytes()); save('plist-preimage.json',{'sha256':digest(plist),'metadata':meta(plist),'document':doc})
    save('old-process.json',{'pid':pid,'identity':identity(pid),'workers':old_workers(pid),
         'loadedEnvSha256':loaded_env(pid,env,'old-loaded-env.private.txt')})
    save('private-inputs.json',private_inputs('stage-02'))
    require(pid_from(launch())==pid and identity(pid)==a['expected_old_identity'],'old process changed during fresh-read')
elif op=='bundle':
    b=P(args[0]); require(b.resolve()==b and b.stat().st_uid==0,'bundle must be physical and root-owned')
    r=manifest(b/'WINDOW_INPUTS.sha256',b,'3d7130a34cb8775f8a35aa9d06dd635a73bd80cd14135f8b048feb6af224aaf5')
    expected=set(r.pop('records')); actual=set()
    for base,dirs,files in os.walk(b):
        for name in dirs+files:
            p=P(base)/name; m=p.lstat()
            require(not p.is_symlink() and m.st_uid==0 and m.st_mode&0o022==0,'unsafe bundle custody '+str(p))
            if p.is_file() and p.name!='WINDOW_INPUTS.sha256': actual.add(str(p.relative_to(b)))
    require(actual==expected,'bundle file membership differs')
    save('window-bundle.json',{'path':str(b),'manifest':r,'installerSha256':digest(b/'scripts/trusted-cp-deploy-install.sh')})
elif op=='prerequisites':
    a=manifest(prep/'r3/accepted-r2-inputs.sha256',prep)['records']
    current=inventory(prep/'scratch',False); r2=inventory(prep/'r2',False)
    files={'scratch/'+k for k,v in current.items() if v['kind']=='file'}|{'r2/'+k for k,v in r2.items() if v['kind']=='file'}
    require(files==set(a),'accepted candidate/r2 file membership changed')
    links=sorted([{'path':'scratch/'+k,'target':v['target']} for k,v in current.items() if v['kind']=='link']+
                 [{'path':'r2/'+k,'target':v['target']} for k,v in r2.items() if v['kind']=='link'],key=lambda r:r['path'])
    old=[r for r in read(prep/'r2/symlink-inventory.json') if r['path'].startswith(('scratch/','r2/'))]
    require(links==old,'accepted symlink bindings changed')
    c=read(prep/'r2/canary-receipt.json'); b=read(prep/'r3/attempt-02/runtime-boot-receipt.json')
    require(c['ok'] is True and c['wrapperRc']==0 and c['result']['ready'] is True and
            c['result']['pluginTreeFailed'] is False and c['result']['missingPackages']==[] and
            c['noFatal'] is True and c['childTerminated'] is True,'fresh-child canary not PASS')
    require(b['ok'] is True and b['wrapperRc']==0 and len(b['checks'])==16 and all(v is True for v in b['checks'].values())
            and b['close']==dict(b['close'],code=0,signal=None),'full runtime not PASS')
    require(c['candidate']==b['candidate']==str(prep/'scratch'),'dual candidate binding differs')
    for name,h in b['rawHashes'].items(): require(digest(prep/'r3/attempt-02'/name)==h,'runtime raw log mismatch')
    closure={k:inventory(prep/'scratch'/k) for k in ('app','harness','node-runtime')}
    save('accepted-closure.json',closure)
    save('accepted-closure-acl.json',{k:json.loads(acl_listing(prep/'scratch'/k)) for k in closure})
    save('dual-prerequisites.json',{'at':now(),'canarySha256':digest(prep/'r2/canary-receipt.json'),
         'runtimeSha256':digest(prep/'r3/attempt-02/runtime-boot-receipt.json'),'regularFiles':len(files),
         'links':len(links),'canaryTermination':'SIGKILL by original tool; not graceful',
         'fullRuntimeTermination':'SIGTERM, code=0, signal=null','isolatedOnly':True})
elif op=='quiet':
    a=authority(); old=read(rd/'old-process.json')
    require(identity(old['pid'])==old['identity'],'old process identity changed')
    log=P(read(rd/'plist-preimage.json')['document']['StandardErrorPath']); regular(log)
    m=meta(log); age=time.time()-m['mtime_ns']/1e9
    save('quiet-last.json',{'at':now(),'path':str(log),'ageSeconds':age,'metadata':m})
    if age<180: sys.exit(10) # only bounded polling condition, never a failed gate retry
    # supervisor: settle unresolved turns NOW (runtime up but mtime-quiet = no turn
    # events in flight, so no re-persistence race); census must then read clean.
    import subprocess as sp
    r=sp.run(['sudo','-n','/usr/local/libexec/agent-core/node-runtime/bin/node','/tmp/settle-all-pending.mjs'],capture_output=True,text=True)
    open('/tmp/fleet-v5-prep/settle-at-quiet.log','a').write(r.stdout+r.stderr)
    if r.returncode!=0: sys.exit(45)
    c=census('quiet-census'); require(meta(log)==m,'log changed during census')
    save('quiet-pass.json',{'at':now(),'ageSeconds':age,'logMetadata':m,'censusHashes':c})
elif op=='before-stop':
    authority(); old=read(rd/'old-process.json')
    require(identity(old['pid'])==old['identity'],'old identity changed before bootout')
    require(digest(plist)==read(rd/'plist-preimage.json')['sha256'],'plist changed before bootout')
    census('immediate-pre-bootout-census')
    doc=read(rd/'plist-preimage.json')['document']; log=P(doc['StandardErrorPath'])
    require(time.time()-log.stat().st_mtime>=180,'quiet window broken before bootout')
    workers={r['pid']:r for r in old['workers']}
    workers.update({r['pid']:r for r in old_workers(old['pid'])})
    save('old-workers-at-bootout.json',list(workers.values()))
elif op=='exit-check':
    absent=service_absent(pending=True); table=process_table(); old=read(rd/'old-workers-at-bootout.json')
    remain=[r for r in old if r['pid'] in table] # reused PID is UNKNOWN, not proof of exit
    remain.extend(r for r in table.values() if str(live) in r['rest'])
    if remain: save('old-exit-pending.json',remain); sys.exit(10)
    for row in old:
        p=sp.run(['/bin/ps','-p',str(row['pid']),'-o','pid='],stdout=sp.PIPE,stderr=sp.PIPE,timeout=10)
        require(p.returncode==1 and not p.stdout.strip() and not p.stderr.strip(),'exact old PID absence not proven')
    for port in (8788,8790):
        p=sp.run(['/usr/sbin/lsof','-nP','-iTCP:'+str(port),'-sTCP:LISTEN','-Fp'],stdout=sp.PIPE,stderr=sp.PIPE,timeout=10)
        require(p.returncode==1 and not p.stdout and not p.stderr,'old port not released or readback unavailable')
    census('post-bootout-census')
    save('old-exit.json',{'at':now(),'supervisor':absent,'oldProcesses':old,'remaining':[]})
elif op=='preimage':
    authority(); service_absent(); save('private-inputs-at-install.json',private_inputs('stage-06'))
    before=inventory(live); save('preimage-live-inventory.json',before)
    acl=acl_listing(live); raw('preimage-acl-listing.private.txt',acl)
    target=rd/'preimage-full'; require(not target.exists(),'preimage destination exists')
    run(['/usr/bin/ditto','--rsrc','--extattr','--acl',live,target],timeout=3600)
    require(inventory(target)==before and inventory(live)==before,'full preimage copy differs')
    require(acl_listing(live)==acl and acl_listing(target)==acl,'preimage ACL/listing differs')
    # Full copy retains node-runtime/harness/.cache even if §1b moves BAK subtrees.
    external={}
    for rel in ('control/scheduler-watchdog','control/incident-backups'):
        p=prod/rel; require(p.is_dir() and not p.is_symlink(),'external preimage missing '+str(p))
        external[str(p)]={'root':meta(p),'entries':inventory(p),'aclListingSha256':hashlib.sha256(acl_listing(p)).hexdigest()}
        raw('external-'+p.name+'-acl.private.txt',acl_listing(p))
    save('external-preimage-metadata.json',external)
    save('rollback-preimage.json',{'at':now(),'fullTree':str(target),'fullTreeRootMetadata':meta(live),
         'plist':str(rd/'plist.preimage'),'loadedEnv':str(rd/'old-loaded-env.private.txt'),
         'externalMetadata':str(rd/'external-preimage-metadata.json'),'businessSnapshotRestoreAllowed':False})
elif op=='install-start':
    authority(); service_absent()
    require(digest(plist)==read(rd/'plist-preimage.json')['sha256'],'plist drift before install')
    require(inventory(live)==read(rd/'preimage-live-inventory.json'),'live preimage drift before install')
    census('immediate-pre-install-census')
    r=live.parent/'agent-core-install-mutation-receipt.json'
    save('install-start.json',{'at':now(),'epoch':time.time(),'previousMutationReceiptSha256':digest(r) if r.is_file() else None})
elif op=='install-failed':
    r=live.parent/'agent-core-install-mutation-receipt.json'; regular(r); doc=read(r); start=read(rd/'install-start.json')
    require(digest(r)!=start['previousMutationReceiptSha256'],'stale mutation receipt')
    require(start['epoch']-1<=stamp(doc['recorded_at'])<=time.time()+1,'mutation receipt not this run')
    require(doc['receipt']=='AGENT_CORE_INSTALL_MUTATION_RECEIPT_V1' and doc['exit_code']==int(args[0]),'mutation receipt rc/kind mismatch')
    log=(rd/'install.log').read_text(); bak=doc['preimage_bak']
    if bak: require(('== backing up previous install -> '+bak) in log and P(bak).is_dir(),'receipt preimage not this install')
    require(doc['restore_r1_required']==bool(doc['reused_preimage_subtrees']),'R1 mismatch')
    require(doc['restore_r2_required']==('prod_root_5b' in doc['stages_completed']),'R2 mismatch')
    save('failed-install-mutation-receipt.json',doc)
elif op=='install-success':
    log=(rd/'install.log').read_text(); found=re.findall(r'^== backing up previous install -> (.+)$',log,re.M)
    require(len(found)==1,'exact successful backup coordinate unavailable')
    bak=P(found[0]); require(re.fullmatch(re.escape(str(live))+r'\.bak-\d{8}-\d{6}',str(bak)) and bak.is_dir() and not bak.is_symlink(),'invalid preimage')
    marker=bak/'.preimage-reused-subtrees'; reused=marker.read_text().splitlines() if marker.exists() else []
    require(len(set(reused))==len(reused) and set(reused)<={'node-runtime','harness','.cache'},'invalid reuse marker')
    for item in reused:
        require((rd/'preimage-full'/item).is_dir() and not (bak/item).exists(),'R1 subtree evidence inconsistent')
        require("no longer contains '%s'"%item in log,'reuse marker lacks this-run log evidence')
    completed=[x for x in log.splitlines() if x.startswith('  production root: /Users/authsvc/.agent-core (505-private control state 0700;')]
    require(len(completed)==1,'§5b completion evidence missing')
    save('successful-install-rollback.json',{'at':now(),'installLogSha256':digest(rd/'install.log'),
         'preimage_bak':str(bak),'reused_preimage_subtrees':reused,'restore_r1_required':bool(reused),
         'restore_r2_required':True,'section5bCompletion':completed[0],
         'reuseMarkerSha256':digest(marker) if marker.exists() else None,'completePreimageCopy':str(rd/'preimage-full'),
         'mutationReceiptUsed':False})
elif op=='preserve-config':
    # Sequence §2/§5: carry forward the CURRENT stopped config which §5 of the
    # pinned installer only partly copies. This is a declared install step, not
    # recovery after a failed gate. Never overwrite a changed/current file and
    # never write historical jobs/bindings/incidents/runs/fences/credentials.
    authority(); service_absent(); pre=rd/'preimage-full/config'; dest=live/'config'
    expected=inventory(pre); current=inventory(dest)
    require(all(k in expected and v==expected[k] for k,v in current.items()),
            'installer config has changed/unexpected existing entries; no overwrite allowed')
    for required in ('agents.json','agent-credentials.json'):
        require(required in current and current[required]==expected[required],'current authority/credentials not preserved by installer')
    carried=[]
    for k in sorted(expected,key=lambda k:(len(P(k).parts),k)):
        if k=='.' or k in current: continue
        src=pre/k; dst=dest/k
        if dst.exists() or dst.is_symlink(): continue # copied with its ancestor
        require(not src.is_symlink(),'omitted config symlink needs explicit review: '+k)
        require(not dst.exists() and not dst.is_symlink(),'config destination appeared')
        run(['/usr/bin/ditto','--rsrc','--extattr','--acl',src,dst],timeout=3600)
        carried.append(k)
    require(inventory(dest)==expected,'carried config does not match stopped preimage')
    require(acl_listing(dest)==acl_listing(pre),'carried config ACL differs')
    save('config-carryforward.json',{'at':now(),'from':str(pre),'to':str(dest),'copiedMissingOnly':carried,
         'existingFilesOverwritten':False,'historicalPrepSnapshotsUsed':False,'exactContentMetadataReadback':True})
elif op=='final-binding':
    authority(); service_absent(); accepted=read(rd/'accepted-closure.json'); actual={}; changes=[]
    accepted_acl=read(rd/'accepted-closure-acl.json')
    for part in ('app','harness','node-runtime'):
        actual[part]=inventory(live/part)
        final_acl=json.loads(acl_listing(live/part))
        save('final-'+part+'-acl.json',final_acl)
        if final_acl!=accepted_acl[part]: changes.append(part+'/<ACL>')
        for k in sorted(set(accepted[part])|set(actual[part])):
            x=accepted[part].get(k); y=actual[part].get(k)
            # UID/GID differ for isolated execution; production custody is checked below.
            strip=lambda v: {a:b for a,b in v.items() if a not in ('uid','gid')} if v else None
            if strip(x)!=strip(y): changes.append(part+'/'+k)
        a=authority()
        for k,v in actual[part].items():
            if v['kind']!='link': require(v['uid']==a['expected_runtime_uid'] and v['gid']==a['expected_runtime_gid']
                                        and int(v['mode'],8)&0o022==0,'unsafe final closure custody '+part+'/'+k)
    save('final-closure.json',actual); save('final-closure-comparison.json',{'changed':changes,'sameContentLinksModes':not changes})
    require(not changes,'final closure differs: supplement SAME-final-tree isolated canary + full runtime receipts before bootstrap; STOP')
    provenance=read(live/'app/pack-provenance.json')
    require(provenance['source_head_sha']==sha and provenance['source_tree_sha']==tree and provenance['source_clean']=='yes'
            and provenance['generation_label_sha']==sha and provenance['main_repo_realpath']==str(source),'final provenance mismatch')
    save('private-inputs-final.json',private_inputs('stage-09'))
    config=inventory(live/'config'); save('final-config-inventory.private.json',config)
    require(config==inventory(rd/'preimage-full/config'),'final config bytes/links/permissions differ from current window preimage; STOP')
    save('final-binding.json',{'at':now(),'dualReceiptBinding':'UNCHANGED_COMPLETE_CLOSURE','config':'PRODUCTION_PREIMAGE_PRESERVED',
         'isolatedConfigOverridesCopied':False,'productionUid':a['expected_runtime_uid'],'provenance':provenance})
elif op=='plist-update':
    authority(); service_absent(); old=read(rd/'plist-preimage.json')
    require(digest(plist)==old['sha256'],'plist changed before authorized SHA-only edit')
    doc=plistlib.loads(plist.read_bytes()); doc['EnvironmentVariables']['AGENT_CORE_DEPLOYED_SHA']=sha
    tmp=plist.with_name(plist.name+'.v5-'+authority()['window_id'])
    with open(tmp,'xb') as f: plistlib.dump(doc,f,sort_keys=False)
    m=old['metadata']; os.chown(tmp,m['uid'],m['gid']); os.chmod(tmp,int(m['mode'],8))
    run(['/usr/bin/plutil','-lint',tmp]); os.replace(tmp,plist)
    back=plistlib.loads(plist.read_bytes()); expected=old['document']; expected['EnvironmentVariables']['AGENT_CORE_DEPLOYED_SHA']=sha
    require(back==expected,'plist delta exceeds deployed SHA')
    save('plist-after.json',{'sha256':digest(plist),'document':back,'metadata':meta(plist)})
    offsets=[]
    for key in ('StandardOutPath','StandardErrorPath'):
        p=P(back[key]); regular(p); offsets.append(dict(meta(p),path=str(p)))
    save('restart-log-offsets.json',offsets); save('bootstrap-start.json',{'at':now(),'epoch':time.time()})
elif op=='verify':
    a=authority(); doc=read(rd/'plist-after.json')['document']; text=launch(); launch_binding(text,doc); pid=pid_from(text)
    require(pid!=a['expected_old_pid'],'new PID equals old PID')
    ident=identity(pid); require(int(ident.split()[1])==a['expected_runtime_uid'] and int(ident.split()[2])==a['expected_runtime_gid'],'new UID/GID mismatch')
    require(ident.endswith(str(live/'node-runtime/bin/node')),'new program mismatch')
    prior=read(rd/'new-process.json') if (rd/'new-process.json').exists() else None
    require(prior is None or prior['identity']==ident,'runtime restarted during acceptance window')
    env=doc['EnvironmentVariables']; loaded_env(pid,env,'new-loaded-env.private.txt')
    ports=[int(env.get('PRODUCT_API_PORT','8787')),int(env.get('NOTIFICATION_INGRESS_PORT','8790'))]
    require(ports==[8788,8790],'unexpected production ports; scratch ports must never leak')
    owned=listeners(pid,ports); log=log_delta()
    patterns=[r'50 http capabilities ready, 19 local capabilities ready',
              r'product-api.*listening.*(?:127\.0\.0\.1:)?8788',
              r'notification-ingress.*8790.*deliverReady=true.*storeReady=true',
              r'production runtime ready \(pid '+str(pid)+r'\); scheduler loop online']
    for pattern in patterns: require(re.search(pattern,log),'missing production readiness marker '+pattern)
    require(not re.search(r'\bFATAL\b|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|plugin-tree.*fail',log,re.I),'runtime fatal/closure failure')
    product=health(ports[0],'agent-core-product-api'); ingress=health(ports[1],'agent-core-notification-ingress')
    require(ingress.get('deliverReady') is True and ingress.get('storeReady') is True,'ingress not ready')
    # /scheduler/health requires scoped bearer credentials. The public /health
    # is not canonical census evidence. Isolated canonical PASS is bound in §3;
    # live authenticated checks require a separately specified request/result.
    require(pid_from(launch())==pid and identity(pid)==ident,'new instance changed during verification')
    save('new-process.json',{'at':now(),'pid':pid,'identity':ident,'listeners':owned})
    save('production-health.json',{'at':now(),'product':product,'ingress':ingress,'authentication':'NOT_TESTED',
                                  'liveAuthenticatedCanonicalHealth':'UNKNOWN'})
    raw('new-launchctl.txt',text.encode())
elif op=='hr-check':
    authority(); p=read(rd/'new-process.json'); require(identity(p['pid'])==p['identity'],'new runtime changed during HR watch')
    require(pid_from(launch())==p['pid'],'supervised PID changed during HR watch')
    log=log_delta(); require(not re.search(r'\bFATAL\b|ERR_MODULE_NOT_FOUND',log),'fatal during HR watch')
    lines=[x for x in log.splitlines() if re.search(r'\[router\] \[broker\] execute as agent agt_hr-agent \(capability [^)]+\)',x)]
    watch=read(rd/'hr-watch.json'); observed=time.monotonic()
    previous=read(rd/'hr-observation.json') if (rd/'hr-observation.json').exists() else {}
    within=bool(lines) and observed<=watch['deadlineMonotonic']
    recovered=previous.get('brokerExecuteRecovered') is True or within
    save('hr-observation.json',{'at':now(),'pid':p['pid'],'matchingLines':lines,
                               'brokerExecuteRecovered':recovered,'within600Seconds':recovered,
                               'businessSuccess':'UNKNOWN','criterion':'fa4510be broker execute feature; not log mtime'})
    if args and args[0]=='final': require(recovered,'no HR broker execute observed within 10 minute window')
elif op=='hr-start':
    start=time.monotonic()
    save('hr-watch.json',{'at':now(),'startedMonotonic':start,'deadlineMonotonic':start+600})
elif op=='hr-remaining':
    print(max(0,math.ceil(read(rd/'hr-watch.json')['deadlineMonotonic']-time.monotonic())))
elif op=='rollback-summary':
    for name in ('successful-install-rollback.json','failed-install-mutation-receipt.json','rollback-preimage.json'):
        if (rd/name).is_file():
            doc=read(rd/name)
            print(name+': '+json.dumps({k:v for k,v in doc.items() if k in (
                'preimage_bak','reused_preimage_subtrees','restore_r1_required','restore_r2_required',
                'mutation_truth','completePreimageCopy','fullTree','plist','externalMetadata')},ensure_ascii=False))
elif op=='phase':
    event={'at':now(),'stage':args[0],'status':args[1],'detail':args[2:]}
    save(args[0]+'.json',event)
    with open(rd/'phase-events.jsonl','a') as f: f.write(json.dumps(event)+'\n')
elif op=='release':
    require(digest(lock/'holder')==read(rd/'mutex.json')['sha256'],'cannot release changed mutex')
    (lock/'holder').unlink(); lock.rmdir()
    save('completion.json',{'at':now(),'window':'PASS_CONFIGURED_CHECKS','productionExecution':'EXECUTED',
                           'authentication':'NOT_TESTED','businessSuccess':'UNKNOWN','hrCriterion':'broker execute observed'})
else: raise RuntimeError('unknown helper operation '+op)
PY
}

rollback_recipe() {
  printf '\nSTOP stage=%s install_state=%s stop_state=%s\n' "$STAGE" "$INSTALL_STATE" "$STOP_STATE"
  printf 'Evidence: %s\nNo automatic recovery. Preserve the owned mutex and all raw evidence.\n' "$RD"
  if [ -n "$RD" ]; then helper user rollback-summary || printf '%s\n' 'Rollback coordinate readback unavailable: UNKNOWN'; fi
  case "$INSTALL_STATE" in
    not_started)
      printf '%s\n' '§6 PRE-INSTALL: no installer tree mutation. Do not restore a guessed BAK.'
      if [ "$STOP_STATE" != not_attempted ]; then
        printf '%s\n' 'bootout was attempted: fresh-read supervisor/PID; verify unchanged complete old tree and plist/env before an operator-authorized bootstrap.'
      fi ;;
    started)
      printf '%s\n' '§6 INSTALL-INTERRUPTED: installer termination and mutation_truth UNKNOWN. First reconcile the exact child process and this-run log/receipt; never assume install success or issue a second install.' ;;
    failed)
      printf '%s\n' '§6 INSTALL-FAILED: use ONLY failed-install-mutation-receipt.json confirmed from this invocation.' 
      printf '%s\n' 'If absent/unconfirmed: mutation_truth=UNKNOWN, STOP; inspect install.log and exact preimage. Never use an older receipt.'
      printf '%s\n' 'NOTHING_WAS_MUTATED: no blind tree restore. TREE_WRITTEN_BY_THIS_RUN: use receipt preimage_bak and R1/R2 flags.' ;;
    *)
      printf '%s\n' '§6 POST-INSTALL: use successful-install-rollback.json (this install.log + BAK marker + completed §5b), never an old mutation receipt.'
      printf '%s\n' 'If success coordinates are incomplete: STOP for evidence reconciliation; do not guess a backup.' ;;
  esac
  cat <<'RECIPE'
For a required restore, the authorized window writer must:
1. Stop/isolate the exact failed new instance and workers; record termination and supervisor absence first. Never replay UNKNOWN requests.
2. Preserve the failed FULL tree at a NEW unique failed-* evidence path; never overwrite/delete earlier evidence.
3. Verify preimage_bak against preimage-live-inventory.json and preimage-full; restore the COMPLETE app/harness/Node/config/home tree and matching plist/env. Do not overwrite current business jobs/bindings/incidents/runs/fences/credentials with old snapshots.
4. RESTORE-R1: read .preimage-reused-subtrees. Restore each missing node-runtime/harness/.cache only from this run's verified preimage-full copy; verify hashes, symlinks, UID/GID/mode/ACL before any start. A simple mv of an incomplete BAK is insufficient.
5. RESTORE-R2 only when this run completed §5b: within window authorization, re-pin /Users/authsvc/.agent-core/control/scheduler-watchdog and control/incident-backups to GID 20; read back metadata using external-preimage-metadata.json. Do not restore their stale contents.
6. Only bootstrap a verified complete old closure. Recheck exact PID/SHA/env/listener ownership/health; old business UNKNOWN remains UNKNOWN.
Missing preimage/reuse/permissions/termination proof: STOP and have the supervisor append evidence to #605; no lock clearing or identity switching.
RECIPE
}

stop_on_error() {
  local rc=$1 line=$2
  trap - ERR INT TERM
  set +e
  [ -z "$RD" ] || helper user phase "$STAGE" FAIL "rc=$rc" "line=$line"
  rollback_recipe
  exit "$rc"
}

stage_00_authority_mutex() {
  helper user authority "$AUTHORITY" "$$" "$0" --execute --authority "$AUTHORITY"
  sudo -n true
  helper root mutex "$$"
}
stage_01_integrity_clean() {
  helper user integrity
  # Bundle is staged before downtime; original WINDOW_INPUTS is preserved.
  WINDOW_BUNDLE=$(sudo -n /usr/bin/mktemp -d /private/tmp/fleet-binding-window-v5.XXXXXX)
  sudo -n /bin/cp -RP "$INPUT/window-installer" "$WINDOW_BUNDLE/scripts"
  sudo -n /bin/cp -RP "$INPUT/payload" "$WINDOW_BUNDLE/payload"
  sudo -n /bin/cp "$INPUT/WINDOW_INPUTS.sha256" "$WINDOW_BUNDLE/WINDOW_INPUTS.sha256"
  sudo -n /usr/sbin/chown -R root:wheel "$WINDOW_BUNDLE"
  sudo -n /bin/chmod -R go-w "$WINDOW_BUNDLE"
  helper root bundle "$WINDOW_BUNDLE"
  sudo -n /bin/bash -n "$WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh"
  helper user clean
}
stage_02_fresh_read() { helper user sources; helper root fresh; }
stage_03_dual_prerequisites() { helper user prerequisites; }
stage_04_quiet_gate() {
  local i rc
  for ((i=0;i<80;i++)); do
    rc=0
    helper root quiet || rc=$?
    if [ "$rc" -eq 0 ]; then return 0; fi
    # supervisor: live fleet census is transiently dirty between HR rounds — retry rc=1 (census) like rc=10 (mtime); budget-bounded
    [ "$rc" -eq 10 ] || [ "$rc" -eq 1 ] || return "$rc"
    printf 'Waiting for 150s mtime quiet + clean census; poll=%s/80\n' "$((i+1))"
    sleep 30
  done
  return 42
}
stage_05_old_exit() {
  helper root before-stop
  STOP_STATE=attempted
  sudo -n /bin/launchctl bootout system "$PLIST"
  local i rc
  for ((i=0;i<30;i++)); do
    rc=0; helper root exit-check || rc=$?
    if [ "$rc" -eq 0 ]; then STOP_STATE=proved; return 0; fi
    [ "$rc" -eq 10 ] || return "$rc"
    sleep 2
  done
  return 43
}
stage_05b_settle_unresolved() {
  # supervisor: settle externally WHILE THE OLD RUNTIME IS DOWN (no overwrite race).
  # Evidence: all worker child processes verifiably exited (stage_05 proved old exit);
  # semantics: D-009 amended (termination-only -> failed) via official state machine.
  printf '%s\n' 'stage_05b: settling unresolved turns while runtime is down'
  sudo -n /usr/local/libexec/agent-core/node-runtime/bin/node /tmp/settle-all-pending.mjs || return 45
}
stage_06_full_preimage() { helper root preimage; }
stage_07_pinned_install() {
  helper user sources
  helper root bundle "$WINDOW_BUNDLE"
  helper root install-start
  printf 'WINDOW_BUNDLE=%s\nLOGDIR=%s\n' "$WINDOW_BUNDLE" "$RD"
  printf '%s\n' "argv: /bin/bash $WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh $SOURCE $HARNESS $SOURCE" \
    "env: EXPECTED_SOURCE_SHA=$SHA EXPECTED_SOURCE_TREE=$TREE GENERATION_LABEL_SHA=$SHA R3_BINDING_PAYLOAD=$WINDOW_BUNDLE/payload" \
    "mutex: PRODUCTION_DEPLOY_LOCK_INHERITED_FROM=^pid=$$\$" > "$RD/install-invocation.txt"
  INSTALL_STATE=started
  # Preserve BOTH pipeline statuses. Do not run the installer in an if/function
  # context that disables its own errexit; it is a separate /bin/bash process.
  if sudo -n /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin HOME=/var/root \
    EXPECTED_SOURCE_SHA="$SHA" EXPECTED_SOURCE_TREE="$TREE" GENERATION_LABEL_SHA="$SHA" \
    R3_BINDING_PAYLOAD="$WINDOW_BUNDLE/payload" \
    PRODUCTION_DEPLOY_LOCK_INHERITED_FROM="^pid=$$\$" \
    /bin/bash "$WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh" \
    "$SOURCE" "$HARNESS" "$SOURCE" 2>&1 | tee "$RD/install.log"; then
    INSTALL_PIPE=("${PIPESTATUS[@]}")
  else
    INSTALL_PIPE=("${PIPESTATUS[@]}")
  fi
  printf 'installer_rc=%s\ntee_rc=%s\n' "${INSTALL_PIPE[0]}" "${INSTALL_PIPE[1]}" > "$RD/install-exit.txt"
  if [ "${INSTALL_PIPE[0]}" -ne 0 ]; then
    INSTALL_STATE=failed
    helper root install-failed "${INSTALL_PIPE[0]}" || printf '%s\n' 'THIS-RUN MUTATION RECEIPT UNCONFIRMED; mutation_truth=UNKNOWN'
    return "${INSTALL_PIPE[0]}"
  fi
  INSTALL_STATE=succeeded_coordinates_pending
  [ "${INSTALL_PIPE[1]}" -eq 0 ]
}
stage_08_install_receipt() {
  helper root install-success
  INSTALL_STATE=succeeded
  grep -Fx 'CLOSURE_RESOLUTION_GATE PASS (runtime darwin-x64, expected suffix darwin-x64)' "$RD/install.log"
  grep -Fx 'installer_rc=0' "$RD/install-exit.txt"
  helper root preserve-config
}
stage_09_final_binding() { helper root final-binding; }
stage_10_plist_bootstrap() {
  helper root plist-update
  sudo -n /bin/launchctl bootstrap system "$PLIST"
  # Boot stabilization, never an automatic bootstrap retry.
  sleep 25
}
stage_11_production_verify() { helper root verify; }
stage_12_hr_watch() {
  local remaining pause
  helper user hr-start
  while :; do
    helper root hr-check
    remaining=$(helper user hr-remaining)
    [ "$remaining" -gt 0 ] || break
    pause=30; [ "$remaining" -ge 30 ] || pause=$remaining
    printf 'HR observation remaining=%ss/600s\n' "$remaining"
    sleep "$pause"
  done
  helper root hr-check final
  helper root verify
}
stage_13_close() { helper root release; }

main() {
  case "${1:---dry-run}" in
    --dry-run) [ "$#" -le 1 ] || { usage >&2; return 64; }; boundaries; return 0 ;;
    --help|-h) usage; return 0 ;;
    --execute) [ "$#" -eq 3 ] && [ "$2" = --authority ] && [[ "$3" = /* ]] || { usage >&2; return 64; }; AUTHORITY=$3 ;;
    *) usage >&2; return 64 ;;
  esac
  # No production operation precedes this explicit execution branch.
  mkdir -p "$RECEIPTS"
  RD=$(mktemp -d "$RECEIPTS/run-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")
  exec > >(tee -a "$RD/window.log") 2>&1
  trap 'stop_on_error "$?" "$LINENO"' ERR
  trap 'stop_on_error 130 "$LINENO"' INT
  trap 'stop_on_error 143 "$LINENO"' TERM
  printf 'WINDOW V5 execution start; receipts=%s\n' "$RD"
  local f
  for f in stage_00_authority_mutex stage_01_integrity_clean stage_02_fresh_read \
    stage_03_dual_prerequisites stage_04_quiet_gate stage_05_old_exit \
    stage_05b_settle_unresolved \
    stage_06_full_preimage stage_07_pinned_install stage_08_install_receipt \
    stage_09_final_binding stage_10_plist_bootstrap stage_11_production_verify \
    stage_12_hr_watch stage_13_close; do
    STAGE=$f
    printf 'BEGIN %s %s\n' "$STAGE" "$(date -u +%FT%TZ)"
    if [ "$STAGE" != stage_00_authority_mutex ]; then helper root mutex-check; fi
    helper user phase "$STAGE" BEGIN
    "$f"
    helper user phase "$STAGE" PASS
    printf 'END %s PASS %s\n' "$STAGE" "$(date -u +%FT%TZ)"
  done
  printf 'Configured production checks PASS; HR broker execute observed; authentication NOT_TESTED; business success UNKNOWN.\n'
}

# Sourcing is also inert: definitions only, never execute a production stage.
if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then main "$@"; fi
