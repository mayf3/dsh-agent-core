# Full-suite environment coordinate correction

The frozen source review remains bound to commit `38b705a6b2cdd62969bef18b31e69ab974bbc261`. A detached test-only worktree at `/tmp/dsh-1257-candidate` has the same source commit; no product or test source was changed for this correction.

The provisioning resolver derives its default harness checkout from the repository path. Under the allowlisted runner environment (no DSH_HARNESS_ROOT override), independent read-only resolution found:

| Tree | Default harness root | cliBin result |
|---|---|---|
| Base `/private/tmp/dsh-1257-baseline` | `/private/github/deepseek-harness` | missing; existing tests automatically skip real boot |
| Candidate test clone `/private/tmp/dsh-1257-candidate` | `/private/github/deepseek-harness` | identical missing result |
| Candidate authoring tree `/Users/yanfenma/workspace/worktrees/ac-task-1257-fence-lifecycle` | `/Users/yanfenma/workspace/github/deepseek-harness` | local CLI exists; existing tests attempt real boot |

The resolver SHA-256 is identical across all three trees. Base and candidate test clone use the same external dependency versions and the same declared dsh-tools passthrough test stub. Their @agent-core links all resolve to their own tree, with no Base-source imports in candidate. Exact observations are retained in `harness-path-topology.json`.

Using the detached /tmp candidate restores the Base topology for a comparable source delta. It introduces no test edits, skip flags or environment suppression. Preserve the first authoring-tree attempt as noncomparable evidence rather than treating its real-boot failures or incomplete result as a matched regression result.

The matched comparison retains the existing automatic real-boot skips explicitly. It proves no real-harness boot, actual UID 502/505 resource acceptance, runtime deployment, live fence recovery or business outcome. The original exact-source PASS is unaffected; the full matched comparison remains its own required gate.
