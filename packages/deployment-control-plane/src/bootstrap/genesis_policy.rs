use super::genesis_types::*;
use crate::model::Role;

pub const GENESIS_AUTHORITY: &str = "39865536ce51005f95a98473e77c2329078512c0";
pub const GENESIS_CODE_ROOT: &str = "/usr/local/libexec/agent-deployd";
pub const GENESIS_STATE_ROOT: &str = "/private/var/db/agent-deployd";
pub const GENESIS_SUPPORT_FILES: &[&str] =
    &["/usr/local/libexec/agent-deployd/review-output-schema.json"];
pub const GENESIS_EXECUTABLES: &[&str] = &[
    "/usr/local/libexec/agent-deployd/agent-deployd",
    "/usr/local/libexec/agent-deployd/agent-deploy-issuer",
    "/usr/local/libexec/agent-deployd/agent-deploy-bootstrap",
    "/usr/local/libexec/agent-deployd/codex",
];

pub fn genesis_paths() -> GenesisPaths {
    GenesisPaths {
        code_root: GENESIS_CODE_ROOT.into(),
        state_root: GENESIS_STATE_ROOT.into(),
        keys: format!("{GENESIS_STATE_ROOT}/issuer-keys"),
        registry: format!("{GENESIS_STATE_ROOT}/registry"),
        reviewer_home: "/private/var/db/agent-deploy-review".into(),
        reviewer_workspace: "/private/var/db/agent-deploy-review-workspace".into(),
        plist: "/Library/LaunchDaemons/ai.agent-deployd.plist".into(),
        socket_parent: "/private/var/run/agent-deployd".into(),
    }
}

pub fn genesis_identities() -> GenesisIdentities {
    GenesisIdentities {
        caller_uid: 502,
        caller_gid: 20,
        socket_gid: 602,
        runtime_uid: 505,
        runtime_gid: 601,
        w1_uid: 505,
        w1_gid: 601,
        w2_uid: 0,
        w2_gid: 0,
        reviewer: GenesisServiceIdentity {
            name: "_dcp_review".into(),
            uid: 612,
            gid: 612,
            login_shell: "/usr/bin/false".into(),
        },
    }
}

pub fn genesis_roles() -> Vec<GenesisRoleKey> {
    [
        (
            Role::Authority,
            "local-authority",
            "authority",
            vec![
                "dsh-app",
                "preparation",
                "bootstrap",
                "local-deployment-registry",
            ],
        ),
        (
            Role::Builder,
            "local-builder",
            "builder",
            vec!["dsh-app", "preparation"],
        ),
        (
            Role::Reviewer,
            "local-reviewer",
            "reviewer",
            vec!["dsh-app", "preparation"],
        ),
        (
            Role::Producer,
            "local-deployment-registry",
            "producer",
            vec!["dsh-app", "preparation", "local-deployment-registry"],
        ),
        (
            Role::Verifier,
            "local-verifier",
            "verifier",
            vec!["dsh-app", "preparation"],
        ),
        (
            Role::Recovery,
            "local-recovery",
            "recovery",
            vec!["dsh-app", "preparation"],
        ),
    ]
    .into_iter()
    .map(|(role, id, identity, scopes)| GenesisRoleKey {
        role,
        key_id: id.into(),
        service_identity: format!("dcp://local-issuer/{identity}"),
        scopes: scopes.into_iter().map(String::from).collect(),
        private_key_path: format!("{GENESIS_STATE_ROOT}/issuer-keys/{id}.json"),
        generation: GenesisKeyGeneration::SystemCsprngEd25519,
        custody: GenesisKeyCustody::RootOnlyFile0600Directory0700,
        public_key_output: GenesisPublicKeyOutput::AfterAuthorizedGeneration,
    })
    .collect()
}
