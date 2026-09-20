use super::*;
use crate::first_live::native_effects::host::credentials::Credentials;
fn row(pid: u32) -> Identity {
    Identity {
        pid,
        parent_pid: 1,
        birth_seconds: 1,
        birth_micros: 0,
        credentials: Credentials {
            effective_uid: 502,
            real_uid: 502,
            saved_uid: 502,
            effective_gid: 20,
            real_gid: 20,
            saved_gid: 20,
        },
        tty_device: 0,
        process_group: pid,
        session_id: Some(42),
        executable: None,
    }
}
#[test]
fn every_selector_is_read_twice_including_nonroot() {
    let mut reads = Vec::new();
    assert!(collect(
        || Ok(vec![7, 9]),
        |pid| {
            reads.push(pid);
            Ok(Some(row(pid)))
        }
    )
    .unwrap()
    .is_empty());
    assert_eq!(reads, vec![7, 9, 7, 9]);
}
#[test]
fn unreadable_nonroot_selector_is_not_skipped() {
    assert!(collect(
        || Ok(vec![7, 9]),
        |pid| if pid == 9 {
            Err(Error::new("UNREADABLE"))
        } else {
            Ok(Some(row(pid)))
        }
    )
    .is_err());
}
#[test]
fn changed_pid_set_or_mismatched_identity_refuses() {
    let mut n = 0;
    assert!(collect(
        || {
            n += 1;
            Ok(if n == 1 { vec![7] } else { vec![7, 9] })
        },
        |pid| Ok(Some(row(pid)))
    )
    .is_err());
    assert!(collect(|| Ok(vec![7]), |_| Ok(Some(row(9)))).is_err());
}
#[test]
fn vanished_in_both_snapshots_is_skipped_consistently() {
    let mut reads = Vec::new();
    assert!(collect(
        || Ok(vec![7, 9]),
        |pid| {
            reads.push(pid);
            if pid == 9 {
                Ok(None)
            } else {
                Ok(Some(row(pid)))
            }
        }
    )
    .unwrap()
    .is_empty());
    assert_eq!(reads, vec![7, 9, 7, 9]);
}
#[test]
fn vanished_before_but_readable_after_refuses() {
    let mut n = 0;
    assert!(collect(
        || Ok(vec![7, 9]),
        |pid| if pid == 9 {
            n += 1;
            if n == 1 {
                Ok(None)
            } else {
                Ok(Some(row(pid)))
            }
        } else {
            Ok(Some(row(pid)))
        }
    )
    .is_err());
}
#[test]
fn readable_before_but_vanished_after_refuses() {
    let mut n = 0;
    assert!(collect(
        || Ok(vec![7, 9]),
        |pid| if pid == 9 {
            n += 1;
            if n == 1 {
                Ok(Some(row(pid)))
            } else {
                Ok(None)
            }
        } else {
            Ok(Some(row(pid)))
        }
    )
    .is_err());
}
