# MANIFEST — workflow-transition-final-f4bc431 (制品 执行 round, sealed 2026-08-31T14:50:29Z)

Round: ARTIFACT_BUILD per AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1 (accepted @ main 1a9b81de), CTR-HD-006 step 2.
New provenance from frozen RELEASE_SOURCE_COMMIT f4bc4311225c9e0fd906ce108a5b9ffdbd83a957 (CTR-HD-010: old artifacts db573426…/482e19c9… never referenced; their directory not entered).

## Files (sha256) — all deliverables except this MANIFEST.md itself

```text
15be1175082f262783c1d1bca28ab85548bd0073cd69050f4252c897623e635e  DEPLOYMENT_MANIFEST.json  4092 bytes
000e253073f6b5f04e1eed68af47b3736d93c6b545ee729bd78dd0d98894d80b  OWNER_EXECUTION_PLAN.md  10776 bytes
bfca69d42005f04a5845a7052d8f2f7e6d7ce637b552e16fa8853d6dc5b29f93  SOURCE_STAMP.json  3888 bytes
d8e20270c7206882929fc372fd2fc146121ec180cb03a8e068507ab9006b8792  drill/ROLLBACK_DRILL.md  2908 bytes
e9ffdf6040f0872d729293f239d513fc9fb9e68721ef0c1f80533ca40efe0d92  drill/enumerate-manifests.mjs  2867 bytes
533eb2c2f33d0bd126673111569e8c963e0d877a98464f53046ae339715f3825  drill/preflight-read-only.txt  3389 bytes
ca8b2137a9f1326cd16b78c09b41b0bbafab1c8356db32ec327482e49dac208c  drill/rollback-drill-transcript.txt  3284 bytes
7a30bbda31436ecb43ee562f3dbb69cf3fc06790341ad354e52f2b6206969013  drill/secret-scan.txt  702 bytes
50ed9c52886ef0b28f16b55da157d9a6befa039e9aa5d89cc3512282bcd200d5  rollback/PREIMAGE_META.json  1088 bytes
fe290f9fefb112f9b50a9ec0fff273267d37c02c5f4dc7c4e90e286d252eedb6  rollback/rollback-preimage-04ca8550.tar  20480 bytes
67e5e183722ed50601ff84ca7dc0f6c217bc4f67c4ce826f301f53ef40f82473  workflow-transition-f4bc431.tar  30720 bytes
```

## Binding digests

- ARTIFACT (canonical): workflow-transition-f4bc431.tar sha256 67e5e183722ed50601ff84ca7dc0f6c217bc4f67c4ce826f301f53ef40f82473 (30720 bytes); single regular member workflow.js == git blob 577c8778cf35810ce7538aff52ab354e0c1dddc6
- ROLLBACK BUNDLE: rollback/rollback-preimage-04ca8550.tar sha256 fe290f9fefb112f9b50a9ec0fff273267d37c02c5f4dc7c4e90e286d252eedb6 (20480 bytes); member == git blob 04ca8550fbdaf9b66624dea42701a8a9af7547a8
- DEPLOYMENT_MANIFEST.json sha256 15be1175082f262783c1d1bca28ab85548bd0073cd69050f4252c897623e635e
- Any byte change to any listed file voids audit + Owner authorization (CTR-HD-008).

MANIFEST.sha256 = sha256 of this MANIFEST.md (this file is not self-listed; sealed externally).
Note: macOS attaches an empty com.apple.provenance xattr (system-managed, non-removable) to user-session-created files; it carries no value and does not affect any byte or sha256 above.
