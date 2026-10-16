# #1156 source custody ACL approval draft

Status: proposal only. Nothing below has been applied to production. This is a bounded permission companion to the source-only cross-UID repair; it does not authorize implementation/production loading, create caller identities or grant native send.

Measured identities are trusted runtime/facade `authsvc` uid505 and the original BIP child `yanfenma` uid502, gid20. These must be derived/read back from the original supervision/spawn configuration and OS, not supplied by MCP/model arguments. A mismatch stops the apply.

## Fixed objects and least privileges

| Path | POSIX ownership/mode | Only requested ACL delta |
|---|---|---|
| `/Users/authsvc` | current root:admin0755 | none |
| `/Users/authsvc/.agent-core` | current authsvc:authsvc0711 | none |
| `/Users/authsvc/.agent-core/control` | current authsvc:authsvc0700 | named user yanfenma: **search only**, no inheritance |
| `/Users/authsvc/.agent-core/control/native-conversation` | authsvc:authsvc0700 | named user yanfenma: **search only**, no inheritance |
| `/Users/authsvc/.agent-core/control/native-conversation/source` | yanfenma:staff0700 | named user authsvc: **search/readattr/readsecurity** on the directory itself; separate file-only inherited **read/readattr/readsecurity** ACE on newly created regular source files |
| `.../source/<sha256-native-request>.json` and temporary atomic-write files | yanfenma:staff0600 | inherited named authsvc read/readattr/readsecurity only |
| `/Users/authsvc/.agent-core/control/native-conversation/acks` | authsvc:authsvc0700 | none; child has no read/write/search on this leaf |
| `.../acks/<sha256-native-request>.json` | authsvc:authsvc0600 | none |
| `.../requests.json`, private DSH config, original locks/journals/state | keep original metadata | none |

The two ancestor search entries allow a child to look up a known source path but do not list/read the parent control tree. There is no child read/write ACE on request records or ACK metadata. The parent receives no source-directory add/delete or source-file write/append permission. It can formally read known hashed source coordinates without listing the source directory. General private JSON predicates stay same-uid and private.

The source directory must begin empty when first provisioned for the new feature. If it already exists, capture its real state and require exact expected preimages; do not recursively chmod/chown/reset ACLs. Source temp files must be created in this same directory so they inherit read-only authsvc access and retain it on atomic rename. No blanket group access,0777, changing Agent uid to505, or accepting arbitrary UID lists.

macOS `chmod` syntax corresponding to these proposed ACEs is:

```text
user:yanfenma allow search
user:authsvc allow search,readattr,readsecurity
user:authsvc allow read,readattr,readsecurity,file_inherit,only_inherit
```

The source's two authsvc ACEs must remain separate because one applies to the directory and one applies only to inherited files. Use explicit ordered ACE insertion and exact readback in the approved apply implementation; do not rely on automatic merging of same-identity entries. These lines describe permission contents and are not an executed deployment script.

## Before the approved apply

Capture actual directory existence, UID/GID, POSIX mode, flags, complete ordered ACL and any relevant extended metadata for each touched existing object. Store restorable metadata and actual changed-file bytes in the guarded rollback packet; hashes alone are not a backup. New paths have an explicit absent preimage. Resolve and reject symlinked ancestors/source/ACK paths. Preserve unrelated pre-existing ACL entries exactly; abort on drift or a conflicting broad ACE instead of replacing them.

Record expected parent505/writer502, sourceRoot, ackRoot, hashes of source-only helper code, package runtime root and approval receipt. Do not write these permissions to the old user root or the scheduler-v2 root. Apply belongs to the original runtime's sole approved executor and its existing deployment/drain controls.

## Required isolated proof

Use a uniquely named temporary test tree, not any production directory, and the real505/502 OS identities. The fixture may temporarily set the proposed ACL only on its own files and must clean them after the tests. Show:

1. Writer502 reserves/writes a regular0600 source; reader505 opens and reads exact request/agent/session/message/turn coordinates via the formal reader. New atomic temporary files and their final rename retain the505 read-only ACL.
2. Reader505 cannot directly write, append or delete a source body; writer502 cannot read/write the505-owned ACK directory. An unrelated OS UID cannot read either side. No access to parent-private request records follows from ancestor search rights.
3. Descriptor checks reject wrong owner, symlink/hardlink, unsafe mode/ancestor and swapped path; absence of the named ACL produces a clear fail-closed source error.
4. Parent505 writes only its private ACK fields(version, exact request/agent coordinates, source raw-byte SHA256 and expiry). A modified source hash or mismatched ACK cannot extend retention or produce an available reply.
5. Reply→result-write fault, process restart and main reset preserve the exact original result source. Expiry is explicit; pending/UNKNOWN data and idempotency tombstones are not deleted. Original request replay count stays one.

Record OS identity, safe stat/ACL readbacks, code hashes, test results and proof limits. A simulated `process.getuid()` test only demonstrates the old failure and cannot prove the repaired OS access path.

## Withdrawal

Normal stop-send keeps the source read ACL/ACK metadata/result records available for original-result retrieval. It only removes `send` from DSH operations.

For a separately approved full feature withdrawal, stop native admission and preserve all canonical request/result/source/ACK bytes before changing access. Restore the exact captured ACL/mode/ownership of pre-existing ancestors, removing only the newly authorized named entries in the exact expected position/content. Do not clear all ACLs or recursively chown a tree. New source/ACK objects holding historical work remain retained under the approved data policy; withdrawing an access permission must not erase them. Verify unrelated original control/journal/HR/Scheduler/Binding state and the original runtime writer lane remain unchanged.
