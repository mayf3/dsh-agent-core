"""Offline fixed candidate composition, never imports/executes host service."""
import ast
import base64
import gzip
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).parent
BASE = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG')
PRIOR = BASE/'p0-travel-terminal-readback-20260928-v14'
OUT = BASE/'HR-CTO-OWNER-SENDER-FIXED-READBACK-20260928-v1'
DS_SHA = 'daeb44fc0c23a7a2949519a5d6abcc9459e38936e10bc704d85b25794f7a74d6'
SHIM_SHA = '5661fbd0c7fde5139b10cb1adf9546a1ce507e413d89177b821ddd683146d7f8'
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def checked(path, digest):
    raw = path.read_bytes()
    assert sha(raw) == digest, str(path)
    return raw


def literal(source, name):
    node = next(n for n in ast.parse(source).body if isinstance(n, ast.Assign)
                and isinstance(n.targets[0], ast.Name) and n.targets[0].id == name)
    return ast.literal_eval(node.value)


def function(source, name):
    node = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == name)
    return ''.join(source.splitlines(True)[node.lineno-1:node.end_lineno])


def main():
    base = checked(PRIOR/'artdir/deployment_system.py', DS_SHA)
    checked(PRIOR/'shim-artdir/deploy_shim.py', SHIM_SHA)
    source = base.decode()
    original_bundle = gzip.decompress(base64.b64decode(literal(source, 'ROUTER_INGRESS_BUNDLE_GZIP_B64')))
    assert sha(original_bundle) == literal(source, 'ROUTER_INGRESS_BUNDLE_SHA')
    marker = b'// Appended only after the exact frozen capacity, correlation and V3 validator'
    assert original_bundle.count(marker) == 1
    prefix = original_bundle.split(marker)[0]
    bundle = prefix + (HERE/'cto_projection.mjs').read_bytes()
    select = function(source, 'router_ingress_verified_select')
    select = select.replace('def router_ingress_verified_select(', 'def hr_cto_verified_select(')
    select = select.replace('ROUTER_INGRESS_BUNDLE_SHA', 'HR_CTO_BUNDLE_SHA')
    select = select.replace('ROUTER_INGRESS_BUNDLE_GZIP_B64', 'HR_CTO_BUNDLE_GZIP_B64')
    addition = '\nHR_CTO_BUNDLE_SHA = '+repr(sha(bundle))+'\n'
    addition += 'HR_CTO_BUNDLE_GZIP_B64 = '+repr(base64.b64encode(gzip.compress(bundle,mtime=0)).decode())+'\n'
    addition += select+'\n\n'+(HERE/'cto_action.py').read_text()+'\n\n'
    source = source.replace('def handle(raw, peer=None):', addition+'def handle(raw, peer=None):',1)
    source = source.replace('        allowed = {', '        allowed = {\n            "HR_CTO_OWNER_SENDER_HASH_READBACK_V1": {"action", "operation_id", "feishu_message_id"},',1)
    anchor = '        if action in ("P0_TRAVEL_TERMINAL_READBACK_V1","P0_TRAVEL_TERMINAL_READBACK_STATUS_V1"):'
    assert source.count(anchor)==1
    source = source.replace(anchor,'        if action == "HR_CTO_OWNER_SENDER_HASH_READBACK_V1":\n            return hr_cto_hash_readback(request, peer, raw), None\n'+anchor,1)
    for folder in ('artdir','rollback-artdir','evidence'):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    (OUT/'artdir/deployment_system.py').write_text(source)
    (OUT/'rollback-artdir/deployment_system.py').write_bytes(base)
    (OUT/'cto-bundle.mjs').write_bytes(bundle)
    (OUT/'PARSER-PINS.json').write_text(json.dumps({
        'prefixSha256':sha(prefix),'inheritedBundleSha256':sha(original_bundle),
        'ctoBundleSha256':sha(bundle),'storeFixedPath':'/Users/authsvc/.agent-core/control/turn-recovery-v3.json',
        'runtimeUid':505,'runtimeGid':601,
        'inheritedPins':{key:literal(source,key) for key in ('ROUTER_INGRESS_VALIDATOR_SHA','ROUTER_INGRESS_CORRELATION_SHA','ROUTER_CAPACITY_SHA','ROUTER_NODE_SHA')},
        'liveVerified':False},indent=2)+'\n')
    import packet
    import sys
    packet.prepare(sys.modules[__name__], source.encode())
    print(json.dumps({'dsSha256':sha(source.encode()),'size':len(source.encode()),'nativeIdBound':False}))


if __name__ == '__main__':main()
