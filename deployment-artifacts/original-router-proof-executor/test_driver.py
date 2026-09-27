import os, subprocess, unittest
import ast, dataclasses, re, secrets, time, types, fcntl, select
import hashlib, json, socket, array, struct, builtins, io, sys
from unittest.mock import patch
from pathlib import Path
from confined_reporting import memory_reporter

# Exact own sources only; read before target import/denial. The reporter below
# never resolves unknown filenames or falls back to stat/open.
_own=Path(__file__).absolute()
_driver_path=_own.with_name('driver.py')
_driver_source=_driver_path.read_bytes()
_reporter=memory_reporter({str(p):p.read_text() for p in (_own,_own.with_name('driver.py'))})
_helper_path=_own.parents[2]/'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py'
_helper_source=_helper_path.read_bytes()
_deployment_source=_own.with_name('deployment.py').read_bytes()
_procedure_source=_own.with_name('procedure.py').read_bytes()
for g in _reporter:g.start()

def denied(*a, **k): raise AssertionError('HOST_BOUNDARY_DENIED')
_guards=[patch.object(subprocess,n,denied) for n in ('Popen','run','check_output','call')]+[patch.object(os,n,denied) for n in ('open','stat','fstat','pread','read','write','close','dup','lseek','fsync')]
_guards += [patch.object(builtins,'open',denied),patch.object(io,'open',denied)]
_guards += [patch.object(os,n,denied) for n in ('lstat','listdir','scandir','readlink','chown','lchown','fchown','fchmod','mkdir','rmdir','unlink','rename','replace','symlink','link','utime','kill','fork')]

def cached_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level or name not in sys.modules: raise AssertionError('UNCACHED_IMPORT_DENIED')
    return sys.modules[name if fromlist else name.split('.')[0]]
_guards.append(patch.object(builtins,'__import__',cached_import))
for g in _guards:g.start()
try:
    d=types.ModuleType('driver');d.__file__=str(_driver_path)
    sys.modules['driver']=d
    exec(compile(_driver_source,str(_driver_path),'exec'),d.__dict__)
    _helper={'__name__':'_confined_qualification_helper'}
    exec(compile(_helper_source,str(_helper_path),'exec'),_helper)
except BaseException:
    for g in reversed(_guards):g.stop()
    raise

