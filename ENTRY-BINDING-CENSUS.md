# ENTRY-BINDING-CENSUS — §6.5 实际入口绑定只读普查

## 1. 真实执行入口定位

本报告为非权威 Observation，执行授权为 [BRIEF-ENTRY-BINDING.md](BRIEF-ENTRY-BINDING.md) 与用户本次指令。只读生产文件；生产写入=0、认证面调用=0、fleet-window/deploy/reader/selftest 程序执行=0。文档、Git 提交与传输不属于生产执行。没有登记 EFFECTIVE、任命、安装、激活或合并。

PREFLIGHT：`schema_version=2`，`AUTHORITY_ACTION=REUSE`，`PLAN_LEVEL=BRIEF`，`ASSURANCE_LEVEL=ROUTINE`（只读调查及可逆 docs），`ROUTE_STAGE=OPERATION`（调查），`AUTHORITY_ACCEPTED_IN_BASE=YES`（SRA/FWAV 父合同），`IMPLEMENTATION_ALLOWED=NOT_APPLICABLE`，`OPERATION_ALLOWED=YES`（仅本普查），`MERGE_READY=NOT_APPLICABLE`。GOAL=四节普查+单 docs commit+main PR，不合并；CURRENT_GAP=实际运行副本及 source→installed→loaded 绑定未证。DONE_WHEN=报告落盘及单提交，push 后建 PR，或 push 失败不重试、交 bundle；EXPANSION_TRIGGER=需要生产/认证调用、安装或修改权威时停止依赖动作。只在本隔离工作面写文档，生产控制仍无许可。

交付工作面：原工作树 `git add` rc128，沙箱拒绝创建共享仓外的 `.git/worktrees/ops-entry-binding/index.lock`（Operation not permitted），未修改该 index/ref/权限。改在允许写入的 `/private/tmp/entry-binding-census-delivery-20261109` 建立独立 shared clone，固定同一 B、同一分支名，仅复制本报告和原简报用于单提交/传输；objects 只读复用，不修改其他 checkout 或生产 writer。

权威按本仓入口读取：`.agents/README.md`、`.agents/local/README.md`、`docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`、`docs/decisions/README.md` 的 D-008/D-009 当前索引、accepted `AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1`（SRA-C-006，第5步，L280）、`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`（CTR-004..009）、accepted `AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1`（CTR-011..013，L298–329），以及 spec-governance PREFLIGHT 模式。以上路径均绑定下述 B；本报告不改合同。

### 1.1 基线与观察方法

| 坐标 | 本轮实测值 / 限制 |
|---|---|
| 工作树 / 分支 / 调查 parent B | `/Users/yanfenma/workspace/project/worktrees/ops-entry-binding` / `ops/entry-binding-census` / `417cc8ee6e7ef9a5e840e900a11c30fe58d648da`，#686 merge；本地 `origin/main` 同 B |
| 本地 `main` | `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`，旧 #273，五文件均不存在；不能当本轮 main 比较基线 |
| 本地 `github/main` | `6daf5922a0817115b1a21a459d9643b6fbb6d2b6`，旧 #569；也不是 #687 |
| 可读实施对象 I | `6d7db5d29bbd756e085cda137ee359133524b6bc`，parent=B；ref=`refs/remotes/origin/ops/d1d2-validator-impl`；提交题为 `feat(fleet-window): wire six-refusal authority validation per accepted V1` |
| 简报所述“#687 已合 main” | 本轮远端状态 **UNKNOWN**。`gh api repos/mayf3/dsh-agent-core/commits/main --jq '{sha:.sha,message:.commit.message}'` rc=1：`proxyconnect tcp: dial tcp 127.0.0.1:7890: connect: operation not permitted`。本地未找到 #687 merge object；不把实施分支当已合 main |

逐字节比较分别对 B 和 I 的 `git show <SHA>:scripts/fleet-window/<filename>` 导出内容执行 `cmp -s`；I 是可复核的实施比较坐标，**不是本轮已核实的当前远端 main**。与真正当前 main 的关系仍 UNKNOWN；若 #687 合并字节恰等于 I，才可沿用 I 列，不预设该条件成立。

