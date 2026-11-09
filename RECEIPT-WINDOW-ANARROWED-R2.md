# RECEIPT-WINDOW-ANARROWED-R2

记录时间：2026-11-05T23:05:53.160819+00:00。本收据只证明 source / isolated mechanism / stdio canary；零生产阶段执行，零生产写入，窗口 GO=false，业务结果 UNKNOWN。

## 坐标与授权

- Worktree：`/private/tmp/anarrowed-wt`；branch：`chore/fleet-window-anarrowed`。
- R1 parent / integration base：`e61458e0666bc6aa962d31561beeff1ada4a4f56`。
- 代码提交：`c063f5569bcfd8c51240281a04cc3f42e8ed68c9`。
- 结构门 exact snapshot：`9a89ca7561d8224737e3db7e2aa3e3cba825632a`；tree `5f7ffcac57c74887746fc4571a582dc827c76be0`，与代码提交 tree 完全相同。结构门只创建隔离 index/object，未移动 branch。
- 交办：`BRIEF-WINDOW-ANARROWED-R2.md`；继承 R1 `BRIEF-WINDOW-ANARROWED.md` / `STOPPED-WINDOW-ANARROWED.md`。
- Route：schema_version=2，REUSE / BRIEF / DURABLE / IMPLEMENTATION；accepted authority in base=YES，OPERATION_ALLOWED=NO，无合并授权。
- 权威：D-009 §8.4–8.5/§10.2，Timeout V3 C-033/C-038，ADR D009 alignment CTR-527D2-002/003，Lifecycle V4 C-016/C-019；未改动 Product Authority 或 packages 产品代码。

## R1 → R2 oracle diff 理由表

| 对象 | R1 oracle | R2 oracle | 理由/边界 |
|---|---|---|---|
| recovery candidate副本 | 整文件 SHA 必须相等 | 父、子共用 `candidate-oracle.mjs:19`；记录集合/顺序/所有未分类字段严格相等 | 启动诊断不等于业务覆盖；initialOutcome、fenceState、recoveryState、exitObservedAt 等业务字段绝不放宽 |
| attemptedActions | 整数组相等 | 完整旧项前缀严格相等；新增项精确四字段 action/result/reasonCode/observedAtWallMs | 唯一允许组合 ownership_check / blocked / runtime_restart_ownership_unavailable；未知 action/result/reason/key 均 FAIL |
| updatedAt/failureReason | 不得变化 | 时间不得倒退且需真实追加；failureReason 只允许原值或与新增白名单诊断匹配 | 不允许任意 reason 或仅改时间 |
| top-level runtimeEpoch(s) | 不得变化 | 允许新 epoch 切换；历史 epochs 必须完整保留并符合实际构造次序 | records[].runtimeEpoch 等身份字段保持原值 |
| bytes 前缀/容量计数 | 整文件字节相等 | 所有业务内容/UTF-8叶值与既有 action 前缀严格保留；数值 bytes 仅在已知诊断追加后按可信容量函数精确重算 | durable records[].bytes 是数值 owned-state 计数，不是 payload 字节串；禁止任意增减/忽略计数。R1 fixture 原值3436、reader 解码计量3472、诊断后3626已只读核实；不是生产数据验收 |
| 源fixture/admission/jobs | 字节不变 | 原样保留；源fixture还校验 metadata | 这些文件连诊断追加也不允许 |
| rollback reader | 字节不变 | 原样保留，无启动诊断豁免 | 实际旧v2 reader拒绝v3，禁止旧业务快照覆盖 |
| R1 suites | 已PASS但主门中断 | settlement/bootstrap/candidate-state三个测试文件原样保留并执行；新增独立65反例oracle suite | 不回退 R1 六项修订；补跑首个正例之后的启动失败与旧v2 reader |
| selftest失败记录 | 会覆盖既有STOPPED-C7 | 仅在不存在时写该旧入口停点；本轮runner任何失败写R2停点 | 执行本次“不动既有收据”的红线，旧记录哈希未变 |

## R1 六条修订保留映射

