# RECEIPT-PLANNED-PROPOSAL

状态：PREPUBLICATION_VERIFIED；文档检查和独立语义/影响差量审查已通过，commit/push/PR 尚待实际执行。
仅 proposed 文档交付；没有接受、实现、merge 或生产授权。

## 授权、坐标与路线

- 用户 [BRIEF](BRIEF-PLANNED-PROPOSAL.md)；Owner ruling
  `owner-20261107-five-decisions` ④，2026-11-07 20:54，docs-first 起草走审查，接受仍需 Owner。
  [选中原文与哈希](docs/reports/planned-recovery-proposal-20261107/source-observations.json)
  canonical SHA256 `95290062529cf24c31d3c7f6c748a22e5e369d14458cf623f562eee5c90cedc8`。
- worktree `/private/tmp/h-planned-proposal`；新 branch `docs/planned-recovery-proposal`；
  parent/authoring BASE `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`。
  只读 remote main 初次新读数 `24974c720d634b965943e08bfd0862657b9be0e1`；
  #654 diagnostic-read 变更未改本次两 predecessor 或治理/相关父权威；不因无关 base 移动重跑产品门。
- 使用 [spec-governance](.agents/skills/spec-governance/SKILL.md) AUTHOR；
  `schema_version=2`，`SUPERSEDE / BRIEF / CONTROLLED / AUTHORITY_AUTHORING`；
  `AUTHORITY_ACCEPTED_IN_BASE=NO`（本后继），`IMPLEMENTATION_ALLOWED=NO`、`MERGE_READY=NO`、
  `OPERATION_ALLOWED=NO`。CONTROLLED 是拟变更准入语义的后果分类，本轮没有运行操作。
- [完整提案](docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md)：
  `proposed / implementation_authority:none / production_apply_authority:none`，
  whole replacement intent 同时命名 WAE V3、Liveness V1。两个 predecessor 原字节/状态不改。
  不借 Liveness 历史 clause exception 扩到 B3；不使用 AMEND 或独立新入口绕过原排除。

## 前置复用与条款对照

| Brief / 来源 | 本次处置与候选条款 |
|---|---|
| ordinary planned 合法正向续接与 CTR-EKRWAE-004 精确关系 | 提案 §2/§8、CTR-PPR-001/003/005：有界解除普通初始计划排除；可信原 plan/WAL/来源、原 baseline、fresh 全部门后同身份首次 admission；不重标 blocked |
| ①触发定义 | CTR-PPR-001：实际 ACTIVE/planned、普通初始 generation=1、可信原证明；既有 Scheduler 在重开 store 后自动发现；有限 scan/backoff 与持久 next-check；默认 OFF |
| ②actor 不冒充 assignee | CTR-PPR-002：真实 control-plane requester、进程外身份；target 自己 Principal/Workspace/main；不新增 Grant/OBO，不冒用普通 Assistance |
| ③UNKNOWN/零重放 | CTR-PPR-003：原七元组、generation/processGeneration/epoch 分开；WAL primary + fresh Router secondary；旧执行/已派工具不存在正证；delivery_started 后零二次投递，ACK 丢失同 request readback |
| ④交接义务 | CTR-PPR-004：同意图收据、合法接收/admission、消费者、答复验证/retrigger 全部成立才转移；不支持/拒绝/ACK-only 保责；不随带 B2 terminal 新追加/closure 或系统 reason |
| ⑤DTO 封闭/兼容 | CTR-PPR-005：新增内部 plan proof 闭合字段、additionalProperties:false；可信原始 producer 同 append，不 backfill；新旧 reader/producer 矩阵和停用责任保全；现有外部 DTO/reason 原义不变 |
| ⑥#1379 解耦 | CTR-PPR-006：仅消费既有合法 proof/readback seam，不实现传输改造，不以 queued/ACK 冒充 proof；blocked、Owner/stale 与 B1/B4 保留 |
| PR #650 | 固定 head `4928f5022a2385b571eba4d9d2967d216c78c2f8`，planned 排除与 refusal a/b closure 独立差量复用；不把调查当权威、不在本案实施 closure |
| #1377 STOPPED | 原 STOPPED-1377-B2.md 20–78 的 SPEC_GAP、plan 落盘后故障反例/历史缺证负例复用；后续 R5 blocked PASS 不关闭 planned 半 |
| #644 blocked 已交付 | merge `4f7df01bcf087075c114901a96a7a54573110f61`；原正式 recoverAttempt/FIFO/OwnerLock/fresh gate 与首次 admission 顺序不变；历史测试非本轮重跑 |
| #643 六约束模式 | 固定语义 head `7b5d79c3961625aaade6f3b383b18b2968e82f6c`；模式复用，不增加其 reason。发布前 main 已合入 #643（`9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`），RBAH V1 accepted/none/production none；保留独立语义及 WEC/Svc 实施闸门，未来仅迁移 predecessor 引用，不退休它 |
| #653/#655 路线参考 | #653 的独立差量/whole successor 判据与 #655 的 proposed-successor/未来原子双向 lifecycle 模式；固定 head 见提案 OBS-PPR-004，均不作本案 Product Authority |

