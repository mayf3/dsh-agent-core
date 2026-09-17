use super::*;
impl Queue {
    /// Executor-only current installed receipt, pinned by the authoritative target ledger.
    pub fn daemon_installed_receipt(&self, target: &str) -> Result<Option<TransactionReceipt>> {
        self.transaction(|tx| {
            let raw: Option<String> = tx.query_row("SELECT receipts.record FROM installed JOIN receipts ON receipts.digest=installed.receipt WHERE installed.target=?", [target], |r| r.get(0)).optional()?;
            raw.map(parse).transpose()
        })
    }

    pub fn daemon_attachments(&self, id: &str) -> Result<Vec<CoverageAttachment>> {
        self.transaction(|tx| read_attachments(tx, id))
    }
    pub fn daemon_policy(&self, digest: &str) -> Result<Signed<Policy>> {
        self.transaction(|tx| {
            let raw: String = tx
                .query_row(
                    "SELECT record FROM policy_history WHERE digest=?",
                    [digest],
                    |r| r.get(0),
                )
                .optional()?
                .ok_or(Error::new("UNKNOWN_POLICY"))?;
            parse(raw)
        })
    }

    /// Trusted executor reads all immutable Goal attachments, including late arrivals.
    pub fn daemon_coverage(&self, id: &str) -> Result<Vec<Signed<ReadyRecord>>> {
        self.transaction(|tx| {
            read_status(tx, id)?;
            let mut statement =
                tx.prepare("SELECT record FROM coverage WHERE unit=? ORDER BY goal")?;
            let records = statement
                .query_map([id], |r| r.get::<_, String>(0))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            records.into_iter().map(parse).collect()
        })
    }
    /// Original sealed admission evidence. The daemon must rehash sealed artifacts separately.
    pub fn daemon_evidence(&self, id: &str) -> Result<Proposal> {
        self.transaction(|tx| {
            let raw: String = tx
                .query_row("SELECT evidence FROM units WHERE id=?", [id], |r| r.get(0))
                .optional()?
                .ok_or(Error::new("UNKNOWN_UNIT"))?;
            parse(raw)
        })
    }
    pub fn receipt_digests(&self, actor: &Actor, id: &str) -> Result<Vec<String>> {
        self.transaction(|tx| {
            authorize(tx, actor, id)?;
            let mut statement =
                tx.prepare("SELECT digest FROM receipts WHERE unit=? ORDER BY digest")?;
            let records = statement
                .query_map([id], |r| r.get::<_, String>(0))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            Ok(records)
        })
    }
    pub fn journal(&self, actor: &Actor, id: &str) -> Result<Vec<(u64, State, String)>> {
        self.transaction(|tx| {
            authorize(tx, actor, id)?;
            let mut statement = tx.prepare(
                "SELECT revision,state,evidence FROM journal WHERE unit=? ORDER BY revision",
            )?;
            let records = statement
                .query_map([id], |r| Ok((r.get(0)?, r.get::<_, String>(1)?, r.get(2)?)))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            records
                .into_iter()
                .map(|(rev, state, evidence)| Ok((rev, parse(state)?, evidence)))
                .collect()
        })
    }
}

pub(super) fn read_attachments(tx: &Transaction<'_>, id: &str) -> Result<Vec<CoverageAttachment>> {
    read_status(tx, id)?;
    let mut stmt =
        tx.prepare("SELECT digest,evidence FROM attachments WHERE unit=? ORDER BY digest")?;
    let rows = stmt
        .query_map([id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    rows.into_iter()
        .map(|(digest, raw)| {
            Ok(CoverageAttachment {
                digest,
                proposal: parse(raw)?,
            })
        })
        .collect()
}
pub(super) fn effective_reviews(tx: &Transaction<'_>, id: &str) -> Result<Vec<String>> {
    let mut reviews = std::collections::BTreeSet::new();
    for attachment in read_attachments(tx, id)? {
        for review in attachment.proposal.reviews {
            reviews.insert(crate::trust::digest(&review)?);
        }
    }
    Ok(reviews.into_iter().collect())
}
