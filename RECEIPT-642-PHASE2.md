# RECEIPT-642-PHASE2 — Owner 接受后的原子退役事务

本 worker 的 docs-first Phase2 事务与适用校验已完成；R2 按监管明确裁定保真归档并豁免其 whitespace 检查，其余 staged 文件全量检查 rc0。最终交付 HEAD 独立复核仍由监管另派，**未合并**。旧结构 CLI 尚不支持退役后 HEAD，详见 known-limits；未把未运行的最终 HEAD 检查写成 rc0。

- Worktree: `/private/tmp/rc3-chain`；分支 `docs/v3-succession-final`；PR [#642](https://github.com/mayf3/dsh-agent-core/pull/642)。
- Owner 接受的已审语义：`7f36750bf08d308cd7f648153e24c0b0e528e4c6`。
- 治理工具准备提交：`245d361a229513abb0fb09ba6a73ddcae11ab559`。
- **Phase2 原子生命周期提交：`2e67e98a7295dc78d18dad51bf673a0c3be9d009`**，tree `c3a0197cb67c1fdc14af9a3184e46e8d9976e209`。
- 原有五提交均原样保留；没有 rebase、产品源码或生产写入；`.agents/tools`、registry、现有结构 verifier 与 conformance Spec 字节均保持原样。
- 本回执及原文证据一并构成后续 evidence-only 提交。最终提交 SHA 的精确取值命令为 `git log -1 --format=%H -- RECEIPT-642-PHASE2.md`；提交后以远端 branch 和 PR #642 fresh readback 绑定，并在交付回执给出完整 SHA。文件不能嵌入其所属 commit 自身的 SHA，不预填或伪造该值；上列 Phase2 本体 SHA 已固定。

Owner 裁定来源：[PR #642 comment-6701500077](https://github.com/mayf3/dsh-agent-core/pull/642#issuecomment-6701500077)，`rulings[id=owner-20261107-642-643-1377]`。API 誊录件原文见 [owner-comment-6701500077.json](docs/reports/642-phase2-20261107/owner-comment-6701500077.json)。外部 registry 仅引用任务和誊录件给定坐标，未声称独立读取。Owner 原裁定日期为 2026-11-07；03:13:36Z 为评论誊录时间；03:20:10.813730Z 为本次接受状态落盘时间。

## 六条件交接状态

| 条件 | 实际结果 |
|---|---|
| 1 V3 accepted + 精确接受绑定 | 完成；V3 frontmatter 行 3–10，当前生命周期注记与 §15 |
| 2 V2 / TE 原子 superseded + 双向回链 | 完成；三 authority 文件与 lock/index 同在上述七文件原子提交；历史正文不变 |
| 3 实际权威索引 | 完成；local README 行 95/113，Spec index 行 98/106/110；Decision index 无结构条目，原样保留 |
| 4 本次 rc.3 adoption 合法闭合 | 完成；AD3 §14 显式后续更新接受记录、accepted lock、25 文件与精确来源 manifest parity |
| 5 适用完整生命周期与治理校验 | 所有下列适用工具 rc0；真实 native 生命周期与 governing adoption graph 分别验证；R2 最终证据检查见 `R2-evidence-diff-check.command.json`，只排除保真的 `atomic-lifecycle.diff` |
| 6 最终 HEAD 独立复核 | **PENDING_REGULATOR**；依 `BRIEF-642-PHASE2.md:16` 由监管在本次交付后另派；复核对象为上列命令解析并由远端读回的最终提交 SHA。本 worker 的补交自检及辅助只读审计不替代该条件，不合并 |

## R2 机械续行与单文件豁免

授权来源为本次 2026-11-07 用户任务「R2续派(机械失败自动继续)」中的监管裁定：该归档必须保持字节忠实，不得为过检而改写；只豁免下列坐标，其余 staged 文件全量过检，失败即停。可复核转录与字节核对见 [R2-resumption.json](docs/reports/642-phase2-20261107/R2-resumption.json)。本次只续行证据检查、收据、commit 和 push 更新 PR #642，不重复已通过的修复和治理门。

```sh
git diff --cached --check -- . ":(exclude)docs/reports/642-phase2-20261107/atomic-lifecycle.diff"
```

唯一豁免坐标为 `docs/reports/642-phase2-20261107/atomic-lifecycle.diff`，16951 bytes，Git blob `5b3faccd0f0942f26dc06f2e67b664ba2cdd9e27`，SHA-256 `9c4699326c9c4d8e32bd5fe2fc61602ead994285118a89d3cff788341abf2af8`。其内容与 `git diff 2e67e98a^ 2e67e98a` 逐字节相同，工作区与 index 归档字节一致。单空格上下文行位于归档 39、72、74、120、122、145、154、160、237、246、248、263、268、270 行；这是 unified diff 格式固有空白，verbatim 保真优先。没有修改归档、增加 `.gitattributes` 或全局 whitespace 例外。

R1 未排除该归档的最终证据检查实际 rc2，历史 STOP 记录保留，不改写成 rc0。原 `diff-check.*` 仅证明 Phase2 生命周期本体 tree `c3a0197cb67c1fdc14af9a3184e46e8d9976e209` 的先前 rc0；本次新增 `R2-evidence-diff-check.*` 独立记录上述获准范围的实际 rc0。stdout 与 stderr 均为 0 bytes；所有其他 staged 路径完整纳入检查。

## 原文工具结果

每条命令的完整 argv、实际 exit code、执行时间与目标 tree/commit 均在同名 `.command.json`；stdout/stderr 原样归档，所有 stderr 为空。

| 校验 | 实际 rc / 结果 | 原文 |
|---|---|---|
| `structure-tool-increment` | 0；candidate violations=0，baseline debt=28（保留可见） | [stdout](docs/reports/642-phase2-20261107/structure-tool-increment.stdout) / [stderr](docs/reports/642-phase2-20261107/structure-tool-increment.stderr) / [argv+rc](docs/reports/642-phase2-20261107/structure-tool-increment.command.json) |
| `C-proposal` | 0；24 negative + 8 exception scope + 11 strict/legacy 全 PASS | [stdout](docs/reports/642-phase2-20261107/C-proposal.stdout) / [stderr](docs/reports/642-phase2-20261107/C-proposal.stderr) / [argv+rc](docs/reports/642-phase2-20261107/C-proposal.command.json) |
| `phase2-native` | 0；真实退役状态 + 15 项负向控制全部拒绝预期反例 | [stdout](docs/reports/642-phase2-20261107/phase2-native.stdout) / [stderr](docs/reports/642-phase2-20261107/phase2-native.stderr) / [argv+rc](docs/reports/642-phase2-20261107/phase2-native.command.json) |
| `governance-accepted` | 0；使用 --require-accepted | [stdout](docs/reports/642-phase2-20261107/governance-accepted.stdout) / [stderr](docs/reports/642-phase2-20261107/governance-accepted.stderr) / [argv+rc](docs/reports/642-phase2-20261107/governance-accepted.command.json) |
| `adoption-transition` | 0；完整五份 raw governing adoption metadata | [stdout](docs/reports/642-phase2-20261107/adoption-transition.stdout) / [stderr](docs/reports/642-phase2-20261107/adoption-transition.stderr) / [argv+rc](docs/reports/642-phase2-20261107/adoption-transition.command.json) |
| `diff-check` | 0；空输出 | [stdout](docs/reports/642-phase2-20261107/diff-check.stdout) / [stderr](docs/reports/642-phase2-20261107/diff-check.stderr) / [argv+rc](docs/reports/642-phase2-20261107/diff-check.command.json) |
| `R2-evidence-diff-check` | 0；仅获准的 verbatim diff 归档豁免；stdout/stderr 均为空 | [stdout](docs/reports/642-phase2-20261107/R2-evidence-diff-check.stdout) / [stderr](docs/reports/642-phase2-20261107/R2-evidence-diff-check.stderr) / [argv+rc](docs/reports/642-phase2-20261107/R2-evidence-diff-check.command.json) |

治理完整性工具完整 stdout：

```text
vendored governance bytes match governance.lock.json and adoption is accepted
```

governing adoption lifecycle CLI 完整 stdout：

```text
Spec transition is a valid whole-authority lifecycle state
```

[manifest-parity.json](docs/reports/642-phase2-20261107/manifest-parity.json) 记录 exact upstream `c1fad8976e50e96adb27a4c7e2dd4f97bf2e899e` clean checkout、version=2.0.0-rc.3、全部 25 本地/来源文件 SHA-256 与 size 一致。manifest 原文已归档，SHA-256 `3ce456bec3af4ee6c9f725cf8d587ed1a3e70812574633fda9bddc06016a0841`。

## known-limits

**旧结构 CLI 尚不支持退役后 HEAD。** 旧 CLI 在工具准备提交上实际执行，base 为精确已审语义 HEAD。随后原子生命周期提交相对工具提交的 `scripts/ packages/ examples/` delta 为零，完整证据见 [preservation.json](docs/reports/642-phase2-20261107/preservation.json)。旧 CLI 的 `scripts/verify-code-structure.mjs:343–344` 强制 head 含 V2 ACCEPTED，行 84 禁止 accepted TE 在比较两端变更，故不能用于退役后的 HEAD；没有对该不支持的状态执行已知失败命令，也没有修改或弱化其断言。Owner 已定 verifier 适配是 main 合入后的独立任务，之后再进行 #603 重验。此处 rc0 只证明受测工具源码增量；不代表最终 HEAD 已通过 V3 结构 verifier。

C gate 适用性：原 `validate_v3_succession.py` 源码和全部控制原样保留，重跑绑定精确 proposal HEAD `7f36750b…`，其 Phase2 fixture 仍明确是模拟。新增 `validate_v3_phase2.py` 对实际 lifecycle tree 重新检查 native V2、raw TE/V3、两个 carried block、元数据、回链、接受坐标、lock 和索引；该结果才是本次真实退役事务的校验。

governing-only CLI 适用性：五份 adoption 原始 frontmatter 全量导出；base 与 candidate metadata 完全相同，显式更新接受记录追加在正文。该 CLI 不支持 native V2；没有伪造 governing_spec 身份、归一化字段或把 adoption CLI 结果冒充结构原生全链结果。原始数组及导出来源均归档。

## 双向回链与索引坐标

以下 before 为精确已审 HEAD，after 为 Phase2 原子提交。完整 SHA-256、每条匹配行及 before/after commit 见 [coordinates.json](docs/reports/642-phase2-20261107/coordinates.json)。

| 文件 | before blob / 行 | after blob / 行 |
|---|---|---|
| [.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md](.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md) | `f3cea29603385bc5c8eda6d0b6f423f9ee58daef`；6 ACCEPTED；8 V1 历史前链 | `c8869a9902d32bae3233fefab19a7523dcb89d23`；6 SUPERSEDED；14 SUPERSEDED_BY→V3；8 V1 历史前链保持 |
| [docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md](docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md) | `1a7cd389b7972944f5b08cb583a8de3044b17b51`；3 accepted；17 null | `1e86dca11cc8131f16de0055ffd2449149f0c32c`；3 superseded；17 superseded_by→V3 |
| [.agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md](.agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md) | `db276b2afc5329e72e7fdc9a7a4c9d983cf39b8d`；3 proposed；14–16 supersedes 两前任 | `1a9914a39d63aacf41b93329c7548d423643850c`；3 accepted；21–23 supersedes 两前任（reciprocal backlinks）；7–10 接受坐标；440 §15 |
| [.agents/local/README.md](.agents/local/README.md) | `81b4ff5477abae63aede634434ebe1f177c85678`；104 RULE→V2 | `c2b6e9ea255e436c602f0e5ae04dd3108da91956`；95 当前 successor 记录；113 RULE→V3；117 runner 尚待适配 |
| [docs/specs/README.md](docs/specs/README.md) | `5f15bf6f445a3858d25bb9126cdb31345f1d2102`；98 rc.1 adoption 索引 | `88adfbc7789fe8680a163603919e90c365f163de`；98 本次显式 rc.3 update；106–112 结构继任索引 |
| [docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md](docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3.md) | `b73637ca3235dc181f65cd23005d5fb87585b2f1`；历史 body 与六 Contracts | `482fd3931da0bb7a9a2d233ac41c1daa0b9e8085`；202 §14；213 Owner 裁定；226–227 前后 lock SHA |
| [.agents/governance.lock.json](.agents/governance.lock.json) | `38618a4c08cc1a6c9fc8e8f44ca87b06b3229ae2`；10 proposed；13–14 null | `59a9da8bcd6a567a71ec3096b6066bf69c5b9d52`；10 accepted；13 mayf3；14 接受落盘时间 |

V2 仅改原生 fenced lifecycle/backlink；TE 仅改 raw status/backlink。V3 保留完整已审正文，marker 内新增当前生命周期注记与 §15 接受记录，明确历史 proposal 语句的时点。V3→V2/TE 的既有 supersedes 与 V2/TE→V3 新 backlink 构成双向整权继任；没有重定向 V1 历史边。

V2 完整携带规范 SHA-256：`34a8d8d8fe23c12f82a8ab302faca2d0df668084abd8ac8b110d3ab878cc65e7`；TE Contracts+acceptance SHA-256：`6a57bd485b76eabe0c3656fb85c6ce09968dcd12e09064036475545beb8e8b87`。本次原生门重新测量并验证不变。

## Adoption 闭合及边界

AD3 CTR-AD3-001 的 “later updates are explicit” 允许当前显式版本更新；其原 rc.1 Contract 与 2026-10-15 接受记录逐字节保留。新增 §14 只记录 Owner 对精确 rc.3 分发的本次接受，不追溯伪造历史接受、修改 stable Contract ID 或新增产品语义。

- preparation commit：`b8333ef43d3e3433d5276cb8af49be7c949a18c8`。
- prepared lock SHA-256：`2c79ab4da7245dc1875e98300af6d2fefd75245d1be06ad3d3e9d9f86b30ad6c`。
- accepted lock SHA-256：`0cb6acb6e7839ee2b6d0312653e6c5efc680512a36bf44a842db3aa79dc5a8b5`。
- validator SHA-256：`5be5fae2ab02b87d1fc138e5da21f91f973b512e2198bcf5149a4ae03331b53e`，与 manifest 一致，未改语义。
- verifier SHA-256：`1a4b8e3421ad6e3d07d0c11badbc103e9a7646a25015814241a3f29049515937`，与 manifest 一致。

初始未跟踪历史 `STOPPED-RC3-CHAIN.md` 与 `docs/reports/rc3-chain-20261107/C-native-result.json` 原样保留，不被改写成成功记录。R1 的证据打包失败按本次明确豁免续行；R2 记录只证明实际执行范围，不抹去先前失败，也不宣称第六条件已完成。

后续监管须对交付后的确切 PR HEAD 独立复核；仅在所有六条件齐备后由监管按既有授权合 main。之后另行 verifier 适配、#603 重验。当前分支 accepted 状态尚未激活 main，无产品实施、运行时、生产或业务验收声明。

## 归档原文 SHA-256

| Artifact | SHA-256 |
|---|---|
| [C-proposal.command.json](docs/reports/642-phase2-20261107/C-proposal.command.json) | `9be8bf81bdc1ce922ee67a91395efefed1ba50b8e42a49842520b799fc527849` |
| [C-proposal.stderr](docs/reports/642-phase2-20261107/C-proposal.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [C-proposal.stdout](docs/reports/642-phase2-20261107/C-proposal.stdout) | `c3818f43df038552f7d7d1dc117724d51075c8e299d3ad50719056de841272ab` |
| [R2-evidence-diff-check.command.json](docs/reports/642-phase2-20261107/R2-evidence-diff-check.command.json) | `576b68da84a39558d9495dc440d92143ba4c2b826889978084e69b348ab9580d` |
| [R2-evidence-diff-check.stderr](docs/reports/642-phase2-20261107/R2-evidence-diff-check.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [R2-evidence-diff-check.stdout](docs/reports/642-phase2-20261107/R2-evidence-diff-check.stdout) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [R2-resumption.json](docs/reports/642-phase2-20261107/R2-resumption.json) | `393ab68a0ea8bd8d362fd27b97a9b672308eddad7b52e608768e69d1b41b656d` |
| [adoption-base.json](docs/reports/642-phase2-20261107/adoption-base.json) | `096f01608c9e06a7b6e3b3cb839b57995d8366a4c1ccedf0632002b609934365` |
| [adoption-candidate.json](docs/reports/642-phase2-20261107/adoption-candidate.json) | `096f01608c9e06a7b6e3b3cb839b57995d8366a4c1ccedf0632002b609934365` |
| [adoption-export-provenance.json](docs/reports/642-phase2-20261107/adoption-export-provenance.json) | `a61bab46ced44a655a75689940060d2a46e8bc0e8096c7e5b46ac25c76f5ff6d` |
| [adoption-transition.command.json](docs/reports/642-phase2-20261107/adoption-transition.command.json) | `6404d857b9182bd7ba179b5df43aa38d9f9d44f2f370860fcf47ca71aa3fa29e` |
| [adoption-transition.stderr](docs/reports/642-phase2-20261107/adoption-transition.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [adoption-transition.stdout](docs/reports/642-phase2-20261107/adoption-transition.stdout) | `48389e14b5b157630071792865037946c006066af9299d52375bb2da7473df68` |
| [atomic-lifecycle.diff](docs/reports/642-phase2-20261107/atomic-lifecycle.diff) | `9c4699326c9c4d8e32bd5fe2fc61602ead994285118a89d3cff788341abf2af8` |
| [coordinates.json](docs/reports/642-phase2-20261107/coordinates.json) | `7b011ffcba7ba5a32a5a97dca3fa30a646950778ebe24c9e08119463faddd98f` |
| [diff-check.command.json](docs/reports/642-phase2-20261107/diff-check.command.json) | `83721c263f35fda1bf5ad0720315c63d8f952dc1bafd3d565a941dcc6ba498cf` |
| [diff-check.stderr](docs/reports/642-phase2-20261107/diff-check.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [diff-check.stdout](docs/reports/642-phase2-20261107/diff-check.stdout) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [distribution-manifest.json](docs/reports/642-phase2-20261107/distribution-manifest.json) | `3ce456bec3af4ee6c9f725cf8d587ed1a3e70812574633fda9bddc06016a0841` |
| [governance-accepted.command.json](docs/reports/642-phase2-20261107/governance-accepted.command.json) | `27511ad08b977ad6ece1ca7bc3226ff9b9b980a245f433089592a0ce02127b2c` |
| [governance-accepted.stderr](docs/reports/642-phase2-20261107/governance-accepted.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [governance-accepted.stdout](docs/reports/642-phase2-20261107/governance-accepted.stdout) | `c8671db6c5d33b2e2c051a17143acc9bb5736cf8788e72feed4728b5cb32f332` |
| [manifest-parity.json](docs/reports/642-phase2-20261107/manifest-parity.json) | `a98265708f288cc05cae73c8bfebe143773c55a5a8654a2c1b0411a2ef40a550` |
| [owner-comment-6701500077.json](docs/reports/642-phase2-20261107/owner-comment-6701500077.json) | `d6be97f08f155da4f664fe04fc79f32d5dfbe5e958e8adc6f40263a1ce12d187` |
| [phase2-native.command.json](docs/reports/642-phase2-20261107/phase2-native.command.json) | `6953f845e12bae2c6902f8d6d23e19ba92f39924404b2ef987e2aac65b65f318` |
| [phase2-native.stderr](docs/reports/642-phase2-20261107/phase2-native.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [phase2-native.stdout](docs/reports/642-phase2-20261107/phase2-native.stdout) | `ae0b95e857d3a772615ddd46c8dd5944a17e74c37537480df905af1549aeb252` |
| [preservation.json](docs/reports/642-phase2-20261107/preservation.json) | `f81dd05aa68709b9ff37329a9aa88f21ab460e0ccffe3a8f8d39f8d033bb8192` |
| [structure-tool-increment.command.json](docs/reports/642-phase2-20261107/structure-tool-increment.command.json) | `30145eb91534b219d81a98e1f9b8eaa0a132b63a7f33b4767881f12e08a8df89` |
| [structure-tool-increment.stderr](docs/reports/642-phase2-20261107/structure-tool-increment.stderr) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| [structure-tool-increment.stdout](docs/reports/642-phase2-20261107/structure-tool-increment.stdout) | `3d5c24748f1b996a3b1b65817adb159112d346f13ec8badf9306019a6cf64644` |
