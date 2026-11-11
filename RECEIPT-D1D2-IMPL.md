# D1D2 实施与隔离验收回执

- observed_at: 2026-11-09T10:23:06.545182+00:00
- repository: mayf3/dsh-agent-core；source worktree: `/Users/yanfenma/workspace/project/worktrees/ops-d1d2-impl`。
- BASE_HEAD / original worktree HEAD: `417cc8ee6e7ef9a5e840e900a11c30fe58d648da`。
- delivery ref: `ops/d1d2-validator-impl`；独立 Git 元数据 `/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/d1d2-delivery-zaycnmgm/git`；原共享 Git 元数据只读，原 HEAD/索引不变。
- accepted authority: `AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1`，blob `e28055637aaf7b32812401ce07332fe1dd6f63ba`，SHA256 `f12f02e7f9870e62946e1c912901e83f43c0d30c87457095a76d3b9988bc24ff`，未改 accepted 文本。
- candidate code/fixture review manifest: `/tmp/d1d2-source-review.json`，SHA256 `3a4f0b25cc24dd391d4d690208133b74013d8df248ea5d8041244b69fc6f4460`；15/15 文件哈希经独立复跑前后匹配。最终 commit 在其外部传输回执绑定，避免自引用 commit/hash。
- environment: Darwin 25.6.0 / arm64 / Python 3.14.7 / uid 502；UTC fixture=2026-11-09T12:00:00Z；control owner/caller 是明确标记的外部观察 fixture，非生产 actor 任命证明。
- route: REUSE / BRIEF / CONTROLLED / IMPLEMENTATION；source/isolated conformance=VERIFIED；production_apply=none；merge=NO。

## 阶段和当前许可

接受提交 `fa617851`、main 合并 `417cc8ee` 和 accepted 索引明确授 B 入口 contracts 实施权。原正文 AUTHOR 路由绑定旧提案任务；CTR001 同段允许未来独立接受+main 后另起实施。非作者复核认为可 REUSE。ACC001 实际核原 `5f3133dd→f3e8340a` 的 docs-only/proposed 隔离；本次实现 diff 另核当前简报允许面，绝不把本次代码 diff 冒称 docs-only。未改 Spec、SRA/DCP、索引、任命或生产文件。

## 实施坐标与合同映射

| Contract | 本次真实 consumer / Evidence |
|---|---|
| CTR-FWAV-001 | 原 AUTHOR 隔离+当前允许面：test_fwav.py test_ACC_001；当前简报阶段映射；生产效果拒绝 |
| CTR-FWAV-002 | checks.py validate 的 SRA/main/effectiveness/issuer 消费；reader.py 固定原 source，缺资格默认拒绝；ACC002 |
| CTR-FWAV-003 | reader.py strict_json/select/canonical/seal；checks.py 全记录 hash/schema/原 grantor/current lifecycle；ACC003 |
| CTR-FWAV-004 | checks.py PROCESS_EXTERNAL caller/原 W 连续性/attempt 与 C 连续性分离；core validate_authority/authority；ACC004 |
| CTR-FWAV-005 | policy.py participants，完整作者列表、真实 actor+principal 冲突、issuer/C session 对齐；ACC005 |
| CTR-FWAV-006 | policy.py effects/scope；core.py effect_guard 从固定调用实际参数提取 exact effect 三方交集；ACC006 |
| CTR-FWAV-007 | policy.py standard 五判据/11类穷举排除坐标/REQUIRED_AT_STAGE 配方与当场 gate；ACC007/008 |
| CTR-FWAV-008 | checks.py stamp、window/appointment 半开 UTC 交集及clock回退；ACC009 |
| CTR-FWAV-009 | core authority_observation 每次外部读取，checks.py query完整性/lease/epoch/revision/lifecycle revision+hash 防回退；原 per-window observation receipt 只作审计比较；ACC010 |
| CTR-FWAV-010 | helper 逐guard、core mutex dev/ino/uid+holder、fresh读取后再核；runner 固定bootout/bootstrap入口；xattr每写guard；27处原AST边界trace；内部写缺资格 dispatch前拒绝；ACC011 |
| CTR-FWAV-011 | 原 manifest/source/Harness/dual prerequisites/live/final binding gates 保留；13条原predicate动态负例；六类初始+后续真实core拒绝；ACC012/013 |
| CTR-FWAV-012 | RuntimeError→stderr/原runner ERR trap/phase FAIL/STOP/Evidence，非rc10；诊断写失败不覆盖原rc；release核原safe terminal与自身锁，不重放/恢复/自动清锁；ACC014/015与12case补证 |
| CTR-FWAV-013 | 本回执、code+fixture/hash manifest、16执行原文、独立复跑；source/isolated 与 installed/loaded/profile/EFFECTIVE/单窗分列；ACC016 |

