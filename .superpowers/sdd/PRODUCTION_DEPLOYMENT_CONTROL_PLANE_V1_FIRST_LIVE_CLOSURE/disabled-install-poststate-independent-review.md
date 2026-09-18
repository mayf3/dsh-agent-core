# Independent disabled-install post-state review

Reviewer: `dcp_first_live_binding_review`, independent of the operator and installer author. Review date: 2026-09-18. Scope: the completed, fixed read-only observation after the exact disabled installation and unsuccessful one-shot reviewer login. This review used ordinary UID502 file reads, public executable hashing, offline signature verification and source inspection only. It did not run sudo, a native helper, a production endpoint, login, service control or any protected-state mutation. No private-key or authentication-file contents were read.

## Verdict and precise state

`DISABLED_INSTALLATION_COMPLETE = YES`, for the exact package/plan and original attempt below.

`DISABLED_CONFIGURATION_VERIFIED = YES`; activation records and socket directory were absent in the observation, and no agent-deploy executable or UID612 process appeared in its process census.

`REVIEWER_LOGIN_COMPLETE = NO`; the visible login command failed, its original protected intent remains, and both the protected login-result and local auth file were absent. The external authentication outcome remains `UNKNOWN`; absence of local artifacts is not proof that the provider performed no effect. The installation itself need not be rolled back or repeated to describe this accurately.

`READBACK_EVIDENCE_REVIEW = PASS`, with the proof limits below. `FIRST_REAL_AUTOMATIC_DEPLOYMENT = NOT_COMPLETE`. No new installation-evidence blocker was found; the existing login/recovery and first-live blockers are retained in the union below. This verdict grants no operation authority.

## Exact evidence binding

Evidence directory `O`:
`/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01/reconciliation-bcfd929/login-failure-readback/observation-once`

Prior operator directory `P` is the sibling of `login-failure-readback` named `readonly-prefix-continuation-01`. All numbered filenames below are relative to these exact directories.

| Coordinate | Exact value |
|---|---|
| Original native attempt | `genesis-65559dd-20260918-01` |
| Installed source | `bcfd929b7c760947df9c6f03a830a9e8a0b16651` |
| Installed source tree | `ed0d500fff0546abb68099a4ab51a0114827fc0a` |
| Package SHA256 | `5bf407d815068e84d9dcfbbbe442498169bb43ab98f388b168bd5d6eca40911b` |
| Plan SHA256 | `c3a5ed50ffe2588cedc26b7ba3931aef85de496143ea355d70b773648b6bd38e` |
| Reconciliation companion SHA256 | `588572b7568c91aedeedc8cf817ed0c9d809dded45fc12f740f3f2d13b584d6e` |
| Host binding | `343ecc65a7edc224c7b235c9bdbcc964ef5e81475734dc97bb1fa057e2959024` |
| Readback result SHA256 | `5168000958f4778e1a9adfa06db1ddee576f890c204c292d4c7a384edf7e52cf` |
| Readback Python SHA256 | `7bb330e90dd1d20e36d45d8492674b4a0204de41eac433235303b4a042ec4cb4` |
| Readback manifest SHA256 | `bcd0a503ca8173d87027fcbd96a1fcb291d368e709c680bafc90b0d8945584b9` |
| Readback command SHA256 | `d01d7033552b486db82084d22d9a47d4b04d049a66154a05b7f7684dbbe6f64b` |
| Imported operator SHA256 | `3f272d7f1328f3386735a272b18233d8199c105ee7f93931d97d29308adb9280` |
| Original operator manifest SHA256 | `a13c3c55abc9eccc571bbcd355e1ba9132088e73a7b6f7e9ed00d3d1dc5174f4` |

All nine files bound by the readback manifest match their expected hashes. Package, plan, review record, initial registry and supervisor policy bytes match the companion's pins. The protected owner-authorization export (`O/049...stdout`) binds Owner `mayf3`, this host, original attempt, all six corrected pins and `DisabledInstallationOnly`. Its recorded one-hour grant remains historical authority for that operation, not authority for replay or activation.

There are exactly 509 files, 223,058 bytes, in this observation directory: 169 command JSON/stdout/stderr triples plus phase and result. The SHA256 of the deterministic UTF-8 inventory formed by lexicographically sorted `sha256 + two spaces + basename + newline` is `7a7d2c64729b7eb611f08efa1c16f676de27fbd8efc523cb76ab0c960605edf0`. This report seals the ordinary exports reviewed; it does not turn them into independent cryptographic root attestations.

The phase record is 05:11:13 UTC. Ordinary file timestamps place the captured commands at 05:25:54–05:25:57 UTC after local authentication, not at the earlier phase timestamp. Per-command JSON has argv and exit status but no trusted wall-clock timestamp. Findings describe that bounded observation, not continuous monitoring.

## Independent checks of the observation

The 169 recorded argv exactly belong to the reconstructed 133-tuple read-only allowlist: 72 stat calls, 69 ls calls, 22 public cats, one process census, one existing-plist hash command and four numeric directory-service lists. No installation, login, launchctl, chmod/chown, signal, root interpreter, endpoint or private-key/auth content command occurs. The separately inherited visible `sudo -v` is local authentication and is intentionally absent from captured command output.

