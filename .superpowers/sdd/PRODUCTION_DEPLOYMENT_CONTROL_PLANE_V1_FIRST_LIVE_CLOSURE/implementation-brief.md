# DEVELOPMENT_PREFLIGHT — first-live dependency wiring

Same parent Goal PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1. User authorizes remaining nonproduction implementation and instructs first-real dsh automatic deployment path, with mandatory early Watchdog prerequisite verification. No production/bootstrap authority inferred here.

TARGET_REPOSITORY=mayf3/dsh-agent-core
REVIEW_TARGET_HEAD=78daf3699346f6f68264921443d42552d9157dae
BASE_HEAD=78daf3699346f6f68264921443d42552d9157dae
AUTHORITY_ACTION=REUSE
PRIMARY_AUTHORITY=PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
IMPLEMENTATION_AUTHORITY=contracts
ROUTE_STAGE=IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE=YES
PLAN_LEVEL=EXEC_PLAN
ASSURANCE_LEVEL=CONTROLLED
EXECUTION_MANDATE=VALID for bounded nonproduction implementation/tests
MUTATION_AUTHORIZATION=VALID for this isolated checkout only
ISOLATED_WRITE_SURFACE=YES
SPEC_GAP_DEPENDENCY=NONE for explicit authenticated existing prerequisite/source binding
EVIDENCE_REVIEWABILITY=PASS
OPERATION_ALLOWED=NO
IMPLEMENTATION_ALLOWED=YES
DONE_WHEN=Concrete dependency/source-selection integration implemented with RED/GREEN regressions and independent affected-surface review, without changing current exact genesis package or receipt semantics
EXPANSION_TRIGGER=Any weakening of prerequisite/business semantics, historical receipt import, new migration powers or normative accepted Contract change
NEXT_ACTION=CONTINUE

Implement the bounded dependency-wiring-design.md sections1–3: preserve old enrollment history/canonical signatures and exact genesis inputs; optional signed explicit child mapping; Owner source policy v2 exact goal/enrollment selection; unchanged caller API and queue LiveInstallation semantics. Fail closed before external work on mismatch; immutable drafts/cache remain exact. Actual trusted Watchdog semantic verifier and production enrollment/activation are downstream work and MUST NOT be faked or replaced by installed-byte PASS in this subtask.

Use meaningful failing regression tests before implementation. Record concrete RED and GREEN outputs; run affected/full Rust tests, fmt, strict all-target Clippy and release. No live endpoints/root commands/real keys. No generic registry version manager, broad platform capability, future debt cleanup or closed R02 rerun absent direct impact. Commit only this bounded source/tests/documentation; report exact source coordinates, tests and remaining integration gates. Keep source compatibility with the current sealed v1 package and existing data.
