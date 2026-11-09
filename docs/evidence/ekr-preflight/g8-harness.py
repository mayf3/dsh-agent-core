#!/usr/bin/env python3
"""Exact git-archive Scheduler modules in VM; only in-memory injected storage.

No extracted source tree, filesystem ledger, actual Router, or service calls.
Cron construction is forbidden: this bounded execution covers every schedules.
"""
import hashlib
import io
import json
import subprocess
import sys
import tarfile

REFS = ["eb8fd18934d827cec98faacaef987869c5cb92e7", "fa4510beb6b01e5c40000a2ae36a62c526759e76"]

JS = r'''
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
let raw=''; process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw+=chunk;
const {revision,sources} = JSON.parse(raw);
const context = vm.createContext({ structuredClone, Date, Map, Set, Object, Number, String,
  JSON, Math, Promise, Error, TypeError, AbortController, setTimeout, clearTimeout,
  setInterval(){throw new Error('HARNESS_FORBIDS_INTERVAL')}, clearInterval,
  process:{pid:4242,env:{},stderr:{write(){throw new Error('HARNESS_FORBIDS_STDERR')}}} });
const cache = new Map();
function synthetic(id, exports) {
  return new vm.SyntheticModule(Object.keys(exports),function(){
    for(const [k,v] of Object.entries(exports))this.setExport(k,v);
  },{identifier:id,context});
}
function moduleFor(id) {
  if(cache.has(id))return cache.get(id);
  let m;
  if(id==='node:crypto')m=synthetic(id,crypto);
  else if(id==='node:os')m=synthetic(id,{userInfo(){throw new Error('HARNESS_FORBIDS_OS_IDENTITY')}});
  else if(id==='croner')m=synthetic(id,{Cron:class{constructor(){throw new Error('HARNESS_CRON_OUT_OF_SCOPE')}}});
  else {
    if(!(id in sources))throw new Error('HARNESS_MISSING_MODULE:'+id);
    m=new vm.SourceTextModule(sources[id],{identifier:id,context});
  }
  cache.set(id,m); return m;
}
const entry=moduleFor('packages/scheduler/src/scheduler.js');
await entry.link((specifier,parent)=>moduleFor(specifier.startsWith('.')?
  path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier)):specifier));
await entry.evaluate();
const {Scheduler}=entry.namespace;
const {normalizeJob}=cache.get('packages/scheduler/src/job-model.js').namespace;
const {buildOccurrenceRecord,applyTransition,rebuildFences,canTransition}=cache.get('packages/scheduler/src/occurrence-model.js').namespace;
const clone=(x)=>JSON.parse(JSON.stringify(x));
const logErrors=[];
function makeStore(initial){
 let doc=clone(initial),queue=Promise.resolve(),mutations=0;
 const events=[];
 return {
   events, getDoc:()=>clone(doc), getMutations:()=>mutations,
   async loadDoc(){await queue;return clone(doc)},
   async acquireEngineLease(){return {verify:async()=>true,release:async()=>{}}},
   async ensureUpgraded(){},
   async appendRunEvent(event){events.push(clone(event));return {ok:true}},
   async readRunEvents(){return clone(events)},
   mutateDoc(fn){
     const p=queue.then(async()=>{const latest=clone(doc);const result=await fn(latest);
       doc=latest;mutations++;return {doc:clone(doc),value:result?.value};});
     queue=p.then(()=>{},()=>{});return p;
   }
 };
}
let clock=10_000,calls=[];
const job=(id,enabled=true)=>normalizeJob({id,name:id,agentId:'agent-a',enabled,
 schedule:{kind:'every',everyMs:1000,anchorMs:1000},
 payload:{kind:'agentTurn',message:'in-memory fixture'},delivery:{mode:'none'},
 createdAtMs:1000,updatedAtMs:1000},{nowMs:1000,createdAtMs:1000});
const jobs=['was-admitted','was-running','was-succeeded','was-failed','was-unknown','normal'].map(id=>job(id,!['was-succeeded','was-failed'].includes(id)));
const records=jobs.slice(0,5).map(j=>buildOccurrenceRecord({job:j,kind:'natural',nominalScheduledAt:2000,admittedAt:2000,timeoutMs:3600000}));
applyTransition(records[1],{to:'running',at:2100,startedAt:2100,reason:'fixture start'});
applyTransition(records[2],{to:'running',at:2100,startedAt:2100,reason:'fixture start'});
applyTransition(records[2],{to:'succeeded',at:2200,endedAt:2200,reason:'fixture success'});
applyTransition(records[3],{to:'failed',at:2200,endedAt:2200,reason:'fixture pre-start rejection'});
applyTransition(records[4],{to:'outcome_unknown',at:2200,reason:'fixture unknown'});
const store=makeStore({version:3,jobs,occurrences:records,fences:rebuildFences(records)});
const invoker={assertRunnable:()=>true,async invokeAgent(req){calls.push({jobOccurrence:req.occurrenceId,requestId:req.idempotencyKey??req.requestId});req.onStart();return {status:'ok',summary:'fixture terminal success'}}};
const makeEngine=()=>new Scheduler({store,invoker,nowMs:()=>clock,log:{info(){},warn(){},error(s){logErrors.push(s)}}});
const engine=makeEngine();
await engine.start({autoStart:false,catchup:false});
const afterSweep=store.getDoc();
assert.deepEqual(afterSweep.occurrences.map(r=>r.state),['outcome_unknown','outcome_unknown','succeeded','failed','outcome_unknown']);
assert.deepEqual(Object.keys(afterSweep.fences).sort(),['was-admitted','was-running','was-unknown']);
assert.equal(calls.length,0);
assert.equal(canTransition('outcome_unknown','admitted'),false);
const fired=await engine.tick();await engine.whenIdle();await engine.load();
assert.equal(fired,1);assert.equal(calls.length,1);
assert.equal(store.getDoc().occurrences.find(r=>r.jobId==='normal').state,'succeeded');
await engine.tick();await engine.whenIdle();assert.equal(calls.length,1);
assert.equal(engine._classifyOutcome({}, {status:'error',error:'unknown failure'}).state,'outcome_unknown');
assert.equal(engine._classifyOutcome({}, {status:'error',started:false,error:'definite rejection'}).state,'failed');
assert.equal(engine._classifyOutcome({}, {status:'outcome_unknown',evidence:{terminationEvidence:'child_real_exit',source:'router_disposition_readback'}}).state,'outcome_unknown');
await engine.stop();await engine.tick();assert.equal(calls.length,1);
const engine2=makeEngine();await engine2.start({autoStart:false,catchup:false});
await engine2.tick();await engine2.whenIdle();await engine2.stop();
assert.equal(calls.length,1);
assert.equal(logErrors.length,0,JSON.stringify(logErrors));
console.log(JSON.stringify({revision,result:'PASS',scope:'real Scheduler modules + memory store; every only',
 restartSweepStates:afterSweep.occurrences.map(r=>({jobId:r.jobId,state:r.state})),
 retainedFences:Object.keys(afterSweep.fences).sort(),startupCalls:0,normalAdmissions:fired,
 totalRouterStubCalls:calls.length,secondEngineReplayCalls:0,unknownToAdmitted:false,
 unprovenFailure:'outcome_unknown',provenPreStartFailure:'failed',terminationProofBusinessState:'outcome_unknown',
 filesystemLedger:false,realProcessRestart:false,productionWrites:0,loadedModules:cache.size}));
'''


def main():
    for ref in REFS:
        archive = subprocess.run(["git", "archive", ref, "packages/scheduler/src"], capture_output=True, check=True).stdout
        with tarfile.open(fileobj=io.BytesIO(archive)) as tf:
            sources = {m.name: tf.extractfile(m).read().decode() for m in tf.getmembers() if m.isfile() and m.name.endswith(".js")}
        print(json.dumps({"revision": ref, "schedulerSha256": hashlib.sha256(sources["packages/scheduler/src/scheduler.js"].encode()).hexdigest()}), flush=True)
        wrapped = "(async()=>{" + JS + "})().catch(e=>{console.error(e.stack);process.exitCode=1})"
        run = subprocess.run(["node", "--experimental-vm-modules", "--no-warnings", "-e", wrapped], input=json.dumps({"revision":ref,"sources":sources}), text=True, capture_output=True)
        print(run.stdout, end="", flush=True)
        print(run.stderr, end="", flush=True)
        print(f"NODE_RC={run.returncode}", flush=True)
        if run.returncode:
            return run.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
