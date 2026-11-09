# SRA effectiveness control census and minimal delta proposal

本报告是 `BRIEF-SRA-CONTROL-CENSUS.md` 的 docs-only 普查与设计交付，不是 governing Spec、任命、生效收据或窗口 Mandate。结论：已有可复用的控制原语；**六类 SRA 拒绝能力的完整链路尚未获证，条件④仍未闭合**。下列测试全部是设计，`NOT_EXECUTED`；本轮生产写入=0、认证面调用=0、controller/profile 激活=0、merge=0。

观察日期：2026-11-09 UTC；仓库 `mayf3/dsh-agent-core`；隔离工作树 `/Users/yanfenma/workspace/project/worktrees/ops-sra-control-census`；分支 `ops/sra-control-census`。作者起点与 integration base 均为 `5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7`（下称 **B**）。本轮 `git ls-remote origin refs/heads/main refs/heads/chore/fleet-window-tools refs/heads/recon/pertarget-successors` 实测rc0，stdout依次为 `63e195ddd79786b4d5f52a2b3f1d730c69a85b5b refs/heads/chore/fleet-window-tools`、`5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7 refs/heads/main`、`b7a1d88948b7108f613496544d38e3892ec82b1d refs/heads/recon/pertarget-successors`（原输出以tab分隔）；后续远端连接出现代理不可达，不能用本地 ref 代替后续远端状态。

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
schema_version = 2
GOAL_OR_TARGET = 四节控制普查/最小差量/隔离负向测试设计 + docs PR
CURRENT_GAP = SRA-C-006 第5步真实拒绝能力及资格绑定未证
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1@B
RELATED_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@B
ROUTE_STAGE = IMPLEMENTATION  # 仅调查文档交付；不实施产品
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = not_applicable
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE  # 持久报告独立审查；不是生产操作
MUTATION_AUTHORIZATION = VALID  # 用户本轮任务 + 随附简报
ISOLATED_WRITE_SURFACE = YES
PRODUCT_IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MERGE_ALLOWED = NO
SPEC_GAP_DEPENDENCY = NON_LOAD_BEARING  # 未证控制阻止生效/操作，不阻止本报告
DONE_WHEN = 报告+简报单commit、push、PR(base main)；不合并
EXPANSION_TRIGGER = 权威冲突、需扩大权限/认证调用/生产效果；仅停止依赖工作
```

## 1. 现有机制盘点

### 1.1 证据范围、权威与固定坐标

读过 `.agents/README.md`、`.agents/local/README.md`、Product Architecture、Current Decision 索引及相关 D-008/D-009、SRA、DCP 和 spec-governance/PREFLIGHT。Architecture 的冻结草案标记保持原状；不自行提升生命周期。D-008 的 principal/workspace/session 所有权、D-009 的 UNKNOWN/不重放边界保持不变。接受权威高于实现与现场状态；发现的工具冲突只作为待处理事实，不反写 accepted 意义。

以下路径若无前缀，均相对仓根。`B:path:Lx-Ly` 可用 `git show B:path | nl -ba` 复核。分支坐标不意味着已合 main：

| 别名 | 精确坐标 | 用途与限制 |
|---|---|---|
| B | `5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7` | 本轮 main 快照；SRA 激活 merge #682；不是任何生产 apply 许可 |
| F | `63e195ddd79786b4d5f52a2b3f1d730c69a85b5b`，`chore/fleet-window-tools` / [PR #629](https://github.com/mayf3/dsh-agent-core/pull/629) | 按简报直接读取此分支的 W6/S04/S05，不 checkout、不运行 |
| A | `b7a1d88948b7108f613496544d38e3892ec82b1d`，`recon/pertarget-successors` | `CAPTAIN-APPOINTMENT-REGISTRATION-20261109.md:L3-L16,L29-L39`，条件式登记，未视为 accepted main 权威或生效任命 |
| R | `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json` | 外部可变台账，只读选择记录，不复制全表、不写入 |
| M | `/Users/yanfenma/.agents/skills/dispatch/scripts/dispatch.py` | 外部 M7 dispatch 源码，只作机制参照，未调用其派发/认证入口 |
| D | `/usr/local/libexec/agent-deploy-system/deployment_system.py` | 现场已安装的可读控制源码；与 DCP 规范中的 agent-deployd 不混同；loaded/version/adoption 未证 |

固定内容实测 SHA-256（读取 Git object 字节计算；下列不是资格签名）：

| 对象 | SHA-256 |
|---|---|
| B:`docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md` | `1383eaa59480b4461fe89d0beae0d27d2ddcb0043d34e059a3559d45860580eb` |
| B:`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` | `c46b84ef91637a88929dd0f297bfb794ca80ee6b2719f495f90d0034aaa84e25` |
| B:`scripts/fleet-window/window-executor-v5.sh` | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` |
| B:`scripts/fleet-window/window_helper_core.py` | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` |
| B:`scripts/fleet-window/window_helper.py` | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` |
| F:`EXECUTION-MANDATE-W6-V2.md` | `7b35095d2beb0563cbb531e4d444c8bc89b2512e667a16d4e1afe0abf31fb89a` |
| F:`RECEIPT-W6-S04-R2.md` | `2fa894eb1836cc4993d2160e702facb7517ddbdac091642aab84236d7ccac4d5` |
| F:`INVESTIGATION-W6-S05.md` | `acd4568335dc3c5f4e956f12bda1ec05d32735fc2370994fab585f465b82e8ed` |
| F:`RECEIPT-S05-MANDATE-FINAL.md` | `bd402f188c12692cdb13455e50b240a3a6ebbd81d3778a1da43e1c3af68ddbd7` |
| A:`CAPTAIN-APPOINTMENT-REGISTRATION-20261109.md` | `66446073db7400643f24775499b3521543453488e5407f5f777d052d6851ecf3` |

