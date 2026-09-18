# Fixed Apple sudo and service-identity read-only preflight

Same accepted Spec 39865536ce51005f95a98473e77c2329078512c0 and finite dsh first-live operation. REUSE proposed; independent review required before implementation. No sudoers edits, new command grants, root shell, credential reads or target effects are authorized by this document.

## Actual gap

Ordinary fixed stat/ACL observation finds /usr/bin/sudo root:wheel04511, one regular link, flags0x80020 (restricted,compressed), device16777230, inode1152921500312572854, size1575952, mtime=ctime=birthtime1786589515; no ACL lines. The file is execute-only to UID502. The existing generic validate_platform_file mask0o7022 rejects its required setuid bit, so using that helper for Tool::Sudo cannot work. Do not relax the generic platform tool rule.

One fixed sudo -n /usr/bin/shasum -a256 /usr/bin/sudo read-only attempt ended with password-required before executing shasum (ordinary-census/service-sudo-readonly-once.json); no authentication prompt or retry occurred. No checksum is claimed. Current UID502 sudo -n -l evidence exists, but does not establish UID505/612 effective policy. The complete future Owner package must resolve both in its read-only prefix before login, target code writes, quiescence or retirement.

## Exact tool binding

Reuse the already reviewed original operator's special trust in the fixed protected Apple administrator entry /usr/bin/sudo. The only new native exception applies to that exact Tool enum path. It requires regular file, uid0/gid0, mode04511, nlink1, flags exactly0x80020, no ACL, safe root-owned fixed ancestors and the packet's frozen complete device/inode/size/mtime/ctime/birthtime tuple. It never admits another setuid executable or widens fs::secure::validate_platform_file.

The static Owner package binds that observed tuple and the protected known /usr/bin/shasum byte hash0812595f981a26f813d98dc380af14d4af427626c9339eda29eb849ae13de1e3, plus exact fixed argv. After the Owner's visible administrator authentication, the ordinary operator repeats the protected metadata/ACL checks and invokes only sudo -n /usr/bin/shasum -a256 /usr/bin/sudo. It accepts exactly one sha256 line naming that path, repeats the identical tuple/ACL checks, and freezes the observed SHA as an append-only run record. Missing, mismatched or changed preimage stops. It does not silently accept a replacement tool.

The only additional allowed packet-template projection is filling that checked public tool digest into lifecycle.tool_sha256["/usr/bin/sudo"]. The static template contains no dummy digest. The actual packet/grant bytes then bind this SHA. Native opens the exact path nofollow as root, validates the same special frozen tuple before/after a bounded descriptor read, compares its actual byte hash to the frozen run record/packet and only then executes the fixed tool. Other platform tool hashes remain pre-frozen static fields. No earlier target effect is permitted before this native revalidation.

This is deferred observation of the already frozen protected Apple entry, whose initial privilege was used for the disabled install. It is not an unbound arbitrary tool supplied by an Agent. The exact authorization request must disclose that the raw digest is derived during this checked read-only prefix; it must not present an unobserved digest as known.

## Fixed service policy query

Add a separate SudoAudit enum using that same exact binary and digest predicate. It permits only root identity and exactly one of [-n,-l,-U,#505] or [-n,-l,-U,#612], never an arbitrary username/command/role. Existing Tool::Sudo remains restricted to UID502:GID20. It uses the existing bounded, clean-environment process runner with a five-second limit and no stdin; it cannot execute a listed command.

Require both service accounts to have no allowed sudo commands. Bind numeric UID to the current canonical username/group record under the already-required identity census; UID505 is authsvc, UID612 is _dcp_review. Accept only the normal complete explicit C-locale policy statement that this exact user is not allowed to run sudo on this exact host, with the documented tool completion code and no extra command rules. A generic nonzero, password-required, permission-to-list failure, unexpected Defaults/command list, identity mismatch, timeout or residual process is UNKNOWN/failed preflight, never a denial PASS. Root W2 remains explicitly trusted root code, not a fabricated root privilege denial.

The eventual implementation must establish the exact output grammar and completion code from the tool contract or a real read-only observation before claiming executable readiness; the statement above does not invent an observed output. If exact no-command policy cannot be proven, stop in the read-only prefix and retain the output without running an indicated command. No sudoers change or fallback to mere group-name inference exists.

Retain complete protected include-graph hashes and the reviewed UID502 effective-policy binding. Recheck the relevant identities, policy graph and exact tool immediately before target mutation. All actual read-only queries and any eventual mutation remain in the same explicitly authorized package; no separate piecemeal production approval is requested during preparation.

## Required evidence

Tests first must reject the generic-setuid bypass, alternate tool/path, wrong4511 flags/owner/link/tuple, mutation between metadata/hash checks, root or alternate-user use of ordinary Sudo, unprivileged use of SudoAudit, extra audit arguments, missing/ambiguous denial text, unknown completion, duplicate run record and forged/deferred placeholder packet fields. Use private files and captured documented-output fixtures; do not label fixtures as current effective privilege proof. Independent review must check the whole native and outer binding before any package READY claim.
