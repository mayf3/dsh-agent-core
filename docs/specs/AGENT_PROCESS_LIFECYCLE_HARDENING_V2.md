---
spec_id: AGENT_PROCESS_LIFECYCLE_HARDENING_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - AgentProcess lifecycle and readiness
  - RPC deadlines and child-exit cleanup
  - interactive turn timeout and late reconciliation
  - graceful shutdown and bounded process evidence
  - termination evidence seam consumed by Scheduler
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V2
external_authorities: []
supersedes:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V1
superseded_by: null
owners:
  - mayf3
date: 2026-08-21
repository: mayf3/dsh-agent-core
authoring_base_main: 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
replaced_authority_revision: 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
accepted_date: 2026-08-21
accepted_reviewed_base: 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
accepted_reviewed_head: 08c041c3ad11bab6b1632b24103b40b2d698dfdf
replacement_review: PROCESS_IMPLEMENTATION_AUTHORITY_REPLACEMENT_REVIEW
replacement_review_result: PASS
required_fixes: NONE
review_verdict: READY_TO_ACCEPT_REPLACEMENT
acceptance_finalize_semantic_change: none
references:
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md
  - docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md
  - docs/investigations/AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1.md
---

# AGENT_PROCESS_LIFECYCLE_HARDENING_V2 — 进程生命周期、deadline 与未知结果收口

> 状态：**accepted / current on `main`**（2026-08-21 whole-authority acceptance finalize；reviewed replacement HEAD `08c041c3ad11bab6b1632b24103b40b2d698dfdf`；supersedes `AGENT_PROCESS_LIFECYCLE_HARDENING_V1`）。
> 当前实现状态：**NOT_STARTED**。Accepted/current authority 不等于 implementation complete、production fixed、production deployed 或 implementation PR automatically mergeable。
> 本收口：**DOCS ONLY**；不 implementation；不修改 production；不修改当前 `DSH_AGENT_TURN_TIMEOUT=900000` 运维缓解；不修改 Scheduler；不 merge。

---

## 0. Authoring Result and Supersession Lifecycle

```text
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = AMEND
AGENT_PROCESS_LIFECYCLE_HARDENING_V2_SPEC = PASS
SPEC_STATUS = accepted
ACTIVE_AUTHORITY_ON_MAIN = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
IMPLEMENTATION_AUTHORITY = contracts
SUPERSEDES = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
V1_CURRENT_STATUS = superseded
IMPLEMENTATION_STATE = NOT_STARTED
PRODUCTION_ROLLOUT_STATE = NOT_STARTED
AUTHORITY_CONFORMANCE_AUDIT = FIX_REQUIRED_UNTIL_THIS_CONVERGENCE_IS_INDEPENDENTLY_REVIEWED_AND_MERGED
IMPLEMENTATION_ALLOWED_TO_START = NO
NEEDS_OWNER_DECISION = NO
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
```

`PASS` 只表示历史 replacement authoring 输入完整；whole-authority acceptance provenance 见 §0.4。当前独立审计结论仍为 `FIX_REQUIRED`，本 docs-only 收口在独立 review 并合入前不授权 implementation 启动。

### 0.1 Complete replacement declaration

```text
REPLACEMENT_SPEC_ID = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
REPLACED_SPEC_ID = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
REPLACED_AUTHORITY_REVISION = 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
REPLACEMENT_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY
DELTA_AMENDMENT = NO
CONTRACT_SEMANTIC_CHANGE = NONE
IMPLEMENTATION_SCOPE_CHANGE = NONE
ACCEPTANCE_CRITERIA_CHANGE = NONE
ONLY_INTENTIONAL_AUTHORITY_CHANGE = implementation_authority:none->contracts
```

本文件完整、自包含地承载被替换 authority 的 Goal、scope、Owner decisions、全部
Contracts、Acceptance Criteria、production / Scheduler / security boundaries，以及 compatibility 要求。
读者不需要拼接 V1 与失败 amendment 才能得到 V2 authority。V1 的正文语义由本 replacement
完整保留；唯一有意变化是 V2 在未来合法 accepted 后可由其 Contracts 授予 bounded
implementation authority。

### 0.2 Replaced authority review provenance (historical input only)

```text
REPLACED_SPEC_ID = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
REPLACED_SPEC_ACCEPTED_DATE = 2026-08-20
REPLACED_SPEC_ACCEPTANCE_REVIEWED_SEMANTIC_HEAD = 8475318f12068a28fe937779c91735817b6db9ca
REPLACED_SPEC_INDEPENDENT_FOCUSED_RE_REVIEW = PASS
REPLACED_SPEC_REQUIRED_FIXES_CLOSED = 9/9
REPLACED_SPEC_SEMANTIC_CHANGE_AT_FINALIZE = NONE
```

以上 provenance 仅证明 V1 被完整携带语义的历史来源；它不是 V2 的 review 或 acceptance
provenance。V2 未填写 `accepted_by`、`accepted_at` 或任何等价的 acceptance claim。

### 0.3 Atomic whole-authority supersession plan — HISTORICAL_ACCEPTANCE_PLAN

以下是 2026-08-21 acceptance-finalize 之前的历史计划：当时的 authoring PR 只准备未来原子 transition；V2 frontmatter 的 `supersedes` 保持空列表，V1 保持 `status: accepted`。计划要求 authorized maintainer 在后续 docs-only acceptance-finalize change 中原子执行：

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V2.status: proposed -> accepted
AGENT_PROCESS_LIFECYCLE_HARDENING_V2.supersedes: [] -> [AGENT_PROCESS_LIFECYCLE_HARDENING_V1]
AGENT_PROCESS_LIFECYCLE_HARDENING_V1.status: accepted -> superseded
AGENT_PROCESS_LIFECYCLE_HARDENING_V1.superseded_by: AGENT_PROCESS_LIFECYCLE_HARDENING_V2
```

该历史计划规定任一 backlink/lifecycle 更新缺失都不得完成 transition；当时的 authority 状态绑定于 authoring base `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`。

**2026-08-21 执行记录：以上 plan 已由 docs-only whole-authority acceptance-finalize transaction 在同一 commit 中原子执行完成，并由 PR #28 merge `12375d6282ede5015088a7d7f5495d6f46ca7738` 进入 `main`；acceptance provenance 见 §0.4。**

### 0.4 Acceptance Record — HISTORICAL_PRE_MERGE_RECORD

```text
ACCEPTANCE_FINALIZE = AGENT_PROCESS_LIFECYCLE_HARDENING_V2_WHOLE_AUTHORITY_ACCEPTANCE_FINALIZE
ACCEPTED_DATE = 2026-08-21
REVIEWED_BASE_COMMIT = 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
REVIEWED_SPEC_COMMIT = 08c041c3ad11bab6b1632b24103b40b2d698dfdf
HISTORICAL_PR28_REVIEW_CLAIM = PASS
PERSISTENT_INDEPENDENT_REVIEW_PROVENANCE_AT_MERGE = INCOMPLETE
POST_MERGE_INDEPENDENT_AUTHORITY_AUDIT = FIX_REQUIRED
ACCEPTANCE_FINAL_HEAD_RECHECK = INVALID
SEMANTIC_DELTA_FROM_REVIEWED_SPEC_COMMIT = NONE
SPEC_STATUS = accepted
SUPERSEDES = [AGENT_PROCESS_LIFECYCLE_HARDENING_V1]
SUPERSEDED_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V1 (status = superseded; superseded_by = AGENT_PROCESS_LIFECYCLE_HARDENING_V2)
ATOMIC_WHOLE_AUTHORITY_SUPERSESSION = SINGLE_DOCS_ONLY_TRANSACTION
FINAL_ACCEPTED_HEAD = 5c1d03b8543674ffe2af42c6d0529cf4e0552bff
AUTHORITY_MERGE = 12375d6282ede5015088a7d7f5495d6f46ca7738
HISTORICAL_IMPLEMENTATION_ALLOWED_BEFORE_ACTIVATION = NO
```

本 finalize 只机械执行 §0.3 预定的原子 transition 与 acceptance provenance；§1–§15 reviewed
semantics（C-001..C-022 Contracts、§10.2 的 39 条 acceptance items、§10.3 的 48 个 fault
cases、11 个 stable clause anchors、production / Scheduler / security boundaries）保持逐字不变。

---

## 1. Goal

AgentProcess 必须把以下事实分开：

```text
child spawn requested
child OS process created
initialize request sent
process ready
prompt bytes attempted
prompt receipt received
turn terminal observed
caller deadline expired
cancel requested
turn proven terminated
child real exit observed
```

目标是消除以下已确认缺陷：

- child `error` / `exit` 后 pending RPC 永久等待；
- initialize request 或 prompt receipt 无总 deadline；
- Registry 在 ready 前暴露 process，并发 caller 不能共享完整 startup；
- stdin write failure 不 reject 对应 RPC；
- array-index watermark 与 prompt send 顺序不能构成稳定归因；
- timeout 被当作 ordinary failure，但原 turn 继续运行并可能已有外部副作用；
- timeout 后同一 AgentProcess 可接收新 turn；
- late terminal 与最终 assistant output 无声丢失；
- graceful stop 超期后返回假终态，不 kill / 不 await real exit；
- `events`、`stderr`、`creations` 等 process state 无界增长。

本 Spec 优先保证：不永久挂起、不错误复用、不自动重放、不把“停止等待”冒充“执行已终止”。

---

## 2. Scope and non-goals

In scope（与 V1 完全相同）：

- AgentProcess lifecycle and readiness；
- RPC deadlines and child-exit cleanup；
- interactive turn timeout and late reconciliation；
- graceful shutdown and bounded process evidence；
- termination evidence seam consumed by Scheduler。

Non-goals / forbidden changes（与 V1 完全相同）：

- 不在本 Spec authoring 中实现任何 Contract；
- 不修改 production code、deployment state 或当前 `DSH_AGENT_TURN_TIMEOUT=900000` 缓解；
- 不修改 Scheduler code、store、occurrence identity、retry policy 或 persistence；
- 不改变 Feishu、Binding、Session、Router product policy、DSH Kernel 或 Product Surface delivery；
- 不自动 replay，不把 timeout 当作 ordinary failure，不把 kill request 当作 real exit；
- 不 accepted、不伪造 acceptance provenance、不 merge。

---

## 3. Authority and dependencies

```text
Program authority = AGENT_CORE_HARDENING_PROGRAM_V1 (accepted)
Session/product authority = AGENT_WORKSPACE_SESSION_MODEL_V2 (accepted)
Evidence authority = AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1 (PASS)
Current AgentProcess authority on main = AGENT_PROCESS_LIFECYCLE_HARDENING_V2 (accepted; implementation_authority=contracts)
Historical replaced authority = AGENT_PROCESS_LIFECYCLE_HARDENING_V1 (superseded; implementation_authority=none)
Implementation state = NOT_STARTED
Production rollout state = NOT_STARTED
Implementation start gate = NO pending independent convergence review and merge
```

Owner 边界：

```text
CONFIG_OWNER = AgentProcess / production deployment configuration
NOT_OWNED_BY = Feishu, Binding, Session, Scheduler
ONE_AGENT_ONE_PROCESS = PRESERVE
SESSION_MODEL_CHANGE = NONE
ROUTER_PRODUCT_POLICY_CHANGE = NONE
DSH_KERNEL_CHANGE = NONE
```

本 Spec 只定义 Scheduler 将来可消费的 termination seam；不实现或修改 Scheduler。

### 3.1 Non-normative current-main compatibility context

```text
CURRENT_MAIN_COMPATIBILITY_HEAD = b312ef88532d2750e6df95a8ef2e4a83284b9562
PRESERVE_PROVIDER_ENV_PROXY_SEAM = YES
PRESERVE_AGENT_CHILD_TMPDIR_SEAM = YES
AGENT_CHILD_TMPDIR_SOURCE = AGENT_CHILD_TMPDIR_OVERRIDE_V1 / PR #39
V2_AUTHORITY_OVER_PROVIDER_PROXY = NONE
V2_AUTHORITY_OVER_AGENT_CHILD_TMPDIR = NONE
COMPATIBILITY_NOTES_CREATE_NEW_V2_CONTRACT = NO
```

This State/compatibility note records adjacent behavior already present on current `main`; it creates no new V2 Contract, Decision, or Acceptance item. A later AgentProcess implementation must not accidentally regress the provider/proxy seam, `AGENT_CHILD_TMPDIR`, the final-write ordering in `agentEnv()`, or the invariant that the Router parent `process.env` is not mutated. Those compatibility facts remain outside V2 normative authority.

---

## 4. Current State

### STATE-PROC-001 — Repository authority state — HISTORICAL_PRE_MERGE_RECORD

- Subject: AgentProcess lifecycle governing authority in `mayf3/dsh-agent-core`
- As of commit: `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Environment: Git repository authority branch `main`
- Observed at: `2026-08-21T01:21:17Z`
- Historical projection: at that exact pre-merge coordinate, `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` was accepted with `implementation_authority: none`.
- Basis: `OBS-PROC-001`, `EVD-PROC-001`.

### STATE-PROC-002 — Carried AgentProcess gap model

- Subject: the descriptive AgentProcess gaps that the replacement Contracts govern
- As of authority revision: `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Environment: historical accepted V1 authority record; no new runtime observation is claimed by V2
- Observed at: `2026-08-21T01:21:17Z`
- Projection: the nine accepted gap observations and the incident-derived
  `TIMEOUT_WITHOUT_TERMINATION_PROOF = outcome_unknown` interpretation remain the factual basis carried into V2.
- Basis: `OBS-PROC-003`, `EVD-PROC-004`.

### STATE-PROC-003 — Current AgentProcess authority state

- Subject: AgentProcess lifecycle governing authority
- As of commit: `b312ef88532d2750e6df95a8ef2e4a83284b9562`
- Environment: `mayf3/dsh-agent-core` authority branch `main` plus this docs-only convergence amendment
- Observed at: `2026-08-22T02:58:39Z`
- Projection: `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` is accepted/current; `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` is superseded; `implementation_authority = contracts`; implementation and production rollout are not started.
- Compatibility context: preserve the existing provider/proxy seam and PR #39 `AGENT_CHILD_TMPDIR` behavior without granting V2 authority over either.
- Basis: main V2/V1 frontmatter, mutual backlinks, authority merge `12375d6282ede5015088a7d7f5495d6f46ca7738`, current main `b312ef88532d2750e6df95a8ef2e4a83284b9562`, and the AgentProcess index synchronized by this amendment.

---

## 5. Observations

### OBS-PROC-001 — V1 authority at the historical authoring base — HISTORICAL_PRE_MERGE_RECORD

- Subject: `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md`
- Source revision: `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Environment: `mayf3/dsh-agent-core` `main`
- Observed at: `2026-08-21T01:21:17Z`
- Method: read the Spec frontmatter from the fetched target remote base
- Result: `status: accepted`; `implementation_authority: none`.
- Provenance: predecessor file in the repository at the stated commit.

