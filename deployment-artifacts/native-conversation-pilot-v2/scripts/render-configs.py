#!/usr/bin/env python3
"""Render OFFLINE public configs from the approved owning operation's readback.
This tool does not authenticate a receipt, issue identities, deliver a secret,
write a production path, enable production, or change a Binding.
"""
import argparse
import json
import os
import re
from pathlib import Path
import uuid

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--receipt',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
receipt=json.loads(args.receipt.read_text())
required=('connector_subject','product_principal_id','client_id','attestation_ref','source_binding_ref','auth_contract_digest','auth_runtime_digest','binding_receipt_ref')
if any(not isinstance(receipt.get(k),str) or not receipt[k] for k in required):
    raise SystemExit('Incomplete owning-identity readback; no configuration generated')
for key in ('connector_subject','product_principal_id'):
    uuid.UUID(receipt[key])
if not re.fullmatch(r'[A-Za-z0-9._-]{1,256}',receipt['client_id']):
    raise SystemExit('Client ID is not valid for the fixed MCP loader')
if receipt['connector_subject']==receipt['product_principal_id'] or receipt['product_principal_id'] in ('d5b3aeb2-e754-49a9-9914-b963521c0985','7711a8ed-c538-488b-b569-dcb1253adad8'):
    raise SystemExit('Caller/source identity collision; owning review required')
expected={'resource':'agent-core-mcp-conversation-v1','scope':'conversation.access','agent_id':'agt_build-in-public-agent',
          'target_principal_id':'d5b3aeb2-e754-49a9-9914-b963521c0985','domain_id':'f9b5682c-1c9c-5ace-a7b1-01b9a3be5965',
          'binding_id':'mcp:dot-native-conversation-pilot-v1','runtime_root':'/Users/authsvc/.agent-core',
          'communication_scope_id':'mcp-native-conversation-pilot-v1'}
if any(receipt.get(k)!=v for k,v in expected.items()):
    raise SystemExit('Receipt target/resource/root differs from fixed pilot proposal')
if 'client_secret' in receipt or 'access_token' in receipt:
    raise SystemExit('Public readback must not contain credentials or tokens')
out=Path(os.path.abspath(args.output.expanduser()))
for parent in (out,*out.parents):
    if parent.is_symlink():raise SystemExit('Refusing symlink output ancestor')
for prefix in ('/usr/local/libexec','/usr/local/etc','/Users/authsvc','/Library','/private/var/db','/Users/yanfenma/.config','/Users/yanfenma/.agent-core'):
    if str(out)==prefix or str(out).startswith(prefix+'/'):raise SystemExit('Offline output only')
allowed=Path('/Users/yanfenma/workspace/project/pilot1156-fixed-v2/generated-configs')
if out==allowed or not out.is_relative_to(allowed):
    raise SystemExit('Output must be a new child of the fixed offline generated-configs directory')
os.umask(0o077);out.mkdir(mode=0o700,parents=True,exist_ok=False)
dsh={'enabled':False,'authServiceOrigin':'https://127.0.0.1:4443','retentionMs':604800000,'maxRecords':1000,
     'clients':[{'clientId':receipt['client_id'],'subject_id':receipt['connector_subject'],
       'communication_scope_id':expected['communication_scope_id'],'principal_id':receipt['product_principal_id'],
       'operations':['resolve','send','result'],'targets':[{'agent_id':expected['agent_id'],
        'principal_id':expected['target_principal_id'],'domain_id':expected['domain_id'],
        'binding_id':expected['binding_id'],'routing_version':'1'}]}]}
mcp={'enabled':False,'connector_subject':receipt['connector_subject'],'endpoint':'http://127.0.0.1:8788',
     'credential_file':'native-conversation.client.json','timeout_ms':10000}
for name,value in [('dsh-native-conversation.json',dsh),('native-conversation.json',mcp)]:
    path=out/name;path.write_text(json.dumps(value,indent=2)+'\n');path.chmod(0o600)
(out/'credential-delivery.txt').write_text('The original auth owning executor delivers its issued secret directly to the MCP 0600 credential file. This renderer never handles it.\n')
print(str(out))
