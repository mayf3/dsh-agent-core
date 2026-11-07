# R4 步2 — WEC4 接受准备

本轮用户 R4 和 `BRIEF-SUCCESSION-R3.md` 授权严格串行完成 #655 接受事务；
每步 commit/push 后停顿，不自行合并。网络瞬断重试一次仍失败即停。
路线为 `SUPERSEDE + BRIEF + DURABLE / AUTHORITY_AUTHORING`，docs-first；
零产品源码、配置、测试及生产写入，不实施 aging/refusal。

- 仓库/worktree：`mayf3/dsh-agent-core` / `/private/tmp/h-succession-order`。
- 隔离分支：`docs/wec4-r4-step2`；parent `a61ba45f1f168d5b755a9aa37d74f21135467ec6`。
- 目标：`docs/wec1-008-lock-timing-supersede` / PR #655；已读 main `bb67ce5ae53908c299e751d3904793b9f4d08240`。
- Product Authority：Owner mayf3 裁定④；`$.rulings[id=owner-20261107-four-pr-rulings]`；
  canonical SHA256 `677bfe608a67d67f8f9092d817fff0e4f4d040f1bc6e0a0184a69315bc54d7b7`。
- 接受委托：Owner 常设授权原 §3B；`$.rulings[id=owner-20261107-standing-delegation]`；
  canonical SHA256 `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`；
  accepted 正式载体为上述 main 的 `AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1` §9 CTR-SOD-003。
- 原件 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`；
  选中证据为 Core `5df19f5f5ab0251088c27d9657ace66b9e0a3425` 的
  `docs/evidence/succession-order/r2/owner-rulings.json`，本轮重算两 hash 一致。
  Owner 为权威，worker 仅执行受委托记录，不自授权限。

当前候选仍 **proposed / implementation none / production none**；
Spec SHA256 `5dadb98c80d43950d1664238dc71f3083ac88bdfe41cf6e9e9920708ad5f7141`。重绑 current Svc 为 V3#CTR-SWEC-010
@`8da8dbcb70e700d9e35970e8b662b1be2c29afdc`，复用上述固定 Core 证据
`SUCCESSION-ORDER-AND-CONFLICTS.md` §2 和 `r2/svc-authority.json` 的既有核准。
旧 OBS-WEC4-002 和回执原字节保留；正文、ACC-WEC4-001 和 §12 统一正式 accepted→contracts。
本准备不退休 WEC3，不切 current 索引。实测全部 §9 Contracts/data/API、旧 OBS、
WEC3、两索引及旧回执均与 parent 字节相同，`git diff --check` rc0。

下一最小事务：先提交本语义候选并做非作者独审；再绑定真实 reviewed HEAD
（不得以旧 a61ba45f 冒充已审修订），以独立 lifecycle commit 原子写入
WEC4 accepted_by mayf3 / accepted / contracts / production none、V3整体退休/双向回链、
索引同步；独立最终 HEAD 复核后普通 push、PR head 回读、停顿。当前语义commit、
独审、接受commit、最终复核及push均待根执行者完成，作者不预报 PASS。

MAIN_ACTIVATION=NOT_PERFORMED：分支接受事务只有在main merge后才成为current authority。
PRODUCT_TESTS/DUAL_WRITER_PERSISTENT_STORE=NOT_RUN；PERFORMANCE=UNMEASURED；
SVC_RUNTIME_OR_STORE_CONFORMANCE=UNKNOWN；MERGE=NONE；产品/生产写入=0。
双 writer 实测仍是实现/效果签结硬门，文档审查不能替代。DONE_WHEN 是本步接受
事务交付；遇具体权威冲突、范围扩张、证据门失败或网络重试耗尽，停止依赖动作。
