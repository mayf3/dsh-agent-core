//! Immutable operation coordinates from the reviewed public protected readback.
use serde::Deserialize;
use std::collections::BTreeMap;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Binding {
    pub version: u32,
    pub host: String,
    pub attempt: String,
    pub pins: super::super::GenesisPins,
    pub public: BTreeMap<String, String>,
    pub executables: BTreeMap<String, String>,
    pub ps_sha256: String,
    pub lock_device: u64,
    pub lock_inode: u64,
    pub baseline_readback_sha256: String,
}
pub(super) const RAW: &str = r###"{
  "attempt": "genesis-65559dd-20260918-01",
  "baseline_readback_sha256": "5168000958f4778e1a9adfa06db1ddee576f890c204c292d4c7a384edf7e52cf",
  "executables": {
    "/usr/local/libexec/agent-deployd/agent-deploy-bootstrap": "d918d8f6f1d5e84334cd4a5e130cca998bcc5eb049a5de10a95093c0f4e7fe3c",
    "/usr/local/libexec/agent-deployd/agent-deploy-issuer": "13f1afd7173356069939253ea53a06b757ca0d76442cff42fd9c61f3161b22cb",
    "/usr/local/libexec/agent-deployd/agent-deployd": "d334470bfac831b6dee1ce314ac8db6aecdafcca7aec9804336ad6362e743a88",
    "/usr/local/libexec/agent-deployd/codex": "b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3"
  },
  "host": "343ecc65a7edc224c7b235c9bdbcc964ef5e81475734dc97bb1fa057e2959024",
  "lock_device": 16777230,
  "lock_inode": 85166163,
  "pins": {
    "initial_registry_digest": "2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842",
    "package_digest": "5bf407d815068e84d9dcfbbbe442498169bb43ab98f388b168bd5d6eca40911b",
    "plan_digest": "c3a5ed50ffe2588cedc26b7ba3931aef85de496143ea355d70b773648b6bd38e",
    "review_record_digest": "d9263b414689c78fe24369d25c2d68e6cfecd8c57aee21edb239aefb6e118e7d",
    "source_digest": "6e06c0b665c8758c548adf02816c7f892ed4b8710cbc999ee0c3e7a82bb95a0d",
    "supervisor_policy_digest": "980d3f08cd741139b6d1c1d5ade9b0a7a9deefe4a650776b1b504c0258cdb6a0"
  },
  "ps_sha256": "3bbba882e30d91fc4ff6e6844ca7c59fef4351b9a3fea35dca55708d6d487d1c",
  "public": {
    "/Library/LaunchDaemons/ai.agent-core.runtime.plist": "dc715fd8b73c6debfd35dd54c61fd55f38ff0e3f0f8937ebdc7cfa4afde3c3d9",
    "/Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w1.plist": "7901ef3eee2a5736b49a456c28ac1f8a349666792e55f66edb986fcc6756ff9b",
    "/Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w2.plist": "8c8e5107ef66cdcf6b0aa8c0f39a7eabe350bb4c7f6d99b826c5021b8bb48e49",
    "/Library/LaunchDaemons/ai.agent-deployd.plist": "c09e24824db86db2267da236594b94d1d36399171e9d6b25e78a928c66af095b",
    "/Library/LaunchDaemons/com.adobe.acc.installer.v2.plist": "c5f23707714b8603744fa5bc27a9b962555e44d39f31832afa9d0912d055b041",
    "/Library/LaunchDaemons/com.auth-service.plist": "fd5edf5b28b4f29bb90d8138e7befa93b24658ac97c5320295a6f1bcf0f145ac",
    "/Library/LaunchDaemons/com.docker.socket.plist": "7cf7e924e0675eae76e7a49d6ae1c1bb9b21cc99628df3a92b459e1d41ec5275",
    "/Library/LaunchDaemons/com.docker.vmnetd.plist": "d6a940b8092f06d36f1d04afb1a1eceed6f8df7aa629e331621e5ec6abf17714",
    "/Library/LaunchDaemons/com.microsoft.OneDriveStandaloneUpdaterDaemon.plist": "f18f984ee92d3046617c4096eb6be2c2d3175d8bdc6fe070f3ee410c2f38ac87",
    "/Library/LaunchDaemons/com.microsoft.OneDriveUpdaterDaemon.plist": "ffac408af17876197e3aa43484678a1db038ba82cf65c2d30d28426adabf65f9",
    "/Library/LaunchDaemons/com.microsoft.autoupdate.helper.plist": "5f09db608a32d9dad4a52e29f999ebeb2bafe9ae46c503c9b642e3230b871c2d",
    "/Library/LaunchDaemons/com.microsoft.office.licensingV2.helper.plist": "e0a9edfc0ad8f9e9bc895b13b99d130bcb3b20af0fe354c257f297697f4f010c",
    "/Library/LaunchDaemons/com.openclaw.forum-scheduler.plist": "0325d5b53d5a7daeccbf7ab17a86a6363cabdfd971adcaa3c731a2094094c718",
    "/Library/LaunchDaemons/com.openclaw.gateway.plist": "2e462ca3e89813ad21e4c446a2b69646a2065ace06e4e13dce50189d46fc510f",
    "/Library/LaunchDaemons/com.openclaw.host-exec-runner.plist": "f7226587f213f313bcfb89030bc9f8ad28e2bc01e7c7750b0ad6f0a426a20d68",
    "/Library/LaunchDaemons/com.openclaw.workflow-dispatcher.plist": "a4060354e7c15dfed8727fd9abc18c41b1299a5c4aa666b187924386a36e0acc",
    "/Library/LaunchDaemons/com.tailscale.tailscaled.plist": "d8b2ca94c6fe9d417f7541c882d87b95a4bdea8a5a6a4e80484e7e9a7e11ffdf",
    "/Library/LaunchDaemons/com.west2online.ClashXPro.ProxyConfigHelper.plist": "1f0b413c4a6758574ad88f368ad49361febc3e2b82523a35d95efde9d2269b25",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/login-intent.json": "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/owner-authorization.json": "76d893f8d0ab85196788d97af87b56f0f62568854131841a4161c30700d7cd79",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/preflight.json": "855b85fd8516cb607429eba0581d57a7a1df24b82ba5d42103b71f12ae1e56a1",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/000-intent.json": "6e06ee292bfcba0ced607432c6e7eaa75fd50257502681e4687bf1e15a8f2ac3",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/001-result.json": "139d5afad68a063046f00e3336db0f0b03cd5c2396ffe4112914e57a7b02db96",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/002-intent.json": "3a7f6f4792cd17c68437710246a92026c8e7a34108c0374eb2fe1f3516b7fcdb",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/003-result.json": "f87195a7095252097dccfbe8f5fc937e3aee22c5a5d803ee6266424620b89bcd",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/004-intent.json": "31b5e62ebfeaf9f23f32c762d86431be59507e4aae2ddeec077a91430b6e713b",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/005-result.json": "1a877b648df3cd086576083fac7e165ded33aa7a737a5968932b123924b476bf",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/006-intent.json": "a4dcce8f8d258eacdeae816ded168a70bb20b607764785c006eea8ed8d8314c8",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/007-result.json": "17d56d0e6e41100e93a33b9fe678ff3e2c7c818141525cf586fec031c7cc5dd0",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/008-intent.json": "6b223672470769c481de23c8cf0375f32eee16a79b687c58b286c3a04641efba",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/009-result.json": "fa2b133046e5b862b57a39865ba60fa6fa6e6f592ca5c8ea9c4760f7bbb03cc6",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/010-intent.json": "a5078630efad0e873e58eb767ff9a387e5c9a60bc4b1a574847afbbf837155cb",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/011-result.json": "29ab45abee7cd69c19706082b82b6db39a7a5f59ea11351183d004aa5f7e429e",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/012-intent.json": "1fecaef3a729a2ae12b4a87ec15edc81ff87ecbf2d47072f3391b41f892452e2",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/013-result.json": "3b8f1b4a8a796768ad5bd5dfff330de98d01e6ad5c8929812b7242c36b87d34a",
    "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps/installation.json": "2d3b0e23b20aaaf3187a40a813e10098c1c0a639a61810f7e82bec7dca62bbb7",
    "/private/var/db/agent-deployd/local-trust.json": "d7d01af3aa0f80b02529410f03a1c0c12818fd977a21ea40281a45d111916dd4",
    "/private/var/db/agent-deployd/registry/state-00000000000000000001.json": "74e98530ee6689b1ca5c822b4719791a86f3cdd60e2a53ad250f7210af6844f1",
    "/private/var/db/agent-deployd/service.json": "bd7351e49a0b674917cb5b6cea52522186d2055b7dbacda31b7a1e1bf59c50d2"
  },
  "version": 1
}"###;
pub(super) fn load() -> crate::Result<Binding> {
    Ok(serde_json::from_str(RAW)?)
}
pub(super) fn digest() -> String {
    crate::fs::file::sha(RAW.as_bytes())
}
