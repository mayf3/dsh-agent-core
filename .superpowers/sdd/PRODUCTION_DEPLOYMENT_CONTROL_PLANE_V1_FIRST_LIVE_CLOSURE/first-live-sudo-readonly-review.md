# Independent bounded design review: fixed Apple sudo read-only binding

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
REVIEWED_DOCUMENT=first-live-sudo-readonly-binding.md
REVIEWED_SHA256=c52fe6282b1769465102e68af11996033a9d25db983d5489dc0a4212c80e5854
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO
FROZEN_NEW_DESIGN_BLOCKER_UNION=NONE_IDENTIFIED
SOURCE_AND_WHOLE_PACKAGE_REVIEW=STILL_REQUIRED
CURRENT_EFFECTIVE_SERVICE_SUDO_POLICY=NOT_PROVEN
PRODUCTION_OPERATION_ALLOWED=NO
PRODUCTION_OR_PRIVILEGED_ACTIONS_PERFORMED=NO

Independent reviewer did not author the design and recomputed its hash. Scope is the exact execute-only Apple sudo trust entry and the two fixed service-identity policy queries, within accepted Spec39865536ce51005f95a98473e77c2329078512c0 CTR-DCP-008/017/018/020. This adds no sudoers rule or deployment capability and does not reopen unrelated old findings.

The initial trust is sufficient for this bounded operation under the existing protected-OS-entry assumption. The prior reviewed operator explicitly accepts only /usr/bin/sudo through nonsymlink protected ancestors, root:wheel ownership, mode04511, one regular link, flags0x80020 and no ACL; its independent operator review already distinguishes this authentication entry from digest-readable payloads. The retained operator.py lines187–192 confirm that actual special check. The new proposal narrows it further with the frozen full observed identity/time/size tuple and a once-derived digest. Metadata is not claimed to be a cryptographic Apple code signature or prior byte observation: it is the already accepted fixed OS trust anchor, which a non-root submitter cannot replace through those protected paths. Root Owner/OS replacement is outside that non-root adversary claim and detected tuple drift still stops.

The retained service-sudo-readonly-once.json hashes to3d05c0d2c62b793ed9d38a78920194dc781bfe9e8a06d32fedb9912d453fc1b5. It records only an08:11:01UTC ordinary UID502 invocation of sudo -n /usr/bin/shasum -a256 /usr/bin/sudo, exit1, empty stdout and password-required stderr. It provides **no sudo byte digest and no UID505/612 policy proof**. This review performed no second invocation or authentication.

After explicit future package authorization, the fixed read-only prefix may use that same trusted administrator entry and pinned shasum to obtain the public byte digest. Safe implementation must check the exact frozen tuple/ACL before and after, require successful bounded execution and exactly one digest line for the exact fixed path, freeze an immutable generated record and permit only that one template projection. A reserialized or invented placeholder is forbidden. Native then independently opens nofollow, checks the same exact special tuple before/after a bounded descriptor read and compares the actual digest before target effects. Generic validate_platform_file must retain its set-id rejection; the exception belongs only to this closed Tool/path. Source review must verify no alternative path, copied setuid file, stale/replaced tool or modified static packet can use it.

The separate root SudoAudit role is acceptable only for the two exact no-command argv forms, -n -l -U #505 and -n -l -U #612, with clear environment, fixed locale, null stdin and the existing bounded/residual-safe runner. Normal Sudo remains UID502:GID20. Root audit cannot take a command operand, username override, extra flag or arbitrary path. Numeric identities must be freshly matched to authsvc and _dcp_review, and full protected sudoers/include configuration plus the existing UID502 policy relation must be rechecked before effects. A listed command is never executed to test a privilege.

The installed primary manual /usr/share/man/man8/sudo.8 (SHA256 f712f6b57f85fd7ac35ec68e3d64242c73013bb099127aeb0e9c1b7fc5ad2d5a), lines576–608 and770–789, documents -l without a command as a privilege query and root's right to query another user with -U. Its exit-value section says status1 also covers authentication/configuration/permission errors. It therefore confirms that generic nonzero **cannot** prove no allowed commands, but does not supply a complete exact machine output grammar for the actual two identities. As the design requires, the implementation must establish exact accepted text/channel/completion semantics from the actual tool contract or the authorized read-only observation before claiming executable readiness; #UID resolution must be checked rather than assumed from a display label. Password-required, inability to list, ambiguous/extra rules, wrong user/host, partial output or timeout must stop before login/target effects. Fixture strings are not current policy evidence.

No new long-lived authority is required: the future exact Owner operation authorizes this narrowly described read-only bootstrap observation, not a general signing, sudo or command service. Source/package review must verify the complete native and outer binding, one-use generated records, strict parser, protected policy graph and fail-stop path. This design PASS supplies none of those unexecuted observations and grants no current privileged action, package READY or first-live completion.
