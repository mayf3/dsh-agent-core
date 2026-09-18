# P4 Output Bound Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the p3 large protected `codex` stdout/read-all verification with one fixed-path, same-open-fd streaming SHA-256 check, then freeze and independently review an exact p4 package without production execution.

**Architecture:** Keep the existing 128 MiB subprocess output bound unchanged. The ordinary operator may open the already world-readable fixed `/usr/local/libexec/agent-deployd/codex` object through held descriptor-relative directories with `O_NOFOLLOW`, bind the opened fd to the protected metadata observation, stream SHA-256 in fixed chunks, and recheck the same fd, parent fd, and pathname identity after reading. All other prefix paths keep the existing reviewed flow.

**Tech Stack:** Python standard library, existing first-live unittest harness, existing deterministic package assembler.

**Spec:** `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` at accepted Spec commit `3986553`.

## Global Constraints

- BLOCKER_ONLY=YES; no new framework, generic transport, optional hardening, or production action.
- p3 package `ad05e54a08b227a6476f7fa0f89378deb146a38ade4f3c1a8d7e5453375a1c18` and plan `600e4d5ebaf8dd227a80ead137f39e1b83073f1f1f05bad1639e247bc28f3fbd` are superseded and retry-forbidden.
- Preserve fixed path, `O_NOFOLLOW`, exact uid/gid/mode/nlink/flags/size, held parent descriptor, opened fd identity, and post-read same-object checks.
- Keep command stdout/stderr output bounds at 128 MiB.
- Stop after p4 package and selected plan receive independent whole-package PASS and an Owner authorization request is prepared.

---

### Task 1: Same-fd streaming verification

**Files:**
- Modify: `packages/deployment-control-plane/tools/first-live/first_live_os.py`
- Modify: `packages/deployment-control-plane/tools/first-live/first_live_operator.py`
- Modify: `packages/deployment-control-plane/tools/first-live/first_live_package.py`
- Test: `packages/deployment-control-plane/tools/first-live/test_first_live_os.py`
- Test: `packages/deployment-control-plane/tools/first-live/test_first_live_operator.py`
- Test: `packages/deployment-control-plane/tools/first-live/test_first_live_package.py`

**Interfaces:**
- `OperatorIO.stream_hash_fixed_codex(path, spec) -> None` consumes only the fixed installed codex path and its exact prefix spec.
- `prefix_gate` materializes bytes only for existing small files that are later copied; it invokes the streaming verifier for codex and does not return codex bytes.
- The p4 prefix spec binds codex SHA-256 `b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3` and size `220584000`.

- [ ] Add a regression that creates a file strictly larger than 128 MiB, patches the fixed path to that fixture, and proves the streaming verifier returns PASS without invoking `_invoke` or retaining the contents.
- [ ] Run that test and confirm RED because the streaming method does not exist.
- [ ] Add a digest-mismatch case using the same large fixture and confirm it fails closed.
- [ ] Add a same-fd metadata/identity-drift case that changes the opened object during chunked reading and confirm it fails closed.
- [ ] Implement the smallest fixed-path streaming verifier: held parent fd, `openat`/`O_NOFOLLOW`, fstat-to-observation equality, fixed-size chunk loop, SHA-256, EOF/size check, same-fd and parent/path identity rechecks, metadata re-observation, and append-only intent/result/unknown journal records.
- [ ] Route only the fixed codex prefix through this verifier; retain the existing stdout/read-all flow for every other prefix file.
- [ ] Bind exact codex size in `first_live_package.py` and cover the command/path map invariants.
- [ ] Run targeted first-live tests and confirm GREEN.
- [ ] Run the full first-live Python suite and the repository's existing outer verification set; run structure verification. Commit the exact source candidate.

### Task 2: Affected-surface independent review

**Files:**
- Create review report and machine-readable record under `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_P4_OUTPUT_BOUND_CLOSURE/`.

**Interfaces:**
- Review exact Task 1 base/head diff, executed test logs, fixed-path binding, same-fd guarantees, attempt failure semantics, and unchanged output bound.

- [ ] Independently review only the streaming verifier, direct call path, failure/recovery semantics, and new tests.
- [ ] Require `PASS`, no unresolved ship blocker, and exact source SHA before packaging.

### Task 3: Deterministic p4 package and selected plan

**Files:**
- Create: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-dsh-20260918-01-p4/`
- Create: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-dsh-20260918-01-p4.plan-v1.json`

**Interfaces:**
- Reuse unchanged p3/native artifacts and reviewed findings by exact digest.
- Replace only affected operator/test/source-review bindings.
- Plan must mark p3 attempt consumed, superseded, and retry-forbidden, and preserve operation attempt semantics without production execution.

- [ ] Rebuild package deterministically from the reviewed source candidate and new affected-review record.
- [ ] Verify every file hash, metadata tuple, canonical JSON record, source Git bytes, command map, package digest, and selected plan digest locally.
- [ ] Run pure compose and negative fixtures; record package/plan hashes.

### Task 4: Whole-package independent review and stop

**Files:**
- Create whole-package review report and record under the p4 SDD workspace.

- [ ] Independently reproduce all package hashes and metadata, source/diff bindings, >128 MiB regression evidence, pure compose, negative fixtures, and p3 supersession.
- [ ] Require `P4_PACKAGE_READY_FOR_OWNER_AUTHORIZATION=YES`, `NEW_SHIP_BLOCKERS=NONE`, and no production mutation.
- [ ] Prepare one exact Owner authorization request bound to the p4 package and selected plan, then stop without launching it.
