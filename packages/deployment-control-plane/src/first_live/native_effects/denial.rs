//! Fixed denial syscalls. Only immutable reviewed inventory constructs targets.
#[path = "denial_child.rs"]
mod denial_child;
use super::super::{
    files,
    inventory::{self, Kind, Tree},
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::{validate, Dir},
        MutationGuard,
    },
    transaction::{NativeMaintenanceInput, ProcessIdentity},
    trust::digest,
    Error, Result,
};
use denial_child::{child, reap};
use serde::Serialize;
use std::{
    ffi::CString,
    fs::File,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::fs::MetadataExt,
    },
    path::Path,
    time::Duration,
};
const PROBE: &std::ffi::CStr = c".agent-deployd-denial-probe";
#[derive(Clone, Copy)]
enum Class {
    Write,
    Create,
    Signal,
}
impl Class {
    fn name(self) -> &'static str {
        match self {
            Self::Write => "write",
            Self::Create => "create",
            Self::Signal => "signal",
        }
    }
}
struct Parent {
    held: Option<File>,
    path: CString,
    device: u64,
    inode: u64,
}
struct Target {
    parent: usize,
    name: CString,
}
pub(super) struct Targets {
    parents: Vec<Parent>,
    files: Vec<Target>,
}
fn cs(s: &str) -> Result<CString> {
    CString::new(s).map_err(|_| Error::new("DENIAL_PATH"))
}
impl Targets {
    pub(super) fn from_inventory(
        trees: &[Tree; 3],
        enrollment: &NativeMaintenanceInput,
    ) -> Result<Self> {
        enrollment.validate()?;
        let mut result = Self {
            parents: Vec::new(),
            files: Vec::new(),
        };
        let mut indices = std::collections::BTreeMap::new();
        for (tree, name) in trees.iter().zip(["app", "harness", "node-runtime"]) {
            inventory::validate(&tree.entries)?;
            let root = format!("/usr/local/libexec/agent-core/{name}");
            result.parent(&mut indices, &root, tree.root.device, tree.root.inode)?;
            for (path, e) in &tree.entries {
                if e.kind == Kind::Directory {
                    result.parent(&mut indices, &format!("{root}/{path}"), e.device, e.inode)?;
                }
            }
            for (path, e) in &tree.entries {
                if e.kind == Kind::File {
                    result.file(&indices, &format!("{root}/{path}"))?;
                }
            }
        }
        for path in [
            "/usr/local",
            "/usr/local/libexec",
            "/usr/local/libexec/agent-core",
            "/usr/local/libexec/agent-deployd",
            "/Library/LaunchDaemons",
        ] {
            let dir = Dir::open(Path::new(path), 0)?;
            let m = dir.file.metadata()?;
            result.parent(&mut indices, path, m.dev(), m.ino())?;
        }
        let control = "/private/var/db/agent-deployd";
        let dir = Dir::open(Path::new(control), 0)?;
        let meta = dir.file.metadata()?;
        result.parent(&mut indices, control, meta.dev(), meta.ino())?;
        result.parents[indices[control]].held = Some(dir.file);
        for name in ["service.json", "issuer-policy.json", "local-trust.json"] {
            result.file(&indices, &format!("{control}/{name}"))?;
        }
        for s in &enrollment.services {
            result.file(&indices, s.kind.plist())?;
        }
        for path in [
            "/usr/local/libexec/agent-deployd/agent-deployd",
            "/usr/local/libexec/lw-pilot-executor",
        ] {
            result.file(&indices, path)?;
        }
        require(
            !result.files.is_empty()
                && result.files.len() <= 300010
                && result.parents.len() <= 300010,
            "DENIAL_LIMIT",
        )?;
        Ok(result)
    }
    fn parent(
        &mut self,
        map: &mut std::collections::BTreeMap<String, usize>,
        path: &str,
        device: u64,
        inode: u64,
    ) -> Result<()> {
        if let Some(i) = map.get(path) {
            return require(
                self.parents[*i].device == device && self.parents[*i].inode == inode,
                "DENIAL_PARENT_DRIFT",
            );
        }
        map.insert(path.into(), self.parents.len());
        self.parents.push(Parent {
            held: None,
            path: cs(path)?,
            device,
            inode,
        });
        Ok(())
    }
    fn file(&mut self, map: &std::collections::BTreeMap<String, usize>, path: &str) -> Result<()> {
        let p = Path::new(path);
        let parent = p
            .parent()
            .and_then(|p| p.to_str())
            .and_then(|p| map.get(p))
            .ok_or(Error::new("DENIAL_PARENT"))?;
        self.files.push(Target {
            parent: *parent,
            name: cs(p
                .file_name()
                .and_then(|s| s.to_str())
                .ok_or(Error::new("DENIAL_PATH"))?)?,
        });
        Ok(())
    }
}
fn stamp(file: &File) -> Result<[u64; 8]> {
    let m = file.metadata()?;
    Ok([
        m.dev(),
        m.ino(),
        m.uid() as u64,
        m.gid() as u64,
        m.mode() as u64,
        m.len(),
        m.ctime() as u64,
        m.ctime_nsec() as u64,
    ])
}
pub(super) struct Context<'a> {
    journal: &'a Dir,
    _guard: &'a MutationGuard,
    proof: [File; 2],
    stamps: [[u64; 8]; 2],
    groups: Vec<u32>,
    uid: u32,
    gid: u32,
}
impl<'a> Context<'a> {
    pub(super) fn new(
        journal: &'a Dir,
        intent_sha: &str,
        self_sha: &str,
        groups: &[u32],
        guard: &'a MutationGuard,
    ) -> Result<Self> {
        require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
        guard.binds(&Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?)?;
        require(
            journal.uid == 0 && groups.len() <= 32 && groups.contains(&20) && !groups.contains(&0),
            "DENIAL_IDENTITY",
        )?;
        let self_dir = Dir::open(Path::new("/usr/local/libexec/agent-deployd"), 0)?;
        let executable = self_dir.open_file("agent-deployd", libc::O_RDONLY, 0)?;
        require(
            sha(&snapshot(&executable, 0, 128 * 1024 * 1024)?.bytes) == self_sha
                && executable.metadata()?.mode() & 0o7777 == 0o555,
            "DENIAL_SELF",
        )?;
        require(
            stamp(&executable)? == stamp(&File::open(std::env::current_exe()?)?)?,
            "DENIAL_SELF",
        )?;
        let intent = journal.open_file("first-live-intent.json", libc::O_RDONLY, 0)?;
        require(
            sha(&snapshot(&intent, 0, 1024 * 1024)?.bytes) == intent_sha
                && intent.metadata()?.mode() & 0o7777 == 0o400,
            "DENIAL_INTENT",
        )?;
        let stamps = [stamp(&executable)?, stamp(&intent)?];
        Ok(Self {
            journal,
            _guard: guard,
            proof: [executable, intent],
            stamps,
            groups: groups.into(),
            uid: 502,
            gid: 20,
        })
    }
}
#[derive(Debug, Serialize)]
pub(super) struct Report {
    pub total: u64,
    pub inconclusive: bool,
    pub denied: u64,
    pub eacces: u64,
    pub eperm: u64,
    pub unexpected: bool,
    pub errno: i32,
    pub failed_index: usize,
    pub created: Option<(u64, u64)>,
    pub cleaned: bool,
}
pub(super) fn probe_quiescent(targets: &Targets, context: &Context<'_>) -> Result<Vec<Report>> {
    let mut results = Vec::new();
    for class in [Class::Write, Class::Create] {
        let r = run(class, targets, &[], context)?;
        results.push(finish(class, targets, context, r)?);
    }
    Ok(results)
}
pub(super) fn probe_signal(processes: &[ProcessIdentity], context: &Context<'_>) -> Result<Report> {
    require(
        !processes.is_empty() && processes.len() <= 3,
        "DENIAL_PROCESS_SET",
    )?;
    for p in processes {
        require(
            p.pid > 1
                && p.pid <= i32::MAX as u32
                && p.uid == 505
                && crate::transaction::first_live_process_identity(p.pid)? == *p,
            "DENIAL_PROCESS_DRIFT",
        )?;
    }
    let targets = Targets {
        parents: Vec::new(),
        files: Vec::new(),
    };
    let pids: Vec<_> = processes.iter().map(|p| p.pid).collect();
    let r = run(Class::Signal, &targets, &pids, context)?;
    for p in processes {
        require(
            crate::transaction::first_live_process_identity(p.pid)? == *p,
            "DENIAL_PROCESS_DRIFT",
        )?;
    }
    finish(Class::Signal, &targets, context, r)
}
fn run(class: Class, targets: &Targets, pids: &[u32], context: &Context<'_>) -> Result<Report> {
    let total = match class {
        Class::Write => targets.files.len(),
        Class::Create => targets.parents.len(),
        Class::Signal => pids.len(),
    };
    require(total > 0, "DENIAL_EMPTY")?;
    for (i, f) in context.proof.iter().enumerate() {
        require(stamp(f)? == context.stamps[i], "DENIAL_CONTEXT_DRIFT")?;
    }
    let coordinates: Vec<_> = targets
        .parents
        .iter()
        .map(|p| (p.path.to_string_lossy(), p.device, p.inode))
        .collect();
    let names: Vec<_> = targets
        .files
        .iter()
        .map(|t| (t.parent, t.name.to_string_lossy()))
        .collect();
    let name = class.name();
    files::publish(
        context.journal,
        &format!("native-denial-{name}-intent.json"),
        &serde_json::json!({"context":context.stamps,"targets":digest(&(coordinates,names,pids))?,"uid":context.uid,"gid":context.gid,"total":total}),
    )?;
    let mut fds = [-1; 2];
    require(unsafe { libc::pipe(fds.as_mut_ptr()) } == 0, "DENIAL_PIPE")?;
    let reader = unsafe { File::from_raw_fd(fds[0]) };
    let writer = unsafe { File::from_raw_fd(fds[1]) };
    for fd in fds {
        require(
            unsafe { libc::fcntl(fd, libc::F_SETFD, libc::FD_CLOEXEC) } == 0,
            "DENIAL_PIPE",
        )?;
    }
    require(
        unsafe { libc::fcntl(fds[0], libc::F_SETFL, libc::O_NONBLOCK) } == 0,
        "DENIAL_PIPE",
    )?;
    let fd_limit = unsafe { libc::getdtablesize() };
    require((4..=1_048_576).contains(&fd_limit), "DENIAL_FD_LIMIT")?;
    let held: Vec<_> = targets
        .parents
        .iter()
        .filter_map(|p| p.held.as_ref())
        .collect();
    require(held.len() <= 1, "DENIAL_HELD_DIRECTORY")?;
    let retained = if let Some(file) = held.first() {
        require(
            file.metadata()?.is_dir()
                && unsafe { libc::fcntl(file.as_raw_fd(), libc::F_GETFL) } & libc::O_ACCMODE
                    == libc::O_RDONLY,
            "DENIAL_HELD_DIRECTORY",
        )?;
        let fd = unsafe { libc::fcntl(file.as_raw_fd(), libc::F_DUPFD_CLOEXEC, 10) };
        require(fd >= 10, "DENIAL_HELD_DIRECTORY")?;
        Some(unsafe { File::from_raw_fd(fd) })
    } else {
        None
    };
    let pid = unsafe { libc::fork() };
    require(pid >= 0, "DENIAL_FORK")?;
    if pid == 0 {
        unsafe {
            child(
                class,
                targets,
                pids,
                context,
                fds[1],
                fd_limit,
                retained.as_ref().map(AsRawFd::as_raw_fd),
            );
        }
    }
    drop(writer);
    reap(pid, Duration::from_secs(5))?;
    let mut wire = [0u64; 10];
    require(
        unsafe { libc::read(reader.as_raw_fd(), wire.as_mut_ptr().cast(), 80) } == 80,
        "DENIAL_CHILD_UNKNOWN",
    )?;
    require(
        wire[9] == total as u64 && wire[8] == context.uid as u64,
        "DENIAL_CHILD_IDENTITY",
    )?;
    let report = Report {
        total: total as u64,
        inconclusive: wire[0] == 3,
        denied: wire[1] + wire[2],
        eacces: wire[1],
        eperm: wire[2],
        unexpected: wire[0] == 2,
        errno: wire[4] as i32,
        failed_index: wire[3] as usize,
        created: if wire[5] > 0 {
            Some((wire[5], wire[6]))
        } else {
            None
        },
        cleaned: false,
    };
    files::publish(
        context.journal,
        &format!("native-denial-{name}-result.json"),
        &report,
    )?;
    Ok(report)
}
fn finish(
    class: Class,
    targets: &Targets,
    context: &Context<'_>,
    mut report: Report,
) -> Result<Report> {
    let name = class.name();
    if let Some((device, inode)) = report.created {
        require(matches!(class, Class::Create), "DENIAL_CLEANUP_SCOPE")?;
        let p = targets
            .parents
            .get(report.failed_index)
            .ok_or(Error::new("DENIAL_CLEANUP_SCOPE"))?;
        let path = Path::new(p.path.to_str().map_err(|_| Error::new("DENIAL_PATH"))?);
        let parent = if let Some(held) = &p.held {
            Dir {
                file: held.try_clone()?,
                uid: context.journal.uid,
            }
        } else {
            Dir::open(path, context.journal.uid)?
        };
        let m = parent.file.metadata()?;
        require(
            m.dev() == p.device && m.ino() == p.inode,
            "DENIAL_PARENT_DRIFT",
        )?;
        let f = parent.open_file(PROBE.to_str().unwrap(), libc::O_RDONLY, 0)?;
        let m = f.metadata()?;
        require(
            m.is_file()
                && m.dev() == device
                && m.ino() == inode
                && m.uid() == context.uid
                && m.gid() == context.gid
                && m.mode() & 0o7777 == 0o600
                && m.len() == 0
                && m.nlink() == 1,
            "DENIAL_CLEANUP_DRIFT",
        )?;
        validate(&f, context.uid, false)?;
        parent.unlink(PROBE.to_str().unwrap())?;
        report.cleaned = true;
        files::publish(
            context.journal,
            &format!("native-denial-{name}-cleanup.json"),
            &report,
        )?;
    }
    require(
        !report.unexpected
            && !report.inconclusive
            && report.errno == 0
            && report.total > 0
            && report.denied == report.total,
        "DENIAL_NOT_PROVEN",
    )?;
    Ok(report)
}
#[cfg(test)]
#[path = "../../../test/first_live/denial.rs"]
mod tests;

