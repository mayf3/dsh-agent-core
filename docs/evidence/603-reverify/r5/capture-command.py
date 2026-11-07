"""Record actual one-shot R5 commands; any nonzero result fences delivery."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(__file__).resolve().parent
name, *argv = sys.argv[1:]
record = OUT / (name + '.command.json')
if (OUT / 'FAILED.json').exists():
    raise SystemExit('Prior R5 command failed; delivery stopped')
if record.exists():
    raise SystemExit('Evidence name exists; replay forbidden')
meta = {
    'name': name, 'argv': argv, 'cwd': str(ROOT),
    'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT,
                                    text=True).strip(),
    'environment': 'Inherited; no secret or proxy values recorded',
}
record.write_text(json.dumps(meta, indent=2) + '\n')
with (OUT / (name + '.stdout.log')).open('wb') as stdout:
    with (OUT / (name + '.stderr.log')).open('wb') as stderr:
        result = subprocess.run(argv, cwd=ROOT, stdout=stdout, stderr=stderr)
meta.update({
    'ended_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'rc': result.returncode,
    'stdout': name + '.stdout.log', 'stderr': name + '.stderr.log',
})
meta['sha256'] = {
    stream: hashlib.sha256((OUT / meta[stream]).read_bytes()).hexdigest()
    for stream in ['stdout', 'stderr']
}
record.write_text(json.dumps(meta, indent=2) + '\n')
if result.returncode:
    (OUT / 'FAILED.json').write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps({'name': name, 'rc': result.returncode,
                  'sha256': meta['sha256']}))
for stream in ['stdout', 'stderr']:
    content = (OUT / meta[stream]).read_text(errors='replace')
    if content:
        print(stream + ':\n' + content)
sys.exit(result.returncode)
