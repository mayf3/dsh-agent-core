"""Runs exact installed snapshot in a disposable unprivileged DS_TEST_MODE process.

Restart/health are DS's existing fake hooks; no production business credit.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest

from receipt import _observe
SOURCE=Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/deployment-reuse-installed-20260929-v1/installed-deployment_system.py')
PIN='95dc02f87106ca9e131839e6d9843a65adcff6018bfbf47725e9241b4e80961d'
sha=lambda b:hashlib.sha256(b).hexdigest()

def request(sock,payload,disconnect=False):
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as s:
        s.settimeout(15);s.connect(str(sock));s.sendall(json.dumps(payload).encode()+b'\n')
        if disconnect:
            s.shutdown(socket.SHUT_RDWR)
            return None
        data=b''
        while b'\n' not in data:
            block=s.recv(65536)
            if not block:break
            data+=block
        return json.loads(data)

class InstalledReuse(unittest.TestCase):
    def test_B_C_disconnected_client_then_rollback_B(self):
        self.assertEqual(sha(SOURCE.read_bytes()),PIN)
        with tempfile.TemporaryDirectory(prefix='ds-reuse-',dir='/tmp') as folder:
            root=Path(folder);state=root/'state';config=root/'config';target=root/'workflow.js';sock=root/'ds.sock'
            state.mkdir();config.mkdir();target.write_bytes(b'A\n')
            (config/'authorized-owner-uid').write_text(str(os.getuid()))
            registry={'version':1,'units':{'workflow':{'kind':'file','target':str(target),'uid':os.getuid(),'gid':os.getgid(),'mode':'0644','restart':'agent-core-runtime'}}}
            reg=config/'deployment-registry.json';reg.write_text(json.dumps(registry,sort_keys=True,separators=(',',':')))
            env={'PATH':'/usr/bin:/bin','DS_TEST_MODE':'1','DS_FAKE_HEALTH':'1','DS_OWNER_UID':str(os.getuid()),'DS_STATE_ROOT':str(state),'DS_SOCK':str(sock),'DS_CONFIG_DIR':str(config),'DS_REGISTRY':str(reg),'DS_GEN_ROOT':str(root/'generations'),'DS_INSTALL_DIR':str(root/'install')}
            log=(root/'daemon.log').open('wb')
            daemon=subprocess.Popen([sys.executable,str(SOURCE)],env=env,stdout=log,stderr=log)
            try:
                deadline=time.monotonic()+15
                while not sock.exists() and time.monotonic()<deadline:
                    self.assertIsNone(daemon.poll());time.sleep(.02)
                self.assertTrue(sock.exists())
                def observe(op):return _observe(state/'receipts',op,'workflow',os.getuid(),fixture=True)
                def terminal(op):
                    end=time.monotonic()+10
                    while time.monotonic()<end:
                        value=observe(op)
                        if value['observation']=='MATCH':return value
                        time.sleep(.02)
                    self.fail('receipt not reconciled: '+str(value))
                def deploy(op,contents,disconnect=False):
                    inbox=state/'inbox'/op;inbox.mkdir();(inbox/'artifact').write_bytes(contents)
                    payload={'action':'DEPLOY','operation_id':op,'unit':'workflow','expected_preimage_sha256':sha(target.read_bytes()),'artifact_sha256':sha(contents),'expected_tree_sha256':'a'*64,'artifact_tree_sha256':'b'*64}
                    return request(sock,payload,disconnect)
                self.assertTrue(deploy('z-version-b',b'B\n')['ok']);self.assertEqual(target.read_bytes(),b'B\n')
                self.assertEqual(terminal('z-version-b')['state'],'COMPLETE')
                self.assertEqual(observe('a-version-c')['observation'],'UNKNOWN')
                self.assertIsNone(deploy('a-version-c',b'C\n',True))
                c=terminal('a-version-c');self.assertEqual(c['state'],'COMPLETE');self.assertEqual(target.read_bytes(),b'C\n')
                self.assertEqual(c['registry_generation'],sha(reg.read_bytes()))
                status=request(sock,{'action':'STATUS'})
                self.assertEqual(status['last_receipt']['operation_id'],'z-version-b')
                self.assertNotEqual(status['last_receipt']['operation_id'],c['operation_id'])
                result=request(sock,{'action':'ROLLBACK','operation_id':'b-rollback-to-b','unit':'workflow','generation':'a-version-c'})
                self.assertTrue(result['ok']);self.assertEqual(target.read_bytes(),b'B\n')
                self.assertEqual(terminal('b-rollback-to-b')['state'],'COMPLETE')
                self.assertIsNone(daemon.poll())
                print(json.dumps({'installedSha256':PIN,'transitions':['A->B','B->C','C->B'],'closedClientOperation':'a-version-c','exactReceipt':c,'lastReceiptMisordered':True,'restartHealth':'FAKE_TEST_ONLY','productionEffects':0},sort_keys=True))
            finally:
                daemon.terminate()
                try:daemon.wait(timeout=5)
                except subprocess.TimeoutExpired:daemon.kill();daemon.wait()
                log.close()

if __name__=='__main__':unittest.main()
