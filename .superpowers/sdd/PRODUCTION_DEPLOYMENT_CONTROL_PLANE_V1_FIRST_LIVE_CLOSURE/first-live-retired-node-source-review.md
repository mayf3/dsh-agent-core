# Independent component source review: RetiredNode

REVIEW_RESULT=PASS_FOR_BOUNDED_COMPONENT_DELTA
REVIEW_TARGET_COMMIT=aa4c48a94f1fb8e29c920b72ba9ac49d5ce8cb59
PRIOR_REVIEWED_COMPONENT=e67ccf7f5c2dc495f3488165a86a23283e5a6ce1
FROZEN_NEW_COMPONENT_BLOCKER_UNION=NONE_IDENTIFIED
WHOLE_OPERATOR_SOURCE_PASS=NOT_EVALUATED
PRODUCTION_OPERATION_ALLOWED=NO
PRODUCTION_OR_PRIVILEGED_ACTIONS_PERFORMED=NO

Independent reviewer did not author this change. Scope is the exact delta in `packages/deployment-control-plane/src/first_live/process.rs` and `test/first_live/process.rs`. Source and test hashes are respectively `8d1a6cbf0719ab9c55564a96c829ca37ceb2811b6eece9966344b69a2775ad3f` and `2bedd3c6eeafbc59f561a611a6b81a662c04c1ece9b89554efb18cd5358b6036`; current files matched the committed candidate before and after independent execution. Prior PR-01 aggregate-output closure remains unchanged.

The new closed Tool variant maps to the same protected, hash-pinned Node binary, but accepts only UID502:GID20 and exactly one argument equal to one of the two fixed retired `.mjs` paths. The strict length check precedes indexing. Empty arguments, `-e`, arbitrary paths and extra arguments fail. Root execution is rejected by the existing identity gate; UID505 cannot use this variant. Genuine canary Node retains its separate UID505:GID601 rule. Environment clearing means the new UID502 role does not inherit the UID505 HOME/store setup or external Node option variables. The process runner's timeout, group closure, aggregate 1MiB output limit, signal/unknown and no-replay rules are unchanged.

Independent command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::process:: -- --nocapture`, run as ordinary user in the operator development worktree. Result: exit0, **11 passed, zero failed**, including the new actual argument/identity negative controls and all previous resource/unknown cases. Log retained at the ordinary artifact root `first-live-preparation/process-retired-node-independent-review.log`, SHA256 `5be54e42454bbd017e9985c8ccbdd9bb08f2ef3b4bebd766a1941773ecdbc51b`. The retained author RED (`d62b2af92691427a5c4e79d7b9b0af1e478be1e26ad930675b7f54260a4d61ea`) fails the new argument-rejection assertion before the gate; author GREEN SHA256 is `032d79e111c632c21fc1d855cfdf04d0ae336ce7fb3f3a912e005046251c3ad6`.

These tests compile against the still-developing operator seam, with its disclosed unused-code warnings. They are not a whole-tree Clippy, release or integration claim. No protected Node, real retired entry, launchctl, sudo or production endpoint was invoked; production runner refusal occurs before fixed-tool access under non-root tests.

Final caller/package review must prove that both scripts already contain the exact protected constant-refusal bytes and loader closure before invoking them, and that observed fixed exit64/message plus unchanged poststate is evaluated. Pinning the Node binary alone does not prove the script content, and this component verdict does not approve the historical scripts or root execution of candidate JavaScript. Existing full integration obligations concerning closed call sites, exact supplementary groups, root descriptor closure and tools not escaping their owned group remain. No new long-lived contract or generic command API is introduced, and no first-live/parent-Goal completion is claimed.
