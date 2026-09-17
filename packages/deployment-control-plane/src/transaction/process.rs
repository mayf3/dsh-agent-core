use super::journal::{Event, Journal};
use crate::{error::require, Error, Result};
use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProcessIdentity {
    pub pid: u32,
    pub started_seconds: u64,
    pub started_micros: u64,
    pub uid: u32,
    pub gid: u32,
    pub executable: String,
}
#[cfg(target_os = "macos")]
pub(crate) fn identity(pid: u32) -> Result<ProcessIdentity> {
    let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of_val(&info) as i32;
    let n = unsafe {
        libc::proc_pidinfo(
            pid as i32,
            libc::PROC_PIDTBSDINFO,
            0,
            &mut info as *mut _ as *mut _,
            size,
        )
    };
    require(n == size, "PROCESS_UNPROVEN")?;
    let mut path = [0u8; 4096];
    let n =
        unsafe { libc::proc_pidpath(pid as i32, path.as_mut_ptr() as *mut _, path.len() as u32) };
    require(n > 0, "PROCESS_UNPROVEN")?;
    let end = path.iter().position(|b| *b == 0).unwrap_or(path.len());
    let executable = std::str::from_utf8(&path[..end])
        .map_err(|_| Error::new("PROCESS_UNPROVEN"))?
        .into();
    Ok(ProcessIdentity {
        pid,
        started_seconds: info.pbi_start_tvsec,
        started_micros: info.pbi_start_tvusec,
        uid: info.pbi_uid,
        gid: info.pbi_gid,
        executable,
    })
}
#[cfg(not(target_os = "macos"))]
pub(crate) fn identity(_: u32) -> Result<ProcessIdentity> {
    Err(Error::new("UNSUPPORTED_PLATFORM"))
}
fn cancel_join(child: &mut Child) -> Result<()> {
    let _ = child.kill();
    let end = Instant::now() + Duration::from_secs(2);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) if Instant::now() < end => std::thread::sleep(Duration::from_millis(10)),
            _ => return Err(Error::new("OWNED_OPERATION_UNKNOWN")),
        }
    }
}
pub(crate) fn bounded(child: &mut Child, deadline: Instant) -> Result<std::process::ExitStatus> {
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Ok(None) => (),
            Err(_) => {
                cancel_join(child)?;
                return Err(Error::new("OWNED_OPERATION_UNKNOWN"));
            }
        }
        if Instant::now() >= deadline {
            cancel_join(child)?;
            return Err(Error::new("OPERATION_TIMEOUT"));
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}
pub(crate) fn run(
    journal: &mut Journal,
    action: &str,
    program: &str,
    argv: &[&str],
    timeout: Duration,
) -> Result<()> {
    let owner = crate::trust::digest(&identity(std::process::id())?)?;
    journal.append(Event::OperationIntent {
        action: action.into(),
        owner,
    })?;
    let mut child = Command::new(program)
        .args(argv)
        .env_clear()
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    // Commands can exit before proc_pidinfo; their owned Child/wait status remains exact.
    let process = format!("child-{}-{}", child.id(), journal.events.len());
    if let Err(e) = journal.append(Event::OperationSpawned {
        action: action.into(),
        process: process.clone(),
        kernel: identity(child.id()).ok(),
    }) {
        cancel_join(&mut child)?;
        return Err(e);
    }
    let result = bounded(&mut child, Instant::now() + timeout);
    journal.append(Event::OperationExit {
        action: action.into(),
        process,
        success: result.as_ref().is_ok_and(|s| s.success()),
    })?;
    require(result?.success(), "SERVICE_OPERATION_FAILED")
}

