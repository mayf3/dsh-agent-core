use super::*;
use std::time::Instant;
// After fork: preallocated data and libc syscalls only; no Rust IO/allocator/locks.
pub(super) unsafe fn child(
    class: Class,
    targets: &Targets,
    pids: &[u32],
    c: &Context<'_>,
    writer: i32,
    fd_limit: i32,
    held: Option<i32>,
) -> ! {
    unsafe extern "C" {
        fn _NSGetEnviron() -> *mut *mut *mut libc::c_char;
    }
    let mut wire = [0u64; 10];
    wire[9] = match class {
        Class::Write => targets.files.len(),
        Class::Create => targets.parents.len(),
        Class::Signal => pids.len(),
    } as u64;
    for (i, f) in c.proof.iter().enumerate() {
        let mut s: libc::stat = std::mem::zeroed();
        if libc::fstat(f.as_raw_fd(), &mut s) != 0
            || [
                s.st_dev as u64,
                s.st_ino,
                s.st_uid as u64,
                s.st_gid as u64,
                s.st_mode as u64,
                s.st_size as u64,
                s.st_ctime as u64,
                s.st_ctime_nsec as u64,
            ] != c.stamps[i]
        {
            libc::_exit(70);
        }
    }
    if libc::dup2(writer, 3) < 0 {
        libc::_exit(70);
    }
    if let Some(fd) = held {
        if libc::dup2(fd, 4) < 0 {
            libc::_exit(70);
        }
    }
    for fd in (if held.is_some() { 5 } else { 4 })..fd_limit {
        libc::close(fd);
    }
    for fd in [0, 1, 2] {
        libc::close(fd);
    }
    let mut env = [
        c"LC_ALL=C".as_ptr().cast_mut(),
        c"PATH=/usr/bin:/bin".as_ptr().cast_mut(),
        std::ptr::null_mut(),
    ];
    *_NSGetEnviron() = env.as_mut_ptr();
    if libc::geteuid() == 0
        && (libc::setgroups(c.groups.len() as i32, c.groups.as_ptr()) != 0
            || libc::setgid(c.gid) != 0
            || libc::setuid(c.uid) != 0)
    {
        libc::_exit(70);
    }
    if libc::getuid() != c.uid
        || libc::geteuid() != c.uid
        || libc::getgid() != c.gid
        || libc::getegid() != c.gid
        || libc::chdir(c"/".as_ptr()) != 0
    {
        libc::_exit(70);
    }
    wire[8] = libc::geteuid() as u64;
    for index in 0..wire[9] as usize {
        wire[3] = index as u64;
        let result;
        if matches!(class, Class::Signal) {
            let Some(pid) = pids.get(index) else {
                libc::_exit(70)
            };
            result = libc::kill(*pid as i32, 0);
        } else {
            let parent = match class {
                Class::Write => &targets.parents[targets.files[index].parent],
                _ => &targets.parents[index],
            };
            let fd = if parent.held.is_some() {
                libc::dup(4)
            } else {
                libc::open(
                    parent.path.as_ptr(),
                    libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_NONBLOCK,
                )
            };
            let mut stat: libc::stat = std::mem::zeroed();
            if fd < 0 {
                wire[4] = *libc::__error() as u64;
                wire[0] = 3;
                break;
            }
            if libc::fstat(fd, &mut stat) != 0
                || stat.st_dev as u64 != parent.device
                || stat.st_ino != parent.inode
            {
                libc::close(fd);
                wire[4] = libc::ESTALE as u64;
                wire[0] = 3;
                break;
            }
            let name = if matches!(class, Class::Write) {
                targets.files[index].name.as_ptr()
            } else {
                PROBE.as_ptr()
            };
            let flags = libc::O_WRONLY
                | libc::O_NOFOLLOW
                | libc::O_NONBLOCK
                | if matches!(class, Class::Create) {
                    libc::O_CREAT | libc::O_EXCL
                } else {
                    0
                };
            result = libc::openat(fd, name, flags, 0o600);
            let error = *libc::__error();
            libc::close(fd);
            *libc::__error() = error;
            if result >= 0 {
                if matches!(class, Class::Create) {
                    if libc::fstat(result, &mut stat) == 0 {
                        wire[5] = stat.st_dev as u64;
                        wire[6] = stat.st_ino;
                    } else {
                        wire[4] = *libc::__error() as u64;
                    }
                }
                libc::close(result);
            }
        }
        if result >= 0 {
            wire[0] = 2;
            break;
        }
        let error = *libc::__error();
        let accepted =
            error == libc::EPERM || (!matches!(class, Class::Signal) && error == libc::EACCES);
        if !accepted {
            wire[0] = 3;
            wire[4] = error as u64;
            break;
        }
        if error == libc::EACCES {
            wire[1] += 1;
        } else {
            wire[2] += 1;
        }
    }
    let n = libc::write(3, wire.as_ptr().cast(), 80);
    libc::_exit(if n == 80 { 0 } else { 70 });
}
pub(super) fn reap(pid: i32, timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    let mut status = 0;
    loop {
        let r = unsafe { libc::waitpid(pid, &mut status, libc::WNOHANG) };
        if r == pid {
            return require(
                libc::WIFEXITED(status) && libc::WEXITSTATUS(status) == 0,
                "DENIAL_CHILD_UNKNOWN",
            );
        }
        if r < 0 {
            return Err(Error::new("DENIAL_CHILD_UNKNOWN"));
        }
        if Instant::now() >= deadline {
            break;
        }
        std::thread::sleep(Duration::from_millis(5));
    }
    unsafe {
        libc::kill(pid, libc::SIGKILL);
    }
    let end = Instant::now() + Duration::from_secs(2);
    while Instant::now() < end {
        if unsafe { libc::waitpid(pid, &mut status, libc::WNOHANG) } == pid {
            return Err(Error::new("DENIAL_TIMEOUT"));
        }
        std::thread::sleep(Duration::from_millis(5));
    }
    Err(Error::new("DENIAL_CHILD_UNKNOWN"))
}
