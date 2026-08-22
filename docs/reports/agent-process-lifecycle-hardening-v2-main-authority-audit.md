# AgentProcess V2 Main Authority Audit Record

## Review coordinates

```text
REPOSITORY = mayf3/dsh-agent-core
SPEC_ID = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
SPEC_PATH = docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md
REVIEWED_BASE_COMMIT = b312ef88532d2750e6df95a8ef2e4a83284b9562
REVIEWED_SPEC_COMMIT = 12375d6282ede5015088a7d7f5495d6f46ca7738
REVIEWER_ID = independent local audit Agent 59e55357-46ff-4d79-a0a2-a74f0d7f02f6 in session-6a9e365e-c448-4bae-a0f6-c397ef9cf1e2
AUTHOR_ID = mayf3 / PR #28 authority authors
REVIEWED_AT = 2026-08-22T01:13:33Z
```

This repository report persists the post-merge independent authority audit exactly as received. It is not a claim that this later convergence amendment has passed independent review, and it is not backfilled as a GitHub review or comment that existed before PR #28 merged.

## Review result

```text
SPEC_REVIEW = REVISE
READY_TO_MARK_ACCEPTED = NO
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = FAIL
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
IMMUTABILITY_REVIEW = PASS
BLOCKERS = 5
ACCEPTANCE_ACTOR_REQUIRED = mayf3 or explicitly authorized maintainer

AGENT_PROCESS_MAIN_AUTHORITY_AUDIT = FIX_REQUIRED
ACCEPTANCE_FINAL_HEAD_RECHECK = INVALID
IMPLEMENTATION_AUTHORITY_ACTIVE = BLOCKED_BY_AUTHORITY_DEFECT
IMPLEMENTATION_ALLOWED_TO_START = NO
PR35_DISPOSITION = MIGRATE_SPECIFIC_FIXES_TO_NEW_MAIN_AMENDMENT
RECOMMENDED_NEXT_TASK = 收口 执行

HISTORICAL_PR28_REVIEW_CLAIM = PASS
PERSISTENT_INDEPENDENT_REVIEW_PROVENANCE_AT_MERGE = INCOMPLETE
POST_MERGE_INDEPENDENT_AUTHORITY_AUDIT = FIX_REQUIRED
```

## Findings

### BLOCKER 1 — Persistent independent review provenance was incomplete at merge

- Affected authority / primitive / Contract: PR #28 acceptance/review provenance.
- Finding: PR #28 had no GitHub review, PR comment, inline review comment, commit comment, check-run, or repository review report that independently bound the claimed replacement review.
- Why it matters: frontmatter, PR-body, and commit self-assertions do not establish independent semantic review provenance.
- Required change: persist this post-merge independent audit without representing it as a pre-merge review.
- Evidence/provenance: PR #28 API record and the Original Independent Audit Record below.

### BLOCKER 2 — Acceptance final-head recheck was invalid

- Affected authority / primitive / Contract: final-head binding for `5c1d03b8543674ffe2af42c6d0529cf4e0552bff`.
- Finding: the final accepted head retained stale authority mirrors, incomplete V1 frontmatter reconciliation, a silent Spec index, incomplete independent provenance, and a broken embedded reproduction command.
- Why it matters: a status/finalize delta still requires an independent final-head recheck.
- Required change: retain `ACCEPTANCE_FINAL_HEAD_RECHECK = INVALID`; do not rewrite it as PASS.
- Evidence/provenance: Original Independent Audit Record.

### BLOCKER 3 — V1 V0 frontmatter reconciliation was incomplete

- Affected authority / primitive / Contract: `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` lifecycle endpoint.
- Finding: the superseded V1 lacked required V0 fields.
- Why it matters: the whole-authority graph must have a schema-complete historical endpoint while preserving its accepted normative meaning and provenance.
- Required change: add only the missing frontmatter/current-lifecycle metadata; preserve C-001–C-022, Acceptance, fault matrix, historical review provenance, and `implementation_authority: none`.
- Evidence/provenance: Original Independent Audit Record and `.agents/protocol/SPEC_FORMAT_V0.md`.

