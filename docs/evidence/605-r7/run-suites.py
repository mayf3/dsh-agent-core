import subprocess,pathlib,json,hashlib,datetime,os,re,sys
root=pathlib.Path('/private/tmp/h605-r2');ev=pathlib.Path('/private/tmp/h605-r7-evidence'); cases=json.loads((ev/'attribution.json').read_text())
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert all(c['classification']=='pre-existing' for c in cases)
router=sorted(str(p.relative_to(root)) for p in (root/'packages/agent-router/test').rglob('*.test.js'))
scheduler=sorted(str(p.relative_to(root)) for p in (root/'packages/scheduler/test').rglob('*.test.js'))
bridge=sorted(str(p.relative_to(root)) for p in (root/'packages/scheduler-router/test').rglob('*.test.js'))
loadfail=[c['file'] for c in cases if not c['pattern']]; assert len(loadfail)==1
skip='(?:'+'|'.join(c['pattern'] for c in cases if c['pattern'])+')'
plan=[('full-router', ['node','--test','--test-concurrency=1','--test-skip-pattern',skip]+[p for p in router if p not in loadfail]),('full-scheduler',['node','--test','--test-concurrency=1']+scheduler),('full-scheduler-router',['node','--test','--test-concurrency=1']+bridge)]
(ev/'suite-plan.json').write_text(json.dumps({'routerFiles':router,'schedulerFiles':scheduler,'bridgeFiles':bridge,'excludedModuleLoadFiles':loadfail,'skipPattern':skip,'commands':plan},ensure_ascii=False,indent=2)+'\n')
assert not (ev/'gates.json').exists(),'one attempt only'
rows=[]
state=pathlib.Path('/private/tmp/h605-r5-evidence/continuation/control/turn-recovery-v3.json')
for label,args in plan:
 row={'label':label,'command':args,'cwd':str(root),'startedAt':now(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'log':str(ev/(label+'.log')),'routerBeforeSHA256':sha(state)}
 env=os.environ.copy();env['COMPAT_STATE_INPUT']='/private/tmp/w6-state-compat-readable/sanitized';env['COMPAT_MATRIX_STATE']='/private/tmp/h605-r5-evidence/continuation'
 with pathlib.Path(row['log']).open('wb') as log: result=subprocess.run(args,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 row.update(rc=result.returncode,finishedAt=now(),logSHA256=sha(pathlib.Path(row['log'])),routerAfterSHA256=sha(state))
 rows.append(row);(ev/'gates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 print(label,'rc='+str(result.returncode),flush=True)
 raw=pathlib.Path(row['log']).read_text();print(raw[-6500:],flush=True)
 if result.returncode:
  with (root/'STOPPED-605-R2.md').open('a') as f:f.write('\n## R7 required-gate stop\n\n'+json.dumps(row,ensure_ascii=False,indent=2)+'\n\nImmediate fail-stop; no later gate, retry, repair, commit, push or PR.\n')
  sys.exit(result.returncode)
