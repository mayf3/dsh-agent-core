use super::{gate, records::*};
use crate::{
    error::require,
    fs::{secure::Dir, MutationGuard},
    trust::digest,
    Result,
};
pub(super) fn claim(area: &Dir, root: &Dir, b: &Binding, guard: &MutationGuard) -> Result<()> {
    guard.binds(root)?;
    gate::publish(area, "enable-intent.json", b)
}
pub(super) trait Effects {
    fn replace_plist(&mut self) -> Result<()>;
    fn enable(&mut self) -> Result<()>;
    fn bootstrap(&mut self) -> Result<()>;
    fn readback(&mut self) -> Result<Readback>;
    fn ready(&mut self, readback: &Readback) -> Result<Ready>;
}
fn effect(area: &Dir, b: &Binding, name: &str, f: impl FnOnce() -> Result<()>) -> Result<()> {
    gate::publish(
        area,
        &format!("enable-{name}-intent.json"),
        &serde_json::json!({"binding":digest(b)?}),
    )?;
    f()?;
    gate::publish(
        area,
        &format!("enable-{name}-result.json"),
        &serde_json::json!({"binding":digest(b)?,"state":"OBSERVED_COMPLETE"}),
    )
}
pub(super) fn run(area: &Dir, b: &Binding, e: &mut impl Effects) -> Result<()> {
    require(
        gate::read::<Binding>(area, "enable-intent.json")? == *b,
        "ENABLE_BINDING",
    )?;
    gate::absent(area, "enable-failure.json")?;
    gate::publish(
        area,
        "enable-execution-intent.json",
        &serde_json::json!({"binding":digest(b)?}),
    )?;
    let outcome = (|| {
        effect(area, b, "plist", || e.replace_plist())?;
        effect(area, b, "launchctl", || e.enable())?;
        effect(area, b, "bootstrap", || e.bootstrap())?;
        let rb = e.readback()?;
        require(rb.binding == *b, "ENABLE_BINDING")?;
        let admission = Admission {
            binding: b.clone(),
            readback_digest: digest(&rb)?,
        };
        gate::publish(area, "enable-admission.json", &admission)?;
        let ready = e.ready(&rb)?;
        require(
            ready.readback == rb && ready.admission_digest == digest(&admission)?,
            "ENABLE_GENERATION_BINDING",
        )?;
        gate::publish(
            area,
            "enable-result.json",
            &Complete {
                binding: b.clone(),
                readback_digest: digest(&rb)?,
                ready_digest: digest(&ready)?,
            },
        )
    })();
    if let Err(error) = &outcome {
        let _ = gate::publish(
            area,
            "enable-failure.json",
            &serde_json::json!({"binding":digest(b)?,"state":"ENABLE_OUTCOME_UNKNOWN","code":error.code(),"retry_allowed":false}),
        );
    }
    outcome
}
#[cfg(test)]
#[path = "../../../test/service/first_live/enable.rs"]
mod tests;
