"""One-task exact-byte whitespace exemptions authorized by Owner R5.

No repository Git configuration, attributes, product files, or raw logs change.
The five excluded paths must match both pinned hashes and exact coordinates.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[4]
PREFIX = 'docs/evidence/603-reverify/'
EXEMPT = {
    'r2/candidate-working.diff': (
        'a66f5396f2568e0e1f1989cbef7b7558124e38505f4134272e574b3a9c32cfa8',
        [22, 25, 44, 48, 50, 166, 182, 190, 528]),
    'reviewed-product.diff': (
        '1c65a0b85be434886c45514b180de860837f5bdd1a0f1147b13d5ba422a42947',
        [8, 11, 30, 34, 36, 144]),
    'stopped-working.diff': (
        '97b6ab2023001868f229bf5040f279744a28bd8ac1a35244c4090de388e073cf',
        [8, 11, 30, 34, 36, 144, 159, 167, 446]),
    'r4/push-source.stderr.log': (
        '6622d36e1de003446521051b4b7b79960fd70b4c08604246f9c86bf25860d255',
        [1, 2, 3, 4]),
    'r4/cached-diff-check.stdout.log': (
        '1869434ca6810f4bd274f05eaa49a40623f38132017eb9b31e38f61de4862e33',
        list(range(2, 57, 2))),
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def main():
    checked_tree = git('write-tree').decode().strip()
    staged = git('diff', '--cached', '--name-only', '-z').split(b'\0')
    for suffix, (expected_hash, expected_lines) in EXEMPT.items():
        path = PREFIX + suffix
        raw = git('show', ':' + path)
        digest = hashlib.sha256(raw).hexdigest()
        lines = [i for i, line in enumerate(raw.splitlines(), 1)
                 if line.endswith((b' ', b'\t'))]
        if digest != expected_hash or lines != expected_lines:
            raise ValueError('Exemption byte/coordinate mismatch: ' + path)
        if (ROOT / path).read_bytes() != raw:
            raise ValueError('Exemption index/worktree mismatch: ' + path)

    manifest = json.loads((ROOT / PREFIX / 'r5/preserved-evidence.json').read_text())
    for path, expected_hash in manifest['sha256'].items():
        raw = (ROOT / path).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected_hash:
            raise ValueError('Historical evidence changed: ' + path)
        if git('show', ':' + path) != raw:
            raise ValueError('Historical evidence not staged verbatim: ' + path)

    product = git('diff', '--cached', '--name-only', '--',
                  'packages', 'scripts', '.agents', 'docs/specs', 'docs/decisions')
    if product:
        raise ValueError('Unexpected product/authority mutation: ' + product.decode())
    argv = ['git', 'diff', '--cached', '--check', '--', '.']
    argv.extend(':(exclude)' + PREFIX + suffix for suffix in EXEMPT)
    result = subprocess.run(argv, cwd=ROOT, capture_output=True)
    sys.stdout.buffer.write(result.stdout)
    sys.stderr.buffer.write(result.stderr)
    if result.returncode:
        return result.returncode
    if git('write-tree').decode().strip() != checked_tree:
        raise ValueError('Index moved during check')
    print(json.dumps({
        'result': 'PASS_WITH_OWNER_VERBATIM_EXEMPTIONS',
        'rc': 0, 'checked_index_tree': checked_tree,
        'staged_files': len([p for p in staged if p]),
        'exempt_files': len(EXEMPT),
        'exempt_coordinates': sum(len(v[1]) for v in EXEMPT.values()),
        'preserved_historical_files': len(manifest['sha256']),
        'remaining_staged_files': 'all checked by git diff --cached --check',
        'git_check_argv': argv,
    }, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