### OBS-PROC-002 — Current governance requires atomic whole-authority supersession

- Subject: accepted repository governance
- Source revision: `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Environment: `mayf3/dsh-agent-core` `main`
- Observed at: `2026-08-21T01:21:17Z`
- Method: read `.agents/README.md` §6.2–§6.3,
  `.agents/protocol/SPEC_FORMAT_V0.md` §2.7/§14.3, and
  `.agents/protocol/SPEC_GOVERNANCE_V0.md` §9.2
- Result: changed accepted normative meaning requires `SUPERSEDE`; V0 permits only
  whole-authority supersession; the new accepted forward edge and old superseded backlink
  must be installed atomically.
- Provenance: the named governance files at the stated commit.

### OBS-PROC-003 — Accepted V1 evidence summary carried without reinterpretation

- Subject: accepted V1 §3 Current Evidence
- Source revision: `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Environment: historical source/runtime evidence recorded by accepted V1
- Observed at: `2026-08-21T01:21:17Z` (authority reread; not a fresh runtime observation)
- Method: read V1 §3 and its referenced investigation
- Result:
  当前 `packages/agent-router/src/process.js` / `index.js` 已确认：

  1. `pending` waiter 只在 response 或可选 timer 上删除；child `error` / `exit` 不 reject 全部 pending。
  2. `ready()` 的 `initialize` RPC 本身无 deadline；外层 retry timeout 无法打断一个永久不返回的 request。
  3. `turn()` 的 `session/prompt` receipt 无 deadline。
  4. `request()` 在 `stdin.write()` 同步 throw、callback error、pipe close/error 时没有统一 reject contract。
  5. `ensureRunning()` 在 `proc.ready()` 前已 `registry.set(agentId, proc)`；并发 caller 可拿到 initializing process，而不是共享 startup result。
  6. watermark 当前是 `events.length`；events 无界且 array index 不是可截断 buffer 的稳定 sequence。
  7. turn deadline 只让 caller throw；child turn 继续，且 late assistant output 无 reader。
  8. shutdown grace 超期可返回 `{ timeout: true }`，没有强制 kill，也没有 await real exit。
  9. `events`、`stderr`、`creations`、stdout partial buffer 无明确上限。

  真实事故 evidence 已证明：两个 300s caller deadline 后，原 turn 分别继续 46s / 32s 并 `completed`；其中一个在 timeout 前已产生真实购物车和知识库副作用。因此：

  ```text
  TIMEOUT_WITHOUT_TERMINATION_PROOF != FAILED
  TIMEOUT_WITHOUT_TERMINATION_PROOF = outcome_unknown
  ```

  ---
- Provenance: V1 §3 and
  `docs/investigations/AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1.md`.

### OBS-PROC-004 — Failed same-ID authority amendment

- Subject: failed reviewed revision `9dba2e437191c974a31665b4cc4dff0c5978b0ab`
- Source revision: `9dba2e437191c974a31665b4cc4dff0c5978b0ab`
- Environment: remote docs branch based on
  `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Observed at: `2026-08-21T01:21:17Z`
- Method: `git show 9dba2e4 -- docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md`
- Result: the revision attempted to change `implementation_authority: none` to
  `contracts` under the accepted V1 `spec_id` and described that change as an amendment.
- Provenance: immutable Git commit `9dba2e437191c974a31665b4cc4dff0c5978b0ab`.

### OBS-PROC-005 — Historical deterministic preservation and current reproduction

- Subject: carried C-001–C-022 bodies, detailed Acceptance Criteria, and V2 governance structure
- Source revisions: V1 at `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`;
  V2 semantic commit `52558b23c5278c77a2a64482bd41f9d26f2fad19`, Spec blob
  `edb7ffe75c685687923589dbe684ee528da19354`, plus the normalized surface hashes below
- Environment: fresh independent Git worktree based on target `main`
- Observed at: `2026-08-21T01:21:17Z`
- Method: extract each C-001–C-022 body, normalize only Spec-identity wording and repaired
  stable-anchor references, compare with V1, concatenate in Contract-ID order, and SHA-256;
  separately compare §10.2–§10.3 detailed acceptance with V1 §16/§16.1 and SHA-256
- Historical result: C-001–C-022 preserved 22/22 with normalized surface SHA-256
  `3e28f596f48e6e0f768f1bc46ebbce6b90ade98ec893b82899e9dc31f7d0d4c7`;
  detailed acceptance plus fault surface preserved with historical normalized SHA-256
  `07a8de03a382dadd45e1b1587327c929cd56bd3a81fa1522425be30daa07a59e`.
- Convergence reproduction: on base `b312ef88532d2750e6df95a8ef2e4a83284b9562`, the command below separately verifies Contracts, Acceptance criteria, and the fault matrix from the current V1/V2 files. Its exact hashes and stdout are persisted in `docs/reports/agent-process-lifecycle-hardening-v2-main-authority-audit.md`.
- Reproduction command:

```bash
python3 - <<'PY'
import hashlib
import re
from pathlib import Path

VERSION = 'agent-process-authority-crosswalk-v2-heading-parser-1'
V1_PATH = Path('docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md')
V2_PATH = Path('docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md')


def parse_markdown(text):
    """Return line-anchored ATX headings outside fenced code blocks."""
    lines = text.splitlines(keepends=True)
    headings = []
    fence = None
    for index, line in enumerate(lines):
        if fence is not None:
            character, minimum_length = fence
            closing = re.match(
                rf'^ {{0,3}}({re.escape(character)}{{{minimum_length},}})[ \t]*(?:\n)?$',
                line)
            if closing:
                fence = None
            continue
        opening = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if opening:
            marker = opening.group(1)
            fence = (marker[0], len(marker))
            continue
        match = re.match(r'^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n)?$', line)
        if match:
            headings.append((len(match.group(1)), match.group(2), index))
    if fence is not None:
        raise AssertionError('unclosed fenced code block')
    return lines, headings


def unique_heading(text, title):
    lines, headings = parse_markdown(text)
    matches = [(level, index) for level, value, index in headings if value == title]
    if len(matches) != 1:
        raise AssertionError(f'heading {title!r}: expected 1, found {len(matches)}')
    level, start = matches[0]
    end = len(lines)
    for other_level, _, other_start in headings:
        if other_start > start and other_level <= level:
            end = other_start
            break
    return lines, headings, level, start, end


def section(text, title):
    lines, _, _, start, end = unique_heading(text, title)
    return ''.join(lines[start + 1:end])


def before_child(text, parent_title, child_title):
    lines, _, parent_level, parent_start, parent_end = unique_heading(text, parent_title)
    _, _, child_level, child_start, _ = unique_heading(text, child_title)
    if child_level <= parent_level or not (parent_start < child_start < parent_end):
        raise AssertionError(f'{child_title!r} is not a child of {parent_title!r}')
    return ''.join(lines[parent_start + 1:child_start])


def contract_blocks(text):
    lines, headings = parse_markdown(text)
    result = {}
    for level, title, start in headings:
        match = re.match(r'^C-(\d{3}) —', title)
        if not match:
            continue
        key = match.group(1)
        if key in result:
            raise AssertionError(f'duplicate Contract C-{key}')
        end = len(lines)
        for other_level, _, other_start in headings:
            if other_start > start and other_level <= level:
                end = other_start
                break
        result[key] = ''.join(lines[start + 1:end])
    return result


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


v1 = V1_PATH.read_text()
v2 = V2_PATH.read_text()
v1_contracts = contract_blocks(v1)
v2_contracts = contract_blocks(v2)
expected_contracts = [f'{number:03d}' for number in range(1, 23)]
assert sorted(v1_contracts) == expected_contracts
assert sorted(v2_contracts) == expected_contracts

reverse = [
    ('本 Spec 可信类型仅为：', 'V1 可信类型仅为：'),
    ('本 Spec 不承诺 disk persistence', 'V1 不承诺 disk persistence'),
    ('本 Spec retention 保证', 'V1 retention 保证'),
    ('本 Spec 固定 safety ceilings', 'V1 固定 safety ceilings'),
    ('`C-001` 允许的', '§6 C-001 允许的'),
    ('`C-009` fatal teardown', '§7 C-009 fatal teardown'),
    ('graceful-then-kill per `C-020` / `C-022`', 'graceful-then-kill per §12'),
    ('Queued-but-not-sent turns 必须有界（见 `CLAUSE-PROC-BOUNDED`）。',
     'Queued-but-not-sent turns 必须有界（见 §11）。'),
    ('在 `CLAUSE-PROC-RECONCILIATION` / `CLAUSE-PROC-BOUNDED` retention window 内可审计',
     '在 §10/§11 retention window 内可审计'),
    ('已按 `CLAUSE-PROC-BOUNDED` eviction', '已按 §11 eviction'),
    ('直到 `CLAUSE-PROC-BOUNDED` 允许的', '直到 §11 允许的'),
]
for key in expected_contracts:
    normalized = v2_contracts[key]
    for current, historical in reverse:
        normalized = normalized.replace(current, historical)
    assert v1_contracts[key] == normalized, f'Contract C-{key} differs'

v1_acceptance = before_child(
    v1, '16. Future Implementation Acceptance',
    '16.1 Fault-injection crosswalk and evidence schema')
v2_acceptance = section(v2, '10.2 Carried future implementation acceptance criteria')
v2_acceptance = v2_acceptance.replace('§10.3', '§16.1')
assert v1_acceptance == v2_acceptance, 'acceptance criteria differ'

v1_faults = section(v1, '16.1 Fault-injection crosswalk and evidence schema')
v2_faults = section(v2, '10.3 Fault-injection crosswalk and evidence schema')
assert v1_faults == v2_faults, 'fault matrix differs'

acceptance_count = len(re.findall(r'^\d+\. ', v1_acceptance, re.MULTILINE))
fault_count = len(re.findall(r'^\| `[A-Z0-9_]+` \|', v1_faults, re.MULTILINE))
_, v2_headings = parse_markdown(v2)
expected_anchors = {
    'CLAUSE-PROC-LIFECYCLE',
    'CLAUSE-PROC-DEADLINE-CONFIG',
    'CLAUSE-PROC-RPC',
    'CLAUSE-PROC-REGISTRY',
    'CLAUSE-PROC-ADMISSION',
    'CLAUSE-PROC-OUTCOME',
    'CLAUSE-PROC-RECONCILIATION',
    'CLAUSE-PROC-BOUNDED',
    'CLAUSE-PROC-SHUTDOWN',
    'CLAUSE-PROC-SCHEDULER-SEAM',
    'CLAUSE-PROC-FAILURE-TAXONOMY',
}
actual_anchors = [
    title.split(' —', 1)[0]
    for _, title, _ in v2_headings
    if title.startswith('CLAUSE-PROC-')
]
assert len(actual_anchors) == len(set(actual_anchors)), 'duplicate stable clause anchor'
assert set(actual_anchors) == expected_anchors, 'missing or unexpected stable clause anchor'
assert acceptance_count == 39
assert fault_count == 48
assert len(actual_anchors) == 11