All successful captured calls have exit0 and empty stderr. The only five nonzero calls are precise stat/ENOENT observations: auth.json (034), login-result.json (062), activation.json (160), daemon-activation.json (161), socket directory (162). Their stdout is empty, exit is1, and stderr does not report permission denial. The public login-result is absent, so only22 of23 possible public cats occurred. Every present public export has exactly matching metadata before and after its cat, root:wheel regular single-link ownership, no group/other write, flags0, no additional ACL lines, and bytes/hash matching the result index. There is no readback-error or original operator-result falsely claiming successful login.

### Completed installation and real local custody

`P/132-native-install-once.json` records exit0 for the single exact native install argv. Its stdout and the later protected `steps/installation.json` export (135) agree semantically on `INSTALLED_DISABLED_PENDING_OWNER_LOGIN`, the exact plan, `activation_allowed=false` and `runtime_enrollment_complete=false`. The final protected receipt SHA256 is `2d3b0e23b20aaaf3187a40a813e10098c1c0a639a61810f7e82bec7dca62bbb7`.

The protected steps directory (159) contains exactly seven intent/result pairs (000–013) plus installation.json; no unpaired installation step or failure record appears. Results cover CreateIdentities, CreateDirectories, InstallPayloads, GenerateRoleKeys, ImportRegistry, WriteDisabledConfiguration and ReadBack. The exact packaged source's `execute_steps` writes installation.json only after every successful result. Its ReadBack verifies installed files, reviewer identity/shell/home and caller group membership, loads each custody key inside the trusted native process, compares original service/sudoers surfaces, and checks absent activation markers. These are source-bound installation checks; this reviewer did not read key values or repeat those operations.

Fresh ordinary reads of the four protected public executable bodies match the companion: bootstrap `d918d8f6f1d5e84334cd4a5e130cca998bcc5eb049a5de10a95093c0f4e7fe3c`, issuer `13f1afd7173356069939253ea53a06b757ca0d76442cff42fd9c61f3161b22cb`, daemon `d334470bfac831b6dee1ce314ac8db6aecdafcca7aec9804336ad6362e743a88`, Codex `b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3`. All are root:wheel0555, regular, single-link, flags0. They were not executed by this reviewer.

The observed state root, issuer-keys directory and bootstrap attempt directories are root:wheel0700. The six role-key files have root:wheel0600 metadata, single links and flags0. Only their metadata and directory names were exported. The reviewer home is UID/GID612 mode0700; its fixed workspace is root:wheel0755. Local and Search directory-service exports agree byte for byte: `_dcp_review` uniquely occupies UID612/GID612, `_agentdeploy` GID602, and `yanfenma` UID502. Those numeric lists alone do not re-prove the user's primary GID, reviewer shell/home or group membership; the successful exact native ReadBack provides those installation-time assertions.

The public service catalog and local-trust export contain the same six role keys. Their complete hashes differ as expected: local-trust has no profiles, while genesis inserts disabled dsh-app into the service catalog. The service catalog digest recomputes to `762adce7cac1d37d1119528ea85959ac9adddf515e727209c87754404acfddae`, matching the step results. Offline Ed25519 verification succeeds for the revision1 registry ledger and its nested Owner enrollment against these public keys and the actual domain-separated canonical signing format. This proves internal signed-record consistency, not an independent remote trust attestation.

The real registry contains exactly the Broker deployment child, `Pending`, row revision0, with no READY/proposal/closure and `business_goal_complete=false`. Its original mandatory Watchdog dependency remains present. This installed v1 registry has neither the newer signed child mapping nor a real Watchdog semantic PASS; genesis success is not first-task executability.

### Disabled state, lock and unchanged-service limits

The service export (140) has dsh-app `enabled=false`, `socket_ancestor=null`; controller plist (155) has `Disabled=true`, `RunAtLoad=false`, `KeepAlive=false`, root:wheel identity and fixed daemon path. Activation records and socket directory are demonstrably absent. Process export019 has1056 rows and no UID612 or `agent-deploy*` executable. This supports disabled configuration with no deployment process observed. The observer did not inspect launchd's override database or loaded-job table, so it is not a fresh launchctl inventory; no such extra claim is needed or made.

The permanent bootstrap lock has UID/GID0, mode0600, single link, flags0, size0, device16777230 and inode85166163; birth/mtime/ctime all1789696678. Its exact stat tuple matches protected-prefix records038/041 and final-preapply records100/103. The file was retained, not removed or replaced. File metadata does not prove current advisory-lock ownership, lease validity or that another unrelated deployment transaction is safe.

All17 existing system plist hashes in163 equal the preinstallation057 export byte for byte (SHA256 `6c4760d6161a8255db767b9be9000aa52d52e7974cdafd672c4cd83117be4b0c`). This includes runtime, W1/W2, auth-service and the selected legacy entries. Native ReadBack also checked service and sudoers census equality at installation completion. This observer independently rehashed the plist set, not sudoers or service health.

