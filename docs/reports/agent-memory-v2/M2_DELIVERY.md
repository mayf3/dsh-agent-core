# #1248 M2 — protocol migration candidate delivery

Status: **M2_COMPLETE_SOURCE_ONLY_ON_SYNTHETIC_COPIES**. Date: 2026-10-31 (Asia/Shanghai).

## Authority, mandate and coordinates

- Accepted governing Spec: `AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2` @ `e93422808729c7c76982eb2c8853051e0b6d3801`, §§3,7.1 M2,7.2,9,10; unchanged blob `b588ec5e0d1cc3ec3dda8e2d637500c206b1ca0a`.
- Execution mandate: Owner's current #1248 M2 task, fixed new branch, ledger on owned copies, lossless explicit-entry edits, no production/session/credential access; independent review; open PR and post delivery comment, no merge.
- Authority action `REUSE`; plan `EXEC_PLAN`; assurance `DURABLE`; implementation authorized, production operation not authorized. No new/amended Spec or product contract.
- Integration base and fresh remote main readback: `383c14dbe7e39f2c23f80c0c9edd9adb3adab46e` (2026-10-31). Local `main` is not used as authority coordinates.
- Branch: `ac-task/1248-m2-protocol-migration`; worktree: `/Users/yanfenma/workspace/project/dsh-agent-core/.worktree/ac-task-1248-m2-protocol-migration`.
- Independently reviewed semantic HEAD: `0c59a9f9bea7b39a8e8ee58f973b23e717cda06a`. Subsequent delivery commits add only this report, executed evidence and synthetic copy fixtures.
- Supporting [execution plan](../../superpowers/plans/2026-10-31-1248-m2-protocol-migration.md); all implementation and test effects are source-only/owned synthetic.

## Exact formal baseline alignment

#593 was merged into main, but #594 was merged into its stacked Spec branch. GitHub #594 reports base `ac-task/1248-mem-gov-spec-accepted` @ `e9342280`, head `26c7363a`, merge `476ab1b5`. Neither `26c7363a` nor `476ab1b5` was an ancestor of integration base; the package tree had no subsequent changes since the common Spec base.

Task commit `55334941b2dbde41f0f9c59543e6f8f28281a0d8` merges the exact already-accepted M1 tree into this candidate. The PR therefore includes an inherited M1 25-file baseline delta as well as M2; it must not claim those files were already on main. No M1 repair was reimplemented. `codec.js`, `memory.js`, `index.js`, `tools.js`, and `paths.js` remain byte-identical to `26c7363a` (git diff rc=0): Source inverse escaping, field/content/render size guards, fsync, mode/uid/gid preservation and assembly protection are retained. Installed/loaded state was not inspected or claimed.

Aligned M1 baseline ran **110/110 PASS**. Fresh worktree tests initially failed to start for absent `@agent-core/workspace-bootstrap`; local package and installed-library code links fixed setup. No production profile/package/runtime was modified.

## Implemented M2 behavior