SRA 当前文件 blob 为 `9eca8b7c48f324db34887b6ccc2b9619719cdb8b`；生命周期行引用的历史 semantic blob 不冒充当前整个文件 blob。B 的 SRA frontmatter `L29-L38`、`L65-L69` 区分 main 接受与条件式生产权限，`L151-L173` 要求可归属角色、UTC期限、独立性及每次签发/依赖写入边界重核撤销。`L175-L189` 排除新 controller/profile/trust root/扩权；`L191-L242` 给 G01–G16、stage10 和逐门 receipt；`L268-L280` 的第5步要求真实拒绝、实际入口版本/hash、控制所有者、负向资格和独立 verifier。A 的 `L10-L15` 记专用 principal（identity-only），`validFrom=EFFECTIVE收据时刻`、`validUntil=2026-12-07T16:00:00Z`，`L31-L35` 仍待控制资格/身份延续。未调用 Auth 来确认其当前状态。

### 1.2 DCP 全部 CTR：已有合同要求不等于已生效实现

统一坐标为 B:`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md`。`L22,L27-L31` 为 implementation accepted / production apply none；`L410-L426` 的 profile 表不启用 profile；`L428-L450` 是未来验收定义，不是执行结果。

| CTR-DCP | 行号 | 既有要求与可复用责任 |
|---|---|---|
| 001 | 104–114 | authenticated producer、revision CAS、完整分页/水位 readiness；merged/self-PASS 不准入 |
| 002 | 116–146 | immutable unit：repo/source/artifact/profile/policy/reviews/expected generation/receipts；request去重与intent尝试预算分离 |
| 003 | 148–162 | 同 intent 一次成功安装，已安装仅验证，覆盖证明、依赖与不可替换在飞单 |
| 004 | 164–174 | canonical接受、source/tree、受信build/review issuer、完整工具链闭包；hash/自写JSON不足 |
| 005 | 176–187 | 固定CAS入口、manifest/types/metadata、私有封印、apply前后与输出rehash；漂移拒绝 |
| 006 | 189–199 | mutex内 fresh接受/撤销/policy epoch，受保护单调签名更新、最长5分钟lease；无关main前移不失效 |
| 007 | 201–212 | kernel peer + bootstrap ACL/role/scope；共享UID不能区分Agent，需独立producer assertion；严格声明式请求 |
| 008 | 214–224 | profile冻结target/effects/身份/命令模板/闭包/回滚；禁止caller选路径/env/launchctl/chmod/chown |
| **009** | **226–236** | **唯一永久锁inode、同次获取覆盖PRECHECK至RELEASE；不unlink、不信“已持锁”字符串；child/effects对账后才释放** |
| 010 | 238–253 | transactional queue/CAS/DAG/FIFO/STOP_TRAIN；unknown隔离host写lane |
| **011** | **255–282** | **不可逆边前flush intent/preimage/phase/ownership，启动锁内对账；UNKNOWN隔离、不盲重放；有界尝试不因换ID刷新** |
| **012** | **285–296** | **锁内完整code/config/metadata/service前镜像/ABSENT，live face漂移停止；逐slot journal+rename；验证真实loaded generation/digest** |
| **013** | **298–307** | **仅daemon捕获前镜像、精确profile targets，恢复前核当下face；不能覆盖无关漂移；UNSAFE_ROLLBACK隔离；不恢复业务副作用** |
| 014 | 309–323 | per-Goal验收与安装分开，未知canary不重发，finalize后才关闭Goal |
| 015 | 325–335 | root append-only transaction/per-Goal收据，source/artifact/profile/policy/review/caller/issuer/pre/post/generation/attempt/step/rollback/verifier；脱敏导出 |
| 016 | 337–354 | standing authority+enabled profile+全部门才AUTO_DEPLOY；普通缺证BLOCKED，拒绝不可被“批准”覆盖 |
| 017 | 356–366 | controller/profile/trust root 独立精确bootstrap、epoch/receipt；fixture/review不授生产权 |
| 018 | 368–388 | canonical/外部/旧writer/lifecycle全覆盖退役和负向bypass；同UID signal/GUI权限未撤销不能称全局准入 |
| 019 | 390–398 | 可选deployctl仍同queue/policy/journal/mutex，有sunset，绝非平行train |
| 020 | 400–408 | disk/journal/trust/fsync/metadata失败拒绝，有限资源/恢复，证据保留 |