实际函数行号：core.py validate_legacy_fields:27、authority_observation:94、validate_authority:106、authority:116、mutex_acquired:123、mutex_owned:129、effect_guard:145；checks.py stamp:8/equal_ref:20/validate:26；policy.py effects:12/evidence:23/standard:33/scope:63/participants:77；reader.py strict_json:21/canonical:46/select:55/read_registry:68/RegistryReader:82。逐效果原源码行号、相邻效果与实际guard执行结果在下方trace原文；源文件哈希保证坐标不漂移。

## 改动文件与增删行

不含本回执自身（本回执是此清单后生成的单一文档）。`test_xattrfix_r3.py` 移位而非删除覆盖其机制测试；Git可识别rename。新增模块以同一职责子目录组织，fleet-window直接tracked children保持19；所有受影响手写代码<=500行。未改的 stage_06_v2.py=1116行属于既有债务，本次不对它宣称合规。

| Added | Deleted | Path |
|---|---|---|
| 39 | 0 | BRIEF-D1D2-IMPL.md |
| 19 | 0 | scripts/fleet-window/README.md |
| 1 | 0 | scripts/fleet-window/authority_validation/__init__.py |
| 127 | 0 | scripts/fleet-window/authority_validation/checks.py |
| 109 | 0 | scripts/fleet-window/authority_validation/policy.py |
| 90 | 0 | scripts/fleet-window/authority_validation/reader.py |
| 116 | 0 | scripts/fleet-window/authority_validation/tests/boundary_harness.py |
| 135 | 0 | scripts/fleet-window/authority_validation/tests/boundary_trace.py |
| 136 | 0 | scripts/fleet-window/authority_validation/tests/check_error_exit.py |
| 128 | 0 | scripts/fleet-window/authority_validation/tests/fw_fixture.py |
| 394 | 0 | scripts/fleet-window/authority_validation/tests/test_fwav.py |
| 442 | 0 | scripts/fleet-window/authority_validation/tests/test_xattrfix_r3.py |
| 0 | 432 | scripts/fleet-window/test_xattrfix_r3.py |
| 16 | 9 | scripts/fleet-window/window-executor-v5.sh |
| 11 | 5 | scripts/fleet-window/window-selftest.py |
| 91 | 8 | scripts/fleet-window/window_helper.py |
| 75 | 3 | scripts/fleet-window/window_helper_core.py |
| 2 | 1 | scripts/fleet-window/window_preimage_xattr.py |

## 代码与 fixture 精确版本