- `document.js` supplies original owned bytes, exact entry/preserved spans, coverage, source/entry hashes and conservative write eligibility. Existing `inspect.js` reexports the compatible read API plus edit/rollback planners. UTF-8 and CRLF bytes, preambles, maintenance notes, unknown sections and original separators survive exactly.
- `planDocumentEdits` supports hash-bound UPDATE fields/body and DELETE on an explicit entry. Changes splice only the selected ranges; DELETE retains its separator. Equivalent content is byte-NOOP without timestamp churn. It never renders/rebuilds the full document. Unknown inner headings, duplicate IDs, missing separators, malformed metadata/tags/escapes and unsafe rewrite structure produce `READ_ONLY_FORMAT`, with retained operations and no published candidate. Preimage drift is `CONFLICT`.
- `planDocumentRollback` is a pure candidate operation, bound to the exact planned postimage. Later bytes return `CONFLICT` with those bytes retained. It does not overwrite files or restore an archive over newer core.
- `createMigrationCopy` consumes already-authorized bytes and creates an **absent** destination only, below an existing real caller-owned parent. It copies core unchanged, mode 0400 on this host, and creates protocol-only `memory/.agent-memory-v2/{manifest,checkpoint,transactions}`. Manifest is `MIGRATION_COPY`, writer inactive, no owner epoch, no history activation; checkpoint/event generation/cursor remain UNKNOWN/null, not fabricated from historical facts. Proposals/candidates are separate files, never current facts. Storage is bounded at 64MiB.
- Newly created parent/core/ledger ancestry is pinned with `O_DIRECTORY|O_NOFOLLOW` directory handles and identity checks before/after descendant creation and writing; files use exclusive nofollow opens, file fsync and pinned-directory fsync. Incomplete copies remain evidence and cannot return successful creation. This is the specified cooperative caller-owned-directory protocol, not atomic CAS against arbitrary same-UID external editors.
- Administrative CLI: `node packages/agent-memory/src/migration-cli.js --config /absolute/reviewed.json`; defaults to pure dry-run. `--create-copy` explicitly creates a new copy. Config requires `reviewed:true` and either synthetic `sourceText` or an explicitly reviewed owned `sourceRoot` with exactly its direct `MEMORY.md`. Inputs are bounded regular nofollow files. No globs, automatic environment workspace fallback, session discovery or credential discovery. Protected `.openclaw`/`.agent-core` paths and inherited primary-workspace aliases are refused. API export `@agent-core/agent-memory/migration` is management-only; no model tool/runtime registration.

Example reviewed synthetic config (destination must not exist):

```json
{"reviewed":true,"sourceText":"Synthetic notes only.\n","destination":"/absolute/owned-parent/new-copy"}
```

This task did not ingest a production file or actual 2.1MB archive. Original archives are never rewritten/promoted into core. The retained demonstration copies and benchmark are synthetic.

## Executed evidence

[Machine receipt and source hashes](m2-verification.json), [full package output](m2-package-tests.txt), [structure output](m2-structure.json), [synthetic copy execution](m2-synthetic-copies/execution.json), [history benchmark](m2-benchmark.json).

- Final full **agent-memory package** suite: **141/141 PASS, rc=0**; 31 focused document/migration cases pass. Every original package suite remains green. This is not a claim that unrelated repository-wide tests or production acceptance ran.
- Tests run with hostile inherited workspace sentinels; the test helper confines filesystem reads/writes to owned mkdtemp/code roots. CLI child tests use explicit reviewed synthetic configs, no implicit live paths.
- Initial feature and review probes ran RED before implementations/fixes. Parser-review RED: 17 tests, 4 failures; ancestor-substitution RED: 1 test, outside sibling acquired a ledger. Repaired tests now pass; outside sibling remains empty and incomplete original evidence survives. Already-green characterizations are identified in the receipt.
- Exact structure gate at semantic HEAD: **CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT**, rc=0, candidate violations=0, unchanged unrelated baseline debt=32. No repository-wide PASS claim. New M2 source/test diff whitespace check passes; inherited M1 codec has its existing trailing blank line.
- Retained on-disk synthetic copies: STRUCTURED→NOOP, FREEFORM→READ_ONLY_FORMAT with proposal retained, MIXED→READY with a separate candidate. In all three, original/copy SHA-256 match, core mode measured 0400; no core publication or writer activation. Git does not transport the read-only permission bit, so mode is an on-host execution observation.
- Because parsing changed, the existing owned benchmark was refreshed: synthetic 2,112,509B/5,337-entry archive + seven daily notes, 4,420,940 bytes verified per query. All 40 measured queries COMPLETE within default 1s budget; PARTIAL rate 0; P50 68.329–72.846ms, P95 69.954–103.771ms. Sources unchanged. Files were just written; no OS cache purge and no true disk-cold or production latency claim.

