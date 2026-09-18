# Independent bounded design review: actual inventory compatibility

REVIEW_RESULT=PASS_AT_DESIGN_LEVEL
FROZEN_DESIGN_BLOCKER_UNION=NONE
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO_FOR_THIS_EXACT_SCOPE
IMPLEMENTATION_ALLOWED=YES_NONPRODUCTION_ONLY
SOURCE_REVIEW_PASS=NOT_EVALUATED
OPERATION_ALLOWED=NO
PRODUCTION_MUTATION_PERFORMED=NO

Reviewed `first-live-inventory-compatibility-design.md`, SHA256 `e6da8d03d7ea3ae7e27fb8ec787d1fa2d3db6c5fe1346fee63d381d55e26d9f2`, with derived `ordinary-inventory-compatibility.json`, SHA256 `6e6cbd53c5527acda975d2d089f1678298e51a7e29498fbeb0a5a13ebda0fe12`. These digests were independently recomputed. The reviewer did not author this design or the future native operator. Scope is only literal path compatibility and preservation of the three already-existing closed harness hardlink groups. The prior FM-01/02/03 design dispositions remain unchanged.

## Independently checked facts

Read only the retained ordinary export at `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/ordinary-census/ordinary-app-harness-inventory.json`; independently recomputed its SHA256 `6dbcc8c0c4ed27be76ee621bef3259eb8516527bb9526d880b612e3ce5e248dc`. The 38,680,939-byte export identifies itself as an ordinary non-atomic census at 2026-09-18T06:22:45.076891+00:00. This review did not traverse production trees or access protected contents.

Recomputed from all exported entries, rather than trusting the derived claim:

| Property | App | Separate harness |
|---|---:|---:|
| Regular files / directories / symlinks | 1131 / 254 / 22 | 70766 / 10686 / 5618 |
| Maximum relative path components | 7 | 14 |
| Maximum relative UTF-8 path bytes | 82 | 242 |
| Maximum component bytes | 52 | 120 |
| Characters beyond current alphanumeric plus `._-` grammar | `@` | `$`, `+`, `=`, `@` |
| Regular files whose paths contain `@` | 179 | 56081 |
| Non-single-link regular inode groups | 0 | 3 pairs |

Every derived hardlink group's paths, device/inode, nlink=2 and content digest match the raw export. Each pair also has identical recorded uid/gid/mode/flags/size. The three inodes are 60452822, 60415039 and 60392482 on device 16777230, with two exported members each. These are observations about the retained inventory, not an atomic proof that no live outside alias exists now. No production readiness is inferred from them.

## Contract and boundary assessment

1. **Literal `@` in the shared component parser is bounded REUSE.** Current `fs/secure.rs:15–35` rejects this literal before descriptor traversal, so existing scoped package names prevent complete-face observation. The character itself introduces no separator, parent reference, glob or execution semantics. The proposed change retains component/relative bounds, dot and dotdot rejection, nofollow descriptor access, ownership/ACL/flags checks, canonical manifest collision checks and the profile's exact mutable slot allowlist. It does not authorize a new mutation target. Existing serialized bytes remain unchanged because the change accepts a previously rejected name rather than changing canonical encoding. No `+`, `=`, `$` or deeper routine path support is justified by the app inventory and none is proposed.

2. **The deeper harness parser remains a private exact-operation mechanism.** Its accepted characters and 14-component/242-byte bounds are justified by the actual fixed inventory. Exact manifest membership, no absolute/empty/dot/dotdot/NUL or separator component, descriptor-relative nofollow traversal and prohibition on interpolation into a shell or caller-selected destination preserve the trust boundary. These allowances must not be propagated to routine artifact, state, key, grant or request parsers. Harness symlink topology still needs the separate frozen manifest and resolved closure checks; allowing a path character is not permission to follow a link.

3. **Closed existing harness hardlinks are distinguished from admitted artifacts.** CTR-DCP-005 continues to reject hardlinks in routine artifacts, and `fs::secure::validate` must retain regular-file nlink=1. This design instead inventories and metadata-isolates a pre-existing, separately pinned immutable loader dependency during the Owner-authorized migration under §5/§7 and CTR-DCP-004/008/017/018. It neither introduces hardlinked artifact entries nor writes their contents/topology. Consequently no accepted Spec exception or amendment is needed for this narrowly separate bootstrap operation.

4. **The closed-group proof is load-bearing.** Before any inode metadata effect, native code must prove the complete exact inventory and all group members using protected descriptors while the declared services/writers are quiescent and ancestors are isolated. Matching inode identity plus nlink equal to the entire enumerated group is required; a duplicated path count, changed member, unknown/external alias, unexpected link count, content/metadata drift, unsafe ACL/flags or inability to prove closure stops. Revalidate each held member and its path before/after, journal one inode transition naming every member, and recover metadata once only after matching the entire exact current group. The ordinary export alone cannot authorize chown/chmod, and merely opening a file descriptor does not substitute for writer quiescence. These obligations are already explicit in the proposed addition and companion lifecycle design.

This is the smallest justified design for the observed inventory: one safe literal added to complete app observation, a private fixed-inventory harness walker, and exactly three proven existing alias groups. A generic allow-hardlinks flag, routine grammar widening, arbitrary recursive ownership tool, unlink/copy replacement of the aliases, or a broader package-manager migration is neither required nor approved.

## Required evidence at source/package review

The declared fixture tests must exercise real descriptor behavior: scoped app-file roundtrip; empty/dotdot/absolute/traversal and symlink rejection; excessive depth/length and a character beyond the harness grammar; exact-group success with unchanged inode/content/topology; missing or substituted member; an additional external alias rejected before any inode metadata mutation; metadata/content/ACL drift and interrupted transition recovery. Ordinary secure artifact/state/key files must still reject nlink>1. Existing complete-face and canonical-byte behavior must retain compatibility.

The source reviewer must check that the new parser/group mechanism is reachable only from the finite operator and frozen membership, that count/memory/time bounds remain finite for this 87,070-entry harness inventory, and that the operator does not regain a general recursive mutation API. The exact future package must obtain current protected metadata/ACL/link proof and retain safe per-inode recovery records. Those are implementation and operation obligations, not findings requiring a further design or Owner decision now.

No concrete design blocker or load-bearing normative gap was found. Nonproduction implementation may proceed within the already authorized parent Goal. This report grants no actual metadata mutation, service stop, privileged bootstrap, production enablement or legacy retirement, and does not approve the not-yet-reviewed operator source or complete the first automatic deployment.
