# R4 main movement impact review

Root freshly fetched GitHub main at `bc69bff131c50af7357d39045b6d3084e5fd6fca`, after preflight main was `1ff1e81cbd74a51761dab46a5fcee532c41fe4ed`. Movement is PR #646 (`42487e65`, `131cadcd`, merge `bc69bff1`). Implementation base stays fixed at `1ff1e81c`; no rebase, merge, code repair or test-tuple replacement occurred.

Independent read-only reviewer `/root/d009_review`, who did not author the delta, returned:

```text
BASE_IMPACT = BOUNDED (related store/validator/Router reconciliation dependency changed)
IMPLEMENTATION_BASE = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = bc69bff131c50af7357d39045b6d3084e5fd6fca
REVIEW_SCOPE = DELTA
BLOCKERS = 0
SPEC_GAPS = 0
SOURCE_BRANCH_DELIVERY_ALLOWED = YES (existing mandate)
MERGE_READY = NO (not authorized; merged-tree dynamics not executed)
```

- New main `store.js:219-242,257-268` retains `_readDocRaw({repairFences=false,decodeHistory=false})` defaults. The 603 no-argument call stays strict and pure, does not enable the compatibility decoder, migration or disk writes. Invalid history throws and the mount returns UNKNOWN.
- Only new main `loadDoc()` at line 364 explicitly sets `decodeHistory:true`; the 603 read path deliberately avoids it. Read-only compatibility projection does not become writer authority.
- New Router `state-machine.js:27-33` recognizes historical bad-clear facts as pending/blocked/null outcome/null termination proof. `query.js:108` adds only legacyFormat projection. The 603 policy still requires settled, exact/current-epoch/coherent proof, so those facts cannot select failed or termination settlement.
- New fence-clear guard at `state-machine.js:169-178` strengthens proof requirements, without manufacturing business outcome.
- No accepted authority, Scheduler policy/termination writer, Scheduler-Router or runtime mount changes in #646. UNKNOWN, terminationSettlement and sole writer boundaries have no concrete conflict.

Root also ran a read-only `git merge-tree --write-tree` with current main and verification snapshot, actual rc0, tree `3e9bad6858ac1d49c11530667927f276926004b2`; see raw command/stdout/stderr. This creates unreferenced Git objects only, not a branch merge. It proves textual compatibility and does not prove merged-tree runtime behavior.

Existing tests remain valid for their original exact tuple. Neither reviewer nor root claims that `bc69bff1 + 603` merged-tree gates ran. Receipt and PR must retain this limitation. No new mandatory gate, speculative repair, production operation or unchanged-test rerun is added.
