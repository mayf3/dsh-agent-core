use super::*;
use crate::fs::file::{sha, write_new};
use crate::trust::canonical_bytes;
use serde_json::json;
use std::os::unix::fs::MetadataExt;
fn write(root: &Dir, name: &str, value: &Value) -> Vec<u8> {
    let bytes = canonical_bytes(value).unwrap();
    write_new(
        root,
        name,
        &bytes,
        root.uid,
        root.file.metadata().unwrap().gid(),
        0o400,
    )
    .unwrap();
    bytes
}
fn fixture() -> (tempfile::TempDir, Dir, Value, String) {
    let temp = tempfile::tempdir().unwrap();
    let root = Dir::open(&std::fs::canonicalize(temp.path()).unwrap(), unsafe {
        libc::geteuid()
    })
    .unwrap();
    let plan = json!({"status":"PLANNED","sourceSha":"a".repeat(40),"canaryAgentId":"agt_scheduler-postdeploy-canary","logicalKey":format!("scheduler-postdeploy:{}","a".repeat(40)),"at":"2026-09-18T08:00:00.000Z","notAfter":1789718580000u64,"canaryJobId":null});
    let hash = sha(&write(&root, "canary-plan.json", &plan));
    (temp, root, plan, hash)
}
fn creator(root: &Dir, plan: &Value, hash: &str, drift: bool) -> String {
    let job = json!({"id":"test-canary-job","name":"scheduler-postdeploy-side-effect-free-canary","agentId":plan["canaryAgentId"],"logicalKey":plan["logicalKey"],"schedule":{"kind":"at","at":plan["at"]},"payload":{"kind":"agentTurn","message":format!("SCHEDULER_POSTDEPLOY_CANARY:{}",plan["sourceSha"].as_str().unwrap()),"timeoutSeconds":120},"retry":{"auto":false},"delivery":{"mode":"none"},"deleteAfterRun":false,"enabled":true});
    let store = write(
        root,
        "canary-created-store.json",
        &json!({"version":3,"jobs":[job],"occurrences":[],"fences":{}}),
    );
    let mut observed = job.clone();
    if drift {
        observed["agentId"] = json!("wrong");
    }
    let readback = write(
        root,
        "canary-creator-readback.json",
        &json!({"plan_digest":hash,"job":observed,"store_sha256":sha(&store),"observed_at_ms":1789718340000u64}),
    );
    write(
        root,
        "canary-created.json",
        &json!({"plan_digest":hash,"canaryJobId":job["id"],"creator_readback_digest":sha(&readback)}),
    );
    job["id"].as_str().unwrap().to_string()
}
#[test]
fn scoped_plan_and_authenticated_created_job_work_without_legacy_plan() {
    let (_temp, root, plan, hash) = fixture();
    assert_eq!(planned(&root, &hash, &"a".repeat(40)).unwrap(), plan);
    let id = creator(&root, &plan, &hash, false);
    assert_eq!(created(&root, &hash, &plan).unwrap(), id);
}
#[test]
fn changed_source_plan_hash_missing_creation_and_substituted_job_fail_closed() {
    let (_temp, root, plan, hash) = fixture();
    assert!(planned(&root, &"b".repeat(64), &"a".repeat(40)).is_err());
    assert!(planned(&root, &hash, &"b".repeat(40)).is_err());
    assert!(created(&root, &hash, &plan).is_err());
    creator(&root, &plan, &hash, true);
    assert!(created(&root, &hash, &plan).is_err());
}
#[test]
fn old_or_late_success_cannot_satisfy_exact_planned_window() {
    let (_temp, _root, plan, _hash) = fixture();
    let at = instant(plan["at"].as_str().unwrap()).unwrap();
    assert!(run_within_plan(&plan, &json!({"runs":[{"endedAt":at+1000}]})).is_ok());
    for ended in [at - 1, at + 180001] {
        assert!(run_within_plan(&plan, &json!({"runs":[{"endedAt":ended}]})).is_err());
    }
}
