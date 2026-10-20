//! What the app remembers about quests it has started.
//!
//! A quest outlives the application: the stub keeps running after the app is closed.
//! The record is what lets the app find that process again, and — more importantly —
//! what lets it tell the truth about what is still running when it comes back.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// Bumped when the on-disk shape changes in a way older builds cannot read.
pub const RECORDS_SCHEMA_VERSION: u32 = 1;

const RECORDS_FILE: &str = "quests.json";

/// One quest, as it was started.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestRecord {
    pub id: String,
    pub app_id: String,
    pub display_name: String,
    /// The catalogue path this quest is mirroring.
    pub registered_path: String,
    /// Where the stub was written.
    pub stub_path: String,
    pub pid: u32,
    pub started_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestRecords {
    schema_version: u32,
    quests: Vec<QuestRecord>,
}

/// Where the quest records live.
pub fn path_in(dir: &Path) -> PathBuf {
    dir.join(RECORDS_FILE)
}

/// Read the recorded quests.
///
/// A file that cannot be read is reported rather than ignored: silently losing the
/// record of a running process would make the app claim nothing is running when
/// something is.
pub fn read(dir: &Path) -> AppResult<Vec<QuestRecord>> {
    let path = path_in(dir);

    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(AppError::io(format!(
                "could not read the quest records at {}: {error}",
                path.display()
            )))
        }
    };

    let records: QuestRecords = serde_json::from_str(&text).map_err(|error| {
        AppError::io(format!(
            "the quest records at {} could not be decoded: {error}",
            path.display()
        ))
    })?;

    if records.schema_version != RECORDS_SCHEMA_VERSION {
        // A file from another build describes a world this build does not know.
        return Ok(Vec::new());
    }

    Ok(records.quests)
}

/// Write the recorded quests.
pub fn write(dir: &Path, quests: &[QuestRecord]) -> AppResult<()> {
    std::fs::create_dir_all(dir)?;

    let records = QuestRecords {
        schema_version: RECORDS_SCHEMA_VERSION,
        quests: quests.to_vec(),
    };

    let path = path_in(dir);
    let temporary = path.with_extension("json.tmp");

    let text = serde_json::to_string(&records)?;
    std::fs::write(&temporary, text)?;
    std::fs::rename(&temporary, &path)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_round_trip() {
        let dir = tempfile::tempdir().expect("a temp dir");
        let record = QuestRecord {
            id: "1:a/b.exe".into(),
            app_id: "1".into(),
            display_name: "Alpha".into(),
            registered_path: "a/b.exe".into(),
            stub_path: dir.path().join("a").join("b").display().to_string(),
            pid: 4321,
            started_at: 1_700_000_000,
        };

        write(dir.path(), std::slice::from_ref(&record)).expect("written");
        let read_back = read(dir.path()).expect("read");
        assert_eq!(read_back, vec![record]);
    }

    #[test]
    fn a_missing_file_reads_as_no_records() {
        let dir = tempfile::tempdir().expect("a temp dir");
        assert!(read(dir.path()).expect("read").is_empty());
    }

    #[test]
    fn a_file_from_another_build_reads_as_no_records() {
        let dir = tempfile::tempdir().expect("a temp dir");
        std::fs::write(path_in(dir.path()), r#"{"schemaVersion":99,"quests":[]}"#)
            .expect("written");
        assert!(read(dir.path()).expect("read").is_empty());
    }

    #[test]
    fn a_corrupt_file_is_reported() {
        let dir = tempfile::tempdir().expect("a temp dir");
        std::fs::write(path_in(dir.path()), "{ not json").expect("written");
        let error = read(dir.path()).expect_err("reported");
        assert_eq!(error.code, crate::error::ErrorCode::IoError);
    }

    #[test]
    fn a_stub_that_was_deleted_is_not_installed() {
        let dir = tempfile::tempdir().expect("a temp dir");
        let path = dir.path().join("stub");
        std::fs::write(&path, b"x").expect("written");
        assert!(path.is_file());
        std::fs::remove_file(&path).expect("deleted");
        assert!(!path.is_file());
    }
}