| Path | Physical lines | SHA256 |
|---|---|---|
| scripts/fleet-window/authority_validation/__init__.py | 1 | `6a779e6e8b0f6462ed9de0cecd8af803b4ee7f05d6dae88eb1897b297ab61054` |
| scripts/fleet-window/authority_validation/checks.py | 127 | `37ddb67c54825978c3feb08dd0777dd82ab8419d58550a74f46b0090d98062a4` |
| scripts/fleet-window/authority_validation/policy.py | 109 | `1f3c437a22870ab3a3a6787feb8858acf81c4b5302a0195457f6c50e6f2d3835` |
| scripts/fleet-window/authority_validation/reader.py | 90 | `93575942d33f153ec3ca4319837885bfaea30b52126ffbc2c3efcc799d2a2e07` |
| scripts/fleet-window/authority_validation/tests/boundary_harness.py | 116 | `41c7f1b2b53da834e6b1a52475081c105eb273f452b275dee37735d72516b9ac` |
| scripts/fleet-window/authority_validation/tests/boundary_trace.py | 135 | `e8e772e292f9fd9e7596c34fe29b2c5520befd5abb2439aa3d5c718812672ec4` |
| scripts/fleet-window/authority_validation/tests/check_error_exit.py | 136 | `9c933b94c481c7c23ec22b97aecbbd0600208159a911602a8606a2308c0fc019` |
| scripts/fleet-window/authority_validation/tests/fw_fixture.py | 128 | `eadca2b883c57e0c61c7b738a65901997d5d20a88cb97ba269c8148e5ee6e999` |
| scripts/fleet-window/authority_validation/tests/test_fwav.py | 394 | `94c0abb8d00a2bcd2fd794975470e8500c00ba56a3daf2e1a7a4fdced90a65c1` |
| scripts/fleet-window/authority_validation/tests/test_xattrfix_r3.py | 442 | `5f0946d1df4ea82b414a1139afb274cf9bd272d9abb640aca7b3ff87de56af72` |
| scripts/fleet-window/window-executor-v5.sh | 331 | `d274b7e505e720079b50a263f4e4fa10722490ef141026dfb46b753df8910e3e` |
| scripts/fleet-window/window-selftest.py | 433 | `acaff144cd19183c3a6fae324fedb4db71546c2c67e2ac7dd170660ce54aeb41` |
| scripts/fleet-window/window_helper.py | 453 | `3968c88d859656180e078db2046487ff2beeb868de4290e24ca2bfafaae350fd` |
| scripts/fleet-window/window_helper_core.py | 443 | `1ed169d1fa3934f1f058ceded31c302d258c94665f2b59cd52fcdb0df97eca33` |
| scripts/fleet-window/window_preimage_xattr.py | 112 | `4341f0e4158dfd5ebb8fbb170beb2cf9a7098a120d5b63491a119b3cbfada05d` |

## 执行原文：16条验收

命令：`python3 -B scripts/fleet-window/authority_validation/tests/test_fwav.py`；rawRC=0；`Ran 16 tests` / `OK`。445显式断言，207进程内预期拒绝；另六类真实runner拒绝均rawRC1。每行是原 stdout 的逐条结果，未执行项不会填PASS。`pureInputListHash`仅表示该测试累积的纯输入列表；边界输入hash另在trace/补证结果，空列表hash不当作完整输入证据。

```jsonl
{"acceptance": "ACC-FWAV-001", "rawRC": 0, "assertions": 4, "refusals": 0, "effectCalls": 0, "pureInputListHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-002", "rawRC": 0, "assertions": 6, "refusals": 5, "effectCalls": 0, "pureInputListHash": "76a5be0ff3d5cbcc935c31daf26bdb6fc3290d0a80627b5ea92a0876872be8d8", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-003", "rawRC": 0, "assertions": 17, "refusals": 15, "effectCalls": 0, "pureInputListHash": "431cae57a2203878b659997a2bfee47f4bdebae3d78021a5fb0a01c75a8ffb41", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-004", "rawRC": 0, "assertions": 10, "refusals": 7, "effectCalls": 0, "pureInputListHash": "29faebdd0e5e2dd9c9d1a08720b04b5ad99a0ff15acac161ea6ebb27f3e300be", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-005", "rawRC": 0, "assertions": 10, "refusals": 8, "effectCalls": 0, "pureInputListHash": "7949e6c759a3803b0ff5699e10f01e96a1021c817f1e69769513350baca5b0cb", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-006", "rawRC": 0, "assertions": 13, "refusals": 12, "effectCalls": 0, "pureInputListHash": "fa29a0ffb655f0f2c37a4989880ad31b56af3a3118f7db6166238db5da15a027", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-007", "rawRC": 0, "assertions": 25, "refusals": 23, "effectCalls": 0, "pureInputListHash": "7a358c18d96c3467d29707074c6ef01ebec6479c36ac1b32590017b86fbd68a5", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-008", "rawRC": 0, "assertions": 45, "refusals": 45, "effectCalls": 0, "pureInputListHash": "4e2b5ec983d019b0383cb2220e6dba8d28ca9b7804a226e3bec9bd4934d00c22", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-009", "rawRC": 0, "assertions": 14, "refusals": 12, "effectCalls": 0, "pureInputListHash": "acc3c441ed1c50b1d0f5e14ce15835837d34dd8cd1696091704ef5695c2d7437", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-010", "rawRC": 0, "assertions": 29, "refusals": 11, "effectCalls": 0, "pureInputListHash": "be31f280c0aa782da3ec0136fb1ad87a71ffa8f761ac8d44f91abee40a95632f", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-011", "rawRC": 0, "assertions": 163, "refusals": 37, "effectCalls": 0, "pureInputListHash": "f6de16de4ea94bdd8b646efde9e885ab92b2a143b4db96de88898bb8f99d5d09", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-012", "rawRC": 0, "assertions": 30, "refusals": 12, "effectCalls": 0, "pureInputListHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-013", "rawRC": 0, "assertions": 24, "refusals": 17, "effectCalls": 0, "pureInputListHash": "486bd5ab5659b06d3e3c75ad5823d5412de306121ad856ebabbe069437334deb", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-014", "rawRC": 0, "assertions": 42, "refusals": 0, "effectCalls": 0, "pureInputListHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-015", "rawRC": 0, "assertions": 8, "refusals": 2, "effectCalls": 0, "pureInputListHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
{"acceptance": "ACC-FWAV-016", "rawRC": 0, "assertions": 5, "refusals": 1, "effectCalls": 0, "pureInputListHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", "controlOwner": "isolated fixture provider", "callerSource": "PROCESS_EXTERNAL boundary fixture; runtime qualification UNKNOWN"}
```

