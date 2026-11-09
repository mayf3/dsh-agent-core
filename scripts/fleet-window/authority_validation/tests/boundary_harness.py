"""Execute real core/dispatcher on disposable paths; stub only external effects/readback."""
import ast
from contextlib import ExitStack
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest import mock
from fw_fixture import CURRENT, FixtureReader, HERE, authenticate, effect, fixture
from authority_validation.reader import seal


class BoundaryHarness:
    def __enter__(self):
        self.stack = ExitStack()
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory(prefix='fwav-boundary-'))).resolve()
        self.rd = self.root / 'receipts'
        self.rd.mkdir()
        argv = [str(HERE / 'window_helper.py'), str(self.rd), 'isolated-fixture']
        with mock.patch.object(sys, 'argv', argv):
            spec = importlib.util.spec_from_file_location('fwav_isolated_core', HERE / 'window_helper_core.py')
            self.core = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self.core)
        self.core.rd = self.rd
        self.core.lock = self.root / 'production-mutex'
        self.core.live = self.root / 'runtime'
        self.core.plist = self.root / 'runtime.plist'
        self.core.source = self.root / 'source'
        self.core.prod = self.root / 'production'
        self.core.source.mkdir()
        self.core.live.mkdir()
        self.calls = []
        self.stack.enter_context(mock.patch.object(self.core.time, 'time', return_value=CURRENT))
        return self

    def __exit__(self, *exc):
        return self.stack.__exit__(*exc)

    def prepare(self, operations, mutex=True):
        rows = []
        for operation, target, parameters in operations:
            row = effect(operation, target, parameters)
            row['runtime'] = str(self.core.live)
            rows.append(row)
        self.a, self.observation = fixture(rows)
        self.reader = FixtureReader(self.observation)
        self.core.authority_reader = self.reader
        self.core.save('authority.json', self.a)
        if mutex:
            self.core.lock.mkdir()
            holder = 'window=' + self.a['window_id'] + '\n'
            (self.core.lock / 'holder').write_text(holder)
            self.core.save('mutex.json', {'path': str(self.core.lock), 'sha256': self.core.digest(self.core.lock / 'holder'), 'identity': [self.core.lock.stat().st_dev, self.core.lock.stat().st_ino, self.core.lock.stat().st_uid]})
        return self

    def external(self, argv, **kwargs):
        self.calls.append(list(map(str, argv)))
        return subprocess.CompletedProcess(argv, 0, b'', b'')

    def branch(self, name, extra=None):
        node = next(n for n in ast.parse((HERE / 'window_helper.py').read_text()).body if isinstance(n, ast.If))
        while ast.literal_eval(node.test.comparators[0]) != name:
            node = node.orelse[0]
        namespace = dict(vars(self.core), run=self.external, args=[], identity=lambda pid: 'old-process',
                         service_absent=lambda *args, **kwargs: None)
        if extra:
            namespace.update(extra)
        exec(compile(ast.Module(body=node.body, type_ignores=[]), str(HERE / 'window_helper.py'), 'exec'), namespace)

    def authorize_again(self):
        authenticate(self.a, self.observation)
        self.core.save('authority.json', self.a)

    def bootout_inputs(self):
        self.core.plist.write_text('isolated plist')
        self.core.save('old-process.json', {'pid': 1, 'identity': 'old-process'})
        self.core.save('old-workers-at-bootout.json', [])
        self.core.save('plist-preimage.json', {'sha256': self.core.digest(self.core.plist)})

    def bootstrap_inputs(self):
        self.core.plist.write_text('isolated plist')
        self.core.save('final-binding.json', {'config': 'PRODUCTION_PREIMAGE_PRESERVED'})
        self.core.save('plist-after.json', {'sha256': self.core.digest(self.core.plist)})

    def release_inputs(self):
        self.core.save('c7-close.json', {'window_id': self.a['window_id'], 'names': {'mapped_diff_empty': True}})
        self.core.save('stage_11_production_verify.json', {'status': 'PASS'})
        self.core.save('stage_12_hr_watch.json', {'status': 'PASS'})
        return self.core.digest(self.rd / 'c7-close.json')


def refusal_driver(category, trace_path):
    with BoundaryHarness() as h:
        argv = ['/bin/launchctl', 'bootout', 'system', str(h.core.plist)]
        h.prepare([('runtime.bootout', h.core.plist, {'argv': argv})])
        h.bootout_inputs()
        changes = {
            'unappointed': lambda: h.observation['caller'].update(relation='REQUEST_BODY'),
            'scope': lambda: h.observation['lifecycle'].update(scope=[]),
            'expired': lambda: h.observation['lifecycle'].update(validUntil='2026-11-09T12:00:00Z'),
            'revoked': lambda: h.observation['lifecycle'].update(state='REVOKED'),
            'drift': lambda: h.observation.update(controlVersion='changed'),
            'gate': lambda: h.observation['evidence'].pop('EVD:criterion:1'),
        }
        changes[category]()
        try:
            h.branch('bootout')
        finally:
            Path(trace_path).write_text(json.dumps({'effectCalls': len(h.calls), 'readerCalls': h.reader.calls,
                'mandateSha256': seal(h.a), 'registryBytesSha256': hashlib.sha256(h.observation['registryBytes'].encode()).hexdigest(),
                'observationSha256': seal(h.observation), 'query': h.observation['query'],
                'appointmentRef': h.a['appointmentRef'], 'stage': 'runtime.bootout',
                'effect': h.a['requestedEffects'][0], 'callerSource': 'PROCESS_EXTERNAL boundary fixture'}))
