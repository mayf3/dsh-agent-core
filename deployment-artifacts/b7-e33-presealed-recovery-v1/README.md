# Fixed e33 pre-SEALED recovery — source artifact

This small contribution preserves the final fixed original E33 recovery implementation. It follows the existing `deployment-artifacts/b7-e32-pre-tx-closure-v1` source-artifact pattern. It is not an installer, new authority, public recovery API, retry request or successor operation. Root remains the sole formal repository/admin/production writer.

The governing [accepted E33 R3 amendment](../../docs/specs/AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2_AMENDMENT_B7_E33_PRESEALED_RECOVERY_V1.md) is SHA `ba11aa2d5f6eea8e7d53400356e18b268cfafb89464ef98a9e3790b479d28083`, accepted exact proposal `157ae6fac475c5f842bc1df4220657d86db2d71b0b3fe2944bece76776d813ad`. Mother7911 and existing064 remain unchanged.

## Delivered source and limits

`src/v52_e33_recovery_source.py` is the exact final `4dfcf106a0a86c2c534a363111c6577bad37522e853ae674d3db133be2b3063a` /95,589B source. It retains the original fixed operation/TX, DISPOSAL/STATUS/output protocol, original guarded six-target inverse, continuous native FD9 lease, exact archive/restore/postproof, seed/artifacts/codeinput-last EXCL preservation, normal holder retirement and terminal-last durability. It does not rerun business or add a new action/schema/identity/permission.

The final source includes the separately reviewed lsof returncode ABI fix and the exact logical `/var`→physical `/private/var` preimage-store reader seam. Original raw batch and holder bindings remain unchanged. Review references in PINS preserve implementation `e16812d3…`, lsof ABI `95a37065…` and canonical reader `226eb75b…`; these do not independently review this package's new tools.

`tools/build.py` reads explicitly supplied external public code preimages at exact hashes, compiles syntax only and reconstructs the exact final server by inserting the ASCII sealed source and original installer immediately before the unique original main footer. Removing only that block must restore every old server byte, including all previous sealed modules/policies. The client is entirely unchanged. No daemon import/main/handler, privilege request, DS call, authority/pin/capsule edit or service action occurs.

The 110MB baseline and generated pair, raw batch, production records, credentials, source snapshots and old fixture trees are deliberately not shipped. The original corrected handler fixture depends on large retained native-snapshot/ownership adapters; this source package does not trim or replace it and does not claim to rerun that protocol. The reviewed same-handler logical `/var` fixture, original Node inverse, FD/OFD, EXCL rename and failure cases remain external inherited evidence with their stated custody/process/health models. Only the three construction/refusal tests are rerun here. The test source uses `.py.fixture` to avoid repository test auto-discovery; the verifier runs that exact file explicitly.

## Reconstruct and verify

Supply an owned public preimage directory containing these unchanged files; no copy or CoW clone of that directory is performed:

| File | SHA256 |
| --- | --- |
| deployment_system.py | cd5e797b0d435e08163262d1a7c95e726a2fcd344513cb844214a0a9c5057ad5 |
| ds_client.py | 826d26bf1939a281b4b6e1741fa1797bbd24bddc6783eec70e9bd6346a3a8c7c |

```sh
/usr/bin/python3 -I -B tools/build.py --baselines /owned/public-preimages --output /owned/new-output
/usr/bin/python3 -I -B tools/verify.py --baselines /owned/public-preimages --receipt /owned/new-verification.json
```

The builder must produce server `eb8639b9fea5e5a0283faf8aaddf5e6b53c982105cb8edce406f35803113564d` and unchanged client826d. Wrong input refuses before output creation. Existing output (including a symlink) refuses; no overwrite/merge is attempted. A failed new output is not automatically retried or silently reused. The verifier builds only in its own temporary directory, checks exact products and whole inverse, and removes only its own temporary generated output on completion. No baseline copy/clone or production material is removed. SOURCE-MANIFEST.json binds every small contributed file except itself.

## Native evidence remains separate

Root's saved original UID502 action returned success and original STATUS confirmed overlay `DISPOSED_PRESEALED`, installed=false, next_action=COHERENT_CANDIDATE_NEXT. The underlying original execution remains RETAINED/nativeUNKNOWN/replay=false; this is not native COMMITTED, business execution, or business delivery. The original full native readback is separately retained. Exact external evidence hashes (references only, no record payloads) are in PINS:

- `actual-e33-disposal.return.json`: `213ca91565e9146fa630f1890b8bb086d79f4c3594fe440f57a140865a18d7d4`.
- `actual-e33-closed-native-readback.json`: `2335e7a3407d04763350467020849bfd0495335ba6c11c246b3f00aed327bfaa`.
- `actual-e33-closed-status.json`: `5dd95d54d42344e878508d0e9dc7b69c0610ccffe662ce93f97ba38bd7b2d65e`.

Those are previously saved native facts, not production actions or new native proof performed by these tools. Source contribution/reconstruction, independent packaging review, formal repository merge, installed/loaded control cohort, actual fixed-op recovery and future business releases remain separate lifecycle states. No successor key, snapshot or operation is selected by this package.
