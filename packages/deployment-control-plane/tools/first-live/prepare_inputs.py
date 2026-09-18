"""Exact nonroot static inputs; never installation, signing, or runtime evidence.

REUSE accepted Spec3986553, first-live observation-derived-fields design. Owner
mandate permits nonproduction preparation. All ordinary observations are inputs
for future protected preflight, not admission or completed lifecycle proofs.
"""
import argparse
import ast
import copy
import hashlib
import json
import os
import posixpath
import re
from pathlib import Path

BASE = '/usr/local/libexec/agent-core/'
NAMES = ('app', 'harness', 'node-runtime')
OPERATION = 'first-live-dsh-20260918-01'
MUTABLE = {'packages/broker/src/capabilities/workflow.js', 'packages/scheduler/src/watchdog/incident-lifecycle.js'}
RETIRED = {'scripts/trusted-cp-deploy-install.sh': 'SHELL', 'scripts/production-runtime-launchd.mjs': 'JS',
           'deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs': 'JS',
           'deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh': 'SHELL'}
WATCHDOG = 'watchdog-current-observation-v1'
ARTIFACTS = Path('/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1')
PINS = {'ordinary-app-harness-inventory-v7-02.json': 'f04d796827e7ba96040e3f22ea84cab01c32d37e0e72c4e0a46cab0e67c8e551',
        'node-inventory.json': '9e1d19247e6fea27fef54c46d1ff0d762e1fdb0f2e1156f8c99a2017447ee075',
        'static-input-supplement-v4.json': 'e83cc2dc44a29708ab110ae2ee6870df285c1aca812c43e5478f0362fd8583ff'}
SERVICE_SHA = 'bd7351e49a0b674917cb5b6cea52522186d2055b7dbacda31b7a1e1bf59c50d2'
MANIFEST_SHA = 'cd8bcc09371c091fa6bd8d93b1f2aa053cc2a3c80b0135d6a1c5892c45e66bb8'


def need(value, reason):
    if not value:
        raise ValueError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def digest(value):
    need(isinstance(value, str) and re.fullmatch('[a-f0-9]{64}', value), 'MISSING_OR_INVALID_DIGEST')
    return value


