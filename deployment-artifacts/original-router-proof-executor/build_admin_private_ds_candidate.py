"""Review-only fixed private qualifier bootstrap overlay on exact offline DS.

This builder neither reads the installed service nor installs or starts one.
The reviewed candidate is inert because package and host-observer pins are
absent. Later compilation needs a separately reviewed exact package/host map.
"""
import hashlib
from pathlib import Path
from textwrap import indent


BASE = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/'
    'p0-travel-terminal-readback-20260928-v14/artdir/deployment_system.py')
BASE_SHA256 = 'daeb44fc0c23a7a2949519a5d6abcc9459e38936e10bc704d85b25794f7a74d6'
HERE = Path(__file__).resolve().parent
MODULE_SHA256 = None  # Set only with exact changed-surface review of this module.
HOST_OBSERVER = HERE / 'admin_host_identity.py'
HOST_OBSERVER_SHA256 = 'd01e60e8176e1ea7cb52c40b9cb51ef3bec56f2b1a2f1850c5a8402773afa035'


def build_bytes():
    raw = BASE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA256:
        raise ValueError('ADMIN_PRIVATE_DS_BASE_CHANGED')
    module_raw = (HERE / 'admin_ds_private_bootstrap.py').read_bytes()
    if MODULE_SHA256 is None or hashlib.sha256(module_raw).hexdigest() != MODULE_SHA256:
        raise ValueError('ADMIN_PRIVATE_BOOTSTRAP_SOURCE_UNREVIEWED')
    source = raw.decode('utf8', 'strict')
    before = 'def serve():\n'
    ready = '    server.listen(8)\n'
    if source.count(before) != 1 or source.count(ready) != 1:
        raise ValueError('ADMIN_PRIVATE_DS_ANCHOR_CHANGED')
    host_raw = HOST_OBSERVER.read_bytes()
    if hashlib.sha256(host_raw).hexdigest() != HOST_OBSERVER_SHA256:
        raise ValueError('ADMIN_PRIVATE_HOST_OBSERVER_CHANGED')
    host_source = host_raw.decode('utf8', 'strict')
    module = (host_source + '\n\n'
        + 'def _make_ADMIN_PRIVATE_QUALIFIER():\n'
        + indent(module_raw.decode('utf8', 'strict'), '    ')
        + '\n    return types.SimpleNamespace(**locals())\n'
        + 'ADMIN_PRIVATE_QUALIFIER = _make_ADMIN_PRIVATE_QUALIFIER()\n\n')
    source = source.replace(before, 'import types\n\n' + module + before, 1)
    source = source.replace(ready, ready +
        '    if ADMIN_PRIVATE_QUALIFIER.QUALIFIER_ACTIVE:\n'
        '        ADMIN_PRIVATE_QUALIFIER.threading.Thread(\n'
        '            target=ADMIN_PRIVATE_QUALIFIER.wait_for_committed_install,\n'
        '            daemon=True).start()\n', 1)
    return source.encode('utf8')
