# Independent Homebrew Tailscale payload provenance review

**PASS — the exact same-byte payload now has authenticated Homebrew publication provenance.** This closes only the missing authenticated executable-source input identified in first-live-host-custody-scope-review.md. Other handover, privileged closure, current process, service recovery, custody transition and exact Owner authorization gates remain. No service or candidate executable was run, no archive was extracted into the filesystem, and no root/production mutation occurred.

## Independently verified chain

Retained artifact directory: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/tailscale-provenance/`.

The reviewer made one bounded manifest fetch through ordinary HTTPS with normal certificate verification from [the exact Homebrew GHCR repository tag](https://ghcr.io/v2/homebrew/core/tailscale/manifests/1.94.2), after obtaining an anonymous public pull token. The token was neither printed nor retained. At2026-09-18T09:03:13.045250+00:00 the registry returned HTTP200, application/vnd.oci.image.index.v1+json, and Docker-Content-Digest matching the body below. The7973-byte body was byte-identical to the author's retained index, not merely equivalent JSON.

| Bound item | Exact SHA256 | Size |
|---|---|---:|
| Homebrew1.94.2 OCI index | b777cbed5bea6783b1d8bea650a8740a2513d08b9a5143855a71a17e6e3c77b7 |7973|
| Unique amd64 / darwin /1.94.2.sonoma manifest | ad0a2d344d2b056d5df0533957505131f6fcaa96341122987f935eb86be45167 |2161|
| Single manifest-pinned gzip layer |9b49997ee1f475d64e625193c3dc84710e8d623222dd52e52592ca7cee135f8f|15401734|
| Unique `tailscale/1.94.2/bin/tailscaled` member |5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da|23331104|

The index's exact platform/ref selector identifies one manifest; its digest/size match the retained manifest. That manifest contains one expected layer whose digest/size match the entire retained archive. Bounded archive inspection found exactly one occurrence of the fixed member, a regular non-sparse entry with no symlink/hardlink target. The reviewer read only that member through the archive reader, without extract/extractall, verified the full byte hash/size and compared its bytes with retained `authenticated-tailscaled` mode0400. Its digest also matches the earlier independently retained ordinary installed-file hash; the reviewer did not reread the installed executable or claim its currently running image is authenticated.

The OCI annotations name Homebrew as vendor and pin source formula revision877fe28bc86189109332f85ef15ea6565d6f10c0. Trust is **publication by Homebrew's official registry repository over authenticated HTTPS plus the complete OCI digest chain**. It is not a Tailscale vendor code signature, notarization, reproducible-build proof or a separate independent source audit of Tailscale. No untrusted local Homebrew receipt was used as the authentication root.

## Static direct loader inspection

A read-only independent Mach-O parser, corroborated by `/usr/bin/otool -L/-l` on the private authenticated artifact, found x86_64 MH_EXECUTE, normal fixed `/usr/lib/dyld`, and exactly five absolute Apple-system dylib/framework paths: libresolv.9, CoreFoundation, Security, IOKit and libSystem.B. There is no LC_RPATH or LC_DYLD_ENVIRONMENT in this image. The normal LC_LOAD_DYLINKER is `/usr/lib/dyld`, not an absent-loader requirement. This validates the direct load-command portion of the selected bytes; it does not inspect state contents, prove historical execution or establish the full dynamic service behavior.

Independent evidence files:

- `independent-registry-index.json`: same SHA as the index above.
- `independent-provenance-verification.json`:f81331bcb6dcb06f7bdf318b631939b367bee935e7c3fc1fec0062b05693dc4e.
- `independent-macho-readback.json`:dd608d29329782c1a31879c2f3cea934352784bd6f5ea4bcf4ff617fed3d9017.

The author's `comparison.json` SHAe55d64b5b7426371454697515dce89801a6321a5b9187d4c34c689e83ae9f40f was inspected but did not substitute for the reviewer's independent chain and member validation.

## Adequacy for the minimum repair

This is adequate provenance to freeze **these exact Homebrew-published same-version/same-byte executable bytes** as the input to the proposed one-time protected-copy repair, with Homebrew explicitly identified in the reviewed trust choice. There is no need to ask the Owner to supply a checksum or invent a vendor signature. The security change is removal of caller control over the root executable path and current generation, not a version upgrade or a new Tailscale deployment integration.

The exact operation still must copy from the reviewed payload into a new root-protected inode and full protected ancestry, pin descriptor bytes/metadata, bind the unchanged service arguments/state references, stop and prove exit of the exact old process generation, select the fixed protected path in the launch authority, perform the counted restart and verify the new running identity. KeepAlive must not leave an old-path respawn gap. Caller-selectable environment, external code-loading inputs or alternate launch authority must not defeat the protected executable. Any such input discovered in final finite closure review remains a blocker; the direct Mach-O check is not a blanket waiver.

The packet must disclose maintenance/network impact and failure recovery. A fall back to the old writable launch closure, if explicitly authorized solely for availability, leaves DCP unsafe and disabled. The old process may have run different historical bytes despite today's file matching the bottle, so this provenance evidence does not remove the independent in-flight root-writer closure or the recommended new six-role trust epoch after isolation. Fresh login and new key publication remain after the safe boundary, with preserved old genesis evidence and no historical-compromise claim.

No bounded payload-provenance blocker remains. No source implementation, actual installation, service safety, global host attestation, custody refresh or first-live completion is claimed by this report.
