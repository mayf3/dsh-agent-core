#!/usr/bin/python3
"""Offline R35 package/policy derivation only. Default is a non-writing plan.

Root supplies coordinates only after e35 recovery/retirement/checkpoint. This
does not register/execute, build an app, or replace Root's authority assembler.
"""
import argparse,ast,copy,gzip,hashlib,io,json,os,re,stat,subprocess,tarfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
A=HERE.parents[1]
BASE=A/'codex-r34-coherent-business-candidate-20261018/candidate-freeze/b7-install-r34'
CONTROL=HERE.parent/'maintenance-input-order-fix'
SR=A/'codex-e35-cli-source-repair-20261018'
OLDKEY='b7-native-execution-r34-c71fd2cc'
OLDINPUT='/private/var/db/agent-deploy-system/inputs/b7-install-r34'
OLDSNAP='/private/var/db/agent-deploy-system-execution/'+OLDKEY+'/b7-wired-stage'
PAIR={'deployment_system.py':'4192c80eb839f3097a3c0b2a8adb9183f51faa033dd7342fc6ad072528c20647','ds_client.py':'9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67'}
TOOLS=('scripts/lib/deployment-reuse/transaction-recovery.mjs','scripts/lib/trusted-cp-fresh-child-boot-canary.mjs','scripts/lib/trusted-cp-runtime-app-graph-gate.mjs','scripts/lib/trusted-cp-model-overrides-config-gate.mjs')
NEW_SHA=('db45db7230ec25015321081f8c9c1357355c61df517d8f6392924fd7ce06f55f','112c6d55c1a30abbd87af543ef4385dff5008ac8e4ba22ef52d2cec770ac825c','5188818a291ca922714c13927b3d5ad38eecc2bc31ccae580c4e4b1bb963fc41','2a1d81d0fe6aced720382294af85a0dc1f2b05363eed13c2e69a965a9dc7c065')
JOURNAL='81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf'
sha=lambda b:hashlib.sha256(b).hexdigest()
def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def need(v,message):
 if not v:raise ValueError(message)
