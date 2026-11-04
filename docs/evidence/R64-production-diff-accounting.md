# R64 Production Temporary-Fix Reconciliation

## Scope

R64 production temporarily changed two surfaces under Root control. This source commit series records the corresponding formal implementation without touching production.

| Production temporary repair | Formal source implementation | Commit |
|---|---|---|
| `/usr/local/libexec/agent-core/harness/.source-stamp` changed from `<commit><dirtyCount>` wire bytes to `{commit,dirtyCount}` JSON | trusted installer writes strict JSON; backup helper reads JSON and retains legacy wire fallback | `4fc07f95e2ca14610b8e0a9633af60b148741aac` |
| 19 darwin-x64 optional packages materialized after empty-stub incident | installer pins pnpm platform/arch to the trusted Node runtime, forces offline materialization, and closure gate rejects zero-byte darwin-x64 package directories | `f682514b09ea62cdbdd4cb2f4a80d2b55d1b4654` |
| restart-lost fence recovery workaround | Process health snapshot now derives `AGENT_PROCESS_RESTART_LOST` from EMPTY slot + one unresolved fence; watch invokes existing exact recovery seam | `4a5ab2cd552fc2cf3c0aac6a4254f1fa8160e16f` |

## Safety

No `/usr/local/libexec`, launchd, or production ports were touched. The changes are source-only and require arch/QA review before the single driver-v3 release window.
