# First-live static input preparation

Governing authority: accepted Spec `39865536ce51005f95a98473e77c2329078512c0`; parent Goal unchanged. REUSE / BRIEF / CONTROLLED. This converter is nonroot offline preparation; it neither signs nor installs, starts, restarts, adopts, or activates anything.

Exact prospective operation: `first-live-dsh-20260918-01`. This is a preparation identifier, not an executed attempt or authorization.

Final external draft: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-inputs-v2`. Index SHA256 `0eccb65dc49db65f0da4724ecceed1326d8aa060ef1df1da55ab653e6237c74b`; the byte-identical small index is tracked beside this report. The initial `static-inputs-v1` draft remains retained. No large census or generated configuration is added to Git.

`STATIC_READINESS=BLOCKED`; `PRODUCTION_MUTATION_PERFORMED=NO`; `PRIVILEGED_BOOTSTRAP_PERFORMED=NO`; `PARENT_GOAL_COMPLETE=NO`.

Generated inputs preserve the actual preimage metadata/bytes: app 1,131 regular files + 254 directories + 22 links; harness 70,766 regular files + 10,686 directories + 5,618 links; Node 1,931 regular files + 484 directories. The three observed harness hardlink pairs remain explicit, complete aliases. The app final enrollment contains exactly 1,131 existing files, only `packages/broker/src/capabilities/workflow.js` and `packages/scheduler/src/watchdog/incident-lifecycle.js` mutable. Two present legacy app entry files use final reviewed refusal-stub hashes in enrollment; their Tree preimages remain unchanged. No absent files are invented.

The loader map contains exactly 22 actual reviewed `reviewed-node-8ab5904` payloads, with each retained blob hash/size verified. The old controller payload from that archive is excluded. Service enrollment binds the actual three plist digests: Runtime and W1 UID505/GID601, W2 UID0/GID0; Runtime preserves fixed `--catchup 0`. W1 has no explicit GroupName, so its declared group is the actual account primary GID601. That fact is not proof of jobs/runs leaf ownership: their protected metadata remains a runtime preflight prerequisite.

The configuration preserves all six real public keys and their scopes from the successful protected `service.json` export, enables dsh-app, adds only `watchdog-current-observation-v1` with the existing local Verifier and ExternalObservation deadline2000, and binds the prospective operation. The normalized profile digest follows the shared enabled=false convention. No denial receipt, lifecycle digest, login receipt, controller digest, signature, or PASS is filled in.

The ordinary root metadata/group/socket supplements are prospective inputs. app root inode matches earlier ordinary census; Node root inode matches its retained census; harness lacked an older root tuple and explicitly uses the new ordinary descriptor-correlated supplement. The actual socket ACL tool output and account groups are retained, but the native root no-ACL/current-group checks remain mandatory. No atomic protected census, current runtime generation, or semantic acceptance is claimed.

## Exact static blockers

1. Four links are dangling in the current strict native closure. They are two pairs (virtual-package link and hoisted link) for optional `@anthropic-ai/claude-agent-sdk-darwin-x64@0.3.220` and `@openai/codex@0.147.0-darwin-x64`. This is not a missing final leaf only: the target scope directory `@anthropic-ai` / `@openai` is absent beneath an existing package node_modules directory, with the package leaf still unresolved. All lexical destinations are inside harness; each chain contains only the source link, no intermediate link or escape. Nearest existing target parent inodes are 60456630 and 60350233 on device16777230, UID505:GID601 mode0755 flags0. Their future protection remains unproven.
   `link-closure-blockers.json` retains every raw symlink literal, lexical full destination, first missing component, unresolved suffix, complete observed ancestor coordinates, and byte-pinned public package optionalDependencies context. The hoisted aliases are correlated by exact missing namespace, not inferred as direct manifest children. No link is removed or ignored; native `closed_links` still rejects the full input.
2. The two supposed installed retirement entries `app/deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs` and `run-authorized-transaction.sh` do not exist in the complete census. One ordinary exact lstat at 2026-09-18T08:44:56.998556Z confirmed ENOENT for both paths, their subdirectory, and app/deployment-artifacts itself. The raw observation SHA256 is `6a72a8b5327d6e1825f24202aade74925899ab9e8261ff1fd565790fe7743fb1`. No phantom files or corresponding initial app slots are created. Parent owns the bounded reviewed disposition for this actual absence and surviving legacy vehicle.

## Validation

- Focused Python tests: 14 PASS. Coverage includes exact source digest/duplicate members, missing metadata, paths/types, real preimage preservation, no invented absent retirement slots, exact mutable set, loader byte corruption/controller exclusion, public-key preservation/proof omission, actual argv/GID and unsafe socket-group rejection, dangling/intermediate/escape/cycle graph cases, closed cross-tree link, and incomplete hardlink aliases.
- TDD evidence retained: initial converter RED; link diagnostic RED (3 missing-function failures); no-phantom retirement RED (1 failure); final GREEN. These are offline fixtures only.
- Independent sibling author ran the actual generated v1 typed inputs through Rust strict template deserialization, native physical shape/maintenance validation, shared physical binding, and all three Tree validators: PASS. The same harness asserts `FIRST_LIVE_LINK_DANGLING` from strict closure. v2 preserves all five typed input byte strings exactly; only diagnostics/index/present-only retirement hash map differ. This shape test is not source security-review PASS or runtime admission.
- A fresh complete converter run reproduced every v2 fragment byte-for-byte and the same index SHA256. No output overwrite occurs: existing output directories fail closed.
- Python syntax and Git whitespace checks completed. Rust production source is unchanged by this preparation; broader implementation checks belong to the parent source freeze.

Commands:

```sh
python3 -m unittest discover -s deployment-artifacts/control-plane-first-live-v1 -p test_prepare_inputs.py
python3 deployment-artifacts/control-plane-first-live-v1/prepare_inputs.py --operator-source /Users/yanfenma/workspace/worktrees/dcp-first-live-operator --out /Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-inputs-v2
```

External retained evidence:

- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-first-live-static-shape-harness.rs` SHA256 `88df3b2af37d3d08d91282aa7f254bafe1688db02ecf62e650158cc929ab50d6`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-first-live-static-shape.log` SHA256 `58cd596deb617775f057480257085b08d5df426c51bbdee1fdeb3cc6f2224d95`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-absent-retirement-green.log` SHA256 `cf8d3a2572a7898fcf32a4c2dd1445509b3d59e66061853243c4627f80695068`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-absent-retirement-red.log` SHA256 `91849f4c87af35519ee6c6b46385aa5d4baa0c297c2254b4ae75b38c9bfe1bce`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-inputs-final-tests.log` SHA256 `62e6bd3a77554540929dd26eab6204ab86056dc07bacce00a71e4482e9f4bcb8`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-inputs-preparation-final.log` SHA256 `bbebc2ff72ae1454a9c59beb53def13530f85430f6217deb892caa5ed1f43620`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-inputs-red.log` SHA256 `f4b40d504d14d64ece4360be729c5448ebd9cfd455b1da5966f657b0d53fe8d2`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-inputs-repeatability.log` SHA256 `f0f6c0c46c2e48e15fce6ad2c6b9fab83bb261446d7b0081d309deace6dc497a`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-links-green.log` SHA256 `d9d734ee1c2de67b748aeef1c4126433aa438ad8375ca953916f12b1df11414d`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-input-evidence/dcp-static-links-red.log` SHA256 `2796c7ad5b877446d5484c93660097b9af208ae31fda021baf68d939ea91583b`.
