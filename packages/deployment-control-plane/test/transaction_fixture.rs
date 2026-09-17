use crate::common;
use common::*;
use deployment_control_plane::{
    fs::{ArtifactEntry, ArtifactManifest, FixtureRoots},
    model::*,
    trust::digest,
};
use sha2::{Digest, Sha256};
use std::fs;
pub fn prepared() -> (
    tempfile::TempDir,
    FixtureRoots,
    deployment_control_plane::queue::Queue,
    Catalog,
    String,
) {
    prepared_paths(&["main.js"])
}
pub fn prepared_paths(
    paths: &[&str],
) -> (
    tempfile::TempDir,
    FixtureRoots,
    deployment_control_plane::queue::Queue,
    Catalog,
    String,
) {
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let _ = roots.artifacts().unwrap();
    fs::create_dir(path.join("target")).unwrap();
    for name in paths {
        fs::write(path.join("target").join(name), b"old code").unwrap();
    }
    let m = ArtifactManifest {
        version: 1,
        entries: paths
            .iter()
            .enumerate()
            .map(|(i, name)| ArtifactEntry {
                path: (*name).into(),
                blob: format!("payload-{i}"),
                sha256: hex::encode(Sha256::digest(b"new code")),
                size: 8,
                executable: false,
            })
            .collect(),
    };
    let raw = serde_json::to_vec(&m).unwrap();
    let hash = hex::encode(Sha256::digest(&raw));
    let dir = path.join("staging").join(&hash);
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("manifest.json"), raw).unwrap();
    for e in &m.entries {
        fs::write(dir.join(&e.blob), b"new code").unwrap();
    }
    let q = deployment_control_plane::queue::Queue::open(path.join("queue.db")).unwrap();
    let c = fixture_catalog();
    q.register_producer(&c, "producer").unwrap();
    let mut p = proposal("request", "a", 1, "goal");
    p.goals[0].payload.artifact_sha256 = hash.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.artifact_sha256 = hash.clone();
    p.build.payload.manifest_digest = digest(&m).unwrap();
    p.build = signed("builder", p.build.payload);
    p.reviews[0].payload.artifact_sha256 = hash.clone();
    p.reviews[0].payload.manifest_digest = digest(&m).unwrap();
    p.reviews[0] = signed("reviewer", p.reviews[0].payload.clone());
    p.desired.payload.artifact_sha256 = hash;
    p.desired = signed("authority", p.desired.payload);
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1000).unwrap().unit_id;
    (tmp, roots, q, c, id)
}
