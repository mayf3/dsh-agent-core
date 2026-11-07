# RECEIPT-1366-SUPERSEDE — R3 docs-only authority proposal

状态：`PROPOSAL_AUTHORING_REVIEW_PASS — DELIVERY_PENDING`。此回执只证明已记录的文档动作；
不是 Owner 接受、产品实现、并发测试或生产验收 PASS。起草日期：2026-11-07。

## 1. 授权、历史与隔离坐标

本轮直接用户指令为 R3 路线修正，关键原文：

> 路线改为docs-only SUPERSEDE
>
> 新 Spec(合法新ID, 如 AGENT_CORE_WEC1_LOCK_TIMING_V2 或按命名惯例)整体继任 CTR-WEC1-008 所在的锁语义条款面
>
> 行为差量仍严格仅限两类读取(远端pre-plan/evidence读取期间释放admission lock→重新获取→精确校验前置→变化走既有拒绝路径); 其余持锁段语义逐字保留
>
> 双向回链(前任superseded_by+继任supersedes)
>
> SPEC_FORMAT_V0合规(参照#642成功模式: standalone successor proposal, proposed/零实施权)
>
> docs/specs/正式路径提案+RECEIPT→commit新分支docs/wec1-008-lock-timing-supersede→push→PR(base main)不合并。
>
> 零源码零生产写入; 失败即停照旧。

本指令提供一次文档起草/交付 mandate，不改写 Product Authority，不代行接受或合并。
依最后明确停止条件，真实失败停入既有 STOPPED，不自动实施产品修复。

- Repo：`mayf3/dsh-agent-core`。
- 唯一写面：`/private/tmp/h1366-lockscope`，既有 isolated worktree。
- `BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1`。
- 起始 detached HEAD 与远端 main 均为此 base；远端未返回目标分支。
- 实际 `git switch -c docs/wec1-008-lock-timing-supersede <BASE_HEAD>` rc0。
- 分支：`docs/wec1-008-lock-timing-supersede`；未 rebase 或修改其他 checkout。
- R3 起草时，R1/R2 Brief 和 STOPPED 是原有未跟踪交接文件；当时保留原字节，未提交为新权威。
  R1 发现 accepted locked-read gap；R2 正确停于 AMEND 与 immutability 冲突。
  R3 只修正作者路线，不重做 #1367/#1358 或启动 #1366 产品实现。

R3 起草时交接文件实测 SHA-256（STOPPED 此后追加了 R3 停止记录）：

```text
74a2f14c93493ab25fe1f8a16aeb49c4ed09c0fe5a86c1abe1c970e3cf36b03a  BRIEF-1366-LOCKSCOPE.md
b62dd2c5f441ea4a026f1a832748f2e28316310452b6e082773a175e0b20c1c6  BRIEF-1366-LOCKTIMING-AMEND.md
f1d055bab7c334eb87f8c12231a50552f53fafcace57155275a17a2cb4d4ca0b  STOPPED-1366-LOCKSCOPE.md
```

## 2. 当前路线与交付边界

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
GOAL_OR_TARGET = 独立完整 WEC 后继 proposed 提案及文档 PR；仅两类读取锁时序差量
CURRENT_GAP = accepted WEC V3 明确两类远端读取持锁，替换其含义不能 AMEND
AUTHORITY_ACTION = SUPERSEDE
ROUTE_STAGE = AUTHORITY_AUTHORING
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3 / CTR-WEC1-008 @ BASE_HEAD
TARGET_PROPOSAL = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4
AUTHORITY_ACCEPTED_IN_BASE = NO (所需新时序尚未接受；原 V3 已在 base)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
EXECUTION_MANDATE = VALID (R3 直接用户任务；限文档、commit/push/PR)
ISOLATED_WRITE_SURFACE = YES
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MERGE_READY = NO (用户禁止合并；不是 proposed 文档 PR 的创建许可)
DONE_WHEN = proposal+receipt 核验、commit、push、base=main PR 创建且不合并
EXPANSION_TRIGGER = 超过两类读取、改其他持锁段/外部协议、接受/合并、源码或生产写入
NEXT_ACTION = REVIEW
```

## 3. 正式提案与条款对照

正式稳定路径：
[`docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md`](docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md)。
ID 合法且本轮开始时不存在。按格式 whole-Spec 要求，完整继任 WEC V3，不能只列
`V3#CTR-WEC1-008` fragment。所有新合同的全局身份属于 V4；原 V3 IDs 历史含义不变。

| 旧规范面 | 本轮处置及证据 |
|---|---|
| CTR-WEC1-001..007 | 全文逐字携带；独立抽取比较通过 |
| CTR-WEC1-008 pre-plan 持锁句 | 唯一替换 span 1：释放→读→重取→前置精确验证→拒绝漂移 |
| CTR-WEC1-008 evidence 持锁句 | 唯一替换 span 2：同样有界时序；原 predecessor/baseline 绑定不变 |
| CTR-WEC1-008 其余正文、DTO、单次 permit、planned restart | 逆向还原两个 span 后逐字相等；未改其他锁段 |
| WEC V3 managed intake/review delta | 逐字携带到 CTR-WEC4-009；没有新产品义务 |
| Intent、frozen boundaries、data model、API、test obligations | 全部逐字携带；不是“其余参见前任”的拼装后继 |
| 精确重检/并发/refusal | CTR-WEC4-010 与 ACC-WEC4-003/004/005，均属两类读取差量的必要约束 |
| SRE CTR-SRE-002 post-delivery detail、WAL/delivery/completion/recovery | 明确保持原锁纪律；其 accepted 文件零修改 |
| UNKNOWN/D-009/单 writer/budget | 保持既有语义，不添加 retry/replay 或新消费 ledger |

锁内重新验证必须包含可信外部 canonical identity/version；本地 ledger revision 未变、
TTL 或两次旧读一致都不足。允许既有可信读提供必要的最终验证，但不假称 Core/Svc 原子共同
快照。Svc 后续业务写仍受原授权/CAS/fence。必要验证残余等待必须实测并披露；完整重做两类
collection 后不能声称其等待已消除。本轮没有声称所有外部 I/O 已锁外。

## 4. 双向回链、proposed 与零实施权

已核对 [#642](https://github.com/mayf3/dsh-agent-core/pull/642) 实际 PR 和本地
`CODE_STRUCTURE_GUARDRAILS_V3.md` §12；其 Phase 1 proposed 不改前任，Owner 接受后
另行 Phase 2 原子退役。当前 transition verifier 同样明确禁止 proposed successor 提前
设置 predecessor backlink。

- **已写入**：V4 proposed `supersedes: [AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3]`、
  `superseded_by: null`、两项 authority 均 `none`。
- **明确的未来原子事务**：提案 §12 给出 V4 accepted 与 V3 superseded、
  `V3.superseded_by: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4` 的准确 YAML、索引/引用处置、
  reviewed semantic head/哈希/issuer/time/final-head review 绑定要求。
- **未执行**：前任退休/backlink、Owner 接受、current pointer 切换或 merge。原 V3 全文哈希
  与 base 相等。V1→V2→V3 历史边不重定向。

`implementation_authority:none` 按格式 §2.4 在接受后仍不授权代码。未来实现需要含 accepted
implementation-authorizing Contracts 的 base 并重新 PREFLIGHT；不能把本提案接受单独当作
#1366 实现许可证，也不能从退休的 V3 继承绕行权限。

## 5. Svc 配对面

通过 GitHub connector 实际读取
[`SVC_WORKFLOW_EXECUTION_CONTROL_V2`](https://github.com/mayf3/svc-workflow/blob/d4c510d94f8929f5377989bd69229d611ab49304/docs/specs/SVC_WORKFLOW_EXECUTION_CONTROL_V2.md)
accepted 文档及 CTR-SWEC-010。Svc main 实测为
`d4c510d94f8929f5377989bd69229d611ab49304`；文件 Git blob 为
`add9282ed7db3827fc4bcaf309a44f12669cd9f0`。先读 default branch 内容，再以精确 main SHA
复读元数据，blob 相同。V1 已 superseded→V2，未以 V1 冒充当前 companion。

本轮不改 read-only DTO、权限、canonical provenance/selection、消费记录或 Svc 锁；
Core admission OwnerLock 不等于 Svc Domain 行锁。未检出/审计 Svc store 源码、未连接 DB、
未做 paired implementation/运行时接受，均 `NOT_RUN/UNKNOWN`。后续若为满足最终验证需要
新外部协议，必须停止依赖工作并另走配对权威，不能以本提案推定已获跨仓接受。

## 6. 负向与并发验收设计（不是运行结果）

- A 分别暂停在 pre-plan 和 evidence 远端等待时，无关 B 经真实同一 ledger/OwnerLock
  完成 admission；保留 B durable facts，并披露最终验证残余等待。
- 本地 ledger 不变，但 Svc activation/terminal/instance/visit/assignee/version 在读取间或
  重取锁等待期间改变：旧结果拒绝，零 plan/permit consume/delivery。
- 本地 writer 改 A predecessor/generation/phase/eligibility/budget/settled proof 或消费 permit：
  fresh replay 后拒绝旧结果；无关 append 可继续但不得丢失。
- 同 visit/case 两个 writer 竞争：至多一个授权 generation、一次 case 消费，败者走原拒绝。
- 最终外部证明缺失、不可达、限制可见、冲突或模糊：拒绝；本地 CAS/TTL 不能替代。
- plan 前后、delivery_started 后崩溃：不扩充原同-ID planned restart 例外；不重放 UNKNOWN。

产品测试执行状态全部 `NOT_RUN / MECHANISM_NOT_YET_QUALIFIED`，没有 RED/GREEN、吞吐、
DB 竞争、部署、业务或无人值守运行 PASS。文件展开测试配方留给后续授权实现任务。

## 7. 已执行的文档检查

本轮 authoring draft 的 Spec SHA-256：
`77b3e31b772e7502e08dc2544961737df8b0ca5001464f7084f87453310fc5a7`。
原 V3 SHA-256：
`03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4`。

| 实际命令/检查 | rc / 结果 | 限制 |
|---|---|---|
| `python3 /private/tmp/h1366-check-proposal.py` | 0；新 frontmatter JSON Schema、13 sections、10/10 Contract coverage、逐字/逆向比较通过 | 文本及结构检查，不是语义/产品测试 |
| `python3 .agents/tools/validate_spec_transition.py --base /private/tmp/h1366-supersede-audit/base.json --candidate /private/tmp/h1366-supersede-audit/candidate.json` | 0；`Spec transition is a valid whole-authority lifecycle state` | 输入覆盖 WEC V1→V2→V3 加 V4 proposed；不冒充全仓 semantic verifier |
| `python3 .agents/tools/verify_governance.py --target . --require-accepted` | 0；`vendored governance bytes match governance.lock.json and adoption is accepted` | distribution 完整性，不代行 Spec 接受 |
| `git diff --check`（起草时） | 0 | 当时新文件未 tracked；最终 staged/commit diff 仍须检查 |

原始可取证材料在 `/private/tmp/h1366-supersede-audit/{base,candidate,preservation}.json`。
下面是可在远端候选 checkout 重现同一关键校验的完整命令（只读仓库，JSON 输入写入临时目录）：

```bash
python3 - <<'PY'
from pathlib import Path
import json,re,subprocess,tempfile,yaml,jsonschema
base='24974c720d634b965943e08bfd0862657b9be0e1'
p='docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V'
a=subprocess.check_output(['git','show',base+':'+p+'3.md']).decode()
b=Path(p+'4.md').read_text()
fm=lambda s: yaml.safe_load(s.split('---',2)[1])
jsonschema.validate(fm(b),json.loads(Path('.agents/schemas/spec-frontmatter.schema.json').read_text()))
assert Path(p+'3.md').read_text()==a
for n in range(1,8):
    key=f'### CTR-WEC1-{n:03d} '
    assert a.split(key,1)[1].split('\n### CTR-',1)[0].rstrip()==b.split(key,1)[1].split('\n### CTR-',1)[0].rstrip()
x=a.split('### CTR-WEC1-008 ',1)[1].split('\n## 3.',1)[0].rstrip()
y=b.split('### CTR-WEC1-008 ',1)[1].split('\n### CTR-WEC4-009',1)[0].rstrip()
for pattern in [r'Before appending `attempt_planned`.*?(?= It durably records)',r"Core\nrequests evidence.*?(?= It accepts only)"]:
    original=re.search(pattern,x,re.S).group(0)
    y,count=re.subn(pattern,lambda _:original,y,flags=re.S)
    assert count==1
assert x==y
for title,end in [('0. Intent','1. Frozen boundaries'),('1. Frozen boundaries (inherited, untouched)','2. Requirements'),('3. Data model changes','4. API changes'),('4. API changes','5. Test obligations')]:
    assert a.split('## '+title+'\n\n',1)[1].split('\n## '+end,1)[0].rstrip() in b
assert a.split('## Bounded contract delta\n\n',1)[1].split('\n\nPaired authority reference',1)[0] in b
assert a.split('## 5. Test obligations\n\n',1)[1].rstrip() in b
ids=re.findall(r'^### (CTR-[A-Z0-9-]+)\b',b,re.M)
assert len(ids)==len(set(ids))==10
coverage=b.split('### Reverse Contract-to-Acceptance coverage',1)[1].split('## 11.',1)[0]
assert all('| '+c+' |' in coverage for c in ids)
records=[fm(subprocess.check_output(['git','show',base+':'+p+str(n)+'.md']).decode()) for n in (1,2,3)]
with tempfile.TemporaryDirectory(prefix='wec4-transition-') as d:
    before=Path(d)/'base.json'; after=Path(d)/'candidate.json'
    before.write_text(json.dumps(records,default=str)); after.write_text(json.dumps(records+[fm(b)],default=str))
    subprocess.run(['python3','.agents/tools/validate_spec_transition.py','--base',str(before),'--candidate',str(after)],check=True)
print('PASS: schema, complete carry, two-span inverse, 10/10 coverage, phase-1 lifecycle')
PY
```

## 8. 独立复核与交付状态

- 初始独立语义审查：`PASS — proposal authoring only`；未参与起草的
  `/root/independent_proposal_review`，固定上述 Spec bytes 和 BASE_HEAD，完成独立只读复现
  与完整 affected Contract review。`FROZEN_BLOCKER_UNION = []`、`SPEC_GAPS = 0`。
  不等于 Owner 接受或实现 conformance；最终提交还需 receipt/diff bounded delta recheck。
- `/root/succession_check` 提供前置只读格式/继承/重检可行性核查，不冒充独立语义签核。
- R3 停止时 commit / push / PR：`PENDING`；不在动作发生前填写成功。
- 实现、安装启用、生产、业务验收：`NOT_RUN / UNKNOWN`；零源码、零生产写入。
- R3 交付待办：按用户授权 commit/push/PR；R3 后因 staged whitespace rc2 停止，恢复见 §9。

### 额外实际回验

从本回执直接抽取上面的完整重现命令并执行，rc0，原文：

```text
Spec transition is a valid whole-authority lifecycle state
PASS: schema, complete carry, two-span inverse, 10/10 coverage, phase-1 lifecycle
```

辅助格式/继承核对 `/root/succession_check` 独立重新计算的 Spec hash、V3 原字节、
001..007、008 两处逆向还原及 data/API/tests 均通过；该 actor 先前参与可行性措辞建议，
明确不把此辅助结果算成独立语义签核。

## 9. R4 机械恢复与交付执行记录

记录时间：`2026-11-07T12:46:39+00:00`。R3 停止原因保留于 `STOPPED-1366-LOCKSCOPE.md`，
未删除或改写失败历史。本回执是编成件，不是 verbatim 日志归档。

R4 直接用户授权：

> ①修回执尾部空行(编成件合法修复)→staged检查rc0 ②commit(docs/wec1-008-lock-timing-supersede分支, 提案+回执+停止记录)→push→gh pr create(base main)不合并→RECEIPT标DELIVERY_COMPLETE+PR回执。
>
> 零源码零生产写入; 失败即停照旧。

`EXECUTION_MANDATE = VALID`，限原分支、三份文档、普通 commit/push 与 base main PR；
不 rebase、不接受、不合并。任一真实失败仍停止并追加此 STOPPED。当前无新 Product Contract
改写，保留 `AUTHOR / SUPERSEDE / BRIEF / DURABLE / AUTHORITY_AUTHORING` 路线。

### 9.1 机械修复与初始坐标

- Worktree：`/private/tmp/h1366-lockscope`。
- R4 起始 HEAD 与实测远端 main：`24974c720d634b965943e08bfd0862657b9be0e1`。
- 分支：`docs/wec1-008-lock-timing-supersede`；远端此分支尚不存在。
- 修复前 RECEIPT SHA-256：`ce5c1a3236f4cf5768783475bc2a14e77648bf6775867cc1da244d67cd5ee4cc`。
- 只删除 EOF 多余的 1 个换行；纯修复后 SHA-256：
  `0cdea032e7ef6266af8ce828d52ed5c3aa411e1ed07b97c356e9b938e622829e`。
- 重新 stage 后 `git diff --cached --check` 实测 rc0，stdout/stderr 均空。
- V4 仍为 842 行，SHA-256 仍是 §7 的 `77b3e31b...10fc5a7`；不重做已通过的提案语义工作。
- R4 追加前 STOPPED SHA-256：`8a2dc673829d7e68b1259dfba1001f5d50ba4df6e4faef509bd0493f22af279d`。
  STOPPED 仅追加 R4 恢复记录；R1/R2 两份 Brief 原字节保留且继续不提交。
- 交付文件白名单：本回执、`STOPPED-1366-LOCKSCOPE.md`、
  `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md`。
- 初始及最终独立审查仅做 receipt/stop/HEAD delta recheck；V4 原独审 PASS 以原 hash 复用。

### 9.2 当前交付游标

```text
DELIVERY_STATUS = DELIVERY_PENDING
NEXT_REAL_ACTION = COMMIT_THREE_DOCUMENTS
COMMIT = NOT_CREATED
PUSH = NOT_RUN
PR = NOT_CREATED
OWNER_ACCEPTANCE = NOT_PERFORMED
MERGE = NOT_PERFORMED
SOURCE_OR_PRODUCT_TESTS = NOT_RUN
PRODUCTION_WRITE = ZERO
DONE_WHEN = NOT_MET
```