### BLOCKER 4 — Post-merge current-state mirrors contradicted active authority

- Affected authority / primitive / Contract: V2 lifecycle and authority state projections.
- Finding: V2 continued to present pre-merge V1-active/V2-in-branch text as current state after merge.
- Why it matters: current State must be time-indexed and must not contradict authoritative frontmatter and mutual backlinks.
- Required change: mark pre-merge material historical and add the current main-based state without changing product semantics.
- Evidence/provenance: Original Independent Audit Record.

### BLOCKER 5 — Spec index and reproduction evidence were incomplete

- Affected authority / primitive / Contract: `docs/specs/README.md` navigation and OBS-PROC-005 reproduction.
- Finding: the index omitted AgentProcess V1/V2, and the embedded phrase-split command could select its own source instead of the target Markdown section.
- Why it matters: downstream readers need a unique authority navigation record and deterministic, fail-loud semantic preservation evidence.
- Required change: index V2 current/V1 superseded and use a strict fence-aware, line-anchored heading parser.
- Evidence/provenance: Original Independent Audit Record and Reproduction Record below.

## Current main compatibility context

```text
CURRENT_MAIN_COMPATIBILITY_HEAD = b312ef88532d2750e6df95a8ef2e4a83284b9562
LATEST_MAIN_DELTA = RELEVANT_BUT_COMPATIBLE_AGENT_CHILD_TMPDIR
PRESERVE_PROVIDER_ENV_PROXY_SEAM = YES
PRESERVE_AGENT_CHILD_TMPDIR_SEAM = YES
AGENT_CHILD_TMPDIR_SOURCE = AGENT_CHILD_TMPDIR_OVERRIDE_V1 / PR #39
V2_AUTHORITY_OVER_PROVIDER_PROXY = NONE
V2_AUTHORITY_OVER_AGENT_CHILD_TMPDIR = NONE
COMPATIBILITY_NOTES_CREATE_NEW_V2_CONTRACT = NO
```

The delta from `039cd8a6df3081fdc5cf08baf533129e3720d7e0` to the convergence base changes exactly `packages/agent-router/src/index.js`, `packages/agent-router/src/process.js`, and `packages/agent-router/test/child-env.test.js`. It fixes Agent child TMPDIR inheritance by making `agentEnv()` write `AGENT_CHILD_TMPDIR` last, prevents override/omit bypass, preserves the Router parent `process.env`, and adds regression coverage. It does not change the V1/V2 authority files, Spec index, governance files, or AgentProcess lifecycle/deadline/pending/registry/watermark/unknown-fence/reconciliation/shutdown semantics. This is non-normative compatibility context only.

## Accepted direction that must not be redesigned

- Preserve V2 as the accepted/current whole-authority replacement and V1 as superseded historical authority.
- Preserve C-001–C-022, all 39 Acceptance items, all 48 fault cases, and all 11 stable clause anchors.
- Preserve timeout, `outcome_unknown`, no-replay, unknown-fence, late-reconciliation/reply, shutdown, bounded-state, Scheduler, Session, Kernel, and provider/proxy boundaries.
- Preserve PR #39 `AGENT_CHILD_TMPDIR`, final-write ordering in `agentEnv()`, and non-mutation of the Router parent `process.env` as non-normative compatibility context; create no V2 TMPDIR Contract, Decision, or Acceptance item.
- Preserve the only V1→V2 authority delta: `implementation_authority: none -> contracts`.
- Do not treat accepted/current plus contracts as implementation completion, production rollout, or automatic merge authority.

## Original Independent Audit Record

The following record is preserved verbatim from the independent local audit Agent response.

