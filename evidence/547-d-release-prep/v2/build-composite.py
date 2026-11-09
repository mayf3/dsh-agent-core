#!/usr/bin/env python3
"""Bounded engineering packaging only. Never executes any payload/installer.
Inputs: observed app bytes + exact six 393 preimages + four literal 95 blobs.
Output: app-only storage artifact, bound to unchanged host Node/Harness closures.
Absolute install links are inventoried, never followed into execution.
"""
import gzip, hashlib, json, os, shutil, stat, subprocess, tarfile
from datetime import datetime, timezone
from pathlib import Path
OUT=Path(__file__).resolve().parent
PRIVATE=OUT/'private-attempt2'
LIVE=Path('/usr/local/libexec/agent-core/app')
BACKUP=Path('/Users/Shared/r129d-rollback-20261108')
REPO=Path('/Users/yanfenma/workspace/project/production-dsh-agent-core')
BASE='393a0afccedc5cce7be8b492c82d68d8d52206f6'
SOURCE='95a8e1cb512fc99dc018209d837250dd51b4d08f'
QA='5360707882b4f85813d842037f660f54fd2496c8'
SIX=json.loads((OUT/'six-file-lineage.json').read_text())['files']
FOUR=[r['path'] for r in SIX if r['path'].startswith('packages/agent-router/')]
assert len(FOUR)==4
ENV={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_NO_LAZY_FETCH':'1'}
def sha(b): return hashlib.sha256(b).hexdigest()
def digest_file(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(1024*1024):h.update(b)
 return h.hexdigest()
def data(rev,p):return subprocess.check_output(['git','-C',str(REPO),'show',rev+':'+p],env=ENV)
def encode(obj):return (json.dumps(obj,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode()
def save(name,obj):
 b=encode(obj);(OUT/name).write_bytes(b);return sha(b)
def manifest(root,coordinates=False):
 rows=[]
 for dp,dirs,files in os.walk(root,followlinks=False):
  for name in sorted(dirs+files):
   p=Path(dp)/name;st=p.lstat();row={'path':p.relative_to(root).as_posix(),'mode':format(stat.S_IMODE(st.st_mode),'04o')}
   if stat.S_ISLNK(st.st_mode): row.update(type='symlink',target=os.readlink(p))
   elif stat.S_ISDIR(st.st_mode):row.update(type='directory')
   elif stat.S_ISREG(st.st_mode):row.update(type='file',bytes=st.st_size,sha256=digest_file(p))
   else:raise ValueError('special file unsupported '+str(p))
   if coordinates:row['read_coordinates']={'dev':st.st_dev,'inode':st.st_ino,'uid':st.st_uid,'gid':st.st_gid,'mtime_ns':st.st_mtime_ns,'ctime_ns':st.st_ctime_ns}
   rows.append(row)
 return sorted(rows,key=lambda r:r['path'])
def persist_manifest(name,rows):
 raw=encode({'format':'path,type,mode,bytes+sha256 or literal symlink target; directories included','entries':rows})
 payload=gzip.compress(raw,mtime=0);(OUT/name).write_bytes(payload)
 return {'path':name,'gzip_sha256':sha(payload),'uncompressed_sha256':sha(raw),'entries':len(rows),'files':sum(r['type']=='file' for r in rows),'file_bytes':sum(r.get('bytes',0) for r in rows),'symlinks':sum(r['type']=='symlink' for r in rows)}
assert not PRIVATE.exists(),'fresh isolated output required'
PRIVATE.mkdir(mode=0o700)
(OUT/'.gitignore').write_text('private/\nprivate-attempt2/\n')
started=datetime.now(timezone.utc).isoformat()
try:
 live_before=manifest(LIVE,True)
 assert all((LIVE/p).read_bytes()==data('08102a550cf2f5e14646c6858786d7fe7a50c61d',p) for p in [r['path'] for r in SIX])
 foundation=PRIVATE/'foundation-393-reconstructed'/'app'
 shutil.copytree(LIVE,foundation,symlinks=True)
 # Reconstruct only the six authenticated old source preimages; preserve every
 # other observed installed byte. This is NOT an authenticated historical backup.
 for r in SIX:
  p=r['path'];original=(BACKUP/p.replace('/','_')).read_bytes()
  assert original==data(BASE,p),p+' preimage mismatch'
  (foundation/p).write_bytes(original)
 old_provenance=(BACKUP/'pack-provenance.json').read_bytes()
 old=json.loads(old_provenance)
 assert old['source_head_sha']==BASE
 (foundation/'pack-provenance.json').write_bytes(old_provenance)
 base_rows=manifest(foundation)
 candidate=PRIVATE/'candidate-d-router-393-plus-95'/'app'
 shutil.copytree(foundation,candidate,symlinks=True)
 for p in FOUR:
  source=data(SOURCE,p)
  assert sha(source)==next(r['sha256'][SOURCE] for r in SIX if r['path']==p)
  (candidate/p).write_bytes(source)
 provenance={**old,'source_model':'COMPOSITE_ENGINEERING_CANDIDATE_NOT_INSTALL_ADMITTED','source_head_sha':SOURCE,'source_tree_sha':None,'source_clean':'NOT_APPLICABLE_FIXED_BLOBS_AND_OBSERVED_FOUNDATION','generation_label_sha':None,'source_label_matches_pack_input':'NOT_APPLICABLE_COMPOSITE','overlay_base_commit':BASE,'overlay_blob_provider_commit':SOURCE,'overlay_files':[{'path':p,'sha256':digest_file(candidate/p)} for p in FOUR],'packed_app_tree_sha256':None,'packed_app_tree_sha256_note':'exact complete post-dependency manifest and archive digest are external in candidate-pin.json; no recursive self digest','foundation_note':'observed installed app minus six hash-verified original source preimages and restored original base provenance; not proof of historical dependency identity or a complete historical rollback backup','source_head_sha_note':'four named D blobs only; not a claim that the whole app is main95','mechanism_qa_basis':QA,'installation_authority':'NONE_IN_THIS_TASK'}
 (candidate/'pack-provenance.json').write_bytes(encode(provenance))
 cand_rows=manifest(candidate)
 def comparable(rows):return {r['path']:r for r in rows}
 a,b=comparable(base_rows),comparable(cand_rows)
 delta=[{'path':p,'before':a.get(p),'after':b.get(p),'why':'D narrow legacy read/quarantine/write guard from fixed95' if p in FOUR else 'truthful composite provenance'} for p in sorted(set(a)|set(b)) if a.get(p)!=b.get(p)]
 assert {r['path'] for r in delta}==set(FOUR)|{'pack-provenance.json'},'unexpected candidate delta'
 # Literal install symlinks may resolve in production; no payload code is run.
 link_rows=[r for r in cand_rows if r['type']=='symlink']
 for r in link_rows:
  p=candidate/r['path'];target=r['target']
  install_target=Path(target) if os.path.isabs(target) else (LIVE/r['path']).parent/target
  assert install_target.exists(),'missing declared install binding '+r['path']
  assert install_target.resolve().is_relative_to(Path('/usr/local/libexec/agent-core')),'install link escapes bound closure'
  if os.path.isabs(target):assert target.startswith('/usr/local/libexec/agent-core/app/'),'external absolute install link'
 node_root=Path('/usr/local/libexec/agent-core/node-runtime')
 harness_root=Path('/usr/local/libexec/agent-core/harness')
 node_before=manifest(node_root,True);harness_before=manifest(harness_root,True)
 binding_node=persist_manifest('node-runtime-manifest.json.gz',node_before)
 binding_harness=persist_manifest('harness-manifest.json.gz',harness_before)
 artifact=PRIVATE/'candidate-d-router-393-plus-95.tgz'
 with artifact.open('wb') as out:
  with gzip.GzipFile(filename='',mode='wb',fileobj=out,mtime=0) as gz:
   with tarfile.open(fileobj=gz,mode='w') as tf:
    for p in [candidate]+sorted(candidate.rglob('*')):
     arc='app' if p==candidate else 'app/'+p.relative_to(candidate).as_posix()
     info=tf.gettarinfo(str(p),arcname=arc);info.uid=0;info.gid=0;info.uname='';info.gname='';info.mtime=0
     if info.isfile():
      with p.open('rb') as f:tf.addfile(info,f)
     else:tf.addfile(info)
 # Independently read archive members and verify byte/type/link completeness.
 with tarfile.open(artifact,'r:gz') as tf:
  members=tf.getmembers();assert len({m.name for m in members})==len(members),'duplicate archive members'
  expected={'app/'+r['path']:r for r in cand_rows}
  assert {m.name for m in members}==set(expected)|{'app'}
  for m in members:
   if m.name=='app':assert m.isdir();continue
   r=expected[m.name];assert format(m.mode,'04o')==r['mode']
   if r['type']=='file':assert m.isfile() and sha(tf.extractfile(m).read())==r['sha256']
   elif r['type']=='symlink':assert m.issym() and m.linkname==r['target']
   else:assert m.isdir()
 assert live_before==manifest(LIVE,True),'live app changed during capture'
 assert node_before==manifest(node_root,True),'Node closure changed during pin'
 assert harness_before==manifest(harness_root,True),'Harness closure changed during pin'
 assert cand_rows==manifest(candidate),'isolated candidate changed during archive'
 base_pin=persist_manifest('reconstructed-foundation-manifest.json.gz',base_rows)
 candidate_pin=persist_manifest('candidate-manifest.json.gz',cand_rows)
 live_map={r['path']:{k:v for k,v in r.items() if k!='read_coordinates'} for r in live_before}
 current_delta=[{'path':p,'installed':live_map.get(p),'candidate':b.get(p)} for p in sorted(set(live_map)|set(b)) if live_map.get(p)!=b.get(p)]
 save('candidate-delta.json',{'base':BASE,'blob_provider':SOURCE,'scope':'complete app tree, including dependencies, file modes and literal symlink targets','reconstructed_foundation_delta':delta,'relative_current_overlay_delta':current_delta,'note':'candidate keeps Scheduler393; current081 includes two extra424 lineage Scheduler changes. Do not install this artifact over current081 under the old393 precondition.'})
 save('candidate-symlinks.json',{'execution':'NOT_EXECUTED','literal_install_links_preserved':link_rows,'note':'absolute @agent-core links address the existing production destination; this storage artifact must not be executed in place. Harness bridge requires exact external binding.'})
 pin={'schema_version':2,'status':'ISOLATED_COMPOSITE_PINNED_NOT_INSTALL_ADMITTED','started_at':started,'ended_at':datetime.now(timezone.utc).isoformat(),'artifact_type':'app-only composite; unchanged Node/Harness bound externally, no config/home/credentials/state','base_commit':BASE,'D_blob_provider_commit':SOURCE,'D_paths':FOUR,'source_not_whole_main95':True,'artifact':{'path':str(artifact),'bytes':artifact.stat().st_size,'sha256':digest_file(artifact)},'candidate_manifest':candidate_pin,'reconstructed_foundation_manifest':base_pin,'runtime_bindings':{'node':{'root':str(node_root),'version':subprocess.check_output([str(node_root/'bin/node'),'--version'],env={**os.environ,'NODE_DISABLE_COMPILE_CACHE':'1'}).decode().strip(),'binary_sha256':digest_file(node_root/'bin/node'),'manifest':binding_node},'harness':{'root':str(harness_root),'manifest':binding_harness}},'verified':['full archive file/member/mode/link/digest readback','four literal95 blob identities','only four source paths plus provenance changed versus reconstructed foundation','live app and bound runtime closures byte/coordinate-stable across assembly','isolated output unchanged after archive'],'limitations':['Foundation is reconstructed from installed bytes and verified six source preimages, not a qualified historical full393 backup.','Source composition is explicit; no claim of whole-main95 package or trusted build-issuer admission.','Existing literal install links preclude executing candidate tree in place. No payload, constructor, installer, startup or shutdown was executed.','Current observed081 contains same four Router bytes and two Scheduler fixes. Candidate differs there; baseline393 precondition is not met.','No production install, loaded-byte proof, drain execution, rollback execution, or business acceptance.'],'operation_allowed':False,'production_writes':0}
 save('candidate-pin.json',pin)
 print(json.dumps({'status':pin['status'],'artifact_sha256':pin['artifact']['sha256'],'bytes':pin['artifact']['bytes'],'delta_paths':[r['path'] for r in delta],'current_delta_paths':[r['path'] for r in current_delta]}))
except Exception as e:
 save('build-stopped.json',{'at':datetime.now(timezone.utc).isoformat(),'status':'STOPPED','error':str(e),'production_writes':0,'installer_executed':False})
 raise
