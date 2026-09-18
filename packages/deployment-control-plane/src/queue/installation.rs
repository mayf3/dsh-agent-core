//! Strict origin dispatch; an observed baseline is never decoded as a past apply.
use super::*;
#[derive(Clone)]
pub(crate) enum InstallationReceipt {
    Mutation(TransactionReceipt),
    Adoption(AdoptedBaselineReceipt),
}
impl InstallationReceipt {
    fn digest(&self) -> Result<String> {
        match self {
            Self::Mutation(r) => crate::trust::digest(r),
            Self::Adoption(r) => crate::trust::digest(r),
        }
    }
    pub(crate) fn capability(&self) -> &str {
        match self {
            Self::Mutation(r) => &r.capability,
            Self::Adoption(r) => &r.capability,
        }
    }
    pub(crate) fn current(&self, hash: &str) -> CurrentInstallation {
        let (unit, generation, attempt, service, origin) = match self {
            Self::Mutation(r) => (
                r.unit_id.clone(),
                r.target_generation,
                r.attempt,
                r.new_service_generation.clone(),
                InstallationOrigin::MutationTransaction,
            ),
            Self::Adoption(r) => (
                r.unit_id.clone(),
                r.target_generation,
                r.attempt,
                r.service_generation.clone(),
                r.origin,
            ),
        };
        CurrentInstallation {
            unit_id: unit,
            target_generation: generation,
            attempt,
            transaction_receipt_digest: hash.into(),
            service_generation: service,
            binding_digest: hash.into(),
            origin,
        }
    }
}
pub(super) fn decode(kind: &str, raw: String) -> Result<InstallationReceipt> {
    match kind {
        "transaction" => Ok(InstallationReceipt::Mutation(parse(raw)?)),
        "adopted-baseline" => {
            let r: AdoptedBaselineReceipt = parse(raw)?;
            require(
                r.version == 1
                    && r.origin == InstallationOrigin::ObservedExistingInstallation
                    && r.attempt == 0
                    && r.install_count == 0
                    && r.restart_count == 0
                    && r.target_generation == 1,
                "ADOPTION_RECEIPT",
            )?;
            Ok(InstallationReceipt::Adoption(r))
        }
        _ => Err(Error::new("INSTALLATION_ORIGIN")),
    }
}
pub(super) fn by_digest(
    tx: &Transaction<'_>,
    hash: &str,
    unit: &str,
) -> Result<InstallationReceipt> {
    let (kind, raw): (String, String) = tx.query_row(
        "SELECT kind,record FROM receipts WHERE digest=? AND unit=?",
        (hash, unit),
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let result = decode(&kind, raw)?;
    require(
        result.current(hash).unit_id == unit && result.digest()? == hash,
        "RECEIPT_BINDING",
    )?;
    Ok(result)
}
pub(super) fn installed(
    tx: &Transaction<'_>,
    target: &str,
) -> Result<Option<(String, InstallationReceipt)>> {
    let raw:Option<(String,String,String,String,u64)>=tx.query_row("SELECT r.digest,r.kind,r.record,i.unit,i.generation FROM installed i JOIN receipts r ON i.receipt=r.digest WHERE i.target=?",[target],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional()?;
    raw.map(|(hash, kind, raw, unit, generation)| {
        let record = decode(&kind, raw)?;
        let current = record.current(&hash);
        require(
            record.digest()? == hash
                && current.unit_id == unit
                && current.target_generation == generation
                && read_status(tx, &unit)?.unit.target_runtime == target,
            "RECEIPT_BINDING",
        )?;
        Ok((hash, record))
    })
    .transpose()
}
impl Queue {
    pub(crate) fn daemon_installation_record(
        &self,
        target: &str,
    ) -> Result<Option<InstallationReceipt>> {
        self.transaction(|tx| Ok(installed(tx, target)?.map(|(_, r)| r)))
    }
    pub(crate) fn daemon_goal_evidence(&self, hash: &str) -> Result<Signed<GoalReceipt>> {
        self.transaction(|tx| {
            parse(tx.query_row(
                "SELECT record FROM receipts WHERE digest=? AND kind='goal'",
                [hash],
                |r| r.get(0),
            )?)
        })
    }
}
