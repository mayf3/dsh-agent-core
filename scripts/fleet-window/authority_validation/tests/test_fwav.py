"""ACC-FWAV-001..016: real validator/dispatcher; isolated external observations/effects."""
import ast
from copy import deepcopy
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from fw_fixture import (AUTHOR_BASE, AUTHOR_HEAD, BASE, CURRENT, HERE, SPEC, EXCLUSIONS,
                        FixtureReader, authenticate, effect, fixture)
from authority_validation.checks import stamp, validate
from authority_validation.reader import RegistryReader, canonical, read_registry, seal
from boundary_harness import BoundaryHarness
from boundary_trace import executable_guards, retained_predicates


class Acceptance(unittest.TestCase):
    def setUp(self):
        self.assertion_count = 0
        self.refusals = 0
        self.effect_calls = 0
        self.inputs = []

    def eq(self, actual, expected, message=None):
        self.assertion_count += 1
        self.assertEqual(actual, expected, message)

    def check(self, condition, message=None):
        self.assertion_count += 1
        self.assertTrue(condition, message)

    def reject(self, action, label, contains=None):
        self.assertion_count += 1
        try:
            action()
        except (RuntimeError, ValueError, TypeError, KeyError, OSError) as error:
            if contains:
                self.check(contains in str(error), label + ': ' + str(error))
            self.refusals += 1
            return str(error)
        self.fail('expected refusal: ' + label)

    def positive(self, a=None, observation=None, **kwargs):
        if a is None:
            a, observation = fixture()
        authenticate(a, observation)
        self.inputs.append(seal(a))
        result = validate(a, observation, kwargs.pop('current', CURRENT), **kwargs)
        self.eq(result['selector'], a['appointmentRef']['selector'])
        return result

    def negative(self, change, label, **kwargs):
        a, observation = fixture()
        change(a, observation)
        authenticate(a, observation)
        self.inputs.append(seal(a))
        return self.reject(lambda: validate(a, observation, kwargs.pop('current', CURRENT), **kwargs), label)

    def test_ACC_001_authoring_isolation(self):
        output = subprocess.check_output(['git', 'diff', '--name-status', AUTHOR_BASE, AUTHOR_HEAD], text=True)
        rows = [line.split('\t') for line in output.splitlines()]
        self.eq(rows, [['A', 'BRIEF-D1-D2-VALIDATOR-PROPOSAL.md'], ['A', SPEC]])
        body = subprocess.check_output(['git', 'show', AUTHOR_HEAD + ':' + SPEC], text=True)
        self.check('\nstatus: proposed\n' in body)
        self.check('production_apply_authority: none' in body)
        names = subprocess.check_output(['git', 'diff', '--name-only', BASE], text=True).splitlines()
        names += subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], text=True).splitlines()
        self.check(all(name.startswith('scripts/fleet-window/') or name in
                       ('BRIEF-D1D2-IMPL.md', 'RECEIPT-D1D2-IMPL.md') for name in names), names)

    def test_ACC_002_sra_and_issuer(self):
        self.positive()
        for name, change in (
            ('unmerged', lambda a, o: o['sra'].update(acceptedInMain=False)),
            ('self-effective', lambda a, o: o['evidence'].pop('EVD:effective')),
            ('unauthorized-issuer', lambda a, o: o['issuer'].update(authorized=False)),
            ('arbitrary-sra', lambda a, o: a['sraRef'].update(sha256='f' * 64)),
            ('arbitrary-source', lambda a, o: a['issuerRef'].update(authoritySource='/tmp/self-written')),
        ):
            with self.subTest(case=name):
                self.negative(change, name)

    def test_ACC_003_selector_hash_lifecycle(self):
        self.positive()
        for name, change in (
            ('zero-selector', lambda a, o: a['appointmentRef'].update(selector='$.appointments[id=absent]')),
            ('index-selector', lambda a, o: a['appointmentRef'].update(selector='$.appointments[0]')),
            ('boolean-revision-type', lambda a, o: a['appointmentRef'].update(revision=True)),
            ('hash-drift', lambda a, o: a['appointmentRef'].update(canonicalSha256='f' * 64)),
            ('duplicate-selector', lambda a, o: o.update(registryBytes=o['registryBytes'].replace(
                '"appointments": [', '"appointments": [' + json.dumps(json.loads(o['registryBytes'])['appointments'][0]) + ', '))),
            ('duplicate-key', lambda a, o: o.update(registryBytes='{"appointments": [], "appointments": []}')),
            ('non-json-constant', lambda a, o: o.update(registryBytes='{"appointments": NaN}')),
            ('nonfinite-json-number', lambda a, o: o.update(registryBytes='{"appointments": 1e999}')),
        ):
            self.negative(change, name)
        for state in ('NOMINATED', 'CONDITIONAL', 'NOT_EFFECTIVE', 'REPLACED', 'REVOKED', 'UNKNOWN'):
            self.negative(lambda a, o: o['lifecycle'].update(state=state), state)
        with tempfile.TemporaryDirectory(prefix='fwav-registry-') as directory:
            path = Path(directory) / 'fixture.json'
            path.write_text('{"rulings": []}')
            self.eq(read_registry(path), {'rulings': []})
            path.write_text('{"rulings": [], "rulings": []}')
            self.reject(lambda: read_registry(path), 'strict-reader')

    def test_ACC_004_real_caller_and_continuity(self):
        for field, value in (('principal', 'captain'), ('uid', 0), ('session', 'new-unproven')):
            self.negative(lambda a, o: a['callerRef'].update({field: value}), 'spoof-' + field)
        self.negative(lambda a, o: o['caller'].update(relation='REQUEST_BODY'), 'body-identity')
        self.negative(lambda a, o: a.update(attempt=2), 'attempt-reset')
        a, o = fixture()
        a['callerRef']['session'] = o['caller']['session'] = 'sw2'
        a['participants']['W']['session'] = o['actors']['role:W']['session'] = 'sw2'
        o['mandate']['participants'] = deepcopy(a['participants'])
        o['evidence']['EVD:writer-continuity'].update(subject=a['window_id'], **{'from': 'sw', 'to': 'sw2'})
        self.positive(a, o)
        self.eq(a['attempt'], 1)
        self.eq(a['valid_until'], '2026-11-09T12:30:00Z')
        o['evidence'].pop('EVD:writer-continuity')
        self.reject(lambda: validate(a, o, CURRENT), 'new-session-without-proof')
        with mock.patch.dict(os.environ, {'CALLER_PRINCIPAL': 'captain', 'CALLER_UID': '0'}):
            self.negative(lambda a, o: o['caller'].update(relation='ENV'), 'env-spoof')

    def test_ACC_005_roles_conflicts(self):
        self.positive()
        for left, right in (('C', 'A'), ('C', 'W'), ('C', 'V'), ('W', 'V'), ('A', 'V')):
            a, o = fixture()
            o['actors']['role:' + left]['actor'] = o['actors']['role:' + right]['actor']
            self.reject(lambda: validate(a, o, CURRENT), left + '-' + right)
        self.negative(lambda a, o: a['participants'].update(A=[]), 'omitted-author')
        self.negative(lambda a, o: o['rolePolicy'].update({'A-W': None}), 'unknown-policy')
        a, o = fixture()
        o['actors']['role:A']['actor'] = o['actors']['role:W']['actor']
        self.positive(a, o)
        # Different session labels cannot erase real actor equality.
        o['actors']['role:C']['actor'] = o['actors']['role:W']['actor']
        self.reject(lambda: validate(a, o, CURRENT), 'session-label-conflict')

    def test_ACC_006_effect_intersection(self):
        a, o = fixture()
        self.positive(a, o, requested=a['requestedEffects'][0])
        for name, change in (
            ('appointment-missing', lambda a, o: o['lifecycle'].update(scope=[])),
            ('mandate-missing', lambda a, o: o['mandate'].update(scope=[])),
            ('profile-missing', lambda a, o: o['profile'].update(effects=[])),
            ('profile-not-admitted', lambda a, o: o['profile'].update(state='PROPOSED')),
            ('wildcard', lambda a, o: a['requestedEffects'][0].update(target='/tmp/*')),
            ('profile-version', lambda a, o: a.update(profileRef='other-profile')),
        ):
            self.negative(change, name)
        for key, value in (('target', '/tmp/other'), ('operation', 'other.write'), ('parameters', {'uid': 0}),
                           ('repo', 'other/repo'), ('host', 'other-host'), ('label', 'other.label')):
            a, o = fixture()
            requested = dict(a['requestedEffects'][0], **{key: value})
            self.reject(lambda: validate(a, o, CURRENT, requested), 'actual-' + key)

    def test_ACC_007_five_criteria_and_future_gates(self):
        self.positive()
        for index in range(5):
            for state in (False, 'UNKNOWN', None):
                self.negative(lambda a, o: a['standardCriteria'][index].update(state=state), 'criterion-state')
            self.negative(lambda a, o: o['evidence'].pop('EVD:criterion:' + str(index + 1)), 'criterion-evidence')
        self.negative(lambda a, o: a.update(standardCriteria=[True] * 5), 'five-self-true')
        a, o = fixture()
        o['evidence'].pop('EVD:actual:runtime.bootstrap')
        self.positive(a, o)
        self.reject(lambda: validate(a, o, CURRENT, stage='runtime.bootstrap'), 'future-actual-not-yet-proven')
        self.negative(lambda a, o: a['stageRequirements']['runtime.bootstrap'].update(state='PASS'), 'prefilled-PASS')

    def test_ACC_008_exclusions(self):
        for name in EXCLUSIONS:
            for value in (True, None, 'UNKNOWN'):
                self.negative(lambda a, o: a['exclusions'][name].update(value=value), name + ':' + str(value))
            self.negative(lambda a, o: o['evidence'].pop('EVD:exclusion:' + name), name + ':unproven')
        self.negative(lambda a, o: a['exclusions'].pop('pauseAfterBootstrap'), 'incomplete-exclusions')

    def test_ACC_009_utc_intersection(self):
        a, o = fixture()
        o['query'].update(at='2026-11-09T11:30:00Z', leaseUntil='2026-11-09T11:35:00Z')
        self.positive(a, o, current=stamp(a['valid_from']))
        self.negative(lambda a, o: a.update(valid_until='2026-11-09T12:00:00Z'), 'exclusive-end')
        self.negative(lambda a, o: o['lifecycle'].update(validUntil='2026-11-09T12:00:00Z'), 'appointment-end')
        self.negative(lambda a, o: o['lifecycle'].update(validFrom='2026-11-09T14:00:00Z'), 'empty-intersection')
        for value in (None, 'infinity', '2026-11-09T13:00:00+08:00', 'EFFECTIVE', ''):
            self.negative(lambda a, o: o['lifecycle'].update(validUntil=value), 'invalid-UTC')
        for current in (float('inf'), float('nan'), None):
            self.negative(lambda a, o: None, 'unknown-clock', current=current)
        a, o = fixture()
        previous = self.positive(a, o)
        previous['current'] = CURRENT + 1
        self.reject(lambda: validate(a, o, CURRENT, previous=previous), 'clock-rollback')

    def test_ACC_010_fresh_reads_and_rollback(self):
        changes = [lambda o: o['lifecycle'].update(state='REVOKED'),
                   lambda o: o['lifecycle'].update(state='REPLACED'),
                   lambda o: o['lifecycle'].update(scope=[]),
                   lambda o: o['query'].update(complete=False),
                   lambda o: o['query'].update(pagesRead=1),
                   lambda o: o['query'].update(epoch=0),
                   lambda o: o['query'].update(leaseUntil='2026-11-09T11:59:59Z')]
        for index, change in enumerate(changes):
            with BoundaryHarness() as h:
                target = h.root / 'next'
                h.prepare([('fixture.write', target, {})])
                h.core.effect_guard('fixture.write', target)
                change(h.observation)
                self.reject(lambda: h.core.effect_guard('fixture.write', target), 'fresh-' + str(index))
                self.eq(h.reader.calls, 2)
                self.eq(h.calls, [])
        a, o = fixture()
        o['lifecycle']['revision'] = 3
        previous = self.positive(a, o)
        o['query'].update(epoch=2, revision='registry-r2')
        o['lifecycle']['revision'] = 2
        self.reject(lambda: validate(a, o, CURRENT, previous=previous), 'lifecycle-revision-rollback')
        for field, value in (('scope', []), ('validUntil', '2026-11-09T14:00:00Z')):
            a, o = fixture()
            previous = self.positive(a, o)
            o['lifecycle'][field] = value
            self.reject(lambda: validate(a, o, CURRENT, previous=previous), 'same-revision-' + field)
        with BoundaryHarness() as h:
            h.prepare([('fixture.write', h.root / 'next', {})])
            h.core.effect_guard('fixture.write', h.root / 'next')
            h.reader.before_read = lambda *args: (_ for _ in ()).throw(OSError('fixture reader lost'))
            self.reject(lambda: h.core.effect_guard('fixture.write', h.root / 'next'), 'reader-unavailable')
            self.eq(h.calls, [])

    def test_ACC_011_actual_boundaries_and_mutex(self):
        executable_guards(self)
        helper = (HERE / 'window_helper.py').read_text()
        for operation in ('mutex.mkdir', 'mutex.holder.write', 'mutex.holder.chmod', 'source.copy2', 'source.unlink',
                          'preimage.ditto', 'config.ditto', 'plist.write', 'plist.chown', 'plist.chmod', 'plist.replace',
                          'runtime.bootout', 'runtime.bootstrap', 'settlement.commit', 'installer.execute',
                          'mutex.release', 'mutex.holder.unlink', 'mutex.rmdir'):
            self.check(repr(operation) in helper, operation)
        self.check("effect_guard('xattr.write'" in (HERE / 'window_preimage_xattr.py').read_text())
        for branch, operation in (('bootout', 'runtime.bootout'), ('bootstrap', 'runtime.bootstrap')):
            with BoundaryHarness() as h:
                argv = ['/bin/launchctl', branch, 'system', str(h.core.plist)]
                h.prepare([(operation, h.core.plist, {'argv': argv})])
                getattr(h, branch + '_inputs')()
                h.reader.before_read = lambda count, o: o['lifecycle'].update(state='REVOKED') if count == 2 else None
                self.reject(lambda: h.branch(branch), 'revoke-immediately-before-' + branch)
                self.eq(h.calls, [])
                self.check(h.core.lock.exists())
        for operation in ('preimage.ditto', 'config.ditto', 'staging.copy', 'installer.execute', 'settlement.commit'):
            with BoundaryHarness() as h:
                h.prepare([(operation, h.root / 'target', {})])
                self.reject(lambda: h.core.effect_guard(operation, h.root / 'target', internal=True), operation,
                            'internal per-write control UNKNOWN')
                self.eq(h.calls, [])
        with BoundaryHarness() as h:
            h.prepare([('fixture.write', h.root / 'next', {})], mutex=False)
            self.reject(lambda: h.core.effect_guard('fixture.write', h.root / 'next'), 'mutex-missing')
            self.eq(h.reader.calls, 0)
        with BoundaryHarness() as h:
            h.prepare([('fixture.write', h.root / 'next', {})])
            (h.core.lock / 'holder').write_text('other window')
            self.reject(lambda: h.core.effect_guard('fixture.write', h.root / 'next'), 'mutex-other-owner')
            self.eq(h.calls, [])
        with BoundaryHarness() as h:
            h.prepare([('fixture.write', h.root / 'next', {})])
            saved = (h.core.lock / 'holder').read_bytes()
            h.core.lock.rename(h.root / 'old-mutex')
            h.core.lock.mkdir()
            (h.core.lock / 'holder').write_bytes(saved)
            h.core._held_inode = None
            self.reject(lambda: h.core.effect_guard('fixture.write', h.root / 'next'), 'same-bytes-replaced-mutex')
            self.eq(h.calls, [])

    def test_ACC_012_six_refusals_admission_and_boundary(self):
        scenarios = {
            '未任命': lambda a, o: o['caller'].update(relation='REQUEST_BODY'),
            '越界': lambda a, o: o['lifecycle'].update(scope=[]),
            '过期': lambda a, o: o['lifecycle'].update(validUntil='2026-11-09T12:00:00Z'),
            '撤销': lambda a, o: o['lifecycle'].update(state='REVOKED'),
            '候选漂移': lambda a, o: o.update(controlVersion='changed'),
            '缺门': lambda a, o: o['evidence'].pop('EVD:criterion:1'),
        }
        for category, mutate in scenarios.items():
            with BoundaryHarness() as h:
                h.prepare([('fixture.write', h.root / 'next', {})])
                mutate(h.a, h.observation)
                authenticate(h.a, h.observation)
                self.reject(lambda: h.core.validate_authority(h.a, h.a['writer_uid'], CURRENT), category + ':initial', category)
                self.reject(lambda: h.core.effect_guard('fixture.write', h.root / 'next'), category + ':boundary', category)
                self.eq(h.calls, [])

    def test_ACC_013_drift_and_existing_gates(self):
        retained_predicates(self)
        a, o = fixture()
        o['unrelatedMainHead'] = 'd' * 40
        self.positive(a, o)
        for field in ('candidateRef', 'controlVersion'):
            self.negative(lambda a, o: o.update({field: 'changed'}), field)
        with BoundaryHarness() as h:
            item = h.root / 'candidate'
            item.write_text('candidate before')
            manifest = h.root / 'MANIFEST'
            manifest.write_text(h.core.digest(item) + '  candidate\n')
            h.core.manifest(manifest, h.root)
            item.write_text('candidate drift')
            self.reject(lambda: h.core.manifest(manifest, h.root), 'source/tree/harness bytes drift')
        source = (HERE / 'window_helper.py').read_text()
        for marker in ('source coordinates changed', 'Harness stamp differs', 'manifest seal changed',
                       'full runtime not PASS', 'final closure differs', 'plist drift before bootstrap'):
            self.check(marker in source or marker in (HERE / 'window_helper_core.py').read_text(), marker)
        self.negative(lambda a, o: o['evidence']['EVD:criterion:3'].update(state='HISTORICAL_PASS'), 'historical-PASS')

    def test_ACC_014_original_error_exit(self):
        with tempfile.TemporaryDirectory(prefix='fwav-error-') as directory:
            root = Path(directory)
            driver = root / 'refusal.py'
            driver.write_text('import sys\nsys.path.insert(0, ' + repr(str(Path(__file__).parent)) + ')\n'
                'from boundary_harness import refusal_driver\nrefusal_driver(sys.argv[1], sys.argv[2])\n')
            for category in ('unappointed', 'scope', 'expired', 'revoked', 'drift', 'gate'):
                receipt = root / category
                receipt.mkdir()
                trace = receipt / 'effect-count.json'
                shell = '\n'.join([
                    'source "$1"', 'sudo() { echo unexpected-sudo-boundary >&2; return 99; }', 'RD=$2', 'STAGE=stage_05_old_exit',
                    'helper() { local privilege=$1; shift; case "$1" in',
                    'before-stop) return 0;;',
                    'bootout) python3 -B "$TEST_DRIVER" "$TEST_CATEGORY" "$TEST_TRACE";;',
                    'stop-state) printf "%s\\n" not_attempted;;',
                    '*) python3 -B "$TEST_HELPER" "$RD" "$@";; esac; }',
                    'trap \'stop_on_error "$?" "$LINENO"\' ERR', 'stage_05_old_exit'])
                env = dict(os.environ, TEST_DRIVER=str(driver), TEST_CATEGORY=category,
                           TEST_TRACE=str(trace), TEST_HELPER=str(HERE / 'window_helper.py'))
                result = subprocess.run(['/bin/bash', '-c', shell, 'fwav-error', str(HERE / 'window-executor-v5.sh'),
                                         str(receipt)], capture_output=True, text=True, env=env)
                self.eq(result.returncode, 1, result.stderr)
                self.check('RuntimeError:' in result.stderr, result.stderr)
                self.check('STOP stage=stage_05_old_exit' in result.stdout)
                self.check('Evidence: ' + str(receipt) in result.stdout)
                self.eq(json.loads((receipt / 'stage_05_old_exit.json').read_text())['status'], 'FAIL')
                self.eq(json.loads(trace.read_text())['effectCalls'], 0)
                self.check('fixture-secret-do-not-print' not in result.stdout + result.stderr)
                print(json.dumps({'refusal': category, 'rawRC': result.returncode, 'effectCalls': 0,
                                  'phase': 'FAIL', 'stderr': result.stderr.splitlines()[-1]}, ensure_ascii=False))

    def test_ACC_015_inflight_unknown_and_release(self):
        with BoundaryHarness() as h:
            h.prepare([('mutex.release', h.core.lock, {}), ('mutex.holder.unlink', h.core.lock / 'holder', {}),
                       ('mutex.rmdir', h.core.lock, {})])
            close_hash = h.release_inputs()
            h.a['requestedEffects'][0]['parameters'] = {'closeSha256': close_hash}
            for key in ('scope',):
                h.observation['mandate'][key][0]['parameters'] = {'closeSha256': close_hash}
                h.observation['lifecycle'][key][0]['parameters'] = {'closeSha256': close_hash}
            h.observation['profile']['effects'][0]['parameters'] = {'closeSha256': close_hash}
            h.authorize_again()
            h.core.save('owned-child.json', {'state': 'UNKNOWN', 'businessOutcome': 'UNKNOWN'})
            h.observation['evidence']['EVD:terminal'].update(ownedEffectsTerminal=False, unknownChildren=['child-1'])
            self.reject(lambda: h.branch('release'), 'owned-child-UNKNOWN')
            self.check((h.core.lock / 'holder').exists())
            self.eq(h.core.read(h.rd / 'owned-child.json')['businessOutcome'], 'UNKNOWN')
            self.eq(h.calls, [])
            h.observation['lifecycle'].update(state='REVOKED')
            self.reject(lambda: h.branch('release'), 'revoked-inflight')
            self.check(h.core.lock.exists())
            h.branch('phase', {'args': ['stage_inflight', 'FAIL', 'owned-child=UNKNOWN']})
            self.eq(h.core.read(h.rd / 'stage_inflight.json')['status'], 'FAIL')
            self.eq(h.calls, [])

    def test_ACC_016_qualification_distinctions(self):
        with mock.patch('authority_validation.reader.read_registry', return_value={'authenticated': True, 'EFFECTIVE': True}):
            self.reject(lambda: RegistryReader().observe(), 'self-written-qualification', 'UNKNOWN')
        result = subprocess.run(['/bin/bash', str(HERE / 'window-executor-v5.sh'), '--dry-run'], capture_output=True, text=True)
        self.eq(result.returncode, 0)
        self.check('productionExecution=NOT_EXECUTED stageFunctionsCalled=0' in result.stdout)
        matrix = {'source': 'TESTED_CANDIDATE', 'isolated': 'EXECUTED', 'installed': 'UNKNOWN',
                  'loaded': 'UNKNOWN', 'admittedProfile': 'UNKNOWN', 'SRA_EFFECTIVE': 'NOT_ESTABLISHED',
                  'windowExecution': 'NOT_EXECUTED', 'independentVerifier': 'SEPARATE_REVIEW_REQUIRED'}
        self.eq(len(matrix), 8)
        print('QUALIFICATION=' + json.dumps(matrix, sort_keys=True))


class Result(unittest.TextTestResult):
    def addSuccess(self, test):
        super().addSuccess(test)
        print(json.dumps({'acceptance': 'ACC-FWAV-' + test._testMethodName.split('_')[2], 'rawRC': 0,
            'assertions': test.assertion_count, 'refusals': test.refusals, 'effectCalls': test.effect_calls,
            'pureInputListHash': hashlib.sha256(canonical(test.inputs)).hexdigest(), 'controlOwner': 'isolated fixture provider',
            'callerSource': 'PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN'}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    unittest.main(testRunner=unittest.TextTestRunner(verbosity=2, resultclass=Result))
