"""Nonroot, private candidate assembly. Hashes/provenance are observations, not authority."""
import os, pathlib, subprocess, hashlib, json, shutil, sys
assert os.geteuid()!=0
out=pathlib.Path(sys.argv[1]).resolve(); out.mkdir(mode=0o700)
node=pathlib.Path('/usr/local/libexec/agent-core/node-runtime/bin/node')
final='/usr/local/libexec/agent-core/node-runtime/'
def run(*args):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,check=True)
 return p.stdout
def loads(path):
 lines=run('/usr/bin/otool','-l',str(path)).splitlines(); result=[]
 for n,l in enumerate(lines):
  if l.strip() in ['cmd LC_LOAD_DYLIB','cmd LC_LOAD_WEAK_DYLIB','cmd LC_REEXPORT_DYLIB','cmd LC_LOAD_UPWARD_DYLIB','cmd LC_LAZY_LOAD_DYLIB']:
   result.append(lines[n+2].strip().removeprefix('name ').split(' (')[0])
 return result
def rpaths(path):
 lines=run('/usr/bin/otool','-l',str(path)).splitlines(); result=[]
 for n,l in enumerate(lines):
  if l.strip()=='cmd LC_RPATH': result.append(lines[n+2].strip().removeprefix('path ').split(' (')[0])
 return result
def system(p): return p.startswith('/usr/lib/') or p.startswith('/System/Library/')
files={}; pending=[node]; records=[]
while pending:
 p=pending.pop().resolve()
 if str(p) in files: continue
 assert len(files)<64
 data=p.read_bytes(); assert len(data)<=128*1024*1024
 arch=run('/usr/bin/lipo','-archs',str(p)).strip(); assert arch=='x86_64',(p,arch)
 dest=final+('bin/node' if p==node.resolve() else 'lib/'+p.name)
 edges={}
 for load in loads(p):
  if system(load): continue
  if load.startswith('@rpath/'):
   choices=[p.parent/load.removeprefix('@rpath/'),p.parent.parent/'lib'/load.removeprefix('@rpath/')]
   q=next((c.resolve() for c in choices if c.is_file()),None);assert q,load
  elif load.startswith('@loader_path/'):
   q=(p.parent/load.removeprefix('@loader_path/')).resolve()
  else:
   assert load.startswith('/'),load;q=pathlib.Path(load).resolve()
  if q==p: continue # LC_ID_DYLIB displayed by otool -L
  edges[load]=str(q);pending.append(q)
 files[str(p)]={'source':str(p),'input_sha256':hashlib.sha256(data).hexdigest(),'destination':dest,'arch':arch,'edges':edges,'rpaths':rpaths(p)}
assert len({r['destination'] for r in files.values()})==len(files)
assert sum(pathlib.Path(p).stat().st_size for p in files)<=512*1024*1024
for n,(path,r) in enumerate(sorted(files.items())):
 staged=out/f'image-{n:02}'
 # No root command executes this source or candidate.
 staged.write_bytes(pathlib.Path(path).read_bytes());staged.chmod(0o600)
 assert hashlib.sha256(staged.read_bytes()).hexdigest()==r['input_sha256']
 args=['/usr/bin/install_name_tool']
 for old,target in r['edges'].items(): args+=['-change',old,files[target]['destination']]
 for rp in r['rpaths']: args+=['-delete_rpath',rp]
 if r['destination']!=final+'bin/node':args+=['-id',r['destination']]
 if len(args)>1: run(*args,str(staged))
 run('/usr/bin/codesign','--force','--sign','-',str(staged))
 run('/usr/bin/codesign','--verify','--strict',str(staged))
 assert run('/usr/bin/lipo','-archs',str(staged)).strip()=='x86_64'
 r['blob']=staged.name;r['output_sha256']=hashlib.sha256(staged.read_bytes()).hexdigest();r['size']=staged.stat().st_size
 r['signing']='local ad-hoc structural signature; NOT accepted build/review authority'
 r['post_loads']=loads(staged);r['post_rpaths']=rpaths(staged)
 assert not r['post_rpaths']
 for edge in r['post_loads']: assert system(edge) or edge.startswith(final)
 records.append(r)
(out/'closure.json').write_text(json.dumps({'purpose':'inert transformed candidate only; no execution or activation','records':records},indent=2)+'\n')
print(json.dumps({'files':len(records),'bytes':sum(r['size'] for r in records),'manifest_sha256':hashlib.sha256((out/'closure.json').read_bytes()).hexdigest(),'output':str(out)}))