contract_surface = ''.join(key + v1_contracts[key] for key in expected_contracts)
print(f'REPRODUCTION_COMMAND_VERSION = {VERSION}')
print(f'CONTRACTS_HASH = {digest(contract_surface)}')
print(f'ACCEPTANCE_HASH = {digest(v1_acceptance)}')
print(f'FAULT_MATRIX_HASH = {digest(v1_faults)}')
print('CONTRACT_CROSSWALK = PASS')
print('CONTRACTS_CHECKED = 22/22')
print('ACCEPTANCE_CROSSWALK = PASS')
print('ACCEPTANCE_ITEMS_CHECKED = 39/39')
print('FAULT_MATRIX = PASS')
print('FAULT_CASES_CHECKED = 48/48')
print('STABLE_CLAUSE_ANCHORS = PASS')
print('STABLE_CLAUSE_ANCHORS_CHECKED = 11/11')
print('PRODUCT_SEMANTIC_DELTA = NONE')
PY
```

- Historical provenance: exact Git commits/blob above and the output recorded in [PR #28](https://github.com/mayf3/dsh-agent-core/pull/28).
- Convergence provenance: this embedded command and its exact output in `docs/reports/agent-process-lifecycle-hardening-v2-main-authority-audit.md`.

---

## 6. Claims and assumptions

### CLM-PROC-001 — V2 cannot authorize implementation while proposed — HISTORICAL_PRE_MERGE_RECORD

- Support state: SUPPORTED
- Supported by evidence: `EVD-PROC-002`
- Contradicted by evidence: none known
- Uncertainty: none for the repository/base coordinates stated here

### CLM-PROC-002 — V1's accepted factual and normative model can be carried unchanged

- Support state: SUPPORTED
- Supported by evidence: `EVD-PROC-005`
- Contradicted by evidence: none known
- Uncertainty: V2 makes no fresh claim that implementation/runtime state has changed since V1

### CLM-PROC-003 — The authority-field change requires a replacement Spec

- Support state: SUPPORTED
- Supported by evidence: `EVD-PROC-003`, `EVD-PROC-006`
- Contradicted by evidence: none known
- Uncertainty: none under the current accepted V0 governance

```text
OPEN_ASSUMPTIONS_AFFECTING_AUTHORITY = NONE
```

---

## 7. Evidence relations

### EVD-PROC-001 — V1 metadata supports the historical active-authority State — HISTORICAL_PRE_MERGE_RECORD

- Source observations: `OBS-PROC-001`
- Target: `STATE-PROC-001`
- Relation: SUPPORTS
- Bound coordinates: repository `mayf3/dsh-agent-core`, main
  `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`, observed `2026-08-21T01:21:17Z`
- Strength/sufficiency: direct frontmatter observation
- Limitations: says nothing about future acceptance actions
- Provenance: V1 file at the stated commit

### EVD-PROC-002 — Governance lifecycle supports no implementation authority while proposed — HISTORICAL_PRE_MERGE_RECORD

- Source observations: `OBS-PROC-002`
- Target: `CLM-PROC-001`
- Relation: SUPPORTS
- Bound coordinates: accepted governance bytes at main
  `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`, observed `2026-08-21T01:21:17Z`
- Strength/sufficiency: direct accepted-governance lifecycle rule
- Limitations: semantic completeness still requires independent review
- Provenance: named governance sections in `OBS-PROC-002`

### EVD-PROC-003 — Governance mutation rule supports whole replacement

- Source observations: `OBS-PROC-002`
- Target: `CLM-PROC-003`
- Relation: SUPPORTS
- Bound coordinates: accepted governance bytes at main
  `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`, observed `2026-08-21T01:21:17Z`
- Strength/sufficiency: direct accepted-governance immutability and supersession rule
- Limitations: does not itself establish V2 semantic completeness
- Provenance: named governance sections in `OBS-PROC-002`

### EVD-PROC-004 — Accepted V1 evidence supports the carried gap State

- Source observations: `OBS-PROC-003`
- Target: `STATE-PROC-002`
- Relation: SUPPORTS
- Bound coordinates: V1 at main
  `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`; historical environment/incident coordinates remain those recorded by V1
- Strength/sufficiency: sufficient to preserve, not reinterpret, the accepted authority basis
- Limitations: not a fresh runtime verification
- Provenance: V1 §3 and its investigation reference

### EVD-PROC-005 — Deterministic comparison supports semantic preservation

- Source observations: `OBS-PROC-005`
- Target: `CLM-PROC-002`
- Relation: SUPPORTS
- Bound coordinates: V1 at `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`; V2 semantic commit
  `52558b23c5278c77a2a64482bd41f9d26f2fad19`, Spec blob
  `edb7ffe75c685687923589dbe684ee528da19354`, and normalized surface hashes in `OBS-PROC-005`
- Strength/sufficiency: deterministic 22/22 Contract-body preservation and unchanged detailed
  Acceptance Criteria/fault table
- Limitations: identity-only wording and stable-reference repairs are normalized; deterministic comparison does not replace semantic review
- Provenance: exact hashes and reproducible validation recorded in `OBS-PROC-005` and the Draft PR

### EVD-PROC-006 — Failed revision demonstrates the forbidden mutation shape

- Source observations: `OBS-PROC-004`
- Target: `CLM-PROC-003`
- Relation: SUPPORTS
- Bound coordinates: failed revision
  `9dba2e437191c974a31665b4cc4dff0c5978b0ab` over main
  `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6`
- Strength/sufficiency: direct immutable diff corroborating the governance classification
- Limitations: the failed revision is evidence only and grants no authority
- Provenance: Git commit named in `OBS-PROC-004`

---

## 8. Decisions

The acceptance-oriented future tense in `DEC-PROC-001` through `DEC-PROC-003` is a `HISTORICAL_ACCEPTANCE_PLAN` bound to the authoring coordinate. The planned authority transaction is recorded as executed in §0.4; this label does not alter the accepted Decision meaning.

### DEC-PROC-001 — Use a complete standalone V2 replacement

- Decision owner: repository owner `mayf3`
- Decision: author `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` as a complete replacement
  of the whole V1 authority; do not continue the same-ID amendment.
- Rejected alternative: mutate V1 `implementation_authority` in place.
- Reason: accepted normative meaning is immutable under the same Spec ID and V0 forbids partial supersession.
- Remaining owner input: none for authoring; future acceptance remains a separate authorized action.

### DEC-PROC-002 — Preserve all V1 semantics except future implementation authority

- Decision owner: repository owner `mayf3`
- Decision: preserve Goal, scope, C-001–C-022, Acceptance Criteria, production/Scheduler/security
  boundaries, Owner decisions, non-goals, and evidence requirements; the only intended authority
  delta is `implementation_authority: none -> contracts` after legal V2 acceptance.
- Rejected alternative: use replacement authoring to revise implementation behavior or acceptance.
- Reason: those semantics already completed independent V1 review and are outside this task.
- Remaining owner input: none.

### DEC-PROC-003 — Keep V1 active until an atomic acceptance-finalize transaction — HISTORICAL_ACCEPTANCE_PLAN

- Decision owner: repository owner `mayf3`
- Decision: while V2 is proposed, its `supersedes` list remains empty and V1 remains accepted.
  A later docs-only transaction must atomically accept V2, add V2's forward edge, supersede V1,
  and add V1's backlink.
- Rejected alternative: install either graph edge early or claim V1 is already inactive.
- Reason: current governance requires atomic whole-authority supersession.
- Remaining owner input at authoring coordinate: authorized acceptance action after independent review.
- Historical execution status: the transaction was executed and entered `main` through authority merge `12375d6282ede5015088a7d7f5495d6f46ca7738`; V2 is current and V1 is superseded.

### DEC-PROC-004 — Keep implementation and product boundaries unchanged

- Decision owner: repository owner `mayf3`
- Decision: future implementation may be authorized only by accepted C-001–C-022 and must retain
  all existing no-Scheduler, no-Product-Surface-delivery, no-Kernel, production-safety, and security boundaries.
- Rejected alternative: treat `contracts` as blanket implementation authority.
- Reason: implementation authority is bounded by accepted Contracts and scope.
- Remaining owner input: none.

---

## 9. Contracts

The complete V1 normative model and C-001–C-022 text follow unchanged except for the
replacement Spec identity and the editorial phrase “本 Spec”. The `CLAUSE-PROC-*` IDs below
are stable anchors that attach every carried normative block to its parent C-* Contracts; they
create no additional obligation and prevent legacy section-number references from becoming ambiguous.

| Stable clause anchor | Constituent parent Contracts |
|---|---|
| `CLAUSE-PROC-LIFECYCLE` | `C-006`, `C-008`, `C-009`, `C-020` |
| `CLAUSE-PROC-DEADLINE-CONFIG` | `C-001`, `C-005`, `C-012`, `C-014`, `C-020`, `C-022` |
| `CLAUSE-PROC-RPC` | `C-001`–`C-005` |
| `CLAUSE-PROC-REGISTRY` | `C-006`–`C-009` |
| `CLAUSE-PROC-ADMISSION` | `C-010`–`C-013` |
| `CLAUSE-PROC-OUTCOME` | `C-014`–`C-016` |
| `CLAUSE-PROC-RECONCILIATION` | `C-017`–`C-019` |
| `CLAUSE-PROC-BOUNDED` | `C-002`, `C-009`, `C-013`, `C-018`, `C-019` |
| `CLAUSE-PROC-SHUTDOWN` | `C-020`–`C-022` |
| `CLAUSE-PROC-SCHEDULER-SEAM` | `C-010`, `C-015`, `C-016`, `C-018`, `C-019` |
| `CLAUSE-PROC-FAILURE-TAXONOMY` | `C-003`, `C-004`, `C-009`, `C-012`, `C-014`, `C-017`, `C-020`, `C-022` |

### CLAUSE-PROC-LIFECYCLE — Process State Machine

#### 4.1 States

唯一公开 lifecycle 顺序：

```text
SPAWNING
→ INITIALIZING
→ READY
→ DRAINING
→ EXITED
```

定义：

- `SPAWNING`：构造完成、spawn 正在进行或 child handle 刚建立，尚未开始 initialize。
- `INITIALIZING`：child 已建立，initialize 总 deadline 已启动，尚未满足 readiness contract。
- `READY`：initialize 成功，所选 provider 已注册，且 process 可接受业务 turn。
- `DRAINING`：不再接受新业务；正在 reject/settle waiters、graceful stop、kill 或等待 real exit。
- `EXITED`：该 generation 已有 terminal child-existence evidence，全部 pending RPC 已 settle，ready/startup/reap entry 已完成规定处置。Terminal evidence 只能是：(a) child 从未创建成功的 `spawn_failed_without_child`；或 (b) 对已创建 child 观察到真实 `exit`。任何已创建 child 都不得用 `spawn_failed_without_child` 绕过 real-exit proof。

#### 4.2 Legal transitions

```text
SPAWNING -> INITIALIZING
SPAWNING -> DRAINING       # spawn/error failure cleanup
INITIALIZING -> READY
INITIALIZING -> DRAINING   # init timeout/error/child exit/stop
READY -> DRAINING          # explicit stop, fatal stream failure, child error/exit
DRAINING -> EXITED         # created child: real exit; no child created: spawn_failed_without_child; then cleanup
```

禁止：

```text
SPAWNING -> READY
INITIALIZING -> EXITED
READY -> EXITED
DRAINING -> READY
EXITED -> any state
```

Unexpected child `error` / `exit` 也必须先执行 DRAINING cleanup；若 real exit 已同时可见，可在同一 task 内完成 `DRAINING -> EXITED`，但不得跳过 cleanup semantics。

#### 4.3 State invariants

```text
BUSINESS_TURN_ADMISSION_ALLOWED = state == READY && activeUnknownFence == false
REGISTRY_VISIBILITY_ALLOWED = state == READY
READY_IS_MONOTONIC_PER_PROCESS_INSTANCE = YES
EXITED_IS_TERMINAL = YES
EXITED_REQUIRES = real_exit_for_created_child | spawn_failed_without_child
```

一个 respawn 是新的 AgentProcess instance / processGeneration；不得把旧 `EXITED` object 复活。

---

### CLAUSE-PROC-DEADLINE-CONFIG — Deadline Configuration Model

#### 5.1 Four independent fields

```text
initializeTimeoutMs
promptReceiptTimeoutMs
turnTimeoutMs
shutdownGraceMs
```

四者不得合并成通用 `timeoutMs`，不得由 Feishu、Binding、Session 或 Scheduler 动态覆盖，也不得接受 per-message 任意 override。

| Field | Starts | Ends / meaning | Code default |
|---|---|---|---:|
| `initializeTimeoutMs` | transition to `INITIALIZING`, before first initialize write | process reaches `READY`, otherwise startup fails | 90000 |
| `promptReceiptTimeoutMs` | active turn watermark established, immediately before prompt write | exact `session/prompt` receipt arrives | 30000 |
| `turnTimeoutMs` | same point immediately before prompt write | exact turn terminal + required idle/termination evidence arrives | 300000 |
| `shutdownGraceMs` | transition to `DRAINING` for graceful stop | child exits voluntarily before forced kill | 30000 |

All values MUST be positive safe integers and MUST be validated fail-loud before spawning any AgentProcess.

#### 5.2 Precedence and static ownership

```text
per-Agent static override
> global deployment value
> code default
```

Global deployment names:

```text
DSH_AGENT_INITIALIZE_TIMEOUT_MS
DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS
DSH_AGENT_TURN_TIMEOUT_MS
DSH_AGENT_SHUTDOWN_GRACE_MS
```

Compatibility requirement:

```text
if DSH_AGENT_TURN_TIMEOUT_MS is absent
and legacy DSH_AGENT_TURN_TIMEOUT is present
→ turnTimeoutMs = DSH_AGENT_TURN_TIMEOUT

if DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS is absent
and legacy DSH_AGENT_DELIVER_TIMEOUT is present
→ promptReceiptTimeoutMs = DSH_AGENT_DELIVER_TIMEOUT
```

Legacy env 只映射到四字段 resolved config，不形成第五个 timeout。当前 production 的 `DSH_AGENT_TURN_TIMEOUT=900000` 在未来 implementation rollout 中必须继续生效；本轮不修改该运维缓解。

Optional per-Agent override 是 deployment-owned、startup/process-start-only config，载体冻结为：

```text
<productionRoot>/agent-process-overrides.json
{
  "version": 1,
  "overrides": {
    "agt_xxx": {
      "initializeTimeoutMs": 90000,
      "promptReceiptTimeoutMs": 30000,
      "turnTimeoutMs": 900000,
      "shutdownGraceMs": 30000
    }
  }
}
```

每个字段 optional；未知字段、重复 key、未知 Agent、非正 safe integer 必须 fail-loud。文件只在 process-start configuration boundary 读取；已运行 process 的 resolved config immutable，不 file-watch、不 per-turn reload。

该载体独立于 `agents.json`，不扩大 AgentDefinition 的 identity/display-only schema；也不复用 model override 文件。

---

### CLAUSE-PROC-RPC — RPC and Stream Contracts

#### C-001 — Every RPC has one absolute total deadline

每个 JSON-RPC operation 在创建时必须获得 monotonic absolute deadline；deadline 覆盖：

```text
pending entry creation
→ stdin enqueue/write completion
→ child processing/retry
→ matching response receipt
```

不得在 retry 时重置 deadline，不得把“每次 attempt timeout”冒充 total deadline。

Enforcement 使用 process-local monotonic clock：`deadlineMono = monotonicNow + budget`；audit 另存 wall-clock `deadlineAtWallMs`。系统时钟跳变不得延长/缩短 enforcement budget，wall-clock 字段不得反过来驱动 timeout。

Deadline source：

- initialize RPC/retries：remaining `initializeTimeoutMs`；
- prompt RPC：remaining `promptReceiptTimeoutMs`，同时受 active `turnTimeoutMs` 的更早 deadline 限制；
- shutdown RPC：remaining `shutdownGraceMs`；
- parent-RPC handling and `rpc.response`：remaining active turn deadline；若没有可归属 active turn，则从 receipt 时起最多 `turnTimeoutMs`，不新增第五个配置字段；
- 其他 internal RPC：必须由调用 contract 从以上 lifecycle budget 之一显式派生；禁止 `undefined` / infinite deadline。

#### C-002 — Pending entry settles exactly once

Response、deadline、stdin failure、child `error`、child `exit` 可以竞争，但每个 pending RPC 只能 settle 一次；settle 必须同步删除 map entry并清理 timer/listener。

Late response 不得重新 settle 已 reject 的 caller。若它属于 `outcome_unknown` turn，则只能进入该 turn 的 bounded reconciliation record。

#### C-003 — Child error/exit rejects all pending

```text
child error OR child exit
→ reject every pending RPC immediately
→ clear all RPC timers/listeners
→ pending.size = 0
```

Error 必须携带至少：`agentId`、`processGeneration`、RPC method 与 observed evidence。只观察到 child `error` 时使用 `code=AGENT_PROCESS_UNAVAILABLE`；只有真实 exit 已观察时才使用 `code=AGENT_PROCESS_EXITED`。两者都 reject pending，但不得把 stream/process error 冒充 real exit。

#### C-004 — stdin failure rejects request

以下任一情况必须 reject 对应 RPC，不得留下 pending entry：

- `stdin.write()` synchronous throw；
- write callback error；
- stdin `error` / premature `close`；
- stream known non-writable before write。

若能证明 zero-byte / pre-send rejection，则可分类 `not_admitted`。若 bytes 是否到达 child 不可证明，则 prompt operation 必须进入 `outcome_unknown`；不得自动 replay。

#### C-005 — Parent RPC is bounded

child→parent `rpc.request` handler 也受同一个 absolute total deadline。收到 request 时一次性计算：

```text
receivedAtMono = monotonicNow()
totalDeadlineMono = inherited active-turn deadline（或 `C-001` 允许的 turnTimeoutMs-derived deadline）
totalBudgetMs = max(0, totalDeadlineMono - receivedAtMono)   # receipt 时 remaining budget，一次性冻结
responseWriteReserveMs = min(250, max(1, floor(totalBudgetMs * 0.10)))
handlerDeadlineMono = totalDeadlineMono - responseWriteReserveMs
```

`responseWriteReserveMs` 是固定算法，不是 deployment config，不形成第五个 timeout。若 receipt 时 `totalBudgetMs <= 0`，不启动 handler且不 write（deadline 已过），只 settle/audit timeout。若 `totalBudgetMs > 0` 但 `handlerDeadlineMono <= receivedAtMono`，同样不启动 handler，立即在 original total deadline 内 best-effort timeout response。否则调用 hook并传递 `{ handlerDeadlineMono, totalDeadlineMono, deadlineAtWallMs, signal }`；handler 不得重置/延长任一 deadline。到 `handlerDeadlineMono` 仍未 settle时，AgentProcess abort cooperative signal，并只在剩余 reserve 内尝试一次 timeout response。

Response write 是 **best-effort within the original total deadline**：若 pipe unavailable、backpressure/write callback 未在 `totalDeadlineMono` 前完成，则记录 `responseWrite=failed|unknown` 并结束 waiter；不得新建 deadline、不得在 total deadline 后第二次 write。剩余 budget 已不足 1ms 时不启动 handler，直接 best-effort timeout response。

AgentProcess 只能强制 **one wire response attempt / one waiter settlement / no automatic re-invocation**；它不能强行阻止已经运行的任意 Promise 或外部系统在 timeout 后产生一次迟到副作用。Late hook settlement 不得发送第二 response；side effect 是否已发生若不可证明，必须保留 `sideEffectOutcome=unknown`，不得自动重试该 parent RPC。

---

### CLAUSE-PROC-REGISTRY — Registry and Startup

#### C-006 — Registry exposes READY only and uses one linearizable slot

业务 `registry.get(agentId)` 只可投影 `READY` process。底层每个 Agent 必须只有一个 linearizable lifecycle slot；不得用三个可独立 delete/set 的 map 制造空窗：

```text
lifecycleSlot[agentId] =
  EMPTY
  | STARTUP { generation, entryId, resultPromise, processRef? }
  | READY   { generation, entryId, processRef, ownershipToken }
  | REAP    { generation, entryId, processRef, ownershipToken, reapPromise, cause }
```

`readyRegistry` / `startupRegistry` / `reapRegistry` 若保留，只能是该 slot tagged state 的只读 view，不得成为可独立 mutation authority。所有 mutation 必须在 per-Agent lock 或等价 atomic compare-and-swap 下完成。

#### C-007 — Concurrent startup shares one promise

并发 `ensureRunning(agentId)` 在线性化点读取 slot：

```text
READY   → all callers receive same READY process
STARTUP → all callers await same generation-bound resultPromise
REAP    → all callers immediately reject AGENT_PROCESS_REAPING
EMPTY   → exactly one CAS(EMPTY -> STARTUP entry) wins before any async work
```

同一 Agent 同一 generation 的 spawn count 必须为 1。不得把 initializing process object 直接交给 caller。Startup success 也必须是 identity CAS：`CAS(exact STARTUP entry -> READY entry)`；若 CAS 失败，process 不得被暴露，必须进入 fatal teardown。

#### C-008 — Failure atomically installs generation-bound reap fence

任何已创建 child 的 STARTUP/READY fatal failure，第一项 registry mutation 必须把当前 exact entry **原子替换**为同 generation `REAP` fence：

```text
fatal observed
→ construct REAP { same generation, fresh entryId, exact processRef/ownershipToken, cause }
→ CAS(exact STARTUP|READY entry identity -> REAP)
→ only after CAS success: settle caller result / teardown
```

禁止：

```text
delete STARTUP or READY
→ later set REAP
```

因为这会在 real exit 前暴露 `EMPTY`，允许新 generation 启动。若 CAS 发现 slot 已是同 generation REAP，则共享其 `reapPromise`；若是不同 identity/generation，fatal handler 不得修改该 slot，只能追加 stale-callback audit。

Startup failure 的 caller settlement 与 generation reap 分开：

```text
failure observed within initialize total deadline
→ CAS STARTUP -> REAP (created child)
→ reject shared startup resultPromise once
→ execute `C-009` fatal teardown
→ real exit + reconciliation visible
→ CAS(exact REAP entry -> EMPTY)
```

若 spawn 在 child handle 建立前同步失败，则 exact `STARTUP` entry 可在记录 `spawn_failed_without_child`、settle startup result、确认 `processRef=none` 后直接 `CAS(exact STARTUP -> EMPTY)`；这是唯一不安装 child reap fence 的路径。

Startup caller 不等待无限 OS reap：resultPromise 必须在 initialize deadline/failure observation 后 bounded reject。Created child real exit 前，REAP fence 必须连续存在；后续 `ensureRunning` 立即 reject，不等待、不复用、不 spawn 新 generation。

#### C-009 — Every fatal path necessarily tears down exact generation

所有 **created-child** fatal source——initialize failure、provider-readiness fatal、stdin/stdout error or close、protocol/frame overflow、parser fatal、invariant violation、unexpected child `error`、READY process unrecoverable fault——必须走同一 teardown primitive：

```text
CAS exact STARTUP|READY -> generation-bound REAP fence
→ state DRAINING
→ stop every prompt admission path
→ reject queued-not-sent turns
→ immediately settle/reject all currently pending RPC
→ ensure each admitted active execution without outcome proof is authoritative `outcome_unknown` (not final late settlement)
→ choose termination policy:
     pre-READY / protocol / stream / invariant / unexpected fatal = immediate kill
     explicit operator/runtime shutdown only = graceful-then-kill per `C-020` / `C-022`
→ kill only exact Router-owned generation per C-020
→ await exact child real exit
→ execute C-020 pending-first/parser-precedence/final-reconciliation order
→ ensure Router reconciliation state visible
→ CAS(exact REAP entry -> EMPTY)
→ EXITED
```

Synchronous spawn failure before any child object/OS process exists走显式 no-child fatal branch：

```text
exact STARTUP entry
→ logical state DRAINING
→ stop admission / reject queued and pending (normally zero)
→ record spawn_failed_without_child + processRef=none + ownershipToken=none
→ settle shared startup result
→ CAS(exact STARTUP entry -> EMPTY)
→ EXITED
```

该 branch 不安装 REAP、不 kill、不 await不存在的 exit；但仍经过 DRAINING cleanup，且只有 exact no-child evidence 后才可 EMPTY。任何 child object/PID/ownership token 已建立的 failure 不得使用此 branch。

No fatal handler may only log/throw and leave a child alive。`REAP -> EMPTY` 删除必须比较 generation + entryId + processRef + ownershipToken；旧 generation 的 late error/exit callback 只能追加 bounded audit，不得删除/替换新 entry。Created child real exit 前不得出现允许新 generation 启动的 registry 空窗。

---

### CLAUSE-PROC-ADMISSION — Turn Admission, Watermark and Receipt

#### C-010 — Watermark precedes prompt send

每个 prompt-producing path（等待 terminal 的 `turn()`、receipt-only `deliver()`、Scheduler bridge 及未来业务入口）都先 mint `turnExecutionId`，再建立 monotonic event watermark，最后才允许 prompt bytes 写入。`deliver()` 的 caller 可在 receipt 后返回，但 AgentProcess 仍必须在后台跟踪该 exact execution 的 terminal/unknown fence；receipt-only 不等于 lifecycle-untracked：

```text
turnExecutionId minted by Router reconciliation store
→ authoritative pending record + caller correlation index visible
→ eventWatermarkSeq captured
→ AgentProcess matcher bound to same turnExecutionId
→ prompt receipt + turn absolute deadlines installed
→ prompt write attempted
```

`turnExecutionId` / `reconciliationHandle` 是同一个 stable opaque ID，必须在任何 prompt bytes 前端到端绑定；不得等 timeout 后补 mint。watermark 必须是永不回退的 event sequence number，不得使用可截断 array 的当前 index/length 作为长期 identity。

每个 business call 的结果 envelope 必须是下列 closed union。任何 prompt write attempt 前 authoritative record/handle 已存在，因此 `completed` / `failed` / `outcome_unknown` 必须携带 handle，`outcome_unknown` 尤其不得只 throw string。`not_admitted` 若发生在 record reservation 前（validation/capacity fail）可为 `null`；若发生在 reservation 后（例如 proven zero-byte write rejection）必须返回已 mint handle：

```text
{ status: completed,       reconciliationHandle, reply, evidence }
{ status: failed,          reconciliationHandle, error, evidence }
{ status: not_admitted,    reconciliationHandle: string | null, error, evidence }
{ status: outcome_unknown, reconciliationHandle, deadlineAtWallMs, evidence }
```

Scheduler bridge 可在 admission 时提供 opaque caller correlation `{ occurrenceId, runId, requestId }`。Router store 只把它作为 exact secondary index：

```text
(occurrenceId, runId, requestId) <-> reconciliationHandle
```

Scheduler restart 后可用同一 triple 恢复 handle并查询；AgentProcess 不解释 occurrence/retry policy，Scheduler 边界不变。重复绑定 same triple + same handle idempotent；same triple + different handle 必须 conflict/fail-loud。

#### C-011 — Exact correlation

本 turn 只消费：

1. `eventSeq > eventWatermarkSeq`；
2. exact `sessionId`；
3. prompt receipt 的 exact `messageId`；
4. 与该 message/turn 关联的 exact terminal event。

前一 turn 的迟到 event 不得混入；本 turn 在 JSON-RPC response 前到达的 receipt event 不得因 watermark 建立过晚而丢失。

#### C-012 — Prompt receipt has a deadline

Prompt receipt wait 使用 `promptReceiptTimeoutMs` total deadline。若 deadline 到期：

- proven pre-send rejection → `failed/not_admitted`；
- write may have reached child、receipt 丢失或 response late → `outcome_unknown`；
- 保留 bounded late-response correlation tombstone，以便迟到 receipt 建立 exact `messageId` 并继续 reconciliation；
- 不自动重写 prompt，不自动创建第二 request。

#### C-013 — Queue and fence

每个 AgentProcess 同时最多一个 active turn。Queued-but-not-sent turns 必须有界（见 `CLAUSE-PROC-BOUNDED`）。

当 active turn 进入 unresolved `outcome_unknown`：

```text
SAME_AGENTPROCESS_NEW_TURN_ADMISSION = FORBIDDEN
```

Fence 必须位于统一 `session/prompt` write boundary，覆盖 `turn()`、receipt-only `deliver()`、Scheduler bridge 及任何未来业务 prompt path；不得通过绕过 turn queue 的 delivery seam 向同一 process 注入新工作。

所有尚未 prompt-send 的 queued turns 必须以结构化 `AGENT_PROCESS_TURN_FENCED` reject；不得在 fence 解除后自动发送。Caller 若仍希望执行，必须在 reconciliation 后进行新的显式业务 admission；这不是自动 replay。

---

### CLAUSE-PROC-OUTCOME — Turn Deadline and Outcome Model

#### C-014 — Timeout is not ordinary failure

```text
turn deadline exceeded
AND exact turn termination not proven
→ outcome_unknown
```

`outcome_unknown` 表示 caller deadline 已到，但 success、failure、termination、外部副作用均未被证明。

禁止：

```text
timeout -> ordinary failed
timeout -> claim no side effect
timeout -> automatic replay
timeout -> immediately admit next turn on same AgentProcess
```

#### C-015 — Outcome evidence and termination evidence are distinct

**Outcome evidence** 只回答 success/failure：watermark 后、exact `sessionId`、receipt `messageId` 与 DSH turn identity 关联的 `turn/end` reason。Uncorrelated terminal、其他 Session idle、process still alive 都不是 exact outcome evidence。

**Termination evidence** 只回答 exact execution 能否继续。本 Spec 可信类型仅为：

1. `exact_terminal_then_idle`：上述 exact `turn/end` 已观察，随后同一 `sessionId` 的 status 为 `idle`，且两者之间没有同 Session 的 later turn/start；
2. `exact_queued_removal`：DSH 明确 acknowledgment **同一 `turnExecutionId` / prompt request / messageId** 尚未开始且已从 native queue 移除；
3. `child_real_exit`：承载该 turn 的 exact processGeneration 已真实 exit；
4. future accepted cancellation contract 的 exact turn terminal acknowledgment。

因此在 deadline 前：

- exact success outcome + `exact_terminal_then_idle` → `completed`；
- exact failure outcome + `exact_terminal_then_idle` → `failed`；
- proven pre-send zero-byte rejection → `failed/not_admitted`。

`child_real_exit` 可证明 termination，但没有 exact turn/end 时不证明 success/failure。仅本地 Promise rejection、AbortSignal、cancel request、时间流逝、caller disconnect、unrelated queue removal 或 unrelated Session idle 都不是 termination proof。

#### C-016 — Unknown fence release

Fence 只能由 C-015 针对 **同一 active unknown turnExecutionId** 的 termination evidence 解除。特别地，`exact_queued_removal` 必须移除该 unknown execution 本身；移除别的 queued prompt 不影响 active fence。

Operator 猜测、固定等待时长、clear stale marker 不是 proof。

Child exit 可解除 process-level concurrency risk，但若没有 exact terminal outcome，turn 结果仍保持 `outcome_unknown` / `terminated_without_outcome`；不得改写为 ordinary failed。

---

### CLAUSE-PROC-RECONCILIATION — Late Terminal Reconciliation and Reply

#### C-017 — All unknown sources enter one settle-once late state machine

以下来源只要无法证明 exact success/failure/termination，都必须先统一写 `outcome_unknown`，不得各自发明 terminal state：

```text
turn deadline exceeded
prompt receipt deadline after write may have reached child
stdin partial/async write failure with unknown admission
parent-RPC timeout with unknown side effect when it determines turn outcome
unexpected child error before real exit
explicit shutdown/forced kill while active turn has no outcome proof
child real exit without exact parsed outcome evidence
protocol/parser fatal after prompt admission
control-plane caller disconnect after admission
```

唯一 late transition：

```text
outcome_unknown -> exactly one of {
  late_completed,
  late_failed,
  terminated_without_outcome
}
```

三者 mutually exclusive；每个 `turnExecutionId` 只允许一次 winning settlement CAS：

- `late_completed`：可信 exact success outcome + termination evidence；
- `late_failed`：可信 exact failure outcome + termination evidence；
- `terminated_without_outcome`：只证明 execution 不能继续，但没有 exact outcome proof。

Evidence precedence：如果 parser 在 child exit callback 前已经接收并关联 exact `turn/end` outcome evidence，即使 store update 尚未执行，该 parsed evidence 必须先完成 late_completed/late_failed 判定；不得因随后 `child_real_exit` 抢先写成 `terminated_without_outcome`。实现必须在 process event serialization/lock 内先 snapshot 已接收 parser evidence，再执行 settlement CAS。

Winning settlement 后，duplicate same evidence 与 conflicting evidence 都不得改写 state、不得第二次 emit、不得改变 output；只追加 bounded audit entry：`duplicate_ignored` 或 `conflict_ignored`，包含 evidence type/hash/observedAt。历史 `outcome_unknown`、`deadlineAtWallMs`、late `settledAtWallMs` 与 termination evidence 在 `CLAUSE-PROC-RECONCILIATION` / `CLAUSE-PROC-BOUNDED` retention window 内可审计；late settlement 不触发第二 prompt admission。

#### C-018 — Final assistant output is retained, not silently dropped

Exact turn 的 final assistant output 必须进入 bounded reconciliation record，并随 `late_completed` event 暴露给原 caller/Router reconciliation seam。若超过 byte cap，保留尾部/最终 message与明确 `truncated=true`、original byte count；不得静默返回空字符串。

```text
AGENTPROCESS_AUTONOMOUS_USER_DELIVERY = FORBIDDEN
LATE_REPLY_DELIVERY = RETAIN_AND_EXPOSE_VIA_ORIGINAL_CALLER_RECONCILIATION_HANDLE
AUTOMATIC_UNSOLICITED_PRODUCT_SURFACE_DELIVERY = NO
```

即：AgentProcess 必须让迟到 reply 对原 caller/Router 可查询、可观察、可审计，但不自行或要求 Feishu/Mobile/其他 Product Surface 自动发送消息。本 child 明确选择 **不自动 unsolicited delivery**，避免在 caller 已收到 timeout 后制造新的跨 surface 产品行为；未来若要改变用户可见 delivery，必须由独立 accepted Product Surface Spec 授权。该选择不允许丢弃 output，也不允许通过重新 prompt/replay 用户消息补偿。

Router reconciliation store 是唯一 query authority。AgentProcess local matcher/cache 不可直接被 caller 查询，也不得与 Router store形成两个 truth source。Authoritative `pending` record 在 prompt write 前已可见；exit/fatal/shutdown settlement 必须先 CAS/update Router store 可见，再释放 AgentProcess object、reap fence或 generation metadata，因此不得出现 handoff `not_found` 空窗。

Read API 全部 non-consuming、repeatable、idempotent：

```text
getTurnReconciliation(reconciliationHandle)
  -> { state: pending, snapshot }
   | { state: settled, snapshot }
   | { state: evicted }
   | { state: restart_lost }
   | { state: never_existed }

