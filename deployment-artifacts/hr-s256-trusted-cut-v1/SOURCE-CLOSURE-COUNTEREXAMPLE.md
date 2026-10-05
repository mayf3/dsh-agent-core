# Fixed s256 R2 source-closure counterexample (static)

Source coordinate: frozen DS v5 `deployment_system.py` SHA-256
`b4b65201498c4ec959c391e59e86322931ab3638a475f6c0c0b2fdeddc8eb437`.
Its `mutation_lock()` uses the DS flock; `restart_runtime()` controls
`system/ai.agent-core.runtime` through launchd. The current supported DS
action allowlist has no fixed HR cut or whole-host manual-exec denial.

Consider an actor with the Runtime UID and permission to execute the installed
`node` and `scripts/production-runtime.mjs`. While DS owns its lock and has
booted out the fixed launchd label, that actor launches the script directly
**after the zero census and before the authorized startup**. This path does
not need the DS socket, its flock, or launchd's fixed label. It can create a
new Runtime/DSH child after the observation. A previous `ps`/`lsof` zero and
unchanged DS lock are therefore insufficient to prove RQ-003 V9 continuity.

The current installed permissions, actual manual routes, alternate helpers,
and a host-level denial/admission primitive have **not** been read or proven.
This is a static unexcluded execution path, not an observation that a second
Runtime actually ran. A future reviewed source manifest must show a concrete
enforced denial covering this path and all other source classes, with live
continuity through consumption. The candidate stays inert and produces no
bundle while that fact is UNKNOWN. No test fixture's `complete:true` or
challenge response can substitute for it.
