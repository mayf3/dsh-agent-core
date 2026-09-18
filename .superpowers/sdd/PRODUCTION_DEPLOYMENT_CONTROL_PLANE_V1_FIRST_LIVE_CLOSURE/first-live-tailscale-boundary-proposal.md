# Tailscale boundary: finite proposal, no execution

Author dcp_census_repair_review, 2026-09-18. This supplements the root-role inventory only. No Tailscale command was run, fetched or installed; no network/state/key contents were read. No restart, service mutation or authorization is claimed.

Public retained evidence `ordinary-census/tailscale-repair-proposal-inputs.json` SHA256 `2c3f00587f805fb9b01b0033fc949ac26f2098f5a805c5bec573f9f7c2ffa81a` binds copies of the exact launch plist, Homebrew receipt/formula and SBOM. Binary/loader/ancestry/signature evidence is also in `legacy-root-role-eligibility.json`.

## Exact existing tuple

- Label: `com.tailscale.tailscaled`; root launch daemon by omitted UserName/GroupName. Public plist `/Library/LaunchDaemons/com.tailscale.tailscaled.plist`.
- Exact ProgramArguments: `["/usr/local/bin/tailscaled", "--socket=/var/run/tailscaled.sock", "--verbose", "1"]`. RunAtLoad=true and KeepAlive=true. StandardOutPath `/var/log/tailscaled.log`; StandardErrorPath `/var/log/tailscaled.err`. No state argument exists in this plist.
- Symlink resolves to `/usr/local/Cellar/tailscale/1.94.2/bin/tailscaled`, 23331104 bytes, SHA256 `5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da`, UID502 mode0555. The symlink, bin/Cellar path and version ancestors are caller-owned; mode0555 does not protect an inode owned by UID502 from its owner. Unsigned Mach-O; direct load commands use only absolute Apple system libraries, no LC_RPATH observed.
- `/Library/Tailscale` is root:wheel0700. The plausible state leaf `/Library/Tailscale/tailscaled.state` is inaccessible (EACCES), so its existence, identity and use remain **unproven**. No contents read. `/var/run/tailscaled.sock` metadata is root:daemon0666. Do not infer a migration or alter either path.
- Local Homebrew INSTALL_RECEIPT says1.94.2, x86_64, poured bottle, installed on request. The retained formula names upstream tagv1.94.2 and revision `2de4d317a8c2595904f1563ebd98fdcf843da275`. These caller-writable local records are provenance leads, not authenticated official binary evidence. SBOM has zero file entries and an empty source checksum. Referenced `formula.jws.json` is absent; no matching Tailscale archive/checksum appeared in existing cache filenames.

**The exact current binary cannot presently be verified against an existing authenticated release checksum.** Do not call this Homebrew build the official Tailscale release binary or silently replace it with a different version. A future permitted provenance step must obtain/authenticate the matching Homebrew bottle manifest/archive or another legitimate exact build attestation and compare extracted binary bytes; local matching version text alone is insufficient. No download was performed here.

## Smallest conditional repair envelope

Subject to explicit owning approval and authentic byte provenance, prepare a new fixed root-owned protected executable under a protected root-owned ancestor (for example a separately reviewed `/usr/local/libexec/tailscale-sealed/tailscaled`). Copy the verified **same** binary into a new sealed inode, retain exact byte/hash, strict metadata/ACL and full loader closure checks. Change only `ProgramArguments[0]` in the exact original plist to that sealed path; preserve every other plist field, operand, state, identity, socket and network configuration. Do not reinterpret the service as a DCP deployment target or run a generic hardening operation.

The future whole Owner package would bind the original plist/raw binary hashes, exact new path/bytes, current Tailscale service identity, protected preflight and one bounded exact daemon restart with new executable/birth/readback. This interrupts Tailscale connectivity, including any administrative route carried by it; an independent local control path and explicit outage acceptance are required before execution. Read-only metadata and signature checks here do not establish connectivity success.

Rollback must be frozen before that operation: preserve exact original plist bytes and the verified binary in protected archives, plus exact known service-generation/effect receipts. On an observed, bounded new-start failure, restoring the original plist path reopens this caller-owned boundary; it is therefore a separately explicit availability rollback within the Owner package, and must leave DCP fenced/FAILED. It must never be presented as secure handover PASS. Unknown stop/start or missing receipt means no blind restart/rollback. No state rollback, node re-registration, logout/login or key replacement is part of the proposal.

## Reviewer/Owner questions, not assertions

Can the exact Homebrew1.94.2 bytes receive authentic provenance and can this service owner authorize a one-restart sealed-path disposition with the stated outage/rollback? Until answered, this is a real external boundary gate.

Does the already-root service's previously caller-owned executable custody require a specific review of DCP private-key exposure/rotation before activation? Root pathname authority potentially reaches root-only files, but this observation does **not** prove access or compromise. No key/auth contents were read, no key generation/rotation is proposed automatically, and no historical-compromise assurance can be manufactured by a current process census.
