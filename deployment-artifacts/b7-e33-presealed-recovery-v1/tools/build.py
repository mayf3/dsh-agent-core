#!/usr/bin/env python3
"""Hash-pinned source artifact reconstruction only. Never imports or runs DS."""
import argparse
import ast
import hashlib
import json
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
MARKER = b'if __name__ == "__main__":\n    serve()\n'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def checked(raw, pin):
    if len(raw) != pin['bytes'] or sha(raw) != pin['sha256']:
        raise ValueError('EXACT_PINNED_BYTES_REQUIRED')
    return raw


def append_block(source):
    # Compile syntax only; do not execute the fixed recovery module.
    compile(source, '<sealed-b7_e33_recovery.py>', 'exec')
    return ("_b7_e33_recovery = _b7_types.ModuleType('_sealed_b7_e33_recovery')\n"
            "exec(compile(" + ascii(source) +
            ", '<sealed-b7_e33_recovery.py>', 'exec'), _b7_e33_recovery.__dict__)\n"
            "_b7_e33_recovery.install_e33_recovery(_b7_host, _b7_execution_instance)\n\n").encode('ascii')


def construct(baselines):
    pins = json.loads((PACKAGE / 'PINS.json').read_bytes())
    base = {n: checked((baselines/n).read_bytes(), p)
            for n,p in pins['baselines'].items()}
    sources = {n: checked((PACKAGE/'src'/n).read_bytes(), p)
               for n,p in pins['sources'].items()}
    raw = base['deployment_system.py']
    if raw.count(MARKER) != 1:
        raise ValueError('EXACT_SERVER_FOOTER_REQUIRED')
    start = raw.index(MARKER)
    if raw[start:] != MARKER:
        raise ValueError('EXACT_SERVER_FOOTER_REQUIRED')
    append = append_block(sources['v52_e33_recovery_source.py'].decode('utf-8'))
    server = raw[:start] + append + raw[start:]
    if server.count(append) != 1 or server.replace(append,b'',1) != raw:
        raise ValueError('WHOLE_SERVER_INVERSE_FAILED')
    ast.parse(server)  # Syntax only. No service import, main or handler execution.
    products = dict(sources)
    products['deployment_system.py'] = server
    products['ds_client.py'] = base['ds_client.py']
    for name,pin in pins['outputs'].items():
        checked(products[name],pin)
    return products,pins


def build(baselines, output):
    if output.exists() or output.is_symlink():
        raise ValueError('EXCLUSIVE_NEW_OUTPUT_REQUIRED')
    products,pins = construct(baselines)
    output.mkdir(mode=0o700)
    for name,raw in products.items():
        with (output/name).open('xb') as target:
            target.write(raw)
    receipt = {'kind':'SOURCE_ONLY_RECONSTRUCTION',
               'inputs':pins['baselines'],
               'outputs':{n:{'sha256':sha(b),'bytes':len(b)} for n,b in products.items()},
               'whole_old_server_inverse_exact':True,'whole_client_unchanged':True,
               'install_or_ds_requests':False}
    with (output/'build-receipt.json').open('x') as target:
        target.write(json.dumps(receipt,indent=2)+'\n')
    return receipt


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baselines',type=Path,required=True,
                        help='External owned hash-pinned public code preimages; no copy made')
    parser.add_argument('--output',type=Path,required=True,help='New owned output directory')
    args=parser.parse_args()
    print(json.dumps(build(args.baselines,args.output),indent=2))
