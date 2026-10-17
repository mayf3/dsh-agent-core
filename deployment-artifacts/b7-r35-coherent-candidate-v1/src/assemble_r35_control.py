#!/usr/bin/python3
"""Owned R35 small control-overlay recipe. Default is a non-writing input map.

No package, operation, completion proof or reviewed verifier is invented here.
Large derived pair/package files stay external; Root later creates the full
owned freeze and runs the unchanged original lifecycle/admission procedure.
"""
import argparse,ast,copy,hashlib,json,os,re,stat,types
from pathlib import Path
HERE=Path(__file__).resolve().parent
P=HERE.parent
F=Path('/Users/yanfenma/workspace/.zcode-worktrees/workspace+project+dsh-agent-core/ac-810/evidence/b7-first-batch-v5-build/v3-pair-maintenance-workblock/v50-release')
BASE={'b7-v3-publication-authority.json':'934692e224c863ffd826f4f3495528a1a15f7302a48976f71d9b539f2225a378','b7-v3-publication-pin.json':'deb1fe2ca222306c03b7efb35ef6f39fd56d80f32254dacc98b3ef3027a22d95','CAPSULE-MANIFEST.json':'798a2d805c146de91ed4614b78eef008268e1c470afdcfbb62cd99a5270e72dc'}
PAIR={'deployment_system.py':'4192c80eb839f3097a3c0b2a8adb9183f51faa033dd7342fc6ad072528c20647','ds_client.py':'9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67'}
SOURCES={'v50_prepare_inputs.py':'6ccbabfd57ba90f5c436c77cf8159aa5d204ff722e0c5cc75c33c718953dda31','e35_finished_for_r35.py':'473a636287f3b064a0d57a3f10033b307bca1996d0c390f3517e8bba634ed52b','b7-release-executor.sh':'6d72cb9097f60a3844d18305ec0cb187b58dc02e3d65f57c1a6a6cf6007240f4'}
KEY='b7-native-execution-r35-c71fd2cc'
INPUT='/private/var/db/agent-deploy-system/inputs/b7-install-r35'
SNAP='/private/var/db/agent-deploy-system-execution/'+KEY+'/b7-wired-stage'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def need(v,why):
 if not v:raise ValueError(why)
def digest(v):return type(v) is str and re.fullmatch('[a-f0-9]{64}',v) is not None
def encoded(v):return (json.dumps(v,indent=2,ensure_ascii=True)+'\n').encode()
def parse(raw):
 def pairs(items):
  v={}
  for k,x in items:need(k not in v,'duplicate input key');v[k]=x
  return v
 return json.loads(raw,object_pairs_hook=pairs)
def filehash(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def read_ref(ref,limit=4*1024*1024):
 need(type(ref) is dict and set(ref)=={'path','sha256'} and digest(ref['sha256']),'exact pinned input reference required')
 p=Path(ref['path']);s=p.lstat();need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and 0<s.st_size<=limit,'small regular input required')
 raw=p.read_bytes();need(sha(raw)==ref['sha256'],'input SHA changed');return raw

def finished_binding(v):
 need(type(v) is dict,'actual completion binding required')
 need(set(v)=={'kind','retirement_helper_sha256','retirement_pins_sha256','finished_row_sha256','completed_retirement_proof'} and v['kind']=='B7_FIXED_E35_FINISHED_FOR_R35_V1','fixed actual completion schema')
 need(all(digest(v[k]) for k in ('retirement_helper_sha256','retirement_pins_sha256','finished_row_sha256')),'actual completion hashes required')
 p=v['completed_retirement_proof'];need(type(p) is dict and set(p)=={'actual_result_sha256','full_readback_sha256','durability_completed'} and p['durability_completed'] is True and all(digest(p[k]) for k in ('actual_result_sha256','full_readback_sha256')),'actual completion durability required')

def input_template():
 return dict(build_receipt=None,files_manifest=None,previous_publication_terminal=None,finished_binding=None,retirement_return=None,retirement_full_readback=None)
