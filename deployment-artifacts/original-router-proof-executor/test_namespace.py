"""Actual cached namespace method; all target OS/process calls are doubles."""
import ast,linecache,os,stat,subprocess,types,unittest
from pathlib import Path
from unittest.mock import patch
SOURCE=Path(__file__).with_name('driver.py').read_text()
OWN=Path(__file__).read_text()
linecache.cache[__file__]=(len(OWN),None,OWN.splitlines(True),__file__)
FLAGS={k:getattr(os,k) for k in ('O_RDONLY','O_DIRECTORY','O_NOFOLLOW')}
PATH='/private/var/db/agent-deploy-system/hr-original-proof-executor'
PARENT='/private/var/db/agent-deploy-system'
class FakeOS:
 def __init__(self,overrides=None,opened_race=None,trace_race=None):
  self.overrides=overrides or {};self.opened_race=opened_race;self.trace_race=trace_race
  self.fds={};self.serial=10;self.closed=[];self.walked=False
  for k,v in FLAGS.items():setattr(self,k,v)
 def metadata(self,path,drift=False):
  mode,gid,uid=self.overrides.get(path,(0o770,80,0) if path==PARENT else (0o755,0,0))
  return types.SimpleNamespace(st_dev=1,st_ino=sum(path.encode())+(10000 if drift else 0),st_uid=uid,st_gid=gid,st_mode=stat.S_IFDIR|mode,st_nlink=2,st_mtime_ns=1,st_ctime_ns=1)
 def open(self,name,flags,dir_fd=None):
  path=name if dir_fd is None else self.fds[dir_fd].rstrip('/')+'/'+name
  if dir_fd is not None and not flags&FLAGS['O_NOFOLLOW']:raise AssertionError('FOLLOWING_OPEN')
  self.serial+=1;self.fds[self.serial]=path
  if path==PATH:self.walked=True
  return self.serial
 def close(self,fd):self.closed.append(fd)
 def fstat(self,fd):return self.metadata(self.fds[fd],self.fds[fd]==self.opened_race)
 def stat(self,name,dir_fd=None,follow_symlinks=True):
  if follow_symlinks:raise AssertionError('FOLLOWING_STAT')
  path=name if dir_fd is None else self.fds[dir_fd].rstrip('/')+'/'+name
  return self.metadata(path,self.walked and path==self.trace_race)
class Namespace(unittest.TestCase):
 def setUp(self):
  self.denied=[];self.guards=[]
  def deny(*a,**kw):self.denied.append('host');raise AssertionError('HOST_FORWARDING_DENIED')
  for name in ('open','stat','fstat','close','chmod','chown','mkdir','readlink'):
   guard=patch.object(os,name,deny);guard.start();self.guards.append(guard)
  guard=patch.object(subprocess,'Popen',deny);guard.start();self.guards.append(guard)
  function=next(n for n in ast.parse(SOURCE).body if isinstance(n,ast.FunctionDef) and n.name=='_namespace_directory')
  self.code=compile(ast.Module(body=[function],type_ignores=[]),'<namespace-memory>','exec')
 def tearDown(self):
  self.assertEqual(self.denied,[])
  for guard in reversed(self.guards):guard.stop()
 def invoke(self,fake,path=PATH):
  def require(value,reason):
   if not value:raise ValueError(reason)
  scope={'os':fake,'stat':stat,'require':require};exec(self.code,scope)
  return scope['_namespace_directory'](path)
 def test_existing_fixed_parent_accepts_without_permission_change(self):
  fake=FakeOS();fd=self.invoke(fake);self.assertEqual(fake.fds[fd],PATH);self.assertNotIn(fd,fake.closed)
 def test_existing_proof_directory_same_fixed_parent(self):
  path=PARENT+'/hr-s256-deployment-proof';fake=FakeOS();fd=self.invoke(fake,path)
  self.assertEqual(fake.fds[fd],path)
  self.assertEqual(set(fake.closed),set(fake.fds)-{fd})
 def test_failed_lookup_closes_every_owned_directory(self):
  fake=FakeOS(opened_race=PARENT)
  with self.assertRaises(ValueError):self.invoke(fake)
  self.assertEqual(set(fake.closed),set(fake.fds))
 def test_wrong_parent_gid_mode_owner_reject(self):
  for value in ((0o770,0,0),(0o777,80,0),(0o775,80,0),(0o770,80,505)):
   with self.subTest(value=value),self.assertRaises(ValueError):self.invoke(FakeOS({PARENT:value}))
 def test_other_group_writable_directory_rejects(self):
  with self.assertRaises(ValueError):self.invoke(FakeOS({'/private/var/db':(0o770,80,0)}))
 def test_wrong_sibling_path_not_ds_parent_exemption(self):
  path='/private/var/db/not-agent-deploy-system'
  with self.assertRaises(ValueError):self.invoke(FakeOS({path:(0o770,80,0)}),path+'/child')
 def test_open_inode_and_completed_trace_drift_reject(self):
  for fake in (FakeOS(opened_race=PARENT),FakeOS(trace_race=PARENT)):
   with self.subTest(race=bool(fake.opened_race)),self.assertRaises(ValueError):self.invoke(fake)
 def test_untrusted_child_rejects(self):
  with self.assertRaises(ValueError):self.invoke(FakeOS({PATH:(0o770,80,0)}))
if __name__=='__main__':unittest.main(failfast=True)
