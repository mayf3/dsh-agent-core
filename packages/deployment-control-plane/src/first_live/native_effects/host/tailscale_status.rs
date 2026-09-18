use crate::{error::require, Error, Result};
pub(super) fn parse(raw: &[u8]) -> Result<String> {
    require(raw.len() <= 1024 * 1024, "TAILSCALE_STATUS_LIMIT")?;
    let at = raw
        .windows(4)
        .position(|p| p == b"\r\n\r\n")
        .ok_or_else(|| Error::new("TAILSCALE_HTTP"))?;
    require(at <= 16384, "TAILSCALE_HTTP")?;
    let head = std::str::from_utf8(&raw[..at]).map_err(|_| Error::new("TAILSCALE_HTTP"))?;
    let mut lines = head.split("\r\n");
    require(
        matches!(lines.next(), Some("HTTP/1.0 200 OK" | "HTTP/1.1 200 OK")),
        "TAILSCALE_HTTP",
    )?;
    let mut length = None;
    for line in lines {
        let (key, value) = line
            .split_once(':')
            .ok_or_else(|| Error::new("TAILSCALE_HTTP"))?;
        require(
            !key.is_empty() && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'),
            "TAILSCALE_HTTP",
        )?;
        let value = value.trim();
        match key.to_ascii_lowercase().as_str() {
            "content-length" => {
                require(length.is_none(), "TAILSCALE_HTTP")?;
                length = Some(
                    value
                        .parse::<usize>()
                        .map_err(|_| Error::new("TAILSCALE_HTTP"))?,
                );
            }
            "transfer-encoding" => return Err(Error::new("TAILSCALE_HTTP")),
            "content-encoding" => require(value == "identity", "TAILSCALE_HTTP")?,
            _ => (),
        }
    }
    let body = &raw[at + 4..];
    require(length.is_none_or(|n| n == body.len()), "TAILSCALE_HTTP")?;
    let value = crate::verification::documents::strict_json(body)?;
    require(
        value.get("BackendState").and_then(|v| v.as_str()) == Some("Running"),
        "TAILSCALE_NOT_RUNNING",
    )?;
    let own = value
        .get("Self")
        .ok_or_else(|| Error::new("TAILSCALE_IDENTITY"))?;
    let mut selected = Vec::new();
    for key in ["ID", "PublicKey"] {
        let text = own
            .get(key)
            .and_then(|v| v.as_str())
            .ok_or_else(|| Error::new("TAILSCALE_IDENTITY"))?;
        require(
            !text.is_empty() && text.len() <= 256 && !text.chars().any(char::is_control),
            "TAILSCALE_IDENTITY",
        )?;
        selected.push(text);
    }
    Ok(crate::fs::file::sha(&crate::trust::canonical_bytes(
        &selected,
    )?))
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/tailscale_status.rs"]
mod tests;
