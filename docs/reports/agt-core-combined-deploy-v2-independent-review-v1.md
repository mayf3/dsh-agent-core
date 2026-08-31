# AGT_CORE_COMBINED_DEPLOY_V2 — Independent Review V1 (合署 审计)

- **TASK_NAME** = 合署 审计
- **TASK_TYPE** = INDEPENDENT_COMBINED_DEPLOYMENT_REVIEW
- **Date** = 2026-08-31
- **Reviewer** = fresh independent session（无历史上下文）
- **PRODUCTION_CHANGE** = NONE（全程只读：git 读、live 树非 root 哈希、一次只读 `--check`；零 sudo、零写入、零 reload、未执行 `--apply`、未修改 runner）
- Evidence：`docs/evidence/agent-core-combined-deploy-v2-review-20260831/`（8 文件 + MANIFEST sha256 全 OK）

## Reviewed candidate

- RUNNER `/tmp/run-agent-core-combined-deploy-v2.sh`，sha256 `18c1fdc64941f67b1a0fc3a7f03cad48063d9620a9e0b57a837eee8635708944` == 派发值（实测封存；authoring evidence 内副本字节一致）。
- TARGET_MAIN `2392a41d4655ba25ed9e9749fbf8beb0ad1c71b4`（= Forum PR #105 merge commit 本身）。
- BASE 132 files / `9ac84954fefc3d5893b7e5ca7045b2bb7cf0ad7492d121607d2b0659a230f4b1`。
- TARGET 134 files / `865b6569591e361b18ffcde01251c0b2c2ba160818a0738127a2e8a0bcf2a8d6`（完整值，非缩写，实测推导相等）。

## 顶部结论：HEAD_DRIFT（按派发要求 STOP）

Fresh `git fetch github main` 实测：

```
github/main = 1fdf8c361f2010864f686d8310b68a40df5a5184  ≠  TARGET_MAIN 2392a41…
```

main 已前移 3 个 commit（PR #127 `fleet shared Codex auth implementation`，16 files / +856−125，merge `1fdf8c3`）。**本审计按派发规则触发 STOP + HEAD_DRIFT，不授权任何部署路径。** 实测本轮只读 `--check`：runner 在第一道门即拒绝并 rc=2 —— `ERROR: fresh main moved: expected=2392a41… actual=1fdf8c3…; re-audit required`（fail-closed 如设计生效；authoring 时 21:29 的 check 只败在 canary 缺失，其余门全过）。

Drift 定性（全部只读验证，为 Owner 后续决策提供事实，不构成授权）：

- `2392a41` **是**新 main 的 ancestor；PR #125（`1aa8248`）、#126（`4d7ca24`）、#105 impl head（`83165de`）均仍为 ancestor。
- PR #127 **未触及任何 9 个 delta 路径**；9 个 target blob 在 TARGET_COMMIT 的 pin 逐一复验相等（含 `bundle-broker/cordis.patch.yml` = `768ddec…`，新 main 侧同 blob）。
- 但 PR #127 使 live vs 新 main 的漂移从 9 扩大到 **13 个生产文件**（新增 `package.json`、`packages/agent-provisioning/src/index.js`、`packages/agent-router/src/route-chain.js`、`packages/production-runtime/src/compose.js`；`model-overrides.js` main 侧 blob 再变），另有多个 main-only 新文件——全部在本 runner 授权之外，runner 正确拒绝而非顺带部署。任何把这些带上线的行为都需要独立的授权与审计轮。

## Audit 1 — fresh authority：PIN 侧 PASS / HEAD 侧 STOP

- 4 个 governing Spec 在 TARGET_COMMIT 均 `status: accepted`（transition / pagination-V2 / error-preservation / forum-moderation-V2；后三者并 `implementation_authority: contracts`）。
- 三 merge + forum impl head ancestor 检查全 YES（对新 main 实测）。
- 9 个 target blob pin 独立复验 `git rev-parse TARGET_COMMIT:path` 逐一相等（evidence 02）。
- CTR-009 默认 canary 身份 `agt_build-in-public-agent` 出自 accepted transition Spec（行 506），runner 的身份钉住有权威出处。
- **SOURCE_AUTHORITY = PASS_AT_PIN；但 fresh main != pin => HEAD_DRIFT = YES（阻断项）。**