本轮 lstat 看到 `/usr/local/libexec/agent-deployd`、`/Library/LaunchDaemons/ai.agent-deployd.plist`、`/var/db/agent-deployd` 存在（root:wheel，分别0755/0644/0700）；规范socket `/var/run/agent-deployd/control.sock` 返回 ENOENT。实际二进制 `/usr/local/libexec/agent-deployd/agent-deployd` SHA-256=`56ac8c28c753c70bbb350e91a95b327bd18cbe1c4e82ff49ad3fbd4fa812d2b6`；上述plist SHA-256=`c09e24824db86db2267da236594b94d1d36399171e9d6b25e78a928c66af095b`，内容声明 `Disabled=true, RunAtLoad=false, KeepAlive=false`。目录/plist存在不能证明该 DCP 已按CTR部署/加载/采纳；不能沿用2026-09普查的“未安装”作为今天结论，也不需要为SRA启用它。

另一个**不同的现有链** D 已安装可读。D 的实测 SHA-256=`9044abfd5d1616e28c2c4226fc5dae27b8450a8636e7865e09c7b549919219f9`（111,825,623 bytes）；同目录 `ds_client.py` SHA-256=`040f6e053a1b683b8aecd8a1a6239e7187e92e885a91e97df41a919001662889`。静态坐标：

| D 坐标 | 已有 source 能力 | SRA 限制 |
|---|---|---|
| L130–148 | TEST_MODE及固定state/socket/config/registry路径 | 未执行TEST_MODE；不是默认干跑安全承诺 |
| L707–732 | load_registry、unit shape `{kind,target,uid,gid,mode,restart[,preserve]}` | registry不是Captain任命台账 |
| L653–700 | temp/full write/fsync/replace/dirfsync与temp inode复核 | 局部原子收据writer已有，不证明Captain资格或所有外部收据持久性 |
| L767–775 | `mutation.lock` + `flock(LOCK_EX|LOCK_NB)` | 只证明此源码domain局部互斥，不能证明与fleet/DCP锁统一 |
| L1898–1956 | operation consumed检查、取unit、锁内重查；fixed_capture分支重查registry generation | 不等于签发资格或撤销检查，也不能把fixed_capture重查推广到所有unit |
| L1958–1995 | artifact/file/tree和live preimage hash拒绝 | 局部漂移控制；缺SRA/appointment/控制资格全tuple |
| L1926–1936,L2162–2175 | operation/unit/registry_generation/start/stages/version，失败或COMPLETE收据、artifact/generation/rollback/restart/health | 未见SRA G01–G16完整consumer；COMPLETE不能当SRA生效或业务成功 |
| L4845–4847,L5066–5081 | DEPLOY严格请求字段，未知字段拒绝 | 直接塞入appointmentRef等新字段会被拒绝，不能靠改JSON接线 |
| L5197–5229 | production需root、authorized-owner-uid、socket0600 | owner UID不是Captain principal/session；不证明跨session身份 |

