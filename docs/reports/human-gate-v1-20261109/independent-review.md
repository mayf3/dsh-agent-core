# Independent non-author review receipt — AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1

- Reviewed heads: initial `1c3371ab` (PR #627) → fix `9c08ddcc` (B1/B2 closed)
- Reviewer: non-author independent local Codex worker (read-only), 2026-11-09
- First review: FINAL_VERDICT=FAIL, FROZEN_BLOCKER_UNION=["HG-WEC5-LOCK-TIMING","HG-RULING4-SOURCE"]
- Fix commit `9c08ddcc` (author-chain self-repair): B1 lock-timing rewritten to WEC5
  semantics (outside-lock collection -> re-acquire -> current replay -> fresh final
  check -> single append; ACC-HG-007 synced); B2 ruling-4 citation re-anchored to
  durable coordinates (registry owner-20261108-three-unified items[3],
  owner-20261108-backlog-convergence items[3], agent-control#1352 comment 6622750077),
  original 2026-11-06 task directive honestly marked NOT_LOCATED (no fabrication)
- Delta recheck: B1 PASS, B2 PASS, FROZEN_BLOCKER_UNION=[]
- Item 4 of first review (ruling-4 alignment) resolved from UNKNOWN by B2 re-anchoring

---

## First review verdict section (verbatim tail)

*B2 — `HG-RULING4-SOURCE` / `REQUIRED_GATE_FAILURE`**

- **来源与反例：**[修订回执 L35–42](/tmp/review-627/repo/RECEIPT-627-REVISION.md:35) 将裁定④归于未提交的 `BRIEF-627-REVISION.md`，[L102–103](/tmp/review-627/repo/RECEIPT-627-REVISION.md:102) 仅存哈希；原路径亦不存在。独立审查只能核对作者转述，无法核对原裁定。
- **影响及最小闭合：**裁定对齐核验、接受推荐 readiness=`NO`。补可读原交办及持久坐标，或可追溯的独立来源回执即可；无需重复产品裁定。现有证据不足以认定 `FALSE_EVIDENCE`。

机械检查均通过：schema、生命周期、治理完整性、diff check、结构差量（新增违规 0；历史债务 28）。运行验收未执行。

```text
FINAL_VERDICT=FAIL
FROZEN_BLOCKER_UNION=["HG-WEC5-LOCK-TIMING","HG-RULING4-SOURCE"]
```


tokens used
136,154
审查结果：**FAIL，冻结阻塞项 2 个**。未修改文件、未执行 `git fetch`、未访问生产，工作树保持干净。

审查坐标：

```text
HEAD        = 1c3371abe36bcda08da27eb901e86dd95af949bc
origin/main = a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
merge-base  = f6a1f77a8b7b878bcb9821a68836925755ca7076
```

| 审查项 | 结论 | 证据与说明 |
|---|---|---|
| 1. frontmatter/格式 | **PASS** | [提案 L4–35](/tmp/review-627/repo/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:4)：`proposed`、production `none`，明确未接受、未授权实现。Schema、生命周期检查通过。 |
| 2. 语义自洽 | **FAIL** | 触发、合法 resolve、24h 提醒及 SRA/SOD §7 边界无冲突；但 [CTR-HG-007 L264](/tmp/review-627/repo/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:264) 的锁内 pre-plan 读取与当前 main WEC5 冲突，见 B1。 |
| 3. 不扩权 | **PASS** | [L171–203](/tmp/review-627/repo/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:171)、[L219–255](/tmp/review-627/repo/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:219)：请求、消息验真、HUMAN 身份及投影均不构成授权；保留真实 caller、Domain 权限、managed guard 和 WEC 证明。 |
| 4. Owner ruling④ 对齐 | **UNKNOWN** | [#1352 精确评论](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077) 的作者、时间、三项裁定及正文哈希已独立核实；但 **2026-11-06 裁定④原交办**未取得，不能由该 11-04 评论代证，见 B2。 |
| 5. 验收/开放问题 | **PASS（披露与覆盖）** | [L329–340](/tmp/review-627/repo/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:329) 有 8/8 验收定义且全部标为 `NOT_RUN`；[L360–404](/tmp/review-627/repo/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:360) 明列外部依赖与 TBD。ACC-HG-007 须随 B1 调整。 |

**B1 — `HG-WEC5-LOCK-TIMING` / `CONTRACT_VIOLATION`**

- **来源与反例：**当前 main 的 [WEC5 L653–699](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L653-L699) 要求两类远端 collection 锁外执行。按候选 L264、L339 持锁等待 A 的远端读取，会阻止无关合法 B admission，违反 `CTR-WEC4-010` 和 `ACC-WEC4-003`。
- **影响及最小闭合：**候选接受/合入 readiness=`NO`。更新有效权威引用，明确锁外采集、重获锁、current replay、fresh 权威终检和单次 append；保留原 DTO、baseline、permit 与恢复边界。

**B2 — `HG-RULING4-SOURCE` / `REQUIRED_GATE_FAILURE`**

- **来源与反例：**[修订回执 L35–42](/tmp/review-627/repo/RECEIPT-627-REVISION.md:35) 将裁定④归于未提交的 `BRIEF-627-REVISION.md`，[L102–103](/tmp/review-627/repo/RECEIPT-627-REVISION.md:102) 仅存哈希；原路径亦不存在。独立审查只能核对作者转述，无法核对原裁定。
- **影响及最小闭合：**裁定对齐核验、接受推荐 readiness=`NO`。补可读原交办及持久坐标，或可追溯的独立来源回执即可；无需重复产品裁定。现有证据不足以认定 `FALSE_EVIDENCE`。

机械检查均通过：schema、生命周期、治理完整性、diff check、结构差量（新增违规 0；历史债务 28）。运行验收未执行。

```text
FINAL_VERDICT=FAIL
FROZEN_BLOCKER_UNION=["HG-WEC5-LOCK-TIMING","HG-RULING4-SOURCE"]
```




---

## Delta recheck (verbatim tail)

增量复审（只读 + /tmp 写）：仓库 /tmp/review-627/repo 已 fetch 到 9c08ddcc（原审查 HEAD 1c3371ab）。仅核两 blocker 修复 delta：1) B1 HG-WEC5-LOCK-TIMING：提案 L264/L339 附近现按'锁外采集→重获锁→current replay→fresh 终检→单次 append'表述，与 main WEC5 L653-699 语义一致，无持锁远端等待残留；ACC-HG-007 同步；2) B2 HG-RULING4-SOURCE：裁定④引用已重锚定到持久坐标（registry 3C ruling items[3]/backlog-convergence items[3]/#1352评论6622750077），原指令如实标 NOT_LOCATED，无虚构原文。核对 spec 其余部分未被顺手改动（diff 1c3371ab..9c08ddcc 仅涉修复面）。输出两项 PASS/FAIL + FROZEN_BLOCKER_UNION=[...]。零写入（/tmp 除外）。
2026-11-09T11:43:20.488156Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:43:21.491932Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:43:25.188655Z ERROR codex_models_manager::manager: failed to refresh available models: request timed out
2026-11-09T11:43:26.477510Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:43:26.728659Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:43:27.731479Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
codex
我会只读核对两项 blocker 的修复、对应权威来源，以及 `1c3371ab..9c08ddcc` 的改动范围。
exec
/bin/zsh -lc "rg -n 'HG-WEC5|HG-RULING4|review-627|WEC5|FROZEN_BLOCKER' /Users/yanfenma/.codex/memories/MEMORY.md" in /tmp/review-627
 exited 1 in 0ms:
exec
/bin/zsh -lc "pwd; git status --short; git rev-parse --show-toplevel; git rev-parse HEAD; rg --files -g AGENTS.md -g '*registry*' -g '*backlog*' -g '*HG*' -g '*WEC5*'" in /tmp/review-627/repo
 succeeded in 0ms:
/private/tmp/review-627/repo
/private/tmp/review-627/repo
9c08ddcc792641414a3dd7bbeea10912c6d4fb66
AGENTS.md
packages/fixed-operation/src/registry.js
docs/investigations/stock-agent-registry-adoption-v1.md
docs/reports/agent-registry-v1.md
packages/broker/src/registry.js
packages/broker/src/capabilities/workflow/owner-operation-registry.js
packages/agent-router/src/process-registry-route-gate.js
packages/agent-router/src/process-registry-startup.js
packages/agent-router/src/process-registry.js
packages/agent-router/src/process-registry-native-policy.js
packages/agent-router/src/process-registry-death-evidence.js
scripts/stock-agent-registry-adoption-v1-verify.mjs
scripts/migrate-registry-to-definition.mjs
packages/agent-router/test/route-chain/process-registry-route-gate.test.js
packages/agent-router/test/process-registry.test.js
docs/reports/stock-agent-registry-adoption-v1.md
docs/superpowers/plans/2026-09-30-availability-and-backlog-rollout.md

exec
/bin/zsh -lc 'cat AGENTS.md; git diff --stat 1c3371ab..9c08ddcc; git diff --name-status 1c3371ab..9c08ddcc; git remote -v; git branch -a --no-color' in /tmp/review-627/repo
 succeeded in 0ms:
# Agent entrypoint

Before non-mechanical work in `mayf3/dsh-agent-core`:

1. read `.agents/README.md` (vendored shared grammar);
2. read `.agents/local/README.md` (this repository's authority and constraints);
3. read the directly relevant Product Architecture, current Decisions, and accepted governing Specs;
4. read `.agents/skills/spec-governance/SKILL.md` and only the selected mode file.

For `REUSE`, implement within the existing accepted implementation-authorizing
Contracts in the base; an in-contract bug fix needs no new Spec. A bounded
`AMEND/NEW + ROUTINE/DURABLE` may combine its Spec delta and code only under the
active local permission described in `.agents/local/README.md`. `CONTROLLED`
changes and every `SUPERSEDE` remain docs-first. A proposed adoption branch does
not activate that permission or authorize product implementation.

Do not treat code, tests, runtime state, chat history, the newest-looking document, or an unmerged accepted-looking branch as higher authority than the repository's accepted local authorities.

When authority conflicts or drift are found, stop the dependent work and report the concrete conflict; unrelated authorized work may continue. Do not silently choose a side or rewrite accepted meaning under the same stable ID.
 RECEIPT-627-REVISION.md                            | 129 +++++++++++++++++++--
 .../AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md  |  66 ++++++++---
 2 files changed, 170 insertions(+), 25 deletions(-)
M	RECEIPT-627-REVISION.md
M	docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
origin	https://github.com/mayf3/dsh-agent-core.git (fetch)
origin	https://github.com/mayf3/dsh-agent-core.git (push)
* ac-ekr-p1a-spec
  remotes/origin/HEAD -> origin/main
  remotes/origin/ac-442-authority-docs
  remotes/origin/ac-523-guard-integration
  remotes/origin/ac-527-acceptance
  remotes/origin/ac-527-authority-docs
  remotes/origin/ac-527-scheduler-impl2
  remotes/origin/ac-547/clone-disabled-v1
  remotes/origin/ac-547/unsupported-readback-diagnosis-v1
  remotes/origin/ac-562/authoring-file-entry
  remotes/origin/ac-613/version-read-action
  remotes/origin/ac-724-submission-gap-diagnosis
  remotes/origin/ac-D14D13-r2-facts
  remotes/origin/ac-D14D13-spawn-proof
  remotes/origin/ac-ctr-s4-reverify
  remotes/origin/ac-ctr-s4-runtime-prep
  remotes/origin/ac-ekr-b1b4
  remotes/origin/ac-ekr-b3
  remotes/origin/ac-ekr-p0a
  remotes/origin/ac-ekr-p1-new
  remotes/origin/ac-ekr-p1a-spec
  remotes/origin/ac-ekr-preflight
  remotes/origin/ac-ekr-wae-docs
  remotes/origin/ac-task/1167
  remotes/origin/ac-task/1210
  remotes/origin/ac-task/1214
  remotes/origin/ac-task/1227
  remotes/origin/ac-task/1228
  remotes/origin/ac-task/1244-d1d2
  remotes/origin/ac-task/1249-replay-schema-fix
  remotes/origin/ac-task/1277-identity-convergence
  remotes/origin/ac-task/454
  remotes/origin/ac-task/466
  remotes/origin/ac-task/552-release-prep-b7-binding
  remotes/origin/ac-task/552-shared-codex-reader-owner
  remotes/origin/ac-task/558
  remotes/origin/ac-task/700-buffer-limit-diagnosis
  remotes/origin/ac-task/801
  remotes/origin/ac-task/810
  remotes/origin/ac-task/896-dispatch-count-source
  remotes/origin/ac-task/953-onboarding-entry-source
  remotes/origin/ac-website-inquiry-read-contracts-20261015
  remotes/origin/agent-memory-sigtrap-fix-v1
  remotes/origin/agent/adopt-development-governance-v0
  remotes/origin/agent/agent-core-agent-credential-provisioning-v1-accepted
  remotes/origin/agent/agent-credential-provisioning-v1-implementation
  remotes/origin/agent/credential-census-followup-v1
  remotes/origin/agent/credential-store-utf8-toctou-hardening-v1
  remotes/origin/agent/forum-governance-tools-v1
  remotes/origin/agent/luna-rc8-sync-20260821-152702-44341
  remotes/origin/agent/process-authority-replacement-v1-20260821-092117-70676
  remotes/origin/agent/process-v2-authority-convergence-v1
  remotes/origin/agent/scheduler-production-transaction-v1
  remotes/origin/agent/security-reliability-hardening-plan-v1
  remotes/origin/agent/stage-f-evidence-20260822
  remotes/origin/agent/wda-structural-diagnostics-v1
  remotes/origin/agent/work-execution-class-broker-impl
  remotes/origin/agent/work-execution-class-broker-spec
  remotes/origin/agent/workflow-domain-members-broker-v1
  remotes/origin/amend/asm-release-closure-boot-v2
  remotes/origin/amend/asm-release-closure-boot-v3
  remotes/origin/amend/asm-release-closure-r3a-count
  remotes/origin/amend/capture-admission-20261010
  remotes/origin/archive/wt-cleanup-20261017/dcp-first-live-binding-e74c20-d719a82f5d
  remotes/origin/archive/wt-cleanup-20261017/dcp-first-live-operator-78872e-c7114c94f4
  remotes/origin/archive/wt-cleanup-20261017/des-continue-midrun-fix-v1-e68efd-adc745edab
  remotes/origin/archive/wt-cleanup-20261017/dsh-agent-core-wt-mobile-session-history-v1-f2dff7-ee5a45e6de
  remotes/origin/archive/wt-cleanup-20261017/dsh-fixed-operation-v1-app-8241ed-1e5d39d6ac
  remotes/origin/archive/wt-cleanup-20261017/dsh-fixed-operation-v1-b7ce1d-d51cc70ff8
  remotes/origin/archive/wt-cleanup-20261017/dsh-owner-pending-first-escalation-v1-846606-27e8f01410
  remotes/origin/archive/wt-cleanup-20261017/dsh-wda-integration-v1-0dc846-646a79f802
  remotes/origin/archive/wt-cleanup-20261017/dsh-workflow-node-session-history-v1-329fcd-d489f64fe8
  remotes/origin/archive/wt-cleanup-20261017/night-ds-fixed-target-restart-4635b5-bfbcdeeefe
  remotes/origin/archive/wt-cleanup-20261017/t0-backflow-20260930-f359f3-caeaf8a64f
  remotes/origin/audit/core-retired-history-20261003
  remotes/origin/audit/optional-startup-20261004
  remotes/origin/audit/optional-startup-p1-reconciliation-20261004
  remotes/origin/audit/pr140-adoption-v1-execution
  remotes/origin/audit/wec-positive-quiescence-20261003
  remotes/origin/b7-recovery/retained-custody-export-r1
  remotes/origin/c11-r3-restart-safe-v1
  remotes/origin/c11-r4-notification-coalesce-v1
  remotes/origin/c11-r4-packet-refresh-r3
  remotes/origin/candidate/agent-switch-dsh-tools-peer-pin-v2
  remotes/origin/chore/442-v2-acceptance
  remotes/origin/chore/bounded-governance-adoption-20260929
  remotes/origin/chore/c7-selftest
  remotes/origin/chore/fleet-w6-s04-20261106
  remotes/origin/chore/fleet-window-anarrowed
  remotes/origin/chore/fleet-window-tools
  remotes/origin/chore/governance-tool-readopt-2.0.0-rc.2
  remotes/origin/chore/harness-rebind
  remotes/origin/chore/helper-harness-rebind
  remotes/origin/chore/structure-guardrails-v3-exception
  remotes/origin/chore/vendor-governance-d32b946
  remotes/origin/chore/verifier-post-retirement-adapt
  remotes/origin/codex/1156-auth-approval-v3
  remotes/origin/codex/1156-system-minimal-v2
  remotes/origin/codex/441-governance-consolidation
  remotes/origin/codex/ac-810-e32-closure-0601d987
  remotes/origin/codex/ac-810-e33-r3-accepted-20261017
  remotes/origin/codex/ac-810-e33-r3-source-20261017
  remotes/origin/codex/ac1256-b7-fail-closed
  remotes/origin/codex/ac1256-b7-fail-closed-spec
  remotes/origin/codex/ac810-w1-reviewed-union-5bde67ab
  remotes/origin/codex/agent-core-lark-channel-sdk-integration-v2-spec
  remotes/origin/codex/agent-self-service-operations-control-plane-v1
  remotes/origin/codex/agent-session-messaging-deployment-v1-495b
  remotes/origin/codex/agent-session-messaging-model-execution
  remotes/origin/codex/agent-session-messaging-v1-r2
  remotes/origin/codex/asm-stage-order-amendment-v1
  remotes/origin/codex/assistance-resume-contract-20261028
  remotes/origin/codex/assistance-resume-core-impl-20261028
  remotes/origin/codex/b7-e31-fixed-closure-source-20261017
  remotes/origin/codex/b7-e32-pretx-closure-accepted-20261017
  remotes/origin/codex/broker-native-policy-discriminator-20261028
  remotes/origin/codex/canonical-deploy-offline-pnpm-resolution-v1
  remotes/origin/codex/canonical-deploy-pnpm-launcher-authority-v1
  remotes/origin/codex/coherent-v5-source-impl
  remotes/origin/codex/coherent-v5-spec-amendment
  remotes/origin/codex/core-runtime-autonomy-scheduler-deploy-v1
  remotes/origin/codex/deployment-maintenance-separation
  remotes/origin/codex/deployment-reuse-pr358
  remotes/origin/codex/dot-native-dialogue-contract
  remotes/origin/codex/dsh-governance-activation-20261015
  remotes/origin/codex/feishu-reply-display-safety-v1
  remotes/origin/codex/fleet-shared-codex-activation-amend
  remotes/origin/codex/fleet-shared-codex-auth-activation-v1
  remotes/origin/codex/fleet-shared-codex-auth-implementation
  remotes/origin/codex/fleet-shared-codex-auth-spec
  remotes/origin/codex/fleet-shared-codex-yanfenma-realignment-v1
  remotes/origin/codex/g2-trusted-cp-deploy-git-probe-repair-v0
  remotes/origin/codex/g7-provisioning-immutable-repo
  remotes/origin/codex/hr-admin-conditional-operation
  remotes/origin/codex/hr-admin-ds-private-bootstrap
  remotes/origin/codex/hr-admin-emergency-impl
  remotes/origin/codex/hr-admin-emergency-spec
  remotes/origin/codex/hr-admin-exact-offline-package
  remotes/origin/codex/hr-admin-final-binding
  remotes/origin/codex/hr-admin-fresh-producer
  remotes/origin/codex/hr-aer-current-id-accept
  remotes/origin/codex/hr-canonical-integration-20260927
  remotes/origin/codex/hr-cto-exact-sender
  remotes/origin/codex/hr-cto-owner-sender-spec
  remotes/origin/codex/hr-dispatch-delivery-readiness-v1
  remotes/origin/codex/hr-first-effect-root-receipt-implementation
  remotes/origin/codex/hr-first-effect-root-receipt-spec
  remotes/origin/codex/hr-fresh-cut-install-join
  remotes/origin/codex/hr-fresh-lineage-ds-v4
  remotes/origin/codex/hr-fresh-lineage-router-20260929
  remotes/origin/codex/hr-fresh-lineage-spec
  remotes/origin/codex/hr-maintenance-authority
  remotes/origin/codex/hr-original-qualification-driver-20260927
  remotes/origin/codex/hr-qf-ds-parent-namespace-20260928
  remotes/origin/codex/hr-qualification-authority-20260927
  remotes/origin/codex/hr-qualification-phase-authority-20260927
  remotes/origin/codex/hr-r4-trusted-recovery-implementation
  remotes/origin/codex/hr-replay-provenance-successor
  remotes/origin/codex/hr-restart-fence-b1-b3
  remotes/origin/codex/internal-agent-directory-spec-v1
  remotes/origin/codex/lark-ux-phase1-v3-impl
  remotes/origin/codex/lw-broker-closure-v1
  remotes/origin/codex/m2-zero-skip
  remotes/origin/codex/model3-broker-authority-01a07001
  remotes/origin/codex/model3-broker-implementation-01a07001
  remotes/origin/codex/native-arm64-runtime-impl-v1
  remotes/origin/codex/native-arm64-runtime-v1
  remotes/origin/codex/native-dialogue-pilot
  remotes/origin/codex/outcome-unknown-auto-recovery-e2e-v1
  remotes/origin/codex/outcome-unknown-c026-amendment-v1
  remotes/origin/codex/outcome-unknown-parent-runtime-recovery-v1
  remotes/origin/codex/owned-dispatch-status-spec-20261027
  remotes/origin/codex/p0-runtime-credential-role-20260927
  remotes/origin/codex/pdc-agent-definition-preimage-recovery
  remotes/origin/codex/pdc-runtime-closure-recovery-v2
  remotes/origin/codex/presence-role-discovery-repair
  remotes/origin/codex/principal-agent-resolution-authority-v1
  remotes/origin/codex/principal-agent-resolution-impl-v1
  remotes/origin/codex/principal-resolution-subject-correction-v2
  remotes/origin/codex/production-deployment-control-plane-v1
  remotes/origin/codex/production-deployment-control-plane-v1-bootstrap-preparation
  remotes/origin/codex/scheduler-auth-scope-alignment-v1
  remotes/origin/codex/scheduler-deployment-v1
  remotes/origin/codex/scheduler-desired-state-mode-repair-v1
  remotes/origin/codex/scheduler-failure-evidence-20261012
  remotes/origin/codex/scheduler-occurrence-outcome-v3
  remotes/origin/codex/scheduler-timeout-outcome-v3
  remotes/origin/codex/scheduler-watchdog-post-merge-closure
  remotes/origin/codex/scheduler-watchdog-post-session-trace-v1
  remotes/origin/codex/scheduler-watchdog-routing-stuck-recovery-v1
  remotes/origin/codex/scheduler-watchdog-routing-stuck-recovery-v1-impl
  remotes/origin/codex/self-ops-production-rollout-authority
  remotes/origin/codex/self-service-operations-implementation
  remotes/origin/codex/self-service-scheduler-tools-v3
  remotes/origin/codex/shared-codex-emergency-bootstrap-amendment-v1
  remotes/origin/codex/trusted-native-tool-policy-core-20261028
  remotes/origin/codex/watchdog-phase3-preflight-portability-v1
  remotes/origin/codex/website-human-inquiry-source
  remotes/origin/codex/website-human-workflow-inquiry-v1
  remotes/origin/codex/wec-core-impl
  remotes/origin/codex/wec-core-spec
  remotes/origin/codex/workflow-assignee-field-guidance
  remotes/origin/codex/workflow-assignee-field-guidance-dto
  remotes/origin/codex/workflow-authoring-model-render-authority-v4
  remotes/origin/codex/workflow-authoring-model-render-v1
  remotes/origin/codex/workflow-authoring-usability-impl-v1
  remotes/origin/codex/workflow-authoring-usability-v1
  remotes/origin/codex/workflow-canonical-admission-core-accepted-v1
  remotes/origin/codex/workflow-canonical-admission-core-v1
  remotes/origin/codex/workflow-complete-body-spec-20261027
  remotes/origin/codex/workflow-current-input-broker-impl-20261027
  remotes/origin/codex/workflow-definition-authoring-v1-spec
  remotes/origin/codex/workflow-execute-receipt-recovery-authority-v1
  remotes/origin/codex/workflow-execute-receipt-recovery-v2
  remotes/origin/codex/workflow-human-principal-projection-v0
  remotes/origin/codex/workflow-human-principal-projection-v0-impl
  remotes/origin/codex/workflow-progress-repair-20261020
  remotes/origin/codex/workflow-transition-canary-v1
  remotes/origin/codex/workflow-transition-deployment-recovery-v1
  remotes/origin/codex/workflow-transition-direct-rollback-amendment-v1
  remotes/origin/codex/workflow-transition-root-xattr-observation-v1
  remotes/origin/codex/workflow-unattended-20261027
  remotes/origin/cross-agent-scheduler-integration-ready-v1
  remotes/origin/diag/547-durable-store
  remotes/origin/docs/1351-gates-spec
  remotes/origin/docs/1351-p1p2-binding
  remotes/origin/docs/1370-semantic-verify
  remotes/origin/docs/1377-convergence-analysis
  remotes/origin/docs/554-admission-runtime-spec-r4
  remotes/origin/docs/623-liveness-acceptance-alignment
  remotes/origin/docs/agent-core-architecture-v1
  remotes/origin/docs/agent-core-backup-retention-v1-spec
  remotes/origin/docs/agent-core-binding-workspace-v1-spec
  remotes/origin/docs/agent-core-chatgpt-subscription-provider-v1
  remotes/origin/docs/agent-core-credential-provisioning-v1-clean-bootstrap-phase-amendment
  remotes/origin/docs/agent-core-credential-provisioning-v1-spec
  remotes/origin/docs/agent-core-global-route-hemostasis-v1
  remotes/origin/docs/agent-core-self-service-scheduler-tools-v4-acceptance
  remotes/origin/docs/agent-core-self-service-scheduler-tools-v4-acceptance-final
  remotes/origin/docs/agent-credential-provisioning-v2-state-e-20261019
  remotes/origin/docs/agent-delivery-resilience-v1
  remotes/origin/docs/agent-presentation-registry-v1
  remotes/origin/docs/agent-process-admin-turn-abandonment-v1-acceptance
  remotes/origin/docs/agent-process-interactive-turn-timeout-investigation-v1
  remotes/origin/docs/agent-process-lifecycle-hardening-v1-implementation-authority
  remotes/origin/docs/agent-process-lifecycle-hardening-v1-spec
  remotes/origin/docs/agent-process-lifecycle-hardening-v2-authorization
  remotes/origin/docs/agent-repo-knowledge-gov-v1
  remotes/origin/docs/agent-response-finalization-integrity-v1
  remotes/origin/docs/agent-session-channel-model-v1
  remotes/origin/docs/agent-session-messaging-amendment-2
  remotes/origin/docs/agent-session-send-reliability-v1-amendment-1
  remotes/origin/docs/agent-session-send-reliability-v1-evidence
  remotes/origin/docs/agent-turn-caller-wait-recovery-v1
  remotes/origin/docs/agent-wake-capability-v1-spec
  remotes/origin/docs/agent-workspace-session-model-v2
  remotes/origin/docs/agent-workspace-session-v2-core-alignment-spec
  remotes/origin/docs/agt-cto-glm53-luna-fallback-v1
  remotes/origin/docs/agt-cto-luna-cold-backup-stage2-v1
  remotes/origin/docs/agt-cto-ordered-route-chain-v1
  remotes/origin/docs/agt-cto-route-chain-activation-glm-strict-amendment-v1
  remotes/origin/docs/agt-cto-route-chain-activation-v1
  remotes/origin/docs/agt-cto-route-chain-builtin-amendment-v1
  remotes/origin/docs/agt-cto-route-chain-credential-v1
  remotes/origin/docs/agt-cto-route-chain-impl-authority-v1
  remotes/origin/docs/agt-cto-route-chain-impl-authority-v1-republish
  remotes/origin/docs/amendment1-date-fix
  remotes/origin/docs/asm-envelope-fix-deployment-amendment-v1
  remotes/origin/docs/auth-p4-fixed-source-authority-20261019
  remotes/origin/docs/availability-rollout-plan-20260930
  remotes/origin/docs/b7-bounded-cohort-reconciliation-v2
  remotes/origin/docs/b7-e31-partial-stage-closure-v1-accepted
  remotes/origin/docs/broker-auth-service-origin-loopback-v1-spec
  remotes/origin/docs/broker-capabilities-shared-decomposition-spec
  remotes/origin/docs/broker-capability-audit
  remotes/origin/docs/broker-error-preservation-v1-spec
  remotes/origin/docs/captain-auth-create
  remotes/origin/docs/captain-binding
  remotes/origin/docs/captain-design-proposal
  remotes/origin/docs/captain-principal-creation
  remotes/origin/docs/chatgpt-subscription-target-proxy-seam-v1
  remotes/origin/docs/coordinator-control-plane-broker-v1
  remotes/origin/docs/credential-metadata-resolution-v1
  remotes/origin/docs/credential-provisioning-am7-accept-note
  remotes/origin/docs/credential-provisioning-am8-loopback-transport
  remotes/origin/docs/credential-provisioning-v1-amendment-7
  remotes/origin/docs/definition-first-zero-ops-20261107
  remotes/origin/docs/disk-stage1
  remotes/origin/docs/dsh-provider-fallback-chain-v1
  remotes/origin/docs/e42-app-anon-transport-accepted-20261020
  remotes/origin/docs/e42-capacity-method-a-v2-20261019
  remotes/origin/docs/e42-exact-p-third-call-accepted-20261020
  remotes/origin/docs/e42-first-anchor-predicates-accepted-20261020
  remotes/origin/docs/e42-fixed-capacity-facts-accepted-20261019
  remotes/origin/docs/e42-fixed-offline-continuation-accepted-20261020
  remotes/origin/docs/e42-fresh-six-carrier-accepted-20261020
  remotes/origin/docs/e42-pre-npm-lineage-accepted-20261020
  remotes/origin/docs/e42-public-selector-groups-accepted-20261019
  remotes/origin/docs/e42-q2-fixed-g-budget-accepted-20261019
  remotes/origin/docs/e42-q3-unchanged-npm-basis-accepted-20261019
  remotes/origin/docs/e42-selected-e1c-export-accepted-20261020
  remotes/origin/docs/feishu-ingress-content-compatibility
  remotes/origin/docs/feishu-workspace-memory-alignment-v1-spec
  remotes/origin/docs/fleet-shared-codex-auth-v3-realignment
  remotes/origin/docs/forum-moderation-capabilities-v1
  remotes/origin/docs/forum-moderation-capabilities-v2
  remotes/origin/docs/forum-moderation-capabilities-v2-amendment-1
  remotes/origin/docs/forum-moderation-capabilities-v3
  remotes/origin/docs/forum-v2-amendment-1-enum-prose-fix
  remotes/origin/docs/gov-record-alignment-20261108
  remotes/origin/docs/governance-conformance-reconciliation-v1
  remotes/origin/docs/hr-deployment-reuse-handoff-20260929
  remotes/origin/docs/hr-dispatcher-scheduler-v1-spec
  remotes/origin/docs/hr-dispatcher-v1-spec
  remotes/origin/docs/hr-zcode-file-bridge-v2-20261019
  remotes/origin/docs/lark-channel-sdk-integration-v2-acceptance-finalize
  remotes/origin/docs/lark-transport-phase1-v1-spec
  remotes/origin/docs/lark-ux-heading-normalization-amendment
  remotes/origin/docs/lark-ux-phase1-v2-acceptance
  remotes/origin/docs/lark-ux-phase1-v2-accepted-main
  remotes/origin/docs/lark-ux-phase1-v2-spec
  remotes/origin/docs/lark-ux-test-evidence-plane-amendment
  remotes/origin/docs/luna-dsh-rc8-version-alignment-v1
  remotes/origin/docs/mobile-session-history-v1
  remotes/origin/docs/notification-auth-clarification-v1
  remotes/origin/docs/notification-ingress-auth-origin-loopback-v1
  remotes/origin/docs/notification-ingress-service-auth-v1-spec
  remotes/origin/docs/official-lark-channel-integration-v1-investigation
  remotes/origin/docs/open-source-docs-convergence-v1
  remotes/origin/docs/planned-recovery-proposal
  remotes/origin/docs/primary-worktree-guard-v1-spec
  remotes/origin/docs/process-identity-audit
  remotes/origin/docs/product-api-voice-transcription-v1
  remotes/origin/docs/readback-aging-handoff-amend
  remotes/origin/docs/refusal-terminal-proposal
  remotes/origin/docs/return-policy-exhausted-declarer-v1-acceptance
  remotes/origin/docs/route-oc-go-quota-investigation-v1
  remotes/origin/docs/routing-generation-policy
  remotes/origin/docs/rth-core-successor
  remotes/origin/docs/scheduler-disposition-alert-lifecycle-v1
  remotes/origin/docs/scheduler-production-reconciliation-v1
  remotes/origin/docs/scheduler-self-healing-from-feishu-v1-acceptance
  remotes/origin/docs/scheduler-timeout-outcome-v2-spec
  remotes/origin/docs/self-service-scheduler-amt1-critical-disable-guard
  remotes/origin/docs/self-service-scheduler-amt2-conformance-reconciliation
  remotes/origin/docs/self-service-scheduler-unified-tool-v1
  remotes/origin/docs/self-service-scheduler-v2-critical-self-disable-amendment
  remotes/origin/docs/self-service-v2-amendment2-structure-closure
  remotes/origin/docs/self-service-v2-amendment3-structure-reconciliation
  remotes/origin/docs/selfops-v4-acceptance-refreeze-20261006
  remotes/origin/docs/semantic-delta-consolidation
  remotes/origin/docs/spec-evolution-governance-v1
  remotes/origin/docs/spec-governance-and-merge-gate-v1
  remotes/origin/docs/sra-v1-activation
  remotes/origin/docs/standing-delegation-v1
  remotes/origin/docs/standing-release-auth-v1
  remotes/origin/docs/succession-order
  remotes/origin/docs/trusted-cp-deploy-arch-closure-v2-spec
  remotes/origin/docs/trusted-fleet-curated-import-authority-v1
  remotes/origin/docs/v2-v3-succession-coordination
  remotes/origin/docs/v3-body-acceptance-alignment
  remotes/origin/docs/v3-succession-final
  remotes/origin/docs/v3-supersedes-amendment
  remotes/origin/docs/v9-r1-evidence-correction
  remotes/origin/docs/wae-v2-pre-admission-recovery-successor
  remotes/origin/docs/wec1-008-lock-timing-supersede
  remotes/origin/docs/workflow-assignee-transition-capability-v1
  remotes/origin/docs/workflow-assignee-transition-test-home-amendment
  remotes/origin/docs/workflow-data-hygiene-v1-final-sweep-audit
  remotes/origin/docs/workflow-data-hygiene-v1-independent-audit
  remotes/origin/docs/workflow-dispatch-activation-source-merge-integration-v1
  remotes/origin/docs/workflow-dispatch-intent-broker-v1-spec
  remotes/origin/docs/workflow-dispatchability-rfi-v1
  remotes/origin/docs/workflow-domain-instances-broker-v1-clean-p0
  remotes/origin/docs/workflow-domain-instances-broker-v1-p0
  remotes/origin/docs/workflow-domain-instances-pagination-v1
  remotes/origin/docs/workflow-domain-instances-pagination-v2-successor
  remotes/origin/docs/workflow-execute-governance-cleanup-amendment-v1
  remotes/origin/docs/workflow-execute-receipt-recovery-v2-audit
  remotes/origin/docs/workflow-execute-unified-deployment-v1
  remotes/origin/docs/workflow-execute-unified-write-tool-v1
  remotes/origin/docs/workflow-global-instances-capability-v1-spec
  remotes/origin/docs/workflow-global-instances-capability-v2-successor
  remotes/origin/docs/workflow-transition-amend-acceptance
  remotes/origin/docs/workflow-transition-pinned-hotfix-deployment-v1
  remotes/origin/dsh-agent-core-native-history-events-20261017
  remotes/origin/e12-dev-exec-authority-collapse-20261002
  remotes/origin/evidence/development-execution-surface-v1-canonical-closure-20260924
  remotes/origin/evidence/forum-gov-v1-owner-acceptance
  remotes/origin/evidence/forum-governance-tool-surface-v1
  remotes/origin/evidence/luna-fallback-candidate-20260830-v1
  remotes/origin/feat/agent-child-tmpdir-override-v1
  remotes/origin/feat/agent-core-backup-retention-v1
  remotes/origin/feat/agent-core-binding-workspace-v1
  remotes/origin/feat/agent-core-binding-workspace-v1-real-boot-fix
  remotes/origin/feat/agent-core-credential-provisioning-simplification-v1
  remotes/origin/feat/agent-core-distribution-bootstrap-v1
  remotes/origin/feat/agent-core-production-resident-v1
  remotes/origin/feat/agent-definition-config-v1
  remotes/origin/feat/agent-primary-workspace-import-v1
  remotes/origin/feat/agent-principal-reverse-resolution-v1
  remotes/origin/feat/agent-repo-knowledge-gov-implementation
  remotes/origin/feat/agent-router-delivery-v0
  remotes/origin/feat/agent-session-messaging-v1
  remotes/origin/feat/agent-session-v1
  remotes/origin/feat/agent-workspace-session-v2-core-alignment
  remotes/origin/feat/b2-auto-recovery
  remotes/origin/feat/backend-session-history-v1
  remotes/origin/feat/broker-definition-input-contract-read
  remotes/origin/feat/broker-transport-v1
  remotes/origin/feat/chatgpt-subscription-provider-v1-implementation
  remotes/origin/feat/chatgpt-subscription-target-proxy-seam-v1
  remotes/origin/feat/component-foundations
  remotes/origin/feat/delivery-pipeline-integration-v0
  remotes/origin/feat/execution-attention-summary-v1
  remotes/origin/feat/feishu-mention-policy-final-delivery
  remotes/origin/feat/feishu-phase-a-ff-delivery
  remotes/origin/feat/feishu-phase-a-final-closure
  remotes/origin/feat/feishu-phase-a-final-revision
  remotes/origin/feat/feishu-phase-a-merge-candidate
  remotes/origin/feat/feishu-processing-reaction-production
  remotes/origin/feat/feishu-static-card-final-delivery
  remotes/origin/feat/feishu-ux-operational-cutover
  remotes/origin/feat/integration-v1
  remotes/origin/feat/lark-channel-sdk-foundation-v1
  remotes/origin/feat/lark-channel-sdk-integration-v2-phase-a
  remotes/origin/feat/lark-ux-phase1-v2-final
  remotes/origin/feat/mobile-gate1-local-runtime-v1
  remotes/origin/feat/notification-ingress-v0
  remotes/origin/feat/open-source-docs-convergence-v1-implementation
  remotes/origin/feat/product-integration-v1
  remotes/origin/feat/production-integration-v1
  remotes/origin/feat/production-runtime-v1
  remotes/origin/feat/recovery-governance-r1-r4
  remotes/origin/feat/scheduler-caller-migration-v1
  remotes/origin/feat/scheduler-production-cutover-closure-v1
  remotes/origin/feat/scheduler-replacement-v1
  remotes/origin/feat/scheduler-router-final-integration-v1
  remotes/origin/feat/self-evolution-plugin-experiment-v1
  remotes/origin/feat/stock-agent-registry-adoption-v1
  remotes/origin/feat/trusted-cp-agent-definition-compat-v1
  remotes/origin/feat/trusted-cp-deployment-hardening-v1
  remotes/origin/feat/trusted-credential-broker-v1
  remotes/origin/feat/voice-transcription-impl
  remotes/origin/feat/workflow-domain-pagination-v2
  remotes/origin/feat/workflow-execute-unified-write-tool-v1
  remotes/origin/feature/census-step7-fix-v1
  remotes/origin/feature/credential-seam-wiring-v1
  remotes/origin/feature/notification-ingress-service-auth-v1
  remotes/origin/feature/progress-checkpoint-v1-20260928
  remotes/origin/fix/1370-generation-policy-impl
  remotes/origin/fix/656367cd-landing-prep
  remotes/origin/fix/admission-budget-fairness
  remotes/origin/fix/agent-generation-durable-restart-safety-v1
  remotes/origin/fix/agent-generation-durable-restart-safety-v1-followup
  remotes/origin/fix/broker-error-detail-passthrough
  remotes/origin/fix/canonical-onboarding-store-owner-wiring
  remotes/origin/fix/compat-reader-writer-guard
  remotes/origin/fix/des-continue-midrun-instruction-loss-v1
  remotes/origin/fix/diagnostic-read-separation
  remotes/origin/fix/enable-idempotency
  remotes/origin/fix/history-listener-error-resilience
  remotes/origin/fix/history-listener-error-resilience-rebased
  remotes/origin/fix/hr-reset-resume-v1-20260929
  remotes/origin/fix/luna-fallback-candidate-r1
  remotes/origin/fix/model-route-fleet-default
  remotes/origin/fix/provisioning-client-id-selection
  remotes/origin/fix/provisioning-realpath-equivalence
  remotes/origin/fix/provisioning-shared-codex-deployment-root-v1
  remotes/origin/fix/retire-executor-decouple
  remotes/origin/fix/sched-classify-normal-terminals
  remotes/origin/fix/scheduler-cp-admission-provisioning-issue3
  remotes/origin/fix/scheduler-cp-admission-selftest-credential-fixture
  remotes/origin/fix/scheduler-slot-accounting-invariant
  remotes/origin/fix/scheduler-test-glob-subdirs
  remotes/origin/fix/scheduler-tool-surface-response-v1
  remotes/origin/fix/self-ops-reconcile-termination-write-v1
  remotes/origin/fix/shutdown-contract-r2
  remotes/origin/fix/trusted-cp-pack-input-provenance-v1
  remotes/origin/fix/trusted-deploy-meta-node-modules-cycle
  remotes/origin/fix/trusted-deploy-reuse-directory
  remotes/origin/fix/unknown-fence-late-settlement-v1
  remotes/origin/fix/wda-authoring-domain-resolution-guidance
  remotes/origin/fix/wec4-lock-timing
  remotes/origin/fix/workflow-authoring-publish-contract-compat
  remotes/origin/fix/workflow-v5-distribution-recovery-20261004
  remotes/origin/goal/agent-directory-tool-v1
  remotes/origin/goal/asm-standalone-production-v1
  remotes/origin/goal/c11-r1-trusted-late-outcome-selfheal
  remotes/origin/goal/canonical-agent-fleet-send-policy-v1
  remotes/origin/goal/default-model-routing-config-v1
  remotes/origin/goal/default-model-routing-config-v1-spec
  remotes/origin/goal/default-model-routing-prerequisite-v1
  remotes/origin/goal/development-execution-surface-v1
  remotes/origin/goal/execution-history-correlation-v1
  remotes/origin/goal/gpt6-luna-reasoning-effort-v1-integration
  remotes/origin/goal/mobile-history-integration
  remotes/origin/goal/mobile-session-history-v3
  remotes/origin/goal/night-mobile-session-history-wiring-v1
  remotes/origin/goal/scheduler-retry-minter-cross-revision-v1
  remotes/origin/goal/scheduler-self-healing-deploy-freeze-v1
  remotes/origin/goal/scheduler-self-healing-impl-v1
  remotes/origin/goal/scheduler-terminal-proof-unknown-containment-v1
  remotes/origin/goal/session-centric-execution-traceability-v1
  remotes/origin/goal/tailnet-auth-v3
  remotes/origin/goal/tools-v4-self-ops-model-visible
  remotes/origin/goal/wec-scheduler-verifier-parity-v1
  remotes/origin/goal/workflow-assignee-admission-guard-v1
  remotes/origin/goal/workflow-domain-owner-archive-capability-repair-v1
  remotes/origin/governance/adopt-development-governance-v1.0.0
  remotes/origin/governance/adopt-development-governance-v1.0.3
  remotes/origin/governance/adoption-v1.1.0
  remotes/origin/governance/code-structure-guardrails-v1-exec-a2
  remotes/origin/governance/convergence-and-minimum-live-slice
  remotes/origin/impl/agent-fleet-send-entitlement-e2e-v1
  remotes/origin/impl/agent-session-send-reliability-v1
  remotes/origin/impl/broker-error-preservation-v1
  remotes/origin/impl/coordinator-control-plane-broker
  remotes/origin/impl/credential-metadata-resolution-v1
  remotes/origin/impl/critical-job-guard-structure-split
  remotes/origin/impl/critical-job-self-disable-guard
  remotes/origin/impl/critical-job-self-disable-guard-repair
  remotes/origin/impl/feishu-processing-reaction-v1
  remotes/origin/impl/feishu-static-reply-card-v1
  remotes/origin/impl/forum-governance-notifications-surface
  remotes/origin/impl/forum-moderation-capabilities-v1
  remotes/origin/impl/forum-moderation-capabilities-v2
  remotes/origin/impl/forum-moderation-capabilities-v2-r2
  remotes/origin/impl/luna-cold-backup-v2
  remotes/origin/impl/luna-fallback-candidate-v1
  remotes/origin/impl/mention-requirement-config-split
  remotes/origin/impl/ordered-route-chain-v1
  remotes/origin/impl/process-lifecycle-hardening-v2
  remotes/origin/impl/return-policy-exhausted-declarer-v1-20260929
  remotes/origin/impl/route-chain-activation-phase-a-v1
  remotes/origin/impl/scheduler-card-delivery-v1
  remotes/origin/impl/scheduler-disposition-alert-lifecycle-v1
  remotes/origin/impl/scheduler-v2-wire-proof
  remotes/origin/impl/self-service-scheduler-unified-tool-v1
  remotes/origin/impl/self-service-structure-split
  remotes/origin/impl/workflow-assignee-transition-v1
  remotes/origin/impl/workflow-dispatch-intent-broker-v1
  remotes/origin/impl/workflow-domain-instances-broker-v1
  remotes/origin/impl/workflow-domain-instances-broker-v1-wip
  remotes/origin/impl/workflow-domain-instances-pagination-v1
  remotes/origin/impl/workflow-global-instances-capability-v1
  remotes/origin/implementation/broker-capabilities-test-decomposition
  remotes/origin/implementation/canonical-onboarding-wiring-v1
  remotes/origin/implementation/credential-rotation-seam-v1
  remotes/origin/implementation/credential-store-trusted-zone-v1
  remotes/origin/implementation/fleet-shared-codex-bootstrap-v1
  remotes/origin/implementation/scheduler-am3-structure-continuation
  remotes/origin/implementation/workflow-agent-execution-v2
  remotes/origin/implementation/workflow-agent-execution-v2-recovery
  remotes/origin/implementation/workflow-global-instances-v2
  remotes/origin/integrate/dsh-agent-core-modularity-phase-a-v1
  remotes/origin/integration/gpt6-luna-reasoning-effort-v1-20260924
  remotes/origin/integration/personal-assistant-execution-v1-20260928
  remotes/origin/integration/trusted-ingress-feishu-regression-clean
  remotes/origin/live-restore/t0-backflow-20260930
  remotes/origin/main
  remotes/origin/native-conversation-pilot-v1-deploy
  remotes/origin/ops/d0-entry-provenance
  remotes/origin/ops/d1d2-validator-impl
  remotes/origin/ops/entry-binding-census
  remotes/origin/ops/fleet-window-authority-accept
  remotes/origin/ops/fleet-window-authority-proposal
  remotes/origin/ops/issue-triage-20261109
  remotes/origin/ops/release-convergence
  remotes/origin/ops/sra-control-census
  remotes/origin/p0/dispatch-recovery-v2
  remotes/origin/p0/dispatch-recovery-v3
  remotes/origin/p0/workflow-dispatch-recovery
  remotes/origin/prep/audit-spec-revisions-v1
  remotes/origin/prep/scheduler-spec-revision-v1
  remotes/origin/prep/session-spec-revision-v1
  remotes/origin/prod-adoption
  remotes/origin/product-389-a5-qualification-coexistence-v1
  remotes/origin/product-434/a1-module-missing-repair-r1
  remotes/origin/product-434/hr-runtime-despecialization
  remotes/origin/product-434/retirement-packet-r1
  remotes/origin/product-455-a6-ingress-handoff-20261006
  remotes/origin/product-456-a7-reconcile-store-20261006
  remotes/origin/product-456-a7-structure-gate-repair-20261006
  remotes/origin/product-468-d3-hr-reset
  remotes/origin/product-477-deploy-infra-restore-truth
  remotes/origin/product-478-g5-human-work-item-feishu-ingress
  remotes/origin/product-480/g7-workflow-collaboration-slice
  remotes/origin/recon/business-recovery-20261108
  remotes/origin/recon/m7-root-writer
  remotes/origin/recon/pertarget-successors
  remotes/origin/records/oc-go-hemostasis-owner-gate-v1
  remotes/origin/release/547-d-minimal-prep
  remotes/origin/repair/dsh-shutdown-contract
  remotes/origin/review/dsh-trusted-ingress-align-1
  remotes/origin/review/dsh-trusted-ingress-align-2
  remotes/origin/sched-cp-alert-dedupe
  remotes/origin/sched-cp-reconciled-run-failed-suppression
  remotes/origin/sched-cp-regression-repair
  remotes/origin/sched-cp-rel-amend1
  remotes/origin/sched-cp-rel-hardening
  remotes/origin/sched-cp-rel-packet-tools
  remotes/origin/sched-cp-rel-w1probe
  remotes/origin/sched-cp-reliability-v1
  remotes/origin/scheduler-v2-impl
  remotes/origin/scratch/forum-v2-11file
  remotes/origin/spec/agent-fleet-cutover-v1
  remotes/origin/spec/agent-primary-workspace-openclaw-compat-v3
  remotes/origin/spec/agent-principal-reverse-resolution-v1
  remotes/origin/spec/agent-trusted-home-cross-uid-access-v1
  remotes/origin/spec/agt-cto-agent-primary-workspace-openclaw-in-place-v1
  remotes/origin/spec/chatgpt-subscription-provider-v1
  remotes/origin/spec/deployment-runtime-closure-invariants-v1
  remotes/origin/spec/fleet-shared-codex-authsvc-reconciliation-amendment-accept
  remotes/origin/spec/openclaw-trusted-zone-parent-traverse-access-v1
  remotes/origin/spec/session-centric-execution-traceability-v1
  remotes/origin/spec/workflow-admin-agent-bootstrap-v1
  remotes/origin/spec/workflow-admin-agent-bootstrap-v1-clean-r4
  remotes/origin/spec/workflow-admin-bootstrap-operator-v1
  remotes/origin/spec/workflow-agent-execution-v1
  remotes/origin/spec/workflow-domain-instances-capability-v1
  remotes/origin/svc/b7-closure-runtime-arch-gate-20261002
  remotes/origin/svc/b7-joint-recovery-candidate-20261005
  remotes/origin/svc/b7-shared-codex-deployment-root-refreeze-20261001
  remotes/origin/svc/b7-v21-packet-repair-20261002
  remotes/origin/svc/b7-v22-packet-repair-20261002
  remotes/origin/svc/b7-v23-packet-repair-20261002
  remotes/origin/tests/hr-availability-regression-20260929
  remotes/origin/w0-release-safety-430
  remotes/origin/w0-release-safety-430-floor50g
  remotes/origin/w0-scheduler-auth-audience-template-v1
  remotes/origin/zcode/domain-owner-assistance-v1-20260928
  remotes/origin/zcode/fixedop-async-725
  remotes/origin/zcode/governance-adoption-ci
  remotes/origin/zcode/owner-assistance-deploy-handoff-v1-20260929
  remotes/origin/zcode/release-package-567-20261007
  remotes/origin/zcode/release-packet-567-review-fixes
  remotes/origin/zcode/workflow-node-session-history-v1-app-20260928

exec
/bin/zsh -lc "rg -n 'HG-WEC5-LOCK-TIMING|HG-RULING4-SOURCE|ACC-HG-007|6622750077|backlog-convergence|3C ruling|WEC5' docs .github; rg --files -g AGENTS.md /tmp/review-627 /tmp 2>/dev/null | head -70" in /tmp/review-627/repo
 succeeded in 0ms:
rg: .github: No such file or directory (os error 2)
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:59:不变；优先级按本地治理。该固定 main 快照只读核对，不表示 WEC5 已进入本分支的旧
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:75:无需请求 Owner 重复决定。已核验来源为 [#1352 comment-6622750077](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)：
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:82:`$.rulings[id=owner-20261108-backlog-convergence].items[3]` 已本地只读核实：仅常设授权
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:114:  `authority_reference_main` 的 accepted WEC5 及其携带的 CTR-WEC1-008、CTR-WEC4-010、
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:141:`EVD-HG-004`：`OBS-HG-004` SUPPORTS §3 当前 WEC 权威、CTR-HG-007/ACC-HG-007 的
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:282:沿 WEC5 携带的 CTR-WEC4-010：先在既有 admission lock 内 replay ledger，捕获 detached
docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:373:| ACC-HG-007 / CTR-HG-007 | settled 正例与 UNKNOWN/pending/legacy baseline/换 tuple/STOP 反例；分别 barrier 暂停 A 的远端 pre-plan/evidence collection，令无关 B admission；真实独立双 writer 共享 ledger；采集后注入相关本地/外部 drift；并发/重复/replay/旧 cases | 隔离实际 Core engine/ledger/OwnerLock + Svc，按 WEC5 携带的 ACC-WEC4-003 | 两次 collection 锁外 barrier、同锁获取/释放、current replay、fresh 权威终检及 sequence/version 等值、全部 durable lines、delivery count、等待耗时含终检、implementation SHA | 两个 interval 中 B 均在解除 A barrier 前完成；A 仅在终检通过后单次 append；一个 resolve 最多一个 N+1；原 budget/STOP 与全部 writer append 保持，相关 drift 零 plan/消费/delivery | B 被 A collection 阻塞、锁内重跑整套采集、漏报终检等待、无权威等值终检、丢 append、双消费、新 permit store、补/换 baseline、UNKNOWN resume、自动续跑 |
/tmp/review-627/repo/AGENTS.md
/tmp/review-688/repo/AGENTS.md
/tmp/d0-entry-provenance-delivery-20261109/AGENTS.md
/tmp/gov-check/AGENTS.md
/tmp/entry-binding-census-delivery-20261109/AGENTS.md
/tmp/review-627/repo/AGENTS.md
/tmp/sra-control-census-delivery-20261109/AGENTS.md
/tmp/review-687/repo/AGENTS.md
/tmp/fleet-window-authority-transfer.HA9kcs/repo/AGENTS.md
/tmp/prc-impl/AGENTS.md

exec
/bin/zsh -lc 'cat .agents/README.md .agents/local/README.md .agents/skills/spec-governance/SKILL.md' in /tmp/review-627/repo
 succeeded in 0ms:
# Development Grammar V1

```text
GRAMMAR_VERSION = 2.0.0-rc.1
GOVERNING_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_V1
STATUS = accepted
ENFORCEMENT_LEVEL = manual_policy_plus_deterministic_integrity
```

This is the shared operating grammar for repositories developed across many Agent sessions. Product Direction, Architecture, governing Specs, investigations, implementation records, and runtime evidence remain in their owning repository.

After this file, read `.agents/local/README.md` when present.

## Context budget

For an ordinary task, load only:

1. this grammar;
2. repository-local governance;
3. directly relevant accepted authorities;
4. the Spec-governance router and one selected mode.

Do not preload every protocol, template, rationale, prior review, or example. Resume from the existing current task/release record and its directly referenced active authorities and Evidence. Read historical records only to resolve a specific provenance or dependency question; their age or filename does not determine authority. Keep historical evidence readable without loading it as the control plane.

## Minimum loop

```text
1. Fix target repository, candidate Head, and integration Base.
2. State GOAL/TARGET and CURRENT_GAP.
3. Locate Product Authority in precedence order.
4. Separate OBSERVATION from WORKING_GUESS when interpretation affects routing.
5. Classify independently: AUTHORITY_ACTION, PLAN_LEVEL, ASSURANCE_LEVEL.
6. Check Execution Mandate, load-bearing SPEC_GAP, Evidence reviewability,
   live authority gap, and candidate/Base movement.
7. Select the shortest authorized route and artifact set.
8. Execute only within accepted Contracts and the mandate.
9. Review the affected surface with executed Evidence.
10. DONE_WHEN met without EXPANSION_TRIGGER -> STOP.
```

## Semantic primitives

Epistemic entities:

- **Observation** — direct recorded result with source, revision, environment, time, method, result, and provenance.
- **Claim** — interpretation with `SUPPORTED`, `INFERRED`, or `OPEN_ASSUMPTION` support state.
- **State** — a time- and coordinate-bound projection from Observations and necessary Claims.

Normative entities:

- **Goal** — desired outcome; it does not authorize mutation.
- **Decision** — selected direction made by an owning authority.
- **Contract** — stable testable obligation created by an accepted Decision.

**Evidence** is a qualified relation from Observation(s) to a named Claim, State assertion, or Contract at exact coordinates.

```text
Test Definition != Observation
Executed Result with coordinates = Observation
Qualified Observation-to-target relation = Evidence
Activity != Knowledge
Activity != Progress
```

Load-bearing Evidence in a governing Spec or Conformance Record uses stable `EVD-*` identity and records source, target, relation, coordinates, sufficiency, limitations, and provenance. A Routine Change Brief does not require a complete research graph unless a load-bearing interpretation depends on it.

## Product Authority and Execution Mandate

Only active accepted Product Direction, Architecture/invariant authority, or governing Spec in the owning repository may create or change long-lived Product Contracts.

These do not create Product Authority:

```text
Investigation
Task or prompt
Change Brief
ExecPlan
Execution Mandate
Controlled Runbook
test definition
runtime state
Review comment
```

A valid **Execution Mandate** authorizes and constrains one task or operation. It binds an attributable issuer, target, scope, allowed/forbidden effects, and `DONE_WHEN`. A controlled mutation additionally binds actor/role, environment, exact operation or operation class, abort conditions, Secret handling, receipt requirements, and validity/attempt bounds. It cannot create or weaken Product Contracts. An Agent-authored Brief cannot self-authorize.

Every mutation—including code, documentation, configuration, schema, behavior-defining tests, generated files, and operational state—MUST have attributable authorization before it begins. The authorization may be carried by a Task, Issue, PR, Brief, or dedicated mandate; it need not become a separate large document, but it MUST remain persistent and reviewable. All write work MUST use an isolated worktree or equivalent isolated write surface bound to an exact parent, isolated ref, and single intended tree without mutating another active checkout.

## Three independent PREFLIGHT axes

### Authority action

```text
REUSE | AMEND | SUPERSEDE | NEW
```

- `REUSE`: active accepted Product Authority already decides the behavior and no Contract meaning changes.
- `AMEND`: a named proposed authority changes inside its declared scope, ownership, and bounded Decision identity; or accepted authority gets strictly additive new IDs under unchanged Goal, scope, ownership, and accepted Decisions.
- `SUPERSEDE`: accepted meaning is deleted, narrowed, expanded, reversed, replaced, or receives different failure semantics. Use a whole-authority successor and atomic backlinks.
- `NEW`: no active accepted authority owns the bounded independent decision, or a targeted proposal's scope, ownership, or bounded Decision identity changes.

`AMEND_OR_NEW_PENDING_OWNERSHIP` is investigation-only and must resolve before any readiness boundary.

An accepted authority permits implementation only when it declares `implementation_authority: contracts` and the request is inside those Contracts. An accepted Program or `implementation_authority: none` does not authorize child implementation.

### Plan level

```text
NONE | BRIEF | EXEC_PLAN
```

- `NONE`: trivial bounded work with machine-supported semantic identity.
- `BRIEF`: bounded non-trivial work.
- `EXEC_PLAN`: multi-phase, cross-component, dependency-sensitive, migratory, or otherwise complex execution.

Risk alone does not create an ExecPlan.

### Assurance level

```text
ROUTINE | DURABLE | CONTROLLED
```

- `ROUTINE`: readily reversible and low consequence.
- `DURABLE`: persisted/public/package/lifecycle/migration surface requiring independent affected-Contract review.
- `CONTROLLED`: identity, auth, permission, Secret, Grant, destructive migration, deletion, production activation, cross-repository public protocol, irreversible operation, or comparable high consequence.

A Controlled Runbook is an Assurance artifact, not a Plan level. A one-shot operation may be `BRIEF + CONTROLLED`.

## Default routes

| Authority | Assurance | Default route |
|---|---|---|
| `REUSE` | `ROUTINE` | Brief as needed + implementation + focused Evidence |
| `REUSE` | `DURABLE` | Brief/ExecPlan + implementation + independent affected-Contract review |
| `REUSE` | `CONTROLLED` | valid mandate + exact runbook + receipt + independent post-state verification; no new Spec solely for risk |
| `AMEND/NEW` | `ROUTINE/DURABLE` | Spec delta and implementation may share one atomic PR when local authority permits |
| `AMEND/NEW` | `CONTROLLED` | docs-first Product Authority, then controlled execution |
| `SUPERSEDE` | any | docs-first whole-authority successor |

### Route stage and docs-first gate

Every structured route records:

```text
ROUTE_STAGE = AUTHORITY_AUTHORING | IMPLEMENTATION | OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES | NO | NOT_APPLICABLE
```

`AMEND/NEW + CONTROLLED` remains in `AUTHORITY_AUTHORING` with implementation and operation forbidden until the new authority is accepted in the relevant base. Every `SUPERSEDE` route is docs-first and cannot share a same-stage implementation or operation. After the authority is accepted, the actual implementation or operation is a new task routed as `REUSE`.

`AMEND/NEW + ROUTINE/DURABLE` MAY combine Spec delta and implementation only when local authority explicitly permits that atomic route. This exception never applies to `CONTROLLED` or `SUPERSEDE`.

Implementation detail does not become a Contract because an Investigation, PR body, test, or Reviewer repeats it. A public interface, permission, security, durable-data, lifecycle, or compatibility obligation cannot be demoted by calling it an implementation detail.

## One legal effect per artifact

- Standing Spec / Spec delta — Product Authority.
- Change Brief — one change's goal, gap, route, scope, Evidence, and stop boundary.
- ExecPlan — phases, dependencies, checkpoints, rollback, and re-PREFLIGHT triggers.
- Execution Mandate — one operation's authorization and limits.
- Controlled Runbook — dangerous operation steps, aborts, receipts, and verification.
- Receipt / Conformance Record — what happened and what it verifies.
- Investigation — durable non-authoritative findings and alternatives.

## Load-bearing gaps and Evidence

A Reviewer may identify a missing long-lived decision but cannot write it in Review. When implementation, merge, or operation depends on it:

```text
SPEC_GAP_DEPENDENCY = LOAD_BEARING
AUTHORITY_ACTION = AMEND | SUPERSEDE | NEW
at least one applicable readiness boundary = NO
all readiness boundaries = NOT_APPLICABLE  # forbidden
NEXT_ACTION = RE_PREFLIGHT
```

`REUSE` and `AMEND_OR_NEW_PENDING_OWNERSHIP` cannot cross this readiness boundary. `OWNER_DECISION_REQUIRED = YES` may record that the re-PREFLIGHT needs an Owner decision, but `OWNER_DECISION` cannot replace the required `RE_PREFLIGHT` route result.

A stopping gap needs a concrete diagnosis in the existing record: the affected action, missing long-lived decision, authority inventory searched, reachable counterexample, impact, minimum closure, and whether removing the dependency or using an already-authorized bounded path avoids it. A missing decision cannot cite its own nonexistent Contract; it must demonstrate the dependency instead. An invalid or incomplete diagnosis does not grant execution permission: retain a safe pause on genuinely uncertain affected work, request only the missing fact, and do not launch speculative redesign.

Required Evidence must be accessible to the designated independent Reviewer, reproducible in an authorized environment, or represented by a sanitized coordinate-bound receipt from a legally independent actor.

```text
inaccessible / unverifiable / unknown provenance -> REQUIRED_GATE_FAILURE
fabricated / materially distorted / falsely claimed execution -> FALSE_EVIDENCE
```

Secret values are not exposed to prove reviewability.

## Model convergence and retirement

When the current task actually touches historical alternatives — historical IDs, duplicate models, old fields or configuration keys, old API/CLI entrypoints, legacy state stores, fallback paths, compatibility adapters, replacement dependencies, or old runtimes/recovery paths — inspect whether the same business responsibility is served by multiple independently maintained executable models. Different identifiers alone are not duplication: preserve genuinely distinct entities such as multi-credential, multi-tenant, per-service eligibility, and supported-protocol differences, and never merge on name similarity, prefixes, or unverified historical mapping.

Prefer migrating real consumers and retiring the replaced executable path over adding a permanent mapping, fallback, or compatibility layer. Record each affected fact as one disposition:

```text
RETAIN           distinct responsibility or still-supported surface; no merge
RETIRE           obsolete executable path exits execution
MIGRATE          consumers move to the current model, then the old path exits
TEMPORARY_BRIDGE bounded compatibility with a real consumer and an exit condition
```

A stable supported public facade may remain permanently; it is not an obsolete path merely because it is old. Only a temporary migration bridge owes a real consumer and an objectively verifiable exit condition.

Declaring final convergence requires evidence that the new path is usable, the retired executable path is excluded from affected normal, fallback, and restart/recovery routes, and recovery does not revive it. Retirement removes execution, never historical evidence: audits, receipts, migration records, and necessary tombstones stay readable without granting present eligibility. Unknown or unexecuted coverage stays unknown; it must not become zero or PASS.

Convergence questions apply only to affected work. An unrelated small fix keeps its normal short route: no global census, no empty matrix, no new approval. Parallel or multi-Agent work remains optional; every actual write still needs its own attributable authorization and isolated write surface. Practical refactoring technique beyond this rule is optional method guidance, never a new MUST.

## Live state ahead of authority

```text
LIVE_STATE = Observation, not authority
EXPANSION = FROZEN
AUTO_DELETE = NO
PERMANENT_GRANDFATHER = NO
```

An authorized Owner/risk actor issues temporary scope-bound containment with an expiry or closure condition. Close the long-lived gap docs-first, perform minimum reconcile after acceptance, independently verify conformance, end containment, and stop.

## Emergency containment

A pre-Spec emergency action is limited to rollback, disablement or shutdown, revocation, isolation, or equivalent containment. It MUST have attributable Owner authorization and an incident reference, MUST NOT introduce durable new behavior, and MUST require permanent repair to return through normal PREFLIGHT and Product Authority. Emergency containment may authorize the minimum operation needed to reduce harm; it does not authorize feature implementation, merge, or permanent semantics.

## Review coordinates and Blockers

```text
REVIEW_TARGET_HEAD = exact candidate under review
BASE_HEAD = integration snapshot used for review
CURRENT_BASE_HEAD = current branch tip at impact recheck
```

Unrelated Base movement is not candidate-Head drift. Re-review affected semantics only when candidate semantics, relevant authority, affected behavior/Evidence, or a real conflict changes. A receipt-only or lifecycle-only Head change still gets independent final-Head delta recheck, not automatic full review. A bounded semantic repair gets independent delta review of that repair and invalidated dependencies. Full review needs an initial review, an identified accepted full-review gate, or demonstrated unbounded impact; a new SHA is not a sufficient reason.

A Blocker uses one class:

```text
CONTRACT_VIOLATION
REPOSITORY_INVARIANT_VIOLATION
CONCRETE_REGRESSION
SECURITY_OR_DATA_LOSS
FALSE_EVIDENCE
SCOPE_ESCALATION
REQUIRED_GATE_FAILURE
```

Every Blocker states `SOURCE`, `COUNTEREXAMPLE`, `IMPACT`, and `MINIMAL_CLOSURE`. Name the affected readiness boundaries; an open Blocker requires at least one of them to be `NO` and none to be `YES`. Unrelated authorized work may continue. A load-bearing `SPEC_GAP` is a separate finding type but not an exemption from justifying a stop. Legal sources are active accepted Product Authority, accepted local governance/invariant authority, a pre-existing active machine gate, or a valid Execution Mandate. Investigation, proposed tests, task product prose, Reviewer preference, and Review comments are not Product-Contract sources.

Current or resumed decisions use route `schema_version: 2` and every open Blocker names `affected_readiness`. The default validator rejects schema-v1 input. Historical schema-v1 findings may be viewed with the explicit `--legacy-inspection` mode, which preserves their structural semantics without inventing a global stop and never certifies current readiness. History is not rewritten; a current decision is a new v2 record with its real scope and applicable authority.

Other findings are `SPEC_GAP`, `FOLLOW_UP`, or `TOOLING_DEBT`. Tooling debt blocks a product only when it causes false pass, harms non-test data, hides a concrete security/data-loss failure, or is itself an accepted deliverable.

## Goal and stop controls

Every non-trivial route records:

```text
GOAL_OR_TARGET
CURRENT_GAP
AUTHORITY_ACTION
PRIMARY_AUTHORITY
PLAN_LEVEL
ASSURANCE_LEVEL
EVIDENCE_NEEDED
DONE_WHEN
```

Durable, controlled, or expansion-prone work also records `EXPANSION_TRIGGER`. Use `NEXT_REAL_ACTION` when governance/infrastructure drift is plausible.

```text
DONE_WHEN met + EXPANSION_TRIGGER not fired -> STOP
```

Optional platform work, extra fault research, Agent availability, sunk effort, and non-load-bearing harness imperfection are not expansion triggers.

## Proportional conformance

A Conformance Record binds exact Product Authority revision, implementation revision, environment, evaluation time, implementation state, verification state, `conformance_result`, executed Observations, and Evidence relations.

Standard review covers affected Contracts and directly dependent accepted invariants. Controlled operations, releases, explicit full audits, and unbounded surfaces use the complete applicable matrix. The complete applicable matrix is complete for the bounded release/operation, not every Contract in every reachable repository. Identify its scope before execution. A prior mechanism is not rerun unless the new change invalidates it. Rebind unaffected evidence through an explicit impact check; never copy an old `VERIFIED` claim onto changed coordinates. Fresh runtime/authority/pre-state checks remain fresh where the applicable gate requires them.

`VERIFIED` applies only to the exact bound tuple and is never a permanent property of a Spec.

## Bounded delivery loop

Use one current Brief, task, PR, or release record, not a new control-plane document. It references the accepted scope, applicable gates, actual authorization, valid blockers, last real action, and next executable action; a status field never creates authority.

Freeze the acceptance scope and applicable gates for that delivery. Reviewers may expose violations and genuinely missing dependencies, not silently add product requirements. Newly discovered concrete security/data-loss risks, missing authority, false Evidence, required-gate failures, and business/runtime canary failures still stop affected work. Optional hardening remains follow-up debt. Changing the accepted scope or gates needs the owning authority's explicit disposition, not a review preference.

Retain review/repair history against the original business outcome, not proposal filenames or candidate names. Suggested working pattern: one initial review, a consolidated repair pass, then affected delta review. Repeated work without new evidence is a reason to reassess scope, split optional work, or try a simpler authorized path. This is diagnostic guidance, not a numeric cutoff, new acceptance gate, or reason to forbid an otherwise authorized repair. Any task-specific budget comes from its applicable authorization; existing Blockers, Done When, and Expansion Trigger remain controlling.

When the next action is within current authorization and its required gates pass, perform it rather than producing another unchanged ready packet. If it is blocked, report that action, the failed prerequisite, its owner, and the minimum fix. Do not try a known unsafe or unauthorized action merely to obtain an error. No new observation means no new recursive review or authority-reconciliation cycle. Report real waiting states as waiting; a child review task's completion is not delivery of the business outcome.

During an incident, prefer an existing accepted recovery path with a valid mandate, abort/rollback controls, and receipts. Separate optional generalized recovery hardening. Incident status never authorizes blind retry, fence removal, privilege bypass, or a second Run while external effects remain unknown.

## Adoption and history

This source repository is not automatically authoritative in a consumer. A consumer vendors an exact commit, reviews it locally, records preparation separately from acceptance, and activates it only after merge into its authority branch.

Do not bulk-rewrite history. Apply V1 from the next applicable change forward.

`.agents/protocol/SPEC_GOVERNANCE_V0.md` is historical compatibility material. The active workflow is `.agents/protocol/SPEC_GOVERNANCE_V1.md`.
# Repository-local governance — dsh-agent-core

This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.

## Repository identity

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
GOVERNANCE_LOCK = .agents/governance.lock.json
ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
```

A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.

## Authority precedence

```text
explicit Product Direction authority, when one is accepted
> accepted Product Architecture and standalone long-lived Current Decisions
> accepted implementation-authorizing Specs
> code, tests, runtime state, migration records, and operational evidence
```

Current repository authority locations:

```text
PRODUCT_DIRECTION = NONE_STANDALONE
PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
CURRENT_DECISION_INDEX = docs/decisions/README.md
DECISIONS = docs/decisions/
SPECS = docs/specs/
```

Local rules:

- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
- an accepted-looking document on an unmerged branch is not active authority;
- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.

## Bounded-development route (effective on V3 adoption only)

These local choices become active only with the accepted
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
Until then, the authority branch's existing rules remain controlling.

- `REUSE` inside an accepted implementation Contract needs no new Spec or
  standalone Spec review merely because code changes. Use focused tests and the
  review required by its Assurance level.
- Explicitly permit one atomic Spec-delta-and-code PR for bounded
  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
  delta must be independently accepted before merge; it cannot contradict
  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
  boundaries, introduce destructive migration, or authorize production effects.
- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
  permissions are separate; missing production permission does not itself stop
  unrelated authorized nonproduction work.
- Review the affected change and invalidated dependencies. A new SHA alone does
  not require a full audit. Use the vendored explicit scope/impact checks.
- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
  full-corpus review, or new control-plane document is introduced here.

## Acceptance and review actors

```text
SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
```

A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.

## Governing and persistence locations

```text
SPECS = docs/specs/
INVESTIGATIONS = docs/investigations/
LONG_LIVED_DECISIONS = docs/decisions/
IMPLEMENTATION_CONFORMANCE = implementation PR record
CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
EMERGENCY / INCIDENT_REFERENCE = persistent issue, PR, or report
```

## Current Owner-obligation Workflow authority

The accepted paired governing authorities are `docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` in svc-workflow and `docs/specs/AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` here, accepted by Root under user-delegated authority at reviewed semantic heads Svc `39587c33c8bcf26ad5689127f5c92a6abc8b562e` and Core `ac83fe5cea3701eb9436f74d1b5f6ed0013256a9`. The accepted Core whole successors are WAE V3, Assignee Transition Capability V3, WEC V3, GCR V2, WPO V4, and Owner Workflows V2. Assignee Transition Capability V2 is superseded by V3, and Owner Workflows V1 by V2, with reciprocal lifecycle links. The paired Svc acceptance-context successor is `SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2`. Governing Contracts authorize source implementation only after their accepted revisions are present in the implementation base; production apply remains none.

## Code structure rules

Current binding repository-local rule: [`.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`](CODE_STRUCTURE_GUARDRAILS_V2.md)
(frozen limits, fixed-baseline registry validation, candidate-delta gate and visible
historical debt). V2 and its V1 supersession activate atomically on main.
The implementation contract is
[`CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1`](../../docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md).
Implementation starts only after both accepted authorities are in its base.
The existing V1 runner remains unqualified for V2 until the implementation lands.

```text
RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md
EXCEPTION_REGISTRY = .agents/structure-registry.json
VERIFIER = node scripts/verify-code-structure.mjs --base <ref> --head <ref> [--json]
NPM = npm run verify:structure
```

Raw logs may remain outside Git, but every load-bearing Observation or Evidence relation must retain enough provenance to retrieve and interpret the source.

## Legacy transition

Before this adoption candidate, the repository had a local bootstrap in `AGENTS.md`, `.agents/README.md`, and two helper templates, governed by `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`.

This adoption is forward-only:

```text
NO_BULK_HISTORY_REWRITE = YES
EXISTING_ACCEPTED_ARTIFACTS_REMAIN_HISTORICAL_AUTHORITIES_UNTIL_EXPLICITLY_TOUCHED = YES
NEW_PARTIAL_SUPERSESSION = FORBIDDEN
```

Existing prose that describes partial supersession is legacy state. It is not a template for new work. When such an authority must change, create a complete standalone replacement and perform an atomic whole-authority supersession.

The pre-adoption local helpers:

```text
.agents/templates/development-preflight.md
.agents/templates/spec-compliance.md
```

remain compatibility aids only. They are not authority. New work uses the vendored Skill modes and templates.

At local adoption acceptance, `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` supersedes `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` as the repository's development-governance authority. The old Spec remains historical rationale.

## Enforcement maturity

Actual enforcement is:

```text
ENFORCEMENT_LEVEL = MANUAL_POLICY
DISTRIBUTION_INTEGRITY_CHECK = AVAILABLE
SPEC_FRONTMATTER_SCHEMA = AVAILABLE_REFERENCE
SEMANTIC_SPEC_VERIFIER = NOT_IMPLEMENTED
BASE_BRANCH_GATE = NOT_IMPLEMENTED
REQUIRED_BRANCH_PROTECTION = NOT_ENABLED
AUTOMATIC_SPEC_ACCEPTANCE = NO
CODE_STRUCTURE_VERIFIER = AVAILABLE (scripts/verify-code-structure.mjs; run via npm run verify:structure)
```

Run the vendored integrity verifier:

```bash
python3 .agents/tools/verify_governance.py --target .
```

After adoption is active on `main`, use `--require-accepted` when verifying the authority branch.

## Delivery convergence and proportional rollout

These repository-local rules refine review and rollout behavior without weakening the vendored blocker classes, Product Authority precedence, or Controlled-operation gates. They never authorize merge, deployment, or mutation while a known binding Blocker remains open.

### Recovery first when accepted mechanisms already exist

For an active availability incident, if an existing accepted operator/admin mechanism can safely restore service without changing long-lived Product Contracts, restore the service first and keep the permanent redesign in a separate lane.

```text
SAFE_EXISTING_RECOVERY_PATH = prefer now
LONG_TERM_REDESIGN = separate lane
INCIDENT_RECOVERY_MUST_NOT_WAIT_FOR_OPTIONAL_GOVERNANCE_WORK = YES
```

This does not permit blind retry, destructive repair, privilege bypass, or reinterpretation of an unknown external side effect.

For an authorized recovery, keep the old `outcome_unknown` record and its
business-side-effect uncertainty; do not replay its prompt or tools, erase it,
or infer success or failure from termination-only evidence. Before admitting an
explicitly new Session, Turn, or request, the exact mandate/runbook must prove
that both the old worker and its already-dispatched tool operations are
terminated or isolated from external effects, or that each actual write/delivery
boundary rejects the old identity. An epoch gate that only suppresses replies
is insufficient. If this proof is unavailable, keep the affected fence and stop.

Label offline tests as mechanism evidence. Claim live recovery only after a
fresh, explicitly new request succeeds through the authorized path with
attributable readback; do not count an old UNKNOWN replay as that request.
Protected-record hash forensics remain a prerequisite only for an accepted
recovery path that requires them, not a universal prerequisite for every
authorized recovery mode. Apply each selected path's mandatory gates without
delaying safe recovery for optional governance work.

### Recovery and deployment reuse handoff

Apply the existing recovery-first and proportional-review rules to the actual
execution path, not only to source readiness. For the affected incident, record
these facts in the existing handoff/Brief; no second queue, ledger, or mandatory
standalone report is needed:

- Distinguish accepted design, source readiness, installed callable capability,
  and live business acceptance. An offline test or merged reader is not a live
  recovery result. Attach time/revision-bound evidence; do not invent a percentage
  complete or call an unverified downstream path the last blocker.
- Before investing in a new recovery component, check its end-to-end call path:
  installed entrypoint, caller/operation scope, artifact/host constraints, result
  query, and failure exit. Use existing authorized observations; inaccessible
  evidence remains an explicit gap, not permission for a new protected read.
- Separate ordinary application release, business-state recovery, and deployment
  controller/profile changes. Prefer existing admitted mechanisms; explain a
  concrete shared-capability gap before proposing another incident-specific
  installer or privileged binding. Risk alone does not require a new Product Spec.
- Keep the old business turn, bootstrap transaction, and controller update as
  distinct evidence subjects. No journal status grants retry, a replacement ID,
  fence clearing, or new admission; apply the selected accepted path's conditions.
  The old business outcome may remain UNKNOWN under the recovery rule above.
- Carry incident history and unresolved dependencies across task/PR handoffs.
  Renaming a task does not erase failed attempts or restart an incident from zero.
  Reuse still-valid evidence and review only affected changes; this does not
  waive real blockers or add a new global review counter.

The [HR recovery/deployment reuse handoff](../../docs/reports/HR_RECOVERY_DEPLOYMENT_REUSE_HANDOFF_20260929.md)
records the motivating evidence and bounded follow-up objectives. Its proposed
implementation work is not Product Authority or production authorization. It must
not become an additional prerequisite for an already-safe authorized recovery.

### Release governance is not Product Authority

A rollout, canary, dogfood, or one-operation safety concern remains a Controlled-operation concern unless it creates a genuinely load-bearing long-lived Product Contract.

Do not invent persistent product state, a new durable protocol, or a new Product Spec solely to make a bounded release procedure easier to prove when an exact Execution Mandate / Controlled Runbook can contain the risk.

If review proves that a long-lived Product Contract is genuinely missing, stop and re-PREFLIGHT through `AMEND`, `SUPERSEDE`, or `NEW`; do not smuggle that contract into a release document.

```text
RELEASE_GOVERNANCE_IS_NOT_PRODUCT_AUTHORITY = YES
ONE_OPERATION_RISK_DEFAULT_HOME = mandate/runbook/receipt
PERSISTENT_PRODUCT_PROTOCOL_FOR_RELEASE_ONLY = FORBIDDEN
```

### Freeze the review blocker union

The first independent review of a candidate records the complete known ship-blocker set as `FROZEN_BLOCKER_UNION`.

The normal repair cycle is:

```text
initial independent review
-> freeze blocker union
-> one blocker-union repair pass
-> one exact-head re-audit
```

A re-audit may add a new ship blocker only when it is a valid blocker under the vendored grammar and has a concrete, reachable counterexample against the current affected surface. Reviewer preference, speculative hardening, hypothetical races without a reachable current counterexample, and optional robustness improvements are `FOLLOW_UP`, not reasons to restart the candidate indefinitely.

A newly discovered concrete `SECURITY_OR_DATA_LOSS`, `FALSE_EVIDENCE`, `REQUIRED_GATE_FAILURE`, `CONTRACT_VIOLATION`, `REPOSITORY_INVARIANT_VIOLATION`, `CONCRETE_REGRESSION`, or `SCOPE_ESCALATION` remains blocking; this section never suppresses a real blocker.

### Convergence checkpoint (effective on V3 adoption only)

Retain review/repair history for the same business outcome across candidate
renames. Repetition without new evidence calls for reassessing scope or choosing
an existing simpler recovery path; it is not progress merely because another
report exists. This is diagnostic guidance, not a universal numeric cutoff.
Task-specific budgets require applicable authorization; they neither waive real
Blockers nor forbid an otherwise authorized necessary repair solely by round count.
Do not stop a usable service merely because a development candidate is paused.
The old three-round local guard remains controlling before V3 is active on main.

### Minimum live slice first

When a merged capability is decomposable and the full rollout keeps expanding the proof surface, deploy the smallest independently useful low-risk slice first.

Default order:

```text
read-only visibility/status
-> one bounded exact mutation canary, if needed
-> broader self-service mutations only after the earlier slice is live and proven
```

Optional dogfood, critical-job mutation, broad admin behavior, or unrelated compatibility work MUST NOT gate a read-only slice unless an accepted Product Contract explicitly requires atomic delivery.

Each production slice keeps its own Controlled-operation gate, rollback/readback, and receipts.

### Proportional re-review

Intermediate re-audits review:

- the frozen blocker closures;
- semantics changed by the repair;
- directly dependent Evidence/invariants invalidated by that repair.

Do not rerun unrelated prior mechanisms merely because the candidate Head changed mechanically. The final Controlled production boundary still runs the complete applicable matrix required by accepted authority.

### Stop discipline

Once `DONE_WHEN` is met and no valid `EXPANSION_TRIGGER` fired, stop. Do not convert optional hardening discovered during review into mandatory same-Goal work.

## Local operating loop

```text
1. Read only the current task, relevant local authorities, and required evidence.
2. Classify Authority, Plan, and Assurance independently.
3. REUSE: implement within the accepted base Contracts; no new Spec for internal choices.
4. AMEND/NEW: use the active local atomic permission only where applicable.
5. CONTROLLED/SUPERSEDE or no active atomic permission: keep the docs-first boundary.
6. Review the actual affected surface; acceptance is by the authorized maintainer.
7. Run relevant tests and report implementation, installation, and business results separately.
8. Scope any real blocker to dependent work; do not restart unrelated completed checks.
9. Prefer existing safe recovery; optional generalized maintenance stays separate.
10. DONE_WHEN met without a valid EXPANSION_TRIGGER -> STOP.
```

Local extensions may refine the vendored governance but may not silently weaken or contradict the pinned distribution. Updating the distribution requires a separate docs-only adoption/update review.
---
name: spec-governance
description: Route goal-driven work through independent Authority, Plan, and Assurance decisions without conflating Product Authority, one-operation mandates, implementation, runtime state, or Evidence.
---

# Spec Governance Skill V1

Use exactly one primary mode per invocation:

```text
PREFLIGHT   classify Authority, Plan, Assurance, readiness, and next action
AUTHOR      create or revise Product Authority when the route requires it
REVIEW      independently review an exact authority/change/final Head
COMPLIANCE  evaluate exact implementation or operation against exact Contracts
```

Change Briefs, ExecPlans, Execution Mandates, and Controlled Runbooks are artifacts, not modes.

## Read order

1. `AGENTS.md`;
2. `.agents/README.md`;
3. `.agents/local/README.md`;
4. directly relevant accepted authorities;
5. only the selected mode file.

Read the V1 protocol and Spec format only as needed.

## Shared invariants

```text
Product Authority creates long-lived obligations.
Execution Mandate constrains one operation.
Every mutation needs attributable target/scope/effects/Done When authorization and an isolated write surface.
Complexity determines Plan.
Failure consequence determines Assurance.
Investigation / Task / test / Review comment do not create Product Authority.
AMEND/NEW + CONTROLLED and every SUPERSEDE route are docs-first.
Load-bearing SPEC_GAP -> AMEND/SUPERSEDE/NEW + readiness NO + RE_PREFLIGHT.
Inaccessible required Evidence -> REQUIRED_GATE_FAILURE, not automatically FALSE_EVIDENCE.
Runtime is Observation, not authority.
Emergency pre-Spec action is Owner-authorized incident containment only; no durable new behavior.
DONE_WHEN met without EXPANSION_TRIGGER -> STOP.
```

For every mode, bind exact coordinates, preserve stable accepted IDs and whole-authority backlinks, separate Observation from Working Guess when it affects routing, distinguish deterministic checks from semantic judgment, and persist load-bearing results outside chat.

Choose `PREFLIGHT` before non-trivial code/operation unless a persisted record covers the exact request and coordinates. Choose `AUTHOR` only for `AMEND`, `SUPERSEDE`, or `NEW`; `REUSE` normally uses a Brief/ExecPlan. Choose `REVIEW` for independent exact-Head/affected-Contract/final-Head review. Choose `COMPLIANCE` after implementation or operation exists.

One Agent may perform Recorder, PREFLIGHT, and Planner cognitive functions. Independence is required only where Durable/Controlled assurance, authority, or local policy requires it; do not create a fixed Agent formation.

exec
/bin/zsh -lc "git diff --no-ext-diff --no-textconv --unified=6 1c3371ab..9c08ddcc -- docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md RECEIPT-627-REVISION.md; rg --files .agents/local docs | rg 'ARCHITECTURE|DECISION|WORK_EXECUTION_CLASS|WORK_EXECUTION|workflow-human|registry'" in /tmp/review-627/repo
 succeeded in 0ms:
diff --git a/RECEIPT-627-REVISION.md b/RECEIPT-627-REVISION.md
index 19f0280b..03044ce3 100644
--- a/RECEIPT-627-REVISION.md
+++ b/RECEIPT-627-REVISION.md
@@ -1,10 +1,12 @@
-# RECEIPT — #627 HUMAN_GATE Spec 修订（Owner 裁定④）
+# RECEIPT — #627 HUMAN_GATE Spec 修订与 B1/B2 blocker 修复
 
 日期：2026-11-06（Asia/Shanghai）。**spec proposal, proposed — not acceptance**。
-本回执记录本次修订；`RECEIPT-EKR-P1A-SPEC.md` 保留原提交时的历史观察，
+本回执前部保留 2026-11-06 修订历史；**当前状态以末尾 2026-11-09 B1/B2 修复段为准**。
+历史 PASS 不覆盖本次 blocker，历史“本轮”均指 2026-11-06。
+`RECEIPT-EKR-P1A-SPEC.md` 保留原提交时的历史观察，
 其中 #1352 待核验及旧 Spec 哈希不再代表本轮状态。最终提交、push 和 PR readback
 以 Git/PR 元数据为准，不在自身提交中预报成功或制造自引用 SHA。
 
 ## 坐标、授权与路由
 
 ```text
@@ -29,16 +31,17 @@ MERGE_READY = NO (pending exact-head Owner acceptance)
 OPERATION_ALLOWED = NO
 ACCEPTED_AUTHORITY_DELTA = NONE
 PRODUCT_SOURCE_OR_TEST_DELTA = NONE
 PRODUCTION_WRITES = 0
 ```
 
-授权是用户本轮“#627 HUMAN_GATE Spec 三处小修（Owner 裁定④，2026-11-06）”
-合同式交办，持久输入为已有 `BRIEF-627-REVISION.md`。允许修改该 Spec 与本回执、
-提交 push 并更新 PR 描述；不实现代码、不自我接受。失败即停并写
-`STOPPED-627-REVISION.md`，不继续依赖写入。
+历史修订记录将授权归于“#627 HUMAN_GATE Spec 三处小修（Owner 裁定④，2026-11-06）”
+及 `BRIEF-627-REVISION.md`；该原任务指令④与 Brief 本轮均为 `NOT_LOCATED`。
+不可读不等于不存在，旧路径/哈希不能替代可读原文；当前来源重锚定见末尾 B2。
+本次仅修提案及回执、提交并推送的授权来自用户执行 FIX-BRIEF 的明确指令，
+不沿用历史 PR 更新或额外 STOPPED 文件写入要求。
 
 初始 PR readback：OPEN、未合并，head 与 `REVISION_BASE_HEAD` 一致。
 修订仅作用于 `docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md`
 和本回执；两个已有未跟踪 Brief 保留原样、不纳入提交。
 
 ## 修订点 → 裁定条款映射
@@ -95,24 +98,132 @@ Architecture、Decisions 或本地治理。未 fetch/rebase，未操作窗口工
   验证 proposed→proposed 生命周期；status/prod authority 保持 proposed/none。
 - 8 个稳定 CTR-HG ID 与 8 个 ACC-HG 对应；CTR-HG-006/007 整段与 revision base
   bytes 相同，原 WEC008 DTO/单次消费证明未改。
 - 旧 responseDueAt/escalatedAt 与“引文待 gh 恢复核验”表述已移除；authoring 语义复核
   由独立 reviewer 完成，机械字符串检查不代替语义审查。
 - `python3 .agents/tools/verify_governance.py --target .`：vendored bytes 匹配 lock。
-- `git diff --check`、允许路径检查及原 Brief 哈希检查通过；源码/测试/accepted authority
-  无 diff。`BRIEF-627-REVISION.md` SHA-256 为
+- 历史记录称 `git diff --check`、允许路径及原 Brief 哈希检查通过；源码/测试/accepted
+  authority 无 diff。历史记载 `BRIEF-627-REVISION.md` SHA-256 为
   `476d4aade7f9c872994c613fdc0c16869055f76adf3f3226b2b7032b608c43a0`；
   旧 authoring Brief SHA-256 仍为
   `dd0d64272f2cec20aa40900b5a286e840719e5151407a0797ba55ff0af2c6cf6`。
+  以上 Brief 哈希本轮未复验，不作当前原指令④可读证据。
 
 独立 reviewer `/root/revision_review`（非作者）完成相对 revision base 的 DELTA 审查：
 **PASS**，`FROZEN_BLOCKER_UNION=[]`，`BLOCKERS=0`，无新真实 authority conflict。
 审查绑定上述 Spec SHA-256，及审查时回执（PENDING 版本）SHA-256
 `c93d9a9cf89641c9102b3436d671fa15c94eb6a903c9d0f427036f03629d43b2`。
 确认四条裁定、原 WEC008 边界与回执真实性；独立复验 schema、lifecycle、8/8 coverage、
 hash、governance integrity、diff check 均 rc=0，实时评论 body hash 与本回执一致。
 本次仅将审查结果写回回执；最终 commit 另做 receipt-only/final-head delta recheck。
 产品/运行时/paired fixture 测试均 NOT_RUN；ACC-HG 是后续验收定义，不是本轮通过的测试。
 
-Done When：仅提交上述 Spec 与本回执，push 原分支，更新 PR #627 描述并 readback；
+历史 Done When：仅提交上述 Spec 与本回执，push 原分支，更新 PR #627 描述并 readback；
 保持 proposed，等待 Owner 对精确 head 的接受。不得把文档审查 PASS 升格为产品实现、
 安装、生产、业务闭环或跨仓解阻。
+
+## 2026-11-09 当前修复 — HG-WEC5-LOCK-TIMING / HG-RULING4-SOURCE
+
+```text
+WORKTREE = /private/tmp/review-627/repo
+BRANCH = ac-ekr-p1a-spec
+REPAIR_PARENT_HEAD = 1c3371abe36bcda08da27eb901e86dd95af949bc
+AUTHORITY_REFERENCE_MAIN = a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
+SPEC_GOVERNANCE_MODE = AUTHOR
+AUTHORITY_ACTION = AMEND (existing proposed authority only)
+PLAN_LEVEL = BRIEF
+ASSURANCE_LEVEL = CONTROLLED (docs-first; no implementation or operation)
+ROUTE_STAGE = AUTHORITY_AUTHORING
+SPEC_STATUS = proposed
+SPEC_REVISION = proposal-3-blocker-repair
+AUTHORITY_ACCEPTED_IN_BASE = NO (this HUMAN_GATE proposal)
+IMPLEMENTATION_ALLOWED = NO
+MERGE_READY = NO (pending exact-head Owner acceptance)
+OPERATION_ALLOWED = NO
+PRODUCTION_APPLY_AUTHORITY = none
+ACCEPTED_AUTHORITY_DELTA = NONE
+PRODUCT_SOURCE_OR_TEST_DELTA = NONE
+PRODUCTION_ACCESS = NONE
+```
+
+当前授权与冻结范围：用户明确要求执行 `/tmp/review-627/FIX-BRIEF.md`，只修 B1/B2，
+只改提案 Spec、本修订回执及必要验收定义，单 commit 推 `origin ac-ekr-p1a-spec`；
+push 失败则生成 bundle 交接，不重试。该修复简报本地实测 SHA-256：
+`ce6c64f53d5cc80e54dbdfc044b214b5ec6ac1e86648030d63e557cee2030bdf`。
+GOAL/CURRENT_GAP 为修复锁时序冲突和不可核的原指令④归因；DONE_WHEN 为两处闭合、
+文档校验与独立 delta 复核后单 commit 推送，失败则 bundle。
+EXPANSION_TRIGGER 为新增真实权威冲突、超出这两个 blocker 的语义改动或生产访问需求；
+本轮不重开产品裁定。最终 commit、push 或 bundle 结果由 Git/交付元数据报告，
+本回执不预报提交 SHA 或推送成功。
+
+### B1 — HG-WEC5-LOCK-TIMING（CONTRACT_VIOLATION）
+
+只读 `git show <AUTHORITY_REFERENCE_MAIN>:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md`
+及 V3/V4 的生命周期记录，核到 V3→V4→V5，WEC5 status=accepted、accepted_by=mayf3、
+production_apply_authority=none。固定可读坐标：
+[WEC5 CTR-WEC1-008 两类 collection](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L653-L699)、
+[CTR-WEC4-010](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L759-L815)、
+[ACC-WEC4-003](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L953-L968)。
+WEC5 文件实测 SHA-256 为
+`e2160a5eff748d03daa199b08517bb89e1efaa64008020e27d0344385adf331a`。
+这是已存在的本地 origin/main 快照读取；未 fetch/rebase，不宣称已刷新远端 main。
+
+修复将提案 governed_by/§3 有效 WEC 引用改为该 WEC5，原 authoring base 保留。
+CTR-HG-007 明确锁内 detached capture → 锁外 pre-plan/evidence collection → 重获同锁
+→ CURRENT ledger replay → fresh trusted 权威等值终检 → 单次 planned append。
+两份旧 read/local revision/TTL 不能替代终检；相关 drift/缺证据一律本轮零 plan/消费/投递，
+原 refusal 与正常 sweep 保持。ACC-HG-007 同步要求两段实际 barrier 下无关 B 先完成、
+真实独立双 writer、全部 append 保留及终检等待证据；禁止锁内重跑整套采集。
+原 DTO、sequence/baseline、单次 permit、budget/STOP、恢复边界均保留。
+这些是提案语义/验收定义修复，双 writer 产品测试仍 NOT_RUN、性能 UNMEASURED。
+
+### B2 — HG-RULING4-SOURCE（REQUIRED_GATE_FAILURE）
+
+本轮 root 与非作者 reviewer 分别只读本地持久文件：
+`/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`。
+源文件本轮 SHA-256 为
+`6afd34a5b035113a919737dee4afa0ef777169c4e9c2bbb4041308a39774f2ea`。
+读取方法为 Python `json.loads`，按 ruling `id` 精确选择 `items[3]`；以下摘录直接持久化于
+本回执，独立审阅不依赖临时 Brief。registry 时间按原记录保留，不推断未标注时区。
+
+| 持久坐标 / source status | 本轮可读内容及证明范围 |
+|---|---|
+| `$.rulings[id=owner-20261108-three-unified].items[3]`；ts=`2026-11-08 06:11`；本地读取 VERIFIED | 原文必要摘录：“范围内缺证/引用/构建/测试/网络/合并问题原责任链自主处理, 不以新SHA/Session/SpecID/普通失败为由重复请批; 仅常设授权§7所列新风险/新决策才最小差量HUMAN_GATE”。支持 HUMAN_GATE 政策语义及原责任链修复，不补写原④ |
+| `$.rulings[id=owner-20261108-backlog-convergence].items[3]`；ts=`2026-11-08 09:05`；本地读取 VERIFIED | 原文必要摘录：“#1352复用已裁定不重请”。支持复用既有裁定，不重决产品语义 |
+| [agent-control #1352 评论 6622750077](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)；历史独立核验 REUSED | 作者 `mayf3`、created/updated=`2026-11-04T04:42:18Z`、三点裁定及 body hash `0552d8c8c6e3620145dcf641acedfe70249e59477c45356336cc763fa1f2f435` 见前部历史核验记录；2026-11-09 独立审查修复简报也明确其已独立核实。当前未重新请求评论，不将三点冒充原④全文 |
+| 2026-11-06 原任务指令④、`BRIEF-627-REVISION.md` | NOT_LOCATED；不可读≠不存在。旧 Brief 哈希仅历史记录，不证明本轮可审阅原文；不虚构、不重建原文 |
+
+两个完整 `items[3]` 的 canonical SHA-256（UTF-8，
+`json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，包括 JSON 字符串引号）
+依表中顺序为：
+`bc504d55a11b3581377a0fc188c704ac1f0b7e4b88465646904e9b4347dc1cb9`、
+`78eb96d162b9845470a4c575d1e5aec911cb9aa7fcbe6368d7414789ef59ccbd`。
+
+据此修正回执旧归因及提案 §3/CTR-HG-004：普通/managed 路径、24h 未 resolve 期限、
+§13A 依赖边界保留为原提案内容；不声称两条 registry 或三点评论包含这些细节，
+不追认不可读原④，也未重新审计 Svc 源码/DB。政策语义重锚定与具体路径的证明范围
+分开，不增加执行权限，不解除原 UNKNOWN/STOP。
+
+### 当前文档校验与独立 delta 复核
+
+修复 Spec SHA-256：
+`e19b8f3ec51d9bb3b6b92dcf3c8bce22b355ba36bf32472bb035a8c51fc6f37e`。
+
+实际文档检查全部 rc=0：
+
+- `jsonschema.Draft202012Validator` 按仓内 frontmatter schema 校验；
+  `validate_transition([parent_proposal], [repaired_proposal])` 验证 proposed→proposed。
+- 8 个稳定 CTR-HG ID 与 8 个 ACC-HG 对应；原 DTO、CTR-HG-001/002/003/005/006/008
+  bytes 不变，CTR-HG-007 前驱资格及后半 permit/replay/budget/STOP 段不变，
+  §13 起的迁移/依赖/authoring 边界不变；CTR-HG-004 仅修来源归因。
+- WEC5 accepted 状态、固定 main/文件哈希、registry 文件及两个完整 item canonical
+  hashes、selector 与回执绑定均实核；原 Brief 本 checkout 未找到。
+- `python3 .agents/tools/verify_governance.py --target .`：vendored bytes 匹配 lock；
+  `git diff --check` 与允许路径检查通过，只有本提案与回执两文件。
+
+非作者 `/root/source_review` 独立 DELTA 复核：**PASS**，`FROZEN_BLOCKER_UNION=[]`。
+绑定 repair parent、authority main、上述 Spec SHA-256，以及写回检查结果前的回执
+SHA-256 `e6d6e5a028add4e66d3dd98946520a22fb3b9b189b2a88ad0e8061c27edeafcd`。
+独立复读 registry/hashes、对比 DTO/恢复/permit 边界并核对两段 collection 时序及验收，
+确认 B1/B2 闭合且无新增 blocker；写回结果后仅作 receipt-only/final-head delta recheck。
+本结论仅为提案修复审查推荐，仍待 Owner 对精确 head 接受；产品/运行/paired fixture
+验收均 NOT_RUN，未测并发性能或业务结果。
diff --git a/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md b/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
index d1307c6a..c1e87d0b 100644
--- a/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
+++ b/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
@@ -8,21 +8,22 @@ implementation_authority: contracts
 production_apply_authority: none
 repo: mayf3/dsh-agent-core
 scope:
   - human-gate-read-and-event-consumption
   - verified-human-answer-to-authorized-owner-resolution
   - existing-owner-assistance-single-resume
-date: 2026-11-06
-revision: proposal-2
+date: 2026-11-09
+revision: proposal-3-blocker-repair
 candidate_base: f6a1f77a8b7b878bcb9821a68836925755ca7076
+authority_reference_main: a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
 governed_by:
   - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
   - AGENT_WORKSPACE_SESSION_MODEL_V3
   - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
   - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
-  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
+  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5
 external_authorities: []
 supersedes: []
 superseded_by: null
 owners:
   - mayf3
 ---
@@ -50,33 +51,41 @@ owners:
 任务/Session authority、写工具、Auth scope、身份冒用、隐式 Owner handoff、自动 resolve、
 自动解除 STOP 或 UNKNOWN replay。不把其他 `HUMAN_REQUIRED`（如 Scheduler）纳入。
 不改变 managed effect 的稳定 identity、required-operation receipt 或既有 WAE/RETURN 预算。
 
 ## 3. Authority and dependencies
 
-权威坐标固定为 `candidate_base` 中的本地 accepted authorities，优先级按本地治理：
+原 authoring 坐标保留为 `candidate_base`。本轮有效 WEC 权威改绑到
+`authority_reference_main` 的 accepted WEC V5（V3→V4→V5 整权后继），其余原输入
+不变；优先级按本地治理。该固定 main 快照只读核对，不表示 WEC5 已进入本分支的旧
+实施 base；后续实施仍须核对实际 base 中的 accepted 权威。文件哈希与读取方法见回执。
 
 | 本地权威 | 本协议继承的含义 |
 |---|---|
 | Product Architecture §§3–4 | Workflow 为外部业务系统；Core 保持薄组织层，不重建业务引擎 |
 | D-008 / `AGENT_WORKSPACE_SESSION_MODEL_V3` §14 | Agent 通知进入目标 canonical main；通知不复制 Workflow task authority |
 | Owner Workflows V2 §§1/6/8–9 | Svc owns intent/case/effect/receipt/STOP；ACK 不满足义务；Core 不 resolve case；UNKNOWN readback-only；无 Core case/phase engine |
 | WAE V3 `CTR-WAE-001b` | 原 due feed 完整 keyset sweep、无持久 cursor/queue/lease；不得以通知流代替可执行任务发现 |
-| WEC V3 `CTR-WEC1-005` | 一次稳定 `wfassist-<caseId>` Owner wake；admission ACK 与业务完成分离；只有显式 Owner 升级产生 HUMAN_REQUIRED |
-| WEC V3 `CTR-WEC1-008` | 显式授权 resolve 的精确 Svc 凭证、settled 前驱与单次 permit 消费 |
+| WEC V5 携带的 `CTR-WEC1-005` | 一次稳定 `wfassist-<caseId>` Owner wake；admission ACK 与业务完成分离；只有显式 Owner 升级产生 HUMAN_REQUIRED |
+| WEC V5 携带的 `CTR-WEC1-008`、`CTR-WEC4-010` / `ACC-WEC4-003` | 原精确 Svc 凭证、settled 前驱与单次 permit 消费；两类远端 collection 锁外执行，重获同锁后 current ledger replay、fresh 权威终检、单次 append；A 采集等待不阻塞无关 B |
 
 交办输入：[任务 #1374](https://github.com/mayf3/agent-control/issues/1374)、
 [Owner 议题 #1352](https://github.com/mayf3/agent-control/issues/1352) 和
 [Svc 后继任务 #1378](https://github.com/mayf3/agent-control/issues/1378)。这些是任务/协作记录，
 不替代 accepted Product Authority。交办已给定 HUMAN_GATE、指定域 Owner、24h 三项意向，
 无需请求 Owner 重复决定。已核验来源为 [#1352 comment-6622750077](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)：
 作者 `mayf3`，创建/更新时间 `2026-11-04T04:42:18Z`（2026-11-04 12:42:18 +08），
 正文标注“监管代记”。三点持久裁定是：通知 HUMAN_GATE 群（附实例上下文与已尝试清单）；
 仅 Owner 指定的域 owner 可代答/resolve，普通 Agent 不得代 Owner 意志；24h 无 resolve
-则升级再提醒，不自动降级或关闭实例。2026-11-06 Owner 裁定④的本次交办进一步明确
-未 resolve 处置期限及普通/managed 路径分拆；修订映射与核验方法见 `RECEIPT-627-REVISION.md`。
+则升级再提醒，不自动降级或关闭实例。2026-11-06 原任务指令④及其 Brief 本轮为
+`NOT_LOCATED`（不可读不等于不存在），不凭旧路径/哈希重建原文。2026-11-08 持久
+DISPATCH-REGISTRY 的 `$.rulings[id=owner-20261108-three-unified].items[3]` 与
+`$.rulings[id=owner-20261108-backlog-convergence].items[3]` 已本地只读核实：仅常设授权
+§7 所列新风险/新决策才最小差量 HUMAN_GATE，#1352 复用已裁定不重请。此政策语义
+重锚定不重决产品裁定；原提案的期限、路径约束与依赖边界保留，不冒充上述来源原文。
+可读摘录、持久路径、哈希、历史评论核验和局限见 `RECEIPT-627-REVISION.md`。
 
 `external_authorities: []` 表示本轮没有核得可绑定的 Svc HUMAN_GATE accepted authority
 及其 exact revision，不表示不存在跨仓依赖。Svc 持久 obligation producer/后继由 #1378
 实施线承担；接收协议、授权验证、原子 receipt 和持久重发现须由所属仓库接受并进入
 其实施 base。本 Core proposal 不赋予 Svc 写权限或跨仓 acceptance，依赖边界见 §13A。
 
@@ -98,12 +107,16 @@ owners:
   其反例和 minimum_closure 为本提案的问题输入，不是生产事故或已运行 HUMAN_GATE 的证明。
   关键反例与 minimum_closure 在 §10 完整重述，审阅不依赖该外部临时路径可用。
 - `OBS-HG-003`：2026-11-06 修订时，通过 GitHub 只读 API 核验上述 #1352 精确评论的
   author、created/updated time、issue URL 与正文，三项裁定均有持久记录。API 来源、
   正文 SHA-256 与核验时间见 `RECEIPT-627-REVISION.md`；这仅证明裁定记录存在，
   不证明 HUMAN_GATE 收件、Svc 计时/提醒或 resolve 接线已经实现。
+- `OBS-HG-004`：2026-11-09 在隔离 `/private/tmp/review-627/repo` 本地只读核对
+  `authority_reference_main` 的 accepted WEC5 及其携带的 CTR-WEC1-008、CTR-WEC4-010、
+  ACC-WEC4-003；同时读取上述 DISPATCH-REGISTRY 两条 ruling。方法、源文件哈希与
+  最小摘录见回执；未访问生产，未重新访问 GitHub 评论，原指令④仍为 NOT_LOCATED。
 
 ## 6. Claims and assumptions
 
 - `CLM-HG-001` — `SUPPORTED`（仅本地合同）：admission ACK 不能推出真人送达、
   答复合法、case resolve 或义务满足；依据 `OBS-HG-001`。
 - `CLM-HG-002` — `INFERRED`：§9 的完整验证链可在合同层闭合 `OBS-HG-002` 反例。
@@ -122,12 +135,16 @@ owners:
 relation 仅为设计推断，充分性限于 §10 逐步拒绝反例。§11 所有执行证据仍 `NOT_RUN`。
 
 `EVD-HG-003`：`OBS-HG-003` SUPPORTS §3 三项 Owner 裁定的持久来源；目标为
 DEC-HG-002/003、CTR-HG-002/003/008 的 authoring 输入，坐标为精确 comment ID、
 作者、时间和回执正文哈希。足以撤销旧“待核验”缺口，不足以证明跨仓 acceptance 或运行效果。
 
+`EVD-HG-004`：`OBS-HG-004` SUPPORTS §3 当前 WEC 权威、CTR-HG-007/ACC-HG-007 的
+锁时序与已裁定不重请的来源重锚定；坐标为固定 main SHA、registry path/selector、
+回执摘录及哈希。足以复核本次文档修复，不证明原指令④原文、并发改善或产品/运行验收。
+
 ## 8. Decisions (proposed)
 
 - `DEC-HG-001`：HUMAN_GATE 以 Svc 原 case 为唯一业务责任主体；通知和真人答复是
   可审计输入，持久 obligation/到期后继留在 Svc；Core 消费可重读事实和已有 resume 证明。
 - `DEC-HG-002`：仅 Owner 指定的域 owner 可代答/resolve；消息验真与答复验证本身
   不授予该权限。普通 case 仅凭合法显式 resolve receipt 才可能进入 WEC008；opted-in
@@ -186,20 +203,21 @@ pending/settled 的同 request ACK 仍只证明 admission。不得换 key/Sessio
 
 已验证答复仅交给指定 Domain 当前有权 Owner 的既有决策/命令路径。Svc 必须在命令
 提交时重新验证真实 caller、精确 Domain resolve 权限、当前 case/状态/source/Owner
 关系及既有 CAS/receipt 条件；通知 recipient、答复人和 `resolverPrincipalId` 各自记录，
 不得混同。无权限的答复人不能借 Core、Agent credential、Owner 字段或“回复”获得授权。
 
-按本次 Owner 裁定④给定的路径事实，消费前必须分拆两类，不能把普通路径外推到 managed：
+保留原提案的路径约束（原指令④ NOT_LOCATED，来源重锚定见 §3/回执）；消费前
+必须分拆两类，不能把普通路径外推到 managed：
 
 | case 路径 | 合法推进约束 / Core 消费边界 |
 |---|---|
 | 普通 Assistance case（非 opted-in managed） | 既有 `owner_action` 支持 `HUMAN_REQUIRED→RESOLVED`；仍需指定域 owner 的真实 caller、显式授权、当前状态/CAS 与实际 receipt/readback。只有该合法 resolve 凭证及 WEC008 全部证明成立时，Core 才可消费一次 resume |
 | opted-in managed case | 必须走 `require_effect`，关联真实 `STARTED` 的 `REVIEW` effect，遵守既有 managed admission/receipt/STOP guard。在现有可达路径下，直接 Owner resolve 被 managed guard 拦截，不能因“有权 Owner”而绕过。HUMAN_REQUIRED 后的 managed 合法后继由 Svc 的 #1378/#1352 责任线闭合；本 Core 合同只描述消费面，不创建或承诺该后继已可达 |
 
-以上路径约束是本次交办输入，不构成 Svc 实现/运行验收。Core 不代行 resolve，不从
+以上路径约束保留为提案消费边界，不作为已核得原指令④原文或 Svc 实现/运行验收。Core 不代行 resolve，不从
 通知/答复构造 resolved Event，也不新增 HUMAN_REQUIRED 旁路。实际路径若不允许该
 状态或所需输入，则维持待处置并报告 UNKNOWN/缺权威，交 Svc 所属 accepted authority
 闭合；不得通过放宽现有 managed guard 解决。只有已提交、可读回的合法 resolve
 receipt/Event 才可进入下一步；它仍不等于任务业务完成。
 
 ### CTR-HG-005 — Minimum read/event consumption contract
@@ -258,17 +276,33 @@ scope: workflow.read + direct token + enabled GLOBAL_SCHEDULER_READ binding
 
 只沿 WEC008：latest predecessor 必须为 terminal `NEEDS_REVIEW/run_ended_no_submission`，
 known delivery 且 fresh Router reconciliation 正面证明 `settled`。pending/UNKNOWN/
 unavailable/ambiguous（包括 `run_outcome_unknown`）均拒绝；stale-path quiescence
 替代证据不能用于这里。原 attempt 自身落盘的 `preDeliveryWorkflowStateVersion` 不得后补。
 
-Core 持既有 admission lock，fresh pre-plan read 验证同一 ACTIVE dispatch/instance/visit/
-assignee；要求 `baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`，
-且证据版本等于新计划 fresh pre-plan version。一次 locked durable `attempt_planned`
-同时产生 N+1 并消费 permit，落盘新 baseline、相同 identity、`previousAttemptId`、
-`retryReason:owner_assistance_resolved` 及原样 `assistanceResume`。不增第二份消费账本。
+沿 WEC5 携带的 CTR-WEC4-010：先在既有 admission lock 内 replay ledger，捕获 detached
+context（精确 tuple、前驱/不存在、generation、state/phase、baseline、settled proof、
+eligibility、budget、已消费 case/Event 及 replay 坐标），不占用 generation 或消费 permit。
+释放锁，在锁外完成两类远端 collection：fresh pre-plan read 与 Owner-resume evidence
+read；响应须绑定原 tuple、前驱、baseline、Svc version 与 Event sequence。A 等待任一
+采集时，无关 eligible B 必须能取得锁完成正常 admission。
+
+随后重获同一 admission lock → replay CURRENT durable ledger → 比较全部相关本地前置
+条件 → 在该锁内 commit-preparation 坐标取得 fresh trusted 权威终检 → 单次 append。
+终检须正面确认当前同一 ACTIVE dispatch、非终态 instance、current visit、assignee 及
+workflow-state version 均等于锁外结果；仅 local revision、结果 TTL 或两份旧 read 相同
+不足，不能以在锁内重跑整套 collection 替代。无关 ledger append 保留；相关前驱、预算、
+eligibility、permit consumption 或外部身份/版本变化、缺失/不可验证均丢弃旧结果，本轮
+零 plan、零 permit consumption、零 delivery；沿原 refusal/正常 sweep，不改 refusal code
+或重试政策、不把旧结果换 baseline/前驱再用。
+
+仍要求 `baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`，
+证据版本等于锁外 fresh pre-plan version 并经终检确认相等。全部通过才一次 locked durable
+`attempt_planned` 同时产生 N+1 并消费 permit，落盘该 pre-plan version 为新 baseline、
+相同 identity、`previousAttemptId`、`retryReason:owner_assistance_resolved` 及原样
+`assistanceResume`。不增第二份消费账本，其余 resolution/WAL/delivery 的原锁纪律不变。
 
 一个 resolve 最多授权一次 next generation，非“每收到一次消息执行一次”。case/Event pair/
 due row/restart 重放均不可再次 mint；多个旧 case 不能连续推动后续 generation。generation
 与自动预算不重置；不标 `stale_superseded`。Owner-resumed turn 再无 submission 时，必须
 有该 attempt 自身 baseline 之后的新 case 及新显式合法 resolve，不能自动继续。
 Owner V2 的 managed STOP、Owner-change 和更严格的有限预算仍控制对应 managed path；
@@ -333,13 +367,13 @@ receipt/readback 证据前，完整 P1-A 仍不得宣称 `SOURCE_VERIFIED` 或
 | ACC-HG-001 / CTR-HG-001 | 对比真实 escalation 与 local failed/cap/model text；杀 Core 后重读责任 | 隔离 paired Core/Svc fixture | 原 Event/case/Owner 坐标、Svc 后继、重启前后 readback | 仅显式 Svc HUMAN_REQUIRED 触发，责任不因 Core 消失 | 假 HUMAN_REQUIRED、无后继却称闭环、Core case engine |
 | ACC-HG-002 / CTR-HG-002 | admission/settled ACK、渠道缺 receipt、投影失败、重复通知 | 隔离渠道与 Core fixture | 原 requestId、各阶段 receipt、投递次数、状态读回 | ACK 不推出送达/resolve/满足；同 Owner wake identity 保持 | 换 key 盲发、复制任务、伪送达、投影改执行 |
 | ACC-HG-003 / CTR-HG-003 | 注入伪签名、Agent 转述、同名、wrong human/Domain/case/Event/Owner drift；消息验真但未获 Owner 指定的群成员/Agent 代答 | 隔离可信 ingress + Svc | 消息身份 provenance、canonical mapping、Owner 指定关系、验证记录、零 resolve/attempt 计数 | 拒绝所有错配；仅真正授权答复被记录 VERIFIED，验真不授予代答/resolve 权 | 正文自授权、HUMAN 类型即有权、未指定主体代答、thread 即 case proof |
 | ACC-HG-004 / CTR-HG-004 | 普通 case 走 owner_action HUMAN_REQUIRED→RESOLVED；对比 opted-in managed 直接 Owner resolve、缺/伪 STARTED REVIEW effect；另测撤权/换 Owner/非法状态/CAS drift | 隔离真实 Svc 命令/DB 与 managed effect fixture | 路径分类、真实 caller/Domain 检查、guard 拒绝、require_effect 与真实 STARTED REVIEW effect、命令 receipt/Event、前后 readback | 普通合法 resolve 产生实际关联 receipt；managed 直接 resolve 被现有 guard 拦，合法后继只能按 Svc accepted 合同验证，缺失则 UNKNOWN/零推进 | 外推普通路径、Core 自 resolve、借 credential、放宽 managed guard、伪 effect、无 receipt 成功 |
 | ACC-HG-005 / CTR-HG-005 | 校验封闭投影，缺字段/乱序/重复/丢事件后重读；>100 due rows 首100已 attempted | 隔离 Svc 只读/事件面 + Core sweep | exact DTO/schema、授权范围、恢复后责任、cursor 原值及101+发现记录 | 缺证据拒绝；事件非唯一正确性路径；原 WAE sweep 保持 | 自签投影、跨域枚举、漏责任、页上限/持久 case cursor、修改 due DTO |
 | ACC-HG-006 / CTR-HG-006 | 对比 resolution link 与原 WEC008 DTO；普通/policy ingress、错 resolver/version/case | 隔离真实 Svc evidence seam | 原 receipt/Event join、exact request/response、身份/版本值 | 仅既有两种 ingress、原 DTO、精确关联被接受 | 第三种 human ingress、混淆 assignee/Owner、缺/假证明授权 |
-| ACC-HG-007 / CTR-HG-007 | settled 正例与 UNKNOWN/pending/legacy baseline/换 tuple/STOP 反例；并发/重复/replay/旧cases | 隔离实际 Core engine/ledger + Svc | fresh Router settled、lock 内 reads、sequence、原 planned append、delivery count | 一个 resolve 最多一个 N+1；原 budget/STOP 保持 | 双消费、新 permit store、补 baseline、UNKNOWN resume、自动续跑 |
+| ACC-HG-007 / CTR-HG-007 | settled 正例与 UNKNOWN/pending/legacy baseline/换 tuple/STOP 反例；分别 barrier 暂停 A 的远端 pre-plan/evidence collection，令无关 B admission；真实独立双 writer 共享 ledger；采集后注入相关本地/外部 drift；并发/重复/replay/旧 cases | 隔离实际 Core engine/ledger/OwnerLock + Svc，按 WEC5 携带的 ACC-WEC4-003 | 两次 collection 锁外 barrier、同锁获取/释放、current replay、fresh 权威终检及 sequence/version 等值、全部 durable lines、delivery count、等待耗时含终检、implementation SHA | 两个 interval 中 B 均在解除 A barrier 前完成；A 仅在终检通过后单次 append；一个 resolve 最多一个 N+1；原 budget/STOP 与全部 writer append 保持，相关 drift 零 plan/消费/delivery | B 被 A collection 阻塞、锁内重跑整套采集、漏报终检等待、无权威等值终检、丢 append、双消费、新 permit store、补/换 baseline、UNKNOWN resume、自动续跑 |
 | ACC-HG-008 / CTR-HG-008 | 第 1 小时回复且验证成功但未 resolve，推进至原 24h；到期前后 Core/Svc 重启、丢事件/通知失败后恢复重发现；晚到/response loss；crash before/after plan、before/after delivery_started | 隔离 paired fixture；可控时钟/故障与 Svc 现有责任/通知机制 | 原 escalationAt/resolutionDueAt、1h 验证记录、24h 未 resolve readback、持久升级提醒及发送/失败结果、恢复重发现、原 receipt、exact correlation、ledger replay/投递计数 | 回复/ACK/验证不取消责任；未 resolve 到期持久升级再提醒，重启/通知失败不丢责任不改期限；到期不授权；UNKNOWN readback-only；仅 WEC008 正面 never_existed 可同 attempt 恢复 | 仅 OVERDUE/日志/易失提醒、回复即取消责任、deadline 重置、失败假送达或丢责任、自动 resolve、未知换 key/重放、STOP 被消息清除 |
 
 ## 12. Alternatives and disposition
 
 - `ALT-HG-001` 任意真人回复直接 resolve/resume：REJECT，真实性与 Domain 权限不同，
   违反显式 Owner resolve 与 WEC008 proof。
docs/reviews/SCHEDULER_OCCURRENCE_OUTCOME_V3_DECISION_REVIEW.md
docs/reports/agent-registry-v1.md
docs/reports/stock-agent-registry-adoption-v1.md
docs/reports/e42-fixed-capacity-facts-20261019/ORIGINAL-QUALIFIED-DECISION.json
docs/reports/e42-capacity-method-a-v2-20261019/E42-CAPACITY-PLAN-A-V2-ORIGINAL-QUALIFIED-DECISION-20261019.json
docs/reports/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_OWNER_DECISION.md
docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1_OWNER_DECISION_PACKET.md
docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
docs/investigations/b7-e42-q3-npm-basis-accepted-20261019/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-first-anchor-predicate-recording-accepted-20261020/ORIGINAL-TECHNICAL-DECISION.json
docs/investigations/b7-exact-p-third-call-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-fixed-offline-continuation-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-selected-e1c-app-export-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-fixed-g-budget-accepted-20261019/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/stock-agent-registry-adoption-v1.md
docs/investigations/b7-fresh-six-carrier-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-app-anonymous-transport-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-pre-npm-lineage-accepted-20261020/ORIGINAL-QUALIFIED-DECISION.json
docs/investigations/b7-e42-public-selector-groups-accepted-20261019/ORIGINAL-QUALIFIED-DECISION.json

exec
/bin/zsh -lc "cat .agents/local/README.md .agents/skills/spec-governance/SKILL.md; rg --files .agents/skills/spec-governance; sed -n '1,200p' RECEIPT-627-REVISION.md" in /tmp/review-627/repo
 succeeded in 0ms:
# Repository-local governance — dsh-agent-core

This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.

## Repository identity

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
GOVERNANCE_LOCK = .agents/governance.lock.json
ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
```

A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.

## Authority precedence

```text
explicit Product Direction authority, when one is accepted
> accepted Product Architecture and standalone long-lived Current Decisions
> accepted implementation-authorizing Specs
> code, tests, runtime state, migration records, and operational evidence
```

Current repository authority locations:

```text
PRODUCT_DIRECTION = NONE_STANDALONE
PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
CURRENT_DECISION_INDEX = docs/decisions/README.md
DECISIONS = docs/decisions/
SPECS = docs/specs/
```

Local rules:

- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
- an accepted-looking document on an unmerged branch is not active authority;
- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.

## Bounded-development route (effective on V3 adoption only)

These local choices become active only with the accepted
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
Until then, the authority branch's existing rules remain controlling.

- `REUSE` inside an accepted implementation Contract needs no new Spec or
  standalone Spec review merely because code changes. Use focused tests and the
  review required by its Assurance level.
- Explicitly permit one atomic Spec-delta-and-code PR for bounded
  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
  delta must be independently accepted before merge; it cannot contradict
  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
  boundaries, introduce destructive migration, or authorize production effects.
- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
  permissions are separate; missing production permission does not itself stop
  unrelated authorized nonproduction work.
- Review the affected change and invalidated dependencies. A new SHA alone does
  not require a full audit. Use the vendored explicit scope/impact checks.
- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
  full-corpus review, or new control-plane document is introduced here.

## Acceptance and review actors

```text
SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
```

A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.

## Governing and persistence locations

```text
SPECS = docs/specs/
INVESTIGATIONS = docs/investigations/
LONG_LIVED_DECISIONS = docs/decisions/
IMPLEMENTATION_CONFORMANCE = implementation PR record
CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
EMERGENCY / INCIDENT_REFERENCE = persistent issue, PR, or report
```

## Current Owner-obligation Workflow authority

The accepted paired governing authorities are `docs/specs/SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` in svc-workflow and `docs/specs/AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` here, accepted by Root under user-delegated authority at reviewed semantic heads Svc `39587c33c8bcf26ad5689127f5c92a6abc8b562e` and Core `ac83fe5cea3701eb9436f74d1b5f6ed0013256a9`. The accepted Core whole successors are WAE V3, Assignee Transition Capability V3, WEC V3, GCR V2, WPO V4, and Owner Workflows V2. Assignee Transition Capability V2 is superseded by V3, and Owner Workflows V1 by V2, with reciprocal lifecycle links. The paired Svc acceptance-context successor is `SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2`. Governing Contracts authorize source implementation only after their accepted revisions are present in the implementation base; production apply remains none.

## Code structure rules

Current binding repository-local rule: [`.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`](CODE_STRUCTURE_GUARDRAILS_V2.md)
(frozen limits, fixed-baseline registry validation, candidate-delta gate and visible
historical debt). V2 and its V1 supersession activate atomically on main.
The implementation contract is
[`CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1`](../../docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md).
Implementation starts only after both accepted authorities are in its base.
The existing V1 runner remains unqualified for V2 until the implementation lands.

```text
RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md
EXCEPTION_REGISTRY = .agents/structure-registry.json
VERIFIER = node scripts/verify-code-structure.mjs --base <ref> --head <ref> [--json]
NPM = npm run verify:structure
```

Raw logs may remain outside Git, but every load-bearing Observation or Evidence relation must retain enough provenance to retrieve and interpret the source.

## Legacy transition

Before this adoption candidate, the repository had a local bootstrap in `AGENTS.md`, `.agents/README.md`, and two helper templates, governed by `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`.

This adoption is forward-only:

```text
NO_BULK_HISTORY_REWRITE = YES
EXISTING_ACCEPTED_ARTIFACTS_REMAIN_HISTORICAL_AUTHORITIES_UNTIL_EXPLICITLY_TOUCHED = YES
NEW_PARTIAL_SUPERSESSION = FORBIDDEN
```

Existing prose that describes partial supersession is legacy state. It is not a template for new work. When such an authority must change, create a complete standalone replacement and perform an atomic whole-authority supersession.

The pre-adoption local helpers:

```text
.agents/templates/development-preflight.md
.agents/templates/spec-compliance.md
```

remain compatibility aids only. They are not authority. New work uses the vendored Skill modes and templates.

At local adoption acceptance, `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` supersedes `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` as the repository's development-governance authority. The old Spec remains historical rationale.

## Enforcement maturity

Actual enforcement is:

```text
ENFORCEMENT_LEVEL = MANUAL_POLICY
DISTRIBUTION_INTEGRITY_CHECK = AVAILABLE
SPEC_FRONTMATTER_SCHEMA = AVAILABLE_REFERENCE
SEMANTIC_SPEC_VERIFIER = NOT_IMPLEMENTED
BASE_BRANCH_GATE = NOT_IMPLEMENTED
REQUIRED_BRANCH_PROTECTION = NOT_ENABLED
AUTOMATIC_SPEC_ACCEPTANCE = NO
CODE_STRUCTURE_VERIFIER = AVAILABLE (scripts/verify-code-structure.mjs; run via npm run verify:structure)
```

Run the vendored integrity verifier:

```bash
python3 .agents/tools/verify_governance.py --target .
```

After adoption is active on `main`, use `--require-accepted` when verifying the authority branch.

## Delivery convergence and proportional rollout

These repository-local rules refine review and rollout behavior without weakening the vendored blocker classes, Product Authority precedence, or Controlled-operation gates. They never authorize merge, deployment, or mutation while a known binding Blocker remains open.

### Recovery first when accepted mechanisms already exist

For an active availability incident, if an existing accepted operator/admin mechanism can safely restore service without changing long-lived Product Contracts, restore the service first and keep the permanent redesign in a separate lane.

```text
SAFE_EXISTING_RECOVERY_PATH = prefer now
LONG_TERM_REDESIGN = separate lane
INCIDENT_RECOVERY_MUST_NOT_WAIT_FOR_OPTIONAL_GOVERNANCE_WORK = YES
```

This does not permit blind retry, destructive repair, privilege bypass, or reinterpretation of an unknown external side effect.

For an authorized recovery, keep the old `outcome_unknown` record and its
business-side-effect uncertainty; do not replay its prompt or tools, erase it,
or infer success or failure from termination-only evidence. Before admitting an
explicitly new Session, Turn, or request, the exact mandate/runbook must prove
that both the old worker and its already-dispatched tool operations are
terminated or isolated from external effects, or that each actual write/delivery
boundary rejects the old identity. An epoch gate that only suppresses replies
is insufficient. If this proof is unavailable, keep the affected fence and stop.

Label offline tests as mechanism evidence. Claim live recovery only after a
fresh, explicitly new request succeeds through the authorized path with
attributable readback; do not count an old UNKNOWN replay as that request.
Protected-record hash forensics remain a prerequisite only for an accepted
recovery path that requires them, not a universal prerequisite for every
authorized recovery mode. Apply each selected path's mandatory gates without
delaying safe recovery for optional governance work.

### Recovery and deployment reuse handoff

Apply the existing recovery-first and proportional-review rules to the actual
execution path, not only to source readiness. For the affected incident, record
these facts in the existing handoff/Brief; no second queue, ledger, or mandatory
standalone report is needed:

- Distinguish accepted design, source readiness, installed callable capability,
  and live business acceptance. An offline test or merged reader is not a live
  recovery result. Attach time/revision-bound evidence; do not invent a percentage
  complete or call an unverified downstream path the last blocker.
- Before investing in a new recovery component, check its end-to-end call path:
  installed entrypoint, caller/operation scope, artifact/host constraints, result
  query, and failure exit. Use existing authorized observations; inaccessible
  evidence remains an explicit gap, not permission for a new protected read.
- Separate ordinary application release, business-state recovery, and deployment
  controller/profile changes. Prefer existing admitted mechanisms; explain a
  concrete shared-capability gap before proposing another incident-specific
  installer or privileged binding. Risk alone does not require a new Product Spec.
- Keep the old business turn, bootstrap transaction, and controller update as
  distinct evidence subjects. No journal status grants retry, a replacement ID,
  fence clearing, or new admission; apply the selected accepted path's conditions.
  The old business outcome may remain UNKNOWN under the recovery rule above.
- Carry incident history and unresolved dependencies across task/PR handoffs.
  Renaming a task does not erase failed attempts or restart an incident from zero.
  Reuse still-valid evidence and review only affected changes; this does not
  waive real blockers or add a new global review counter.

The [HR recovery/deployment reuse handoff](../../docs/reports/HR_RECOVERY_DEPLOYMENT_REUSE_HANDOFF_20260929.md)
records the motivating evidence and bounded follow-up objectives. Its proposed
implementation work is not Product Authority or production authorization. It must
not become an additional prerequisite for an already-safe authorized recovery.

### Release governance is not Product Authority

A rollout, canary, dogfood, or one-operation safety concern remains a Controlled-operation concern unless it creates a genuinely load-bearing long-lived Product Contract.

Do not invent persistent product state, a new durable protocol, or a new Product Spec solely to make a bounded release procedure easier to prove when an exact Execution Mandate / Controlled Runbook can contain the risk.

If review proves that a long-lived Product Contract is genuinely missing, stop and re-PREFLIGHT through `AMEND`, `SUPERSEDE`, or `NEW`; do not smuggle that contract into a release document.

```text
RELEASE_GOVERNANCE_IS_NOT_PRODUCT_AUTHORITY = YES
ONE_OPERATION_RISK_DEFAULT_HOME = mandate/runbook/receipt
PERSISTENT_PRODUCT_PROTOCOL_FOR_RELEASE_ONLY = FORBIDDEN
```

### Freeze the review blocker union

The first independent review of a candidate records the complete known ship-blocker set as `FROZEN_BLOCKER_UNION`.

The normal repair cycle is:

```text
initial independent review
-> freeze blocker union
-> one blocker-union repair pass
-> one exact-head re-audit
```

A re-audit may add a new ship blocker only when it is a valid blocker under the vendored grammar and has a concrete, reachable counterexample against the current affected surface. Reviewer preference, speculative hardening, hypothetical races without a reachable current counterexample, and optional robustness improvements are `FOLLOW_UP`, not reasons to restart the candidate indefinitely.

A newly discovered concrete `SECURITY_OR_DATA_LOSS`, `FALSE_EVIDENCE`, `REQUIRED_GATE_FAILURE`, `CONTRACT_VIOLATION`, `REPOSITORY_INVARIANT_VIOLATION`, `CONCRETE_REGRESSION`, or `SCOPE_ESCALATION` remains blocking; this section never suppresses a real blocker.

### Convergence checkpoint (effective on V3 adoption only)

Retain review/repair history for the same business outcome across candidate
renames. Repetition without new evidence calls for reassessing scope or choosing
an existing simpler recovery path; it is not progress merely because another
report exists. This is diagnostic guidance, not a universal numeric cutoff.
Task-specific budgets require applicable authorization; they neither waive real
Blockers nor forbid an otherwise authorized necessary repair solely by round count.
Do not stop a usable service merely because a development candidate is paused.
The old three-round local guard remains controlling before V3 is active on main.

### Minimum live slice first

When a merged capability is decomposable and the full rollout keeps expanding the proof surface, deploy the smallest independently useful low-risk slice first.

Default order:

```text
read-only visibility/status
-> one bounded exact mutation canary, if needed
-> broader self-service mutations only after the earlier slice is live and proven
```

Optional dogfood, critical-job mutation, broad admin behavior, or unrelated compatibility work MUST NOT gate a read-only slice unless an accepted Product Contract explicitly requires atomic delivery.

Each production slice keeps its own Controlled-operation gate, rollback/readback, and receipts.

### Proportional re-review

Intermediate re-audits review:

- the frozen blocker closures;
- semantics changed by the repair;
- directly dependent Evidence/invariants invalidated by that repair.

Do not rerun unrelated prior mechanisms merely because the candidate Head changed mechanically. The final Controlled production boundary still runs the complete applicable matrix required by accepted authority.

### Stop discipline

Once `DONE_WHEN` is met and no valid `EXPANSION_TRIGGER` fired, stop. Do not convert optional hardening discovered during review into mandatory same-Goal work.

## Local operating loop

```text
1. Read only the current task, relevant local authorities, and required evidence.
2. Classify Authority, Plan, and Assurance independently.
3. REUSE: implement within the accepted base Contracts; no new Spec for internal choices.
4. AMEND/NEW: use the active local atomic permission only where applicable.
5. CONTROLLED/SUPERSEDE or no active atomic permission: keep the docs-first boundary.
6. Review the actual affected surface; acceptance is by the authorized maintainer.
7. Run relevant tests and report implementation, installation, and business results separately.
8. Scope any real blocker to dependent work; do not restart unrelated completed checks.
9. Prefer existing safe recovery; optional generalized maintenance stays separate.
10. DONE_WHEN met without a valid EXPANSION_TRIGGER -> STOP.
```

Local extensions may refine the vendored governance but may not silently weaken or contradict the pinned distribution. Updating the distribution requires a separate docs-only adoption/update review.
---
name: spec-governance
description: Route goal-driven work through independent Authority, Plan, and Assurance decisions without conflating Product Authority, one-operation mandates, implementation, runtime state, or Evidence.
---

# Spec Governance Skill V1

Use exactly one primary mode per invocation:

```text
PREFLIGHT   classify Authority, Plan, Assurance, readiness, and next action
AUTHOR      create or revise Product Authority when the route requires it
REVIEW      independently review an exact authority/change/final Head
COMPLIANCE  evaluate exact implementation or operation against exact Contracts
```

Change Briefs, ExecPlans, Execution Mandates, and Controlled Runbooks are artifacts, not modes.

## Read order

1. `AGENTS.md`;
2. `.agents/README.md`;
3. `.agents/local/README.md`;
4. directly relevant accepted authorities;
5. only the selected mode file.

Read the V1 protocol and Spec format only as needed.

## Shared invariants

```text
Product Authority creates long-lived obligations.
Execution Mandate constrains one operation.
Every mutation needs attributable target/scope/effects/Done When authorization and an isolated write surface.
Complexity determines Plan.
Failure consequence determines Assurance.
Investigation / Task / test / Review comment do not create Product Authority.
AMEND/NEW + CONTROLLED and every SUPERSEDE route are docs-first.
Load-bearing SPEC_GAP -> AMEND/SUPERSEDE/NEW + readiness NO + RE_PREFLIGHT.
Inaccessible required Evidence -> REQUIRED_GATE_FAILURE, not automatically FALSE_EVIDENCE.
Runtime is Observation, not authority.
Emergency pre-Spec action is Owner-authorized incident containment only; no durable new behavior.
DONE_WHEN met without EXPANSION_TRIGGER -> STOP.
```

For every mode, bind exact coordinates, preserve stable accepted IDs and whole-authority backlinks, separate Observation from Working Guess when it affects routing, distinguish deterministic checks from semantic judgment, and persist load-bearing results outside chat.

Choose `PREFLIGHT` before non-trivial code/operation unless a persisted record covers the exact request and coordinates. Choose `AUTHOR` only for `AMEND`, `SUPERSEDE`, or `NEW`; `REUSE` normally uses a Brief/ExecPlan. Choose `REVIEW` for independent exact-Head/affected-Contract/final-Head review. Choose `COMPLIANCE` after implementation or operation exists.

One Agent may perform Recorder, PREFLIGHT, and Planner cognitive functions. Independence is required only where Durable/Controlled assurance, authority, or local policy requires it; do not create a fixed Agent formation.
.agents/skills/spec-governance/SKILL.md
.agents/skills/spec-governance/modes/REVIEW.md
.agents/skills/spec-governance/modes/AUTHOR.md
.agents/skills/spec-governance/modes/COMPLIANCE.md
.agents/skills/spec-governance/modes/PREFLIGHT.md
# RECEIPT — #627 HUMAN_GATE Spec 修订与 B1/B2 blocker 修复

日期：2026-11-06（Asia/Shanghai）。**spec proposal, proposed — not acceptance**。
本回执前部保留 2026-11-06 修订历史；**当前状态以末尾 2026-11-09 B1/B2 修复段为准**。
历史 PASS 不覆盖本次 blocker，历史“本轮”均指 2026-11-06。
`RECEIPT-EKR-P1A-SPEC.md` 保留原提交时的历史观察，
其中 #1352 待核验及旧 Spec 哈希不再代表本轮状态。最终提交、push 和 PR readback
以 Git/PR 元数据为准，不在自身提交中预报成功或制造自引用 SHA。

## 坐标、授权与路由

```text
REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/dsh-ekr-p1a-spec
BRANCH = ac-ekr-p1a-spec
REVISION_BASE_HEAD = 858736033e683f4116f9b971ea437b04b50ed424
ORIGINAL_PROPOSAL_BASE = f6a1f77a8b7b878bcb9821a68836925755ca7076
PR = https://github.com/mayf3/dsh-agent-core/pull/627
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (existing proposed authority only)
ROUTE_STAGE = AUTHORITY_AUTHORING
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (reply authorization / cross-repository protocol)
DOCS_FIRST_REQUIRED = YES
SPEC_STATUS = proposed
SPEC_REVISION = proposal-2
AUTHORITY_ACCEPTED_IN_BASE = NO (this HUMAN_GATE proposal)
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (pending exact-head Owner acceptance)
OPERATION_ALLOWED = NO
ACCEPTED_AUTHORITY_DELTA = NONE
PRODUCT_SOURCE_OR_TEST_DELTA = NONE
PRODUCTION_WRITES = 0
```

历史修订记录将授权归于“#627 HUMAN_GATE Spec 三处小修（Owner 裁定④，2026-11-06）”
及 `BRIEF-627-REVISION.md`；该原任务指令④与 Brief 本轮均为 `NOT_LOCATED`。
不可读不等于不存在，旧路径/哈希不能替代可读原文；当前来源重锚定见末尾 B2。
本次仅修提案及回执、提交并推送的授权来自用户执行 FIX-BRIEF 的明确指令，
不沿用历史 PR 更新或额外 STOPPED 文件写入要求。

初始 PR readback：OPEN、未合并，head 与 `REVISION_BASE_HEAD` 一致。
修订仅作用于 `docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md`
和本回执；两个已有未跟踪 Brief 保留原样、不纳入提交。

## 修订点 → 裁定条款映射

| 本次裁定 | 修订落点 | 可审阅结果 |
|---|---|---|
| ① 引文补正：#1352 comment-6622750077，mayf3，2026-11-04 12:42:18 +08，监管代记，三点持久记录 | §3、OBS-HG-003、EVD-HG-003；CTR-HG-002/003；移除 §13 的评论 UNKNOWN | 精确链接、作者、UTC/+08 时间和“监管代记”已记录；HUMAN_GATE 群含上下文/已尝试清单、仅 Owner 指定域 owner 可代答/resolve、24h 无 resolve 升级再提醒均明确。身份验真不授予代答权 |
| ② 24h 为未 resolve 处置期限，回复/ACK/VERIFIED 不取消责任，从原 escalationAt 起算，Svc 持久升级提醒及重发现 | DEC-HG-003、CTR-HG-005/008、§10、ACC-HG-008 | 逻辑字段改为 escalationAt/resolutionDueAt（原 escalationAt + 24h）；第 1 小时回复且验证成功但未 resolve 到期仍提醒；重启、丢事件、通知失败保留责任/原期限及发送结果；仅 OVERDUE 不合格。均为验收定义，NOT_RUN |
| ③ 普通/managed 分拆，不放宽 guard；managed 合法后继归 Svc #1378/#1352 | DEC-HG-002、CTR-HG-004 路径表、§10、ACC-HG-004、§13/13A | 普通 owner_action 支持 HUMAN_REQUIRED→RESOLVED；opted-in managed 走 require_effect/真实 STARTED REVIEW effect，现有可达路径下直接 Owner resolve 被 guard 拦。Core 仅消费；不把路径约束输入冒充 Svc 实现或运行验收 |
| ④ 依赖边界：收件面、身份映射、resolve link、持久重发现等 UNKNOWN；Core 合同接受≠全链路解阻 | 新增 §13A；同步 §6/§13 | 六项外部依赖保持 UNKNOWN，包含 managed 合法后继、24h 实际接线、paired accepted revision 与真实 DB 证据；文档接受不能宣称 HUMAN_GATE 可用或 managed 已解阻 |

## 来源核验与权威边界

通过 GitHub connector `github_fetch` 只读访问
`https://api.github.com/repos/mayf3/agent-control/issues/comments/6622750077`，
本轮核验截至 `2026-11-06T03:37:56Z`（11:37:56 +08）。返回 `isError:false`：

- `id=6622750077`，`issue_url=https://api.github.com/repos/mayf3/agent-control/issues/1352`；
- `user.login=mayf3`，`author_association=OWNER`；
- `created_at=updated_at=2026-11-04T04:42:18Z`，即 2026-11-04 12:42:18 +08；
- 正文标题明确“监管代记”，三项裁定与本次交办一致；
- 解码后原始 body 的 UTF-8 SHA-256：
  `0552d8c8c6e3620145dcf641acedfe70249e59477c45356336cc763fa1f2f435`。

稳定来源：[Owner 评论](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)。
这证明裁定记录存在，不证明通知、身份、Svc effect/resolve 或运行结果已经实现。
普通/managed 具体路径约束归因于本次 Owner 交办输入；未声称本轮重新审计 Svc 源码/DB。

已按入口读取共享 grammar、local authority、Product Architecture、Current Decisions 的
D-008/Workflow notification、accepted Owner V2 §§2/6/8/9、WAE001b、WEC005/008，
以及 spec-governance Skill 和 AUTHOR mode。未修改 accepted 文件或稳定 accepted 含义。

| accepted 输入 | 本轮实测 SHA-256 |
|---|---|
| Core Owner Workflows V2 | `f8e8b0d48f8e2a682897c98f5003a1ffbd608ed722fb653a01bde81417767e7b` |
| Core WAE V3 | `c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6` |
| Core WEC V3 | `03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4` |

本轮 GitHub compare（原 proposal base→main）观察到 main
`75ece578301b014a23b987568d1eb8af96795300`，ahead 7 / behind 0。
变化为 P1-B 记录/测试及 window 工具/记录，不涉及上述 accepted governing authorities、
Architecture、Decisions 或本地治理。未 fetch/rebase，未操作窗口工具；不重开已通过修复。

## 文档检查与独立审查

修订 Spec 实测 SHA-256：
`dff7a653b918adfc442d7f9f49b8346675e02f44154cab1d4b9cf7c298681896`。
相对 revision base 的 Spec diff：85 additions / 29 deletions。

以下实际检查 rc 均为 0：

- Python `jsonschema.Draft202012Validator` 对仓内 `spec-frontmatter.schema.json`
  验证修订 frontmatter；`validate_transition([base_proposal], [revised_proposal])`
  验证 proposed→proposed 生命周期；status/prod authority 保持 proposed/none。
- 8 个稳定 CTR-HG ID 与 8 个 ACC-HG 对应；CTR-HG-006/007 整段与 revision base
  bytes 相同，原 WEC008 DTO/单次消费证明未改。
- 旧 responseDueAt/escalatedAt 与“引文待 gh 恢复核验”表述已移除；authoring 语义复核
  由独立 reviewer 完成，机械字符串检查不代替语义审查。
- `python3 .agents/tools/verify_governance.py --target .`：vendored bytes 匹配 lock。
- 历史记录称 `git diff --check`、允许路径及原 Brief 哈希检查通过；源码/测试/accepted
  authority 无 diff。历史记载 `BRIEF-627-REVISION.md` SHA-256 为
  `476d4aade7f9c872994c613fdc0c16869055f76adf3f3226b2b7032b608c43a0`；
  旧 authoring Brief SHA-256 仍为
  `dd0d64272f2cec20aa40900b5a286e840719e5151407a0797ba55ff0af2c6cf6`。
  以上 Brief 哈希本轮未复验，不作当前原指令④可读证据。

独立 reviewer `/root/revision_review`（非作者）完成相对 revision base 的 DELTA 审查：
**PASS**，`FROZEN_BLOCKER_UNION=[]`，`BLOCKERS=0`，无新真实 authority conflict。
审查绑定上述 Spec SHA-256，及审查时回执（PENDING 版本）SHA-256
`c93d9a9cf89641c9102b3436d671fa15c94eb6a903c9d0f427036f03629d43b2`。
确认四条裁定、原 WEC008 边界与回执真实性；独立复验 schema、lifecycle、8/8 coverage、
hash、governance integrity、diff check 均 rc=0，实时评论 body hash 与本回执一致。
本次仅将审查结果写回回执；最终 commit 另做 receipt-only/final-head delta recheck。
产品/运行时/paired fixture 测试均 NOT_RUN；ACC-HG 是后续验收定义，不是本轮通过的测试。

历史 Done When：仅提交上述 Spec 与本回执，push 原分支，更新 PR #627 描述并 readback；
保持 proposed，等待 Owner 对精确 head 的接受。不得把文档审查 PASS 升格为产品实现、
安装、生产、业务闭环或跨仓解阻。

## 2026-11-09 当前修复 — HG-WEC5-LOCK-TIMING / HG-RULING4-SOURCE

```text
WORKTREE = /private/tmp/review-627/repo
BRANCH = ac-ekr-p1a-spec
REPAIR_PARENT_HEAD = 1c3371abe36bcda08da27eb901e86dd95af949bc
AUTHORITY_REFERENCE_MAIN = a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (existing proposed authority only)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (docs-first; no implementation or operation)
ROUTE_STAGE = AUTHORITY_AUTHORING
SPEC_STATUS = proposed
SPEC_REVISION = proposal-3-blocker-repair
AUTHORITY_ACCEPTED_IN_BASE = NO (this HUMAN_GATE proposal)
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (pending exact-head Owner acceptance)
OPERATION_ALLOWED = NO
PRODUCTION_APPLY_AUTHORITY = none
ACCEPTED_AUTHORITY_DELTA = NONE
PRODUCT_SOURCE_OR_TEST_DELTA = NONE
PRODUCTION_ACCESS = NONE
```

当前授权与冻结范围：用户明确要求执行 `/tmp/review-627/FIX-BRIEF.md`，只修 B1/B2，
只改提案 Spec、本修订回执及必要验收定义，单 commit 推 `origin ac-ekr-p1a-spec`；
push 失败则生成 bundle 交接，不重试。该修复简报本地实测 SHA-256：
`ce6c64f53d5cc80e54dbdfc044b214b5ec6ac1e86648030d63e557cee2030bdf`。
GOAL/CURRENT_GAP 为修复锁时序冲突和不可核的原指令④归因；DONE_WHEN 为两处闭合、
文档校验与独立 delta 复核后单 commit 推送，失败则 bundle。
EXPANSION_TRIGGER 为新增真实权威冲突、超出这两个 blocker 的语义改动或生产访问需求；
本轮不重开产品裁定。最终 commit、push 或 bundle 结果由 Git/交付元数据报告，
本回执不预报提交 SHA 或推送成功。

### B1 — HG-WEC5-LOCK-TIMING（CONTRACT_VIOLATION）

只读 `git show <AUTHORITY_REFERENCE_MAIN>:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md`
及 V3/V4 的生命周期记录，核到 V3→V4→V5，WEC5 status=accepted、accepted_by=mayf3、
production_apply_authority=none。固定可读坐标：
[WEC5 CTR-WEC1-008 两类 collection](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L653-L699)、
[CTR-WEC4-010](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L759-L815)、
[ACC-WEC4-003](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L953-L968)。
WEC5 文件实测 SHA-256 为
`e2160a5eff748d03daa199b08517bb89e1efaa64008020e27d0344385adf331a`。
这是已存在的本地 origin/main 快照读取；未 fetch/rebase，不宣称已刷新远端 main。

修复将提案 governed_by/§3 有效 WEC 引用改为该 WEC5，原 authoring base 保留。
CTR-HG-007 明确锁内 detached capture → 锁外 pre-plan/evidence collection → 重获同锁
→ CURRENT ledger replay → fresh trusted 权威等值终检 → 单次 planned append。
两份旧 read/local revision/TTL 不能替代终检；相关 drift/缺证据一律本轮零 plan/消费/投递，
原 refusal 与正常 sweep 保持。ACC-HG-007 同步要求两段实际 barrier 下无关 B 先完成、
真实独立双 writer、全部 append 保留及终检等待证据；禁止锁内重跑整套采集。
原 DTO、sequence/baseline、单次 permit、budget/STOP、恢复边界均保留。
这些是提案语义/验收定义修复，双 writer 产品测试仍 NOT_RUN、性能 UNMEASURED。

### B2 — HG-RULING4-SOURCE（REQUIRED_GATE_FAILURE）

本轮 root 与非作者 reviewer 分别只读本地持久文件：
`/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`。
源文件本轮 SHA-256 为
`6afd34a5b035113a919737dee4afa0ef777169c4e9c2bbb4041308a39774f2ea`。
读取方法为 Python `json.loads`，按 ruling `id` 精确选择 `items[3]`；以下摘录直接持久化于
本回执，独立审阅不依赖临时 Brief。registry 时间按原记录保留，不推断未标注时区。

| 持久坐标 / source status | 本轮可读内容及证明范围 |
|---|---|
| `$.rulings[id=owner-20261108-three-unified].items[3]`；ts=`2026-11-08 06:11`；本地读取 VERIFIED | 原文必要摘录：“范围内缺证/引用/构建/测试/网络/合并问题原责任链自主处理, 不以新SHA/Session/SpecID/普通失败为由重复请批; 仅常设授权§7所列新风险/新决策才最小差量HUMAN_GATE”。支持 HUMAN_GATE 政策语义及原责任链修复，不补写原④ |
| `$.rulings[id=owner-20261108-backlog-convergence].items[3]`；ts=`2026-11-08 09:05`；本地读取 VERIFIED | 原文必要摘录：“#1352复用已裁定不重请”。支持复用既有裁定，不重决产品语义 |
| [agent-control #1352 评论 6622750077](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)；历史独立核验 REUSED | 作者 `mayf3`、created/updated=`2026-11-04T04:42:18Z`、三点裁定及 body hash `0552d8c8c6e3620145dcf641acedfe70249e59477c45356336cc763fa1f2f435` 见前部历史核验记录；2026-11-09 独立审查修复简报也明确其已独立核实。当前未重新请求评论，不将三点冒充原④全文 |
| 2026-11-06 原任务指令④、`BRIEF-627-REVISION.md` | NOT_LOCATED；不可读≠不存在。旧 Brief 哈希仅历史记录，不证明本轮可审阅原文；不虚构、不重建原文 |

两个完整 `items[3]` 的 canonical SHA-256（UTF-8，
`json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，包括 JSON 字符串引号）
依表中顺序为：
`bc504d55a11b3581377a0fc188c704ac1f0b7e4b88465646904e9b4347dc1cb9`、
`78eb96d162b9845470a4c575d1e5aec911cb9aa7fcbe6368d7414789ef59ccbd`。


codex
差异仅涉及提案 Spec 和修订回执。我会按仓内 `spec-governance` 的 REVIEW 模式，将锁时序与来源归因分开复核，并检查其余条款是否保持不变。
2026-11-09T11:44:26.195436Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:44:26.448824Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:44:27.450515Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:44:35.335011Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:44:35.589306Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
2026-11-09T11:44:36.592684Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3333/mcp)")))
exec
/bin/zsh -lc "cat .agents/skills/spec-governance/modes/REVIEW.md; sed -n '1,180p' docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md; cat docs/decisions/README.md" in /tmp/review-627/repo
 succeeded in 0ms:
# REVIEW mode

## Goal

Independently evaluate an exact candidate, affected implementation surface, controlled operation, or final accepted Head without creating Product Authority or expanding into open-ended research.

## Coordinates

```text
REPOSITORY
REVIEW_KIND = SPEC | AFFECTED_CONTRACT | CONTROLLED_OPERATION | FINAL_HEAD
REVIEW_TARGET_HEAD
BASE_HEAD
CURRENT_BASE_HEAD
REVIEWER_ID
AUTHOR_ID
ASSURANCE_LEVEL
```

Do not rely on unrecorded chat or inaccessible author-only material.

## Review scope

Use `review.scope = DELTA` for receipt-only Head changes, bounded semantic repairs, or bounded relevant Base changes; still independently recheck the final Head and all invalidated dependencies. Record `scope_reason` and `impact_evidence`. Use `FULL` only for `INITIAL_REVIEW`, an identified `ACCEPTED_FULL_GATE`, or demonstrated `UNBOUNDED_IMPACT`; a new SHA alone never requires it. The complete applicable production matrix stays mandatory, but unchanged mechanisms are not rerun without invalidation. Freeze scope/gates, not the ability to identify real risks.

Follow the grammar's bounded delivery cycle. Review repairs and reachable regressions; do not restart full-system research under a new candidate or packet name. Historical reviews remain evidence, not new authority. Prefer persisting recheck receipts in the PR conversation, so recording the result does not change the reviewed candidate Head.

## Passes

- **Authority/route:** local ownership, exact parents/refs, one unique Authority action, explicit implementation authority, proposal boundaries, no partial supersession, mandate scope.
- **Primitives/Evidence:** Observation versus interpretation, State coordinates, Claim support, load-bearing Evidence relations, reviewability, Secret-safe receipts.
- **Scope/stop:** Goal/Gap, non-goals, allowed/forbidden effects, Done When, Expansion Trigger, optional infrastructure not masquerading as progress.
- **Contracts/Acceptance:** relevant semantic paths; each Acceptance can produce Required Evidence and reject a concrete wrong implementation.
- **Base impact:** unrelated Base movement gets bounded conflict/authority/behavior/Evidence checking; candidate/relevant authority/behavior/conflict changes invalidate affected review.

### Convergence exit (conditional)

Applies only when the change claims convergence, retirement, or migration completion; otherwise `NOT_APPLICABLE`. Before final convergence may pass, verify with bound evidence:

```text
NEW_PATH_USABLE                    the current path satisfies applicable business
                                   and safety Contracts, with executed evidence
OLD_EXECUTION_PATH_RETIRED         the retired executable path cannot re-enter new
                                   work through affected normal or fallback paths
RECOVERY_DOES_NOT_REVIVE_OLD_PATH  applicable restart, recovery, retry, replay, and
                                   migration reruns do not recreate the retired
                                   model or transfer authority improperly
```

Bind each proof to scope, revision, environment, and observation time. Validate the Change Brief's RETAIN / RETIRE / MIGRATE / TEMPORARY_BRIDGE dispositions and, for any remaining bridge, its real consumer and exit condition. Retiring an executable path is not deleting history: audits, receipts, migration records, and necessary tombstones stay readable without granting present eligibility. A stable supported public facade may remain permanently and never blocks convergence; only a temporary migration bridge owes a real consumer and an objectively verifiable exit condition. Unknown or unexecuted coverage stays unknown — it must not become zero, PASS, or fabricated execution. A remaining bridge means a bounded stage, not final retirement. Review uses the parent's existing blocker classes and legal sources; already authorized contract-preserving cleanup needs no new approval merely because it is refactoring.

## Findings

A Blocker uses one class:

```text
CONTRACT_VIOLATION
REPOSITORY_INVARIANT_VIOLATION
CONCRETE_REGRESSION
SECURITY_OR_DATA_LOSS
FALSE_EVIDENCE
SCOPE_ESCALATION
REQUIRED_GATE_FAILURE
```

Every Blocker states `SOURCE`, `COUNTEREXAMPLE`, `IMPACT`, `MINIMAL_CLOSURE`. Legal sources are accepted Product Authority, accepted local governance/invariant authority, a pre-existing active machine gate, or a valid Execution Mandate.

Use `SPEC_GAP`, `FOLLOW_UP`, or `TOOLING_DEBT` for non-Blockers. A load-bearing gap still makes dependent readiness false, but must carry the protocol's concrete `spec_gap_detail` diagnosis. Reviewer preference or an unproven dependency cannot silently create a new product requirement. An unresolved safety uncertainty remains a narrow pause for fact-finding, not permission to execute. An open Blocker's named `affected_readiness` boundaries must include an explicit `NO` and no `YES`; do not stop unrelated authorized work. Inaccessible required Evidence is `REQUIRED_GATE_FAILURE`; use `FALSE_EVIDENCE` only for fabrication, material distortion, or false execution claim.

## Output

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC | AFFECTED_CONTRACT | CONTROLLED_OPERATION | FINAL_HEAD
SPEC_REVIEW = ACCEPT | REVISE | NOT_APPLICABLE
REVIEW_TARGET_HEAD = <sha>
BASE_HEAD = <sha>
CURRENT_BASE_HEAD = <sha>
REVIEWER_ID = <identity>
AUTHOR_INDEPENDENCE = PASS | FAIL | NOT_REQUIRED
AUTHORITY_REVIEW = PASS | FAIL
PRIMITIVE_BOUNDARY_REVIEW = PASS | FAIL | NOT_APPLICABLE
CONTRACT_REVIEW = PASS | FAIL | NOT_APPLICABLE
ACCEPTANCE_COVERAGE_REVIEW = PASS | FAIL | NOT_APPLICABLE
MANDATE_SCOPE_REVIEW = PASS | FAIL | NOT_APPLICABLE
EVIDENCE_REVIEWABILITY = PASS | FAIL | NOT_APPLICABLE
BASE_IMPACT = NONE | BOUNDED | RELEVANT
REVIEW_SCOPE = NONE | DELTA | FULL
SCOPE_REASON = <when review or recheck is required>
IMPACT_EVIDENCE = <bound diff and dependent evidence checks>
FULL_REVIEW_BASIS = INITIAL_REVIEW | ACCEPTED_FULL_GATE | UNBOUNDED_IMPACT
                   # only for FULL
BLOCKERS = <n>
SPEC_GAPS = <n>
FOLLOW_UPS = <n>
TOOLING_DEBT = <n>
IMPLEMENTATION_ALLOWED = YES | NO | NOT_APPLICABLE
MERGE_READY = YES | NO | NOT_APPLICABLE
OPERATION_ALLOWED = YES | NO | NOT_APPLICABLE
NEXT_ACTION = CONTINUE | STOP | RE_PREFLIGHT | OWNER_DECISION
```

Review is not acceptance.

Final accepted-Head recheck binds `FINAL_ACCEPTED_HEAD`, `ACCEPTANCE_ACTOR`, `ACCEPTED_AT`, `SEMANTIC_DELTA_AFTER_REVIEW`, and `FINAL_HEAD_RECHECK`. Any normative semantic delta requires a new independent review.
# Agent Core Product Architecture V1

> 状态：冻结草案（docs-only）· 日期：2026-08-15  
> Authority amendment：2026-08-18  
> 基线：`69273a9`（Integration V1 已合并）；契约：`AGENT_SESSION_CHANNEL_MODEL_V1`（D-002）  
> 本文件回答：**最终 Agent Core 到底是什么、每一层归谁负责、哪些边界永不跨越**。
>
> **安全域声明修订：**本文件原先把“one Agent = one DSH process”直接冻结为
> peer-Agent 对抗性安全域。该 claim 已被
> [`AGENT_CORE_HARDENING_PROGRAM_V1`](specs/AGENT_CORE_HARDENING_PROGRAM_V1.md)
> amendment：
>
> ```text
> PEER_AGENT_SECURITY_DOMAIN_CLAIM = SUPERSEDED
> REPLACED_BY = AGENT_CORE_HARDENING_PROGRAM_V1
>
> one Agent = one DSH process
> = runtime / lifecycle / DSH_HOME / Session-owner boundary
> != current adversarial peer-Agent isolation boundary
> ```
>
> 当前同主机、共享运行身份的 Agents 属于 cooperative shared-host trust domain；
> Control Plane、Broker credential 与 service credential 仍必须对 Agent 保密。
> 本文件其余 ownership / thin-layer / DSH-native 边界不受该 amendment 影响。

---

## 0. 一句话总结

**Agent Core 是基于 DeepSeek Harness 的一层薄组织层：把 DSH 的通用 Agent 运行时组织成
一批长期存在的「数字员工」——每个员工有稳定身份、专属 workspace 与 DSH 进程、多个
会话、跨会话记忆、独立进程身份，能调用外部业务能力，也能长出新技能。**

它**不重做** DSH 的任何运行时能力，也不替代 Forum / Workflow / OKR——它只负责
「员工是谁、在哪里办公、正在和谁聊、什么时候上班、怎么安全地访问外部系统」。

类比（帮助理解，不替代定义）：

| 概念 | 人话 |
|---|---|
| Agent | 花名册上的一个员工 |
| Workspace / DSH_HOME | 员工的专属办公桌和抽屉 |
| Session | 员工和不同人谈不同事情留下的谈话记录 |
| Memory | 员工跨所有事情沉淀下来的长期经验 |
| ChannelConversation | 某个聊天软件里的一条会话 |
| Binding | 「这个聊天窗口当前连的是哪位员工」的工牌插槽 |
| Router / Control Plane | 前台 + 调度员 |
| Process | 员工今天上班的工位（一个 Agent = 一个独立工位/进程） |
| Process Credential | 门禁卡（证明我是这位员工） |
| Broker | 公司唯一的对外业务窗口 |
| Plugin Lifecycle | 学会并保留新技能 |

---

## 1. 目标形态与分层

```
Channels / Product UI
  Feishu / WeChat / Mobile / Web
            ↓  只做传输与展示
ChannelConversation + Binding
            ↓  渠道落地入口（幂等 resolve；Binding 表达“当前在聊谁”）
Agent Core Control Plane
  ├─ Agent Registry      = 花名册（这个 Agent 是谁）
  ├─ Session             = 谈话记录管理（这个 Agent 有哪些独立对话）
  ├─ Workspace Bootstrap = 办公桌在哪（agentId → workspace / DSH_HOME）
  ├─ Router / Process Supervisor = 前台/调度员（消息找谁 + 进程何时启动/恢复）
  ├─ Memory              = 跨 Session 的长期经验
  ├─ Plugin Lifecycle    = 新技能（实验 → 验证 → 保留 → 回滚）
  └─ Proactive Runtime   = 没人催也会继续工作（schedule/goal/inbox 之上的薄层）
            ↓
one Agent = one DSH process
  （运行时 / 生命周期 / DSH_HOME / Session-owner 边界；
    当前不是 shared-host peer-Agent 对抗性隔离边界）
            ↓
DSH（Runtime）
  loop / tools / fs / shell / skills / agent-instructions
  subagents / compaction / goal / inbox / session persistence
            ↓
Generic Broker Bridge（统一外部能力入口，进程凭据身份）
            ↓
Forum / Workflow / OKR / 其他外部业务系统
```

---

## 2. Product Concepts — 精确含义与所有权

### Agent（长期实体）

- **定义**：全局唯一的长期实体，代表一位「数字员工」。拥有并独占：workspace、
  DSH_HOME、credential、memory、会话存储、进程身份。
- **生命周期**：预置时自动创建其 `main` session；存在与生命周期不依赖任何 Channel。
- **人话**：花名册上的一个员工——有工号、有办公桌、有自己的抽屉，不管今天有没有人
  来找他聊天，他都存在。
- **所有权**：Agent Core Control Plane（Registry 登记身份，Workspace Bootstrap 给
  办公桌，Process Supervisor 管工位）。

### Session（属于 Agent）

- **定义**：Agent 之下的一条独立对话。**Session identity = (agentId, sessionId)**
  （实验证据，Session V1 PoC 已定案）：DSH SessionId 作用域是 per-Agent DSH_HOME，
  非全局，因此 Agent A/main 与 Agent B/main 可同时存在。`main` 为每个 Agent 的
  保留 SessionId（长期主会话，不可归档/删除）；`normal` 会话用其他 opaque
  sessionId，可新建、归档（软）、删除（硬）、定期清理（保留期=配置）。
- **人话**：员工和不同人谈不同事情的谈话记录——「和论文导师聊论文」一条，「和财务
  对报销」另一条；记录本放在员工自己的抽屉里（per-agent DSH_HOME）。
- **所有权**：Agent 拥有；**Session Runtime 全部由 DSH 原生负责**（identity /
  trajectory persistence / create / resume / process death recovery）。Agent Core
  **不建 Session mapping layer、不建独立 session 包**（product sessionId = DSH
  native sessionId）；Product API milestone 只维护产品元数据（title / kind /
  archived / lastActiveAt）。

### ChannelConversation（渠道侧会话）

- **定义**：某个渠道里的一条会话，`(channel, externalId)` 全局唯一。渠道标识是
  不透明字符串（`feishu` / `wechat` / `android` / `web`），API 不解释其值。
- **人话**：微信里和某人的聊天窗口、飞书里的某个群——窗口本身不决定里面是谁在
  服务。
- **所有权**：控制面登记；**Channel 不拥有它上面的 Agent / Session**。

### Binding（ChannelConversation → 当前 (agent, session)）

- **定义**：每个 ChannelConversation 至多一条；表达「这个窗口当前正在和哪个 Agent
  的哪个 Session 对话」。`switchAgent` 只写 Binding（不创建/移动/复制任何
  Agent/Session，无角色扮演、无切换历史）。
- **人话**：窗口上的工牌插槽——今天这个窗口接的是张三，明天可以插上李四的工牌，
  人没变，只是窗口换了服务对象。
- **所有权**：控制面持有；渠道适配器不保存任何 Agent/Session 状态。

### Workspace（专属目录）

- **定义**：agentId 唯一对应的长期工作目录（`~/.dsh/workspaces/<agentId>`）与
  DSH_HOME（`~/.dsh/agents/<agentId>`）。AGENTS.md 播种、文件工具基准、会话存储
  都落在这里。
- **人话**：办公桌——所有东西固定放这张桌子，换人进来（进程重启）桌子还在。
- **所有权**：**workspace-bootstrap 是 agentId → 路径映射的唯一 owner**；Router 只
  决定什么时候启动进程，不复制映射规则（Integration V1 边界清理已定案）。

### Memory（长期经验）

- **定义**：Agent 跨 Session 的 curated 长期记忆（区别于 DSH session 日志）。
  形式待定（文件记忆 / MCP 记忆 / 混合），但**不是第二套 session history**——
  它是对经历提炼后的产物。
- **人话**：员工跨所有事情沉淀下来的长期经验（「客户喜欢简洁回复」「这个项目用
  React」），不是某一次谈话的完整录音。
- **所有权**：Agent 拥有；Agent Memory 组件负责 consolidate / recall / 隔离；
  存储通道优先复用 DSH 已支持的 MCP 与文件约定。

### Process（进程身份与生命周期）

- **定义**：一个 Agent = 一个 DSH 进程（per-agent DSH_HOME）。进程是该 Agent 的
  **运行时、生命周期、DSH_HOME 与 Session-owner 边界**：可惰性启动、复用，
  崩溃后自动 respawn + resume。
- **当前信任语义**：共享主机 / 共享运行身份下的 peer Agents 属于 cooperative trust
  domain；当前进程划分不承诺 adversarial peer-Agent isolation。若未来需要 A 无法攻击
  B，必须由独立 `PER_AGENT_SECURITY_DOMAIN_V1` 冻结 per-Agent UID / container / VM /
  sandbox 等额外隔离。
- **人话**：员工上班的工位——一个员工一个工位，工位塌了（进程死了）重新搭一个，
  抽屉里的东西（持久化）原样搬回来；但当前同一办公室里的合作员工不按敌对租户隔离。
- **所有权**：Router / Process Supervisor 管「何时启动/恢复/回收」；进程凭据由
  控制面注入（Phase 3），用于保护 Control Plane / Broker 身份，不等同于 peer-Agent
  文件与主机隔离。

### Plugin / Capability

- **定义**：Agent 可动态获得的能力（DSH Cordis 动态插件 / tool）。Agent Core 提供
  生命周期治理（实验 → 测试/证据 → reviewer → promote → disable/rollback），不
  发明新的运行时。
- **人话**：学会并保留新技能——先练手，确认靠谱后正式上岗，出问题随时停用。
- **所有权**：Agent 进程内执行；当前 peer Agents 属于 cooperative trust domain。
  Control Plane / Broker 仍只相信进程外建立的 caller relationship 与 credential，
  进程内 initiator 只用于归因；Plugin Lifecycle 组件负责治理流程。

---

## 3. 层与职责（谁负责什么）

| 层 | 负责 | 不负责 |
|---|---|---|
# Decisions — Agent Core on DSH

决策记录。每条决策格式：

```markdown
## D-<NNN>: <标题>

- 状态: proposed | accepted | superseded-by-D-<NNN>
- 日期: YYYY-MM-DD
- 背景: 为什么需要决策
- 决策: 选择了什么
- 替代方案: 否决了什么
- 影响: 对文档结构 / 代码 / 迁移的影响
```

已登记决策：

## D-009: Scheduler Occurrence / Outcome / Session / Migration Current Decision（V3）

- 状态: accepted（2026-09-13；Current Scheduler Authority；无 implementation / production authority；全文见
  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md`）
- 日期: 2026-09-13
- 背景: D-007 将 `outcome_unknown` 与 same-job fence 绑定，但当前 Router 已能精确证明
  `terminated_without_outcome`：旧 execution 不再继续，业务 outcome 与副作用仍未知。若继续保持
  fence，Agent 无法安全恢复自己的未来 natural schedule；若映射为 failed/succeeded，则伪造业务结果。
- 决策: 保留 D-007 全部 job/occurrence/at-most-once/retry/session/migration/store 语义，仅把
  business-outcome uncertainty 与 execution termination 分开。可信 exact termination-only settlement
  保持 occurrence=`outcome_unknown`、保存 UNKNOWN 业务事实、解除 execution fence，且不自动 retry；
  允许 trusted-caller-scoped 的 exact self reconciliation，禁止模型选择结果、跨 Agent、raw store、
  trigger_once、runtime reload、kill、run-as/OBO 或权限自增。
- 替代方案: partial amendment D-007、termination=failed/succeeded、模型提供 Router handle/PID、
  title 猜 job、raw fence 删除、shadow Scheduler、self trigger/reload bridge——均拒绝。
- 影响: 独立 exact-final-head `1b41d76fc445846d2a65b5641d10fece79a1d506` review PASS 后，
  authorized acceptance transaction 已完成；D-009 取代 D-007，D-005 历史状态不变。后续仍需 complete `SCHEDULER_TIMEOUT_OUTCOME_V3` 和
  `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` accepted/merged 后才可实现。

## D-008: Agent / Workspace / Session / main 长期产品模型 Current Decision（V3）

- 状态: accepted（2026-09-01；standalone Current Decision；Current Authority；
  supersedes D-006 / V2；全文见
  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md`）
- 日期: 2026-08-31（`TASK_NAME = 模型 执行`）
- 背景: D-006 把普通 Agent-to-Agent Messaging 与 explicit Delegation 合并成单一
  per-task non-main 模型；Owner Current Model 要求前者进入 target Agent canonical main、
  后者保持 per-task non-main，并继续保持 cron per-execution non-main。
- 决策: V3 完整重述 D-006 的仍有效 Current Truth，只把 A2A 拆成两个明确
  primitive：Messaging → target canonical main（reuse/establish same main；each send = new
  Run/Turn, not Session）；Delegation → one task one target non-main；Cron → one execution one
  target non-main。Session 选择由 interaction primitive 决定；target/executing Agent 保持其
  自己的 Workspace、Principal、credential 与 grants。
- 替代方案: 保持所有 A2A per-task、所有 A2A 都进 main、long-lived pair Session、Scheduler
  `run_once` 代替 Messaging、只 amendment D-006 §11——均拒绝，详见 V3 §30。
- 影响: D-006 已原子标记 superseded-by-D-008；七份 active child authority 全部 PRESERVE。
  本次 acceptance 不接受或实现 proposed `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2`，不修改
  child Spec、代码、Grant、Scheduler、Workflow、部署或 production state；后续 `会话 执行`
  仍需形成独立 implementation-authorizing Spec。

## D-007: Scheduler Occurrence / Outcome / Session / Migration Decision（V2，historical）

- 状态: superseded-by-D-009（此前为 standalone Current Scheduler Authority；历史正文见
  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`）
- 日期: 2026-08-19（2026-08-20 accepted；supersedes D-005）
- 背景: D-005 的 job-level execution model（timeout=ordinary error、runningAtMs
  去重、stable per-job Session、legacy catch-up）与真实 fleet evidence 冲突：140 个
  enabled job 绝大多数产生非幂等外部副作用（NON_IDEMPOTENT_SIDE_EFFECT=113）、63/140
  已有 timeout/error，而 Router/AgentProcess 无 cancel + proven termination——重复
  admission 会产生重叠外部副作用；D-005 已 accepted，normative meaning 变化必须完整
  supersession，不得同 stable ID amendment。
- 决策: execution identity 从 job-level 移到 occurrence-level——每逻辑 occurrence 持久
  occurrenceId / runId / idempotencyKey，durable reserve before Router，同 occurrence
  at-most-once admission；timeout without proven termination = outcome_unknown（非
  ordinary failed；same-job execution fence 直到 trusted late settlement / operator
  reconcile；无自动 retry / re-admission；late settlement 只解析状态不重放）；ordinary
  failed retry = 新 occurrence；durable states = admitted / running / succeeded /
  failed / outcome_unknown；exact jobs.json 原子持久化、runs.jsonl 10MB evidence、
  cross-process mutation protocol、CLI control-only 全部 PRESERVE；scheduled Session
  = 每 occurrence fresh non-main + same Agent primary Workspace（D-006）；OpenClaw
  migration = definition-only import + strip legacy execution state + NO_CATCH_UP
  （94 missed 不补跑）；restore gate = READY_TO_RESTORE_BEFORE_HARDENING 0。
- 替代方案: amendment D-005——否决（normative meaning 实质变化）；timeout=failed、
  same-occurrence retry、stale marker 清除重跑、unknown 放行下一自然 occurrence、
  stable per-job Session、Session Mapping DB、补跑 94 次 missed——全部否决（见
  `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md` §10 与 D-007 §1）。
- 影响: D-005 标记 superseded-by-D-007（保留为历史 authority，不删除、不改写历史
  正文）；governing spec = accepted SCHEDULER_TIMEOUT_OUTCOME_V1；Scheduler
  implementation 仍需独立 implementation round；本轮 acceptance = docs only（无代码、
  无 production jobs、无 Scheduler store 修改、无 Kernel change、无 merge）。

## D-006: Agent / Workspace / Session / main 长期产品模型 Current Decision（V2）

- 状态: superseded-by-D-008（此前为 standalone Current Decision；历史正文保留；Current
  Authority 已由 D-008 / V3 接管，全文见
  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`）
- 日期: 2026-08-17
- 背景: 旧 authority 之间出现需人工 merge 才能理解的产品模型分叉（D-002「Agent 固定
  拥有唯一 workspace」→ BINDING_WORKSPACE_V1「Binding 决定 effective workspace」→
  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1「conversation workspace」）；需要一份
  standalone Current Decision 收敛长期产品模型，不再叠 amendment。
- 决策: 一个 Feishu conversation → 一个长期 Agent → 一个 Workspace → 一个 canonical
  main；Agent 拥有独立 agentId（≠ conversationId）；Agent 出生 = 自动创建，trigger =
  FIRST_ELIGIBLE_HUMAN_MESSAGE（transport ingress eligibility 前置：p2p 首条真人消息 /
  首次 @bot / no-mention 群首条 eligible 真人消息 → create；requireMention=true 未 @ →
  drop 不创建）；出生 provisioning 非阻塞 —— AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO
  （AGENT_CHAT_READY = agentId + Workspace + AGENTS.md + canonical main/runtime；
  principal/credential/baseline grants 失败不阻塞聊天，受影响 Broker capability
  fail-closed + 后续 retry，MAIN_RESET != CAPABILITY_REPAIR）；Workspace = Agent 长期
  状态（bootstrap 只 seed AGENTS.md，其余 Agent 自管）；Session = 只隔离 trajectory
  （main / cron-run-* / agent-task-* / background-* 同 Agent 同 Workspace 同
  security domain）；main = 可 reset 的 logical slot（reset 只影响 main，不动
  Workspace/Binding）；cron = 每次执行 fresh session；Agent-to-Agent = 每 task 一个
  session（不建永久 pair session）；non-main 不 merge 回 main，跨 Session continuity
  靠 Workspace + MEMORY.md + 显式 task result；Feishu = FIXED（不切 Agent），Mobile =
  SWITCHABLE（activeAgent only，不创建 Agent）；switch_agent 只限 switchable Product
  Surface（Mobile main ALLOWED，Feishu/cron/agent-task NOT_ALLOWED）；security domain
  = Agent（principal/credential/grants 属 Agent）。
- 替代方案: 继续在旧 Spec 上叠 amendment——否决（Current Truth 更难找）；per-conversation
  workspace 作为长期产品模型——否决（机制能力 ≠ 产品模型，ONE_AGENT_ONE_WORKSPACE 冻结）。
- 影响: 文档 disposition：D-002 PARTIALLY_SUPERSEDE / D-004 PARTIALLY_SUPERSEDE
  （机制保留：Binding owner / 持久化 / single-flight / switch≠角色扮演 / 薄 adapter；
  产品语义被取代：Feishu 通用 switch / 全可 switch / first-contact→default Agent /
  targetSessionId 人类入口状态）/ D-003 PARTIALLY_SUPERSEDE（产品 invariant 保留：
  Memory 属 Agent Workspace / file-first / MEMORY.md / per-Agent 隔离；consolidation
  时机等具体策略 = RETAIN_AS_IMPLEMENTED_STRATEGY，非产品 authority）/
  AGENT_CORE_BINDING_WORKSPACE_V1 PARTIALLY_SUPERSEDE（机制保留，产品模型条款被取代）/
  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd DO_NOT_ACCEPT（→ REPLACE_WITH_SMALLER_SPEC）。
  OWNER_RULING_SYNC = PASS（R2 FIX_REQUIRED 四项已修：creation trigger / birth
  readiness / D-004 / MEMORY_V1）。PRODUCT_CODE_CHANGE = NONE / RUNTIME_CHANGE = NONE /
  MIGRATION = NONE / KERNEL_CHANGE = NONE。

## D-004: Router / Binding 域操作与持久化（Product Integration V1）

- 状态: accepted（分支 feat/product-integration-v1 已实现并真实验收，见
  `docs/reports/product-integration-v1.md`；全文见
  `docs/decisions/BINDING_AND_SWITCH_V1.md`）
- 日期: 2026-08-15
- 背景: Integration V1 的 Binding 是 Router 进程内 Map，重启即丢；没有统一切换
  原语；Feishu 与未来 Mobile/Web 两条入口即将并存，路由规则必须只有一套。
- 决策: Router / Control Plane 是 Binding 的唯一 owner；唯一切换原语
  `Router.switchAgent(bindingContext, targetAgentId, { targetSessionId? })`——
  1) Registry 验证 target Agent 存在，2) Router 选 Session（显式 sessionId，缺省
  main，无 LLM 猜测），3) 更新并持久化 Binding，4) 返回新 Binding。所有入口
  （Feishu connector / 未来 Product API / per-Agent DSH switch 工具）最终都调用
  它；入口协议不进入核心路由规则。持久化 = 原子 JSON 单文档
  （`<home>/.dsh/bindings/bindings.json`，tmp+rename，fail-loud），无数据库 /
  event sourcing。DSH 工具 `agent_core.switch_agent` 是纯 adapter（经 demo-server
  parent-RPC 转发），不拥有持久化 / 查找 / Session 选择 / 入口分支 / 导航历史。
- 替代方案: Binding 留内存（重启丢——否决）；SQLite/Redis（本轮不需要——否决）；
  tool 侧解析 Agent/选 Session（策略必须集中 Router——否决）；Feishu/Mobile 两套
  Router（入口协议进核心规则——否决）。
- 影响: agent-router 新增 BindingStore + switchAgent/getBinding + registry 校验 +
  parent-RPC 钩子；demo-server 新增无状态 parent-RPC passthrough；新增
  `packages/agent-switch/`、`bundle-agent-switch/`、`profile-integration-agent/`；
  bundle-integration 新增 agent-registry 行与 router 配置 env 化；验收
  `scripts/product-integration-v1-verify.mjs`。

## D-005: Scheduler Replacement V1 — 最小 job 模型、持久化与执行语义

- 状态: superseded-by-D-007（Scheduler authority 已由 D-007
  SCHEDULER_OCCURRENCE_OUTCOME_V2 接管，见
  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`；此前 accepted，分支
  feat/scheduler-replacement-v1 已实现并真实验收，见
  `docs/reports/scheduler-replacement-v1.md`）
- 日期: 2026-08-15
- 背景: OpenClaw Gateway 内嵌 cron scheduler 是 141 个 enabled job（90 个
  announce 回飞书群）的唯一执行者，是关闭 OpenClaw 的最大 blocker；需要最小替代
  执行面，不复制 OpenClaw cron 系统。
- 决策: Job 模型 = 现网字段真子集（cron/at/every + announce/none/silent + opaque
  sessionKey + state 机）；持久化 = 单文件原子 JSON + runs.jsonl（无分布式栈）；
  执行语义 = OpenClaw 忠实最小复刻（at 至多一次、cron/every 循环 + backoff、
  停机补跑每 job 至多一次、invoke 前落 runningAtMs 防重复）；调用缝 = 注入式
  `invokeAgent` seam（fake/noop，Router 后续接线）；投递缝 = opaque
  `deliver` seam（无 Feishu SDK，`chat:oc_*` 不解释）；daemon 提交面 =
  `scripts/agentcore-cron.mjs`（openclaw cron add/list/runs 1:1 flag）。
- 替代方案: 完整 cron API clone——否决（现网只用了 3 个 CLI 面）；DSH
  `dsh-schedule`——否决（无 cron/at、无跨会话存储）；分布式队列——否决（无多机
  实证）。
- 影响: 新增 `packages/scheduler/`（零 DSH 依赖）+ 3 个 scripts + 3 篇文档；
  未触碰 agent-router/broker/feishu-connector/bundle/profile；迁移 =
  `openclaw-job-import.mjs --write`（97.9% importable，3 条无 agentId legacy
  job 需人工补）。
- 追加（2026-08-15 第二轮审计，VERDICT: MERGE AFTER SMALL FIX）:
  tick 单飞 + 最新态写回（FIX 1）；CLI 纯控制面、永不执行（FIX 2）；单一
  mutation authority = 跨进程锁内重读最新再应用增量（FIX 3）；persist 失败 RAM
  回滚（FIX 4）；import 已有 store 默认拒绝 + in-flight 只报告（FIX 5）。
  详见 `docs/reports/scheduler-replacement-v1.md` §11。

## D-003: Memory V1 — per-agent file-first 长期记忆（Agent Core memory glue）

- 状态: accepted（分支 feat/agent-memory-v1 已实现并真实验收，见
  `docs/reports/memory-v1.md`）
- 日期: 2026-08-15
- 背景: Session trajectory ≠ Agent long-term memory；调查收敛裁决 3 定「V1 以文件
  记忆为主」，consolidation 是唯一完全缺失层。
- 决策: 记忆 = `<workspace>/MEMORY.md`（curated 唯一事实源）+ `<workspace>/memory/
  YYYY-MM-DD.md`（episodic）；隔离 = 物理目录隔离（per-agent workspace），无全局
  库；新 session 拿记忆 = `systemPrompt.context` 同步重读注入 + `memory_*` 工具；
  consolidation 时机 = turn/end + 防抖 + 显式工具/服务；输入 = session surface 证据
  （直接用户消息 + 助手回复，seq 水位去重，输出逐条校验）；人工查看/编辑/删除 =
  直接编辑 MEMORY.md（file-first，人工优先）；fallback = 原始证据始终落 daily note。
- 替代方案: SQLite+镜像双写（mneme 式）——否决（全局库破坏隔离、双写复杂）；MCP
  记忆服务——保留为可选后端；向量/embedding——DEFER。
- 影响: 新增 `packages/agent-memory/` + `bundle-memory/` + `profile-memory/` +
  `scripts/memory-v1-verify.mjs`；未触碰 agent-router/agent-registry/agent-session。

## D-002: Agent / Session / Channel / Binding 模型与 API 契约（V1）

- 状态: proposed
- 日期: 2026-08-15
- 背景: Router、渠道适配器（feishu-connector 等）与各端 UI 需要一个渠道无关的
  统一「会话归属」契约，避免每个渠道各自发明一套语义。
- 决策: 最小实体集 = Agent / Session / ChannelConversation / Binding。Agent 是长期
  实体（固定拥有 workspace / DSH_HOME / credential / memory，V1 API 不暴露）；
  Session 属于 Agent（main 长期主会话 + normal 可新建/归档/定期清理）；Channel 只是
  UI/传输，不拥有 Agent 与 Session；「切换 Agent」= `switchAgent(ccv, agentId,
  sessionId?)` 只改 Binding，不是角色扮演；未传 sessionId 固定进入目标 Agent 的
  main；「换回来」= 客户端再次 switchAgent，V1 后端不保存切换 history/stack。
  渠道落地入口 = 幂等 `resolveChannelConversation(channel, externalId)`：一步返回
  ChannelConversation + Binding（首次创建时建立默认 Agent + main 的初始 Binding），
  飞书只有 chatId 时即可直接 dispatch。端点清单 + 错误码 + 通用约定见
  `AGENT_SESSION_CHANNEL_MODEL_V1.md`；Android 可直接 mock 的机器可读契约见
  `AGENT_SESSION_CHANNEL_MODEL_V1.api.json`。
- 替代方案: 把 Session 挂在 ChannelConversation 之下（Channel 拥有 Session）——否决：
  与「Agent 是长期实体、跨渠道延续」原则冲突；把「切换」做成角色扮演/复制 Agent——
  否决：产生状态分裂。
- 影响: 入站消息按 Binding.activeAgentId 路由到 per-agent 进程（Router #9）；渠道
  适配器只做 externalId ↔ ChannelConversation 映射 + 调 API；不实现后端。

## D-001: V1 调查收敛 — 能力结论与首个实现里程碑

- 状态: proposed
- 日期: 2026-08-14
- 背景: 五主题并行调查（identity-auth/memory/workspace-files/dashboard/always-on）
  完成，需要收敛冲突结论并确定下一步唯一 milestone（详见 `docs/CAPABILITY_MATRIX.md`
  与 `docs/README.md`）。
- 决策:
  1. 六项 BUILD 为「必须自己做」最小清单：workspace-bootstrap、跨会话 consolidation、
     控制面（= 常驻 daemon）、jobs 持久化 + cron、控制面面板、Broker 侧
     credential→principal 绑定（协作项）；
  2. 四项冲突裁决（见 CAPABILITY_MATRIX §2）：多 agent 常驻 = per-agent 进程（方案 B
     硬约束）；控制面 ≡ daemon 为同一组件；V1 记忆以文件为主、MCP 为可选后端；
     全局 jobs 面板依赖 jobs 持久化；
  3. 下一 milestone = **M1: per-agent workspace-bootstrap**（唯一自包含、纯 DSH 侧、
     不触碰 Auth/Broker 的根依赖项）。
- 替代方案: 以 identity-auth 方案 B（per-agent 进程编排）作为首个 milestone ——
  否决理由：依赖 Broker 侧协作且需部署形态变更，范围过大，不符合「先单进程稳定、
  再动编排」的 V0 既定节奏。
- 影响: M1 只新增一个 Cordis 插件与验收断言；不实现任何其余调查结论，不修改
  DSH/Auth/Broker/旧 Agent Core。

exec
/bin/zsh -lc "git diff --no-ext-diff --no-textconv --unified=3 1c3371ab..9c08ddcc -- docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md; sed -n '195,280p' RECEIPT-627-REVISION.md; rg --files /tmp/review-627 -g '"'!repo/**'"' -g '*.md' -g '*.json' -g '*.txt' | head -50" in /tmp/review-627/repo
 succeeded in 0ms:
diff --git a/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md b/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
index d1307c6a..c1e87d0b 100644
--- a/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
+++ b/docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
@@ -11,15 +11,16 @@ scope:
   - human-gate-read-and-event-consumption
   - verified-human-answer-to-authorized-owner-resolution
   - existing-owner-assistance-single-resume
-date: 2026-11-06
-revision: proposal-2
+date: 2026-11-09
+revision: proposal-3-blocker-repair
 candidate_base: f6a1f77a8b7b878bcb9821a68836925755ca7076
+authority_reference_main: a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
 governed_by:
   - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
   - AGENT_WORKSPACE_SESSION_MODEL_V3
   - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
   - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
-  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
+  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5
 external_authorities: []
 supersedes: []
 superseded_by: null
@@ -53,7 +54,10 @@ owners:
 
 ## 3. Authority and dependencies
 
-权威坐标固定为 `candidate_base` 中的本地 accepted authorities，优先级按本地治理：
+原 authoring 坐标保留为 `candidate_base`。本轮有效 WEC 权威改绑到
+`authority_reference_main` 的 accepted WEC V5（V3→V4→V5 整权后继），其余原输入
+不变；优先级按本地治理。该固定 main 快照只读核对，不表示 WEC5 已进入本分支的旧
+实施 base；后续实施仍须核对实际 base 中的 accepted 权威。文件哈希与读取方法见回执。
 
 | 本地权威 | 本协议继承的含义 |
 |---|---|
@@ -61,8 +65,8 @@ owners:
 | D-008 / `AGENT_WORKSPACE_SESSION_MODEL_V3` §14 | Agent 通知进入目标 canonical main；通知不复制 Workflow task authority |
 | Owner Workflows V2 §§1/6/8–9 | Svc owns intent/case/effect/receipt/STOP；ACK 不满足义务；Core 不 resolve case；UNKNOWN readback-only；无 Core case/phase engine |
 | WAE V3 `CTR-WAE-001b` | 原 due feed 完整 keyset sweep、无持久 cursor/queue/lease；不得以通知流代替可执行任务发现 |
-| WEC V3 `CTR-WEC1-005` | 一次稳定 `wfassist-<caseId>` Owner wake；admission ACK 与业务完成分离；只有显式 Owner 升级产生 HUMAN_REQUIRED |
-| WEC V3 `CTR-WEC1-008` | 显式授权 resolve 的精确 Svc 凭证、settled 前驱与单次 permit 消费 |
+| WEC V5 携带的 `CTR-WEC1-005` | 一次稳定 `wfassist-<caseId>` Owner wake；admission ACK 与业务完成分离；只有显式 Owner 升级产生 HUMAN_REQUIRED |
+| WEC V5 携带的 `CTR-WEC1-008`、`CTR-WEC4-010` / `ACC-WEC4-003` | 原精确 Svc 凭证、settled 前驱与单次 permit 消费；两类远端 collection 锁外执行，重获同锁后 current ledger replay、fresh 权威终检、单次 append；A 采集等待不阻塞无关 B |
 
 交办输入：[任务 #1374](https://github.com/mayf3/agent-control/issues/1374)、
 [Owner 议题 #1352](https://github.com/mayf3/agent-control/issues/1352) 和
@@ -72,8 +76,13 @@ owners:
 作者 `mayf3`，创建/更新时间 `2026-11-04T04:42:18Z`（2026-11-04 12:42:18 +08），
 正文标注“监管代记”。三点持久裁定是：通知 HUMAN_GATE 群（附实例上下文与已尝试清单）；
 仅 Owner 指定的域 owner 可代答/resolve，普通 Agent 不得代 Owner 意志；24h 无 resolve
-则升级再提醒，不自动降级或关闭实例。2026-11-06 Owner 裁定④的本次交办进一步明确
-未 resolve 处置期限及普通/managed 路径分拆；修订映射与核验方法见 `RECEIPT-627-REVISION.md`。
+则升级再提醒，不自动降级或关闭实例。2026-11-06 原任务指令④及其 Brief 本轮为
+`NOT_LOCATED`（不可读不等于不存在），不凭旧路径/哈希重建原文。2026-11-08 持久
+DISPATCH-REGISTRY 的 `$.rulings[id=owner-20261108-three-unified].items[3]` 与
+`$.rulings[id=owner-20261108-backlog-convergence].items[3]` 已本地只读核实：仅常设授权
+§7 所列新风险/新决策才最小差量 HUMAN_GATE，#1352 复用已裁定不重请。此政策语义
+重锚定不重决产品裁定；原提案的期限、路径约束与依赖边界保留，不冒充上述来源原文。
+可读摘录、持久路径、哈希、历史评论核验和局限见 `RECEIPT-627-REVISION.md`。
 
 `external_authorities: []` 表示本轮没有核得可绑定的 Svc HUMAN_GATE accepted authority
 及其 exact revision，不表示不存在跨仓依赖。Svc 持久 obligation producer/后继由 #1378
@@ -101,6 +110,10 @@ owners:
   author、created/updated time、issue URL 与正文，三项裁定均有持久记录。API 来源、
   正文 SHA-256 与核验时间见 `RECEIPT-627-REVISION.md`；这仅证明裁定记录存在，
   不证明 HUMAN_GATE 收件、Svc 计时/提醒或 resolve 接线已经实现。
+- `OBS-HG-004`：2026-11-09 在隔离 `/private/tmp/review-627/repo` 本地只读核对
+  `authority_reference_main` 的 accepted WEC5 及其携带的 CTR-WEC1-008、CTR-WEC4-010、
+  ACC-WEC4-003；同时读取上述 DISPATCH-REGISTRY 两条 ruling。方法、源文件哈希与
+  最小摘录见回执；未访问生产，未重新访问 GitHub 评论，原指令④仍为 NOT_LOCATED。
 
 ## 6. Claims and assumptions
 
@@ -125,6 +138,10 @@ relation 仅为设计推断，充分性限于 §10 逐步拒绝反例。§11 所
 DEC-HG-002/003、CTR-HG-002/003/008 的 authoring 输入，坐标为精确 comment ID、
 作者、时间和回执正文哈希。足以撤销旧“待核验”缺口，不足以证明跨仓 acceptance 或运行效果。
 
+`EVD-HG-004`：`OBS-HG-004` SUPPORTS §3 当前 WEC 权威、CTR-HG-007/ACC-HG-007 的
+锁时序与已裁定不重请的来源重锚定；坐标为固定 main SHA、registry path/selector、
+回执摘录及哈希。足以复核本次文档修复，不证明原指令④原文、并发改善或产品/运行验收。
+
 ## 8. Decisions (proposed)
 
 - `DEC-HG-001`：HUMAN_GATE 以 Svc 原 case 为唯一业务责任主体；通知和真人答复是
@@ -189,14 +206,15 @@ pending/settled 的同 request ACK 仍只证明 admission。不得换 key/Sessio
 关系及既有 CAS/receipt 条件；通知 recipient、答复人和 `resolverPrincipalId` 各自记录，
 不得混同。无权限的答复人不能借 Core、Agent credential、Owner 字段或“回复”获得授权。
 
-按本次 Owner 裁定④给定的路径事实，消费前必须分拆两类，不能把普通路径外推到 managed：
+保留原提案的路径约束（原指令④ NOT_LOCATED，来源重锚定见 §3/回执）；消费前
+必须分拆两类，不能把普通路径外推到 managed：
 
 | case 路径 | 合法推进约束 / Core 消费边界 |
 |---|---|
 | 普通 Assistance case（非 opted-in managed） | 既有 `owner_action` 支持 `HUMAN_REQUIRED→RESOLVED`；仍需指定域 owner 的真实 caller、显式授权、当前状态/CAS 与实际 receipt/readback。只有该合法 resolve 凭证及 WEC008 全部证明成立时，Core 才可消费一次 resume |
 | opted-in managed case | 必须走 `require_effect`，关联真实 `STARTED` 的 `REVIEW` effect，遵守既有 managed admission/receipt/STOP guard。在现有可达路径下，直接 Owner resolve 被 managed guard 拦截，不能因“有权 Owner”而绕过。HUMAN_REQUIRED 后的 managed 合法后继由 Svc 的 #1378/#1352 责任线闭合；本 Core 合同只描述消费面，不创建或承诺该后继已可达 |
 
-以上路径约束是本次交办输入，不构成 Svc 实现/运行验收。Core 不代行 resolve，不从
+以上路径约束保留为提案消费边界，不作为已核得原指令④原文或 Svc 实现/运行验收。Core 不代行 resolve，不从
 通知/答复构造 resolved Event，也不新增 HUMAN_REQUIRED 旁路。实际路径若不允许该
 状态或所需输入，则维持待处置并报告 UNKNOWN/缺权威，交 Svc 所属 accepted authority
 闭合；不得通过放宽现有 managed guard 解决。只有已提交、可读回的合法 resolve
@@ -261,11 +279,27 @@ known delivery 且 fresh Router reconciliation 正面证明 `settled`。pending/
 unavailable/ambiguous（包括 `run_outcome_unknown`）均拒绝；stale-path quiescence
 替代证据不能用于这里。原 attempt 自身落盘的 `preDeliveryWorkflowStateVersion` 不得后补。
 
-Core 持既有 admission lock，fresh pre-plan read 验证同一 ACTIVE dispatch/instance/visit/
-assignee；要求 `baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`，
-且证据版本等于新计划 fresh pre-plan version。一次 locked durable `attempt_planned`
-同时产生 N+1 并消费 permit，落盘新 baseline、相同 identity、`previousAttemptId`、
-`retryReason:owner_assistance_resolved` 及原样 `assistanceResume`。不增第二份消费账本。
+沿 WEC5 携带的 CTR-WEC4-010：先在既有 admission lock 内 replay ledger，捕获 detached
+context（精确 tuple、前驱/不存在、generation、state/phase、baseline、settled proof、
+eligibility、budget、已消费 case/Event 及 replay 坐标），不占用 generation 或消费 permit。
+释放锁，在锁外完成两类远端 collection：fresh pre-plan read 与 Owner-resume evidence
+read；响应须绑定原 tuple、前驱、baseline、Svc version 与 Event sequence。A 等待任一
+采集时，无关 eligible B 必须能取得锁完成正常 admission。
+
+随后重获同一 admission lock → replay CURRENT durable ledger → 比较全部相关本地前置
+条件 → 在该锁内 commit-preparation 坐标取得 fresh trusted 权威终检 → 单次 append。
+终检须正面确认当前同一 ACTIVE dispatch、非终态 instance、current visit、assignee 及
+workflow-state version 均等于锁外结果；仅 local revision、结果 TTL 或两份旧 read 相同
+不足，不能以在锁内重跑整套 collection 替代。无关 ledger append 保留；相关前驱、预算、
+eligibility、permit consumption 或外部身份/版本变化、缺失/不可验证均丢弃旧结果，本轮
+零 plan、零 permit consumption、零 delivery；沿原 refusal/正常 sweep，不改 refusal code
+或重试政策、不把旧结果换 baseline/前驱再用。
+
+仍要求 `baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`，
+证据版本等于锁外 fresh pre-plan version 并经终检确认相等。全部通过才一次 locked durable
+`attempt_planned` 同时产生 N+1 并消费 permit，落盘该 pre-plan version 为新 baseline、
+相同 identity、`previousAttemptId`、`retryReason:owner_assistance_resolved` 及原样
+`assistanceResume`。不增第二份消费账本，其余 resolution/WAL/delivery 的原锁纪律不变。
 
 一个 resolve 最多授权一次 next generation，非“每收到一次消息执行一次”。case/Event pair/
 due row/restart 重放均不可再次 mint；多个旧 case 不能连续推动后续 generation。generation
@@ -336,7 +370,7 @@ receipt/readback 证据前，完整 P1-A 仍不得宣称 `SOURCE_VERIFIED` 或
 | ACC-HG-004 / CTR-HG-004 | 普通 case 走 owner_action HUMAN_REQUIRED→RESOLVED；对比 opted-in managed 直接 Owner resolve、缺/伪 STARTED REVIEW effect；另测撤权/换 Owner/非法状态/CAS drift | 隔离真实 Svc 命令/DB 与 managed effect fixture | 路径分类、真实 caller/Domain 检查、guard 拒绝、require_effect 与真实 STARTED REVIEW effect、命令 receipt/Event、前后 readback | 普通合法 resolve 产生实际关联 receipt；managed 直接 resolve 被现有 guard 拦，合法后继只能按 Svc accepted 合同验证，缺失则 UNKNOWN/零推进 | 外推普通路径、Core 自 resolve、借 credential、放宽 managed guard、伪 effect、无 receipt 成功 |
 | ACC-HG-005 / CTR-HG-005 | 校验封闭投影，缺字段/乱序/重复/丢事件后重读；>100 due rows 首100已 attempted | 隔离 Svc 只读/事件面 + Core sweep | exact DTO/schema、授权范围、恢复后责任、cursor 原值及101+发现记录 | 缺证据拒绝；事件非唯一正确性路径；原 WAE sweep 保持 | 自签投影、跨域枚举、漏责任、页上限/持久 case cursor、修改 due DTO |
 | ACC-HG-006 / CTR-HG-006 | 对比 resolution link 与原 WEC008 DTO；普通/policy ingress、错 resolver/version/case | 隔离真实 Svc evidence seam | 原 receipt/Event join、exact request/response、身份/版本值 | 仅既有两种 ingress、原 DTO、精确关联被接受 | 第三种 human ingress、混淆 assignee/Owner、缺/假证明授权 |
-| ACC-HG-007 / CTR-HG-007 | settled 正例与 UNKNOWN/pending/legacy baseline/换 tuple/STOP 反例；并发/重复/replay/旧cases | 隔离实际 Core engine/ledger + Svc | fresh Router settled、lock 内 reads、sequence、原 planned append、delivery count | 一个 resolve 最多一个 N+1；原 budget/STOP 保持 | 双消费、新 permit store、补 baseline、UNKNOWN resume、自动续跑 |
+| ACC-HG-007 / CTR-HG-007 | settled 正例与 UNKNOWN/pending/legacy baseline/换 tuple/STOP 反例；分别 barrier 暂停 A 的远端 pre-plan/evidence collection，令无关 B admission；真实独立双 writer 共享 ledger；采集后注入相关本地/外部 drift；并发/重复/replay/旧 cases | 隔离实际 Core engine/ledger/OwnerLock + Svc，按 WEC5 携带的 ACC-WEC4-003 | 两次 collection 锁外 barrier、同锁获取/释放、current replay、fresh 权威终检及 sequence/version 等值、全部 durable lines、delivery count、等待耗时含终检、implementation SHA | 两个 interval 中 B 均在解除 A barrier 前完成；A 仅在终检通过后单次 append；一个 resolve 最多一个 N+1；原 budget/STOP 与全部 writer append 保持，相关 drift 零 plan/消费/delivery | B 被 A collection 阻塞、锁内重跑整套采集、漏报终检等待、无权威等值终检、丢 append、双消费、新 permit store、补/换 baseline、UNKNOWN resume、自动续跑 |
 | ACC-HG-008 / CTR-HG-008 | 第 1 小时回复且验证成功但未 resolve，推进至原 24h；到期前后 Core/Svc 重启、丢事件/通知失败后恢复重发现；晚到/response loss；crash before/after plan、before/after delivery_started | 隔离 paired fixture；可控时钟/故障与 Svc 现有责任/通知机制 | 原 escalationAt/resolutionDueAt、1h 验证记录、24h 未 resolve readback、持久升级提醒及发送/失败结果、恢复重发现、原 receipt、exact correlation、ledger replay/投递计数 | 回复/ACK/验证不取消责任；未 resolve 到期持久升级再提醒，重启/通知失败不丢责任不改期限；到期不授权；UNKNOWN readback-only；仅 WEC008 正面 never_existed 可同 attempt 恢复 | 仅 OVERDUE/日志/易失提醒、回复即取消责任、deadline 重置、失败假送达或丢责任、自动 resolve、未知换 key/重放、STOP 被消息清除 |
 
 ## 12. Alternatives and disposition
两个完整 `items[3]` 的 canonical SHA-256（UTF-8，
`json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，包括 JSON 字符串引号）
依表中顺序为：
`bc504d55a11b3581377a0fc188c704ac1f0b7e4b88465646904e9b4347dc1cb9`、
`78eb96d162b9845470a4c575d1e5aec911cb9aa7fcbe6368d7414789ef59ccbd`。

据此修正回执旧归因及提案 §3/CTR-HG-004：普通/managed 路径、24h 未 resolve 期限、
§13A 依赖边界保留为原提案内容；不声称两条 registry 或三点评论包含这些细节，
不追认不可读原④，也未重新审计 Svc 源码/DB。政策语义重锚定与具体路径的证明范围
分开，不增加执行权限，不解除原 UNKNOWN/STOP。

### 当前文档校验与独立 delta 复核

修复 Spec SHA-256：
`e19b8f3ec51d9bb3b6b92dcf3c8bce22b355ba36bf32472bb035a8c51fc6f37e`。

实际文档检查全部 rc=0：

- `jsonschema.Draft202012Validator` 按仓内 frontmatter schema 校验；
  `validate_transition([parent_proposal], [repaired_proposal])` 验证 proposed→proposed。
- 8 个稳定 CTR-HG ID 与 8 个 ACC-HG 对应；原 DTO、CTR-HG-001/002/003/005/006/008
  bytes 不变，CTR-HG-007 前驱资格及后半 permit/replay/budget/STOP 段不变，
  §13 起的迁移/依赖/authoring 边界不变；CTR-HG-004 仅修来源归因。
- WEC5 accepted 状态、固定 main/文件哈希、registry 文件及两个完整 item canonical
  hashes、selector 与回执绑定均实核；原 Brief 本 checkout 未找到。
- `python3 .agents/tools/verify_governance.py --target .`：vendored bytes 匹配 lock；
  `git diff --check` 与允许路径检查通过，只有本提案与回执两文件。

非作者 `/root/source_review` 独立 DELTA 复核：**PASS**，`FROZEN_BLOCKER_UNION=[]`。
绑定 repair parent、authority main、上述 Spec SHA-256，以及写回检查结果前的回执
SHA-256 `e6d6e5a028add4e66d3dd98946520a22fb3b9b189b2a88ad0e8061c27edeafcd`。
独立复读 registry/hashes、对比 DTO/恢复/permit 边界并核对两段 collection 时序及验收，
确认 B1/B2 闭合且无新增 blocker；写回结果后仅作 receipt-only/final-head delta recheck。
本结论仅为提案修复审查推荐，仍待 Owner 对精确 head 接受；产品/运行/paired fixture
验收均 NOT_RUN，未测并发性能或业务结果。
/tmp/review-627/FIX-BRIEF.md
/tmp/review-627/repo/RECEIPT-EKR-B1B4.md
/tmp/review-627/repo/BRIEF-EKR-PRE-R3.md
/tmp/review-627/repo/RECEIPT-MERGE-R2.md
/tmp/review-627/repo/RECEIPT-XATTRFIX-R3.md
/tmp/review-627/repo/vendor/proxy-agent-negotiate/package.json
/tmp/review-627/repo/bundle-demo/package.json
/tmp/review-627/repo/STOPPED-EKR-B3.md
/tmp/review-627/repo/RECEIPT-SETTLE.md
/tmp/review-627/repo/deployment-artifacts/b7-e32-pre-tx-closure-v1/PINS.json
/tmp/review-627/repo/deployment-artifacts/b7-e32-pre-tx-closure-v1/README.md
/tmp/review-627/repo/deployment-artifacts/b7-e32-pre-tx-closure-v1/SOURCE-MANIFEST.json
/tmp/review-627/repo/deployment-artifacts/product-434-hr-runtime-retirement-v1/README.md
/tmp/review-627/repo/deployment-artifacts/product-434-hr-runtime-retirement-v1/RUNBOOK.md
/tmp/review-627/repo/deployment-artifacts/b7-e31-partial-stage-closure-v1/PINS.json
/tmp/review-627/repo/deployment-artifacts/b7-e31-partial-stage-closure-v1/README.md
/tmp/review-627/repo/deployment-artifacts/b7-e31-partial-stage-closure-v1/SOURCE-MANIFEST.json
/tmp/review-627/repo/deployment-artifacts/hr-s256-trusted-cut-v1/README.md
/tmp/review-627/repo/deployment-artifacts/hr-s256-trusted-cut-v1/SOURCE-CLOSURE-COUNTEREXAMPLE.md
/tmp/review-627/repo/deployment-artifacts/hr-s256-trusted-cut-v1/SOURCE-CLOSURE-DISPOSITION.md
/tmp/review-627/repo/deployment-artifacts/c11r3-restart-safe-v1/README.md
/tmp/review-627/repo/deployment-artifacts/c11r3-restart-safe-v1/RUNBOOK.md
/tmp/review-627/repo/deployment-artifacts/workflow-dispatch-recovery-v1/DISPATCH_PAYLOAD_V1.md
/tmp/review-627/repo/deployment-artifacts/c11r1-late-outcome-selfheal-v1/README.md
/tmp/review-627/repo/deployment-artifacts/c11r1-late-outcome-selfheal-v1/RUNBOOK.md
/tmp/review-627/repo/deployment-artifacts/wda-structural-diagnostics-v1/SHA256SUMS.txt
/tmp/review-627/repo/deployment-artifacts/wda-structural-diagnostics-v1/PACKET.md
/tmp/review-627/repo/deployment-artifacts/w0-deploy-disk-budget-v1/README.md
/tmp/review-627/repo/deployment-artifacts/w0-deploy-disk-budget-v1/RUNBOOK.md
/tmp/review-627/repo/deployment-artifacts/b7-e33-presealed-recovery-v1/PINS.json
/tmp/review-627/repo/deployment-artifacts/b7-e33-presealed-recovery-v1/README.md
/tmp/review-627/repo/deployment-artifacts/b7-e33-presealed-recovery-v1/SOURCE-MANIFEST.json
/tmp/review-627/repo/deployment-artifacts/scheduler-control-plane-reliability-v1/desired-state.example.json
/tmp/review-627/repo/deployment-artifacts/scheduler-control-plane-reliability-v1/README.md
/tmp/review-627/repo/deployment-artifacts/scheduler-control-plane-reliability-v1/RUNBOOK.md
/tmp/review-627/repo/deployment-artifacts/original-router-proof-executor/DEVELOPMENT_PREFLIGHT.md
/tmp/review-627/repo/STOPPED-XATTRFIX-R3.md
/tmp/review-627/repo/RECEIPT-EKR-B3-R2.md
/tmp/review-627/repo/STOPPED-XATTRFIX-R2.md
/tmp/review-627/repo/profile-memory/package.json
/tmp/review-627/repo/AGENTS.md
/tmp/review-627/repo/bundle-broker/package.json
/tmp/review-627/repo/BRIEF-EKR-PRE-R2.md
/tmp/review-627/repo/RECEIPT-MERGE.md
/tmp/review-627/repo/RECEIPT-XATTRFIX-R2.md
/tmp/review-627/repo/bundle-memory/package.json
/tmp/review-627/repo/RECEIPT-XATTRFIX.md
/tmp/review-627/repo/BRIEF-523-R2.md
/tmp/review-627/repo/RECEIPT-627-REVISION.md
/tmp/review-627/repo/RECEIPT-EKR-B3.md

exec
/bin/zsh -lc "git show a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md | sed -n '653,699p'; git show a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md | sed -n '759,815p'; git show a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md | sed -n '953,968p'" in /tmp/review-627/repo
 succeeded in 0ms:
Before appending `attempt_planned` for EVERY new attempt (generation 1,
stale re-entry, and Owner-resume), Core MUST perform a fresh pre-plan read of
the exact current activation/visit/assignee and workflow state version. Core
MUST release the existing ledger admission lock for this remote pre-plan
read, then reacquire that lock and exactly revalidate the bound local and
authoritative external preconditions under CTR-WEC4-010 before any append.
Changed, unavailable or ambiguous preconditions reject the old unlocked
result through the existing zero-mint/zero-delivery refusal path. It durably records that version
as `preDeliveryWorkflowStateVersion` in the same planned append, before any
Router delivery invocation. Failed or mismatching reads mint and deliver
nothing. This is distinct from post-delivery
`workflowStateVersionAtDispatch` and MUST NOT be reconstructed from a later
read. Legacy events without the new field remain readable but cannot be the
predecessor of an Owner-resume.

Core consumes the read-only svc companion below; it adds no Core product-api
endpoint and does not widen the existing seven-field due DTO.

```text
GET /internal/v1/dispatch-intents/{dispatchIntentId}/owner-assistance-resume-evidence
query: previousAttemptId=<opaque attempt ID string>&preDeliveryWorkflowStateVersion=<integer>
scope: workflow.read + direct token + enabled GLOBAL_SCHEDULER_READ binding
200 {"evidence": null | {
  "dispatchIntentId": UUID, "workflowInstanceId": UUID, "nodeVisitId": UUID,
  "ownerPrincipalId": UUID, "activationState": "ACTIVE", "workflowStateVersion": integer,
  "assistanceCaseId": UUID, "requestEventSequence": integer,
  "resolutionEventSequence": integer, "requesterPrincipalId": UUID,
  "resolverPrincipalId": UUID, "ingress": "assignee" | "execution_policy",
  "reason": null | "ATTEMPTS_EXHAUSTED" | "STALE_LOOP_EXHAUSTED",
  "lastAttemptId": null | opaque attempt ID string
}}
```

The request and response are closed shapes. `dispatchIntentId` is the exact
path UUID; `previousAttemptId` is the non-empty opaque Core attempt ID
(currently `wfeat-*`), not a UUID. Versions and sequences are integers on the
svc workflow-state-version scale. `reason` and `lastAttemptId` are present
and null for `ingress: assignee`; for `execution_policy` both are non-null,
the reason is one of the two enumerated policy reasons, and `lastAttemptId`
is the persisted policy value, never an echo of the query parameter.

Svc's exact provenance and selection obligations are CTR-SWEC-010. Core
requests evidence with the latest attempt's own ID and durable pre-delivery
baseline, releasing the existing admission lock for this remote evidence
read, then reacquiring it and exactly revalidating the bound preconditions
under CTR-WEC4-010. Changed, unavailable or ambiguous preconditions reject
the old unlocked result through the existing zero-mint/zero-delivery refusal

For the two collection reads named in §2 only, Core MUST follow this order:

1. Under the existing admission lock, replay the durable ledger and capture a
   detached validation context: exact dispatch/instance/visit/assignee identity;
   current predecessor attempt ID or explicit absence, generation, phase/state,
   judgment, pre-delivery baseline and known delivery/reconciliation facts;
   relevant consumed assistance case/event identities, budget and eligibility
   inputs; and the replay/revision coordinates that make those facts comparable.
   This capture mints no attempt, consumes no permit and reserves no generation.
2. Release that lock for the remote pre-plan and, when applicable, evidence
   reads. Bind responses to the exact request/identity, predecessor, baseline,
   service workflow version and assistance event sequence coordinates used.
   Failed/restricted/malformed/ambiguous reads provide no permission. The two
   responses MUST satisfy every inherited identity/provenance/sequence rule.
3. Reacquire the SAME existing admission lock and replay the CURRENT durable
   ledger before evaluating a candidate append. Compare all relevant captured
   local preconditions, including predecessor absence/identity/generation,
   state/phase, eligibility, budget, reconciliation proof and permit consumption.
   Unrelated ledger appends need not reject a candidate when replay proves every
   relevant precondition unchanged; they MUST NOT be lost or overwritten.
4. At this locked commit-preparation validation coordinate, obtain fresh trusted
   authoritative validation of the exact current ACTIVE dispatch, nonterminal
   instance, current visit, assignee and workflow-state version. They MUST equal
   the identity/version bound to the unlocked results. Existing authorized
   canonical read surfaces MAY supply this necessary lock-held validation;
   no new Svc protocol is implied. Matching local revision, attempt/generation,
   result age/TTL or agreement between the two earlier remote reads alone is
   insufficient. Missing or unverifiable external equality MUST reject the
   unlocked results even when the local ledger is unchanged.
5. Only with all checks true, perform the existing single locked durable
   `attempt_planned` append. Its baseline is the observed pre-plan version,
   verified equal at step 4, never replaced by a newer version. The inherited
   permit-consumption reducer, fresh resolution, WAL, delivery and completion
   sequence remain inside their original lock discipline without alteration.

Any changed, unavailable, conflicting or ambiguous required precondition MUST
cause the old unlocked results to be discarded for this planning pass, with
zero new plan, zero permit consumption and zero delivery from those results.
Use the existing non-created refusal behavior: pre-plan failure is
`pre_plan_unavailable`; an already changed/occupied predecessor is
`already_attempted`; unavailable Owner proof remains rejected under the existing
Owner-proof path. This proposal adds no new refusal code or retry policy.
A later ordinary existing sweep may recollect new facts under its existing
eligibility rules; it MUST NOT rebase, repair or relabel the rejected result,
reuse its authorization for a new predecessor, or bypass any existing fence.

Concurrent Core writers MUST still serialize every durable mutation through the
same single-writer/fresh-replay discipline. While A waits for either unlocked
read, unrelated eligible B can acquire the lock and complete its normal admission.
If B/C instead changes A's relevant predecessor, generation, eligibility or
permit-consumption facts, A MUST reject its old result after replay. Two writers
competing for the same visit/case can mint at most one authorized generation and
consume that case at most once; the loser uses the existing refusal. No lockless
ledger write, second consumption store, dropped append or duplicated delivery
is permitted. Existing timeout, crash, replay and UNKNOWN boundaries remain.

### ACC-WEC4-003 — Both unlocked intervals permit unrelated writer progress

- Contracts: `CTR-WEC1-008`, `CTR-WEC4-010`.
- Method: independently barrier-pause A first in the real remote pre-plan read
  and then in Owner evidence; in each case run unrelated eligible B through the
  existing admission seam. Repeat with real separate writers sharing the ledger.
- Environment: isolated actual ledger/OwnerLock and controlled service responses;
  no production writes.
- Required evidence: interval barriers, acquisition/release and replay coordinates,
  B completion before releasing A's remote barrier, resulting durable lines,
  wait timings including final validation, delivery counts, implementation SHA.
- Expected result: B completes during each A collection wait; A can continue only
  after its exact locked checks pass; every writer's committed facts survive.
- Failure condition: B waits for A's paused collection, lockless writes, whole
  collection repeated under lock disguised as removal, lost append, duplicate
  generation/delivery, or unreported final-validation wait.

exec
/bin/zsh -lc 'cat /tmp/review-627/FIX-BRIEF.md; git log --oneline --no-decorate 1c3371ab..9c08ddcc; git rev-parse 1c3371ab origin/main; git diff --no-ext-diff --no-textconv --check 1c3371ab..9c08ddcc; git status --porcelain=v1' in /tmp/review-627/repo
 succeeded in 0ms:
# 修复任务 — PR #627 两 blocker（原责任链自修，per 独立审查 2026-11-09）

仓库：/tmp/review-627/repo（HEAD 1c3371ab，分支 ac-ekr-p1a-spec）。修复后单 commit 推同分支（push 失败→bundle 交接，不重试）。零生产访问。

## B1 HG-WEC5-LOCK-TIMING（CONTRACT_VIOLATION）

审查反例：候选 L264、L339 要求持 admission 锁等待 A 的远端读取，违反 main 已接受 WEC5 L653–699（两类远端 collection 锁外执行）与 CTR-WEC4-010/ACC-WEC4-003（无关 B 不得被 A 的远端等待阻塞）。

最小闭合（审查者给定）：更新有效权威引用为 WEC5；重写该两处为——**锁外采集 → 重获锁 → current ledger replay → fresh 权威终检 → 单次 append**；保留原 DTO、baseline、permit 与恢复边界不变；同步调整 ACC-HG-007。

## B2 HG-RULING4-SOURCE（REQUIRED_GATE_FAILURE）

审查事实：修订回执 L35-42 将裁定④归于未提交的 BRIEF-627-REVISION.md（仅哈希、路径不存在）——原交办不可核。

最小闭合（审查者给定）：补可读持久坐标或可追溯独立来源回执，**不重复产品裁定、不虚构原文**。可用持久坐标：
- DISPATCH-REGISTRY `$.rulings[id=owner-20261108-three-unified]` items[3]（HUMAN_GATE 政策语义：仅 §7 所列新风险/新决策才最小差量 HUMAN_GATE）
- DISPATCH-REGISTRY `$.rulings[id=owner-20261108-backlog-convergence]` items[3]（"#1352复用已裁定不重请"）
- agent-control issue #1352 评论 6622750077（审查者已独立核实作者/时间/三项裁定/正文哈希）
- 2026-11-06 原任务指令④：如实标 NOT_LOCATED（不可读≠不存在；由上列持久语义重锚定，不改裁定实质）

## 完成定义

修复 commit（消息注明两 blocker ID）→ push origin ac-ekr-p1a-spec → 输出 commit SHA 与 DONE/STOPPED。改动仅限：提案 spec 文件 + 修订回执 + （如需）验收定义；其他不动。
9c08ddcc docs: fix HG-WEC5-LOCK-TIMING and HG-RULING4-SOURCE
1c3371abe36bcda08da27eb901e86dd95af949bc
a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b

exec
/bin/zsh -lc "GIT_OPTIONAL_LOCKS=0 PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
import subprocess,re,hashlib,json,difflib
base='1c3371abe36bcda08da27eb901e86dd95af949bc'
head='9c08ddcc792641414a3dd7bbeea10912c6d4fb66'
p='docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md'
def git(*a):return subprocess.check_output(['git',*a])
a=git('show',f'{base}:{p}').decode();b=git('show',f'{head}:{p}').decode()
def section(t,heading,level):
 m=re.search(r'"'^'"'+re.escape(heading)+r'.*\\n',t,re.M)
 if not m:raise ValueError(heading)
 n=re.search(r'"'^#{1,'"'+str(level)+r'} ',t[m.end():],re.M)
 return t[m.start():m.end()+n.start()] if n else t[m.start():]
checks={}
checks['allowed_paths_only']=set(git('diff','--name-only',base,head).decode().splitlines())=={p,'RECEIPT-627-REVISION.md'}
for i in (1,2,3,5,6,8):
 h=f'### CTR-HG-{i:03d}'
 checks[h+' unchanged']=section(a,h,3)==section(b,h,3)
for h in ('## 1.','## 2.','## 4.','## 6.','## 8.','## 10.','## 12.','## 13.'):
 checks[h+' unchanged']=section(a,h,2)==section(b,h,2)
checks['from section12 to eof unchanged']=a[a.index('## 12.'):]==b[b.index('## 12.'):]
checks['CTR7 prefix unchanged']=section(a,'### CTR-HG-007',3).split('Core 持既有 admission lock')[0]==section(b,'### CTR-HG-007',3).split('沿 WEC5 携带的 CTR-WEC4-010')[0]
checks['CTR7 permit/replay/budget/STOP tail unchanged']=section(a,'### CTR-HG-007',3).split('一个 resolve 最多授权一次 next generation',1)[1]==section(b,'### CTR-HG-007',3).split('一个 resolve 最多授权一次 next generation',1)[1]
for i in (1,2,3,4,5,6,8):
 row=lambda t:next(x for x in t.splitlines() if x.startswith(f'| ACC-HG-{i:03d} /'))
 checks[f'ACC-HG-{i:03d} row unchanged']=row(a)==row(b)
print(json.dumps(checks,ensure_ascii=False,indent=2))
print('ALL_CHECKS_PASS',all(checks.values()))
print('BASE_SPEC_SHA256',hashlib.sha256(a.encode()).hexdigest())
print('HEAD_SPEC_SHA256',hashlib.sha256(b.encode()).hexdigest())
print('HEAD_RECEIPT_SHA256',hashlib.sha256(git('show',head+':RECEIPT-627-REVISION.md')).hexdigest())
print('WORKTREE_MATCHES_HEAD',open(p,'rb').read()==b.encode())
for group in difflib.SequenceMatcher(None,a.splitlines(),b.splitlines(),autojunk=False).get_grouped_opcodes(0):
 for op,i,j,k,l in group:
  if op"'!='"'equal': print('SPEC_DELTA',op,'base',f'{i+1}-{j}','head',f'{k+1}-{l}')
PY" in /tmp/review-627/repo
 succeeded in 0ms:
{
  "allowed_paths_only": true,
  "### CTR-HG-001 unchanged": true,
  "### CTR-HG-002 unchanged": true,
  "### CTR-HG-003 unchanged": true,
  "### CTR-HG-005 unchanged": true,
  "### CTR-HG-006 unchanged": true,
  "### CTR-HG-008 unchanged": true,
  "## 1. unchanged": true,
  "## 2. unchanged": true,
  "## 4. unchanged": true,
  "## 6. unchanged": true,
  "## 8. unchanged": true,
  "## 10. unchanged": true,
  "## 12. unchanged": true,
  "## 13. unchanged": true,
  "from section12 to eof unchanged": true,
  "CTR7 prefix unchanged": true,
  "CTR7 permit/replay/budget/STOP tail unchanged": true,
  "ACC-HG-001 row unchanged": true,
  "ACC-HG-002 row unchanged": true,
  "ACC-HG-003 row unchanged": true,
  "ACC-HG-004 row unchanged": true,
  "ACC-HG-005 row unchanged": true,
  "ACC-HG-006 row unchanged": true,
  "ACC-HG-008 row unchanged": true
}
ALL_CHECKS_PASS True
BASE_SPEC_SHA256 dff7a653b918adfc442d7f9f49b8346675e02f44154cab1d4b9cf7c298681896
HEAD_SPEC_SHA256 e19b8f3ec51d9bb3b6b92dcf3c8bce22b355ba36bf32472bb035a8c51fc6f37e
HEAD_RECEIPT_SHA256 311915229598da5fe5650f3d8281fc9de56d97dfd76bfe0c924cba77498de17a
WORKTREE_MATCHES_HEAD True
SPEC_DELTA replace base 14-15 head 14-15
SPEC_DELTA insert base 17-16 head 17-17
SPEC_DELTA replace base 22-22 head 23-23
SPEC_DELTA replace base 56-56 head 57-60
SPEC_DELTA replace base 64-65 head 68-69
SPEC_DELTA replace base 75-76 head 79-85
SPEC_DELTA insert base 104-103 head 113-116
SPEC_DELTA insert base 127-126 head 140-143
SPEC_DELTA replace base 192-192 head 209-210
SPEC_DELTA replace base 199-199 head 217-217
SPEC_DELTA replace base 264-268 head 282-302
SPEC_DELTA replace base 339-339 head 373-373

codex
两条 registry 的摘录及哈希均与回执一致，其余 CTR、DTO、预算/STOP、恢复和依赖边界逐字未变。锁时序也与 WEC5 一致：两类 collection 在锁外，必要的 fresh 终检仍可按权威在锁内执行。
apply patch
patch: completed
/tmp/review-627/INCREMENTAL-REVIEW-9c08ddcc.md
diff --git a/INCREMENTAL-REVIEW-9c08ddcc.md b/INCREMENTAL-REVIEW-9c08ddcc.md
new file mode 100644
index 0000000000000000000000000000000000000000..9330261afc3e2dfedb9b7112845ad71d5719eea9
--- /dev/null
+++ b/INCREMENTAL-REVIEW-9c08ddcc.md
@@ -0,0 +1,67 @@
+# PR #627 bounded incremental re-review
+
+Date: 2026-11-09 (Asia/Shanghai)
+
+```text
+REPOSITORY = mayf3/dsh-agent-core
+WORKTREE = /private/tmp/review-627/repo
+SPEC_GOVERNANCE_MODE = REVIEW
+REVIEW_KIND = SPEC
+REVIEW_SCOPE = DELTA
+REVIEW_TARGET_HEAD = 9c08ddcc792641414a3dd7bbeea10912c6d4fb66
+BASE_HEAD = 1c3371abe36bcda08da27eb901e86dd95af949bc
+AUTHORITY_REFERENCE_MAIN = a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
+CURRENT_BASE_HEAD = a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b (local origin/main snapshot only)
+REVIEWER_ID = /root
+ADDITIONAL_REVIEWERS = /root/b1_lock_delta, /root/b2_source_delta
+AUTHOR_INDEPENDENCE = PASS
+SPEC_REVIEW = ACCEPT (bounded review recommendation only)
+AUTHORITY_REVIEW = PASS
+PRIMITIVE_BOUNDARY_REVIEW = PASS
+CONTRACT_REVIEW = PASS
+ACCEPTANCE_COVERAGE_REVIEW = PASS (definitions only)
+MANDATE_SCOPE_REVIEW = PASS
+EVIDENCE_REVIEWABILITY = PASS
+BASE_IMPACT = BOUNDED
+BLOCKERS = 0
+SPEC_GAPS = 0 (within this delta review)
+FOLLOW_UPS = 0
+TOOLING_DEBT = 0
+IMPLEMENTATION_ALLOWED = NO
+MERGE_READY = NO (proposal still requires exact-head acceptance)
+OPERATION_ALLOWED = NO
+NEXT_ACTION = STOP
+FROZEN_BLOCKER_UNION=[]
+```
+
+Scope reason: recheck only the two frozen blocker repairs and dependencies invalidated by those repairs. No full review or runtime acceptance was performed. Repository files were read only; this review record is written outside the repository under /tmp.
+
+## B1 HG-WEC5-LOCK-TIMING — PASS
+
+Candidate `docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md:282-302` now requires locked detached capture, both remote collections outside the admission lock, reacquisition of the same lock, CURRENT durable ledger replay, fresh trusted authoritative equality validation, and one durable planned append. Drift, missing or unverifiable proof produces zero plan/permit consumption/delivery. `ACC-HG-007` at line 373 synchronizes the two barrier intervals, unrelated B progress, independent writers, append preservation, and final-validation timing requirements.
+
+Compared directly with fixed accepted WEC5 lines 653-699, CTR-WEC4-010 lines 759-815, and ACC-WEC4-003 lines 953-968. No remaining requirement to hold the lock during either whole collection read was found. Necessary fresh final authoritative validation may still use lock-held canonical reads under WEC5; PASS does not claim that all remote I/O or final-validation waiting is outside the lock.
+
+## B2 HG-RULING4-SOURCE — PASS
+
+Candidate Spec lines 79-85 and 209-217, and revision receipt lines 179-204, re-anchor policy to the persistent registry selectors `$.rulings[id=owner-20261108-three-unified].items[3]` and `$.rulings[id=owner-20261108-backlog-convergence].items[3]`, plus the explicitly reused historical independent verification of agent-control #1352 comment 6622750077. The registry was read directly; both ruling IDs are unique, excerpts are accurate, and the recorded hashes match.
+
+Registry path: `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`.
+
+- File SHA-256: `6afd34a5b035113a919737dee4afa0ef777169c4e9c2bbb4041308a39774f2ea`.
+- three-unified item canonical SHA-256: `bc504d55a11b3581377a0fc188c704ac1f0b7e4b88465646904e9b4347dc1cb9`.
+- backlog-convergence item canonical SHA-256: `78eb96d162b9845470a4c575d1e5aec911cb9aa7fcbe6368d7414789ef59ccbd`.
+
+The original 2026-11-06 instruction ④ and Brief remain `NOT_LOCATED`; their historical hashes are not presented as readable source. The prior deadline, ordinary/managed path, and dependency constraints are retained as proposal boundaries and are not falsely attributed as verbatim contents of the registry or three-point comment. The GitHub comment was not requested again during this incremental review.
+
+## Diff containment and exact-head checks
+
+`1c3371ab..9c08ddcc` is one commit, changing exactly the proposed Spec and `RECEIPT-627-REVISION.md` (170 insertions, 25 deletions). Spec changes are confined to revision/authority coordinates, source attribution and associated Observation/Evidence, CTR-HG-007 lock timing, and ACC-HG-007. CTR-HG-004 changes only its source attribution.
+
+Direct byte comparisons passed for CTR-HG-001/002/003/005/006/008, every ACC row except ACC-HG-007, Decisions, counterexamples, and all content from section 12 through EOF (including section 13A). CTR-HG-007's predecessor qualification prefix and permit/replay/budget/STOP tail are unchanged. Its DTO remains unchanged. No accepted authority, implementation, or test file changed. `git diff --check 1c3371ab..9c08ddcc` passed, and the working tree is clean.
+
+- Candidate Spec SHA-256: `e19b8f3ec51d9bb3b6b92dcf3c8bce22b355ba36bf32472bb035a8c51fc6f37e`.
+- Candidate revision receipt SHA-256: `311915229598da5fe5650f3d8281fc9de56d97dfd76bfe0c924cba77498de17a`.
+- Fixed WEC5 SHA-256: `e2160a5eff748d03daa199b08517bb89e1efaa64008020e27d0344385adf331a`.
+
+Product/paired-fixture/concurrency tests remain `NOT_RUN`; performance remains `UNMEASURED`. This result closes the two document-review blockers only and does not claim implementation, acceptance, production readiness, or business outcome.

exec
/bin/zsh -lc 'GIT_OPTIONAL_LOCKS=0 git status --porcelain=v1; GIT_OPTIONAL_LOCKS=0 git rev-parse HEAD; shasum -a 256 docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md RECEIPT-627-REVISION.md' in /tmp/review-627/repo
 succeeded in 0ms:
9c08ddcc792641414a3dd7bbeea10912c6d4fb66
e19b8f3ec51d9bb3b6b92dcf3c8bce22b355ba36bf32472bb035a8c51fc6f37e  docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md
311915229598da5fe5650f3d8281fc9de56d97dfd76bfe0c924cba77498de17a  RECEIPT-627-REVISION.md

codex
复审 `1c3371ab..9c08ddcc`：

- **B1 HG-WEC5-LOCK-TIMING：PASS**。两类采集锁外执行，重获同锁后 current replay → fresh 终检 → 单次 append；ACC-HG-007 已同步，与 WEC5 一致。
- **B2 HG-RULING4-SOURCE：PASS**。持久坐标、摘录及哈希核实一致；原指令如实标 `NOT_LOCATED`，无虚构原文。

diff 仅涉及 Spec/回执修复面，其余条款未改。仓库零写入、工作树干净；测试仍 `NOT_RUN`。[复审记录](/tmp/review-627/INCREMENTAL-REVIEW-9c08ddcc.md)。

`FROZEN_BLOCKER_UNION=[]`
tokens used
79,955
复审 `1c3371ab..9c08ddcc`：

- **B1 HG-WEC5-LOCK-TIMING：PASS**。两类采集锁外执行，重获同锁后 current replay → fresh 终检 → 单次 append；ACC-HG-007 已同步，与 WEC5 一致。
- **B2 HG-RULING4-SOURCE：PASS**。持久坐标、摘录及哈希核实一致；原指令如实标 `NOT_LOCATED`，无虚构原文。

diff 仅涉及 Spec/回执修复面，其余条款未改。仓库零写入、工作树干净；测试仍 `NOT_RUN`。[复审记录](/tmp/review-627/INCREMENTAL-REVIEW-9c08ddcc.md)。

`FROZEN_BLOCKER_UNION=[]`