六类原出口原文：

```jsonl
{"refusal": "unappointed", "rawRC": 1, "effectCalls": 0, "phase": "FAIL", "stderr": "RuntimeError: 未任命: real caller relation UNKNOWN"}
{"refusal": "scope", "rawRC": 1, "effectCalls": 0, "phase": "FAIL", "stderr": "RuntimeError: 越界: effect outside intersection"}
{"refusal": "expired", "rawRC": 1, "effectCalls": 0, "phase": "FAIL", "stderr": "RuntimeError: 过期: outside window/appointment UTC intersection"}
{"refusal": "revoked", "rawRC": 1, "effectCalls": 0, "phase": "FAIL", "stderr": "RuntimeError: 撤销: appointment not effective/revoked/replaced"}
{"refusal": "drift", "rawRC": 1, "effectCalls": 0, "phase": "FAIL", "stderr": "RuntimeError: 候选漂移: candidate/control version"}
{"refusal": "gate", "rawRC": 1, "effectCalls": 0, "phase": "FAIL", "stderr": "RuntimeError: 缺门: current attributable evidence unavailable"}
```

## 原边界和保留门执行trace

以下为原源码 guard/predicate AST 的实际执行；STATIC_ADJACENCY 是静态邻接核对，不伪称已执行其后真实生产效果。BOOTOUT/BOOTSTRAP另执行真实helper分支且外部调用有计数拒绝桩。内部 installer/settlement/递归复制自身逐写仍UNKNOWN，故其dispatch拒绝。

