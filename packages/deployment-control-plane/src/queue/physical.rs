use super::*;
use crate::{transaction::VerifiedRestoration, trust::digest};
impl Queue {
    pub fn daemon_current_installation(&self, target: &str) -> Result<Option<CurrentInstallation>> {
        self.transaction(|tx| current(tx, target))
    }
    pub(crate) fn record_restored_installation(
        &self,
        proof: VerifiedRestoration,
    ) -> Result<String> {
        let record = proof.0;
        self.transaction(|tx| {
            let restoring=read_status(tx,&record.restoring_unit)?;
            require(restoring.state==State::RollingBack && restoring.mutating_attempts==record.restoring_attempt,"RESTORATION_BINDING")?;
            let actual=current(tx,&restoring.unit.target_runtime)?.ok_or(Error::new("RESTORATION_BINDING"))?;
            require(actual==record.previous,"RESTORATION_CAS")?;
            let unknown:u64=tx.query_row("SELECT count(*) FROM goal_receipts WHERE unit=? AND json_extract(record,'$.payload.outcome')='OutcomeUnknown'",[&record.restoring_unit],|r|r.get(0))?;
            require(unknown==0,"UNKNOWN_CANARY")?;
            crate::trust::valid_digest(&record.physical_evidence_digest)?;
            crate::trust::valid_id(&record.service_generation)?;
            let hash=digest(&record)?;
            tx.execute("INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)",(&hash,&record.previous.unit_id,"restored-installation",json(&record)?))?;
            tx.execute("INSERT INTO physical_current(target,receipt) VALUES (?,?) ON CONFLICT(target) DO UPDATE SET receipt=excluded.receipt",(&restoring.unit.target_runtime,&hash))?;
            Ok(hash)
        })
    }
}
pub(super) fn current(tx: &Transaction<'_>, target: &str) -> Result<Option<CurrentInstallation>> {
    let Some((hash, receipt)) = super::installation::installed(tx, target)? else {
        return Ok(None);
    };
    let mut result = receipt.current(&hash);
    let physical:Option<(String,String)>=tx.query_row("SELECT receipts.digest,receipts.record FROM physical_current JOIN receipts ON receipts.digest=physical_current.receipt WHERE target=?",[target],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
    if let Some((hash, raw)) = physical {
        let r: RestoredInstallation = parse(raw)?;
        require(
            digest(&r)? == hash
                && r.previous.unit_id == result.unit_id
                && r.previous.target_generation == result.target_generation
                && r.previous.attempt == result.attempt
                && r.previous.transaction_receipt_digest == result.transaction_receipt_digest
                && r.previous.origin == result.origin,
            "RESTORATION_BINDING",
        )?;
        result.service_generation = r.service_generation;
        result.binding_digest = hash;
    }
    Ok(Some(result))
}
