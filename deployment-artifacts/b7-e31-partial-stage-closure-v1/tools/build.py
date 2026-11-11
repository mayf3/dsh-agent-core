#!/usr/bin/env python3
"""Reconstruct reviewed artifacts from explicit hash-pinned public preimages.
Artifact construction only: no import/serve/install, privileged call or DS request.
The large preimages/outputs are deliberately not part of this source package.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path

PACKAGE = Path(__file__).resolve().parent.parent
MARKER = b'if __name__ == "__main__":\n    serve()\n'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def checked(raw, pin):
    if len(raw) != pin['bytes'] or sha(raw) != pin['sha256']:
        raise ValueError('EXACT_PINNED_BYTES_REQUIRED')
    return raw


def construct(baselines):
    pins = json.loads((PACKAGE / 'PINS.json').read_bytes())
    base = {n: checked((baselines / n).read_bytes(), p)
            for n, p in pins['baselines'].items()}
    sources = {n: checked((PACKAGE / 'src' / n).read_bytes(), p)
               for n, p in pins['sources'].items()}
    source = sources['v50_e31_closure_source.py'].decode('utf-8')
    compile(source, '<sealed-b7_e31_closure.py>', 'exec')
    append = ('# BEGIN FIXED E31 PARTIAL STAGE CLOSURE V1\n'
              '_b7_e31_closure = _b7_types.ModuleType("_b7_e31_closure")\n'
              'exec(compile(' + ascii(source) +
              ', "<sealed-b7_e31_closure.py>", "exec"), _b7_e31_closure.__dict__)\n'
              '_b7_e31_closure.install_e31_closure(_b7_host, _b7_execution_instance)\n'
              '# END FIXED E31 PARTIAL STAGE CLOSURE V1\n').encode('ascii')
    if base['deployment_system.py'].count(MARKER) != 1:
        raise ValueError('EXACT_SERVER_FOOTER_REQUIRED')
    server = base['deployment_system.py'].replace(MARKER, append + MARKER)
    assert server.replace(append, b'', 1) == base['deployment_system.py']

    raw_client = base['ds_client.py']
    tree = ast.parse(raw_client)
    literals = [n.args[0] for n in ast.walk(tree)
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                and n.func.id == 'compile' and len(n.args) >= 2
                and isinstance(n.args[0], ast.Constant)
                and isinstance(n.args[1], ast.Constant)
                and n.args[1].value == '<sealed-b7_ds_execution_client.py>']
    if len(literals) != 1:
        raise ValueError('EXACT_CLIENT_LITERAL_REQUIRED')
    literal = literals[0]
    codec = sources['v50_execution_client_source.py'].decode('utf-8')
    assert codec.replace("p['operation_id'] in (E30OP,'b7-packet-r27-2edfbaeef5c352f2e-e31')",
                         "p['operation_id']==E30OP") == literal.value
    lines = raw_client.splitlines(keepends=True)
    start = sum(map(len, lines[:literal.lineno - 1])) + literal.col_offset
    end = sum(map(len, lines[:literal.end_lineno - 1])) + literal.end_col_offset
    client = raw_client[:start] + ascii(codec).encode('ascii') + raw_client[end:]

    case = (PACKAGE / 'patches/executor-e31-preserve.case').read_bytes()
    old_case = b'  e30-preserve)\n'
    if base['executor.sh'].count(old_case) != 1:
        raise ValueError('EXACT_EXECUTOR_CASE_REQUIRED')
    executor = base['executor.sh'].replace(old_case, case + old_case)
    assert executor.replace(case, b'', 1) == base['executor.sh']
    products = dict(sources, **{'deployment_system.py': server,
                               'ds_client.py': client, 'executor.sh': executor})
    for name, pin in pins['outputs'].items():
        checked(products[name], pin)
    return products, pins


def build(baselines, output):
    if output.exists() or output.is_symlink():
        raise ValueError('EXCLUSIVE_NEW_OUTPUT_REQUIRED')
    products, pins = construct(baselines)
    output.mkdir(mode=0o700)
    for name, raw in products.items():
        with (output / name).open('xb') as target:
            target.write(raw)
    receipt = {'kind': 'SOURCE_ONLY_RECONSTRUCTION',
               'inputs': pins['baselines'],
               'outputs': {n: {'sha256': sha(b), 'bytes': len(b)}
                           for n, b in products.items()},
               'install_or_ds_requests': False}
    with (output / 'build-receipt.json').open('x') as target:
        target.write(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baselines', type=Path, required=True,
                        help='Owned public preimage directory; filenames in PINS.json')
    parser.add_argument('--output', type=Path, required=True,
                        help='New owned artifact directory; never an installed path')
    args = parser.parse_args()
    print(json.dumps(build(args.baselines, args.output), indent=2))
