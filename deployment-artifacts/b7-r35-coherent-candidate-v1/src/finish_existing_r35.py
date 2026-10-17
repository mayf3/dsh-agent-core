#!/usr/bin/python3
"""Finish only the already-built M47b/e36 owned packet; default writes nothing.

No copy, repack, old-file rewrite, --build retry, registration or operation
selection. Root alone may explicitly invoke --finish-existing after review.
"""
import argparse,ast,copy,hashlib,importlib.util,json,os,stat
from pathlib import Path
HERE=Path(__file__).resolve().parent
P=HERE.parent
OLD=P/'successor-preparation-canonical-sc-v2'
DEST=OLD/'candidates/b7-install-r35'
DERIVED=DEST.parent/'b7-install-r35-policy-source-delta'
CONTROL=Path('/Users/yanfenma/workspace/.zcode-worktrees/workspace+project+dsh-agent-core/ac-810/evidence/b7-first-batch-v5-build/v3-pair-maintenance-workblock/v50-release')
KEY='b7-native-execution-r35-c71fd2cc'
M='47b552891423699330112daa97daf4a3002760c8e1febc165b505636a503481c'
OP='b7-packet-r35-47b5528914236993-e36'
EXISTING={'deployment_system.py':'c0f26fdc1354bd0116a6bde162fef47f403b4577ea4a8c7c715ca17a24a0099d','v53_r34_execution_source.py':'6d0b4a722e66718be04ea8b76a3faeb4627761dd3ca07d8fa7af1868ea194529'}
RECIPE='ca9c0448cac3f8a5bb9daed4f5a0e182e3989f431fce4d18c37faea2fbef788d'
sha=lambda b:hashlib.sha256(b).hexdigest()
def need(v,why):
 if not v:raise ValueError(why)
