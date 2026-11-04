#!/usr/bin/env python3
"""Read exact Git archives in RAM; run source functions with memory-only seams.

No source extraction, product edits, service, sockets, DB, production data or
credentials. Child assertions are observation checks, not a conformance claim.
"""
import hashlib
import argparse
import io
import json
import re
import subprocess
import sys
import tarfile

REVISIONS = [
    "eb8fd18934d827cec98faacaef987869c5cb92e7",
    "fa4510beb6b01e5c40000a2ae36a62c526759e76",
]

NODE = r'''
import vm from 'node:vm';
import { posix } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const {files, rev, ledgerConstants, controlOnly, transportOnly} = JSON.parse(await new Promise(resolve => {
  let s=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', x=>s+=x); process.stdin.on('end',()=>resolve(s));
}));
const out = (id, value) => console.log(JSON.stringify({id,rev,...value}));
const context=vm.createContext({structuredClone,URL,URLSearchParams,AbortSignal,TextEncoder,TextDecoder,Buffer,
  setInterval:()=>{throw new Error('NO_TIMER_ALLOWED')},clearInterval:()=>{},console});
const modules=new Map();
function get(name) {
  if(modules.has(name))return modules.get(name);
  let m;
  if(name==='node:crypto')m=new vm.SyntheticModule(['createHash'],function(){this.setExport('createHash',createHash)},{context,identifier:name});
  else if(name==='croner')m=new vm.SyntheticModule(['Cron'],function(){this.setExport('Cron',class {constructor(){throw new Error('NO_CRON_EXECUTION_ALLOWED')}})},{context,identifier:name});
  else if(name==='packages/workflow-execution/src/ledger.js')m=new vm.SyntheticModule(Object.keys(ledgerConstants),function(){for(const [key,value] of Object.entries(ledgerConstants))this.setExport(key,value)},{context,identifier:name});
  else {
    assert.ok(Object.hasOwn(files,name),`missing archive dependency ${name}`);
    m=new vm.SourceTextModule(files[name],{context,identifier:name});
  }
  modules.set(name,m);return m;
}
const resolve=(specifier,parent)=>get(specifier.startsWith('.')?posix.normalize(posix.join(posix.dirname(parent.identifier),specifier)):specifier);
async function load(name){const m=get(name);if(m.status==='unlinked')await m.link(resolve);if(m.status==='linked')await m.evaluate();return m.namespace;}
async function checkTransportIdentity(){
  const bindingPath=Object.hasOwn(files,'packages/broker/src/transport/binding.js')?'packages/broker/src/transport/binding.js':'packages/broker/src/transport.js';
  const {createIdempotencyKey}=await load(bindingPath);
  const k1=createIdempotencyKey('workflow_execute',()=>1,()=> 'attempt1');
  const k2=createIdempotencyKey('workflow_execute',()=>2,()=> 'attempt2');
  assert.notEqual(k1,k2);out('OBS-G7-TRANSPORT-IDENTITY',{source:bindingPath,k1,k2,assertions:'PASS_DISTINCT_INVOCATION_KEYS',boundary:'generic transport invocation keys do not by themselves establish stable business-effect identity across attempts'});
}
if(transportOnly){await checkTransportIdentity();process.exit(0)}
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const due=Array.from({length:26},(_,i)=>({dispatchIntentId:id(100+i),nodeVisitId:id(200+i),workflowInstanceId:id(300+i),ownerPrincipalId:id(400+i),nextEligibleAt:'2026-11-04T00:00:00Z',createdAt:'2026-11-04T00:00:00Z',updatedAt:'2026-11-04T00:00:00Z'}));
const {createWorkflowExecutionEngine}=await load('packages/workflow-execution/src/engine.js');
out('HARNESS-LEDGER-CONSTANTS',{ledgerConstants,source:'literal exports parsed from this exact revision ledger.js; storage module not evaluated'});
const supportsPrePlanFailure=files['packages/workflow-execution/src/engine.js'].includes("attemptResult.cause === 'pre_plan_unavailable'");
const fairnessModes=controlOnly?['control']:[...(supportsPrePlanFailure?['pre_plan_unavailable']:[]),'throw','control'];
if(!controlOnly&&!supportsPrePlanFailure)out('HARNESS-UNSUPPORTED',{case:'pre_plan_unavailable',reason:'this revision has no matching result branch; synthetic return shape is not a valid path observation'});
for(const badMode of fairnessModes){
  const touched=[], logs=[];
  const ledger={listActiveFresh:async()=>[],listStaleCandidatesFresh:async()=>[],listRunEndedCandidatesFresh:async()=>[],
    beginAttemptIfAbsent:async intent=>{touched.push(intent.nodeVisitId);if(badMode==='control'||intent.nodeVisitId===id(225))return {created:false,cause:'already_attempted',attempt:{nodeVisitId:intent.nodeVisitId}};
      if(badMode==='throw')throw new Error('synthetic candidate-local dependency failure');return {created:false,cause:'pre_plan_unavailable'};}};
  const engine=createWorkflowExecutionEngine({ledger,fetchDuePage:async()=>({ok:true,items:due}),resolvePrincipalToAgent:async()=>{throw Error('unexpected resolve')},deliverRun:async()=>{throw Error('NO_DELIVERY_ALLOWED')},getTurnReconciliation:()=>undefined,readInstanceDetail:async()=>{throw Error('NO_READ_ALLOWED')},log:{warn:x=>logs.push(x),error:x=>logs.push(x)}});
  const rounds=[];
  for(let i=0;i<3;i++){const before=touched.length;const result=await engine.pollOnce();rounds.push({ok:result.ok,admissions:result.admissions.length,touched:touched.slice(before),tailSentinelReached:touched.slice(before).includes(id(225))});}
  if(badMode==='control'){assert.equal(touched.length,78);assert.ok(rounds.every(x=>x.tailSentinelReached&&x.admissions===26));}
  else{assert.equal(touched.length,75);assert.ok(rounds.every(x=>!x.tailSentinelReached&&x.admissions===25));}
  out('OBS-G6-FAIRNESS',{badMode,rounds,logs,assertions:badMode==='control'?'PASS_TAIL_REACHABLE_CONTROL':'PASS_COUNTEREXAMPLE_REPRODUCED',boundary:'real engine; ledger begin/candidate storage memory stub; tail is a discovery sentinel, not proof of actual successful admission; no real durable producer or restart'});
}
if(controlOnly)process.exit(0);
// Extract only the real wake function; imports/mount are not evaluated.
const runtimeName='packages/production-runtime/src/workflow-execution-runtime.js';
const runtime=files[runtimeName];
const start=runtime.indexOf('export async function wakeDomainOwnerAssistance(');
const end=runtime.indexOf('\nexport function mountWorkflowExecutionRuntime',start);
assert.ok(start>=0&&end>start,'wake extraction coordinates');
const wakeSource=runtime.slice(start,end).replace('export async function','async function');
const wake=vm.runInContext(wakeSource+'\nwakeDomainOwnerAssistance',context);
for(const state of ['pending','settled','absent','throw_unrecorded','throw_then_settled']){
  let sends=0, reads=0;
  const router={resolveCallerCorrelation:()=>{reads++;return state==='pending'?{state:'pending'}:state==='settled'?{state:'settled',outcome:{status:'failed'},error:'synthetic failed turn'}:state==='throw_then_settled'&&sends?{state:'settled',outcome:{status:'failed'}}:undefined},deliver:async()=>{sends++;if(state.startsWith('throw'))throw new Error('synthetic response loss');return {sessionId:'fixture-session'}}};
  const result=await wake({router,principalAccess:{handlers:{agent_resolve_principal:{resolve:async()=>({ok:true,result:{agentId:'fixture-owner'}})}}},pollerAgentId:'fixture-poller',workflowInstanceId:id(1),nodeVisitId:id(2),assistanceCaseId:id(3),ownerPrincipalId:id(4)});
  assert.equal(result.ok,state!=='throw_unrecorded');
  assert.equal(sends,['pending','settled'].includes(state)?0:1);
  out('OBS-G6-WAKE',{state,sends,reads,result:JSON.parse(JSON.stringify(result)),assertions:'PASS_OBSERVED_BRANCH',boundary:'memory Router/principal seams; delivery ack is not business obligation completion'});
}
// Pure-data manifest hub: an exact bounded inventory, without loading plugin I/O.
const manifestHub='packages/broker/src/capabilities/manifests.js';
if(Object.hasOwn(files,manifestHub)){
  const hub=await load(manifestHub);const found=new Map();
  for(const [exportName,value] of Object.entries(hub))for(const m of Array.isArray(value)?value:[value])if(m&&typeof m.id==='string'&&Array.isArray(m.operations))found.set(m.id,m);
  const rows=[];
  for(const m of found.values())for(const op of m.operations)rows.push({capabilityId:m.id,operation:op.name,method:op.http?.method??'LOCAL',target:op.http?.target??null,path:op.http?.path??null,transportKey:op.http?.idempotencyKey===true,
    boundedClass:op.http?.method==='GET'?'READ_ONLY':op.http?.idempotencyKey===true?'INVOCATION_KEY_PLUS_DOMAIN_READBACK_NOT_CROSS_ATTEMPT_PROOF':op.http?'NO_KEY_GENERIC_READBACK_OR_NONE_REQUIRES_PER_OPERATION_JOIN':'LOCAL_SEAM_SEPARATE_AUDIT'});
  rows.sort((a,b)=>(a.capabilityId+'.'+a.operation).localeCompare(b.capabilityId+'.'+b.operation));
  out('OBS-G7-INVENTORY',{scope:'all manifests exported by pure capabilities/manifests.js, includes optional moderator; excludes native shell/file/MCP/plugin-added tools and runtime enablement',capabilities:found.size,operations:rows.length,rows});
}
const guard='packages/broker/src/capabilities/workflow/owner-obligation-guard.js';
if(!Object.hasOwn(files,guard))out('OBS-G7-MANAGED',{status:'NOT_PRESENT_AT_REVISION',boundary:'do not transfer main capability to declared deployed commit'});
else{
  const {routeOwnerObligation}=await load(guard);
  const {workflowExecuteManifest}=await load('packages/broker/src/capabilities/workflow/execute.js');
  const {ownerOperationRegistry}=await load('packages/broker/src/capabilities/workflow/owner-operation-registry.js');
  const {canonicalJSON,sha256Hex}=await load('packages/fixed-operation/src/canonical.js');
  const descriptor=ownerOperationRegistry.find(x=>x.descriptor.key==='workflow.create_instance').descriptor;
  const business={workflowInstanceId:id(12),workflowStateVersion:1,admissionObservation:{status:'WAITING'}};
  const digest=sha256Hex(canonicalJSON(business));
  const args={domainId:id(11),definitionVersionId:id(6),contextPayload:{actual:true},metadata:{}};
  const baseRelation=()=>({version:1,managedKind:'INTAKE',workflowInstanceId:id(1),definitionVersionId:id(7),caseId:id(3),policyDigest:'a'.repeat(64),state:'ACTIVE',currentNode:{nodeVisitId:id(2),nodeDefinitionId:id(8),workflowStateVersion:9,operation:{slotKey:'supplier',allowedOperations:[descriptor],targetDefinitionVersionId:id(6),targetDefinitionDigest:'b'.repeat(64),effect:{state:'NOT_STARTED'}}}});
  const detail={assistanceCaseId:id(3),workflowInstanceId:id(4),nodeVisitId:id(5),currentNodeVisitId:id(5),workflowStateVersion:12,status:'OWNER_PENDING',governanceBinding:{assistanceCaseId:id(3),bindingId:id(9),status:'BOUND',source:{workflowInstanceId:id(4),nodeVisitId:id(5),definitionVersionId:id(10)},child:{workflowInstanceId:id(1),definitionVersionId:id(7)}}};
  const origin={kind:'workflow_execution',workflowInstanceId:id(1),nodeVisitId:id(2),attemptId:'wfeat-'+'a'.repeat(24)};
  async function callCase(label,{state='NOT_STARTED',attempt='a',changed=false,replyMismatch=false,loseReply=false}={}){
    const relation=baseRelation();
    if(state==='SUCCEEDED')relation.currentNode.operation.effect={effectId:id(13),state,commandId:id(14),result:business,resultDigest:digest,requestDigest:'c'.repeat(64)};
    else if(state!=='NOT_STARTED')relation.currentNode.operation.effect={state,effectId:id(13)};
    const calls=[];
    const result=await routeOwnerObligation({call:{capabilityId:'workflow_execute',operation:'create_instance',args:changed?{...args,contextPayload:{actual:false}}:args},manifest:workflowExecuteManifest,context:{agentId:'fixture-agent'},resolveWorkflowProvenance:()=>({...origin,attemptId:'wfeat-'+attempt.repeat(24)}),executeRead:async q=>({ok:true,result:q.capabilityId==='workflow_owner_obligation'?relation:detail}),transport:{execute:async q=>{calls.push(q);if(loseReply)return {errorCode:'transport_failure'};if(changed)return {errorCode:'idempotency_conflict'};return {effectId:id(13),state:'SUCCEEDED',commandId:replyMismatch?id(99):id(14),result:business,resultDigest:digest,replayed:state==='SUCCEEDED'};}}});
    const shouldOK=!changed&&!replyMismatch&&!loseReply&&['NOT_STARTED','SUCCEEDED'].includes(state);
    assert.equal(result?.ok,shouldOK,label);
    assert.equal(calls.length,['UNKNOWN','STARTED','PREPARED','REJECTED_ZERO_FACTS'].includes(state)?0:1,label);
    const body=calls[0]?.args; // transport receives projected args, no socket.
    out('OBS-G7-MANAGED',{label,state,attempt,requests:calls.length,result:JSON.parse(JSON.stringify(result)),request:body??null,assertions:'PASS_OBSERVED_BRANCH',boundary:'real Core guard/mapping; Svc effect/receipt response is a memory stub, not Rust DB success/atomicity evidence'});
  }
  await callCase('first_write');await callCase('first_response_lost',{loseReply:true});
  await callCase('next_attempt_reads_prior_success',{state:'SUCCEEDED',attempt:'b'});
  await callCase('body_conflict_service_rejection_preserved',{state:'SUCCEEDED',attempt:'b',changed:true});
  await callCase('original_receipt_mismatch_rejected',{state:'SUCCEEDED',attempt:'b',replyMismatch:true});
  for(const state of ['UNKNOWN','STARTED','PREPARED','REJECTED_ZERO_FACTS'])await callCase('nonterminal_or_rejected_effect_no_write',{state,attempt:'b'});
}
await checkTransportIdentity();
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--revision', choices=REVISIONS)
    parser.add_argument('--only-control', action='store_true')
    parser.add_argument('--only-transport', action='store_true')
    options = parser.parse_args()
    for revision in ([options.revision] if options.revision else REVISIONS):
        archive = subprocess.check_output(["git", "archive", revision])
        with tarfile.open(fileobj=io.BytesIO(archive)) as tree:
            files = {
                member.name: tree.extractfile(member).read().decode()
                for member in tree.getmembers()
                if member.isfile()
                and member.name.startswith("packages/")
                and member.name.endswith((".js", ".mjs"))
            }
        ledger_source=files['packages/workflow-execution/src/ledger.js']
        ledger_constants={}
        for key in ['DEFAULT_MAX_ATTEMPTS_PER_VISIT','STALE_NO_PROGRESS_JUDGMENT']:
            match=re.search(r'export const '+key+r'\s*=\s*([^\n;]+)',ledger_source)
            if not match:
                raise RuntimeError('Missing literal ledger export '+key)
            literal=match.group(1).strip()
            ledger_constants[key]=int(literal) if literal.isdigit() else literal.strip("'\"")
        print(json.dumps({"coordinate": revision, "archiveSha256": hashlib.sha256(archive).hexdigest(), "node": subprocess.check_output(["node", "--version"], text=True).strip(),"controlOnly":options.only_control,"transportOnly":options.only_transport}), flush=True)
        child = subprocess.run(
            ["node", "--experimental-vm-modules", "--input-type=module", "-e", NODE],
            input=json.dumps({"files": files, "rev": revision,"ledgerConstants":ledger_constants,"controlOnly":options.only_control,"transportOnly":options.only_transport}), text=True,
            capture_output=True,
        )
        print(child.stdout, end="", flush=True)
        print(child.stderr, end="", flush=True)
        print(json.dumps({"coordinate": revision, "nodeRc": child.returncode}), flush=True)
        if child.returncode:
            return child.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
