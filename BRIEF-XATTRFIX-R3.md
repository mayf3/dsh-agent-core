# 合同式交办：xattrfix-r3 — Owner/监管授权：语义保持拆分 + xattr 修复（二合一）

## 监管裁定（SCOPE_ESCALATION 闭合 + REPOSITORY_INVARIANT 修复授权）
**授权将 window-executor-v5.sh（974 行）拆分为 ≤500 行/文件的模块组合，15 节点语义逐字节保持**：
- 天然切面：bash 主框架（~370 行：usage/boundaries/stage 函数/main）+ 内嵌 Python helper（~600 行：收据/清单/校验）
- Python helper 拆为模块文件（如 window_helper_core.py + window_preimage_xattr.py），bash 侧 source/调用
- **xattr 修复在拆分后的 preimage/xattr 模块内实施**（一次到位，不二次返工）：
  a. extended(p) 移除 xattr（只留 flags）
  b. inventory(root) 末尾增 `xattr -lr root` 单进程批量段 → 按 path 分段 → {relpath: digest} 存 reserved 键
  c. 三处消费者适配（prerequisites/preserve-config/final-binding 排除保留键，final-binding 属性表直接比较）
  d. preimage ditto 后：target 对账 source xattr map——空值缺失逐条 `xattr -w` 重贴，非空差异硬失败
- 拆分等价性证明 = dry-run 边界输出与原件逐行一致 + selftest 全 PASS + 合成树测试全 PASS

## 任务顺序
1. 拆分（≤500 行/文件，语义字节保持——移动重导出，不改逻辑）
2. 合成树测试（五类夹具：有值/空值/多属性/无属性/dangling）→ 全 PASS 原文
3. dry-run 边界输出与原件 diff=∅ + selftest（合规隔离路径）→ PASS
4. commit（chore/fleet-window-tools）+ push + PR；**不 merge**
5. 失败即停写 STOPPED-XATTRFIX-R3.md（精确坐标）

## 红线
15 节点语义一字不动（拆分等价性证明是硬门）；零生产接触；原 974 行原件保留在 Git 历史
## 回执（RECEIPT-XATTRFIX-R3.md）
拆分映射表（原行号→新文件行号）、合成测试+dry-run+selftest 输出原文、PR URL、UNKNOWN

## Execution preflight (2026-11-04)

- TARGET: mayf3/dsh-agent-core; isolated worktree /private/tmp/dsh-fleet-window-tools;
  single writer /root; branch chore/fleet-window-tools.
- REVIEW_TARGET_HEAD / BASE_HEAD: c4152e9a45e2f1798807492c73516d924dcaf855.
  Local origin/main snapshot: 7a8aaac00d56c4af2892e7097731ecda86a90f1d.
- GOAL_OR_TARGET: bounded split plus batch xattr repair, source/offline only.
  CURRENT_GAP: 974-line executor and known empty-xattr ditto loss.
- AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
  ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES (structure rules).
- PRIMARY_AUTHORITY: CODE_STRUCTURE_GUARDRAILS_V2 and accepted
  CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1 at the exact base; Architecture and
  Current Decisions retain product ownership and UNKNOWN outcome boundaries.
  This one-operation tool repair creates no long-lived product Contract.
- MUTATION_AUTHORIZATION=VALID: Owner user R3 mandate above, R1/R2 referenced
  scopes retained; IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO (not authorized);
  PRODUCTION_OPERATION_ALLOWED=NO; SPEC_GAP_DEPENDENCY=NONE.
- EVIDENCE_NEEDED: physical line counts; mapping; byte-identical 15 bash stage
  definitions/main; five synthetic fixture classes; dry-run diff empty; new-helper
  isolated selftest; exact candidate structure gate and independent delta review.
- CLI parser uses xattr -lrsx: the authorized -lr single process plus -s nofollow
  and -x unambiguous binary/empty values. Ambiguous paths/headers fail closed.
- Selftest scope is the newly split helper and preserved executor, not the
  unrelated untouched stage_06_v2.py controller.
- DONE_WHEN: required gates pass, receipt has original output and UNKNOWN,
  commit/push/PR complete; no merge. EXPANSION_TRIGGER: new authority/consumer
  conflict, failed required gate, production dependence -> STOPPED-XATTRFIX-R3.md.
- NEXT_ACTION=CONTINUE. Old SCOPE_ESCALATION is closed by the explicit R3 split
  mandate; oversized affected file closes only upon measured successful split.
