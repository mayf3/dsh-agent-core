# release-packet — 单命令生成并验证发布包（issue #567 Phase 1）

一条命令从**唯一源 + 固定配置**生成发布包，并完成递归完整性校验与路径引用闭合校验，
输出机器可读 receipt。复用既有打包机制（`assemble_current_inputs` 的
git-archive 具体化 / 逐字节重钉 / 确定性归档语义，`release-package.mjs` 的
"先整体校验、失败不落盘"原则），把它们泛化为配置驱动，不再每次手写一次性脚本。

```bash
# 生成 + 校验（一条命令完成；receipt 默认写在包旁边）
python3 scripts/lib/deployment-reuse/release-packet/release_packet.py build --config release.config.json

# 对既有包独立复核（发布前；可叠加外部锚点）
python3 scripts/lib/deployment-reuse/release-packet/release_packet.py verify --package out/packet \
    --config release.config.json [--expect-top-seal <记录在包外的顶层 SEAL 摘要>]
```

仅依赖 Python 3.8+ 标准库（部署机 `/usr/bin/python3` 可直接运行）。退出码：
`0` = PASS / DEGRADED；`1` = BLOCKED（必要完整性失败）；`2` = 配置或用法拒绝。

## 配置（唯一需要审阅的输入）

`schema: RELEASE_PACKET_CONFIG_V1`；相对路径以 config 文件所在目录为基准。
工具内不写死任何 Agent、日期、主机、业务或事故信息——全部来自 config：

```jsonc
{
  "schema": "RELEASE_PACKET_CONFIG_V1",
  "packet": { "kind": "<包类型标签>", "root": "out/packet" },
  "source": { "repo": "<git 仓库>", "commit": "<40/64 位十六进制 Git OID>", "tree": "<可选>",
               "requireClean": true },
  "layers": [                                  // 各层：清单+SEAL 自动生成
    { "name": "operation-source", "dir": "operation-source",
      "build": { "type": "git-archive", "prefix": "app-src/",
                 "overlays": [{ "path": "app-src/x.mjs", "from": "overlays/x.mjs" }],
                 "contentList": "app-src/SOURCE-CONTENT.sha256" } },
    { "name": "stage", "dir": "stage",
      "build": { "type": "inline-files", "files": [{ "path": "t.py", "from": "stage/t.py" }] } }
  ],
  "artifacts": [                               // 归档：确定性 tar.gz / 逐字节冻结副本
    { "name": "artifacts/app.tar.gz", "type": "tar-gz", "fromLayerDir": "operation-source" },
    { "name": "artifacts/frozen.bin", "type": "copy", "from": "frozen/frozen.bin",
      "expectSha256": "<可选，漂移即拒绝>" }
  ],
  "commandFiles": [{ "path": "COMMANDS.txt",   // 命令路径自动重绑
    "entries": [{ "label": "INSTALL (not executed)",
                  "command": "/usr/bin/python3 -I -B {packet_root}/stage/t.py" }] }],
  "referenceFiles": [                          // 引用闭合扫描；blocking 可按文件声明
    { "path": "COMMANDS.txt", "blocking": true },
    { "path": "docs/HANDOFF.md", "blocking": false }],
  "pinFiles": [{ "path": "PINS.json", "bindings": [
      { "pointer": "/appArchiveSha256", "target": "artifacts/app.tar.gz" },
      { "pointer": "/appArchive", "targetPointer": "/appArchive" },   // 构建时重绑到本包根
      { "forEach": "/toolPins", "paths": ["stage/t.py"],
        "pathKey": "path", "digestKey": "sha256", "bytesKey": "bytes" } ] }],
  "externalReferenceAllowlist": ["/usr/bin/", "/bin/"],  // 受校验的固定外部引用
  "baseline": { "process": "...", "stepsMeasured": 14, "elapsedMeasured": "38m" }
}
```

## 包结构（分层清单 + SEAL，自底向上）

- 每层目录：`MANIFEST.sha256`（层内全部文件，sha256sum -c 兼容格式，逐字节实测）
  + `SEAL.json`（绑定层清单字节摘要与条目数）。
- 顶层：`MANIFEST.sha256` 覆盖包括各层清单与 SEAL 在内的全部文件；`SEAL.json`
  绑定顶层清单，并带 `productionExecuted: false`。
- 校验自底向上：层文件被改 → 层清单失配；层清单/SEAL 被换 → 顶层清单失配；
  **内层摘要过期不会因顶层重新生成而被 PASS 遮蔽**。
