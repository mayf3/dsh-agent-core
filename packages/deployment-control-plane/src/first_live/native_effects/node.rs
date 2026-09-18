use super::super::{
    files,
    inventory::{Entry, Kind, Tree},
    native_tree,
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    Result,
};
use std::{collections::BTreeMap, os::unix::fs::MetadataExt};
pub(super) fn install(
    packet: &Dir,
    history: &Dir,
    payloads: &BTreeMap<String, String>,
    before: &Tree,
    guard: &crate::fs::MutationGuard,
    expires: u64,
) -> Result<Tree> {
    guard.binds(&Dir::open(
        std::path::Path::new(crate::issuer::custody::ROOT),
        0,
    )?)?;
    require(
        super::super::compose::now()? < expires,
        "FIRST_LIVE_EXPIRED",
    )?;
    let root = native_tree::open("node-runtime")?;
    let mut after = before.clone();
    let images = self::payloads(packet, payloads)?;
    for (path, hash) in payloads {
        require(
            super::super::compose::now()? < expires,
            "FIRST_LIVE_EXPIRED",
        )?;
        let (dir, name) = path.split_once('/').unwrap();
        let parent = root.child(dir)?;
        let previous = match parent.open_file(name, libc::O_RDONLY, 0) {
            Ok(f) => Some(snapshot(&f, 0, 128 * 1024 * 1024)?),
            Err(e) if e.code() == "ABSENT" => None,
            Err(e) => return Err(e),
        };
        match (&previous, before.entries.get(path)) {
            (Some(image), Some(entry)) => require(
                entry.sha256.as_ref() == Some(&sha(&image.bytes))
                    && image.inode == entry.inode
                    && image.device == entry.device,
                "FIRST_LIVE_NODE_PREIMAGE",
            )?,
            (None, None) => (),
            _ => return Err(crate::Error::new("FIRST_LIVE_NODE_PREIMAGE")),
        };
        let id = crate::trust::digest(path)?;
        let archived = archive_before(history, &id, &previous)?;
        files::publish(
            history,
            &format!("{id}-intent.json"),
            &serde_json::json!({"path":path,"before":archived,"post_sha256":hash}),
        )?;
        let bytes = &images[&format!("/usr/local/libexec/agent-core/node-runtime/{path}")];
        let temp = format!("{name}.first-live");
        write_new(&parent, &temp, bytes, 0, 0, 0o555)?;
        require(
            super::super::compose::now()? < expires,
            "FIRST_LIVE_EXPIRED",
        )?;
        match &previous {
            Some(expected) => require(
                snapshot(
                    &parent.open_file(name, libc::O_RDONLY, 0)?,
                    0,
                    128 * 1024 * 1024,
                )? == *expected,
                "FIRST_LIVE_NODE_PREIMAGE",
            )?,
            None => files::absent(&parent, name)?,
        }
        parent.rename(&temp, &parent, name)?;
        let f = parent.open_file(name, libc::O_RDONLY, 0)?;
        let image = snapshot(&f, 0, 128 * 1024 * 1024)?;
        require(image.bytes == *bytes, "FIRST_LIVE_NODE_READBACK")?;
        let m = f.metadata()?;
        after.entries.insert(
            path.clone(),
            Entry {
                kind: Kind::File,
                uid: 0,
                gid: 0,
                mode: 0o555,
                flags: 0,
                device: m.dev(),
                inode: m.ino(),
                links: 1,
                sha256: Some(hash.clone()),
                link: None,
                post_gid: 0,
                post_mode: 0o555,
            },
        );
        require(
            super::super::compose::now()? < expires,
            "FIRST_LIVE_EXPIRED",
        )?;
        files::publish(
            history,
            &format!("{id}-result.json"),
            &serde_json::json!({"path":path,"sha256":hash,"device":m.dev(),"inode":m.ino()}),
        )?;
    }
    super::super::inventory::census(&root, &after, false, false)?;
    Ok(after)
}
fn archive_before(
    history: &Dir,
    id: &str,
    previous: &Option<crate::fs::file::FileImage>,
) -> Result<serde_json::Value> {
    crate::trust::valid_digest(id)?;
    let name = format!("{id}-bytes");
    files::absent(history, &name)?;
    match previous {
        None => Ok(serde_json::Value::Null),
        Some(image) => {
            write_new(
                history,
                &name,
                &image.bytes,
                history.uid,
                history.file.metadata()?.gid(),
                0o400,
            )?;
            Ok(
                serde_json::json!({"backup":name,"sha256":sha(&image.bytes),"size":image.bytes.len(),"uid":image.uid,"gid":image.gid,"mode":image.mode,"device":image.device,"inode":image.inode,"xattrs":image.xattrs,"mtime_seconds":image.mtime_seconds,"mtime_nanos":image.mtime_nanos}),
            )
        }
    }
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/node.rs"]
mod tests;

pub(super) fn payloads(
    packet: &Dir,
    payloads: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, Vec<u8>>> {
    require(
        payloads.len() == 22 && payloads.contains_key("bin/node"),
        "FIRST_LIVE_NODE_CLOSURE",
    )?;
    let mut images = BTreeMap::new();
    for (path, hash) in payloads {
        crate::trust::valid_digest(hash)?;
        let parts = crate::fs::secure::relative(path)?;
        require(
            parts.len() == 2 && (parts[0] == "lib" || path == "bin/node"),
            "FIRST_LIVE_NODE_PATH",
        )?;
        let bytes = snapshot(
            &packet
                .child("payloads")?
                .open_file(hash, libc::O_RDONLY, 0)?,
            0,
            128 * 1024 * 1024,
        )?
        .bytes;
        require(sha(&bytes) == *hash, "FIRST_LIVE_NODE_BYTES")?;
        images.insert(
            format!("/usr/local/libexec/agent-core/node-runtime/{path}"),
            bytes,
        );
    }
    crate::bootstrap::verify_loader_images(crate::bootstrap::ClosureKind::Runtime, &images)?;
    Ok(images)
}