[remote source coordinates](docs/reports/planned-recovery-proposal-20261107/remote-source-coordinates.json)
保存直接读取的 #643/#650/#653 文件固定 URL/blob。附录 A/B 在候选内完整携带来源有效义务，
明确旧文本的历史语境和 §8 有效组合；本版合计 27 合同（14 WAE 含 001b、7 EKRWAE、6 PPR），
§10 正反向映射全部覆盖，未来产品 Acceptance 全为 NOT_RUN。

## DONE_WHEN、开放问题与停止边界

DONE_WHEN：完整 proposed 文档 + 本收据与必要来源证据；独立受影响语义/最终 Head 复核；
文档检查通过；commit 到指定新 branch、push；创建 base main 的 OPEN PR、读回未合并。
达到即停，不追加实现、接受或合并任务。当前各步完成状态见执行记录，不把定义当已完成事实。

开放问题：

1. Owner 是否接受 ordinary 初始计划的有界解禁与双 whole successor；本轮不接受。
2. 本版不覆盖 Owner/stale/后继 generation 的 planned；若要扩大须另行 Owner 决定与审查。
3. 原 writer 全路径 WAL 资格/source-to-loaded binding、实际可信 producer 与新旧 reader 兼容
   为未来实现门，当前 UNKNOWN；缺证只能拒绝，不能补造历史 proof。
4. Svc 配对面：本版无新外部 DTO/reason/历史对象接受请求；若现行读回 seam 不足，或要求新
   系统交接入口/CAS/历史对象能力，必须由 Svc 所属权威另行承接并绑定 accepted ID/main SHA。
   新配对坐标 UNKNOWN；Core 单方接受不扩 Svc 事务/角色权限。
5. #643 的限定语义接受现已在 main，保留其独立义务/实施闸门；本案接受前对 #655/独立
   refused-terminal 等并行后继 fresh reconcile，不抢先承接其差量。

EXPANSION_TRIGGER：必需文档/独立审查/发布门失败、声明差量之外的权威冲突、需要源码或生产面。
用户要求失败即停；触发则停止依赖写入并写 STOPPED-PLANNED-PROPOSAL.md，不自行修复后重跑。

## 执行记录

