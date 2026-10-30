#!/usr/bin/env python3
"""#953 bounded metadata readback; no credentials, sessions, network or writes.

Prints JSON to stdout. Redirect only into the diagnostic checkout. Registry
content is projected in memory; descriptions and unrelated employee rows never
leave this process. The binding/control paths are stat-only permission probes.
"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def error(exc):
    return {"error": type(exc).__name__, "errno": getattr(exc, "errno", None)}


out = {"observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
       "scope": "READ_ONLY_METADATA_NO_CREDENTIAL_OR_SESSION_READ", "files": [], "status_commands": []}
registry = Path('/Users/authsvc/.agent-core/agents.json')
try:
    raw = registry.read_bytes()
    rows = json.loads(raw)['agents']
    out['registry'] = {
        'path': str(registry), 'resolved': str(registry.resolve()),
        'sha256': sha256(raw), 'row_count': len(rows),
        'duplicate_id_count': len(rows) - len({r['id'] for r in rows}),
        'canonical_hr': [{'id': r['id'], 'disabled': r.get('disabled', False)}
                         for r in rows if r['id'] == 'agt_hr-agent'],
        'legacy_hr_exact_id_count': sum(r['id'] == 'hr-agent' for r in rows),
        'failed_employee_selection': 'UNKNOWN_NO_EXACT_ID_IN_RECEIPTS',
        'identity_inference': 'NONE_NO_NAME_OR_ALIAS_SELECTION',
    }
except (OSError, ValueError, KeyError) as exc:
    out['registry'] = {'path': str(registry), **error(exc)}

app = Path('/usr/local/libexec/agent-core/app')
provenance = app / 'pack-provenance.json'
try:
    raw = provenance.read_bytes()
    doc = json.loads(raw)
    keys = ['provenance', 'source_head_sha', 'source_tree_sha', 'source_clean',
            'generation_label_sha', 'source_label_matches_pack_input',
            'packed_app_tree_sha256', 'note']
    out['installed_pack'] = {'path': str(provenance), 'sha256': sha256(raw),
                             'declared_metadata_only': {k: doc.get(k) for k in keys},
                             'loaded_binding': 'UNKNOWN',
                             'entire_pack_digest_recomputed': False}
except (OSError, ValueError) as exc:
    out['installed_pack'] = {'path': str(provenance), **error(exc)}

for relative in [
    'packages/production-runtime/src/compose.js',
    'packages/production-runtime/src/v2-ingress-gate.js',
    'packages/agent-definition/src/access.js',
    'packages/agent-credential-provisioning/src/index.js',
    'packages/agent-router/src/index.js',
    'packages/broker/src/index.js',
    'packages/broker/src/capabilities/agent-definition.js',
    'packages/broker/src/gateway.js',
    'packages/broker/src/transport.js',
]:
    path = app / relative
    try:
        data = path.read_bytes()
        out['files'].append({'path': str(path), 'sha256': sha256(data), 'bytes': len(data)})
    except OSError as exc:
        out['files'].append({'path': str(path), **error(exc)})

out['stat_only'] = []
for name in ['/Users/authsvc/.agent-core/bindings/bindings.json',
             '/Users/authsvc/.agent-core/control']:
    path = Path(name)
    try:
        st = path.stat()
        out['stat_only'].append({'path': name, 'uid': st.st_uid, 'mode': oct(st.st_mode & 0o777),
                                 'contents_read': False})
    except OSError as exc:
        out['stat_only'].append({'path': name, **error(exc), 'contents_read': False})

# Process list never includes arguments or environment. launchctl list includes
# only PID/status/label. No launchctl print of environment-bearing service data.
for cmd in [['sudo', '-n', '/bin/launchctl', 'list'],
            ['/bin/launchctl', 'list'], ['/bin/ps', '-axo', 'pid,uid,comm']]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        relevant = [s for s in result.stdout.splitlines()
                    if any(word in s.lower() for word in ['agent-core', 'authsvc', 'feishu', 'lark', 'dsh', '/node'])]
        out['status_commands'].append({'argv': cmd, 'rc': result.returncode,
                                       'relevant_status_lines': relevant,
                                       'stderr': result.stderr.strip()[:500],
                                       'proof_limit': 'empty_or_denied_is_UNKNOWN_not_stopped'})
    except (OSError, subprocess.TimeoutExpired) as exc:
        out['status_commands'].append({'argv': cmd, **error(exc),
                                       'proof_limit': 'UNKNOWN_not_stopped'})

print(json.dumps(out, indent=2, ensure_ascii=False))
