# R4 步3 — PPR 语义准备

用户 R4 与 R3 Brief 授权 #655→#657→#658 严格串行接受事务，每步 commit/push/停顿，
不自行合 PR；网络瞬断重试一次仍失败即停。路线 SUPERSEDE / BRIEF / CONTROLLED，
AUTHORITY_AUTHORING，docs-first；本次零源码/配置/产品测试/生产写入。

- 仓库/worktree：`mayf3/dsh-agent-core` / `/private/tmp/h-succession-order`；branch `docs/ppr-r4-step3`。
- Parent：`d7fcc52cff01abd6990aaa6f741de8b0deb2da24`；目标 PR #657。
- Product Authority：Owner mayf3 四 PR 裁定②，selector
  `$.rulings[id=owner-20261107-four-pr-rulings]`，canonical SHA256
  `677bfe608a67d67f8f9092d817fff0e4f4d040f1bc6e0a0184a69315bc54d7b7`。
- 接受委托：standing 原 §3B，selector `$.rulings[id=owner-20261107-standing-delegation]`，
  canonical SHA256 `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`。
  原件/固定来源及正式 accepted 载体见步2接受记录；Owner 为权威，worker仅记录受托事务。
- 候选 Spec SHA256：`206886c90d0fa1fc5cc6cd3707d5dae0e3643424e153d1ba85a9a1bbf9c0eb55`；仍 proposed/none/production none，待真实语义commit与非作者独审。
- WEC4 dependency：步2接受事务 `1e064916fc0cf423a3b917cfbcc11a97d56921e9`，
  不冒称 main 激活；main仍 `bb67ce5a…`/WEC3，#657激活须#655先合main。

当前组合引用重绑 WEC4，正式接受后 contracts/prod none；两类指定 collection 外移
不扩成 PPR 恢复gate解锁。附录 A/B、全部旧OBS、§2普通planned资格、CTR001/002/004/005
与parent逐字相同，两个 predecessor 字节未动，diff check rc0。CTR003只改组合引用边界，
CTR006只明确正式Contracts实施权与后续REUSE；未改变proof/UNKNOWN/锁/WAL/资格条件。

独审后最小生命周期事务：PPR accepted_by mayf3 / accepted / contracts / prod none，
绑定真实 reviewed semantic HEAD；WAE3和Liveness1同时superseded→PPR；两索引与
下列受影响current载体迁移，保留原正文/接受历史；独立final-HEAD复核后push/readback/停顿。

- ASM V1/V2：保留历史 `amended_by`/原两kind文字，增加current carrier元数据或生命周期说明
  指向PPR附录A的CTR-WAE-004，V2 `related_specs`可加PPR并保留历史WAE2。仅两kind
  `inter_agent | workflow_execution`原字节和权限保持；不接受新origin。
- SRE2：保留status accepted/supersedes/全部正文/原§8历史效力，增加current scoped-effect
  carrier说明指向PPR附录B §8与CTR-EKRWAE-006/007；历史carrier为Liveness1。不新增
  `supersedes_clauses`，不退休整份SRE，不扩大历史例外。schema允许附加元数据。
- RBAH：本d7分支缺文件，从origin/main精确复制此单份必需文档；frontmatter `governed_by`
  的Liveness1+WAE3替换为PPR，WEC3替换为WEC4；加current生命周期说明指向PPR/WEC4。
  §3.2明确行号绑定authoring base，保留历史L/E/A映射与六Contracts全字节；实施none、
  production none、WEC/Svc正式配套门原样不变，不退休RBAH。
- WEC4：仅增加current recovery owner说明指向PPR，历史WAE3/Liveness引用留作来源；
  不更改步2产品Contracts或两collection边界。
- Current indexes：local README WAE V3→PPR（明确双前驱退休和merge激活条件）；
  Spec index将WAE3/Liveness1标historical superseded→PPR并列PPR current事务。

MAIN_ACTIVATION=NOT_PERFORMED；独审/接受commit/final review/push=NOT_RUN at preparation；
PRODUCT_TESTS/COMPATIBILITY/FAULT_INJECTION=NOT_RUN；运行/业务=UNKNOWN；MERGE=NONE。
DONE_WHEN是本步接受事务交付；具体权威冲突/证据门失败/越范围/重试耗尽停止依赖动作。
