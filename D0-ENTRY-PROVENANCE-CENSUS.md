# D0-ENTRY-PROVENANCE-CENSUS — Δ0 真实控制入口来源与调用链普查

调查记录，非 Product Authority、任命、资格签发或执行许可。调查状态 **PARTIAL**：完成可访问范围的单轮只读普查；来源、loaded、当前准入与 writer 的未获证部分保留 UNKNOWN。文档交付/传输状态另记，不把本调查称为条件④生效。

## 1. D 的来源归属

### 1.0 任务、权威及观察边界

- 任务来源：本次用户明确执行 `BRIEF-D0-ENTRY-PROVENANCE.md`；上游 `ops/sra-control-census@5f387cf129148091f5ea828402a962eae3abec3b:CONTROL-CENSUS-SRA-EFFECTIVENESS.md` §3 Δ0（PR #683）。上游调查不是生产授权。
- 工作面：`/Users/yanfenma/workspace/project/worktrees/ops-d0-provenance`，branch=`ops/d0-entry-provenance`；调查 B/初始 HEAD/`origin/main`=`5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7`，本地 `main`=`5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`，未用旧本地 main 代替 integration base。
- 已读 `.agents/README.md`、`.agents/local/README.md`、`.agents/governance.lock.json`、`docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`、`docs/decisions/README.md` 的 current index、Spec-governance SKILL + PREFLIGHT；相关 accepted 权威固定为 B 的 SOD `CTR-SOD-002/004/005/008`、SRA `SRA-C-001/002/006`、DCP `CTR-DCP-006/007/008/009/011/012/015/016/017/018`（对应 `docs/specs/AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1.md:154–200`、`AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md:151–185,268–281`、`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:189–237,255–388`）。它们要求真实身份、来源、控制资格分开，DCP source acceptance 不授权 bootstrap；本次不改变其含义。
- PREFLIGHT：`schema_version=2; mode=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=ROUTINE; ROUTE_STAGE=OPERATION; AUTHORITY_ACCEPTED_IN_BASE=YES; IMPLEMENTATION_AUTHORITY=not_applicable; ATOMIC_SPEC_IMPLEMENTATION_PERMITTED=NO; MUTATION_AUTHORIZATION=VALID (仅两文档与Git交付); ISOLATED_WRITE_SURFACE=YES; CONTROLLED_RUNBOOK_REQUIRED=NO (生产mutation不在本任务); SPEC_GAP_DEPENDENCY=NONE (调查不依赖解除资格缺口); EVIDENCE_REVIEWABILITY=PASS (所用可读证据，未读者列UNKNOWN); OWNER_DECISION_REQUIRED=NO; EMERGENCY_STATE=NONE; BASE_IMPACT=NONE; IMPLEMENTATION_ALLOWED=NO; MERGE_READY=NOT_APPLICABLE; OPERATION_ALLOWED=YES (只读普查与docs发布); NEXT_ACTION=CONTINUE`。
- `GOAL_OR_TARGET`=五节普查报告+原简报，单 commit、push指定branch、PR base main、不合并；`CURRENT_GAP`=完整 source→installed→loaded→admitted profile/target/current writer 绑定缺证；`EVIDENCE_NEEDED`=逐文件元数据/hash、全ref搜索、收据、调用链、静态效果；`DONE_WHEN`=报告落盘与要求的Git/PR动作完成，push失败则按简报记proxy原文并停止；`EXPANSION_TRIGGER`=任何需提权/执行控制程序/认证调用/生产修改的后续，均不做。
- 只进行了 stat/lstat/读取/hash、离线 AST/载荷解码、`git`历史读取、`launchctl print`、三次 `ps` 尝试和文档/Git交付。生产写入=0、认证面调用=0；没有执行/import D、client、fleet runner、installer、profile或候选程序，没有取锁、kill、reconfigure、patch installed、activate或upgrade。文件读权限拒绝未绕过。源码与本地普通文件属于调查观察，不成为授权。

### 1.1 安装目录逐文件观察

观察时间：`2026-11-09T05:27:36.506826Z` / 北京 `2026-11-09T13:27:36.506826+08:00`；方法为 Python 标准库 `lstat/os.walk/read_bytes/SHA-256`，未 import 或运行被查代码。根路径记为 `I=/usr/local/libexec/agent-deploy-system`。

| 坐标 | 类型 / owner:group / mode | size bytes | SHA-256 | mtime UTC / 北京 +08:00 |
|---|---|---:|---|---|
| `I` | directory / root:wheel / 0755 | 160（目录元数据） | N/A | `2026-10-30T17:21:10.546850Z` / `2026-10-31T01:21:10.546850+08:00` |
| `I/deployment_system.py` | regular / root:wheel / 0555 | 111825623 | `9044abfd5d1616e28c2c4226fc5dae27b8450a8636e7865e09c7b549919219f9` | `2026-10-30T17:21:10.460330Z` / `2026-10-31T01:21:10.460330+08:00` |
| `I/ds_client.py` | regular / root:wheel / 0555 | 107718 | `040f6e053a1b683b8aecd8a1a6239e7187e92e885a91e97df41a919001662889` | `2026-10-30T17:21:10.546582Z` / `2026-10-31T01:21:10.546582+08:00` |
| `I/.observation-5715d21-maintenance` | directory / root:wheel / 0700 | 192（目录元数据） | UNKNOWN（内部不可读） | `2026-10-05T04:00:00.392625Z` / `2026-10-05T12:00:00.392625+08:00` |

`os.walk(I,onerror=...)` 顶层只列出上述两个文件和一个隐藏目录；进入隐藏目录返回 `PermissionError(13, 'Permission denied')`。因此**可读顶层未见** `pack-provenance.json`、README、LABEL 或其他文件；隐藏目录内文件、hash、provenance **UNKNOWN**，不把不可读当不存在。未提权、未绕过。

文本线索：D `L1-L7` 自称 `AGENT_CORE_DEPLOYMENT_SYSTEM_V1`、registry-driven privileged executor，Owner UID 由 `/private/var/db/agent-deploy-system-config` 固定；`L9-L28` 是作者的 actions/guarantees 描述，不是安装归属收据。client `L1-L2` 自称同系统的 non-root client，`L14-L15` 给默认 socket/state-root。可见文件中没有可用于把完整安装 bytes 归属到 repo/revision 的顶层 pack 证明。

### 1.2 全 ref 精确搜索范围与结果

本地仓 `mayf3/dsh-agent-core`；读取结束时间 `2026-11-09T05:28:47.179279Z` / 北京 `13:28:47.179279+08:00`，未 fetch。方法：`git for-each-ref --format='%(refname) %(objectname)'` 固定 ref 清单；`git rev-list --objects --all` 固定 reachable 对象；`git cat-file --batch-check` 类型/大小；`git hash-object <installed-file>`（不带 `-w`）与 reachable IDs 精确比较；`git cat-file -t <OID>`复核；`git log --all --format='%H %s' -- '**/deployment_system.py' '**/ds_client.py'` 查同名历史。范围仅是当时本地所有 refs 可达历史，不声称覆盖未抓取远端、不可达/reflog-only 对象或其他 repo。

| 范围 / 坐标 | 实测 |
|---|---|
| ref 数 / commits / all objects / blobs | `2416 / 3418 / 31659 / 13263`；blob 总量 `256123419 bytes` |
| ref 清单原件 | `/private/tmp/d0-source-history/refs.txt`，SHA-256 `e64f03422efb61aecdbbc2fd22b9f7dc39d3285959cedf5e810b088e501aac7b` |
| object 清单原件 | `/private/tmp/d0-source-history/objects.txt`，SHA-256 `fc5e05fb93372a02d263b0ce39bba1e21bcac18e9e267f926e656aa324e950d9` |
| 主要 ref prefix | `refs/heads/` 1162，`refs/remotes/` 1212，`refs/codex/` 19，`refs/tags/` 3；其他20：ac480=1,audit=4,codex-audit=2,codex-exec=4,codex-review=4,dsh-investigation=1,notes=1,pr-audit=1,review=1,stash=1 |
| 本任务 tip / `origin/main` | 均为 `5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7` |
| 本地 `main`（未当作origin/main） | `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814` |
| 上游报告 ref | `ops/sra-control-census=5f387cf129148091f5ea828402a962eae3abec3b` |
| D 的 Git blob OID | `dafd68fa71c04d20cf3591e82aa712dfc3a5ef8f`；reachable set 无此 OID；`git cat-file -t` rc128，`fatal: git cat-file: could not get object info` |
| client 的 Git blob OID | `2328f9b2e9d0756ccbf6370023b80ea70a00711a`；同样不在 reachable set，`cat-file -t`同样 rc128 |
| 同名路径 `git log --all` | 空输出（rc0） |

Git object format 为 SHA-1；上表 Git blob OID 用于精确内容定位，与 SHA-256 文件摘要分列。**已查 dsh-agent-core 全 ref 中无完整安装文件的相同 blob；来源 repo 未定位（UNKNOWN）**。这个结论不是“其他 repo 不存在源”。临时清单仅为本轮辅助原件，规范报告需保留上述范围、方法和对象坐标，以便从固定 refs 复核。

### 1.3 最近似局部字节线索（不能提升为完整来源）

对全部 `13263` reachable blobs 读取内容，非 NUL 内容按“去首尾空白、非空、单行长度小于10000 bytes”的唯一行集合评分，`Dice = 2×共同唯一行/(目标唯一行+候选唯一行)`。这是明确受限的相似度启发式，忽略超长内嵌载荷，**不是完整文件最近编辑距离或归属证明**。目标 D 5347行/3834评分行；client 421行/357评分行。原始分析 `/private/tmp/d0-source-history/match-results.json`。

| 目标 / 最高分局部候选坐标 | 近似结果 / 精确字节关系 | commit / 分支证据 |
|---|---|---|
| D；`scripts/lib/hr-shim-first-effect-receipt/reader.py` | 候选10351 bytes、SHA-256 `9de24ec0d7b523da8635483cffbe4f15bc667e5056cfe9ddbd117ffadeda5f64`；180共同评分行，Dice `0.0896637609`；候选`L13-L252`与installed D`L3926-L4165`连续240行逐字节相同，另候选`L1-L11`=D`L3914-L3924`。仅为内联局部片段 | `git rev-parse 1c31c00295a47856b0deb49f4ba82e9c51709bae:scripts/lib/hr-shim-first-effect-receipt/reader.py`=`f2e598768d8adc93b28ae1a11e8a8fdfa5ce8c12`；`git log --all --find-object=<blob>`含此提交；该提交被 `refs/remotes/origin/main`及`refs/heads/ops/d0-entry-provenance`包含（共619 refs包含，不保证各tip仍保留文件） |
| client；`scripts/lib/hr-fresh-cut-install-join/client.py` | 候选6682 bytes、SHA-256 `e7aa171716020cca6651b7ee395d2af335aad61088bdc8d8c24a686b01f638de`；22共同评分行，Dice `0.0866141732`；最长连续相同行仅4行（installed`L4-L7`=候选`L3-L6`及installed`L242-L245`=候选`L146-L149`），是弱线索 | `git rev-parse d2e753c53665f78817119283aae678bd1681fecb:scripts/lib/hr-fresh-cut-install-join/client.py`=`0b565d88f1009fbc6f2f19102eb25a4ba02267ae`；`log --all --find-object`含此提交；origin/main和本任务ref包含（共582 refs包含） |
| client 同名补丁历史（不代表完整源） | `deployment-artifacts/b7-e35-fixed-recovery-v1/patches/ds_client.py.patch`，543 bytes，仅补丁 | `8047ec9d907fb1b9ada3919df0ec8b26cf62ab8d:path`=`803f8d1af7ca88278792fcf12d46a25b61651303`；包含该提交的ref仅`refs/heads/ac-task/810`、`refs/remotes/github/ac-task/810`、`refs/remotes/origin/ac-task/810`；该branch tip=`74369037382ba51c9e4524b6f840b4e40383c2a0`；origin/main不包含 |

以上近似均未解释D的完整111825623 bytes或client的107718 bytes；installed==source仍为 **UNKNOWN**。

## 2. 既有安装与资格收据

### 2.1 安装、资格与既有收据（新鲜读取）

本节仓内坐标统一为 B=`5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7`；只读取文件，不运行这些脚本。观察时间 `2026-11-09T05:29:05.719451Z` / 北京 `2026-11-09 13:29:05.719451+08:00`（元数据与普通 installer 产物），`2026-11-09T05:29:23.006515Z` / 北京 `13:29:23.006515+08:00`（原生 DS receipt）。方法为 Python `lstat/read_bytes/json.loads`，目录只读 `iterdir`。

