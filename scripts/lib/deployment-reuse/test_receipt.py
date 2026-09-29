import importlib.util
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

HERE=Path(__file__).parent

def load():
    p=HERE/'receipt.py'
    if not p.exists():
        return types.SimpleNamespace(_observe=lambda *a,**kw:{'observation':'UNKNOWN','reason':'ADAPTER_MISSING'})
    spec=importlib.util.spec_from_file_location('reuse_receipt',p)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.root.chmod(0o700)
        self.m=load();self.value={'operation_id':'op-c','unit':'workflow','action':'DEPLOY','state':'COMPLETE','registry_generation':'a'*64}
        self.path=self.root/'op-c.json';self.path.write_text(json.dumps(self.value));self.path.chmod(0o644)
    def read(self):return self.m._observe(self.root,'op-c','workflow',os.getuid(),fixture=True)
    def test_exact_operation_complete(self):
        r=self.read();self.assertEqual(r['observation'],'MATCH');self.assertEqual(r['state'],'COMPLETE')
        self.assertFalse(r['replayAllowed'])
    def test_absence_unknown(self):
        self.path.unlink();self.assertEqual(self.read()['observation'],'UNKNOWN')
    def test_wrong_id_and_unit_unknown(self):
        for key,value in [('operation_id','other'),('unit','other')]:
            self.path.write_text(json.dumps(dict(self.value,**{key:value})))
            self.assertEqual(self.read()['observation'],'UNKNOWN')
    def test_symlink_hardlink_mode_and_malformed_unknown(self):
        original=self.path.read_bytes();other=self.root/'other';other.write_bytes(original)
        self.path.unlink();self.path.symlink_to(other)
        self.assertEqual(self.read()['observation'],'UNKNOWN')
        self.path.unlink();os.link(other,self.path)
        self.assertEqual(self.read()['observation'],'UNKNOWN')
        self.path.unlink();self.path.write_bytes(original);self.path.chmod(0o666)
        self.assertEqual(self.read()['observation'],'UNKNOWN')
        self.path.chmod(0o644);self.path.write_text('{bad')
        self.assertEqual(self.read()['observation'],'UNKNOWN')
    def test_unknown_progress_and_duplicate_keys(self):
        self.path.write_text(json.dumps(dict(self.value,state='PREPARE')))
        self.assertEqual(self.read()['observation'],'UNKNOWN')
        self.path.write_text('{"operation_id":"op-c","operation_id":"other"}')
        self.assertEqual(self.read()['observation'],'UNKNOWN')
    def test_permission_and_replacement_unknown(self):
        if not hasattr(self.m,'os'):self.skipTest('RED adapter missing')
        with patch.object(self.m.os,'open',side_effect=PermissionError):
            self.assertEqual(self.read()['observation'],'UNKNOWN')
        real=self.m.os.read;changed=False
        def replace(fd,n):
            nonlocal changed
            b=real(fd,n)
            if not changed:
                replacement=self.root/'replacement';replacement.write_text(json.dumps(self.value));replacement.chmod(0o644);replacement.replace(self.path);changed=True
            return b
        with patch.object(self.m.os,'read',side_effect=replace):
            self.assertEqual(self.read()['observation'],'UNKNOWN')

if __name__=='__main__':unittest.main()
