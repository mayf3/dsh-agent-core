import copy
import unittest
from unittest.mock import patch
import first_live_operator as op
from bind_records import _canonical as raw
from first_live_io import digest


def fixture(packet=None, issued=100):
    # Deliberately synthetic public records, never written to a package or root.
    packet=packet or {'version':1,'operation_id':op.OPERATION,'host':'a'*64,'source_sha':'b'*40,
            'review_sha256':'c'*64,'controller_sha256':'d'*64,'owner_acceptance_digest':'e'*64}
    g=op.grant(raw(packet),issued)
    core=dict(version=1,operation_id=op.OPERATION,packet_sha256=digest(raw(packet)),
        grant_sha256=digest(raw(g)),lifecycle_digest='1'*64,host_safety_receipt_digest='2'*64,
        custody_completion_digest='3'*64,reviewer_login_receipt_digest='4'*64,
        standing_receipt_digest='5'*64,state='STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED')
    service=raw({'fixture':'public service'});activation=raw({'fixture':'public activation'})
    binding=dict(operation_id=op.OPERATION,package_digest=digest(raw(packet)),grant_digest=digest(raw(g)),
        controller_digest=packet['controller_sha256'],core_digest=digest(raw(core)),
        configuration_digest=digest(service),activation_digest=digest(activation),
        standing_digest=core['standing_receipt_digest'],plist_before_digest=op.layout.OLD_PLIST,
        plist_after_digest=op.layout.NEW_PLIST,expires_at=g['expires_at'])
    process=dict(pid=1234,uid=0,gid=0,executable=op.CONTROLLER,
        started_seconds=100,started_micros=123)
    intent=dict(binding=binding,process=process)
    rb=dict(startup_intent_digest=digest(raw(intent)),binding=binding,process=process,socket_device=1,socket_inode=2)
    admission=dict(binding=binding,readback_digest=digest(raw(rb)))
    ready=dict(admission_digest=digest(raw(admission)),readback=rb)
    complete=dict(binding=binding,readback_digest=digest(raw(rb)),ready_digest=digest(raw(ready)))
    records={'result.json':raw(core),'enable-intent.json':raw(binding),
        'daemon-readback.json':raw(rb),'enable-admission.json':raw(admission),
        'daemon-ready.json':raw(ready),'enable-result.json':raw(complete),'daemon-startup-intent.json':raw(intent),
        'service.json':service,'daemon-activation.json':activation}
    return packet,g,records


