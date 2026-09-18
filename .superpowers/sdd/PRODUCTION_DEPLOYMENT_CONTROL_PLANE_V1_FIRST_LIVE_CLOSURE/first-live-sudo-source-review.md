# Independent fixed sudo and Plutil source review

**PASS for the frozen bounded components. No source blocker found.** No current service sudo policy, executable byte hash, production denial, full operator or package PASS is asserted. No sudo, root command, real policy query or service call was executed by the reviewer.

## Exact source

Operator worktree `/Users/yanfenma/workspace/worktrees/dcp-first-live-operator`.
Reviewed ce5284218b77363784a41be7c966f07f1076ee1c and the previously queued fixed Plutil addition f601db1 (diff against its parent). All tested ce52842 file bytes equal the frozen commit:

| File under packages/deployment-control-plane | SHA256 |
|---|---|
| src/first_live/sudo.rs | ca2f9452dd0d01d51fb935bb5f0c438f38bd116f8d946c588f6ac67e0c09a179 |
| src/first_live/process.rs | 835f06c74b94821862e8ea9d037804f5550cc1a20736ec0a581a4e9fe90a7591 |
| test/first_live/sudo.rs | 9cf7a222175370d7510becb2b0030b2f5a146cd7ab598fc12a1a01fbeaa6328a |
| test/first_live/process.rs | 64da959f98e3f33fa108c93936d105a48f0d76a08e3f2b396478f328c56137e0 |
| src/first_live/native_effects/inode.rs | c9ac6a2fa3c7a81b0ac77843d5c933d9e228491f0b81a0ecf8b95451d091ed86 |

## Security reasoning

sudo.rs freezes the complete observed regular-file root:wheel04511/single-link/flags0x80020/device/inode/size/mtime/ctime/birth tuple. `metadata` additionally rejects ACLs. process::pinned opens only the fixed tool path through protected nofollow ancestry, applies this exception only to Sudo/SudoAudit, rechecks the exact descriptor tuple before and after bounded byte reading and compares actual SHA with the observation-derived expected digest. Generic platform-file setid rejection remains intact. This reuses the already-reviewed initial Apple executable trust contract; it does not claim an unreadable ordinary byte hash was known before the authorized prefix.

SudoAudit accepts only the root execution role and exactly `-n -l -U #505` or `#612`. Ordinary Sudo is only UID502:GID20 and exactly `-n -l`. No command operand, other target identity or generic root sudo route is admitted. Hostname and canonical UID/name/GID are checked before and after each audit. Exact successful no-command stdout plus empty stderr is required; password/config errors, partial output, additional grants and identity/host drift fail. The existing clear environment, bounded capture, aggregate1MiB limit and residual-process/UNKNOWN handling are retained.

The success code **0** for this one no-command listing is supported by retained primary sudo v1.9.17p2 sources, not inferred from generic CLI failure conventions. `plugins_sudoers_display.c` lines430–542 routes the sentence through SUDO_CONV_INFO_MSG and returns true even when count==0; `src_conversation.c` maps INFO to stdout; `src_sudo.c` lines1296–1337 exits `ok != 1`. Their retained index pins upstream d1b48c651cec19fe37d1f0d3299d2283fb0f88e4. The inspected display/source hashes are e8da2cc2bcf4b9619831d73332849923bcd7051a69661f58ecc7ee1b95d86d53 and9170712e11e3ad4a762020b7c4d221453f3538f917e134bdabb6a5cac6959643. An Apple-specific live divergence will fail the exact parser; it is not licensed as a different PASS response.

The Plutil role fixes `/usr/bin/plutil`, caller UID502:GID20 and exactly `-lint /usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist`; write/convert/other-file/extra-argument/root roles are rejected. This closes the fixed readable-input probe requirement without a generic public file API.

The two inode.rs cfg(test) lines remove historical tree recovery from production reachability while retaining fixtures. They do not implement or prove the new-closure availability recovery driver. That driver remains a separately reviewed integration gate.

## Independent tests and limits

Ordinary private-fixture runs from the operator worktree:

- `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::sudo:: -- --nocapture`: exit0,5 PASS; log sudo-independent-review.log SHAec0357d76fc58d86cbffa9622d165ec97f0e2df1b7cee76cfa98cf0ef872021d.
- Same command with `first_live::process::`: exit0,14 PASS; log sudo-process-independent-review.log SHA67e1474ad0e4efa17f99d9c852ddb8832c068e9947889b02fccc482618daffe0.

Logs live under `first-live-preparation/`. Tests reject every frozen metadata-field drift, a generic copied setuid fixture, nonroot audit invocation, wrong/status/stream/name/host/grant output, arbitrary sudo argv and wrong identity. Process fixtures also exercise actual nonroot timeout, residual-child and combined-output constraints. The fixed real production runner refuses nonroot before touching its tools.

Surrounding operator wiring remains in progress; no full-tree build/test/security claim is made. Final integration must bind the frozen tuple/ACL checks and one actual authenticated shasum prefix result into the exact Owner package, keep complete sudoers/config/plugin/include custody and actual fresh effective-policy checks, durably record operation observations, and independently revalidate native packet/current state. This component does not prove those external preconditions or turn fixture output into production authority.