```jsonl
{"boundary": "mutex.mkdir", "source": "window_helper.py", "line": 14, "STATIC_ADJACENCY": "lock.mkdir(mode=448) | mutex_acquired() | holder = 'pid=%s\\nuid=%s\\ncmd=window-executor-v5.sh\\nwindow=%s\\nstarted=%s\\n' % (args[0], a['writer_uid'], a['window_id'], now())", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "0462b1ae71a81e7ad5424cdf75febe3cbcd320aac390e1aef55b758e66f0029c", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "mutex.holder.write", "source": "window_helper.py", "line": 18, "STATIC_ADJACENCY": "(lock / 'holder').write_text(holder) | effect_guard('mutex.holder.chmod', str(lock / 'holder'), {'mode': 384}) | os.chmod(lock / 'holder', 384)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "8242df11d6e5d2498f090f69d0bfbad332be14ec65f341e6cb2f081ff1922a28", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "mutex.holder.chmod", "source": "window_helper.py", "line": 20, "STATIC_ADJACENCY": "os.chmod(lock / 'holder', 384) | save('mutex.json', {'path': str(lock), 'holder': holder, 'sha256': digest(lock / 'holder'), 'identity': list((lock.stat().st_dev, lock.stat().st_ino, lock.stat().st_uid))}) | authority()", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "ca492909abd7e0393a7b801ab3202de28ba762890dcdd6b9493e36d3c9deff66", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "staging.mktemp", "source": "window_helper.py", "line": 32, "STATIC_ADJACENCY": "b = P(run(argv).stdout.decode().strip()) | for src, dst, flags in ((inp / 'window-installer', b / 'scripts', ['-RP']), (inp / 'payload', b / 'payload', ['-RP']), (inp / 'WINDOW_INPUTS.sha256', b / 'WINDOW_INPUTS.sha256', [])):\n    argv = ['/bin/cp', *flags, str(src), str(dst)]\n    effect_guard('stag", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "be1ab0f2cc9c248429de7dae26a9e6fc228f97d4281e25a5ec77bf952af6139c", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "staging.copy", "source": "window_helper.py", "line": 38, "STATIC_ADJACENCY": "run(argv)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "7633c07ff0c709934d82777331a3a3cc57540022268ebf84ec6622a163dc1a85", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "staging.chown", "source": "window_helper.py", "line": 42, "STATIC_ADJACENCY": "run(argv)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "249f076fa244f9b31ba313d82a847bbbd9873151cd99a8108aa163119bb9cada", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "staging.chmod", "source": "window_helper.py", "line": 42, "STATIC_ADJACENCY": "run(argv)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "40f1b3a45dbbd5b8011fd32cde0d6099b37810934b6e8fc6b8eff2ca98fb96bd", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "runtime.bootout", "source": "window_helper.py", "line": 51, "STATIC_ADJACENCY": "save('bootout-invocation.json', {'at': now(), 'argv': argv, 'result': 'UNKNOWN'}) | run(argv)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "8df05c04c226a5d4deb1e46df6f11dc14476d500ec3c894486daf6001238c45b", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "runtime.bootstrap", "source": "window_helper.py", "line": 60, "STATIC_ADJACENCY": "save('bootstrap-invocation.json', {'at': now(), 'argv': argv, 'result': 'UNKNOWN'}) | run(argv)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "484d38d0a5c3e476fbca6c8b2bbe810b933b26eb1e705fabf189b80d6ed21365", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "settlement.commit", "source": "window_helper.py", "line": 64, "STATIC_ADJACENCY": "", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "567ea460e45c8b5c32c5ea4be68978291424e386d81bf8ba38e30a5a95c09516", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "installer.execute", "source": "window_helper.py", "line": 67, "STATIC_ADJACENCY": "", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "7ef5dabe255ee8b8066d7b213fe53b80b792f0566df7009cc5f595394c8c5b3a", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "source.backup.mkdir", "source": "window_helper.py", "line": 88, "STATIC_ADJACENCY": "backup.mkdir(mode=448) | for b in data.split(b'\\x00'):\n    if not b:\n        continue\n    name = os.fsdecode(b)\n    if P(name).name != 'pnpm-lock.yaml':\n        continue\n    p = source / name\n    regular(p)\n    require(p.resolve().is_relative_to(source), 'lockfile escapes authorized source')\n    dst", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "8301d433079c99080ce4a3c93c5919fd2d0cd8853c87d60fde0cf4ab8aff558c", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "source.copy2", "source": "window_helper.py", "line": 102, "STATIC_ADJACENCY": "shutil.copy2(p, dst) | h = digest(p) | require(digest(dst) == h, 'lockfile backup mismatch')", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "5737747ea0b571aac48ee3550b624d7577d3df969dd4d2917fa992b1daf33a92", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "source.unlink", "source": "window_helper.py", "line": 110, "STATIC_ADJACENCY": "p.unlink()", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "07e08dfc22981bedf2c96bdf3e8805b68b7884baa8a1be1e2ee0aa392ad7a6d6", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "source.backup.mkdir", "source": "window_helper.py", "line": 100, "STATIC_ADJACENCY": "parent.mkdir(mode=448)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "b20c9612da7e5c41a2a0848ef7c001140d2da9945727547b60c2a26efd3adfb9", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "preimage.ditto", "source": "window_helper.py", "line": 227, "STATIC_ADJACENCY": "run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', live, target], timeout=3600) | reconcile_xattrs(live, target, before[XATTRS_KEY]) | require(inventory(target) == before and inventory(live) == before, 'full preimage copy differs')", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "1391117cd946b294bdbe265b75fff4f0318fe7184ad91b524fe0fbcf5751592e", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "config.ditto", "source": "window_helper.py", "line": 308, "STATIC_ADJACENCY": "run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', src, dst], timeout=3600) | carried.append(k)", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "UNKNOWN", "inputSha256": "1e902e0ad0fbf6ceba297aa39774a2ee5de34861809471dc79dbc1293113e995", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "plist.create", "source": "window_helper.py", "line": 353, "STATIC_ADJACENCY": "with open(tmp, 'xb', buffering=0) as f:\n    effect_guard('plist.write', str(tmp), {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})\n    require(f.write(data) == len(data), 'incomplete plist write; no retry') | m = old['metadata'] | effect_guard('plist.chown', str(tmp), {'uid': m['uid", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "1bf2b350bdb92926d52a7bbace4afc5d83506974fe32e4eb1a3ddf7f9b450ccd", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "plist.chown", "source": "window_helper.py", "line": 358, "STATIC_ADJACENCY": "os.chown(tmp, m['uid'], m['gid']) | effect_guard('plist.chmod', str(tmp), {'mode': int(m['mode'], 8)}) | os.chmod(tmp, int(m['mode'], 8))", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "459239a9eb832b2b847bf35dbf6de13dc42bc73f9bdf72b696733853632ef1ac", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "plist.chmod", "source": "window_helper.py", "line": 360, "STATIC_ADJACENCY": "os.chmod(tmp, int(m['mode'], 8)) | run(['/usr/bin/plutil', '-lint', tmp]) | effect_guard('plist.replace', str(plist), {'source': str(tmp)})", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "6a88f4d9c96e73c01719d0326aff31b86d2b07b4f970c510c56af9857e5ed211", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "plist.replace", "source": "window_helper.py", "line": 363, "STATIC_ADJACENCY": "os.replace(tmp, plist) | back = plistlib.loads(plist.read_bytes()) | expected = old['document']", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "e3db26e98779d060f72ddefccb8fa6f8e00445f0b0b0e4bbdad50c3c1e213ea5", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "plist.write", "source": "window_helper.py", "line": 355, "STATIC_ADJACENCY": "require(f.write(data) == len(data), 'incomplete plist write; no retry')", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "84c8583a3b4948772d91593de5dc500e28913a789670c4c0abd7d113fc33ba1a", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "window.close", "source": "window_helper.py", "line": 431, "STATIC_ADJACENCY": "verified = read(rd / 'stage_11_production_verify.json') | require(verified['status'] == 'PASS', 'production verification did not PASS; no close plan') | result = close_window(a, read(rd / 'c7-names-before.json'), live, verified['at'])", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "a71424461138e4559dc2935d0cba09016ccbb9d61e48a5b3488cb36f873c81d3", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "mutex.release", "source": "window_helper.py", "line": 445, "STATIC_ADJACENCY": "effect_guard('mutex.holder.unlink', str(lock / 'holder')) | (lock / 'holder').unlink() | effect_guard('mutex.rmdir', str(lock))", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "9b3db2fc72cfa76f075462a6ed26b05ffffa77252783217bdbcc19c55dfe84fa", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "mutex.holder.unlink", "source": "window_helper.py", "line": 446, "STATIC_ADJACENCY": "(lock / 'holder').unlink() | effect_guard('mutex.rmdir', str(lock)) | lock.rmdir()", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "13abecb5672c2fad6165636fa54a5cd0b88a0b2838f3f33ab13273db62646bb8", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "mutex.rmdir", "source": "window_helper.py", "line": 448, "STATIC_ADJACENCY": "lock.rmdir() | save('completion.json', {'at': now(), 'window': 'PASS_CONFIGURED_CHECKS', 'productionExecution': 'EXECUTED', 'authentication': 'NOT_TESTED', 'businessSuccess': 'UNKNOWN', 'hrCriterion': 'broker execute observed', 'c7ReceiptSha256': digest(rd / 'c7-close.json'), 'retentionDeletion': 'N", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "fd8c7bec99b311164fd2ecf181b639dfbd16734787631462361ddfad2b35a5fb", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"boundary": "xattr.write", "source": "window_preimage_xattr.py", "line": 108, "STATIC_ADJACENCY": "run(['/usr/bin/xattr', '-s', '-w', name, '', path]) | print('EMPTY_XATTR_REAPPLIED ' + json.dumps({'path': str(path), 'attribute': name}, sort_keys=True))", "EXECUTED_GUARD": "REFUSED", "targetCalls": 0, "internalPerWrite": "NOT_A_CHILD", "inputSha256": "92c6d4fb3494cf60d045e971a48dda91a06f36ba34b624c9bceff67dca030b0d", "selector": "$.appointments[id=appointment-1]", "query": {"epoch": 1, "revision": "registry-r1", "at": "2026-11-09T11:59:59Z", "leaseUntil": "2026-11-09T12:04:59Z", "complete": true, "pagesRead": 2, "pagesTotal": 2}}
{"retainedGate": "dirty source/Harness", "sourceLine": 122, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "source coordinates changed", "sourceLine": 123, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "source coordinates changed", "sourceLine": 123, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "Harness stamp differs", "sourceLine": 124, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "bundle file membership differs", "sourceLine": 155, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "accepted candidate/r2 file membership changed", "sourceLine": 161, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "accepted symlink bindings changed", "sourceLine": 165, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "fresh-child canary not PASS", "sourceLine": 167, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "full runtime not PASS", "sourceLine": 170, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "dual candidate binding differs", "sourceLine": 172, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "final closure differs", "sourceLine": 338, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
{"retainedGate": "final provenance mismatch", "sourceLine": 340, "EXECUTED_ORIGINAL_PREDICATE": "REFUSED", "targetCalls": 0}
```

