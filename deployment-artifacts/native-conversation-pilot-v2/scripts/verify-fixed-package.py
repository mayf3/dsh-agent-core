#!/usr/bin/env python3
"""Read-only byte/mode/link verification. This is never deploy admission."""
import argparse
import hashlib
import json
from pathlib import Path
import stat

def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):value.update(chunk)
    return value.hexdigest()

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,required=True)
args=parser.parse_args();root=args.root.resolve(strict=True)
manifest=root/'FIXED_FILES.jsonl';errors=[];count=0
for line in manifest.read_text().splitlines():
    row=json.loads(line);relative=Path(row['path'])
    if relative.is_absolute() or '..' in relative.parts:raise SystemExit('Unsafe manifest path')
    path=root/relative;count+=1
    try:
        info=path.lstat()
        if stat.S_IMODE(info.st_mode)!=row['mode']:errors.append(str(relative)+': mode')
        if row['type']=='symlink':
            import os
            if not path.is_symlink() or os.readlink(path)!=row['target']:errors.append(str(relative)+': link')
            if not path.resolve(strict=True).is_relative_to(root):errors.append(str(relative)+': external link')
        elif not stat.S_ISREG(info.st_mode) or digest(path)!=row['sha256']:
            errors.append(str(relative)+': bytes/type')
    except (OSError,RuntimeError):errors.append(str(relative)+': missing/unreadable')
print(json.dumps({'files_checked':count,'errors':errors,'production_mutation':False,'deploy_admission':False},indent=2))
raise SystemExit(1 if errors else 0)