class Bindings(unittest.TestCase):
    def test_plist_binding_requires_actual_reviewed_disabled_and_enabled_bytes(self):
        p,g,r=fixture()
        r['enable-intent.json']=raw({**op._object(r['enable-intent.json'],10000),'plist_after_digest':'7'*64})
        with self.assertRaises((ValueError,RuntimeError)):
            op.completed(r,g,raw(p))

    def test_completion_is_current_closure_and_must_match_this_submission(self):
        p,g,r=fixture();b=op.completed(r,g,raw(p))
        producer={'unit_id':'8'*64,'attempt':1,'target_generation':2,'service_generation':'9'*64,'goal_receipt_digest':'a'*64}
        result=dict(version=1,state='COMPLETE',reason=None,operation_id=op.OPERATION,
            package_digest=b['package_digest'],controller_digest=b['controller_digest'],
            configuration_digest=b['configuration_digest'],activation_digest=b['activation_digest'],
            enable_result_digest=digest(r['enable-result.json']),goal_id=op.GOAL,source_sha=op.SOURCE,
            artifact_sha256=op.ARTIFACT,target_runtime='dsh-system-runtime',deployment_profile='dsh-app',
            business_goal_complete=False,evidence={**producer,'installation_binding_digest':'b'*64,
                'native_observation_digest':'c'*64,'registry_ledger_digest':'d'*64,'registry_revision':5,
                'closure_digest':'e'*64,'registry_row_revision':3,'outbox_id':'f'*64,'delivered':True})
        self.assertEqual(op.final_observation(raw(result),producer,b,r),'COMPLETE')
        for key,value in [('delivered',False),('unit_id','f'*64),('goal_receipt_digest','f'*64)]:
            bad=copy.deepcopy(result);bad['evidence'][key]=value
            with self.assertRaises((ValueError,RuntimeError)):op.final_observation(raw(bad),producer,b,r)
        result.update(state='PENDING',reason='CLOSURE_NOT_DELIVERED',evidence=None)
        self.assertEqual(op.final_observation(raw(result),producer,b,r),'PENDING')


    def test_grant_is_exact_input_binding_with_finite_no_future_success(self):
        p,g,_=fixture()
        self.assertEqual(g['packet_sha256'],digest(raw(p)))
        self.assertEqual((g['issued_at'],g['expires_at']),(100,14500))
        self.assertTrue(g['temporary_supply_hold'])
        self.assertFalse(any('receipt' in k or 'pass' in k for k in g))
        for bad in [True,0,-1,1.5]:
            with self.assertRaises((ValueError,RuntimeError)):
                op.grant(raw(p),bad)
        p['operation_id']='changed'
        with self.assertRaises((ValueError,RuntimeError)):
            op.grant(raw(p),100)

    def test_complete_actual_record_bytes_join_all_bound_surfaces(self):
        p,g,r=fixture()
        result=op.completed(r,g,raw(p))
        self.assertEqual(result['core_digest'],digest(r['result.json']))
        self.assertEqual(result['controller_digest'],p['controller_sha256'])
        for name in ['service.json','daemon-activation.json','result.json','daemon-ready.json']:
            bad=copy.deepcopy(r);bad[name]=raw({'changed':'private fixture'})
            with self.assertRaises((ValueError,RuntimeError,KeyError)):
                op.completed(bad,g,raw(p))

    def test_public_shape_or_old_success_cannot_stand_in_for_exact_enable(self):
        p,g,r=fixture()
        for name in list(r):
            bad=dict(r);del bad[name]
            with self.assertRaises((ValueError,RuntimeError,KeyError)):
                op.completed(bad,g,raw(p))
        other=dict(g);other['expires_at']+=1
        with self.assertRaises((ValueError,RuntimeError,KeyError)):
            op.completed(r,other,raw(p))


