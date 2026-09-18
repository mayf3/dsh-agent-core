# Independent domain-probe and W2 signal source review

Verdict: **PASS for these two bounded component deltas; no component ship blocker found.** This is not a complete operator, package, production-denial or first-live verdict. No root/service/production call was made. Review was independent of the author and used source inspection plus ordinary private fixtures.

## Exact source boundary

Operator worktree: `/Users/yanfenma/workspace/worktrees/dcp-first-live-operator`.

| Commit | File under packages/deployment-control-plane | SHA256 |
|---|---|---|
| 83e58fef59f524638d849eb82dd7d2bac7a160dd | src/first_live/native_effects/domain_probe.rs | ac7c7f0b8f1593483530780d341635694804281038662209d6cfca021ffcb2ef |
| same | test/first_live/domain_probe.rs | ba9b07026e160e9a24e305814d9919061f11b1fb3f1eae8d5fbf37669979e92c |
| 4fc197d62fd17c9259cba869f93f55a6ba77327e | src/first_live/native_effects/denial.rs | d115e32cc42ff730fcb467f598860f1d20e9d56fc2392803d421531999a2ea1c |
| same | test/first_live/denial.rs | ee8fee7deacf6f02b804ee1028977ae205807819370fd73f54fdce266c96a640 |

All four tested working files were compared with `git show` at these commits and match exactly. The W2 review is the delta from its immediate parent; previously reviewed denial behavior remains covered by its existing verdict and regression run.

## Findings and reasoning

Domain source lines19–30 fixes one public plist name, label, inert `/usr/bin/true` argv, authsvc identity and disabled RunAtLoad/KeepAlive. It does not relax protected state permissions. Lines52–80 and184–203 bind file bytes/owner/mode/flags and held versus named inode plus protected root:wheel0755 parent. The ordinary fixture runs real `/usr/bin/plutil` only on its private plist and verifies its complete JSON content.

Lines82–114 require exact readable-input success, explicit permission-denial output and an absent exact label. Missing-service/I/O results cannot become authorization-denial PASS. Lines145–166 establish absence, exclusive durable intent and file creation, actual caller readability and bootstrap observation, current file readback and exact label absence before returning proof. Unknown command status/result stops before speculative cleanup.

Lines168–182 retain failed evidence and authorize cleanup only for the exact observed inert, never-run, no-PID label at the owned pathname. Even successful cleanup returns failure. Unexpected or ambiguous loaded identity stays untouched. Owned file removal independently journals intent, rechecks current inode and confirms absence. A consumed attempt cannot replay creation. The production wrapper fixes every tool/action/argv and caller role at lines204–247; there is no caller-selected program or target.

The W2 delta at denial.rs251–278 permits an expected UID0 process alongside UID505, preserving bounded positive PID, complete ProcessIdentity equality before and after the probe, a one-to-three process bound and existing fixed low-privilege syscall child. This fixes a valid running root W2 being rejected before its permission test. It grants no root signal execution. The child still calls only `kill(pid, 0)` as the caller and requires EPERM; disappearance/ESRCH and unexpected success are not denial proof. New tests exercise birth/PID/path/GID drift and reject caller/other UID and invalid PIDs before querying identity.

## Independent verification

Executed from the operator worktree, without sudo or root:

- `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::native_effects::domain_probe:: -- --nocapture`: exit0, **12 passed**, 0 failed/ignored.
- `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::native_effects::denial:: -- --nocapture`: exit0, **22 passed**, 0 failed/ignored.

Logs under `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/`:

| Log | SHA256 |
|---|---|
| domain-probe-independent-review.log | 3f7baa538e71a542808cf7a994498a00dfb4891af9eb4733f75f570c2d6d8e99 |
| denial-w2-independent-review.log | aae4ecf498838ed4b9e331886d8fdd93039d3cf4c878325685bbdc4088256834 |

Counterexamples include unreadable/invalid input, missing label, absent exit status, operation unknown, foreign or replaced file, prior consumed attempt, ambiguous loaded label, cleanup failure, actual writable-file and same-UID signal success, real fixture permission denial and process identity drift. Mocked root identity tests do not invoke a root PID.

## Integration boundaries retained

The test binary used the in-progress operator module wiring; there is no whole-tree source freeze or full-suite claim. At inspection the supporting uncommitted files were commands.rs SHA30922495808b9d061f27b3fd316dde848ad388d32c5c2d01ef03dd0a23c4b0ad, launchd.rs SHA6aab2fa6b5d58cf26acc22fa9309dea9b422a228164a5590a45395344b72e0c7, first_live/mod.rs SHA6c994cd44445fb95a59cf9881b25e3c7a00de1703eac0b25131b04f4caa0fec4 and native_effects/mod.rs SHA47b59f6be4a641133f017c80f53c81dee627768a731db66e7848987fb26bc108. These supporting hashes record context, not independent PASS for their entire content.

Final driver/package review must still establish: (1) live exact Owner grant and one held production mutex around fixed effects; (2) commands::observed durable intent/result and validated pinned tools, caller groups, timeout/UNKNOWN behavior; (3) actual full protected pre/post leaf and service census, including only the exact selected Runtime/W1/W2 generation and W2 only when running; (4) conditional cleanup/recovery explicitly present in the Owner effect manifest; and (5) failure never yields VerifiedLifecycle/admission. Domain fixture success is not a production permission observation. The separate Plutil process-role addition and remaining operator integration require their own final source review. All previous production authorization boundaries remain unchanged.
