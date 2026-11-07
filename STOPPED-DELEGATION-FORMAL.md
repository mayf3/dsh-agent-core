# STOPPED — 常设授权总裁定正式化

```text
TASK_RESULT = STOPPED_NOT_COMPLETE
STOP_RULE_SOURCE = BRIEF-DELEGATION-FORMAL.md：失败即停，写STOPPED-DELEGATION-FORMAL.md
FAILED_STAGE = independent final-HEAD delta recheck
FINAL_HEAD_DELTA_RECHECK = NOT_PASSED
FINAL_DELIVERY_READY = NO
DONE_WHEN_MET = NO
RETRY_PERFORMED = NO
POST_FAILURE_COMMIT_PUSH_PR_MUTATION = NONE
PRODUCT_SOURCE_CHANGE = NONE
PRODUCTION_WRITE = NONE
MERGE_PERFORMED = NO
```

## 失败事实

非作者 `/root/delegation_semantic_review` 的最终差量核验脚本触发 `AssertionError`：
直接把 `yaml.safe_load` 后的 `accepted_at` 与 ISO 字符串比较失败。推断原因为 YAML
timestamp 自动解析为日期对象；脚本未打印实际类型，因此该归因是代码推断，不是额外实测。
审查者已停止，没有修改候选或重跑。失败前的正文同一性、既有 metadata、accepted_by、
reviewed HEAD、hash 和 executor 断言通过；这不等于后续最终核验通过。

审查者报告：同一 shell 末尾另有 `git diff --check`，使工具整体退出码为0，但 stderr
实际含 Python Traceback。不得以整壳rc0掩盖子检查失败；未记录的子进程精确rc保持 UNKNOWN。
这不是已证实的候选语义缺陷，也不能伪造 CONTRACT_VIOLATION；实际缺口是最终独立
核验未成功，属于本交付必需门失败。按本任务停止规则，不修脚本、不重跑、不继续push。

## 已发生效果与精确停点

| 项目 | 实际证据/状态 |
|---|---|
| worktree | `/private/tmp/h-delegation-formal` |
| branch / 本地HEAD | `docs/standing-delegation-v1` / `cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0` |
| 固定base | `24974c720d634b965943e08bfd0862657b9be0e1` |
| proposed / 已通过初审HEAD | `3f5fb8088e7822ec5bc26d641a07847b34553a50` |
| Owner接受commit | `0b61ef6911421a43aef77d6620b72cb72dbb6556`；已首次push |
| 接受权威 | Owner mayf3八节裁定本尊；worker只是转换/事务执行者 |
| 原裁定canonical SHA256 | `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3` |
| PR | https://github.com/mayf3/dsh-agent-core/pull/660 |
| PR最后成功读回 | 2026-11-07T15:09:50.818923+00:00，OPEN，base main，mergedAt=null，head=`0b61ef6911421a43aef77d6620b72cb72dbb6556` |
| 远端最后成功读回 | 2026-11-07T15:09:51.717634+00:00，branch=`0b61ef6911421a43aef77d6620b72cb72dbb6556`，main=`9df5bd2fdea17f04bcd1762cd6800c350efcf9c3` |
| 未push提交 | `cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0`，只含RECEIPT和首次PR执行链 |
| 未执行后续 | 最终push、最终PR描述更新、最终远端一致性读回；不得预填成功 |
| 控制事实 | G01实际消费/负向资格 NOT_VERIFIED；Auth主体、Captain任命、单窗签发均未执行 |

已入本地提交的 [RECEIPT](RECEIPT-DELEGATION-FORMAL.md) 保留首次PR交付事实、完整控制
清单与当时的下一步定义；它不是最终完成回执。其最后阶段定义尚未完成，必须与本STOP并读。
现有PR描述同样保留“最终复核待完成”的状态，失败后没有写入完成声明。

初审原文与已通过检查在 `docs/reports/standing-delegation-formal-20261107/`。
主代理必需执行的原始链在 `/private/tmp/delegation-formal-evidence/chain.jsonl`，
其中主代理命令均rc0；不能据此遮盖独立最终检查失败。完整独立失败原文见本STOP附录。

## 恢复前最小条件

