# Independent bounded design review: legacy lock handover

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
FROZEN_DESIGN_BLOCKER_UNION=NONE
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO_FOR_THIS_EXACT_HANDOVER
IMPLEMENTATION_ALLOWED=YES_NONPRODUCTION_ONLY
SOURCE_REVIEW_PASS=NOT_EVALUATED
OPERATION_ALLOWED=NO
PRODUCTION_OR_REAL_LOCK_ACTIONS_PERFORMED=NO

Reviewed `first-live-legacy-lock-handover-design.md` SHA256 `9ff65efce583337a569d3f1bbd76a40d47cadb4985698131fb53d716c6b0cf67` and `legacy-lock-source-bindings.json` SHA256 `85f5f0d9ba1439bc41c06ef2f8d6725fc20378aa116f52a79f639d0f68b0e961`. Both hashes and every referenced source-file hash were independently recomputed. Scope is the concrete absence-to-retirement race and exact owned-lock release/recovery under accepted CTR-DCP-009/018 and migration §7. The reviewer did not author the design. No live lock, production filesystem state or endpoint was inspected or acted upon.

## Source observations and counterexample

The pinned `scripts/trusted-cp-deploy-install.sh` at SHA `b275b38c3de761f0f7f0ddc4e10225b3b88f67065eb9287c5937aa9196c56d06`, lines 38–48, exclusively creates the global directory and writes `holder`. The pinned Watchdog `run-authorized-transaction.sh` at SHA `0ff9c4d9ca49faee3b433324308c01a47733423a3fc5d27dc0544f35336ed1d5`, lines 86–99 and 433–443, takes the same global mkdir lock before deployment/routing/reload. Its additional wrapper-local lock does not replace the shared global protocol.

The retained Scheduler freeze wrapper at SHA `e8ca4a0ce17a50640fc895a4a61c992bf11ae253762b75b2b3313f2729015698`, lines 251–265, checks the two transaction guard paths and then exclusively `mkdir`s `/var/db/agent-core/production-transaction.lock` mode0700. The retained session-trace transaction at SHA `72dacfe1990c5de0dab9d7d28f21da990ccf115e3c4877272b5baf94dd09878d`, lines 531–545, opens `/var/run/agent-core-production-mutation.lock` as a regular root-owned file and takes nonblocking exclusive flock; its finalizer closes the descriptor rather than unlinking the path.

Thus the earlier absence-only design has a concrete gap: DCP observes a directory absent; a legacy process wins mkdir before DCP retires its entry; the legacy process can begin its own permitted mutation while DCP holds only the different permanent DCP mutex. An atomic claim of the same directory protocol closes that interval. A repeated absence check alone cannot do so.

The located freeze source uses `/var/db/agent-core/deployments/transaction.lock` only as an existence-based conflict guard. These sources do not establish an independently reusable acquisition/release format for it. Keeping its absence plus exhaustive writer classification as a prerequisite is honest; inventing a fourth lock receipt/protocol would not be.

## Design disposition

- The one permanent DCP mutex remains acquired throughout the finite handover. Holding the actual old exclusion protocols is transitional migration serialization, not a new parallel routine deployment authority or a profile component's independent transaction lock. No inherited descriptor or “lock held” string is supplied to a child.
- Existing regular lock identity/metadata are packet-bound and never repaired to fit. A permitted absent-to-created permanent inode needs its own exact creation authority, durable intent and exclusive creation; it remains thereafter. Flock release closes only the held descriptor. It never removes/replaces the permanent inode or pretends process absence proves an old transaction completed.
- Both known ephemeral directories are claimed atomically in a fixed order under protected parents. Existing or conflicting objects reject. Intent precedes mkdir; actual directory device/inode and exclusive owned holder bind operation, process and package. The Scheduler directory carries a DCP-specific record rather than a forged freeze receipt. This preserves the distinction between observing/holding a lock and claiming somebody else's historical transaction.
- Holding the directories through retirement, target changes, proof and readback prevents a cooperating old entrant while authority is transferred. After successful journaled handover and verified refusal of old writers, only the exact owned holder and matching empty directory can be released while the DCP mutex is still held. Changed identity/contents, partial acquisition, crash or unknown leaves evidence in place for separately bounded same-operation reconciliation. No stale/PID-age unlink or new attempt ID is introduced.
- The fourth guard must remain absent and every actual canonical writer must be mapped to an acquired protocol or already refused before target effects. Unclassified writers or unknown protocols stop. This is necessary because an existence-only guard cannot itself exclude a concurrent writer.

These choices satisfy the existing serialization and migration obligations without changing Product Authority. They do not grant production operations; the final exact Owner package still must bind current lock prestate and every allowed created path/effect/recovery edge.

## Important limit on inherited-pattern claims

The actual trusted installer source permits `PRODUCTION_DEPLOY_LOCK_DIR` and `PRODUCTION_DEPLOY_LOCK_INHERITED_FROM` environment overrides at lines 17–19 and accepts the latter as a grep pattern at lines 92–101. An arbitrary caller-selected pattern such as `.` can match any readable holder. Therefore “the DCP holder does not match the known old parent pattern” is sufficient only for the enumerated fixed canonical parent invocation; it is not a universal exclusion proof for a caller-controlled override path.

The design's requirement that every writer honor an acquired protocol or already be refused must be applied literally: any reachable caller-controlled path override or inheritance-pattern route counts as non-honoring and must be proven unavailable/refused before target effects. Do not copy those environment mechanisms into the native operator. Known fixed legitimate parent patterns must not match the DCP holder. The exact privilege/environment/installed-entry census and retirement source review establish this condition; this design review does not assume it has already been established on the host. This is a directly evidenced implementation/package obligation within the existing writer-census requirement, not an added platform feature or a reopened unrelated finding.

## Required fixture/source evidence

Exercise real fixture mkdir and flock exclusion against competing acquisitions, fixed partial-acquisition order, crashes around intent/mkdir/holder/result, foreign directory/holder preservation, changed path/inode/content refusal, and release only after a durable successful retirement disposition. Verify new permanent lock creation never races into replacing an existing inode and that release leaves its inode unchanged. Fixture release must fsync the changed directory/parent and retain the operation journal; interruption cannot become a replay permission. No test may operate on real production lock paths.

The native source/package review must additionally prove exact fixed paths/parents, descriptor nofollow and metadata checks, safe cleanup ownership, bounded census and no inherited-lock channel. Future recovery must preserve unknown history and must not restore an unsafe routine writer merely to empty a lock directory. The declared fixture plan already requires the critical failure matrix; no separate design blocker remains.

This PASS removes only the bounded lock-handover design gate. It does not approve the not-yet-reviewed operator source, current lock state, a live retirement/restore operation, production enablement, or the parent Goal's completion.