| 门 | 实际结果 / 坐标 |
|---|---|
| 文档 scope/schema/whole transition/来源与 ruling 哈希/链接/正反覆盖 | `PYTHONDONTWRITEBYTECODE=1 python3 /private/tmp/check-planned-proposal.py` 两次 rc0；原 tree `2cd3e10664fa8479683d9507da80e160058ce969`，#643 状态修正后 tree `e20f51661d78060e3962ba9da22996eed17fedaa`；5 docs、27/27、8 relative links、annex source EXACT、predecessor UNCHANGED |
| whitespace | `git diff --cached --check`、`git diff --check` 实际 rc0；发布前最终内容还将复核 |
| accepted governance integrity | `python3 .agents/tools/verify_governance.py --target . --require-accepted` rc0，vendored bytes 与 accepted lock 一致；工具不改 |
| independent semantic review | `/root/proposal_independent_review` 非语义作者，初审 FULL PASS，#643 fresh-main 影响 DELTA PASS；BLOCKERS=0、SPEC_GAPS=0、FROZEN_BLOCKER_UNION=[]；是 review recommendation，不是 Owner 接受 |
| proposal frozen semantic bytes | SHA256 `be086f7089a383430fdc6f8ae63d9d7b87218c5875387063245f7e4e68ee3ccf`；#643 修正后初始六合同/两附录字节未变；后续只补收据 |
| current main impact | fresh main `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`；#654 read-separation 和 #643 限定语义接受；两 predecessor/相关既有门未变，RBAH 独立保留、未获实施 |
| structure runner | NOT_RUN；local README 明示 V3 verifier qualification 待独立任务；本轮五份文档不适配 runner |
| commit/push/PR | PENDING；最终精确 HEAD/tree 与远端读回将在发布后登记，不能用 staged tree 冒充已发布 HEAD |

第一次机械/独审 import 产生的单个 `validate_spec_transition.cpython-314.pyc` 已删除，空缓存目录移除；
后续 import 使用 `PYTHONDONTWRITEBYTECODE=1`，未编辑治理源码。没有把生成缓存纳入五文件交付。
产品测试、跨服务 E2E、故障实验、安装/运行时/业务/无人值守：NOT_RUN / UNKNOWN。
零产品源码、零生产写入、零 Agent/Owner/Assistance 业务发送；未接受、未 merge。

## 独立审查原文（初审及 #643 影响差量）

外部原件 `/private/tmp/planned-proposal-independent-review.md`，此时 SHA256 `e82442068cc1bd090d0863d5ef6069132e8ac360410026d730f84e78f0dc014a`；以下代码块原字节保留该审查结果。最终收据/committed-HEAD 复核另记 PR 发布记录，不能以初审替代。

~~~~markdown
# Independent planned recovery proposal review

