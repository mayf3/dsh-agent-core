# V7C — INDEPENDENT MECHANICAL REVIEW (2026-09-19, bytes 0de835fc…)

MECHANICAL_REVIEW=PASS — BLOCKERS: NONE

- Identity: sha matches; bash -n clean; archived copy cmp-identical; ancestors v7=cb0f12b2 / v7b=d66c4825 confirmed.
- FIXTURE=PASS rc=0; fixture exercises the SAME $src/capabilities/self-ops.js + $src/gateway.js layout as production G1/G9.
- Delta vs v7b 100% accounted (two-file constants, preimage 6447676c, target 2d45fda7, v7c naming, G1 dual pins,
  build_app_next_v7c dual cp+chown, G9/post-swap dual checks, G6b + wap-broker-only-deploy + self-exclusion,
  FROZEN_LIVE_ROOT_PKG_SHA=d5764403 retained) — every v7b gate retained, zero regressions.
- Independent manifest recomputation via the runbook's own pipeline: LIVE=6447676c exact; live+two files=2d45fda7 exact;
  source pins b302810c/4c341db4 exact; job_disposition greps 1/2. Pipeline mode-independent (root chown cannot perturb G9).
- Sims: noclobber FIRST_CREATE=OK / SECOND=BLOCKED_EXACTLY_ONCE; G6b decoys — v7c family excluded,
  wap-broker-only-deploy + v7-family CAUGHT (fail-closed).
- set -u/pipefail audit of v7c vars clean; gate inventory complete G0..post-dual-receipt, every failure path exits non-zero.
- Live spot checks: pid 12649 exact cmdline; 8790 ok; live manifest still 6447676c; v7c marker ABSENT; locks empty;
  no v7c residue; w2.log healthy. Adversarial: no guaranteed-false-fail (jq/PlistBuddy/stat/curl/launchctl failure
  paths all fail-closed), no fail-open, writes confined to sanctioned surfaces.

NON_BLOCKING: swap_out unused (inherited); unreachable exit 2 after fail() (inherited); warning-only engine-lease +
evidence-only error-tail/parse-smoke (inherited from the PASS v7 skeleton); post-swap full-manifest equality carried by
receipt + acceptance; 'deploy-v7c' substring self-exclusion class accepted at v7b; non-root cannot read engine-lock
(root-side G3 is fail-closed compensating control).

FIXTURE_RERUN: PASS