pub(crate) struct ExitWatch {
    queue: std::fs::File,
}
impl ExitWatch {
    pub fn new(process: &ProcessIdentity) -> Result<Self> {
        use std::os::fd::{AsRawFd, FromRawFd};
        let fd = unsafe { libc::kqueue() };
        require(fd >= 0, "PROCESS_UNPROVEN")?;
        let queue = unsafe { std::fs::File::from_raw_fd(fd) };
        require(
            unsafe { libc::fcntl(fd, libc::F_SETFD, libc::FD_CLOEXEC) } == 0,
            "PROCESS_UNPROVEN",
        )?;
        let change = libc::kevent {
            ident: process.pid as _,
            filter: libc::EVFILT_PROC,
            flags: libc::EV_ADD | libc::EV_ONESHOT,
            fflags: libc::NOTE_EXIT,
            data: 0,
            udata: std::ptr::null_mut(),
        };
        require(
            unsafe {
                libc::kevent(
                    queue.as_raw_fd(),
                    &change,
                    1,
                    std::ptr::null_mut(),
                    0,
                    std::ptr::null(),
                )
            } == 0,
            "PROCESS_UNPROVEN",
        )?;
        require(
            identity(process.pid)? == *process,
            "SERVICE_GENERATION_DRIFT",
        )?;
        Ok(Self { queue })
    }
    pub fn wait(self) -> Result<()> {
        use std::os::fd::AsRawFd;
        let mut event: libc::kevent = unsafe { std::mem::zeroed() };
        let timeout = libc::timespec {
            tv_sec: 10,
            tv_nsec: 0,
        };
        let n = unsafe {
            libc::kevent(
                self.queue.as_raw_fd(),
                std::ptr::null(),
                0,
                &mut event,
                1,
                &timeout,
            )
        };
        require(
            n == 1 && event.fflags & libc::NOTE_EXIT != 0 && event.flags & libc::EV_ERROR == 0,
            "OLD_GENERATION_UNPROVEN",
        )
    }
}
pub(crate) fn prove_no_service_process(argv: &[String]) -> Result<()> {
    unsafe extern "C" {
        fn proc_listpids(kind: u32, typeinfo: u32, buffer: *mut libc::c_void, size: i32) -> i32;
    }
    let mut pids = vec![0i32; 32768];
    let size = (pids.len() * 4) as i32;
    let count = unsafe { proc_listpids(1, 0, pids.as_mut_ptr() as *mut _, size) };
    require(count > 0 && count < size, "PROCESS_CENSUS_INCOMPLETE")?;
    for pid in pids.into_iter().take(count as usize / 4).filter(|p| *p > 0) {
        let mut path = [0u8; 4096];
        let n = unsafe { libc::proc_pidpath(pid, path.as_mut_ptr() as *mut _, path.len() as u32) };
        if n <= 0 {
            require(
                std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH),
                "PROCESS_CENSUS_INCOMPLETE",
            )?;
            continue;
        }
        let end = path.iter().position(|b| *b == 0).unwrap_or(path.len());
        if std::str::from_utf8(&path[..end]).ok() == argv.first().map(String::as_str) {
            require(
                super::native_profile::process_argv(pid as u32)? != argv,
                "OLD_GENERATION_STILL_RUNNING",
            )?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_timeout_kills_and_reaps_the_exact_owned_child() {
        assert_ne!(unsafe { libc::geteuid() }, 0);
        let mut child = Command::new("/bin/sleep")
            .arg("30")
            .env_clear()
            .spawn()
            .unwrap();
        let before = identity(child.id()).unwrap();
        assert_eq!(
            super::super::native_profile::process_argv(child.id()).unwrap(),
            vec!["/bin/sleep".to_string(), "30".to_string()]
        );
        let error = bounded(&mut child, Instant::now() + Duration::from_millis(10)).unwrap_err();
        assert_eq!(error.code(), "OPERATION_TIMEOUT");
        assert!(child.try_wait().unwrap().is_some());
        assert!(identity(before.pid).is_err());
    }
    #[test]
    fn kernel_exit_watch_is_birth_bound_and_receives_actual_exit() {
        assert_ne!(unsafe { libc::geteuid() }, 0);
        let mut child = Command::new("/bin/sleep")
            .arg("30")
            .env_clear()
            .spawn()
            .unwrap();
        let identity = identity(child.id()).unwrap();
        let watch = ExitWatch::new(&identity).unwrap();
        child.kill().unwrap();
        watch.wait().unwrap();
        child.wait().unwrap();
    }
}