def encoded(v):
 # Payload objects are NOT canonicalized: definition/farmLinks order matters.
 return (json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode()
def put(p,raw):
 need(not p.is_symlink(),'write refuses symlink')
 mode=stat.S_IMODE(p.stat().st_mode) if p.exists() else 0o644
 if p.exists():os.chmod(p,mode|0o200)
 p.write_bytes(raw);os.chmod(p,mode)
def header(m):
 return {k:getattr(m,k) for k in ('name','mode','uid','gid','mtime','type','linkname','uname','gname','devmajor','devminor','pax_headers','sparse')}
def archive_inventory(path):
 rows={}
 with tarfile.open(path,'r:gz') as t:
  for m in t:
   need(m.name not in rows,'duplicate archive member')
   h=header(m);h['type']=h['type'].decode('ascii')
   f=t.extractfile(m) if m.isreg() else None
   d=hashlib.sha256()
   if f:
    for b in iter(lambda:f.read(1048576),b''):d.update(b)
   rows[m.name]={'header':h,'size':m.size,'sha256':d.hexdigest() if f else None}
 return rows
def repack_tools(old,new,changes):
 need(set(changes)==set(TOOLS),'exact four tool payloads required')
 need(not new.exists(),'exclusive archive output')
 before=archive_inventory(old);seen=[]
 with new.open('xb') as out,gzip.GzipFile(filename='',mode='wb',fileobj=out,mtime=0) as gz,tarfile.open(fileobj=gz,mode='w|',format=tarfile.PAX_FORMAT) as dest,tarfile.open(old,'r:gz') as src:
  for member in src:
   rel=member.name.removeprefix('dsh-agent-core/')
   info=copy.deepcopy(member)
   if rel in changes:
    need(member.isreg(),'changed tool is not regular')
    data=changes[rel];info.size=len(data)
    if 'size' in info.pax_headers:info.pax_headers['size']=str(len(data))
    dest.addfile(info,io.BytesIO(data));seen.append(rel)
   else:dest.addfile(info,src.extractfile(member) if member.isreg() else None)
 need(set(seen)==set(TOOLS) and len(seen)==4,'archive four members absent')
 after=archive_inventory(new);need(list(before)==list(after),'member order/name changed')
 for name,row in before.items():
  other=after[name];rel=name.removeprefix('dsh-agent-core/')
  if rel in changes:
   # Only changed regular file size/PAX-size and payload may differ.
   left=copy.deepcopy(row['header']);right=copy.deepcopy(other['header'])
   for h in (left,right):h['pax_headers'].pop('size',None)
   need(left==right and other['sha256']==sha(changes[rel]),'changed member header/payload drift')
  else:need(row==other,'unchanged archive member drift')
 return {'changed':[x for x in TOOLS if x in seen],'members':len(after),'before_sha256':digest(old),'after_sha256':digest(new)}
def source_list(raw,changes):
 need(set(changes)==set(TOOLS),'exact four source hashes required')
 out=[];seen=[]
 for line in raw.decode('ascii').splitlines(keepends=True):
  h,rel=line.rstrip('\n').split('  ',1);need(re.fullmatch('[0-9a-f]{64}',h),'bad source hash')
  if rel in changes:out.append(sha(changes[rel])+'  '+rel+'\n');seen.append(rel)
  else:out.append(line)
 need(set(seen)==set(TOOLS) and len(seen)==4,'source list absent/duplicate tool')
 return ''.join(sorted(out)).encode('ascii')
def append_policy(text,method,oldkey,newkey,derive):
 changes=[]
 for node in ast.walk(ast.parse(text)):
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr==method:
   for arg in node.args:
    if isinstance(arg,ast.Dict):
     value=ast.literal_eval(arg)
     if oldkey in value.get('packets',{}):
      need(newkey not in value['packets'],'new policy key already exists')
      before=ast.get_source_segment(text,arg);need(arg.lineno==arg.end_lineno and before==repr(value),'nonliteral policy representation')
      after=copy.deepcopy(value);after['packets'][newkey]=derive(copy.deepcopy(value['packets'][oldkey]))
      inverse=copy.deepcopy(after);del inverse['packets'][newkey];need(inverse==value,'old policy value changed')
      changes.append((arg.lineno,arg.col_offset,arg.end_col_offset,before,repr(after)))
 need(len(changes)==1,'exactly one policy installer required')
 line,start,end,before,after=changes[0];lines=text.splitlines(keepends=True)
 need(lines[line-1][start:end]==before,'policy source offsets')
 lines[line-1]=lines[line-1][:start]+after+lines[line-1][end:];result=''.join(lines)
 inverse_lines=result.splitlines(keepends=True)
 need(inverse_lines[line-1][start:start+len(after)]==after,'policy inverse source offsets')
 inverse_lines[line-1]=inverse_lines[line-1][:start]+before+inverse_lines[line-1][start+len(after):]
 need(''.join(inverse_lines)==text,'policy whole-byte inverse')
 return result
def rebind_constant(text,name,value):
 pattern=r'(?m)^'+re.escape(name)+r' = .+$'
 result,n=re.subn(pattern,name+' = '+value,text);need(n==1,'constant missing/duplicate '+name);return result
def append_preintent(text,key,op):
 """Two subject-specific additions. The old R34 method/case stay exact."""
 need(sha(text.encode())=='c901aabdbc385230e553e0dd051e463c95bf770e857e4152c73e39702c209818','original private execution source')
 node=next(n for c in ast.parse(text).body if isinstance(c,ast.ClassDef) and c.name=='Execution' for n in c.body if isinstance(n,ast.FunctionDef) and n.name=='r34_pre_intent_checkpoint')
 method=''.join(text.splitlines(keepends=True)[node.lineno-1:node.end_lineno])
 oldop="op=='b7-packet-r34-1cfeff2a5b138629-e35'"
 need(method.count(oldop)==1,'original fixed private subject')
 newmethod=method.replace('def r34_pre_intent_checkpoint(','def r35_pre_intent_checkpoint(',1).replace(oldop,'op=='+repr(op),1).replace('fixed_r34_pre_intent_worker','fixed_r35_pre_intent_worker',1)
 anchor=' def execute(self,r,peer):\n';need(text.count(anchor)==1,'private method insertion')
 gate="     if reg['binding']['packetId']=='b7-native-execution-r34-c71fd2cc':self.r34_pre_intent_checkpoint(op,p)\n"
 need(text.count(gate)==1,'original fixed pre-intent dispatch')
 added="     if reg['binding']['packetId']=="+repr(key)+":self.r35_pre_intent_checkpoint(op,p)\n"
 out=text.replace(anchor,newmethod+anchor,1).replace(gate,gate+added,1)
 need(out.replace(newmethod,'',1).replace(added,'',1)==text,'private whole-byte inverse')
 return out,dict(preimage_sha256=sha(text.encode()),source_sha256=sha(out.encode()),whole_inverse_exact=True,old_r34_method_and_dispatch_exact=True,new_key=key,new_operation=op)
def plan():
 return dict(kind='OFFLINE_SUCCESSOR_RECIPE_NOT_ADMISSION',built=False,new_key=None,new_operation=None,base=str(BASE),control_preimage=PAIR,app='505cff8f/ac35f9d8/c71fd2cc unchanged',four_tools=dict(zip(TOOLS,NEW_SHA)),journal_sha256=JOURNAL,requires_root_sequence='e35 recovery, fixed-five retirement and original checkpoint before Root chooses/builds/registers successor',not_control_cohort=True)
def build(args):
 need(os.getuid()==os.geteuid()==502,'owned UID502 only')
 need(args.key=='b7-native-execution-r35-c71fd2cc' and args.input_name=='b7-install-r35','fixed R35 coordinates only')
 need(re.fullmatch('e[0-9]+',args.suffix or ''),'Root must supply future operation suffix')
 need(args.journal_receipt is not None,'Root actual journal readback required for attribution')
 receipt=Path(args.journal_receipt);need(receipt.is_file() and not receipt.is_symlink(),'receipt regular path')
 raw_receipt=receipt.read_bytes();need(args.journal_receipt_sha256==sha(raw_receipt),'explicit actual readback pin mismatch')
 need(re.search(r'(?<![0-9a-f])'+JOURNAL+r'(?![0-9a-f])',raw_receipt.decode('utf8')) is not None,'actual journal hash absent from readback')
 utc=json.loads(raw_receipt)['at'];need(isinstance(utc,str) and utc,'readback UTC missing')
 control=Path(args.control_root) if args.control_root else CONTROL
 for name,want in PAIR.items():need(digest(control/name)==want,'current control preimage '+name)
 need(digest(SR/'v2/HANDOFF.json')=='1edceed666c08ace03f39da40cd192adc3552e26315180ff42024cd7ba3e0fc1','SR handoff drift')
 changes={r:(SR/'source'/r).read_bytes() for r in TOOLS}
 for r,want in zip(TOOLS,NEW_SHA):need(sha(changes[r])==want,'SR tool drift '+r)
 need(digest(BASE/'packet/PACKET.json')=='1cfeff2a5b1386297df4cd992da8967664b6178b7cc9cd36b801062ff2e93b4c','R34 packet drift')
 for rel,want in [('INSTALL-PINS.json','401b6d7af057477215679fb8f915824649c79bf69564dc3944b0b3bec3bd1e30'),('SOURCE-CONTENT.sha256','7844e0727beedfab46e09227adbe045ea812a4e140147e0e7a9d40c8430aeb85'),('SEED-TEMPLATE.UNINSTALLABLE.json','5e94d1418729f7cb7d826f5ea88d9641c572f142e1a85d0dc5254dfaf4cb662f')]:need(digest(BASE/'b7-wired-inputs'/rel)==want,'frozen R34 input drift '+rel)
 dest=HERE/'candidates'/args.input_name;need(not dest.exists(),'owned destination exists; no merge/retry')
 dest.parent.mkdir(exist_ok=True)
 subprocess.run(['/bin/cp','-cR',str(BASE),str(dest)],check=True)
 w=dest/'b7-wired-inputs';stage=dest/'packet/b7-wired-stage';oldw=BASE/'b7-wired-inputs'
 pins=json.loads((w/'INSTALL-PINS.json').read_bytes());oldpins=copy.deepcopy(pins)
 need(pins['appSource']['appArchiveSha256']=='505cff8f9627d5986594c3464ab11b48cca36b187ff9c78c4ccb26b404587e83' and pins['appSource']['packProvenanceSha256']=='ac35f9d8fb1bb1a072afcfc6e47133930b0fd1ce9aebd820b3a09576efd9ebe8','app baseline')
 formal='/private/var/db/agent-deploy-system/inputs/'+args.input_name;package=formal+'/b7-wired-inputs';snap='/private/var/db/agent-deploy-system-execution/'+args.key+'/b7-wired-stage'
 for rel,data in changes.items():
  need(digest(oldw/'dsh-agent-core'/rel)==pins['toolPins'][rel]['sha256'],'old tool pin')
  put(w/'dsh-agent-core'/rel,data);pins['toolPins'][rel].update(sha256=sha(data),bytes=len(data))
 for rel,row in pins['toolPins'].items():row['path']=package+'/dsh-agent-core/'+rel
 opname=Path(pins['operationSourceArchive']).name
 need(digest(oldw/'artifacts'/opname)==pins['operationSourceArchiveSha256']==pins['artifactPins'][opname]['sha256'],'original OP archive pins')
 # Keep the cloned original archive until independent full readback succeeds.
 out=w/'artifacts'/(opname+'.new');tarproof=repack_tools(oldw/'artifacts'/opname,out,changes)
 oldarc=w/'artifacts'/opname;os.chmod(oldarc,stat.S_IMODE(oldarc.stat().st_mode)|0o200);os.replace(out,oldarc)
 put(w/'SOURCE-CONTENT.sha256',source_list((oldw/'SOURCE-CONTENT.sha256').read_bytes(),changes))
 pins['sourceContentSha256']=digest(w/'SOURCE-CONTENT.sha256');pins['toolSourceRoot']=package+'/dsh-agent-core'
 pins['operationSourceArchive']=package+'/artifacts/'+opname;pins['operationSourceArchiveSha256']=digest(oldarc)
 pins['artifactPins'][opname].update(sha256=digest(oldarc),bytes=oldarc.stat().st_size)
 for row in list(pins['artifactPins'].values())+[pins['sourceBundle']]:
  for key in ('path','sidecarPath'):
   if key in row and (w/'artifacts'/Path(row[key]).name).exists():row[key]=package+'/artifacts/'+Path(row[key]).name
 if 'sidecarPath' in pins['artifactPins'][opname]:put(w/'artifacts'/Path(pins['artifactPins'][opname]['sidecarPath']).name,(digest(oldarc)+'  '+opname+'\n').encode())
 pins['appSource']['appArchive']=package+'/artifacts/'+Path(pins['appSource']['appArchive']).name
 put(w/'INSTALL-PINS.json',encoded(pins))
 need((w/'SEED-TEMPLATE.UNINSTALLABLE.json').read_bytes()==(oldw/'SEED-TEMPLATE.UNINSTALLABLE.json').read_bytes(),'template payload must be byte-exact')
 cfg=json.loads((stage/'checkpoint-inputs.json').read_bytes());oldcfg=copy.deepcopy(cfg);compat=cfg['oldProducer']['preimageCompatibility']
 need(compat['byteBindingPath']==OLDSNAP+'/preimage-byte-bindings.json','old canonical byte binding')
 compat['byteBindingPath']=snap+'/preimage-byte-bindings.json';compat['journalSha256']=JOURNAL
 compat['currentJournal']=dict(authority='mother7911 section3 authorized operator read surface; existing delegation06426cf2261e32198a22fc6cfeaa32d08d4dc81c51e8ddd9e7ac0d40405b9c57; fixed native readback sha256='+digest(receipt),journalSha256=JOURNAL,origin='AUTHORIZED_OPERATOR_READ_SURFACE_V1',reader='original sole writer via existing delegated authorized native read-only channel (not new human Owner testimony)',utc=utc)
 for k in ('option','oldDisposal'):need(cfg['sources'][k]==oldcfg['sources'][k],'historical source drift')
 put(stage/'checkpoint-inputs.json',encoded(cfg))
 seed=(stage/'seed-materials.mjs').read_text();needle="const PACKAGE='/private/var/db/agent-deploy-system/inputs/b7-install-r33/b7-wired-inputs';"
 need(seed.count(needle)==1,'exact original seed input binding');seed=seed.replace(needle,'const PACKAGE='+repr(package)+';');put(stage/'seed-materials.mjs',seed.encode())
 worker=(stage/'stage-seed-once.py').read_text();oldworker=worker
 mapping=dict(PACKAGE='Path('+repr(package)+')',CANDIDATE='Path('+repr(snap)+')',PINS_SHA=repr(digest(w/'INSTALL-PINS.json')),TEMPLATE_SHA=repr(digest(w/'SEED-TEMPLATE.UNINSTALLABLE.json')),SOURCE_LIST_SHA=repr(digest(w/'SOURCE-CONTENT.sha256')),WORKER_SHA=repr(digest(stage/'seed-materials.mjs')),CHECKPOINT_INPUTS_SHA=repr(digest(stage/'checkpoint-inputs.json')))
 for k,v in mapping.items():worker=rebind_constant(worker,k,v)
 worker=worker.replace(OLDSNAP,snap)
 # No function/class body is allowed to change.
 body=lambda x:[ast.dump(n,include_attributes=False)for n in ast.parse(x).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))]
 need(body(worker)==body(oldworker),'stage business body changed');put(stage/'stage-seed-once.py',worker.encode())
 adapter=json.loads((dest/'packet/STAGE-ADAPTER.json').read_bytes());need(adapter['toSnapshot']==OLDSNAP,'adapter old target');adapter['toSnapshot']=snap
 for row in adapter['rebinds']:
  if row['constant'] in mapping:
   value=ast.literal_eval(mapping[row['constant']][5:-1]) if row['constant'] in ('PACKAGE','CANDIDATE') else ast.literal_eval(mapping[row['constant']]);row['to']=value
 put(dest/'packet/STAGE-ADAPTER.json',encoded(adapter))
 packet=json.loads((dest/'packet/PACKET.json').read_bytes());packet.update(materialRoot=package,snapshotRoot=snap,checkpointInputsSha256=digest(stage/'checkpoint-inputs.json'),stageAdapterContractSha256=digest(dest/'packet/STAGE-ADAPTER.json'));packet['pathOnlyRebinding']['to']=snap
 for row in packet['files']:
  leaf=stage/row['relative'];row.update(sourcePath=formal+'/packet/b7-wired-stage/'+row['relative'],sha256=digest(leaf),bytes=leaf.stat().st_size)
 put(dest/'packet/PACKET.json',encoded(packet));manifest=digest(dest/'packet/PACKET.json');worker_sha=digest(stage/'stage-seed-once.py');operation='b7-packet-r35-'+manifest[:16]+'-'+args.suffix
 execution=(control/'v53_r34_execution_source.py').read_text();new_execution,preintent_proof=append_preintent(execution,args.key,operation)
 def derive(row,execution):
  row['manifestSha256']=manifest;row['reason']='B7_COHERENT_CANDIDATE_R35_ORIGINAL_GUARDS_REQUIRED'
  if execution:
   row.update(files=copy.deepcopy(packet['files']),manifestPath=formal+'/packet/PACKET.json',snapshotRoot=snap,stageArgv=['/usr/bin/python3',snap+'/stage-seed-once.py']);row['terminalBinding']['toolSha256']=NEW_SHA[0]
  else:row['sourceSha256']=worker_sha
  return row
 derived=dest.parent/(args.input_name+'-policy-source-delta');derived.mkdir()
 policy_proofs={}
 for name,methods in [('deployment_system.py',['install_hooks','install_execution_hooks']),('ds_client.py',['install_client_hooks','install_owner_cli'])]:
  old=(control/name).read_text();text=old
  for method in methods:text=append_policy(text,method,OLDKEY,args.key,lambda row,ex=method=='install_execution_hooks':derive(row,ex))
  if name=='deployment_system.py':
   hits=[n for n in ast.walk(ast.parse(text)) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='compile' and n.args and isinstance(n.args[0],ast.Constant) and n.args[0].value==execution]
   need(len(hits)==1,'exact current private execution seal');literal=ast.get_source_segment(text,hits[0].args[0]);need(literal==ascii(execution),'original private seal ASCII')
   before_seal=text;text=text.replace(literal,ascii(new_execution),1);need(text.replace(ascii(new_execution),literal,1)==before_seal,'private sealed whole inverse');put(derived/'v53_r34_execution_source.py',new_execution.encode())
  if name=='ds_client.py':
   hits=[]
   for node in ast.walk(ast.parse(text)):
    if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='compile' and len(node.args)>1 and isinstance(node.args[1],ast.Constant) and node.args[1].value=='<sealed-b7_ds_execution_client.py>':hits.append(node)
   need(len(hits)==1,'single sealed client required');node=hits[0];source=node.args[0].value;need(source.count(OLDKEY)==2,'exact two current-key literals');literal=ast.get_source_segment(text,node.args[0]);need(literal==ascii(source),'original ASCII sealed client representation');replacement=source.replace(OLDKEY,args.key);need(replacement.replace(args.key,OLDKEY)==source,'codec whole inverse');before_codec=text;text=text.replace(literal,ascii(replacement),1);need(text.replace(ascii(replacement),literal,1)==before_codec,'whole client codec span inverse');put(derived/'v50_execution_client_source.py',replacement.encode())
  put(derived/name,text.encode())
  policy_proofs[name]=dict(preimage_sha256=sha(old.encode()),candidate_sha256=sha(text.encode()),methods=methods,each_policy_whole_byte_inverse=True,old_values_exact=True,codec_only_two_key_literals=name=='ds_client.py')
 # Root still must bind publication/executor/prepare/verifier/facts/authority;
 # these policy-source intermediates MUST NOT be published as a ready cohort.
 rows={};changed=[]
 for base,dirs,files in os.walk(dest,followlinks=False):
  for name in sorted(dirs+files):
   path=Path(base)/name;relative=path.relative_to(dest).as_posix();st=path.lstat();row={'mode':stat.S_IMODE(st.st_mode),'uid':st.st_uid,'gid':st.st_gid};original=BASE/relative
   if stat.S_ISLNK(st.st_mode):row.update(type='link',target=os.readlink(path));need(original.is_symlink() and os.readlink(original)==row['target'],'copied source symlink drift')
   elif stat.S_ISDIR(st.st_mode):row.update(type='directory')
   else:
    need(stat.S_ISREG(st.st_mode) and st.st_nlink==1,'owned regular source required');row.update(type='file',bytes=st.st_size,sha256=digest(path))
    if row['sha256']!=digest(original):changed.append(relative)
   rows[relative]=row
 expected={'b7-wired-inputs/'+r for r in ['INSTALL-PINS.json','SOURCE-CONTENT.sha256','artifacts/'+opname]}|{'b7-wired-inputs/dsh-agent-core/'+r for r in TOOLS}|{'packet/'+r for r in ['PACKET.json','STAGE-ADAPTER.json','b7-wired-stage/checkpoint-inputs.json','b7-wired-stage/seed-materials.mjs','b7-wired-stage/stage-seed-once.py']}
 if 'sidecarPath' in pins['artifactPins'][opname]:expected.add('b7-wired-inputs/artifacts/'+Path(pins['artifactPins'][opname]['sidecarPath']).name)
 need(set(changed)==expected,'unexpected/missing package payload delta')
 inventory=dest.parent/(args.input_name+'-FILES.json');put(inventory,encoded(rows))
 result=dict(plan(),built=True,new_key=args.key,new_operation=operation,registered=False,package=str(dest),policy_source_delta=str(derived),policy_proofs=policy_proofs,private_preintent_proof=preintent_proof,packet_manifest_sha256=manifest,worker_sha256=worker_sha,files_manifest_sha256=digest(inventory),changed_members=sorted(changed),tar_readback=tarproof,template_byte_exact=True,app_repacked=False,not_control_cohort=True,remaining='Root original current-baseline authority/executor/prepare/verifier/publication/pin/capsule cascade plus independent review; R35 placement consumes e35 closed/retired/checkpoint proof, never warms old e31 cache; no DS calls')
 put(dest.parent/(args.input_name+'-BUILD-RECEIPT.json'),encoded(result));return result
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--build',action='store_true');p.add_argument('--key');p.add_argument('--input-name');p.add_argument('--suffix');p.add_argument('--journal-receipt');p.add_argument('--journal-receipt-sha256');p.add_argument('--control-root');a=p.parse_args()
 print(json.dumps(build(a) if a.build else plan(),indent=2))
if __name__=='__main__':main()