readFinalAssistantOutput(reconciliationHandle)
  -> { state: available, text, truncated, originalBytes, terminalState }
   | { state: pending }
   | { state: no_output, terminalState }
   | { state: evicted }
   | { state: restart_lost }
   | { state: never_existed }

resolveCallerCorrelation({ occurrenceId, runId, requestId })
  -> reconciliationHandle | same five-state absence semantics

onTurnReconciled(listener) -> disposer
```

语义：

- `pending`：authoritative record 存在且尚未 settle；不是 not-found。
- `no_output`：record 已 terminal，但该 outcome 没有 assistant output；不同于空字符串。
- `evicted`：handle 属于当前 runtime epoch，Router issuance metadata证明曾 mint，但 resolved payload 已按 `CLAUSE-PROC-BOUNDED` eviction。
- `restart_lost`：handle 的 embedded runtimeEpoch 与当前 control-plane runtime 不同；本 Spec 不承诺 disk persistence。
- `never_existed`：handle 格式/epoch合法，但 generation/monotonic turn sequence 从未由 Router mint。

Handle 必须嵌入 opaque `runtimeEpoch + agentId discriminator + processGeneration + monotonicTurnSeq`。`monotonicTurnSeq` 在同一 runtime epoch / Agent 内由 Router 连续 mint、无跳号；Router 保留 `maxIssuedTurnSeq`、`evictedThroughTurnSeq` 与尚存 generation ranges，使当前 epoch 内精确区分 `evicted`（合法已发行且 payload被移除）和 `never_existed`（seq 超 high-water、非法 Agent/generation组合或从未 mint）。Runtime epoch 不匹配统一为 `restart_lost`。任何 read 不删除 record、不推进 state、不改变后续 read 结果。

本 Spec retention 保证是同一 control-plane runtime lifetime 内、直到 `CLAUSE-PROC-BOUNDED` 允许的 **resolved** record eviction。Unresolved record 永不 eviction；eviction 不得解释为 success/failure或解除 fence。

#### C-019 — Reconciliation identity

Late event 至少携带：

```text
runtimeEpoch
agentId
processGeneration
turnExecutionId == reconciliationHandle
callerCorrelation { occurrenceId, runId, requestId } (optional opaque index)
sessionId
eventWatermarkSeq
promptRequestId
messageId (when eventually known)
deadlineAtWallMs               # audit only; enforcement uses private deadlineMono
initialOutcome
lateOutcome
cancelRequestedAtWallMs (optional)
terminationProven
terminationEvidence
finalAssistantOutput / truncated/originalBytes metadata
settledAtWallMs
boundedEvidenceAudit[]
```

---

### CLAUSE-PROC-BOUNDED — Bounded State

所有 process-owned evidence 必须有明确 hard cap、O(1) eviction，并暴露 dropped/truncated counters。本 Spec 固定 safety ceilings（不是第五类 runtime timeout/config surface）：

```text
MAX_EVENT_RECORDS = 10000
MAX_EVENT_BUFFER_BYTES = 8388608
MAX_EVENT_RECORD_BYTES = 1048576
MAX_STDERR_BYTES = 1048576
MAX_CREATION_RECORDS = 256
MAX_CREATION_RECORD_BYTES = 4096
MAX_STDOUT_PARTIAL_BYTES = 1048576
MAX_RPC_FRAME_BYTES = 1048576
MAX_PENDING_RPC = 1024
MAX_RECONCILIATION_RECORD_BYTES = 1179648
MAX_RECONCILIATION_RECORDS_PER_AGENT = 256
MAX_RECONCILIATION_BYTES_PER_AGENT = 33554432
MAX_RECONCILIATION_RECORDS_GLOBAL = 8192
MAX_RECONCILIATION_BYTES_GLOBAL = 268435456
MAX_RECONCILIATION_AUDIT_ENTRIES_PER_RECORD = 32
MAX_RECONCILIATION_AUDIT_BYTES_PER_RECORD = 65536
MAX_ISSUANCE_GENERATIONS_PER_AGENT = 256
MAX_FINAL_ASSISTANT_OUTPUT_BYTES = 1048576
MAX_QUEUED_TURNS_PER_PROCESS = 64
MAX_QUEUED_PROMPT_BYTES_PER_PROCESS = 4194304
MAX_PROMPT_BYTES = 1048576
```

规则：

1. `events` 同时受 record count、total bytes、per-record bytes 三个 cap；使用 monotonic `eventSeq` ring，eviction 不重用 sequence。Oversized single event 保留 correlation header + explicit truncated metadata，不能分配原始无界 payload。
2. Live turn matcher 在 event arrival 时增量归因，不依赖无限历史 array。
3. Reconciliation state 同时受 per-record、per-Agent count/bytes、Router-global count/bytes cap；audit list另受 per-record count/bytes cap。Record size 计算必须包含 metadata、caller correlation、audit与 output bytes，不得用 shallow object count规避。
4. `stderr` 保留最新 tail；记录 `stderrDroppedBytes`。
5. `creations` 同时受 count 与 per-record bytes cap；保留最新 records并记录 `creationsDroppedCount/Bytes`。
6. stdout partial line 或完整 RPC frame 超 cap 是 fatal protocol error → 必然走 C-009 DRAINING teardown；parser 在分配/parse 前 enforce cap。
7. pending RPC 达 cap 时，新 RPC 在 write 前 fail-loud；不得 eviction 一个仍 pending waiter。RPC params/result frame 同样受 frame cap。
8. Unresolved reconciliation record 不得 eviction。任一 per-record/per-Agent/global cap 无法通过 eviction resolved records腾出空间时，新 prompt admission 必须在 watermark/prompt write 前 fail-loud `RECONCILIATION_CAPACITY_EXHAUSTED`；不得先执行再丢 evidence。
9. queued turns 同时受 count、total prompt bytes、single prompt bytes cap；超限在 prompt-send 前 structured reject，并且不得缓存 oversized input。
10. Assistant output 必须 UTF-8-safe incremental capture：只保留最多 cap 的 **tail**，不得先 buffer full output再截断；每个 chunk 更新 `originalBytes`，截断不得切开 UTF-8 code point，record 保存 `truncated=true`。Output 必须绑定 winning terminal state/evidence hash，conflicting late evidence不得替换。
11. Issuance metadata 使用 generation range/high-water compact records并受 per-Agent generation cap。只有已无 unresolved handle 的最旧 generation可 compact/evict；被移除 generation 的合法旧 handle在当前 epoch查询仍返回 `evicted`，可用一个 bounded contiguous evicted-through generation/sequence watermark表达，不保存逐 handle tombstone。

Resolved reconciliation record 可 oldest-first eviction；unresolved `outcome_unknown` 不得因 cap 被忘记或解除 fence。Router store 是唯一 authoritative copy；AgentProcess local matcher只保留 bounded working state，store update visible 后立即释放重复 payload。

---

### CLAUSE-PROC-SHUTDOWN — Shutdown Model

#### C-020 — Exact ownership, graceful/kill, real exit and settlement order

Spawn success 时 Router 必须 mint unforgeable in-memory `ownershipToken` 并绑定 `{ agentId, processGeneration, childObjectIdentity, pid }`。Signal/kill 前必须同时匹配 lifecycle REAP entry 的 generation、entryId、processRef、ownershipToken、child object 与 original pid。PID 数字单独相等不够；PID reuse、detached child、adopted/external process、未知 process handle 均不得 kill。Ownership mismatch → fail-loud audit + 保持 REAP fence，绝不猜测误杀。

Explicit shutdown：

```text
exact STARTUP|READY entry
→ atomic CAS to exact generation REAP
→ DRAINING / stop admissions / reject queued-not-sent
→ graceful shutdown within remaining shutdownGraceMs (owned child + usable pipe only)
→ grace expiry without real exit: SIGKILL exact owned child once
→ await exact child real exit
```

Fatal C-009 路径跳过 graceful wait并 immediate-kill exact owned child；两种路径最终都必须 await exact real exit。

Child real-exit callback 的 mandatory order：

```text
1. atomically mark exact child exit evidence
2. immediately settle/reject every pending RPC; pending.size = 0
3. freeze input and snapshot parser evidence already received before exit
4. for each active execution without outcome proof: first ensure initial outcome_unknown visible
5. apply C-017 precedence + settle-once late state
   exact parsed outcome -> late_completed | late_failed
   no exact outcome     -> terminated_without_outcome(child_real_exit)
