//! Four pre-existing absent optional package edges, fixed by reviewed host inventory.
use super::*;
const A: &str = "node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.220_@anthropic-ai+sdk@0.93.0_zod@4.4.3__@modelcontex_57ba44dcbc2a36491e18d36fec520472/node_modules/@anthropic-ai";
const B: &str = "node_modules/.pnpm/@openai+codex@0.147.0/node_modules/@openai";
const AT: &str = "@anthropic-ai+claude-agent-sdk-darwin-x64@0.3.220/node_modules/@anthropic-ai";
const BT: &str = "@openai+codex@0.147.0-darwin-x64/node_modules/@openai";
pub(super) struct Negative {
    source: String,
    raw: String,
    missing: String,
    leaf: &'static str,
    manifest: String,
    hash: &'static str,
}
fn records() -> Vec<Negative> {
    let mut result = Vec::new();
    for (source, target, leaf, package, hash) in [
        (
            A,
            AT,
            "claude-agent-sdk-darwin-x64",
            "claude-agent-sdk",
            "1c9d0905f64e126850efe4fc4e7244c604a0855de8d4c82aff78da6f1988bd08",
        ),
        (
            B,
            BT,
            "codex",
            "codex",
            "bbaf3b9597b54bc1d4cf4aea93870e9035629d79bdaba58234011c31f0cfcf3d",
        ),
    ] {
        let name = if package == "codex" {
            "codex-darwin-x64"
        } else {
            leaf
        };
        let scope = source.rsplit('/').next().unwrap();
        for (path, up) in [
            (format!("{source}/{name}"), "../../.."),
            (
                format!("node_modules/.pnpm/node_modules/{scope}/{name}"),
                "../..",
            ),
        ] {
            result.push(Negative {
                source: path,
                raw: format!("{up}/{target}/{leaf}"),
                missing: format!("node_modules/.pnpm/{target}"),
                leaf,
                manifest: format!("{source}/{package}/package.json"),
                hash,
            });
        }
    }
    result
}
fn directories(tree: &Tree, path: &str) -> Result<()> {
    require(
        tree.root.kind == Kind::Directory,
        "FIRST_LIVE_NEGATIVE_ANCESTOR",
    )?;
    let parts = path.split('/').collect::<Vec<_>>();
    for end in 1..parts.len() {
        require(
            tree.entries
                .get(&parts[..end].join("/"))
                .is_some_and(|e| e.kind == Kind::Directory),
            "FIRST_LIVE_NEGATIVE_ANCESTOR",
        )?;
    }
    Ok(())
}
pub(super) fn validate(trees: &[Tree; 3]) -> Result<Vec<Negative>> {
    let tree = &trees[1];
    let records = records();
    if !records.iter().any(|r| tree.entries.contains_key(&r.source)) {
        return Ok(Vec::new());
    }
    for r in &records {
        require(
            tree.entries
                .get(&r.source)
                .is_some_and(|e| e.kind == Kind::Link && e.link.as_deref() == Some(&r.raw)),
            "FIRST_LIVE_NEGATIVE_SOURCE",
        )?;
        directories(tree, &r.source)?;
        directories(tree, &r.manifest)?;
        directories(tree, &r.missing)?;
        require(
            tree.entries
                .get(&r.manifest)
                .is_some_and(|e| e.kind == Kind::File && e.sha256.as_deref() == Some(r.hash)),
            "FIRST_LIVE_NEGATIVE_MANIFEST",
        )?;
        let descendants = format!("{}/", r.missing);
        require(
            !tree
                .entries
                .keys()
                .any(|p| p == &r.missing || p.starts_with(&descendants)),
            "FIRST_LIVE_NEGATIVE_BECAME_PRESENT",
        )?;
    }
    Ok(records)
}
impl Negative {
    pub(super) fn record(&self) -> serde_json::Value {
        serde_json::json!({"source":format!("{PREFIX}harness/{}",self.source),
            "raw_link":self.raw,"missing_prefix":format!("{PREFIX}harness/{}",self.missing),
            "remaining_leaf":self.leaf,"manifest":format!("{PREFIX}harness/{}",self.manifest),
            "manifest_sha256":self.hash,"expected_absent":true})
    }
    pub(super) fn matches(
        &self,
        source: &str,
        resolved: &[String],
        remaining: &VecDeque<String>,
        hops: u32,
    ) -> bool {
        source == format!("harness/{}", self.source)
            && resolved.join("/") == format!("harness/{}", self.missing)
            && remaining.len() == 1
            && remaining.front().is_some_and(|v| v == self.leaf)
            && hops == 1
    }
}