```text
ORIGINAL_INDEPENDENT_AUDIT_RECORD_SHA256 = 87d3144c055cea3254b706afc5af661cad786b087701ab7b78b381a41a51fc72
```

```text
独立只读审计完成。结论为 FIX_REQUIRED，不能启动 implementation。完整结构化结果如下。

AGENT_PROCESS_MAIN_AUTHORITY_AUDIT = FIX_REQUIRED
TASK_NAME = 权威 审计
WORKTREE = /Users/yanfenma/workspace/project/dsh-agent-core/.worktree/authority-audit-12375d6-20260822T011333Z
WORKTREE_REUSED = NO
PRIMARY_WORKTREE_TOUCHED = NO
TARGET_AUTHORITY_HEAD = 12375d6282ede5015088a7d7f5495d6f46ca7738
CURRENT_MAIN_HEAD_AT_REVIEW_START = 039cd8a6df3081fdc5cf08baf533129e3720d7e0
CURRENT_MAIN_HEAD_AT_REVIEW_END = 039cd8a6df3081fdc5cf08baf533129e3720d7e0
MAIN_INCREMENT_CLASSIFICATION = ORTHOGONAL（target 后只有 PR #38 / 20a00f2 Stage-F evidence；未触及 V1/V2/index/governance/AgentProcess paths）
TARGET_STILL_ANCESTOR_OF_MAIN = YES

1. Authority graph
PR28_STATE = MERGED
PR28_URL = https://github.com/mayf3/dsh-agent-core/pull/28
MERGE_COMMIT = 12375d6282ede5015088a7d7f5495d6f46ca7738
PR28_ACCEPTED_HEAD = 5c1d03b8543674ffe2af42c6d0529cf4e0552bff
PR28_HEAD_IS_ANCESTOR_OF_MAIN = YES
ACCEPTED_CANDIDATE_BYTES_EQUAL_MERGE_SNAPSHOT = YES（V1/V2 两文件 diff exit 0）
AUTHORITY_GRAPH = PASS
MUTUAL_BACKLINKS = PASS
PARALLEL_CURRENT_AUTHORITIES = NO
SPEC_INDEX = FAIL
证据：V2 frontmatter `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md:2-21` 为 accepted / implementation / governing_spec / contracts / supersedes V1；V1 `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md:2-25` 为 superseded / superseded_by V2 / implementation_authority none。`docs/specs/README.md:34-41` 完全没有 AgentProcess V1/V2 条目，因此不表达 V2 current、V1 superseded。

2. Review/acceptance provenance
REPLACEMENT_REVIEW_PROVENANCE = SELF_ASSERTED_ONLY
ACCEPTANCE_FINAL_HEAD_RECHECK = INVALID
证据：GitHub API 对 PR #28 reviews、issue comments、inline review comments、accepted commit comments 均返回空数组；仓库全文 `PROCESS_IMPLEMENTATION_AUTHORITY_REPLACEMENT_REVIEW` 仅在 V2 自述的 `:29,:130,:1666`；08c041c 与 5c1d03b commit 均只有作者标题、无 review body；PR #28 body虽然声称 PASS/22/39/48，但按任务规则不能作为独立证据。5c1d03b 可定位且 V1/V2 bytes 与 merge snapshot一致，但独立 recheck 发现其引入并保留 stale post-merge current-state mirrors，且未完成 V1 V0 frontmatter/index reconciliation，因此判 INVALID，而不是 NOT_FOUND。
稳定坐标：PR28 URL 上述；reviewed spec 08c041c3ad11bab6b1632b24103b40b2d698dfdf；accepted head 5c1d03b8543674ffe2af42c6d0529cf4e0552bff；merge 12375d6。

3. 独立产品语义复核
PRODUCT_SEMANTIC_EQUIVALENCE = PASS
PRODUCT_SEMANTIC_DELTA = NONE
CONTRACT_CROSSWALK = PASS
CONTRACTS_CHECKED = 22 / 22
ACCEPTANCE_CROSSWALK = PASS
ACCEPTANCE_ITEMS_CHECKED = 39 / 39
FAULT_MATRIX = PASS
FAULT_CASES_CHECKED = 48 / 48
AUTHORIZATION_DELTA = VALID（none -> contracts）
独立提取/逐块比较结果：C-001..C-022 22 个全部相等（仅逆归一 Spec identity/stable anchor措辞），surface SHA-256 = 3e28f596f48e6e0f768f1bc46ebbce6b90ade98ec893b82899e9dc31f7d0d4c7。按章节边界独立提取 V1 §16/§16.1 与 V2 §10.2/§10.3，归一章节引用后精确相等，39 items、48 cases，独立 surface SHA-256 = 4b7fe1c69f59f4004a1df0c4d8ac9fbd38739c9161cc7c0cba1ab7d19eb9e1ca。
注意：V2 自带 reproduction command `:342-394` 因文档自身较早出现相同 split needle（`:386,:388`）而在当前文件运行会 AssertionError；不能用其自述 hash 作证明。本审计改用 heading-boundary 独立提取后才得到上述 PASS。这是 evidence reproducibility defect，应修。
逐语义面复核均 preserved：五态 lifecycle；四 timeout；outcome_unknown；no replay；unknown fence；settle-once late reconciliation；exact-owned shutdown/real exit；per-record/per-Agent/global bounded state；Scheduler termination/query seam且不改 Scheduler；Session/Binding/Product boundary与 Kernel unchanged。关键边界见 V2 `:184-228`，Contracts `:567` 起，Acceptance `§10.2/§10.3`。

4. PR35 四类问题重判
REQUIRED_SECTIONS = PASS（V2 `:1547` Migration/compatibility/rollback；`:1571` Open questions）
V1_REFERENCE_MATCH_LINES = 48
NORMATIVE_V1_SELF_REFERENCE = NONE
UNCLASSIFIED_V1_REFERENCE = 0
48 行全部分类为：historical provenance/source-coordinate、semantic/crosswalk comparison、supersession/acceptance plan/record，或 source-dated pre-merge observation；没有把当前 V2 Contract 主体误写成 V1。部分 pre-merge 表述虽分类明确，但在 main 上成为 stale mirror，另列第5节。
PROVIDER_PROXY_V2_AUTHORITY = NONE
说明：main V2 的 3 个 provider 命中（`:585,:841,:1439`）都是 V1 已有 generic provider readiness/fatal/fault语义，不是 provider-env/proxy 新 MUST/Decision/Contract，也不是 PR35 新加的 proxy compatibility seam。
V1_FRONTMATTER_RECONCILIATION = INCOMPLETE
证据：V1 `:1-26` 保留历史字段、scope、implementation_authority及正文 C-001..C-022/acceptance；但缺必需 `spec_kind, authority_level, governed_by, external_authorities, supersedes, owners`，仅新增 status/backlink；legacy `type:` 不能替代 V0 字段。V0 required schema见 `.agents/protocol/SPEC_FORMAT_V0.md:37-55`。

5. Post-merge mirrors
POST_MERGE_STATUS_MIRRORS = STALE_WORDING_DETECTED
STALE_CURRENT_STATE_ITEMS = [
  "V2:45 accepted仅在本PR分支、合main前非active（现已在main）",
  "V2:57-58 ACTIVE_IMPLEMENTATION_AUTHORITY_NOW=none / IMPLEMENTATION_ALLOWED=NO",
  "V2:67-68 status accepted仅在PR分支、main旧authority不失效",
  "V2:211-214 Authority on main until merge=V1 / Active implementation authority now=NONE",
  "V2:1551-1552 V1 remains active until acceptance-finalize（transaction已执行并merge）",
  "V2:1655-1658 OLD_AUTHORITY_STILL_ACTIVE=YES / ACTIVE...none / IMPLEMENTATION_ALLOWED=NO"
]
历史而非 stale-current 的记录：§0.3 plan随后在 `:120-121` 明确标记已执行；§0.4 acceptance record的 pre-merge条件；`:234-339` 明确绑定旧 commit/time 的 observations；这些作为 historical provenance保留可接受，但应在收口时明确历史标签以避免与 current mirrors混淆。

6. Implementation gate
IMPLEMENTATION_AUTHORITY_ACTIVE = BLOCKED_BY_AUTHORITY_DEFECT
IMPLEMENTATION_ALLOWED_TO_START = NO
形式上 V2 accepted+在main+contracts，且 governance `.agents/protocol/SPEC_GOVERNANCE_V0.md:345-353,411-439` 要求 base包含 accepted Spec、逐Contract compliance；但本任务明确规定 provenance/frontmatter/stale mirror使 authority 不可可靠使用时必须 NO。当前 blockers：无独立持久review evidence、final-head recheck invalid、V1 frontmatter incomplete、index缺失、current-state mirrors互相矛盾、嵌入复现命令失效。即使修复，也不自动授权 production rollout 或 merge。

7. PR35 disposition
PR35_STATE = OPEN / DRAFT
PR35_HEAD = de80abccf29263837d2c611738e1dfda6697b9c9（符合 expected）
PR35_URL = https://github.com/mayf3/dsh-agent-core/pull/35
PR35_DISPOSITION = MIGRATE_SPECIFIC_FIXES_TO_NEW_MAIN_AMENDMENT
PR35_CONTENT_TO_PRESERVE = ["四类审计发现中仍有效的 V1 V0 frontmatter reconciliation 要求", "AgentProcess Spec index synchronization要求", "post-merge current-state mirror收口要求"]
不得迁入/采纳 PR35 新增的 provider-env/proxy normative obligations；那是 V1/main V2 未授权的新内容。不得复活或把 main merge 回 PR35；应新建 main-based docs-only收口 amendment，之后独立 review。

8. Mechanical/scope
DIFF_CHECK = PASS
GOVERNANCE_VERIFIER = PASS（输出：vendored governance bytes match governance.lock.json and adoption is accepted）
PR28/MERGE_CHANGED_FILES = 2
CHANGED_FILES = [V1 modified +4/-2, V2 added +1676/-0]
PRODUCT_CODE_CHANGE_IN_AUTHORITY_REPLACEMENT = NONE
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MUTUAL_BACKLINK_BYTES = PASS
INDEX_BYTES = FAIL
Worktree结束仍 clean detached：`git status --short` 无输出。

9. End fetch
结束 `git fetch origin --prune` 成功；end=039cd8a6df3081fdc5cf08baf533129e3720d7e0，与 start 相同；target ancestry exit 0。target→current main仅 PR38 Stage-F evidence，相关 authority/source path无diff，分类 ORTHOGONAL，snapshot审计仍有效。

REQUIRED_FIXES = [
  "在新的 main-based docs-only amendment 中补齐 superseded V1 的完整 V0 frontmatter（保留历史字段、正文 Contracts、acceptance provenance）",
  "同步 docs/specs/README.md，唯一表达 V2 accepted/current、V1 superseded",
  "把 V2 所有 post-merge stale current-state mirrors改为当前main事实，或明确标记为历史 pre-merge record；当前应为V2 active/contracts、V1 superseded",
  "修复 V2 内嵌 semantic/acceptance reproduction command 的 self-match split bug并重新持久化可复现结果",
  "为 replacement review 与修后 final head建立独立、持久、可稳定定位的 review evidence（PR review/comment或repository report），并执行独立 final-head recheck"
]
RECOMMENDED_NEXT_TASK = 收口 执行
最终：不修改文件、不 commit/push/PR、不关闭/merge、不 implementation、不触碰 production/runtime/store/jobs。
```

