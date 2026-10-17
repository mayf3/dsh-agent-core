"""Owned small overlay only. No pair/package copy, process or production write.
Actual inputs and review must be complete; missing defaults refuse before mkdir.
"""
import ast,copy,hashlib,json,os,re,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
P=HERE.parent
C2=P.parent/'maintenance-input-order-fix'
ACTUAL=HERE/'actual-inputs'
OUT=HERE/'changed-overlay'
PROPOSAL='49bafddea25e372a17ebc27c95eb3508d8d3ed49ca8262eeed4ee4103f601418'
OP='b7-packet-r34-1cfeff2a5b138629-e35';TX='tx-c0fd42f71e074eeb8f0e9902e1a3e084'
SOURCE_REVIEW='846f7c6f2e7c30ebfba4ded47e5494909c1eb91e3abe12ed65eef51f69ba0027'
HELPER_BASE='ff3b034fba7de81e09026f1e72b3c42617b9a0881d9196f24f5675a29eee1252'
ENTRY_BASE='3327212f580d8c861e0a49501c52f63f65991852886af33d6f5eb50dedf86ad2'
EXECUTOR='74110415b30bd81572d50e6c53d2e1129052521700a8ef951adfc1d557b4b903'
OLD_EXECUTOR='ddda759a6d7cde336d244d4ee0a05c1e630f2449afbca0d43bae65418358e8b7'
BASE_PINS={'b7-v3-publication-authority.json':'ae00363fae061fe45d45f56de0a7dfdfe379b70f56c8e35776fef97a1a309850','b7-v3-publication-pin.json':'c161fc0caab915e4f5ff44ee0db58c28eeb56bf485c145edbd37569ec64d57fe','CAPSULE-MANIFEST.json':'81e4046ed17b13e23f4caaa6f851c25569feb69fcdf390069eab6497798cfb79','candidate-facts.json':'c36710f7307e7141bee5f4edc97ac3a6056b6a38fa3df83aae9c58a192700327','verify-chain-v50.py':'0f279a7a473177e9d3c1c6511d468638895d11bc9b9442dc72385936e85bc1e2','b7-release-executor.sh':OLD_EXECUTOR}
CP_BASE='393555956947d846e5e9f5772b72d6e6adaafacf069bba6c94680d1d06b6ffc5'
CP_PATH=P.parent.parent/'codex-r34-coherent-business-candidate-20261018/candidate-freeze/b7-install-r34/packet/b7-wired-stage/checkpoint-inputs.json'

def need(ok,reason):
    if not ok:raise ValueError(reason)
def dig(raw):return hashlib.sha256(raw).hexdigest()
def raw(path):
    s=path.lstat();need(path.is_file() and not path.is_symlink() and s.st_nlink==1,'OWNED_INPUT_FILE_TYPE')
    return path.read_bytes()
def parse(body):
    def pairs(items):
        d={}
        for k,v in items:need(k not in d,'DUPLICATE_INPUT_KEY');d[k]=v
        return d
    return json.loads(body,object_pairs_hook=pairs,parse_constant=lambda v:need(False,'NONFINITE_INPUT'))
def js(value):return (json.dumps(value,indent=2,ensure_ascii=True)+'\n').encode()
def digest(value):return type(value) is str and re.fullmatch('[a-f0-9]{64}',value) is not None

def cp_inverse(config,base):
    c=config['oldProducer']['preimageCompatibility'];old=base['oldProducer']['preimageCompatibility']
    need(c['journalSha256']==c['currentJournal']['journalSha256']=='81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf','CP_CURRENT_JOURNAL')
    need(all(type(c['currentJournal'][k]) is str and c['currentJournal'][k] for k in ('authority','reader','utc')),'CP_ACTUAL_PROVENANCE_REQUIRED')
    inverse=copy.deepcopy(config);q=inverse['oldProducer']['preimageCompatibility'];q['journalSha256']=old['journalSha256']
    for k in ('journalSha256','authority','reader','utc'):q['currentJournal'][k]=old['currentJournal'][k]
    need(inverse==base and dig(js(inverse))==CP_BASE,'CP_ONLY_TWO_HASH_THREE_PROVENANCE_FIELDS')
    need(c['byteBindingPath']=='/private/var/db/agent-deploy-system-execution/b7-native-execution-r34-c71fd2cc/b7-wired-stage/preimage-byte-bindings.json','CP_ACTUAL_SNAPSHOT_LAYOUT')

