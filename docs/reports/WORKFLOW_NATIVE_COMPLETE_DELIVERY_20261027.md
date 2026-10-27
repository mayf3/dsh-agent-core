# Complete-body native delivery repair — 2026-10-27

The a10 trial retrieved complete originals through Broker, but native's ordinary
50,000-byte spill policy replaced eleven large model-facing results with previews.
This change uses native's existing tool-owned accepted-value seam for the exact
registered `workflow_current_task_body_complete` definition only. It changes no
service, credential, permission, HTTP, global spill, or compaction configuration.

Authority is the accepted `AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1`,
CTR-CIB-006/009/010/011, unchanged at SHA256
`ff299e9080016f570638aaf1d06cbde137cc0d27556e50ddb30698f2f936d116`.
Route: REUSE / BRIEF / DURABLE. Base: `d506bdeb45aaccd4d1887c4b48f633df97a5852d`.

The child retains the registered definition, awaits downstream post-execute
policy, and selects only its own direct successful read with the same live
scoped definition. Block decisions, explicit content/value replacement, nested
calls and other tools pass through. The existing closed `validCompleteResult`
check revalidates binding, body bytes/digest and resource limits. Native then
snapshots, validates and renders the accepted value again, preserving contexts.

Executed observations are retained under
`/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/a11-native-complete-delivery-implementation/`.

- Real native source/build: `9d8678057be9bdbcc37b640ad8cb18279dc5f971`; Node v25.6.1.
- Corrected baseline RED: 1 passed / 4 failed, actual exit 1. Both load orders
  spilled 50,033/64,579-byte originals. An earlier fixture cleanup API mistake
  is preserved separately; it is not counted as another product defect.
- Focused GREEN: 21/21, actual exit 0. Real native registry and spill policy cover
  ownership/shadowing, block/replacement/contexts, nested and invalid results,
  ordinary-tool spill, and the next request received by a synthetic LLM adapter
  through the real native AgentLoop. No provider/model network request ran.
- Complete Broker package regression: 635/635, actual exit 0, no skipped tests.
- Pure ESM has no compilation script; three syntax checks passed and actual
  native/plugin imports executed in those tests. No generated build was claimed.
- Structure verifier baseline exits 2 due the existing stale `store-writer.js`
  registry entry. Candidate result and manual affected-width counts are in the
  final conformance receipt; this is not a structure PASS claim.

Tests ran before the final source commit against the recorded exact source-file
hashes; the candidate binding records that content identity, not invented
post-commit execution. Unchanged HTTP acquisition evidence remains separately
bound to d506; it was not rerun or upgraded to a fresh runtime result.

This proves bounded direct delivery mechanics, not semantic understanding,
future context retention under compaction, or unattended business acceptance.
Root independent affected-source review and a fresh isolated trial remain
separate. Frozen a10, native product source, Specs and production were untouched.
