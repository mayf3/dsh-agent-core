pub const SCHEMA: &str = r#"
PRAGMA foreign_keys=ON;
PRAGMA synchronous=FULL;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT OR IGNORE INTO meta VALUES ('census',0),('sequence',0),('quarantine',0),('verification',1);
CREATE TABLE IF NOT EXISTS producers(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, watermark INTEGER);
CREATE TABLE IF NOT EXISTS ready(goal TEXT PRIMARY KEY, producer TEXT NOT NULL REFERENCES producers(id), revision INTEGER NOT NULL, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY, goal TEXT NOT NULL, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS policy_history(digest TEXT PRIMARY KEY, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS policies(profile TEXT PRIMARY KEY, epoch INTEGER NOT NULL, digest TEXT NOT NULL, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intents(id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, desired_revision INTEGER NOT NULL,
 desired_digest TEXT NOT NULL, artifact TEXT NOT NULL, profile_revision TEXT NOT NULL, expected_generation INTEGER NOT NULL,
 preflight INTEGER NOT NULL DEFAULT 0, mutations INTEGER NOT NULL DEFAULT 0, UNIQUE(target,desired_revision));
CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY, intent INTEGER NOT NULL REFERENCES intents(id), target TEXT NOT NULL,
 profile TEXT NOT NULL, profile_revision TEXT NOT NULL, artifact TEXT NOT NULL, descriptor TEXT NOT NULL,
 state TEXT NOT NULL, revision INTEGER NOT NULL, seq INTEGER NOT NULL, failure_policy TEXT NOT NULL, resource TEXT NOT NULL,
 evidence TEXT NOT NULL, UNIQUE(target,intent,profile_revision,artifact));
CREATE TABLE IF NOT EXISTS actors(unit TEXT NOT NULL REFERENCES units(id), actor TEXT NOT NULL, PRIMARY KEY(unit,actor));
CREATE TABLE IF NOT EXISTS requests(actor TEXT NOT NULL, request TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(actor,request));
CREATE TABLE IF NOT EXISTS attachments(digest TEXT PRIMARY KEY, unit TEXT NOT NULL REFERENCES units(id), evidence TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS coverage(unit TEXT NOT NULL REFERENCES units(id), goal TEXT NOT NULL REFERENCES ready(goal), attachment TEXT NOT NULL REFERENCES attachments(digest), record TEXT NOT NULL, PRIMARY KEY(unit,goal));
CREATE TABLE IF NOT EXISTS dependencies(unit TEXT NOT NULL REFERENCES units(id), prerequisite TEXT NOT NULL REFERENCES units(id), record TEXT NOT NULL, PRIMARY KEY(unit,prerequisite));
CREATE TABLE IF NOT EXISTS journal(seq INTEGER PRIMARY KEY AUTOINCREMENT, unit TEXT NOT NULL REFERENCES units(id), revision INTEGER NOT NULL, state TEXT NOT NULL, evidence TEXT NOT NULL, UNIQUE(unit,revision));
CREATE TABLE IF NOT EXISTS receipts(digest TEXT PRIMARY KEY, unit TEXT NOT NULL REFERENCES units(id), kind TEXT NOT NULL, record TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goal_receipts(unit TEXT NOT NULL REFERENCES units(id), goal TEXT NOT NULL, revision INTEGER NOT NULL, digest TEXT NOT NULL REFERENCES receipts(digest), record TEXT NOT NULL, PRIMARY KEY(unit,goal,revision));
CREATE TABLE IF NOT EXISTS installed(target TEXT PRIMARY KEY, unit TEXT NOT NULL REFERENCES units(id), generation INTEGER NOT NULL, receipt TEXT NOT NULL REFERENCES receipts(digest));
CREATE TABLE IF NOT EXISTS physical_current(target TEXT PRIMARY KEY REFERENCES installed(target), receipt TEXT NOT NULL REFERENCES receipts(digest));
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, unit TEXT NOT NULL REFERENCES units(id), goal TEXT NOT NULL, producer TEXT NOT NULL, expected_revision INTEGER NOT NULL, receipt TEXT NOT NULL REFERENCES receipts(digest), delivered INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS adoption_proposals(grant_digest TEXT PRIMARY KEY, proposal_digest TEXT NOT NULL, proposal TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS immutable_adoption_proposal_update BEFORE UPDATE ON adoption_proposals BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_adoption_proposal_delete BEFORE DELETE ON adoption_proposals BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TABLE IF NOT EXISTS target_adoption(target TEXT PRIMARY KEY, operation TEXT UNIQUE NOT NULL, grant_digest TEXT NOT NULL, grant_record TEXT NOT NULL, unit TEXT REFERENCES units(id), receipt TEXT REFERENCES receipts(digest), baseline_done INTEGER NOT NULL DEFAULT 0, activation_receipt TEXT REFERENCES receipts(digest));
CREATE TRIGGER IF NOT EXISTS immutable_adoption_identity BEFORE UPDATE OF target,operation,grant_digest,grant_record ON target_adoption BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_adoption_delete BEFORE DELETE ON target_adoption BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TABLE IF NOT EXISTS executor_pending(unit TEXT PRIMARY KEY REFERENCES units(id));
CREATE TABLE IF NOT EXISTS verification_requests(unit TEXT PRIMARY KEY REFERENCES units(id), generation INTEGER NOT NULL DEFAULT 1 CHECK(generation>0), last_error TEXT);
CREATE TABLE IF NOT EXISTS pauses(unit TEXT PRIMARY KEY REFERENCES units(id));
CREATE TRIGGER IF NOT EXISTS immutable_policy_update BEFORE UPDATE ON policy_history BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_policy_delete BEFORE DELETE ON policy_history BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_receipts_update BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_receipts_delete BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_journal_update BEFORE UPDATE ON journal BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_journal_delete BEFORE DELETE ON journal BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_descriptor BEFORE UPDATE OF descriptor ON units BEGIN SELECT RAISE(ABORT,'immutable'); END;
"#;

// Additive upgrade preserves every previously acknowledged unit-only request.
pub fn migrate_verification(conn: &mut rusqlite::Connection) -> crate::Result<()> {
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let columns = {
        let mut statement = tx.prepare("PRAGMA table_info(verification_requests)")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(1))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    if !columns.iter().any(|c| c == "generation") {
        tx.execute("ALTER TABLE verification_requests ADD COLUMN generation INTEGER NOT NULL DEFAULT 1 CHECK(generation>0)",[])?;
    }
    if !columns.iter().any(|c| c == "last_error") {
        tx.execute(
            "ALTER TABLE verification_requests ADD COLUMN last_error TEXT",
            [],
        )?;
    }
    tx.commit()?;
    Ok(())
}