def bind_verifier(base,case):
    # Keep every original predicate and both publication lifecycle modes. The
    # old executor inverse sees exactly the newly stripped reviewed case.
    marker="executor_raw=(HERE/'b7-release-executor.sh').read_bytes()\n"
    need(base.count(marker)==1,'VERIFIER_EXECUTOR_SEAM')
    added='''# Fixed E35 root invocation revision; no new DS publication is asserted.
retire_case = CASE_BYTES
retire_executor_raw = executor_raw
check('fixed e35-retire case inverse to actual dd executor',
      executor_raw.count(retire_case)==1 and dig(executor_raw.replace(retire_case,b'',1))==OLD_EXEC)
executor_raw = executor_raw.replace(retire_case,b'',1)
retire_pins_raw=(HERE/'e35-terminal-material-pins.json').read_bytes()
retire_cp_raw=(HERE/'e35-retirement-checkpoint-inputs.json').read_bytes()
retire_entry_config_raw=(HERE/'e35-retirement-entry.json').read_bytes()
retire_pins=json.loads(retire_pins_raw);retire_cp=json.loads(retire_cp_raw);retire_entry_config=json.loads(retire_entry_config_raw)
retire_proof=retire_pins.get('completed_recovery_proof')
retire_helper=(HERE/'e35_terminal_materials_once.py').read_bytes()
retire_entry=(HERE/'e35_retirement_entry.py').read_bytes()
retire_helper_binding=('_PINS_SHA = '+repr(dig(retire_pins_raw))).encode()
retire_entry_binding=('ENTRY_CONFIG_SHA='+repr(dig(retire_entry_config_raw))).encode()
check('fixed e35 retirement helper only actual pins constant bound',
      retire_helper.count(retire_helper_binding)==1 and dig(retire_helper.replace(retire_helper_binding,b'_PINS_SHA = None',1))==HELPER_SHA)
check('fixed e35 retirement entry only config constant bound',
      retire_entry.count(retire_entry_binding)==1 and dig(retire_entry.replace(retire_entry_binding,b'ENTRY_CONFIG_SHA=None',1))==ENTRY_SHA)
check('fixed e35 retirement config actual subject and source joins',
      retire_pins.get('kind')=='B7_E35_TERMINAL_MATERIAL_RETIREMENT_PINS_V1'
      and retire_pins.get('operation_id')==OP_VALUE and retire_pins.get('tx_id')==TX_VALUE
      and retire_pins.get('accepted_proposal_sha256')==AMENDMENT
      and type(retire_proof) is dict and set(retire_proof)=={'actual_result_sha256','full_readback_sha256','durability_completed'}
      and retire_proof['durability_completed'] is True
      and all(type(retire_proof[k]) is str and re.fullmatch('[a-f0-9]{64}',retire_proof[k]) is not None for k in ('actual_result_sha256','full_readback_sha256'))
      and retire_pins.get('recovery_proof_sha256')==dig(json.dumps(retire_proof,sort_keys=True,separators=(',',':')).encode())
      and retire_entry_config==dict(kind='B7_E35_FIXED_RETIREMENT_ENTRY_V1',fixed_terminal_retirement='e35-aborted-c0fd42f7',operation_id=OP_VALUE,tx_id=TX_VALUE,accepted_proposal_sha256=AMENDMENT,helper_sha256=dig(retire_helper),helper_pins_sha256=dig(retire_pins_raw),checkpoint_sha256=dig(retire_cp_raw))
      and retire_pins.get('checkpoint_sha256')==dig(retire_cp_raw))
retire_cp_base_raw=(STAGE/'checkpoint-inputs.json').read_bytes();retire_cp_base=json.loads(retire_cp_base_raw)
retire_cp_inverse=copy.deepcopy(retire_cp);retire_compat=retire_cp_inverse['oldProducer']['preimageCompatibility'];old_compat=retire_cp_base['oldProducer']['preimageCompatibility']
retire_compat['journalSha256']=old_compat['journalSha256']
for key in ('journalSha256','authority','reader','utc'):retire_compat['currentJournal'][key]=old_compat['currentJournal'][key]
check('fixed e35 CP original byteinverse and actual journal only',
      dig(retire_cp_base_raw)==CP_SHA and retire_cp_inverse==retire_cp_base
      and (json.dumps(retire_cp_inverse,indent=2)+'\\n').encode()==retire_cp_base_raw
      and all(type(retire_cp['oldProducer']['preimageCompatibility']['currentJournal'][k]) is str and retire_cp['oldProducer']['preimageCompatibility']['currentJournal'][k] for k in ('authority','reader','utc'))
      and retire_cp['oldProducer']['preimageCompatibility']['journalSha256']==retire_cp['oldProducer']['preimageCompatibility']['currentJournal']['journalSha256']=='81fbc1fc9b0a1531408d333106e50b4dad3edd7b1429f23035b01c8e056cc7cf')
check('fixed e35 retirement required sealed members',
      {'e35_terminal_materials_once.py','e35_retirement_entry.py'} <= set(authority.get('drivenScripts',{}))
      and {'e35-terminal-material-pins.json','e35-retirement-checkpoint-inputs.json','e35-retirement-entry.json'} <= set(authority.get('drivenConfigs',{})))
check('fixed e35 retirement source and actual bindings reviews joined',
      authority.get('review_receipts',{}).get('e35_terminal_retirement_source_and_entry')==SOURCE_REVIEW_VALUE
      and re.fullmatch('[a-f0-9]{64}',str(authority.get('review_receipts',{}).get('e35_terminal_retirement_actual_bindings'))) is not None)
'''
    replacements={'CASE_BYTES':repr(case),'OLD_EXEC':repr(OLD_EXECUTOR),'HELPER_SHA':repr(HELPER_BASE),'ENTRY_SHA':repr(ENTRY_BASE),'OP_VALUE':repr(OP),'TX_VALUE':repr(TX),'CP_SHA':repr(CP_BASE),'SOURCE_REVIEW_VALUE':repr(SOURCE_REVIEW)}
    for key,value in replacements.items():added=added.replace(key,value)
    result=base.replace(marker,marker+added)
    # Only additive source. Removing this exact block restores every original
    # check and original control flow byte for byte.
    need(result.replace(added,'',1)==base,'VERIFIER_WHOLE_INVERSE')
    compile(result,'verify-chain-v50.py','exec');return result.encode(),added.encode()

