# D14 R5 exact source and fixture evidence

Source commit b5d3a78f20cf73497fe12fe440fea541b66123e5, resumed from c35d30f4. See checks.json and the current R5 section of docs/reports/D14_R4_GENERATION_IMPLEMENTATION_20261101.md. These records do not establish production admission.

- noncodex-red.tap is the planned pre-fix regression reproduction; focused-green.tap is21/21after the minimal fix, before path grouping; relocated-green.tap is8/8after grouping. independent-review.json binds the5affected files and independent5/5execution.
- named-status.json contains all938latest statuses. named-comparison.json has full named delta=[] and rc1 from the preserved62baseline failures/9skips. named-first-* retains the first extra deadline failure; cause remains UNKNOWN, and the independent applicability decision does not invent a flaky-test verdict. Raw NDJSON remains at named-raw-provenance.json paths with actual hashes. No expected names, failures or deadlines were edited.
- released-fixtures/summary.json is the final supplemental scope. Its earlier closure-receipt.json was made before the separately recorded valid nonshared CLI positive. The malformed nonshared CLI rc1 and setup failures remain readable and are not product-semantic blockers or PASS results. Four supplemental released observations complement the unchanged r4 source121/release14observations. The stored scripts are exact executed evidence snapshots, not production entrypoints or qualification descriptors.
- structure.json is the actual source-commit machine result; eleven directory violations remain. Three D14 growth locations are removed; scripts growth remains. Structure is not PASS.
- shared-comparison.json covers30listed links and two directory listings only. dependency-links.json records83local links/0external. source-binding.json binds9accepted Spec bytes.
- No deployment/restart/production spawn, real credential reads/writes, shared checkout writes or business sends. Actual installed Harness/Core and shared CLI wiring remain missing qualification.

SHA256SUMS binds every file in this evidence directory except itself, including the fixture subpackage manifest. The publication commit is bound by PR600/#1345 readback; this source-based record avoids a self-referential HEAD claim.
