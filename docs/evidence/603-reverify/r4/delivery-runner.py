import datetime, hashlib, json, pathlib, subprocess, sys
root = pathlib.Path('/private/tmp/h603-reverify')
out = root / 'docs/evidence/603-reverify/r4'
name, *argv = sys.argv[1:]
if (out / 'FAILED.json').exists():
    raise SystemExit('Prior required gate failed; delivery forbidden')
record = out / (name + '.command.json')
if record.exists():
    raise SystemExit('Evidence name already exists; no silent replay')
meta = {'name': name, 'argv': argv, 'cwd': str(root),
        'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'head': subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True).strip(),
        'environment': 'Inherited network environment; no proxy values recorded. Nine-key cleanup applies to test/gate subprocesses.'}
record.write_text(json.dumps(meta, indent=2) + '\n')
with (out / (name + '.stdout.log')).open('wb') as stdout, (out / (name + '.stderr.log')).open('wb') as stderr:
    result = subprocess.run(argv, cwd=root, stdout=stdout, stderr=stderr)
meta.update({'ended_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rc': result.returncode,
             'stdout': name + '.stdout.log', 'stderr': name + '.stderr.log'})
meta['sha256'] = {stream: hashlib.sha256((out / meta[stream]).read_bytes()).hexdigest() for stream in ['stdout','stderr']}
record.write_text(json.dumps(meta, indent=2) + '\n')
if result.returncode:
    (out / 'FAILED.json').write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps({'name':name, 'rc':result.returncode, 'sha256':meta['sha256']}), flush=True)
for stream in ['stdout','stderr']:
    content = (out / meta[stream]).read_text(errors='replace')
    if content:
        print(stream + ':\n' + content, flush=True)
raise SystemExit(result.returncode)