- 包内任何位置的**目录 symlink 一律拒绝**（`SYMLINK_IN_PACKET` 结构化发现）：
  封装后塞入的链接目录对清单不可见，不拒绝即等于可夹带未清点内容。
- pin 文档中每条 `sha256` 与其 `path` 指向的实际字节比对；pin target 必须是
  包内相对安全路径（绝对路径或 `..` 逃逸在构建期即拒绝）；引用闭合要求每个
  绝对路径引用要么落在包内且存在，要么命中允许列表——旧 task 路径、断链、
  归档改名都会被精确定位。

## receipt（机器可读）

`RELEASE_PACKET_RECEIPT_V1`：源身份（commit/tree/实测 clean）、config 摘要、
各层与顶层摘要、每条检查的状态（PASS/FAIL/UNKNOWN/NOT_RUN + blocking）、
聚合状态（PASS / DEGRADED / BLOCKED）、退出码、耗时。摘要全部来自本次实际字节。
`productionExecuted` 恒为 false——本工具不安装、不执行生产、不代替业务验收。

## 语义约定

- **阻断 vs 降级**：必要完整性（清单/SEAL/pin/命令引用闭合）为 blocking，失败即
  BLOCKED 非零退出；按文件声明的非关键检查失败 → DEGRADED，receipt 列出降级
  范围，不全局停摆、也不改写为 PASS。
- **UNKNOWN/NOT_RUN 不遮蔽**：包缺失时全部检查记 NOT_RUN；清单/SEAL 文件缺失
  或损坏、遍历被拒（如 symlink）都是结构化发现（`MANIFEST_ABSENT` /
  `MANIFEST_MALFORMED` / `SYMLINK_IN_PACKET` 等），校验器照常产出 receipt，
  绝不以 traceback 中断；声明了 baseline 但无实测 → 记 UNKNOWN；任何非 PASS
  都阻止顶层纯 PASS。无历史人工流程测量时不要编造节省比例，留空 baseline 即可。
- **修复 = 重建**：包内出现失配时，用同一命令、同一唯一源重新 `build`
  （`--rebuild-existing`）即自动重钉全部 pins/清单/命令路径并复验；重建在旁路
  staging 目录完成、成功后才换入——**重建失败时旧包逐字节原样保留**（外部锚点
  仍可验证），不存在"原地改文档补 PASS"，也不存在"重建失败丢掉最后一个好包"。
- **外部锚点**：包可被完整自洽地伪造（改字节+重生成全部清单与 SEAL），因此
  顶层 `SEAL.json` 的字节摘要（即 receipt 的 `topSealSha256`）应记录在包外
  （工单/评审/`--expect-top-seal`），复核时比对；`--expect-top-seal` 接受的
  正是该值。
- **位置绑定**：pins/命令记录包绝对路径；移动包目录后请重建（即自动重绑）。

## 测试

```bash
python3 scripts/lib/deployment-reuse/release-packet/test_release_packet.py
python3 scripts/lib/deployment-reuse/release-packet/test_release_packet_review_fixes.py
```

共 38 个用例（23 + 15，stdlib unittest，合成 fixture；python 3.9 与 3.14 双跑通过）。

`test_release_packet.py`（23）：正常包 build+verify 与确定性重建、CLI 单命令、
旧 task 路径注入、断链引用、允许列表外部引用、内层过期摘要+顶层重生成不遮蔽、
pin 失配、包内私添文件、归档名配置错误（发布前失败）、归档事后改名、非关键
失败降级不阻断、baseline 缺测记 UNKNOWN、同命令重建修复、外部锚点拒绝完全
伪造、包根安全/源不洁/源漂移/冻结制品漂移拒绝、换业务换路径的通用配置免改
核心代码。

`test_release_packet_review_fixes.py`（15，PR review 6×P1+1×P2 的逐项回归）：
40 位 SHA-1 OID 配置可通过 CLI 构建（64 位 SHA-256 同样接受，非十六进制仍拒）、
重建失败旧包逐字节保留且无 staging 残留、重建成功仍修复并绑定最终包根、
封装后塞入的目录 symlink（顶层/层内）被结构化拒绝、receipt 发出的顶层 SEAL
摘要可直接作 `--expect-top-seal` 锚点（重伪造仍被拒）、pin target 绝对/相对
逃逸构建期拒绝、verify 期 unsafe target 结构化失败、顶层/层清单缺失产出
`MANIFEST_ABSENT` 结构化 receipt 而非 traceback、第二个不同结构业务配置全程
CLI 复用零改核心代码。
