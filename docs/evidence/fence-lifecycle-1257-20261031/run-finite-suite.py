#!/usr/bin/env python3
"""Run only this task's isolated suite and isolated PG; never read ambient auth env."""
import argparse, datetime, hashlib, json, os, re, signal, subprocess
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);args=ap.parse_args()
source=Path(args.source).resolve();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=False)
pg=Path('/tmp/dsh-1257-pg');meta=json.loads(Path('/tmp/dsh-1257-evidence/baseline/pg.json').read_text())
if (pg/'data/postmaster.pid').exists():raise SystemExit('Refusing active task PG cluster; serialize Base and candidate')
node=Path('/usr/local/bin/node');version=subprocess.check_output([str(node),'--version'],text=True).strip()
if version!='v25.6.1':raise SystemExit('Pinned node25.6.1 unavailable')
pg_env={'PATH':'/opt/homebrew/bin:/usr/bin:/bin','HOME':str(pg),'LC_ALL':'C','LANG':'C'}
home=out/'home';home.mkdir();tmp=out/'tmp';tmp.mkdir()
env={'PATH':'/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin','HOME':str(home),'TMPDIR':str(tmp)+'/', 'LC_ALL':'C','LANG':'C','TEST_ROTATION_DATABASE_URL':f"postgresql://{meta['app']}@127.0.0.1:{meta['port']}/{meta['database']}",'TEST_ROTATION_PSQL':'/opt/homebrew/bin/psql'}
cmd=[str(node),'--test','--test-concurrency=4','--test-force-exit','--test-timeout=60000','--test-reporter=tap','packages/*/test/*.test.js','packages/*/test/*/*.test.js']
record={'source':str(source),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip(),'tracked_status':subprocess.check_output(['git','status','--short','--untracked-files=no'],cwd=source,text=True),'started_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'node_version':version,'node_sha256':hashlib.sha256(node.read_bytes()).hexdigest(),'argv':cmd,'environment':env,'outer_timeout_seconds':240,'dependency_mode':'warm root npm install; test-created local worktree bridges; @deepseek-ai/dsh-tools unit passthrough stub'}
(out/'environment.json').write_text(json.dumps(record,indent=2)+'\n')
started=False;rc=None
try:
 with (out/'pg-start.log').open('w') as log:subprocess.run(['/opt/homebrew/bin/pg_ctl','-D',meta['data'],'-l',str(pg/'postgres.log'),'-w','start'],env=pg_env,stdout=log,stderr=subprocess.STDOUT,check=True)
 started=True
 with (out/'full.tap').open('w') as log:
  child=subprocess.Popen(cmd,cwd=source,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (out/'runner.json').write_text(json.dumps({'pid':child.pid,'process_group':child.pid})+'\n')
  try:rc=child.wait(timeout=240)
  except subprocess.TimeoutExpired:
   record['outer_timeout']=True;os.killpg(child.pid,signal.SIGTERM)
   try:rc=child.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);rc=child.wait()
finally:
 if started:
  with (out/'pg-stop.log').open('w') as log:stopped=subprocess.run(['/opt/homebrew/bin/pg_ctl','-D',meta['data'],'-m','fast','-w','stop'],env=pg_env,stdout=log,stderr=subprocess.STDOUT)
  (out/'pg-stopped.json').write_text(json.dumps({'stop_rc':stopped.returncode,'pid_file_exists':(pg/'data/postmaster.pid').exists()})+'\n')
record['exit_code']=rc;record['finished_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
tap=out/'full.tap';lines=tap.read_text().splitlines();failures=[]
for idx,line in enumerate(lines):
 match=re.match(r'^(\s*)not ok (\d+) - (.*)$',line)
 if not match:continue
 block=[]
 for following in lines[idx+1:idx+151]:
  block.append(following)
  if following.strip()=='...':break
 failures.append({'tap_line':idx+1,'indent':len(match[1]),'number':int(match[2]),'name':match[3],'details':'\n'.join(block)})
record['counts']={m.group(1):int(m.group(2)) for line in lines if (m:=re.match(r'^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$',line))};record['tap_sha256']=hashlib.sha256(tap.read_bytes()).hexdigest();record['failure_entries']=len(failures);record['tracked_status_after']=subprocess.check_output(['git','status','--short','--untracked-files=no'],cwd=source,text=True)
(out/'summary.json').write_text(json.dumps(record,indent=2)+'\n');(out/'failures.json').write_text(json.dumps(failures,indent=2,ensure_ascii=False)+'\n');(out/'failure-names.txt').write_text('\n'.join(x['name'] for x in failures)+'\n')
print(json.dumps({key:record[key] for key in ['head','exit_code','counts','tap_sha256','failure_entries','tracked_status_after']}))
