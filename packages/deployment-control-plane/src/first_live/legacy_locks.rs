//! Fixed legacy exclusion handover. These locks do not prove caller-controlled
//! override/privilege routes are refused; the operator must prove that separately.
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::{validate, Dir},
        MutationGuard,
    },
    trust::canonical_bytes,
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{
    ffi::CString,
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
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
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Identity {
    pub device: u64,
    pub inode: u64,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
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
    pub parents: [Identity; 4],
    pub permanent: PermanentExpectation,
}
struct Owned {
    dir: Dir,
    identity: Identity,
    holder: Identity,
    bytes: Vec<u8>,
}
/// The outer DCP guard cannot be dropped while legacy ownership is live.
/// Deliberately no Drop cleanup: any error/crash leaves ephemeral evidence intact.
pub(super) struct LegacyLocks<'a> {
    _guard: &'a MutationGuard,
    journal: Dir,
    parents: [Dir; 4],
    paths: [PathBuf; 4],
    expected: Expectations,
    permanent: File,
    permanent_identity: Identity,
    owned: Vec<Owned>,
    binding: String,
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
    pub(super) fn acquire(
        op: &str,
        binding: &str,
        journal: &Dir,
        expected: &Expectations,
        guard: &'a MutationGuard,
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
        let parents = [
            Dir::open(Path::new(PARENTS[0]), 0)?,
            Dir::open(Path::new(PARENTS[1]), 0)?,
            Dir::open(Path::new(PARENTS[2]), 0)?,
            Dir::open(Path::new(PARENTS[3]), 0)?,
        ];
        Self::acquire_at(op, binding, journal, parents, expected, guard)
    }
    fn acquire_at(
        op: &str,
        binding: &str,
        journal: &Dir,
        parents: [Dir; 4],
        expected: &Expectations,
        guard: &'a MutationGuard,
    ) -> Result<Self> {
        crate::fs::secure::component(op)?;
        hash(binding)?;
        validate(&journal.file, journal.uid, true)?;
        require(
            !journal
                .names()?
                .iter()
                .any(|name| name.starts_with("legacy-")),
            "LEGACY_PRIOR_ATTEMPT",
        )?;
        let paths = [
            fd_path(&parents[0])?,
            fd_path(&parents[1])?,
            fd_path(&parents[2])?,
            fd_path(&parents[3])?,
        ];
        for (index, parent) in parents.iter().enumerate() {
            validate(&parent.file, journal.uid, true)?;
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
            parents,
            paths,
            expected: expected.clone(),
            permanent,
            permanent_identity,
            owned: Vec::new(),
            binding: binding.into(),
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
        for (index, path) in self.paths.iter().enumerate() {
            self.expected.parents[index].check(&Dir::open(path, self.journal.uid)?.file)?;
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
    pub(super) fn release_completed(self, retirement: &str) -> Result<()> {
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
