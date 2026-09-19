"""Exact P4R15R4 retained-state preservation for one reviewed recovery successor."""
if __name__ == "__main__": raise SystemExit("imported only by exact reviewed operator")
from bind_records import _object
import json
from first_live_io import digest, require
import first_live_package as layout

P4R15_PACKAGE="a13c473f77cd894c868524b2d77442c106669d756aff67d0aba788e812c26918"
P4R15_EXECUTION="first-live-dsh-20260918-01-p4r15-recovery-successor"

def _directory(io,path,expected,code="P4R15_DIRECTORY_BINDING"):
    value=io.metadata(path);require(value["type"]=="Directory",code+":type")
    for key in ("uid","gid","mode","flags","device","inode"):
        if key in expected:require(value[key]==expected[key],code+":"+key)
    if "names" in expected:require(io.call(["/bin/ls","-1A",path]).decode().splitlines()==expected["names"],code+":names")
    return value

def _protected(io,path,spec,code="P4R15_PROTECTED"):
    before=io.expect(path,spec);raw=io.call(["/bin/cat",path],expected_digest=spec["sha256"])
    require(io.metadata(path)==before,code+":changed");return raw

def _archived(io,path,spec,code="P4R15_ARCHIVE"):
    # A same-filesystem rename preserves the object but changes ctime on macOS.
    stable={key:value for key,value in spec.items() if key != "ctime"}
    return _protected(io,path,stable,code)


def _write(io,path,value):
    raw=json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False).encode();io.copy(raw,digest(raw),"0400",path)

