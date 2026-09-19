use crate::{transaction::ComponentImage, Result};
use std::collections::BTreeMap;
pub(super) fn validate_group(
    components: &[ComponentImage],
    loaded: &BTreeMap<String, bool>,
    disabled: &BTreeMap<String, bool>,
) -> Result<()> {
    use crate::{error::require, transaction::NativeKind};
    let kinds = [
        NativeKind::Runtime,
        NativeKind::WatchdogW1,
        NativeKind::WatchdogW2,
    ];
    require(
        components.len() == 3 && loaded.len() == 3 && disabled.len() == 3,
        "FIRST_LIVE_SERVICE_GROUP",
    )?;
    for kind in kinds {
        let found: Vec<_> = components.iter().filter(|c| c.kind == kind).collect();
        require(found.len() == 1, "FIRST_LIVE_SERVICE_GROUP")?;
        let c = found[0];
        require(
            loaded.get(kind.label()) == Some(&c.loaded)
                && disabled.get(kind.label()) == Some(&c.disabled),
            "FIRST_LIVE_SERVICE_DRIFT",
        )?;
        require(!c.loaded || !c.disabled, "FIRST_LIVE_DISABLED_LOADED")?;
        require(
            c.running == c.process.is_some(),
            "FIRST_LIVE_SERVICE_IDENTITY",
        )?;
    }
    Ok(())
}
pub(super) struct Maintenance<'g> {
    service: crate::transaction::NativeMaintenanceService,
    journal: crate::transaction::Journal,
    before: crate::transaction::ServiceImage,
    guard: &'g crate::fs::MutationGuard,
}
impl<'g> Maintenance<'g> {
    pub(super) fn new(
        root: &crate::fs::secure::Dir,
        area: &crate::fs::secure::Dir,
        p: &super::super::packet::Packet,
        guard: &'g crate::fs::MutationGuard,
        journal_unit: &str,
    ) -> Result<Self> {
        guard.binds(root)?;
        crate::bootstrap::verify_platform_launchctl(&p.native_enrollment.launchctl_sha256)?;
        let input = p.native_enrollment.maintenance()?;
        let components = crate::transaction::first_live_components(&input)?;
        validate_group(
            &components,
            &p.lifecycle.loaded_services,
            &p.lifecycle.disabled_services,
        )?;
        let parent = components
            .iter()
            .find(|c| c.kind == crate::transaction::NativeKind::Runtime)
            .unwrap();
        let before = crate::transaction::ServiceImage {
            loaded: parent.loaded,
            running: parent.running,
            processes: components
                .iter()
                .filter_map(|c| c.process.clone())
                .collect(),
            generation: crate::trust::digest(&components)?,
            components,
        };
        let journal = crate::transaction::Journal::create(area, journal_unit, 0, 0)?;
        let service = crate::transaction::NativeMaintenanceService {
            root: crate::fs::secure::Dir {
                file: root.file.try_clone()?,
                uid: 0,
            },
            input,
        };
        Ok(Self {
            service,
            journal,
            before,
            guard,
        })
    }
    pub(super) fn stop(&mut self) -> Result<String> {
        self.guard.binds(&self.service.root)?;
        self.service.stop(&mut self.journal, &self.before)?;
        crate::trust::digest(&self.journal.events)
    }
    pub(super) fn restore(&mut self) -> Result<crate::transaction::ServiceImage> {
        self.guard.binds(&self.service.root)?;
        self.confirm_stopped()?;
        self.service.start(&mut self.journal, &self.before, false)
    }
    pub(super) fn confirm_stopped(&self) -> Result<()> {
        self.guard.binds(&self.service.root)?;
        let current = self.service.components()?;
        crate::error::require(
            current.len() == self.before.components.len()
                && current
                    .iter()
                    .zip(&self.before.components)
                    .all(|(now, old)| {
                        now.kind == old.kind
                            && now.disabled == old.disabled
                            && !now.loaded
                            && !now.running
                            && now.process.is_none()
                    }),
            "FIRST_LIVE_STOP_STATE_UNKNOWN",
        )
    }

    pub(super) fn prove(
        &self,
        expected: &crate::transaction::ServiceImage,
    ) -> Result<crate::transaction::ServiceImage> {
        self.guard.binds(&self.service.root)?;
        self.service.prove(expected)
    }
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/service.rs"]
mod tests;
