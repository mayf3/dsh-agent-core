"""Execute original guard/predicate AST, retaining source adjacency coordinates."""
import ast
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from fw_fixture import CURRENT, HERE, authenticate, effect, fixture
from authority_validation.reader import canonical, seal
from boundary_harness import BoundaryHarness


def guards():
    for name in ('window_helper.py', 'window_preimage_xattr.py'):
        source = (HERE / name).read_text()
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'effect_guard':
                following = []
                for parent in ast.walk(tree):
                    for value in vars(parent).values():
                        if not isinstance(value, list):
                            continue
                        for index, statement in enumerate(value):
                            if isinstance(statement, ast.Expr) and statement.value is node:
                                following = value[index + 1:index + 4]
                yield name, node, following


def executable_guards(case):
    total = 0
    for filename, node, following in guards():
        operations = ('staging.chown', 'staging.chmod') if isinstance(node.args[0], ast.Name) else (ast.literal_eval(node.args[0]),)
        for operation in operations:
            with BoundaryHarness() as h:
                values = dict(vars(h.core), effect_guard=h.core.effect_guard, operation=operation,
                    backup=h.root / 'backup', parent=h.root / 'backup-parent', p=h.root / 'source-file',
                    dst=h.root / 'destination', src=h.root / 'source-file', target=h.root / 'preimage',
                    tmp=h.root / 'runtime.plist.tmp', path=h.root / 'xattr-file', b=h.root / 'bundle',
                    template='/private/tmp/fleet-binding-window-v5.XXXXXX', argv=['/fixed/fixture-executable'],
                    holder='fixture-holder', m={'uid': 502, 'gid': 20, 'mode': '0o600'},
                    name='com.fwav.empty', row={'sha256': 'a' * 64}, data=b'fixture-plist-bytes')
                h.core.save('c7-close.json', {'window_id': 'fixture-window', 'names': {'mapped_diff_empty': True}})
                captured = []
                capture_values = dict(values, effect_guard=lambda *args, **kwargs: captured.append((args, kwargs)))
                expression = compile(ast.Expression(node), str(HERE / filename), 'eval')
                eval(expression, capture_values)
                args, keywords = captured[0]
                parameters = args[2] if len(args) > 2 else {}
                h.prepare([(args[0], args[1], parameters)], mutex=not keywords.get('acquire', False))
                values['effect_guard'] = h.core.effect_guard
                case.inputs.append(seal({'mandate': h.a, 'observation': h.observation}))
                if keywords.get('internal'):
                    case.reject(lambda: eval(expression, values), operation, 'internal per-write control UNKNOWN')
                else:
                    eval(expression, values)
                    h.observation['lifecycle']['state'] = 'REVOKED'
                    case.reject(lambda: eval(expression, values), operation + ':fresh-revoked')
                case.eq(h.calls, [])
                if not keywords.get('acquire'):
                    case.check(h.core.lock.exists(), operation + ':held mutex')
                # The actual effect is outside the validator and is never invoked here.
                # Adjacency is inspected from the original source; child internals remain UNKNOWN.
                successor = ' | '.join(ast.unparse(item) for item in following)
                case.check(bool(successor) or operation in ('settlement.commit', 'installer.execute'), operation)
                print(json.dumps({'boundary': operation, 'source': filename, 'line': node.lineno,
                    'STATIC_ADJACENCY': successor[:300], 'EXECUTED_GUARD': 'REFUSED',
                    'targetCalls': 0, 'internalPerWrite': 'UNKNOWN' if keywords.get('internal') else 'NOT_A_CHILD',
                    'inputSha256': seal({'mandate': h.a, 'observation': h.observation}),
                    'selector': h.a['appointmentRef']['selector'], 'query': h.observation['query']}, ensure_ascii=False))
                total += 1
    case.check(total >= 27, 'guard trace must cover all source call sites plus metadata loop cases')