原因：最终独审脚本类型比较错误。受影响动作：最终差量验收、push最后RECEIPT提交、
最终PR绑定和任务完成声明。责任主体：原审查/事务责任链；现有授权：Owner八节裁定与
当前Brief，受本任务失败即停限制。最小补证：正确处理YAML日期类型的独立最终差量
核验及真实原文结果。下次合法触发：Owner明确续接本次已停止任务；不得在本轮自行重试。
恢复关闭条件：合法续接后取得最终独审PASS、精确push/PR读回与完整rc证据。
本STOP没有生成新的产品政策决定请求，也没有扩大生产或权限范围。

## 附录：独立审查者最终失败回执原文

# 最终 HEAD 差量复核失败回执

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = FINAL_HEAD
REVIEW_SCOPE = DELTA
REVIEWER_ID = /root/delegation_semantic_review
AUTHOR_INDEPENDENCE = PASS
REVIEWED_PROPOSED_HEAD = 3f5fb8088e7822ec5bc26d641a07847b34553a50
ACCEPTANCE_COMMIT = 0b61ef6911421a43aef77d6620b72cb72dbb6556
FINAL_ACCEPTED_HEAD = cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0
FINAL_HEAD_DELTA_RECHECK = FAIL
SEMANTIC_DELTA_AFTER_REVIEW = NONE_ON_COMPLETED_CHECKS
FROZEN_BLOCKER_UNION = []
READY_FOR_PUSH_AND_PR_FINAL_RECEIPT = NO
NEXT_ACTION = STOP
SHELL_RAW_RC = 0
PYTHON_CHILD_RAW_RC = UNKNOWN_NOT_SEPARATELY_CAPTURED
STDOUT_SEPARATELY_CAPTURED = NO
STDERR_SEPARATELY_CAPTURED = NO
```

已停止，没有修改文件、修复脚本或重新执行检查。

失败来自审查者自有脚本第 9 行的日期断言：

```python
assert nm['accepted_at']=='2026-11-07T15:08:54.867556+00:00'
```

已读取的 Spec 中该时间字面值正确。根据 `yaml.safe_load` 和未加引号的 YAML timestamp，原因推断为解析后的日期对象与字符串比较失败；脚本未打印实际类型，因此此归因是代码推断，非额外运行测量。这不是已证实的候选语义缺陷，不新增虚假的仓库语义 blocker。

该断言前的检查已通过：§1–§13 正文完全相等，既有 frontmatter 除 status 外保持，`accepted_by=mayf3`、reviewed HEAD、Owner 来源 canonical hash 和事务 executor 相符。后续哈希、索引、receipt/完整链及链接的脚本断言未执行完，不能将其报为通过。

外层 shell 在 Python 之后继续执行了 `git diff --check`，工具记录的整壳 rc 为 0；Python 子进程退出码未单独捕获，必须保留 UNKNOWN，不能用整壳 rc0 宣称最终检查全链成功。

实际整条命令：

```bash
python3 -B - <<'PY'
import datetime,hashlib,json,pathlib,re,subprocess,yaml
h='cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0'; p='3f5fb8088e7822ec5bc26d641a07847b34553a50'; a='0b61ef6911421a43aef77d6620b72cb72dbb6556'; d='docs/reports/standing-delegation-formal-20261107/'
g=lambda rev,path:subprocess.check_output(['git','show',rev+':'+path])
spec='docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md'; old=g(p,spec).decode(); new=g(h,spec).decode(); om=yaml.safe_load(old.split('---',2)[1]); nm=yaml.safe_load(new.split('---',2)[1])
assert new.split('## 1. Goal',1)[1]==old.split('## 1. Goal',1)[1]
assert all(nm[k]==v for k,v in om.items() if k!='status') and nm['status']=='accepted'
assert nm['accepted_by']=='mayf3' and nm['accepted_reviewed_head']==p and nm['acceptance_authority_canonical_sha256']==om['semantic_source_canonical_sha256']
assert nm['acceptance_transaction_executor']=='/root (format conversion and acceptance transaction executor only)'
assert nm['accepted_at']=='2026-11-07T15:08:54.867556+00:00'
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
PY

git diff --check 3f5fb8088e7822ec5bc26d641a07847b34553a50 cd98bf1ab73c5abd3b598aa4d71c217127a7a2d0
```

工具只保留合并输出，未分别保留 stdout/stderr；以下为完整原始 output：

```text
Traceback (most recent call last):
  File "<stdin>", line 9, in <module>
AssertionError
```

任务要求失败即停；不得将此记录改写为最终 PASS，也不得将尚未完成的最终 push、PR 更新或远端 HEAD 一致性写为成功。