Reviewer: `/root/proposal_independent_review`; semantic author: `/root`.
The reviewer did not author the proposal, receipt, proof DTO, source records, or semantic delta. This is an independent review recommendation, not Owner acceptance.

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
SPEC_REVIEW = ACCEPT
REVIEW_TARGET_HEAD = UNCOMMITTED (initial immutable tree review)
REVIEW_TARGET_TREE = 2cd3e10664fa8479683d9507da80e160058ce969
BASE_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
CURRENT_BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = First independent review of this complete proposed successor and its six-contract delta
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = BOUNDED
BLOCKERS = 0
SPEC_GAPS = 0 (newly identified review findings)
FOLLOW_UPS = 0
TOOLING_DEBT = 0
FROZEN_BLOCKER_UNION = []
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (authorized docs delivery only; final committed-HEAD recheck still required)
```

Proposal: `docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md`.
Reviewed SHA256: `af1156f936be97925f36d60938e43ff0607d57a97b272e685009e604e11ec395`.
Initial reviewed set is exactly five added documents: proposal, Brief, receipt, and the two source-observation JSON files. Product/runtime testing and production effects are NOT_RUN; no source, accepted authority, runtime state, or production writes were performed by this reviewer.

## Findings and rationale

No concrete blocker or newly load-bearing Spec gap was found against the bounded authoring/delivery mandate.

1. Route and ownership are explicit. The candidate changes the accepted ordinary-planned exclusion and WAE eligible-shaped definition, so AMEND cannot cover it. The complete consolidated successor names both whole WAE V3 and Liveness V1, while preserving both accepted predecessors unchanged during the proposed phase. It does not enlarge the old task-specific partial-supersession exception. Existing SRE effects are carried with no new SRE lifecycle change; WEC Owner-resume and stale/re-entry boundaries are retained. A future Owner transaction must atomically retire both predecessors and maintain inherited references/backlinks.
2. The positive class is bounded and reviewable: ordinary initial generation 1, ACTIVE/planned, trusted proof in the original durable plan, original pre-delivery baseline, no resolution failure/Owner/stale origin, fresh world/version/actor/correlation gates, and shared FIFO/OwnerLock/replay. This is a proposed subset, not a claim that later-generation or historical ambiguous plans have become recoverable; that scope decision is explicitly reserved to Owner.
3. The proof object is not treated as self-authenticating permission. The candidate separately requires original trusted producer provenance, actual source-to-loaded/all-path WAL qualification and fresh primary/secondary gates. Missing metadata, a naked never_existed/null/PID observation, old correlation-index loss, execution/side-effect uncertainty or an already durable delivery_started cannot authorize delivery. No historical proof backfill, identity replacement, new generation, baseline reconstruction, fence clearing or UNKNOWN rewriting is permitted.
4. The six requested constraint families are present and mapped to Acceptance: finite persistent discovery; real system actor with no assignee impersonation; original identity and zero business replay; reliable handoff with receipt/recipient/consumer/reply/retrigger; closed internal DTO and old/new producer-reader controls; #1379 decoupling. ACK loss after delivery_started permits readback only. Refusal-terminal closure and new system Assistance reason remain excluded, and unavailable existing Svc capability cannot be presumed or bypassed.
5. The candidate retains old effective norms through source-identical appendices and an explicit precedence/delta table, including the Liveness corrections to WAE and prior SRE responsibility effects. Existing blocked #644 gates and results are preserved; historical test results are not relabeled as current evidence. The candidate has 27 unique Contract headings and reverse coverage for all 27; the source suites plus ACC-PPR-001..005 cover inherited and new requirements. Product Acceptance definitions are explicitly NOT_RUN.
6. Proposal-only authority is consistent across the frontmatter, scope, current-state claims, receipt and future lifecycle. Owner acceptance is still required. Even a future acceptance of these exact none-authority bytes would not authorize implementation. Svc owns its current transaction/auth/DTO/receipt truth; any newly required companion protocol must obtain separate accepted ownership and exact coordinates before dependent work.

## Independently executed checks

Read-only Python verification at the immutable tree above completed rc0:

- Proposal SHA256 equals the reviewed value.
- Carried Appendix A equals the authoring-base WAE V3 suffix beginning `## Bounded contract delta` byte for byte.
- Carried Appendix B equals the authoring-base Liveness V1 section 1 through the start of section 13 byte for byte.
- Both predecessors, selected WEC/SRE/D-009 and local governance files are byte-identical at authoring base, reviewed tree and the stated current-main snapshot.
- Exactly 27 distinct Contract headings exist, including legacy `CTR-WAE-001b`; each is present in the reverse-coverage table.
- Candidate frontmatter passes the repository JSON schema and retains proposed/none/none.
- Exactly the five authorized docs are added; no existing file changes.
- Each local provenance hash and selected-ruling canonical hash matches the reviewed bytes.
- The existing transition verifier's `validate_transition` accepts the full inherited WAE V1 -> V2 -> V3 chain plus unchanged Liveness V1 and the proposed dual successor.
- `git diff --check BASE REVIEW_TARGET_TREE` rc0.

The reviewer independently fetched #650, #643 and #653 files with the GitHub connector at their exact pinned PR heads. All three Git blobs match `remote-source-coordinates.json`: respectively `725422c81050068e70f61c71dada902d2311a195`, `b28b77bb88d7bdc963e989738177ce3d68aba39f`, `aefe90a08084d5a865e5669617ef8514ca317d7a`. Their relevant exclusions, six-constraint pattern and whole-successor guidance support the candidate's stated disposition; these documents do not themselves grant product authority.

## Remaining boundary

The receipt correctly lists its mechanical/publication steps as pending at this initial tree. Final publication evidence, the final committed HEAD/tree, and any receipt-only delta need a bounded independent final-HEAD recheck. That outstanding delivery step is not a semantic blocker in this initial review and is not represented as complete here. No merge, Owner acceptance, implementation, production apply, installed capability, runtime recovery, cross-service business acceptance or unattended outcome is certified.