def branch_body(name):
    tree = ast.parse((HERE / 'window_helper.py').read_text())
    node = next(item for item in tree.body if isinstance(item, ast.If))
    while ast.literal_eval(node.test.comparators[0]) != name:
        node = node.orelse[0]
    return ast.Module(body=node.body, type_ignores=[])


def predicate(branch, marker):
    for node in ast.walk(branch_body(branch)):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'require' and len(node.args) > 1:
            if marker in ast.unparse(node.args[1]):
                return node
    raise AssertionError('retained predicate missing: ' + marker)


def retained_predicates(case):
    with BoundaryHarness() as h:
        a, observation = fixture()
        c = {'ok': True, 'wrapperRc': 0, 'result': {'ready': True, 'pluginTreeFailed': False, 'missingPackages': []},
             'noFatal': True, 'childTerminated': True, 'candidate': str(h.core.prep / 'scratch')}
        b = {'ok': True, 'wrapperRc': 0, 'checks': {str(i): True for i in range(16)},
             'close': {'code': 0, 'signal': None}, 'candidate': str(h.core.prep / 'scratch')}
        provenance = {'source_head_sha': h.core.sha, 'source_tree_sha': h.core.tree, 'source_clean': 'yes',
                      'generation_label_sha': h.core.sha, 'main_repo_realpath': str(h.core.source)}
        env = dict(vars(h.core), a=a, path=h.core.source, head=h.core.sha, tr=h.core.tree, status='',
                   st=a['expected_harness_stamp'], files={'one'}, links=[], old=[], c=c, b=b, actual={'one'},
                   expected={'one'}, changes=[], provenance=provenance, require=h.core.require)
        rows = [
            ('sources', 'dirty source/Harness', {'status': ' M changed'}),
            ('sources', 'source coordinates changed', {'head': 'other'}),
            ('sources', 'source coordinates changed', {'tr': 'other-tree'}),
            ('sources', 'Harness stamp differs', {'st': 'other-harness'}),
            ('bundle', 'bundle file membership differs', {'actual': {'one', 'extra'}}),
            ('prerequisites', 'accepted candidate/r2 file membership changed', {'files': {'extra'}}),
            ('prerequisites', 'accepted symlink bindings changed', {'links': [{'target': 'other'}]}),
            ('prerequisites', 'fresh-child canary not PASS', {'c': dict(c, childTerminated=False)}),
            ('prerequisites', 'full runtime not PASS', {'b': dict(b, checks={})}),
            ('prerequisites', 'dual candidate binding differs', {'b': dict(b, candidate='other')}),
            ('final-binding', 'final closure differs', {'changes': ['app/drift']}),
            ('final-binding', 'final provenance mismatch', {'provenance': dict(provenance, source_tree_sha='other')}),
        ]
        # The membership check's `a` is its original manifest record map.
        for branch, marker, change in rows:
            node = predicate(branch, marker)
            expression = compile(ast.Expression(node), str(HERE / 'window_helper.py'), 'eval')
            local = dict(env)
            if branch == 'prerequisites' and marker == 'accepted candidate/r2 file membership changed':
                local['a'] = {'one': 'hash'}
            eval(expression, local)
            local.update(change)
            case.reject(lambda: eval(expression, local), marker)
            print(json.dumps({'retainedGate': marker, 'sourceLine': node.lineno,
                              'EXECUTED_ORIGINAL_PREDICATE': 'REFUSED', 'targetCalls': 0}))
        h.core.plist.write_text('expected live plist')
        a['expected_plist_sha256'] = h.core.digest(h.core.plist)
        local = dict(env, a=a, plist=h.core.plist)
        node = predicate('fresh', 'plist preimage differs')
        expression = compile(ast.Expression(node), str(HERE / 'window_helper.py'), 'eval')
        eval(expression, local)
        h.core.plist.write_text('drift live plist')
        case.reject(lambda: eval(expression, local), 'expected-live plist drift')
