# Unpublished PR draft

This is prepared text only. The R4 remote preflight failed before commit/push/create; no PR was published.

Fixes mayf3/agent-control#1367 (LEDGER-D04).

Mounted `traces`/`attention` and fresh ledger readers previously entered `mutate`, so reading a torn event tail could truncate it or append a missing newline. Fresh readers now use the existing FIFO/OwnerLock and replay without repair; diagnostic responses explicitly qualify an incomplete tail. Actual mutation retains fresh locked replay, tail repair, identity/generation/phase validation and UNKNOWN fences.

Reconciliation derives candidates from one shared snapshot, with conditional refresh after phase changes. The measured no-work replay count falls from 6 to 3; busy phases may refresh. This change does not redesign the lock architecture (#1366).

Validation (exact commands, raw output, hashes and original runtime coordinates are in `RECEIPT-1367-READSEP.md`):

- Corrected RED: 9 tests / 3 pass / 6 intended failures, rc1; focused GREEN: 11/11 rc0 with unchanged event-file hashes and mutate/repair/append=0 for mounted diagnostics.
- Existing workflow suite: 316/316 rc0; inherited stale-quiescence whole-file exclusion remains excluded.
- R3 integration: 29/29 rc0; broker samples: 80/80 rc0. Actual Node v25.6.1 with all nine proxy keys unset only in test children. No guard/assertion or host setting changes.
- Structure: rc0, 0 candidate violations, 28 inherited debt findings. R4 reuses unchanged passed mechanisms after independent source/evidence impact verification; no R4 dynamic rerun is claimed.
- R4 whitespace: corrected raw-capture class scope rc0; compiled/authored artifacts fully checked. Standing ruling `603-R7-RAW-CLASS-001` applies (https://github.com/mayf3/dsh-agent-core/blob/0aa7aa1e1d23beb13567228a503ff5d9218966c7/BRIEF-603-REVERIFY.md#L53-L59). Exact paths/reasons/hashes are in `R4-whitespace-scope.json`. R3 unscoped rc2 and first R4 incomplete-scope rc2 are retained; no original capture bytes were trimmed.
- Independent affected-delta and final-HEAD checks bind the delivered source and evidence; receipt-only completion is tracked separately.

Route: REUSE / BRIEF / DURABLE under accepted-in-base WEC V3 and WAE V3 Contracts. This PR delivers source and offline mechanism evidence. No merge, deployment, production writes, runtime admission or business acceptance is authorized or claimed.
