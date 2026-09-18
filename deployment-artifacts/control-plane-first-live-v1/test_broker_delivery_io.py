"""Real private files and fake subprocesses only; no real installed binary/socket."""
import json
import os
from pathlib import Path
import sys
import stat
import tempfile
import unittest
from unittest.mock import patch
import broker_delivery_io as io
import broker_first_delivery as b


class IO(unittest.TestCase):
    def test_strict_json_duplicate_nonfinite_trailing_invalid_reject(self):
        self.assertEqual(io.parse_json(b'{"result":{"v":1}}'), {"result": {"v": 1}})
        for raw in [b'{"result":{"v":1,"v":2}}', b'{"x":NaN}', b'{}{}', b'[]', b'\xff', b'{']:
            with self.subTest(raw=raw), self.assertRaises(ValueError): io.parse_json(raw)

    def test_private_real_journal_exclusive_reopen_and_modes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "once"
            with io.Journal(path) as j:
                self.assertFalse(j.consumed())
                j.write("intent.json", {"request_id": b.REQUEST})
                with self.assertRaises((FileExistsError, ValueError)):
                    j.write("intent.json", {})
                self.assertEqual(os.stat(path / "intent.json").st_mode & 0o777, 0o600)
            with io.Journal(path) as j:
                self.assertTrue(j.consumed())
                self.assertEqual(json.loads((path / "intent.json").read_text())["request_id"], b.REQUEST)

    def test_partial_durable_record_and_stray_record_do_not_become_new_attempt(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "once"
            with io.Journal(path) as j:
                with patch.object(io.os, "fsync", side_effect=OSError("fixture fsync failure")):
                    with self.assertRaises(OSError): j.write("intent.json", {"v": 1})
            with io.Journal(path) as j: self.assertTrue(j.consumed())
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "once"
            with io.Journal(path) as j: j.write("call-0001-intent.json", {})
            with io.Journal(path) as j: self.assertTrue(j.consumed())

    def test_symlink_directory_and_record_refuse_no_follow(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td); (base / "real").mkdir(); (base / "link").symlink_to(base / "real")
            with self.assertRaises((OSError, ValueError)): io.Journal(base / "link")
            with io.Journal(base / "once") as j:
                (base / "once" / "intent.json").symlink_to(base / "outside")
                self.assertTrue(j.consumed())
                with self.assertRaises((OSError, ValueError)): j.write("intent.json", {})
            self.assertFalse((base / "outside").exists())

    def test_real_fake_process_json_and_exit_error(self):
        env = {"PATH": "/usr/bin:/bin"}
        value = io.capture([sys.executable, "-c", 'print(\'{"result":{"ok":true}}\')'], env, 2)
        self.assertEqual(value, {"result": {"ok": True}})
        for code in ['print(\'{"error":"DENIED"}\');raise SystemExit(1)',
                     'print("not json")', 'raise SystemExit(2)']:
            with self.subTest(code=code), self.assertRaises(ValueError):
                io.capture([sys.executable, "-c", code], env, 2)

    def test_real_fake_process_timeout_and_output_bound(self):
        for code, limit in [('import time;time.sleep(2)', 0.05),
                            ('print("x" * (9 * 1024 * 1024))', 2),
                            ('import sys;sys.stderr.write("x"*40000)', 2)]:
            with self.subTest(code=code), self.assertRaisesRegex(ValueError, "OUTCOME_UNKNOWN"):
                io.capture([sys.executable, "-c", code], {"PATH": "/usr/bin:/bin"}, limit)

    def test_fixed_transport_argv_no_arbitrary_operation_goal_or_request(self):
        h = {"issued_at": 10, "expires_at": 2 ** 40, "issuer_sha256": "a" * 64, "ctl_sha256": "b" * 64}
        with patch.object(io, "protected_tool", create=True), patch.object(io, "socket_ready", create=True), \
             patch.object(io, "capture", return_value={"proposal_digest": "c" * 64}) as capture:
            t = io.Transport(h, "/Users/fixture")
            t.call("prepare", b.SOURCE, b.REQUEST)
            self.assertEqual(capture.call_args.args[0], [str(io.ROOT / "agent-deploy-issuer"), "prepare", b.GOAL, b.SOURCE])
            for action, arg, req in [("apply", "a" * 64, b.REQUEST), ("prepare", "bad", b.REQUEST),
                ("status", "a" * 64, "another"), ("submit", "not-digest", b.REQUEST)]:
                with self.subTest(action=action), self.assertRaises(ValueError): t.call(action, arg, req)
            self.assertEqual(capture.call_count, 1)

    def test_public_leaf_root_exact_metadata_never_trusts_user_owned_input(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "handoff.json"; p.write_text('{}'); p.chmod(0o440)
            fd = os.open(td, os.O_RDONLY | os.O_DIRECTORY)
            try:
                with self.assertRaisesRegex(ValueError, "PROTECTED_FILE"):
                    io.read_leaf(fd, p.name, 0o440, 20, 4096)
            finally:
                os.close(fd)

    def test_secure_parent_exception_only_fixed_run_directory_without_daemon_group(self):
        from types import SimpleNamespace
        m = SimpleNamespace(st_uid=0, st_gid=1, st_mode=stat.S_IFDIR | 0o775)
        self.assertTrue(io.directory_ok(Path('/private/var/run'), m, [20]))
        self.assertFalse(io.directory_ok(Path('/private/var/run'), m, [1, 20]))
        self.assertFalse(io.directory_ok(Path('/other'), m, [20]))
        m.st_mode = stat.S_IFDIR | 0o777
        self.assertFalse(io.directory_ok(Path('/private/var/run'), m, [20]))

    def test_entry_refuses_root_before_any_file_or_process(self):
        with patch.object(io.os, "geteuid", return_value=0), \
             patch.object(io.os, "open") as opening, patch.object(io, "capture") as capture:
            with self.assertRaises(ValueError): io.main()
            opening.assert_not_called(); capture.assert_not_called()

    def test_read_leaf_allows_atime_only_change_but_rejects_real_identity_drift(self):
        # Authenticate fixture metadata as root only at this pure file-reader seam;
        # all bytes and descriptors are real private nonroot files.
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "record"; p.write_bytes(b'{"fixture":true}'); p.chmod(0o440)
            parent = os.open(td, os.O_RDONLY | os.O_DIRECTORY)
            m = os.stat(p); fields = list(m); fields[4] = 0; fields[5] = 20
            first = os.stat_result(fields); fields[7] += 1; after = os.stat_result(fields)
            try:
                with patch.object(io.os, "fstat", side_effect=[first, after]), \
                     patch.object(io.os, "stat", return_value=after):
                    self.assertEqual(io.read_leaf(parent, p.name, 0o440, 20, 4096), b'{"fixture":true}')
                fields[6] += 1; changed = os.stat_result(fields)
                with patch.object(io.os, "fstat", side_effect=[first, changed]), \
                     patch.object(io.os, "stat", return_value=changed), self.assertRaises(ValueError):
                    io.read_leaf(parent, p.name, 0o440, 20, 4096)
            finally:
                os.close(parent)

    def test_real_private_unix_fake_cli_completes_then_reopen_makes_no_calls(self):
        import socket
        import threading
        from test_broker_first_delivery import handoff, Fake
        h = handoff(); f = Fake(h)
        with tempfile.TemporaryDirectory(prefix="dcp-broker-", dir="/tmp") as td:
            base = Path(td); endpoint = str(base / "mock.sock")
            listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            listener.bind(endpoint); listener.listen(); listener.settimeout(0.1)
            stop = threading.Event(); failures = []
            def serve():
                while not stop.is_set():
                    try: conn, _ = listener.accept()
                    except socket.timeout: continue
                    with conn:
                        try:
                            request = b""
                            while not request.endswith(b"\n"): request += conn.recv(4096)
                            action, argument, request_id = json.loads(request)
                            conn.sendall(b.canonical(f.call(action, argument, request_id)))
                        except BaseException as e: failures.append(e)
            thread = threading.Thread(target=serve); thread.start()
            script = base / "fake_cli.py"
            script.write_text('''import json,socket,sys
s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
s.connect(sys.argv[1]);s.sendall(json.dumps(sys.argv[2:]).encode()+b"\\n")
b=b""
while True:
 p=s.recv(65536)
 if not p:break
 b+=p
sys.stdout.buffer.write(b)
''')
            class PrivateTransport:
                def now(self): return 110
                def pause(self): raise AssertionError("unexpected poll")
                def call(self, action, arg, request):
                    return io.capture([sys.executable, str(script), endpoint, action, arg, request],
                                      {"PATH": "/usr/bin:/bin"}, 2)
            try:
                path = base / "once"
                with io.Journal(path) as journal:
                    result = b.run_once(h, journal, PrivateTransport())
                self.assertEqual(result["state"], "BROKER_DELIVERY_RECEIPTS_OBSERVED")
                calls = list(f.calls)
                with io.Journal(path) as journal, self.assertRaisesRegex(ValueError, "ONCE_ALREADY_CONSUMED"):
                    b.run_once(h, journal, PrivateTransport())
                self.assertEqual(f.calls, calls); self.assertFalse(failures)
            finally:
                stop.set(); thread.join(2); listener.close()

    def test_socket_group_matches_actual_configuration_602_not_caller_or_handoff_20(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as td:
            for group, accepted in [(602, True), (20, False), (0, False)]:
                for name in ['control.sock', 'issuer.sock']:
                    m = SimpleNamespace(st_mode=stat.S_IFSOCK | 0o660, st_uid=0, st_gid=group)
                    with self.subTest(group=group, name=name), \
                         patch.object(io, 'protected_directory', side_effect=lambda _: os.open(td, os.O_RDONLY | os.O_DIRECTORY)), \
                         patch.object(io.os, 'stat', return_value=m):
                        if accepted:
                            io.socket_ready(name)
                        else:
                            with self.assertRaisesRegex(ValueError, 'SOCKET_METADATA'):
                                io.socket_ready(name)
