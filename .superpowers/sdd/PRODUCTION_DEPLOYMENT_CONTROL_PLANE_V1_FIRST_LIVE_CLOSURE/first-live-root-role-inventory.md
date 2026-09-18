# Finite root-role inventory proposal — ordinary read-only evidence

Author: dcp_census_repair_review, 2026-09-18. This is a bounded evidence-selection report, not an independent review of the operator I authored, not a production census PASS, and not authorization to change another platform.

**The exact handover classification cannot currently be closed.** All165 historical rows remain ineligible as current authenticated identities. Additionally, the historical root Tailscale service has a concrete caller-owned executable/ancestor closure, so merely obtaining privileged current process metadata would not close its eligibility gap.

## Coordinates and method

Authority remains accepted `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0`, CTR-DCP-009/018. The bounded independent handover assessment is `first-live-legacy-process-handover-review.md`; no implementation of its unresolved exceptions occurred.

Inputs and retained outputs are under `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/ordinary-census/`:

- `legacy-root-process-metadata.json`: original165-row ps observation, SHA256 `fdaa8fea182a697566ea1c38d542c5f37f1a36e7c22408de7cad7215d2c6ac10`.
- `legacy-root-role-current.json`: fixed original PID set, one ordinary `proc_pidinfo(PROC_PIDTBSDINFO)` attempt per PID; SHA256 `18195f70c4d21e0af80fff5964054ddb00756b4b138ea171a952f8d47f28d9c4`.
- `legacy-root-role-eligibility.json`: all165 rows, exact candidate launch plist paths/hashes, selected public binary signatures/load commands, ancestry/ACL metadata and explicit gaps; SHA256 `1d8f1f706b6d566367e8879c696cccb303dda795be2efde4e9764e5270ce9031`.
- Reproduction sources: `dcp-root-role-observation.py`, `dcp-root-role-static.py`, `dcp-root-role-supplement.py`. Re-running the observation creates new evidence, not the same snapshot.

The Darwin136-byte proc_bsdinfo layout was checked against the installed SDK header. Ordinary queries yielded164 `EPERM` and one `ESRCH` (historic ps PID50208). No failure was retried; no kernel path or precise current birth was fabricated. The scripts would recheck successful identities once, but none succeeded. No sudo, launchctl, process argument/environment reads, credentials, service calls, kills, or runtime endpoints were used. Public static plist extraction retains only label/executable/user and hashes, not environment or arbitrary command operands.

## Exact finite classification

| Historical rows | Static category | Current eligibility |
|---:|---|---|
|1|`/sbin/launchd` init candidate|Unknown precise current identity; no implied broad launchd-child exception|
|136|Exact executable match to public `/System/Library/LaunchDaemons/*.plist`|Static role candidates only; authenticate current kernel identity and SSV/Apple closure at the protected gate|
|21|Apple XPC/application paths without a direct matched launch daemon plist|Exact bundle Info.plist candidates retained where present; role/invocation binding remains incomplete|
|2|Tailscale and Docker third-party services|Separate closure findings below; no baseline autoallow|
|2|CoreDevice/Simulator Developer helpers|Apple signatures are present; these are updateable `/Library/Developer` closures, not SSV exceptions|
|3|Two `/usr/bin/login` rows and historic `/bin/ps`|Generic utilities; invocation/owned lineage unproven|

Abbreviated autofsd/automountd/aslmanager names were normalized only where an exact unique static plist executable basename matched. The JSON marks this `STATIC_PLIST_NOT_KERNEL`; it must not be substituted for the missing current kernel path. No selected service generation is inferred from this root-only list: Runtime/W1 have UID505, W2 is periodic UID0, and each requires the existing native current-generation proof at its applicable phase. No operator ancestry is inferred from login/ps or a PPID alone.

## Non-SSV tails

**Tailscale PID836 (historical).** `/Library/LaunchDaemons/com.tailscale.tailscaled.plist` names `/usr/local/bin/tailscaled`. The entry is a UID502-owned symlink through UID502 mode0775 `/usr/local/bin`; its actual target is `/usr/local/Cellar/tailscale/1.94.2/bin/tailscaled`, UID502 mode0555, with UID502-owned ancestors including mode0775 Cellar. `codesign --verify --strict` returns1: unsigned. The inspected direct dylibs are absolute Apple system paths and no LC_RPATH is present, but that does not cure caller ownership or prove historical executed bytes. This is a genuine external service-authority/closure decision, not a DCP parser gap. Do not silently allow it, chmod it, stop it, or replace it under this Goal.

**Docker PID837 (historical).** Public `com.docker.vmnetd.plist` names the exact `/Library/PrivilegedHelperTools/com.docker.vmnetd`. Observed resolved ancestry is root-owned without group/other write; strict codesign verification returns0, Docker TeamIdentifier `9BNSXJN65R`, CDHash `b0b013ccb8b9d42a7654ff2e5621f8568b277e83`. Direct dylibs are absolute system paths with no LC_RPATH. This supports a finite candidate, but static launch configuration and signature do not authenticate the current PID, its loaded instance or all service inputs. Keep those exact outstanding requirements rather than claim eligibility.

**CoreDevice PID34546 / Simulator PID34897 (historical).** Both resolve through root-owned framework symlinks to `Versions/A/Resources/bin/…`; strict codesign verifies Apple Software Signing, TeamIdentifier `59GAB85EFG`. Their non-SSV dependencies include CoreDeviceInternal/CoreDeviceUtilities and CoreSimulatorUtilities/DVTDownloads respectively. No direct launch authority was found in the two fixed launch-daemon directories; containing framework Info.plists are not equivalent to a service launch receipt. Complete dependent closure, exact helper launch authority and current identity remain unproven. No broad Developer or Apple-signature exception is warranted.

## Minimum remaining path

1. Keep the current operator fenced. A future authorized protected, bounded census must establish full current kernel paths/births and stable generations; these ordinary EPERM/ESRCH results cannot be promoted to a clean census.
2. Retain exact static OS role candidates, then authenticate their fixed launch/bundle role plus trusted SSV/code closure. Do not substitute a path-prefix allowlist, Apple signature alone or baseline PID membership. Generic utility rows require exact owned operation lineage, otherwise fail closed.
3. Obtain an explicit owning disposition for the Tailscale root service's caller-owned closure. Its required resolution cannot be inferred from the deployment mandate. Docker/Developer candidates likewise need exact existing authority/closure evidence before an exception is frozen; the current task does not authorize their hardening or interruption.
4. Only after those concrete classifications close should the private operator census be implemented/frozen against them. A reboot is neither authorized nor a substitute for writable startup closure or historical-compromise assurance. No new service-management platform is proposed.

The report intentionally does not claim that the host is compromised, that any row is malicious, or that all Apple roles are fully proven. It records why this exact first-live handover cannot yet honestly assert absence of unclassified inherited root writers.
