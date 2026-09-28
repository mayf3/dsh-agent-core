"""Offline DS handler composition tests; no installed service is imported."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


HERE = Path(__file__).resolve().parent
ACTION = 'HR_SHIM_FIRST_EFFECT_RECEIPT_STATUS_V1'
MINI_DS = '''import json
AUTHORIZED_OWNER_UID = 502
REQUEST_LIMIT = 65536
class Failure(Exception):
    pass
def require(ok, reason):
    if not ok:
        raise Failure(reason)
def handle(raw, peer=None):
    try:
        require(len(raw) <= REQUEST_LIMIT, "REQUEST_TOO_LARGE")
        request = json.loads(raw.decode("utf-8"))
        require(isinstance(request, dict), "REQUEST_NOT_OBJECT")
        allowed = {
            "STATUS": {"action"},
        }
        action = request.get("action")
        require(isinstance(action, str) and action in allowed, "ACTION_UNKNOWN")
        require(set(request) == allowed[action], "REQUEST_FIELDS_INVALID")
        if action == "STATUS":
            return {"ok": True, "pid": 41}, None
    except Failure as exc:
        return {"ok": False, "error": str(exc)}, None
'''


def builder_module():
    path = HERE / 'build_candidate.py'
    if not path.is_file():
        raise AssertionError('fixed DS candidate builder is not implemented')
    spec = importlib.util.spec_from_file_location('hr_first_effect_builder_test', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BuildCandidateTests(unittest.TestCase):
    def setUp(self):
        self.builder = builder_module()
        self.reader = (HERE / 'reader.py').read_text()

    def scope(self, bound):
        candidate = self.builder.compose(MINI_DS.encode(), self.reader.encode(),
                                         bound=bound)
        scope = {'__name__': 'offline_ds_candidate'}
        exec(compile(candidate, '<offline-ds-candidate>', 'exec'), scope)
        return scope

    def test_wrong_baseline_sha_is_refused_before_build(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'deployment_system.py'
            path.write_bytes(MINI_DS.encode())
            with self.assertRaises(ValueError):
                self.builder.read_pinned_baseline(path)

    def test_unbound_candidate_is_inert_and_existing_status_unchanged(self):
        scope = self.scope(bound=False)
        response, restart = scope['handle'](
            json.dumps({'action': ACTION}).encode(), peer=502)
        self.assertIsNone(restart)
        self.assertEqual(response, {'ok': False, 'status': 'UNKNOWN',
                                    'recordSha256': None})
        self.assertEqual(scope['handle'](b'{"action":"STATUS"}', peer=502),
                         ({'ok': True, 'pid': 41}, None))

    def test_bound_candidate_allows_only_exact_owner_and_exact_request(self):
        scope = self.scope(bound=True)
        observed = {'ok': True, 'status': 'INTENT_PRESENT_UNKNOWN',
                    'recordSha256': 'a' * 64}
        scope['_hr_read_status'] = lambda: observed
        raw = json.dumps({'action': ACTION}).encode()
        self.assertEqual(scope['handle'](raw, peer=502), (observed, None))
        for peer in (0, 501, None):
            with self.subTest(peer=peer):
                result, restart = scope['handle'](raw, peer=peer)
                self.assertIsNone(restart)
                self.assertEqual(result, {'ok': False, 'status': 'UNKNOWN',
                                          'recordSha256': None})
        extra = json.dumps({'action': ACTION, 'operation_id': 'other'}).encode()
        result, _ = scope['handle'](extra, peer=502)
        self.assertFalse(result['ok'])
        self.assertNotIn('recordSha256', result)

    def test_rejected_peer_never_reaches_protected_reader(self):
        for bound in (False, True):
            with self.subTest(bound=bound):
                scope = self.scope(bound=bound)
                called = []
                scope['_hr_read_status'] = lambda: called.append(True)
                packet = json.dumps({'action': ACTION}).encode()
                if bound:
                    self.assertFalse(scope['handle'](packet, peer=0)[0]['ok'])
                    self.assertFalse(scope['handle'](packet, peer=None)[0]['ok'])
                else:
                    self.assertFalse(scope['handle'](packet, peer=502)[0]['ok'])
                self.assertEqual(called, [])

    def test_reader_exception_returns_bounded_unknown(self):
        scope = self.scope(bound=True)
        scope['_hr_read_status'] = mock.Mock(side_effect=OSError('secret path'))
        response, restart = scope['handle'](
            json.dumps({'action': ACTION}).encode(), peer=502)
        self.assertIsNone(restart)
        self.assertEqual(response, {'ok': True, 'status': 'UNKNOWN',
                                    'recordSha256': None})
        self.assertNotIn('secret path', json.dumps(response))

    def test_missing_handler_anchor_fails_without_relaxed_fallback(self):
        with self.assertRaises(ValueError):
            self.builder.compose(MINI_DS.replace('def handle(raw, peer=None):',
                         'def other(raw, peer=None):').encode(),
                         self.reader.encode(), bound=True)


if __name__ == '__main__':
    unittest.main()
