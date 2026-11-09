# D-RELEASE-PACKAGE-547 — v2 发布准备终版：隔离制品已 pin，生产切换不放行

**工程制品和排空清单已交付；回滚仍 NOT_READY，OPERATION_ALLOWED=NO。** 候选为明确的复合包：`393a0afc` 重构基础 + 从 `95a8e1cb` 原样提取的四份 D Router 文件。它不是整树 main95 包，也不是现役 `08102a55` 的替换授权。完整差量、依赖/Node 绑定及逐成员校验已固定；没有安装、重启、排空或生产账本写入。

| 三缺项 | 本轮实际结果 | 仍缺 / ITOps 边界 |
|---|---|---|
| 制品 pin | `ISOLATED_COMPOSITE_PINNED`：完整 app 文件/模式/链接 manifest、归档 digest、Node/Harness 完整绑定、四文件来源及差量已核 | 工程 pin 不等于受信构建发行者/安装准入。当前前态已是081，不能把复合候选覆盖现役；若任务被解释为必须单一整树95，本包不满足该解释，不能改标签冒充 |
| 回滚就绪 | 六文件393前像及原 provenance 在位且逐字节符合固定 Git393；清单、矩阵和 no-replay 步骤已编制 | **NOT_READY**：历史完整393 pack备份未认证；原形 legacy 副本被 exact393 reader拒读的既有证据仍成立；没有旧 reader 对候选窗口新记录的合格兼容性矩阵 |
| 在途排空 | `CHECKLIST_PREPARED_NOT_EXECUTED`：turn/occurrence/generation、单写者、fence、退出/工具边界查法齐备 | 当前在途/实际排空=`UNKNOWN`；本任务不执行排空、不推断旧 worker/tools 已终止 |

## 1. 坐标、授权与 PREFLIGHT

