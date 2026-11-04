"""C7 accounting only. No deletion, rename, traversal, or command execution."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def names(value):
    require(isinstance(value, list), 'names must be an explicit list')
    require(all(isinstance(n, str) and n and '\0' not in n for n in value), 'invalid name')
    require(len(value) == len(set(value)), 'duplicate name')
    return set(value)


def reconcile_names(before, after, renames):
    old, new = names(before), names(after)
    require(isinstance(renames, dict), 'renames must be an explicit object')
    require(set(renames) <= old, 'rename source absent from baseline')
    require(all(isinstance(v, str) and v in new for v in renames.values()), 'rename target absent from after')
    require(len(set(renames.values())) == len(renames), 'rename targets not one-to-one')
    mapped = [renames.get(n, n) for n in before]
    require(len(set(mapped)) == len(mapped), 'rename collides with an unchanged name')
    result = {'before': sorted(old), 'after': sorted(new), 'renames': renames,
              'raw_removed': sorted(old-new), 'raw_added': sorted(new-old),
              'removed': sorted(set(mapped)-new), 'added': sorted(new-set(mapped))}
    require(not result['removed'] and not result['added'], 'R6 naming diff is not empty: '+json.dumps(result))
    return dict(result, mapped_diff_empty=True)


def retention_plan(root, newest_first, protected):
    root = Path(root)
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'unsafe retention root')
    order, pins = names(newest_first), names(protected)
    require(all(re.fullmatch(r'\.ds-old-[^/]+', n) and n not in ('.', '..') for n in order), 'non-generation name')
    observed = {}
    # Direct children only, lstat never follows a generation or enumerates its contents.
    for p in root.iterdir():
        if p.name.startswith('.ds-old-'):
            s = p.lstat()
            require(stat.S_ISDIR(s.st_mode), 'generation is symlink/non-directory: '+str(p))
            observed[p.name] = {'path': str(p), 'name': p.name, 'device': s.st_dev,
                                'inode': s.st_ino, 'mode': oct(stat.S_IMODE(s.st_mode)),
                                'uid': s.st_uid, 'gid': s.st_gid, 'mtime_ns': s.st_mtime_ns}
    require(order == set(observed), 'generation order must cover the exact observed .ds-old-* set')
    require(pins <= order, 'protected generation absent from inventory')
    retained = set(newest_first[:2]) | pins
    reasons = {n: ['latest-two'] if n in newest_first[:2] else [] for n in newest_first}
    for n in pins:
        reasons[n].append('authority-protected')
    for n in newest_first:
        # Defense in depth: explicit protected metadata and the fixed 025 boundary.
        p = root/n
        for marker in ('.pinned', '.keep', '.review-evidence', '.open-transaction'):
            if os.path.lexists(p/marker):
                retained.add(n)
                reasons[n].append(marker)
        if '025' in n or '.bak' in n or 'node_modules.bak' in n:
            retained.add(n)
            reasons[n].append('protected-material-name')
    current = root/'current'
    if current.is_symlink():
        target = current.resolve(strict=True)
        for n in newest_first:
            if target == root/n or root/n in target.parents:
                retained.add(n)
                reasons[n].append('current-link')
    return {'root': str(root), 'ordering': 'AUTHORITY_EXPLICIT_NEWEST_FIRST',
            'newest_first': newest_first, 'protected': protected, 'list_only': True,
            'deletion_executed': False, 'retained': [dict(observed[n], reasons=reasons[n])
                                                   for n in newest_first if n in retained],
            'delete_candidates': [observed[n] for n in newest_first if n not in retained],
            'excluded': ['agent-core.bak-*', 'node_modules.bak', '025 materials', 'non-.ds-old-*']}


def regular_json(path, expected_sha256=None):
    p = Path(path)
    require(p.is_absolute() and not p.is_symlink() and p.is_file(), 'missing/nonregular snapshot: '+str(p))
    require(p.resolve() == p, 'snapshot has a symlink ancestor: '+str(p))
    data = p.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 is not None:
        require(digest == expected_sha256, 'snapshot seal changed: '+str(p))
    return json.loads(data), {'path': str(p), 'sha256': digest}


def timestamp(value):
    t = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(t.tzinfo is not None and t.utcoffset() == dt.timedelta(0), 'snapshot time must be UTC')
    return t


def snapshot(doc, authority, scope):
    require(doc['window_id'] == authority['window_id'] and doc['scope'] == scope and scope, 'snapshot scope/window mismatch')
    require(doc['method'] == 'manual-inventory' and doc['collector'], 'manual attributed inventory required; gh snapshot alone refused')
    names(doc['names'])
    return timestamp(doc['captured_at'])


def capture_before(authority):
    c7 = authority['c7']
    before, binding = regular_json(c7['before_path'], c7['before_sha256'])
    at = snapshot(before, authority, c7['naming_scope'])
    current = dt.datetime.now(dt.timezone.utc)
    require(at <= current, 'baseline captured in the future')
    # Validate explicit inputs before taking the production mutex.
    require(Path(c7['after_path']).is_absolute() and c7['after_path'] != c7['before_path'], 'distinct after path required')
    require(isinstance(c7['renames'], dict), 'explicit rename map required')
    require(set(c7['renames']) <= names(before['names']), 'rename source absent from baseline')
    targets = list(c7['renames'].values())
    names(targets)
    mapped = [c7['renames'].get(n, n) for n in before['names']]
    names(mapped)
    order = names(c7['generations_newest_first'])
    require(all(re.fullmatch(r'\.ds-old-[^/]+', n) for n in order), 'non-generation name')
    require(names(c7['protected_generations']) <= order, 'protected generation absent from declared order')
    require(isinstance(c7['protection_basis'], str) and c7['protection_basis'].strip(),
            'current/open transaction/pinned/review/025 protection inventory required')
    return {'at': current.isoformat(), 'snapshot': before, 'binding': binding,
            'c7': json.loads(json.dumps(c7))}


def close_window(authority, captured, root, verified_at):
    c7 = authority['c7']
    require(captured['c7'] == c7, 'C7 inputs drifted')
    before, binding = regular_json(c7['before_path'], c7['before_sha256'])
    require(before == captured['snapshot'] and binding == captured['binding'], 'baseline changed during window')
    after, after_binding = regular_json(c7['after_path'])
    before_at = snapshot(before, authority, c7['naming_scope'])
    after_at = snapshot(after, authority, c7['naming_scope'])
    require(before_at <= timestamp(captured['at']) <= after_at <= dt.datetime.now(dt.timezone.utc), 'after snapshot is stale/future')
    require(timestamp(verified_at) <= after_at, 'after snapshot predates production verification')
    require(timestamp(authority['valid_from']) <= after_at < timestamp(authority['valid_until']), 'after outside window')
    accounting = reconcile_names(before['names'], after['names'], c7['renames'])
    plan = retention_plan(root, c7['generations_newest_first'], c7['protected_generations'])
    return {'window_id': authority['window_id'], 'naming_scope': c7['naming_scope'],
            'before_binding': binding, 'after_binding': after_binding, 'names': accounting,
            'protection_basis': c7['protection_basis'], 'retention': plan,
            'production_delete_authority': 'NONE_LIST_ONLY_REQUIRES_SEPARATE_EXACT_WINDOW_AUTHORIZATION'}