对本次D文件整字节大小写不敏感搜索，`appointment/captain/sraRevision/appointmentRef/mandate`各0命中；这只界定所查实现，不能推出所有外部控制不存在。`/private/var/run/agent-deploy-system.sock`及shim socket的lstat为502:0/0600；未连接。受保护 `deployment-registry.json` 返回 PermissionError；ps 在当前沙箱被拒绝。**当前profile内容/启用状态、真实loaded bytes、源repo/revision/安装授权绑定均UNKNOWN**，不能根据安装源码自授适配或声称DCP实现合规。D的plist `/Library/LaunchDaemons/ai.agent-deploy-system.plist` SHA-256=`9861fe868f97fffaf0323746a9f150bc7829656a1a76df8974a768bf745e1339`（root:wheel0644），声明固定python入口与RunAtLoad/KeepAlive，仍不证明当前加载。另有 `/usr/local/libexec/agent-deploy-shim/deploy_shim.py`（SHA-256=`6de7ad6ce3acb59d863c73127c292e93fb13b6c803b0bc24c4012023a8dfdcb7`），本轮未完整审计其mutation路径，计入Δ0待归属面，不宣称全覆盖。

### 1.3 fleet-window：W6、S04、S05 与 main 工具分列

- F:`EXECUTION-MANDATE-W6-V2.md:L3-L7` 是 `NOT_AUTHORIZED / EXECUTION_STOPPED_UNKNOWN`，批准前零stage00。`L13-L25` 精确绑定app/harness/Node/实际installer与stock差别；`L73-L139` E01–E17及树外权效/部分写前态；`L145-L169` 阶段和UTC预算；`L173-L183` preimage/R1/R2/v3-aware回退；`L245-L276` 当次申请字段。它可复用为模板，不能当本次合法Mandate。
- F:`RECEIPT-W6-S04-R2.md:L5-L7,L92-L110,L1810-L1841` 保存20指定隔离门rc0、runtime16/16、cold-session三例/零模型和封存。仅该tuple的历史 `PASS_ISOLATED_S04_R2`；本轮读取未重跑，不证明生产/认证/S05或今天installer资格。
- F:`INVESTIGATION-W6-S05.md:L15-L38,L44-L60` 与 `RECEIPT-S05-MANDATE-FINAL.md:L34-L40`：旧pause无候选reader，containment只覆盖退出至bootstrap前；stamp writer/JSON reader冲突、树外前态/完整工具bundle未证。它们保留UNKNOWN，不能由Owner批准文本代替机制。
- B/F:`scripts/fleet-window/window_helper_core.py:L25-L38` 的 `validate_authority` 已检查字段、非root writer UID、固定old SHA、required scopes超集、UTC时窗。`L88-L91` 后续 `authority()`只检查复制后JSON的UTC；无issuer/appointment/revocation查询。额外scopes仍可通过 `required ⊆ supplied`，不是完整越界拒绝。
- B:`scripts/fleet-window/window_helper.py:L5-L19` 保存authority/invocation hash、原子mkdir争锁与holder digest核所有权；`L54-L120` 校验source/harness、封印bundle、closure/canary/runtime收据；`L160-L189` 预镜像及重核；`L252-L283` final closure/ACL/bytes/link/mode/config绑定。**这些局部source能力 EXISTS**，有可复核坐标；不代表实际运行资格。
- B:`scripts/fleet-window/window-executor-v5.sh:L157-L161,L305-L318` 将authority/mutex与stage顺序串联，main包含03b/06a；失败保全mutex/证据，不清他人锁。默认dry-run只打印stage，不能作为六类拒绝的资格测试。

**具体冲突及停止范围：**F 的 W6 V2 `L155-L157` 要求stage04纯观察、runtime down后才exact05b，但F:`scripts/fleet-window/window_helper.py:L128-L137` 在quiet op停机前调用 `settle-all-pending.sealed.mjs` 并追加日志（runner `L166-L177` 调用该op）。B:`scripts/fleet-window/window_helper.py:L121-L132` 已无该分支；B runner `L305-L311` 与F `L285-L290` 的阶段也不同。本报告不选择分支语义覆盖accepted边界，不执行该quiet，不拼接历史bundle宣称资格。**该分支quiet执行/直接复用停止；无依赖的docs普查继续。**

现有deploy/ITOps模板还包括：B:`.agents/templates/EXECUTION_MANDATE_TEMPLATE.md:L1-L49`（issuer/authority/actor/environment/exact operation/effects/UTC/attempt/abort/Secret/receipt/独立post-state/UNKNOWN）；SRA `L197-L218,L232-L239,L264-L266`（逐门与STOP字段）。B:`scripts/trusted-cp-deploy-install.sh:L119-L181` 已有 `recorded_at/exit_code/failed_at_stage/stages_completed/preimage_bak/reused_preimage_subtrees/restore_r1_required/restore_r2_required/mutation_truth`，但best-effort文件写不能称不可变/原子签发凭证。B:`deployment-artifacts/hr-s256-trusted-cut-v1/profile.py:L1-L5,L51-L104,L124-L198` 有subject/deployment/preimage/hash/nonce/因果收据，可作精确绑定参照；实际入口固定 `PROFILE_NOT_BOOTSTRAPPED`，不是可启用生产profile。

