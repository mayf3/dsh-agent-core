# 合同式交办：C7 + 执行器终局 selftest（窗口 GO 前最后一棒）

## 权威输入
- WINDOW-READINESS.md 条件 C7 行（scripts/fleet-window/ 内）；STOPPED-C5R7.md §4 表（13 缺 R6 命名集收账与 R7 两代保留）
- scripts/fleet-window/window-executor-v5.sh（15 节点原件）；SOP-DEPLOY-MASTER R6/R7 铁律
- C5 FINAL：/usr/local/v5-boot-isolation/RECEIPT-C5-FINAL.md（祖先链合规路径=/usr/local/v5-boot-isolation）

## 任务（base = 当前 main，branch chore/c7-selftest）
1. **C7 实现**（改 scripts/fleet-window/window-executor-v5.sh 的 stage_13）：补 R6 命名集收账
   （窗口前后命名集 diff=∅ 断言，改名带映射）+ R7 保留策略（滚动后保留最新 2 代、删其余 .ds-old-*，
   生成精确待删清单**仅列出**不执行——生产删除仍属窗口内动作）
2. **终局 selftest**：执行器 selftest/dry-run 模式跑 stage_00-04（非变异）+ canary，
   隔离 HOME 用 /usr/local/v5-boot-isolation（祖先链已验证合规）；逐阶段 PASS/FAIL 原文
   （若原件无 selftest 入口，按其阶段函数补一个 --selftest 模式，改动最小并逐行留档）
3. push + PR 引用本任务；**不 merge**（监管验收后代行）、**零生产写入**

## 红线
生产树/launchd/8788/8787 只读；隔离仅 /usr/local/v5-boot-isolation；失败即停写 STOPPED-C7.md；
改执行器须遵守入库规则（selftest+回执后合入）
## 回执（RECEIPT-C7.md）
C7 diff+映射、selftest 逐阶段输出原文、PR URL、UNKNOWN 清单

## PREFLIGHT（schema_version: 2；2026-11-04）

- Target: mayf3/dsh-agent-core；isolated worktree `/private/tmp/dsh-c7-selftest`；branch `chore/c7-selftest`。
- BASE_HEAD / CURRENT_BASE_HEAD / initial REVIEW_TARGET_HEAD: `55d306a997c02fa57e41b815cc31362c66f9ee18`（`git ls-remote origin main` 新鲜核实）。
- GOAL_OR_TARGET: C7 list-only close + isolated stage00–04 selftest + fresh stdio canary + receipt + unmerged PR。CURRENT_GAP: stage13无R6/R7，原件无selftest入口。
- SPEC_GOVERNANCE_MODE=PREFLIGHT；AUTHORITY_ACTION=REUSE；ROUTE_STAGE=IMPLEMENTATION；AUTHORITY_ACCEPTED_IN_BASE=YES；PLAN_LEVEL=BRIEF；ASSURANCE_LEVEL=DURABLE。
- PRIMARY_AUTHORITY: accepted repository governance V3 + local CODE_STRUCTURE_GUARDRAILS_V2；existing operational SOP-DEPLOY-MASTER R6/R7 and attributable user mandate。Related: PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 (contracts; production_apply_authority:none)、AGENT_CORE_BACKUP_RETENTION_V1 (.bak normal3/pinned protections)。No long-lived product semantic delta。
- MUTATION_AUTHORIZATION=VALID；EXECUTION_MANDATE=VALID for source/docs, fixed-root isolation, commit/push/PR only；ISOLATED_WRITE_SURFACE=YES；IMPLEMENTATION_ALLOWED=YES；MERGE_READY=NO (Owner/regulatory acceptance pending)；OPERATION_ALLOWED=NO for production。
- SPEC_GAP_DEPENDENCY=NONE for explicit-input list-only verifier；EVIDENCE_REVIEWABILITY=PASS；LIVE_AUTHORITY_GAP=NONE within this bounded scope。No authority to infer a naming domain or generation chronology from filenames: window authority must bind explicit inventoried snapshots/order/protections. Missing inputs refuse closure。
- Original 974-line shell is affected code; V2 requires <=500 lines. Mechanically extract its embedded Python definitions and op-dispatch into sibling modules; preserve exact original text and archive line mapping/diff. This is necessary structure compliance, not a new executor path。
- Input correction: `/tmp/v5-rebuild/STOPPED-C5R7.md` has no §4 table. The actual stage13/C7 gap is WINDOW-READINESS §4/§5. C5-r11 FINAL supersedes the older isolated ancestor blocker as execution Evidence only。
- EVIDENCE_NEEDED: mechanical extraction comparison, shell/Python syntax, isolated R6/R7 cases, stage00–04 read-only checks tied to real pure validators, fresh official stdio canary/exit, source/evidence hashes, independent affected-surface review。Production stage effects remain NOT_EXECUTED; historical C5 evidence is rebound by hashes, not relabeled a fresh runtime run。
- DONE_WHEN: required isolated gates pass, RECEIPT-C7 contains verbatim results/diff/mapping/UNKNOWN/PR URL, branch pushed and PR open; no merge。
- EXPANSION_TRIGGER: authority conflict, required-gate failure, unknown destructive target, or any needed production/outside-isolation effect. First required failure -> STOPPED-C7.md; no corrective retry or downstream execution; only owned-child cleanup/failure evidence thereafter。
- NEXT_REAL_ACTION / NEXT_ACTION: CONTINUE bounded source implementation; keep production tree/launchd/8788/8787 read-only (no access needed)。
