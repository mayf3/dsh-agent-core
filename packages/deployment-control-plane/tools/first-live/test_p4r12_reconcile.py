import copy
import unittest
import p4r12_reconcile as r
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
                return None if path in (r.layout.P4R12_OPERATION_ARCHIVE, r.layout.P4R12_PACKET_ARCHIVE,
                    r.layout.LEGACY_ANCESTOR + '/transaction.lock') else {'present': True}
            return None if path in (r.layout.ROOT + '/first-live-pending.json',
                r.layout.ROOT + '/first-live-operation', r.layout.PACKET) else {'present': True}
        if path in (r.layout.ROOT + '/first-live-operation', r.layout.P4R12_OPERATION_ARCHIVE):
            return dict(type='Directory', **self.record['operation_directory'])
        if path in (r.layout.PACKET, r.layout.P4R12_PACKET_ARCHIVE):
            return dict(type='Directory', **self.record['packet_directory'])
        if path == r.layout.SOCKET:
            return dict(type='Directory', **self.record['socket_directory'])
        if path == r.layout.LEGACY_ANCESTOR:
            return dict(type='Directory', **self.record['legacy_ancestor'])
        if path == r.layout.FENCE_PROBE_ROOT:
            return dict(type='Directory', **self.record['capability']['probe_directory'])
        if path == r.layout.FENCE_PROBE_ROOT + '/target':
            return dict(type='Directory', **self.record['capability']['target_directory'])
        return {'inode': 1}

    def expect(self, path, spec): return {'inode': 1}

    def copy(self, raw, value, mode, path):
        if digest(raw) != value: raise RuntimeError('COPY_DIGEST')
        self.copies[path] = raw
        self._cut()

    def _cut(self):
        self.mutations += 1
        if self.fail_after == self.mutations:
            raise RuntimeError('SIMULATED_CRASH_UNKNOWN')

    def call(self, argv, **kwargs):
        self.calls.append(argv)
        if argv[:2] == ['/bin/ls', '-1A']:
            if argv[-1].endswith('first-live-operation'):
                return b'first-live-intent.json\nlegacy-ancestor-fence-intent.json\n'
            if argv[-1] == r.layout.SOCKET:
                return b''
            names = self.record['payload_names'] if argv[-1].endswith('/payloads') else self.record['packet_names']
            return (('\n'.join(names) + '\n') if names else '').encode()
        if argv[0] == '/bin/cat':
            if argv[-1].endswith('legacy-ancestor-fence-intent.json'):
                return _canonical(self.record['legacy_fence_record'])
            if argv[-1].endswith('/result.json'):
                return _canonical(self.record['capability']['result'])
            return b'bound'
        if argv[0] == '/bin/mv' and argv[-1] == r.layout.P4R12_PACKET_ARCHIVE:
            self.moved = True
        if argv[0] in ('/bin/mv', '/bin/sync'):
            self._cut()
        return b'bound'


def record():
    spec = dict(uid=0, gid=0, mode='0400', nlink=1, flags=0, sha256='a' * 64)
    ancestor = dict(uid=0,gid=80,mode=0o755,flags=0,device=1,inode=5)
    capability_result = dict(version=1,state='SUPPORTED_AND_CLEARED',selected_flag=131072,
        rename_blocked=True,child_operations=True,final_flags=0)
    return dict(version=1, state='P4R12_INTENT_ONLY_SUPERSEDED', operation_id=r.layout.OPERATION,
        execution_id='first-live-dsh-20260918-01-p4r10-successor', package_sha256='f' * 64,
        plan_sha256='e' * 64,
        operation_directory=dict(uid=0,gid=0,mode=0o700,flags=0,device=1,inode=2),
        packet_directory=dict(uid=0,gid=0,mode=0o700,flags=0,device=1,inode=3),
        first_live_intent=spec, legacy_fence_intent=spec, first_live_pending=spec,
        legacy_fence_record=dict(operation_id=r.layout.OPERATION,binding='b'*64,
            path=r.layout.LEGACY_ANCESTOR,identity={'device':1,'inode':5,'uid':0,'gid':80,'mode':0o755},
            original_flags=0,set_flag=0x00100000), legacy_ancestor=ancestor,
        packet_names=['packet.json','payloads'], payload_names=[],
        staging_files={'packet.json':spec,'original-agent-deployd':spec,'original-agent-deploy-issuer':spec},
        installed_files={'agent-deployd':spec,'agent-deploy-issuer':spec,'agent-deployctl':spec},
        socket_directory=dict(uid=0,gid=602,mode=0o750,flags=0,device=1,inode=4),
        capability={'installed_probe':spec,
            'probe_directory':dict(uid=0,gid=0,mode=0o700,flags=0,device=1,inode=6),
            'target_directory':dict(uid=0,gid=0,mode=0o700,flags=0,device=1,inode=7),
            'result_file':spec,'result':capability_result},
        evidence=r.EVIDENCE,
        retry_forbidden=True, production_mutation='P4R9_HISTORY_ARCHIVE_AND_CONTROL_PLANE_STAGING')


class Reconciliation(unittest.TestCase):
    def test_exact_intent_only_history_and_capability_are_preserved_then_active_paths_absent(self):
        value=record();value['package_sha256']=r.P4R12_PACKAGE;value['plan_sha256']=r.P4R12_PLAN
        io=IO(value);r.reconcile(io,_canonical(value))
        self.assertEqual([x[0] for x in io.calls].count('/bin/mv'),3)
        self.assertIn(r.layout.ROOT+'/first-live-operation/successor-reconciliation.json',io.copies)
        self.assertTrue(io.moved)

    def test_wrong_history_fence_capability_or_inode_stops_before_first_write(self):
        for drift in ('package','inode','fence','capability','shape'):
            value=record();value['package_sha256']=r.P4R12_PACKAGE;value['plan_sha256']=r.P4R12_PLAN
            io=IO(value);bound=copy.deepcopy(value)
            if drift=='package':bound['package_sha256']='0'*64
            elif drift=='inode':io.record['legacy_ancestor']['inode']=99
            elif drift=='fence':io.record['legacy_fence_record']['set_flag']=131072
            elif drift=='capability':io.record['capability']['result']['final_flags']=131072
            else:io.record['packet_names']=['foreign']
            with self.assertRaises(RuntimeError):r.reconcile(io,_canonical(bound))
            self.assertFalse(io.copies);self.assertFalse(any(x[0]=='/bin/mv' for x in io.calls))

    def test_each_reconciliation_crash_cut_stops_without_later_mutation(self):
        value=record();value['package_sha256']=r.P4R12_PACKAGE;value['plan_sha256']=r.P4R12_PLAN
        for cut in range(1,6):
            io=IO(copy.deepcopy(value),fail_after=cut)
            with self.assertRaisesRegex(RuntimeError,'SIMULATED_CRASH_UNKNOWN'):
                r.reconcile(io,_canonical(value))
            self.assertEqual(io.mutations,cut)


if __name__ == '__main__': unittest.main()
