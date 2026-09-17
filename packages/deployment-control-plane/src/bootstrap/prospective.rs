use super::bundle::Package;
use crate::{
    model::{FailurePolicy, Profile, Role},
    trust::digest,
    Result,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Identities {
    pub caller_uid: u32,
    pub caller_gid: u32,
    pub socket_gid: u32,
    pub runtime_uid: u32,
    pub runtime_gid: u32,
    pub w1_uid: u32,
    pub w1_gid: u32,
    pub w2_uid: u32,
    pub w2_gid: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct IssuerRequirement {
    pub proposed_key_id: String,
    pub role: Role,
    pub scope: Vec<String>,
    pub public_key: Option<String>,
    pub service_identity: Option<String>,
    pub custody_receipt: Option<String>,
    pub source_binding: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Layout {
    pub path: String,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub acl: String,
    pub kind: String,
}
pub fn prospective(
    revision: &str,
    sources: BTreeMap<String, String>,
    tools: BTreeMap<String, String>,
) -> Result<Package> {
    let profile = Profile {
        revision: "dsh-app-v1".into(),
        repo: "mayf3/dsh-agent-core".into(),
        target_runtime: "dsh-system-runtime".into(),
        host: "UNRESOLVED-HOST-IDENTITY".into(),
        launchd_domain: "system".into(),
        launchd_label: "ai.agent-core.runtime".into(),
        install_root_id: "agent-core-app".into(),
        standing_authority_revision: "PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1".into(),
        build_recipe: "immutable-regular-app-slots-v1".into(),
        toolchain: "UNRESOLVED-TRUSTED-BUILDER".into(),
        architecture: "x86_64".into(),
        verification_profiles: vec!["external-goal-acceptance-v1".into()],
        goal_verifiers: BTreeMap::from([(
            "external-goal-acceptance-v1".into(),
            "dcp-verifier-v1".into(),
        )]),
        required_review_scopes: vec!["release".into(), "root-code".into()],
        preflight_policy: "signed-lease-300s-v1".into(),
        privileged_apply_profile: "fixed-regular-app-slots-v1".into(),
        restart_profile: "runtime-w1-w2-system-v1".into(),
        rollback_profile: "journal-exact-preimage-v1".into(),
        failure_policy: FailurePolicy::StopTrain,
        policy_lease_seconds: 300,
        actor_quota: 100,
        queue_quota: 1000,
        enabled: false,
    };
    let identities = Identities {
        caller_uid: 502,
        caller_gid: 20,
        socket_gid: 602,
        runtime_uid: 505,
        runtime_gid: 601,
        w1_uid: 505,
        w1_gid: 601,
        w2_uid: 0,
        w2_gid: 0,
    };
    let issuers = [
        ("authority", Role::Authority, "canonical acceptance/merge, policy epochs, desired intent and separate Owner bootstrap"),
        ("builder", Role::Builder, "isolated immutable source/tree, recipe/toolchain, x86_64 Node closure and artifact attestation"),
        ("reviewer", Role::Reviewer, "independent semantic/release/root-code review; distinct from author/build/caller"),
        ("producer", Role::Producer, "authenticated DEPLOYMENT_READY registry, complete snapshots/watermarks and closure CAS"),
        ("verifier", Role::Verifier, "accepted per-Goal existing external result bound to exact physical generation"),
        ("recovery", Role::Recovery, "machine-verifiable exact failure remediation/restoration/termination"),
    ].into_iter().map(|(id, role, binding)| IssuerRequirement { proposed_key_id: format!("dcp-{id}-v1"), role,
        scope: if id == "authority" { vec!["dsh-app".into(), "bootstrap".into()] } else if id == "producer" { vec!["dsh-app".into(), "dcp-producer-v1".into()] } else { vec!["dsh-app".into()] },
        public_key: None, service_identity: None, custody_receipt: None, source_binding: binding.into() }).collect();
    let mut layout = Vec::new();
    for (path, mode, gid, kind) in [
        ("/usr/local/libexec/agent-deployd", 0o755, 0, "directory"),
        (
            "/usr/local/libexec/agent-deployd/agent-deployd",
            0o555,
            0,
            "file",
        ),
        (
            "/usr/local/libexec/agent-deployd/enrolled-dsh-runtime",
            0o444,
            0,
            "receipt-marker",
        ),
        (
            "/Library/LaunchDaemons/ai.agent-deployd.plist",
            0o644,
            0,
            "file",
        ),
        ("/private/var/db/agent-deployd", 0o700, 0, "directory"),
        ("/private/var/run/agent-deployd", 0o750, 602, "directory"),
        (
            "/private/var/run/agent-deployd/control.sock",
            0o660,
            602,
            "socket",
        ),
    ] {
        layout.push(Layout {
            path: path.into(),
            uid: 0,
            gid,
            mode,
            acl: "none".into(),
            kind: kind.into(),
        });
    }
    for name in [
        "intake",
        "intake/proposals",
        "intake/snapshots",
        "intake/policies",
        "intake/results",
        "intake/acks",
        "intake/recovery",
        "recovery-requests",
        "admitted",
        "requests",
        "closure",
        "staging",
        "sealed",
        "transactions",
    ] {
        layout.push(Layout {
            path: format!("/private/var/db/agent-deployd/{name}"),
            uid: 0,
            gid: 0,
            mode: 0o700,
            acl: "none".into(),
            kind: "directory".into(),
        });
    }
    for name in [
        "daemon.lock",
        "production.lock",
        "publication.lock",
        "queue.db",
        "daemon-activation.json",
        "activation.json",
        "issuer-bindings.json",
        "service.json",
    ] {
        layout.push(Layout {
            path: format!("/private/var/db/agent-deployd/{name}"),
            uid: 0,
            gid: 0,
            mode: 0o600,
            acl: "none".into(),
            kind: "file".into(),
        });
    }
    Ok(Package { version: 1, source_revision: revision.into(), source_digest: digest(&sources)?, source_files: sources, profile, identities, issuers,
        target_dispositions: BTreeMap::from([
            ("dsh-system-runtime".into(), "PROPOSED: existing regular app slots only; Runtime/W1/W2 quiescence; no config/plist/node/harness replacement in routine units".into()),
            ("system/com.auth-service".into(), "DISABLED: external authority/build/legacy retirement not established; no driver".into()),
            ("gui/502/com.svc-workflow".into(), "INELIGIBLE: caller-owned GUI domain and same-UID signals; separate accepted migration and driver required".into()),
            ("gui/502/ai.agent-core.runtime".into(), "UNENROLLED: distinct caller-owned GUI service; must not substitute for system runtime".into()),
        ]),
        legacy_surfaces: legacy(), lifecycle_probes: strings(&[
            "as uid502: direct app/config/plist writes, ACL grants, ancestor replacement, legacy source and installed helper invocations must deny",
            "as uid502: system launchctl bootout/bootstrap/kickstart/kill and signal runtime505/W1505/W2root must deny outside daemon",
            "runtime children502 remain caller-controlled by design; child signal denial is NOT claimed; census parent and child identities separately",
            "enumerate all sudoers includes and aliases, launchd/cron jobs, lifecycle managers and service-account writers; missing/unreadable surface blocks complete adoption",
            "prove no transition deployctl rule installed; exact-empty prospective sudoers is not installed-rule evidence",
            "re-pin all four legacy locks and active transactions; never steal/unlink based on elapsed time or absent PID",
        ]), layout, steps: strings(&[
            "separate Owner receipt binds independently reviewed package/source/binary/closure/trust/numeric identities/rollback; no agent fixture key accepted",
            "re-pin host/service/plist/ACL/ancestor/OS sealed-volume/launchctl facts; recheck _agentdeploy and resolved socket GID collision before new group/membership",
            "verify-resolved binds the exact disabled Configuration, NativeEnrollment and proof set digest; materialize numeric socket layout from that reviewed Configuration, never unresolved proposed identities",
            "canonical /private/var/run exception requires exact root:daemon0775 device/inode, no ACL/flags and fresh nonroot caller/service group exclusion; retain descriptors and dedicated child0750; generic target/artifact ancestors remain strict",
            "freeze exact protected preimages; reconcile and quiesce old transactions/entrances before any enrollment; refuse unknown",
            "using pinned Apple install utility copy inert payloads to new root-owned closure; rehash protected destination descriptors before first execution; never execute caller path",
            "provision protected state/permanent locks/socket parent and disabled plist; no root package manager or candidate interpreter",
            "separately provision real public issuers and authenticated protected intake adapters; no signing secret in bundle; keys0600 only in accepted isolated custody",
            "retire all canonical writers and lifecycle bypasses, execute actual caller negative probes, then write signed activation epoch and readable protected enrollment marker",
            "authorize bounded harmless canary; collect native installed/process readback and independent Goal receipt before standing admission; preserve receipts",
        ]), rollback: strings(&[
            "disable new admission; reconcile/drain owned operations under original permanent mutex; unknown remains quarantine",
            "restore only exact verified pre-bootstrap code/policy/ACL/plist preimages using reviewed protected tools; retain state journals and receipts",
            "do not silently reactivate legacy deploy paths or remove permanent locks; explicit receipted rollback authority required",
        ]), platform_tools: tools, payloads: vec![], transition_sudoers: String::new(),
        unresolved: strings(&["HOST_IDENTITY_AND_EXACT_NATIVE_ENROLLMENT", "REAL_ISSUER_CUSTODY_AND_PROTECTED_ADAPTERS", "TRUSTED_SOURCE_BUILD_REVIEW_BINDING", "EXACT_INITIAL_APP_SLOTS_AND_REQUIRED_RELEASE_FACETS", "PROTECTED_PREFLIGHT_AND_LEGACY_LIFECYCLE_DENIAL", "NODE_TRANSFORM_REVIEW_SIGNATURE_AND_RUNTIME_VALIDATION", "INDEPENDENT_WHOLE_BRANCH_REVIEW"]),
    })
}
fn strings(v: &[&str]) -> Vec<String> {
    v.iter().map(|s| (*s).into()).collect()
}
pub fn legacy() -> Vec<String> {
    strings(&[
        "repo:scripts/trusted-cp-deploy-install.sh",
        "repo:deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs",
        "repo:deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh",
        "repo:scripts/production-runtime-launchd.mjs",
        "/usr/local/libexec/agent-core/app/scripts/trusted-cp-deploy-install.sh",
        "/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs",
        "/usr/local/libexec/agent-core/app/deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs",
        "/usr/local/libexec/agent-core/app/deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh",
        "/Users/yanfenma/workspace/artifacts/operator-scripts/scheduler-watchdog-production-runbook-d602b59.sh",
        "/Users/yanfenma/workspace/artifacts/operator-scripts/scheduler-watchdog-production-freeze-sudo.sh",
        "/Users/yanfenma/workspace/artifacts/operator-scripts/scheduler-watchdog-production-phase2-d602b59-sudo.sh",
        "/Users/yanfenma/workspace/artifacts/agent-core-session-trace-v2-restored-v1-r2/agent_core_session_trace_v2_root_transaction.py",
        "/Users/yanfenma/workspace/deployment-artifacts/hr-dispatch-delivery-v1/DEPLOY_HR_DISPATCH_DELIVERY_V1.sh",
        "/Users/yanfenma/workspace/project/svc-workflow/scripts/release.sh",
        "lock:/var/db/agent-core/production-transaction.lock",
        "lock:/var/db/agent-core/deployments/transaction.lock",
        "lock:/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock",
        "lock:/var/run/agent-core-production-mutation.lock",
        "unresolved:sudoers-includes-and-aliases,launchd,cron,service-account-write-permissions,all-other-lifecycle-managers",
    ])
}
