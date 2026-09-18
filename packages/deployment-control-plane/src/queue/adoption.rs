use super::*;
use crate::{
    transaction::adoption::{
        VerifiedAdoptedBaseline, VerifiedAdoptionFinalization, VerifiedAdoptionGrant,
    },
    trust::digest,
};
pub(super) fn pending(tx: &Transaction<'_>) -> Result<bool> {
    Ok(tx.query_row(
        "SELECT count(*) FROM target_adoption WHERE activation_receipt IS NULL",
        [],
        |r| r.get::<_, u64>(0),
    )? > 0)
}
pub(super) fn gate(tx: &Transaction<'_>, operation: Option<&str>, target: &str) -> Result<()> {
    let count: u64 = tx.query_row(
        "SELECT count(*) FROM target_adoption WHERE activation_receipt IS NULL",
        [],
        |r| r.get(0),
    )?;
    if count == 0 {
        return Ok(());
    }
    require(count == 1, "ADOPTION_PENDING")?;
    let (op, t): (String, String) = tx.query_row(
        "SELECT grant_digest,target FROM target_adoption WHERE activation_receipt IS NULL",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    require(
        operation == Some(op.as_str()) && t == target,
        "ADOPTION_PENDING",
    )
}
impl Queue {
    pub(crate) fn pin_adoption_proposal(
        &self,
        proof: &VerifiedAdoptionGrant,
        p: &Proposal,
    ) -> Result<()> {
        self.transaction(|tx| {
            let hash = digest(proof.get())?;
            gate(tx, Some(&hash), &p.desired.payload.target_runtime)?;
            let old: Option<String> = tx
                .query_row(
                    "SELECT proposal_digest FROM adoption_proposals WHERE grant_digest=?",
                    [&hash],
                    |r| r.get(0),
                )
                .optional()?;
            let proposal = digest(p)?;
            if let Some(old) = old {
                return require(old == proposal, "ADOPTION_PROPOSAL_CHANGED");
            }
            tx.execute(
                "INSERT INTO adoption_proposals VALUES (?,?,?)",
                (&hash, &proposal, json(p)?),
            )?;
            Ok(())
        })
    }

    pub(crate) fn require_standing_activation(&self) -> Result<()> {
        self.transaction(|tx| require(!pending(tx)?, "ADOPTION_PENDING"))
    }
    pub(crate) fn reserve_adoption(
        &self,
        proof: &VerifiedAdoptionGrant,
        target: &str,
    ) -> Result<()> {
        let grant = proof.get();
        let hash = digest(grant)?;
        self.transaction(|tx|{
            let quarantine:u64=tx.query_row("SELECT value FROM meta WHERE key='quarantine'",[],|r|r.get(0))?;
            require(quarantine==0,"UNKNOWN_OUTCOME")?;
            let old:Option<String>=tx.query_row("SELECT grant_digest FROM target_adoption WHERE target=?",[target],|r|r.get(0)).optional()?;
            if let Some(old)=old {return require(old==hash,"ADOPTION_EXISTS")}
            require(!pending(tx)?,"ADOPTION_PENDING")?;
            let count:u64=tx.query_row("SELECT count(*) FROM intents WHERE target=?",[target],|r|r.get(0))?;
            let unsafe_count:u64=tx.query_row("SELECT count(*) FROM units WHERE state NOT IN ('\"Applied\"','\"Cancelled\"','\"Superseded\"')",[],|r|r.get(0))?;
            let unfinished:u64=tx.query_row("SELECT count(*) FROM executor_pending",[],|r|r.get(0))?;
            require(count==0,"ADOPTION_EXISTS")?;require(unsafe_count==0 && unfinished==0,"RECOVERY_REQUIRED")?;
            tx.execute("INSERT INTO target_adoption(target,operation,grant_digest,grant_record) VALUES (?,?,?,?)",(target,&grant.payload.operation_id,&hash,json(grant)?))?;
            Ok(())
        })
    }
    pub(crate) fn adoption_unit(&self, grant: &Signed<AdoptionGrant>) -> Result<Option<String>> {
        self.transaction(|tx| {
            Ok(tx.query_row(
                "SELECT unit FROM target_adoption WHERE grant_digest=?",
                [digest(grant)?],
                |r| r.get(0),
            )?)
        })
    }
    pub(crate) fn bind_adoption_unit(&self, proof: &VerifiedAdoptionGrant, id: &str) -> Result<()> {
        self.transaction(|tx| {
            let s = read_status(tx, id)?;
            let hash = digest(proof.get())?;
            gate(tx, Some(&hash), &s.unit.target_runtime)?;
            let old: Option<String> = tx.query_row(
                "SELECT unit FROM target_adoption WHERE grant_digest=?",
                [&hash],
                |r| r.get(0),
            )?;
            require(old.as_ref().is_none_or(|x| x == id), "ADOPTION_BINDING")?;
            require(
                s.mutating_attempts == 0 && s.unit.expected_target_generation == 0,
                "ADOPTION_BINDING",
            )?;
            tx.execute(
                "UPDATE target_adoption SET unit=? WHERE grant_digest=?",
                (id, &hash),
            )?;
            Ok(())
        })
    }
    pub(crate) fn publish_adoption(&self, proof: &VerifiedAdoptedBaseline) -> Result<()> {
        let r = proof.receipt();
        let hash = digest(r)?;
        self.transaction(|tx| {
            let s = read_status(tx, &r.unit_id)?;
            let expected: (String, Option<String>) = tx.query_row(
                "SELECT grant_digest,receipt FROM target_adoption WHERE unit=?",
                [&r.unit_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            require(
                expected.0 == r.grant_digest && expected.1.as_ref().is_none_or(|x| x == &hash),
                "ADOPTION_BINDING",
            )?;
            if expected.1.is_some() {
                return Ok(());
            }
            require(
                s.state == State::Queued
                    && s.mutating_attempts == 0
                    && s.unit.expected_target_generation == 0
                    && r.attempt == 0
                    && r.target_generation == 1
                    && r.install_count == 0
                    && r.restart_count == 0
                    && r.artifact_sha256 == s.unit.artifact_sha256
                    && r.manifest_digest == s.unit.manifest_digest
                    && r.source_sha == s.unit.source_sha
                    && r.profile_revision == s.unit.profile_revision
                    && r.target_runtime == s.unit.target_runtime
                    && r.build_attestation_digest == s.unit.build_attestation_digest
                    && r.review_digests == super::readback::effective_reviews(tx, &r.unit_id)?
                    && r.attachment_digests
                        == super::readback::read_attachments(tx, &r.unit_id)?
                            .iter()
                            .map(|a| a.digest.clone())
                            .collect::<Vec<_>>()
                    && r.dependency_receipts
                        == s.unit
                            .dependency_units
                            .iter()
                            .map(|d| d.receipt_digest.clone())
                            .collect::<Vec<_>>(),
                "ADOPTION_BINDING",
            )?;
            tx.execute(
                "INSERT INTO receipts VALUES (?,?,?,?)",
                (&hash, &r.unit_id, "adopted-baseline", json(r)?),
            )?;
            tx.execute(
                "INSERT INTO installed VALUES (?,?,?,?)",
                (&r.target_runtime, &r.unit_id, r.target_generation, &hash),
            )?;
            tx.execute("INSERT INTO executor_pending VALUES (?)", [&r.unit_id])?;
            tx.execute(
                "UPDATE units SET state='\"Applied\"',revision=revision+1 WHERE id=?",
                [&r.unit_id],
            )?;
            tx.execute(
                "INSERT INTO journal(unit,revision,state,evidence) VALUES (?,?,'\"Applied\"',?)",
                (&r.unit_id, s.revision + 1, &hash),
            )?;
            tx.execute(
                "UPDATE target_adoption SET receipt=? WHERE unit=?",
                (&hash, &r.unit_id),
            )?;
            Ok(())
        })
    }
    pub(crate) fn complete_adoption_baseline(
        &self,
        proof: VerifiedAdoptionFinalization,
    ) -> Result<()> {
        let r = proof.receipt();
        let hash = digest(r)?;
        self.transaction(|tx| {
            let stored: Option<String> = tx.query_row(
                "SELECT receipt FROM target_adoption WHERE grant_digest=? AND unit=?",
                (&r.grant_digest, &r.unit_id),
                |row| row.get(0),
            )?;
            require(
                stored.as_ref() == Some(&hash)
                    && read_status(tx, &r.unit_id)?.state == State::Applied,
                "ADOPTION_BINDING",
            )?;
            tx.execute("DELETE FROM executor_pending WHERE unit=?", [&r.unit_id])?;
            tx.execute(
                "UPDATE target_adoption SET baseline_done=1 WHERE grant_digest=?",
                [&r.grant_digest],
            )?;
            Ok(())
        })
    }
}
impl Queue {
    pub(crate) fn adoption_grant_for_unit(
        &self,
        id: &str,
    ) -> Result<Option<Signed<AdoptionGrant>>> {
        self.transaction(|tx| {
            let raw: Option<String> = tx
                .query_row(
                    "SELECT grant_record FROM target_adoption WHERE unit=?",
                    [id],
                    |r| r.get(0),
                )
                .optional()?;
            raw.map(parse).transpose()
        })
    }
    pub(crate) fn complete_standing_activation(
        &self,
        proof: crate::transaction::activation::VerifiedStandingActivation,
    ) -> Result<String> {
        let receipt = proof.receipt();
        let hash = digest(receipt)?;
        self.transaction(|tx|{
   let (grant,baseline,done,old):(String,Option<String>,bool,Option<String>)=tx.query_row("SELECT grant_digest,receipt,baseline_done,activation_receipt FROM target_adoption WHERE unit=?",[&receipt.unit_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
   require(grant==receipt.adoption_grant_digest&&baseline.as_ref()==Some(&receipt.current.transaction_receipt_digest)&&done,"ACTIVATION_BINDING")?;
   require(old.as_ref().is_none_or(|old|old==&hash),"ACTIVATION_IMMUTABLE")?;
   let status=read_status(tx,&receipt.unit_id)?;
   require(status.state==State::Applied&&!super::executor_finalization::pending(tx,&receipt.unit_id)?&&super::physical::current(tx,&status.unit.target_runtime)?.as_ref()==Some(&receipt.current),"ACTIVATION_BINDING")?;
   let quarantine:u64=tx.query_row("SELECT value FROM meta WHERE key='quarantine'",[],|r|r.get(0))?;require(quarantine==0,"UNKNOWN_OUTCOME")?;
   tx.execute("INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)",(&hash,&receipt.unit_id,"standing-activation",json(receipt)?))?;
   tx.execute("UPDATE target_adoption SET activation_receipt=? WHERE unit=? AND activation_receipt IS NULL",(&hash,&receipt.unit_id))?;Ok(hash)
  })
    }
}
impl Queue {
    pub(crate) fn require_configured_activation(&self, operation: Option<&str>) -> Result<()> {
        self.require_standing_activation()?;
        self.transaction(|tx|{
   let Some(operation)=operation else{return Ok(())};
   let row:Option<(String,String)>=tx.query_row("SELECT r.digest,r.record FROM target_adoption a JOIN receipts r ON r.digest=a.activation_receipt WHERE a.operation=? AND a.baseline_done=1 AND r.kind='standing-activation'",[operation],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
   let (hash,raw)=row.ok_or(Error::new("ADOPTION_REQUIRED"))?;let r:StandingActivationReceipt=parse(raw)?;require(digest(&r)?==hash,"ACTIVATION_BINDING")
  })
    }
    pub(crate) fn authorize_adoption_preparation(
        &self,
        proof: &VerifiedAdoptionGrant,
    ) -> Result<()> {
        self.transaction(|tx|{
   let hash=digest(proof.get())?;
   let target:String=tx.query_row("SELECT target FROM target_adoption WHERE grant_digest=? AND receipt IS NULL AND activation_receipt IS NULL",[&hash],|r|r.get(0))?;
   gate(tx,Some(&hash),&target)
  })
    }
}