## Reproduction Record

The command is embedded under `OBS-PROC-005` in the V2 Spec. It parses only line-anchored ATX Markdown headings outside fenced code blocks, determines section boundaries by heading level, and fails loudly on missing, duplicate, non-nested, or unexpected target headings and anchors.

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_HEAD = 12375d6282ede5015088a7d7f5495d6f46ca7738
CONVERGENCE_BASE = b312ef88532d2750e6df95a8ef2e4a83284b9562
CURRENT_MAIN_COMPATIBILITY = PRESERVE_PROVIDER_ENV_PROXY_SEAM + PRESERVE_AGENT_CHILD_TMPDIR_SEAM
V1_BLOB_BEFORE = fc420f29482fb7370812f97e43f0f557e9852133
V2_BLOB_BEFORE = 5ebedb091f123ceb5cf6acc3e953e6021fed2592
REPRODUCTION_COMMAND_VERSION = agent-process-authority-crosswalk-v2-heading-parser-1
PYTHON_VERSION = Python 3.14.5
EXIT_CODE = 0
CONTRACTS_CHECKED = 22/22
ACCEPTANCE_ITEMS_CHECKED = 39/39
FAULT_CASES_CHECKED = 48/48
STABLE_CLAUSE_ANCHORS = PASS
STABLE_CLAUSE_ANCHORS_CHECKED = 11/11
CONTRACT_SEMANTIC_DELTA = NONE
ACCEPTANCE_SEMANTIC_DELTA = NONE
FAULT_MATRIX_DELTA = NONE
PRODUCT_SEMANTIC_DELTA = NONE

