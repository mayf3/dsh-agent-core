# Independent review: selected Broker upstream compatibility

REVIEW_RESULT=PASS_FOR_BOUNDED_OBSERVED_UPSTREAM_COMPATIBILITY
NEW_COMPATIBILITY_BLOCKERS=NONE_IDENTIFIED
SELECTED_BROKER_SOURCE=59472b631129d1ea3ca1202cbcbbc0799b083114
SELECTED_WORKFLOW_JS_SHA256=6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2
OBSERVED_UPSTREAM_SOURCE=f6a74001b71af106777045b596b30c3a7e99934d
ACCEPTED_UPSTREAM_ANCESTOR=07d888205001708080aa50720e428c6f1c775c7b
OBSERVED_UPSTREAM_BINARY_SHA256=4dc498396f18fd7571c80726f8c08f638903353c508774beee10ba14ca1b2a98
OBSERVATION_TIME=2026-09-18T07:14:40.494014+00:00
BUSINESS_E2E_ACCEPTANCE=NOT_PERFORMED
PRIVILEGED_INTEGRITY_PROOF=NOT_ESTABLISHED
UPSTREAM_ENROLLED_IN_DCP=NO
PRODUCTION_MUTATION_PERFORMED=NO

The reviewer did not author the observation or selected Broker delta. Scope is the previously missing current upstream wire-compatibility prerequisite for the prospective one-slot Broker delivery. This is not a fresh general review of svc-workflow cancellation/identity/business behavior, permission to deploy that service, or proof that any deployment child or parent Goal is complete.

## Exact independently checked evidence

Recomputed `upstream-compatibility-observation.md` SHA256 `ac70349701df585de85651c1517b6798bd7b6b85da229f1ed9c8e42867fa1c17`, `upstream-compatibility-source-binding.json` SHA256 `179357caeba5030acf0c6076fe043d444913e6b1cb16a38c5d922b6a66897db7`, and retained ordinary `svc-workflow-compatibility.json` SHA256 `d61237be8da794d213ed66438f24ac1e22befb1e22fb42222f236e8beae2d15a`.

The retained raw observation records one consistent tuple: 127.0.0.1:8989 listener PID82016; loaded `gui/502/com.svc-workflow` and process PID82016 with UID502/GID20; program `/Users/yanfenma/.local/services/svc-workflow/svc-workflow`; HTTP200 health `ok`, readiness `ready`, and version reporting source f6a74001, clean tree and build timestamp 2026-09-18T05:29:28Z. This review assessed that retained read-only capture; it did not issue another endpoint call or relabel the capture as a later atomic observation.

Independently rehashed the ordinary-readable installed binary, the retained release binary and `/private/tmp/svcwf-bundle/target/release/svc-workflow`: all equal `4dc498396f18fd7571c80726f8c08f638903353c508774beee10ba14ca1b2a98`. The retained provenance file hash matches its binding and describes that same source, clean tree, embedded version/build and a byte copy from the actual build output. This supports consistency of the observed process/version and source/artifact chain; the Owner-refreeze text in that existing record is not a new grant or a trusted-build signature created by this lane.

Independently rehashed and inspected the five installed public files in the target chain. The launcher imports `production-runtime/src/entry.js`; entry line69 calls `composeProductionRuntime` without a Broker override. Composition lines314–319 provides credentials/auth origin/audit configuration but no target override; Broker `index.js:248` selects `config.targets ?? defaultTargets`; installed `targets.js:24` pins svc-workflow to `http://127.0.0.1:8989`, audience `svc-workflow`. No environment credential values or credential-store contents were read. These are ordinary current file observations, not a claim that the live process's entire closure is protected against later modification.

Used exact Git objects in `/Users/yanfenma/workspace/project/svc-workflow`, never the current dirty checkout's source. `git merge-base --is-ancestor 07d8882 f6a7400` exits0. Independently recomputed all nine selected implementation hashes at both revisions; each pair is identical and matches the binding JSON. The complete changed-path set also matches: only cancellation implementation/tests and contract/spec/report documents differ. Examined the actual production-code diff, which is confined to dangling-instance cancellation; no selected list/create/route/DTO/build/health code changed. Existing untracked workflow plans were neither read nor changed.

## Required wire contracts

The selected Broker workflow.js bytes were independently rehashed to the bound digest. They pass `currentExecutorType` through the global-list query and send canonical domain-create body fields `domainKey`, optional `displayName`, and `enabled`, with trusted idempotency behavior and no caller-generated domainId.

At exact f6a7400, `src/http/dto.rs:124–160` accepts exact HUMAN/AGENT and rejects other current-executor values. `handlers/instances.rs:218–235` propagates the parsed filter. `query_global_instances.rs:182–189,213–227` joins the current node Visit to its assignee Principal and filters that Principal type, excluding terminal nodes when this filter is present. The payload therefore matches the actual retained source obligation; no label/name inference substitutes for Principal type.

The same source's CreateDomainRequest at `dto.rs:328–340` denies unknown fields and accepts only business inputs. `handlers/coordinator_domains.rs:68–124` routes canonical create using scope/direct-token and authenticated identity. `application/provisioning/mod.rs:242–329` acquires the idempotent receipt, generates DomainId only in its owned branch, establishes the authenticated creator as Owner in the same transaction and returns the stored canonical response. This agrees with the selected Broker body; the old caller-domainId incompatibility is not present in this observed source.

Independently matched the exact f6 contract manifest to the binding: version1.8.0, schema digest `ea2b3e1ca940feabbe3e0bb9bc0b765e5d3971002094f6fca98d6996a558223d`, bundle digest `778edee5b7bb794221838146d365a79c3b792eb2ebdd01aed9be0acc8ad49ed5`. This is a source-manifest match, not a newly recomputed independent contract-bundle seal. The version handler's literal schema string is `0022`, while `EXPECTED_MIGRATION_VERSION` is26. Readiness requires the complete successful ledger 1..26 with no failed migrations plus auth-verifier readiness; its recorded200/ready supports that handler's observed success. Neither the literal version string nor healthz alone is used to infer actual business schema/authorization correctness.

## Bounded conclusion and remaining gates

The evidence is sufficient to close the earlier *unknown which upstream implementation the configured Broker reaches, and whether it retains these two required wire contracts* prerequisite at the recorded snapshot. No concrete new compatibility gap was found. The stale deployment-ledger row naming07d8882 does not override the observed f6 process/version/artifact evidence and must remain historical rather than be rewritten by this review.

This ordinary non-atomic chain is not protected runtime integrity, authenticated business-query conformance, real canonical domain-create acceptance, grant availability, Watchdog semantic PASS or Broker deployment success. Source retention of a contract and ready200 do not prove a specific Agent's business authorization. No business request, domain creation, credential operation, root command, service action or mutation was performed.

Before the actual Broker mutation, recheck the selected installed composition/target, listener/process and binary/version/readiness tuple. A changed tuple needs a bounded compatibility impact check; unrelated main movement alone is not a veto. Whole dsh protected closure/current generation, authentic issuer build and independent review, exact live Watchdog prerequisite, Owner operation permission, actual first Broker apply/readback and per-Goal receipts remain separate gates. svc-workflow's GUI identity remains outside this DCP target enrollment and no global adoption claim is made.
