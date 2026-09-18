//! One exact inert launchd-domain permission probe, never a service installer.
use super::super::{
    files, gate, journal,
    packet::Packet,
    process::{Output, Tool},
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    trust::digest,
    Error, Result,
};
use serde::Serialize;
use std::os::macos::fs::MetadataExt as MacMetadataExt;
use std::{fs::File, os::unix::fs::MetadataExt, path::Path};
const NAME: &str = "lifecycle-denial-probe.plist";
const PATH: &str = "/usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist";
const LABEL: &str = "system/ai.agent-deployd.lifecycle-denial-probe";
const PLIST: &[u8] = br#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>ai.agent-deployd.lifecycle-denial-probe</string>
<key>ProgramArguments</key><array><string>/usr/bin/true</string></array>
<key>UserName</key><string>authsvc</string><key>GroupName</key><string>authsvc</string>
<key>RunAtLoad</key><false/><key>KeepAlive</key><false/>
</dict></plist>
"#;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Action {
    Before,
    Readable,
    Bootstrap,
    After,
    Cleanup,
    Recovered,
}
#[derive(Serialize, PartialEq, Eq)]
struct Owned {
    device: u64,
    inode: u64,
    uid: u32,
    gid: u32,
    mode: u32,
    flags: u32,
    ctime: i64,
    ctime_ns: i64,
    sha256: String,
}
fn image(file: &File, uid: u32, gid: u32) -> Result<Owned> {
    let raw = snapshot(file, uid, 4096)?.bytes;
    let m = file.metadata()?;
    require(
        m.gid() == gid && m.mode() & 0o7777 == 0o644 && m.st_flags() == 0 && raw == PLIST,
        "DOMAIN_PROBE_FILE_DRIFT",
    )?;
    Ok(Owned {
        device: m.dev(),
        inode: m.ino(),
        uid: m.uid(),
        gid: m.gid(),
        mode: m.mode(),
        flags: m.st_flags(),
        ctime: m.ctime(),
        ctime_ns: m.ctime_nsec(),
        sha256: sha(&raw),
    })
}
fn verify(parent: &Dir, held: &File, owned: &Owned) -> Result<()> {
    require(
        image(held, owned.uid, owned.gid)? == *owned
            && image(
                &parent.open_file(NAME, libc::O_RDONLY, 0)?,
                owned.uid,
                owned.gid,
            )? == *owned,
        "DOMAIN_PROBE_FILE_DRIFT",
    )
}
fn absent(output: &Output) -> bool {
    let lines: Vec<_> = output
        .stdout
        .lines()
        .chain(output.stderr.lines())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let message =
        "Could not find service \"ai.agent-deployd.lifecycle-denial-probe\" in domain for system";
    output.code == Some(113) && (lines == [message] || lines == ["Bad request.", message])
}
fn readable(output: &Output) -> bool {
    output.code == Some(0)
        && output.stderr.is_empty()
        && output.stdout.trim() == format!("{PATH}: OK")
}
fn denied(output: &Output) -> bool {
    let lines: Vec<_> = output.stderr.lines().filter(|l| !l.is_empty()).collect();
    let known = lines.first().is_some_and(|s| {
        [
            "Bootstrap failed: 1: Operation not permitted",
            "Bootstrap failed: 13: Permission denied",
        ]
        .contains(s)
    });
    super::launchd::denied(output)
        && output.stdout.is_empty()
        && known
        && (lines.len() == 1
            || (lines.len() == 2
                && lines[1] == "Try re-running the command as root for richer errors."))
}
fn exact_loaded(output: &Output) -> bool {
    if output.code != Some(0)
        || !output.stderr.is_empty()
        || output.stdout.lines().next()
            != Some("system/ai.agent-deployd.lifecycle-denial-probe = {")
    {
        return false;
    }
    crate::transaction::parse_launchd(&output.stdout).is_ok_and(|v| {
        v.get("path").map(String::as_str) == Some(PATH)
            && v.get("program").map(String::as_str) == Some("/usr/bin/true")
            && v.get("state").map(String::as_str) == Some("not running")
            && v.get("runs").map(String::as_str) == Some("0")
            && !v.contains_key("pid")
    })
}
fn remove(area: &Dir, parent: &Dir, file: &File, owned: &Owned) -> Result<()> {
    verify(parent, file, owned)?;
    journal::append(area, "domain-probe-cleanup-intent.json", owned)?;
    verify(parent, file, owned)?;
    parent.unlink(NAME)?;
    files::absent(parent, NAME)?;
    journal::append(area, "domain-probe-cleanup-result.json", owned)
}
fn sequence(
    area: &Dir,
    parent: &Dir,
    binding: &str,
    mut call: impl FnMut(Action) -> Result<Output>,
) -> Result<String> {
    files::absent(parent, NAME)?;
    let before = call(Action::Before)?;
    require(absent(&before), "DOMAIN_PROBE_PRIOR_LABEL")?;
    journal::append(
        area,
        "domain-probe-file-intent.json",
        &serde_json::json!({"binding":binding,"path":PATH,"sha256":sha(PLIST)}),
    )?;
    let gid = parent.file.metadata()?.gid();
    let file = write_new(parent, NAME, PLIST, parent.uid, gid, 0o644)?;
    let owned = image(&file, parent.uid, gid)?;
    journal::append(area, "domain-probe-file-result.json", &owned)?;
    let read = call(Action::Readable)?;
    require(readable(&read), "DOMAIN_PROBE_UNREADABLE")?;
    verify(parent, &file, &owned)?;
    let bootstrap = call(Action::Bootstrap)?;
    require(bootstrap.code.is_some(), "DOMAIN_PROBE_UNKNOWN")?;
    let after = call(Action::After)?;
    verify(parent, &file, &owned)?;
    if denied(&bootstrap) && absent(&after) {
        remove(area, parent, &file, &owned)?;
        return digest(&(binding, owned, before, read, bootstrap, after));
    }
    journal::append(
        area,
        "domain-probe-unexpected.json",
        &serde_json::json!({"bootstrap":bootstrap,"after":after,"pass":false}),
    )?;
    // Only exact inert state produced by this one attempt authorizes cleanup.
    // Unknown/malformed state and unrelated labels remain untouched.
    if exact_loaded(&after) {
        let cleanup = call(Action::Cleanup)?;
        require(cleanup.code == Some(0), "DOMAIN_PROBE_CLEANUP_UNKNOWN")?;
        let recovered = call(Action::Recovered)?;
        require(absent(&recovered), "DOMAIN_PROBE_CLEANUP_UNKNOWN")?;
        remove(area, parent, &file, &owned)?;
    }
    Err(Error::new("DOMAIN_AUTHORITY_NOT_DENIED"))
}
fn parent_current(parent: &Dir) -> Result<()> {
    let current = Dir::open(Path::new("/usr/local/libexec/agent-deployd"), 0)?;
    let actual = current.file.metadata()?;
    let held = parent.file.metadata()?;
    require(
        actual.uid() == 0
            && actual.gid() == 0
            && actual.mode() & 0o7777 == 0o755
            && (actual.dev(), actual.ino()) == (held.dev(), held.ino()),
        "DOMAIN_PROBE_PARENT",
    )
}
pub(super) fn probe(area: &Dir, p: &Packet, g: &gate::Grant) -> Result<String> {
    require(unsafe { libc::geteuid() } == 0, "FIRST_LIVE_REQUIRES_ROOT")?;
    let parent = Dir::open(Path::new("/usr/local/libexec/agent-deployd"), 0)?;
    let m = parent.file.metadata()?;
    require(
        m.uid() == 0 && m.gid() == 0 && m.mode() & 0o7777 == 0o755,
        "DOMAIN_PROBE_PARENT",
    )?;
    sequence(area, &parent, &g.packet_sha256, |action| {
        parent_current(&parent)?;
        let (name, tool, args, caller) = match action {
            Action::Before => (
                "domain-probe-before",
                Tool::Launchctl,
                vec!["print".into(), LABEL.into()],
                false,
            ),
            Action::Readable => (
                "domain-probe-readable",
                Tool::Plutil,
                vec!["-lint".into(), PATH.into()],
                true,
            ),
            Action::Bootstrap => (
                "domain-probe-bootstrap",
                Tool::Launchctl,
                vec!["bootstrap".into(), "system".into(), PATH.into()],
                true,
            ),
            Action::After => (
                "domain-probe-after",
                Tool::Launchctl,
                vec!["print".into(), LABEL.into()],
                false,
            ),
            Action::Cleanup => (
                "domain-probe-bootout",
                Tool::Launchctl,
                vec!["bootout".into(), LABEL.into()],
                false,
            ),
            Action::Recovered => (
                "domain-probe-recovered",
                Tool::Launchctl,
                vec!["print".into(), LABEL.into()],
                false,
            ),
        };
        let observed = super::commands::observed(area, name, p, g, tool, &args, caller)?;
        parent_current(&parent)?;
        Ok(observed)
    })
}
#[cfg(test)]
#[path = "../../../test/first_live/domain_probe.rs"]
mod tests;