## 其他实测与独立复核

- `python3 -B scripts/fleet-window/authority_validation/tests/test_xattrfix_r3.py` → rawRC0，`Ran 18 tests` / `OK`；真实临时树/xattr机制、consumer拒绝、未受影响AST/close、CLI干跑与语法。只写独立临时目录，xattr机制注入可计数边界桩，真实授权guard由ACC另核。
- `python3 -B scripts/fleet-window/authority_validation/tests/check_error_exit.py` → rawRC0；12case / 96 assertion groups；六类×正常phase/phase诊断写失败，原rc1、targetCalls=0、sudoCalls=0，诊断失败rc73不反转原拒绝。
- `bash -n scripts/fleet-window/window-executor-v5.sh` / `git diff --check` → rc0；15个受影响代码文件 AST/物理行数核验PASS；`python3 .agents/tools/verify_governance.py --target . --require-accepted` → rc0。
- 原 `--selftest` 的受影响纯函数提取已单独执行：10个函数绑定、旧字段正例与新完整authority预期拒绝通过；带真实isolated canary的整套入口本次NOT_EXECUTED，未冒充本节纯校验干跑。
- 结构verifier在本base明确为V3资格待单独任务；本次手工核受影响尺寸/目录/深度。单commit后机器verifier的真实rc单列外部交付回执，不把未资格结果写PASS。