## Audit 2 — live → target closure：PASS（独立复算，非采信作者数字）

- 用 runner 自身算法（find prune `node_modules`/`bundle-*`/`profile-*` + `git hash-object` + LC_ALL=C path 排序）独立复算 live：**132 files / `9ac84954…` 精确相等**，零不可读文件，live root 为真实目录非 symlink，与 authoring census 字节一致。
- TARGET manifest 机械推导：live − 6 个 base OID 行 + 6 个 target OID 行 + 2 个新文件行，path 排序 => **134 files / `865b6569…` 精确相等**，且与 authoring census-target 行集合完全一致（排序键澄清：runner 按 path 排序输出，非按 OID）。
- OID census（live vs TARGET_MAIN 逐文件）：差异恰为 **6 个授权 in-manifest 修改**（live OID == BASE_OIDs pin 逐一相符）+ **3 个 excluded drift**（`model-overrides.js@ea44819a`、`feishu-connector/src/index.js@2e6bd089`、`scheduler-router/src/index.js@b1f55634`，与 runner pins 相符）+ **2 个授权新文件缺失**（forum-moderation.js / error-detail-sanitizer.js）。out-of-manifest `bundle-broker/cordis.patch.yml` live = `b84c6296` == runner base pin。
- **AUTHORIZED_DEPLOYMENT_FILES == 真实 production closure**（6 修改 + 2 新 + 1 bundle config = 9）；live 树内无任何 test 文件（Forum 12-file implementation 的 4 个测试文件未进入生产部署）。

## Audit 3 — combined deployment safety：PASS（静态逐项）

| 项 | 结论 |
|---|---|
| uid 0 gate | `--apply` 首行 `id -u == 0` 否则拒（L831）；runner 全文零 sudo 调用（仅拒绝文案） |
| Owner phrase | 交互 `read` 精确匹配 `APPLY AGENT_CORE_COMBINED_DEPLOY_V1`（L845-847） |
| source commit gate | fresh fetch + `main == TARGET_COMMIT` 严格相等，移动即拒（本轮实测生效） |
| exact source blob pins | apply 前 9 路径 `rev-parse TARGET_COMMIT:path` 逐一对 pin |
| pre-manifest SHA | BASE/TARGET 双合法态 + 任何其他 manifest 拒绝（exit 2 零写） |
| exact file closure | DELTA_PATHS/BASE_OIDS/TARGET_OIDS 9 项 index 对齐（行数实测） |
| breakglass pin | 两种状态下 `model-overrides.js@ea44819a` 均钉住，任何方向漂移拒绝一切写 |
| excluded drift pins | feishu/scheduler-router 两文件同上钉住 |
| symlink/lstat 防护 | live root 非 symlink、delta 路径 regular-file 校验、owner 0:0 / mode 644 预检、fsync `O_NOFOLLOW`、canary config lstat 拒 symlink |
| staging | `mktemp -d` 于 TRUSTED_ROOT；staged blob OID 先验后装 |
| durable backup | `cp -p` + backup 内 hash 复验 + README 溯源 + file/dir/chain fsync |
| fsync | install→fsync(tmp)→rename→fsync(parent) 全写路径（含 rollback 与 ledger/receipt） |
| byte verification | 装前 staged OID、装后全 manifest 重算（TARGET 期望态） |
| atomic install | tmp + `mv -f` rename |
| exactly ONE reload | 成功路径仅一次 `kickstart -k`；RESTART_COUNT 不变量自检；rollback reload 为显式声明的唯一例外 |
| post-manifest SHA | canary 前 / reload 后 / smoke 后各一次 verify_tree TARGET |
| rollback | EXIT/INT/TERM trap → 从 backup 恢复（保 mode/uid/gid）、删新文件、verify BASE |
| rollback reload | 仅当成功路径 reload 已发生（RESTART_COUNT>0）补一次恢复 reload |
| ROLLBACK_INCOMPLETE | 恢复不全 exit 3，lock+backup 保留 |
| durable receipt | receipt JSON 校验 + fsync + ledger 追加 fsync；**commit point** 之后 `APPLY_WRITES=0` 杜绝假 receipt 回滚 |
| rerun NOOP | TARGET 态直接 `APPLY=NOOP_ALREADY_TARGET` exit 0（零写零 reload） |
| no secret output | canary/smoke 只输出汇总行；authorization 仅内存断言 JWT sub；config 字节不打印 |
| intermediate/drift fail-closed | 任何非 BASE/TARGET manifest、SIGKILL 残留 lock、新文件路径已存在 => exit 2 零写 |

