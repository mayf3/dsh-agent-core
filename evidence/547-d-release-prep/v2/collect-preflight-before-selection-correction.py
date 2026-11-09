#!/usr/bin/env python3
"""Read-only fixed-object scope audit; outputs evidence only beside this file.
Does not assemble, install, open business stores, or execute candidate code.
"""
import hashlib, json, os, re, subprocess
from datetime import datetime, timezone
from pathlib import Path
OUT=Path(__file__).resolve().parent
REPO=Path('/Users/yanfenma/workspace/project/production-dsh-agent-core')
BASE='393a0afccedc5cce7be8b492c82d68d8d52206f6'
SOURCE='95a8e1cb512fc99dc018209d837250dd51b4d08f'
LINEAGE='42487e65b36f049811b0e83f90178510a3da28b7'
OVERLAY='08102a550cf2f5e14646c6858786d7fe7a50c61d'
QA='5360707882b4f85813d842037f660f54fd2496c8'
LIVE=Path('/usr/local/libexec/agent-core/app')
BACKUP=Path('/Users/Shared/r129d-rollback-20261108')
ENV={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_NO_LAZY_FETCH':'1'}
def git(*args,repo=REPO):
 return subprocess.check_output(['git','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',str(repo),*args],env=ENV)
def sha(b): return hashlib.sha256(b).hexdigest()
def save(name,obj):
 b=(json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode();(OUT/name).write_bytes(b);return sha(b)
def blobs(ids):
 ids=list(dict.fromkeys(ids));data=git('cat-file','--batch',) if not ids else subprocess.check_output(['git','-C',str(REPO),'cat-file','--batch'],input=('\n'.join(ids)+'\n').encode(),env=ENV)
 result={};pos=0
 for oid in ids:
  end=data.index(b'\n',pos);header=data[pos:end].decode().split();size=int(header[2]);pos=end+1;result[oid]=data[pos:pos+size];pos+=size+1
 return result
def surface(rev):
 entries={}
 for raw in git('ls-tree','-rz','--full-tree',rev).split(b'\0'):
  if not raw: continue
  meta,name=raw.split(b'\t',1);mode,kind,oid=meta.decode().split();entries[name.decode()]={'mode':mode,'kind':kind,'git_blob':oid}
 package_paths=[p for p in entries if re.fullmatch(r'packages/[^/]+/package.json',p)]
 metadata=blobs([entries[p]['git_blob'] for p in package_paths])
 selected={'package.json','scripts/lib/trusted-source-git-stamp.sh'}
 installer=git('show',rev+':scripts/trusted-cp-deploy-install.sh').decode()
 whitelist=re.search(r'^APP_SCRIPTS_WHITELIST="([^"]+)"',installer,re.M).group(1).split()
 selected.update('scripts/'+name for name in whitelist if 'scripts/'+name in entries)
 for p in package_paths:
  root=p.rsplit('/',1)[0];selected.add(p);selected.update(q for q in entries if q.startswith(root+'/src/'))
  manifest=json.loads(metadata[entries[p]['git_blob']]);declared=[]
  def walk(x):
   if isinstance(x,str): declared.append(x)
   elif isinstance(x,list):
    for v in x: walk(v)
   elif isinstance(x,dict):
    for v in x.values(): walk(v)
  walk(manifest.get('main'));walk(manifest.get('exports'))
  for target in declared:
   rel=target.removeprefix('./')
   if '*' in rel or rel=='package.json' or rel.startswith('src/'): continue
   if rel.startswith('/') or '..' in rel.split('/'): raise ValueError('unsafe metadata '+p+':'+target)
   if root+'/'+rel not in entries: raise ValueError('missing metadata target '+p+':'+target)
   selected.add(root+'/'+rel)
 selected.update(q for q in entries if q.startswith('packages/development-execution/src/'))
 selected.update(q for q in entries if re.fullmatch(r'(?:bundle|profile)-[^/]+/(?:package.json|cordis.patch.yml)',q))
 selected={p for p in selected if p in entries}
 data=blobs([entries[p]['git_blob'] for p in sorted(selected)])
 return {p:{**entries[p],'bytes':len(data[entries[p]['git_blob']]),'sha256':sha(data[entries[p]['git_blob']])} for p in sorted(selected)}
started=datetime.now(timezone.utc).isoformat()
path_inputs=[Path.cwd()/'BRIEF-547-D-RELEASE-PREP.md',LIVE/'pack-provenance.json',REPO,Path('/usr/local/libexec/agent-core/node-runtime/bin/node'),BACKUP/'DEPLOY-RECEIPT.md']
save('path-selfcheck.json',{'observed_at':started,'paths':[{'path':str(p),'exists':p.exists()} for p in path_inputs]})
assert all(p.exists() for p in path_inputs)
for rev in [BASE,SOURCE,LINEAGE,OVERLAY]: git('cat-file','-e',rev+'^{commit}')
git('cat-file','-e',QA+'^{commit}',repo=Path.cwd())
base,sourced=surface(BASE),surface(SOURCE)
save('base-selected-source-manifest.json',{'commit':BASE,'scope':'official app source selection only; dependencies and artifact not assembled','files':base})
save('requested-selected-source-manifest.json',{'commit':SOURCE,'scope':'official app source selection only; dependencies and artifact not assembled','files':sourced})
delta=[]
for p in sorted(set(base)|set(sourced)):
 a,b=base.get(p),sourced.get(p)
 if a!=b: delta.append({'path':p,'change':'added' if a is None else 'deleted' if b is None else 'modified','base':a,'requested_source':b})
lineage_paths=git('diff-tree','--no-commit-id','--name-only','-r',LINEAGE).decode().splitlines()
runtime_lineage=[p for p in lineage_paths if p.startswith('packages/') and '/src/' in p]
assert len(runtime_lineage)==6
rows=[]
for p in runtime_lineage:
 hashes={rev:sha(git('show',rev+':'+p)) for rev in [BASE,LINEAGE,SOURCE,OVERLAY]}
 hashes['installed']=sha((LIVE/p).read_bytes());flat=p.replace('/','_');pre=BACKUP/flat
 rows.append({'path':p,'sha256':hashes,'rollback_preimage':{'path':str(pre),'exists':pre.exists(),'sha256':sha(pre.read_bytes()) if pre.exists() else None},'reason':{'admin-abandonment.js':'legacy quarantine admission','durable-file.js':'narrow legacy reader tolerance','query.js':'legacy state projection','state-machine.js':'reject unproven fence-clear writes','occurrence-model.js':'preserve unverifiable scheduler history','store.js':'use non-destructive history decoder'}[Path(p).name]})
provenance_before=(LIVE/'pack-provenance.json').read_bytes()
provenance=json.loads(provenance_before)
node=Path('/usr/local/libexec/agent-core/node-runtime/bin/node')
node_version=subprocess.check_output([str(node),'--version'],env={**os.environ,'NODE_DISABLE_COMPILE_CACHE':'1'}).decode().strip()
qa_doc=git('show',QA+':D-STORE-QA-547.md',repo=Path.cwd());qa_bytes=git('show',QA+':docs/evidence/h547-store-diag/qa-v5.stdout.json',repo=Path.cwd());qa=json.loads(qa_bytes)
save('qa-basis.json',{'commit':QA,'document_title':qa_doc.decode().splitlines()[0],'document_sha256':sha(qa_doc),'stdout_sha256':sha(qa_bytes),'assertion_count':len(qa['checks']),'failed_assertions':[c for c in qa['checks'] if c['pass'] is not True],'effect_counters':qa['effect_counters'],'limitations':qa['limitations'],'rerun':False})
save('six-file-lineage.json',{'files':rows,'installed_all_match_declared_overlay':all(r['sha256']['installed']==r['sha256'][OVERLAY] for r in rows),'requested_source_equal_overlay':[r['path'] for r in rows if r['sha256'][SOURCE]==r['sha256'][OVERLAY]]})
backup_files=[]
for p in sorted(BACKUP.iterdir()):
 if p.is_file(): backup_files.append({'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
family=[]
for p in sorted(Path('/usr/local/libexec').iterdir()):
 if p.name.startswith('agent-core.bak-') and p.is_dir():
  f=p/'app/pack-provenance.json';q=json.loads(f.read_bytes()) if f.exists() else {}
  family.append({'path':str(p),'provenance_exists':f.exists(),'source_head_sha':q.get('source_head_sha'),'main_repo_head_sha':q.get('main_repo_head_sha'),'scope':'directory/provenance only, not full backup integrity'})
save('rollback-inventory.json',{'six_file_backup':backup_files,'default_backup_family':family,'full_393_backup_verified':False,'not_proof_of_global_absence':True,'durable_restore_subdirectory':'not copied, not used; edited business-state proposal is outside this mandate'})
assert (LIVE/'pack-provenance.json').read_bytes()==provenance_before
save('observed-pack.json',{'observed_at':datetime.now(timezone.utc).isoformat(),'path':str(LIVE/'pack-provenance.json'),'sha256':sha(provenance_before),'provenance':provenance,'stability_check':'same provenance bytes before/after; six files separately hashed, not atomic/full-pack verification','node_binding':{'path':str(node),'realpath':str(node.resolve()),'version':node_version,'binary_sha256':sha(node.read_bytes()),'full_runtime_closure_digest':'NOT_GENERATED'}})
extra=[r for r in delta if r['path'] not in runtime_lineage]
# This explicit Brief predicate is evaluated before assembly, not as a new gate.
result={'schema_version':2,'started_at':started,'ended_at':datetime.now(timezone.utc).isoformat(),'source_repository':str(REPO),'base':BASE,'requested_source':SOURCE,'lineage':LINEAGE,'current_overlay':OVERLAY,'source_selection_count':len(sourced),'base_selection_count':len(base),'selected_source_delta_count':len(delta),'delta_outside_six_lineage_count':len(extra),'delta':delta,'predicate':'official whole-app source selection changes only 42487e65 lineage plus direct required dependencies','result':'WHOLE_TREE_ROUTE_REJECTED_BEFORE_ASSEMBLY','counterexamples':[r for r in extra if r['path'] in ['packages/agent-memory/src/codec.js','packages/broker/src/capabilities/workflow.js','packages/broker/src/capabilities/workflow/index.js']],'scheduler_context_difference':'95 vs 081 adds policy-auto-reconcile, scheduler-policy, receiptTimeoutSeconds and changes store helper paths; cannot equate exact bytes or silently substitute 081','affected_readiness':['CANDIDATE_ARTIFACT_READY','PRODUCTION_CUTOVER_READY'],'assembly':'NOT_STARTED','production_writes':0,'production_store_reads':0}
assert result['counterexamples']
mismatches=[]
for path,entry in base.items():
 p=LIVE/path
 if path in runtime_lineage: continue
 if not p.is_file() or sha(p.read_bytes())!=entry['sha256']:
  mismatches.append({'path':path,'expected':entry['sha256'],'actual':sha(p.read_bytes()) if p.is_file() else 'ABSENT'})
save('foundation-source-check.json',{'scope':'all official selected base source files except six declared overlay paths; no dependency proof','base':BASE,'checked':len(base)-len(runtime_lineage),'mismatches':mismatches})
save('source-scope-check.json',result)
(OUT/'scheduler-context.diff').write_bytes(git('diff',OVERLAY,SOURCE,'--','packages/scheduler/src/occurrence-model.js','packages/scheduler/src/store.js'))
print(json.dumps({k:result[k] for k in ['result','selected_source_delta_count','delta_outside_six_lineage_count','source_selection_count','assembly']}))
