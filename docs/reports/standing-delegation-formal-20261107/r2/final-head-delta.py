import datetime,hashlib,json,pathlib,re,subprocess,yaml
h='cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0'; p='3f5fb8088e7822ec5bc26d641a07847b34553a50'; a='0b61ef6911421a43aef77d6620b72cb72dbb6556'; d='docs/reports/standing-delegation-formal-20261107/'
g=lambda rev,path:subprocess.check_output(['git','show',rev+':'+path])
spec='docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md'; old=g(p,spec).decode(); new=g(h,spec).decode(); normalize=lambda fm:json.loads(json.dumps(fm, default=str)); om=normalize(yaml.safe_load(old.split('---',2)[1])); nm=normalize(yaml.safe_load(new.split('---',2)[1]))
assert new.split('## 1. Goal',1)[1]==old.split('## 1. Goal',1)[1]
assert all(nm[k]==v for k,v in om.items() if k!='status') and nm['status']=='accepted'
assert nm['accepted_by']=='mayf3' and nm['accepted_reviewed_head']==p and nm['acceptance_authority_canonical_sha256']==om['semantic_source_canonical_sha256']
assert nm['acceptance_transaction_executor']=='/root (format conversion and acceptance transaction executor only)'
assert nm['accepted_at']==normalize({'accepted_at':datetime.datetime.fromisoformat('2026-11-07T15:08:54.867556+00:00')})['accepted_at']
review=g(h,d+'independent-review.md'); sh=hashlib.sha256(review).hexdigest(); assert sh==nm['independent_review_receipt_sha256']=='32286d908375b9da83913ac70bdd3b26dd45f68dcf1a3e64e9a81edc3700bad1'
idxold=g(p,'docs/specs/README.md').decode().splitlines(); idxnew=g(h,'docs/specs/README.md').decode().splitlines(); changed=[(x,y)for x,y in zip(idxold,idxnew)if x!=y]; assert len(idxold)==len(idxnew) and len(changed)==1 and all('AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1' in s for s in changed[0])
finalpaths=subprocess.check_output(['git','diff','--name-only',a,h],text=True).splitlines(); assert finalpaths==['RECEIPT-DELEGATION-FORMAL.md',d+'delivery-through-pr-create.jsonl']
assert g(a,spec)==g(h,spec) and g(a,'docs/specs/README.md')==g(h,'docs/specs/README.md')
rows=[json.loads(x)for x in g(h,d+'delivery-through-pr-create.jsonl').decode().splitlines()]; assert len(rows)==20 and all(x['rc']==0 and isinstance(x['stdout'],str)and isinstance(x['stderr'],str)for x in rows)
receipt=g(h,'RECEIPT-DELEGATION-FORMAL.md').decode(); controls=g(h,d+'control-bindings.md').decode().split('\n',1)[1].strip().replace('(source-provenance.json)','('+d+'source-provenance.json)').replace('(../../specs/','(docs/specs/')
assert controls==receipt.split('## §8控制绑定清单（完整）\n',1)[1].split('## 全链原始执行记录',1)[0].strip()
count=0
for f in [spec,d+'acceptance-transaction.md','RECEIPT-DELEGATION-FORMAL.md']:
 for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)',g(h,f).decode()):
  if re.match(r'^https?://|^#',target):continue
  assert (pathlib.Path(f).parent/target.split('#')[0]).exists();count+=1
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==h
assert not subprocess.check_output(['git','status','--short'],text=True)
print('OBSERVED_AT_UTC='+datetime.datetime.now(datetime.timezone.utc).isoformat())
print('FINAL_ACCEPTED_HEAD='+h)
print('SPEC_BODY_AND_EIGHT_ITEMS_AFTER_REVIEW=UNCHANGED')
print('OWNER_ACCEPTANCE_AND_REVIEWED_HEAD_BINDING=PASS')
print('INDEPENDENT_REVIEW_SHA256='+sh)
print('INDEX_ONLY_ONE_ACCEPTANCE_ROW_CHANGED=PASS')
print('LAST_COMMIT_RECEIPT_AND_RAW_CHAIN_ONLY=PASS')
print('RECEIPT_COMPLETE_CONTROL_CHECKLIST=PASS')
print('EXECUTED_CHAIN_RAW_RC_ZERO=20/20')
print('LOCAL_MARKDOWN_LINKS='+str(count))
print('SEMANTIC_DELTA_AFTER_REVIEW=NONE')
print('WORKTREE_CLEAN=YES')