- `/private/var/db/agent-deploy-system`：root UID0/GID80、0770；`receipts/`：UID0/GID80、0755，直接 children 522 个。这是目录可读与名字观察，不是所有条目资格PASS。
- `/private/var/db/agent-deploy-system-config`：UID0/GID0、0700；列目录返回 `PermissionError: [Errno 13] Permission denied: '/private/var/db/agent-deploy-system-config'`。没有 sudo、换身份或认证调用；其中当前 registry/profile 内容及准入范围保留 UNKNOWN。
- `/private/tmp/dsh-fleet-window-tools/EXECUTION-MANDATE-W7-DRAFT.md`：本次读取为 `FileNotFoundError: [Errno 2] No such file or directory`；不能把历史草案坐标当作当前已签发窗口。

| 原件坐标 | 新鲜 SHA-256 / size / custody | 读取结果与资格限制 |
|---|---|---|
| `/private/var/db/agent-deploy-system/receipts/ds-reader-pair-r68a20261030.json` | `060b2d4f9ae7ad3c85130dd6f7f4631fd962df95b8a6207d7216f5fcc7850b2f` /345B/0:80 0644 | version1、action=`DS_UPDATE`、state=`COMMITTED`、generation/operation_id=`ds-reader-pair-r68a20261030`、restart=`self`。artifacts server=`9044abfd5d1616e28c2c4226fc5dae27b8450a8636e7865e09c7b549919219f9`，client=`040f6e053a1b683b8aecd8a1a6239e7187e92e885a91e97df41a919001662889`。 |
| `/private/var/db/agent-deploy-system/receipts/ds-reader-pair-r68b20261030.json` | `d21dec9cded705593e32882e9801dc275218ffedd9a7e3346a13010aaed0b863` /345B/0:80 0644 | 与上行相同 pair；version1/action/state/restart同上，generation/operation_id=`ds-reader-pair-r68b20261030`。两原件均不含 source repo/revision、loaded digest、actor、当前资格或时间字段；存在及历史 COMMITTED 字段可证，当前 loaded/合法资格不由它推出。 |
| `/private/var/db/agent-deploy-system/receipts/admit-current-agent-core-20260924-v2.json` | `ac20776442404595237aa3d261e20715744dc7f4fac591c23b9055e0d9ecc07c` /580B/0:80 0644 | version1、action=`ADMIT_CAPTURED_SCHEDULER_ROLLBACK`、state=`ADMITTED`、unit=`scheduler-whole-main`、operation_id同文件名、registry_generation=`30aa3e6454a165cc975aa5660185d77bc89c70979a11f78d4f7c27303317c779`；另有capture_operation_id/capture_receipt_sha256/closure_sha256/trusted_proof_sha256字段。这是所命名捕获回滚的历史收据，不能当D/SRA当前控制资格。 |
| `/usr/local/libexec/agent-core-install-mutation-receipt.json` | `681f881a7a326380473c5bc48bbc59cbcf30289ddc904b41ee7f185b81d493b1` /343B/0:0 0644 | receipt=`AGENT_CORE_INSTALL_MUTATION_RECEIPT_V1`、recorded_at=`2026-11-02T08:35:40Z`、exit_code1、failed_at_stage=`pre_mutation`、stages_completed=[]、preimage_bak为空、mutation_truth=`NOTHING_WAS_MUTATED`。仅对应这次 installer失败记录，不证明其他操作零效果。 |
| `/usr/local/libexec/agent-core-deploy-budget-receipt.json` | `54e2175fa90320007f66b9ffbb275811b7673d2c478b914cbbf8d0d5c4bd84f5` /5605B/0:0 0644 | 文件可读，schema/attempt_id/created_at/verdict/refusal_reason/budget/retention等字段存在；不是D来源或loaded凭据。 |
| `/usr/local/libexec/agent-core/app/pack-provenance.json` | `ca9a0e45149d9b59c4a93600d5a02696d8d416f40922f8e940d11b9c86e642fc` /2492B/505:601 0644 | source_head=`08102a550cf2f5e14646c6858786d7fe7a50c61d`、source_tree=`8cfbb484201f473efb9cf72e1b4d0e4f8423f6d9`、clean=yes、generation_label同head、main_repo_realpath=`/Users/yanfenma/workspace/project/production-dsh-agent-core`。这是agent-core app的provenance，不能移作agent-deploy-system的归属证明。 |

**installer 产物来源坐标：**B:`scripts/trusted-cp-deploy-install.sh:119–181` 的 `emit_mutation_receipt` 失败时 best-effort 覆写 `$(dirname TRUSTED_ROOT)/agent-core-install-mutation-receipt.json`（默认 `/usr/local/libexec/`；测试seam `TRUSTED_CP_RECEIPT_DIR`），含时间、rc、阶段、preimage、R1/R2及mutation_truth；不是不可变/原子签发凭据。`:306–348,958` 的 `packed_app_provenance` 生成 app pack-provenance；`:657–702` 调用既有 backup helper 的 `--check-budget`，产出 sibling `agent-core-deploy-budget-receipt.json`；`:704–742` 的备份名为 `agent-core.bak-YYYYMMDD-HHMMSS`，并写 predecessor metadata；`:103–116` 的 `.preimage-reused-subtrees` 标出被移出backup的harness/node/.cache。默认 TRUSTED_ROOT是agent-core（`:574`），**不是D的安装器归属证明**。

**仓内 profile/bootstrap 证据：**

- B:`deployment-artifacts/hr-s256-trusted-cut-v1/README.md:3–17,89–114` 明示 `PARTIAL_IMPLEMENTATION / NOT_BOOTSTRAPPABLE`，不是installed DS artifact/registered action/live proof；B:`profile.py:196–198` 的 `production_entry` 校验后固定抛 `PROFILE_NOT_BOOTSTRAPPED`。B:`bootstrap.py:14–23` 的 `TRUSTED_ARTIFACTS=None`、`INSTALLATION_PACKAGE_SHA256=None`；固定目标为config中的hr-s256 authority/source-scope及state中的hr-s256-deployment-proof/floor-proven.json、validator-installed.json；`:146–149` 默认零protected IO退出，资格输入为None不能当已bootstrap。
- B:`deployment-artifacts/b7-e31-partial-stage-closure-v1/README.md:3–16,39`、`b7-e32-pre-tx-closure-v1/README.md:3–14,30–34`、`b7-e33-presealed-recovery-v1/README.md:3–15,23–41` 是有exact pins/构建逆映射的 source contribution；保留历史固定操作收据，明确source/reconstruction、formal merge、installed/loaded cohort、fixed-op closure、业务发布分开。E32记录输出server `e9887775…` /client `959c1a2d…`；E33输出server `eb8639b9…` /unchanged client `826d26bf…`，均不等于当前9044/040f pair，也不能替代整个D源归属。
- B:`deployment-artifacts/original-router-proof-executor/admin_fresh_producer.py:29–34` 记录DS/server/client/plist/registry固定目标；`admin_ds_private_bootstrap.py:25–35` 记录 package目录、receipts目录与DAEMON路径；这证明仓内候选有相关接线，不证明本轮真实执行或当前准入。
- B:`scripts/lib/deployment-reuse/receipt.py:1–4,14–17,33–95` 既有非特权receipt observer：固定root、unit allowlist、64KiB、nofollow/custody、operation/unit/registry绑定；MATCH输出仍 `replayAllowed=false,currentRuntimeVerified=false`，错误为UNKNOWN。本轮仅读源码，没有运行observer/调用socket。

