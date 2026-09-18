use super::*;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
mod policy;
mod process;

fn digest(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}
fn packet() -> ReviewPacket {
    let mut profile = crate::common::fixture_catalog()
        .profiles
        .remove("fixture")
        .unwrap();
    profile.repo = "mayf3/dsh-agent-core".into();
    profile.revision = "test-profile-v1".into();
    profile.required_review_scopes = vec!["source".into(), "privileged-closure".into()];
    ReviewPacket {
        repo: "mayf3/dsh-agent-core".into(),
        source_sha: "a".repeat(40),
        tree_sha: "b".repeat(40),
        profile,
        manifest: crate::fs::ArtifactManifest {
            version: 1,
            entries: vec![crate::fs::ArtifactEntry {
                path: "app/main.rs".into(),
                blob: "blob-0000".into(),
                sha256: digest(b"fn main() {}"),
                size: 12,
                executable: false,
            }],
        },
        accepted_contract: ReviewSourceFile {
            path: "docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md".into(),
            content: "Accepted contract fixture; no deployment authorization.".into(),
        },
        files: vec![ReviewSourceFile {
            path: "packages/example/src/main.rs".into(),
            content: "fn main() {}".into(),
        }],
    }
}
fn job() -> ReviewJob {
    ReviewJob {
        repo: "mayf3/dsh-agent-core".into(),
        source_sha: "a".repeat(40),
        tree_sha: "b".repeat(40),
        artifact_sha256: "c".repeat(64),
        manifest_digest: crate::trust::digest(&packet().manifest).unwrap(),
        profile_revision: "test-profile-v1".into(),
        profile_digest: crate::trust::digest(&packet().profile).unwrap(),
        scopes: vec!["source".into(), "privileged-closure".into()],
        semantic_authors: vec!["author".into()],
        semantic_author_uids: vec![502],
        input_digest: digest(&serde_json::to_vec(&packet()).unwrap()),
    }
}
fn response(job: &ReviewJob) -> Value {
    json!({"job_digest":crate::trust::digest(job).unwrap(),"input_digest":job.input_digest,
        "reviewer":"local-reviewer","verdict":"PASS","findings":[]})
}

#[test]
fn rejects_caller_pass_without_frozen_job_binding() {
    let job = job();
    let mut output = response(&job);
    output["job_digest"] = json!("0".repeat(64));
    assert_eq!(
        parse_result(&job, &serde_json::to_vec(&output).unwrap())
            .unwrap_err()
            .code(),
        "REVIEW_BINDING"
    );
}

#[test]
fn rejects_nonpass_findings_unknown_fields_and_ambiguous_output() {
    for (field, value, code) in [
        ("verdict", json!("FAIL"), "REVIEW_NOT_PASS"),
        (
            "findings",
            json!(["reachable privilege bypass"]),
            "REVIEW_NOT_PASS",
        ),
        ("input_digest", json!("0".repeat(64)), "REVIEW_BINDING"),
        ("reviewer", json!("author"), "REVIEW_BINDING"),
        ("extra", json!("PASS"), "REVIEW_OUTPUT_INVALID"),
    ] {
        let job = job();
        let mut output = response(&job);
        output[field] = value;
        assert_eq!(
            parse_result(&job, &serde_json::to_vec(&output).unwrap())
                .unwrap_err()
                .code(),
            code
        );
    }
    let job = job();
    for raw in [b"PASS".as_slice(), b"{} {}", b"```json\n{}\n```", b""] {
        assert_eq!(
            parse_result(&job, raw).unwrap_err().code(),
            "REVIEW_OUTPUT_INVALID"
        );
    }
}

#[test]
fn accepted_response_carries_exact_review_and_raw_evidence_digest() {
    let job = job();
    let raw = serde_json::to_vec(&response(&job)).unwrap();
    let verified = parse_result(&job, &raw).unwrap();
    assert_eq!(verified.review().repo, "mayf3/dsh-agent-core");
    assert_eq!(
        verified.review().scopes,
        vec!["source", "privileged-closure"]
    );
    assert_eq!(verified.evidence_digest(), digest(&raw));
    assert_eq!(verified.job_digest(), crate::trust::digest(&job).unwrap());
}

#[test]
fn rejects_identity_aliases_missing_authors_duplicate_scope_and_malformed_coordinates() {
    let mut jobs = Vec::new();
    let mut j = job();
    j.semantic_authors.push("local-reviewer".into());
    jobs.push((j, "SELF_REVIEW"));
    let mut j = job();
    j.semantic_author_uids.push(612);
    jobs.push((j, "SELF_REVIEW"));
    let mut j = job();
    j.semantic_author_uids.push(0);
    jobs.push((j, "SELF_REVIEW"));
    let mut j = job();
    j.semantic_authors.clear();
    jobs.push((j, "REVIEW_AUTHORS_MISSING"));
    let mut j = job();
    j.semantic_author_uids.clear();
    jobs.push((j, "REVIEW_AUTHORS_MISSING"));
    let mut j = job();
    j.scopes.push("source".into());
    jobs.push((j, "REVIEW_SCOPES"));
    let mut j = job();
    j.source_sha = "main".into();
    jobs.push((j, "REVIEW_SOURCE"));
    let mut j = job();
    j.input_digest = "no".into();
    jobs.push((j, "INVALID_DIGEST"));
    for (job, code) in jobs {
        assert_eq!(validate_job(&job).unwrap_err().code(), code);
    }
}

#[test]
fn input_mutation_coordinate_substitution_and_ambiguous_paths_are_rejected() {
    let job = job();
    let mut p = packet();
    p.files[0].content.push_str(" // replaced after freeze");
    assert_eq!(
        verify_packet(&job, &serde_json::to_vec(&p).unwrap())
            .unwrap_err()
            .code(),
        "REVIEW_INPUT_DRIFT"
    );
    for path in ["../malicious", "/tmp/payload", "a//b", "a/./b"] {
        let mut p = packet();
        p.files[0].path = path.into();
        let bytes = serde_json::to_vec(&p).unwrap();
        let mut job = job.clone();
        job.input_digest = digest(&bytes);
        assert_eq!(
            verify_packet(&job, &bytes).unwrap_err().code(),
            "REVIEW_SOURCE_PATH"
        );
    }
    let mut p = packet();
    p.tree_sha = "f".repeat(40);
    let bytes = serde_json::to_vec(&p).unwrap();
    let mut job = job;
    job.input_digest = digest(&bytes);
    assert_eq!(
        verify_packet(&job, &bytes).unwrap_err().code(),
        "REVIEW_INPUT_BINDING"
    );
}

#[test]
fn packet_profile_manifest_and_required_scopes_cannot_be_substituted() {
    for mutation in 0..3 {
        let mut p = packet();
        match mutation {
            0 => p.profile.launchd_domain = "gui/502".into(),
            1 => p.manifest.entries[0].path = "different/target".into(),
            _ => p
                .profile
                .required_review_scopes
                .push("missing-scope".into()),
        }
        let bytes = serde_json::to_vec(&p).unwrap();
        let mut job = job();
        job.input_digest = digest(&bytes);
        assert_eq!(
            verify_packet(&job, &bytes).unwrap_err().code(),
            "REVIEW_INPUT_BINDING"
        );
    }
}