| 裁定 | 代码坐标 | 本轮证据 |
|---|---|---|
| quiet纯观察 | window_helper.py:121；window-executor-v5.sh:186 | stage_04 / isolation纯函数与dry-run PASS |
| 物理退出与历史/unsafe分类 | window_helper.py:143；window_helper_core.py:289 | 活worker、running occurrence、跨epoch/遗漏等负向门 PASS |
| 精确settlement/保留unproven | settle_unresolved_runtime_down.mjs:70、174 | 原 settlement suite rc0，双写者/部分失败等原负向保留 |
| 真实候选加载、按Agent fence | anarrowed/candidate-state.mjs:77、candidate-child.mjs:61 | 真实完整候选隔离启动，16 checks全true |
| 预镜像前置 | window-executor-v5.sh:185、222；window_helper.py:159、183 | dry-run含03b/06a/05b，bootout前copy、停后recheck |
| 负向/启动/回退schema边界 | window-selftest.py:296；anarrowed/*.test.mjs | 原负向suite+启动失败+旧v2 reader+65 oracle反例全部PASS |

## 执行结果与独立审阅

- 所有指定门 rc0；结构结果为 `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`：候选违规0，既有债务29，不能描述为全库无债务PASS。
- candidate 16项check全true；子进程code=0、signal=null、closeObserved=true、timedOut=false；sourceUnchanged/noOverwrite/noReplay/noOutbound/cleanShutdown均true。
- processSpawnAttempts=outboundAttempts=businessDispatchAttempts=0；父、子各允许1条白名单追加，完整保留2条旧action。
- oracle反例数=65；另校验严格rollback及admission/jobs字节相等。
- 原测试内missing-candidate启动失败为预期拒绝；真实旧Scheduler `a39c7cc18e1487b0e0d358db4ddc1f1acbb1f294` 用例实际拒绝 unsupported store version 3，currentBusinessPreserved=true。
- canary命令rc0，真实官方stdio/fresh HOME；该canary自身fullRuntime=NOT_RUN。候选fullRuntime为另一隔离探针，不能推成生产启动/模型/业务成功。
- 独立审阅者 `/root/r2_review`（未写代码）执行受影响合同DELTA审阅：BLOCKERS=0，SPEC_GAPS=0；独立重算全部gates stdout/stderr、6份selftest命令输出哈希、13个代码绑定及结构snapshot内容，全部相等；证据足以交付本次离线工具修订。
- 最终收据/brief新增为文档delta；最终HEAD独立比对及外部交付记录写于 `/usr/local/v5-boot-isolation/anarrowed-r2-42tttior/delivery.json`。发布/合并/生产/业务均不由本收据授权。

## 可检索证据

- R2 gate ledger / R1 preimage：`/usr/local/v5-boot-isolation/anarrowed-r2-42tttior`。
- Selftest：`/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h`；summary与每条命令原始stdout/stderr均保留。
- 全部旧生产收据未打开写入；R1现有stop/brief与三个测试文件的保存结果如下。

```json
{
  "scripts/fleet-window/settle_unresolved_runtime_down.test.mjs": true,
  "scripts/fleet-window/anarrowed/candidate-state.test.mjs": true,
  "scripts/fleet-window/anarrowed/rollback.test.mjs": true,
  "BRIEF-WINDOW-ANARROWED.md": true,
  "STOPPED-WINDOW-ANARROWED.md": true,
  "STOPPED-C7.md": true
}
```

### 代码 SHA-256

```json
{
  "scripts/fleet-window/README.md": "7d846d9189a57d689db1b30a63e4cf86e86c088faea8a978bb3ef4b342380960",
  "scripts/fleet-window/anarrowed/candidate-child.mjs": "2bca656718ea1fd55c2f0c097552376eac154b0e169e34774719efa8328c2e2e",
  "scripts/fleet-window/anarrowed/candidate-oracle.mjs": "ebcb57389a2714f6aef4b954478b297da85d80c8d7f723d0283e736beca4664b",
  "scripts/fleet-window/anarrowed/candidate-oracle.test.mjs": "143aa93c89c295f2737ac013c6b5512c3dbe24cca3a565877de0d2a433ef7462",
  "scripts/fleet-window/anarrowed/candidate-state.mjs": "93848dc5092fe048bd812d6b651b6518767e0c5cc10bd2ce008ca6bae0801338",
  "scripts/fleet-window/anarrowed/candidate-state.test.mjs": "5b9db47fc4ec4acb54e48055cad9873c082de3b08c0f0e3195aa34cfbc201064",
  "scripts/fleet-window/anarrowed/rollback.test.mjs": "ceff8e79158a99d96b98f4ffffea60d8f62165f88b232c67c20f60fdf3a2453d",
  "scripts/fleet-window/settle_unresolved_runtime_down.mjs": "c7af16e11a2adb3323abade6fb831705fab00d023fdb23ce4f5f04bf69817185",
  "scripts/fleet-window/settle_unresolved_runtime_down.test.mjs": "236d68c9eab0e3d3f99c39bf418cd165802d614dd8d002bdf9f6bc749b33e406",
  "scripts/fleet-window/window-executor-v5.sh": "e59a3ac8e5fcf3afd6a7dee47b6ad53c2c20f0a80240f22a31d2be3c5c2cdf8f",
  "scripts/fleet-window/window-selftest.py": "6adedc6344bd1d3b21ba561a1af14aa942e5878b87547069ca9f8173c5ddd974",
  "scripts/fleet-window/window_helper.py": "956b7559287068a1516a21c665de411f3992b6b6cbb8d8011458441c14619047",
  "scripts/fleet-window/window_helper_core.py": "655ef82e19e294c6519b285b6ec13b7679cbd8dd3c3b5f82e594612b8e1e73ac"
}
```

### 原始 canary 结果

```json
{
  "result": {
    "canary": "FRESH_CHILD_BOOT_CANARY_V1",
    "trustedRoot": "/usr/local/v5-boot-isolation/assembled-root",
    "profile": "agent-core-production",
    "home": "/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/canary-home",
    "ok": true,
    "ready": true,
    "pluginTreeFailed": false,
    "missingPackages": [],
    "disallowedMissing": [],
    "tail": [
      "[demo-server] ready pid=60278",
      "[agent-memory] mounted for agent app (workspace /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/canary-home/.dsh/workspaces/app, memory /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/canary-home/.dsh/workspaces/app/MEMORY.md)",
      "[broker] forum moderator pack: 0 tools (DSH_AGENT_ID is absent)",
      "[broker] scheduler mutation operations withheld: no credential provider configured in this runtime (fail-before-exposure)",
      "[broker] authoring file entry: not registered (DSH_PRIMARY_WORKSPACE absent or not an existing absolute directory)"
    ]
  },
  "exit": {
    "code": 0,
    "signal": null,
    "utc": "2026-11-05T23:03:03.022Z"
  },
  "close": {
    "code": 0,
    "signal": null,
    "utc": "2026-11-05T23:03:03.022Z"
  },
  "teardown": {
    "directChildExitObserved": true,
    "directChildCloseObserved": true,
    "remainingObservedOrGroup": [],
    "exitVerification": "OBSERVED",
    "observedIdentities": [
      {
        "pid": 60278,
        "ppid": 60277,
        "pgid": 60278,
        "start": "Fri Nov 6 07:03:01 2026",
        "comm": "(node)"
      }
    ],
    "limitation": "Unsampled descendants that escaped the group remain UNKNOWN."
  },
  "events": [
    {
      "signal": "SIGKILL",
      "returned": false,
      "pid": 60278
    }
  ],
  "samples": [
    {
      "utc": "2026-11-05T23:03:01.501Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:01.654Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:01.801Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:01.960Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:02.111Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:02.263Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:02.414Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:02.565Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:02.712Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:02.860Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:03.010Z",
      "processes": [
        {
          "pid": 60278,
          "ppid": 60277,
          "pgid": 60278,
          "start": "Fri Nov 6 07:03:01 2026",
          "comm": "(node)"
        }
      ]
    },
    {
      "utc": "2026-11-05T23:03:03.165Z",
      "processes": []
    },
    {
      "utc": "2026-11-05T23:03:03.323Z",
      "processes": []
    }
  ],
  "requestedPorts": [],
  "fullRuntime": "NOT_RUN",
  "modelAuthBusiness": "NOT_RUN"
}
```

## 全门输出原文

下列 stdout/stderr 按原文嵌入；空输出块表示0字节。命令和退出码来自实际记录，未用摘要替换输出。

### diff-check

命令：`/usr/bin/git diff --check`；rc=0。


stdout:
```text
```

stderr:
```text
```

### bash-syntax

命令：`/bin/bash -n scripts/fleet-window/window-executor-v5.sh`；rc=0。


stdout:
```text
```

stderr:
```text
```

### helper-py-compile

命令：`/usr/bin/python3 -c 'import py_compile,sys; from pathlib import Path; base=Path('"'"'scripts/fleet-window'"'"'); names=['"'"'window_helper.py'"'"','"'"'window_helper_core.py'"'"','"'"'window_preimage_xattr.py'"'"','"'"'window_close.py'"'"','"'"'window-selftest.py'"'"']; [py_compile.compile(str(base/name),cfile=str(Path(sys.argv[1])/(name+'"'"'.pyc'"'"')),doraise=True) for name in names]; print('"'"'COMPILED '"'"'+str(len(names))+'"'"' helpers/selftest'"'"')' /usr/local/v5-boot-isolation/anarrowed-r2-42tttior`；rc=0。


stdout:
```text
COMPILED 5 helpers/selftest
```

stderr:
```text
```

### dry-run

命令：`/bin/bash scripts/fleet-window/window-executor-v5.sh --dry-run`；rc=0。


stdout:
```text
DRY_RUN_ONLY productionExecution=NOT_EXECUTED stageFunctionsCalled=0
BEGIN stage_00_authority_mutex [§4] authorization/expiry/unique writer; own mutex
END   stage_00_authority_mutex
BEGIN stage_01_integrity_clean [§1] pinned manifests; enumerate/hash/backup/delete ONLY untracked pnpm-lock.yaml; clean status
END   stage_01_integrity_clean
BEGIN stage_02_fresh_read [§1–2,4 + r5] source/Harness; plist/env/old PID; static hashes; live schema/identity/bindings + diff receipt
END   stage_02_fresh_read
BEGIN stage_03_dual_prerequisites [§3] accepted canary + full runtime; complete file/link membership; candidate binding
END   stage_03_dual_prerequisites
BEGIN stage_03b_candidate_state [A4] candidate real runtime + sanitized state copies; UNKNOWN preserved; Agent-scoped fence; no replay/overwrite
END   stage_03b_candidate_state
BEGIN stage_06a_preimage_before_stop [A5] full current tree/config/plist/env/metadata + reused copies while old runtime is alive
END   stage_06a_preimage_before_stop
BEGIN stage_04_quiet_gate [A1] mtime >=180s + read-only census receipt; nonempty allowed; no settlement
END   stage_04_quiet_gate
BEGIN stage_05_old_exit [A2] bootout; exact PID/worker/ports/supervisor absent; classify historical vs executable/unproven; only latter STOP
END   stage_05_old_exit
BEGIN stage_05b_settle_unresolved [A3] same-epoch exact exit evidence only; no conflict; preserve unproven UNKNOWN + carry-forward receipt; remainder nonblocking
END   stage_05b_settle_unresolved
BEGIN stage_06_full_preimage [A5] post-bootout inventory/ACL drift recheck + live schema/identity/bindings receipt; no ditto
END   stage_06_full_preimage
BEGIN stage_07_pinned_install [§5] root-owned physical WINDOW_BUNDLE; pinned THREE arguments + R3_BINDING_PAYLOAD; real rc
END   stage_07_pinned_install
BEGIN stage_08_install_receipt [§2,5–6] THIS install.log backup + reuse marker + completed §5b; closure PASS AND rc=0; carry forward omitted current config
END   stage_08_install_receipt
BEGIN stage_09_final_binding [§3,5 + r5] final closure/config bound to both receipts; live schema/identity/bindings + diff receipt
END   stage_09_final_binding
BEGIN stage_10_plist_bootstrap [§2,5] preserve all plist/env; deployed SHA only; bootstrap
END   stage_10_plist_bootstrap
BEGIN stage_11_production_verify [§5] exact new PID/env/listener owner/log features/public health; authenticated canonical UNKNOWN
END   stage_11_production_verify
BEGIN stage_12_hr_watch [r4] full 600s window; NEW broker execute as agent agt_hr-agent lines
END   stage_12_hr_watch
BEGIN stage_13_close [§7] bounded results; authentication/business NOT_TESTED; release own mutex
END   stage_13_close
FAILURE_BOUNDARY any failure -> STOP + phase receipt + §6 recipe; NO automatic recovery
```

stderr:
```text
```

### governance-integrity

命令：`/usr/bin/python3 .agents/tools/verify_governance.py --target .`；rc=0。


stdout:
```text
vendored governance bytes match governance.lock.json
```

stderr:
```text
```

### window-selftest

命令：`/usr/bin/python3 -B scripts/fleet-window/window-selftest.py /private/tmp/anarrowed-wt/scripts/fleet-window/window-executor-v5.sh`；rc=0。


stdout:
```text
SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED receipts=/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h
BEGIN stage_00_authority_mutex SELFTEST_ISOLATED_CHECKS
END stage_00_authority_mutex PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_01_integrity_clean SELFTEST_ISOLATED_CHECKS
END stage_01_integrity_clean PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_02_fresh_read SELFTEST_ISOLATED_CHECKS
END stage_02_fresh_read PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_03_dual_prerequisites SELFTEST_ISOLATED_CHECKS
END stage_03_dual_prerequisites PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN stage_04_quiet_gate SELFTEST_ISOLATED_CHECKS
END stage_04_quiet_gate PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN anarrowed_negative_isolation SELFTEST_ISOLATED_CHECKS
END anarrowed_negative_isolation PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN c7_R6_R7_close_checks SELFTEST_ISOLATED_CHECKS
END c7_R6_R7_close_checks PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED
BEGIN canary REAL_OFFICIAL_STDIO_FRESH_HOME
END canary PASS REAL_OFFICIAL_STDIO_FRESH_HOME fullRuntime=NOT_EXECUTED
BEGIN postflight_preservation C5_MATERIALS_AND_VALIDATORS
END postflight_preservation PASS C5_MATERIALS_AND_VALIDATORS
SELFTEST PASS_ISOLATED_CHECKS_AND_STDIO_CANARY windowGO=false
```

stderr:
```text
```

### snapshot-read-tree

命令：`/usr/bin/git read-tree e61458e0666bc6aa962d31561beeff1ada4a4f56`；rc=0。


stdout:
```text
```

stderr:
```text
```

### snapshot-add

命令：`/usr/bin/git add -- scripts/fleet-window/README.md scripts/fleet-window/anarrowed/candidate-child.mjs scripts/fleet-window/anarrowed/candidate-oracle.mjs scripts/fleet-window/anarrowed/candidate-oracle.test.mjs scripts/fleet-window/anarrowed/candidate-state.mjs scripts/fleet-window/anarrowed/candidate-state.test.mjs scripts/fleet-window/anarrowed/rollback.test.mjs scripts/fleet-window/settle_unresolved_runtime_down.mjs scripts/fleet-window/settle_unresolved_runtime_down.test.mjs scripts/fleet-window/window-executor-v5.sh scripts/fleet-window/window-selftest.py scripts/fleet-window/window_helper.py scripts/fleet-window/window_helper_core.py`；rc=0。


stdout:
```text
```

stderr:
```text
```

### snapshot-write-tree

命令：`/usr/bin/git write-tree`；rc=0。


stdout:
```text
5f7ffcac57c74887746fc4571a582dc827c76be0
```

stderr:
```text
```

### snapshot-commit-tree

命令：`/usr/bin/git commit-tree 5f7ffcac57c74887746fc4571a582dc827c76be0 -p e61458e0666bc6aa962d31561beeff1ada4a4f56 -m 'R2 isolated code snapshot for structure verification'`；rc=0。


stdout:
```text
9a89ca7561d8224737e3db7e2aa3e3cba825632a
```

stderr:
```text
```

### structure

命令：`/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node scripts/verify-code-structure.mjs --base e61458e0666bc6aa962d31561beeff1ada4a4f56 --head 9a89ca7561d8224737e3db7e2aa3e3cba825632a`；rc=0。


stdout:
```text
verify-code-structure: CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT (base=e61458e0666bc6aa962d31561beeff1ada4a4f56 head=9a89ca7561d8224737e3db7e2aa3e3cba825632a)
  candidate violations: 0; baseline debt: 29; resolved debt: 0
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages"
  BASELINE_DEBT [INVALID_FILE_EXCEPTION_AUTHORITY] "packages/agent-credential-provisioning/test/provisioning.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/agent-provisioning/test/provisioning.test.js"
  BASELINE_DEBT [FILE_OVER_FIXED_BASELINE_CAP] "packages/agent-router/src/binding-store.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/agent-router/src/reconciliation/store.js"
  BASELINE_DEBT [INVALID_DIRECTORY_EXCEPTION_AUTHORITY] "packages/agent-router/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/agent-router/test/process-lifecycle"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/broker/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/broker/test/forum-capabilities.test.js"
  BASELINE_DEBT [FILE_OVER_FIXED_BASELINE_CAP] "packages/broker/test/transport.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/development-execution/test/development-execution.test.js"
  BASELINE_DEBT [FILE_OVER_FIXED_BASELINE_CAP] "packages/feishu-connector/src/bridge.js"
  BASELINE_DEBT [INVALID_DIRECTORY_EXCEPTION_AUTHORITY] "packages/feishu-connector/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/production-runtime/src"
  BASELINE_DEBT [INVALID_DIRECTORY_EXCEPTION_AUTHORITY] "packages/production-runtime/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/production-runtime/test/model-overrides.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/production-runtime/test/scheduler"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/scheduler/src/scheduler.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "packages/scheduler/test"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/session-history/test/session-history.test.js"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "packages/workflow-execution/test/stale-reentry.test.js"
  BASELINE_DEBT [DIRECTORY_OVER_CEILING] "scripts"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/agent-core-backup-ops.sh"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/agentcore-cron.mjs"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/fleet-window/stage_06_v2.py"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "scripts/lib"
  BASELINE_DEBT [UNREGISTERED_LEGACY_DIRECTORY] "scripts/lib/hr-s256-one-shot"
  BASELINE_DEBT [UNREGISTERED_LEGACY_TOUCHED] "scripts/lib/watchdog-payload-snapshot.mjs"
  BASELINE_DEBT [INVALID_FILE_EXCEPTION_AUTHORITY] "scripts/trusted-cp-deploy-install.sh"
```

stderr:
```text
```

## Selftest 内部门输出原文

### anarrowed-candidate-state

命令：`/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node --test /private/tmp/anarrowed-wt/scripts/fleet-window/anarrowed/candidate-oracle.test.mjs /private/tmp/anarrowed-wt/scripts/fleet-window/anarrowed/candidate-state.test.mjs`；rc=0。


stdout:
```text
{"scenario":"closed-startup-diagnostic-oracle","accepted":{"ok":true,"diagnosticAppends":1,"preservedActionEntries":2},"rejected":["immutable-record-handle","immutable-record-runtimeEpoch","immutable-record-agentId","immutable-record-processGeneration","immutable-record-turnSeq","immutable-record-sessionId","immutable-record-callerCorrelation","immutable-record-ingressCorrelation","immutable-record-createdAtWallMs","immutable-record-createdAt","immutable-record-admitted","immutable-record-promptWriteAttempted","immutable-record-eventWatermarkSeq","immutable-record-promptRequestId","immutable-record-messageId","immutable-record-deadlineAtWallMs","immutable-record-initialOutcome","immutable-record-initialSource","immutable-record-outcome","immutable-record-state","immutable-record-lateOutcome","immutable-record-outcomeEvidence","immutable-record-terminationEvidence","immutable-record-settledAtWallMs","immutable-record-cancelRequested","immutable-record-cancelRequestedAtWallMs","immutable-record-finalAssistantOutput","immutable-record-audit","immutable-record-hardDeadlineAt","immutable-record-recoveryState","immutable-record-missingEvidence","immutable-record-reapClaim","immutable-record-shutdownRequestedAt","immutable-record-exitObservedAt","immutable-record-settlementResult","immutable-record-nextSafeAction","immutable-record-fenceState","immutable-record-adminAbandonment","immutable-record-reservedMandatoryBytes","immutable-record-finalAssistantOutputEvidence","immutable-record-reconciliationHandle","immutable-record-turnExecutionId","immutable-record-queryState","new-business-field","removed-record","added-record","top-level-authority","new-top-level-field","epoch-history-loss","old-action-overwrite","old-action-drop","old-action-reorder","diagnostic-action","diagnostic-result","diagnostic-reasonCode","diagnostic-observedAtWallMs","diagnostic-payload","diagnostic-time-after-update","failure-reason-outside-whitelist","failure-reason-without-append","timestamp-regression","timestamp-without-append","numeric-bytes-tamper","numeric-bytes-stale","byte-payload-replacement"],"rollbackByteEqualityRetained":true,"admissionAndJobsByteEqualityRetained":true,"productionExecution":"NONE"}
✔ oracle accepts only append-only startup diagnostics and preserves every authority field (68.178417ms)
{"scenario":"candidate-and-rollback-boundaries","status":"PASS","positive":{"kind":"ISOLATED_REAL_CANDIDATE_STATE_BOOT","status":"PASS_ISOLATED","checks":{"routerReaderCompatible":true,"schedulerReaderCompatible":true,"originalUnknownPreserved":true,"affectedBlocked":true,"unrelatedAllowed":true,"globalStoreReady":true,"fullRuntimeReady":true,"runtimeUnknownPreserved":true,"schedulerHealthComplete":true,"ephemeralLoopbackListeners":true,"candidateUnchanged":true,"noReplay":true,"noOverwrite":true,"noOutbound":true,"cleanShutdown":true,"sourceUnchanged":true},"businessOutcome":"UNKNOWN","productionWrites":0,"businessSnapshotRestoreAllowed":false,"rollbackAllowed":false,"nodeSelection":"candidate-node-runtime","nodePath":"/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node","nodeSha256":"c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b","child":{"pid":60232,"code":0,"signal":null,"timedOut":false,"launchError":null,"closeObserved":true,"stdoutSha256":"a3d068e85e69a5aa33bbb5473e0a5c99d4ca9059396e48a2adeb6a9abd32301a","stderrSha256":"bb023284200b0a5c34fcf53070f00a4611fe2cc10912b5e732fa6bc03697be20"},"processSpawnAttempts":0,"outboundAttempts":0,"businessDispatchAttempts":0,"probeScope":"real candidate Production Runtime + Router durable store/admission, synthetic empty scheduler; no business request","nodeVersion":"v25.6.1","codeBindings":{"packages/production-runtime/src/entry.js":{"path":"/private/tmp/fleet-v5-prep/scratch/app/packages/production-runtime/src/entry.js","sha256":"5f5c0e0ce2139e9a71ff791cf1d72f13e6e3f0b886e35d3bcbd72e834b48d5f8"},"packages/production-runtime/src/compose.js":{"path":"/private/tmp/fleet-v5-prep/scratch/app/packages/production-runtime/src/compose.js","sha256":"36c9dbe330f80e3facc0322eaee46de3d0be79e4cb51f31406f5bf503baf8e22"},"packages/agent-router/src/reconciliation/store.js":{"path":"/private/tmp/fleet-v5-prep/scratch/app/packages/agent-router/src/reconciliation/store.js","sha256":"9c5fa22a8fb62f1064a4362918f217fd9fa4ad83acd35d1d3a137e60c27ac410"},"packages/agent-router/src/reconciliation/admission.js":{"path":"/private/tmp/fleet-v5-prep/scratch/app/packages/agent-router/src/reconciliation/admission.js","sha256":"a601a83e936b75d1ded8b4f300f119b4d270734cafda15ae80b3894bdef5ca8c"},"packages/agent-router/src/reconciliation/durable-file.js":{"path":"/private/tmp/fleet-v5-prep/scratch/app/packages/agent-router/src/reconciliation/durable-file.js","sha256":"44120e2bc94c7b6941029ecf08eadde49dec4356bb7e9fb71d64849699fd5d26"},"packages/scheduler/src/store.js":{"path":"/private/tmp/fleet-v5-prep/scratch/app/packages/scheduler/src/store.js","sha256":"a8eacf4f16edd207b7181a5fcc47b30a4b26c9e852d335ca2746c88fd4ac3fcc"}},"unknownRecords":1,"affectedAgents":1,"listeners":[{"address":"127.0.0.1","port":65282},{"address":"127.0.0.1","port":65283}],"runtimeStatus":{"health":"healthy","businessAdmission":"open","unresolvedRecoveries":1},"childPreservation":{"ok":true,"diagnosticAppends":1,"preservedActionEntries":2},"ok":true,"parentPreservation":{"ok":true,"diagnosticAppends":1,"preservedActionEntries":2},"inputs":[{"path":"/usr/local/v5-boot-isolation/anarrowed-candidate-load-L11jYZ/turn-recovery-v3.json","sha256":"25be5e04fb8cc0d2221902fecc9b1a31c64e42754a1194d63a4d2283442e8b9b","metadata":"16777229:355250516:2096:1793919779944599344:1793919779948440646:33152:502:20"},{"path":"/usr/local/v5-boot-isolation/anarrowed-candidate-load-L11jYZ/jobs.json","sha256":"63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311","metadata":"16777229:355250518:53:1793919779953003250:1793919779953003250:33152:502:20"}],"finishedAt":"2026-11-05T23:03:00.979Z"},"startupFailure":{"kind":"ISOLATED_REAL_CANDIDATE_STATE_BOOT","status":"STOPPED_ON_FAILURE","checks":{"sourceUnchanged":true},"businessOutcome":"UNKNOWN","productionWrites":0,"businessSnapshotRestoreAllowed":false,"rollbackAllowed":false,"error":"candidate Node runtime missing; invoking Node is not a candidate substitute","inputs":[{"path":"/usr/local/v5-boot-isolation/anarrowed-startup-failure-xlPbGU/turn-recovery-v3.json","sha256":"246fdf4f12e0da5a5a81833a6be9891dec87cd48e2e5539035ecd08516530009","metadata":"16777229:355250569:2096:1793919780981894077:1793919780985918590:33152:502:20"},{"path":"/usr/local/v5-boot-isolation/anarrowed-startup-failure-xlPbGU/jobs.json","sha256":"63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311","metadata":"16777229:355250570:53:1793919780990074980:1793919780990074980:33152:502:20"}],"ok":false,"finishedAt":"2026-11-05T23:03:00.992Z"},"incompatible":{"kind":"READ_ONLY_ROLLBACK_COMPATIBILITY","status":"STOPPED_ON_FAILURE","checks":{"candidateUnchanged":true,"noOverwrite":true,"cleanShutdown":false,"sourceUnchanged":true},"businessOutcome":"UNKNOWN","productionWrites":0,"businessSnapshotRestoreAllowed":false,"rollbackAllowed":false,"nodeSelection":"candidate-node-runtime","nodePath":"/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node","nodeSha256":"c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b","child":{"pid":60275,"code":5,"signal":null,"timedOut":false,"launchError":null,"closeObserved":true,"stdoutSha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","stderrSha256":"823f01da9e825f74978e80f744a78627bf9bb7e5de49c6e40c547f3c8d9a795b"},"processSpawnAttempts":0,"outboundAttempts":0,"businessDispatchAttempts":0,"probeScope":"real candidate Production Runtime + Router durable store/admission, synthetic empty scheduler; no business request","nodeVersion":"v25.6.1","codeBindings":{"packages/agent-router/src/reconciliation/durable-file.js":{"path":"/usr/local/v5-boot-isolation/anarrowed-v2-rollback-ilB3X6/old-candidate/packages/agent-router/src/reconciliation/durable-file.js","sha256":"44120e2bc94c7b6941029ecf08eadde49dec4356bb7e9fb71d64849699fd5d26"},"packages/scheduler/src/store.js":{"path":"/usr/local/v5-boot-isolation/anarrowed-v2-rollback-ilB3X6/old-candidate/packages/scheduler/src/store.js","sha256":"f645cd8c24e5200f03d93e803c8c255abc7911b9b1b3488492eb1c70118d455a"}},"ok":false,"error":"scheduler store: validate document: unsupported store version 3","parentPreservation":{"ok":true,"diagnosticAppends":0},"inputs":[{"path":"/usr/local/v5-boot-isolation/anarrowed-v2-rollback-ilB3X6/turn-recovery-v3.json","sha256":"0ac892e889f412e106f61a25d41d27658a933f2882dc18c6152fbab39cd7c666","metadata":"16777229:355250590:2096:1793919780993735488:1793919780997880836:33152:502:20"},{"path":"/usr/local/v5-boot-isolation/anarrowed-v2-rollback-ilB3X6/jobs.json","sha256":"63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311","metadata":"16777229:355250591:53:1793919781001887349:1793919781001887349:33152:502:20"}],"finishedAt":"2026-11-05T23:03:01.299Z"},"oldScheduler":"a39c7cc18e1487b0e0d358db4ddc1f1acbb1f294","oldModuleHashes":{"packages/scheduler/src/store.js":"f645cd8c24e5200f03d93e803c8c255abc7911b9b1b3488492eb1c70118d455a","packages/scheduler/src/occurrence-model.js":"157f3b86d59cfbbc6df61bcd181ba436db1f580fea43d9c6eeea513d3dc146a7","packages/scheduler/src/store-migration.js":"f5647ab196087c279782cb6f2634566fb6b6aec14edb55e4338cb82a84e5db58"},"currentBusinessPreserved":true,"productionExecution":"NONE"}
✔ candidate loading, startup failure and real Scheduler v2 rollback schema boundary (1363.667041ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1553.123125
```

stderr:
```text
```

### anarrowed-rollback

命令：`/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node --test /private/tmp/anarrowed-wt/scripts/fleet-window/anarrowed/rollback.test.mjs`；rc=0。


stdout:
```text
{"scenario":"bootstrap-failure-fallback","status":"PASS","directory":"/usr/local/v5-boot-isolation/anarrowed-rollback-4GHtpA","attempted":["helper root plist-update","sudo -n /bin/launchctl bootstrap system /Library/LaunchDaemons/ai.agent-core.runtime.plist"],"currentBusinessSha256":"b6945ee10509bc1dcba8a2076c063499db27aac698afc617ef34550dd3a23a28","automaticRollback":false,"productionExecution":"NONE"}
✔ bootstrap failure stops downstream and preserves current business state (41.147458ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 218.748125
```

stderr:
```text
```

### anarrowed-settlement

命令：`/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node --test /private/tmp/anarrowed-wt/scripts/fleet-window/settle_unresolved_runtime_down.test.mjs`；rc=0。


stdout:
```text
FIXTURE_RUN_DIR=/usr/local/v5-boot-isolation/settle-test/run-anGP7L
{"scenario":"unknown + trusted exact termination -> terminated_without_outcome","status":"PASS","report":{"settled":1,"skipped":0,"unproven":0,"remaining":0,"writes":1,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":[],"beforeSha256":"fe29c6fc6a805b326c222810c94b401b42c9d6338637759b412bff289ee41aa5","afterSha256":"a60e595d9e604f53c1c8428fafa2a301761002048ebd9e8a49b1b3897ea32e9e","businessOutcome":"UNKNOWN"}},"exitCode":0,"repeat":{"report":{"settled":0,"skipped":1,"unproven":0,"remaining":0,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":[],"beforeSha256":"a60e595d9e604f53c1c8428fafa2a301761002048ebd9e8a49b1b3897ea32e9e","afterSha256":"a60e595d9e604f53c1c8428fafa2a301761002048ebd9e8a49b1b3897ea32e9e","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"a60e595d9e604f53c1c8428fafa2a301761002048ebd9e8a49b1b3897ea32e9e","afterSha256":"a60e595d9e604f53c1c8428fafa2a301761002048ebd9e8a49b1b3897ea32e9e","metadataUnchanged":true},"beforeSha256":"fe29c6fc6a805b326c222810c94b401b42c9d6338637759b412bff289ee41aa5","afterSha256":"a60e595d9e604f53c1c8428fafa2a301761002048ebd9e8a49b1b3897ea32e9e"}
{"scenario":"non-unknown -> unchanged bytes and metadata","status":"PASS","report":{"settled":0,"skipped":1,"unproven":0,"remaining":1,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-non-unknown:a1:g1:s1"],"beforeSha256":"67a7ad989513d21b19e8610d305c471cf8a60878db3255e320a5042d953d03bc","afterSha256":"67a7ad989513d21b19e8610d305c471cf8a60878db3255e320a5042d953d03bc","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"67a7ad989513d21b19e8610d305c471cf8a60878db3255e320a5042d953d03bc","afterSha256":"67a7ad989513d21b19e8610d305c471cf8a60878db3255e320a5042d953d03bc","metadataUnchanged":true}
{"scenario":"unknown without exact termination -> zero writes UNKNOWN","status":"PASS","report":{"settled":0,"skipped":0,"unproven":1,"remaining":1,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":["turn:fixture-no-evidence:a1:g1:s1"],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-no-evidence:a1:g1:s1"],"beforeSha256":"dd096eea89c8bde9357dc3dcc70e9f663b033e96f1ba68923fbb8c1a01f22582","afterSha256":"dd096eea89c8bde9357dc3dcc70e9f663b033e96f1ba68923fbb8c1a01f22582","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"dd096eea89c8bde9357dc3dcc70e9f663b033e96f1ba68923fbb8c1a01f22582","afterSha256":"dd096eea89c8bde9357dc3dcc70e9f663b033e96f1ba68923fbb8c1a01f22582","metadataUnchanged":true}
{"scenario":"mixed store preserves untouched rows, answer digests and identity history","status":"PASS","report":{"settled":1,"skipped":2,"unproven":1,"remaining":2,"writes":1,"businessOutcome":"UNKNOWN","unprovenHandles":["turn:fixture-mixed:a3:g3:s1"],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-mixed:a2:g2:s1","turn:fixture-mixed:a3:g3:s1"],"beforeSha256":"54b69314b3dba29ead8f7d9cf339a5bc7d2730be948f3e7c7260fc035aaf074a","afterSha256":"e3aaa05e8924eb82be677ec23a526ae08b309605db335efad1846178e2365728","businessOutcome":"UNKNOWN"}},"exitCode":0,"untouchedRows":3,"historyAndDigestsPreserved":true}
{"scenario":"untrusted evidence: worker-alive -> zero writes","status":"PASS","report":{"settled":0,"skipped":0,"unproven":0,"remaining":null,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"worker ps gate refused: 1 live worker-like processes"},"exitCode":5,"beforeSha256":"510ff213185adb383cf91b2e518061951b9dcea528235b6aa847e9ff08ef1d78","afterSha256":"510ff213185adb383cf91b2e518061951b9dcea528235b6aa847e9ff08ef1d78","metadataUnchanged":true}
{"scenario":"untrusted evidence: stale-proof -> zero writes","status":"PASS","report":{"settled":0,"skipped":0,"unproven":0,"remaining":null,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"stage_05 proof missing/stale"},"exitCode":5,"beforeSha256":"c2b855c6187f51e3ae8c90542f31e72cf8b5f7093ac8f31f73c398f54bf4b723","afterSha256":"c2b855c6187f51e3ae8c90542f31e72cf8b5f7093ac8f31f73c398f54bf4b723","metadataUnchanged":true}
{"scenario":"untrusted evidence: wrong-epoch -> zero writes","status":"PASS","report":{"settled":0,"skipped":0,"unproven":0,"remaining":null,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"stage_05 store hash/epoch mismatch"},"exitCode":5,"beforeSha256":"4454d7d085b2730650fba79610dd331930c8f5ab35576c23ef2c9268a2394136","afterSha256":"4454d7d085b2730650fba79610dd331930c8f5ab35576c23ef2c9268a2394136","metadataUnchanged":true}
{"scenario":"untrusted evidence: bare-child-label -> zero writes","status":"PASS","report":{"settled":0,"skipped":0,"unproven":1,"remaining":1,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":["turn:fixture-bare-child-label:a1:g1:s1"],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-bare-child-label:a1:g1:s1"],"beforeSha256":"d4ea7a16bda21f47022cd317403025c3f93a553d91bbe9538df7a28e009925fb","afterSha256":"d4ea7a16bda21f47022cd317403025c3f93a553d91bbe9538df7a28e009925fb","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"d4ea7a16bda21f47022cd317403025c3f93a553d91bbe9538df7a28e009925fb","afterSha256":"d4ea7a16bda21f47022cd317403025c3f93a553d91bbe9538df7a28e009925fb","metadataUnchanged":true}
{"scenario":"untrusted evidence: old-record-epoch -> zero writes","status":"PASS","report":{"settled":0,"skipped":0,"unproven":1,"remaining":1,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":["turn:fixture-old-record-epoch:a1:g1:s1"],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-old-record-epoch:a1:g1:s1"],"beforeSha256":"e289461c61d3bd94e1b3fd77f8041b33efe5cf3b771d6de962169f4fc76ca2f3","afterSha256":"e289461c61d3bd94e1b3fd77f8041b33efe5cf3b771d6de962169f4fc76ca2f3","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"e289461c61d3bd94e1b3fd77f8041b33efe5cf3b771d6de962169f4fc76ca2f3","afterSha256":"e289461c61d3bd94e1b3fd77f8041b33efe5cf3b771d6de962169f4fc76ca2f3","metadataUnchanged":true}
{"scenario":"exitObservedAt=null retains UNKNOWN with no publication","status":"PASS","report":{"settled":0,"skipped":0,"unproven":1,"remaining":1,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":["turn:fixture-null-exit:a1:g1:s1"],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-null-exit:a1:g1:s1"],"beforeSha256":"a10de5c60741fa1d759b6025933ff8e7832fff10de86d3aab32fc8d4a4cb03c1","afterSha256":"a10de5c60741fa1d759b6025933ff8e7832fff10de86d3aab32fc8d4a4cb03c1","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"a10de5c60741fa1d759b6025933ff8e7832fff10de86d3aab32fc8d4a4cb03c1","afterSha256":"a10de5c60741fa1d759b6025933ff8e7832fff10de86d3aab32fc8d4a4cb03c1","metadataUnchanged":true}
{"scenario":"conflicting exact evidence retains original UNKNOWN","status":"PASS","report":{"settled":0,"skipped":0,"unproven":1,"remaining":1,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":["turn:fixture-conflicting-evidence:a1:g1:s1"],"carryForward":{"status":"RETAINED_WITHOUT_REPLAY","installationBlocking":false,"handles":["turn:fixture-conflicting-evidence:a1:g1:s1"],"beforeSha256":"d23bb68f470ab6f9ca12e565f31cc212a067875dd9355f10aa6b5b403211118e","afterSha256":"d23bb68f470ab6f9ca12e565f31cc212a067875dd9355f10aa6b5b403211118e","businessOutcome":"UNKNOWN"}},"exitCode":0,"beforeSha256":"d23bb68f470ab6f9ca12e565f31cc212a067875dd9355f10aa6b5b403211118e","afterSha256":"d23bb68f470ab6f9ca12e565f31cc212a067875dd9355f10aa6b5b403211118e","metadataUnchanged":true}
{"scenario":"memory/disk second writer race refuses stale publication","status":"PASS","report":{"settled":0,"skipped":0,"unproven":0,"remaining":0,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"store changed before write"},"exitCode":5,"competingWriterStatePreserved":true,"staleMemoryPublished":false}
{"scenario":"partial in-memory settlement failure publishes neither record","status":"PASS","report":{"settled":0,"skipped":0,"unproven":0,"remaining":null,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"official settlement refused; no publication"},"exitCode":5,"beforeSha256":"68d06bb2cee579b997e49c7845fa5f4a9e7e8585ff939d55eae813750044e876","afterSha256":"68d06bb2cee579b997e49c7845fa5f4a9e7e8585ff939d55eae813750044e876","metadataUnchanged":true,"attempted":2,"atomicBatchPreserved":true}
{"scenario":"real live isolated worker refuses settlement until separately stopped","status":"PASS","report":{"settled":0,"skipped":0,"unproven":0,"remaining":null,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"worker ps gate refused: 1 live worker-like processes"},"exitCode":5,"beforeSha256":"b6693d9dfc14e2c9fbae8acef3f5e05d29c48e9ef6a829c3503c52f76bae6eb2","afterSha256":"b6693d9dfc14e2c9fbae8acef3f5e05d29c48e9ef6a829c3503c52f76bae6eb2","metadataUnchanged":true,"actualLiveWorkerPid":60172,"productionWorkerUsed":false}
{"scenario":"settlement CLI missing stage_05 proof -> rc5 and zero writes","status":"PASS","exitCode":5,"report":{"settled":0,"skipped":0,"unproven":0,"remaining":null,"writes":0,"businessOutcome":"UNKNOWN","unprovenHandles":[],"carryForward":null,"status":"UNKNOWN","error":"ENOENT: no such file or directory, lstat '/usr/local/v5-boot-isolation/settle-test/run-anGP7L/settle-cli-no-proof/old-exit.json'"},"beforeSha256":"b641c49b22159dc9bff30069dc2c53b1cd7ae5a5f7d260d54ab0c54ca4ca32c2","afterSha256":"b641c49b22159dc9bff30069dc2c53b1cd7ae5a5f7d260d54ab0c54ca4ca32c2","metadataUnchanged":true}
{"scenario":"read-only precheck function and CLI: empty","status":"PASS","report":{"inflightTurns":[],"unresolvedLostTurns":[],"inflightOccurrences":[]},"exitCode":0,"cliExitCode":0,"readOnlyBytesAndMetadata":true,"storeSha256":["35aa0f47775911f927f2cec35f591310806ff63e3cc56f90ae3995d9b99d193b","63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311"]}
{"scenario":"read-only precheck function and CLI: inflightTurns","status":"PASS","report":{"inflightTurns":[{"handle":"turn:fixture-precheck-inflightTurns:a1:g1:s1","agentId":"agt_fixture_0","processGeneration":1,"runtimeEpoch":"fixture-precheck-inflightTurns","recoveryState":"reserved","promptWriteAttempted":false,"exitObservedAt":null}],"unresolvedLostTurns":[],"inflightOccurrences":[]},"exitCode":1,"cliExitCode":1,"readOnlyBytesAndMetadata":true,"storeSha256":["c6f5930b35a8f7aeb4db092f6da8208c7f45962b46acd3f2df0b543fd1f10ef5","63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311"]}
{"scenario":"read-only precheck function and CLI: unresolvedLostTurns","status":"PASS","report":{"inflightTurns":[],"unresolvedLostTurns":[{"handle":"turn:fixture-precheck-unresolvedLostTurns:a1:g1:s1","agentId":"agt_fixture_0","processGeneration":1,"runtimeEpoch":"fixture-precheck-unresolvedLostTurns","recoveryState":"blocked","promptWriteAttempted":false,"exitObservedAt":null}],"inflightOccurrences":[]},"exitCode":1,"cliExitCode":1,"readOnlyBytesAndMetadata":true,"storeSha256":["d937835538fc14f84266d70d5fa720cbcf36c52e0c904cfea2279da002f8749c","63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311"]}
{"scenario":"read-only precheck function and CLI: inflightOccurrences","status":"PASS","report":{"inflightTurns":[],"unresolvedLostTurns":[],"inflightOccurrences":[{"occurrenceId":"occ-fixture","jobId":"job-fixture","runId":"run-fixture","state":"running"}]},"exitCode":1,"cliExitCode":1,"readOnlyBytesAndMetadata":true,"storeSha256":["d22492a3d6fbab5259d6c6941fe624c7fc54ff3dc0f9a3a14d9d7c8a0c6a8ea6","bfec92f2a2c7cbfdb23835e17382aab0bb1f0a1ce5ddfa2603371930ef4a17e6"]}
{"scenario":"read-only precheck function and CLI: missing","status":"PASS","report":{"inflightTurns":null,"unresolvedLostTurns":null,"inflightOccurrences":null,"status":"UNKNOWN","error":"ENOENT: no such file or directory, lstat '/usr/local/v5-boot-isolation/settle-test/run-anGP7L/precheck-missing/missing.json'"},"exitCode":1,"cliExitCode":1,"readOnlyBytesAndMetadata":true,"storeSha256":["50ff9c82d297b32685930a57b17b22c757aea7256a80c28c52ddb25a9951b784","63ac1617b75124a1f9d7e54f63ea4f9b01eef8394ffb25c63b2d9114c72d7311"]}
{"scenario":"read-only precheck function and CLI: schema","status":"PASS","report":{"inflightTurns":null,"unresolvedLostTurns":null,"inflightOccurrences":null,"status":"UNKNOWN","error":"scheduler occurrences schema absent"},"exitCode":1,"cliExitCode":1,"readOnlyBytesAndMetadata":true,"storeSha256":["aa77e2ea680324a0f1bde64b35457533fde0db9c525188f3dcf1dd26a81c2c85","17dcb2a347de5e9b68665d84c3d8d674df5d962fc2996fc2b541b74bbe7cc045"]}
✔ isolated settlement and read-only zero-inflight fixtures, stop on first assertion failure (1270.321958ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1464.422666
```

stderr:
```text
```

### canary-recorder

命令：`/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/canary-recorder.mjs /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h /usr/local/v5-boot-isolation/assembled-root /tmp/fleet-v5-candidate/scripts/lib/trusted-cp-fresh-child-boot-canary.mjs`；rc=0。


stdout:
```text
```

stderr:
```text
```

### extracted-helper-phase

命令：`/usr/bin/python3 -B /private/tmp/anarrowed-wt/scripts/fleet-window/window_helper.py /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h phase c7_extraction_smoke PASS ISOLATED_ONLY`；rc=0。


stdout:
```text
```

stderr:
```text
```

### protected-routing

命令：`/usr/local/v5-boot-isolation/assembled-root/node-runtime/bin/node /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/routing-probe.mjs /usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/routing.json`；rc=0。


stdout:
```text
{"ok":true,"result":{"manifest":{"version":1,"canonicalOpsTarget":{"channel":"feishu","to":"C7_NO_DELIVERY"},"ownerTargets":{},"jobFailureTargets":{}},"readback":{"path":"/usr/local/v5-boot-isolation/c7-selftest-t7y8u_9h/routing.json","sha256":"6dd6acbd093c4975e65cc5555be4ac46a083940c0b3d4941573cbccbe61f6808","valid":true,"version":1,"canonicalOpsConfigured":true,"ownerTargetCount":0,"jobFailureTargetCount":0}}}
```

stderr:
```text
```

## 提交前staged检查及代码提交原文

### code-add

命令：`git add -- scripts/fleet-window/README.md scripts/fleet-window/anarrowed/candidate-child.mjs scripts/fleet-window/anarrowed/candidate-oracle.mjs scripts/fleet-window/anarrowed/candidate-oracle.test.mjs scripts/fleet-window/anarrowed/candidate-state.mjs scripts/fleet-window/anarrowed/candidate-state.test.mjs scripts/fleet-window/anarrowed/rollback.test.mjs scripts/fleet-window/settle_unresolved_runtime_down.mjs scripts/fleet-window/settle_unresolved_runtime_down.test.mjs scripts/fleet-window/window-executor-v5.sh scripts/fleet-window/window-selftest.py scripts/fleet-window/window_helper.py scripts/fleet-window/window_helper_core.py`；rc=0。


stdout:
```text
```

stderr:
```text
```

### staged-diff-check

命令：`git diff --cached --check`；rc=0。


stdout:
```text
```

stderr:
```text
```

### code-commit

命令：`git commit -m 'fix(fleet-window): narrow window checks and refine startup diagnostic oracle'`；rc=0。


stdout:
```text
[chore/fleet-window-anarrowed c063f556] fix(fleet-window): narrow window checks and refine startup diagnostic oracle
 13 files changed, 854 insertions(+), 57 deletions(-)
 create mode 100644 scripts/fleet-window/anarrowed/candidate-child.mjs
 create mode 100644 scripts/fleet-window/anarrowed/candidate-oracle.mjs
 create mode 100644 scripts/fleet-window/anarrowed/candidate-oracle.test.mjs
 create mode 100644 scripts/fleet-window/anarrowed/candidate-state.mjs
 create mode 100644 scripts/fleet-window/anarrowed/candidate-state.test.mjs
 create mode 100644 scripts/fleet-window/anarrowed/rollback.test.mjs
```

stderr:
```text
```

### code-head

命令：`git rev-parse HEAD`；rc=0。


stdout:
```text
c063f5569bcfd8c51240281a04cc3f42e8ed68c9
```

stderr:
```text
```

### code-tree

命令：`git rev-parse 'HEAD^{tree}'`；rc=0。


stdout:
```text
5f7ffcac57c74887746fc4571a582dc827c76be0
```

stderr:
```text
```
