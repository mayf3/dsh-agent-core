//! Failure availability is distinct from admission and never consumes unknown effects.
use super::super::files;
use crate::{fs::secure::Dir, Result};
pub(super) fn eligible(stopped: bool, isolated: bool, start_attempted: bool) -> bool {
    stopped && isolated && !start_attempted
}
fn exists(area: &Dir, name: &str) -> Result<bool> {
    match area.open_file(name, libc::O_RDONLY, 0) {
        Ok(_) => Ok(true),
        Err(e) if e.code() == "ABSENT" => Ok(false),
        Err(e) => Err(e),
    }
}
fn syscall(area: &Dir, name: &str) -> Result<bool> {
    if !exists(area, &format!("native-denial-{name}-intent.json"))? {
        return Ok(true);
    }
    if !exists(area, &format!("native-denial-{name}-result.json"))? {
        return Ok(false);
    }
    let value: serde_json::Value = files::read(area, &format!("native-denial-{name}-result.json"))?;
    if !observed(&value) || value["inconclusive"] != false {
        return Ok(false);
    }
    if !value["created"].is_null() {
        if !exists(area, &format!("native-denial-{name}-cleanup.json"))? {
            return Ok(false);
        }
        let cleanup: serde_json::Value =
            files::read(area, &format!("native-denial-{name}-cleanup.json"))?;
        return Ok(observed(&cleanup)
            && cleanup["cleaned"] == true
            && cleanup["created"] == value["created"]);
    }
    Ok(true)
}
pub(super) fn probes_known(area: &Dir) -> Result<bool> {
    for name in ["write", "create"] {
        if !syscall(area, name)? {
            return Ok(false);
        }
    }
    if exists(area, "socket-denial")? && !syscall(&area.child("socket-denial")?, "create")? {
        return Ok(false);
    }
    for name in ["retired-0", "retired-1", "retired-2", "post-effective-sudo"] {
        if exists(area, &format!("{name}-intent.json"))? {
            if !exists(area, &format!("{name}-result.json"))? {
                return Ok(false);
            }
            let value: serde_json::Value = files::read(area, &format!("{name}-result.json"))?;
            if value["code"].as_i64().is_none() {
                return Ok(false);
            }
        }
    }
    Ok(true)
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/availability.rs"]
mod tests;

fn observed(v: &serde_json::Value) -> bool {
    let Some(map) = v.as_object() else {
        return false;
    };
    let names = [
        "total",
        "inconclusive",
        "denied",
        "eacces",
        "eperm",
        "unexpected",
        "errno",
        "failed_index",
        "created",
        "cleaned",
    ];
    if map.len() != names.len() || names.iter().any(|n| !map.contains_key(*n)) {
        return false;
    }
    if ["total", "denied", "eacces", "eperm", "failed_index"]
        .iter()
        .any(|n| v[*n].as_u64().is_none())
        || ["inconclusive", "unexpected", "cleaned"]
            .iter()
            .any(|n| v[*n].as_bool().is_none())
        || v["errno"].as_i64().is_none()
    {
        return false;
    }
    if v["total"].as_u64() == Some(0) || v["denied"].as_u64() > v["total"].as_u64() {
        return false;
    }
    v["created"].is_null()
        || v["created"]
            .as_array()
            .is_some_and(|a| a.len() == 2 && a.iter().all(|n| n.as_u64().is_some_and(|v| v > 0)))
}
