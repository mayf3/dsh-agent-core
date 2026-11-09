exec(open('/private/tmp/h605-r7-evidence/run-suites.py').read().split("assert all(c['classification']")[0])
rows=json.loads((ev/'gates.json').read_text()); assert all(r['rc']==0 for r in rows)
snapshot=json.loads((ev/'review-snapshot.json').read_text())
plan=[('full-scheduler-consolidated',['node','--test','--test-concurrency=1']+sorted(str(p.relative_to(root)) for p in (root/'packages/scheduler/test').rglob('*.test.js'))),('structure',['node',str(ev/'qualified-verifier/scripts/verify-code-structure.mjs'),'--base',snapshot['base'],'--head',snapshot['snapshot'],'--json'])]
for label,args in plan:
 assert label not in [r['label'] for r in rows]
 row={'label':label,'command':args,'cwd':str(root),'startedAt':now(),'head':snapshot['snapshot'],'log':str(ev/(label+'.log'))}
 env=os.environ.copy();env['COMPAT_STATE_INPUT']='/private/tmp/w6-state-compat-readable/sanitized';env['COMPAT_MATRIX_STATE']='/private/tmp/h605-r5-evidence/continuation'
 with pathlib.Path(row['log']).open('wb') as log: result=subprocess.run(args,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 row.update(rc=result.returncode,finishedAt=now(),logSHA256=sha(pathlib.Path(row['log'])))
 rows.append(row);(ev/'gates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 raw=pathlib.Path(row['log']).read_text(); print(label,'rc='+str(result.returncode),flush=True);print(raw[-1200:],flush=True)
 if result.returncode:
  with (root/'STOPPED-605-R2.md').open('a') as f:f.write('\n## R7 required-gate stop\n\n'+json.dumps(row,ensure_ascii=False,indent=2)+'\n\nImmediate fail-stop; no later gate, retry, repair, commit, push or PR.\n')
  sys.exit(result.returncode)
