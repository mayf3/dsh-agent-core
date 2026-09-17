"""Reproduce inert package from committed source and retained transformed candidates."""
import json,hashlib,pathlib,subprocess,tempfile,datetime
assert __import__('os').geteuid()!=0
base=pathlib.Path('.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN')
ev=base/'task-4-evidence'; closure=base/'task-4-native-candidate-r2'
records=json.loads((closure/'closure.json').read_text())['records']
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
paths=[p for p in subprocess.check_output(['git','ls-files','packages/deployment-control-plane'],text=True).splitlines() if '/target/' not in p]
paths+=['scripts/trusted-cp-deploy-install.sh','scripts/production-runtime-launchd.mjs','deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs','deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh']
sources={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in paths}
tools=json.loads((base/'bootstrap-platform-tools.json').read_text())['tools']+[json.loads((ev/'plutil-observation.json').read_text())]
recipe={'source_revision':head,'source_files':sources,'controller':str(pathlib.Path('packages/deployment-control-plane/target/release/agent-deployd').resolve()),'runtime':{r['destination']:str((closure/r['blob']).resolve()) for r in records},'platform_tools':{r['path']:r['sha256'] for r in tools}}
recipe_path=ev/'final-recipe.json';recipe_path.write_text(json.dumps(recipe,indent=2)+'\n')
out=pathlib.Path(tempfile.mkdtemp(prefix='agent-deployd-task4-final-')).resolve()
cli='packages/deployment-control-plane/target/release/agent-deploy-prepare'
command=[cli,'prepare',str(recipe_path),str(out)]
p=subprocess.run(command,capture_output=True,text=True)
(ev/'43-final-package-prepare.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
result=json.loads(p.stdout)
command=[cli,'verify',str(out),result['manifest_digest'],result['source_digest'],str(pathlib.Path.cwd())]
p=subprocess.run(command,capture_output=True,text=True)
(ev/'44-final-package-verify.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
for name in ['manifest.json','ai.agent-deployd.plist']:(ev/('final-'+name)).write_bytes((out/name).read_bytes())
(ev/'native-closure-manifest.json').write_bytes((closure/'closure.json').read_bytes())
result.update({'source_commit':head,'package_path':str(out),'native_candidate_path':str(closure.resolve()),'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'manifest_file_sha256':hashlib.sha256((out/'manifest.json').read_bytes()).hexdigest(),'controller_sha256':hashlib.sha256(pathlib.Path(recipe['controller']).read_bytes()).hexdigest(),'closure_manifest_sha256':hashlib.sha256((closure/'closure.json').read_bytes()).hexdigest(),'prepare_cli_sha256':hashlib.sha256(pathlib.Path(cli).read_bytes()).hexdigest(),'payload_count':len(records)+1,'closure_bytes':sum(r['size'] for r in records)})
(ev/'final-artifacts.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
