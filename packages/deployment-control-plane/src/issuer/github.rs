//! Fixed public canonical origin. No caller URLs, credential transport or shell.
use super::source::{parse_tree, source_sha, validate_lineage, SourceSlot};
use crate::{
    error::require,
    fs::{
        file::sha,
        secure::{relative, validate_platform_file},
    },
    trust::valid_digest,
    Error, Result,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs::OpenOptions,
    io::Read,
    os::unix::fs::OpenOptionsExt,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SourcePolicy {
    pub repo: String,
    pub branch: String,
    pub curl_sha256: String,
    pub accepted_contract_path: String,
    pub accepted_contract_sha256: String,
    pub slots: Vec<SourceSlot>,
    pub additional_review_paths: Vec<String>,
    pub dependency_closure: Vec<String>,
}
pub struct SourceObservation {
    pub source_sha: String,
    pub tree_sha: String,
    pub files: BTreeMap<String, Vec<u8>>,
    pub contract: Vec<u8>,
    pub canonical_lineage_digest: String,
}
impl SourcePolicy {
    pub fn validate(&self) -> Result<()> {
        require(
            self.repo == "mayf3/dsh-agent-core" && self.branch == "main",
            "CANONICAL_ORIGIN",
        )?;
        valid_digest(&self.curl_sha256)?;
        relative(&self.accepted_contract_path)?;
        valid_digest(&self.accepted_contract_sha256)?;
        require(
            !self.slots.is_empty()
                && self.slots.len() <= 4096
                && self.additional_review_paths.len() <= 256,
            "SIZE_LIMIT",
        )?;
        for slot in &self.slots {
            relative(&slot.source)?;
            relative(&slot.target)?;
        }
        for path in &self.additional_review_paths {
            relative(path)?;
        }
        require(!self.dependency_closure.is_empty(), "DEPENDENCY_CLOSURE")?;
        for hash in &self.dependency_closure {
            valid_digest(hash)?;
        }
        Ok(())
    }
}

/// Read-only and public: usable in nonproduction as the same canonical-source probe.
pub fn observe(policy: &SourcePolicy, source: &str) -> Result<SourceObservation> {
    policy.validate()?;
    source_sha(source)?;
    let curl = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open("/usr/bin/curl")?;
    validate_platform_file(&curl)?;
    let mut binary = Vec::new();
    (&curl).take(16 * 1024 * 1024).read_to_end(&mut binary)?;
    require(sha(&binary) == policy.curl_sha256, "CANONICAL_CLIENT_DRIFT")?;
    let get_json =
        |route: &str| -> Result<Value> { Ok(serde_json::from_slice(&fetch(route, false)?)?) };
    let compare = get_json(&format!("compare/{source}...main"))?;
    validate_lineage(source, &compare)?;
    let commit = get_json(&format!("git/commits/{source}"))?;
    require(commit["sha"] == source, "SOURCE_MISMATCH")?;
    let tree = commit["tree"]["sha"]
        .as_str()
        .ok_or(Error::new("INVALID_SOURCE"))?;
    source_sha(tree)?;
    let paths = parse_tree(tree, &get_json(&format!("git/trees/{tree}?recursive=1"))?)?;
    let mut selected = policy
        .slots
        .iter()
        .map(|s| s.source.clone())
        .collect::<Vec<_>>();
    selected.extend(policy.additional_review_paths.clone());
    selected.push(policy.accepted_contract_path.clone());
    selected.sort();
    selected.dedup();
    let mut files = BTreeMap::new();
    let mut total = 0usize;
    let deadline = Instant::now() + Duration::from_secs(300);
    for path in selected {
        require(Instant::now() < deadline, "CANONICAL_SOURCE_TIMEOUT")?;
        let object = paths.get(&path).ok_or(Error::new("SOURCE_SLOT_MISSING"))?;
        let bytes = fetch(&format!("git/blobs/{object}"), true)?;
        total = total
            .checked_add(bytes.len())
            .ok_or(Error::new("SIZE_LIMIT"))?;
        require(total <= 64 * 1024 * 1024, "SIZE_LIMIT")?;
        files.insert(path, bytes);
    }
    let contract = files
        .remove(&policy.accepted_contract_path)
        .ok_or(Error::new("ACCEPTED_CONTRACT_MISSING"))?;
    require(
        sha(&contract) == policy.accepted_contract_sha256,
        "ACCEPTED_CONTRACT_DRIFT",
    )?;
    Ok(SourceObservation {
        source_sha: source.into(),
        tree_sha: tree.into(),
        files,
        contract,
        canonical_lineage_digest: crate::trust::digest(&(commit, compare))?,
    })
}

fn fetch(route: &str, raw: bool) -> Result<Vec<u8>> {
    // Route is constructed exclusively above from fixed literals and checked SHA-1s.
    let url = format!("https://api.github.com/repos/mayf3/dsh-agent-core/{route}");
    let accept = if raw {
        "Accept: application/vnd.github.raw+json"
    } else {
        "Accept: application/vnd.github+json"
    };
    let mut child = Command::new("/usr/bin/curl")
        .args([
            "-q",
            "--fail",
            "--silent",
            "--proto",
            "=https",
            "--tlsv1.2",
            "--noproxy",
            "*",
            "--connect-timeout",
            "10",
            "--max-time",
            "45",
            "--max-filesize",
            "16777216",
            "--header",
            accept,
            "--url",
            &url,
        ])
        .env_clear()
        .current_dir("/")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let output = child
        .stdout
        .take()
        .ok_or(Error::new("CANONICAL_SOURCE_UNAVAILABLE"))?;
    let reader = std::thread::spawn(move || {
        let mut b = Vec::new();
        let r = output.take(16 * 1024 * 1024 + 1).read_to_end(&mut b);
        (r, b)
    });
    let deadline = Instant::now() + Duration::from_secs(50);
    let status = loop {
        match child.try_wait()? {
            Some(status) => break status,
            None if Instant::now() < deadline && !reader.is_finished() => {
                std::thread::sleep(Duration::from_millis(20))
            }
            None if Instant::now() < deadline => {
                // A full bounded pipe reader exits early; terminate rather than let a
                // larger response block the process on its now-closed output pipe.
                std::thread::sleep(Duration::from_millis(20));
                if let Some(status) = child.try_wait()? {
                    break status;
                }
                child.kill()?;
                let _ = child.wait();
                return Err(Error::new("CANONICAL_SOURCE_UNAVAILABLE"));
            }
            None => {
                child.kill()?;
                let _ = child.wait();
                return Err(Error::new("CANONICAL_SOURCE_TIMEOUT"));
            }
        }
    };
    let (read, bytes) = reader
        .join()
        .map_err(|_| Error::new("CANONICAL_SOURCE_UNAVAILABLE"))?;
    read?;
    require(
        status.success() && bytes.len() <= 16 * 1024 * 1024,
        "CANONICAL_SOURCE_UNAVAILABLE",
    )?;
    Ok(bytes)
}