def preflight_inputs(v):
 need(type(v) is dict and set(v)==set(input_template()),'fixed input map required');finished_binding(v['finished_binding'])
 for k in set(v)-{'finished_binding'}:
  q=v[k];need(type(q) is dict and set(q)=={'path','sha256'} and type(q['path']) is str and digest(q['sha256']),'actual pinned input required: '+k)

def publication_id(pair):
 need(set(pair)==set(PAIR) and all(digest(x) for x in pair.values()),'exact pair required')
 return 'ds-reader-pair-'+sha(json.dumps(pair,sort_keys=True).encode())[:12]
def previous_terminal(value,op,pair):
 expected=dict(action='DS_UPDATE',artifacts=pair,generation=op,operation_id=op,restart='self',state='COMMITTED',version=1)
 need(type(value) is dict and type(value.get('version')) is int and value==expected,'original same-publication COMMITTED required')
def normal_config(tree,binding):
 need(digest(tree),'exact new input tree required');finished_binding(binding)
 return dict(source_package='b7-install-r35',input_path=INPUT,new_input_tree_sha256=tree,fixed_e35_successor=copy.deepcopy(binding))
def capsule(authority,pin_raw):
 scripts,configs=authority['drivenScripts'],authority['drivenConfigs'];need(not(set(scripts)&set(configs)),'duplicate script/config member')
 return dict(kind='B7_V50_FREEZE_CAPSULE_V1',members={**scripts,**configs,'b7-v3-publication-pin.json':sha(pin_raw)})
def package_tree(rows):
 out=[]
 for rel,row in rows.items():
  need(type(rel) is str and rel and not rel.startswith('/') and '..' not in Path(rel).parts,'relative package row required')
  if row['type']=='directory':out.append([rel,'D'])
  elif row['type']=='link':out.append([rel,'L',row['target']])
  else:need(row['type']=='file' and digest(row['sha256']),'typed package row required');out.append([rel,'F',row['sha256']])
 return sha(json.dumps(sorted(out),sort_keys=True,separators=(',',':')).encode())
def module_from(raw,name,path):
 m=types.ModuleType(name);m.__file__=str(path);exec(compile(raw,str(path),'exec'),m.__dict__);return m