Comparing preapply process056/118 with poststate019 shows all21 rows selected by UID505 or the two relevant installed Node executable paths retain the same PID/UID/start-time/comm tuple. In particular PID53645 remains UID505 with installed agent-core Node path and start `Fri Sep 18 06:44:17 2026`; PID586 retains `/usr/local/bin/node`, UID505 and its prior start. Because `comm` omits arguments and launchd labels, this is selected-process continuity, not proof of service ownership, whole runtime health, W1/W2 periodic success or absence of every transient/restarted process. No runtime/health/canary endpoint was queried. It is safe to report unchanged selected plists and process tuples; it is not safe to report “all existing services healthy/unaffected” from this evidence alone.

### Login outcome and mandatory recovery boundary

`P/operator-error.json` records reviewer-login-once / VISIBLE_COMMAND_FAILED / retry_forbidden=true / automatic_rollback=false. The visible command intentionally leaves authentication output on the TTY, so this JSON does not independently distinguish timeout from another nonzero exit. The parent's observed600-second failure is consistent with the packaged600-second guard, the recorded04:37:10 phase and ordinary04:47:11 error-file timestamp; these observations must not be inflated into provider-state proof.

The protected original login intent (059, SHA256 `3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6`) binds the exact plan, `FIXED_REVIEWER_DEVICE_LOGIN`, and parent PID92502. There is no protected login-result, no auth.json, no current UID612 process and no bootstrap process in the snapshot. The permissible state is **local reviewer prerequisite incomplete; external result unknown and retained**. It is neither successful authentication nor permission to replay an unused allowance.

The exact bound reconciliation runbook lines112–113 require: “Login fails/times out: retain login-intent as unknown and do not retry.” Source files inspected match the installed plan's source hashes. `genesis_install_actions.rs:79` appends login-intent before spawn; `genesis_install.rs:140` uses write_new and `fs/file.rs:80` uses O_CREAT|O_EXCL. Thus the existing native reviewer-login cannot safely be rerun on this history. The login child at `genesis_install_actions.rs:117` independently requires the recorded parent PID to equal getppid; direct child invocation is not a recovery interface. Timeout/nonzero exits return BOOTSTRAP_LOGIN_OUTCOME_UNKNOWN; only success appends login-result.

Any future login recovery must be explicitly reviewed and separately authorized within the next complete exact Owner operation package. It must preserve this attempt, old intent, receipts and permanent lock and add a bounded, distinctly journaled reconciliation with its own exact authority. It must not change attempt ID, delete/replace intent, rerun the old command, bypass parent binding, copy caller credentials or perform a bare UID612 Codex login and present it as the original workflow. No such recovery is implemented or executed by this review, and the expired original grant cannot become a renewed budget.

## Remaining blocker union for the first real loop

This union preserves the parent first-live path and the reviewed adoption design; it does not reopen unrelated closed findings or claim a fresh review of work now in progress.

1. **Isolated reviewer prerequisite:** login is incomplete/unknown. A separately reviewed, exact and once-authorized reconciliation is required before relying on real issuer review. The present observation closes the missing-poststate-evidence gap, not the login gap.
2. **Deployed controller versus candidate:** installed source remains bcfd929 with disabled v1 policy/registry. The reviewed e8f863f dependency/source-policy repair and subsequent first-baseline/observer/predecessor implementation work are distinct, uninstalled candidates. Their final exact implementation, validation, independent source review and package binding must be completed separately. This report is not that review.
3. **Real target authority and preimage:** the latest external scheduler restoration claim and selected ordinary-file observations are not this lane's protected full target generation, transaction/lock closure, complete app/loader/config/plist preimage or accepted upstream compatibility proof. Freeze the real target before proposing the exact adoption and Broker artifact.
4. **Watchdog prerequisite:** actual authenticated current-generation semantic acceptance, including accepted migration/routing/readiness/real canary/dedupe requirements where applicable, remains mandatory before Broker mutation. A source match, health-looking process, genesis receipt or generic native readback cannot substitute. The authentic zero-reinstall baseline and signed exact deployment-child mapping must become real durable records; the installed registry is still Pending with its unresolved original prerequisite.
5. **Production authority and isolation:** exact target adoption, necessary legacy-entry retirement and caller denial, NativeEnrollment/activation custody, one mutex, pending activation fence, conditional canary/enable and recovery still need one complete reviewed Owner operation package and explicit authorization. No production target takeover, service restart/enable, sudoers change or routing transition is supplied by this disabled-install authorization or report.
6. **Observed closed loop:** after those gates, a real enrolled Broker obligation must traverse trusted issuance, fresh prerequisite admission, serialized apply, actual target/semantic verification, safe finalization and durable producer-child closure without a new routine per-release sudo prompt. None happened here. Parent Goal obligations and unadopted scope remain separate from that first success.

No further protected readback, polling, retry, cleanup or production action was performed to fill these gaps. The next useful work is bounded nonproduction preparation and review of the complete operation path, followed by one concrete Owner authorization request when ready.
