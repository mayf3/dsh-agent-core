import sys, os, subprocess, json, hashlib, datetime, pathlib
root=pathlib.Path('/private/tmp/h605-r2')
ev=pathlib.Path('/private/tmp/h605-r6-evidence')
label=sys.argv[1];args=sys.argv[2:]
gates=ev/'gates.json'
prior=json.loads(gates.read_text()) if gates.exists() else []
assert not any(g['rc'] != 0 for g in prior), 'prior failed required gate: STOP'
assert label not in [g['label'] for g in prior], 'duplicate gate: no retries'
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
state=pathlib.Path('/private/tmp/h605-r5-evidence/continuation/control/turn-recovery-v3.json')
row={'label':label,'command':args,'cwd':str(root),'startedAt':now(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'log':str(ev/(label+'.log'))}
if state.exists():
 row['routerBeforeSHA256']=digest(state)
 if label=='matrix-cold-start': assert row['routerBeforeSHA256']=='c43e83044b8bca34208b295615ea49feb4f04b8716a1d60a8c747e4f7f5f624c'
env=os.environ.copy();env['COMPAT_STATE_INPUT']='/private/tmp/w6-state-compat-readable/sanitized';env['COMPAT_MATRIX_STATE']='/private/tmp/h605-r5-evidence/continuation'
with open(row['log'],'wb') as log: result=subprocess.run(args,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
row.update(rc=result.returncode,finishedAt=now(),logSHA256=digest(pathlib.Path(row['log'])))
if state.exists():
 row['routerAfterSHA256']=digest(state)
 if label.startswith('matrix-'): (ev/(label+'-router-after.json')).write_bytes(state.read_bytes())
prior.append(row);gates.write_text(json.dumps(prior,indent=2)+'\n')
print(json.dumps(row,indent=2));print(pathlib.Path(row['log']).read_text()[-6000:])
if result.returncode:
 with (root/'STOPPED-605-R2.md').open('a') as f:f.write('\n# R6 required-gate stop\n\n'+json.dumps(row,indent=2)+'\n\nImmediate fail-stop: no retry, later gate, commit/push/PR. Raw output: '+row['log']+'\n')
 with (root/'RECEIPT-605-R2.md').open('a') as f:f.write('\n# R6 STOPPED_REQUIRED_GATE_FAILURE\n\n'+json.dumps(row,indent=2)+'\n')
sys.exit(result.returncode)
