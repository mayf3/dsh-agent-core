# Bounded implementation report

SOURCE_COMMIT=730d4a0539cc758eb8c0440e9ceddbefde4c017d
BASE_COMMIT=78daf3699346f6f68264921443d42552d9157dae
SOURCE_TREE=dcfc5c84b663da8b1713627757d29503d89aba99
AUTHORITY_ACTION=REUSE
PRODUCTION_MUTATION_PERFORMED=NO
PRIVILEGED_BOOTSTRAP_PERFORMED=NO
PARENT_GOAL_COMPLETE=NO

Implemented design sections 1–3 only in the isolated worktree. See `docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_BINDING.md` for behavior, boundaries and real first-live remaining gates. No production/controller provisioning, new real enrollment, Watchdog semantic verifier, bootstrap package rewrite, queue migration or legacy entry retirement was performed.

## Executed validation

- Fresh exact-source full Rust package suite: PASS, **272 top-level tests**, 0 failures, 2 existing manual local Codex probes ignored. Nested durability worker subprocesses contribute 64 additional printed PASS lines; raw sum is 336, not 336 independent suite definitions. Full log SHA256 `ebd97c1d47ef32dcbb3abe8acda645ece9cc5189e7667a7a7f5f4687edd8407a`.
- Format check: PASS, including a fresh precommit check.
- All-target Clippy with `-D warnings`: PASS.
- Release build `--release --locked`: PASS.
- Structure: exit 1 for three unchanged baseline directory violations only (`production-runtime/src` 21→21, `production-runtime/test` 23→23, `scripts` 59→59). No global structure PASS is claimed.
- Staged whitespace check PASS; source tree matches frozen review target.

## TDD and development observations

`red-mapping.log`, `red-policy.log`, `red-draft.log` reproduce absent mapping/v2 decode and same-Goal draft escape on the starting implementation. `red-custody-binding.log` captures a v2 changed-Owner/review-helper binding that initially reused a draft hash. `red-historical-mapping.log` captures mapped READY accepting HistoricalReceipt before the scoped LiveInstallation guard. Final exact suite covers all fixes.

Focused GREEN logs retain development milestones. `focused-e2e.log` is an intentional retained failed harness observation: the existing unknown-canary gate refused a PASS after OutcomeUnknown. The harness was corrected without modifying that gate; `focused-e2e-corrected.log` passes. `full-test.log` is an initial full run whose source/binary execution overlapped the last mapped-HistoricalReceipt defense; **only `full-final.log` is cited as the final exact-source full run**. Clippy and release ran after that final source edit.

## Compatibility and limits

Old Enrollment/ledger/Owner-policy canonical bytes and signatures remain valid when the optional mapping is absent. Genesis continues using the original concrete v1 policy type and all sealed inputs remain untouched. V1 drafts keep their historical digest when no mapping exists, justified by immutable Goal enrollment. V2 drafts bind full Owner policy, selected source, signed enrollment/mapping and native activation digest; changed bindings stop rather than creating a second artifact.

The source selector is an internal Owner-controlled finite map; caller API remains goal/source only. Registry validation pins the complete signed Watchdog-child authority/contracts/acceptance/catalog verifier but cannot certify real semantic observations. Exact future provisioning must bind the actual ExternalObservation/verifier contract and must reject a generic installed-byte substitute. This is not a Watchdog acceptance PASS, a controller update, or permission to provision v2 state. Old binaries cannot consume new v2/mapped records, so later downgrade requires exact data reconciliation.

Independent review is performed by a separate nonauthor. Its report is intentionally excluded from this implementation author's evidence commit until the parent handles the independent delivery gate. No source changes after the frozen source tree above.
