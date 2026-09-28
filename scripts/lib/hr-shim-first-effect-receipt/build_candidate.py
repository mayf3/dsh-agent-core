"""Build one fixed, offline DS receipt-reader candidate from a pinned source.

This tool only writes a nonproduction artifact. No service update, protected
read, OS authorization, or original transaction is attempted here.
"""
import argparse
import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
BASELINE = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG'
                '/p0-travel-terminal-readback-20260928-v14/artdir/deployment_system.py')
OUT = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG'
           '/hr-shim-first-effect-receipt-readback-20260929-v1')
BASELINE_SHA256 = 'daeb44fc0c23a7a2949519a5d6abcc9459e38936e10bc704d85b25794f7a74d6'
BASELINE_SIZE = 110215851
ACTION = b'HR_SHIM_FIRST_EFFECT_RECEIPT_STATUS_V1'
_HANDLER = b'def handle(raw, peer=None):\n'
_ALLOWED = b'        allowed = {\n'
_STATUS = b'        if action == "STATUS":\n'
_ACTIVE_OFF = b'HR_READBACK_ACTIVE = False'
_ACTIVE_ON = b'HR_READBACK_ACTIVE = True'


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def read_pinned_baseline(path=BASELINE):
    """Refuse a moved or changed service source before composing anything."""
    path = Path(path)
    if path.stat().st_size != BASELINE_SIZE:
        raise ValueError('DS baseline size mismatch')
    raw = path.read_bytes()
    if sha256(raw) != BASELINE_SHA256:
        raise ValueError('DS baseline hash mismatch')
    return raw


def compose(baseline, reader, *, bound=False):
    """Add only the fixed allowlist row, fixed handler branch, and reader."""
    if type(baseline) is not bytes or type(reader) is not bytes:
        raise TypeError('composition requires source bytes')
    if (reader.count(_ACTIVE_OFF) != 1
            or reader.count(b'def hr_first_effect_request(peer):') != 1):
        raise ValueError('reader source shape mismatch')
    if baseline.count(_HANDLER) != 1 or ACTION in baseline:
        raise ValueError('DS handler anchor or action mismatch')
    before, marker, handler = baseline.partition(_HANDLER)
    if handler.count(_ALLOWED) != 1 or handler.count(_STATUS) != 1:
        raise ValueError('DS handler wiring anchor mismatch')
    if bound:
        reader = reader.replace(_ACTIVE_OFF, _ACTIVE_ON, 1)
    allowed_row = b'            "' + ACTION + b'": {"action"},\n'
    handler = handler.replace(_ALLOWED, _ALLOWED + allowed_row, 1)
    action_branch = (b'        if action == "' + ACTION + b'":\n'
                     b'            return hr_first_effect_request(peer), None\n')
    handler = handler.replace(_STATUS, action_branch + _STATUS, 1)
    return before + reader.rstrip(b'\n') + b'\n\n' + marker + handler


def build_nonproduction(*, bound=False):
    baseline = read_pinned_baseline()
    reader = (HERE / 'reader.py').read_bytes()
    candidate = compose(baseline, reader, bound=bound)
    folder = OUT / ('bound-artdir' if bound else 'artdir')
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'deployment_system.py'
    if path.exists():
        if sha256(path.read_bytes()) != sha256(candidate):
            raise FileExistsError('existing candidate differs; refusing overwrite')
    else:
        with path.open('xb') as stream:
            stream.write(candidate)
    return {'path': str(path), 'baselineSha256': sha256(baseline),
            'readerSha256': sha256(reader), 'candidateSha256': sha256(candidate),
            'size': len(candidate), 'boundFixedProfile': bound,
            'serviceInstallAuthorized': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bound-fixed-profile', action='store_true',
                        help='make the offline fixed action active in the artifact')
    args = parser.parse_args()
    print(json.dumps(build_nonproduction(bound=args.bound_fixed_profile),
                     sort_keys=True))


if __name__ == '__main__':
    main()
