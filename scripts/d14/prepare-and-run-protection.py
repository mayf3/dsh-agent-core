#!/usr/bin/env python3
"""Synthetic-only archive compatibility checks; never production admission proof."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive', type=Path, required=True)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--expected-archive-sha256', required=True)
parser.add_argument('--expected-source-commit', required=True)
parser.add_argument('--dependency-archive', type=Path)
parser.add_argument('--expected-dependency-sha256')
parser.add_argument('--node', default=shutil.which('node'))
args = parser.parse_args()
assert args.node, 'node executable unavailable'
assert sha(args.archive) == args.expected_archive_sha256, 'candidate archive mismatch'
source_head = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', 'HEAD'], text=True).strip()
source_status = subprocess.check_output(['git', '-C', str(args.source), 'status', '--porcelain'], text=True)
assert source_head == args.expected_source_commit and not source_status, 'source coordinate mismatch or dirty source'
if args.dependency_archive:
    assert args.expected_dependency_sha256 and sha(args.dependency_archive) == args.expected_dependency_sha256, 'dependency archive mismatch'

# A new output avoids silently mixing candidates or overwriting prior receipts.
args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
root = args.output.resolve()
extracted = root / 'release'
extracted.mkdir(mode=0o700)
with tarfile.open(args.archive) as archive:
    members = archive.getmembers()
    names = set()
    for member in members:
        target = (extracted / member.name).resolve()
        assert target.is_relative_to(extracted) and not member.issym() and not member.islnk(), 'unsafe archive member'
        assert member.name not in names, 'duplicate archive member'
        assert member.isfile() or member.isdir(), 'nonregular archive member'
        names.add(member.name)
    archive.extractall(extracted, filter='data')
package = extracted / 'package'
inputs = json.loads((package / 'build-provenance/build-inputs.json').read_text())
manifest_path = package / 'build-provenance/runtime-closure-manifest.json'
manifest = json.loads(manifest_path.read_text())
assert inputs['plugin']['sourceCommit'] == manifest['sourceCommit'] == source_head, 'embedded source mismatch'
source_diffs = []
compared = 0
for folder in ['src', 'lib']:
    for path in (package / folder).rglob('*'):
        if path.is_file():
            compared += 1
            corresponding = args.source / path.relative_to(package)
            if not corresponding.is_file() or sha(path) != sha(corresponding):
                source_diffs.append(str(path.relative_to(package)))
assert not source_diffs, 'archive source/lib differs from exact source/build'

expected_paths = set()
digest = hashlib.sha256()
for record in sorted(manifest['files'], key=lambda item: item['path'].encode('utf-8')):
    path = (package / 'node_modules' / record['path']).resolve()
    assert path.is_relative_to(package / 'node_modules'), 'unsafe closure path'
    assert path.is_file() and not path.is_symlink(), 'missing/nonregular closure file'
    mode = format(path.stat().st_mode & 0o777, 'o')
    assert sha(path) == record['sha256'] and path.stat().st_size == record['bytes'] and mode == record['mode'], 'closure bytes/mode mismatch'
    digest.update((record['path'] + '\0' + record['sha256'] + '\0' + mode + '\n').encode('utf-8'))
    expected_paths.add(record['path'])
actual_paths = {str(p.relative_to(package / 'node_modules')) for p in (package / 'node_modules').rglob('*') if p.is_file()}
assert expected_paths == actual_paths and len(expected_paths) == manifest['fileCount'], 'closure file set mismatch'
assert digest.hexdigest() == manifest['treeDigest'], 'closure tree digest mismatch'

script_root = Path(__file__).resolve().parent
# Keep worker execution and guard denial logs inside the caller-owned output,
# including when these reusable scripts are stored in a repository.
runner = root / 'run-release-protection.mjs'
guard = root / 'deny-external-network.mjs'
shutil.copy2(script_root / runner.name, runner)
shutil.copy2(script_root / guard.name, guard)
isolated = {name: str(root / directory) for name, directory in [('HOME', 'empty-home'), ('DSH_HOME', 'empty-dsh-home'), ('TMPDIR', 'tmp')]}
for path in isolated.values():
    Path(path).mkdir(mode=0o700)
isolated['NODE_OPTIONS'] = '--import=' + str(guard)
isolated['DSH_CODEX_MODELS_CACHE'] = str(root / 'empty-model-cache.json')
environment = os.environ.copy()
environment.update(isolated)
command = [args.node, str(runner), str(package), str(root / 'observations')]
receipt = {
    'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'archive': str(args.archive.resolve()), 'archiveSha256': sha(args.archive),
    'source': str(args.source.resolve()), 'sourceHead': source_head, 'sourceGitStatus': source_status,
    'sourceLibComparedFiles': compared, 'sourceLibMismatches': source_diffs,
    'dependencyArchiveSha256': sha(args.dependency_archive) if args.dependency_archive else None,
    'closureManifestSha256': sha(manifest_path), 'closureTreeDigest': digest.hexdigest(), 'closureFileCount': len(expected_paths),
    'runnerSha256': sha(runner), 'guardSha256': sha(guard), 'command': command, 'isolatedEnvironment': isolated,
    'actualHarnessVersion': 'UNKNOWN', 'actualHarnessCommit': 'UNKNOWN',
    'productionAdmissionEstablished': False,
    'limits': 'Only the released plugin and its shipped dependency closure; no current installed Harness/Core or real credential compatibility assertion.',
}
write(root / 'command.json', receipt)
with (root / 'tests.log').open('w') as stream:
    result = subprocess.run(command, cwd=root, env=environment, stdout=stream, stderr=subprocess.STDOUT)
receipt.update(exitCode=result.returncode, logSha256=sha(root / 'tests.log'), finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
write(root / 'result.json', receipt)
print(json.dumps(receipt, indent=2))
raise SystemExit(result.returncode)
