use crate::{
    fs::{file::write_new, secure::Dir},
    trust::{canonical_bytes, digest},
    Result,
};
use serde::Serialize;
use std::os::unix::fs::MetadataExt;
#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(super) enum Step {
    #[cfg(test)]
    Lifecycle,
    Queue,
    Materialize,
    BuildReview,
    Adopt,
    #[cfg(test)]
    CanaryCreate,
    Standing,
}
impl Step {
    fn name(self) -> &'static str {
        match self {
            #[cfg(test)]
            Self::Lifecycle => "lifecycle",
            Self::Queue => "queue",
            Self::Materialize => "materialize",
            Self::BuildReview => "build-review",
            Self::Adopt => "adopt",
            #[cfg(test)]
            Self::CanaryCreate => "canary-create",
            Self::Standing => "standing",
        }
    }
}
pub(super) fn execute<T: Serialize>(
    area: &Dir,
    step: Step,
    binding: &str,
    effect: impl FnOnce() -> Result<T>,
) -> Result<T> {
    for suffix in ["intent", "result", "failure"] {
        super::files::absent(area, &format!("{}-{suffix}.json", step.name()))?;
    }
    append(
        area,
        &format!("{}-intent.json", step.name()),
        &serde_json::json!({"binding":binding,"step":step}),
    )?;
    let result = effect();
    match result {
        Ok(value) => {
            append(
                area,
                &format!("{}-result.json", step.name()),
                &serde_json::json!({"binding":binding,"output_digest":digest(&value)?,"output":value}),
            )?;
            Ok(value)
        }
        Err(error) => {
            let _ = append(
                area,
                &format!("{}-failure.json", step.name()),
                &serde_json::json!({"binding":binding,"code":error.code(),"outcome":"unknown-retained"}),
            );
            Err(error)
        }
    }
}
pub(super) fn append<T: Serialize>(area: &Dir, name: &str, value: &T) -> Result<()> {
    write_new(
        area,
        name,
        &canonical_bytes(value)?,
        area.uid,
        area.file.metadata()?.gid(),
        0o400,
    )?;
    Ok(())
}
