# V7B — INDEPENDENT MECHANICAL REVIEW (2026-09-18, bytes d66c4825…)

MECHANICAL_REVIEW=PASS — BLOCKERS: NONE

Delta inventory v7→v7b verified line-by-line with zero regressions: constants (marker
scheduler-self-healing-v7b-apponly / preimage c41a9045 / target f261066d / source pin b302810c /
scheduler e3e8dce0 / root pkg d5764403), G1 single-file pin, build_app_next_v7b (cp -a + one cp +
root-guarded chown), G9 additions (broker sha + job_disposition grep + scheduler/pkg invariants),
post-swap deployed-broker checks, receipt fields (V7B_SCOPE/PRIOR_GENERATION/DEPLOYED_BROKER_SELFOPS),
G6b self-exclusion, routing pinned at the real /usr/local/libexec/agent-core/config/scheduler-routing.json
(file exists; inside the hashed config/ tree — closes V7's vacuous-path note).

Executed: FIXTURE=PASS rc=0 · independent manifest recomputation live=c41a9045 / live+one-file=f261066d /
source b302810c (grep job_disposition=1) · invariants live scheduler.js=e3e8dce0 pkg=d5764403 ·
G6b decoy sim: v9-family decoy CAUGHT, v7b-family decoy correctly self-excluded (pre-fix block proven
self-matching) · marker noclobber first-create/second-EXACTLY_ONCE · set -u/pipefail delta audit clean ·
live spot checks (pid 3380 stable, 8790 ok, marker absent, locks empty, no residue, w2.log healthy) ·
no guaranteed-false-fail (all binaries on line-31 PATH verified, stat -f BSD-correct), no fail-open.

NON_BLOCKING: R1_ATTRIBUTION receipt line dropped (lineage note, not a gate); fixture no longer dumps
/tmp/sched-v7-built.lines (improvement); chown branch unexercised non-root (single file, runtime owner);
fixture/build share cp -a+manifest_of but orthogonal byte checks compensate; deploy-v7b substring
exclusion masks only our own family (G0 marker guards v7b-vs-v7b); inert app.next-v7b residue possible
on pre-swap APPLY failure; warning-only engine-lease + parse-smoke carried over.

FIXTURE_RERUN: PASS
