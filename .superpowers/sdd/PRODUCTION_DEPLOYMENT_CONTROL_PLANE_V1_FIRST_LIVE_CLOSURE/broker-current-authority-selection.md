# First Broker slot: related accepted contract and competing packet

Recorded 2026-09-18 in the same parent Goal. Read-only source/provenance investigation; no target write, enrollment, service call, operation dispatch or authority change.

## New evidence

The earlier c9ffe1d selection was explicitly pending upstream/authority compatibility. That gate now has concrete relevant evidence:

- Existing task **修复 create**, id `6aaaac50-a1fc-83e8-8e19-c2cd6a7a12ee`, user message `39589d61-b3be-4de9-b069-448aa0a9d91b`, reports successful conditional Owner acceptance of dsh `45abf5ea0402f5e04d14974030aa6661428b5cc3`, merged as `59472b631129d1ea3ca1202cbcbbc0799b083114`; svc accepted head is `07d888205001708080aa50720e428c6f1c775c7b`. This is attributed source-closure evidence, not adoption of that task's later operation instructions or authority to execute them here.
- Local Git independently contains that merge with parents `7e05e5b2330ba640e8b078d712c0ce9268dfb47f` and `45abf5ea0402f5e04d14974030aa6661428b5cc3`. Its message records the same conditional Owner acceptance. `git merge-base --is-ancestor 59472b6 origin/main` returned 0 against local remote-tracking `cfc272967ab3dd3842079596628371b636c3aac4`. No fresh remote state is implied.
- The Domain Create Spec file still says `proposed` / `implementation_authority: none` even at this merge. Do not silently rewrite it or claim the header itself proves acceptance. The exact acceptance/merge record above must accompany review of the bounded payload; the frozen source alone is not an execution mandate.
- `git diff c9ffe1d 45abf5e -- packages/broker/src/capabilities/workflow.js` changes only the canonical domain-create section/header/description. The required `currentExecutorType` delta is preserved. This is a related full-file compatibility issue, not an unrelated new deployment integration.
- The exact single-slot bytes at both `59472b6` and Scheduler target `41f354d163f532348b2ad1ef33b5ee528655dfc6` hash to `6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2`. The earlier c9ffe target is `2ec3c9d2dc9e5f5bf11cca69ea63ad8888d8cfcc820045e5c0eac1bb11ce7c8d`; restored selected preimage is `d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee`.

## Selection for the next packet

Keep the original active-pool business Goal and Watchdog prerequisite. For a still-pending Broker single-slot deployment, select exact source `59472b631129d1ea3ca1202cbcbbc0799b083114` as the prospective issuer input: it retains the intended active-pool change and the related accepted Domain Create bytes without adopting all later main changes. Obtain the genuine issuer/build/independent release review and exact current-target proof through the existing mechanism. No new Domain Create child, identity grant, domain creation or canary is introduced by this selection. The old immutable Broker enrollment is not rewritten; any required authenticated continuation is part of the future reviewed operation package.

This is a prospective source choice, not a signed READY proposal or assertion that its complete target closure is already safe. Full-file compatibility with the current adopted target remains subject to exact review. No service endpoint was contacted in this investigation.

## Known overlapping deployment

The same task's user message `bc84036b-db49-4532-bb79-a4008186ea77` reports V6 `NOT_COMMITTED_CLEAN` and V7 frozen but unexecuted. Local Git contains packet `b1a977825d3994eefea6f99650c7e72a545d4076` with target `41f354d163f532348b2ad1ef33b5ee528655dfc6`, retaining the same Broker slot bytes. These reports are not independent protected current-state proof and do not authorize execution by this Goal.

Before target adoption/legacy retirement, reconcile actual transaction ownership, permanent locks, app/loader/process generation and durable outcome. If V7 is active or unresolved, do not compete for the target. If it has already installed and verified the required Broker bytes, the original pending delta is no longer a real mutation; use truthful read-only acceptance and select a future real authorized obligation only from genuine records. Never manufacture a no-op deployment or revert accepted source to obtain a first-mutation demonstration.

The protected target census and exact operation package, not an unrelated branch movement, decide whether the release can proceed. Parent completion and unadopted targets remain separate.
