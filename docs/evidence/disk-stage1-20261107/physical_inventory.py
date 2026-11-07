#!/usr/bin/env python3
"""Metadata-only candidate census. Writes only its explicit receipt output."""
import sys
sys.dont_write_bytecode=True
import os,stat,json,datetime,heapq,importlib.util,errno
from pathlib import Path
spec=importlib.util.spec_from_file_location('physical_probe',Path(__file__).with_name('physical_probe.py'))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def scan(root):
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();seen={};errors=[];top=[];clones={};counts={};agg={'regular_files':0,'unique_regular_inodes':0,'logical_bytes_unique':0,'allocated_bytes_unique':0,'private_bytes_nlink1':0,'private_bytes_all_links_in_root':0,'hardlink_inodes':0,'clone_refcount_gt1_files':0,'attr_unsupported_files':0,'nonregular_allocated_bytes':0}
    def error(path,e): errors.append({'path':str(path),'status':'PERMISSION_DENIED' if e.errno in (1,13) else errno.errorcode.get(e.errno,str(e.errno)),'errno':e.errno})
    stack=[root]
    rootdev=None
    try:rootdev=os.lstat(root).st_dev
    except OSError as e:error(root,e)
    while stack:
        path=stack.pop()
        try:s=os.lstat(path)
        except OSError as e:error(path,e);continue
        if s.st_dev != rootdev:continue
        if stat.S_ISDIR(s.st_mode):
            agg['nonregular_allocated_bytes']+=s.st_blocks*512
            try:
                with os.scandir(path) as entries: stack.extend(e.path for e in entries)
            except OSError as e:error(path,e)
            continue
        if not stat.S_ISREG(s.st_mode):
            agg['nonregular_allocated_bytes']+=s.st_blocks*512;continue
        agg['regular_files']+=1;key=(s.st_dev,s.st_ino);counts[key]=counts.get(key,0)+1
        if key in seen:continue
        a=mod.attrs(path);seen[key]=(s.st_nlink,a.get('private_bytes'))
        agg['unique_regular_inodes']+=1;agg['logical_bytes_unique']+=s.st_size;agg['allocated_bytes_unique']+=s.st_blocks*512
        if s.st_nlink>1:agg['hardlink_inodes']+=1
        if a.get('private_bytes') is None:agg['attr_unsupported_files']+=1
        elif s.st_nlink==1:agg['private_bytes_nlink1']+=a['private_bytes']
        if (a.get('clone_refcount') or 0)>1:
            agg['clone_refcount_gt1_files']+=1
            k=(s.st_dev,a['clone_id']);g=clones.setdefault(k,{'device':s.st_dev,'clone_id':a['clone_id'],'observed_inode_count':0,'reported_clone_refcount':a['clone_refcount'],'allocated_bytes_one':s.st_blocks*512,'samples':[]});g['observed_inode_count']+=1
            if len(g['samples'])<2:g['samples'].append(path)
        row={'path':path,'logical_bytes':s.st_size,'allocated_bytes':s.st_blocks*512,'dev':s.st_dev,'inode':s.st_ino,'nlink':s.st_nlink,'attr':a}
        item=(s.st_blocks*512,path,row)
        if len(top)<12:heapq.heappush(top,item)
        elif item[:2]>top[0][:2]:heapq.heapreplace(top,item)
    for key,(nlink,private) in seen.items():
        if counts[key]==nlink and private is not None:agg['private_bytes_all_links_in_root']+=private
    return {'path':root,'started_at':started,'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aggregate':agg,'errors':errors,'largest_files':[r for _,_,r in sorted(top,reverse=True)],'clone_groups_top20':sorted(clones.values(),key=lambda x:x['allocated_bytes_one']*x['observed_inode_count'],reverse=True)[:20],'interpretation':'private bytes is metadata estimate for unshared data; nlink and open handles/snapshot/time drift still gate actual release; candidate authorization is separate; union-clone final-link release may exceed private sum; no file content read'}
if __name__=='__main__':
    source=Path(sys.argv[1]);output=Path(sys.argv[2]);roots=json.loads(source.read_text());rows=[]
    for root in roots:
        row=scan(root);rows.append(row);output.write_text(json.dumps({'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'roots':rows},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'path':root,**row['aggregate'],'errors':len(row['errors'])}),flush=True)