静态扫描：`bash -n` OK；网络仅 `127.0.0.1`（4001/8989/8790-health）；`rm` 有界（mktemp manifest、tmp stage、rollback 新文件、自身 stage/lock）；无 eval/ssh/scp/kill/chmod/chown；base64 仅 Node canary 内 JWT 解码。bash 3.2 安全。

## Audit 4 — Workflow post-deploy expectation：PASS（target blob 实测）

- 7 manifests 齐全：`workflow_my_tasks` / `instance_detail` / `submission_history` / `my_domains` / `domain_instances` / `global_instances` 保留 + `workflow_transition` 新增（`git show TARGET_COMMIT:…workflow.js` 逐 id 验证）。
- **`workflow_transition` 是唯一 write manifest**：全文件唯一 `method: 'POST'`（submit，`/internal/v1/workflow-instances/{id}/transitions`，`idempotencyKey: true`，scope `workflow.execute`）；其余 6 个全 GET。
- **`workflow_execute` 不存在**（workflow.js 与 index.js 0 命中）。
- domain/global pagination 后继未被旧 blob 覆盖：target blob 含 limit 1-20 边界、`beforeCreatedAt+beforeId` all-or-none 配对游标、`invalid_pagination`/`invalid_cursor` 错误面（`beforeCreatedAt` 引用 live 6 → target 14）。

## Audit 5 — Forum post-deploy expectation：PASS

- Existing 7 零回归：`my_notifications/read_thread/read_transcript/reply/mark_read/list_threads/search_threads` 全保留，scopes 原样（read/write 分侧不变）。
- Ordinary Agent 新增 5：`create_thread/watch_thread/unwatch_thread/report_content`（`forum.write`）+ `stats`（`forum.read`）；`normalManifests` 恰 5。
- Moderator：`agt_course-community-agent-2` 唯一闭合成员；8-tool pack（pin_or_feature/delete_thread/delete_message/resolve_thread/archive_thread/moderation_queue/handle_report/admin_unread）全部 `[forum.read, forum.write, forum.moderate]`；`resolveForumModeratorRegistration` 对未配置/空/畸形/重复/无 `DSH_AGENT_ID`/非成员全部返回 0 manifests（fail-closed 代码实测）。`DEFAULT_MANIFESTS` 含 workflow 7 + forum 12，**零 moderator 默认注册**（仅 apply() 内闭合清单门追加）。
- `forum.moderate` grant 未供应时 `authorization_denied` 为预期 fail-closed：runner 的 smoke **从不调用** moderator 工具（只证注册面 + bundle 清单），不可能因此回滚 ordinary Forum 部署——设计符合派发要求。
- `cordis.patch.yml` 通过**正式 bundle flow** 生效：它是 bundle-broker patch layer 输入（per-agent profile 构建消费），非手改 per-agent 配置；smoke 实测部署树内该文件 `forumModeratorAgentIds: ['agt_course-community-agent-2']` 精确闭合。
- 附带确认：`error-detail-sanitizer.js` 被 `transport.js` 在全部失败路径接线（CTR-FMC-012 V2 sanitizer），新文件与 transport 新 blob 同批安装、reload 前先过 verify，不存在半装态启动。

## Audit 6 — Canary handling：PENDING

`/tmp/agent-core-workflow-canary-v1.json` **当前不存在**（实测）。非 runner semantic blocker：validator 对 file_missing 输出 `CANARY_PREREQS_READY=NO` 并使 `--check` exit 2 / `--apply` 零写拒绝（authoring fixtures 矩阵 + 本轮 `--check` 实跑双重确认；placeholder/secret/错身份 fixture 均拒）。runner 的 canary 前置校验集（schema/UUID/身份=CTR-009 默认/占位符/密钥正则/dedicated 断言/分页基数）完整且 fail-closed。