6. CAS/update Router authoritative reconciliation records until visible
7. release local matcher/output copies
8. CAS exact REAP entry -> EMPTY
9. EXITED
```

因此 child exit 绝不等待 handoff 才 reject pending；也绝不先释放 registry/process object再写 reconciliation。若 generation 创建过 child，`shutdown()` 只有在 real exit、pending settlement、authoritative reconciliation visibility 与 exact REAP cleanup 全部完成后 resolve。No-child spawn failure仍只用 `spawn_failed_without_child`。禁止 `{timeout:true}` 假终态。

#### C-021 — Idempotent concurrent stop

并发 shutdown caller 必须共享一个 shutdown promise。重复 stop 不发送多次业务动作；若已 `EXITED`，返回已保存 exit evidence。

#### C-022 — Grace expiry is escalation, not completion

`shutdownGraceMs` 到期只授权 kill，不代表 process 已退出。Kill 后必须 await real exit；若平台无法确认 exit，process 保持 `DRAINING`，不得进入 Registry、不得报告 `EXITED`。

---

### CLAUSE-PROC-SCHEDULER-SEAM — Scheduler Termination Seam (No Scheduler Implementation)

AgentProcess implementation 必须提供 Scheduler 可消费、但不含 Scheduler policy 的通用 seam。

#### 13.1 Snapshot

按 `turnExecutionId` 返回最小 owned snapshot：

```text
{
  turnExecutionId,
  agentId,
  processGeneration,
  callerCorrelation: { occurrenceId, runId, requestId } | null,
  phase: queued | prompt_sending | receipt_pending | running | outcome_unknown | terminal,
  promptReceipt: unknown | accepted | proven_not_accepted,
  initialOutcome: completed | failed | outcome_unknown | null,
  reconciledOutcome: late_completed | late_failed | terminated_without_outcome | null,
  outcomeEvidence: exact_turn_end_success | exact_turn_end_failure | null,
  cancelRequested: boolean,
  cancelRequestedAtWallMs: number | null,
  terminationProven: boolean,
  terminationEvidence: exact_terminal_then_idle | exact_queued_removal | child_real_exit | cancellation_ack | null,
  reconciliationHandle: turnExecutionId,
  finalAssistantOutputAvailable: boolean,
  finalAssistantOutputTruncated: boolean,
  updatedAtWallMs
}
```

#### 13.2 Event

同一 identity 发布 at-most-once state transitions / reconciliation notification。Subscriber 重连或 event 丢失时从 Router authoritative store 重新读取 snapshot；事件不是唯一 truth source。Scheduler restart 使用 exact `(occurrenceId, runId, requestId)` secondary index 恢复 `reconciliationHandle`，随后走同一 non-consuming query；这只是查询恢复 seam，不赋予 Scheduler second admission/retry policy。

#### 13.3 Frozen semantic distinctions

```text
active turn timeout != active turn terminated
cancel requested != proven terminated
child kill requested != child exited
outcome_unknown != failed
late terminal reconciliation != retry
```

Scheduler 可用 seam：

- 判断 active turn 是否有 termination evidence；
- 分开记录 cancel requested 与 proven terminated；
- 对 `outcome_unknown` 等待/查询 `late_completed`、`late_failed` 或 `terminated_without_outcome`；
- 通过 `reconciliationHandle` 调 `readFinalAssistantOutput()` 获取 bounded late final assistant output，而不只得到 availability boolean。

本 Spec 不定义 occurrence identity、retry、same-job fence、Scheduler persistence 或 store mutation；这些继续属于 Scheduler authority。

---

### CLAUSE-PROC-FAILURE-TAXONOMY — Failure Taxonomy

```text
spawn_failed
initialize_timeout
initialize_failed
prompt_write_failed
prompt_receipt_timeout
turn_deadline_exceeded
parent_rpc_timeout
protocol_buffer_overflow
child_error
child_exited
shutdown_grace_expired
```

以上是 failure/evidence class，不自动等于 turn outcome。尤其：

- `prompt_write_failed` 若 admission 不可证明 → `outcome_unknown`；
- `prompt_receipt_timeout` 若 prompt 可能已接受 → `outcome_unknown`；
- `turn_deadline_exceeded` 无 termination proof → `outcome_unknown`；
- `child_exited` 证明 termination，但不必然证明 success/failure。

---

## 10. Acceptance

### 10.1 Stable Contract-to-Acceptance mappings

The detailed V1 acceptance criteria and fault-injection table are carried unchanged in §10.2–§10.3.
Every mapping below uses this common execution contract:

- Method: execute the cited numbered criteria and fault rows against the exact implementation commit.
- Environment: deterministic fault-injection test harness; deployment-equivalent staging where
  configuration/production compatibility is involved.
- Required evidence: the complete machine-readable bundle required by §10.3, including exact commands,
  commit, environment, counters, snapshots, reconciliation result, and unique oracle.
- Expected result: the cited criteria/rows satisfy the mapped Contract.
- Failure condition: any cited unique oracle, count, state, boundary, or evidence field differs or is absent.
- Universal mappings: §10.2 item 28 (exact coordinates), item 37 (complete evidence bundle),
  item 38 (Scheduler code/store change = none), and item 39 (Kernel change = none) apply to
  every `ACC-PROC-*` item and are failure conditions for every mapped Contract/clause.

| Acceptance ID | Contracts | Detailed criteria and exact fault cases |
|---|---|---|
| `ACC-PROC-001` | `C-001` | §10.2 items 7, 26, 31; `INITIALIZE_REQUEST_NEVER_REPLIES`, `PROMPT_RECEIPT_NEVER_REPLIES`, `PARENT_RPC_RESPONSE_WRITE_RESERVE`, `PARENT_RPC_WRITE_EXCEEDS_TOTAL_DEADLINE` |
| `ACC-PROC-002` | `C-002` | §10.2 items 5, 6, 34; `CHILD_EXIT_WITH_MULTIPLE_PENDING_RPC`, `DUPLICATE_CONFLICTING_LATE_EVIDENCE` |
| `ACC-PROC-003` | `C-003` | §10.2 item 5; `CHILD_EXIT_WITH_MULTIPLE_PENDING_RPC` |
| `ACC-PROC-004` | `C-004` | §10.2 item 6; `STDIN_SYNC_THROW_ZERO_BYTE`, `STDIN_ASYNC_WRITE_ERROR`, `STDIN_CLOSE_AFTER_PARTIAL_WRITE` |
| `ACC-PROC-005` | `C-005` | §10.2 items 20, 31; `PARENT_RPC_RESPONSE_WRITE_RESERVE`, `PARENT_RPC_WRITE_EXCEEDS_TOTAL_DEADLINE` |
| `ACC-PROC-006` | `C-006` | §10.2 items 1, 2, 29; `REGISTRY_STARTUP_FATAL_ATOMIC_REAP`, `REGISTRY_READY_FATAL_ATOMIC_REAP`, `CONCURRENT_ENSURE_RUNNING`, `OLD_GENERATION_LATE_EXIT_AFTER_RESPAWN` |
| `ACC-PROC-007` | `C-007` | §10.2 item 3; `CONCURRENT_ENSURE_RUNNING` |
| `ACC-PROC-008` | `C-008` | §10.2 items 4, 29; `SPAWN_ERROR_BEFORE_CHILD_HANDLE`, `REGISTRY_STARTUP_FATAL_ATOMIC_REAP`, `STARTUP_RESULT_REJECTS_WHILE_REAP_WAITS` |
| `ACC-PROC-009` | `C-009` | §10.2 items 1, 4, 24, 30; `REGISTRY_STARTUP_FATAL_ATOMIC_REAP`, `REGISTRY_READY_FATAL_ATOMIC_REAP`, `INITIALIZE_REQUEST_NEVER_REPLIES`, `INITIALIZE_PROVIDER_NEVER_READY`, `STDIN_ASYNC_WRITE_ERROR`, `STDIN_CLOSE_AFTER_PARTIAL_WRITE`, `FATAL_PROTOCOL_FRAME_OVERFLOW` |
| `ACC-PROC-010` | `C-010` | §10.2 items 8, 32; `PROMPT_EVENT_BEFORE_RPC_RESPONSE`, `ENVELOPE_COMPLETED`, `ENVELOPE_FAILED`, `ENVELOPE_NOT_ADMITTED`, `ENVELOPE_OUTCOME_UNKNOWN`, `CALLER_CORRELATION_RESTORE`, `EVENT_RING_WRAP_DURING_ACTIVE_TURN` |
| `ACC-PROC-011` | `C-011` | §10.2 items 9, 10; `PROMPT_EVENT_BEFORE_RPC_RESPONSE`, `PRIOR_TURN_LATE_EVENT_AFTER_NEXT_CALL` |
| `ACC-PROC-012` | `C-012` | §10.2 items 11, 26; `PROMPT_RECEIPT_NEVER_REPLIES`, `DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD` |
| `ACC-PROC-013` | `C-013` | §10.2 items 13, 25; `DELIVER_CANNOT_BYPASS_UNKNOWN_FENCE`, `UNKNOWN_REJECTS_QUEUED_TURNS`, `UNRESOLVED_RECONCILIATION_CAP_PRESSURE`, `ROUTER_GLOBAL_RECONCILIATION_CAP` |
| `ACC-PROC-014` | `C-014` | §10.2 items 12, 18, 26; `ENVELOPE_OUTCOME_UNKNOWN`, `TURN_TIMEOUT_THEN_LATE_SUCCESS`, `TURN_TIMEOUT_THEN_LATE_FAILURE`, `TURN_TIMEOUT_THEN_CHILD_EXIT_NO_TERMINAL` |
| `ACC-PROC-015` | `C-015` | §10.2 item 14; `UNRELATED_IDLE_OR_QUEUE_REMOVAL`, `TURN_TIMEOUT_THEN_CHILD_EXIT_NO_TERMINAL` |
| `ACC-PROC-016` | `C-016` | §10.2 items 14, 17; `UNRELATED_IDLE_OR_QUEUE_REMOVAL`, `DELIVER_CANNOT_BYPASS_UNKNOWN_FENCE` |
| `ACC-PROC-017` | `C-017` | §10.2 items 15–18, 34; `TURN_TIMEOUT_THEN_LATE_SUCCESS`, `TURN_TIMEOUT_THEN_LATE_FAILURE`, `TURN_TIMEOUT_THEN_CHILD_EXIT_NO_TERMINAL`, `PARSED_OUTCOME_PRECEDES_CHILD_EXIT`, `DUPLICATE_CONFLICTING_LATE_EVIDENCE` |
| `ACC-PROC-018` | `C-018` | §10.2 items 19, 24, 33, 35; `QUERY_NO_OUTPUT_REPEATABLE`, `LATE_OUTPUT_AFTER_GENERATION_EXIT`, `EVENT_RING_WRAP_DURING_ACTIVE_TURN`, `STDERR_AND_CREATIONS_OVERFLOW`, `UTF8_OUTPUT_INCREMENTAL_TAIL` |
| `ACC-PROC-019` | `C-019` | §10.2 items 19, 27, 32, 33; `CALLER_CORRELATION_RESTORE`, `QUERY_PENDING_REPEATABLE`, `QUERY_EVICTED_REPEATABLE`, `QUERY_RESTART_LOST_REPEATABLE`, `QUERY_NEVER_EXISTED_REPEATABLE`, `HANDOFF_VISIBLE_BEFORE_RELEASE` |
| `ACC-PROC-020` | `C-020` | §10.2 items 1, 21, 22, 30, 36; `CHILD_EXIT_WITH_MULTIPLE_PENDING_RPC`, `GRACEFUL_SHUTDOWN_SUCCESS`, `SHUTDOWN_GRACE_EXPIRES_THEN_KILL`, `SHUTDOWN_OWNERSHIP_MISMATCH`, `CONCURRENT_SHUTDOWN` |
| `ACC-PROC-021` | `C-021` | §10.2 item 23; `CONCURRENT_SHUTDOWN` |
| `ACC-PROC-022` | `C-022` | §10.2 item 22; `SHUTDOWN_GRACE_EXPIRES_THEN_KILL` |

Every clause anchor is covered through its exact parent Contract mappings:

| Stable clause anchor | Acceptance IDs |
|---|---|
| `CLAUSE-PROC-LIFECYCLE` | `ACC-PROC-006`, `ACC-PROC-008`, `ACC-PROC-009`, `ACC-PROC-020` |
| `CLAUSE-PROC-DEADLINE-CONFIG` | `ACC-PROC-001`, `ACC-PROC-005`, `ACC-PROC-012`, `ACC-PROC-014`, `ACC-PROC-020`, `ACC-PROC-022` |
| `CLAUSE-PROC-RPC` | `ACC-PROC-001`, `ACC-PROC-002`, `ACC-PROC-003`, `ACC-PROC-004`, `ACC-PROC-005` |
| `CLAUSE-PROC-REGISTRY` | `ACC-PROC-006`, `ACC-PROC-007`, `ACC-PROC-008`, `ACC-PROC-009` |
| `CLAUSE-PROC-ADMISSION` | `ACC-PROC-010`, `ACC-PROC-011`, `ACC-PROC-012`, `ACC-PROC-013` |
| `CLAUSE-PROC-OUTCOME` | `ACC-PROC-014`, `ACC-PROC-015`, `ACC-PROC-016` |
| `CLAUSE-PROC-RECONCILIATION` | `ACC-PROC-017`, `ACC-PROC-018`, `ACC-PROC-019` |
| `CLAUSE-PROC-BOUNDED` | `ACC-PROC-002`, `ACC-PROC-009`, `ACC-PROC-013`, `ACC-PROC-018`, `ACC-PROC-019` |
| `CLAUSE-PROC-SHUTDOWN` | `ACC-PROC-020`, `ACC-PROC-021`, `ACC-PROC-022` |
| `CLAUSE-PROC-SCHEDULER-SEAM` | `ACC-PROC-010`, `ACC-PROC-015`, `ACC-PROC-016`, `ACC-PROC-018`, `ACC-PROC-019` |
| `CLAUSE-PROC-FAILURE-TAXONOMY` | `ACC-PROC-003`, `ACC-PROC-004`, `ACC-PROC-009`, `ACC-PROC-012`, `ACC-PROC-014`, `ACC-PROC-017`, `ACC-PROC-020`, `ACC-PROC-022` |


### 10.2 Carried future implementation acceptance criteria

本轮不实现。未来 implementation 至少证明：

1. state transition 只走 legal graph；created child 必须 real exit，no-child spawn failure 使用 exact terminal evidence；
2. Registry 永远只返回 `READY`；
3. 30 个 concurrent `ensureRunning` → one spawn + one shared startup resultPromise；
4. initialize timeout → startup callers在 initialize deadline bounded reject；created child立即 kill并由 reap fence阻止新 generation，real exit 后 cleanup；
5. child `error` / `exit` → all pending reject，pending size 0，且 error/exit code不混淆；
6. stdin sync throw / callback error / close → request reject，无 leaked waiter；
7. every RPC has monotonic absolute total deadline，retry 不重置；wall clock只用于 audit；
8. 所有 prompt-producing path 的 watermark sequence 在 prompt write 前建立；
9. response 前到达的 receipt event 仍可正确关联；
10. prior-turn late event 不污染 current turn；
11. prompt receipt timeout 且 admission unknown → `outcome_unknown`；
12. active turn timeout 且 child继续 → `outcome_unknown` + same-process fence；
13. unknown 后 `turn()` / `deliver()` / Scheduler bridge 等所有 prompt path write count = 0；queued callers structured reject；
14. exact outcome evidence 与 termination evidence 独立测试；unrelated idle/removal 不能解除 fence；
15. late success → `late_completed` + final output reconciliation event；
16. late failure → `late_failed`；
17. child exit无 exact terminal → `terminated_without_outcome`；
18. timeout/user message automatic replay count = 0；
19. late output 在 child respawn 后仍可经 reconciliation handle读取，resolved eviction行为与 counters符合 contract；
20. parent-RPC timeout最多一个 wire response、不自动 re-invoke；late side effect unknown不误报；
21. graceful stop success → active unknown reconciliation/handoff + real exit before `EXITED`；
22. grace expiry → SIGKILL exactly once + await real exit；
23. concurrent shutdown shares one promise；
24. events/stderr/creations/stdout frames/pending/reconciliation/outputs/queued prompt 的 count 与 byte state 均不超过 cap；
25. unresolved unknown 不因 eviction 解除 fence；
26. legacy `DSH_AGENT_TURN_TIMEOUT=900000` compatibility生效；legacy deliver timeout只映射 promptReceiptTimeoutMs；
27. Scheduler seam 分开 outcome evidence / cancel requested / termination proven / reconciled outcome；
28. exact commit、environment、fault injection command、result evidence；
29. lifecycle slot 的 STARTUP/READY→REAP 与 REAP→EMPTY 全部 generation/entry/process/ownership CAS；real exit前 slot从不暂时 EMPTY；
30. 每个 fatal fixture 都证明 stop admission、queue/pending reject、exact REAP、defined kill policy、exact real exit；
31. parent-RPC handler + response write 共享一个 absolute deadline并有固定 response reserve；response write best-effort且 attempt≤1；
32. all outcome envelopes与 handle propagation contract一致；Scheduler triple可恢复同一 handle且不产生新 admission；
33. Router store 是唯一 query authority；handoff前后无 not_found 空窗；五种 absence/output semantics与 repeated reads一致；
34. all unknown sources进入一个 settle-once machine；parsed outcome precedence、duplicate/conflict audit通过；
35. reconciliation/output 的 per-record/per-Agent/global count+byte caps与 UTF-8 incremental tail通过；
36. shutdown/kill只命中 exact Router-owned generation；ownership mismatch kill count=0；child exit先 pending settlement再 reconciliation visibility；
37. §10.3 每个 fault case 都输出完整 evidence schema、唯一 oracle、exact counts/snapshots/final reconciliation；
38. Scheduler code/store change = none for AgentProcess implementation PR；
39. Kernel change = none。

### 10.3 Fault-injection crosswalk and evidence schema

每个 acceptance case 必须输出同一 machine-readable evidence bundle；缺任一字段即 case FAIL：

```text
{
  fixture,
  injection,
  action,
  uniqueOracle,
  counts: {
    spawnAttempts,
    promptWriteAttempts,
    rpcResponseWriteAttempts,
    gracefulShutdownWriteAttempts,
    killSignals,
    replayAdmissions
  },
  snapshots: {
    registryBefore, registryAtFault, registryBeforeRealExit, registryAfter,
    pendingBefore, pendingAfter,
    fenceBefore, fenceAfter
  },
  reconciliation: { handle, initial, final, outputState, audit },
  exactCommands,
  commit,
  environment
}
```

表中 `S/W/K/R` 分别是 `spawnAttempts / promptWriteAttempts / killSignals / replayAdmissions` 的唯一 exact total；被 fence 的额外请求必须由 unique oracle 单独断言其 prompt-write delta=0。每行 evidence bundle 还必须给出 exact `rpcResponseWriteAttempts` 与 `gracefulShutdownWriteAttempts`（通常为 0；Parent-RPC / shutdown rows 的 unique oracle明确为 1），不得把不同 write type 混成无法归因的总数。`REAP(g)` 必须包含 generation/entry/process/ownership identity；`Ø` 表示 exact slot EMPTY；`N/A` 只允许确实不存在该 observation phase。

Snapshot cell 必须严格使用：

```text
R[registryBefore,registryAtFault,registryBeforeRealExit,registryAfter];
P[pendingBefore,pendingAfter];
F[fenceBefore,fenceAfter]
```

无 real-exit phase 时 `registryBeforeRealExit=N/A`；metadata-only Router-store fixture 未创建 lifecycle slot 时四个 registry 字段均可 `N/A`；无 turn handle 时 fence 值为 `N/A`。除此之外不得省略字段，不得用 `stable`、`unchanged`、`n`、`per turn` 等未量化缩写。

| Case | Fixture | Injection | Action | Unique oracle | S/W/K/R | Exact snapshots | Final reconciliation |
|---|---|---|---|---|---|---|---|
| `SPAWN_ERROR_BEFORE_CHILD_HANDLE` | slot Ø | spawn sync throw before child object | `ensureRunning` | `spawn_failed_without_child`; no ownership token | `1/0/0/0` | `R[Ø,STARTUP(g),N/A,Ø];P[0,0];F[N/A,N/A]` | `N/A` |
| `REGISTRY_STARTUP_FATAL_ATOMIC_REAP` | STARTUP(g), owned child, one initialize pending | initialize fatal at CAS barrier | race 20 ensure calls, release exit | no Ø before exit; all racers error/reaping | `1/0/1/0` | `R[STARTUP(g),REAP(g),REAP(g),Ø];P[1,0];F[N/A,N/A]` | `N/A` |
| `REGISTRY_READY_FATAL_ATOMIC_REAP` | READY(g), no active turn | fatal stream error with concurrent ensure | invoke fatal, ensure, release exit | no g+1 before g exit | `1/0/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[0,0];F[N/A,N/A]` | `N/A` |
| `INITIALIZE_REQUEST_NEVER_REPLIES` | STARTUP(g), initialize pending | RPC blackhole | advance deadline, release exit | shared result rejects once | `1/0/1/0` | `R[STARTUP(g),REAP(g),REAP(g),Ø];P[1,0];F[N/A,N/A]` | `N/A` |
| `INITIALIZE_PROVIDER_NEVER_READY` | STARTUP(g), no pending between retries | provider absent until deadline | advance without reset, release exit | elapsed bounded by one total deadline | `1/0/1/0` | `R[STARTUP(g),REAP(g),REAP(g),Ø];P[0,0];F[N/A,N/A]` | `N/A` |
| `STARTUP_RESULT_REJECTS_WHILE_REAP_WAITS` | REAP(g), kill sent, exit held | hold exit | assert callers, then release exit | bounded original reject + immediate reaping reject | `1/0/1/0` | `R[REAP(g),REAP(g),REAP(g),Ø];P[0,0];F[N/A,N/A]` | `N/A` |
| `CHILD_EXIT_WITH_MULTIPLE_PENDING_RPC` | READY(g), 8 non-turn pending | exact real exit | observe callback | all 8 reject before store hook | `1/0/0/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[8,0];F[N/A,N/A]` | `N/A` |
| `STDIN_SYNC_THROW_ZERO_BYTE` | READY(g) | zero-byte sync throw | prompt | stable handle + not_admitted | `1/1/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[false,false]` | `not_admitted`; output=`no_output` |
| `STDIN_ASYNC_WRITE_ERROR` | READY(g) | async error, admission unknown | prompt, release exit | initial unknown visible pre-exit | `1/1/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[false,false]` | `outcome_unknown→terminated_without_outcome` |
| `STDIN_CLOSE_AFTER_PARTIAL_WRITE` | READY(g) | partial frame then close | prompt, release exit | no not_admitted/no replay | `1/1/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[false,false]` | `outcome_unknown→terminated_without_outcome` |
| `FATAL_PROTOCOL_FRAME_OVERFLOW` | READY(g), one active, no terminal | oversized stdout frame | overflow, release exit | immediate teardown; buffer capped | `1/1/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[false,false]` | `outcome_unknown→terminated_without_outcome` |
| `PROMPT_EVENT_BEFORE_RPC_RESPONSE` | READY(g) | events precede response | exact success+idle | one watermark/handle correlation | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[1,0];F[false,false]` | `completed`; output=`available` |
| `PROMPT_RECEIPT_NEVER_REPLIES` | READY(g) | response blackhole | receipt deadline, fatal kill, exit | handle query unknown before kill | `1/1/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[false,false]` | `outcome_unknown→terminated_without_outcome` |
| `DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD` | READY(g) | late receipt then exact success | deadline, success+idle | deadline is promptReceiptTimeoutMs | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[1,0];F[false,false]` | `outcome_unknown→late_completed` |
| `DELIVER_CANNOT_BYPASS_UNKNOWN_FENCE` | READY(g), original unknown | second deliver, then original success | call second, emit success+idle | second write delta=0 | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[true,false]` | original=`late_completed`; second=`not_admitted` |
| `PARENT_RPC_RESPONSE_WRITE_RESERVE` | READY(g), active parent RPC | handler deadline; timeout write succeeds | advance, complete turn | `rpcResponseWriteAttempts=1` inside reserve | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[1,0];F[false,false]` | `completed`; responseWrite=`sent` |
| `PARENT_RPC_WRITE_EXCEEDS_TOTAL_DEADLINE` | READY(g), active parent RPC | late handler + backpressure | advance, success+idle | `rpcResponseWriteAttempts=1`; no post-deadline write | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[1,0];F[false,false]` | `completed`; responseWrite=`unknown`; sideEffect=`unknown` |
| `TURN_TIMEOUT_THEN_LATE_SUCCESS` | READY(g), active | late success | deadline then success+idle | settlement=`late_completed` | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `outcome_unknown→late_completed`; output=`available` |
| `TURN_TIMEOUT_THEN_LATE_FAILURE` | READY(g), active, no output | late failure | deadline then failure+idle | settlement=`late_failed` | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `outcome_unknown→late_failed`; output=`no_output` |
| `TURN_TIMEOUT_THEN_CHILD_EXIT_NO_TERMINAL` | READY(g), unknown | real exit | exit callback | pending-first; no outcome proof | `1/1/0/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[true,false]` | `outcome_unknown→terminated_without_outcome` |
| `PARSED_OUTCOME_PRECEDES_CHILD_EXIT` | READY(g), parsed success, store paused | real exit | release serialization | parsed success wins | `1/1/0/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[true,false]` | `outcome_unknown→late_completed` |
| `DUPLICATE_CONFLICTING_LATE_EVIDENCE` | READY(g), already late_completed | duplicate success + failure | feed both | state/output unchanged; two audits | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `late_completed`; audit=`duplicate_ignored,conflict_ignored` |
| `UNRELATED_IDLE_OR_QUEUE_REMOVAL` | READY(g), unknown A, queued B | unrelated evidence, then A failure | emit both | unrelated evidence leaves A fenced | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[true,false]` | A=`outcome_unknown→late_failed` |
| `UNKNOWN_REJECTS_QUEUED_TURNS` | READY(g), A active, B/C queued | A timeout then late success | settle queue, success+idle | B/C write delta=0 | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | A=`late_completed`; B/C=`not_admitted` |
| `PRIOR_TURN_LATE_EVENT_AFTER_NEXT_CALL` | READY(g), A settled, B active | duplicate A during B | B success+idle | B excludes A; A audit only | `1/2/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | A unchanged; B=`completed` |
| `ENVELOPE_COMPLETED` | READY(g) | exact success+idle | prompt | completed envelope has stable handle | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `completed`; handle query=`settled` |
| `ENVELOPE_FAILED` | READY(g) | exact failure+idle | prompt | failed envelope has stable handle | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `failed`; handle query=`settled` |
| `ENVELOPE_NOT_ADMITTED` | metadata-only invalid input | validation fail before reservation | prompt API call | closed not_admitted envelope, handle=null | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[N/A,N/A]` | `not_admitted(handle=null)` |
| `ENVELOPE_OUTCOME_UNKNOWN` | READY(g) | hold terminal past deadline | prompt, advance deadline | unknown envelope always has queryable handle | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,true]` | `outcome_unknown`; handle query=`pending` |
| `CALLER_CORRELATION_RESTORE` | metadata-only pending record + triple | discard in-memory handle | resolve triple | exact same handle; no admission | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[true,true]` | `pending` |
| `QUERY_PENDING_REPEATABLE` | metadata-only unresolved record | two reads | query | byte-identical, non-consuming | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[true,true]` | `pending` |
| `QUERY_NO_OUTPUT_REPEATABLE` | metadata-only settled failed record | two output reads | query | byte-identical, non-consuming | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[false,false]` | `no_output` |
| `QUERY_EVICTED_REPEATABLE` | metadata-only issued+evicted handle | two reads | query | byte-identical, non-consuming | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[N/A,N/A]` | `evicted` |
| `QUERY_RESTART_LOST_REPEATABLE` | metadata-only old runtimeEpoch handle | two reads | query | byte-identical, non-consuming | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[N/A,N/A]` | `restart_lost` |
| `QUERY_NEVER_EXISTED_REPEATABLE` | metadata-only unissued current-epoch handle | two reads | query | byte-identical, non-consuming | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[N/A,N/A]` | `never_existed` |
| `HANDOFF_VISIBLE_BEFORE_RELEASE` | READY(g), active unknown | exit; pause after store CAS | query both sides, release | never not_found | `1/1/0/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[true,false]` | `outcome_unknown→terminated_without_outcome` continuously visible |
| `LATE_OUTPUT_AFTER_GENERATION_EXIT` | READY(g), late_completed output | graceful real exit | repeat output read | identical Router-store output | `1/1/0/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[0,0];F[false,false]` | `late_completed`; output=`available` |
| `GRACEFUL_SHUTDOWN_SUCCESS` | READY(g), no active turn | ack + real exit | shutdown | `gracefulShutdownWriteAttempts=1`; kill=0; order exact | `1/0/0/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[0,0];F[N/A,N/A]` | `N/A` |
| `SHUTDOWN_GRACE_EXPIRES_THEN_KILL` | READY(g), active unknown | ignore graceful | advance grace, exit | `gracefulShutdownWriteAttempts=1`; exact owned SIGKILL once | `1/1/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[1,0];F[true,false]` | `outcome_unknown→terminated_without_outcome` |
| `SHUTDOWN_OWNERSHIP_MISMATCH` | metadata-only REAP(g), active unknown, one pending | token mismatch | shutdown | gracefulShutdownWriteAttempts=0; kill=0; REAP retained | `0/0/0/0` | `R[REAP(g),REAP(g),REAP(g),REAP(g)];P[1,0];F[true,true]` | `outcome_unknown` remains pending; ownership audit |
| `CONCURRENT_SHUTDOWN` | READY(g), no active turn, ignores graceful | 20 callers | advance grace, exit | one promise; `gracefulShutdownWriteAttempts=1`; one kill | `1/0/1/0` | `R[READY(g),REAP(g),REAP(g),Ø];P[0,0];F[N/A,N/A]` | `N/A` |
| `EVENT_RING_WRAP_DURING_ACTIVE_TURN` | READY(g), active near cap | overflow ring, exact success | complete | sequence matcher succeeds | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `completed`; output=`available` |
| `STDERR_AND_CREATIONS_OVERFLOW` | READY(g), no turn | oversized records | inspect | caps + counters exact | `1/0/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[N/A,N/A]` | `N/A` |
| `UTF8_OUTPUT_INCREMENTAL_TAIL` | READY(g), active | multibyte output > cap | success+idle | valid UTF-8 tail/originalBytes | `1/1/0/0` | `R[READY(g),READY(g),N/A,READY(g)];P[0,0];F[false,false]` | `completed`; truncated=true; terminal hash bound |
| `UNRESOLVED_RECONCILIATION_CAP_PRESSURE` | metadata-only per-Agent cap full | new prompt | admit attempt | fail pre-reservation/write; no eviction | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[true,true]` | existing unknowns unchanged; new=`not_admitted(handle=null)` |
| `ROUTER_GLOBAL_RECONCILIATION_CAP` | metadata-only global cap full | prompt on another Agent | admit attempt | fail pre-reservation/spawn/write | `0/0/0/0` | `R[N/A,N/A,N/A,N/A];P[0,0];F[N/A,N/A]` | existing records unchanged; new=`not_admitted(handle=null)` |
| `CONCURRENT_ENSURE_RUNNING` | slot Ø | 30 calls | release spawn barrier | one STARTUP/pid/READY ref | `1/0/0/0` | `R[Ø,STARTUP(g),N/A,READY(g)];P[0,0];F[N/A,N/A]` | `N/A` |
| `OLD_GENERATION_LATE_EXIT_AFTER_RESPAWN` | harness creates/kills g, then starts g+1 | replay g exit callback | invoke stale callback | g+1 unchanged; audit only | `2/0/1/0` | `R[READY(g+1),READY(g+1),N/A,READY(g+1)];P[0,0];F[N/A,N/A]` | `N/A` |

每个 table row 的 counters 从该 case harness reset 开始；标为 READY/STARTUP 的 fixture 除非明确写 metadata-only seeded，必须通过表中计数的真实 spawn 建立。每个 counter 都是唯一 exact integer。Unique oracle必须是单一 machine assertion，不接受“日志看起来正确”。

### 10.4 Historical V1 amendment closure crosswalk (provenance only; not V2 review/acceptance)

| Required fix | Normative closure |
|---:|---|
| 1 | C-006–C-009 single tagged lifecycle slot；STARTUP/READY→REAP atomic CAS；identity-CAS cleanup；no pre-exit EMPTY window |
| 2 | C-009 exhaustive fatal source + mandatory DRAINING teardown primitive + explicit immediate/graceful kill policy + exact exit await |
| 3 | C-005 one absolute deadline、fixed response-write reserve algorithm、best-effort write、no fifth config/no reset |
| 4 | C-010 pre-write stable handle、closed envelopes、unknown handle mandatory、Scheduler triple secondary index/recovery |
| 5 | C-018 Router store sole authority、pre-visible record、non-consuming reads、no handoff gap、five query/output absence semantics |
| 6 | C-017 all-source unknown、mutually exclusive settle-once、parsed evidence precedence、duplicate/conflict audit-only |
| 7 | `CLAUSE-PROC-BOUNDED` per-record/per-Agent/global count+bytes、unresolved non-evict、capacity fail-loud、UTF-8 incremental tail |
| 8 | C-020 exact ownership token/generation、no external kill、exit pending-first order、unknown before final reconciliation |
| 9 | §10.3 fixture/injection/action/unique oracle/exact S-W-K-R/snapshots/final reconciliation crosswalk |

```text
REPLACED_V1_REQUIRED_FIXES_CLOSED = 9/9
REPLACED_V1_PREVIOUSLY_PASSED_ITEMS_REGRESSION = NONE
```

---

## 11. Alternatives and disposition

#### timeout = ordinary failed

拒绝。停止等待不证明 turn 或副作用停止。

#### timeout 后自动重发用户消息

拒绝。原 turn 可能仍运行且可能已产生非幂等外部副作用。

#### unknown 时继续同 process 新 turn

拒绝。会与未知旧执行重叠，并污染 binding context、event attribution 与外部副作用顺序。

#### Registry 暴露 initializing process

拒绝。Caller 可能在 ready 前调用业务方法，并发启动不能共享完整 startup result。

#### 单一通用 timeout

拒绝。initialize、prompt receipt、active turn、shutdown grace 的起点和失败语义不同。

#### per-message / Scheduler dynamic timeout override

拒绝。deadline 属于 AgentProcess deployment config，不属于消息、Session 或 Scheduler。

#### shutdown grace 到期即返回 timeout 终态

拒绝。grace expiry 只触发 kill；必须 await real exit。

#### 无限 evidence buffer

拒绝。常驻 per-Agent process 必须有明确 memory ceiling 和 truncation evidence。

#### 把 timeout overrides 写入 AgentDefinition

拒绝。AgentDefinition 保持 identity/display-only；process config 使用独立 deployment-owned static file。

---

## 12. Migration, compatibility, and rollback

### 12.1 Authority transition status

No implementation or runtime migration occurs in this docs-only convergence. The historical acceptance-finalize plan in §0.3 was executed and merged by authority merge `12375d6282ede5015088a7d7f5495d6f46ca7738`: V2 is accepted/current and V1 is superseded. This authority transition does not claim implementation completion or production rollout.

### 12.2 Compatibility preserved from V1

V2 carries unchanged the existing compatibility obligations in `CLAUSE-PROC-DEADLINE-CONFIG`:

- legacy `DSH_AGENT_TURN_TIMEOUT` continues to map only to `turnTimeoutMs` when the new variable is absent；
- legacy `DSH_AGENT_DELIVER_TIMEOUT` continues to map only to `promptReceiptTimeoutMs` when the new variable is absent；
- current production `DSH_AGENT_TURN_TIMEOUT=900000` remains effective during any future rollout；
- no fifth timeout field, per-message override, Scheduler override, Session-model change, Router-product-policy change, or Kernel change is introduced。

### 12.3 Rollback

Implementation rollback behavior: Not applicable to this docs-only authority transition because V1 defined no implementation rollback Contract and this replacement introduces none. The historical non-acceptance path would have left V1 unchanged; it is not the current lifecycle state. This section imposes no requirement on future implementation rollback.

---

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Any future change to Scheduler occurrence/retry policy, Product Surface late delivery, cancellation
semantics, peer-Agent security domain, or DSH Kernel behavior requires its own governing authority and is
not an open implementation choice under this Spec.

---

## 14. Spec Review Gate

Independent reviewer 必须确认：

- 五态 lifecycle 完整且 failure cleanup 不跳过 `DRAINING`；
- 四个 timeout 字段独立、static、owner 正确；
- 当前 `DSH_AGENT_TURN_TIMEOUT=900000` 兼容边界未被改变；
- 所有 RPC 有 total deadline；
- child exit/error 与 stdin failure 不泄漏 pending；
- Registry ready-only + shared startup resultPromise + nonblocking reap fence；
- ready failure bounded caller reject、kill、created-child real exit + cleanup；
- all prompt paths watermark before prompt send + exact receipt correlation；legacy deliver timeout无第五字段；
- outcome evidence与termination evidence分离且可执行；
- timeout unknown fence、no replay、late reconciliation 完整；
- final assistant output 有明确 handle/query/retention/eviction contract，且 AgentProcess 不越权自行向 Product Surface 发消息；
- shutdown 必须先 reconciliation/handoff，再以 created-child real exit或no-child terminal evidence收口；
- 所有长期 state 同时有 count/byte bound；
- Scheduler 只有 termination/query recovery seam，没有 implementation或 occurrence policy；
- historical V1 amendment 9 项 closure crosswalk 与 §10.3 acceptance evidence逐项可验证；
- 本轮 docs-only，无 production、Scheduler、timeout mitigation、Kernel、merge 变化。

Review 输出：

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V2_SPEC_REVIEW = PASS | FIX_REQUIRED
REQUIRED_FIXES = [...]
VERDICT = READY_TO_ACCEPT | NOT_READY
```

