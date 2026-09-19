import copy
import unittest
from unittest.mock import patch
import p4r9_reconcile as r
from bind_records import _canonical
from first_live_io import digest


class IO:
    def __init__(self, record, fail_after=None):
        self.record = record
        self.calls = []
        self.copies = {}
        self.moved = False
        self.mutations = 0
        self.fail_after = fail_after
    def metadata(self, path, absent=False):
        if absent:
            if not self.moved:
                return None if path in (r.layout.P4R9_OPERATION_ARCHIVE, r.layout.P4R9_PACKET_ARCHIVE) else {'present': True}
            return None if path in (r.layout.ROOT + '/first-live-pending.json', r.layout.ROOT + '/first-live-operation', r.layout.PACKET) else {'present': True}
        if path in (r.layout.ROOT + '/first-live-operation', r.layout.P4R9_OPERATION_ARCHIVE):
            return dict(type='Directory', **self.record['operation_directory'])
        if path in (r.layout.PACKET, r.layout.P4R9_PACKET_ARCHIVE):
            return dict(type='Directory', **self.record['packet_directory'])
        return {'inode': 1}
    def expect(self, path, spec): return {'inode': 1}
    def copy(self, raw, h, mode, path):
        if digest(raw) != h: raise RuntimeError('COPY_DIGEST')
        self.copies[path] = raw
        self._cut()
    def _cut(self):
        self.mutations += 1
        if self.fail_after == self.mutations:
            raise RuntimeError('SIMULATED_CRASH_UNKNOWN')
    def call(self, argv, **kwargs):
        self.calls.append(argv)
        if argv[:2] == ['/bin/ls', '-1A']:
            if argv[-1].endswith('first-live-operation'): return b'first-live-intent.json\n'
            names = self.record['payload_names'] if argv[-1].endswith('/payloads') else self.record['packet_names']
            return (('\n'.join(names) + '\n') if names else '').encode()
        if argv[0] == '/bin/mv' and argv[-1] == r.layout.P4R9_PACKET_ARCHIVE:
            self.moved = True
        if argv[0] in ('/bin/mv', '/bin/sync'):
            self._cut()
        return b'bound'


def record():
    spec = dict(uid=0, gid=0, mode='0400', nlink=1, flags=0, sha256='a' * 64)
    return dict(version=1, state='P4R9_PENDING_ONLY_SUPERSEDED', operation_id=r.layout.OPERATION,
        execution_id='first-live-dsh-20260918-01-p4-successor', package_sha256='d' * 64,
        operation_directory=dict(uid=0,gid=0,mode=0o700,flags=0,device=1,inode=2),
        packet_directory=dict(uid=0,gid=0,mode=0o700,flags=0,device=1,inode=3),
        first_live_intent=spec, first_live_pending=spec,
        packet_names=['packet.json','payloads'], payload_names=[],
        staging_files={'packet.json':spec}, retry_forbidden=True, production_target_mutation=False)


class Reconciliation(unittest.TestCase):
    def test_exact_pending_only_history_is_preserved_then_active_paths_become_absent(self):
        value=record();io=IO(value)
        value['package_sha256']='d320d4b27bcda875e459129ae6e449146295c4d6357677874678ef3b83d0090c'
        r.reconcile(io,_canonical(value))
        self.assertEqual([x[0] for x in io.calls].count('/bin/mv'),3)
        self.assertIn(r.layout.ROOT+'/first-live-operation/successor-reconciliation.json',io.copies)
        self.assertTrue(io.moved)
    def test_wrong_binding_or_preimage_stops_before_first_write(self):
        for drift in ('record','inode','shape'):
            value=record()
            value['package_sha256']='d320d4b27bcda875e459129ae6e449146295c4d6357677874678ef3b83d0090c'
            io=IO(value);bound=copy.deepcopy(value)
            if drift=='record':bound['package_sha256']='e'*64
            elif drift=='inode':io.record['operation_directory']['inode']=9
            else:io.record['packet_names']=['foreign']
            with self.assertRaises(RuntimeError):
                r.reconcile(io,_canonical(bound))
            self.assertFalse(io.copies);self.assertFalse(any(x[0]=='/bin/mv' for x in io.calls))
    def test_each_reconciliation_crash_cut_stops_without_later_mutation(self):
        value=record();value['package_sha256']='d320d4b27bcda875e459129ae6e449146295c4d6357677874678ef3b83d0090c'
        for cut in range(1,6):
            io=IO(copy.deepcopy(value),fail_after=cut)
            with self.assertRaisesRegex(RuntimeError,'SIMULATED_CRASH_UNKNOWN'):
                r.reconcile(io,_canonical(value))
            self.assertEqual(io.mutations,cut)


if __name__ == '__main__': unittest.main()
