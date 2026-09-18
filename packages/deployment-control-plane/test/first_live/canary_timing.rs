use super::*;
fn template() -> CanaryPlanTemplate {
    CanaryPlanTemplate {
        version: 1,
        source_sha: "d602b592fad345fb1c9adebe2bc6611a6f5cfdc2".into(),
        canary_agent_id: "agt_scheduler-postdeploy-canary".into(),
        logical_key: "scheduler-postdeploy:d602b592fad345fb1c9adebe2bc6611a6f5cfdc2".into(),
        at_delay_seconds: 1200,
        not_after_delay_seconds: 1380,
    }
}
#[test]
fn actual_plan_is_fixed_once_before_review_with_sufficient_lifetime() {
    let p = template();
    let raw = plan_at(&p, 1800000000, 1800002000).unwrap();
    let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(v["notAfter"], 1800001380000u64);
    assert_eq!(v["status"], "PLANNED");
    assert_eq!(v["canaryJobId"], serde_json::Value::Null);
    assert_eq!(
        crate::verification::run_readback::instant(v["at"].as_str().unwrap()).unwrap(),
        1800001200000u64
    );
    assert!(plan_at(&p, 1800000000, 1800001380).is_err());
    let mut p = template();
    p.at_delay_seconds = 1199;
    assert!(plan_at(&p, 1800000000, 1800002000).is_err());
    let mut v = serde_json::to_value(template()).unwrap();
    v["at"] = serde_json::json!("fake");
    assert!(serde_json::from_value::<CanaryPlanTemplate>(v).is_err());
}

struct FixtureLife;
impl crate::first_live::lifecycle::Effects for FixtureLife {
    fn census(&mut self) -> crate::Result<crate::first_live::lifecycle::Census> {
        Ok(crate::first_live::lifecycle::Census {
            host: "fixture".into(),
            public_digest: "fixture".into(),
            services_digest: "fixture".into(),
            inventory_digest: "fixture".into(),
            legacy_digest: "fixture".into(),
        })
    }
    fn retire(&mut self) -> crate::Result<String> {
        Ok("fixture".into())
    }
    fn quiesce(&mut self) -> crate::Result<String> {
        Ok("fixture".into())
    }
    fn isolate(&mut self) -> crate::Result<String> {
        Ok("fixture".into())
    }
    fn denial(&mut self) -> crate::Result<String> {
        Ok("fixture".into())
    }
    fn restore_availability(&mut self) -> crate::Result<String> {
        Ok("fixture".into())
    }
    fn loaded_denial(&mut self) -> crate::Result<String> {
        Ok("fixture".into())
    }
    fn verify(
        &mut self,
        _: &crate::first_live::lifecycle::Census,
    ) -> crate::Result<crate::first_live::lifecycle::Census> {
        self.census()
    }
}
#[test]
fn real_clock_plan_publication_is_exclusive_and_later_substitution_fails_digest() {
    use crate::fs::{file::sha, FixtureRoots};
    use std::os::unix::fs::PermissionsExt;
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let life = crate::first_live::lifecycle::run(&r.root, "fixture", &mut FixtureLife).unwrap();
    let expires = crate::first_live::compose::now().unwrap() + 2000;
    let raw = freeze(&r.root, &template(), &life, expires).unwrap();
    assert!(freeze(&r.root, &template(), &life, expires).is_err());
    let expected = sha(raw.as_bytes());
    crate::verification::canary_plan::planned(&r.root, &expected, &template().source_sha).unwrap();
    let file = t.path().join("canary-plan.json");
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();
    let mut v: serde_json::Value = serde_json::from_str(&raw).unwrap();
    v["at"] = serde_json::json!("2099-01-01T00:00:00.000Z");
    std::fs::write(&file, serde_json::to_vec(&v).unwrap()).unwrap();
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o400)).unwrap();
    assert!(
        crate::verification::canary_plan::planned(&r.root, &expected, &template().source_sha)
            .is_err()
    );
}