非作者 `/root/authority_check` 的受影响合同审查与独立复跑结论：AUTHORITY_REVIEW=PASS / CONTRACT_REVIEW=PASS / ACCEPTANCE_COVERAGE_REVIEW=PASS / EVIDENCE_REVIEWABILITY=PASS；OPEN_BLOCKERS=0；SOURCE_IMPLEMENTATION_REVIEW=PASS；DELIVERY_READY=YES；MERGE_READY=NO；OPERATION_ALLOWED=NO；FINAL_HEAD_RECHECK=PENDING_COMMIT。

冻结blocker union：`FWAV-R1-LIFECYCLE-ROLLBACK`（CTR009）与`FWAV-R1-MUTEX-IDENTITY`（CTR010/012）。前者由ACC010 revision/同revision hash反例关闭；后者由ACC011相同holder字节替换目录inode反例关闭。身份type schema微delta与issuer/C会话对齐已独立复核。最终commit只需receipt/final-Head delta复核，不重跑无关机制。

## 观察与Evidence关系

- `EVD-D1D2-ACC`：root与非作者实际16条执行观察 → CTR001..013本次source/isolated conformance，SUPPORTS；coordinates=上述base/spec/blob/code+fixture manifest/命令/rawRC/UTC；足以证明消费与拒绝机制，不证明生产资格。
- `EVD-D1D2-REGRESSION`：18条临时xattr/consumer测试 → 受影响既有行为保留，SUPPORTS；同候选source hash/命令/原始log；不证明全仓测试或真实canary。
- `EVD-D1D2-ERROR`：12个真实validator+原runner trap观察 → CTR012错误出口/诊断故障安全性，SUPPORTS；原输出、stage、effect、查询/selector/输入hash在补证路径；不证明在飞真实生产child终止。