/// Separate fixed journal avoids colliding with the inventory Create-class receipt.
pub(super) fn probe_socket(
    plan: &crate::bootstrap::socket::SocketAncestorPlan,
    socket_gid: u32,
    identities: &std::collections::BTreeSet<u32>,
    context: &Context<'_>,
) -> Result<Report> {
    let parent = plan.open_preflight(socket_gid, identities)?;
    probe_socket_parent(parent, || plan.preflight(socket_gid, identities), context)
}
fn probe_socket_parent(
    parent: Dir,
    recheck: impl Fn() -> Result<()>,
    context: &Context<'_>,
) -> Result<Report> {
    recheck()?;
    let meta = parent.file.metadata()?;
    let targets = Targets {
        parents: vec![Parent {
            held: Some(parent.file),
            path: cs("/private/var/run")?,
            device: meta.dev(),
            inode: meta.ino(),
        }],
        files: Vec::new(),
    };
    let journal = context.journal.mkdir("socket-denial")?;
    let socket_context = Context {
        journal: &journal,
        _guard: context._guard,
        proof: [context.proof[0].try_clone()?, context.proof[1].try_clone()?],
        stamps: context.stamps,
        groups: context.groups.clone(),
        uid: context.uid,
        gid: context.gid,
    };
    let report = run(Class::Create, &targets, &[], &socket_context)?;
    let result = finish(Class::Create, &targets, &socket_context, report);
    recheck()?;
    result
}