class OperationStops(unittest.TestCase):
    def test_fixed_controller_disabled_semantics_fail_closed(self):
        class IO:
            def __init__(self, disabled): self.disabled = disabled
            def metadata(self, path, absent=False):
                if absent: return None
                return {'inode': 1}
            def call(self, argv, **kwargs):
                if argv == ['/bin/launchctl', 'print', op.layout.LABEL]: return None
                if argv == ['/bin/launchctl', 'print-disabled', 'system']: return self.disabled
                if argv == ['/usr/bin/shasum', '-a', '256', '/usr/bin/sudo']:
                    return b'f' * 64 + b'  /usr/bin/sudo\n'
                raise AssertionError(argv)
        def gate(value):
            with patch.object(op.layout, 'directories', return_value={}), patch.object(
                    op.layout, 'prefix_files', return_value={}), patch.object(
                    op.layout, 'absent_paths', return_value=[]):
                op.prefix_gate(IO(value), {})
        for accepted in (b'"ai.agent-deployd" => true\n', b'"ai.agent-deployd" => disabled\n'):
            with self.subTest(accepted=accepted): gate(accepted)
        rejected = (
            b'"ai.agent-deployd" => false\n', b'"ai.agent-deployd" => enabled\n', b'',
            b'"ai.agent-deployd" => true\n"ai.agent-deployd" => true\n',
            b'"ai.agent-deployd" => true\n"ai.agent-deployd" => disabled\n',
            b'"ai.agent-deployd" => unknown\n',
        )
        for value in rejected:
            with self.subTest(rejected=value), self.assertRaisesRegex(RuntimeError, 'CONTROLLER_NOT_DISABLED'):
                gate(value)

    def test_prefix_gate_streams_only_fixed_codex_and_materializes_small_preimages(self):
        codex=op.layout.CODE+'/codex';small=op.layout.CODE+'/agent-deployd'
        specs={codex:{'sha256':'a'*64,'size':220584000},small:{'sha256':'b'*64}}
        class IO:
            def __init__(self):self.streamed=[];self.read=[]
            def stream_hash_fixed_codex(self,path,spec):self.streamed.append((path,spec))
            def expect(self,path,spec):self.read.append(path);return {'inode':1}
            def metadata(self,path,absent=False):
                if absent:return None
                return {'inode':1}
            def call(self,argv,**kwargs):
                if argv==['/bin/launchctl','print',op.layout.LABEL]:return None
                if argv==['/bin/launchctl','print-disabled','system']:
                    return b'"ai.agent-deployd" => true\n'
                if argv==['/usr/bin/shasum','-a','256','/usr/bin/sudo']:
                    return b'f'*64+b'  /usr/bin/sudo\n'
                self.read.append(argv[-1]);return b'small bytes'
        io=IO()
        with patch.object(op.layout,'directories',return_value={}),patch.object(
                op.layout,'prefix_files',return_value=specs),patch.object(
                op.layout,'absent_paths',return_value=[]):
            old,_=op.prefix_gate(io,{})
        self.assertEqual(io.streamed,[(codex,specs[codex])])
        self.assertEqual(old,{small:b'small bytes'})
        self.assertNotIn(codex,io.read)

    def test_no_deployment_handoff_without_full_remaining_window(self):
        p,g,_=fixture();p['review_helper_sha256']='8'*64
        p['configuration']={'catalog':{'profiles':{'dsh-app':{'revision':'dsh-app-v1'}}}}
        m={'files':{'agent-deployctl':{'sha256':'9'*64}}}
        good=op.handoff(p,g,m,100)
        self.assertEqual((good['mode'],good['existing']),('submit',None))
        self.assertEqual((good['artifact_sha256'],good['manifest_sha256']),(op.ARTIFACT,op.ARTIFACT))
        for now in [99,12700,14500]:
            with self.assertRaises(RuntimeError):op.handoff(p,g,m,now)

    def test_protected_byte_or_identity_drift_never_becomes_readback(self):
        class IO:
            def expect(self,path,spec):return {'inode':1}
            def call(self,args,**kw):return b'public readback'
            def metadata(self,path):return {'inode':2}
        with self.assertRaisesRegex(RuntimeError,'PROTECTED_READ_CHANGED'):
            op.protected_read(IO(),'/fixed/public',{})

    def test_wrong_preimage_stops_before_any_install_or_native_call(self):
        class IO:
            def __init__(self):self.calls=[]
            def metadata(self,path,absent=False):return dict(type='Directory',uid=0,gid=1 if path=='/private/var/run' else 0,
                mode=int(op.layout.directories()[path] or '0755',8),flags=0)
            def expect(self,path,spec):raise RuntimeError('PROTECTED_DIGEST')
            def call(self,args,**kw):self.calls.append(args);raise AssertionError('not reachable')
        p,_,_=fixture();p['previous']={k:'a'*64 for k in ['installation_receipt_sha256','service_sha256',
            'trust_sha256','issuer_policy_sha256','registry_sha256']}
        io=IO()
        with self.assertRaisesRegex(RuntimeError,'PROTECTED_DIGEST'):op.prefix_gate(io,p)
        self.assertEqual(io.calls,[])


