Fixes mayf3/agent-control#1367 (LEDGER-D04).

Mounted `traces`/`attention` and fresh ledger readers previously entered `mutate`, so reading a torn event tail could truncate it or append a missing newline. Fresh readers now use the existing FIFO/OwnerLock and replay without repair; diagnostic responses explicitly qualify an incomplete tail. Actual mutation retains fresh locked replay, tail repair, identity/generation/phase validation and UNKNOWN fences.

Reconciliation derives candidates from one shared snapshot, with conditional refresh after phase changes. The measured no-work replay count falls from 6 to 3; busy phases may refresh. Lock architecture (#1366) is outside this change.

Validation reuses the original coordinate-bound observations and independent reviews; R6 performs mechanical delivery only:

- Corrected RED: 9 tests / 3 pass / 6 intended failures, rc1. Focused GREEN: 11/11 rc0, unchanged diagnostic event-file hashes, mutate/repair/append=0, explicit incomplete-tail qualification.
- Existing workflow: 316/316 rc0; inherited stale-quiescence whole-file exclusion remains excluded.
- R3 integration: 29/29 rc0; broker samples: 80/80 rc0. Actual Node v25.6.1, nine proxy keys unset only in test children; no host-setting changes.
- Structure: rc0, 0 candidate violations, 28 inherited debt findings. Corrected R4 authored/compiled whitespace scope: rc0. Original raw captures, failed rc values and the `603-R7-RAW-CLASS-001` exemption recipe are preserved.
- Independent R4 candidate review PASS at tree `07ff18450ba8099edf7e655fa8bdc4b500154cac`. R6 commit `ed31db7cfa068ac8128c127382efd98986abff4b` has exactly that tree and the unchanged base `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`.

R5 remote reads both succeeded; its PR-list evidence wrapper failed before `gh` because concurrent metadata `git write-tree` calls contended for `index.lock`. R6 uses strictly serial commands with no parallel wrappers, no concurrent child Git process and no lock removal. Actual delivery observations and preserved R1-R5 history are completed in `RECEIPT-1367-READSEP.md` after PR creation/readback.

Route: REUSE / BRIEF / DURABLE under accepted-in-base WEC V3 and WAE V3 Contracts. Source/offline mechanism delivery only. No merge, deployment, production write, runtime admission or business acceptance is authorized or claimed.
