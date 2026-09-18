use super::lifecycle::*;
use crate::{fs::FixtureRoots, Error, Result};
struct Fake {
    steps: Vec<&'static str>,
    fail: bool,
}
impl Effects for Fake {
    fn census(&mut self) -> Result<Census> {
        self.steps.push("before");
        Ok(Census {
            host: "host".into(),
            public_digest: "public".into(),
            services_digest: "services".into(),
            inventory_digest: "inventory".into(),
            legacy_digest: "legacy".into(),
        })
    }
    fn retire(&mut self) -> Result<String> {
        self.steps.push("retire");
        Ok("retired".into())
    }
    fn quiesce(&mut self) -> Result<String> {
        self.steps.push("stop");
        Ok("stopped".into())
    }
    fn isolate(&mut self) -> Result<String> {
        self.steps.push("isolate");
        Ok("isolated".into())
    }
    fn denial(&mut self) -> Result<String> {
        self.steps.push("denial");
        if self.fail {
            Err(Error::new("UNEXPECTED_ALLOWED"))
        } else {
            Ok("denied".into())
        }
    }
    fn restore_availability(&mut self) -> Result<String> {
        self.steps.push("restore");
        Ok("restored".into())
    }
    fn loaded_denial(&mut self) -> Result<String> {
        self.steps.push("loaded-denial");
        Ok("denied".into())
    }
    fn verify(&mut self, _: &Census) -> Result<Census> {
        self.steps.push("after");
        self.census()
    }
}
#[test]
fn lifecycle_receipt_requires_actual_all_effects_in_order() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let mut f = Fake {
        steps: vec![],
        fail: false,
    };
    run(&r.root, "binding", &mut f).unwrap();
    assert_eq!(
        f.steps,
        vec![
            "before",
            "retire",
            "stop",
            "isolate",
            "denial",
            "restore",
            "loaded-denial",
            "after",
            "before"
        ]
    );
}
#[test]
fn unexpected_privilege_never_constructs_verified_lifecycle() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let mut f = Fake {
        steps: vec![],
        fail: true,
    };
    assert!(run(&r.root, "binding", &mut f).is_err());
    assert!(!f.steps.contains(&"after"));
}
