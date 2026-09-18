# Independent bounded design review: fresh trusted regular inodes

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
REVIEWED_DOCUMENT=first-live-inode-isolation-design.md
REVIEWED_SHA256=ae5d7837dc2c7106eff7981a87322269046451084cf0f75f1e81118db5d385de
FROZEN_DESIGN_BLOCKER_UNION=NONE
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO_FOR_THIS_FINITE_CHANGE
IMPLEMENTATION_ALLOWED=YES_NONPRODUCTION_ONLY
SOURCE_REVIEW_PASS=NOT_EVALUATED
PRODUCTION_OPERATION_ALLOWED=NO

The reviewer did not author the design and independently recomputed the frozen hash. Scope is the newly established retained-write-capability gap in the same first-live metadata-isolation transition, and the proposed exact public-file construction/recovery repair. Prior unrelated findings remain closed. This is a necessary affected-boundary correction under accepted CTR-DCP-004/005/009/018 and migration §7, not optional future platform debt.

## Counterexample and selected closure

Changing a regular file's owner/mode and denying new pathname opens does not revoke an already writable open file description. A writable shared file mapping can retain that capability after its FD closes. A negative non-atomic per-process FD census also cannot exclude handoff/fork between scanned processes, and FD-only inspection omits retained mappings. No particular live process is accused of holding such a capability; the old-to-new permission transition itself leaves it reachable. Metadata-only hardening therefore cannot supply the claimed isolation proof.

The selected fresh-inode construction removes that capability from the trusted pathname instead of trying to inventory every process capability. With exact protected ancestry, known service quiescence and retired canonical writers, the native operator copies the reviewed bytes into newly allocated protected regular inodes and atomically binds the exact names to them. An old descriptor or mapping continues to reference its old inode and cannot mutate the new trusted inode. Complete final identity/hash/metadata/link readback is required before any new loader execution or lifecycle publication. No generic process/FD/mapping monitoring facility is needed.

Accepted Product Contracts do not require retaining mutable predecessor inodes. The earlier preservation rule belonged to the operation design. Changing that selected mechanism while retaining exact public bytes, approved content changes, finite paths, lock ownership, no business-data effects and exact recovery is REUSE. The actual storage/maintenance/write effects must nevertheless be described in the later exact Owner package; the previous disabled-install permission does not authorize them.

## Required finite boundaries confirmed in this design

- The scope is the enumerated app, harness, full old Node public tree, approved22 Node outputs, three system plists, five retired entries and already listed public control/configuration files. Keys, auth/credentials, business/runtime state, database/queue, ledger and genesis history are excluded. Already-new root-exclusive objects need not be rewritten. No additional path or routine deployment capability appears.
- Directory inodes remain and their protected permission/ACL state governs later namespace operations even through an old directory descriptor. Literal symlinks are not followed or rewritten; their complete fixed link graph still must resolve to approved protected closures. Any unlisted or unsafe dependency stops. Private creation descriptors must remain confined/CLOEXEC so the operation does not leak new writable handles to unprivileged tools.
- Each old public regular face is checked through its held descriptor against frozen identity, full hash and metadata. Verified recovery bytes are copied into separate new protected inodes and sealed before target publication; old inodes are never hardlinked/renamed into a supposedly safe backup. New final inodes receive full byte and approved metadata validation before atomic exact-name replacement, followed by fsync and actual path/identity readback. Concurrent changes to the old inode cannot be accepted merely because its earlier metadata matched; only bytes matching the frozen expected hash may enter sealed recovery/final faces.
- Exactly three approved two-name esbuild groups retain topology through three NEW shared inodes; ordinary final files retain nlink1. Every alias member is bound and the final count must be exactly2. Multi-name publication is journaled as one group and may be physically partial; interruption or incomplete proof remains unknown, never a successful lifecycle result. No routine artifact hardlink policy is weakened.
- Recovery uses the sealed byte copy to construct another new validated inode. It never reattaches an old inode whose still-open handles/maps could change it. Exact current postimage guards, grant/mutex, journal and explicit allowed recovery metadata/content still apply. Retired writer authority is not silently restored, and availability recovery is not permission to claim isolation or standing activation after failure.
- The finite resource preflight uses each affected filesystem's available space, conservatively at least three times its protected regular bytes plus approved Node payload bytes and256MiB headroom. The actual inventory,128MiB per-file bound and100000-entry limit remain pinned; traversal does not retain one descriptor per file. Space/time/write/fsync failure cannot produce admission authority. This is a pre-effect stop condition, not permission to reclaim unrelated files or exploit dedup/sparse assumptions.

## Evidence required before source/package PASS

The declared real private-file regressions must prove old writable FD and live writable MAP_SHARED mutations alter only detached preimages, never final or sealed recovery bytes; new closed-pair identity/count and ordinary nlink1; full hash/metadata/link/preimage rejection; and durable interruption at recovery sealing, publication and group completion. Insufficient-space and complete-inventory omission/old-inode retention must refuse before a lifecycle success proof. These tests exercise the actual implementation once written; this design review did not pretend to run them in advance.

The implementation must bind actual derived postimage inode identities, not caller claims, and verify the complete postimage before restored code executes. The exact package needs independently reviewed source, full affected validation, real frozen inventories/preimages, recovery and space/maintenance disclosure before Owner authorization. No concrete design blocker remains in the frozen finite approach. No live census, file replacement, root action, service operation, key/auth access or production mutation was performed by this review.
