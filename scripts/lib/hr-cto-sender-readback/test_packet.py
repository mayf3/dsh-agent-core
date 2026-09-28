"""Exact fixed transport/candidate admission tests, temporary offline only."""
import ast
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import build


class Packet(unittest.TestCase):
    def test_fixed_update_pair_admitted_not_arbitrary_pair(self):
        path=build.OUT/'shim-artdir/deploy_shim.py'
        source=path.read_text() if path.exists() else (build.PRIOR/'shim-artdir/deploy_shim.py').read_text()
        candidate=build.sha((build.OUT/'artdir/deployment_system.py').read_bytes())
        def require(value,reason):
            if not value:raise RuntimeError(reason)
        ns={'require':require, 'HR_CTO_UPDATE_REQUEST_SHA256':None}
        exec(build.function(source,'_binding_update_pair'),ns)
        with self.assertRaisesRegex(RuntimeError,'NATIVE_MESSAGE_ID_UNBOUND'):
            ns['_binding_update_pair']('hr-cto-ds-install-20260928-54b0945f',build.DS_SHA,candidate)
        ns['HR_CTO_UPDATE_REQUEST_SHA256']='1'*64  # isolated binding, no production credit
        try:
            ns['_binding_update_pair']('hr-cto-ds-install-20260928-54b0945f',build.DS_SHA,candidate)
        except RuntimeError as exc:
            self.fail('FIXED_REVIEWED_PAIR_NOT_IMPLEMENTED:'+str(exc))
        for args in [('arbitrary-id',build.DS_SHA,candidate),('hr-cto-ds-install-20260928-54b0945f','0'*64,candidate)]:
            with self.assertRaises(RuntimeError):ns['_binding_update_pair'](*args)

    def test_client_unbound_before_socket_or_password(self):
        ns={'__name__':'isolated_client'}
        exec((build.OUT/'client-artdir/ds_client.py').read_text(),ns)
        ns['request']=lambda _:self.fail('MUST_NOT_CONNECT_UNBOUND')
        with self.assertRaisesRegex(RuntimeError,'NATIVE_MESSAGE_ID_UNBOUND'):
            ns['hr_cto_owner_sender_readback']()

    def test_fixed_client_packet_and_socket_no_fallback(self):
        ns={'__name__':'isolated_client'}
        exec((build.OUT/'client-artdir/ds_client.py').read_text(),ns)
        packet={'action':'HR_CTO_OWNER_SENDER_HASH_READBACK_V1','operation_id':'hr-cto-owner-read-20260928-54b0945f','feishu_message_id':'om_fixture_only'}
        ns['HR_CTO_FROZEN_REQUEST']=packet
        ns['HR_CTO_REQUEST_SHA256']=build.sha(json.dumps(packet,sort_keys=True,separators=(',',':')).encode())
        ns['SOCK']='untrusted-env-socket'
        calls=[]
        def request(value):
            self.assertEqual(value,packet)
            self.assertEqual(ns['SOCK'],'/private/var/run/agent-deploy-system.sock')
            calls.append(value)
            return {'ok':False,'state':'UNKNOWN'}
        ns['request']=request
        with patch('subprocess.run',side_effect=AssertionError('NO_SUDO_OR_WRAPPER')):
            self.assertEqual(ns['hr_cto_owner_sender_readback']()['state'],'UNKNOWN')
        self.assertEqual(len(calls),1)
        ns['HR_CTO_FROZEN_REQUEST']={**packet,'path':'not-allowed'}
        with self.assertRaises(RuntimeError):ns['hr_cto_owner_sender_readback']()


if __name__=='__main__':unittest.main(verbosity=2)