搜索根为 `/usr/local/libexec`、`/Library/LaunchDaemons`、`/Users/yanfenma/Library/LaunchAgents`、`/Users/yanfenma/workspace`。使用 `rg --files --hidden --no-ignore` 和 `find` 按五个精确文件名查找；不下钻 `.git` 和 `node_modules`，不跟随目录 symlink，不读取 Secret 内容。`find` 命中 **105 个普通文件**，分布于 **20 个 checkout + 1 处嵌套证据快照**；全部在 workspace。指定 libexec/launchd 根的已遍历可读范围内五个精确文件名命中=0，**不推导全主机无安装副本或无改名入口**。权限拒绝/未遍历范围保持 UNKNOWN。

逐文件 `stat → shasum -a 256 → cmp(B) → cmp(I) → stat`；105 次读前/读后 owner、mode、size、inode、mtime、type 均一致，类型均 Regular File。这是观察区间稳定性，未加锁，不证明后续不变。下表每行含观察 UTC 与北京时间（UTC+08:00）；观察区间为 `2026-11-09T11:01:50Z–11:01:52Z / 北京19:01:50–19:01:52`。

### 1.2 Git 对象五文件基准（SHA256 为实际字节，不是 Git blob ID）

| 文件 | B size / SHA256 | I size / SHA256 |
|---|---|---|
| window-executor-v5.sh | 18040 / `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 18344 / `d274b7e505e720079b50a263f4e4fa10722490ef141026dfb46b753df8910e3e` |
| window_helper_core.py | 24184 / `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 27376 / `1ed169d1fa3934f1f058ceded31c302d258c94665f2b59cd52fcdb0df97eca33` |
| window_helper.py | 28897 / `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 33721 / `3968c88d859656180e078db2046487ff2beeb868de4290e24ca2bfafaae350fd` |
| window_preimage_xattr.py | 5763 / `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 5851 / `4341f0e4158dfd5ebb8fbb170beb2cf9a7098a120d5b63491a119b3cbfada05d` |
| window-selftest.py | 28737 / `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 29291 / `acaff144cd19183c3a6fae324fedb4db71546c2c67e2ac7dd170660ce54aeb41` |

### 1.3 副本路径与逐文件实测

完整绝对路径定义为：`Rxx 对应根路径 + /scripts/fleet-window/ + 文件名`。R13 为 R12 内的证据快照，不是独立 checkout，其 branch/HEAD 仅是所属仓坐标；其余根由 `git -C <root> branch --show-current / rev-parse HEAD` 读取，未改 checkout。分支标签不代表正在运行或已安装。

| ID | 根路径 | branch | HEAD（仅坐标，不代表目录无 diff） |
|---|---|---|---|
| R01 | `/Users/yanfenma/workspace/project/.worktrees/r129-fence-contract` | `fix/r129-fence-contract-verify` | `95a8e1cb512fc99dc018209d837250dd51b4d08f` |
| R02 | `/Users/yanfenma/workspace/project/production-dsh-agent-core` | `fix/r128-gh-credential-basline-fix` | `e30029e9df19f55ac797d852f70c334ae215111f` |
| R03 | `/Users/yanfenma/workspace/project/worktrees/h-gov-align` | `docs/gov-record-alignment-20261108` | `37fc07810456ce1ca0104b3e7fea3817414a0ad2` |
| R04 | `/Users/yanfenma/workspace/project/worktrees/h1351-binding-update` | `docs/1351-gates-spec` | `527d641518bdde61267cde56000bfb8299780667` |
| R05 | `/Users/yanfenma/workspace/project/worktrees/h1351-gates` | `docs/1351-p1p2-binding` | `6d88289c8eaa0405e16c375a0ab0ad5a64dcc2bf` |
| R06 | `/Users/yanfenma/workspace/project/worktrees/h1370-generation-tests` | `test/1370-generation-policy` | `0ca245f72cb7c954dafcbfcafd965dabeefe880b` |
| R07 | `/Users/yanfenma/workspace/project/worktrees/h1370-impl` | `fix/1370-generation-policy-impl` | `f82e244fa9d624064a46626e97e65b7847a3461e` |
| R08 | `/Users/yanfenma/workspace/project/worktrees/h1370-policy` | `docs/routing-generation-policy` | `95d3cf3fac78f5a0f57cd1229b1368d5956937ad` |
| R09 | `/Users/yanfenma/workspace/project/worktrees/h1370-route` | `docs/1370-semantic-verify` | `37bcf36d23ac349ded70bc24c6b6e07f59c7de12` |
| R10 | `/Users/yanfenma/workspace/project/worktrees/h1370-verification/dsh-agent-core` | `DETACHED` | `3be316599df8b5025329414fcb75ad157a4b24db` |
| R11 | `/Users/yanfenma/workspace/project/worktrees/h547-release-prep` | `release/547-d-minimal-prep` | `35b2a93e42373220aad2730f57c5baae8ccb9704` |
| R12 | `/Users/yanfenma/workspace/project/worktrees/h547-store-diag` | `diag/547-durable-store` | `a3fa960378988fa1dbfac80c7719b88bc0a0ecd4` |
| R13 | `/Users/yanfenma/workspace/project/worktrees/h547-store-diag/docs/evidence/h547-store-diag/private/v5/reader` | `diag/547-durable-store` | `a3fa960378988fa1dbfac80c7719b88bc0a0ecd4` |
| R14 | `/Users/yanfenma/workspace/project/worktrees/ops-656-landing` | `fix/656367cd-landing-prep` | `046342c227c4e3cb9bb437f02f9d20d0c953caf3` |
| R15 | `/Users/yanfenma/workspace/project/worktrees/ops-entry-binding` | `ops/entry-binding-census` | `417cc8ee6e7ef9a5e840e900a11c30fe58d648da` |
| R16 | `/Users/yanfenma/workspace/project/worktrees/ops-issue-triage` | `ops/issue-triage-20261109` | `1e04a8a938d40bf639816c76fdeff972810298b8` |
| R17 | `/Users/yanfenma/workspace/project/worktrees/ops-release-conv` | `ops/release-convergence` | `9e5e18efa918df79d84a7c9d739112091fce9e0d` |
| R18 | `/Users/yanfenma/workspace/project/worktrees/ops-sra-control-census` | `ops/sra-control-census` | `5f387cf129148091f5ea828402a962eae3abec3b` |
| R19 | `/Users/yanfenma/workspace/project/worktrees/recon-biz-20261108` | `recon/business-recovery-20261108` | `89654d15c8a79dfdba5bfb8e63c40002b8676d8d` |
| R20 | `/Users/yanfenma/workspace/project/worktrees/recon-m7-writer` | `recon/m7-root-writer` | `d806cb6baf497bb3ded75d2fc2e954c62ab305e3` |
| R21 | `/Users/yanfenma/workspace/project/worktrees/recon-pertarget` | `recon/pertarget-successors` | `489913462e449af33b66fb46c110a99cbedf65c4` |

下表 `B cmp =` 表示逐字节相同、`I cmp ≠` 表示逐字节不同；105 行均为该结果。owner 为 user:group，mode 为完整权限文本，size 单位 byte。SHA256 与逐字节结果均逐副本实测，未从 branch 名推断。

| 根ID | 文件 | owner | mode | size | SHA256 | UTC | 北京（+08:00） | B cmp | I cmp |
|---|---|---|---|---:|---|---|---|---|---|
| R01 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R01 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R01 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R01 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R01 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R02 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R02 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R02 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R02 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:50Z | 2026-11-09T19:01:50+08:00 | = | ≠ |
| R02 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R03 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R03 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R03 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R03 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R03 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R04 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R04 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R04 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R04 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R04 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R05 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R05 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R05 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R05 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R05 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R06 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R06 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R06 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R06 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R06 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R07 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R07 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R07 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R07 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R07 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R08 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R08 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R08 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R08 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R08 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R09 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R09 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R09 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R09 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R09 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R10 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R10 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R10 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R10 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R10 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R11 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R11 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R11 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R11 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R11 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R13 | window-executor-v5.sh | yanfenma:staff | -rwx------ | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R13 | window-selftest.py | yanfenma:staff | -rw------- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R13 | window_helper.py | yanfenma:staff | -rw------- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R13 | window_helper_core.py | yanfenma:staff | -rw------- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R13 | window_preimage_xattr.py | yanfenma:staff | -rw------- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R12 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R12 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:51Z | 2026-11-09T19:01:51+08:00 | = | ≠ |
| R12 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R12 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R12 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R14 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R14 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R14 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R14 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R14 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R15 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R15 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R15 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R15 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R15 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R16 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R16 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R16 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R16 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R16 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R17 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R17 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R17 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R17 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R17 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R18 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R18 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R18 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R18 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R18 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R19 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R19 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R19 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R19 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R19 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R20 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R20 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R20 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R20 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R20 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R21 | window-executor-v5.sh | yanfenma:staff | -rwxr-xr-x | 18040 | `e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R21 | window-selftest.py | yanfenma:staff | -rw-r--r-- | 28737 | `6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R21 | window_helper.py | yanfenma:staff | -rw-r--r-- | 28897 | `956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R21 | window_helper_core.py | yanfenma:staff | -rw-r--r-- | 24184 | `655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |
| R21 | window_preimage_xattr.py | yanfenma:staff | -rw-r--r-- | 5763 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | 2026-11-09T11:01:52Z | 2026-11-09T19:01:52+08:00 | = | ≠ |

### 1.4 未覆盖目录（UNKNOWN，不是零命中证明）

文件搜索的 13 条权限拒绝如下；没有 sudo、改权限或换身份重读：

```text
/usr/local/libexec/agent-core.bak-20261106-075814/config
/usr/local/libexec/agent-core.bak-20261105-063639/config
/usr/local/libexec/agent-core.bak-20261106-080439/config
/usr/local/libexec/agent-core.bak-20261105-064520/config
/usr/local/libexec/agent-deploy-system/.observation-5715d21-maintenance
/usr/local/libexec/agent-core.bak-20261105-073646/config
/usr/local/libexec/agent-core.bak-20261105-075119/config
/usr/local/libexec/agent-core/config
/usr/local/libexec/agent-core/.cache
/usr/local/libexec/agent-core.bak-20261106-081212/config
/usr/local/libexec/agent-core.bak-20261105-062306/config
/Users/yanfenma/workspace/artifacts/ac549-eacces-repro/locked
/Users/yanfenma/workspace/project/dsh-agent-core/"/Users/yanfenma/.recovery-backups/workflow-recovery-20260821T145031Z"
```

## 2. 调用链

### 2.1 launchd 实际观察与原文

对两处指定 launchd 目录内 `*.plist` 搜索五文件名/对应脚本名称，命中=0；五个不可读文件为 `com.openclaw.host-exec-runner.plist`、`com.openclaw.workflow-dispatcher.plist`、`com.openclaw.gateway.plist`、`com.openclaw.forum-scheduler.plist`（均在 `/Library/LaunchDaemons`），及 `/Users/yanfenma/Library/LaunchAgents/ai.openclaw.gateway.plist`，其调用关系 UNKNOWN。只观察持久 plist，不枚举所有已加载 job，未覆盖改名/动态调用链。

可读 deploy 三项原文如下（每个代码块对应完整文件；无改写）。`2026-11-09T11:02:16Z / 北京19:02:16+08:00` 复核均 root:wheel / `-rw-r--r--`，size 分别 592/580/546，SHA256 分别 `9861fe868f97fffaf0323746a9f150bc7829656a1a76df8974a768bf745e1339`、`e6c619a74e9a06186ef5470dba82bdb91edf697df2853f92f3db6904169640d7`、`c09e24824db86db2267da236594b94d1d36399171e9d6b25e78a928c66af095b`。

`/Library/LaunchDaemons/ai.agent-deploy-system.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>ai.agent-deploy-system</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/usr/local/libexec/agent-deploy-system/deployment_system.py</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardErrorPath</key><string>/private/var/db/agent-deploy-system/daemon.log</string>
</dict>
</plist>
```

`/Library/LaunchDaemons/ai.agent-deploy-shim.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>ai.agent-deploy-shim</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/usr/local/libexec/agent-deploy-shim/deploy_shim.py</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardErrorPath</key><string>/private/var/db/agent-deploy-shim/daemon.log</string>
</dict>
</plist>
```

`/Library/LaunchDaemons/ai.agent-deployd.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>ai.agent-deployd</string>
<key>ProgramArguments</key><array><string>/usr/local/libexec/agent-deployd/agent-deployd</string></array>
<key>UserName</key><string>root</string><key>GroupName</key><string>wheel</string>
<key>Disabled</key><true/><key>RunAtLoad</key><false/><key>KeepAlive</key><false/>
<key>Umask</key><integer>63</integer>
</dict></plist>
```

本轮 `launchctl print system/ai.agent-deploy-system` 读到 `state=running / pid=380 / program=/usr/bin/python3`，arguments 指向上述 deployment_system.py；shim 对应 `running / pid=381` 与 deploy_shim.py；`launchctl print system/ai.agent-deployd` rc=113，`Could not find service "ai.agent-deployd" in domain for system`。这些不是五文件被 loaded 的证明。直接 `rg` 两个已安装 .py 的五脚本名命中=0，仅排除这些文本中的直接名称引用。`ps -axo pid,ppid,uid,lstart,command` 被沙箱拒绝：`operation not permitted: ps`，因此未获得进程调用方/子进程观察，**不声称 fleet-window 未运行**。未重启、未连接 daemon/socket、未执行任何部署动作。

### 2.2 仓内静态互调坐标

以下文件均在 `scripts/fleet-window/`，行号以 **I** 为准，`git show I:<path> | nl -ba` 可复查；静态调用不表示已安装/准入/执行。

| 环节 | 坐标与观察 |
|---|---|
| wrapper → helper | `window-executor-v5.sh:112–118` 调同目录 `/usr/bin/python3 -B window_helper.py`；root 分支附 sudo（本轮不调用） |
| 初始 authority | runner `167–170` → helper `5–11` → core `validate_authority:106–114` |
| 每阶段检查 | runner `321` → helper mutex-check `26–27` → core `authority:116–121` |
| fresh / 效果前 guard | core `4–5,90,94–104` 构造默认 reader；`effect_guard:145–163` 核 mutex → fresh observation → mutex；`internal=True` 在 `159` 拒绝未资格内部写 |
| bootout / bootstrap | runner `203–205,268–270` → helper `45–62`，guard 在 `51,60` |
| installer / settlement | runner `221,237` → helper `63–68`；内部逐写控制 UNKNOWN，`internal=True` 在 dispatch 前拒绝；未证明 child 能执行 |
| preimage/xattr | helper `2` import；`window_preimage_xattr.py:6` 引入 effect_guard，`108–109` 在 xattr 写前检查 |
| close/release | helper `429–449`；close `431`，release/holder unlink/rmdir 的 guard 分别在 `445,446,448` |
| selftest | runner `295–298` → 同目录 `window-selftest.py`；其 `56–71` AST 提取 core 函数；本轮不执行 |
| 失败通道 | core `require:15–16` RuntimeError；runner `stop_on_error:155–164`、traps `307–309` → FAIL/STOP，未另造重试 |

### 2.3 副本六类接线核对

对 §1 的 **全部105份副本** 搜索 `validate_fwav|RegistryReader|authority_observation|effect_guard|validate_legacy_fields|未任命|越界|过期|撤销|候选漂移|缺门`，匹配行数=0（`rg` 无匹配）。结合每份 `cmp B = / cmp I ≠`，可判断这些已发现副本 **均不含 I 的六类 FWAV 新接线**。其中哪些实际运行仍 UNKNOWN，不能把任何工作副本称为实际 runtime。

I 中六类对应静态坐标如下；只有名字命中不构成六类运行资格 PASS：

| 类别 | I 的 consumer / 拒绝坐标 |
|---|---|
| 未任命 | `authority_validation/checks.py:43–78,95–114`；`policy.py:77–109`（身份、角色独立性） |
| 越界 | `authority_validation/policy.py:12–20,33–50,63–74` |
| 过期 | `authority_validation/checks.py:8–17,92–94`（window/appointment UTC交集） |
| 撤销 | `authority_validation/checks.py:29–42,79–89`（query完整性、lease、epoch/revision/lifecycle） |
| 候选漂移 | `authority_validation/checks.py:46–47,115–116` |
| 缺门 | `authority_validation/policy.py:23–60`；core `159`（内部逐写资格 UNKNOWN 拒绝） |

B 旧 core `validate_authority:25–38` 只有必填字段、writer UID、旧SHA、scopes/window UTC；`authority:88–91` 仅重读 receipt 中 authority/window UTC。旧 UTC/hash 检查不能被重新命名为 I 的全套 FWAV 接线。

### 2.4 deploy runbook 引用

I 的 `scripts/fleet-window/README.md:3–4,20–23` 要求 Git SHA 钉定，链接外部 SOP。实际读取外部 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/SOP-DEPLOY-MASTER.md`：L9 fleet→入口C；L27–34 官方 `trusted-cp-deploy-install.sh` 为核心、v5 为 pre/post 包装；L72–76 引用历史窗口 bundle 与 readiness；L78–80 要求 Git-pinned `scripts/fleet-window/`，禁用 /tmp/会话副本。这里仅记录 runbook 内容，**没有执行其命令或把文本当 loaded-binding**。

