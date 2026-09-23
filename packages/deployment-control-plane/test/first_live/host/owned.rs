//! Isolated fixtures for the exact journal sidecar coherence kernel.
use super::sidecar_coherent;
use crate::fs::file::sha;

fn manifest(script_sha: &str, operation: &str) -> Vec<u8> {
    format!(
        "{{\"files\":{{\"agent-deployd\":{{\"mode\":\"0500\",\"sha256\":\"{}\",\"size\":1}},\"root_journal_sidecar.py\":{{\"mode\":\"0400\",\"sha256\":\"{}\",\"size\":1}}}},\"operation_id\":\"{}\",\"root_script_sha256\":\"{}\",\"version\":1}}",
        "aa".repeat(32), script_sha, operation, "bb".repeat(32)
    )
    .into_bytes()
}

fn intent(operation: &str, manifest_sha: &str) -> Vec<u8> {
    format!(
        "{{\"manifest_sha256\":\"{}\",\"operation_id\":\"{}\",\"state\":\"CONSUMED\",\"version\":1}}",
        manifest_sha, operation
    )
    .into_bytes()
}

const SCRIPT: &[u8] = b"print('durable journal sidecar')\n";

fn coherent_bundle(operation: &str) -> (Vec<u8>, Vec<u8>, Vec<u8>) {
    let m = manifest(SCRIPT_SHA, operation);
    let manifest_sha = sha(&m);
    (m, SCRIPT.to_vec(), intent(operation, &manifest_sha))
}

fn other_bundle(operation: &str, script_sha: &str) -> (Vec<u8>, Vec<u8>, Vec<u8>) {
    let m = manifest(script_sha, operation);
    let manifest_sha = sha(&m);
    (m, SCRIPT.to_vec(), intent(operation, &manifest_sha))
}

const SCRIPT_SHA: &str = "25b2cb2cd6f58c3b60b7332227cd3b8463054ba31021ef3c2180484299a52d6d";

#[test]
fn exact_sidecar_is_accepted_when_all_three_bind() {
    let (m, s, i) = coherent_bundle("ctr-dcp-017-bootstrap-only-20260922-99");
    sidecar_coherent(&m, &s, &i).unwrap();
}

#[test]
fn unapproved_script_bytes_are_refused() {
    // A same-parent root python whose bytes are NOT the manifest's pinned
    // sidecar never passes, no matter what the intent claims.
    let (m, _, i) = coherent_bundle("ctr-dcp-017-bootstrap-only-20260922-99");
    let foreign: Vec<u8> = b"unapproved payload".to_vec();
    sidecar_coherent(&m, &foreign, &i).unwrap_err();
}

#[test]
fn script_hash_or_operation_or_digest_mismatch_is_refused() {
    let (m, s, i) = coherent_bundle("ctr-dcp-017-bootstrap-only-20260922-99");
    // intent claims a different manifest digest (stale operation)
    let stale = intent("ctr-dcp-017-bootstrap-only-20260922-99", &"cc".repeat(32));
    sidecar_coherent(&m, &s, &stale).unwrap_err();
    // intent names a different operation than the manifest
    let mismatched = intent("first-live-dsh-20260918-01", &sha(&m));
    sidecar_coherent(&m, &s, &mismatched).unwrap_err();
    // manifest names a different operation than the intent
    let (m2, s2, i2) = other_bundle("first-live-dsh-20260918-01", SCRIPT_SHA);
    let mismatched2 = intent("ctr-dcp-017-bootstrap-only-20260922-99", &sha(&m2));
    sidecar_coherent(&m2, &s2, &mismatched2).unwrap_err();
    sidecar_coherent(&m2, &s2, &i2).unwrap();
}

#[test]
fn unconsumed_or_shape_broken_intent_is_refused() {
    let (m, s, _) = coherent_bundle("ctr-dcp-017-bootstrap-only-20260922-99");
    let pending = b"{\"manifest_sha256\":\"00\",\"operation_id\":\"x\",\"state\":\"PENDING\",\"version\":1}".to_vec();
    sidecar_coherent(&m, &s, &pending).unwrap_err();
    sidecar_coherent(&m, &s, b"not json").unwrap_err();
    sidecar_coherent(b"not json", &s, b"not json").unwrap_err();
}
