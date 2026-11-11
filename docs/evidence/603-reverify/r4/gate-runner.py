import datetime, glob, hashlib, json, os, pathlib, subprocess, sys

root = pathlib.Path('/private/tmp/h603-reverify')
out = root / 'docs/evidence/603-reverify/r4'
name, *command = sys.argv[1:]
if (out / 'FAILED.json').exists():
    raise SystemExit('Prior required gate failed; subsequent execution forbidden')
if (out / (name + '.command.json')).exists():
    raise SystemExit('Evidence name already exists; no silent rerun')
keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY',
        'all_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY']
snapshot = '0f25ce5270c0964476184af509c5857acbdf1527'
expanded = []
for arg in command:
    if '*' in arg:
        matches = sorted(glob.glob(arg, root_dir=root))
        if not matches:
            raise SystemExit('Unmatched test pattern: ' + arg)
        expanded.extend(matches)
    else:
        expanded.append(arg)
argv = ['env'] + [item for key in keys for item in ['-u', key]]
argv += ['PATH=/usr/local/bin:' + os.environ['PATH'], 'EKR_SOURCE_SHA=' + snapshot,
         'EKR_TEST_SOURCE_SHA=' + snapshot] + expanded
meta = {'name': name, 'argv': argv, 'cwd': str(root),
        'verification_snapshot': snapshot,
        'source_binding': 'Unchanged product and test bytes from R2 snapshot; R4 documents and evidence separately bound',
        'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'environment': {'unset_keys': keys, 'node_path': '/usr/local/bin/node',
                        'EKR_SOURCE_SHA': snapshot, 'EKR_TEST_SOURCE_SHA': snapshot}}
record = out / (name + '.command.json')
record.write_text(json.dumps(meta, indent=2) + '\n')
with (out / (name + '.stdout.log')).open('wb') as stdout, (out / (name + '.stderr.log')).open('wb') as stderr:
    result = subprocess.run(argv, cwd=root, stdout=stdout, stderr=stderr)
meta.update({'ended_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rc': result.returncode,
             'stdout': name + '.stdout.log', 'stderr': name + '.stderr.log'})
meta['sha256'] = {stream: hashlib.sha256((out / meta[stream]).read_bytes()).hexdigest()
                  for stream in ['stdout', 'stderr']}
record.write_text(json.dumps(meta, indent=2) + '\n')
if result.returncode:
    (out / 'FAILED.json').write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps({'name': name, 'rc': result.returncode, 'sha256': meta['sha256']}), flush=True)
for stream in ['stdout', 'stderr']:
    lines = (out / meta[stream]).read_text(errors='replace').splitlines()
    if lines:
        print(stream + ' tail:\n' + '\n'.join(lines[-18:]), flush=True)
raise SystemExit(result.returncode)
