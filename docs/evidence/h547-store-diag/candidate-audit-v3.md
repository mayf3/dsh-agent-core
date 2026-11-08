# 547 v3 — D candidate read-only audit

Status: **candidate identity/dedup observation only**. This file packages observations already executed by subagent `/root/candidate_audit`; it does not resume capture or offline execution after the root STOP. No new source, GitHub or production reads, and no tests, were performed to prepare this file.

## Scope, provenance and limits

- Repository/worktree: `mayf3/dsh-agent-core`, `/Users/yanfenma/workspace/project/worktrees/h547-store-diag`.
- Task: identify the existing main D candidate, inspect its three requested mechanisms, and check published in-flight PR duplication. No implementation task was assigned.
- Root's inherited checkout coordinate was `c8036802f1543b108eddce3f8fce474bdc2d4d99`, branch `diag/547-durable-store`; this subagent did not independently resolve the full HEAD SHA. Its executed byte comparison used literal refs `42487e65`, `95a8e1cb`, and `HEAD`.
- All audit commands were read-only local Git/file reads or GitHub queries via `gh`. No production path was accessed. No external message was sent. No files were written during the audit; this evidence file is the later, explicitly authorized packaging write.
- The command outputs below were observed in this subagent's live tool results. Exact excerpts are labeled as such. Summaries and tables reconstruct those already observed results; they are not claimed to be byte-for-byte complete transcripts.
- Most shell commands did not record per-command wall-clock timestamps. The two Python census outputs explicitly recorded `2026-11-08T07:12:08.643046+00:00` and `2026-11-08T07:12:31.410331+00:00`. Do not extend those timestamps to every command.
- No product test, real-snapshot loading, startup, admission, replay, recovery or production verification was executed by this subagent. Those results remain outside this audit.

## Existing D candidate

Executed command:

```text
git show -s --format='%H%n%an <%ae>%n%aI%n%cn <%ce>%n%cI%n%B' 42487e65
```

Exact captured stdout, rc=0:

```text
42487e65b36f049811b0e83f90178510a3da28b7
mayf3 <daretobeyourself.m.y.f@gmail.com>
2026-11-07T12:33:54+08:00
mayf3 <daretobeyourself.m.y.f@gmail.com>
2026-11-07T12:33:54+08:00
fix(recovery): preserve unverifiable history and guard fence writes
```

Executed `gh pr view 646 --repo mayf3/dsh-agent-core --json number,title,state,author,headRefName,headRefOid,baseRefName,mergedAt,mergeCommit,commits,files,url`, rc=0. Reconstructed field summary from the captured JSON:

