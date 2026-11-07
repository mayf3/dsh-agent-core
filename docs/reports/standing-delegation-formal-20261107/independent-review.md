# 常设授权总裁定 V1 独立语义审查

```text
OBSERVED_AT_UTC = 2026-11-07T15:06:50Z
SPEC_GOVERNANCE_MODE = REVIEW
REPOSITORY = mayf3/dsh-agent-core
REVIEW_KIND = SPEC
REVIEWER_ID = /root/delegation_semantic_review
AUTHOR_ID = /root
REVIEW_TARGET_HEAD = 3f5fb8088e7822ec5bc26d641a07847b34553a50
BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
CURRENT_BASE_HEAD = 9df5bd2fdea17f04bcd1762cd6800c350efcf9c3
ASSURANCE_LEVEL = CONTROLLED
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = 本次 docs-only 正式化候选的初次非作者审查
REVIEW_RESULT = PASS
SPEC_REVIEW = ACCEPT
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
SEMANTIC_DELTA = NONE
BASE_IMPACT = BOUNDED
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
READY_FOR_OWNER_AUTHORIZED_ACCEPTANCE_TRANSACTION = YES
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE
```

审查者未创作受审候选，未修改任何文件，未调用 Auth、window executor 或生产入口。

已直接读取现行入口治理、REVIEW 模式、SPEC_FORMAT_V0、相关 Architecture/Current Decisions、SRA/DCP 和身份读取权威；独立从固定 Git 对象核对候选，而非仅采用作者检查结果。

八项源裁定与正式 Spec marker 内文本全部 UTF-8 字节相等，原 §6 的“六要素”及实际列项原样保留。canonical SHA256 为 `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`，当前源记录唯一且与快照相等。十三个格式章节、frontmatter schema、八个 Contract 的双向 Acceptance 映射齐备。

接受权威为 Owner mayf3 的原八节裁定；`/root` 仅作转换作者及接受事务执行者。审查 PASS 不执行接受，也未宣称 Owner 亲自审阅转换后的精确 HEAD。后续事务应绑定本受审 HEAD、Owner 裁定来源/hash、接受时间及最终 accepted Git 对象，并独立复核最终差量。

`supersedes: []` 和既有权威字节保持。总委托框架与 SRA 标准发布子机制职责互补；DCP 的生产 none、SRA G01–G16、UNKNOWN/no-replay/fence、职责分离及真实 HUMAN_GATE 边界未被改写。远端 main 前移只新增 #643 文档接受事务；18 个已绑定权威/控制文件在 base、candidate、current-base 均相同，旧索引内容保持；未发现本候选冲突。

控制清单给出 Auth 唯一主体/任命撤销查询、Spec 接受与互斥、authority JSON 对 G01 的控制点、核验方法和负向拒绝条件。清单如实指出：Captain 实际 UUID/Session/任命未核验，Spec 接受为手工政策，现 window helper 未消费 SRA revision/issuer/appointment/revocation/G01。其运行适配与负向资格为 `NOT_VERIFIED / NOT_EXECUTED`，不构成本次 docs-only 接受事务必须改产品源码的门；它们仍阻止依赖这些事实的任命、生效或签发。文档接受、main 激活、控制生效和单窗 Mandate 没有混同。

本审查未新增验收范围或 Owner 审批请求。可执行既有授权下的接受事务；本报告不授权合并、产品实施或生产操作。

## 实际执行命令及原始结果

命令一：

