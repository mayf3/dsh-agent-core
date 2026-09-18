//! Resolve the recorded graph without following mutable filesystem links.
use super::*;
use std::collections::VecDeque;
const PREFIX: &str = "/usr/local/libexec/agent-core/";
const NAMES: [&str; 3] = ["app", "harness", "node-runtime"];
#[path = "negative_edges.rs"]
mod negative_edges;
/// Expected negative records; the caller must join its authenticated full census.
pub(in crate::first_live) fn recorded_negative_edges(
    trees: &[Tree; 3],
) -> Result<Vec<serde_json::Value>> {
    closed_links(trees)?;
    Ok(negative_edges::validate(trees)?
        .iter()
        .map(negative_edges::Negative::record)
        .collect())
}
pub(in crate::first_live) fn closed_links(trees: &[Tree; 3]) -> Result<()> {
    let negatives = negative_edges::validate(trees)?;
    for (index, tree) in trees.iter().enumerate() {
        for (path, e) in &tree.entries {
            if e.kind == Kind::Link {
                resolve(trees, &format!("{}/{path}", NAMES[index]), &negatives)?;
            }
        }
    }
    Ok(())
}
fn resolve(trees: &[Tree; 3], path: &str, negatives: &[negative_edges::Negative]) -> Result<()> {
    let mut todo: VecDeque<String> = path.split('/').map(str::to_owned).collect();
    let mut resolved: Vec<String> = Vec::new();
    let mut hops = 0;
    while let Some(part) = todo.pop_front() {
        match part.as_str() {
            "" | "." => continue,
            ".." => {
                require(!resolved.is_empty(), "FIRST_LIVE_LINK_ESCAPE")?;
                resolved.pop();
                continue;
            }
            _ => {
                super::super::inventory_path::parts(&part)?;
            }
        };
        resolved.push(part);
        let index = NAMES
            .iter()
            .position(|n| *n == resolved[0])
            .ok_or(Error::new("FIRST_LIVE_LINK_ESCAPE"))?;
        let e = if resolved.len() == 1 {
            &trees[index].root
        } else {
            match trees[index].entries.get(&resolved[1..].join("/")) {
                Some(entry) => entry,
                None => {
                    return require(
                        negatives
                            .iter()
                            .any(|record| record.matches(path, &resolved, &todo, hops)),
                        "FIRST_LIVE_LINK_DANGLING",
                    )
                }
            }
        };
        if e.kind == Kind::Link {
            hops += 1;
            require(hops <= 40, "FIRST_LIVE_LINK_CYCLE")?;
            let target = e.link.as_deref().ok_or(Error::new("FIRST_LIVE_LINK"))?;
            resolved.pop();
            let target = if target.starts_with('/') {
                resolved.clear();
                target
                    .strip_prefix(PREFIX)
                    .ok_or(Error::new("FIRST_LIVE_LINK_ESCAPE"))?
            } else {
                target
            };
            for p in target.split('/').rev() {
                todo.push_front(p.to_owned());
            }
        } else if !todo.is_empty() {
            require(e.kind == Kind::Directory, "FIRST_LIVE_LINK_NOT_DIRECTORY")?;
        }
    }
    require(!resolved.is_empty(), "FIRST_LIVE_LINK_ESCAPE")
}

#[cfg(test)]
#[path = "../../../test/first_live/link_graph.rs"]
mod tests;
