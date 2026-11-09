# BRIEF-GOV-ALIGN-20261108 — 接受记录对齐（执行已裁定接受事务，非新接受决策）

## 授权链
- Owner `owner-20261108-three-unified` items[1]（PR #664 §3B 正式接受，含"前驱整权退休/索引引用同步/终HEAD复核"）+ 常设授权 §2（Owner已决定范围的引用更新/接受事务修正）§6（已决定语义不因检查失败/修复提交重复请批）。
- 本任务是**忠实修正已发生的接受记录**，使其与裁定文本、Spec 自身接受条款、spec index 三方一致。不是新接受、不是语义变更、不是重新接受。
- 工作面：本 worktree。零生产写入。docs-only。

## 已由监管独立复核确认的缺陷清单（base = 1d5bda0d）
1. `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md`
   - frontmatter `implementation_authority: none` → **`contracts`**（依据：其正文自身条款"正式接受事务须显式改为 contracts、production 保持 none"；index L459 已记录 "implementation contracts (post-acceptance)"；裁定②"accepted-contracts接受事务"）。`production_apply_authority: none` 不变。
   - 正文 ~L45-47 过期提案横幅（"PROPOSED / 零当前实施权 / 零生产权…不能将 none 原样接受后声称已经取得实施权"）→ 改为接受状态注记：已按 owner-20261108-three-unified items[1] 完成 accepted-contracts 接受事务，implementation_authority 已翻正为 contracts，production 仍 none，新 RECOVERY_REFUSAL_TERMINAAL reason 的实施仍以 Svc 配套正式接受为门。不得改动 §1 以下任何语义条款。
2. `docs/specs/AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2.md`
   - 同型修正：frontmatter `implementation_authority: none` → **`contracts`**（production none 不变）；~L14-16 过期横幅（"PROPOSED…未来正式接受须将本候选与 WEC5 显式改为 accepted/contracts…"）→ 接受状态注记（同一裁定依据）。语义条款不动。
3. `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md`
   - L29 过期重复键 `superseded_by: null` 删除（frontmatter 已有 L5 `superseded_by: ...V5`）。
4. `docs/specs/AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1.md`
   - **`implementation_authority: none` 保持不动**（这是裁定#658③限定的正确值——"仅限提案语义, Core整权继任/Svc配套正式接受前不实施新协议"）。仅修 ~L20 过期注记"尚未合 main"→ 已合 main（PR #658，merge `b6ddc2a6`），限定接受边界不变。
5. 前驱记录一致性核查（只改 status/superseded 类字段，不动语义）：
   - `AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md`、WAE V3、Recovery Liveness V1 的 frontmatter 是否已正确标记被 PPR V2 整体继任（superseded / superseded_by）；缺失或过期则补齐对齐。
6. `docs/specs/README.md` spec index
   - L398 WEC V4 条目过期（"accepted transaction; main activation pending PR #655 merge"）→ 更新为 superseded by WEC V5（accepted 2026-11-08, PR #664）。
   - 核对 V5 / PPR V2 / RTH V1 / 前驱各条目描述与修正后文件 frontmatter 一致。
7. 互惠链接核查：superseded_by ↔ supersedes 双向一致（V4↔V5、PPR V1/WAE V3/Liveness V1↔PPR V2）。

## 硬边界
- 不改任何 Spec 的语义条款正文（§1 以下）；不改 acceptance_authority* 字段；不新增接受；RTH V1 权限字段不动；不实施任何产品代码；不合并；零生产写入。
- 改后每份 frontmatter 必须无重复键、YAML 可解析。

## 完成定义
1. 全部修改以独立 commit 落在分支 `docs/gov-record-alignment-20261108`；
2. 验证：改动文件 frontmatter 重复键扫描 rc0 + YAML 解析 rc0 + `git diff --check` rc0 + index 与文件一致性核对清单；
3. 写 `ALIGNMENT-REPORT-20261108.md`（每文件逐条 diff 说明 + 验证输出原文 + base/head SHA）；
4. commit → push → PR(base main)，**不合并**。
5. 失败即停写 `STOPPED-GOV-ALIGN.md`，不修依赖、不扩大范围。
