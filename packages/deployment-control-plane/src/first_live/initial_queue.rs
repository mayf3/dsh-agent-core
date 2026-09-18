use crate::{fs::secure::Dir, queue::Queue, Result};
use std::path::Path;
pub(super) fn initialize(root: &Dir, path: &Path) -> Result<Queue> {
    for name in [
        "queue.db",
        "queue.db-wal",
        "queue.db-shm",
        "queue.db-journal",
    ] {
        super::files::absent(root, name)?;
    }
    let q = crate::service::initialize_queue(root, path)?;
    q.verify_first_live_empty()?;
    crate::service::initialize_mailbox(root)?;
    root.open_file("queue.db", libc::O_RDONLY, 0)?.sync_all()?;
    root.file.sync_all()?;
    Ok(q)
}