def unique(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def document(path, expected=None):
    raw = path.read_bytes()
    need(len(raw) <= 64 * 1024 * 1024, 'DOCUMENT_LIMIT')
    if expected:
        need(sha(raw) == expected, 'SOURCE_DIGEST_DRIFT:' + str(path))
    return json.loads(raw, object_pairs_hook=unique), {'path': str(path), 'sha256': sha(raw)}


def safe_path(path):
    need(isinstance(path, str) and len(path) <= 242, 'INVENTORY_PATH')
    parts = path.split('/')
    need(len(parts) <= 14 and all(0 < len(p) <= 120 and p not in ('.', '..') and
         re.fullmatch(r'[A-Za-z0-9._@+=$-]+', p) for p in parts), 'INVENTORY_PATH')


def entry(raw):
    try:
        kind = {'file': 'file', 'directory': 'directory', 'symlink': 'link'}[raw['kind']]
        result = {key: raw[key] for key in ('uid', 'gid', 'mode', 'flags', 'inode', 'device')}
        result.update(kind=kind, links=raw['nlink'], sha256=None, link=None,
                      post_gid=raw['gid'], post_mode=0o555 if kind == 'link' else raw['mode'])
    except KeyError as error:
        raise ValueError('MISSING_OBSERVED_METADATA') from error
    need(all(type(result[k]) is int for k in ('uid', 'gid', 'mode', 'flags', 'inode', 'device', 'links')), 'METADATA_TYPE')
    need(result['uid'] in (0, 505) and result['gid'] in (0, 601) and result['flags'] == 0
         and result['inode'] > 0 and result['device'] > 0 and result['links'] > 0
         and result['mode'] in (0o444, 0o555, 0o644, 0o755), 'METADATA_SCOPE')
    if kind == 'file':
        result['sha256'] = digest(raw.get('sha256'))
    elif kind == 'link':
        target = raw.get('target')
        need(isinstance(target, str) and 0 < len(target) <= 4096 and '\0' not in target, 'LINK_TARGET')
        need(not target.startswith('/') or target.startswith(BASE), 'LINK_ESCAPE')
        need(result['links'] == 1, 'LINK_ALIAS')
        result['link'] = target
    else:
        need(result['mode'] & 0o500 == 0o500, 'DIRECTORY_SEARCH')
    return result


def typed_tree(rows, root):
    need(isinstance(rows, list) and 0 < len(rows) <= 100000, 'INVENTORY_COUNT')
    entries = {}
    for row in rows:
        path = row.get('path'); safe_path(path)
        need(path not in entries, 'DUPLICATE_PATH')
        entries[path] = entry(row)
    result = {'root': entry(root), 'entries': entries}
    need(result['root']['kind'] == 'directory', 'ROOT_TYPE')
    return result


def stub_bytes(source):
    result = {}
    for key in ('SHELL', 'JS'):
        matches = re.findall(r'const\s+' + key + r'\s*:\s*&\[u8\]\s*=\s*(b"(?:[^"\\]|\\.)*")\s*;', source)
        need(len(matches) == 1, 'RETIREMENT_SOURCE_LITERAL')
        result[key] = ast.literal_eval(matches[0])
        need(isinstance(result[key], bytes) and result[key], 'RETIREMENT_BYTES')
    return result


def initial_files(tree, stubs):
    regular = {p: e for p, e in tree['entries'].items() if e['kind'] == 'file'}
    need(MUTABLE <= regular.keys(), 'MISSING_FIXED_APP_SLOT')
    need(len(regular) <= 4096, 'APP_FACE_LIMIT')
    return [{'path': p, 'sha256': sha(stubs[RETIRED[p]]) if p in RETIRED else e['sha256'],
             'mutable': p in MUTABLE, 'mode': e['post_mode'], 'gid': e['post_gid']}
            for p, e in sorted(regular.items())]


def loader_payloads(manifest, directory):
    selected = [p for p in manifest['payloads'] if p['destination'].startswith(BASE + 'node-runtime/')]
    need(len(selected) == 22, 'NODE_CLOSURE_COUNT')
    files, blobs = [], {}
    for p in selected:
        relative = p['destination'].removeprefix(BASE + 'node-runtime/')
        need(re.fullmatch(r'(bin/node|lib/[A-Za-z0-9._-]+)', relative), 'NODE_PAYLOAD_PATH')
        need(re.fullmatch(r'payload-\d\d', p['blob']) and p['mode'] == 0o555, 'NODE_PAYLOAD_MANIFEST')
        raw = (directory / p['blob']).read_bytes()
        need(len(raw) == p['size'] and sha(raw) == digest(p['sha256']), 'NODE_PAYLOAD_BYTES')
        need(relative not in blobs, 'DUPLICATE_NODE_PAYLOAD')
        blobs[relative] = p['sha256']
        files.append({'path': p['destination'], 'sha256': p['sha256']})
    need('bin/node' in blobs, 'NODE_EXECUTABLE')
    return sorted(files, key=lambda f: f['path']), blobs


def templates(service, trees, loader_files, supplement, stubs, platform, acl):
    config = copy.deepcopy(service)
    need(config['socket_ancestor'] is None and set(config['catalog']['profiles']) == {'dsh-app'}, 'ORIGINAL_CONFIGURATION')
    profile = config['catalog']['profiles']['dsh-app']
    need(not profile['enabled'] and profile['repo'] == 'mayf3/dsh-agent-core', 'ORIGINAL_PROFILE')
    need(config['catalog']['keys']['local-verifier']['role'] == 'VERIFIER', 'REAL_VERIFIER')
    profile['enabled'] = True
    need(WATCHDOG not in profile['verification_profiles'], 'PROFILE_ALREADY_CHANGED')
    profile['verification_profiles'].append(WATCHDOG)
    profile['goal_verifiers'][WATCHDOG] = 'local-verifier'
    config['verifiers'][WATCHDOG] = {'kind': 'external-observation', 'deadline_ms': 2000}
    config['first_target_adoption'] = OPERATION
    observed = supplement['socket_ancestor']
    need(acl['exit'] == 0 and acl['argv'] == ['/bin/ls', '-ldeO', '/private/var/run'] and
         len(acl['stdout'].splitlines()) == 1 and acl['stdout'].startswith('drwxrwxr-x  '), 'SOCKET_ACL_INPUT')
    config['socket_ancestor'] = dict(host=profile['host'], device=observed['dev'], inode=observed['ino'],
        uid=observed['uid'], gid=observed['gid'], mode=observed['mode'], flags=observed['flags'], acl_none=True,
        memberships={uid: row['groups'] for uid, row in supplement['groups'].items()})
    need(observed['uid'] == 0 and observed['gid'] == 1 and observed['mode'] == 0o775 and observed['flags'] == 0,
         'SOCKET_PHYSICAL_INPUT')
    need(set(supplement['groups']) == {'502', '505'} and all(1 not in r['groups'] for r in supplement['groups'].values()), 'SOCKET_GROUPS')
    services = []
    for kind, label, uid, gid in [('Runtime', 'runtime', 505, 601), ('WatchdogW1', 'scheduler-watchdog-w1', 505, 601), ('WatchdogW2', 'scheduler-watchdog-w2', 0, 0)]:
        row = supplement['services']['ai.agent-core.' + label]
        need((row['uid'], row['gid']) == (uid, gid), 'SERVICE_IDENTITY_INPUT')
        expected = [BASE + 'node-runtime/bin/node', BASE + 'app/scripts/' + ('production-runtime.mjs' if kind == 'Runtime' else 'scheduler-watchdog.mjs')]
        expected += ['--root', '/Users/authsvc/.agent-core', '--catchup', '0'] if kind == 'Runtime' else ['--role', 'w1' if kind == 'WatchdogW1' else 'w2']
        need(row['ProgramArguments'] == expected, 'SERVICE_ARGV_INPUT')
        services.append(dict(kind=kind, uid=uid, gid=gid, plist_sha256=digest(row['sha256'])))
    inert = copy.deepcopy(profile); inert['enabled'] = False
    node = next(f['sha256'] for f in loader_files if f['path'] == BASE + 'node-runtime/bin/node')
    native = dict(host=profile['host'], caller_uids=[c['uid'] for c in config['callers']],
        required_facets=['app-slots', 'node-closure', 'service-plists'], profile_revision=profile['revision'],
        profile_id='dsh-app', profile_digest=sha(canonical(inert)), initial_files=initial_files(trees[0], stubs),
        runtime_root='/Users/authsvc/.agent-core', runtime_startup='catchup-zero', node_sha256=node,
        loader_files=loader_files, launchctl_sha256=platform['/bin/launchctl'], plutil_sha256=platform['/usr/bin/plutil'], services=services)
    need(config['catalog']['keys'] == service['catalog']['keys'], 'KEYS_CHANGED')
    return config, native


def link_issues(trees):
    from collections import deque
    issues = []
    for index, tree in enumerate(trees):
        for path, original in tree['entries'].items():
            if original['kind'] != 'link':
                continue
            todo, resolved, hops = deque((NAMES[index] + '/' + path).split('/')), [], 0
            chain, jumps, missing = {}, [], None
            try:
                while todo:
                    part = todo.popleft()
                    if part in ('', '.'):
                        continue
                    if part == '..':
                        need(resolved, 'LINK_ESCAPE'); resolved.pop(); continue
                    safe_path(part); resolved.append(part)
                    need(resolved[0] in NAMES, 'LINK_ESCAPE')
                    target_tree = trees[NAMES.index(resolved[0])]
                    e = target_tree['root'] if len(resolved) == 1 else target_tree['entries'].get('/'.join(resolved[1:]))
                    absolute = BASE + '/'.join(resolved)
                    if e is None:
                        missing = absolute
                        raise ValueError('LINK_DANGLING')
                    chain[absolute] = e
                    if e['kind'] == 'link':
                        hops += 1; need(hops <= 40, 'LINK_CYCLE'); resolved.pop()
                        target = e['link']; jumps.append({'path': absolute, 'target': target})
                        if target.startswith('/'):
                            need(target.startswith(BASE), 'LINK_ESCAPE')
                            resolved.clear(); target = target[len(BASE):]
                        todo.extendleft(reversed(target.split('/')))
                    elif todo:
                        need(e['kind'] == 'directory', 'LINK_NOT_DIRECTORY')
                need(resolved, 'LINK_ESCAPE')
            except ValueError as error:
                lexical = posixpath.normpath(posixpath.join(BASE + NAMES[index], posixpath.dirname(path), original['link']))
                issues.append({'code': str(error), 'tree': NAMES[index], 'path': path,
                    'raw_link': original['link'], 'missing_path': missing, 'missing_final_leaf': missing is not None and not todo,
                    'lexically_resolved_target': lexical,
                    'remaining_components': list(todo), 'symlink_chain': jumps,
                    'ancestor_chain': [{'path': p, 'entry': e} for p, e in chain.items() if e['kind'] == 'directory']})
    return issues


def closed_aliases(trees):
    for index, tree in enumerate(trees):
        aliases = {}
        for e in tree['entries'].values():
            if e['kind'] == 'file':
                aliases.setdefault((e['device'], e['inode']), []).append(e)
        pairs = 0
        for rows in aliases.values():
            first = rows[0]
            need(len(rows) == first['links'] and (len(rows) == 1 or index == 1 and len(rows) == 2), 'OPEN_ALIAS')
            need(all(e == first for e in rows), 'ALIAS_DRIFT')
            pairs += len(rows) == 2
        need(pairs <= 3, 'OPEN_ALIAS')


def closed_links(trees):
    closed_aliases(trees)
    _, issues = negative_edges(trees, link_issues(trees))
    need(not issues, 'LINK_DANGLING_OR_UNSAFE:' + (issues[0]['path'] if issues else ''))


def negative_edges(trees, issues):
    """Mirror only the four compiled REUSE edges; no caller allowlist or new bytes."""
    a = 'node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.220_@anthropic-ai+sdk@0.93.0_zod@4.4.3__@modelcontex_57ba44dcbc2a36491e18d36fec520472/node_modules/@anthropic-ai'
    b = 'node_modules/.pnpm/@openai+codex@0.147.0/node_modules/@openai'
    expected = []
    for source, target, leaf, package, hashvalue in [(a, '@anthropic-ai+claude-agent-sdk-darwin-x64@0.3.220/node_modules/@anthropic-ai', 'claude-agent-sdk-darwin-x64', 'claude-agent-sdk', '1c9d0905f64e126850efe4fc4e7244c604a0855de8d4c82aff78da6f1988bd08'),
            (b, '@openai+codex@0.147.0-darwin-x64/node_modules/@openai', 'codex', 'codex', 'bbaf3b9597b54bc1d4cf4aea93870e9035629d79bdaba58234011c31f0cfcf3d')]:
        name = 'codex-darwin-x64' if package == 'codex' else leaf
        for path, up in [(source+'/'+name, '../../..'), ('node_modules/.pnpm/node_modules/'+source.split('/')[-1]+'/'+name, '../..')]:
            expected.append(dict(source=path, raw=up+'/'+target+'/'+leaf, missing='node_modules/.pnpm/'+target,
                leaf=leaf, manifest=source+'/'+package+'/package.json', hash=hashvalue))
    tree = trees[1]; entries = tree['entries']
    if not any(r['source'] in entries for r in expected):
        return [], issues
    need(tree['root']['kind'] == 'directory', 'NEGATIVE_ANCESTOR')
    for r in expected:
        e = entries.get(r['source'], {})
        need(e.get('kind') == 'link' and e.get('link') == r['raw'], 'NEGATIVE_SOURCE')
        for path in (r['source'], r['manifest'], r['missing']):
            parts = path.split('/')
            need(all(entries.get('/'.join(parts[:i]), {}).get('kind') == 'directory' for i in range(1, len(parts))), 'NEGATIVE_ANCESTOR')
        e = entries.get(r['manifest'], {})
        need(e.get('kind') == 'file' and e.get('sha256') == r['hash'], 'NEGATIVE_MANIFEST')
        need(not any(p == r['missing'] or p.startswith(r['missing']+'/') for p in entries), 'NEGATIVE_BECAME_PRESENT')
    allowed, unresolved = [], []
    for issue in issues:
        match = any(issue['tree'] == 'harness' and issue['path'] == r['source'] and issue['raw_link'] == r['raw']
            and issue['code'] == 'LINK_DANGLING' and issue['missing_path'] == BASE+'harness/'+r['missing']
            and issue['remaining_components'] == [r['leaf']] and issue['symlink_chain'] == [{'path':BASE+'harness/'+r['source'], 'target':r['raw']}]
            for r in expected)
        (allowed if match else unresolved).append(issue)
    need(len(allowed) == 4, 'NEGATIVE_SET')
    return allowed, unresolved


def package_context(issues, trees):
    """Read only pinned public manifests associated with failing virtual-store links."""
    cache = {}
    for issue in issues:
        tree = trees[NAMES.index(issue['tree'])]
        parts = issue['path'].split('/')
        prefix = '/'.join(parts[:4]) + '/' if parts[:2] == ['node_modules', '.pnpm'] else ''
        candidates = [p for p, e in tree['entries'].items() if e['kind'] == 'file' and p.endswith('/package.json')
                      and p.startswith(prefix) and len(p.removeprefix(prefix).split('/')) in (2, 3)] if prefix else []
        records = []
        for relative in candidates:
            path = Path(BASE + issue['tree']) / relative
            if str(path) not in cache:
                value, source = document(path, tree['entries'][relative]['sha256'])
                cache[str(path)] = dict(source, fields={k: value[k] for k in ('name', 'version', 'os', 'cpu', 'optionalDependencies') if k in value})
            records.append(cache[str(path)])
        issue['public_package_manifests'] = records
    for issue in issues:
        issue['same_missing_namespace_manifest_context'] = [record for other in issues
            if not issue['public_package_manifests'] and other['missing_path'] == issue['missing_path']
            for record in other['public_package_manifests']]
    return issues


def prepare(args):
    need(os.geteuid() != 0, 'NONROOT_PREPARATION_ONLY')
    census = ARTIFACTS / 'first-live-preparation/ordinary-census'
    sources, inputs = {}, {}
    for name, expected in PINS.items():
        inputs[name], sources[name] = document(census / name, expected)
    service_path = ARTIFACTS / 'genesis-65559dd-20260918-01/reconciliation-bcfd929/login-failure-readback/observation-once/140-readonly-postinstall.stdout'
    service, sources['protected-service-export'] = document(service_path, SERVICE_SHA)
    closure = ARTIFACTS / 'reviewed-node-8ab5904'
    manifest, sources['node-closure-manifest'] = document(closure / 'manifest.json', MANIFEST_SHA)
    acl, sources['socket-ordinary-acl'] = document(census / 'socket-acl-static-input.json', '9257cd7d2b62fce6f9ab60bc4106f15fc37609ec76b6b345a16ee7680b618e1f')
    absent, sources['retirement-path-observation'] = document(census / 'retirement-path-static-input.json', '6a72a8b5327d6e1825f24202aade74925899ab9e8261ff1fd565790fe7743fb1')
    supplement = inputs['static-input-supplement-v4.json']
    all_rows = inputs['ordinary-app-harness-inventory-v7-02.json']['roots']
    node = inputs['node-inventory.json']
    need(node['root'] == BASE + 'node-runtime', 'NODE_ROOT_BINDING')
    trees = []
    for name in NAMES:
        source = supplement['roots'][BASE + name]
        need(source['descriptor_inode_matches'], 'ROOT_DESCRIPTOR_INPUT')
        root = dict(source, device=source['dev'], inode=source['ino'])
        if name == 'node-runtime':
            for k in ('uid', 'gid', 'mode', 'device', 'inode', 'flags'):
                need(root[k] == node['root_metadata'][k], 'NODE_ROOT_DRIFT')
            rows = node['entries']
        else:
            rows = all_rows[BASE + name]['entries']
        trees.append(typed_tree(rows, root))
    closed_aliases(trees)
    observed_issues = package_context(link_issues(trees), trees)
    negatives, issues = negative_edges(trees, observed_issues)
    retirement = args.operator_source / 'packages/deployment-control-plane/src/first_live/retirement.rs'
    raw = retirement.read_bytes(); stubs = stub_bytes(raw.decode())
    sources['retirement-source'] = {'path': str(retirement), 'sha256': sha(raw)}
    loaders, payloads = loader_payloads(manifest, closure)
    config, native = templates(service, trees, loaders, supplement, stubs, manifest['platform_tools'], acl)
    missing_retirement = sorted(set(RETIRED) - trees[0]['entries'].keys())
    need(all(absent['paths'][BASE + 'app/' + p] == {'errno': 2, 'error': 'No such file or directory'} for p in missing_retirement), 'RETIREMENT_ABSENCE_NOT_OBSERVED')
    outputs = {name + '-inventory.json': tree for name, tree in zip(NAMES, trees)}
    outputs.update({'configuration-template.json': config, 'native-enrollment-template.json': native,
                    'node-payloads.json': payloads, 'retirement-sha256.json': {p: sha(stubs[k]) for p, k in RETIRED.items() if p not in missing_retirement},
                    'link-closure-blockers.json': {'status': 'BLOCKED' if issues else 'NO_UNRECOGNIZED_STATIC_LINKS', 'issues': issues, 'preserved_negative_edges': negatives},
                    'absent-retirement-paths.json': {'status': 'BLOCKED_CURRENT_RETIREMENT_ASSUMPTION', 'paths': missing_retirement, 'observation': absent}})
    encoded = {name: canonical(value) for name, value in outputs.items()}
    index = {'version': 1, 'operation_id': OPERATION, 'scope': 'STATIC_UNTRUSTED_PREPARATION_INPUTS_NOT_EXECUTED_PROOF',
             'status': 'BLOCKED' if issues or missing_retirement else 'STATIC_INPUTS_PREPARED_NOT_ADMISSION', 'link_blockers': len(issues), 'preserved_negative_edges': len(negatives), 'absent_retirement_paths': missing_retirement,
             'sources': sources, 'converter_sha256': sha(Path(__file__).read_bytes()), 'schema_sources': {}, 'files': {name: {'sha256': sha(raw), 'bytes': len(raw)} for name, raw in encoded.items()},
             'counts': {name: {kind: sum(e['kind'] == kind for e in tree['entries'].values()) for kind in ('file', 'directory', 'link')} for name, tree in zip(NAMES, trees)},
             'initial_app_slots': len(native['initial_files']), 'mutable_app_slots': sorted(MUTABLE), 'loader_files': len(loaders),
             'omitted_derived_fields': ['denial_receipt', 'lifecycle_denial_digest', 'login_receipt', 'controller_sha256', 'signatures', 'PASS'],
             'limits': ['ordinary non-atomic census requires protected current preflight', 'harness root metadata supplements missing prior root tuple', 'no installation or service calls performed', 'current groups/ACL/root metadata must be revalidated under native guard']}
    for name in ('first_live/inventory.rs', 'first_live/native_effects/link_graph.rs', 'first_live/native_effects/negative_edges.rs', 'first_live/template.rs', 'transaction/native_profile.rs', 'bootstrap/socket.rs'):
        path = args.operator_source / 'packages/deployment-control-plane/src' / name
        index['schema_sources'][name] = sha(path.read_bytes())
    need(not args.out.exists(), 'OUTPUT_ALREADY_EXISTS')
    args.out.mkdir(mode=0o700, parents=True)
    for name, raw in {**encoded, 'index.json': canonical(index)}.items():
        with (args.out / name).open('xb') as file:
            file.write(raw)
    print(json.dumps({'output': str(args.out), 'index_sha256': sha(canonical(index)), 'counts': index['counts']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator-source', type=Path, required=True)
    parser.add_argument('--out', type=Path, default=ARTIFACTS / 'first-live-preparation/static-inputs-v1')
    prepare(parser.parse_args())
