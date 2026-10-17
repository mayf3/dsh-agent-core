# Fixed e32 pre-TX closure — source artifact

This small source contribution covers only consumed operation `b7-packet-r31-19e485b2f9fa79a5-e32`. It is not an installer, deployment authority, execution retry, loaded DS receipt, actual closure or business result. Root remains the sole formal/production writer.

The governing [accepted e32 amendment](../../docs/specs/AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E32_PRE_TX_CLOSURE_V1.md) has SHA256 `5e8227206176403b74e96de9e591b9d75b76f6aeadf158e8cc8fd94b598c8f5a`, merged through PR518 `0b5de0051400f02267869074b19a3763a546c9b7`. Accepted exact delegated-coordination proposal is `cc61fd25120c888fc3a575687a94bf5899eefd212dfce636a15a308b5276e557`; this does not fabricate human Owner acceptance or broaden mother7911/064.

## Delivered delta

- `src/v51_e32_closure_source.py`: final V2 fixed original disposal/STATUS/output branch, original e29 two V1 schemas, peer502, exact original identities/policy/snapshot/journal/native absences, held original mutex/guard, no-replace persistence and file/parent durability. Cold or otherwise unproven records require full fresh scene; only exact records with successful durability proof in the same daemon can use historical immutable checks. STATUS is read-only. There is no stage/preservation rename, new action, new schema/authority marker, executor case or business replay.
- `src/v50_execution_client_source.py` and `patches/client-module.patch`: only the original e29 four-key null-TX CLOSED_PRE_TX fixed-op allowlist gains exact e32. No partial-stage flag is added.
- `tools/build.py`: existing source-artifact construction pattern, adapted to exact two public code preimages. It verifies all inputs/source/output pins, ASCII sealed literal equality and complete old server/client inverse. It never executes daemon main, imports a service, requests privilege, creates an operation, edits authority or calls DS.
- `tests/`: `.py.fixture` suffix avoids repository test auto-discovery. Frozen V2 tests/actual installer harness retain assertion bytes; the only packaging adapter redirects nine snapshot fixture reads to the owned materialized `snapshot` directory. The support file is the necessary original helper prefix, with unrelated historical test classes omitted. Nine snapshot fixture files are the actual retained e32 code/pin bytes, including its known refused checkpoint configuration; they are not a successor package or successful checkpoint proof. No production records, credentials, unrelated history, full executor or generated110MB server is shipped.

Final source0601 and servere988 fix independent R1: V1 ea6a/842d treated visible terminal as completed history after terminal-parent-fsync uncertainty/restart. V1 is rejected preimage history only, not delivered runtime code. V2 independent continuation review is `e25941b0f6b9129791ee296580386230ac8c48e7b3b9808e91168a7c51e13234`; V1 REQUEST_CHANGES is `1b3459c35d2710766827ae737a6bc9d2d28cb581ce0da4f74857b6e196b74e3d`. PINS.json preserves both references truthfully. Those code reviews do not independently review these packaging tools or attest production execution.

## Reconstruct

Supply an owned public preimage directory, not an installed service directory, containing:

| File | SHA256 |
| --- | --- |
| deployment_system.py | 4a8556978c9696942ad1bff135ce7d74eab0b2ae7bcf5898be5a408204ff722c |
| ds_client.py | 53728402d508c0afe7041d192bb1e8941c03071f27a20b8b5aee3e52592c78ee |

```sh
/usr/bin/python3 -B tools/build.py --baselines /owned/public-preimages --output /owned/new-output
/usr/bin/python3 -B tools/verify.py --baselines /owned/public-preimages --protocol-tests --receipt /owned/new-verification.json
```

Outputs must be new owned paths. Reconstruction produces exact server `e9887775c7fa7c6a7efc167c7aba4655f3d274acaea31e440523bf9aca5d31b1`, client `959c1a2d92c044b04442a6f9c7f0df902c154cc01986e6c43eff6a5f8b8df241`, source `0601d987833a33827a205ba6850a9cdc7f83124d35cf1fb0def61baee2c09161`, codec `c31c34555f1a975a09be5b3c70a2aab4bdd6fc6cf477acf9b95874b43edd7613`. Original executor `190de10b947c55d8ef644ee3a787f87557a0bd8de2ff81bf63c763582183bccd` is unchanged and not required as builder input. Removing only the new server append restores every original server/policy/sealed-module byte; the single client source guard and sealed literal inverse restore the original client.

Verification checks wrong-preimage refusal before output, existing-output refusal and exact reconstruction. Optional protocol verification materializes owned code fixtures, independent-inode APFS clones and only the three directly affected V2 methods: R1 required refusal; warm proven history/cold unproven changed-scene UNKNOWN; cold-before-successor full-fresh durability completion. Other packaged tests are available but inherited unchanged reviewed coverage is not falsely counted as rerun. Root IDs/identity/custody/fixed paths and in-memory transport are explicit models; actual owned FD traversal/flock/EXCL/fsync are real, with zero attempted subprocess/network actions asserted. Native rename is bounded by exact owned parent/leaf guards; Python audit alone cannot prove native syscall isolation. No actual root/DS/auth/provider/production call occurs.

Large public baselines/generated files remain external and are removed with the verifier's owned temporary tree. Existing maintenance/publication/authority/pin/capsule/verifier, actual install/load and original fixed-op disposal readbacks remain separate steps for the sole formal writer. No successor key, snapshot or operation is selected by this source package.
