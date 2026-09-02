# AGENT_CORE_MEMORY_SIGTRAP_FIX_V1 (TASK_NAME = 崩溃 执行)

- date: 2026-09-02
- type: production bug fix (codec symmetry + bounded guard + corrupted-memory migration) — GOAL_DRIVEN_PRODUCTION_FIX
- production change this round: **agent-memory surface ONLY** (`/usr/local/libexec/agent-core/app/packages/agent-memory/src/memory.js` 替换 + 四个指定 MEMORY.md 原地修复)；其余零变更

## 0. 结论（TL;DR）

```
ROOT_CAUSE_CONFIRMED = YES   (dispatch 前已机械确认; 本轮 census 再次印证)
CODEC_FIX            = PASS  (source 渲染 escape / 解析 strict-inverse decode; parse(render(e))==e; render(parse(render(e))) 字节 fixpoint)
SIZE_GUARD           = PASS  (MEMORY_GUARD: 每次 String.replace 前有界校验, FAIL_LOUD_BUT_NON_FATAL)
ROUND_TRIP_100X      = PASS  (内存与真实磁盘各 100 循环: SOURCE_LENGTH_GROWTH=0, 文件字节不变)
PATHOLOGICAL_FIXTURE = PASS  (标定: 旧 codec 在 2^26 字符 source 区 SIGTRAP(rc=133); 新代码同 fixture 结构化拒绝、进程存活)
HR_MEMORY_REPAIRED     = YES (134,394,733B -> 41,365B, 10 行重写)
EFFICIENCY_MEMORY_REPAIRED = YES (89,194,752B -> 37,926B, 9 行重写)
SHOPPING_MEMORY_REPAIRED   = YES (69,271,612B -> 57,416B, 3 行重写)
CEO_MEMORY_REPAIRED        = YES (50,382,793B -> 51,151B, 1 行重写)
MEMORY_DATA_LOSS     = NO    (逐 entry: 条目数/id 序/标题/内容/tags/importance/updatedAt 全等; source 唯一恢复, 0 歧义)
REPEATED_ESCAPE_GROWTH = 0
AGENT_PROCESS_SURVIVES = YES (runtime 新 pid 75917 running; 部署后子进程按需重生)
NEW_MEMORY_SIGTRAP   = 0
RUNTIME_HEALTH       = PASS
AGENT_MEMORY_SIGTRAP_FIXED = YES
CORRUPTED_MEMORY_REPAIRED  = YES
AFFECTED_AGENTS_SAFE       = YES
GOAL_STATUS = COMPLETED
```

## 1. 根因与缺陷机制（确认事实，非本轮调查产物）

