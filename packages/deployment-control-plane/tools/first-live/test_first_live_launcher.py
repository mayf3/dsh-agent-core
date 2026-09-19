"""Actual isolated system Python with private source/cache fixtures; no sudo."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

FILES={'first_live_launcher.py','first_live_os.py','first_live_io.py','first_live_operator.py',
       'first_live_package.py','bind_records.py','broker_first_delivery.py','broker_delivery_io.py',
       'p4r14_reconcile.py'}
PYTHON='/usr/bin/python3'


def sha(raw):return hashlib.sha256(raw).hexdigest()

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()


class SourceOnly(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='dcp-source-only-');self.addCleanup(self.temp.cleanup)
        self.package=Path(self.temp.name).resolve();self.package.chmod(0o700)
        for name in FILES:(self.package/name).write_text('# private test fixture only\n')
        source=Path(__file__).with_name('first_live_launcher.py')
        (self.package/source.name).write_bytes(source.read_bytes())
        (self.package/'first_live_package.py').write_text("RESULT='REVIEWED_SOURCE_BYTES'\n")
        program="def main():\n import first_live_package\n print(first_live_package.RESULT)\n"
        (self.package/'first_live_operator.py').write_text(program)
        (self.package/'broker_delivery_io.py').write_text(program)
        self.manifest={'version':1,'operation_id':'first-live-dsh-20260918-01',
                       'execution_id':'first-live-dsh-20260918-01-p4r15-recovery-successor','predecessor':{},
                       'operator_files':{n:sha((self.package/n).read_bytes()) for n in FILES}}
        self.freeze()

    def freeze(self):
        for name in FILES:(self.package/name).chmod(0o400)
        p=self.package/'manifest.json'
        if p.exists():p.chmod(0o600)
        raw=canonical(self.manifest);p.write_bytes(raw);p.chmod(0o400)
        self.digest=sha(raw)

    def launch(self,mode='--execute-exact',digest=None):
        return subprocess.run([PYTHON,'-I','-S','-B',str(self.package/'first_live_launcher.py'),
            mode,self.digest if digest is None else digest],cwd='/',capture_output=True,timeout=5,
            env={'PATH':'/usr/bin:/bin','PYTHONPATH':str(self.package),'PYTHONPYCACHEPREFIX':str(self.package/'poison')})

    def poison_cache(self):
        program='''import importlib.util,marshal,os,pathlib,struct,sys
p=pathlib.Path(sys.argv[1]);raw=p.read_bytes();meta=p.stat()
cache=pathlib.Path(importlib.util.cache_from_source(str(p)));cache.parent.mkdir(exist_ok=True)
code=compile("RESULT='UNREVIEWED_CACHE_EXECUTED'\\n",str(p),'exec')
cache.write_bytes(importlib.util.MAGIC_NUMBER+struct.pack('<III',0,int(meta.st_mtime),len(raw))+marshal.dumps(code))
'''
        subprocess.run([PYTHON,'-I','-S','-B','-c',program,str(self.package/'first_live_package.py')],check=True,timeout=5)

    def test_real_legacy_flags_load_poisoned_cache_but_isolated_launcher_uses_source(self):
        self.poison_cache()
        probe=self.package/'probe.py';probe.write_text('import first_live_package;print(first_live_package.RESULT)\n')
        legacy=subprocess.run([PYTHON,'-B','-E','-s',str(probe)],cwd='/',capture_output=True,timeout=5)
        self.assertEqual(legacy.returncode,0,legacy.stderr)
        self.assertEqual(legacy.stdout,b'UNREVIEWED_CACHE_EXECUTED\n')
        for mode in ['--execute-exact','--broker-exact']:
            result=self.launch(mode)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(result.stdout,b'REVIEWED_SOURCE_BYTES\n')
            self.assertNotIn(b'UNREVIEWED',result.stdout+result.stderr)

    def test_manifest_mismatch_or_source_drift_never_imports_helpers(self):
        marker=self.package/'executed'
        p=self.package/'first_live_operator.py';p.chmod(0o600)
        p.write_text('open('+repr(str(marker))+',"w").write("must not run")\n')
        result=self.launch();self.assertNotEqual(result.returncode,0)
        self.assertFalse(marker.exists())
        self.assertNotEqual(self.launch(digest='a'*64).returncode,0)

    def test_unlisted_adjacent_module_and_stdlib_shadow_are_not_loaded(self):
        (self.package/'hashlib.py').write_text('raise RuntimeError("SHADOW_STDLIB_EXECUTED")\n')
        (self.package/'unlisted.py').write_text('raise RuntimeError("SHADOW_LOCAL_EXECUTED")\n')
        p=self.package/'first_live_operator.py';p.chmod(0o600)
        p.write_text('def main():\n import unlisted\n')
        self.manifest['operator_files'][p.name]=sha(p.read_bytes());self.freeze()
        result=self.launch();self.assertNotEqual(result.returncode,0)
        self.assertNotIn(b'SHADOW_',result.stderr)
        self.assertIn(b'unlisted',result.stderr)

    def test_symlink_hardlink_group_writable_or_extra_source_refuse(self):
        target=self.package/'first_live_io.py'
        target.chmod(0o660)
        self.assertNotEqual(self.launch().returncode,0)
        target.chmod(0o400);os.link(target,self.package/'hardlink')
        self.assertNotEqual(self.launch().returncode,0)
        (self.package/'hardlink').unlink();target.unlink();target.symlink_to(self.package/'bind_records.py')
        self.assertNotEqual(self.launch().returncode,0)
        target.unlink();target.write_text('# private test fixture only\n');target.chmod(0o400)
        self.manifest['operator_files']['extra.py']='a'*64;self.freeze()
        self.assertNotEqual(self.launch().returncode,0)

    def test_noncanonical_manifest_and_wrong_launch_flags_or_mode_refuse(self):
        p=self.package/'manifest.json';p.chmod(0o600)
        p.write_text(json.dumps(self.manifest,indent=2));p.chmod(0o400)
        result=self.launch(digest=sha(p.read_bytes()));self.assertNotEqual(result.returncode,0)
        self.freeze()
        result=subprocess.run([PYTHON,'-B','-E','-s',str(self.package/'first_live_launcher.py'),
            '--execute-exact',self.digest],cwd='/',capture_output=True,timeout=5)
        self.assertNotEqual(result.returncode,0)
        self.assertNotEqual(self.launch(mode='--anything').returncode,0)


    def test_sources_are_immutable_verified_bytes_through_late_import(self):
        p=self.package/'first_live_operator.py';p.chmod(0o600)
        p.write_text("def main():\n import pathlib\n p=pathlib.Path(__file__).with_name('first_live_package.py')\n p.chmod(0o600)\n p.write_text(\"RESULT='UNREVIEWED_REPLACEMENT'\\n\")\n import first_live_package\n print(first_live_package.RESULT)\n")
        self.manifest['operator_files'][p.name]=sha(p.read_bytes());self.freeze()
        result=self.launch()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(result.stdout,b'REVIEWED_SOURCE_BYTES\n')
        self.assertIn('UNREVIEWED_REPLACEMENT',(self.package/'first_live_package.py').read_text())


if __name__=='__main__':unittest.main()