| Field | Observed value |
|---|---|
| PR | [#646](https://github.com/mayf3/dsh-agent-core/pull/646) |
| State / author | `MERGED` / `mayf3` |
| Head branch / base | `fix/compat-reader-writer-guard` / `main` |
| Final head | `131cadcd3baf0e745c5d636b86c21eef5dc2e50b` |
| Merge commit | `bc69bff131c50af7357d39045b6d3084e5fd6fca` |
| Merged at | `2026-11-07T04:53:03Z` |
| Commits | `42487e65b36f049811b0e83f90178510a3da28b7` implementation; `131cadcd3baf0e745c5d636b86c21eef5dc2e50b` documentation/receipt |

`git branch -a --contains 42487e65`, rc=0, included `remotes/origin/main`, `remotes/origin/fix/compat-reader-writer-guard`, and the current diagnostic branch. This is local-ref ancestry evidence, not a fresh remote-main read.

`git log --format='%h %as %s' 42487e65..origin/main -- packages/agent-router/src/reconciliation/state-machine.js packages/agent-router/src/reconciliation/durable-file.js packages/agent-router/src/reconciliation/admin-abandonment.js`, rc=0, returned empty stdout: no later commits on those three paths in the local origin/main interval.

## Requested three mechanisms and exact byte pins

Executed `git show 42487e65 -- <three paths>` plus local `rg -n` on the corresponding current files. Executed Python `git show <ref>:<path>` and `git rev-parse <ref>:<path>` for each of the three refs `42487e65`, `95a8e1cb`, and `HEAD`, hashing the returned bytes with SHA-256. Every nested command succeeded; the Python command rc=0. The following pins were identical at all three refs:

| Path below `packages/agent-router/src/reconciliation/` | Bytes | Git blob | SHA-256 |
|---|---:|---|---|
| `state-machine.js` | 18433 | `cd8f621f36d2e35e4822b670e966617cc3cd346d` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` |
| `durable-file.js` | 21137 | `6ac4cc21bb89d4f15aad0ddadc140d4ab7632ae5` | `db854ee6061c7f8a56d48f686905d667353c9930bfcd64c95464752075542a1c` |
| `admin-abandonment.js` | 12388 | `7796bb35bea802782977ce83c7017d0e8103ac34` | `62237fb500694f95d894f0f75516ee97fee05cd961971156783120bcbe059710` |

Code observations (source interpretation only, not executed validation):

- `state-machine.js:27`: `isLegacyUnprovenFenceClear` recognizes exactly cleared + initial UNKNOWN + pending query + blocked recovery + null exit/termination/settlement. It recognizes the durable representation and the decoded in-memory representation.
- `state-machine.js:169`: `markFenceCleared` requires settled state, a recognized settlement result, and recognized termination evidence before its idempotent cleared return. Otherwise it throws `RECONCILIATION_FENCE_CLEAR_UNPROVEN`.
- `durable-file.js:211–221`: the predicate selectively tolerates the exact historical tuple in the cross-field constraints; it does not disable the remaining shape, enum, identity or capacity validators.
- `admin-abandonment.js:105–115`: `admissionBlockerForAgent` returns an exact legacy cleared UNKNOWN record even if it has a historical abandonment marker. Ordinary cleared records follow the existing path.

Exact captured implementation excerpt (`git show 42487e65`, rc=0):

```js
export function isLegacyUnprovenFenceClear(record) {
  if (record.fenceState !== 'cleared' || record.initialOutcome !== 'outcome_unknown') return false
  const queryState = record.queryState ?? record.state
  const recoveryState = record.queryState === undefined ? record.recoveryState : record.state
  return queryState === 'pending' && recoveryState === 'blocked'
    && record.exitObservedAt === null && record.terminationEvidence === null
    && record.settlementResult === null
}
```

`git show --format= --name-status 42487e65` and the PR file list showed a broader commit: query changes, Scheduler changes, tests, compatibility helper scripts, and 605 evidence accompany the three requested files. Therefore this audit identifies the requested three mechanisms **within** an existing broader commit; it does not assert that the whole commit is a three-file minimal patch or a pinned deployment artifact.

## Published in-flight duplicate check

Read-only preliminary commands, all rc=0:

```text
gh pr list --repo mayf3/dsh-agent-core --state all --search '42487e65 OR R129 OR fence' --limit 50 --json number,title,state,headRefName,headRefOid,author,mergedAt,url
gh pr list --repo mayf3/dsh-agent-core --state open --limit 100 --json number,title,headRefName,headRefOid,author,url
```

The second query was followed by a complete file-surface census. Python invoked `gh api graphql -f query=<query>` and captured/hash-counted its raw stdout. Exact query string from captured output:

```graphql
query { repository(owner:"mayf3", name:"dsh-agent-core") { pullRequests(states:OPEN,first:100) { totalCount pageInfo { hasNextPage } nodes { number title headRefName headRefOid author { login } files(first:100) { totalCount pageInfo { hasNextPage } nodes { path } } } } } }
```

Exact captured census summary fields, rc=0:

```json
{
  "observed_at": "2026-11-08T07:12:08.643046+00:00",
  "raw_bytes": 93111,
  "raw_sha256": "d418cbae42266f8fec3f5fccf4f9704eb4f79a896d9c4d9fb242984f4e070206",
  "open_count": 69,
  "open_page_complete": true,
  "files_pages_incomplete": [486, 530, 591, 600],
  "overlaps": []
}
```

This excerpt omits the captured `all_open_coordinates` list and query field. The 93,111-byte raw GraphQL stdout was processed in memory and was not saved as an evidence artifact. Its recorded hash is an observation of that command, not a promise that the full original response is retrievable from this repository.

The four incomplete file pages were then completed using parallel read-only calls:

```text
gh api repos/mayf3/dsh-agent-core/pulls/<number>/files?per_page=100 --paginate --jq '.[].filename'
```

All calls and the wrapping Python command returned rc=0. Exact captured output:

```json
{
  "observed_at": "2026-11-08T07:12:31.410331+00:00",
  "paginated_files": [
    {"number":486,"file_count":603,"names_sha256":"6c3398973223f09680f5975762bd4b476d8ecf457a3bb0f422ced70eac46ebe6","overlaps":[]},
    {"number":530,"file_count":593,"names_sha256":"d3b6b1b644fec0f28e9c806dfbe4311b982a1ca4b6351ece61231e718e9e72d3","overlaps":[]},
    {"number":591,"file_count":122,"names_sha256":"b0ea3395e5629831d1067d2bb98187347a937d939da960ce1934799c8fff1b01","overlaps":[]},
    {"number":600,"file_count":162,"names_sha256":"74eb219842c4c1e58e6209999b0e5e584341e5d78fde247d1111bc8b0049bd90","overlaps":[]}
  ]
}
```

JSON whitespace in the preceding excerpt is compacted for this report; values are copied from the captured output, not a new query. The hashed original filename streams were not retained as files.

Both stages used the same overlap prefixes:

```text
packages/agent-router/src/reconciliation/
packages/agent-router/test/runtime-hygiene/recovery-compat.test.js
scripts/availability-recovery/compat
```

Result: at the recorded observation window, none of the 69 published open PRs had a changed path matching those prefixes. This supports reuse of merged #646 and the conclusion that no published open PR duplicate was found on the checked surfaces. It does not prove absence of unpublished work, work expressed under different paths, or PR changes after that window. The queries also identified #670 as the existing diagnostic PR; no new D implementation was created.

## Already observed isolation hazards and suitable existing mechanisms

These are source findings from executed local reads, not runtime results:

- `TurnReconciliationStore` constructor (`store.js:85–100`) reads both the durable store and abandonment registry, recounts authority/capacity, and calls `restoreCrashInterruptedRecords`. Startup may persist. Instantiate only against a separate mutable sandbox, preserving captured input bytes.
- Shape-valid sidecar loading does not itself prove every sidecar handle/marker agrees with the current store. Per-handle consistency remains a distinct required fact.
- Existing `scripts/availability-recovery/compat-reader-matrix.test.mjs` is pinned to old sanitized hashes, 5227 records and three fixed legacy indices. It cannot be labeled current-snapshot evidence without a new, correctly bound execution.
- That existing matrix illustrates cold-open/restart protection, admission/registry/ingress refusal, caller-correlation conflict, spawn/route counters, and rejected bad-clear writes. No part of it was executed here.
- Its old fixture expected three legacy records plus an ordinary active UNKNOWN `agt_stock_agent`. Whether the current four records still match that composition is UNKNOWN in this audit and must come from actual current snapshot bytes.
- Its rollback case explicitly reports old-reader fail-closed with `availability rollback unsupported`. That is a source-level caution for the later release checklist, not an executed rollback result here.

## Applicable authority read and disposition

This audit read the repository AGENTS entrypoint, shared/local governance, Spec-governance router and PREFLIGHT mode, relevant Product Architecture/Decision index, and relevant accepted Spec sections. PLH V4 C-018/C-019 and BOUNDED retain unresolved facts/fences and require restoration before business admission. HR trusted recovery V2 RQ-003 requires validator checks and RQ-006 prohibits replay/sweep; `production_apply_authority: none` remains explicit.

Disposition: existing candidate **REUSE** for identification only; product implementation, live load, recovery, deployment and merge were not performed. Local candidate/source facts above do not satisfy current-snapshot QA, process loaded-byte proof, exact deployment artifact pin, in-flight drain, rollback readiness or production acceptance. Root stopped further capture/offline execution before this report was packaged. This report does not reopen those steps.
