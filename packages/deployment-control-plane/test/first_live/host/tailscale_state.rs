use super::*;
use crate::first_live::native_effects::host::credentials::Credentials;
fn identity() -> Identity {
    Identity {
        pid: 99,
        parent_pid: 1,
        birth_seconds: 100,
        birth_micros: 0,
        credentials: Credentials {
            effective_uid: 0,
            real_uid: 0,
            saved_uid: 0,
            effective_gid: 0,
            real_gid: 0,
            saved_gid: 0,
        },
        tty_device: 0,
        process_group: 99,
        session_id: Some(99),
        executable: Some("sealed".into()),
    }
}
#[derive(Default)]
struct Mock {
    fail: usize,
    events: Vec<&'static str>,
}
impl Mock {
    fn step(&mut self, name: &'static str) -> Result<()> {
        self.events.push(name);
        crate::error::require(self.events.len() != self.fail, "INJECTED_UNKNOWN")
    }
}
impl Effects for Mock {
    fn check(&mut self) -> Result<()> {
        self.step("check")
    }
    fn intent(&mut self) -> Result<()> {
        self.step("intent")
    }
    fn stage(&mut self) -> Result<()> {
        self.step("stage")
    }
    fn stop(&mut self) -> Result<()> {
        self.step("bootout")
    }
    fn stopped(&mut self) -> Result<()> {
        self.step("old-generation-and-job-absent")
    }
    fn publish(&mut self) -> Result<()> {
        self.step("publish")
    }
    fn start(&mut self) -> Result<()> {
        self.step("bootstrap")
    }
    fn ready(&mut self) -> Result<(Identity, String)> {
        self.step("same-identity-ready")?;
        Ok((identity(), "status".into()))
    }
    fn complete(&mut self, _: &Identity, _: &str) -> Result<()> {
        self.step("complete")
    }
}
#[test]
fn every_interruption_is_consumed_without_a_closure_or_reverse_mutation() {
    for fail in 1..=14 {
        let mut t = Transition::default();
        let mut e = Mock {
            fail,
            ..Default::default()
        };
        assert!(t.run(&mut e).is_err(), "{fail}");
        assert!(t.sealed.is_none(), "{fail}");
        let calls = e.events.len();
        assert!(t.run(&mut e).is_err());
        assert_eq!(calls, e.events.len());
        assert!(e.events.iter().filter(|s| **s == "bootout").count() <= 1);
        assert!(e.events.iter().filter(|s| **s == "bootstrap").count() <= 1);
    }
}
#[test]
fn job_unload_and_generation_exit_precede_publication_then_new_readiness() {
    let mut t = Transition::default();
    let mut e = Mock::default();
    t.run(&mut e).unwrap();
    assert_eq!(
        e.events,
        vec![
            "check",
            "intent",
            "check",
            "stage",
            "check",
            "bootout",
            "old-generation-and-job-absent",
            "check",
            "publish",
            "check",
            "bootstrap",
            "same-identity-ready",
            "check",
            "complete"
        ]
    );
    assert!(t.sealed.is_some());
}
