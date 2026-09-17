# Final independent review scope — accepted authority, not new policy

Authority: accepted Spec at bb5327f; unchanged reviewed semantics 3986553.
Owner mandate: source, tests, independent review, non-production validation only.
Production bootstrap and enrollment have not been authorized.

The final review must inspect actual executable paths and executed evidence, not
infer functionality from types, fixture names, prose or allowlist presence.

| Contracts | Reachable counterexamples to inspect | Expected evidence |
|---|---|---|
| 001 | paginated snapshot omission, CAS replay, shared UID spoof, disconnected producer marked complete | authenticated exhaustive census or explicit incomplete |
| 002–003 | same intent duplicate concurrent submission; late Goal; A→B→A; newer revert; overlapping roots | one successful install per intent, immutable coverage attachment, exact face |
| 004,006 | author self-signs review/build; rollback policy epoch; stale policy under lock; untrusted import | trusted role separation, exact source/build/review, lease and revocation |
| 005,008 | staging swap, ancestor symlink, ACL write grant, hardlink/special entry, case/Unicode collision, executable hook | retained descriptor traversal/copy/seal; profile-owned slots and fixed closure |
| 007 | forged uid/actor, unknown fields, oversized/deep/partial frame, disconnect before ACK | kernel peer and producer binding, scopes, bounded server and durable ACK |
| 009 | two processes/targets; socket operation reenters; child survives daemon; stale lock replacement | permanent inode and continuous exclusive ownership through finalize |
| 010–011 | FIFO replacement abuse, dependency transport-only PASS, failure auto-skipped, new request resets retry | durable DAG/age/receipt semantics, STOP persistence, bounded verified remediation |
| 011–013 | kill before/after each write and restart; partial install; changed preimage; rollback drift | durable per-slot intent, no blind replay, exact restoration or quarantine |
| 012 | SHA string with wrong loaded process or stale old generation; repeated successful restart | bytes + service generation/health and once-per-intent counter |
| 014–015 | mixed Goal results; close before finalize; external acceptance never returns; canary timeout; lost closure ACK | independent durable receipts, exact producer CAS, unknown never resent |
| 016–017 | root mode activated without receipt; environment selects root; client changes policy/profile; daemon self update | canonical production paths and separately authorized activation |
| 018 | old install/routing/wrapper runs; direct GUI launchctl or same-UID signal works | source guards offline; complete inventory and explicit deferred live denial |
| 019–020 | wildcard sudoers; unbounded retention/queues/probes; disk/fsync/corrupt journal | no enabled transition grant, finite failures, pinned state retained |

No live proof may be fabricated from a fixture. Bootstrap readiness binds the inert
package, exact source/binary/dependencies and prospective profile/trust/identity
manifest; it does not imply production acceptance or completed legacy retirement.
Unresolved host values must remain concrete blockers or explicitly disabled target
adoption, never guessed numerical identities or silently permissive defaults.

Additional lifecycle entrance found during implementation preparation:
`scripts/production-runtime-launchd.mjs` can bootstrap/bootout/load/unload GUI
runtime plists. Include in complete legacy inventory and negative probe plan; the
three planned source guards do not by themselves prove all lifecycle routes retired.

Concrete bootstrap profile risk to close: the existing Node Mach-O load commands
include caller-502-controlled /usr/local/opt paths. Read-only evidence is retained
in native-node-loader-closure.json and native-node-loader-ancestors.json. Confirm
the final runtime profile validates and pins the complete protected privileged
loader closure, including W2. The 52 KB Node entry and plist hashes alone do not
establish that closure. No malicious library or production mutation probe was
performed; this observation does not claim exact runtime library mappings.

Task gate coordinates: Task1 repair9dc5e3c; Task2 final2ea6816; Task3 final
b01e8d4 (source0c4ec56), closure28c09f7. All three have independent task PASS.
Task3 mailbox/crash durability and late-verification request concurrency were
repaired in one frozen-union cycle; retained reports include failures honestly.
The final review remains a whole-branch review, not another task repair loop.

Fresh Base impact observation: task4-base-impact.json records origin/main3c7b169
after docs-only accepted scheduler/self_ops Spec additions; DCP governing Spec and
implementation surfaces unchanged. Later integration still requires fresh impact
assessment if Base moves again. Candidate was not rebased or merged.

Known legacy leaf observations refreshed in task4-legacy-file-observation.json.
Some external wrappers changed independently since initial census; the installed
installer and GUI lifecycle helper differ from source and are505:601/0644. These
are bounded observations, not complete writer retirement or protected preimages.
Final conformance must preserve that distinction.
