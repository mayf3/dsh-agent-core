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
pub(super) fn valid_instance_label(label: &str, prefix: &str) -> bool {
    let Some(uuid) = label.strip_prefix(prefix) else {
        return false;
    };
    let groups: Vec<_> = uuid.split('-').collect();
    groups.iter().map(|part| part.len()).collect::<Vec<_>>() == [8, 4, 4, 4, 12]
        && uuid
            .bytes()
            .all(|byte| byte == b'-' || byte.is_ascii_hexdigit())
}
pub(super) fn parse_single_instance(raw: &str, expected: &str, prefix: &str) -> Result<String> {
    use crate::error::require;
    require(
        raw.len() <= 1024 * 1024 && !raw.as_bytes().contains(&0),
        "HOST_LAUNCH_UNPROVEN",
    )?;
    let lines: Vec<_> = raw.lines().collect();
    require(
        lines.first().copied() == Some(format!("{expected} = {{").as_str())
            && lines.last().copied() == Some("}"),
        "HOST_LAUNCH_UNPROVEN",
    )?;
    let mut found = None;
    let mut index = 1;
    while index + 1 < lines.len() {
        let line = lines[index];
        if line == "\tinstances = {" {
            require(found.is_none(), "HOST_LAUNCH_UNPROVEN")?;
            index += 1;
            let mut labels = Vec::new();
            while index + 1 < lines.len() && lines[index] != "\t}" {
                let label = lines[index]
                    .strip_prefix("\t\t")
                    .and_then(|value| value.strip_suffix(','))
                    .ok_or_else(|| Error::new("HOST_LAUNCH_UNPROVEN"))?;
                require(valid_instance_label(label, prefix), "HOST_LAUNCH_UNPROVEN")?;
                labels.push(label.to_owned());
                index += 1;
            }
            require(
                index + 1 < lines.len() && lines[index] == "\t}" && labels.len() == 1,
                "HOST_LAUNCH_UNPROVEN",
            )?;
            found = labels.pop();
        } else if line.strip_prefix('\t').is_some_and(|body| {
            body.strip_prefix("instances").is_some_and(|tail| {
                tail.is_empty() || tail.starts_with('=') || tail.starts_with(char::is_whitespace)
            })
        }) {
            return Err(Error::new("HOST_LAUNCH_UNPROVEN"));
        }
        index += 1;
    }
    found.ok_or_else(|| Error::new("HOST_LAUNCH_UNPROVEN"))
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
        require(
            !body.starts_with(char::is_whitespace),
            "HOST_LAUNCH_UNPROVEN",
        )?;
        let protected = ["path", "type", "program", "pid", "state"];
        if let Some(key) = protected.iter().find(|key| {
            body.strip_prefix(*key).is_some_and(|tail| {
                tail.is_empty() || tail.starts_with('=') || tail.starts_with(char::is_whitespace)
            })
        }) {
            require(
                body.starts_with(&format!("{key} = ")),
                "HOST_LAUNCH_UNPROVEN",
            )?;
        }
        let Some((key, value)) = body.split_once(" = ") else {
            continue;
        };
        if protected.contains(&key) {
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
