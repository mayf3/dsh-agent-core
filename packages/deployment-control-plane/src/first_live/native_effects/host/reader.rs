use super::credentials::Identity;
use crate::{error::require, Error, Result};

/// A process that vanished between listing and its selector read (proc_pidinfo
/// returning zero) is the only shape allowed to skip a listed pid; both snapshots
/// must then agree on the readable set, so every other churn shape still refuses.
fn collect_all(
    mut list: impl FnMut() -> Result<Vec<u32>>,
    mut read: impl FnMut(u32) -> Result<Option<Identity>>,
) -> Result<Vec<Identity>> {
    let before_pids = list()?;
    crate::error::require(
        !before_pids.is_empty() && before_pids.len() <= 16384,
        "HOST_CENSUS_INCOMPLETE",
    )?;
    let mut before = Vec::with_capacity(before_pids.len());
    let mut skipped_before = Vec::new();
    for &pid in &before_pids {
        match read(pid)? {
            Some(row) => {
                crate::error::require(row.pid == pid, "HOST_CENSUS_DRIFT")?;
                before.push(row);
            }
            None => skipped_before.push(pid),
        }
    }
    let after_pids = list()?;
    let mut after = Vec::with_capacity(after_pids.len());
    let mut skipped_after = Vec::new();
    for pid in &after_pids {
        match read(*pid)? {
            Some(row) => {
                crate::error::require(row.pid == *pid, "HOST_CENSUS_DRIFT")?;
                after.push(row);
            }
            None => skipped_after.push(*pid),
        }
    }
    let readable = |pids: &[u32], skipped: &[u32]| -> Vec<u32> {
        pids.iter()
            .copied()
            .filter(|pid| !skipped.contains(pid))
            .collect()
    };
    crate::error::require(
        readable(&before_pids, &skipped_before) == readable(&after_pids, &skipped_after),
        "HOST_CENSUS_DRIFT",
    )?;
    super::credentials::stable(&before, &after)?;
    Ok(before)
}

#[cfg(test)]
#[path = "../../../../test/first_live/host/reader.rs"]
mod tests;

/// One bounded snapshot pair; no retry on process churn or unreadable selectors.
/// Never invoked by fixture tests. PID zero, if returned inside the byte count,
/// is retained and must pass the separate fixed kernel identity predicate.
/// A pid that vanished between listing and reading is skipped, not failed: both
/// snapshots must then agree on the readable set or the census refuses.
#[cfg(target_os = "macos")]
pub(super) fn snapshot() -> Result<Vec<Identity>> {
    require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
    collect_all(pids, identity_optional)
}
#[cfg(target_os = "macos")]
fn pids() -> Result<Vec<u32>> {
    unsafe extern "C" {
        fn proc_listpids(kind: u32, typeinfo: u32, buffer: *mut libc::c_void, size: i32) -> i32;
    }
    let mut raw = vec![0i32; 16385];
    let size = (raw.len() * std::mem::size_of::<i32>()) as i32;
    let n = unsafe { proc_listpids(1, 0, raw.as_mut_ptr().cast(), size) };
    require(n > 0 && n < size && n % 4 == 0, "HOST_CENSUS_INCOMPLETE")?;
    raw.truncate(n as usize / 4);
    require(raw.iter().all(|p| *p >= 0), "HOST_CENSUS_INCOMPLETE")?;
    raw.sort_unstable();
    require(
        !raw.windows(2).any(|w| w[0] == w[1]),
        "HOST_CENSUS_INCOMPLETE",
    )?;
    Ok(raw.into_iter().map(|p| p as u32).collect())
}
#[cfg(target_os = "macos")]
pub(super) fn identity(pid: u32) -> Result<Identity> {
    identity_optional(pid)?.ok_or_else(|| crate::Error::new("HOST_SELECTOR_UNREADABLE"))
}
/// Directed readers keep failing closed through `identity`; the census alone may
/// treat the zero return of `proc_pidinfo` (process gone since listing) as absent.
/// A negative return or a short/pid-mismatched read still refuses exactly as before.
pub(super) fn identity_optional(pid: u32) -> Result<Option<Identity>> {
    use super::credentials::Credentials;
    let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of_val(&info) as i32;
    let n = unsafe {
        libc::proc_pidinfo(
            pid as i32,
            libc::PROC_PIDTBSDINFO,
            0,
            (&mut info as *mut libc::proc_bsdinfo).cast(),
            size,
        )
    };
    if n == 0 {
        return Ok(None);
    }
    require(n == size && info.pbi_pid == pid, "HOST_SELECTOR_UNREADABLE")?;
    let credentials = Credentials {
        effective_uid: info.pbi_uid,
        real_uid: info.pbi_ruid,
        saved_uid: info.pbi_svuid,
        effective_gid: info.pbi_gid,
        real_gid: info.pbi_rgid,
        saved_gid: info.pbi_svgid,
    };
    let executable = if pid != 0 && credentials.root_capable() {
        let mut path = [0u8; 4096];
        let n =
            unsafe { libc::proc_pidpath(pid as i32, path.as_mut_ptr().cast(), path.len() as u32) };
        require(n > 0 && n < path.len() as i32, "HOST_PATH_UNREADABLE")?;
        let end = path
            .iter()
            .position(|b| *b == 0)
            .ok_or_else(|| Error::new("HOST_PATH_UNREADABLE"))?;
        Some(
            std::str::from_utf8(&path[..end])
                .map_err(|_| Error::new("HOST_PATH_UNREADABLE"))?
                .to_owned(),
        )
    } else {
        None
    };
    Ok(Some(Identity {
        pid,
        parent_pid: info.pbi_ppid,
        birth_seconds: info.pbi_start_tvsec,
        birth_micros: info.pbi_start_tvusec,
        credentials,
        tty_device: info.e_tdev,
        process_group: info.pbi_pgid,
        session_id: if pid == 0 {
            None
        } else {
            let sid = unsafe { libc::getsid(pid as i32) };
            require(sid > 0, "HOST_SESSION_UNREADABLE")?;
            Some(sid as u32)
        },
        executable,
    }))
}

#[cfg(test)]
fn collect(
    list: impl FnMut() -> Result<Vec<u32>>,
    read: impl FnMut(u32) -> Result<Option<Identity>>,
) -> Result<Vec<Identity>> {
    let rows = collect_all(list, read)?;
    super::credentials::stable(&rows, &rows)
}