class PhaseCuts(unittest.TestCase):
    # The transport is deliberately a private effects model. Real fd0, command
    # boundaries and no-write native fixtures live in their own test suites.
    def run_case(self,cut=None,corrupt=False,pending=False):
        from pathlib import Path
        import first_live_io
        scope=b'{"state":"PROSPECTIVE_NOT_ACCEPTED","fixture":true}'
        p,_,_=fixture();p['owner_acceptance_digest']=digest(scope)
        p.update(review_helper_sha256=digest(b'issuer'),previous={},issuer_bindings=[
            {'public_key':None,'custody_receipt':None} for _ in range(6)],
            lifecycle={'tool_sha256':{}},configuration={'catalog':{'profiles':{'dsh-app':{'revision':'dsh-app-v1'}}}})
        spec={'sha256':'a'*64,'uid':0,'gid':0,'mode':'0555','nlink':1,'flags':0}
        reconciliation={'installed_files':{n:spec for n in ['agent-deployd','agent-deploy-issuer','agent-deployctl']},
            'socket_directory':{'device':1,'inode':2,'uid':0,'gid':602,'mode':0o750,'flags':0},
            'staging_files':{'original-agent-deployd':spec,'original-agent-deploy-issuer':spec}}
        blobs={'packet-template.json':raw(p),'owner-scope.json':scope,'agent-deployctl':b'ctl',
            'agent-deployd':b'controller','agent-deploy-issuer':b'issuer',
            'p4r12-successor-reconciliation.json':raw(reconciliation)}
        p['controller_sha256']=digest(blobs['agent-deployd']);blobs['packet-template.json']=raw(p)
        m=dict(version=1,operation_id=op.OPERATION,source_sha=p['source_sha'],controller_sha256=p['controller_sha256'],
            files={k:{'sha256':digest(v),'size':len(v)} for k,v in blobs.items()},root_argv_allowlist=[],
            ordinary_argv_allowlist=[['/usr/bin/python3','-I','-S','-B','/private-fixture/first_live_launcher.py','--broker-exact']])
        class IO:
            def __init__(self):
                self.events=[]
                self.copied={}
                self.saved={}
                self.time=100
                self.auth=0
            def local_validate(self):self.events.append('validated')
            def claim(self):self.events.append('claim')
            def phase(self,name):
                self.events.append(name)
                if name==cut:raise RuntimeError('INJECTED_CUT')
            def authenticate(self):self.auth+=1
            def now(self):return self.time
            def record(self,name,v):self.saved[name]=v
            def copy(self,b,h,mode,dest,gid=0):
                self.asserted_hash=(digest(b)==h)
                if not self.asserted_hash:raise AssertionError('hash')
                self.copied[dest]=b
            def expect(self,path,spec):return {}
            def metadata(self,path,absent=False):
                if absent:return None
                return dict(type='Socket' if path.endswith('.sock') else 'Directory',uid=0,
                    gid=602 if path.endswith('.sock') else 0,mode=0o660 if path.endswith('.sock') else 0o750,flags=0)
            def records(self):
                packet=op._object(self.copied[op.layout.PACKET+'/packet.json'],100000)
                _,g,r=fixture(packet,self.time)
                self.binding=op.completed(r,g,raw(packet));self.records_value=r
                if corrupt:r['daemon-ready.json']=b'{}'
                return r
            def call(self,argv,root=True,visible=False,**kwargs):
                self.events.append(tuple(argv))
                if not root:
                    h=op._object(self.copied[op.layout.HANDOFF],10000)
                    self.producer=dict(state='BROKER_DELIVERY_RECEIPTS_OBSERVED',operation_id=op.OPERATION,
                        goal_id=op.GOAL,source_sha=op.SOURCE,handoff_sha256=digest(raw(h)),business_goal_complete=False,
                        unit_id='1'*64,attempt=1,target_generation=2,service_generation='2'*64,goal_receipt_digest='3'*64)
                    return raw(self.producer)
                if argv==[op.CONTROLLER,'--first-live-completion']:
                    e={k:self.producer[k] for k in ['unit_id','attempt','target_generation','service_generation','goal_receipt_digest']}
                    e.update(installation_binding_digest='4'*64,native_observation_digest='5'*64,
                        registry_ledger_digest='6'*64,registry_revision=6,registry_row_revision=3,
                        closure_digest='7'*64,outbox_id='8'*64,delivered=True)
                    v={k:self.binding[k] for k in ['operation_id','package_digest','controller_digest','configuration_digest','activation_digest']}
                    v.update(version=1,state='PENDING' if pending else 'COMPLETE',reason='QUEUE_ACK_PENDING' if pending else None,
                        enable_result_digest=digest(self.records_value['enable-result.json']),goal_id=op.GOAL,source_sha=op.SOURCE,
                        artifact_sha256=op.ARTIFACT,target_runtime='dsh-system-runtime',deployment_profile='dsh-app',
                        business_goal_complete=False,evidence=None if pending else e)
                    return raw(v)
                return b''
        io=IO()
        def load(path,h):
            value=blobs[Path(path).name]
            if digest(value)!=h:raise RuntimeError('BAD_FIXTURE_HASH')
            return value
        with patch.object(first_live_io,'read_local',side_effect=load),patch.object(op.layout,'inputs',return_value={}),\
             patch.object(op.layout,'commands',return_value=[]),patch.object(op.layout,'copies',return_value={}),\
             patch.object(op,'prefix_gate',return_value=({op.layout.CODE+'/agent-deployd':b'old',
                 op.layout.CODE+'/agent-deploy-issuer':b'old issuer'},b'f'*64+b'  /usr/bin/sudo\n')),\
             patch.object(op,'protected_read',side_effect=lambda _io,path,_spec: b'old issuer' if path.endswith('agent-deploy-issuer') else b'old'),\
             patch.object(op,'prepare_socket',side_effect=lambda _io,_p,_existing:io.events.append('socket-prepared')),\
             patch.object(op,'enabled_records',side_effect=lambda _:io.records()),\
             patch('p4r12_reconcile.reconcile',side_effect=lambda _io,_raw:io.events.append('p4r12-reconciled')):
            try:result=op.execute(io,m,Path('/private-fixture'))
            except RuntimeError:result=None
        return io,result

    def test_phase_cuts_keep_attempt_consumed_and_never_reach_later_effect(self):
        phases=['p4r12-reconciliation','protected-prefix','protected-copy','native-first-live-enable','enabled-readback',
                'ordinary-broker-delivery','current-closure-readback']
        for i,cut in enumerate(phases):
            with self.subTest(cut=cut):
                io,result=self.run_case(cut=cut)
                self.assertIsNone(result);self.assertIn('claim',io.events)
                self.assertTrue(io.saved['operator-error.json']['retry_forbidden'])
                self.assertFalse(any(p in io.events for p in phases[i+1:]))

    def test_partial_enable_cannot_publish_handoff_or_dispatch_broker(self):
        io,result=self.run_case(corrupt=True)
        self.assertIsNone(result);self.assertNotIn(op.layout.HANDOFF,io.copied)
        self.assertNotIn('ordinary-broker-delivery',io.events)

    def test_complete_and_pending_closure_remain_distinct_after_real_record_joins(self):
        for pending in [False,True]:
            io,result=self.run_case(pending=pending)
            self.assertEqual(result['state'],'FIRST_AUTOMATIC_DELIVERY_'+('PENDING' if pending else 'COMPLETE'))
            self.assertFalse(result['parent_goal_complete']);self.assertEqual(io.auth,3)
            self.assertLess(io.events.index('socket-prepared'),io.events.index((op.CONTROLLER,'--first-live-and-enable')))
            self.assertEqual(sum(e==(op.CONTROLLER,'--first-live-and-enable') for e in io.events),1)
            self.assertEqual(sum(e==(op.CONTROLLER,'--first-live-completion') for e in io.events),1)