B:`scripts/lib/deployment-reuse/receipt.py`（SHA-256=`b271ab5f0f338c79707afac63f704c65631dd13e5ce2e89fcc563f54f4bc3148`）是现有非特权receipt observer：`L1-L4` 无socket/retry/锁写；`L14-L17,L33-L71` 固定allowlist/64KiB/nofollow与custody；`L72-L95` 绑定operation/unit/registry generation并返回digest、`replayAllowed=false,currentRuntimeVerified=false`，读错为UNKNOWN。可复用查询，不需要另建receipt平台；不把历史receipt当当前runtime证明。

### 1.4 Registry 与 M7：来源、幂等和锁的可复用部分

R按唯一selector取整个ruling record，canonical为UTF-8 `json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，无末尾换行；不是按可变数组index取authority。仓内算法坐标 B:`docs/reports/sra-v1-formalization-20261107/conversion-receipt.md:L3-L5`，接受绑定在SRA frontmatter `L11-L14`。2026-11-09T05:14:36.921691Z只读原件复算：

| selector | canonical SHA-256 |
|---|---|
| `$.rulings[id=owner-20261107-preauth-v2]` | `087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006` |
| `$.rulings[id=owner-20261107-sra-formalization]` | `f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129` |

两者与仓内快照一致。R全文件当时SHA=`f378dd5a54f350af2605dee88844b05f1be6367cff3b18fe04a8abfb239ddd4c`，只作时点定位。**selector+canonical hash 来源绑定能力 EXISTS；hash不认证issuer/真实caller/当前任命/时效/撤销。**所查b7ctl/M7未发现消费这些ruling的SRA执行授权校验器，搜索空结果不扩大为全系统不存在。

M实测SHA-256=`9dd3989842f2252f29d02d2f89c980d90b043a6554e66e7e6b96db726a4549a7`。其局部源码原语 **EXISTS**：`L100-L105` 独立lock文件+flock后读取；实际后定义的 `L213-L221` 同目录mkstemp/flush/fsync/replace/chmod0600；`L118-L121,L262-L293` 请求hash、网络前锁内PENDING、网络后落状态；`L304-L340` resend锁内CLAIMED后锁外发送；`L190-L203` 超时记UNKNOWN；`L345-L381` Dispatch-ID强关联验证。限制：advisory lock只约束合作writer；没有目录fsync证明；发送期间不持锁；不是全生产窗口mutex；board-state `L294-L296` 不受同等锁/原子写保护。resend实现虽拒绝DELIVERED/UNKNOWN/CLAIMED等，但未显式限定原状态必须FAILED，PENDING可能通过，不能照注释声称“严格仅FAILED”。这些是参照局限，不在本轮顺带修复或派发。

## 2. 六类拒绝能力判定表

判定口径：`EXISTS` 只指有精确坐标支持的对应能力；`PARTIAL` 指局部机制/合同存在但SRA全链未证，未知写明UNKNOWN；`MISSING` 只用于已查入口具体缺少的consumer，不推导全主机不存在。**没有任何一行可据本轮登记SRA EFFECTIVE**。

| 拒绝类别 | 现有能力坐标 | 判定 | 缺口一句话 |
|---|---|---|---|
| 未任命 | SRA-C-001/006；A:L3-L16；B helper_core:L25-L38；D:L5197-L5229；R selector | **PARTIAL** | 有任命字段与UID门，但真实caller→合法任命→独立性→实际入口资格绑定未证，身份延续/loaded资格UNKNOWN。 |
| 越界 | SRA-C-002；DCP-007/008/016；D:L707-L732,L5066-L5081；B helper_core:L33-L34 | **PARTIAL** | fixed unit/严格字段限制存在，但缺 `requestedEffects ⊆ appointmentScope ∩ mandateScope ∩ admittedProfileEffects` 与STANDARD_RECOVERABLE排除项机械判定。 |
| 过期 | SRA-C-001:L165-L173、G08；B helper_core:L25-L38,L88-L91 | **PARTIAL**；窗口UTC过期子能力 **EXISTS** | window UTC已拒绝，Captain任命UTC、生效时刻/期限、各实际写入边界共同重核及可信时钟失败策略未证。 |
| 撤销 | SRA-C-001:L173、DCP-006；R历史链；B helper_core:L88-L91；D已查DEPLOY路径 | **PARTIAL**；已查fleet入口的fresh Captain撤销consumer **MISSING** | 合同与台账参照已有，但执行只读authority副本，fresh可信撤销读取/代际/失联拒绝未接线；其他运行控制UNKNOWN。 |
| 候选漂移 | DCP-002/004/005/012；B helper:L54-L120,L252-L283；D:L1958-L1995；F W6:L13-L25 | **PARTIAL**；字节/preimage子能力 **EXISTS** | 缺issuer/SRA/appointment/control版本/qualification与app/tree/harness/Node/installer/bundle/expected-live完整tuple的统一绑定及边界fresh读取。 |
| 缺门 | SRA G01–G16/§4；DCP-009/011/012/013/015；B helper:L86-L120,L160-L189 | **PARTIAL** | 局部closure/preimage/receipt门可复用，全部适用门的材料/阶段事实、独立verifier消费与不可旁路拒绝未获证。 |

因此未查到完整控制不是新建平台的理由；同样，已有hash/mutex/receipt不是生效证明。DCP、D、fleet、M7锁对象和信任模型不同，不能合称“全局mutex已统一”。

## 3. 最小差量提案

以下是**非权威、未实施、待后续独立路由/审查的设计**。优先确认真实已准入入口再适配；本报告不授权安装、加载、升级控制器或profile。若适配触及新权限/信任根/长期合同含义，停止该依赖并另行PREFLIGHT；不得用本提案改写SRA或DCP stable ID。

| 差量 | 优先修改的既有文件/工具（后续任务） | 最小语义与可结束交付 | 为何不是新平台/边界 |
|---|---|---|---|
| Δ0 找准真实入口及来源 | D、同目录ds_client及既有安装/资格收据；B fleet runner | 控制所有者先绑定源repo/revision→安装bytes→loaded入口→已准入profile/目标/当前writer；源与授权未知先补归属收据，不能直接patch installed文件；记录DCP/D/fleet实际调用链与所有可达写入/重启路径。 | 只做已有入口inventory和资格关联，不增controller/权限；没有可证明安全的现有入口就保持条件④未闭合。 |
| Δ1 issuer/appointment核验 | B:`scripts/fleet-window/window_helper_core.py` 的validate_authority/authority；若真实入口为D，则在其**归属source**的legacy_handle/deploy现有admission处适配，ds_client同步严格字段 | 在原Mandate中引用accepted SRA revision、唯一任命selector/canonical hash及当前生命周期、真实caller principal/session、C/A/W/V冲突矩阵、资格收据。由现有受信身份关系/issuer政策认证；请求自报principal/UID/hash不得授予角色。跨session证明归原身份链。 | 复用原registry/PR/Mandate/receipt；不新建principal/Client/Secret/Grant，不以新的JSON作为授权。D当前schema拒绝这些字段，必须真实source适配并获准，不能仅更新模板。 |
| Δ2 范围、期限、撤销fresh检查 | 同一validator + 现有registry只读reader/查询；runner每个真实write/lifecycle调用前 | 请求效果取任命/Mandate/已准入profile交集；明确标准类五判据与排除项。取window与appointment UTC交集；签发及每个依赖写入边界重读可归属撤销/缩窄/代际，缺失、重复selector、读失败、过期/回退或UNKNOWN均不发新签发/写入；在飞按原获准安全配方。 | 一个核验步骤供既有入口复用，不造撤销服务/第二台账；canonical hash固定来源且必须另核新撤销状态，不能只存revoked:false；沿用DCP已有policy freshness要求，不擅造信任根。 |
| Δ3 候选与门完整性 | B helper的prerequisites/final-binding/preimage；SRA现有Mandate模板；D实际source的artifact/preimage gate | 将app/tree/harness/Node/installer/bundle/expected-live/控制入口版本与qualifier receipt绑定到同一sealed tuple；G01–G16按适用性/签发前材料/阶段事实列出，证据需可读、hash/对象/时点/actor/method/rawRC/结果吻合。未到阶段记录REQUIRED_AT_STAGE，不能先填PASS；缺签发材料拒签，缺阶段事实拒过相应阶段。 | 增强已有receipt消费，不再建审批流/新证据库；不重做未失效S04门，不用新main SHA强迫无关候选重批。完整preimage不因hash表齐全就合格。 |
| Δ4 保持唯一writer与不可旁路 | B runner/helper的mutex及实际install/bootstrap/restore边界；若D为真实入口则复用其mutation_lock/journal | 在真实mutex持有期内fresh核验与执行，保留owned child/effects/UNKNOWN；候选或策略变动拒绝。qualification覆盖可达直连helper、旧writer与重启路径；未覆盖不能称全局控制。M7只借鉴锁内claim/原子replace，不直接替代生产锁。 | 不建第二mutex/队列/train；若需撤销旧权限或新controller/profile采纳，依DCP-017/018和SRA排除项单独处理，本任务不实施。 |
| Δ5 资格收据与独立验收 | 原window receipt / D既有operation receipt的source writer及现有QA回执 | 持久记录入口source/installed/loaded hash各自坐标、owner、任命/撤销查询revision/时点、candidate tuple、各门与六类负例rawRC/观察、limitation和独立verifier；完成后原合法任命链才可办理生效，validFrom来自真实收据。 | 扩展原收据与PR，不建资格数据库；隔离PASS仅支持机制，仍须证明实际入口/控制策略/所有写入边界绑定，不能自动登记EFFECTIVE。 |

明确**不需要新建/本轮不做**：第二审批平台、registry、角色/认证服务、凭据/Grant、部署队列/Train、另一个dispatcher、通用root shell/helper、业务状态恢复引擎；不为本普查新建governing Spec，不改accepted spec。保留现有preimage/rollback、closure与metadata校验、原mutex和收据；不以“简化”删门、用旧PASS贴新tuple。F的冲突quiet不作为候选执行路径；历史Mandate/S04/S05只RETAIN作证据，拟适配以B实际路径和已准入入口为准，不维持新旧双重可执行模型。

后续可完成顺序：Δ0原控制所有者补来源/调用链→在明确权限内实施Δ1–Δ5并独立审查→§4隔离负向资格→绑定实际已获准入口与verifier收据→原合法任命链处理EFFECTIVE。缺源/loaded/profile事实时保持UNKNOWN与相应readiness=NO；不把普通资格修补一律转成WAITING_OWNER。确需扩权才按SRA-C-005 O3升级。

## 4. §6.5 负向测试设计

本节对应SRA-C-006第5步（简称§6.5）。**六例均NOT_EXECUTED，无测试PASS声明。** 后续独立verifier使用精确已审候选及入口hash，在可丢弃非特权fixture中执行；当前缺少的SRA adapter不能用一个新写mock validator代替真实被测逻辑。

### 4.1 共同夹具、观察与安全条件

- 使用临时根下的合成registry/appointment/mandate/artifact/preimage/gate receipts、固定UTC `T0=2026-11-10T00:00:00Z`。合成任命只在隔离provider内有效，不读取/改写真实任命或宣称EFFECTIVE。fixture中C/A/W/V为四个可区分受信测试身份；请求body不能选择authenticated caller。
- 被测对象为未来真实入口的**同一admission/边界核验逻辑**，仅身份/时钟/registry/storage/执行器在测试装配层注入。D可参考既有TEST_MODE路径参数，但运行前必须审查全部路径和import行为；fleet现有--dry-run仅打印，不足以测拒绝。无法证明隔离则不启动，状态`BLOCKED_REQUIRED_EVIDENCE`。
- 禁止production socket、真实端口/凭据/授权查询、sudo/launchctl、生产路径访问；所有写入仅fixture，操作回调记录`ISSUE/INSTALL/BOOTOUT/BOOTSTRAP/RESTORE`调用次数而不执行。用独立OS限制/拦截证明无外部效果；配置字符串和mock自称零写不够。
- 每例先用同fixture的合法正对照证明真实gate可达并记录“会进入sandbox sink”；再只变一个因素。拒绝在签发与相应写入边界分别断言。阶段时才有的receipt由已执行的fixture阶段生成；不能预填未来PASS作为签发材料。
- 每例记录test ID、contract、candidate/base/source/入口hash、fixture前后hash、可信caller、T0、选中registry revision/canonical hash、被拒边界、原始rc/错误、event trace、sink计数、目录写集和局限。下列reason是语义标签，实际错误码依实现映射，不在报告中创造公共协议。

### 4.2 六类具体负例

| ID / 类别 | 输入构造（相对合法正对照） | 预期拒绝行为 | 观察点 | pass判据（未来执行才可判定） |
|---|---|---|---|---|
| N01 未任命 | 保持相同caller C和tuple，但从可信测试registry删除其appointment；补充请求仍自报C/UID502/appointment hash的伪造输入。 | 签发拒绝；直接调用写入入口也拒绝，不允许仅凭自报字段补足。 | issuer→appointment lookup与真实caller比对trace；原Mandate/receipt写集；所有sink计数。 | 两个边界均有明确未任命拒绝；无有效issued token/授权收据；所有mutation sink=0；正对照确实到达gate。 |
| N02 越界 | 保持有效任命/UTC，将请求效果改为“激活新profile”（其余STANDARD_RECOVERABLE字段不改）；该效果放入额外scopes以覆盖旧required⊆supplied漏洞。 | 因排除项/交集外效果拒签；绕过签发直达写入同样拒绝，不能仅忽略额外scope继续整单。 | scope/classifier与profile选择trace、错误、调用计数；appointment和Mandate原件hash。 | 明确指出越界效果，整单未获可写资格；新profile、install/bootstrap等sink=0；没有自动扩大appointment/profile。 |
| N03 过期 | 窗口UTC仍有效，appointment.validUntil=T0−1s；签发拒绝。另从合法签发fixture暂停于下个写入前，将可信时钟推进至appointment到期（window仍有效）。 | 首次拒签；已签单不得开始下一写入阶段，保留旧phase/收据/mutex，按原获准安全出口。 | 两次fresh时钟/期限读取、边界trace、已发生sandbox阶段计数与暂停后新增计数。 | window有效不能掩盖appointment过期；下一mutation增量=0；不默认续期、不删除旧记录/夺锁、不自动回滚/重试。 |
| N04 撤销 | 正对照在registry revision r通过；在签发前设置该任命revokedAt≤T0。另在fixture合法签发/阶段间暂停时，由测试authority provider发布r+1撤销或缩窄，保留旧authority.json和hash不动。 | 两处fresh查当前撤销并拒绝；不能接受缓存r或本地revoked:false；若新revision读失败，拒绝依赖操作并标UNKNOWN。 | 查询次数/实际revision/observedAt、mutex内边界检查trace、旧phase与锁保留、暂停后sink增量。 | 撤销/读失败分支都不进入下一mutation；不伪称read失败=未撤销；不因撤销自行kill/回滚/重放；无旧缓存旁路。 |
| N05 候选漂移 | 正对照封印tuple后，只改fixture installer一个字节；再单独改admission后、写入前的控制bundle/资格绑定hash，保证不是无关main移动。 | 在对应签发/写入边界拒绝artifact/控制资格漂移；不能重算hash后沿用旧审查/资格PASS。 | 实际rehash/tuple比较trace、receipt所引用对象、fixturepreimage、install/bootstrap sink。 | exact不符在依赖写前被拒；新增mutation=0，保留差异；反对照仅无关main前移不被当作此类漂移；不把source检查代替loaded绑定。 |
| N06 缺门 | 签发前删除G03实际installer资格receipt，或换成另一tuple的旧S04 PASS；分支单测在合法fixture到stage06a后移除full preimage成员/恢复证明，再尝试bootout（下一依赖边界）。 | 首个分支拒签；第二分支在bootout前拒绝。后续11/12只记REQUIRED_AT_STAGE且强制失败出口，不为了“门齐”提前填PASS。 | gate applicability/receipt解析、tuple/hash/actor/time校验、preimage inventory覆盖、bootout sink、readiness。 | 指出缺失/错tuple门，拒绝相应边界且sink增量=0；未来门未被虚报PASS；缺Secret前镜像不能靠公开Secret绕审，需受权脱敏回执。 |

### 4.3 资格输出与结束边界

Verifier分别记录“测试设计”“隔离执行结果”“实际入口/策略绑定”“任命生效”“逐窗操作”五个事实；只有六条文本齐全不能给资格PASS。六例需有可复核负向结果、合法正对照、零外部效果观察以及入口版本/hash；缺任何必需观察即PARTIAL/UNKNOWN。独立verifier须非候选/installer实质作者，且不兼本单C/A/W；测试操作者身份与资格必须可归属。

本轮只执行文档/对象读取、hash计算、允许的lstat、远端git只读、治理字节检查和文档机械核对。`python3 .agents/tools/verify_governance.py --target . --require-accepted` 实测rc0，stdout=`vendored governance bytes match governance.lock.json and adoption is accepted`，仅证明vendored治理字节与accepted lock一致；不证明上述控制或负例。没有执行fleet stage/selftest、installer、D服务或任何生产验证；已通过的历史门不重跑。提交/远端PR结果以任务最终readback为准，报告不预先伪造PR号、未来commit或DONE。

交付工作面调整：原工作树 `git add` 因沙箱禁止创建共享仓外部 `.git/worktrees/ops-sra-control-census/index.lock` 返回rc128；未修改其index或权限。改在允许写入的 `/private/tmp/sra-control-census-delivery-20261109` 建立独立本地shared clone（objects只读复用，独立index/ref），固定相同B与 `ops/sra-control-census`，仅复制本报告和原简报后提交/发布；不修改原共享checkout，不创建第二生产writer。实际commit/push/PR仍以最终readback为准。
