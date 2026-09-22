//! Fixed legacy exclusion handover. These locks do not prove caller-controlled
//! override/privilege routes are refused; the operator must prove that separately.
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::{component, reject_acl, validate, Dir},
        MutationGuard,
    },
    trust::canonical_bytes,
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{
    ffi::CString,
    fs::File,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::fs::MetadataExt,
    },
    path::{Path, PathBuf},
};

const PARENTS: [&str; 4] = [
    "/private/var/run",
    "/usr/local/var/agent-core/production-mutation-locks",
    "/private/var/db/agent-core",
    "/private/var/db/agent-core/deployments",
];
const NAMES: [&str; 4] = [
    "agent-core-production-mutation.lock",
    "production-deploy.lock",
    "production-transaction.lock",
    "transaction.lock",
];
const HOLDERS: [&str; 2] = ["holder", "dcp-handover.json"];
const LEGACY_ANCESTOR: &str = "/usr/local/var/agent-core";
const LEGACY_LOCK_CHILD: &str = "production-mutation-locks";
const FENCE_PROBE_PARENT: &str = "/private/var/db/agent-deployd";
const FENCE_PROBE_NAME: &str = "first-live-fence-capability-p4r13";
const FENCE_PROBE_PARENT_INODE: u64 = 85_616_151;
// Current macOS/XNU SF_IMMUTABLE. P4R12 proved that SF_NOUNLINK could not be
// established on the exact production APFS inode. Keep this local: this is not
// a generic chflags API.
const LEGACY_ANCESTOR_FLAG: u32 = 0x0002_0000;
const P4R14R2_BINDING: &str = "04ffd0d460f4ee1e61667a3ba4dc5b5d4457b2c2ecc033d6869d79b6e29dd174";
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Identity {
    pub device: u64,
    pub inode: u64,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct AncestorFenceExpectation {
    pub identity: Identity,
    pub flags: u32,
    pub acl_none: bool,
}
impl Identity {
    fn of(file: &File) -> Result<Self> {
        let m = file.metadata()?;
        Ok(Self {
            device: m.dev(),
            inode: m.ino(),
            uid: m.uid(),
            gid: m.gid(),
            mode: m.mode() & 0o7777,
        })
    }
    fn check(&self, file: &File) -> Result<()> {
        require(*self == Self::of(file)?, "LEGACY_LOCK_DRIFT")
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum PermanentExpectation {
    Present { identity: Identity },
    AbsentCreate,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Expectations {
    pub ancestor_fence: AncestorFenceExpectation,
    pub parents: [Identity; 4],
    pub permanent: PermanentExpectation,
}

trait FenceFlags {
    fn flags(file: &File) -> Result<u32>;
    fn set(file: &File, flags: u32) -> Result<()>;
}
struct NativeFenceFlags;
fn fence_effect_error(errno: i32) -> Error {
    Error::new(match errno {
        libc::EPERM => "LEGACY_FENCE_EFFECT_EPERM",
        libc::EINVAL => "LEGACY_FENCE_EFFECT_EINVAL",
        libc::ENOTSUP => "LEGACY_FENCE_EFFECT_ENOTSUP",
        libc::EROFS => "LEGACY_FENCE_EFFECT_EROFS",
        libc::EBADF => "LEGACY_FENCE_EFFECT_EBADF",
        _ => "LEGACY_FENCE_EFFECT_OTHER",
    })
}
impl FenceFlags for NativeFenceFlags {
    fn flags(file: &File) -> Result<u32> {
        Ok(std::os::macos::fs::MetadataExt::st_flags(&file.metadata()?))
    }
    fn set(file: &File, flags: u32) -> Result<()> {
        if unsafe { libc::fchflags(file.as_raw_fd(), flags) } == 0 {
            Ok(())
        } else {
            Err(fence_effect_error(
                std::io::Error::last_os_error().raw_os_error().unwrap_or(0),
            ))
        }
    }
}

struct AncestorFence<F: FenceFlags = NativeFenceFlags> {
    dir: Dir,
    expected: AncestorFenceExpectation,
    operation_id: String,
    binding: String,
    original_flags: u32,
    path: PathBuf,
    _flags: std::marker::PhantomData<F>,
}
fn open_fixed_legacy_ancestor(uid: u32) -> Result<Dir> {
    let root = unsafe {
        libc::open(
            c"/".as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    require(root >= 0, "LEGACY_FENCE_OPEN")?;
    let mut file = unsafe { File::from_raw_fd(root) };
    for name in ["usr", "local", "var", "agent-core"] {
        let name = CString::new(name).unwrap();
        let fd = unsafe {
            libc::openat(
                file.as_raw_fd(),
                name.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        require(fd >= 0, "LEGACY_FENCE_OPEN")?;
        file = unsafe { File::from_raw_fd(fd) };
    }
    Ok(Dir { file, uid })
}
fn check_fence_object<F: FenceFlags>(
    dir: &Dir,
    expected: &AncestorFenceExpectation,
    flags: u32,
) -> Result<()> {
    let metadata = dir.file.metadata()?;
    require(metadata.is_dir(), "LEGACY_FENCE_TYPE")?;
    expected.identity.check(&dir.file)?;
    require(expected.identity.uid == dir.uid, "UNSAFE_OWNER")?;
    require(F::flags(&dir.file)? == flags, "LEGACY_FENCE_FLAGS")?;
    require(expected.acl_none, "LEGACY_FENCE_ACL")?;
    reject_acl(&dir.file)
}
fn check_production_fence_policy(expected: &AncestorFenceExpectation) -> Result<()> {
    require(
        expected.identity.uid == 0
            && expected.identity.gid == 80
            && expected.identity.mode == 0o755
            && expected.flags == 0
            && expected.acl_none,
        "LEGACY_FENCE_POLICY",
    )
}
fn verify_fence_journal(
    journal: &Dir,
    operation_id: &str,
    binding: &str,
    expected: &AncestorFenceExpectation,
    expected_path: &Path,
) -> Result<()> {
    let intent: serde_json::Value =
        super::files::read(journal, "legacy-ancestor-fence-intent.json")?;
    let result: serde_json::Value =
        super::files::read(journal, "legacy-ancestor-fence-result.json")?;
    let path = expected_path
        .to_str()
        .ok_or(Error::new("LEGACY_FENCE_PATH"))?;
    require(
        intent
            == serde_json::json!({
                "operation_id":operation_id,
                "binding":binding,
                "path":path,
                "identity":expected.identity,
                "original_flags":expected.flags,
                "set_flag":LEGACY_ANCESTOR_FLAG
            })
            && result
                == serde_json::json!({
                    "operation_id":operation_id,
                    "binding":binding,
                    "path":path,
                    "identity":expected.identity,
                    "flags":expected.flags | LEGACY_ANCESTOR_FLAG
                }),
        "LEGACY_FENCE_JOURNAL",
    )
}
fn verify_retained_fence_journal(
    journal: &Dir,
    operation_id: &str,
    binding: &str,
    expected: &AncestorFenceExpectation,
    expected_path: &Path,
) -> Result<()> {
    let intent: serde_json::Value =
        super::files::read(journal, "legacy-ancestor-fence-intent.json")?;
    let path = expected_path
        .to_str()
        .ok_or(Error::new("LEGACY_FENCE_PATH"))?;
    require(
        intent
            == serde_json::json!({
                "operation_id":operation_id,
                "binding":binding,
                "path":path,
                "identity":expected.identity,
                "original_flags":expected.flags,
                "set_flag":LEGACY_ANCESTOR_FLAG
            }),
        "LEGACY_FENCE_JOURNAL",
    )?;
    let names = journal.names()?;
    if names.contains(&"legacy-ancestor-fence-result.json".to_string()) {
        let result: serde_json::Value =
            super::files::read(journal, "legacy-ancestor-fence-result.json")?;
        require(
            result
                == serde_json::json!({
                    "operation_id":operation_id,
                    "binding":binding,
                    "path":path,
                    "identity":expected.identity,
                    "flags":expected.flags | LEGACY_ANCESTOR_FLAG
                }),
            "LEGACY_FENCE_JOURNAL",
        )?;
    }
    Ok(())
}
impl<F: FenceFlags> AncestorFence<F> {
    fn acquire(
        operation_id: &str,
        binding: &str,
        journal: &Dir,
        expected: &AncestorFenceExpectation,
        expected_path: &Path,
        open_fixed: impl Fn() -> Result<Dir>,
    ) -> Result<Self> {
        require(
            expected.flags & LEGACY_ANCESTOR_FLAG == 0,
            "LEGACY_FENCE_FLAGS",
        )?;
        let dir = open_fixed()?;
        check_fence_object::<F>(&dir, expected, expected.flags)?;
        require(fd_path(&dir)? == expected_path, "LEGACY_FENCE_PATH")?;
        let before = expected.identity.clone();
        let path = expected_path
            .to_str()
            .ok_or(Error::new("LEGACY_FENCE_PATH"))?;
        append(
            journal,
            "legacy-ancestor-fence-intent.json",
            &serde_json::json!({
                "operation_id":operation_id,
                "binding":binding,
                "path":path,
                "identity":before,
                "original_flags":expected.flags,
                "set_flag":LEGACY_ANCESTOR_FLAG
            }),
        )?;
        checkpoint("legacy-ancestor-fence-intent");
        if let Err(error) = F::set(&dir.file, expected.flags | LEGACY_ANCESTOR_FLAG) {
            // An effect error is a known failure only when both the retained
            // object and the fixed name still identify the exact preimage with
            // its original flags. Otherwise preserve intent-only UNKNOWN.
            let named = open_fixed();
            let effect_absent = check_fence_object::<F>(&dir, expected, expected.flags).is_ok()
                && named.as_ref().is_ok_and(|named| {
                    fd_path(named).ok().as_deref() == Some(expected_path)
                        && check_fence_object::<F>(named, expected, expected.flags).is_ok()
                        && Identity::of(&named.file).ok() == Identity::of(&dir.file).ok()
                });
            if effect_absent {
                append(
                    journal,
                    "legacy-ancestor-fence-failure.json",
                    &serde_json::json!({
                        "operation_id":operation_id,
                        "binding":binding,
                        "path":path,
                        "identity":before,
                        "attempted_flag":LEGACY_ANCESTOR_FLAG,
                        "observed_flags":expected.flags,
                        "code":error.code(),
                        "state":"effect_absent"
                    }),
                )?;
                return Err(error);
            }
            return Err(Error::new("LEGACY_FENCE_EFFECT_UNKNOWN"));
        }
        dir.file.sync_all()?;
        checkpoint("legacy-ancestor-fence-effect");
        check_fence_object::<F>(&dir, expected, expected.flags | LEGACY_ANCESTOR_FLAG)?;
        let named = open_fixed()?;
        check_fence_object::<F>(&named, expected, expected.flags | LEGACY_ANCESTOR_FLAG)?;
        require(
            Identity::of(&named.file)? == Identity::of(&dir.file)?,
            "LEGACY_FENCE_REPLACED",
        )?;
        append(
            journal,
            "legacy-ancestor-fence-result.json",
            &serde_json::json!({
                "operation_id":operation_id,
                "binding":binding,
                "path":path,
                "identity":before,
                "flags":expected.flags | LEGACY_ANCESTOR_FLAG
            }),
        )?;
        Ok(Self {
            dir,
            expected: expected.clone(),
            operation_id: operation_id.into(),
            binding: binding.into(),
            original_flags: expected.flags,
            path: expected_path.to_path_buf(),
            _flags: std::marker::PhantomData,
        })
    }
    fn verify(&self, expected_path: &Path, open_fixed: impl Fn() -> Result<Dir>) -> Result<()> {
        let flags = self.original_flags | LEGACY_ANCESTOR_FLAG;
        check_fence_object::<F>(&self.dir, &self.expected, flags)?;
        let named = open_fixed()?;
        require(fd_path(&named)? == expected_path, "LEGACY_FENCE_PATH")?;
        check_fence_object::<F>(&named, &self.expected, flags)?;
        require(
            Identity::of(&named.file)? == Identity::of(&self.dir.file)?,
            "LEGACY_FENCE_REPLACED",
        )
    }
    fn lock_parent(&self, expected: &Identity) -> Result<Dir> {
        self.lock_parent_at(expected, Path::new(LEGACY_ANCESTOR), || {
            open_fixed_legacy_ancestor(self.expected.identity.uid)
        })
    }
    fn lock_parent_at(
        &self,
        expected: &Identity,
        expected_path: &Path,
        open_fixed: impl Fn() -> Result<Dir>,
    ) -> Result<Dir> {
        self.verify(expected_path, open_fixed)?;
        let file = self
            .dir
            .open_file(LEGACY_LOCK_CHILD, libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
        validate(&file, self.dir.uid, true)?;
        expected.check(&file)?;
        Ok(Dir {
            file,
            uid: self.dir.uid,
        })
    }
    fn clear(
        self,
        journal: &Dir,
        expected_path: &Path,
        open_fixed: impl Fn() -> Result<Dir>,
    ) -> Result<()> {
        require(self.path == expected_path, "LEGACY_FENCE_PATH")?;
        self.verify(expected_path, &open_fixed)?;
        verify_fence_journal(
            journal,
            &self.operation_id,
            &self.binding,
            &self.expected,
            expected_path,
        )?;
        let names = journal.names()?;
        require(
            !names.iter().any(|name| {
                name == "legacy-ancestor-fence-clear-intent.json"
                    || name == "legacy-ancestor-fence-clear-result.json"
            }),
            "LEGACY_FENCE_PRIOR_CLEAR",
        )?;
        append(
            journal,
            "legacy-ancestor-fence-clear-intent.json",
            &serde_json::json!({
                "operation_id":self.operation_id,
                "binding":self.binding,
                "identity":self.expected.identity,
                "expected_flags":self.original_flags | LEGACY_ANCESTOR_FLAG,
                "restore_flags":self.original_flags
            }),
        )?;
        checkpoint("legacy-ancestor-fence-clear-intent");
        F::set(&self.dir.file, self.original_flags)?;
        self.dir.file.sync_all()?;
        checkpoint("legacy-ancestor-fence-clear-effect");
        check_fence_object::<F>(&self.dir, &self.expected, self.original_flags)?;
        let named = open_fixed()?;
        require(fd_path(&named)? == expected_path, "LEGACY_FENCE_PATH")?;
        check_fence_object::<F>(&named, &self.expected, self.original_flags)?;
        require(
            Identity::of(&named.file)? == Identity::of(&self.dir.file)?,
            "LEGACY_FENCE_REPLACED",
        )?;
        append(
            journal,
            "legacy-ancestor-fence-clear-result.json",
            &serde_json::json!({
                "operation_id":self.operation_id,
                "binding":self.binding,
                "identity":self.expected.identity,
                "flags":self.original_flags
            }),
        )
    }
}

fn fence_capability_probe_at<F: FenceFlags>(parent: &Dir, name: &str) -> Result<serde_json::Value> {
    component(name)?;
    absent(parent, name)?;
    let area = parent.mkdir(name)?;
    let target = area.mkdir("target")?;
    let operations = target.mkdir("operations")?;
    let expected = AncestorFenceExpectation {
        identity: Identity::of(&target.file)?,
        flags: F::flags(&target.file)?,
        acl_none: true,
    };
    require(expected.flags == 0, "LEGACY_FENCE_PROBE_FLAGS")?;
    check_fence_object::<F>(&target, &expected, 0)?;
    append(
        &area,
        "intent.json",
        &serde_json::json!({
            "version":1,
            "identity":expected.identity,
            "original_flags":0,
            "selected_flag":LEGACY_ANCESTOR_FLAG
        }),
    )?;
    if let Err(error) = F::set(&target.file, LEGACY_ANCESTOR_FLAG) {
        let observed = F::flags(&target.file);
        if matches!(observed, Ok(0)) && check_fence_object::<F>(&target, &expected, 0).is_ok() {
            append(
                &area,
                "failure.json",
                &serde_json::json!({
                    "version":1,
                    "state":"EFFECT_ABSENT",
                    "selected_flag":LEGACY_ANCESTOR_FLAG,
                    "observed_flags":0,
                    "code":error.code()
                }),
            )?;
            return Err(error);
        }
        return Err(Error::new("LEGACY_FENCE_PROBE_UNKNOWN"));
    }
    target.file.sync_all()?;
    check_fence_object::<F>(&target, &expected, LEGACY_ANCESTOR_FLAG)?;
    append(
        &area,
        "set-result.json",
        &serde_json::json!({
            "version":1,
            "state":"SET_AND_VERIFIED",
            "selected_flag":LEGACY_ANCESTOR_FLAG,
            "identity":expected.identity
        }),
    )?;
    require(
        area.rename("target", &area, "moved").is_err(),
        "LEGACY_FENCE_PROBE_RENAME_ALLOWED",
    )?;
    let child = write_new(
        &operations,
        "probe.lock",
        b"probe",
        operations.uid,
        operations.file.metadata()?.gid(),
        0o600,
    )?;
    drop(child);
    operations.unlink("probe.lock")?;
    append(
        &area,
        "clear-intent.json",
        &serde_json::json!({
            "version":1,
            "identity":expected.identity,
            "expected_flags":LEGACY_ANCESTOR_FLAG,
            "restore_flags":0
        }),
    )?;
    if let Err(error) = F::set(&target.file, 0) {
        let named = area.child("target");
        let retained = F::flags(&target.file).ok() == Some(LEGACY_ANCESTOR_FLAG)
            && check_fence_object::<F>(&target, &expected, LEGACY_ANCESTOR_FLAG).is_ok()
            && named.as_ref().is_ok_and(|named| {
                check_fence_object::<F>(named, &expected, LEGACY_ANCESTOR_FLAG).is_ok()
                    && Identity::of(&named.file).ok() == Identity::of(&target.file).ok()
            });
        if retained {
            append(
                &area,
                "clear-failure.json",
                &serde_json::json!({
                    "version":1,
                    "state":"FLAG_RETAINED",
                    "selected_flag":LEGACY_ANCESTOR_FLAG,
                    "observed_flags":LEGACY_ANCESTOR_FLAG,
                    "code":error.code()
                }),
            )?;
            return Err(Error::new("LEGACY_FENCE_PROBE_CLEAR_RETAINED"));
        }
        return Err(Error::new("LEGACY_FENCE_PROBE_CLEAR_UNKNOWN"));
    }
    target.file.sync_all()?;
    check_fence_object::<F>(&target, &expected, 0)?;
    let named = area.child("target")?;
    check_fence_object::<F>(&named, &expected, 0)?;
    require(
        Identity::of(&named.file)? == Identity::of(&target.file)?,
        "LEGACY_FENCE_PROBE_REPLACED",
    )?;
    let result = serde_json::json!({
        "version":1,
        "state":"SUPPORTED_AND_CLEARED",
        "selected_flag":LEGACY_ANCESTOR_FLAG,
        "rename_blocked":true,
        "child_operations":true,
        "final_flags":0
    });
    append(&area, "result.json", &result)?;
    Ok(result)
}

pub(super) fn run_fence_capability_probe() -> Result<serde_json::Value> {
    require(
        unsafe { libc::geteuid() } == 0,
        "LEGACY_FENCE_PROBE_ROOT_REQUIRED",
    )?;
    let volume = Dir::open(Path::new("/private/var/db"), 0)?;
    let parent = Dir::open(Path::new(FENCE_PROBE_PARENT), 0)?;
    let identity = Identity::of(&parent.file)?;
    require(
        fence_probe_parent_matches(
            &identity,
            volume.file.metadata()?.dev(),
            NativeFenceFlags::flags(&parent.file)?,
        ),
        "LEGACY_FENCE_PROBE_PARENT",
    )?;
    reject_acl(&parent.file)?;
    fence_capability_probe_at::<NativeFenceFlags>(&parent, FENCE_PROBE_NAME)
}

fn fence_probe_parent_matches(identity: &Identity, volume_device: u64, flags: u32) -> bool {
    identity.device == volume_device
        && identity.inode == FENCE_PROBE_PARENT_INODE
        && identity.uid == 0
        && identity.gid == 0
        && identity.mode == 0o700
        && flags == 0
}

fn retained_fence_requires_review<F: FenceFlags>(
    operation_id: &str,
    binding: &str,
    journal: &Dir,
    expected: &AncestorFenceExpectation,
    expected_path: &Path,
    open_fixed: impl Fn() -> Result<Dir>,
) -> Result<()> {
    let dir = open_fixed()?;
    require(fd_path(&dir)? == expected_path, "LEGACY_FENCE_PATH")?;
    check_fence_object::<F>(&dir, expected, expected.flags | LEGACY_ANCESTOR_FLAG)?;
    verify_retained_fence_journal(journal, operation_id, binding, expected, expected_path)?;
    Err(Error::new("LEGACY_FENCE_RECOVERY_REQUIRED"))
}
pub(super) struct SocketNamespace {
    plan: crate::bootstrap::socket::SocketAncestorPlan,
    gid: u32,
    identities: std::collections::BTreeSet<u32>,
    #[cfg(test)]
    fixture: Option<PathBuf>,
}
impl SocketNamespace {
    pub(super) fn from_packet(p: &super::packet::Packet) -> Result<Self> {
        Ok(Self {
            plan: p
                .configuration
                .socket_ancestor
                .clone()
                .ok_or(Error::new("SOCKET_ANCESTOR_REQUIRED"))?,
            gid: p.configuration.socket_gid,
            identities: p
                .configuration
                .callers
                .iter()
                .map(|c| c.uid)
                .chain(p.native_enrollment.services.iter().map(|s| s.uid))
                .collect(),
            #[cfg(test)]
            fixture: None,
        })
    }
    fn open(&self) -> Result<Dir> {
        #[cfg(test)]
        if let Some(path) = &self.fixture {
            let parent = Dir::open(path.parent().unwrap(), unsafe { libc::geteuid() })?;
            let dir = Dir {
                file: parent.open_file(
                    path.file_name().unwrap().to_str().unwrap(),
                    libc::O_RDONLY | libc::O_DIRECTORY,
                    0,
                )?,
                uid: parent.uid,
            };
            self.plan.check_retained_parent(&dir)?;
            return Ok(dir);
        }
        self.plan.open_preflight(self.gid, &self.identities)
    }
    fn check(&self, held: &Dir) -> Result<()> {
        self.plan.check_retained_parent(held)?;
        let named = self.open()?;
        require(
            Identity::of(&named.file)? == Identity::of(&held.file)?,
            "LEGACY_LOCK_DRIFT",
        )
    }
    pub(super) fn readonly_digest(&self) -> Result<String> {
        let held = self.open()?;
        self.check(&held)?;
        let metadata = Identity::of(&held.file)?;
        crate::trust::digest(&serde_json::json!({
            "state":"SOCKET_NAMESPACE_OBSERVED",
            "device":metadata.device,
            "inode":metadata.inode,
            "uid":metadata.uid,
            "gid":metadata.gid,
            "mode":metadata.mode
        }))
    }
}
struct Owned {
    dir: Dir,
    identity: Identity,
    holder: Identity,
    bytes: Vec<u8>,
}
struct AcquisitionContext {
    namespace: Option<SocketNamespace>,
    ancestor_fence: Option<AncestorFence>,
}
struct RecoveryContext<'a> {
    predecessor_binding: &'a str,
    predecessor: &'a Dir,
    journal: &'a Dir,
    parents: [Dir; 4],
    acquisition: AcquisitionContext,
}
/// The outer DCP guard cannot be dropped while legacy ownership is live.
/// Deliberately no Drop cleanup: any error/crash leaves ephemeral evidence intact.
pub(super) struct LegacyLocks<'a> {
    _guard: &'a MutationGuard,
    journal: Dir,
    fence_journal: Dir,
    parents: [Dir; 4],
    paths: [PathBuf; 4],
    expected: Expectations,
    permanent: File,
    permanent_identity: Identity,
    owned: Vec<Owned>,
    binding: String,
    namespace: Option<SocketNamespace>,
    ancestor_fence: Option<AncestorFence>,
}
fn fd_path(dir: &Dir) -> Result<PathBuf> {
    let mut bytes = [0i8; libc::PATH_MAX as usize];
    require(
        unsafe { libc::fcntl(dir.file.as_raw_fd(), libc::F_GETPATH, bytes.as_mut_ptr()) } == 0,
        "LEGACY_PARENT_PATH",
    )?;
    let value = unsafe { std::ffi::CStr::from_ptr(bytes.as_ptr()) }
        .to_str()
        .map_err(|_| Error::new("LEGACY_PARENT_PATH"))?;
    Ok(PathBuf::from(value))
}
fn hash(value: &str) -> Result<()> {
    require(
        value.len() == 64
            && value
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "LEGACY_BINDING",
    )
}
fn checkpoint(name: &str) {
    #[cfg(test)]
    crate::transaction::fault::point(name);
    #[cfg(not(test))]
    let _ = name;
}
fn absent(dir: &Dir, name: &str) -> Result<()> {
    super::files::absent(dir, name)
}
fn append(dir: &Dir, name: &str, value: &impl Serialize) -> Result<()> {
    super::journal::append(dir, name, value)
}
impl<'a> LegacyLocks<'a> {
    pub(super) fn readonly_observe(
        op: &str,
        binding: &str,
        area: &Dir,
        expected: &Expectations,
        namespace: SocketNamespace,
    ) -> Result<String> {
        require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
        require(
            op == "first-live-dsh-20260918-01",
            "LEGACY_RECOVERY_OPERATION",
        )?;
        hash(binding)?;
        check_production_fence_policy(&expected.ancestor_fence)?;
        let fence = open_fixed_legacy_ancestor(0)?;
        require(
            fd_path(&fence)? == Path::new(LEGACY_ANCESTOR),
            "LEGACY_FENCE_PATH",
        )?;
        check_fence_object::<NativeFenceFlags>(
            &fence,
            &expected.ancestor_fence,
            expected.ancestor_fence.flags | LEGACY_ANCESTOR_FLAG,
        )?;
        let root = Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?;
        let predecessor = root.child("first-live-operation-p4r14r2-retained")?;
        verify_fence_journal(
            &predecessor,
            op,
            P4R14R2_BINDING,
            &expected.ancestor_fence,
            Path::new(LEGACY_ANCESTOR),
        )?;
        let parents = [
            namespace.open()?,
            AncestorFence::<NativeFenceFlags> {
                dir: fence,
                expected: expected.ancestor_fence.clone(),
                operation_id: op.into(),
                binding: P4R14R2_BINDING.into(),
                original_flags: expected.ancestor_fence.flags,
                path: PathBuf::from(LEGACY_ANCESTOR),
                _flags: std::marker::PhantomData,
            }
            .lock_parent(&expected.parents[1])?,
            Dir::open(Path::new(PARENTS[2]), 0)?,
            Dir::open(Path::new(PARENTS[3]), 0)?,
        ];
        for (index, parent) in parents.iter().enumerate() {
            expected.parents[index].check(&parent.file)?;
        }
        namespace.check(&parents[0])?;
        // The readonly probe must observe whatever state the packet declares:
        // absent_create is a legal pre-enable state (the enable path creates
        // the permanent lock), so the probe verifies the absence and records
        // it instead of failing the whole observation.
        let permanent_identity = match &expected.permanent {
            PermanentExpectation::Present { identity } => {
                let permanent = parents[0].open_file(NAMES[0], libc::O_RDONLY, 0)?;
                identity.check(&permanent)?;
                serde_json::json!({
                    "state":"present",
                    "device":identity.device,
                    "inode":identity.inode,
                    "uid":identity.uid,
                    "gid":identity.gid,
                    "mode":identity.mode
                })
            }
            PermanentExpectation::AbsentCreate => {
                absent(&parents[0], NAMES[0])?;
                serde_json::json!({"state":"absent_create"})
            }
        };
        let mut retained = Vec::new();
        for index in [1usize, 2] {
            let created: serde_json::Value =
                super::files::read(&predecessor, &format!("legacy-{index}-created.json"))?;
            let result: serde_json::Value =
                super::files::read(&predecessor, &format!("legacy-{index}-result.json"))?;
            let identity: Identity = serde_json::from_value(created["identity"].clone())?;
            let holder_identity: Identity =
                serde_json::from_value(result["holder_identity"].clone())?;
            let dir = parents[index].child(NAMES[index])?;
            identity.check(&dir.file)?;
            require(
                dir.names()? == vec![HOLDERS[index - 1]],
                "LEGACY_CONTENT_DRIFT",
            )?;
            let holder = dir.open_file(HOLDERS[index - 1], libc::O_RDONLY, 0)?;
            holder_identity.check(&holder)?;
            let bytes = snapshot(&holder, 0, 16 * 1024)?.bytes;
            require(
                result["holder_sha256"] == sha(&bytes),
                "LEGACY_HOLDER_DRIFT",
            )?;
            retained.push(serde_json::json!({
                "index":index,
                "directory":identity,
                "holder":holder_identity,
                "holder_sha256":sha(&bytes)
            }));
        }
        absent(&parents[3], NAMES[3])?;
        let intent: serde_json::Value = super::files::read(area, "legacy-recovery-intent.json")?;
        let result: serde_json::Value = super::files::read(area, "legacy-recovery-result.json")?;
        require(
            intent["operation_id"] == op
                && intent["binding"] == binding
                && intent["predecessor_binding"] == P4R14R2_BINDING
                && result["operation_id"] == op
                && result["binding"] == binding
                && result["predecessor_binding"] == P4R14R2_BINDING
                && result["state"] == "RETAINED_LOCKS_JOINED",
            "LEGACY_RECOVERY_HISTORY",
        )?;
        crate::trust::digest(&serde_json::json!({
            "state":"RETAINED_FENCE_AND_LOCKS_OBSERVED",
            "binding":binding,
            "fence":expected.ancestor_fence,
            "permanent":permanent_identity,
            "retained":retained
        }))
    }
    pub(super) fn recover(
        op: &str,
        binding: &str,
        predecessor: &Dir,
        journal: &Dir,
        expected: &Expectations,
        guard: &'a MutationGuard,
        namespace: SocketNamespace,
    ) -> Result<Self> {
        require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
        require(
            op == "first-live-dsh-20260918-01",
            "LEGACY_RECOVERY_OPERATION",
        )?;
        guard.binds(&Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?)?;
        let dir = open_fixed_legacy_ancestor(0)?;
        require(
            fd_path(&dir)? == Path::new(LEGACY_ANCESTOR),
            "LEGACY_FENCE_PATH",
        )?;
        check_fence_object::<NativeFenceFlags>(
            &dir,
            &expected.ancestor_fence,
            expected.ancestor_fence.flags | LEGACY_ANCESTOR_FLAG,
        )?;
        verify_fence_journal(
            predecessor,
            op,
            P4R14R2_BINDING,
            &expected.ancestor_fence,
            Path::new(LEGACY_ANCESTOR),
        )?;
        let ancestor_fence = AncestorFence::<NativeFenceFlags> {
            dir,
            expected: expected.ancestor_fence.clone(),
            operation_id: op.into(),
            binding: P4R14R2_BINDING.into(),
            original_flags: expected.ancestor_fence.flags,
            path: PathBuf::from(LEGACY_ANCESTOR),
            _flags: std::marker::PhantomData,
        };
        let lock_parent = ancestor_fence.lock_parent(&expected.parents[1])?;
        let parents = [
            namespace.open()?,
            lock_parent,
            Dir::open(Path::new(PARENTS[2]), 0)?,
            Dir::open(Path::new(PARENTS[3]), 0)?,
        ];
        Self::recover_with_context(
            op,
            binding,
            expected,
            guard,
            RecoveryContext {
                predecessor_binding: P4R14R2_BINDING,
                predecessor,
                journal,
                parents,
                acquisition: AcquisitionContext {
                    namespace: Some(namespace),
                    ancestor_fence: Some(ancestor_fence),
                },
            },
        )
    }

    fn recover_with_context(
        op: &str,
        binding: &str,
        expected: &Expectations,
        guard: &'a MutationGuard,
        recovery: RecoveryContext<'_>,
    ) -> Result<Self> {
        let RecoveryContext {
            predecessor_binding,
            predecessor,
            journal,
            parents,
            acquisition: context,
        } = recovery;
        crate::fs::secure::component(op)?;
        hash(binding)?;
        hash(predecessor_binding)?;
        validate(&predecessor.file, predecessor.uid, true)?;
        validate(&journal.file, journal.uid, true)?;
        require(predecessor.uid == journal.uid, "LEGACY_RECOVERY_HISTORY")?;
        let expected_prior = if context.ancestor_fence.is_some() {
            vec![
                "legacy-0-intent.json",
                "legacy-0-result.json",
                "legacy-1-created.json",
                "legacy-1-intent.json",
                "legacy-1-result.json",
                "legacy-2-created.json",
                "legacy-2-intent.json",
                "legacy-2-result.json",
                "legacy-ancestor-fence-intent.json",
                "legacy-ancestor-fence-result.json",
            ]
        } else {
            vec![
                "legacy-0-intent.json",
                "legacy-0-result.json",
                "legacy-1-created.json",
                "legacy-1-intent.json",
                "legacy-1-result.json",
                "legacy-2-created.json",
                "legacy-2-intent.json",
                "legacy-2-result.json",
            ]
        };
        let prior: Vec<_> = predecessor
            .names()?
            .into_iter()
            .filter(|name| name.starts_with("legacy-") && !name.starts_with("legacy-recovery-"))
            .collect();
        require(
            prior
                == expected_prior
                    .iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>(),
            "LEGACY_RECOVERY_HISTORY",
        )?;
        let paths = [
            fd_path(&parents[0])?,
            fd_path(&parents[1])?,
            fd_path(&parents[2])?,
            fd_path(&parents[3])?,
        ];
        for (index, parent) in parents.iter().enumerate() {
            if index == 0 {
                if let Some(namespace) = &context.namespace {
                    namespace.check(parent)?;
                } else {
                    validate(&parent.file, journal.uid, true)?;
                }
            } else {
                validate(&parent.file, journal.uid, true)?;
            }
            expected.parents[index].check(&parent.file)?;
        }
        absent(&parents[3], NAMES[3])?;
        let permanent = parents[0].open_file(NAMES[0], libc::O_RDWR, 0)?;
        validate(&permanent, journal.uid, false)?;
        let permanent_identity = match &expected.permanent {
            PermanentExpectation::Present { identity } => identity.clone(),
            PermanentExpectation::AbsentCreate => {
                return Err(Error::new("LEGACY_RECOVERY_PERMANENT"))
            }
        };
        permanent_identity.check(&permanent)?;
        require(
            unsafe { libc::flock(permanent.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "LEGACY_FLOCK_BUSY",
        )?;
        let original: serde_json::Value = super::files::read(predecessor, "legacy-0-intent.json")?;
        require(
            original["operation_id"] == op
                && original["binding"] == predecessor_binding
                && original["expected"] == serde_json::to_value(expected)?
                && original["paths"] == serde_json::to_value(&paths)?,
            "LEGACY_RECOVERY_HISTORY",
        )?;
        let zero: serde_json::Value = super::files::read(predecessor, "legacy-0-result.json")?;
        require(
            zero == serde_json::json!({"binding":predecessor_binding,"identity":permanent_identity}),
            "LEGACY_RECOVERY_HISTORY",
        )?;
        let mut owned = Vec::new();
        let mut predecessor_pid = None;
        for index in [1usize, 2] {
            let intent: serde_json::Value =
                super::files::read(predecessor, &format!("legacy-{index}-intent.json"))?;
            require(
                intent["binding"] == predecessor_binding
                    && intent["parent"] == serde_json::to_value(&expected.parents[index])?
                    && intent["name"] == NAMES[index]
                    && intent["expected_preimage"] == "absent",
                "LEGACY_RECOVERY_HISTORY",
            )?;
            let pid = intent["process"]["pid"]
                .as_i64()
                .ok_or(Error::new("LEGACY_RECOVERY_HISTORY"))?;
            require(
                predecessor_pid.is_none() || predecessor_pid == Some(pid),
                "LEGACY_RECOVERY_HISTORY",
            )?;
            predecessor_pid = Some(pid);
            let created: serde_json::Value =
                super::files::read(predecessor, &format!("legacy-{index}-created.json"))?;
            let result: serde_json::Value =
                super::files::read(predecessor, &format!("legacy-{index}-result.json"))?;
            require(
                created["binding"] == predecessor_binding
                    && result["binding"] == predecessor_binding,
                "LEGACY_RECOVERY_HISTORY",
            )?;
            let identity: Identity = serde_json::from_value(created["identity"].clone())?;
            let holder_identity: Identity =
                serde_json::from_value(result["holder_identity"].clone())?;
            require(
                result["identity"] == created["identity"],
                "LEGACY_RECOVERY_HISTORY",
            )?;
            let dir = parents[index].child(NAMES[index])?;
            identity.check(&dir.file)?;
            require(
                dir.names()? == vec![HOLDERS[index - 1]],
                "LEGACY_CONTENT_DRIFT",
            )?;
            let holder = dir.open_file(HOLDERS[index - 1], libc::O_RDONLY, 0)?;
            holder_identity.check(&holder)?;
            let bytes = snapshot(&holder, journal.uid, 16 * 1024)?.bytes;
            require(
                result["holder_sha256"] == sha(&bytes),
                "LEGACY_HOLDER_DRIFT",
            )?;
            owned.push(Owned {
                dir,
                identity,
                holder: holder_identity,
                bytes,
            });
        }
        if context.ancestor_fence.is_some() {
            require(predecessor_pid == Some(51_690), "LEGACY_RECOVERY_HISTORY")?;
            require(
                unsafe { libc::kill(predecessor_pid.unwrap() as i32, 0) } == -1
                    && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH),
                "LEGACY_RECOVERY_PREDECESSOR_ACTIVE",
            )?;
        }
        append(
            journal,
            "legacy-recovery-intent.json",
            &serde_json::json!({"operation_id":op,"binding":binding,"predecessor_binding":predecessor_binding}),
        )?;
        let locks = Self {
            _guard: guard,
            journal: Dir {
                file: journal.file.try_clone()?,
                uid: journal.uid,
            },
            fence_journal: Dir {
                file: predecessor.file.try_clone()?,
                uid: predecessor.uid,
            },
            parents,
            paths,
            expected: expected.clone(),
            permanent,
            permanent_identity,
            owned,
            binding: binding.into(),
            namespace: context.namespace,
            ancestor_fence: context.ancestor_fence,
        };
        locks.verify()?;
        append(
            journal,
            "legacy-recovery-result.json",
            &serde_json::json!({"operation_id":op,"binding":binding,"predecessor_binding":predecessor_binding,"state":"RETAINED_LOCKS_JOINED"}),
        )?;
        Ok(locks)
    }
    pub(super) fn acquire(
        op: &str,
        binding: &str,
        journal: &Dir,
        expected: &Expectations,
        guard: &'a MutationGuard,
        namespace: SocketNamespace,
    ) -> Result<Self> {
        // Refuse before any production path is opened or any journal effect occurs.
        require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
        require(
            [
                "PRODUCTION_DEPLOY_LOCK_DIR",
                "PRODUCTION_DEPLOY_LOCK_INHERITED_FROM",
            ]
            .iter()
            .all(|key| std::env::var_os(key).is_none()),
            "LEGACY_ENV_OVERRIDE",
        )?;
        require(journal.uid == 0, "UNSAFE_OWNER")?;
        guard.binds(&Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?)?;
        let prior: Vec<_> = journal
            .names()?
            .into_iter()
            .filter(|name| name.starts_with("legacy-"))
            .collect();
        if !prior.is_empty() {
            if prior == ["legacy-ancestor-fence-intent.json".to_string()]
                || prior
                    == [
                        "legacy-ancestor-fence-intent.json".to_string(),
                        "legacy-ancestor-fence-result.json".to_string(),
                    ]
            {
                retained_fence_requires_review::<NativeFenceFlags>(
                    op,
                    binding,
                    journal,
                    &expected.ancestor_fence,
                    Path::new(LEGACY_ANCESTOR),
                    || open_fixed_legacy_ancestor(0),
                )?;
            }
            return Err(Error::new("LEGACY_PRIOR_ATTEMPT"));
        }
        check_production_fence_policy(&expected.ancestor_fence)?;
        let ancestor_fence = AncestorFence::<NativeFenceFlags>::acquire(
            op,
            binding,
            journal,
            &expected.ancestor_fence,
            Path::new(LEGACY_ANCESTOR),
            || open_fixed_legacy_ancestor(0),
        )?;
        let lock_parent = ancestor_fence.lock_parent(&expected.parents[1])?;
        let parents = [
            namespace.open()?,
            lock_parent,
            Dir::open(Path::new(PARENTS[2]), 0)?,
            Dir::open(Path::new(PARENTS[3]), 0)?,
        ];
        Self::acquire_with_namespace(
            op,
            binding,
            journal,
            parents,
            expected,
            guard,
            AcquisitionContext {
                namespace: Some(namespace),
                ancestor_fence: Some(ancestor_fence),
            },
        )
    }
    #[cfg(test)]
    fn acquire_at(
        op: &str,
        binding: &str,
        journal: &Dir,
        parents: [Dir; 4],
        expected: &Expectations,
        guard: &'a MutationGuard,
    ) -> Result<Self> {
        Self::acquire_with_namespace(
            op,
            binding,
            journal,
            parents,
            expected,
            guard,
            AcquisitionContext {
                namespace: None,
                ancestor_fence: None,
            },
        )
    }
    fn acquire_with_namespace(
        op: &str,
        binding: &str,
        journal: &Dir,
        parents: [Dir; 4],
        expected: &Expectations,
        guard: &'a MutationGuard,
        context: AcquisitionContext,
    ) -> Result<Self> {
        crate::fs::secure::component(op)?;
        hash(binding)?;
        validate(&journal.file, journal.uid, true)?;
        let prior: Vec<_> = journal
            .names()?
            .into_iter()
            .filter(|name| name.starts_with("legacy-"))
            .collect();
        let allowed = vec![
            "legacy-ancestor-fence-intent.json".to_string(),
            "legacy-ancestor-fence-result.json".to_string(),
        ];
        require(
            if context.ancestor_fence.is_some() {
                prior == allowed
            } else {
                prior.is_empty()
            },
            "LEGACY_PRIOR_ATTEMPT",
        )?;
        let paths = [
            fd_path(&parents[0])?,
            fd_path(&parents[1])?,
            fd_path(&parents[2])?,
            fd_path(&parents[3])?,
        ];
        for (index, parent) in parents.iter().enumerate() {
            if index == 0 {
                if let Some(namespace) = &context.namespace {
                    namespace.check(parent)?;
                } else {
                    validate(&parent.file, journal.uid, true)?;
                }
            } else {
                validate(&parent.file, journal.uid, true)?;
            }
            expected.parents[index].check(&parent.file)?;
            require(expected.parents[index].uid == journal.uid, "UNSAFE_OWNER")?;
        }
        absent(&parents[3], NAMES[3])?;
        // All pre-existing permanent metadata is checked before journaling/effects.
        let existing = match &expected.permanent {
            PermanentExpectation::Present { identity } => {
                let file = parents[0].open_file(NAMES[0], libc::O_RDWR, 0)?;
                validate(&file, journal.uid, false)?;
                identity.check(&file)?;
                require(identity.mode == 0o600, "UNSAFE_MODE")?;
                Some(file)
            }
            PermanentExpectation::AbsentCreate => {
                absent(&parents[0], NAMES[0])?;
                None
            }
        };
        append(
            journal,
            "legacy-0-intent.json",
            &serde_json::json!({"operation_id":op,"binding":binding,"expected":expected,"paths":paths}),
        )?;
        checkpoint("legacy-0-intent");
        let permanent = if let Some(file) = existing {
            file
        } else {
            let file = write_new(
                &parents[0],
                NAMES[0],
                b"",
                journal.uid,
                parents[0].file.metadata()?.gid(),
                0o600,
            )?;
            checkpoint("legacy-0-created");
            file
        };
        require(
            unsafe { libc::flock(permanent.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "LEGACY_FLOCK_BUSY",
        )?;
        let permanent_identity = Identity::of(&permanent)?;
        permanent_identity.check(&parents[0].open_file(NAMES[0], libc::O_RDONLY, 0)?)?;
        permanent.sync_all()?;
        append(
            journal,
            "legacy-0-result.json",
            &serde_json::json!({"binding":binding,"identity":permanent_identity}),
        )?;
        let mut locks = Self {
            _guard: guard,
            journal: Dir {
                file: journal.file.try_clone()?,
                uid: journal.uid,
            },
            fence_journal: Dir {
                file: journal.file.try_clone()?,
                uid: journal.uid,
            },
            parents,
            paths,
            expected: expected.clone(),
            permanent,
            permanent_identity,
            owned: Vec::new(),
            binding: binding.into(),
            namespace: context.namespace,
            ancestor_fence: context.ancestor_fence,
        };
        let executable = File::open(std::env::current_exe()?)?;
        // Hash the exact ID in readable holders so it cannot impersonate a legacy parent.
        // The immutable acquisition intent above retains the original ID.
        let process = serde_json::json!({"pid":std::process::id(),"uid":journal.uid,"executable":Identity::of(&executable)?,"started_ms":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_|Error::new("CLOCK"))?.as_millis(),"operation_id_sha256":sha(op.as_bytes()),"binding":binding});
        for index in [1usize, 2] {
            locks.verify_parents()?;
            append(
                journal,
                &format!("legacy-{index}-intent.json"),
                &serde_json::json!({"binding":binding,"parent":expected.parents[index],"name":NAMES[index],"expected_preimage":"absent","process":process}),
            )?;
            checkpoint(&format!("legacy-{index}-intent"));
            let parent = &locks.parents[index];
            require(
                unsafe {
                    libc::mkdirat(
                        parent.file.as_raw_fd(),
                        CString::new(NAMES[index]).unwrap().as_ptr(),
                        0o700,
                    )
                } == 0,
                "LEGACY_DIRECTORY_BUSY",
            )?;
            parent.file.sync_all()?;
            checkpoint(&format!("legacy-{index}-mkdir"));
            let dir = parent.child(NAMES[index])?;
            let identity = Identity::of(&dir.file)?;
            require(
                identity.uid == journal.uid && identity.mode == 0o700 && dir.names()?.is_empty(),
                "LEGACY_DIRECTORY_DRIFT",
            )?;
            append(
                journal,
                &format!("legacy-{index}-created.json"),
                &serde_json::json!({"binding":binding,"identity":identity}),
            )?;
            let json = canonical_bytes(&process)?;
            let bytes = if index == 1 {
                format!("pid={}\nuid={}\ncmd=agent-deployd-first-live\nstarted={}\noperation_sha256={}\npackage={}\nidentity={}\n",std::process::id(),journal.uid,process["started_ms"],sha(op.as_bytes()),binding,String::from_utf8(json).map_err(|_|Error::new("INVALID_RECORD"))?).into_bytes()
            } else {
                json
            };
            let holder = write_new(
                &dir,
                HOLDERS[index - 1],
                &bytes,
                journal.uid,
                identity.gid,
                0o600,
            )?;
            checkpoint(&format!("legacy-{index}-holder"));
            let holder_identity = Identity::of(&holder)?;
            append(
                journal,
                &format!("legacy-{index}-result.json"),
                &serde_json::json!({"binding":binding,"identity":identity,"holder_identity":holder_identity,"holder_sha256":sha(&bytes)}),
            )?;
            locks.owned.push(Owned {
                dir,
                identity,
                holder: holder_identity,
                bytes,
            });
            checkpoint(&format!("legacy-{index}-result"));
        }
        locks.verify()?;
        Ok(locks)
    }
    fn verify_parents(&self) -> Result<()> {
        if let Some(fence) = &self.ancestor_fence {
            fence.verify(Path::new(LEGACY_ANCESTOR), || open_fixed_legacy_ancestor(0))?;
        }
        for (index, path) in self.paths.iter().enumerate() {
            if index == 0 {
                if let Some(namespace) = &self.namespace {
                    namespace.check(&self.parents[index])?;
                } else {
                    self.expected.parents[index].check(&Dir::open(path, self.journal.uid)?.file)?;
                }
            } else if index == 1 && self.ancestor_fence.is_some() {
                let fence = self.ancestor_fence.as_ref().unwrap();
                let named = fence.lock_parent(&self.expected.parents[index])?;
                self.expected.parents[index].check(&named.file)?;
            } else {
                self.expected.parents[index].check(&Dir::open(path, self.journal.uid)?.file)?;
            }
            self.expected.parents[index].check(&self.parents[index].file)?;
        }
        absent(&self.parents[3], NAMES[3])
    }
    pub(super) fn verify(&self) -> Result<()> {
        self.verify_parents()?;
        self.permanent_identity.check(&self.permanent)?;
        let permanent = self.parents[0].open_file(NAMES[0], libc::O_RDONLY, 0)?;
        validate(&permanent, self.journal.uid, false)?;
        self.permanent_identity.check(&permanent)?;
        require(self.owned.len() == 2, "LEGACY_INCOMPLETE")?;
        for (offset, owned) in self.owned.iter().enumerate() {
            let dir = self.parents[offset + 1].child(NAMES[offset + 1])?;
            owned.identity.check(&dir.file)?;
            require(
                dir.names()? == vec![HOLDERS[offset]],
                "LEGACY_CONTENT_DRIFT",
            )?;
            let file = dir.open_file(HOLDERS[offset], libc::O_RDONLY, 0)?;
            owned.holder.check(&file)?;
            require(
                snapshot(&file, self.journal.uid, 16 * 1024)?.bytes == owned.bytes,
                "LEGACY_HOLDER_DRIFT",
            )?;
        }
        Ok(())
    }
    pub(super) fn release_completed(mut self, retirement: &str) -> Result<()> {
        hash(retirement)?;
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Completion {
            binding: String,
            retirement_digest: String,
        }
        let result: Completion =
            super::files::read(&self.journal, "legacy-retirement-result.json")?;
        require(
            result.binding == self.binding && result.retirement_digest == retirement,
            "LEGACY_RETIREMENT_BINDING",
        )?;
        self.verify()?; // Validate BOTH before removing either owned holder.
        append(
            &self.journal,
            "legacy-release-intent.json",
            &serde_json::json!({"binding":self.binding,"retirement_digest":retirement}),
        )?;
        checkpoint("legacy-release-intent");
        for offset in (0..2).rev() {
            self.verify_parents()?;
            let owned = &self.owned[offset];
            let dir = self.parents[offset + 1].child(NAMES[offset + 1])?;
            owned.identity.check(&dir.file)?;
            require(
                dir.names()? == vec![HOLDERS[offset]],
                "LEGACY_CONTENT_DRIFT",
            )?;
            let holder = dir.open_file(HOLDERS[offset], libc::O_RDONLY, 0)?;
            owned.holder.check(&holder)?;
            require(
                snapshot(&holder, self.journal.uid, 16 * 1024)?.bytes == owned.bytes,
                "LEGACY_HOLDER_DRIFT",
            )?;
            owned.dir.unlink(HOLDERS[offset])?;
            checkpoint(&format!("legacy-release-{}-holder", offset + 1));
            owned
                .identity
                .check(&self.parents[offset + 1].child(NAMES[offset + 1])?.file)?;
            require(owned.dir.names()?.is_empty(), "LEGACY_CONTENT_DRIFT")?;
            require(
                unsafe {
                    libc::unlinkat(
                        self.parents[offset + 1].file.as_raw_fd(),
                        CString::new(NAMES[offset + 1]).unwrap().as_ptr(),
                        libc::AT_REMOVEDIR,
                    )
                } == 0,
                "LEGACY_RELEASE",
            )?;
            self.parents[offset + 1].file.sync_all()?;
            checkpoint(&format!("legacy-release-{}-directory", offset + 1));
        }
        if let Some(fence) = self.ancestor_fence.take() {
            fence.clear(&self.fence_journal, Path::new(LEGACY_ANCESTOR), || {
                open_fixed_legacy_ancestor(0)
            })?;
        }
        append(
            &self.journal,
            "legacy-release-result.json",
            &serde_json::json!({"binding":self.binding,"permanent_identity":self.permanent_identity,"retirement_digest":retirement}),
        )?;
        // Closing the owned descriptor releases flock; permanent inode is retained.
        Ok(())
    }
}
#[cfg(test)]
#[path = "../../test/first_live/legacy_locks.rs"]
mod tests;

#[cfg(test)]
#[path = "../../test/first_live/legacy_locks/namespace.rs"]
mod namespace_tests;