若 canary config 后续到位：**只需**追加 (1) config schema/identity/secret/placeholder 校验，(2) SHA pin 记录，(3) runner `--check`——无需重做完整 semantic review。（但见 BLOCKERS：HEAD_DRIFT 未解决前 `--check` 无法到达 PASS。）

## Audit 7 — smoke / rollback semantics：PASS（只审 runner，未执行 production smoke）

Canary（装后、唯一 reload **前**，对已装文件跑，失败则零 reload 回滚）覆盖派发全部要求：7 manifests 可见、transition 可见、**真实 transition canary**（经 gateway POST + 捕获 trusted key）、version +1（V+1 双处断言）、new visit/event（`eventSequence` + `currentNodeVisitId != sourceNodeVisitId`）、same-key replay 幂等（status/content-type/原始字节/解析体四重 byte-equivalent）、control instance `deepEqual` 不变、域分页走查（重复 id/游标环拒绝、终止 null cursor、最少页数/实例数）。

Smoke（reload 后）：workflow 7 可见 + submit POST+idempotent；forum existing 7 + normal 5 注册 + scopes 精确；moderator member=8 / non-member=0 / absent-env=0 / malformed-list fail-closed + bundle 清单精确；可选只读 forum wire smoke（list/search/read，无 mutation）。

诚实注记：canary 会真实变更专用 canary 实例（transition POST）；若该 POST 之后断言失败，文件回滚不撤销该业务变更——fixture 为专用、无业务副作用、标题含 canary（CTR-009 设计内），此处如实记录。

## Final

```
TASK_NAME = 合署 审计
HEAD_DRIFT = YES — github/main=1fdf8c36 ≠ TARGET_MAIN=2392a41（PR #127；STOP 触发；
             runner 实测第一道门拒绝 rc=2；2392a41/#125/#126/#105 均仍 ancestor；
             PR #127 不触 9 delta 路径但使 live-vs-main 漂移扩至 13 生产文件）
SOURCE_AUTHORITY = PASS_AT_PIN（specs accepted；merges ancestor；9 target blobs == reviewed merged blobs）
LIVE_MANIFEST_MATCH = PASS（132/9ac84954 独立复算）
DEPLOYMENT_CLOSURE = PASS（恰 9 文件 = 6 改 + 2 新 + 1 bundle；4 测试文件未入生产）
EXCLUDED_DRIFT_PROTECTED = PASS（3 pins 代码 + census 双确认，任意方向漂移拒绝一切写）

WORKFLOW_PRESERVATION = PASS（7 manifests；transition 唯一 write；无 workflow_execute；
                         pagination 后继在 target blob）
FORUM_NON_REGRESSION = PASS（existing 7 零回归；normal +5 scopes 精确）
MODERATOR_VISIBILITY = PASS（8-tool pack 闭合清单；非成员/无身份/畸形清单 0 注册；
                          grant 未供 = authorization_denied 预期，不触发回滚）

RUNNER_STATIC_REVIEW = PASS
ROLLBACK_READY = YES
SECRET_SAFETY = PASS

CANARY_PREREQ = PENDING（config 未生成；validator fail-closed 已验）
CHECK_MODE = FAIL（本轮实测 rc=2：fresh-main 门 HEAD_DRIFT；
                  authoring 时唯一失败项为 canary file_missing）
BLOCKERS = (1) HEAD_DRIFT — main 前移至 1fdf8c36，需重审/重钉轮（PR #127 引入的
           4+ 新漂移生产文件与 main-only 新文件绝不可搭车）；
           (2) canary config 未生成（PENDING）

READY_FOR_OWNER_SUDO = NO

NEXT_TASK = 非"仅差 canary"情形：(1) canary-prep 完成专用 fixture config；
           (2) HEAD_DRIFT 处置轮 — 对新 head 1fdf8c36 重审并铸造 v3 pin（或按治理流程
           决定回滚/推进 PR #127 面），期间 v2 runner 保持封存不执行；
           (3) 两项就绪后仅追加 canary 校验 + SHA pin + --check，不重做 semantic review。

PRODUCTION_CHANGE = NONE
```
