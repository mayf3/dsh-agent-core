//! Fixed Apple parser over the same protected, hash-checked bytes; no pathname reopen.
use crate::{error::require, Error, Result};
use std::{
    io::{Read, Write},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
const MAX: usize = 1024 * 1024;
pub fn verify_service_plist(bytes: &[u8], plutil_sha256: &str) -> Result<serde_json::Value> {
    require(!bytes.is_empty() && bytes.len() <= MAX, "PLIST_LIMIT")?;
    super::loader::platform_tool(true, plutil_sha256)?;
    let mut child = Command::new("/usr/bin/plutil")
        .args(["-convert", "json", "-o", "-", "--", "-"])
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let mut stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    let input = bytes.to_vec();
    let writer = std::thread::spawn(move || stdin.write_all(&input));
    let reader = std::thread::spawn(move || {
        let mut output = Vec::new();
        stdout
            .take((MAX + 1) as u64)
            .read_to_end(&mut output)
            .map(|_| output)
    });
    let deadline = Instant::now() + Duration::from_secs(2);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(5)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(Error::new("PLIST_PARSER_TIMEOUT"));
            }
        }
    };
    let written = writer.join().map_err(|_| Error::new("PLIST_PARSER_IO"))?;
    let output = reader.join().map_err(|_| Error::new("PLIST_PARSER_IO"))??;
    require(
        status?.success() && written.is_ok() && output.len() <= MAX,
        "PLIST_INVALID",
    )?;
    crate::service::protocol::depth(&output, 32)?;
    let value: serde_json::Value = serde_json::from_slice(&output)?;
    require(value.is_object(), "PLIST_INVALID")?;
    if let Some(env) = value.get("EnvironmentVariables") {
        let env = env.as_object().ok_or(Error::new("PLIST_ENVIRONMENT"))?;
        require(env.len() <= 256, "PLIST_LIMIT")?;
        for (key, value) in env {
            require(
                value.is_string()
                    && !key.starts_with("DYLD_")
                    && !key.starts_with("LD_")
                    && !key.starts_with("__XPC_DYLD_")
                    && ![
                        "NODE_OPTIONS",
                        "NODE_PATH",
                        "NODE_REPL_EXTERNAL_MODULE",
                        "OPENSSL_CONF",
                        "OPENSSL_MODULES",
                        "NODE_ICU_DATA",
                        "ICU_DATA",
                    ]
                    .contains(&key.as_str()),
                "PLIST_LOADER_ENVIRONMENT",
            )?;
        }
    }
    Ok(value)
}
