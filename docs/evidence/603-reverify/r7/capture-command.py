"""Capture one authorized R7 command once; a nonzero exit fences delivery."""
import base64
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
if (OUT / 'FAILED.json').exists() or record.exists():
    raise SystemExit('R7 failed or evidence name already exists; no replay')
meta = {
    'name': name, 'argv': argv, 'cwd': str(ROOT),
    'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT,
                                    text=True).strip(),
    'index_tree_before_command': subprocess.check_output(['git', 'write-tree'], cwd=ROOT, text=True).strip(),
    'environment': 'Inherited unless argv explicitly clears keys; no Secret values recorded',
}
record.write_text(json.dumps(meta, indent=2) + '\n')
result = subprocess.run(argv, cwd=ROOT, capture_output=True)
meta.update({
    'ended_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'rc': result.returncode,
    'encoding': 'base64 is authoritative verbatim output; text is a UTF-8 display',
})
for stream in ['stdout', 'stderr']:
    raw = getattr(result, stream)
    meta[stream + '_base64'] = base64.b64encode(raw).decode('ascii')
    meta[stream + '_sha256'] = hashlib.sha256(raw).hexdigest()
    meta[stream + '_text'] = raw.decode('utf-8', errors='replace')
record.write_text(json.dumps(meta, indent=2) + '\n')
if result.returncode:
    (OUT / 'FAILED.json').write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps({'name': name, 'rc': result.returncode,
                  'head': meta['head'], 'record': str(record.relative_to(ROOT))}))
sys.exit(result.returncode)
