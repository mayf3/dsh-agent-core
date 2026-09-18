use super::*;
use crate::{fs::FixtureRoots, Error};
struct Fake {
    count: usize,
    fail: usize,
    b: Binding,
    root: Dir,
}
impl Fake {
    fn step(&mut self) -> Result<()> {
        self.count += 1;
        use std::os::fd::AsRawFd;
        let mut buf = [0i8; libc::PATH_MAX as usize];
        assert_eq!(
            unsafe {
                libc::fcntl(
                    self.root.file.as_raw_fd(),
                    libc::F_GETPATH,
                    buf.as_mut_ptr(),
                )
            },
            0
        );
        let path = unsafe { std::ffi::CStr::from_ptr(buf.as_ptr()) }
            .to_str()
            .unwrap();
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "service::first_live::enable::tests::lock_probe_child",
                "--nocapture",
            ])
            .env("DCP_ENABLE_LOCK_FIXTURE", path)
            .env(
                "DCP_ENABLE_EXPECT_BUSY",
                if self.count <= 4 { "1" } else { "0" },
            )
            .output()
            .unwrap();
        if !output.status.success() {
            return Err(Error::new("FIXTURE_MUTEX_NOT_HELD_TO_ADMISSION"));
        }

        if self.count == self.fail {
            Err(Error::new("FIXTURE_UNKNOWN"))
        } else {
            Ok(())
        }
    }
}
impl Effects for Fake {
    fn replace_plist(&mut self) -> Result<()> {
        self.step()
    }
    fn enable(&mut self) -> Result<()> {
        self.step()
    }
    fn bootstrap(&mut self) -> Result<()> {
        self.step()
    }
    fn readback(&mut self) -> Result<Readback> {
        self.step()?;
        let process = crate::transaction::ProcessIdentity {
            pid: 10,
            started_seconds: 1,
            started_micros: 2,
            uid: 0,
            gid: 0,
            executable: "/fixed".into(),
        };
        let area = self.root.child("first-live-operation")?;
        gate::claim_generation(&area, &self.b, &process)?;
        Ok(Readback {
            startup_intent_digest: gate::generation_digest(&area, &self.b, &process)?,
            binding: self.b.clone(),
            process: crate::transaction::ProcessIdentity {
                pid: 10,
                started_seconds: 1,
                started_micros: 2,
                uid: 0,
                gid: 0,
                executable: "/fixed".into(),
            },
            socket_device: 1,
            socket_inode: 2,
        })
    }
    fn ready(&mut self, r: &Readback) -> Result<Ready> {
        self.step()?;
        let area = self.root.child("first-live-operation")?;
        let admission: Admission = gate::read(&area, "enable-admission.json")?;
        require(
            admission.readback_digest == digest(r)?,
            "FIXTURE_ADMISSION_NOT_DURABLE",
        )?;
        Ok(Ready {
            readback: r.clone(),
            admission_digest: digest(&Admission {
                binding: self.b.clone(),
                readback_digest: digest(r)?,
            })?,
        })
    }
}
fn fixture() -> (tempfile::TempDir, FixtureRoots, Dir, Binding) {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let a = r.root.mkdir("first-live-operation").unwrap();
    let h = "a".repeat(64);
    let b = Binding {
        operation_id: "first-live".into(),
        package_digest: h.clone(),
        grant_digest: h.clone(),
        controller_digest: h.clone(),
        core_digest: h.clone(),
        configuration_digest: h.clone(),
        activation_digest: h.clone(),
        standing_digest: h.clone(),
        plist_before_digest: h.clone(),
        plist_after_digest: h,
        expires_at: 100,
    };
    (t, r, a, b)
}
#[test]
fn exclusive_claim_prevents_second_enable_even_after_mutex_release() {
    let (_t, r, a, b) = fixture();
    {
        let g = r.lock().unwrap();
        claim(&a, &r.root, &b, &g).unwrap();
    }
    let g = r.lock().unwrap();
    assert!(claim(&a, &r.root, &b, &g).is_err());
}
#[test]
fn unknown_effect_never_creates_completed_or_disabled_claim_and_never_replays() {
    let (_t, r, a, b) = fixture();
    {
        let g = r.lock().unwrap();
        claim(&a, &r.root, &b, &g).unwrap();
    }
    let mut f = Fake {
        count: 0,
        fail: 2,
        b: b.clone(),
        root: Dir {
            file: r.root.file.try_clone().unwrap(),
            uid: r.root.uid,
        },
    };
    assert!(run(&r.root, &a, &b, &mut f, r.lock().unwrap()).is_err());
    assert_eq!(f.count, 2);
    assert!(gate::read::<Complete>(&a, "enable-result.json").is_err());
    let v: serde_json::Value = gate::read(&a, "enable-failure.json").unwrap();
    assert_eq!(v["state"], "ENABLE_OUTCOME_UNKNOWN");
    assert!(run(&r.root, &a, &b, &mut f, r.lock().unwrap()).is_err());
    assert_eq!(f.count, 2);
}
#[test]
fn guard_is_held_through_readback_and_admission_then_released_before_ready() {
    let (_t, r, a, b) = fixture();
    {
        let g = r.lock().unwrap();
        claim(&a, &r.root, &b, &g).unwrap();
    }
    let mut f = Fake {
        count: 0,
        fail: 0,
        b: b.clone(),
        root: Dir {
            file: r.root.file.try_clone().unwrap(),
            uid: r.root.uid,
        },
    };
    run(&r.root, &a, &b, &mut f, r.lock().unwrap()).unwrap();
    assert_eq!(f.count, 5);
    let c: Complete = gate::read(&a, "enable-result.json").unwrap();
    assert_eq!(c.binding, b);
}

#[test]
fn lock_probe_child() {
    let Some(path) = std::env::var_os("DCP_ENABLE_LOCK_FIXTURE") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&path)).unwrap();
    let held = MutationGuard::acquire(&roots.root, false);
    if std::env::var("DCP_ENABLE_EXPECT_BUSY").unwrap() == "1" {
        assert_eq!(held.err().unwrap().code(), "MUTEX_BUSY")
    } else {
        held.unwrap();
    }
}
