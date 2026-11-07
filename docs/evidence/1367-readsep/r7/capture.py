#!/usr/bin/env python3
"""Capture one serial command without an index-writing pre-coordinate wrapper."""
import datetime, hashlib, json, pathlib, subprocess, sys
out = pathlib.Path(__file__).resolve().parent
root = out.parents[3]
label, *command = sys.argv[1:]
if command and command[0] == '--': command.pop(0)
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
with (out/f'{label}.stdout').open('wb') as stdout, (out/f'{label}.stderr').open('wb') as stderr:
    result = subprocess.run(command,cwd=root,stdout=stdout,stderr=stderr)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = dict(command=command,cwd=str(root),started_at_utc=started,finished_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),actual_rc=result.returncode,stdout_sha256=sha(out/f'{label}.stdout'),stderr_sha256=sha(out/f'{label}.stderr'))
(out/f'{label}.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
print((out/f'{label}.stdout').read_text(),end='')
print((out/f'{label}.stderr').read_text(),end='',file=sys.stderr)
raise SystemExit(result.returncode)