## Bounded delta recheck — #643 main movement

The independently observed current-main snapshot advanced to `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3` by merging #643. Readback of `AGENT_CORE_READBACK_AGING_HANDOFF_V1` shows accepted proposal semantics, implementation authority none, production authority none, and the explicit WEC/Svc companion-acceptance gate. The new authority remains scoped B1/B4 and does not conflict with ordinary planned recovery. Changes from the prior main snapshot add #643 documents/receipts only; the predecessor and selected-parent bytes remain unchanged.

```text
REVIEW_SCOPE = DELTA
REVIEW_TARGET_TREE = e20f51661d78060e3962ba9da22996eed17fedaa
CURRENT_BASE_HEAD = 9df5bd2fdea17f04bcd1762cd6800c350efcf9c3
PROPOSAL_SHA256 = be086f7089a383430fdc6f8ae63d9d7b87218c5875387063245f7e4e68ee3ccf
SCOPE_REASON = Bounded relevant Base movement and its provenance/current-state/reference-disposition correction
IMPACT_EVIDENCE = old/new tree diff; #643 exact-main authority readback; selected authority-byte equality
DELTA_REVIEW = PASS
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
```

The delta corrects current state, adds OBS-PPR-006/EVD-PPR-004 and preserves RBAH's independent six Contracts and WEC/Svc implementation gate. Future predecessor-reference migration explicitly does not retire RBAH or change its meaning. There is no new planned eligibility, protocol or permission change. Independent read-only verification completed rc0 for the new proposal SHA256, exact six-Contract and annex equality, selected authority equality at fresh main, RBAH accepted/none/none/gate fields, exact three-file delta scope and whitespace. The initial 27/27 coverage remains valid; no unrelated product gates were rerun.

The first verification's import of the existing transition validator caused Python to generate a bytecode cache. Root removed that generated cache only; neither source nor accepted governance changed. Subsequent imports/checks disable bytecode output. This tooling side effect does not change the reviewed semantic tree or the scope result, and it is not presented as a product mutation.

Final committed-HEAD/receipt/publication recheck remains pending; this delta recommendation does not certify delivery completion.
~~~~

## 文档检查复现脚本

实际脚本 `/private/tmp/check-planned-proposal.py`，SHA256 `2dc7c7884bfe534fed57063c1b50e3f79a4cf0ae1f0cc1a6fed9875a82330b21`。保存以下原文至该路径，在本 worktree 将五份交付文件 stage 后，以 `PYTHONDONTWRITEBYTECODE=1 python3 /private/tmp/check-planned-proposal.py` 执行；检查仅证明文档机制，失败按用户要求写 STOPPED。git/tree/文件 hash 是运行时输出，不自引为本收据最终提交。

