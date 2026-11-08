#!/usr/bin/env python3
"""Bounded read-only production observations; writes only beside this script.

No production modules, constructors, endpoints, installer or shell are invoked.
Protected JSON is reduced in authsvc's process; prompts/outputs/credentials never
leave it. Missing exploratory subjects are observations, not task failures.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

OUT = Path(__file__).resolve().parent
APP = Path('/usr/local/libexec/agent-core/app')
def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()
def sha(b):
    return hashlib.sha256(b).hexdigest()
def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
def command(args):
    p = subprocess.run(args, capture_output=True, text=True, env={**os.environ, 'TZ': 'UTC'})
    return {'argv': args, 'at': now(), 'rc': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}
def manifest(root):
    entries = []
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in sorted(dirs + files):
            p = Path(base) / name
            a = p.lstat()
            e = {'path': str(p.relative_to(root)), 'mode': oct(stat.S_IMODE(a.st_mode)),
                 'uid': a.st_uid, 'gid': a.st_gid, 'dev': a.st_dev, 'ino': a.st_ino,
                 'size': a.st_size, 'mtime_ns': a.st_mtime_ns, 'ctime_ns': a.st_ctime_ns}
            if p.is_symlink():
                e.update(kind='symlink', target=os.readlink(p))
            elif p.is_file():
                e.update(kind='file', sha256=sha(p.read_bytes()))
            elif p.is_dir():
                e.update(kind='directory')
            else:
                e.update(kind='other')
            b = p.lstat()
            e['stat_stable_during_read'] = (a.st_ino, a.st_size, a.st_mtime_ns, a.st_ctime_ns) == (b.st_ino, b.st_size, b.st_mtime_ns, b.st_ctime_ns)
            entries.append(e)
    return sorted(entries, key=lambda e: e['path'])

started = now()
ps_old = command(['/bin/ps', '-p', '16139', '-o', 'pid=,ppid=,user=,lstart=,args='])
ps_current = command(['/bin/ps', '-p', '22118', '-o', 'pid=,ppid=,user=,lstart=,args='])
launch = command(['/bin/launchctl', 'print', 'system/ai.agent-core.runtime'])
# Never retain launchd environment wholesale: it may contain secrets.
allow = ('state =', 'pid =', 'program =', 'working directory =', 'path =',
         'runs =', 'last exit code =', 'AGENT_CORE_DEPLOYED_SHA =>')
launch['stdout'] = '\n'.join(s.strip() for s in launch['stdout'].splitlines() if s.strip().startswith(allow))
before = manifest(APP)
provenance_bytes = (APP / 'pack-provenance.json').read_bytes()
protected_code = r'''
import datetime as dt, hashlib, json
from pathlib import Path
def digest(b): return hashlib.sha256(b).hexdigest()
def sig(s): return [s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
def read(p):
    p=Path(p)
    if not p.exists(): return {'path':str(p),'present':False}
    a=p.lstat(); raw=p.read_bytes(); b=p.lstat(); d=json.loads(raw)
    r={'path':str(p),'present':True,'bytes':len(raw),'sha256':digest(raw),'stat':sig(a),'stable_during_read':sig(a)==sig(b)}
    if p.name=='turn-recovery-v3.json':
        r.update(version=d.get('version'),runtimeEpoch=d.get('runtimeEpoch'),runtimeEpochs=d.get('runtimeEpochs'),record_count=len(d.get('records',[])))
        targets={'turn:a7e296e6-22cd-4205-a366-2e915fb7f22e:a32:g9:s16','turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a11:g23:s76','turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a54:g23:s43','turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a40:g84:s397','turn:60129522-4196-44bb-a644-52a255dde15d:a2:g70:s3581'}
        keys=['handle','agentId','processGeneration','runtimeEpoch','state','queryState','initialOutcome','fenceState','failureReason','exitObservedAt','terminationEvidence','settlementResult']
        r['targets']=[{**{k:x.get(k) for k in keys},'callerCorrelation_present':x.get('callerCorrelation') is not None} for x in d.get('records',[]) if x.get('handle') in targets]
        r['state_counts']={}
        for x in d.get('records',[]):
            k=str(x.get('state'));r['state_counts'][k]=r['state_counts'].get(k,0)+1
    elif p.name=='jobs.json':
        r.update(version=d.get('version'),job_count=len(d.get('jobs',[])),occurrence_count=len(d.get('occurrences',[])),fence_count=len(d.get('fences',{})))
        r['recordSchemaVersions']=sorted(set(str(x.get('recordSchemaVersion')) for x in d.get('occurrences',[])))
    else:
        r['top_level_type']=type(d).__name__
    return r
paths=['/Users/authsvc/.agent-core/control/turn-recovery-v3.json','/Users/authsvc/.agent-core/control/turn-recovery-v3.json.abandonment-declarations.json','/Users/authsvc/.agent-core/control/turn-recovery-v3.json.faults.json','/Users/authsvc/.agent-core/scheduler/jobs.json']
print(json.dumps({'at':dt.datetime.now(dt.timezone.utc).isoformat(),'files':[read(p) for p in paths]}))
'''
protected = command(['/usr/bin/sudo', '-n', '-u', 'authsvc', '/usr/bin/python3', '-B', '-c', protected_code])
if protected['rc'] == 0:
    protected['summary'] = json.loads(protected.pop('stdout'))
after = manifest(APP)
ps_after = command(['/bin/ps', '-p', '22118', '-o', 'pid=,ppid=,user=,lstart=,args='])
write('app-manifest-before.json', before)
write('app-manifest-after.json', after)
write('protected-summary.json', protected)
write('process-and-install.json', {'started': started, 'finished': now(), 'historical_pid': ps_old,
      'current_pid_before': ps_current, 'current_pid_after': ps_after, 'launchd_allowlisted': launch,
      'app_manifest_equal': before == after, 'app_entries': len(before),
      'manifest_encoding': 'SHA256 of UTF-8 json.dumps(entries,sort_keys=True,separators=(comma,colon)); includes stat coordinates; NOT historical pack digest',
      'observed_manifest_sha256': sha(json.dumps(before,sort_keys=True,separators=(',',':')).encode()),
      'provenance_sha256': sha(provenance_bytes), 'provenance': json.loads(provenance_bytes),
      'scope': 'read-only observations; disk/time binding is not an in-memory ESM byte attestation'})
print(json.dumps({'output': str(OUT), 'app_stable': before == after, 'entries':len(before), 'protected_read_rc':protected['rc'], 'historical_pid_rc':ps_old['rc'], 'current_pid_rc':ps_after['rc']}))