Review recommendation 不自动等于 acceptance；status flip 由 authorized Owner / maintainer 完成。

---

## 15. Final Output

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V2_SPEC = PASS
REPLACEMENT_AUTHORING = PASS
REPLACEMENT_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY

AUTHORING_BASE_MAIN = 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
REPLACED_V1_SPEC_ID = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
REPLACED_V1_AUTHORITY_REVISION = 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
REPLACED_V1_ACCEPTANCE_REVIEWED_HEAD = 8475318f12068a28fe937779c91735817b6db9ca
REPLACED_V1_REQUIRED_FIXES_CLOSED = 9/9
REPLACED_V1_PREVIOUSLY_PASSED_ITEMS_REGRESSION = NONE

PROCESS_STATE_MACHINE = SPAWNING -> INITIALIZING -> READY -> DRAINING -> EXITED
TIMEOUT_CONFIG_MODEL = initializeTimeoutMs,promptReceiptTimeoutMs,turnTimeoutMs,shutdownGraceMs; global defaults + optional static per-Agent override

CHILD_EXIT_PENDING_RPC = REJECT_ALL_AND_CLEAR
REGISTRY_READY_MODEL = SINGLE_LINEARIZABLE_SLOT + READY_ONLY_VIEW + SHARED_STARTUP_RESULT + ATOMIC_GENERATION_BOUND_REAP_FENCE
WATERMARK_MODEL = MONOTONIC_EVENT_SEQUENCE_BEFORE_PROMPT_SEND + EXACT_RECEIPT_MESSAGE_ID

