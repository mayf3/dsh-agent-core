# Fixed e31 partial-stage closure — source artifact

This directory contains the final review-bound implementation for the one consumed operation `b7-packet-r27-2edfbaeef5c352f2e-e31`. It is a source contribution, not an installer, publication authority, replay permission, or runtime/business receipt.

The governing [accepted e31 amendment](../../docs/specs/AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E31_PARTIAL_STAGE_CLOSURE_V1.md) has SHA-256 `bf5fbd5c061a7f7653321e2a1ec5323ffe4c76ec2f54cec4f05b9a2c3479c6b8`; the exact accepted Owner proposal is `0b9306d9654dd180d775cb41df503acaf014e458342ace55d358b542364778ed`.

## Contents and behavior

- `src/v50_e31_closure_source.py`: fixed original disposal/STATUS/output handling, exact old identity and V1 schemas, held original mutation lease, atomic no-replace records, file/parent durability and restart-local proofs. STATUS never fsyncs; only the same disposal action can complete exact existing-record durability.
- `src/e31_preserve_once.py`: original UID502 STATUS bridge and fixed root maintenance preservation. One same-parent native EXCL rename; exact history repeats use parent-fsync/readback only. The internal `fsync_fixed_history(execution, data, parent_fd, lease_current)` seam never renames or touches successor state.
- `src/v50_execution_client_source.py`: original paired codec with only fixed e31 added to the existing e30 five-field partial-stage overlay case.
- `patches/`: reviewable codec/executor diffs and the one no-argument `e31-preserve` case. No full executor/embedded bridge is included.
- `tools/build.py`: mechanical construction from explicit exact public code preimages. It never imports or runs a service, executes a privileged action, writes authority, or sends a DS request.
- `tests/`: `.py.fixture` files avoid accidental repository test auto-discovery; the runner materializes identical `.py` files only in its owned temporary test tree. They contain the original actual-module installation, codec, persistence, preservation and R1 regression harness. Test roots/UID/GID/custody are explicit models; real owned FD I/O, flock, native EXCL and file/directory fsync are used. No real root/auth/provider/network/DS process is called.

`PINS.json` binds every final source and reconstructed output, accepted authority and exact independent reviews. In particular, V2 review `c29f2b61eaa7cf12e428cb2b430bc8543f31e7ce181682d46040ada6711968c0` closes R1. Review `80430b4bfda1c44aceaadf4f8fc0fbc5d66ae9e6ccbfd466f183bbbe674ea1a2` contributes unchanged checks only: its R1 request for changes is superseded by V2. Verifier review `3b804d579c20a74e95af59b01a9561fa0aa5bf64eaa3ffb9fe912a974a08ac15` covers its separate mechanical verifier scope. Those historical reviews do not independently review the new packaging tools, and do not attest production execution. The earlier failing implementation is not shipped.

## Reconstruct and verify

Supply an **owned, read-only public preimage directory**, not an installed service directory, containing these exact files:

| File | Required SHA-256 |
| --- | --- |
| `deployment_system.py` | `f127ce746322b375d34eb6ef7dabd1d41ba8b832d242f9097b55b91f24e5b35b` |
| `ds_client.py` | `4801449a6b183bf1a5ed6c244dbb088601aa81d545320e992af7613a10c212a3` |
| `executor.sh` | `9ff99e820642881ed2f3dd059184707a09884825ce096ae929ad651b392cf8fe` |

Large preimages and generated service files are deliberately external. The builder produces exact server `8e71f571bc225d214745e100e3b8824d398cf315df85313136c570e75bc6e309`, client `a590af5cb19d8d8b50f7b57a9e1f81a429442d1589f6fa30d8c4fe12f3fcac19` and executor `e7556f77d1e7a30d72997e1417adff7ea39fc01961b2da346b7f092d50275ca6`. All unrelated server/policy bytes remain intact; the source literal uses ASCII escaping for the actual system Python parser.

From this directory, using new owned output/receipt paths:

```sh
/usr/bin/python3 -B tools/build.py --baselines /owned/public-preimages --output /owned/new-output
/usr/bin/python3 -B tools/verify.py --baselines /owned/public-preimages --protocol-tests --receipt /owned/new-test-receipt.json
```

The first command constructs artifacts only and refuses an existing output. The second uses and removes an exclusive temporary test tree, checks exact reconstruction/wrong-preimage/existing-output behavior, then runs the unchanged 36 methods plus three R1 methods (six symmetric drift scenarios and a complete-schema encoding positive). It uses this Mac's `/bin/cp -c` for independent-inode APFS test clones. Expect approximately 230 MB of temporary artifact material; none belongs in Git. Omit `--protocol-tests` for reconstruction-only checks that reuse the already reviewed source tests.

The accepted original maintenance/publication lane must separately bind all delivered bytes in its authority/capsule/verifier and perform actual install/load/disposal/preservation readbacks. This package creates no successor operation, packet/snapshot, authority, service configuration or publication. A later daemon restart loses volatile record durability proofs; the accepted same-action/history-only completion requirements still apply.