SOP L30 的150s有 L73 后续补丁180s；L49 的 deployd DOWN 是历史文本，不作当前状态证据（当前观察见 §2.1）。该 SOP 没有绑定当次 wrapper 的绝对路径/hash；历史 installer bundle 也不是当前五文件的安装证明。不对冲突历史配方进行择一执行或修订。

## 3. fresh 撤销 reader 的运行时数据源

实施对象 **I** 的 `scripts/fleet-window/authority_validation/reader.py:13` 固定数据源：

```text
/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
```

`reader.py:68–79` 的 `read_registry()` 读取这个原文件，拒绝 symlink，读前/后比对 inode/mtime_ns/size，再严格解析 JSON；`:55–65` 只允许稳定 id/round selector 且匹配恰1。core `4–5,90,94–104,116–120` 固定构造/调用这个 reader；命令行/环境未提供合格 reader 注入路径。`checks.py:43,56,60,75` 要求 observation、issuer、appointment、原 grantor 的 source 同为此路径；`:29–42,79–94` 预期检查完整查询、≤300s lease、epoch/revision/clock 防回退及 ACTIVE 生命周期。没有为普查运行这些函数。

| 当前文件观察 | 结果及证明边界 |
|---|---|
| 可读性/时间 | **YES**；独立只读核查 `2026-11-09T11:00:41Z / 北京19:00:41+08:00`，随后 stat/hash 复核同值 |
| owner / mode / size / inode | `yanfenma:staff`（UID502/GID20） / `0644 (-rw-r--r--)` / `528649` bytes / `269325782` |
| SHA256 | `d67643cc1b792e83430d58cb61da5f8f8b1dc022906a464d5e6692d9271f0e53`；这是该时点整个文件字节 hash，不代替任命/撤销资格 |
| 是否与现行治理账同源 | **YES（路径/来源）**。B accepted FWAV frontmatter L12 的 `acceptance_authority_source` 与 I 默认路径逐字一致；本轮读到该现行文件的 rulings/history。此判断不赋予文件新权威或 freshness 资格 |
| 任命数据 | 当前文件 L7064–7067 的 `.history[round=captain-registration-20261109]` 明记 `NOMINATED_APPOINTMENT_PENDING_VERIFICATION / 签发权NONE`；任命 ID 仅在描述文字出现。不能将 history 描述或本地可读账当成已生效机器任命 |
| 原任命登记坐标 | B:`CAPTAIN-APPOINTMENT-REGISTRATION-20261109.md:3,10,13,15–16,31–39`：session未绑定、validFrom待EFFECTIVE收据、validUntil=`2026-12-07T16:00:00Z`，生效前签发权NONE；本轮不改登记 |
| 实际运行副本的数据源 | **UNKNOWN**；当前运行入口/调用者未定位，不能仅由 I 的源码路径推断实际进程读了它 |