class SocketNamespace(unittest.TestCase):
    def io(self,existing=False,replaced=False):
        class IO:
            def __init__(self):self.calls=[];self.created=False;self.normalized=False
            def metadata(self,path,absent=False):
                if path=='/private/var/run':return dict(type='Directory',uid=0,gid=1,mode=0o775,flags=0,device=1,inode=2)
                if not self.created:return {'type':'Directory'} if existing else None
                return dict(type='Directory',uid=0,gid=602 if self.normalized else 1,
                    mode=0o750 if self.normalized else 0o700,flags=0,device=1,inode=4 if replaced and self.normalized else 3)
            def call(self,argv):
                self.calls.append(argv)
                if argv[0]=='/bin/mkdir':self.created=True
                elif argv[0]=='/usr/bin/install':self.normalized=True
                return b''
        return IO()

    def test_exact_new_namespace_exists_with_required_gid_before_native_entry(self):
        io=self.io();p={'configuration':{'socket_ancestor':{'uid':0,'gid':1,'mode':0o775,'flags':0,'device':1,'inode':2}}}
        op.prepare_socket(io,p)
        self.assertEqual(io.metadata(op.layout.SOCKET)['gid'],602)
        self.assertEqual(io.calls[0],['/bin/mkdir','-m','0700',op.layout.SOCKET])
        self.assertEqual([a for a in io.calls if a[0]=='/usr/bin/install'],[
            ['/usr/bin/install','-d','-o','root','-g','602','-m','0750',op.layout.SOCKET]])

    def test_existing_or_replaced_namespace_is_not_repaired_or_accepted(self):
        p={'configuration':{'socket_ancestor':{'uid':0,'gid':1,'mode':0o775,'flags':0,'device':1,'inode':2}}}
        io=self.io(existing=True)
        with self.assertRaises(RuntimeError):op.prepare_socket(io,p)
        self.assertEqual(io.calls,[])
        io=self.io(replaced=True)
        with self.assertRaises(RuntimeError):op.prepare_socket(io,p)


if __name__=='__main__':unittest.main()