def assemble():
    # Complete inputs are required before any output or directory is made.
    need(len(sys.argv)==1 and os.getuid()==502 and os.geteuid()==502,'FIXED_OWNED_ASSEMBLER_UID502_NO_ARGS')
    q=parse(raw(ACTUAL/'ACTUAL-BINDINGS.json'))
    needed={'kind','material_pins_sha256','checkpoint_config_sha256','actual_result_sha256','full_readback_sha256','actual_bindings_review_sha256','source_entry_review_sha256'}
    need(type(q) is dict and set(q)==needed and q['kind']=='B7_E35_ACTUAL_RETIREMENT_BINDINGS_V1','ACTUAL_BINDING_MANIFEST')
    need(q['source_entry_review_sha256']==SOURCE_REVIEW and all(digest(q[k]) for k in needed-{'kind','actual_bindings_review_sha256'}) and (q['actual_bindings_review_sha256'] is None or digest(q['actual_bindings_review_sha256'])),'ACTUAL_BOUND_INPUTS_AND_REVIEW_REQUIRED')
    pins_raw=raw(ACTUAL/'e35-terminal-material-pins.json');cp_raw=raw(ACTUAL/'e35-retirement-checkpoint-inputs.json');pins=parse(pins_raw);cp=parse(cp_raw)
    need(dig(pins_raw)==q['material_pins_sha256'] and dig(cp_raw)==q['checkpoint_config_sha256'] and 0<len(pins_raw)<=16384,'ACTUAL_DATA_SHA_OR_ENTRY_BOUND')
    need(pins.get('kind')=='B7_E35_TERMINAL_MATERIAL_RETIREMENT_PINS_V1' and pins.get('operation_id')==OP and pins.get('tx_id')==TX and pins.get('accepted_proposal_sha256')==PROPOSAL,'ACTUAL_PINS_SUBJECT')
    proof=pins.get('completed_recovery_proof');need(type(proof) is dict and set(proof)=={'actual_result_sha256','full_readback_sha256','durability_completed'} and proof['durability_completed'] is True and all(digest(proof[k]) for k in ('actual_result_sha256','full_readback_sha256')) and proof['actual_result_sha256']==q['actual_result_sha256'] and proof['full_readback_sha256']==q['full_readback_sha256'],'ACTUAL_COMPLETED_PROOF_REQUIRED')
    need(pins.get('recovery_proof_sha256')==dig(json.dumps(proof,sort_keys=True,separators=(',',':')).encode()) and pins.get('checkpoint_sha256')==dig(cp_raw),'ACTUAL_PROOF_AND_CP_JOIN')
    for k in ('native_sha256','false_fence_sha256','status_sha256','runtime_sha256','recovery_proof_sha256','checkpoint_sha256'):need(digest(pins.get(k)),'ACTUAL_PIN_INCOMPLETE')
    need(type(pins.get('objects')) is list and len(pins['objects'])==5 and all(type(x.get('root')) is dict and digest(x.get('lineage_sha256')) for x in pins['objects']),'ACTUAL_FIVE_MANIFESTS_REQUIRED')
    cp_base=raw(CP_PATH);need(dig(cp_base)==CP_BASE,'ORIGINAL_CP_INPUT_CHANGED');cp_inverse(cp,parse(cp_base))
    base_raw={name:raw(C2/name) for name in BASE_PINS};need(all(dig(base_raw[n])==d for n,d in BASE_PINS.items()),'C2_BASELINE_CHANGED')
    auth=parse(base_raw['b7-v3-publication-authority.json']);old_auth=copy.deepcopy(auth);pin=parse(base_raw['b7-v3-publication-pin.json']);old_cap=parse(base_raw['CAPSULE-MANIFEST.json'])
    need(pin==dict(kind='DS_B7_V3_PAIR_PUBLICATION_PIN_V1',authorization_sha256=BASE_PINS['b7-v3-publication-authority.json']) and old_cap['members']==dict(auth['drivenScripts'],**auth['drivenConfigs'],**{'b7-v3-publication-pin.json':BASE_PINS['b7-v3-publication-pin.json']}),'C2_COMPLETE_CLOSURE')
    # Hash ordinary source members only. No import or pair/package duplication.
    unchanged={}
    for name,want in {**auth['drivenScripts'],**auth['drivenConfigs']}.items():
        body=raw(C2/name);need(dig(body)==want,'C2_DRIVEN_MEMBER_CHANGED');unchanged[name]=want
    helper=raw(P/'registry-alias-mode-fix/cli-label-aligned/e35_terminal_materials_once.py');entry=raw(P/'e35_retirement_entry.py');executor=raw(P/'b7-release-executor.e35-retire.DRAFT.sh')
    need(dig(helper)==HELPER_BASE and dig(entry)==ENTRY_BASE and dig(executor)==EXECUTOR,'REVIEWED_SOURCES_CHANGED')
    material_node=next(n for n in ast.parse(helper).body if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='FIXED_MATERIALS' for x in n.targets));fixed_materials=ast.literal_eval(material_node.value)
    need([(x['path'],x['history']) for x in pins['objects']]==[(path,str(Path(path).parent/name)) for path,name in fixed_materials],'EXACT_FIXED_FIVE_MATERIAL_PATHS')
    need(helper.count(b'_PINS_SHA = None')==1 and entry.count(b'ENTRY_CONFIG_SHA=None')==1,'BINDING_CONSTANT_COUNT')
    bound_helper=helper.replace(b'_PINS_SHA = None',('_PINS_SHA = '+repr(dig(pins_raw))).encode(),1)
    entry_config=js(dict(kind='B7_E35_FIXED_RETIREMENT_ENTRY_V1',fixed_terminal_retirement='e35-aborted-c0fd42f7',operation_id=OP,tx_id=TX,accepted_proposal_sha256=PROPOSAL,helper_sha256=dig(bound_helper),helper_pins_sha256=dig(pins_raw),checkpoint_sha256=dig(cp_raw)))
    bound_entry=entry.replace(b'ENTRY_CONFIG_SHA=None',('ENTRY_CONFIG_SHA='+repr(dig(entry_config))).encode(),1)
    a=executor.index(b'  e35-retire)\n');b=executor.index(b'  prepare-inputs)\n',a);case=executor[a:b];need(executor[:a]+executor[b:]==base_raw['b7-release-executor.sh'],'EXECUTOR_EXACT_CASE_INVERSE')
    verifier,delta=bind_verifier(base_raw['verify-chain-v50.py'].decode(),case)
    changed={'b7-release-executor.sh':executor,'e35_terminal_materials_once.py':bound_helper,'e35_retirement_entry.py':bound_entry,'e35-terminal-material-pins.json':pins_raw,'e35-retirement-checkpoint-inputs.json':cp_raw,'e35-retirement-entry.json':entry_config,'verify-chain-v50.py':verifier}
    for name in ('b7-release-executor.sh','e35_terminal_materials_once.py','e35_retirement_entry.py','verify-chain-v50.py'):auth['drivenScripts'][name]=dig(changed[name])
    for name in ('e35-terminal-material-pins.json','e35-retirement-checkpoint-inputs.json','e35-retirement-entry.json'):auth['drivenConfigs'][name]=dig(changed[name])
    auth['executorSha256']=EXECUTOR;auth['review_receipts']['e35_terminal_retirement_source_and_entry']=SOURCE_REVIEW;auth['review_receipts']['e35_terminal_retirement_actual_bindings']=q['actual_bindings_review_sha256'] or 'PENDING_FIXED_E35_ACTUAL_BINDINGS_MECHANICAL_REVIEW_NO_PRODUCTION_ADMISSION'
    # Explicit whole-object inverse: no old source/facts/publication semantics changed.
    inverse=copy.deepcopy(auth)
    for table,names in [('drivenScripts',('e35_terminal_materials_once.py','e35_retirement_entry.py')),('drivenConfigs',('e35-terminal-material-pins.json','e35-retirement-checkpoint-inputs.json','e35-retirement-entry.json'))]:
        for name in names:del inverse[table][name]
    for name in ('b7-release-executor.sh','verify-chain-v50.py'):inverse['drivenScripts'][name]=old_auth['drivenScripts'][name]
    inverse['executorSha256']=old_auth['executorSha256']
    for key in ('e35_terminal_retirement_source_and_entry','e35_terminal_retirement_actual_bindings'):del inverse['review_receipts'][key]
    need(inverse==old_auth and js(inverse)==base_raw['b7-v3-publication-authority.json'],'AUTHORITY_SCOPE_INVERSE')
    auth_raw=js(auth);need(len(auth_raw)<=16384,'ORIGINAL_AUTHORITY_BOUND')
    pin['authorization_sha256']=dig(auth_raw);pin_raw=js(pin);cap=dict(kind='B7_V50_FREEZE_CAPSULE_V1',members={**auth['drivenScripts'],**auth['drivenConfigs'],'b7-v3-publication-pin.json':dig(pin_raw)})
    changed.update({'b7-v3-publication-authority.json':auth_raw,'b7-v3-publication-pin.json':pin_raw,'CAPSULE-MANIFEST.json':js(cap)})
    need(not OUT.exists(),'OUTPUT_ALREADY_EXISTS')
    OUT.mkdir(mode=0o700)
    for name,body in changed.items():
        with (OUT/name).open('xb') as f:f.write(body)
    (OUT/'verifier-additive.delta').write_bytes(delta)
    manifest=[dict(path=name,sha256=dig(body),bytes=len(body)) for name,body in changed.items()]
    (OUT/'CHANGED-FILES.json').write_bytes(js(manifest))
    receipt=dict(kind='B7_E35_ROOT_INVOCATION_ASSEMBLY_READBACK_V1',status='OWNED_CHANGED_OVERLAY_NOT_INSTALLED' if q['actual_bindings_review_sha256'] else 'OWNED_REVIEW_PENDING_OVERLAY_NOT_INSTALLED',accepted_proposal_sha256=PROPOSAL,scope='existing fixed root executor retirement invocation only; no DS_UPDATE/publication or reload',pair_publication_unchanged=auth['publication_operation_id'],pair_artifacts_unchanged=auth['artifacts'],old_pair_publication_authority_sha256=BASE_PINS['b7-v3-publication-authority.json'],new_invocation_authority_sha256=dig(auth_raw),original_pair_publication_not_reused_as_new_revision_proof=True,candidate_facts_unchanged_sha256=BASE_PINS['candidate-facts.json'],authority_whole_object_inverse_exact=True,verifier_full_additive_inverse_exact=True,unchanged_external_members={name:sha for name,sha in unchanged.items() if name not in changed},changed_files=manifest,capsule_members=len(cap['members']),original_authority_bound=16384,original_root_reader_and_capsule_bytechecks_preserved=True,production_invoked=False,limits='Small overlay only; actual final full verifier under original --post-publication still needed after same-scope review/install, with old b31 pair-proof separated from new protected invocation-config readback.')
    (OUT/'ASSEMBLY-RECEIPT.json').write_bytes(js(receipt));return receipt

if __name__=='__main__':
    try:print(json.dumps(assemble(),sort_keys=True))
    except Exception as exc:print('REFUSED: '+type(exc).__name__+': '+str(exc));raise SystemExit(2)
