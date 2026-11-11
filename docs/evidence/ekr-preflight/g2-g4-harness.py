#!/usr/bin/env python3
"""EKR R3 G2-G4. Read exact Git archives; load only no-I/O source in data URLs.
All ledger mutation, Router, principal, detail and delivery seams are memory fixtures.
No file ledger, process crash, DB, network, production or live read is performed.
"""
import base64, hashlib, io, json, posixpath, re, subprocess, tarfile
REVISIONS = ['eb8fd18934d827cec98faacaef987869c5cb92e7', 'fa4510beb6b01e5c40000a2ae36a62c526759e76']
TEST = r'''
import assert from 'node:assert/strict';
const input=JSON.parse(process.env.EKR_G2_G4_INPUT);
const {createWorkflowExecutionEngine}=await import(input.engineURL);
const CandidateQuery=(new Function('return '+input.queryClass))();
const ids={nodeVisitId:'11111111-1111-1111-1111-111111111111',workflowInstanceId:'22222222-2222-2222-2222-222222222222',ownerPrincipalId:'33333333-3333-3333-3333-333333333333',dispatchIntentId:'44444444-4444-4444-4444-444444444444'};
const copy=x=>JSON.parse(JSON.stringify(x));
const base=()=>({...ids,attemptId:'original-attempt',generation:1,state:'ACTIVE',phase:'resolution_blocked',blockedCode:'dependency_unavailable',createdAtMs:1});
function fixture(initial,opts={}) {
 const state={attempt:copy(initial),events:[],deliveries:[],reads:0,resolutions:0,correlationReads:0,errors:[]};
 const ledger=new CandidateQuery(new Map([[ids.nodeVisitId,state.attempt]]));
 const record={
  resolutionBlocked:async code=>{state.events.push({kind:'resolution_blocked',code});state.attempt.phase='resolution_blocked'},
  recoveryRefused:async (authorityRef,reason)=>{state.events.push({kind:'recovery_refused',authorityRef,reason});Object.assign(state.attempt,{state:'NEEDS_REVIEW',phase:'recovery_refused'})},
  recoveryAuthorized:async authorityRef=>{state.events.push({kind:'recovery_authorized',authorityRef})},
  deliveryStarted:async ()=>{state.events.push({kind:'delivery_started'});state.attempt.phase='delivery_started'},
  deliveryFailed:async reason=>{state.events.push({kind:'delivery_failed',reason});Object.assign(state.attempt,{state:'NEEDS_REVIEW',phase:'delivery_failed'})},
  runDelivered:async delivered=>{state.events.push({kind:'run_delivered'});Object.assign(state.attempt,{phase:'run_delivered',delivered:{...delivered,atMs:1}})}
 };
 ledger.mutateWithRecord=async (_,fn)=>fn(record,()=>state.attempt);
 ledger.recordReconciled=async x=>{state.events.push({kind:'reconciled',judgment:x.judgment});Object.assign(state.attempt,{state:x.verdict,phase:'reconciled',judgment:x.judgment,reconciledAtMs:10});return {committed:true,attempt:state.attempt}};
 ledger.beginAttemptIfAbsent=async()=>({created:false,cause:'already_attempted',attempt:state.attempt});
 ledger.recordStaleSuperseded=async()=>{throw new Error('unexpected stale fixture mutation')};
 ledger.snapshot=()=>[copy(state.attempt)];
 const engine=createWorkflowExecutionEngine({ledger,fetchDuePage:async()=>({ok:true,items:[]}),
  resolvePrincipalToAgent:async()=>{state.resolutions++;return opts.resolve?.(state.resolutions)??{ok:true,agentId:'fixture-agent'}},
  deliverRun:async req=>{state.deliveries.push(copy(req));return {ok:true,sessionId:'fixture-session',reconciliationHandle:'fixture-handle'}},
  getTurnReconciliation:()=>({state:'settled'}),
  resolveCallerCorrelation:()=>{state.correlationReads++;return opts.correlation??{state:'never_existed'}},
  readInstanceDetail:async()=>{state.reads++;if(opts.read) return opts.read(state.reads);return {ok:true,body:{visibility:'full',detail:{current_node_visit_id:opts.moved?'55555555-5555-5555-5555-555555555555':ids.nodeVisitId,current_visit:{assignee_principal_id:opts.assignee??ids.ownerPrincipalId},instance:{is_terminal:false,workflow_state_version:8}}}}},
  buildInstruction:()=> 'fixture instruction',clock:()=>10000000,log:{error:x=>state.errors.push(x)},config:{staleNoProgressThresholdMs:1000,retryDelayMs:1000}});
 return {state,ledger,engine};
}
const emitted=[];
function emit(testName,faultInjection,initialState,expectedResult,actualResult) {
 const row={sourceSha:input.sourceSha,testName,faultInjection,initialState,expectedResult,actualResult,rawReceipt:'stdout JSON; source modules from git archive/data URL; ledger mutations and Router are in-memory fixtures; no real restart/DB/HTTP',nodeExitCode:0};
 emitted.push(row);console.log(JSON.stringify(row));
}
// B1: actual engine branches and actual ledger candidate query methods, before/after an in-memory reconstruction.
{
 const initial={...base(),phase:'run_delivered',delivered:{agentId:'fixture-agent',reconciliationHandle:'fixture-handle',atMs:1},workflowStateVersionAtDispatch:8};
 const first=fixture(initial,{read:()=>({ok:false,code:'http_503'})});
 const pass503=await first.engine.reconcileOnce();
 assert.equal(first.state.attempt.judgment,'settle_check_unavailable');assert.equal(first.state.attempt.state,'NEEDS_REVIEW');
 const reconstructed=fixture(copy(first.state.attempt));
 const passRecovered=await reconstructed.engine.pollOnce();
 const candidates={active:(await reconstructed.ledger.listActiveFresh()).length,stale:(await reconstructed.ledger.listStaleCandidatesFresh(1000)).length,runEnded:(await reconstructed.ledger.listRunEndedCandidatesFresh(1000)).length};
 assert.deepEqual(candidates,{active:0,stale:0,runEnded:0});assert.equal(reconstructed.state.reads,0);assert.equal(reconstructed.state.deliveries.length,0);
 const normal=fixture(initial,{moved:true});await normal.engine.reconcileOnce();assert.equal(normal.state.attempt.state,'SETTLED');
 emit('G2-B1-503-then-dependency-recovered-memory-reconstruction','detail seam http_503 once, then healthy detail and fresh engine/query instance',initial,'Observe current contract: unavailable becomes terminal NEEDS_REVIEW; later poll excludes it. #1374 automatic readback target is NOT met; no replay.',{pass503,after503:first.state.attempt,candidates,passRecovered,readsAfterRecovery:reconstructed.state.reads,deliveriesAfterRecovery:reconstructed.state.deliveries.length,normalMovedVisitState:normal.state.attempt.state});
}
// B2: no automatic recovery even when dependencies are healthy; explicit controlled call gates.
{
 const f=fixture(base());const polls=[];for(let n=0;n<3;n++) polls.push(await f.engine.pollOnce());
 assert.equal(f.state.reads,0);assert.equal(f.state.resolutions,0);assert.equal(f.state.deliveries.length,0);assert.equal(f.state.attempt.phase,'resolution_blocked');
 emit('G3-B2-healthy-dependency-three-polls-no-auto-recovery','start with resolution_blocked, dependencies already healthy',base(),'Current CTR-WAE-013 excludes automatic recovery; three poll passes leave blocked and mint no replacement request',{blockedCounts:polls.map(p=>p.reconciled.blocked),reads:f.state.reads,resolutions:f.state.resolutions,deliveries:f.state.deliveries.length,state:f.state.attempt});
 const cases=[
  ['missing-authority',{},undefined,'REFUSED_CALL'],
  ['pending-correlation',{correlation:{state:'pending'}},'fixture-authority','RECOVERY_INAPPLICABLE'],
  ['never-existed-with-handle',{correlation:{state:'never_existed',handle:'attributable'}},'fixture-authority','RECOVERY_INAPPLICABLE'],
  ['dependency-still-unavailable',{resolve:()=>({ok:false,code:'unavailable'})},'fixture-authority','STILL_BLOCKED:unavailable'],
  ['world-visit-moved',{moved:true},'fixture-authority','RECOVERY_REFUSED'],
  ['world-assignee-drift',{assignee:'66666666-6666-6666-6666-666666666666'},'fixture-authority','RECOVERY_REFUSED'],
  ['world-read-503',{read:()=>({ok:false,code:'http_503'})},'fixture-authority','RECOVERY_REFUSED'],
  ['identity-flaps-after-verification',{resolve:n=>n===1?{ok:true,agentId:'fixture-agent'}:{ok:false,code:'flap'}},'fixture-authority','STILL_BLOCKED:flap'],
  ['healthy-explicit-recovery',{},'fixture-authority','RECOVERED_RUN_ADMITTED']
 ];
 const results=[];
 for(const [name,opts,authorityRef,expected] of cases) {
  const c=fixture(base(),opts);const result=await c.engine.recoverAttempt({nodeVisitId:ids.nodeVisitId,authorityRef});
  assert.equal(result.outcome,expected,name);assert.equal(c.state.deliveries.length,name==='healthy-explicit-recovery'?1:0,name);
  if(name==='healthy-explicit-recovery') {assert.equal(c.state.deliveries[0].requestId,'original-attempt');assert.deepEqual(c.state.events.map(e=>e.kind),['recovery_authorized','delivery_started','run_delivered']);}
  results.push({name,result,events:c.state.events,deliveries:c.state.deliveries.map(d=>({requestId:d.requestId,messageOrigin:d.messageOrigin})),finalState:c.state.attempt.state,finalPhase:c.state.attempt.phase});
 }
 emit('G3-B2-explicit-recovery-authority-correlation-world-gates','controlled isolated calls across nine gate cases',base(),'Match original recovery source; only healthy explicitly authorized blocked attempt delivers once with original requestId',results);
}
// B3: pause actual engine admission at three seams; rebuild memory state and execute recovery/reconcile/poll.
for(const point of ['planned-before-delivery','delivery-entered','accepted-receipt-lost']) {
 let ready;const reached=new Promise(resolve=>ready=resolve);const events=[];let invocationCount=0;
 const initial={...base(),phase:'planned'};delete initial.blockedCode;
 const f=fixture(initial);
 f.ledger.beginAttemptIfAbsent=async(_,invoke)=>{
  events.push('attempt_planned');
  if(point==='planned-before-delivery') {ready(copy(f.state.attempt));return new Promise(()=>{});}
  return invoke(f.state.attempt,{recordDeliveryStarted:()=>{events.push('delivery_started');f.state.attempt.phase='delivery_started'}});
 };
 // A second real engine invokes the actual admission closure over this ledger.
 const admissionEngine=createWorkflowExecutionEngine({ledger:f.ledger,fetchDuePage:async()=>({ok:true,items:[]}),resolvePrincipalToAgent:async()=>({ok:true,agentId:'fixture-agent'}),deliverRun:async req=>{invocationCount++;events.push(point==='accepted-receipt-lost'?'router_accepted_no_receipt':'router_invoked_pending');ready(copy(f.state.attempt));return new Promise(()=>{})},getTurnReconciliation:()=>({state:'settled'}),resolveCallerCorrelation:()=>({state:point==='accepted-receipt-lost'?'settled':'never_existed'}),readInstanceDetail:async()=>({ok:true,body:{}}),buildInstruction:()=> 'fixture instruction',clock:()=>10000000});
 void admissionEngine.admitDueIntent(ids);
 const interrupted=await reached;
 const restarted=fixture(interrupted,{correlation:{state:point==='accepted-receipt-lost'?'settled':'never_existed'}});
 const explicitRecovery=await restarted.engine.recoverAttempt({nodeVisitId:ids.nodeVisitId,authorityRef:'fixture-authority'});
 assert.equal(explicitRecovery.outcome,'RECOVERY_INAPPLICABLE');
 const reconciled=await restarted.engine.reconcileOnce();await restarted.engine.pollOnce();
 assert.equal(restarted.state.attempt.judgment,'delivery_unverified');assert.equal(restarted.state.deliveries.length,0);assert.equal(restarted.state.correlationReads,0);
 emit('G4-B3-'+point,'pause actual admitDueIntent using unresolved in-memory seam; JSON snapshot reconstruction (not a process crash)',initial,'Current source must not auto-create a replacement request; ordinary planned is not controlled-recovery eligible; linkage loss becomes delivery_unverified. Safe readback/automatic continuation remains unproved.',{eventsBeforePause:events,invocationCountBeforePause:invocationCount,interrupted,explicitRecovery,reconciled,afterRestart:restarted.state.attempt,deliveriesAfterRestart:restarted.state.deliveries.length,correlationReadsAfterRestart:restarted.state.correlationReads});
}
console.log(JSON.stringify({sourceSha:input.sourceSha,summary:'G2-G4 current-source observation assertions completed',observations:emitted.length,nodeExitCode:0,moduleSha256:input.hashes,limitations:['no actual HTTP503','no real file ledger/fsync','no process crash/restart','no database/concurrency/cross-service test','M Owner-resume planned special path not exercised']}));
'''
for rev in REVISIONS:
    data = subprocess.check_output(['git', 'archive', rev])
    archive = tarfile.open(fileobj=io.BytesIO(data))
    paths = set(archive.getnames())
    sources = {}
    def source(path):
        if path not in sources:
            sources[path] = archive.extractfile(path).read().decode()
        return sources[path]
    ledger_source = source('packages/workflow-execution/src/ledger.js')
    constants = []
    for name in ['STALE_NO_PROGRESS_JUDGMENT', 'DEFAULT_MAX_ATTEMPTS_PER_VISIT']:
        match = re.search(r'export const '+name+r' = ([^\n]+)', ledger_source)
        assert match, 'ledger constant not located: '+name
        constants.append('export const '+name+' = '+match.group(1))
    virtual_ledger = '\n'.join(constants)
    urls = {}
    def module_url(path):
        if path in urls:
            return urls[path]
        original = virtual_ledger if path.endswith('/ledger.js') else source(path)
        def replace(match):
            dependency = posixpath.normpath(posixpath.join(posixpath.dirname(path), match.group(2)))
            return 'import '+match.group(1)+' from '+json.dumps(module_url(dependency))
        rewritten = re.sub(r"import (\{[^\n]+\}) from ['\"]([^'\"]+)['\"]", replace, original)
        urls[path] = 'data:text/javascript;base64,'+base64.b64encode(rewritten.encode()).decode()
        return urls[path]
    methods=[]
    for name in ['listActiveFresh','listStaleCandidatesFresh','listRunEndedCandidatesFresh']:
        match=re.search(r'  async '+name+r'\([^\n]*\) \{\n.*?\n  \}',ledger_source,re.S)
        assert match, 'candidate method not located: '+name
        methods.append(match.group(0))
    query_class='class CandidateQuery { constructor(attempts){this.attempts=attempts;this.clock=()=>10000000;} async mutate(fn){return fn();}\n'+'\n'.join(methods)+'\n}'
    engine_url=module_url('packages/workflow-execution/src/engine.js')
    payload={'sourceSha':rev,'engineURL':engine_url,'queryClass':query_class,'hashes':{p:hashlib.sha256(s.encode()).hexdigest() for p,s in sources.items()},'virtualLedgerExports':virtual_ledger}
    # Pass JSON on stdin by prefix rather than environment (nested data URLs can exceed env limits).
    program=TEST.replace('JSON.parse(process.env.EKR_G2_G4_INPUT)',json.dumps(payload))
    child=subprocess.run(['node','--input-type=module'],input=program,text=True,capture_output=True)
    print('REV',rev,'RC',child.returncode,flush=True)
    print(child.stdout,end='',flush=True)
    if child.stderr: print(child.stderr,end='',flush=True)
    if child.returncode: raise SystemExit(child.returncode)