## 失败历史与修复

测试作者首次ACC014使用了旧B副本runner，误到原`sudo -n /bin/launchctl bootout system "$PLIST"`语句；原文`/usr/bin/sudo: Operation not permitted`、rawRC1。未观察到launchctl执行；当次没有完整效果census，不能把缺trace说成生产全局状态已验证。已保全首次日志、刷新到候选源码并用shell sudo硬拒绝桩隔离，最终root与独立复跑都记录sudoCalls=0。没有真实窗口main --execute，也未完成sudo/launchctl调用。

旧xattr测试首次2FAIL/1ERROR、第二次1FAIL：旧固定基线的字节恒等断言已落后于当前B，以及新增guard使缺授权fixture如约拒绝。按允许面最小适配为当前B基线、真实xattr/consumer验证和明确的新拒绝；未跳过18例。另root一条全目录尺寸检查误纳未改stage06既有1116行，rc1；收窄到本次受影响15文件后PASS，不修改历史债务。

## UNKNOWN与资格边界

| Surface | Result |
|---|---|
| 本次source consumer/拒绝接线 | VERIFIED，绑定本回执候选manifest |
| 隔离16验收、18回归、12出口场景 | EXECUTED / PASS，绑定实际命令与输入 |
| 默认原registry reader真实caller/freshness/防回退资格 | UNKNOWN → default deny |
| installer/settlement/复制child内部每写控制 | UNKNOWN → dispatch拒绝，无内部资格PASS |
| 真实appointed actor/caller continuity/控制所有者/生产生效任命 | UNKNOWN，本次不补造、不改台账 |
| source→installed→loaded、实际准入profile/不可旁路证明 | UNKNOWN |
| 完整sealed tuple、G01–G16消费、Δ3–Δ5、旧writer退役 | 本次未闭合 |
| SRA EFFECTIVE/逐窗Mandate/W7/生产业务验收 | NOT_ESTABLISHED / NOT_EXECUTED |
| 生产全局状态、旧UNKNOWN business outcome | 未探测/UNKNOWN，不重放或清fence |

## 原始日志SHA256

| Path | SHA256 |
|---|---|
| /tmp/d1d2-acceptance-root.log | `9ecf8ad9a692c9e04666da16aed46ee8c630879240764d63661df43c2d512c8e` |
| /tmp/d1d2-xattr-root.log | `6d28be59e84b1758fe9d984564b4d811b3b144b06085ae47a9de272414500b28` |
| /tmp/d1d2-error-exit-root.log | `39791940b01ee8ab055ce1e7ac2ce7cac9eb8fcaa3d41da38563eca1cfb6cc91` |
| /tmp/d1d2-acceptance-reviewer.log | `d80a430fa3937d2ab86c4fa728cf6049348154d24b0fde7e3f31ba0942c35a17` |
| /tmp/d1d2-xattr-reviewer.log | `01c52805852c944f24c83157fd43a858ebfdbca89fe595b1c8cbc935fe2d737e` |
| /tmp/d1d2-error-exit-reviewer.log | `9bbe27dd8d1992babc3753c63681dce6846c065afae29a1071796d2329b36ec0` |
| /tmp/d1d2-acceptance-tests/acceptance-first.log | `2ce07fb997b35538cada849819937511a4aa41cc9b112ebe209158abee6b7d4c` |
| /tmp/d1d2-acceptance-tests/xattr-first.log | `353505c3e28c4f026593e276f31f77c7ba9f21ec1df2f7c23805a752362827cc` |
| /tmp/d1d2-acceptance-tests/xattr-second.log | `a9b7df6c17c956d7366945a26eda32b4840bf015270b20bac3790155e4b88cba` |

交付动作尚未发生于本回执生成时刻：随后只提交这一候选树、一次push；失败按简报不重试，以bundle+push.log和外部传输回执交接，不合并。单commit OID、push原文rc、bundle路径/hash及最终Head delta复核随外部交付记录绑定。
