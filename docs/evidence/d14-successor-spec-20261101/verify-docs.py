#!/usr/bin/env python3
"""Bounded docs/source-identity checks; never reads production or activates authority."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
import yaml,jsonschema
R=Path(__file__).resolve().parents[3]; E=Path(__file__).resolve().parent
BASE='3a1282b35e7b852f51cd14284ea91fd77a13543e'
PAIRS={'AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3':'AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V4','DEFAULT_MODEL_ROUTING_CONFIG_V1':'DEFAULT_MODEL_ROUTING_CONFIG_V2','AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1':'AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V2','AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2':'AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V3'}
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def sha(b):return hashlib.sha256(b).hexdigest()
schema=json.loads((R/'.agents/schemas/spec-frontmatter.schema.json').read_text());checked=[]
for ident in list(PAIRS.values())+['AGENT_CORE_D14_FLEET_GENERATION_SUCCESSION_V1']:
 p=R/'docs/specs'/f'{ident}.md'; t=p.read_text(); fm=yaml.safe_load(t.split('---',2)[1]);jsonschema.validate(fm,schema)
 assert fm['spec_id']==ident and fm['status']=='proposed'
 assert fm['acceptance_status']=='ACCEPTED-under-Owner-D14-directive-20261101'
 assert fm['production_apply_authority']=='none'
 checked.append({'id':ident,'sha256':sha(p.read_bytes()),'schema':'PASS','formalLifecycle':'proposed'})
inputs=json.loads((E/'source-inputs.json').read_text())
for i in inputs['predecessors']:
 p='docs/specs/'+i['id']+'.md';b=git('show',BASE+':'+p)
 assert sha(b)==i['sha256'] and (R/p).read_bytes()==b
for i in inputs['inputs']:
 assert sha((E/i['copy']).read_bytes())==i['sha256']
 assert (E/i['copy']).read_bytes()==git('show',i['revision']+':'+i['path'])
clauses=json.loads((E/'original-clauses.json').read_text())
for c in clauses['clauses']:
 b=git('show',BASE+':'+c['path']);assert sha(b)==c['sourceSha256']
 assert '\n'.join(b.decode().splitlines()[c['lineStart']-1:c['lineEnd']])==c['verbatim']
facts=json.loads((E/'pr599-version-facts.json').read_text());coord=(R/'docs/specs/AGENT_CORE_D14_FLEET_GENERATION_SUCCESSION_V1.md').read_text()
for v in [facts['generationBuild']['plugin']['sourceCommit'],facts['generationBuild']['plugin']['sourceTree'],facts['generationBuild']['closure']['treeDigest'],facts['r3BuildReceipt']['source']['packageJsonSha256'],facts['r3BuildReceipt']['source']['frozenLockSha256']]+[a['sha256'] for a in facts['r3BuildReceipt']['artifacts'][:2]]: assert v in coord
assert len(facts['targets'])==4
counts={}
for ident,prefix,n in [('AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V4','SCA4',17),('AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V2','G6R2',6)]:
 t=(R/'docs/specs'/f'{ident}.md').read_text();ctrs=re.findall(r'^### (CTR-'+prefix+r'-\d+)\b',t,re.M);assert len(ctrs)==len(set(ctrs))==n;counts[ident]=len(ctrs)
t=(R/'docs/specs/AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V3.md').read_text();assert len(re.findall(r'^\*\*CTR-COHORT3-\d+',t,re.M))==6
# Verify exact old source file bytes rather than normalize old legacy metadata into a false PASS.
assert not git('diff',BASE,'--',*[f'docs/specs/{a}.md' for a in PAIRS]).strip()
tracked=git('diff','--name-status',BASE).decode().splitlines();untracked=git('ls-files','--others','--exclude-standard').decode().splitlines()
for row in tracked:
 status,path=row.split('\t',1);assert status=='A' and path.startswith(('docs/specs/','docs/evidence/')),(status,path)
for p in untracked:assert p.startswith(('docs/specs/','docs/evidence/')),p
subprocess.run(['git','diff','--check',BASE],cwd=R,check=True)
subprocess.run(['git','apply','--check',str(E/'atomic-activation.patch')],cwd=R,check=True)
print(json.dumps({'result':'PASS_DOCS_ONLY','base':BASE,'specs':checked,'originalQuotedBlocks':len(clauses['clauses']),'byteExactEvidenceCopies':len(inputs['inputs']),'predecessorFilesUnchanged':4,'contractDefinitionCounts':counts,'cohortContracts':6,'activationPatch':'APPLIES_CHECK_ONLY_NOT_EXECUTED','authorityActivation':'NO_D14_DOCS_LIFECYCLE_001','implementationAndProductionEvidence':'NOT_EXECUTED'},indent=2))
