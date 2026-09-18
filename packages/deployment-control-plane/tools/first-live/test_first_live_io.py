import hashlib
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
import first_live_io as io


class FixedInput(unittest.TestCase):
    def test_local_source_requires_exact_digest_type_mode_and_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp).resolve()/'source';path.write_bytes(b'accepted');path.chmod(0o400)
            expected=io.digest(b'accepted')
            self.assertEqual(io.read_local(path, expected),b'accepted')
            for kwargs in [dict(expected=io.digest(b'changed!')),dict(expected=expected,maximum=7)]:
                with self.assertRaises((RuntimeError,ValueError,OSError)):
                    io.read_local(path,**kwargs)
            path.chmod(0o666)
            with self.assertRaises((RuntimeError,ValueError,OSError)):
                io.read_local(path,expected)

    def test_local_source_rejects_leaf_and_ancestor_aliases_and_hardlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp).resolve();real=base/'real';real.mkdir()
            p=real/'source';p.write_bytes(b'accepted');p.chmod(0o400)
            expected=io.digest(b'accepted')
            (base/'alias').symlink_to(real,target_is_directory=True)
            (base/'leaf').symlink_to(p)
            for path in [base/'alias/source',base/'leaf']:
                with self.assertRaises((RuntimeError,ValueError,OSError)):
                    io.read_local(path,expected)
            os.link(p,base/'hardlink')
            with self.assertRaises((RuntimeError,ValueError,OSError)):
                io.read_local(p,expected)

    def test_privileged_copy_receives_verified_unlinked_regular_descriptor(self):
        data = b'private fixture bytes\x00not a pathname'
        with tempfile.TemporaryDirectory() as tmp:
            observed = []
            def invoke(argv, *, stdin):
                self.assertEqual(argv, ['/usr/bin/install', '-o', 'root', '-g', 'wheel',
                                        '-m', '0555', '/dev/fd/0', '/fixed/target'])
                m = os.fstat(stdin.fileno())
                self.assertTrue(stat.S_ISREG(m.st_mode))
                self.assertEqual((m.st_uid, m.st_nlink, stat.S_IMODE(m.st_mode)),
                                 (os.getuid(), 0, 0o600))
                observed.append(subprocess.run(['/bin/cat'], stdin=stdin, capture_output=True,
                                               check=True, timeout=2).stdout)
            io.install_bytes(data, hashlib.sha256(data).hexdigest(), '0555',
                             '/fixed/target', Path(tmp), invoke)
            self.assertEqual(observed, [data])
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_hash_mismatch_or_nonbytes_never_calls_privileged_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            for data in [b'changed', '/caller/sensitive/path']:
                called = []
                with self.assertRaises((RuntimeError, ValueError)):
                    io.install_bytes(data, 'a' * 64, '0555', '/fixed/target', Path(tmp),
                                     lambda *a, **k: called.append(a))
                self.assertEqual(called, [])

    def test_replaced_input_path_cannot_change_copy_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'ordinary-source'
            path.write_bytes(b'accepted')
            data = path.read_bytes()
            path.unlink()
            path.symlink_to('/does-not-exist/private-file')
            def invoke(argv, *, stdin):
                self.assertEqual(stdin.read(), b'accepted')
            io.install_bytes(data, hashlib.sha256(data).hexdigest(), '0400',
                             '/fixed/target', Path(tmp), invoke)


if __name__ == '__main__':
    unittest.main()
