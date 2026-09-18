use crate::{fs::secure::Dir, trust::digest, Result};
use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Census {
    pub host: String,
    pub public_digest: String,
    pub services_digest: String,
    pub inventory_digest: String,
    pub legacy_digest: String,
}
pub(super) struct VerifiedLifecycle {
    digest: String,
}
impl VerifiedLifecycle {
    pub(super) fn digest(&self) -> &str {
        &self.digest
    }
}
pub(super) trait Effects {
    fn census(&mut self) -> Result<Census>;
    fn retire(&mut self) -> Result<String>;
    fn quiesce(&mut self) -> Result<String>;
    fn isolate(&mut self) -> Result<String>;
    fn denial(&mut self) -> Result<String>;
    fn restore_availability(&mut self) -> Result<String>;
    fn loaded_denial(&mut self) -> Result<String>;
    fn verify(&mut self, before: &Census) -> Result<Census>;
}
pub(super) fn run(
    root: &Dir,
    binding: &str,
    effects: &mut impl Effects,
) -> Result<VerifiedLifecycle> {
    let before = effects.census()?;
    super::files::absent(root, "lifecycle-proof.json")?;
    super::journal::append(root, "lifecycle-before.json", &before)?;
    let mut outputs = Vec::new();
    for step in 0..6 {
        let name = [
            "retirement",
            "quiescence",
            "isolation",
            "denial",
            "availability",
            "loaded-denial",
        ][step];
        super::journal::append(
            root,
            &format!("{name}-intent.json"),
            &serde_json::json!({"binding":binding,"before":digest(&before)?}),
        )?;
        let value = match step {
            0 => effects.retire()?,
            1 => effects.quiesce()?,
            2 => effects.isolate()?,
            3 => effects.denial()?,
            4 => effects.restore_availability()?,
            _ => effects.loaded_denial()?,
        };
        super::journal::append(root, &format!("{name}-result.json"), &value)?;
        outputs.push(value);
    }
    let after = effects.verify(&before)?;
    let proof = serde_json::json!({"binding":binding,"before":before,"after":after,"outputs":outputs,"admission_enabled":false});
    super::journal::append(root, "lifecycle-proof.json", &proof)?;
    Ok(VerifiedLifecycle {
        digest: digest(&proof)?,
    })
}
