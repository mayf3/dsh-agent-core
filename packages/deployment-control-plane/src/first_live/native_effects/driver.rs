use super::super::{
    compose, files, gate,
    inventory::{self, Kind, Tree},
    legacy_locks::LegacyLocks,
    lifecycle::{Census, Effects},
    native_tree,
    packet::Packet,
    retirement, sudo,
};
use super::{commands, denial, inode, launchd, leaves, node, preflight, service};
use crate::{
    error::require,
    fs::{file::sha, secure::Dir, MutationGuard},
    trust::digest,
    Result,
};
use std::{collections::BTreeMap, os::unix::fs::MetadataExt, path::Path};
pub(super) struct NativeEffects<'a> {
    root: &'a Dir,
    packet_dir: &'a Dir,
    area: &'a Dir,
    p: &'a Packet,
    g: &'a gate::Grant,
    guard: &'a MutationGuard,
    locks: &'a LegacyLocks<'a>,
    trees: [Tree; 3],
    maintenance: service::Maintenance<'a>,
    restored: Option<crate::transaction::ServiceImage>,
    intent_sha: String,
    leaves: Option<BTreeMap<String, leaves::Leaf>>,
    retirement_digest: Option<String>,
    stopped: bool,
    isolated: bool,
    start_attempted: bool,
}
impl<'a> NativeEffects<'a> {
    pub(super) fn new(
        root: &'a Dir,
        packet_dir: &'a Dir,
        area: &'a Dir,
        p: &'a Packet,
        g: &'a gate::Grant,
        guard: &'a MutationGuard,
        locks: &'a LegacyLocks<'a>,
    ) -> Result<Self> {
        guard.binds(root)?;
        Ok(Self {
            root,
            packet_dir,
            area,
            p,
            g,
            guard,
            locks,
            trees: native_tree::load(packet_dir, p)?,
            maintenance: service::Maintenance::new(root, area, p, guard)?,
            restored: None,
            intent_sha: sha(&files::raw(area, "first-live-intent.json")?),
            leaves: None,
            retirement_digest: None,
            stopped: false,
            isolated: false,
            start_attempted: false,
        })
    }
    fn check(&self) -> Result<()> {
        self.guard.binds(self.root)?;
        self.locks.verify()?;
        gate::validate(self.g, self.g, compose::now()?)?;
        native_tree::ancestors(&self.p.lifecycle.ancestors)?;
        preflight::physical_socket(self.p)?;
        Ok(())
    }
    fn trees(&self) -> Result<String> {
        for (i, name) in ["app", "harness", "node-runtime"].iter().enumerate() {
            inventory::census(&native_tree::open(name)?, &self.trees[i], false, i == 1)?;
        }
        inventory::closed_links(&self.trees)?;
        retirement::absent_sources(&native_tree::open("app")?, &self.trees[0].entries)?;
        digest(&self.trees)
    }
    fn context(&self) -> Result<denial::Context<'_>> {
        denial::Context::new(
            self.area,
            &self.intent_sha,
            &self.p.controller_sha256,
            &self.p.lifecycle.caller_groups,
            self.guard,
        )
    }
    fn service_sudo(&self, phase: &str) -> Result<String> {
        self.check()?;
        let pin = self
            .p
            .lifecycle
            .tool_sha256
            .get("/usr/bin/sudo")
            .ok_or(crate::Error::new("FIRST_LIVE_TOOL_PIN"))?;
        super::super::journal::append(
            self.area,
            &format!("{phase}-service-sudo-intent.json"),
            &serde_json::json!({"binding":self.g.packet_sha256,"sudo_sha256":pin,"uids":[505,612]}),
        )?;
        let reports = sudo::audit(pin)?;
        self.check()?;
        files::publish(
            self.area,
            &format!("{phase}-service-sudo-result.json"),
            &reports,
        )?;
        digest(&reports)
    }
    fn join_leaves(&self) -> Result<()> {
        require(
            self.leaves.as_ref() == Some(&leaves::capture()?),
            "FIRST_LIVE_PUBLIC_LEAF_DRIFT",
        )
    }
    pub(super) fn final_readback(&self) -> Result<String> {
        self.check()?;
        self.trees()?;
        let restored = self
            .restored
            .as_ref()
            .ok_or(crate::Error::new("FIRST_LIVE_AVAILABILITY_UNKNOWN"))?;
        self.maintenance.prove(restored)?;
        require(
            crate::bootstrap::first_live_sudoers_census()? == self.p.lifecycle.sudoers_sha256,
            "FIRST_LIVE_SUDOERS_DRIFT",
        )?;
        launchd::controller_off(self.area, "final", self.p, self.g)?;
        self.retirement_digest
            .clone()
            .ok_or(crate::Error::new("FIRST_LIVE_RETIREMENT_UNKNOWN"))
    }
    pub(super) fn failure_availability(&mut self) -> Result<serde_json::Value> {
        self.check()?;
        if let Some(image) = &self.restored {
            self.trees()?;
            self.maintenance.prove(image)?;
            return Ok(
                serde_json::json!({"state":"VERIFIED_NEW_CLOSURE_STILL_AVAILABLE","service_image_digest":digest(image)?,"operation_pass":false}),
            );
        }
        require(
            super::availability::eligible(self.stopped, self.isolated, self.start_attempted),
            "FIRST_LIVE_RECOVERY_UNKNOWN",
        )?;
        require(
            super::availability::probes_known(self.area)?,
            "FIRST_LIVE_EFFECT_UNKNOWN",
        )?;
        self.trees()?;
        self.join_leaves()?;
        self.maintenance.confirm_stopped()?;
        super::super::journal::append(
            self.area,
            "availability-recovery-intent.json",
            &serde_json::json!({"binding":self.g.packet_sha256,"complete_face":digest(&self.trees)?,"state":"FAILED_AVAILABILITY_ONLY"}),
        )?;
        self.start_attempted = true;
        let image = self.maintenance.restore()?;
        self.maintenance.prove(&image)?;
        self.trees()?;
        self.restored = Some(image.clone());
        let value = serde_json::json!({"state":"FAILED_NEW_CLOSURE_AVAILABILITY_RESTORED","service_image":image,"operation_pass":false,"controller_enabled":false});
        super::super::journal::append(self.area, "availability-recovery-result.json", &value)?;
        Ok(value)
    }
}
impl Effects for NativeEffects<'_> {
    fn census(&mut self) -> Result<Census> {
        self.check()?;
        require(
            crate::bootstrap::first_live_sudoers_census()? == self.p.lifecycle.sudoers_sha256,
            "FIRST_LIVE_SUDOERS_DRIFT",
        )?;
        let service_sudo = self.service_sudo("initial")?;
        commands::effective_sudo(self.area, "initial-effective-sudo", self.p, self.g)?;
        launchd::controller_off(self.area, "initial", self.p, self.g)?;
        let inventory_digest = self.trees()?;
        files::publish(
            self.area,
            "initial-optional-negative-edges.json",
            &inventory::recorded_negative_edges(&self.trees)?,
        )?;
        files::publish(
            self.area,
            "initial-absent-retirement.json",
            &retirement::absent_sources(&native_tree::open("app")?, &self.trees[0].entries)?,
        )?;
        let mut total = 0u64;
        for (i, name) in ["app", "harness", "node-runtime"].iter().enumerate() {
            let root = native_tree::open(name)?;
            require(
                root.file.metadata()?.dev() == self.area.file.metadata()?.dev(),
                "FIRST_LIVE_RECOVERY_VOLUME",
            )?;
            for (path, e) in &self.trees[i].entries {
                if e.kind == Kind::File {
                    let file =
                        super::super::inventory_path::descendant(&root.file, path, libc::O_RDONLY)?;
                    total = total
                        .checked_add(file.metadata()?.len())
                        .ok_or(crate::Error::new("SIZE_LIMIT"))?;
                }
            }
        }
        let payloads = node::payloads(self.packet_dir, &self.p.lifecycle.node_payloads)?;
        let payload_bytes = payloads.values().try_fold(0u64, |sum, b| {
            sum.checked_add(b.len() as u64)
                .ok_or(crate::Error::new("SIZE_LIMIT"))
        })?;
        inode::check_space(self.area, total, payload_bytes)?;
        let public = leaves::capture()?;
        files::publish(self.area, "initial-public-leaves.json", &public)?;
        let services =
            crate::transaction::first_live_components(&self.p.native_enrollment.maintenance()?)?;
        service::validate_group(
            &services,
            &self.p.lifecycle.loaded_services,
            &self.p.lifecycle.disabled_services,
        )?;
        files::publish(self.area, "initial-services.json", &services)?;
        for (path, expected) in &self.p.lifecycle.legacy_sha256 {
            require(
                retirement::LEGACY.contains(&path.as_str()),
                "FIRST_LIVE_LEGACY_SET",
            )?;
            let path = Path::new(path);
            let dir = native_tree::open_parent(path)?;
            let f = dir.open_file(
                path.file_name().unwrap().to_str().unwrap(),
                libc::O_RDONLY,
                0,
            )?;
            require(
                sha(&crate::fs::file::snapshot(&f, f.metadata()?.uid(), 16 * 1024 * 1024)?.bytes)
                    == *expected,
                "FIRST_LIVE_LEGACY_DRIFT",
            )?;
        }
        Ok(Census {
            host: self.p.host.clone(),
            public_digest: digest(&(public, service_sudo))?,
            services_digest: digest(&services)?,
            inventory_digest,
            legacy_digest: digest(&self.p.lifecycle.legacy_sha256)?,
        })
    }
    fn retire(&mut self) -> Result<String> {
        self.check()?;
        self.service_sudo("pre-retirement")?;
        self.trees()?;
        let area = self.area.mkdir("legacy-preimages")?;
        let retired = retirement::apply(
            self.packet_dir,
            &area,
            &self.p.lifecycle.legacy_sha256,
            &self.p.lifecycle.retired_binary_sha256,
            self.guard,
            self.g.expires_at,
        )?;
        for path in &retirement::LEGACY[1..] {
            let rel = path
                .strip_prefix("/usr/local/libexec/agent-core/app/")
                .unwrap();
            let file = super::super::inventory_path::descendant(
                &native_tree::open("app")?.file,
                rel,
                libc::O_RDONLY,
            )?;
            let m = file.metadata()?;
            let e = self.trees[0]
                .entries
                .get_mut(rel)
                .ok_or(crate::Error::new("FIRST_LIVE_LEGACY_INVENTORY"))?;
            require(e.kind == Kind::File, "FIRST_LIVE_LEGACY_INVENTORY")?;
            e.uid = m.uid();
            e.gid = m.gid();
            e.mode = m.mode() & 0o7777;
            e.device = m.dev();
            e.inode = m.ino();
            e.links = m.nlink();
            e.sha256 = Some(retired[*path].clone());
        }
        let public = Dir::open(Path::new("/usr/local/libexec/agent-deployd"), 0)?;
        let marker = crate::trust::canonical_bytes(
            &serde_json::json!({"operation_id":self.p.operation_id,"package_digest":self.g.packet_sha256,"state":"PENDING_FIRST_LIVE_ADOPTION"}),
        )?;
        crate::fs::file::write_new(&public, "enrolled-dsh-runtime", &marker, 0, 0, 0o444)?;
        self.trees()?;
        let absent =
            retirement::absent_sources(&native_tree::open("app")?, &self.trees[0].entries)?;
        files::publish(self.area, "post-retirement-absent.json", &absent)?;
        let value = digest(&(retired, absent))?;
        self.retirement_digest = Some(value.clone());
        Ok(value)
    }
    fn quiesce(&mut self) -> Result<String> {
        self.check()?;
        let value = self.maintenance.stop()?;
        self.stopped = true;
        Ok(value)
    }
    fn isolate(&mut self) -> Result<String> {
        self.check()?;
        self.trees()?;
        files::publish(
            self.area,
            "pre-isolation-absent-retirement.json",
            &retirement::absent_sources(&native_tree::open("app")?, &self.trees[0].entries)?,
        )?;
        for (i, name) in ["app", "harness", "node-runtime"].iter().enumerate() {
            let root = native_tree::open(name)?;
            let metadata = self.area.mkdir(&format!("{name}-metadata"))?;
            let before = inventory::protect_directories(
                &root,
                &self.trees[i],
                i == 1,
                &metadata,
                self.g.expires_at,
            )?;
            let archive = self.area.mkdir(&format!("{name}-copies"))?;
            let mut selected = before.clone();
            if i == 2 {
                selected
                    .entries
                    .retain(|path, _| !self.p.lifecycle.node_payloads.contains_key(path));
            }
            let changed =
                inode::replace_tree(&root, &selected, &archive, self.guard, self.g.expires_at)?;
            self.trees[i] = before;
            self.trees[i].root = changed.root;
            self.trees[i].entries.extend(changed.entries);
            inventory::census(&root, &self.trees[i], false, i == 1)?;
        }
        self.trees[2] = node::install(
            self.packet_dir,
            &self.area.mkdir("node-payloads")?,
            &self.p.lifecycle.node_payloads,
            &self.trees[2],
            self.guard,
            self.g.expires_at,
        )?;
        self.leaves = Some(leaves::capture()?);
        let value = self.trees()?;
        self.isolated = true;
        Ok(value)
    }
    fn denial(&mut self) -> Result<String> {
        self.check()?;
        self.join_leaves()?;
        let targets =
            denial::Targets::from_inventory(&self.trees, &self.p.native_enrollment.maintenance()?)?;
        let ctx = self.context()?;
        let files = denial::probe_quiescent(&targets, &ctx)?;
        let ids = self
            .p
            .configuration
            .callers
            .iter()
            .map(|c| c.uid)
            .chain(self.p.native_enrollment.services.iter().map(|s| s.uid))
            .collect();
        let socket = denial::probe_socket(
            self.p
                .configuration
                .socket_ancestor
                .as_ref()
                .ok_or(crate::Error::new("SOCKET_ANCESTOR_REQUIRED"))?,
            self.p.configuration.socket_gid,
            &ids,
            &ctx,
        )?;
        let refusal = commands::legacy(self.area, self.p, self.g)?;
        let sudo = commands::effective_sudo(self.area, "post-effective-sudo", self.p, self.g)?;
        self.join_leaves()?;
        self.trees()?;
        digest(&(files, socket, refusal, sudo))
    }
    fn restore_availability(&mut self) -> Result<String> {
        self.check()?;
        self.start_attempted = true;
        let image = self.maintenance.restore()?;
        let hash = digest(&image)?;
        self.restored = Some(image);
        Ok(hash)
    }
    fn loaded_denial(&mut self) -> Result<String> {
        self.check()?;
        self.join_leaves()?;
        let expected = self
            .restored
            .as_ref()
            .ok_or(crate::Error::new("FIRST_LIVE_AVAILABILITY_UNKNOWN"))?;
        let commands = commands::loaded(self.area, self.p, self.g, expected, &self.maintenance)?;
        let domain = super::domain_probe::probe(self.area, self.p, self.g)?;
        self.maintenance.prove(expected)?;
        let signal = denial::probe_signal(&expected.processes, &self.context()?)?;
        self.maintenance.prove(expected)?;
        self.join_leaves()?;
        digest(&(commands, domain, signal))
    }
    fn verify(&mut self, before: &Census) -> Result<Census> {
        self.check()?;
        self.join_leaves()?;
        require(before.host == self.p.host, "FIRST_LIVE_HOST")?;
        let expected = self
            .restored
            .as_ref()
            .ok_or(crate::Error::new("FIRST_LIVE_AVAILABILITY_UNKNOWN"))?;
        let services = self.maintenance.prove(expected)?;
        files::publish(
            self.area,
            "final-optional-negative-edges.json",
            &inventory::recorded_negative_edges(&self.trees)?,
        )?;
        files::publish(
            self.area,
            "final-absent-retirement.json",
            &retirement::absent_sources(&native_tree::open("app")?, &self.trees[0].entries)?,
        )?;
        let health = crate::verification::native_io::get(None)?;
        let health_value = crate::verification::documents::strict_json(&health)?;
        crate::verification::watchdog::canonical_health(&health_value, &self.p.release.source_sha)?;
        let generated = health_value["generatedAt"]
            .as_u64()
            .ok_or(crate::Error::new("FIRST_LIVE_HEALTH_TIME"))?;
        let now = compose::now_ms()?;
        require(
            generated <= now && now - generated <= self.p.health_max_age_ms,
            "FIRST_LIVE_HEALTH_TIME",
        )?;
        crate::fs::file::write_new(self.area, "lifecycle-health.json", &health, 0, 0, 0o400)?;
        self.maintenance.prove(expected)?;
        files::publish(self.area, "final-public-leaves.json", &leaves::capture()?)?;
        files::publish(self.area, "lifecycle-services.json", &services)?;
        for (name, tree) in ["app", "harness", "node"].iter().zip(&self.trees) {
            files::publish(self.area, &format!("lifecycle-{name}-postimage.json"), tree)?;
        }
        Ok(Census {
            host: self.p.host.clone(),
            public_digest: digest(&(leaves::capture()?, sha(&health)))?,
            services_digest: digest(&services)?,
            inventory_digest: self.trees()?,
            legacy_digest: self
                .retirement_digest
                .clone()
                .ok_or(crate::Error::new("FIRST_LIVE_RETIREMENT_UNKNOWN"))?,
        })
    }
}
