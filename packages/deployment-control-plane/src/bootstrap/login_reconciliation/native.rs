use super::*;
use crate::fs::{
    file::{sha, snapshot},
    secure::validate,
};
use std::{
    os::unix::process::CommandExt,
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

struct Native<'a> {
    binding: &'a binding::Binding,
    dir: &'a Dir,
    journal: &'a Dir,
    grant_digest: Option<String>,
}
impl Native<'_> {
    fn checked(&self, auth_required: bool) -> Result<String> {
        let b = self.binding;
        state::inventory(self.journal, &["bootstrap.lock", &b.attempt])?;
        require(
            b.version == 1
                && b.attempt == "genesis-65559dd-20260918-01"
                && b.host == super::super::observed_host()?,
            "LOGIN_HOST_BINDING",
        )?;
        crate::trust::valid_digest(&b.baseline_readback_sha256)?;
        require(
            std::env::current_exe()? == Path::new(HELPER),
            "LOGIN_FIXED_HELPER_REQUIRED",
        )?;
        // This is the only variable authority document. Its fixed path and
        // root-only ownership authorize no caller-selected operation surface.
        let file = self.dir.open_file(GRANT, libc::O_RDONLY, 0)?;
        state::metadata(&file, 0, 0, 0o600, true)?;
        let raw = snapshot(&file, 0, 65536)?.bytes;
        let grant: Grant = serde_json::from_slice(&raw)?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| Error::new("CLOCK"))?
            .as_secs();
        // Check actual protected code bytes independently of the grant claim.
        let helper = super::super::genesis_install_io::hash_protected(HELPER, 128 * 1024 * 1024)?;
        validate_grant(&grant, &binding::digest(), &helper, now)?;
        state::executable(HELPER, &grant.helper_digest)?;
        for (path, digest) in &b.executables {
            state::executable(path, digest)?;
        }
        state::public_state(b, self.dir)?;
        state::reviewer(auth_required)?;
        // Child only compares the existing object. It never reacquires, creates
        // or substitutes the parent-held bootstrap mutex.
        let _identity = state::lock(self.journal, b.lock_device, b.lock_inode, false)?;
        let digest = sha(&raw);
        if let Some(expected) = &self.grant_digest {
            require(expected == &digest, "LOGIN_GRANT_CHANGED")?;
        }
        Ok(digest)
    }
}
impl Effects for Native<'_> {
    fn preflight(&mut self) -> Result<Intent> {
        let grant_digest = self.checked(false)?;
        let rows = process::census(&self.binding.ps_sha256)?;
        let pid = std::process::id();
        process::check(&rows, pid, None)?;
        let parent = rows
            .iter()
            .find(|p| p.pid == pid)
            .ok_or(Error::new("LOGIN_PROCESS_MISSING"))?;
        self.grant_digest = Some(grant_digest.clone());
        Ok(Intent {
            manifest_digest: binding::digest(),
            original_intent_digest: ORIGINAL_INTENT.into(),
            grant_digest,
            parent_pid: pid,
            parent_start: parent.start.clone(),
        })
    }
    fn login(&mut self) -> Result<Outcome> {
        process::login()
    }
    fn postflight(&mut self) -> Result<()> {
        self.checked(true)?;
        // A successful direct child is insufficient. Every residual UID612 or
        // other helper remains UNKNOWN; no descendant/group sweep is allowed.
        process::check(
            &process::census(&self.binding.ps_sha256)?,
            std::process::id(),
            None,
        )
    }
}
pub(super) fn entry(action: &str) -> Result<()> {
    require(
        unsafe { libc::geteuid() } == 0 && unsafe { libc::getuid() } == 0,
        "ROOT_REQUIRED",
    )?;
    require(
        (0..=2).all(|fd| unsafe { libc::isatty(fd) } == 1),
        "VISIBLE_TERMINAL_REQUIRED",
    )?;
    unsafe { libc::umask(0o077) };
    let b = binding::load()?;
    let journal = state::private_directory(JOURNAL, 0, 0)?;
    let held = state::lock(&journal, b.lock_device, b.lock_inode, action == "run")?;
    let dir = state::private_directory(ATTEMPT, 0, 0)?;
    let mut effects = Native {
        binding: &b,
        dir: &dir,
        journal: &journal,
        grant_digest: None,
    };
    if action == "run" {
        return execute(&dir, &mut effects);
    }
    let grant_digest = effects.checked(false)?;
    for name in [RESULT, FAILURE] {
        state::absent(&dir, name)?;
    }
    let intent_file = dir.open_file(INTENT, libc::O_RDONLY, 0)?;
    state::metadata(&intent_file, 0, 0, 0o600, true)?;
    let intent: Intent = serde_json::from_slice(&snapshot(&intent_file, 0, 65536)?.bytes)?;
    require(
        intent.manifest_digest == binding::digest()
            && intent.original_intent_digest == ORIGINAL_INTENT
            && intent.grant_digest == grant_digest
            && intent.parent_pid == unsafe { libc::getppid() } as u32,
        "LOGIN_CHILD_INTENT_BINDING",
    )?;
    process::check(
        &process::census(&b.ps_sha256)?,
        std::process::id(),
        Some(&intent),
    )?;
    // The only spawning action of this exact protected binary is `run`; a live
    // matching parent plus immutable intent binds this child to its held lock.
    // Close root descriptors before the isolated login process receives control.
    validate(&held, 0, false)?;
    drop(held);
    drop(intent_file);
    drop(dir);
    drop(journal);
    require(
        unsafe { libc::setgroups(1, [612u32].as_ptr()) } == 0
            && unsafe { libc::setgid(612) } == 0
            && unsafe { libc::setuid(612) } == 0,
        "LOGIN_IDENTITY_DROP",
    )?;
    let mut groups = [0u32; 1];
    require(
        unsafe { libc::getuid() } == 612
            && unsafe { libc::geteuid() } == 612
            && unsafe { libc::getgid() } == 612
            && unsafe { libc::getegid() } == 612
            && unsafe { libc::getgroups(1, groups.as_mut_ptr()) } == 1
            && groups == [612],
        "LOGIN_IDENTITY_DROP",
    )?;
    let error = Command::new(crate::issuer::review::CODEX_PATH)
        .args(["login", "--device-auth"])
        .env_clear()
        .env("HOME", crate::issuer::review::REVIEW_HOME)
        .env("CODEX_HOME", crate::issuer::review::REVIEW_HOME)
        .env("PATH", "/usr/bin:/bin")
        .current_dir(crate::issuer::review::REVIEW_HOME)
        .exec();
    Err(error.into())
}