**默认 reader 不具备成功验证路径。** `reader.py:85–90` 在原账读取失败时抛 `撤销: original registry read unavailable`；即使成功读完仍必定抛 `未任命: trusted caller/current lifecycle/anti-rollback reader UNKNOWN`。这是 fail-closed 的源码事实，不是本轮运行测试。因此“文件当前可读/同源”是 YES，“I 默认 reader 可完成可信 fresh observation”是 **NO**；实际 caller/current lifecycle/防回退资格、installed/loaded reader 绑定仍 **UNKNOWN**。不能通过自写 JSON、历史 ACTIVE 或文件 hash 把该 UNKNOWN 填成 PASS。

## 4. 绑定结论

- **实际入口副本=UNKNOWN**：已发现的20个checkout及1处快照均为旧B字节；launchd的DS/shim观察未建立五文件调用关系，ps不可用且有不可读范围，不能指定某个副本为实际入口。
- **实际入口已在六类校验接线路径上=UNKNOWN**；已发现105个文件的“I版FWAV新接线”均为 **NO**；可读实施对象I有静态接线，但其当前main合并、安装、加载、准入及实际写边界资格未证。
- §6.5仍差：核实#687的实际main对象与当前入口/caller/control owner，绑定source→installed→loaded→已准入profile/实际写边界的版本/hash，覆盖旧可执行路径不可旁路。
- §6.5仍差：可信caller/完整任命生命周期及fresh防回退reader；对精确实际入口补六类负向资格、真实调用边界与非作者独立verifier回执；不重用无关tuple的PASS。
- §6.5仍差：session/身份延续、任命/UTC/撤销及现行体系承认齐备后，由原合法链登记EFFECTIVE；本普查未执行这些动作，W7和任何Mandate均未签发。