TURN_DEADLINE_OUTCOME = outcome_unknown_without_termination_proof
NEW_TURN_AFTER_OUTCOME_UNKNOWN = FORBIDDEN_ON_SAME_AGENTPROCESS_UNTIL_LATE_TERMINAL_OR_PROVEN_TERMINATION
LATE_TERMINAL_RECONCILIATION = ALL_UNKNOWN_SOURCES -> SETTLE_ONCE(late_completed | late_failed | terminated_without_outcome)
LATE_REPLY_DELIVERY = RETAIN_AND_EXPOSE_VIA_ORIGINAL_CALLER_RECONCILIATION_HANDLE; AUTOMATIC_UNSOLICITED_PRODUCT_SURFACE_DELIVERY=NO

SHUTDOWN_MODEL = exact_router_owned_generation_only + atomic_REAP + graceful_or_immediate_kill_policy + await_real_exit + pending_first + authoritative_reconciliation_visible + identity_CAS_cleanup
BOUNDED_BUFFERS = per_record + per_Agent + Router_global count_and_byte_caps; unresolved_non_evict; UTF8_incremental_tail

SCHEDULER_TERMINATION_SEAM = active_turn_snapshot + stable_reconciliationHandle + occurrence/run/requestId_restore_index + outcome_evidence_distinct_from_termination_evidence + cancel_requested_distinct_from_termination_proven

SPEC_STATUS = accepted
ACTIVE_AUTHORITY_ON_MAIN = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
IMPLEMENTATION_AUTHORITY = contracts
CURRENT_SUPERSEDES = [AGENT_PROCESS_LIFECYCLE_HARDENING_V1]
V1_CURRENT_STATUS = superseded
ATOMIC_WHOLE_AUTHORITY_SUPERSESSION_PLAN_PREPARED = YES
ATOMIC_WHOLE_AUTHORITY_SUPERSESSION_EXECUTED = YES (2026-08-21)
AUTHORITY_MERGE = 12375d6282ede5015088a7d7f5495d6f46ca7738
CURRENT_MAIN_COMPATIBILITY_HEAD = b312ef88532d2750e6df95a8ef2e4a83284b9562
PRESERVE_PROVIDER_ENV_PROXY_SEAM = YES
PRESERVE_AGENT_CHILD_TMPDIR_SEAM = YES
V2_AUTHORITY_OVER_PROVIDER_PROXY = NONE
V2_AUTHORITY_OVER_AGENT_CHILD_TMPDIR = NONE
IMPLEMENTATION_STATE = NOT_STARTED
PRODUCTION_ROLLOUT_STATE = NOT_STARTED
AUTHORITY_CONFORMANCE_AUDIT = FIX_REQUIRED_UNTIL_THIS_CONVERGENCE_IS_INDEPENDENTLY_REVIEWED_AND_MERGED
IMPLEMENTATION_ALLOWED_TO_START = NO
CONTRACT_SEMANTIC_CHANGE = NONE
IMPLEMENTATION_SCOPE_CHANGE = NONE
ACCEPTANCE_CRITERIA_CHANGE = NONE
HISTORICAL_WHOLE_AUTHORITY_ACCEPTANCE_FINALIZE_CLAIM = PASS (2026-08-21)
REVIEWED_BASE_COMMIT = 79cc8e861cbb16755370b0e9f30ef3fb47c56fa6
REVIEWED_SPEC_COMMIT = 08c041c3ad11bab6b1632b24103b40b2d698dfdf
HISTORICAL_PR28_REVIEW_CLAIM = PASS
PERSISTENT_INDEPENDENT_REVIEW_PROVENANCE_AT_MERGE = INCOMPLETE
POST_MERGE_INDEPENDENT_AUTHORITY_AUDIT = FIX_REQUIRED
ACCEPTANCE_FINAL_HEAD_RECHECK = INVALID
SEMANTIC_CHANGE_FROM_REVIEWED_HEAD = NONE

IMPLEMENTATION_STARTED = NO
PRODUCTION_CHANGE = NONE
DSH_AGENT_TURN_TIMEOUT_900000_CHANGE = NONE
SCHEDULER_CHANGE = NONE
KERNEL_CHANGE = NONE
CONVERGENCE_MERGE = NO
```
