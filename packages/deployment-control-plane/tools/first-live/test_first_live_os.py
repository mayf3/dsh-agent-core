"""Private files and mock process boundaries only; never actual sudo or runtime."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest import mock
import first_live_os as transport


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


class Transport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.package = self.base/'package'; self.package.mkdir(mode=0o700)
        self.journal = self.base/'.agent-deploy-first-live-operator'/'first-live-dsh-20260918-01'
        self.raw = b'fixture script never executed'
        scripts = ['first_live_os.py','first_live_io.py','first_live_operator.py',
                   'broker_first_delivery.py','broker_delivery_io.py','first_live_package.py','bind_records.py','first_live_launcher.py']
        for name in scripts:
            (self.package/name).write_bytes(self.raw); (self.package/name).chmod(0o400)
        self.manifest = {'version':1,'operation_id':'first-live-dsh-20260918-01',
            'source_sha':'a'*40,'source_tree':'b'*40,
            'operator_files':{n:digest(self.raw) for n in scripts},'files':{},'tool_files':{},
            'root_argv_allowlist':[['/bin/cat','/fixed/public'],
                ['/usr/bin/stat','-f','%u|%g|%p|%l|%f|%z|%m|%c|%i|%B|%d|%HT','/fixed/public'],
                ['/bin/ls','-ldeO','/fixed/public']],
            'ordinary_argv_allowlist':[['/usr/bin/python3','-I','-S','-B',str(self.package/'first_live_launcher.py'),'--broker-exact']]}
        self.save_manifest()
        self.stack = contextlib.ExitStack(); self.addCleanup(self.stack.close)
        user=transport.pwd.getpwuid(502)
        user=type('User',(),dict(pw_uid=user.pw_uid,pw_gid=user.pw_gid,pw_dir=str(self.base)))()
        self.stack.enter_context(mock.patch.object(transport.pwd,'getpwuid',return_value=user))
        self.stack.enter_context(mock.patch.object(transport.OperatorIO,'_acl',create=True))
        self.io = transport.OperatorIO(self.manifest,self.package,self.journal)
        self.stack.enter_context(mock.patch.object(transport,'__file__',str(self.package/'first_live_os.py')))
        # Privileged/system platform checks are isolated below a real package/journal implementation.
        self.stack.enter_context(mock.patch.object(self.io,'_validate_tools'))

    def save_manifest(self):
        p=self.package/'manifest.json'
        if p.exists():p.chmod(0o600)
        p.write_text(json.dumps(self.manifest,sort_keys=True,separators=(',',':')));p.chmod(0o400)

    def invoke(self, **kwargs):
        return mock.patch.object(self.io,'_invoke',**kwargs)

    def test_claim_is_exclusive_and_records_are_append_only(self):
        self.io.local_validate(); self.io.claim(); self.io.phase('prefix')
        self.io.record('public.json',{'state':'PENDING'})
        self.assertEqual(stat.S_IMODE(self.journal.stat().st_mode),0o700)
        self.assertEqual(json.loads((self.journal/'public.json').read_text()),{'state':'PENDING'})
        with self.assertRaises((RuntimeError,FileExistsError)):self.io.record('public.json',{})
        other=transport.OperatorIO(self.manifest,self.package,self.journal)
        with mock.patch.object(other,'_validate_tools'),self.assertRaises((RuntimeError,FileExistsError)):other.claim()
        for name in ['../escape','/absolute','a/b']:
            with self.assertRaises(RuntimeError):self.io.record(name,{})

    def test_call_requires_claim_and_exact_argv_and_keeps_consumed_failure(self):
        with self.invoke(return_value=(0,b'public',b'')) as run:
            with self.assertRaises(RuntimeError):self.io.call(['/bin/cat','/fixed/public'])
            self.assertEqual(run.call_count,0)
            self.io.claim()
            with self.assertRaises(RuntimeError):self.io.call(['/bin/sh','-c','true'])
            self.assertEqual(run.call_count,0)
        with self.invoke(side_effect=TimeoutError('lost')) as run:
            with self.assertRaises(RuntimeError):self.io.call(['/bin/cat','/fixed/public'])
            with self.assertRaises(RuntimeError):self.io.call(['/bin/cat','/fixed/public'])
            self.assertEqual(run.call_count,1)
        self.assertTrue(any('unknown' in p.name for p in self.journal.iterdir()))

    def test_root_call_uses_noninteractive_sudo_and_logs_only_public_hashes(self):
        self.io.claim()
        with self.invoke(return_value=(0,b'public',b'warning')) as run:
            self.assertEqual(self.io.call(['/bin/cat','/fixed/public']),b'public')
            self.assertEqual(run.call_args.args[0],['/usr/bin/sudo','-n','/bin/cat','/fixed/public'])
        text=''.join(p.read_text() for p in self.journal.iterdir())
        self.assertIn(digest(b'public'),text)
        self.assertNotIn('warning',text)
        self.assertNotIn('"stdout": "public"',text)

    def test_changed_package_or_manifest_refuses_before_process(self):
        self.io.claim(); (self.package/'first_live_io.py').chmod(0o600)
        (self.package/'first_live_io.py').write_bytes(b'drift')
        with self.invoke(return_value=(0,b'',b'')) as run,self.assertRaises(RuntimeError):
            self.io.call(['/bin/cat','/fixed/public'])
        self.assertEqual(run.call_count,0)

    def test_missing_is_only_exact_enoent_never_permission_denied(self):
        self.io.claim()
        with self.invoke(return_value=(1,b'',b'stat: /fixed/public: No such file or directory\n')):
            self.assertIsNone(self.io.call(self.manifest['root_argv_allowlist'][1],missing=True))
        with self.invoke(return_value=(1,b'',b'Permission denied')),self.assertRaisesRegex(RuntimeError,'ABSENCE'):
            self.io.call(self.manifest['root_argv_allowlist'][1],missing=True)

    def test_visible_call_has_no_capture_or_aggregate_timeout(self):
        self.io.claim()
        with mock.patch('sys.stdin.isatty',return_value=True),mock.patch('sys.stdout.isatty',return_value=True),mock.patch.object(transport.subprocess,'run',return_value=subprocess.CompletedProcess([],0)) as run:
            self.assertEqual(self.io._invoke(['/fixed/native'],visible=True,stdin=None),(0,b'',b''))
            kw=run.call_args.kwargs
            self.assertNotIn('timeout',kw);self.assertNotIn('stdout',kw);self.assertNotIn('stderr',kw)
            self.assertTrue(kw['close_fds']);self.assertEqual(kw['cwd'],'/')
            self.assertNotIn('PYTHONPATH',kw['env'])

    def test_authentication_is_visible_and_bounded_to_three_boundaries(self):
        self.io.claim()
        with self.invoke(return_value=(0,b'',b'')) as run:
            for _ in range(3):self.io.authenticate()
            with self.assertRaises(RuntimeError):self.io.authenticate()
            self.assertEqual(run.call_count,3)
            self.assertEqual(run.call_args.args[0],['/usr/bin/sudo','-v'])
            self.assertTrue(run.call_args.kwargs['visible'])

    def test_copy_passes_real_unlinked_fd_and_requires_protected_postimage(self):
        self.io.claim();raw=b'fixture public bytes';observed=[]
        def call(argv,**kw):
            fd=kw['stdin'];m=os.fstat(fd.fileno())
            self.assertTrue(stat.S_ISREG(m.st_mode));self.assertEqual(m.st_nlink,0)
            self.assertEqual(stat.S_IMODE(m.st_mode),0o600)
            self.assertEqual(fd.read(),raw);observed.append(argv);return b''
        with mock.patch.object(self.io,'call',side_effect=call),mock.patch.object(self.io,'expect') as expect:
            self.io.copy(raw,digest(raw),'0400','/fixed/destination')
            self.assertEqual(observed,[['/usr/bin/install','-o','root','-g','wheel','-m','0400','/dev/fd/0','/fixed/destination']])
            self.assertEqual(expect.call_args.args[1]['sha256'],digest(raw))
            with self.assertRaises(RuntimeError):self.io.copy(raw,digest(raw),'0440','/wrong/handoff',gid=20)
            with self.assertRaises(RuntimeError):self.io.copy(raw,'a'*64,'0400','/fixed/destination')
        self.assertFalse(any(p.name.startswith('tmp') for p in self.journal.iterdir()))

    def test_metadata_brackets_acl_with_stat_and_detects_drift(self):
        self.io.claim();row=b'0|0|100400|1|0|6|10|10|7|1|5|Regular File\n'
        with mock.patch.object(self.io,'call',side_effect=[row,b'-r--------  1 root wheel 6 file\n',row]):
            m=self.io.metadata('/fixed/public');self.assertEqual((m['uid'],m['mode'],m['inode']),(0,0o400,7))
        with mock.patch.object(self.io,'call',side_effect=[row,b'-r--------  1 root wheel 6 file\n',row.replace(b'|7|',b'|8|')]),self.assertRaisesRegex(RuntimeError,'CHANGED'):
            self.io.metadata('/fixed/public')


    def test_actual_install_tuple_is_accepted_but_named_root_input_is_rejected(self):
        allowed=['/usr/bin/install','-o','root','-g','wheel','-m','0555','/dev/fd/0','/fixed/destination']
        self.manifest['root_argv_allowlist'].append(allowed)
        transport.OperatorIO(self.manifest,self.package,self.journal)
        for position,value in [(7,'/caller/input'),(4,'staff'),(6,'0777')]:
            changed=json.loads(json.dumps(self.manifest));changed['root_argv_allowlist'][-1][position]=value
            with self.subTest(value=value),self.assertRaises(RuntimeError):
                transport.OperatorIO(changed,self.package,self.journal)

    def test_launchd_absence_requires_the_exact_service_and_113(self):
        command=['/bin/launchctl','print','system/ai.agent-deployd']
        self.manifest['root_argv_allowlist'].append(command);self.save_manifest()
        self.io=transport.OperatorIO(self.manifest,self.package,self.journal)
        with mock.patch.object(self.io,'_validate_tools'):
            self.io.claim()
            with self.invoke(return_value=(113,b'',b'Could not find service "ai.agent-deployd" in domain for system\n')):
                self.assertIsNone(self.io.call(command,missing=True))

    def test_callable_install_rejects_named_or_linked_stdin_before_runner(self):
        command=['/usr/bin/install','-o','root','-g','wheel','-m','0400','/dev/fd/0','/fixed/destination']
        self.manifest['root_argv_allowlist'].append(command);self.save_manifest()
        self.io=transport.OperatorIO(self.manifest,self.package,self.journal)
        self.stack.enter_context(mock.patch.object(self.io,'_validate_tools'));self.io.claim()
        named=self.base/'named';named.write_bytes(b'data')
        with named.open('rb') as source,self.invoke(return_value=(0,b'',b'')) as run:
            with self.assertRaises(RuntimeError):self.io.call(command,stdin=source)
            self.assertEqual(run.call_count,0)

    def test_python_tool_requires_exact_frozen_link_count_and_sudo_is_metadata_only(self):
        actual=type('Meta',(),dict(st_mode=stat.S_IFREG|0o755,st_uid=0,st_gid=0,st_nlink=78,
            st_size=4,st_flags=524320,st_dev=1,st_ino=2,st_mtime_ns=3,st_ctime_ns=4))()
        row=dict(uid=0,gid=0,mode=0o755,nlink=77,size=4,flags=524320,sha256='a'*64)
        with mock.patch.object(Path,'lstat',return_value=actual),self.assertRaisesRegex(RuntimeError,'nlink'):
            self.io._tool('/usr/bin/python3',row)
        # Authentic FD reads use only a private four-byte file; exact metadata is the OS fixture.
        private=self.base/'tool';private.write_bytes(b'tool');fd=os.open(private,os.O_RDONLY)
        try:
            good=dict(row,nlink=78,sha256=digest(b'tool'))
            with mock.patch.object(Path,'lstat',return_value=actual),mock.patch.object(transport.os,'open',return_value=os.dup(fd)),mock.patch.object(transport.os,'fstat',return_value=actual):
                self.io._tool('/usr/bin/python3',good)
        finally:os.close(fd)
        actual.st_mode=stat.S_IFREG|0o4511;actual.st_nlink=1
        sudo=dict(row,mode=0o4511,nlink=1,sha256=None,digest_state='ONLY_AUTHORIZED_PROTECTED_PREFIX_MAY_OBSERVE')
        with mock.patch.object(Path,'lstat',return_value=actual),mock.patch.object(transport.os,'open') as opening:
            self.io._tool('/usr/bin/sudo',sudo);self.assertEqual(opening.call_count,0)

    def test_public_capture_is_bounded_and_hash_mismatch_stops_attempt(self):
        source=self.base/'public';source.write_bytes(b'x'*128)
        with mock.patch.object(transport,'LIMIT',32),self.assertRaisesRegex(RuntimeError,'OUTPUT_BOUND'):
            self.io._invoke(['/bin/cat',str(source)],visible=False,stdin=None)
        self.io.claim()
        with self.invoke(return_value=(0,b'unexpected',b'')) as run:
            with self.assertRaisesRegex(RuntimeError,'PROTECTED_DIGEST'):
                self.io.call(['/bin/cat','/fixed/public'],expected_digest='a'*64)
            with self.assertRaises(RuntimeError):self.io.call(['/bin/cat','/fixed/public'])
            self.assertEqual(run.call_count,1)
        text=''.join(p.read_text() for p in self.journal.iterdir())
        self.assertNotIn('unexpected',text)

    def test_noncanonical_manifest_symlink_and_wrong_owner_identity_refuse(self):
        self.save_manifest();(self.package/'manifest.json').chmod(0o600);(self.package/'manifest.json').write_text(json.dumps(self.manifest,indent=2))
        with self.assertRaises(RuntimeError):self.io.local_validate()
        self.save_manifest()
        p=self.package/'first_live_io.py'
        p.unlink()
        p.symlink_to(self.package/'first_live_os.py')
        with self.assertRaises((RuntimeError,OSError)):self.io.local_validate()
        with mock.patch.object(transport.os,'getegid',return_value=601),self.assertRaisesRegex(RuntimeError,'GID20'):
            transport.OperatorIO(self.manifest,self.package,self.journal)


    def test_epoch_clock_advances_during_wall_rollback_and_rejects_monotonic_regression(self):
        with mock.patch.object(transport.time,'time',return_value=1780000000),mock.patch.object(transport.time,'monotonic',return_value=100):
            io=transport.OperatorIO(self.manifest,self.package,self.journal)
            self.assertEqual(io.now(),1780000000)
        with mock.patch.object(transport.time,'time',return_value=1770000000),mock.patch.object(transport.time,'monotonic',return_value=130):
            self.assertEqual(io.now(),1780000030)
        with mock.patch.object(transport.time,'monotonic',return_value=129),self.assertRaises(RuntimeError):io.now()

    def test_claim_creates_only_fixed_private_home_parent_and_refuses_unsafe_existing(self):
        self.assertFalse(self.journal.parent.exists());self.io.claim()
        self.assertEqual(stat.S_IMODE(self.journal.parent.stat().st_mode),0o700)
        self.assertTrue((self.journal/'claim.json').exists())
        wrong=self.base/'arbitrary'/'first-live-dsh-20260918-01'
        with self.assertRaises(RuntimeError):transport.OperatorIO(self.manifest,self.package,wrong).claim()

    def test_per_call_rechecks_scripts_but_does_not_rehash_unused_payload(self):
        source=self.package/'unused-payload';source.write_bytes(b'large fixture');source.chmod(0o400)
        self.manifest['files']={'unused-payload':{'sha256':digest(b'large fixture'),'size':13}};self.save_manifest()
        io=transport.OperatorIO(self.manifest,self.package,self.journal)
        with mock.patch.object(io,'_validate_tools'):
            io.claim();source.chmod(0o600);source.write_bytes(b'changed payload')
            with mock.patch.object(io,'_invoke',return_value=(0,b'public',b'')):
                self.assertEqual(io.call(['/bin/cat','/fixed/public']),b'public')
            with self.assertRaises(RuntimeError):io.local_validate()


    def test_daemon_group_membership_refuses(self):
        with mock.patch.object(transport.os,'getgroups',return_value=[20,1]),self.assertRaises(RuntimeError):
            transport.OperatorIO(self.manifest,self.package,self.journal)

    def test_nonvisible_native_entry_refuses(self):
        native=[transport.NATIVE,'--first-live-and-enable']
        self.manifest['root_argv_allowlist'].append(native);self.save_manifest()
        io=transport.OperatorIO(self.manifest,self.package,self.journal)
        with mock.patch.object(io,'_validate_tools'):
            io.claim()
            with mock.patch.object(io,'_ready'),mock.patch.object(io,'_invoke') as run,self.assertRaises(RuntimeError):
                io.call(native)
            self.assertEqual(run.call_count,0)

    def test_unsafe_or_aliased_existing_journal_parent_is_not_repaired(self):
        self.journal.parent.mkdir(mode=0o755)
        with self.assertRaises(RuntimeError):self.io.claim()
        self.assertEqual(stat.S_IMODE(self.journal.parent.stat().st_mode),0o755)
        self.journal.parent.rmdir();self.journal.parent.symlink_to(self.package,target_is_directory=True)
        with self.assertRaises(OSError):self.io.claim()
        self.assertFalse((self.package/self.journal.name).exists())

    def test_manifest_changes_cannot_change_the_authorized_command_set(self):
        self.io.claim();self.io.manifest['root_argv_allowlist'].append(['/bin/cat','/different'])
        self.manifest=self.io.manifest;self.save_manifest()
        with self.invoke(return_value=(0,b'',b'')) as run,self.assertRaises(RuntimeError):
            self.io.call(['/bin/cat','/different'])
        self.assertEqual(run.call_count,0)


    def test_broker_prefix_appends_only_own_exact_manifest_digest(self):
        self.io.claim();prefix=self.manifest['ordinary_argv_allowlist'][0]
        with self.invoke(return_value=(0,b'{}',b'')) as run:
            self.assertEqual(self.io.call(prefix,root=False),b'{}')
            self.assertEqual(run.call_args.args[0],prefix+[self.io.manifest_digest])
            for bad in [prefix+['a'*64],prefix+[self.io.manifest_digest],prefix[:-1]+['--execute-exact']]:
                with self.assertRaises(RuntimeError):self.io.call(bad,root=False)
            self.assertEqual(run.call_count,1)

    def test_only_fixed_socket_directory_install_is_allowed_without_fd(self):
        command=['/usr/bin/install','-d','-o','root','-g','602','-m','0750','/private/var/run/agent-deployd']
        self.manifest['root_argv_allowlist'].append(command);self.save_manifest()
        io=transport.OperatorIO(self.manifest,self.package,self.journal)
        with mock.patch.object(io,'_validate_tools'):
            io.claim()
            with mock.patch.object(io,'_invoke',return_value=(0,b'',b'')) as run:
                self.assertEqual(io.call(command),b'')
                self.assertIsNone(run.call_args.kwargs['stdin'])
                with tempfile.TemporaryFile() as fd,self.assertRaises(RuntimeError):io.call(command,stdin=fd)
                self.assertEqual(run.call_count,1)
        for position,value in [(5,'20'),(7,'0777'),(8,'/other')]:
            changed=json.loads(json.dumps(self.manifest));changed['root_argv_allowlist'][-1][position]=value
            with self.subTest(value=value),self.assertRaises(RuntimeError):transport.OperatorIO(changed,self.package,self.journal)

    def test_real_private_install_d_preserves_existing_inode_and_parent(self):
        # Apple install behavior only; actual UID/GID, private paths, no sudo/root.
        parent=self.base/'install-parent';parent.mkdir(mode=0o700)
        child=parent/'existing';child.mkdir(mode=0o700)
        before=child.stat();p_before=parent.stat()
        subprocess.run(['/usr/bin/install','-d','-o',str(os.getuid()),'-g',str(os.getgid()),'-m','0750',str(child)],check=True,timeout=5)
        after=child.stat();p_after=parent.stat()
        self.assertEqual((after.st_dev,after.st_ino),(before.st_dev,before.st_ino))
        self.assertEqual(stat.S_IMODE(after.st_mode),0o750)
        self.assertEqual((p_after.st_dev,p_after.st_ino,p_after.st_mode,p_after.st_uid,p_after.st_gid),
                         (p_before.st_dev,p_before.st_ino,p_before.st_mode,p_before.st_uid,p_before.st_gid))


if __name__=='__main__':unittest.main()