def filehash(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def exclusive(p,raw):
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
 try:
  with os.fdopen(fd,'wb',closefd=False) as out:
   need(out.write(raw)==len(raw),'short output write');out.flush();os.fsync(fd)
 finally:os.close(fd)
 parent=os.open(p.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:os.fsync(parent)
 finally:os.close(parent)
 need(filehash(p)==sha(raw),'output readback drift')
def load_recipe():
 source=HERE/'prepare_successor.py';need(filehash(source)==RECIPE,'fixed repaired recipe changed')
 spec=importlib.util.spec_from_file_location('fixed_r35_pure_derivations',source);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);return r
def replace_seal(text,original,replacement,tag):
 hits=[n.args[0] for n in ast.walk(ast.parse(text)) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='compile' and len(n.args)>1 and isinstance(n.args[0],ast.Constant) and n.args[0].value==original and isinstance(n.args[1],ast.Constant) and n.args[1].value==tag]
 need(len(hits)==1,'one fixed original source seal');n=hits[0]
 need(n.lineno==n.end_lineno and ast.get_source_segment(text,n)==ascii(original),'fixed original ASCII seal')
 lines=text.splitlines(keepends=True);line=lines[n.lineno-1];literal=ascii(replacement)
 lines[n.lineno-1]=line[:n.col_offset]+literal+line[n.end_col_offset:];result=''.join(lines)
 inverse=result.splitlines(keepends=True);need(inverse[n.lineno-1][n.col_offset:n.col_offset+len(literal)]==literal,'inverse seal span')
 inverse[n.lineno-1]=inverse[n.lineno-1][:n.col_offset]+ascii(original)+inverse[n.lineno-1][n.col_offset+len(literal):]
 need(''.join(inverse)==text,'whole ASCII seal inverse');return result

def prepare():
 need(os.getuid()==os.geteuid()==502,'owned UID502 only')
 r=load_recipe();need(DEST.is_dir() and not DEST.is_symlink() and DERIVED.is_dir() and not DERIVED.is_symlink(),'existing fixed owned directories required')
 outputs=[DERIVED/'v50_execution_client_source.py',DERIVED/'ds_client.py',DEST.parent/'b7-install-r35-FILES.json',DEST.parent/'b7-install-r35-BUILD-RECEIPT.json']
 need(all(not os.path.lexists(p) for p in outputs),'all four missing outputs must still be absent; no replay/overwrite')
 need(set(p.name for p in DERIVED.iterdir())==set(EXISTING),'exact two already-produced policy artifacts required')
 for name,want in EXISTING.items():
  p=DERIVED/name;s=p.lstat();need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and filehash(p)==want,'preexisting derived file drift '+name)
 for name,want in r.PAIR.items():need(filehash(CONTROL/name)==want,'actual current pair preimage drift '+name)
 packet_raw=(DEST/'packet/PACKET.json').read_bytes();need(sha(packet_raw)==M,'fixed actual built packet changed');packet=json.loads(packet_raw)
 formal='/private/var/db/agent-deploy-system/inputs/b7-install-r35';package=formal+'/b7-wired-inputs';snap='/private/var/db/agent-deploy-system-execution/'+KEY+'/b7-wired-stage'
 need(packet['materialRoot']==package and packet['snapshotRoot']==snap,'fixed actual packet coordinates')
 w=DEST/'b7-wired-inputs';stage=DEST/'packet/b7-wired-stage';oldw=r.BASE/'b7-wired-inputs';worker_sha=filehash(stage/'stage-seed-once.py')
 need(worker_sha=='0289d9877cbce552723196dd726988a1499fd0b0a5681731d41c10a4b79de3b2','fixed already-built worker changed')
 pins=json.loads((w/'INSTALL-PINS.json').read_bytes());opname=Path(pins['operationSourceArchive']).name
 need(pins['appSource']['appArchiveSha256']=='505cff8f9627d5986594c3464ab11b48cca36b187ff9c78c4ccb26b404587e83' and pins['appSource']['packProvenanceSha256']=='ac35f9d8fb1bb1a072afcfc6e47133930b0fd1ce9aebd820b3a09576efd9ebe8','unchanged app/provenance required')
 need((w/'SEED-TEMPLATE.UNINSTALLABLE.json').read_bytes()==(oldw/'SEED-TEMPLATE.UNINSTALLABLE.json').read_bytes(),'ordered template unchanged')
 changes={rel:(r.SR/'source'/rel).read_bytes() for rel in r.TOOLS}
 for rel,want in zip(r.TOOLS,r.NEW_SHA):need(sha(changes[rel])==filehash(w/'dsh-agent-core'/rel)==pins['toolPins'][rel]['sha256']==want,'fixed four source/tool pins')
 need((w/'SOURCE-CONTENT.sha256').read_bytes()==r.source_list((oldw/'SOURCE-CONTENT.sha256').read_bytes(),changes) and filehash(w/'SOURCE-CONTENT.sha256')=='9eef50323f55dce9b96d4e420544ad9ca83e2959d4d50871d4c7af54b4fc3e48','actual canonical SC exact')
 # Complete original header/member readback, without repacking or extracting.
 before=r.archive_inventory(oldw/'artifacts'/opname);after=r.archive_inventory(w/'artifacts'/opname)
 need(list(before)==list(after),'archive member order/name drift')
 for name,row in before.items():
  other=after[name];rel=name.removeprefix('dsh-agent-core/')
  if rel in changes:
   left=copy.deepcopy(row['header']);right=copy.deepcopy(other['header'])
   for h in (left,right):h['pax_headers'].pop('size',None)
   need(left==right and other['sha256']==sha(changes[rel]),'changed member header/payload drift')
  else:need(row==other,'unchanged archive header/payload drift')
 tarproof=dict(changed=list(r.TOOLS),members=len(after),before_sha256=filehash(oldw/'artifacts'/opname),after_sha256=filehash(w/'artifacts'/opname))
 need(tarproof['after_sha256']==pins['operationSourceArchiveSha256']==pins['artifactPins'][opname]['sha256'],'actual OP archive pins')
 execution=(CONTROL/'v53_r34_execution_source.py').read_text();new_execution,preintent_proof=r.append_preintent(execution,KEY,OP)
 need(sha(new_execution.encode())==EXISTING['v53_r34_execution_source.py'],'existing private addition exact derivation')
 def derive(row,execution):
  row['manifestSha256']=M;row['reason']='B7_COHERENT_CANDIDATE_R35_ORIGINAL_GUARDS_REQUIRED'
  if execution:
   row.update(files=copy.deepcopy(packet['files']),manifestPath=formal+'/packet/PACKET.json',snapshotRoot=snap,stageArgv=['/usr/bin/python3',snap+'/stage-seed-once.py']);row['terminalBinding']['toolSha256']=r.NEW_SHA[0]
  else:row['sourceSha256']=worker_sha
  return row
 policy_proofs={};client=None;codec=None
 for name,methods in [('deployment_system.py',['install_hooks','install_execution_hooks']),('ds_client.py',['install_client_hooks','install_owner_cli'])]:
  old=(CONTROL/name).read_text();text=old
  for method in methods:text=r.append_policy(text,method,r.OLDKEY,KEY,lambda row,ex=method=='install_execution_hooks':derive(row,ex))
  if name=='deployment_system.py':
   text=replace_seal(text,execution,new_execution,'<sealed-b7_ds_execution.py>')
   need(sha(text.encode())==EXISTING[name],'existing server exact whole derivation')
  else:
   tree=ast.parse(text);nodes=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='compile' and len(n.args)>1 and isinstance(n.args[1],ast.Constant) and n.args[1].value=='<sealed-b7_ds_execution_client.py>']
   need(len(nodes)==1 and isinstance(nodes[0].args[0],ast.Constant),'one old client source')
   source=nodes[0].args[0].value;need(source.count(r.OLDKEY)==2,'two current codec keys')
   codec=source.replace(r.OLDKEY,KEY);need(codec.replace(KEY,r.OLDKEY)==source,'codec whole inverse')
   text=replace_seal(text,source,codec,'<sealed-b7_ds_execution_client.py>');client=text.encode()
  policy_proofs[name]=dict(preimage_sha256=sha(old.encode()),candidate_sha256=sha(text.encode()),methods=methods,each_policy_whole_byte_inverse=True,old_values_exact=True,codec_only_two_key_literals=name=='ds_client.py')
 # Original full FILE manifest and exact changed-members predicate; no writes.
 rows={};changed=[]
 for base,dirs,files in os.walk(DEST,followlinks=False):
  for name in sorted(dirs+files):
   path=Path(base)/name;relative=path.relative_to(DEST).as_posix();st=path.lstat();row={'mode':stat.S_IMODE(st.st_mode),'uid':st.st_uid,'gid':st.st_gid};original=r.BASE/relative
   if stat.S_ISLNK(st.st_mode):row.update(type='link',target=os.readlink(path));need(original.is_symlink() and os.readlink(original)==row['target'],'copied source symlink drift')
   elif stat.S_ISDIR(st.st_mode):row.update(type='directory')
   else:
    need(stat.S_ISREG(st.st_mode) and st.st_nlink==1,'owned regular source required');row.update(type='file',bytes=st.st_size,sha256=filehash(path))
    if row['sha256']!=filehash(original):changed.append(relative)
   rows[relative]=row
 expected={'b7-wired-inputs/'+rel for rel in ['INSTALL-PINS.json','SOURCE-CONTENT.sha256','artifacts/'+opname]}|{'b7-wired-inputs/dsh-agent-core/'+rel for rel in r.TOOLS}|{'packet/'+rel for rel in ['PACKET.json','STAGE-ADAPTER.json','b7-wired-stage/checkpoint-inputs.json','b7-wired-stage/seed-materials.mjs','b7-wired-stage/stage-seed-once.py']}
 if 'sidecarPath' in pins['artifactPins'][opname]:expected.add('b7-wired-inputs/artifacts/'+Path(pins['artifactPins'][opname]['sidecarPath']).name)
 need(set(changed)==expected,'unexpected/missing package payload delta')
 inventory=r.encoded(rows)
 result=dict(r.plan(),built=True,new_key=KEY,new_operation=OP,registered=False,package=str(DEST),policy_source_delta=str(DERIVED),policy_proofs=policy_proofs,private_preintent_proof=preintent_proof,packet_manifest_sha256=M,worker_sha256=worker_sha,files_manifest_sha256=sha(inventory),changed_members=sorted(changed),tar_readback=tarproof,template_byte_exact=True,app_repacked=False,not_control_cohort=True,remaining='Root original current-baseline authority/executor/prepare/verifier/publication/pin/capsule cascade plus independent review; R35 placement consumes e35 closed/retired/checkpoint proof, never warms old e31 cache; no DS calls',continuation=dict(kind='FIXED_EXISTING_OWNED_POLICY_VALIDATION_CONTINUATION',failed_generator_sha256='f59117879bc50701e45a37450fac72c830d8b13cc4698a1609e0825da4b947aa',repaired_generator_sha256=RECIPE,existing_files_pinned=EXISTING,old_packet_not_rewritten=True,build_not_replayed=True))
 # Recheck retained artifacts and all missing-output predicates before writes.
 for name,want in EXISTING.items():need(filehash(DERIVED/name)==want,'preexisting product changed during validation')
 need(filehash(DEST/'packet/PACKET.json')==M and all(not os.path.lexists(p) for p in outputs),'fixed subject/output changed during validation')
 return [(outputs[0],codec.encode()),(outputs[1],client),(outputs[2],inventory),(outputs[3],r.encoded(result))],result

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--finish-existing',action='store_true');args=parser.parse_args()
 if not args.finish_existing:
  print(json.dumps(dict(status='DRY_RUN_NO_WRITE',fixed_existing_package=str(DEST),fixed_observed_operation=OP,actual_BUILD_success_claim=False,allowed_new_outputs=['v50_execution_client_source.py','ds_client.py','b7-install-r35-FILES.json','b7-install-r35-BUILD-RECEIPT.json'],no_repack=True,no_copy=True),indent=2));return
 outputs,result=prepare()
 for path,raw in outputs:exclusive(path,raw)
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