def derive(args):
 # All actual proof inputs are mandatory before any output creation.
 preflight_inputs(args);binding=args['finished_binding']
 need(os.getuid()==os.geteuid()==502,'owned UID502 only')
 base_raw={n:(F/n).read_bytes() for n in BASE};need(all(sha(base_raw[n])==h for n,h in BASE.items()),'current F metadata preimage drift')
 authority=parse(base_raw['b7-v3-publication-authority.json']);pin=parse(base_raw['b7-v3-publication-pin.json']);cap=parse(base_raw['CAPSULE-MANIFEST.json'])
 need(authority['artifacts']==PAIR and pin==dict(kind='DS_B7_V3_PAIR_PUBLICATION_PIN_V1',authorization_sha256=BASE['b7-v3-publication-authority.json']) and cap==capsule(authority,base_raw['b7-v3-publication-pin.json']),'current exact complete baseline')
 for n,h in cap['members'].items():need(filehash(F/n)==h,'current driven preimage changed: '+n)
 need(binding['retirement_helper_sha256']==authority['drivenScripts']['e35_terminal_materials_once.py'] and binding['retirement_pins_sha256']==authority['drivenConfigs']['e35-terminal-material-pins.json'],'actual retired helper/pins must match current sealed baseline')
 need(sha(read_ref(args['retirement_return']))==binding['completed_retirement_proof']['actual_result_sha256'] and sha(read_ref(args['retirement_full_readback']))==binding['completed_retirement_proof']['full_readback_sha256'],'actual retirement return/readback binding')
 readback=parse(read_ref(args['retirement_full_readback']))
 phase_rows=readback['readback']['original_four_phase_rows'];finished=[r for r in phase_rows if r.get('outcome')=='FIXED_E35_FINISHED']
 need(len(finished)==1 and finished[0]['row_sha256']==binding['finished_row_sha256'] and readback.get('actual_rc0_and_full_readback') is True,'actual original FINISHED row projection from pinned full readback required')
 native_raw=read_ref(args['previous_publication_terminal'],4096);previous_terminal(parse(native_raw),authority['publication_operation_id'],PAIR)
 br=parse(read_ref(args['build_receipt']));rows=parse(read_ref(args['files_manifest']))
 need(br.get('built') is True and br.get('registered') is False and br.get('not_control_cohort') is True and br.get('new_key')==KEY and br.get('template_byte_exact') is True and br.get('app_repacked') is False,'actual original R35 package build receipt required')
 need(br['files_manifest_sha256']==args['files_manifest']['sha256'],'actual file manifest receipt binding')
 pkg=Path(br['package']);derived=Path(br['policy_source_delta']);need(pkg.name=='b7-install-r35' and pkg!=F and F not in pkg.parents,'owned fixed new package only')
 # Read/hash in place; never copy the package or pair.
 actual_names=set()
 for root,dirs,files in os.walk(pkg,followlinks=False):
  for name in dirs+files:actual_names.add(str((Path(root)/name).relative_to(pkg)))
 need(actual_names==set(rows),'actual package inventory completeness')
 for rel,row in rows.items():
  p=pkg/rel;s=p.lstat()
  if row['type']=='file':need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size==row['bytes'] and filehash(p)==row['sha256'],'actual package file drift: '+rel)
  elif row['type']=='link':need(stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'],'actual package link drift')
  else:need(row['type']=='directory' and stat.S_ISDIR(s.st_mode),'actual package directory drift')
 packet_raw=(pkg/'packet/PACKET.json').read_bytes();packet=parse(packet_raw);M=sha(packet_raw);worker=filehash(pkg/'packet/b7-wired-stage/stage-seed-once.py');op=br['new_operation']
 need(M==br['packet_manifest_sha256'] and worker==br['worker_sha256'] and packet['snapshotRoot']==SNAP and re.fullmatch('b7-packet-r35-'+M[:16]+'-e[0-9]+',op),'Root-selected actual coordinates required')
 need(packet['materialRoot']==INPUT+'/b7-wired-inputs','fixed new material root')
 pins=parse((pkg/'b7-wired-inputs/INSTALL-PINS.json').read_bytes());need(pins['appSource']['appArchiveSha256']=='505cff8f9627d5986594c3464ab11b48cca36b187ff9c78c4ccb26b404587e83' and pins['appSource']['packProvenanceSha256']=='ac35f9d8fb1bb1a072afcfc6e47133930b0fd1ce9aebd820b3a09576efd9ebe8','unchanged first app/provenance required')
 source_path=P.parent/'successor-preparation-policy-span-v3/prepare_successor.py'
 source_raw=source_path.read_bytes();need(sha(source_raw)=='ca9c0448cac3f8a5bb9daed4f5a0e182e3989f431fce4d18c37faea2fbef788d','reviewed recipe source changed');recipe=module_from(source_raw,'fixed_successor_recipe',source_path)
 original_execution=(F/'v53_r34_execution_source.py').read_text();new_execution,_=recipe.append_preintent(original_execution,KEY,op)
 need((derived/'v53_r34_execution_source.py').read_text()==new_execution,'fixed private preintent derivation')
 def row(old,execution):
  v=copy.deepcopy(old);v['manifestSha256']=M;v['reason']='B7_COHERENT_CANDIDATE_R35_ORIGINAL_GUARDS_REQUIRED'
  if execution:v.update(files=copy.deepcopy(packet['files']),manifestPath=INPUT+'/packet/PACKET.json',snapshotRoot=SNAP,stageArgv=['/usr/bin/python3',SNAP+'/stage-seed-once.py']);v['terminalBinding']['toolSha256']=recipe.NEW_SHA[0]
  else:v['sourceSha256']=worker
  return v
 old_codec=(F/'v50_execution_client_source.py').read_text();need(old_codec.count(recipe.OLDKEY)==2,'two original codec keys');new_codec=old_codec.replace(recipe.OLDKEY,KEY)
 need((derived/'v50_execution_client_source.py').read_text()==new_codec,'codec only two KEY literals')
 pair={}
 for name,methods in [('deployment_system.py',['install_hooks','install_execution_hooks']),('ds_client.py',['install_client_hooks','install_owner_cli'])]:
  old=(F/name).read_text();need(sha(old.encode())==PAIR[name],'current actual pair preimage')
  expected=old
  for method in methods:expected=recipe.append_policy(expected,method,recipe.OLDKEY,KEY,lambda r,ex=method=='install_execution_hooks':row(r,ex))
  before=original_execution if name=='deployment_system.py' else old_codec;after=new_execution if name=='deployment_system.py' else new_codec
  hits=[n for n in ast.walk(ast.parse(expected)) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='compile' and n.args and isinstance(n.args[0],ast.Constant) and n.args[0].value==before];need(len(hits)==1,'one exact original ASCII seal');literal=ast.get_source_segment(expected,hits[0].args[0]);need(literal==ascii(before),'original ASCII literal');expected=expected.replace(literal,ascii(after),1)
  pair[name]=filehash(derived/name);need(pair[name]==sha(expected.encode())==br['policy_proofs'][name]['candidate_sha256'],'exact policy/seal whole source derivation')
 # Generate only the finite successor verifier from the exact current b530.
 # Pending r35_cohort is deliberately rejected by its final review predicate.
 import r35_verifier
 verifier,verifier_spans=r35_verifier.build_verifier((F/'verify-chain-v50.py').read_bytes(),dict(operation=op,manifest_sha256=M,worker_sha256=worker,execution_sha256=sha(new_execution.encode()),codec_sha256=sha(new_codec.encode()),tree_sha256=package_tree(rows),finished_binding=binding))
 retire_cp_preimage=(F/'b7-install-r34/packet/b7-wired-stage/checkpoint-inputs.json').read_bytes()
 need(sha(retire_cp_preimage)=='393555956947d846e5e9f5772b72d6e6adaafacf069bba6c94680d1d06b6ffc5','original R34 retirement checkpoint preimage changed')
 changed={'verify-chain-v50.py':verifier,'v53_r34_execution_source.py':new_execution.encode(),'v50_execution_client_source.py':new_codec.encode(),'e35-retirement-checkpoint-preimage.json':retire_cp_preimage}
 for n,h in SOURCES.items():
  raw=(P/'placement'/n).read_bytes();need(sha(raw)==h,'reviewed fixed placement source drift');changed[n]=raw
 need(sha((F/'b7-release-executor.sh').read_bytes())=='74110415b30bd81572d50e6c53d2e1129052521700a8ef951adfc1d557b4b903','retire case baseline must be retained')
 facts=parse((F/'candidate-facts.json').read_bytes());pub=publication_id(pair);oldpub=authority['publication_operation_id'];w=pkg/'b7-wired-inputs';stage=pkg/'packet/b7-wired-stage'
 hashes=dict(PINS=filehash(w/'INSTALL-PINS.json'),SC=filehash(w/'SOURCE-CONTENT.sha256'),SEEDMAT=filehash(stage/'seed-materials.mjs'),TEMPLATE=filehash(w/'SEED-TEMPLATE.UNINSTALLABLE.json'),OP=pins['operationSourceArchiveSha256'],WORKER=worker,M11=M,SERVER=pair['deployment_system.py'],CLIENT=pair['ds_client.py'])
 facts.update(hashes,publication_operation_id=pub,next_b7_operation=op,inScopeOperations=[op]);changed['candidate-facts.json']=encoded(facts);changed['v50-input-preparation.json']=encoded(normal_config(package_tree(rows),binding))
 wrapper=(F/'owner-deploy-session.sh').read_bytes();need(wrapper.count(oldpub.encode())==1,'fixed publication wrapper');changed['owner-deploy-session.sh']=wrapper.replace(oldpub.encode(),pub.encode(),1)
 auth=copy.deepcopy(authority);auth.update(publication_operation_id=pub,artifacts=pair,preimage_artifacts=copy.deepcopy(PAIR),previous_publication_terminal=dict(operation_id=oldpub,state='COMMITTED',sha256=sha(native_raw)),registration_binding=dict(manifest_sha256=M,source_sha256=worker),executorSha256=SOURCES['b7-release-executor.sh'],inScopeOperations=[op],next_b7_operation=op)
 auth['frozen_candidate'].update(packet_manifest_sha256=M,stage_seed_sha256=worker,install_pins_sha256=hashes['PINS'],operation_source_archive_sha256=hashes['OP'],source_content_sha256=hashes['SC'],seed_worker_sha256=hashes['SEEDMAT'])
 for n,b in changed.items():
  target='drivenConfigs' if n in ('candidate-facts.json','v50-input-preparation.json','e35-retirement-checkpoint-preimage.json') else 'drivenScripts';auth[target][n]=sha(b)
 for n,h in pair.items():auth['drivenScripts'][n]=h
 auth['review_receipts']['r35_source_generator_canonical_sc']='d5cfcf25da5d3c4a3ea1642c43242d1d5b8a9b9f598e8163300a713c94636adf'
 auth['review_receipts']['r35_placement']='fd71c8a96b802fd761df5119cd35a2d012c642ab1a927a65c6ced48a14fcfe5e'
 auth['review_receipts']['r35_policy_span_fixed_finish']='56fcbe4e88362b4dd443f34eed2e81ad190321e50a0c7e99263cc444b0bd6c69'
 auth['review_receipts']['r35_cohort']='PENDING_FIXED_R35_FINAL_COHORT_REVIEW_NO_PRODUCTION_ADMISSION'
 auth_raw=encoded(auth);need(len(auth_raw)<=16384,'original authority size bound');changed['b7-v3-publication-authority.json']=auth_raw;pin_raw=encoded(dict(kind='DS_B7_V3_PAIR_PUBLICATION_PIN_V1',authorization_sha256=sha(auth_raw)));changed['b7-v3-publication-pin.json']=pin_raw;changed['CAPSULE-MANIFEST.json']=encoded(capsule(auth,pin_raw))
 external={n:dict(path=str(derived/n) if n in PAIR else str(F/n),sha256=h) for n,h in {**auth['drivenScripts'],**auth['drivenConfigs']}.items() if n not in changed}
 result=dict(kind='OWNED_R35_SMALL_CONTROL_OVERLAY_PENDING_REVIEW_NOT_ADMISSION',pair=pair,publication=pub,operation=op,baseline_authority_sha256=BASE['b7-v3-publication-authority.json'],previous_committed_receipt_sha256=sha(native_raw),package=str(pkg),retained_original_checkpoint=dict(member='e35-retirement-checkpoint-preimage.json',sha256=sha(retire_cp_preimage),historical_scene_revalidated=False),verifier_derivation=dict(preimage_sha256=r35_verifier.BASE_SHA,whole_inverse_exact=True,span_count=len(verifier_spans)),external_members=external,preimage_members={n:dict(path=str(F/n),sha256=h) for n,h in PAIR.items()},changed_members={n:sha(b) for n,b in changed.items()},actual_snapshot_created=False,installed=False,production_changed=False,remaining='Root materializes external members/package/preimage from existing retained sources in an owned freeze, independent affected verifier/cohort review then exact metadata reseal and original full pre/post lifecycle verifier. No load or business claim.')
 return changed,result

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--materialize',action='store_true');p.add_argument('--inputs');a=p.parse_args()
 if not a.materialize:print(json.dumps(dict(status='DRY_RUN_NOT_EXECUTABLE',actual_inputs=input_template(),output=str(HERE/'changed-overlay'),new_operation=None,verifier_generation='finite whole-byte inverses to current4192/9ebd + executor741; historical retireCP reads retainedR34/393; original SC canonical check unchanged; actual inputs and final independent review required'),indent=2));return
 need(a.inputs is not None,'actual input map required');changed,result=derive(parse(Path(a.inputs).read_bytes()));out=HERE/'changed-overlay';need(not out.exists(),'exclusive overlay output; no merge/retry');out.mkdir()
 for n,b in changed.items():
  with (out/n).open('xb') as f:f.write(b)
 with (out/'ASSEMBLY-RECEIPT.json').open('xb') as f:f.write(encoded(result))
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
