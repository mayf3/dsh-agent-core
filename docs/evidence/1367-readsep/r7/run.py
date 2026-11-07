#!/usr/bin/env python3
"""R7 serial capture runner. Nine proxy keys removed from child env only."""
import datetime, hashlib, json, os, pathlib, re, shlex, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[4]
out = pathlib.Path(__file__).resolve().parent
keys = ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy','NO_PROXY','no_proxy','NODE_USE_ENV_PROXY']
env = {k:v for k,v in os.environ.items() if k not in keys}
node = '/opt/homebrew/bin/node'
diag = 'packages/workflow-execution/test/observation-cas/diagnostic-read.test.js'
missing = 'packages/workflow-execution/test/observation-cas/diagnostic-missing-trace.test.js'
gate = sys.argv[1]
args = ['--test','--test-reporter=tap']
expected_rc, expected_tests, expected_fail = 0, None, 0
if gate in ('RED','regression'):
    args += [missing]
    expected_tests = 6
    if gate == 'RED': expected_rc, expected_fail = 1, 4
elif gate == 'target8':
    args += ['--test-name-pattern=1367 (traces:|attention:|fresh-reader family:|real mutation still repairs|non-tail corruption)', diag]
    expected_tests = 8
elif gate == 'diagnostic11':
    args += [diag]; expected_tests = 11
elif gate == 'observation-cas':
    args += sorted(str(p.relative_to(root)) for p in (root/'packages/workflow-execution/test/observation-cas').glob('*.test.js'))
    expected_tests = 110
elif gate == 'workflow':
    args += json.loads((root/'docs/evidence/1367-readsep/R2-workflow.json').read_text())['command'][2:]
    expected_tests = 316
elif gate in ('integration','broker'):
    previous = json.loads((root/f'docs/evidence/1367-readsep/R3-{gate}.json').read_text())['command']
    args += previous[previous.index('--test')+1:]
    node = '/usr/local/bin/node'
    expected_tests = 29 if gate == 'integration' else 80
elif gate == 'shutdown-api':
    args += ['packages/workflow-execution/test/shutdown-contract.test.js','packages/product-api/test/workflow-execution-api.test.js']
    expected_tests = 12
else: raise SystemExit('unknown gate')
command = [node, *args]
files = [a for a in args if a.endswith('.test.js')]
sources = ['packages/production-runtime/src/workflow/capability-runtime.js','packages/workflow-execution/src/ledger.js','packages/workflow-execution/src/engine.js',diag,missing]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
runtime = subprocess.run([node,'-e',"process.stdout.write(JSON.stringify({execPath:process.execPath,version:process.version,arch:process.arch,proxyKeysPresent:Object.keys(process.env).filter(k=>/^(http_proxy|https_proxy|all_proxy|no_proxy|node_use_env_proxy)$/i.test(k))}))"],cwd=root,env=env,capture_output=True,text=True,check=True)
with (out/f'{gate}.txt').open('wb') as raw:
    result = subprocess.run(command,cwd=root,env=env,stdout=raw,stderr=subprocess.STDOUT)
raw = (out/f'{gate}.txt').read_text()
counts = {name:int(re.search(rf'^# {name} (\d+)$',raw,re.M).group(1)) for name in ['tests','pass','fail','skipped']}
record = dict(gate=gate,cwd=str(root),source_parent='84b1e612aa31f4caa5a0de0ca39e3abca545bcef',integration_base='2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648',command=command,environment_recipe='env '+ ' '.join('-u '+k for k in keys)+' '+shlex.join(command),unset_keys=keys,environment_scope='test child only; parent unchanged',node_runtime=json.loads(runtime.stdout),started_at_utc=started,completed_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),expected_rc=expected_rc,actual_rc=result.returncode,counts=counts,raw_sha256=sha(out/f'{gate}.txt'),file_sha256={f:sha(root/f) for f in dict.fromkeys(sources+files)})
(out/f'{gate}.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['gate','command','node_runtime','actual_rc','expected_rc','counts','raw_sha256']},indent=2))
if result.returncode != expected_rc or counts['tests'] != expected_tests or counts['fail'] != expected_fail or counts['skipped']:
    raise SystemExit('UNEXPECTED RESULT: failure-stop; see persisted raw output')