`writeEntries → renderEntries → renderEntry → esc(entry.source) → String.replace`；
`parseEntries()` 对 title/tags 做了 `unescape`，**唯独 source 不做 inverse decode**。
ESCAPE 字符集含 `\`，因此 esc 对自身放大（esc^k 长度 ~2x/轮）：每次 read-modify-write
（turn 末 debounce consolidation 写整文件）都让所有旧 entry 的 source 再多一层，
直到 V8 replacement builder 触发不可捕获的 V8_Fatal → SIGTRAP。标定（node v26.7.0）：
source 2^25 字符渲染存活（输出 2^26），2^26 字符渲染即 SIGTRAP；四个生产文件的
最大 source 恰停在 2^26+49 —— 与机制完全吻合。独立 Reviewer 用自有探针复核：
exit 133，V8 fatal "invalid size error 218103808"，栈
`CompiledReplacement::Apply → ReplacementStringBuilder → FixedArrayBuilder::EnsureCapacity → V8_Fatal`。

## 2. census（四个隔离副本，只读，机械测量）

| agent | workspace (import map 权威: `~/.agent-core/primary-workspaces.json`) | 原始 bytes | entries | 放大 source 数 | 最大层数 | 恢复候选（唯一） |
|---|---|---|---|---|---|---|
| agt_hr-agent | `workspace-oc_a5e904…` | 134,394,733 | 106 | 10 | 25 | 17–51 字符，全部无反斜杠 |
| agt_efficiency-agent | `workspace-oc_c6fa97…` | 89,194,752 | 76 | 9 | 25 | 同上 |
| agt_shopping-list-agent | `workspace-oc_96ba3f…` | 69,271,612 | 137 | 3 | 25 | 同上 |
| agt_ceo-agent | `workspace-oc_3ce9cb…` | 50,382,793 | 112 | 1 | 24 | `2026-08-24/25 老板拍板 + 执行验证`（25 字符） |

恢复语义（冻结在 memory.js 注释）：stored = esc^k(original)；maximal unwrap 至
非 canonical 态即为 original（非 canonical ⇒ 必非 esc(任何串)）；无 `\`+ESCAPE 对的
fixpoint 态 k=0。所有字节层假设在去反斜杠投影上**完全一致** ⇒ LOGICAL_CONTENT
恢复唯一；backslash 摆放按声明的 writer-prior 取最深 unwrap，候选仍含反斜杠对或
unwrap 触界才标 ambiguous（本 corpus 为 0）。raw evidence 由不可变备份全量保留。

## 3. 修复内容（governing: docs/decisions/MEMORY_V1.md accepted 不变量内，SPEC_DELTA=NONE）

Worktree：`/Users/yanfenma/workspace/project/dsh-agent-core-sigtrap-v1`（base 840d2f4 = origin/main，
branch `agent-memory-sigtrap-fix-v1`，HEAD `c21c8f3`，tree `747b3a47…`）。

- **CODEC_FIX**（`packages/agent-memory/src/memory.js`）：`- **Source**:` 行解析执行
  strict inverse decode（`stored = esc(value)` 合同冻结）；title/tags/content 原有对称性不动。
- **MEMORY_GUARD**：`esc/unescape` 每次 `.replace` 前先做有界校验
  （field raw ≤8192、**stored ≤8192**、content ≤65536、tags ≤64 且 joined line ≤8192、
  文件 load ≤32MiB（stat 先于 read）、renderEntries 严格上界含 id/updatedAt），
  超限抛 `MemoryGuardError(code=MEMORY_GUARD_LIMIT)`——先于任何 replace/IO，
  原 MEMORY.md 永不被触碰、零半写。超过 32MiB 的损坏文件在 load 与 write 两侧都被
  冻结（拒绝即无写者），使后续迁移天然无竞态。FAIL_LOUD_BUT_NON_FATAL 全调用点成立：
  consolidation 先写 daily note 再 load（证据永不丢）、注入 catch 降级空块、
  memory_* 工具错误进入 dsh-tools 的 tool-error 结果（turn 结果不丢）。
- **writeEntries 加固**：mode/uid/gid 随写携带（chown root 侧才生效）、chmod/chown 先于
  fsync、文件 fsync → rename → 目录 fsync、失败清理 tmp。
- **recoverSource/isEscapeCanonical/escapeFieldValue**：恢复算法即 codec 公开面，
  迁移工具与 runtime 共用同一实现（零漂移）。
- **迁移工具**（`scripts/agent-memory-sigtrap-migration-v1.mjs`，r2 sha256 `0c0945bb…`）：
  默认 dry-run；`--apply` 时 不可变时间戳备份(copyFile+fsync+chmod0400+sha256 sidecar)
  → preimage sha 门 → 同目录 tmp+fsync（带原 mode/uid/gid）→ 原子 rename → 目录 fsync
  → 安装后校验（生产限额 parse + 字节 render fixpoint）；preimage 门失败 = 并发写者
  存在，**原样不动退出 2**（绝不以分析时前像覆盖他人更新）；rename 后任何失败 =
  以 sha 双重校验的备份字节精确还原。只重写放大过的 `- **Source**:` 行，
  其余字节原样（非 source 内容按构造不可丢失，且逐 entry 等值校验兜底）。

独立审计两轮：**AUDIT_PASS (r1, REQUIRED_FIXES=none) → 三项建议全部采纳 →
RE_AUDIT_PASS (r2, 无阻塞问题)**（结论存于 evidence/audit-r{1,2}-verdict.txt）。

## 4. 测试（83/83 PASS，含 41 个既有测试零回归）

- codec：全 ESCAPE 字符集 source round-trip；mixed sources（普通/路径/URL/字面反斜杠/
  连续反斜杠/Markdown/Unicode/空）；**legacy 放大文件在修复后 codec 下读=写字节稳定**
  （放大环路即使在未迁移文件上也已断裂）；100x 内存循环 + 100x 真实磁盘
  writeEntries/loadEntries：SOURCE_LENGTH_GROWTH=0。
- guard：超限字段/内容/tags 行/文档上界（含 40M id/updatedAt）在 replace 前拒绝；
  33MiB 文件 load 拒绝；32MiB 以下损坏文件 decoded-field 拒绝；
  consolidate() 拒绝时 daily note 已落、MEMORY.md 原样、零 tmp 残留；注入降级空块。
- pathological（子进程标定回归）：旧算法 2^26 fixture SIGTRAP（断言非干净退出）、
  2^25 存活（标定 sanity）；新代码同 fixture `MEMORY_GUARD_LIMIT` 拒绝、进程存活(rc=0)、
  文件字节不动、无 tmp；中等规模（<32MiB）损坏文件 decoded-field 拒绝且存活。
- migration CLI：dry-run 纯度/重写 census/报告；apply 只改放大行 + 0400 备份 + sha
  sidecar + 元数据保持(0640) + 安装后 fixpoint；幂等重跑；格式噪声文件拒绝(exit 2,
  零变更)；usage 缺参拒绝。

## 5. 沙盒演习（四个真实文件的隔离副本，全 PASS）

backup(sha==preimage) → apply → shrink/mode 保持 → **100x 真实磁盘 writeEntries
循环字节幂等** → 回滚演练（备份字节精确还原，sha==preimage）→ 重跑幂等。
迁移输出对 r2 修订版代码**字节不变**（ceo 复验 sha `bd3a866b…` 相等）。
日志：`evidence/migration-drill.txt`。

## 6. 生产部署（Phase 7，Owner 亲自执行）

首次 osascript 对话框路径因 Owner 不在机前中止（零变更），改由 Owner 在自己终端
执行两段脚本完成，全部步骤 sha 门禁 + 逐步校验：

1. `sudo …/root-step.rendered.sh`：preimage `239cd5ed…` OK → `install -m0644 -o root -g wheel`
   → installed sha `99d59bde…` OK (27874B, root:wheel 0644) → `launchctl kickstart -k
   system/ai.agent-core.runtime` OK（old_pid=86800）→ `ROOT_STEP_ALL_DONE`。
2. `bash …/post-root-steps.sh`：P3a installed==audited OK；P3b **new_pid=75917 running** OK；
   P4 四文件 APPLIED（10/9/3/1 行重写，各带 `…pre-sigtrapfix-v1-<UTC>` 0400 备份 +
   sha sidecar），post-validate PASS；P5 POSTVERIFY_ALL_PASS（四文件
   parse/render/repeated-render PASS、maxSource ≤51、隔离副本 writeEntries PASS）；
   P6 NEW_MEMORY_SIGTRAP=0。

生产后状态：runtime pid 75917 last-exit 0；四文件
41,365/37,926/57,416/51,151 字节（与沙盒演习**逐字节同 sha**：`da831a34…`/`fbf1e471…`/
`c9a20704…`/`bd3a866b…`）、mode 0644 uid 502 保持、零 tmp 残留。

## 7. 边界（BOUNDARIES）

- 部署只改 agent-memory surface 与四个指定 MEMORY.md；**未**改 model route/OAuth/
  Permission Model A/workflow authority/Grant/allowlist/session history/其他 package。
- 四个 MEMORY.md 属主为 yanfenma，迁移以用户身份执行（无需提权）；提权仅用于
  memory.js 安装与 runtime 重启，由 Owner 亲手执行。
- 未重放 Shopping 原业务 turn；未清空/截断任何文件；损坏 source 未被"删除"——
  唯一恢复候选写回一层 esc 形态，raw 全文保留于 0400 不可变备份。
- repo 变更 docs-only 提交（本报告 + evidence 目录，显式 pathspec）；既有 WIP 未动。
- Phase 0 决策：不存在"经过验证的 per-agent memory 停写开关"（agents.json 条目仅
  {id,name,description,disabled}，插件配置在共享 profile patch 层，无 per-agent 覆盖面，
  且任何改法都需要与真修复相同的生产事务+重启）→ 按 dispatch 规则直接进入代码 guard 修复。

## 8. 完成定义对照

见 §0 全部旗标。canary 观察与证据归档见 `docs/evidence/agent-core-memory-sigtrap-fix-v1-20260902/`。
