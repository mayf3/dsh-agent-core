# #1248 M2 Protocol Migration Implementation Plan

> Agentic workers: execute this authorized plan with test-driven development and one independent affected-contract review. This plan adds no product authority.

**Goal:** Create protocol migration candidates on new owned copies, preserving all source bytes and keeping runtime writers unchanged.
**Architecture:** Merge the exact accepted M1 tree absent from main. Extend its document model with owned raw bytes and byte spans, then plan guarded field/body splices. A copy-only migration module creates a new isolated directory, unchanged core snapshot and inert ledger; no existing workspace is a write target.
**Tech Stack:** Node ESM, node:test, built-in fs/crypto; no new dependencies.
**Spec:** `docs/specs/AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2.md` @ `e9342280`, sections 3, 7.1 M2 and 7.2. Owner mandate: current #1248 M2 task; issue https://github.com/mayf3/agent-control/issues/1248.

## Global constraints

- Base `383c14dbe7e39f2c23f80c0c9edd9adb3adab46e`; branch `ac-task/1248-m2-protocol-migration`; source-only, stop after PR and delivery comment.
- No production workspace access, session/credential reads, writer switching, installation, merge or archive-to-core distillation.
- Preserve codec guards, all preambles, maintenance/unknown text and separators. Only explicit unambiguous entry fields/body may change; otherwise READ_ONLY_FORMAT and retain the proposal.
- Ledger is protocol state, never a second fact source. Copy mode is inactive and cannot be consumed as writer authorization.
- All executed fixtures are synthetic and owned. No runtime/tool integration in M2.

## Review focus

- Metadata-like prose/fenced examples must not acquire writable entry identity.
- CRLF, UTF-8, no final LF and unknown trailing sections must retain exact bytes.
- Duplicate IDs, malformed/unterminated entries and tampered document coordinates must refuse rewrites.
- Existing output, symlink paths and copy/source aliasing must never be overwritten.
- Drift and rollback after a newer revision must preserve the newer bytes, never restore an archive over core.

### Task 1: Align accepted M1 baseline

**Files:** Exact 25-file delta `e9342280..26c7363a` via merge `476ab1b5`.
**Interfaces:** Preserve existing M1 exports and guards.
- [x] Confirm #594 was merged to the Spec branch, not main; main package surface unchanged since common ancestor.
- [x] Merge exact M1 commit into isolated M2 branch; no reimplementation.
- [x] Run `env DSH_PRIMARY_WORKSPACE=/__DO_NOT_TOUCH_1248__ DSH_AGENT_ID=sentinel DSH_WORKSPACE_DIR=/__DO_NOT_TOUCH_1248__ node --test packages/agent-memory/test/*.test.js`; expected 110 pass. Initial missing dependency setup corrected with local package links, no install to production.

### Task 2: Lossless document and splice planner

**Files:** `src/document.js`, existing `src/inspect.js`, `test/document.test.js`, all under `packages/agent-memory/`.
**Interfaces:** `parseMemoryDocument(bytes)` preserves M1 format/entries/spans/preservedSpans/coverage/issues/sha256 and adds owned `bytes`, editable ranges and write-safety reason. `planDocumentEdits(document, operations)` accepts UPDATE with entryId, expectedEntrySha256 and patch, or DELETE; returns status NOOP/READY/READ_ONLY_FORMAT/CONFLICT, beforeSha256, afterBytes/afterSha256, changes/preservedSpanProof. Refused plans keep operations as candidate data.
- [x] Write/run failing byte-conservation, ambiguous-format, CRLF, forged-anchor and drift regressions.
- [x] Implement bounded parsing and field/body splices; bind spans to original bytes and digest. Do not render the full document.
- [x] Run document and complete agent-memory suite; expected zero failures. Commit.

### Task 3: New owned-copy ledger and migration CLI

**Files:** `packages/agent-memory/src/migration.js`, `migration-cli.js`, `test/migration.test.js`, package exports if needed.
**Interfaces:** `createMigrationCopy({sourceBytes, destination, operations=[], agentId='migration-copy'})` takes already authorized bytes and requires an absent destination under an existing real parent. Returns inert candidate receipt. It writes unchanged MEMORY.md, protocol manifest/checkpoint and retained proposal/candidate under memory/.agent-memory-v2. No API accepts an existing workspace write target. CLI uses explicit reviewed config and defaults to pure dry-run; create-copy is explicit and refuses inherited production workspace as an input or destination. Use Task 2 parser/planner exports.
- [x] Write/run failing ledger/classification, refused-proposal retention, output-conflict and symlink regressions.
- [x] Implement copy creation, durable bounded metadata and hash-bound revision candidate; no runtime registration, owner activation, checkpoint advancement or existing-core update.
- [x] Prove original-byte preservation, stale candidate conflict and rollback retaining later delta. Run complete package suite; expected zero failures. Commit.

### Task 4: Evidence, independent review and delivery

**Files:** `docs/reports/agent-memory-v2/M2_DELIVERY.md` and compact executed evidence.
- [x] Run complete package tests under sentinel environment, source hashes and exact candidate structure gate; disclose baseline debt separately.
- [x] Non-author independent review of exact semantic candidate; fix concrete blockers with regression evidence, independent affected delta check.
- [ ] Recheck current main impact, governing Spec unchanged, commit/push branch, open PR to main, post #1248 completion/test/M3 comment; verify URLs/state, then stop without merge.

## Checkpoints and rollback

M1 merge is independently identifiable. All new M2 work is reversible source-only. Filesystem operations create a new owned copy only; partial failures retain evidence and never overwrite an existing directory. Core candidates are never published. A rollback candidate keeps the newer revision and inverse splice is permitted only against the exact planned postimage; drift returns CONFLICT. Any requirement for production data or new product contract triggers re-PREFLIGHT for that dependency only.
