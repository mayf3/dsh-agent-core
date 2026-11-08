#!/usr/bin/env python3
"""Additional bounded pure reads for overlay time binding and D6 marker facts."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
OUT=Path(__file__).resolve().parent
def sha(b): return hashlib.sha256(b).hexdigest()
def cmd(a):
    p=subprocess.run(a,capture_output=True,text=True,env={**os.environ,'TZ':'UTC'})
    return {'argv':a,'rc':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
paths=[
 '/usr/local/libexec/agent-core/harness/packages/core/agent/lib/types/inbox.js',
 '/usr/local/libexec/agent-core/harness/packages/core/agent/lib/index.js',
 '/usr/local/libexec/agent-core/harness/packages/core/agent/package.json',
 '/usr/local/libexec/agent-core/node-runtime/bin/node',
 '/Library/LaunchDaemons/ai.agent-core.runtime.plist',
]
entries=[]
for v in paths:
    p=Path(v);a=p.lstat();b=p.read_bytes();z=p.lstat()
    entries.append({'path':v,'sha256':sha(b),'bytes':len(b),'mode':oct(stat.S_IMODE(a.st_mode)),
      'mtime_ns':a.st_mtime_ns,'ctime_ns':a.st_ctime_ns,'stable_during_read':(a.st_ino,a.st_mtime_ns,a.st_ctime_ns,a.st_size)==(z.st_ino,z.st_mtime_ns,z.st_ctime_ns,z.st_size)})
code=r'''
import datetime as dt,hashlib,json
from pathlib import Path
paths=['/Users/authsvc/.agent-core/control/turn-recovery-v3.json','/Users/authsvc/.agent-core/control/turn-recovery-v3.json.faults.json','/Users/authsvc/.agent-core/control/turn-recovery-v3.json.abandonment-declarations.json']
out=[]
for v in paths:
 p=Path(v);a=p.lstat();raw=p.read_bytes();b=p.lstat();d=json.loads(raw)
 e={'path':v,'sha256':hashlib.sha256(raw).hexdigest(),'stable_during_read':(a.st_ino,a.st_mtime_ns,a.st_ctime_ns,a.st_size)==(b.st_ino,b.st_mtime_ns,b.st_ctime_ns,b.st_size)}
 if p.name=='turn-recovery-v3.json':
  targets={'turn:a7e296e6-22cd-4205-a366-2e915fb7f22e:a32:g9:s16','turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a11:g23:s76','turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a54:g23:s43','turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a40:g84:s397','turn:60129522-4196-44bb-a644-52a255dde15d:a2:g70:s3581'}
  e['targets']=[{'handle':r.get('handle'),'adminAbandonment_present':r.get('adminAbandonment') is not None,'ownerRiskAcceptanceAudit_present':any(x.get('kind')=='owner_risk_acceptance_unproven_termination' for x in r.get('audit',[])),'epoch_is_member':r.get('runtimeEpoch') in d.get('runtimeEpochs',[])} for r in d.get('records',[]) if r.get('handle') in targets]
  e['all_record_epochs_members']=all(r.get('runtimeEpoch') in d.get('runtimeEpochs',[]) for r in d.get('records',[]))
 elif p.name.endswith('.faults.json'):
  e.update(top_level_keys=sorted(d.keys()),version=d.get('version'),faults_key_count=len(d))
 else:
  e.update(version=d.get('version'),declaration_count=len(d.get('declarations',[])))
 out.append(e)
print(json.dumps({'at':dt.datetime.now(dt.timezone.utc).isoformat(),'files':out}))
'''
r=cmd(['/usr/bin/sudo','-n','-u','authsvc','/usr/bin/python3','-B','-c',code])
if r['rc']==0:r['summary']=json.loads(r.pop('stdout'))
p=Path('/usr/local/libexec/agent-core/app/node_modules/@deepseek-ai/dsh-agent')
result={'at':dt.datetime.now(dt.timezone.utc).isoformat(),'external_files':entries,'harness_link':{'path':str(p),'literal':os.readlink(p),'resolved':str(p.resolve())},'protected':r,'process':cmd(['/bin/ps','-p','22118','-o','pid=,ppid=,user=,lstart=,args=']),'limits':'Each file independently stat-stable; no cross-file atomic snapshot, no constructor or current admission invocation. Plist only digest, no secret environment retained.'}
(OUT/'supplement.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
