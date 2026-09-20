use crate::{Error, Result};
use serde::Serialize;
#[derive(Debug, PartialEq, Eq, Serialize)]
pub(super) struct Metadata {
    pub domain_service: String,
    pub path: String,
    pub kind: String,
    pub program: String,
    pub pid: u32,
}
#[cfg(test)]
pub(super) fn parse(raw: &str, expected: &str) -> Result<Metadata> {
    parse_optional(raw, expected)?.ok_or_else(|| Error::new("HOST_LAUNCH_UNPROVEN"))
}
pub(super) fn parse_optional(raw: &str, expected: &str) -> Result<Option<Metadata>> {
    use crate::error::require;
    require(
        raw.len() <= 1024 * 1024 && !raw.as_bytes().contains(&0),
        "HOST_LAUNCH_UNPROVEN",
    )?;
    let mut lines = raw.lines();
    require(
        lines.next() == Some(format!("{expected} = {{").as_str()),
        "HOST_LAUNCH_UNPROVEN",
    )?;
    let mut fields = std::collections::BTreeMap::new();
    let mut closed = false;
    for line in lines {
        require(!closed, "HOST_LAUNCH_UNPROVEN")?;
        if line == "}" {
            closed = true;
            continue;
        }
        // macOS launchctl separates top-level field groups with an exactly
        // empty line. Whitespace or content remains structural input and must
        // retain the one-tab/nested-field checks below.
        if line.is_empty() {
            continue;
        }
        // launchctl's outer job fields have exactly one tab. Nested environment,
        // arguments and subservice records cannot supply authoritative fields.
        let Some(body) = line.strip_prefix('\t') else {
            return Err(Error::new("HOST_LAUNCH_UNPROVEN"));
        };
        if body.starts_with('\t') || body == "}" {
            continue;
        }
        let Some((key, value)) = body.split_once(" = ") else {
            continue;
        };
        if ["path", "type", "program", "pid", "state"].contains(&key) {
            require(
                !value.is_empty() && value.len() < 4096 && fields.insert(key, value).is_none(),
                "HOST_LAUNCH_UNPROVEN",
            )?;
        }
    }
    require(closed, "HOST_LAUNCH_UNPROVEN")?;
    let field = |key| {
        fields
            .get(key)
            .copied()
            .ok_or_else(|| Error::new("HOST_LAUNCH_UNPROVEN"))
    };
    let Some(pid) = fields.get("pid") else {
        require(
            fields.get("state").copied() == Some("not running"),
            "HOST_LAUNCH_UNPROVEN",
        )?;
        field("path")?;
        field("type")?;
        field("program")?;
        return Ok(None);
    };
    let pid = pid
        .parse::<u32>()
        .map_err(|_| Error::new("HOST_LAUNCH_UNPROVEN"))?;
    require(pid > 0, "HOST_LAUNCH_UNPROVEN")?;
    Ok(Some(Metadata {
        domain_service: expected.into(),
        path: field("path")?.into(),
        kind: field("type")?.into(),
        program: field("program")?.into(),
        pid,
    }))
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/launch.rs"]
mod tests;