CONTRACTS_HASH = 3e28f596f48e6e0f768f1bc46ebbce6b90ade98ec893b82899e9dc31f7d0d4c7
ACCEPTANCE_HASH = 1d515eb232dd12707e1c24053316d89034b250265487158bfdd4406570e402ca
FAULT_MATRIX_HASH = 825a89ece5ae67e9f76cee03b3a8cb6748bea03ba33c16ca19ba1492cb70d62d
```

Command stdout:

```text
REPRODUCTION_COMMAND_VERSION = agent-process-authority-crosswalk-v2-heading-parser-1
CONTRACTS_HASH = 3e28f596f48e6e0f768f1bc46ebbce6b90ade98ec893b82899e9dc31f7d0d4c7
ACCEPTANCE_HASH = 1d515eb232dd12707e1c24053316d89034b250265487158bfdd4406570e402ca
FAULT_MATRIX_HASH = 825a89ece5ae67e9f76cee03b3a8cb6748bea03ba33c16ca19ba1492cb70d62d
CONTRACT_CROSSWALK = PASS
CONTRACTS_CHECKED = 22/22
ACCEPTANCE_CROSSWALK = PASS
ACCEPTANCE_ITEMS_CHECKED = 39/39
FAULT_MATRIX = PASS
FAULT_CASES_CHECKED = 48/48
STABLE_CLAUSE_ANCHORS = PASS
STABLE_CLAUSE_ANCHORS_CHECKED = 11/11
PRODUCT_SEMANTIC_DELTA = NONE
```

## Final-head binding

This report does not accept or independently approve the convergence amendment. That later review remains pending.

```text
FINAL_ACCEPTED_HEAD = 5c1d03b8543674ffe2af42c6d0529cf4e0552bff
ACCEPTANCE_ACTOR = mayf3 (historical PR #28 acceptance actor claim)
ACCEPTED_AT = 2026-08-21
SEMANTIC_DELTA_AFTER_REVIEW = NONE (historical PR #28 claim)
FINAL_HEAD_RECHECK = FAIL
ACCEPTANCE_FINAL_HEAD_RECHECK = INVALID
CONVERGENCE_AMENDMENT_INDEPENDENT_REVIEW = PENDING
```

Any semantic delta requires a new independent review.