```bash
python3 -B - <<'PY'
import hashlib,json,pathlib,re,subprocess,yaml,jsonschema
h='3f5fb8088e7822ec5bc26d641a07847b34553a50'; b='24974c720d634b965943e08bfd0862657b9be0e1'; c='9df5bd2fdea17f04bcd1762cd6800c350efcf9c3'
g=lambda rev,p:subprocess.check_output(['git','show',rev+':'+p])
spec='docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md'; d='docs/reports/standing-delegation-formal-20261107/'
s=g(h,spec).decode(); m=yaml.safe_load(s.split('---',2)[1]); p=json.loads(g(h,d+'source-provenance.json')); r=json.loads(g(h,d+'owner-ruling.json'))
live=[x for x in json.loads(pathlib.Path(p['source_path']).read_text())['rulings'] if x.get('id')=='owner-20261107-standing-delegation']; assert live==[r]
canonical=json.dumps(r,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode(); sh=hashlib.sha256(canonical).hexdigest(); assert sh==p['ruling_canonical_sha256']==m['semantic_source_canonical_sha256']=='01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3'
assert len(r['items'])==8
for i,t in enumerate(r['items'],1):
 assert re.findall(rf'<!-- BEGIN SOD_SOURCE_{i:03d} -->\n(.*?)\n<!-- END SOD_SOURCE_{i:03d} -->',s,re.S)==[t]
 assert hashlib.sha256(t.encode()).hexdigest()==p['item_utf8_sha256'][i-1]['sha256']
assert re.findall(r'^## \d+\. (.+)$',s,re.M)==['Goal','Scope and non-goals','Authority and dependencies','Current State','Observations','Claims and assumptions','Evidence relations','Decisions','Contracts','Acceptance','Alternatives and disposition','Migration, compatibility, and rollback','Open questions']
jsonschema.validate(m,json.loads(g(h,'.agents/schemas/spec-frontmatter.schema.json')))
assert re.findall(r'^\| (ACC-SOD-\d{3}) [^|]+\| (CTR-SOD-\d{3}) \|',s,re.M)==[(f'ACC-SOD-{i:03d}',f'CTR-SOD-{i:03d}')for i in range(1,9)]
assert m['status']=='proposed' and m['implementation_authority']=='none' and m['supersedes']==[] and m['superseded_by'] is None
for row in p['authority_inventory']: assert g(h,row['path'])==g(b,row['path'])==g(c,row['path'])
idx=g(h,'docs/specs/README.md').decode(); split=idx.split('## Standing Operational Delegation V1 — 总委托框架\n',1); assert len(split)==2; assert (split[0]+'## Standing Release Authorization V1'+split[1].split('## Standing Release Authorization V1',1)[1]).encode()==g(b,'docs/specs/README.md')
paths=subprocess.check_output(['git','diff','--name-only',b,h],text=True).splitlines(); assert len(paths)==10
assert all(x in ['BRIEF-DELEGATION-FORMAL.md',spec,'docs/specs/README.md']or x.startswith(d)for x in paths)
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==h
print('REVIEW_TARGET_HEAD='+h)
print('LIVE_SOURCE_UNIQUE_AND_SNAPSHOT_EQUAL=PASS')
print('CANONICAL_SHA256='+sh)
print('ORIGINAL_ITEMS_UTF8_BYTE_EQUAL=8/8')
print('SPEC_FORMAT_SECTIONS=13/13')
print('FRONTMATTER_SCHEMA=PASS')
print('CONTRACT_ACCEPTANCE=8/8')
print('EXISTING_AUTHORITY_AND_CONTROL_FILES_UNCHANGED=18/18')
print('EXISTING_INDEX_ENTRIES_UNCHANGED=PASS')
print('DOCS_ONLY_CHANGED_FILES=10')
print('NEW_SUPERSESSION=NONE')
print('CURRENT_BASE_AUTHORITY_IMPACT=NONE_ON_18_BOUND_FILES')
PY
```

原始 rc：`0`。原始 stderr：`""`。原始 stdout：

```text
REVIEW_TARGET_HEAD=3f5fb8088e7822ec5bc26d641a07847b34553a50
LIVE_SOURCE_UNIQUE_AND_SNAPSHOT_EQUAL=PASS
CANONICAL_SHA256=01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3
ORIGINAL_ITEMS_UTF8_BYTE_EQUAL=8/8
SPEC_FORMAT_SECTIONS=13/13
FRONTMATTER_SCHEMA=PASS
CONTRACT_ACCEPTANCE=8/8
EXISTING_AUTHORITY_AND_CONTROL_FILES_UNCHANGED=18/18
EXISTING_INDEX_ENTRIES_UNCHANGED=PASS
DOCS_ONLY_CHANGED_FILES=10
NEW_SUPERSESSION=NONE
CURRENT_BASE_AUTHORITY_IMPACT=NONE_ON_18_BOUND_FILES
```

命令二：

```bash
python3 .agents/tools/verify_governance.py --target . --require-accepted && git diff --check 24974c720d634b965943e08bfd0862657b9be0e1 3f5fb8088e7822ec5bc26d641a07847b34553a50
```

原始 rc：`0`。原始 stderr：`""`。原始 stdout：

```text
vendored governance bytes match governance.lock.json and adoption is accepted
```

命令三：

```bash
date -u '+%Y-%m-%dT%H:%M:%SZ' && git status --short && git rev-parse HEAD
```

原始 rc：`0`。原始 stderr：`""`。原始 stdout：

```text
2026-11-07T15:06:50Z
3f5fb8088e7822ec5bc26d641a07847b34553a50
```