```python
from pathlib import Path
import hashlib,importlib.util,json,re,subprocess,sys,traceback
import yaml,jsonschema
root=Path('/private/tmp/h-planned-proposal'); base='2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648'
proposal='docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md'
folder='docs/reports/planned-recovery-proposal-20261107'
expected={'BRIEF-PLANNED-PROPOSAL.md','RECEIPT-PLANNED-PROPOSAL.md',proposal,folder+'/source-observations.json',folder+'/remote-source-coordinates.json'}
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
def front(text): return yaml.safe_load(text.split('---',2)[1])
def sha(b): return hashlib.sha256(b).hexdigest()
try:
 changed=set(git('diff','--cached','--name-only',base).decode().splitlines())
 assert changed==expected,('scope',changed)
 for p in changed: assert (root/p).read_bytes()==git('show',':'+p),('staged/worktree drift',p)
 text=(root/proposal).read_text(); fm=front(text)
 jsonschema.validate(fm,json.loads((root/'.agents/schemas/spec-frontmatter.schema.json').read_text()))
 assert (fm['status'],fm['implementation_authority'],fm['production_apply_authority'])==('proposed','none','none')
 assert 'supersedes_clauses' not in fm
 predecessors=['AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3','AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1']
 assert fm['supersedes']==predecessors
 base_records=[]
 for name in ['AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1','AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2',*predecessors]:
  p='docs/specs/'+name+'.md'; b=git('show',base+':'+p)
  assert (root/p).read_bytes()==b and git('show',':'+p)==b,('predecessor drift',p)
  base_records.append(front(b.decode()))
 spec=importlib.util.spec_from_file_location('transition',root/'.agents/tools/validate_spec_transition.py')
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 errors=module.validate_transition(base_records,base_records+[fm]);assert not errors,errors
 a=(root/'docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md').read_text(); a=a[a.index('## Bounded contract delta'):]
 b=(root/'docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md').read_text(); b=b[b.index('## 1. Goal'):b.index('## 13. Open questions and authoring result')]
 for label,source in [('WAE V3',a),('LIVENESS V1',b)]:
  carry=text.split('<!-- BEGIN CARRIED '+label+' -->\n',1)[1].split('<!-- END CARRIED '+label+' -->',1)[0]
  assert carry==source,('carry changed',label)
 sections=re.findall(r'^## (\d+)\. ([^\n]+)',text,re.M)
 assert [int(x[0]) for x in sections[:13]]==list(range(1,14)),sections[:13]
 contracts=re.findall(r'^### (CTR-[A-Za-z0-9-]+)',text,re.M)
 assert len(contracts)==len(set(contracts))==27,contracts
 coverage=text.split('### Reverse coverage',1)[1].split('## 11.',1)[0]
 assert all(c in coverage for c in contracts),('missing coverage',[c for c in contracts if c not in coverage])
 targets=re.findall(r'^### (ACC-PPR-\d+) ',text,re.M)
 assert len(targets)==len(set(targets))==5,targets
 tracked=set(git('ls-files','-z').decode().rstrip('\0').split('\0'))
 links=[]
 for p in [proposal,'RECEIPT-PLANNED-PROPOSAL.md','BRIEF-PLANNED-PROPOSAL.md']:
  fence=None
  for n,line in enumerate((root/p).read_text().splitlines(),1):
   marker=re.match(r'^\s*(`{3,}|~{3,})',line)
   if marker:
    if fence is None:fence=marker[1][0]
    elif marker[1][0]==fence:fence=None
    continue
   if fence:continue
   for m in re.finditer(r'\[[^\]\n]+\]\(([^)\n]+)\)',line):
    target=m[1]
    if re.match(r'[A-Za-z][A-Za-z0-9+.-]*:|#',target):continue
    f=(root/p).parent.joinpath(target.split('#')[0]).resolve()
    relative=f.relative_to(root).as_posix()
    assert f.is_file() and relative in tracked,('relative link',p,n,target)
    links.append([p,n,target])
 observations=json.loads((root/folder/'source-observations.json').read_text())
 for record in observations['local_sources']:
  assert sha((root/record['path']).read_bytes())==record['sha256'],record
 ruling=observations['owner_ruling']
 canonical=json.dumps(ruling['record'],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
 assert sha(canonical)==ruling['canonical_sha256']
 result={'result':'PASS','scope_files':len(changed),'schema':'PASS','whole_transition':'PASS','predecessor_bytes':'UNCHANGED','carried_source_bytes':'EXACT','contract_count':len(contracts),'covered_contracts':len(contracts),'acceptance_definitions':len(targets),'local_links_checked':len(links),'proposal_sha256':sha((root/proposal).read_bytes()),'index_tree':git('write-tree').decode().strip(),'base':base,'limitations':'deterministic document checks only; semantic and runtime are separate'}
 print(json.dumps(result,ensure_ascii=False,indent=2))
except Exception as e:
 stopped=root/'STOPPED-PLANNED-PROPOSAL.md'
 stopped.write_text('# STOPPED-PLANNED-PROPOSAL\n\nRequired document check failed; no repair/retry/commit/push/PR.\n\n'+repr(e)+'\n\n'+traceback.format_exc()+'\n')
 traceback.print_exc();sys.exit(1)
```
