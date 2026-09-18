//! Read-only load graph for the fixed non-SSV role images. Never loads code.
use crate::{error::require, Error, Result};
fn word(b: &[u8], offset: usize, big: bool) -> Result<u32> {
    let raw: [u8; 4] = b
        .get(offset..offset + 4)
        .ok_or_else(|| Error::new("HOST_LOADER_FORMAT"))?
        .try_into()
        .unwrap();
    Ok(if big {
        u32::from_be_bytes(raw)
    } else {
        u32::from_le_bytes(raw)
    })
}
fn thin(bytes: &[u8], cpu: u32) -> Result<Vec<String>> {
    require(
        bytes.len() >= 32 && word(bytes, 0, false)? == 0xfeedfacf && word(bytes, 4, false)? == cpu,
        "HOST_LOADER_ARCHITECTURE",
    )?;
    let count = word(bytes, 16, false)? as usize;
    let size = word(bytes, 20, false)? as usize;
    require(
        count <= 4096 && size <= 4 * 1024 * 1024 && size <= bytes.len() - 32,
        "HOST_LOADER_FORMAT",
    )?;
    let mut offset = 32;
    let mut result = Vec::new();
    for _ in 0..count {
        let command = word(bytes, offset, false)?;
        let length = word(bytes, offset + 4, false)? as usize;
        require(
            length >= 8
                && length.is_multiple_of(8)
                && offset <= 32 + size
                && length <= 32 + size - offset,
            "HOST_LOADER_FORMAT",
        )?;
        let data = &bytes[offset..offset + length];
        match command {
            12 | 0x80000018 | 0x8000001f | 0x80000023 | 0x20 | 0x0e => {
                let n = word(data, 8, false)? as usize;
                require(n >= 12 && n < data.len(), "HOST_LOADER_FORMAT")?;
                let end = data[n..]
                    .iter()
                    .position(|b| *b == 0)
                    .ok_or_else(|| Error::new("HOST_LOADER_FORMAT"))?;
                let path = std::str::from_utf8(&data[n..n + end])
                    .map_err(|_| Error::new("HOST_LOADER_FORMAT"))?;
                require(
                    path.starts_with('/')
                        && path.len() < 4096
                        && path[1..]
                            .split('/')
                            .all(|p| !p.is_empty() && p != "." && p != ".."),
                    "HOST_LOADER_DYNAMIC",
                )?;
                if command == 0x0e {
                    require(path == "/usr/lib/dyld", "HOST_LOADER_DYNAMIC")?;
                } else {
                    result.push(path.into());
                }
            }
            0x8000001c | 0x27 => return Err(Error::new("HOST_LOADER_DYNAMIC")),
            1 | 2 | 3 | 4 | 5 | 0xb | 0xd | 0x19 | 0x1b | 0x1d | 0x1e | 0x21 | 0x22
            | 0x80000022 | 0x24 | 0x25 | 0x26 | 0x28 | 0x80000028 | 0x29 | 0x2a | 0x2b | 0x2c
            | 0x2d | 0x2e | 0x2f | 0x30 | 0x31 | 0x32 | 0x80000033 | 0x80000034 | 0x36 => (),
            _ => return Err(Error::new("HOST_LOADER_COMMAND")),
        }
        offset += length;
    }
    require(offset == 32 + size, "HOST_LOADER_FORMAT")?;
    Ok(result)
}
pub(super) fn dependencies(bytes: &[u8], cpu: u32) -> Result<Vec<String>> {
    let magic = word(bytes, 0, true)?;
    if magic != 0xcafebabe && magic != 0xcafebabf {
        return thin(bytes, cpu);
    }
    let count = word(bytes, 4, true)? as usize;
    let width = if magic == 0xcafebabf { 32 } else { 20 };
    require(
        count > 0 && count <= 64 && 8 + count * width <= bytes.len(),
        "HOST_LOADER_FORMAT",
    )?;
    let mut selected = None;
    for i in 0..count {
        let at = 8 + i * width;
        let kind = word(bytes, at, true)?;
        let (offset, size) = if width == 20 {
            (
                word(bytes, at + 8, true)? as u64,
                word(bytes, at + 12, true)? as u64,
            )
        } else {
            let wide = |n| -> Result<u64> {
                Ok(u64::from_be_bytes(
                    bytes
                        .get(n..n + 8)
                        .ok_or_else(|| Error::new("HOST_LOADER_FORMAT"))?
                        .try_into()
                        .unwrap(),
                ))
            };
            (wide(at + 8)?, wide(at + 16)?)
        };
        require(
            offset >= (8 + count * width) as u64
                && offset <= bytes.len() as u64
                && size <= bytes.len() as u64 - offset,
            "HOST_LOADER_FORMAT",
        )?;
        if kind == cpu {
            require(selected.is_none(), "HOST_LOADER_ARCHITECTURE")?;
            selected = Some(&bytes[offset as usize..(offset + size) as usize]);
        }
    }
    thin(
        selected.ok_or_else(|| Error::new("HOST_LOADER_ARCHITECTURE"))?,
        cpu,
    )
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/macho.rs"]
mod tests;