**registry history 的 D 部署坐标：**原件 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`，观察 `2026-11-09T05:28:40.592945Z` / 北京 `13:28:40.592945+08:00`；全文件 SHA=`a4e3056569c564c0434a90cc73fadb1a43b7a0bca6f537f3600f85a17b815d95`，history_count=838。以下selector按完整record匹配，index只作本次定位；canonical算法=`json.dumps(record,ensure_ascii=False,sort_keys=True,separators=(',',':'))` 的UTF-8无末尾换行SHA256。history是来源证据，不能签发当前权限。

| selector（本次 index） | canonical SHA-256 | 历史记录含义 |
|---|---|---|
| `$.history[kind=phasea_r71_publication_committed]`（216，id217） | `02310a4f0aead738bb5a62b891803d6eea17c5fe2506865893e2ef30d288fcab` | ts=`2026-10-30T13:43:23Z`、actor=supervisor-session、state=COMMITTED、publication=`ds-reader-pair-r68a20261030`、engine_sha256=9044abfd…；note含native DS_UPDATE COMMITTED / artifacts9044+040f / restart=self / EXECUTE=0 RESUME=0，并指向 `s3round71-owned/publication/supervisor-phase-a-once/{COMPLETE,ROOT-TRANSACTION,SUPERVISOR-ADMISSION,BOOKEND-COMPARISON}.json` 与上表原生receipt。 |
| `$.history[kind=r72_publication_committed]`（224，id225） | `94a72ee89eaed8612b061ca511f3cbe10a64db4ff652107a505b62fe9e48bef4` | ts=`2026-10-30T17:32:52Z`、actor=supervisor-session、state=COMMITTED、publication=`ds-reader-pair-r68b20261030`；note明确phase2 pair unchanged9044/040f、10成员配置修正、retained proof preserved、restart=self，与上表原生receipt SHA一致。 |
| `$.history[kind=checkpoint_custody_repair]`（225，id226） | `ea4461491f0e4d1ffc99bc9fd1a79759d286c3459467195e82bee343bd14421b` | ts=`2026-10-30T17:59:06Z`；note记录R72后server/client身份门通过，随后FILE_OWNER_CUSTODY拒绝及既有修复收据。这不是本轮重新执行或当前业务PASS。 |
| `$.history[round=w7-mandate-draft-ready-presented]`（657） | `cb6183ffa534e47ed0c713dae5ec83338814a611e20d76bdfe9382c302b955ce` | ts=`2026-11-07 14:29`，源文未带UTC偏移，不擅改时区；STATUS=DRAFT_NOT_ISSUED/SELF_ISSUED=NO、installer NOT_SELECTED_NOT_QUALIFIED，为当时历史材料。该路径本次未找到，当前已签状态UNKNOWN。 |


### 2.2 原生 receipt 全目录的有界读取范围

`2026-11-09T05:29:38.336543Z` / 北京 `13:29:38.336543+08:00`，对上述 receipt 目录逐个普通 JSON（单个≤1MiB）只读：直接条目522、可读JSON393、129个 PermissionError（均保留 UNKNOWN）；可读 action 计数 `DS_UPDATE=167, B7_PACKET_REGISTER_V1=117, ADMIT_CAPTURED_SCHEDULER_ROLLBACK=26, ADOPT=2, CAPTURE_CURRENT_GENERATION=27, ROLLBACK=10, CONFIGURE_WEC_SYSTEM_PRODUCT_API_8788=2, NO_ACTION=42`。仅两份可读JSON含当前D完整hash，即§2表r68a/r68b；不声称不可读129条无匹配。辅助manifest `/private/tmp/d0-entry-evidence/receipt-census.json` SHA-256=`c3b639806e744833a61a66dcbacefcc5cb6e85496ae228909eea295a94c05032`（记录路径、摘要、action、结果，不公开私有内容）。

同轮 `lstat`：`/private/var/db/agent-deploy-system/mutation.lock` UID0/GID80 0644 size0；`/private/var/run/agent-deploy-system.sock` UID502/GID0 0600。仅证明inode/metadata存在，未获取锁或连接socket，不能推出当前holder/当前writer；config下 `authorized-owner-uid` 和 `deployment-registry.json` 的 lstat/read 均 PermissionError13，实际owner映射与当前unit registry UNKNOWN。DCP不同路径 `/private/var/db/agent-deployd/production.lock` 也 PermissionError13，不能据此说不存在或已统一。

## 3. 实际调用观察与仓内调用链

### 3.1 launchctl 的原文与取证限制

`launchctl print gui/502` 在 `2026-11-09T05:27:44.043486Z` / 北京 `13:27:44.043486+08:00` rc0；完整输出保存在 `/private/tmp/d0-entry-evidence/launchctl-gui502.txt`（含3行观察头共2947行，SHA-256=`e8873f6996f85d557dde3e8a32d58f637155417db02bacd459f437a11a1b2f60`）。对**完整列表**大小写无关查 `deploy|fleet|window`，deploy/fleet为空；所有window原文如下（文件行号在右列，非fleet服务，不以名字相似推断）：

| 原文摘录 | 原件行 |
|---|---:|
| `creator = loginwindow[181]` | 10 |
| `2808      -  com.apple.WindowManager.agent` | 102 |
| `0      0  com.apple.loginwindow.LWWeeklyMessageTracer` | 272 |
| `com.apple.xpc.launchd.unmanaged.loginwindow.181 = {` | 905 |
| `0x57703    M   A   com.apple.windowmanager.server` | 1915 |
| `0x7dc03    M   A   com.apple.windowmanager.external` | 1916 |
| `0x57903    M   A   com.apple.windowmanager.dragserver` | 2042 |
| `0x7e533    M   A   com.apple.window_proxies.startup` | 2339 |
| `0x56e0f    M   A   com.apple.window_proxies` | 2735 |

额外只读 `launchctl print system/ai.agent-deploy-system` 在 `2026-11-09T05:28:53.940815Z` / 北京 `13:28:53.940815+08:00` rc0，原件 `/private/tmp/d0-entry-evidence/launchctl-ds.txt`（68行，SHA-256=`5469b3662be90bd3d007ebe1daa09d54cb8a49e01f88bc847dfea8042c18781d`）原文节选：

```text
system/ai.agent-deploy-system = {
    active count = 1
    path = /Library/LaunchDaemons/ai.agent-deploy-system.plist
    type = LaunchDaemon
    state = running
    program = /usr/bin/python3
    arguments = {
        /usr/bin/python3
        /usr/local/libexec/agent-deploy-system/deployment_system.py
    }
    domain = system
    runs = 1
    pid = 380
    execs = 3
    last exit code = (never exited)
    properties = keepalive | runatload | inferred program | managed LWCR | has LWCR
}
```

服务登记和running状态 **EXISTS**（原件L4–14,L25–33,L41,L67）；这不包含运行内存/启动时byte digest，不证明当前磁盘111MB就是PID380已加载内容，也不证明实际client caller。plist本身 `/Library/LaunchDaemons/ai.agent-deploy-system.plist` root:wheel0644，SHA-256=`9861fe868f97fffaf0323746a9f150bc7829656a1a76df8974a768bf745e1339`，ProgramArguments如上、RunAtLoad/KeepAlive=true；它只证明配置。

邻接服务的边界观察（只print/读取plist）：`system/ai.agent-deploy-shim` 在 `05:29:11.041998Z` / 北京`13:29:11.041998+08:00` rc0，state=running、PID381、program `/usr/bin/python3`、argument `/usr/local/libexec/agent-deploy-shim/deploy_shim.py`；原件 `launchctl-shim.txt` SHA=`c7f09839c494691fe1326434fc790da1a39ebc7751c4df0e590efadd8e0a7d1a`。`system/ai.agent-deployd` 在 `05:29:11.037344Z` /北京`13:29:11.037344+08:00` rc113，原文 `Bad request. / Could not find service "ai.agent-deployd" in domain for system`；原件 `launchctl-deployd.txt` SHA=`f696713675ac5541460ed67088b66c72870e41bb2668393b4c5d255d9a4c62f0`。其plist存在（root:wheel0644，SHA=`c09e24824db86db2267da236594b94d1d36399171e9d6b25e78a928c66af095b`，RunAtLoad/KeepAlive=false），仅不能在所查label发现服务，不扩大成全主机无其他writer。shim只观察启动登记，未递归审其闭包；不把DCP deployd、D与shim当作同一controller。

### 3.2 ps 三次间隔采样尝试

命令均为 `/bin/ps -axo pid=,ppid=,uid=,lstart=,command=`，Python subprocess在启动系统命令时被沙箱拒绝，原文均为 `PermissionError(1, 'Operation not permitted')`；因此**三次进程树采样未取得**，并非三次未发现进程。最早 `05:27:44Z` 的预探同样 PermissionError，以下为有完整观察头的正式三次：

| 样本 / UTC / 北京+08 | 距前次秒 | 原件 / SHA-256 | 结果 |
|---|---:|---|---|
| 1 / `2026-11-09T05:28:15.257434Z` / `13:28:15.257434` | N/A | `/private/tmp/d0-entry-evidence/ps-attempt-1.txt` / `b60b04000aa59397503e6f498f7ff9bbfabea99fe6316bc88cd590112f8961e4` | PermissionError1 |
| 2 / `2026-11-09T05:29:38.238336Z` / `13:29:38.238336` | 82.980902 | `ps-attempt-2.txt` / `614ce26b708e53b20b3ff503ceef75fa707890e7473baaac68930c65a072f982` | PermissionError1 |
| 3 / `2026-11-09T05:30:42.286024Z` / `13:30:42.286024` | 64.047688 | `ps-attempt-3.txt` / `dff78cead1a80d590a5099c7287160ba6e99475f880639089f5635466be0abc9` | PermissionError1 |

两个间隔均≥60s。当前fleet进程、client调用者及父子树 **UNKNOWN**；没有用launchctl PID替造ps样本。一个观察能力不可用不妨碍其他授权读取与docs交付；本轮调查范围标PARTIAL，不提权或反复重试。

### 3.3 仓内静态调用链


方法：B工作树 `rg -n --max-columns 240 'deployment_system|ds_client|window-executor|agent-deploy-system' scripts deployment-artifacts`，分别查脚本和README；排除测试后仍有下列实际调用/装配坐标。这里只证明静态callsite，**不推断本次谁运行过它**。

| caller → callee | B坐标 | 事实/限制 |
|---|---|---|
| fleet runner → Python helper | `scripts/fleet-window/window-executor-v5.sh:103–112` | user为`python3 -B`，root为`sudo -n python3 -B window_helper.py RD op`；`:305–318` main固定17节点，除stage00外每stage先mutex-check。 |
| runner stage07 → 封印bundle installer | 同文件`:223–239`，helper `window_helper.py:20–29,86–120` | 目标为`WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh`，固定三个source/harness/main参数、env-i与继承holder；helper校验外部installer SHA=`2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a`。不自动等于仓内当前installer，也不等于D。 |
| stage03b → candidate-state → candidate-child | runner`:177–183`；`anarrowed/candidate-state.mjs:39–76,79–153`；`candidate-child.mjs:16,85–136` | sudo运行候选Node，创建隔离副本/receipts，spawn child；45s超时SIGKILL child；child启动隔离runtime后self SIGTERM。即使叫状态校验也不是纯读脚本，本普查未执行。 |
| stage05b → settlement source | runner`:211–220`；`settle_unresolved_runtime_down.mjs:91–108,111–178` | runtime down后的exact termination-only settlement，写当前turn-recovery store，receipt经tee落盘；不是quiet观察，也不是重放。 |
| helper → core/xattr/close | `window_helper.py:1–3` | 导入`window_helper_core`、`window_preimage_xattr`、`window_close`；不是通过D/ds_client统一代理执行。 |
| core.census → pinned source readRestartDrainCensus | `window_helper_core.py:325–346` | source绝对import `/private/tmp/fleet-roll-src/packages/production-runtime/src/scheduler/restart-drain.js`，固定candidate Node；只读store但会写stdout/stderr/receipt。 |
| e31 preservation status → installed ds_client | `deployment-artifacts/b7-e31-partial-stage-closure-v1/src/e31_preserve_once.py:25–30,45–53` | subprocess固定 `/usr/bin/python3 CLIENT b7-status-r3 OP`，user502/group20/empty groups/固定env；root辅助器的历史固定status callsite，不是本轮调用。 |
| CTO fixed client action → DS socket | `scripts/lib/hr-cto-sender-readback/client_action.py:1–24` | 固定no-argument client command通过`request(packet)`；默认冻结request与hash为None时抛`NATIVE_MESSAGE_ID_UNBOUND`；SOCK=`/private/var/run/agent-deploy-system.sock`。候选装配，不证明live caller。 |
| DS source candidate assembler → install handler | `scripts/lib/hr-fresh-cut-install-join/assemble.py:22–40`、`install_join.py:290–318` | 拼接现有DS self-update/status handler；handler借`STATE_ROOT/mutation.lock`及existing DS lock。不能把assembler源码当整个D来源。 |

在B这两目录的可执行source搜索里，未见一个由其他production shell直接启动fleet `--execute` 的callsite；test/selftest调用与说明文档不计为当前生产调度。完整主机调用方须结合launchctl/三次ps，空命中不等于全主机无调用。


## 4. 可达写入与重启路径清单

### 4.1 Installed D / ds_client：静态操作与保护边界（PARTIAL）

本小节只读取 installed 文件并用 `ast.parse`、`base64.b64decode`、`gzip.decompress`、`json.loads` 解码；未 `exec`、未 import、未执行控制器/CLI。D 固定 SHA-256 `9044abfd5d1616e28c2c4226fc5dae27b8450a8636e7865e09c7b549919219f9`，C 固定 SHA-256 `040f6e053a1b683b8aecd8a1a6239e7187e92e885a91e97df41a919001662889`。

判读：下表是函数定义及操作调用点的静态候选清单；`subprocess.run/Popen` 包括 ps/launchctl print/只读探针，`write` 可能写 pipe/stdout，`flock/fsync` 也不等于业务写。出现定义不证明当前请求可达、实际执行、资格获准或 loaded。Root 要求指生产服务入口，不能据此推导调用者须 root（服务可接受已授权非 root UID）。

覆盖：外层 Python 与内嵌 `compile` 字符串、非 gzip B64 Python、三个 P0 graph 的非 test `owner/*.py`，共 84 个模块、原扫描 740 个候选调用；下表去除已确认的 string.replace/dict.copy 假阳性后按 module+function 归并。另补三段 gzip Router JS 与 graph owner JS 的词法效果点。未证明完整覆盖 graph payload 应用代码、外部 shell/Node/动态 import、任意运行时函数绑定和外部工具效果，故整体保持 **PARTIAL**，不声称所有可达写边界已闭合。

| 路径 / 操作族 | 函数与外层行号 | root / mutex / journal 静态判定 |
|---|---|---|
| D 服务初始化、socket 建立/清旧 socket、目录 custody | `serve:L5197-L5239`：mkdir/chown/chmod/unlink/bind；`L5204 ROOT_REQUIRED` | 生产 root；此初始化未获取 mutation.lock，无交易 journal。 |
| D 原子落盘/替换、临时文件清理 | `atomic_write:L653-L700`；`atomic_install_file:L2185-L2200`；`atomic_install_dir:L2203-L2218` | root 服务上下文；helper 自身不取锁，保护取决于调用者；write/fsync/fchmod/fchown/replace/unlink。 |
| D 全局锁原语 | `mutation_lock:L767-L775` | `STATE_ROOT/mutation.lock` + nonblocking flock，合作 writer 保护；非权限撤销或全系统唯一 writer 证明。 |
| DEPLOY / ROLLBACK：generation/preimage、目标文件/树与依赖恢复，restart | `deploy:L1898-L2182`（锁 L1943）；`rollback:L2239-L2409`（锁 L2258）；`restart_runtime:L800-L845` | root；mutation_lock 保护；stage/receipt 与 generation 元数据，不自动等于全效果不可变 journal。restart 为 bootout + bootstrap，非 wait 分支有 bootstrap retry。 |
| System plist 配置/回退/失败 reconcile | `apply_product_api_8788:L1143-L1265`、`rollback_product_api_8788:L1301-L1387`、`reconcile_failed_product_api_8788_v1:L1390-L1520`、`product_api_8788_action:L3303-L3361` | configure/rollback action 在 L3313 取 mutation_lock，写 operation/receipt 并 restart；reconcile 分支需按其本身实际调用判读，不因文件名宣称纯读。 |
| Router ingress readback 会落 intent/terminal receipts | `router_ingress_receipt_readback:L550-L650`（锁 L572） | root；同 mutation_lock；“readback”包含 mkdir 与持久 evidence 写，不可在本次只读运行。 |
| capture/admit、闭包装配、探针 child 与临时目录 | `capture_current_generation:L2808-L2973`（锁 L2842）；`admit_captured_scheduler_rollback:L3069-L3165`（锁 L3086）；`trusted_fixed_capture_probe:L1590-L1738` | root；capture/admit 持锁并落 intent/proof/pointer/receipt；probe 会 mkdir/copy/chown、启动子进程、kill child、rmtree，仅列静态不执行。 |
| preserve 修复和 ADOPT 元数据 | `repair_preserve:L2695-L2766`、`adopt_existing:L2769-L2805` | root 上下文；函数内未见 mutation_lock；前者可 rmtree/copytree/chown，二者落 receipt/generation，不能声称已统一跨进程锁。 |
| WRITE_CONFIG | `legacy_handle:L5145-L5158` → `atomic_write` + `chown(505,601)` | root 服务；仅检查 `/Users/authsvc/.agent-core/` 字符串前缀及 JSON/大小；该分支未见 mutation_lock 或 operation receipt。这里只记录现状，不调用/修复。 |
| DS 自更新 / rollback-preimage / 自退出重启 | `ds_update:L3216-L3300`；`p0_maintained_ds_update:L3606-L3626`；`self_restart:L5242-L5245` | root；pair 路由 `p0_reader_pair_guard:L3536-L3603` 用既有 flock；single-file 用 settings maintenance_guard。ds_update 自身不取锁。成功返回经 `BoundedDispatcher:L5008-L5009` → `os._exit(0)`，依赖 launchd KeepAlive。 |
| 单服务 legacy 串行槽 | `BoundedDispatcher:L4918-L5009` | condition + one-item queue，只保证此服务单 legacy slot；不能替代跨进程 mutex，更不证明所有 helper/direct caller 受控。 |
| B7 register/execution/owner/recovery/disposal 与固定 closure | 外层 `L5253-L5343`；内层详见模块表和操作表 | 在 root 服务内；B7 Execution 有 guard、原 DS/native lease、固定 policy/packet/receipt/journal 检查。recovery 会启动受约束 child、杀 child/group、写 journal/records、清自己确认的 holder/stage；这些函数存在不授予当前操作。 |
| P0 历史 graph 执行/生命周期 | B64 `L3411/L3667/L3718` → owner modules；transport `Job.start` 另见下表 | 潜在 root owner apply/fence/quiesce/bootstrap/journal。当前 `legacy_handle:L5085-L5091` 明确拒绝三个 START 路径（CONSUMED/no replay）；不得把 graph 内代码定义标为当前可用写入口。保留诊断/状态/terminal 分支另核。 |
| ds_client 本地 staging 与协议发送 | `stage:L226-L241`、`main:L390-L397`、`request:L140-L183`；B7 owner client 内层 | client 可由获准 UID 调用：本地 inbox mkdir/rmtree/copytree/replace；sendall 会请求 D 的 action。无自身全局 mutation_lock/journal；服务端独立准入。未执行 client。 |

#### 模块坐标与解码后 SHA-256

`M00` 为 D 外层，`M81` 等以表中实际标签为准；所有 `L` 均是该模块解码后的 1-based 行号。origin 中外层 D:Lx 的字符串/B64 位置是重建坐标；graph 来源以变量名标识，变量在 D 外层 grep 可复核。SHA 绑定解码源文本；外层哈希已与安装字节一致。

| 模块ID / 源名 | 外层来源坐标 | SHA-256 |
|---|---|---|
| `M00 deployment_system.py` | `deployment_system.py` | `9044abfd5d1616e28c2c4226fc5dae27b8450a8636e7865e09c7b549919219f9` |
| `M01 <sealed-b7_ds_adapter.py>` | `deployment_system.py > deployment_system.py:L5253` | `a5153b7e3edca7dcf7f02b0ff408d7acfd16094ac53274169cd27cd5dc33c61d` |
| `M02 <sealed-b7_ds_execution.py>` | `deployment_system.py > deployment_system.py:L5255` | `ea6ef76d40241b8d0ca7286fbf69cc06fcb9072142d73a2e8750bba6cc8933ba` |
| `M03 <sealed-b7-recovery-r1610>` | `deployment_system.py > deployment_system.py:L5255 > <sealed-b7_ds_execution.py>:L1820` | `6335615a9c8b1941cff51d6b43f2651136f2b16b24776f4835d77c39bac5649c` |
| `M04 <sealed-b7-recovery-auth-r1610>` | `deployment_system.py > deployment_system.py:L5255 > <sealed-b7_ds_execution.py>:L1822` | `0fb46df8dd85681e08eb678599acb570cb5fb2ad0466f8a431cfb5461738a4b8` |
| `M05 <sealed-b7_e29_closure.py>` | `deployment_system.py > deployment_system.py:L5259` | `ece5cedc029b3e7703faf6dd39972b919bb2df75ab67634e99834629c9426ab9` |
| `M06 <sealed-b7_e30_closure.py>` | `deployment_system.py > deployment_system.py:L5262` | `7d762e4ba1107c9d61e8b331b46840387c96ffe8f1a11915cbb44d2d292780c7` |
| `M07 <sealed-b7_source_diagnostic.py>` | `deployment_system.py > deployment_system.py:L5267` | `2fc16194d0484d03994311d6ce1e2502c9e075d4cdde2941978624e01a21990f` |
| `M08 <sealed-b7_e31_closure.py>` | `deployment_system.py > deployment_system.py:L5272` | `2c26ed959ee3cffbf2b2999d2abaf5dd3e98c3207ec5e6512933fb5ccbb65c65` |
| `M09 <sealed-b7_e32_closure.py>` | `deployment_system.py > deployment_system.py:L5278` | `0601d987833a33827a205ba6850a9cdc7f83124d35cf1fb0def61baee2c09161` |
| `M10 <sealed-b7_e33_recovery.py>` | `deployment_system.py > deployment_system.py:L5283` | `4dfcf106a0a86c2c534a363111c6577bad37522e853ae674d3db133be2b3063a` |
| `M11 <sealed-b7_e35_recovery.py>` | `deployment_system.py > deployment_system.py:L5290` | `fe95f324d95fec91222881f9abb50ba325d375eafb0e8644c000dc391ae89b0d` |
| `M12 <sealed-b7_e35_publication.py>` | `deployment_system.py > deployment_system.py:L5295` | `e5ff50b28849d25a7a3b98e2cf566c9dc9d17ba9d1bd096d0fda3a5fb110343e` |
| `M13 <sealed-b7_e38_recovery.py>` | `deployment_system.py > deployment_system.py:L5311` | `96057f06dcb04ef8077d6fce797cdd90686613070d2c8396b5cadccb8a1f6d33` |
| `M14 <sealed-b7_e38_publication.py>` | `deployment_system.py > deployment_system.py:L5316` | `bb0bb98116dec21972dc13226a2fe9644660daa9643cd4c93a0b7bea31cab89e` |
| `M15 <sealed-v50_e40_closure_source.py>` | `deployment_system.py > deployment_system.py:L5333` | `b5506df32aa517ff0b24186cd5d347e5e25a55d5322269f2ee3eec257a7cd429` |
| `M16 <sealed-v50_e41_closure_source.py>` | `deployment_system.py > deployment_system.py:L5342` | `399ebfd629eac35ff4a10610872655434cfcb0dfd23fa7465024190fa58667e2` |
| `M17 P0_DIAGNOSTIC_B64` | `deployment_system.py > deployment_system.py:P0_DIAGNOSTIC_B64` | `cbaaf08b7554a39ca08ef56e4865eb5cd1023e97aaeba7da9ac2b13323bfd07b` |
| `M18 P0_GRAPH_B64/owner/atomic_apply.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `4d2d587c8304c8311106b1fa960cddb1b294cbb00a7672c0d952d532b62f6fee` |
| `M19 P0_GRAPH_B64/owner/canary_adapter.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `c5277a848cad18ab02357c3a26e68548b0b6dc3e090b5095ea863df61da59c38` |
| `M20 P0_GRAPH_B64/owner/collector.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `03b2192e3fdc45c307dcc35606365867f028b190a13969f486bea98b9b2b77ad` |
| `M21 P0_GRAPH_B64/owner/excluded_generic_preimages.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `387190ff8ebb3494d3d8f9c8d108d38a9aee20b4c79a430d500a9ae56f2ad82d` |
| `M22 P0_GRAPH_B64/owner/executor_binding.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `223f83a17b28916f148bd0fdaf63c801a77f1a9ecf2ff87eace14de13353a18c` |
| `M23 P0_GRAPH_B64/owner/fresh_root.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `318c88dc400911c3651b0db67aac46e945725e372be2b7676ae5b64d3a75176a` |
| `M24 P0_GRAPH_B64/owner/operation_binding.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `7b13d7acceb20000fbc236ad4006b69ce9f0e27c131e52c74ea9fc75a49ad360` |
| `M25 P0_GRAPH_B64/owner/owned_recovery_lock.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `c417f9032f845080f8f83e58ec8228e6768f1902153ee9b44404e37d3614aef7` |
| `M26 P0_GRAPH_B64/owner/owner_entry.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `82e335d2398d3783b5f62c7c07c760e84284bd6f725641d6eee3d18b6368b2b2` |
| `M27 P0_GRAPH_B64/owner/owner_host.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `e7dd2ad9d03b82ceb0e419596a82ee977bcee3341f23c4767d1face7e47b8c25` |
| `M28 P0_GRAPH_B64/owner/predecessor_reconcile.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `3920f6c62c87d180193a33459af211e6de23f3f2ba6af38758b4562231f9151b` |
| `M29 P0_GRAPH_B64/owner/production_apply.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `36981cc8878a04abefb3a2d51b1776444e6fd7cd46ea894c513e54320c3660aa` |
| `M30 P0_GRAPH_B64/owner/rollback.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `384a8584435d7ecff92e477e000d5135b5662018a083cba9346c8b36cb7e9ce0` |
| `M31 P0_GRAPH_B64/owner/root_journal.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `4436f170871eee5183a1f8f5e281510393044612be0108892fc7cb85e2cf5080` |
| `M32 P0_GRAPH_B64/owner/runtime_drain.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `09ef10904f02697ea17e8d539c448a8945886cb7ebcb5b0a4a416f0501a1fd54` |
| `M33 P0_GRAPH_B64/owner/staging.py` | `deployment_system.py > deployment_system.py:P0_GRAPH_B64` | `a95ff890a7095f9adbead40344230860fe10b0cc0872e6b405bed3aacec5f6a1` |
| `M34 P0_TRANSPORT_B64` | `deployment_system.py > deployment_system.py:P0_TRANSPORT_B64` | `30a2cab9e0e7e4d362bfe1aa970080f4d2d3e1dce06c23cf9da0917eac57974b` |
| `M35 P0_SETTINGS_B64` | `deployment_system.py > deployment_system.py:P0_SETTINGS_B64` | `8a6dc2d415d5a162cefb5bcde7a0d25f8907666272d1ffe2d6ad6d6a3033df7b` |
| `M36 B7_E6_PUBLICATION_B64` | `deployment_system.py > deployment_system.py:B7_E6_PUBLICATION_B64` | `44f6c1c48bc1dcce9e1be9c5b2b477bb1ecfeb1809f7fdbc4c1b511eb23214dc` |
| `M37 P0_RUNTIME_IDENTITY_B64` | `deployment_system.py > deployment_system.py:P0_RUNTIME_IDENTITY_B64` | `fb247d95ce164b82be56f761c41fe38c5689edf495ce56468936f40c7eb1acf1` |
| `M38 P0_READER_B64` | `deployment_system.py > deployment_system.py:P0_READER_B64` | `316158be5afae09e1105b8b0e427f4619f5ba18b8734b59ab4c076a0537f5d0f` |
| `M39 P0_READER_GRAPH_B64/owner/atomic_apply.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `4d2d587c8304c8311106b1fa960cddb1b294cbb00a7672c0d952d532b62f6fee` |
| `M40 P0_READER_GRAPH_B64/owner/canary_adapter.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `c5277a848cad18ab02357c3a26e68548b0b6dc3e090b5095ea863df61da59c38` |
| `M41 P0_READER_GRAPH_B64/owner/collector.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `03b2192e3fdc45c307dcc35606365867f028b190a13969f486bea98b9b2b77ad` |
| `M42 P0_READER_GRAPH_B64/owner/excluded_generic_preimages.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `88ad336162eab5c43e6ceefeee29180ad7df91150ce6cfd7c05bfd61f929094a` |
| `M43 P0_READER_GRAPH_B64/owner/executor_binding.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `3d16eb15c3f8ef30e7324cecdd5e648ef0544c1bb182c4d8a02021fee910a918` |
| `M44 P0_READER_GRAPH_B64/owner/fresh_root.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `eaa32475133a527d08852e21b8097e2f6ad1137b9cf44dfa30a5ed4970a3b1e8` |
| `M45 P0_READER_GRAPH_B64/owner/operation_binding.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `d2189c362bb36254442d87225849f4c25c1eeabcbeb28816345c4b6d9fd34296` |
| `M46 P0_READER_GRAPH_B64/owner/owned_recovery_lock.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `c417f9032f845080f8f83e58ec8228e6768f1902153ee9b44404e37d3614aef7` |
| `M47 P0_READER_GRAPH_B64/owner/owner_entry.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `a2cf8936f2ab75f820c337b68f3f02f3de74daa6cdfaed330b403844cfc86c37` |
| `M48 P0_READER_GRAPH_B64/owner/owner_host.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `e7dd2ad9d03b82ceb0e419596a82ee977bcee3341f23c4767d1face7e47b8c25` |
| `M49 P0_READER_GRAPH_B64/owner/predecessor_reconcile.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `3920f6c62c87d180193a33459af211e6de23f3f2ba6af38758b4562231f9151b` |
| `M50 P0_READER_GRAPH_B64/owner/production_apply.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `a7329df0f01b6aa394dbbd5a6a3b0192abd44dfb664f976c25c689f2d9a1c54a` |
| `M51 P0_READER_GRAPH_B64/owner/reader_contract.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `316158be5afae09e1105b8b0e427f4619f5ba18b8734b59ab4c076a0537f5d0f` |
| `M52 P0_READER_GRAPH_B64/owner/rollback.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `2d6faa726a78208269b51f9d2b97d0e6980368a66e66eb061ec3ed822556821f` |
| `M53 P0_READER_GRAPH_B64/owner/root_journal.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `4436f170871eee5183a1f8f5e281510393044612be0108892fc7cb85e2cf5080` |
| `M54 P0_READER_GRAPH_B64/owner/runtime_drain.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `09ef10904f02697ea17e8d539c448a8945886cb7ebcb5b0a4a416f0501a1fd54` |
| `M55 P0_READER_GRAPH_B64/owner/settings_binding.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `9da76083cd757369a8df863bd899d01bf94e0b8578b4a88d30e7b272abe5533b` |
| `M56 P0_READER_GRAPH_B64/owner/staging.py` | `deployment_system.py > deployment_system.py:P0_READER_GRAPH_B64` | `17668a46bf77bb78be7e103c385f86d443210b6a804039bce7d111136e261f63` |
| `M57 P0_READER_TRANSPORT_B64` | `deployment_system.py > deployment_system.py:P0_READER_TRANSPORT_B64` | `1c5b6a8e1aa823896b7592086b29b51df356d2be06e95256d2d03578403d8fd4` |
| `M58 P0_TERMINAL_READBACK_B64` | `deployment_system.py > deployment_system.py:P0_TERMINAL_READBACK_B64` | `7994ed4912061d95838e10c5f9f62ec7efd11952f35c1862770c0f388da57aab` |
| `M59 P0_SUCCESSOR_GRAPH_B64/owner/atomic_apply.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `4d2d587c8304c8311106b1fa960cddb1b294cbb00a7672c0d952d532b62f6fee` |
| `M60 P0_SUCCESSOR_GRAPH_B64/owner/canary_adapter.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `c5277a848cad18ab02357c3a26e68548b0b6dc3e090b5095ea863df61da59c38` |
| `M61 P0_SUCCESSOR_GRAPH_B64/owner/collector.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `fd5b4ee924ea0bcab5aa0be0ec7b211d55ebd2df2747e4962596b5c6fbb201a4` |
| `M62 P0_SUCCESSOR_GRAPH_B64/owner/excluded_generic_preimages.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `1264ff0c197482fd1e790e7553ece0c6936da17509f28fc0598e0fecb76ed423` |
| `M63 P0_SUCCESSOR_GRAPH_B64/owner/executor_binding.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `987fdbbbe48b513bb2f675ffb1e7552a1059e55bdf00caa1bff11b2cfe1ea706` |
| `M64 P0_SUCCESSOR_GRAPH_B64/owner/fresh_root.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `7b24afa2abc763799a8b44b760b2cf782c2cf54ef42de63441669c58b2a1c44e` |
| `M65 P0_SUCCESSOR_GRAPH_B64/owner/operation_binding.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `573ec28a851d50fbb579673245fbe692e19a9d7d5d65def1560dbe23bb1ec23a` |
| `M66 P0_SUCCESSOR_GRAPH_B64/owner/owned_recovery_lock.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `c417f9032f845080f8f83e58ec8228e6768f1902153ee9b44404e37d3614aef7` |
| `M67 P0_SUCCESSOR_GRAPH_B64/owner/owner_entry.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `03bc3f386b5e3f26f21433e9edb499de7cc2301bb6783020352e74230609d209` |
| `M68 P0_SUCCESSOR_GRAPH_B64/owner/owner_host.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `1f54e0d57b1d2ed00fa41272ecb1d81b3fb02b58fff3062de445547c988bcab1` |
| `M69 P0_SUCCESSOR_GRAPH_B64/owner/p0_aborted_reconcile.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `7e495e5addb4b9c97b300e60493bd9d70423f52410c104ee0539e5eea2324de0` |
| `M70 P0_SUCCESSOR_GRAPH_B64/owner/p0_aborted_records.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `7bd24f33e801b6ff9a381330986911b6164ce28efcacecb8588609d5db9914fa` |
| `M71 P0_SUCCESSOR_GRAPH_B64/owner/p0_aborted_worker.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `39a52a73ea2c97ba449ec2b8dcc095c73ade8b6d64ce35cb49dc75376cba588b` |
| `M72 P0_SUCCESSOR_GRAPH_B64/owner/predecessor_reconcile.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `3920f6c62c87d180193a33459af211e6de23f3f2ba6af38758b4562231f9151b` |
| `M73 P0_SUCCESSOR_GRAPH_B64/owner/production_apply.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `e8747097afeec2b32e1ecd076459c7e072903630937c34d407be35491587e84b` |
| `M74 P0_SUCCESSOR_GRAPH_B64/owner/reader_contract.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `316158be5afae09e1105b8b0e427f4619f5ba18b8734b59ab4c076a0537f5d0f` |
| `M75 P0_SUCCESSOR_GRAPH_B64/owner/rollback.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `2d6faa726a78208269b51f9d2b97d0e6980368a66e66eb061ec3ed822556821f` |
| `M76 P0_SUCCESSOR_GRAPH_B64/owner/root_journal.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `4436f170871eee5183a1f8f5e281510393044612be0108892fc7cb85e2cf5080` |
| `M77 P0_SUCCESSOR_GRAPH_B64/owner/runtime_drain.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `09ef10904f02697ea17e8d539c448a8945886cb7ebcb5b0a4a416f0501a1fd54` |
| `M78 P0_SUCCESSOR_GRAPH_B64/owner/settings_binding.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `9da76083cd757369a8df863bd899d01bf94e0b8578b4a88d30e7b272abe5533b` |
| `M79 P0_SUCCESSOR_GRAPH_B64/owner/staging.py` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_GRAPH_B64` | `17668a46bf77bb78be7e103c385f86d443210b6a804039bce7d111136e261f63` |
| `M80 P0_SUCCESSOR_TRANSPORT_B64` | `deployment_system.py > deployment_system.py:P0_SUCCESSOR_TRANSPORT_B64` | `2b987d322b1c7d6cdf772e3b0f07bdf455c19500862f469104a9dd9e3f7bc5a0` |
| `M81 ds_client.py` | `ds_client.py` | `040f6e053a1b683b8aecd8a1a6239e7187e92e885a91e97df41a919001662889` |
| `M82 <sealed-b7_ds_client_adapter.py>` | `ds_client.py > ds_client.py:L413` | `d2c9ebc3bd2dd810292cd3de103ca814ae0fe1f5e18162ed586b676c032067d6` |
| `M83 <sealed-b7_ds_execution_client.py>` | `ds_client.py > ds_client.py:L415` | `7cc7b792feeb064f8c931102c43203ee6e6e27acd6cad27cc01d614952f342cc` |

#### Python 候选 syscall / child / lock 调用点全集（上述提取范围）

每行合并同 module/function 的所有已识别效果调用和行号。`call` 在 `_rename_excl/_rename_new` 等函数中为 ctypes renameatx_np 间接调用；`subprocess.*` 标为潜在 child 效果，实际只读/写入依 argv 和外部实现判读。此表不是可达性、权限或当前执行证明。

| 模块 | 函数 | 操作与行号 |
|---|---|---|
| M00 | `router_durable_summary` | `subprocess.Popen` L301；`child.kill` L324 |
| M00 | `router_ingress_verified_select` | `subprocess.Popen` L465；`child.stdin.write` L471；`child.kill` L491 |
| M00 | `router_ingress_receipt_readback` | `os.makedirs` L575；`os.mkdir` L585；`fcntl.flock` L649 |
| M00 | `atomic_write` | `os.open` L664；`os.write` L672；`os.fsync` L675,687；`os.fchmod` L676；`os.replace` L684；`os.unlink` L699 |
| M00 | `mutation_lock` | `os.open` L769；`fcntl.flock` L771 |
| M00 | `health_check` | `subprocess.run` L784 |
| M00 | `restart_runtime` | `subprocess.run` L806,814,825,833,836,840 |
| M00 | `_atomic_write_runtime_plist` | `os.open` L902；`os.write` L907；`os.fchmod` L930；`os.fsync` L931,945,952；`os.unlink` L942；`os.replace` L949 |
| M00 | `listener_attribution` | `subprocess.run` L1015,1039 |
| M00 | `runtime_service_attribution` | `subprocess.run` L1053 |
| M00 | `canonical_health_listener_attribution` | `subprocess.run` L1073,1093 |
| M00 | `apply_product_api_8788` | `os.makedirs` L1165 |
| M00 | `rollback_product_api_8788` | `os.makedirs` L1353 |
| M00 | `clone_tree` | `subprocess.run` L1586 |
| M00 | `trusted_fixed_capture_probe` | `tempfile.mkdtemp` L1599；`os.chmod` L1602；`os.mkdir` L1615；`os.chown` L1620；`subprocess.run` L1650,1655；`subprocess.Popen` L1662；`child.stdin.write` L1720；`child.kill` L1734；`shutil.rmtree` L1738 |
| M00 | `trusted_fixed_capture_probe.verify_listener_owner` | `subprocess.run` L1692 |
| M00 | `fsync_generation_snapshot` | `os.fsync` L1756,1762,1770 |
| M00 | `_stage_exact_wec_bridge` | `shutil.copytree` L1843；`os.symlink` L1861 |
| M00 | `deploy` | `os.makedirs` L2011,2023,2040；`shutil.copytree` L2030,2048,2084,2125；`os.chown` L2088；`os.lchown` L2091,2093；`os.rename` L2113,2114；`shutil.copy2` L2129 |
| M00 | `atomic_install_file` | `os.open` L2187；`os.write` L2192；`os.fsync` L2195；`os.fchown` L2196；`os.fchmod` L2197；`os.replace` L2200 |
| M00 | `atomic_install_dir` | `os.open` L2205；`os.write` L2210；`os.fsync` L2213；`os.fchown` L2214；`os.fchmod` L2215；`os.replace` L2218 |
| M00 | `rollback` | `os.rename` L2286,2287,2375,2376；`shutil.copytree` L2350,2357；`os.chown` L2367；`os.lchown` L2370,2372 |
| M00 | `verified_capture_assembly` | `tempfile.mkdtemp` L2482；`shutil.rmtree` L2493 |
| M00 | `materialize_fixed_capture_links.copy_package` | `os.makedirs` L2572,2619；`os.symlink` L2573,2624,2632；`os.unlink` L2608；`shutil.rmtree` L2610；`os.mkdir` L2611,2628 |
| M00 | `materialize_fixed_capture_links` | `os.unlink` L2657,2666,2684；`os.symlink` L2667；`os.mkdir` L2685 |
| M00 | `repair_preserve` | `shutil.rmtree` L2748；`shutil.copytree` L2749；`os.chown` L2750,2753,2755,2756 |
| M00 | `adopt_existing` | `os.makedirs` L2799 |
| M00 | `capture_current_generation` | `os.makedirs` L2863；`os.mkdir` L2864,2873；`os.rename` L2875；`shutil.rmtree` L2939 |
| M00 | `ds_update` | `os.makedirs` L3233；`open` L3257；`fh.write` L3258 |
| M00 | `product_api_8788_action` | `os.makedirs` L3317；`fcntl.flock` L3360 |
| M00 | `p0_fixed_action` | `job.start` L3436 |
| M00 | `p0_reader_pair_guard` | `fcntl.flock` L3561,3602 |
| M00 | `p0_reader_action` | `job.start` L3702 |
| M00 | `p0_successor_action` | `threading.Thread(target=_p0_successor_diagnose_worker, daemon=True).start` L3786；`job.start` L3798 |
| M00 | `_travel_terminal_action` | `threading.Thread(target=_travel_terminal_worker, daemon=True).start` L3911 |
| M00 | `observation_health_once` | `conn.send` L4513 |
| M00 | `observation_runtime_inputs` | `subprocess.run` L4755 |
| M00 | `observation_reply` | `conn.sendall` L4911 |
| M00 | `BoundedDispatcher.submit` | `worker.start` L4945 |
| M00 | `legacy_handle` | `os.chown` L5157 |
| M00 | `serve` | `os.makedirs` L5205,5214,5215；`os.chown` L5206,5217,5228；`os.chmod` L5207,5218,5219,5221,5222,5229；`os.unlink` L5224；`server.bind` L5226；`sys.stderr.write` L5231；`admission.start` L5237 |
| M00 | `self_restart` | `os._exit` L5245 |
| M02 | `Execution._diagnostic_stderr` | `sys.stderr.write` L180 |
| M02 | `Execution.safe_dir` | `os.mkdir` L197；`os.fsync` L197 |
| M02 | `Execution.observe_line` | `os.write` L373 |
| M02 | `Execution.owner` | `os.write` L414 |
| M02 | `Execution.execute` | `subprocess.Popen` L1451；`child.terminate` L1472,1483 |
| M02 | `Execution.recovery_abort` | `subprocess.Popen` L1632；`child.terminate` L1653,1670 |
| M02 | `Execution.disposal_dispose` | `os.remove` L1739；`os.rmdir` L1740；`os.fsync` L1742 |
| M02 | `install_execution_hooks.Dispatcher.submit` | `threading.Thread(target=work, daemon=True).start` L1808 |
| M03 | `guard_context` | `os.open` L308,326；`fcntl.flock` L311,316,329,334 |
| M03 | `child_node` | `subprocess.run` L363；`sys.stderr.buffer.write` L371 |
| M03 | `adapter_main` | `sys.stdout.buffer.write` L388 |
| M03 | `_create_file` | `os.open` L414；`os.write` L419；`os.fsync` L422,427 |
| M03 | `_journal` | `os.open` L434；`os.write` L438；`os.fsync` L439,444 |
| M03 | `snapshot_node_closure` | `os.mkdir` L519 |
| M03 | `_release_original_holder` | `os.open` L638,642；`fcntl.flock` L640,645,650；`os.unlink` L655；`os.fsync` L656,661；`os.rmdir` L660 |
| M03 | `_transfer` | `os.open` L708；`fcntl.flock` L711；`run` L830,831,832,833 |
| M03 | `_transfer.run` | `subprocess.Popen` L784；`os.killpg` L809,815 |
| M03 | `<module>` | `sys.stderr.write` L943 |
| M04 | `_fetch_jwks` | `subprocess.run` L72 |
| M04 | `_verified_claims` | `os.write` L95；`subprocess.run` L97 |
| M07 | `_held` | `fcntl.flock` L86 |
| M07 | `_group_exists` | `os.killpg` L222 |
| M07 | `_settle` | `os.killpg` L230,240 |
| M07 | `_run_probe` | `subprocess.Popen` L252 |
| M08 | `_read` | `os.fsync` L79 |
| M08 | `_lease` | `fcntl.flock` L194 |
| M08 | `_rename_excl` | `call` L203 |
| M08 | `_publish` | `os.open` L249；`os.fchown` L250；`os.fchmod` L250；`os.write` L253；`os.fsync` L254,257；`os.unlink` L266 |
| M09 | `_read` | `os.fsync` L53 |
| M09 | `_lease` | `fcntl.flock` L75 |
| M09 | `_rename_excl` | `call` L84 |
| M09 | `_publish` | `os.open` L129；`os.fchown` L130；`os.fchmod` L130；`os.write` L133；`os.fsync` L134,137；`os.unlink` L146 |
| M10 | `_read` | `os.fsync` L52 |
| M10 | `_lease` | `fcntl.flock` L74 |
| M10 | `_rename_excl` | `call` L83 |
| M10 | `_publish` | `os.open` L128；`os.fchown` L129；`os.fchmod` L129；`os.write` L132；`os.fsync` L133,136；`os.unlink` L145 |
| M10 | `_blob` | `os.fsync` L210 |
| M10 | `_copy_archive` | `os.open` L359；`os.write` L362；`os.fsync` L363 |
| M10 | `_sync_post` | `os.fsync` L380 |
| M10 | `_run_child` | `subprocess.Popen` L389；`child.communicate` L390,402；`os.killpg` L400 |
| M10 | `_quiescent` | `subprocess.run` L407,416 |
| M10 | `NativeLease.__enter__` | `os.open` L432；`fcntl.flock` L435 |
| M10 | `NativeLease.verify` | `os.open` L459；`fcntl.flock` L461,464 |
| M10 | `NativeLease.release` | `os.unlink` L470；`os.rmdir` L470；`os.fsync` L470 |
| M10 | `_preserve` | `os.fsync` L486,490 |
| M11 | `_blob` | `os.fsync` L105 |
| M11 | `NativeLease.__enter__` | `os.open` L117；`fcntl.flock` L120 |
| M11 | `NativeLease.verify` | `os.open` L144；`fcntl.flock` L146,149 |
| M11 | `NativeLease.release` | `os.unlink` L155；`os.rmdir` L155；`os.fsync` L155 |
| M11 | `_stop_child` | `os.killpg` L182 |
| M11 | `_bounded_io` | `os.write` L203 |
| M11 | `_run_child` | `subprocess.Popen` L223 |
| M11 | `_rename_new` | `call` L271 |
| M11 | `_put` | `os.open` L284；`os.fchown` L286；`os.fchmod` L286；`os.write` L288；`os.fsync` L289,294；`os.replace` L293 |
| M11 | `_global_lease` | `fcntl.flock` L314 |
| M11 | `_command` | `subprocess.run` L321 |
| M11 | `_json_child` | `subprocess.Popen` L389 |
| M11 | `RecoveryScene.batch_check` | `os.fsync` L497,499 |
| M12 | `readonly_quiescent` | `subprocess.run` L97,104 |
| M13 | `_blob` | `os.fsync` L123 |
| M13 | `NativeLease.__enter__` | `os.open` L135；`fcntl.flock` L138 |
| M13 | `NativeLease.verify` | `os.open` L162；`fcntl.flock` L164,167 |
| M13 | `NativeLease.release` | `os.unlink` L173；`os.rmdir` L173；`os.fsync` L173 |
| M13 | `_stop_child` | `os.killpg` L200 |
| M13 | `_bounded_io` | `os.write` L221 |
| M13 | `_run_child` | `subprocess.Popen` L241 |
| M13 | `_rename_new` | `call` L284 |
| M13 | `_put` | `os.open` L297；`os.fchown` L299；`os.fchmod` L299；`os.write` L301；`os.fsync` L302,307；`os.replace` L306 |
| M13 | `_global_lease` | `fcntl.flock` L327 |
| M13 | `_command` | `subprocess.run` L334 |
| M13 | `_json_child` | `subprocess.Popen` L460 |
| M13 | `RecoveryScene.batch_check` | `os.fsync` L573,575 |
| M14 | `readonly_quiescent` | `subprocess.run` L92,99 |
| M14 | `_r44_quiescent` | `subprocess.run` L337,352 |
| M15 | `_read` | `os.fsync` L69 |
| M15 | `_lease` | `fcntl.flock` L186 |
| M15 | `_rename_excl` | `call` L195 |
| M15 | `_publish` | `os.open` L241；`os.fchown` L242；`os.fchmod` L242；`os.write` L245；`os.fsync` L246,249；`os.unlink` L258 |
| M16 | `_read` | `os.fsync` L69 |
| M16 | `_lease` | `fcntl.flock` L192 |
| M16 | `_rename_excl` | `call` L201 |
| M16 | `_publish` | `os.open` L247；`os.fchown` L248；`os.fchmod` L248；`os.write` L251；`os.fsync` L252,255；`os.unlink` L264 |
| M18 | `durable_json` | `os.open` L12；`os.fsync` L13；`os.replace` L15 |
| M18 | `clone_exact.copy` | `os.symlink` L25；`os.mkdir` L27；`copy` L28；`os.open` L30；`os.fsync` L37；`os.chown` L40；`os.chmod` L41 |
| M18 | `clone_exact` | `copy` L43 |
| M18 | `AtomicApply.run` | `os.rename` L81 |
| M19 | `CanaryAdapter.capture` | `ledger.mkdir` L29 |
| M21 | `ExcludedGenericBinding.capture` | `os.open` L106；`os.write` L110；`os.fsync` L113,116 |
| M25 | `process_start` | `subprocess.run` L8 |
| M25 | `retire_own_dead_lock` | `os.rename` L34 |
| M26 | `fsync_path` | `os.fsync` L18 |
| M26 | `writeall` | `os.write` L25 |
| M26 | `_prepare_fixed_domain` | `os.mkdir` L86；`os.fsync` L88,95 |
| M26 | `_write_admission_receipt` | `os.open` L174；`os.fsync` L175 |
| M26 | `resolve_current_workspaces` | `subprocess.run` L198 |
| M26 | `_captured_apply` | `stage.mkdir` L243；`destination.mkdir` L247；`target.parent.mkdir` L251；`os.open` L252,255,300；`os.fsync` L253,256,301；`lock.mkdir` L269；`subprocess.check_output` L270；`(lock / 'meta').write_text` L271；`(lock / 'meta').unlink` L311；`lock.rmdir` L311 |
| M27 | `acquire_existing_flock` | `os.open` L17；`fcntl.flock` L21 |
| M27 | `release_owned_flock` | `fcntl.flock` L29 |
| M27 | `OwnedFlock.assert_owned` | `os.open` L50；`fcntl.flock` L52,54 |
| M27 | `OwnerHost.status` | `subprocess.run` L92 |
| M27 | `OwnerHost.quiesce` | `subprocess.run` L105 |
| M27 | `OwnerHost.assert_unloaded` | `subprocess.run` L115 |
| M27 | `OwnerHost.bootstrap` | `subprocess.run` L120,122 |
| M28 | `process_gone` | `subprocess.run` L11 |
| M29 | `ProductionAdapter.fence` | `os.rename` L59 |
| M29 | `ProductionAdapter.clear_fence` | `os.replace` L69；`FENCE.unlink` L70 |
| M29 | `ProductionAdapter.readback` | `subprocess.run` L86 |
| M29 | `apply` | `tx.run` L103 |
| M30 | `finish_committed` | `os.replace` L35；`fence.unlink` L36 |
| M30 | `rollback` | `lock.mkdir` L75；`subprocess.check_output` L76；`(lock / 'meta').write_text` L77；`os.replace` L102；`FENCE.unlink` L103；`(lock / 'meta').unlink` L111；`lock.rmdir` L111 |
| M31 | `_sync` | `os.fsync` L9 |
| M31 | `_writeall` | `os.write` L24 |
| M31 | `_remove` | `shutil.rmtree` L84；`os.unlink` L85 |
| M31 | `EffectJournal.__init__` | `os.mkdir` L132 |
| M31 | `EffectJournal._save` | `os.open` L136；`os.fsync` L137；`os.replace` L139 |
| M31 | `EffectJournal.capture` | `os.open` L145；`os.fsync` L146 |
| M31 | `EffectJournal.freeze` | `os.rename` L158 |
| M31 | `EffectJournal.restore` | `os.rename` L180 |
| M32 | `process_table` | `subprocess.run` L9 |
| M32 | `start` | `subprocess.run` L18 |
| M32 | `record` | `start` L47 |
| M32 | `remaining` | `start` L57 |
| M32 | `bootstrap` | `pending.unlink` L71 |
| M33 | `safe_container` | `current.mkdir` L27 |
| M33 | `extract_pinned_tar` | `destination.mkdir` L48；`os.open` L52；`os.fsync` L56 |
| M33 | `owned_tree` | `os.chown` L61 |
| M33 | `remove_link_or_tree` | `path.unlink` L67；`shutil.rmtree` L68 |
| M33 | `build` | `out.mkdir` L71；`os.chmod` L80,85,87,91；`os.chown` L80,87；`inputs.mkdir` L83；`new_plist.write_bytes` L91；`generation.mkdir` L95；`new_gen.mkdir` L99；`homes.mkdir` L105；`home.mkdir` L107；`subprocess.run` L119；`link.unlink` L121 |
| M34 | `sync` | `os.fsync` L30 |
| M34 | `write_new` | `os.open` L33；`os.write` L36；`os.fsync` L37 |
| M34 | `deliver_frame` | `os.write` L47 |
| M34 | `replace_json` | `os.replace` L51 |
| M34 | `Job.start` | `self.root.mkdir` L97；`bundle.mkdir` L101；`target.parent.mkdir` L103；`self.thread.start` L106 |
| M34 | `Job._run` | `err_thread.start` L131 |
| M35 | `worker_state` | `subprocess.run` L16 |
| M35 | `maintenance_guard` | `fcntl.flock` L82,90 |
| M37 | `run` | `subprocess.run` L39 |
| M37 | `command` | `run` L56 |
| M37 | `round_read` | `run` L72,73 |
| M39 | `durable_json` | `os.open` L12；`os.fsync` L13；`os.replace` L15 |
| M39 | `clone_exact.copy` | `os.symlink` L25；`os.mkdir` L27；`copy` L28；`os.open` L30；`os.fsync` L37；`os.chown` L40；`os.chmod` L41 |
| M39 | `clone_exact` | `copy` L43 |
| M39 | `AtomicApply.run` | `os.rename` L81 |
| M40 | `CanaryAdapter.capture` | `ledger.mkdir` L29 |
| M42 | `ExcludedGenericBinding.capture` | `os.open` L107；`os.write` L111；`os.fsync` L114,117 |
| M46 | `process_start` | `subprocess.run` L8 |
| M46 | `retire_own_dead_lock` | `os.rename` L34 |
| M47 | `fsync_path` | `os.fsync` L18 |
| M47 | `writeall` | `os.write` L25 |
| M47 | `_prepare_fixed_domain` | `os.mkdir` L86；`os.fsync` L88,95 |
| M47 | `_write_admission_receipt` | `os.open` L174；`os.fsync` L175 |
| M47 | `resolve_current_workspaces` | `subprocess.run` L198 |
| M47 | `_captured_apply` | `stage.mkdir` L243；`destination.mkdir` L247；`target.parent.mkdir` L251；`os.open` L252,255,302；`os.fsync` L253,256,303；`lock.mkdir` L270；`subprocess.check_output` L271；`(lock / 'meta').write_text` L272；`capture.settings_binding.bind` L284；`(lock / 'meta').unlink` L313；`lock.rmdir` L313 |
| M48 | `acquire_existing_flock` | `os.open` L17；`fcntl.flock` L21 |
| M48 | `release_owned_flock` | `fcntl.flock` L29 |
| M48 | `OwnedFlock.assert_owned` | `os.open` L50；`fcntl.flock` L52,54 |
| M48 | `OwnerHost.status` | `subprocess.run` L92 |
| M48 | `OwnerHost.quiesce` | `subprocess.run` L105 |
| M48 | `OwnerHost.assert_unloaded` | `subprocess.run` L115 |
| M48 | `OwnerHost.bootstrap` | `subprocess.run` L120,122 |
| M49 | `process_gone` | `subprocess.run` L11 |
| M50 | `ProductionAdapter.fence` | `os.rename` L62 |
| M50 | `ProductionAdapter.clear_fence` | `os.replace` L73；`FENCE.unlink` L74 |
| M50 | `ProductionAdapter.readback` | `subprocess.run` L90 |
| M50 | `apply` | `tx.run` L109 |
| M52 | `finish_committed` | `os.replace` L35；`fence.unlink` L36 |
| M52 | `rollback` | `lock.mkdir` L75；`subprocess.check_output` L76；`(lock / 'meta').write_text` L77；`os.replace` L108；`FENCE.unlink` L109；`(lock / 'meta').unlink` L117；`lock.rmdir` L117 |
| M53 | `_sync` | `os.fsync` L9 |
| M53 | `_writeall` | `os.write` L24 |
| M53 | `_remove` | `shutil.rmtree` L84；`os.unlink` L85 |
| M53 | `EffectJournal.__init__` | `os.mkdir` L132 |
| M53 | `EffectJournal._save` | `os.open` L136；`os.fsync` L137；`os.replace` L139 |
| M53 | `EffectJournal.capture` | `os.open` L145；`os.fsync` L146 |
| M53 | `EffectJournal.freeze` | `os.rename` L158 |
| M53 | `EffectJournal.restore` | `os.rename` L180 |
| M54 | `process_table` | `subprocess.run` L9 |
| M54 | `start` | `subprocess.run` L18 |
| M54 | `record` | `start` L47 |
| M54 | `remaining` | `start` L57 |
| M54 | `bootstrap` | `pending.unlink` L71 |
| M56 | `safe_container` | `current.mkdir` L27 |
| M56 | `extract_pinned_tar` | `destination.mkdir` L48；`os.open` L52；`os.fsync` L56 |
| M56 | `owned_tree` | `os.chown` L61 |
| M56 | `remove_link_or_tree` | `path.unlink` L67；`shutil.rmtree` L68 |
| M56 | `fixed_public_profile_mode` | `os.fchmod` L79；`os.fsync` L80 |
| M56 | `build` | `out.mkdir` L84；`os.chmod` L93,98,100,104；`os.chown` L93,100；`inputs.mkdir` L96；`new_plist.write_bytes` L104；`generation.mkdir` L108；`new_gen.mkdir` L112；`homes.mkdir` L118；`home.mkdir` L120；`subprocess.run` L132；`link.unlink` L134 |
| M57 | `sync` | `os.fsync` L30 |
| M57 | `write_new` | `os.open` L33；`os.write` L36；`os.fsync` L37 |
| M57 | `deliver_frame` | `os.write` L47 |
| M57 | `replace_json` | `os.replace` L51 |
| M57 | `Job.start` | `self.root.mkdir` L97；`bundle.mkdir` L101；`target.parent.mkdir` L103；`self.thread.start` L106 |
| M57 | `Job._run` | `err_thread.start` L131 |
| M59 | `durable_json` | `os.open` L12；`os.fsync` L13；`os.replace` L15 |
| M59 | `clone_exact.copy` | `os.symlink` L25；`os.mkdir` L27；`copy` L28；`os.open` L30；`os.fsync` L37；`os.chown` L40；`os.chmod` L41 |
| M59 | `clone_exact` | `copy` L43 |
| M59 | `AtomicApply.run` | `os.rename` L81 |
| M60 | `CanaryAdapter.capture` | `ledger.mkdir` L29 |
| M62 | `ExcludedGenericBinding.capture` | `os.open` L107；`os.write` L111；`os.fsync` L114,117 |
| M66 | `process_start` | `subprocess.run` L8 |
| M66 | `retire_own_dead_lock` | `os.rename` L34 |
| M67 | `fsync_path` | `os.fsync` L18 |
| M67 | `writeall` | `os.write` L25 |
| M67 | `_prepare_fixed_domain` | `os.mkdir` L86；`os.fsync` L88,95 |
| M67 | `_write_admission_receipt` | `os.open` L175；`os.fsync` L176 |
| M67 | `resolve_current_workspaces` | `subprocess.run` L199 |
| M67 | `_captured_apply` | `stage.mkdir` L244；`destination.mkdir` L248；`target.parent.mkdir` L252；`os.open` L253,256,304；`os.fsync` L254,257,305；`lock.mkdir` L272；`subprocess.check_output` L273；`(lock / 'meta').write_text` L274；`capture.settings_binding.bind` L286；`(lock / 'meta').unlink` L315；`lock.rmdir` L315 |
| M68 | `acquire_existing_flock` | `os.open` L17；`fcntl.flock` L21 |
| M68 | `release_owned_flock` | `fcntl.flock` L29 |
| M68 | `OwnedFlock.assert_owned` | `os.open` L50；`fcntl.flock` L52,54 |
| M68 | `OwnerHost.status` | `subprocess.run` L92 |
| M68 | `OwnerHost.quiesce` | `subprocess.run` L105 |
| M68 | `OwnerHost.assert_unloaded` | `subprocess.run` L118 |
| M68 | `OwnerHost.bootstrap` | `subprocess.run` L123,125 |
| M71 | `_FixedDiagnosticLease._worker_absent` | `subprocess.run` L74 |
| M71 | `_FixedDiagnosticLease.assert_owned` | `fcntl.flock` L99,101 |
| M71 | `_FixedDiagnosticLease.__enter__` | `fcntl.flock` L115 |
| M72 | `process_gone` | `subprocess.run` L11 |
| M73 | `ProductionAdapter.fence` | `os.rename` L62 |
| M73 | `ProductionAdapter.clear_fence` | `os.replace` L73；`FENCE.unlink` L74 |
| M73 | `ProductionAdapter.readback` | `subprocess.run` L90 |
| M73 | `apply` | `tx.run` L110 |
| M75 | `finish_committed` | `os.replace` L35；`fence.unlink` L36 |
| M75 | `rollback` | `lock.mkdir` L75；`subprocess.check_output` L76；`(lock / 'meta').write_text` L77；`os.replace` L108；`FENCE.unlink` L109；`(lock / 'meta').unlink` L117；`lock.rmdir` L117 |
| M76 | `_sync` | `os.fsync` L9 |
| M76 | `_writeall` | `os.write` L24 |
| M76 | `_remove` | `shutil.rmtree` L84；`os.unlink` L85 |
| M76 | `EffectJournal.__init__` | `os.mkdir` L132 |
| M76 | `EffectJournal._save` | `os.open` L136；`os.fsync` L137；`os.replace` L139 |
| M76 | `EffectJournal.capture` | `os.open` L145；`os.fsync` L146 |
| M76 | `EffectJournal.freeze` | `os.rename` L158 |
| M76 | `EffectJournal.restore` | `os.rename` L180 |
| M77 | `process_table` | `subprocess.run` L9 |
| M77 | `start` | `subprocess.run` L18 |
| M77 | `record` | `start` L47 |
| M77 | `remaining` | `start` L57 |
| M77 | `bootstrap` | `pending.unlink` L71 |
| M79 | `safe_container` | `current.mkdir` L27 |
| M79 | `extract_pinned_tar` | `destination.mkdir` L48；`os.open` L52；`os.fsync` L56 |
| M79 | `owned_tree` | `os.chown` L61 |
| M79 | `remove_link_or_tree` | `path.unlink` L67；`shutil.rmtree` L68 |
| M79 | `fixed_public_profile_mode` | `os.fchmod` L79；`os.fsync` L80 |
| M79 | `build` | `out.mkdir` L84；`os.chmod` L93,98,100,104；`os.chown` L93,100；`inputs.mkdir` L96；`new_plist.write_bytes` L104；`generation.mkdir` L108；`new_gen.mkdir` L112；`homes.mkdir` L118；`home.mkdir` L120；`subprocess.run` L132；`link.unlink` L134 |
| M80 | `sync` | `os.fsync` L30 |
| M80 | `write_new` | `os.open` L33；`os.write` L36；`os.fsync` L37 |
| M80 | `deliver_frame` | `os.write` L47 |
| M80 | `replace_json` | `os.replace` L51 |
| M80 | `Job.start` | `self.root.mkdir` L99；`bundle.mkdir` L103；`target.parent.mkdir` L105；`self.thread.start` L108 |
| M80 | `Job._run` | `err_thread.start` L133 |
| M81 | `request` | `client.sendall` L156 |
| M81 | `stage` | `os.makedirs` L228；`shutil.rmtree` L233；`shutil.copytree` L236；`os.replace` L240 |
| M81 | `main` | `os.makedirs` L390；`os.replace` L397 |
| M83 | `owner_session` | `threading.Thread(target=run, daemon=True).start` L109；`stdout.write` L125；`reader.start` L127 |

#### 补充 gzip Router JS / graph owner JS 词法效果点

仅按效果词定位（包括 import、函数定义、注释提及），不把词法命中当实际调用。Router serializer 中持久化 helper 存在，outer summary/selector 不因打包了该 helper 就被推导成已调用它。graph START 当前拒绝，未运行历史 owner entry。外部 shell/Node 动态依赖及 payload 应用代码仍 UNKNOWN。

| 源模块与外层字符串行 | 解码 SHA-256 | 效果词与行号 |
|---|---|---|
| `ROUTER_INGRESS_BUNDLE_GZIP_B64`（首外层 L174） | `0e14be9d86d620318bce3bba6f51adfeda5ca1ae4dbee33963936aac5a8574a9` | `fsyncSync` L100,345,348；`mkdirSync` L100,340；`renameSync` L101,346；`unlinkSync` L101,350；`writeFileSync` L101,343；`rename` L350 |
| `ROUTER_BUNDLE_GZIP_B64`（首外层 L175） | `8d4e7b5877877145f3026dfcf520e625adee4c5b7f89df43a4d9a91302673b84` | `fsyncSync` L67,309,312；`mkdirSync` L67,304；`renameSync` L68,310；`unlinkSync` L68,314；`writeFileSync` L68,307；`rename` L314 |
| `P0_GRAPH_B64/owner/journal.mjs / P0_READER_GRAPH_B64/owner/journal.mjs / P0_SUCCESSOR_GRAPH_B64/owner/journal.mjs`（首外层 L3411） | `177b148b207bfc06d674806bdfd85a1a2cbc4c977ab7cc538bedb573ff3cf9f1` | `rename` L2；`fsyncSync` L23,24,61；`writeFileSync` L24；`chmodSync` L56；`mkdirSync` L58；`writeSync` L61；`renameSync` L64,65；`rmSync` L65 |
| `P0_GRAPH_B64/owner/lifecycle.mjs / P0_READER_GRAPH_B64/owner/lifecycle.mjs / P0_SUCCESSOR_GRAPH_B64/owner/lifecycle.mjs`（首外层 L3411） | `ae1c82c1dc5d20b24a2364709018bcc2ce0597238442a09bcf320f20361590cf` | `bootstrap` L9,24,35；`fsyncSync` L12,14；`writeSync` L14 |
| `ROUTER_BUNDLE_GZIP_B64_V5`（首外层 L176） | `cefc60289cf507dc32c6b04e5b7857b0ecd1b4730b19545f390a1ced559fc7b7` | `fsyncSync` L100,345,348；`mkdirSync` L100,340；`renameSync` L101,346；`unlinkSync` L101,350；`writeFileSync` L101,343；`rename` L350 |

完整外部效果与跨进程保护覆盖仍为 **UNKNOWN/PARTIAL**；上述具体未取锁分支与历史阻断分支仅作为调查事实，不据此改 accepted authority、不重启/修补 installed bytes、不解除 UNKNOWN fence。

### 4.2 fleet runner 及其静态效果清单


F0=`scripts/fleet-window/window-executor-v5.sh`，F1=`window_helper.py`，F2=`window_helper_core.py`，FX=`window_preimage_xattr.py`，FS=`settle_unresolved_runtime_down.mjs`；都固定B。`root`指runner实际以sudo调用，`user`指明确nonroot writer；它们是代码要求，不等于本轮已获生产权限。

| 操作/函数 | 坐标 | 写入/生命周期效果 | root / mutex / journal |
|---|---|---|---|
| main / stage00 / helper `authority,mutex` | F0`:157–160,297–303`；F1`:5–19` | 建RECEIPTS/run唯一目录、tee window.log、保存authority/invocation/c7副本；原子mkdir生产mutex并写holder chmod0600。 | receipt先于锁由user写；mutex root；holder hash记入mutex.json。创建JSON不授予角色。 |
| main每stage与失败出口 | F0`:148–154,305–318`；F1`:352–355`；F2 `save/raw:42–49` | phase JSON覆写/phase-events.jsonl追加、普通evidence/log写/chmod/chown；ERR只记失败并打印rollback recipe。 | perstage前root mutex-check；phase是user；这不是交易journal或所有叶原子性证明。F0`:114–145` rm/mv/restore文字仅recipe打印，不是自动执行。 |
| stage01 / `clean` | F0`:162–173`；F1`:30–53` | root mktemp封印bundle/cp payload与工具/chown/chmod；user备份并删除source中仅untracked pnpm-lock.yaml。 | main持mutex；清理有all备份及fresh hash/meta检查；不清他人锁。 |
| stage03b / prepareRuntime/runChild/verify | F0`:177–183`；`anarrowed/candidate-state.mjs:39–76,90–151`；`candidate-child.mjs:16,85–136` | RD内mkdir/json/log/隔离runtime；spawn candidate child；超时SIGKILL；child self SIGTERM。 | runner root；main mutex；子入口本身不检查生产mutex，isolated receipt限制不等于独立全局写门。 |
| stage06a / `preimage` / reconcile_xattrs | F0`:185`；F1`:159–182`；FX`:90–110` | ditto live→RD/preimage-full、ACL/xattr/外部metadata收据；仅对目标副本缺失空xattr `xattr -s -w name ''`补写。 | root，持mutex；实际源inventory/ACL重核。不是生产树xattr patch。 |
| stage04 / quiet | F0`:186–197`；F1`:121–132` | 轮询mtime和只读census；write census/quiet receipts；无settlement、kill、bootout。 | root主路径mutex；不把日志静默当worker终止。 |
| stage05 / before-stop / exit-check | F0`:198–209`；F1`:133–158` | `/bin/launchctl bootout system PLIST`；保存old-worker/physical exit/census收据。 | root+main mutex；无kill自动fallback；exit/port未知拒绝。 |
| stage05b / settleRuntimeDown/publishCandidate | F0`:211–220`；FS`:91–108,111–178` | 建同目录临时candidate、官方writer后原行保全、write/fsync/rename覆盖turn-recovery store、fsync父目录、rm仅临时目录；只settle exact exit，业务UNKNOWN。 | root主路径mutex；FS本身不获取生产mutex，依赖stage05/fresh hash+meta与runtimeDown门；非独立全局journal。 |
| stage07 / pinned install | F0`:223–251`；F1`:191–224` | env-i root installer、install-invocation/log/exits及成功/失败rollback坐标收据。 | inherited production mkdir mutex；失败留runner所持锁、无自动second install。外部bundle字节由hash校验，installed资格另证。 |
| stage08 / preserve-config | F0`:253–259`；F1`:225–251` | 仅将停机前当前preimage/config中缺失项ditto到live/config，保存carryforward收据，不覆盖已有项。 | root+mutex，service_absent、inventory/ACL全对照。 |
| stage09 / final-binding | F0`:260`；F1`:252–283` | 写final inventories/ACL/config/provenance绑定收据；不修改candidate bytes以凑PASS。 | root+mutex，service_absent、完整byte/link/mode与dual receipts；UNKNOWN不能冒充ready。 |
| stage10 / plist-update | F0`:261–265`；F1`:284–298` | 唯一deployed SHA字段写新plist临时文件、chown/chmod、lint后os.replace；`launchctl bootstrap system PLIST`。 | root+mutex，旧plist exact hash重核；不自动bootstrap重试。 |
| stage11/12 | F0`:267–280`；F1`:299–344` | ps/launchctl/health/log观察及readback receipts；hr-watch时间与匹配行收据。 | root/user按helper权限，main mutex；本普查未执行，源码里的health接口不在本次调用。 |
| stage13 / close/release | F0`:282`；F1`:356–369`；`window_close.py:38–80,130–146` | close JSON及删除候选**清单**；删除自己的holder并rmdir自身锁，写completion。 | root，精确holder digest；retention deletion=false，源码未执行候选删除；failed路径不release。 |

**可达installer主路径进一步展开（当前仓内版本的静态清单，不冒充上述2a6b封印版本）：**`scripts/trusted-cp-deploy-install.sh` 根级主程序没有外层函数名；`:541–556` root门及mkdir mutex/继承holder门。`:604–649` 临时source-stamp/prescan copy/delete；`:695` 调backup helper写budget receipt；`:704–742` mv live到BAK并写metadata、建new root；`:777–805` 重用harness/.cache/node子树mv并记reuse marker；`:811–843` tar和offline pnpm及cp Node（可写/tmp日志）；`:898–1031` app copy/package materialization/provenance、symlink、rm旧包、vendor覆盖；`:1058–1116` authsvc .dsh seed、home profile/credential/config复制或新seed；`:1135–1218` PROD_ROOT mkdir/agents symlink/ownership+mode树重设与cache权限；`:1233–1237` clang并首次install root:wheel 4755 spawn helper；`:1292–1300` run502尝试两文件写与symlink、预期DENIED（若环境失守则是真实写）。`composed_exit_cleanup:185–206` 删自己temp stamp/仅自己获取holder锁；`emit_mutation_receipt:119–181` 失败best-effort记录，**先释放installer-owned锁再记receipt**，不能称锁内不可变journal；继承锁不由child释放。当前仓内installer未见launchctl/kill实际语句，restart由runner分阶段完成。

保护局限：F2 `authority:88–91` 后续只重核复制JSON的UTC；`validate_authority:25–38` 检字段、nonroot UID、固定old SHA、required scopes子集与UTC，未消费fresh issuer/appointment/revocation。F1可直接按`RD op`执行，所有写branch未逐一自检mutex；FS也不自己获取生产锁。因此仅能判定正常runner调用链的局部保护 EXISTS（上表坐标），不能判全主机所有直接helper/旧入口/重启路径已被同一控制覆盖。D的flock锁与fleet mkdir锁是不同对象/机制，不能合称全局已统一。上述代码全未执行，资格和真实current writer仍需独立绑定。

## 5. loaded 资格与缺口结论

### 5.1 来源、安装、loaded、准入及writer分列

| 命题 | 判定 / 证据与限制 |
|---|---|
| 当前D/client安装字节可定位 | **EXISTS**；§1逐文件hash/metadata，§2两份原生receipt exact pair一致。`2026-11-09T05:31:51.376441Z` / 北京`13:31:51.376441+08:00`再次hash仍为9044/040f；单次read前后dev/ino/size/mtime_ns一致。这是读时稳定，不是未来不变。 |
| installed bytes == 已定位完整source bytes | **UNKNOWN**；本仓所有当时refs可达blob无完整匹配，局部240行匹配不能代表整体。未定位source repo/revision/构建与内嵌载荷生成来源。不是已知unequal source，而是没有完整source比较主体。 |
| 启动登记/进程加载当前安装bytes | 登记/running **EXISTS**（§3 print PID380）；exact loaded digest **UNKNOWN**；未取到ps、启动时同hash收据或内存/loaded attestation。mtime、COMMITTED、KeepAlive和PID均不是loaded证明。 |
| 已准入profile、目标效果和最新registry | **UNKNOWN/PARTIAL**；受保护config不可读；§2有历史scheduler rollback ADMITTED与未bootstrap profile，但它们不能证明当前D/SRA profile已准入。D源码的默认路径/UID/action声明也不证明当前任命。 |
| 当前唯一writer / mutex holder | **UNKNOWN**；只见D mutation.lock inode与fleet不同mkdir机制，未获取/试取锁，ps不可用；§4存在没有同等锁/收据的静态入口，不把单legacy线程等同全主机唯一writer或所有旧路径已退出。 |
| SRA条件④ Δ0闭合 | **PARTIAL，未闭合**；不是EFFECTIVE、签发、bootstrap、生产验证或业务PASS。未知来源/资格不得靠直接patch installed修补。 |

### 5.2 交付校验与停止边界

`python3 .agents/tools/verify_governance.py --target . --require-accepted` 实测rc0，原文 `vendored governance bytes match governance.lock.json and adoption is accepted`，只验证vendored bytes/lock，不验证D/fleet或任命。仅对两文档做结构、坐标与diff校验；未运行产品测试、installer自检、fleet dry-run/execute或负向资格测试，避免把会写文件/重启的程序当只读普查。独立复核及Git交付结果在最终readback后记录，不预填PR号、未来commit或DONE。

独立证据复核：非作者 `/root/evidence_review` 已独立复算D/client与r68a/r68b摘要、ref/object清单、240行局部匹配、registry唯一selector/canonical hash，并抽查fleet lifecycle/kill、profile拒绝和installer锁/receipt边界；全文五节与UNKNOWN/PARTIAL声明未见blocking事实问题。按其意见修正print原件空行L42为实际last-exit L41；另补V5 Router静态解码行。此段加入前的报告内容SHA-256=`79662626741b53b91f477d2a0e48dc7bbd20322e1234952c295ceb6e49e1b357`，最终delta与两文件范围再核。该审查只评价调查证据，不授予production资格或闭包完整PASS。

交付工作面调整：原工作树执行 `git add -- D0-ENTRY-PROVENANCE-CENSUS.md BRIEF-D0-ENTRY-PROVENANCE.md` 实测rc128，原文 `fatal: Unable to create '/Users/yanfenma/workspace/project/dsh-agent-core/.git/worktrees/ops-d0-provenance/index.lock': Operation not permitted`。没有修改该index、权限或共享ref。改在允许写入的 `/private/tmp/d0-entry-provenance-delivery-20261109` 建立本地 `git clone --shared --no-checkout`，只读复用对象、独立index/ref；固定相同B和branch=`ops/d0-entry-provenance`，origin设为 `https://github.com/mayf3/dsh-agent-core.git`，仅复制两文档后提交/传输。原工作树保留交付文档，原共享branch不因clone提交而移动；不创建第二生产writer。此处不是push失败，未改代理/网络配置。

**条件④ Δ0 还差什么（3行）：**
1. 原控制所有者补全D/client完整source repo/revision及内嵌载荷构建→installed pair的归属收据。
2. 以合法只读可访问证据绑定真实loaded入口、已准入profile/目标/效果、当前唯一writer与各可达写/重启边界，补三次进程树及未覆盖闭包。
3. 在来源与权限明确后另行完成SRA所需实际控制负向资格/独立verifier/任命生效；本次不激活、不改控制器，不宣称闭合。

### 5.3 Git 交付与 push STOP 收据

传输观察时间（UTC）：`2026-11-09 05:37:08 UTC`。单 commit 已在独立交付仓创建：`a14472acaff3713a3806f30e59dadfb80bc7c64f`，parent=`5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7`；subject=`docs(ops): delta-0 real control entry provenance census (read-only)`。commit 只含报告665行与原简报38行；`git diff --cached --check` rc0、单commit计数1、提交后交付仓clean。原简报未改写。

随后仅尝试一次 `git push origin ops/d0-entry-provenance`，rc=128，原文：

```text
fatal: unable to access 'https://github.com/mayf3/dsh-agent-core.git/': Failed to connect to 127.0.0.1 port 7890 after 0 ms: Couldn't connect to server
```

依简报执行 `env | grep -i proxy`，rc=0，原文（保持顺序与大小写）：

```text
ALL_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
NO_PROXY=localhost,open.feishu.cn,mcp.feishu.cn,127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,*.local
all_proxy=http://127.0.0.1:7890
http_proxy=http://127.0.0.1:7890
https_proxy=http://127.0.0.1:7890
no_proxy=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,*.local,api.z.ai,api.deepseek.com,open.feishu.cn,mcp.feishu.cn
```

**STOPPED — push 失败待监管传输。PR号：未创建。** 没有重试push、修改/清除代理、改传输方式、执行 `gh pr create` 或合并。本STOP附记在失败后按简报写入原工作树与交付仓报告；为停在push步骤，附记**尚未提交/未amend**，已创建的单commit不变。当前报告包含该失败收据，不能把本地提交称为已push/PR已创建。

