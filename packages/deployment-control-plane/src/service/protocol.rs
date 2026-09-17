use crate::{
    error::require,
    trust::{valid_digest, valid_id},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{
    io::{Read, Write},
    os::unix::net::UnixStream,
    time::{Duration, Instant},
};
pub const MAX_FRAME: usize = 65536;
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub version: u32,
    pub request_id: String,
    pub operation: Operation,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Operation {
    Submit { proposal_digest: String },
    Status { unit_id: String },
    Receipt { digest: String },
    CancelPending { unit_id: String },
    RetryVerification { unit_id: String },
}
impl Request {
    pub fn validate(&self) -> Result<()> {
        require(self.version == 1, "PROTOCOL_VERSION")?;
        valid_id(&self.request_id)?;
        let identifier = match &self.operation {
            Operation::Submit { proposal_digest } => proposal_digest,
            Operation::Status { unit_id }
            | Operation::CancelPending { unit_id }
            | Operation::RetryVerification { unit_id } => unit_id,
            Operation::Receipt { digest } => digest,
        };
        valid_digest(identifier)
    }
}
pub fn depth(raw: &[u8], max: usize) -> Result<()> {
    let (mut nesting, mut quoted, mut escaped) = (0usize, false, false);
    for b in raw {
        if quoted {
            if escaped {
                escaped = false;
            } else if *b == b'\\' {
                escaped = true;
            } else if *b == b'"' {
                quoted = false;
            }
        } else {
            match b {
                b'"' => quoted = true,
                b'{' | b'[' => {
                    nesting += 1;
                    require(nesting <= max, "NESTING_LIMIT")?;
                }
                b'}' | b']' => nesting = nesting.saturating_sub(1),
                _ => (),
            }
        }
    }
    Ok(())
}
fn exact(stream: &mut UnixStream, mut buffer: &mut [u8], deadline: Instant) -> Result<()> {
    while !buffer.is_empty() {
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or(Error::new("READ_TIMEOUT"))?;
        stream.set_read_timeout(Some(remaining))?;
        let count = stream
            .read(buffer)
            .map_err(|_| Error::new("READ_TIMEOUT"))?;
        require(count != 0, "DISCONNECTED")?;
        buffer = &mut buffer[count..];
    }
    Ok(())
}
pub fn read_frame(stream: &mut UnixStream, limit: usize) -> Result<Vec<u8>> {
    let deadline = Instant::now() + Duration::from_secs(1);
    let mut size = [0; 4];
    exact(stream, &mut size, deadline)?;
    let length = u32::from_be_bytes(size) as usize;
    require(length > 0 && length <= limit, "FRAME_LIMIT")?;
    let mut raw = vec![0; length];
    exact(stream, &mut raw, deadline)?;
    depth(&raw, 16)?;
    Ok(raw)
}
pub fn write_frame(stream: &mut UnixStream, value: &impl Serialize) -> Result<()> {
    let raw = serde_json::to_vec(value)?;
    require(raw.len() <= 8 * 1024 * 1024, "RESPONSE_LIMIT")?;
    stream.set_write_timeout(Some(Duration::from_secs(1)))?;
    stream.write_all(&(raw.len() as u32).to_be_bytes())?;
    stream.write_all(&raw)?;
    Ok(())
}
pub fn client(stream: &mut UnixStream, request: &Request) -> Result<serde_json::Value> {
    request.validate()?;
    write_frame(stream, request)?;
    Ok(serde_json::from_slice(&read_frame(
        stream,
        8 * 1024 * 1024,
    )?)?)
}
