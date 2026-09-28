"""Exact offline operation adapter; all original leases/guards inherited."""
import ast
import json
from pathlib import Path

CLIENT_SHA = '88505ceb28ef360e01777ae128a4bf2b8cc92002f35428014c4c6163e1a3c76c'
IDS = {name:'hr-cto-'+name+'-20260928-54b0945f' for name in
       ('ds-install','ds-restore','shim-install','shim-restore')}


def prepare(build, ds):
    here, out = build.HERE, build.OUT
    ds_digest = build.sha(ds)
    shim_raw = build.checked(build.PRIOR/'shim-artdir/deploy_shim.py',build.SHIM_SHA)
    shim = shim_raw.decode()
    node = next(n for n in ast.parse(shim).body if isinstance(n,ast.FunctionDef) and n.name=='_binding_update_pair')
    pairs = next(n for n in ast.walk(node) if isinstance(n,ast.List))
    values = ast.literal_eval(pairs)
    values.extend([(IDS['ds-install'],build.DS_SHA,ds_digest),
                   (IDS['ds-restore'],ds_digest,build.DS_SHA)])
    old = build.function(shim,'_binding_update_pair')
    replacement = "HR_CTO_UPDATE_REQUEST_SHA256 = None\n\ndef _binding_update_pair(operation_id,preimage,candidate):\n"
    replacement += '    if operation_id in '+repr((IDS['ds-install'],IDS['ds-restore']))+':\n'
    replacement += "        require(HR_CTO_UPDATE_REQUEST_SHA256 is not None, 'NATIVE_MESSAGE_ID_UNBOUND')\n"
    replacement += '    require((operation_id,preimage,candidate) in '+repr(values)+",'FIXED_TERMINAL_DIAGNOSTIC_PAIR_REQUIRED')\n"
    shim = shim.replace(old,replacement,1)
    size_marker = "            '"+build.DS_SHA+"': 110215851,"
    assert shim.count(size_marker)==1
    shim = shim.replace(size_marker,size_marker+'\n            '+repr(ds_digest)+': '+str(len(ds))+',',1)
    for folder in ('shim-artdir','shim-rollback-artdir','client-artdir'):
        (out/folder).mkdir(exist_ok=True)
    (out/'shim-artdir/deploy_shim.py').write_text(shim)
    (out/'shim-rollback-artdir/deploy_shim.py').write_bytes(shim_raw)
    client_path=build.BASE/'coherent-v5-ds-update-prep-20260926-v1/artdir/ds_client.py'
    client = build.checked(client_path,CLIENT_SHA).decode()
    client = client.replace('def main():',(here/'client_action.py').read_text()+'\n\ndef main():',1)
    client = client.replace('    sub.add_parser("status")','    sub.add_parser("status")\n    sub.add_parser("hr-cto-owner-sender-hash-readback")',1)
    client = client.replace('    if args.cmd == "status":',
        '    if args.cmd == "hr-cto-owner-sender-hash-readback":\n        out = hr_cto_owner_sender_readback()\n    elif args.cmd == "status":',1)
    (out/'client-artdir/ds_client.py').write_text(client)
    requests={
        'executableNow':False,'nativeMessageIdVerified':False,
        'read':{'action':'HR_CTO_OWNER_SENDER_HASH_READBACK_V1',
                'operation_id':'hr-cto-owner-read-20260928-54b0945f','feishu_message_id':None},
        'dsInstall':{'action':'FIXED_DS_SCRIPT_UPDATE_V1','operation_id':IDS['ds-install'],
                     'expected_preimage_sha256':build.DS_SHA,'candidate_sha256':ds_digest},
        'dsRollback':{'action':'FIXED_DS_SCRIPT_UPDATE_V1','operation_id':IDS['ds-restore'],
                     'expected_preimage_sha256':ds_digest,'candidate_sha256':build.DS_SHA},
        'shimInstall':{'action':'SERVICE_UPDATE','operation_id':IDS['shim-install'],
                       'artifacts':{'deploy_shim.py':build.sha(shim.encode())}},
        'shimRollback':{'action':'SERVICE_UPDATE','operation_id':IDS['shim-restore'],
                        'artifacts':{'deploy_shim.py':build.SHIM_SHA}}}
    (out/'REQUESTS.json').write_text(json.dumps(requests,indent=2,sort_keys=True)+'\n')
    install={'installNow':False,'nativeMessageIdVerified':False,'requestCommitment':None,
        'DSPreimageSha256':build.DS_SHA,'DSPreimageSize':110215851,
        'candidateDSSha256':ds_digest,'candidateDSSize':len(ds),
        'shimPreimageSha256':build.SHIM_SHA,'candidateShimSha256':build.sha(shim.encode()),
        'installedClientUnchangedSha256':CLIENT_SHA,'fixedPackagedClientSha256':build.sha(client.encode()),
        'livePreimageVerified':False,'frozenOfflinePreimageVerified':True,
        'receiptPath':'/private/var/db/agent-deploy-system/receipts/hr-cto-owner-read-20260928-54b0945f.json',
        'intentPath':'/private/var/db/agent-deploy-system/hr-cto-owner-sender-readback/intent.json',
        'operationEligibility':'RESERVED_NOT_PROVED_UNUSED','missingExternalFact':'official independently resolved native Feishu message ID joined to attributable CTO Owner seed',
        'activationOrder':['native-ID official join, future exact request commitment/code/pair rebind review',
                           'Root fresh current DS/shim/caller/parser/lease/unused-ID/preimage/rollback predicates',
                           'existing SERVICE_UPDATE fixed shim; FIXED_DS_SCRIPT_UPDATE_V1 DS-only update',
                           'one fixed client invocation: INTENT before read; COMPLETE/FAIL/UNKNOWN no replay',
                           'independent terminal receipt verification; sender digest alone is not Owner proof'],
        'productionEffectsThisTask':False,'agentRuntimeRestart':False,
        'preservedGuards':'existing shared DS lease, original fixed worker proof, same UID502 peer; no guard bypass'}
    (out/'INSTALLATION.json').write_text(json.dumps(install,indent=2,sort_keys=True)+'\n')
