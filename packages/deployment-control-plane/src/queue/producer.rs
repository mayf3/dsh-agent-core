use super::*;
use crate::trust::{valid_id, verify_signed};
impl Queue {
    /// Bootstrap-resolved trusted registry, never called on a caller's bare identifier.
    pub fn register_producer(&self, catalog: &Catalog, id: &str) -> Result<()> {
        valid_id(id)?;
        let key = catalog.keys.get(id).ok_or(Error::new("UNKNOWN_ISSUER"))?;
        require(
            key.role == Role::Producer && key.scopes.iter().any(|s| s == id),
            "PRODUCER_SCOPE",
        )?;
        self.transaction(|tx| {
            if tx.execute("INSERT OR IGNORE INTO producers VALUES (?,0,NULL)", [id])? > 0 {
                bump(tx, "census")?;
            }
            Ok(())
        })
    }
    pub fn register_ready(
        &self,
        catalog: &Catalog,
        record: &Signed<ReadyRecord>,
        expected: u64,
    ) -> Result<()> {
        check_ready(catalog, record)?;
        self.transaction(|tx| {
            write_ready(tx, record, expected)?;
            tx.execute(
                "UPDATE producers SET revision=revision+1,watermark=NULL WHERE id=?",
                [&record.issuer],
            )?;
            Ok(())
        })
    }
    pub fn ingest_snapshot(
        &self,
        catalog: &Catalog,
        snapshot: &Signed<ProducerSnapshot>,
    ) -> Result<()> {
        let p = &snapshot.payload;
        verify_signed(snapshot, catalog, &p.producer_id)?;
        require(snapshot.issuer == p.producer_id, "PRODUCER_SCOPE")?;
        require(
            Some(p.revision) == p.previous_revision.checked_add(1) && p.watermark == p.revision,
            "WATERMARK_GAP",
        )?;
        let mut goals = std::collections::BTreeSet::new();
        for r in &p.records {
            check_ready(catalog, r)?;
            require(
                r.issuer == p.producer_id && goals.insert(r.payload.goal_id.clone()),
                "PRODUCER_SCOPE",
            )?;
        }
        self.transaction(|tx| {
            let revision: Option<u64> = tx
                .query_row(
                    "SELECT revision FROM producers WHERE id=?",
                    [&p.producer_id],
                    |r| r.get(0),
                )
                .optional()?;
            require(revision == Some(p.previous_revision), "PRODUCER_CAS")?;
            let mut stmt = tx.prepare("SELECT goal FROM ready WHERE producer=?")?;
            let existing = stmt
                .query_map([&p.producer_id], |r| r.get::<_, String>(0))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            require(
                existing.iter().all(|g| goals.contains(g)),
                "SNAPSHOT_INCOMPLETE",
            )?;
            for r in &p.records {
                let current: Option<(u64, String)> = tx
                    .query_row(
                        "SELECT revision,record FROM ready WHERE goal=?",
                        [&r.payload.goal_id],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .optional()?;
                if current.as_ref().is_some_and(|(rev, raw)| {
                    *rev == r.payload.revision && *raw == json(r).unwrap_or_default()
                }) {
                    continue;
                }
                write_ready(tx, r, current.map(|x| x.0).unwrap_or(0))?;
            }
            tx.execute(
                "UPDATE producers SET revision=?,watermark=? WHERE id=?",
                (p.revision, p.watermark, &p.producer_id),
            )?;
            bump(tx, "census")?;
            Ok(())
        })
    }
    pub fn census_revision(&self) -> Result<u64> {
        self.transaction(|tx| {
            Ok(
                tx.query_row("SELECT value FROM meta WHERE key='census'", [], |r| {
                    r.get(0)
                })?,
            )
        })
    }
    pub fn census(&self, revision: u64, cursor: Option<&str>, limit: u32) -> Result<CensusPage> {
        require(limit > 0 && limit <= 256, "PAGE_LIMIT")?;
        self.transaction(|tx| {
            let actual: u64 =
                tx.query_row("SELECT value FROM meta WHERE key='census'", [], |r| {
                    r.get(0)
                })?;
            require(revision == actual, "CENSUS_CHANGED")?;
            let gaps: u64 = tx.query_row(
                "SELECT count(*) FROM producers WHERE watermark IS NULL OR watermark != revision",
                [],
                |r| r.get(0),
            )?;
            let mut stmt =
                tx.prepare("SELECT goal,record FROM ready WHERE goal>? ORDER BY goal LIMIT ?")?;
            let rows = stmt
                .query_map((cursor.unwrap_or(""), limit + 1), |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
                })?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            let next_cursor = if rows.len() > limit as usize {
                Some(rows[limit as usize - 1].0.clone())
            } else {
                None
            };
            let records = rows
                .into_iter()
                .take(limit as usize)
                .map(|x| parse(x.1))
                .collect::<Result<Vec<_>>>()?;
            Ok(CensusPage {
                revision,
                records,
                next_cursor,
                exhaustive: gaps == 0,
            })
        })
    }
    /// Ordered durable change cursor; the returned census revision must still be checked for watermark gaps.
    pub fn changes(&self, after: u64, limit: u32) -> Result<Vec<(u64, Signed<ReadyRecord>)>> {
        require(limit > 0 && limit <= 256, "PAGE_LIMIT")?;
        self.transaction(|tx| {
            let mut stmt =
                tx.prepare("SELECT seq,record FROM changes WHERE seq>? ORDER BY seq LIMIT ?")?;
            let rows = stmt
                .query_map((after, limit), |r| Ok((r.get(0)?, r.get::<_, String>(1)?)))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            rows.into_iter()
                .map(|(seq, raw)| Ok((seq, parse(raw)?)))
                .collect()
        })
    }
}
fn check_ready(c: &Catalog, r: &Signed<ReadyRecord>) -> Result<()> {
    verify_signed(r, c, &r.payload.producer_id)?;
    valid_id(&r.payload.goal_id)?;
    require(
        r.issuer == r.payload.producer_id && r.payload.revision > 0,
        "PRODUCER_SCOPE",
    )
}
fn write_ready(tx: &Transaction<'_>, r: &Signed<ReadyRecord>, expected: u64) -> Result<()> {
    let g = &r.payload;
    let current: Option<(String, u64)> = tx
        .query_row(
            "SELECT producer,revision FROM ready WHERE goal=?",
            [&g.goal_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    require(
        current.as_ref().map_or(expected == 0, |(producer, rev)| {
            *rev == expected && producer == &r.issuer
        }) && Some(g.revision) == expected.checked_add(1),
        "PRODUCER_CAS",
    )?;
    require(
        tx.query_row(
            "SELECT 1 FROM producers WHERE id=?",
            [&r.issuer],
            |_| Ok(()),
        )
        .optional()?
        .is_some(),
        "UNKNOWN_PRODUCER",
    )?;
    tx.execute("INSERT INTO ready VALUES (?,?,?,?) ON CONFLICT(goal) DO UPDATE SET revision=excluded.revision,record=excluded.record",
        (&g.goal_id,&g.producer_id,g.revision,json(r)?))?;
    let seq = bump(tx, "census")?;
    tx.execute(
        "INSERT INTO changes VALUES (?,?,?)",
        (seq, &g.goal_id, json(r)?),
    )?;
    Ok(())
}
