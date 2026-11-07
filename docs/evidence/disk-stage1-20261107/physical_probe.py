#!/usr/bin/env python3
"""Read-only Darwin getattrlist and stat probe. No data file content is opened."""
import ctypes, errno, json, os, stat, struct, sys, datetime
from pathlib import Path
class AttrList(ctypes.Structure):
    _fields_=[('bitmapcount',ctypes.c_uint16),('reserved',ctypes.c_uint16),('commonattr',ctypes.c_uint32),('volattr',ctypes.c_uint32),('dirattr',ctypes.c_uint32),('fileattr',ctypes.c_uint32),('forkattr',ctypes.c_uint32)]
lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib',use_errno=True)
lib.getattrlist.argtypes=[ctypes.c_char_p,ctypes.POINTER(AttrList),ctypes.c_void_p,ctypes.c_size_t,ctypes.c_ulong]
def attrs(path):
    a=AttrList(5,0,0x80000000,0,0,0,0x1308)
    b=ctypes.create_string_buffer(128)
    rc=lib.getattrlist(os.fsencode(path),ctypes.byref(a),b,len(b),0x29)
    if rc:
        e=ctypes.get_errno();return {'status':errno.errorcode.get(e,str(e)),'errno':e}
    length,*maps=struct.unpack_from('<I5I',b.raw)
    bits=maps[4];pos=24;v={'status':'OK','returned_fork_mask':hex(bits),'length':length}
    for name,bit,fmt in [('private_bytes',8,'q'),('clone_id',0x100,'Q'),('extended_flags',0x200,'Q'),('clone_refcount',0x1000,'I')]:
        value=struct.unpack_from('<'+fmt,b.raw,pos)[0];pos+=struct.calcsize(fmt)
        v[name]=value if bits&bit else None
    return v
def probe(path):
    try:
        s=os.lstat(path)
        return {'path':str(path),'dev':s.st_dev,'inode':s.st_ino,'nlink':s.st_nlink,'logical_bytes':s.st_size,'allocated_bytes':s.st_blocks*512,'mtime_utc':datetime.datetime.fromtimestamp(s.st_mtime,datetime.timezone.utc).isoformat(),'birthtime_utc':datetime.datetime.fromtimestamp(s.st_birthtime,datetime.timezone.utc).isoformat(),'stat_flags':s.st_flags,'attr':attrs(path)}
    except OSError as e:return {'path':str(path),'status':'PERMISSION_DENIED' if e.errno in (1,13) else errno.errorcode.get(e.errno,str(e.errno))}
if __name__=='__main__':
    print(json.dumps({'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only':True,'method':'lstat + getattrlist FSOPT_NOFOLLOW|PACK_INVAL_ATTRS|ATTR_CMN_EXTENDED (0x29), CMNEXT 0x1308','files':[probe(p) for p in sys.argv[1:]]},indent=2))