class Tests(unittest.TestCase):
    def test_final_exact_owned_exit_precedes_seal_and_losses_never_retry(self):
        scope={'__name__':'_confined_final_disposition','FixedOriginalDriver':d.FixedOriginalDriver,
               'require':d.require,'Unknown':d.Unknown}
        exec(compile(_procedure_source,'original-procedure.py','exec'),scope)
        for failure in (None,'exit','custody','deadline'):
            x=object.__new__(d.FixedOriginalDriver)
            x._unknown=False;x._operation_deadline=100;x._startup_deadline=90
            x._phase_started_wall_ms=1000;x._owned_children=[];x._stopped_children=set()
            events=[]
            class OwnedChild:
                def __init__(self,phase):self.phase=phase;self.exited=False
                def poll(self):return 0 if self.exited else None
                def terminate(self):events.append('terminate:'+self.phase)
                def wait(self,timeout):
                    self.assert_bound=0 < timeout <= 30
                    if self.phase=='restart_b' and failure=='exit':raise TimeoutError('owned exit unknown')
                    self.exited=True;events.append('exit:'+self.phase);return 0
            def launch(phase):
                x._child=OwnedChild(phase);x._owned_children.append(x._child);events.append('launch:'+phase)
            def continuity():
                d.require(not x._unknown,'ORIGINAL_CUSTODY_UNKNOWN')
                d.require(clock() < x._operation_deadline,'ORIGINAL_PROCEDURE_DEADLINE')
                if len(getattr(x,'_procedure_turns',[]))==3 and failure=='custody':
                    raise d.Unknown('ORIGINAL_WINDOW_CHANGED')
            x._continuity=continuity;x._launch_phase=launch
            x._deploy_original=lambda:launch('deployment_start');x._health_original=lambda:None
            def completed(owner):
                n=len(owner._procedure_turns)+1
                return {'floor':n,'maxIssuedTurnSeq':n,'live':[],'evicted':[],'watermark':None,
                    'turnExecutionId':'turn-'+str(n),'processGeneration':n,
                    'nativeMessageSha256':str(n)*64,'nativeReceiptSha256':str(n)*64,'completedAtWallMs':1001}
            scope['OBSERVER_SHA']='a'*64;scope['_completed_turn']=completed
            scope['_owned_turn']=lambda owner,value:'runtime-'+str(value['processGeneration'])
            def seal(owner):
                self.assertEqual(sum(child.poll() is None for child in owner._owned_children),0)
                events.append('seal');return 'existing-closed-proof'
            scope['_seal_owned']=seal
            def clock():return 101 if failure=='deadline' and len(getattr(x,'_procedure_turns',[]))==3 else 1
            with patch.object(d.time,'monotonic',side_effect=clock):
                if failure is None:
                    self.assertEqual(scope['_sequence_owned'](x),'existing-closed-proof')
                    self.assertEqual(events[-2:],['exit:restart_b','seal']);self.assertFalse(x._unknown)
                    self.assertTrue(all(child.assert_bound for child in x._owned_children))
                else:
                    with self.assertRaises((d.Unknown,TimeoutError)):scope['_sequence_owned'](x)
                    self.assertTrue(x._unknown);self.assertNotIn('seal',events)
                    if failure in ('custody','deadline'):self.assertNotIn('terminate:restart_b',events)
                    before=list(events)
                    with self.assertRaises(d.Unknown):scope['_sequence_owned'](x)
                    self.assertEqual(events,before)
                self.assertIs(x._child,x._owned_children[-1])
                self.assertEqual(len(x._owned_children),3)
    def test_canonical_owned_descriptor_loss_is_sticky_before_procedure_effect(self):
        from types import SimpleNamespace
        x=object.__new__(d.FixedOriginalDriver);x._unknown=False;x._operation_deadline=100
        x._window_fd=4;x._window_identity=(1,4,0,0o100600)
        x._canonical_fd=13;x._canonical_identity=(1,12)
        x._binding=d._EntryBinding(*(['a'*64]*5));x._binary=lambda:'a'*64
        def meta(fd):
            return SimpleNamespace(st_mode=0o100600,st_uid=0,st_nlink=1,st_size=0,
                st_dev=1,st_ino=4 if fd==4 else 99)
        with patch.object(os,'fstat',side_effect=meta),patch.object(d.time,'monotonic',return_value=1):
            with self.assertRaisesRegex(d.Unknown,'ORIGINAL_CANONICAL_CHANGED'):x._continuity()
        self.assertTrue(x._unknown);self.assertEqual(x._canonical_fd,13)

    def test_unbound_entry_before_io(self):
        with self.assertRaisesRegex(d.Unknown,'QUALIFICATION_ENTRY_UNBOUND'):d.FixedOriginalDriver()
    def test_no_accept_events(self):self.assertFalse(hasattr(d,'accept_events'))
    def test_fixed_phase_set(self):self.assertEqual(d.PHASES,('deployment_start','restart_a','restart_b'))
    def test_no_hr_operation_id(self):self.assertNotEqual(d.ID,'hr-s256-trusted-quiescence-cut-20260925-v1')
    def test_owned_store_projection(self):
        x=d._store_projection({'loadable':True,'floor':3,'maxIssuedTurnSeq':8,'overlappingLiveRanges':False})
        self.assertEqual(x,(3,8))
    def test_store_false_or_alias_rejected(self):
        for x in ({'loadable':False},{'loadable':True,'floor':True,'maxIssuedTurnSeq':8,'overlappingLiveRanges':False},{'loadable':True,'floor':3,'maxIssuedTurnSeq':8,'overlappingLiveRanges':True}):
            with self.assertRaises(d.Unknown):d._store_projection(x)
    def test_duplicate_child_json_rejected(self):
        with self.assertRaises(d.Unknown):d._object(b'{"floor":1,"floor":2}')
    def test_qualification_context_closed_role_phase(self):
        base={'role':'original_executor_qualification','phase':'restart_a','consumingBinarySha256':'a'*64,
              'validatorSha256':'c'*64,'entryManifestSha256':'e'*64,
              'procedureSha256':d.PROCEDURE_SHA,'startupNonce':'b'*64}
        self.assertEqual(d._context(base),base)
        for k,v in (('role','hr_recovery'),('phase','fourth'),('procedureSha256','c'*64)):
            with self.assertRaises(d.Unknown):d._context({**base,k:v})
        with self.assertRaises(d.Unknown):d._context({**base,'PASS':True})
    def test_entry_binding_is_not_uid_thread_or_pass(self):
        for value in ({'uid':0}, {'thread':'original'}, {'PASS':True}, True):
            with patch.object(d,'QUALIFIED_ORIGINAL_ENTRY',value):
                with self.assertRaisesRegex(d.Unknown,'QUALIFICATION_ENTRY_BINDING'):
                    d.FixedOriginalDriver()
    def test_entry_files_reject_mutable_or_nonroot(self):
        from types import SimpleNamespace
        good=SimpleNamespace(st_mode=0o100600,st_uid=0,st_nlink=1,st_size=5)
        d._root_regular(good)
        for key,value in (('st_uid',505),('st_mode',0o100622),('st_nlink',2),('st_size',65537)):
            wrong=SimpleNamespace(**{**vars(good),key:value})
            with self.assertRaises(d.Unknown):d._root_regular(wrong)
    def test_private_descriptor_grammar(self):
        self.assertEqual(d._invocation(['--original-qualification-fds','3,4,5,6,7,8']), (3,4,5,6,7,8))
        for args in ([],['--root','/any'],['--original-qualification-fds','3,3,5,6'],
                     ['--original-qualification-fds','3,4,5,6','--PASS'],
                     ['--original-qualification-fds','3,4,5,true']):
            with self.assertRaises(d.Unknown):d._invocation(args)
    def test_descriptor_read_checks_prepost_and_digest(self):
        from types import SimpleNamespace
        m=SimpleNamespace(st_mode=0o100600,st_uid=0,st_nlink=1,st_size=2,
                          st_dev=1,st_ino=2,st_mtime_ns=3,st_ctime_ns=4)
        with patch.object(d.os,'fstat',return_value=m),patch.object(d.os,'pread',return_value=b'{}'):
            self.assertEqual(d._descriptor_bytes(9,d.hashlib.sha256(b'{}').hexdigest()),b'{}')
            with self.assertRaises(d.Unknown):d._descriptor_bytes(9,'0'*64)
        changed=SimpleNamespace(**{**vars(m),'st_ctime_ns':5})
        with patch.object(d.os,'fstat',side_effect=[m,changed]),patch.object(d.os,'pread',return_value=b'{}'):
            with self.assertRaises(d.Unknown):d._descriptor_bytes(9,d.hashlib.sha256(b'{}').hexdigest())
    def test_manifest_binds_original_entry_and_final_whole_binary(self):
        binding=d._EntryBinding(*(['a'*64]*5))
        value={'entrySha256':'a'*64,'consumingBinarySha256':'a'*64,
               'validatorSha256':'a'*64,'helperSha256':'a'*64,'procedureSha256':d.PROCEDURE_SHA}
        self.assertEqual(d._entry_manifest(value,binding),value)
        for key in value:
            with self.assertRaises(d.Unknown):d._entry_manifest({**value,key:'b'*64},binding)
        with self.assertRaises(d.Unknown):d._entry_manifest({**value,'PASS':True},binding)
    def test_qualification_phase_requires_admitted_driver_and_once_only(self):
        x=object.__new__(d.FixedOriginalDriver)
        x._unknown=True
        with self.assertRaisesRegex(d.Unknown,'ORIGINAL_CUSTODY_UNKNOWN'):x._next_context('deployment_start')
    def test_actual_admission_and_three_phases_with_nonforwarding_fd_cells(self):
        from types import SimpleNamespace
        import json
        entry=b'fixed fixture entry'
        helper=b'def prove(*args):\n return {"nonce":"' + b'b'*64 + b'"}\n'
        sha=lambda x:d.hashlib.sha256(x).hexdigest()
        body={'entrySha256':sha(entry),'consumingBinarySha256':'a'*64,
              'validatorSha256':'c'*64,'helperSha256':sha(helper),'procedureSha256':d.PROCEDURE_SHA}
        raw=json.dumps(body,sort_keys=True,separators=(',',':')).encode()
        binding=d._EntryBinding(sha(entry),sha(raw),'a'*64,'c'*64,sha(helper))
        data={5:raw,6:entry,7:helper,4:b''}
        def meta(fd):
            return SimpleNamespace(st_mode=0o100600,st_uid=0,st_nlink=1,st_size=len(data[fd]),
                st_dev=1,st_ino=fd,st_mtime_ns=3,st_ctime_ns=4)
        with patch.object(d,'QUALIFIED_ORIGINAL_ENTRY',binding), \
             patch.object(d.sys,'argv',['driver','--original-qualification-fds','3,4,5,6,7,8']), \
             patch.object(d.os,'stat',return_value=meta(6)), \
             patch.object(d.os,'fstat',side_effect=meta), \
             patch.object(d.os,'pread',side_effect=lambda fd,n,offset:data[fd][offset:offset+n]), \
             patch.object(d.secrets,'token_hex',return_value='d'*64), \
             patch.object(d.FixedOriginalDriver,'_binary',return_value='a'*64):
            x=d.FixedOriginalDriver()
            for phase in d.PHASES:
                context=x._next_context(phase)
                self.assertEqual(context['phase'],phase)
                self.assertEqual(context['validatorSha256'],binding.validator_sha256)
                self.assertEqual(context['entryManifestSha256'],binding.manifest_sha256)
            with self.assertRaisesRegex(d.Unknown,'QUALIFICATION_PHASE_NO_REPLAY'):x._next_context('restart_b')
            self.assertTrue(x._unknown)
    def test_same_binary_must_be_observed_before_private_phase_context(self):
        from types import SimpleNamespace
        x=object.__new__(d.FixedOriginalDriver)
        x._unknown=False;x._used_phases=set();x._window_fd=4;x._window_identity=(1,4,0,0o100600)
        x._binding=d._EntryBinding(*(['a'*64]*5))
        m=SimpleNamespace(st_mode=0o100600,st_uid=0,st_nlink=1,st_size=0,st_dev=1,st_ino=4)
        with patch.object(d.os,'fstat',return_value=m),patch.object(d.FixedOriginalDriver,'_binary',return_value='b'*64):
            with self.assertRaisesRegex(d.Unknown,'CONSUMING_BINARY_CHANGED'):x._next_context('deployment_start')
        self.assertTrue(x._unknown);self.assertEqual(x._used_phases,set())
    def test_owned_child_stop_requires_actual_object_and_once(self):
        from types import SimpleNamespace
        x=object.__new__(d.FixedOriginalDriver)
        x._unknown=False;x._child=None
        with self.assertRaisesRegex(d.Unknown,'ORIGINAL_CHILD_UNOWNED'):x._stop_owned_child()
        self.assertTrue(x._unknown)
        calls=[]
        child=SimpleNamespace(poll=lambda:None,terminate=lambda:calls.append('terminate'),
                              wait=lambda timeout:calls.append(('wait',timeout)))
        x._unknown=False;x._child=child;x._stopped_children=set();x._owned_children=[child]
        x._operation_deadline=100
        with patch.object(d.FixedOriginalDriver,'_continuity',return_value=None),patch.object(d.time,'monotonic',return_value=1):
            x._stop_owned_child()
            self.assertEqual(calls[0],'terminate')
            with self.assertRaisesRegex(d.Unknown,'ORIGINAL_CHILD_NO_REPLAY'):x._stop_owned_child()
        self.assertIs(x._child,child);self.assertTrue(x._unknown)

    def test_private_launch_without_admission_is_zero_effect(self):
        x=object.__new__(d.FixedOriginalDriver);x._unknown=True
        with self.assertRaisesRegex(d.Unknown,'ORIGINAL_CUSTODY_UNKNOWN'):
            x._launch_phase('deployment_start')

    def test_original_deployment_without_frozen_private_binding_is_zero_effect(self):
        x=object.__new__(d.FixedOriginalDriver);x._unknown=False
        with self.assertRaisesRegex(d.Unknown,'ORIGINAL_DEPLOYMENT_UNBOUND'):
            x._deploy_original()
        self.assertTrue(x._unknown)

    def test_actual_launch_callsite_retains_one_owned_child_on_challenge_loss(self):
        from types import SimpleNamespace
        calls=[];context={}
        class Handoff:
            def __init__(self,digest,window,nonce):calls.append(('bind',digest,window,nonce))
            def take_child_fds(self):return 7,8
            def close_child_fds(self):calls.append('child_fds_closed')
            def challenge(self):
                if context.get('loss'):raise d.Unknown('fixture_ofd_loss')
                calls.append('ofd_authenticated')
            def close(self):calls.append('handoff_closed')
        child=SimpleNamespace(poll=lambda:None)
        x=object.__new__(d.FixedOriginalDriver);x._unknown=False;x._child=None
        x._operation_deadline=10**12
        x._owned_children=[];x._stopped_children=set();x._context_fds=[];x._window_fd=4
        value={'role':'original_executor_qualification','phase':'deployment_start',
               'consumingBinarySha256':'a'*64,'validatorSha256':'c'*64,
               'entryManifestSha256':'e'*64,'procedureSha256':d.PROCEDURE_SHA,'startupNonce':'b'*64}
        written=[]
        def spawn(argv,**options):
            calls.append((argv,options));return child
        with patch.object(d.FixedOriginalDriver,'_continuity',return_value=None), \
             patch.object(d.FixedOriginalDriver,'_next_context',return_value=value), \
             patch.object(d,'_namespace_directory',return_value=9), \
             patch.object(d.FixedOriginalDriver,'_parent_handoff_type',return_value=Handoff), \
             patch.object(d.os,'open',return_value=10), \
             patch.object(d.os,'write',side_effect=lambda fd,raw:(written.append(raw),len(raw))[1]), \
             patch.object(d.os,'fsync',side_effect=lambda fd:calls.append(('fsync',fd))), \
             patch.object(d.os,'close',side_effect=lambda fd:calls.append(('close',fd))), \
             patch.object(d,'_descriptor_bytes',side_effect=lambda *args:written[-1]), \
             patch.object(d.subprocess,'Popen',side_effect=spawn):
            self.assertIs(x._launch_phase('deployment_start'),child)
            command=next(c for c in calls if isinstance(c,tuple) and isinstance(c[0],list))
            self.assertEqual(command[0][:2],[d.NODE,d.GATED])
            self.assertEqual(command[1]['pass_fds'],(7,8,10))
            self.assertEqual(command[1]['user'],505)
            self.assertNotIn('--hr-r2-receipt-sha256',command[0])
            self.assertEqual(x._owned_children,[child])
            x._stopped_children.add(id(child));context['loss']=True
            with self.assertRaisesRegex(d.Unknown,'fixture_ofd_loss'):x._launch_phase('restart_a')
            self.assertTrue(x._unknown);self.assertIs(x._child,child)
            before=len(calls)
            with self.assertRaisesRegex(d.Unknown,'ORIGINAL_CUSTODY_UNKNOWN'):x._launch_phase('restart_b')
            self.assertEqual(len(calls),before)

    def test_assembled_original_sequence_seals_only_after_three_owned_turns(self):
        from types import SimpleNamespace
        x=object.__new__(d.FixedOriginalDriver)
        x._unknown=False;x._operation_deadline=100;x._startup_deadline=90
        x._phase_started_wall_ms=1000;x._binding=d._EntryBinding(*(['a'*64]*5))
        order=[]
        x._continuity=lambda:None
        x._deploy_original=lambda:order.append('deploy')
        x._stop_owned_child=lambda:order.append('owned_stop')
        x._launch_phase=lambda p:order.append(p)
        x._health_original=lambda:order.append('required_health')
        scope={'__name__':'_confined_procedure','__file__':d.__file__,
            'FixedOriginalDriver':d.FixedOriginalDriver,'require':d.require,'Unknown':d.Unknown,
            '_namespace_directory':lambda p:10,'_descriptor_bytes':d._descriptor_bytes,
            '_object':d._object,'NODE':d.NODE,'NODE_SHA':d.NODE_SHA,'QUALIFIED_OWNER_SHA':'f'*64}
        exec(compile(_procedure_source,'original-procedure.py','exec'),scope)
        scope['OBSERVER_SHA']='f'*64
        def completed(owner):
            n=len(owner._procedure_turns)+1;order.append('native_completed_'+str(n))
            return {'floor':n,'maxIssuedTurnSeq':n,'live':[],'evicted':[], 'watermark':None,
                'turnExecutionId':'turn-'+str(n),'processGeneration':n,
                'nativeMessageSha256':str(n)*64,'nativeReceiptSha256':str(n)*64,
                'completedAtWallMs':1001}
        scope['_completed_turn']=completed
        scope['_owned_turn']=lambda owner,value:'runtime-'+str(value['processGeneration'])
        def seal(owner):
            order.append('seal');return tuple(owner._procedure_turns)
        scope['_seal_owned']=seal
        self.assertEqual(len(scope['_sequence_owned'](x)),3)
        self.assertEqual(order,['deploy','native_completed_1','required_health','owned_stop','restart_a',
            'native_completed_2','required_health','owned_stop','restart_b','native_completed_3','required_health','owned_stop','seal'])
        self.assertFalse(x._unknown)
        # Actual event checker, not an accepted PASS boolean: duplicate turn
        # and generation cannot complete even when a callsite returns a value.
        for changed in ('processGeneration','turnExecutionId','nativeMessageSha256'):
            x._unknown=False;order.clear()
            def replay(owner, changed=changed):
                value=completed(owner)
                if owner._procedure_turns:value[changed]=owner._procedure_turns[-1][changed]
                return value
            scope['_completed_turn']=replay
            with self.assertRaises(d.Unknown):scope['_sequence_owned'](x)
            self.assertTrue(x._unknown);self.assertNotIn('seal',order)

    def test_private_same_child_query_has_original_deadline_and_exact_binding(self):
        from types import SimpleNamespace
        import json
        x=object.__new__(d.FixedOriginalDriver);x._unknown=False
        x._operation_deadline=100;x._startup_deadline=90;x._continuity=lambda:None
        child=SimpleNamespace(poll=lambda:None);x._child=child;x._owned_children=[child]
        context={'phase':'restart_a','startupNonce':'a'*64};x._phase_context=context
        value={'turnExecutionId':'turn-owned','processGeneration':2,
            'nativeMessageSha256':'b'*64,'nativeReceiptSha256':'c'*64,'completedAtWallMs':20}
        frame={'context':context,'challenge':'d'*32,'handle':'turn-owned','replyReceiptSha256':'f'*64,
            'runtimeGeneration':'owned-runtime',**{k:value[k] for k in value if k!='turnExecutionId'}}
        sent=[];closed=[]
        channel=SimpleNamespace(settimeout=lambda t:None,sendall=lambda raw:sent.append(json.loads(raw)),
            recv=lambda n:json.dumps(frame).encode()+b'\n')
        x._phase_handoff=SimpleNamespace(root=channel,close=lambda:closed.append(True))
        scope={'__name__':'_confined_procedure','FixedOriginalDriver':d.FixedOriginalDriver,
            'require':d.require,'Unknown':d.Unknown,'_object':d._object}
        exec(compile(_procedure_source,'original-procedure.py','exec'),scope)
        with patch.object(d.time,'monotonic',return_value=1),patch.object(d.secrets,'token_hex',return_value='d'*32):
            self.assertEqual(scope['_owned_turn'](x,value),'owned-runtime')
            self.assertEqual(sent[0],{'context':context,'challenge':'d'*32,'handle':'turn-owned',
                'deadlineMonotonicNs':'16000000000'})
        self.assertEqual(closed,[True])
        x._unknown=False;sent.clear()
        with patch.object(d.time,'monotonic',return_value=91):
            with self.assertRaisesRegex(d.Unknown,'ORIGINAL_READBACK_DEADLINE'):scope['_owned_turn'](x,value)
        self.assertEqual(sent,[])

    def test_actual_prequalification_validator_uses_deploy_uid_not_mi_uid(self):
        from types import SimpleNamespace
        import posixpath
        raw=b'actual fixed validator fixture';digest=d.hashlib.sha256(raw).hexdigest()
        x=object.__new__(d.FixedOriginalDriver);x._binding=d._EntryBinding('a'*64,'b'*64,'c'*64,digest,'e'*64)
        scope={'__name__':'_confined_procedure','require':d.require,'FixedOriginalDriver':d.FixedOriginalDriver}
        exec(compile(_procedure_source,'original-procedure.py','exec'),scope)
        paths={};changes={}
        def opened(path,flags,*args,dir_fd=None):
            name=path if dir_fd is None else posixpath.join(paths[dir_fd],path)
            fd=len(paths)+10;paths[fd]=name;return fd
        def metadata(fd):
            name=paths[fd];app=name.startswith(d.APP)
            leaf=name.endswith('quiescence-bundle.js')
            return SimpleNamespace(st_mode=0o100644 if leaf else 0o40755,
                st_uid=changes.get('uid',505) if app else 0,
                st_gid=changes.get('gid',601) if app else 0,st_size=len(raw) if leaf else 0,
                st_nlink=1,st_dev=1,st_ino=fd,st_mtime_ns=1,st_ctime_ns=1)
        def stat_path(path,dir_fd=None,**kw):
            name=posixpath.join(paths[dir_fd],path)
            return metadata(next(fd for fd,p in paths.items() if p==name))
        with patch.object(os,'open',side_effect=opened),patch.object(os,'close',return_value=None), \
             patch.object(os,'fstat',side_effect=metadata),patch.object(os,'stat',side_effect=stat_path), \
             patch.object(os,'pread',side_effect=lambda *a:changes.get('raw',raw)):
            scope['_validator_after_deploy'](x)
            for changed in ({'uid':0},{'gid':0},{'raw':b'changed'}):
                paths.clear();changes.clear();changes.update(changed)
                with self.assertRaises(d.Unknown):scope['_validator_after_deploy'](x)

    def test_actual_fixed_proof_seal_closed_bytes_and_no_duplicate_replay(self):
        x=object.__new__(d.FixedOriginalDriver);x._unknown=False
        x._binding=d._EntryBinding(*(['a'*64]*5));x._procedure_turns=[{'completedAtWallMs':1001}]*3
        x._validator_installed_wall_ms=1000;x._continuity=lambda:None
        files={};writes=[];closed=[]
        scope={'__name__':'_confined_procedure','require':d.require,
            '_namespace_directory':lambda path:10,
            '_descriptor_bytes':lambda fd,digest:files[fd]}
        exec(compile(_procedure_source,'original-procedure.py','exec'),scope)
        claimed=[]
        def opened(name,flags,mode,dir_fd):
            if name in claimed:raise FileExistsError('fixed claim exists')
            self.assertEqual(dir_fd,10);self.assertEqual(mode,0o600)
            self.assertTrue(flags & os.O_EXCL);self.assertTrue(flags & os.O_NOFOLLOW)
            claimed.append(name);return 10+len(claimed)
        def written(fd,raw):files[fd]=raw;writes.append(fd);return len(raw)
        with patch.object(os,'open',side_effect=opened),patch.object(os,'write',side_effect=written), \
             patch.object(os,'fsync',return_value=None),patch.object(os,'close',side_effect=closed.append), \
             patch.object(d.time,'time',return_value=2):
            result=scope['_seal_owned'](x)
            self.assertEqual(claimed,['floor-proven.json','validator-installed.json'])
            self.assertEqual(set(result[0]),{'status','floorCommit','deployedBinarySha256','provedAtWallMs'})
            self.assertEqual(set(result[1]),{'evidenceKind','deployedBinarySha256','installedAtWallMs'})
            self.assertEqual([json.loads(files[fd]) for fd in writes],list(result))
            previous=list(writes)
            with self.assertRaises(FileExistsError):scope['_seal_owned'](x)
            self.assertEqual(writes,previous)
        self.assertEqual(closed,[11,12,10,10])

    def test_full_procedure_default_rejects_before_deployment(self):
        x=object.__new__(d.FixedOriginalDriver);x._unknown=False
        with self.assertRaisesRegex(d.Unknown,'ORIGINAL_OWNER_SELECTOR_UNBOUND'):
            x.run()
        self.assertTrue(x._unknown)

    def test_private_deploy_actual_callsite_and_exact_request(self):
        from types import SimpleNamespace
        import json
        x=object.__new__(d.FixedOriginalDriver)
        x._unknown=False;x._canonical_fd=None;x._daemon_fd=8;x._operation_deadline=100
        x._binding=d._EntryBinding(*(['a'*64]*5))
        requests=[];launches=[];commands=[]
        x._continuity=lambda:None
        x._launch_phase=lambda phase:launches.append(phase)
        x._verify_installed=lambda:launches.append('validator_checked')
        receipt={'version':1,'operation_id':d.ID+'-deploy','unit':'scheduler-whole-main',
            'state':'COMPLETE','deployed_artifact_sha':'a'*64}
        raw=b"VERSION=1\nTEST_MODE=False\nSTATE_ROOT='/private/var/db/agent-deploy-system'\nGEN_ROOT='/usr/local/libexec/agent-core/.ds-generations'\n"
        scope={'__name__':'_confined_deployment','FixedOriginalDriver':d.FixedOriginalDriver,
            'QUALIFIED_DEPLOYMENT':d._DeploymentBinding('a'*64,'b'*64,'rollback-fixed'),
            '_DeploymentBinding':d._DeploymentBinding,'require':d.require,
            '_descriptor_bytes':lambda *a:raw,'_object':d._object,'DAEMON_SHA':d.DAEMON_SHA,'ID':d.ID}
        exec(compile(_deployment_source,'original-deployment.py','exec'),scope)
        original_exec=exec
        def source_cell(code, target):
            original_exec(code,target)
            target['mutation_lock']=lambda:12
            target['subprocess']=subprocess;target['time']=d.time
            target['health_check']=lambda:{'ok':True,'deliverReady':True}
            target['read_verified']=lambda path:(json.dumps(receipt).encode(),None)
            target['receipt_path']=lambda op:'fixed-private-receipt'
            def deploy(request):
                requests.append(request)
                target['mutation_lock']()
                target['restart_runtime'](wait_for_unload=True)
                return {'ok':True,'state':'COMPLETE','operation_id':d.ID+'-deploy'}
            target['deploy']=deploy
        scope['exec']=source_cell
        meta=SimpleNamespace(st_mode=0o100600,st_uid=0,st_dev=1,st_ino=2)
        def command(argv,**kwargs):
            commands.append(argv)
            return SimpleNamespace(returncode=113 if argv[1]=='print' else 0)
        with patch.object(os,'fstat',return_value=meta),patch.object(os,'dup',return_value=13), \
             patch.object(d.time,'monotonic',return_value=1),patch.object(subprocess,'run',side_effect=command):
            self.assertEqual(scope['_deploy_owned'](x),receipt)
        self.assertEqual(x._canonical_fd,13)
        self.assertEqual(launches,['validator_checked','deployment_start'])
        self.assertEqual(requests,[{'action':'DEPLOY','operation_id':d.ID+'-deploy',
            'unit':'scheduler-whole-main','artifact_tree_sha256':'a'*64,
            'expected_tree_sha256':'b'*64,'admitted_rollback_generation':'rollback-fixed'}])
        self.assertEqual(commands,[[ '/bin/launchctl',action,route] for route in
            ('gui/505/ai.agent-core.runtime','system/ai.agent-core.runtime') for action in ('bootout','print')])

    def test_actual_qualification_helper_rejects_wrong_nonce_without_hr_receipts(self):
        from types import SimpleNamespace
        import json
        value={'role':'original_executor_qualification','phase':'restart_a',
            'consumingBinarySha256':'a'*64,'validatorSha256':'c'*64,
            'entryManifestSha256':'e'*64,'procedureSha256':d.PROCEDURE_SHA,'startupNonce':'b'*64}
        raw=json.dumps(value,sort_keys=True,separators=(',',':')).encode()
        m=SimpleNamespace(st_mode=0o100600,st_uid=0,st_nlink=1,st_size=len(raw),
                          st_dev=1,st_ino=4,st_mtime_ns=3,st_ctime_ns=4)
        with patch.object(os,'fstat',return_value=m),patch.object(os,'pread',return_value=raw):
            fn=_helper['qualification_projection']
            self.assertEqual(fn(9,d.hashlib.sha256(raw).hexdigest(),{'nonce':'b'*64}),value)
            with self.assertRaises(_helper['Rejected']):fn(9,d.hashlib.sha256(raw).hexdigest(),{'nonce':'f'*64})

def tearDownModule():
    for g in reversed(_guards):g.stop()
    for g in reversed(_reporter):g.stop()
if __name__=='__main__': unittest.main()