- Repo：`mayf3/dsh-agent-core`；worktree：`/Users/yanfenma/workspace/project/worktrees/h547-release-prep`；branch：`release/547-d-minimal-prep`；开始 Head：`0e0e0327c944216ce9965646e4d9e7d6b6298142`；交付沿用 [PR #673](https://github.com/mayf3/dsh-agent-core/pull/673)，base main，不合并。
- 当前 integration snapshot：`5360707882b4f85813d842037f660f54fd2496c8`，已 fetch。指定 D 源：`95a8e1cb512fc99dc018209d837250dd51b4d08f`；谱系：`42487e65b36f049811b0e83f90178510a3da28b7`；历史基础：`393a0afccedc5cce7be8b492c82d68d8d52206f6`。固定对象读取不依赖 production source checkout 当前 Head。
- Mutation mandate：用户本轮续办指令及 [BRIEF v2](BRIEF-547-D-RELEASE-PREP.md)。只授权本隔离工作面内的准备/证据/文档和 commit→push→PR。Watch3 comment `6718344408` 的 GitHub issues-comment 探索查询返回404，未把简报转述或本地派发文本当成本操作者生产授权。
- 已读 local grammar、Architecture、D-008/D-009 相关 Current Decisions，以及 accepted PLH V4 C-018/C-019/§12.2、HR trusted recovery V2、Scheduler V3 C-021/C-028/C-033/C-038/C-039/§9、Backup Retention V1 与 Production Deployment Control Plane V1 相关边界。本 Head..53607078 对这些相关 authority/grammar 无差异。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V4
RELATED_AUTHORITIES = HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2,
  SCHEDULER_TIMEOUT_OUTCOME_V3, AGENT_CORE_BACKUP_RETENTION_V1,
  PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = OPERATION                     # 隔离准备，不是生产 apply
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = 三项准备材料、候选pin、明确仍缺、PR不合并
CURRENT_GAP = 原停止包未完成工程准备；回滚及当前安装覆盖性未证明
MUTATION_AUTHORIZATION = VALID               # 仅本隔离工作面及Git交付
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NONE
PRODUCT_IMPLEMENTATION = NONE
OPERATION_ALLOWED = NO                       # 生产切换
PRODUCTION_MERGE_READY = NO
DONE_WHEN = 制品/清单/仍缺与入口说明可审查，commit/push/PR，不合并
EXPANSION_TRIGGER = 必需输入确实不可得、无法解释的非预期谓词、
  生产写被拒、实际字节一致性失败，或需要扩展源/生产权限
```

本轮不创建/改变 Product Contract，不替换现役，不实施账本修复。`393`、本复合包、`081` 分别保留为基础来源、隔离候选和现役字节观察，不建立新的长期兼容层。

## 2. v5 机制 QA 基础已闭合

`MECHANISM_QA_BASIS` 固定为 main [53607078 的 v5 终版](https://github.com/mayf3/dsh-agent-core/blob/5360707882b4f85813d842037f660f54fd2496c8/D-STORE-QA-547.md) 及其 [qa-v5.stdout.json](https://github.com/mayf3/dsh-agent-core/blob/5360707882b4f85813d842037f660f54fd2496c8/docs/evidence/h547-store-diag/qa-v5.stdout.json)。实际解析141条检查，失败0；5/5可识别且持续阻断、4/4可用 correlation no-replay、28窄容忍负例沿用原坐标结论。dev-engineer correlation缺失、旧工具终止及业务恢复未获证明等限制保留。原始 stdout SHA=`c5380e46323ecd4eff82fd60c8672a4d9a8debc551c0e63778a5bdec0f9879f5`，见 [QA basis](evidence/547-d-release-prep/v2/qa-basis.json)。本轮不重跑该机制 QA，也不将它升级为复合包的整机/启动/业务验收。

本分支原有 v4 QA 文本未改写；上列 exact main 链接是本次依据。旧 [STOPPED](STOPPED-547-D-RELEASE-PREP.md) 与原 [停止收据](evidence/547-d-release-prep/stop-receipt.json) 是历史记录，不再代表当前准备终态。

## 3. 候选装配、精确 pin 与完整差量

### 3.1 选择有界复合路线

既有 installer 的 app 选择与 ASSEMBLY-RECIPE 模式可用于隔离装配，**没有 source 或执行安装器入口**。整树95的官方 source选择相对393有214处差异，其中208处在六份424运行文件之外，例如新增 Memory codec、替换 Broker Workflow 模块。全选会违反简报的最小差量限制，故该路线未装配。[完整 source 选择差量](evidence/547-d-release-prep/v2/source-scope-check.json) 不是候选最终文件差量。

四份 Router D 文件在424、95、081逐字节相等；它们没有新增外部依赖。95的两份 Scheduler 文件则另外带入 `policy-auto-reconcile`、`scheduler-policy`、`receiptTimeoutSeconds` 和 `./store/*` 重构路径，不能当成393上的原样 D 最小覆盖，见 [上下文差异](evidence/547-d-release-prep/v2/scheduler-context.diff)。本候选只选四份 Router D 文件，Scheduler保持393；不采用081源码替代95。

基础闭包由只读现役 app 拷贝，在隔离区用六份经Git393认证的旧文件与原provenance还原；其余 app 字节、依赖及 literal install links保持。349份非覆盖的官方基础源码选择全部 hash匹配，无未解释差异，见 [source check](evidence/547-d-release-prep/v2/foundation-source-check.json)。这认证选中的源码；**不证明历史393的全部依赖/元数据与现在相同，也不把重构闭包称为历史完整备份**。

`development-execution/package.json` 初版选择器误计为应保留；官方配方明确在 helper之后删除整个目录、仅重拷src。选择器按源码修正后差异为0；原观察与解释保留在 [选择器修正](evidence/547-d-release-prep/v2/source-selection-correction.json)，没有为消除差异改候选文件。

### 3.2 实测制品及绑定

- app-only归档（**仅本机隔离存储，Git ignored；PR交付其manifest/收据和构建记录**）：
  `/Users/yanfenma/workspace/project/worktrees/h547-release-prep/evidence/547-d-release-prep/v2/private-attempt2/candidate-d-router-393-plus-95.tgz`
- 归档大小：`15621483`字节；SHA-256：`302804005fe9bd7090c8dd027c34b1712ab7912ef52f3245da69ba75d414afa0`。
- [候选完整manifest](evidence/547-d-release-prep/v2/candidate-manifest.json.gz)：1703项，其中1387普通文件、27链接；包含所有目录、模式、文件字节/SHA及链接原文；gzip SHA=`4255981892d53e26cd115eafe3d0a958108bb1c2e7bcb0b5eb983e50b1097d39`。解压原文SHA及各项计数见 [candidate-pin.json](evidence/547-d-release-prep/v2/candidate-pin.json)。archive共1704成员，额外一项为app根目录。
- Node：`/usr/local/libexec/agent-core/node-runtime/bin/node`，实测 `v25.6.1`，binary SHA=`c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`；[完整Node闭包manifest](evidence/547-d-release-prep/v2/node-runtime-manifest.json.gz) 固定1931文件及模式/坐标，gzip SHA=`831f1be7d52b398119d71257140a0de09022bc6bbb35a3899e77572917142a10`。
- Harness：`/usr/local/libexec/agent-core/harness`，[完整依赖闭包manifest](evidence/547-d-release-prep/v2/harness-manifest.json.gz) 固定70424文件、5618链接，gzip SHA=`154168d7ef8906234a7e49359a857e5840987f9cfa1dfaec75e5fcfe454d3068`。Node/Harness是外部绑定输入，不在app归档内；没有复制config/home/credentials/业务store。
- 装配与归档后对 live app、Node、Harness进行完整hash/坐标前后比较，全部稳定；候选树与归档逐成员文件/SHA/模式/链接读回匹配。脚本为 [build-composite.py](evidence/547-d-release-prep/v2/build-composite.py)，未执行candidate code/constructor/installer。绝对安装链接与Harness bridge保持既有目的地原文，**不得在隔离目录直接运行此树**；见 [link census](evidence/547-d-release-prep/v2/candidate-symlinks.json)。

### 3.3 文件级改动及理由

下列为相对**重构393基础app**的完整改动；依赖文件及其模式/链接零差量。每行完整旧/新SHA见 [candidate-delta.json](evidence/547-d-release-prep/v2/candidate-delta.json)，四源码SHA也见 [six-file-lineage.json](evidence/547-d-release-prep/v2/six-file-lineage.json)。

| 路径（前缀 `packages/agent-router/src/reconciliation/`） | 必需理由 |
|---|---|
| `admin-abandonment.js` | legacy精确tuple继续隔离，不能借历史cleared标志放行 |
| `durable-file.js` | 仅对命名legacy形状窄容忍，不删除或伪造历史 |
| `query.js` | 把同一legacy形状投影为recovering并保留身份 |
| `state-machine.js` | fence清除前必须有可信settlement与termination证明 |
| `app/pack-provenance.json`（相对app根实际为 `pack-provenance.json`） | 记录393基础、四个95 blob、观察依赖及多输入限制，不能把整个payload标为95 |

**当前前态差异**：本轮现役provenance SHA=`ca9a0e45149d9b59c4a93600d5a02696d8d416f40922f8e940d11b9c86e642fc`，其source/overlay为`08102a550cf2f5e14646c6858786d7fe7a50c61d`，base为393；六文件均匹配其声明。当前四份Router文件已等于本候选。本候选相对现役仅provenance和两份Scheduler文件不同，意味着覆盖现役会回退两份Scheduler改动，**本交付不允许如此使用**。provenance内旧aggregate已明确注明base-era，不能将它当现役整包digest；见 [现役观察](evidence/547-d-release-prep/v2/observed-pack.json)。没有作loaded-byte或当前运行PID证明。

## 4. 回滚：实物材料在位，兼容性未闭合

只读核到 `/Users/Shared/r129d-rollback-20261108/` 的六份原文件，全部匹配Git393，原provenance也标393；文件级SHA及11份默认backup族的有限目录/provenance观察见 [rollback-inventory.json](evidence/547-d-release-prep/v2/rollback-inventory.json)。这些材料可定位/校验，不能替代完整harness/Node/app/模式/链接等历史pack的认证；未全局搜遍主机，结论是**完整备份未认证**，不是“全局不存在备份”。没有写pin marker、复制/删除生产backup或执行rollback。

外部已有 `/Users/Shared/r129d-rollback-20261108/DEPLOY-RECEIPT.md` 记录六文件081先前部署及exact393 reader对原始legacy形状的 `LOAD_FAIL`；所谓`LOAD_OK`来自另一个把四条fence改成active的副本。该前序回执本轮仅hash/读取，不证明本操作者执行了其中动作。其四条业务事实改写/旧snapshot覆盖方案**不纳入本任务回滚计划**。v5 QA的机制PASS不覆盖exact393回滚可用性；旧业务UNKNOWN及fence均须保留。

需由原受权ITOps在合法隔离副本、精确旧完整闭包上完成下列矩阵；本轮仅交付计划，结果均`NOT_RUN`：

| 输入 / 路径 | 必须观察并记录的结果 |
|---|---|
| 切换前原形store及abandonment/faults sidecar副本 | 旧reader/真实constructor状态、完整records及所有UNKNOWN/handle/correlation/fence；constructor只能指向scratch |
| 候选正常startup/persist后的副本 | native epoch bookkeeping可解释；原业务与终止事实保持；不能strip新字段以让旧reader通过 |
| 切换窗口候选新增普通记录、UNKNOWN、registry/sidecar | 旧Router实际可读且恢复相同阻断；对所有新写形状逐类核查，拒读即不准可用性回滚 |
| Scheduler v3 occurrence/terminationSettlement/fences | 原样加载、同一fence投影；不得downgrade到V2或恢复陈旧generation backup |
| 原caller correlation / no-replay | 原入口查询同handle，duplicate mint拒绝，spawn/route/effect为0；缺correlation保留缺项 |
| legacy窄tuple与相邻坏值 | legacy继续quarantine，非法邻值拒绝；不得通过清fence或伪造settlement取得PASS |

回滚就绪需同时具备：可重装的完整旧闭包与hash、上述矩阵、窗口最新preimage与单写者/工具隔离、原rollback合同与有效执行范围。PLH V4 §12.2禁止降级忽略unresolved fence。若旧reader拒读，保持禁止降级并走原授权的V3-aware forward-fix；不得把“安全拒读”写成服务可用性恢复。

## 5. 在途排空清单（本任务未执行）

以下是给原ITOps切换窗口的只读命令和判定步骤，不是本操作者的新生产权限。`H547_SOURCE`仅作为已核验的纯reader代码来源；它不是待运行候选app。该路径当前以下reader与固定95相同，未来执行前须复核源hash；不可只相信路径名。Node必须与上节pin一致。

```sh
H547_NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
H547_SOURCE=/Users/yanfenma/workspace/project/worktrees/h547-release-prep
sudo -u authsvc /usr/bin/test -f /Users/authsvc/.agent-core/control/turn-recovery-v3.json
sudo -u authsvc /usr/bin/test -f /Users/authsvc/.agent-core/scheduler/jobs.json
sudo -u authsvc /usr/bin/env NODE_DISABLE_COMPILE_CACHE=1 "$H547_NODE" --input-type=module - "$H547_SOURCE" <<'NODE'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const paths = ['/Users/authsvc/.agent-core/control/turn-recovery-v3.json',
  '/Users/authsvc/.agent-core/scheduler/jobs.json'];
const snap = p => {
  const sig = () => {
    const s=lstatSync(p,{bigint:true}); assert(s.isFile() && !s.isSymbolicLink());
    return ['dev','ino','mode','uid','gid','size','mtimeNs','ctimeNs'].map(k=>String(s[k])).join(':');
  };
  const before=sig(), bytes=readFileSync(p); assert.equal(sig(),before);
  return {sig:before, sha:createHash('sha256').update(bytes).digest('hex'),doc:JSON.parse(bytes)};
};
const before=paths.map(snap), [turns,jobs]=before.map(x=>x.doc);
assert.equal(turns.version,3); assert.equal(jobs.version,3);
assert(Array.isArray(turns.records) && Array.isArray(jobs.jobs) && Array.isArray(jobs.occurrences));
assert(jobs.fences && typeof jobs.fences==='object' && !Array.isArray(jobs.fences));
assert(typeof turns.runtimeEpoch==='string' && turns.runtimeEpoch.length>0);
const { readRestartDrainCensus }=await import(pathToFileURL(process.argv[2] +
  '/packages/production-runtime/src/scheduler/restart-drain.js').href);
const census=readRestartDrainCensus({turnRecoveryStore:paths[0],jobsStore:paths[1]});
const after=paths.map(snap);
assert.deepEqual(before.map(({sig,sha})=>({sig,sha})),after.map(({sig,sha})=>({sig,sha})));
console.log(JSON.stringify({census,storeHashes:before.map(({sha})=>sha),
  unresolved:turns.records.filter(r=>r.state!=='settled').map(r=>Object.fromEntries(
    ['handle','agentId','processGeneration','runtimeEpoch','state','recoveryState','initialOutcome',
      'fenceState','terminationEvidence','exitObservedAt','adminAbandonment','callerCorrelation'].map(k=>[k,r[k]]))),
  occurrences:jobs.occurrences.filter(r=>['admitted','running','outcome_unknown'].includes(r.state))
    .map(r=>Object.fromEntries(['jobId','occurrenceId','runId','requestId','state','terminationSettlement'].map(k=>[k,r[k]]))),
  fences:jobs.fences},null,2));
NODE
```

任何文件不可得、schema不明或读前后变化→该次census=`UNKNOWN`，不能当空集。合法在途变化后在原窗口重新采一致观察；持续不能一致就不切换。不要构造 `TurnReconciliationStore` / `JobStore` 或调用cron list/runs代替纯读：constructor可能持久化，JobStore旧版本加载会自动升级。

generation只读查法（不固定历史PID23085）：

```sh
H547_NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
H547_SOURCE=/Users/yanfenma/workspace/project/worktrees/h547-release-prep
NODE_DISABLE_COMPILE_CACHE=1 "$H547_NODE" --input-type=module - "$H547_SOURCE" <<'NODE'
import { pathToFileURL } from 'node:url';
const { createLaunchdAdapter }=await import(pathToFileURL(process.argv[2] +
  '/packages/production-runtime/src/scheduler/deployment-launchd.js').href);
const a=createLaunchdAdapter({launchctl:'/bin/launchctl'});
const current=a.readRuntimeInstance('system/ai.agent-core.runtime');
console.log(JSON.stringify({runtime:current,sameNativeInstance:a.readProcessInstance(current.pid)},null,2));
NODE
sudo -u authsvc /usr/bin/stat -f '%d:%i:%z:%m:%c:%Su:%Sg:%Sp' /Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock
sudo -u authsvc /bin/cat /Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock
```

lock缺席/身份不明不能证明唯一写者；已有lock只读核对owner PID/token与exact runtime，不acquire/reap/delete。PID/uid/gid/started/program须与epoch及handle/generation合并观察，裸PID、CPU=0或驻留Agent进程数不构成排空。

切换窗口逐项签收：

1. 原ITOps依原runbook建立admission barrier，记录actor、有效窗口、旧native实例与epoch；本任务不实施barrier。
2. 上列census可用，`inflightTurns=[]`、`inflightOccurrences=[]`。blocked/旧epoch UNKNOWN单列且继续fenced；若原runbook要求三列表全空，则不能使用普通drain对lost记录的排除来绕过它。`precheck_zero_inflight.mjs`本来会对非空lost列表返回1，不把该预期拒绝伪装成故障或PASS。
3. 运行中Router的`lifecycleSlotSnapshot()`或既有受控停止路径的exact边界收据须覆盖STARTUP/READY/REAP；空registry/普通health不足。没有完整只读endpoint就由原执行链取既有证据，不新建Router模拟现场。
4. 原停止路径若使用`restart-boundary.js`门，核对新鲜`quiesce_begin/end`、同PID/epoch、`stopResult=stopped`、slots/turns/occurrences全空、durableEpoch一致、无新lost、旧exact native实例已退出。源码存在不证明producer已安装/该能力已加载；缺证据维持不切换。
5. 单写者窗口内旧写者已退出/隔离，Scheduler lease归属清楚，再由原runbook允许一个新writer。DRAINING/EXITED的parent-side barrier只阻止未来RPC；已发工具需另有终止/实际写边界隔离证明，旧PID消失不能代替。
6. 保留所有UNKNOWN/fence、registry/marker/faults关系与no-replay限制；不清fence、不恢复旧业务snapshot、不重投旧prompt。授权窗口变动、未排空或原门拒绝时停止切换。

源码实名：`restart-drain.js:101`（纯读census）、`:125`（普通60s/2s门）；`restart-boundary.js:145`（exact proof）；`deployment-launchd.js:3`（只读native adapter方法）；`parent-rpc-relay.js:63`（future effect barrier）；`scheduler/src/store.js:96`（lease）。清单不是新的产品gate，原runbook的实际适用门仍控制执行。

## 6. ITOps 执行入口与权限覆盖性初判

**本包当前入口为：查阅pin/差量/缺项；不安装、不重启、不排空、不重放。** 没有可批准直接覆盖现役的命令。

定位到的旧操作文本/回执绑定081六文件以及当时的TERM窗口，不是本复合artifact的授权。Watch3原签发链未在本轮认证，原Controlled runbook的完整有效actor/窗口/attempt/rollback边界亦未核全。`EXISTING_MANDATE_COVERS_THIS_ARTIFACT=UNPROVED`；不能因源在main、同一D机制或先前081部署而继承权限。

后续若原执行者证明其有效原授权逐项覆盖精确制品、当前前态和回滚/排空条件，按原runbook另行执行并独立读回；否则，只向原授权方提交一个精确的覆盖缺项，内容四要素为：**①原actor与目标host/runtime/install-root ②source组合及artifact/Node/Harness digest ③确切apply/rollback操作类和允许/禁止effects ④窗口、attempt/abort边界及receipt/readback要求**。本报告不发送该请求，不自行扩权。

现阶段技术前置仍有两个，不能伪称“只差一次批准”：完整393历史回滚闭包/原形兼容性未闭合；当前081前态不等于393且本候选会回退Scheduler。首先由原链处理这些事实；如复用现役已具有的D字节，应走原已安装能力的证据复核而非重复安装，本任务不启动新的生产验收。

## 7. 修正语义、验证与停止边界

- 对空查找、错误object数据库位置、引用笔误记录后续查；必需QA/源/provenance实际可得，未因此停止。见 [解释记录](evidence/547-d-release-prep/v2/explained-discovery-errors.json)。
- 首次app-only装配检查把Harness相对bridge错误地按隔离目录解析，rc=1；实际外部Harness输入一直存在。改为在明确安装目的地验证literal目标并固定完整绑定，没有改源码、artifact链接或生产数据来消除失败。失败输出目录/脚本/收据保留；最终使用新目录。见 [harness修正](evidence/547-d-release-prep/v2/build-harness-correction.json)。
- 最终归档校验、来源、完整成员、delta及输入稳定性全部PASS；独立逐成员复核PASS。治理分发完整性校验rc=0。未重跑不变机制，没有生产试写或自动部署。
- 本操作者生产store读取=0、authsvc调用=0、生产写入=0、安装/重启/signal/清fence/排空/真实业务请求/旧UNKNOWN重放=0。读取的是可读安装代码、runtime依赖字节与已有本地回执；不推断其他actor或正在运行的服务自身行为。
- 独立准备材料/最终Head复核见 [independent-review-v2.md](evidence/547-d-release-prep/v2/independent-review-v2.md)。本次交付结果是隔离准备与明确缺项，不是production-ready、runtime-loaded或business-recovered。达成交付边界后停止；PR不合并。