## Non-author independent review and disposition

Reviewer `/root/independent_review` authored no implementation/tests and changed no reviewed tree/index/HEAD. Initial affected-contract review covered M2 `e0b169bc..e159359a`; bounded repair review covered `e159359a..0c59a9f9` and invalidated dependencies, without reopening unaffected M1.

Frozen blocker union: three Important, zero Critical; all CLOSED after actual RED→GREEN repair:

| Finding | Failure | Closure |
|---|---|---|
| B-PARSER-1, CONTRACT_VIOLATION | HTML-comment example acquired writable entry identity | Comment-covered lines excluded; original raw bytes preserved and candidate read-only |
| B-PARSER-2, CONTRACT_VIOLATION | Malformed Importance/tags defaulted writable; empty structural fields borrowed body metadata | Validate bounded structural values and decode only structural head; body is its raw byte range |
| B-COPY-1, SECURITY_OR_DATA_LOSS / CONTRACT_VIOLATION | Directory replacement redirected ledger writes outside copy before late refusal | Pin/check every directory and ancestry around descendant writes; exact injected race now refuses before outside writes |

Reviewer independently ran focused31/31 and full141/141 rc=0 at `0c59a9f9`, checked authority blob unchanged and repair diff clean, and reproduced the original probes as fixed. `AUTHORITY_REVIEW`, `PRIMITIVE_BOUNDARY_REVIEW`, `CONTRACT_REVIEW`, `ACCEPTANCE_COVERAGE_REVIEW`, `MANDATE_SCOPE_REVIEW`, `EVIDENCE_REVIEWABILITY` = PASS. Open blockers=0, Spec gaps=0; recommendation permits source-only PR delivery, not merge/production operation/Owner acceptance.

One nonblocking Minor FOLLOW_UP **F-INSPECT-1** is deferred explicitly: inspect summary currently sets `core.readOnlyReason` from parse issues only. Duplicate/unterminated models can have model `readOnlyReason=READ_ONLY_FORMAT` while summary shows null. Planner, copy manifest and CLI correctly use model eligibility and refuse unsafe rewrite. Carry diagnostic consistency into M3; do not interpret an old inspect null as writer authorization.

Declined-to-judge: unaffected M1 merits, real production/archive/session/credential contents, installation/loaded state, runtime writer activation, M3 event idempotence/crash recovery, live business acceptance, merge and production permission. Source/synthetic PASS is not production verification.

## M3 plan and stop boundary

M3 must implement trusted event identity, durable cursor/receipts, single-workspace queue/cooperative owner lock, recoverable journal, all save/update/delete/consolidate entry points, zero-new-fact behavior and budgets. Cover repeat100, auto/explicit concurrency, restart, each durability boundary and edit conflicts; fix F-INSPECT-1's diagnostic propagation. Do not allow an old writer to autowrite a v2-ledger workspace. Any controlled single-writer switch/installation/real migration is a later separately authorized operation with fresh production preimage, writer quiescence and loaded/behavior evidence.

This delivery stops after PR creation and #1248 delivery comment. No merge, runtime installation, production manifest activation, actual archive distillation or writer switch.

```text
SPEC_COMPLIANCE
Referenced Spec = AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2 @ e9342280 §§3/7.1 M2/7.2/9/10
Implemented scope = exact M1 baseline alignment + owned-copy inert ledger + lossless guarded candidate planner + regression evidence
Acceptance criteria evidence = 141 package PASS; source/copy hash equality; preserved-span/rollback/conflict tests; independent review; exact structure delta gate
Out-of-spec behavior = NONE
Rejected alternative accidentally reintroduced = NO
Frozen boundaries respected = YES
New architectural decision introduced = NO
Knowledge artifacts needing update = delivery evidence and M3 followup only; governing Spec unchanged
SPEC_COMPLIANCE = PASS (bounded M2 source/synthetic copy surface; F-INSPECT-1 minor disclosed)
```
