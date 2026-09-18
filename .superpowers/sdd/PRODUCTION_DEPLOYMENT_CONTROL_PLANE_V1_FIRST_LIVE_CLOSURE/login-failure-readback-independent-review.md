# Independent login-failure readback operator review

Reviewer: `dcp_census_repair_review`; 2026-09-18. Independent of this readback operator's author. Scope: exact prospective read-only operator, its pinned utility/manifest, authority boundary, and nonprivileged validation. No root command or execution-mode readback performed by reviewer.

## Exact coordinates

Directory:
`/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01/reconciliation-bcfd929/login-failure-readback`

Independently recalculated SHA256:

- `readback.py`: `7bb330e90dd1d20e36d45d8492674b4a0204de41eac433235303b4a042ec4cb4`
- `readback-manifest.json`: `bcd0a503ca8173d87027fcbd96a1fcb291d368e709c680bafc90b0d8945584b9`
- `readback.command`: `d01d7033552b486db82084d22d9a47d4b04d049a66154a05b7f7684dbbe6f64b`
- Imported original operator utility: `3f272d7f1328f3386735a272b18233d8199c105ee7f93931d97d29308adb9280`
- Original manifest: `a13c3c55abc9eccc571bbcd355e1ba9132088e73a7b6f7e9ed00d3d1dc5174f4`
- Companion: `588572b7568c91aedeedc8cf817ed0c9d809dded45fc12f740f3f2d13b584d6e`
- Native attempt remains `genesis-65559dd-20260918-01`; corrected source/package and plan remain the previously reviewed exact bcfd929 / 5bf407d… / c3a5ed50… tuple.

## Verdict

AUTHORITY_CONFORMANCE = PASS for this one fixed read-only observation.
SECURITY_AND_CODE_REVIEW = PASS for the exact bytes above.
BLOCKERS = NONE.

This verdict does not authorize another install/login attempt, root interpreter, native command, service activation/restart, cleanup, signal or lock deletion. It is not post-state verification or proof that reviewer login completed.

## Authority and reachability

The original bound Owner mandate authorizes exact disabled installation once, reviewer login once and fixed public readback, with no retry/automatic rollback/activation. The parent reports the same Owner's reviewed verification/recovery continuation. This operator performs only the outstanding observation after the known one-shot login command failed. It neither consumes a new native/login budget nor interprets a later “continue” as permission to replay unknown effects.

`validate()` hashes the exact prior installation command/output, login phase/error, prior public service hashes, mandate and original manifest. It requires install state `INSTALLED_DISABLED_PENDING_OWNER_LOGIN` bound to the exact new plan, the exact `VISIBLE_COMMAND_FAILED` login-phase error with retry forbidden, and absence of original final result. Those are appropriate entry conditions for investigation, not a claim that protected post-state is already verified.

The imported operator's `if __name__ == '__main__'` guard prevents importing its install path. The new script replaces its root allowlist before any execute-mode use. Reachable root argv consists only of exact stat/ls, 23 fixed public cats, fixed existing-plist hashes, non-argument process census and numeric directory-service lists. No install/chmod/chown/native/bootstrap command, arbitrary input path, shell, interpreter, kill or login command is in that allowlist. The reviewer-login failure cannot fall through into a replay.

## Safety checks inspected

- Launcher binds shasum, isolated Python, manifest and readback source hashes; Python and utility enforce uid/euid502 and gid20. Python runs ordinarily with `-I`; root receives fixed individual utility argv through `sudo -n`, not source code.
- Reused run helper has clean fixed environment/cwd, exact root argv membership, 120-second captured-command timeout, create-exclusive evidence files and fsync. Interactive `sudo -v` leaves authentication on the local TTY, not a pipe/log. This authentication is not native reviewer login.
- `--execute` requires visible TTY and creates `observation-once` exclusively before authentication/root observations. Existing guard stops a repeat. A failure retains evidence and no-retry status, without automatic rollback.
- Current tools are rehashed and checked against exact recorded root ownership/mode/flags/nlink; allowing recorded nlink2 for macOS shasum/stat is an exact pre-existing tool metadata binding, not a general hardlink relaxation. Sudo's fixed system metadata and ACL check remain present.
- Installed new executable bytes are freshly checked. These are nonprivileged hashes, not native executable invocations.
- Protected ancestor metadata/ACL checks precede content reads. Public exports require root:wheel, regular single-link file, no group/other write, flags0, no ACL; before/after metadata must match. Same fixed 23 public receipt/config/catalog paths from original manifest are used. Private issuer-key files and reviewer auth.json are metadata-only. No secret/private-key/auth body path is cat-enabled.
- Login result and auth metadata may be absent. Public-readback hashes, presence/absence and directory inventories are retained; missing login-result cannot be silently converted to completion.
- Process census uses `comm`, not command arguments/environment; any uid612 process or bootstrap executable blocks further readback. This is a conservative observation gate, not a process-kill operation or durable liveness proof.
- Activation records and socket directory must be absent. Existing unrelated system plist hashes must equal the bound preinstallation export. Permanent bootstrap lock is observed only.

Public receipt contents are captured only from the already classified original public surface. The script reports `READ_ONLY_OBSERVATION_COMPLETE`, explicitly `login_completion_not_inferred_from_auth_file: true`; it does not claim receipt semantics or completed login by itself.

## Executed nonprivileged validation

Reviewer executed only:

`/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/bin/python3.9 -I <exact-directory>/readback.py --validate`

Exit0; output `READ_ONLY_OPERATOR_VALIDATION_PASS; NO_SUDO_EXECUTED`.

This verifies current bound local evidence, tool metadata and installed executable hashes through the reviewed ordinary path. No `--execute`, sudo or root observation was run. No tests or native commands were replayed.

## Post-observation proof still required

After the separately executed one-shot readback, independently inspect the actual protected-export command receipts/results, complete installation step/installation receipt, login-intent and login-result or absence, identity/metadata, process observation, disabled configuration, absent activation/socket and unchanged existing plist hashes. Classify login from authoritative result and bounded process/effect evidence; auth.json existence alone is insufficient. Failure/absence/unknown remains explicit, and this review grants no retry. Ordinary exports are attributed observations, not cryptographic root attestations; their exact command/result provenance and limitations must remain visible.

Additional clarification: visible local `sudo -v` intentionally retains the original helper's unbounded interactive wait; the 120-second bound applies to captured read commands, not this prompt. This is not a blocking safety defect in the fixed no-retry read-only surface: no native/login operation follows from authentication and the user can cancel locally. A 120-second authentication timeout is a reasonable optional operational improvement, but changes script/launcher hashes and requires exact reseal/recheck; no timeout or completion claim is made for the current interactive prompt. The parent-retained `ordinary-validation.json` separately enumerates 133 fixed readonly root argv, public-content paths only, and no root execution; it is static/ordinary validation, not post-readback evidence.