def reconcile(io,raw):
    r=_object(raw,16*1024*1024)
    required={"version","state","operation_id","execution_id","package_sha256","operation_directory","operation_files","maintenance_name","maintenance_directory","first_live_pending","packet_directory","packet_names","payload_names","staging_files","installed_files","socket_directory","legacy_ancestor","legacy_locks","p4r14_history","retry_forbidden","failure_code","failure_sha256"}
    require(set(r)==required and r["version"]==1 and r["state"]=="P4R15R4_RETAINED_FILESYSTEM_IO_STOP" and r["operation_id"]==layout.OPERATION and r["execution_id"]==P4R15_EXECUTION and r["package_sha256"]==P4R15_PACKAGE and r["retry_forbidden"] is True and r["failure_code"]=="FILESYSTEM_IO" and r["operation_files"]["failure.json"]["sha256"]==r["failure_sha256"],"P4R15_RECONCILIATION_BINDING")
    for path in (layout.P4R15R4_OPERATION_ARCHIVE,layout.P4R15R4_PACKET_ARCHIVE,layout.P4R15R4_PENDING_ARCHIVE,layout.P4R16_RECONCILIATION):require(io.metadata(path,absent=True) is None,"P4R15_ARCHIVE_ALREADY_PRESENT")
    _directory(io,layout.ROOT+"/first-live-operation",r["operation_directory"])
    require(set(r["operation_files"])==set(r["operation_directory"]["names"])-{r["maintenance_name"]},"P4R15_OPERATION_FILE_SET")
    for name,spec in r["operation_files"].items():_protected(io,layout.ROOT+"/first-live-operation/"+name,spec)
    maintenance=layout.ROOT+"/first-live-operation/"+r["maintenance_name"]
    _directory(io,maintenance,r["maintenance_directory"],"P4R15_MAINTENANCE")
    require(io.call(["/bin/ls","-1A",maintenance])==b"","P4R15_MAINTENANCE_NOT_EMPTY")
    _protected(io,layout.ROOT+"/first-live-pending.json",r["first_live_pending"])
    ancestor=_directory(io,layout.LEGACY_ANCESTOR,r["legacy_ancestor"],"P4R15_ANCESTOR");require(ancestor["flags"]==0x20000,"P4R15_FENCE_NOT_RETAINED")
    require(set(r["legacy_locks"])=={layout.LEGACY_DEPLOY_LOCK,layout.LEGACY_TRANSACTION_LOCK},"P4R15_LOCK_SET")
    for path,value in r["legacy_locks"].items():
        _directory(io,path,value["directory"],"P4R15_LOCK_DIRECTORY");require(value["directory"]["names"]==[value["holder_name"]],"P4R15_LOCK_CONTENTS");_protected(io,path+"/"+value["holder_name"],value["holder"],"P4R15_LOCK_HOLDER")
    history=r["p4r14_history"]
    _directory(io,layout.P4R14_OPERATION_ARCHIVE,history["operation_directory"],"P4R14_HISTORY_OPERATION")
    _directory(io,layout.P4R14_PACKET_ARCHIVE,history["packet_directory"],"P4R14_HISTORY_PACKET")
    _protected(io,layout.P4R14_PENDING_ARCHIVE,history["pending"],"P4R14_HISTORY_PENDING")
    _protected(io,layout.P4R15_RECONCILIATION+"/complete.json",history["reconciliation_complete"],"P4R14_HISTORY_RECONCILIATION")
    _directory(io,layout.PACKET,r["packet_directory"]);require(io.call(["/bin/ls","-1A",layout.PACKET]).decode().splitlines()==r["packet_names"],"P4R15_PACKET_SHAPE");require(io.call(["/bin/ls","-1A",layout.PACKET+"/payloads"]).decode().splitlines()==r["payload_names"],"P4R15_PAYLOAD_SHAPE")
    for rel,spec in r["staging_files"].items():_protected(io,layout.PACKET+"/"+rel,spec)
    require(set(r["installed_files"])=={"agent-deployd","agent-deploy-issuer","agent-deployctl"},"P4R15_INSTALLED_SET")
    for name,spec in r["installed_files"].items():_protected(io,layout.CODE+"/"+name,spec)
    _directory(io,layout.SOCKET,r["socket_directory"],"P4R15_SOCKET");require(r["socket_directory"]["names"]==[],"P4R15_SOCKET_NOT_EMPTY")
    io.call(["/bin/mkdir","-m","0700",layout.P4R16_RECONCILIATION])
    intent={"version":1,"operation_id":layout.OPERATION,"predecessor_execution_id":P4R15_EXECUTION,"predecessor_package_sha256":P4R15_PACKAGE,"record_sha256":digest(raw),"state":"RECONCILIATION_INTENT"}
    _write(io,layout.P4R16_RECONCILIATION+"/intent.json",intent)
    io.call(["/bin/mv",layout.ROOT+"/first-live-pending.json",layout.P4R15R4_PENDING_ARCHIVE]);_write(io,layout.P4R16_RECONCILIATION+"/pending-archive-result.json",{**intent,"state":"PENDING_ARCHIVED"})
    io.call(["/bin/mv",layout.ROOT+"/first-live-operation",layout.P4R15R4_OPERATION_ARCHIVE]);_write(io,layout.P4R16_RECONCILIATION+"/operation-archive-result.json",{**intent,"state":"OPERATION_ARCHIVED"})
    io.call(["/bin/mv",layout.PACKET,layout.P4R15R4_PACKET_ARCHIVE]);_write(io,layout.P4R16_RECONCILIATION+"/packet-archive-result.json",{**intent,"state":"PACKET_ARCHIVED"});io.call(["/bin/sync"])
    for path in (layout.ROOT+"/first-live-pending.json",layout.ROOT+"/first-live-operation",layout.PACKET):require(io.metadata(path,absent=True) is None,"P4R15_ACTIVE_PATH_RETAINED")
    _directory(io,layout.P4R15R4_OPERATION_ARCHIVE,r["operation_directory"]);_archived(io,layout.P4R15R4_PENDING_ARCHIVE,r["first_live_pending"]);_directory(io,layout.P4R15R4_PACKET_ARCHIVE,r["packet_directory"]);_archived(io,layout.P4R15R4_PACKET_ARCHIVE+"/packet.json",r["staging_files"]["packet.json"])
    _write(io,layout.P4R16_RECONCILIATION+"/complete.json",{**intent,"state":"P4R15R4_RETAINED_STATE_ARCHIVED"})
