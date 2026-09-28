"""Isolated real V3 parser/DS fixtures. Never connects to a production socket."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import synthetic_store as ss

BASE = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG')
PRIOR = BASE/'p0-travel-terminal-readback-20260928-v14/artdir/deployment_system.py'
OUT = BASE/'HR-CTO-OWNER-SENDER-FIXED-READBACK-20260928-v1'
ACTION = 'HR_CTO_OWNER_SENDER_HASH_READBACK_V1'
OP = 'hr-cto-owner-read-20260928-54b0945f'
MESSAGE = 'om_isolated_seed'
SENDER = 'ou_isolated_owner'
NATIVE = 'native-isolated-receipt'
sha = lambda b: hashlib.sha256(b).hexdigest()


class FixedReadback(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(os.environ.get('CTO_TEST_DS', OUT/'artdir/deployment_system.py'))
        # Imports/assignments/function definitions only; main is never called.
        cls.source = path.read_text()
        cls.path = path
        cls.code = compile(cls.source, str(path), 'exec')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.path.realpath(tempfile.gettempdir()))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = self.root/'store.json'
        env = {'DS_TEST_MODE':'1', 'DS_STATE_ROOT':str(self.root), 'DS_OWNER_UID':'502',
               'DS_ROUTER_STORE_FILE':str(self.store), 'DS_ROUTER_NODE_BIN':shutil.which('node')}
        with patch.dict(os.environ, env):
            self.ds = {'__name__':'isolated_cto_fixture', '__file__':str(self.path)}
            exec(self.code, self.ds)
        (self.root/'receipts').mkdir()
        self.payload = {'action':ACTION, 'operation_id':OP, 'feishu_message_id':MESSAGE}
        self.ds['HR_CTO_REQUEST_SHA256'] = sha(self.ds['canonical'](self.payload))
        self.write()

    def write(self, records=None):
        if records is None:
            records = [ss.v3_record(1,'agt_cto-agent',1,1,
                       correlation=ss.five_leaf(MESSAGE,SENDER),message_id=NATIVE)]
        ss.write_store(self.store, ss.v3_store(records))

    def request(self, payload=None, peer=502):
        return self.ds['handle'](json.dumps(self.payload if payload is None else payload).encode(), peer=peer)[0]

    def test_fixed_action_is_recognized(self):
        result = self.request({'action':ACTION})
        self.assertEqual(result.get('error'), 'REQUEST_FIELDS_INVALID')

    def test_complete_exact_three_hashes_and_no_protected_leak(self):
        before = self.store.read_bytes()
        result = self.request()
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['projection'], {'sender_openid_sha256':sha(SENDER.encode()),
            'feishu_message_id_sha256':sha(MESSAGE.encode()), 'native_receipt_sha256':sha(NATIVE.encode())})
        receipt = (self.root/'receipts'/f'{OP}.json').read_bytes()
        self.assertEqual(json.loads(receipt)['state'],'COMPLETE')
        for text in (MESSAGE,SENDER,NATIVE,'turn:','sess-fx','oc_fx_chat'):
            self.assertNotIn(text.encode(), receipt)
            self.assertNotIn(text,json.dumps(result))
        self.assertEqual(before,self.store.read_bytes())
        self.assertFalse(self.request()['ok'])
        self.assertEqual(receipt,(self.root/'receipts'/f'{OP}.json').read_bytes())

    def test_strict_peer_fields_and_frozen_selector(self):
        for peer in (None,0,501,505):
            self.assertFalse(self.request(peer=peer)['ok'])
        for field in ('agentId','path','uid','command','sender_openid_sha256'):
            self.assertFalse(self.request({**self.payload,field:'forbidden'})['ok'])
        for field,value in [('operation_id','another-id'),('feishu_message_id','another-message'),('feishu_message_id',''),('feishu_message_id','é'*65)]:
            self.assertFalse(self.request({**self.payload,field:value})['ok'])
        self.assertFalse((self.root/'receipts'/f'{OP}.json').exists())
        self.ds['HR_CTO_REQUEST_SHA256'] = None
        self.assertEqual(self.request().get('error'),'HR_CTO_BINDING_UNBOUND')

    def test_full_validator_rejects_unrelated_malformed_record(self):
        record = ss.v3_record(2,'agt_other-agent',1,1,correlation=ss.five_leaf('other','ou_unrelated'),message_id='other-native')
        record['turnSeq'] = -1
        chosen = ss.v3_record(1,'agt_cto-agent',1,1,correlation=ss.five_leaf(MESSAGE,SENDER),message_id=NATIVE)
        self.write([chosen,record])
        self.assertFalse(self.request()['ok'])

    def test_global_duplicate_rejected_before_agent_filter(self):
        records = [ss.v3_record(i,agent,1,1,correlation=ss.five_leaf(MESSAGE,SENDER),message_id=NATIVE)
                   for i,agent in enumerate(('agt_cto-agent','agt_other-agent'),1)]
        self.write(records)
        result = self.request()
        self.assertFalse(result['ok'])
        self.assertIn('MULTIPLE',result['error'])

    def test_wrong_agent_and_absent_native_rejected(self):
        for agent,native in [('agt_efficiency-agent',NATIVE),('agt_cto-agent',None)]:
            with self.subTest(agent=agent):
                self.write([ss.v3_record(1,agent,1,1,correlation=ss.five_leaf(MESSAGE,SENDER),message_id=native)])
                with self.assertRaises(self.ds['Failure']):
                    self.ds['hr_cto_verified_select'](MESSAGE)

    def test_intent_before_read_exception_sanitized_consumed(self):
        def broken(_):
            intent=json.loads((self.root/'receipts'/f'{OP}.json').read_text())
            self.assertEqual(intent['state'],'INTENT')
            raise RuntimeError(SENDER+' '+MESSAGE)
        self.ds['hr_cto_verified_select']=broken
        result=self.request()
        self.assertFalse(result['ok'])
        receipt=(self.root/'receipts'/f'{OP}.json').read_bytes()
        self.assertEqual(json.loads(receipt)['state'],'UNKNOWN')
        self.assertNotIn(SENDER,json.dumps(result))
        self.assertNotIn(MESSAGE.encode(),receipt)
        self.ds['hr_cto_verified_select']=lambda _:self.fail('REPLAY')
        self.assertFalse(self.request()['ok'])

    def test_crash_intent_and_fail_both_never_replay(self):
        def crash(_):
            raise SystemExit(19)
        self.ds['hr_cto_verified_select']=crash
        with self.assertRaises(SystemExit):self.request()
        receipt=json.loads((self.root/'receipts'/f'{OP}.json').read_text())
        self.assertEqual(receipt['state'],'INTENT')
        self.ds['hr_cto_verified_select']=lambda _:self.fail('REPLAY')
        self.assertFalse(self.request()['ok'])
        self.assertFalse(self.request({**self.payload,'operation_id':'guessed-new-id'})['ok'])

    def test_store_symlink_and_metadata_rejected(self):
        self.store.chmod(0o644)
        with self.assertRaises(self.ds['Failure']):self.ds['hr_cto_verified_select'](MESSAGE)
        actual=self.root/'actual.json'
        self.store.rename(actual)
        self.store.symlink_to(actual)
        with self.assertRaises((OSError,self.ds['Failure'])):self.ds['hr_cto_verified_select'](MESSAGE)

    def test_native_peer_uses_kernel_socket_identity(self):
        import socket
        left,right=socket.socketpair()
        try:
            self.assertEqual(self.ds['peer_uid'](left.fileno()),os.getuid())
        finally:
            left.close()
            right.close()

    def test_duplicate_request_keys_rejected_without_intent(self):
        raw=json.dumps(self.payload)[:-1]+', "feishu_message_id": "om_isolated_seed"}'
        result=self.ds['handle'](raw.encode(),peer=502)[0]
        self.assertFalse(result['ok'])
        self.assertFalse((self.root/'receipts'/f'{OP}.json').exists())

    def test_selected_valid_but_unrelated_record_never_projected(self):
        chosen=ss.v3_record(1,'agt_cto-agent',1,1,correlation=ss.five_leaf(MESSAGE,SENDER),message_id=NATIVE)
        other=ss.v3_record(2,'agt_other-agent',1,1,correlation=ss.five_leaf('om_OTHER','ou_OTHER'),message_id='native_OTHER')
        self.write([chosen,other])
        result=self.request()
        self.assertTrue(result['ok'],result)
        for value in ('om_OTHER','ou_OTHER','native_OTHER'):
            self.assertNotIn(value,json.dumps(result))
            self.assertNotIn(sha(value.encode()),json.dumps(result))

    def test_missing_or_malformed_correlation_fails_full_validation(self):
        for correlation in (None, {'channelNamespace':'feishu'},ss.five_leaf(MESSAGE,'')):
            self.write([ss.v3_record(1,'agt_cto-agent',1,1,correlation=correlation,message_id=NATIVE)])
            with self.assertRaises(self.ds['Failure']):self.ds['hr_cto_verified_select'](MESSAGE)

    def test_same_descriptor_content_and_name_drift_rejected(self):
        seek=os.lseek
        for replace in (False,True):
            with self.subTest(replace=replace):
                self.write()
                calls=[0]
                def changed(fd, offset, whence):
                    if offset==0 and whence==os.SEEK_SET:
                        calls[0]+=1
                        if calls[0]==3:
                            raw=self.store.read_bytes()
                            if replace:
                                tmp=self.root/'replacement.json'
                                tmp.write_bytes(raw)
                                tmp.chmod(0o600)
                                os.replace(tmp,self.store)
                            else:
                                self.store.write_bytes(raw.replace(b'ou_isolated_owner',b'ou_isolated_owneX'))
                    return seek(fd,offset,whence)
                with patch.object(os,'lseek',side_effect=changed),self.assertRaises(self.ds['Failure']):
                    self.ds['hr_cto_verified_select'](MESSAGE)

    def test_busy_lease_no_read_no_intent(self):
        import fcntl
        fd=os.open(self.root/'mutation.lock',os.O_RDWR|os.O_CREAT,0o644)
        try:
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            self.assertFalse(self.request()['ok'])
            self.assertFalse((self.root/'receipts'/f'{OP}.json').exists())
        finally:os.close(fd)

    def test_forged_projection_no_leak(self):
        self.ds['hr_cto_verified_select']=lambda _: {'projection':{'raw':SENDER},'store_sha256':'0'*64}
        result=self.request()
        self.assertEqual(result['state'],'FAIL')
        self.assertNotIn(SENDER,json.dumps(result))
        self.assertFalse(self.request()['ok'])

    def test_non_utf8_sender_is_not_hashed_as_replacement_character(self):
        self.write([ss.v3_record(1,'agt_cto-agent',1,1,
            correlation=ss.five_leaf(MESSAGE,chr(0xd800)),message_id=NATIVE)])
        self.assertFalse(self.request()['ok'])

    def test_lost_receipt_custody_never_publishes_selected_hashes(self):
        original=self.ds['hr_cto_verified_select']
        def moved(message):
            selected=original(message)
            ledger=self.root/'hr-cto-owner-sender-readback'
            ledger.rename(self.root/'held-old-ledger')
            ledger.mkdir(mode=0o700)
            return selected
        self.ds['hr_cto_verified_select']=moved
        result=self.request()
        self.assertFalse(result['ok'])
        self.assertNotIn('projection',result)
        self.assertEqual(json.loads((self.root/'receipts'/f'{OP}.json').read_text())['state'],'INTENT')

    def test_existing_efficiency_action_preserved(self):
        self.write([ss.v3_record(1,'agt_efficiency-agent',1,1,correlation=ss.five_leaf(MESSAGE,SENDER),message_id=NATIVE)])
        result=self.request({'action':'ROUTER_INGRESS_RECEIPT_READBACK_V1','operation_id':'isolated-efficiency','feishu_message_id':MESSAGE})
        self.assertTrue(result['ok'],result)
        self.assertEqual(result['projection']['agentId'],'agt_efficiency-agent')


if __name__=='__main__':unittest.main(verbosity=2)
